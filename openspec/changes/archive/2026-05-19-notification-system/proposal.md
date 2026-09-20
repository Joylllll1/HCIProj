## Why

南大树洞目前缺乏通知机制，用户无法及时了解与自己相关的互动（评论、点赞）和活动审核结果。这降低了用户参与度和平台活跃度。需要建立完整的通知系统，让用户实时掌握动态。

## What Changes

- **后端**: 新建 Notification 模型，存储通知数据（类型、接收者、内容、关联对象、已读状态）
- **后端 API**: 提供获取通知列表、标记已读、获取未读数量接口
- **后端触发**: 在评论、点赞、活动审核通过/拒绝、账号封禁/解封时自动创建通知
- **前端 Store**: 创建 notificationStore，管理通知状态和轮询逻辑
- **前端 UI**: 改造 TopBar 通知下拉框，支持真实数据和交互
- **前端 Service**: 封装通知相关 API 调用
- **点赞合并**: 同一帖子的多个点赞在前端合并显示为「N人赞了你的帖子」

## Capabilities

### New Capabilities

- `notification-core`: 通知核心功能 - 数据模型、API接口、状态管理
- `notification-realtime`: 实时获取 - 轮询机制和未读数更新

### Modified Capabilities

- 无（仅新增功能，不修改现有行为）

## Impact

- **后端**: 新增 `Notification` 模型和 `notificationService`，修改 `commentService`、`postService`、`eventService` 在关键操作后触发通知
- **前端**: 新增 `notificationStore.js`、`notificationService.js`，改造 `TopBar.jsx` 的通知组件
- **数据库**: 新增 `notifications` 集合
- **依赖**: 无新增外部依赖
