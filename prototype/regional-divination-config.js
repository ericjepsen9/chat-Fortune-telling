/**
 * 缘合 — 区域化占术配置
 * 5种占术，中国展示全部5种，其他区域展示4种
 * 
 * 中文文案规范：
 * - 西方占星术 → 中国叫"星座运势"
 * - 印度占星术 → 中国叫"印度占星"
 * - 八字/梅花 → 仅中文名
 * - 塔罗牌 → 中英相同
 */

// ============ 全部5种占术定义 ============

const ALL_MODES = {
  bazi: {
    id: 'bazi',
    name: { zh: '八字命理', en: 'Bazi Analysis' },
    icon: '☰',
    color: '#FF6B6B',
    gradient: 'linear-gradient(135deg,#FF6B6B,#FF8A9B)',
    desc: { zh: '四柱八字·五行十神', en: 'Four Pillars · Five Elements' },
    inputRequired: 'birthDateTime',  // 需要精确到时辰
    engine: 'local',                 // 本地排盘库计算
    library: 'lunar-javascript',     // 使用的排盘库
    sessionTurns: 20,
    greeting: {
      zh: '你好！基于你的四柱八字，我来为你解读命局与运势。想了解什么？',
      en: 'Hello! Based on your Four Pillars chart, I can interpret your destiny. What would you like to know?'
    },
    systemPrompt: `你是"缘合"的八字命理分析师。
知识体系：四柱八字、五行生克、十神关系、大运流年。
用户命盘数据（系统精确计算）：
{{BAZI_DATA}}
规则：
- 只基于命盘数据解读，不自行计算八字
- 温暖积极，不说"命中注定""劫难"
- 给出可执行建议，控制在200字内
- 不提及其他占术体系`,
  },

  meihua: {
    id: 'meihua',
    name: { zh: '梅花易数', en: 'Plum Blossom Oracle' },
    icon: '❀',
    color: '#FFB347',
    gradient: 'linear-gradient(135deg,#FFB347,#FFD280)',
    desc: { zh: '即时起卦·决策分析', en: 'Instant Hexagram · Decision Analysis' },
    inputRequired: 'none',           // 自动起卦，无需额外输入
    engine: 'local',
    library: 'custom',               // 自定义起卦算法
    sessionTurns: 8,                 // 一事一卦，对话不宜太长
    greeting: {
      zh: '你好！告诉我你面临的问题或选择，我将即时起卦为你分析。',
      en: 'Hello! Tell me what decision you are facing, and I will cast a hexagram for guidance.'
    },
    systemPrompt: `你是"缘合"的梅花易数分析师。
知识体系：梅花易数、先天八卦、体用生克。
当前卦象（系统自动起卦）：
{{HEXAGRAM_DATA}}
规则：
- 解读要结合用户具体问题
- 给出明确建议和时间窗口
- 一事一卦，不要在同一卦中回答多个无关问题
- 控制在200字内，不提及其他占术`,
  },

  astrology: {
    id: 'astrology',
    name: { zh: '星座运势', en: 'Astrology' },
    icon: '★',
    color: '#7C5CFC',
    gradient: 'linear-gradient(135deg,#7C5CFC,#A78BFA)',
    desc: { zh: '每日运势·星座配对·星盘解读', en: 'Horoscope · Birth Chart · Compatibility' },
    inputRequired: 'birthDate',      // 只需出生日期（基础）或+时间地点（完整星盘）
    engine: 'local',
    library: 'astronomia',           // 天文计算库
    sessionTurns: 15,
    greeting: {
      zh: '你好！我是你的星座顾问。想了解今日运势、星座配对，还是深度星盘解读？',
      en: 'Hi! I\'m here to read your stars. What would you like to explore — love, career, or your overall forecast?'
    },
    systemPrompt: `You are YuanHe's astrology consultant.
Knowledge: Western tropical astrology, zodiac signs, planetary aspects, houses, transits.
User's astrological data (calculated by system):
{{ASTRO_DATA}}
Rules:
- Interpret based on the provided chart data
- Warm and empowering tone, focus on growth and opportunity
- Give actionable advice, keep responses under 200 words
- Do not reference other divination systems
- Respond in {{LANGUAGE}}`,
  },

  tarot: {
    id: 'tarot',
    name: { zh: '塔罗牌', en: 'Tarot' },
    icon: '✦',
    color: '#4ECDC4',
    gradient: 'linear-gradient(135deg,#4ECDC4,#7EDCD5)',
    desc: { zh: '牌阵解读·直觉指引', en: 'Card Spreads · Intuitive Guidance' },
    inputRequired: 'none',           // 前端随机抽牌
    engine: 'frontend',              // 抽牌在前端完成
    library: 'none',
    sessionTurns: 10,
    greeting: {
      zh: '你好！集中心念，告诉我你想探索的问题，我将为你抽牌解读。',
      en: 'Hello! Focus your intention and tell me your question — I\'ll draw cards for your reading.'
    },
    systemPrompt: `You are YuanHe's tarot reader.
Knowledge: Rider-Waite 78-card deck, major/minor arcana, upright/reversed meanings, spreads.
Drawn cards (provided by system, do NOT draw your own):
{{TAROT_CARDS}}
Rules:
- Only interpret the cards provided above
- Connect card meanings to the user's specific question
- Spiritual but grounded — give practical guidance
- Keep responses under 200 words
- Do not reference other divination systems
- Respond in {{LANGUAGE}}`,
  },

  vedic: {
    id: 'vedic',
    name: { zh: '印度占星', en: 'Vedic Astrology' },
    icon: '◎',
    color: '#45B7D1',
    gradient: 'linear-gradient(135deg,#45B7D1,#67D4E8)',
    desc: { zh: '吠陀星盘·行星能量·业力解读', en: 'Kundli · Dasha · Karma' },
    inputRequired: 'birthDateTime',  // 需要精确出生时间和地点
    engine: 'local',
    library: 'swiss-ephemeris',      // 瑞士星历表
    sessionTurns: 15,
    greeting: {
      zh: 'Namaste！我是你的吠陀占星顾问。基于你的出生星盘，我将为你解读行星能量对你人生各方面的影响，并提供切实的化解建议。',
      en: 'Namaste! Based on your Vedic birth chart, I\'ll interpret planetary influences and Dasha periods for you.'
    },
    systemPrompt: `You are YuanHe's Vedic astrology (Jyotish) consultant.
Knowledge: Sidereal zodiac, Nakshatras, Dashas, planetary transits, Kundli houses, Yogas.
User's Vedic chart (calculated by system):
{{VEDIC_CHART}}
Rules:
- Use Sanskrit terms with clear translations in the user's language
- Focus on current Dasha period and active transits
- Suggest practical remedies (gemstones, mantras, colors)
- Keep responses under 200 words
- Do not reference other divination systems
- Respond in {{LANGUAGE}}`,
  },
};


// ============ 区域配置 ============

const REGION_CONFIG = {
  // 中国大陆、港澳台 — 5种全部展示
  CN: {
    language: 'zh',
    currency: 'CNY',
    defaultMode: 'bazi',
  },

  // 美国、加拿大
  US: {
    language: 'en',
    currency: 'USD',
    defaultMode: 'astrology',
  },

  // 欧洲
  EU: {
    language: 'en',
    currency: 'EUR',
    defaultMode: 'astrology',
  },

  // 印度、南亚
  IN: {
    language: 'en',
    currency: 'INR',
    defaultMode: 'vedic',
  },

  // 东南亚（华人多）
  SEA: {
    language: 'en',
    currency: 'USD',
    defaultMode: 'astrology',
  },

  // 其他地区（默认）
  OTHER: {
    language: 'en',
    currency: 'USD',
    defaultMode: 'astrology',
  },
};

// 最终区域模式分配
// 中国展示全部5种，其他区域展示4种
const FINAL_REGION_MODES = {
  CN:    ['bazi', 'astrology', 'tarot', 'meihua', 'vedic'],  // 中国：八字 + 星座运势 + 塔罗 + 梅花易数 + 印度占星（全部5种）
  US:    ['astrology', 'tarot', 'vedic', 'bazi'],             // 美国：星座 + 塔罗 + 印度占星 + 八字(Eastern Astrology)
  EU:    ['astrology', 'tarot', 'vedic', 'meihua'],           // 欧洲：星座 + 塔罗 + 印度占星 + 梅花(I Ching Oracle)
  IN:    ['vedic', 'astrology', 'tarot', 'bazi'],             // 印度：印度占星 + 星座 + 塔罗 + 八字(Chinese Astrology)
  SEA:   ['bazi', 'astrology', 'tarot', 'vedic'],             // 东南亚：八字 + 星座 + 塔罗 + 印度占星
  OTHER: ['astrology', 'tarot', 'vedic', 'meihua'],           // 其他：星座 + 塔罗 + 印度占星 + 梅花(I Ching Oracle)
};


// ============ 区域检测 ============

/**
 * 根据用户信息判断所属区域
 * 优先级：用户手动设置 > 手机号区号 > IP地理位置 > 系统语言
 */
function detectRegion(user) {
  // 1. 用户手动设置
  if (user.preferredRegion) return user.preferredRegion;

  // 2. 手机号区号
  if (user.phone) {
    if (user.phone.startsWith('+86')) return 'CN';
    if (user.phone.startsWith('+1')) return 'US';
    if (user.phone.startsWith('+91')) return 'IN';
    if (user.phone.startsWith('+65') || user.phone.startsWith('+60')) return 'SEA';
    if (user.phone.startsWith('+44') || user.phone.startsWith('+49') || user.phone.startsWith('+33')) return 'EU';
  }

  // 3. IP地理位置（由中间件注入）
  if (user.geoCountry) {
    const cnCountries = ['CN', 'HK', 'MO', 'TW'];
    const seaCountries = ['SG', 'MY', 'TH', 'VN', 'PH', 'ID'];
    const inCountries = ['IN', 'LK', 'NP', 'BD'];
    const euCountries = ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT', 'CH', 'BE', 'PT', 'IE', 'GR'];

    if (cnCountries.includes(user.geoCountry)) return 'CN';
    if (user.geoCountry === 'US' || user.geoCountry === 'CA') return 'US';
    if (inCountries.includes(user.geoCountry)) return 'IN';
    if (seaCountries.includes(user.geoCountry)) return 'SEA';
    if (euCountries.includes(user.geoCountry)) return 'EU';
  }

  // 4. 系统语言
  if (user.language) {
    if (user.language.startsWith('zh')) return 'CN';
    if (user.language.startsWith('hi') || user.language.startsWith('ta')) return 'IN';
  }

  return 'OTHER';
}


// ============ 获取用户的4个可用模式 ============

function getUserModes(user) {
  const region = detectRegion(user);
  const modeIds = FINAL_REGION_MODES[region] || FINAL_REGION_MODES.OTHER;
  const language = ['CN'].includes(region) ? 'zh' : 'en';

  return modeIds.map(id => {
    const mode = ALL_MODES[id];
    return {
      ...mode,
      displayName: mode.name[language],
      displayDesc: mode.desc[language],
      displayGreeting: mode.greeting[language],
      // 注入语言到 system prompt
      resolvedPrompt: mode.systemPrompt.replace('{{LANGUAGE}}', language === 'zh' ? '中文' : 'English'),
    };
  });
}


// ============ API 接口 ============

/**
 * GET /api/divination/modes
 * 返回当前用户可用的4种占术模式
 */
async function getModes(req, res) {
  const modes = getUserModes(req.user);
  res.json({
    region: detectRegion(req.user),
    modes: modes.map(m => ({
      id: m.id,
      name: m.displayName,
      icon: m.icon,
      color: m.color,
      gradient: m.gradient,
      desc: m.displayDesc,
      inputRequired: m.inputRequired,
    })),
  });
}

/**
 * POST /api/divination/chat
 * 在指定模式下发送消息
 */
async function chat(req, res) {
  const { modeId, message, context } = req.body;

  // 验证该用户是否有权访问此模式
  const userModes = getUserModes(req.user);
  const mode = userModes.find(m => m.id === modeId);
  if (!mode) {
    return res.status(403).json({
      error: 'This divination mode is not available in your region',
      availableModes: userModes.map(m => m.id),
    });
  }

  // 调用 AI session manager（复用之前的会话隔离架构）
  const response = await sessionManager.sendMessage(
    req.user.id, modeId, message, req.user.profile, context
  );

  res.json({ modeId, response });
}


// ============ 前端配置接口 ============

/**
 * 前端初始化时调用，获取完整配置
 * GET /api/config
 */
async function getConfig(req, res) {
  const region = detectRegion(req.user);
  const modes = getUserModes(req.user);
  const language = ['CN'].includes(region) ? 'zh' : 'en';

  res.json({
    region,
    language,
    modes: modes.map(m => ({
      id: m.id,
      name: m.displayName,
      icon: m.icon,
      color: m.color,
      gradient: m.gradient,
      desc: m.displayDesc,
      greeting: m.displayGreeting,
    })),
    // Tab栏标签也按语言返回
    tabs: {
      home: language === 'zh' ? '首页' : 'Home',
      discover: language === 'zh' ? '发现' : 'Discover',
      divination: language === 'zh' ? 'AI占卜' : 'AI Oracle',
      messages: language === 'zh' ? '消息' : 'Messages',
      profile: language === 'zh' ? '我的' : 'Profile',
    },
    // 特定文案
    ui: {
      matchTitle: language === 'zh' ? '今日推荐' : "Today's Match",
      swipeRight: language === 'zh' ? '喜欢' : 'LIKE',
      swipeLeft: language === 'zh' ? '跳过' : 'NOPE',
      matchSuccess: language === 'zh' ? '匹配成功！' : 'It\'s a Match!',
      sendMessage: language === 'zh' ? '发消息' : 'Send Message',
    },
  });
}


module.exports = {
  ALL_MODES,
  FINAL_REGION_MODES,
  detectRegion,
  getUserModes,
  getModes,
  chat,
  getConfig,
};
