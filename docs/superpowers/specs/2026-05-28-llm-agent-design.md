# LLM Assistant 模块 — 设计文档

日期: 2026-05-28
状态: 设计稿（待实现）

## 1. 概述

将现有 `chat-ai` 模块演进为具备工具调用能力的 `llm-assistant`。底层 LLM 继续使用 DeepSeek，整体保留现有 Node.js 聊天链路，不引入独立 Python Agent 服务，也不使用 OpenAI Agents SDK。

本次设计的核心目标：

1. 保留现有对话能力与 persona 配置
2. 支持 LLM 自行判断是否需要调用工具
3. 新增联网搜索、帖子搜索、帖子详情总结、热帖汇总能力
4. 通过 SSE 向前端流式返回 token 和工具状态

本方案本质上是 `Node.js 内实现 tool-calling loop`，而不是拆分为独立 Agent 平台。

## 2. 架构

```text
前端 (React AIPanel / 后续可改名 AgentPanel)
    ↓ POST /api/ai/chat (SSE 流式)
Node.js (Express)
    ├─ 认证 / 会话管理 / 消息存储
    ├─ tool-calling loop
    ├─ 站内数据查询
    ├─ 联网搜索适配层
    └─ LLM: DeepSeek (OpenAI 兼容接口)
```

### 职责划分

| 层 | 职责 | 不变/改动 |
|----|------|-----------|
| 前端 | 面板 UI、消息渲染、SSE 解析、工具状态展示 | 改：支持流式渲染和工具状态 |
| Node.js | 认证、会话/消息 CRUD、tool loop、搜索集成、LLM 调用 | 改：从单轮调用升级为多轮 tool-calling |
| Python | 无 | 删：不再引入独立 Agent 服务 |

## 3. 设计原则

### 3.1 为什么不拆 Python Agent 服务

当前需求虽然包含联网搜索与站内工具，但仍属于单助手、短链路、多数请求在一个 HTTP 生命周期内完成的场景。继续保留 Node 作为唯一运行时更合适：

- 认证、会话、消息存储已经在 Node
- 站内帖子查询能力本来就在 Node 内部
- 避免增加跨服务流式转发、取消传播、鉴权同步的复杂度
- 避免 OpenAI Agents SDK 与 DeepSeek 的兼容和 tracing 问题

### 3.2 为什么不只做程序预取

单纯的“规则判断后预取数据再回答”适合固定问题，但不能满足“由 LLM 自行判断是否需要实时搜索”的需求。为满足外网实时性和灵活提问，本方案采用 tool-calling，由模型按需调用：

- `web_search`
- `search_posts`
- `get_post`
- `get_hot_topics`

### 3.3 安全边界

本阶段仅开放只读工具，不开放任何自动写操作。

- 可以搜外网、搜帖子、读帖子、看热帖
- 不可以自动发帖、删草稿、提交活动申请
- 后续若引入写操作，必须增加前端确认和后端二次校验

## 4. Node.js 端总体设计

### 4.1 目录影响

不新增独立服务目录，主要在现有 Node 后端扩展：

```text
backend/src/
├── controllers/
│   └── aiController.js
├── services/
│   ├── aiService.js
│   ├── aiPromptBuilder.js
│   ├── aiPersonaService.js
│   ├── llm/
│   │   ├── client.js           # DeepSeek/OpenAI 兼容调用封装
│   │   ├── toolLoop.js         # tool-calling loop
│   │   └── sseEvents.js        # SSE 事件格式封装
│   └── tools/
│       ├── webSearch.js
│       ├── searchPosts.js
│       ├── getPost.js
│       └── getHotTopics.js
└── routes/
    └── aiRoutes.js
```

上面的 `llm/` 与 `tools/` 目录是建议结构，也可以折叠进现有 `services/`，但职责建议分离。

### 4.2 核心流程

```text
1. 前端发送消息到 POST /api/ai/chat
2. Node 校验用户身份并获取/创建会话
3. Node 保存用户消息
4. Node 组装 system prompt、persona、历史消息、tool 定义
5. Node 调用 DeepSeek
6. 若模型返回 tool call：
   - 执行本地工具
   - 将工具结果追加到消息历史
   - 再次调用 DeepSeek
7. 若模型返回最终文本：
   - 按 token 流式推送前端
   - 保存 assistant 消息
8. 更新会话更新时间并结束
```

### 4.3 Tool Loop 约束

为控制成本、延迟和不可预测性，需要在后端限制模型调用工具的行为：

- 单次请求最多执行 `3` 次工具调用
- `web_search` 最多执行 `1-2` 次
- 单个工具设置超时，例如 `5-8` 秒
- 任一工具失败后，返回结构化错误给模型，由模型决定是否降级回答
- 超过最大调用次数后，强制结束工具循环并要求模型基于现有信息回答

## 5. LLM 调用设计

### 5.1 模型配置

继续使用 DeepSeek OpenAI 兼容接口：

```env
LLM_API_URL=https://api.deepseek.com/v1/chat/completions
LLM_API_KEY=...
LLM_MODEL=deepseek-chat
```

### 5.2 请求格式

Node 侧继续调用 OpenAI 兼容 `chat completions`，但从单轮消息升级为带 tools 的多轮消息。

伪代码：

```js
const response = await fetch(LLM_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${LLM_API_KEY}`,
  },
  body: JSON.stringify({
    model: LLM_MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.7,
    stream: true,
  }),
});
```

说明：

- `tools` 描述可调用函数
- `tool_choice: 'auto'` 允许模型自行判断是否调用工具
- `stream: true` 用于最终答案流式输出
- 是否在“工具推理轮次”也开启流式，取决于 DeepSeek 对工具调用流格式的兼容性；如兼容性不稳定，可采用“工具轮非流式，最终答案流式”的折中策略

### 5.3 System Prompt 要点

System prompt 需要明确工具使用规则，避免模型滥用搜索：

- 你是 NJU 树洞助手，默认使用简体中文回答
- 明确注入当前日期，例如“今天是 2026-05-28”
- 当用户问题涉及实时信息、最新动态、外部新闻、校外政策变化时，可调用 `web_search`
- 当用户问题涉及站内帖子、讨论内容、热议话题时，可调用站内工具
- 如果无需工具即可回答，不要调用工具
- 工具结果不足时，应明确说明不确定性，不要编造事实
- 联网搜索结果优先基于时间较新、来源可靠的内容进行总结
- 回答外网实时信息时，尽量在回答中引用来源标题或链接
- 如果联网搜索未返回可靠结果，不得编造具体日期、节日、新闻事件或“今天”的事实性内容

`persona` 仍通过现有 `buildSystemPrompt` 机制注入，但应与工具规则拼接成统一 system prompt。

## 6. 工具设计

### 6.1 工具列表

| 工具 | 类型 | 用途 |
|------|------|------|
| `web_search(query)` | 外网只读 | 搜索实时外部信息 |
| `search_posts(query)` | 站内只读 | 搜索站内帖子 |
| `get_post(postId)` | 站内只读 | 获取帖子正文和评论 |
| `get_hot_topics()` | 站内只读 | 获取当前热门帖子/话题 |

### 6.2 `web_search`

用途：

- 新闻、实时事件、校外政策、天气、比赛结果、时间敏感问题

约束：

- 对普通事实问题可由模型自行判断
- 对强实时问题应由后端规则优先触发，而不是完全依赖模型自由判断
- 返回结构化摘要，不返回整页网页原文
- 单次结果限制在 `3-5` 条高质量结果
- 每条结果包含：`title`、`snippet`、`url`、`source`、`publishedAt`
- 若无可靠结果，返回明确空结果

强实时问题示例：

- “今天是什么日子”
- “今天南京天气怎么样”
- “最近有什么新闻”
- “刚刚发生了什么”
- “最新政策是什么”

强实时触发策略：

- 命中“今天 / 今日 / 最新 / 最近 / 刚刚 / 新闻 / 热点 / 天气 / 节日 / 纪念日 / 比赛结果 / 政策变化”等关键词时，后端优先触发 `web_search`
- 若搜索无结果或结果不可靠，回答必须明确“暂时未查到可靠的最新信息”，不得伪造具体事实

返回示例：

```json
{
  "query": "南京大学 最新 通知",
  "results": [
    {
      "title": "示例标题",
      "snippet": "示例摘要",
      "url": "https://example.com",
      "source": "example.com",
      "publishedAt": "2026-05-28"
    }
  ]
}
```

### 6.3 `search_posts`

用途：

- 用户问“有没有人讨论过 xx”
- 用户问“树洞里怎么说 xx”

返回建议：

- 最多返回 `5` 条帖子
- 每条包含：`postId`、`contentPreview`、`commentCount`、`createdAt`、`score` 或排序依据

### 6.4 `get_post`

用途：

- 用户在帖子详情页问“帮我总结一下”
- 用户问某个具体帖子的主要争议点

返回建议：

- 帖子正文
- 适量评论
- 评论总数
- 必要元信息

为控制 token，评论应限制数量并可优先返回高赞/较新评论。

### 6.5 `get_hot_topics`

用途：

- “最近大家都在讨论什么”
- “最近树洞热点有哪些”

返回建议：

- 热帖列表
- 简短摘要或 preview
- 热度指标
- 时间信息

## 7. Tool-Calling Loop 设计

### 7.1 后端伪代码

```js
async function runAssistantLoop({ messages, tools, signal, emit }) {
  let rounds = 0;
  let toolCalls = 0;

  while (rounds < 6) {
    const llmResponse = await callLLM({
      messages,
      tools,
      toolChoice: 'auto',
      signal,
      stream: false,
    });

    const assistantMessage = llmResponse.message;
    const requestedTools = extractToolCalls(assistantMessage);

    if (!requestedTools.length) {
      const streamed = await callLLM({
        messages: [...messages, assistantMessage],
        tools,
        toolChoice: 'none',
        signal,
        stream: true,
      });

      return streamFinalAnswer(streamed, emit);
    }

    messages.push(assistantMessage);

    for (const toolCall of requestedTools) {
      toolCalls += 1;
      if (toolCalls > 3) {
        messages.push(buildToolLimitMessage(toolCall.id));
        break;
      }

      emit.toolCall(toolCall.name, toolCall.arguments);
      const result = await executeTool(toolCall, signal);
      emit.toolResult(toolCall.name);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    rounds += 1;
  }

  throw new Error('TOOL_LOOP_LIMIT_EXCEEDED');
}
```

### 7.2 是否需要两次 LLM 请求

推荐采用“两阶段调用”：

1. 工具决策阶段：非流式，便于稳定解析 tool calls
2. 最终回答阶段：流式，便于前端逐字展示

这样做的原因：

- 工具调用协议解析更简单
- 与不同 OpenAI 兼容提供商的流式格式兼容更稳
- 前端仍然能得到良好的流式体验

如果后续验证 DeepSeek 的工具调用流完全稳定，再考虑合并为单次全流式 loop。

## 8. SSE 协议

### 8.1 后端到前端事件格式

统一使用 `text/event-stream`，每条事件仍通过 `data: {json}\n\n` 发送。

事件类型建议如下：

```json
{ "type": "start", "sessionId": "..." }
{ "type": "tool_call", "tool": "web_search", "args": { "query": "..." } }
{ "type": "tool_result", "tool": "web_search" }
{ "type": "token", "content": "..." }
{ "type": "done" }
{ "type": "error", "message": "..." }
```

### 8.2 前端展示建议

- 收到 `tool_call` 时显示“正在联网搜索...”或“正在检索帖子...”
- 收到 `token` 时增量追加当前 assistant 临时消息
- 收到 `done` 时将临时消息固化到 store
- 收到 `error` 时结束本轮并显示错误提示

### 8.3 联网搜索可观测性

当前仅靠最终自然语言回复，用户很难判断是否真的触发了联网搜索。因此前端需要提供最低限度的搜索可观测性。

要求：

- 当触发 `web_search` 时，前端明确显示“正在联网搜索...”
- 当 `web_search` 完成后，前端显示短暂状态反馈：
  - “已完成联网搜索”
  - 或“未获取到可靠的最新结果”
- 不向普通用户暴露底层技术错误，例如超时、抓取失败、接口异常、解析失败
- 可选提供开发/调试模式，显示：
  - 本轮是否实际调用了 `web_search`
  - 搜索结果条数
  - 是否因无结果而降级

该可观测性要求的目标不是暴露底层实现，而是让测试者和用户能区分：

- 根本没有联网搜索
- 已经触发联网搜索，但没有拿到可靠结果

## 9. Node.js 端改动

### 9.1 `aiService.js`

当前：

- 单轮调用 DeepSeek
- 等待完整响应
- 保存 assistant 消息

改为：

- 保存用户消息
- 构建消息历史
- 构建 tools 列表
- 执行 tool-calling loop
- 以 SSE 向 controller 持续输出工具状态和 token
- 完成后保存 assistant 消息

说明：

现有 [backend/src/services/aiService.js](/Users/wjl/Projects/SE2proj/backend/src/services/aiService.js:1) 需要从“返回完整 JSON”改为“支持流式写出 + 完成后落库”的结构。

### 9.2 `aiController.js`

当前 [backend/src/controllers/aiController.js](/Users/wjl/Projects/SE2proj/backend/src/controllers/aiController.js:25) 返回的是普通 JSON。

改为：

- 设置 `Content-Type: text/event-stream`
- 设置 `Cache-Control: no-cache`
- 设置 `Connection: keep-alive`
- 将 request abort signal 传给 tool loop
- 在客户端断开时中止 LLM 请求和工具执行

### 9.3 站内工具实现

站内工具不需要新增“内部 HTTP API”。因为工具和数据层都在同一个 Node 服务内，直接调用已有 service/model 即可。

优先方案：

- `search_posts` 直接调用帖子查询 service
- `get_post` 直接调用帖子详情和评论查询 service
- `get_hot_topics` 直接调用热帖聚合逻辑

这样比“Node 再请求 Node 自己的内部接口”更简单，也更易测试。

## 10. 前端改动

### 10.1 `aiService.js`

当前 [frontend/src/services/aiService.js](/Users/wjl/Projects/SE2proj/frontend/src/services/aiService.js:1) 走普通 JSON 请求。

改为：

- `fetch('/api/ai/chat')`
- 使用 `response.body.getReader()` 读取流
- 解析 SSE 事件
- 将 `token` 和 `tool_call` 通过回调交给 store

注意：

- 需要处理 chunk 粘包和半包，不能直接对每个 chunk 简单 `split('\n')`
- 需要使用缓冲区累计到完整 `\n\n` 事件边界再解析

### 10.2 `aiStore.js`

当前 [frontend/src/store/aiStore.js](/Users/wjl/Projects/SE2proj/frontend/src/store/aiStore.js:191) 以“请求完成后一次性拿到 assistantMessage”为主。

改为：

- 先插入临时 user message
- 再插入临时 assistant message
- 收到 `token` 时不断追加 assistant content
- 收到 `tool_call` 时更新状态栏
- 收到 `done` 后与后端最终消息对齐

### 10.3 AIPanel

当前 [frontend/src/components/features/AIPanel.jsx](/Users/wjl/Projects/SE2proj/frontend/src/components/features/AIPanel.jsx:418) 主要处理非流式回复。

改为：

- 展示“正在搜索”“正在读取帖子”“正在生成回答”等中间状态
- 支持用户停止生成
- 可选显示“已参考外网结果/已参考站内帖子”

## 11. 配置

```env
LLM_API_URL=https://api.deepseek.com/v1/chat/completions
LLM_API_KEY=...
LLM_MODEL=deepseek-chat

SEARCH_API_URL=...
SEARCH_API_KEY=...

AI_TOOL_MAX_CALLS=3
AI_WEB_SEARCH_MAX_CALLS=2
AI_TOOL_TIMEOUT_MS=8000
AI_STREAM_IDLE_TIMEOUT_MS=30000
```

## 12. 边界情况

- **LLM 不调用工具**：直接进入最终答案生成
- **搜索无结果**：工具返回空结果，模型明确说明未找到可靠信息
- **搜索超时**：工具返回超时错误，模型降级回答
- **用户取消**：前端 `AbortController` 断开，Node 中止 LLM 和工具执行
- **流式中断**：前端保留已生成内容并提示本轮中断
- **工具调用过多**：后端强制截断，要求模型基于现有信息作答
- **外网结果噪声过大**：提示词要求模型优先使用可靠来源并说明不确定性
- **强实时问题未触发搜索**：视为设计缺陷，应通过后端规则补强，而不是继续依赖模型自由判断
- **搜索失败但回答伪造了“今天”的事实**：视为高优先级错误，必须修复

## 13. 联网搜索验收

### 13.1 可测性要求

以下两项必须可验证：

- 本轮回复是否实际触发了 `web_search`
- 触发后是否获取到了至少一条可靠结果

### 13.2 基础验收问题

至少包含以下强实时测试：

- “今天是什么日子”
- “今天南京天气怎么样”
- “最近有什么 AI 新闻”

验收标准：

- 至少能从前端状态判断是否触发了联网搜索
- 未查到可靠结果时，回答可以保守，但不得伪造具体日期、节日或新闻事实
- 若命中强实时关键词却未触发搜索，应视为不通过

## 14. 版本边界

### V1

本设计覆盖以下能力：

- 普通聊天
- LLM 自主调用站内只读工具
- LLM 自主调用 `web_search`
- SSE 流式回答
- persona 保留

### 暂不纳入 V1

- 独立 Python Agent 服务
- OpenAI Agents SDK
- 自动发帖、自动删草稿、自动提交活动申请
- 多 agent 协作
- 长时任务或后台异步 Agent

### V1 之后可扩展

- 写操作工具，但必须前端确认 + 后端二次校验
- 更强的搜索结果重排
- 站内上下文感知，例如当前帖子页自动注入 `postId`
- 更丰富的工具状态 UI

## 15. 结论

本项目第一阶段采用 `Node.js 单体 + DeepSeek + tool-calling + SSE` 方案。

该方案兼顾了以下目标：

- 满足“由 LLM 自行判断是否需要联网搜索”的核心需求
- 复用现有会话、认证、存储和 persona 体系
- 避免过早引入 Python Agent 服务与额外部署复杂度
- 为后续写操作确认流和更复杂工具编排保留升级空间
