/**
 * 缘合 Admin Module — 管理员账号+权限
 *
 * 独立于用户体系，账号密码登录
 * 角色: superadmin / operator / support
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const ADMIN_LOG_FILE = path.join(DATA_DIR, 'admin-logs.json');

// 使用与用户auth相同的JWT_SECRET
let JWT_SECRET;
function setSecret(secret) { JWT_SECRET = secret; }

const ADMIN_JWT_EXPIRES = '8h'; // 管理员token 8小时有效

// ============ 数据存储 ============

let admins = [];
// { id, username, passwordHash, role, name, mustChangePassword, createdAt, lastLoginAt }

function loadAdmins() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      admins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf-8'));
    }
  } catch (e) {}
  // 首次启动: 自动创建默认管理员
  if (admins.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    admins.push({
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: hash,
      role: 'superadmin',
      name: '超级管理员',
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });
    saveAdmins();
    console.log('🔐 [Admin] 默认管理员已创建: admin / admin123');
  }
}

function saveAdmins() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
  } catch (e) {}
}

loadAdmins();

// ============ 操作日志 ============

let adminLogs = [];
try { if (fs.existsSync(ADMIN_LOG_FILE)) adminLogs = JSON.parse(fs.readFileSync(ADMIN_LOG_FILE, 'utf-8')); } catch (e) {}

function logAction(adminId, action, target, detail) {
  const admin = admins.find(a => a.id === adminId);
  const entry = {
    id: crypto.randomUUID(),
    adminId,
    adminName: admin?.name || admin?.username || 'unknown',
    action,        // 'login','change_password','ban_user','delete_post' 等
    target,        // 操作对象ID
    detail,        // 描述文字
    createdAt: new Date().toISOString(),
  };
  adminLogs.unshift(entry);
  if (adminLogs.length > 1000) adminLogs.length = 1000;
  try {
    fs.writeFileSync(ADMIN_LOG_FILE, JSON.stringify(adminLogs, null, 2));
  } catch (e) {}
  return entry;
}

function getAdminLogs(limit = 50, { action, adminId, search, page = 1 } = {}) {
  let filtered = [...adminLogs];
  if (action) filtered = filtered.filter(l => l.action === action);
  if (adminId) filtered = filtered.filter(l => l.adminId === adminId);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(l =>
      l.detail?.toLowerCase().includes(s) ||
      l.adminName?.toLowerCase().includes(s) ||
      l.action?.toLowerCase().includes(s) ||
      l.target?.toLowerCase().includes(s)
    );
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  return { items: filtered.slice(start, start + limit), total, page, limit };
}

function getLogActionTypes() {
  const types = new Set();
  adminLogs.forEach(l => types.add(l.action));
  return [...types].sort();
}

// ============ 登录 ============

function login(username, password) {
  const admin = admins.find(a => a.username === username);
  if (!admin) return { error: '账号不存在' };

  if (!bcrypt.compareSync(password, admin.passwordHash)) {
    return { error: '密码错误' };
  }

  admin.lastLoginAt = new Date().toISOString();
  saveAdmins();

  const token = jwt.sign(
    { aid: admin.id, role: admin.role, type: 'admin' },
    JWT_SECRET,
    { expiresIn: ADMIN_JWT_EXPIRES }
  );

  logAction(admin.id, 'login', null, '管理员登录');

  return {
    success: true,
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      mustChangePassword: admin.mustChangePassword,
    },
  };
}

// ============ 改密码 ============

function changePassword(adminId, oldPassword, newPassword) {
  const admin = admins.find(a => a.id === adminId);
  if (!admin) return { error: '管理员不存在' };

  // 首次强制改密码时不验证旧密码
  if (!admin.mustChangePassword) {
    if (!bcrypt.compareSync(oldPassword, admin.passwordHash)) {
      return { error: '旧密码错误' };
    }
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: '新密码至少6位' };
  }

  admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  admin.mustChangePassword = false;
  saveAdmins();

  logAction(adminId, 'change_password', adminId, '修改密码');
  return { success: true };
}

// ============ 中间件 ============

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    if (decoded.type !== 'admin') {
      return res.status(403).json({ error: '非管理员权限' });
    }
    const admin = admins.find(a => a.id === decoded.aid);
    if (!admin) {
      return res.status(401).json({ error: '管理员不存在' });
    }
    req.admin = admin;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token已过期，请重新登录' });
  }
}

// 角色限制: superadmin only
function superOnly(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ error: '仅超级管理员可操作' });
  }
  next();
}

// ============ 管理员CRUD (superadmin only) ============

function createAdmin(creatorId, { username, password, role, name }) {
  if (admins.find(a => a.username === username)) {
    return { error: '用户名已存在' };
  }
  if (!['superadmin', 'operator', 'support'].includes(role)) {
    return { error: '无效角色' };
  }
  const admin = {
    id: crypto.randomUUID(),
    username,
    passwordHash: bcrypt.hashSync(password || 'changeme', 10),
    role,
    name: name || username,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  admins.push(admin);
  saveAdmins();
  logAction(creatorId, 'create_admin', admin.id, `创建管理员: ${username} (${role})`);
  return { success: true, admin: { id: admin.id, username, role, name: admin.name } };
}

function listAdmins() {
  return admins.map(a => ({
    id: a.id, username: a.username, name: a.name, role: a.role,
    lastLoginAt: a.lastLoginAt, createdAt: a.createdAt,
  }));
}

module.exports = {
  setSecret,
  login,
  changePassword,
  adminAuth,
  superOnly,
  createAdmin,
  listAdmins,
  logAction,
  getAdminLogs,
  getLogActionTypes,
};
