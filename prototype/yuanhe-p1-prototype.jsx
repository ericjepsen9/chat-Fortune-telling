import { useState, useEffect, useRef, useCallback } from "react";

// ============ CONSTANTS ============
const SCREENS = {
  SPLASH: "splash",
  ONBOARD_1: "onboard1",
  ONBOARD_2: "onboard2",
  ONBOARD_3: "onboard3",
  BIRTH_INFO: "birthInfo",
  ANALYSIS: "analysis",
  HOME: "home",
  CARDS: "cards",
  CARD_DETAIL: "cardDetail",
  DAILY: "daily",
  MATCH: "match",
  CHAT: "chat",
  FRIEND_CHAT: "friendChat",
  CHAT_LIST: "chatList",
  AI_CHAT: "aiChat",
  COMMUNITY: "community",
  PROFILE: "profile",
  TASKS: "tasks",
  ADD_FRIEND: "addFriend",
};

const FIVE_ELEMENTS = ["金", "木", "水", "火", "土"];
const ELEMENT_COLORS = { 金: "#C9A96E", 木: "#6BAF7B", 水: "#5B8FB9", 火: "#D4654A", 土: "#B8935A" };

const AI_MODES = [
  { id: "bazi", name: "八字命理", icon: "☰", color: "#C9A96E", desc: "四柱八字·五行十神", greeting: "你好，我是八字命理AI。基于你的四柱八字，我可以为你解读命局、分析运势、指导关系。请问你想了解什么？" },
  { id: "meihua", name: "梅花易数", icon: "❀", color: "#D4654A", desc: "即时起卦·决策分析", greeting: "你好，我是梅花易数AI。告诉我你当前面临的问题或选择，我将即时起卦，为你分析当下的趋势与建议。" },
  { id: "tarot", name: "塔罗牌", icon: "✦", color: "#9B7FD4", desc: "牌阵解读·直觉指引", greeting: "你好，我是塔罗AI向导。集中你的心念，告诉我你想探索的问题——感情、事业或是人生方向，我将为你抽牌解读。" },
  { id: "vedic", name: "印度占星", icon: "◎", color: "#5B8FB9", desc: "星盘解析·业力指引", greeting: "Namaste! 我是吠陀占星AI。基于你的出生信息，我将从印度占星术的角度为你解读星盘、分析达沙周期与行星影响。" },
];

const PERSONALITY_CARDS = [
  { id: "personality", title: "人格卡", icon: "✦", color: "#C9A96E", subtitle: "你的核心性格特质", content: { main: "洞察者·辛金", traits: ["敏锐洞察", "独立思考", "情感深沉", "追求真实"], desc: "你拥有辛金般的细腻与锋芒。外表平和，内心有着极强的辨别力和审美追求。" } },
  { id: "relation", title: "关系模式卡", icon: "◈", color: "#5B8FB9", subtitle: "你在关系中的角色", content: { main: "守护者·偏印格", traits: ["深度连接", "忠诚稳定", "需要空间", "慢热持久"], desc: "你在关系中偏向深度而非广度。一旦建立信任，会成为最可靠的陪伴者。" } },
  { id: "strength", title: "优势卡", icon: "◆", color: "#6BAF7B", subtitle: "你的关系优势", content: { main: "共情与理解力", traits: ["情绪感知力强", "善于倾听", "给予安全感", "有耐心"], desc: "你最大的关系优势是深度共情能力，让与你相处的人感到被理解和安全。" } },
  { id: "risk", title: "风险提示卡", icon: "◇", color: "#D4654A", subtitle: "需要注意的模式", content: { main: "过度消耗与封闭", traits: ["容易过度付出", "压抑真实感受", "回避冲突", "完美主义"], desc: "你可能在关系中过度消耗自己的能量，同时将真实的不满隐藏起来。" } },
  { id: "action", title: "行动建议卡", icon: "▸", color: "#9B7FD4", subtitle: "今天可以做的事", content: { main: "表达一次真实感受", traits: ["每日真实表达", "设定边界", "主动发起对话", "记录情绪"], desc: "今天尝试对一个你信任的人说出一件真实的感受，打破封闭模式的第一步。" } },
];

const MATCH_USERS = [
  { id: 1, name: "林晓月", age: 26, avatar: "🌙", element: "木", score: 92, type: "互补型", reason: "你的辛金细腻与她的甲木生长力形成互补", tags: ["温柔共情", "艺术感知", "慢热型"], distance: "3km" },
  { id: 2, name: "陈思远", age: 28, avatar: "⭐", element: "水", score: 87, type: "相似型", reason: "水金相生，思考方式和价值观上高度共鸣", tags: ["深度思考", "独立自主", "追求真实"], distance: "5km" },
  { id: 3, name: "王雨桐", age: 25, avatar: "🌿", element: "土", score: 85, type: "成长型", reason: "土生金，她的稳定力量能给你安全感", tags: ["稳定可靠", "包容力强", "行动派"], distance: "8km" },
];

const FRIENDS = [
  { id: 1, name: "林晓月", avatar: "🌙", element: "木", lastMsg: "好的，明天见！", time: "10:32", unread: 2, online: true },
  { id: 2, name: "陈思远", avatar: "⭐", element: "水", lastMsg: "那篇文章我看了，很有共鸣", time: "昨天", unread: 0, online: true },
  { id: 3, name: "王雨桐", avatar: "🌿", element: "土", lastMsg: "双人任务完成啦～默契值+15", time: "昨天", unread: 0, online: false },
  { id: 4, name: "张一鸣", avatar: "🔥", element: "火", lastMsg: "哈哈哈 太准了吧", time: "周一", unread: 0, online: false },
  { id: 5, name: "李诗韵", avatar: "💎", element: "金", lastMsg: "[图片]", time: "周日", unread: 0, online: true },
];

const COMMUNITY_POSTS = [
  { user: "水象人·小鱼", tag: "水", content: "今天终于对朋友说出了压在心里的话，虽然紧张但感觉好多了", likes: 42, comments: 8, time: "2小时前" },
  { user: "金象人·阿诚", tag: "金", content: "做完关系分析才发现自己一直在重复同样的模式…", likes: 67, comments: 15, time: "4小时前" },
  { user: "木象人·林夕", tag: "木", content: "和匹配的朋友完成了第一个双人任务，默契值+15！", likes: 89, comments: 23, time: "6小时前" },
];

// ============ SMALL COMPONENTS ============
const Badge = ({ children, color = "#C9A96E" }) => (
  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${color}18`, color, border: `1px solid ${color}30`, letterSpacing: 0.3 }}>
    {children}
  </span>
);

const ProgressBar = ({ value, max, color = "#C9A96E", height = 4 }) => (
  <div style={{ width: "100%", height, background: "rgba(255,255,255,0.08)", borderRadius: height / 2 }}>
    <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: height / 2, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
  </div>
);

const FloatingParticles = () => {
  const p = Array.from({ length: 10 }, (_, i) => ({ id: i, l: Math.random() * 100, t: Math.random() * 100, s: 1 + Math.random() * 2, d: Math.random() * 5, dur: 3 + Math.random() * 4 }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {p.map((x) => (
        <div key={x.id} style={{ position: "absolute", left: `${x.l}%`, top: `${x.t}%`, width: x.s, height: x.s, borderRadius: "50%", background: "rgba(201,169,110,0.4)", animation: `float ${x.dur}s ease-in-out ${x.d}s infinite alternate` }} />
      ))}
    </div>
  );
};

const Header = ({ title, subtitle, onBack }) => (
  <div style={{ padding: "44px 20px 16px" }}>
    {onBack && (
      <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", marginBottom: 12, padding: 0 }}>
        ← 返回
      </button>
    )}
    <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", fontFamily: "'Noto Serif SC', serif", marginBottom: subtitle ? 4 : 0 }}>{title}</div>
    {subtitle && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{subtitle}</div>}
  </div>
);

// ============ SCREENS ============

// --- Splash ---
const SplashScreen = ({ onNext }) => {
  useEffect(() => { const t = setTimeout(onNext, 2200); return () => clearTimeout(t); }, [onNext]);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 30%, #1a1520 0%, #0d0b10 70%)", position: "relative" }}>
      <FloatingParticles />
      <div style={{ fontSize: 56, fontWeight: 200, letterSpacing: 16, color: "#C9A96E", animation: "fadeInUp 1.2s ease-out", fontFamily: "'Noto Serif SC', serif" }}>缘合</div>
      <div style={{ fontSize: 12, letterSpacing: 6, color: "rgba(201,169,110,0.5)", marginTop: 16, animation: "fadeInUp 1.2s ease-out 0.3s both" }}>理解自己 · 遇见对的人</div>
      <div style={{ position: "absolute", bottom: 60, width: 24, height: 24, border: "2px solid rgba(201,169,110,0.3)", borderTop: "2px solid #C9A96E", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
    </div>
  );
};

// --- Onboarding ---
const OnboardScreen = ({ step, onNext, onSkip }) => {
  const steps = [
    { title: "认识真实的自己", desc: "通过千年命理智慧与AI分析\n生成你的专属性格画像", visual: (
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 }}>
        {FIVE_ELEMENTS.map((e, i) => (
          <div key={e} style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${ELEMENT_COLORS[e]}20`, border: `1px solid ${ELEMENT_COLORS[e]}40`, color: ELEMENT_COLORS[e], fontSize: 18, fontFamily: "'Noto Serif SC', serif", animation: `fadeInUp 0.6s ease-out ${i * 0.1}s both` }}>{e}</div>
        ))}
      </div>
    )},
    { title: "四种占术 · AI解读", desc: "八字命理、梅花易数、塔罗牌、印度占星\n多维度洞察你的人生", visual: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: 200, margin: "0 auto 32px" }}>
        {AI_MODES.map((m, i) => (
          <div key={m.id} style={{ padding: "14px 10px", borderRadius: 14, background: `${m.color}10`, border: `1px solid ${m.color}20`, textAlign: "center", animation: `fadeInUp 0.5s ease-out ${i * 0.1}s both` }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
            <div style={{ fontSize: 11, color: m.color, letterSpacing: 1 }}>{m.name}</div>
          </div>
        ))}
      </div>
    )},
    { title: "在互动中成长", desc: "与志同道合的人深度交流\n通过任务推动关系自然发展", visual: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginBottom: 32 }}>
        {["初识", "熟悉", "升温", "稳定", "成长"].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, animation: `fadeInUp 0.5s ease-out ${i * 0.1}s both` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: i < 3 ? "#C9A96E" : "rgba(201,169,110,0.3)" }} />
            <span style={{ fontSize: 13, color: i < 3 ? "#C9A96E" : "rgba(255,255,255,0.3)", letterSpacing: 2 }}>{s}</span>
          </div>
        ))}
      </div>
    )},
  ];
  const s = steps[step - 1];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", position: "relative" }}>
      <div style={{ position: "absolute", top: 16, right: 20 }}>
        <button onClick={onSkip} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer" }}>跳过</button>
      </div>
      {s.visual}
      <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", marginBottom: 12, letterSpacing: 1, fontFamily: "'Noto Serif SC', serif" }}>{s.title}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.8, whiteSpace: "pre-line" }}>{s.desc}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 40 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ width: i === step ? 24 : 6, height: 6, borderRadius: 3, background: i === step ? "#C9A96E" : "rgba(255,255,255,0.15)", transition: "all 0.3s ease" }} />
        ))}
      </div>
      <button onClick={onNext} style={{ marginTop: 32, padding: "14px 48px", borderRadius: 28, border: step === 3 ? "none" : "1px solid #C9A96E40", background: step === 3 ? "linear-gradient(135deg, #C9A96E, #A8884D)" : "transparent", color: step === 3 ? "#0d0b10" : "#C9A96E", fontSize: 15, fontWeight: 500, cursor: "pointer", letterSpacing: 2 }}>
        {step === 3 ? "开始探索" : "继续"}
      </button>
    </div>
  );
};

// --- Birth Info ---
const BirthInfoScreen = ({ onSubmit }) => {
  const [year, setYear] = useState("1996");
  const [month, setMonth] = useState("8");
  const [day, setDay] = useState("15");
  const [hour, setHour] = useState("14");
  const [gender, setGender] = useState("female");
  const Sel = ({ label, value, onChange, options }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 1 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "12px 4px", borderRadius: 12, border: "1px solid rgba(201,169,110,0.2)", background: "rgba(201,169,110,0.06)", color: "#C9A96E", fontSize: 15, fontFamily: "'Noto Serif SC', serif", outline: "none", appearance: "none", textAlign: "center" }}>
        {options.map((o) => <option key={o.v} value={o.v} style={{ background: "#1a1520" }}>{o.l}</option>)}
      </select>
    </div>
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "40px 24px 24px", animation: "fadeInUp 0.6s ease-out" }}>
      <div style={{ fontSize: 11, color: "rgba(201,169,110,0.6)", letterSpacing: 4, marginBottom: 8 }}>STEP 1 / 2</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", marginBottom: 8, fontFamily: "'Noto Serif SC', serif" }}>输入出生信息</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32, lineHeight: 1.6 }}>用于生成八字命盘与性格分析<br /><span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>所有数据加密存储，仅用于个人分析</span></div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Sel label="年" value={year} onChange={setYear} options={Array.from({ length: 40 }, (_, i) => ({ v: String(1980 + i), l: `${1980 + i}` }))} />
        <Sel label="月" value={month} onChange={setMonth} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), l: `${i + 1}月` }))} />
        <Sel label="日" value={day} onChange={setDay} options={Array.from({ length: 31 }, (_, i) => ({ v: String(i + 1), l: `${i + 1}日` }))} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <Sel label="时辰" value={hour} onChange={setHour} options={[
          { v: "0", l: "子时 (23-1)" }, { v: "2", l: "丑时 (1-3)" }, { v: "4", l: "寅时 (3-5)" }, { v: "6", l: "卯时 (5-7)" },
          { v: "8", l: "辰时 (7-9)" }, { v: "10", l: "巳时 (9-11)" }, { v: "12", l: "午时 (11-13)" }, { v: "14", l: "未时 (13-15)" },
          { v: "16", l: "申时 (15-17)" }, { v: "18", l: "酉时 (17-19)" }, { v: "20", l: "戌时 (19-21)" }, { v: "22", l: "亥时 (21-23)" },
        ]} />
      </div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10, letterSpacing: 1 }}>性别</div>
        <div style={{ display: "flex", gap: 12 }}>
          {["female", "male"].map((g) => (
            <button key={g} onClick={() => setGender(g)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${gender === g ? "#C9A96E" : "rgba(255,255,255,0.1)"}`, background: gender === g ? "rgba(201,169,110,0.1)" : "transparent", color: gender === g ? "#C9A96E" : "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", transition: "all 0.3s ease" }}>
              {g === "female" ? "♀ 女" : "♂ 男"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onSubmit} style={{ width: "100%", padding: "16px 0", borderRadius: 28, border: "none", background: "linear-gradient(135deg, #C9A96E, #A8884D)", color: "#0d0b10", fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: 2 }}>
        生成命盘分析
      </button>
    </div>
  );
};

// --- Analysis Loading ---
const AnalysisScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const stages = ["排列四柱八字...", "计算五行分布...", "分析十神关系...", "生成人格标签...", "绘制性格卡片..."];
  useEffect(() => {
    const iv = setInterval(() => {
      setProgress((p) => { if (p >= 100) { clearInterval(iv); setTimeout(onComplete, 400); return 100; } return p + 1.8; });
    }, 45);
    return () => clearInterval(iv);
  }, [onComplete]);
  const stage = Math.min(Math.floor(progress / 20), 4);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", position: "relative" }}>
      <FloatingParticles />
      <div style={{ position: "relative", width: 120, height: 120, marginBottom: 40 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(201,169,110,0.1)" strokeWidth="2" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="#C9A96E" strokeWidth="2" strokeDasharray={`${(progress / 100) * 339} 339`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.3s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 200, color: "#C9A96E", fontFamily: "'Noto Serif SC', serif" }}>{Math.round(progress)}%</div>
      </div>
      <div style={{ fontSize: 14, color: "#C9A96E", marginBottom: 8, letterSpacing: 2 }}>{stages[stage]}</div>
      <div style={{ width: "60%", marginTop: 8 }}><ProgressBar value={progress} max={100} /></div>
    </div>
  );
};

// --- HOME ---
const HomeScreen = ({ onNavigate }) => {
  const [greeting, setGreeting] = useState("");
  useEffect(() => { const h = new Date().getHours(); setGreeting(h < 12 ? "早安" : h < 18 ? "午安" : "晚安"); }, []);
  return (
    <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
      <div style={{ padding: "44px 20px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>{greeting}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: "#fff", fontFamily: "'Noto Serif SC', serif", marginTop: 4 }}>洞察者 · 辛金</div>
          </div>
          <div onClick={() => onNavigate(SCREENS.PROFILE)} style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #C9A96E33, #C9A96E11)", border: "1px solid #C9A96E30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>✦</div>
        </div>

        {/* Daily */}
        <div onClick={() => onNavigate(SCREENS.DAILY)} style={{ padding: 20, borderRadius: 20, background: "linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(201,169,110,0.04) 100%)", border: "1px solid rgba(201,169,110,0.15)", marginBottom: 20, cursor: "pointer", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,110,0.1) 0%, transparent 70%)" }} />
          <div style={{ fontSize: 11, color: "rgba(201,169,110,0.7)", letterSpacing: 3, marginBottom: 10 }}>今日状态</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#C9A96E", fontFamily: "'Noto Serif SC', serif", marginBottom: 8 }}>内省 · 沉淀</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>今天适合独处思考，整理近期的感受。</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Badge>偏印日</Badge><Badge color="#5B8FB9">宜独处</Badge><Badge color="#6BAF7B">宜反思</Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { icon: "✦", label: "性格卡片", screen: SCREENS.CARDS, color: "#C9A96E" },
            { icon: "◈", label: "关系匹配", screen: SCREENS.MATCH, color: "#5B8FB9" },
            { icon: "🎯", label: "今日任务", screen: SCREENS.TASKS, color: "#9B7FD4" },
            { icon: "👥", label: "好友私聊", screen: SCREENS.CHAT_LIST, color: "#6BAF7B" },
          ].map((item) => (
            <div key={item.label} onClick={() => onNavigate(item.screen)} style={{ padding: "18px 16px", borderRadius: 16, background: `${item.color}08`, border: `1px solid ${item.color}18`, cursor: "pointer" }}>
              <div style={{ fontSize: 22, marginBottom: 8, color: item.color }}>{item.icon}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Match Preview */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>今日推荐</span>
            <span onClick={() => onNavigate(SCREENS.MATCH)} style={{ fontSize: 12, color: "#C9A96E", cursor: "pointer" }}>查看全部 →</span>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {MATCH_USERS.map((u) => (
              <div key={u.id} onClick={() => onNavigate(SCREENS.MATCH)} style={{ minWidth: 130, padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 6 }}>{u.avatar}</div>
                <div style={{ fontSize: 13, color: "#fff" }}>{u.name}</div>
                <div style={{ fontSize: 11, color: ELEMENT_COLORS[u.element] }}>{u.element}象 · {u.score}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Cards List ---
const CardsScreen = ({ onNavigate, onBack }) => (
  <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
    <Header title="我的性格卡片" subtitle="基于八字命盘生成的个人画像" onBack={onBack} />
    <div style={{ padding: "0 20px" }}>
      {PERSONALITY_CARDS.map((card, i) => (
        <div key={card.id} onClick={() => onNavigate(SCREENS.CARD_DETAIL, { cardIndex: i })} style={{ padding: 18, borderRadius: 16, background: `${card.color}08`, border: `1px solid ${card.color}18`, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, marginBottom: 10, animation: `fadeInUp 0.5s ease-out ${i * 0.06}s both` }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: card.color, flexShrink: 0 }}>{card.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: "#fff", marginBottom: 3 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{card.subtitle}</div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }}>›</div>
        </div>
      ))}
    </div>
  </div>
);

// --- Card Detail ---
const CardDetailScreen = ({ cardIndex = 0, onBack }) => {
  const c = PERSONALITY_CARDS[cardIndex];
  return (
    <div style={{ height: "100%", overflow: "auto", paddingBottom: 40 }}>
      <Header title="" onBack={onBack} />
      <div style={{ padding: "0 20px" }}>
        <div style={{ padding: 28, borderRadius: 24, background: `linear-gradient(160deg, ${c.color}15 0%, ${c.color}05 100%)`, border: `1px solid ${c.color}25`, marginBottom: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${c.color}15 0%, transparent 70%)` }} />
          <div style={{ fontSize: 32, color: c.color, marginBottom: 12 }}>{c.icon}</div>
          <div style={{ fontSize: 11, color: `${c.color}99`, letterSpacing: 3, marginBottom: 8 }}>{c.title}</div>
          <div style={{ fontSize: 24, fontWeight: 500, color: "#fff", fontFamily: "'Noto Serif SC', serif", marginBottom: 16 }}>{c.content.main}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {c.content.traits.map((t) => <Badge key={t} color={c.color}>{t}</Badge>)}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>{c.content.desc}</div>
        </div>
        <button style={{ width: "100%", padding: "14px 0", borderRadius: 24, border: `1px solid ${c.color}40`, background: "transparent", color: c.color, fontSize: 14, cursor: "pointer", letterSpacing: 2 }}>分享给朋友</button>
      </div>
    </div>
  );
};

// --- Daily ---
const DailyScreen = ({ onBack }) => (
  <div style={{ height: "100%", overflow: "auto", paddingBottom: 40 }}>
    <Header title="" onBack={onBack} />
    <div style={{ padding: "0 20px" }}>
      <div style={{ fontSize: 11, color: "rgba(201,169,110,0.6)", letterSpacing: 4, marginBottom: 8 }}>2026年3月20日 · 星期五</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: "#fff", fontFamily: "'Noto Serif SC', serif", marginBottom: 20 }}>今日状态详解</div>
      <div style={{ padding: 24, borderRadius: 20, background: "linear-gradient(160deg, rgba(201,169,110,0.12) 0%, rgba(201,169,110,0.03) 100%)", border: "1px solid rgba(201,169,110,0.15)", marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 300, color: "#C9A96E", fontFamily: "'Noto Serif SC', serif", marginBottom: 8 }}>内省 · 沉淀</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>偏印日 · 水旺</div>
      </div>
      {[
        { title: "今日关键词", items: ["独处", "反思", "整理", "沉淀"], color: "#C9A96E" },
        { title: "关系建议", items: ["避免在情绪波动时做出承诺", "适合与老朋友深度对话", "给自己和伴侣一些空间"], color: "#5B8FB9" },
        { title: "行动建议", items: ["写下最近困扰你的三件事", "用10分钟冥想或静坐", "整理你的社交关系清单"], color: "#6BAF7B" },
      ].map((sec) => (
        <div key={sec.title} style={{ padding: 18, borderRadius: 16, background: `${sec.color}06`, border: `1px solid ${sec.color}12`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: sec.color, letterSpacing: 2, marginBottom: 10 }}>{sec.title}</div>
          {sec.items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: sec.color, marginTop: 6, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{item}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

// --- Match ---
const MatchScreen = ({ onNavigate, onBack }) => {
  const [ci, setCi] = useState(0);
  const u = MATCH_USERS[ci];
  return (
    <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
      <Header title="今日推荐" subtitle="基于命盘与性格模式匹配" onBack={onBack} />
      <div style={{ padding: "0 20px" }}>
        <div key={ci} style={{ padding: 24, borderRadius: 24, background: `linear-gradient(160deg, ${ELEMENT_COLORS[u.element]}12 0%, transparent 100%)`, border: `1px solid ${ELEMENT_COLORS[u.element]}20`, marginBottom: 16, animation: "fadeInUp 0.4s ease-out" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 56, marginBottom: 10 }}>{u.avatar}</div>
            <div style={{ fontSize: 20, color: "#fff", fontFamily: "'Noto Serif SC', serif" }}>{u.name}，{u.age}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{u.distance}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: "#C9A96E", fontFamily: "'Noto Serif SC', serif" }}>{u.score}%</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>匹配度</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, color: ELEMENT_COLORS[u.element], marginBottom: 2 }}>{u.type}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>匹配类型</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 16 }}>
            {u.tags.map((t) => <Badge key={t} color={ELEMENT_COLORS[u.element]}>{t}</Badge>)}
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, color: "rgba(201,169,110,0.7)", letterSpacing: 2, marginBottom: 6 }}>推荐理由</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>{u.reason}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => setCi((i) => Math.min(i + 1, MATCH_USERS.length - 1))} style={{ width: 56, height: 56, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }}>✕</button>
          <button onClick={() => onNavigate(SCREENS.FRIEND_CHAT, { friend: { ...u, lastMsg: "", unread: 0, online: true } })} style={{ width: 56, height: 56, borderRadius: "50%", border: "none", background: "linear-gradient(135deg, #C9A96E, #A8884D)", color: "#0d0b10", fontSize: 22, cursor: "pointer" }}>♡</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
          {MATCH_USERS.map((_, i) => (
            <div key={i} style={{ width: i === ci ? 20 : 6, height: 6, borderRadius: 3, background: i === ci ? "#C9A96E" : "rgba(255,255,255,0.1)", transition: "all 0.3s ease", cursor: "pointer" }} onClick={() => setCi(i)} />
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Chat List (Friends) ---
const ChatListScreen = ({ onNavigate, onBack }) => (
  <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
    <div style={{ padding: "44px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", fontFamily: "'Noto Serif SC', serif" }}>消息</div>
      </div>
      <button onClick={() => onNavigate(SCREENS.ADD_FRIEND)} style={{ background: "none", border: "1px solid rgba(201,169,110,0.3)", borderRadius: 20, padding: "6px 14px", color: "#C9A96E", fontSize: 12, cursor: "pointer" }}>+ 添加好友</button>
    </div>

    {/* Search */}
    <div style={{ padding: "8px 20px 16px" }}>
      <div style={{ padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>🔍 搜索好友...</div>
    </div>

    {/* Friend list */}
    <div style={{ padding: "0 20px" }}>
      {FRIENDS.map((f, i) => (
        <div key={f.id} onClick={() => onNavigate(SCREENS.FRIEND_CHAT, { friend: f })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${ELEMENT_COLORS[f.element]}15`, border: `1px solid ${ELEMENT_COLORS[f.element]}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{f.avatar}</div>
            {f.online && <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: "#6BAF7B", border: "2px solid #0d0b10" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 15, color: "#fff", fontWeight: f.unread ? 500 : 400 }}>{f.name}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{f.time}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: f.unread ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.lastMsg}</span>
              {f.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "#D4654A", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>{f.unread}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- Friend Chat (1-on-1) ---
const FriendChatScreen = ({ friend, onBack, onNavigate }) => {
  const [msgs, setMsgs] = useState([
    { from: "system", text: `你们的关系类型：互补型 · 匹配度 92%` },
    { from: "other", text: "嗨～看到匹配通知就过来了，你今天的每日状态是什么呀？" },
    { from: "me", text: "是「内省·沉淀」，说让我今天多独处思考 😂" },
    { from: "other", text: "哈哈 我今天是「行动·突破」，完全相反！" },
    { from: "ai_hint", text: "💡 AI话题建议：你们的五行互补很有趣，可以聊聊各自最近的一个重要决定" },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { from: "me", text: input }]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [...m, { from: "other", text: "说得好有道理！我之前也有类似的感觉～" }]);
    }, 1500);
  };

  const f = friend || FRIENDS[0];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "44px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${ELEMENT_COLORS[f.element]}15`, border: `1px solid ${ELEMENT_COLORS[f.element]}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{f.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, color: "#fff" }}>{f.name}</div>
          <div style={{ fontSize: 11, color: f.online !== false ? "#6BAF7B" : "rgba(255,255,255,0.3)" }}>{f.online !== false ? "在线" : "离线"}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 16, cursor: "pointer" }}>📞</button>
          <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 16, cursor: "pointer" }}>⋯</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => {
          if (m.from === "system") return (
            <div key={i} style={{ alignSelf: "center", padding: "6px 14px", borderRadius: 12, background: "rgba(201,169,110,0.08)", fontSize: 11, color: "rgba(201,169,110,0.7)", letterSpacing: 0.5 }}>{m.text}</div>
          );
          if (m.from === "ai_hint") return (
            <div key={i} style={{ alignSelf: "center", padding: "10px 14px", borderRadius: 12, background: "rgba(155,127,212,0.06)", border: "1px solid rgba(155,127,212,0.12)", fontSize: 12, color: "rgba(155,127,212,0.85)", maxWidth: "90%", textAlign: "center", lineHeight: 1.5 }}>{m.text}</div>
          );
          const isMe = m.from === "me";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
              {!isMe && <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${ELEMENT_COLORS[f.element]}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{f.avatar}</div>}
              <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isMe ? "linear-gradient(135deg, #C9A96E, #A8884D)" : "rgba(255,255,255,0.06)", color: isMe ? "#0d0b10" : "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.6 }}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 28px", display: "flex", gap: 8, alignItems: "center" }}>
        <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 20, cursor: "pointer", padding: 0, flexShrink: 0 }}>+</button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="发消息..." style={{ flex: 1, padding: "10px 16px", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none" }} />
        <button onClick={send} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: input.trim() ? "linear-gradient(135deg, #C9A96E, #A8884D)" : "rgba(255,255,255,0.06)", color: input.trim() ? "#0d0b10" : "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
};

// --- AI CHAT (Center Tab) with mode switcher ---
const AIChatScreen = ({ onBack, isTab }) => {
  const [mode, setMode] = useState(0);
  const [msgs, setMsgs] = useState({});
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const scrollRef = useRef(null);
  const m = AI_MODES[mode];

  // Init greeting per mode
  const getMessages = () => msgs[m.id] || [{ from: "ai", text: m.greeting }];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, mode, typing]);

  const quickQs = {
    bazi: ["我的感情运势如何？", "今年事业方向？", "如何改善沟通？", "我的性格弱点？"],
    meihua: ["现在适合跳槽吗？", "这段感情该继续吗？", "今天出行顺利吗？", "投资决策分析"],
    tarot: ["抽一张指引牌", "三张牌阵·感情", "本周运势解读", "做一个抉择指引"],
    vedic: ["我的星盘解读", "土星回归影响？", "婚姻宫分析", "当前大运周期"],
  };

  const aiResponses = {
    bazi: "根据你的辛金日主命盘，今年偏印流年带来的是内在整理的能量。你的食神生财格局在下半年会明显活跃，感情和事业都有新的突破口。关键是上半年做好积累与反思。",
    meihua: "刚才为你起卦，得「天火同人」变「天雷无妄」。卦象显示当前局面虽然看起来平稳，但内部已有变动之兆。建议近期保持观察，不宜贸然行动。三日内会有新的信息出现。",
    tarot: "为你抽到的是「星星」牌。这张牌代表希望、灵感与内在指引。在你当前的处境中，它提示你保持信心——你正在经历一个净化和重生的阶段。跟随直觉，答案就在你心中。",
    vedic: "从你的吠陀星盘来看，当前正处于金星大运期（Shukra Dasha），这对感情和艺术创造力都是有利的时期。月亮在你的第七宫（伴侣宫）过境，近期可能会有重要的关系进展。",
  };

  const send = (text) => {
    const t = text || input;
    if (!t.trim()) return;
    const cur = getMessages();
    const newMsgs = [...cur, { from: "me", text: t }];
    setMsgs((prev) => ({ ...prev, [m.id]: newMsgs }));
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((prev) => ({
        ...prev,
        [m.id]: [...(prev[m.id] || [{ from: "ai", text: m.greeting }]), { from: "me", text: t }, { from: "ai", text: aiResponses[m.id] }],
      }));
    }, 1800);
  };

  const currentMsgs = getMessages();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: isTab ? "44px 16px 0" : "44px 16px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {!isTab && <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", padding: 0 }}>←</button>}
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${m.color}18`, border: `1px solid ${m.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, fontSize: 18 }}>{m.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: "#fff" }}>{m.name}</div>
            <div style={{ fontSize: 11, color: `${m.color}99` }}>{m.desc}</div>
          </div>
          <button onClick={() => setShowModes(!showModes)} style={{ background: `${m.color}12`, border: `1px solid ${m.color}25`, borderRadius: 8, padding: "6px 10px", color: m.color, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>
            切换 ▾
          </button>
        </div>

        {/* Mode switcher dropdown */}
        {showModes && (
          <div style={{ padding: "8px 0 12px", display: "flex", gap: 8 }}>
            {AI_MODES.map((am, i) => (
              <button key={am.id} onClick={() => { setMode(i); setShowModes(false); }} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, background: i === mode ? `${am.color}18` : "rgba(255,255,255,0.02)", border: `1px solid ${i === mode ? `${am.color}35` : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center", transition: "all 0.3s ease" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{am.icon}</div>
                <div style={{ fontSize: 10, color: i === mode ? am.color : "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>{am.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {currentMsgs.map((msg, i) => (
          <div key={`${m.id}-${i}`} style={{ alignSelf: msg.from === "me" ? "flex-end" : "flex-start", maxWidth: "82%", padding: "11px 15px", borderRadius: msg.from === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "me" ? "linear-gradient(135deg, #C9A96E, #A8884D)" : `${m.color}0a`, border: msg.from === "ai" ? `1px solid ${m.color}18` : "none", color: msg.from === "me" ? "#0d0b10" : "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 1.7, animation: "fadeInUp 0.3s ease-out" }}>
            {msg.text}
          </div>
        ))}
        {typing && (
          <div style={{ alignSelf: "flex-start", padding: "11px 15px", borderRadius: "16px 16px 16px 4px", background: `${m.color}0a`, border: `1px solid ${m.color}18` }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((j) => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, animation: `bounce 1s ease-in-out ${j * 0.15}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* Quick questions */}
        {currentMsgs.length <= 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {quickQs[m.id].map((q) => (
              <button key={q} onClick={() => send(q)} style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${m.color}25`, background: `${m.color}08`, color: `${m.color}cc`, fontSize: 12, cursor: "pointer", transition: "all 0.2s ease" }}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 28px", display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`问${m.name}任何问题...`} style={{ flex: 1, padding: "11px 16px", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, outline: "none" }} />
        <button onClick={() => send()} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: input.trim() ? `linear-gradient(135deg, ${m.color}, ${m.color}bb)` : "rgba(255,255,255,0.06)", color: input.trim() ? "#0d0b10" : "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
};

// --- Community ---
const CommunityScreen = () => (
  <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
    <div style={{ padding: "44px 20px 16px" }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#fff", fontFamily: "'Noto Serif SC', serif", marginBottom: 4 }}>同类人社区</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>找到和你同频的人</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {["全部", "金象人", "木象人", "水象人", "火象人", "土象人"].map((tag, i) => (
          <button key={tag} style={{ padding: "8px 14px", borderRadius: 20, border: i === 0 ? "1px solid #C9A96E40" : "1px solid rgba(255,255,255,0.08)", background: i === 0 ? "rgba(201,169,110,0.1)" : "transparent", color: i === 0 ? "#C9A96E" : "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>{tag}</button>
        ))}
      </div>
    </div>
    <div style={{ padding: "0 20px" }}>
      {COMMUNITY_POSTS.map((post, i) => (
        <div key={i} style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 12, animation: `fadeInUp 0.4s ease-out ${i * 0.1}s both` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${ELEMENT_COLORS[post.tag]}20`, border: `1px solid ${ELEMENT_COLORS[post.tag]}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: ELEMENT_COLORS[post.tag] }}>{post.tag}</div>
            <div>
              <div style={{ fontSize: 13, color: "#fff" }}>{post.user}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{post.time}</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 12 }}>{post.content}</div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>♡ {post.likes}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>💬 {post.comments}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- Profile ---
const ProfileScreen = ({ onBack, onNavigate }) => (
  <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
    <div style={{ padding: "44px 20px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #C9A96E33, #C9A96E11)", border: "2px solid #C9A96E40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 10px" }}>✦</div>
        <div style={{ fontSize: 20, color: "#fff", fontFamily: "'Noto Serif SC', serif" }}>洞察者 · 辛金</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>偏印格 · 金水相生</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[{ label: "互动天数", value: "28" }, { label: "好友", value: "5" }, { label: "成长值", value: "860" }].map((s) => (
          <div key={s.label} style={{ textAlign: "center", padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 20, fontWeight: 300, color: "#C9A96E", fontFamily: "'Noto Serif SC', serif" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {[
        { icon: "✦", label: "我的性格卡片", screen: SCREENS.CARDS },
        { icon: "👥", label: "好友列表", screen: SCREENS.CHAT_LIST },
        { icon: "📊", label: "周报 / 月报", screen: null },
        { icon: "🎯", label: "成长记录", screen: null },
        { icon: "⚙️", label: "设置与隐私", screen: null },
        { icon: "👑", label: "会员中心", screen: null },
      ].map((item) => (
        <div key={item.label} onClick={() => item.screen && onNavigate(item.screen)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 12, cursor: item.screen ? "pointer" : "default", marginBottom: 2 }}>
          <span style={{ fontSize: 17 }}>{item.icon}</span>
          <span style={{ flex: 1, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{item.label}</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
        </div>
      ))}
    </div>
  </div>
);

// --- Tasks ---
const TasksScreen = ({ onBack }) => {
  const [checks, setChecks] = useState({});
  const tasks = [
    { id: 1, title: "表达练习：对一个人说出真实感受", type: "表达", color: "#C9A96E" },
    { id: 2, title: "情绪记录：写下今天最强烈的一种情绪", type: "情绪", color: "#9B7FD4" },
    { id: 3, title: "关系练习：主动发起一次对话", type: "关系", color: "#5B8FB9" },
  ];
  return (
    <div style={{ height: "100%", overflow: "auto", paddingBottom: 72 }}>
      <Header title="今日任务" subtitle="完成任务，推动成长" onBack={onBack} />
      <div style={{ padding: "0 20px" }}>
        <div style={{ marginBottom: 16 }}>
          <ProgressBar value={Object.values(checks).filter(Boolean).length} max={3} height={6} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6, textAlign: "right" }}>{Object.values(checks).filter(Boolean).length}/3 已完成</div>
        </div>
        {tasks.map((task) => (
          <div key={task.id} onClick={() => setChecks((c) => ({ ...c, [task.id]: !c[task.id] }))} style={{ padding: 16, borderRadius: 16, background: checks[task.id] ? `${task.color}10` : "rgba(255,255,255,0.02)", border: `1px solid ${checks[task.id] ? `${task.color}30` : "rgba(255,255,255,0.06)"}`, marginBottom: 10, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "all 0.3s ease" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${checks[task.id] ? task.color : "rgba(255,255,255,0.15)"}`, background: checks[task.id] ? task.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#0d0b10", transition: "all 0.3s ease", flexShrink: 0 }}>{checks[task.id] && "✓"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: checks[task.id] ? "rgba(255,255,255,0.4)" : "#fff", textDecoration: checks[task.id] ? "line-through" : "none" }}>{task.title}</div>
              <div style={{ marginTop: 6 }}><Badge color={task.color}>{task.type}</Badge></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ BOTTOM TAB BAR (5 Tabs) ============
const BottomTabBar = ({ active, onNavigate, unread }) => {
  const tabs = [
    { id: SCREENS.HOME, icon: "◎", label: "首页" },
    { id: SCREENS.CHAT_LIST, icon: "💬", label: "消息", badge: unread },
    { id: SCREENS.AI_CHAT, icon: "✦", label: "AI问答", center: true },
    { id: SCREENS.COMMUNITY, icon: "👥", label: "发现" },
    { id: SCREENS.PROFILE, icon: "☰", label: "我的" },
  ];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 68, background: "rgba(13,11,16,0.96)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "0 4px 6px", zIndex: 100 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        if (tab.center) {
          return (
            <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{ background: "linear-gradient(135deg, #C9A96E, #A8884D)", border: "none", width: 50, height: 50, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 4, boxShadow: "0 2px 16px rgba(201,169,110,0.3)", position: "relative", top: -10 }}>
              <span style={{ fontSize: 20, color: "#0d0b10", lineHeight: 1 }}>{tab.icon}</span>
            </button>
          );
        }
        return (
          <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", padding: "6px 12px", position: "relative" }}>
            <span style={{ fontSize: 17, color: isActive ? "#C9A96E" : "rgba(255,255,255,0.3)", transition: "color 0.3s ease", lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: isActive ? "#C9A96E" : "rgba(255,255,255,0.25)", letterSpacing: 0.5 }}>{tab.label}</span>
            {tab.badge > 0 && <span style={{ position: "absolute", top: 2, right: 6, minWidth: 16, height: 16, borderRadius: 8, background: "#D4654A", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};

// ============ MAIN APP ============
export default function YuanHeApp() {
  const [screen, setScreen] = useState(SCREENS.SPLASH);
  const [screenData, setScreenData] = useState({});
  const [history, setHistory] = useState([]);

  const TAB_SCREENS = [SCREENS.HOME, SCREENS.CHAT_LIST, SCREENS.AI_CHAT, SCREENS.COMMUNITY, SCREENS.PROFILE];
  const showTab = TAB_SCREENS.includes(screen);

  const navigate = useCallback((s, data = {}) => {
    setHistory((h) => [...h, { screen, data: screenData }]);
    setScreen(s);
    setScreenData(data);
  }, [screen, screenData]);

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setScreen(prev.screen);
      setScreenData(prev.data);
    } else {
      setScreen(SCREENS.HOME);
    }
  }, [history]);

  const tabNavigate = useCallback((s) => {
    setHistory([]);
    setScreen(s);
    setScreenData({});
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case SCREENS.SPLASH: return <SplashScreen onNext={() => setScreen(SCREENS.ONBOARD_1)} />;
      case SCREENS.ONBOARD_1: return <OnboardScreen step={1} onNext={() => setScreen(SCREENS.ONBOARD_2)} onSkip={() => setScreen(SCREENS.BIRTH_INFO)} />;
      case SCREENS.ONBOARD_2: return <OnboardScreen step={2} onNext={() => setScreen(SCREENS.ONBOARD_3)} onSkip={() => setScreen(SCREENS.BIRTH_INFO)} />;
      case SCREENS.ONBOARD_3: return <OnboardScreen step={3} onNext={() => setScreen(SCREENS.BIRTH_INFO)} onSkip={() => setScreen(SCREENS.BIRTH_INFO)} />;
      case SCREENS.BIRTH_INFO: return <BirthInfoScreen onSubmit={() => setScreen(SCREENS.ANALYSIS)} />;
      case SCREENS.ANALYSIS: return <AnalysisScreen onComplete={() => setScreen(SCREENS.HOME)} />;
      case SCREENS.HOME: return <HomeScreen onNavigate={navigate} />;
      case SCREENS.CARDS: return <CardsScreen onNavigate={navigate} onBack={goBack} />;
      case SCREENS.CARD_DETAIL: return <CardDetailScreen cardIndex={screenData.cardIndex} onBack={goBack} />;
      case SCREENS.DAILY: return <DailyScreen onBack={goBack} />;
      case SCREENS.MATCH: return <MatchScreen onNavigate={navigate} onBack={goBack} />;
      case SCREENS.CHAT_LIST: return <ChatListScreen onNavigate={navigate} onBack={goBack} />;
      case SCREENS.FRIEND_CHAT: return <FriendChatScreen friend={screenData.friend} onBack={goBack} onNavigate={navigate} />;
      case SCREENS.AI_CHAT: return <AIChatScreen onBack={goBack} isTab={true} />;
      case SCREENS.COMMUNITY: return <CommunityScreen />;
      case SCREENS.PROFILE: return <ProfileScreen onBack={goBack} onNavigate={navigate} />;
      case SCREENS.TASKS: return <TasksScreen onBack={goBack} />;
      default: return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#080610", fontFamily: "'Noto Sans SC', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@200;300;400;500;600&family=Noto+Serif+SC:wght@200;300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { from { transform: translateY(0) scale(1); opacity: 0.3; } to { transform: translateY(-20px) scale(1.5); opacity: 0.6; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-4px); opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        select option { background: #1a1520; }
      `}</style>
      <div style={{ width: 375, height: 740, borderRadius: 32, overflow: "hidden", background: "linear-gradient(180deg, #12101a 0%, #0d0b10 100%)", position: "relative", boxShadow: "0 0 60px rgba(201,169,110,0.08), 0 0 120px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {renderScreen()}
        {showTab && <BottomTabBar active={screen} onNavigate={tabNavigate} unread={2} />}
      </div>
    </div>
  );
}
