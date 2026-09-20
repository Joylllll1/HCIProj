# Activity Review Detail

活动审核详情查看能力，支持管理员在审核队列中查看完整活动信息。

## ADDED Requirements

### Requirement: 管理员可查看待审活动详情
在管理后台审核队列中，管理员 SHALL 能够查看待审核活动的完整详情，包括海报、标题、描述、时间、地点、类型。

#### Scenario: 打开活动详情弹窗
- **WHEN** 管理员在审核队列中点击"查看详情"按钮
- **THEN** 系统显示活动详情弹窗，展示完整活动信息

#### Scenario: 详情弹窗展示内容
- **WHEN** 活动详情弹窗打开
- **THEN** 弹窗显示活动海报（如有）、标题、类型、时间、地点、描述
- **AND** 弹窗包含"关闭"按钮可关闭弹窗

### Requirement: 详情弹窗复用公告详情设计
活动详情弹窗 SHALL 复用 AnnouncementsPage 的详情弹窗样式和布局。

#### Scenario: 样式一致性
- **WHEN** 用户查看公告详情或管理员查看活动详情
- **THEN** 两处弹窗使用相同的视觉样式、动画效果和布局结构

### Requirement: 详情弹窗支持海报展示
若活动包含海报，详情弹窗 SHALL 在顶部展示海报图片。

#### Scenario: 有海报时展示
- **WHEN** 活动包含 poster URL
- **THEN** 详情弹窗顶部展示海报图片，宽度 100%，高度 240px

#### Scenario: 无海报时不展示
- **WHEN** 活动不包含 poster URL
- **THEN** 详情弹窗不显示海报区域
