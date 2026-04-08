/**
 * 缘合 YuanHe — 服务器
 * 命理引擎 + MiniMax LLM + 前端服务
 *
 * 启动方式：
 *   1. npm install （首次）
 *   2. 配置 .env 文件
 *   3. node server.js
 *   4. 浏览器打开 http://localhost:3000/app
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

const configManager = require('./src/config-manager');

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://127.0.0.1:8080/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || 'ollama';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-r1:1.5b';
const PORT = parseInt(process.env.SERVER_PORT) || 3000;

// ============ LLM Provider Manager (动态管理) ============

const providerErrors = {}; // track consecutive errors per provider

// 获取所有providers: 优先config中的动态配置，兜底env vars
function getAllProviders() {
  const raw = configManager.get('llm.providers');
  const cfgProviders = Array.isArray(raw) ? raw : [];
  if (cfgProviders.length > 0) {
    return cfgProviders.filter(p => p.enabled !== false);
  }
  // 兜底: 从env构建
  const envProviders = [
    { id:'env_primary', name:'primary', url:LLM_BASE_URL, key:LLM_API_KEY, model:LLM_MODEL, enabled:true },
    process.env.LLM_BACKUP_URL ? { id:'env_backup', name:'backup', url:process.env.LLM_BACKUP_URL, key:process.env.LLM_BACKUP_KEY||LLM_API_KEY, model:process.env.LLM_BACKUP_MODEL||LLM_MODEL, enabled:true } : null,
    process.env.LLM_FALLBACK_URL ? { id:'env_fallback', name:'fallback', url:process.env.LLM_FALLBACK_URL, key:process.env.LLM_FALLBACK_KEY||LLM_API_KEY, model:process.env.LLM_FALLBACK_MODEL||LLM_MODEL, enabled:true } : null,
  ].filter(Boolean);
  return envProviders;
}

function getActiveProviderIndex() {
  return configManager.get('llm.activeIndex') || 0;
}

function getProvider() {
  const providers = getAllProviders();
  if (providers.length === 0) return { name:'none', url:LLM_BASE_URL, key:LLM_API_KEY, model:LLM_MODEL, index:0 };
  const activeIdx = getActiveProviderIndex();
  for (let i = 0; i < providers.length; i++) {
    const idx = (activeIdx + i) % providers.length;
    const p = providers[idx];
    if ((providerErrors[p.id||p.name] || 0) < 3) return { ...p, index: idx };
  }
  Object.keys(providerErrors).forEach(k => providerErrors[k] = 0);
  return { ...providers[0], index: 0 };
}

function onProviderSuccess(name) { providerErrors[name] = 0; }
function onProviderError(name) {
  providerErrors[name] = (providerErrors[name] || 0) + 1;
  const providers = getAllProviders();
  if (providerErrors[name] >= 3 && providers.length > 1) {
    const oldIdx = providers.findIndex(p => (p.id||p.name) === name);
    const newIdx = (oldIdx + 1) % providers.length;
    configManager.set('llm.activeIndex', newIdx);
    logger.warn('LLM', `${name}连续失败${providerErrors[name]}次，切换到${providers[newIdx].name}`);
  }
}

function getLLMParams() {
  return configManager.get('llm.defaultParams') || { temperature: 0.5, maxTokens: 6144, timeout: 180000 };
}

// 引入新的 AI 服务
const aiService = require('./src/ai-service');
const logger = require('./src/logger');
const auth = require('./src/auth');
const admin = require('./src/admin');
admin.setSecret(auth.JWT_SECRET);

// ============ LLM 调用 ============

async function callLLM(systemPrompt, userMessage, mode = '', maxTokens) {
  const provider = getProvider();
  if (!provider.url || !provider.key || provider.key === 'ollama') {
    throw new Error('未配置有效的LLM服务商，请在后台管理中添加Provider并填写API Key');
  }
  const params = getLLMParams();
  const apiUrl = `${provider.url}/chat/completions`;
  const llmCtx = logger.logLLMStart(mode, systemPrompt.length, userMessage.length);
  const actualMaxTokens = maxTokens || params.maxTokens || 6144;
  const timeout = params.timeout || 180000;

  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: actualMaxTokens,
    temperature: params.temperature ?? 0.5,
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
            let content = json.choices[0].message?.content || '';
            const finishReason = json.choices[0].finish_reason;
            const result = logger.logLLMSuccess(llmCtx, content.length, finishReason, res.statusCode);
            onProviderSuccess(provider.id || provider.name);
            if (finishReason === 'length') {
              content += '\n\n---\n⚠️ *AI输出因长度限制被截断，以上为部分内容。可输入具体问题获取更聚焦的分析。*';
            }
            // Strip <think> reasoning tags from AI response
            const original = content;
            content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            // If stripping removed everything, keep think content as fallback
            if (!content && original.length > 10) {
              const m = original.match(/<think>([\s\S]*?)<\/think>/);
              content = m ? '💭 **AI思考过程**\n\n' + m[1].trim() + '\n\n---\n⚠️ *模型仅输出了思考内容。请重试。*' : original;
            }
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
      onProviderError(provider.id || provider.name);
      reject(err);
    });
    req.setTimeout(timeout, () => { req.destroy(); const err = new Error(`LLM 请求超时(${Math.round(timeout/1000)}s)`); logger.logLLMError(llmCtx, err); reject(err); });
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
  const finalResponse = response + (aiService.getDisclaimer(req.lang) || '');
  return { mode, displayMode: req.displayMode, category: req.category, safetyLevel: req.safetyLevel, engineData: req.engineData, context: req.context.fullStr, response: finalResponse, structured };
}

// ============ 监控面板 HTML ============

logger.info('SYSTEM', '服务器启动', { model: LLM_MODEL, baseUrl: LLM_BASE_URL, port: PORT });

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

// ============ Express App Setup ============

const app = express();

// Middleware
app.use(compression({filter:(req,res)=>{
  // SSE和streaming请求不压缩(否则会缓冲整个响应)
  if(req.headers.accept==='text/event-stream')return false;
  if(req.url.includes('divine-stream'))return false;
  if(req.url.includes('chat-followup'))return false;
  return compression.filter(req,res);
}}));
app.use(helmet({
  contentSecurityPolicy: false, // app.html loads CDN scripts (React, Babel, marked)
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting — protect LLM endpoints from abuse
const apiLimiter = rateLimit({ windowMs: 60*1000, max: 60, message: { error: '请求太频繁，请稍后再试' } });
const llmLimiter = rateLimit({ windowMs: 60*1000, max: 10, message: { error: 'AI请求太频繁，请稍后再试' } });
const adminLimiter = rateLimit({ windowMs: 60*1000, max: 200, message: { error: '请求太频繁' } });
app.use('/api/divine', llmLimiter);
app.use('/api/divine-stream', llmLimiter);
app.use('/api/chat', llmLimiter);
app.use('/api/chat-followup', llmLimiter);
app.use('/api/admin/', adminLimiter); // 管理后台更高限额（放在apiLimiter之前）
app.use('/api/', apiLimiter);

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// Request/response logging
app.use((req, res, next) => {
  const parsedUrl = require('url').parse(req.url, true);
  const reqCtx = logger.logRequest(req, parsedUrl);
  const origEnd = res.end.bind(res);
  res.end = function(...args) { logger.logResponse(reqCtx, res.statusCode); return origEnd(...args); };
  next();
});

// ============ Admin Routes ============

// 管理后台页面
app.get('/admin', (req, res) => {
  res.type('text/html; charset=utf-8').send(cachedAdminHtml);
});

// 管理员登录
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const result = admin.login(username, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

// 修改密码
app.post('/api/admin/change-password', admin.adminAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const result = admin.changePassword(req.admin.id, oldPassword, newPassword);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// 管理员列表 (superadmin only)
app.get('/api/admin/list', admin.adminAuth, admin.superOnly, (req, res) => {
  res.json(admin.listAdmins());
});

// 创建管理员 (superadmin only)
app.post('/api/admin/create', admin.adminAuth, admin.superOnly, (req, res) => {
  const result = admin.createAdmin(req.admin.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// 操作日志
app.get('/api/admin/logs', admin.adminAuth, (req, res) => {
  const { limit, action, adminId, search, page } = req.query;
  res.json(admin.getAdminLogs(parseInt(limit) || 50, { action, adminId, search, page: parseInt(page) || 1 }));
});

app.get('/api/admin/log-types', admin.adminAuth, (req, res) => {
  res.json(admin.getLogActionTypes());
});

// ============ Admin: Chat Management ============

app.get('/api/admin/conversations', admin.adminAuth, (req, res) => {
  const { search, page, limit } = req.query;
  res.json(auth.adminListConversations({ search, page: parseInt(page) || 1, limit: parseInt(limit) || 20 }));
});

app.get('/api/admin/conversations/:key', admin.adminAuth, (req, res) => {
  const data = auth.adminGetConversation(req.params.key, parseInt(req.query.limit) || 100);
  res.json(data);
});

app.post('/api/admin/conversations/:key/delete-message', admin.adminAuth, (req, res) => {
  const result = auth.adminDeleteMessage(req.params.key, req.body.messageId);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'delete_message', req.params.key, `删除消息: ${req.body.messageId}`);
  res.json(result);
});

// 敏感词管理
app.get('/api/admin/sensitive-words', admin.adminAuth, (req, res) => {
  res.json(auth.getSensitiveWords());
});

app.post('/api/admin/sensitive-words', admin.adminAuth, (req, res) => {
  const result = auth.setSensitiveWords(req.body.words || []);
  admin.logAction(req.admin.id, 'update_sensitive_words', null, `更新敏感词: ${result.count}个`);
  res.json(result);
});

// ============ Admin: Content Review ============

app.get('/api/admin/posts', admin.adminAuth, (req, res) => {
  res.json(auth.adminListPosts({ search: req.query.search, page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 20 }));
});

app.post('/api/admin/posts/:id/delete', admin.adminAuth, (req, res) => {
  const result = auth.adminDeletePost(req.params.id);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'delete_post', req.params.id, '删除帖子');
  res.json(result);
});

app.post('/api/admin/posts/:id/pin', admin.adminAuth, (req, res) => {
  const result = auth.adminPinPost(req.params.id, req.body.pinned !== false);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'pin_post', req.params.id, req.body.pinned !== false ? '置顶帖子' : '取消置顶');
  res.json(result);
});

// 举报
app.post('/api/report', auth.optionalAuth, (req, res) => {
  const userId = req.user?.id || 'anonymous';
  const result = auth.submitReport(userId, req.body);
  res.json(result);
});

app.get('/api/admin/reports', admin.adminAuth, (req, res) => {
  res.json(auth.adminListReports({ status: req.query.status, page: parseInt(req.query.page) || 1 }));
});

app.post('/api/admin/reports/:id/resolve', admin.adminAuth, (req, res) => {
  const result = auth.adminResolveReport(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'resolve_report', req.params.id, `处理举报: ${req.body.status} - ${req.body.resolution || ''}`);
  res.json(result);
});

// ============ Admin: VIP & Revenue ============

const vipManager = require('./src/vip-manager');

// VIP等级定义
app.get('/api/admin/vip-tiers', admin.adminAuth, (req, res) => {
  res.json(vipManager.VIP_TIERS);
});

// 赠送VIP
app.post('/api/admin/vip/grant', admin.adminAuth, (req, res) => {
  const { userId, tier, days } = req.body;
  const users = require('./src/auth');
  const result = vipManager.grantVip(users._users || {}, userId, tier, parseInt(days) || 30, req.admin.username);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'grant_vip', userId, `赠送${result.order?.tierName} ${days||'永久'}天`);
  // 保存用户数据
  users._saveUsers && users._saveUsers();
  res.json(result);
});

// 撤销VIP
app.post('/api/admin/vip/revoke', admin.adminAuth, (req, res) => {
  const users = require('./src/auth');
  const result = vipManager.revokeVip(users._users || {}, req.body.userId);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'revoke_vip', req.body.userId, '撤销VIP');
  users._saveUsers && users._saveUsers();
  res.json(result);
});

// 订单列表
app.get('/api/admin/orders', admin.adminAuth, (req, res) => {
  res.json(vipManager.getOrders({ page: parseInt(req.query.page) || 1, status: req.query.status }));
});

// 收入统计
app.get('/api/admin/revenue', admin.adminAuth, (req, res) => {
  res.json(vipManager.getRevenueStats());
});

// 不活跃用户
app.get('/api/admin/inactive-users', admin.adminAuth, (req, res) => {
  const users = require('./src/auth');
  res.json(vipManager.getInactiveUsers(users._users || {}, parseInt(req.query.days) || 7, parseInt(req.query.limit) || 50));
});

// ============ Admin: Bot Management ============

const botManager = require('./src/bot-manager');

app.get('/api/admin/bots', admin.adminAuth, (req, res) => {
  res.json(botManager.getAll());
});

app.post('/api/admin/bots', admin.adminAuth, (req, res) => {
  const bot = botManager.create(req.body);
  admin.logAction(req.admin.id, 'create_bot', bot.id, `创建Bot: ${bot.name}`);
  res.json(bot);
});

app.post('/api/admin/bots/:id/update', admin.adminAuth, (req, res) => {
  const result = botManager.update(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'update_bot', req.params.id, `编辑Bot: ${result.name}`);
  res.json(result);
});

app.post('/api/admin/bots/:id/toggle', admin.adminAuth, (req, res) => {
  const result = botManager.toggle(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin/bots/:id/delete', admin.adminAuth, (req, res) => {
  const result = botManager.remove(req.params.id);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'delete_bot', req.params.id, '删除Bot');
  res.json(result);
});

// ============ Admin: System Config ============

// 获取全部配置
app.get('/api/admin/config', admin.adminAuth, (req, res) => {
  res.json(configManager.getAll());
});

// 更新配置(patch)
app.post('/api/admin/config', admin.adminAuth, (req, res) => {
  const result = configManager.update(req.body);
  const safeBody = JSON.parse(JSON.stringify(req.body));
  if (safeBody.llm) { const ps = safeBody.llm.providers; if (Array.isArray(ps)) ps.forEach(p => { if (p.key) p.key = p.key.substring(0, 4) + '***'; }); }
  admin.logAction(req.admin.id, 'update_config', null, `更新配置: ${JSON.stringify(safeBody).substring(0, 200)}`);
  res.json(result);
});

// 维护模式检查(前端用)
app.get('/api/status', (req, res) => {
  const cfg = configManager.getAll();
  res.json({ maintenance: cfg.maintenance.enabled, message: cfg.maintenance.message });
});

// AI输出质量抽查 — 最近N条占卜结果(优化：直接遍历用户数据，不调用重量级adminGetUser)
app.get('/api/admin/ai-samples', admin.adminAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const modeFilter = req.query.mode || '';
  const samples = auth.adminGetDivinationSamples({ mode: modeFilter });
  const total = samples.length;
  const start = (page - 1) * limit;
  res.json({ items: samples.slice(start, start + limit), total, page, limit });
});

// 获取单条占卜完整内容
app.get('/api/admin/ai-samples/:userId/:divId', admin.adminAuth, (req, res) => {
  const fullDetail = auth.adminGetUserDivination(req.params.userId, req.params.divId);
  if (!fullDetail) return res.status(404).json({ error: '记录不存在' });
  res.json(fullDetail);
});

// ============ Admin: LLM Config ============

// ============ Admin: LLM管理 ============

app.get('/api/admin/llm-config', admin.adminAuth, (req, res) => {
  const providers = getAllProviders();
  const allCfgProviders = configManager.get('llm.providers') || [];
  res.json({
    providers: providers.map(p => ({ id:p.id, name:p.name, url:p.url, key:p.key||'', model:p.model, enabled:p.enabled!==false, hasKey:!!(p.key&&p.key.trim()) })),
    allProviders: allCfgProviders.map(p => ({ id:p.id, name:p.name, url:p.url, key:p.key||'', model:p.model, enabled:p.enabled!==false, hasKey:!!(p.key&&p.key.trim()) })),
    activeIndex: getActiveProviderIndex(),
    providerErrors,
    params: getLLMParams(),
    envDefaults: { url:LLM_BASE_URL, model:LLM_MODEL, hasKey:!!process.env.LLM_API_KEY },
  });
});

// 添加provider
app.post('/api/admin/llm/providers', admin.adminAuth, (req, res) => {
  const { name, url, key, model } = req.body;
  if (!name || !url || !model) return res.status(400).json({ error: '名称/URL/模型必填' });
  const providers = configManager.get('llm.providers') || [];
  const id = 'llm_' + Date.now().toString(36);
  providers.push({ id, name, url, key: key || '', model, enabled: true, createdAt: new Date().toISOString() });
  configManager.set('llm.providers', providers);
  // 如果是第一个provider，自动激活
  if (providers.filter(p => p.enabled).length === 1) configManager.set('llm.activeIndex', 0);
  admin.logAction(req.admin.id, 'add_llm_provider', id, `添加LLM: ${name} (${model})`);
  res.json({ success: true, id });
});

// 更新provider
app.post('/api/admin/llm/providers/:id', admin.adminAuth, (req, res) => {
  const providers = configManager.get('llm.providers') || [];
  const idx = providers.findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Provider不存在' });
  const { name, url, key, model, enabled } = req.body;
  if (name !== undefined) providers[idx].name = name;
  if (url !== undefined) providers[idx].url = url;
  if (key !== undefined) providers[idx].key = key;
  if (model !== undefined) providers[idx].model = model;
  if (enabled !== undefined) providers[idx].enabled = enabled;
  configManager.set('llm.providers', providers);
  admin.logAction(req.admin.id, 'update_llm_provider', req.params.id, `更新LLM: ${providers[idx].name}`);
  res.json({ success: true });
});

// 删除provider
app.post('/api/admin/llm/providers/:id/delete', admin.adminAuth, (req, res) => {
  let providers = configManager.get('llm.providers') || [];
  const idx = providers.findIndex(p => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Provider不存在' });
  const name = providers[idx].name;
  providers.splice(idx, 1);
  configManager.set('llm.providers', providers);
  // 如果删除的是active的，重置
  const activeIdx = getActiveProviderIndex();
  if (activeIdx >= providers.length) configManager.set('llm.activeIndex', 0);
  admin.logAction(req.admin.id, 'delete_llm_provider', req.params.id, `删除LLM: ${name}`);
  res.json({ success: true });
});

// 切换active provider
app.post('/api/admin/llm/switch', admin.adminAuth, (req, res) => {
  const { index } = req.body;
  const providers = getAllProviders();
  if (index < 0 || index >= providers.length) return res.status(400).json({ error: '无效索引' });
  configManager.set('llm.activeIndex', index);
  // 清除该provider的错误计数
  const p = providers[index];
  providerErrors[p.id||p.name] = 0;
  admin.logAction(req.admin.id, 'switch_llm', null, `切换LLM到: ${p.name} (${p.model})`);
  res.json({ success: true, provider: { name:p.name, model:p.model } });
});

// 测试provider连通性
app.post('/api/admin/llm/test', admin.adminAuth, async (req, res) => {
  const { url, key, model, providerId } = req.body;
  if (!url || !model) return res.status(400).json({ error: 'URL和模型必填' });
  // 如果没传key,尝试从已存储的provider中查找
  let actualKey = key;
  if (!actualKey && providerId) {
    const stored = (configManager.get('llm.providers') || []).find(p => p.id === providerId);
    if (stored) actualKey = stored.key;
  }
  if (!actualKey) actualKey = LLM_API_KEY; // fallback to env
  if (!actualKey || actualKey === 'YOUR_API_KEY_HERE' || actualKey === 'ollama') {
    return res.json({ ok: false, error: 'API Key未配置。请在编辑Provider时填写有效的API Key。', time: 0 });
  }
  const apiUrl = `${url}/chat/completions`;
  const testBody = JSON.stringify({
    model, messages:[{role:'user',content:'你好，请回复"连接成功"四个字'}],
    max_tokens:200, temperature:0.1, stream:false,
  });
  const start = Date.now();
  try {
    const parsed = new URL(apiUrl);
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname:parsed.hostname, port:parsed.port, path:parsed.pathname, method:'POST',
        headers: anonLLMHeaders(Buffer.byteLength(testBody), actualKey),
      };
      const req = (parsed.protocol==='https:'?require('https'):http).request(options, (resp)=>{
        let data=''; resp.on('data',c=>data+=c);
        resp.on('end',()=>{
          try {
            const json=JSON.parse(data);
            if(json.choices?.[0]){let reply=json.choices[0].message?.content||'';reply=reply.replace(/<think>[\s\S]*?<\/think>/g,'').trim();if(!reply&&json.choices[0].message?.content)reply='[thinking model - response OK]';resolve({ok:true,reply,time:Date.now()-start,status:resp.statusCode})}
            else if(json.error) resolve({ok:false,error:json.error.message||JSON.stringify(json.error),time:Date.now()-start});
            else resolve({ok:false,error:`状态码${resp.statusCode}: ${data.substring(0,200)}`,time:Date.now()-start});
          } catch(e){ resolve({ok:false,error:`非JSON响应: ${data.substring(0,200)}`,time:Date.now()-start}); }
        });
      });
      req.on('error',e=>resolve({ok:false,error:e.message,time:Date.now()-start}));
      req.setTimeout(15000,()=>{req.destroy();resolve({ok:false,error:'连接超时(15s)',time:Date.now()-start})});
      req.write(testBody);req.end();
    });
    res.json(result);
  } catch(e) { res.json({ok:false,error:e.message,time:Date.now()-start}); }
});

// 更新LLM默认参数
app.post('/api/admin/llm/params', admin.adminAuth, (req, res) => {
  const { temperature, maxTokens, timeout } = req.body;
  const params = getLLMParams();
  if (temperature !== undefined) params.temperature = parseFloat(temperature);
  if (maxTokens !== undefined) params.maxTokens = parseInt(maxTokens);
  if (timeout !== undefined) params.timeout = parseInt(timeout);
  configManager.set('llm.defaultParams', params);
  admin.logAction(req.admin.id, 'update_llm_params', null, `更新LLM参数: temp=${params.temperature},tokens=${params.maxTokens}`);
  res.json({ success: true, params });
});

// 重置provider错误计数
app.post('/api/admin/llm/reset-errors', admin.adminAuth, (req, res) => {
  Object.keys(providerErrors).forEach(k => providerErrors[k] = 0);
  res.json({ success: true });
});

// ============ Admin: User Management ============

app.get('/api/admin/stats', admin.adminAuth, (req, res) => {
  res.json(auth.adminGetStats());
});

app.get('/api/admin/trends', admin.adminAuth, (req, res) => {
  res.json(auth.adminGetTrends(parseInt(req.query.days) || 30));
});

app.get('/api/admin/funnel', admin.adminAuth, (req, res) => {
  res.json(auth.adminGetFunnel());
});

// 系统公告管理
app.get('/api/admin/announcement', admin.adminAuth, (req, res) => {
  res.json(configManager.get('announcement') || { text: '', enabled: false });
});

app.post('/api/admin/announcement', admin.adminAuth, (req, res) => {
  configManager.set('announcement', req.body);
  admin.logAction(req.admin.id, 'update_announcement', null, req.body.enabled ? '发布公告: ' + (req.body.text || '').substring(0, 50) : '关闭公告');
  res.json({ success: true });
});

// 前端获取公告
app.get('/api/announcement', (req, res) => {
  const a = configManager.get('announcement');
  if (a && a.enabled && a.text) res.json({ text: a.text, type: a.type || 'info' });
  else res.json(null);
});

app.get('/api/admin/users', admin.adminAuth, (req, res) => {
  const { search, gender, page, limit, status, vip, sort, tag } = req.query;
  res.json(auth.adminListUsers({ search, gender, status, vip, sort, tag, page: parseInt(page) || 1, limit: parseInt(limit) || 20 }));
});

// Export & tags must be before :id route
app.get('/api/admin/users/export', admin.adminAuth, (req, res) => {
  const { search, gender, status, vip, tag } = req.query;
  const rows = auth.adminExportUsers({ search, gender, status, vip, tag });
  if (rows.length === 0) return res.json({ error: '无匹配用户' });
  if (rows.length > 10000) return res.status(400).json({ error: `数据量过大(${rows.length}条)，请添加筛选条件缩小范围` });
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h]+'').replace(/"/g,'""')}"`).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
  admin.logAction(req.admin.id, 'export_users', null, `导出${rows.length}条用户数据`);
  res.send('\uFEFF' + csv);
});

app.get('/api/admin/users/tags', admin.adminAuth, (req, res) => {
  res.json(auth.adminGetAllTags());
});

// Batch operations must be before :id route
app.post('/api/admin/users/batch/ban', admin.adminAuth, (req, res) => {
  const { userIds, ban, reason, days } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: '请选择用户' });
  const result = auth.adminBatchBan(userIds, { ban, reason, days });
  admin.logAction(req.admin.id, ban ? 'batch_ban' : 'batch_unban', null, `批量${ban?'封禁':'解封'} ${result.count}个用户`);
  res.json(result);
});

app.get('/api/admin/users/:id', admin.adminAuth, (req, res) => {
  const user = auth.adminGetUser(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

app.post('/api/admin/users/:id/update', admin.adminAuth, (req, res) => {
  const result = auth.adminUpdateUser(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'update_user', req.params.id, `编辑用户: ${Object.keys(req.body).join(',')}`);
  res.json(result);
});

app.post('/api/admin/users/:id/ban', admin.adminAuth, (req, res) => {
  const result = auth.adminBanUser(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, req.body.ban ? 'ban_user' : 'unban_user', req.params.id, req.body.ban ? `封禁: ${req.body.reason || '违规'} ${req.body.days ? req.body.days + '天' : '永久'}` : '解封');
  res.json(result);
});

app.post('/api/admin/users/:id/delete', admin.adminAuth, admin.superOnly, (req, res) => {
  const result = auth.adminDeleteUser(req.params.id);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'delete_user', req.params.id, '删除用户(软删除)');
  res.json(result);
});

// User tags
app.post('/api/admin/users/:id/tags', admin.adminAuth, (req, res) => {
  const result = auth.adminSetUserTags(req.params.id, req.body.tags);
  if (result.error) return res.status(400).json(result);
  admin.logAction(req.admin.id, 'set_tags', req.params.id, `设置标签: ${(req.body.tags||[]).join(',')}`);
  res.json(result);
});

// ============ Auth Routes ============

// 发送验证码
app.post('/api/auth/send-code', async (req, res) => {
  const { phone } = req.body;
  const result = await auth.sendCode(phone);
  res.status(result.code || 200).json(result);
});

// 验证码登录/注册
app.post('/api/auth/verify', (req, res) => {
  const { phone, code } = req.body;
  const result = auth.verifyCode(phone, code);
  res.status(result.code || 200).json(result);
});

// 获取当前用户信息
app.get('/api/auth/me', auth.authMiddleware, (req, res) => {
  const profile = auth.getProfile(req.user.id);
  res.json(profile);
});

// 更新用户资料
app.post('/api/auth/profile', auth.authMiddleware, (req, res) => {
  const result = auth.updateProfile(req.user.id, req.body);
  if (!result) return res.status(404).json({ error: '用户不存在' });
  res.json(result);
});

// 迁移本地数据到服务器
app.post('/api/auth/migrate', auth.authMiddleware, (req, res) => {
  const result = auth.migrateLocalData(req.user.id, req.body);
  if (!result) return res.status(404).json({ error: '用户不存在' });
  res.json(result);
});

// 保存占卜结果
app.post('/api/auth/divination', auth.authMiddleware, (req, res) => {
  const { mode, question, response, structured, engineData, depth } = req.body;
  const result = auth.saveDivination(req.user.id, { mode, question, response, structured, engineData, depth });
  if (!result) return res.status(404).json({ error: '保存失败' });
  res.json(result);
});

// 追加占卜追问记录
app.post('/api/auth/divination/:id/chat', auth.authMiddleware, (req, res) => {
  const { messages } = req.body;
  const result = auth.appendDivinationChat(req.user.id, req.params.id, messages);
  if (!result) return res.status(404).json({ error: '记录不存在' });
  res.json(result);
});

// 获取占卜历史
app.get('/api/auth/divinations', auth.authMiddleware, (req, res) => {
  const list = auth.getDivinations(req.user.id, req.query.mode);
  res.json(list);
});

// ============ User Data Sync ============

app.post('/api/auth/blacklist', auth.authMiddleware, (req, res) => {
  res.json(auth.syncBlacklist(req.user.id, req.body.blacklist));
});

app.get('/api/auth/blacklist', auth.authMiddleware, (req, res) => {
  res.json(auth.getBlacklist(req.user.id));
});

app.post('/api/auth/favorites', auth.authMiddleware, (req, res) => {
  res.json(auth.syncFavorites(req.user.id, req.body.favorites));
});

app.get('/api/auth/favorites', auth.authMiddleware, (req, res) => {
  res.json(auth.getFavorites(req.user.id));
});

// ============ Matching ============

// 获取候选用户
app.get('/api/candidates', auth.authMiddleware, (req, res) => {
  const candidates = auth.getCandidates(req.user.id, req.query.gender, parseInt(req.query.limit) || 20);
  res.json(candidates);
});

// 记录滑动
app.post('/api/swipe', auth.authMiddleware, (req, res) => {
  const { targetId, direction } = req.body;
  if (!targetId || !['left', 'right'].includes(direction)) {
    return res.status(400).json({ error: '参数错误' });
  }
  const result = auth.recordSwipe(req.user.id, targetId, direction);
  res.json(result);
});

// 获取匹配列表
app.get('/api/matches', auth.authMiddleware, (req, res) => {
  const matches = auth.getMatches(req.user.id);
  res.json(matches);
});

// ============ Friend Requests ============

app.post('/api/friends/request', auth.authMiddleware, (req, res) => {
  const { toId, message } = req.body;
  if (!toId) return res.status(400).json({ error: '缺少目标用户' });
  const result = auth.sendFriendRequest(req.user.id, toId, message);
  if (result.error) return res.status(400).json(result);
  // 通过WebSocket通知对方
  const wsModule = require('./src/websocket');
  wsModule.sendToUser(toId, { type: 'friend_request', request: result.request });
  res.json(result);
});

app.post('/api/friends/respond', auth.authMiddleware, (req, res) => {
  const { requestId, accept } = req.body;
  const result = auth.respondFriendRequest(requestId, req.user.id, accept);
  if (result.error) return res.status(400).json(result);
  // 通知发送方
  if (result.status === 'accepted') {
    const wsModule = require('./src/websocket');
    wsModule.sendToUser(result.from, { type: 'friend_accepted', from: req.user.id });
  }
  res.json(result);
});

app.get('/api/friends/pending', auth.authMiddleware, (req, res) => {
  res.json(auth.getPendingRequests(req.user.id));
});

app.get('/api/friends', auth.authMiddleware, (req, res) => {
  res.json(auth.getFriends(req.user.id));
});

// ============ Routes ============

// 系统监控API
app.get('/api/stats', (req, res) => {
  res.type('application/json; charset=utf-8').json(logger.getStats());
});

// 监控面板
app.get('/monitor', (req, res) => {
  res.type('text/html; charset=utf-8').send(MONITOR_HTML);
});

// 静态文件：测试页面
app.get(['/', '/index.html'], (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'test-page.html'), 'utf-8');
  res.type('text/html; charset=utf-8').send(html);
});

// 缘合App（测试版）
app.get('/app', (req, res) => {
  const html = cachedAppHtml;
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }).send(html);
});

// API：健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    llm: { baseUrl: LLM_BASE_URL, model: LLM_MODEL },
    engines: ['bazi', 'astrology', 'tarot', 'meihua', 'vedic'],
  });
});

// API：塔罗牌组（前端用于展示选牌界面）
app.get('/api/tarot/deck', (req, res) => {
  const tarotDeck = require('./src/engines/tarot').DECK;
  res.type('application/json; charset=utf-8').json(tarotDeck.map(c => ({ id: c.id, zh: c.zh, en: c.en, type: c.type })));
});

// API：公历→农历转换
app.get('/api/lunar', (req, res) => {
  const params = req.query || {};
  try {
    const { Solar } = require('lunar-javascript');
    const y = parseInt(params.year) || 2000, m = parseInt(params.month) || 1, d = parseInt(params.day) || 1, h = parseInt(params.hour) || 12;
    const solar = Solar.fromYmdHms(y, m, d, h, 0, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    res.type('application/json; charset=utf-8').json({
      solar: `${y}年${m}月${d}日`,
      lunar: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      lunarFull: `农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getYearShengXiao()}年`,
      ganzhi: `${ec.getYear()} ${ec.getMonth()} ${ec.getDay()} ${ec.getTime()}`,
      shengxiao: lunar.getYearShengXiao(),
      yearGanzhi: ec.getYear(),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API：匹配评分
app.post('/api/match', (req, res) => {
  try {
    const { profileA, profileB, lang } = req.body;
    const matching = require('./src/engines/matching');
    const result = matching.localizeResult(matching.quickMatch(profileA, profileB), lang);
    res.type('application/json; charset=utf-8').json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API：批量匹配（首页卡片）
app.post('/api/batch-match', (req, res) => {
  try {
    const { profile, candidates, lang } = req.body;
    const matching = require('./src/engines/matching');
    const results = matching.batchMatch(profile, candidates).map(r => ({
      ...r, matchResult: matching.localizeResult(r.matchResult, lang),
    }));
    res.type('application/json; charset=utf-8').json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API：今日运势
app.post('/api/fortune', (req, res) => {
  try {
    const { lang, ...profile } = req.body;
    const matching = require('./src/engines/matching');
    const result = matching.localizeResult(matching.todayFortune(profile), lang);
    res.type('application/json; charset=utf-8').json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API：时辰校正
app.post('/api/hour-correct', (req, res) => {
  try {
    const { year, month, day, gender, answers } = req.body;
    const hourCorrection = require('./src/engines/hour-correction');
    const result = hourCorrection.correctHour(parseInt(year), parseInt(month), parseInt(day), gender, answers);
    res.type('application/json; charset=utf-8').json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API：轻量追问（聊天气泡，非完整报告）
app.post('/api/chat-followup', async (req, res) => {
  try {
    const { mode, year, month, day, hour, gender, question, reportSummary, recentChat, profileB } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: '请输入问题' });
    }
    // Safety check — only block truly dangerous content, skip relevance check for follow-ups
    const safety = aiService.buildRequest(mode, {year,month,day,hour,gender}, question, {});
    if (safety.blocked && safety.safetyLevel === 'blocked') {
      return res.type('application/json; charset=utf-8').json({ blocked: true, reason: safety.reason });
    }
    const MODE_NAMES={bazi:'八字命理',astrology:'星座运势',tarot:'塔罗牌',meihua:'梅花易数',vedic:'印度占星(吠陀)',hehun:'八字合婚',synastry:'星座配对',hepan:'综合合盘'};
    const pairInfo=profileB?`\n\n对方信息：${profileB.year||'?'}年${profileB.month||'?'}月${profileB.day||'?'}日${profileB.hour>=0?profileB.hour+'时':''}，${profileB.gender==='female'?'女':'男'}。`:'';
    // Build lightweight prompt
    const systemPrompt = `你是一位精通${MODE_NAMES[mode]||'命理'}的专家。
用户已经做过一次完整分析，现在在追问具体问题。

之前分析的核心摘要：
${(reportSummary || '').substring(0, 800)}${pairInfo}

请基于以上分析背景，简要回答用户的追问。
要求：
- 直接回答，不需要章节标题或markdown格式
- 1-3段文字，简洁有力
- 结合${MODE_NAMES[mode]||'命理'}术语但通俗易懂
- 最后给一句实用建议`;
    // Include recent chat for context
    let userMsg = question;
    if (recentChat && recentChat.length > 0) {
      const chatCtx = recentChat.slice(-6).map(c => `${c.role==='user'?'用户':'AI'}：${c.text.substring(0,100)}`).join('\n');
      userMsg = `最近的对话：\n${chatCtx}\n\n当前追问：${question}`;
    }
    const response = await callLLM(systemPrompt, userMsg, mode, 1500);
    const cleanResp = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    res.type('application/json; charset=utf-8').json({ response: cleanResp });
  } catch (e) {
    res.status(500).type('application/json; charset=utf-8').json({ error: e.message });
  }
});

// API：AI模拟聊天（LLM扮演匹配对象）
app.post('/api/chat', async (req, res) => {
  try {
    const { partner, userProfile, message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: '请输入消息' });
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
          res.type('application/json; charset=utf-8').json({ reply });
        } catch (e) {
          res.status(500).type('application/json; charset=utf-8').json({ error: 'AI回复解析失败' });
        }
      });
    });
    llmReq.on('error', (e) => {
      res.status(500).type('application/json; charset=utf-8').json({ error: e.message });
    });
    llmReq.write(llmBody);
    llmReq.end();
  } catch (e) {
    res.status(500).type('application/json; charset=utf-8').json({ error: e.message });
  }
});

// API：仅计算引擎（不调 LLM）
app.post('/api/calculate', (req, res) => {
  try {
    const { mode, year, month, day, hour, gender, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB } = req.body;
    const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
    const data = calculateEngine(mode, profile, displayMode || 'simple', { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB });
    const structured = require('./src/ai-service').extractStructured(mode, profile);
    res.type('application/json; charset=utf-8').json({ mode, displayMode: displayMode || 'simple', engineData: data, structured });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// API：流式计算 + AI 解读（SSE）
app.post('/api/divine-stream', async (req, res) => {
  try {
    const { mode, year, month, day, hour, gender, question, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox } = req.body;
    if (!mode || !year || !month || !day) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'缺少必要参数(mode/year/month/day)'})); return; }
    const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
    if (isNaN(profile.year) || isNaN(profile.month) || isNaN(profile.day)) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'日期参数无效'})); return; }
    const ctxOptions = { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox };

    const buildReq = aiService.buildRequest(mode, profile, question || '', { displayMode: displayMode || 'simple', ...ctxOptions });
    if (buildReq.blocked) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      res.write(`data: ${JSON.stringify({type:'error',error:buildReq.reason})}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // SSE headers — disable compression for streaming
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });

    // 1. Send engine data + structured immediately
    const structured = aiService.extractStructured(mode, profile);
    res.write(`data: ${JSON.stringify({type:'init',engineData:buildReq.engineData,structured,mode})}\n\n`);

    // 2. Stream LLM response
    const streamProvider = getProvider();
    const streamApiUrl = `${streamProvider.url}/chat/completions`;
    const llmBody = JSON.stringify({
      model: streamProvider.model,
      messages: [
        { role: 'system', content: buildReq.systemPrompt },
        { role: 'user', content: buildReq.userMessage },
      ],
      max_tokens: getLLMParams().maxTokens || 6144, temperature: getLLMParams().temperature ?? 0.5, stream: true,
    });

    const parsed = new URL(streamApiUrl);
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
            res.write(`data: ${JSON.stringify({type:'chunk',text:aiService.getDisclaimer(buildReq.lang)||''})}\n\n`);
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
        res.write(`data: ${JSON.stringify({type:'chunk',text:aiService.getDisclaimer(buildReq.lang)||''})}\n\n`);
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

// API：计算 + AI 解读
app.post('/api/divine', async (req, res) => {
  try {
    const { mode, year, month, day, hour, gender, question, displayMode, city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox, context, lang } = req.body;
    if (!mode || !year || !month || !day) return res.status(400).json({error:'缺少必要参数(mode/year/month/day)'});
    const profile = { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: parseInt(hour), gender: gender || 'male', longitude: parseFloat(longitude) || undefined };
    if (isNaN(profile.year) || isNaN(profile.month) || isNaN(profile.day)) return res.status(400).json({error:'日期参数无效'});
    const ctxOptions = { city, latitude, longitude, selectedCards, meihuaNum1, meihuaNum2, spreadType, profileB, hourUnknown, hourApprox, lang: lang || 'zh-CN' };
    // 追问上下文：把之前的分析摘要拼入问题
    let fullQuestion = question || '';
    if (context && context.trim()) {
      fullQuestion = `[追问上下文] 之前的分析摘要：\n${context.substring(0, 800)}\n\n[当前追问] ${fullQuestion}`;
    }
    // 空问题或默认问题 → 全面分析；有具体问题 → 聚焦分析
    const result = await handleDivination(mode, profile, fullQuestion, displayMode || 'simple', ctxOptions);
    res.type('application/json; charset=utf-8').json(result);
  } catch (e) {
    res.status(500).type('application/json; charset=utf-8').json({ error: e.message });
  }
});

// ============ API: Messages (HTTP fallback for offline/history) ============

app.get('/api/messages/:userId', auth.authMiddleware, (req, res) => {
  const messages = auth.getMessages(req.user.id, req.params.userId, parseInt(req.query.limit) || 50, req.query.before);
  res.json(messages);
});

// ============ API: Posts (缘友圈) ============

app.post('/api/posts', auth.authMiddleware, (req, res) => {
  const { content, tag } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
  const post = auth.createPost(req.user.id, content.substring(0, 1000), tag);
  res.json(post);
});

app.get('/api/posts', auth.optionalAuth, (req, res) => {
  const posts = auth.getPosts(parseInt(req.query.limit) || 30, req.query.before);
  res.json(posts);
});

app.post('/api/posts/:id/like', auth.authMiddleware, (req, res) => {
  const result = auth.likePost(req.user.id, req.params.id);
  res.json(result);
});

app.post('/api/posts/:id/comment', auth.authMiddleware, (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '评论不能为空' });
  const result = auth.addComment(req.user.id, req.params.id, text.substring(0, 500));
  res.json(result);
});

app.get('/api/posts/:id/comments', (req, res) => {
  const comments = auth.getComments(req.params.id);
  res.json(comments);
});

// ============ HTML Cache (startup) ============
let cachedAppHtml = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf-8');
let cachedAdminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf-8');

// ============ Start Server ============

const wsModule = require('./src/websocket');
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║           缘合 YuanHe 服务器              ║
╠══════════════════════════════════════════╣
║                                          ║
║  📱 缘合App:  http://localhost:${PORT}/app   ║
║  📊 系统监控: http://localhost:${PORT}/monitor║
║  🔌 WebSocket: ws://localhost:${PORT}/ws     ║
║                                          ║
║  🤖 LLM: ${LLM_MODEL.padEnd(30)}║
║                                          ║
╚══════════════════════════════════════════╝
`);
});

// 启动 WebSocket
wsModule.init(server, auth);

// ============ Graceful Shutdown ============

function shutdown(signal) {
  console.log(`\n⚡ ${signal} received, shutting down gracefully...`);
  try { auth.flushAll(); console.log('✅ Pending writes flushed'); } catch (e) {}
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => { console.error('⚠️ Force exit after 30s timeout'); process.exit(1); }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  shutdown('uncaughtException');
});
