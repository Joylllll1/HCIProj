## Context

当前应用的数据持久化和实时性问题：

- **收藏**：bookmarkStore 仅用 localStorage 存储，post.saves 通过前端 `updateSaves` 临时修改，刷新后后端原始值覆盖
- **TimeAgo**：已在 TimeAgo.jsx 设置 30s 刷新间隔，但用户反馈仍无法自动更新。可能原因是 `formatTimeAgo` 的 `timeString` 未正确传递或组件渲染路径被阻塞
- **点赞后台**：点赞已有 toggleLike 后端逻辑，但缺少聚合查询接口——无法一次性获取用户点赞过的所有帖子、评论、回复
- **首页自动更新**：当前只在页面加载时调 `fetchPosts()`，看不到别的新帖子

Post Schema 已有 `saves` 和 `likedBy` 字段，Comment Schema 也有 `likes`/`likedBy` 和 reply 的子文档 `likes`/`likedBy`。

## Goals / Non-Goals

**Goals:**
- 收藏操作通过后端 API 持久化，刷新后收藏状态和计数不变
- TimeAgo 组件能稳定自动刷新（"刚刚" → "1分钟前" → ...）
- 提供 `GET /api/likes` 聚合接口，返回用户点赞的所有帖子/评论/回复
- 首页每隔 60s 自动轮询新帖子，更新动态列表
- 所有改动兼容现有前端组件结构，不改动现有 UI 布局

**Non-Goals:**
- 不做 WebSocket 实时推送（仅轮询）
- 不做通知推送
- 不做评论/回复的收藏
- 不做点赞的取消确认弹窗

## Decisions

### 1. 收藏 API 设计

**Decision**: 在 postController/postService 中新增 `toggleSave`，复用 `Post.saves` 和新增 `savedBy` 数组，对称处理。

**Rationale**: 与点赞的 `toggleLike` 模式一致，代码结构对称，易于维护。后端沿用 `likedBy` 同样的 `findIndex` → `splice/push` 模式。

```
POST /api/posts/:id/save → { saved: boolean, saves: number }
```

Post Schema 增加 `savedBy: [{ type: ObjectId, ref: 'User' }]` 字段。

### 2. 我的点赞聚合查询

**Decision**: 新建 `likeRoutes.js` + `likeController.js` + `likeService.js`，`GET /api/likes` 返回 `{ posts: [...], comments: [...] }`。

**Rationale**: 用户要求按两类分类——帖子喜爱和评论喜爱（评论+回复合并）。涉及 Post、Comment 两个集合的跨集合查询，独立模块更清晰。

- `posts`：Post 表中 `likedBy` 含当前用户的帖子
- `comments`：从 Comment 表中提取 `likedBy` 含当前用户的评论 + `replies[].likedBy` 含当前用户的回复，统一展平到同一数组，每项带 `type` 字段区分

### 3. TimeAgo 修复方案

**Decision**: 将 TimeAgo 从基于 `useState` 的 setInterval 改为基于 `useSyncExternalStore` 订阅全局时钟，确保所有 TimeAgo 实例同步更新。

**Rationale**: 当前模式每个 TimeAgo 实例有独立 timer，可能存在 React 18 自动批处理下 setState 被吞掉的情况。全局时钟订阅强制所有消费者重渲染，且只用一个 timer 实例，性能更好。

实现：在 `utils.js` 中导出全局时钟 store，TimeAgo 订阅该 store。

### 4. 首页轮询策略

**Decision**: HomePage 的 useEffect 中增加 setInterval，每 60s 调 `fetchPosts()`。使用 `useRef` 记录最新时间戳，避免旧数据刷新导致页面闪烁。

**Rationale**: 简单轮询实现成本最低，60s 间隔对校园级流量足够。不用考虑闲时退避。

### 5. 前端收藏对接后端 API

**Decision**: bookmarkStore 保留 localStorage 作为本地缓存，同时新增后端 API 调用。`toggleBookmark` 先调后端 API，成功后再更新本地状态。

**Rationale**: 用户需要离线可看收藏列表（本地缓存），同时确保跨设备/跨浏览器数据持久化（后端存储）。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| 轮询导致不必要的后端负载 | 60s 间隔加上 `if (!document.hidden)` 检查，页面不可见时不请求 |
| 收藏 API 失败导致本地状态不一致 | API 成功后前端才更新本地状态，失败 toast 提示 |
| 新增 `savedBy` 字段需迁移已有数据 | Post 模型加默认 `[]`，无需迁移脚本 |
| TimeAgo 全局时钟增加耦合 | 全局时钟放在 utils.js 中，纯 js 实现，不依赖 React |
