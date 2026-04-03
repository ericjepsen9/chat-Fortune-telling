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
分析维度（每项2-3句，共约12句）：
- 日主五行+阴阳特征 → 核心性格（如壬水=大海之水，胸怀广阔、善变）
- 引用【时支性格】数据 → 深层性格和行为模式（如"壬水+亥时→聪明重情、心软"）
- 引用【地支组合特征】数据 → 双某带来的特殊性格（如"双亥水→重情但心软易被拖累"）
- 引用【五行组合】数据 → 性格底色（如"金水旺→外柔内刚、有韧性"）
- 五行旺衰 → 对性格的影响（如水旺→聪明但多虑，缺火→缺乏热情）
- 十神组合 → 人格特征（如伤官旺→才华横溢但叛逆、食神旺→福气厚但懒散）
- 神煞 → 特殊能力或特质（如桃花→人缘好、文昌→学习力强）
- 地支关系 → 内在矛盾或助力（如自刑→内心纠结、六合→贵人多）
- 优点+缺点各列2-3条
- 核心矛盾：指出性格中最大的张力

### 三、大运排盘（一生命运总览）
先引用【三前法·一生概览】给出三段式总判（早年/中年/晚年），再逐步分析大运：

数据中每步大运都有：干支、十神、标签（少年运/青年运等）、吉凶。请：
- 按人生阶段分组（少年/青年/中年/晚年），每组加小标题
- 先用三前法的结论开头，再用大运数据展开
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
分4个子项分析（共约8句）：
- **感情**：引用桃花/日支十神/伤官等，分析恋爱特点、何时易遇真爱vs烂桃花、几岁前感情不稳/几岁后渐稳
- **婚姻**：婚姻宫（日支）五行和十神含义，何时适合结婚（引用大运中正财/正官旺的时期），夫妻宫稳不稳
- **子女**：引用【子女缘】数据，分析子女运、亲子关系、是否晚年靠子女享福
- **家庭**：引用三前法晚年判断，分析中晚年家庭和谐度、是否顾家

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

总字数1200-1500字。每段精炼，不超过3句。避免重复引用同一数据。`,
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
总字数500-700。`;

  const instruction = hasQ ? focusedInstruction : fullInstructions[mode];

  const followUp = `\n\n最后，用一句话建议用户可以进一步追问的2个方向（用「你还可以问我：……」的格式）。`;

  return `${roles[mode]}${ban}\n\n${instruction}${followUp}\n\n以下是系统精确计算的数据（只能引用，不可修改或补充）：\n`;
}

// ============ 安全过滤 ============
const BLOCKED_PATTERNS = [
  // Self-harm / suicide
  /自[杀死伤残害]|[吞跳割].*死|不想活|结束生命|轻生|活不下去|了断|走上绝路|一死百了|厌世/,
  // Violence
  /[杀害打砍刺].*[人谁他她]|报复.*方法|怎么[伤害毒]人/,
  // Illegal
  /[制造买卖].*[毒枪炸]|贩毒|走私|洗钱/,
  // Sexual exploitation
  /色情|裸照|性交易|未成年.*性|儿童.*色/,
  // Fraud
  /怎么[偷骗黑]|诈骗.*方法|盗号|钓鱼/,
];
const CRISIS_RESPONSE = '💙 你的感受很重要。如果你正在经历困难时刻，请联系专业支持：\n\n🆘 全国心理援助热线：400-161-9995\n🆘 北京心理危机研究与干预中心：010-82951332\n🆘 24小时生命热线：400-821-1215\n\n专业的帮助比命理分析更适合你目前的状况。你值得被好好对待 ❤️';

const SENSITIVE_PATTERNS = [
  /[离婚分手].*什么时候|什么时候.*[死亡离婚]/,
  /[疾]?病.*什么时候[好治愈]|癌|绝症|抑郁|焦虑症/,
  /官司.*输赢|牢|坐牢|判刑/,
  /前[男女]友.*[复合回来]/,
  /堕胎|流产|自残/,
];

// Disclaimer appended to all AI divination responses
const DIVINATION_DISCLAIMER = '\n\n---\n⚠️ *以上分析仅供参考娱乐，不构成任何专业建议。重大人生决策请结合实际情况，必要时咨询专业人士。*';

function safetyCheck(question) {
  if (!question) return { safe: true, level: 'normal' };
  const q = question.trim();
  if (q.length < 2) return { safe: true, level: 'normal' };
  // 1. Crisis detection — provide resources
  if (/自[杀死]|不想活|结束生命|轻生|活不下去|厌世|一死百了/.test(q)) {
    return { safe: false, level: 'blocked', reason: CRISIS_RESPONSE };
  }
  // 2. Other blocked content
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(q)) return { safe: false, level: 'blocked', reason: '该问题涉及敏感话题，无法提供分析。如需帮助请联系专业人士。' };
  }
  for (const p of SENSITIVE_PATTERNS) {
    if (p.test(q)) return { safe: true, level: 'sensitive' };
  }
  // 2. 相关性检测：问题是否与命理/占卜/运势/人生相关
  const RELEVANT_KEYWORDS = /运势|命理|八字|星座|塔罗|梅花|占卜|五行|命盘|排盘|性格|感情|恋爱|婚姻|结婚|事业|工作|财运|健康|学业|考试|投资|运气|前途|未来|今年|明年|本月|下半年|桃花|姻缘|合婚|配对|合盘|合适|般配|大运|流年|吉凶|方位|幸运|适合|注意|建议|怎么样|如何|好不好|能不能|会不会|什么时候|跳槽|升职|创业|买房|转行|出国|留学|分手|复合|怀孕|减肥|生意|发财|破财|人生|命运|天赋|潜力|弱点|优势|缺点|身体|手术|脾气|个性|缘分|伴侣|对象|另一半|属相|生肖|日主|天干|地支|纳音|格局|十神|宫位|行星|月亮星座|太阳星座|上升|水逆|卦|爻|易经|风水|方向|数字|时辰|农历|阴历|吠陀|印度占/;
  const GENERAL_QUESTION = /分析我|解读|预测|看看我|测测|帮我[看测算分]|请问我|想知道我|告诉我|关于我的|我的[命运事感财健学]|帮我分析|我和[他她]|我跟[他她]|我们俩/;
  const NON_RELEVANT = /天气|代码|编程|写[个一]|翻译|作文|数学|物理|化学|菜谱|做菜|食谱|新闻|电影|音乐|游戏|软件|手机|电脑|价格|多少钱|快递|外卖|打车|地图|导航|搜索|下载|安装|注册|密码|登录/;
  if (NON_RELEVANT.test(q)) {
    return { safe: false, level: 'irrelevant', reason: '🔮 我是命理占卜助手，擅长八字、星座、塔罗、梅花易数等分析。\n\n您可以问我：\n• 今年运势如何？\n• 事业方向建议\n• 感情运势分析\n• 财运走势\n• 性格与天赋\n\n请输入与命理占卜相关的问题，我来为您解读 ✦' };
  }
  if (!RELEVANT_KEYWORDS.test(q) && !GENERAL_QUESTION.test(q)) {
    return { safe: false, level: 'irrelevant', reason: '🔮 我是命理占卜助手，擅长八字、星座、塔罗、梅花易数等分析。\n\n您可以问我：\n• 今年运势如何？\n• 事业方向建议\n• 感情运势分析\n• 财运走势\n• 性格与天赋\n\n请输入与命理占卜相关的问题，我来为您解读 ✦' };
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

  // 时辰缺失提示
  let hourDisclaimer = '';
  if (options.hourUnknown || profile.hour === -1 || profile.hour === undefined) {
    hourDisclaimer = '\n\n【重要】用户不知道自己的出生时辰，无法确定时柱。请基于年柱、月柱、日柱进行分析，时柱相关内容（如子女宫、晚运）请明确标注"因缺少时辰信息，以下为参考推测"。不要编造时柱。';
  } else if (options.hourApprox) {
    hourDisclaimer = '\n\n【注意】用户提供的出生时辰为大致时段估计（非精确），时柱可能有偏差。分析时柱相关内容时请注明"基于大致时段推算"。';
  }

  const systemPrompt = buildPrompt(mode, dm, question) + categoryHint + sensitiveDisclaimer + hourDisclaimer + engineData;
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

/**
 * Extract structured data for frontend visualization
 * Called alongside calculateAll, returns JSON-safe object
 */
function extractStructured(mode, profile) {
  const p = {
    year: parseInt(profile.year), month: parseInt(profile.month),
    day: parseInt(profile.day), hour: parseInt(profile.hour),
    gender: profile.gender || 'male', longitude: profile.longitude,
  };
  try {
    if (mode === 'bazi') {
      const r = baziEngine.calculate(p);
      // Generate 5 personality cards from engine data
      const dm = r.dayMaster;
      const el = r.dayMasterElement;
      const str = r.dayStrength;
      const ss = r.shishen || {};
      const WX_RELATION = {木:{生:'火',克:'土',被克:'金',被生:'水'},火:{生:'土',克:'金',被克:'水',被生:'木'},土:{生:'金',克:'水',被克:'木',被生:'火'},金:{生:'水',克:'木',被克:'火',被生:'土'},水:{生:'木',克:'火',被克:'土',被生:'金'}};
      const rel = WX_RELATION[el] || {};
      const SS_RELATION = {
        '比肩':'平等合作型，需要独立空间',
        '劫财':'竞争激励型，在碰撞中成长',
        '食神':'温和滋养型，给予不求回报',
        '伤官':'表达创造型，追求精神共鸣',
        '偏财':'灵活社交型，广结善缘但不深',
        '正财':'稳定务实型，重视承诺和安全',
        '七杀':'挑战激励型，需要强者相伴',
        '正官':'互相尊重型，看重规则与边界',
        '偏印':'独立思考型，需要理解而非控制',
        '正印':'被关爱型，享受被照顾的感觉',
      };
      const hourSS = ss.hourTg || '比肩';
      const hourKnown = p.hour >= 0 && !isNaN(p.hour);
      const cards = [
        { id:'personality', title:'人格卡', icon:'✦', color:'#8B5CF6',
          subtitle:'核心性格特质',
          main: (r.personality?.type||dm+el) + '·' + dm + el,
          traits: r.personality?.traits || [],
          desc: r.personality?.simple || `日主${dm}${el}，${str}` },
        { id:'relation', title:'关系模式卡', icon:'◈', color:'#0D9488',
          subtitle:'关系中的角色',
          main: hourKnown ? hourSS + '格·' + (SS_RELATION[hourSS]||'').split('，')[0] : str+'·关系模式',
          traits: [
            hourKnown?`时柱${hourSS}：${(SS_RELATION[hourSS]||'').split('，')[0]}`:'时柱未知：补充时辰可解锁完整分析',
            str==='身强'?'倾向主导关系':'倾向被动接受',
            `${el}生${rel.生||''}：善于给予${rel.生||''}型能量`,
            r.wuxingLack?.length?`缺${r.wuxingLack.join('')}：需要伴侣补充`:'五行均衡：适应性强',
          ],
          desc: hourKnown?`在关系中你是${hourSS}型人格。${SS_RELATION[hourSS]||''}`:`${str}之人，${str==='身强'?'倾向主导关系，需要能包容你的伴侣':'善于借力合作，需要支持型伴侣'}。补充出生时辰可获得更精准的关系分析。` },
        { id:'strength', title:'优势卡', icon:'◆', color:'#22C55E',
          subtitle:'你的核心优势',
          main: r.personality?.traits?.[0] || '坚韧',
          traits: [
            ...(r.personality?.traits?.slice(0,2)||[]),
            str==='身强'?'执行力强，说做就做':'观察力敏锐，思虑周全',
            `${el}属性：${el==='金'?'决断力':el==='木'?'成长力':el==='水'?'智慧':el==='火'?'行动力':'包容力'}突出`,
          ],
          desc: `你最大的优势是${r.personality?.traits?.[0]||'坚韧'}。${str==='身强'?'身强之人行动力十足，适合开拓创新':'身弱之人善于借力，适合合作共赢'}。` },
        { id:'risk', title:'风险提示卡', icon:'◇', color:'#F59E0B',
          subtitle:'需要注意',
          main: r.personality?.traits?.[3] || '过度消耗',
          traits: [
            ...(r.personality?.traits?.slice(2,4)||[]),
            str==='身强'?'容易过于强势，忽略他人感受':'容易过度迁就，忽略自身需求',
            `${el}过旺时：${el==='金'?'过于尖锐':el==='木'?'过于固执':el==='水'?'优柔寡断':el==='火'?'急躁冲动':'墨守成规'}`,
          ],
          desc: `你需要注意${r.personality?.traits?.[3]||'平衡'}的倾向。${r.wuxingLack?.length?`五行缺${r.wuxingLack.join('')}，对应方面需要额外关注。`:'五行较均衡，但仍需注意过旺元素的影响。'}` },
        { id:'action', title:'行动建议卡', icon:'▸', color:'#3B82F6',
          subtitle:'今天可以做的事',
          main: `补${r.wuxingLack?.[0]||rel.被克||el}·调和五行`,
          traits: [
            `多接触${rel.被生||'水'}元素事物（颜色/方位/食物）`,
            str==='身强'?'练习倾听，给他人更多表达空间':'坚定立场，适当说"不"',
            `每日冥想5分钟，感受${el}的能量流动`,
            `本周尝试一件${rel.克||'木'}属性的活动`,
          ],
          desc: `今天的建议：${str==='身强'?'收敛锋芒，以柔克刚':'坚定信念，积蓄力量'}。` },
      ];
      return {
        mode: 'bazi',
        dayMaster: r.dayMaster, element: r.dayMasterElement,
        strength: r.dayStrength, geju: r.geju,
        wuxing: r.wuxing, wuxingLack: r.wuxingLack,
        fourPillars: r.fourPillars, nayin: r.nayin,
        personality: r.personality, shishen: r.shishen,
        favorWx: r.xpiUshen?.favorWx, avoidWx: r.xpiUshen?.avoidWx,
        shengxiao: r.lunarDate?.shengxiao,
        lunarDate: r.lunarDate,
        personalityCards: cards,
      };
    }
    if (mode === 'astrology') {
      const r = astrologyEngine.calculate(p);
      return {
        mode: 'astrology',
        sunSign: r.sunSign, moonSign: r.moonSign, risingSign: r.risingSign,
        planets: r.planets,
      };
    }
    if (mode === 'hehun' || mode === 'synastry' || mode === 'hepan') {
      // pair modes - need profileB
      return { mode };
    }
    return { mode };
  } catch(e) { return { mode, error: e.message }; }
}

if (require.main === module) test();
module.exports = { buildRequest, calculateAll, createContext, extractStructured, DIVINATION_DISCLAIMER };
