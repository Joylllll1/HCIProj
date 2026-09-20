## Context

公告审核功能已有前端 UI 雏形（AdminPage.jsx），但数据层使用 localStorage，无法实现真正的审核流程。本设计将公告审核功能迁移到数据库，并集成到现有 AdminDashboard 中。

## Goals / Non-Goals

**Goals:**

- 用户可提交活动申请（标题、类型、地点、时间、简介、海报）
- 管理员可在 AdminDashboard 查看待审核活动列表
- 管理员可通过/拒绝活动，拒绝需填写理由
- 审核通过的活动可在公告页面展示
- 审核操作记录审计日志

**Non-Goals:**

- 轮播图管理（后续迭代）
- 活动报名功能（后续迭代）
- 邮件通知申请人（后续迭代）
- 修改公告页面的展示逻辑（复用现有组件）

## Decisions

### 数据模型设计

```javascript
// Event Schema
{
  title: String,           // 活动名称，必填
  type: String,            // 活动类型：官方活动/学术讲座/体育赛事/科技竞赛/志愿公益/答辩/校招/实习招聘/校园招聘会
  place: String,           // 活动地点，必填
  time: Date,              // 活动时间，必填
  description: String,     // 活动简介
  image: String,           // 海报图片 URL
  status: String,          // pending/approved/rejected/archived
  submittedBy: ObjectId,   // 提交用户ID
  reviewedBy: ObjectId,    // 审核管理员ID
  reviewedAt: Date,        // 审核时间
  rejectionReason: String, // 拒绝原因
  createdAt: Date,
  updatedAt: Date
}
```

**Rationale**: 使用 status 字段统一管理状态流转，避免多表复杂关联。

### API 设计

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| GET | /api/events | public | 获取已发布公告（status=approved） |
| POST | /api/events | user | 提交活动申请 |
| GET | /api/events/pending | admin | 获取待审核活动 |
| GET | /api/events/rejected | admin | 获取已拒绝活动 |
| POST | /api/events/:id/approve | admin | 通过审核 |
| POST | /api/events/:id/reject | admin | 拒绝（需理由） |
| POST | /api/events/:id/archive | admin | 归档已通过的活动 |

**Rationale**: RESTful 风格，权限分离清晰。

### 状态流转

```
pending ──approve──→ approved ──archive──→ archived
    │
    └──reject──→ rejected
```

### 复用现有组件

- AdminPage.jsx 中的 `EventDetailModal` → 活动详情弹窗
- AdminPage.jsx 中的 `RejectionModal` → 拒绝理由弹窗
- `event-card` CSS 类 → 活动卡片样式
- `REJECTION_REASONS` 常量 → 预设拒绝理由

**Rationale**: 避免重复造轮子，保持一致性。

### AdminSidebar 顺序

```
1. 公告审核 (events) - 新增
2. 举报管理 (reports)
3. 封禁记录 (bans)
4. 审计日志 (audit)
```

**Rationale**: 按业务优先级排序，公告审核是高频操作。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 图片存储：海报图片 URL 存储，不处理上传 | 当前阶段使用外部图床 URL，后续迭代增加上传功能 |
| 并发审核：多管理员同时操作可能冲突 | 乐观锁（updatedAt 校验），失败重试 |
| 数据迁移：现有 localStorage 数据丢失 | 公告审核未正式上线，无存量数据 |

## Migration Plan

无需迁移，新功能从零开始。

## Open Questions

无
