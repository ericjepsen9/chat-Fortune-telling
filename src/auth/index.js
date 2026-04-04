/**
 * 缘合 Auth Module — 手机号+验证码+JWT
 *
 * 开发阶段: 内存存储 + 文件持久化 (data/users.json)
 * 生产阶段: 替换为 PostgreSQL
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// JWT secret — 生产环境应从 .env 读取
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES = '30d'; // 30天有效

// SMS provider config
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock'; // 'mock' | 'aliyun'
const DEV_MODE = process.env.NODE_ENV !== 'production'; // 测试阶段跳过验证码校验

// 验证码存储 { phone: { code, expires, attempts } }
const codeSt = {};
const CODE_TTL = 5 * 60 * 1000;  // 5分钟有效
const CODE_COOLDOWN = 60 * 1000;  // 60秒冷却
const MAX_ATTEMPTS = 5;            // 最多验证5次

// 用户存储 (开发阶段: 内存+文件)
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
let users = {}; // { id: { id, phone, profile, createdAt, lastActiveAt } }

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) { console.error('Failed to load users:', e.message); }
}

function saveUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) { console.error('Failed to save users:', e.message); }
}

loadUsers();

// ============ SMS ============

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6位数字
}

async function sendSMS(phone, code) {
  if (SMS_PROVIDER === 'mock') {
    console.log(`📱 [SMS Mock] → ${phone}: 验证码 ${code} (5分钟内有效)`);
    return true;
  }
  // TODO: 接入阿里云SMS / 腾讯云SMS
  // const China aliyun = require('./sms-aliyun');
  // return aliyun.send(phone, code);
  throw new Error('SMS provider not configured');
}

function validatePhone(phone) {
  // 中国大陆手机号: 1开头11位
  return /^1[3-9]\d{9}$/.test(phone);
}

// ============ Core Functions ============

async function sendCode(phone) {
  if (!validatePhone(phone)) {
    return { error: '请输入正确的手机号', code: 400 };
  }

  // 开发模式: 不发送验证码，直接返回成功
  if (DEV_MODE) {
    console.log(`📱 [DEV] 跳过发送验证码 → ${phone} (输入任意6位数字即可登录)`);
    return { success: true, message: '测试模式：输入任意6位数字' };
  }

  // 冷却检查
  const existing = codeSt[phone];
  if (existing && Date.now() - existing.sentAt < CODE_COOLDOWN) {
    const wait = Math.ceil((CODE_COOLDOWN - (Date.now() - existing.sentAt)) / 1000);
    return { error: `请${wait}秒后再试`, code: 429 };
  }

  const code = generateCode();
  codeSt[phone] = { code, expires: Date.now() + CODE_TTL, attempts: 0, sentAt: Date.now() };

  try {
    await sendSMS(phone, code);
    return { success: true, message: '验证码已发送' };
  } catch (e) {
    delete codeSt[phone];
    return { error: '发送失败，请稍后重试', code: 500 };
  }
}

function verifyCode(phone, code) {
  if (!validatePhone(phone)) {
    return { error: '请输入正确的手机号', code: 400 };
  }
  if (!code || code.length !== 6) {
    return { error: '请输入6位验证码', code: 400 };
  }

  // 开发模式: 任意6位验证码直接通过
  if (DEV_MODE) {
    console.log(`🔓 [DEV] 跳过验证码校验 → ${phone}`);
    // 直接走下面的用户查找/创建逻辑
    let user = Object.values(users).find(u => u.phone === phone);
    const isNew = !user;
    if (isNew) {
      user = { id: crypto.randomUUID(), phone, profile: null, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() };
      users[user.id] = user; saveUsers();
    } else { user.lastActiveAt = new Date().toISOString(); saveUsers(); }
    const token = jwt.sign({ uid: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return { success: true, token, isNew, user: { id: user.id, phone: user.phone, profile: user.profile } };
  }

  const entry = codeSt[phone];
  if (!entry) {
    return { error: '请先获取验证码', code: 400 };
  }
  if (Date.now() > entry.expires) {
    delete codeSt[phone];
    return { error: '验证码已过期，请重新获取', code: 400 };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    delete codeSt[phone];
    return { error: '验证次数过多，请重新获取', code: 429 };
  }

  entry.attempts++;

  if (entry.code !== code) {
    return { error: `验证码错误，还剩${MAX_ATTEMPTS - entry.attempts}次机会`, code: 400 };
  }

  // 验证成功 — 清除验证码
  delete codeSt[phone];

  // 查找或创建用户
  let user = Object.values(users).find(u => u.phone === phone);
  const isNew = !user;

  if (isNew) {
    user = {
      id: crypto.randomUUID(),
      phone,
      profile: null, // 新用户还没填生辰
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    users[user.id] = user;
    saveUsers();
  } else {
    user.lastActiveAt = new Date().toISOString();
    saveUsers();
  }

  // 签发 JWT
  const token = jwt.sign(
    { uid: user.id, phone: user.phone },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return {
    success: true,
    token,
    isNew,
    user: { id: user.id, phone: user.phone, profile: user.profile },
  };
}

// ============ JWT Middleware ============

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const user = users[decoded.uid];
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token已过期，请重新登录' });
  }
}

// Optional auth — doesn't block, just attaches user if token present
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      req.user = users[decoded.uid];
    } catch (e) { /* ignore */ }
  }
  next();
}

// ============ Profile Operations ============

function getProfile(userId) {
  const user = users[userId];
  if (!user) return null;
  return { id: user.id, phone: user.phone, profile: user.profile };
}

function updateProfile(userId, profileData) {
  const user = users[userId];
  if (!user) return null;
  user.profile = { ...user.profile, ...profileData };
  user.lastActiveAt = new Date().toISOString();
  saveUsers();
  return { id: user.id, phone: user.phone, profile: user.profile };
}

// Migrate localStorage data from frontend
function migrateLocalData(userId, localData) {
  const user = users[userId];
  if (!user) return null;
  if (localData.profile) {
    user.profile = localData.profile;
  }
  // Store other local data as-is for now
  if (localData.history) user.history = localData.history;
  if (localData.modeResults) user.modeResults = localData.modeResults;
  if (localData.posts) user.posts = localData.posts;
  if (localData.convs) user.convs = localData.convs;
  user.lastActiveAt = new Date().toISOString();
  saveUsers();
  return { success: true };
}

module.exports = {
  sendCode,
  verifyCode,
  authMiddleware,
  optionalAuth,
  getProfile,
  updateProfile,
  migrateLocalData,
};
