## 1. 后端 API

- [x] 1.1 新增 `getMyEvents` 服务函数，查询当前用户提交的活动
- [x] 1.2 在 eventRoutes.js 添加 `GET /api/events/my` 路由
- [x] 1.3 在 eventService.js 添加前端 API 函数 `getMyEvents`

## 2. 前端 Store

- [x] 2.1 在 eventStore.js 添加 `myEvents` 状态
- [x] 2.2 添加 `fetchMyEvents` action
- [x] 2.3 添加 `myEventsLoading` 加载状态

## 3. 活动墙展示

- [x] 3.1 重构 AnnouncementsPage，移除假数据 SEED_ANNOUNCEMENTS
- [x] 3.2 连接 getPublicEvents API，展示已通过审核的活动
- [x] 3.3 实现往期活动折叠区域（根据 time 判断是否过期）
- [x] 3.4 实现分类筛选功能

## 4. 发布活动

- [x] 4.1 重构发布活动 Modal，连接 createEvent API
- [x] 4.2 添加提交成功提示
- [x] 4.3 提交后刷新活动列表

## 5. 我的申请

- [x] 5.1 在 AnnouncementsPage 添加 Tab 切换（全部活动/我的申请）
- [x] 5.2 实现"我的申请"列表，展示审核状态
- [x] 5.3 显示被拒绝活动的拒绝原因

## 6. 集成测试

- [ ] 6.1 测试活动列表展示
- [ ] 6.2 测试分类筛选
- [ ] 6.3 测试提交活动申请
- [ ] 6.4 测试我的申请列表
- [ ] 6.5 测试往期活动折叠
