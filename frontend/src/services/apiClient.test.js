import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../store/authStore';
import { clearAuthState, request } from './apiClient';

const originalLocation = window.location;

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('apiClient auth retry flow', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    useAuthStore.setState({
      user: { _id: 'u1', email: 'auth-test@nju.edu.cn' },
      isAuthenticated: true,
      loading: false,
      initialized: true,
      error: null,
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/detail/post-1',
        assign,
      },
    });
    assign.mockReset();
  });

  afterEach(() => {
    clearAuthState();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('refreshes once and retries the original request after a 401', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Token 已过期' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await request('/api/protected', { method: 'GET' });

    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it('clears auth state and redirects to / when refresh fails', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Token 已过期' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ error: '登录已过期，请重新登录' }, { status: 401 }));

    await expect(request('/api/protected', { method: 'GET' })).rejects.toMatchObject({
      status: 401,
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('does not redirect in silent auth failure mode', async () => {
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse({ error: 'Token 已过期' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ error: '登录已过期，请重新登录' }, { status: 401 }));

    await expect(
      request('/api/auth/me', { authFailureMode: 'silent' }),
    ).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it('keeps auth state intact when logout request fails', async () => {
    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse({ error: '服务器内部错误' }, { status: 500 }),
    );

    await expect(
      request('/api/auth/logout', {
        method: 'POST',
        skipAuthRefresh: true,
        authFailureMode: 'silent',
      }),
    ).rejects.toMatchObject({ status: 500 });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual({
      _id: 'u1',
      email: 'auth-test@nju.edu.cn',
    });
    expect(assign).not.toHaveBeenCalled();
  });
});
