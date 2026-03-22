/**
 * 八字命理引擎
 * 基于万年历查表法，不依赖外部库的轻量实现
 * 生产环境建议替换为 lunar-javascript 库以获得更高精度
 */

const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const WUXING_MAP = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const DIZHI_WUXING = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const NAYIN = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火',
  '涧下水', '城头土', '白蜡金', '杨柳木', '泉中水', '屋上土',
  '霹雳火', '松柏木', '长流水', '砂石金', '山下火', '平地木',
  '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
  '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
];

// 十神关系表：以日干为"我"，其他天干与我的关系
const SHISHEN_TABLE = {
  // [日干][其他干] = 十神
  '甲': { '甲': '比肩', '乙': '劫财', '丙': '食神', '丁': '伤官', '戊': '偏财', '己': '正财', '庚': '七杀', '辛': '正官', '壬': '偏印', '癸': '正印' },
  '乙': { '甲': '劫财', '乙': '比肩', '丙': '伤官', '丁': '食神', '戊': '正财', '己': '偏财', '庚': '正官', '辛': '七杀', '壬': '正印', '癸': '偏印' },
  '丙': { '甲': '偏印', '乙': '正印', '丙': '比肩', '丁': '劫财', '戊': '食神', '己': '伤官', '庚': '偏财', '辛': '正财', '壬': '七杀', '癸': '正官' },
  '丁': { '甲': '正印', '乙': '偏印', '丙': '劫财', '丁': '比肩', '戊': '伤官', '己': '食神', '庚': '正财', '辛': '偏财', '壬': '正官', '癸': '七杀' },
  '戊': { '甲': '七杀', '乙': '正官', '丙': '偏印', '丁': '正印', '戊': '比肩', '己': '劫财', '庚': '食神', '辛': '伤官', '壬': '偏财', '癸': '正财' },
  '己': { '甲': '正官', '乙': '七杀', '丙': '正印', '丁': '偏印', '戊': '劫财', '己': '比肩', '庚': '伤官', '辛': '食神', '壬': '正财', '癸': '偏财' },
  '庚': { '甲': '偏财', '乙': '正财', '丙': '七杀', '丁': '正官', '戊': '偏印', '己': '正印', '庚': '比肩', '辛': '劫财', '壬': '食神', '癸': '伤官' },
  '辛': { '甲': '正财', '乙': '偏财', '丙': '正官', '丁': '七杀', '戊': '正印', '己': '偏印', '庚': '劫财', '辛': '比肩', '壬': '伤官', '癸': '食神' },
  '壬': { '甲': '食神', '乙': '伤官', '丙': '偏财', '丁': '正财', '戊': '七杀', '己': '正官', '庚': '偏印', '辛': '正印', '壬': '比肩', '癸': '劫财' },
  '癸': { '甲': '伤官', '乙': '食神', '丙': '正财', '丁': '偏财', '戊': '正官', '己': '七杀', '庚': '正印', '辛': '偏印', '壬': '劫财', '癸': '比肩' },
};

// 地支藏干
const DIZHI_CANGGAN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

// 时辰对应地支（24小时制）
const HOUR_TO_DIZHI = [
  0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
  6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11
]; // 23-1子, 1-3丑, ...  注意23点归子时

/**
 * 计算年柱（简化版，以立春为界）
 */
function getYearPillar(year) {
  // 天干：(year - 4) % 10
  // 地支：(year - 4) % 12
  const tgIdx = (year - 4) % 10;
  const dzIdx = (year - 4) % 12;
  return { tg: TIANGAN[tgIdx], dz: DIZHI[dzIdx], full: TIANGAN[tgIdx] + DIZHI[dzIdx] };
}

/**
 * 计算月柱（简化版，以节气为界）
 * 月干 = 年干决定，五虎遁口诀
 */
function getMonthPillar(yearTg, lunarMonth) {
  // 五虎遁：甲己之年丙作首，乙庚之岁戊为头...
  const startMap = { '甲': 2, '己': 2, '乙': 4, '庚': 4, '丙': 6, '辛': 6, '丁': 8, '壬': 8, '戊': 0, '癸': 0 };
  const monthTgIdx = (startMap[yearTg] + lunarMonth - 1) % 10;
  const monthDzIdx = (lunarMonth + 1) % 12; // 正月=寅
  return { tg: TIANGAN[monthTgIdx], dz: DIZHI[monthDzIdx], full: TIANGAN[monthTgIdx] + DIZHI[monthDzIdx] };
}

/**
 * 计算日柱（简化版 — 生产环境应用万年历查表）
 * 使用蔡勒公式的变体
 */
function getDayPillar(year, month, day) {
  // 简化：从已知基准日推算
  // 基准：2000年1月1日 = 甲子日（实际为戊午，此处简化）
  // 生产环境请使用 lunar-javascript 库的精确查表
  const baseDate = new Date(2000, 0, 7); // 2000-01-07 甲子日
  const targetDate = new Date(year, month - 1, day);
  const diffDays = Math.round((targetDate - baseDate) / 86400000);
  const idx = ((diffDays % 60) + 60) % 60;
  return { tg: TIANGAN[idx % 10], dz: DIZHI[idx % 12], full: TIANGAN[idx % 10] + DIZHI[idx % 12] };
}

/**
 * 计算时柱
 * 时干 = 日干决定，五鼠遁口诀
 */
function getHourPillar(dayTg, hour) {
  const dzizhiIdx = hour === 23 ? 0 : HOUR_TO_DIZHI[hour];
  // 五鼠遁：甲己还加甲，乙庚丙作初...
  const startMap = { '甲': 0, '己': 0, '乙': 2, '庚': 2, '丙': 4, '辛': 4, '丁': 6, '壬': 6, '戊': 8, '癸': 8 };
  const hourTgIdx = (startMap[dayTg] + dzizhiIdx) % 10;
  return { tg: TIANGAN[hourTgIdx], dz: DIZHI[dzizhiIdx], full: TIANGAN[hourTgIdx] + DIZHI[dzizhiIdx] };
}

/**
 * 计算五行分布
 */
function getWuxingDistribution(pillars) {
  const dist = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  pillars.forEach(p => {
    dist[WUXING_MAP[p.tg]]++;
    dist[DIZHI_WUXING[p.dz]]++;
  });
  return dist;
}

/**
 * 计算十神
 */
function getShishen(dayTg, pillars) {
  return {
    year: SHISHEN_TABLE[dayTg][pillars[0].tg],
    month: SHISHEN_TABLE[dayTg][pillars[1].tg],
    day: '日主',
    hour: SHISHEN_TABLE[dayTg][pillars[3].tg],
  };
}

/**
 * 判断格局（简化版）
 */
function getGeju(monthDz, dayTg, wuxing) {
  const canggan = DIZHI_CANGGAN[monthDz];
  const mainGan = canggan[0];
  const shishen = SHISHEN_TABLE[dayTg][mainGan];
  // 简化：以月令藏干主气的十神为格局
  const gejuMap = {
    '比肩': '比肩格', '劫财': '劫财格', '食神': '食神格', '伤官': '伤官格',
    '偏财': '偏财格', '正财': '正财格', '七杀': '七杀格', '正官': '正官格',
    '偏印': '偏印格', '正印': '正印格',
  };
  return gejuMap[shishen] || '普通格';
}

/**
 * 生成性格标签（基于日干和格局）
 */
function getPersonalityTags(dayTg, geju, wuxing) {
  const dayTgTraits = {
    '甲': { main: '开拓者', traits: ['正直刚毅', '有领导力', '追求成长', '不服输'] },
    '乙': { main: '协调者', traits: ['温柔细腻', '善于适应', '有韧性', '重人情'] },
    '丙': { main: '照耀者', traits: ['热情开朗', '慷慨大方', '光明磊落', '有感染力'] },
    '丁': { main: '烛光者', traits: ['内敛温暖', '洞察力强', '善于思考', '执着专注'] },
    '戊': { main: '承载者', traits: ['稳重厚实', '包容力强', '守信可靠', '大器晚成'] },
    '己': { main: '滋养者', traits: ['细心周到', '善于积累', '务实低调', '内心丰富'] },
    '庚': { main: '决断者', traits: ['果断刚强', '重义气', '有魄力', '追求公正'] },
    '辛': { main: '洞察者', traits: ['敏锐细腻', '审美力强', '追求完美', '独立自主'] },
    '壬': { main: '智慧者', traits: ['聪明机敏', '思维活跃', '适应力强', '胸怀宽广'] },
    '癸': { main: '感知者', traits: ['直觉敏锐', '善解人意', '内心柔软', '想象力丰富'] },
  };
  return dayTgTraits[dayTg] || { main: '未知', traits: [] };
}

/**
 * 主函数：完整排盘
 */
function calculate(input) {
  const { year, month, day, hour, gender = 'male' } = input;

  // 计算四柱
  const yearPillar = getYearPillar(year);
  const lunarMonth = month; // 简化：此处假设输入为农历月，生产环境需阳历转农历
  const monthPillar = getMonthPillar(yearPillar.tg, lunarMonth);
  const dayPillar = getDayPillar(year, month, day);
  const hourPillar = getHourPillar(dayPillar.tg, hour);

  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar];

  // 五行分布
  const wuxing = getWuxingDistribution(pillars);

  // 十神
  const shishen = getShishen(dayPillar.tg, pillars);

  // 格局
  const geju = getGeju(monthPillar.dz, dayPillar.tg, wuxing);

  // 性格标签
  const personality = getPersonalityTags(dayPillar.tg, geju, wuxing);

  // 五行缺失
  const wuxingLack = Object.entries(wuxing).filter(([_, v]) => v === 0).map(([k]) => k);

  // 纳音
  const dayPillarIdx = TIANGAN.indexOf(dayPillar.tg) * 12 + DIZHI.indexOf(dayPillar.dz);
  const nayin = NAYIN[Math.floor(((dayPillarIdx % 60) + 60) % 60 / 2)] || '';

  return {
    // 四柱
    fourPillars: {
      year: yearPillar.full,
      month: monthPillar.full,
      day: dayPillar.full,
      hour: hourPillar.full,
    },
    // 日主
    dayMaster: dayPillar.tg,
    dayMasterElement: WUXING_MAP[dayPillar.tg],
    // 五行
    wuxing,
    wuxingLack,
    // 十神
    shishen,
    // 格局
    geju,
    // 纳音
    nayin,
    // 性格
    personality,
    // 性别
    gender,
    // 地支藏干
    canggan: {
      year: DIZHI_CANGGAN[yearPillar.dz],
      month: DIZHI_CANGGAN[monthPillar.dz],
      day: DIZHI_CANGGAN[dayPillar.dz],
      hour: DIZHI_CANGGAN[hourPillar.dz],
    },
  };
}

module.exports = { calculate, TIANGAN, DIZHI, WUXING_MAP };
