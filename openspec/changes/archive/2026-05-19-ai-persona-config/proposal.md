## Why

当前 AI Chat 已具备基础对话能力，但系统 prompt 固定且不可配置，导致回复风格单一，难以满足不同用户对角色、人设和语气的偏好。现在引入结构化 persona 配置，可以在不破坏系统边界的前提下提升个性化体验，并为后续 AI 设置页和更丰富的会话风格切换打基础。

## What Changes

- 为 AI Chat 增加结构化 persona 配置，支持用户定义角色、自定义语气、直接程度、回复长度和额外要求。
- 新增用户级默认 AI persona 配置，并允许会话级 persona 覆盖默认配置。
- 新增 prompt builder，将系统基础 prompt、产品安全边界、persona 配置和用户补充统一拼装为最终 system prompt。
- 在 AIPanel 中增加 persona 设置入口，并以全屏覆盖式设置页承载 persona 配置，而不是开放完整 prompt 编辑。
- 新增 AI persona 相关读写接口，供前端获取和更新默认配置及会话配置。

## 非目标

- 不开放完整 system prompt 编辑能力。
- 不在本次引入流式输出、快捷提示词模板市场或人格分享功能。
- 不在本次实现基于 persona 的推荐算法或自动生成人设。

## Capabilities

### New Capabilities
- `ai-persona-settings`: 管理用户默认 persona 配置与会话级 persona 覆盖配置。
- `ai-prompt-composition`: 基于系统底座与 persona 配置安全拼装最终 AI system prompt。

### Modified Capabilities
- `basic-chat`: AI 对话在生成回复时应使用当前生效的 persona 配置影响语气与风格。
- `session-management`: AI 会话支持查看和更新该会话的 persona 覆盖配置。

## Impact

- 后端：新增 `AIProfile` 模型或等价存储结构，扩展 `AISession` 模型，新增 persona 配置接口与 prompt builder。
- 前端：扩展 `AIPanel`、`aiStore`、`aiService`，增加 persona 设置 UI 与状态同步。
- API：新增 AI persona 读取/更新接口，并扩展 AI session 返回数据结构。
- 数据：需要为既有用户与既有会话提供默认 persona 配置兜底逻辑。
