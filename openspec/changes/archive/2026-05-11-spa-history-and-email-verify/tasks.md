## 1. 修复「开始使用」按钮跳转

- [x] 1.1 将 App.jsx 中 `onGetStarted` 的 `navigate('register')` 改为 `navigate('login')`

## 2. SPA 浏览器历史导航

- [x] 2.1 在 uiStore 中新增 url 映射表（login→/login, register→/register 等），改造 navigate 函数使其同步 pushState
- [x] 2.2 在 App.jsx 中添加 popstate 事件监听 + 首次加载从 URL 恢复 activePage
- [x] 2.3 处理登录成功后 navigate('home') 时同步 URL（pushState 到 /）
- [ ] 2.4 测试验证：未登录时点击/后退/前进，URL 和页面状态一致

## 3. 后端：验证码邮件服务

- [ ] 3.1 安装 nodemailer 依赖，在 .env 中增加 SMTP 配置
- [x] 3.2 创建 VerificationCode Model（email, code, type, expiresAt[TTL], verified）
- [x] 3.3 创建 emailService.js（封装 nodemailer transporter + sendVerificationCode 方法）
- [x] 3.4 创建 verifyRoutes.js + verifyController.js（POST /api/verify/send, POST /api/verify/check）

## 4. 后端：注册/密码重置增加验证码校验

- [x] 4.1 在 authService.register() 中增加验证码校验步骤（先验证再创建用户）
- [x] 4.2 创建 passwordRoutes.js + passwordController.js（POST /api/password/forgot, POST /api/password/reset）
- [ ] 4.3 验证：注册时验证码错误/过期返回对应提示

## 5. 前端：注册页增加验证码交互

- [x] 5.1 在 RegisterPage.jsx 增加验证码输入框 +「发送验证码」按钮 + 60 秒倒计时
- [x] 5.2 创建 verifyService.js 对接后端验证码接口（发送 + 校验）

## 6. 前端：忘记密码 / 重置密码页面

- [x] 6.1 创建 ForgetPasswordPage.jsx（输入邮箱 → 发送验证码 → 输入验证码+新密码）
- [x] 6.2 在 App.jsx 中注册 forget-password 页面路由
- [x] 6.3 在 LoginPage.jsx 增加「忘记密码」链接入口
- [x] 6.4 对接后端重置密码接口

## 7. 构建与部署

- [ ] 7.1 npm run build 构建前端
- [ ] 7.2 部署到服务器（复制 dist 文件 + 重启 PM2）
- [ ] 7.3 验证完整流程：注册（验证码）→ 登录 → 前进/后退 → 退出 → 忘记密码/重置 → 重新登录
