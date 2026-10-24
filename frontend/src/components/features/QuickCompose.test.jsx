import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickCompose from './QuickCompose';
import useAuthStore from '../../store/authStore';
import usePostStore from '../../store/postStore';
import useUiStore from '../../store/uiStore';
import { fileToOptimizedDataUrl } from '../../utils/image';

vi.mock('../../utils/image', () => ({
  fileToOptimizedDataUrl: vi.fn(),
  MAX_POST_IMAGES: 9,
}));

vi.mock('../common/Icon', () => ({ default: ({ name }) => <span aria-hidden="true">{name}</span> }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const makeFiles = (count) => Array.from({ length: count }, (_, index) => (
  new File([`image-${index}`], `image-${index}.png`, { type: 'image/png' })
));

const selectFiles = (container, files) => {
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files } });
};

let addPost;
let fetchPosts;
let showToast;
let navigate;

beforeEach(() => {
  vi.clearAllMocks();
  addPost = vi.fn().mockResolvedValue({ id: 'post-1' });
  fetchPosts = vi.fn().mockResolvedValue({ posts: [], total: 0 });
  showToast = vi.fn();
  navigate = vi.fn();
  usePostStore.setState({ addPost, fetchPosts });
  useAuthStore.setState({ user: { _id: 'account-1' } });
  useUiStore.getState().resetQuickDraft();
  useUiStore.setState({ showToast, navigate, query: '', feedTag: '' });
  fileToOptimizedDataUrl.mockImplementation((file) => Promise.resolve(`data:image/png;base64,${file.name}`));
});

afterEach(() => {
  cleanup();
  useUiStore.getState().resetQuickDraft();
  useAuthStore.setState({ user: null });
});

describe('QuickCompose', () => {
  it('accepts pasted screenshots while leaving ordinary text paste to the browser', async () => {
    render(<QuickCompose />);
    const content = screen.getByRole('textbox', { name: '树洞内容' });
    expect(fireEvent.paste(content, { clipboardData: { files: [], getData: () => '普通文字' } })).toBe(true);
    expect(fileToOptimizedDataUrl).not.toHaveBeenCalled();

    expect(fireEvent.paste(content, { clipboardData: { files: makeFiles(1) } })).toBe(false);
    await waitFor(() => expect(screen.getByText('1/9 张')).toBeInTheDocument());
    expect(screen.getByRole('img', { name: '待发布图片 1' })).toBeInTheDocument();
  });

  it('adds dropped images through the same processing and quantity limits', async () => {
    render(<QuickCompose />);
    const form = screen.getByRole('form', { name: '发布树洞' });
    expect(fireEvent.drop(form, { dataTransfer: { types: ['text/plain'], files: [] } })).toBe(true);
    expect(fireEvent.drop(form, { dataTransfer: { types: ['Files'], files: makeFiles(10) } })).toBe(false);
    await waitFor(() => expect(screen.getByText('9/9 张')).toBeInTheDocument());
    expect(fileToOptimizedDataUrl).toHaveBeenCalledTimes(9);
    expect(screen.getByRole('alert')).toHaveTextContent('最多上传 9 张图片');
    expect(screen.getByRole('button', { name: '图片', exact: true })).toBeDisabled();
  });

  it('retains existing pictures when another dropped file cannot be processed', async () => {
    render(<QuickCompose />);
    const form = screen.getByRole('form', { name: '发布树洞' });
    fireEvent.paste(screen.getByRole('textbox', { name: '树洞内容' }), { clipboardData: { files: makeFiles(1) } });
    await waitFor(() => expect(screen.getByText('1/9 张')).toBeInTheDocument());
    fileToOptimizedDataUrl.mockRejectedValueOnce(new Error('请选择有效的图片文件'));
    fireEvent.drop(form, { dataTransfer: { types: ['Files'], files: [new File(['text'], 'note.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('请选择有效的图片文件'));
    expect(screen.getByRole('img', { name: '待发布图片 1' })).toBeInTheDocument();
    expect(screen.getByText('1/9 张')).toBeInTheDocument();
  });

  it('publishes multiple normalized custom and curated topics in the real post payload', async () => {
    render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '想聊聊今天' } });
    fireEvent.click(screen.getByRole('button', { name: '话题' }));
    const topicInput = screen.getByRole('textbox', { name: '输入自定义话题' });
    fireEvent.change(topicInput, { target: { value: '  ## 深夜想法  ' } });
    fireEvent.keyDown(topicInput, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '#校园生活' }));
    fireEvent.change(topicInput, { target: { value: '# 校园生活 ' } });
    fireEvent.keyDown(topicInput, { key: 'Enter', code: 'Enter' });
    expect(screen.getByRole('button', { name: '移除话题 深夜想法' })).toBeInTheDocument();
    fireEvent.change(topicInput, { target: { value: '#临时话题' } });

    fireEvent.click(screen.getByRole('button', { name: '发布', exact: true }));

    await waitFor(() => expect(addPost).toHaveBeenCalledTimes(1));
    expect(addPost).toHaveBeenCalledWith({
      title: '',
      content: '想聊聊今天',
      tags: ['深夜想法', '校园生活', '临时话题'],
      images: [],
    });
  });

  it('does not commit an Enter key while Chinese input composition is active', () => {
    render(<QuickCompose />);
    fireEvent.click(screen.getByRole('button', { name: '话题' }));
    const topicInput = screen.getByRole('textbox', { name: '输入自定义话题' });
    fireEvent.change(topicInput, { target: { value: '中文' } });
    fireEvent.compositionStart(topicInput);
    fireEvent.keyDown(topicInput, { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true });

    expect(screen.queryByRole('button', { name: '移除话题 中文' })).not.toBeInTheDocument();
    expect(topicInput).toHaveValue('中文');
  });

  it('normalizes legacy single tag and image fields on read', () => {
    useUiStore.setState({
      quickDraft: {
        title: '旧标题',
        content: '旧正文',
        tag: '旧话题',
        image: 'data:image/png;base64,legacy',
      },
    });
    render(<QuickCompose />);

    expect(screen.getByRole('textbox', { name: '树洞标题（选填）' })).toHaveValue('旧标题');
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('旧正文');
    expect(screen.getByRole('button', { name: '移除话题 旧话题' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '待发布图片 1' })).toHaveAttribute('src', 'data:image/png;base64,legacy');
  });

  it('appends multiple file selections, removes one preview, enforces nine images, and checks encoded byte limits', async () => {
    const view = render(<QuickCompose />);
    selectFiles(view.container, makeFiles(2));
    await waitFor(() => expect(screen.getByText('2/9 张')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '移除第 1 张图片' }));
    expect(screen.getByText('1/9 张')).toBeInTheDocument();

    selectFiles(view.container, makeFiles(10));
    await waitFor(() => expect(screen.getByText('9/9 张')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('最多上传 9 张图片');
    expect(fileToOptimizedDataUrl).toHaveBeenCalledTimes(10);

    fireEvent.click(screen.getByRole('button', { name: '移除第 1 张图片' }));
    fileToOptimizedDataUrl.mockResolvedValueOnce(`data:image/png;base64,${'A'.repeat(3 * 1024 * 1024)}`);
    selectFiles(view.container, makeFiles(1));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('单张图片不能超过 3MB'));
    expect(screen.getAllByRole('img', { name: /待发布图片/ })).toHaveLength(8);

    act(() => useUiStore.getState().updateQuickDraft({ images: [] }));
    const nearLimitImage = `data:image/png;base64,${'A'.repeat(2_800_000)}`;
    fileToOptimizedDataUrl.mockResolvedValue(nearLimitImage);
    selectFiles(view.container, makeFiles(3));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('图片总大小不能超过 8MB'));
    expect(screen.queryByRole('img', { name: /待发布图片/ })).not.toBeInTheDocument();
  });

  it('disables publish and editor handoff while image processing is pending', async () => {
    const image = deferred();
    fileToOptimizedDataUrl.mockReturnValue(image.promise);
    const view = render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '处理期间的新文字' } });
    selectFiles(view.container, makeFiles(1));

    expect(screen.getByRole('button', { name: '处理图片…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '完整编辑器' })).toBeDisabled();
    await act(async () => image.resolve('data:image/png;base64,ready'));
    await waitFor(() => expect(screen.getByText('1/9 张')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('处理期间的新文字');
    expect(screen.getByRole('button', { name: '发布', exact: true })).toBeEnabled();
  });

  it('keeps processing reservations across remount and caps selections against pending files', async () => {
    const image = deferred();
    fileToOptimizedDataUrl.mockReturnValue(image.promise);
    const firstView = render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '处理中仍保留正文' } });
    selectFiles(firstView.container, makeFiles(1));
    firstView.unmount();

    const remounted = render(<QuickCompose />);
    expect(screen.getByText(/0\/9 张 · 处理中 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '处理图片…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '完整编辑器' })).toBeDisabled();
    selectFiles(remounted.container, makeFiles(9));
    expect(screen.getByText(/0\/9 张 · 处理中 9/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('最多上传 9 张图片');
    expect(fileToOptimizedDataUrl).toHaveBeenCalledTimes(9);

    await act(async () => image.resolve('data:image/png;base64,ready'));
    await waitFor(() => expect(screen.getByText('9/9 张')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('处理中仍保留正文');
    remounted.unmount();
  });

  it('ignores the old account image result and its release after a reset', async () => {
    const oldImage = deferred();
    const newImage = deferred();
    fileToOptimizedDataUrl
      .mockReturnValueOnce(oldImage.promise)
      .mockReturnValueOnce(newImage.promise);
    const view = render(<QuickCompose />);
    selectFiles(view.container, makeFiles(1));

    act(() => {
      useAuthStore.setState({ user: { _id: 'account-2' } });
      useUiStore.getState().resetQuickDraft();
      useUiStore.getState().updateQuickDraft({ content: '新账号正文' });
    });
    selectFiles(view.container, makeFiles(1));
    await act(async () => oldImage.resolve('data:image/png;base64,old'));
    expect(screen.getByText(/0\/9 张 · 处理中 1/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('新账号正文');
    expect(screen.queryByRole('img', { name: /待发布图片/ })).not.toBeInTheDocument();

    await act(async () => newImage.resolve('data:image/png;base64,new'));
    await waitFor(() => expect(screen.getByText('1/9 张')).toBeInTheDocument());
    expect(screen.getByRole('img', { name: '待发布图片 1' })).toHaveAttribute('src', 'data:image/png;base64,new');
  });

  it('keeps content and images after a failed publish so the user can retry', async () => {
    addPost.mockRejectedValueOnce(new Error('服务暂时不可用'));
    const view = render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '请保留这条内容' } });
    selectFiles(view.container, makeFiles(1));
    await waitFor(() => expect(screen.getByText('1/9 张')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '发布', exact: true }));

    expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用');
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('请保留这条内容');
    expect(screen.getAllByRole('img', { name: /待发布图片/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '发布', exact: true })).toBeEnabled();
  });

  it('keeps a newer draft across unmount when an older publish completes', async () => {
    const publish = deferred();
    addPost.mockReturnValue(publish.promise);
    const view = render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '旧草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '发布', exact: true }));
    expect(screen.getByRole('button', { name: '发布中…' })).toBeDisabled();

    view.unmount();
    act(() => useUiStore.getState().updateQuickDraft({ content: '更新后的草稿' }));
    const remounted = render(<QuickCompose />);
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('更新后的草稿');
    expect(screen.getByRole('button', { name: '发布中…' })).toBeDisabled();

    await act(async () => publish.resolve({ id: 'post-1' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '发布', exact: true })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('更新后的草稿');
    expect(addPost).toHaveBeenCalledTimes(1);
    remounted.unmount();
  });

  it('shows a failed publish inline after the composer remounts', async () => {
    const publish = deferred();
    addPost.mockReturnValue(publish.promise);
    const firstView = render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '等待失败的正文' } });
    fireEvent.click(screen.getByRole('button', { name: '发布', exact: true }));
    firstView.unmount();
    render(<QuickCompose />);

    await act(async () => publish.reject(new Error('网络连接中断')));
    expect(await screen.findByRole('alert')).toHaveTextContent('网络连接中断');
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('等待失败的正文');
    expect(screen.getByRole('button', { name: '发布', exact: true })).toBeEnabled();
  });

  it('does not restore or clear the previous account draft after an auth reset', async () => {
    const publish = deferred();
    addPost.mockReturnValue(publish.promise);
    render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '旧账号内容' } });
    fireEvent.click(screen.getByRole('button', { name: '发布', exact: true }));

    act(() => {
      useAuthStore.setState({ user: { _id: 'account-2' } });
      useUiStore.getState().resetQuickDraft();
      useUiStore.getState().updateQuickDraft({ content: '新账号内容' });
    });
    await act(async () => publish.resolve({ id: 'post-1' }));

    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('新账号内容');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('hands all values and an uncommitted custom topic to the full editor', async () => {
    const view = render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞标题（选填）' }), { target: { value: '标题' } });
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '正文' } });
    fireEvent.click(screen.getByRole('button', { name: '话题' }));
    fireEvent.click(screen.getByRole('button', { name: '#求助' }));
    fireEvent.change(screen.getByRole('textbox', { name: '输入自定义话题' }), { target: { value: '周末计划' } });
    selectFiles(view.container, makeFiles(2));
    await waitFor(() => expect(screen.getByText('2/9 张')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '完整编辑器' }));

    expect(navigate).toHaveBeenCalledWith('compose', {
      composeSeed: {
        title: '标题',
        content: '正文',
        tags: ['求助', '周末计划'],
        images: ['data:image/png;base64,image-0.png', 'data:image/png;base64,image-1.png'],
      },
    });
  });

  it('does not surface a refresh failure as a publish failure or leave a retryable duplicate', async () => {
    fetchPosts.mockRejectedValue(new Error('信息流刷新失败'));
    render(<QuickCompose />);
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '已经发出的内容' } });
    fireEvent.click(screen.getByRole('button', { name: '发布', exact: true }));

    await waitFor(() => expect(fetchPosts).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: '发布', exact: true })).toBeDisabled());
    expect(addPost).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useUiStore.getState().quickDraft).toEqual({ title: '', content: '', tags: [], images: [] });
  });
});
