# 术语表

> 本文件定义 NJU 树洞项目中所有关键概念。团队成员对概念有分歧时，以此文件为准。

## 业务概念

### 帖子级匿名
- **定义**：同一用户在不同帖子中显示不同的匿名 ID，同一帖子内匿名身份保持一致
- **示例**：用户 A 在帖子 #1 中显示为"匿名用户#x7k2"，在帖子 #2 中显示为"匿名用户#m9p4"
- **易混淆点**：不是"全局匿名"（一个用户只有一个匿名身份），也不是"完全匿名"（后台仍有映射关系）

### 匿名 ID (anon_id)
- **定义**：用户在某一帖子内的匿名标识，由 `hash(user_id + post_id)` 算法生成
- **示例**：`anon_x7k2m9`
- **易混淆点**：匿名 ID ≠ 用户 ID，匿名 ID 是按帖子隔离的，不同帖子产生不同的匿名 ID

### 匿名映射 (anonymous_mapping)
- **定义**：加密存储的 {user_id, post_id → anon_id} 对应关系，仅管理员可查询
- **在本项目中的含义**：映射关系存储在 MongoDB 的 `anonymous_mappings` 集合中，高频查询通过 Redis 缓存

### 帖主
- **定义**：帖子的作者
- **在本项目中的含义**：帖主可以管理自己帖子下的评论（删除评论），这是帖主独有的权限，区别于普通评论者

### 禁言 vs 封禁
- **定义**：禁言 = 限制发言权限，用户仍可登录和浏览；封禁 = 完全禁止访问
- **易混淆点**：两者都是管理员操作，但程度不同。禁言是"不让说话"，封禁是"不让进来"

### 逻辑删除
- **定义**：不物理删除数据，而是标记 `deleted: true`，数据仍保留在数据库中
- **在本项目中的含义**：帖子删除采用逻辑删除，管理员可查看已删除内容

## 技术概念

### 渐进式分层架构
- **定义**：在现有代码基础上逐步完善分层结构，而非推倒重来
- **在本项目中的含义**：前端已有 17 个基础组件，不重构而是逐步增加 hooks/services/store 层
- **易混淆点**：不是"标准三层架构"——标准三层是全新搭建，渐进式强调保护已有成果

### 后端调用链
- **定义**：Routes → Controllers → Services → Models 的请求处理流程
- **在本项目中的含义**：
  - Routes：路由分发
  - Controllers：参数校验，调用 Service，组装响应
  - Services：核心业务逻辑（最核心的层）
  - Models：Mongoose 数据模型定义

### 前端调用链
- **定义**：Components → Hooks → Store → Services → API 的数据/逻辑流
- **在本项目中的含义**：
  - Components：UI 渲染
  - Hooks：封装逻辑，调用 Store 和 Services
  - Store：Zustand 全局状态
  - Services：Axios API 调用封装

### Zustand Store
- **定义**：本项目使用 Zustand 管理前端全局状态，替代 Redux
- **在本项目中的含义**：定义了 5 个 store：authStore、postStore、draftStore、commentStore、uiStore
- **易混淆点**：Zustand 不是 Redux，没有 reducer/action 类型，直接通过 set 方法修改状态

### JWT + HTTP-only Cookie
- **定义**：认证方案——JWT 作为 token 载体，通过 HTTP-only Cookie 传递
- **在本项目中的含义**：
  - 登录成功后，JWT 写入 HTTP-only Cookie（防 XSS 读取）
  - 登出时将 Token 加入 Redis 黑名单
  - 配合 CSRF 保护

### 审计日志
- **定义**：记录管理员关键操作的日志，用于追溯和合规
- **在本项目中的含义**：管理员追溯匿名身份时必须记录审计日志，确保"对内可治理"原则可被验证

### 每日运势 (DailyFortune)
- **定义**：首页右侧面板的轻量互动模块，每日随机展示一句运势/签文
- **在本项目中的含义**：前端组件 `DailyFortune.jsx` + `DailyLuck.jsx`，纯前端实现，数据硬编码在组件内
- **易混淆点**：不是后端 API 返回的内容，目前没有 AI 生成逻辑

### AI 面板 (AIPanel)
- **定义**：侧边 AI 对话面板，提供 AI 辅助功能（内容总结、情感分析等）
- **在本项目中的含义**：前端组件 `AIPanel.jsx`，目前为 UI 框架，AI 功能待对接

### OpenSpec / Feature Spec
- **定义**：以 OpenSpec 格式编写的功能规格文档
- **在本项目中的含义**：功能开发前先在 `openspec/specs/` 下编写 spec.md，描述需求、设计、验收条件，再进入开发
- **工作流**：`explore` → `propose` → `apply` → `archive`（通过 `.claude/skills/` 中的对应技能执行）

## 需求编号对照

| 编号 | 含义 | 所属模块 |
|------|------|----------|
| FR-1 | 用户注册与登录 | Auth |
| FR-2 | 帖子级匿名 | Anonymous Service |
| FR-3 | 匿名身份一致性 | Anonymous Service |
| FR-4 | 管理员可追溯 | Admin + Anonymous Service |
| FR-5 | 发帖 | Post |
| FR-6 | 草稿 | Draft |
| FR-7 | 浏览帖子 | Post |
| FR-8 | 评论 | Comment |
| FR-9 | 点赞 | Post + Comment |
| FR-10 | 帖主管理评论 | Comment |
| FR-11 | 举报 | Report |
| FR-12 | 管理员审核 | Admin + Moderation |
| FR-13 | 修改帖子 | Post |
| FR-14 | 删除帖子 | Post |
| FR-15 | 搜索 | Search |
| FR-16 | 审计日志 | Admin |
| FR-17 | AI 辅助 | AI Service |
| FR-18 | 每日运势 | Fortune Service |

## 错误码表

后端统一错误码，通过自定义 `AppError` 抛出：

| 错误码 | HTTP 状态 | 含义 | 触发场景 |
|--------|-----------|------|----------|
| `VALIDATION_ERROR` | 400 | 参数校验失败 | 请求参数缺失或格式错误 |
| `UNAUTHORIZED` | 401 | 未登录或 Token 无效 | Token 缺失/过期/无效 |
| `FORBIDDEN` | 403 | 无权限 | 非帖主操作他人帖子 |
| `USER_MUTED` | 403 | 用户已被禁言 | 禁言用户尝试发帖/评论 |
| `NOT_FOUND` | 404 | 资源不存在 | 帖子/评论被删除或 ID 无效 |
| `CONFLICT` | 409 | 资源冲突 | 重复点赞、重复举报 |
| `RATE_LIMIT` | 429 | 请求过于频繁 | 短时间大量请求 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 未预期的异常 |
