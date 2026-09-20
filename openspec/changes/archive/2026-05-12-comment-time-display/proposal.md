## Why

当前评论和回复的时间显示在名字同一行，格式为 `Willow · 2分钟前 · 2026/05/12 14:58`，不够清晰。需要改成名字和时间分行显示，时间样式与帖子卡片保持一致（`text-text-3 text-xs`）。同时引用块内的时间也需要放在名字下方。

## What Changes

- **评论组件 (Comment.jsx)**：名字 `Willow` 单独一行，下方显示时间，格式 `2分钟前 · 2026/05/12 14:58`
- **回复组件 (ReplyCard.jsx)**：同上结构，时间样式与帖子卡片一致
- **引用块 (quoted-content)**：作者名一行，下方显示被引用内容的时间 `text-text-3 text-xs`
- **时间格式保持一致**：`相对时间 · 具体时间`

## Capabilities

### New Capabilities
- `comment-time-display`: 评论/回复时间显示样式调整

### Modified Capabilities
- 无

## Impact

- `frontend/src/components/common/Comment.jsx`
- `frontend/src/components/common/ReplyCard.jsx`
- 无 API 变更
- 无数据模型变更

## 非目标

- 不修改时间格式化逻辑（保持 `formatTimeAgo` 函数现有逻辑）
- 不修改引用内容的显示逻辑（仅调整时间位置）