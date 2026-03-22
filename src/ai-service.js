/**
 * 统一 AI 占术服务 v2
 * 修复：塔罗种子稳定 | 双模式输出 | 更精准的 prompt
 */
const baziEngine = require('./engines/bazi');
const astrologyEngine = require('./engines/astrology');
const tarotEngine = require('./engines/tarot');
const meihuaEngine = require('./engines/meihua');
const vedicEngine = require('./engines/vedic');

// ============ 双模式 System Prompt ============
const PROMPTS = {
  bazi: {
    expert: `你是专业八字命理师。以下是系统精确排出的完整命盘，请基于此数据进行专业解读。
要求：使用命理术语（十神、神煞、格局、体用等），但每个术语后用括号简要解释含义。分析层次：格局定性→日主强弱→用神方向→神煞影响→地支关系→综合建议。控制在300字内。

{{DATA}}`,
    simple: `你是温暖的命理顾问"缘合"。以下是用户的命理分析结果，请用通俗易懂的方式解读给用户。
要求：不使用专业术语，用比喻和日常语言。重点讲性格特点、优势、需要注意的地方，以及可行动的建议。语气像朋友聊天，温暖有洞察力。控制在200字内。

{{DATA}}`,
  },
  astrology: {
    expert: `你是专业占星师。以下是用户的星盘核心数据，请从太阳、月亮、上升的三重组合角度进行专业解读。
要求：分析元素平衡、守护星影响、日月协调度。可提及相位和宫位概念。控制在300字内。

{{DATA}}`,
    simple: `你是"缘合"的星座顾问。以下是用户的星座信息，请用轻松亲切的方式解读。
要求：像朋友聊天一样自然，可以用"你是那种……的人"这类表达。重点讲性格、感情倾向、与他人的互动方式。控制在200字内。

{{DATA}}`,
  },
  tarot: {
    expert: `你是资深塔罗解读师。以下是系统已抽出的牌面（请勿自行重新抽牌），请进行专业解读。
要求：逐张分析牌面含义（区分正逆位），注意牌与牌之间的关联和故事线，给出整体牌阵叙事。结合用户问题给出具体建议。控制在300字内。

{{DATA}}`,
    simple: `你是"缘合"的塔罗顾问。以下是为用户抽出的牌面（已经抽好了，不要重新抽），请用温柔直觉的方式解读。
要求：不要逐张罗列含义，而是讲一个连贯的故事——过去发生了什么、现在的状态、未来的走向。语气有灵性但不玄虚，给出实际可行的建议。控制在200字内。

{{DATA}}`,
  },
  meihua: {
    expert: `你是梅花易数专家。以下是系统根据提问时间自动起的卦，请进行专业解读。
要求：重点分析体用关系（生克比和）、动爻含义、变卦走向。给出时间窗口判断和明确建议。控制在300字内。

{{DATA}}`,
    simple: `你是"缘合"的易学顾问。以下是根据你提问的时间为你起的卦象，请用通俗方式解读。
要求：不要讲太多术语，重点说"这件事的结果大概率是……""建议你……""时机方面……"。语气沉稳有力量感。控制在200字内。

{{DATA}}`,
  },
  vedic: {
    expert: `你是Jyotish（吠陀占星）专家。以下是用户的吠陀星盘数据，请进行专业解读。
要求：分析Rashi、Nakshatra特质，重点解读当前Dasha大运对命主的影响。可建议宝石、颜色、方位等remedies。梵文术语后附中文翻译。控制在300字内。

{{DATA}}`,
    simple: `你是"缘合"的印度占星顾问。以下是用户的吠陀星盘信息，请用中文通俗解读。
要求：不要堆砌梵文术语，重点讲"你现在处于什么人生阶段""这个阶段的重心是什么""可以做什么来提升运势"。语气有智慧感。控制在200字内。

{{DATA}}`,
  },
};

// ============ 引擎调度（确定性） ============
function calculateEngineData(mode, userProfile, context = {}) {
  const displayMode = context.displayMode || 'simple'; // 'expert' | 'simple'

  switch (mode) {
    case 'bazi': {
      const result = baziEngine.calculate({
        year: userProfile.birthYear || userProfile.year,
        month: userProfile.birthMonth || userProfile.month,
        day: userProfile.birthDay || userProfile.day,
        hour: userProfile.birthHour || userProfile.hour,
        gender: userProfile.gender,
      });
      return baziEngine.formatForAI(result, displayMode);
    }
    case 'astrology': {
      const result = astrologyEngine.calculate({
        year: userProfile.birthYear || userProfile.year,
        month: userProfile.birthMonth || userProfile.month,
        day: userProfile.birthDay || userProfile.day,
        hour: userProfile.birthHour || userProfile.hour,
      });
      return astrologyEngine.formatForAI(result, displayMode);
    }
    case 'tarot': {
      const spreadType = context.spreadType || 'threeCard';
      // 稳定种子：同一用户 + 同一天 = 同一结果
      const userId = userProfile.id || `${userProfile.birthYear}-${userProfile.birthMonth}-${userProfile.birthDay}`;
      const seed = context.seed || tarotEngine.stableSeed(userId, new Date());
      const result = tarotEngine.drawCards(spreadType, seed);
      return tarotEngine.formatForAI(result, displayMode);
    }
    case 'meihua': {
      // 梅花用时间起卦，同一时辰内结果相同（这是正确行为）
      const result = meihuaEngine.generateHexagram(context.timestamp || new Date());
      return meihuaEngine.formatForAI(result, displayMode);
    }
    case 'vedic': {
      const result = vedicEngine.calculate({
        year: userProfile.birthYear || userProfile.year,
        month: userProfile.birthMonth || userProfile.month,
        day: userProfile.birthDay || userProfile.day,
        hour: userProfile.birthHour || userProfile.hour,
      });
      return vedicEngine.formatForAI(result, displayMode);
    }
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

// ============ 构建 OpenAI 请求 ============
function buildOpenAIRequest(mode, userProfile, messages, context = {}) {
  const displayMode = context.displayMode || 'simple';
  const engineData = calculateEngineData(mode, userProfile, context);
  const promptTemplate = PROMPTS[mode][displayMode];
  const systemPrompt = promptTemplate.replace('{{DATA}}', engineData);

  return {
    model: context.model || 'gpt-4o-mini',
    max_tokens: displayMode === 'expert' ? 800 : 500,
    temperature: 0.75, // 略低温度提高一致性
    stream: context.stream !== false,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };
}

// ============ 测试 ============
function test() {
  const profile = { birthYear: 1996, birthMonth: 8, birthDay: 15, birthHour: 14, gender: 'female', id: 'test-001' };

  console.log('===== 八字（专家模式） =====');
  console.log(calculateEngineData('bazi', profile, { displayMode: 'expert' }));
  console.log('\n===== 八字（大众模式） =====');
  console.log(calculateEngineData('bazi', profile, { displayMode: 'simple' }));

  console.log('\n===== 塔罗（稳定性测试：同一天同一用户两次调用） =====');
  const t1 = calculateEngineData('tarot', profile, { displayMode: 'simple' });
  const t2 = calculateEngineData('tarot', profile, { displayMode: 'simple' });
  console.log('第1次:', t1.split('\n')[2]);
  console.log('第2次:', t2.split('\n')[2]);
  console.log('结果一致:', t1 === t2);

  console.log('\n===== 梅花（专家模式） =====');
  console.log(calculateEngineData('meihua', profile, { displayMode: 'expert' }));

  console.log('\n===== 星座（大众模式） =====');
  console.log(calculateEngineData('astrology', profile, { displayMode: 'simple' }));

  console.log('\n===== 印度占星（大众模式） =====');
  console.log(calculateEngineData('vedic', profile, { displayMode: 'simple' }));
}

if (require.main === module) test();
module.exports = { buildOpenAIRequest, calculateEngineData, test };
