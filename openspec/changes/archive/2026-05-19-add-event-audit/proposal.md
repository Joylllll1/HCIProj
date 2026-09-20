## Why

当前公告审核功能仅使用 localStorage 存储，数据无法跨设备、跨用户共享，管理员审核流程无法真正落地。需要将公告审核迁移到数据库，并集成到 AdminDashboard 中，为后续完整的公告系统铺路。

## What Changes

- 新增后端 `Event` 模型，支持活动信息的持久化存储
- 新增后端 Event API（创建、查询、审核、归档）
- AdminDashboard 新增"公告审核"Tab，支持待审核/已通过/已拒绝列表
- 前端 `eventStore` 从 localStorage 迁移为 API 调用
- AuditLog 模型扩展，记录审核操作日志

## Capabilities

### New Capabilities

- `event-audit`: 公告审核功能，包括活动提交、审核通过/拒绝、归档等完整流程

### Modified Capabilities

无（公告审核是新增功能，不影响现有能力）

## Impact

### 后端
- 新增 `models/Event.js`
- 新增 `services/eventService.js`
- 新增 `controllers/eventController.js`
- 新增 `routes/eventRoutes.js`
- 修改 `models/AuditLog.js`（enum 添加 `approve_event`, `reject_event`, `archive_event`）
- 修改 `index.js`（注册 eventRoutes）

### 前端
- 修改 `components/layout/AdminSidebar.jsx`（添加"公告审核"按钮）
- 修改 `components/pages/AdminDashboard.jsx`（添加 events Tab 及相关 UI）
- 修改 `store/eventStore.js`（改为 API 调用）
- 修改 `services/eventService.js`（新增 API 调用函数）
- 复用 `AdminPage.jsx` 中的 `EventDetailModal`、`RejectionModal` 组件

## 非目标

- 不实现轮播图管理（后续迭代）
- 不实现活动报名功能（后续迭代）
- 不修改普通用户的公告页面展示逻辑
