## 1. Backend 基础搭建

- [x] 1.1 创建后端目录结构（config/, models/, routes/, controllers/, services/, middlewares/, utils/）
- [x] 1.2 创建 `index.js` 入口文件（Express 实例、中间件注册、路由挂载、MongoDB 连接）
- [x] 1.3 创建 `config/db.js` — MongoDB 连接配置
- [x] 1.4 创建 `utils/AppError.js` — 自定义错误类（statusCode, message, errorCode）
- [x] 1.5 创建 `utils/jwt.js` — JWT 令牌生成和验证函数（signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken）
- [x] 1.6 创建 `middlewares/errorHandler.js` — 全局错误处理中间件
- [x] 1.7 添加后端依赖（bcryptjs, jsonwebtoken, express-async-errors）并创建 `.env.example`

## 2. 后端用户模型

- [x] 2.1 创建 `models/User.js` — Mongoose 用户模型（email, password, nickname, role, timestamps）
- [x] 2.2 实现密码哈希 hook（pre-save 中间件，bcrypt cost=10）
- [x] 2.3 实现实例方法 `comparePassword(candidatePassword)`

## 3. 后端认证业务逻辑

- [x] 3.1 创建 `services/authService.js` — 注册逻辑（邮箱格式验证、密码强度检查、重复邮箱检测）
- [x] 3.2 实现 `authService.login()` — 登录逻辑（验证邮箱+密码，生成 Token 对）
- [x] 3.3 实现 `authService.refreshToken()` — Token 刷新逻辑
- [x] 3.4 实现 `authService.getCurrentUser()` — 获取当前用户信息
- [x] 3.5 实现 `authService.logout()` — 退出登录逻辑（可选 Token 黑名单）

## 4. 后端认证控制器与路由

- [x] 4.1 创建 `controllers/authController.js` — 注册、登录、获取用户信息、刷新 Token、退出控制器函数
- [x] 4.2 创建 `routes/authRoutes.js` — 路由定义（`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh`, `POST /api/auth/logout`）
- [x] 4.3 创建 `middlewares/auth.js` — JWT 验证中间件（从 Authorization header 提取 Token，验证，注入 req.user）
- [x] 4.4 在 `index.js` 中挂载 authRoutes 和 errorHandler

## 5. 前端认证基础设施

- [x] 5.1 安装 `zustand` 依赖
- [x] 5.2 创建 `src/store/authStore.js` — Zustand store（user, token, isAuthenticated, loading, error + actions: login, register, logout, restoreSession, clearError）
- [x] 5.3 创建 `src/services/authService.js` — 前端 API 封装（调用后端认证接口，处理 Token 存储）
- [x] 5.4 创建 `src/hooks/useAuth.js` — useAuth hook（封装 authStore 操作，提供便捷的登录/注册/登出方法）

## 6. 前端注册页面

- [x] 6.1 创建 `src/components/pages/RegisterPage.jsx` — 注册表单（邮箱、密码、确认密码输入框，"创建账号"按钮）
- [x] 6.2 实现表单验证（邮箱格式、密码强度 ≥8 位含字母数字、确认密码匹配）
- [x] 6.3 实现错误提示显示（红色文字，对应各输入框）
- [x] 6.4 实现 Loading 状态（按钮旋转 + 禁用防重复提交）
- [x] 6.5 实现"已有账号？登录"链接 → 跳转 LoginPage
- [x] 6.6 应用 NJU 树洞品牌风格（"Ｎ"标记 + 暖色设计语言，移动端适配 ≤680px）

## 7. 前端登录页面

- [x] 7.1 创建 `src/components/pages/LoginPage.jsx` — 登录表单（邮箱、密码输入框，"登录"按钮）
- [x] 7.2 实现错误提示显示（通用"邮箱或密码错误"提示）
- [x] 7.3 实现 Loading 状态（按钮旋转 + 禁用防重复提交）
- [x] 7.4 实现"没有账号？注册"链接 → 跳转 RegisterPage
- [x] 7.5 应用 NJU 树洞品牌风格（与 RegisterPage 一致的 UI 设计）

## 8. 前端集成与登录态恢复

- [x] 8.1 修改 `App.jsx` — 添加 `LoginPage` 和 `RegisterPage` 到 activePage 路由判断
- [x] 8.2 修改 `App.jsx` — 启动时调用 `authStore.restoreSession()` 检查 localStorage Token → 验证 → 恢复登录态
- [x] 8.3 修改 `App.jsx` — 登录态判断逻辑（从 `nju_engaged` 改为真实 Token + isAuthenticated 检查）
- [x] 8.4 修改 `LandingPage.jsx` — "登录"按钮 → `navigate('login')`，"注册"按钮 → `navigate('register')`，"开始使用"按钮 → `navigate('register')`
- [ ] 8.5 验证完整流程：未登录 → LandingPage → 注册 → 自动登录 → 主应用；已登录 → 刷新 → 自动恢复；登出 → 回到 LandingPage
