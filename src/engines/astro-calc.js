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
 * 计算上升星座（近似 — 基于恒星时）
 * 精确计算需要 地平坐标+大气折射，这里用简化恒星时法
 */
function getRisingSign(year, month, day, hour, tzOffset = 8, latitude = 39.9) {
  const utcHour = hour - tzOffset;
  const dayFrac = day + utcHour / 24;
  const jd = julian.CalendarGregorianToJD(year, month, dayFrac);
  // Greenwich Mean Sidereal Time
  const T = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  gmst = ((gmst % 360) + 360) % 360;
  // Local sidereal time (approximate longitude for Beijing ~116.4°)
  const lst = (gmst + 116.4) % 360;
  // Ascendant = LST (simplified — real calc uses latitude and obliquity)
  // More accurate: MC = LST, Asc = atan(cos(MC) / (-sin(MC)*cos(eps) - tan(lat)*sin(eps)))
  const eps = 23.44 * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const lstRad = lst * Math.PI / 180;
  const ascRad = Math.atan2(Math.cos(lstRad), -(Math.sin(lstRad) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps)));
  let ascDeg = ascRad * 180 / Math.PI;
  if (ascDeg < 0) ascDeg += 360;
  return longitudeToSign(ascDeg);
}

module.exports = { getMoonLongitude, getSunLongitude, getAyanamsa, longitudeToSign, getRisingSign, SIGNS_ZH, SIGNS_EN };
