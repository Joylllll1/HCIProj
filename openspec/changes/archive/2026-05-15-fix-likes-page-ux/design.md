## Context

"我的喜爱"页面已实现基础功能，但存在多个 UX 问题需要修复。

## Goals / Non-Goals

**Goals:**
- Tab 选中样式与主页一致
- 帖子取消点赞后保留在列表，切出页面才提交
- 评论/回复卡片可点击爱心切换点赞状态
- 评论卡片正确显示帖子标题

**Non-Goals:**
- 不改变后端 API 结构
- 不新增功能模块

## Decisions

### 1. Tab 选中样式
使用 `bg-blue-soft text-blue border-blue`，与主页排序按钮一致。

### 2. 帖子取消点赞延迟提交
- 使用本地状态 `pendingUnlikes` 记录待取消点赞的帖子 ID
- 取消点赞时只更新本地状态，不调用 API
- 切出页面（`useEffect` cleanup 或 `activeTab` 变化）时批量提交

### 3. 评论/回复点赞
- 后端已有 `POST /api/comments/:commentId/like` 和 `POST /api/comments/:commentId/reply/:replyId/like`
- 前端添加 `toggleCommentLike(commentId)` 和 `toggleReplyLike(commentId, replyId)` 方法
- 评论卡片使用爱心图标（`favorite`），已点赞显示 filled

### 4. 评论卡片显示帖子标题
API 返回的 `comment.postTitle` 直接显示，无需额外查询。

## Risks / Trade-offs

- **批量取消点赞可能失败** → 逐个提交，失败时显示 toast 提示
- **用户快速切换页面** → 在 cleanup 中提交，确保不丢失