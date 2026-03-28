/**
 * 匹配引擎 — 轻量版，用于首页卡片评分
 * 底层复用 hehun.js 的五维评分系统
 */
const baziEngine = require('./bazi');
const hehunEngine = require('./hehun');

const WX_MAP = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const SHENGXIAO = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

/**
 * 快速匹配评分
 * @param {Object} profileA - {year,month,day,hour,gender}
 * @param {Object} profileB - {year,month,day,hour,gender}
 * @returns {Object} {score, grade, gradeDesc, dimensions, tags, compatibility}
 */
function quickMatch(profileA, profileB) {
  try {
    // 用合婚引擎计算完整结果
    const result = hehunEngine.calculate(
      { year: profileA.year, month: profileA.month, day: profileA.day, hour: profileA.hour >= 0 ? profileA.hour : 12, gender: profileA.gender },
      { year: profileB.year, month: profileB.month, day: profileB.day, hour: profileB.hour >= 0 ? profileB.hour : 12, gender: profileB.gender }
    );

    // 提取维度分数
    const dimensions = [
      { name: '日干配合', score: result.scores.dayMaster.score, max: 100, weight: 30, desc: result.scores.dayMaster.desc, icon: '💑' },
      { name: '地支关系', score: result.scores.dizhi.score, max: 100, weight: 25, desc: result.scores.dizhi.details?.[0] || '', icon: '🔗' },
      { name: '五行互补', score: result.scores.wuxing.score, max: 100, weight: 20, desc: result.scores.wuxing.desc, icon: '⚖️' },
      { name: '大运同步', score: result.scores.dayun.score, max: 100, weight: 15, desc: result.scores.dayun.desc, icon: '📈' },
      { name: '纳音配合', score: result.scores.nayin.score, max: 100, weight: 10, desc: result.scores.nayin.desc, icon: '🎵' },
    ];

    // 生成匹配标签
    const tags = [];
    if (result.scores.dayMaster.score >= 90) tags.push('天干合');
    if (result.scores.dayMaster.score >= 70) tags.push('日干相生');
    if (result.scores.dizhi.score >= 80) tags.push('地支和谐');
    if (result.scores.wuxing.score >= 80) tags.push('五行互补');
    if (result.scores.dayun.score >= 80) tags.push('大运同步');
    if (result.scores.total >= 85) tags.push('上等缘分');
    if (result.shishenCross) {
      const { youToThem, themToYou } = result.shishenCross;
      if (['正财','正官'].includes(youToThem.ss) || ['正财','正官'].includes(themToYou.ss)) tags.push('正缘特征');
    }

    // 匹配类型
    let compatibility;
    const dmA = result.person1.dayMasterElement;
    const dmB = result.person2.dayMasterElement;
    if (dmA === dmB) compatibility = { type: '同类共鸣', desc: '性格相似，容易理解对方', icon: '🪞' };
    else if (result.scores.wuxing.score >= 80) compatibility = { type: '五行互补', desc: '你缺的TA刚好有', icon: '☯️' };
    else if (result.scores.dayMaster.score >= 85) compatibility = { type: '天生一对', desc: '日干相合，天然吸引', icon: '💫' };
    else compatibility = { type: '成长型', desc: '需要磨合，但有成长空间', icon: '🌱' };

    return {
      score: result.scores.total,
      grade: result.grade,
      gradeDesc: result.gradeDesc,
      dimensions,
      tags: tags.slice(0, 3), // 最多3个标签
      compatibility,
      shishenCross: result.shishenCross,
      personA: {
        dayMaster: result.person1.dayMaster,
        element: result.person1.dayMasterElement,
        strength: result.person1.dayStrength,
        personality: result.person1.personality,
        wuxing: result.person1.wuxing,
        wuxingLack: result.person1.wuxingLack,
        shengxiao: SHENGXIAO[(result.person1.lunarDate?.yearGanzhi?.[1] ? '子丑寅卯辰巳午未申酉戌亥'.indexOf(result.person1.lunarDate.yearGanzhi[1]) : (profileA.year - 4) % 12)],
      },
      personB: {
        dayMaster: result.person2.dayMaster,
        element: result.person2.dayMasterElement,
        strength: result.person2.dayStrength,
        personality: result.person2.personality,
        wuxing: result.person2.wuxing,
        wuxingLack: result.person2.wuxingLack,
        shengxiao: SHENGXIAO[(result.person2.lunarDate?.yearGanzhi?.[1] ? '子丑寅卯辰巳午未申酉戌亥'.indexOf(result.person2.lunarDate.yearGanzhi[1]) : (profileB.year - 4) % 12)],
      },
    };
  } catch (e) {
    // Fallback: simple score based on basic compatibility
    return fallbackMatch(profileA, profileB);
  }
}

/**
 * 降级匹配（引擎异常时的简算）
 */
function fallbackMatch(a, b) {
  const sxA = (a.year - 4) % 12, sxB = (b.year - 4) % 12;
  // 三合
  const sanhe = [[0,4,8],[1,5,9],[2,6,10],[3,7,11]];
  const isSanhe = sanhe.some(g => g.includes(sxA) && g.includes(sxB));
  // 六合
  const liuhe = {0:1,1:0,2:11,3:10,4:9,5:8,6:7,7:6,8:5,9:4,10:3,11:2};
  const isLiuhe = liuhe[sxA] === sxB;
  // 相冲
  const isChong = Math.abs(sxA - sxB) === 6;

  let score = 70;
  if (isLiuhe) score += 15;
  else if (isSanhe) score += 10;
  else if (isChong) score -= 15;

  // 年龄差异
  const ageDiff = Math.abs(a.year - b.year);
  if (ageDiff <= 3) score += 5;
  else if (ageDiff >= 10) score -= 5;

  score = Math.max(45, Math.min(98, score + Math.floor(Math.random() * 10) - 5));

  return {
    score,
    grade: score >= 85 ? '上等' : score >= 70 ? '良好' : score >= 55 ? '一般' : '需磨合',
    gradeDesc: score >= 85 ? '缘分很深' : score >= 70 ? '值得了解' : '需要磨合',
    dimensions: [],
    tags: isSanhe ? ['生肖三合'] : isLiuhe ? ['生肖六合'] : isChong ? ['生肖相冲'] : [],
    compatibility: { type: '待深入分析', desc: '完整匹配需要更多信息', icon: '🔮' },
  };
}

/**
 * 批量匹配（首页卡片用）
 */
function batchMatch(userProfile, candidates) {
  return candidates.map(c => ({
    ...c,
    matchResult: quickMatch(userProfile, c),
  }));
}

/**
 * 今日运势（基于八字+当日流日）
 */
function todayFortune(profile) {
  try {
    const r = baziEngine.calculate({
      year: profile.year, month: profile.month, day: profile.day,
      hour: profile.hour >= 0 ? profile.hour : 12, gender: profile.gender,
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;

    // 从八字结果提取今日流月信息
    const currentMonth = r.liuyueList?.find(m => {
      const mNum = parseInt(m.month);
      return mNum === today.getMonth() + 1;
    });

    // 五行旺衰
    const wxArr = Object.entries(r.wuxing || {}).map(([k, v]) => ({ name: k, value: v }));
    const lack = r.wuxingLack || [];

    // 日主信息
    const dm = r.dayMaster;
    const dmWx = r.dayMasterElement;
    const strength = r.dayStrength;

    // 简易今日运势（基于日期hash+命局）
    const dayHash = today.getDate() * 7 + today.getMonth() * 13;
    const aspects = ['事业', '感情', '财运', '健康', '人际', '学业'];
    const fortuneScores = aspects.map((a, i) => ({
      name: a,
      score: Math.max(40, Math.min(95, 65 + ((dayHash + i * 17 + dm.charCodeAt(0)) % 30) - 10)),
    }));

    const totalScore = Math.round(fortuneScores.reduce((s, f) => s + f.score, 0) / fortuneScores.length);
    const lucky = ['大吉', '吉', '中吉', '小吉', '平', '小凶'];
    const luckyIdx = totalScore >= 85 ? 0 : totalScore >= 75 ? 1 : totalScore >= 65 ? 2 : totalScore >= 55 ? 3 : totalScore >= 45 ? 4 : 5;

    // 幸运要素
    const WX_COLOR = { 木: '绿色', 火: '红色', 土: '黄色', 金: '白色', 水: '黑色/蓝色' };
    const WX_DIR = { 木: '东方', 火: '南方', 土: '中央', 金: '西方', 水: '北方' };
    const WX_NUM = { 木: '3,8', 火: '2,7', 土: '5,0', 金: '4,9', 水: '1,6' };
    const favorWx = r.xpiUshen?.favorWx || (strength === '身弱' ? dmWx : '水');

    return {
      date: todayStr,
      dayMaster: dm,
      element: dmWx,
      strength,
      totalScore,
      lucky: lucky[luckyIdx],
      luckyColor: lucky[luckyIdx] === '大吉' ? '#DC2626' : lucky[luckyIdx] === '吉' ? '#F59E0B' : '#8B5CF6',
      aspects: fortuneScores,
      wuxing: wxArr,
      wuxingLack: lack,
      favorElement: favorWx,
      luckyColor2: WX_COLOR[favorWx] || '紫色',
      luckyDirection: WX_DIR[favorWx] || '不定',
      luckyNumber: WX_NUM[favorWx] || '0',
      currentMonth: currentMonth ? { month: currentMonth.month, rating: currentMonth.rating, desc: currentMonth.shortDesc || '' } : null,
      personality: r.personality,
    };
  } catch (e) {
    return { error: e.message, totalScore: 70, lucky: '平', aspects: [] };
  }
}

module.exports = { quickMatch, batchMatch, todayFortune, fallbackMatch };
