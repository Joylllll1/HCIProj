## 1. 准备工作

- [x] 1.1 安装 zustand 依赖：`cd frontend && npm install zustand`
- [x] 1.2 创建新目录结构：`store/`, `services/`, `hooks/`, `components/{pages,features,layout,common}/`

## 2. 数据访问层 — services

- [x] 2.1 实现 `services/storageService.js`：封装 localStorage 的 load/save/remove，返回 Promise
- [x] 2.2 实现 `services/postService.js`：getPosts, createPost, updateLikes, updateSaves
- [x] 2.3 实现 `services/commentService.js`：getComments, addComment
- [x] 2.4 实现 `services/reportService.js`：createReport, dismissReport
- [x] 2.5 实现 `services/notificationService.js`：getNotifications, addNotification, markAllRead
- [x] 2.6 实现 `services/eventService.js`：getPending, getApproved, getRejected, getArchived, approve, reject, archive, submit

## 3. 状态管理层 — stores（Zustand）

- [x] 3.1 实现 `store/uiStore.js`：toast, aiOpen, notifs, activePage, search query；使用 zustand persist middleware 自动持久化
- [x] 3.2 实现 `store/postStore.js`：帖子列表、点赞状态、种子数据初始化；postStore.addPost, toggleLike, filteredPosts 计算属性
- [x] 3.3 实现 `store/commentStore.js`：commentsMap、种子数据初始化；addComment
- [x] 3.4 实现 `store/bookmarkStore.js`：bookmarks、collectionFolders、bookmarkFolders；toggleBookmark, updateFolders
- [x] 3.5 实现 `store/eventStore.js`：pending/approved/rejected/archived 事件、carouselItems；approveEvent, rejectEvent, archiveEvent

## 4. 业务逻辑层 — hooks

- [x] 4.1 实现 `hooks/usePostActions.js`：openPost（设置 selectedPost + 导航到 detail）
- [x] 4.2 实现 `hooks/useLikeBookmark.js`：toggleLike（联动 postStore + uiStore），toggleBookmark（联动 bookmarkStore + uiStore + postStore）
- [x] 4.3 实现 `hooks/useEventActions.js`：approveEvent, rejectEvent, archiveEvent（联动 eventStore + uiStore + notificationService）

## 5. 重构 App.jsx

- [x] 5.1 替换 App.jsx 中的 posts 状态为 postStore，保留过滤逻辑
- [x] 5.2 替换 App.jsx 中的 commentsMap 状态为 commentStore
- [x] 5.3 替换 App.jsx 中的 bookmarks/collectionFolders/bookmarkFolders 状态为 bookmarkStore
- [x] 5.4 替换 App.jsx 中的 toasts/notifs/query/aiOpen 状态为 uiStore
- [x] 5.5 替换 App.jsx 中的 events/carouselItems 状态为 eventStore
- [x] 5.6 移除 App.jsx 中所有 useEffect 持久化和内联逻辑（toggleLike, toggleBookmark, addPost, addComment 等），改为直接从 store/hooks 调用
- [x] 5.7 清理 App.jsx：移除 SEED_POSTS, SEED_COMMENTS, SEED_REPORTS 种子数据（移至对应 store 或 service），精简到仅剩路由和布局
- [x] 5.8 验证 App.jsx 重构后所有页面功能正常（build 通过）

## 6. 组件目录重组

- [x] 6.1 移动页面组件到 `components/pages/`：HomePage, DetailPage, ComposePage, BookmarksPage, AdminPage, AnnouncementsPage, TrendingPage, SettingsPage
- [x] 6.2 移动功能组件到 `components/features/`：AIPanel, DailyFortune, DailyLuck, HeroCarousel, ReportModal
- [x] 6.3 移动布局组件到 `components/layout/`：Sidebar, TopBar, MobileNav
- [x] 6.4 移动通用组件到 `components/common/`：PostCard, Comment, Icon, Toast, EmptyState, StatCard, Progress
- [x] 6.5 更新所有组件间 import 路径
- [x] 6.6 运行 `npm run dev` 验证无编译错误，所有页面可正常渲染（build 通过）

## 7. 最终验证

- [x] 7.1 走查首页：帖子列表渲染、搜索、轮播图点击、点赞、收藏、举报
- [x] 7.2 走查详情页：帖子内容、评论列表、发评论、点赞收藏评论
- [x] 7.3 走查发帖页：新建帖子、发布成功后跳转首页
- [x] 7.4 走查收藏页：收藏列表、文件夹管理、取消收藏
- [x] 7.5 走查公告页：活动列表、提交活动申请
- [x] 7.6 走查管理员页：举报处理、活动审核、轮播图管理
- [x] 7.7 走查设置页、热门页：正常渲染无报错
- [x] 7.8 走查 Sidebar/TopBar 导航、通知、AI 面板
