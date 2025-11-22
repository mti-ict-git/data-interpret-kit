const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sql = require('mssql');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 150000;
  const keylen = 32;
  const digest = 'sha256';
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, keylen, digest).toString('hex');
  return { algo: 'pbkdf2', digest, iterations, salt, hash };
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const name = process.env.SEED_ADMIN_NAME || 'Administrator';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
  const config = {
    user: process.env.DATADB_USER,
    password: process.env.DATADB_PASSWORD,
    server: process.env.DATADB_SERVER,
    database: process.env.DATADB_NAME || 'VaultIDCardProcessor',
    port: parseInt(process.env.DATADB_PORT || '1433', 10),
    options: { encrypt: false, trustServerCertificate: true },
  };
  try {
    await sql.connect(config);
    const req1 = new sql.Request();
    req1.input('email', sql.NVarChar, email);
    const exists = await req1.query(`SELECT COUNT(1) AS cnt FROM [dbo].[Users] WHERE Email = @email`);
    if ((exists.recordset || [])[0]?.cnt > 0) {
      console.log('Admin already exists:', email);
      return;
    }
    const ph = JSON.stringify(hashPassword(password));
    const req2 = new sql.Request();
    req2.input('name', sql.NVarChar, name);
    req2.input('email', sql.NVarChar, email);
    req2.input('ph', sql.NVarChar, ph);
    const rs = await req2.query(
      `INSERT INTO [dbo].[Users] (Username, Email, Role, Status, PasswordHash)
       OUTPUT inserted.Id, inserted.Email, inserted.Role
       VALUES (@name, @email, N'Admin', N'Active', @ph)`
    );
    console.log('Seeded admin:', (rs.recordset || [])[0]);
  } catch (err) {
    console.error('Seed admin failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await sql.close();
  }
}

main();