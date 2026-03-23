const TRI=[{id:1,n:'乾',s:'☰',na:'天',el:'金',tr:'刚健'},{id:2,n:'兑',s:'☱',na:'泽',el:'金',tr:'喜悦'},{id:3,n:'离',s:'☲',na:'火',el:'火',tr:'光明'},{id:4,n:'震',s:'☳',na:'雷',el:'木',tr:'运动'},{id:5,n:'巽',s:'☴',na:'风',el:'木',tr:'进入'},{id:6,n:'坎',s:'☵',na:'水',el:'水',tr:'陷险'},{id:7,n:'艮',s:'☶',na:'山',el:'土',tr:'静止'},{id:8,n:'坤',s:'☷',na:'地',el:'土',tr:'顺承'}];
const HEX_NAMES=[['乾为天','天泽履','天火同人','天雷无妄','天风姤','天水讼','天山遁','天地否'],['泽天夬','兑为泽','泽火革','泽雷随','泽风大过','泽水困','泽山咸','泽地萃'],['火天大有','火泽睽','离为火','火雷噬嗑','火风鼎','火水未济','火山旅','火地晋'],['雷天大壮','雷泽归妹','雷火丰','震为雷','雷风恒','雷水解','雷山小过','雷地豫'],['风天小畜','风泽中孚','风火家人','风雷益','巽为风','风水涣','风山渐','风地观'],['水天需','水泽节','水火既济','水雷屯','水风井','坎为水','水山蹇','水地比'],['山天大畜','山泽损','山火贲','山雷颐','山风蛊','山水蒙','艮为山','山地剥'],['地天泰','地泽临','地火明夷','地雷复','地风升','地水师','地山谦','坤为地']];
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
  return{hexagram:{name:hn,upper:ut,lower:lt},changed:{name:chn,upper:TRI[cun-1],lower:TRI[cln-1]},huGua,changingLine:cl,ti,yong,relation:rel,method,methodDesc,timestamp:new Date().toISOString()};
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
上卦：${r.hexagram.upper.n}（${r.hexagram.upper.s} ${r.hexagram.upper.na}·${r.hexagram.upper.el}）${r.hexagram.upper.tr}
下卦：${r.hexagram.lower.n}（${r.hexagram.lower.s} ${r.hexagram.lower.na}·${r.hexagram.lower.el}）${r.hexagram.lower.tr}
动爻：第${r.changingLine}爻（动爻在${r.changingLine>3?'上':'下'}卦）
变卦：${r.changed.name}
互卦：${r.huGua?r.huGua.name:'未计算'}（${r.huGua?r.huGua.upper.n+'/'+r.huGua.lower.n:''}）— 事情发展过程

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
${methodLine ? methodLine + '\n' : ''}
核心能量：
· 你的状态（体卦）：${r.ti.n} — ${r.ti.na}的能量，${r.ti.tr}
· 事情走向（用卦）：${r.yong.n} — ${r.yong.na}的能量，${r.yong.tr}
· 两者关系：${r.relation.zh}

结论：${verdict}
${r.huGua ? `\n过程线索：中间会经历「${r.huGua.name}」的变化（${r.huGua.upper.na}与${r.huGua.lower.na}的互动）` : ''}
变化趋势：事情最终走向「${r.changed.name}」的状态`;
}

module.exports={generateHexagram,generateFromNumbers,formatForAI,TRI};
