const TRI=[{id:1,n:'乾',s:'☰',na:'天',el:'金',tr:'刚健'},{id:2,n:'兑',s:'☱',na:'泽',el:'金',tr:'喜悦'},{id:3,n:'离',s:'☲',na:'火',el:'火',tr:'光明'},{id:4,n:'震',s:'☳',na:'雷',el:'木',tr:'运动'},{id:5,n:'巽',s:'☴',na:'风',el:'木',tr:'进入'},{id:6,n:'坎',s:'☵',na:'水',el:'水',tr:'陷险'},{id:7,n:'艮',s:'☶',na:'山',el:'土',tr:'静止'},{id:8,n:'坤',s:'☷',na:'地',el:'土',tr:'顺承'}];
const HEX_NAMES=[['乾为天','天泽履','天火同人','天雷无妄','天风姤','天水讼','天山遁','天地否'],['泽天夬','兑为泽','泽火革','泽雷随','泽风大过','泽水困','泽山咸','泽地萃'],['火天大有','火泽睽','离为火','火雷噬嗑','火风鼎','火水未济','火山旅','火地晋'],['雷天大壮','雷泽归妹','雷火丰','震为雷','雷风恒','雷水解','雷山小过','雷地豫'],['风天小畜','风泽中孚','风火家人','风雷益','巽为风','风水涣','风山渐','风地观'],['水天需','水泽节','水火既济','水雷屯','水风井','坎为水','水山蹇','水地比'],['山天大畜','山泽损','山火贲','山雷颐','山风蛊','山水蒙','艮为山','山地剥'],['地天泰','地泽临','地火明夷','地雷复','地风升','地水师','地山谦','坤为地']];
// 64卦卦辞精要
const GUA_CI = {
'乾为天':'元亨利贞。龙行天下，刚健不息。大利进取。','天泽履':'如履虎尾，不咥人。小心行事则安。','天火同人':'同人于野，利涉大川。合作共事吉。',
'天雷无妄':'无妄之灾，不可妄行。顺天而行。','天风姤':'女壮，勿用取女。偶遇之象，慎选。','天水讼':'有孚窒惕。争讼之象，宜和解。',
'天山遁':'退隐之时，小利贞。宜退不宜进。','天地否':'否之匪人。闭塞之时，静待转机。','泽天夬':'扬于王庭。决断之时，正道而行。',
'兑为泽':'亨利贞。喜悦之象，利于交流。','泽火革':'巳日乃孚。变革之时，时机成熟可变。','泽雷随':'元亨利贞。随时而动，顺势而为。',
'泽风大过':'栋桡。任重压大，宜有所行动。','泽水困':'亨贞，大人吉。困中求通，不失正道。','泽山咸':'亨利贞。感应之象，利于感情。',
'泽地萃':'亨，利见大人。聚集之象，利于团聚。','火天大有':'元亨。大有所获，光明正大。','火泽睽':'小事吉。不合之象，小事可成。',
'离为火':'利贞亨。光明之象，利于文化事业。','火雷噬嗑':'亨利用狱。明察秋毫，利于解决问题。','火风鼎':'元吉亨。革新之象，事业转型吉。',
'火水未济':'小狐汔济。事未完成，需继续努力。','火山旅':'小亨，旅贞吉。外出奔波之象。','火地晋':'康侯用锡马。进步上升之象。',
'雷天大壮':'利贞。气势强盛，但勿过刚。','雷泽归妹':'征凶，无攸利。关系之象，慎处感情。','雷火丰':'亨，勿忧。丰盛之象，宜珍惜当下。',
'震为雷':'亨。震动之象，惊后有喜。','雷风恒':'亨，利贞。恒久之道，持之以恒。','雷水解':'利西南。解除之象，困难化解。',
'雷山小过':'亨利贞。小有过失，注意细节。','雷地豫':'利建侯行师。愉悦之象，利于行动。','风天小畜':'亨。小有积蓄，循序渐进。',
'风泽中孚':'豚鱼吉。诚信之象，以诚待人。','风火家人':'利女贞。家庭之象，宜守家道。','风雷益':'利有攸往，利涉大川。增益之象，大利进取。',
'巽为风':'小亨。顺入之象，以柔克刚。','风水涣':'亨。涣散之象，宜重新聚合。','风山渐':'女归吉。渐进之象，稳步发展。',
'风地观':'有孚颙若。观察之象，宜审时度势。','水天需':'有孚光亨，利涉大川。等待时机。','水泽节':'亨，苦节不可贞。节制有度。',
'水火既济':'亨小，利贞。事已成，宜守不宜进。','水雷屯':'元亨利贞。初创之难，坚持则通。','水风井':'改邑不改井。稳定之源，养德蓄力。',
'坎为水':'有孚维心亨。险中求通，诚心则安。','水山蹇':'利西南。前行有阻，宜转变方向。','水地比':'吉。亲比之象，利于合作。',
'山天大畜':'利贞。大有积蓄，厚积薄发。','山泽损':'有孚，利贞。减损之时，舍得则得。','山火贲':'亨，小利有攸往。装饰之象，注重内涵。',
'山雷颐':'贞吉。养生之象，注意饮食身心。','山风蛊':'元亨利涉大川。整治之象，勇于改革。','山水蒙':'亨。启蒙之象，利于学习。',
'艮为山':'艮其背，不获其身。止而不动，宜静守。','山地剥':'不利有攸往。剥落之象，宜守不宜攻。','地天泰':'小往大来。通泰之象，万事顺利。',
'地泽临':'元亨利贞。来临之象，好事将至。','地火明夷':'利艰贞。光明受损，韬光养晦。','地雷复':'亨。反复之象，事情将有转机。',
'地风升':'元亨。上升之象，步步高升。','地水师':'贞丈人吉。统领之象，利于团队。','地山谦':'亨，君子有终。谦虚之象，大吉。',
'坤为地':'元亨利牝马之贞。厚德载物，顺承之道。'
};
const WX_SHENG={金:'水',水:'木',木:'火',火:'土',土:'金'};
const WX_KE={金:'木',木:'土',土:'水',水:'火',火:'金'};

function generateHexagram(date){
  const d=date instanceof Date?date:new Date(date);
  let y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate(),h=d.getHours();
  // 子时跨日：23点属次日子时
  if (h >= 23) {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    y = next.getFullYear(); m = next.getMonth() + 1; day = next.getDate();
  }
  const sc=Math.floor(((h+1)%24)/2)+1;
  const un=((y+m+day)%8)||8, ln=((y+m+day+sc)%8)||8, cl=((y+m+day+sc)%6)||6;
  return _buildHexagram(un, ln, cl, 'time', `年${y}+月${m}+日${day}+时辰${sc}`);
}

/**
 * 数字起卦：用户提供1-2个数字
 * 单数模式：num1的各位数之和 → 上卦/下卦/动爻
 * 双数模式：num1→上卦, num2→下卦, (num1+num2)→动爻
 */
function generateFromNumbers(num1, num2) {
  num1 = parseInt(num1);
  if (num2 !== undefined && num2 !== null && num2 !== '') {
    // 双数模式
    num2 = parseInt(num2);
    const un = (num1 % 8) || 8;
    const ln = (num2 % 8) || 8;
    const cl = ((num1 + num2) % 6) || 6;
    return _buildHexagram(un, ln, cl, 'numbers', `上卦数${num1}→${un}, 下卦数${num2}→${ln}, 动爻(${num1}+${num2})%6→${cl}`);
  } else {
    // 单数模式：拆分数字各位
    const digits = String(num1).split('').map(Number);
    const sum = digits.reduce((a, b) => a + b, 0);
    const half = Math.ceil(digits.length / 2);
    const firstHalf = digits.slice(0, half).reduce((a, b) => a + b, 0);
    const secondHalf = digits.slice(half).reduce((a, b) => a + b, 0) || sum;
    const un = (firstHalf % 8) || 8;
    const ln = (secondHalf % 8) || 8;
    const cl = (sum % 6) || 6;
    return _buildHexagram(un, ln, cl, 'number', `数字${num1}→前半${firstHalf}(上卦${un})+后半${secondHalf}(下卦${ln})+总和${sum}(动爻${cl})`);
  }
}

/**
 * 内部：根据上卦号、下卦号、动爻构建完整卦象
 */
function _buildHexagram(un, ln, cl, method, methodDesc) {
  const ut=TRI[un-1],lt=TRI[ln-1],hn=HEX_NAMES[un-1][ln-1];
  const isUpper=cl>3, ti=isUpper?lt:ut, yong=isUpper?ut:lt;
  let rel;
  if(ti.el===yong.el)rel={type:'比和',zh:'事情平顺',en:'Harmony'};
  else if(WX_SHENG[ti.el]===yong.el)rel={type:'体生用',zh:'有付出消耗',en:'Draining'};
  else if(WX_SHENG[yong.el]===ti.el)rel={type:'用生体',zh:'有收获助力',en:'Beneficial'};
  else if(WX_KE[ti.el]===yong.el)rel={type:'体克用',zh:'可掌控局面',en:'Favorable'};
  else rel={type:'用克体',zh:'有压力阻碍',en:'Challenging'};
  const cun=cl>3?((un+cl-3)%8)||8:un, cln=cl<=3?((ln+cl)%8)||8:ln;
  const chn=HEX_NAMES[cun-1][cln-1];
  // 互卦：取爻2,3,4为下卦，爻3,4,5为上卦
  const triLines={1:[1,1,1],2:[0,1,1],3:[1,0,1],4:[0,0,1],5:[1,1,0],6:[0,1,0],7:[1,0,0],8:[0,0,0]};
  const aL=[...(triLines[ln]||[0,0,0]),...(triLines[un]||[0,0,0])];// 爻1-6
  const l2t=(ls)=>{const k=Object.entries(triLines).find(([,v])=>v[0]===ls[0]&&v[1]===ls[1]&&v[2]===ls[2]);return k?parseInt(k[0]):8;};
  const huLn=l2t([aL[1],aL[2],aL[3]]),huUn=l2t([aL[2],aL[3],aL[4]]);
  const huGua={name:HEX_NAMES[huUn-1][huLn-1],upper:TRI[huUn-1],lower:TRI[huLn-1]};
  return{hexagram:{name:hn,upper:ut,lower:lt,guaCi:GUA_CI[hn]||''},changed:{name:chn,upper:TRI[cun-1],lower:TRI[cln-1],guaCi:GUA_CI[chn]||''},huGua:{...huGua,guaCi:GUA_CI[huGua.name]||''},changingLine:cl,ti,yong,relation:rel,method,methodDesc,timestamp:new Date().toISOString()};
}

function formatForAI(result,mode='simple'){
  const r=result;
  const methodLine = r.method === 'time' ? `起卦方式：时间起卦（${r.methodDesc}）` :
    r.method === 'numbers' ? `起卦方式：双数起卦（${r.methodDesc}）` :
    r.method === 'number' ? `起卦方式：数字起卦（${r.methodDesc}）` : '';
  if(mode==='expert'){
    return `【梅花易数排盘】
${methodLine}
本卦：${r.hexagram.name}
卦辞：${r.hexagram.guaCi || ''}
上卦：${r.hexagram.upper.n}（${r.hexagram.upper.s} ${r.hexagram.upper.na}·${r.hexagram.upper.el}）${r.hexagram.upper.tr}
下卦：${r.hexagram.lower.n}（${r.hexagram.lower.s} ${r.hexagram.lower.na}·${r.hexagram.lower.el}）${r.hexagram.lower.tr}
动爻：第${r.changingLine}爻（动爻在${r.changingLine>3?'上':'下'}卦）
变卦：${r.changed.name}
变卦卦辞：${r.changed.guaCi || ''}
互卦：${r.huGua?r.huGua.name:'未计算'}（${r.huGua?r.huGua.upper.n+'/'+r.huGua.lower.n:''}）— 事情发展过程
互卦卦辞：${r.huGua?.guaCi || ''}

【体用分析】
体卦：${r.ti.n}（${r.ti.el}）— 代表问事者自身
用卦：${r.yong.n}（${r.yong.el}）— 代表所问之事
关系：${r.relation.type}（${r.ti.el}${r.relation.type.includes('生')?'→':'×'}${r.yong.el}）
判断：${r.relation.zh}

【变卦】${r.changed.name}（${r.changed.upper.n}上${r.changed.lower.n}下）
变卦上卦${r.changed.upper.n}（${r.changed.upper.el}）${r.changed.upper.tr}
变卦下卦${r.changed.lower.n}（${r.changed.lower.el}）${r.changed.lower.tr}
变卦为事情的最终走向${r.huGua ? `

【互卦分析】${r.huGua.name}（${r.huGua.upper.n}上${r.huGua.lower.n}下）
互卦上卦${r.huGua.upper.n}（${r.huGua.upper.el}）${r.huGua.upper.tr}
互卦下卦${r.huGua.lower.n}（${r.huGua.lower.el}）${r.huGua.lower.tr}
互卦代表事情发展的中间过程和内在变化` : ''}`;
  }
  // simple
  let verdict='';
  if(r.relation.type==='用生体'||r.relation.type==='体克用')verdict='整体趋势偏好，可以积极行动';
  else if(r.relation.type==='比和')verdict='事情较为平稳，顺其自然即可';
  else if(r.relation.type==='体生用')verdict='需要付出较多精力，注意量力而行';
  else verdict='有一定阻碍，建议谨慎观望';
  return `你的卦象：${r.hexagram.name}（${r.hexagram.upper.n}${r.hexagram.upper.s}上·${r.hexagram.lower.n}${r.hexagram.lower.s}下）
${r.hexagram.guaCi ? '卦意：' + r.hexagram.guaCi + '\n' : ''}${methodLine ? methodLine + '\n' : ''}
核心能量：
· 你的状态（体卦）：${r.ti.n} — ${r.ti.na}的能量，${r.ti.tr}
· 事情走向（用卦）：${r.yong.n} — ${r.yong.na}的能量，${r.yong.tr}
· 两者关系：${r.relation.zh}

结论：${verdict}
${r.huGua ? `\n过程线索：中间会经历「${r.huGua.name}」的变化（${r.huGua.upper.na}与${r.huGua.lower.na}的互动）` : ''}
变化趋势：事情最终走向「${r.changed.name}」的状态${r.changed.guaCi ? '（'+r.changed.guaCi.split('。')[0]+'）' : ''}`;
}

module.exports={generateHexagram,generateFromNumbers,formatForAI,TRI};
