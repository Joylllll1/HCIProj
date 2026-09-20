# Landing Page 设计文档

> 为 NJU 树洞系统设计一个项目落地页，作为未登录用户的第一视觉入口。

## 1. 设计目标

### 1.1 要解决的核心问题

当前系统没有"未登录态"的概念：用户首次访问时，后台自动生成匿名 ID（`getUserId()`），直接进入主应用界面（Sidebar + TopBar + 帖子列表）。这意味着：

- 新用户打开页面时**不知道这是什么**，没有产品介绍
- 没有注册/登录流程，无法区分访客与注册用户
- 缺乏品牌传达的机会

### 1.2 落地页的目标

1. **告知**：3 秒内让用户明白 NJU 树洞是什么
2. **吸引**：通过情感共鸣让用户产生"想试试"的意愿
3. **转化**：点击"开始使用"进入主应用
4. **品牌传递**：传达温暖、安全、低压的产品气质

### 1.3 非目标

- ❌ 不是功能说明书（不逐条列举所有功能）
- ❌ 不是调研报告展示（不直接贴问卷/访谈原始数据）
- ❌ 不是注册表单（不在此页面收集用户信息）
- ❌ 不改变现有 `activePage` 路由模式

---

## 2. 页面结构

### 2.1 完整布局

```
┌──────────────────────────────────────────────────────────┐
│  [● NJU 树洞]                           登录  |  注册    │ ← 导航栏
│                                                          │
│                                                          │
│                    NJU 树洞                                │
│                校园里的匿名说话角落                         │
│                                                          │
│               半匿名表达 · 低压交流 · 有边界的自由            │
│                                                          │
│                     [ 开始使用 ]                          │ ← 主 CTA
│                                                          │
│                      ↓                                   │ ← scroll indicator
├──────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │ ← Feature 区
│  │ 帖子级匿名    │  │ 低压表达      │  │ 有边界的自由  │   │
│  │              │  │              │  │              │   │
│  │ 同一帖子内    │  │ 想求共鸣就   │  │ 举报+审核     │   │
│  │ 身份一致      │  │ 互动         │  │ +身份追溯     │   │
│  │ 不同帖子      │  │ 只想记录就   │  │ 不失控        │   │
│  │ 互相隔离      │  │ 不被打扰     │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
├──────────────────────────────────────────────────────────┤
│  "有时候就是不想让熟人看到，但又想说"                      │ ← 用户声音区
│                        — NJU 在校生                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                     NJU 树洞                               │
│                 在这里说说心里话                            │
│                                                          │
│              © 2026 NJU树洞 · 关于我们 · 隐私政策          │ ← Footer
└──────────────────────────────────────────────────────────┘
```

### 2.2 区块详情

#### 2.2.1 导航栏（Nav Bar）

| 属性 | 值 |
|------|-----|
| 位置 | 页面顶部，固定（sticky/fixed） |
| 高度 | 56px |
| 背景 | 透明（Hero 区深色背景上透明，滚动后可有轻微毛玻璃效果） |
| 左侧 | Logo: `brand-mark`（暖色渐变正方形）+ "NJU 树洞" 文字 |
| 右侧 | "登录 | 注册" 纯文字链接，`text-white/70 hover:text-white`，不是按钮样式 |
| 交互 | 滚动超过 Hero 后，导航添加 `bg-white/60 backdrop-blur-md`，文字链接变为 `text-text-2` |
| CTA 克制策略 | 导航区只放两个轻量文字入口，不反复出现注册按钮。主 CTA 仅 Hero 区一个 |

#### 2.2.2 Hero 区

| 属性 | 值 |
|------|-----|
| 高度 | 100vh（或 min-height: 600px），垂直居中内容 |
| 背景 | `linear-gradient(135deg, #3d2a30 0%, #5a3845 50%, #6d4555 100%)` |
| 原标题 | "NJU 树洞"，`clamp(40px, 6vw, 64px)`，`font-weight: 800`，白色 |
| 副标题 | "校园里的匿名说话角落"，`clamp(18px, 2.5vw, 24px)`，白色/80% |
| 标签行 | "半匿名表达 · 低压交流 · 有边界的自由"，`14px`，白色/60%，`letter-spacing: 0.05em` |
| 主 CTA | `primary-button` 样式，"开始使用"，点击 → 进入 home |
| 引导指示 | 底部居中，向下箭头动画（`animate-bounce`） |

##### 背景渐变说明

深暖色色值取自现有设计系统的暖调延伸：

```
#3d2a30 — 深褐紫（接近巧克力棕）
#5a3845 — 暖红褐（类似干燥玫瑰色）
#6d4555 — 浅紫褐（过渡到暖色主体背景）
```

这是暖色系往深走的自然延伸，与现有 `--color-bg: #fdf8f6`（暖白）形成由深到浅的渐变叙事，而非割裂的"深色模式"。

#### 2.2.3 Feature 区

| 属性 | 值 |
|------|-----|
| 内边距 | `py-24 px-6` |
| 背景 | 延续现有 body 暖色渐变（不做额外背景改变） |
| 布局 | 三列网格 `grid-cols-3 gap-6`，移动端 `grid-cols-1` |
| 卡片样式 | 复用 `announcement-card` 的 glassmorphism（`bg-surface backdrop-blur-sm border border-line rounded-xl p-6`） |
| 每列结构 | icon（SVG, 32x32）→ 标题（18px, font-bold）→ 描述（14px, text-text-2） |

三张卡片的文案和 icon 设计：

| 卡片 | 标题 | 描述 | Icon 设计思路 |
|------|------|------|---------------|
| 1 | 帖子级匿名 | 同一帖子内身份一致，不同帖子之间互相隔离。放心说，也好好聊。 | 面具/匿名 icon — `M` 形面具轮廓，眼睛位置两个小圆孔 |
| 2 | 低压表达 | 可以求共鸣等回应，也可以只记录不被打扰。互动的节奏由你决定。 | 对话气泡变形 — 左侧完整气泡，右侧简化为点状（"安静模式"概念） |
| 3 | 有边界的自由 | 举报、审核、身份追溯层层保护。匿名不是失控的理由。 | 盾牌 — 简约盾形，中间一个对勾或锁 |

所有 icon 使用现有 `app-icon` 组件规范：`stroke-width: 1.9`，`stroke-linecap: round`，`stroke-linejoin: round`。颜色使用 `--color-blue` / `--color-purple` 等暖色 token。

#### 2.2.4 用户声音区

| 属性 | 值 |
|------|-----|
| 内边距 | `py-20 px-6` |
| 背景 | `bg-surface-tint`（现有 token）或极浅暖色背景 |
| 内容 | 一条精选用户引语 |
| 样式 | 左侧竖线装饰（`border-l-4 border-blue`）+ 大字号斜体（`text-xl italic`）+ 来源署名 |

文案（从调研提炼）：

> "有时候就是不想让熟人看到，但又想说"

署名：`— 来自 NJU 在校生的真实声音`

这条引语的选择原则：
- **不说功能**，说**情感痛点**
- 一句话让目标用户产生"对，我就是这样"的共鸣
- 来源可信，不编造

#### 2.2.5 Footer

| 属性 | 值 |
|------|-----|
| 背景 | `#3d2a30`（与 Hero 呼应） |
| 文字颜色 | 白色/60% |
| 布局 | 居中排列 |
| 内容 | Logo / 版权 / 关于我们 / 隐私政策 |

简洁收尾，不放置 CTA。

---

## 3. 组件树

```
LandingPage
├── NavBar
│   ├── Logo（brand-mark + "NJU 树洞"）
│   ├── LoginLink（文字链接）
│   └── RegisterLink（文字链接）
├── HeroSection
│   ├── HeroTitle
│   ├── HeroSubtitle
│   ├── TagLine
│   ├── CTAButton（"开始使用"，primary-button）
│   └── ScrollIndicator
├── FeaturesSection
│   ├── FeatureCard（帖子级匿名）
│   │   ├── FeatureIcon（匿名面具 SVG）
│   │   ├── FeatureTitle
│   │   └── FeatureDescription
│   ├── FeatureCard（低压表达）
│   │   ├── FeatureIcon（对话气泡 SVG）
│   │   ├── FeatureTitle
│   │   └── FeatureDescription
│   └── FeatureCard（有边界的自由）
│       ├── FeatureIcon（盾牌 SVG）
│       ├── FeatureTitle
│       └── FeatureDescription
├── QuoteSection
│   ├── QuoteBlock（竖线 + 引文）
│   └── QuoteSource（署名）
└── Footer
    ├── Logo
    ├── Copyright
    └── FooterLinks
```

所有子组件均可内联在 `LandingPage.jsx` 中（当前文件数量少，不强行拆分）。

---

## 4. 数据流

### 4.1 进入落地页（未登录态 → landing）

```
用户访问 → App.jsx 渲染
  → 检查 localStorage 是否有 nju_user_id
  → 有 → navigate('home')（正常显示主应用）
  → 无 → 显示 <LandingPage />
```

### 4.2 点击"开始使用"

```
用户点击 CTA → LandingPage.onGetStarted()
  → getUserId()（在 localStorage 创建 nju_user_id）
  → useUiStore.navigate('home')
  → App.jsx 重新渲染 → 进入主应用
```

### 4.3 后期扩展（注册/登录功能实现后）

这个设计预留了扩展空间，不耦合当前简陋的 auth 机制：

```
用户点击"注册" / "登录"
  → navigate('register') / navigate('login')
  → 渲染 RegisterPage / LoginPage（后续实现）
```

目前先让"开始使用""登录""注册"三个入口都走 `getUserId() → navigate('home')`，等真正 auth 实现后再分别绑定。

---

## 5. 颜色体系

| Token | 用途 | 色值 | 来源 |
|-------|------|------|------|
| hero-bg-start | Hero 渐变起始 | `#3d2a30` | 新增（深暖褐） |
| hero-bg-mid | Hero 渐变中间 | `#5a3845` | 新增（干燥玫瑰） |
| hero-bg-end | Hero 渐变结束 | `#6d4555` | 新增（浅紫褐） |
| hero-text | Hero 标题文字 | `#ffffff` | 现有（白色） |
| hero-text-secondary | Hero 辅助文字 | `rgba(255,255,255,0.7)` | 现有用法 |
| feature-bg | Feature 区背景 | 继承 body 背景 | 现有 `--color-bg` |
| card-bg | Feature 卡片背景 | `rgba(255,255,255,0.85)` | 现有 `--color-surface` |
| quote-accent | 用户声音竖线 | `#d4787c` | 现有 `--color-blue` |
| footer-bg | Footer 背景 | `#3d2a30` | 复用 hero-bg-start |

无需修改现有 token，Hero 和 Footer 使用 inline `style` 或新增 CSS class（仅在 `LandingPage.jsx` 范围内使用）。

---

## 6. 响应式行为

| 断点 | 导航 | Hero | Feature | Quote | Footer |
|------|------|------|---------|-------|--------|
| ≥1181px (lg) | 标准布局 | 100vh 大标题 | 三列网格 | 居中宽版 | 标准 |
| 901-1180px (md) | 不变 | 字号略微缩小 | 三列 | 不变 | 不变 |
| 681-900px (sm) | 不变 | 内边距减小 | 三列→两列？ | 边距缩小 | 缩小字号 |
| ≤680px (max-sm) | 紧凑 | 字号缩小，padding | 单列 stacking | 小字号 | 紧凑 |

移动端特别处理：
- Hero 标题字号降至 `clamp(28px, 8vw, 40px)`
- Feature 卡片变为单列垂直排列
- 导航栏 Logo 文字可隐藏，只留图标
- "登录 | 注册"改为图标按钮以减少空间占用

---

## 7. 状态覆盖

| 状态 | 表现 |
|------|------|
| 首次加载 | Hero 内容以 fade-in 动画进入（CSS animation，无 JS 延迟） |
| 滚动中 | 导航栏透明度变化（scroll event → 超过 Hero 高度后添加毛玻璃背景） |
| CTA 点击 | 无 loading 状态（`getUserId()` 是同步操作），直接跳转 |
| 已登录用户访问 | 不显示 LandingPage，直接 `navigate('home')`（条件在 `App.jsx` 判断） |
| 错误 | 无 API 调用，无需错误处理。若 localStorage 不可用，`getUserId()` 有 fallback |
| 空状态 | 不适用 — 落地页内容是静态的 |
| 禁用 JS | 目前不要求降级，与现有 SPA 一致 |

---

## 8. 与现有架构的整合

### 8.1 App.jsx 改动

```jsx
// App.jsx 顶部
import LandingPage from './components/pages/LandingPage';

// render 函数中，在 return 之前
const hasUser = !!localStorage.getItem('nju_user_id');

// 替换原来的直接渲染
if (!hasUser) {
  return (
    <LandingPage
      onGetStarted={() => {
        getUserId();
        navigate('home');
      }}
    />
  );
}

// 原有 render 保持不变...
```

这是一种**保护性渲染**模式：未登录用户看不到 Sidebar/TopBar 等内部 UI。

### 8.2 新增文件

| 文件 | 内容 |
|------|------|
| `frontend/src/components/pages/LandingPage.jsx` | 落地页主组件（含所有子区块 + 3 个 SVG icon） |

### 8.3 零改动的部分

- 不需要修改 `tailwind.css`（Hero 背景用 inline style）
- 不需要修改 store
- 不需要修改路由机制
- 不需要修改其他组件

---

## 9. 实现顺序

| 步骤 | 内容 | 预估改动量 |
|------|------|-----------|
| 1 | 创建 `LandingPage.jsx`，实现 Hero 区 + 导航 | ≈60 行 JSX |
| 2 | 实现 Feature 区 + 三个 SVG icon | ≈80 行 JSX |
| 3 | 实现 Quote 区 + Footer | ≈40 行 JSX |
| 4 | 在 `App.jsx` 添加未登录态判断 + 导入 | ≈10 行改动 |
| 5 | 测试：清除 localStorage → 看到落地页 → 点击进入 | — |

总计新增约 180-200 行 JSX，改动 1 个现有文件。

---

## 10. 验收标准

- [ ] 清除 localStorage 后访问 → 看到落地页（不是主应用）
- [ ] 落地页有深色 Hero + "开始使用"按钮 + 三个 Feature 卡片 + 一条用户引语 + Footer
- [ ] 点击"开始使用" → 进入主应用（home 页）
- [ ] 有 localStorage 中已有 userId → 直接进主应用，不显示落地页
- [ ] 移动端（≤680px）布局正常，Feature 卡片纵向排列
- [ ] 导航栏在 Hero 区域透明，滚动后获得毛玻璃背景
- [ ] 所有文字都是简体中文，无 emoji 图标
- [ ] 三个 Feature icon 使用 SVG（`app-icon` 规范），不是 emoji
