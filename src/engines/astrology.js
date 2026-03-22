const SIGNS=[{id:'aries',zh:'白羊座',en:'Aries',sym:'♈',el:'fire',ruler:'Mars',range:[321,419],traits:['勇敢果断','热情冲动','领导力强','直接坦率'],simTrait:'热情直率的开拓者'},
{id:'taurus',zh:'金牛座',en:'Taurus',sym:'♉',el:'earth',ruler:'Venus',range:[420,520],traits:['稳定可靠','务实耐心','感官敏锐','坚持不懈'],simTrait:'踏实可靠的守护者'},
{id:'gemini',zh:'双子座',en:'Gemini',sym:'♊',el:'air',ruler:'Mercury',range:[521,620],traits:['聪明好奇','善于沟通','灵活多变','幽默风趣'],simTrait:'聪慧多面的沟通者'},
{id:'cancer',zh:'巨蟹座',en:'Cancer',sym:'♋',el:'water',ruler:'Moon',range:[621,722],traits:['情感丰富','重视家庭','直觉敏锐','有保护欲'],simTrait:'温暖体贴的守护者'},
{id:'leo',zh:'狮子座',en:'Leo',sym:'♌',el:'fire',ruler:'Sun',range:[723,822],traits:['自信大方','慷慨热情','创造力强','渴望关注'],simTrait:'光芒四射的王者'},
{id:'virgo',zh:'处女座',en:'Virgo',sym:'♍',el:'earth',ruler:'Mercury',range:[823,922],traits:['细致完美','分析力强','实际高效','谦逊服务'],simTrait:'精益求精的完美主义者'},
{id:'libra',zh:'天秤座',en:'Libra',sym:'♎',el:'air',ruler:'Venus',range:[923,1023],traits:['追求和谐','审美优雅','善于社交','重视公平'],simTrait:'优雅和谐的平衡者'},
{id:'scorpio',zh:'天蝎座',en:'Scorpio',sym:'♏',el:'water',ruler:'Pluto',range:[1024,1121],traits:['洞察力强','意志坚定','感情深沉','神秘魅力'],simTrait:'深邃神秘的洞察者'},
{id:'sagittarius',zh:'射手座',en:'Sagittarius',sym:'♐',el:'fire',ruler:'Jupiter',range:[1122,1221],traits:['乐观自由','追求真理','爱好冒险','哲学思考'],simTrait:'自由奔放的冒险家'},
{id:'capricorn',zh:'摩羯座',en:'Capricorn',sym:'♑',el:'earth',ruler:'Saturn',range:[1222,119],traits:['有责任感','纪律严明','雄心勃勃','务实稳重'],simTrait:'坚韧务实的攀登者'},
{id:'aquarius',zh:'水瓶座',en:'Aquarius',sym:'♒',el:'air',ruler:'Uranus',range:[120,218],traits:['独立创新','人道主义','思想超前','特立独行'],simTrait:'独立前卫的创新者'},
{id:'pisces',zh:'双鱼座',en:'Pisces',sym:'♓',el:'water',ruler:'Neptune',range:[219,320],traits:['富有同情','想象力强','灵性直觉','艺术天赋'],simTrait:'浪漫感性的梦想家'}];
const EL_ZH={fire:'火象',earth:'土象',air:'风象',water:'水象'};
const COMPAT={fire:{fire:85,earth:50,air:90,water:45},earth:{fire:50,earth:80,air:55,water:85},air:{fire:90,earth:55,air:80,water:50},water:{fire:45,earth:85,air:50,water:80}};

function getSunSign(m,d){const md=m*100+d;if(md>=1222||md<=119)return SIGNS[9];return SIGNS.find(s=>s.id!=='capricorn'&&md>=s.range[0]&&md<=s.range[1])||SIGNS[0];}
// 确定性月亮星座（基于出生日期的固定偏移，同一输入永远相同）
function getMoonSign(y,m,d){const idx=((y*13+m*29+d*7)%12+12)%12;return SIGNS[idx];}
function getRising(m,d,h){const si=SIGNS.findIndex(s=>s.id===getSunSign(m,d).id);return SIGNS[(si+Math.floor((h||0)/2))%12];}
function getCompat(s1,s2){return COMPAT[s1.el][s2.el];}

function calculate(input){
  const{year,month,day,hour}=input;
  const sun=getSunSign(month,day),moon=getMoonSign(year,month,day),rising=hour!==undefined?getRising(month,day,hour):null;
  return{sunSign:sun,moonSign:moon,risingSign:rising,element:EL_ZH[sun.el]};
}

function formatForAI(result,mode='simple'){
  const r=result,s=r.sunSign,m=r.moonSign,ri=r.risingSign;
  if(mode==='expert'){
    let o=`【星盘核心三要素】\n太阳星座：${s.zh}（${s.sym} ${s.en}）\n  元素：${EL_ZH[s.el]}  守护星：${s.ruler}\n  特质：${s.traits.join('、')}`;
    o+=`\n月亮星座：${m.zh}（${m.sym} ${m.en}）\n  元素：${EL_ZH[m.el]}  守护星：${m.ruler}\n  内在情感：${m.traits.join('、')}`;
    if(ri)o+=`\n上升星座：${ri.zh}（${ri.sym} ${ri.en}）\n  元素：${EL_ZH[ri.el]}  守护星：${ri.ruler}\n  外在表现：${ri.traits.join('、')}`;
    o+=`\n\n【元素平衡】太阳${EL_ZH[s.el]}+月亮${EL_ZH[m.el]}${ri?'+上升'+EL_ZH[ri.el]:''}`;
    const sc=getCompat(s,m);o+=`\n太阳-月亮内在协调度：${sc}%`;
    return o;
  }
  let o=`你的星座组合：\n☀️ 太阳${s.zh} — ${s.simTrait}\n🌙 月亮${m.zh} — ${m.simTrait}`;
  if(ri)o+=`\n⬆️ 上升${ri.zh} — ${ri.simTrait}`;
  o+=`\n\n太阳${s.zh}决定你的核心性格：${s.traits.slice(0,2).join('、')}`;
  o+=`\n月亮${m.zh}决定你的内心需求：${m.traits.slice(0,2).join('、')}`;
  if(ri)o+=`\n上升${ri.zh}决定别人对你的第一印象：${ri.traits.slice(0,2).join('、')}`;
  const sc=getCompat(s,m);o+=`\n\n你的太阳与月亮${sc>=80?'高度和谐':sc>=60?'互相配合':sc>=50?'需要磨合':'存在张力'}（协调度${sc}%）`;
  return o;
}

module.exports={calculate,formatForAI,getSunSign,getCompat,SIGNS};
