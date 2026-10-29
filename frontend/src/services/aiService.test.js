import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient.js', () => ({
  fetchWithAuthRetry: vi.fn(),
  request: vi.fn(),
}));

import { fetchWithAuthRetry } from './apiClient.js';
import { sendMessageStream } from './aiService.js';

function sseResponse(events) {
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe('AI stream consumption', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awaits asynchronous done handlers before resolving the stream request', async () => {
    fetchWithAuthRetry.mockResolvedValue(sseResponse([{ type: 'done' }]));
    const events = [];
    let releaseDone;
    let requestSettled = false;
    const doneGate = new Promise((resolve) => {
      releaseDone = resolve;
    });

    const request = sendMessageStream('session-1', '问题', {
      onDone: async () => {
        events.push('done-started');
        await doneGate;
        events.push('done-finished');
      },
    }).then(() => {
      requestSettled = true;
    });

    await vi.waitFor(() => expect(events).toEqual(['done-started']));
    expect(requestSettled).toBe(false);
    releaseDone();
    await request;
    expect(events).toEqual(['done-started', 'done-finished']);
  });

  it('reports EOF without a terminal event and awaits the error handler', async () => {
    fetchWithAuthRetry.mockResolvedValue(sseResponse([{ type: 'token', content: '已生成' }]));
    const events = [];
    let releaseError;
    const errorGate = new Promise((resolve) => {
      releaseError = resolve;
    });

    const request = sendMessageStream('session-1', '问题', {
      onToken: (token) => events.push(token),
      onError: async (message) => {
        events.push(message);
        await errorGate;
        events.push('error-finished');
      },
    });

    await vi.waitFor(() => expect(events).toEqual(['已生成', '生成流意外结束，已保留已生成内容']));
    releaseError();
    await request;
    expect(events.at(-1)).toBe('error-finished');
  });
});
