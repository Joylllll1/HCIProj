## Why

当前前端代码将所有状态、业务逻辑和页面路由集中在一个 482 行的 `App.jsx` 中，23 个组件全部平铺在 `components/` 下。随着功能迭代，这种扁平结构导致：
- `App.jsx` 持续膨胀，难以维护
- 组件间职责不清，页面组件和通用 UI 组件混在一起
- 状态管理散落各处，`useState` + `useEffect` + `localStorage` 的 pattern 在每个数据变更处重复
- 后续对接后端 API 时，数据访问逻辑没有统一的出口

本次变更是纯重构，不改变任何用户可见功能。

## What Changes

- **安装 zustand** 作为全局状态管理方案
- **创建 store 层**（`store/`）：将 `App.jsx` 中的状态拆分到对应 store（authStore, postStore, commentStore, uiStore, bookmarkStore 等）
- **创建 services 层**（`services/`）：封装所有数据读写逻辑（当前为 localStorage，后续可替换为 Axios 调用）
- **创建 hooks 层**（`hooks/`）：提取组件可复用的业务逻辑
- **重组组件目录**（`components/` → `components/{pages,features,layout,common}/`）：按职责分层归类
- **保持所有现有功能完整不变**

非目标：
- 不引入 React Router（保持当前 `activePage` 路由机制）
- 不改动任何 UI 样式、交互逻辑、功能行为
- 不涉及后端代码
- 不破坏现有 localStorage 数据格式（用户已有数据无缝迁移）

## Capabilities

### New Capabilities
- `store-layer`: Zustand 全局状态管理，将帖子、评论、收藏、UI 等状态拆分到独立 store，消除 App.jsx 状态集中问题
- `service-layer`: 统一的数据访问服务层，当前封装 localStorage 读写，未来可替换为 Axios API 调用
- `hook-layer`: 自定义 hooks 封装业务逻辑（如帖子操作、点赞收藏、评论等），减少组件内重复代码
- `component-restructure`: 组件目录按 Pages / Features / Layout / Common 四层重新组织

### Modified Capabilities
<!-- 本次为纯架构重构，不涉及 spec 级别的行为变更 -->
（无）

## Impact

- **新增依赖**: `zustand`（npm 包）
- **新增目录**: `frontend/src/store/`, `frontend/src/services/`, `frontend/src/hooks/`
- **新增子目录**: `frontend/src/components/pages/`, `frontend/src/components/features/`, `frontend/src/components/layout/`, `frontend/src/components/common/`
- **修改文件**: `App.jsx` — 从状态集中管理改为从 store 读取，从 props 透传改为直接使用 hooks
- **移动文件**: 23 个 `.jsx` 组件文件从 `components/` 移动到对应分层子目录
- **删除文件**: `frontend/src/styles.css.bak`（已从 git 追踪移除，实际文件存在于磁盘）
- **零用户感知变化**: 所有 UI、交互、数据完全不变
