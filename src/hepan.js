/**
 * 缘合 — 双人合盘模块 v2
 * 综合八字合婚 + 星座配对，输出统一的合盘报告
 */
const hehunEngine = require('./engines/hehun');
const synastryEngine = require('./engines/synastry');

function fullCompat(profileA, profileB) {
  const bazi = hehunEngine.calculate(profileA, profileB);
  const astro = synastryEngine.calculate(profileA, profileB);
  // 综合评分（八字60% + 星座40%）
  const finalScore = Math.round(bazi.scores.total * 0.6 + astro.scores.total * 0.4);
  let finalGrade;
  if (finalScore >= 88) finalGrade = '天作之合';
  else if (finalScore >= 78) finalGrade = '非常般配';
  else if (finalScore >= 68) finalGrade = '良缘佳偶';
  else if (finalScore >= 58) finalGrade = '可以发展';
  else if (finalScore >= 48) finalGrade = '需要经营';
  else finalGrade = '挑战较大';
  return { bazi, astro, finalScore, finalGrade };
}

function formatForAI(result, mode = 'simple') {
  const r = result;
  if (mode === 'expert') {
    let o = hehunEngine.formatForAI(r.bazi, 'expert');
    o += '\n\n' + synastryEngine.formatForAI(r.astro, 'expert');
    o += `\n\n═══ 综合配对：${r.finalScore}分 · ${r.finalGrade} ═══`;
    o += `\n（八字合婚${r.bazi.scores.total}分×60% + 星座配对${r.astro.scores.total}分×40%）`;
    return o;
  }
  let o = `💑 你们的缘分综合评分：${r.finalScore}分（${r.finalGrade}）`;
  o += '\n\n' + hehunEngine.formatForAI(r.bazi, 'simple');
  o += '\n\n' + synastryEngine.formatForAI(r.astro, 'simple');
  return o;
}

module.exports = { fullCompat, formatForAI, hehunEngine, synastryEngine };
