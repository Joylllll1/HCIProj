## Why

上一版实现中，回复仍然作为子列表嵌入在父评论下方，没有实现真正的"独立回复卡片"。用户无法回复已有的回复（嵌套回复）。需要将回复卡片完全独立出来，回复逻辑与评论保持一致。

## What Changes

- 回复卡片作为独立条目，与评论卡片平级显示
- 回复卡片下方可以继续回复其他回复（嵌套回复）
- 回复卡片与评论卡片使用相同的交互逻辑：点赞、回复、举报
- 回复卡片显示被回复内容的引用（灰色背景），而非内嵌在父评论下

## Capabilities

### New Capabilities

- `flat-reply-display`: 独立回复卡片显示，回复与评论平级展示
- `nested-reply`: 支持回复已有回复，形成嵌套回复链

### Modified Capabilities

- `comment-display`: 评论卡片展示（不再包含内嵌回复列表）

## Impact

- `frontend/src/components/common/Comment.jsx`: 移除回复列表渲染
- `frontend/src/components/common/ReplyCard.jsx`: 重构为独立卡片组件
- `frontend/src/components/pages/DetailPage.jsx`: 评论列表中同时渲染评论和回复
- `frontend/src/store/commentStore.js`: 扁平化评论数据，添加独立回复列表

## 非目标

- 不修改后端 API 结构
- 不修改现有回复数据结构（仍然内嵌在评论中）
- 不涉及回复删除功能
