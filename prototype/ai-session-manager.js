/**
 * 缘合 AI 会话管理器
 * 核心设计：每个占术模式维护独立会话，共享用户画像
 */

// ============ 1. 四套独立的 System Prompt ============

const SYSTEM_PROMPTS = {
  bazi: `你是"缘合"APP的八字命理分析师。
身份：温和、专业、有洞察力的命理顾问。
知识体系：四柱八字、五行生克、十神关系、大运流年。

用户的八字命盘数据（由系统精确计算，100%准确，不要质疑或重新计算）：
{{BAZI_DATA}}

规则：
- 只基于上面的命盘数据进行解读，不要自己编造八字
- 用温暖积极的语气，不说"命中注定"、"劫难"等极端措辞
- 给出可执行的建议，不只是笼统的描述
- 每次回答控制在200字以内
- 不要提及其他占术体系（塔罗、占星等）`,

  meihua: `你是"缘合"APP的梅花易数分析师。
身份：沉稳、直觉敏锐的易学顾问。
知识体系：梅花易数、先天八卦、体用生克。

用户的基本信息：
{{USER_PROFILE}}

规则：
- 用户提问时，根据当前时间自动起卦（系统会提供卦象数据）
- 解读要结合用户的具体问题，不要泛泛而谈
- 给出明确的建议和时间窗口
- 每次回答控制在200字以内
- 不要提及其他占术体系`,

  tarot: `你是"缘合"APP的塔罗解读师。
身份：温柔、富有灵性、善于引导的塔罗顾问。
知识体系：韦特塔罗78张牌、正逆位解读、牌阵组合。

用户的基本信息：
{{USER_PROFILE}}

当前牌阵：
{{TAROT_CARDS}}

规则：
- 只解读系统提供的已抽牌面，不要自己随机抽牌
- 牌面解读要结合用户的具体问题
- 语气灵性但不玄虚，要给出实际指引
- 每次回答控制在200字以内
- 不要提及其他占术体系`,

  vedic: `你是"缘合"APP的吠陀占星师。
身份：智慧、通达的印度占星顾问。
知识体系：吠陀占星（Jyotish）、星盘（Kundli）、达沙系统、行星过境。

用户的星盘数据：
{{VEDIC_CHART}}

规则：
- 基于系统提供的星盘数据解读，适当使用梵文术语但要附中文解释
- 关注当前达沙周期和行星过境的实际影响
- 给出可执行的补救措施建议
- 每次回答控制在200字以内
- 不要提及其他占术体系`,
};


// ============ 2. 会话管理器 ============

class AISessionManager {
  constructor(redisClient, openaiClient) {
    this.redis = redisClient;
    this.openai = openaiClient;

    // 每个模式的最大对话轮数（超过后自动截断早期消息）
    this.MAX_TURNS = {
      bazi: 20,    // 八字可以深入聊
      meihua: 8,   // 梅花一事一卦，不宜太长
      tarot: 10,   // 塔罗围绕一次牌阵
      vedic: 15,   // 星盘解读可以较深入
    };
  }

  /**
   * 获取某个模式的会话 key
   * 每个用户 × 每个模式 = 一个独立的会话
   */
  _sessionKey(userId, mode) {
    return `ai_session:${userId}:${mode}`;
  }

  /**
   * 获取当前模式的消息历史
   */
  async getMessages(userId, mode) {
    const key = this._sessionKey(userId, mode);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : [];
  }

  /**
   * 保存消息历史（自动截断超出限制的早期消息）
   */
  async saveMessages(userId, mode, messages) {
    const key = this._sessionKey(userId, mode);
    const maxTurns = this.MAX_TURNS[mode] || 10;

    // 保留最近 N 轮对话（1轮 = 1条user + 1条assistant）
    const maxMessages = maxTurns * 2;
    const trimmed = messages.length > maxMessages
      ? messages.slice(-maxMessages)
      : messages;

    // 会话 24 小时过期，第二天自动清空重新开始
    await this.redis.set(key, JSON.stringify(trimmed), 'EX', 86400);
    return trimmed;
  }

  /**
   * 清空某个模式的会话（用户手动"开始新对话"）
   */
  async clearSession(userId, mode) {
    const key = this._sessionKey(userId, mode);
    await this.redis.del(key);
  }

  /**
   * 构建完整的 OpenAI 请求
   * 这是核心——每次请求都重新组装：system_prompt + 模式上下文 + 消息历史
   */
  buildRequest(mode, userProfile, modeContext, messages) {
    // 1. 选择对应模式的 system prompt
    let systemPrompt = SYSTEM_PROMPTS[mode];

    // 2. 注入用户画像数据（所有模式共享）
    const profileStr = JSON.stringify({
      name: userProfile.name,
      gender: userProfile.gender,
      bazi: userProfile.bazi,        // 四柱八字
      wuxing: userProfile.wuxing,    // 五行分布
      shishen: userProfile.shishen,  // 十神
      geju: userProfile.geju,        // 格局
      tags: userProfile.tags,        // 性格标签
    }, null, 2);

    systemPrompt = systemPrompt
      .replace('{{BAZI_DATA}}', profileStr)
      .replace('{{USER_PROFILE}}', profileStr)
      .replace('{{TAROT_CARDS}}', JSON.stringify(modeContext.drawnCards || []))
      .replace('{{VEDIC_CHART}}', JSON.stringify(modeContext.chartData || {}));

    // 3. 组装最终请求
    return {
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.8,
      stream: true,  // 流式输出
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    };
  }

  /**
   * 发送消息（主入口）
   */
  async sendMessage(userId, mode, userMessage, userProfile, modeContext = {}) {
    // 1. 获取当前模式的历史消息
    const messages = await this.getMessages(userId, mode);

    // 2. 添加用户新消息
    messages.push({ role: 'user', content: userMessage });

    // 3. 构建请求（只包含当前模式的历史，不会混入其他模式）
    const request = this.buildRequest(mode, userProfile, modeContext, messages);

    // 4. 调用 OpenAI（流式）
    const stream = await this.openai.chat.completions.create(request);

    // 5. 收集完整回复并保存
    let fullResponse = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullResponse += delta;
      // 这里可以通过 WebSocket 实时推送给前端
    }

    // 6. 保存助手回复到当前模式的历史
    messages.push({ role: 'assistant', content: fullResponse });
    await this.saveMessages(userId, mode, messages);

    return fullResponse;
  }
}


// ============ 3. API 路由示例 ============

/*
  POST /api/ai/chat
  Body: {
    mode: "bazi" | "meihua" | "tarot" | "vedic",
    message: "我的感情运势如何？",
    modeContext: { ... }  // 可选，塔罗传已抽牌面等
  }
*/
async function handleAIChat(req, res) {
  const { mode, message, modeContext } = req.body;
  const userId = req.user.id;

  // 验证模式合法性
  const validModes = ['bazi', 'meihua', 'tarot', 'vedic'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  // 获取用户画像（从数据库，包含八字数据）
  const userProfile = await getUserProfile(userId);

  // 模式特殊处理
  let context = modeContext || {};
  if (mode === 'meihua' && !context.hexagram) {
    // 梅花易数：自动根据当前时间起卦
    context.hexagram = generateHexagram(new Date());
  }

  // 发送消息
  const sessionManager = new AISessionManager(redis, openai);
  const response = await sessionManager.sendMessage(
    userId, mode, message, userProfile, context
  );

  res.json({ mode, response });
}


// ============ 4. 前端切换模式的处理 ============

/*
  前端伪代码——切换模式时的行为：
  
  function switchMode(newMode) {
    // 不清空任何东西！只是切换当前显示的消息列表
    currentMode = newMode;
    
    // 从本地缓存或服务端加载该模式的历史消息
    messages = localCache[newMode] || await fetchHistory(newMode);
    
    // 如果该模式没有历史消息，显示该模式的欢迎语
    if (messages.length === 0) {
      showGreeting(newMode);
    }
    
    // 渲染消息列表
    renderMessages(messages);
  }

  关键点：
  - 切换模式 ≠ 清空对话
  - 用户切回之前的模式，历史消息还在
  - 每个模式的消息列表在前端也是独立的 Map<mode, messages[]>
*/


// ============ 5. 梅花易数的特殊处理 ============

/**
 * 梅花易数起卦
 * 基于时间自动生成卦象，不需要用户手动操作
 */
function generateHexagram(date) {
  // 用时间数字起卦（时间起卦法）
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 上卦 = (年+月+日) % 8，下卦 = (年+月+日+时) % 8
  // 动爻 = (年+月+日+时) % 6
  const upperNum = (year + month + day) % 8 || 8;
  const lowerNum = (year + month + day + hour) % 8 || 8;
  const changingLine = (year + month + day + hour) % 6 || 6;

  const trigrams = ['坤', '震', '坎', '兑', '艮', '离', '巽', '乾'];

  return {
    upper: trigrams[upperNum - 1],
    lower: trigrams[lowerNum - 1],
    changingLine,
    timestamp: date.toISOString(),
  };
}


// ============ 6. 塔罗牌的特殊处理 ============

/**
 * 塔罗抽牌
 * 前端完成抽牌动画后，把结果传给后端
 * 后端不负责抽牌，只负责解读
 */
function prepareTarotContext(drawnCards) {
  // drawnCards 由前端传入，例如：
  // [
  //   { position: "过去", name: "星星", reversed: false },
  //   { position: "现在", name: "月亮", reversed: true },
  //   { position: "未来", name: "太阳", reversed: false }
  // ]

  return {
    drawnCards,
    spread: drawnCards.length === 1 ? '单张' : '三张牌阵',
    // 牌面数据在 system prompt 中注入
    // AI 只负责结合用户问题解读这些牌面
  };
}


// ============ 7. 防止跨模式污染的安全检查 ============

/**
 * 检测用户消息中是否在错误的模式下提问
 * 比如在塔罗模式说"帮我看八字"
 */
const MODE_KEYWORDS = {
  bazi: ['八字', '命盘', '四柱', '五行', '十神', '大运', '流年', '日主'],
  meihua: ['起卦', '梅花', '体卦', '用卦', '卦象', '爻'],
  tarot: ['塔罗', '抽牌', '牌阵', '正位', '逆位', '大阿卡纳'],
  vedic: ['星盘', '占星', '达沙', '行星', '宫位', '纳克沙特拉'],
};

function detectModeMismatch(currentMode, userMessage) {
  for (const [mode, keywords] of Object.entries(MODE_KEYWORDS)) {
    if (mode === currentMode) continue;
    const matched = keywords.filter(kw => userMessage.includes(kw));
    if (matched.length >= 2) {
      return {
        mismatch: true,
        suggestedMode: mode,
        hint: `您似乎想问${
          { bazi: '八字命理', meihua: '梅花易数', tarot: '塔罗', vedic: '印度占星' }[mode]
        }相关的问题，要切换过去吗？`,
      };
    }
  }
  return { mismatch: false };
}


// ============ 8. 数据库结构 ============

/*
  -- 会话不需要持久存储到数据库
  -- 用 Redis 存储，24小时自动过期
  -- 只有"收藏的解读"才存到数据库

  CREATE TABLE saved_readings (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    mode        VARCHAR(10) NOT NULL,  -- bazi/meihua/tarot/vedic
    question    TEXT,
    answer      TEXT,
    context     JSONB,  -- 卦象/牌面/星盘数据
    created_at  TIMESTAMP DEFAULT NOW()
  );

  -- 用户可以收藏某条 AI 解读
  -- 前端长按消息 → "收藏这条解读"
*/

module.exports = { AISessionManager, generateHexagram, detectModeMismatch };
