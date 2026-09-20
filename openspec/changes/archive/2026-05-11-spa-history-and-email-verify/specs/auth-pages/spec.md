## ADDED Requirements

### Requirement: 「开始使用」按钮跳转登录

首页 LandingPage 的「开始使用」按钮 MUST 跳转到登录页而非注册页。

#### Scenario: 点击开始使用

- **WHEN** 未登录用户在首页点击"开始使用"
- **THEN** 页面跳转到登录页（`/login`），导航栏中"登录"按钮行为不变

### Requirement: 登录页"忘记密码"入口

登录页 MUST 提供"忘记密码"链接，点击跳转到忘记密码页面。

#### Scenario: 点击忘记密码

- **WHEN** 用户在登录页点击"忘记密码"
- **THEN** 跳转到忘记密码页面（`/forgot-password`）

### Requirement: 注册页增加验证码输入

注册页 MUST 在邮箱和密码之间增加验证码输入区域（输入框 + 发送验证码按钮）。

#### Scenario: 发送验证码

- **WHEN** 用户输入邮箱后点击"发送验证码"
- **THEN** 按钮进入 60 秒倒计时，显示"60s后重新发送"
- **THEN** 倒计时结束后按钮恢复为"发送验证码"

#### Scenario: 重新发送

- **WHEN** 倒计时结束后再次点击"发送验证码"
- **THEN** 重新发送并再次进入 60 秒倒计时

### Requirement: 未登录时页面 URL 可直达

在未登录状态下认证页面 MUST 通过 URL 直接访问（如 `/login`、`/register`、`/forgot-password`）

#### Scenario: 直接访问登录页

- **WHEN** 未登录用户直接访问 `/login`
- **THEN** 渲染登录页面

#### Scenario: 已登录用户访问认证页

- **WHEN** 已登录用户访问 `/login`
- **THEN** 重定向到首页 `/`
