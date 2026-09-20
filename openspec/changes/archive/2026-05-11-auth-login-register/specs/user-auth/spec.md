## ADDED Requirements

### Requirement: 用户邮箱注册

系统 SHALL 支持用户通过邮箱地址和密码完成注册，创建新账号。

#### Scenario: 成功注册
- **WHEN** 用户提交有效的邮箱（`test@nju.edu.cn`）和密码（至少 8 位，含字母和数字）
- **THEN** 系统创建新用户，返回 201 状态码和用户信息（不含密码）+ JWT Token 对

#### Scenario: 邮箱已被注册
- **WHEN** 用户尝试使用已存在的邮箱注册
- **THEN** 系统返回 409 状态码和错误信息"该邮箱已被注册"

#### Scenario: 邮箱格式无效
- **WHEN** 用户提交格式无效的邮箱（如 `abc`、空值）
- **THEN** 系统返回 400 状态码和错误信息"请输入有效的邮箱地址"

#### Scenario: 密码强度不足
- **WHEN** 用户提交的密码少于 8 位或不含字母/数字
- **THEN** 系统返回 400 状态码和错误信息"密码至少 8 位，需包含字母和数字"

### Requirement: 用户登录

系统 SHALL 支持已注册用户通过邮箱和密码登录。

#### Scenario: 成功登录
- **WHEN** 用户提交正确的邮箱和密码
- **THEN** 系统返回 200 状态码和用户信息 + JWT Token 对（Access + Refresh）

#### Scenario: 邮箱不存在
- **WHEN** 用户提交未注册的邮箱
- **THEN** 系统返回 401 状态码和错误信息"邮箱或密码错误"（不暴露邮箱是否存在）

#### Scenario: 密码错误
- **WHEN** 用户提交正确的邮箱但密码错误
- **THEN** 系统返回 401 状态码和错误信息"邮箱或密码错误"

### Requirement: 获取当前用户信息

系统 SHALL 支持通过有效的 Access Token 获取当前登录用户信息。

#### Scenario: Token 有效
- **WHEN** 用户携带有效 Access Token 请求当前用户信息
- **THEN** 系统返回 200 状态码和用户信息（`id`, `email`, `nickname`, `role`, `createdAt`）

#### Scenario: Token 过期
- **WHEN** 用户携带过期的 Access Token
- **THEN** 系统返回 401 状态码和错误信息"Token 已过期"

#### Scenario: Token 无效
- **WHEN** 用户携带格式错误或被篡改的 Token
- **THEN** 系统返回 401 状态码和错误信息"无效的认证凭证"

### Requirement: Token 刷新

系统 SHALL 支持使用 Refresh Token 获取新的 Access Token。

#### Scenario: 成功刷新
- **WHEN** 用户携带有效 Refresh Token 请求刷新
- **THEN** 系统返回新的 Access Token 和 Refresh Token

#### Scenario: Refresh Token 过期
- **WHEN** 用户携带过期的 Refresh Token
- **THEN** 系统返回 401 状态码和错误信息"登录已过期，请重新登录"

### Requirement: 退出登录

系统 SHALL 支持用户退出登录，清除当前会话。

#### Scenario: 成功退出
- **WHEN** 已登录用户请求退出登录
- **THEN** 系统返回 200 状态码，前端清除所有 Token 和认证状态

### Requirement: 路由保护中间件

系统 SHALL 提供 JWT 认证中间件，保护需要登录才能访问的路由。

#### Scenario: 携带有效 Token 访问受保护路由
- **WHEN** 用户携带有效 Token 请求受保护路由
- **THEN** 中间件验证通过，`req.user` 注入用户信息，请求继续

#### Scenario: 未携带 Token 访问受保护路由
- **WHEN** 用户未携带 Token 请求受保护路由
- **THEN** 中间件返回 401 状态码
