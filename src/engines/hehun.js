/**
 * 八字合婚引擎 — 双人八字配对分析
 * 综合评分：日干配合 + 五行互补 + 地支合冲 + 神煞 + 纳音 + 大运同步
 */
const baziEngine = require('./bazi');

const WX_MAP = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const DZ_WX = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
const SHENG = { 金:'水', 水:'木', 木:'火', 火:'土', 土:'金' };
const CHONG = { 子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳' };
const LIUHE = { 子:'丑',丑:'子',寅:'亥',卯:'戌',辰:'酉',巳:'申',午:'未',未:'午',申:'巳',酉:'辰',戌:'卯',亥:'寅' };

// 日干配合评分 (天干合最佳，同五行次之，生我/我生中等，克关系低)
function dayMasterCompat(dm1, dm2) {
  const HE = {甲:'己',己:'甲',乙:'庚',庚:'乙',丙:'辛',辛:'丙',丁:'壬',壬:'丁',戊:'癸',癸:'戊'};
  if (HE[dm1] === dm2) return { score: 95, desc: `${dm1}${dm2}天干相合，天作之合`, type: '天干合' };
  const wx1 = WX_MAP[dm1], wx2 = WX_MAP[dm2];
  if (wx1 === wx2) return { score: 75, desc: `同属${wx1}，性格相近易理解`, type: '比和' };
  if (SHENG[wx1] === wx2) return { score: 70, desc: `${wx1}生${wx2}，你对对方有滋养`, type: '我生' };
  if (SHENG[wx2] === wx1) return { score: 70, desc: `${wx2}生${wx1}，对方对你有助力`, type: '生我' };
  return { score: 45, desc: `${wx1}克${wx2}或${wx2}克${wx1}，性格互斥需磨合`, type: '相克' };
}

// 五行互补评分
function wuxingComplement(wx1, wx2, lack1, lack2) {
  let score = 60, details = [];
  // 对方有你缺的五行
  const lack1filled = lack1.filter(l => wx2[l] > 0);
  const lack2filled = lack2.filter(l => wx1[l] > 0);
  if (lack1filled.length) { score += lack1filled.length * 10; details.push(`对方补你缺${lack1filled.join('、')}`); }
  if (lack2filled.length) { score += lack2filled.length * 10; details.push(`你补对方缺${lack2filled.join('、')}`); }
  // 五行分布平衡度
  const combined = {};
  Object.keys(wx1).forEach(k => { combined[k] = (wx1[k]||0) + (wx2[k]||0); });
  const vals = Object.values(combined);
  const avg = vals.reduce((a,b)=>a+b,0) / 5;
  const variance = vals.reduce((a,v) => a + Math.pow(v-avg,2), 0) / 5;
  if (variance < 3) { score += 10; details.push('双方五行合在一起很均衡'); }
  if (!details.length) details.push('五行互补度一般');
  return { score: Math.min(score, 100), details };
}

// 地支配合（日支为婚姻宫，重点看）
function dizhiCompat(fp1, fp2) {
  const dz1 = fp1.day[1], dz2 = fp2.day[1]; // 日支=婚姻宫
  let score = 60, details = [];

  // 日支关系（最重要）
  if (LIUHE[dz1] === dz2) { score += 30; details.push(`日支${dz1}${dz2}六合（婚姻宫和合，感情最融洽）`); }
  else if (CHONG[dz1] === dz2) { score -= 20; details.push(`日支${dz1}${dz2}六冲（婚姻宫相冲，关系多波折）`); }

  // 年支关系
  const yz1 = fp1.year[1], yz2 = fp2.year[1];
  if (LIUHE[yz1] === yz2) { score += 10; details.push(`年支${yz1}${yz2}六合（家庭背景和谐）`); }
  else if (CHONG[yz1] === yz2) { score -= 10; details.push(`年支${yz1}${yz2}六冲（家庭观念有冲突）`); }

  // 生肖三合
  const SANHE_MAP = { 申:'子辰', 子:'申辰', 辰:'申子', 寅:'午戌', 午:'寅戌', 戌:'寅午', 亥:'卯未', 卯:'亥未', 未:'亥卯', 巳:'酉丑', 酉:'巳丑', 丑:'巳酉' };
  if (SANHE_MAP[yz1] && SANHE_MAP[yz1].includes(yz2)) { score += 8; details.push(`生肖三合（${yz1}${yz2}，和睦）`); }

  // 相害
  const HAI = {子:'未',丑:'午',寅:'巳',卯:'辰',申:'亥',酉:'戌',未:'子',午:'丑',巳:'寅',辰:'卯',亥:'申',戌:'酉'};
  if (HAI[dz1] === dz2) { score -= 10; details.push(`日支${dz1}${dz2}相害（暗中消耗感情）`); }

  if (!details.length) details.push('地支关系平淡，无特殊合冲');
  return { score: Math.max(Math.min(score, 100), 10), details };
}

// 纳音配合
function nayinCompat(ny1, ny2) {
  const wxFromNy = (ny) => { if (ny.includes('金')) return '金'; if (ny.includes('木')) return '木'; if (ny.includes('水')) return '水'; if (ny.includes('火')) return '火'; if (ny.includes('土')) return '土'; return ''; };
  const w1 = wxFromNy(ny1.year), w2 = wxFromNy(ny2.year);
  if (!w1 || !w2) return { score: 60, desc: '纳音关系中性' };
  if (w1 === w2) return { score: 70, desc: `年命纳音同属${w1}，根基相近` };
  if (SHENG[w1] === w2 || SHENG[w2] === w1) return { score: 80, desc: `年命纳音${w1}与${w2}相生，根基互助` };
  return { score: 40, desc: `年命纳音${w1}与${w2}相克，需注意根本分歧` };
}

// 大运同步度
function dayunSync(dy1, dy2, nowYear) {
  const cur1 = dy1.current, cur2 = dy2.current;
  if (!cur1 || !cur2) return { score: 60, desc: '大运数据不足' };
  const wx1 = WX_MAP[cur1.gz[0]], wx2 = WX_MAP[cur2.gz[0]];
  const same = wx1 === wx2;
  const sheng = SHENG[wx1] === wx2 || SHENG[wx2] === wx1;
  const pct1 = Math.round(((nowYear - cur1.startYear) / 10) * 100);
  const pct2 = Math.round(((nowYear - cur2.startYear) / 10) * 100);
  let score = 60;
  if (same) { score = 80; } else if (sheng) { score = 75; }
  const desc = `你当前${cur1.gz}大运(${pct1}%)，对方${cur2.gz}大运(${pct2}%)，五行${same ? '同步' : sheng ? '互助' : '各行其道'}`;
  return { score, desc };
}

// ============ 主函数 ============
function calculate(person1, person2) {
  const r1 = baziEngine.calculate(person1);
  const r2 = baziEngine.calculate(person2);

  const dm = dayMasterCompat(r1.dayMaster, r2.dayMaster);
  const wx = wuxingComplement(r1.wuxing, r2.wuxing, r1.wuxingLack, r2.wuxingLack);
  const dz = dizhiCompat(r1.fourPillars, r2.fourPillars);
  const ny = nayinCompat(r1.nayin, r2.nayin);
  const dy = dayunSync(r1.dayun, r2.dayun, new Date().getFullYear());

  // 综合评分（权重：日干30% + 地支25% + 五行20% + 纳音10% + 大运15%）
  const totalScore = Math.round(dm.score * 0.3 + dz.score * 0.25 + wx.score * 0.2 + ny.score * 0.1 + dy.score * 0.15);

  let grade, gradeDesc;
  if (totalScore >= 90) { grade = '上上婚'; gradeDesc = '天作之合，感情甜蜜，互相成就'; }
  else if (totalScore >= 80) { grade = '上等婚'; gradeDesc = '非常般配，互补性强，适合长期发展'; }
  else if (totalScore >= 70) { grade = '中上婚'; gradeDesc = '配合度高，小有摩擦但瑕不掩瑜'; }
  else if (totalScore >= 60) { grade = '中等婚'; gradeDesc = '需要经营，互相包容是关键'; }
  else if (totalScore >= 50) { grade = '中下婚'; gradeDesc = '差异较大，需要双方共同努力'; }
  else { grade = '需慎重'; gradeDesc = '冲突较多，建议深入了解后再做决定'; }

  return {
    person1: { fourPillars: r1.fourPillars, dayMaster: r1.dayMaster, dayMasterElement: r1.dayMasterElement, dayStrength: r1.dayStrength, geju: r1.geju, wuxing: r1.wuxing, wuxingLack: r1.wuxingLack, nayin: r1.nayin, lunarDate: r1.lunarDate, dayun: r1.dayun, personality: r1.personality },
    person2: { fourPillars: r2.fourPillars, dayMaster: r2.dayMaster, dayMasterElement: r2.dayMasterElement, dayStrength: r2.dayStrength, geju: r2.geju, wuxing: r2.wuxing, wuxingLack: r2.wuxingLack, nayin: r2.nayin, lunarDate: r2.lunarDate, dayun: r2.dayun, personality: r2.personality },
    scores: { dayMaster: dm, wuxing: wx, dizhi: dz, nayin: ny, dayun: dy, total: totalScore },
    grade, gradeDesc,
  };
}

function formatForAI(result, mode = 'simple') {
  const r = result, p1 = r.person1, p2 = r.person2, s = r.scores;
  if (mode === 'expert') {
    let o = `【八字合婚分析】`;
    o += `\n\n甲方：${p1.lunarDate?.solarStr || ''}`;
    o += `\n四柱：${p1.fourPillars.year} ${p1.fourPillars.month} ${p1.fourPillars.day} ${p1.fourPillars.hour}`;
    o += `\n日主：${p1.dayMaster}${p1.dayMasterElement}·${p1.dayStrength} ${p1.geju}`;
    o += `\n五行：${Object.entries(p1.wuxing).map(([k,v])=>`${k}${v}`).join(' ')}${p1.wuxingLack.length ? ' 缺'+p1.wuxingLack.join('') : ''}`;
    o += `\n纳音：${p1.nayin.year}`;
    o += `\n\n乙方：${p2.lunarDate?.solarStr || ''}`;
    o += `\n四柱：${p2.fourPillars.year} ${p2.fourPillars.month} ${p2.fourPillars.day} ${p2.fourPillars.hour}`;
    o += `\n日主：${p2.dayMaster}${p2.dayMasterElement}·${p2.dayStrength} ${p2.geju}`;
    o += `\n五行：${Object.entries(p2.wuxing).map(([k,v])=>`${k}${v}`).join(' ')}${p2.wuxingLack.length ? ' 缺'+p2.wuxingLack.join('') : ''}`;
    o += `\n纳音：${p2.nayin.year}`;
    o += `\n\n═══ 综合评分：${s.total}分 · ${r.grade} ═══`;
    o += `\n${r.gradeDesc}`;
    o += `\n\n【日干配合·${s.dayMaster.score}分】${s.dayMaster.desc}`;
    o += `\n【地支配合·${s.dizhi.score}分】\n${s.dizhi.details.join('\n')}`;
    o += `\n【五行互补·${s.wuxing.score}分】\n${s.wuxing.details.join('\n')}`;
    o += `\n【纳音配合·${s.nayin.score}分】${s.nayin.desc}`;
    o += `\n【大运同步·${s.dayun.score}分】${s.dayun.desc}`;
    o += `\n\n【性格互动】`;
    o += `\n甲方：${p1.personality.type} — ${p1.personality.simple}`;
    o += `\n乙方：${p2.personality.type} — ${p2.personality.simple}`;
    return o;
  }
  // simple
  let o = `你们的合婚结果：`;
  o += `\n\n💑 综合评分：${s.total}分（${r.grade}）`;
  o += `\n${r.gradeDesc}`;
  o += `\n\n你：${p1.dayMaster}${p1.dayMasterElement}（${p1.personality.type}）`;
  o += `\n对方：${p2.dayMaster}${p2.dayMasterElement}（${p2.personality.type}）`;
  o += `\n\n${s.dayMaster.desc}`;
  o += `\n${s.dizhi.details[0] || ''}`;
  o += `\n${s.wuxing.details[0] || ''}`;
  o += `\n${s.nayin.desc}`;
  return o;
}

module.exports = { calculate, formatForAI };
