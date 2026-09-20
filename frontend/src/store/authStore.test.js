import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from './authStore';

const logoutMock = vi.fn();
const getMeMock = vi.fn();
const hasSessionHintCookieMock = vi.fn();
const loginMock = vi.fn();
const registerMock = vi.fn();

vi.mock('../services/authService', () => ({
  login: (...args) => loginMock(...args),
  register: (...args) => registerMock(...args),
  logout: (...args) => logoutMock(...args),
  getMe: (...args) => getMeMock(...args),
}));

vi.mock('../services/apiClient', () => ({
  hasSessionHintCookie: (...args) => hasSessionHintCookieMock(...args),
}));

describe('authStore logout behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSessionHintCookieMock.mockReturnValue(true);
    useAuthStore.setState(useAuthStore.getInitialState(), true);
    useAuthStore.setState({
      user: { _id: 'u1', email: 'auth-test@nju.edu.cn' },
      isAuthenticated: true,
      initialized: true,
      loading: false,
      error: null,
    });
  });

  it('preserves auth state when logout request fails', async () => {
    logoutMock.mockRejectedValueOnce(new Error('logout failed'));

    await expect(useAuthStore.getState().logout()).rejects.toThrow('logout failed');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual({
      _id: 'u1',
      email: 'auth-test@nju.edu.cn',
    });
  });

  it('clears auth state after a successful logout', async () => {
    logoutMock.mockResolvedValueOnce({ message: '已退出登录' });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('skips session restore probe when there is no session hint cookie', async () => {
    hasSessionHintCookieMock.mockReturnValue(false);

    await useAuthStore.getState().restoreSession();

    expect(getMeMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().initialized).toBe(true);
    expect(useAuthStore.getState().loading).toBe(false);
  });
});
