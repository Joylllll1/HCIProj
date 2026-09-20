## Why

当前网站存在多个交互问题影响用户体验：1) 时间显示不会自动刷新，用户需要手动刷新才能看到最新状态；2) 回复帖不支持发图片；3) 收藏按钮只变色没有增加收藏数；4) 评论/回复点赞操作异常（点一个变成红色又立即取消）；5) 帖子点赞后前端状态不正确导致显示异常。

**关于点赞用户绑定**：后端已正确实现用户级点赞绑定（`likedBy` 字段存储用户 ObjectId），同一用户同一内容只能点赞一次，由 `auth` 中间件验证身份。"换个浏览器能再点赞"是正常行为（不同设备=不同用户身份）。问题在于 **同一次会话内** 刷新页面后点赞状态显示不正确。

## What Changes

- **修复**：前端时间自动刷新机制（每分钟更新一次）
- **新增**：回复帖支持发送图片
- **修复**：收藏功能增加计数
- **修复**：评论/回复点赞操作异常 bug
- **修复**：帖子点赞后前端状态与后端同步

## Capabilities

### New Capabilities
- `auto-refresh`: 前端自动刷新机制，定时更新时间和新内容
- `reply-image-upload`: 回复帖图片上传功能

### Modified Capabilities
- `bookmarks`: 收藏按钮需要增加收藏数显示

## Non-Goals
- 不修改后端 API 结构
- 不修改用户认证逻辑
- 不修改帖子/评论的数据模型

## Impact

**前端受影响组件**：
- `PostCard` - 点赞状态和收藏数
- `Comment` - 评论点赞功能
- `ReplyCard` - 回复点赞功能
- 时间显示组件 - 需要定时刷新
- 回复输入组件 - 需要支持图片上传

**涉及文件**：
- `frontend/src/components/common/PostCard.jsx`
- `frontend/src/components/common/Comment.jsx`
- `frontend/src/components/common/ReplyCard.jsx`
- `frontend/src/store/postStore.js`
- `frontend/src/store/commentStore.js`
- 回复输入相关组件
