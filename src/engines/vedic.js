const RASHIS=[{id:1,n:'Mesha',en:'Aries',zh:'白羊',ruler:'Mars',el:'Fire'},{id:2,n:'Vrishabha',en:'Taurus',zh:'金牛',ruler:'Venus',el:'Earth'},{id:3,n:'Mithuna',en:'Gemini',zh:'双子',ruler:'Mercury',el:'Air'},{id:4,n:'Karka',en:'Cancer',zh:'巨蟹',ruler:'Moon',el:'Water'},{id:5,n:'Simha',en:'Leo',zh:'狮子',ruler:'Sun',el:'Fire'},{id:6,n:'Kanya',en:'Virgo',zh:'处女',ruler:'Mercury',el:'Earth'},{id:7,n:'Tula',en:'Libra',zh:'天秤',ruler:'Venus',el:'Air'},{id:8,n:'Vrishchika',en:'Scorpio',zh:'天蝎',ruler:'Mars',el:'Water'},{id:9,n:'Dhanu',en:'Sagittarius',zh:'射手',ruler:'Jupiter',el:'Fire'},{id:10,n:'Makara',en:'Capricorn',zh:'摩羯',ruler:'Saturn',el:'Earth'},{id:11,n:'Kumbha',en:'Aquarius',zh:'水瓶',ruler:'Saturn',el:'Air'},{id:12,n:'Meena',en:'Pisces',zh:'双鱼',ruler:'Jupiter',el:'Water'}];
const NAK=[{n:'Ashwini',zh:'马首',ruler:'Ketu',q:'迅捷'},{n:'Bharani',zh:'负载',ruler:'Venus',q:'猛烈'},{n:'Krittika',zh:'昴宿',ruler:'Sun',q:'混合'},{n:'Rohini',zh:'毕宿',ruler:'Moon',q:'固定'},{n:'Mrigashira',zh:'参宿',ruler:'Mars',q:'柔和'},{n:'Ardra',zh:'觜宿',ruler:'Rahu',q:'尖锐'},{n:'Punarvasu',zh:'井宿',ruler:'Jupiter',q:'变动'},{n:'Pushya',zh:'鬼宿',ruler:'Saturn',q:'轻柔'},{n:'Ashlesha',zh:'柳宿',ruler:'Mercury',q:'尖锐'},{n:'Magha',zh:'星宿',ruler:'Ketu',q:'猛烈'},{n:'P.Phalguni',zh:'张宿',ruler:'Venus',q:'猛烈'},{n:'U.Phalguni',zh:'翼宿',ruler:'Sun',q:'固定'},{n:'Hasta',zh:'轸宿',ruler:'Moon',q:'轻柔'},{n:'Chitra',zh:'角宿',ruler:'Mars',q:'柔和'},{n:'Swati',zh:'亢宿',ruler:'Rahu',q:'变动'},{n:'Vishakha',zh:'氐宿',ruler:'Jupiter',q:'混合'},{n:'Anuradha',zh:'房宿',ruler:'Saturn',q:'柔和'},{n:'Jyeshtha',zh:'心宿',ruler:'Mercury',q:'尖锐'},{n:'Mula',zh:'尾宿',ruler:'Ketu',q:'尖锐'},{n:'P.Ashadha',zh:'箕宿',ruler:'Venus',q:'猛烈'},{n:'U.Ashadha',zh:'斗宿',ruler:'Sun',q:'固定'},{n:'Shravana',zh:'女宿',ruler:'Moon',q:'变动'},{n:'Dhanishta',zh:'虚宿',ruler:'Mars',q:'变动'},{n:'Shatabhisha',zh:'危宿',ruler:'Rahu',q:'变动'},{n:'P.Bhadrapada',zh:'室宿',ruler:'Jupiter',q:'猛烈'},{n:'U.Bhadrapada',zh:'壁宿',ruler:'Saturn',q:'固定'},{n:'Revati',zh:'奎宿',ruler:'Mercury',q:'柔和'}];
const DASHA_YRS={Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17,Ketu:7,Venus:20};
const DASHA_ORD=['Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury','Ketu','Venus'];
const D_ZH={Sun:'太阳',Moon:'月亮',Mars:'火星',Rahu:'罗睺',Jupiter:'木星',Saturn:'土星',Mercury:'水星',Ketu:'计都',Venus:'金星'};
const AYANAMSA=24.17;

function calculate(input){
  const{year,month,day,hour}=input;
  const doy=[0,31,59,90,120,151,181,212,243,273,304,334][month-1]+day;
  const tropDeg=((doy-80)/365.25)*360;
  const sidDeg=((tropDeg-AYANAMSA)+360)%360;
  const sunRashi=RASHIS[Math.floor(sidDeg/30)];
  const sunDeg=(sidDeg%30).toFixed(1);
  // 确定性月亮计算
  const moonOff=((year*13+month*29+day*11)%360+360)%360;
  const sidMoon=((moonOff-AYANAMSA)+360)%360;
  const moonRashi=RASHIS[Math.floor(sidMoon/30)];
  const nakIdx=Math.floor(sidMoon/(360/27));
  const nak=NAK[nakIdx];
  const lagnaOff=hour!==undefined?Math.floor(hour/2):0;
  const lagna=RASHIS[(sunRashi.id-1+lagnaOff)%12];
  // Dasha
  const startIdx=DASHA_ORD.indexOf(nak.ruler);
  const dashas=[];let cy=year;
  for(let i=0;i<9;i++){const p=DASHA_ORD[(startIdx+i)%9],yrs=DASHA_YRS[p];dashas.push({planet:p,zh:D_ZH[p],start:cy,end:cy+yrs,yrs});cy+=yrs;}
  const now=new Date().getFullYear();
  const curDasha=dashas.find(d=>now>=d.start&&now<d.end)||dashas[0];
  return{sunSign:sunRashi,sunDeg,moonSign:moonRashi,moonNak:nak,lagna,dashas,currentDasha:curDasha};
}

function formatForAI(result,mode='simple'){
  const r=result;
  if(mode==='expert'){
    let o=`【吠陀星盘排盘】\n太阳（恒星黄道）：${r.sunSign.n}（${r.sunSign.zh}座）${r.sunDeg}°  守护：${r.sunSign.ruler}\n月亮：${r.moonSign.n}（${r.moonSign.zh}座）  守护：${r.moonSign.ruler}\n月亮纳克沙特拉：${r.moonNak.n}（${r.moonNak.zh}）  主宰：${r.moonNak.ruler}  性质：${r.moonNak.q}\n上升（Lagna）：${r.lagna.n}（${r.lagna.zh}座）  守护：${r.lagna.ruler}`;
    o+=`\n\n【Vimshottari Dasha 大运】\n当前：${r.currentDasha.zh}大运（${r.currentDasha.start}-${r.currentDasha.end}，${r.currentDasha.yrs}年）`;
    o+=`\n\n完整大运序列：`;
    r.dashas.forEach(d=>{o+=`\n${d.zh}（${d.start}-${d.end}，${d.yrs}年）${d===r.currentDasha?' ← 当前':''}`;});
    return o;
  }
  let o=`你的吠陀星盘：\n☀️ 太阳在${r.sunSign.zh}座（恒星黄道）— 守护星${r.sunSign.ruler}\n🌙 月亮在${r.moonSign.zh}座 — 内心世界的主调\n⭐ 月亮星宿：${r.moonNak.n}（${r.moonNak.zh}）— 性质${r.moonNak.q}\n⬆️ 上升${r.lagna.zh}座 — 人生的整体方向`;
  o+=`\n\n你当前处于「${r.currentDasha.zh}」大运周期（${r.currentDasha.start}-${r.currentDasha.end}）`;
  const effects={Sun:'这段时期关注自我表达和权威',Moon:'情感和内在需求是重心',Mars:'充满行动力，但注意冲突',Rahu:'充满变革和非传统的机遇',Jupiter:'扩展、学习和好运的周期',Saturn:'考验耐心，但会收获成熟',Mercury:'沟通、学习和商业活跃',Ketu:'灵性成长，放下执着',Venus:'感情、艺术和享受的丰收期'};
  o+=`\n${effects[r.currentDasha.planet]||''}`;
  return o;
}

module.exports={calculate,formatForAI,RASHIS,NAK};
