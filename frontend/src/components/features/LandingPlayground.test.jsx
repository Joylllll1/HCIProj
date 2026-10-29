import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import LandingPlayground from './LandingPlayground';

afterEach(cleanup);
function Experience() {
  const [topic, setTopic] = useState('');
  return <LandingPlayground topic={topic} onTopicChange={setTopic} onRegister={vi.fn()} />;
}

it('allows sorting, liking, saving, and finding a saved example', () => {
  render(<Experience />);
  fireEvent.click(screen.getByRole('button', { name: '热门', exact: true }));
  expect(screen.getAllByRole('heading')[0]).toHaveTextContent('给同样在赶作业的你');
  const post = screen.getAllByRole('article')[0];
  fireEvent.click(within(post).getByRole('button', { name: /^点赞：/ }));
  expect(within(post).getByRole('button', { name: /^取消点赞：/ })).toHaveAttribute('aria-pressed', 'true');
  expect(within(post).getByRole('button', { name: /^取消点赞：/ })).toHaveTextContent('37');
  fireEvent.click(within(post).getByRole('button', { name: /^收藏：/ }));
  fireEvent.click(screen.getByRole('button', { name: '收藏', exact: true }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /^取消收藏：/ }));
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByText('这里还没有收藏')).toBeInTheDocument();
});

it('filters topics, opens discussions, and adds a local reply', () => {
  render(<Experience />);
  fireEvent.click(screen.getByRole('combobox', { name: '体验话题' }));
  fireEvent.click(screen.getByRole('option', { name: '求助', exact: true }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /^查看讨论：/ }));
  expect(screen.getByText('可以先走一圈，找一个光线舒服的位置。')).toBeInTheDocument();
  const input = screen.getByRole('textbox', { name: '写一句回应' });
  fireEvent.change(input, { target: { value: '谢谢，我去看看！' } });
  fireEvent.click(screen.getByRole('button', { name: '发送体验回应' }));
  expect(screen.getByText('谢谢，我去看看！')).toBeInTheDocument();
  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: /^查看讨论：/ })).toHaveTextContent('2 条回应');
});

it('publishes only within the experience and resets edits, likes, and filters', () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  render(<Experience />);
  fireEvent.click(screen.getByRole('button', { name: /此刻，有什么想说的/ }));
  const field = screen.getByRole('textbox', { name: '写下你的第一句' });
  expect(screen.getByRole('button', { name: '试发一句' })).toBeDisabled();
  fireEvent.change(field, { target: { value: '今天是很不错的一天' } });
  fireEvent.click(screen.getByRole('button', { name: '试发一句' }));
  expect(screen.getByText('今天是很不错的一天')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('仅在当前页面保留');
  fireEvent.click(screen.getByRole('button', { name: '重置体验' }));
  expect(screen.queryByText('今天是很不错的一天')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveTextContent('全部话题');
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
