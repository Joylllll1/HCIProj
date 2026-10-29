import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './LandingPage';

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

  it('offers an accessible, clearly labelled interface example', () => {
    render(<LandingPage onGetStarted={vi.fn()} onLogin={vi.fn()} onRegister={vi.fn()} />);
    expect(screen.getByRole('region', { name: '树洞互动体验' })).toBeInTheDocument();
    expect(screen.getByText('示例内容 · 刷新重置')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '先体验一下' })).toBeInTheDocument();
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
