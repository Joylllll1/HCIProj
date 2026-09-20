## Why

当前系统没有真正的用户认证机制：首次访问时自动生成匿名 ID（`getUserId()`），通过 `nju_engaged` localStorage 标记控制是否展示 LandingPage。用户无法注册账号、登录、管理会话，也无法区分"游客"和"注册用户"。这使得后续功能（收藏同步、内容追溯、权限管理）缺乏身份基础。需要引入完整的邮箱注册/登录系统来建立用户身份体系。

## What Changes

**新功能：**
- 注册（邮箱 + 密码）和登录功能，仅支持 Email 认证（不支持 Google/Apple/Passkey）
- JWT Token 管理（Access Token + Refresh Token 机制）
- 前端登录/注册页面（独立页面，非弹窗）
- 登录态保持（localStorage 持久化 Token，页面刷新后自动恢复）
- 用户会话管理（退出登录、Token 过期处理）
- 后端 Auth API（`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`）
- 后端认证中间件（JWT 验证、路由保护）
- 注册用户自动关联匿名 ID 体系

**修改：**
- App.jsx 登录态判断逻辑（从 `nju_engaged` 改为真实 Token 检查）
- LandingPage 的"开始使用""登录""注册"按钮行为（登录→LoginPage，注册→RegisterPage）
- 后端 `backend/src/` 目录首次创建（入口文件、中间件、路由注册骨架）
- MongoDB User 模型

## Capabilities

### New Capabilities
- `user-auth`: 用户邮箱注册、密码登录、JWT 会话管理、Token 刷新、退出登录。覆盖完整的后端认证流程和前端认证状态管理。
- `auth-pages`: 登录页面（LoginPage）和注册页面（RegisterPage）组件，包含表单验证、错误提示、与现有 LandingPage/App.jsx 的集成

### Modified Capabilities

无（当前没有需要修改 spec 级别的现有能力）

## Impact

- `backend/src/` 目录首次创建：
  - `index.js` — 入口文件（Express 实例、中间件注册、路由挂载、MongoDB 连接）
  - `models/User.js` — 用户 Mongoose 模型
  - `routes/authRoutes.js` — 认证路由
  - `controllers/authController.js` — 认证控制器
  - `services/authService.js` — 认证服务层（注册、登录、Token 管理）
  - `middlewares/auth.js` — JWT 验证中间件
  - `middlewares/errorHandler.js` — 全局错误处理
  - `utils/AppError.js` — 自定义错误类
  - `utils/jwt.js` — JWT 工具函数
- `frontend/` 新增和修改：
  - `src/store/authStore.js` — Zustand 认证状态 store（新增）
  - `src/services/authService.js` — 认证 API 封装（新增）
  - `src/hooks/useAuth.js` — 认证逻辑 Hook（新增）
  - `src/components/pages/LoginPage.jsx` — 登录页面（新增）
  - `src/components/pages/RegisterPage.jsx` — 注册页面（新增）
  - `src/App.jsx` — 登录态判断逻辑修改
  - `src/components/pages/LandingPage.jsx` — 按钮行为调整
- 新增依赖：
  - 后端：`bcryptjs`, `jsonwebtoken`, `express-async-errors`
  - 前端：`zustand`（已在项目计划中）
- 环境变量：
  - `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `PORT`
