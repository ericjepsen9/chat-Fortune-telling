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

// ============ Divination History ============

function saveDivination(userId, data) {
  const user = users[userId];
  if (!user) return null;
  if (!user.divinations) user.divinations = [];
  const entry = {
    id: crypto.randomUUID(),
    mode: data.mode,
    question: (data.question || '').substring(0, 500),
    response: (data.response || '').substring(0, 10000),
    structured: data.structured || null,
    engineData: data.engineData ? String(data.engineData).substring(0, 5000) : null,
    depth: data.depth || 'expert',
    createdAt: new Date().toISOString(),
  };
  user.divinations.unshift(entry);
  // 最多保留100条
  if (user.divinations.length > 100) user.divinations.length = 100;
  saveUsers();
  return { id: entry.id, createdAt: entry.createdAt };
}

function getDivinations(userId, mode) {
  const user = users[userId];
  if (!user || !user.divinations) return [];
  let list = user.divinations;
  if (mode) list = list.filter(d => d.mode === mode);
  // 返回摘要列表(不含完整response)
  return list.map(d => ({
    id: d.id, mode: d.mode, question: d.question,
    depth: d.depth, createdAt: d.createdAt,
    preview: (d.response || '').substring(0, 100),
  }));
}

// ============ Messages ============

// 消息存储: conversations are keyed by sorted pair of user IDs
function convKey(a, b) { return [a, b].sort().join(':'); }

function saveMessage(fromId, toId, message) {
  const key = convKey(fromId, toId);
  // 存在全局消息存储（而非单个用户下），避免重复
  if (!global._yuanheMessages) global._yuanheMessages = {};
  if (!global._yuanheMessages[key]) global._yuanheMessages[key] = [];
  global._yuanheMessages[key].push(message);
  // 限制每个会话最多500条
  if (global._yuanheMessages[key].length > 500) {
    global._yuanheMessages[key] = global._yuanheMessages[key].slice(-500);
  }
  // 持久化
  try {
    const msgFile = path.join(DATA_DIR, 'messages.json');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(msgFile, JSON.stringify(global._yuanheMessages, null, 2));
  } catch (e) { console.error('Failed to save messages:', e.message); }
}

function getMessages(userIdA, userIdB, limit = 50, before) {
  if (!global._yuanheMessages) {
    // 尝试从文件加载
    try {
      const msgFile = path.join(DATA_DIR, 'messages.json');
      if (fs.existsSync(msgFile)) {
        global._yuanheMessages = JSON.parse(fs.readFileSync(msgFile, 'utf-8'));
      } else {
        global._yuanheMessages = {};
      }
    } catch (e) { global._yuanheMessages = {}; }
  }
  const key = convKey(userIdA, userIdB);
  let msgs = global._yuanheMessages[key] || [];
  if (before) {
    const idx = msgs.findIndex(m => m.id === before);
    if (idx > 0) msgs = msgs.slice(0, idx);
  }
  return msgs.slice(-limit);
}

// ============ Matching ============

// 滑动记录: { `${userId}:${targetId}`: 'left'|'right' }
const SWIPES_FILE = path.join(DATA_DIR, 'swipes.json');
let swipes = {};
try { if (fs.existsSync(SWIPES_FILE)) swipes = JSON.parse(fs.readFileSync(SWIPES_FILE, 'utf-8')); } catch (e) {}
function saveSwipes() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SWIPES_FILE, JSON.stringify(swipes));
  } catch (e) {}
}

// 获取候选用户(排除已滑动、黑名单、自己)
function getCandidates(userId, genderPref, limit = 20) {
  const me = users[userId];
  if (!me) return [];

  const result = Object.values(users).filter(u => {
    if (u.id === userId) return false;           // 排除自己
    if (!u.profile || !u.profile.year) return false; // 未完成注册
    if (genderPref && genderPref !== 'all' && u.profile.gender !== genderPref) return false;
    if (swipes[`${userId}:${u.id}`]) return false; // 已滑动过
    return true;
  }).slice(0, limit).map(u => ({
    id: u.id,
    realUserId: u.id,
    name: u.profile.name || '缘友',
    age: u.profile.birth_year ? (new Date().getFullYear() - u.profile.birth_year) : null,
    bio: u.profile.bio || '',
    gender: u.profile.gender,
    city: u.profile.city || '',
    avatar: u.profile.avatar || (u.profile.gender === 'female' ? '👩' : '👨'),
    sign: '', // 可由前端计算
    tags: [],
    year: u.profile.year || u.profile.birth_year,
    month: u.profile.month || u.profile.birth_month,
    day: u.profile.day || u.profile.birth_day,
    hour: u.profile.hour || u.profile.birth_hour || -1,
    isBot: false,
    likedMe: swipes[`${u.id}:${userId}`] === 'right', // 对方已喜欢我
  }));
  // 优先显示喜欢我的人
  result.sort((a, b) => (b.likedMe ? 1 : 0) - (a.likedMe ? 1 : 0));
  return result;
}

// 记录滑动
function recordSwipe(userId, targetId, direction) {
  swipes[`${userId}:${targetId}`] = direction;
  saveSwipes();

  // 检测双向匹配
  if (direction === 'right' && swipes[`${targetId}:${userId}`] === 'right') {
    return { matched: true, targetId };
  }
  return { matched: false };
}

// 获取匹配列表(双方都right)
function getMatches(userId) {
  const matches = [];
  for (const [key, dir] of Object.entries(swipes)) {
    if (dir !== 'right') continue;
    const [from, to] = key.split(':');
    if (from !== userId) continue;
    // 检查对方也right了
    if (swipes[`${to}:${from}`] === 'right') {
      const u = users[to];
      if (u && u.profile) matches.push({ userId: to, name: u.profile.name, avatar: u.profile.avatar, gender: u.profile.gender });
    }
  }
  return matches;
}

// ============ Friend Requests ============

const FRIENDS_FILE = path.join(DATA_DIR, 'friends.json');
let friendData = { requests: [], accepted: [] };
// requests: [{ id, from, to, message, status:'pending'|'accepted'|'rejected', createdAt }]
// accepted: [{ userA, userB, createdAt }]
try { if (fs.existsSync(FRIENDS_FILE)) friendData = JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf-8')); } catch (e) {}
function saveFriends() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FRIENDS_FILE, JSON.stringify(friendData, null, 2));
  } catch (e) {}
}

function sendFriendRequest(fromId, toId, message) {
  if (fromId === toId) return { error: '不能添加自己' };
  // 已经是好友?
  const pair = [fromId, toId].sort();
  if (friendData.accepted.find(a => a.userA === pair[0] && a.userB === pair[1])) {
    return { error: '已经是好友了' };
  }
  // 已有pending请求?
  const existing = friendData.requests.find(r => r.from === fromId && r.to === toId && r.status === 'pending');
  if (existing) return { error: '已发送过请求', id: existing.id };

  const req = {
    id: crypto.randomUUID(),
    from: fromId,
    to: toId,
    message: (message || '').substring(0, 200),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  friendData.requests.push(req);
  saveFriends();

  // 附加发送者信息
  const fromUser = users[fromId];
  return { success: true, request: { ...req, fromName: fromUser?.profile?.name, fromAvatar: fromUser?.profile?.avatar } };
}

function respondFriendRequest(requestId, userId, accept) {
  const req = friendData.requests.find(r => r.id === requestId && r.to === userId && r.status === 'pending');
  if (!req) return { error: '请求不存在或已处理' };

  req.status = accept ? 'accepted' : 'rejected';
  if (accept) {
    const pair = [req.from, req.to].sort();
    friendData.accepted.push({ userA: pair[0], userB: pair[1], createdAt: new Date().toISOString() });
  }
  saveFriends();
  return { success: true, status: req.status, from: req.from, to: req.to };
}

function getPendingRequests(userId) {
  return friendData.requests
    .filter(r => r.to === userId && r.status === 'pending')
    .map(r => {
      const u = users[r.from];
      return { ...r, fromName: u?.profile?.name || '缘友', fromAvatar: u?.profile?.avatar || '👤', fromGender: u?.profile?.gender };
    });
}

function getFriends(userId) {
  return friendData.accepted
    .filter(a => a.userA === userId || a.userB === userId)
    .map(a => {
      const friendId = a.userA === userId ? a.userB : a.userA;
      const u = users[friendId];
      return { userId: friendId, name: u?.profile?.name || '缘友', avatar: u?.profile?.avatar, gender: u?.profile?.gender, since: a.createdAt };
    });
}

function areFriends(userA, userB) {
  const pair = [userA, userB].sort();
  return !!friendData.accepted.find(a => a.userA === pair[0] && a.userB === pair[1]);
}

module.exports = {
  JWT_SECRET,
  sendCode,
  verifyCode,
  authMiddleware,
  optionalAuth,
  getProfile,
  updateProfile,
  migrateLocalData,
  saveDivination,
  getDivinations,
  saveMessage,
  getMessages,
  createPost,
  getPosts,
  likePost,
  addComment,
  getComments,
  getCandidates,
  recordSwipe,
  getMatches,
  sendFriendRequest,
  respondFriendRequest,
  getPendingRequests,
  getFriends,
  areFriends,
  // Admin user management
  adminListUsers,
  adminGetUser,
  adminUpdateUser,
  adminBanUser,
  adminDeleteUser,
  adminGetStats,
  // Admin chat management
  adminListConversations,
  adminGetConversation,
  adminDeleteMessage,
  // Sensitive words
  getSensitiveWords,
  setSensitiveWords,
  checkSensitive,
  // Admin content
  adminListPosts,
  adminDeletePost,
  adminPinPost,
  adminListReports,
  adminResolveReport,
  submitReport,
  // User data sync
  syncBlacklist,
  getBlacklist: getUserBlacklist,
  syncFavorites,
  getFavorites,
};

// ============ User Data Sync (黑名单/收藏) ============

function syncBlacklist(userId, blacklist) {
  const user = users[userId];
  if (!user) return { error: '用户不存在' };
  user.blacklist = blacklist || [];
  saveUsers();
  return { success: true };
}

function getUserBlacklist(userId) {
  const user = users[userId];
  return user?.blacklist || [];
}

function syncFavorites(userId, favorites) {
  const user = users[userId];
  if (!user) return { error: '用户不存在' };
  user.favorites = favorites || {};
  saveUsers();
  return { success: true };
}

function getFavorites(userId) {
  const user = users[userId];
  return user?.favorites || {};
}

// ============ Sensitive Words ============

const SENSITIVE_FILE = path.join(DATA_DIR, 'sensitive-words.json');
let sensitiveWords = [];
try { if (fs.existsSync(SENSITIVE_FILE)) sensitiveWords = JSON.parse(fs.readFileSync(SENSITIVE_FILE, 'utf-8')); } catch (e) {}

function getSensitiveWords() { return sensitiveWords; }
function setSensitiveWords(words) {
  sensitiveWords = words.filter(w => w.trim()).map(w => w.trim().toLowerCase());
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SENSITIVE_FILE, JSON.stringify(sensitiveWords, null, 2));
  } catch (e) {}
  return { success: true, count: sensitiveWords.length };
}
function checkSensitive(text) {
  if (!text || sensitiveWords.length === 0) return { hit: false };
  const lower = text.toLowerCase();
  const found = sensitiveWords.filter(w => lower.includes(w));
  return { hit: found.length > 0, words: found };
}

// ============ Admin: Chat Management ============

function _ensureMessagesLoaded() {
  if (!global._yuanheMessages) {
    try {
      const msgFile = path.join(DATA_DIR, 'messages.json');
      if (fs.existsSync(msgFile)) global._yuanheMessages = JSON.parse(fs.readFileSync(msgFile, 'utf-8'));
      else global._yuanheMessages = {};
    } catch (e) { global._yuanheMessages = {}; }
  }
}

function adminListConversations({ search, page = 1, limit = 20 } = {}) {
  _ensureMessagesLoaded();
  let convs = Object.entries(global._yuanheMessages).map(([key, msgs]) => {
    const [a, b] = key.split(':');
    const userA = users[a]; const userB = users[b];
    const lastMsg = msgs[msgs.length - 1];
    return {
      key, userA: a, userB: b,
      nameA: userA?.profile?.name || userA?.phone || a.substring(0, 8),
      nameB: userB?.profile?.name || userB?.phone || b.substring(0, 8),
      messageCount: msgs.length,
      lastMessage: lastMsg?.text?.substring(0, 50) || '',
      lastTime: lastMsg?.createdAt || '',
    };
  });
  // 按最后消息时间倒序
  convs.sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''));
  if (search) {
    const s = search.toLowerCase();
    convs = convs.filter(c => c.nameA.toLowerCase().includes(s) || c.nameB.toLowerCase().includes(s) || c.key.includes(s));
  }
  const total = convs.length;
  return { total, page, limit, items: convs.slice((page - 1) * limit, page * limit) };
}

function adminGetConversation(convKey, limit = 100) {
  _ensureMessagesLoaded();
  const msgs = global._yuanheMessages[convKey] || [];
  const [a, b] = convKey.split(':');
  return {
    key: convKey,
    nameA: users[a]?.profile?.name || a.substring(0, 8),
    nameB: users[b]?.profile?.name || b.substring(0, 8),
    messages: msgs.slice(-limit).map(m => ({
      ...m,
      fromName: users[m.from]?.profile?.name || m.from?.substring(0, 8) || '?',
    })),
  };
}

function adminDeleteMessage(convKey, messageId) {
  _ensureMessagesLoaded();
  const msgs = global._yuanheMessages[convKey];
  if (!msgs) return { error: '会话不存在' };
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return { error: '消息不存在' };
  msgs.splice(idx, 1);
  try {
    const msgFile = path.join(DATA_DIR, 'messages.json');
    fs.writeFileSync(msgFile, JSON.stringify(global._yuanheMessages, null, 2));
  } catch (e) {}
  return { success: true };
}

// ============ Admin: User Management ============

function adminListUsers({ search, gender, page = 1, limit = 20 } = {}) {
  let list = Object.values(users);

  // 搜索 (手机号/昵称/ID)
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(u =>
      u.phone?.includes(s) ||
      u.id?.includes(s) ||
      u.profile?.name?.toLowerCase().includes(s)
    );
  }
  // 性别筛选
  if (gender && gender !== 'all') {
    list = list.filter(u => u.profile?.gender === gender);
  }

  // 按注册时间倒序
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = list.length;
  const start = (page - 1) * limit;
  const items = list.slice(start, start + limit).map(u => ({
    id: u.id,
    phone: u.phone,
    name: u.profile?.name || '—',
    gender: u.profile?.gender || '—',
    city: u.profile?.city || '—',
    avatar: u.profile?.avatar || '',
    year: u.profile?.year,
    banned: u.banned || false,
    banReason: u.banReason || '',
    banUntil: u.banUntil || null,
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
    divinationCount: u.divinations?.length || 0,
  }));

  return { total, page, limit, items };
}

function adminGetUser(userId) {
  const u = users[userId];
  if (!u) return null;
  return {
    id: u.id,
    phone: u.phone,
    profile: u.profile,
    banned: u.banned || false,
    banReason: u.banReason || '',
    banUntil: u.banUntil || null,
    deleted: u.deleted || false,
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
    divinationCount: u.divinations?.length || 0,
    divinations: (u.divinations || []).slice(0, 10).map(d => ({
      id: d.id, mode: d.mode, question: d.question,
      createdAt: d.createdAt, preview: (d.response || '').substring(0, 80),
    })),
    postCount: (posts || []).filter(p => p.authorId === userId).length,
  };
}

function adminUpdateUser(userId, data) {
  const u = users[userId];
  if (!u) return { error: '用户不存在' };
  if (data.name !== undefined) { if (!u.profile) u.profile = {}; u.profile.name = data.name; }
  if (data.bio !== undefined) { if (!u.profile) u.profile = {}; u.profile.bio = data.bio; }
  if (data.city !== undefined) { if (!u.profile) u.profile = {}; u.profile.city = data.city; }
  saveUsers();
  return { success: true };
}

function adminBanUser(userId, { ban, reason, days }) {
  const u = users[userId];
  if (!u) return { error: '用户不存在' };
  if (ban) {
    u.banned = true;
    u.banReason = reason || '违规';
    u.banUntil = days ? new Date(Date.now() + days * 86400000).toISOString() : null; // null=永久
  } else {
    u.banned = false;
    u.banReason = '';
    u.banUntil = null;
  }
  saveUsers();
  return { success: true, banned: u.banned };
}

function adminDeleteUser(userId) {
  const u = users[userId];
  if (!u) return { error: '用户不存在' };
  u.deleted = true;
  u.banned = true;
  u.banReason = '账号已删除';
  saveUsers();
  return { success: true };
}

function adminGetStats() {
  const allUsers = Object.values(users);
  const now = Date.now();
  const today = new Date().toDateString();
  return {
    totalUsers: allUsers.length,
    activeToday: allUsers.filter(u => u.lastActiveAt && new Date(u.lastActiveAt).toDateString() === today).length,
    newToday: allUsers.filter(u => new Date(u.createdAt).toDateString() === today).length,
    banned: allUsers.filter(u => u.banned).length,
    withProfile: allUsers.filter(u => u.profile?.year).length,
    totalDivinations: allUsers.reduce((s, u) => s + (u.divinations?.length || 0), 0),
    totalPosts: (posts || []).length,
    genderSplit: {
      male: allUsers.filter(u => u.profile?.gender === 'male').length,
      female: allUsers.filter(u => u.profile?.gender === 'female').length,
    },
  };
}

// ============ Posts (缘友圈) ============

// 帖子存储
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
let posts = [];
try { if (fs.existsSync(POSTS_FILE)) posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8')); } catch (e) {}
function savePosts() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
  } catch (e) {}
}

function createPost(userId, content, tag) {
  const user = users[userId];
  if (!user) return null;
  const post = {
    id: crypto.randomUUID(),
    authorId: userId,
    author: user.profile?.name || '缘友',
    avatar: user.profile?.avatar || (user.profile?.gender === 'female' ? '👩' : '👨'),
    content,
    tag: tag || '',
    likes: 0,
    likedBy: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
  posts.unshift(post);
  if (posts.length > 500) posts.length = 500;
  savePosts();
  return post;
}

function getPosts(limit, beforeId) {
  let list = posts;
  if (beforeId) {
    const idx = list.findIndex(p => p.id === beforeId);
    if (idx >= 0) list = list.slice(idx + 1);
  }
  return list.slice(0, limit).map(p => ({
    ...p,
    likedBy: undefined, // 不暴露点赞用户列表
    likeCount: p.likedBy?.length || p.likes || 0,
    commentCount: p.comments?.length || 0,
  }));
}

function likePost(userId, postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return { error: '帖子不存在' };
  if (!post.likedBy) post.likedBy = [];
  const idx = post.likedBy.indexOf(userId);
  if (idx >= 0) {
    post.likedBy.splice(idx, 1); // 取消点赞
    post.likes = post.likedBy.length;
    savePosts();
    return { liked: false, likes: post.likes };
  }
  post.likedBy.push(userId);
  post.likes = post.likedBy.length;
  savePosts();
  return { liked: true, likes: post.likes };
}

function addComment(userId, postId, text) {
  const post = posts.find(p => p.id === postId);
  if (!post) return { error: '帖子不存在' };
  const user = users[userId];
  const comment = {
    id: crypto.randomUUID(),
    authorId: userId,
    name: user?.profile?.name || '缘友',
    text,
    createdAt: new Date().toISOString(),
  };
  if (!post.comments) post.comments = [];
  post.comments.push(comment);
  savePosts();
  return comment;
}

function getComments(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return [];
  return post.comments || [];
}

// ============ Admin: Content Management ============

function adminListPosts({ search, page = 1, limit = 20 } = {}) {
  let list = posts;
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(p => p.content?.toLowerCase().includes(s) || p.author?.toLowerCase().includes(s));
  }
  const total = list.length;
  return {
    total, page, limit,
    items: list.slice((page - 1) * limit, page * limit).map(p => ({
      ...p, likedBy: undefined,
      likeCount: p.likedBy?.length || p.likes || 0,
      commentCount: p.comments?.length || 0,
    })),
  };
}

function adminDeletePost(postId) {
  const idx = posts.findIndex(p => p.id === postId);
  if (idx < 0) return { error: '帖子不存在' };
  posts[idx].deleted_at = new Date().toISOString();
  posts.splice(idx, 1);
  savePosts();
  return { success: true };
}

function adminPinPost(postId, pinned) {
  const post = posts.find(p => p.id === postId);
  if (!post) return { error: '帖子不存在' };
  post.pinned = pinned;
  if (pinned) { posts.splice(posts.indexOf(post), 1); posts.unshift(post); }
  savePosts();
  return { success: true };
}

// ============ Reports (举报) ============

const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
let reports = [];
try { if (fs.existsSync(REPORTS_FILE)) reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8')); } catch (e) {}
function saveReports() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2));
  } catch (e) {}
}

function submitReport(reporterId, { targetType, targetId, reason }) {
  const report = {
    id: crypto.randomUUID(),
    reporterId,
    reporterName: users[reporterId]?.profile?.name || '匿名',
    targetType, // 'user','post','message'
    targetId,
    reason: (reason || '').substring(0, 500),
    status: 'pending', // pending/resolved/dismissed
    resolution: '',
    createdAt: new Date().toISOString(),
  };
  reports.unshift(report);
  saveReports();
  return { success: true, id: report.id };
}

function adminListReports({ status, page = 1, limit = 20 } = {}) {
  let list = reports;
  if (status && status !== 'all') list = list.filter(r => r.status === status);
  const total = list.length;
  return { total, page, limit, items: list.slice((page - 1) * limit, page * limit) };
}

function adminResolveReport(reportId, { status, resolution }) {
  const report = reports.find(r => r.id === reportId);
  if (!report) return { error: '举报不存在' };
  report.status = status; // 'resolved' or 'dismissed'
  report.resolution = resolution || '';
  report.resolvedAt = new Date().toISOString();
  saveReports();
  return { success: true };
}
