## Why

当前回复与评论混合在同一输入框中，用户体验不清晰。需要将回复功能独立出来，改为独立回复卡片形式显示，增强回复的可识别性和操作便捷性。

## What Changes

- 回复输入框点击后滚动到页面顶部显示
- 回复内容以独立卡片形式展示，不附在父评论下方
- 回复卡片结构（从上到下）：被回复的评论/回复（灰色背景）、回复者名称、回复内容、点赞和回复操作
- 回复与评论在视觉上完全分离

## Capabilities

### New Capabilities

- `reply-card`: 回复卡片独立展示功能，包含被回复内容引用、回复者信息、回复内容、操作按钮

### Modified Capabilities

- `comment-display`: 评论展示（移除现有的嵌入回复列表，改为独立卡片形式）

## Impact

- `frontend/src/components/pages/DetailPage.jsx`: 回复输入框逻辑重构
- `frontend/src/components/common/Comment.jsx`: 回复列表展示方式调整
- `frontend/src/store/commentStore.js`: 回复数据结构可能需要调整

## 非目标

- 不修改后端 API 结构
- 不修改现有的点赞逻辑
- 不涉及评论删除功能
