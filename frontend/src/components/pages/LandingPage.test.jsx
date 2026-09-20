import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

const { gsapTo } = vi.hoisted(() => ({
  gsapTo: vi.fn(),
}));

vi.mock('gsap', () => {
  const noopTween = {
    play: vi.fn(),
    pause: vi.fn(),
  };

  const noopTimeline = {
    fromTo: vi.fn().mockReturnThis(),
    to: vi.fn().mockReturnThis(),
  };

  return {
    default: {
      registerPlugin: vi.fn(),
      matchMedia: () => ({
        add: vi.fn((_conditions, callback) => {
          callback({ conditions: { reduce: true, desktop: false, mobile: true } });
        }),
        revert: vi.fn(),
      }),
      context: (callback) => {
        callback();
        return { revert: vi.fn() };
      },
      set: vi.fn(),
      timeline: vi.fn(() => noopTimeline),
      to: gsapTo.mockImplementation(() => noopTween),
      fromTo: vi.fn(() => noopTween),
    },
  };
});

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: vi.fn(),
  },
}));

vi.mock('gsap/ScrollToPlugin', () => ({
  ScrollToPlugin: {},
}));

vi.mock('../common/Icon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name}`} />,
}));

describe('LandingPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('routes nav and hero CTA actions through the provided handlers', () => {
    const onGetStarted = vi.fn();
    const onLogin = vi.fn();
    const onRegister = vi.fn();

    render(
      <LandingPage
        onGetStarted={onGetStarted}
        onLogin={onLogin}
        onRegister={onRegister}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    fireEvent.click(screen.getByRole('button', { name: '注册' }));
    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));
    fireEvent.click(screen.getByRole('button', { name: '进入树洞' }));
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onRegister).toHaveBeenCalledTimes(2);
    expect(onGetStarted).toHaveBeenCalledTimes(2);
  });

  it('scrolls to the intro section and back to top through GSAP scroll tweens', () => {
    render(<LandingPage onGetStarted={vi.fn()} onLogin={vi.fn()} onRegister={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '滚动到下一节' }));
    fireEvent.click(screen.getByRole('button', { name: 'NJU 树洞，回到顶部' }));

    expect(gsapTo).toHaveBeenCalledWith(window, expect.objectContaining({
      duration: 1.2,
      scrollTo: { y: '.lp-story-intro', offsetY: 40 },
      ease: 'power4.inOut',
      overwrite: 'auto',
    }));

    expect(gsapTo).toHaveBeenCalledWith(window, expect.objectContaining({
      scrollTo: 0,
      duration: 0.8,
      ease: 'power3.inOut',
      overwrite: 'auto',
    }));
  });

  it('renders hover surfaces inside animated cards so hover transforms do not fight scroll transforms', () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} onLogin={vi.fn()} onRegister={vi.fn()} />);

    expect(container.querySelectorAll('.lp-hover-card').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.lp-hover-card > .lp-hover-surface').length).toBe(
      container.querySelectorAll('.lp-hover-card').length,
    );
  });

  it('opens the about modal with dialog semantics and closes on Escape', () => {
    render(<LandingPage onGetStarted={vi.fn()} onLogin={vi.fn()} onRegister={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: '关于我们' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '关于 NJU 树洞' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭关于我们弹窗' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '关于 NJU 树洞' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens the privacy modal and closes when clicking the overlay', () => {
    render(<LandingPage onGetStarted={vi.fn()} onLogin={vi.fn()} onRegister={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '隐私政策' }));

    const dialog = screen.getByRole('dialog', { name: '隐私政策' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(dialog.parentElement);

    expect(screen.queryByRole('dialog', { name: '隐私政策' })).not.toBeInTheDocument();
  });
});
