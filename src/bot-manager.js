/**
 * 缘合 Bot Manager — Bot角色管理
 * 存储: data/bots.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const BOTS_FILE = path.join(DATA_DIR, 'bots.json');

let bots = [];

function load() {
  try {
    if (fs.existsSync(BOTS_FILE)) {
      bots = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return bots;
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2));
  } catch (e) {}
}

load();

function getAll() { return bots; }

function getById(id) { return bots.find(b => String(b.id) === String(id)); }

function create(data) {
  const bot = {
    id: parseInt(data.id) || (300 + bots.length),
    name: data.name || '新Bot',
    age: parseInt(data.age) || 25,
    bio: data.bio || '',
    year: parseInt(data.year) || 2000,
    month: parseInt(data.month) || 1,
    day: parseInt(data.day) || 1,
    hour: parseInt(data.hour) || 12,
    gender: data.gender || 'female',
    dist: data.dist || '3km',
    sign: data.sign || '',
    tags: data.tags || [],
    isBot: true,
    chatStyle: data.chatStyle || '',
    enabled: data.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  bots.push(bot);
  save();
  return bot;
}

function update(id, data) {
  const bot = bots.find(b => String(b.id) === String(id));
  if (!bot) return { error: 'Bot不存在 (id:'+id+')' };
  if (data.name !== undefined) bot.name = data.name;
  if (data.age !== undefined) bot.age = parseInt(data.age);
  if (data.bio !== undefined) bot.bio = data.bio;
  if (data.year !== undefined) bot.year = parseInt(data.year);
  if (data.month !== undefined) bot.month = parseInt(data.month);
  if (data.day !== undefined) bot.day = parseInt(data.day);
  if (data.hour !== undefined) bot.hour = parseInt(data.hour);
  if (data.gender !== undefined) bot.gender = data.gender;
  if (data.dist !== undefined) bot.dist = data.dist;
  if (data.sign !== undefined) bot.sign = data.sign;
  if (data.tags !== undefined) bot.tags = data.tags;
  if (data.chatStyle !== undefined) bot.chatStyle = data.chatStyle;
  if (data.enabled !== undefined) bot.enabled = data.enabled;
  save();
  return bot;
}

function remove(id) {
  const idx = bots.findIndex(b => String(b.id) === String(id));
  if (idx < 0) return { error: 'Bot不存在' };
  bots.splice(idx, 1);
  save();
  return { success: true };
}

function toggle(id) {
  const bot = bots.find(b => String(b.id) === String(id));
  if (!bot) return { error: 'Bot不存在' };
  bot.enabled = !bot.enabled;
  save();
  return bot;
}

module.exports = { getAll, getById, create, update, remove, toggle, load };
