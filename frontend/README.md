# NJU 树洞 - Frontend

> 面向南京大学师生的半匿名表达、互助交流与内容治理平台（前端项目）

## 项目概述

这是 NJU 树洞系统的前端项目，采用现代化的 React 技术栈构建，提供简洁优雅的用户界面，支持匿名发帖、评论互动、收藏管理、活动公告等功能。

## 技术栈

### 核心框架
- **React 18.2** - UI 框架
- **Vite 5.0** - 构建工具
- **Tailwind CSS 4.2** - 样式框架

### 开发工具
- **ESLint** - 代码检查
- **@vitejs/plugin-react** - React 支持

## 功能模块

### 已实现功能

#### 核心功能
- **首页** - 帖子流浏览、搜索、轮播图
- **详情页** - 帖子详情、评论、互动
- **发布页** - 匿名发帖、情绪标签、图片上传
- **热门页** - 热门内容推荐

#### 互动功能
- **点赞** - 帖子点赞功能
- **评论** - 评论与回复
- **收藏** - 收藏夹管理（支持文件夹分类）
- **举报** - 内容举报机制

#### 扩展功能
- **活动公告** - 校园活动发布与审核
- **管理员后台** - 举报处理、活动审核、轮播图管理
- **每日运势** - DailyFortune 每日幸运卡片
- **AI 面板** - AI 辅助功能入口
- **设置页** - 用户设置

#### AI Persona 设置
- AI 面板顶部提供聊天风格入口，进入全屏覆盖式设置页
- 支持配置角色、语气、直接程度、回复长度和额外要求
- 支持两种保存范围：设为用户默认，或仅对当前会话生效
- 所有字段都允许留空，运行时会按 `会话覆盖 > 用户默认 > 系统默认` 逐字段兜底
- 用户只能编辑结构化 persona 字段，不能直接修改系统 base prompt 和安全边界

### 组件库

```
components/
├── AdminPage.jsx          # 管理员后台
├── AIPanel.jsx            # AI 面板
├── AnnouncementsPage.jsx  # 活动公告页
├── BookmarksPage.jsx      # 收藏页
├── Comment.jsx            # 评论组件
├── ComposePage.jsx        # 发布页
├── DailyFortune.jsx       # 每日运势
├── DetailPage.jsx         # 详情页
├── HomePage.jsx           # 首页
├── HeroCarousel.jsx       # 轮播图
├── PostCard.jsx           # 帖子卡片
├── ReportModal.jsx        # 举报弹窗
├── SettingsPage.jsx       # 设置页
├── Sidebar.jsx            # 侧边栏导航
├── TopBar.jsx             # 顶部栏
├── TrendingPage.jsx       # 热门页
└── ...
```

## 设计系统

项目采用混合设计系统，结合 Apple 风格的视觉精致度与 Notion 风格的生产力结构：

### 设计原则
- 使用白色空间提升可读性
- 模块化组件结构
- 蓝色作为主要操作色
- 简洁干净的布局

### 颜色系统
- **主色**: `#0071e3` (品牌蓝)
- **背景**: `#ffffff` / `#f5f5f7`
- **文本**: `rgba(0,0,0,0.9)` / `rgba(0,0,0,0.6)`
- **情绪标签**: 宁静(teal)、快乐(green)、焦虑(orange)、忧伤(purple/pink)

详细设计规范请参考 [`design.md`](./design.md)

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

自动修复：
```bash
npm run lint:fix
```

## 项目结构

```
frontend/
├── src/
│   ├── components/      # React 组件
│   ├── App.jsx          # 应用主入口
│   ├── main.jsx         # React 挂载点
│   ├── utils.js         # 工具函数
│   └── tailwind.css     # 全局样式
├── public/              # 静态资源
├── index.html           # HTML 入口
├── vite.config.js       # Vite 配置
├── tailwind.config.js   # Tailwind 配置
├── .eslintrc.cjs        # ESLint 配置
├── design.md            # 设计系统文档
└── package.json         # 项目配置
```

## 数据持久化

当前版本使用 `localStorage` 进行数据持久化，存储内容包括：
- 帖子数据 (`nju_posts`)
- 评论数据 (`nju_comments`)
- 收藏数据 (`nju_bookmarks`)
- 点赞数据 (`nju_liked`)
- 通知数据 (`nju_notifs`)
- 活动数据 (`nju_pending_events`, `nju_approved_events`)
- 收藏夹数据 (`nju_bookmark_folders`)

后续将对接后端 API 实现服务端持久化。

## 浏览器支持

- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)

## 团队成员

王祎、王嘉乐、邱添、张浩宇

## 相关文档

- [主项目 README](../README.md)
- [设计系统文档](./design.md)
- [需求规格说明书](../docs/P1/需求规格说明书/NJU%20树洞系统需求规格说明书.md)
