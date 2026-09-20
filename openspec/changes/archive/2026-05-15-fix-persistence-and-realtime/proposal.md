## Why

当前应用存在多个数据持久化和实时性问题：收藏计数仅在内存中更新，刷新后丢失；时间显示无法自动刷新；点赞状态依赖前端缓存，无法支持"我的喜爱"功能；用户发帖后其他用户需手动刷新才能看到。需要系统性解决这些问题，为后续功能打好基础。

## What Changes

1. **后端新增收藏/取消收藏 API** — 支持用户对帖子进行收藏/取消收藏操作，保存到数据库
2. **修复 TimeAgo 自动刷新机制** — 深入排查 interval 不生效的原因，确保相对时间自动更新
3. **后端扩展点赞系统** — 为帖子、评论、回复点赞提供统一的查询接口（"我的所有点赞"），新增 `GET /api/likes` 路由
4. **前端轮询新帖子** — 首页定期检查是否有新帖子，自动更新动态列表
5. **前端收藏计数持久化** — 收藏操作通过 API 同步到后端，刷新后计数保持正确

## Capabilities

### New Capabilities
- `post-save-toggle`: 帖子收藏/取消收藏的后端 API 及前端对接
- `my-likes`: 用户查看所有已点赞的帖子、评论和回复
- `auto-refresh-feed`: 首页定时轮询，自动加载新帖子

### Modified Capabilities
- `user-auth`: 新增 `GET /api/likes` 等需要认证的私有数据接口（当前 auth 中间件已就绪，仅新增路由）
- post 和 comment 的 GET 路由已改为 optionalAuth（之前修改），新加接口使用标准 auth

## Impact

- **后端**：新增 `openspec/specs/post-save-toggle/spec.md`、`openspec/specs/my-likes/spec.md`、`openspec/specs/auto-refresh-feed/spec.md` 三个 spec 文件；新增 `save`/`unsave` 路由、`likes` 聚合路由
- **前端**：`TimeAgo.jsx` 重写或修改；`HomePage.jsx` 新增轮询逻辑；`bookmarkStore.js` 与 `useLikeBookmark.js` 改为调用后端 API
- **新增 route**：`backend/src/routes/likeRoutes.js`（我的点赞聚合路由，按"帖子喜爱"/"评论喜爱"两类返回）
- **新增 controller/service**：`saveController.js`/`saveService.js`、`likeController.js`（或在现有模块扩展）

## 非目标

- 不做 WebSocket 实时推送，仅轮询
- 不做通知推送（有新帖子时用户刷新不会收到通知，仅列表自动更新）
- 不做离线缓存
- 不做评论/回复的收藏（仅帖子收藏）
