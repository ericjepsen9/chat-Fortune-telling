const MAJOR=[{id:0,zh:'愚者',en:'The Fool',up:['新开始','冒险','自由'],dn:['鲁莽','迷失','不成熟']},{id:1,zh:'魔术师',en:'The Magician',up:['创造力','意志力','掌控'],dn:['操纵','欺骗','能力不足']},{id:2,zh:'女祭司',en:'High Priestess',up:['直觉','潜意识','内在智慧'],dn:['隐秘','脱离现实','表面化']},{id:3,zh:'女皇',en:'The Empress',up:['丰盛','母性','滋养'],dn:['依赖','过度保护','匮乏']},{id:4,zh:'皇帝',en:'The Emperor',up:['权威','秩序','稳定'],dn:['专制','僵化','控制欲']},{id:5,zh:'教皇',en:'Hierophant',up:['传统','信仰','精神指引'],dn:['教条','顺从','限制']},{id:6,zh:'恋人',en:'The Lovers',up:['爱情','选择','和谐'],dn:['犹豫','价值冲突','关系不平衡']},{id:7,zh:'战车',en:'The Chariot',up:['决心','胜利','意志'],dn:['失控','缺乏方向','攻击性']},{id:8,zh:'力量',en:'Strength',up:['勇气','耐心','内在力量'],dn:['自我怀疑','脆弱','缺乏信心']},{id:9,zh:'隐者',en:'The Hermit',up:['独处','内省','智慧'],dn:['孤立','逃避','固执己见']},{id:10,zh:'命运之轮',en:'Wheel of Fortune',up:['转折','机遇','命运'],dn:['厄运','阻碍','失控']},{id:11,zh:'正义',en:'Justice',up:['公平','真相','因果'],dn:['不公','偏见','逃避责任']},{id:12,zh:'倒吊人',en:'Hanged Man',up:['放手','新视角','等待'],dn:['拖延','抗拒','无谓牺牲']},{id:13,zh:'死神',en:'Death',up:['转变','重生','放下旧的'],dn:['恐惧改变','停滞','依恋过去']},{id:14,zh:'节制',en:'Temperance',up:['平衡','耐心','调和'],dn:['失衡','过度','急躁']},{id:15,zh:'恶魔',en:'The Devil',up:['面对阴影','束缚觉察','欲望'],dn:['沉迷','控制','自我毁灭']},{id:16,zh:'塔',en:'The Tower',up:['觉醒','打破旧有','解放'],dn:['灾难','混乱','逃避']},{id:17,zh:'星星',en:'The Star',up:['希望','灵感','宁静'],dn:['失望','缺乏信念','脱离']},{id:18,zh:'月亮',en:'The Moon',up:['直觉','潜意识','幻想'],dn:['恐惧','欺骗','混乱']},{id:19,zh:'太阳',en:'The Sun',up:['快乐','成功','活力'],dn:['自负','短暂快乐','过度乐观']},{id:20,zh:'审判',en:'Judgement',up:['觉醒','反思','重生'],dn:['自我批判','后悔','拒绝成长']},{id:21,zh:'世界',en:'The World',up:['圆满','完成','成就'],dn:['未完成','缺乏收尾','停滞']}];
const SUITS=[{id:'wands',zh:'权杖',en:'Wands',theme:'行动·激情'},{id:'cups',zh:'圣杯',en:'Cups',theme:'情感·关系'},{id:'swords',zh:'宝剑',en:'Swords',theme:'思维·冲突'},{id:'pentacles',zh:'星币',en:'Pentacles',theme:'物质·金钱'}];
const COURT=[{r:'page',zh:'侍从',en:'Page'},{r:'knight',zh:'骑士',en:'Knight'},{r:'queen',zh:'王后',en:'Queen'},{r:'king',zh:'国王',en:'King'}];
const MINOR_KW={1:{up:['潜力','新机会','种子'],dn:['错失','延迟','空想']},2:{up:['选择','平衡','合作'],dn:['犹豫','失衡','拖延']},3:{up:['成长','创造','初步成果'],dn:['过度扩张','缺乏规划','散漫']},4:{up:['稳定','休息','基础'],dn:['停滞','倦怠','过度保守']},5:{up:['挑战','竞争','冲突'],dn:['逃避、内耗','恶性竞争']},6:{up:['和谐','给予','分享'],dn:['不平等','自私','旧模式']},7:{up:['反思','评估','耐心'],dn:['焦虑','拖延','缺乏信心']},8:{up:['行动','速度','变化'],dn:['仓促','阻碍','方向不明']},9:{up:['接近目标','智慧','丰收'],dn:['孤独','缺乏信任','未竟之志']},10:{up:['圆满','完成','结局'],dn:['负担','结束的抗拒','过度责任']}};
const COURT_KW={page:{up:['学习者','好奇','新消息'],dn:['幼稚','缺乏经验','犹豫']},knight:{up:['行动','追求','热情'],dn:['冲动','不稳定','过度激进']},queen:{up:['成熟','滋养','掌控'],dn:['情绪化','控制欲','自我封闭']},king:{up:['权威','成就','掌控全局'],dn:['专横','僵化','压力过大']}};
function buildDeck(){const d=MAJOR.map(c=>({...c,type:'major'}));let id=22;SUITS.forEach(s=>{for(let n=1;n<=10;n++)d.push({id:id++,zh:`${s.zh}${n===1?'王牌':n}`,en:`${n===1?'Ace':n} of ${s.en}`,type:'minor',suit:s.id,num:n,up:MINOR_KW[n].up,dn:MINOR_KW[n].dn});COURT.forEach(c=>d.push({id:id++,zh:`${s.zh}${c.zh}`,en:`${c.en} of ${s.en}`,type:'court',suit:s.id,rank:c.r,up:COURT_KW[c.r].up,dn:COURT_KW[c.r].dn}));});return d;}
const DECK=buildDeck();
const SPREADS={single:{zh:'单张指引',pos:[{zh:'指引',en:'Guidance'}]},threeCard:{zh:'三张牌阵',pos:[{zh:'过去',en:'Past'},{zh:'现在',en:'Present'},{zh:'未来',en:'Future'}]},relationship:{zh:'关系牌阵',pos:[{zh:'你',en:'You'},{zh:'对方',en:'Other'},{zh:'关系',en:'Relationship'},{zh:'建议',en:'Advice'}]},celticCross:{zh:'凯尔特十字',pos:[{zh:'现状',en:'Present'},{zh:'阻碍',en:'Challenge'},{zh:'潜意识',en:'Subconscious'},{zh:'过去',en:'Past'},{zh:'可能性',en:'Above'},{zh:'近未来',en:'Near Future'},{zh:'自我态度',en:'Self'},{zh:'外在环境',en:'Environment'},{zh:'希望与恐惧',en:'Hopes & Fears'},{zh:'最终结果',en:'Outcome'}]}};

// 确定性伪随机：同seed永远相同结果
function seededRng(seed){let s=typeof seed==='string'?hash(seed):seed;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};}
function hash(str){let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0;}return Math.abs(h);}

// seed策略：userId+日期 → 同一天同一用户结果不变
function stableSeed(userId, date) {
  const d = date || new Date();
  return `${userId}-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function drawCards(spreadType='threeCard', seed){
  const spread=SPREADS[spreadType]||SPREADS.threeCard;
  const deck=[...DECK];
  const rng=seededRng(seed||Date.now());
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  return{spread:{name:spread.zh,type:spreadType},cards:deck.slice(0,spread.pos.length).map((c,i)=>({...c,position:spread.pos[i],reversed:rng()>0.7})),seed:typeof seed==='string'?seed:'dynamic'};
}

function formatForAI(result, mode='simple') {
  const r=result;
  if(mode==='expert'){
    let o=`【塔罗牌阵：${r.spread.name}】\n`;
    r.cards.forEach(c=>{
      const rev=c.reversed;
      const suitInfo=c.suit?SUITS.find(s=>s.id===c.suit):null;
      o+=`\n${c.position.zh}位 — ${c.zh}（${c.en}）${rev?'【逆位】':'【正位】'}`;
      o+=`\n  ${rev?'逆位含义：'+(c.dn||[]).join('、'):'正位含义：'+(c.up||[]).join('、')}`;
      o+=`\n  牌型：${c.type==='major'?'大阿尔卡那':suitInfo?suitInfo.zh+'（'+suitInfo.theme+'）':''}`;
    });
    o+=`\n\n【整体能量】大阿尔卡那${r.cards.filter(c=>c.type==='major').length}张，逆位${r.cards.filter(c=>c.reversed).length}张`;
    if(r.seed) o+=`\n【牌阵ID】${r.seed}`;
    return o;
  }
  let o=`你的塔罗牌阵（${r.spread.name}）：\n`;
  r.cards.forEach(c=>{
    const rev=c.reversed;
    o+=`\n${c.position.zh}：${c.zh} ${rev?'（逆位·需要注意）':'（正位·积极信号）'}`;
    if(c.up) o+=`\n  关键词：${(rev?(c.dn||[]):(c.up||[])).slice(0,2).join('、')}`;
  });
  return o;
}

/**
 * 用户手动选牌：接收选中的卡牌ID数组
 * selectedCards: [{cardId: 5, reversed: false}, {cardId: 22, reversed: true}, ...]
 */
function drawFromSelection(selectedCards, spreadType='threeCard') {
  const spread = SPREADS[spreadType] || SPREADS.threeCard;
  const cards = selectedCards.slice(0, spread.pos.length).map((sel, i) => {
    const card = DECK.find(c => c.id === sel.cardId) || DECK[sel.cardId] || DECK[0];
    return {
      ...card,
      position: spread.pos[i],
      reversed: !!sel.reversed,
    };
  });
  return { spread: { name: spread.zh, type: spreadType }, cards, seed: 'user-selected' };
}

module.exports={drawCards,drawFromSelection,formatForAI,stableSeed,DECK,SPREADS};
