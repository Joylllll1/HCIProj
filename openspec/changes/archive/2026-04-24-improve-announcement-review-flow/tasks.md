## 1. 数据层扩展

- [x] 1.1 App.jsx 新增 `approvedEvents`、`rejectedEvents`、`archivedEvents` 状态，使用 loadJSON/saveJSON 持久化
- [x] 1.2 App.jsx 新增 `onApproveEvent` 回调：将 pendingEvent 转换为 announcement 格式后加入 approvedEvents，从 pendingEvents 移除，发送通过通知
- [x] 1.3 App.jsx 新增 `onRejectEvent` 回调：接收拒绝理由，将 pendingEvent 加入 rejectedEvents（含 rejectionReason），从 pendingEvents 移除，发送拒绝通知
- [x] 1.4 App.jsx 新增 `onArchiveEvent` 回调：将活动从 approvedEvents 移至 archivedEvents

## 2. 管理后台整体 UI 重设计

- [x] 2.1 使用 impeccable skill 重新设计 AdminPage 整体布局，包括统计卡片、举报队列、审核队列、侧边面板的视觉层次和排列
- [x] 2.2 AdminPage 新增活动详情弹窗（ReviewDetailModal），复用 AnnouncementsPage 的 modal 样式，展示海报、标题、描述、时间、地点、类型
- [x] 2.3 AdminPage 新增拒绝理由弹窗（RejectionModal），包含 5 个预设理由选项 + 自定义输入框，理由必填

## 3. 审核流程逻辑完善

- [x] 3.1 AdminPage 点击"查看详情"打开 ReviewDetailModal，展示完整活动信息
- [x] 3.2 AdminPage 点击"通过审核"调用 onApproveEvent，活动从队列移除并自动添加到校园公告，发送通过通知
- [x] 3.3 AdminPage 点击"拒绝"打开 RejectionModal，提交理由后调用 onRejectEvent，发送拒绝通知

## 4. 校园公告动态展示与过期归档

- [x] 4.1 AnnouncementsPage 接收 `approvedEvents` 和 `archivedEvents` prop，与 SEED_ANNOUNCEMENTS 合并渲染
- [x] 4.2 已审核活动详情弹窗可正常打开，展示完整活动信息
- [x] 4.3 AnnouncementsPage 分类筛选逻辑适配合并后的列表
- [x] 4.4 AnnouncementsPage 底部新增"往期活动"折叠区域，展示已归档活动
- [x] 4.5 AnnouncementsPage 活动详情弹窗增加"归档活动"按钮（管理员可用），点击后调用 onArchiveEvent

## 5. 样式与交互打磨

- [x] 5.1 管理后台整体样式与项目风格一致（使用 impeccable skill 验证）
- [x] 5.2 审核详情弹窗、拒绝理由弹窗样式与公告详情弹窗风格一致
- [x] 5.3 通过/拒绝/归档操作后显示 Toast 提示
