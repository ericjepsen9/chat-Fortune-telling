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
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('LLM 请求超时(60s)')); });
    req.write(body);
    req.end();
  });
}

// ============ 引擎计算 + AI 解读 ============

const PROMPTS = {
  bazi: {
    expert: `你是专业命理师，用户懂八字。规则：直接用十神/格局/神煞等术语，分析日主强弱和喜忌，引用具体干支关系，有理有据，不笼统。严禁自行编造流年干支或大运信息——所有流年数据已由系统精确计算并提供在下方，你只能基于提供的数据分析，不得添加任何系统未提供的年份信息。\n\n排盘数据：\n`,
    simple: `你是温暖亲切的命理顾问，用户是普通人。规则：禁止用十神/偏印/伤官等术语，用比喻描述性格运势，像朋友聊天，给具体可执行建议。严禁自行编造年份干支——下方数据中已包含今年的流年信息，直接引用即可，不得自行推算或捏造任何干支年份。\n\n命盘摘要：\n`
  },
  astrology: {
    expert: `你是专业占星师。用宫位、相位、守护星等术语分析太阳-月亮-上升组合效应。\n\n星盘数据：\n`,
    simple: `你是亲切的星座顾问。用轻松语言解读，不用专业术语，像朋友聊星座，给具体建议。\n\n星座数据：\n`
  },
  tarot: {
    expert: `你是专业塔罗解读师。规则：分析每张牌在该位置的含义，正逆位区分，分析牌间能量流向，结合元素象征，不要重新抽牌。\n\n牌面：\n`,
    simple: `你是温柔的塔罗顾问。规则：不用"大阿尔卡那""逆位"术语，每张牌一句话说清，重点回答用户问题，给行动建议，不要重新抽牌。\n\n牌面：\n`
  },
  meihua: {
    expert: `你是专业易学分析师。规则：详细分析体用生克，结合动爻变卦分析趋势，使用体/用/生/克术语，给出应期。\n\n卦象数据：\n`,
    simple: `你是决策顾问。规则：不用体卦/用卦/生克术语，用"你的处境""外部环境""趋势"来表达，给明确建议。\n\n占卜数据：\n`
  },
  vedic: {
    expert: `你是Jyotish顾问。用Dasha/Nakshatra/Rashi等梵文术语（附中文），分析当前行星周期。\n\n星盘数据：\n`,
    simple: `你是亲切的印度占星顾问。不用梵文术语，重点说当前阶段运势和建议。\n\n星盘数据：\n`
  },
};

function calculateEngine(mode, profile, displayMode) {
  displayMode = displayMode || 'simple';
  switch (mode) {
    case 'bazi':
      return baziEngine.formatForAI(baziEngine.calculate(profile), displayMode);
    case 'astrology':
      return astrologyEngine.formatForAI(astrologyEngine.calculate(profile), displayMode);
    case 'tarot': {
      const seed = tarotEngine.stableSeed(`${profile.year}-${profile.month}-${profile.day}`, new Date());
      return tarotEngine.formatForAI(tarotEngine.drawCards('threeCard', seed), displayMode);
    }
    case 'meihua':
      return meihuaEngine.formatForAI(meihuaEngine.generateHexagram(new Date()), displayMode);
    case 'vedic':
      return vedicEngine.formatForAI(vedicEngine.calculate(profile), displayMode);
    default:
      return '未知模式';
  }
}

async function handleDivination(mode, profile, question, displayMode) {
  displayMode = displayMode || 'simple';
  const engineData = calculateEngine(mode, profile, displayMode);
  const prompt = PROMPTS[mode][displayMode] || PROMPTS[mode].simple;
  const systemPrompt = prompt + engineData;
  const response = await callLLM(systemPrompt, question);
  return { mode, displayMode, engineData, response };
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
        const { mode, year, month, day, hour, displayMode } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
        const data = calculateEngine(mode, profile, displayMode || 'simple');
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
        const { mode, year, month, day, hour, question, displayMode } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour) };
        const result = await handleDivination(mode, profile, question || '请为我分析一下整体运势', displayMode || 'simple');
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
