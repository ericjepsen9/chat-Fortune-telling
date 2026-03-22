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

// 引入占术引擎
const baziEngine = require('./src/engines/bazi');
const astrologyEngine = require('./src/engines/astrology');
const tarotEngine = require('./src/engines/tarot');
const meihuaEngine = require('./src/engines/meihua');
const vedicEngine = require('./src/engines/vedic');

// ============ LLM 调用 ============

async function callLLM(systemPrompt, userMessage) {
  const apiUrl = `${LLM_BASE_URL}/chat/completions`;

  const body = JSON.stringify({
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 800,
    temperature: 0.8,
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
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('LLM 请求超时(60s)')); });
    req.write(body);
    req.end();
  });
}

// ============ 引擎计算 + AI 解读 ============

const PROMPTS = {
  bazi: '你是专业的八字命理分析师。基于以下命盘数据进行解读，语气温暖积极，给出可执行建议，200字以内。不要提及其他占术。\n\n命盘数据：\n',
  astrology: '你是星座运势顾问。基于以下星座数据进行解读，语气亲切，像朋友聊天，200字以内。不要提及其他占术。\n\n星座数据：\n',
  tarot: '你是塔罗解读师。只解读以下已抽出的牌面，结合用户问题解读，灵性但务实，200字以内。不要自己重新抽牌。不要提及其他占术。\n\n牌面：\n',
  meihua: '你是梅花易数分析师。基于以下卦象数据解读，重点分析体用生克关系，给出明确建议和时间窗口，200字以内。不要提及其他占术。\n\n卦象数据：\n',
  vedic: '你是吠陀占星（印度占星）顾问。基于以下星盘数据解读，使用梵文术语时附中文翻译，关注当前大运周期，200字以内。不要提及其他占术。\n\n星盘数据：\n',
};

function calculateEngine(mode, profile) {
  switch (mode) {
    case 'bazi':
      return JSON.stringify(baziEngine.calculate(profile), null, 2);
    case 'astrology':
      return JSON.stringify(astrologyEngine.calculate(profile), null, 2);
    case 'tarot':
      return tarotEngine.formatForAI(tarotEngine.drawCards('threeCard', `${profile.year}-${Date.now()}`), 'zh');
    case 'meihua':
      return meihuaEngine.formatForAI(meihuaEngine.generateHexagram(new Date()), 'zh');
    case 'vedic':
      return vedicEngine.formatForAI(vedicEngine.calculate(profile), 'zh');
    default:
      return '未知模式';
  }
}

async function handleDivination(mode, profile, question) {
  const engineData = calculateEngine(mode, profile);
  const systemPrompt = PROMPTS[mode] + engineData;
  const response = await callLLM(systemPrompt, question);
  return { mode, engineData, response };
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

  // API：仅计算引擎（不调 LLM）
  if (parsedUrl.pathname === '/api/calculate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { mode, year, month, day, hour } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
        const data = calculateEngine(mode, profile);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ mode, engineData: data }));
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
        const { mode, year, month, day, hour, question } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
        const result = await handleDivination(mode, profile, question || '请为我分析一下整体运势');
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
