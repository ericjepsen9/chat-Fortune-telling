/**
 * 缘合 AI 服务 v3 — 上下文感知 + 丰富输出 + 问题聚焦
 */
const baziEngine = require('./engines/bazi');
const astrologyEngine = require('./engines/astrology');
const tarotEngine = require('./engines/tarot');
const meihuaEngine = require('./engines/meihua');
const vedicEngine = require('./engines/vedic');
const { Solar } = require('lunar-javascript');

// ============ 时空上下文（lunar-javascript精确） ============
function createContext(options = {}) {
  const now = options.timestamp ? new Date(options.timestamp) : new Date();
  const lat = parseFloat(options.latitude) || 39.9;
  const lng = parseFloat(options.longitude) || 116.4;
  const city = options.city || '北京';
  const yr = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate(), h = now.getHours();
  const shichenArr = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const si = h === 23 ? 0 : Math.floor(((h + 1) % 24) / 2);
  const seasons = {1:'冬',2:'春',3:'春',4:'春',5:'夏',6:'夏',7:'夏',8:'秋',9:'秋',10:'秋',11:'冬',12:'冬'};

  // 用 lunar-javascript 精确计算流年/流月/流日/流时
  const solar = Solar.fromYmdHms(yr, m, d, h, 0, 0);
  const ec = solar.getLunar().getEightChar();
  const liunian = ec.getYear();
  const liuyue = ec.getMonth();
  const liuri = ec.getDay();
  const liushi = ec.getTime();

  return {
    now, year: yr, month: m, day: d, hour: h,
    shichen: shichenArr[si], shichenIdx: si,
    season: seasons[m],
    latitude: lat, longitude: lng, city,
    liunian, liuyue, liuri, liushi,
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
    longitude: profile.longitude || opts.longitude,
  };

  switch (mode) {
    case 'bazi': {
      const r = baziEngine.calculate(p);
      let o = baziEngine.formatForAI(r, dm);
      o += `\n\n【当前时空·系统计算】`;
      o += `\n查询时间：${ctx.fullStr}`;
      o += `\n流年：${ctx.liunian}  流月：${ctx.liuyue}  流日：${ctx.liuri}  流时：${ctx.liushi || ''}`;
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
      let r;
      if (opts.selectedCards && opts.selectedCards.length > 0) {
        // 用户手动选牌模式
        r = tarotEngine.drawFromSelection(opts.selectedCards, spread);
      } else {
        // 自动抽牌
        const uid = profile.id || `${p.year}-${p.month}-${p.day}`;
        const seed = tarotEngine.stableSeed(uid, ctx.now);
        r = tarotEngine.drawCards(spread, seed);
      }
      let o = tarotEngine.formatForAI(r, dm);
      o += `\n\n【起牌背景·系统记录】`;
      o += `\n抽牌时间：${ctx.fullStr}`;
      o += `\n抽牌方式：${opts.selectedCards ? '用户手动选择' : '系统随机抽取'}`;
      o += `\n当前季节能量：${ctx.season}季`;
      o += `\n当前星座季：太阳在${ctx.currentSunSign.zh}`;
      return o;
    }
    case 'meihua': {
      let r;
      if (opts.meihuaNum1 !== undefined && opts.meihuaNum1 !== '') {
        // 数字起卦模式
        r = meihuaEngine.generateFromNumbers(opts.meihuaNum1, opts.meihuaNum2);
      } else {
        // 时间起卦
        r = meihuaEngine.generateHexagram(ctx.now);
      }
      let o = meihuaEngine.formatForAI(r, dm);
      o += `\n\n【起卦背景·系统记录】`;
      o += `\n起卦时间：${ctx.fullStr}`;
      if (r.method === 'time') {
        o += `\n起卦方式：时间自动起卦`;
        o += `\n注意：同一时辰（2小时）内结果相同`;
      } else {
        o += `\n起卦方式：用户报数`;
      }
      o += `\n流年：${ctx.liunian}  流月：${ctx.liuyue}`;
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

// ============ 安全过滤 ============
const BLOCKED_PATTERNS = [
  /自[杀死伤残害]|[吞跳割].*死|不想活|结束生命|轻生/,
  /[杀害打砍刺].*[人谁他她]/,
  /[制造买卖].*[毒枪炸]/,
  /色情|裸照|性交易/,
  /怎么[偷骗黑]|诈骗.*方法/,
];
const SENSITIVE_PATTERNS = [
  /[离婚分手].*什么时候|什么时候.*[死亡离婚]/,
  /[疾]?病.*什么时候[好治愈]|癌|绝症/,
  /官司.*输赢|牢|坐牢/,
  /前[男女]友.*[复合回来]/,
];

function safetyCheck(question) {
  if (!question) return { safe: true, level: 'normal' };
  const q = question.trim();
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(q)) return { safe: false, level: 'blocked', reason: '该问题涉及敏感话题，无法提供分析。如需帮助请联系专业人士。' };
  }
  for (const p of SENSITIVE_PATTERNS) {
    if (p.test(q)) return { safe: true, level: 'sensitive' };
  }
  return { safe: true, level: 'normal' };
}

// ============ 问题分类 ============
function classifyQuestion(question) {
  if (!question || question.trim().length < 2) return 'general';
  const q = question.toLowerCase();
  if (/感情|恋爱|婚姻|对象|伴侣|喜欢|暗恋|复合|桃花|姻缘|另一半|脱单|分手/.test(q)) return 'relationship';
  if (/工作|事业|跳槽|升职|加薪|创业|职业|考试|面试|转行|找工作/.test(q)) return 'career';
  if (/财运|投资|理财|买房|赚钱|亏损|破财|发财|股票|生意/.test(q)) return 'wealth';
  if (/健康|身体|生病|手术|怀孕|备孕|减肥|失眠|抑郁/.test(q)) return 'health';
  if (/学业|考研|留学|出国|移民|签证/.test(q)) return 'study';
  if (/运势|今年|今天|这个月|下半年|明年/.test(q)) return 'fortune';
  return 'general';
}

// 分类补充提示
const CATEGORY_HINTS = {
  relationship: '\n\n【分析重点】围绕感情关系展开，包括：当前感情状态的能量、对方的特质匹配度、感情发展趋势、具体行动建议。',
  career: '\n\n【分析重点】围绕事业发展展开，包括：当前职业运势、适合的行动时机、机遇和风险、具体建议。',
  wealth: '\n\n【分析重点】围绕财运展开，包括：当前财运走势、投资适宜性、收入趋势、理财建议。',
  health: '\n\n【分析重点】围绕健康展开，包括：五行对应的身体弱项、当前需要注意的健康问题、调理建议。注意：命理分析不替代医学诊断，请就医。',
  study: '\n\n【分析重点】围绕学业发展展开，包括：学习运势、考试时机、方向选择、具体建议。',
  fortune: '\n\n【分析重点】围绕运势趋势展开，按时间线分析，指出关键月份、有利/不利时段、应对策略。',
  general: '',
};

// ============ 组装 ============
function buildRequest(mode, profile, question, options = {}) {
  // 安全检查
  const safety = safetyCheck(question);
  if (!safety.safe) {
    return { blocked: true, reason: safety.reason, engineData: '', systemPrompt: '', userMessage: question, mode };
  }

  const dm = options.displayMode || 'simple';
  const ctx = createContext(options);
  const engineData = calculateAll(mode, profile, ctx, options);

  // 问题分类
  const category = classifyQuestion(question);
  const categoryHint = CATEGORY_HINTS[category] || '';

  // 敏感问题加disclaimer
  const sensitiveDisclaimer = safety.level === 'sensitive' ? '\n\n【重要】你的回答要温和谨慎。不做绝对判断（"一定会""绝对不行"）。提醒用户命理仅供参考，重大决策请结合现实情况。' : '';

  const systemPrompt = buildPrompt(mode, dm, question) + categoryHint + sensitiveDisclaimer + engineData;
  return { systemPrompt, userMessage: (question && question.trim()) || '请为我进行全面分析', engineData, context: ctx, displayMode: dm, mode, category, safetyLevel: safety.level };
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
