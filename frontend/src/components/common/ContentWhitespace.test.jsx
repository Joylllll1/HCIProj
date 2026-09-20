import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostCard from './PostCard';
import Comment from './Comment';
import { EventDetailModal } from './EventModals';
import PlainTextContent from './PlainTextContent';
import ReplyCard from './ReplyCard';
import ExpandableText from './ExpandableText';

vi.mock('./Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('./ClickableImage', () => ({
  default: () => <span data-testid="image" />,
}));

vi.mock('./TimeAgo', () => ({
  default: () => <span data-testid="time-ago" />,
}));

vi.mock('../features/ReportModal', () => ({
  default: () => null,
}));

vi.mock('./ConfirmLeaveDialog', () => ({
  default: () => null,
}));

vi.mock('../../store/commentStore', () => ({
  default: (selector) => selector({
    toggleLike: vi.fn(),
    toggleReplyLike: vi.fn(),
  }),
}));

let scrollHeightSpy;
let clientHeightSpy;
let scrollWidthSpy;
let clientWidthSpy;
let getComputedStyleSpy;

describe('content whitespace rendering', () => {
  beforeEach(() => {
    scrollHeightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);
    clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    scrollWidthSpy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const styles = originalGetComputedStyle(element);
      return new Proxy(styles, {
        get(target, prop, receiver) {
          if (prop === 'lineHeight') {
            return '24px';
          }

          if (prop === 'fontSize') {
            return '16px';
          }

          return Reflect.get(target, prop, receiver);
        },
      });
    });
  });

  afterEach(() => {
    cleanup();
    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
    scrollWidthSpy.mockRestore();
    clientWidthSpy.mockRestore();
    getComputedStyleSpy.mockRestore();
  });
  it('preserves line breaks in PlainTextContent by default', () => {
    const { container } = render(
      <PlainTextContent content={'first line\nsecond line'} />,
    );

    const content = container.querySelector('p.whitespace-pre-wrap');
    expect(content).not.toBeNull();
    expect(content.textContent).toContain('\n');
  });

  it('preserves post line breaks in PostCard', () => {
    const { container } = render(
      <PostCard
        post={{
          id: 'post-1',
          ownerUserId: 'user-1',
          title: 'Post title',
          content: 'first line\nsecond line',
          tags: [],
          createdAt: new Date().toISOString(),
        }}
        onOpen={vi.fn()}
        liked={false}
        bookmarked={false}
        onLike={vi.fn()}
        onBookmark={vi.fn()}
      />,
    );

    const postContent = container.querySelector('p.whitespace-pre-wrap');
    expect(postContent).not.toBeNull();
    expect(postContent.textContent).toContain('\n');
  });

  it('preserves comment line breaks in Comment', () => {
    const { container } = render(
      <Comment
        comment={{
          id: 'comment-1',
          ownerUserId: 'user-1',
          content: 'comment line 1\ncomment line 2',
          createdAt: new Date().toISOString(),
          likes: 0,
          isLiked: false,
        }}
        postId="post-1"
        currentUserId="user-1"
        onReply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const commentContent = container.querySelector('p.whitespace-pre-wrap');
    expect(commentContent).not.toBeNull();
    expect(commentContent.textContent).toContain('\n');
  });

  it('preserves reply and quoted content line breaks in ReplyCard', () => {
    const { container } = render(
      <ReplyCard
        reply={{
          id: 'reply-1',
          parentId: 'comment-1',
          ownerUserId: 'user-2',
          parentAuthorId: 'user-1',
          parentContent: 'quoted line 1\nquoted line 2',
          content: 'reply line 1\nreply line 2',
          createdAt: new Date().toISOString(),
          parentTime: new Date().toISOString(),
          likes: 0,
          isLiked: false,
        }}
        postId="post-1"
        currentUserId="user-2"
        onReply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const whitespaceNodes = container.querySelectorAll('.whitespace-pre-wrap');
    expect(whitespaceNodes).toHaveLength(2);
    expect(whitespaceNodes[0].textContent).toContain('\n');
    expect(whitespaceNodes[1].textContent).toContain('\n');
  });

  it('preserves event description line breaks in EventDetailModal', () => {
    const { container } = render(
      <EventDetailModal
        event={{
          title: 'Event title',
          type: '讲座',
          time: new Date().toISOString(),
          place: '仙林',
          description: 'line 1\nline 2',
        }}
        onClose={vi.fn()}
      />,
    );

    const eventDescription = container.querySelector('p.whitespace-pre-wrap');
    expect(eventDescription).not.toBeNull();
    expect(eventDescription.textContent).toContain('\n');
  });

  it('shows 查看全文 for long preview posts and opens detail on click', () => {
    const onOpen = vi.fn();
    scrollHeightSpy.mockReturnValue(220);
    clientHeightSpy.mockReturnValue(120);

    render(
      <PostCard
        post={{
          id: 'post-2',
          ownerUserId: 'user-1',
          title: 'Long Post title',
          content: '很长的正文 '.repeat(40),
          tags: [],
          createdAt: new Date().toISOString(),
        }}
        onOpen={onOpen}
        previewMode
        liked={false}
        bookmarked={false}
        onLike={vi.fn()}
        onBookmark={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '查看全文' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('expands and collapses long comments only when needed', async () => {
    scrollHeightSpy.mockReturnValue(220);
    clientHeightSpy.mockReturnValue(120);

    render(
      <Comment
        comment={{
          id: 'comment-2',
          ownerUserId: 'user-1',
          content: '长评论内容\n'.repeat(12),
          createdAt: new Date().toISOString(),
          likes: 0,
          isLiked: false,
        }}
        postId="post-1"
        currentUserId="user-1"
        onReply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const toggle = await screen.findByRole('button', { name: '展开' });
    fireEvent.click(toggle);
    await screen.findByRole('button', { name: '收起' });
  });

  it('does not show expand control for short replies', () => {
    render(
      <ReplyCard
        reply={{
          id: 'reply-2',
          parentId: 'comment-1',
          ownerUserId: 'user-2',
          parentAuthorId: 'user-1',
          parentContent: '短引用',
          content: '短回复',
          createdAt: new Date().toISOString(),
          parentTime: new Date().toISOString(),
          likes: 0,
          isLiked: false,
        }}
        postId="post-1"
        currentUserId="user-2"
        onReply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '展开' })).not.toBeInTheDocument();
  });

  it('shows expand control for long plain text blocks', async () => {
    scrollHeightSpy.mockReturnValue(180);
    clientHeightSpy.mockReturnValue(60);

    render(
      <ExpandableText
        content={'第一行\n第二行\n第三行\n第四行\n第五行\n第六行'}
        lineThreshold={3}
        charThreshold={10}
        collapsedLinesClass="line-clamp-3"
      />,
    );

    await screen.findByRole('button', { name: '展开' });
  });

  it('does not show expand control when long text does not actually overflow', async () => {
    scrollHeightSpy.mockReturnValue(70);

    render(
      <ExpandableText
        content={'第一行\n第二行\n第三行\n第四行\n第五行\n第六行'}
        lineThreshold={3}
        charThreshold={10}
        collapsedLinesClass="line-clamp-3"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '展开' })).not.toBeInTheDocument();
    });
  });

  it('uses pre-line when collapsed and pre-wrap after expanding', async () => {
    scrollHeightSpy.mockReturnValue(180);

    const { container } = render(
      <ExpandableText
        content={'一\n二\n三\n四\n五\n六'}
        lineThreshold={3}
        charThreshold={10}
        collapsedLinesClass="line-clamp-3"
      />,
    );

    const textNode = container.querySelector('p');
    await waitFor(() => {
      expect(textNode.style.maxHeight).toBe('72px');
    });

    fireEvent.click(await screen.findByRole('button', { name: '展开' }));
    await waitFor(() => {
      expect(textNode.style.maxHeight).toBe('');
    });
  });

  it('applies max-height during overflow measurement for long content', async () => {
    scrollHeightSpy.mockReturnValue(180);

    const { container } = render(
      <ExpandableText
        content={'一\n二\n三\n四\n五\n六'}
        lineThreshold={3}
        charThreshold={10}
        collapsedLinesClass="line-clamp-3"
      />,
    );

    const textNode = container.querySelector('p');
    await waitFor(() => {
      expect(textNode.style.maxHeight).toBe('72px');
    });
  });
});
