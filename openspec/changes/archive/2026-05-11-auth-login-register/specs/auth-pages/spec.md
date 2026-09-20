## ADDED Requirements

### Requirement: 注册页面（RegisterPage）

系统 SHALL 提供独立的注册页面，用户可通过邮箱和密码创建账号。

#### Scenario: 正常显示注册页面
- **WHEN** 未登录用户从 LandingPage 点击"注册"按钮
- **THEN** 导航到 RegisterPage，显示注册表单（邮箱输入框、密码输入框、确认密码输入框、"创建账号"按钮）

#### Scenario: 成功注册
- **WHEN** 用户在 RegisterPage 填写有效邮箱、密码和确认密码，点击"创建账号"按钮
- **THEN** 系统调用注册 API，成功后自动登录并导航至主应用首页（home）

#### Scenario: 注册失败显示错误
- **WHEN** 用户提交无效数据（邮箱格式错误、密码强度不足、确认密码不匹配、邮箱已被注册）
- **THEN** 表单显示对应的红色错误提示文字，不跳转页面

#### Scenario: 注册过程中显示 loading 状态
- **WHEN** 用户提交注册表单后，API 请求进行中
- **THEN** "创建账号"按钮显示 loading 状态（旋转 + 禁用点击），防止重复提交

#### Scenario: 从注册页回到登录页
- **WHEN** 用户已在 RegisterPage，点击"已有账号？登录"链接
- **THEN** 导航到 LoginPage

### Requirement: 登录页面（LoginPage）

系统 SHALL 提供独立的登录页面，已注册用户可通过邮箱和密码登录。

#### Scenario: 正常显示登录页面
- **WHEN** 未登录用户从 LandingPage 点击"登录"按钮
- **THEN** 导航到 LoginPage，显示登录表单（邮箱输入框、密码输入框、"登录"按钮）

#### Scenario: 成功登录
- **WHEN** 用户在 LoginPage 填写正确的邮箱和密码，点击"登录"按钮
- **THEN** 系统调用登录 API，成功后导航至主应用首页（home）

#### Scenario: 登录失败显示错误
- **WHEN** 用户提交错误的邮箱或密码
- **THEN** 表单显示"邮箱或密码错误"的通用错误提示

#### Scenario: 登录过程中显示 loading 状态
- **WHEN** 用户提交登录表单后，API 请求进行中
- **THEN** "登录"按钮显示 loading 状态，防止重复提交

#### Scenario: 从登录页回到注册页
- **WHEN** 用户已在 LoginPage，点击"没有账号？注册"链接
- **THEN** 导航到 RegisterPage

### Requirement: 与 LandingPage 集成

系统 SHALL 将 LandingPage 上的"登录"和"注册"按钮导向对应的认证页面。

#### Scenario: 点击"登录"按钮
- **WHEN** 用户在 LandingPage 导航栏点击"登录"
- **THEN** 导航到 LoginPage

#### Scenario: 点击"注册"按钮
- **WHEN** 用户在 LandingPage 导航栏点击"注册"
- **THEN** 导航到 RegisterPage

#### Scenario: 点击"开始使用"按钮
- **WHEN** 用户在 LandingPage 的 Hero 区或最终 CTA 区点击"开始使用"
- **THEN** 导航到 RegisterPage（引导注册）

### Requirement: 登录态保持

系统 SHALL 在页面刷新后自动恢复登录状态。

#### Scenario: 页面刷新时 Token 有效
- **WHEN** 已登录用户刷新页面
- **THEN** 前端检查 localStorage 中的 Token，调用 `GET /api/auth/me` 验证，成功后自动恢复登录态

#### Scenario: 页面刷新时 Token 过期但 Refresh Token 有效
- **WHEN** 已登录用户的 Access Token 过期但 Refresh Token 未过期
- **THEN** 前端自动使用 Refresh Token 获取新 Token，恢复登录态，用户无感知

#### Scenario: 页面刷新时两个 Token 均过期
- **WHEN** 已登录用户的 Access Token 和 Refresh Token 均已过期
- **THEN** 前端清除 Token，回到未登录状态，显示 LandingPage

### Requirement: 页面 UI 风格

登录页面和注册页面的 UI 风格 SHALL 与 LandingPage 一致，延续 NJU 树洞的暖色设计语言。

#### Scenario: 页面头部包含 NJU 树洞品牌标记
- **WHEN** 用户访问 LoginPage 或 RegisterPage
- **THEN** 页面顶部显示"Ｎ"品牌标记和"NJU 树洞"文字 Logo

#### Scenario: 页面适配移动端
- **WHEN** 用户在移动设备（≤ 680px）上访问登录或注册页面
- **THEN** 表单宽度自适应，输入框和按钮占满屏幕宽度，间距合理
