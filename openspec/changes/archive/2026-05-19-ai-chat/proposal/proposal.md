# AI Chat 功能

## 背景

树洞需要一个内嵌的 AI 聊天功能，为用户提供情绪陪伴和智能对话能力。未来可扩展为深度集成树洞的 AI Agent。

## 目标

- 提供基础的 AI 对话功能
- 支持多轮对话上下文记忆
- 会话管理（新建、切换、删除）
- 对话记录持久化到数据库
- 扩大 AIPanel 面板尺寸，更好利用屏幕空间

## 范围

### 包含

1. **基础对话** - 用户输入 → LLM API → 显示回复（非流式）
2. **多轮上下文** - 保留对话历史，支持连续对话
3. **重新生成** - 对 AI 回复不满意可重新生成
4. **复制消息** - 复制 AI 回复内容
5. **会话管理** - 新建/切换/删除会话
6. **自动标题** - 根据首条消息自动生成会话标题
7. **持久化存储** - 对话记录存入数据库
8. **面板扩大** - AIPanel 宽度从 380px 扩大到 480px

### 不包含（后续迭代）

- 流式输出
- 快捷提示词
- 引用帖子/评论
- AI 发帖/总结等 Agent 能力

## 技术方案

### 后端

1. **新增 AI 服务模块**
   - `backend/src/services/aiService.js` - LLM API 调用封装
   - 支持 .env 配置 API Key

2. **新增 AI 路由**
   - `POST /api/ai/chat` - 发送消息，返回 AI 回复
   - `GET /api/ai/sessions` - 获取用户会话列表
   - `GET /api/ai/sessions/:id` - 获取会话详情（含消息历史）
   - `POST /api/ai/sessions` - 新建会话
   - `DELETE /api/ai/sessions/:id` - 删除会话
   - `POST /api/ai/sessions/:id/regenerate` - 重新生成最后一条 AI 回复

3. **新增数据模型**
   - `AISession` - 会话模型（title, userId, createdAt）
   - `AIMessage` - 消息模型（sessionId, role, content, createdAt）

### 前端

1. **重构 AIPanel**
   - 扩大面板宽度 380px → 480px
   - 添加会话列表侧边栏
   - 消息气泡增加复制、重新生成按钮
   - 集成后端 API

2. **新增 Store**
   - `aiStore.js` - 管理当前会话、消息列表、会话列表

3. **新增 Service**
   - `aiService.js` - AI 相关 API 调用

## 用户流程

### 基础对话

```
用户打开 AI Panel → 显示当前会话（或新建）
用户输入消息 → 发送到后端 → LLM 生成回复 → 显示在界面上
用户可点击"复制"或"重新生成"
```

### 会话管理

```
用户点击会话列表图标 → 显示历史会话
点击某个会话 → 切换到该会话
点击"新建会话" → 创建空白会话
点击"删除" → 确认后删除会话
```

## 数据模型

### AISession

```javascript
{
  _id: ObjectId,
  user: ObjectId,      // 关联用户
  title: String,       // 会话标题（自动生成）
  createdAt: Date,
  updatedAt: Date
}
```

### AIMessage

```javascript
{
  _id: ObjectId,
  session: ObjectId,   // 关联会话
  role: String,        // 'user' | 'assistant'
  content: String,     // 消息内容
  createdAt: Date
}
```

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| LLM API 费用 | 设置单用户每日调用上限 |
| 上下文 Token 限制 | 只保留最近 N 轮对话 |
| API Key 泄露 | 后端代理调用，不暴露给前端 |

## 验收标准

- [ ] 用户可以与 AI 进行多轮对话
- [ ] 对话历史在刷新页面后仍然保留
- [ ] 可以创建、切换、删除会话
- [ ] 会话标题自动生成
- [ ] 可以复制 AI 回复
- [ ] 可以重新生成 AI 回复
- [ ] AIPanel 宽度扩大到 480px
