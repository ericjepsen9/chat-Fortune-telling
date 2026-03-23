/**
 * 缘合 AI 服务 v3 — 上下文感知 + 丰富输出 + 问题聚焦
 */
const baziEngine = require('./engines/bazi');
const astrologyEngine = require('./engines/astrology');
const tarotEngine = require('./engines/tarot');
const meihuaEngine = require('./engines/meihua');
const vedicEngine = require('./engines/vedic');
const hehunEngine = require('./engines/hehun');
const synastryEngine = require('./engines/synastry');
const hepanEngine = require('./hepan');
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
    latitude: profile.latitude || opts.latitude || ctx.latitude,
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
    case 'hepan': {
      const pB = opts.profileB || {};
      const profileB = {
        year: parseInt(pB.year || pB.birthYear), month: parseInt(pB.month || pB.birthMonth),
        day: parseInt(pB.day || pB.birthDay), hour: parseInt(pB.hour || pB.birthHour),
        gender: pB.gender || 'female', longitude: pB.longitude || opts.longitude,
      };
      const r = hepanEngine.fullCompat(p, profileB);
      let o = hepanEngine.formatForAI(r, dm);
      o += `\n\n【查询时间】${ctx.fullStr}`;
      return o;
    }
    case 'hehun': {
      const pB = opts.profileB || {};
      const profileB = {
        year: parseInt(pB.year || pB.birthYear), month: parseInt(pB.month || pB.birthMonth),
        day: parseInt(pB.day || pB.birthDay), hour: parseInt(pB.hour || pB.birthHour),
        gender: pB.gender || 'female', longitude: pB.longitude || opts.longitude,
      };
      const r = hehunEngine.calculate(p, profileB);
      let o = hehunEngine.formatForAI(r, dm);
      o += `\n\n【查询时间】${ctx.fullStr}`;
      return o;
    }
    case 'synastry': {
      const pB = opts.profileB || {};
      const profileB = {
        year: parseInt(pB.year || pB.birthYear), month: parseInt(pB.month || pB.birthMonth),
        day: parseInt(pB.day || pB.birthDay), hour: parseInt(pB.hour || pB.birthHour),
        gender: pB.gender || 'female',
      };
      const r = synastryEngine.calculate(p, profileB);
      let o = synastryEngine.formatForAI(r, dm);
      o += `\n\n【查询时间】${ctx.fullStr}`;
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
      ? '你是资深命理师（20年经验）。分析风格：每一句都引用具体干支作为依据，将十神/格局/神煞等术语翻译成现实含义（如"偏财运"→"适合投资或副业收入"），交叉引用多个数据点得出结论。用**加粗**标注关键术语和结论。分析要深入、具体、有信息量，不说空话。'
      : '你是温暖的命理顾问。禁止使用十神/偏印/正官/七杀等术语。用比喻和日常语言，像朋友聊天。用**加粗**标注重要结论。要具体、有时间点、有行动建议。',
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
    hepan: isExpert
      ? '你是资深合婚分析师。综合八字五行配合与星座能量共振，给出多维度的配对分析。引用具体干支和度数。'
      : '你是缘分顾问。用温暖的语言分析两个人的契合度，重点讲优势和需要注意的地方。不用术语。',
    hehun: isExpert
      ? '你是资深命理合婚师。基于双方八字日主、婚姻宫、五行互补、纳音配合深度分析。引用具体干支。'
      : '你是八字缘分顾问。通俗解释两个人的命理配合度，给出实际相处建议。',
    synastry: isExpert
      ? '你是专业合盘占星师。分析双方太阳-月亮交叉相位、金星-火星吸引力、元素配合。用相位术语。'
      : '你是星座配对达人。用有趣的语言解释两个人的星座化学反应，给感情建议。',
  };

  const fullInstructions = {
    bazi: `用户没有输入具体问题，请进行【一生命运全面分析】。

【分析方法论——必须遵守】
1. 每一个结论都必须引用数据中的具体干支/十神/五行作为依据
2. 不说空话套话，每句话都要有信息量
3. 把专业术语翻译成现实含义（如"伤官透干"→"表达欲强、才华外露"）
4. 交叉引用多个数据点得出结论（如"水旺+伤官+桃花"→"异性缘好但感情不稳"）
5. 给出具体时间节点和行动建议

请严格按以下结构输出：

### 一、八字排盘（精准）
列出农历/公历/节气/八字/日主/用神/忌神。引用数据中的四柱排盘信息。

### 二、性格与天赋
分析维度（每项2-3句，共约10句）：
- 日主五行+阴阳特征 → 核心性格（如壬水=大海之水，胸怀广阔、善变）
- 引用时支性格数据 → 深层性格和行为模式
- 五行旺衰 → 对性格的影响（如水旺→聪明但多虑，缺火→缺乏热情）
- 十神组合 → 人格特征（如伤官旺→才华横溢但叛逆、食神旺→福气厚但懒散）
- 神煞 → 特殊能力或特质（如桃花→人缘好、文昌→学习力强）
- 地支关系 → 内在矛盾或助力（如自刑→内心纠结、六合→贵人多）
- 优点+缺点各列2-3条
- 核心矛盾：指出性格中最大的张力

### 三、大运排盘（一生命运总览）
这是最核心的部分。数据中每步大运都有：干支、十神、标签（少年运/青年运等）、吉凶。请：
- 按人生阶段分组（少年/青年/中年/晚年），每组加小标题
- 每步大运分析3-5句：这10年的核心主题、事业走势、财运特征、感情变化
- 引用大运天干的十神含义（如食神运=享受创作、七杀运=压力竞争、正印运=贵人学业）
- 引用大运吉凶（喜用=吉，忌神=凶），解释为什么吉或凶
- 每个阶段结尾加总评一句话

### 四、事业财运（重点）
约5-6句：
- 适合行业：基于五行旺衰+十神组合推导（水旺→流动性行业、伤官→技术创意）
- 不适合行业：基于忌神五行
- 财运类型：正财（稳定薪资）还是偏财（投资外财），基于命中十神
- 最旺年龄段：引用大运中财星旺的阶段
- 理财忠告：基于格局特点给出具体建议

### 五、婚姻家庭
约5-6句：
- 感情特征：引用桃花/日支/十神
- 婚姻宫：分析日支代表的婚姻状态（日支为财星=重视配偶、日支为比劫=竞争）
- 择偶建议：基于命局需要什么五行的伴侣
- 最佳婚恋年份段：引用大运和流年中正财/正官出现的时期
- 子女/家庭：基于时柱分析

### 六、健康注意
约3-4句：
- 引用健康提示数据中的五行旺衰→器官风险
- 凶月需要注意什么
- 养生建议

### 七、关键流年（近10年逐年预测）
引用十年运程概览数据，每年1-2句，格式如：
- 2026丙午（偏财）凶（冲日）：变动之年，防投资失误……
标注关键月份（引用逐月运程中的吉凶月）

### 八、一句话总命运
用3-4句话高度概括一生命运走势，定性为先苦后甜/大器晚成/一路上升/波折起伏等。

总字数2500-3500字。`,
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
    hepan: `无特定问题，请综合分析这对配对：
1.【缘分总评】综合评分含义、这段关系的核心特质（3句）
2.【八字配合】日主关系、五行互补、婚姻宫分析（5句）
3.【星座共振】太阳月亮元素配合、关键交叉相位解读（4句）
4.【相处模式】日常相处中的默契点和摩擦点（4句）
5.【感情发展】当前阶段特征、未来趋势（3句）
6.【实用建议】如何扬长避短、促进感情（3句）
总字数800左右。`,
    hehun: `无特定问题，请深度分析八字合婚：
1.【配对总评】评分含义、整体契合度（2句）
2.【日主配合】双方日主五行关系、性格互动模式（4句）
3.【婚姻宫】日支关系的感情影响（3句）
4.【五行互补】双方五行盈缺如何互补（3句）
5.【纳音配合】年命根基是否和谐（2句）
6.【大运同步】当前人生节奏是否合拍（2句）
7.【相处建议】需要注意什么、如何经营（3句）
总字数700左右。`,
    synastry: `无特定问题，请深度分析星座配对：
1.【配对总评】评分含义、化学反应类型（2句）
2.【太阳互动】双方核心性格的碰撞与融合（3句）
3.【月亮共鸣】双方内心需求是否契合（3句）
4.【关键相位】交叉相位的深层含义（每个相位2句）
5.【吸引力】金星火星的化学反应（2句）
6.【感情建议】如何利用星座能量促进关系（3句）
总字数600左右。`,
  };

  const focusedInstruction = `用户的问题：「${question}」

【分析方法论】
- 每一个结论必须引用数据中的具体干支/十神/五行/神煞作为依据
- 交叉引用多个数据点（如"伤官+水旺+桃花月"→具体结论）
- 把术语翻译成现实含义

请按以下结构回答：
1. 先直接给出明确结论（1-2句，不模棱两可）
2. 核心分析（引用至少3个数据点，每个数据点解释其现实含义，共6-8句）
3. 有利因素 vs 不利因素（各2-3条，引用具体干支）
4. 时间参考（基于流年/流月数据，指出关键月份和最佳行动时机）
5. 具体建议（3-4条可执行的行动方案）
总字数800-1200。`;

  const instruction = hasQ ? focusedInstruction : fullInstructions[mode];

  const followUp = `\n\n最后，用一句话建议用户可以进一步追问的2个方向（用「你还可以问我：……」的格式）。`;

  return `${roles[mode]}${ban}\n\n${instruction}${followUp}\n\n以下是系统精确计算的数据（只能引用，不可修改或补充）：\n`;
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
  if (/合婚|配对|合盘|般配|合适吗|缘分|八字合|星座配|我们俩|我和他|我和她|属相合/.test(q)) return 'compatibility';
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
  compatibility: '\n\n【分析重点】用户在问配对/合婚相关问题。如果当前模式是单人分析，请从该命主的角度分析其婚恋倾向、理想伴侣类型、婚姻宫特征。如果是双人模式，围绕配合度展开。',
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
