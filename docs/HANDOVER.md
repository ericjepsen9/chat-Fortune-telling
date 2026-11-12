# 缘合 YuanHe — 项目交接文档

> 最后更新：2026-11-12  
> 项目描述：中国传统命理 + AI 社交匹配 App（PWA）

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [目录结构](#3-目录结构)
4. [前端架构（app.html）](#4-前端架构apphtml)
5. [后端架构（server.js）](#5-后端架构serverjs)
6. [核心功能模块](#6-核心功能模块)
7. [AI 占卜系统](#7-ai-占卜系统)
8. [用户认证与权限](#8-用户认证与权限)
9. [社交功能](#9-社交功能)
10. [管理后台](#10-管理后台)
11. [Bot 系统](#11-bot-系统)
12. [配置管理](#12-配置管理)
13. [PWA 与移动端适配](#13-pwa-与移动端适配)
14. [API 接口清单](#14-api-接口清单)
15. [数据存储](#15-数据存储)
16. [部署与运维](#16-部署与运维)
17. [待完成事项](#17-待完成事项)

---

## 1. 项目概述

**缘合（YuanHe）** 是一款融合中国传统命理（八字、塔罗、星座等）与 AI 智能分析的社交匹配应用。用户可以通过 AI 占卜获取个人命理报告，同时基于命理相合度与其他用户进行匹配社交。

### 核心卖点

- **8 种占卜模式**：八字命理、星座运势、塔罗牌、梅花易数、印度占星、八字合婚、星座配对、综合合盘
- **AI 智能解读**：传统算法计算 + LLM 生成自然语言报告
- **社交匹配**：类 Tinder 滑动匹配，基于命理相合度
- **缘友圈社区**：帖子、点赞、评论
- **实时聊天**：WebSocket 即时通讯
- **Bot 冷启动**：AI 驱动的虚拟用户，初期填充用户池
- **完整管理后台**：用户管理、内容审核、数据统计、LLM 配置

### 用户流程

```
下载/访问 → 选择语言 → 引导教程 → 手机号登录 → 填写生辰信息
    ↓
┌─────────────────────────────────────────────┐
│  首页(缘)  │  发现  │  占卜(AI)  │  消息  │  我的  │
│  滑动匹配  │ 缘友圈 │  8种模式   │  聊天  │  资料  │
└─────────────────────────────────────────────┘
```

---

## 2. 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18（CDN + Babel 编译，单文件 SPA） |
| **后端** | Node.js + Express |
| **实时通信** | WebSocket (ws 库) |
| **AI/LLM** | 兼容 OpenAI API 格式的任意 LLM 服务 |
| **认证** | JWT（用户 30 天，管理员 8 小时） |
| **数据存储** | JSON 文件（data/ 目录） |
| **PWA** | Service Worker + Web App Manifest |
| **CSS** | 全内联样式（React inline styles） |

### 依赖包（package.json）

```
express          — Web 框架
compression      — Gzip 压缩
helmet           — 安全头
express-rate-limit — 请求限流
jsonwebtoken     — JWT 签发/验证
bcryptjs         — 密码哈希
lunar-javascript — 农历转换
astronomia       — 天文计算
ws               — WebSocket
```

### 前端 CDN 库

```
React 18 + ReactDOM 18    — UI 框架
Babel Standalone           — JSX 编译
marked.js                  — Markdown 渲染
html2canvas 1.4.1          — 分享卡片截图
Noto Sans SC / Serif SC    — 中文字体
```

---

## 3. 目录结构

```
chat-Fortune-telling/
├── server.js                    # Express 后端主文件（1484 行）
├── app.html                     # 前端单文件 React SPA（5291 行）
├── admin.html                   # 管理后台 SPA（1896 行）
├── package.json                 # 项目依赖
├── .env.example                 # 环境变量模板
├── deploy-yuanhe.sh             # 部署脚本
│
├── public/                      # 静态资源
│   ├── manifest.json            # PWA 清单
│   ├── sw.js                    # Service Worker
│   └── icons/                   # 应用图标 (SVG)
│       ├── icon-180.svg
│       ├── icon-192.svg
│       └── icon-512.svg
│
├── src/                         # 后端模块
│   ├── ai-service.js            # AI 上下文构建 + 引擎调度（647 行）
│   ├── logger.js                # 请求/LLM 日志 + 统计
│   ├── vip-manager.js           # VIP 等级 + 订单 + 限额
│   ├── bot-manager.js           # Bot 角色 CRUD
│   ├── config-manager.js        # 运行时配置（热加载）
│   ├── websocket.js             # WebSocket 服务
│   ├── hepan.js                 # 综合合盘引擎
│   │
│   ├── auth/                    # 认证模块（门面模式）
│   │   ├── index.js             # 入口：JWT、用户管理、占卜存储（1149 行）
│   │   ├── messages.js          # 消息子模块（131 行）
│   │   └── social.js            # 社交子模块：匹配/好友/帖子/举报（333 行）
│   │
│   ├── admin/                   # 管理员模块
│   │   └── index.js             # 管理员认证 + CRUD + 操作日志（247 行）
│   │
│   └── engines/                 # 命理计算引擎
│       ├── bazi.js              # 八字（四柱）
│       ├── astrology.js         # 西方星座
│       ├── tarot.js             # 塔罗牌 + 牌组数据
│       ├── meihua.js            # 梅花易数
│       ├── vedic.js             # 印度占星（吠陀）
│       ├── hehun.js             # 八字合婚
│       ├── synastry.js          # 星座配对
│       ├── matching.js          # 快速匹配评分 + 每日运势
│       ├── hour-correction.js   # 出生时辰推测问答
│       └── astro-calc.js        # 天文算法
│
├── scripts/
│   ├── backup.sh                # 每日数据备份（tar.gz，保留 7 天）
│   └── generate-icons.js        # 图标生成工具
│
├── docs/                        # 文档
│   └── product-docs/            # 产品规格、路线图
│
└── data/                        # 运行时数据（已 gitignore）
    ├── users.json               # 用户数据
    ├── messages.json             # 聊天消息
    ├── swipes.json              # 滑动记录
    ├── friends.json             # 好友关系
    ├── posts.json               # 社区帖子
    ├── reports.json             # 举报记录
    ├── bots.json                # Bot 配置
    ├── config.json              # 运行时配置
    ├── admins.json              # 管理员账号
    ├── admin-logs.json          # 管理操作日志
    └── orders.json              # VIP 订单
```

---

## 4. 前端架构（app.html）

### 架构说明

前端采用 **单文件 React SPA** 架构，所有组件、样式、逻辑写在一个 `app.html` 文件中（5291 行）。通过 CDN 加载 React 和 Babel，在浏览器端编译 JSX。

### 页面常量

```javascript
const S = {
  SPLASH: 0,       // 启动画面
  LANG_SELECT: -1,  // 语言选择
  LOGIN: 2,         // 登录
  ONBOARD: 1,       // 引导教程
  BIRTH: 4,         // 生辰填写
  HOME: 10,         // 首页（匹配）
  DISCOVER: 11,     // 发现（缘友圈）
  AI: 12,           // AI 占卜
  MSGS: 13,         // 消息
  ME: 14            // 我的
};
```

### 全部组件清单（44 个）

#### 流程页面

| 组件 | 功能 |
|------|------|
| `Splash` | 启动画面，2.2 秒自动消失 |
| `LangSelectScreen` | 语言选择（中/英） |
| `OnboardingScreen` | 新手引导幻灯片 |
| `LoginScreen` | 手机号 + 短信验证码登录 |
| `BirthScreen` | 生辰八字信息填写（年/月/日/时/性别） |

#### 主页面（底部 Tab 栏）

| 组件 | Tab | 功能 |
|------|-----|------|
| `HomeScreen` | 缘 | 滑动匹配卡片、命运转盘、每日状态 |
| `DiscoverScreen` | 发现 | 缘友圈帖子流、心情打卡、占卜入口 |
| `AIScreen` | 占卜 | 8 种占卜模式选择、AI 报告、追问对话 |
| `MsgsScreen` | 消息 | 会话列表 + 聊天界面 |
| `MeScreen` | 我的 | 个人资料、收藏、设置、每日任务 |
| `TabBar` | — | 底部导航栏（5 个 Tab） |

#### 弹窗 / 子组件

| 组件 | 所属页面 | 功能 |
|------|---------|------|
| `SwipeCard` | 首页 | 可滑动的用户卡片 |
| `MatchPopup` | 首页 | "匹配成功！" 弹窗 |
| `CardDetailModal` | 首页 | 用户详情 + 匹配分数 |
| `DailyStatusModal` | 首页 | 每日心情/状态发布 |
| `FortuneWheel` | 首页 | 命运转盘小游戏 |
| `MoodTracker` | 发现 | 心情打卡 |
| `TarotModal` | 占卜 | 塔罗牌手动选牌界面 |
| `HourAssistantModal` | 占卜 | 出生时辰推测助手（问答式） |
| `PostComposeModal` | 发现 | 发帖编辑器 |
| `IcebreakerCard` | 发现 | 破冰话题卡片 |
| `ProfileEditModal` | 我的 | 编辑个人资料 |
| `DataManagementModal` | 我的 | 数据导出/删除 |
| `PrivacySettingsModal` | 我的 | 隐私设置 |
| `TermsModal` | 我的 | 用户协议 |
| `AboutModal` | 我的 | 关于应用 |
| `ReportModal` | 多页面 | 举报用户/内容 |
| `LangPickerModal` | 我的 | 切换语言 |
| `ShareModal` | 多页面 | 分享卡片生成 |
| `PersonalityShareCard` | 分享 | 性格分享卡 |
| `MatchShareCard` | 分享 | 匹配分享卡 |
| `FortuneShareCard` | 分享 | 运势分享卡 |

#### 通用 UI 组件

| 组件 | 功能 |
|------|------|
| `ScoreRing` | 圆形分数指示器（SVG） |
| `EmptyState` | 空状态占位符 |
| `ErrorState` | 错误状态 + 重试按钮 |
| `Skeleton` / `SkeletonCard` | 加载骨架屏 |
| `WheelPicker` | iOS 风格滚轮选择器 |
| `ActionBar` | 报告操作栏（收藏/分享/追问） |
| `WuxingRadar` | 五行雷达图（SVG） |
| `FourPillarsCard` | 四柱（年月日时）展示卡 |
| `WuxingBar` | 五行横向条形图 |
| `PersonalityCards` | 性格特质卡片 |
| `ReportCard` | AI 报告段落卡片 |

### 页面导航流程

```
Splash → LangSelect → Onboarding → Login → Birth → HOME

HOME(缘) ──┬── 滑动卡片 → MatchPopup → MSGS(聊天)
           ├── CardDetailModal → AI/MSGS
           ├── FortuneWheel → AI
           └── DailyStatusModal

DISCOVER(发现) ──┬── 缘友圈帖子流(PostComposeModal)
                ├── 心情打卡(MoodTracker)
                ├── 占卜快捷入口 → AI(指定模式)
                └── 破冰话题(IcebreakerCard)

AI(占卜) ── 选择模式 → 输入信息 → SSE 流式报告 → 追问对话
           ├── TarotModal(塔罗选牌)
           └── HourAssistantModal(时辰推测)

MSGS(消息) ── 会话列表 → 聊天对话

ME(我的) ──┬── ProfileEditModal(编辑资料)
           ├── DataManagementModal(数据管理)
           ├── PrivacySettingsModal(隐私设置)
           ├── 收藏记录 → AI(查看报告)
           ├── 匹配历史 → MSGS
           ├── 我的帖子 → DISCOVER
           └── 每日任务 → AI/DISCOVER/MSGS
```

---

## 5. 后端架构（server.js）

### 启动流程

```
1. 加载环境变量 (.env)
2. 初始化各模块 (auth, admin, vip, config, bot, logger, ai-service)
3. 读取并缓存 app.html → 注入 APP_VERSION (MD5 hash)
4. 配置中间件 (helmet, compression, CORS, rate-limiter)
5. 注册所有路由
6. 创建 HTTP Server → 初始化 WebSocket
7. 监听端口 (默认 3000)
8. 注册优雅关闭处理器 (SIGTERM/SIGINT/uncaughtException)
```

### 中间件栈

```
helmet()               — 安全 HTTP 头
compression()          — Gzip 压缩
express.json()         — JSON 解析 (限制 2mb)
CORS                   — 允许指定 origin
authLimiter            — 认证接口限流 (10 次/15分钟)
llmLimiter             — LLM 接口限流 (10 次/分钟)
adminLimiter           — 管理接口限流 (200 次/分钟)
auth.authMiddleware    — JWT 验证
auth.optionalAuth      — 可选 JWT（未登录也可访问）
admin.adminAuth        — 管理员 JWT 验证
admin.superOnly        — 超级管理员专属
```

### LLM 请求流程

```
用户请求 → 限流检查 → VIP 限额检查 → LLM 缓存检查
  ↓ (缓存未命中)
选择 LLM Provider → 构建 prompt (ai-service.js)
  ↓
发送 HTTP 请求 → SSE 流式响应 → UTF-8 解码
  ↓
前端渲染 Markdown → 存储结果 → 写入缓存
```

### LLM 缓存机制

- **键**: MD5(mode + '|' + message)
- **TTL**: 5 分钟
- **最大条目**: 100
- **用途**: 相同问题短时间内不重复调用 LLM

### LLM Provider 容错

- 支持多 Provider（主 + 备）
- 每个 Provider 独立错误计数
- 连续 3 次错误自动切换下一个 Provider
- 管理后台可动态添加/切换/测试 Provider
- 环境变量 fallback：`LLM_BASE_URL` → `LLM_BACKUP_URL` → `LLM_FALLBACK_URL`

### 优雅关闭

```javascript
// SIGTERM/SIGINT/uncaughtException 触发
1. auth.flushAll() — 刷写所有待写入数据
2. server.close()  — 停止接受新连接
3. 30 秒超时强制退出
```

---

## 6. 核心功能模块

### 模块关系图

```
server.js
  ├── src/auth/index.js (门面)
  │     ├── src/auth/messages.js   (消息)
  │     └── src/auth/social.js     (社交)
  ├── src/admin/index.js           (管理员)
  ├── src/ai-service.js            (AI 服务)
  │     └── src/engines/*.js       (8+ 算法引擎)
  ├── src/vip-manager.js           (VIP)
  ├── src/bot-manager.js           (Bot)
  ├── src/config-manager.js        (配置)
  ├── src/websocket.js             (WebSocket)
  └── src/logger.js                (日志)
```

### 依赖注入模式

auth 模块采用门面模式 + 依赖注入：

```javascript
// auth/index.js
const messages = require('./messages');
const social = require('./social');

// 通过 init() 注入共享依赖
messages.init({ DATA_DIR, debouncedWrite, users });
social.init({ DATA_DIR, debouncedWrite, atomicWriteSync, users, saveUsers });

// 对外暴露统一接口
module.exports = {
  saveMessage: messages.saveMessage,
  getCandidates: social.getCandidates,
  // ... 其他方法
};
```

---

## 7. AI 占卜系统

### 8 种占卜模式

#### 个人模式（单人）

| 模式 ID | 名称 | 引擎 | 需要数据 | 说明 |
|---------|------|------|---------|------|
| `bazi` | 八字命理 | bazi.js | 年/月/日/时/性别 | 天干地支四柱推演，命宫分析 |
| `astrology` | 星座运势 | astrology.js | 年/月/日/时 | 太阳/月亮/上升星座，宫位分析 |
| `tarot` | 塔罗牌 | tarot.js | 可手动选牌或自动抽取 | 支持 78 张全牌组，正逆位 |
| `meihua` | 梅花易数 | meihua.js | 自定义数字 | 数字起卦，本卦/互卦/变卦 |
| `vedic` | 印度占星 | vedic.js | 年/月/日/时 | 印度吠陀恒星黄道，Nakshatra 分析 |

#### 配对模式（双人）

| 模式 ID | 名称 | 引擎 | 需要数据 | 说明 |
|---------|------|------|---------|------|
| `hehun` | 八字合婚 | hehun.js | 双方年/月/日/时/性别 | 传统八字婚姻匹配 |
| `synastry` | 星座配对 | synastry.js | 双方月/日 | 星座化学反应评分 |
| `hepan` | 综合合盘 | hepan.js | 双方完整信息 | 八字 + 星座融合评分 |

### 占卜完整流程

```
1. 用户选择模式 → 输入生辰 + 问题（可选）
   - 配对模式需填写对方信息
   - 塔罗模式支持手动选牌（TarotModal）
   - 不确定时辰可用时辰推测助手（HourAssistantModal）

2. 前端发起请求 → POST /api/divine-stream (SSE)

3. 后端处理：
   a. VIP 限额检查（checkDivinationLimit）
   b. LLM 缓存查询（MD5 key）
   c. 调用对应 Engine 计算原始数据
   d. ai-service.js 构建 prompt：
      - 系统提示词（占卜专家角色）
      - 引擎计算结果（结构化数据）
      - 用户自定义问题
   e. 发送到 LLM API

4. SSE 流式响应：
   - init 事件：引擎计算数据（四柱、五行等）
   - delta 事件：LLM 文本片段（逐字流式）
   - done 事件：完成标记

5. 前端渲染：
   - 引擎数据 → 可视化卡片（四柱卡、五行条、雷达图）
   - LLM 文本 → marked.js 渲染 Markdown
   - 自动保存到用户占卜历史

6. 追问对话：
   - POST /api/chat-followup
   - 携带原始报告上下文（截取前 1500 token）
   - LLM 回答追问
   - 自动滚动到用户提问位置（lastUserMsgRef）
```

### Prompt 结构示例（八字模式）

```
System: 你是一位精通八字命理的大师，具有深厚的传统命理学功底...

User:
【计算数据】
四柱: 甲子年 丙寅月 戊辰日 壬戌时
五行分布: 金2 木3 水1 火2 土2
命宫: ...
大运: ...

【用户问题】
我明年的事业运势如何？

请基于以上命盘数据给出详细分析...
```

---

## 8. 用户认证与权限

### 注册/登录流程

```
1. 输入手机号 → POST /api/auth/send-code
   - 调用 SMS 服务发送验证码
   - 开发模式：任意验证码均可通过

2. 输入验证码 → POST /api/auth/verify
   ├── 手机号已注册 → 返回 JWT + 用户数据
   └── 手机号未注册 → 创建用户 → 返回 JWT + { isNew: true }

3. 新用户 → 填写生辰信息 → POST /api/auth/profile
```

### JWT 配置

| 项目 | 用户 Token | 管理员 Token |
|------|-----------|------------|
| **Secret** | `JWT_SECRET` 环境变量 | `ADMIN_JWT_SECRET` 或 `JWT_SECRET + '_admin'` |
| **有效期** | 30 天 | 8 小时 |
| **Payload** | `{ uid, phone }` | `{ aid, role, type: 'admin' }` |

### Token 黑名单

```javascript
// 登出时将 token 加入内存黑名单
const tokenBlacklist = new Set();
function logout(token) { tokenBlacklist.add(token); }
// authMiddleware 每次验证时检查黑名单
```

### 用户资料字段白名单

```javascript
const ALLOWED = ['name', 'bio', 'city', 'avatar', 'year', 'month', 'day', 'hour', 'gender'];
// POST /api/auth/profile 只接受这些字段，防止注入
```

### VIP 等级体系

| 等级 | 名称 | 每日占卜 | 追问/每报告 | 看谁喜欢我 | 无限滑动 | 价格 |
|------|------|---------|-----------|-----------|---------|------|
| free | 免费用户 | 5 次 | 5 次 | 否 | 否 | ¥0 |
| basic | 缘合会员 | 20 次 | 20 次 | 是 | 是 | ¥28/月 |
| premium | 缘合至尊 | 无限 | 无限 | 是 | 是 + 高级 | ¥68/月 |

VIP 限额检查通过 `vip-manager.checkDivinationLimit()` 在占卜接口中执行。

---

## 9. 社交功能

### 滑动匹配

```
GET /api/candidates
  → 过滤条件：性别偏好、已滑动、有生辰
  → 返回候选用户列表（含 Bot）

POST /api/swipe { targetId, direction: 'left'|'right' }
  → 记录滑动
  → 双方都右滑 = 匹配成功 → 返回 { matched: true }

GET /api/matches
  → 返回所有互相匹配的用户
```

### 好友系统

```
POST /api/friends/request    → 发送好友请求（附留言）
POST /api/friends/respond    → 接受/拒绝请求
GET  /api/friends/pending    → 待处理请求列表
GET  /api/friends             → 好友列表
```

### 实时消息

```
WebSocket 连接 → 认证 → 在线状态

消息类型：
- chat: 聊天消息
- typing: 正在输入指示
- friend_request: 好友请求通知
- friend_accepted: 好友接受通知

HTTP 备用：
GET /api/messages/:userId     → 历史消息（分页）
```

**消息限制**：
- 每对话最多 500 条消息
- 全局最多 10,000 个对话
- 超限自动清理最老的对话

### 缘友圈（社区）

```
POST /api/posts               → 发帖（最多 1000 字 + 标签）
GET  /api/posts               → 帖子列表（分页，可选认证）
POST /api/posts/:id/like      → 点赞/取消
POST /api/posts/:id/comment   → 评论（最多 500 字）
GET  /api/posts/:id/comments  → 评论列表
```

**帖子限制**：全局最多 500 个帖子

### 举报系统

```
POST /api/report
  → targetType: 'user' | 'post' | 'message'
  → targetId, reason (最多 500 字)
  → 管理员后台查看并处理
```

### 敏感内容自动检测

自动标记匹配以下正则的内容：

```
手机号:    \b1[3-9]\d{9}\b
微信:     微信|wx|wechat|加我|v信
URL:      https?://[^\s]+
QQ号:     QQ[：:]?\s*\d{5,}
```

---

## 10. 管理后台

### 访问地址

`/admin` — 独立 SPA（admin.html）

### 管理员角色

| 角色 | 权限范围 |
|------|---------|
| `superadmin` | 全部功能 + 创建管理员 + 删除用户 |
| `operator` | 用户管理 + 内容审核 + 数据统计 |
| `support` | 只读查看 + 举报处理 |

### 功能模块

#### 用户管理
- 用户列表（搜索/筛选/排序/分页）
- 用户详情（占卜历史、消息数、好友、滑动统计）
- 封禁/解封（临时或永久）
- 批量封禁（最多 100 人）
- 用户标签管理
- 导出 CSV
- 软删除（仅超管）

#### 内容审核
- 帖子管理（查看/删除/置顶）
- 会话查看（查看/删除消息）
- 敏感词管理
- 举报处理（查看/解决）

#### 数据统计
- 用户统计总览（注册、日活、VIP 等）
- 30 天趋势图
- 转化漏斗（注册→填资料→占卜→匹配→聊天）
- AI 输出质量抽检

#### VIP 与收入
- 手动授予/撤销 VIP
- 订单列表
- 收入统计
- 不活跃用户检测

#### Bot 管理
- Bot 列表 / 创建 / 编辑 / 删除
- 启用/禁用切换

#### 系统配置
- 功能开关（每个占卜模式可独立关闭）
- 维护模式（开启后所有功能不可用）
- 占卜限额调整
- Bot 行为参数
- 自动标记规则

#### LLM 管理
- Provider 增删改查
- 活跃 Provider 切换
- 参数调整（temperature / maxTokens / timeout）
- 连接测试
- 错误计数重置

#### 系统公告
- 创建/启用/禁用公告
- 支持 info / warning / error 类型

#### 操作日志
- 所有管理操作自动记录
- 可按操作类型/管理员/关键词筛选
- 最多保留 1000 条

### 默认管理员

首次启动自动创建：
- 用户名: `admin`
- 密码: `admin123`
- 角色: `superadmin`
- 强制首次改密

---

## 11. Bot 系统

### 用途

App 冷启动阶段，用 AI 驱动的虚拟用户填充匹配池，使新用户能立即体验滑动匹配和聊天。

### Bot 数据结构

```javascript
{
  id: 301,
  name: '苏晚晴',
  age: 24,
  bio: '喜欢画画和旅行...',
  year: 2000, month: 3, day: 15, hour: 14,
  gender: 'female',
  dist: '3km',
  sign: '双鱼座',
  tags: ['艺术', '旅行'],
  isBot: true,
  chatStyle: '温柔文艺，说话带诗意...',
  enabled: true
}
```

### 内置 Bot（app.html）

前端硬编码 12 个中国女性 Bot 角色：

| 名字 | 特点 |
|------|------|
| 苏晚晴 | 温柔文艺 |
| 方念安 | 活泼可爱 |
| ... | 等共 12 个 |

### Bot 聊天逻辑

```
用户匹配 Bot → POST /api/chat
  → LLM 收到 Bot 完整人设（名字/年龄/性格/聊天风格）
  → 规则：扮演真人、短回复（1-3 句 < 80 字）、性格一致
  → temperature: 0.8, max_tokens: 200
```

---

## 12. 配置管理

### 存储位置

`data/config.json` — 热加载，修改后无需重启

### 配置结构

```javascript
{
  // 维护模式
  maintenance: { enabled: false, message: '系统维护中，请稍后再试' },

  // 功能开关
  features: {
    fortuneWheel: true,     // 命运转盘
    communityPosts: true,   // 缘友圈发帖
    moodTracker: true,      // 心情打卡
    shareCards: true,        // 分享卡片
    voiceMessage: true,     // 语音消息
    imageMessage: true,     // 图片消息
    modes: {                // 占卜模式独立开关
      bazi: true, astrology: true, tarot: true, meihua: true,
      vedic: true, hehun: true, synastry: true, hepan: true
    }
  },

  // Bot 行为
  bot: {
    enabled: true,
    autoGreet: true,            // 匹配后自动问候
    proactiveMessages: true,    // 主动消息
    replyDelayMin: 2000,        // 最短回复延迟(ms)
    replyDelayMax: 7000,        // 最长回复延迟(ms)
    activeHourStart: 8,         // 活跃时段
    activeHourEnd: 23
  },

  // LLM 限额
  limits: {
    divinationsPerDay: 0,       // 0 = 不限
    followUpsPerReport: 20,
    followUpsPerDay: 0
  },

  // 敏感内容检测
  autoFlag: {
    enabled: true,
    patterns: ['\\b1[3-9]\\d{9}\\b', '微信|wx|wechat', ...]
  },

  // LLM 配置
  llm: {
    activeIndex: 0,
    defaultParams: { temperature: 0.5, maxTokens: 6144, timeout: 180000 },
    providers: []
  }
}
```

---

## 13. PWA 与移动端适配

### PWA 配置

**manifest.json:**
```json
{
  "name": "缘合 YuanHe",
  "short_name": "缘合",
  "start_url": "/app",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#8B5CF6",
  "background_color": "#FAFAF7"
}
```

### Service Worker（sw.js）

- **版本**: `yuanhe-v6`
- **策略**:
  - API / SSE / WebSocket → 直接网络（不缓存）
  - `/app` 页面 → 网络优先，失败回退缓存
  - `/public/*` 静态资源 → 缓存优先
  - CDN 资源（React / 字体等）→ 缓存优先
- **更新**: 新版本 activate 时自动清理旧缓存

### iOS 适配

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="缘合">
<meta name="viewport" content="..., viewport-fit=cover">
```

### Safe Area 处理

```
body          → padding-top: env(safe-area-inset-top)
.yh-safe-top  → padding-top: 12px (标题栏额外间距)
TabBar 外层    → padding-bottom: env(safe-area-inset-bottom)
聊天输入框     → padding-bottom: calc(24px + env(safe-area-inset-bottom))
AI 加载条      → bottom: calc(64px + env(safe-area-inset-bottom))
页面容器       → padding-bottom: calc(80px + env(safe-area-inset-bottom))
```

### 自动更新机制

```
1. 服务端：APP_VERSION = MD5(app.html).substring(0, 10)
2. GET /api/version 返回当前版本（no-cache）
3. 客户端轮询 /api/version，比对 window.__YH_VERSION__
4. 版本不匹配 → 显示紫色更新横幅
5. 用户点击 → 清除所有缓存 + Service Worker → 强制刷新
```

---

## 14. API 接口清单

### 公开接口（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/app` | 主应用页面 |
| GET | `/admin` | 管理后台 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/version` | 应用版本 |
| GET | `/api/status` | 维护状态 |
| GET | `/api/stats` | 监控统计 |
| GET | `/api/announcement` | 系统公告 |
| GET | `/api/tarot/deck` | 塔罗牌组数据 |
| GET | `/api/lunar` | 公历转农历 |
| POST | `/api/match` | 双人匹配评分 |
| POST | `/api/batch-match` | 批量匹配 |
| POST | `/api/fortune` | 今日运势 |
| POST | `/api/hour-correct` | 时辰推测 |
| POST | `/api/calculate` | 纯引擎计算 |
| GET | `/api/posts` | 帖子列表（可选认证） |
| GET | `/api/posts/:id/comments` | 帖子评论 |

### 认证接口（10 次/15 分钟）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/send-code` | 发送验证码 |
| POST | `/api/auth/verify` | 验证登录 |

### 用户接口（需 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/me` | 当前用户信息 |
| POST | `/api/auth/logout` | 登出 |
| POST | `/api/auth/profile` | 更新资料 |
| POST | `/api/auth/migrate` | 迁移本地数据 |
| POST | `/api/auth/divination` | 保存占卜结果 |
| POST | `/api/auth/divination/:id/chat` | 追加追问 |
| GET | `/api/auth/divinations` | 占卜历史 |
| POST/GET | `/api/auth/blacklist` | 黑名单同步 |
| POST/GET | `/api/auth/favorites` | 收藏同步 |
| GET | `/api/candidates` | 匹配候选人 |
| POST | `/api/swipe` | 滑动 |
| GET | `/api/matches` | 匹配列表 |
| POST | `/api/friends/request` | 好友请求 |
| POST | `/api/friends/respond` | 好友回应 |
| GET | `/api/friends/pending` | 待处理请求 |
| GET | `/api/friends` | 好友列表 |
| GET | `/api/messages/:userId` | 聊天记录 |
| POST | `/api/posts` | 发帖 |
| POST | `/api/posts/:id/like` | 点赞 |
| POST | `/api/posts/:id/comment` | 评论 |
| POST | `/api/report` | 举报 |

### LLM 接口（10 次/分钟，可选认证 + VIP 检查）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/divine` | 非流式占卜 |
| POST | `/api/divine-stream` | SSE 流式占卜 |
| POST | `/api/chat-followup` | 追问 |
| POST | `/api/chat` | Bot 模拟聊天 |

### 管理接口（需管理员 JWT，200 次/分钟）

详见 [管理后台](#10-管理后台) 章节，共 40+ 个管理接口。

---

## 15. 数据存储

所有数据以 JSON 文件形式存储在 `data/` 目录下。

### 文件列表

| 文件 | 内容 | 写入方式 |
|------|------|---------|
| `users.json` | 用户数据（资料/占卜历史/收藏等） | 防抖写入(5s) |
| `messages.json` | 聊天消息 | 防抖写入(5s) |
| `swipes.json` | 滑动记录 | 防抖写入(5s) |
| `friends.json` | 好友关系（请求+已接受） | 防抖写入(5s) |
| `posts.json` | 社区帖子 | 防抖写入(5s) |
| `reports.json` | 举报记录 | 防抖写入(5s) |
| `bots.json` | Bot 配置 | 原子写入(即时) |
| `config.json` | 运行时配置 | 原子写入(即时) |
| `admins.json` | 管理员账号 | 原子写入(即时) |
| `admin-logs.json` | 管理操作日志 | 原子写入(即时) |
| `orders.json` | VIP 订单 | 原子写入(即时) |

### 写入机制

**防抖写入（debouncedWrite）**：
```javascript
// 高频写入场景（消息、滑动等），5 秒内合并写入
function debouncedWrite(filePath, dataFn) {
  _pendingWrites[filePath] = dataFn;
  clearTimeout(_pendingWrites[filePath + '_t']);
  _pendingWrites[filePath + '_t'] = setTimeout(() => flushWrite(filePath), 5000);
}
```

**原子写入（atomicWriteSync）**：
```javascript
// 写入临时文件 → rename，防止写入中断导致文件损坏
function atomicWriteSync(file, data) {
  const tmp = file + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
```

**关闭时刷写**：
```javascript
// 进程退出前刷写所有待写入数据
function flushAll() {
  for (const filePath of Object.keys(_pendingWrites)) {
    if (!filePath.endsWith('_t')) flushWrite(filePath);
  }
}
```

### 数据限制

| 数据 | 限制 |
|------|------|
| 每对话消息 | 500 条（超出裁剪旧消息） |
| 全局对话数 | 10,000 个（超出清理最老对话） |
| 社区帖子 | 500 个（超出不再创建） |
| 管理日志 | 1,000 条（超出裁剪） |
| 评论 | 每帖无限（但帖子总数有限） |

---

## 16. 部署与运维

### 环境变量（.env）

```bash
# 服务器
PORT=3000                          # 监听端口
NODE_ENV=production                # 环境模式

# JWT
JWT_SECRET=your-jwt-secret         # 用户 JWT 密钥
ADMIN_JWT_SECRET=your-admin-secret # 管理员 JWT 密钥（可选）

# LLM
LLM_BASE_URL=https://api.xxx.com  # 主 LLM 服务地址
LLM_API_KEY=sk-xxx                 # 主 API Key
LLM_MODEL=gpt-4o-mini              # 模型名

LLM_BACKUP_URL=                    # 备用 LLM
LLM_BACKUP_KEY=
LLM_BACKUP_MODEL=

LLM_FALLBACK_URL=                  # 兜底 LLM
LLM_FALLBACK_KEY=
LLM_FALLBACK_MODEL=

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# SMS（需对接具体服务商）
SMS_PROVIDER=
SMS_ACCESS_KEY=
SMS_SECRET=
SMS_TEMPLATE_ID=
```

### 启动命令

```bash
# 开发
npm start              # node server.js

# 生产（推荐 PM2）
pm2 start server.js --name yuanhe
pm2 save
pm2 startup
```

### 数据备份

```bash
# 手动执行
bash scripts/backup.sh

# 定时任务（每天凌晨 2 点）
crontab -e
0 2 * * * /path/to/scripts/backup.sh

# 备份文件: backups/yuanhe-data-YYYYMMDD-HHMMSS.tar.gz
# 自动保留 7 天
```

### 健康检查

```bash
curl http://localhost:3000/api/health
# → { status: 'ok', memory: {...}, users: N, provider: '...' }
```

### 服务器拉取更新

```bash
cd /home/ubuntu/projects/yuanhe    # 项目目录
git pull origin main               # 拉取最新代码
npm install                        # 安装依赖（如有变化）
pm2 restart yuanhe                 # 重启服务
```

---

## 17. 待完成事项

### 高优先级

| 项目 | 说明 | 状态 |
|------|------|------|
| SMS 对接 | 对接真实短信服务（需提供商 + AccessKey） | 待定 |
| HTTPS | 配置 SSL 证书 + 强制 HTTPS | 待部署 |
| 支付对接 | VIP 购买支付网关（微信/支付宝） | 待定 |
| CDN 版本锁定 | React/Babel CDN 脚本添加 SRI hash | 未开始 |

### 中优先级

| 项目 | 说明 | 状态 |
|------|------|------|
| 路由拆分 | server.js 管理路由 → routes/admin.js | 建议 |
| 路由拆分 | server.js 占卜路由 → routes/divine.js | 建议 |
| 响应式字号 | 字体大小随屏幕自适应（clamp/rem） | 用户已确认第 1 步方案 |
| localStorage 封装 | 统一 localStorage 操作接口 | 建议 |

### 低优先级 / 后期迭代

| 项目 | 说明 |
|------|------|
| 数据库迁移 | JSON 文件 → SQLite/PostgreSQL |
| 图片上传 | 头像/帖子图片 OSS 存储 |
| 推送通知 | 新消息/新匹配推送 |
| 多语言完善 | 英文翻译补全 |
| 前端工程化 | 迁移到 Vite + React 项目结构 |

---

## 附录：关键安全措施

| 措施 | 实现 |
|------|------|
| 请求限流 | express-rate-limit（认证 10/15min，LLM 10/min，管理 200/min） |
| 安全头 | helmet() |
| JWT 分离 | 用户和管理员使用不同 JWT secret |
| 密码哈希 | bcryptjs (10 rounds) |
| 资料字段白名单 | 只允许 9 个指定字段更新 |
| 批量操作限制 | 批量封禁最多 100 人，需 Array.isArray 验证 |
| 输入长度限制 | 帖子 1000 字 / 评论 500 字 / 举报 500 字 |
| Token 黑名单 | 登出后 token 失效 |
| 原子文件写入 | 防止写入中断导致数据损坏 |
| 优雅关闭 | 进程退出前刷写所有待写入数据 |
| LLM Provider URL 验证 | 发请求前校验 URL 和 key 存在性 |
| UTF-8 流式解码 | res.setEncoding('utf-8') 防止多字节字符截断 |
| 敏感内容检测 | 自动标记手机号/微信/URL/QQ |
| 管理日志 | 所有管理操作可追溯 |

---

*文档完*
