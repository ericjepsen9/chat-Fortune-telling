/**
 * 时辰校正引擎 — 根据用户特征反推最可能的出生时辰
 * 
 * 原理：已知年月日+性别，枚举12个时辰各算一套完整八字，
 * 然后用用户回答的5个问题做交叉匹配打分。
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

// 十二时辰对应小时范围和代表小时（用于计算）
const SHICHEN = [
  { dz: '子', range: '23-1',  hours: [23, 0], rep: 0,  label: '子时', period: 'night' },
  { dz: '丑', range: '1-3',   hours: [1, 2],  rep: 1,  label: '丑时', period: 'dawn' },
  { dz: '寅', range: '3-5',   hours: [3, 4],  rep: 4,  label: '寅时', period: 'dawn' },
  { dz: '卯', range: '5-7',   hours: [5, 6],  rep: 6,  label: '卯时', period: 'morning' },
  { dz: '辰', range: '7-9',   hours: [7, 8],  rep: 8,  label: '辰时', period: 'morning' },
  { dz: '巳', range: '9-11',  hours: [9, 10], rep: 10, label: '巳时', period: 'noon' },
  { dz: '午', range: '11-13', hours: [11,12], rep: 12, label: '午时', period: 'noon' },
  { dz: '未', range: '13-15', hours: [13,14], rep: 14, label: '未时', period: 'afternoon' },
  { dz: '申', range: '15-17', hours: [15,16], rep: 16, label: '申时', period: 'afternoon' },
  { dz: '酉', range: '17-19', hours: [17,18], rep: 18, label: '酉时', period: 'evening' },
  { dz: '戌', range: '19-21', hours: [19,20], rep: 20, label: '戌时', period: 'evening' },
  { dz: '亥', range: '21-23', hours: [21,22], rep: 22, label: '亥时', period: 'night' },
];

// 大致时段到时辰的映射
const PERIOD_MAP = {
  dawn:      [1, 2],    // 凌晨 → 丑寅
  morning:   [3, 4],    // 上午 → 卯辰
  noon:      [5, 6],    // 中午 → 巳午
  afternoon: [7, 8],    // 下午 → 未申
  evening:   [9, 10],   // 傍晚 → 酉戌
  night:     [11, 0],   // 夜晚 → 亥子
};

/**
 * 对每个候选时辰，计算完整八字基础信息
 */
function calcAllHours(year, month, day, gender) {
  const results = [];
  for (const sc of SHICHEN) {
    try {
      const h = sc.rep;
      const solar = Solar.fromYmdHms(year, month, day, h, 0, 0);
      const lunar = solar.getLunar();
      const ec = lunar.getEightChar();
      
      const dayTg = ec.getDay()[0]; // 日干
      const hourTg = ec.getTime()[0]; // 时干
      const hourDz = sc.dz;
      const hourSS = SS_TABLE[dayTg]?.[hourTg] || '未知';
      
      // 计算五行比例
      const pillars = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
      const wxCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
      pillars.forEach(p => {
        if (p[0] && WX_MAP[p[0]]) wxCount[WX_MAP[p[0]]]++;
        if (p[1] && DZ_WX[p[1]]) wxCount[DZ_WX[p[1]]]++;
      });
      
      // 计算起运年龄（简化：男阳女阴顺排，反之逆排）
      const yearTg = ec.getYear()[0];
      const isYangYear = ['甲','丙','戊','庚','壬'].includes(yearTg);
      const isMale = gender === 'male';
      const isForward = (isMale && isYangYear) || (!isMale && !isYangYear);
      // 起运年龄粗算：出生日到最近节气的天数/3
      let qiyunAge;
      try {
        const dayunArr = ec.getDaYun(isMale ? 1 : 0);
        if (dayunArr && dayunArr.length > 1) {
          qiyunAge = dayunArr[1].getStartAge();
        }
      } catch(e) {}
      if (!qiyunAge) qiyunAge = isForward ? 5 : 3; // fallback
      
      results.push({
        shichen: sc,
        hourGZ: ec.getTime(),
        hourTg, hourDz, hourSS,
        dayTg,
        wxCount,
        qiyunAge,
        pillars: pillars.map(p => p),
      });
    } catch(e) {
      // Skip invalid combinations
    }
  }
  return results;
}

/**
 * 匹配打分
 * 
 * answers: { rank, personality, turning, bodyType, energy }
 * 
 * rank: 'oldest' | 'middle' | 'youngest' | 'only'
 * personality: 'extrovert' | 'introvert' | 'ambivert'
 * turning: '10-18' | '19-25' | '26-33' | '34+'
 * bodyType: 'slim' | 'medium' | 'strong'
 * energy: 'earlyMorning' | 'morning' | 'afternoon' | 'lateNight'
 */
function scoreHours(allHours, answers) {
  const scored = allHours.map(h => {
    let score = 50; // base score
    
    // === 1. 排行匹配 (权重25) ===
    const ss = h.hourSS;
    if (answers.rank === 'oldest') {
      // 长子长女：时柱比肩劫财（兄弟星在时柱=弟妹来得晚）
      if (['比肩','劫财'].includes(ss)) score += 20;
      else if (['食神','伤官'].includes(ss)) score += 10;
      else if (['正官','七杀'].includes(ss)) score -= 5;
    } else if (answers.rank === 'youngest') {
      // 最小：时柱印星（被保护）或官杀（管束）
      if (['正印','偏印'].includes(ss)) score += 20;
      else if (['正官','七杀'].includes(ss)) score += 10;
      else if (['比肩','劫财'].includes(ss)) score -= 5;
    } else if (answers.rank === 'middle') {
      // 中间：食伤或财星
      if (['食神','伤官','偏财','正财'].includes(ss)) score += 15;
    } else if (answers.rank === 'only') {
      // 独生：时柱偏印（孤星）或七杀
      if (['偏印','七杀'].includes(ss)) score += 15;
      if (['比肩','劫财'].includes(ss)) score -= 10; // 比劫=兄弟多
    }
    
    // === 2. 性格匹配 (权重25) ===
    if (answers.personality === 'extrovert') {
      // 外向：食伤、比劫在时柱
      if (['食神','伤官','比肩','劫财'].includes(ss)) score += 20;
      if (['偏印','正印'].includes(ss)) score -= 10;
      // 火旺也偏外向
      if (h.wxCount['火'] >= 3) score += 5;
    } else if (answers.personality === 'introvert') {
      // 内向：印星、正官在时柱
      if (['正印','偏印','正官'].includes(ss)) score += 20;
      if (['食神','伤官'].includes(ss)) score -= 10;
      // 水旺偏内敛
      if (h.wxCount['水'] >= 3) score += 5;
    } else {
      // 两面：偏财或正财，平衡
      if (['偏财','正财'].includes(ss)) score += 15;
    }
    
    // === 3. 转折年龄匹配大运起运 (权重20) ===
    const qa = h.qiyunAge;
    if (answers.turning === '10-18') {
      // 第一步大运约10-18岁 → 起运年龄约2-8
      if (qa >= 2 && qa <= 8) score += 20;
      else if (qa >= 1 && qa <= 10) score += 10;
    } else if (answers.turning === '19-25') {
      // 第二步大运 → 起运约4-5, 第二步大运15-25
      if (qa >= 4 && qa <= 6) score += 20;
      else if (qa >= 3 && qa <= 8) score += 10;
    } else if (answers.turning === '26-33') {
      if (qa >= 6 && qa <= 9) score += 20;
      else if (qa >= 4 && qa <= 10) score += 10;
    } else if (answers.turning === '34+') {
      if (qa >= 8) score += 20;
      else if (qa >= 6) score += 10;
    }
    
    // === 4. 体型匹配 (权重15) ===
    const dominant = Object.entries(h.wxCount).sort((a,b) => b[1]-a[1])[0][0];
    if (answers.bodyType === 'slim') {
      if (['木','火'].includes(dominant)) score += 15;
      if (dominant === '土') score -= 8;
    } else if (answers.bodyType === 'strong') {
      if (['土','金'].includes(dominant)) score += 15;
      if (dominant === '木') score -= 5;
    } else {
      if (dominant === '水' || h.wxCount['水'] >= 2) score += 10;
    }
    
    // === 5. 精力时段匹配 (权重15) ===
    const period = h.shichen.period;
    if (answers.energy === 'earlyMorning') {
      if (['dawn','morning'].includes(period)) score += 15;
      if (period === 'night') score -= 5;
    } else if (answers.energy === 'morning') {
      if (['morning','noon'].includes(period)) score += 15;
    } else if (answers.energy === 'afternoon') {
      if (['afternoon','evening'].includes(period)) score += 15;
    } else if (answers.energy === 'lateNight') {
      if (['night','dawn'].includes(period)) score += 15;
      if (['morning','noon'].includes(period)) score -= 5;
    }
    
    return { ...h, score };
  });
  
  // Sort descending
  scored.sort((a, b) => b.score - a.score);
  
  // Calculate confidence
  const top = scored[0];
  const second = scored[1];
  const confidence = top.score > 0 ? Math.round((top.score - second.score) / top.score * 100) : 0;
  
  let level, message;
  if (confidence >= 30) {
    level = 'high';
    message = `推测你最可能出生在${top.shichen.label}（${top.shichen.range}点），置信度较高`;
  } else if (confidence >= 15) {
    level = 'medium';
    message = `较可能是${top.shichen.label}（${top.shichen.range}点）或${second.shichen.label}（${second.shichen.range}点）`;
  } else {
    level = 'low';
    message = `无法准确推测，最可能是${top.shichen.label}，但差异不大，建议选择大致时段`;
  }
  
  return {
    ranking: scored.slice(0, 3).map(s => ({
      label: s.shichen.label,
      range: s.shichen.range,
      dz: s.shichen.dz,
      hour: s.shichen.rep,
      score: s.score,
      hourGZ: s.hourGZ,
      hourSS: s.hourSS,
      reason: `时柱${s.hourGZ}（${s.hourSS}），起运${s.qiyunAge}岁`,
    })),
    confidence,
    level,
    message,
    bestHour: top.shichen.rep,
    bestLabel: top.shichen.label,
  };
}

/**
 * 主入口：时辰校正
 */
function correctHour(year, month, day, gender, answers) {
  const allHours = calcAllHours(year, month, day, gender);
  if (allHours.length === 0) return { error: '无法计算，请检查出生日期' };
  return scoreHours(allHours, answers);
}

/**
 * 大致时段 → 取中间时辰的代表小时
 */
function periodToHour(period) {
  const map = { dawn: 3, morning: 7, noon: 11, afternoon: 15, evening: 19, night: 23 };
  return map[period] ?? -1;
}

module.exports = { correctHour, periodToHour, SHICHEN, PERIOD_MAP };
