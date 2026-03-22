/**
 * 梅花易数引擎
 * 时间起卦法 + 卦象解读数据
 */

// 八卦基础数据
const TRIGRAMS = [
  { id: 1, name: '乾', symbol: '☰', nature: '天', element: '金', animal: '马', body: '头', family: '父', direction: '西北', trait: '刚健' },
  { id: 2, name: '兑', symbol: '☱', nature: '泽', element: '金', animal: '羊', body: '口', family: '少女', direction: '西', trait: '喜悦' },
  { id: 3, name: '离', symbol: '☲', nature: '火', element: '火', animal: '雉', body: '目', family: '中女', direction: '南', trait: '光明' },
  { id: 4, name: '震', symbol: '☳', nature: '雷', element: '木', animal: '龙', body: '足', family: '长男', direction: '东', trait: '运动' },
  { id: 5, name: '巽', symbol: '☴', nature: '风', element: '木', animal: '鸡', body: '股', family: '长女', direction: '东南', trait: '进入' },
  { id: 6, name: '坎', symbol: '☵', nature: '水', element: '水', animal: '豕', body: '耳', family: '中男', direction: '北', trait: '陷险' },
  { id: 7, name: '艮', symbol: '☶', nature: '山', element: '土', animal: '狗', body: '手', family: '少男', direction: '东北', trait: '静止' },
  { id: 8, name: '坤', symbol: '☷', nature: '地', element: '土', animal: '牛', body: '腹', family: '母', direction: '西南', trait: '顺承' },
];

// 64卦名称
const HEXAGRAM_NAMES = [
  ['乾为天', '天泽履', '天火同人', '天雷无妄', '天风姤', '天水讼', '天山遁', '天地否'],
  ['泽天夬', '兑为泽', '泽火革', '泽雷随', '泽风大过', '泽水困', '泽山咸', '泽地萃'],
  ['火天大有', '火泽睽', '离为火', '火雷噬嗑', '火风鼎', '火水未济', '火山旅', '火地晋'],
  ['雷天大壮', '雷泽归妹', '雷火丰', '震为雷', '雷风恒', '雷水解', '雷山小过', '雷地豫'],
  ['风天小畜', '风泽中孚', '风火家人', '风雷益', '巽为风', '风水涣', '风山渐', '风地观'],
  ['水天需', '水泽节', '水火既济', '水雷屯', '水风井', '坎为水', '水山蹇', '水地比'],
  ['山天大畜', '山泽损', '山火贲', '山雷颐', '山风蛊', '山水蒙', '艮为山', '山地剥'],
  ['地天泰', '地泽临', '地火明夷', '地雷复', '地风升', '地水师', '地山谦', '坤为地'],
];

// 五行生克
const WUXING_SHENG = { 金: '水', 水: '木', 木: '火', 火: '土', 土: '金' }; // 生
const WUXING_KE = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' }; // 克

/**
 * 时间起卦法
 * 上卦 = (年+月+日) % 8
 * 下卦 = (年+月+日+时) % 8
 * 动爻 = (年+月+日+时) % 6
 */
function generateHexagram(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();

  // 地支时辰序数（子=1）
  const shiChen = Math.floor(((hour + 1) % 24) / 2) + 1;

  const upperNum = ((year + month + day) % 8) || 8;
  const lowerNum = ((year + month + day + shiChen) % 8) || 8;
  const changingLine = ((year + month + day + shiChen) % 6) || 6;

  const upperTrigram = TRIGRAMS[upperNum - 1];
  const lowerTrigram = TRIGRAMS[lowerNum - 1];
  const hexagramName = HEXAGRAM_NAMES[upperNum - 1][lowerNum - 1];

  // 体用关系：动爻在上卦则上卦为用、下卦为体，反之
  const isUpperChanging = changingLine > 3;
  const tiGua = isUpperChanging ? lowerTrigram : upperTrigram;  // 体卦
  const yongGua = isUpperChanging ? upperTrigram : lowerTrigram; // 用卦

  // 体用生克
  const tiElement = tiGua.element;
  const yongElement = yongGua.element;
  let relation;
  if (tiElement === yongElement) relation = { type: '比和', zh: '体用比和，事情平顺', en: 'Harmony — smooth outcome' };
  else if (WUXING_SHENG[tiElement] === yongElement) relation = { type: '体生用', zh: '体生用，有付出消耗', en: 'Self gives to situation — draining' };
  else if (WUXING_SHENG[yongElement] === tiElement) relation = { type: '用生体', zh: '用生体，有收获助力', en: 'Situation supports self — beneficial' };
  else if (WUXING_KE[tiElement] === yongElement) relation = { type: '体克用', zh: '体克用，可掌控局面', en: 'Self controls situation — favorable' };
  else relation = { type: '用克体', zh: '用克体，有压力阻碍', en: 'Situation pressures self — challenging' };

  // 变卦（动爻变后的卦）
  const changedUpperNum = changingLine > 3
    ? ((upperNum + changingLine) % 8) || 8
    : upperNum;
  const changedLowerNum = changingLine <= 3
    ? ((lowerNum + changingLine) % 8) || 8
    : lowerNum;
  const changedHexagram = HEXAGRAM_NAMES[changedUpperNum - 1][changedLowerNum - 1];

  return {
    // 本卦
    hexagram: {
      name: hexagramName,
      upper: upperTrigram,
      lower: lowerTrigram,
    },
    // 变卦
    changed: {
      name: changedHexagram,
      upper: TRIGRAMS[changedUpperNum - 1],
      lower: TRIGRAMS[changedLowerNum - 1],
    },
    // 动爻
    changingLine,
    // 体用
    ti: tiGua,
    yong: yongGua,
    relation,
    // 元数据
    meta: {
      upperNum,
      lowerNum,
      shiChen,
      timestamp: d.toISOString(),
    },
  };
}

/**
 * 格式化卦象为AI可读文本
 */
function formatForAI(result, lang = 'zh') {
  if (lang === 'zh') {
    return `本卦：${result.hexagram.name}
上卦：${result.hexagram.upper.name}（${result.hexagram.upper.symbol} ${result.hexagram.upper.nature}·${result.hexagram.upper.element}）
下卦：${result.hexagram.lower.name}（${result.hexagram.lower.symbol} ${result.hexagram.lower.nature}·${result.hexagram.lower.element}）
动爻：第${result.changingLine}爻
变卦：${result.changed.name}
体卦：${result.ti.name}（${result.ti.element}）
用卦：${result.yong.name}（${result.yong.element}）
体用关系：${result.relation.type} — ${result.relation.zh}`;
  }
  return `Main Hexagram: ${result.hexagram.name}
Upper: ${result.hexagram.upper.name} (${result.hexagram.upper.symbol} ${result.hexagram.upper.nature}·${result.hexagram.upper.element})
Lower: ${result.hexagram.lower.name} (${result.hexagram.lower.symbol} ${result.hexagram.lower.nature}·${result.hexagram.lower.element})
Changing Line: ${result.changingLine}
Changed Hexagram: ${result.changed.name}
Ti (Self): ${result.ti.name} (${result.ti.element})
Yong (Situation): ${result.yong.name} (${result.yong.element})
Relation: ${result.relation.type} — ${result.relation.en}`;
}

module.exports = { generateHexagram, formatForAI, TRIGRAMS, HEXAGRAM_NAMES };
