## Context

当前 NJU 树洞系统没有真正的用户认证。用户首次访问时，`getUserId()` 自动在 localStorage 生成 `nju_user_id`。LandingPage 通过 `nju_engaged` 标记控制展示。所有数据（帖子、评论、收藏）以纯对象形式存储在 `localStorage` 中，与用户身份无关。

需要引入完整的邮箱注册/登录系统，为后续功能提供身份基础：

- 区分"未登录游客"和"已登录注册用户"
- 用户数据可跨设备同步（依赖后端）
- 管理后台可追溯用户身份（合规需求）
- 收藏、点赞等数据与用户账号绑定而非设备绑定

此变更是后端首次实质性编码，也是前端从纯 `localStorage` 迈向 API 驱动架构的第一步。

## Goals / Non-Goals

**Goals:**
- 支持邮箱注册 + 密码登录，仅 Email 方式（不支持 Google/Apple/Passkey/短信）
- 完整的 JWT Token 管理（Access Token + Refresh Token）
- 前端登录/注册页面（独立页面，非弹窗）
- 登录态保持（刷新后自动恢复）
- 退出登录（前端清除 Token，后端可选黑名单）
- 后端认证 API 和中间件
- 与现有 LandingPage 无缝集成：未登录 → LandingPage → 登录/注册 → 主应用

**Non-Goals:**
- ❌ 不实现 OAuth 第三方登录
- ❌ 不实现邮箱验证（发送验证邮件）
- ❌ 不实现密码重置（"忘记密码"功能）
- ❌ 不实现用户资料编辑
- ❌ 不修改现有帖子/评论/收藏等业务数据层（保持 localStorage 不变）
- ❌ 不引入 React Router（沿用 activePage 模式）

## Decisions

### Decision 1: 独立页面 vs 弹窗

**结论：独立页面**

理由：
- 与 GitHub 风格一致，表单元素多，弹窗体验差（尤其移动端）
- 现有路由模式（`activePage`）已支持页面切换
- 独立页面可单独设计 URL 层级（后续迁移到 React Router 更简单）
- 注册流程需要多个步骤/字段，弹窗内容过长

### Decision 2: JWT Access Token + Refresh Token

**结论：双 Token 机制**

- **Access Token**: 短有效期（15 分钟），存储在 `localStorage`，每次 API 请求携带
- **Refresh Token**: 长有效期（7 天），存储在 `localStorage`，用于无感刷新 Access Token
- 退出登录时清除所有 Token
- 可选：后端维护 Refresh Token 白名单以支持服务端注销

**备选方案：**
- 仅 Access Token（长期）：安全性较差，Token 泄露后无法提前失效
- 仅 Session + Cookie：需要额外 CSRF 防护，前后端分离架构下更复杂

### Decision 3: 密码处理

**结论：bcryptjs**

- 使用 `bcryptjs`（纯 JS 实现，无 C++ 编译依赖）
- cost factor = 10（合理的安全/性能平衡）
- 密码最少 8 位，至少包含字母和数字
- 前端预验证格式，后端再次验证

### Decision 4: 前端认证状态管理

**结论：Zustand authStore**

- `authStore` 管理：`user`, `token`, `isAuthenticated`, `loading`, `error` 状态
- 应用启动时检查 localStorage 中是否有 Token → `GET /api/auth/me` 验证 Token 有效性
- Token 过期 → 尝试 Refresh Token → 失败 → 清除状态，回到 LandingPage
- 退出登录 → 清除 Token 和 Store 状态 → 回到 LandingPage

### Decision 5: 后端目录结构

**结论：遵循架构文档的分层模式**

```
backend/src/
├── index.js                 # 入口文件
├── config/
│   └── db.js                # MongoDB 连接
├── models/
│   └── User.js              # 用户模型
├── routes/
│   └── authRoutes.js        # 认证路由
├── controllers/
│   └── authController.js    # 认证控制器
├── services/
│   └── authService.js       # 认证业务逻辑
├── middlewares/
│   ├── auth.js              # JWT 验证中间件
│   └── errorHandler.js      # 全局错误处理
└── utils/
    ├── AppError.js           # 自定义错误类
    └── jwt.js               # JWT 工具函数
```

### Decision 6: 用户模型设计

**结论：最小化设计**

```javascript
{
  email: String,        // 唯一，邮箱
  password: String,     // bcrypt hash
  nickname: String,     // 显示昵称（可选，默认取邮箱前缀）
  role: String,         // 'user' | 'admin'
  createdAt: Date,
  updatedAt: Date
}
```

不设计过于复杂的用户资料（头像、简介等），保持最小可行。

### Decision 7: 与前端的集成策略

**结论：渐进式集成**

- 注册成功后：后端创建用户 → 返回 Token + 用户信息
- 登录成功后：后端验证密码 → 返回 Token + 用户信息
- 前端将 Token 存到 localStorage，authStore 更新状态
- App.jsx 判断逻辑：有有效 Token → 进主应用 → 无 → LandingPage
- 注册/登录页面替换现有 LandingPage 上的 "登录"/"注册" 按钮行为

**原有 `nju_engaged` 迁移：**
- 新用户注册后不再需要 `nju_engaged`
- 老用户（已有 `nju_user_id` 但未注册）：保持兼容，注册时可关联现有匿名数据
- 短期：`nju_engaged` 仍保留作为 "未注册用户已浏览过 LandingPage" 的标记

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| Token 存储在 localStorage 有 XSS 泄露风险 | 当前阶段可接受（项目未上生产环境）；后续可迁移到 HTTP-only Cookie |
| 部署时需要 MongoDB 实例 | 本地开发使用 local MongoDB；提供 `.env.example` 说明配置 |
| 注册流程增加用户使用门槛 | 保持注册表单最简（邮箱 + 密码 + 确认密码），不要求邮箱验证 |
| 后端首次编码可能发现架构问题 | 快速迭代，不追求完美；发现问题后更新架构文档 |
| 现有 localStorage 数据与后端数据不一致 | 保持 localStorage 作为当前优先数据源；后端作为写目标逐步迁移 |
