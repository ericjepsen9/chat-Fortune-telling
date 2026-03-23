/**
 * 八字命理引擎 v3 — 基于 lunar-javascript 精确计算
 * 节气定月 · 精确日柱 · 大运计算
 */
const { Solar } = require('lunar-javascript');

const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const WX_MAP = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const DZ_WX = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
const YY_MAP = { 甲:'阳',乙:'阴',丙:'阳',丁:'阴',戊:'阳',己:'阴',庚:'阳',辛:'阴',壬:'阳',癸:'阴' };

const SS_TABLE = {
  甲:{甲:'比肩',乙:'劫财',丙:'食神',丁:'伤官',戊:'偏财',己:'正财',庚:'七杀',辛:'正官',壬:'偏印',癸:'正印'},
  乙:{甲:'劫财',乙:'比肩',丙:'伤官',丁:'食神',戊:'正财',己:'偏财',庚:'正官',辛:'七杀',壬:'正印',癸:'偏印'},
  丙:{甲:'偏印',乙:'正印',丙:'比肩',丁:'劫财',戊:'食神',己:'伤官',庚:'偏财',辛:'正财',壬:'七杀',癸:'正官'},
  丁:{甲:'正印',乙:'偏印',丙:'劫财',丁:'比肩',戊:'伤官',己:'食神',庚:'正财',辛:'偏财',壬:'正官',癸:'七杀'},
  戊:{甲:'七杀',乙:'正官',丙:'偏印',丁:'正印',戊:'比肩',己:'劫财',庚:'食神',辛:'伤官',壬:'偏财',癸:'正财'},
  己:{甲:'正官',乙:'七杀',丙:'正印',丁:'偏印',戊:'劫财',己:'比肩',庚:'伤官',辛:'食神',壬:'正财',癸:'偏财'},
  庚:{甲:'偏财',乙:'正财',丙:'七杀',丁:'正官',戊:'偏印',己:'正印',庚:'比肩',辛:'劫财',壬:'食神',癸:'伤官'},
  辛:{甲:'正财',乙:'偏财',丙:'正官',丁:'七杀',戊:'正印',己:'偏印',庚:'劫财',辛:'比肩',壬:'伤官',癸:'食神'},
  壬:{甲:'食神',乙:'伤官',丙:'偏财',丁:'正财',戊:'七杀',己:'正官',庚:'偏印',辛:'正印',壬:'比肩',癸:'劫财'},
  癸:{甲:'伤官',乙:'食神',丙:'正财',丁:'偏财',戊:'正官',己:'七杀',庚:'正印',辛:'偏印',壬:'劫财',癸:'比肩'},
};

const DM_PERSONA = {
  甲: { type: '参天大树', traits: ['正直担当','有领导力','有责任心','较固执'], simple: '你像一棵参天大树，正直有担当，天生的领导者' },
  乙: { type: '花草藤蔓', traits: ['柔韧灵活','善于适应','温和细腻','有韧性'], simple: '你像藤蔓花草，柔中带韧，善于在任何环境中生长' },
  丙: { type: '太阳光芒', traits: ['热情大方','光明磊落','有感染力','略冲动'], simple: '你像太阳一样热情大方，走到哪里都能照亮别人' },
  丁: { type: '烛火星光', traits: ['细腻温暖','内敛深思','专注执着','有洞察力'], simple: '你像烛火般温暖而专注，虽不张扬却能照亮重要的角落' },
  戊: { type: '高山大地', traits: ['稳重厚实','诚信可靠','包容力强','行动偏慢'], simple: '你像大地一样稳重可靠，是朋友心中最踏实的存在' },
  己: { type: '田园沃土', traits: ['务实细致','善于规划','低调内敛','心思缜密'], simple: '你像沃土一样默默滋养周围的人，务实且有规划感' },
  庚: { type: '刀剑利器', traits: ['果断刚毅','正义感强','有魄力','较强势'], simple: '你像利剑一样果断刚毅，做事不拖泥带水' },
  辛: { type: '珠宝美玉', traits: ['敏锐精致','审美力强','追求完美','情感细腻'], simple: '你像美玉一样精致敏锐，对美有独特的感知力' },
  壬: { type: '江河大海', traits: ['聪明机敏','思维活跃','适应力强','胸怀宽广'], simple: '你像大海一样包容，思维活跃，充满智慧' },
  癸: { type: '雨露清泉', traits: ['感性细腻','直觉力强','善解人意','想象丰富'], simple: '你像清泉一样温润灵动，有着敏锐的直觉和丰富的情感世界' },
};

const CHONG = { 子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳' };
const LIUHE = { 子:'丑',丑:'子',寅:'亥',卯:'戌',辰:'酉',巳:'申',午:'未',未:'午',申:'巳',酉:'辰',戌:'卯',亥:'寅' };
const SANHE = { 申子辰:'水', 寅午戌:'火', 亥卯未:'木', 巳酉丑:'金' };

function calculate(input) {
  const { year, month, day, hour, gender } = input;
  const h = parseInt(hour) || 0;
  const solar = Solar.fromYmdHms(parseInt(year), parseInt(month), parseInt(day), h, 0, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const yGZ = ec.getYear(), mGZ = ec.getMonth(), dGZ = ec.getDay(), tGZ = ec.getTime();
  const dm = dGZ[0], dmWx = WX_MAP[dm];
  const nayin = { year: ec.getYearNaYin(), month: ec.getMonthNaYin(), day: ec.getDayNaYin(), hour: ec.getTimeNaYin() };
  const stages = { year: ec.getYearDiShi(), month: ec.getMonthDiShi(), day: ec.getDayDiShi(), hour: ec.getTimeDiShi() };
  const shishen = { yearTg: SS_TABLE[dm][yGZ[0]], monthTg: SS_TABLE[dm][mGZ[0]], dayTg: '日主', hourTg: SS_TABLE[dm][tGZ[0]] };

  const mapCG = arr => arr.map(g => ({ gan: g, ss: SS_TABLE[dm][g], wx: WX_MAP[g] }));
  const cangganShishen = { year: mapCG(ec.getYearHideGan()), month: mapCG(ec.getMonthHideGan()), day: mapCG(ec.getDayHideGan()), hour: mapCG(ec.getTimeHideGan()) };

  // 五行统计（天干+地支加权藏干）
  const wuxing = { 金:0, 木:0, 水:0, 火:0, 土:0 };
  // 天干各1.0
  [yGZ[0], mGZ[0], dGZ[0], tGZ[0]].forEach(g => { if (WX_MAP[g]) wuxing[WX_MAP[g]] += 1.0; });
  // 地支藏干加权：本气1.0，中气0.5，余气0.3
  const weights = [1.0, 0.5, 0.3];
  [ec.getYearHideGan(), ec.getMonthHideGan(), ec.getDayHideGan(), ec.getTimeHideGan()].forEach(cg => {
    cg.forEach((g, i) => { if (WX_MAP[g]) wuxing[WX_MAP[g]] += (weights[i] || 0.3); });
  });
  // Round for display
  Object.keys(wuxing).forEach(k => { wuxing[k] = Math.round(wuxing[k] * 10) / 10; });
  const wuxingLack = Object.entries(wuxing).filter(([,v]) => v === 0).map(([k]) => k);

  // 身强身弱（月令+得助+得生）
  const monthDzWx = DZ_WX[mGZ[1]];
  const SHENG_MAP = { 金:'土', 水:'金', 木:'水', 火:'木', 土:'火' }; // 生日主的五行
  const monthHelp = (monthDzWx === dmWx) ? 2 : (SHENG_MAP[dmWx] === monthDzWx) ? 1.5 : 0; // 月令得令
  const sameCount = wuxing[dmWx] || 0; // 比劫力量
  const yinCount = wuxing[SHENG_MAP[dmWx]] || 0; // 印星力量
  const totalHelp = sameCount + yinCount * 0.7 + monthHelp;
  const totalAll = Object.values(wuxing).reduce((a,b) => a+b, 0);
  const helpRatio = totalHelp / totalAll;
  const dayStrength = helpRatio >= 0.45 ? '身强' : helpRatio <= 0.3 ? '身弱' : '中和';

  // 格局判定（正统：看月支藏干透出天干的十神）
  const monthCG = ec.getMonthHideGan();
  const otherTg = [yGZ[0], tGZ[0]]; // 年干和时干（排除日主）
  let geju = '';
  // 优先看月支藏干哪个透出到年干或时干
  for (const g of monthCG) {
    if (g === dm) continue; // 跳过与日主相同的
    if (otherTg.includes(g)) {
      const ss = SS_TABLE[dm][g];
      // 比肩劫财不成格
      if (ss !== '比肩' && ss !== '劫财') { geju = ss + '格'; break; }
    }
  }
  // 没有透出，取月支本气十神（第一个藏干）
  if (!geju && monthCG.length > 0) {
    const ss = SS_TABLE[dm][monthCG[0]];
    if (ss !== '比肩' && ss !== '劫财') geju = ss + '格';
    else if (monthCG.length > 1) {
      const ss2 = SS_TABLE[dm][monthCG[1]];
      if (ss2 !== '比肩' && ss2 !== '劫财') geju = ss2 + '格';
    }
  }
  if (!geju) geju = '建禄格'; // 月令为比肩时

  const SHENG = { 金:'水', 水:'木', 木:'火', 火:'土', 土:'金' };
  const KE_SHENG = { 金:'土', 水:'金', 木:'水', 火:'木', 土:'火' };
  let xiyong, jishen;
  if (dayStrength === '身强') { xiyong = `${SHENG[dmWx]}、${SHENG[SHENG[dmWx]]}`; jishen = `${dmWx}、${KE_SHENG[dmWx]}`; }
  else { xiyong = `${dmWx}、${KE_SHENG[dmWx]}`; jishen = `${SHENG[dmWx]}、${SHENG[SHENG[dmWx]]}`; }

  // 神煞
  const shensha = [];
  const dzArr4 = [yGZ[1], mGZ[1], dGZ[1], tGZ[1]];
  const taohua = { 寅:'卯',午:'卯',戌:'卯', 亥:'子',卯:'子',未:'子', 申:'酉',子:'酉',辰:'酉', 巳:'午',酉:'午',丑:'午' };
  const th = taohua[dGZ[1]];
  if (th && dzArr4.some((z,i) => i !== 2 && z === th)) shensha.push({ name: '桃花', pos: dzArr4.indexOf(th) < 2 ? ['年支','月支'][dzArr4.indexOf(th)] : '时支', desc: '人缘好、异性缘旺' });

  const tiyi = { 甲:['丑','未'], 乙:['子','申'], 丙:['亥','酉'], 丁:['亥','酉'], 戊:['丑','未'], 己:['子','申'], 庚:['丑','未'], 辛:['寅','午'], 壬:['卯','巳'], 癸:['卯','巳'] };
  if (tiyi[dm]) dzArr4.forEach((z,i) => { if (i!==2 && tiyi[dm].includes(z)) shensha.push({ name: '天乙贵人', pos: ['年支','月支','日支','时支'][i], desc: '逢凶化吉、贵人相助' }); });

  const wenchang = { 甲:'巳',乙:'午',丙:'申',丁:'酉',戊:'申',己:'酉',庚:'亥',辛:'子',壬:'寅',癸:'卯' };
  if (dzArr4.includes(wenchang[dm])) shensha.push({ name: '文昌', pos: '命中', desc: '聪慧好学、文采出众' });

  const yima = { 寅:'申',申:'寅',巳:'亥',亥:'巳',子:'寅',午:'申',卯:'巳',酉:'亥',辰:'寅',戌:'申',丑:'亥',未:'巳' };
  if (dzArr4.some((z,i) => i!==2 && z===yima[dGZ[1]])) shensha.push({ name: '驿马', pos: '命中', desc: '利于远行、奔波变动' });

  // 地支关系
  const dzLabeled = [{z:yGZ[1],l:'年'},{z:mGZ[1],l:'月'},{z:dGZ[1],l:'日'},{z:tGZ[1],l:'时'}];
  const dizhiRelations = [];
  for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) {
    if (CHONG[dzLabeled[i].z]===dzLabeled[j].z) dizhiRelations.push({ type:'六冲', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:'冲动变化' });
    if (LIUHE[dzLabeled[i].z]===dzLabeled[j].z) dizhiRelations.push({ type:'六合', pair:`${dzLabeled[i].l}${dzLabeled[i].z}${dzLabeled[j].l}${dzLabeled[j].z}`, desc:'和合顺利' });
  }
  for (const [trio, el] of Object.entries(SANHE)) {
    const found = trio.split('').filter(c => dzArr4.includes(c));
    if (found.length >= 2) dizhiRelations.push({ type: found.length===3?'三合局':'半合', pair:found.join(''), desc:`合化${el}局` });
  }

  // 流年
  const nowYear = new Date().getFullYear();
  const lnEc = Solar.fromYmdHms(nowYear, 6, 15, 12, 0, 0).getLunar().getEightChar();
  const lnGZ = lnEc.getYear(), lnTg = lnGZ[0], lnDz = lnGZ[1];
  const lnSS = SS_TABLE[dm][lnTg], lnTgWx = WX_MAP[lnTg];
  const lnDzRels = [];
  dzLabeled.forEach(({z,l}) => {
    if (CHONG[lnDz]===z) lnDzRels.push({ type:'六冲', target:`${l}支${z}`, desc:'冲动变化' });
    if (LIUHE[lnDz]===z) lnDzRels.push({ type:'六合', target:`${l}支${z}`, desc:'和合顺利' });
  });

  // 大运
  const gNum = (gender==='female'||gender==='f') ? 0 : 1;
  const yun = ec.getYun(gNum);
  const dayuns = yun.getDaYun().filter(d => d.getGanZhi()).map(d => ({ gz:d.getGanZhi(), startAge:d.getStartAge(), startYear:d.getStartYear(), endYear:d.getStartYear()+10 }));
  const currentDayun = dayuns.find(d => nowYear>=d.startYear && nowYear<d.endYear) || dayuns[0];

  return {
    fourPillars: { year:yGZ, month:mGZ, day:dGZ, hour:tGZ },
    dayMaster:dm, dayMasterElement:dmWx, yinyang:YY_MAP[dm], dayStrength, geju, nayin, stages,
    wuxing, wuxingLack, xiyong, jishen, shishen, cangganShishen, shensha, dizhiRelations,
    liunian: { year:nowYear, ganzhi:lnGZ, nayin:lnEc.getYearNaYin(), tianganSS:lnSS, tianganWx:lnTgWx, dizhiWx:DZ_WX[lnDz], dizhiRels:lnDzRels,
      isXiyong:xiyong.includes(lnTgWx), isJishen:jishen.includes(lnTgWx),
      summary: xiyong.includes(lnTgWx)?'流年天干为喜用，整体有利':jishen.includes(lnTgWx)?'流年天干为忌神，需谨慎':'流年天干影响中性' },
    dayun: { list:dayuns, current:currentDayun, startInfo:`${yun.getStartYear()}年${yun.getStartMonth()}月起运` },
    personality: DM_PERSONA[dm]||DM_PERSONA['甲'],
    gender: gender||'male',
    _source: 'lunar-javascript',
  };
}

function formatForAI(result, mode='simple') {
  const r=result, fp=r.fourPillars;
  if (mode==='expert') {
    let o=`【四柱排盘】`;
    o+=`\n年柱：${fp.year}（${r.nayin.year}） ${r.shishen.yearTg}  ${r.stages.year}`;
    o+=`\n月柱：${fp.month}（${r.nayin.month}） ${r.shishen.monthTg}  ${r.stages.month}`;
    o+=`\n日柱：${fp.day}（${r.nayin.day}） 日主  ${r.stages.day}`;
    o+=`\n时柱：${fp.hour}（${r.nayin.hour}） ${r.shishen.hourTg}  ${r.stages.hour}`;
    o+=`\n\n【日主】${r.dayMaster}${r.dayMasterElement}（${r.yinyang}${r.dayMasterElement}）·${r.dayStrength}`;
    o+=`\n格局：${r.geju}\n喜用：${r.xiyong}  忌：${r.jishen}`;
    o+=`\n\n【五行】${Object.entries(r.wuxing).map(([k,v])=>`${k}${v}`).join(' ')}`;
    if (r.wuxingLack.length) o+=`  缺${r.wuxingLack.join('、')}`;
    if (r.shensha.length) { o+=`\n\n【神煞】`; r.shensha.forEach(s=>{o+=`\n${s.pos}·${s.name}：${s.desc}`;}); }
    if (r.dizhiRelations.length) { o+=`\n\n【地支关系】`; r.dizhiRelations.forEach(d=>{o+=`\n${d.pair}（${d.type}）：${d.desc}`;}); }
    o+=`\n\n【藏干】`;
    ['year','month','day','hour'].forEach(p => {
      const label={year:'年支',month:'月支',day:'日支',hour:'时支'}[p];
      r.cangganShishen[p].forEach(c=>{o+=`\n${label}藏${c.gan}${c.wx}（${c.ss}）`;});
    });
    if (r.dayun&&r.dayun.current) {
      o+=`\n\n【大运】${r.dayun.startInfo}`;
      r.dayun.list.forEach(d=>{o+=`\n${d.startAge}岁 ${d.gz}（${d.startYear}-${d.endYear}）${d===r.dayun.current?' ← 当前':''}`;});
    }
    o+=`\n\n【${r.liunian.year}年流年：${r.liunian.ganzhi}（${r.liunian.nayin}）】`;
    o+=`\n流年天干${r.liunian.ganzhi[0]}${r.liunian.tianganWx}，对日主为${r.liunian.tianganSS}`;
    o+=`\n${r.liunian.summary}`;
    r.liunian.dizhiRels.forEach(d=>{o+=`\n流年${r.liunian.ganzhi[1]}与${d.target}${d.type}：${d.desc}`;});
    return o;
  }
  const p=r.personality;
  let o=`你的八字：${fp.year} ${fp.month} ${fp.day} ${fp.hour}`;
  o+=`\n日主：${r.dayMaster}${r.dayMasterElement} — ${p.type}`;
  o+=`\n${p.simple}`;
  o+=`\n\n性格关键词：${p.traits.join('、')}`;
  o+=`\n五行分布：${Object.entries(r.wuxing).map(([k,v])=>`${k}${v}`).join(' ')}`;
  if (r.wuxingLack.length) o+=`（缺${r.wuxingLack.join('、')}）`;
  o+=`\n整体状态：${r.dayStrength}`;
  if (r.shensha.length) { o+=`\n\n命中带有：`; r.shensha.forEach(s=>{o+=`\n· ${s.name} — ${s.desc}`;}); }
  if (r.dayun&&r.dayun.current) o+=`\n\n当前大运：${r.dayun.current.gz}（${r.dayun.current.startYear}-${r.dayun.current.endYear}）`;
  o+=`\n\n今年（${r.liunian.year}）流年${r.liunian.ganzhi}：${r.liunian.summary}`;
  return o;
}

module.exports = { calculate, formatForAI };
