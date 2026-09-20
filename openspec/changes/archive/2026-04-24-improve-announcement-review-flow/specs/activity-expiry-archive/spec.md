# Activity Expiry Archive

活动过期归档能力，过期活动归档到"历史活动"区域。

## ADDED Requirements

### Requirement: 过期活动自动归档
活动时间过期后，系统 SHALL 将活动从公告列表移至"历史活动"区域。

#### Scenario: 活动过期后归档
- **WHEN** 活动时间已过
- **THEN** 活动从校园公告主列表移除
- **AND** 活动被添加到 nju_archived_events 列表
- **AND** 活动在"往期活动"区域展示

### Requirement: 校园公告页面展示往期活动
校园公告页面底部 SHALL 展示"往期活动"折叠区域，包含所有已归档活动。

#### Scenario: 展示往期活动区域
- **WHEN** 用户访问校园公告页面
- **THEN** 页面底部显示"往期活动"折叠区域
- **AND** 展开后可查看所有已归档活动

#### Scenario: 无往期活动时不展示
- **WHEN** 没有已归档活动
- **THEN** 不显示"往期活动"区域

### Requirement: 管理员可手动归档活动
管理员 SHALL 能够手动将活动标记为过期并归档。

#### Scenario: 手动归档活动
- **WHEN** 管理员在公告详情中点击"归档活动"
- **THEN** 活动从公告主列表移至往期活动区域
