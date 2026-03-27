/**
 * 缘合 · 系统日志与监控模块
 * 
 * 功能：
 * - 日志写入文件 (logs/yuanhe-YYYY-MM-DD.log)
 * - 控制台彩色输出
 * - API请求/响应记录
 * - LLM调用追踪（耗时、token、截断）
 * - 引擎计算记录
 * - 错误追踪
 * - 实时统计（请求数、成功率、平均耗时）
 */

const fs = require('fs');
const path = require('path');

// ========== 日志目录 ==========
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ========== 统计数据 ==========
const stats = {
  startTime: Date.now(),
  requests: { total: 0, success: 0, error: 0 },
  api: {},        // 每个API端点的统计
  llm: { calls: 0, success: 0, error: 0, timeout: 0, truncated: 0, totalTime: 0, totalTokens: 0 },
  engine: { calls: 0, errors: 0, totalTime: 0 },
  recentLogs: [],  // 最近100条日志（给监控页面用）
  recentErrors: [], // 最近20条错误
};

// ========== 日志级别 ==========
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const LEVEL_COLORS = ['\x1b[90m', '\x1b[36m', '\x1b[33m', '\x1b[31m', '\x1b[35m'];
const RESET = '\x1b[0m';

let currentLogLevel = LEVELS.DEBUG;

// ========== 核心日志函数 ==========
function log(level, category, message, data = null) {
  if (level < currentLogLevel) return;

  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 23);
  const levelName = LEVEL_NAMES[level] || 'INFO';
  const color = LEVEL_COLORS[level] || '';

  // 格式化数据
  let dataStr = '';
  if (data) {
    try {
      if (typeof data === 'string') dataStr = data;
      else if (data instanceof Error) dataStr = data.stack || data.message;
      else dataStr = JSON.stringify(data, null, 0);
      // 截断过长数据
      if (dataStr.length > 500) dataStr = dataStr.substring(0, 500) + '...(截断)';
    } catch(e) { dataStr = '[无法序列化]'; }
  }

  // 控制台输出（彩色）
  const consoleMsg = `${color}[${timestamp}] [${levelName}] [${category}]${RESET} ${message}${dataStr ? ' | ' + dataStr : ''}`;
  if (level >= LEVELS.ERROR) console.error(consoleMsg);
  else console.log(consoleMsg);

  // 写入文件
  const dateStr = now.toISOString().substring(0, 10);
  const logFile = path.join(LOG_DIR, `yuanhe-${dateStr}.log`);
  const fileLine = `[${timestamp}] [${levelName}] [${category}] ${message}${dataStr ? ' | ' + dataStr : ''}\n`;
  try { fs.appendFileSync(logFile, fileLine, 'utf-8'); } catch(e) {}

  // 存入最近日志（给监控页面）
  const entry = { time: timestamp, level: levelName, category, message, data: dataStr || undefined };
  stats.recentLogs.push(entry);
  if (stats.recentLogs.length > 100) stats.recentLogs.shift();
  if (level >= LEVELS.ERROR) {
    stats.recentErrors.push(entry);
    if (stats.recentErrors.length > 20) stats.recentErrors.shift();
  }
}

// ========== 快捷方法 ==========
const debug = (cat, msg, data) => log(LEVELS.DEBUG, cat, msg, data);
const info = (cat, msg, data) => log(LEVELS.INFO, cat, msg, data);
const warn = (cat, msg, data) => log(LEVELS.WARN, cat, msg, data);
const error = (cat, msg, data) => log(LEVELS.ERROR, cat, msg, data);

// ========== API请求记录 ==========
function logRequest(req, parsedUrl) {
  stats.requests.total++;
  const endpoint = parsedUrl.pathname;
  if (!stats.api[endpoint]) stats.api[endpoint] = { count: 0, success: 0, error: 0, totalTime: 0 };
  stats.api[endpoint].count++;

  const reqId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  info('HTTP', `${req.method} ${endpoint}`, { reqId });
  return { reqId, endpoint, startTime: Date.now() };
}

function logResponse(ctx, statusCode, error = null) {
  const elapsed = Date.now() - ctx.startTime;
  if (stats.api[ctx.endpoint]) {
    stats.api[ctx.endpoint].totalTime += elapsed;
    if (statusCode < 400) {
      stats.api[ctx.endpoint].success++;
      stats.requests.success++;
    } else {
      stats.api[ctx.endpoint].error++;
      stats.requests.error++;
    }
  }

  if (statusCode >= 400) {
    warn('HTTP', `${ctx.endpoint} → ${statusCode} (${elapsed}ms)`, error);
  } else {
    debug('HTTP', `${ctx.endpoint} → ${statusCode} (${elapsed}ms)`);
  }
}

// ========== LLM调用记录 ==========
function logLLMStart(mode, promptLen, engineDataLen) {
  stats.llm.calls++;
  info('LLM', `开始调用 | 模式=${mode} prompt=${promptLen}字 数据=${engineDataLen}字`);
  return { startTime: Date.now(), mode };
}

function logLLMSuccess(ctx, responseLen, finishReason, statusCode) {
  const elapsed = Date.now() - ctx.startTime;
  stats.llm.success++;
  stats.llm.totalTime += elapsed;
  
  const truncated = finishReason === 'length';
  if (truncated) stats.llm.truncated++;
  
  info('LLM', `完成 | 模式=${ctx.mode} 回复=${responseLen}字 耗时=${(elapsed/1000).toFixed(1)}秒${truncated ? ' ⚠️截断' : ''}`, { finishReason });
  return { elapsed, truncated };
}

function logLLMError(ctx, err) {
  const elapsed = Date.now() - ctx.startTime;
  stats.llm.error++;
  stats.llm.totalTime += elapsed;
  
  if (err.message && err.message.includes('超时')) stats.llm.timeout++;
  
  error('LLM', `失败 | 模式=${ctx.mode} 耗时=${(elapsed/1000).toFixed(1)}秒`, err.message);
}

// ========== 引擎计算记录 ==========
function logEngine(mode, profile, elapsed, dataLen) {
  stats.engine.calls++;
  stats.engine.totalTime += elapsed;
  debug('ENGINE', `${mode} | 生辰=${profile.year}-${profile.month}-${profile.day} ${profile.hour}时 | ${dataLen}字 ${elapsed}ms`);
}

function logEngineError(mode, err) {
  stats.engine.errors++;
  error('ENGINE', `${mode} 计算失败`, err.message);
}

// ========== 安全事件 ==========
function logSafety(question, level) {
  if (level === 'blocked') {
    warn('SAFETY', `拦截敏感问题`, question.substring(0, 50));
  } else if (level === 'sensitive') {
    info('SAFETY', `敏感问题（已放行）`, question.substring(0, 50));
  }
}

// ========== 获取统计数据 ==========
function getStats() {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const avgLLMTime = stats.llm.success > 0 ? Math.round(stats.llm.totalTime / stats.llm.success) : 0;
  const avgEngineTime = stats.engine.calls > 0 ? Math.round(stats.engine.totalTime / stats.engine.calls) : 0;
  const successRate = stats.requests.total > 0 ? Math.round(stats.requests.success / stats.requests.total * 100) : 0;

  return {
    uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${uptime%60}s`,
    uptimeSeconds: uptime,
    requests: { ...stats.requests, successRate: successRate + '%' },
    api: stats.api,
    llm: {
      ...stats.llm,
      avgTime: avgLLMTime + 'ms',
      avgTimeSeconds: (avgLLMTime / 1000).toFixed(1) + 's',
    },
    engine: {
      ...stats.engine,
      avgTime: avgEngineTime + 'ms',
    },
    recentErrors: stats.recentErrors,
    recentLogs: stats.recentLogs.slice(-30),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    },
  };
}

// ========== 设置日志级别 ==========
function setLevel(level) {
  if (typeof level === 'string') level = LEVELS[level.toUpperCase()] || LEVELS.DEBUG;
  currentLogLevel = level;
}

module.exports = {
  debug, info, warn, error,
  logRequest, logResponse,
  logLLMStart, logLLMSuccess, logLLMError,
  logEngine, logEngineError,
  logSafety,
  getStats, setLevel,
  LEVELS,
};
