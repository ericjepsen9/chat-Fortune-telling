/**
 * 塔罗牌引擎
 * 完整78张韦特塔罗牌 + 牌阵 + 抽牌逻辑
 */

// 大阿尔卡那 22张
const MAJOR_ARCANA = [
  { id: 0, name: { zh: '愚者', en: 'The Fool' }, keywords: { zh: ['新开始', '冒险', '自由', '天真'], en: ['New beginnings', 'Adventure', 'Freedom', 'Innocence'] } },
  { id: 1, name: { zh: '魔术师', en: 'The Magician' }, keywords: { zh: ['创造力', '意志力', '技能', '掌控'], en: ['Manifestation', 'Willpower', 'Skill', 'Mastery'] } },
  { id: 2, name: { zh: '女祭司', en: 'The High Priestess' }, keywords: { zh: ['直觉', '潜意识', '神秘', '内在智慧'], en: ['Intuition', 'Subconscious', 'Mystery', 'Inner wisdom'] } },
  { id: 3, name: { zh: '女皇', en: 'The Empress' }, keywords: { zh: ['丰盛', '母性', '自然', '滋养'], en: ['Abundance', 'Nurturing', 'Nature', 'Fertility'] } },
  { id: 4, name: { zh: '皇帝', en: 'The Emperor' }, keywords: { zh: ['权威', '秩序', '领导', '稳定'], en: ['Authority', 'Structure', 'Leadership', 'Stability'] } },
  { id: 5, name: { zh: '教皇', en: 'The Hierophant' }, keywords: { zh: ['传统', '信仰', '教导', '精神指引'], en: ['Tradition', 'Faith', 'Teaching', 'Guidance'] } },
  { id: 6, name: { zh: '恋人', en: 'The Lovers' }, keywords: { zh: ['爱情', '选择', '和谐', '价值观'], en: ['Love', 'Choices', 'Harmony', 'Values'] } },
  { id: 7, name: { zh: '战车', en: 'The Chariot' }, keywords: { zh: ['决心', '胜利', '意志', '控制'], en: ['Determination', 'Victory', 'Willpower', 'Control'] } },
  { id: 8, name: { zh: '力量', en: 'Strength' }, keywords: { zh: ['勇气', '耐心', '内在力量', '柔中带刚'], en: ['Courage', 'Patience', 'Inner strength', 'Compassion'] } },
  { id: 9, name: { zh: '隐者', en: 'The Hermit' }, keywords: { zh: ['独处', '内省', '智慧', '寻找真理'], en: ['Solitude', 'Introspection', 'Wisdom', 'Soul-searching'] } },
  { id: 10, name: { zh: '命运之轮', en: 'Wheel of Fortune' }, keywords: { zh: ['转折', '机遇', '命运', '循环'], en: ['Change', 'Destiny', 'Cycles', 'Turning point'] } },
  { id: 11, name: { zh: '正义', en: 'Justice' }, keywords: { zh: ['公平', '真相', '因果', '平衡'], en: ['Fairness', 'Truth', 'Karma', 'Balance'] } },
  { id: 12, name: { zh: '倒吊人', en: 'The Hanged Man' }, keywords: { zh: ['放手', '新视角', '等待', '牺牲'], en: ['Letting go', 'New perspective', 'Pause', 'Sacrifice'] } },
  { id: 13, name: { zh: '死神', en: 'Death' }, keywords: { zh: ['结束', '转变', '重生', '放下旧的'], en: ['Transformation', 'Endings', 'Rebirth', 'Release'] } },
  { id: 14, name: { zh: '节制', en: 'Temperance' }, keywords: { zh: ['平衡', '耐心', '调和', '适度'], en: ['Balance', 'Patience', 'Moderation', 'Harmony'] } },
  { id: 15, name: { zh: '恶魔', en: 'The Devil' }, keywords: { zh: ['束缚', '执念', '诱惑', '阴影面'], en: ['Bondage', 'Addiction', 'Temptation', 'Shadow self'] } },
  { id: 16, name: { zh: '塔', en: 'The Tower' }, keywords: { zh: ['突变', '觉醒', '打破', '重建'], en: ['Upheaval', 'Awakening', 'Destruction', 'Revelation'] } },
  { id: 17, name: { zh: '星星', en: 'The Star' }, keywords: { zh: ['希望', '灵感', '宁静', '信心'], en: ['Hope', 'Inspiration', 'Serenity', 'Faith'] } },
  { id: 18, name: { zh: '月亮', en: 'The Moon' }, keywords: { zh: ['幻觉', '恐惧', '潜意识', '直觉'], en: ['Illusion', 'Fear', 'Subconscious', 'Intuition'] } },
  { id: 19, name: { zh: '太阳', en: 'The Sun' }, keywords: { zh: ['快乐', '成功', '活力', '光明'], en: ['Joy', 'Success', 'Vitality', 'Clarity'] } },
  { id: 20, name: { zh: '审判', en: 'Judgement' }, keywords: { zh: ['觉醒', '反思', '重生', '召唤'], en: ['Rebirth', 'Reflection', 'Reckoning', 'Calling'] } },
  { id: 21, name: { zh: '世界', en: 'The World' }, keywords: { zh: ['圆满', '完成', '成就', '旅程终点'], en: ['Completion', 'Achievement', 'Wholeness', 'Travel'] } },
];

// 小阿尔卡那花色
const SUITS = [
  { id: 'wands', zh: '权杖', en: 'Wands', element: 'fire', theme: { zh: '行动·激情·创造', en: 'Action · Passion · Creativity' } },
  { id: 'cups', zh: '圣杯', en: 'Cups', element: 'water', theme: { zh: '情感·关系·直觉', en: 'Emotions · Relationships · Intuition' } },
  { id: 'swords', zh: '宝剑', en: 'Swords', element: 'air', theme: { zh: '思维·冲突·真相', en: 'Intellect · Conflict · Truth' } },
  { id: 'pentacles', zh: '星币', en: 'Pentacles', element: 'earth', theme: { zh: '物质·金钱·健康', en: 'Material · Wealth · Health' } },
];

// 生成完整56张小阿尔卡那
const COURT_NAMES = [
  { rank: 'page', zh: '侍从', en: 'Page' },
  { rank: 'knight', zh: '骑士', en: 'Knight' },
  { rank: 'queen', zh: '王后', en: 'Queen' },
  { rank: 'king', zh: '国王', en: 'King' },
];

function buildMinorArcana() {
  const cards = [];
  let id = 22;
  SUITS.forEach(suit => {
    // 数字牌 Ace-10
    for (let num = 1; num <= 10; num++) {
      const numName = num === 1 ? { zh: '王牌', en: 'Ace' } : { zh: `${num}`, en: `${num}` };
      cards.push({
        id: id++,
        name: { zh: `${suit.zh}${numName.zh}`, en: `${numName.en} of ${suit.en}` },
        suit: suit.id,
        number: num,
        type: 'number',
      });
    }
    // 宫廷牌
    COURT_NAMES.forEach(court => {
      cards.push({
        id: id++,
        name: { zh: `${suit.zh}${court.zh}`, en: `${court.en} of ${suit.en}` },
        suit: suit.id,
        type: 'court',
        rank: court.rank,
      });
    });
  });
  return cards;
}

const MINOR_ARCANA = buildMinorArcana();
const FULL_DECK = [...MAJOR_ARCANA.map(c => ({ ...c, type: 'major' })), ...MINOR_ARCANA];

// 牌阵定义
const SPREADS = {
  single: {
    name: { zh: '单张指引', en: 'Single Card' },
    positions: [{ zh: '指引', en: 'Guidance' }],
    cardCount: 1,
  },
  threeCard: {
    name: { zh: '三张牌阵', en: 'Three Card Spread' },
    positions: [
      { zh: '过去', en: 'Past' },
      { zh: '现在', en: 'Present' },
      { zh: '未来', en: 'Future' },
    ],
    cardCount: 3,
  },
  relationship: {
    name: { zh: '关系牌阵', en: 'Relationship Spread' },
    positions: [
      { zh: '你', en: 'You' },
      { zh: '对方', en: 'The Other' },
      { zh: '关系', en: 'The Relationship' },
      { zh: '建议', en: 'Advice' },
    ],
    cardCount: 4,
  },
  celticCross: {
    name: { zh: '凯尔特十字', en: 'Celtic Cross' },
    positions: [
      { zh: '现状', en: 'Present' },
      { zh: '挑战', en: 'Challenge' },
      { zh: '根源', en: 'Foundation' },
      { zh: '过去', en: 'Past' },
      { zh: '可能', en: 'Possibility' },
      { zh: '近未来', en: 'Near Future' },
      { zh: '自我', en: 'Self' },
      { zh: '环境', en: 'Environment' },
      { zh: '希望/恐惧', en: 'Hopes/Fears' },
      { zh: '结果', en: 'Outcome' },
    ],
    cardCount: 10,
  },
};

/**
 * 随机抽牌（带正逆位）
 */
function drawCards(spreadType = 'threeCard', seed) {
  const spread = SPREADS[spreadType] || SPREADS.threeCard;
  const count = spread.cardCount;

  // 洗牌（Fisher-Yates）
  const deck = [...FULL_DECK];
  const rng = seed ? seededRandom(seed) : Math.random;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // 抽取并决定正逆位
  const drawn = deck.slice(0, count).map((card, idx) => ({
    ...card,
    position: spread.positions[idx],
    reversed: rng() > 0.7,  // 约30%概率逆位
  }));

  return {
    spread: { name: spread.name, type: spreadType },
    cards: drawn,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 可重复的伪随机（用于同一用户同一天得到相同结果）
 */
function seededRandom(seed) {
  let s = typeof seed === 'string' ? hashCode(seed) : seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 格式化抽牌结果为AI可读文本
 */
function formatForAI(result, lang = 'zh') {
  return result.cards.map(card => {
    const name = card.name[lang];
    const pos = card.position[lang];
    const rev = card.reversed ? (lang === 'zh' ? '（逆位）' : '(Reversed)') : (lang === 'zh' ? '（正位）' : '(Upright)');
    const kw = card.keywords ? card.keywords[lang].join(', ') : '';
    return `${pos}: ${name} ${rev}${kw ? ` — ${kw}` : ''}`;
  }).join('\n');
}

module.exports = { drawCards, formatForAI, FULL_DECK, SPREADS, MAJOR_ARCANA };
