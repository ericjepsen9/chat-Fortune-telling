/**
 * 八字命理引擎 v2 — 补全神煞/十二长生/地支关系/双模式输出
 */
const TIANGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WUXING_TG = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const WUXING_DZ = {子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};
const YINYANG = {甲:'阳',乙:'阴',丙:'阳',丁:'阴',戊:'阳',己:'阴',庚:'阳',辛:'阴',壬:'阳',癸:'阴'};
const CANGGAN = {子:['癸'],丑:['己','癸','辛'],寅:['甲','丙','戊'],卯:['乙'],辰:['戊','乙','癸'],巳:['丙','庚','戊'],午:['丁','己'],未:['己','丁','乙'],申:['庚','壬','戊'],酉:['辛'],戌:['戊','辛','丁'],亥:['壬','甲']};
const NAYIN_TABLE = ['海中金','海中金','炉中火','炉中火','大林木','大林木','路旁土','路旁土','剑锋金','剑锋金','山头火','山头火','涧下水','涧下水','城头土','城头土','白蜡金','白蜡金','杨柳木','杨柳木','泉中水','泉中水','屋上土','屋上土','霹雳火','霹雳火','松柏木','松柏木','长流水','长流水','砂石金','砂石金','山下火','山下火','平地木','平地木','壁上土','壁上土','金箔金','金箔金','覆灯火','覆灯火','天河水','天河水','大驿土','大驿土','钗钏金','钗钏金','桑柘木','桑柘木','大溪水','大溪水','沙中土','沙中土','天上火','天上火','石榴木','石榴木','大海水','大海水'];
const TWELVE = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
const CS_YANG = {甲:11,丙:2,戊:2,庚:5,壬:8};
const CS_YIN = {乙:6,丁:9,己:9,辛:0,癸:3};
const SHISHEN = {
  '甲':{甲:'比肩',乙:'劫财',丙:'食神',丁:'伤官',戊:'偏财',己:'正财',庚:'七杀',辛:'正官',壬:'偏印',癸:'正印'},
  '乙':{甲:'劫财',乙:'比肩',丙:'伤官',丁:'食神',戊:'正财',己:'偏财',庚:'正官',辛:'七杀',壬:'正印',癸:'偏印'},
  '丙':{甲:'偏印',乙:'正印',丙:'比肩',丁:'劫财',戊:'食神',己:'伤官',庚:'偏财',辛:'正财',壬:'七杀',癸:'正官'},
  '丁':{甲:'正印',乙:'偏印',丙:'劫财',丁:'比肩',戊:'伤官',己:'食神',庚:'正财',辛:'偏财',壬:'正官',癸:'七杀'},
  '戊':{甲:'七杀',乙:'正官',丙:'偏印',丁:'正印',戊:'比肩',己:'劫财',庚:'食神',辛:'伤官',壬:'偏财',癸:'正财'},
  '己':{甲:'正官',乙:'七杀',丙:'正印',丁:'偏印',戊:'劫财',己:'比肩',庚:'伤官',辛:'食神',壬:'正财',癸:'偏财'},
  '庚':{甲:'偏财',乙:'正财',丙:'七杀',丁:'正官',戊:'偏印',己:'正印',庚:'比肩',辛:'劫财',壬:'食神',癸:'伤官'},
  '辛':{甲:'正财',乙:'偏财',丙:'正官',丁:'七杀',戊:'正印',己:'偏印',庚:'劫财',辛:'比肩',壬:'伤官',癸:'食神'},
  '壬':{甲:'食神',乙:'伤官',丙:'偏财',丁:'正财',戊:'七杀',己:'正官',庚:'偏印',辛:'正印',壬:'比肩',癸:'劫财'},
  '癸':{甲:'伤官',乙:'食神',丙:'正财',丁:'偏财',戊:'正官',己:'七杀',庚:'正印',辛:'偏印',壬:'劫财',癸:'比肩'},
};
const LIUHE = {子:'丑',丑:'子',寅:'亥',卯:'戌',辰:'酉',巳:'申',午:'未',未:'午',申:'巳',酉:'辰',戌:'卯',亥:'寅'};
const LIUCHONG = {子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳'};
const SANHE = [{m:['申','子','辰'],r:'水局'},{m:['寅','午','戌'],r:'火局'},{m:['巳','酉','丑'],r:'金局'},{m:['亥','卯','未'],r:'木局'}];

function getStage(tg, dz) {
  const di = DIZHI.indexOf(dz);
  const isY = YINYANG[tg]==='阳';
  const s = isY ? CS_YANG[tg] : CS_YIN[tg];
  if (s===undefined) return '';
  const d = isY ? ((di-s)%12+12)%12 : ((s-di)%12+12)%12;
  return TWELVE[d];
}

function getShensha(dayTg, yearDz, allDz) {
  const sha = [];
  const pos = ['年','月','日','时'];
  const tianyi = {甲:['丑','未'],乙:['子','申'],丙:['亥','酉'],丁:['亥','酉'],戊:['丑','未'],己:['子','申'],庚:['丑','未'],辛:['寅','午'],壬:['卯','巳'],癸:['卯','巳']};
  const wenchang = {甲:'巳',乙:'午',丙:'申',丁:'酉',戊:'申',己:'酉',庚:'亥',辛:'子',壬:'寅',癸:'卯'};
  const yimaMap = {申:'寅',子:'寅',辰:'寅',寅:'申',午:'申',戌:'申',巳:'亥',酉:'亥',丑:'亥',亥:'巳',卯:'巳',未:'巳'};
  const taohua = {申:'酉',子:'酉',辰:'酉',寅:'卯',午:'卯',戌:'卯',巳:'午',酉:'午',丑:'午',亥:'子',卯:'子',未:'子'};
  const huagai = {申:'辰',子:'辰',辰:'辰',寅:'戌',午:'戌',戌:'戌',巳:'丑',酉:'丑',丑:'丑',亥:'未',卯:'未',未:'未'};
  allDz.forEach((dz,i) => {
    if (tianyi[dayTg]&&tianyi[dayTg].includes(dz)) sha.push({name:'天乙贵人',pos:pos[i],desc:'逢凶化吉、贵人相助'});
    if (wenchang[dayTg]===dz) sha.push({name:'文昌',pos:pos[i],desc:'聪明好学、利考试学业'});
    if (yimaMap[yearDz]===dz) sha.push({name:'驿马',pos:pos[i],desc:'主变动奔波、利出行'});
    if (taohua[yearDz]===dz) sha.push({name:'桃花',pos:pos[i],desc:'人缘好、异性缘旺'});
    if (huagai[yearDz]===dz) sha.push({name:'华盖',pos:pos[i],desc:'聪慧孤高、利艺术宗教'});
  });
  return sha;
}

function getDzRelations(allDz) {
  const rels = [], pos = ['年','月','日','时'];
  for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) {
    if (LIUHE[allDz[i]]===allDz[j]) rels.push({type:'六合',pair:`${pos[i]}${allDz[i]}${pos[j]}${allDz[j]}`,desc:'和合融洽'});
    if (LIUCHONG[allDz[i]]===allDz[j]) rels.push({type:'六冲',pair:`${pos[i]}${allDz[i]}${pos[j]}${allDz[j]}`,desc:'冲动变化'});
  }
  SANHE.forEach(s => { const f=s.m.filter(m=>allDz.includes(m)); if(f.length>=2) rels.push({type:f.length===3?'三合局':'半合',pair:f.join(''),desc:`合化${s.r}`}); });
  return rels;
}

function calculate(input) {
  const {year,month,day,hour,gender='male'} = input;
  const yp=getYearPillar(year), mp=getMonthPillar(yp.tg,month), dp=getDayPillar(year,month,day), hp=getHourPillar(dp.tg,hour);
  const allTg=[yp.tg,mp.tg,dp.tg,hp.tg], allDz=[yp.dz,mp.dz,dp.dz,hp.dz];
  const wuxing={金:0,木:0,水:0,火:0,土:0};
  allTg.forEach(t=>wuxing[WUXING_TG[t]]++); allDz.forEach(d=>wuxing[WUXING_DZ[d]]++);
  const shishen={yearTg:SHISHEN[dp.tg][yp.tg],monthTg:SHISHEN[dp.tg][mp.tg],dayTg:'日主',hourTg:SHISHEN[dp.tg][hp.tg]};
  const cgss={}; ['year','month','day','hour'].forEach((p,i)=>{cgss[p]=CANGGAN[allDz[i]].map(g=>({gan:g,ss:SHISHEN[dp.tg][g],wx:WUXING_TG[g]}));});
  const geju = SHISHEN[dp.tg][CANGGAN[mp.dz][0]]+'格';
  const getNy = (t,d) => { const idx=((TIANGAN.indexOf(t)*12+DIZHI.indexOf(d))%60+60)%60; return NAYIN_TABLE[idx]||''; };
  const nayin={year:getNy(yp.tg,yp.dz),month:getNy(mp.tg,mp.dz),day:getNy(dp.tg,dp.dz),hour:getNy(hp.tg,hp.dz)};
  const stages={year:getStage(dp.tg,yp.dz),month:getStage(dp.tg,mp.dz),day:getStage(dp.tg,dp.dz),hour:getStage(dp.tg,hp.dz)};
  const helpWx=[WUXING_TG[dp.tg]]; const SHENG={金:'土',木:'水',水:'金',火:'木',土:'火'}; helpWx.push(SHENG[WUXING_TG[dp.tg]]);
  let hc=0,dc=0; allTg.forEach(t=>{helpWx.includes(WUXING_TG[t])?hc++:dc++;}); allDz.forEach(d=>{helpWx.includes(WUXING_DZ[d])?hc++:dc++;});
  const dayStrength=hc>=dc?'身强':'身弱';
  const KE={金:'木',木:'土',水:'火',火:'金',土:'水'};
  const xiyong=dayStrength==='身强'?`${KE[WUXING_TG[dp.tg]]}、${SHENG[KE[WUXING_TG[dp.tg]]]||''}`:helpWx.join('、');
  const jishen=dayStrength==='身强'?helpWx.join('、'):KE[WUXING_TG[dp.tg]];
  const shensha=getShensha(dp.tg,yp.dz,allDz);
  const dzRels=getDzRelations(allDz);
  const wuxingLack=Object.entries(wuxing).filter(([_,v])=>v===0).map(([k])=>k);

  // ===== 流年计算（当前年份） =====
  const now = new Date();
  const curYear = now.getFullYear();
  const lnTg = TIANGAN[(curYear-4)%10];
  const lnDz = DIZHI[(curYear-4)%12];
  const lnGanZhi = lnTg + lnDz;
  const lnNayin = getNy(lnTg, lnDz);
  const lnSS = SHISHEN[dp.tg][lnTg]; // 流年天干对日主的十神
  const lnStage = getStage(dp.tg, lnDz); // 流年地支对日主的十二长生
  const lnWx = WUXING_TG[lnTg];
  const lnDzWx = WUXING_DZ[lnDz];
  // 流年地支与命局地支的关系
  const lnDzRels = [];
  const pos = ['年','月','日','时'];
  allDz.forEach((dz, i) => {
    if (LIUHE[lnDz] === dz) lnDzRels.push({type:'六合',target:`${pos[i]}支${dz}`,desc:'和合顺利'});
    if (LIUCHONG[lnDz] === dz) lnDzRels.push({type:'六冲',target:`${pos[i]}支${dz}`,desc:'冲动变化'});
  });
  // 流年对喜忌的判断
  const lnIsXi = xiyong.includes(lnWx);
  const lnIsJi = jishen.includes(lnWx);
  const liunian = {
    year: curYear,
    ganzhi: lnGanZhi,
    nayin: lnNayin,
    tianganSS: lnSS,
    tianganWx: lnWx,
    dizhiWx: lnDzWx,
    stage: lnStage,
    dizhiRels: lnDzRels,
    isXiyong: lnIsXi,
    isJishen: lnIsJi,
    summary: lnIsXi ? '流年天干为喜用，整体有利' : lnIsJi ? '流年天干为忌神，需谨慎应对' : '流年天干为闲神，影响中性',
  };

  const PERS={
    '甲':{type:'参天大树',traits:['正直刚毅','有领导力','追求成长','重情义'],simple:'你像一棵大树，正直有担当，天生的领导者'},
    '乙':{type:'花草藤蔓',traits:['温柔细腻','善于适应','有韧性','重人情'],simple:'你像春天的花草，柔韧且善于适应环境'},
    '丙':{type:'太阳之火',traits:['热情开朗','慷慨大方','光明磊落','有感染力'],simple:'你像太阳一样温暖，走到哪里都能照亮身边的人'},
    '丁':{type:'烛光灯火',traits:['内敛温暖','洞察力强','善于思考','执着专注'],simple:'你像烛光，虽不张扬但温暖而有穿透力'},
    '戊':{type:'高山大地',traits:['稳重厚实','包容力强','守信可靠','大器晚成'],simple:'你像一座山，沉稳可靠，给人满满的安全感'},
    '己':{type:'田园沃土',traits:['细心周到','善于积累','务实低调','内心丰富'],simple:'你像肥沃的土壤，默默滋养身边的人'},
    '庚':{type:'刀剑锐金',traits:['果断刚强','重义气','有魄力','追求公正'],simple:'你像一把利剑，果断有魄力，天生的行动派'},
    '辛':{type:'珠玉宝石',traits:['敏锐细腻','审美力强','追求完美','独立自主'],simple:'你像一颗宝石，外表精致，内心有着敏锐的洞察力'},
    '壬':{type:'江河大海',traits:['聪明机敏','思维活跃','适应力强','胸怀宽广'],simple:'你像大海一样包容，思维活跃，充满智慧'},
    '癸':{type:'雨露溪流',traits:['直觉敏锐','善解人意','内心柔软','想象力丰富'],simple:'你像清晨的露水，敏感细腻，富有想象力'},
  };
  return {fourPillars:{year:yp.tg+yp.dz,month:mp.tg+mp.dz,day:dp.tg+dp.dz,hour:hp.tg+hp.dz},dayMaster:dp.tg,dayMasterElement:WUXING_TG[dp.tg],yinyang:YINYANG[dp.tg],dayStrength,geju,nayin,wuxing,wuxingLack,xiyong,jishen,shishen,cangganShishen:cgss,stages,shensha,dizhiRelations:dzRels,liunian,personality:PERS[dp.tg]||{type:'未知',traits:[],simple:''},gender};
}
function getYearPillar(y){return{tg:TIANGAN[(y-4)%10],dz:DIZHI[(y-4)%12]};}
function getMonthPillar(yt,m){const s={甲:2,己:2,乙:4,庚:4,丙:6,辛:6,丁:8,壬:8,戊:0,癸:0};return{tg:TIANGAN[(s[yt]+m-1)%10],dz:DIZHI[(m+1)%12]};}
function getDayPillar(y,m,d){const base=new Date(2000,0,7),tgt=new Date(y,m-1,d),diff=Math.round((tgt-base)/864e5),idx=((diff%60)+60)%60;return{tg:TIANGAN[idx%10],dz:DIZHI[idx%12]};}
function getHourPillar(dt,h){const di=h===23?0:Math.floor(((h+1)%24)/2),s={甲:0,己:0,乙:2,庚:2,丙:4,辛:4,丁:6,壬:6,戊:8,癸:8};return{tg:TIANGAN[(s[dt]+di)%10],dz:DIZHI[di]};}

function formatForAI(result, mode='simple') {
  const r = result;
  const ln = r.liunian;
  if (mode === 'expert') {
    let o=`【四柱排盘】\n年柱：${r.fourPillars.year}（${r.nayin.year}） ${r.shishen.yearTg}  ${r.stages.year}\n月柱：${r.fourPillars.month}（${r.nayin.month}） ${r.shishen.monthTg}  ${r.stages.month}\n日柱：${r.fourPillars.day}（${r.nayin.day}） 日主  ${r.stages.day}\n时柱：${r.fourPillars.hour}（${r.nayin.hour}） ${r.shishen.hourTg}  ${r.stages.hour}`;
    o+=`\n\n【日主】${r.dayMaster}${r.dayMasterElement}（${r.yinyang}${r.dayMasterElement}）·${r.dayStrength}\n格局：${r.geju}\n喜用：${r.xiyong}  忌：${r.jishen}`;
    o+=`\n\n【五行】金${r.wuxing.金} 木${r.wuxing.木} 水${r.wuxing.水} 火${r.wuxing.火} 土${r.wuxing.土}`;
    if(r.wuxingLack.length) o+=`  缺${r.wuxingLack.join('')}`;
    if(r.shensha.length){o+=`\n\n【神煞】`;r.shensha.forEach(s=>{o+=`\n${s.pos}支·${s.name}：${s.desc}`;});}
    if(r.dizhiRelations.length){o+=`\n\n【地支关系】`;r.dizhiRelations.forEach(s=>{o+=`\n${s.pair}（${s.type}）：${s.desc}`;});}
    o+=`\n\n【藏干】`;['year','month','hour'].forEach(p=>{const l={year:'年',month:'月',hour:'时'}[p];r.cangganShishen[p].forEach(c=>{o+=`\n${l}支藏${c.gan}${c.wx}（${c.ss}）`;});});
    // 流年
    if(ln){
      o+=`\n\n【${ln.year}年流年：${ln.ganzhi}（${ln.nayin}）】`;
      o+=`\n流年天干${ln.ganzhi[0]}${ln.tianganWx}，对日主为${ln.tianganSS}`;
      o+=`\n流年地支${ln.ganzhi[1]}${ln.dizhiWx}，日主临${ln.stage}`;
      o+=`\n流年天干五行属${ln.tianganWx}，${ln.isXiyong?'为喜用神→有利':ln.isJishen?'为忌神→需谨慎':'为闲神→影响中性'}`;
      if(ln.dizhiRels.length){ln.dizhiRels.forEach(rel=>{o+=`\n流年${ln.ganzhi[1]}与${rel.target}${rel.type}：${rel.desc}`;});}
    }
    return o;
  }
  // simple mode
  const p=r.personality;
  let o=`你的命理核心：${r.yinyang}${r.dayMasterElement} · ${p.type}\n${p.simple}\n\n性格关键词：${p.traits.join('、')}\n命格：${r.geju}（${r.dayStrength}）\n\n五行能量：金${r.wuxing.金} 木${r.wuxing.木} 水${r.wuxing.水} 火${r.wuxing.火} 土${r.wuxing.土}`;
  if(r.wuxingLack.length) o+=`\n缺「${r.wuxingLack.join('、')}」，可多接触相关元素`;
  o+=`\n适合方向：喜${r.xiyong}属性的环境`;
  if(r.shensha.length){o+=`\n\n你的特殊能量：`;r.shensha.forEach(s=>{o+=`\n· ${s.name} — ${s.desc}`;});}
  if(r.dizhiRelations.length){o+=`\n\n命局互动：`;r.dizhiRelations.forEach(s=>{o+=`\n· ${s.type} — ${s.desc}`;});}
  // 流年白话
  if(ln){
    o+=`\n\n今年（${ln.year}年·${ln.ganzhi}年）对你的影响：`;
    o+=`\n${ln.summary}`;
    if(ln.dizhiRels.length){ln.dizhiRels.forEach(rel=>{
      if(rel.type==='六合') o+=`\n· 今年与你有合的能量，贵人运好`;
      if(rel.type==='六冲') o+=`\n· 今年有冲的能量，注意变动和调整`;
    });}
    o+=`\n今年的能量关键词：${ln.tianganSS}（${ln.tianganWx}${ln.dizhiWx}）`;
  }
  return o;
}

module.exports = { calculate, formatForAI, TIANGAN, DIZHI, WUXING_TG };
