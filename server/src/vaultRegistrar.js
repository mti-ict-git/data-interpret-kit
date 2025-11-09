const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const XLSX = require('xlsx');
// SOAP configuration via environment (with safe defaults)
const SOAP_ACTION = process.env.VAULT_SOAP_ACTION || '';
const SOAP_NAMESPACE = process.env.VAULT_SOAP_NAMESPACE || 'http://tempuri.org/';
// Supported: '1.1' or '1.2'
const SOAP_VERSION = (process.env.VAULT_SOAP_VERSION || '1.1').trim();
// Defaults for access levels when source data leaves them blank (use Excel value if present, otherwise '00')
const DEFAULT_ACCESS_LEVEL = '00';
const DEFAULT_FACE_ACCESS_LEVEL = '00';
const DEFAULT_LIFT_ACCESS_LEVEL = '00';

/**
 * Utility: safe string trimming and defaulting
 */
function s(val, def = '') {
  if (val === undefined || val === null) return def;
  return String(val).trim();
}

// Logging helpers
function ts() { return new Date().toISOString(); }
function appendTextLog(outputDir, text) {
  try {
    const logPath = path.join(outputDir, 'vault-registration.log');
    fs.appendFileSync(logPath, `[${ts()}] ${text}\n`, { encoding: 'utf8' });
  } catch {}
}
// Write to file and mirror to backend terminal
function logInfo(outputDir, text) {
  appendTextLog(outputDir, text);
  try {
    console.log(`${ts()} - ${text}`);
  } catch {}
}
function appendJsonLog(outputDir, obj) {
  try {
    const jsonlPath = path.join(outputDir, 'vault-registration-log.jsonl');
    fs.appendFileSync(jsonlPath, JSON.stringify({ time: ts(), ...obj }) + '\n', { encoding: 'utf8' });
  } catch {}
}
// Produce a short snippet suitable for console output
function consoleSnippet(text, limit = 600) {
  try {
    if (!text) return '';
    const compact = String(text).replace(/\s+/g, ' ').trim();
    if (compact.length <= limit) return compact;
    return compact.slice(0, limit) + ' … (truncated)';
  } catch { return ''; }
}
function redactEnvelope(envelope) {
  if (!envelope) return envelope;
  return envelope.replace(/<Photo>.*?<\/Photo>/s, '<Photo>[redacted]</Photo>');
}

/**
 * Map a row (from Excel/CSV) into the Vault AddCard payload fields.
 * This mapping is based on our current CSV schema and typical Excel columns.
 */
function mapRowToProfile(row) {
  // Try multiple potential column names to be robust across CSV/Excel variants
  const name = s(row['Card Name [Max 50]'] || row['Card Name'] || row['Name'] || row['Employee Name'] || row['Employee'] || row['Nama']);
  const staffNoRaw = s(row['Staff No [Max 15]'] || row['Staff No. [Max 10]'] || row['Emp. No'] || row['Employee ID'] || row['ID'] || row['NIK']);
  const cardNoRaw = s(row['Card No #[Max 10]'] || row['Card No [Max 10]'] || row['Card No'] || row['CardNo'] || row['Card Number']);
  const department = s(row['Department [Max 50]'] || row['Department'] || row['Departement'] || row['Dept']);
  const company = s(row['Company [Max 50]'] || row['Company'] || 'Merdeka Tsingsan Indonesia');
  const email = s(row['Email [Max 50]'] || row['Email'] || row['Email Address'] || '');
  const mobile = s(row['Mobile No. [Max 20]'] || row['Mobile No'] || row['Phone'] || '');
  let faceAccessLevel = s(row['Face Access Level [Max 3]'] || row['Face Access Level'] || row['FaceAccessLevel'] || '');
  if (!faceAccessLevel) faceAccessLevel = DEFAULT_FACE_ACCESS_LEVEL;
  // Lift Access Level: required by API, default to '00' if blank to avoid -1 errors
  let liftAccessLevel = s(row['Lift Access Level [Max 3]'] || row['Lift Access Level'] || row['LiftAccessLevel'] || '');
  if (!liftAccessLevel) liftAccessLevel = DEFAULT_LIFT_ACCESS_LEVEL;

  // Access Level logic: try explicit value; otherwise derive from MessHall per new rules
  // - Labota -> 1
  // - Makarti -> 2
  // - No Access!! or empty -> blank
  let accessLevel = s(row['Access Level [Max 3]'] || row['Access Level'] || row['AccessLevel']);
  const messHallRaw = s(row['MessHall'] || row['Mess Hall'] || '');
  const messHall = messHallRaw.toLowerCase().trim();
  if (!accessLevel) {
    if (messHall === 'labota') accessLevel = '1';
    else if (messHall === 'makarti') accessLevel = '2';
    else if (messHall === '' || messHall === 'no access!!') accessLevel = '';
    else accessLevel = '';
  }
  if (!accessLevel) accessLevel = DEFAULT_ACCESS_LEVEL;

  // CardNo must be max 10 characters. Do NOT fall back to Staff No — Staff No is employee ID, not card number.
  const cardNo = (cardNoRaw || '').substring(0, 10);

  return {
    CardNo: cardNo,
    StaffNo: staffNoRaw,
    Name: name,
    Department: department,
    Company: company,
    AccessLevel: accessLevel,
    FaceAccessLevel: faceAccessLevel,
    LiftAccessLevel: liftAccessLevel,
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
function buildAddCardEnvelope(profile, { namespace = SOAP_NAMESPACE, soapVersion = SOAP_VERSION } = {}) {
  const soapEnvNs = soapVersion === '1.2' ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/';
  const photoTag = profile.Photo ? `<Photo>${escapeXml(profile.Photo)}</Photo>` : '<Photo />';
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="${soapEnvNs}">
  <soap:Body>
    <AddCard xmlns="${namespace}">
      <CardProfile>
        <CardNo>${escapeXml(profile.CardNo)}</CardNo>
        <Name>${escapeXml(profile.Name)}</Name>
        <CardPinNo>${escapeXml(profile.CardPinNo || '')}</CardPinNo>
        <CardType>${escapeXml(profile.CardType || '')}</CardType>
        <Department>${escapeXml(profile.Department)}</Department>
        <Company>${escapeXml(profile.Company)}</Company>
        <Gentle>${escapeXml(profile.Gentle || '')}</Gentle>
        <AccessLevel>${escapeXml(profile.AccessLevel)}</AccessLevel>
        <FaceAccessLevel>${escapeXml(profile.FaceAccessLevel)}</FaceAccessLevel>
        <LiftAccessLevel>${escapeXml(profile.LiftAccessLevel || '')}</LiftAccessLevel>
        <BypassAP>${escapeXml(profile.BypassAP || 'false')}</BypassAP>
        <ActiveStatus>${escapeXml(profile.ActiveStatus)}</ActiveStatus>
        <NonExpired>${escapeXml(profile.NonExpired)}</NonExpired>
        <ExpiredDate>${escapeXml(profile.ExpiredDate)}</ExpiredDate>
        <VehicleNo>${escapeXml(profile.VehicleNo || '')}</VehicleNo>
        <FloorNo>${escapeXml(profile.FloorNo || '')}</FloorNo>
        <UnitNo>${escapeXml(profile.UnitNo || '')}</UnitNo>
        <ParkingNo>${escapeXml(profile.ParkingNo || '')}</ParkingNo>
        <StaffNo>${escapeXml(profile.StaffNo || '')}</StaffNo>
        <Title>${escapeXml(profile.Title || '')}</Title>
        <Position>${escapeXml(profile.Position || '')}</Position>
        <NRIC>${escapeXml(profile.NRIC || '')}</NRIC>
        <Passport>${escapeXml(profile.Passport || '')}</Passport>
        <Race>${escapeXml(profile.Race || '')}</Race>
        <DOB>${escapeXml(profile.DOB || '')}</DOB>
        <JoiningDate>${escapeXml(profile.JoiningDate || '')}</JoiningDate>
        <ResignDate>${escapeXml(profile.ResignDate || '')}</ResignDate>
        <Address1>${escapeXml(profile.Address1 || '')}</Address1>
        <Address2>${escapeXml(profile.Address2 || '')}</Address2>
        <PostalCode>${escapeXml(profile.PostalCode || '')}</PostalCode>
        <City>${escapeXml(profile.City || '')}</City>
        <State>${escapeXml(profile.State || '')}</State>
        <Email>${escapeXml(profile.Email)}</Email>
        <MobileNo>${escapeXml(profile.MobileNo)}</MobileNo>
        ${photoTag}
        <DownloadCard>${escapeXml(profile.DownloadCard)}</DownloadCard>
      </CardProfile>
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
async function postAddCard(endpointBaseUrl, envelope, { soapVersion = SOAP_VERSION, soapAction = SOAP_ACTION } = {}) {
  const url = `${endpointBaseUrl}`;
  const headers = (soapVersion === '1.2')
    ? (() => {
        let ct = 'application/soap+xml; charset=utf-8';
        if (soapAction && String(soapAction).trim()) {
          ct += `; action="${soapAction}"`;
        }
        return { 'Content-Type': ct };
      })()
    : {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
      };
  const res = await fetch(url, {
    method: 'POST',
    headers,
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

// Read rows directly from a specific CSV file path
function readRowsFromCsvPath(csvPath) {
  try {
    const wb = XLSX.readFile(csvPath);
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows;
  } catch (err) {
    return [];
  }
}

// Read raw rows (objects) from output directory without mapping
function readRowsFromOutputDir(outputDir) {
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
  return rows;
}

/**
 * Try to attach base64 photo to the profile if a matching image file is found.
 * We attempt filename patterns based on CardNo.
 */
function tryAttachPhoto(outputDir, profile) {
  const baseCandidates = [];
  if (profile.CardNo) {
    baseCandidates.push(`${profile.CardNo}.jpg`, `${profile.CardNo}.jpeg`, `${profile.CardNo}.png`);
  }
  // Fallback: try StaffNo-based filenames if CardNo images not found
  if (profile.StaffNo) {
    baseCandidates.push(`${profile.StaffNo}.jpg`, `${profile.StaffNo}.jpeg`, `${profile.StaffNo}.png`);
  }
  const candidates = baseCandidates;
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

// Check whether a photo file exists for a given CardNo without loading it
function photoExists(outputDir, cardNo, staffNo = '') {
  const candidates = [];
  if (cardNo) {
    candidates.push(`${cardNo}.jpg`, `${cardNo}.jpeg`, `${cardNo}.png`);
  }
  if (staffNo) {
    candidates.push(`${staffNo}.jpg`, `${staffNo}.jpeg`, `${staffNo}.png`);
  }
  for (const fname of candidates) {
    const full = path.join(outputDir, fname);
    if (fs.existsSync(full)) {
      return true;
    }
  }
  return false;
}

/**
 * Register all cards for a given job output directory
 */
async function registerJobToVault({ jobId, outputDir, endpointBaseUrl, overrides = [] }) {
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

  logInfo(outputDir, `Start registration job=${jobId} endpoint=${endpointBaseUrl} soapVersion=${SOAP_VERSION} soapAction=${SOAP_ACTION} namespace=${SOAP_NAMESPACE}`);
  logInfo(outputDir, `Defaults: AccessLevel=${DEFAULT_ACCESS_LEVEL} FaceAccessLevel=${DEFAULT_FACE_ACCESS_LEVEL} LiftAccessLevel=${DEFAULT_LIFT_ACCESS_LEVEL}`);
  appendJsonLog(outputDir, { event: 'start', jobId, endpointBaseUrl, overridesCount: Array.isArray(overrides) ? overrides.length : 0 });

  const rows = readRowsFromOutputDir(outputDir);
  if (!rows.length) {
    result.errors.push({ code: 'NO_ROWS', message: 'No rows found in Excel/CSV outputs.' });
    logInfo(outputDir, 'No rows found in Excel/CSV outputs.');
    appendJsonLog(outputDir, { event: 'no_rows' });
    return result;
  }

  // Build index-based override map for quick lookup
  // Supports overrides: { index, cardNo?: string, downloadCard?: boolean }
  const overrideMap = new Map();
  if (Array.isArray(overrides)) {
    for (const o of overrides) {
      if (o && typeof o.index === 'number') {
        const cardNoVal = typeof o.cardNo === 'string' ? o.cardNo.trim().substring(0, 10) : undefined;
        const downloadCardVal = typeof o.downloadCard === 'boolean' ? o.downloadCard : undefined;
        overrideMap.set(o.index, { cardNo: cardNoVal, downloadCard: downloadCardVal });
      }
    }
  }
  appendJsonLog(outputDir, { event: 'override_map_ready', count: overrideMap.size });
  logInfo(outputDir, `Override map ready: ${overrideMap.size} item(s)`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const profile = mapRowToProfile(row);
    result.attempted += 1;

    appendJsonLog(outputDir, { event: 'row_mapped', index: i, cardNo: profile.CardNo, staffNo: profile.StaffNo, name: profile.Name });

    // Apply override if provided
    const overrideItem = overrideMap.get(i);
    if (overrideItem !== undefined) {
      if (overrideItem.cardNo !== undefined) {
        profile.CardNo = overrideItem.cardNo || '';
      }
      if (overrideItem.downloadCard !== undefined) {
        profile.DownloadCard = overrideItem.downloadCard ? 'true' : 'false';
      }
      appendJsonLog(outputDir, { event: 'override_applied', index: i, cardNo: profile.CardNo, downloadCard: profile.DownloadCard });
      logInfo(outputDir, `Row ${i}: override applied, CardNo=${profile.CardNo}, DownloadCard=${profile.DownloadCard}`);
    }

    // Validate required CardNo
    if (!profile.CardNo) {
      result.errors.push({ code: 'CARD_NO_MISSING', message: 'Card No is required', index: i, name: profile.Name });
      result.details.push({ cardNo: '', name: profile.Name, hasPhoto: false, respCode: 'CARD_NO_MISSING', respMessage: 'Card No is required' });
      logInfo(outputDir, `Row ${i}: Card No missing for name='${profile.Name}'`);
      appendJsonLog(outputDir, { event: 'card_no_missing', index: i, name: profile.Name });
      continue; // skip SOAP call
    }

    const photoCandidates = [];
    if (profile.CardNo) photoCandidates.push(`${profile.CardNo}.jpg`, `${profile.CardNo}.jpeg`, `${profile.CardNo}.png`);
    if (profile.StaffNo) photoCandidates.push(`${profile.StaffNo}.jpg`, `${profile.StaffNo}.jpeg`, `${profile.StaffNo}.png`);
    appendJsonLog(outputDir, { event: 'photo_candidates', index: i, candidates: photoCandidates });
    const hasPhoto = tryAttachPhoto(outputDir, profile);
    appendJsonLog(outputDir, { event: 'photo_attach_result', index: i, hasPhoto, photoSize: profile.Photo ? profile.Photo.length : 0 });
    if (hasPhoto) result.withPhoto += 1; else result.withoutPhoto += 1;
    const envelope = buildAddCardEnvelope(profile, { namespace: SOAP_NAMESPACE, soapVersion: SOAP_VERSION });
    logInfo(outputDir, `Row ${i}: POST AddCard cardNo=${profile.CardNo} name='${profile.Name}'`);
    appendJsonLog(outputDir, { event: 'soap_request', index: i, cardNo: profile.CardNo, name: profile.Name, envelope: redactEnvelope(envelope) });
    try {
      const resp = await postAddCard(endpointBaseUrl, envelope, { soapVersion: SOAP_VERSION, soapAction: SOAP_ACTION });
      appendJsonLog(outputDir, { event: 'soap_response', index: i, status: resp.status, httpStatus: resp.httpStatus, errCode: resp.errCode, errMessage: resp.errMessage, cardId: resp.cardId, raw: resp.raw });
      logInfo(outputDir, `Row ${i}: Resp HTTP=${resp.httpStatus} ErrCode=${resp.errCode ?? '-'} ErrMessage=${resp.errMessage ?? '-'} CardID=${resp.cardId ?? '-'}`);
      // Optional: show compact raw response in terminal for quick inspection
      const rawSnippet = consoleSnippet(resp.raw);
      if (rawSnippet) {
        logInfo(outputDir, `Row ${i}: SOAP raw: ${rawSnippet}`);
      }
      // Business success criteria: HTTP 2xx and ErrCode 0 or 1
      const errCodeNum = resp.errCode !== undefined ? Number(resp.errCode) : NaN;
      const bizSuccess = (resp.httpStatus >= 200 && resp.httpStatus < 300) && (errCodeNum === 0 || errCodeNum === 1);
      if (bizSuccess) {
        result.registered += 1;
      } else {
        // Distinguish HTTP transport errors from business errors
        if (!(resp.httpStatus >= 200 && resp.httpStatus < 300)) {
          result.errors.push({ code: 'HTTP_ERROR', message: `HTTP ${resp.httpStatus}`, cardNo: profile.CardNo });
          logInfo(outputDir, `Row ${i}: HTTP error for cardNo=${profile.CardNo} status=${resp.httpStatus}`);
        } else {
          result.errors.push({ code: 'VAULT_ERROR', message: resp.errMessage || 'Unknown error', errCode: resp.errCode, cardNo: profile.CardNo });
          logInfo(outputDir, `Row ${i}: VAULT_ERROR for cardNo=${profile.CardNo} errCode=${resp.errCode} message='${resp.errMessage || ''}'`);
        }
      }
      result.details.push({ cardNo: profile.CardNo, name: profile.Name, hasPhoto, respCode: resp.errCode, respMessage: resp.errMessage });
    } catch (err) {
      result.errors.push({ code: 'REQUEST_FAILED', message: err.message, cardNo: profile.CardNo });
      logInfo(outputDir, `Row ${i}: REQUEST_FAILED for cardNo=${profile.CardNo} message=${err.message}`);
      appendJsonLog(outputDir, { event: 'error', index: i, cardNo: profile.CardNo, message: err.message, stack: err.stack });
    }
  }

  logInfo(outputDir, `Job ${jobId} complete: Attempted=${result.attempted}, Registered=${result.registered}, WithPhoto=${result.withPhoto}, WithoutPhoto=${result.withoutPhoto}, Errors=${result.errors.length}`);
  appendJsonLog(outputDir, { event: 'complete', summary: { attempted: result.attempted, registered: result.registered, withPhoto: result.withPhoto, withoutPhoto: result.withoutPhoto, errors: result.errors.length } });
  return result;
}

/**
 * Register cards using a direct CSV file path (without requiring a Job).
 * Photos (if any) will be looked up in the same directory as the CSV.
 */
async function registerCsvPathToVault({ csvPath, endpointBaseUrl, overrides = [] }) {
  const outputDir = path.dirname(csvPath);
  const jobId = path.basename(outputDir);
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
  if (!fse.pathExistsSync(csvPath)) {
    result.errors.push({ code: 'CSV_NOT_FOUND', message: `CSV file not found: ${csvPath}` });
    return result;
  }

  logInfo(outputDir, `Start registration (CSV) dir=${outputDir} endpoint=${endpointBaseUrl} soapVersion=${SOAP_VERSION}`);
  logInfo(outputDir, `Defaults: AccessLevel=${DEFAULT_ACCESS_LEVEL} FaceAccessLevel=${DEFAULT_FACE_ACCESS_LEVEL} LiftAccessLevel=${DEFAULT_LIFT_ACCESS_LEVEL}`);
  appendJsonLog(outputDir, { event: 'start_csv', csvPath, endpointBaseUrl, overridesCount: Array.isArray(overrides) ? overrides.length : 0 });

  const rows = readRowsFromCsvPath(csvPath);
  if (!rows.length) {
    result.errors.push({ code: 'NO_ROWS', message: 'No rows found in CSV.' });
    logInfo(outputDir, 'No rows found in CSV.');
    appendJsonLog(outputDir, { event: 'no_rows_csv' });
    return result;
  }

  const overrideMap = new Map();
  if (Array.isArray(overrides)) {
    for (const o of overrides) {
      if (o && typeof o.index === 'number') {
        const cardNoVal = typeof o.cardNo === 'string' ? o.cardNo.trim().substring(0, 10) : undefined;
        const downloadCardVal = typeof o.downloadCard === 'boolean' ? o.downloadCard : undefined;
        overrideMap.set(o.index, { cardNo: cardNoVal, downloadCard: downloadCardVal });
      }
    }
  }
  appendJsonLog(outputDir, { event: 'override_map_ready_csv', count: overrideMap.size });
  logInfo(outputDir, `Override map ready (CSV): ${overrideMap.size} item(s)`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const profile = mapRowToProfile(row);
    result.attempted += 1;

    appendJsonLog(outputDir, { event: 'row_mapped_csv', index: i, cardNo: profile.CardNo, staffNo: profile.StaffNo, name: profile.Name });

    const overrideItem = overrideMap.get(i);
    if (overrideItem !== undefined) {
      if (overrideItem.cardNo !== undefined) {
        profile.CardNo = overrideItem.cardNo || '';
      }
      if (overrideItem.downloadCard !== undefined) {
        profile.DownloadCard = overrideItem.downloadCard ? 'true' : 'false';
      }
      appendJsonLog(outputDir, { event: 'override_applied_csv', index: i, cardNo: profile.CardNo, downloadCard: profile.DownloadCard });
      logInfo(outputDir, `Row ${i}: override applied (CSV), CardNo=${profile.CardNo}, DownloadCard=${profile.DownloadCard}`);
    }

    if (!profile.CardNo) {
      result.errors.push({ code: 'CARD_NO_MISSING', message: 'Card No is required', index: i, name: profile.Name });
      result.details.push({ cardNo: '', name: profile.Name, hasPhoto: false, respCode: 'CARD_NO_MISSING', respMessage: 'Card No is required' });
      logInfo(outputDir, `Row ${i}: Card No missing for name='${profile.Name}' (CSV)`);
      appendJsonLog(outputDir, { event: 'card_no_missing_csv', index: i, name: profile.Name });
      continue;
    }

    const hasPhoto = tryAttachPhoto(outputDir, profile);
    appendJsonLog(outputDir, { event: 'photo_attach_result_csv', index: i, hasPhoto, photoSize: profile.Photo ? profile.Photo.length : 0 });
    if (hasPhoto) result.withPhoto += 1; else result.withoutPhoto += 1;
    const envelope = buildAddCardEnvelope(profile, { namespace: SOAP_NAMESPACE, soapVersion: SOAP_VERSION });
    logInfo(outputDir, `Row ${i}: POST AddCard (CSV) cardNo=${profile.CardNo} name='${profile.Name}'`);
    appendJsonLog(outputDir, { event: 'soap_request_csv', index: i, cardNo: profile.CardNo, name: profile.Name, envelope: redactEnvelope(envelope) });
    try {
      const resp = await postAddCard(endpointBaseUrl, envelope, { soapVersion: SOAP_VERSION, soapAction: SOAP_ACTION });
      appendJsonLog(outputDir, { event: 'soap_response_csv', index: i, status: resp.status, httpStatus: resp.httpStatus, errCode: resp.errCode, errMessage: resp.errMessage, cardId: resp.cardId, raw: resp.raw });
      logInfo(outputDir, `Row ${i}: Resp (CSV) HTTP=${resp.httpStatus} ErrCode=${resp.errCode ?? '-'} ErrMessage=${resp.errMessage ?? '-'} CardID=${resp.cardId ?? '-'}`);
      const rawSnippet = consoleSnippet(resp.raw);
      if (rawSnippet) {
        logInfo(outputDir, `Row ${i}: SOAP raw (CSV): ${rawSnippet}`);
      }
      const errCodeNum = resp.errCode !== undefined ? Number(resp.errCode) : NaN;
      const bizSuccess = (resp.httpStatus >= 200 && resp.httpStatus < 300) && (errCodeNum === 0 || errCodeNum === 1);
      if (bizSuccess) {
        result.registered += 1;
      } else {
        if (!(resp.httpStatus >= 200 && resp.httpStatus < 300)) {
          result.errors.push({ code: 'HTTP_ERROR', message: `HTTP ${resp.httpStatus}`, cardNo: profile.CardNo });
          logInfo(outputDir, `Row ${i}: HTTP error (CSV) for cardNo=${profile.CardNo} status=${resp.httpStatus}`);
        } else {
          result.errors.push({ code: 'VAULT_ERROR', message: resp.errMessage || 'Unknown error', errCode: resp.errCode, cardNo: profile.CardNo });
          logInfo(outputDir, `Row ${i}: VAULT_ERROR (CSV) for cardNo=${profile.CardNo} errCode=${resp.errCode} message='${resp.errMessage || ''}'`);
        }
      }
      result.details.push({ cardNo: profile.CardNo, name: profile.Name, hasPhoto, respCode: resp.errCode, respMessage: resp.errMessage });
    } catch (err) {
      result.errors.push({ code: 'REQUEST_FAILED', message: err.message, cardNo: profile.CardNo });
      logInfo(outputDir, `Row ${i}: REQUEST_FAILED (CSV) for cardNo=${profile.CardNo} message=${err.message}`);
      appendJsonLog(outputDir, { event: 'error_csv', index: i, cardNo: profile.CardNo, message: err.message, stack: err.stack });
    }
  }

  logInfo(outputDir, `CSV registration complete: Attempted=${result.attempted}, Registered=${result.registered}, WithPhoto=${result.withPhoto}, WithoutPhoto=${result.withoutPhoto}, Errors=${result.errors.length}`);
  appendJsonLog(outputDir, { event: 'complete_csv', summary: { attempted: result.attempted, registered: result.registered, withPhoto: result.withPhoto, withoutPhoto: result.withoutPhoto, errors: result.errors.length } });
  return result;
}

module.exports = {
  registerJobToVault,
  photoExists,
  registerCsvPathToVault,
  /**
   * Preview profiles to be registered without executing SOAP calls.
   * Returns counts and per-card details (cardNo, name, department, hasPhoto).
   */
  previewJobToVault: ({ jobId, outputDir }) => {
    const result = {
      jobId,
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

    const rows = readRowsFromOutputDir(outputDir);
    if (!rows.length) {
      result.errors.push({ code: 'NO_ROWS', message: 'No rows found in Excel/CSV outputs.' });
      return result;
    }

    for (const row of rows) {
      const profile = mapRowToProfile(row);
      result.attempted += 1;
      const hasPhoto = tryAttachPhoto(outputDir, profile);
      if (hasPhoto) result.withPhoto += 1; else result.withoutPhoto += 1;
      result.details.push({
        cardNo: profile.CardNo,
        name: profile.Name,
        department: profile.Department,
        staffNo: s(row['Staff No [Max 15]'] || row['Staff No. [Max 10]'] || row['Emp. No'] || row['Employee ID'] || row['ID'] || row['NIK']) || profile.CardNo,
        hasPhoto,
        sourceRow: row,
        profile,
      });
    }

    return result;
  },
  /**
   * Preview from a specific CSV file path.
   */
  previewCsvPathToVault: ({ csvPath }) => {
    const outputDir = path.dirname(csvPath);
    const jobId = path.basename(outputDir);
    const result = {
      jobId,
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
    if (!fse.pathExistsSync(csvPath)) {
      result.errors.push({ code: 'CSV_NOT_FOUND', message: `CSV file not found: ${csvPath}` });
      return result;
    }

    const rows = readRowsFromCsvPath(csvPath);
    if (!rows.length) {
      result.errors.push({ code: 'NO_ROWS', message: 'No rows found in CSV.' });
      return result;
    }

    for (const row of rows) {
      const profile = mapRowToProfile(row);
      result.attempted += 1;
      const hasPhoto = tryAttachPhoto(outputDir, profile);
      if (hasPhoto) result.withPhoto += 1; else result.withoutPhoto += 1;
      result.details.push({
        cardNo: profile.CardNo,
        name: profile.Name,
        department: profile.Department,
        staffNo: s(row['Staff No [Max 15]'] || row['Staff No. [Max 10]'] || row['Emp. No'] || row['Employee ID'] || row['ID'] || row['NIK']) || profile.CardNo,
        hasPhoto,
        sourceRow: row,
        profile,
      });
    }

    return result;
  },
};