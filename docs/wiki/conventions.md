# 项目约定

> 本文件记录团队必须遵守的项目约定。新成员加入时必读。

## 阅读顺序

- 本文档：看命名、分层和基础 Git 约定
- [团队协作开发规范](./collaboration-workflow.md)：看分支、自测、PR、Review、Merge 流程

## Git 约定

### 分支命名

```
feature/<模块名>-<简述>    # 功能开发，如 feature/auth-jwt-login
fix/<模块名>-<简述>        # Bug 修复，如 fix/post-delete-logic
docs/<简述>                # 文档更新，如 docs/p2-architecture
```

### 提交信息

格式：`[AI-assisted]` 或 `[Human-written]` + 简述

```
[AI-assisted] feat(auth): 实现 JWT 登录接口
[Human-written] fix(post): 修复帖子删除权限判断
[AI-assisted] docs: 更新架构设计文档
```

**必须标注 AI 使用情况**（参见 AI 协作契约）。

### Code Review 流程

1. AI 生成的代码必须通过至少一名团队成员的 Code Review
2. 安全相关代码（认证、匿名映射、权限控制）需额外审查
3. 每位成员每个编码阶段至少有 2 个完全手写的核心函数

## 命名约定

### 后端文件命名

- 路由文件：`<模块名>Routes.js`，如 `authRoutes.js`
- 控制器：`<模块名>Controller.js`，如 `postController.js`
- 服务：`<模块名>Service.js`，如 `anonymousService.js`
- 模型：`<名称>.js`（Mongoose 模型单数），如 `User.js`、`Post.js`

### 前端文件命名

- 组件：PascalCase，如 `PostCard.jsx`、`CommentList.jsx`
- Hooks：camelCase 以 use 开头，如 `useAuth.js`、`usePosts.js`
- Services：camelCase，如 `authService.js`、`postService.js`
- Store：camelCase 以 Store 结尾，如 `authStore.js`、`postStore.js`

### API 路径命名

- 资源用复数名词：`/api/posts`、`/api/comments`
- 动作用名词而非动词：`POST /api/posts`（创建）而非 `POST /api/createPost`
- 管理员接口前缀 `/api/admin/`：`/api/admin/reports`、`/api/admin/users/:id/mute`

### 变量命名

- JavaScript 全项目使用 camelCase
- 常量使用 UPPER_SNAKE_CASE：`MAX_PAGE_SIZE`、`JWT_SECRET`
- MongoDB 字段使用 camelCase：`createdAt`、`anonymousId`
- 环境变量使用 UPPER_SNAKE_CASE：`MONGO_URI`、`REDIS_URL`、`JWT_SECRET`

## 编码约定

### 后端分层职责（严格遵守）

- **Routes**：只做路由分发，不写业务逻辑
- **Controllers**：参数校验、调用 Service、组装响应，不直接操作 Model
- **Services**：核心业务逻辑，可调用 Model 和其他 Service
- **Models**：Mongoose Schema 定义，数据校验，不写业务逻辑

### 前端分层职责

- **Components**：只负责 UI 渲染和用户交互，逻辑通过 Hooks 调用
- **Hooks**：封装可复用逻辑，是组件和 Store/Services 之间的桥梁
- **Store**：管理全局状态，调用 Services 获取数据
- **Services**：封装 Axios 请求，统一处理 Token 和错误

### 匿名服务调用规则

- 所有匿名 ID 生成、验证、追溯**必须**通过 `anonymousService.js`
- 禁止在 PostService、CommentService 等模块中直接计算匿名 ID
- 禁止在 Controller 或 Route 中直接操作 `anonymous_mappings` 集合
- 管理员追溯匿名身份时，必须调用 `anonymousService.trace()`，该方法内部会记录审计日志

### 错误处理

- 后端统一使用自定义错误码（见术语表中的错误码表），不直接抛 HTTP 状态码
- 前端 Services 层统一捕获 Axios 错误，转换为用户可读的提示信息
- 不在前端 Components 中直接处理 API 错误细节，通过 uiStore 的 toast 展示

### 删除策略

- 帖子：逻辑删除（标记 `deleted: true`）
- 评论：逻辑删除
- 用户：封禁/禁言，不物理删除
- 草稿：物理删除（草稿非正式内容，无需保留）

## OpenSpec 工作流约定

本项目使用 OpenSpec 管理功能开发流程，工作流为 `explore` → `propose` → `apply` → `archive`。

### 工作流阶段

| 阶段 | 命令 | 产出物 | 谁执行 |
|------|------|--------|--------|
| Explore | openspec:explore | 调研笔记、方案分析 | AI |
| Propose | openspec:propose | spec.md（需求+设计+验收条件） | AI，需团队确认 |
| Apply | openspec:apply | 代码实现 | AI |
| Archive | openspec:archive | 归档 spec + 变更记录 | AI |

### 规范

- 每个功能开发前，先在 `openspec/specs/<功能名>/spec.md` 中编写规格说明
- `openspec/config.yaml` 定义项目上下文和技术栈信息，AI 生成 proposal 时自动引用
- Apply 阶段的代码实现遵循项目分层架构和编码规范
- Archive 阶段将 spec 标记为已完成，可移入 `已完成/` 目录

### 现有 Spec 清单

见 `openspec/specs/` 目录下的子目录，目前包括：bookmarks、collection-folders、event-bookmarking、event-date-picker、homepage-carousel、report-detail-view
