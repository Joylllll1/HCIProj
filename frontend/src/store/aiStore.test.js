import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/aiService', () => ({
  getSessions: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  sendMessageStream: vi.fn(),
  regenerateMessageStream: vi.fn(),
  cancelRequest: vi.fn(),
  getProfile: vi.fn(),
  getSessionPersona: vi.fn(),
  updateProfile: vi.fn(),
  updateSessionPersona: vi.fn(),
}));

import * as aiService from '../services/aiService';
import useAIStore from './aiStore';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function session(id) {
  return {
    _id: id,
    title: id,
    aiPersona: {},
    effectivePersona: {},
  };
}

describe('AI session and stream state', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAIStore.setState({
      sessions: [], currentSession: null, messages: [], showSessionList: false,
      isLoading: false, isSessionSwitching: false, isStopping: false,
      activeRequestController: null, activeRequestId: null,
      streamingContent: '', toolStatus: null, error: null,
    });
    aiService.getSessions.mockResolvedValue([]);
    aiService.cancelRequest.mockResolvedValue({ success: true, cancelled: true });
  });

  afterEach(() => {
    useAIStore.getState().resetForAccountChange();
  });

  it('applies only the most recently requested session when loads finish out of order', async () => {
    const olderLoad = deferred();
    const newerLoad = deferred();
    aiService.getSession.mockImplementation((id) => (id === 'older' ? olderLoad.promise : newerLoad.promise));

    const olderRequest = useAIStore.getState().switchSession('older');
    const newerRequest = useAIStore.getState().switchSession('newer');
    newerLoad.resolve({ session: session('newer'), messages: [{ _id: 'new', content: '新会话' }] });
    await newerRequest;
    olderLoad.resolve({ session: session('older'), messages: [{ _id: 'old', content: '旧会话' }] });
    await olderRequest;

    expect(useAIStore.getState().currentSession._id).toBe('newer');
    expect(useAIStore.getState().messages[0]._id).toBe('new');
  });

  it('ignores session fetches that finish after the account reset', async () => {
    const load = deferred();
    aiService.getSession.mockReturnValue(load.promise);

    const pendingSwitch = useAIStore.getState().switchSession('account-A-session');
    useAIStore.getState().resetForAccountChange();
    load.resolve({ session: session('account-A-session'), messages: [{ content: '旧账号内容' }] });
    await pendingSwitch;

    expect(useAIStore.getState().currentSession).toBeNull();
    expect(useAIStore.getState().messages).toEqual([]);
  });

  it('closes the session drawer immediately and keeps cached messages when a session GET fails', async () => {
    const cachedMessages = [{ _id: 'cached-question', role: 'user', content: '缓存的问题' }];
    useAIStore.setState({
      currentSession: session('B'),
      sessions: [session('A'), session('B')],
      messages: [],
      messagesBySession: { A: cachedMessages },
      showSessionList: true,
    });
    aiService.getSession.mockRejectedValue(new Error('temporary read failure'));

    await useAIStore.getState().switchSession('A');

    expect(useAIStore.getState().showSessionList).toBe(false);
    expect(useAIStore.getState().currentSession._id).toBe('A');
    expect(useAIStore.getState().messages).toEqual(cachedMessages);
    expect(useAIStore.getState().error).toBe('temporary read failure');
  });

  it('allows browsing while a response streams but blocks session mutations', async () => {
    aiService.getSession.mockResolvedValue({ session: session('B'), messages: [{ _id: 'b-user', content: 'B 的问题' }] });
    useAIStore.setState({
      currentSession: session('A'),
      sessions: [session('A'), session('B')],
      messages: [{ _id: 'a-user', content: 'A 的问题' }],
      messagesBySession: { A: [{ _id: 'a-user', content: 'A 的问题' }] },
      isLoading: true,
      activeRequestSessionId: 'A',
    });

    await useAIStore.getState().switchSession('B');
    await useAIStore.getState().createSession();
    await useAIStore.getState().deleteSession('A');

    expect(aiService.getSession).toHaveBeenCalledWith('B');
    expect(aiService.createSession).not.toHaveBeenCalled();
    expect(aiService.deleteSession).not.toHaveBeenCalled();
    expect(useAIStore.getState().currentSession._id).toBe('B');
    expect(useAIStore.getState().messages).toEqual([{ _id: 'b-user', content: 'B 的问题' }]);
  });

  it('waits for server cancellation acknowledgement before aborting the stream', async () => {
    const stream = deferred();
    const cancel = deferred();
    let requestOptions;
    aiService.sendMessageStream.mockImplementation((_sessionId, _content, options) => {
      requestOptions = options;
      return stream.promise;
    });
    aiService.cancelRequest.mockReturnValue(cancel.promise);
    useAIStore.setState({ currentSession: session('A') });

    const send = useAIStore.getState().sendMessage('问题');
    const stop = useAIStore.getState().cancelActiveRequest();
    expect(requestOptions.signal.aborted).toBe(false);
    expect(useAIStore.getState().isStopping).toBe(true);

    cancel.resolve({ success: true, cancelled: true });
    await stop;
    expect(requestOptions.signal.aborted).toBe(true);
    await requestOptions.onError('已停止');
    stream.resolve();
    await send;
  });

  it('does not abort or sync while the server has no cancellation target', async () => {
    const stream = deferred();
    let requestOptions;
    aiService.sendMessageStream.mockImplementation((_sessionId, _content, options) => {
      requestOptions = options;
      return stream.promise;
    });
    aiService.cancelRequest.mockResolvedValue({ success: true, cancelled: false });
    useAIStore.setState({ currentSession: session('A') });

    const send = useAIStore.getState().sendMessage('问题');
    const stopped = await useAIStore.getState().cancelActiveRequest();

    expect(stopped).toBe(false);
    expect(requestOptions.signal.aborted).toBe(false);
    expect(useAIStore.getState().isStopping).toBe(false);
    stream.resolve();
    await send;
  });

  it('restores the original complete answer when regeneration is interrupted', async () => {
    const originalMessages = [
      { _id: 'question', role: 'user', content: '问题', status: 'complete' },
      { _id: 'answer', role: 'assistant', content: '原回答', status: 'complete' },
    ];
    aiService.getSession.mockResolvedValue({ session: session('A'), messages: originalMessages });
    aiService.getSessions.mockResolvedValue([session('A')]);
    aiService.regenerateMessageStream.mockImplementation(async (_sessionId, options) => {
      options.onToken('新回答的一部分');
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    useAIStore.setState({ currentSession: session('A'), messages: originalMessages });

    await useAIStore.getState().regenerateMessage();

    expect(useAIStore.getState().messages).toEqual(originalMessages);
    expect(useAIStore.getState().isLoading).toBe(false);
  });

  it('keeps a completed streamed answer visible when the final session sync fails', async () => {
    aiService.getSession.mockRejectedValue(new Error('temporary read failure'));
    aiService.sendMessageStream.mockImplementation(async (_sessionId, _content, options) => {
      options.onToken('完整回答');
      await options.onDone();
    });
    useAIStore.setState({ currentSession: session('A') });

    await useAIStore.getState().sendMessage('我的问题');

    const messages = useAIStore.getState().messages;
    expect(messages.some((message) => message.role === 'user' && message.content === '我的问题' && message.status === 'complete')).toBe(true);
    expect(messages.some((message) => message.role === 'assistant' && message.content === '完整回答' && message.status === 'complete')).toBe(true);
    expect(useAIStore.getState().error).toMatch(/同步失败/);
    expect(useAIStore.getState().isLoading).toBe(false);
  });

  it('keeps the original question and completed answer in A when final sync fails while viewing B', async () => {
    const stream = deferred();
    let options;
    aiService.getSession.mockRejectedValue(new Error('temporary read failure'));
    aiService.sendMessageStream.mockImplementation((_sessionId, _content, requestOptions) => {
      options = requestOptions;
      return stream.promise;
    });
    useAIStore.setState({ currentSession: session('A'), sessions: [session('A'), session('B')] });

    const send = useAIStore.getState().sendMessage('原始问题');
    options.onToken('完整回答');
    aiService.getSession.mockImplementation(async (id) => ({ session: session(id), messages: [] }));
    await useAIStore.getState().switchSession('B');
    aiService.getSession.mockRejectedValue(new Error('temporary read failure'));
    await options.onDone();
    stream.resolve();
    await send;

    expect(useAIStore.getState().currentSession._id).toBe('B');
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().messagesBySession.A).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: '原始问题', status: 'complete' }),
      expect.objectContaining({ role: 'assistant', content: '完整回答', status: 'complete' }),
    ]));
    expect(useAIStore.getState().sessionErrors.A).toMatch(/同步失败/);

    aiService.getSession.mockResolvedValue({ session: session('A'), messages: [] });
    await useAIStore.getState().switchSession('A');
    expect(useAIStore.getState().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: '原始问题' }),
      expect.objectContaining({ role: 'assistant', content: '完整回答' }),
    ]));
  });

  it('uses a later server answer for the same assistant id instead of a local regeneration fallback', async () => {
    const serverMessages = [
      { _id: 'question', role: 'user', content: '问题', status: 'complete' },
      { _id: 'answer', role: 'assistant', content: '服务端后续回答', status: 'complete' },
    ];
    useAIStore.setState({
      currentSession: session('B'),
      sessions: [session('A'), session('B')],
      messagesBySession: {
        A: [
          serverMessages[0],
          {
            _id: 'answer', role: 'assistant', content: '本地临时重生成回答', status: 'complete',
            turnId: 'regeneration-request', localFallback: true,
          },
        ],
      },
    });
    aiService.getSession.mockResolvedValue({ session: session('A'), messages: serverMessages });

    await useAIStore.getState().switchSession('A');

    expect(useAIStore.getState().messages).toEqual(serverMessages);
  });

  it('does not match a local interrupted turn to an older question with identical text', async () => {
    const sameTime = '2026-10-27T04:00:00.000Z';
    const serverMessages = [
      { _id: 'old-question', turnId: 'old-turn', role: 'user', content: '重复的问题', createdAt: sameTime },
      { _id: 'old-answer', turnId: 'old-turn', role: 'assistant', content: '旧回答', createdAt: sameTime },
    ];
    const localMessages = [
      ...serverMessages,
      {
        _id: 'temp-new-turn', turnId: 'new-turn', role: 'user', content: '重复的问题',
        createdAt: sameTime, status: 'interrupted', localFallback: true,
      },
      {
        _id: 'temp-assistant-new-turn', turnId: 'new-turn', role: 'assistant', content: '新回答的一部分',
        createdAt: sameTime, status: 'interrupted', localFallback: true,
      },
    ];
    useAIStore.setState({
      currentSession: session('B'),
      sessions: [session('A'), session('B')],
      messagesBySession: { A: localMessages },
    });
    aiService.getSession.mockResolvedValue({ session: session('A'), messages: serverMessages });

    await useAIStore.getState().switchSession('A');

    expect(useAIStore.getState().messages).toHaveLength(4);
    expect(useAIStore.getState().messages[0]).toEqual(serverMessages[0]);
    expect(useAIStore.getState().messages[2]).toMatchObject({ turnId: 'new-turn', content: '重复的问题' });
    expect(useAIStore.getState().messages[3]).toMatchObject({ turnId: 'new-turn', content: '新回答的一部分' });
  });

  it('continues a send in A while viewing B, then reloads A after completion', async () => {
    const stream = deferred();
    const serverMessages = [
      { _id: 'server-question', role: 'user', content: 'A 的原始问题', status: 'complete' },
      { _id: 'server-answer', role: 'assistant', content: 'A 的完整回答', status: 'complete' },
    ];
    let options;
    aiService.sendMessageStream.mockImplementation((_sessionId, _content, requestOptions) => {
      options = requestOptions;
      return stream.promise;
    });
    aiService.getSession.mockImplementation(async (id) => ({
      session: session(id),
      messages: id === 'A' ? serverMessages : [{ _id: 'b-question', role: 'user', content: 'B 的问题' }],
    }));
    useAIStore.setState({ currentSession: session('A'), sessions: [session('A'), session('B')] });

    const send = useAIStore.getState().sendMessage('A 的原始问题');
    options.onStart('A');
    options.onToken('先生成一段');
    await useAIStore.getState().switchSession('B');

    expect(useAIStore.getState().currentSession._id).toBe('B');
    expect(useAIStore.getState().messages).toEqual([{ _id: 'b-question', role: 'user', content: 'B 的问题' }]);
    expect(useAIStore.getState().streamingContent).toBe('先生成一段');

    options.onToken('，之后继续');
    await useAIStore.getState().switchSession('A');
    expect(useAIStore.getState().currentSession._id).toBe('A');
    expect(useAIStore.getState().messages).toContainEqual(expect.objectContaining({ content: 'A 的原始问题', status: 'pending' }));
    expect(useAIStore.getState().streamingContent).toBe('先生成一段，之后继续');

    await useAIStore.getState().switchSession('B');
    await options.onDone();
    stream.resolve();
    await send;
    expect(useAIStore.getState().currentSession._id).toBe('B');
    expect(useAIStore.getState().messages).toEqual([{ _id: 'b-question', role: 'user', content: 'B 的问题' }]);
    expect(useAIStore.getState().messagesBySession.A).toEqual(serverMessages);
    expect(useAIStore.getState().isLoading).toBe(false);

    await useAIStore.getState().switchSession('A');
    expect(useAIStore.getState().messages).toEqual(serverMessages);
  });

  it('preserves the original question and partial answer in A when stopping fails to sync', async () => {
    const stream = deferred();
    let options;
    aiService.sendMessageStream.mockImplementation((_sessionId, _content, requestOptions) => {
      options = requestOptions;
      return stream.promise;
    });
    useAIStore.setState({ currentSession: session('A'), sessions: [session('A'), session('B')] });

    const send = useAIStore.getState().sendMessage('需要保留的问题');
    options.onToken('已经生成的部分');
    aiService.getSession.mockImplementation(async (id) => ({ session: session(id), messages: [] }));
    await useAIStore.getState().switchSession('B');
    aiService.getSession.mockRejectedValue(new Error('temporary sync failure'));

    const stop = await useAIStore.getState().cancelActiveRequest();
    expect(stop).toBe(true);
    stream.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await send;

    expect(useAIStore.getState().currentSession._id).toBe('B');
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().messagesBySession.A).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: '需要保留的问题', status: 'interrupted' }),
      expect.objectContaining({ role: 'assistant', content: '已经生成的部分', status: 'interrupted' }),
    ]));
    expect(useAIStore.getState().isLoading).toBe(false);
  });

  it('regenerates A while viewing B and applies a failed-sync fallback to A only', async () => {
    const stream = deferred();
    const originalMessages = [
      { _id: 'a-question', role: 'user', content: 'A 的问题', status: 'complete' },
      { _id: 'a-answer', role: 'assistant', content: 'A 的原回答', status: 'complete' },
      { _id: 'b-question', role: 'user', content: '后续问题', status: 'interrupted' },
      { _id: 'b-answer', role: 'assistant', content: '后续部分回答', status: 'interrupted' },
    ];
    let options;
    aiService.regenerateMessageStream.mockImplementation((_sessionId, requestOptions) => {
      options = requestOptions;
      return stream.promise;
    });
    aiService.getSession.mockImplementation(async (id) => ({ session: session(id), messages: [] }));
    useAIStore.setState({
      currentSession: session('A'),
      sessions: [session('A'), session('B')],
      messages: originalMessages,
      messagesBySession: { A: originalMessages },
    });

    const regenerate = useAIStore.getState().regenerateMessage();
    await useAIStore.getState().switchSession('B');
    options.onToken('替换后的 A 回答');
    aiService.getSession.mockRejectedValue(new Error('temporary read failure'));
    await options.onDone();
    stream.resolve();
    await regenerate;

    expect(useAIStore.getState().currentSession._id).toBe('B');
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().messagesBySession.A[1]).toMatchObject({
      _id: 'a-answer', content: '替换后的 A 回答', status: 'complete',
    });
    expect(useAIStore.getState().messagesBySession.A.slice(2)).toEqual(originalMessages.slice(2));
  });

  it('keeps a completed regenerated answer visible when the final session sync fails', async () => {
    const originalMessages = [
      { _id: 'question', role: 'user', content: '问题', status: 'complete' },
      { _id: 'answer', role: 'assistant', content: '原回答', status: 'complete' },
    ];
    aiService.getSession.mockRejectedValue(new Error('temporary read failure'));
    aiService.regenerateMessageStream.mockImplementation(async (_sessionId, options) => {
      options.onToken('重新生成的完整回答');
      await options.onDone();
    });
    useAIStore.setState({ currentSession: session('A'), messages: originalMessages });

    await useAIStore.getState().regenerateMessage();

    expect(useAIStore.getState().messages.at(-1).content).toBe('重新生成的完整回答');
    expect(useAIStore.getState().error).toMatch(/同步失败/);
    expect(useAIStore.getState().isLoading).toBe(false);
  });

  it('keeps regeneration fallback on the complete answer when a later turn was interrupted', async () => {
    const messages = [
      { _id: 'a-user', role: 'user', content: '问题 A', status: 'complete' },
      { _id: 'a-answer', role: 'assistant', content: '回答 A', status: 'complete' },
      { _id: 'b-user', role: 'user', content: '问题 B', status: 'interrupted' },
      { _id: 'b-answer', role: 'assistant', content: '回答 B 的一部分', status: 'interrupted' },
    ];
    useAIStore.setState({ currentSession: session('A'), messages });
    aiService.getSession.mockRejectedValue(new Error('temporary sync failure'));
    aiService.regenerateMessageStream.mockImplementation(async (_id, options) => {
      options.onToken('重新生成 A');
      await options.onDone();
    });
    await useAIStore.getState().regenerateMessage();
    expect(useAIStore.getState().messages[1]).toMatchObject({ _id: 'a-answer', content: '重新生成 A', status: 'complete' });
    expect(useAIStore.getState().messages[3]).toEqual(messages[3]);
    expect(useAIStore.getState().messages[2]).toEqual(messages[2]);
  });

  it('does not let callbacks from a previous account restore its session', async () => {
    let callbacks;
    const stream = deferred();
    aiService.sendMessageStream.mockImplementation((_sessionId, _content, options) => {
      callbacks = options;
      return stream.promise;
    });
    useAIStore.setState({ currentSession: session('account-A') });

    const send = useAIStore.getState().sendMessage('问题');
    const controller = useAIStore.getState().activeRequestController;
    useAIStore.getState().resetForAccountChange();
    expect(controller.signal.aborted).toBe(true);
    callbacks.onToken('旧账号回复');
    stream.resolve();
    await send;

    expect(useAIStore.getState().currentSession).toBeNull();
    expect(useAIStore.getState().messages).toEqual([]);
    expect(useAIStore.getState().messagesBySession).toEqual({});
    expect(useAIStore.getState().streamingContent).toBe('');
  });
});
