# 架构设计

## 整体架构

渐进式分层架构（ADR-001）。代码仍按前后端分层组织，但当前鉴权实现要求浏览器侧同源访问：

- 开发环境：前端通过 Vite 代理把 `/api` 转发到后端
- 生产环境：建议由 Nginx 或同类反向代理把前端静态资源与 `/api` 挂到同一 origin
- 当前浏览器请求默认走相对路径 + cookie，会话模型不再支持“前端页面直接跨域调用后端并靠 Bearer token 鉴权”

```
┌─────────────────────────────────────────────────────────┐
│                      Nginx (反向代理)                    │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌───────────────┐       ┌───────────────┐
        │   Frontend    │       │   Backend     │
        │   (静态资源)  │       │   (Express)   │
        └───────────────┘       └───────────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
                │    Redis      │ │   MongoDB     │ │   OSS/本地    │
                │   (缓存)      │ │   (数据库)    │ │   (文件存储)  │
                └───────────────┘ └───────────────┘ └───────────────┘
```

## 模块划分

### 后端模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| Auth | 注册、登录、登出、Token 管理 | authRoutes.js, authController.js, authService.js |
| Post | 帖子增删改查、点赞、收藏 | postRoutes.js, postController.js, postService.js |
| Draft | 草稿保存、编辑、发布、删除 | draftRoutes.js, draftController.js, draftService.js |
| Comment | 评论增删、点赞、嵌套回复 | commentRoutes.js, commentController.js, commentService.js |
| Search | 全文搜索、标签筛选 | searchRoutes.js, searchController.js, searchService.js |
| Report | 举报创建与处理 | reportRoutes.js, reportController.js, reportService.js |
| Admin | 用户管理、匿名追溯、公告、审计日志 | adminRoutes.js, adminController.js, adminService.js |
| **Anonymous Service** | 匿名 ID 生成、验证、追溯（核心独立模块） | anonymousService.js, AnonymousMapping.js |
| Moderation | 内容审核、举报处理逻辑 | moderationService.js |
| AI | 内容摘要、违规初筛（可选） | aiService.js |
| Fortune | 每日运势、抽签（可选） | fortuneRoutes.js, fortuneService.js |

### 前端模块

| 层级 | 职责 | 关键文件 |
|------|------|----------|
| Pages | 页面级组件 | components/pages/ |
| Features | 功能组件（post/comment/daily/report/ai） | components/features/ |
| Layout | 布局组件（Header/Sidebar/MainLayout） | components/layout/ |
| Common | 通用组件（Button/Modal/Toast/Card） | components/common/ |
| Hooks | 逻辑封装 | hooks/useAuth.js, usePosts.js, useComments.js, useAnonymous.js |
| Store | Zustand 全局状态 | store/authStore.js, postStore.js, draftStore.js, commentStore.js, uiStore.js |
| Services | API 调用 | services/authService.js, postService.js, ... |

## 核心数据流

### 发帖流程（展示匿名服务的核心位置）

```
用户点击发帖 → PostController.create()
  → PostService.create()
    → AnonymousService.generateId(userId, postId)  ← 生成匿名 ID
    → PostModel.create()                            ← 存储帖子
    → AnonymousMappingModel.create()                ← 加密存储映射
    → Redis.set(anon_cache_key, anonId)             ← 缓存匿名 ID
  → 返回帖子 ID + 匿名 ID
```

### 评论流程

```
用户点击评论 → CommentController.create()
  → CommentService.create()
    → AnonymousService.getDisplayId(userId, postId)  ← 获取/生成匿名 ID
    → CommentModel.create()
  → 返回评论 ID + 匿名 ID
```

### 管理员追溯流程

```
管理员查看举报 → AdminController.traceAnonymous()
  → AdminService.traceAnonymous()
    → AnonymousService.trace(anonId)     ← 追溯真实身份
    → AuditLogModel.create()             ← 记录审计日志（必须）
  → 返回用户 ID + 帖子 ID
```

### 实时同步流程（SSE）

```
客户端建立 EventSource('/api/stream')
  → SSE Route 通过 HTTP-only cookie 校验 JWT
  → sseManager 将连接登记到 Map<userId, Set<client>>

业务事件发生（发帖 / 删帖 / 评论 / 回复）
  → 对应 Service 完成数据库写入
  → Service 调用 broadcast(eventName, payload)
  → 在线客户端收到事件
  → 前端按页面场景刷新 store 或移除本地数据
```

当前已接入的事件：

- `new-post`：首页在线用户静默刷新帖子列表
- `post-deleted`：首页在线用户同步移除已删除帖子
- `comment-created`：帖子详情页同步插入评论并更新评论数
- `comment-deleted`：帖子详情页同步移除评论子树并更新评论数
- `reply-created`：帖子详情页同步插入回复并更新评论数
- `reply-deleted`：帖子详情页同步移除回复并更新评论数

当前未接入 SSE、仍保留轮询或显式刷新：

- 通知中心：`30s` 轮询 + 页面重新可见时立即刷新
- 点赞 / 收藏状态
- 活动相关更新

## 架构原则

1. **渐进式改进**：在现有代码基础上完善分层，不推倒重来（ADR-001）
2. **匿名逻辑独立**：所有匿名操作必须通过 AnonymousService，不可跨模块直连（ADR-002）
3. **服务层为核心**：业务逻辑集中在 Service，Controller 只做参数校验和响应组装
4. **逻辑删除优先**：正式内容（帖子、评论）使用逻辑删除，草稿可物理删除
5. **审计可追溯**：管理员操作必须记录审计日志，确保"对内可治理"可验证
6. **缓存加速**：匿名 ID 映射、热门帖子、JWT 黑名单走 Redis 缓存

## 不采用的方案及原因

| 方案 | 不采用原因 |
|------|-----------|
| 微服务 | 过度设计，4 人团队单项目 |
| Next.js 全栈 | 约束已指定 Vite + Express 分离 |
| 纯 MVC | 匿名映射逻辑复杂，需要独立 Service 层 |
| Redux | 对项目规模过重，Zustand 更合适（ADR-003） |

## 当前实现状态

> 以下内容描述当前仓库中的实际落地情况，而不是最初的目标占位状态。

### 前端现状

| 层面 | 当前实际 |
|------|----------|
| 状态管理 | 已使用 Zustand，核心 store 包括 `authStore`、`postStore`、`commentStore`、`bookmarkStore`、`notificationStore`、`uiStore` 等 |
| Hooks | 已有 `useAuth`、`usePostActions`、`useLikeBookmark`、`useEventActions`、`useNotificationPolling` 等逻辑封装 |
| Services | 已有 `services/` API 封装，统一通过 `apiClient` 发请求 |
| 组件分层 | 已按 `pages / features / layout / common` 分层组织 |
| 路由方式 | 仍以 `activePage` + `history API` 的轻量 SPA 路由为主，未引入 React Router |
| 实时同步 | 已有全局 `/api/stream` SSE 连接，首页和详情页消费部分实时事件 |

### 后端现状

- 已具备完整 `routes / controllers / services / models / middlewares / utils` 分层
- 已接入 MongoDB 与 Mongoose，正式内容使用逻辑删除
- 已实现认证、帖子、评论、草稿、通知、活动、管理后台、AI、SSE 等模块
- SSE 入口为 `GET /api/stream`，由 `sseManager` 通过 cookie 鉴权并维护在线连接
- 登录态采用 `HTTP-only cookie`：
  - `accessToken` 默认 15 分钟
  - `refreshToken` 默认 7 天
  - 受保护接口命中 `401` 时，前端会尝试静默刷新并重放一次原请求

### 当前仍保留的历史/现实约束

1. 前端尚未迁移到 React Router，页面切换与部分数据加载仍集中在 `App.jsx`
2. 通知暂未接入 SSE，仍使用轮询策略
3. 图片仍以内联 base64 Data URL 为主，列表接口存在传输偏重问题
4. 若未来需要恢复浏览器侧跨域直连后端，需重新补齐 `credentials: 'include'`、精确 `cors(origin, credentials)`、cookie `sameSite/secure` 策略，以及对应部署文档
