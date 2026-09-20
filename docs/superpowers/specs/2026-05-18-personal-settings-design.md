# 个人设置模块 — 设计文档

日期: 2026-05-18
状态: 设计稿（待实现）

## 1. 概述

为 NJU 树洞实现个人设置板块。用户可通过 `/settings` 页面查看个人信息、管理通知偏好，并通过单独的 `/settings/password` 页面修改密码（需邮箱验证）。

## 2. 页面结构

### 2.1 设置主页 (`/settings`)

单页滚动布局，包含两个板块：

#### 2.1.1 个人信息（只读展示）

- **校园邮箱** — 显示当前已注册验证的邮箱（如 `xxxxx@smail.nju.edu.cn`）
- **注册时间** — 显示账号注册日期（格式：`2024年3月15日`）
- **验证状态** — 邮箱已验证标记

数据来源：`GET /api/auth/me`，无需用户编辑。

#### 2.1.2 通知偏好（开关控制）

四项开关，默认均为开启（`true`）：

| 开关 | 含义 | 默认值 |
|------|------|--------|
| `reply` | 有人回复你的帖子或评论时通知 | `true` |
| `like` | 有人给你的帖子/评论点赞时通知 | `true` |
| `announcement` | 校园公告、平台运营通知 | `true` |
| `reportResult` | 投诉/举报处理结果通知 | `true` |

底部有「修改密码 →」链接跳转到 `/settings/password`。

### 2.2 修改密码页 (`/settings/password`)

三步操作流程:

1. 点击「发送验证码」→ 后端将 6 位验证码发送到用户邮箱
2. 输入验证码 + 新密码 + 确认新密码
3. 点击「保存修改」→ 后端校验验证码并更新密码

**交互时序：** 页面加载后所有表单字段均可见。点击「发送验证码」后按钮进入 60 秒倒计时。用户填写验证码、新密码、确认新密码后提交。

密码规则：最少 8 位，必须包含字母和数字（沿用现有注册规则）。

修改成功后跳转回 `/settings` 并显示成功提示。

### 2.3 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/settings` | `SettingsPage` | 设置主页 |
| `/settings/password` | `PasswordChangePage` | 修改密码 |

## 3. 后端 API

### 3.1 VerificationCode 模型变更

- `type` 枚举增加 `'change_password'` 类型

### 3.2 User 模型变更

新增字段:

```js
notificationPreferences: {
  reply: { type: Boolean, default: true },
  like: { type: Boolean, default: true },
  announcement: { type: Boolean, default: true },
  reportResult: { type: Boolean, default: true }
}
```

扩展 `toJSON()` 包含 `notificationPreferences`。

### 3.3 新增/修改 API 端点

#### `GET /api/auth/me`（已有）

返回值扩展包含 `notificationPreferences` 字段。

#### 验证码发送（复用已有端点）

- 复用 `POST /api/verify/send`，`type: 'change_password'`，`email` 由前端传递（可从前端已缓存的 `getMe()` 获取）
- 后端 `verifyController.sendCode` 新增对 `'change_password'` 类型的处理：不需校验域名（用户已验证过），不需校验用户存在（已登录），直接生成验证码并发送

#### `POST /api/auth/change-password`（新增）

- 认证：需要 JWT
- 请求体：`{ code: String, newPassword: String }`
- 流程：
  1. 从 JWT 获取用户邮箱
  2. 查找 `VerificationCode.findOne({ email, type: 'change_password', verified: true })`
  3. 校验 `expiresAt`
  4. 校验密码强度（≥8位，含字母和数字）
  5. 更新密码
  6. 清理验证码记录
- 响应：`{ message: '密码已更新' }`
- 错误：`CODE_NOT_FOUND`、`CODE_EXPIRED`、`WEAK_PASSWORD`

#### `PUT /api/auth/profile`（新增）

- 认证：需要 JWT
- 请求体：`{ notificationPreferences: { reply: Boolean, like: Boolean, ... } }`
- 流程：更新当前用户的 `notificationPreferences`
- 响应：`{ message: '更新成功', user: { ... } }`

## 4. 前端实现

### 4.1 组件结构

```
SettingsPage.jsx          # 设置主页 — 个人信息 + 通知偏好
PasswordChangePage.jsx    # 修改密码页
```

### 4.2 前端 API 层

在 `authService.js` 中新增（或新建 `userService.js`）:

```js
changePassword({ code, newPassword })   // POST /api/auth/change-password
updateProfile(data)                      // PUT /api/auth/profile
```

### 4.3 状态管理

- 通知偏好的开关状态在设置页内管理，修改后即时调用 API 更新后端
- 修改密码页使用本地表单状态，提交成功后清除

### 4.4 错误处理

- 通知偏好更新失败 → toast 提示"更新失败，请重试"
- 密码修改失败 → 在表单内显示具体错误（验证码错误/已过期/密码强度不够）
- 验证码发送失败 → 按钮恢复可点，显示错误提示

## 5. 边界情况

- **未验证邮箱用户尝试修改密码**：不允许发送验证码，提示"请先验证邮箱"
- **网络错误**：所有 API 调用需处理网络异常，显示友好提示
- **重复发送验证码**：发送按钮点击后进入 60 秒倒计时，防止频繁发送
- **验证码过期**：提交时后端校验，提示"验证码已过期，请重新获取"
