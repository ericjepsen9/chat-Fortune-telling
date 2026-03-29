/**
 * 八字命理引擎 v3 — 基于 lunar-javascript 精确计算
 * 节气定月 · 精确日柱 · 大运计算
 */
const { Solar } = require('lunar-javascript');

const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DZ_ALL = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WX_MAP = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const DZ_WX = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
const YY_MAP = { 甲:'阳',乙:'阴',丙:'阳',丁:'阴',戊:'阳',己:'阴',庚:'阳',辛:'阴',壬:'阳',癸:'阴' };

const SS_TABLE = {
  甲:{甲:'比肩',乙:'劫财',丙:'食神',丁:'伤官',戊:'偏财',己:'正财',庚:'七杀',辛:'正官',壬:'偏印',癸:'正印'},
  乙:{甲:'劫财',乙:'比肩',丙:'伤官',丁:'食神',戊:'正财',己:'偏财',庚:'正官',辛:'七杀',壬:'正印',癸:'偏印'},
  丙:{甲:'偏印',乙:'正印',丙:'比肩',丁:'劫财',戊:'食神',己:'伤官',庚:'偏财',辛:'正财',壬:'七杀',癸:'正官'},
  丁:{甲:'正印',乙:'偏印',丙:'劫财',丁:'比肩',戊:'伤官',己:'食神',庚:'正财',辛:'偏财',壬:'正官',癸:'七杀'},
  戊:{甲:'七杀',乙:'正官',丙:'偏印',丁:'正印',戊:'比肩',己:'劫财',庚:'食神',辛:'伤官',壬:'偏财',癸:'正财'},
  己:{甲:'正官',乙:'七杀',丙:'正印',丁:'偏印',戊:'劫财',己:'比肩',庚:'伤官',辛:'食神',壬:'正财',癸:'偏财'},
  庚:{甲:'偏财',乙:'正财',丙:'七杀',丁:'正官',戊:'偏印',己:'正印',庚:'比肩',辛:'劫财',壬:'食神',癸:'伤官'},
  辛:{甲:'正财',乙:'偏财',丙:'正官',丁:'七杀',戊:'正印',己:'偏印',庚:'劫财',辛:'比肩',壬:'伤官',癸:'食神'},
  壬:{甲:'食神',乙:'伤官',丙:'偏财',丁:'正财',戊:'七杀',己:'正官',庚:'偏印',辛:'正印',壬:'比肩',癸:'劫财'},
  癸:{甲:'伤官',乙:'食神',丙:'正财',丁:'偏财',戊:'正官',己:'七杀',庚:'正印',辛:'偏印',壬:'劫财',癸:'比肩'},
};

const DM_PERSONA = {
  甲: { type: '参天大树', traits: ['正直担当','有领导力','有责任心','较固执'], simple: '你像一棵参天大树，正直有担当，天生的领导者' },
  乙: { type: '花草藤蔓', traits: ['柔韧灵活','善于适应','温和细腻','有韧性'], simple: '你像藤蔓花草，柔中带韧，善于在任何环境中生长' },
  丙: { type: '太阳光芒', traits: ['热情大方','光明磊落','有感染力','略冲动'], simple: '你像太阳一样热情大方，走到哪里都能照亮别人' },
  丁: { type: '烛火星光', traits: ['细腻温暖','内敛深思','专注执着','有洞察力'], simple: '你像烛火般温暖而专注，虽不张扬却能照亮重要的角落' },
  戊: { type: '高山大地', traits: ['稳重厚实','诚信可靠','包容力强','行动偏慢'], simple: '你像大地一样稳重可靠，是朋友心中最踏实的存在' },
  己: { type: '田园沃土', traits: ['务实细致','善于规划','低调内敛','心思缜密'], simple: '你像沃土一样默默滋养周围的人，务实且有规划感' },
  庚: { type: '刀剑利器', traits: ['果断刚毅','正义感强','有魄力','较强势'], simple: '你像利剑一样果断刚毅，做事不拖泥带水' },
  辛: { type: '珠宝美玉', traits: ['敏锐精致','审美力强','追求完美','情感细腻'], simple: '你像美玉一样精致敏锐，对美有独特的感知力' },
  壬: { type: '江河大海', traits: ['聪明机敏','思维活跃','适应力强','胸怀宽广'], simple: '你像大海一样包容，思维活跃，充满智慧' },
  癸: { type: '雨露清泉', traits: ['感性细腻','直觉力强','善解人意','想象丰富'], simple: '你像清泉一样温润灵动，有着敏锐的直觉和丰富的情感世界' },
};

const CHONG = { 子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳' };
const LIUHE = { 子:'丑',丑:'子',寅:'亥',卯:'戌',辰:'酉',巳:'申',午:'未',未:'午',申:'巳',酉:'辰',戌:'卯',亥:'寅' };
const SANHE = { 申子辰:'水', 寅午戌:'火', 亥卯未:'木', 巳酉丑:'金' };

function calculate(input) {
  const { year, month, day, hour, gender, longitude } = input;
  const hourUnknown = parseInt(hour) < 0 || isNaN(parseInt(hour));
  const origH = hourUnknown ? 12 : parseInt(hour); // 时辰未知时用午时(12)做基础计算
  let h = origH;

  // 真太阳时校正 = 经度校正 + 均时差(Equation of Time)
  let trueSolarTimeAdj = 0;
  const lng = parseFloat(longitude);
  const y0 = parseInt(year), m0 = parseInt(month), d0 = parseInt(day);
  if (lng && !isNaN(lng)) {
    // 1. 经度校正：(经度-120°)×4分钟
    const lngAdj = (lng - 120) * 4;
    // 2. 均时差：地球椭圆轨道导致的时间偏差（最大±16分钟）
    const jd = require('astronomia').julian.CalendarGregorianToJD(y0, m0, d0);
    const n = jd - 2451545.0;
    const L = (280.460 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
    const epsilon = (23.439 - 0.0000004 * n) * Math.PI / 180;
    const tanE2 = Math.tan(epsilon / 2); const yy = tanE2 * tanE2;
    const LRad = L * Math.PI / 180;
    const eot = (yy * Math.sin(2*LRad) - 2*0.0167*Math.sin(g) + 4*0.0167*yy*Math.sin(g)*Math.cos(2*LRad)) * 180/Math.PI * 4;
    trueSolarTimeAdj = Math.round(lngAdj + eot);
    const totalMin = origH * 60 + trueSolarTimeAdj;
    h = Math.floor(((totalMin % 1440) + 1440) % 1440 / 60);
  }

  const solar = Solar.fromYmdHms(y0, m0, d0, h, trueSolarTimeAdj ? Math.abs(((origH*60+trueSolarTimeAdj)%60+60)%60) : 0, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  // 农历信息（供用户校验）
  const lunarDate = {
    full: `农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    shengxiao: lunar.getYearShengXiao(),
    yearGanzhi: ec.getYear(),
    solarStr: `公历${year}年${month}月${day}日 ${origH}时${trueSolarTimeAdj ? '（真太阳时校正' + (trueSolarTimeAdj > 0 ? '+' : '') + trueSolarTimeAdj + '分钟）' : ''}`,
  };

  const yGZ = ec.getYear(), mGZ = ec.getMonth(), dGZ = ec.getDay(), tGZ = ec.getTime();
  const dm = dGZ[0], dmWx = WX_MAP[dm];
  const nayin = { year: ec.getYearNaYin(), month: ec.getMonthNaYin(), day: ec.getDayNaYin(), hour: ec.getTimeNaYin() };
  const stages = { year: ec.getYearDiShi(), month: ec.getMonthDiShi(), day: ec.getDayDiShi(), hour: ec.getTimeDiShi() };
  const shishen = { yearTg: SS_TABLE[dm][yGZ[0]], monthTg: SS_TABLE[dm][mGZ[0]], dayTg: '日主', hourTg: SS_TABLE[dm][tGZ[0]] };

  const mapCG = arr => arr.map(g => ({ gan: g, ss: SS_TABLE[dm][g], wx: WX_MAP[g] }));
  const cangganShishen = { year: mapCG(ec.getYearHideGan()), month: mapCG(ec.getMonthHideGan()), day: mapCG(ec.getDayHideGan()), hour: mapCG(ec.getTimeHideGan()) };

  // 五行统计（天干+地支加权藏干）
  const wuxing = { 金:0, 木:0, 水:0, 火:0, 土:0 };
  // 天干各1.0
  [yGZ[0], mGZ[0], dGZ[0], tGZ[0]].forEach(g => { if (WX_MAP[g]) wuxing[WX_MAP[g]] += 1.0; });
  // 地支藏干加权：本气1.0，中气0.5，余气0.3
  const weights = [1.0, 0.5, 0.3];
  [ec.getYearHideGan(), ec.getMonthHideGan(), ec.getDayHideGan(), ec.getTimeHideGan()].forEach(cg => {
    cg.forEach((g, i) => { if (WX_MAP[g]) wuxing[WX_MAP[g]] += (weights[i] || 0.3); });
  });
  // Round for display
  Object.keys(wuxing).forEach(k => { wuxing[k] = Math.round(wuxing[k] * 10) / 10; });
  const wuxingLack = Object.entries(wuxing).filter(([,v]) => v === 0).map(([k]) => k);

  // 身强身弱 + 从格检测
  const monthDzWx = DZ_WX[mGZ[1]];
  const SHENG_MAP = { 金:'土', 水:'金', 木:'水', 火:'木', 土:'火' };

  // 月令司令深浅（节气内哪段天干当令）
  let monthCommander = null;
  try {
    const prevJie = lunar.getPrevJie(), nextJie = lunar.getNextJie();
    if (prevJie && nextJie) {
      const pS = prevJie.getSolar(), nS = nextJie.getSolar();
      const pDate = new Date(pS.getYear(), pS.getMonth()-1, pS.getDay());
      const nDate = new Date(nS.getYear(), nS.getMonth()-1, nS.getDay());
      const bDate = new Date(parseInt(year), parseInt(month)-1, parseInt(day));
      const diffDays = Math.round((bDate - pDate) / 86400000);
      const totalDays = Math.round((nDate - pDate) / 86400000);
      const frac = totalDays > 0 ? diffDays / totalDays : 0.5;
      const mCG = ec.getMonthHideGan();
      if (mCG.length === 1) monthCommander = { gan: mCG[0], wx: WX_MAP[mCG[0]], type: '本气', frac };
      else if (mCG.length === 2) monthCommander = frac < 0.5 ? { gan: mCG[1], wx: WX_MAP[mCG[1]], type: '余气', frac } : { gan: mCG[0], wx: WX_MAP[mCG[0]], type: '本气', frac };
      else monthCommander = frac < 0.3 ? { gan: mCG[2], wx: WX_MAP[mCG[2]], type: '余气', frac } : frac < 0.6 ? { gan: mCG[1], wx: WX_MAP[mCG[1]], type: '中气', frac } : { gan: mCG[0], wx: WX_MAP[mCG[0]], type: '本气', frac };
    }
  } catch(e) {}

  // 月令帮扶力（使用司令天干五行，更精确）
  const cmdWx = monthCommander ? monthCommander.wx : monthDzWx;
  const monthHelp = (cmdWx === dmWx) ? 2 : (SHENG_MAP[dmWx] === cmdWx) ? 1.5 : 0;
  const sameCount = wuxing[dmWx] || 0;
  const yinCount = wuxing[SHENG_MAP[dmWx]] || 0;
  const totalHelp = sameCount + yinCount * 0.7 + monthHelp;
  const totalAll = Object.values(wuxing).reduce((a,b) => a+b, 0);
  const helpRatio = totalHelp / totalAll;

  let dayStrength, isSpecialGeju = false;
  // 克泄耗力量（食伤+财+官杀）
  const xieLv = ['食伤','财','官杀'];
  const shengMap2 = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };
  const keMap2 = { 木:'土', 火:'金', 土:'水', 金:'木', 水:'火' };
  const foodWx = shengMap2[dmWx]; // 食伤五行 = 日主所生
  const wealthWx = keMap2[dmWx]; // 财星五行 = 日主所克
  const officerWx = SHENG_MAP[dmWx] ? keMap2[SHENG_MAP[dmWx]] : ''; // 官杀 = 克日主
  const leakRatio = ((wuxing[foodWx]||0) + (wuxing[wealthWx]||0)) / totalAll;
  // 天干杂气检查：食伤/财/官是否透干
  const otherTgAll = [yGZ[0], mGZ[0], tGZ[0]].filter(g => g !== dm);
  const hasTouGanLeak = otherTgAll.some(g => {
    const gWx = WX_MAP[g];
    return gWx === foodWx || gWx === wealthWx;
  });
  const foodCount = (wuxing[foodWx]||0);
  
  // 从强格：帮身比极高 + 月令助身 + 无明显杂气（食伤<15%且不透干）
  if (helpRatio >= 0.65 && monthHelp >= 1.5 && foodCount / totalAll < 0.15 && !hasTouGanLeak) {
    dayStrength = '从强'; isSpecialGeju = true;
  }
  // 从弱格：日主五行+印星占比 <= 15%，月令不助身
  else if (helpRatio <= 0.18 && monthHelp === 0) {
    dayStrength = '从弱'; isSpecialGeju = true;
  }
  // 专旺格（日主五行占比极高）
  else if ((sameCount / totalAll) >= 0.55 && monthDzWx === dmWx) {
    dayStrength = '专旺'; isSpecialGeju = true;
  }
  else {
    // 身极强（接近从强但有杂气）
    if (helpRatio >= 0.65 && monthHelp >= 1.5) {
      dayStrength = '身极强';
    } else {
      dayStrength = helpRatio >= 0.45 ? '身强' : helpRatio <= 0.3 ? '身弱' : '中和';
    }
  }

  // 格局判定
  const monthCG = ec.getMonthHideGan();
  const otherTg = [yGZ[0], tGZ[0]];
  let geju = '';

  // 特殊格局优先
  if (isSpecialGeju) {
    if (dayStrength === '从强') geju = '从强格';
    else if (dayStrength === '从弱') geju = '从弱格';
    else if (dayStrength === '专旺') {
      const zwMap = { 木:'曲直格', 火:'炎上格', 土:'稼穑格', 金:'从革格', 水:'润下格' };
      geju = zwMap[dmWx] || '专旺格';
    }
  } else {
    // 正统格局：看月支藏干透出天干的十神
    for (const g of monthCG) {
      if (g === dm) continue;
      if (otherTg.includes(g)) {
        const ss = SS_TABLE[dm][g];
        if (ss !== '比肩' && ss !== '劫财') { geju = ss + '格'; break; }
      }
    }
    if (!geju && monthCG.length > 0) {
      const ss = SS_TABLE[dm][monthCG[0]];
      if (ss !== '比肩' && ss !== '劫财') geju = ss + '格';
      else if (monthCG.length > 1) {
        const ss2 = SS_TABLE[dm][monthCG[1]];
        if (ss2 !== '比肩' && ss2 !== '劫财') geju = ss2 + '格';
      }
    }
    if (!geju) {
      const yangrenMap = { 甲:'卯',丙:'午',戊:'午',庚:'酉',壬:'子',乙:'寅',丁:'巳',己:'巳',辛:'申',癸:'亥' };
      geju = (mGZ[1] === yangrenMap[dm]) ? '羊刃格' : '建禄格';
    }
  }

  // 喜用忌（从格反转）
  const SHENG = { 金:'水', 水:'木', 木:'火', 火:'土', 土:'金' };
  const KE_SHENG = { 金:'土', 水:'金', 木:'水', 火:'木', 土:'火' };
  let xiyong, jishen;
  if (dayStrength === '从强' || dayStrength === '专旺') {
    // 从强/专旺：顺其旺势，喜印比，忌食伤财官
    xiyong = `${dmWx}、${KE_SHENG[dmWx]}`;
    jishen = `${SHENG[dmWx]}、${SHENG[SHENG[dmWx]]}`;
  } else if (dayStrength === '从弱') {
    // 从弱：弃命从势，喜食伤财官（最旺的五行），忌印比
    xiyong = `${SHENG[dmWx]}、${SHENG[SHENG[dmWx]]}`;
    jishen = `${dmWx}、${KE_SHENG[dmWx]}`;
  } else if (dayStrength === '身极强') {
    // 身极强（带从强倾向）：以顺势为主，喜印比，但食伤泄秀亦可
    xiyong = `${dmWx}、${KE_SHENG[dmWx]}`;
    jishen = `${SHENG[SHENG[dmWx]]}、${SHENG[SHENG[SHENG[dmWx]]]}`;
  } else if (dayStrength === '身强') {
    xiyong = `${SHENG[dmWx]}、${SHENG[SHENG[dmWx]]}`;
    jishen = `${dmWx}、${KE_SHENG[dmWx]}`;
  } else {
    xiyong = `${dmWx}、${KE_SHENG[dmWx]}`;
    jishen = `${SHENG[dmWx]}、${SHENG[SHENG[dmWx]]}`;
  }

  // 调候用神（季节对日主的影响）
  const monthNum = parseInt(month);
  const season = monthNum >= 3 && monthNum <= 5 ? '春' : monthNum >= 6 && monthNum <= 8 ? '夏' : monthNum >= 9 && monthNum <= 11 ? '秋' : '冬';
  const TIAOHOU = {
    木: { 冬:'需火暖局调候，丙火为先', 夏:'需水润木，癸水为先', 春:'', 秋:'需水生木，壬癸为先' },
    火: { 冬:'需木生火调候，甲木为先', 秋:'需木助火，甲乙为先', 春:'', 夏:'需水制火，壬水为先' },
    土: { 冬:'需火暖土调候，丙火为先', 夏:'需水润土，癸水为先', 春:'需木疏土，甲木为先', 秋:'' },
    金: { 夏:'需水洗金调候，壬水为先', 冬:'需火暖金，丙丁为先', 春:'', 秋:'' },
    水: { 夏:'需金生水调候，庚辛为先', 春:'需土止水，戊己为先', 秋:'', 冬:'' },
  };
  const tiaohou = TIAOHOU[dmWx]?.[season] || '';

  // 天干五合检测（只检查相邻天干 + 合化判断）
  const HE_MAP = {甲:'己',己:'甲',乙:'庚',庚:'乙',丙:'辛',辛:'丙',丁:'壬',壬:'丁',戊:'癸',癸:'戊'};
  const HE_WX = {甲:'土',己:'土',乙:'金',庚:'金',丙:'水',辛:'水',丁:'木',壬:'木',戊:'火',癸:'火'};
  const tgArr = [{g:yGZ[0],l:'年'},{g:mGZ[0],l:'月'},{g:dGZ[0],l:'日'},{g:tGZ[0],l:'时'}];
  const tianganHe = [];
  // 只检查相邻柱：年-月、月-日、日-时
  for (let i=0;i<3;i++) {
    const j = i+1;
    if (HE_MAP[tgArr[i].g] === tgArr[j].g) {
      const huaWx = HE_WX[tgArr[i].g];
      const isHua = monthDzWx === huaWx || SHENG_MAP[huaWx] === monthDzWx;
      tianganHe.push({ pair:`${tgArr[i].l}干${tgArr[i].g}${tgArr[j].l}干${tgArr[j].g}`, huaWx, isHua, desc: isHua ? `合化${huaWx}（化成）` : `合而不化${huaWx}（合绊）` });
    }
  }

  // 胎元（月干进一位 + 月支进三位）
  const taiyuan = TG[(TG.indexOf(mGZ[0]) + 1) % 10] + DZ_ALL[(DZ_ALL.indexOf(mGZ[1]) + 3) % 12];
  // 命宫（用月支和时支推算：14-月支序号-时支序号→寅起排）
  const mDzIdx = DZ_ALL.indexOf(mGZ[1]), tDzIdx = DZ_ALL.indexOf(tGZ[1]);
  const mingGongDzIdx = ((14 - mDzIdx - tDzIdx) % 12 + 12) % 12;
  const mingGongTgIdx = (TG.indexOf(yGZ[0]) * 2 + 2 + mingGongDzIdx) % 10; // 年干定月干起头
  const mingGong = TG[mingGongTgIdx] + DZ_ALL[mingGongDzIdx];

  // 神煞
  const shensha = [];
  const dzArr4 = [yGZ[1], mGZ[1], dGZ[1], tGZ[1]];
  const taohua = { 寅:'卯',午:'卯',戌:'卯', 亥:'子',卯:'子',未:'子', 申:'酉',子:'酉',辰:'酉', 巳:'午',酉:'午',丑:'午' };
  const th = taohua[dGZ[1]];
  if (th && dzArr4.some((z,i) => i !== 2 && z === th)) shensha.push({ name: '桃花', pos: dzArr4.indexOf(th) < 2 ? ['年支','月支'][dzArr4.indexOf(th)] : '时支', desc: '人缘好、异性缘旺' });

  const tiyi = { 甲:['丑','未'], 乙:['子','申'], 丙:['亥','酉'], 丁:['亥','酉'], 戊:['丑','未'], 己:['子','申'], 庚:['丑','未'], 辛:['寅','午'], 壬:['卯','巳'], 癸:['卯','巳'] };
  if (tiyi[dm]) dzArr4.forEach((z,i) => { if (i!==2 && tiyi[dm].includes(z)) shensha.push({ name: '天乙贵人', pos: ['年支','月支','日支','时支'][i], desc: '逢凶化吉、贵人相助' }); });

  const wenchang = { 甲:'巳',乙:'午',丙:'申',丁:'酉',戊:'申',己:'酉',庚:'亥',辛:'子',壬:'寅',癸:'卯' };
  if (dzArr4.includes(wenchang[dm])) shensha.push({ name: '文昌', pos: '命中', desc: '聪慧好学、文采出众' });

  const yima = { 寅:'申',申:'寅',巳:'亥',亥:'巳',子:'寅',午:'申',卯:'巳',酉:'亥',辰:'寅',戌:'申',丑:'亥',未:'巳' };
  if (dzArr4.some((z,i) => i!==2 && z===yima[dGZ[1]])) shensha.push({ name: '驿马', pos: '命中', desc: '利于远行、奔波变动' });

  // 将星（日支三合局中间字）
  const jiangxingMap = { 子:'子',丑:'丑',寅:'寅',卯:'卯',辰:'辰',巳:'巳',午:'午',未:'未',申:'申',酉:'酉',戌:'戌',亥:'亥',
    /* 三合中字 */ };
  const jxMap = {寅:'午',午:'寅',戌:'午', 亥:'卯',卯:'亥',未:'卯', 申:'子',子:'申',辰:'子', 巳:'酉',酉:'巳',丑:'酉'};
  // 将星 = 年支三合局的中字
  const sanheMiddle = {子:'申',丑:'巳',寅:'午',卯:'亥',辰:'子',巳:'酉',午:'寅',未:'卯',申:'子',酉:'巳',戌:'午',亥:'卯'};
  // 简化：看年支三合局帝旺位是否在命中
  const jxTarget = sanheMiddle[yGZ[1]];
  if (jxTarget && dzArr4.includes(jxTarget)) shensha.push({ name: '将星', pos: '命中', desc: '有领导力、组织能力强' });

  // 红鸾天喜（以年支推）
  const hongluanMap = {子:'卯',丑:'寅',寅:'丑',卯:'子',辰:'亥',巳:'戌',午:'酉',未:'申',申:'未',酉:'午',戌:'巳',亥:'辰'};
  const tianxiMap = {子:'酉',丑:'申',寅:'未',卯:'午',辰:'巳',巳:'辰',午:'卯',未:'寅',申:'丑',酉:'子',戌:'亥',亥:'戌'};
  if (dzArr4.includes(hongluanMap[yGZ[1]])) shensha.push({ name: '红鸾', pos: '命中', desc: '利于婚恋、感情有喜' });
  if (dzArr4.includes(tianxiMap[yGZ[1]])) shensha.push({ name: '天喜', pos: '命中', desc: '喜庆之事、人缘佳' });

  // 太极贵人
  const taijiMap = {甲:['子','午'],乙:['子','午'],丙:['卯','酉'],丁:['卯','酉'],戊:['辰','戌','丑','未'],己:['辰','戌','丑','未'],庚:['寅','亥'],辛:['寅','亥'],壬:['巳','申'],癸:['巳','申']};
  if (taijiMap[dm]) dzArr4.forEach((z,i) => { if (i!==2 && taijiMap[dm].includes(z)) shensha.push({ name: '太极贵人', pos: ['年支','月支','日支','时支'][i], desc: '善于思考、有悟性' }); });

  // 金舆（日干推）
  const jinyuMap = {甲:'辰',乙:'巳',丙:'未',丁:'申',戊:'未',己:'申',庚:'戌',辛:'亥',壬:'丑',癸:'寅'};
  if (dzArr4.includes(jinyuMap[dm])) shensha.push({ name: '金舆', pos: '命中', desc: '出行有助、配偶条件好' });

  // 流年桃花分析（今年哪些月份桃花旺）
  const taohuaTarget = taohua[dGZ[1]]; // 日支推桃花位
  const lnDzNow = Solar.fromYmdHms(new Date().getFullYear(), 6, 15, 12, 0, 0).getLunar().getEightChar().getYear()[1];
  const taohuaInfo = { target: taohuaTarget || '', inNatalChart: taohuaTarget && dzArr4.some((z,i)=>i!==2&&z===taohuaTarget), liunianHit: taohuaTarget === lnDzNow };
  if (taohuaInfo.liunianHit) shensha.push({ name: '流年桃花', pos: '流年', desc: '今年异性缘特别旺，感情机会多' });

  // 天干冲克（相邻天干七杀关系 = 冲克）
  const TGCHONG = {甲:'庚',庚:'甲',乙:'辛',辛:'乙',丙:'壬',壬:'丙',丁:'癸',癸:'丁'};
  const tianganChong = [];
  for (let i=0;i<3;i++) {
    const a = tgArr[i], b = tgArr[i+1];
    if (TGCHONG[a.g] === b.g) tianganChong.push({ pair:`${a.l}干${a.g}${b.l}干${b.g}`, desc:`${a.g}${b.g}相冲克（紧张对抗）` });
  }

  // 地支暗合（稍后在dizhiRelations中添加）
  const ANHE = {寅:'丑',丑:'寅', 卯:'申',申:'卯', 午:'亥',亥:'午'};

  // 地支关系（冲/合/刑/害/三合/三会）
  const dzLabeled = [{z:yGZ[1],l:'年'},{z:mGZ[1],l:'月'},{z:dGZ[1],l:'日'},{z:tGZ[1],l:'时'}];
  const dizhiRelations = [];
  // 六冲/六合
  for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) {
    if (CHONG[dzLabeled[i].z]===dzLabeled[j].z) dizhiRelations.push({ type:'六冲', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:'冲动变化' });
    if (LIUHE[dzLabeled[i].z]===dzLabeled[j].z) dizhiRelations.push({ type:'六合', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:'和合顺利' });
    if (ANHE[dzLabeled[i].z]===dzLabeled[j].z) dizhiRelations.push({ type:'暗合', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:'暗中牵引' });
  }
  // 三合局
  for (const [trio, el] of Object.entries(SANHE)) {
    const found = trio.split('').filter(c => dzArr4.includes(c));
    if (found.length >= 2) dizhiRelations.push({ type: found.length===3?'三合局':'半合', pair:found.join(''), desc:`合化${el}局` });
  }
  // 三会局
  const SANHUI = {'寅卯辰':'木','巳午未':'火','申酉戌':'金','亥子丑':'水'};
  for (const [trio, el] of Object.entries(SANHUI)) {
    const found = trio.split('').filter(c => dzArr4.includes(c));
    if (found.length >= 2) dizhiRelations.push({ type: found.length===3?'三会局':'半会', pair:found.join(''), desc:`会${el}局` });
  }
  // 地支刑
  const XING_PAIRS = [
    ['寅','巳','无恩之刑'], ['巳','申','无恩之刑'], ['申','寅','无恩之刑'],
    ['子','卯','无礼之刑'], ['卯','子','无礼之刑'],
    ['丑','未','恃势之刑'], ['未','戌','恃势之刑'], ['戌','丑','恃势之刑'],
    ['辰','辰','自刑'], ['午','午','自刑'], ['酉','酉','自刑'], ['亥','亥','自刑'],
  ];
  for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) {
    const xp = XING_PAIRS.find(([a,b]) => dzLabeled[i].z===a && dzLabeled[j].z===b);
    if (xp) dizhiRelations.push({ type:'相刑', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:xp[2] });
  }
  // 自刑检测（同一地支出现2次以上）
  const dzCount = {};
  dzArr4.forEach(z => { dzCount[z] = (dzCount[z]||0)+1; });
  for (const [z,c] of Object.entries(dzCount)) {
    if (c >= 2 && ['辰','午','酉','亥'].includes(z)) dizhiRelations.push({ type:'自刑', pair:z.repeat(c), desc:'自刑：内在矛盾' });
  }
  // 地支害
  const HAI = {子:'未',丑:'午',寅:'巳',卯:'辰',申:'亥',酉:'戌', 未:'子',午:'丑',巳:'寅',辰:'卯',亥:'申',戌:'酉'};
  for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) {
    if (HAI[dzLabeled[i].z]===dzLabeled[j].z) dizhiRelations.push({ type:'相害', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:'暗伤损耗' });
  }

  // 空亡（日柱旬中空亡）
  const dayTgIdx = TG.indexOf(dGZ[0]);
  const dayDzIdx = DZ_ALL.indexOf(dGZ[1]);
  const xunStart = ((dayDzIdx - dayTgIdx) % 12 + 12) % 12; // 旬首地支index
  const kong1 = DZ_ALL[(xunStart + 10) % 12];
  const kong2 = DZ_ALL[(xunStart + 11) % 12];
  const kongwang = [kong1, kong2];
  const kongInChart = dzArr4.filter(z => kongwang.includes(z));
  const kongwangInfo = { empty: kongwang, inChart: kongInChart, desc: `空亡：${kong1}${kong2}${kongInChart.length ? '（命中'+kongInChart.join('')+'落空亡）' : ''}` };

  // 流年
  const nowYear = new Date().getFullYear();
  const lnEc = Solar.fromYmdHms(nowYear, 6, 15, 12, 0, 0).getLunar().getEightChar();
  const lnGZ = lnEc.getYear(), lnTg = lnGZ[0], lnDz = lnGZ[1];
  const lnSS = SS_TABLE[dm][lnTg], lnTgWx = WX_MAP[lnTg];
  const lnDzRels = [];
  dzLabeled.forEach(({z,l}) => {
    if (CHONG[lnDz]===z) lnDzRels.push({ type:'六冲', target:`${l}支${z}`, desc:'冲动变化' });
    if (LIUHE[lnDz]===z) lnDzRels.push({ type:'六合', target:`${l}支${z}`, desc:'和合顺利' });
  });

  // 大运
  const gNum = (gender==='female'||gender==='f') ? 0 : 1;
  const yun = ec.getYun(gNum);
  const STAGE_LABEL = (age) => age < 12 ? '少年运' : age < 22 ? '青年运' : age < 32 ? '起步运' : age < 42 ? '上升运' : age < 52 ? '稳定运' : age < 62 ? '享福运' : age < 72 ? '安康运' : '长寿运';
  const dayuns = yun.getDaYun().filter(d => d.getGanZhi()).map(d => {
    const gz = d.getGanZhi(), sa = d.getStartAge(), sy = d.getStartYear();
    const tg = gz[0], dz = gz[1];
    const ss = SS_TABLE[dm][tg];
    const tgWx = WX_MAP[tg], dzWx = DZ_WX[dz];
    const isXi = xiyong.includes(tgWx);
    const isJi = jishen.includes(tgWx);
    const luck = isXi ? '吉' : isJi ? '凶' : '平';
    return { gz, startAge: sa, startYear: sy, endYear: sy + 10, label: STAGE_LABEL(sa), ss, tgWx, dzWx, luck };
  });
  const currentDayun = dayuns.find(d => nowYear>=d.startYear && nowYear<d.endYear) || dayuns[0];

  // 大运流年交互分析
  let dayunLiunianAnalysis = '';
  if (currentDayun) {
    const dyTg = currentDayun.gz[0], dyDz = currentDayun.gz[1];
    const parts = [];
    if (HE_MAP[dyTg] === lnTg) parts.push(`大运天干${dyTg}合流年天干${lnTg}（合化${HE_WX[dyTg]}）`);
    if (dyTg === lnTg) parts.push(`大运天干${dyTg}与流年天干${lnTg}比肩并行`);
    if (CHONG[dyDz] === lnDz) parts.push(`大运地支${dyDz}冲流年地支${lnDz}（变动剧烈）`);
    if (LIUHE[dyDz] === lnDz) parts.push(`大运地支${dyDz}合流年地支${lnDz}（顺利）`);
    const HAI_MAP = {子:'未',丑:'午',寅:'巳',卯:'辰',申:'亥',酉:'戌',未:'子',午:'丑',巳:'寅',辰:'卯',亥:'申',戌:'酉'};
    if (HAI_MAP[dyDz] === lnDz) parts.push(`大运地支${dyDz}害流年地支${lnDz}（暗耗）`);
    const dySS = SS_TABLE[dm][dyTg];
    parts.push(`大运天干${dyTg}对日主为${dySS}`);
    dayunLiunianAnalysis = parts.join('；');
    // 岁运并临（大运干支=流年干支，重大事件年）
    if (currentDayun.gz === lnGZ) dayunLiunianAnalysis += '；【岁运并临】大运与流年同柱，今年是重大转折之年';
    // 伏吟（大运干支与四柱某柱相同 → 悲伤重复）
    const fps = [yGZ, mGZ, dGZ, tGZ];
    const fuyinPillar = fps.find(fp => fp === currentDayun.gz);
    if (fuyinPillar) dayunLiunianAnalysis += `；【伏吟】大运${currentDayun.gz}与命局${fuyinPillar}相同，呻吟之象`;
    // 反吟（大运与四柱某柱天冲地冲 → 剧烈变动）
    const fanyinPillar = fps.find(fp => TGCHONG[fp[0]]===dyTg && CHONG[fp[1]]===dyDz);
    if (fanyinPillar) dayunLiunianAnalysis += `；【反吟】大运${currentDayun.gz}与命局${fanyinPillar}天冲地冲，巨变之象`;
  }

  // 十年小运（当前大运内逐年流年）
  const xiaoyun = [];
  if (currentDayun) {
    for (let yr = currentDayun.startYear; yr < currentDayun.endYear; yr++) {
      const yrEc = Solar.fromYmdHms(yr, 6, 15, 12, 0, 0).getLunar().getEightChar();
      const yrGZ = yrEc.getYear();
      const yrTg = yrGZ[0], yrDz = yrGZ[1];
      const yrSS = SS_TABLE[dm][yrTg];
      const yrTgWx = WX_MAP[yrTg];
      const isXi = xiyong.includes(yrTgWx);
      const isJi = jishen.includes(yrTgWx);
      let rating = isXi ? '吉' : isJi ? '凶' : '平';
      // 冲日支加凶
      if (CHONG[yrDz] === dGZ[1]) rating = rating === '吉' ? '吉中有变' : '凶（冲日）';
      xiaoyun.push({ year: yr, gz: yrGZ, ss: yrSS, rating, isCurrent: yr === nowYear });
    }
  }

  // 流月（当年12个月逐月分析）
  const liuyueList = [];
  for (let mi = 1; mi <= 12; mi++) {
    const midDay = Math.min(15, 28); // 每月中旬取干支
    try {
      const mEc = Solar.fromYmdHms(nowYear, mi, midDay, 12, 0, 0).getLunar().getEightChar();
      const mGZStr = mEc.getMonth();
      const mTg2 = mGZStr[0], mDz2 = mGZStr[1];
      const mSS = SS_TABLE[dm][mTg2];
      const mTgWx = WX_MAP[mTg2];
      const isXi = xiyong.includes(mTgWx);
      const isJi = jishen.includes(mTgWx);
      let rating = isXi ? '吉' : isJi ? '凶' : '平';
      if (CHONG[mDz2] === dGZ[1]) rating += '（冲日）';
      if (LIUHE[mDz2] === dGZ[1]) rating += '（合日）';
      if (taohuaTarget && mDz2 === taohuaTarget) rating += '（桃花月）';
      const nowMonth = new Date().getMonth() + 1;
      liuyueList.push({ month: mi, gz: mGZStr, ss: mSS, rating, isCurrent: mi === nowMonth });
    } catch(e) { /* skip */ }
  }

  // 五行健康映射
  const WX_HEALTH = {
    木: { organ:'肝胆', risk:'肝胆、眼睛、筋骨、头部', advice:'忌熬夜、忌酗酒、宜舒缓运动' },
    火: { organ:'心脏', risk:'心脑血管、血压、视力、小肠', advice:'忌急躁、忌过劳、宜静心养神' },
    土: { organ:'脾胃', risk:'脾胃消化、肌肉、皮肤', advice:'忌暴饮暴食、宜规律饮食' },
    金: { organ:'肺部', risk:'呼吸系统、肺、大肠、皮肤过敏', advice:'忌吸烟、防风寒、宜呼吸锻炼' },
    水: { organ:'肾脏', risk:'肾、泌尿系统、腰肩、关节、睡眠', advice:'忌受寒、防湿气、宜温补' },
  };
  const healthWarn = [];
  const sortedWx = Object.entries(wuxing).sort((a,b) => b[1]-a[1]);
  if (sortedWx[0][1] >= 3) healthWarn.push({ type:'旺', wx:sortedWx[0][0], ...WX_HEALTH[sortedWx[0][0]], desc:`${sortedWx[0][0]}旺（${sortedWx[0][1]}）→ ${WX_HEALTH[sortedWx[0][0]].organ}功能过亢` });
  wuxingLack.forEach(wx => { if (WX_HEALTH[wx]) healthWarn.push({ type:'缺', wx, ...WX_HEALTH[wx], desc:`缺${wx} → ${WX_HEALTH[wx].organ}偏弱` }); });
  const badMonths = liuyueList.filter(m => m.rating.startsWith('凶')).map(m => m.month);
  const goodMonths = liuyueList.filter(m => m.rating.startsWith('吉')).map(m => m.month);

  // 时支性格
  const DZ_TRAIT = {
    子:'深沉内敛、思维活跃、夜间精力旺', 丑:'踏实稳重、善于积累、大器晚成',
    寅:'有冲劲、敢闯敢拼、早起型', 卯:'温和有礼、审美好、细腻敏感',
    辰:'志向远大、不甘平凡、贵人运好', 巳:'聪明灵活、口才好、善交际',
    午:'热情奔放、行动力强、急性子', 未:'温厚包容、人缘好、心思细密',
    申:'精明能干、适应力强、多才多艺', 酉:'注重品质、有品味、桃花旺',
    戌:'忠诚守信、有正义感、重情义', 亥:'聪明重情、心软善良、想象力丰富',
  };
  const hourTrait = DZ_TRAIT[tGZ[1]] || '';

  // 三前法（年月柱→早年 / 日柱→中年 / 时柱→晚年）
  const sanqianfa = {
    early: {
      label: '早年运（1-30岁）看年月柱',
      pillars: yGZ + ' ' + mGZ,
      wx: [WX_MAP[yGZ[0]], DZ_WX[yGZ[1]], WX_MAP[mGZ[0]], DZ_WX[mGZ[1]]],
      analysis: (() => {
        const ywx = [WX_MAP[yGZ[0]], DZ_WX[yGZ[1]], WX_MAP[mGZ[0]], DZ_WX[mGZ[1]]];
        const xiCount = ywx.filter(w => xiyong.includes(w)).length;
        return xiCount >= 3 ? '早年得助力，家境和学业较顺' : xiCount >= 2 ? '早年平稳，靠自己积累' : '早年辛苦，少享福，多磨砺';
      })()
    },
    middle: {
      label: '中年运（30-50岁）看日柱',
      pillars: dGZ,
      wx: [WX_MAP[dGZ[0]], DZ_WX[dGZ[1]]],
      analysis: (() => {
        const dwx = [dmWx, DZ_WX[dGZ[1]]];
        const xiCount = dwx.filter(w => xiyong.includes(w)).length;
        const dzSS = SS_TABLE[dm]?.[TG[TG.indexOf(dGZ[0])]] || '';
        return xiCount >= 1 ? '中年自身能力发挥，事业有成' : '中年压力较大，需努力突破';
      })()
    },
    late: {
      label: '晚年运（50岁后）看时柱',
      pillars: tGZ,
      wx: [WX_MAP[tGZ[0]], DZ_WX[tGZ[1]]],
      analysis: (() => {
        const twx = [WX_MAP[tGZ[0]], DZ_WX[tGZ[1]]];
        const xiCount = twx.filter(w => xiyong.includes(w)).length;
        const timeSS = SS_TABLE[dm][tGZ[0]];
        const childLuck = ['食神','伤官','偏财','正财'].includes(timeSS) ? '子女有出息' : ['正印','偏印'].includes(timeSS) ? '晚年有贵人照顾' : '晚年需自立';
        return xiCount >= 1 ? `晚年安康享福，${childLuck}` : `晚年需注意养生，${childLuck}`;
      })()
    }
  };

  // 地支组合特征提示（双某+某水之类）
  const dzCounts = {};
  dzArr4.forEach(z => { dzCounts[z] = (dzCounts[z]||0) + 1; });
  const dzComboTraits = [];
  Object.entries(dzCounts).filter(([,c]) => c >= 2).forEach(([z,c]) => {
    const trait = { 子:'水势汹涌，聪明但多虑', 丑:'土厚积累深，大器晚成', 寅:'木气双旺，冲劲十足',
      卯:'双木温柔，但优柔寡断', 辰:'双龙志高，不甘平凡', 巳:'火力双份，口才极佳',
      午:'火气双旺，急性子但行动力强', 未:'双土温厚，人缘极好', 申:'金气锋锐，精明强干',
      酉:'双金桃花旺，重品味', 戌:'双土忠义，正义感强', 亥:'双水重情，心软易被拖累' }[z] || '';
    if (trait) dzComboTraits.push(`双${z}${DZ_WX[z]}：${trait}`);
  });
  // 五行旺组合
  const wxCombo = [];
  const wxSorted = Object.entries(wuxing).sort((a,b)=>b[1]-a[1]);
  if (wxSorted[0][1] >= 3 && wxSorted[1][1] >= 2) {
    const combo = wxSorted[0][0] + wxSorted[1][0];
    const comboDesc = { '水金':'外柔内刚、有韧性、能扛事', '金水':'聪明灵活、善变通、不服输',
      '木火':'热情上进、理想主义、有创造力', '火木':'光明磊落、敢作敢为', '土金':'稳重可靠、善积累',
      '金土':'务实有毅力、重信用', '水木':'聪慧好学、有文采', '木水':'灵活多变、善交际',
      '火土':'热心踏实、乐于助人', '土火':'温厚有能力' }[combo] || `${combo}旺`;
    wxCombo.push(`${wxSorted[0][0]}${wxSorted[1][0]}旺：${comboDesc}`);
  }

  // 顺逆排
  const isForward = yun.isForward();
  const startAge = yun.getStartYear() + '年' + yun.getStartMonth() + '月' + (yun.getStartDay() ? yun.getStartDay()+'日' : '') + '起运';
  const yunDirection = isForward ? '顺排' : '逆排';

  // 时柱看子女
  const timeSS = SS_TABLE[dm][tGZ[0]];
  const childAnalysis = ['食神','伤官'].includes(timeSS) ? '子女聪明有出息，但个性强' :
    ['正财','偏财'].includes(timeSS) ? '子女孝顺，晚年可靠子女享福' :
    ['正印','偏印'].includes(timeSS) ? '子女缘好，有贵人相助' :
    ['正官','七杀'].includes(timeSS) ? '子女有管束力，家教严' : '子女缘一般';

  // 五行→行业映射（用于事业分析）
  const WX_INDUSTRY = {
    水: '水产、物流、贸易、交通、旅游、航运、饮品、清洁',
    金: '金融、银行、证券、保险、金属加工、机械、五金',
    木: '教育、出版、文化、林业、家具、纺织、服装',
    火: '餐饮、电力、煤炭、军警、冶炼、照明、传媒',
    土: '房地产、建筑、农业、矿业、陶瓷、中介',
  };
  const ssIndustry = {
    印星: '教育、学术、出版、文化机构、政府机关、培训',
    食伤: '技术、创意、传媒、设计、IT互联网、自由职业、咨询',
    财星: '商业、投资、理财、贸易、销售',
    官杀: '管理、行政、公务员、法律',
  };
  // 喜用行业
  const xiWxList = xiyong.split('、');
  const jiWxList = jishen.split('、');
  const goodIndustries = xiWxList.map(w => `${w}属性：${WX_INDUSTRY[w]||''}`).filter(s => s.includes('：'));
  // 十神行业
  const ssArr = Object.values(shishen);
  const hasYinXing = ssArr.includes('正印') || ssArr.includes('偏印');
  const hasShiShang = ssArr.includes('食神') || ssArr.includes('伤官');
  if (hasYinXing) goodIndustries.push(`印星相关：${ssIndustry['印星']}`);
  if (hasShiShang) goodIndustries.push(`食伤相关：${ssIndustry['食伤']}`);
  const badIndustries = jiWxList.map(w => `${w}属性：${WX_INDUSTRY[w]||''}`).filter(s => s.includes('：'));

  const careerData = { goodIndustries, badIndustries };

  // 五行→方位/城市/颜色/数字
  const WX_DIRECTION = {
    水: { dir:'北方', cities:'哈尔滨、沈阳、长春、大连、天津', color:'黑色、深蓝色', num:'1、6' },
    金: { dir:'西方', cities:'西安、成都、重庆、兰州、拉萨', color:'白色、银色、金色', num:'4、9' },
    木: { dir:'东方', cities:'上海、杭州、南京、青岛、苏州', color:'绿色、青色', num:'3、8' },
    火: { dir:'南方', cities:'深圳、广州、海口、厦门、昆明', color:'红色、紫色、橙色', num:'2、7' },
    土: { dir:'中部', cities:'武汉、郑州、长沙、合肥、南昌', color:'黄色、棕色', num:'5、0' },
  };
  const goodDirs = xiWxList.map(w => WX_DIRECTION[w]).filter(Boolean);
  const badDirs = jiWxList.map(w => WX_DIRECTION[w]).filter(Boolean);
  const locationData = {
    good: goodDirs.map(d => ({ ...d })),
    bad: badDirs.map(d => ({ ...d })),
    goodColors: goodDirs.map(d => d.color).join('、'),
    badColors: badDirs.map(d => d.color).join('、'),
    goodNums: goodDirs.map(d => d.num).join('、'),
    note: '方位以出生地为基准，行业五行优先级高于地理方位',
  };

  return {
    fourPillars: { year:yGZ, month:mGZ, day:dGZ, hour:tGZ },
    dayMaster:dm, dayMasterElement:dmWx, yinyang:YY_MAP[dm], dayStrength, geju, nayin, stages,
    wuxing, wuxingLack, xiyong, jishen, shishen, cangganShishen, shensha, dizhiRelations, tianganHe, tianganChong, kongwang: kongwangInfo, isSpecialGeju,
    taiyuan, mingGong, tiaohou, trueSolarTimeAdj, taohuaInfo, monthCommander,
    healthWarn, badMonths, goodMonths, hourTrait,
    sanqianfa, dzComboTraits, wxCombo, childAnalysis, careerData, locationData,
    liunian: { year:nowYear, ganzhi:lnGZ, nayin:lnEc.getYearNaYin(), tianganSS:lnSS, tianganWx:lnTgWx, dizhiWx:DZ_WX[lnDz], dizhiRels:lnDzRels,
      isXiyong:xiyong.includes(lnTgWx), isJishen:jishen.includes(lnTgWx),
      summary: xiyong.includes(lnTgWx)?'流年天干为喜用，整体有利':jishen.includes(lnTgWx)?'流年天干为忌神，需谨慎':'流年天干影响中性',
      dayunInteraction: dayunLiunianAnalysis },
    dayun: { list:dayuns, current:currentDayun, startInfo:`${startAge}（${gender==='female'||gender==='f'?'女':'男'}命${yunDirection}）` },
    xiaoyun, liuyueList,
    personality: DM_PERSONA[dm]||DM_PERSONA['甲'],
    lunarDate,
    gender: gender||'male',
    _source: 'lunar-javascript',
  };
}

function formatForAI(result, mode='simple') {
  const r=result, fp=r.fourPillars;
  const ld = r.lunarDate;
  const lunarHeader = ld ? `${ld.solarStr}\n${ld.full} ${ld.shengxiao}年\n` : '';
  if (mode==='expert') {
    let o=lunarHeader+`【四柱排盘】`;
    o+=`\n年柱：${fp.year}（${r.nayin.year}） ${r.shishen.yearTg}  ${r.stages.year}`;
    o+=`\n月柱：${fp.month}（${r.nayin.month}） ${r.shishen.monthTg}  ${r.stages.month}`;
    o+=`\n日柱：${fp.day}（${r.nayin.day}） 日主  ${r.stages.day}`;
    o+=`\n时柱：${fp.hour}（${r.nayin.hour}） ${r.shishen.hourTg}  ${r.stages.hour}`;
    o+=`\n\n【日主】${r.dayMaster}${r.dayMasterElement}（${r.yinyang}${r.dayMasterElement}）·${r.dayStrength}`;
    o+=`\n格局：${r.geju}\n喜用：${r.xiyong}  忌：${r.jishen}`;
    if (r.tiaohou) o+=`\n调候：${r.tiaohou}`;
    if (r.monthCommander) o+=`\n月令司令：${r.monthCommander.gan}${r.monthCommander.wx}（${r.monthCommander.type}当令，节气进度${Math.round(r.monthCommander.frac*100)}%）`;
    o+=`\n\n【纳音】年命${r.nayin.year}  日命${r.nayin.day}`;
    // 纳音五行解读
    const nyWxMap = (ny) => { if(ny.includes('金'))return'金'; if(ny.includes('木'))return'木'; if(ny.includes('水'))return'水'; if(ny.includes('火'))return'火'; if(ny.includes('土'))return'土'; return''; };
    const nyYearWx = nyWxMap(r.nayin.year), nyDayWx = nyWxMap(r.nayin.day);
    if (nyYearWx && nyDayWx) {
      const SHENG_NY = {金:'水',水:'木',木:'火',火:'土',土:'金'};
      if (nyYearWx === nyDayWx) o += `\n年命日命同属${nyYearWx}，一生根基稳固`;
      else if (SHENG_NY[nyYearWx] === nyDayWx) o += `\n年命${nyYearWx}生日命${nyDayWx}，先天根基助力后天发展`;
      else if (SHENG_NY[nyDayWx] === nyYearWx) o += `\n日命${nyDayWx}生年命${nyYearWx}，自身能量回馈根源`;
      else o += `\n年命${nyYearWx}与日命${nyDayWx}相克，先天与后天有些矛盾，需要平衡`;
    }
    o+=`\n\n【五行】${Object.entries(r.wuxing).map(([k,v])=>`${k}${v}`).join(' ')}`;
    if (r.wuxingLack.length) o+=`  缺${r.wuxingLack.join('、')}`;
    if (r.shensha.length) { o+=`\n\n【神煞】`; r.shensha.forEach(s=>{o+=`\n${s.pos}·${s.name}：${s.desc}`;}); }
    if (r.dizhiRelations.length) { o+=`\n\n【地支关系】`; r.dizhiRelations.forEach(d=>{o+=`\n${d.pair}（${d.type}）：${d.desc}`;}); }
    if (r.tianganHe && r.tianganHe.length) { o+=`\n\n【天干合】`; r.tianganHe.forEach(h=>{o+=`\n${h.pair}：${h.desc}`;}); }
    if (r.tianganChong && r.tianganChong.length) { o+=`\n\n【天干冲】`; r.tianganChong.forEach(h=>{o+=`\n${h.pair}：${h.desc}`;}); }
    if (r.kongwang) o+=`\n\n【空亡】${r.kongwang.desc}`;
    if (r.isSpecialGeju) o+=`\n\n【特殊格局】${r.geju} — ${r.dayStrength === '从强' ? '日主极旺，满盘印比，喜顺势不宜逆克' : r.dayStrength === '从弱' ? '日主极弱无根，弃命从势，忌扶抑' : '日主一气专旺，五行纯粹'}`;
    if (r.dayStrength === '身极强') o+=`\n\n【身极强·带从强倾向】日主极旺、印比成势，但天干有食伤透出（杂气），非纯粹从强格。取用以顺势为主（喜印比），食伤泄秀亦可为辅用`;
    o+=`\n\n【藏干】`;
    ['year','month','day','hour'].forEach(p => {
      const label={year:'年支',month:'月支',day:'日支',hour:'时支'}[p];
      r.cangganShishen[p].forEach(c=>{o+=`\n${label}藏${c.gan}${c.wx}（${c.ss}）`;});
    });
    if (r.dayun&&r.dayun.current) {
      o+=`\n\n【大运】${r.dayun.startInfo}`;
      r.dayun.list.forEach(d=>{o+=`\n${d.startAge}岁 ${d.gz}（${d.startYear}-${d.endYear}）${d.label}·${d.ss}·${d.luck}${d===r.dayun.current?' ← 当前':''}`;});
    }
    o+=`\n\n【${r.liunian.year}年流年：${r.liunian.ganzhi}（${r.liunian.nayin}）】`;
    o+=`\n流年天干${r.liunian.ganzhi[0]}${r.liunian.tianganWx}，对日主为${r.liunian.tianganSS}`;
    o+=`\n${r.liunian.summary}`;
    r.liunian.dizhiRels.forEach(d=>{o+=`\n流年${r.liunian.ganzhi[1]}与${d.target}${d.type}：${d.desc}`;});
    if (r.liunian.dayunInteraction) o+=`\n\n【大运流年交互】${r.liunian.dayunInteraction}`;
    if (r.xiaoyun && r.xiaoyun.length) {
      o+=`\n\n【十年运程概览】`;
      r.xiaoyun.forEach(xy => { o+=`\n${xy.year}年 ${xy.gz}（${xy.ss}）${xy.rating}${xy.isCurrent ? ' ← 今年' : ''}`; });
    }
    if (r.liuyueList && r.liuyueList.length) {
      o+=`\n\n【${r.liunian.year}年逐月运程】`;
      r.liuyueList.forEach(lm => { o+=`\n${lm.month}月 ${lm.gz}（${lm.ss}）${lm.rating}${lm.isCurrent ? ' ← 本月' : ''}`; });
    }
    if (r.healthWarn && r.healthWarn.length) {
      o+=`\n\n【健康提示】`;
      r.healthWarn.forEach(h => { o+=`\n${h.desc}  注意${h.risk}  ${h.advice}`; });
      if (r.badMonths.length) o+=`\n凶月（注意健康）：农历${r.badMonths.join('、')}月`;
      if (r.goodMonths.length) o+=`\n吉月（宜调理）：农历${r.goodMonths.join('、')}月`;
    }
    if (r.hourTrait) o+=`\n\n【时支性格】${r.fourPillars.hour[1]}时生人：${r.hourTrait}`;
    if (r.dzComboTraits && r.dzComboTraits.length) { o+=`\n\n【地支组合特征】`; r.dzComboTraits.forEach(t => { o+=`\n${t}`; }); }
    if (r.wxCombo && r.wxCombo.length) { r.wxCombo.forEach(t => { o+=`\n${t}`; }); }
    if (r.sanqianfa) {
      o+=`\n\n【三前法·一生概览】`;
      o+=`\n${r.sanqianfa.early.label}：${r.sanqianfa.early.pillars} → ${r.sanqianfa.early.analysis}`;
      o+=`\n${r.sanqianfa.middle.label}：${r.sanqianfa.middle.pillars} → ${r.sanqianfa.middle.analysis}`;
      o+=`\n${r.sanqianfa.late.label}：${r.sanqianfa.late.pillars} → ${r.sanqianfa.late.analysis}`;
    }
    if (r.childAnalysis) o+=`\n\n【子女缘】时柱${r.fourPillars.hour}（${SS_TABLE[r.dayMaster]?.[r.fourPillars.hour[0]]||''}）：${r.childAnalysis}`;
    if (r.careerData) {
      o+=`\n\n【事业行业参考】`;
      o+=`\n适合行业（喜用五行+十神）：`;
      r.careerData.goodIndustries.forEach(g => { o+=`\n  ${g}`; });
      o+=`\n不适合行业（忌神五行）：`;
      r.careerData.badIndustries.forEach(b => { o+=`\n  ${b}`; });
    }
    if (r.locationData) {
      o+=`\n\n【有利方位与开运参考】`;
      o+=`\n有利方位（以出生地为基准）：`;
      r.locationData.good.forEach(d => { o+=`\n  ${d.dir}：${d.cities}`; });
      o+=`\n不利方位：`;
      r.locationData.bad.forEach(d => { o+=`\n  ${d.dir}：${d.cities}`; });
      o+=`\n幸运色：${r.locationData.goodColors}`;
      o+=`\n忌讳色：${r.locationData.badColors}`;
      o+=`\n幸运数字：${r.locationData.goodNums}`;
      o+=`\n注意：${r.locationData.note}`;
    }
    if (r.taiyuan) o+=`\n\n【胎元】${r.taiyuan}  【命宫】${r.mingGong}`;
    return o;
  }
  const p=r.personality;
  let o=lunarHeader+`你的八字：${fp.year} ${fp.month} ${fp.day} ${fp.hour}`;
  o+=`\n日主：${r.dayMaster}${r.dayMasterElement} — ${p.type}`;
  o+=`\n${p.simple}`;
  o+=`\n\n性格关键词：${p.traits.join('、')}`;
  o+=`\n五行分布：${Object.entries(r.wuxing).map(([k,v])=>`${k}${v}`).join(' ')}`;
  if (r.wuxingLack.length) o+=`（缺${r.wuxingLack.join('、')}）`;
  o+=`\n整体状态：${r.dayStrength}${r.isSpecialGeju ? '（特殊格局：'+r.geju+'）' : ''}`;
  if (r.kongwang && r.kongwang.inChart.length) o+=`\n空亡：命中${r.kongwang.inChart.join('')}落空亡`;
  if (r.tianganHe && r.tianganHe.length) o+=`\n天干合：${r.tianganHe.map(h=>h.pair+'('+h.desc+')').join('、')}`;
  if (r.shensha.length) { o+=`\n\n命中带有：`; r.shensha.forEach(s=>{o+=`\n· ${s.name} — ${s.desc}`;}); }
  if (r.dayun&&r.dayun.current) o+=`\n\n当前大运：${r.dayun.current.gz}（${r.dayun.current.startYear}-${r.dayun.current.endYear}）`;
  o+=`\n\n今年（${r.liunian.year}）流年${r.liunian.ganzhi}：${r.liunian.summary}`;
  if (r.nayin) o+=`\n年命纳音：${r.nayin.year}`;
  if (r.tiaohou) o+=`\n调候提示：${r.tiaohou}`;
  if (r.liuyueList && r.liuyueList.length) {
    const good = r.liuyueList.filter(m => m.rating.startsWith('吉')).map(m => m.month+'月');
    const bad = r.liuyueList.filter(m => m.rating.startsWith('凶')).map(m => m.month+'月');
    if (good.length) o+=`\n\n今年好月份：${good.join('、')}`;
    if (bad.length) o+=`\n需注意月份：${bad.join('、')}`;
  }
  return o;
}

module.exports = { calculate, formatForAI };
