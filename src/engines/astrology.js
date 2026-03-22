/**
 * 星座运势引擎（Western Astrology）
 * 太阳星座 + 基础星盘要素
 */

const ZODIAC_SIGNS = [
  { id: 'aries', zh: '白羊座', en: 'Aries', symbol: '♈', element: 'fire', quality: 'cardinal', ruler: 'Mars', dateRange: [321, 419] },
  { id: 'taurus', zh: '金牛座', en: 'Taurus', symbol: '♉', element: 'earth', quality: 'fixed', ruler: 'Venus', dateRange: [420, 520] },
  { id: 'gemini', zh: '双子座', en: 'Gemini', symbol: '♊', element: 'air', quality: 'mutable', ruler: 'Mercury', dateRange: [521, 620] },
  { id: 'cancer', zh: '巨蟹座', en: 'Cancer', symbol: '♋', element: 'water', quality: 'cardinal', ruler: 'Moon', dateRange: [621, 722] },
  { id: 'leo', zh: '狮子座', en: 'Leo', symbol: '♌', element: 'fire', quality: 'fixed', ruler: 'Sun', dateRange: [723, 822] },
  { id: 'virgo', zh: '处女座', en: 'Virgo', symbol: '♍', element: 'earth', quality: 'mutable', ruler: 'Mercury', dateRange: [823, 922] },
  { id: 'libra', zh: '天秤座', en: 'Libra', symbol: '♎', element: 'air', quality: 'cardinal', ruler: 'Venus', dateRange: [923, 1023] },
  { id: 'scorpio', zh: '天蝎座', en: 'Scorpio', symbol: '♏', element: 'water', quality: 'fixed', ruler: 'Pluto', dateRange: [1024, 1121] },
  { id: 'sagittarius', zh: '射手座', en: 'Sagittarius', symbol: '♐', element: 'fire', quality: 'mutable', ruler: 'Jupiter', dateRange: [1122, 1221] },
  { id: 'capricorn', zh: '摩羯座', en: 'Capricorn', symbol: '♑', element: 'earth', quality: 'cardinal', ruler: 'Saturn', dateRange: [1222, 119] },
  { id: 'aquarius', zh: '水瓶座', en: 'Aquarius', symbol: '♒', element: 'air', quality: 'fixed', ruler: 'Uranus', dateRange: [120, 218] },
  { id: 'pisces', zh: '双鱼座', en: 'Pisces', symbol: '♓', element: 'water', quality: 'mutable', ruler: 'Neptune', dateRange: [219, 320] },
];

const ELEMENT_NAMES = { fire: { zh: '火象', en: 'Fire' }, earth: { zh: '土象', en: 'Earth' }, air: { zh: '风象', en: 'Air' }, water: { zh: '水象', en: 'Water' } };
const QUALITY_NAMES = { cardinal: { zh: '开创', en: 'Cardinal' }, fixed: { zh: '固定', en: 'Fixed' }, mutable: { zh: '变动', en: 'Mutable' } };

// 星座性格特质
const SIGN_TRAITS = {
  aries:       { zh: ['勇敢果断', '热情冲动', '领导力强', '直接坦率'], en: ['Bold', 'Energetic', 'Leader', 'Direct'] },
  taurus:      { zh: ['稳定可靠', '务实耐心', '感官敏锐', '坚持不懈'], en: ['Stable', 'Patient', 'Sensual', 'Persistent'] },
  gemini:      { zh: ['聪明好奇', '善于沟通', '灵活多变', '幽默风趣'], en: ['Curious', 'Communicative', 'Adaptable', 'Witty'] },
  cancer:      { zh: ['情感丰富', '重视家庭', '直觉敏锐', '有保护欲'], en: ['Emotional', 'Nurturing', 'Intuitive', 'Protective'] },
  leo:         { zh: ['自信大方', '慷慨热情', '创造力强', '渴望关注'], en: ['Confident', 'Generous', 'Creative', 'Charismatic'] },
  virgo:       { zh: ['细致完美', '分析力强', '实际高效', '谦逊服务'], en: ['Analytical', 'Practical', 'Meticulous', 'Humble'] },
  libra:       { zh: ['追求和谐', '审美优雅', '善于社交', '重视公平'], en: ['Harmonious', 'Elegant', 'Social', 'Fair-minded'] },
  scorpio:     { zh: ['洞察力强', '意志坚定', '感情深沉', '神秘魅力'], en: ['Intense', 'Determined', 'Passionate', 'Mysterious'] },
  sagittarius: { zh: ['乐观自由', '追求真理', '爱好冒险', '哲学思考'], en: ['Optimistic', 'Adventurous', 'Philosophical', 'Free-spirited'] },
  capricorn:   { zh: ['有责任感', '纪律严明', '雄心勃勃', '务实稳重'], en: ['Responsible', 'Disciplined', 'Ambitious', 'Pragmatic'] },
  aquarius:    { zh: ['独立创新', '人道主义', '思想超前', '特立独行'], en: ['Independent', 'Humanitarian', 'Innovative', 'Unconventional'] },
  pisces:      { zh: ['富有同情', '想象力强', '灵性直觉', '艺术天赋'], en: ['Compassionate', 'Imaginative', 'Spiritual', 'Artistic'] },
};

// 星座配对相性（简化版：同元素=高分，相邻元素看情况）
const COMPATIBILITY = {
  fire:  { fire: 85, earth: 50, air: 90, water: 45 },
  earth: { fire: 50, earth: 80, air: 55, water: 85 },
  air:   { fire: 90, earth: 55, air: 80, water: 50 },
  water: { fire: 45, earth: 85, air: 50, water: 80 },
};

/**
 * 根据出生月日判断太阳星座
 */
function getSunSign(month, day) {
  const md = month * 100 + day;
  // 摩羯座跨年特殊处理
  if (md >= 1222 || md <= 119) return ZODIAC_SIGNS[9]; // capricorn
  return ZODIAC_SIGNS.find(s => {
    if (s.id === 'capricorn') return false; // 已处理
    return md >= s.dateRange[0] && md <= s.dateRange[1];
  }) || ZODIAC_SIGNS[0];
}

/**
 * 根据出生年估算中国用户熟悉的"月亮星座"（简化版）
 * 生产环境需用天文星历精确计算
 */
function estimateMoonSign(year, month, day) {
  // 简化：月亮约27.3天绕一圈，用出生日偏移估算
  const baseIdx = (year * 13 + month * 3 + day) % 12;
  return ZODIAC_SIGNS[baseIdx];
}

/**
 * 估算上升星座（简化版）
 * 生产环境需精确出生时间+经纬度
 */
function estimateRisingSign(month, day, hour) {
  const sunIdx = ZODIAC_SIGNS.findIndex(s => s.id === getSunSign(month, day).id);
  const hourOffset = Math.floor(hour / 2);
  return ZODIAC_SIGNS[(sunIdx + hourOffset) % 12];
}

/**
 * 计算两人星座相性
 */
function getCompatibility(sign1, sign2) {
  const score = COMPATIBILITY[sign1.element][sign2.element];
  let type, desc;
  if (score >= 85) { type = { zh: '天生一对', en: 'Perfect Match' }; desc = { zh: '你们的能量高度共鸣', en: 'Your energies resonate deeply' }; }
  else if (score >= 70) { type = { zh: '互相吸引', en: 'Strong Attraction' }; desc = { zh: '互补中有默契', en: 'Complementary connection' }; }
  else if (score >= 55) { type = { zh: '需要磨合', en: 'Growth Potential' }; desc = { zh: '差异中藏着成长', en: 'Differences breed growth' }; }
  else { type = { zh: '挑战型', en: 'Challenging' }; desc = { zh: '需要更多理解与包容', en: 'Requires patience and understanding' }; }
  return { score, type, desc };
}

/**
 * 主函数：生成星座分析数据
 */
function calculate(input) {
  const { year, month, day, hour } = input;

  const sunSign = getSunSign(month, day);
  const moonSign = estimateMoonSign(year, month, day);
  const risingSign = hour !== undefined ? estimateRisingSign(month, day, hour) : null;

  return {
    sunSign: {
      ...sunSign,
      element: ELEMENT_NAMES[sunSign.element],
      quality: QUALITY_NAMES[sunSign.quality],
      traits: SIGN_TRAITS[sunSign.id],
    },
    moonSign: {
      ...moonSign,
      element: ELEMENT_NAMES[moonSign.element],
      traits: SIGN_TRAITS[moonSign.id],
    },
    risingSign: risingSign ? {
      ...risingSign,
      element: ELEMENT_NAMES[risingSign.element],
      traits: SIGN_TRAITS[risingSign.id],
    } : null,
  };
}

module.exports = { calculate, getSunSign, getCompatibility, ZODIAC_SIGNS };
