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
