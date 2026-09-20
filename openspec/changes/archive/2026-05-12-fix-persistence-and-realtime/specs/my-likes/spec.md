## ADDED Requirements

### Requirement: 系统提供我的所有点赞查询接口

系统 SHALL 提供 `GET /api/likes` 端点，返回认证用户点赞过的所有帖子、评论和回复。结果按两类返回：**帖子喜爱**和**评论喜爱**（评论喜爱包含评论和回复的点赞）。

#### Scenario: 获取所有点赞内容
- **WHEN** 认证用户发送 `GET /api/likes`
- **THEN** 系统返回 `{ posts: [...], comments: [...] }`
- `posts` 为当前用户 `likedBy` 包含该用户的帖子列表，每项包含帖子完整信息 + `isLiked: true`
- `comments` 为当前用户点赞过的评论和回复的合集，每项包含：
  - `type`: `"comment"` 或 `"reply"`
  - `item`: 评论或回复的完整信息
  - `postId`: 所属帖子 ID
  - `postTitle`: 所属帖子标题（便于前端展示上下文）
  - 回复还需包含 `parentCommentId` 和被回复内容摘要

#### Scenario: 未认证用户返回 401
- **WHEN** 未认证用户发送 `GET /api/likes`
- **THEN** 系统返回 401 错误

### Requirement: 点赞接口返回当前状态

`POST /api/posts/:id/like`、`POST /api/comments/:id/like`、`POST /api/comments/:id/reply/:replyId/like` 的返回数据 SHALL 包含 `liked` 布尔值和 `likes` 数字。

#### Scenario: 点赞后返回状态
- **WHEN** 认证用户点赞帖子
- **THEN** 系统返回 `{ liked: true, likes: <新点赞数> }`

#### Scenario: 取消点赞后返回状态
- **WHEN** 认证用户取消点赞帖子
- **THEN** 系统返回 `{ liked: false, likes: <新点赞数> }`

### Requirement: 评论/回复列表返回当前用户点赞状态

`GET /api/comments/:postId` 的返回数据 SHALL 包含评论和回复的 `isLiked` 字段。

#### Scenario: 已登录用户看到评论点赞状态
- **WHEN** 已登录用户获取评论列表
- **THEN** 每条评论包含 `isLiked`，每条回复包含 `isLiked`

#### Scenario: 未登录用户 isLiked 为 false
- **WHEN** 未登录用户获取评论列表
- **THEN** 每条评论和回复的 `isLiked` 为 `false`
