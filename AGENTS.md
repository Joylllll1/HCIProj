# AGENTS.md

给 AI coding agent 的项目说明。人类入口见 [README](README.md)，架构细节见 [docs/wiki/architecture.md](docs/wiki/architecture.md)。

## 项目

NJU树洞：南京大学校园半匿名社区，课程项目。前端 React 18 + Vite 5 + Tailwind v4 + Zustand，后端 Express 4 + MongoDB / Mongoose 8，JWT + HTTP-only cookie 鉴权，SSE 做实时同步。

## 命令

前端（`cd frontend`）：

- `npm run dev` — 开发服务器，5173，`/api` 代理到 3001
- `npm run dev:demo` — 无后端演示模式，只加载 `src/data/previewApi`
- `npm test` — Vitest 单次运行
- `npm run lint` / `npm run lint:fix`
- `npm run build` — 生产构建

后端（`cd backend`）：

- `npm run dev` — nodemon 热重载，3001
- `npm run start` — 生产启动
- `npm test` — Node 原生测试
- `npm run lint` / `npm run lint:fix`
- `node src/scripts/seedUsers.js` — 写入演示账号
- `npm run seed:fortune` — 初始化每日运势数据

改完代码至少跑所在端的 `lint` 和 `test`。CI 对前端跑 lint / test / build，对后端跑 lint / test。

## 不能改坏的约定

- 浏览器侧一律走同源 `/api`，不要重新引入 `localStorage` token 或跨域请求
- 登录态是 HTTP-only cookie：`accessToken` 15m、`refreshToken` 7d；收到 401 时静默刷新并重放一次原请求
- 帖子与评论用逻辑删除（`isDeleted`），草稿物理删除，用户只封禁不物理删除
- 匿名展示名由 `hash(userId + ':' + postId)` 映射（`frontend/src/utils.js`）：同一用户在同一帖内稳定、跨帖不同。不要改成全局固定昵称
- 图片暂用内联 base64 Data URL，改动时留意列表接口体积
- 通知中心是“SSE 触发刷新 + 轮询兜底”，不是纯推送
- 前端路由是 `activePage + history API`，尚未使用 React Router，不要擅自引入
- UI 文案统一简体中文；正文对比度与键盘可达性属于验收项

## 结构与样式

前端 `src/components` 分四层：`pages/` 页面、`features/` 功能块、`layout/` 外壳、`common/` 基础组件；状态在 `store/`，请求在 `services/`，复用逻辑在 `hooks/`。

- Tailwind v4 用 `@import "tailwindcss"`，不是 `@tailwind` 指令
- 主题 token 在 `src/tailwind.css` 的 `@theme`；深色主题在 `src/styles/community.css` 的 `[data-theme="dark"]` 规则里
- 布局用语义 class（`.mobile-nav`、`.search-box`），不要堆长串内联工具类

后端走 Routes → Controllers → Services → Models，错误统一用 `AppError`。AI 代码在 `services/llm/`（client、toolLoop、sseEvents）与 `services/tools/`（帖子、热点、搜索、抓网页）。

## Git

- 分支：`feature/<模块>-<简述>`、`fix/<模块>-<简述>`、`docs/<简述>`
- 提交：Conventional Commits，如 `feat(auth): 实现 JWT 登录`
- 鉴权、匿名映射、权限控制属于安全相关代码，需要额外 review
- 主分支 `main`

## 文档

需求与方案记录在 `docs/superpowers/`，wiki 在 `docs/wiki/`，产品与界面约定在 `docs/design/`，改版说明在 `docs/frontend-redesign.md`。改架构前先读 `docs/wiki/architecture.md`。
