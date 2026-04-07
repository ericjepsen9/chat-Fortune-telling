/**
 * 缘合 VIP Manager — 会员等级 + 订单 + 不活跃用户
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function atomicWriteSync(f, d) { const t = f + '.tmp.' + process.pid; fs.writeFileSync(t, d); fs.renameSync(t, f); }

const DATA_DIR = path.join(__dirname, '../data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// VIP等级定义
const VIP_TIERS = {
  free: { name: '免费用户', level: 0, dailyDivinations: 5, followUpsPerReport: 5, canSeeWhoLiked: false, unlimitedSwipes: false, price: 0 },
  basic: { name: '缘合会员', level: 1, dailyDivinations: 20, followUpsPerReport: 20, canSeeWhoLiked: true, unlimitedSwipes: true, price: 28, period: '月' },
  premium: { name: '缘合至尊', level: 2, dailyDivinations: -1, followUpsPerReport: -1, canSeeWhoLiked: true, unlimitedSwipes: true, advancedMatching: true, price: 68, period: '月' },
};

// 订单存储
let orders = [];
try { if (fs.existsSync(ORDERS_FILE)) orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8')); } catch (e) {}
function saveOrders() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    atomicWriteSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (e) {}
}

// ============ VIP Operations ============

function getUserVip(user) {
  if (!user) return { tier: 'free', ...VIP_TIERS.free };
  if (!user.vip || !user.vip.tier) return { tier: 'free', ...VIP_TIERS.free };
  // 检查过期
  if (user.vip.expiresAt && new Date(user.vip.expiresAt) < new Date()) {
    return { tier: 'free', ...VIP_TIERS.free, expired: true, previousTier: user.vip.tier };
  }
  const tierInfo = VIP_TIERS[user.vip.tier] || VIP_TIERS.free;
  return { ...tierInfo, tier: user.vip.tier, expiresAt: user.vip.expiresAt, grantedBy: user.vip.grantedBy };
}

function grantVip(users, userId, tier, days, grantedBy) {
  const user = users[userId];
  if (!user) return { error: '用户不存在' };
  if (days < 0) return { error: '天数不能为负数' };
  if (!VIP_TIERS[tier]) return { error: '无效等级' };

  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null; // null=永久
  user.vip = { tier, expiresAt, grantedBy, grantedAt: new Date().toISOString() };

  // 创建订单记录
  const order = {
    id: 'ORD_' + crypto.randomUUID().substring(0, 8).toUpperCase(),
    userId,
    userName: user.profile?.name || '缘友',
    type: 'admin_grant',
    tier,
    tierName: VIP_TIERS[tier].name,
    days: days || '永久',
    amount: 0,
    status: 'completed',
    grantedBy,
    createdAt: new Date().toISOString(),
  };
  orders.unshift(order);
  saveOrders();

  return { success: true, vip: user.vip, order };
}

function revokeVip(users, userId) {
  const user = users[userId];
  if (!user) return { error: '用户不存在' };
  user.vip = null;
  return { success: true };
}

// ============ Orders ============

function getOrders({ page = 1, limit = 20, status } = {}) {
  let list = orders;
  if (status && status !== 'all') list = list.filter(o => o.status === status);
  const total = list.length;
  return { total, page, limit, items: list.slice((page - 1) * limit, page * limit) };
}

function getRevenueStats() {
  const now = new Date();
  const today = now.toDateString();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);

  return {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + (o.amount || 0), 0),
    todayOrders: orders.filter(o => new Date(o.createdAt).toDateString() === today).length,
    todayRevenue: orders.filter(o => new Date(o.createdAt).toDateString() === today).reduce((s, o) => s + (o.amount || 0), 0),
    weekRevenue: orders.filter(o => new Date(o.createdAt) >= weekStart).reduce((s, o) => s + (o.amount || 0), 0),
    monthRevenue: orders.filter(o => new Date(o.createdAt) >= monthStart).reduce((s, o) => s + (o.amount || 0), 0),
    vipGrants: orders.filter(o => o.type === 'admin_grant').length,
  };
}

// ============ Inactive Users ============

function getInactiveUsers(users, inactiveDays = 7, limit = 50) {
  const cutoff = Date.now() - inactiveDays * 86400000;
  return Object.values(users)
    .filter(u => u.profile?.year && !u.deleted && !u.banned)
    .filter(u => !u.lastActiveAt || new Date(u.lastActiveAt).getTime() < cutoff)
    .sort((a, b) => (new Date(a.lastActiveAt || 0)) - (new Date(b.lastActiveAt || 0)))
    .slice(0, limit)
    .map(u => ({
      id: u.id,
      name: u.profile?.name || '缘友',
      phone: u.phone,
      gender: u.profile?.gender,
      lastActiveAt: u.lastActiveAt,
      daysSinceActive: u.lastActiveAt ? Math.floor((Date.now() - new Date(u.lastActiveAt).getTime()) / 86400000) : '从未',
      divinationCount: u.divinations?.length || 0,
      vipTier: u.vip?.tier || 'free',
    }));
}

module.exports = { VIP_TIERS, getUserVip, grantVip, revokeVip, getOrders, getRevenueStats, getInactiveUsers };
