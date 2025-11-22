const crypto = require('crypto');
const database = require('./database');

function sanitize(input) {
  const s = String(input || '').trim();
  return s.slice(0, 200);
}

const AllowedStatuses = ['Active', 'Inactive'];
function normalizeStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active') return 'Active';
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}
function isStatusValid(status) {
  return AllowedStatuses.includes(normalizeStatus(status));
}

async function getAllUsers() {
  const q = `SELECT Id as id, Username as name, Email as email, Role as role, Status as status, PasswordHash as passwordHash, CreatedAt as createdAt, UpdatedAt as updatedAt FROM [dbo].[Users] ORDER BY CreatedAt DESC`;
  const rs = await database.query(q);
  const rows = (rs.recordset || []).map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    status: r.status,
    passwordHash: r.passwordHash ? safeParseJson(r.passwordHash) : undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return rows;
}

async function getUser(id) {
  const rs = await database.query(`SELECT TOP 1 Id as id, Username as name, Email as email, Role as role, Status as status, PasswordHash as passwordHash, CreatedAt as createdAt, UpdatedAt as updatedAt FROM [dbo].[Users] WHERE Id = @id`, { id });
  const r = (rs.recordset || [])[0];
  if (!r) return null;
  return { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, passwordHash: r.passwordHash ? safeParseJson(r.passwordHash) : undefined, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

const AllowedRoles = ['Admin', 'User'];
function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'user') return 'User';
  return 'User';
}

function isRoleValid(role) {
  return AllowedRoles.includes(normalizeRole(role));
}

function isPasswordStrong(password) {
  const s = String(password || '');
  return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 150000;
  const keylen = 32;
  const digest = 'sha256';
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, keylen, digest).toString('hex');
  return { algo: 'pbkdf2', digest, iterations, salt, hash };
}

function verifyPassword(password, ph) {
  if (!ph || ph.algo !== 'pbkdf2') return false;
  const hash = crypto.pbkdf2Sync(String(password), ph.salt, ph.iterations, 32, ph.digest).toString('hex');
  return hash === ph.hash;
}

async function createUser(payload) {
  const name = sanitize(payload.name);
  const email = sanitize(payload.email).toLowerCase();
  const role = normalizeRole(payload.role || 'User');
  const status = normalizeStatus(payload.status || 'Active');
  const passwordHash = payload.password ? JSON.stringify(hashPassword(payload.password)) : null;
  const q = `INSERT INTO [dbo].[Users] (Username, Email, Role, Status, PasswordHash)
             OUTPUT inserted.Id as id, inserted.Username as name, inserted.Email as email, inserted.Role as role, inserted.Status as status, inserted.CreatedAt as createdAt, inserted.UpdatedAt as updatedAt
             VALUES (@name, @email, @role, @status, @passwordHash)`;
  const rs = await database.query(q, { name, email, role, status, passwordHash });
  const r = (rs.recordset || [])[0];
  return { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

async function updateUser(id, payload) {
  const name = payload.name !== undefined ? sanitize(payload.name) : null;
  const email = payload.email !== undefined ? sanitize(payload.email).toLowerCase() : null;
  const role = payload.role !== undefined ? normalizeRole(payload.role) : null;
  const status = payload.status !== undefined ? normalizeStatus(payload.status) : null;
  const passwordHash = payload.password ? JSON.stringify(hashPassword(payload.password)) : null;
  const q = `UPDATE [dbo].[Users]
             SET Username = COALESCE(@name, Username),
                 Email = COALESCE(@email, Email),
                 Role = COALESCE(@role, Role),
                 Status = COALESCE(@status, Status),
                 PasswordHash = COALESCE(@passwordHash, PasswordHash),
                 UpdatedAt = SYSUTCDATETIME()
             WHERE Id = @id`;
  const rs = await database.query(q, { id, name, email, role, status, passwordHash });
  const affected = Array.isArray(rs?.rowsAffected) ? rs.rowsAffected.reduce((a,b)=>a+b,0) : 0;
  if (!affected) return null;
  const rs2 = await database.query(`SELECT TOP 1 Id as id, Username as name, Email as email, Role as role, Status as status, PasswordHash as passwordHash, CreatedAt as createdAt, UpdatedAt as updatedAt FROM [dbo].[Users] WHERE Id = @id`, { id });
  const r = (rs2.recordset || [])[0];
  if (!r) return null;
  return { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

async function deleteUser(id) {
  const rs = await database.query(`DELETE FROM [dbo].[Users] WHERE Id = @id; SELECT @@ROWCOUNT AS affected;`, { id });
  const affected = (rs.recordset || [])[0]?.affected || 0;
  return affected > 0;
}

function safeParseJson(s) {
  try { return JSON.parse(String(s || '')); } catch { return undefined; }
}

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  isRoleValid,
  isStatusValid,
  isPasswordStrong,
  verifyPassword,
};