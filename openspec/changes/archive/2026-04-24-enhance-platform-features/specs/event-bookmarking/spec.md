# Event Bookmarking

活动收藏能力，用户可以收藏感兴趣的活动。

## ADDED Requirements

### Requirement: 用户可收藏活动
用户 SHALL 能够收藏活动到收藏文件夹。

#### Scenario: 收藏活动
- **WHEN** 用户点击活动的收藏按钮
- **THEN** 活动被添加到选定的收藏文件夹

#### Scenario: 活动收藏与帖子收藏统一
- **WHEN** 用户收藏活动或帖子
- **THEN** 使用相同的收藏机制和 UI

### Requirement: 收藏的活动在文件夹中展示
收藏文件夹 SHALL 能够展示用户收藏的活动。

#### Scenario: 在文件夹中查看活动
- **WHEN** 用户查看包含活动收藏的文件夹
- **THEN** 文件夹中显示收藏的活动卡片
