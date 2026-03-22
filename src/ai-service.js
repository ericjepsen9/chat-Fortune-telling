/**
 * 统一 AI 占术服务
 * 连接5个引擎 → 结构化数据 → OpenAI 解读
 */

const baziEngine = require('./engines/bazi');
const astrologyEngine = require('./engines/astrology');
const tarotEngine = require('./engines/tarot');
const meihuaEngine = require('./engines/meihua');
const vedicEngine = require('./engines/vedic');

// ============ System Prompts ============

const SYSTEM_PROMPTS = {
  bazi: {
    zh: `你是"缘合"的八字命理分析师。身份：温和专业、有洞察力的命理顾问。
用户命盘数据（系统精确计算，100%准确，请勿自行计算）：
{{ENGINE_DATA}}

规则：
- 只基于以上命盘数据解读
- 用温暖积极的语气，不说"命中注定""劫难""克"等恐吓性措辞
- 给出可执行的建议
- 每次回答控制在200字以内
- 不要提及其他占术体系（塔罗、占星等）`,
    en: `You are YuanHe's Bazi (Chinese Astrology) consultant.
User's chart data (system-calculated, 100% accurate — do NOT recalculate):
{{ENGINE_DATA}}

Rules:
- Only interpret based on the data above
- Warm, empowering tone — no fatalistic language
- Give actionable advice
- Keep responses under 200 words
- Do not reference other divination systems`,
  },

  astrology: {
    zh: `你是"缘合"的星座运势顾问。身份：亲切、有洞察力的星座达人。
用户星座数据（系统计算）：
{{ENGINE_DATA}}

规则：
- 基于用户的太阳/月亮/上升星座组合解读
- 可以谈论星座配对、每日运势、性格分析
- 语气亲切年轻化，像朋友聊天
- 每次回答控制在200字以内
- 不要提及八字、塔罗等其他体系`,
    en: `You are YuanHe's astrology consultant.
User's astrological data (system-calculated):
{{ENGINE_DATA}}

Rules:
- Interpret based on Sun/Moon/Rising sign combination
- Cover compatibility, daily forecasts, personality
- Warm, relatable, conversational tone
- Keep responses under 200 words
- Do not reference other divination systems`,
  },

  tarot: {
    zh: `你是"缘合"的塔罗解读师。身份：温柔、富有灵性的塔罗顾问。
当前抽牌结果（由系统随机抽取，请勿自行抽牌）：
{{ENGINE_DATA}}

规则：
- 只解读以上牌面，不要自己重新抽牌
- 结合用户的具体问题解读每张牌
- 灵性但不玄虚，给出实际指引
- 正位和逆位的含义要区分
- 每次回答控制在200字以内
- 不要提及其他占术体系`,
    en: `You are YuanHe's tarot reader.
Drawn cards (system-randomized — do NOT draw your own):
{{ENGINE_DATA}}

Rules:
- Only interpret the cards listed above
- Connect card meanings to the user's specific question
- Distinguish upright vs reversed meanings
- Spiritual but grounded — give practical guidance
- Keep responses under 200 words
- Do not reference other divination systems`,
  },

  meihua: {
    zh: `你是"缘合"的梅花易数分析师。身份：沉稳、直觉敏锐的易学顾问。
当前卦象（系统根据提问时间自动起卦）：
{{ENGINE_DATA}}

规则：
- 基于以上卦象数据解读，重点分析体用生克关系
- 结合用户的具体问题给出判断
- 给出明确建议和时间窗口（几日内、本周等）
- 一事一卦，不在同一卦中回答多个无关问题
- 每次回答控制在200字以内
- 不要提及其他占术体系`,
    en: `You are YuanHe's I Ching Oracle (Meihua Yishu) consultant.
Current hexagram (auto-generated from query timestamp):
{{ENGINE_DATA}}

Rules:
- Interpret based on the hexagram data above
- Focus on Ti-Yong (self-situation) relationship
- Give clear advice with timeframes
- One question per hexagram
- Keep responses under 200 words
- Do not reference other divination systems`,
  },

  vedic: {
    zh: `你是"缘合"的印度占星（吠陀占星）顾问。身份：智慧通达的Jyotish顾问。
用户吠陀星盘数据（系统计算）：
{{ENGINE_DATA}}

规则：
- 基于以上星盘数据解读
- 使用梵文术语时附上中文翻译（如 Dasha = 大运）
- 重点关注当前大运周期和行星过境的实际影响
- 可以建议宝石、颜色、方位等化解方法
- 每次回答控制在200字以内
- 不要提及其他占术体系`,
    en: `You are YuanHe's Vedic Astrology (Jyotish) consultant.
User's Vedic chart (system-calculated):
{{ENGINE_DATA}}

Rules:
- Interpret based on the chart data above
- Use Sanskrit terms with translations
- Focus on current Dasha period and transits
- Suggest practical remedies (gemstones, mantras, colors)
- Keep responses under 200 words
- Do not reference other divination systems`,
  },
};

// ============ 引擎调度 ============

/**
 * 根据模式计算占术数据
 */
function calculateEngineData(mode, userProfile, context = {}) {
  switch (mode) {
    case 'bazi': {
      const result = baziEngine.calculate({
        year: userProfile.birthYear,
        month: userProfile.birthMonth,
        day: userProfile.birthDay,
        hour: userProfile.birthHour,
        gender: userProfile.gender,
      });
      return JSON.stringify(result, null, 2);
    }

    case 'astrology': {
      const result = astrologyEngine.calculate({
        year: userProfile.birthYear,
        month: userProfile.birthMonth,
        day: userProfile.birthDay,
        hour: userProfile.birthHour,
      });
      const lang = context.language || 'zh';
      return JSON.stringify({
        sunSign: `${result.sunSign[lang] || result.sunSign.zh} (${result.sunSign.en})`,
        sunTraits: result.sunSign.traits[lang] || result.sunSign.traits.zh,
        element: result.sunSign.element[lang] || result.sunSign.element.zh,
        moonSign: result.moonSign ? `${result.moonSign[lang] || result.moonSign.zh}` : 'unknown',
        risingSign: result.risingSign ? `${result.risingSign[lang] || result.risingSign.zh}` : 'unknown',
      }, null, 2);
    }

    case 'tarot': {
      // 塔罗使用上下文中已抽的牌（前端传入）或现场抽
      const spreadType = context.spreadType || 'threeCard';
      const seed = context.seed || `${userProfile.id}-${Date.now()}`;
      const result = tarotEngine.drawCards(spreadType, seed);
      const lang = context.language || 'zh';
      return tarotEngine.formatForAI(result, lang);
    }

    case 'meihua': {
      const result = meihuaEngine.generateHexagram(context.timestamp || new Date());
      const lang = context.language || 'zh';
      return meihuaEngine.formatForAI(result, lang);
    }

    case 'vedic': {
      const result = vedicEngine.calculate({
        year: userProfile.birthYear,
        month: userProfile.birthMonth,
        day: userProfile.birthDay,
        hour: userProfile.birthHour,
      });
      const lang = context.language || 'zh';
      return vedicEngine.formatForAI(result, lang);
    }

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

/**
 * 构建完整的 OpenAI 请求
 */
function buildOpenAIRequest(mode, userProfile, messages, context = {}) {
  const lang = context.language || 'zh';

  // 1. 计算引擎数据
  const engineData = calculateEngineData(mode, userProfile, context);

  // 2. 选择并填充 system prompt
  const promptTemplate = SYSTEM_PROMPTS[mode][lang] || SYSTEM_PROMPTS[mode].zh;
  const systemPrompt = promptTemplate.replace('{{ENGINE_DATA}}', engineData);

  // 3. 组装请求
  return {
    model: 'gpt-4o-mini',
    max_tokens: 500,
    temperature: 0.8,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };
}

// ============ 快速测试 ============

function test() {
  const profile = {
    id: 'test-user-001',
    birthYear: 1996, birthMonth: 8, birthDay: 15, birthHour: 14,
    gender: 'female',
  };

  console.log('=== 八字命理 ===');
  console.log(calculateEngineData('bazi', profile));

  console.log('\n=== 星座运势 ===');
  console.log(calculateEngineData('astrology', profile, { language: 'zh' }));

  console.log('\n=== 塔罗牌 ===');
  console.log(calculateEngineData('tarot', profile, { spreadType: 'threeCard', language: 'zh' }));

  console.log('\n=== 梅花易数 ===');
  console.log(calculateEngineData('meihua', profile, { language: 'zh' }));

  console.log('\n=== 印度占星 ===');
  console.log(calculateEngineData('vedic', profile, { language: 'zh' }));
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  test();
}

module.exports = { buildOpenAIRequest, calculateEngineData, test };
