import AppError from '../../utils/AppError.js';

export function getLLMConfig() {
  return {
    apiUrl: process.env.LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions',
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || 'deepseek-chat',
  };
}

export function shouldRoundtripReasoning(config = getLLMConfig()) {
  const apiUrl = String(config.apiUrl || '');
  const model = String(config.model || '').trim();
  const isOfficialDeepSeek = /api\.deepseek\.com/.test(apiUrl);
  const isDashScopeCompatible = /dashscope\.aliyuncs\.com\/compatible-mode/.test(apiUrl);

  if (isDashScopeCompatible) {
    return true;
  }

  if (!isOfficialDeepSeek) {
    return false;
  }

  if (model === 'deepseek-reasoner') {
    return false;
  }

  return model.startsWith('deepseek-v4-') || model === 'deepseek-chat';
}

/**
 * Call the DeepSeek (OpenAI-compatible) LLM API.
 *
 * @param {Object} options
 * @param {Array}  options.messages   - Array of { role, content } message objects
 * @param {Array}  [options.tools]    - Tool definitions for function calling
 * @param {string} [options.toolChoice] - Tool choice policy ('auto', 'none', or { type: 'function', function: { name } })
 * @param {boolean} [options.stream]  - Whether to stream the response
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @returns {Promise<{ data?: Object, stream?: ReadableStream }>}
 */
export async function callLLM({ messages, tools, toolChoice, stream, signal, temperature = 0.7 }) {
  const { apiUrl, apiKey, model } = getLLMConfig();
  const hasReasoningHistory = Array.isArray(messages) && messages.some(
    (message) => message?.role === 'assistant' && typeof message?.reasoning_content === 'string' && message.reasoning_content.trim()
  );
  const isDashScopeCompatible = /dashscope\.aliyuncs\.com\/compatible-mode/.test(apiUrl);

  if (!apiKey) {
    throw new AppError('AI 服务未配置', 500, 'AI_NOT_CONFIGURED');
  }

  const body = {
    model,
    messages,
    temperature,
    max_tokens: 2000,
  };

  if (tools) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }

  if (stream) {
    body.stream = true;
  }

  if (isDashScopeCompatible && hasReasoningHistory) {
    body.preserve_thinking = true;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.error?.message || `LLM API 请求失败 (${response.status})`;
    throw new AppError(message, 502, 'LLM_API_ERROR');
  }

  if (stream) {
    return { stream: response.body };
  }

  const data = await response.json();
  return { data };
}

/**
 * Parse complete SSE event frames from a buffered string.
 *
 * The returned `remainder` must be preserved and prepended to the next chunk
 * because network reads can split an SSE frame across multiple chunks.
 *
 * @param {string} buffer
 * @returns {{ events: Array<Object>, remainder: string }}
 */
export function parseStreamBuffer(buffer) {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const remainder = frames.pop() || '';
  const events = [];

  for (const frame of frames) {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6));

    if (!dataLines.length) {
      continue;
    }

    const payload = dataLines.join('\n').trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      events.push(JSON.parse(payload));
    } catch {
      // Ignore malformed complete frames from the upstream provider.
    }
  }

  return { events, remainder };
}

/**
 * Extract tool_calls from a streaming or non-streaming choice object.
 *
 * @param {Object} choice - A choice object from the API response
 * @returns {Array} The tool_calls array, or an empty array
 */
export function extractToolCalls(choice) {
  return choice.message?.tool_calls || [];
}

/**
 * Extract content text from a choice object.
 *
 * @param {Object} choice - A choice object from the API response
 * @returns {string} The content string, or empty string
 */
export function extractContent(choice) {
  return choice.message?.content || '';
}

/**
 * Extract reasoning_content from a choice object.
 *
 * @param {Object} choice - A choice object from the API response
 * @returns {string} The reasoning content string, or empty string
 */
export function extractReasoningContent(choice) {
  return choice.message?.reasoning_content || '';
}
