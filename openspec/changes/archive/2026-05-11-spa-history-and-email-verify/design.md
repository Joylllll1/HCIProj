## Context

NJU树洞当前使用 Zustand 的 `activePage` 字符串做页面路由（App.jsx 中通过条件渲染切换页面），未接入浏览器 History API，导致：
- 浏览器后退直接离开应用
- 无法使用前进/后退在页面间导航
- 页面状态无法通过 URL 分享

同时，用户注册目前仅需邮箱+密码，无邮箱验证，存在两个问题：
- 无法保证注册邮箱真实有效
- 无法实现忘记密码功能

## Goals / Non-Goals

**Goals:**
- 接入 History API 使浏览器前进/后退在工作
- 注册时发送验证码到学校邮箱，验证通过后才创建用户
- 支持忘记密码流程（邮箱验证 → 重置密码）
- 修复「开始使用」按钮跳转到登录页

**Non-Goals:**
- 不引入 react-router-dom，保持最小依赖
- 不做 detail/compose/bookmarks 等深层页面的 URL 映射（本次只覆盖 auth 相关页面 + 基本框架）
- 不做频率限制（后续再完善）
- 不做 refresh token 黑名单

## Decisions

### 1. History API 方案（代替 react-router-dom）

**方案选择**：轻量方案，在现有 uiStore 基础上改造。

**架构**：
```
navigate(page, params?) 调用流程：
  1. 计算 URL：page → URL 映射
  2. history.pushState({ page, params }, '', url)
  3. set({ activePage: page, ...params })

popstate 事件监听：
  1. 解析 window.location.pathname
  2. 查 URL → page 映射表
  3. set({ activePage, ...restoredParams })
```

**URL 映射**（本次范围）：
| 页面 | URL |
|------|-----|
| home | `/` |
| login | `/login` |
| register | `/register` |
| forgot-password | `/forgot-password` |
| reset-password | `/reset-password` |
| 其他 | `/`（暂不映射，后退到首页）|

### 2. 验证码数据模型

```
VerificationCode {
  email: String (indexed)
  code: String (6位数字)
  type: Enum['register', 'reset_password']
  expiresAt: Date (TTL index, 5分钟后自动删除)
  verified: Boolean (default false)
  createdAt: Date
}
```

使用 MongoDB TTL 索引自动清理过期验证码。

### 3. 邮件发送方案

使用 nodemailer + QQ邮箱 SMTP（免费，只需QQ邮箱开启SMTP服务获取授权码）。

`.env` 新增配置：
```
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your-qq@qq.com
SMTP_PASS=your-authorization-code
```

### 4. 注册流程（增加验证码步骤）

```
① 用户输入邮箱+密码 → 点击"发送验证码"
② 后端生成6位验证码 → 存入 MongoDB → 发送邮件
③ 用户输入验证码 → 点击注册
④ 后端验证验证码有效且未使用 → 标记已用 → 创建用户
⑤ 返回 JWT token，自动登录
```

### 5. 忘记密码流程

```
① 用户输入邮箱 → 点击"发送验证码"
② 后端检查邮箱是否存在 → 生成验证码 → 发送邮件
③ 用户输入验证码+新密码 → 点击重置
④ 后端验证验证码 → 更新密码
⑤ 跳转登录页
```

### 6. authStore 调整

登录成功后，当前 `onNavigate('home')` 会导致 URL 和状态不一致。改为用 `window.location.href = '/'` 或 navigate push 到 `/`，确保 history 栈正确。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| [复杂度] 轻量 History API 方案在后期引入 react-router-dom 时需要迁移 | 本次做了清晰的抽象（navigate + popstate），迁移时只需替换实现，接口不变 |
| [安全性] 邮件验证码 5 分钟有效期可能不够 | 可在 .env 中配置过期时间 |
| [可维护性] auth 页面（login/register/forgot/reset）URL 硬编码 | 在 uiStore 中维护统一映射表 |
| [兼容性] history.pushState 在老旧浏览器不支持 | 目标用户为南大师生，现代浏览器无问题 |
| [垃圾邮件] 验证码邮件可能被归入垃圾箱 | 邮件标题和内容标明「NJU树洞验证码」|

## Open Questions

- 注册时是否需要在发送验证码前先检查邮箱是否已被注册？（建议是，减少无效邮件）
- 生产环境是否用 QQ 邮箱 SMTP 还是学校邮箱 SMTP？（取决于部署者偏好，通过 .env 配置）
- 验证码邮件是否需要 HTML 模板？（简单场景纯文本即可，后续可升级）
