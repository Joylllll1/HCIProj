## ADDED Requirements

### Requirement: 首页自动轮询新帖子

系统 SHALL 在首页（HomePage）启动定时轮询，每隔 60 秒检查是否有新帖子，并自动更新帖子列表。

#### Scenario: 首页定期自动刷新
- **WHEN** 用户在首页且页面处于可见状态
- **THEN** 每 60s 自动调用 `fetchPosts()` 更新帖子列表

#### Scenario: 页面不可见时暂停轮询
- **WHEN** 页面处于后台/不可见状态（`document.hidden` 为 true）
- **THEN** 轮询暂停，避免无效网络请求

#### Scenario: 轮询不重置滚动位置
- **WHEN** 轮询触发更新
- **THEN** 帖子列表仅增量更新，不重置用户的滚动位置

### Requirement: 时间显示自动刷新

系统 SHALL 在所有显示相对时间的组件中，每隔 30 秒自动重新计算并更新相对时间字符串。所有 TimeAgo 实例 SHALL 按统一时钟同步刷新。

#### Scenario: 帖子时间自动更新
- **WHEN** 帖子显示"刚刚"
- **THEN** 60 秒后自动变为"1分钟前"，再 60 秒后变为"2分钟前"，依此类推

#### Scenario: 评论和回复时间同时更新
- **WHEN** 多个 TimeAgo 组件在页面上
- **THEN** 所有组件同时刷新，保持时间显示同步

#### Scenario: 组件卸载后停止计时
- **WHEN** 包含 TimeAgo 的组件卸载
- **THEN** 对应的订阅自动取消，不漏报
