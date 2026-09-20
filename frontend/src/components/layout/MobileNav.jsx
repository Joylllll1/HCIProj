import React from 'react';
import Icon from '../common/Icon';

const MOBILE_ITEMS = [
  { id: 'home', label: '首页', icon: 'dynamic_feed' },
  { id: 'announcements', label: '公告', icon: 'campaign' },
  null, // compose placeholder
  { id: 'my', label: '我的', icon: 'person', matchPages: ['my', 'bookmarks', 'likes', 'myposts'] },
  { id: 'settings', label: '设置', icon: 'settings' },
];

function MobileNav({ activePage, onNavigate }) {
  const navItems = MOBILE_ITEMS.filter(Boolean);

  const isActive = (item) => {
    if (item.matchPages) return item.matchPages.includes(activePage);
    return activePage === item.id;
  };

  return (
    <nav className="mobile-nav">
      {navItems.slice(0, 2).map((item) => (
        <button
          className={`mobile-nav-item ${isActive(item) ? 'active' : ''}`}
          key={item.id}
          onClick={() => onNavigate(item.id)}
          type="button"
        >
          <Icon name={item.icon} filled={isActive(item)} />
          <span>{item.label}</span>
        </button>
      ))}
      <button
        className="mobile-compose-btn"
        onClick={() => onNavigate('compose')}
        type="button"
        aria-label="发布新动态"
      >
        <Icon name="add" />
      </button>
      {navItems.slice(2).map((item) => (
        <button
          className={`mobile-nav-item ${isActive(item) ? 'active' : ''}`}
          key={item.id}
          onClick={() => onNavigate(item.id)}
          type="button"
        >
          <Icon name={item.icon} filled={isActive(item)} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default MobileNav;
