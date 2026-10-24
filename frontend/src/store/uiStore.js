import { create } from 'zustand';
import { loadJSON, saveJSON } from '../utils';

// ─── URL 映射表 ───
const PAGE_URLS = {
  home: '/',
  my: '/my',
  bookmarks: '/bookmarks',
  likes: '/likes',
  myposts: '/myposts',
  announcements: '/announcements',
  drafts: '/drafts',
  admin: '/admin',
  'admin-events': '/admin/events',
  'admin-reports': '/admin/reports',
  'admin-bans': '/admin/bans',
  'admin-audit': '/admin/audit',
  settings: '/settings',
  'settings-password': '/settings/password',
  compose: '/compose',
  login: '/login',
  register: '/register',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
};

export const ADMIN_ROUTE_PAGES = ['admin-events', 'admin-reports', 'admin-bans', 'admin-audit'];

export const ADMIN_PAGE_TABS = {
  'admin-events': 'events',
  'admin-reports': 'reports',
  'admin-bans': 'bans',
  'admin-audit': 'audit',
};

export const EMPTY_QUICK_DRAFT = {
  title: '',
  content: '',
  tags: [],
  images: [],
};

export function normalizeQuickDraft(draft = {}) {
  const images = Array.isArray(draft.images)
    ? draft.images
    : draft.image
      ? [draft.image]
      : [];
  const tags = Array.isArray(draft.tags)
    ? draft.tags
    : draft.tag
      ? [draft.tag]
      : [];

  return {
    title: typeof draft.title === 'string' ? draft.title : '',
    content: typeof draft.content === 'string' ? draft.content : '',
    tags: [...tags],
    images: [...images],
  };
}

// 反向映射：URL → page name
function urlToPage(url) {
  const path = url.replace(/\/+$/, '') || '/';
  // 将旧的 /admin 入口规范到默认子页面
  if (path === '/admin') return 'admin-events';
  // 优先匹配精确路径（包括 admin 子页面）
  for (const [page, p] of Object.entries(PAGE_URLS)) {
    if (p === path) return page;
  }
  // 匹配 detail 页：/detail/:id
  if (/^\/detail\//.test(path)) return 'detail';
  return null;
}

// 从当前 URL 恢复 activePage
function getInitialPage() {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return urlToPage(path) || 'home';
}

const SEED_NOTIFS = [
  { id: 'N-1', text: '你的帖子「杜厦图书馆五楼的夕阳」获得了 10 个新赞', time: '2分钟前', read: false },
  { id: 'N-2', text: '温柔的小蓝鲸 回复了你的评论', time: '15分钟前', read: false },
  { id: 'N-3', text: '校园音乐节 2026 报名即将截止，快来参加', time: '1小时前', read: true },
];

const useUiStore = create((set, get) => ({
  // Toast
  toast: null,
  // AI Panel
  aiOpen: false,
  // Notifications
  notifs: loadJSON('nju_notifs', SEED_NOTIFS),
  // Routing
  activePage: getInitialPage(),
  draftId: null,
  pendingNavigation: null,
  navigationSaving: false,
  navigationError: '',
  leaveConfirm: {
    open: false,
    title: '离开当前页面？',
    description: '你有尚未保存的内容，离开后本次修改会丢失。',
    confirmText: '直接离开',
    discardText: null,
    cancelText: '继续编辑',
    mode: 'discard',
  },
  unsavedChangesHandler: null,
  // Search
  query: '',
  feedTag: '',
  homeScroll: 0,
  expandedPostIds: [],
  responseDrafts: {},
  responseActivities: {},
  bookmarkFolder: 'all',
  myTab: 'posts',
  quickDraft: { ...EMPTY_QUICK_DRAFT },
  quickActivity: 0,
  quickDraftGeneration: 0,
  quickSubmitting: false,
  quickPublishToken: 0,
  quickPublishError: '',
  quickImageProcessingCount: 0,
  quickImageJobSequence: 0,
  quickImageJobs: [],
  // Carousel navigation
  eventToOpen: null,
  // Scroll-to-feed signal (incremented to trigger HomePage scroll)
  feedScrollToken: 0,

  // Toast
  showToast: (msg) => {
    set({ toast: msg });
  },
  clearToast: () => set({ toast: null }),

  // AI Panel
  toggleAi: () => set((s) => ({ aiOpen: !s.aiOpen })),
  closeAi: () => set({ aiOpen: false }),

  // Notifications
  markAllNotifsRead: () => {
    const updated = get().notifs.map((n) => ({ ...n, read: true }));
    set({ notifs: updated });
    saveJSON('nju_notifs', updated);
  },
  addNotif: (text) => {
    const newNotif = { id: 'N-' + Date.now(), text, time: '刚刚', read: false };
    const updated = [newNotif, ...get().notifs];
    set({ notifs: updated });
    saveJSON('nju_notifs', updated);
  },

  // Routing
  setUnsavedChangesHandler: (handler) => set({ unsavedChangesHandler: handler }),
  clearUnsavedChangesHandler: () => set({ unsavedChangesHandler: null }),
  openLeaveConfirm: (config = {}) =>
    set((state) => ({
      leaveConfirm: {
        ...state.leaveConfirm,
        ...config,
        open: true,
      },
      navigationError: '',
    })),
  closeLeaveConfirm: () => {
    if (get().navigationSaving) return;
    set((state) => ({
      leaveConfirm: {
        ...state.leaveConfirm,
        open: false,
      },
      pendingNavigation: null,
      navigationError: '',
    }));
  },
  confirmPendingNavigation: async () => {
    const { pendingNavigation, unsavedChangesHandler } = get();
    if (!pendingNavigation || get().navigationSaving) return;
    set({ navigationSaving: true, navigationError: '' });

    try {
      if (pendingNavigation.mode === 'save' && unsavedChangesHandler) {
        const shouldProceed = await unsavedChangesHandler();
        if (!shouldProceed) {
          set({ navigationError: '尚未保存成功，内容已保留。请重试或留在这里继续编辑。' });
          return;
        }
      }
      set((state) => ({
        leaveConfirm: { ...state.leaveConfirm, open: false },
        pendingNavigation: null,
        navigationSaving: false,
      }));
      if (typeof pendingNavigation.action === 'function') {
        await pendingNavigation.action();
        return;
      }
      get().navigate(pendingNavigation.page, pendingNavigation.params, { force: true });
    } catch (error) {
      set({ navigationError: error.message || '保存失败，内容已保留，请重试。' });
    } finally {
      set({ navigationSaving: false });
    }
  },
  discardPendingNavigation: async () => {
    const { pendingNavigation } = get();
    if (!pendingNavigation || get().navigationSaving) return;

    set((state) => ({
      leaveConfirm: { ...state.leaveConfirm, open: false },
      pendingNavigation: null,
    }));

    if (typeof pendingNavigation.action === 'function') {
      await pendingNavigation.action();
      return;
    }
    get().navigate(pendingNavigation.page, pendingNavigation.params, { force: true });
  },
  requestNavigationConfirmation: (config) => {
    if (get().navigationSaving) return;
    set({
      pendingNavigation: config.pendingNavigation,
    });
    get().openLeaveConfirm(config.dialog);
  },
  navigate: (page, params, options = {}) => {
    if (get().navigationSaving) return false;
    const { unsavedChangesHandler } = get();
    if (!options.force && unsavedChangesHandler) {
      set({
        pendingNavigation: {
          page,
          params,
          mode: options.unsavedMode || 'save',
        },
      });
      if ((options.unsavedMode || 'save') === 'discard') {
        get().openLeaveConfirm({
          title: '离开当前页面？',
          description: '你修改过内容但还没保存。继续离开会丢掉这次修改。',
          confirmText: '直接离开',
          discardText: null,
          cancelText: '继续编辑',
          mode: 'discard',
        });
      } else {
        get().openLeaveConfirm({
          title: '保存当前草稿？',
          description: '你修改过内容但还没保存。现在离开会丢掉这次修改。',
          confirmText: '保存并离开',
          discardText: '不保存离开',
          cancelText: '留在这里',
          mode: 'save',
        });
      }
      return false;
    }
    if (get().activePage === 'home') set({ homeScroll: window.scrollY });
    let url;
    if (page === 'detail' && params?.selectedPost) {
      url = `/detail/${params.selectedPost.id}`;
    } else if (page === 'compose' && params?.draftId) {
      url = `/compose?draftId=${params.draftId}`;
    } else {
      url = PAGE_URLS[page];
    }
    if (url) {
      window.history.pushState({ page, params }, '', url);
    }
    set({
      activePage: page,
      draftId: page === 'compose' ? params?.draftId ?? null : null,
      pendingNavigation: null,
      ...params,
    });
    window.scrollTo(0, 0);
    return true;
  },
  handlePopState: () => {
    if (get().navigationSaving) { window.history.go(1); return; }
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const draftId = searchParams.get('draftId');
    const page = urlToPage(path) || 'home';
    const { unsavedChangesHandler } = get();
    if (unsavedChangesHandler) {
      window.history.go(1);
      set({
        pendingNavigation: {
          page,
          params: page === 'compose' && draftId ? { draftId } : undefined,
          mode: 'save',
        },
      });
      get().openLeaveConfirm({
        title: '保存当前草稿？',
        description: '你修改过内容但还没保存。现在离开会丢掉这次修改。',
        confirmText: '保存并离开',
        discardText: '不保存离开',
        cancelText: '留在这里',
        mode: 'save',
      });
      return;
    }
    set({ activePage: page, draftId });
  },

  // Search
  setQuery: (q) => set({ query: q.trim(), homeScroll: 0 }),
  setFeedTag: (tag) => set({ feedTag: tag, homeScroll: 0 }),

  updateQuickDraft: (patch) => set((state) => ({
    quickDraft: normalizeQuickDraft({ ...state.quickDraft, ...patch }),
    quickActivity: state.quickActivity + 1,
    quickPublishError: '',
  })),
  resetQuickDraft: () => set((state) => ({
    quickDraft: { ...EMPTY_QUICK_DRAFT },
    quickActivity: state.quickActivity + 1,
    quickDraftGeneration: state.quickDraftGeneration + 1,
    quickSubmitting: false,
    quickPublishToken: state.quickPublishToken + 1,
    quickPublishError: '',
    quickImageProcessingCount: 0,
    quickImageJobs: [],
  })),
  beginQuickPublish: () => {
    const state = get();
    if (state.quickSubmitting) return null;
    const owner = {
      activity: state.quickActivity + 1,
      generation: state.quickDraftGeneration,
      token: state.quickPublishToken + 1,
    };
    set({
      quickActivity: owner.activity,
      quickSubmitting: true,
      quickPublishToken: owner.token,
      quickPublishError: '',
    });
    return owner;
  },
  clearQuickDraftIfOwned: (owner) => {
    const state = get();
    if (!owner
      || state.quickActivity !== owner.activity
      || state.quickDraftGeneration !== owner.generation
      || state.quickPublishToken !== owner.token) return false;
    set({
      quickDraft: { ...EMPTY_QUICK_DRAFT },
      quickActivity: state.quickActivity + 1,
      quickDraftGeneration: state.quickDraftGeneration + 1,
      quickPublishError: '',
    });
    return true;
  },
  finishQuickPublish: (owner) => {
    if (!owner || get().quickPublishToken !== owner.token) return;
    set({ quickSubmitting: false });
  },
  setQuickPublishError: (owner, message) => {
    const state = get();
    if (!owner
      || state.quickActivity !== owner.activity
      || state.quickDraftGeneration !== owner.generation
      || state.quickPublishToken !== owner.token) return false;
    set({ quickPublishError: message });
    return true;
  },
  beginQuickImageProcessing: (count) => {
    if (!Number.isInteger(count) || count <= 0) return null;
    let jobId = null;
    set((state) => {
      jobId = state.quickImageJobSequence + 1;
      const job = { id: jobId, count, generation: state.quickDraftGeneration };
      return {
        quickImageJobSequence: jobId,
        quickImageProcessingCount: state.quickImageProcessingCount + count,
        quickImageJobs: [...state.quickImageJobs, job],
      };
    });
    return jobId;
  },
  finishQuickImageProcessing: (jobId) => {
    const state = get();
    if (!state.quickImageJobs.some((job) => job.id === jobId)) return;
    const quickImageJobs = state.quickImageJobs.filter((job) => job.id !== jobId);
    set({
      quickImageJobs,
      quickImageProcessingCount: quickImageJobs.reduce((sum, job) => sum + job.count, 0),
    });
  },

  // Event navigation
  openEventFromCarousel: (eventId) => {
    set({ eventToOpen: eventId, activePage: 'announcements' });
    setTimeout(() => set({ eventToOpen: null }), 100);
  },
  requestFeedScroll: () => set({ feedScrollToken: Date.now() }),
}));

export default useUiStore;
