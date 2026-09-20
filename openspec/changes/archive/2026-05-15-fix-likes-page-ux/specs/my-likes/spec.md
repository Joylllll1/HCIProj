## MODIFIED Requirements

### Requirement: 我的喜爱页面交互优化

我的喜爱页面的 UI 和交互 SHALL 与主页的排序按钮风格一致，帖子取消点赞 SHALL 延迟提交，评论/回复 SHALL 支持点赞切换。

#### Scenario: Tab 选中样式
- **WHEN** 用户选中"帖子"或"评论"Tab
- **THEN** 该 Tab 按钮显示 `bg-blue-soft text-blue border-blue` 样式（与主页"最新发布/高赞共鸣"一致）

#### Scenario: 帖子取消点赞延迟提交
- **WHEN** 用户点击已点赞帖子的爱心图标取消点赞
- **THEN** 帖子保留在列表中，心形图标更新为未点赞状态，但 API 不调用
- **WHEN** 用户切换出"我的喜爱-帖子" Tab 或离开页面
- **THEN** 系统批量提交所有待取消的点赞到后端

#### Scenario: 评论点赞切换
- **WHEN** 用户点击评论卡片的爱心图标
- **THEN** 调用 `POST /api/comments/:commentId/like`，点赞状态切换
- **WHEN** 再次点击
- **THEN** 调用 `DELETE /api/comments/:commentId/like` 或再次调用 POST 取消点赞

#### Scenario: 回复点赞切换
- **WHEN** 用户点击回复的爱心图标
- **THEN** 调用 `POST /api/comments/:commentId/reply/:replyId/like`

#### Scenario: 评论卡片显示帖子标题
- **WHEN** 用户查看点赞的评论
- **THEN** 每条评论卡片显示"来自：{postTitle}"（来自 API 返回的 postTitle 字段）

#### Scenario: 评论卡片使用爱心图标
- **WHEN** 用户查看点赞的评论列表
- **THEN** 评论/回复使用爱心图标（`favorite`）而非拇指图标（`thumb_up`）