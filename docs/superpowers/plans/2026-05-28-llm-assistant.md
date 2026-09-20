# LLM Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing chat-ai module into an LLM Assistant with tool-calling (web search, post search, post summary, hot topics) and SSE streaming.

**Architecture:** Keep everything in Node.js. Add a tool-calling loop around DeepSeek's OpenAI-compatible API. Two-phase approach: non-streaming for tool decisions, streaming for final answer. Tools call existing service/models directly (same Node process). SSE from backend to frontend for streaming tokens and tool status.

**Tech Stack:** Node.js (Express + Mongoose), DeepSeek API (OpenAI compat), SSE

---

### Task 1: LLM Client (`backend/src/services/llm/client.js`)

Encapsulates DeepSeek API calls with streaming/non-streaming support.

**Files:**
- Create: `backend/src/services/llm/client.js`

- [ ] **Step 1: Create the file**

```js
import AppError from '../../utils/AppError.js';

const LLM_API_URL = process.env.LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

export async function callLLM({ messages, tools = null, toolChoice = 'auto', stream = false, signal = null }) {
  if (!LLM_API_KEY) {
    throw new AppError('AI 服务未配置', 500, 'AI_NOT_CONFIGURED');
  }

  const body = { model: LLM_MODEL, messages, temperature: 0.7, max_tokens: 4000, stream };
  if (tools) { body.tools = tools; body.tool_choice = toolChoice; }

  const response = await fetch(LLM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new AppError(errBody.error?.message || 'LLM API 错误', 502, 'LLM_API_ERROR');
  }

  if (stream) return { stream: response.body };
  const data = await response.json();
  return { data };
}

export function parseStreamChunk(chunk) {
  return chunk.split('\n').filter(l => l.startsWith('data: ')).map(l => {
    const payload = l.slice(6).trim();
    if (payload === '[DONE]') return null;
    try { return JSON.parse(payload); } catch { return null; }
  }).filter(Boolean);
}

export function extractToolCalls(choice) {
  return choice.message?.tool_calls || [];
}
export function extractContent(choice) {
  return choice.message?.content || '';
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/llm/client.js
git commit -m "feat(ai): add LLM client with streaming and tool-calling"
```

---

### Task 2: SSE Events Helper

**Files:**
- Create: `backend/src/services/llm/sseEvents.js`

- [ ] **Step 1: Create the file**

```js
export function sseStart(sessionId) {
  return `data: ${JSON.stringify({ type: 'start', sessionId })}\n\n`;
}
export function sseToolCall(tool, args) {
  return `data: ${JSON.stringify({ type: 'tool_call', tool, args })}\n\n`;
}
export function sseToolResult(tool) {
  return `data: ${JSON.stringify({ type: 'tool_result', tool })}\n\n`;
}
export function sseToken(content) {
  return `data: ${JSON.stringify({ type: 'token', content })}\n\n`;
}
export function sseDone() {
  return `data: ${JSON.stringify({ type: 'done' })}\n\n`;
}
export function sseError(message) {
  return `data: ${JSON.stringify({ type: 'error', message })}\n\n`;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/llm/sseEvents.js
git commit -m "feat(ai): add SSE event format helpers"
```

---

### Task 3: Tool Definitions and Implementations

Create all four tools. Each exports a `schema` object and a `handler(args, signal)` function.

**Files:**
- Create: `backend/src/services/tools/webSearch.js`
- Create: `backend/src/services/tools/searchPosts.js`
- Create: `backend/src/services/tools/getPost.js`
- Create: `backend/src/services/tools/getHotTopics.js`
- Create: `backend/src/services/tools/index.js`

- [ ] **Step 1: Create tools/webSearch.js**

```js
const SEARCH_API_URL = process.env.SEARCH_API_URL;
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;

export const schema = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '搜索实时外部信息（新闻、实时动态、外部政策、天气等知识库之外的信息）',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜索关键词' } },
      required: ['query'],
    },
  },
};

export async function handler({ query }, signal) {
  if (!SEARCH_API_URL || !SEARCH_API_KEY) return { results: [], note: '搜索服务未配置' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const combined = signal ? AbortSignal.any?.([signal, controller.signal]) : controller.signal;
    const res = await fetch(SEARCH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SEARCH_API_KEY}` },
      signal: combined || controller.signal,
      body: JSON.stringify({ query, max_results: 5 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { results: (data.results || []).slice(0, 5) };
  } catch (err) {
    return { results: [], error: err.name === 'AbortError' ? '搜索超时' : err.message };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Create tools/searchPosts.js**

```js
import Post from '../../models/Post.js';

export const schema = {
  type: 'function',
  function: {
    name: 'search_posts',
    description: '搜索站内帖子。用户问站内有没有人讨论某个话题时使用。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜索关键词' } },
      required: ['query'],
    },
  },
};

export async function handler({ query }) {
  const posts = await Post.find(
    { isDeleted: false, $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(5).select('title content createdAt tags').lean();

  return {
    results: posts.map(p => ({
      postId: p._id.toString(),
      title: p.title || '',
      contentPreview: (p.content || '').slice(0, 100),
      createdAt: p.createdAt,
      tags: p.tags || [],
    })),
  };
}
```

- [ ] **Step 3: Create tools/getPost.js**

```js
import Post from '../../models/Post.js';
import Comment from '../../models/Comment.js';

export const schema = {
  type: 'function',
  function: {
    name: 'get_post',
    description: '获取指定帖子的详细内容和评论。用户要求总结某个帖子、分析评论区时使用。',
    parameters: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: '帖子 ID' },
        commentLimit: { type: 'number', description: '最多返回多少条评论，默认 20' },
      },
      required: ['postId'],
    },
  },
};

export async function handler({ postId, commentLimit = 20 }) {
  const post = await Post.findOne({ _id: postId, isDeleted: false })
    .select('title content createdAt tags likes').lean();
  if (!post) return { error: '帖子不存在' };

  const comments = await Comment.find({ post: postId, isDeleted: false })
    .sort({ createdAt: -1 }).limit(Math.min(commentLimit, 50))
    .select('content createdAt').lean();

  return {
    post: {
      postId: post._id.toString(), title: post.title || '', content: post.content || '',
      createdAt: post.createdAt, tags: post.tags || [], likes: post.likes || 0,
    },
    comments: comments.reverse().map(c => ({ content: c.content, createdAt: c.createdAt })),
    totalComments: comments.length,
  };
}
```

- [ ] **Step 4: Create tools/getHotTopics.js**

```js
import Post from '../../models/Post.js';

export const schema = {
  type: 'function',
  function: {
    name: 'get_hot_topics',
    description: '获取当前站内热门帖子。用户问"最近大家在讨论什么""树洞热点"时使用。',
    parameters: { type: 'object', properties: {} },
  },
};

export async function handler() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let posts = await Post.find({ isDeleted: false, createdAt: { $gte: oneDayAgo } })
    .sort({ likes: -1, comments: -1 }).limit(10)
    .select('title content createdAt likes tags').lean();

  if (posts.length < 5) {
    posts = await Post.find({ isDeleted: false })
      .sort({ createdAt: -1 }).limit(10)
      .select('title content createdAt likes tags').lean();
  }

  return {
    results: posts.map(p => ({
      postId: p._id.toString(), title: p.title || '',
      contentPreview: (p.content || '').slice(0, 100),
      likes: p.likes || 0, createdAt: p.createdAt, tags: p.tags || [],
    })),
  };
}
```

- [ ] **Step 5: Create tools/index.js (registry)**

```js
import { schema as webSearchSchema, handler as webSearchHandler } from './webSearch.js';
import { schema as searchPostsSchema, handler as searchPostsHandler } from './searchPosts.js';
import { schema as getPostSchema, handler as getPostHandler } from './getPost.js';
import { schema as getHotTopicsSchema, handler as getHotTopicsHandler } from './getHotTopics.js';

export const toolSchemas = [webSearchSchema, searchPostsSchema, getPostSchema, getHotTopicsSchema];

const handlerMap = {
  web_search: webSearchHandler, search_posts: searchPostsHandler,
  get_post: getPostHandler, get_hot_topics: getHotTopicsHandler,
};

export async function executeTool(name, args, signal) {
  const fn = handlerMap[name];
  if (!fn) return { error: `未知工具: ${name}` };
  return fn(args, signal);
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/tools/
git commit -m "feat(ai): add tool implementations (web_search, search_posts, get_post, get_hot_topics)"
```

---

### Task 4: Tool-Calling Loop

The core loop: call LLM → parse tool calls → execute → repeat until final answer.

**Files:**
- Create: `backend/src/services/llm/toolLoop.js`

- [ ] **Step 1: Create the file**

```js
import { callLLM, extractToolCalls, extractContent, parseStreamChunk } from './client.js';
import { toolSchemas, executeTool } from '../tools/index.js';
import { sseToolCall, sseToolResult, sseToken, sseDone } from './sseEvents.js';

const MAX_TOOL_CALLS = parseInt(process.env.AI_TOOL_MAX_CALLS || '3');
const MAX_LOOP_ROUNDS = 6;

export async function runToolLoop({ messages, signal, writeEvent }) {
  let toolCallCount = 0;
  let rounds = 0;
  const workingMessages = [...messages];

  while (rounds < MAX_LOOP_ROUNDS) {
    const result = await callLLM({ messages: workingMessages, tools: toolSchemas, toolChoice: 'auto', stream: false, signal });
    const choice = result.data.choices[0];
    const toolCalls = extractToolCalls(choice);
    const content = extractContent(choice);

    if (!toolCalls.length) {
      // Phase 2: stream final answer
      const streamResult = await callLLM({
        messages: [...workingMessages, { role: 'assistant', content }],
        tools: toolSchemas, toolChoice: 'none', stream: true, signal,
      });
      const reader = streamResult.stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = content || '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const ev of parseStreamChunk(decoder.decode(value, { stream: true }))) {
          const delta = ev.choices?.[0]?.delta?.content;
          if (delta) { fullContent += delta; writeEvent(sseToken(delta)); }
        }
      }
      writeEvent(sseDone());
      return { content: fullContent, toolCallCount };
    }

    // Handle tool calls
    workingMessages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });

    for (const tc of toolCalls) {
      toolCallCount += 1;
      if (toolCallCount > MAX_TOOL_CALLS) {
        workingMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: '工具调用次数已达上限' }) });
        break;
      }

      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* use empty */ }
      writeEvent(sseToolCall(tc.function.name, args));

      const toolResult = await executeTool(tc.function.name, args, signal).catch(e => ({ error: e.message }));
      writeEvent(sseToolResult(tc.function.name));
      workingMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResult) });
    }
    rounds += 1;
  }

  // Exceeded limit — force final non-tool answer
  workingMessages.push({ role: 'system', content: '工具调用次数已达上限，请基于已有信息直接回答。不要再调工具。' });
  const finalResult = await callLLM({ messages: workingMessages, tools: toolSchemas, toolChoice: 'none', stream: true, signal });
  const reader = finalResult.stream.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const ev of parseStreamChunk(decoder.decode(value, { stream: true }))) {
      const delta = ev.choices?.[0]?.delta?.content;
      if (delta) { fullContent += delta; writeEvent(sseToken(delta)); }
    }
  }
  writeEvent(sseDone());
  return { content: fullContent, toolCallCount };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/llm/toolLoop.js
git commit -m "feat(ai): add tool-calling loop with two-phase LLM orchestration"
```

---

### Task 5: Update aiPromptBuilder.js — Add tool instructions to system prompt

**Files:**
- Modify: `backend/src/services/aiPromptBuilder.js`

- [ ] **Step 1: Append tool rules before the final join**

In `buildSystemPrompt`, just before `return sections.join('\n')`, add:

```js
  sections.push(
    '',
    '## 工具使用规则',
    '当遇到以下情况时，可以调用对应工具：',
    '- 实时信息、新闻、外部政策变化 → 调用 web_search',
    '- 站内帖子、讨论话题 → 调用 search_posts',
    '- 总结某个帖子的内容 → 调用 get_post',
    '- 用户问"最近大家都在讨论什么" → 调用 get_hot_topics',
    '如果无需工具即可回答，不要调用工具。',
    '工具结果不足时，明确说明不确定性，不要编造事实。',
  );
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/aiPromptBuilder.js
git commit -m "feat(ai): add tool-use instructions to system prompt"
```

---

### Task 6: Update aiService.js — Replace direct LLM call with tool loop

**Files:**
- Modify: `backend/src/services/aiService.js`

- [ ] **Step 1: Add import for runToolLoop**

At top of file, add after existing imports:
```js
import { runToolLoop } from './llm/toolLoop.js';
```

- [ ] **Step 2: Delete getLLMConfig() and old callLLM()**

Remove lines 11-76 entirely (the `getLLMConfig` function and the old `callLLM` function).

- [ ] **Step 3: In sendMessage, replace the try-catch LLM call block**

Current (lines 127-148):
```js
  // 调用 LLM
  let aiContent;
  try {
    aiContent = await callLLM(llmMessages, options.signal);
  } catch (error) {
    ...
  }
```

Replace with:
```js
  // 调用 LLM with tool loop
  let aiContent;
  try {
    const result = await runToolLoop({
      messages: llmMessages,
      signal: options.signal,
      writeEvent: options.emitEvent || (() => {}),
    });
    aiContent = result.content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError('AI 生成已中断', 499, 'LLM_ABORTED');
    }
    if (error.isOperational) {
      throw new AppError(error.message, error.statusCode, error.errorCode, {
        session: serializeSession(session, effectivePersona),
        savedMessage: {
          _id: userMessage._id, role: userMessage.role,
          content: userMessage.content, createdAt: userMessage.createdAt,
        },
      });
    }
    throw error;
  }
```

- [ ] **Step 4: In regenerateMessage, replace the try-catch LLM call block**

Current (lines 213-222):
```js
  // 调用 LLM
  let aiContent;
  try {
    aiContent = await callLLM(llmMessages, options.signal);
  } catch (error) {
    ...
  }
```

Replace with:
```js
  // 调用 LLM with tool loop
  let aiContent;
  try {
    const result = await runToolLoop({
      messages: llmMessages,
      signal: options.signal,
      writeEvent: options.emitEvent || (() => {}),
    });
    aiContent = result.content;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError('AI 生成已中断', 499, 'LLM_ABORTED');
    }
    throw error;
  }
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/aiService.js
git commit -m "feat(ai): replace direct LLM call with tool-calling loop"
```

---

### Task 7: Update aiController.js — SSE streaming

Both `sendMessage` and `regenerateMessage` now return SSE instead of JSON.

**Files:**
- Modify: `backend/src/controllers/aiController.js`

- [ ] **Step 1: Rewrite sendMessage for SSE**

Replace the `sendMessage` function (lines 29-41):

```js
export const sendMessage = async (req, res) => {
  const { sessionId, message } = req.body;
  const { signal, cleanup } = createRequestAbortSignal(req, res);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const emitEvent = (str) => {
    if (!signal.aborted && res.writable && !res.writableEnded) res.write(str);
  };

  try {
    await aiService.sendMessage(req.user.id, sessionId, message, { signal, emitEvent });
  } catch (error) {
    if (!signal.aborted && !res.writableEnded) {
      const { sseError } = await import('../services/llm/sseEvents.js');
      res.write(sseError(error.isOperational ? error.message : '服务暂时不可用'));
    }
  } finally {
    if (!signal.aborted && !res.writableEnded) res.end();
    cleanup();
  }
};
```

- [ ] **Step 2: Rewrite regenerateMessage for SSE**

Replace lines 43-55:

```js
export const regenerateMessage = async (req, res) => {
  const { id } = req.params;
  const { signal, cleanup } = createRequestAbortSignal(req, res);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const emitEvent = (str) => {
    if (!signal.aborted && res.writable && !res.writableEnded) res.write(str);
  };

  try {
    await aiService.regenerateMessage(req.user.id, id, { signal, emitEvent });
  } catch (error) {
    if (!signal.aborted && !res.writableEnded) {
      const { sseError } = await import('../services/llm/sseEvents.js');
      res.write(sseError(error.isOperational ? error.message : '服务暂时不可用'));
    }
  } finally {
    if (!signal.aborted && !res.writableEnded) res.end();
    cleanup();
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/aiController.js
git commit -m "feat(ai): convert sendMessage and regenerateMessage to SSE streaming"
```

---

### Task 8: Update frontend aiService.js — SSE streaming client

Add functions that fetch SSE and call callbacks for each event type.

**Files:**
- Modify: `frontend/src/services/aiService.js`

- [ ] **Step 1: Add sendMessageStream and regenerateMessageStream**

Add after existing functions:

```js
export async function sendMessageStream(sessionId, message, { signal, onToken, onToolCall, onToolResult, onDone, onError } = {}) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: '请求失败' }));
    onError?.(err.message || '请求失败');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        switch (data.type) {
          case 'token': onToken?.(data.content); break;
          case 'tool_call': onToolCall?.(data.tool, data.args); break;
          case 'tool_result': onToolResult?.(data.tool); break;
          case 'done': onDone?.(); break;
          case 'error': onError?.(data.message); break;
        }
      } catch { /* skip malformed */ }
    }
  }
}

export async function regenerateMessageStream(sessionId, { signal, onToken, onToolCall, onToolResult, onDone, onError } = {}) {
  const response = await fetch(`/api/ai/sessions/${sessionId}/regenerate`, { method: 'POST', signal });
  // Same SSE parsing logic as sendMessageStream
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: '请求失败' }));
    onError?.(err.message || '请求失败');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        switch (data.type) {
          case 'token': onToken?.(data.content); break;
          case 'tool_call': onToolCall?.(data.tool, data.args); break;
          case 'tool_result': onToolResult?.(data.tool); break;
          case 'done': onDone?.(); break;
          case 'error': onError?.(data.message); break;
        }
      } catch { /* skip */ }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/aiService.js
git commit -m "feat(ai): add SSE streaming client for tool-calling assistant"
```

---

### Task 9: Update aiStore.js — Streaming state management

Add `toolStatus` and `streamingContent` fields; replace `sendMessage` and `regenerateMessage` with streaming versions.

**Files:**
- Modify: `frontend/src/store/aiStore.js`

- [ ] **Step 1: Add streaming state fields**

In the state object (around line 87-106), add after `activeRequestController: null`:
```js
  toolStatus: null,
  streamingContent: '',
```

- [ ] **Step 2: Replace sendMessage action**

Replace the `sendMessage` action (lines 173-234) with a streaming version:

```js
  sendMessage: async (content) => {
    const { currentSession, messages } = get();
    const controller = new AbortController();

    const tempUserMessage = {
      _id: 'temp-' + Date.now(), role: 'user', content,
      createdAt: new Date().toISOString(),
    };

    set({
      messages: [...messages, tempUserMessage],
      isLoading: true, isStopping: false, streamingContent: '',
      toolStatus: null, activeRequestController: controller,
    });

    try {
      await aiService.sendMessageStream(currentSession?._id, content, {
        signal: controller.signal,
        onToolCall: (tool, args) => {
          set({ toolStatus: `正在调用 ${tool}...` });
        },
        onToolResult: () => {
          set({ toolStatus: null });
        },
        onToken: (token) => {
          set((state) => ({ streamingContent: state.streamingContent + token }));
        },
        onDone: async () => {
          await get().syncCurrentSessionAfterStream();
          set({ streamingContent: '', toolStatus: null, isLoading: false, activeRequestController: null });
        },
        onError: (message) => {
          set((state) => ({
            messages: state.messages.filter(m => m._id !== tempUserMessage._id),
            error: message, isLoading: false, streamingContent: '',
            toolStatus: null, activeRequestController: null,
          }));
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        await get().syncCurrentSessionAfterAbort();
        return;
      }
      set((state) => ({
        messages: state.messages.filter(m => m._id !== tempUserMessage._id),
        isLoading: false, streamingContent: '', toolStatus: null,
        activeRequestController: null, error: err.message,
      }));
    }
  },
```

- [ ] **Step 3: Add syncCurrentSessionAfterStream**

Add after `syncCurrentSessionAfterAbort` (after line 341):

```js
  syncCurrentSessionAfterStream: async () => {
    const { currentSession } = get();
    if (!currentSession?._id) {
      set({ isLoading: false, streamingContent: '', toolStatus: null, activeRequestController: null });
      return;
    }
    try {
      const [sessionData, sessions] = await Promise.all([
        aiService.getSession(currentSession._id),
        aiService.getSessions(),
      ]);
      set({
        sessions, currentSession: sessionData.session,
        messages: sessionData.messages,
        sessionPersona: sessionData.session.aiPersona || {},
        effectivePersona: withPersonaDefaults(sessionData.session.effectivePersona),
        isLoading: false, streamingContent: '', toolStatus: null,
        activeRequestController: null, error: null,
      });
    } catch {
      set({ isLoading: false, streamingContent: '', toolStatus: null, activeRequestController: null });
    }
  },
```

- [ ] **Step 4: Replace regenerateMessage action**

Replace lines 236-283:

```js
  regenerateMessage: async () => {
    const { currentSession, messages } = get();
    if (!currentSession) return;
    const controller = new AbortController();

    set({
      isLoading: true, isStopping: false, streamingContent: '',
      toolStatus: null, activeRequestController: controller,
    });

    try {
      // Remove last assistant content — will be streamed anew
      const msgsWithoutLastAssistant = [...messages];
      for (let i = msgsWithoutLastAssistant.length - 1; i >= 0; i--) {
        if (msgsWithoutLastAssistant[i].role === 'assistant') {
          msgsWithoutLastAssistant[i] = { ...msgsWithoutLastAssistant[i], content: '' };
          break;
        }
      }
      set({ messages: msgsWithoutLastAssistant });

      await aiService.regenerateMessageStream(currentSession._id, {
        signal: controller.signal,
        onToolCall: (tool) => set({ toolStatus: `正在调用 ${tool}...` }),
        onToolResult: () => set({ toolStatus: null }),
        onToken: (token) => set((state) => ({ streamingContent: state.streamingContent + token })),
        onDone: async () => {
          await get().syncCurrentSessionAfterStream();
          set({ streamingContent: '', toolStatus: null, isLoading: false, activeRequestController: null });
        },
        onError: (message) => {
          set({ error: message, isLoading: false, streamingContent: '', toolStatus: null, activeRequestController: null });
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        await get().syncCurrentSessionAfterAbort();
        return;
      }
      set({ isLoading: false, streamingContent: '', toolStatus: null, activeRequestController: null, error: err.message });
    }
  },
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/aiStore.js
git commit -m "feat(ai): update store with streaming, tool status, and SSE actions"
```

---

### Task 10: Update AIPanel.jsx — Tool status and streaming UI

Show tool status indicator and streaming content for the in-progress assistant message.

**Files:**
- Modify: `frontend/src/components/features/AIPanel.jsx`

- [ ] **Step 1: Add streamingContent and toolStatus to store destructure**

In the store destructure block (lines 424-454), add after `isStopping`:
```js
    streamingContent,
    toolStatus,
```

- [ ] **Step 2: Add tool status indicator after the loading spinner**

After the loading spinner block (around line 688), add:
```jsx
              {toolStatus && (
                <div className="flex justify-start mb-4">
                  <div className="px-4 py-2 rounded-2xl bg-surface-soft rounded-tl-sm text-sm text-text-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    {toolStatus}
                  </div>
                </div>
              )}
```

- [ ] **Step 3: Add streaming content bubble after the messages map**

After the messages `.map()` and before the loading spinner, add:
```jsx
              {/* In-progress streaming content */}
              {isLoading && streamingContent && (
                <div className="flex justify-start mb-4">
                  <div className="px-4 py-3 rounded-2xl bg-surface-soft rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[85%]">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 bg-blue ml-0.5 animate-pulse" />
                  </div>
                </div>
              )}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/features/AIPanel.jsx
git commit -m "feat(ai): add tool status indicator and streaming content UI"
```

---

### Task 11: Environment Configuration

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add new env vars**

```
# LLM (DeepSeek)
LLM_API_URL=https://api.deepseek.com/v1/chat/completions
LLM_API_KEY=your_deepseek_api_key
LLM_MODEL=deepseek-chat

# Web Search (Tavily / SerpAPI / Bing)
SEARCH_API_URL=https://api.tavily.com/search
SEARCH_API_KEY=your_search_api_key

# Tool Loop Limits
AI_TOOL_MAX_CALLS=3
AI_TOOL_TIMEOUT_MS=8000
AI_STREAM_IDLE_TIMEOUT_MS=30000
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "feat(ai): add environment config for tool-calling assistant"
```
