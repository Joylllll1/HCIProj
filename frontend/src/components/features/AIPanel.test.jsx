import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AIPanel from './AIPanel';
import useAIStore from '../../store/aiStore';

beforeEach(() => {
  useAIStore.setState(useAIStore.getInitialState(), true);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const session = { _id: 'session-a', title: '测试会话' };
  useAIStore.setState({
    currentSession: session,
    sessions: [session],
    fetchSessions: vi.fn().mockResolvedValue([session]),
    regenerateMessage: vi.fn().mockResolvedValue(true),
  });
});
afterEach(cleanup);

it.each(['complete', undefined])('offers regeneration on the complete or legacy answer, not a later partial answer (%s)', (status) => {
  useAIStore.setState({ messages: [
    { _id: 'a-user', role: 'user', content: '问题 A', status },
    { _id: 'a-answer', role: 'assistant', content: '完整回答 A', status },
    { _id: 'b-user', role: 'user', content: '问题 B', status: 'interrupted' },
    { _id: 'b-answer', role: 'assistant', content: '中断回答 B', status: 'interrupted' },
  ] });
  render(<AIPanel open onClose={vi.fn()} />);
  fireEvent.mouseOver(screen.getByText('中断回答 B'));
  expect(screen.queryByRole('button', { name: '重新生成' })).not.toBeInTheDocument();
  fireEvent.mouseOver(screen.getByText('完整回答 A'));
  fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
  expect(useAIStore.getState().regenerateMessage).toHaveBeenCalledTimes(1);
});

it('keeps another session browsable during generation without exposing the source stream', () => {
  const sessionA = { _id: 'session-a', title: '会话 A：期中论文焦虑与课程选课方案，包含很长标题' };
  const sessionB = { _id: 'session-b', title: '会话 B' };
  useAIStore.setState({
    currentSession: sessionB,
    sessions: [sessionA, sessionB],
    messages: [
      { _id: 'b-question', role: 'user', content: 'B 的问题', status: 'complete' },
      { _id: 'b-answer', role: 'assistant', content: 'B 的回答', status: 'complete' },
    ],
    showSessionList: true,
    isLoading: true,
    activeRequestSessionId: 'session-a',
    streamingContent: 'A 的秘密流内容',
    toolStatus: 'A 的工具状态',
  });

  render(<AIPanel open onClose={vi.fn()} />);

  expect(screen.getByText(/正在生成，回答会保存在该会话/)).toHaveTextContent(sessionA.title);
  expect(screen.getByText('B 的回答')).toBeInTheDocument();
  expect(screen.queryByText('A 的秘密流内容')).not.toBeInTheDocument();
  expect(screen.queryByText('A 的工具状态')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('和树洞 AI 聊聊...')).toBeDisabled();
  const stopButton = screen.getByRole('button', { name: `停止「${sessionA.title}」的生成` });
  expect(stopButton).toBeEnabled();
  expect(stopButton).toHaveTextContent('停止');

  fireEvent.mouseOver(screen.getByText('B 的回答'));
  expect(screen.getByRole('button', { name: '重新生成' })).toBeDisabled();
  expect(screen.getAllByRole('button').find((button) => button.getAttribute('aria-current') === 'true')).toBeEnabled();
});
