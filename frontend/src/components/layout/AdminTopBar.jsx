import React from 'react';
import Icon from '../common/Icon';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';

const selectLogout = (s) => s.logout;

function AdminTopBar() {
  const logout = useAuthStore(selectLogout);
  const navigate = useUiStore((s) => s.navigate);
  const unsavedChangesHandler = useUiStore((s) => s.unsavedChangesHandler);
  const requestNavigationConfirmation = useUiStore((s) => s.requestNavigationConfirmation);

  const handleLogout = () => {
    if (!unsavedChangesHandler) {
      Promise.resolve(logout()).finally(() => {
        navigate('home', undefined, { force: true });
      });
      return;
    }

    requestNavigationConfirmation({
      pendingNavigation: {
        mode: 'discard',
        action: async () => {
          await logout();
          navigate('home', undefined, { force: true });
        },
      },
      dialog: {
        title: '退出登录？',
        description: '当前内容还没有保存。退出后本次修改会丢失，你需要重新登录才能继续编辑。',
        confirmText: '退出登录',
        cancelText: '继续编辑',
        mode: 'discard',
      },
    });
  };

  return (
    <header className="lg:hidden sticky top-0 z-20 flex items-center justify-end h-[60px] px-7 border-b border-line bg-white/82 backdrop-blur-xs max-sm:h-[48px] max-sm:px-3">
      <button
        className="flex items-center gap-1.5 h-[34px] px-4 border border-red/40 rounded-full text-red text-[13px] font-bold bg-white transition-all duration-150 hover:bg-red-50 hover:border-red"
        onClick={handleLogout}
        type="button"
      >
        <Icon name="logout" />
        <span>退出登录</span>
      </button>
    </header>
  );
}

export default AdminTopBar;
