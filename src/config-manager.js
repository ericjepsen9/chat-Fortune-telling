/**
 * 缘合 Config Manager — 功能开关 + 维护模式 + Bot配置 + LLM限额
 * 存储: data/config.json, 热加载无需重启
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULTS = {
  // 维护模式
  maintenance: { enabled: false, message: '系统维护中，请稍后再试' },

  // 功能开关
  features: {
    fortuneWheel: true,     // 命运转盘
    communityPosts: true,   // 缘友圈发帖
    moodTracker: true,      // 心情打卡
    shareCards: true,        // 分享卡片
    voiceMessage: true,     // 语音消息
    imageMessage: true,     // 图片消息
    // 占卜模式开关
    modes: {
      bazi: true,
      astrology: true,
      tarot: true,
      meihua: true,
      vedic: true,
      hehun: true,
      synastry: true,
      hepan: true,
    },
  },

  // Bot行为
  bot: {
    enabled: true,           // Bot总开关
    autoGreet: true,         // 匹配后自动问候
    proactiveMessages: true, // Bot主动消息
    replyDelayMin: 2000,     // 最短回复延迟(ms)
    replyDelayMax: 7000,     // 最长回复延迟(ms)
    typingDurationMin: 2000, // 最短打字时间(ms)
    typingDurationMax: 6000, // 最长打字时间(ms)
    activeHourStart: 8,      // 活跃开始时间
    activeHourEnd: 23,       // 活跃结束时间
    proactiveIntervalMin: 180000, // 主动消息最短间隔(ms)
  },

  // LLM限额
  limits: {
    divinationsPerDay: 0,    // 每用户每天占卜次数(0=不限)
    followUpsPerReport: 20,  // 每报告追问次数
    followUpsPerDay: 0,      // 每用户每天追问次数(0=不限)
  },

  // 自动标记规则
  autoFlag: {
    enabled: true,
    patterns: [
      '\\b1[3-9]\\d{9}\\b',           // 手机号
      '微信|wx|wechat|加我|v信',       // 微信
      'https?://[^\\s]+',             // URL
      'QQ[：:]?\\s*\\d{5,}',          // QQ号
    ],
  },

  // LLM providers (可通过后台动态管理)
  llm: {
    activeIndex: 0,
    defaultParams: {
      temperature: 0.5,
      maxTokens: 6144,
      timeout: 180000,
    },
    providers: [],  // 动态添加的provider列表
  },
};

let config = null;

function load() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      config = deepMerge(DEFAULTS, saved);
    } else {
      config = { ...DEFAULTS };
      save();
    }
  } catch (e) {
    console.error('Config load error:', e.message);
    config = { ...DEFAULTS };
  }
  return config;
}

function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Config save error:', e.message);
  }
}

function get(key) {
  if (!config) load();
  if (!key) return config;
  return key.split('.').reduce((o, k) => o?.[k], config);
}

function set(key, value) {
  if (!config) load();
  const keys = key.split('.');
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  save();
  return config;
}

function update(patch) {
  if (!config) load();
  config = deepMerge(config, patch);
  save();
  return config;
}

function getAll() {
  if (!config) load();
  return config;
}

// Check if a feature is enabled
function isEnabled(featureKey) {
  if (!config) load();
  if (config.maintenance.enabled) return false; // 维护模式下全部关闭
  return get('features.' + featureKey) !== false;
}

// Check auto-flag patterns against text
function checkAutoFlag(text) {
  if (!config) load();
  if (!config.autoFlag.enabled || !text) return { flagged: false, matches: [] };
  const matches = [];
  for (const p of config.autoFlag.patterns) {
    try {
      const re = new RegExp(p, 'gi');
      const m = text.match(re);
      if (m) matches.push(...m);
    } catch (e) {}
  }
  return { flagged: matches.length > 0, matches };
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

load();

module.exports = { get, set, update, getAll, isEnabled, checkAutoFlag, load };
