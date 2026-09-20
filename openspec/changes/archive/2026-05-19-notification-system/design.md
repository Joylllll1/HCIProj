## Context

当前通知系统仅存在于前端 mock 数据阶段（SEED_NOTIFS），使用 localStorage 存储，无法跨设备同步。后端缺乏 Notification 模型和触发机制。需要在评论、点赞、活动审核等关键操作后自动创建通知。

现有基础：
- `TopBar.jsx` 有通知下拉 UI，接收 `notifs` 和 `onMarkAllRead` props
- `uiStore.js` 有本地通知状态管理（`addNotif`, `markAllNotifsRead`）
- `SettingsPage.jsx` 有通知偏好设置（但仅本地生效）

## Goals / Non-Goals

**Goals:**
- 后端持久化存储通知数据（MongoDB）
- 评论、点赞、活动审核、封禁/解封时自动触发通知
- 前端轮询获取未读通知（30秒间隔）
- 点赞通知在前端合并显示
- 保留最近 30 条通知

**Non-Goals:**
- WebSocket 实时推送（轮询足够）
- 邮件/短信推送
- 通知删除功能（仅标记已读）
- 批量操作（如批量删除）

## Decisions

### 1. 数据模型设计

```javascript
Notification {
  recipient: ObjectId     // 接收者用户ID
  type: String            // comment | like | event_approved | event_rejected | banned | unbanned
  title: String           // 通知标题（简短）
  content: String         // 通知内容
  relatedId: ObjectId     // 关联对象ID（帖子/评论/活动）
  relatedType: String     // post | comment | event
  relatedData: Object     // 冗余存储关联对象基本信息（如帖子标题）
  read: Boolean           // 是否已读，默认 false
  createdAt: Date         // 创建时间
}
```

**Rationale**: 冗余存储 relatedData 避免 JOIN 查询，提高性能。通知只展示基础信息，详情通过 relatedId 跳转查看。

### 2. 点赞合并策略

后端为每个点赞创建单独通知记录，前端按 `relatedId` 分组合并显示：
```
同帖子的3个点赞 → 前端显示「3人赞了你的帖子《xxx》」
```

**Rationale**: 后端简单，合并逻辑在视图层处理，可随时调整合并规则。

### 3. 轮询策略

- 间隔：30秒
- 后台标签页暂停轮询（`document.hidden` 检测）
- 切回前台时立即刷新
- 首次加载和登录后立即获取

**Rationale**: 简单可靠，避免 WebSocket 连接管理复杂度。30秒平衡实时性和服务器负载。

### 4. 通知类型与触发点

| 类型 | 触发位置 | 接收者 |
|------|---------|--------|
| `comment` | `commentService.addComment()` | 帖子作者 |
| `like` | `postService.likePost()` | 帖子/评论作者 |
| `event_approved` | `eventService.approveEvent()` | 活动提交者 |
| `event_rejected` | `eventService.rejectEvent()` | 活动提交者 |
| `banned` | `adminService.banUser()` | 被封禁用户 |
| `unbanned` | `adminService.unbanUser()` | 被解封用户 |

### 5. 数据清理

保留最近 30 条通知，创建新通知时异步删除超出的旧记录。

**Rationale**: 避免无限增长，30条足够用户查看近期动态。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| 高频点赞导致通知爆炸 | 前端合并显示，后端限制单个用户频繁点赞 |
| 轮询增加服务器负载 | 30秒间隔，后台暂停，接口返回精简字段 |
| 通知丢失（网络波动） | 前端乐观更新，失败重试，下次轮询补全 |
| 数据一致性（删除帖子后通知残留） | relatedData 冗余存储基础信息，即使原帖子删除也能显示 |

## Migration Plan

1. 部署后端模型和 API
2. 部署前端 notificationStore 改造
3. 可选：迁移现有用户数据（如有需要，实际不需要，从空开始）

## Open Questions

无
