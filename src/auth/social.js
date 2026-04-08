/**
 * 缘合 Social Module — 滑动/好友/帖子/举报
 * 从 auth/index.js 拆分，通过 init() 注入共享依赖
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let DATA_DIR, debouncedWrite, atomicWriteSync, users, saveUsers;

// ============ Data Stores ============

const SWIPES_FILE_NAME = 'swipes.json';
const FRIENDS_FILE_NAME = 'friends.json';
const POSTS_FILE_NAME = 'posts.json';
const REPORTS_FILE_NAME = 'reports.json';

let swipes = {};
let friendData = { requests: [], accepted: [] };
let posts = [];
let reports = [];

function init(deps) {
  DATA_DIR = deps.DATA_DIR;
  debouncedWrite = deps.debouncedWrite;
  atomicWriteSync = deps.atomicWriteSync;
  users = deps.users;
  saveUsers = deps.saveUsers;

  // Load data
  const swipesFile = path.join(DATA_DIR, SWIPES_FILE_NAME);
  const friendsFile = path.join(DATA_DIR, FRIENDS_FILE_NAME);
  const postsFile = path.join(DATA_DIR, POSTS_FILE_NAME);
  const reportsFile = path.join(DATA_DIR, REPORTS_FILE_NAME);

  try { if (fs.existsSync(swipesFile)) swipes = JSON.parse(fs.readFileSync(swipesFile, 'utf-8')); } catch (e) {}
  try { if (fs.existsSync(friendsFile)) friendData = JSON.parse(fs.readFileSync(friendsFile, 'utf-8')); } catch (e) {}
  try { if (fs.existsSync(postsFile)) posts = JSON.parse(fs.readFileSync(postsFile, 'utf-8')); } catch (e) {}
  try { if (fs.existsSync(reportsFile)) reports = JSON.parse(fs.readFileSync(reportsFile, 'utf-8')); } catch (e) {}
}

// ============ Save Functions ============

function saveSwipes() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  debouncedWrite(path.join(DATA_DIR, SWIPES_FILE_NAME), () => JSON.stringify(swipes));
}
function saveFriends() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  debouncedWrite(path.join(DATA_DIR, FRIENDS_FILE_NAME), () => JSON.stringify(friendData));
}
function savePosts() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  debouncedWrite(path.join(DATA_DIR, POSTS_FILE_NAME), () => JSON.stringify(posts));
}
function saveReports() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  debouncedWrite(path.join(DATA_DIR, REPORTS_FILE_NAME), () => JSON.stringify(reports));
}

// ============ Swipes & Matching ============

function getCandidates(userId, genderPref, limit = 20) {
  const me = users[userId];
  if (!me) return [];
  return Object.values(users).filter(u => {
    if (u.id === userId) return false;
    if (!u.profile || !u.profile.year) return false;
    if (genderPref && genderPref !== 'all' && u.profile.gender !== genderPref) return false;
    if (swipes[`${userId}:${u.id}`]) return false;
    return true;
  }).slice(0, limit).map(u => ({
    id: u.id, realUserId: u.id,
    name: u.profile.name || '缘友',
    age: u.profile.birth_year ? (new Date().getFullYear() - u.profile.birth_year) : null,
    bio: u.profile.bio || '', gender: u.profile.gender,
    city: u.profile.city || '',
    avatar: u.profile.avatar || (u.profile.gender === 'female' ? '👩' : '👨'),
    sign: '', tags: [],
    year: u.profile.year || u.profile.birth_year,
    month: u.profile.month, day: u.profile.day,
  }));
}

function recordSwipe(userId, targetId, direction) {
  swipes[`${userId}:${targetId}`] = direction;
  saveSwipes();
  if (direction === 'right' && swipes[`${targetId}:${userId}`] === 'right') {
    return { matched: true, targetId };
  }
  return { matched: false };
}

function getMatches(userId) {
  const matches = [];
  for (const [key, dir] of Object.entries(swipes)) {
    if (dir !== 'right') continue;
    const [from, to] = key.split(':');
    if (from !== userId) continue;
    if (swipes[`${to}:${from}`] === 'right') {
      const u = users[to];
      if (u && u.profile) {
        matches.push({
          id: u.id, name: u.profile.name || '缘友', gender: u.profile.gender,
          avatar: u.profile.avatar || (u.profile.gender === 'female' ? '👩' : '👨'),
          bio: u.profile.bio || '', city: u.profile.city || '',
        });
      }
    }
  }
  return matches;
}

// ============ Friends ============

function sendFriendRequest(fromId, toId, message) {
  if (areFriends(fromId, toId)) return { error: '已是好友' };
  const existing = friendData.requests.find(r => r.from === fromId && r.to === toId && r.status === 'pending');
  if (existing) return { error: '已发送过请求' };
  const req = { id: crypto.randomUUID(), from: fromId, to: toId, message: message || '', status: 'pending', createdAt: new Date().toISOString() };
  friendData.requests.push(req);
  saveFriends();
  return { success: true, id: req.id };
}

function respondFriendRequest(requestId, userId, accept) {
  const req = friendData.requests.find(r => r.id === requestId && r.to === userId);
  if (!req) return { error: '请求不存在' };
  if (req.status !== 'pending') return { error: '请求已处理' };
  req.status = accept ? 'accepted' : 'rejected';
  req.respondedAt = new Date().toISOString();
  if (accept) {
    const pair = [req.from, req.to].sort();
    if (!friendData.accepted.find(a => a.userA === pair[0] && a.userB === pair[1])) {
      friendData.accepted.push({ userA: pair[0], userB: pair[1], createdAt: new Date().toISOString() });
    }
  }
  saveFriends();
  return { success: true, accepted: accept, from: req.from };
}

function getPendingRequests(userId) {
  return friendData.requests.filter(r => r.to === userId && r.status === 'pending').map(r => {
    const from = users[r.from];
    return { ...r, fromName: from?.profile?.name || '缘友', fromAvatar: from?.profile?.avatar || '👤' };
  });
}

function getFriends(userId) {
  return friendData.accepted.filter(a => a.userA === userId || a.userB === userId).map(a => {
    const fid = a.userA === userId ? a.userB : a.userA;
    const u = users[fid];
    return { id: fid, name: u?.profile?.name || '缘友', avatar: u?.profile?.avatar || '👤', gender: u?.profile?.gender, since: a.createdAt };
  });
}

function areFriends(userA, userB) {
  const pair = [userA, userB].sort();
  return !!friendData.accepted.find(a => a.userA === pair[0] && a.userB === pair[1]);
}

// ============ Posts ============

function createPost(userId, content, tag) {
  const user = users[userId];
  if (!user) return null;
  const post = {
    id: crypto.randomUUID(), authorId: userId,
    author: user.profile?.name || '缘友',
    avatar: user.profile?.avatar || (user.profile?.gender === 'female' ? '👩' : '👨'),
    content, tag: tag || '', likes: 0, likedBy: [], comments: [],
    createdAt: new Date().toISOString(),
  };
  posts.unshift(post);
  if (posts.length > 500) posts.length = 500;
  savePosts();
  return post;
}

function getPosts(limit, beforeId) {
  let list = posts;
  if (beforeId) { const idx = list.findIndex(p => p.id === beforeId); if (idx >= 0) list = list.slice(idx + 1); }
  return list.slice(0, limit).map(p => ({
    ...p, likedBy: undefined,
    likeCount: p.likedBy?.length || p.likes || 0,
    commentCount: p.comments?.length || 0,
  }));
}

function likePost(userId, postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return { error: '帖子不存在' };
  if (!post.likedBy) post.likedBy = [];
  const idx = post.likedBy.indexOf(userId);
  if (idx >= 0) { post.likedBy.splice(idx, 1); post.likes = post.likedBy.length; savePosts(); return { liked: false, likes: post.likes }; }
  post.likedBy.push(userId); post.likes = post.likedBy.length; savePosts();
  return { liked: true, likes: post.likes };
}

function addComment(userId, postId, text) {
  const post = posts.find(p => p.id === postId);
  if (!post) return { error: '帖子不存在' };
  const user = users[userId];
  const comment = { id: crypto.randomUUID(), authorId: userId, name: user?.profile?.name || '缘友', text, createdAt: new Date().toISOString() };
  if (!post.comments) post.comments = [];
  post.comments.push(comment); savePosts();
  return comment;
}

function getComments(postId) {
  const post = posts.find(p => p.id === postId);
  return post ? (post.comments || []) : [];
}

// ============ Admin: Content ============

function adminListPosts({ search, page = 1, limit = 20 } = {}) {
  let list = posts;
  if (search) { const s = search.toLowerCase(); list = list.filter(p => p.content?.toLowerCase().includes(s) || p.author?.toLowerCase().includes(s)); }
  const total = list.length;
  return { total, page, limit, items: list.slice((page - 1) * limit, page * limit).map(p => ({ ...p, likedBy: undefined, likeCount: p.likedBy?.length || p.likes || 0, commentCount: p.comments?.length || 0 })) };
}

function adminDeletePost(postId) {
  const idx = posts.findIndex(p => p.id === postId);
  if (idx < 0) return { error: '帖子不存在' };
  posts.splice(idx, 1); savePosts();
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

// ============ Reports ============

function submitReport(reporterId, { targetType, targetId, reason }) {
  const report = {
    id: crypto.randomUUID(), reporterId,
    reporterName: users[reporterId]?.profile?.name || '匿名',
    targetType, targetId,
    reason: (reason || '').substring(0, 500),
    status: 'pending', resolution: '',
    createdAt: new Date().toISOString(),
  };
  reports.unshift(report); saveReports();
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
  report.status = status; report.resolution = resolution || '';
  report.resolvedAt = new Date().toISOString();
  saveReports();
  return { success: true };
}

// ============ Admin Helpers (cross-store queries) ============

function getMatchCount(userId) {
  let count = 0;
  for (const [key, dir] of Object.entries(swipes)) {
    if (dir !== 'right') continue;
    const [from, to] = key.split(':');
    if (from !== userId) continue;
    if (swipes[`${to}:${from}`] === 'right') count++;
  }
  return count;
}

function getFriendCount(userId) {
  return friendData.accepted.filter(a => a.userA === userId || a.userB === userId).length;
}

function getFriendsList(userId) {
  return friendData.accepted
    .filter(a => a.userA === userId || a.userB === userId)
    .map(a => {
      const fid = a.userA === userId ? a.userB : a.userA;
      const fu = users[fid];
      return { id: fid, name: fu?.profile?.name || '缘友', gender: fu?.profile?.gender, since: a.createdAt };
    });
}

function getSwipeStats(userId) {
  let swipedRight = 0, swipedLeft = 0, beenLiked = 0;
  for (const [key, dir] of Object.entries(swipes)) {
    const [from, to] = key.split(':');
    if (from === userId) { if (dir === 'right') swipedRight++; else swipedLeft++; }
    if (to === userId && dir === 'right') beenLiked++;
  }
  return { swipedRight, swipedLeft, beenLiked };
}

function getUserPosts(userId) {
  return (posts || []).filter(p => p.authorId === userId);
}

function getPostCount() { return (posts || []).length; }

function getSwipersCount() {
  const swipers = new Set(Object.keys(swipes).map(k => k.split(':')[0]));
  return swipers.size;
}

module.exports = {
  init,
  // Swipes
  getCandidates, recordSwipe, getMatches,
  // Friends
  sendFriendRequest, respondFriendRequest, getPendingRequests, getFriends, areFriends,
  // Posts
  createPost, getPosts, likePost, addComment, getComments,
  adminListPosts, adminDeletePost, adminPinPost,
  // Reports
  submitReport, adminListReports, adminResolveReport,
  // Admin helpers (cross-store)
  getMatchCount, getFriendCount, getFriendsList, getSwipeStats, getUserPosts, getPostCount, getSwipersCount,
};
