import React from 'react';
import Icon from '../common/Icon';

const adminNavItems = [
  { id: 'events', label: '公告审核', icon: 'campaign' },
  { id: 'reports', label: '举报管理', icon: 'report_problem' },
  { id: 'bans', label: '封禁记录', icon: 'gavel' },
  { id: 'audit', label: '审计日志', icon: 'receipt_long' },
];

function AdminMobileNav({ activeTab, onTabChange }) {
  return (
    <nav className="lg:hidden fixed right-3 bottom-3 left-3 z-50 grid grid-cols-4 gap-1 p-2 border border-line rounded-[20px] bg-white/92 backdrop-blur-xs shadow-md">
      {adminNavItems.map((item) => (
        <button
          className={`grid place-items-center gap-1 min-w-0 py-2 px-1 border-0 rounded-2xl bg-transparent text-text-3 text-[10px] font-bold transition-colors duration-150 ${activeTab === item.id ? 'active text-blue bg-blue-soft' : ''}`}
          key={item.id}
          onClick={() => onTabChange(item.id)}
          type="button"
        >
          <Icon name={item.icon} filled={activeTab === item.id} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default AdminMobileNav;
