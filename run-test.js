/**
 * 缘合占卜模块本地测试
 * 运行：node run-test.js
 * 结果保存到：test-results.json
 */
const aiService = require('./src/ai-service');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载 .env
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const idx = line.indexOf('=');
      if (idx > 0) process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    }
  });
} catch(e) {}

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3';

console.log('╔══════════════════════════════════════╗');
console.log('║      缘合占卜模块 · 本地测试          ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  LLM: ${LLM_BASE_URL}`);
console.log(`║  模型: ${LLM_MODEL}`);
console.log('╚══════════════════════════════════════╝\n');

// LLM调用
function callLLM(systemPrompt, userMessage) {
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
      hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}`, 'Content-Length': Buffer.byteLength(body) },
    };
    const req = (parsed.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`LLM状态码${res.statusCode}: ${data.substring(0, 300)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) resolve(json.choices[0].message.content);
          else if (json.error) reject(new Error(json.error.message || JSON.stringify(json.error)));
          else resolve(data);
        } catch(e) { reject(new Error(`解析失败: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', e => reject(new Error(`连接失败: ${e.message}`)));
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('超时180s')); });
    req.write(body); req.end();
  });
}

// 测试用例
const profile = { year:1996, month:8, day:15, hour:14, gender:'female', longitude:116.4 };
const profileB = { year:1992, month:3, day:22, hour:8, gender:'male' };

const testCases = [
  { name:'八字·全面分析', mode:'bazi', question:'', displayMode:'expert' },
  { name:'八字·感情聚焦', mode:'bazi', question:'今年感情运怎么样', displayMode:'expert' },
  { name:'星座', mode:'astrology', question:'', displayMode:'expert' },
  { name:'塔罗', mode:'tarot', question:'', displayMode:'expert' },
  { name:'梅花', mode:'meihua', question:'', displayMode:'expert' },
  { name:'印占', mode:'vedic', question:'', displayMode:'expert' },
  { name:'八字合婚', mode:'hehun', question:'', displayMode:'expert', pairing:true },
  { name:'星座配对', mode:'synastry', question:'', displayMode:'expert', pairing:true },
];

async function runTests() {
  const results = {};
  
  for (const tc of testCases) {
    console.log(`\n🔮 测试: ${tc.name}...`);
    const startTime = Date.now();
    
    try {
      const opts = { displayMode: tc.displayMode };
      if (tc.pairing) opts.profileB = profileB;
      
      const req = aiService.buildRequest(tc.mode, profile, tc.question, opts);
      
      if (req.blocked) {
        results[tc.name] = { status:'blocked', reason:req.reason };
        console.log(`   ⚠️ 被拦截: ${req.reason}`);
        continue;
      }

      console.log(`   📦 引擎数据: ${req.engineData.length}字`);
      console.log(`   📝 调用LLM中...`);
      
      const response = await callLLM(req.systemPrompt, req.userMessage);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      results[tc.name] = {
        status: 'ok',
        mode: tc.mode,
        question: tc.question || '(全面分析)',
        engineDataLength: req.engineData.length,
        engineData: req.engineData,
        aiResponse: response,
        aiResponseLength: response.length,
        category: req.category,
        elapsedSeconds: parseFloat(elapsed),
      };
      
      console.log(`   ✅ 完成! AI回复${response.length}字 (${elapsed}秒)`);
      
    } catch(e) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      results[tc.name] = { status:'error', error:e.message, elapsedSeconds:parseFloat(elapsed) };
      console.log(`   ❌ 失败: ${e.message.substring(0, 100)}`);
    }
  }

  // 安全测试（不调LLM）
  console.log(`\n🛡️ 测试: 安全拦截...`);
  try {
    const req = aiService.buildRequest('bazi', profile, '我想自杀', {});
    results['安全拦截'] = { status:'ok', blocked:req.blocked, reason:req.reason };
    console.log(`   ✅ blocked=${req.blocked}`);
  } catch(e) {
    results['安全拦截'] = { status:'error', error:e.message };
  }

  // 保存结果
  const outputPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log('\n══════════════════════════════════════');
  console.log(`✅ 测试完成! 结果已保存到: test-results.json`);
  console.log('══════════════════════════════════════');
  
  // 汇总
  const ok = Object.values(results).filter(r => r.status === 'ok').length;
  const fail = Object.values(results).filter(r => r.status === 'error').length;
  console.log(`\n通过: ${ok}  失败: ${fail}  总计: ${Object.keys(results).length}`);
  
  Object.entries(results).forEach(([name, r]) => {
    if (r.status === 'ok' && r.aiResponseLength) {
      console.log(`  ${name}: ${r.aiResponseLength}字 ${r.elapsedSeconds}秒 ✅`);
    } else if (r.status === 'ok') {
      console.log(`  ${name}: ✅ ${r.blocked ? 'blocked' : ''}`);
    } else {
      console.log(`  ${name}: ❌ ${r.error?.substring(0, 60)}`);
    }
  });
}

runTests().catch(e => console.error('测试异常:', e));
