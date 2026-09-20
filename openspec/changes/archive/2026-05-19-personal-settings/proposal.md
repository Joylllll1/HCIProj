## Why

当前 SettingsPage 使用 localStorage 存储设置项，后端完全不参与。个人信息展示全为硬编码假数据，通知偏好开关无法真实持久化，无法修改密码。需要实现一套由后端支撑的真实个人设置系统。

## What Changes

- 个人信息（校园邮箱、注册时间、验证状态）改为从后端读取，只读展示
- 通知偏好（评论回复、点赞、系统公告、投诉处理结果）四个开关改为后端持久化
- 新增修改密码功能，通过邮箱验证码验证身份后修改
- 后端 User 模型新增 `notificationPreferences` 字段
- 后端新增 `PUT /api/auth/profile` 和 `POST /api/auth/change-password` 端点
- VerificationCode 模型新增 `change_password` 验证类型
- 前端新增 `/settings/password` 路由及其页面组件

## Capabilities

### New Capabilities
- `account-info`: 只读展示当前用户的校园邮箱、注册时间、验证状态
- `notification-preferences`: 四个通知开关（回复/点赞/系统公告/投诉结果）的后端持久化与前端交互
- `password-change`: 通过邮箱验证码修改密码的完整流程（前端+后端）

### Modified Capabilities
无 — 现有规格无需修改。

## 非目标

- 不涉及昵称、头像、个人简介等个人信息编辑（匿名社区无需）
- 不涉及隐私设置（@提及功能已移除，收藏夹默认不可见）
- 不涉及匿名相关设置
- 不涉及主题/外观等界面偏好
- 不涉及邮箱更换功能

## Impact

- **Backend**: User 模型新增字段，VerificationCode 类型扩展，两条新 API 路由
- **Frontend**: SettingsPage 重构，新增 PasswordChangePage 组件，更新路由
- **Dependencies**: 无新增第三方依赖
