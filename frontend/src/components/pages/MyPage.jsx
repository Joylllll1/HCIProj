import React, { useState } from 'react';
import BookmarksPage from './BookmarksPage';
import MyPostsPage from './MyPostsPage';
import LikesPage from './LikesPage';

const TABS = [
  { key: 'posts', label: '我的帖子' },
  { key: 'bookmarks', label: '我的收藏' },
  { key: 'likes', label: '我的喜爱' },
];

function MyPage({
  posts, bookmarks, likedPosts,
  onOpenPost, onLike, onBookmark, onReport,
  collectionFolders, bookmarkFolders,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('posts');

  return (
    <div className="my-page">
      <nav className="my-sub-nav">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`my-sub-nav-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="my-page-content">
        {activeTab === 'posts' && <MyPostsPage compact onNavigate={onNavigate} />}
        {activeTab === 'bookmarks' && (
          <BookmarksPage
            compact
            posts={posts}
            bookmarks={bookmarks}
            likedPosts={likedPosts}
            onOpenPost={onOpenPost}
            onLike={onLike}
            onBookmark={onBookmark}
            onReport={onReport}
            collectionFolders={collectionFolders}
            bookmarkFolders={bookmarkFolders}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />
        )}
        {activeTab === 'likes' && (
          <LikesPage
            compact
            posts={posts}
            likedPosts={likedPosts}
            onOpenPost={onOpenPost}
            onReport={onReport}
          />
        )}
      </div>
    </div>
  );
}

export default MyPage;
