## ADDED Requirements

### Requirement: Polling mechanism

系统 SHALL 使用轮询机制获取最新通知。

#### Scenario: Polling interval
- **WHEN** 用户在应用中活动
- **THEN** 每 30 秒向服务器请求一次通知数据

#### Scenario: Pause in background
- **WHEN** 用户切换到其他标签页（`document.hidden === true`）
- **THEN** 暂停轮询

#### Scenario: Resume from background
- **WHEN** 用户切回应用标签页（`document.hidden === false`）
- **THEN** 立即请求一次通知数据，然后恢复轮询

#### Scenario: Initial fetch
- **WHEN** 用户登录成功或页面刷新
- **THEN** 立即请求一次通知数据

### Requirement: Unread badge

系统 SHALL 在通知图标上显示未读数量徽章。

#### Scenario: Show unread count
- **WHEN** 用户有未读通知
- **THEN** 在通知图标右上角显示红色数字徽章

#### Scenario: Hide badge when zero
- **WHEN** 用户未读通知为 0
- **THEN** 不显示徽章

### Requirement: Notification dropdown

系统 SHALL 在 TopBar 提供通知下拉面板。

#### Scenario: Open dropdown
- **WHEN** 用户点击通知图标
- **THEN** 显示通知下拉面板，展示最近通知列表

#### Scenario: Show empty state
- **WHEN** 用户没有任何通知
- **THEN** 显示「暂无通知」提示

#### Scenario: Mark all read button
- **WHEN** 用户有未读通知
- **THEN** 显示「全部已读」按钮

#### Scenario: Click notification
- **WHEN** 用户点击某条通知
- **THEN** 标记该通知为已读，并根据通知类型跳转到对应页面
