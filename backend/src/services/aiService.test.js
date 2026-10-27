import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import AIMessage from '../models/AIMessage.js';
import AIProfile from '../models/AIProfile.js';
import AISession from '../models/AISession.js';
import { regenerateMessage, sendMessage } from './aiService.js';

const llmEnvironmentKeys = ['LLM_API_URL', 'LLM_API_KEY', 'LLM_MODEL'];
let previousLLMEnvironment;

afterEach(() => {
  mock.restoreAll();
  for (const key of llmEnvironmentKeys) {
    if (previousLLMEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousLLMEnvironment[key];
  }
});

function createFixture(seedMessages = []) {
  const sessionId = 'session-1';
  const createdMessages = [...seedMessages];
  let nextMessageId = 1;
  let nextTimestamp = Date.now();
  const session = {
    _id: { toString: () => sessionId },
    user: 'user-1',
    title: '已有会话',
    aiPersona: null,
    save: async () => {},
  };

  mock.method(AISession, 'findOne', async () => session);
  mock.method(AIProfile, 'findOne', () => ({ lean: async () => null }));
  mock.method(AIMessage, 'create', async (data) => {
    const message = {
      ...data,
      _id: { toString: () => `message-${nextMessageId++}` },
      createdAt: new Date(nextTimestamp++),
      save: async () => {},
    };
    createdMessages.push(message);
    return message;
  });
  mock.method(AIMessage, 'find', () => {
    let limit = Infinity;
    return {
      sort() { return this; },
      limit(value) { limit = value; return this; },
      lean: async () => [...createdMessages]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, limit),
    };
  });
  mock.method(AIMessage, 'findOne', () => ({
    sort: async () => [...createdMessages]
      .filter((message) => message.role === 'assistant')
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null,
  }));

  return { session, createdMessages };
}

function createCompleteMessage(turnId, role, content, time) {
  return {
    _id: `seed-${turnId}-${role}`,
    session: 'session-1',
    turnId,
    status: 'complete',
    role,
    content,
    createdAt: new Date(time),
    save: async () => {},
  };
}

function mockLLM(plannerResponse, finalResponse) {
  previousLLMEnvironment = Object.fromEntries(llmEnvironmentKeys.map((key) => [key, process.env[key]]));
  process.env.LLM_API_URL = 'http://llm.test/chat/completions';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'test-model';

  const requestBodies = [];
  mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    requestBodies.push(body);
    if (body.stream) return finalResponse(options.signal);
    return new Response(JSON.stringify(plannerResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return requestBodies;
}

function plannerResponse() {
  return { choices: [{ message: { content: '__NO_TOOL__' } }] };
}

function completedStream(content) {
  return (signal) => {
    const event = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(event));
        controller.close();
        signal?.throwIfAborted?.();
      },
    }), { status: 200 });
  };
}

function interruptedStream(content, { abortOnToken = false } = {}) {
  return (signal) => {
    const event = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
    let streamController;
    if (abortOnToken) signal.addEventListener('abort', () => streamController?.close(), { once: true });
    return new Response(new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode(event));
      },
    }), { status: 200 });
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('interrupted turns retain user and partial messages but stay out of later context', async () => {
  const oldTime = Date.now() - 10000;
  const seedMessages = [
    createCompleteMessage('finished-turn', 'user', '完成的问题', oldTime),
    createCompleteMessage('finished-turn', 'assistant', '完成的回答', oldTime + 1),
    {
      ...createCompleteMessage('interrupted-turn', 'user', '旧的中断问题', oldTime + 2),
      status: 'interrupted',
    },
    {
      ...createCompleteMessage('interrupted-turn', 'assistant', '旧的部分回答', oldTime + 3),
      status: 'interrupted',
    },
  ];
  const { createdMessages } = createFixture(seedMessages);
  const requestBodies = mockLLM(plannerResponse(), completedStream('新的完整回答'));
  const abortController = new AbortController();
  const emittedEvents = [];
  const completed = await sendMessage('user-1', 'session-1', '当前问题', {
    signal: abortController.signal,
    turnId: 'current-turn',
    emitEvent: (event) => emittedEvents.push(event),
  });

  const llmHistory = JSON.stringify(requestBodies[0].messages);
  assert.match(llmHistory, /完成的问题/);
  assert.match(llmHistory, /完成的回答/);
  assert.doesNotMatch(llmHistory, /旧的中断问题|旧的部分回答/);
  assert.equal(createdMessages.find((message) => message.turnId === 'current-turn' && message.role === 'user').status, 'complete');
  assert.equal(createdMessages.find((message) => message.turnId === 'current-turn' && message.role === 'assistant').status, 'complete');
  assert.equal(completed.assistantMessage.content, '新的完整回答');
  assert.equal(emittedEvents.some((event) => event.includes('"type":"done"')), true);
});

test('stop after tokens preserves both interrupted messages in the session', async () => {
  const { createdMessages } = createFixture();
  mockLLM(plannerResponse(), interruptedStream('已生成一半', { abortOnToken: true }));
  const abortController = new AbortController();

  await assert.rejects(
    sendMessage('user-1', 'session-1', '请回答', {
      signal: abortController.signal,
      turnId: 'stopped-turn',
      emitEvent: (event) => {
        if (event.includes('"type":"token"')) abortController.abort();
      },
    }),
    (error) => error.errorCode === 'LLM_ABORTED',
  );

  const turn = createdMessages.filter((message) => message.turnId === 'stopped-turn');
  assert.deepEqual(turn.map((message) => [message.role, message.content, message.status]), [
    ['user', '请回答', 'interrupted'],
    ['assistant', '已生成一半', 'interrupted'],
  ]);
});

test('generation errors after tokens also retain the partial answer as interrupted', async () => {
  const { createdMessages } = createFixture();
  mockLLM(plannerResponse(), () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ choices: [{ delta: { content: '错误前的部分' } }] })}\n\n`,
      ));
      setTimeout(() => controller.error(new Error('stream failed')), 0);
    },
  }), { status: 200 }));

  await assert.rejects(
    sendMessage('user-1', 'session-1', '请回答', { turnId: 'error-turn' }),
    /stream failed/,
  );

  const turn = createdMessages.filter((message) => message.turnId === 'error-turn');
  assert.deepEqual(turn.map((message) => [message.role, message.content, message.status]), [
    ['user', '请回答', 'interrupted'],
    ['assistant', '错误前的部分', 'interrupted'],
  ]);
});

test('aborted regeneration keeps the original answer and its question in context', async () => {
  const oldTime = Date.now() - 1000;
  const seedMessages = [
    createCompleteMessage('finished-turn', 'user', '原始问题', oldTime),
    createCompleteMessage('finished-turn', 'assistant', '原始完整回答', oldTime + 1),
  ];
  const { createdMessages } = createFixture(seedMessages);
  const requestBodies = mockLLM(plannerResponse(), interruptedStream('重新生成的一部分', { abortOnToken: true }));
  const abortController = new AbortController();

  await assert.rejects(
    regenerateMessage('user-1', 'session-1', {
      signal: abortController.signal,
      emitEvent: (event) => {
        if (event.includes('"type":"token"')) abortController.abort();
      },
    }),
    (error) => error.errorCode === 'LLM_ABORTED',
  );

  assert.equal(createdMessages.find((message) => message.role === 'assistant').content, '原始完整回答');
  assert.match(JSON.stringify(requestBodies[0].messages), /原始问题/);
  assert.doesNotMatch(JSON.stringify(requestBodies[0].messages), /原始完整回答/);
});

test('contextual regeneration emits completion only after both database saves settle', async () => {
  const oldTime = Date.now() - 1000;
  const { session, createdMessages } = createFixture([
    createCompleteMessage('finished-turn', 'user', '总结这个帖子', oldTime),
    createCompleteMessage('finished-turn', 'assistant', '旧回答', oldTime + 1),
  ]);
  const assistantMessage = createdMessages.find((message) => message.role === 'assistant');
  const assistantSave = deferred();
  const sessionSave = deferred();
  const assistantSaveStarted = deferred();
  const sessionSaveStarted = deferred();
  const events = [];
  assistantMessage.save = async () => {
    events.push('assistant-save-started');
    assistantSaveStarted.resolve();
    await assistantSave.promise;
    events.push('assistant-save-finished');
  };
  session.save = async () => {
    events.push('session-save-started');
    sessionSaveStarted.resolve();
    await sessionSave.promise;
    events.push('session-save-finished');
  };

  const regeneration = regenerateMessage('user-1', 'session-1', {
    emitEvent: (event) => events.push(JSON.parse(event.slice(6).trim()).type),
  });

  await assistantSaveStarted.promise;
  assert.equal(events.includes('done'), false);
  assert.equal(events.includes('token'), false);
  assistantSave.resolve();
  await sessionSaveStarted.promise;
  assert.equal(events.includes('done'), false);
  assert.equal(events.includes('token'), false);
  sessionSave.resolve();
  await regeneration;

  const answerSaveFinishedAt = events.indexOf('assistant-save-finished');
  const sessionSaveFinishedAt = events.indexOf('session-save-finished');
  const tokenAt = events.indexOf('token');
  const doneAt = events.indexOf('done');
  assert.ok(tokenAt > answerSaveFinishedAt && tokenAt > sessionSaveFinishedAt);
  assert.ok(doneAt > tokenAt);
});
