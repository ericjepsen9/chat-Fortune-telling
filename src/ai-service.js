/**
 * 缘合 AI 服务 v3 — 上下文感知 + 丰富输出 + 问题聚焦
 */
const baziEngine = require('./engines/bazi');
const astrologyEngine = require('./engines/astrology');
const tarotEngine = require('./engines/tarot');
const meihuaEngine = require('./engines/meihua');
const vedicEngine = require('./engines/vedic');

// ============ 时空上下文 ============
function createContext(options = {}) {
  const now = options.timestamp ? new Date(options.timestamp) : new Date();
  const lat = parseFloat(options.latitude) || 39.9;
  const lng = parseFloat(options.longitude) || 116.4;
  const city = options.city || '北京';
  const m = now.getMonth() + 1, d = now.getDate(), h = now.getHours(), yr = now.getFullYear();
  const shichenArr = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const si = h === 23 ? 0 : Math.floor(((h + 1) % 24) / 2);
  const seasons = {1:'冬',2:'春',3:'春',4:'春',5:'夏',6:'夏',7:'夏',8:'秋',9:'秋',10:'秋',11:'冬',12:'冬'};
  const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  // 流年
  const lnTg = TG[(yr-4)%10], lnDz = DZ[(yr-4)%12];
  // 流月（以年干推月干）
  const mStart = {0:2,1:2,2:4,3:4,4:6,5:6,6:8,7:8,8:0,9:0};
  const lmTg = TG[(mStart[(yr-4)%10] + m - 1) % 10], lmDz = DZ[(m+1)%12];
  // 流日
  const baseDate = new Date(2000, 0, 7);
  const diffDays = Math.round((now - baseDate) / 864e5);
  const ldIdx = ((diffDays % 60) + 60) % 60;
  const ldTg = TG[ldIdx % 10], ldDz = DZ[ldIdx % 12];

  return {
    now, year: yr, month: m, day: d, hour: h,
    shichen: shichenArr[si], shichenIdx: si,
    season: seasons[m],
    latitude: lat, longitude: lng, city,
    liunian: lnTg + lnDz,
    liuyue: lmTg + lmDz,
    liuri: ldTg + ldDz,
    currentSunSign: astrologyEngine.getSunSign(m, d),
    dateStr: `${yr}年${m}月${d}日`,
    timeStr: `${h}时（${shichenArr[si]}时）`,
    fullStr: `${yr}年${m}月${d}日 ${h}时（${shichenArr[si]}时）${city ? ' ' + city : ''}`,
  };
}

// ============ 引擎数据（含时空上下文） ============
function calculateAll(mode, profile, ctx, opts = {}) {
  const dm = opts.displayMode || 'simple';
  const p = {
    year: parseInt(profile.year || profile.birthYear),
    month: parseInt(profile.month || profile.birthMonth),
    day: parseInt(profile.day || profile.birthDay),
    hour: parseInt(profile.hour || profile.birthHour),
    gender: profile.gender || 'male',
  };

  switch (mode) {
    case 'bazi': {
      const r = baziEngine.calculate(p);
      let o = baziEngine.formatForAI(r, dm);
      o += `\n\n【当前时空·系统计算】`;
      o += `\n查询时间：${ctx.fullStr}`;
      o += `\n流年：${ctx.liunian}  流月：${ctx.liuyue}  流日：${ctx.liuri}`;
      o += `\n当前季节：${ctx.season}季`;
      if (ctx.city !== '北京') o += `\n用户所在地：${ctx.city}（纬度${ctx.latitude}°）`;
      return o;
    }
    case 'astrology': {
      const r = astrologyEngine.calculate(p);
      let o = astrologyEngine.formatForAI(r, dm);
      const compat = astrologyEngine.getCompat(r.sunSign, ctx.currentSunSign);
      o += `\n\n【当前天象·系统计算】`;
      o += `\n查询时间：${ctx.dateStr}`;
      o += `\n当前太阳在${ctx.currentSunSign.zh}（${ctx.currentSunSign.en}）`;
      o += `\n当前太阳与你太阳星座协调度：${compat}%`;
      if (compat >= 80) o += `（能量高度和谐）`;
      else if (compat >= 60) o += `（较为顺利）`;
      else if (compat >= 50) o += `（需要适应调整）`;
      else o += `（有挑战，需耐心）`;
      o += `\n当前季节：${ctx.season}季`;
      const elThemes = {
        fire: {春:'行动力旺',夏:'光芒最盛',秋:'收敛沉淀',冬:'蓄势待发'},
        earth: {春:'播种准备',夏:'稳步推进',秋:'收获丰盛',冬:'巩固基础'},
        air: {春:'社交活跃',夏:'思维敏捷',秋:'深度反思',冬:'内在整理'},
        water: {春:'情感涌动',夏:'注意休息',秋:'直觉增强',冬:'能量最强'},
      };
      if (elThemes[r.sunSign.el]) o += `\n你的元素（${r.sunSign.el}）本季主题：${elThemes[r.sunSign.el][ctx.season]}`;
      if (ctx.city) o += `\n用户所在地：${ctx.city}`;
      return o;
    }
    case 'tarot': {
      const spread = opts.spreadType || 'threeCard';
      const uid = profile.id || `${p.year}-${p.month}-${p.day}`;
      const seed = tarotEngine.stableSeed(uid, ctx.now);
      const r = tarotEngine.drawCards(spread, seed);
      let o = tarotEngine.formatForAI(r, dm);
      o += `\n\n【起牌背景·系统记录】`;
      o += `\n抽牌时间：${ctx.fullStr}`;
      o += `\n牌阵种子：${seed}（同一天同一用户结果固定）`;
      o += `\n当前季节能量：${ctx.season}季`;
      o += `\n当前星座季：太阳在${ctx.currentSunSign.zh}`;
      return o;
    }
    case 'meihua': {
      const r = meihuaEngine.generateHexagram(ctx.now);
      let o = meihuaEngine.formatForAI(r, dm);
      o += `\n\n【起卦背景·系统记录】`;
      o += `\n起卦时间：${ctx.fullStr}`;
      o += `\n起卦参数：年${ctx.year}+月${ctx.month}+日${ctx.day}=${ctx.year+ctx.month+ctx.day}→上卦 / 加时辰${ctx.shichenIdx+1}→下卦`;
      o += `\n流年：${ctx.liunian}  流月：${ctx.liuyue}`;
      o += `\n注意：同一时辰（2小时）内起卦结果相同`;
      if (ctx.city) o += `\n问卦地点：${ctx.city}`;
      return o;
    }
    case 'vedic': {
      const r = vedicEngine.calculate(p);
      let o = vedicEngine.formatForAI(r, dm);
      const cd = r.currentDasha;
      const elapsed = ctx.year - cd.start;
      const pct = Math.round((elapsed / cd.yrs) * 100);
      o += `\n\n【当前行运·系统计算】`;
      o += `\n查询时间：${ctx.dateStr}`;
      o += `\n大运进度：${cd.zh}大运已行${elapsed}年/${cd.yrs}年（${pct}%）`;
      if (pct < 30) o += `·初期：能量逐渐展开`;
      else if (pct < 70) o += `·中期：影响最显著`;
      else o += `·后期：准备过渡`;
      const next = r.dashas.find(d => d.start > ctx.year);
      if (next) o += `\n下一大运：${next.zh}（${next.start}年开始）`;
      if (ctx.city) o += `\n用户所在地：${ctx.city}`;
      return o;
    }
    default: throw new Error(`Unknown mode: ${mode}`);
  }
}

// ============ Prompt 构建 ============
function buildPrompt(mode, displayMode, question) {
  const isExpert = displayMode === 'expert';
  const hasQ = question && question.trim() && !question.includes('请为我分析') && !question.includes('整体运势') && question.trim().length > 2;

  const ban = `\n【铁律】只基于下方系统数据分析。严禁自行计算/编造干支、年份、星座度数、卦象。所有数字和术语以系统数据为准。不提及其他占术。`;

  const roles = {
    bazi: isExpert
      ? '你是资深命理师（20年经验）。使用十神/格局/神煞等专业术语，引用具体干支，分析有理有据。'
      : '你是温暖的命理顾问。禁止使用十神/偏印/正官/七杀等术语。用比喻和日常语言，像朋友聊天。',
    astrology: isExpert
      ? '你是专业占星师。使用宫位/相位/行运术语，分析太阳-月亮-上升三重组合。'
      : '你是亲切的星座达人。像好朋友聊星座，不用专业术语。有趣、接地气。',
    tarot: isExpert
      ? '你是资深塔罗师。分析牌面象征、元素对应、位置含义、牌间能量流。'
      : '你是温柔的塔罗顾问。每张牌一句话说清，重点告诉用户该怎么做。不用术语。',
    meihua: isExpert
      ? '你是易学分析师。详析体用生克、动爻变化、互卦关系。判断具体、有应期。'
      : '你是决策顾问。不用体/用/生/克术语。用"你的状态""环境""趋势"表达。给明确建议。',
    vedic: isExpert
      ? '你是Jyotish专家。用Dasha/Nakshatra等梵文术语（附中文）。分析行星能量和周期。'
      : '你是印度占星顾问。不用梵文术语。通俗解释当前人生阶段，给实用建议。',
  };

  const fullInstructions = {
    bazi: `无特定问题，请从以下维度全面分析：
1.【性格本质】日主特征、格局含义、核心优缺点（5句）
2.【事业方向】适合行业/工作方式、格局对事业的影响（4句）
3.【感情模式】恋爱风格、对伴侣的期待、关系中的盲点（4句）
4.【财运格局】正财偏财倾向、理财风格（3句）
5.【健康提示】五行偏旺偏弱对应的身体注意事项（2句）
6.【今年运势】基于流年数据分析整体趋势，指出关键月份和注意事项（5句）
总字数800左右。`,
    astrology: `无特定问题，请全面分析：
1.【核心人格】太阳表层+月亮内在+上升外在，三者如何互动（5句）
2.【感情画像】你会被什么样的人吸引、恋爱模式、理想伴侣（4句）
3.【事业天赋】最适合的职业方向和工作风格（3句）
4.【近期运势】基于当前天象分析这段时间的能量（4句）
5.【本月建议】最适合做什么、应避免什么、幸运色/数字/方向（3句）
总字数600左右。`,
    tarot: `无特定问题，请深度解读牌阵：
1.【逐张解读】每张牌在该位置的含义，正逆位影响（每张3句）
2.【能量流向】过去→现在→未来的叙事线（3句）
3.【核心信息】整个牌阵最想告诉你的一件事（2句）
4.【行动指引】最近该做什么、避免什么（3句）
5.【时间窗口】这个能量大约持续多久（1句）
总字数500左右。`,
    meihua: `无特定问题，请全面分析卦象：
1.【卦象大意】本卦的象征含义（3句）
2.【体用对比】自身与环境的力量对比、谁占主导（3句）
3.【变化趋势】动爻带来的转变方向，变卦的最终指向（3句）
4.【吉凶判断】明确说出吉/凶/平，不要含糊（2句）
5.【时间节点】什么时候是关键期、什么时候见分晓（2句）
6.【行动建议】应该做什么、不该做什么（3句）
总字数500左右。`,
    vedic: `无特定问题，请全面分析：
1.【灵魂蓝图】太阳和月亮星座揭示的人生使命（3句）
2.【月亮星宿】Nakshatra特质对性格命运的影响（3句）
3.【大运周期】当前Dasha的核心主题和阶段性特征（4句）
4.【人生方向】上升星座指引的发展方向（2句）
5.【当前运势】基于大运进度分析当前状态（3句）
6.【实用建议】适合的宝石/颜色/方位/活动（3句）
总字数600左右。`,
  };

  const focusedInstruction = `用户的问题：「${question}」

请围绕这个问题深度分析：
1. 先直接回答（给出明确判断，不要模棱两可）
2. 引用数据中的具体信息作为依据（说明是哪个数据支持了你的判断）
3. 分析有利因素和不利因素
4. 给出时间参考（什么时候行动最好/哪个月需注意）
5. 列出3条具体可执行的建议
总字数400-600。`;

  const instruction = hasQ ? focusedInstruction : fullInstructions[mode];

  return `${roles[mode]}${ban}\n\n${instruction}\n\n以下是系统精确计算的数据（只能引用，不可修改或补充）：\n`;
}

// ============ 组装 ============
function buildRequest(mode, profile, question, options = {}) {
  const dm = options.displayMode || 'simple';
  const ctx = createContext(options);
  const engineData = calculateAll(mode, profile, ctx, options);
  const systemPrompt = buildPrompt(mode, dm, question) + engineData;
  return { systemPrompt, userMessage: (question && question.trim()) || '请为我进行全面分析', engineData, context: ctx, displayMode: dm, mode };
}

// ============ 测试 ============
function test() {
  const profile = { year: 1990, month: 11, day: 5, hour: 22, gender: 'male', id: 'test-001' };
  console.log('===== 八字（无问题·专家）=====');
  const r1 = buildRequest('bazi', profile, '', { displayMode: 'expert', city: '上海' });
  console.log(r1.engineData);
  console.log('\n--- prompt前200字 ---');
  console.log(r1.systemPrompt.substring(0, 200));

  console.log('\n===== 八字（有问题·白话）=====');
  const r2 = buildRequest('bazi', profile, '我今年适合跳槽吗？', { displayMode: 'simple' });
  console.log(r2.systemPrompt.substring(0, 300));

  console.log('\n===== 星座（无问题·白话）=====');
  const r3 = buildRequest('astrology', profile, '', { displayMode: 'simple' });
  console.log(r3.engineData);

  console.log('\n===== 梅花（有问题）=====');
  const r4 = buildRequest('meihua', profile, '这个项目值得投资吗？', { displayMode: 'expert' });
  console.log(r4.engineData);

  console.log('\n===== 印占 =====');
  const r5 = buildRequest('vedic', profile, '', { displayMode: 'expert' });
  console.log(r5.engineData);
}

if (require.main === module) test();
module.exports = { buildRequest, calculateAll, createContext };
