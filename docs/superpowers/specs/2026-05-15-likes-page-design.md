# 我的喜爱页面设计

## 概述

为 NJU 树洞添加"我的喜爱"页面，展示用户点赞过的帖子、评论和回复。

## 路由与入口

| 项目 | 值 |
|------|-----|
| URL | `/likes` |
| 侧边栏名称 | 我的喜爱 |
| 侧边栏图标 | favorite (爱心) |
| 侧边栏位置 | 校园公告 和 我的收藏 之间 |

## 页面结构

使用 Tab 切换：
- **帖子** - 点赞的帖子列表
- **评论** - 点赞的评论和回复列表

## 帖子 Tab

展示方式与现有 HomePage 一致，使用 PostCard 组件。

API: `GET /api/likes` 返回的 `posts` 数组

数据映射：
```
post.id           → PostCard post.id
post.title        → PostCard post.title
post.content      → PostCard post.content
post.image        → PostCard post.image
post.images       → PostCard post.images
post.tags         → PostCard post.tags
post.mood         → PostCard post.mood
post.likes        → PostCard likes
post.comments     → PostCard comments
post.saves        → PostCard saves
post.createdAt    → PostCard createdAt
post.isLiked      → true (固定)
```

点击卡片 → 跳转至详情页 `/:id`

## 评论 Tab

展示用户点赞过的评论和回复，带上下文信息。

API: `GET /api/likes` 返回的 `comments` 数组

数据映射：
```
item.type           → 判断是 comment 还是 reply
item.id            → 评论/回复 ID
item.content       → 评论/回复内容
item.likes         → 点赞数
item.createdAt     → 时间
item.official      → 是否博主回复
item.isLiked       → true (固定)
postId             → 所属帖子 ID (跳转用)
postTitle          → 帖子标题 (显示上下文)
parentCommentId    → 父评论 ID (回复专属)
```

每条展示为卡片样式：
```
┌─────────────────────────────────────┐
│ 帖子标题                    2分钟前  │
├─────────────────────────────────────┤
│ 💬 评论内容...                      │
│ ♥ 12                              │
└─────────────────────────────────────┘
```

点击卡片 → 跳转至详情页并定位到对应评论

## 交互逻辑

1. 进入页面默认显示"帖子"Tab
2. 点击 Tab 切换内容
3. 帖子卡片点击 → onOpenPost 跳转详情
4. 评论卡片点击 → onOpenPost 跳转详情（传入评论 ID 定位）
5. 点赞/收藏/举报按钮暂时禁用或显示禁用态（因为已不再当前页面）

## 空状态

- 帖子 Tab 空：`还没有赞过的帖子`
- 评论 Tab 空：`还没有赞过的评论`

## 入口与路由注册

在 frontend/src/App.jsx 中：
1. 在 Sidebar 添加 "我的喜爱" 入口
2. 注册路由 `/likes` → LikesPage 组件
3. 在顶部导航根据 `activePage === 'likes'` 渲染 LikesPage

## 实现任务

1. 创建 LikesPage.jsx（复制 BookmarksPage 结构，改为 Tab 切换）
2. 注册路由 `/likes` 并添加侧边栏入口
3. 调用 `GET /api/likes` 获取数据
4. 解析 posts 和 comments 分别展示
5. PostCard 固定 isLiked 为 true
6. 评论卡片点击跳转详情并定位到评论位置