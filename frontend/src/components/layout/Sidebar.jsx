import React from 'react';
import Icon from '../common/Icon';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';

const navItems = [
  { id: 'home', label: '动态首页', icon: 'home' },
  { id: 'announcements', label: '校园公告', icon: 'campaign' },
  { id: 'drafts', label: '草稿箱', icon: 'inventory_2' },
  { id: 'likes', label: '我的喜爱', icon: 'favorite' },
  { id: 'bookmarks', label: '我的收藏', icon: 'bookmark' },
  { id: 'myposts', label: '我的帖子', icon: 'description' },
  { id: 'settings', label: '个人设置', icon: 'person' },
];

const selectLogout = (s) => s.logout;
const selectRequestNavigationConfirmation = (s) => s.requestNavigationConfirmation;
const selectUnsavedChangesHandler = (s) => s.unsavedChangesHandler;

function Sidebar({ activePage, onNavigate }) {
  const logout = useAuthStore(selectLogout);
  const requestNavigationConfirmation = useUiStore(selectRequestNavigationConfirmation);
  const unsavedChangesHandler = useUiStore(selectUnsavedChangesHandler);

  const handleLogout = () => {
    if (!unsavedChangesHandler) {
      Promise.resolve(logout()).finally(() => {
        onNavigate('home', undefined, { force: true });
      });
      return;
    }

    requestNavigationConfirmation({
      pendingNavigation: {
        mode: 'discard',
        action: async () => {
          await logout();
          onNavigate('home', undefined, { force: true });
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
    <aside className="sidebar sticky top-0 flex w-[240px] h-screen flex-col flex-shrink-0 border-r border-line bg-[#f5f5f7] z-30 max-lg:hidden">
      <div className="pt-5 px-[14px]">
        <button className="brand" onClick={() => onNavigate('home')} type="button">
          <span className="brand-mark">N</span>
          <span>
            <strong className="block text-[17px] font-bold tracking-tight">南大树洞</strong>
            <small className="block mt-px text-text-3 text-[10px] font-semibold tracking-widest uppercase">NJU Treehole</small>
          </span>
        </button>
        <nav className="grid gap-[5px]">
          {navItems.map((item) => (
            <button
              className={`nav-item relative flex items-center gap-2.5 w-full min-h-10 px-3 border border-transparent rounded-lg text-text-2 bg-transparent text-sm font-semibold text-left transition-colors duration-150 hover:text-text hover:bg-black/[0.04] ${activePage === item.id ? 'active text-blue bg-blue-soft font-bold' : ''}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <Icon name={item.icon} filled={activePage === item.id} />
              <span>{item.label}</span>
              {activePage === item.id && (
                <span className="absolute -left-[14px] w-[3px] h-5 rounded-r-full bg-blue" />
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-[14px]">
        <button className="sidebar-compose-btn flex items-center justify-center gap-2 w-full h-[42px] mt-3 border-0 rounded-full text-white bg-blue text-sm font-bold shadow-sm transition-all duration-150 hover:bg-blue-2 hover:-translate-y-px" onClick={() => onNavigate('compose')} type="button">
          <Icon name="edit_square" />
          <span>发布新动态</span>
        </button>
        <button
          className="flex items-center gap-2 w-full mt-2 px-3 py-2 border-0 rounded-lg text-text-3 bg-transparent text-xs font-semibold transition-colors duration-150 hover:text-red-500 hover:bg-red-50"
          onClick={handleLogout}
          type="button"
        >
          <Icon name="logout" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
