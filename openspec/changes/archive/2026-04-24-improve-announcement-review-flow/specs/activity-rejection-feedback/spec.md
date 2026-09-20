# Activity Rejection Feedback

活动拒绝反馈能力，支持管理员填写拒绝理由并通知申请人。

## ADDED Requirements

### Requirement: 拒绝活动必须填写理由
管理员拒绝活动申请时 SHALL 填写拒绝理由，理由不可为空。

#### Scenario: 点击拒绝按钮打开理由弹窗
- **WHEN** 管理员点击"拒绝"按钮
- **THEN** 系统显示拒绝理由弹窗，要求填写理由

#### Scenario: 无理由无法提交
- **WHEN** 管理员在拒绝理由弹窗中未填写任何理由
- **THEN** 提交按钮保持禁用状态

### Requirement: 拒绝理由支持预设选项和自定义输入
拒绝理由弹窗 SHALL 提供 5 个预设理由选项和自定义输入框。

#### Scenario: 选择预设理由
- **WHEN** 管理员选择预设理由选项
- **THEN** 系统使用该选项作为拒绝理由

#### Scenario: 自定义输入理由
- **WHEN** 管理员在自定义输入框中输入理由
- **THEN** 系统使用自定义内容作为拒绝理由

### Requirement: 拒绝后生成反馈通知
活动被拒绝后，系统 SHALL 生成包含拒绝理由的通知反馈给申请人。

#### Scenario: 拒绝通知内容
- **WHEN** 活动被拒绝
- **THEN** 申请人收到通知，包含活动标题和拒绝理由

#### Scenario: 拒绝活动状态记录
- **WHEN** 活动被拒绝
- **THEN** 活动被移入 nju_rejected_events 列表，包含 status='rejected' 和 rejectionReason 字段

### Requirement: 预设拒绝理由选项
系统 SHALL 提供以下预设拒绝理由选项：
- 内容不符合社区规范
- 活动信息不完整或有误
- 时间或地点安排冲突
- 非校园官方或认证社团活动
- 其他（需填写具体理由）
