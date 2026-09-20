## 1. 后端 — 模型变更

- [x] 1.1 User 模型新增 `notificationPreferences` 字段（reply/like/announcement/reportResult，默认 true），扩展 `toJSON()` 包含该字段
- [x] 1.2 VerificationCode 模型 `type` 枚举新增 `change_password` 值

## 2. 后端 — 新增 API

- [x] 2.1 verifyController.sendCode 新增 `change_password` 类型处理（无需域名校验和用户存在校验，直接生成并发送验证码）
- [x] 2.2 authController + authService 新增 `updateProfile`：实现 `PUT /api/auth/profile`，更新当前用户的 notificationPreferences
- [x] 2.3 authController + authService 新增 `changePassword`：实现 `POST /api/auth/change-password`，通过验证码校验后更新密码
- [x] 2.4 authRoutes 注册两条新路由：`PUT /profile`，`POST /change-password`

## 3. 前端 — 数据层

- [x] 3.1 authService 新增 `updateProfile(data)` 函数（调 `PUT /api/auth/profile`）
- [x] 3.2 authService 新增 `changePassword({ code, newPassword })` 函数（调 `POST /api/auth/change-password`）

## 4. 前端 — 页面与路由

- [x] 4.1 重构 SettingsPage：个人信息改为从 `GET /api/auth/me` 读取并只读展示，通知偏好四个开关对接后端 `updateProfile`
- [x] 4.2 创建 PasswordChangePage：发送验证码、输入验证码+新密码、提交修改的完整流程
- [x] 4.3 更新路由：PAGE_URLS 添加 `/settings/password` 映射，App.jsx 添加密码修改页渲染分支
