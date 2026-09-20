## 1. Backend Model & Service

- [x] 1.1 创建 `backend/src/models/Notification.js` 数据模型
- [x] 1.2 创建 `backend/src/services/notificationService.js` 服务层
- [x] 1.3 实现 `createNotification()` 创建通知方法
- [x] 1.4 实现 `getNotifications(userId)` 获取通知列表
- [x] 1.5 实现 `markAsRead(notificationId)` 标记单条已读
- [x] 1.6 实现 `markAllAsRead(userId)` 标记全部已读
- [x] 1.7 实现 `getUnreadCount(userId)` 获取未读数量
- [x] 1.8 实现通知数量限制（保留最近30条）

## 2. Backend API Routes

- [x] 2.1 创建 `backend/src/routes/notificationRoutes.js` 路由
- [x] 2.2 实现 `GET /api/notifications` 获取通知列表
- [x] 2.3 实现 `GET /api/notifications/unread-count` 获取未读数量
- [x] 2.4 实现 `PUT /api/notifications/:id/read` 标记单条已读
- [x] 2.5 实现 `PUT /api/notifications/read-all` 标记全部已读
- [x] 2.6 在 `backend/src/index.js` 注册路由

## 3. Backend Notification Triggers

- [x] 3.1 在 `commentService.addComment()` 中触发评论通知
- [x] 3.2 在 `postService.likePost()` 中触发点赞通知
- [x] 3.3 在 `eventService.approveEvent()` 中触发审核通过通知
- [x] 3.4 在 `eventService.rejectEvent()` 中触发审核拒绝通知
- [x] 3.5 在 `adminService.banUser()` 中触发封禁通知
- [x] 3.6 在 `adminService.unbanUser()` 中触发解封通知

## 4. Frontend Service & Store

- [x] 4.1 创建 `frontend/src/services/notificationService.js` API 封装
- [x] 4.2 创建 `frontend/src/store/notificationStore.js` Zustand store
- [x] 4.3 实现 `fetchNotifications()` 获取通知列表
- [x] 4.4 实现 `fetchUnreadCount()` 获取未读数量
- [x] 4.5 实现 `markAsRead()` 标记已读
- [x] 4.6 实现 `markAllAsRead()` 标记全部已读
- [x] 4.7 实现点赞通知合并逻辑

## 5. Frontend Polling

- [x] 5.1 实现 `useNotificationPolling` hook
- [x] 5.2 设置 30 秒轮询间隔
- [x] 5.3 实现 `document.hidden` 检测，后台暂停轮询
- [x] 5.4 切回前台时立即刷新
- [x] 5.5 登录成功后立即获取通知

## 6. Frontend UI

- [x] 6.1 改造 `TopBar.jsx` 通知下拉框，使用真实数据
- [x] 6.2 实现通知列表展示
- [x] 6.3 实现未读数量徽章
- [x] 6.4 实现「全部已读」功能
- [x] 6.5 实现点击通知跳转（评论→帖子详情，活动→活动页等）
- [x] 6.6 实现空状态「暂无通知」

## 7. Integration

- [x] 7.1 在 `App.jsx` 中初始化通知轮询
- [x] 7.2 登录成功后触发首次通知获取
- [x] 7.3 测试各类型通知的创建和展示
