import { create } from 'zustand';
import * as aiService from '../services/aiService';
import useCommentStore from './commentStore';
import usePostStore from './postStore';
import useUiStore from './uiStore';

const DEFAULT_AI_PERSONA = {
  role: '',
  persona: '',
  tone: '',
  directness: 'balanced',
  verbosity: 'medium',
  customInstruction: '',
};

const EMPTY_AI_PERSONA = {
  role: '',
  persona: '',
  tone: '',
  directness: '',
  verbosity: '',
  customInstruction: '',
};

const AI_PERSONA_FIELDS = Object.keys(EMPTY_AI_PERSONA);

export function findRegenerableAssistantIndex(messages) {
  return messages.findLastIndex((message) => message.role === 'assistant'
    && (message.status === undefined || message.status === 'complete'));
}

function withPersonaDefaults(persona = {}) {
  return {
    ...DEFAULT_AI_PERSONA,
    ...persona,
  };
}

function toPersonaDraft(persona = {}) {
  return {
    ...EMPTY_AI_PERSONA,
    ...persona,
  };
}

function normalizeDraftValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

function compactPersonaDraft(persona = {}) {
  return Object.entries(persona).reduce((result, [key, value]) => {
    const normalized = normalizeDraftValue(value);

    if (typeof normalized === 'string') {
      if (normalized) {
        result[key] = normalized;
      }
      return result;
    }

    if (normalized !== undefined && normalized !== null && normalized !== '') {
      result[key] = normalized;
    }

    return result;
  }, {});
}

function createDirtyPersonaPatch(persona = {}, dirtyFields = {}) {
  return Object.keys(dirtyFields).reduce((result, field) => {
    if (!dirtyFields[field]) {
      return result;
    }

    result[field] = normalizeDraftValue(persona[field]);
    return result;
  }, {});
}

function compactDefaultPersonaDraft(persona = {}) {
  const compacted = compactPersonaDraft(persona);

  return Object.entries(compacted).reduce((result, [key, value]) => {
    if (DEFAULT_AI_PERSONA[key] !== value) {
      result[key] = value;
    }
    return result;
  }, {});
}

function truncateText(value, maxLength = 240) {
  if (!value) return '';
  const text = String(value).trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function buildCommentsPreviewForContext(comments = []) {
  const preview = [];

  for (const comment of comments) {
    if (comment?.content) {
      preview.push(truncateText(comment.content));
    }

    if (Array.isArray(comment?.replies)) {
      for (const reply of comment.replies) {
        if (reply?.content) {
          preview.push(truncateText(reply.content));
        }
        if (preview.length >= 6) {
          return preview.slice(0, 6);
        }
      }
    }

    if (preview.length >= 6) {
      return preview.slice(0, 6);
    }
  }

  return preview.slice(0, 6);
}

function buildCurrentChatContext() {
  const { activePage } = useUiStore.getState();
  if (activePage !== 'detail') {
    return null;
  }

  const { selectedPost, getPostLikeView } = usePostStore.getState();
  if (!selectedPost?.id) {
    return null;
  }

  const postView = typeof getPostLikeView === 'function'
    ? getPostLikeView(selectedPost)
    : selectedPost;
  const { commentsMap, loadedPostIds } = useCommentStore.getState();
  const comments = commentsMap[selectedPost.id] || [];
  const commentsLoaded = Boolean(loadedPostIds[selectedPost.id]);
  const commentCount = Number(postView?.comments || 0);

  return {
    pageType: 'post_detail',
    currentPost: {
      title: truncateText(postView?.title || '', 120),
      content: truncateText(postView?.content || '', 2000),
      commentsPreview: buildCommentsPreviewForContext(comments),
      commentsLoaded,
      commentCount,
    },
  };
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let sessionSwitchGeneration = 0;
let accountGeneration = 0;

function updateSessionMessages(set, sessionId, updateMessages) {
  set((state) => {
    const isCurrentSession = (state.currentSession?._id || null) === (sessionId || null);
    const cachedMessages = sessionId
      ? state.messagesBySession[sessionId] || (isCurrentSession ? state.messages : [])
      : state.messages;
    const messages = updateMessages(cachedMessages);
    const messagesBySession = sessionId
      ? { ...state.messagesBySession, [sessionId]: messages }
      : state.messagesBySession;
    const sessionMessageRevisions = sessionId
      ? {
        ...state.sessionMessageRevisions,
        [sessionId]: (state.sessionMessageRevisions[sessionId] || 0) + 1,
      }
      : state.sessionMessageRevisions;

    return {
      messagesBySession,
      sessionMessageRevisions,
      ...(isCurrentSession ? { messages } : {}),
    };
  });
}

function updateSessionError(state, sessionId, error) {
  if (!sessionId) return { error };
  return {
    sessionErrors: { ...state.sessionErrors, [sessionId]: error },
    ...(state.currentSession?._id === sessionId ? { error } : {}),
  };
}

function mergeLocalFallbackMessages(serverMessages, cachedMessages) {
  const mergedMessages = [...serverMessages];

  for (const localMessage of cachedMessages) {
    const isTemporaryMessage = String(localMessage._id).startsWith('temp-');
    const isLocalFallback = localMessage.localFallback === true;
    if (!isTemporaryMessage && !isLocalFallback) continue;

    const isPresentOnServer = mergedMessages.some((serverMessage) => (
      (localMessage._id && serverMessage._id === localMessage._id)
      || (localMessage.turnId !== undefined && localMessage.turnId !== null
        && serverMessage.turnId === localMessage.turnId
        && serverMessage.role === localMessage.role)
    ));
    if (isPresentOnServer) continue;

    mergedMessages.push(localMessage);
  }

  return mergedMessages;
}

function preserveInterruptedTurn(messages, { requestId, userContent, partialContent, createdAt }) {
  const nextMessages = [...messages];
  let userMessageIndex = nextMessages.findIndex((message) => message.turnId === requestId && message.role === 'user');

  if (userMessageIndex < 0) {
    userMessageIndex = nextMessages.findIndex((message) => message._id === `temp-${requestId}`);
  }
  if (userMessageIndex < 0 && nextMessages.at(-1)?.role === 'user' && nextMessages.at(-1)?.content === userContent) {
    userMessageIndex = nextMessages.length - 1;
  }

  if (userMessageIndex < 0) {
    userMessageIndex = nextMessages.length;
    nextMessages.push({
      _id: `temp-${requestId}`,
      turnId: requestId,
      role: 'user',
      content: userContent,
      createdAt,
      status: 'interrupted',
      localFallback: true,
    });
  } else if (nextMessages[userMessageIndex].status !== 'complete') {
    nextMessages[userMessageIndex] = { ...nextMessages[userMessageIndex], status: 'interrupted', localFallback: true };
  }

  const assistantAfterQuestion = nextMessages.findIndex((message, index) => (
    index > userMessageIndex && message.role === 'assistant'
  ));
  if (assistantAfterQuestion >= 0) {
    nextMessages[assistantAfterQuestion] = {
      ...nextMessages[assistantAfterQuestion],
      content: partialContent || nextMessages[assistantAfterQuestion].content,
      status: 'interrupted',
      localFallback: true,
    };
  } else if (partialContent && !nextMessages.some((message) => message.turnId === requestId && message.role === 'assistant')) {
    nextMessages.push({
      _id: `temp-assistant-${requestId}`,
      turnId: requestId,
      role: 'assistant',
      content: partialContent,
      createdAt,
      status: 'interrupted',
      localFallback: true,
    });
  }

  return nextMessages;
}

function preserveCompletedTurn(messages, { requestId, userContent, answer, createdAt }) {
  const nextMessages = [...messages];
  let userMessageIndex = nextMessages.findIndex((message) => message.turnId === requestId && message.role === 'user');

  if (userMessageIndex < 0) {
    userMessageIndex = nextMessages.findIndex((message) => message._id === `temp-${requestId}`);
  }

  if (userMessageIndex < 0) {
    nextMessages.push({
      _id: `temp-${requestId}`,
      turnId: requestId,
      role: 'user',
      content: userContent,
      createdAt,
      status: 'complete',
      localFallback: true,
    });
  } else {
    nextMessages[userMessageIndex] = { ...nextMessages[userMessageIndex], status: 'complete' };
  }

  if (answer && !nextMessages.some((message) => message.turnId === requestId && message.role === 'assistant')) {
    nextMessages.push({
      _id: `temp-assistant-${requestId}`,
      turnId: requestId,
      role: 'assistant',
      content: answer,
      createdAt,
      status: 'complete',
      localFallback: true,
    });
  }

  return nextMessages;
}

function preserveRegeneratedAnswer(messages, content, requestId, createdAt) {
  if (!content) return messages;
  const nextMessages = [...messages];
  const assistantIndex = findRegenerableAssistantIndex(nextMessages);
  if (assistantIndex >= 0) {
    nextMessages[assistantIndex] = {
      ...nextMessages[assistantIndex],
      content,
      status: 'complete',
      turnId: requestId,
      localFallback: true,
    };
  } else {
    nextMessages.push({
      _id: `temp-assistant-${requestId}`,
      role: 'assistant',
      turnId: requestId,
      content,
      createdAt,
      status: 'complete',
      localFallback: true,
    });
  }
  return nextMessages;
}

const useAIStore = create((set, get) => ({
  // State
  sessions: [],
  currentSession: null,
  messages: [],
  messagesBySession: {},
  sessionMessageRevisions: {},
  sessionErrors: {},
  showSessionList: false,
  isLoading: false,
  isSessionSwitching: false,
  isPersonaViewOpen: false,
  isPersonaLoading: false,
  isPersonaSaving: false,
  personaDirty: false,
  personaDirtyFields: {},
  isStopping: false,
  defaultPersona: {},
  defaultEffectivePersona: { ...DEFAULT_AI_PERSONA },
  sessionPersona: {},
  effectivePersona: { ...DEFAULT_AI_PERSONA },
  personaDraft: { ...EMPTY_AI_PERSONA },
  activeRequestController: null,
  activeRequestId: null,
  activeRequestSessionId: null,
  toolStatus: null,
  streamingContent: '',
  error: null,

  // Actions
  fetchSessions: async () => {
    const generation = accountGeneration;
    try {
      const sessions = await aiService.getSessions();
      if (generation !== accountGeneration) return get().sessions;
      set({ sessions });
      return sessions;
    } catch (err) {
      if (generation === accountGeneration) set({ error: err.message });
      throw err;
    }
  },

  createSession: async () => {
    if (get().isLoading || get().isSessionSwitching) return null;
    const account = accountGeneration;
    const generation = ++sessionSwitchGeneration;
    set({ isSessionSwitching: true });
    try {
      const session = await aiService.createSession();
      if (generation !== sessionSwitchGeneration || account !== accountGeneration) return null;
      const { sessions } = get();
      set({
        sessions: [session, ...sessions],
        currentSession: session,
        messages: [],
        messagesBySession: { ...get().messagesBySession, [session._id]: [] },
        sessionMessageRevisions: { ...get().sessionMessageRevisions, [session._id]: 0 },
        error: null,
        showSessionList: false,
        sessionPersona: session.aiPersona || {},
        effectivePersona: withPersonaDefaults(session.effectivePersona),
        isSessionSwitching: false,
      });
      return session;
    } catch (err) {
      if (generation === sessionSwitchGeneration && account === accountGeneration) set({ error: err.message, isSessionSwitching: false });
      throw err;
    } finally {
      if (generation === sessionSwitchGeneration && get().isSessionSwitching) {
        set({ isSessionSwitching: false });
      }
    }
  },

  switchSession: async (sessionId) => {
    if (!sessionId) return false;
    const account = accountGeneration;
    const generation = ++sessionSwitchGeneration;
    const initialState = get();
    const selectedSession = initialState.sessions.find((item) => item._id === sessionId)
      || (initialState.currentSession?._id === sessionId ? initialState.currentSession : { _id: sessionId, title: '会话' });
    const cachedMessages = initialState.messagesBySession[sessionId]
      || (initialState.currentSession?._id === sessionId ? initialState.messages : []);
    const revisionAtStart = initialState.sessionMessageRevisions[sessionId] || 0;

    // Switch the visible session immediately so the previous conversation and its
    // stream can never remain on screen while the requested history is loading.
    set({
      currentSession: selectedSession,
      messages: cachedMessages,
      showSessionList: false,
      isSessionSwitching: true,
      sessionPersona: selectedSession.aiPersona || {},
      effectivePersona: withPersonaDefaults(selectedSession.effectivePersona),
      error: initialState.sessionErrors[sessionId] || null,
    });
    try {
      const { session, messages } = await aiService.getSession(sessionId);
      if (generation !== sessionSwitchGeneration || account !== accountGeneration) return false;
      set((state) => {
        if (state.currentSession?._id !== sessionId) return { isSessionSwitching: false };
        const hasNewerLocalMessages = (state.sessionMessageRevisions[sessionId] || 0) !== revisionAtStart;
        const activeRequestOwnsSession = state.isLoading && state.activeRequestSessionId === sessionId;
        const cachedMessagesForSession = state.messagesBySession[sessionId] || state.messages;
        const nextMessages = hasNewerLocalMessages || activeRequestOwnsSession
          ? cachedMessagesForSession
          : mergeLocalFallbackMessages(messages, cachedMessagesForSession);
        return {
          currentSession: session,
          messages: nextMessages,
          messagesBySession: { ...state.messagesBySession, [sessionId]: nextMessages },
          sessionMessageRevisions: {
            ...state.sessionMessageRevisions,
            [sessionId]: hasNewerLocalMessages || activeRequestOwnsSession
              ? state.sessionMessageRevisions[sessionId] || 0
              : (state.sessionMessageRevisions[sessionId] || 0) + 1,
          },
          showSessionList: false,
          sessionPersona: session.aiPersona || {},
          effectivePersona: withPersonaDefaults(session.effectivePersona),
          isSessionSwitching: false,
          error: state.sessionErrors[sessionId] || null,
        };
      });
      return true;
    } catch (err) {
      if (generation === sessionSwitchGeneration && account === accountGeneration) {
        set((state) => state.currentSession?._id === sessionId
          ? { error: err.message, isSessionSwitching: false }
          : { isSessionSwitching: false });
      }
      return false;
    } finally {
      if (generation === sessionSwitchGeneration && account === accountGeneration && get().isSessionSwitching) {
        set({ isSessionSwitching: false });
      }
    }
  },

  deleteSession: async (sessionId) => {
    if (get().isLoading || get().isSessionSwitching) return false;
    const account = accountGeneration;
    const generation = ++sessionSwitchGeneration;
    set({ isSessionSwitching: true });
    try {
      await aiService.deleteSession(sessionId);
      if (generation !== sessionSwitchGeneration || account !== accountGeneration) return false;
      const { sessions, currentSession } = get();
      const newSessions = sessions.filter(s => s._id !== sessionId);
      const deletingCurrent = currentSession?._id === sessionId;
      set({
        sessions: newSessions,
        messagesBySession: Object.fromEntries(Object.entries(get().messagesBySession).filter(([id]) => id !== sessionId)),
        sessionMessageRevisions: Object.fromEntries(Object.entries(get().sessionMessageRevisions).filter(([id]) => id !== sessionId)),
        sessionErrors: Object.fromEntries(Object.entries(get().sessionErrors).filter(([id]) => id !== sessionId)),
        ...(deletingCurrent ? { currentSession: null, messages: [] } : {}),
        isSessionSwitching: false,
      });

      if (deletingCurrent) {
        if (newSessions.length > 0) {
          await get().switchSession(newSessions[0]._id);
        } else {
          await get().createSession();
        }
      }
      return true;
    } catch (err) {
      if (generation === sessionSwitchGeneration && account === accountGeneration) set({ error: err.message, isSessionSwitching: false });
      return false;
    } finally {
      if (generation === sessionSwitchGeneration && get().isSessionSwitching) {
        set({ isSessionSwitching: false });
      }
    }
  },

  sendMessage: async (content) => {
    const state = get();
    if (state.isLoading || state.isSessionSwitching) return false;

    const { currentSession, messages } = state;
    const requestId = createRequestId();
    const requestAccount = accountGeneration;
    const controller = new AbortController();
    const context = buildCurrentChatContext();
    let boundSessionId = currentSession?._id || null;
    const createdAt = new Date().toISOString();
    const tempUserMessage = {
      _id: `temp-${requestId}`,
      turnId: requestId,
      role: 'user',
      content,
      createdAt,
      status: 'pending',
    };
    let requestMessages = [...messages, tempUserMessage];
    const ownsRequest = () => {
      const current = get();
      return requestAccount === accountGeneration && current.activeRequestId === requestId;
    };

    set((latest) => {
      const isCurrentOrigin = (latest.currentSession?._id || null) === (boundSessionId || null);
      const messagesBySession = boundSessionId
        ? { ...latest.messagesBySession, [boundSessionId]: requestMessages }
        : latest.messagesBySession;
      const sessionMessageRevisions = boundSessionId
        ? {
          ...latest.sessionMessageRevisions,
          [boundSessionId]: (latest.sessionMessageRevisions[boundSessionId] || 0) + 1,
        }
        : latest.sessionMessageRevisions;
      const sessionErrors = boundSessionId
        ? { ...latest.sessionErrors, [boundSessionId]: null }
        : latest.sessionErrors;

      return {
        ...(isCurrentOrigin ? { messages: requestMessages } : {}),
        messagesBySession,
        sessionMessageRevisions,
        sessionErrors,
        isLoading: true,
        isStopping: false,
        streamingContent: '',
        toolStatus: null,
        activeRequestController: controller,
        activeRequestId: requestId,
        activeRequestSessionId: boundSessionId,
        error: null,
      };
    });

    try {
      await aiService.sendMessageStream(boundSessionId, content, {
        signal: controller.signal,
        context,
        requestId,
        onStart: (sessionId) => {
          if (!ownsRequest() || (boundSessionId && boundSessionId !== sessionId)) return;
          const initialSessionId = boundSessionId;
          boundSessionId = sessionId;
          set((latest) => {
            if (latest.activeRequestId !== requestId) return latest;
            const priorMessages = initialSessionId
              ? latest.messagesBySession[initialSessionId] || requestMessages
              : requestMessages;
            requestMessages = priorMessages;
            const isCurrentOrigin = !latest.currentSession?._id || latest.currentSession._id === initialSessionId;
            return {
              currentSession: isCurrentOrigin
                ? {
                  ...(latest.currentSession || {}),
                  _id: sessionId,
                  title: latest.currentSession?.title || '新会话',
                }
                : latest.currentSession,
              ...(isCurrentOrigin ? { messages: priorMessages } : {}),
              messagesBySession: { ...latest.messagesBySession, [sessionId]: priorMessages },
              sessionMessageRevisions: {
                ...latest.sessionMessageRevisions,
                [sessionId]: (latest.sessionMessageRevisions[sessionId] || 0) + 1,
              },
              activeRequestSessionId: sessionId,
            };
          });
        },
        onToolCall: (tool) => {
          if (ownsRequest()) set({ toolStatus: `正在调用 ${tool}...` });
        },
        onToolResult: () => {
          if (ownsRequest()) set({ toolStatus: null });
        },
        onToken: (token) => {
          if (ownsRequest()) set((latest) => ({ streamingContent: latest.streamingContent + token }));
        },
        onDone: async () => {
          if (!ownsRequest()) return;
          const answer = get().streamingContent;
          const synced = await get().syncCurrentSessionAfterStream(boundSessionId, requestId);
          if (!synced && requestAccount === accountGeneration && !get().activeRequestId) {
            updateSessionMessages(set, boundSessionId, (originMessages) => preserveCompletedTurn(originMessages, {
              requestId,
              userContent: content,
              answer,
              createdAt,
            }));
            set((latest) => updateSessionError(latest, boundSessionId, '回答已生成，但同步失败；请稍后重新打开会话'));
          }
        },
        onError: async (message) => {
          if (!ownsRequest()) return;
          const partial = get().streamingContent;
          const errorMessage = get().isStopping
            ? '本轮已中断，已保留已生成内容'
            : message || '生成失败';
          await get().syncCurrentSessionAfterStream(boundSessionId, requestId, errorMessage);
          if (requestAccount !== accountGeneration || get().activeRequestId) return;
          updateSessionMessages(set, boundSessionId, (originMessages) => preserveInterruptedTurn(originMessages, {
            requestId,
            userContent: content,
            partialContent: partial,
            createdAt,
          }));
        },
      });
    } catch (err) {
      if (!ownsRequest()) return;
      const partial = get().streamingContent;
      const errorMessage = err.name === 'AbortError'
        ? '本轮已中断，已保留已生成内容'
        : err.message;
      if (err.name === 'AbortError') {
        await get().syncCurrentSessionAfterAbort(boundSessionId, requestId, errorMessage);
      } else {
        await get().syncCurrentSessionAfterStream(boundSessionId, requestId, errorMessage);
      }
      if (requestAccount !== accountGeneration || get().activeRequestId) return;
      updateSessionMessages(set, boundSessionId, (originMessages) => preserveInterruptedTurn(originMessages, {
        requestId,
        userContent: content,
        partialContent: partial,
        createdAt,
      }));
    }
    return true;
  },

  regenerateMessage: async () => {
    const state = get();
    if (state.isLoading || state.isSessionSwitching || !state.currentSession) return false;

    const { currentSession } = state;
    const requestId = createRequestId();
    const requestAccount = accountGeneration;
    const controller = new AbortController();
    const boundSessionId = currentSession._id;
    const createdAt = new Date().toISOString();
    const ownsRequest = () => requestAccount === accountGeneration && get().activeRequestId === requestId;

    set({
      isLoading: true, isStopping: false, streamingContent: '',
      toolStatus: null, activeRequestController: controller, activeRequestId: requestId,
      activeRequestSessionId: boundSessionId,
      sessionErrors: { ...get().sessionErrors, [boundSessionId]: null },
      error: null,
    });

    try {
      await aiService.regenerateMessageStream(boundSessionId, {
        signal: controller.signal,
        requestId,
        onStart: (sessionId) => {
          if (!ownsRequest() || sessionId !== boundSessionId) return;
        },
        onToolCall: (tool) => {
          if (ownsRequest()) set({ toolStatus: `正在调用 ${tool}...` });
        },
        onToolResult: () => {
          if (ownsRequest()) set({ toolStatus: null });
        },
        onToken: (token) => {
          if (ownsRequest()) set((latest) => ({ streamingContent: latest.streamingContent + token }));
        },
        onDone: async () => {
          if (!ownsRequest()) return;
          const answer = get().streamingContent;
          const synced = await get().syncCurrentSessionAfterStream(boundSessionId, requestId);
          if (!synced && requestAccount === accountGeneration && !get().activeRequestId) {
            updateSessionMessages(set, boundSessionId, (originMessages) => preserveRegeneratedAnswer(
              originMessages,
              answer,
              requestId,
              createdAt
            ));
            set((latest) => updateSessionError(latest, boundSessionId, '新回答已生成，但同步失败；请稍后重新打开会话'));
          }
        },
        onError: async (message) => {
          if (!ownsRequest()) return;
          await get().syncCurrentSessionAfterStream(boundSessionId, requestId, message || '生成失败，原回答已保留');
        },
      });
    } catch (err) {
      if (!ownsRequest()) return;
      const errorMessage = err.name === 'AbortError'
        ? '本轮已中断，原回答已保留'
        : err.message;
      if (err.name === 'AbortError') {
        await get().syncCurrentSessionAfterAbort(boundSessionId, requestId, errorMessage);
      } else {
        await get().syncCurrentSessionAfterStream(boundSessionId, requestId, errorMessage);
      }
    }
    return true;
  },

  toggleSessionList: () => {
    set((state) => ({ showSessionList: !state.showSessionList }));
  },

  closeSessionList: () => {
    set({ showSessionList: false });
  },

  resetForAccountChange: () => {
    accountGeneration += 1;
    sessionSwitchGeneration += 1;
    const { activeRequestController, activeRequestId } = get();
    if (activeRequestController) {
      activeRequestController.abort();
      if (activeRequestId) aiService.cancelRequest(activeRequestId).catch(() => {});
    }

    set({
      sessions: [], currentSession: null, messages: [], showSessionList: false,
      messagesBySession: {}, sessionMessageRevisions: {}, sessionErrors: {},
      isLoading: false, isSessionSwitching: false, isStopping: false,
      isPersonaViewOpen: false, isPersonaLoading: false, isPersonaSaving: false,
      personaDirty: false, personaDirtyFields: {},
      defaultPersona: {}, defaultEffectivePersona: { ...DEFAULT_AI_PERSONA },
      sessionPersona: {}, effectivePersona: { ...DEFAULT_AI_PERSONA },
      personaDraft: { ...EMPTY_AI_PERSONA },
      activeRequestController: null, activeRequestId: null, activeRequestSessionId: null,
      toolStatus: null, streamingContent: '', error: null,
    });
  },

  cancelActiveRequest: async () => {
    const controller = get().activeRequestController;
    const requestId = get().activeRequestId;
    if (!controller || get().isStopping) return false;

    set({ isStopping: true });
    try {
      const result = await aiService.cancelRequest(requestId);
      if (!result?.cancelled) {
        set((state) => state.activeRequestId === requestId
          ? { isStopping: false, error: '当前请求尚未就绪，请稍后再试' }
          : state);
        return false;
      }
      controller.abort();
      return true;
    } catch (err) {
      set((state) => state.activeRequestId === requestId
        ? { isStopping: false, error: err.message || '停止请求失败，请重试' }
        : state);
      return false;
    }
  },

  syncCurrentSessionAfterAbort: async (sessionIdOverride = null, requestId = null, errorMessage = '本轮已中断') => {
    const state = get();
    const sessionId = sessionIdOverride || (requestId
      ? state.activeRequestSessionId
      : state.currentSession?._id) || null;
    const generation = accountGeneration;
    const canApply = () => (
      generation === accountGeneration
      && (!requestId || get().activeRequestId === requestId)
    );

    if (!sessionId) {
      set((state) => canApply() ? ({
        isLoading: false,
        isStopping: false,
        streamingContent: '',
        toolStatus: null,
        activeRequestController: null,
        activeRequestId: null,
        activeRequestSessionId: null,
        ...updateSessionError(state, null, errorMessage),
      }) : state);
      return false;
    }

    try {
      const [sessionData, sessions] = await Promise.all([
        aiService.getSession(sessionId),
        aiService.getSessions(),
      ]);
      if (!canApply()) return false;

      set((state) => ({
        sessions,
        messagesBySession: { ...state.messagesBySession, [sessionId]: sessionData.messages },
        sessionMessageRevisions: {
          ...state.sessionMessageRevisions,
          [sessionId]: (state.sessionMessageRevisions[sessionId] || 0) + 1,
        },
        ...(state.currentSession?._id === sessionId ? {
          currentSession: sessionData.session,
          messages: sessionData.messages,
          sessionPersona: sessionData.session.aiPersona || {},
          effectivePersona: withPersonaDefaults(sessionData.session.effectivePersona),
        } : {}),
        isLoading: false,
        isStopping: false,
        streamingContent: '',
        toolStatus: null,
        activeRequestController: null,
        activeRequestId: null,
        activeRequestSessionId: null,
        ...updateSessionError(state, sessionId, errorMessage),
      }));
      return true;
    } catch {
      set((state) => canApply() ? ({
        isLoading: false,
        isStopping: false,
        streamingContent: '',
        toolStatus: null,
        activeRequestController: null,
        activeRequestId: null,
        activeRequestSessionId: null,
        ...updateSessionError(state, sessionId, errorMessage),
      }) : state);
      return false;
    }
  },

  syncCurrentSessionAfterStream: async (sessionIdOverride = null, requestId = null, errorMessage = null) => {
    const state = get();
    const sessionId = sessionIdOverride || (requestId
      ? state.activeRequestSessionId
      : state.currentSession?._id) || null;
    const generation = accountGeneration;
    const canApply = () => (
      generation === accountGeneration
      && (!requestId || get().activeRequestId === requestId)
    );
    if (!sessionId) {
      if (canApply()) set((state) => ({
        isLoading: false,
        isStopping: false,
        streamingContent: '',
        toolStatus: null,
        activeRequestController: null,
        activeRequestId: null,
        activeRequestSessionId: null,
        ...updateSessionError(state, null, errorMessage),
      }));
      return false;
    }
    try {
      const [sessionData, sessions] = await Promise.all([
        aiService.getSession(sessionId),
        aiService.getSessions(),
      ]);
      if (!canApply()) return false;
      set((state) => ({
        sessions,
        messagesBySession: { ...state.messagesBySession, [sessionId]: sessionData.messages },
        sessionMessageRevisions: {
          ...state.sessionMessageRevisions,
          [sessionId]: (state.sessionMessageRevisions[sessionId] || 0) + 1,
        },
        ...(state.currentSession?._id === sessionId ? {
          currentSession: sessionData.session,
          messages: sessionData.messages,
          sessionPersona: sessionData.session.aiPersona || {},
          effectivePersona: withPersonaDefaults(sessionData.session.effectivePersona),
        } : {}),
        isLoading: false,
        streamingContent: '',
        toolStatus: null,
        isStopping: false,
        activeRequestController: null,
        activeRequestId: null,
        activeRequestSessionId: null,
        ...updateSessionError(state, sessionId, errorMessage),
      }));
      return true;
    } catch {
      if (canApply()) set((state) => ({
        isLoading: false,
        isStopping: false,
        streamingContent: '',
        toolStatus: null,
        activeRequestController: null,
        activeRequestId: null,
        activeRequestSessionId: null,
        ...updateSessionError(state, sessionId, errorMessage),
      }));
      return false;
    }
  },

  openPersonaSettings: async () => {
    const { currentSession } = get();
    const generation = sessionSwitchGeneration;

    set({
      isPersonaViewOpen: true,
      isPersonaLoading: true,
      isPersonaSaving: false,
      personaDirty: false,
      personaDirtyFields: {},
      showSessionList: false,
      error: null,
    });

    try {
      const defaultData = await aiService.getProfile();
      if (generation !== sessionSwitchGeneration) return null;
      let sessionData = null;

      if (currentSession?._id) {
        sessionData = await aiService.getSessionPersona(currentSession._id);
        if (generation !== sessionSwitchGeneration) return null;
      }

      const effectivePersona = withPersonaDefaults(
        sessionData?.effectivePersona || defaultData.effectivePersona
      );

      set((state) => ({
        defaultPersona: defaultData.persona || {},
        defaultEffectivePersona: withPersonaDefaults(defaultData.effectivePersona),
        sessionPersona: sessionData?.persona || {},
        effectivePersona,
        personaDraft: toPersonaDraft(effectivePersona),
        isPersonaLoading: false,
        currentSession: state.currentSession
          ? {
            ...state.currentSession,
            aiPersona: sessionData?.persona || state.currentSession.aiPersona || {},
            effectivePersona,
          }
          : state.currentSession,
      }));
    } catch (err) {
      if (generation !== sessionSwitchGeneration) return null;
      set({
        isPersonaLoading: false,
        error: err.message,
      });
      throw err;
    }
  },

  closePersonaSettings: () => {
    set({
      isPersonaViewOpen: false,
      isPersonaLoading: false,
      isPersonaSaving: false,
      personaDirty: false,
      personaDirtyFields: {},
    });
  },

  updatePersonaField: (field, value) => {
    set((state) => ({
      personaDraft: {
        ...state.personaDraft,
        [field]: value,
      },
      personaDirty: true,
      personaDirtyFields: {
        ...state.personaDirtyFields,
        [field]: true,
      },
    }));
  },

  resetPersonaDraft: () => {
    set({
      personaDraft: { ...EMPTY_AI_PERSONA },
      personaDirty: true,
      personaDirtyFields: AI_PERSONA_FIELDS.reduce((result, field) => {
        result[field] = true;
        return result;
      }, {}),
    });
  },

  saveDefaultPersona: async () => {
    const { currentSession, defaultEffectivePersona, personaDraft, personaDirtyFields } = get();
    const generation = sessionSwitchGeneration;

    set({ isPersonaSaving: true, error: null });

    try {
      const nextDefaultDraft = { ...defaultEffectivePersona };
      for (const field of Object.keys(personaDirtyFields)) {
        nextDefaultDraft[field] = personaDraft[field];
      }

      const profile = await aiService.updateProfile(compactDefaultPersonaDraft(nextDefaultDraft));
      if (generation !== sessionSwitchGeneration) return null;
      let nextState = {
        defaultPersona: profile.persona || {},
        defaultEffectivePersona: withPersonaDefaults(profile.effectivePersona),
        isPersonaSaving: false,
        personaDirty: false,
        personaDirtyFields: {},
      };

      if (currentSession?._id) {
        const sessionData = await aiService.getSessionPersona(currentSession._id);
        if (generation !== sessionSwitchGeneration) return null;
        const effectivePersona = withPersonaDefaults(sessionData.effectivePersona);

        nextState = {
          ...nextState,
          sessionPersona: sessionData.persona || {},
          effectivePersona,
          personaDraft: toPersonaDraft(effectivePersona),
          currentSession: {
            ...currentSession,
            aiPersona: sessionData.persona || {},
            effectivePersona,
          },
          sessions: get().sessions.map((session) => (
            session._id === currentSession._id
              ? {
                ...session,
                hasPersonaOverride: Boolean(sessionData.persona && Object.keys(sessionData.persona).length > 0),
              }
              : session
          )),
        };
      } else {
        nextState = {
          ...nextState,
          effectivePersona: withPersonaDefaults(profile.effectivePersona),
          personaDraft: toPersonaDraft(profile.effectivePersona),
        };
      }

      set(nextState);
      return nextState;
    } catch (err) {
      if (generation !== sessionSwitchGeneration) return null;
      set({ isPersonaSaving: false, error: err.message });
      throw err;
    }
  },

  saveSessionPersona: async () => {
    const { currentSession, personaDraft, personaDirtyFields } = get();
    if (!currentSession?._id) return null;
    const generation = sessionSwitchGeneration;

    set({ isPersonaSaving: true, error: null });

    try {
      const result = await aiService.updateSessionPersona(
        currentSession._id,
        createDirtyPersonaPatch(personaDraft, personaDirtyFields)
      );
      if (generation !== sessionSwitchGeneration) return null;
      const effectivePersona = withPersonaDefaults(result.effectivePersona);

      set({
        sessionPersona: result.persona || {},
        effectivePersona,
        personaDraft: toPersonaDraft(effectivePersona),
        currentSession: {
          ...currentSession,
          aiPersona: result.persona || {},
          effectivePersona,
        },
        sessions: get().sessions.map((session) => (
          session._id === currentSession._id
            ? {
              ...session,
              hasPersonaOverride: Boolean(result.persona && Object.keys(result.persona).length > 0),
            }
            : session
        )),
        isPersonaSaving: false,
        personaDirty: false,
        personaDirtyFields: {},
      });

      return result;
    } catch (err) {
      if (generation !== sessionSwitchGeneration) return null;
      set({ isPersonaSaving: false, error: err.message });
      throw err;
    }
  },

  clearError: () => {
    set((state) => ({
      error: null,
      ...(state.currentSession?._id
        ? { sessionErrors: { ...state.sessionErrors, [state.currentSession._id]: null } }
        : {}),
    }));
  },
}));

export default useAIStore;
