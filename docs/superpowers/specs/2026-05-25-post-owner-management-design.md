# 帖主管理功能 — 设计文档

## 概述

允许帖主在「我的帖子」页面和帖子详情页中删除自己的帖子。删除后沿用现有 `isDeleted` 过滤机制，收藏和喜爱列表自动联动。

## 功能范围

- **管理操作**：仅删除（暂不做编辑、关闭评论等）
- **入口**：帖子详情页（帖主可见删除按钮）+「我的帖子」列表页（侧边栏新入口）
- **删除确认**：复用 `ConfirmLeaveDialog` 弹窗确认
- **联动**：删除后后端 `isDeleted` 过滤自动处理收藏/喜爱列表，无需额外改动

## 架构

```
后端（最小改动）：
  routes/postRoutes.js        → 新增 GET /api/posts/mine
  controllers/postController.js → 新增 mine 方法
  services/postService.js     → 新增 getMyPosts(userId)

前端：
  store/postStore.js          → 新增 myPosts 状态 + deletePost + fetchMyPosts
  services/postService.js     → 新增 fetchMyPosts()
  components/pages/
    DetailPage.jsx            → 替换占位 UI，帖主可见删除按钮
    MyPostsPage.jsx           → 新建，我的帖子列表
  components/layout/
    Sidebar.jsx               → 新增「我的帖子」导航项
  App.jsx                     → 注册 MyPostsPage 路由
```

## 数据流

```
帖主身份判断：authStore.user._id === post.ownerUserId → isOwner

删除流程：
  点击删除 → ConfirmLeaveDialog 弹窗 → 确认 → postStore.deletePost(id)
  → DELETE /api/posts/:id → 后端软删除 (isDeleted=true)
  → postStore 从 myPosts 列表中移除

收藏/喜爱联动：无需改动，后端查询已过滤 isDeleted: false
  - GET /api/posts/saved → { isDeleted: false, savedBy: userId }
  - GET /api/likes（帖子） → { isDeleted: false, likedBy: userId }
  - GET /api/likes（评论/回复） → 评论保留，来源显示 [已删除]
```

## API 设计

### 新增：GET /api/posts/mine

- Auth：必须登录
- 查询：`Post.find({ ownerUserId: userId, isDeleted: false }).sort({ createdAt: -1 })`
- 返回：当前用户的帖子列表

### 已有（无需改动）：DELETE /api/posts/:id

- 后端已校验 `ownerUserId`，仅帖主可删
- 软删除：`post.isDeleted = true`

## 组件设计

### MyPostsPage（新建）

- 页面标题：「我的帖子」
- 列表展示每条帖子：标题、发布日期、互动数据（❤️💬🔖）
- 每条有删除按钮 → 点击弹出 ConfirmLeaveDialog
- 空状态：占位提示
- 点击帖子标题跳转详情页

### DetailPage（改动）

- 替换现有「帖主管理工具 (即将上线)」占位 UI
- `isOwner === true` 时渲染管理区域（含删除按钮）
- `isOwner === false` 时不渲染任何管理区域

### ConfirmLeaveDialog（复用）

```jsx
<ConfirmLeaveDialog
  open={showDeleteConfirm}
  title="删除帖子"
  description="确定要删除这篇帖子吗？此操作不可撤销。"
  confirmText="确认删除"
  cancelText="取消"
  mode="discard"
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteConfirm(false)}
/>
```

### Sidebar（改动）

新增导航项「我的帖子」，位于「我的收藏」下方。

## 状态管理

```js
// postStore 新增
myPosts: [],
fetchMyPosts: () => { ... },   // GET /api/posts/mine
deletePost: (postId) => {       // DELETE /api/posts/:id
  await postService.deletePost(postId);
  set({ myPosts: get().myPosts.filter(p => p.id !== postId) });
},
```

## 现有代码引用

- `ConfirmLeaveDialog` 组件：`frontend/src/components/common/ConfirmLeaveDialog.jsx`
- 删除 API 已存在于：`frontend/src/services/postService.js` (deletePost)
- 后端删除逻辑：`backend/src/services/postService.js` (deletePost)
- 后端保存查询：`backend/src/services/postService.js` (getSavedPosts, 行 167-181)
- 后端喜爱查询：`backend/src/services/likeService.js` (getUserLikes, 行 5-97)
- 喜爱页面已删除处理：`frontend/src/components/pages/LikesPage.jsx` (行 308-314)
- 详情页占位 UI：`frontend/src/components/pages/DetailPage.jsx` (行 81-86)
- 侧边栏：`frontend/src/components/layout/Sidebar.jsx`
- App 路由：`frontend/src/App.jsx`
- 设计系统：`frontend/src/tailwind.css`
