import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TopBar from './TopBar';
import useUiStore from '../../store/uiStore';
import useNotificationStore from '../../store/notificationStore';

describe('TopBar search navigation', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState(), true);
    useNotificationStore.setState(useNotificationStore.getInitialState(), true);
  });
  afterEach(cleanup);

  it('returns to the feed when submitting a search from another page', () => {
    useUiStore.setState({ activePage: 'detail' });
    const onNavigate = vi.fn();
    render(<TopBar query="图书馆" onQueryChange={vi.fn()} onNavigate={onNavigate} onAIOpen={vi.fn()} />);
    fireEvent.submit(screen.getByRole('search'));
    expect(onNavigate).toHaveBeenCalledWith('home');
    expect(useUiStore.getState().feedScrollToken).toBeGreaterThan(0);
  });

  it('clears the query without navigating away', () => {
    const onQueryChange = vi.fn();
    const onNavigate = vi.fn();
    render(<TopBar query="图书馆" onQueryChange={onQueryChange} onNavigate={onNavigate} onAIOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(onQueryChange).toHaveBeenCalledWith('');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('keeps notification keyboard focus in the dialog and restores the trigger', () => {
    render(<TopBar query="" onQueryChange={vi.fn()} onNavigate={vi.fn()} onAIOpen={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: '通知' });
    trigger.focus();
    fireEvent.click(trigger);
    const close = screen.getByRole('button', { name: '关闭通知' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '通知' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps focus in notifications after marking everything read removes the action', () => {
    const markAllAsRead = vi.fn(() => useNotificationStore.setState({ unreadCount: 0 }));
    useNotificationStore.setState({ unreadCount: 1, markAllAsRead });
    render(<TopBar query="" onQueryChange={vi.fn()} onNavigate={vi.fn()} onAIOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '通知' }));
    expect(screen.getByRole('button', { name: '关闭通知' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '全部已读' }));
    expect(markAllAsRead).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: '全部已读' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭通知' })).toHaveFocus();
  });
});

it('does not search while typing and records explicit submissions', () => {
  const onQueryChange = vi.fn();
  render(<TopBar query="" onQueryChange={onQueryChange} onNavigate={vi.fn()} onAIOpen={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: '搜索树洞' }), { target: { value: '晚风' } });
  expect(onQueryChange).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole('search'));
  expect(onQueryChange).toHaveBeenCalledWith('晚风');
  expect(JSON.parse(localStorage.getItem('nju_search_history'))).toContain('晚风');
  cleanup();
});

it('commits an empty mobile query when Enter submits the search form', () => {
  const width = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const onQueryChange = vi.fn();
  render(<TopBar query="旧关键词" onQueryChange={onQueryChange} onNavigate={vi.fn()} onAIOpen={vi.fn()} />);
  fireEvent.focus(screen.getByRole('textbox', { name: '搜索树洞' }));
  fireEvent.change(screen.getByRole('textbox', { name: '搜索树洞' }), { target: { value: '' } });
  fireEvent.submit(screen.getByRole('search'));
  expect(onQueryChange).toHaveBeenCalledWith('');
  cleanup();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
});
