## Why

"我的喜爱"页面存在多个 UX 问题：1) Tab 选中样式和主页不一致；2) 评论点赞后无法取消，也无法取消点赞，需改为可交互；3) 帖子取消点赞后直接消失，应保留到离开页面时再提交；4) 评论卡片无帖子标题显示。

## What Changes

- **Tab 选中样式**：改为 `bg-blue-soft text-blue border-blue`，与主页一致
- **帖子取消点赞延迟提交**：取消点赞后保留在列表，切出页面才提交更改
- **评论/回复点赞功能**：评论卡片添加爱心图标点击切换点赞状态，后端调用对应 API
- **评论卡片显示帖子标题**：显示 postTitle（API 已返回）

## Capabilities

### Modified Capabilities
- `my-likes`: 我的喜爱页面交互优化

## Impact

- 前端 LikesPage.jsx
- 后端 POST /api/comments/:id/like（需确认是否存在）