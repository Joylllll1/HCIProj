## Context

目前 SettingsPage 的前端代码已存在但功能残缺：个人信息硬编码展示，通知偏好仅存 localStorage 不落地后端，无密码修改功能。后端 User 模型仅有 email/password/nickname/role 四个字段，无通知偏好字段。验证码体系（VerificationCode 模型、邮箱发送服务）已存在且支持 register/reset_password 两种类型。

## Goals / Non-Goals

**Goals:**
- 个人信息（邮箱、注册时间、验证状态）从 `GET /api/auth/me` 读取，只读展示
- 通知偏好四组开关（reply/like/announcement/reportResult）支持在后端持久化，前端即时切换
- 修改密码通过邮箱验证码确认身份，流程复用现有验证码体系
- 新增两个 API 端点，一条新前端路由

**Non-Goals:**
- 不涉及头像上传、昵称编辑、个人简介
- 不涉及主题/外观配置
- 不涉及邮箱更换
- 不涉及 OAuth/第三方登录绑定

## Decisions

### 1. 复用现有 `/api/verify/send` + `/api/verify/check` 端点

- **选择**：VerificationCode 模型新增 `change_password` type，让设置页复用 send/check 流程发验证码到用户校园邮箱
- **理由**：与注册、忘记密码的验证模式保持一致，后端改动最小，前端只需额外传 type 参数
- **放弃方案**：单独创建认证后的发码端点 — 虽然更"干净"但增加了重复代码

### 2. 通知偏好使用 `PUT /api/auth/profile` 端点

- **选择**：新建一个专用于更新个人资料的端点，仅接收 `notificationPreferences` 对象
- **理由**：与 `GET /api/auth/me` 职责分离（me 返回认证信息 + 基础资料，profile 专用于写操作）
- **注意**：只做全量更新（前端每次发送完整的 notificationPreferences 对象），不做部分更新，保持简单

### 3. 修改密码走独立页面 `/settings/password`

- **选择**：将修改密码放在独立路由页面，不与设置主页混在一起
- **理由**：验证码 + 密码表单交互逻辑较复杂，独立页面体验更好；安全操作需要专注的交互流程
- **放弃方案**：Modal 弹窗内嵌 — 页面内嵌入完整的三步验证流程会导致设置主页过度膨胀

### 4. 密码修改使用 `POST /api/auth/change-password` 独立端点

- **选择**：新建认证后的密码修改端点，接收 `{ code, newPassword }`，后端从 JWT 获取邮箱
- **理由**：不要求用户（前端）传入邮箱，避免篡改风险；与 forgot-password 的 `/api/password/reset` 在职责上区分开

## Risks / Trade-offs

- **验证码明文存储**：现有 VerificationCode 的 code 字段以明文存储，未做哈希。数据库泄露会暴露所有验证码。**当前阶段可接受**（沿用现有模式），后续可考虑加哈希。
- **无频率限制**：现有验证码发送无频率限制。恶意调用可消耗邮箱服务额度或干扰用户。**风险低**（需要知道用户邮箱，且验证码仅 5 分钟有效）。
- **全量更新通知偏好**：每次切换开关都发送完整对象。当有大量开关时网络负载略高于增量更新。**现阶段完全可接受**。
