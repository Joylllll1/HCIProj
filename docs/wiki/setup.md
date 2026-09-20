# 环境搭建指南

## 前置要求

- Node.js >= 18
- npm（随 Node.js 安装）
- MongoDB（本地或远程实例，后端对接时再配置）

## 前端

```bash
cd frontend
npm install        # 安装依赖
npm run dev        # 启动开发服务器，默认 http://localhost:5173
npm run build      # 生产构建
npm run preview    # 预览生产构建
```

前端的匿名种子与少量纯展示状态仍会使用浏览器本地存储，但登录态和正式业务数据依赖后端 API 与 MongoDB。

当前开发模式默认依赖同源 `/api` 访问：

- 浏览器实际访问前端地址，例如 `http://localhost:5173`
- 前端开发服务器通过 Vite 代理把 `/api/*` 转发到 `http://localhost:3001`
- 登录态基于 HTTP-only cookie，不再依赖 `localStorage` 中的 token

## 后端

```bash
cd backend
npm install        # 安装依赖
npm run dev        # 启动开发服务器（nodemon 热重载），默认 http://localhost:3001
npm run start      # 生产启动
```

### 环境变量（后端）

在 `backend/` 下创建 `.env` 文件：

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/treehole
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

可选 cookie 相关变量：

```env
COOKIE_SAME_SITE=lax
ACCESS_COOKIE_MAX_AGE_MS=900000
REFRESH_COOKIE_MAX_AGE_MS=604800000
```

## 运行检查清单

- [x] 前端 `npm run dev` 启动成功 → 浏览器访问 http://localhost:5173
- [ ] 后端 `npm run dev` 启动成功 → 访问 http://localhost:3001/api/health
- [ ] MongoDB 连接正常 → 后端日志显示连接成功

## 常见问题

### 前端页面没有数据？

首次加载时部分前端种子数据会自动写入本地存储。如果清空浏览器存储，刷新页面后会重新初始化这些纯前端数据；登录态会随 cookie 一起失效，需要重新登录。

### 为什么前端请求都写成 `/api/...`，却能打到 3001？

开发环境下这是 Vite 代理在转发，不是前端直接跨域请求后端。当前 cookie 登录态依赖这种同源访问模型；如果你把前端页面和后端 API 放到不同 origin，又不补跨域 cookie 配置，登录态会失效。

### 前端修改后不热更新？

确认由 Vite 启动开发服务器（默认 5173 端口），非直接打开 HTML 文件。

### 后端报 ESM 相关错误？

确认 `backend/package.json` 包含 `"type": "module"`，后端使用 ES Module 规范（`import`/`export` 语法）。
