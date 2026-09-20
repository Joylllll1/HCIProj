## 1. Post 模型新增 savedBy 字段 & 收藏 API

- [x] 1.1 Post 模型 `models/Post.js` 新增 `savedBy: [{ type: ObjectId, ref: 'User' }]` 字段
- [x] 1.2 postService 新增 `toggleSave` 方法（查 post → findIndex savedBy → splice/push → save → return `{ saved, saves }`）
- [x] 1.3 postController 新增 `save` handler，调用 postService.toggleSave
- [x] 1.4 postRoutes 新增 `POST /:id/save` 路由（挂 auth 中间件）
- [x] 1.5 postService.getPosts/getPostById 返回 `isSaved` 字段（检查 userId 是否在 savedBy 中）

## 2. 前端收藏对接后端 API

- [x] 2.1 frontend `services/postService.js` 新增 `toggleSave(id)` 方法调后端 API
- [x] 2.2 postStore 新增 `toggleSave` action：先调 API → 成功后更新本地 `saves` 和 `isSaved`
- [x] 2.3 bookmarkStore `toggleBookmark` 改为先调后端 API，成功后更新本地 localStorage
- [x] 2.4 `useLikeBookmark.js` 更新 handleToggleBookmark/handleSelectFolder 使用新的 postStore.toggleSave
- [x] 2.5 PostCard 使用 `post.isSaved`（来自 API）替代 `bookmarks.includes(post.id)` 控制收藏图标

## 3. TimeAgo 修复（全局时钟）

- [x] 3.1 `utils.js` 新增全局时钟 store：基于 setInterval 每 30s 更新一个递增计数器
- [x] 3.2 TimeAgo 组件改为订阅全局时钟（`useSyncExternalStore`），移除内部 useState/useEffect
- [ ] 3.3 验证多个 TimeAgo 实例同步刷新（运行时验证）

## 4. 我的点赞聚合查询接口

- [x] 4.1 新建 `likeRoutes.js`：`GET /api/likes`（挂 auth 中间件）
- [x] 4.2 新建 `likeController.js`：调用 likeService.getUserLikes
- [x] 4.3 新建 `likeService.js`：查询 Post（likedBy 含 userId）→ `posts` 列表；查询 Comment（likedBy 含 userId 的评论 + replies[].likedBy 含 userId 的回复）→ 统一展平到 `comments` 列表，每项带 `type` 字段
- [x] 4.4 在 `backend/src/index.js` 注册 likeRoutes

## 5. 评论 GET 路由改为 optionalAuth

- [x] 5.1 commentRoutes `GET /:postId` 改为 optionalAuth（当前是 auth，导致未登录用户无法获取评论）

## 6. 首页自动轮询

- [x] 6.1 HomePage 增加 `useEffect` + `setInterval` 轮询，每 60s 调 `fetchPosts()`
- [x] 6.2 轮询时检查 `document.hidden`，不可见时跳过
- [x] 6.3 组件卸载时清除 interval

## 7. 推送 & 部署

- [ ] 7.1 提交代码并推送到 origin
- [ ] 7.2 告知用户服务器更新步骤
