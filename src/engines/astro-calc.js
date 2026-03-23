/**
 * 天文计算共享模块 — 基于 astronomia 库
 * 提供真实的太阳/月亮黄经，供星座和印占引擎使用
 */
const { moonposition, julian, nutation, solar } = require('astronomia');

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
 * 五大行星黄经（Keplerian + 摄动修正 + 日心→地心转换）
 * 摄动修正将精度从±5°提升到±1°
 */
function getPlanetPositions(year, month, day, hour = 12, tzOffset = 8) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);
  const T = (jd - 2451545.0) / 36525;
  const d = jd - 2451545.0; // days from J2000

  // [L0, Lrate, perihelion, pRate, ecc, eccRate, semiMajorAxis(AU)]
  const orbits = {
    Mercury: [252.2509, 149472.6746, 77.4561, 1.5564, 0.20563, 0.000021, 0.387],
    Venus:   [181.9798, 58517.8157, 131.5637, 1.4022, 0.00677, -0.000047, 0.723],
    Earth:   [100.4664, 35999.3728, 102.9373, 1.7195, 0.01671, -0.00004, 1.000],
    Mars:    [355.4330, 19140.2993, 336.0602, 1.8410, 0.09340, 0.000090, 1.524],
    Jupiter: [34.3515, 3034.9057, 14.3312, 1.6126, 0.04839, -0.000013, 5.203],
    Saturn:  [50.0774, 1222.1138, 93.0572, 1.9584, 0.05415, -0.000037, 9.537],
  };

  function helioPos(elems) {
    const [L0, Lr, w0, wr, e0, er, a] = elems;
    const L = ((L0 + Lr * T) % 360 + 360) % 360;
    const w = ((w0 + wr * T) % 360 + 360) % 360;
    const e = e0 + er * T;
    const M = ((L - w) % 360 + 360) % 360;
    const Mr = M * Math.PI / 180;
    const C = (2*e - e*e*e/4)*Math.sin(Mr) + (5/4)*e*e*Math.sin(2*Mr) + (13/12)*e*e*e*Math.sin(3*Mr);
    const lng = ((L + C * 180 / Math.PI) % 360 + 360) % 360;
    const v = Mr + C;
    const r = a * (1 - e*e) / (1 + e * Math.cos(v));
    return { lng, r, M };
  }

  // Mean anomalies for perturbation calculation
  const Mj = ((34.3515 + 3034.9057 * T - 14.3312 - 1.6126 * T) % 360 + 360) % 360 * Math.PI / 180; // Jupiter M
  const Ms = ((50.0774 + 1222.1138 * T - 93.0572 - 1.9584 * T) % 360 + 360) % 360 * Math.PI / 180; // Saturn M
  const Mm = ((355.4330 + 19140.2993 * T - 336.0602 - 1.8410 * T) % 360 + 360) % 360 * Math.PI / 180; // Mars M

  // Perturbation corrections (degrees)
  const perturbations = {
    Jupiter: -0.332 * Math.sin(2*Mj - 5*Ms - 67.6*Math.PI/180)
             - 0.056 * Math.sin(2*Mj - 2*Ms + 21*Math.PI/180)
             + 0.042 * Math.sin(3*Mj - 5*Ms + 21*Math.PI/180),
    Saturn:  +0.812 * Math.sin(2*Mj - 5*Ms - 67.6*Math.PI/180)
             - 0.229 * Math.cos(2*Mj - 4*Ms - 2*Math.PI/180)
             + 0.119 * Math.sin(Mj - 2*Ms - 3*Math.PI/180),
    Mars:    -0.373 * Math.sin(Mm - 2*Mj + 35.5*Math.PI/180)
             - 0.122 * Math.sin(2*Mm - 2*Mj + 35.5*Math.PI/180),
    Mercury: 0, Venus: 0,
  };

  const earth = helioPos(orbits.Earth);
  const earthLng = earth.lng * Math.PI / 180;
  const earthR = earth.r;

  const results = {};
  for (const name of ['Mercury','Venus','Mars','Jupiter','Saturn']) {
    const p = helioPos(orbits[name]);
    // Apply perturbation
    const correctedLng = p.lng + (perturbations[name] || 0);
    const pLng = correctedLng * Math.PI / 180;
    const pR = p.r;

    // Heliocentric → Geocentric
    const dx = pR * Math.cos(pLng) - earthR * Math.cos(earthLng);
    const dy = pR * Math.sin(pLng) - earthR * Math.sin(earthLng);
    let geoLng = Math.atan2(dy, dx) * 180 / Math.PI;
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

module.exports = { getMoonLongitude, getSunLongitude, getAyanamsa, longitudeToSign, getRisingSign, getPlanetPositions, getRahuKetu, getRetrogrades, getCurrentMoonTransit, SIGNS_ZH, SIGNS_EN };
