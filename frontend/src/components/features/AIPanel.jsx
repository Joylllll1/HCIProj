import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../common/Icon';
import useAIStore from '../../store/aiStore';
import useUiStore from '../../store/uiStore';

const RichMessageContent = lazy(() => import('../common/RichMessageContent'));

const DIRECTNESS_OPTIONS = [
  { value: 'soft', label: '委婉', description: '先接住情绪，再慢慢给建议' },
  { value: 'balanced', label: '平衡', description: '共情和建议各占一半' },
  { value: 'straight', label: '直说', description: '少铺垫，直接分析和提醒' },
];

const VERBOSITY_OPTIONS = [
  { value: 'short', label: '简短', description: '更干脆，少展开' },
  { value: 'medium', label: '正常', description: '长度适中，日常聊天感' },
  { value: 'detailed', label: '详细', description: '解释更多，适合认真分析' },
];

const SUGGESTED_PROMPTS = [
  '帮我总结这篇帖子在说什么',
  '这篇帖子下面大家主要在讨论什么',
  '帮我分析一下楼主现在的情绪',
  '最近大家都在讨论什么',
  '帮我查一下最近的热点消息',
  '帮我梳理这篇帖子的几种不同观点',
];

function formatRelativeTime(date) {
  if (!date) return '刚刚';

  const now = Date.now();
  const diff = now - new Date(date).getTime();
  if (Number.isNaN(diff)) return '刚刚';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}

function hasRichMessageSyntax(content = '') {
  return /```|`[^`]+`|^\s{0,3}#{1,6}\s|^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s|^\s{0,3}>\s|\|.+\||\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|!\[[^\]]*\]\([^)]+\)/m.test(content);
}

function MessageBubble({ message, isLastAssistant, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors.
    }
  };

  const isAI = message.role === 'assistant';
  const shouldRenderRich = isAI && hasRichMessageSyntax(message.content);

  return (
    <div
      className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`}
      onMouseEnter={() => isAI && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative max-w-[85%] group">
        {isAI && showActions && (
          <div className="absolute -top-7 left-0 flex items-center gap-1 bg-white border border-line-soft rounded-full px-2 py-1 shadow-sm">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-text-3 hover:text-text transition-colors"
              type="button"
            >
              <Icon name={copied ? 'check' : 'content_copy'} size={14} />
              <span>{copied ? '已复制' : '复制'}</span>
            </button>
            {isLastAssistant && (
              <>
                <span className="text-line">|</span>
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 text-xs text-text-3 hover:text-text transition-colors"
                  type="button"
                >
                  <Icon name="refresh" size={14} />
                  <span>重新生成</span>
                </button>
              </>
            )}
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isAI
              ? 'bg-surface-soft text-text rounded-tl-sm'
              : 'bg-blue text-white rounded-tr-sm'
          }`}
        >
          {shouldRenderRich ? (
            <Suspense fallback={<p className="my-0 whitespace-pre-wrap break-words">{message.content}</p>}>
              <RichMessageContent content={message.content} />
            </Suspense>
          ) : (
            <p className="my-0 whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionItem({ session, isActive, onClick, onDelete }) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      className={`relative p-3 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-blue-soft' : 'hover:bg-surface-soft'
      }`}
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-medium text-text truncate">{session.title}</p>
          {session.hasPersonaOverride && (
            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-blue-soft text-blue text-[10px] font-semibold">
              已自定义
            </span>
          )}
        </div>
        {showDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('确定要删除这个会话吗？')) {
                onDelete();
              }
            }}
            className="p-1 text-text-3 hover:text-red transition-colors"
            type="button"
          >
            <Icon name="delete" size={16} />
          </button>
        )}
      </div>
      <p className="text-xs text-text-3 mt-1">{formatRelativeTime(session.updatedAt)}</p>
    </div>
  );
}

function OptionPill({ active, label, description, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-2xl border transition-all ${
        active
          ? 'border-blue bg-blue-soft shadow-sm'
          : 'border-line bg-white hover:border-blue/40 hover:bg-surface-soft'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <p className="text-sm font-semibold text-text">{label}</p>
      <p className="text-xs text-text-2 mt-1">{description}</p>
    </button>
  );
}

function PersonaSettingsView({
  currentSession,
  personaDraft,
  effectivePersona,
  isPersonaLoading,
  isPersonaSaving,
  personaDirty,
  error,
  onBack,
  onFieldChange,
  onReset,
  onSaveDefault,
  onSaveSession,
  onClearError,
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-text-2 hover:text-text transition-colors"
        >
          <Icon name="arrow_back" size={18} />
          返回
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-text">聊天风格</h2>
          <p className="text-xs text-text-3 mt-0.5">定义树洞 AI 怎么和你说话</p>
        </div>
        <div className="text-xs text-text-3 min-w-[52px] text-right">
          {personaDirty ? '未保存' : '已同步'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ overscrollBehavior: 'contain' }}>
        <div className="max-w-[760px] mx-auto space-y-6">
          <div className="rounded-3xl border border-line bg-surface-soft px-5 py-4">
            <p className="text-sm font-semibold text-text">让树洞 AI 更像你想要的聊天对象</p>
            <p className="text-sm text-text-2 mt-2 leading-relaxed">
              你可以调整它的角色、语气和回复方式。这些设置不会改变系统安全边界。
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-white px-5 py-4">
            <p className="text-sm font-semibold text-text">当前生效风格</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-2">
              {!!effectivePersona.role && (
                <span className="px-3 py-1.5 rounded-full bg-surface-soft">
                  角色：{effectivePersona.role}
                </span>
              )}
              {!!effectivePersona.persona && (
                <span className="px-3 py-1.5 rounded-full bg-surface-soft">
                  人设：{effectivePersona.persona}
                </span>
              )}
              {!!effectivePersona.tone && (
                <span className="px-3 py-1.5 rounded-full bg-surface-soft">
                  语气：{effectivePersona.tone}
                </span>
              )}
              <span className="px-3 py-1.5 rounded-full bg-surface-soft">
                直接程度：{
                  DIRECTNESS_OPTIONS.find((option) => option.value === effectivePersona.directness)?.label || '平衡'
                }
              </span>
              <span className="px-3 py-1.5 rounded-full bg-surface-soft">
                回复长度：{
                  VERBOSITY_OPTIONS.find((option) => option.value === effectivePersona.verbosity)?.label || '正常'
                }
              </span>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-soft text-red text-sm rounded-2xl flex items-start justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={onClearError}
                className="text-red hover:opacity-70 flex-shrink-0"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          {isPersonaLoading ? (
            <div className="rounded-3xl border border-line bg-white px-5 py-10 text-center text-sm text-text-2">
              正在加载聊天风格设置...
            </div>
          ) : (
            <>
              <section className="rounded-3xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-text">1. 角色</p>
                <input
                  type="text"
                  value={personaDraft.role}
                  onChange={(e) => onFieldChange('role', e.target.value)}
                  disabled={isPersonaSaving}
                  placeholder="比如：知心学姐、毒舌损友、佛系老哥"
                  className="mt-4 w-full h-11 px-4 border border-line rounded-2xl bg-surface-soft text-sm text-text placeholder:text-text-3 outline-none focus:border-blue transition-colors"
                />
                <p className="text-xs text-text-3 mt-3">
                  描述你希望 AI 像什么样的人和你聊天。留空时，这一项不会额外写进 prompt。
                </p>
              </section>

              <section className="rounded-3xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-text">2. 人设</p>
                <textarea
                  value={personaDraft.persona}
                  onChange={(e) => onFieldChange('persona', e.target.value)}
                  disabled={isPersonaSaving}
                  rows={4}
                  placeholder="比如：冷静、克制、观察力强，不主动暴露情绪；更擅长先判断局势再开口"
                  className="mt-4 w-full px-4 py-3 border border-line rounded-2xl bg-surface-soft text-sm text-text placeholder:text-text-3 outline-none focus:border-blue transition-colors resize-none"
                />
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p className="text-xs text-text-3">
                    写清楚这个角色真正该是什么感觉，比只填名字更容易稳定带入。
                  </p>
                  <span className="text-xs text-text-3 flex-shrink-0">
                    {(personaDraft.persona || '').length} / 120
                  </span>
                </div>
              </section>

              <section className="rounded-3xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-text">3. 语气</p>
                <input
                  type="text"
                  value={personaDraft.tone}
                  onChange={(e) => onFieldChange('tone', e.target.value)}
                  disabled={isPersonaSaving}
                  placeholder="比如：像熟人聊天，不要像客服；可以温柔一点，但别太鸡汤"
                  className="mt-4 w-full h-11 px-4 border border-line rounded-2xl bg-surface-soft text-sm text-text placeholder:text-text-3 outline-none focus:border-blue transition-colors"
                />
                <p className="text-xs text-text-3 mt-3">
                  描述你希望它怎么说话。可以写你喜欢的感觉，也可以写你不喜欢的风格。留空时，这一项不会额外写进 prompt。
                </p>
              </section>

              <section className="rounded-3xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-text">4. 直接程度</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
                  <OptionPill
                    active={!personaDraft.directness}
                    label="跟随默认"
                    description="清空这一项，交给默认层级继续兜底"
                    onClick={() => onFieldChange('directness', '')}
                    disabled={isPersonaSaving}
                  />
                  {DIRECTNESS_OPTIONS.map((option) => (
                    <OptionPill
                      key={option.value}
                      active={personaDraft.directness === option.value}
                      label={option.label}
                      description={option.description}
                      onClick={() => onFieldChange('directness', option.value)}
                      disabled={isPersonaSaving}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-text">5. 回复长度</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
                  <OptionPill
                    active={!personaDraft.verbosity}
                    label="跟随默认"
                    description="清空这一项，交给默认层级继续兜底"
                    onClick={() => onFieldChange('verbosity', '')}
                    disabled={isPersonaSaving}
                  />
                  {VERBOSITY_OPTIONS.map((option) => (
                    <OptionPill
                      key={option.value}
                      active={personaDraft.verbosity === option.value}
                      label={option.label}
                      description={option.description}
                      onClick={() => onFieldChange('verbosity', option.value)}
                      disabled={isPersonaSaving}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-line bg-white p-5">
                <p className="text-sm font-semibold text-text">6. 额外要求</p>
                <textarea
                  value={personaDraft.customInstruction}
                  onChange={(e) => onFieldChange('customInstruction', e.target.value)}
                  disabled={isPersonaSaving}
                  rows={4}
                  placeholder="比如：叫我小蓝鲸；多给具体建议；别总反问我"
                  className="mt-4 w-full px-4 py-3 border border-line rounded-2xl bg-surface-soft text-sm text-text placeholder:text-text-3 outline-none focus:border-blue transition-colors resize-none"
                />
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p className="text-xs text-text-3">补充一些你特别在意的小偏好。不填也没关系。</p>
                  <span className="text-xs text-text-3 flex-shrink-0">
                    {(personaDraft.customInstruction || '').length} / 120
                  </span>
                </div>
              </section>

            </>
          )}
        </div>
      </div>

      <div className="border-t border-line-soft px-6 py-4 bg-white">
        <div className="max-w-[760px] mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onReset}
            disabled={isPersonaLoading || isPersonaSaving}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 border border-line rounded-full text-sm text-text-2 bg-white transition-colors hover:bg-surface-soft disabled:opacity-60 disabled:cursor-not-allowed"
          >
            恢复默认
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onSaveDefault}
              disabled={isPersonaLoading || isPersonaSaving || !personaDirty}
              className="inline-flex items-center justify-center h-10 px-4 border border-line rounded-full text-sm text-text bg-white transition-colors hover:bg-surface-soft disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPersonaSaving ? '保存中...' : '设为默认'}
            </button>
            <button
              type="button"
              onClick={onSaveSession}
              disabled={isPersonaLoading || isPersonaSaving || !personaDirty || !currentSession?._id}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full text-sm font-semibold text-white bg-blue transition-colors hover:bg-blue-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPersonaSaving ? '保存中...' : '仅当前会话生效'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIPanel({ open, onClose }) {
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const showToast = useUiStore((state) => state.showToast);

  const {
    sessions,
    currentSession,
    messages,
    showSessionList,
    isLoading,
    isPersonaViewOpen,
    isPersonaLoading,
    isPersonaSaving,
    isStopping,
    streamingContent,
    toolStatus,
    personaDraft,
    effectivePersona,
    personaDirty,
    error,
    fetchSessions,
    createSession,
    switchSession,
    deleteSession,
    sendMessage,
    regenerateMessage,
    toggleSessionList,
    closeSessionList,
    openPersonaSettings,
    closePersonaSettings,
    updatePersonaField,
    resetPersonaDraft,
    saveDefaultPersona,
    saveSessionPersona,
    cancelActiveRequest,
    clearError,
  } = useAIStore();

  useEffect(() => {
    let cancelled = false;

    const initializePanel = async () => {
      if (!open) return;

      try {
        const loadedSessions = await fetchSessions();
        if (cancelled || currentSession) return;

        if (loadedSessions.length > 0) {
          await switchSession(loadedSessions[0]._id);
          return;
        }

        await createSession();
      } catch {
        // Errors are handled in the store.
      }
    };

    initializePanel();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && !isPersonaViewOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isPersonaViewOpen]);

  const confirmDiscardPersonaChanges = useCallback(() => {
    if (!personaDirty) return true;
    return window.confirm('放弃这次修改？\n你有未保存的聊天风格设置。');
  }, [personaDirty]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    try {
      await sendMessage(text);
    } catch {
      // Error handled in store.
    }
  }, [input, isLoading, sendMessage]);

  const handleSuggestedPromptClick = useCallback(async (prompt) => {
    if (isLoading) return;

    try {
      await sendMessage(prompt);
    } catch {
      // Error handled in store.
    }
  }, [isLoading, sendMessage]);

  const handleRegenerate = useCallback(async () => {
    if (isLoading) return;

    try {
      await regenerateMessage();
    } catch {
      // Error handled in store.
    }
  }, [isLoading, regenerateMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault();
      cancelActiveRequest();
      return;
    }

    if (isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    const handleWindowKeyDown = (event) => {
      if (event.key === 'Escape' && isLoading) {
        event.preventDefault();
        cancelActiveRequest();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [open, isLoading, cancelActiveRequest]);

  const handleOpenPersonaSettings = async () => {
    try {
      await openPersonaSettings();
    } catch {
      // Error handled in store.
    }
  };

  const handleBackFromPersona = () => {
    if (!confirmDiscardPersonaChanges()) return;
    closePersonaSettings();
  };

  const handleClosePanel = () => {
    if (isPersonaViewOpen && !confirmDiscardPersonaChanges()) return;
    if (isPersonaViewOpen) {
      closePersonaSettings();
    }
    onClose();
  };

  const handleSaveDefaultPersona = async () => {
    try {
      await saveDefaultPersona();
      showToast('已保存为默认风格');
      closePersonaSettings();
    } catch {
      // Error handled in store.
    }
  };

  const handleSaveSessionPersona = async () => {
    try {
      await saveSessionPersona();
      showToast('已应用到当前会话');
      closePersonaSettings();
    } catch {
      // Error handled in store.
    }
  };

  const handleResetPersonaDraft = () => {
    if (window.confirm('恢复默认风格？\n这会清空你当前的个性化设置。')) {
      resetPersonaDraft();
    }
  };

  const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === 'assistant');
  const lastAssistantId = lastAssistantIndex >= 0
    ? messages[messages.length - 1 - lastAssistantIndex]._id
    : null;

  return (
    <div className={`ai-slide-panel fixed inset-0 z-[100] ${open ? 'open pointer-events-auto' : 'pointer-events-none'}`}>
      <div
        className="ai-slide-overlay absolute inset-0 opacity-0 bg-black/30 transition-opacity duration-[250ms] ai-slide-panel-open:opacity-100"
        onClick={handleClosePanel}
      />
      <aside
        className={`ai-slide-content absolute top-0 right-0 bottom-0 w-full max-w-[840px] sm:w-[min(92vw,840px)] flex flex-col p-6 border-l border-line bg-white shadow-md translate-x-full transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ai-slide-panel-open:translate-x-0 ${isPersonaViewOpen ? 'opacity-0 pointer-events-none' : ''}`}
      >
        <>
            <div className="ai-slide-head flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={toggleSessionList}
                  className="p-1 text-text-2 hover:text-text transition-colors"
                  title="会话列表"
                  type="button"
                >
                  <Icon name="menu" size={20} />
                </button>
                <span className="live-dot w-2 h-2 rounded-full bg-[#24c26a] shadow-[0_0_0_5px_rgba(36,194,106,0.12)]" />
                <strong className="text-base tracking-tight truncate max-w-[220px]">
                  {currentSession?.title || '树洞 AI'}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="grid w-8 h-8 place-items-center border border-line rounded-full bg-white text-text-3 transition-colors duration-150 hover:text-text hover:border-text-3"
                  onClick={handleOpenPersonaSettings}
                  type="button"
                  title="聊天风格"
                >
                  <Icon name="settings" size={16} />
                </button>
                <button
                  className="ai-slide-close grid w-8 h-8 place-items-center border border-line rounded-full bg-white text-text-3 transition-colors duration-150 hover:text-text hover:border-text-3"
                  onClick={handleClosePanel}
                  type="button"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            {showSessionList && (
              <div className="absolute inset-y-0 left-0 w-64 bg-white border-r border-line z-10 p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-text">会话列表</h3>
                  <button
                    onClick={closeSessionList}
                    className="p-1 text-text-3 hover:text-text"
                    type="button"
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2" style={{ overscrollBehavior: 'contain' }}>
                  {sessions.map((session) => (
                    <SessionItem
                      key={session._id}
                      session={session}
                      isActive={session._id === currentSession?._id}
                      onClick={() => switchSession(session._id)}
                      onDelete={() => deleteSession(session._id)}
                    />
                  ))}
                </div>
                <button
                  onClick={() => createSession()}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 border border-line rounded-lg text-sm text-text hover:bg-surface-soft transition-colors"
                  type="button"
                >
                  <Icon name="add" size={16} />
                  新建会话
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="ai-welcome py-8">
                <h2 className="ai-welcome-title">今天想聊点什么？</h2>
                <div className="ai-suggestion-cloud" role="list" aria-label="建议提问">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="ai-suggestion-chip"
                      onClick={() => handleSuggestedPromptClick(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto mb-3 px-1" style={{ overscrollBehavior: 'contain' }}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg._id}
                  message={msg}
                  isLastAssistant={msg._id === lastAssistantId}
                  onRegenerate={handleRegenerate}
                />
              ))}
              {/* In-progress streaming content */}
              {isLoading && streamingContent && (
                <div className="flex justify-start mb-4">
                  <div className="px-4 py-3 rounded-2xl bg-surface-soft rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[85%]">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-4 bg-blue ml-0.5 animate-pulse" />
                  </div>
                </div>
              )}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="px-4 py-3 rounded-2xl bg-surface-soft rounded-tl-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-2 h-2 bg-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
              {toolStatus && (
                <div className="flex justify-start mb-4">
                  <div className="px-4 py-2 rounded-2xl bg-surface-soft rounded-tl-sm text-sm text-text-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    {toolStatus}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {error && (
              <div className="mb-3 px-3 py-2 bg-red-soft text-red text-sm rounded-lg flex items-center justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-red hover:opacity-70" type="button">
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}

            <div className="ai-chat-input flex gap-2 pt-4 border-t border-line-soft">
              <input
                ref={inputRef}
                className="flex-1 min-w-0 h-10 px-[14px] border border-line rounded-full bg-surface-soft text-text text-sm placeholder:text-text-3 outline-none focus:border-blue transition-colors"
                placeholder="和树洞 AI 聊聊..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                className={`flex-shrink-0 h-10 px-4 inline-flex items-center justify-center gap-[7px] border-0 rounded-full text-white font-bold shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLoading
                    ? 'bg-[#f25f5c] hover:bg-[#df4f4c]'
                    : 'primary-button bg-blue hover:-translate-y-px hover:bg-blue-2'
                }`}
                onClick={isLoading ? cancelActiveRequest : handleSend}
                type="button"
                disabled={!isLoading && !input.trim()}
              >
                <Icon name={isLoading ? 'close' : 'send'} />
                <span>{isLoading ? (isStopping ? '停止中' : '停止') : '发送'}</span>
              </button>
            </div>
        </>
      </aside>
      {isPersonaViewOpen && (
        <PersonaSettingsView
          currentSession={currentSession}
          personaDraft={personaDraft}
          effectivePersona={effectivePersona}
          isPersonaLoading={isPersonaLoading}
          isPersonaSaving={isPersonaSaving}
          personaDirty={personaDirty}
          error={error}
          onBack={handleBackFromPersona}
          onFieldChange={updatePersonaField}
          onReset={handleResetPersonaDraft}
          onSaveDefault={handleSaveDefaultPersona}
          onSaveSession={handleSaveSessionPersona}
          onClearError={clearError}
        />
      )}
    </div>
  );
}

export default AIPanel;
