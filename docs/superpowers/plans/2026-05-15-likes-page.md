# 我的喜爱页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建"我的喜爱"页面，展示用户点赞过的帖子、评论和回复。

**Architecture:** 使用 Tab 切换展示帖子/评论两个列表。帖子 Tab 用 PostCard，评论 Tab 用自定义卡片展示评论内容和帖子上下文。

**Tech Stack:** React, Zustand, fetch API

---

## 文件结构

```
frontend/src/
├── services/
│   └── postService.js        # 新增 fetchLikes() 方法
├── components/
│   └── pages/
│       └── LikesPage.jsx    # 新建：我的喜爱页面
├── components/layout/
│   └── Sidebar.jsx          # 修改：添加侧边栏入口
└── App.jsx                 # 修改：注册路由和渲染 LikesPage
```

---

## 实现任务

### Task 1: 添加后端 API 调用方法

**Files:**
- Modify: `frontend/src/services/postService.js`

- [ ] **Step 1: 添加 fetchLikes 方法**

在 postService.js 末尾添加：

```js
export async function fetchLikes() {
  return request('/api/likes');
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/services/postService.js
git commit -m "$(cat <<'EOF'
[AI-assisted] feat: 添加 fetchLikes API
EOF
)"
```

---

### Task 2: 创建 LikesPage 组件

**Files:**
- Create: `frontend/src/components/pages/LikesPage.jsx`

- [ ] **Step 1: 创建 LikesPage.jsx**

从 BookmarksPage.jsx 复制，修改为 Tab 切换结构：

```jsx
import React, { useState, useEffect } from 'react';
import PostCard from '../common/PostCard';
import EmptyState from '../common/EmptyState';
import { fetchLikes } from '../../services/postService';

function LikesPage({ posts: allPosts, likedPosts: allLikedPosts, onOpenPost, onLike, onReport }) {
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'comments'
  const [likesData, setLikesData] = useState({ posts: [], comments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLikes()
      .then(setLikesData)
      .finally(() => setLoading(false));
  }, []);

  const posts = allPosts.filter((p) => allLikedPosts.includes(p.id));
  const comments = likesData.comments || [];

  return (
    <div className="collection-page max-w-[1180px] mx-auto">
      <section className="collection-hero">
        <p className="eyebrow mb-[18px] text-blue text-xs font-bold tracking-widest uppercase">My Likes</p>
        <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">我的喜爱</h1>
      </section>

      {/* Tab 切换 */}
      <div className="category-row flex flex-wrap gap-3 my-[22px]">
        <button
          className={`tab-btn px-4 py-[10px] text-sm font-semibold rounded-full border transition-all duration-200 ${
            activeTab === 'posts'
              ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
              : 'bg-white text-text-2 border-line hover:border-blue/40 hover:text-blue'
          }`}
          onClick={() => setActiveTab('posts')}
        >
          帖子
        </button>
        <button
          className={`tab-btn px-4 py-[10px] text-sm font-semibold rounded-full border transition-all duration-200 ${
            activeTab === 'comments'
              ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
              : 'bg-white text-text-2 border-line hover:border-blue/40 hover:text-blue'
          }`}
          onClick={() => setActiveTab('comments')}
        >
          评论
        </button>
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="py-10 text-center text-text-3">加载中...</div>
      ) : activeTab === 'posts' ? (
        posts.length === 0 ? (
          <EmptyState title="还没有赞过的帖子" />
        ) : (
          <section className="masonry-grid [column-count:2] [column-gap:18px] max-sm:[column-count:1]">
            {posts.map((post) => (
              <div key={post.id} className="inline-block w-full mb-[18px]">
                <PostCard
                  compact
                  post={post}
                  onOpen={() => onOpenPost(post)}
                  liked
                  onLike={() => onLike(post.id)}
                  onReport={onReport}
                />
              </div>
            ))}
          </section>
        )
      ) : (
        comments.length === 0 ? (
          <EmptyState title="还没有赞过的评论" />
        ) : (
          <section className="space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.item.id}
                className="comment-card p-4 border border-line rounded-xl bg-white hover:shadow-sm transition-all cursor-pointer"
                onClick={() => onOpenPost({ id: comment.postId, highlightComment: comment.item.id })}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-text-3 font-medium">来自：{comment.postTitle}</span>
                </div>
                <p className="text-sm text-text-2 mb-2">
                  {comment.type === 'reply' ? '↳ ' : '💬 '}
                  {comment.item.content}
                </p>
                <div className="text-xs text-text-3">♥ {comment.item.likes}</div>
              </div>
            ))}
          </section>
        )
      )}
    </div>
  );
}

export default LikesPage;
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/pages/LikesPage.jsx
git commit -m "$(cat <<'EOF'
[AI-assisted] feat: 添加 LikesPage 组件
EOF
)"
```

---

### Task 3: 添加侧边栏入口

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.jsx:5-12`

- [ ] **Step 1: 在 navItems 中添加我的喜爱**

在 `navItems` 数组中，"校园公告"和"我的收藏"之间添加：

```js
{ id: 'likes', label: '我的喜爱', icon: 'favorite' },
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/layout/Sidebar.jsx
git commit -m "$(cat <<'EOF'
[AI-assisted] feat: 侧边栏添加我的喜爱入口
EOF
)"
```

---

### Task 4: 注册路由并渲染 LikesPage

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: 导入 LikesPage**

在 import 部分添加：

```jsx
import LikesPage from './components/pages/LikesPage';
```

- [ ] **Step 2: 渲染 LikesPage**

在 `activePage === 'announcements' &&` 之前添加：

```jsx
{activePage === 'likes' && (
  <LikesPage
    posts={posts}
    likedPosts={likedPosts}
    onOpenPost={openPost}
    onLike={toggleLike}
    onReport={handleReport}
  />
)}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/App.jsx
git commit -m "$(cat <<'EOF'
[AI-assisted] feat: 注册 /likes 路由
EOF
)"
```

---

### Task 5: 运行验证

**Files:**
- 无

- [ ] **Step 1: 启动后端**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: 启动前端**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: 手动验证**

1. 登录账号
2. 点击侧边栏"我的喜爱"
3. 切换"帖子"/"评论" Tab
4. 确认展示正确
5. 点击卡片跳转到详情

- [ ] **Step 4: 提交**

```bash
git commit -m "$(cat <<'EOF'
[AI-assisted] feat: 我的喜爱页面完成
EOF
)"
```

---

## 实现顺序

1. Task 1: 添加 API 调用方法
2. Task 2: 创建 LikesPage 组件
3. Task 3: 添加侧边栏入口
4. Task 4: 注册路由
5. Task 5: 运行验证

每个 task 包含 2-5 个步骤，按顺序执行，最后运行验证。