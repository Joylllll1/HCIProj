## ADDED Requirements

### Requirement: SPA 页面切换同步 URL

系统 MUST 在页面切换时同步更新浏览器 URL，使前进/后退按钮能在应用页面间正常导航。

#### Scenario: 导航到登录页更新 URL

- **WHEN** 用户从首页点击"登录"
- **THEN** URL 更新为 `/login`，且页面不刷新

#### Scenario: 导航到注册页更新 URL

- **WHEN** 用户从登录页点击"注册"
- **THEN** URL 更新为 `/register`，且页面不刷新

#### Scenario: 导航到忘记密码页更新 URL

- **WHEN** 用户从登录页点击"忘记密码"
- **THEN** URL 更新为 `/forgot-password`，且页面不刷新

### Requirement: 浏览器后退导航

系统 MUST 监听 `popstate` 事件，在浏览器后退/前进时恢复到对应的页面状态。

#### Scenario: 后退到前一个页面

- **WHEN** 用户在登录页按下浏览器后退按钮
- **THEN** 页面回到前一个页面（首页/注册页）

#### Scenario: 前进到后一个页面

- **WHEN** 用户从首页导航到登录页，再按下浏览器前进按钮
- **THEN** 页面回到登录页

#### Scenario: 回退到未映射 URL

- **WHEN** 用户从其他页面后退到未知 URL 路径
- **THEN** 默认回到首页

### Requirement: 首次加载从 URL 恢复页面

系统 MUST 在首次加载时解析 URL，直接渲染对应的认证页面。

#### Scenario: 直接访问登录页链接

- **WHEN** 用户直接访问 `/login`
- **THEN** 渲染登录页面

#### Scenario: 直接访问注册页链接

- **WHEN** 用户直接访问 `/register`
- **THEN** 渲染注册页面

#### Scenario: 直接访问首页

- **WHEN** 用户直接访问 `/` 或其他未映射路径
- **THEN** 渲染默认首页或认证页面（取决于登录状态）

### Requirement: detail 页面降级处理

detail 页面使用 `selectedPost` 状态管理，URL 映射暂不实现。

#### Scenario: 从 detail 后退

- **WHEN** 用户在 detail 页面按下后退
- **THEN** URL 恢复为上一个页面对应的路径

#### Scenario: 直接访问 detail 页

- **WHEN** 用户直接刷新 detail 页面（当前 URL 不包含 postId）
- **THEN** 弹回首页
