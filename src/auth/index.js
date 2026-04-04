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
};

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
