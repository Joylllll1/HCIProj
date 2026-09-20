import useAuthStore from '../store/authStore';

// ─── Stable store selectors (prevents zustand getSnapshot churn) ───
const selectUser = (s) => s.user;
const selectIsAuthenticated = (s) => s.isAuthenticated;
const selectLoading = (s) => s.loading;
const selectError = (s) => s.error;
const selectLogin = (s) => s.login;
const selectRegister = (s) => s.register;
const selectLogout = (s) => s.logout;
const selectRestoreSession = (s) => s.restoreSession;
const selectClearError = (s) => s.clearError;

export default function useAuth() {
  const user = useAuthStore(selectUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const loading = useAuthStore(selectLoading);
  const error = useAuthStore(selectError);
  const login = useAuthStore(selectLogin);
  const register = useAuthStore(selectRegister);
  const logout = useAuthStore(selectLogout);
  const restoreSession = useAuthStore(selectRestoreSession);
  const clearError = useAuthStore(selectClearError);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    restoreSession,
    clearError,
  };
}
