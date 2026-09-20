## Context

当前 AI Chat 已支持多轮对话、会话管理和基础 system prompt，但 prompt 文本写死在后端服务中，无法根据用户偏好切换角色、语气和回复风格。用户已经明确希望 AI 具备更强的个性化体验，例如“知心学姐”“毒舌损友”等角色感，同时又不希望开放完整 prompt 编辑导致边界失控。

这一变更横跨前端设置入口、前端状态管理、后端数据模型、AI 请求拼装逻辑和会话接口返回结构，属于典型的跨模块扩展。设计目标是在维持系统安全边界和产品一致性的前提下，引入“系统底座 + 结构化 persona 配置 + 用户补充说明”的组合方式。

## Goals / Non-Goals

**Goals:**
- 提供结构化 persona 配置，而不是开放完整 prompt 编辑。
- 支持用户级默认 persona 配置，减少每次新建会话都重复配置的成本。
- 支持会话级 persona 覆盖，使单个会话可以临时采用不同风格。
- 将 persona 配置编译为稳定的 system prompt，避免用户输入直接破坏系统边界。
- 为后续 AI 设置页、预设模板和 persona 扩展保留兼容空间。

**Non-Goals:**
- 不实现 prompt marketplace、persona 分享或社区模板。
- 不在本次引入流式输出或更复杂的 agent 编排。
- 不允许用户直接编辑完整 system prompt 或修改安全边界规则。
- 不在本次实现基于历史对话自动推荐 persona。

## Decisions

### 1. 采用“用户默认配置 + 会话覆盖配置”的双层结构

**Decision**
- 新增用户级默认配置 `AIProfile`。
- 在 `AISession` 中增加可选字段 `aiPersona` 作为会话覆盖配置。
- AI 请求时的生效配置优先级为：`session.aiPersona` > `AIProfile.persona` > 系统默认值。
- 该优先级按字段级别生效，而不是按整个对象整体替换。

**Why**
- 只存 `AISession.aiPersona` 会导致用户每次开新会话都要重新设置，个性化体验割裂。
- 只存用户级配置又无法支持“这次聊天想切成另一个风格”的场景。
- 双层结构兼顾复用性和灵活性，符合当前产品交互预期。

**Alternatives considered**
- 仅在 `AISession` 中存 persona：实现简单，但重复配置成本高。
- 仅在 `User` 中挂默认配置：灵活性不够，无法支持会话级切换。

### 2. persona 配置采用结构化字段，不开放完整 prompt 编辑

**Decision**
- persona 配置字段定义为：
  - `role`
  - `tone`
  - `directness`
  - `verbosity`
  - `customInstruction`
- 上述字段在用户输入层面全部可选，不要求用户填写完整 persona 对象。
- `directness`、`verbosity` 使用枚举值。
- `role`、`tone`、`customInstruction` 允许短文本输入并限制长度。
- 系统内置一套默认 persona 常量，用于补齐用户未提供的字段。

**Why**
- 结构化字段可以被前端 UI 稳定承载，也便于后端校验和兜底。
- 并非所有用户都愿意填写完整 persona，字段可缺省能降低设置门槛。
- 语气是用户最希望自由发挥的维度之一，使用自由文本比“预设 + 补充”的双字段结构更符合用户心智。
- 完整 prompt 编辑会让用户轻易覆盖安全边界、引入冲突指令，导致模型行为不稳定。
- 将语气保留为自定义短文本，同时把直接程度和回复长度保留为结构化选项，可以在个性化和可控性之间取得平衡。

**Alternatives considered**
- 完全自由文本 prompt：自由度最高，但难以控制质量和边界。
- 只有枚举，无自由文本：稳定，但个性化体验不足。

### 3. 新增 prompt builder，将 persona 配置编译为最终 system prompt

**Decision**
- 新建独立的 prompt builder 模块，例如 `aiPromptBuilder.js`。
- 最终 system prompt 由以下部分组成：
  - 系统基础 prompt（锁定）
  - 产品安全边界（锁定）
  - persona 配置翻译结果
  - 用户补充说明
  - 输出风格要求
- prompt builder 在拼装前先完成 persona 字段级 merge，并将缺失字段补齐为系统默认值。
- `tone` 自由文本在进入 prompt 前需要做去空白、长度裁剪和基础内容校验。

**Why**
- 将拼装逻辑从 `aiService.js` 中抽离，可以避免后续继续散写字符串。
- 结构化字段中的枚举值仍需翻译成自然语言指令，而自由文本 `tone` 可直接作为“语气描述”插槽参与拼装。
- 结构化 builder 更容易单测，也更容易后续扩展更多 persona 维度。

**Alternatives considered**
- 在 `aiService.js` 内直接拼字符串：短期可行，但长期难维护。
- 把 persona 配置作为独立 `system` message 多条传递：也可行，但当前实现单一 system prompt 更简单。

### 4. AIPanel 通过齿轮入口进入全屏覆盖式 persona 设置页

**Decision**
- 在 AIPanel 顶部增加 persona 设置入口（齿轮图标）。
- 打开后切换到 AIPanel 内部的全屏覆盖式设置页，提供：
  - 角色输入
  - 自定义语气输入
  - 直接程度选择
  - 回复长度选择
  - 额外要求输入
  - “设为默认”或“仅本会话生效”的作用域选择
  - 返回、恢复默认、保存并应用等固定操作区
- 前端可以提供若干语气预设标签作为快捷填充，但这些标签不构成独立持久化字段。

**Why**
- persona 设置与当前会话强相关，放在 AIPanel 内最符合用户心智。
- persona 配置已不再是简单参数调整，使用全屏覆盖式页面更适合承载较多字段、说明文字和作用域选择。
- 全屏覆盖式页面仍然属于 AIPanel 的内部状态，不需要额外引入新的顶层路由。

**Alternatives considered**
- 只在个人设置页提供配置：入口太深，不利于会话中即时切换。
- 侧边轻量面板：空间不足，难以同时容纳字段说明、保存作用域和未保存修改提示。
- 每次新建会话弹出 persona 配置：打断主流程，摩擦太大。

## Risks / Trade-offs

- [用户自由文本要求越界或冲突] → 对 `tone` 和 `customInstruction` 做长度限制与基础内容校验，且始终放在系统边界之后。
- [默认 persona 与会话覆盖配置合并逻辑复杂] → 明确字段级覆盖规则，并提供默认兜底函数统一处理。
- [接口返回结构变更影响现有前端] → 新字段采用向后兼容方式追加，现有消费路径不依赖时不应报错。
- [过度个性化导致产品人格分裂] → 保留系统底座与安全边界，避免用户完全掌控 AI 核心行为。
- [后续扩展字段过多导致 UI 复杂] → 先收敛在 6 个核心字段，后续新增字段通过 schema 和 builder 兼容扩展。
