## ADDED Requirements

### Requirement: 用户可以对帖子收藏/取消收藏

系统 SHALL 提供后端 API 供认证用户对帖子进行收藏或取消收藏操作。Post 模型 SHALL 新增 `savedBy` 数组字段记录收藏用户。

#### Scenario: 收藏帖子
- **WHEN** 认证用户对未收藏的帖子发送 `POST /api/posts/:id/save`
- **THEN** 系统返回 `{ saved: true, saves: <更新后的收藏数> }`，Post 的 `savedBy` 添加该用户 ID，`saves` 加 1

#### Scenario: 取消收藏帖子
- **WHEN** 认证用户对已收藏的帖子发送 `POST /api/posts/:id/save`
- **THEN** 系统返回 `{ saved: false, saves: <更新后的收藏数> }`，Post 的 `savedBy` 移除该用户 ID，`saves` 减 1

#### Scenario: 未认证用户无法收藏
- **WHEN** 未认证用户发送 `POST /api/posts/:id/save`
- **THEN** 系统返回 401 错误

### Requirement: Post 模型增加 savedBy 字段

Post Schema SHALL 增加 `savedBy: [{ type: ObjectId, ref: 'User' }]`，默认空数组，索引可选。

#### Scenario: 新帖子默认无收藏
- **WHEN** 创建新帖子
- **THEN** `savedBy` 为 `[]`，`saves` 为 `0`

### Requirement: GET 帖子列表返回当前用户收藏状态

`GET /api/posts` 和 `GET /api/posts/:id` 的返回数据 SHALL 包含 `isSaved` 布尔字段，标识当前用户是否已收藏该帖子。

#### Scenario: 已登录用户看到收藏状态
- **WHEN** 已登录用户获取帖子列表
- **THEN** 每个帖子对象包含 `isSaved: true/false`，基于当前用户 ID 是否在 `savedBy` 中

#### Scenario: 未登录用户 isSaved 为 false
- **WHEN** 未登录用户获取帖子列表
- **THEN** 每个帖子对象 `isSaved` 为 `false`
