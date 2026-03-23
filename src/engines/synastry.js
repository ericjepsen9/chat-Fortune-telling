/**
 * 星座配对引擎（Synastry）— 双人星盘对比
 * 太阳-月亮交叉相位 + 元素配合 + Venus-Mars + 综合评分
 */
const ac = require('./astro-calc');
const astroEngine = require('./astrology');

const EL_ZH = { fire:'火象', earth:'土象', air:'风象', water:'水象' };
const COMPAT = {
  fire:  { fire:80, earth:45, air:92, water:40 },
  earth: { fire:45, earth:78, air:50, water:88 },
  air:   { fire:92, earth:50, air:75, water:45 },
  water: { fire:40, earth:88, air:45, water:82 },
};

function findAspect(lng1, lng2) {
  const diff = Math.abs(lng1 - lng2);
  const angle = diff > 180 ? 360 - diff : diff;
  const orb = 10;
  const mk = (exact, type, harmony, effect) => {
    const orbDeg = Math.round(Math.abs(angle - exact) * 10) / 10;
    const strength = orbDeg <= 2 ? '精确' : orbDeg <= 5 ? '紧密' : '松散';
    return { type, harmony, effect, orbDeg, strength, angle: Math.round(angle*10)/10 };
  };
  if (angle <= orb) return mk(0, '合相(0°)', 90, '灵魂共振，深度连接');
  if (Math.abs(angle - 60) <= orb) return mk(60, '六合(60°)', 80, '轻松和谐，自然互助');
  if (Math.abs(angle - 90) <= orb) return mk(90, '刑相(90°)', 35, '摩擦紧张，但有成长动力');
  if (Math.abs(angle - 120) <= orb) return mk(120, '三合(120°)', 85, '默契天成，相处舒适');
  if (Math.abs(angle - 180) <= orb) return mk(180, '对冲(180°)', 50, '强烈吸引但也强烈冲突');
  return null;
}

const MOON_INTERACT = {
  'fire-fire': '两人内心都热烈直接，一起时充满活力但也容易擦枪走火',
  'fire-earth': '一个内心热烈一个务实沉稳，需要对方给予你不擅长的东西',
  'fire-air': '内心的热情与好奇碰撞，交流畅快、创意十足',
  'fire-water': '热情遇上敏感，相互吸引但内心节奏完全不同',
  'earth-earth': '两人都需要安全感和稳定，关起门来很有默契',
  'earth-air': '一个脚踏实地一个天马行空，互相费解但互补',
  'earth-water': '务实遇上温柔，彼此给对方最需要的滋养',
  'air-air': '两个人都活在思想世界里，聊天永远不会冷场',
  'air-water': '理性遇上感性，需要学习对方的语言',
  'water-water': '两颗敏感的心，深度共情但容易一起陷入情绪漩涡',
};

function calculate(person1, person2) {
  const r1 = astroEngine.calculate(person1);
  const r2 = astroEngine.calculate(person2);

  const s1 = r1.sunLongitude, m1 = r1.moonLongitude;
  const s2 = r2.sunLongitude, m2 = r2.moonLongitude;

  // 四重交叉相位（合婚核心）
  const crossAspects = [];
  const a_ss = findAspect(s1, s2); if (a_ss) crossAspects.push({ pair: '你的太阳↔对方太阳', ...a_ss });
  const a_mm = findAspect(m1, m2); if (a_mm) crossAspects.push({ pair: '你的月亮↔对方月亮', ...a_mm });
  const a_sm = findAspect(s1, m2); if (a_sm) crossAspects.push({ pair: '你的太阳↔对方月亮', ...a_sm });
  const a_ms = findAspect(m1, s2); if (a_ms) crossAspects.push({ pair: '你的月亮↔对方太阳', ...a_ms });

  // Venus-Mars 吸引力（用行星近似位置）
  const p1 = ac.getPlanetPositions(parseInt(person1.year), parseInt(person1.month), parseInt(person1.day), parseInt(person1.hour)||12);
  const p2 = ac.getPlanetPositions(parseInt(person2.year), parseInt(person2.month), parseInt(person2.day), parseInt(person2.hour)||12);
  const vm1 = findAspect(p1.Venus?.longitude||0, p2.Mars?.longitude||0);
  const vm2 = findAspect(p1.Mars?.longitude||0, p2.Venus?.longitude||0);
  if (vm1) crossAspects.push({ pair: '你的金星↔对方火星', ...vm1 });
  if (vm2) crossAspects.push({ pair: '你的火星↔对方金星', ...vm2 });

  // 元素配合
  const elCompat = COMPAT[r1.sunSign.el]?.[r2.sunSign.el] || 60;
  const moonElCompat = COMPAT[r1.moonSign.el]?.[r2.moonSign.el] || 60;

  // 综合评分
  let aspectAvg = 60;
  if (crossAspects.length) aspectAvg = Math.round(crossAspects.reduce((a, c) => a + c.harmony, 0) / crossAspects.length);
  const totalScore = Math.round(elCompat * 0.25 + moonElCompat * 0.25 + aspectAvg * 0.5);

  let grade, gradeDesc;
  if (totalScore >= 85) { grade = '灵魂伴侣'; gradeDesc = '极高共振，仿佛命中注定'; }
  else if (totalScore >= 75) { grade = '天生一对'; gradeDesc = '高度和谐，自然而然的默契'; }
  else if (totalScore >= 65) { grade = '互相吸引'; gradeDesc = '有火花也有摩擦，适合成长型关系'; }
  else if (totalScore >= 55) { grade = '需要磨合'; gradeDesc = '差异明显，但差异也是互补的机会'; }
  else { grade = '挑战较大'; gradeDesc = '需要大量沟通和包容来维系'; }

  // Moon sign interaction
  const mels = [r1.moonSign.el, r2.moonSign.el].sort();
  const moonInteraction = MOON_INTERACT[mels.join('-')] || '月亮星座互动需具体分析';

  return {
    person1: { sunSign: r1.sunSign, moonSign: r1.moonSign, risingSign: r1.risingSign, sunDegree: r1.sunDegree, moonDegree: r1.moonDegree },
    person2: { sunSign: r2.sunSign, moonSign: r2.moonSign, risingSign: r2.risingSign, sunDegree: r2.sunDegree, moonDegree: r2.moonDegree },
    crossAspects, moonInteraction,
    scores: { sunElement: elCompat, moonElement: moonElCompat, aspects: aspectAvg, total: totalScore },
    grade, gradeDesc,
  };
}

function formatForAI(result, mode = 'simple') {
  const r = result, p1 = r.person1, p2 = r.person2, s = r.scores;
  if (mode === 'expert') {
    let o = `【星座配对分析（Synastry）】`;
    o += `\n\n甲方星盘：`;
    o += `\n  太阳${p1.sunSign.zh}${p1.sunDegree}° 月亮${p1.moonSign.zh}${p1.moonDegree}°${p1.risingSign ? ' 上升'+p1.risingSign.zh : ''}`;
    o += `\n乙方星盘：`;
    o += `\n  太阳${p2.sunSign.zh}${p2.sunDegree}° 月亮${p2.moonSign.zh}${p2.moonDegree}°${p2.risingSign ? ' 上升'+p2.risingSign.zh : ''}`;
    o += `\n\n═══ 综合评分：${s.total}分 · ${r.grade} ═══`;
    o += `\n${r.gradeDesc}`;
    o += `\n\n【元素配合】`;
    o += `\n太阳元素：${EL_ZH[p1.sunSign.el]}×${EL_ZH[p2.sunSign.el]}（${s.sunElement}分）`;
    o += `\n月亮元素：${EL_ZH[p1.moonSign.el]}×${EL_ZH[p2.moonSign.el]}（${s.moonElement}分）`;
    if (r.moonInteraction) o += `\n月亮互动：${r.moonInteraction}`;
    if (r.crossAspects.length) {
      o += `\n\n【交叉相位（核心配对数据）】`;
      r.crossAspects.forEach(a => { o += `\n${a.pair} ${a.type}（orb${a.orbDeg}° ${a.strength} ${a.harmony}分）：${a.effect}`; });
    } else {
      o += `\n\n【交叉相位】无显著相位（双方行星角度差处于中间地带）`;
    }
    return o;
  }
  let o = `你们的星座配对：`;
  o += `\n\n💫 综合评分：${s.total}分（${r.grade}）`;
  o += `\n${r.gradeDesc}`;
  o += `\n\n你：太阳${p1.sunSign.zh} + 月亮${p1.moonSign.zh}`;
  o += `\n对方：太阳${p2.sunSign.zh} + 月亮${p2.moonSign.zh}`;
  o += `\n\n太阳${p1.sunSign.zh}×${p2.sunSign.zh}：${s.sunElement >= 80 ? '很合拍' : s.sunElement >= 60 ? '尚可' : '需要磨合'}`;
  o += `\n月亮${p1.moonSign.zh}×${p2.moonSign.zh}：${s.moonElement >= 80 ? '内心需求一致' : s.moonElement >= 60 ? '能互相理解' : '内在节奏不同'}`;
  if (r.moonInteraction) o += `\n${r.moonInteraction}`;
  if (r.crossAspects.length) {
    o += `\n\n关键连接：`;
    r.crossAspects.slice(0, 3).forEach(a => { o += `\n· ${a.pair}：${a.effect}`; });
  }
  return o;
}

module.exports = { calculate, formatForAI };
