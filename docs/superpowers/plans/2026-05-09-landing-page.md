# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a landing page for NJU 树洞 as the first screen for users who haven't explicitly entered the app.

**Architecture:** New `LandingPage.jsx` in `components/pages/`, conditionally rendered in `App.jsx`. Uses a new `nju_engaged` localStorage flag (not `nju_user_id`, since that's auto-created at import time by utils.js). Three feature icons (`mask`, `chat_bubble`, `shield_person`) already exist in Icon.jsx — no changes needed. No new stores/hooks/services.

**Tech Stack:** React 18, Tailwind CSS v4, existing design tokens, existing Icon component.

---

### Task 1: Create LandingPage.jsx (full component)

**Files:**
- Create: `frontend/src/components/pages/LandingPage.jsx`

- [ ] **Step 1: Write the complete LandingPage component**

The component has 4 sections: NavBar, Hero, FeatureCards, Quote, Footer. All inline in one file. Uses existing `<Icon>` component for feature card icons. Hero uses inline `style` for dark gradient background (not in tailwind.css tokens).

```jsx
import React from 'react';
import Icon from '../common/Icon';

export default function LandingPage({ onGetStarted }) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ─── Nav ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-6 transition-all duration-300 ${
        scrolled ? 'bg-white/60 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className="grid w-9 h-9 place-items-center rounded-[10px] text-white bg-gradient-to-br from-[#c4787c] to-[#d4a0a4] shadow-sm text-sm font-bold">
            N
          </span>
          <span className={`font-bold text-[17px] tracking-tight ${scrolled ? 'text-text' : 'text-white'}`}>
            NJU 树洞
          </span>
        </div>
        <div className={`flex items-center gap-4 text-sm font-semibold ${scrolled ? 'text-text-2' : 'text-white/70'}`}>
          <button type="button" className="hover:text-white transition-colors" onClick={onGetStarted}>登录</button>
          <span className="opacity-30">|</span>
          <button type="button" className="hover:text-white transition-colors" onClick={onGetStarted}>注册</button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section
        className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #3d2a30 0%, #5a3845 50%, #6d4555 100%)'
        }}
      >
        <div className="absolute pointer-events-none"
          style={{ inset: '-30% 30% 30% -20%', background: 'radial-gradient(circle, rgba(212,120,124,0.2), transparent 58%)' }}
        />
        <div className="absolute pointer-events-none"
          style={{ inset: '10% -30% -20% 30%', background: 'radial-gradient(circle, rgba(196,168,184,0.15), transparent 50%)' }}
        />

        <div className="relative z-10">
          <h1 className="text-white font-extrabold tracking-tight leading-[1.1] mb-4"
            style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}>
            NJU 树洞
          </h1>
          <p className="text-white/80 font-semibold mb-3"
            style={{ fontSize: 'clamp(18px, 2.5vw, 24px)' }}>
            校园里的匿名说话角落
          </p>
          <p className="text-white/60 text-sm tracking-[0.05em] mb-10">
            半匿名表达 · 低压交流 · 有边界的自由
          </p>
          <button type="button" className="primary-button text-base px-8 py-3" onClick={onGetStarted}>
            开始使用
          </button>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-5 h-5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-24 px-6" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-[1060px] mx-auto">
          <h2 className="text-center text-2xl font-bold tracking-tight mb-3">为什么选择 NJU 树洞</h2>
          <p className="text-center text-text-2 text-sm mb-12">一个更安全、更低压的校园表达空间</p>
          <div className="grid grid-cols-3 gap-6 max-sm:grid-cols-1">
            <div className="rounded-xl border border-line bg-surface backdrop-blur-sm shadow-sm p-6">
              <Icon name="mask" />
              <h3 className="text-lg font-bold mt-4 mb-2">帖子级匿名</h3>
              <p className="text-text-2 text-sm leading-relaxed">同一帖子内身份一致，不同帖子之间互相隔离。放心说，也好好聊。</p>
            </div>
            <div className="rounded-xl border border-line bg-surface backdrop-blur-sm shadow-sm p-6">
              <Icon name="chat_bubble" />
              <h3 className="text-lg font-bold mt-4 mb-2">低压表达</h3>
              <p className="text-text-2 text-sm leading-relaxed">可以求共鸣等回应，也可以只记录不被打扰。互动的节奏由你决定。</p>
            </div>
            <div className="rounded-xl border border-line bg-surface backdrop-blur-sm shadow-sm p-6">
              <Icon name="shield_person" />
              <h3 className="text-lg font-bold mt-4 mb-2">有边界的自由</h3>
              <p className="text-text-2 text-sm leading-relaxed">举报、审核、身份追溯层层保护。匿名不是失控的理由。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Quote ─── */}
      <section className="py-20 px-6" style={{ background: 'var(--color-surface-tint)' }}>
        <div className="max-w-[680px] mx-auto">
          <div className="border-l-4 border-[var(--color-blue)] pl-6">
            <p className="text-xl italic leading-relaxed text-text">
              &ldquo;有时候就是不想让熟人看到，但又想说&rdquo;
            </p>
            <p className="mt-3 text-text-3 text-sm font-semibold">&mdash; 来自 NJU 在校生的真实声音</p>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-12 px-6 text-center" style={{ background: '#3d2a30' }}>
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <span className="grid w-8 h-8 place-items-center rounded-[8px] text-white bg-gradient-to-br from-[#c4787c] to-[#d4a0a4] shadow-sm text-xs font-bold">
            N
          </span>
          <span className="text-white/80 font-bold text-base tracking-tight">NJU 树洞</span>
        </div>
        <p className="text-white/50 text-xs mb-6">在这里说说心里话</p>
        <div className="flex items-center justify-center gap-4 text-white/40 text-xs">
          <span>&copy; 2025 NJU树洞</span>
          <span className="opacity-30">|</span>
          <button type="button" className="hover:text-white/60 transition-colors">关于我们</button>
          <span className="opacity-30">|</span>
          <button type="button" className="hover:text-white/60 transition-colors">隐私政策</button>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `stat frontend/src/components/pages/LandingPage.jsx`

---

### Task 2: Wire up App.jsx with landing page guard

**Files:**
- Modify: `frontend/src/App.jsx`

Architecture note: utils.js auto-creates `nju_user_id` in localStorage at import time (line 47: `const CURRENT_USER_ID = getUserId()`). So we cannot use `nju_user_id` to distinguish new vs returning users. Instead, use a new `nju_engaged` flag that's only set when the user clicks "开始使用".

- [ ] **Step 1: Add import for LandingPage**

Add after line 14 (AdminPage import):

```jsx
import LandingPage from './components/pages/LandingPage';
```

- [ ] **Step 2: Add landing page guard before the return statement**

Add after line 102 (`const CURRENT_USER_ID = getUserId();`) and before the render return:

```jsx
  // ── Landing page ──
  const [landingReady, setLandingReady] = React.useState(false);
  React.useEffect(() => {
    setLandingReady(true);
  }, []);

  if (!landingReady) return null;

  const engaged = localStorage.getItem('nju_engaged') === 'true';

  if (!engaged) {
    return (
      <LandingPage
        onGetStarted={() => {
          localStorage.setItem('nju_engaged', 'true');
          getUserId(); // ensure user ID exists (may already be auto-created by utils)
          navigate('home');
        }}
      />
    );
  }
```

The `landingReady` state prevents flash-of-wrong-content: without it, on first render `nju_engaged` hasn't been read from localStorage synchronously and the component could show a split-second flash of the wrong page. The useEffect ensures we only render after the first commit.

- [ ] **Step 3: Verify the modified App.jsx compiles**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds (no errors)
