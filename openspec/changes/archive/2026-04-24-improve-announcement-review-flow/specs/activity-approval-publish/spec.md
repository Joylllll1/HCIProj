# Activity Approval Publish

活动通过审核并自动发布到校园公告的能力。

## ADDED Requirements

### Requirement: 通过审核的活动自动发布到校园公告
管理员通过活动审核后，系统 SHALL 将活动自动添加到校园公告列表中展示。

#### Scenario: 通过审核后活动出现在公告列表
- **WHEN** 管理员点击"通过审核"按钮
- **THEN** 活动从待审队列移除
- **AND** 活动被添加到已通过活动列表（nju_approved_events）
- **AND** 活动在校园公告页面可见

### Requirement: 通过审核时设置活动状态
活动通过审核时，系统 SHALL 设置活动状态为 'approved' 并记录审核时间。

#### Scenario: 活动状态更新
- **WHEN** 活动通过审核
- **THEN** 活动对象 status 字段设置为 'approved'
- **AND** 活动对象 reviewedAt 字段设置为当前时间

### Requirement: 已发布活动格式与公告卡片兼容
通过审核的活动数据格式 SHALL 与 SEED_ANNOUNCEMENTS 格式一致。

#### Scenario: 数据字段映射
- **WHEN** pendingEvent 转换为 approvedEvent
- **THEN** 字段映射如下：
  - id: 保持原 ID（PE-xxx）
  - title: 保持原标题
  - type: 活动类型
  - place: 活动地点
  - time: 活动时间
  - image: poster URL
  - status: 'approved'
  - reviewedAt: 审核时间戳

### Requirement: 通过审核时发送通知
活动通过审核后，系统 SHALL 向申请人发送审核通过通知。

#### Scenario: 通过通知内容
- **WHEN** 活动通过审核
- **THEN** 申请人收到通知，包含活动标题、"已通过审核"和"已在校园公告展示"

### Requirement: 校园公告页面合并展示官方和已审活动
校园公告页面 SHALL 同时展示 SEED_ANNOUNCEMENTS（官方公告）和已通过审核的活动。

#### Scenario: 公告列表合并渲染
- **WHEN** 用户访问校园公告页面
- **THEN** 页面展示官方公告 + 已通过审核活动的合并列表
