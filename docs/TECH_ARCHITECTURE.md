# Paper Pulse 技术架构文档

## 1. 项目概述

Paper Pulse 是一个基于 AI 的科研论文发现与阅读助手，帮助用户追踪 arXiv 和 OpenReview 上的最新论文，提供 AI 摘要、翻译、笔记等功能。

**技术栈：**
- **前端**：Next.js 16 + React 19 + TypeScript
- **样式**：Tailwind CSS 4 + shadcn/ui
- **后端**：Next.js API Routes
- **数据库**：PostgreSQL (Supabase) + Prisma ORM
- **AI**：SiliconFlow API (OpenAI 兼容)

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面 (Browser)                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │
│  │ 首页    │  │ Feed    │  │ Library │  │ 论文详情页          │ │
│  │ (Papers)│  │ (推荐)  │  │ (收藏)  │  │ (PDF/笔记/AI聊天)   │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────────┬──────────┘ │
└───────┼────────────┼────────────┼──────────────────┼────────────┘
        │            │            │                  │
        ▼            ▼            ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js App Router                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  API Routes                                                ││
│  │  ├── /api/chat          - AI 对话与摘要生成               ││
│  │  └── /api/cron/fetch-papers - 定时抓取论文                ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  SiliconFlow  │   │  PostgreSQL   │   │ localStorage  │
│  (AI 服务)    │   │  (Supabase)   │   │  (浏览器缓存)  │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## 3. 核心模块

### 3.1 论文数据流

```
arXiv API          OpenReview API       Cron Job
     │                   │                 │
     ▼                   ▼                 ▼
┌─────────────────────────────────────────────────────┐
│            /api/cron/fetch-papers                   │
│  • XML 解析 (fast-xml-parser)                        │
│  • 数据清洗与格式化                                  │
│  • 存储到 PostgreSQL                                 │
└─────────────────────────────────────────────────────┘
```

**论文来源：**
- **arXiv**：通过 arXiv API 获取最新论文
- **OpenReview**：爬取 OpenReview 会议论文

### 3.2 核心页面

| 页面 | 路由 | 功能 |
|------|------|------|
| 首页 | `/` | 论文列表展示，按日期/分类筛选 |
| Feed | `/feed` | 个性化推荐，随机展示 |
| Library | `/library` | 收藏的论文管理 |
| 论文详情 | `/paper/[id]` | PDF阅读、AI摘要、笔记、聊天 |

### 3.3 论文详情页布局

```
┌──────────────────────────────────────────────────────────────────┐
│  左侧 (3列)         │  中间 (6列)           │  右侧 (3列)        │
│  ┌───────────────┐  │  ┌────────────────┐   │  ┌──────────────┐ │
│  │ 详细信息      │  │  │ 摘要 │速览     │   │  │              │ │
│  │ • 来源        │  │  │ PDF  │AI摘要   │   │  │  AI 对话     │ │
│  │ • 发布时间    │  │  │ 笔记 │翻译     │   │  │  聊天界面    │ │
│  │ • 作者        │  │  └────────────────┘   │  │              │ │
│  │ • 标签        │  │                       │  │              │ │
│  │ • 收藏按钮    │  │                       │  │              │ │
│  │ • PDF/来源链接│  │                       │  │              │ │
│  └───────────────┘  │                       │  └──────────────┘ │
│                     │                       │                    │
│  ┌───────────────┐  │                       │                    │
│  │ 相关论文      │  │                       │                    │
│  └───────────────┘  │                       │                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. 数据库设计

### 4.1 数据模型

```prisma
model Paper {
  id          String   @id @default(uuid())
  title       String
  authors     String[]
  abstract    String?
  source      String   // 'arxiv' | 'openreview'
  sourceUrl   String?
  pdfUrl      String?
  tags        String[]
  highlights  String[]
  publishedAt DateTime?
  createdAt   DateTime @default(now())

  chatHistory ChatHistory[]
  annotations Annotation[]
}

model ChatHistory {
  id        String   @id @default(uuid())
  paperId   String
  role      String   // 'user' | 'assistant'
  content   String
  createdAt DateTime @default(now())
}

model Annotation {
  id          String   @id @default(uuid())
  paperId     String
  content     String
  color       String   @default("yellow")
  position    Int?
  pageNumber  Int?
  createdAt   DateTime @default(now())
}

model UserPreferences {
  id         String   @id @default(uuid())
  userId     String   @unique
  keywords   String[]
  authors    String[]
  categories String[]
}
```

---

## 5. AI 功能

### 5.1 SiliconFlow 集成

使用 SiliconFlow API（OpenAI 兼容）提供以下功能：

| 功能 | API 参数 | 说明 |
|------|----------|------|
| 摘要生成 | `isSummaryRequest` | 生成论文摘要 |
| 翻译 | `isTranslationRequest` | 英译中摘要 |
| 速览 | `isOverviewRequest` | 生成动机/方法/结果/结论 |
| 对话 | 默认 | 基于论文内容的问答 |

**配置：**
```env
OPENAI_API_KEY=sk-xxx          # SiliconFlow API Key
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
```

---

## 6. 关键技术点

### 6.1 状态管理

- **Zustand**：用户偏好、阅读历史、收藏库
- **localStorage**：翻译缓存、速览缓存、用户设置

### 6.2 PDF 展示

- **arXiv PDF**：可直接嵌入 iframe
- **OpenReview PDF**：因跨域限制，显示"在新窗口打开"按钮

### 6.3 样式系统

- **Tailwind CSS 4**：原子化 CSS
- **shadcn/ui**：基于 Radix UI 的组件库
- **暗色模式**：支持明暗主题切换

---

## 7. 环境变量

```env
# 数据库
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...

# AI
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.siliconflow.cn/v1

# 安全
CRON_SECRET=my-secret-token-xxx

# 开关
USE_MOCK_DATA=false
```

---

## 8. 部署

- **平台**：Vercel / 本地
- **数据库**：Supabase (PostgreSQL)
- **构建**：`npm run build` → `npm run start`
