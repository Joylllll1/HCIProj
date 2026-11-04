import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DetailPage from './DetailPage';
import useCommentStore from '../../store/commentStore';

vi.mock('../common/Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('../common/PostCard', () => ({
  default: () => <div data-testid="post-card" />,
}));

vi.mock('../common/Comment', () => ({
  default: ({ comment }) => <div>{comment.content}</div>,
}));

vi.mock('../common/ReplyCard', () => ({
  default: ({ reply }) => <div>{reply.content}</div>,
}));

afterEach(cleanup);

const baseProps = {
  post: {
    id: 'post-1',
    tags: ['树洞'],
  },
  liked: false,
  bookmarked: false,
  isOwner: false,
  currentUserId: 'user-1',
  onLike: vi.fn(),
  onBookmark: vi.fn(),
  onComment: vi.fn(),
  onReply: vi.fn(),
  onDeleteComment: vi.fn(),
  onDeleteReply: vi.fn(),
  onDelete: vi.fn(),
  onNavigate: vi.fn(),
  onReport: vi.fn(),
};

describe('DetailPage comment sorting', () => {
  beforeEach(() => {
    useCommentStore.setState(useCommentStore.getInitialState(), true);
    useCommentStore.setState({
      commentsMap: {
        'post-1': [
          {
            id: 'comment-1',
            content: 'Older high-like comment',
            createdAt: '2026-05-24T00:00:00.000Z',
            likes: 10,
            ownerUserId: 'user-2',
            replies: [],
          },
          {
            id: 'comment-2',
            content: 'Newest low-like comment',
            createdAt: '2026-05-26T00:00:00.000Z',
            likes: 1,
            ownerUserId: 'user-3',
            replies: [
              {
                id: 'reply-1',
                content: 'Newest tie-break reply',
                createdAt: '2026-05-27T00:00:00.000Z',
                likes: 10,
                ownerUserId: 'user-4',
                parentId: 'comment-2',
              },
            ],
          },
        ],
      },
    });
  });

  it('sorts comments and replies by newest by default and by likes when switching tabs', () => {
    render(<DetailPage {...baseProps} />);

    let renderedItems = screen.getAllByText(/comment|reply/i).map((node) => node.textContent);
    expect(renderedItems).toEqual([
      'Newest tie-break reply',
      'Newest low-like comment',
      'Older high-like comment',
    ]);

    fireEvent.click(screen.getByRole('button', { name: '按热度' }));

    renderedItems = screen.getAllByText(/comment|reply/i).map((node) => node.textContent);
    expect(renderedItems).toEqual([
      'Newest tie-break reply',
      'Older high-like comment',
      'Newest low-like comment',
    ]);
  });

  it('keeps the deletion dialog open after failure and blocks duplicate requests during retry', async () => {
    let finish;
    const remove = vi.fn().mockRejectedValueOnce(new Error('网络断开')).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<DetailPage {...baseProps} isOwner onDelete={remove} />);
    fireEvent.click(screen.getByRole('button', { name: '删除帖子', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('网络断开');
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    fireEvent.click(screen.getByRole('button', { name: '删除中…' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(2);
    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
