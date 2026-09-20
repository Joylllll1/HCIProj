## Why

NJU树洞已部署上线，但存在三个影响用户体验的问题：(1) 首页「开始使用」按钮错误跳转到注册页而非登录页；(2) 应用内无法使用浏览器前进/后退导航，后退直接离开网站；(3) 缺乏邮箱验证机制，注册无法保证邮箱真实性，也无法实现忘记密码功能。

## What Changes

1. **修复「开始使用」跳转**：LandingPage 的「开始使用」按钮改为跳转到登录页
2. **SPA 浏览器历史导航**：接入 History API，使浏览器前进/后退按钮能在应用页面间正常切换
3. **邮箱验证码系统**：注册时发送验证码到学校邮箱，确保邮箱真实有效
4. **忘记密码功能**：通过邮箱验证码验证身份后重置密码
5. **新增页面**：忘记密码页面、重置密码页面（与登录/注册页风格一致）

## Capabilities

### New Capabilities
- `spa-routing`: 基于 History API 的 SPA 路由（页面切换同步 URL、popstate 监听、navigate 改造）
- `email-verify`: 邮箱验证码（注册验证、验证码发送、验证码校验、过期清理）
- `password-reset`: 忘记/重置密码（通过验证码验证身份后重置密码、新密码强度校验）
- `auth-pages`: 认证页面的交互优化（登录/注册/忘记密码/重置密码四页面对应 URL）

### Modified Capabilities

- （无修改，本次为全新能力）

## 非目标

- 本次不改动现有页面的内容路由（detail/compose/bookmarks 等页面的 URL 映射会在后期迭代中完善）
- 不接入 react-router-dom，用轻量 History API 方案
- 不实现令牌黑名单或 refresh token 轮换
- 不做登录状态持久化以外的安全增强（如 IP 限制、频率限制等后续再做）

## Impact

- **前端新增**: uiStore.js（navigate 改造）、App.jsx（popstate 监听）、ForgetPasswordPage.jsx、ResetPasswordPage.jsx、邮箱验证码输入交互
- **前端修改**: LandingPage.jsx（开始使用跳转）、LoginPage.jsx（接入忘记密码入口）、RegisterPage.jsx（增加验证码输入）
- **后端新增**: models/VerificationCode.js、services/emailService.js、routes/verifyRoutes.js、routes/passwordRoutes.js
- **后端修改**: authController.js / authService.js（注册增加验证码校验）
- **新增依赖**: nodemailer
- **配置变更**: .env 新增邮件 SMTP 配置项
