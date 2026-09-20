## ADDED Requirements

### Requirement: Notification data model

系统 SHALL 使用以下数据模型存储通知：

```javascript
{
  recipient: ObjectId,      // 接收者
  type: String,             // comment | like | event_approved | event_rejected | banned | unbanned
  title: String,            // 标题
  content: String,          // 内容
  relatedId: ObjectId,      // 关联对象ID
  relatedType: String,      // post | comment | event
  relatedData: Object,      // 冗余数据（如帖子标题）
  read: Boolean,            // 已读状态，默认 false
  createdAt: Date           // 创建时间
}
```

#### Scenario: Create comment notification
- **WHEN** 用户 A 评论了用户 B 的帖子
- **THEN** 系统为用户 B 创建一条 `type: comment` 的通知

#### Scenario: Create like notification
- **WHEN** 用户 A 点赞了用户 B 的帖子
- **THEN** 系统为用户 B 创建一条 `type: like` 的通知

#### Scenario: Create event_approved notification
- **WHEN** 管理员审核通过用户 A 提交的活动
- **THEN** 系统为用户 A 创建一条 `type: event_approved` 的通知

#### Scenario: Create event_rejected notification
- **WHEN** 管理员拒绝用户 A 提交的活动
- **THEN** 系统为用户 A 创建一条 `type: event_rejected` 的通知，包含拒绝理由

#### Scenario: Create banned notification
- **WHEN** 管理员封禁用户 A 的账号
- **THEN** 系统为用户 A 创建一条 `type: banned` 的通知

#### Scenario: Create unbanned notification
- **WHEN** 管理员解封用户 A 的账号
- **THEN** 系统为用户 A 创建一条 `type: unbanned` 的通知

### Requirement: Get notifications API

系统 SHALL 提供 API 获取当前用户的通知列表。

#### Scenario: Get notification list
- **WHEN** 用户请求通知列表
- **THEN** 系统返回该用户的通知，按创建时间倒序排列

#### Scenario: Notification limit
- **WHEN** 用户的通知数量超过 30 条
- **THEN** 系统仅返回最近 30 条

### Requirement: Mark notification as read

系统 SHALL 提供 API 标记通知为已读。

#### Scenario: Mark single notification read
- **WHEN** 用户点击某条通知
- **THEN** 系统将该通知标记为已读

#### Scenario: Mark all notifications read
- **WHEN** 用户点击「全部已读」按钮
- **THEN** 系统将该用户所有通知标记为已读

### Requirement: Get unread count

系统 SHALL 提供 API 获取未读通知数量。

#### Scenario: Get unread count
- **WHEN** 用户请求未读数量
- **THEN** 系统返回该用户未读通知的总数

### Requirement: Like notification merging

系统 SHALL 在前端合并同一帖子的点赞通知。

#### Scenario: Merge multiple likes
- **WHEN** 同一帖子有 3 个点赞通知
- **THEN** 前端显示为「3人赞了你的帖子《xxx》」

#### Scenario: Click merged notification
- **WHEN** 用户点击合并后的点赞通知
- **THEN** 展开显示各条点赞详情，或跳转到帖子详情页

### Requirement: Frontend notification store

系统 SHALL 在前端使用 Zustand 管理通知状态。

#### Scenario: Store structure
- **WHEN** 应用初始化
- **THEN** notificationStore 包含 notifications 数组、unreadCount 数字、fetch/markRead 等方法

### Requirement: Storage limit

系统 SHALL 限制每个用户最多保留 30 条通知。

#### Scenario: Auto cleanup
- **WHEN** 用户通知数量超过 30 条
- **THEN** 系统删除最旧的通知
