import React from 'react';
import Icon from '../common/Icon';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';

const adminNavItems = [
  { id: 'events', label: '公告审核', icon: 'campaign' },
  { id: 'reports', label: '举报管理', icon: 'report_problem' },
  { id: 'bans', label: '封禁记录', icon: 'gavel' },
  { id: 'audit', label: '审计日志', icon: 'receipt_long' },
];

const selectLogout = (s) => s.logout;

function AdminSidebar({ activeTab, onTabChange }) {
  const logout = useAuthStore(selectLogout);
  const navigate = useUiStore((s) => s.navigate);

  const handleLogout = () => {
    logout().finally(() => navigate('home', undefined, { force: true }));
  };

  return (
    <aside className="sidebar sticky top-0 flex w-[240px] h-screen flex-col flex-shrink-0 border-r border-line bg-[#f5f5f7] z-30 max-lg:hidden">
      <div className="pt-5 px-[14px]">
        <button className="brand" type="button">
          <span className="brand-mark bg-blue-500">后</span>
          <span>
            <strong className="block text-[17px] font-bold tracking-tight">后台管理</strong>
            <small className="block mt-px text-text-3 text-[10px] font-semibold tracking-widest uppercase">Admin Console</small>
          </span>
        </button>
        <nav className="grid gap-[5px] mt-4">
          {adminNavItems.map((item) => (
            <button
              className={`nav-item relative flex items-center gap-2.5 w-full min-h-10 px-3 border border-transparent rounded-lg text-sm font-semibold text-left transition-colors duration-150 ${
                activeTab === item.id
                  ? 'active text-blue bg-blue-soft font-bold'
                  : 'text-text-2 bg-transparent hover:text-text hover:bg-black/[0.04]'
              }`}
              key={item.id}
              onClick={() => onTabChange(item.id)}
              type="button"
            >
              <Icon name={item.icon} filled={activeTab === item.id} />
              <span>{item.label}</span>
              {activeTab === item.id && (
                <span className="absolute -left-[14px] w-[3px] h-5 rounded-r-full bg-blue" />
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-[14px]">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 border-0 rounded-lg text-text-2 bg-transparent text-xs font-semibold transition-colors duration-150 hover:text-red-500 hover:bg-red-soft"
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

export default AdminSidebar;
