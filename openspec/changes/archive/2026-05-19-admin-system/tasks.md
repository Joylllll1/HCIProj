## 1. 后端模型与基础配置

- [x] 1.1 创建 Report 模型（举报聚合）
- [x] 1.2 创建 Ban 模型（封禁记录）
- [x] 1.3 创建 AuditLog 模型（审计日志）
- [x] 1.4 为 Comment 模型添加 ownerUserId 字段
- [x] 1.5 配置环境变量 ADMIN_CONTACT_QQ
- [x] 1.6 配置邮件服务（复用现有配置）

## 2. 后端 API - Admin 路由与控制器

- [x] 2.1 创建 adminRoutes.js 路由结构
- [x] 2.2 实现 isAdmin 权限中间件
- [x] 2.3 实现 GET /api/admin/reports（举报列表）
- [x] 2.4 实现 POST /api/admin/reports/:id/dismiss（驳回举报）
- [x] 2.5 实现 POST /api/admin/posts/:id/trace（追溯身份）
- [x] 2.6 实现 POST /api/admin/users/:id/ban（封禁用户）
- [x] 2.7 实现 POST /api/admin/bans/:id/unban（提前解禁）
- [x] 2.8 实现 DELETE /api/admin/posts/:id（删除帖子）
- [x] 2.9 实现 GET /api/admin/bans（封禁记录列表）
- [x] 2.10 实现 GET /api/admin/audit-logs（审计日志查询）

## 3. 后端业务逻辑 - Admin Service

- [x] 3.1 实现 reportService（举报聚合、创建、查询）
- [x] 3.2 实现 banService（封禁、解禁、过期检查）
- [x] 3.3 实现 tracingService（匿名追溯）
- [x] 3.4 实现 auditLogService（审计日志记录）
- [x] 3.5 实现邮件通知服务（封禁/解禁邮件）
- [x] 3.6 在 Post/Comment 查询中添加封禁检查中间件

## 4. 后端 - 用户认证调整

- [x] 4.1 修改登录响应，返回用户 role
- [x] 4.2 在受保护路由中检查用户封禁状态
- [x] 4.3 封禁用户尝试发帖/评论时返回封禁信息

## 5. 前端 - 登录与路由

- [x] 5.1 修改登录逻辑，根据 role 跳转（admin → /admin）
- [x] 5.2 添加 /admin 路由保护（仅 admin 可访问）
- [x] 5.3 普通用户登录后隐藏侧边栏"管理后台"入口
- [x] 5.4 管理员侧边栏显示管理后台入口

## 6. 前端 - Admin API 服务

- [x] 6.1 创建 adminService.js（封装所有 admin API）
- [x] 6.2 创建 useAdminStore（Zustand store）管理 admin 状态

## 7. 前端 - AdminPage 重构

- [x] 7.1 重写举报列表组件（聚合显示、举报次数）
- [x] 7.2 实现帖子详情弹窗（复用/改造现有卡片）
- [x] 7.3 实现"删除帖子"功能（调用 API + 确认弹窗）
- [x] 7.4 实现"驳回举报"功能
- [x] 7.5 实现"追溯身份"功能（填写原因 → 显示邮箱 + 统计）
- [x] 7.6 实现"封禁用户"功能（选择天数、填写原因、发送邮件）
- [x] 7.7 移除右侧边栏"实名映射查询"骨架UI

## 8. 前端 - 封禁管理页面

- [x] 8.1 创建封禁记录列表组件
- [x] 8.2 实现"提前解禁"功能（填写原因）
- [x] 8.3 显示关联帖子（可点击查看，即使已删除）
- [x] 8.4 显示封禁状态（剩余时间/已到期）

## 9. 测试与验证

- [ ] 9.1 测试完整流程：举报 → 处理 → 追溯 → 封禁 → 解禁
- [ ] 9.2 测试封禁期间用户行为（可看不可发）
- [ ] 9.3 测试自然到期自动解禁
- [ ] 9.4 测试邮件发送（封禁/解禁通知）
- [ ] 9.5 测试审计日志记录
- [ ] 9.6 测试普通用户无法访问 admin 路由

## 10. 清理与优化

- [x] 10.1 移除 reportService.js 中的 localStorage 临时实现
- [ ] 10.2 移除 AdminPage.jsx 中的 seed 数据（已用 AdminDashboard 替代）
- [x] 10.3 添加必要的错误处理和加载状态
- [x] 10.4 代码审查和简化
