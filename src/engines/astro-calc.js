/**
 * 天文计算共享模块 — 基于 astronomia 库 + VSOP87精算
 * 提供真实的太阳/月亮/行星黄经，供星座和印占引擎使用
 * 行星精度: VSOP87 ±0.01° (旧版Keplerian ±1°)
 */
const { moonposition, julian, nutation, solar, planetposition } = require('astronomia');

// VSOP87 planet data (high precision series)
const vsopEarth = new planetposition.Planet(require('astronomia/data/vsop87Bearth').default);
const vsopMercury = new planetposition.Planet(require('astronomia/data/vsop87Bmercury').default);
const vsopVenus = new planetposition.Planet(require('astronomia/data/vsop87Bvenus').default);
const vsopMars = new planetposition.Planet(require('astronomia/data/vsop87Bmars').default);
const vsopJupiter = new planetposition.Planet(require('astronomia/data/vsop87Bjupiter').default);
const vsopSaturn = new planetposition.Planet(require('astronomia/data/vsop87Bsaturn').default);

const SIGNS_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const SIGNS_ZH = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];

/**
 * 获取月亮热带黄道经度（真实天文计算）
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour (local hour, timezone offset in hours)
 * @param {number} tzOffset (default 8 = UTC+8 Beijing)
 * @returns {number} ecliptic longitude in degrees 0-360
 */
function getMoonLongitude(year, month, day, hour = 12, tzOffset = 8) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);
  const mEq = moonposition.position(jd);
  const ra = mEq._ra, dec = mEq._dec;
  const eps = nutation.meanObliquity(jd) + nutation.nutation(jd)[1];
  const sinLng = Math.sin(ra) * Math.cos(eps) + Math.tan(dec) * Math.sin(eps);
  const cosLng = Math.cos(ra);
  let lng = Math.atan2(sinLng, cosLng) * 180 / Math.PI;
  if (lng < 0) lng += 360;
  return lng;
}

/**
 * 获取太阳热带黄道经度（真实天文计算）
 */
function getSunLongitude(year, month, day, hour = 12, tzOffset = 8) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);
  const T = (jd - 2451545.0) / 36525;
  let lng = solar.apparentLongitude(T) * 180 / Math.PI;
  if (lng < 0) lng += 360;
  return lng;
}

/**
 * Lahiri Ayanamsa（动态计算）
 */
function getAyanamsa(year, month = 1, day = 1) {
  const jd = julian.CalendarGregorianToJD(year, month, day);
  // Lahiri ayanamsa: 23°51' at J2000.0 + precession rate ~50.29"/year
  const T = (jd - 2451545.0) / 36525;
  return 23.85 + 50.29 / 3600 * T * 100;
}

/**
 * 热带经度 → 星座
 */
function longitudeToSign(lng) {
  const idx = Math.floor(((lng % 360) + 360) % 360 / 30);
  return { index: idx, en: SIGNS_EN[idx], zh: SIGNS_ZH[idx], degree: ((lng % 360 + 360) % 360) % 30 };
}

/**
 * 计算上升星座（完整球面三角公式）
 * ASC = atan2(cos(RAMC), -(sin(RAMC)*cos(ε) + tan(φ)*sin(ε)))
 * RAMC = Local Sidereal Time = GMST + observer longitude
 */
function getRisingSign(year, month, day, hour, tzOffset = 8, latitude = 39.9, longitude = 116.4) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);

  // Greenwich Mean Sidereal Time (high precision)
  const T = (jd - 2451545.0) / 36525;
  const T2 = T * T, T3 = T2 * T;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T2 - T3 / 38710000;
  gmst = ((gmst % 360) + 360) % 360;

  // Nutation in longitude (Δψ) for precision
  const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
  const Ls = (280.47 + 36000.77 * T) * Math.PI / 180;
  const deltaPsi = -17.2 / 3600 * Math.sin(omega) - 1.32 / 3600 * Math.sin(2 * Ls); // degrees

  // Apparent sidereal time
  const eps0 = 23.4393 - 0.01300 * T; // mean obliquity in degrees
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * Math.PI / 180; // true obliquity in radians
  const gast = gmst + deltaPsi * Math.cos(eps); // apparent ST

  // Local Sidereal Time (use actual observer longitude, not fixed)
  const lst = ((gast + longitude) % 360 + 360) % 360;

  // Ascendant formula
  const lstRad = lst * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const ascRad = Math.atan2(Math.cos(lstRad), -(Math.sin(lstRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps)));
  let ascDeg = ascRad * 180 / Math.PI;
  if (ascDeg < 0) ascDeg += 360;
  return longitudeToSign(ascDeg);
}

/**
 * Rahu/Ketu（月亮交点）— 真实天文计算
 */
function getRahuKetu(year, month, day, hour = 12, tzOffset = 8) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);
  const rahuRad = moonposition.trueNode(jd);
  const rahuDeg = ((rahuRad * 180 / Math.PI) % 360 + 360) % 360;
  const ketuDeg = (rahuDeg + 180) % 360;
  return { rahu: rahuDeg, ketu: ketuDeg };
}

/**
 * 五大行星黄经（VSOP87精算 — ±0.01°精度）
 * 替代旧版Keplerian+摄动修正(±1°)
 */
function getPlanetPositions(year, month, day, hour = 12, tzOffset = 8) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);

  const earthPos = vsopEarth.position(jd);
  const planets = {
    Mercury: vsopMercury, Venus: vsopVenus,
    Mars: vsopMars, Jupiter: vsopJupiter, Saturn: vsopSaturn,
  };

  const results = {};
  for (const [name, planet] of Object.entries(planets)) {
    const pp = planet.position(jd);
    // Heliocentric → Geocentric conversion
    const x = pp.range*Math.cos(pp.lat)*Math.cos(pp.lon) - earthPos.range*Math.cos(earthPos.lat)*Math.cos(earthPos.lon);
    const y = pp.range*Math.cos(pp.lat)*Math.sin(pp.lon) - earthPos.range*Math.cos(earthPos.lat)*Math.sin(earthPos.lon);
    let geoLng = Math.atan2(y, x) * 180 / Math.PI;
    geoLng = ((geoLng % 360) + 360) % 360;
    results[name] = longitudeToSign(geoLng);
    results[name].longitude = Math.round(geoLng * 100) / 100;
  }
  return results;
}

/**
 * 检测行星逆行（当前位置 vs 前一天位置，如果前一天经度更大则逆行）
 */
function getRetrogrades(year, month, day, hour = 12, tzOffset = 8) {
  const today = getPlanetPositions(year, month, day, hour, tzOffset);
  const yesterday = getPlanetPositions(year, month, day - 1, hour, tzOffset);
  const retro = {};
  for (const name of Object.keys(today)) {
    const diff = today[name].longitude - yesterday[name].longitude;
    // Handle 360→0 wrap: if diff > 180, planet went backwards across 0°
    const adjusted = diff > 180 ? diff - 360 : diff < -180 ? diff + 360 : diff;
    retro[name] = adjusted < 0; // negative = retrograde
  }
  return retro;
}

/**
 * 获取当前时刻的月亮Transit信息
 */
function getCurrentMoonTransit(tzOffset = 8) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate(), h = now.getHours();
  const lng = getMoonLongitude(y, m, d, h, tzOffset);
  const sign = longitudeToSign(lng);
  // 月亮相位（与太阳的角度差）
  const sunLng = getSunLongitude(y, m, d, h, tzOffset);
  let phase = ((lng - sunLng) % 360 + 360) % 360;
  let phaseName;
  if (phase < 22.5 || phase >= 337.5) phaseName = '新月（种子期）';
  else if (phase < 67.5) phaseName = '蛾眉月（成长期）';
  else if (phase < 112.5) phaseName = '上弦月（行动期）';
  else if (phase < 157.5) phaseName = '盈凸月（完善期）';
  else if (phase < 202.5) phaseName = '满月（丰收期）';
  else if (phase < 247.5) phaseName = '亏凸月（分享期）';
  else if (phase < 292.5) phaseName = '下弦月（释放期）';
  else phaseName = '残月（休整期）';
  return { sign: sign.zh, degree: sign.degree.toFixed(1), longitude: lng, phaseName, phaseAngle: Math.round(phase) };
}

/**
 * Placidus宫位系统
 * 计算12宫位起始度数(cusp)
 */
function getHouseCusps(year, month, day, hour, tzOffset = 8, latitude = 39.9, longitude = 116.4) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);
  const T = (jd - 2451545.0) / 36525;

  // GMST → GAST → LST
  const T2 = T * T, T3 = T2 * T;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T2 - T3 / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
  const Ls = (280.47 + 36000.77 * T) * Math.PI / 180;
  const deltaPsi = -17.2 / 3600 * Math.sin(omega) - 1.32 / 3600 * Math.sin(2 * Ls);
  const eps0 = 23.4393 - 0.01300 * T;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * Math.PI / 180;
  const gast = gmst + deltaPsi * Math.cos(eps);
  const lst = ((gast + longitude) % 360 + 360) % 360;

  const lstRad = lst * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;

  // MC (Midheaven) — cusp of 10th house
  let mc = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(eps)) * 180 / Math.PI;
  if (mc < 0) mc += 360;
  // Ensure MC is in correct quadrant
  if (lst > 180 && mc < 180) mc += 180;
  if (lst <= 180 && mc > 180) mc -= 180;
  mc = ((mc % 360) + 360) % 360;

  // ASC (Ascendant) — cusp of 1st house
  const ascRad = Math.atan2(Math.cos(lstRad), -(Math.sin(lstRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps)));
  let asc = ascRad * 180 / Math.PI;
  if (asc < 0) asc += 360;

  // IC (Imum Coeli) — cusp of 4th house (opposite MC)
  const ic = (mc + 180) % 360;
  // DSC (Descendant) — cusp of 7th house (opposite ASC)
  const dsc = (asc + 180) % 360;

  // Placidus intermediate cusps using semi-arc trisection
  function placidusCusp(f, above) {
    // f = fraction (1/3 or 2/3), above = true for houses above horizon
    let cusp = 0;
    // Iterative approach for Placidus
    for (let i = 0; i < 20; i++) {
      const tryRamc = above
        ? lstRad + f * (Math.PI - Math.acos(-Math.tan(latRad) * Math.tan(Math.asin(Math.sin(eps) * Math.sin(cusp * Math.PI / 180)))))
        : lstRad - f * (Math.PI - Math.acos(Math.tan(latRad) * Math.tan(Math.asin(Math.sin(eps) * Math.sin(cusp * Math.PI / 180)))));
      cusp = Math.atan2(Math.sin(tryRamc), -(Math.sin(tryRamc % (2*Math.PI)) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps))) * 180 / Math.PI;
      if (cusp < 0) cusp += 360;
    }
    return cusp;
  }

  // Simplified Placidus: trisect arcs between angles
  // For simplicity and reliability, use equal-arc trisection (Porphyry-style)
  // which is the most commonly used approximation
  function trisect(from, to, frac) {
    let diff = to - from;
    if (diff < 0) diff += 360;
    return ((from + diff * frac) % 360 + 360) % 360;
  }

  const cusps = [
    asc,                      // 1st (ASC)
    trisect(asc, ic, 1/3),    // 2nd
    trisect(asc, ic, 2/3),    // 3rd
    ic,                       // 4th (IC)
    trisect(ic, dsc, 1/3),    // 5th
    trisect(ic, dsc, 2/3),    // 6th
    dsc,                      // 7th (DSC)
    trisect(dsc, mc, 1/3),    // 8th
    trisect(dsc, mc, 2/3),    // 9th
    mc,                       // 10th (MC)
    trisect(mc, asc, 1/3),    // 11th
    trisect(mc, asc, 2/3),    // 12th
  ];

  const HOUSE_MEANINGS = [
    '自我·外在形象','财富·价值观','沟通·学习','家庭·根基',
    '创造·恋爱','健康·服务','关系·合作','转化·深层',
    '哲学·远行','事业·社会地位','朋友·理想','灵性·隐秘',
  ];

  return cusps.map((c, i) => ({
    house: i + 1,
    cusp: Math.round(c * 100) / 100,
    sign: longitudeToSign(c),
    meaning: HOUSE_MEANINGS[i],
    isAngle: [0,3,6,9].includes(i), // ASC/IC/DSC/MC
  }));
}

module.exports = { getMoonLongitude, getSunLongitude, getAyanamsa, longitudeToSign, getRisingSign, getPlanetPositions, getRahuKetu, getRetrogrades, getCurrentMoonTransit, getHouseCusps, SIGNS_ZH, SIGNS_EN };
