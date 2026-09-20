## Context

当前网站存在多个交互 bug：

1. **时间不自动刷新**：前端显示的"x分钟前"不会自动更新，用户需手动刷新才能看到最新状态
2. **回复不支持图片**：发帖支持图片，但回复/评论不支持
3. **收藏数不变**：收藏按钮点击后只变色，收藏数未增加
4. **点赞异常**：评论/回复点赞时变成红色又立即取消
5. **帖子点赞状态不正确**：刷新页面后点赞状态与后端不一致

**关于点赞用户绑定**：后端已正确实现 `likedBy` 字段存储用户 ObjectId，同一用户同一内容只能点赞一次。"换个浏览器能再点赞"是正常行为（不同设备=不同用户身份）。

## Goals / Non-Goals

**Goals:**
- 实现前端时间自动刷新机制
- 支持回复帖/评论带图片
- 修复点赞状态持久化问题
- 修复收藏数更新问题
- 修复评论/回复点赞操作异常

**Non-Goals:**
- 不修改后端 API 结构
- 不修改数据模型
- 不实现实时 WebSocket 推送（仅轮询）

## Decisions

**1. 时间自动刷新机制**

方案 A：每个组件内部使用 `setInterval` 定时刷新
方案 B：使用 React context 提供全局刷新定时器

选择方案 A，每个需要刷新时间的组件内部使用 `useEffect` 设置定时器，每 60 秒强制更新。

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    setRenderKey(k => k + 1);
  }, 60000);
  return () => clearInterval(interval);
}, []);
```

**2. 帖子点赞状态同步**

问题原因：后端 API 返回 `isLiked` 状态，但前端获取新数据后 `likedPosts` 数组未正确更新。

修复方案：API 返回 `isLiked` 状态时，同步更新 `likedPosts` 数组。

```javascript
// postStore.js - fetchPosts 中
likedPosts: data.posts.filter((p) => p.isLiked).map((p) => p.id),
```

**3. 收藏数更新**

问题原因：收藏操作后未更新本地计数。

修复方案：收藏成功后，乐观更新本地 count。

```javascript
toggleBookmark: (postId) => {
  set(state => ({
    posts: state.posts.map(p =>
      p.id === postId
        ? { ...p, isBookmarked: !p.isBookmarked, bookmarks: p.isBookmarked ? p.bookmarks - 1 : p.bookmarks + 1 }
        : p
    )
  }));
}
```

**4. 评论/回复点赞异常**

问题原因：可能是 `toggleReplyLike` 或 `toggleLike` 函数中状态更新逻辑有误。

检查 `commentStore.js` 中的实现，确保：
- 正确使用 `set()` 更新状态
- 正确处理嵌套的 replies 数组

**5. 回复图片上传**

方案 A：复用发帖页面的图片上传组件
方案 B：创建通用的图片上传 hook

选择方案 A，复用 `PostForm` 中的图片上传逻辑，将其提取为可复用组件。

## Risks / Trade-offs

- [Risk] 轮询频率影响服务器负载 → Mitigation：设置合理的轮询间隔（60秒），在页面不可见时暂停
- [Risk] localStorage 容量限制 → Mitigation：只存储 ID 列表，不存储完整数据
- [Risk] 图片上传增加 API 负载 → Mitigation：限制图片大小和数量

## Open Questions

1. 评论/回复点赞的具体 bug 表现需要确认（是立即取消还是其他）
2. 是否需要实现图片预览功能