## 1. 前端设置入口

- [x] 1.1 在 `AIPanel` 顶部增加 persona 设置入口与打开/关闭交互
- [x] 1.2 实现 persona 设置页表单，包含角色、自定义语气、直接程度、回复长度和额外要求字段，并提供语气快捷填充选项
- [x] 1.3 增加“设为默认”和“仅本会话生效”两种保存方式的前端交互
- [x] 1.4 扩展 `aiStore` 管理 persona 设置的读取、编辑、保存和加载状态

## 2. 后端模型与接口

- [x] 2.1 新增用户级默认 persona 配置模型 `AIProfile` 或等价存储结构
- [x] 2.2 扩展 `AISession` 模型，增加可选 `aiPersona` 会话覆盖配置字段
- [x] 2.3 新增获取和更新默认 persona 配置的 API 接口
- [x] 2.4 新增获取和更新会话 persona 覆盖配置的 API 接口
- [x] 2.5 为 persona 配置字段增加枚举校验、自由文本长度校验和默认值兜底

## 3. Prompt 拼装与 AI 集成

- [x] 3.1 新增独立 `aiPromptBuilder` 模块，封装系统基础 prompt、边界规则和 persona 翻译逻辑
- [x] 3.2 在 `sendMessage` 中接入 persona 生效配置解析与最终 system prompt 拼装
- [x] 3.3 在 `regenerateMessage` 中接入相同的 persona 生效配置解析与 prompt 拼装
- [x] 3.4 扩展 session 读取接口返回当前会话 persona 配置，供前端回显

## 4. 联调与验收

- [ ] 4.1 联调默认 persona 配置、会话 persona 覆盖和 AI 回复风格切换
- [ ] 4.2 验证 persona 配置在刷新页面、切换会话和重新生成回复后的持久化行为
- [x] 4.3 验证非法 persona 输入、超长文本和空值兜底行为
- [x] 4.4 更新 AI Chat 相关文档或示例，说明 persona 配置的使用方式和边界
