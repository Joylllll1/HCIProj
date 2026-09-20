import { callLLM, extractToolCalls, extractContent, extractReasoningContent, parseStreamBuffer } from './client.js';
import { toolSchemas, executeTool } from '../tools/index.js';
import { sseToolCall, sseToolResult, sseToken } from './sseEvents.js';

const MAX_TOOL_CALLS = parseInt(process.env.AI_TOOL_MAX_CALLS || '5');
const MAX_LOOP_ROUNDS = 6;
const DECISION_PROMPT = [
  '你当前处于工具决策阶段。',
  '如果需要工具，请直接发起 tool call，不要先输出任何自然语言。',
  '如果不需要任何工具，请只输出精确文本 __NO_TOOL__，不要输出其他内容。',
  '只要用户问题依赖最新事实、时间敏感信息，或现代人物/机构/产品/政策/比赛/榜单等当前状态不够确定，就先调工具，不要凭记忆回答。',
  '如果 web_search 的摘要不足以支撑高风险事实判断，应继续调用 fetch_url 打开一到两个最相关来源页面再回答。',
].join('');

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

async function streamFinalAnswer({ messages, signal, writeEvent }) {
  throwIfAborted(signal);
  const finalResult = await callLLM({
    messages,
    stream: true,
    signal,
  });
  const reader = finalResult.stream.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let reasoningContent = '';
  let buffer = '';

  for (;;) {
    throwIfAborted(signal);
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseStreamBuffer(buffer);
    buffer = parsed.remainder;
    for (const ev of parsed.events) {
      throwIfAborted(signal);
      const reasoningDelta = ev.choices?.[0]?.delta?.reasoning_content;
      if (reasoningDelta) {
        reasoningContent += reasoningDelta;
      }
      const delta = ev.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        writeEvent(sseToken(delta));
      }
    }
  }

  if (buffer) {
    const parsed = parseStreamBuffer(`${buffer}\n\n`);
    for (const ev of parsed.events) {
      throwIfAborted(signal);
      const reasoningDelta = ev.choices?.[0]?.delta?.reasoning_content;
      if (reasoningDelta) {
        reasoningContent += reasoningDelta;
      }
      const delta = ev.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        writeEvent(sseToken(delta));
      }
    }
  }

  return { content: fullContent, reasoningContent };
}

export async function runToolLoop({ messages, signal, writeEvent, initialToolCallCount = 0 }) {
  let toolCallCount = initialToolCallCount;
  let rounds = 0;
  const workingMessages = [...messages];

  while (rounds < MAX_LOOP_ROUNDS) {
    throwIfAborted(signal);
    const decisionMessages = [
      ...workingMessages,
      { role: 'system', content: DECISION_PROMPT },
    ];
    const result = await callLLM({
      messages: decisionMessages,
      tools: toolSchemas,
      toolChoice: 'auto',
      stream: false,
      signal,
      temperature: 0,
    });
    const choice = result.data.choices[0];
    const toolCalls = extractToolCalls(choice);
    const content = extractContent(choice);
    const reasoningContent = extractReasoningContent(choice);

    if (!toolCalls.length) {
      const normalizedContent = (content || '').trim();

      if (normalizedContent && normalizedContent !== '__NO_TOOL__') {
        throwIfAborted(signal);
        writeEvent(sseToken(content));
        return {
          content: content || '',
          reasoningContent: reasoningContent || '',
          toolCallCount,
          plannerContent: content || '',
        };
      }

      const finalAnswer = await streamFinalAnswer({
        messages: workingMessages,
        signal,
        writeEvent,
      });
      return {
        content: finalAnswer.content,
        reasoningContent: finalAnswer.reasoningContent || '',
        toolCallCount,
        plannerContent: content || '',
      };
    }

    // Handle tool calls
    workingMessages.push({
      role: 'assistant',
      content: content || null,
      reasoning_content: reasoningContent || undefined,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      throwIfAborted(signal);
      toolCallCount += 1;
      if (toolCallCount > MAX_TOOL_CALLS) {
        workingMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: '工具调用次数已达上限' }) });
        break;
      }

      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* use empty */ }
      throwIfAborted(signal);
      writeEvent(sseToolCall(tc.function.name, args));

      const toolResult = await executeTool(tc.function.name, args, signal).catch(e => ({ error: e.message }));
      throwIfAborted(signal);
      writeEvent(sseToolResult(tc.function.name));
      workingMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResult) });
    }
    rounds += 1;
  }

  // Exceeded limit — force final non-tool answer
  workingMessages.push({ role: 'system', content: '工具调用次数已达上限，请基于已有信息直接回答。不要再调工具。' });
  const finalAnswer = await streamFinalAnswer({
    messages: workingMessages,
    signal,
    writeEvent,
  });
  return {
    content: finalAnswer.content,
    reasoningContent: finalAnswer.reasoningContent || '',
    toolCallCount,
  };
}
