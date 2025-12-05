const crypto = require('crypto');
const userStore = require('./userStore');
const database = require('./database');

const SECRET = process.env.APP_SECRET || 'dev-secret';
const sessions = new Map();
const TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function sign(payload) {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return Buffer.from(data).toString('base64') + '.' + hmac;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  let dataStr;
  try { dataStr = Buffer.from(b64, 'base64').toString('utf8'); } catch { return null; }
  const expected = crypto.createHmac('sha256', SECRET).update(dataStr).digest('hex');
  if (expected !== sig) return null;
  let obj;
  try { obj = JSON.parse(dataStr); } catch { return null; }
  return obj;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(pair => {
    const [k, v] = pair.trim().split('=');
    if (k) out[k] = decodeURIComponent(v || '');
  });
  return out;
}

function setAuthCookie(res, token) {
  const cookie = `auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
  res.setHeader('Set-Cookie', cookie);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', 'auth_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'email and password required' });
    const users = await userStore.getAllUsers();
    const u = users.find(x => x.email === String(email).toLowerCase() && x.status === 'Active');
    if (!u || !u.passwordHash || !userStore.verifyPassword(password, u.passwordHash)) {
      return res.status(401).json({ success: false, error: 'invalid credentials' });
    }
    const payload = { uid: u.id, ts: Date.now() };
    const token = sign(payload);
    sessions.set(token, { uid: u.id, exp: Date.now() + TTL_MS });
    setAuthCookie(res, token);
    const safe = { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
    try { await recordAudit(req, { action: 'AUTH_LOGIN', entityType: 'Auth', entityId: u.id, details: { email } }); } catch {}
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, error: 'login failed', details: err.message });
  }
}

async function signup(req, res) {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'name, email and password required' });
    if (!userStore.isPasswordStrong(password)) return res.status(400).json({ success: false, error: 'password must be at least 8 characters and include uppercase, lowercase, number, and symbol' });
    const emailLower = String(email).toLowerCase();
    const existing = await userStore.getAllUsers();
    if (existing.find(u => u.email === emailLower)) return res.status(409).json({ success: false, error: 'email already registered' });
    const user = await userStore.createUser({ name: String(name), email: emailLower, role: 'User', status: 'Active', password: String(password) });
    const payload = { uid: user.id, ts: Date.now() };
    const token = sign(payload);
    sessions.set(token, { uid: user.id, exp: Date.now() + TTL_MS });
    setAuthCookie(res, token);
    const safe = { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, error: 'signup failed', details: err.message });
  }
}

async function me(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.auth_token;
    const payload = verify(token);
    const sess = sessions.get(token);
    if (!payload || !sess || sess.exp < Date.now()) {
      return res.status(401).json({ success: false, error: 'not authenticated' });
    }
    const user = await userStore.getUser(sess.uid);
    if (!user) return res.status(401).json({ success: false, error: 'not authenticated' });
    const safe = { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
    res.json({ success: true, user: safe });
  } catch (err) {
    res.status(500).json({ success: false, error: 'me failed', details: err.message });
  }
}

function logout(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.auth_token;
  if (token) sessions.delete(token);
  clearAuthCookie(res);
  try { recordAudit(req, { action: 'AUTH_LOGOUT', entityType: 'Auth', entityId: null }); } catch {}
  res.json({ success: true });
}

async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.auth_token;
    const payload = verify(token);
    const sess = sessions.get(token);
    if (!payload || !sess || sess.exp < Date.now()) {
      return res.status(401).json({ success: false, error: 'not authenticated' });
    }
    let user = null;
    try {
      user = await userStore.getUser(sess.uid);
    } catch (err) {
      console.warn('[Auth] getUser failed:', err?.message || err);
      return res.status(401).json({ success: false, error: 'not authenticated' });
    }
    if (!user) return res.status(401).json({ success: false, error: 'not authenticated' });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: 'auth check failed', details: err.message });
  }
}

function requireAdmin(req, res, next) {
  const u = req.user;
  if (!u || u.role !== 'Admin') return res.status(403).json({ success: false, error: 'forbidden' });
  next();
}

module.exports = { login, logout, me, signup, requireAuth, requireAdmin };
async function recordAudit(req, { action, entityType, entityId, details }) {
  try {
    const userId = entityType === 'Auth' ? (entityId || null) : (req?.user?.id || null);
    const ipHeader = req.headers['x-forwarded-for'];
    const ipFromHeader = Array.isArray(ipHeader) ? ipHeader[0] : String(ipHeader || '').split(',')[0].trim();
    const rawIp = ipFromHeader || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
    const ip = rawIp && String(rawIp).startsWith('::ffff:') ? String(rawIp).slice(7) : (rawIp === '::1' ? '127.0.0.1' : rawIp);
    const chain = [];
    const ffList = String(ipHeader || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ffList.length) chain.push(...ffList);
    const xReal = req.headers['x-real-ip'];
    if (xReal && !chain.includes(String(xReal))) chain.push(String(xReal));
    if (rawIp && !chain.includes(String(rawIp))) chain.push(String(rawIp));
    const ua = req.headers['user-agent'] || null;
    const q = `INSERT INTO [dbo].[AuditTrail] (Id, UserId, Action, EntityType, EntityId, OldValues, NewValues, IpAddress, UserAgent, Details, CreatedAt)
               VALUES (NEWID(), @userId, @action, @entityType, @entityId, NULL, NULL, @ipAddress, @userAgent, @details, SYSUTCDATETIME())`;
    const finalDetails = (() => {
      if (!details) return JSON.stringify({ forwardedFor: chain });
      if (typeof details === 'string') return details;
      try { return JSON.stringify({ ...details, forwardedFor: chain }); } catch { return JSON.stringify(details); }
    })();
    await database.query(q, { userId, action, entityType, entityId, ipAddress: ip, userAgent: ua ? String(ua).slice(0, 500) : null, details: finalDetails });
  } catch (err) {
    console.warn('[AuditTrail] auth record failed:', err?.message || err);
  }
}
