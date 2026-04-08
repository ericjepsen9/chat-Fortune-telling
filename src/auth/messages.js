/**
 * 缘合 Messages Module — 消息收发 + 管理员会话管理
 * 从 auth/index.js 拆分，通过 init() 注入共享依赖
 */

const fs = require('fs');
const path = require('path');

let DATA_DIR, debouncedWrite, users;

function init(deps) {
  DATA_DIR = deps.DATA_DIR;
  debouncedWrite = deps.debouncedWrite;
  users = deps.users;
}

// 消息存储: conversations are keyed by sorted pair of user IDs
function convKey(a, b) { return [a, b].sort().join(':'); }

function saveMessage(fromId, toId, message) {
  const key = convKey(fromId, toId);
  if (!global._yuanheMessages) global._yuanheMessages = {};
  if (!global._yuanheMessages[key]) global._yuanheMessages[key] = [];
  global._yuanheMessages[key].push(message);
  if (global._yuanheMessages[key].length > 500) {
    global._yuanheMessages[key] = global._yuanheMessages[key].slice(-500);
  }
  const MAX_CONVS = 10000;
  const keys = Object.keys(global._yuanheMessages);
  if (keys.length > MAX_CONVS) {
    const sorted = keys.map(k => ({ k, last: global._yuanheMessages[k].length ? global._yuanheMessages[k][global._yuanheMessages[k].length - 1].ts || 0 : 0 })).sort((a, b) => a.last - b.last);
    for (let i = 0; i < keys.length - MAX_CONVS; i++) delete global._yuanheMessages[sorted[i].k];
  }
  const msgFile = path.join(DATA_DIR, 'messages.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  debouncedWrite(msgFile, () => JSON.stringify(global._yuanheMessages));
}

function getMessages(userIdA, userIdB, limit = 50, before) {
  _ensureMessagesLoaded();
  const key = convKey(userIdA, userIdB);
  let msgs = global._yuanheMessages[key] || [];
  if (before) {
    const idx = msgs.findIndex(m => m.id === before);
    if (idx > 0) msgs = msgs.slice(0, idx);
  }
  return msgs.slice(-limit);
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
  convs.sort((a, b) => (b.lastTime || '').localeCompare(a.lastTime || ''));
  if (search) {
    const s = search.toLowerCase();
    convs = convs.filter(c => c.nameA.toLowerCase().includes(s) || c.nameB.toLowerCase().includes(s) || c.key.includes(s));
  }
  const total = convs.length;
  return { total, page, limit, items: convs.slice((page - 1) * limit, page * limit) };
}

function adminGetConversation(key, limit = 100) {
  _ensureMessagesLoaded();
  const msgs = global._yuanheMessages[key] || [];
  const [a, b] = key.split(':');
  return {
    key,
    nameA: users[a]?.profile?.name || a.substring(0, 8),
    nameB: users[b]?.profile?.name || b.substring(0, 8),
    messages: msgs.slice(-limit).map(m => ({
      ...m,
      fromName: users[m.from]?.profile?.name || m.from?.substring(0, 8) || '?',
    })),
  };
}

function adminDeleteMessage(key, messageId) {
  _ensureMessagesLoaded();
  const msgs = global._yuanheMessages[key];
  if (!msgs) return { error: '会话不存在' };
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return { error: '消息不存在' };
  msgs.splice(idx, 1);
  const msgFile = path.join(DATA_DIR, 'messages.json');
  debouncedWrite(msgFile, () => JSON.stringify(global._yuanheMessages));
  return { success: true };
}

// 用于 admin 统计：获取用户消息数
function getUserMsgCount(userId) {
  if (!global._yuanheMessages) return 0;
  let count = 0;
  for (const [key, msgs] of Object.entries(global._yuanheMessages)) {
    if (key.includes(userId)) count += msgs.filter(m => m.from === userId).length;
  }
  return count;
}

module.exports = {
  init,
  saveMessage,
  getMessages,
  adminListConversations,
  adminGetConversation,
  adminDeleteMessage,
  getUserMsgCount,
};
