/**
 * 印度占星（Vedic Astrology / Jyotish）引擎
 * 恒星黄道 + 纳克沙特拉 + 达沙周期
 * 注意：生产环境应使用 Swiss Ephemeris 精确计算行星位置
 * 此版本为简化实现，用于原型验证
 */

// 恒星黄道星座（Rashis）— 与西方热带黄道偏移约23度（Ayanamsa）
const RASHIS = [
  { id: 1, name: 'Mesha', en: 'Aries', zh: '白羊', ruler: 'Mars', element: 'Fire' },
  { id: 2, name: 'Vrishabha', en: 'Taurus', zh: '金牛', ruler: 'Venus', element: 'Earth' },
  { id: 3, name: 'Mithuna', en: 'Gemini', zh: '双子', ruler: 'Mercury', element: 'Air' },
  { id: 4, name: 'Karka', en: 'Cancer', zh: '巨蟹', ruler: 'Moon', element: 'Water' },
  { id: 5, name: 'Simha', en: 'Leo', zh: '狮子', ruler: 'Sun', element: 'Fire' },
  { id: 6, name: 'Kanya', en: 'Virgo', zh: '处女', ruler: 'Mercury', element: 'Earth' },
  { id: 7, name: 'Tula', en: 'Libra', zh: '天秤', ruler: 'Venus', element: 'Air' },
  { id: 8, name: 'Vrishchika', en: 'Scorpio', zh: '天蝎', ruler: 'Mars', element: 'Water' },
  { id: 9, name: 'Dhanu', en: 'Sagittarius', zh: '射手', ruler: 'Jupiter', element: 'Fire' },
  { id: 10, name: 'Makara', en: 'Capricorn', zh: '摩羯', ruler: 'Saturn', element: 'Earth' },
  { id: 11, name: 'Kumbha', en: 'Aquarius', zh: '水瓶', ruler: 'Saturn', element: 'Air' },
  { id: 12, name: 'Meena', en: 'Pisces', zh: '双鱼', ruler: 'Jupiter', element: 'Water' },
];

// 27个纳克沙特拉（Nakshatras）
const NAKSHATRAS = [
  { id: 1, name: 'Ashwini', zh: '马首', ruler: 'Ketu', deity: 'Ashwini Kumaras', quality: 'Swift/Light', nature: 'Dharma' },
  { id: 2, name: 'Bharani', zh: '负载', ruler: 'Venus', deity: 'Yama', quality: 'Fierce', nature: 'Artha' },
  { id: 3, name: 'Krittika', zh: '昴宿', ruler: 'Sun', deity: 'Agni', quality: 'Mixed', nature: 'Kama' },
  { id: 4, name: 'Rohini', zh: '毕宿', ruler: 'Moon', deity: 'Brahma', quality: 'Fixed', nature: 'Moksha' },
  { id: 5, name: 'Mrigashira', zh: '参宿', ruler: 'Mars', deity: 'Soma', quality: 'Soft', nature: 'Dharma' },
  { id: 6, name: 'Ardra', zh: '觜宿', ruler: 'Rahu', deity: 'Rudra', quality: 'Sharp', nature: 'Artha' },
  { id: 7, name: 'Punarvasu', zh: '井宿', ruler: 'Jupiter', deity: 'Aditi', quality: 'Movable', nature: 'Kama' },
  { id: 8, name: 'Pushya', zh: '鬼宿', ruler: 'Saturn', deity: 'Brihaspati', quality: 'Light', nature: 'Moksha' },
  { id: 9, name: 'Ashlesha', zh: '柳宿', ruler: 'Mercury', deity: 'Nagas', quality: 'Sharp', nature: 'Dharma' },
  { id: 10, name: 'Magha', zh: '星宿', ruler: 'Ketu', deity: 'Pitris', quality: 'Fierce', nature: 'Artha' },
  { id: 11, name: 'Purva Phalguni', zh: '张宿', ruler: 'Venus', deity: 'Bhaga', quality: 'Fierce', nature: 'Kama' },
  { id: 12, name: 'Uttara Phalguni', zh: '翼宿', ruler: 'Sun', deity: 'Aryaman', quality: 'Fixed', nature: 'Moksha' },
  { id: 13, name: 'Hasta', zh: '轸宿', ruler: 'Moon', deity: 'Savitar', quality: 'Light', nature: 'Dharma' },
  { id: 14, name: 'Chitra', zh: '角宿', ruler: 'Mars', deity: 'Vishwakarma', quality: 'Soft', nature: 'Artha' },
  { id: 15, name: 'Swati', zh: '亢宿', ruler: 'Rahu', deity: 'Vayu', quality: 'Movable', nature: 'Kama' },
  { id: 16, name: 'Vishakha', zh: '氐宿', ruler: 'Jupiter', deity: 'Indra-Agni', quality: 'Mixed', nature: 'Moksha' },
  { id: 17, name: 'Anuradha', zh: '房宿', ruler: 'Saturn', deity: 'Mitra', quality: 'Soft', nature: 'Dharma' },
  { id: 18, name: 'Jyeshtha', zh: '心宿', ruler: 'Mercury', deity: 'Indra', quality: 'Sharp', nature: 'Artha' },
  { id: 19, name: 'Mula', zh: '尾宿', ruler: 'Ketu', deity: 'Nirrti', quality: 'Sharp', nature: 'Kama' },
  { id: 20, name: 'Purva Ashadha', zh: '箕宿', ruler: 'Venus', deity: 'Apas', quality: 'Fierce', nature: 'Moksha' },
  { id: 21, name: 'Uttara Ashadha', zh: '斗宿', ruler: 'Sun', deity: 'Vishvedevas', quality: 'Fixed', nature: 'Dharma' },
  { id: 22, name: 'Shravana', zh: '女宿', ruler: 'Moon', deity: 'Vishnu', quality: 'Movable', nature: 'Artha' },
  { id: 23, name: 'Dhanishta', zh: '虚宿', ruler: 'Mars', deity: 'Vasus', quality: 'Movable', nature: 'Kama' },
  { id: 24, name: 'Shatabhisha', zh: '危宿', ruler: 'Rahu', deity: 'Varuna', quality: 'Movable', nature: 'Moksha' },
  { id: 25, name: 'Purva Bhadrapada', zh: '室宿', ruler: 'Jupiter', deity: 'Aja Ekapada', quality: 'Fierce', nature: 'Dharma' },
  { id: 26, name: 'Uttara Bhadrapada', zh: '壁宿', ruler: 'Saturn', deity: 'Ahir Budhnya', quality: 'Fixed', nature: 'Artha' },
  { id: 27, name: 'Revati', zh: '奎宿', ruler: 'Mercury', deity: 'Pushan', quality: 'Soft', nature: 'Kama' },
];

// Vimshottari Dasha 周期（总120年）
const DASHA_YEARS = {
  Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16,
  Saturn: 19, Mercury: 17, Ketu: 7, Venus: 20,
};
const DASHA_ORDER = ['Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury', 'Ketu', 'Venus'];
const DASHA_ZH = { Sun: '太阳', Moon: '月亮', Mars: '火星', Rahu: '罗睺', Jupiter: '木星', Saturn: '土星', Mercury: '水星', Ketu: '计都', Venus: '金星' };

// Ayanamsa（岁差）：2024年约24.17度
const AYANAMSA = 24.17;

/**
 * 西方热带黄道 → 恒星黄道（减去Ayanamsa）
 * 简化：用出生月日估算太阳的恒星位置
 */
function getSiderealSunSign(month, day) {
  // 热带黄道太阳度数（从白羊0度开始）
  const dayOfYear = getDayOfYear(month, day);
  const tropicalDegree = ((dayOfYear - 80) / 365.25) * 360; // 春分约第80天
  const siderealDegree = ((tropicalDegree - AYANAMSA) + 360) % 360;
  const rashiIndex = Math.floor(siderealDegree / 30);
  return {
    rashi: RASHIS[rashiIndex],
    degree: siderealDegree % 30,
    totalDegree: siderealDegree,
  };
}

/**
 * 计算月亮纳克沙特拉（简化版）
 */
function getMoonNakshatra(year, month, day) {
  // 简化：用日期偏移估算月亮位置
  const baseOffset = (year * 13 + month * 29 + day * 11) % 360;
  const siderealMoon = (baseOffset - AYANAMSA + 360) % 360;
  const nakshatraIndex = Math.floor(siderealMoon / (360 / 27));
  const moonRashiIndex = Math.floor(siderealMoon / 30);
  return {
    nakshatra: NAKSHATRAS[nakshatraIndex],
    moonRashi: RASHIS[moonRashiIndex],
    degree: siderealMoon % (360 / 27),
  };
}

/**
 * 计算 Vimshottari Dasha（大运周期）
 */
function calculateDasha(birthNakshatra, birthYear) {
  // 起始 Dasha 行星 = 出生纳克沙特拉的主宰星
  const startPlanet = birthNakshatra.ruler;
  const startIdx = DASHA_ORDER.indexOf(startPlanet);

  const dashas = [];
  let currentYear = birthYear;

  for (let i = 0; i < DASHA_ORDER.length; i++) {
    const planet = DASHA_ORDER[(startIdx + i) % DASHA_ORDER.length];
    const years = DASHA_YEARS[planet];
    dashas.push({
      planet,
      planetZh: DASHA_ZH[planet],
      startYear: currentYear,
      endYear: currentYear + years,
      years,
    });
    currentYear += years;
  }

  return dashas;
}

/**
 * 获取当前运行的 Dasha
 */
function getCurrentDasha(dashas, currentYear) {
  currentYear = currentYear || new Date().getFullYear();
  return dashas.find(d => currentYear >= d.startYear && currentYear < d.endYear) || dashas[0];
}

function getDayOfYear(month, day) {
  const daysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return daysInMonth[month - 1] + day;
}

/**
 * 主函数：生成吠陀星盘数据
 */
function calculate(input) {
  const { year, month, day, hour } = input;

  const sunData = getSiderealSunSign(month, day);
  const moonData = getMoonNakshatra(year, month, day);
  const dashas = calculateDasha(moonData.nakshatra, year);
  const currentDasha = getCurrentDasha(dashas);

  // 简化版 Lagna（上升星座）
  const lagnaOffset = hour !== undefined ? Math.floor(hour / 2) : 0;
  const lagnaRashi = RASHIS[(sunData.rashi.id - 1 + lagnaOffset) % 12];

  return {
    // 太阳星座（恒星）
    sunSign: sunData.rashi,
    sunDegree: sunData.degree.toFixed(1),
    // 月亮
    moonSign: moonData.moonRashi,
    moonNakshatra: moonData.nakshatra,
    // 上升（Lagna）
    lagna: lagnaRashi,
    // Dasha
    dashas,
    currentDasha,
    // 提醒
    note: 'Simplified calculation. Production should use Swiss Ephemeris for precise planetary positions.',
  };
}

/**
 * 格式化为AI可读文本
 */
function formatForAI(result, lang = 'zh') {
  if (lang === 'zh') {
    return `吠陀星盘概要：
太阳星座（恒星黄道）：${result.sunSign.name}（${result.sunSign.zh}座）${result.sunDegree}°
月亮星座：${result.moonSign.name}（${result.moonSign.zh}座）
月亮纳克沙特拉：${result.moonNakshatra.name}（${result.moonNakshatra.zh}）— 主宰星：${DASHA_ZH[result.moonNakshatra.ruler]}
上升星座（Lagna）：${result.lagna.name}（${result.lagna.zh}座）
当前大运（Dasha）：${result.currentDasha.planetZh}大运（${result.currentDasha.startYear}-${result.currentDasha.endYear}，共${result.currentDasha.years}年）`;
  }
  return `Vedic Chart Summary:
Sun Sign (Sidereal): ${result.sunSign.name} (${result.sunSign.en}) ${result.sunDegree}°
Moon Sign: ${result.moonSign.name} (${result.moonSign.en})
Moon Nakshatra: ${result.moonNakshatra.name} — Ruler: ${result.moonNakshatra.ruler}
Lagna (Ascendant): ${result.lagna.name} (${result.lagna.en})
Current Dasha: ${result.currentDasha.planet} (${result.currentDasha.startYear}-${result.currentDasha.endYear}, ${result.currentDasha.years} years)`;
}

module.exports = { calculate, formatForAI, RASHIS, NAKSHATRAS };
