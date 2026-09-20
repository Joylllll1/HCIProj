# Homepage Carousel

首页轮播管理能力，管理员可选择活动海报在首页展示。

## ADDED Requirements

### Requirement: 管理员可配置首页轮播内容
管理员 SHALL 能够选择通过审核的活动海报在首页轮播展示。

#### Scenario: 添加活动到轮播
- **WHEN** 管理员在管理后台选择活动并添加到轮播
- **THEN** 该活动海报出现在首页轮播图中

#### Scenario: 移除轮播项
- **WHEN** 管理员从轮播中移除活动
- **THEN** 该活动海报从首页轮播图中消失

### Requirement: 轮播配置持久化
轮播配置 SHALL 存储在 localStorage 中，包含轮播项列表和顺序。

#### Scenario: 保存轮播配置
- **WHEN** 管理员修改轮播配置
- **THEN** 配置被保存到 localStorage
- **AND** 刷新页面后配置保持不变

### Requirement: 首页轮播展示活动海报
首页轮播图 SHALL 支持展示管理员配置的活动海报。

#### Scenario: 点击轮播图跳转活动详情
- **WHEN** 用户点击首页的活动轮播图
- **THEN** 跳转到校园公告页面并打开该活动详情
