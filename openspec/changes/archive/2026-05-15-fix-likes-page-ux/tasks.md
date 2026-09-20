## 1. 修复 Tab 选中样式

- [x] 1.1 修改 Tab 按钮选中样式为 `bg-blue-soft text-blue border-blue`（与主页排序按钮一致）

## 2. 修复评论卡片显示

- [x] 2.1 修复评论卡片显示 postTitle（使用 API 返回的 postTitle）
- [x] 2.2 添加空值检查防止"无标题"

## 3. 评论点赞功能

- [x] 3.1 在 postService.js 添加 `toggleCommentLike(commentId)` 方法
- [x] 3.2 在 postService.js 添加 `toggleReplyLike(commentId, replyId)` 方法
- [x] 3.3 在 LikesPage 添加评论点赞状态和切换逻辑
- [x] 3.4 评论卡片添加爱心图标，点击切换点赞状态

## 4. 帖子取消点赞延迟提交

- [x] 4.1 在 LikesPage 添加 `pendingUnlikes` 状态记录待取消的帖子 ID
- [x] 4.2 点击爱心时只更新本地状态，不调用 API
- [x] 4.3 切换 Tab 或离开页面时，批量提交待取消的点赞到后端

## 5. 帖子评论/回复图标统一

- [x] 5.1 Comment.jsx thumb_up → favorite
- [x] 5.2 ReplyCard.jsx thumb_up → favorite
