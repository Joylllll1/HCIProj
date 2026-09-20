## Context

当前前端代码架构与目标架构存在较大差距：

- **状态层**: 所有 11 个 `useState` 集中在 `App.jsx`（482 行），外加 11 个 `useEffect` 做 localStorage 持久化，以及内联的种子数据
- **数据访问**: `loadJSON`/`saveJSON` 调用散落在 App 和各组件中，无统一出口
- **业务逻辑**: 点赞、收藏、评论、发帖等操作逻辑全部在 `App.jsx` 中定义，通过 props 层层透传（props drilling）
- **组件组织**: 23 个组件平铺在 `components/` 下，页面、功能、布局、通用组件无区分

本次设计覆盖前端代码从扁平结构到分层架构的完整迁移方案。

## Goals / Non-Goals

**Goals:**
- 建立四层组件目录：`pages/`、`features/`、`layout/`、`common/`
- 引入 Zustand 管理全局状态：postStore、commentStore、bookmarkStore、uiStore 等
- 创建 `services/` 层封装所有数据访问（localStorage，预留 Axios 替换接口）
- 创建 `hooks/` 层提取可复用的业务逻辑
- 消除 `App.jsx` 中的 props drilling 和内联业务逻辑
- 保持所有现有 UI、交互、数据完全不变

**Non-Goals:**
- 不引入 React Router（保持 activePage 路由）
- 不改动任何组件渲染输出（DOM 结构、class、样式完全不变）
- 不涉及后端代码
- 不改变 localStorage 存储 key 格式和数据 schema（用户数据无缝迁移）
- 不引入 TypeScript

## Decisions

### D1: Zustand 作为状态管理方案

- **选择**: 安装 `zustand`，替代当前 `useState` + `useEffect` + localStorage 模式
- **理由**: 架构文档（ADR-003）已明确选择 Zustand；轻量（~1KB），无 boilerplate，支持 middleware（persist）可直接替代当前 localStorage 持久化
- **备选**: Redux Toolkit（过重），Context API（性能问题，无 middleware 支持），Jotai（atom 粒度对当前状态规模过度）

### D2: Store 拆分粒度

- **决策**: 按领域拆分为 5 个 store：
  - `postStore` — 帖子列表、当前帖子、筛选、种子数据初始化
  - `commentStore` — 评论映射表
  - `bookmarkStore` — 收藏列表、收藏文件夹
  - `eventStore` — 活动相关（pending/approved/rejected/archived）
  - `uiStore` — toast、AI 面板开关、通知、搜索查询
- **理由**: 每个 store 独立演化；后续对接后端时可按 store 逐个替换数据源；粒度适中，不过度拆分

### D3: Services 层设计

- **决策**: 创建 `services/storageService.js`（localStorage 封装）和 `services/` 中各领域 service（如 `postService.js`）
- **接口风格**: 所有 service 方法返回 Promise（即使当前是同步的 localStorage），以便后续无缝替换为 Axios 调用
- **种子数据**: 由各领域的 service 或 store 的默认值初始化，不再放在 App.jsx 中

### D4: 组件分层标准

| 层 | 目录 | 包含组件 | 依赖 |
|---|---|---|---|
| Common | `components/common/` | Icon, Toast, EmptyState, StatCard, Progress, PostCard, Comment, ReportModal, DailyFortune, DailyLuck, HeroCarousel, FolderSelector | 仅 UI 组件，无业务依赖 |
| Layout | `components/layout/` | Sidebar, TopBar, MobileNav | 依赖 store（通知、用户） |
| Features | `components/features/` | AIPanel, DailyFortune, DailyLuck（功能组件） | 依赖 store + services |
| Pages | `components/pages/` | HomePage, DetailPage, ComposePage, BookmarksPage, AdminPage, AnnouncementsPage, TrendingPage, SettingsPage | 依赖 store + hooks |

### D5: 迁移顺序

增量迁移，分 5 步，每步可独立 merge 和验证：
1. 安装 zustand → 创建 store 目录和 uiStore（零风险，as-only-additive）
2. 创建 services 层 → 将 localStorage 读写集中化
3. 创建 hooks 层 → 提取可复用业务逻辑
4. 拆分其他 store（post, comment, bookmark, event）→ 替换 App.jsx 中的 useState
5. 组件目录重组织 → 创建子目录，移动文件，更新 import 路径

## Risks / Trade-offs

- **[风险] 步骤 4（拆分 store）改动量最大，可能遗漏某个状态的迁移** → 迁移后功能完整性测试：逐页面验证所有交互（发帖、点赞、收藏、评论、搜索、管理操作）
- **[风险] 组件路径变更后，IDE/编辑器缓存可能导致旧 import 解析失败** → 一次性完成步骤 5，确保所有 import 同时更新，运行 `npm run dev` 验证无编译错误
- **[风险] 步骤 4 和 5 同时进行可能产生大量冲突** → 严格按顺序执行，每步完成后 commit，步骤间不跨步改动
- **[权衡] 引入 zustand 增加了依赖** → 但移除的是手动管理 localStorage 的 boilerplate，净减少代码量
- **[权衡] 当前所有组件入参从 props 改为直接从 store/hooks 读取** → 短期需要修改组件签名，长期减少 props drilling

## Migration Plan

1. **部署**: 逐步提交，每步都是可运行状态。最终 commit 后 `npm run dev` 验证所有页面功能正常
2. **回滚**: 每步都有独立 commit，出问题 `git revert` 单个 commit 即可
3. **验证**: 手动走查首页、详情、发帖、收藏、公告、热门、设置、管理员各页面核心交互

## Open Questions

1. `Sidebar` 和 `TopBar` 当前通过 props 接收 `activePage` 和回调函数，迁移后转为从 store 读取还是继续通过 App.jsx 传入？ — 建议继续保持从 App.jsx 传入（activePage 本质是路由状态），但 `notifs` 改为从 store 读取。
