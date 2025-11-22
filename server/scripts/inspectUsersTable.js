const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sql = require('mssql');

async function main() {
  const cfg = {
    user: process.env.DATADB_USER,
    password: process.env.DATADB_PASSWORD,
    server: process.env.DATADB_SERVER,
    database: process.env.DATADB_NAME,
    port: parseInt(process.env.DATADB_PORT || '1433', 10),
    options: { encrypt: false, trustServerCertificate: true },
  };
  try {
    await sql.connect(cfg);
    const req = new sql.Request();
    const r = await req.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Users' ORDER BY ORDINAL_POSITION");
    console.log('Users columns:', r.recordset.map(x => x.COLUMN_NAME));
  } catch (err) {
    console.error('Inspect failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await sql.close();
  }
}

main();