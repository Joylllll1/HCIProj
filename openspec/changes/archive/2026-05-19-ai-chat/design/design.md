# AI Chat 设计文档

## UI 设计

### AIPanel 布局调整

**面板尺寸**
- 宽度：380px → 480px
- 高度：保持全屏高度（top-0 bottom-0 right-0）

**布局结构**
```
┌─────────────────────────────────────────────────────┐
│ ← 返回   会话标题                    [×] 关闭       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ AI: 你好呀！今天有什么想聊的吗？           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Me: 最近学习压力好大...                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ AI: 理解你的感受...  [复制] [重新生成]       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [会话列表]  输入框...                    [发送]      │
└─────────────────────────────────────────────────────┘
```

**会话列表面板**
- 从左侧滑入，覆盖聊天区域
- 显示历史会话列表
- 每个会话项显示：标题 + 最后更新时间 + 删除按钮
- 底部有"新建会话"按钮

### 组件设计

**会话列表项**
```
┌─────────────────────────────────────────────┐
│  关于期末复习的讨论                         │
│  2分钟前                           [删除]   │
└─────────────────────────────────────────────┘
```

**AI 消息气泡**
- 左上角增加操作按钮组（复制、重新生成）
- 默认隐藏，hover 时显示
- 复制按钮：点击后复制内容到剪贴板
- 重新生成按钮：点击后重新生成回复

## API 设计

### 后端接口

#### POST /api/ai/chat
发送消息并获取 AI 回复。

**Request**
```json
{
  "sessionId": "string",
  "message": "string"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "...",
      "role": "assistant",
      "content": "...",
      "createdAt": "..."
    }
  }
}
```

#### GET /api/ai/sessions
获取当前用户的所有会话。

**Response**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "_id": "...",
        "title": "关于期末复习的讨论",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

#### GET /api/ai/sessions/:id
获取会话详情（含消息历史）。

**Response**
```json
{
  "success": true,
  "data": {
    "session": {
      "_id": "...",
      "title": "...",
      "createdAt": "..."
    },
    "messages": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
}
```

#### POST /api/ai/sessions
创建新会话。

**Response**
```json
{
  "success": true,
  "data": {
    "session": {
      "_id": "...",
      "title": "新会话",
      "createdAt": "..."
    }
  }
}
```

#### DELETE /api/ai/sessions/:id
删除会话。

**Response**
```json
{
  "success": true
}
```

#### POST /api/ai/sessions/:id/regenerate
重新生成最后一条 AI 回复。

**Response**
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "...",
      "role": "assistant",
      "content": "...",
      "createdAt": "..."
    }
  }
}
```

## 状态管理

### aiStore 设计

```javascript
{
  // 会话列表
  sessions: [],
  // 当前选中的会话
  currentSession: null,
  // 当前会话的消息列表
  messages: [],
  // 是否显示会话列表
  showSessionList: false,
  // 是否正在加载 AI 回复
  isLoading: false,

  // Actions
  fetchSessions: () => Promise<void>,
  createSession: () => Promise<Session>,
  switchSession: (sessionId) => Promise<void>,
  deleteSession: (sessionId) => Promise<void>,
  sendMessage: (content) => Promise<void>,
  regenerateMessage: () => Promise<void>,
  toggleSessionList: () => void,
}
```

## 错误处理

| 场景 | 处理 |
|------|------|
| LLM API 调用失败 | 显示"服务暂时不可用，请稍后再试" |
| 上下文超长 | 截断早期消息，保留最近 10 轮 |
| 网络中断 | 允许重试 |
| Token 耗尽 | 提示"今日额度已用完" |

## 性能考虑

- 消息列表使用虚拟滚动（如果消息很多）
- 会话列表只加载最近 20 个
- 分页加载历史消息（先加载最近 50 条）
