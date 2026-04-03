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
const crypto = require('crypto');

// Anonymous LLM headers — no user-identifying info
function anonLLMHeaders(bodyLen, apiKey) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey||LLM_API_KEY}`,
    'Content-Length': bodyLen,
    'X-Request-ID': crypto.randomUUID(), // random per-request, not tied to user
  };
}

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

// Multi-LLM failover: primary → backup → fallback
const LLM_PROVIDERS = [
  { name:'primary', url:LLM_BASE_URL, key:LLM_API_KEY, model:LLM_MODEL },
  process.env.LLM_BACKUP_URL ? { name:'backup', url:process.env.LLM_BACKUP_URL, key:process.env.LLM_BACKUP_KEY||LLM_API_KEY, model:process.env.LLM_BACKUP_MODEL||LLM_MODEL } : null,
  process.env.LLM_FALLBACK_URL ? { name:'fallback', url:process.env.LLM_FALLBACK_URL, key:process.env.LLM_FALLBACK_KEY||LLM_API_KEY, model:process.env.LLM_FALLBACK_MODEL||LLM_MODEL } : null,
].filter(Boolean);

let activeProvider = 0; // index into LLM_PROVIDERS
const providerErrors = {}; // track consecutive errors per provider

function getProvider() {
  // Return current active provider, skip providers with too many recent errors
  for (let i = 0; i < LLM_PROVIDERS.length; i++) {
    const idx = (activeProvider + i) % LLM_PROVIDERS.length;
    const p = LLM_PROVIDERS[idx];
    const errs = providerErrors[p.name] || 0;
    if (errs < 3) return { ...p, index: idx };
  }
  // All providers have errors, reset and try primary
  Object.keys(providerErrors).forEach(k => providerErrors[k] = 0);
  return { ...LLM_PROVIDERS[0], index: 0 };
}

function onProviderSuccess(name) { providerErrors[name] = 0; }
function onProviderError(name) {
  providerErrors[name] = (providerErrors[name] || 0) + 1;
  if (providerErrors[name] >= 3 && LLM_PROVIDERS.length > 1) {
    const oldIdx = LLM_PROVIDERS.findIndex(p => p.name === name);
    activeProvider = (oldIdx + 1) % LLM_PROVIDERS.length;
    logger.warn('LLM', `${name}连续失败${providerErrors[name]}次，切换到${LLM_PROVIDERS[activeProvider].name}`);
  }
}

// 引入新的 AI 服务
const aiService = require('./src/ai-service');
const logger = require('./src/logger');

// ============ LLM 调用 ============

async function callLLM(systemPrompt, userMessage, mode = '', maxTokens = 6144) {
  const provider = getProvider();
  const apiUrl = `${provider.url}/chat/completions`;
  const llmCtx = logger.logLLMStart(mode, systemPrompt.length, userMessage.length);

  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const parsed = new URL(apiUrl);
    const options = {
      hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
      headers: anonLLMHeaders(Buffer.byteLength(body), provider.key),
    };

    const req = (parsed.protocol === 'https:' ? require('https') : http).request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          logger.error('LLM', `状态码 ${res.statusCode}`, data.substring(0, 300));
        }
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            let content = json.choices[0].message.content;
            const finishReason = json.choices[0].finish_reason;
            const result = logger.logLLMSuccess(llmCtx, content.length, finishReason, res.statusCode);
            onProviderSuccess(provider.name);
            if (finishReason === 'length') {
              content += '\n\n---\n⚠️ *AI输出因长度限制被截断，以上为部分内容。可输入具体问题获取更聚焦的分析。*';
            }
            // Strip <think> reasoning tags from AI response
            content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            resolve(content);
          } else if (json.error) {
            const err = new Error(json.error.message || JSON.stringify(json.error));
            logger.logLLMError(llmCtx, err);
            reject(err);
          } else {
            resolve(data);
          }
        } catch (e) {
          const err = new Error(`LLM返回非JSON(状态码${res.statusCode}): ${data.substring(0, 200)}`);
          logger.logLLMError(llmCtx, err);
          reject(err);
        }
      });
    });

    req.on('error', (e) => {
      const err = new Error(`连接 LLM 失败: ${e.message}`);
      logger.logLLMError(llmCtx, err);
      onProviderError(provider.name);
      reject(err);
    });
    req.setTimeout(180000, () => { req.destroy(); const err = new Error('LLM 请求超时(180s)'); logger.logLLMError(llmCtx, err); reject(err); });
    req.write(body); req.end();
  });
}

// ============ 引擎计算 + AI 解读（使用 ai-service v3） ============

function calculateEngine(mode, profile, displayMode, ctxOptions) {
  const start = Date.now();
  try {
    const ctx = aiService.createContext(ctxOptions || {});
    const result = aiService.calculateAll(mode, profile, ctx, { displayMode: displayMode || 'simple', ...(ctxOptions || {}) });
    logger.logEngine(mode, profile, Date.now() - start, (result.engineData || '').length);
    return result;
  } catch(e) {
    logger.logEngineError(mode, e);
    throw e;
  }
}

async function handleDivination(mode, profile, question, displayMode, ctxOptions) {
  const req = aiService.buildRequest(mode, profile, question, {
    displayMode: displayMode || 'simple',
    ...(ctxOptions || {}),
  });

  // 安全过滤：被拦截的问题不调用LLM
  if (req.blocked) {
    logger.logSafety(question, 'blocked');
    return { mode, blocked: true, reason: req.reason, engineData: '', response: req.reason };
  }
  if (req.safetyLevel === 'sensitive') logger.logSafety(question, 'sensitive');
  logger.logEngine(mode, profile, 0, req.engineData.length);

  const response = await callLLM(req.systemPrompt, req.userMessage, mode);
  // Extract structured data for frontend visualization
  const structured = aiService.extractStructured(mode, profile);
  // Append disclaimer to all divination responses
  const finalResponse = response + (aiService.DIVINATION_DISCLAIMER || '');
  return { mode, displayMode: req.displayMode, category: req.category, safetyLevel: req.safetyLevel, engineData: req.engineData, context: req.context.fullStr, response: finalResponse, structured };
}

// ============ HTTP 服务器 ============

logger.info('SYSTEM', '服务器启动', { model: LLM_MODEL, baseUrl: LLM_BASE_URL, port: PORT });

// 监控面板HTML
const MONITOR_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>缘合 · 系统监控</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;background:#0a0a0f;color:#e0e0e0;padding:20px}
h1{color:#4ECDC4;margin-bottom:20px;font-size:20px}h2{color:#FFB347;margin:16px 0 8px;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.card{background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;padding:14px}
.card .label{font-size:11px;color:#888;text-transform:uppercase}.card .value{font-size:22px;font-weight:bold;color:#4ECDC4;margin-top:4px}
.card.warn .value{color:#FFB347}.card.error .value{color:#FF6B6B}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #1a1a2e}
th{color:#888;font-size:11px}tr:hover{background:#1a1a2e}
.log{font-size:11px;line-height:1.6;max-height:400px;overflow-y:auto;background:#0f0f1a;border-radius:8px;padding:12px;margin-top:8px}
.log .INFO{color:#4ECDC4}.log .WARN{color:#FFB347}.log .ERROR{color:#FF6B6B}.log .DEBUG{color:#666}
.refresh{background:#4ECDC4;color:#0a0a0f;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;margin-bottom:16px}
.refresh:hover{background:#3dbdb5}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold}
.badge.ok{background:#34D39930;color:#34D399}.badge.err{background:#FF6B6B30;color:#FF6B6B}
</style></head><body>
<h1>⚡ 缘合 · 系统监控</h1>
<button class="refresh" onclick="load()">🔄 刷新</button>
<span id="time" style="color:#666;font-size:12px;margin-left:12px"></span>
<div class="grid" id="cards"></div>
<h2>📡 API 端点统计</h2><table id="apiTable"><tr><th>端点</th><th>请求数</th><th>成功</th><th>失败</th><th>平均耗时</th></tr></table>
<h2>📝 最近日志</h2><div class="log" id="logs"></div>
<h2>⚠️ 最近错误</h2><div class="log" id="errors" style="border:1px solid #FF6B6B30"></div>
<script>
async function load(){
  const r=await fetch('/api/stats');const d=await r.json();
  document.getElementById('time').textContent='更新: '+new Date().toLocaleTimeString();
  document.getElementById('cards').innerHTML=
    card('运行时间',d.uptime)+card('总请求',d.requests.total)+card('成功率',d.requests.successRate,d.requests.error>0?'warn':'')+
    card('LLM调用',d.llm.calls)+card('LLM成功',d.llm.success)+card('LLM失败',d.llm.error,d.llm.error>0?'error':'')+
    card('LLM超时',d.llm.timeout,d.llm.timeout>0?'error':'')+card('输出截断',d.llm.truncated,d.llm.truncated>0?'warn':'')+
    card('LLM平均耗时',d.llm.avgTimeSeconds)+card('引擎调用',d.engine.calls)+card('引擎错误',d.engine.errors,d.engine.errors>0?'error':'')+
    card('内存',d.memory.heap+'/'+d.memory.rss);
  let apiHtml='<tr><th>端点</th><th>请求数</th><th>成功</th><th>失败</th><th>平均耗时</th></tr>';
  Object.entries(d.api).forEach(([ep,s])=>{const avg=s.count?Math.round(s.totalTime/s.count):0;
    apiHtml+='<tr><td>'+ep+'</td><td>'+s.count+'</td><td><span class="badge ok">'+s.success+'</span></td><td>'+(s.error?'<span class="badge err">'+s.error+'</span>':'-')+'</td><td>'+avg+'ms</td></tr>';});
  document.getElementById('apiTable').innerHTML=apiHtml;
  document.getElementById('logs').innerHTML=d.recentLogs.map(l=>'<div class="'+l.level+'"><b>['+l.time.substring(11)+']</b> ['+l.level+'] ['+l.category+'] '+l.message+(l.data?' <span style="color:#555">'+l.data+'</span>':'')+'</div>').join('');
  document.getElementById('errors').innerHTML=d.recentErrors.length?d.recentErrors.map(l=>'<div class="ERROR"><b>['+l.time+']</b> ['+l.category+'] '+l.message+(l.data?' | '+l.data:'')+'</div>').join(''):'<div style="color:#555">暂无错误 ✅</div>';
}
function card(label,value,cls){return '<div class="card '+(cls||'')+'"><div class="label">'+label+'</div><div class="value">'+value+'</div></div>';}
load();setInterval(load,10000);
</script></body></html>`;


const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // 请求日志
  const reqCtx = logger.logRequest(req, parsedUrl);
  const origEnd = res.end.bind(res);
  res.end = function(...args) { logger.logResponse(reqCtx, res.statusCode); return origEnd(...args); };

  // 系统监控API
  if (parsedUrl.pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(logger.getStats(), null, 2));
    return;
  }

  // 监控面板
  if (parsedUrl.pathname === '/monitor') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MONITOR_HTML);
    return;
  }

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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
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
  // API：匹配评分
  if (parsedUrl.pathname === '/api/match' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { profileA, profileB } = JSON.parse(body);
        const matching = require('./src/engines/matching');
        const result = matching.quickMatch(profileA, profileB);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：批量匹配（首页卡片）
  if (parsedUrl.pathname === '/api/batch-match' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { profile, candidates } = JSON.parse(body);
        const matching = require('./src/engines/matching');
        const results = matching.batchMatch(profile, candidates);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：今日运势
  if (parsedUrl.pathname === '/api/fortune' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const profile = JSON.parse(body);
        const matching = require('./src/engines/matching');
        const result = matching.todayFortune(profile);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：时辰校正
  if (parsedUrl.pathname === '/api/hour-correct' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { year, month, day, gender, answers } = JSON.parse(body);
        const hourCorrection = require('./src/engines/hour-correction');
        const result = hourCorrection.correctHour(parseInt(year), parseInt(month), parseInt(day), gender, answers);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：轻量追问（聊天气泡，非完整报告）
  if (parsedUrl.pathname === '/api/chat-followup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { mode, year, month, day, hour, gender, question, reportSummary, recentChat } = JSON.parse(body);
        if (!question || !question.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '请输入问题' }));
          return;
        }
        // Safety check — only block truly dangerous content, skip relevance check for follow-ups
        const safety = aiService.buildRequest(mode, {year,month,day,hour,gender}, question, {});
        if (safety.blocked && safety.safetyLevel === 'blocked') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ blocked: true, reason: safety.reason }));
          return;
        }
        // Build lightweight prompt
        const systemPrompt = `你是一位精通${mode==='bazi'?'八字命理':mode==='astrology'?'星座运势':mode==='tarot'?'塔罗牌':mode==='meihua'?'梅花易数':'命理'}的专家。
用户已经做过一次完整分析，现在在追问具体问题。

之前分析的核心摘要：
${(reportSummary || '').substring(0, 500)}

请基于以上分析背景，简要回答用户的追问。
要求：
- 直接回答，不需要章节标题或markdown格式
- 1-3段文字，简洁有力
- 结合命理术语但通俗易懂
- 最后给一句实用建议`;
        // Include recent chat for context
        let userMsg = question;
        if (recentChat && recentChat.length > 0) {
          const chatCtx = recentChat.slice(-6).map(c => `${c.role==='user'?'用户':'AI'}：${c.text.substring(0,100)}`).join('\n');
          userMsg = `最近的对话：\n${chatCtx}\n\n当前追问：${question}`;
        }
        const response = await callLLM(systemPrompt, userMsg, mode, 1500);
        const cleanResp = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ response: cleanResp }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：AI模拟聊天（LLM扮演匹配对象）
  if (parsedUrl.pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { partner, userProfile, message, history } = JSON.parse(body);
        if (!message || !message.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '请输入消息' }));
          return;
        }

        // Build character prompt from partner's profile
        const p = partner;
        const traits = p.tags ? p.tags.join('、') : '';
        const styleHint = p.chatStyle ? `\n\n你的说话风格：${p.chatStyle}` : '';
        const systemPrompt = `你现在扮演一个真实的人在社交App上和刚匹配的对象聊天。

你的人设：
- 姓名：${p.name}
- 年龄：${p.age}岁
- 性别：${p.gender === 'female' ? '女' : '男'}
- 星座：${p.sign || '未知'}
- 个人简介：${p.bio || ''}
- 兴趣爱好：${traits || '未知'}${styleHint}

聊天规则（必须严格遵守）：
1. 你是一个真实的人，不是AI，绝不能暴露自己是机器人
2. 回复要简短自然，像真人发微信一样，每条1-3句话，不超过80字
3. 要有个性和情感，不要客套敷衍
4. 根据你的兴趣爱好和说话风格来回复，保持人设一致
5. 适当用emoji但不要太多（0-2个）
6. 偶尔可以反问对方问题，保持对话互动
7. 不要用"亲""宝"等过于亲密的称呼（你们刚认识）
8. 语气要符合你的人设风格，不要千篇一律
9. 绝对不要说"作为AI"、"我是一个语言模型"等任何暴露身份的话`;

        // Build messages with history
        const messages = [{ role: 'system', content: systemPrompt }];
        // Add recent history (last 10 messages)
        const recentHistory = (history || []).slice(-10);
        for (const h of recentHistory) {
          messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
        }
        // Add current message
        messages.push({ role: 'user', content: message });

        // Call LLM with low max_tokens for short replies
        const chatProvider = getProvider();
        const apiUrl = `${chatProvider.url}/chat/completions`;
        const llmBody = JSON.stringify({
          model: chatProvider.model,
          messages,
          max_tokens: 200,
          temperature: 0.8,
          stream: false,
        });

        const parsed = new URL(apiUrl);
        const llmReq = (parsed.protocol === 'https:' ? require('https') : http).request({
          hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
          headers: anonLLMHeaders(Buffer.byteLength(llmBody), chatProvider.key),
        }, (llmRes) => {
          let data = '';
          llmRes.on('data', chunk => data += chunk);
          llmRes.on('end', () => {
            try {
              const json = JSON.parse(data);
              let reply = json.choices?.[0]?.message?.content || '';
              reply = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
              // Strip quotes if the model wraps response in quotes
              reply = reply.replace(/^["「]|["」]$/g, '').trim();
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ reply }));
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: 'AI回复解析失败' }));
            }
          });
        });
        llmReq.on('error', (e) => {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: e.message }));
        });
        llmReq.write(llmBody);
        llmReq.end();
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/calculate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { mode, year, month, day, hour, gender, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
        const data = calculateEngine(mode, profile, displayMode || 'simple', { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB });
        const structured = require('./src/ai-service').extractStructured(mode, profile);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ mode, displayMode: displayMode || 'simple', engineData: data, structured }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API：流式计算 + AI 解读（SSE）
  if (parsedUrl.pathname === '/api/divine-stream' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { mode, year, month, day, hour, gender, question, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
        const ctxOptions = { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox };

        const buildReq = aiService.buildRequest(mode, profile, question || '', { displayMode: displayMode || 'simple', ...ctxOptions });
        if (buildReq.blocked) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
          res.write(`data: ${JSON.stringify({type:'error',error:buildReq.reason})}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        // SSE headers
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

        // 1. Send engine data + structured immediately
        const structured = aiService.extractStructured(mode, profile);
        res.write(`data: ${JSON.stringify({type:'init',engineData:buildReq.engineData,structured,mode})}\n\n`);

        // 2. Stream LLM response
        const streamProvider = getProvider();
        const apiUrl = `${streamProvider.url}/chat/completions`;
        const llmBody = JSON.stringify({
          model: streamProvider.model,
          messages: [
            { role: 'system', content: buildReq.systemPrompt },
            { role: 'user', content: buildReq.userMessage },
          ],
          max_tokens: 6144, temperature: 0.5, stream: true,
        });

        const parsed = new URL(apiUrl);
        const llmReq = (parsed.protocol === 'https:' ? require('https') : http).request({
          hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
          headers: anonLLMHeaders(Buffer.byteLength(llmBody), streamProvider.key),
        }, (llmRes) => {
          let buf = '';
          llmRes.on('data', (chunk) => {
            buf += chunk.toString();
            const lines = buf.split('\n');
            buf = lines.pop(); // keep incomplete line
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                // Append disclaimer as final chunk
                res.write(`data: ${JSON.stringify({type:'chunk',text:aiService.DIVINATION_DISCLAIMER||''})}\n\n`);
                res.write(`data: [DONE]\n\n`);
                res.end();
                return;
              }
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  // Strip <think> tags in real-time
                  res.write(`data: ${JSON.stringify({type:'chunk',text:delta})}\n\n`);
                }
              } catch(e) {} // skip malformed
            }
          });
          llmRes.on('end', () => {
            // Process remaining buffer
            if (buf.trim()) {
              const trimmed = buf.trim();
              if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) res.write(`data: ${JSON.stringify({type:'chunk',text:delta})}\n\n`);
                } catch(e) {}
              }
            }
            res.write(`data: ${JSON.stringify({type:'chunk',text:aiService.DIVINATION_DISCLAIMER||''})}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
          });
        });
        llmReq.on('error', (e) => {
          res.write(`data: ${JSON.stringify({type:'error',error:e.message})}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        });
        llmReq.write(llmBody);
        llmReq.end();
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({type:'error',error:e.message})}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
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
        const { mode, year, month, day, hour, gender, question, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox, context } = JSON.parse(body);
        const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
        const ctxOptions = { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox };
        // 追问上下文：把之前的分析摘要拼入问题
        let fullQuestion = question || '';
        if (context && context.trim()) {
          fullQuestion = `[追问上下文] 之前的分析摘要：\n${context.substring(0, 800)}\n\n[当前追问] ${fullQuestion}`;
        }
        // 空问题或默认问题 → 全面分析；有具体问题 → 聚焦分析
        const result = await handleDivination(mode, profile, fullQuestion, displayMode || 'simple', ctxOptions);
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
║  📊 系统监控: http://localhost:${PORT}/monitor║
║                                          ║
║  🤖 LLM 地址: ${LLM_BASE_URL.padEnd(25)}║
║  📦 模型:     ${LLM_MODEL.padEnd(25)}║
║                                          ║
║  📡 API 接口:                             ║
║  GET  /api/health    - 健康检查           ║
║  POST /api/calculate - 仅引擎计算         ║
║  POST /api/divine    - 引擎+AI解读        ║
║  POST /api/chat-followup - 轻量追问       ║
║  POST /api/chat          - AI模拟聊天     ║
║                                          ║
╚══════════════════════════════════════════╝
`);
});
