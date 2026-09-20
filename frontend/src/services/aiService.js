import { fetchWithAuthRetry, request } from './apiClient.js';

export const sendMessage = async (sessionId, message, options = {}) => {
  const data = await request('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message }),
    ...options,
  });
  return data;
};

export const cancelRequest = async (requestId) => {
  if (!requestId) {
    return { success: false, cancelled: false };
  }

  const data = await request('/api/ai/cancel', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
  return data;
};

export const getSessions = async () => {
  const data = await request('/api/ai/sessions');
  return data.data.sessions;
};

export const getSession = async (sessionId) => {
  const data = await request(`/api/ai/sessions/${sessionId}`);
  return data.data;
};

export const createSession = async () => {
  const data = await request('/api/ai/sessions', {
    method: 'POST',
  });
  return data.data.session;
};

export const deleteSession = async (sessionId) => {
  await request(`/api/ai/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  return { success: true };
};

export const regenerateMessage = async (sessionId, options = {}) => {
  const data = await request(`/api/ai/sessions/${sessionId}/regenerate`, {
    method: 'POST',
    ...options,
  });
  return data.data;
};

export const getProfile = async () => {
  const data = await request('/api/ai/profile');
  return data.data;
};

export const updateProfile = async (persona) => {
  const data = await request('/api/ai/profile', {
    method: 'PUT',
    body: JSON.stringify({ persona }),
  });
  return data.data;
};

export const getSessionPersona = async (sessionId) => {
  const data = await request(`/api/ai/sessions/${sessionId}/persona`);
  return data.data;
};

export const updateSessionPersona = async (sessionId, persona) => {
  const data = await request(`/api/ai/sessions/${sessionId}/persona`, {
    method: 'PUT',
    body: JSON.stringify({ persona }),
  });
  return data.data;
};

function parseSSEBuffer(buffer) {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const remainder = frames.pop() || '';
  const events = [];

  for (const frame of frames) {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6));

    if (!dataLines.length) continue;

    try {
      events.push(JSON.parse(dataLines.join('\n')));
    } catch {
      // Skip malformed event frames.
    }
  }

  return { events, remainder };
}

async function consumeSSE(response, { onStart, onToken, onToolCall, onToolResult, onDone, onError } = {}) {
  const reader = response.body?.getReader();
  if (!reader) {
    onError?.('响应流不可用');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSSEBuffer(buffer);
    buffer = parsed.remainder;

    for (const data of parsed.events) {
      switch (data.type) {
        case 'start': onStart?.(data.sessionId); break;
        case 'token': onToken?.(data.content); break;
        case 'tool_call': onToolCall?.(data.tool, data.args); break;
        case 'tool_result': onToolResult?.(data.tool); break;
        case 'done': onDone?.(); break;
        case 'error': onError?.(data.message); break;
      }
    }
  }

  if (buffer) {
    const parsed = parseSSEBuffer(`${buffer}\n\n`);
    for (const data of parsed.events) {
      switch (data.type) {
        case 'start': onStart?.(data.sessionId); break;
        case 'token': onToken?.(data.content); break;
        case 'tool_call': onToolCall?.(data.tool, data.args); break;
        case 'tool_result': onToolResult?.(data.tool); break;
        case 'done': onDone?.(); break;
        case 'error': onError?.(data.message); break;
      }
    }
  }
}

export async function sendMessageStream(sessionId, message, { signal, context, requestId, onStart, onToken, onToolCall, onToolResult, onDone, onError } = {}) {
  const response = await fetchWithAuthRetry('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, context, requestId }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    onError?.(err?.error || err?.message || '请求失败');
    return;
  }

  await consumeSSE(response, { onStart, onToken, onToolCall, onToolResult, onDone, onError });
}

export async function regenerateMessageStream(sessionId, { signal, requestId, onStart, onToken, onToolCall, onToolResult, onDone, onError } = {}) {
  const response = await fetchWithAuthRetry(`/api/ai/sessions/${sessionId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    onError?.(err?.error || err?.message || '请求失败');
    return;
  }

  await consumeSSE(response, { onStart, onToken, onToolCall, onToolResult, onDone, onError });
}
