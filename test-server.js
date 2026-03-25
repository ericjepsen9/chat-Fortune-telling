/**
 * 缘合 — 本地测试服务器
 * 连接5种占术引擎 + Cherry Studio 本地 LLM
 * 
 * 启动方式：
 *   1. npm install （首次）
 *   2. 修改 .env 文件填入你的 Cherry Studio 配置
 *   3. node test-server.js
 *   4. 浏览器打开 http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 读取 .env 配置
function loadEnv() {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
    envFile.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...vals] = line.split('=');
        process.env[key.trim()] = vals.join('=').trim();
      }
    });
  } catch (e) {
    console.log('⚠️  未找到 .env 文件，使用默认配置');
  }
}
loadEnv();

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || 'ollama';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-r1:1.5b';
const PORT = parseInt(process.env.SERVER_PORT) || 3000;

// 引入新的 AI 服务
const aiService = require('./src/ai-service');

// ============ LLM 调用 ============

async function callLLM(systemPrompt, userMessage) {
  const apiUrl = `${LLM_BASE_URL}/chat/completions`;

  const body = JSON.stringify({
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 4096,
    temperature: 0.5,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const parsed = new URL(apiUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = (parsed.protocol === 'https:' ? require('https') : http).request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
          } else {
            resolve(data);
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`连接 LLM 失败: ${e.message}\n请检查 Cherry Studio 是否已启动，API 地址: ${apiUrl}`)));
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('LLM 请求超时(180s)')); });
    req.write(body);
    req.end();
  });
}

// ============ 引擎计算 + AI 解读（使用 ai-service v3） ============

function calculateEngine(mode, profile, displayMode, ctxOptions) {
  const ctx = aiService.createContext(ctxOptions || {});
  return aiService.calculateAll(mode, profile, ctx, { displayMode: displayMode || 'simple', ...(ctxOptions || {}) });
}

async function handleDivination(mode, profile, question, displayMode, ctxOptions) {
  const req = aiService.buildRequest(mode, profile, question, {
    displayMode: displayMode || 'simple',
    ...(ctxOptions || {}),
  });

  // 安全过滤：被拦截的问题不调用LLM
  if (req.blocked) {
    return { mode, blocked: true, reason: req.reason, engineData: '', response: req.reason };
  }

  const response = await callLLM(req.systemPrompt, req.userMessage);
  return { mode, displayMode: req.displayMode, category: req.category, safetyLevel: req.safetyLevel, engineData: req.engineData, context: req.context.fullStr, response };
}

// ============ HTTP 服务器 ============

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // 静态文件：测试页面
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'test-page.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 缘合App（测试版）
  if (parsedUrl.pathname === '/app') {
    const html = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // API：健康检查
  if (parsedUrl.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      llm: { baseUrl: LLM_BASE_URL, model: LLM_MODEL },
      engines: ['bazi', 'astrology', 'tarot', 'meihua', 'vedic'],
    }));
    return;
  }

  // API：塔罗牌组（前端用于展示选牌界面）
  if (parsedUrl.pathname === '/api/tarot/deck') {
    const tarotDeck = require('./src/engines/tarot').DECK;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(tarotDeck.map(c => ({ id: c.id, zh: c.zh, en: c.en, type: c.type }))));
    return;
  }

  // API：公历→农历转换
  if (parsedUrl.pathname === '/api/lunar') {
    const params = parsedUrl.query || {};
    try {
      const { Solar } = require('lunar-javascript');
      const y = parseInt(params.year) || 2000, m = parseInt(params.month) || 1, d = parseInt(params.day) || 1, h = parseInt(params.hour) || 12;
      const solar = Solar.fromYmdHms(y, m, d, h, 0, 0);
      const lunar = solar.getLunar();
      const ec = lunar.getEightChar();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        solar: `${y}年${m}月${d}日`,
        lunar: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
        lunarFull: `农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getYearShengXiao()}年`,
        ganzhi: `${ec.getYear()} ${ec.getMonth()} ${ec.getDay()} ${ec.getTime()}`,
        shengxiao: lunar.getYearShengXiao(),
        yearGanzhi: ec.getYear(),
      }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API：仅计算引擎（不调 LLM）
  if (parsedUrl.pathname === '/api/calculate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { mode, year, month, day, hour, gender, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
        const data = calculateEngine(mode, profile, displayMode || 'simple', { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ mode, displayMode: displayMode || 'simple', engineData: data }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：计算 + AI 解读
  if (parsedUrl.pathname === '/api/divine' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { mode, year, month, day, hour, gender, question, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
        const ctxOptions = { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB };
        // 空问题或默认问题 → 全面分析；有具体问题 → 聚焦分析
        const result = await handleDivination(mode, profile, question || '', displayMode || 'simple', ctxOptions);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║         缘合 · 占术引擎测试服务器          ║
╠══════════════════════════════════════════╣
║                                          ║
║  🌐 测试页面: http://localhost:${PORT}       ║
║  📱 缘合App:  http://localhost:${PORT}/app   ║
║                                          ║
║  🤖 LLM 地址: ${LLM_BASE_URL.padEnd(25)}║
║  📦 模型:     ${LLM_MODEL.padEnd(25)}║
║                                          ║
║  📡 API 接口:                             ║
║  GET  /api/health    - 健康检查           ║
║  POST /api/calculate - 仅引擎计算         ║
║  POST /api/divine    - 引擎+AI解读        ║
║                                          ║
╚══════════════════════════════════════════╝
`);
});
