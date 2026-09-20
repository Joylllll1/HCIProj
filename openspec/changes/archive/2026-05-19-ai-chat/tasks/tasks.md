# AI Chat 任务清单

## 后端

- [x] 创建 AI 会话模型 `AISession`
- [x] 创建 AI 消息模型 `AIMessage`
- [x] 实现 `aiService.js` - LLM API 调用封装
- [x] 实现 `aiController.js` - AI 控制器
- [x] 实现 `aiRoutes.js` - AI 路由
- [x] 配置 .env 支持 LLM API Key

## 前端

- [x] 创建 `aiService.js` - AI 相关 API 调用
- [x] 创建 `aiStore.js` - AI 状态管理
- [x] 重构 `AIPanel.jsx` - 扩大面板宽度（380px → 480px）
- [x] 实现会话列表组件
- [x] 实现消息气泡组件（含复制、重新生成按钮）
- [x] 集成后端 API - 对话功能
- [x] 集成后端 API - 会话管理
- [x] 实现自动生成会话标题

## 验收

- [ ] 端到端测试 AI 对话功能
- [ ] 测试会话管理功能
- [ ] 测试持久化存储
