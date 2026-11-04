import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPreviewApi } from './previewApi';
import useAuthStore from '../store/authStore';

describe('isolated course preview', () => {
  let originalFetch;
  let originalEventSource;
  let originalPushState;
  let originalReplaceState;
  let originalUrl;
  let network;
  beforeEach(() => {
    originalFetch = window.fetch;
    originalEventSource = window.EventSource;
    originalPushState = window.history.pushState;
    originalReplaceState = window.history.replaceState;
    originalUrl = window.location.href;
    network = vi.fn();
    window.fetch = network;
    installPreviewApi();
  });
  afterEach(() => {
    window.fetch = originalFetch;
    window.EventSource = originalEventSource;
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.history.replaceState(null, '', originalUrl);
    useAuthStore.setState(useAuthStore.getInitialState(), true);
  });

  it('rejects unsupported API writes without sending a real request', async () => {
    const response = await window.fetch('/api/auth/password', { method: 'PUT', body: '{}' });
    expect(response.status).toBe(501);
    expect(network).not.toHaveBeenCalled();
  });

  it('keeps interactions in memory and resets them in a fresh preview', async () => {
    const initial = await (await window.fetch('/api/posts')).json();
    const id = initial.posts[0].id;
    await window.fetch(`/api/posts/${id}/like`, { method: 'POST' });
    const liked = await (await window.fetch(`/api/posts/${id}`)).json();
    expect(liked.likes).toBe(initial.posts[0].likes + 1);
    expect(liked.isLiked).toBe(true);
    window.fetch = network;
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    installPreviewApi();
    const reset = await (await window.fetch(`/api/posts/${id}`)).json();
    expect(reset.isLiked).toBe(false);
    expect(reset.likes).toBe(initial.posts[0].likes);
    expect(network).not.toHaveBeenCalled();
  });

  it('preserves preview mode when navigating to a reloadable detail URL', () => {
    window.history.pushState({}, '', '/detail/demo-1');
    expect(window.location.search).toBe('?preview=1');
    window.history.replaceState({}, '', '/compose?draftId=example');
    expect(new URLSearchParams(window.location.search).get('preview')).toBe('1');
    expect(new URLSearchParams(window.location.search).get('draftId')).toBe('example');
  });

  it('keeps untagged image posts readable and searchable', async () => {
    const response = await window.fetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content: '只有图片和文字', images: ['data:image/png;base64,example'] }),
    });
    const created = await response.json();
    expect(created.tags).toEqual([]);
    const feed = await (await window.fetch('/api/posts?query=只有图片')).json();
    expect(feed.posts.map((post) => post.id)).toContain(created.id);
    expect(network).not.toHaveBeenCalled();
  });

  it('omits images from draft summaries while preserving them for editing and publication', async () => {
    const images = ['data:image/png;base64,AA==', 'data:image/jpeg;base64,AQ=='];
    const created = await (await window.fetch('/api/drafts', {
      method: 'POST',
      body: JSON.stringify({ title: '图片草稿', content: '', tags: ['校园生活'], images }),
    })).json();
    const summaries = await (await window.fetch('/api/drafts')).json();
    const summary = summaries.find((draft) => draft.id === created.id);
    expect(summary).toMatchObject({ id: created.id, title: '图片草稿', content: '', tags: ['校园生活'] });
    expect(summary).not.toHaveProperty('image');
    expect(summary).not.toHaveProperty('images');

    const detail = await (await window.fetch(`/api/drafts/${created.id}`)).json();
    expect(detail.images).toEqual(images);
    const published = await (await window.fetch(`/api/drafts/${created.id}/publish`, { method: 'POST' })).json();
    expect(published.images).toEqual(images);
    expect(network).not.toHaveBeenCalled();
  });

  const bookmarkRequest = (suffix = '', method = 'GET', body) => window.fetch(`/api/bookmarks${suffix}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  it('moves saved demo posts to all without changing their saves or duplicating membership', async () => {
    const initial = await (await bookmarkRequest()).json();
    const saved = await (await bookmarkRequest('/demo-1', 'POST')).json();
    expect(saved.version).toBe(initial.version + 1);

    const response = await bookmarkRequest('/move-many', 'POST', {
      postIds: ['demo-3', 'demo-1', 'demo-3', 'demo-2', 'demo-404'],
      targetFolderId: 'all',
      expectedVersion: saved.version,
    });
    expect(response.status).toBe(200);
    const moved = await response.json();
    expect(moved).toEqual({
      bookmarks: ['demo-3', 'demo-1'], collectionFolders: initial.collectionFolders,
      bookmarkFolders: {}, version: saved.version + 1,
      results: [
        { postId: 'demo-3', status: 'moved', fromFolderId: 'later', toFolderId: 'all' },
        { postId: 'demo-1', status: 'unchanged', fromFolderId: 'all', toFolderId: 'all' },
        { postId: 'demo-2', status: 'not_saved' },
        { postId: 'demo-404', status: 'not_found' },
      ],
      postStates: [],
      reconciling: false,
      summary: { requested: 4, changed: 1, unchanged: 1, failed: 0 },
    });
    const retry = await (await bookmarkRequest('/move-many', 'POST', {
      postIds: ['demo-3'], targetFolderId: 'all', expectedVersion: moved.version,
    })).json();
    expect(retry).toMatchObject({ version: moved.version, results: [{ postId: 'demo-3', status: 'unchanged' }] });
    const assigned = await (await bookmarkRequest('/move-many', 'POST', {
      postIds: ['demo-1', 'demo-3'], targetFolderId: 'later', expectedVersion: retry.version,
    })).json();
    expect(assigned).toMatchObject({
      version: retry.version + 1,
      bookmarks: moved.bookmarks,
      bookmarkFolders: { later: ['demo-1', 'demo-3'] },
      results: [
        { postId: 'demo-1', status: 'moved', fromFolderId: 'all', toFolderId: 'later' },
        { postId: 'demo-3', status: 'moved', fromFolderId: 'all', toFolderId: 'later' },
      ],
    });
    const posts = await (await window.fetch('/api/posts/saved')).json();
    expect(posts).toMatchObject([{ id: 'demo-1', isSaved: true, saves: saved.saves }, { id: 'demo-3', isSaved: true, saves: 15 }]);
    expect(network).not.toHaveBeenCalled();
  });

  it('returns post states and decrements saves once across duplicate and repeated batch removals', async () => {
    const initial = await (await bookmarkRequest()).json();
    const postIds = ['demo-3', 'demo-3', 'demo-2', 'demo-404'];
    const removed = await (await bookmarkRequest('/remove-many', 'POST', { postIds, expectedVersion: initial.version })).json();
    expect(removed).toEqual({
      bookmarks: [], collectionFolders: initial.collectionFolders, bookmarkFolders: {}, version: initial.version + 1,
      results: [
        { postId: 'demo-3', status: 'removed' },
        { postId: 'demo-2', status: 'unchanged' },
        { postId: 'demo-404', status: 'not_found' },
      ],
      postStates: [
        { postId: 'demo-3', isSaved: false, saves: 14 },
        { postId: 'demo-2', isSaved: false, saves: 3 },
      ],
      reconciling: false,
      summary: { requested: 3, changed: 1, unchanged: 1, failed: 0 },
    });
    const retry = await (await bookmarkRequest('/remove-many', 'POST', { postIds, expectedVersion: removed.version })).json();
    expect(retry).toMatchObject({
      version: removed.version + 1,
      bookmarks: [], bookmarkFolders: {}, postStates: removed.postStates,
      summary: { requested: 3, changed: 0, unchanged: 2, failed: 0 },
    });
    expect(await (await window.fetch('/api/posts/saved')).json()).toEqual([]);
    expect(await (await window.fetch('/api/posts/demo-3')).json()).toMatchObject({ isSaved: false, saves: 14 });
    expect(network).not.toHaveBeenCalled();
  });

  it('omits a deleted post from the bookmark snapshot and reports it missing in a batch', async () => {
    const saved = await (await bookmarkRequest('/demo-4', 'POST', { folderId: 'later' })).json();
    await window.fetch('/api/posts/demo-4', { method: 'DELETE' });
    const state = await (await bookmarkRequest()).json();
    expect(state).toMatchObject({ version: saved.version, bookmarks: ['demo-3'], bookmarkFolders: { later: ['demo-3'] } });
    const moved = await (await bookmarkRequest('/move-many', 'POST', {
      postIds: ['demo-4'], targetFolderId: 'all', expectedVersion: saved.version,
    })).json();
    expect(moved).toMatchObject({ ...state, results: [{ postId: 'demo-4', status: 'not_found' }] });
    expect(network).not.toHaveBeenCalled();
  });

  it('rejects invalid and stale batches before applying changes', async () => {
    const initial = await (await bookmarkRequest()).json();
    const created = await (await bookmarkRequest('/folders', 'POST', { name: '待整理' })).json();
    const targetFolderId = created.collectionFolders.at(-1).id;
    expect(created.version).toBe(initial.version + 1);

    const stale = await bookmarkRequest('/move-many', 'POST', { postIds: ['demo-3'], targetFolderId, expectedVersion: initial.version });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ errorCode: 'BOOKMARK_VERSION_CONFLICT' });
    const tooLarge = await bookmarkRequest('/remove-many', 'POST', {
      postIds: Array(101).fill('demo-3'), expectedVersion: created.version,
    });
    expect(tooLarge.status).toBe(400);
    expect(await tooLarge.json()).toMatchObject({ errorCode: 'BOOKMARK_BATCH_INVALID' });
    const noVersion = await bookmarkRequest('/remove-many', 'POST', { postIds: ['demo-3'] });
    expect(noVersion.status).toBe(400);
    const missingFolder = await bookmarkRequest('/move-many', 'POST', {
      postIds: ['demo-3'], targetFolderId: 'folder-missing', expectedVersion: created.version,
    });
    expect(missingFolder.status).toBe(404);
    expect(await missingFolder.json()).toMatchObject({ errorCode: 'BOOKMARK_FOLDER_NOT_FOUND' });
    expect(await (await bookmarkRequest()).json()).toEqual(created);
    expect(network).not.toHaveBeenCalled();
  });

  it('versions individual bookmark writes while keeping legacy data out of the preview', async () => {
    const initial = await (await bookmarkRequest()).json();
    const migrated = await (await bookmarkRequest('/migrate', 'POST', {
      bookmarks: ['demo-1'], collectionFolders: [{ id: 'legacy-folder', name: '旧收藏' }],
    })).json();
    expect(migrated).toEqual({ ...initial, version: initial.version + 1 });
    const renamed = await (await bookmarkRequest('/folders/later', 'PUT', { name: '校园随笔' })).json();
    expect(renamed.version).toBe(migrated.version + 1);
    const deleted = await (await bookmarkRequest('/folders/later', 'DELETE')).json();
    expect(deleted).toMatchObject({ version: renamed.version + 1, bookmarks: ['demo-3'], bookmarkFolders: {} });
    const removed = await (await bookmarkRequest('/demo-3', 'DELETE')).json();
    expect(removed).toMatchObject({ version: deleted.version + 1, bookmarks: [], saved: false, saves: 14 });
    expect(network).not.toHaveBeenCalled();
  });
});

// Each preview reset is already covered above; the shapes must also match the real API.
describe('preview API contract', () => {
  it('keeps a saved post under its folder and supports nested replies', async () => {
    const originalFetch = window.fetch;
    const push = window.history.pushState;
    const replace = window.history.replaceState;
    const eventSource = window.EventSource;
    window.fetch = vi.fn();
    try {
      installPreviewApi();
      const state = await (await window.fetch('/api/bookmarks')).json();
      expect(state.bookmarkFolders.later).toEqual(['demo-3']);
      const response = await window.fetch('/api/comments/comment-1/reply', { method: 'POST', body: JSON.stringify({ content: '回复验证' }) });
      expect(response.status).toBe(200);
      const reply = await response.json();
      const comments = await (await window.fetch('/api/comments/demo-1')).json();
      expect(comments[0].replies[0].id).toBe(reply.id);
      expect(comments[0].replies[0].content).toBe('回复验证');
      await window.fetch(`/api/comments/comment-1/reply/${reply.id}`, { method: 'DELETE' });
      const deleted = await (await window.fetch('/api/comments/demo-1')).json();
      expect(deleted[0].replies).toHaveLength(0);
    } finally {
      window.fetch = originalFetch;
      window.history.pushState = push;
      window.history.replaceState = replace;
      window.EventSource = eventSource;
      useAuthStore.setState(useAuthStore.getInitialState(), true);
    }
  });
});
