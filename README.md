# 银发织音 (SilverVoice)

> 基于大语言模型的老年人情感陪伴与数字口述史构建平台。
>
> **核心哲学：老人只需按住说话，剩下的全部交给 AI。**

---

## 一、产品概述

"银发织音"专为 60 岁以上老年人设计，解决三个根本痛点：

| 痛点 | 传统方案 | 银发织音 |
|------|----------|----------|
| 打字困难 | 键盘/手写输入 | **全语音交互**，按住按钮即说 |
| 界面复杂 | 多层菜单、弹窗 | **单页面单按钮**，零选择焦虑 |
| 记忆流失 | 无人记录老人故事 | **自动转写→润色→编年归档**，构建数字回忆录 |

---

## 二、核心功能模块

### 功能一：极简语音交互（回忆录音室）

单按钮全语音交互。老人按住呼吸灯麦克风按钮说话，松手即自动上传、转写、归档。全程零跳转、零菜单、零选择。

**适老化指标**：

| 维度 | WCAG 标准 | 本项目 |
|------|----------|--------|
| 文字大小 | ≥18px | 正文 24px / 按钮 32px / 标题 40px |
| 颜色对比度 | ≥7:1 (AAA) | 主文字 15.3:1 / 辅助文字 **10.5:1**（实测） |
| 最小点击热区 | 44×44px | **120×120px**（3 倍标准） |
| 页面按钮数 | — | **1 个** |
| 登录步骤 | — | **0 步**（微信静默免密） |
| 防手抖 | — | 300ms Ref 去抖（非异步 State） |
| 离线兜底 | — | Taro Storage 队列 + 网络恢复自动重传 |
| 弱网提示 | — | 实时音量检测 + 低音量震动提醒 |
| 键盘无障碍 | — | Enter/Space 键操作 + focus-visible 焦点环 |
| 屏幕阅读器 | — | aria-live 动态播报 + aria-label 完整标注 |

### 功能二：数字回忆录自动构建

DeepSeek-R1「数字史官」AI 后台静默完成：口语润色 → 时间线 JSON 提取 → 情绪标签 + 情绪强度评分 → 关键词归档 → **实体关系知识图谱**。所有记忆按时间轴存入 Supabase，支持按年份/情绪/关键词/实体检索。

### 功能三：情感陪伴对话

GLM-4-Flash 温情大模型扮演"认识几十年的老朋友"。回复 ≤50 字适配 TTS，**知识图谱实体链接**让 AI 记住老人故事中的人物和地点，情绪感知自动调整口吻。

### 功能四：双模型智能路由（核心技术）

```
POST /api/voice-chat
    │
    ├── [干线 - 同步] ── GLM-4-Flash ──→ 温情回复 (≤5s, 免费)
    │    AbortSignal.any(client, timeout)   ↓ 前端 TTS 播报
    │    客户端断连 → 自动取消
    │    知识图谱实体注入 Prompt
    │
    └── [支线 - 异步] ── DeepSeek-R1 ──→ Supabase
         并发闸门 (max 5)     润色+时间线+实体关系   memories 表
         JSON 解析重试 (2次)                memory_entities 表
         Vercel waitUntil                   memory_relations 表
         processing_logs 兜底              情绪异常检测 (7d)
```

- **模型选型**：干线 GLM-4-Flash（智谱免费提供，情感陪伴场景优化）；支线 DeepSeek-R1（JSON 结构化提取最稳，¥0.004/千 token）
- **断连检测**：`request.signal` 传入干线，老人退出则取消 API 调用，不浪费费用
- **并发控制**：后台 DeepSeek 最多 5 个并行，防止内存膨胀
- **容错兜底**：DeepSeek 成功 → 先写 `processing_logs` 持久化原始响应 → 再写 `memories`
- **等幂保护**：`idempotency_key` 唯一约束，前端重试不创建重复记录
- **演示模式**：`?demo=true` 跳过真实 API 调用，返回预设数据，路演不翻车

### 功能五：SSE 流式对话

新增 `/api/voice-chat/stream` 端点，GLM-4-Flash 回复通过 Server-Sent Events 逐 token 推送，前端实时展示 AI 打字效果，感知延迟从 3-5s 降至 <1s。

### 功能六：情绪预警与关怀闭环

- `emotion_score`（0-1 数值）随每段记忆写入数据库
- `detectMoodAnomaly()`：连续 3 条以上负面情绪记忆 → 自动标记预警
- `/api/guardian/alert`：子女端一键查看所有绑定老人的情绪状态
- 从"情感陪伴"升级为"预防性关怀"

### 功能七：家族记忆共享 + 情绪热力图 + PDF 导出

子女端可查看：
- **情绪热力图**：`daily_mood` 物化视图，按天 × 情绪标签聚合，单次查询 <1s
- **时间线浏览**：按年份查看老人全部记忆
- **老照片补充**：上传关联到对应记忆
- **PDF 回忆录**：Puppeteer 渲染 A4 精装排版，含内联 SVG 情绪图表 + 楷体排版

---

## 三、数据库架构

```
profiles ──→ bindings ──→ profiles
  (子女)     多对多        (老人)
    │                       │
    │              ┌────────┼────────┬────────────┐
    │              ↓        ↓        ↓            ↓
    │         memories  chat_logs  magic_tokens  memory_entities
    │         (回忆录)   (聊天记录)  (免密令牌)    (知识图谱实体)
    │              │                     │            │
    │         processing_logs            └── memory_relations
    │         (LLM 原始响应兜底)            (实体关系网络)
    │              │
    │         daily_mood
    │         (情绪物化视图)
```

**9 张表 + 1 个物化视图**，完整 RLS 行级安全策略。详见 `supabase/schema.sql`。

---

## 四、项目文件结构

```
silver-hair-weaver/
├── supabase/
│   ├── schema.sql                  # 9 表 + 物化视图 + RLS 策略
│   └── ARCHITECTURE.md             # 鉴权设计说明
│
├── taro-frontend/                  # Taro 微信小程序 + H5
│   ├── src/
│   │   ├── app.tsx                  # 入口组件
│   │   ├── app.css                  # 全局样式 + reduced-motion
│   │   ├── app.config.ts            # 小程序配置（含录音权限）
│   │   ├── pages/
│   │   │   └── recording-studio/    # 唯一页面（回忆录音室）
│   │   │       ├── index.tsx         #   状态机 + 全链路语音管线
│   │   │       ├── index.css        #   圆形倒计时 / fadeInUp 动画
│   │   │       └── index.config.ts  #   全屏沉浸，隐藏导航栏
│   │   ├── components/
│   │   │   └── ElderlyButton/      # 适老化通用按钮组件
│   │   │       ├── index.tsx        #   键盘+触屏双模 + ARIA 无障碍
│   │   │       └── index.css        #   breathe 呼吸灯 keyframes
│   │   └── services/
│   │       └── voice-pipeline.ts    #   STT/SSE/TTS 管线集成点
│   ├── config/
│   │   └── index.ts                 # Taro 构建配置
│   ├── tailwind.config.js           # 色板 (10.5:1 对比度) + 字号体系
│   ├── postcss.config.js
│   ├── project.config.json
│   └── package.json
│
├── nextjs-backend/                 # Next.js 14 App Router
│   ├── app/api/
│   │   ├── voice-chat/
│   │   │   ├── route.ts            # ★ 双模型路由（干线+支线异步）
│   │   │   └── stream/route.ts     # ★ SSE 流式对话
│   │   ├── guardian/
│   │   │   └── alert/route.ts      # ★ 情绪预警端点
│   │   ├── memory/
│   │   │   ├── process/route.ts    # 单模型深度处理
│   │   │   └── export-pdf/route.ts # Puppeteer PDF 导出
│   ├── lib/
│   │   ├── model-services.ts       # GLM-4-Flash + DeepSeek-R1 服务函数
│   │   ├── prompts.ts              # Prompt A (史官) + Prompt B (伴侣)
│   │   └── supabase.ts             # DB + 实体查询 + 情绪异常检测
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   ├── .env.local
│   └── package.json
│
├── UI-DESIGN-REPORT.md             # UI/UX 审计报告
├── CHALLENGE-CUP-SCORING.md        # 挑战杯评分分析
└── README.md
```

---

## 五、快速开始

### 后端（演示模式无需 API Key）

```bash
cd nextjs-backend
cp .env.example .env.local          # 可选：填入 GLM / DeepSeek Key
npm install                          # PUPPETEER_SKIP_DOWNLOAD=true 跳过 Chromium
npm run dev                          # → http://localhost:3000
```

**立即可用的端点（无需任何 API Key）：**

```bash
# 演示模式 — 不消耗 AI 费用
curl -X POST "http://localhost:3000/api/voice-chat?demo=true" \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"我今天翻到一张老照片","user_id":"test"}'
# → {"reply_text":"老槐树下的春天。那天的风一定很温柔吧。","emotion_hint":"怀旧"}

# 健康检查
curl http://localhost:3000/api/voice-chat         # 双模型路由
curl http://localhost:3000/api/guardian/alert?guardian_id=test  # 情绪预警
curl http://localhost:3000/api/memory/process      # 深度处理
curl http://localhost:3000/api/memory/export-pdf   # PDF 导出
```

### 前端

```bash
cd taro-frontend
npm install
npm run dev:h5        # 浏览器调试 → http://localhost:10086
# 或
npm run dev:weapp     # 微信开发者工具打开 dist/
```

### 数据库

1. 注册 [supabase.com](https://supabase.com) → 创建项目
2. SQL Editor → 粘贴 `supabase/schema.sql` → Run
3. 将项目 URL / anon key / service_role key 填入 `.env.local`

---

## 六、接入大模型

### 干线：GLM-4-Flash（智谱 AI）

1. 注册 [智谱 AI 开放平台](https://open.bigmodel.cn)
2. 个人开发者免费，新用户赠送 2000 万 tokens
3. 在控制台 → API Keys 复制 key
4. 填入 `.env.local` 的 `GLM_API_KEY=你的key`
5. GLM-4-Flash 完全兼容 OpenAI SDK，无需改代码

**免费额度足够竞赛期间全部测试和路演。**

### 支线：DeepSeek-R1

1. 注册 [DeepSeek Platform](https://platform.deepseek.com)
2. 点击右上角头像 → API Keys → 创建新 Key
3. 复制 key 填入 `.env.local`：
   ```
   DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
   DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
   DEEPSEEK_MODEL=deepseek-reasoner
   ```
4. R1 的价格为 ¥0.004/千 token（输入） + ¥0.016/千 token（输出），你的 Prompt 每段记忆约 500 token 输入 + 1000 token 输出，单次归档约 **¥0.02**
5. 首次使用需充值（最低 ¥10），够跑约 500 次记忆归档

**DeepSeek-R1 与 V3 的区别**：R1 是推理增强模型，输出 JSON 结构更稳，而且会把推理链和最终输出分开（`reasoning_content` / `content`），代码已处理这种情况。

---

## 七、API 端点总览

| 端点 | 方法 | 说明 | 需要 API Key |
|------|------|------|:--:|
| `/api/voice-chat` | GET | 健康检查 + 模型信息 | - |
| `/api/voice-chat` | POST | 双模型路由 | GLM + DeepSeek |
| `/api/voice-chat?demo=true` | POST | 演示模式（预设数据） | - |
| `/api/voice-chat/stream` | POST | SSE 流式对话 | GLM |
| `/api/guardian/alert` | GET | 情绪预警查询 | - |
| `/api/memory/process` | GET | 健康检查 | - |
| `/api/memory/process` | POST | 单模型深度润色 | OpenAI 兼容 |
| `/api/memory/export-pdf` | GET | 健康检查 | - |
| `/api/memory/export-pdf` | POST | 导出回忆录 PDF | - |

---

## 八、故障排查

| 问题 | 解决方法 |
|------|----------|
| `fetch failed` | `.env.local` 中 Supabase 配置未填（演示模式不受影响） |
| GLM 返回 401 | `.env.local` 中 `GLM_API_KEY` 未填或过期，去 [open.bigmodel.cn](https://open.bigmodel.cn) 重新生成 |
| DeepSeek 返回 402 | 余额不足，去 [platform.deepseek.com](https://platform.deepseek.com) 充值（最低 ¥10） |
| 端口被占用 | `npx kill-port 3000` 或重启终端 |
| Puppeteer 安装失败 | 已在 package.json 标记为 optional，不影响核心 API |
| Taro 编译报错 | Node ≥18，删除 `node_modules` 后重装 |
