/**
 * 时辰校正引擎 v2 — 加大分值差异提高区分度
 */
const { Solar } = require('lunar-javascript');
const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WX_MAP = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const DZ_WX = { 子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水' };
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
const SS_CAT = {'比肩':'比劫','劫财':'比劫','食神':'食伤','伤官':'食伤','偏财':'财星','正财':'财星','七杀':'官杀','正官':'官杀','偏印':'印星','正印':'印星'};
const DZ_HIDE = {子:'癸',丑:'己',寅:'甲',卯:'乙',辰:'戊',巳:'丙',午:'丁',未:'己',申:'庚',酉:'辛',戌:'戊',亥:'壬'};
const SHENG = {木:'水',火:'木',土:'火',金:'土',水:'金'}; // 生我的

const SHICHEN = [
  { dz:'子', range:'23-1',  rep:0,  label:'子时', period:'night' },
  { dz:'丑', range:'1-3',   rep:2,  label:'丑时', period:'dawn' },
  { dz:'寅', range:'3-5',   rep:4,  label:'寅时', period:'dawn' },
  { dz:'卯', range:'5-7',   rep:6,  label:'卯时', period:'morning' },
  { dz:'辰', range:'7-9',   rep:8,  label:'辰时', period:'morning' },
  { dz:'巳', range:'9-11',  rep:10, label:'巳时', period:'noon' },
  { dz:'午', range:'11-13', rep:12, label:'午时', period:'noon' },
  { dz:'未', range:'13-15', rep:14, label:'未时', period:'afternoon' },
  { dz:'申', range:'15-17', rep:16, label:'申时', period:'afternoon' },
  { dz:'酉', range:'17-19', rep:18, label:'酉时', period:'evening' },
  { dz:'戌', range:'19-21', rep:20, label:'戌时', period:'evening' },
  { dz:'亥', range:'21-23', rep:22, label:'亥时', period:'night' },
];

function calcAllHours(year, month, day, gender) {
  const results = [];
  for (const sc of SHICHEN) {
    try {
      const solar = Solar.fromYmdHms(year, month, day, sc.rep, 0, 0);
      const lunar = solar.getLunar();
      const ec = lunar.getEightChar();
      const dayTg = ec.getDay()[0];
      const hourTg = ec.getTime()[0];
      const hourSS = SS_TABLE[dayTg]?.[hourTg] || '未知';
      const cat = SS_CAT[hourSS] || '未知';
      // 五行
      const pillars = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
      const wxCount = { 木:0, 火:0, 土:0, 金:0, 水:0 };
      pillars.forEach(p => {
        if(p[0]&&WX_MAP[p[0]]) wxCount[WX_MAP[p[0]]]++;
        if(p[1]&&DZ_WX[p[1]]) wxCount[DZ_WX[p[1]]]++;
      });
      // 身强弱
      const dayWx = WX_MAP[dayTg];
      const helpWxs = [dayWx, SHENG[dayWx]];
      let helpN=0, totalN=0;
      Object.entries(wxCount).forEach(([wx,n])=>{totalN+=n;if(helpWxs.includes(wx))helpN+=n});
      const strength = totalN > 0 ? helpN/totalN : 0.5;

      results.push({
        shichen: sc, hourGZ: ec.getTime(), hourTg, hourSS, cat,
        dayTg, wxCount, strength, hourWx: WX_MAP[hourTg],
      });
    } catch(e) {}
  }
  return results;
}

function scoreHours(allHours, answers) {
  const scored = allHours.map(h => {
    let score = 0;
    const { cat, hourSS: ss } = h;

    // === 1. 排行 (30分) ===
    if (answers.rank === 'oldest') {
      if (cat==='比劫') score+=30; else if(cat==='食伤') score+=20; else if(cat==='印星') score-=10;
    } else if (answers.rank === 'youngest') {
      if (cat==='印星') score+=30; else if(cat==='官杀') score+=15; else if(cat==='比劫') score-=15;
    } else if (answers.rank === 'middle') {
      if (cat==='食伤') score+=25; else if(cat==='财星') score+=20;
    } else if (answers.rank === 'only') {
      if (ss==='偏印') score+=30; else if(ss==='七杀') score+=25; else if(cat==='比劫') score-=20; else if(ss==='正印') score+=10;
    }

    // === 2. 性格 (30分) ===
    if (answers.personality === 'extrovert') {
      if (cat==='食伤') score+=30; else if(cat==='比劫') score+=20; else if(cat==='财星') score+=10; else if(cat==='印星') score-=15;
    } else if (answers.personality === 'introvert') {
      if (cat==='印星') score+=30; else if(ss==='正官') score+=20; else if(cat==='食伤') score-=15; else if(cat==='比劫') score-=10;
    } else {
      if (cat==='财星') score+=20; else if(ss==='七杀') score+=15;
    }

    // === 3. 转折年龄 (20分) ===
    if (answers.turning === '10-18') {
      if (h.strength>0.5 && ['食伤','财星'].includes(cat)) score+=20; else if(h.strength>0.55) score+=10;
    } else if (answers.turning === '19-25') {
      if (['官杀','财星'].includes(cat)) score+=15;
    } else if (answers.turning === '26-33') {
      if (cat==='印星') score+=15; else if(h.strength<0.45) score+=10;
    } else if (answers.turning === '34+') {
      if (h.strength<0.4) score+=20; else if(cat==='印星') score+=15; else if(h.strength>0.55) score-=10;
    }

    // === 4. 体型 (10分) ===
    if (answers.bodyType === 'slim') {
      if (['木','火'].includes(h.hourWx)) score+=10; else if(h.hourWx==='土') score-=5;
    } else if (answers.bodyType === 'strong') {
      if (['土','金'].includes(h.hourWx)) score+=10; else if(h.hourWx==='木') score-=3;
    } else {
      if (h.hourWx==='水') score+=8;
    }

    // === 5. 精力时段 (10分) ===
    const p = h.shichen.period;
    if (answers.energy === 'earlyMorning') {
      if (['dawn','morning'].includes(p)) score+=10; else if(p==='night') score-=5;
    } else if (answers.energy === 'morning') {
      if (['morning','noon'].includes(p)) score+=10; else if(p==='night') score-=3;
    } else if (answers.energy === 'afternoon') {
      if (['afternoon','evening'].includes(p)) score+=10;
    } else if (answers.energy === 'lateNight') {
      if (p==='night') score+=10; else if(p==='morning') score-=5;
    }

    return { ...h, score };
  });

  scored.sort((a,b) => b.score - a.score);
  const top=scored[0], second=scored[1];
  const gap = top.score - second.score;

  let confidence, level, message;
  if (gap >= 20) {
    confidence = Math.min(85, 60+gap);
    level = 'high';
    message = `推测你最可能出生在${top.shichen.label}（${top.shichen.range}点），置信度较高`;
  } else if (gap >= 10) {
    confidence = 35+gap;
    level = 'medium';
    message = `较可能是${top.shichen.label}（${top.shichen.range}点）或${second.shichen.label}（${second.shichen.range}点）`;
  } else {
    confidence = Math.max(10, 15+gap);
    level = 'low';
    message = `前几名差距不大，最可能是${top.shichen.label}，建议结合大致时段选择`;
  }

  const explain = (h) => {
    const parts = [`时柱${h.hourGZ}（${h.hourSS}）`];
    if(h.strength>0.55) parts.push('身强');
    else if(h.strength<0.4) parts.push('身弱');
    parts.push(`偏${Object.entries(h.wxCount).sort((a,b)=>b[1]-a[1])[0][0]}`);
    return parts.join('，');
  };

  return {
    ranking: scored.slice(0,3).map(s => ({
      label:s.shichen.label, range:s.shichen.range, dz:s.shichen.dz,
      hour:s.shichen.rep, score:s.score, hourGZ:s.hourGZ, hourSS:s.hourSS,
      reason: explain(s),
    })),
    confidence, level, message,
    bestHour: top.shichen.rep,
    bestLabel: top.shichen.label,
  };
}

function correctHour(year, month, day, gender, answers) {
  const all = calcAllHours(year, month, day, gender);
  if (!all.length) return { error: '无法计算，请检查出生日期' };
  return scoreHours(all, answers);
}

function periodToHour(period) {
  return { dawn:3, morning:7, noon:11, afternoon:15, evening:19, night:23 }[period] ?? -1;
}

module.exports = { correctHour, periodToHour, SHICHEN };
