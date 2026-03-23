/**
 * 印度占星引擎 v2 — 基于 astronomia 真实天文计算
 * 恒星黄道（Sidereal）= 热带黄道 - Ayanamsa
 */
const ac = require('./astro-calc');

const RASHIS = [
  { id:1,n:'Mesha',en:'Aries',zh:'白羊',ruler:'Mars',el:'Fire' },
  { id:2,n:'Vrishabha',en:'Taurus',zh:'金牛',ruler:'Venus',el:'Earth' },
  { id:3,n:'Mithuna',en:'Gemini',zh:'双子',ruler:'Mercury',el:'Air' },
  { id:4,n:'Karka',en:'Cancer',zh:'巨蟹',ruler:'Moon',el:'Water' },
  { id:5,n:'Simha',en:'Leo',zh:'狮子',ruler:'Sun',el:'Fire' },
  { id:6,n:'Kanya',en:'Virgo',zh:'处女',ruler:'Mercury',el:'Earth' },
  { id:7,n:'Tula',en:'Libra',zh:'天秤',ruler:'Venus',el:'Air' },
  { id:8,n:'Vrishchika',en:'Scorpio',zh:'天蝎',ruler:'Mars',el:'Water' },
  { id:9,n:'Dhanu',en:'Sagittarius',zh:'射手',ruler:'Jupiter',el:'Fire' },
  { id:10,n:'Makara',en:'Capricorn',zh:'摩羯',ruler:'Saturn',el:'Earth' },
  { id:11,n:'Kumbha',en:'Aquarius',zh:'水瓶',ruler:'Saturn',el:'Air' },
  { id:12,n:'Meena',en:'Pisces',zh:'双鱼',ruler:'Jupiter',el:'Water' },
];

const NAK = [
  { n:'Ashwini',zh:'马首',ruler:'Ketu',q:'迅捷' },{ n:'Bharani',zh:'负载',ruler:'Venus',q:'猛烈' },
  { n:'Krittika',zh:'昴宿',ruler:'Sun',q:'混合' },{ n:'Rohini',zh:'毕宿',ruler:'Moon',q:'固定' },
  { n:'Mrigashira',zh:'参宿',ruler:'Mars',q:'柔和' },{ n:'Ardra',zh:'觜宿',ruler:'Rahu',q:'尖锐' },
  { n:'Punarvasu',zh:'井宿',ruler:'Jupiter',q:'变动' },{ n:'Pushya',zh:'鬼宿',ruler:'Saturn',q:'轻柔' },
  { n:'Ashlesha',zh:'柳宿',ruler:'Mercury',q:'尖锐' },{ n:'Magha',zh:'星宿',ruler:'Ketu',q:'猛烈' },
  { n:'P.Phalguni',zh:'张宿',ruler:'Venus',q:'猛烈' },{ n:'U.Phalguni',zh:'翼宿',ruler:'Sun',q:'固定' },
  { n:'Hasta',zh:'轸宿',ruler:'Moon',q:'轻柔' },{ n:'Chitra',zh:'角宿',ruler:'Mars',q:'柔和' },
  { n:'Swati',zh:'亢宿',ruler:'Rahu',q:'变动' },{ n:'Vishakha',zh:'氐宿',ruler:'Jupiter',q:'混合' },
  { n:'Anuradha',zh:'房宿',ruler:'Saturn',q:'柔和' },{ n:'Jyeshtha',zh:'心宿',ruler:'Mercury',q:'尖锐' },
  { n:'Mula',zh:'尾宿',ruler:'Ketu',q:'尖锐' },{ n:'P.Ashadha',zh:'箕宿',ruler:'Venus',q:'猛烈' },
  { n:'U.Ashadha',zh:'斗宿',ruler:'Sun',q:'固定' },{ n:'Shravana',zh:'女宿',ruler:'Moon',q:'变动' },
  { n:'Dhanishta',zh:'虚宿',ruler:'Mars',q:'变动' },{ n:'Shatabhisha',zh:'危宿',ruler:'Rahu',q:'变动' },
  { n:'P.Bhadrapada',zh:'室宿',ruler:'Jupiter',q:'猛烈' },{ n:'U.Bhadrapada',zh:'壁宿',ruler:'Saturn',q:'固定' },
  { n:'Revati',zh:'奎宿',ruler:'Mercury',q:'柔和' },
];

const DASHA_YRS = { Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17, Ketu:7, Venus:20 };
const DASHA_ORD = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
const D_ZH = { Sun:'太阳', Moon:'月亮', Mars:'火星', Rahu:'罗睺', Jupiter:'木星', Saturn:'土星', Mercury:'水星', Ketu:'计都', Venus:'金星' };

function calculate(input) {
  const { year, month, day, hour } = input;
  const y = parseInt(year), m = parseInt(month), d = parseInt(day), h = parseInt(hour) || 12;

  const ayan = ac.getAyanamsa(y, m, d);

  // Sun (sidereal)
  const sunTropical = ac.getSunLongitude(y, m, d, h);
  const sunSid = ((sunTropical - ayan) % 360 + 360) % 360;
  const sunRashi = RASHIS[Math.floor(sunSid / 30)];
  const sunDeg = (sunSid % 30).toFixed(1);

  // Moon (sidereal) — REAL astronomical calculation
  const moonTropical = ac.getMoonLongitude(y, m, d, h);
  const moonSid = ((moonTropical - ayan) % 360 + 360) % 360;
  const moonRashi = RASHIS[Math.floor(moonSid / 30)];
  const moonDeg = (moonSid % 30).toFixed(1);

  // Nakshatra (from real moon sidereal position)
  const nakIdx = Math.floor(moonSid / (360 / 27));
  const nak = NAK[nakIdx % 27];
  const nakPortion = (moonSid % (360 / 27)) / (360 / 27); // 0-1 within nakshatra

  // Lagna (sidereal rising sign)
  const risingInfo = ac.getRisingSign(y, m, d, h);
  const lagnaTropical = risingInfo.index * 30 + risingInfo.degree;
  const lagnaSid = ((lagnaTropical - ayan) % 360 + 360) % 360;
  const lagna = RASHIS[Math.floor(lagnaSid / 30)];

  // Dasha calculation (based on REAL Nakshatra)
  const startPlanet = nak.ruler;
  const startIdx = DASHA_ORD.indexOf(startPlanet);
  // Remaining portion of first dasha
  const firstDashaYears = DASHA_YRS[startPlanet];
  const firstDashaRemaining = firstDashaYears * (1 - nakPortion);

  const dashas = [];
  let cy = y + firstDashaRemaining;
  // First (partial) dasha
  dashas.push({ planet: startPlanet, zh: D_ZH[startPlanet], start: y, end: Math.round(cy), yrs: Math.round(firstDashaRemaining) || 1 });
  // Remaining dashas
  for (let i = 1; i <= 8; i++) {
    const p = DASHA_ORD[(startIdx + i) % 9];
    const yrs = DASHA_YRS[p];
    dashas.push({ planet: p, zh: D_ZH[p], start: Math.round(cy), end: Math.round(cy + yrs), yrs });
    cy += yrs;
  }

  const now = new Date().getFullYear();
  const nowFrac = new Date().getFullYear() + (new Date().getMonth()) / 12; // fractional year
  const curDasha = dashas.find(dd => now >= dd.start && now < dd.end) || dashas[0];

  // Antardasha (sub-periods within current Mahadasha)
  let antardashas = [];
  if (curDasha) {
    const mdPlanet = curDasha.planet;
    const mdIdx = DASHA_ORD.indexOf(mdPlanet);
    const mdYrs = curDasha.end - curDasha.start;
    const totalDashaYears = 120; // Vimshottari total
    let adStart = curDasha.start;
    for (let i = 0; i < 9; i++) {
      const adPlanet = DASHA_ORD[(mdIdx + i) % 9];
      const adYrs = (DASHA_YRS[mdPlanet] * DASHA_YRS[adPlanet]) / totalDashaYears;
      const adEnd = adStart + adYrs;
      antardashas.push({ planet: adPlanet, zh: D_ZH[adPlanet], start: Math.round(adStart * 10) / 10, end: Math.round(adEnd * 10) / 10, yrs: Math.round(adYrs * 10) / 10 });
      adStart = adEnd;
    }
  }
  const currentAntardasha = antardashas.find(ad => nowFrac >= ad.start && nowFrac < ad.end) || antardashas[0];

  // Sidereal planet positions (birth chart grahas)
  const tropPlanets = ac.getPlanetPositions(y, m, d, h);
  const grahas = {};
  for (const [name, info] of Object.entries(tropPlanets)) {
    const sidLng = ((info.longitude - ayan) % 360 + 360) % 360;
    grahas[name] = { rashi: RASHIS[Math.floor(sidLng / 30)], degree: (sidLng % 30).toFixed(1), longitude: sidLng.toFixed(1) };
  }
  // Rahu/Ketu (lunar nodes)
  const nodes = ac.getRahuKetu(y, m, d, h);
  const rahuSid = ((nodes.rahu - ayan) % 360 + 360) % 360;
  const ketuSid = ((nodes.ketu - ayan) % 360 + 360) % 360;
  grahas.Rahu = { rashi: RASHIS[Math.floor(rahuSid / 30)], degree: (rahuSid % 30).toFixed(1), longitude: rahuSid.toFixed(1) };
  grahas.Ketu = { rashi: RASHIS[Math.floor(ketuSid / 30)], degree: (ketuSid % 30).toFixed(1), longitude: ketuSid.toFixed(1) };

  return {
    sunSign: sunRashi, sunDeg, moonSign: moonRashi, moonDeg, moonNak: nak, lagna,
    dashas, currentDasha: curDasha, antardashas, currentAntardasha, ayanamsa: ayan.toFixed(2), grahas,
    _source: 'astronomia',
  };
}

function formatForAI(result, mode = 'simple') {
  const r = result;
  if (mode === 'expert') {
    let o = `【吠陀星盘（天文精算·恒星黄道）】`;
    o += `\nAyanamsa：${r.ayanamsa}°（Lahiri）`;
    o += `\n太阳：${r.sunSign.n}（${r.sunSign.zh}座）${r.sunDeg}°  守护：${r.sunSign.ruler}`;
    o += `\n月亮：${r.moonSign.n}（${r.moonSign.zh}座）${r.moonDeg}°  守护：${r.moonSign.ruler}`;
    o += `\n月亮纳克沙特拉：${r.moonNak.n}（${r.moonNak.zh}）  主宰：${r.moonNak.ruler}  性质：${r.moonNak.q}`;
    o += `\n上升（Lagna）：${r.lagna.n}（${r.lagna.zh}座）  守护：${r.lagna.ruler}`;
    o += `\n\n【Vimshottari Dasha 大运】`;
    o += `\n当前：${r.currentDasha.zh}大运（${r.currentDasha.start}-${r.currentDasha.end}，${r.currentDasha.yrs}年）`;
    if (r.currentAntardasha) {
      o += `\n当前子运：${r.currentDasha.zh}/${r.currentAntardasha.zh}（${r.currentAntardasha.start}-${r.currentAntardasha.end}）`;
    }
    o += `\n\n大运序列：`;
    r.dashas.forEach(d => { o += `\n${d.zh}（${d.start}-${d.end}，${d.yrs}年）${d === r.currentDasha ? ' ← 当前' : ''}`; });
    if (r.antardashas && r.antardashas.length) {
      o += `\n\n当前大运${r.currentDasha.zh}的子运期：`;
      r.antardashas.forEach(ad => { o += `\n  ${ad.zh}（${ad.start}-${ad.end}）${ad === r.currentAntardasha ? ' ← 当前' : ''}`; });
    }
    if (r.grahas && Object.keys(r.grahas).length > 0) {
      const GZH = { Mercury:'水星', Venus:'金星', Mars:'火星', Jupiter:'木星', Saturn:'土星', Rahu:'罗睺(北交点)', Ketu:'计都(南交点)' };
      o += `\n\n【行星位置（恒星黄道）】`;
      for (const [p, info] of Object.entries(r.grahas)) {
        o += `\n${GZH[p]||p}：${info.rashi.zh}座 ${info.degree}°  守护${info.rashi.ruler}`;
      }
    }
    return o;
  }
  const effects = { Sun:'关注自我表达和权威', Moon:'情感和内在需求是重心', Mars:'充满行动力，注意冲突', Rahu:'充满变革和非传统的机遇', Jupiter:'扩展、学习和好运的周期', Saturn:'考验耐心，收获成熟', Mercury:'沟通、学习和商业活跃', Ketu:'灵性成长，放下执着', Venus:'感情、艺术和享受的丰收期' };
  let o = `你的吠陀星盘：`;
  o += `\n☀️ 太阳在${r.sunSign.zh}座（恒星黄道${r.sunDeg}°）`;
  o += `\n🌙 月亮在${r.moonSign.zh}座（${r.moonDeg}°）— 内心世界的主调`;
  o += `\n⭐ 月亮星宿：${r.moonNak.n}（${r.moonNak.zh}）— 性质${r.moonNak.q}`;
  o += `\n⬆️ 上升${r.lagna.zh}座 — 人生的整体方向`;
  o += `\n\n你当前处于「${r.currentDasha.zh}」大运周期（${r.currentDasha.start}-${r.currentDasha.end}）`;
  o += `\n${effects[r.currentDasha.planet] || ''}`;
  return o;
}

module.exports = { calculate, formatForAI, RASHIS, NAK };
