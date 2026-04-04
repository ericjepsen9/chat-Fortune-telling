# 缘合 (YuanHe) — 完整项目技术文档

> 最后更新: 2026-04-04 Session 15
> 文档用途: 跨对话开发延续，包含所有技术细节和进度状态

---

## 一、项目概述

**缘合** 是一款融合中国传统命理与AI技术的社交匹配应用。核心理念：用八字、星座、塔罗等命理体系，帮用户找到命理契合的伴侣。

**技术栈:** React (CDN Babel) + Node.js + MiniMax LLM
**代码:** 单文件架构 `app.html` (~3900行) + `server.js` (~730行)

---

## 二、仓库与部署

| 项目 | 值 |
|------|-----|
| GitHub | https://github.com/ericjepsen9/chat-Fortune-telling |
| 分支 | main |
| Token | `<GitHub Token>` |
| 生产地址 | https://yuanhe.caughtalert.com/app |
| 服务器 | Oracle Cloud Ubuntu 22.04 aarch64 |
| IP | 157.151.165.106 |
| PM2进程名 | yuanhe (id 6), 端口3000 |
| SSL | Let's Encrypt, 到期2026-07-03 |
| 域名 | caughtalert.com (阿里云DNS), A记录 yuanhe → 157.151.165.106 |
| Nginx配置 | /etc/nginx/sites-available/yuanhe |

### .env配置
```
LLM_BASE_URL=https://api.minimax.io/v1
LLM_API_KEY=<见.env文件>
LLM_MODEL=MiniMax-M2.7
SERVER_PORT=3000
```

### 服务器常用命令
```bash
# 更新部署
cd /home/ubuntu/projects/yuanhe
git pull origin main
pm2 restart yuanhe

# 查看日志
pm2 logs yuanhe --lines 20

# PM2状态
pm2 list

# 其他项目(已停止)
# safecheck(id 0): stopped
# chat(id 3): online(端口5000)
# rag8000(id 5): stopped
```

---

## 三、架构与组件清单

### 前端组件 (app.html)

| 组件 | 行号 | 状态 | 说明 |
|------|------|------|------|
| **全局** | | | |
| THEMES(light/dark) | ~95 | ✅ | 主题色系统(T.bg/card/text/accent等) |
| ScoreRing | ~238 | ✅ | SVG缘分分数环 |
| haptic | ~251 | ✅ | 触觉反馈 |
| EmptyState/ErrorState | ~270 | ✅ | 统一空态/错误态 |
| WheelPicker | ~344 | ✅ | 仿iOS滚轮选择器 |
| **注册流程** | | | |
| Splash | ~301 | ✅ | 启动画面(2.2s) |
| OnboardingScreen | ~307 | ✅ | 3页引导(滑动) |
| TermsModal | ~2896 | ✅ | 用户协议(首次必须同意) |
| BirthScreen | ~364 | ✅ | 生辰输入(滚轮选择器) |
| **首页** | | | |
| HomeScreen | ~827 | ✅ | 能量环+滑卡+性别筛选 |
| SwipeCard | ~459 | ✅ | Tinder风格滑卡(只渲染top2) |
| MatchPopup | ~516 | ✅ | 匹配成功弹窗 |
| CardDetailModal | ~536 | ✅ | 用户详情页(命理分析) |
| FortuneWheel | ~1945 | ✅ | 命运转盘(8人轮盘) |
| **发现页** | | | |
| DiscoverScreen | ~2115 | ✅ | 推荐Tab+缘友圈Tab |
| DailyStatusModal | ~718 | ✅ | 命理日历(日历+五行主题+分享卡片) |
| PostComposeModal | ~2294 | ✅ | 发帖弹窗 |
| MoodTracker | ~2080 | ✅ | 心情打卡(5级) |
| **AI占卜** | | | |
| AIScreen | ~1320 | ✅ | 8模式占卜(SSE流式) |
| ReportCard | ~1107 | ✅ | 报告段落卡片(彩色左边条) |
| FourPillarsCard | ~996 | ✅ | 八字四柱展示 |
| WuxingRadar | ~959 | ✅ | 五行雷达图(SVG) |
| TarotModal | ~1148 | ✅ | 塔罗选牌 |
| HourAssistantModal | ~1209 | ✅ | AI测时辰 |
| **消息页** | | | |
| MsgsScreen | ~2473 | ✅ | 会话列表+聊天详情 |
| IcebreakerCard | ~2343 | ✅ | 破冰卡片 |
| **我的页** | | | |
| MeScreen | ~3029 | ✅ | Profile+性格+任务+动态+周报+设置 |
| ProfileEditModal | ~3515 | ✅ | 编辑资料(含头像上传) |
| PrivacySettingsModal | ~2971 | ✅ | 隐私设置(3级) |
| DataManagementModal | ~3561 | ✅ | 数据管理(查看/导出/删除) |
| AboutModal | ~2923 | ✅ | 关于缘合 |
| ReportModal | ~2947 | ✅ | 举报弹窗 |
| **分享** | | | |
| ShareModal | ~3739 | ✅ | 分享卡片(html2canvas→图片) |
| FortuneShareCard | ~3682 | ✅ | 运势分享卡(支持日历dayInfo) |
| PersonalityShareCard | ~3621 | ✅ | 性格分享卡 |
| MatchShareCard | ~3652 | ✅ | 匹配分享卡 |
| **底部** | | | |
| TabBar | ~3779 | ✅ | 5Tab导航(首页/发现/AI/消息/我的) |
| App | ~3795 | ✅ | 根组件(路由/全局状态) |

### 后端API (server.js)

| 端点 | 方法 | 状态 | 说明 |
|------|------|------|------|
| /app | GET | ✅ | 返回app.html |
| /api/lunar | GET | ✅ | 农历转换 |
| /api/calculate | POST | ✅ | 命理引擎计算(八字/星座/梅花等) |
| /api/divine | POST | ✅ | AI占卜(非流式) |
| /api/divine-stream | POST | ✅ | AI占卜(SSE流式) |
| /api/chat | POST | ✅ | AI模拟聊天 |
| /api/chat-followup | POST | ✅ | 占卜追问 |
| /api/batch-match | POST | ✅ | 批量匹配计算 |
| /api/hour-guess | POST | ✅ | AI猜时辰 |

---

## 四、配色体系

### 五行色（全局统一）
| 五行 | emoji | 主色 | 辅色 | 渐变背景 |
|------|-------|------|------|---------|
| 木 | 🌿 | #16A34A | #22C55E | #F0FDF4→#DCFCE7 |
| 火 | 🔥 | #EF4444 | #EF4444 | #FEF2F2→#FEE2E2 |
| 土 | ⛰️ | #D97706 | #D97706 | #FFFBEB→#FEF3C7 |
| 金 | ✨ | #B8860B | #C4A35A | #FFFBEB→#FEF3C7 |
| 水 | 💧 | #2563EB | #3B82F6 | #EFF6FF→#DBEAFE |

### 主题色
| 变量 | 浅色 | 深色 | 用途 |
|------|------|------|------|
| T.bg | #FAFAF7 | #0F0F1A | 页面背景 |
| T.card | #FFFFFF | #1A1A2E | 卡片背景 |
| T.text | #1A1A2E | #E5E7EB | 主文字 |
| T.textSec | #6B7280 | #9CA3AF | 次要文字 |
| T.textThi | #9CA3AF | #6B7280 | 辅助文字 |
| T.accent2 | #8B5CF6 | #A78BFA | 品牌紫 |
| T.primary | #FF6B6B | #FF8A9B | 强调红/粉 |
| T.gold | #F59E0B | #F59E0B | 金色 |
| T.success | #34D399 | #34D399 | 成功绿 |
| T.border | #EEEEE8 | #2D2D3F | 边框 |

### 性别色
- 女 ♀: #EC4899 (粉)
- 男 ♂: #3B82F6 (蓝)

### 运势吉凶色
| 等级 | 文字色 | 背景渐变 | 边框 |
|------|--------|---------|------|
| 大吉 | #DC2626 | #FFF5F5→#FEE2E2 | #FECACA |
| 吉 | #F59E0B | #FFFBEB→#FEF3C7 | #FCD34D |
| 中吉 | #8B5CF6 | #FAF5FF→#EDE9FE | #DDD6FE |
| 小吉 | #0D9488 | #F0FDFA→#CCFBF1 | #99F6E4 |
| 平 | #6B7280 | #F9FAFB→#F3F4F6 | #E5E7EB |
| 小凶 | #EF4444 | #FFF1F2→#FECDD3 | #FDA4AF |

---

## 五、UI规范（已统一）

| 属性 | 标准值 |
|------|--------|
| 页面标题 | fontSize:24, fontWeight:800 |
| 二级页标题 | fontSize:16, fontWeight:700 |
| 返回按钮 | width:32, height:32, borderRadius:16, border:none, background:T.bg |
| ✕关闭按钮 | width:32, height:32, borderRadius:16, border:none, background:T.bg |
| 卡片圆角 | borderRadius:14 |
| 弹窗圆角 | borderRadius:20 (底部弹出) |
| 卡片阴影 | T.shadow |
| TabBar预留 | paddingBottom:80 |
| 禁用按钮 | background:T.border |
| 弹窗背景关闭 | 外层onClick + 内层stopPropagation |
| 确认弹窗 | window.yuanheConfirm(msg, onOk, opts) |
| 提示Toast | window.yuanheToast(msg) |

---

## 六、数据存储 (localStorage)

| Key | 内容 | 说明 |
|-----|------|------|
| yuanhe_profile | {year,month,day,hour,gender,name,bio,city,avatar} | 用户信息 |
| yuanhe_mode_results | {bazi:{result,chatHistory},...} | 占卜结果缓存 |
| yuanhe_history | [{mode,question,time,ts},...] | 占卜历史(max50) |
| yuanhe_convs | [{id,user,messages,...},...] | 聊天会话 |
| yuanhe_user_posts | [{id,content,time,...},...] | 用户发帖 |
| yuanhe_blacklist | [userId,...] | 黑名单 |
| yuanhe_privacy | 'standard'/'open'/'private' | 隐私级别 |
| yuanhe_theme | 'light'/'dark' | 主题模式 |
| yuanhe_terms_accepted | '1' | 已同意协议 |
| yuanhe_onboarded | '1' | 已完成引导 |
| yuanhe_swipe_guided | '1' | 已看过滑卡教程 |
| yuanhe_gender_pref | 'male'/'female'/'all' | 性别筛选偏好 |
| yuanhe_mood_[date] | 0-4 | 当日心情指数 |
| yuanhe_fav_[mode] | JSON | 收藏的报告 |
| yuanhe_fb_[mode] | 'up'/'down' | 报告反馈 |
| yuanhe_wheel_[date] | '0'-'2' | 今日转盘次数 |

---

## 七、功能完成度

### ✅ 已完成 (前端MVP)

**注册流程:** Splash → 引导页(3页) → 用户协议 → 生辰输入(滚轮) → 进入首页

**首页:**
- 五行能量环(点击→转盘)
- 性别筛选 [女生][男生][全部]
- Tinder风格滑卡(只渲染top2, 性别符号♀♂)
- 右滑匹配→MatchPopup→自动创建会话→AI自动问候
- 撤回滑卡(↩按钮)
- 命运转盘(8人轮盘, 每日2次)
- 首次引导遮罩(点击关闭)

**发现页:**
- 推荐Tab: 运势卡片(吉凶变色,点击→日历) + 4功能入口(🔯🃏🌸💞) + 更多功能列表
- 缘友圈Tab: 发帖 + Bot帖子 + 评论 + 点赞 + 举报
- 心情打卡(右上角, 5级emoji)
- 命理日历: 月历网格 + 五行主题 + 分享卡片

**AI占卜:**
- 8种模式: 八字/星座/塔罗/梅花/印度/合婚/星座配对/合盘
- 个人模式 vs 配对分析(大字Tab切换)
- 专家/大众深度切换
- SSE流式AI输出 + 实时更新
- 报告卡片(彩色左边条, markdown渲染)
- 四柱卡片 + 五行雷达图
- 追问会话(最多20条)
- 快捷问题按钮
- 报告颜色随五行动态变化
- 复制/分享/收藏/反馈

**消息页:**
- 会话列表(搜索, 在线状态)
- 聊天气泡(14px, 时间戳在气泡外)
- 语音消息(录音+播放)
- 图片消息
- 消息操作面板(复制/撤回)
- ⋯菜单(搜索/资料/拉黑/举报)
- 快捷回复 + emoji面板
- Bot自动回复 + 主动消息

**我的页:**
- Profile卡片(头像上传, emoji/照片)
- 性格卡片(五行渐变, 点击→详情页, 一键生成)
- 今日任务(3任务, 可点击跳转, 自动检测完成)
- 我的动态(二级全屏页, 可删除)
- 本周小结(占卜/心情/匹配/最佳)
- 设置: 修改生辰/隐私/外观/黑名单/数据管理
- 用户协议/关于缘合
- 退出登录(确认弹窗+清全部数据)

**全局:**
- 深色模式(T变量体系+CSS变量, 全面修复60+处硬编码)
- 统一确认弹窗(yuanheConfirm)
- 统一Toast(yuanheToast)
- 所有弹窗背景点击关闭
- 分享卡片(html2canvas生成图片)
- ErrorBoundary错误边界(崩溃恢复+清除数据重启)
- 全局unhandledrejection处理

### ⬜ 未完成 (需后端)

- 用户注册/登录(手机号/微信)
- 数据库(用户/匹配/消息/帖子)
- WebSocket实时消息
- 真实用户匹配池
- 好友请求(双向确认)
- 缘友圈"想认识"打通
- 视频社区(方案B)
- 推送通知
- 举报审核后台
- VIP会员+支付
- 应用商店上架

---

## 八、已知问题

1. **深色模式**: ✅ 已全面修复(60+处硬编码颜色→T变量)
2. **缘友圈**: 方案A(纯社区), "想认识"需后端
3. **Bot聊天**: 使用定时器模拟, 非真实WebSocket
4. **数据**: 全部localStorage, 无云端同步(DB Schema已设计)
5. **性能**: app.html单文件~3900行, 已做帖子缓存+图片懒加载

---

## 九、开发时间表

### Phase 1: 前端完善 (1-2周) — 当前阶段
| 任务 | 时间 | 状态 |
|------|------|------|
| UI全面审查+修复 | 0.5天 | ✅ 已完成 |
| 深色模式全面测试 | 0.5天 | ✅ 已完成(Session 15) |
| 性能优化(图片懒加载等) | 0.5天 | ✅ 已完成(Session 15) |
| 错误边界+异常处理 | 0.5天 | ✅ 已完成(Session 15) |
| 用户测试+反馈修复 | 1周 | ⬜ |

### Phase 2: 后端基础 (2-3周)
| 任务 | 时间 | 状态 |
|------|------|------|
| 技术选型(Node/Python, DB) | 1天 | ✅ Express+PostgreSQL(Session 15) |
| 数据库设计(PostgreSQL/MongoDB) | 2天 | ✅ 14张表(Session 15) |
| 服务器架构优化 | 1天 | ✅ Express迁移+helmet+rate-limit(Session 15) |
| 用户注册/登录API | 3天 | ⬜ |
| JWT认证中间件 | 1天 | ⬜ |
| 用户资料CRUD | 2天 | ⬜ |
| 占卜历史云端存储 | 2天 | ⬜ |
| 前端对接后端API | 3天 | ⬜ |

### Phase 3: 社交系统 (2-3周)
| 任务 | 时间 | 状态 |
|------|------|------|
| WebSocket服务器 | 3天 | ⬜ |
| 实时消息收发 | 3天 | ⬜ |
| 匹配算法(真实用户) | 3天 | ⬜ |
| 好友请求系统 | 2天 | ⬜ |
| 缘友圈后端(帖子/评论) | 3天 | ⬜ |
| 推送通知(Firebase/APNs) | 2天 | ⬜ |

### Phase 4: 商业化 (2-4周)
| 任务 | 时间 | 状态 |
|------|------|------|
| VIP会员体系设计 | 2天 | ⬜ |
| 支付SDK集成 | 3天 | ⬜ |
| 运营后台 | 5天 | ⬜ |
| 数据分析Dashboard | 3天 | ⬜ |
| 应用商店上架准备 | 1周 | ⬜ |

### Phase 5: 视频社区 (3-4周)
| 任务 | 时间 | 状态 |
|------|------|------|
| 视频上传/存储/CDN | 5天 | ⬜ |
| 视频播放器组件 | 3天 | ⬜ |
| 缘友圈改造为视频流 | 5天 | ⬜ |
| "想认识"社交打通 | 3天 | ⬜ |

---

## 十、对话历史索引

| Session | 文件 | 内容 |
|---------|------|------|
| 1-7 | (早期, 未记录transcript) | 产品设计+引擎开发 |
| 8-11 | 2026-04-03-23-53-18-yuanhe-dev-sessions-8-9-10-11.txt | AI占卜+匹配+聊天+社区 |
| 12-13 | 2026-04-04-02-41-32-yuanhe-dev-sessions-12-13.txt | UI优化+部署+5功能 |
| 14 | (已结束) | 部署上线+全面UI审查+bug修复 |
| 15 | (当前对话) | 深色模式全面修复+Phase2架构(Express/DB/安全)+性能优化+错误边界 |

---

## 十一、新对话启动指南

在新对话中发送以下内容即可继续开发:

```
我在开发缘合(YuanHe)App，一个命理+AI社交匹配应用。

项目文档在这个文件里（上传YUANHE_PROJECT_DOC.md）

仓库: https://github.com/ericjepsen9/chat-Fortune-telling (main分支)
服务器: https://yuanhe.caughtalert.com/app

请先阅读文档了解项目状态，然后我们继续开发。
```
