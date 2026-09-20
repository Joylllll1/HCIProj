# Post Owner Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow post owners to delete their posts from a "My Posts" page and the post detail page with confirmation dialog.

**Architecture:** Add `GET /api/posts/mine` backend endpoint, extend postStore with myPosts state and delete action, create MyPostsPage component, wire delete button into DetailPage replacing the placeholder, and add sidebar navigation entry. Delete reuses existing `isDeleted` soft-delete — no changes needed to favorites/likes filtering.

**Tech Stack:** Node.js/Express/Mongoose (backend), React/Zustand/Tailwind CSS v4 (frontend)

---

### Task 1: Backend — Add getMyPosts to postService

**Files:**
- Modify: `backend/src/services/postService.js`

- [ ] **Step 1: Add getMyPosts function**

Add after `getSavedPosts` (after line 181):

```js
export const getMyPosts = async (userId) => {
  const posts = await Post.find({ ownerUserId: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();

  const visibleCommentCounts = await getVisibleCommentCounts(posts.map((post) => post._id.toString()));

  return posts.map((p) => toPostDto({
    ...p,
    visibleCommentCount: visibleCommentCounts.get(p._id.toString()) || 0,
  }, userId));
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/postService.js
git commit -m "feat(backend): add getMyPosts service for post owner management"
```

---

### Task 2: Backend — Add mine method to postController

**Files:**
- Modify: `backend/src/controllers/postController.js`

- [ ] **Step 1: Add mine controller method**

Add after `getSaved` (after line 40):

```js
export const mine = async (req, res) => {
  const posts = await postService.getMyPosts(req.user._id.toString());
  res.json(posts);
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/postController.js
git commit -m "feat(backend): add mine controller for post owner management"
```

---

### Task 3: Backend — Add GET /api/posts/mine route

**Files:**
- Modify: `backend/src/routes/postRoutes.js`

- [ ] **Step 1: Add the route**

Add `router.get('/mine', auth, postController.mine);` BEFORE the `/:id` route (before line 13). This ordering is critical — Express matches routes in declaration order, and `/mine` must be matched before the `/:id` wildcard.

```js
import { Router } from 'express';
import * as postController from '../controllers/postController.js';
import * as reportController from '../controllers/reportController.js';
import auth from '../middlewares/auth.js';
import optionalAuth from '../middlewares/optionalAuth.js';
import checkBan from '../middlewares/checkBan.js';

const router = Router();

router.post('/', auth, checkBan, postController.create);
router.get('/', optionalAuth, postController.list);
router.get('/saved', auth, postController.getSaved);
router.get('/mine', auth, postController.mine);
router.get('/:id', optionalAuth, postController.getById);
router.delete('/:id', auth, postController.remove);
router.post('/:id/like', auth, postController.like);
router.post('/:id/save', auth, postController.save);
router.post('/:id/report', auth, reportController.create);

export default router;
```

- [ ] **Step 2: Verify backend starts without errors**

```bash
cd backend && timeout 5 npm run dev 2>&1 || true
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/postRoutes.js
git commit -m "feat(backend): add GET /api/posts/mine route"
```

---

### Task 4: Frontend — Add fetchMyPosts to postService

**Files:**
- Modify: `frontend/src/services/postService.js`

- [ ] **Step 1: Add fetchMyPosts function**

Add after `fetchSavedPosts` (after line 35):

```js
export async function fetchMyPosts() {
  return request('/api/posts/mine');
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/postService.js
git commit -m "feat(frontend): add fetchMyPosts API service"
```

---

### Task 5: Frontend — Extend postStore with myPosts state and deletePost action

**Files:**
- Modify: `frontend/src/store/postStore.js`

- [ ] **Step 1: Add myPosts to initial state and add fetchMyPosts + deletePost actions**

In the `create` call, add `myPosts: []` to the initial state object (after `loading: false,` on line 41):

```js
myPosts: [],
```

Add `fetchMyPosts` after the `fetchPosts` method (after line 57):

```js
fetchMyPosts: async () => {
  try {
    const data = await postService.fetchMyPosts();
    set({ myPosts: data });
  } catch {
    // Silently fail — page will show empty state
  }
},
```

Add `deletePost` after `fetchMyPosts`:

```js
deletePost: async (postId) => {
  await postService.deletePost(postId);
  set((state) => ({
    myPosts: state.myPosts.filter((p) => p.id !== postId),
    posts: state.posts.filter((p) => p.id !== postId),
    selectedPost: state.selectedPost?.id === postId ? null : state.selectedPost,
  }));
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/postStore.js
git commit -m "feat(frontend): add myPosts state, fetchMyPosts and deletePost to postStore"
```

---

### Task 6: Frontend — Create MyPostsPage component

**Files:**
- Create: `frontend/src/components/pages/MyPostsPage.jsx`

- [ ] **Step 1: Write MyPostsPage component**

```jsx
import React, { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import ConfirmLeaveDialog from '../common/ConfirmLeaveDialog';
import EmptyState from '../common/EmptyState';
import usePostStore from '../../store/postStore';
import useAuthStore from '../../store/authStore';

function MyPostsPage({ onNavigate }) {
  const myPosts = usePostStore((s) => s.myPosts);
  const fetchMyPosts = usePostStore((s) => s.fetchMyPosts);
  const deletePost = usePostStore((s) => s.deletePost);
  const currentUserId = useAuthStore((s) => s.user?._id);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePost(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Silently fail — post remains in list
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="collection-page max-w-[1180px] mx-auto">
      <section className="collection-hero flex items-center justify-between gap-5 max-sm:grid max-sm:grid-cols-1">
        <div>
          <p className="eyebrow mb-[18px] text-blue text-xs font-bold tracking-widest uppercase">My Posts</p>
          <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">我的帖子</h1>
          <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">管理你发布的所有帖子。</p>
        </div>
      </section>

      {myPosts.length === 0 ? (
        <EmptyState
          title="还没有发布过帖子"
          description="去首页发布你的第一篇帖子吧"
        />
      ) : (
        <section className="grid gap-3 mt-6">
          {myPosts.map((post) => {
            const isOwner = currentUserId && post.ownerUserId === currentUserId;
            return (
              <div
                key={post.id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface backdrop-blur-sm shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md"
              >
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onNavigate('detail', { selectedPost: post })}>
                  <div className="font-semibold text-text truncate">{post.title}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-text-3">
                    <span>{post.time}</span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="favorite" style={{ fontSize: '14px' }} /> {post.likes || 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="chat_bubble" style={{ fontSize: '14px' }} /> {post.comments || 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="bookmark" style={{ fontSize: '14px' }} /> {post.saves || 0}
                    </span>
                  </div>
                </div>
                {isOwner && (
                  <button
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-line rounded-full bg-white text-text-2 text-xs font-semibold transition-all duration-150 hover:border-red/40 hover:text-red hover:bg-red-soft/50"
                    onClick={() => setDeleteTarget(post)}
                    type="button"
                  >
                    <Icon name="delete" style={{ fontSize: '15px' }} />
                    删除
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <ConfirmLeaveDialog
        open={!!deleteTarget}
        title="删除帖子"
        description="确定要删除这篇帖子吗？此操作不可撤销。"
        confirmText={deleting ? '删除中...' : '确认删除'}
        cancelText="取消"
        mode="discard"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default MyPostsPage;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/pages/MyPostsPage.jsx
git commit -m "feat(frontend): add MyPostsPage component"
```

---

### Task 7: Frontend — Add "My Posts" nav item to Sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.jsx`

- [ ] **Step 1: Add myposts to navItems array**

Add `{ id: 'myposts', label: '我的帖子', icon: 'description' },` after the bookmarks entry (line 12):

```js
const navItems = [
  { id: 'home', label: '动态首页', icon: 'dynamic_feed' },
  { id: 'announcements', label: '校园公告', icon: 'campaign' },
  { id: 'drafts', label: '草稿箱', icon: 'description' },
  { id: 'likes', label: '我的喜爱', icon: 'favorite' },
  { id: 'bookmarks', label: '我的收藏', icon: 'bookmark' },
  { id: 'myposts', label: '我的帖子', icon: 'description' },
  { id: 'settings', label: '个人设置', icon: 'person' },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.jsx
git commit -m "feat(frontend): add my posts nav item to sidebar"
```

---

### Task 8: Frontend — Add myposts URL mapping to uiStore

**Files:**
- Modify: `frontend/src/store/uiStore.js`

- [ ] **Step 1: Add /myposts URL to PAGE_URLS**

Add `myposts: '/myposts',` to the `PAGE_URLS` object (after `likes`):

```js
const PAGE_URLS = {
  home: '/',
  bookmarks: '/bookmarks',
  likes: '/likes',
  myposts: '/myposts',
  announcements: '/announcements',
  drafts: '/drafts',
  // ... rest unchanged
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/uiStore.js
git commit -m "feat(frontend): add myposts URL mapping"
```

---

### Task 9: Frontend — Register MyPostsPage route in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Import MyPostsPage**

Add import after other page imports:

```js
import MyPostsPage from './components/pages/MyPostsPage';
```

- [ ] **Step 2: Add selector for myPosts**

Add after other selectors:

```js
const selectMyPosts = (s) => s.myPosts;
```

- [ ] **Step 3: Read myPosts and currentUserId**

Add after other store reads:

```js
const myPosts = usePostStore(selectMyPosts);
const currentUserId = useAuthStore((s) => s.user?._id);
```

- [ ] **Step 4: Add handleDeletePost handler**

Add before `handleComment` (before line 250):

```js
const handleDeletePost = async (postId) => {
  try {
    await usePostStore.getState().deletePost(postId);
    showToast('帖子已删除');
  } catch (err) {
    showToast(err.message || '删除失败');
  }
};
```

- [ ] **Step 5: Add MyPostsPage rendering**

Add before the `settings` route rendering (before line 342):

```js
{activePage === 'myposts' && (
  <MyPostsPage onNavigate={navigate} />
)}
```

- [ ] **Step 6: Pass isOwner and onDelete to DetailPage**

Update the DetailPage rendering to include `isOwner` prop. The `isOwner` check compares the current user's ID against the post's `ownerUserId`:

```js
const detailIsOwner = currentUserId && detailPost?.ownerUserId === currentUserId;
```

Then update the DetailPage JSX:

```jsx
{activePage === 'detail' && (
  selectedPost ? (
    <DetailPage
      post={detailPost}
      comments={comments}
      liked={detailPost?.isLiked}
      bookmarked={detailPost?.isSaved}
      isOwner={detailIsOwner}
      onLike={() => toggleLike(selectedPost.id)}
      onBookmark={() => toggleBookmark(selectedPost.id)}
      onComment={handleComment}
      onReply={handleReply}
      onDelete={(postId) => handleDeletePost(postId).then(() => navigate('home'))}
      onNavigate={navigate}
      onReport={handleReport}
    />
  ) : (
    <UnderConstruction feature="帖子详情" />
  )
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): register MyPostsPage route and wire delete in App"
```

---

### Task 10: Frontend — Update DetailPage with owner delete button

**Files:**
- Modify: `frontend/src/components/pages/DetailPage.jsx`

- [ ] **Step 1: Import ConfirmLeaveDialog**

Add import at top:

```js
import ConfirmLeaveDialog from '../common/ConfirmLeaveDialog';
```

- [ ] **Step 2: Add state for delete confirmation**

```js
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
```

- [ ] **Step 3: Replace placeholder owner-tools with conditional delete button**

Replace lines 81-86 (the placeholder `owner-tools` div):

```jsx
{isOwner && (
  <div className="owner-tools flex items-center gap-3 mt-4 p-3 rounded-md bg-surface-tint">
    <Icon name="shield_person" />
    <div className="flex-1">
      <strong className="text-sm font-bold">帖主管理</strong>
      <span className="text-text-2 text-[13px]">你可以管理这篇帖子</span>
    </div>
    <button
      className="inline-flex items-center gap-1.5 px-4 py-2 border-0 rounded-full text-white bg-red text-sm font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      onClick={() => setShowDeleteConfirm(true)}
      type="button"
    >
      <Icon name="delete" />
      删除帖子
    </button>
  </div>
)}
```

- [ ] **Step 4: Add ConfirmLeaveDialog at end of component (before closing tag)**

```jsx
<ConfirmLeaveDialog
  open={showDeleteConfirm}
  title="删除帖子"
  description="确定要删除这篇帖子吗？此操作不可撤销。"
  confirmText="确认删除"
  cancelText="取消"
  mode="discard"
  onConfirm={() => {
    setShowDeleteConfirm(false);
    onDelete(post.id);
  }}
  onCancel={() => setShowDeleteConfirm(false)}
/>
```

- [ ] **Step 5: Update function signature to accept new props**

Update the function parameter destructuring to include `isOwner` and `onDelete`:

```jsx
function DetailPage({ post, liked, bookmarked, isOwner, onLike, onBookmark, onComment, onReply, onDelete, onNavigate, onReport }) {
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/pages/DetailPage.jsx
git commit -m "feat(frontend): replace placeholder with owner delete button in DetailPage"
```

---

### Task 11: End-to-end verification

- [ ] **Step 1: Start backend and verify /api/posts/mine endpoint**

```bash
cd backend && npm run dev
```

Test: `curl http://localhost:3000/api/posts/mine` with auth cookie — should return user's posts.

- [ ] **Step 2: Start frontend and verify full flow**

```bash
cd frontend && npm run dev
```

Manual verification checklist:
1. Sidebar shows "我的帖子" nav item
2. Clicking "我的帖子" navigates to `/myposts` and shows list of user's posts
3. Empty state shows when user has no posts
4. Clicking delete on a post in MyPostsPage shows confirmation dialog
5. Confirming delete removes post from list
6. Opening own post in detail page shows owner tools with delete button
7. Non-owner viewing same post does NOT see owner tools
8. Clicking delete in detail page shows confirmation, confirming deletes and navigates to home
9. Deleted post disappears from bookmarks and likes lists (existing behavior)

- [ ] **Step 3: Commit any final tweaks**

```bash
git add -A
git commit -m "chore: final verification tweaks for post owner management"
```
