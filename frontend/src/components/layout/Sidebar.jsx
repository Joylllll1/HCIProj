import React from 'react';
import Icon from '../common/Icon';

const navItems = [
  { id: 'home', label: '动态首页', icon: 'dynamic_feed' },
  { id: 'announcements', label: '校园公告', icon: 'campaign' },
  { id: 'drafts', label: '草稿箱', icon: 'inventory_2' },
  { id: 'likes', label: '我的喜爱', icon: 'favorite' },
  { id: 'bookmarks', label: '我的收藏', icon: 'bookmark' },
  { id: 'myposts', label: '我的帖子', icon: 'history_edu' },
];

function Sidebar({ activePage, onNavigate }) {
  const accountActive = activePage === 'settings' || activePage === 'settings-password';

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="brand" onClick={() => onNavigate('home')} type="button" aria-label="南大树洞首页">
          <span className="brand-mark"><Icon name="park" /></span>
          <span>
            <strong>南大树洞</strong>
            <small>NJU TREEHOLE</small>
          </span>
        </button>
        <p className="nav-group-label">校园广场</p>
        <nav className="side-nav" aria-label="主导航">
          {navItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {index === 2 && <p className="nav-group-label nav-group-personal">我的空间</p>}
              <button
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                aria-current={activePage === item.id ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <Icon name={item.icon} filled={activePage === item.id} />
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <button
          className={`sidebar-account-entry ${accountActive ? 'active' : ''}`}
          aria-current={accountActive ? 'page' : undefined}
          onClick={() => onNavigate('settings')}
          type="button"
        >
          <Icon name="person" />
          <span>账号与设置</span>
          <Icon name="chevron_right" />
        </button>
        <button className="sidebar-compose-btn" onClick={() => onNavigate('compose')} type="button">
          <Icon name="add" /><span>发布新动态</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
