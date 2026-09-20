## 1. 时间自动刷新

- [x] 1.1 创建 TimeAgo 组件封装时间刷新逻辑
- [x] 1.2 在 PostCard 中使用 TimeAgo 组件
- [x] 1.3 在 Comment 中使用 TimeAgo 组件
- [x] 1.4 在 ReplyCard 中使用 TimeAgo 组件

## 2. 帖子点赞状态同步

- [x] 2.1 在 postStore 的 toggleLike 中确保 isLiked 状态正确更新
- [x] 2.2 在 postStore 的 setSelectedPost 中确保 isLiked 与 likedPosts 同步
- [x] 2.3 验证刷新后点赞状态正确

## 3. 收藏数更新

- [x] 3.1 检查 postStore 中 updateSaves 逻辑（已正确更新 posts 和 selectedPost）
- [x] 3.2 useLikeBookmark hook 已正确调用 updateSaves
- [x] 3.3 setSelectedPost 已修复确保 isLiked 与 likedPosts 同步

## 4. 评论/回复点赞异常修复

- [x] 4.1 后端 getComments 已添加 reply.isLiked
- [x] 4.2 后端 addReply 已添加 isLiked: false
- [x] 4.3 前端 commentStore 逻辑正确（使用 isLiked 字段）

## 5. 回复图片上传

- [x] 5.1 ReplyCard 回复输入框已添加图片上传按钮
- [x] 5.2 Comment ReplyInput 已添加图片上传按钮（在 DetailPage.jsx 中）
- [x] 5.3 CommentReplyInput 已添加图片上传按钮
- [x] 5.4 后端支持评论/回复带图片（通过 [图片] 标记）

## 6. 前端轮询机制

- [x] 6.1 TimeAgo 组件已实现每 60 秒刷新
- [x] 6.2 时间显示在页面可见时自动刷新