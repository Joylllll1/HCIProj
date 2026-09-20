# 编码规范

> 本文件定义项目代码编写规范，确保团队代码风格一致。

## 后端编码规范

### 目录结构

```
backend/src/
├── routes/          # 路由：只做路由分发
├── controllers/     # 控制器：参数校验 + 调用 Service + 组装响应
├── services/        # 服务：核心业务逻辑
├── models/          # Mongoose 模型定义
├── middlewares/     # 中间件：认证、校验、限流
└── utils/           # 工具函数
```

### Controller 模板

```javascript
// postController.js
const postService = require('../services/postService');

exports.createPost = async (req, res, next) => {
  try {
    const { content, tags, emotion, isAnonymous } = req.body;
    const userId = req.user.id;
    const post = await postService.createPost({ userId, content, tags, emotion, isAnonymous });
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};
```

### Service 模板

```javascript
// postService.js
const Post = require('../models/Post');
const anonymousService = require('./anonymousService');

exports.createPost = async ({ userId, content, tags, emotion, isAnonymous }) => {
  const post = await Post.create({ author: userId, content, tags, emotion });

  if (isAnonymous) {
    const anonId = await anonymousService.generateId(userId, post._id);
    post.anonymousId = anonId;
    await post.save();
  }

  return post;
};
```

### 统一响应格式

```javascript
// 成功
{ success: true, data: { ... } }

// 失败
{ success: false, error: { code: 'VALIDATION_ERROR', message: '参数校验失败', details: [...] } }

// 分页
{ success: true, data: { items: [...], total: 100, page: 1, totalPages: 5 } }
```

### 错误码使用

不要直接抛 HTTP 状态码，使用自定义 AppError：

```javascript
class AppError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

// 使用
throw new AppError('NOT_FOUND', '帖子不存在', 404);
throw new AppError('UNAUTHORIZED', '未登录或 Token 无效', 401);
throw new AppError('USER_MUTED', '用户已被禁言', 403);
```

## 前端编码规范

### 组件模板

```jsx
// PostCard.jsx
import { usePosts } from '../../hooks/usePosts';

export function PostCard({ post }) {
  const { toggleLike } = usePosts();

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <p className="text-gray-800">{post.content}</p>
      <button onClick={() => toggleLike(post._id)}>
        {post.isLiked ? '取消赞' : '点赞'}
      </button>
    </div>
  );
}
```

### Hook 模板

```javascript
// usePosts.js
import { usePostStore } from '../store/postStore';

export function usePosts() {
  const { posts, fetchPosts, createPost, toggleLike } = usePostStore();

  return { posts, fetchPosts, createPost, toggleLike };
}
```

### Zustand Store 模板

```javascript
// postStore.js
import { create } from 'zustand';
import * as postService from '../services/postService';

export const usePostStore = create((set, get) => ({
  posts: [],
  loading: false,

  fetchPosts: async (params) => {
    set({ loading: true });
    try {
      const data = await postService.getList(params);
      set({ posts: data.items });
    } finally {
      set({ loading: false });
    }
  },

  toggleLike: async (postId) => {
    await postService.toggleLike(postId);
    // 更新本地状态
  },
}));
```

### Tailwind CSS 规范

- 使用项目配置的间距刻度：4-8-12-16-20-24-32px
- 使用项目配置的颜色系统（Apple/Notion 风格）
- 不写自定义 CSS，优先用 Tailwind 原子类组合

## 与当前代码的差异

> ⚠️ 以上规范是**目标代码风格**。当前前端代码处于演进阶段，与服务端模板存在差异：

| 方面 | 规范要求 | 当前代码实际 |
|------|---------|-------------|
| 状态管理 | Zustand Store 调用 | `useState` + `useEffect` + `localStorage` |
| 数据获取 | Axios Services 层调用 | `loadJSON/saveJSON` 读写 localStorage |
| 组件逻辑 | 通过 Hooks 调用 | 逻辑直接写在组件内 |
| 后端代码 | 分层写法 | 后端 src/ 尚未创建 |

编写新代码时**优先遵循规范**（使用 Zustand/hooks/services 分层）；修改旧代码时逐步迁移，不要求一次性重构。

## 通用规范

- JavaScript 全项目使用 camelCase
- 异步操作使用 async/await，不用 .then() 链
- 环境变量通过 dotenv 管理，敏感值不硬编码
