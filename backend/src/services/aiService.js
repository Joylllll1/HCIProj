import AISession from '../models/AISession.js';
import AIMessage from '../models/AIMessage.js';
import AppError from '../utils/AppError.js';
import { buildSystemPrompt } from './aiPromptBuilder.js';
import { resolveEffectivePersona } from './aiPersonaService.js';
import { runToolLoop } from './llm/toolLoop.js';
import { shouldRoundtripReasoning } from './llm/client.js';
import { sseDone, sseStart, sseToken, sseToolCall, sseToolResult } from './llm/sseEvents.js';
import { executeTool } from './tools/index.js';

const MAX_CONTEXT_MESSAGES = 20; // 保留最近 20 条消息作为上下文
const MAX_SESSION_TITLE_LENGTH = 20;
const CURRENT_POST_REFERENCE_PATTERN = /(这个帖子|这条帖子|本帖|这篇帖子|评论区|楼主)/;
const COMMENT_ANALYSIS_PATTERN = /(评论区|评论里|评论|回复|吵什么|哪几派|争论|观点|看法)/;
const STRONG_REALTIME_QUERY_PATTERN = /(今天|今日|最新|最近|刚刚|实时|新闻|热点|热搜|天气|比分|赛果|股价|汇率|政策|发布会|通报|声明|纪念日|节日)/;
const SELECT_POST_DETAIL_REPLY = '请先进入某个帖子详情页，再让我帮你总结这个帖子、分析评论区，或者解释这条帖子在说什么。';
const LOAD_COMMENTS_FIRST_REPLY = '请先等待帖子评论加载完成，再让我分析评论区在吵什么或总结主要观点。';
const NO_COMMENTS_TO_ANALYZE_REPLY = '这条帖子目前还没有可分析的评论内容。';

// 生成会话标题（基于首条消息）
function generateSessionTitle(content) {
  const trimmed = content.trim();
  if (trimmed.length <= MAX_SESSION_TITLE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_SESSION_TITLE_LENGTH - 3)}...`;
}

function serializeSession(session, effectivePersona) {
  const rawPersona = session?.aiPersona
    ? typeof session.aiPersona.toObject === 'function'
      ? session.aiPersona.toObject()
      : session.aiPersona
    : null;

  return {
    _id: session._id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    aiPersona: rawPersona,
    effectivePersona,
  };
}

function truncateText(value, maxLength = 600) {
  if (!value) return '';
  const text = String(value).trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function getCurrentDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
}

function normalizeChatContext(context) {
  if (context?.pageType !== 'post_detail' || !context.currentPost) {
    return null;
  }

  const { currentPost } = context;
  return {
    pageType: 'post_detail',
    currentPost: {
      title: truncateText(currentPost.title || '', 120),
      content: truncateText(currentPost.content || '', 1200),
      commentsPreview: Array.isArray(currentPost.commentsPreview)
        ? currentPost.commentsPreview
          .filter(Boolean)
          .slice(0, 6)
          .map((comment) => truncateText(comment, 240))
        : [],
      commentsLoaded: Boolean(currentPost.commentsLoaded),
      commentCount: Math.max(0, Number(currentPost.commentCount || 0)),
    },
  };
}

function buildCurrentPostContextMessage(context) {
  const normalizedContext = normalizeChatContext(context);
  if (!normalizedContext) {
    return null;
  }

  const { currentPost } = normalizedContext;
  const lines = [
    '当前页面上下文：用户正在查看一个帖子详情页。',
    '如果用户提到“这个帖子”“这条帖子”“本帖”“评论区”，默认指当前这条帖子。',
    `帖子标题：${truncateText(currentPost.title || '（无标题）', 120)}`,
    `帖子正文：${truncateText(currentPost.content || '（无正文）', 1200)}`,
  ];

  if (!currentPost.commentsLoaded) {
    lines.push('评论摘录：当前尚未加载评论内容。');
  } else if (Array.isArray(currentPost.commentsPreview) && currentPost.commentsPreview.length > 0) {
    lines.push(
      '评论摘录：',
      ...currentPost.commentsPreview.slice(0, 6).map((comment, index) => `${index + 1}. ${truncateText(comment, 240)}`)
    );
  } else if (currentPost.commentCount > 0) {
    lines.push('评论摘录：当前已知有评论，但暂未提供可分析的评论摘录。');
  } else {
    lines.push('评论摘录：当前没有评论。');
  }

  return lines.join('\n');
}

function requiresCurrentPostContext(content) {
  return CURRENT_POST_REFERENCE_PATTERN.test(content || '');
}

function requiresCommentAnalysis(content) {
  return COMMENT_ANALYSIS_PATTERN.test(content || '');
}

function resolveContextualReply(content, context) {
  const normalizedContext = normalizeChatContext(context);

  if (!requiresCurrentPostContext(content)) {
    return null;
  }

  if (!normalizedContext) {
    return SELECT_POST_DETAIL_REPLY;
  }

  if (requiresCommentAnalysis(content)) {
    if (!normalizedContext.currentPost.commentsLoaded) {
      return LOAD_COMMENTS_FIRST_REPLY;
    }
    if (
      normalizedContext.currentPost.commentCount === 0
      || normalizedContext.currentPost.commentsPreview.length === 0
    ) {
      return NO_COMMENTS_TO_ANALYZE_REPLY;
    }
  }

  return null;
}

function resolveMessageContext(message) {
  return normalizeChatContext(message?.contextSnapshot);
}

function shouldPrefetchWebSearch(content) {
  return STRONG_REALTIME_QUERY_PATTERN.test(content || '');
}

async function maybePrefetchWebSearch({ messages, content, signal, emitEvent }) {
  if (!shouldPrefetchWebSearch(content)) {
    return { messages, initialToolCallCount: 0 };
  }

  const args = { query: content };
  console.log('[ai] prefetch web_search triggered:', args.query);

  if (emitEvent) {
    emitEvent(sseToolCall('web_search', args));
  }

  const toolResult = await executeTool('web_search', args, signal).catch((error) => ({
    results: [],
    note: error?.message || '暂时没有拿到可靠的最新结果',
  }));
  console.log('[ai] prefetch web_search result:', JSON.stringify({
    query: args.query,
    resultCount: Array.isArray(toolResult?.results) ? toolResult.results.length : 0,
    note: toolResult?.note || '',
    firstTitle: toolResult?.results?.[0]?.title || '',
  }));

  if (emitEvent) {
    emitEvent(sseToolResult('web_search'));
  }

  return {
    initialToolCallCount: 1,
    messages: [
      ...messages,
      {
        role: 'system',
        content: [
          '系统已为当前强时效问题预先执行一次联网搜索。',
          `搜索关键词：${content}`,
          '以下是 web_search 的结构化结果，请优先基于这些结果回答；若仍不足，再决定是否继续调用工具。',
          JSON.stringify(toolResult),
        ].join('\n'),
      },
    ],
  };
}

function toLLMMessage(message) {
  const llmMessage = {
    role: message.role,
    content: message.content,
  };

  if (
    shouldRoundtripReasoning()
    && message.role === 'assistant'
    && typeof message.reasoningContent === 'string'
    && message.reasoningContent.trim()
  ) {
    llmMessage.reasoning_content = message.reasoningContent;
  }

  return llmMessage;
}

async function saveAndStreamStaticAssistantReply({ session, effectivePersona, content, emitEvent }) {
  if (emitEvent) {
    emitEvent(sseToken(content));
  }

  const aiMessage = await AIMessage.create({
    session: session._id,
    role: 'assistant',
    content,
    reasoningContent: '',
  });

  session.updatedAt = new Date();
  await session.save();

  if (emitEvent) {
    emitEvent(sseDone());
  }

  return {
    session: serializeSession(session, effectivePersona),
    assistantMessage: {
      _id: aiMessage._id,
      role: aiMessage.role,
      content: aiMessage.content,
      createdAt: aiMessage.createdAt,
    },
  };
}

function emitStaticAssistantReply(content, emitEvent) {
  if (emitEvent) {
    emitEvent(sseToken(content));
    emitEvent(sseDone());
  }
}

function throwAbortErrorIfNeeded(signal) {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

async function cleanupAbortedUserTurn({ session, userMessage, createdNewSession }) {
  console.log('[ai] cleaning aborted user turn:', JSON.stringify({
    sessionId: session._id.toString(),
    userMessageId: userMessage._id.toString(),
    createdNewSession,
  }));
  await AIMessage.deleteOne({
    _id: userMessage._id,
    session: session._id,
    role: 'user',
  });

  if (!createdNewSession) {
    return;
  }

  const remainingMessages = await AIMessage.countDocuments({ session: session._id });
  if (remainingMessages === 0) {
    console.log('[ai] deleting empty session after abort:', session._id.toString());
    await AISession.deleteOne({ _id: session._id });
  }
}

// 发送消息并获取 AI 回复
export const sendMessage = async (userId, sessionId, content, options = {}) => {
  // 获取或创建会话
  let session;
  let createdNewSession = false;
  if (sessionId) {
    session = await AISession.findOne({ _id: sessionId, user: userId });
    if (!session) {
      throw new AppError('会话不存在', 404, 'SESSION_NOT_FOUND');
    }
  } else {
    // 自动创建新会话
    session = await AISession.create({
      user: userId,
      title: generateSessionTitle(content),
    });
    createdNewSession = true;
  }

  // 更新会话标题（如果是第一条消息且标题是默认值）
  if (session.title === '新会话') {
    const messageCount = await AIMessage.countDocuments({ session: session._id });
    if (messageCount === 0) {
      session.title = generateSessionTitle(content);
      await session.save();
    }
  }

  if (options.emitEvent) {
    options.emitEvent(sseStart(session._id.toString()));
  }

  // 保存用户消息
  const userMessage = await AIMessage.create({
    session: session._id,
    role: 'user',
    content,
    contextSnapshot: normalizeChatContext(options.context),
  });
  console.log('[ai] user message saved:', JSON.stringify({
    sessionId: session._id.toString(),
    userMessageId: userMessage._id.toString(),
    createdNewSession,
  }));

  const effectivePersona = await resolveEffectivePersona(userId, session);
  const contextualReply = resolveContextualReply(content, options.context);
  const currentPostContextMessage = buildCurrentPostContextMessage(options.context);
  const currentDate = getCurrentDateString();

  if (contextualReply) {
    const staticResult = await saveAndStreamStaticAssistantReply({
      session,
      effectivePersona,
      content: contextualReply,
      emitEvent: options.emitEvent,
    });

    return {
      session: staticResult.session,
      userMessage: {
        _id: userMessage._id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: staticResult.assistantMessage,
    };
  }

  // 获取历史消息作为上下文
  const historyMessages = await AIMessage.find({ session: session._id })
    .sort({ createdAt: -1 })
    .limit(MAX_CONTEXT_MESSAGES)
    .lean();

  // 按时间顺序排列
  historyMessages.reverse();

  const llmMessages = [
    { role: 'system', content: buildSystemPrompt(effectivePersona, currentDate) },
    ...(currentPostContextMessage ? [{ role: 'system', content: currentPostContextMessage }] : []),
    ...historyMessages.map(toLLMMessage),
  ];
  const prefetchedInput = await maybePrefetchWebSearch({
    messages: llmMessages,
    content,
    signal: options.signal,
    emitEvent: options.emitEvent,
  });

  // 调用 LLM with tool loop
  let aiContent;
  let aiReasoningContent = '';
  try {
    const result = await runToolLoop({
      messages: prefetchedInput.messages,
      signal: options.signal,
      writeEvent: options.emitEvent || (() => {}),
      initialToolCallCount: prefetchedInput.initialToolCallCount,
    });
    throwAbortErrorIfNeeded(options.signal);
    aiContent = result.content;
    aiReasoningContent = result.reasoningContent || '';
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[ai] llm generation aborted before assistant save:', JSON.stringify({
        sessionId: session._id.toString(),
        userMessageId: userMessage._id.toString(),
      }));
      await cleanupAbortedUserTurn({ session, userMessage, createdNewSession });
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

  // 保存 AI 回复
  throwAbortErrorIfNeeded(options.signal);
  const aiMessage = await AIMessage.create({
    session: session._id,
    role: 'assistant',
    content: aiContent,
    reasoningContent: aiReasoningContent,
  });
  console.log('[ai] assistant message saved:', JSON.stringify({
    sessionId: session._id.toString(),
    assistantMessageId: aiMessage._id.toString(),
    contentLength: aiContent.length,
  }));

  // 更新会话更新时间
  session.updatedAt = new Date();
  await session.save();

  if (options.emitEvent) {
    options.emitEvent(sseDone());
  }

  return {
    session: serializeSession(session, effectivePersona),
    userMessage: {
      _id: userMessage._id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    assistantMessage: {
      _id: aiMessage._id,
      role: aiMessage.role,
      content: aiMessage.content,
      createdAt: aiMessage.createdAt,
    },
  };
};

// 重新生成最后一条 AI 回复
export const regenerateMessage = async (userId, sessionId, options = {}) => {
  const session = await AISession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    throw new AppError('会话不存在', 404, 'SESSION_NOT_FOUND');
  }

  if (options.emitEvent) {
    options.emitEvent(sseStart(session._id.toString()));
  }

  // 获取最后一条 AI 消息
  const lastMessage = await AIMessage.findOne({
    session: session._id,
    role: 'assistant',
  }).sort({ createdAt: -1 });

  if (!lastMessage) {
    throw new AppError('没有可重新生成的消息', 400, 'NO_MESSAGE_TO_REGENERATE');
  }

  // 获取历史消息（不包括最后一条 AI 消息）
  const historyMessages = await AIMessage.find({
    session: session._id,
    _id: { $ne: lastMessage._id },
  })
    .sort({ createdAt: -1 })
    .limit(MAX_CONTEXT_MESSAGES)
    .lean();

  historyMessages.reverse();

  // 构建 LLM 消息格式
  const effectivePersona = await resolveEffectivePersona(userId, session);
  const latestUserMessage = [...historyMessages].reverse().find((message) => message.role === 'user');
  const originalContext = resolveMessageContext(latestUserMessage);
  const contextualReply = resolveContextualReply(latestUserMessage?.content, originalContext);
  const currentPostContextMessage = buildCurrentPostContextMessage(originalContext);
  const currentDate = getCurrentDateString();

  if (contextualReply) {
    emitStaticAssistantReply(contextualReply, options.emitEvent);
    lastMessage.content = contextualReply;
    lastMessage.reasoningContent = '';
    lastMessage.createdAt = new Date();
    await lastMessage.save();
    session.updatedAt = new Date();
    await session.save();

    return {
      session: serializeSession(session, effectivePersona),
      message: {
        _id: lastMessage._id,
        role: lastMessage.role,
        content: lastMessage.content,
        createdAt: lastMessage.createdAt,
      },
    };
  }

  const llmMessages = [
    { role: 'system', content: buildSystemPrompt(effectivePersona, currentDate) },
    ...(currentPostContextMessage ? [{ role: 'system', content: currentPostContextMessage }] : []),
    ...historyMessages.map(toLLMMessage),
  ];
  const prefetchedInput = await maybePrefetchWebSearch({
    messages: llmMessages,
    content: latestUserMessage?.content || '',
    signal: options.signal,
    emitEvent: options.emitEvent,
  });

  // 调用 LLM with tool loop
  let aiContent;
  let aiReasoningContent = '';
  try {
    const result = await runToolLoop({
      messages: prefetchedInput.messages,
      signal: options.signal,
      writeEvent: options.emitEvent || (() => {}),
      initialToolCallCount: prefetchedInput.initialToolCallCount,
    });
    throwAbortErrorIfNeeded(options.signal);
    aiContent = result.content;
    aiReasoningContent = result.reasoningContent || '';
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError('AI 生成已中断', 499, 'LLM_ABORTED');
    }
    throw error;
  }

  // 更新 AI 消息
  throwAbortErrorIfNeeded(options.signal);
  lastMessage.content = aiContent;
  lastMessage.reasoningContent = aiReasoningContent;
  lastMessage.createdAt = new Date();
  await lastMessage.save();
  session.updatedAt = new Date();
  await session.save();

  if (options.emitEvent) {
    options.emitEvent(sseDone());
  }

  return {
    session: serializeSession(session, effectivePersona),
    message: {
      _id: lastMessage._id,
      role: lastMessage.role,
      content: lastMessage.content,
      createdAt: lastMessage.createdAt,
    },
  };
};

// 获取用户的所有会话
export const getSessions = async (userId) => {
  const sessions = await AISession.find({ user: userId })
    .sort({ updatedAt: -1 })
    .lean();

  return sessions.map(s => ({
    _id: s._id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    hasPersonaOverride: Boolean(s.aiPersona && Object.keys(s.aiPersona).length > 0),
  }));
};

// 获取会话详情（含消息历史）
export const getSession = async (userId, sessionId) => {
  const session = await AISession.findOne({ _id: sessionId, user: userId }).lean();
  if (!session) {
    throw new AppError('会话不存在', 404, 'SESSION_NOT_FOUND');
  }

  const messages = await AIMessage.find({ session: sessionId })
    .sort({ createdAt: 1 })
    .lean();
  const effectivePersona = await resolveEffectivePersona(userId, session);

  return {
    session: serializeSession(session, effectivePersona),
    messages: messages.map(m => ({
      _id: m._id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  };
};

// 创建新会话
export const createSession = async (userId) => {
  const session = await AISession.create({
    user: userId,
    title: '新会话',
  });
  const effectivePersona = await resolveEffectivePersona(userId, session);

  return {
    session: serializeSession(session, effectivePersona),
  };
};

// 删除会话
export const deleteSession = async (userId, sessionId) => {
  const session = await AISession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    throw new AppError('会话不存在', 404, 'SESSION_NOT_FOUND');
  }

  // 删除会话及其所有消息
  await AIMessage.deleteMany({ session: sessionId });
  await AISession.deleteOne({ _id: sessionId });

  return { success: true };
};
