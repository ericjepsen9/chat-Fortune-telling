/**
 * 星座运势引擎 v2 — 基于 astronomia 真实天文计算
 * 太阳/月亮/上升星座均为真实行星位置
 */
const ac = require('./astro-calc');

const SIGNS = [
  { id:'aries',zh:'白羊座',en:'Aries',sym:'♈',el:'fire',ruler:'Mars',traits:['勇敢果断','热情冲动','领导力强','直接坦率'],simTrait:'热情直率的开拓者' },
  { id:'taurus',zh:'金牛座',en:'Taurus',sym:'♉',el:'earth',ruler:'Venus',traits:['稳定可靠','务实耐心','感官敏锐','坚持不懈'],simTrait:'踏实可靠的守护者' },
  { id:'gemini',zh:'双子座',en:'Gemini',sym:'♊',el:'air',ruler:'Mercury',traits:['聪明好奇','善于沟通','灵活多变','幽默风趣'],simTrait:'聪慧多面的沟通者' },
  { id:'cancer',zh:'巨蟹座',en:'Cancer',sym:'♋',el:'water',ruler:'Moon',traits:['情感丰富','重视家庭','直觉敏锐','有保护欲'],simTrait:'温暖体贴的守护者' },
  { id:'leo',zh:'狮子座',en:'Leo',sym:'♌',el:'fire',ruler:'Sun',traits:['自信大方','慷慨热情','创造力强','渴望关注'],simTrait:'光芒四射的王者' },
  { id:'virgo',zh:'处女座',en:'Virgo',sym:'♍',el:'earth',ruler:'Mercury',traits:['细致完美','分析力强','实际高效','谦逊服务'],simTrait:'精益求精的完美主义者' },
  { id:'libra',zh:'天秤座',en:'Libra',sym:'♎',el:'air',ruler:'Venus',traits:['追求和谐','审美优雅','善于社交','重视公平'],simTrait:'优雅和谐的平衡者' },
  { id:'scorpio',zh:'天蝎座',en:'Scorpio',sym:'♏',el:'water',ruler:'Pluto',traits:['洞察力强','意志坚定','感情深沉','神秘魅力'],simTrait:'深邃神秘的洞察者' },
  { id:'sagittarius',zh:'射手座',en:'Sagittarius',sym:'♐',el:'fire',ruler:'Jupiter',traits:['乐观自由','追求真理','爱好冒险','哲学思考'],simTrait:'自由奔放的冒险家' },
  { id:'capricorn',zh:'摩羯座',en:'Capricorn',sym:'♑',el:'earth',ruler:'Saturn',traits:['有责任感','纪律严明','雄心勃勃','务实稳重'],simTrait:'坚韧务实的攀登者' },
  { id:'aquarius',zh:'水瓶座',en:'Aquarius',sym:'♒',el:'air',ruler:'Uranus',traits:['独立创新','人道主义','思想超前','特立独行'],simTrait:'独立前卫的创新者' },
  { id:'pisces',zh:'双鱼座',en:'Pisces',sym:'♓',el:'water',ruler:'Neptune',traits:['富有同情','想象力强','灵性直觉','艺术天赋'],simTrait:'浪漫感性的梦想家' },
];

const EL_ZH = { fire:'火象', earth:'土象', air:'风象', water:'水象' };
const COMPAT = {
  fire:  { fire:85, earth:50, air:90, water:45 },
  earth: { fire:50, earth:80, air:55, water:85 },
  air:   { fire:90, earth:55, air:80, water:50 },
  water: { fire:45, earth:85, air:50, water:80 },
};

function getSunSign(month, day) {
  // Fallback for quick lookup without full calculation (used for current date)
  const ranges = [[120,218,'aquarius'],[219,320,'pisces'],[321,419,'aries'],[420,520,'taurus'],[521,620,'gemini'],[621,722,'cancer'],[723,822,'leo'],[823,922,'virgo'],[923,1023,'libra'],[1024,1121,'scorpio'],[1122,1221,'sagittarius']];
  const md = month * 100 + day;
  if (md >= 1222 || md <= 119) return SIGNS[9]; // capricorn
  for (const [s, e, id] of ranges) { if (md >= s && md <= e) return SIGNS.find(sg => sg.id === id); }
  return SIGNS[0];
}

function getCompat(s1, s2) { return COMPAT[s1.el][s2.el]; }

function calculate(input) {
  const { year, month, day, hour, latitude, longitude } = input;
  const y = parseInt(year), m = parseInt(month), d = parseInt(day), h = parseInt(hour) || 12;
  const lat = parseFloat(latitude) || 39.9, lng = parseFloat(longitude) || 116.4;

  // Real sun position
  const sunLng = ac.getSunLongitude(y, m, d, h);
  const sunInfo = ac.longitudeToSign(sunLng);
  const sun = SIGNS[sunInfo.index];

  // Real moon position
  const moonLng = ac.getMoonLongitude(y, m, d, h);
  const moonInfo = ac.longitudeToSign(moonLng);
  const moon = SIGNS[moonInfo.index];

  // Rising sign (full spherical trigonometry)
  let rising = null;
  if (h !== undefined && h !== null) {
    const risingInfo = ac.getRisingSign(y, m, d, h, 8, lat, lng);
    rising = SIGNS[risingInfo.index];
    rising = { ...rising, degree: risingInfo.degree.toFixed(1) };
  }

  // Current planet transits
  const now = new Date();
  const ny = now.getFullYear(), nm = now.getMonth() + 1, nd = now.getDate(), nh = now.getHours();
  const transits = ac.getPlanetPositions(ny, nm, nd, nh);
  const retrogrades = ac.getRetrogrades(ny, nm, nd, nh);
  const transitSummary = {};
  for (const [planet, info] of Object.entries(transits)) {
    transitSummary[planet] = { sign: info.zh, degree: (info.degree || 0).toFixed(1), longitude: info.longitude, retrograde: !!retrogrades[planet] };
  }
  const moonTransit = ac.getCurrentMoonTransit();

  // Aspect detection helper
  function findAspects(lng1, name1, lng2, name2) {
    const diff = Math.abs(lng1 - lng2);
    const angle = diff > 180 ? 360 - diff : diff;
    const orb = 8;
    const aspects = [];
    const makeAspect = (exactAngle, type, effect) => {
      const orbDeg = Math.abs(angle - exactAngle);
      const strength = orbDeg <= 2 ? '精确' : orbDeg <= 5 ? '紧密' : '松散';
      aspects.push({ type, names: `${name1}${type.split('(')[0]}${name2}`, effect, orbDeg: Math.round(orbDeg*10)/10, strength, angle: Math.round(angle*10)/10 });
    };
    if (angle <= orb) makeAspect(0, '合相(0°)', '能量融合增强');
    else if (Math.abs(angle - 60) <= orb) makeAspect(60, '六合(60°)', '和谐互助');
    else if (Math.abs(angle - 90) <= orb) makeAspect(90, '刑相(90°)', '紧张挑战');
    else if (Math.abs(angle - 120) <= orb) makeAspect(120, '三合(120°)', '顺畅有利');
    else if (Math.abs(angle - 180) <= orb) makeAspect(180, '对冲(180°)', '对立拉扯');
    return aspects;
  }

  // Natal aspects (Sun-Moon, Sun-Rising)
  const natalAspects = [];
  natalAspects.push(...findAspects(sunLng, '太阳', moonLng, '月亮'));
  if (rising) {
    const riLng = ac.getRisingSign(y, m, d, h, 8, lat, lng);
    const riAbsLng = riLng.index * 30 + riLng.degree;
    natalAspects.push(...findAspects(sunLng, '太阳', riAbsLng, '上升'));
    natalAspects.push(...findAspects(moonLng, '月亮', riAbsLng, '上升'));
  }

  // Transit aspects (current planets → natal Sun/Moon)
  const PZH = { Mercury:'水星', Venus:'金星', Mars:'火星', Jupiter:'木星', Saturn:'土星' };
  const transitAspects = [];
  for (const [planet, info] of Object.entries(transits)) {
    transitAspects.push(...findAspects(info.longitude, '流年'+PZH[planet], sunLng, '本命太阳'));
    transitAspects.push(...findAspects(info.longitude, '流年'+PZH[planet], moonLng, '本命月亮'));
  }

  // House cusps (Placidus)
  let houseCusps = null;
  if (h !== undefined && h !== null) {
    houseCusps = ac.getHouseCusps(y, m, d, h, 8, lat, lng);
  }

  return {
    sunSign: sun, sunDegree: sunInfo.degree.toFixed(1), sunLongitude: sunLng,
    moonSign: moon, moonDegree: moonInfo.degree.toFixed(1), moonLongitude: moonLng,
    risingSign: rising, houseCusps,
    element: EL_ZH[sun.el],
    transits: transitSummary, moonTransit,
    natalAspects, transitAspects,
    _source: 'astronomia+vsop87',
  };
}

function formatForAI(result, mode = 'simple') {
  const r = result, s = r.sunSign, m = r.moonSign, ri = r.risingSign;
  if (mode === 'expert') {
    let o = `【星盘核心三要素（天文精算）】`;
    o += `\n太阳星座：${s.zh}（${s.sym} ${s.en}）${r.sunDegree}°`;
    o += `\n  元素：${EL_ZH[s.el]}  守护星：${s.ruler}`;
    o += `\n  特质：${s.traits.join('、')}`;
    o += `\n月亮星座：${m.zh}（${m.sym} ${m.en}）${r.moonDegree}°`;
    o += `\n  元素：${EL_ZH[m.el]}  守护星：${m.ruler}`;
    o += `\n  内在情感：${m.traits.join('、')}`;
    if (ri) {
      o += `\n上升星座：${ri.zh}（${ri.sym} ${ri.en}）${ri.degree}°`;
      o += `\n  元素：${EL_ZH[ri.el]}  守护星：${ri.ruler}`;
      o += `\n  外在表现：${ri.traits.join('、')}`;
    }
    o += `\n\n【元素平衡】太阳${EL_ZH[s.el]}+月亮${EL_ZH[m.el]}${ri ? '+上升' + EL_ZH[ri.el] : ''}`;
    const sc = getCompat(s, m);
    o += `\n太阳-月亮内在协调度：${sc}%`;
    if (r.natalAspects && r.natalAspects.length) {
      o += `\n\n【本命相位】`;
      r.natalAspects.forEach(a => { o += `\n${a.names}（${a.type} orb${a.orbDeg}° ${a.strength}）：${a.effect}`; });
    }
    if (r.transits) {
      const PZH = { Mercury:'水星', Venus:'金星', Mars:'火星', Jupiter:'木星', Saturn:'土星' };
      o += `\n\n【当前行星过境（Transit）】`;
      for (const [p, info] of Object.entries(r.transits)) {
        o += `\n${PZH[p]||p}：${info.sign}座 ${info.degree}°${info.retrograde ? ' ⟲逆行中' : ''}`;
      }
      const retroList = Object.entries(r.transits).filter(([,v]) => v.retrograde).map(([k]) => PZH[k]||k);
      if (retroList.length) o += `\n当前逆行行星：${retroList.join('、')}（逆行期间该行星领域需要回顾和反思）`;
    }
    if (r.moonTransit) {
      o += `\n\n【当前月相】${r.moonTransit.phaseName}`;
      o += `\n月亮过境：${r.moonTransit.sign}座 ${r.moonTransit.degree}°`;
    }
    if (r.transitAspects && r.transitAspects.length) {
      o += `\n\n【流年相位（影响当前运势）】`;
      r.transitAspects.forEach(a => { o += `\n${a.names}（${a.type} orb${a.orbDeg}° ${a.strength}）：${a.effect}`; });
    }
    if (r.houseCusps) {
      o += `\n\n【十二宫位（Placidus）】`;
      r.houseCusps.forEach(h => {
        const label = h.isAngle ? '★' : ' ';
        o += `\n${label}第${h.house}宫 ${h.sign.zh}${h.sign.degree.toFixed(0)}°（${h.meaning}）`;
      });
    }
    return o;
  }
  let o = `你的星座组合：`;
  o += `\n☀️ 太阳${s.zh}${r.sunDegree}° — ${s.simTrait}`;
  o += `\n🌙 月亮${m.zh}${r.moonDegree}° — ${m.simTrait}`;
  if (ri) o += `\n⬆️ 上升${ri.zh} — ${ri.simTrait}`;
  o += `\n\n太阳${s.zh}决定你的核心性格：${s.traits.slice(0, 2).join('、')}`;
  o += `\n月亮${m.zh}决定你的内心需求：${m.traits.slice(0, 2).join('、')}`;
  if (ri) o += `\n上升${ri.zh}决定别人对你的第一印象：${ri.traits.slice(0, 2).join('、')}`;
  const sc = getCompat(s, m);
  o += `\n\n你的太阳与月亮${sc >= 80 ? '高度和谐' : sc >= 60 ? '互相配合' : sc >= 50 ? '需要磨合' : '存在张力'}（协调度${sc}%）`;
  if (r.moonTransit) o += `\n\n今日月相：${r.moonTransit.phaseName}，月亮在${r.moonTransit.sign}座`;
  if (r.transits) {
    const PZH = { Mercury:'水星', Venus:'金星', Mars:'火星', Jupiter:'木星', Saturn:'土星' };
    const retroList = Object.entries(r.transits).filter(([,v]) => v.retrograde).map(([k]) => PZH[k]||k);
    if (retroList.length) o += `\n当前${retroList.join('、')}逆行中，相关领域宜回顾反思`;
    // Key transits
    const jup = r.transits.Jupiter; if (jup) o += `\n木星在${jup.sign}座：${jup.sign === s.zh.replace('座','') ? '木星过境你的太阳星座，好运期！' : '扩展与机遇在'+jup.sign+'座领域'}`;
    const sat = r.transits.Saturn; if (sat) o += `\n土星在${sat.sign}座：${sat.sign === s.zh.replace('座','') ? '土星回归，考验与成长期' : '需要在'+sat.sign+'座领域建立纪律'}`;
  }
  return o;
}

module.exports = { calculate, formatForAI, getSunSign, getCompat, SIGNS };
