const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const XLSX = require('xlsx');

/**
 * Utility: safe string trimming and defaulting
 */
function s(val, def = '') {
  if (val === undefined || val === null) return def;
  return String(val).trim();
}

/**
 * Map a row (from Excel/CSV) into the Vault AddCard payload fields.
 * This mapping is based on our current CSV schema and typical Excel columns.
 */
function mapRowToProfile(row) {
  // Try multiple potential column names to be robust across CSV/Excel variants
  const name = s(row['Card Name [Max 50]'] || row['Name'] || row['Employee Name'] || row['Employee'] || row['Nama']);
  const staffNoRaw = s(row['Staff No. [Max 10]'] || row['Emp. No'] || row['Employee ID'] || row['ID'] || row['NIK']);
  const department = s(row['Department'] || row['Departement'] || row['Dept'] || row['Department [Max 50]']);
  const company = s(row['Company'] || row['Company [Max 50]'] || 'Merdeka Tsingsan Indonesia');
  const email = s(row['Email'] || row['Email Address'] || '');
  const mobile = s(row['Mobile No. [Max 20]'] || row['Mobile No'] || row['Phone'] || '');
  const faceAccessLevel = s(row['Face Access Level'] || row['FaceAccessLevel'] || '');

  // Access Level logic: try direct value, or derive from MessHall senior/junior or other flags
  let accessLevel = s(row['Access Level'] || row['AccessLevel']);
  const messHall = s(row['MessHall'] || row['Mess Hall'] || '').toLowerCase();
  if (!accessLevel) {
    if (messHall.includes('senior')) accessLevel = '4';
    else if (messHall.includes('junior')) accessLevel = '2';
    else accessLevel = '13';
  }

  // CardNo must be max 10 characters as per some Vault constraints
  const cardNo = staffNoRaw.substring(0, 10);

  return {
    CardNo: cardNo,
    Name: name,
    Department: department,
    Company: company,
    AccessLevel: accessLevel,
    FaceAccessLevel: faceAccessLevel,
    Email: email,
    MobileNo: mobile,
    // Defaults
    ActiveStatus: 'true',
    NonExpired: 'true',
    ExpiredDate: '',
    DownloadCard: 'true',
    // Photo will be attached later if available
    Photo: null,
  };
}

/**
 * Build SOAP 1.1 envelope for AddCard
 */
function buildAddCardEnvelope(profile) {
  const photoTag = profile.Photo ? `<Photo>${profile.Photo}</Photo>` : '<Photo />';
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddCard xmlns="http://tempuri.org/">
      <CardNo>${escapeXml(profile.CardNo)}</CardNo>
      <Name>${escapeXml(profile.Name)}</Name>
      <Department>${escapeXml(profile.Department)}</Department>
      <Company>${escapeXml(profile.Company)}</Company>
      <AccessLevel>${escapeXml(profile.AccessLevel)}</AccessLevel>
      <FaceAccessLevel>${escapeXml(profile.FaceAccessLevel)}</FaceAccessLevel>
      <ActiveStatus>${escapeXml(profile.ActiveStatus)}</ActiveStatus>
      <NonExpired>${escapeXml(profile.NonExpired)}</NonExpired>
      <ExpiredDate>${escapeXml(profile.ExpiredDate)}</ExpiredDate>
      <Email>${escapeXml(profile.Email)}</Email>
      <MobileNo>${escapeXml(profile.MobileNo)}</MobileNo>
      ${photoTag}
      <DownloadCard>${escapeXml(profile.DownloadCard)}</DownloadCard>
    </AddCard>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Post AddCard SOAP request and return parsed result
 */
async function postAddCard(endpointBaseUrl, envelope) {
  const url = `${endpointBaseUrl}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://tempuri.org/AddCard',
    },
    body: envelope,
  });
  const text = await res.text();
  // Attempt to parse a simple result code/message from the XML response
  const errCodeMatch = text.match(/<ErrCode>(.*?)<\/ErrCode>/);
  const errMessageMatch = text.match(/<ErrMessage>(.*?)<\/ErrMessage>/);
  const cardIdMatch = text.match(/<CardID>(.*?)<\/CardID>/) || text.match(/<ID>(.*?)<\/ID>/);
  return {
    status: res.ok ? 'ok' : 'error',
    httpStatus: res.status,
    errCode: errCodeMatch ? errCodeMatch[1] : undefined,
    errMessage: errMessageMatch ? errMessageMatch[1] : undefined,
    cardId: cardIdMatch ? cardIdMatch[1] : undefined,
    raw: text,
  };
}

/**
 * Given an output directory for a job, detect available data sources and build registration profiles
 */
function collectProfilesFromOutputDir(outputDir) {
  // Prefer Excel "For_Machine_...xlsx"; fallback to CSV "CardDatafileformat_...csv"
  const files = fse.readdirSync(outputDir);
  const excelFile = files.find(f => /For_Machine_.*\.xlsx$/i.test(f));
  const csvFile = files.find(f => /CardDatafileformat_.*\.csv$/i.test(f));
  let rows = [];
  if (excelFile) {
    const wb = XLSX.readFile(path.join(outputDir, excelFile));
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } else if (csvFile) {
    const wb = XLSX.readFile(path.join(outputDir, csvFile));
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  }
  // Map rows to profiles
  const profiles = rows.map(mapRowToProfile);
  return profiles;
}

/**
 * Try to attach base64 photo to the profile if a matching image file is found.
 * We attempt filename patterns based on CardNo.
 */
function tryAttachPhoto(outputDir, profile) {
  const candidates = [
    `${profile.CardNo}.jpg`,
    `${profile.CardNo}.jpeg`,
    `${profile.CardNo}.png`,
  ];
  for (const fname of candidates) {
    const full = path.join(outputDir, fname);
    if (fs.existsSync(full)) {
      const buf = fs.readFileSync(full);
      profile.Photo = buf.toString('base64');
      return true;
    }
  }
  // No photo
  return false;
}

/**
 * Register all cards for a given job output directory
 */
async function registerJobToVault({ jobId, outputDir, endpointBaseUrl }) {
  const result = {
    jobId,
    endpointBaseUrl,
    attempted: 0,
    registered: 0,
    withPhoto: 0,
    withoutPhoto: 0,
    errors: [],
    details: [],
  };

  if (!fse.pathExistsSync(outputDir)) {
    result.errors.push({ code: 'OUTPUT_NOT_FOUND', message: `Output directory not found: ${outputDir}` });
    return result;
  }

  const profiles = collectProfilesFromOutputDir(outputDir);
  if (!profiles.length) {
    result.errors.push({ code: 'NO_ROWS', message: 'No rows found in Excel/CSV outputs.' });
    return result;
  }

  for (const profile of profiles) {
    result.attempted += 1;
    const hasPhoto = tryAttachPhoto(outputDir, profile);
    if (hasPhoto) result.withPhoto += 1; else result.withoutPhoto += 1;
    const envelope = buildAddCardEnvelope(profile);
    try {
      const resp = await postAddCard(endpointBaseUrl, envelope);
      if (resp.status === 'ok') {
        result.registered += 1;
      } else {
        result.errors.push({ code: 'HTTP_ERROR', message: `HTTP ${resp.httpStatus}`, cardNo: profile.CardNo });
      }
      result.details.push({ cardNo: profile.CardNo, name: profile.Name, hasPhoto, respCode: resp.errCode, respMessage: resp.errMessage });
    } catch (err) {
      result.errors.push({ code: 'REQUEST_FAILED', message: err.message, cardNo: profile.CardNo });
    }
  }

  return result;
}

module.exports = {
  registerJobToVault,
};