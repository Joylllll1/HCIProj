# NJU树洞

> 面向南京大学校园场景的半匿名表达、互助交流与内容治理平台，围绕“前台匿名展示、后台可治理追责”的原则构建。

## 一、项目概览

NJU树洞是一套前后端分离的校园社区系统，核心目标是在“低压力表达”与“可治理、可追责”之间取得平衡。当前仓库已经具备可运行的主链路，包括注册登录、匿名发帖、评论回复、点赞收藏、通知中心、校园公告、管理后台，以及带工具调用能力的 AI 助手。

当前浏览器侧部署口径已经收口为：

- 开发环境：前端通过 Vite 代理把 `/api` 转发到后端
- 生产环境：建议由 Nginx 或同类反向代理把前端静态资源与 `/api` 挂到同一 origin
- 登录态：`HTTP-only cookie`，不再依赖 `localStorage token`

## 二、功能特性

| 模块 | 当前能力 |
|------|-----------|
| `🔐 认证 / 用户` | 邮箱注册、邮箱密码登录、邮箱验证码、忘记密码、修改密码、个人资料与通知偏好 |
| `📝 内容社区` | 匿名发帖、帖子详情、评论、回复、删帖删评、举报 |
| `❤️ 点赞 / 收藏` | 帖子点赞、评论点赞、回复点赞、收藏夹管理、收藏关系落库 |
| `📂 个人内容` | 草稿箱、我的帖子、我的喜欢、我的收藏 |
| `📣 校园公告 / 活动` | 公告流展示、活动申请、我的申请记录、管理员审核活动 |
| `🔔 通知中心` | 通知列表、未读数、单条已读、全部已读、点击跳转；SSE 事件触发即时刷新，轮询兜底 |
| `🤖 AI 助手` | 多会话聊天、SSE 流式回复、停止生成、重新生成、人格设置；可结合帖子详情页上下文总结帖子与评论区、查看站内热点、联网搜索实时信息，并抓取网页正文做二次核实 |
| `🛡️ 管理后台` | 举报处理、删帖删评、封禁 / 解禁、审计日志、活动审核 |
| `⚡ 实时能力` | 基于 SSE 的新帖、删帖、帖子统计、评论 / 回复变更同步 |
| `🎨 体验细节` | 桌面 / 移动端布局、图片灯箱、确认离开弹窗、Toast、首页搜索与后端分页排序 |
| `🍀 轻量扩展` | 每日签到 / 运势状态查询 |

## 三、技术栈

| 层次 | 选型 |
|------|------|
| 前端 | React 18 · Vite 5 · Tailwind CSS v4 · Zustand 5 · GSAP |
| 后端 | Node.js ESM · Express 4 · MongoDB · Mongoose 8 |
| 鉴权 | JWT + HTTP-only Cookie（`accessToken` / `refreshToken`） |
| 实时通信 | SSE（Server-Sent Events） |
| 邮件能力 | Nodemailer |
| AI | OpenAI 兼容 Chat Completions 接口 · DeepSeek 等可替换模型 · 后端 tool call + SSE 流式输出 |
| 测试 | Vitest · Testing Library · Node `--test` |
| 工程化 | ESLint · GitHub Actions |

## 四、系统架构

### 4.1 整体形态

- `frontend/`：React 单页应用
- `backend/`：Express + MongoDB API 服务
- 会话模型：同源请求 + cookie
- 开发环境：Vite 代理 `/api -> http://localhost:3001`
- 生产环境：建议前后端同源反代部署

### 4.2 后端目录

```text
backend/src
├── config/         数据库连接与基础配置
├── controllers/    路由入口、参数处理、响应组织
├── middlewares/    鉴权、权限、封禁校验、错误处理
├── models/         Mongoose 模型
├── routes/         API 路由注册
├── scripts/        种子数据与初始化脚本
├── services/       核心业务逻辑、AI 子模块、SSE 管理
│   ├── llm/        LLM 客户端、tool loop、SSE 事件转换
│   └── tools/      AI 可调用工具
└── utils/          JWT、cookie、图片校验、错误封装等通用工具
```

### 4.3 前端目录

```text
frontend/src
├── components/
│   ├── common/     通用组件
│   ├── features/   AI、举报、运势、轮播等功能组件
│   ├── layout/     顶栏、侧栏、移动端导航
│   └── pages/      页面级组件
├── hooks/          逻辑封装
├── services/       API 请求层
├── store/          Zustand 全局状态
├── test/           测试初始化
└── utils/          搜索、图片等工具函数
```

### 4.4 当前关键实现约束

- 登录态不再依赖 `localStorage token`
- `accessToken` 默认 `15m`，`refreshToken` 默认 `7d`
- 受保护请求命中 `401` 时，前端会尝试静默刷新并重放一次原请求
- 首页已经切为后端分页、后端搜索、后端排序，并支持“加载更多”
- 首页和帖子详情页的部分状态通过 SSE 同步
- 通知中心采用“SSE 触发刷新 + 轮询兜底”的混合策略
- 图片仍以内联 base64 Data URL 传输，已有限制，但传输瘦身和存储治理仍是后续项
- 前端路由仍以 `activePage + history API` 为主，尚未迁移到 React Router

## 五、快速上手

### 5.1 前置依赖

- Node.js `>= 18`
- npm
- MongoDB

### 5.2 安装依赖

后端：

```bash
cd backend
npm install
```

前端：

```bash
cd frontend
npm install
```

### 5.3 配置后端环境变量

根据模板创建配置文件：

```bash
cp backend/.env.example backend/.env
```

#### 必填

这些字段属于最小可运行配置：

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/treehole
JWT_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me-too
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

#### 条件必填

这些字段是否必填，取决于你是否需要对应能力：

- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`
  - 本地开发：可不配
  - 真实注册 / 找回密码 / 修改密码流程：部署环境中应视为必配
  - 不配置时，验证码不会发到邮箱，而是打印在后端控制台日志里，仅适合本地调试

- `LLM_API_KEY`
  - 需要 AI 助手时必配
  - 不配置时，AI 接口会返回“AI 服务未配置”，不影响其他模块

#### 可选

- `LLM_API_URL` / `LLM_MODEL`
  - 需要切换 AI 提供方或模型时配置
  - 默认使用 DeepSeek OpenAI 兼容接口

- `AI_WEB_SEARCH_BAIDU_API_KEY` / `AI_WEB_SEARCH_BAIDU_URL`
  - 需要 AI 联网搜索时配置
  - 不配置时，AI 仍可聊天，但无法稳定获取实时外部信息

- `ADMIN_CONTACT_QQ`
  - 用于禁言 / 解禁等通知文案中的联系信息

- `VERIFY_CODE_EXPIRES_MIN`
  - 控制验证码有效期，默认 5 分钟

- `ACCESS_COOKIE_MAX_AGE_MS` / `REFRESH_COOKIE_MAX_AGE_MS` / `COOKIE_SAME_SITE`
  - 用于微调 cookie 策略

### 5.4 启动后端

```bash
cd backend
npm run dev
```

默认地址：

- API：`http://localhost:3001`
- 健康检查：`http://localhost:3001/api/health`

### 5.5 启动前端

```bash
cd frontend
npm run dev
```

默认地址：

- Web：`http://localhost:5173`

开发环境下，前端会自动把 `/api/*` 请求代理到 `http://localhost:3001`。

## 六、演示数据与本地调试

### 6.1 可选种子数据

创建演示用户：

```bash
cd backend
node src/scripts/seedUsers.js
```

脚本会创建：

- 管理员：`admin@nju.edu.cn / 12345678`
- 普通用户：`test@nju.edu.cn / 12345678`

初始化每日运势数据：

```bash
cd backend
npm run seed:fortune
```

### 6.2 本地开发注意事项

- 如果未配置 SMTP，验证码会打印在后端控制台日志里
- 如果前端接口全部 `401` 或无数据，优先检查：
  - 后端是否已启动
  - MongoDB 是否可连
  - `backend/.env` 是否存在且配置正确
- 如果后端测试命令提示找不到测试文件，先确认你使用的是仓库当前版本；旧版本里这个脚本写法曾经有过兼容性问题
- 如果把前端页面和后端 API 放到不同 origin，而没有额外补 cookie 跨域配置，登录态会失效

## 七、常用命令

### 7.1 前端

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

### 7.2 后端

```bash
cd backend
npm run dev
npm run start
npm run lint
npm run test
npm run seed:fortune
node src/scripts/seedUsers.js
```

## 八、API 模块概览

当前后端主要路由模块如下：

| 路由前缀 | 作用 |
|----------|------|
| `/api/auth` | 注册、登录、刷新会话、登出、获取当前用户、改资料、改密码 |
| `/api/verify` | 发送验证码、校验验证码 |
| `/api/password` | 忘记密码、重置密码 |
| `/api/posts` | 帖子列表、详情、发帖、删帖、点赞、举报 |
| `/api/comments` | 评论、回复、删除、评论点赞、回复点赞 |
| `/api/likes` | 我的喜欢列表 |
| `/api/bookmarks` | 收藏夹、收藏迁移、收藏增删改 |
| `/api/drafts` | 草稿创建、查询、更新、删除、发布 |
| `/api/events` | 活动 / 公告流、申请、审核 |
| `/api/notifications` | 通知列表、未读数、已读 |
| `/api/admin` | 举报处理、删帖删评、封禁管理、审计日志 |
| `/api/fortune` | 每日签到 / 运势状态 |
| `/api/ai` | AI 会话、聊天、重生成、人格设置 |
| `/api/stream` | SSE 实时推送 |

## 九、AI 工具调用说明

AI 助手当前采用后端 tool call + 前端 SSE 流式展示的方式工作。

当前已接入的能力包括：

- 结合当前帖子详情页上下文总结帖子内容
- 在评论已加载的前提下，总结评论区或分析争论点
- 获取站内热点话题
- 联网搜索实时信息
- 抓取具体网页正文，对搜索结果做二次核实

当前不应在 README 中夸大为“找任务 / 找组队 / 搜二手”等能力，因为仓库里并没有这些业务工具。

## 十、测试与 CI

### 10.1 本地测试

前端：

```bash
cd frontend
npm run test
npm run lint
npm run build
```

后端：

```bash
cd backend
npm run test
npm run lint
```

### 10.2 当前测试覆盖现状

- 前端已经有 Vitest + Testing Library 测试
  - 覆盖 `App`、部分页面、`store`、`apiClient` 等关键逻辑
- 后端已经有 Node 原生测试
  - 主要覆盖 JWT / cookie / 鉴权响应等工具层
- 当前也没有完整的端到端 E2E 测试链路

### 10.3 CI 现状

当前仓库的 GitHub Actions 仍较基础：

- 触发条件：`push / PR` 到 `main` 或 `dev`
- 当前内容：检查基础目录结构是否存在

这意味着本地测试仍然是当前质量保障主力。后续如果继续补工程化，最值的是把前后端测试和 lint 正式接入 CI。

## 十一、已知限制与后续方向

当前明确存在的约束或待优化项：

- 通知中心不是“纯 SSE 推送完整通知列表”，而是由 SSE 事件触发前端刷新通知数据，并保留轮询兜底
- 图片仍以内联 base64 形式传输，列表接口偏重
- 安全防滥用措施仍有后续空间
  - 验证码限流 / 爆破防护
  - 上传额度与资源清理
  - 更严格的 CORS / 安全头 / CSRF 方案
- 前端尚未迁移到 React Router

更细的后续项见 [docs/wiki/todo.md](docs/wiki/todo.md)。

## 十二、配置文件与运行约定

| 文件 | 用途 | 是否入库 |
|------|------|----------|
| `backend/.env.example` | 后端环境变量模板 | `是` |
| `backend/.env` | 本地真实环境变量 | `否` |
| `frontend/vite.config.js` | 前端开发代理与测试配置 | `是` |
| `docs/wiki/setup.md` | 更详细的环境搭建说明 | `是` |
| `docs/wiki/architecture.md` | 架构与设计约束说明 | `是` |

## 十三、项目结构

```text
SE2proj/
├── backend/                      # Express 后端
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   │   └── schemas/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   └── tools/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── features/
│   │   │   ├── layout/
│   │   │   └── pages/
│   │   ├── data/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── test/
│   │   └── utils/
│   └── package.json
├── docs/
│   ├── superpowers/              # 需求 / 方案 / 变更工作流文档
│   └── wiki/                     # 项目 wiki、约定、架构、待办
├── .github/workflows/ci.yml
└── README.md
```

## 十四、相关文档

| 文档 | 说明 |
|------|------|
| `docs/wiki/setup.md` | 环境搭建与常见问题 |
| `docs/wiki/architecture.md` | 当前架构、SSE、登录态与约束 |
| `docs/wiki/coding-standards.md` | 编码规范 |
| `docs/wiki/conventions.md` | 项目约定 |
| `docs/wiki/collaboration-workflow.md` | 协作流程 |
| `docs/wiki/todo.md` | 已确认但未排期的后续事项 |
| `docs/wiki/decisions/` | 架构决策记录 |

## 十五、当前状态总结

这个仓库当前不是静态展示稿，而是一套已经能跑通核心链路的校园社区系统。现阶段最重要的现实判断是：

- 主流程可跑
- README 已按当前代码实现收口
- 仍有工程化和安全面待继续补

如果 README 与代码出现冲突，以实际代码行为为准；进一步阅读建议从 [docs/wiki/setup.md](docs/wiki/setup.md) 和 [docs/wiki/architecture.md](docs/wiki/architecture.md) 开始。
