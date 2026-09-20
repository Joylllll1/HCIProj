## Context

当前评论和回复的名字+时间在同一行，格式 `Willow · 2分钟前 · 2026/05/12 14:58`，帖子卡片中名字和时间是分行显示的（名字 `text-sm`，时间 `text-text-3 text-xs`）。需要统一评论/回复的布局与帖子卡片一致。

当前帖子卡片的用户信息结构：
```
<div>
  <strong className="block text-sm">{authorName}</strong>
  <span className="block mt-0.5 text-text-3 text-xs">{formatTimeAgo(post.createdAt)}</span>
</div>
```

## Goals / Non-Goals

**Goals:**
- 评论/回复：名字和时间分行，时间在名字下方
- 时间样式与帖子卡片一致（`text-text-3 text-xs`）
- 引用块内：作者名一行，时间在下方，同样 `text-text-3 text-xs`

**Non-Goals:**
- 不修改 `formatTimeAgo` 函数逻辑
- 不修改帖子卡片的时间显示
- 不涉及后端变更

## Decisions

**1. 评论/回复名字+时间布局**

将当前 `<strong>{name} · {time}</strong>` 改为：
```jsx
<div>
  <strong className="block text-sm">{displayName}</strong>
  <span className="block mt-0.5 text-text-3 text-xs">{formatTimeAgo(comment.createdAt)}</span>
</div>
```

与帖子卡片结构完全一致：`text-sm` 名字 + `text-text-3 text-xs` 时间。

**2. 引用块内时间位置**

引用块当前结构：名字 → 内容 → 时间（底部）。改为：名字 → 时间 → 内容。
```jsx
<div className="quoted-content p-2 mb-3 rounded-md bg-[#f5f5f5] border border-[#e0e0e0] text-text-2 text-sm">
  <div>
    <strong className="text-text text-sm">{parentAuthorName}</strong>
    <span className="block mt-0.5 text-text-3 text-xs">{formatTimeAgo(reply.parentTime)}</span>
  </div>
  <div className={isLongContent && !expanded ? 'line-clamp-2' : ''}>
    {displayContent}
  </div>
</div>
```

与帖子卡片时间样式完全一致：`text-text-3 text-xs`。

## Risks / Trade-offs

- 名字+时间分行会使卡片高度略微增加 → 可接受，与帖子卡片风格统一