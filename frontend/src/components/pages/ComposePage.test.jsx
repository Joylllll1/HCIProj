import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ComposePage from './ComposePage';
import useUiStore from '../../store/uiStore';
import * as draftService from '../../services/draftService';
import usePostStore from '../../store/postStore';
import { fileToOptimizedDataUrl } from '../../utils/image';

const createPostMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/postService', () => ({
  createPost: createPostMock,
}));

vi.mock('../../services/draftService', () => ({
  fetchDraftById: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  publishDraft: vi.fn(),
}));

vi.mock('../../utils/image', () => ({
  fileToOptimizedDataUrl: vi.fn(),
  getImageGridLayout: vi.fn(() => ({ gridClass: 'grid-cols-3', itemClass: 'aspect-square' })),
  MAX_POST_IMAGES: 9,
}));

vi.mock('../common/Icon', () => ({ default: () => <span aria-hidden="true" /> }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const makeImageDataUrl = (payloadBytes, character = 'A') => (
  `data:image/png;base64,${character.repeat(payloadBytes)}`
);

const savedDraft = (content, extra = {}) => ({
  id: 'draft-1',
  title: '',
  content,
  moodType: null,
  tags: [],
  images: [],
  updatedAt: '2026-10-23T10:00:00.000Z',
  ...extra,
});

let showToast;
let navigate;

beforeEach(() => {
  vi.clearAllMocks();
  showToast = vi.fn();
  navigate = vi.fn();
  useUiStore.setState({
    composeSeed: null,
    draftId: null,
    unsavedChangesHandler: null,
    showToast,
    navigate,
  });
  usePostStore.setState(usePostStore.getInitialState(), true);
});

afterEach(() => {
  cleanup();
  useUiStore.setState({ composeSeed: null, unsavedChangesHandler: null });
  window.history.replaceState(null, '', '/');
});

describe('ComposePage', () => {
  it('keeps a draft editor unavailable until its deferred load completes', async () => {
    const load = deferred();
    draftService.fetchDraftById.mockReturnValue(load.promise);

    render(<ComposePage draftId="draft-1" onPublish={vi.fn()} />);

    const content = screen.getByRole('textbox', { name: '树洞内容' });
    expect(screen.getByRole('status')).toHaveTextContent('正在加载草稿');
    expect(content).toBeDisabled();
    fireEvent.change(content, { target: { value: '这段输入不应被覆盖' } });
    expect(content).toHaveValue('');

    await act(async () => {
      load.resolve(savedDraft('服务器中的草稿内容'));
    });

    expect(content).toHaveValue('服务器中的草稿内容');
    expect(content).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps load errors on the page, retries, and retains the dirty guard after publish failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const publish = deferred();
    draftService.fetchDraftById
      .mockRejectedValueOnce(new Error('网络暂时不可用'))
      .mockResolvedValueOnce(savedDraft('已保存的正文'));
    draftService.updateDraft.mockResolvedValue(savedDraft('准备发布的正文'));
    draftService.publishDraft.mockReturnValue(publish.promise);

    render(<ComposePage draftId="draft-1" onPublish={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用');
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    const content = screen.getByRole('textbox', { name: '树洞内容' });
    await waitFor(() => expect(content).toHaveValue('已保存的正文'));
    fireEvent.change(content, { target: { value: '准备发布的正文' } });
    await waitFor(() => expect(useUiStore.getState().unsavedChangesHandler).toEqual(expect.any(Function)));

    fireEvent.click(screen.getByRole('button', { name: '发布动态' }));

    await waitFor(() => expect(draftService.publishDraft).toHaveBeenCalledWith('draft-1'));
    await expect(useUiStore.getState().unsavedChangesHandler()).resolves.toBe(false);
    expect(showToast).toHaveBeenCalledWith('操作进行中，请稍后再离开');
    await act(async () => {
      publish.reject(new Error('发布失败，请重试'));
    });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('发布失败，请重试'));
    expect(content).toHaveValue('准备发布的正文');
    expect(useUiStore.getState().unsavedChangesHandler).toEqual(expect.any(Function));
    expect(navigate).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('serializes save and publish requests when both actions are triggered together', async () => {
    const save = deferred();
    const onPublish = vi.fn();
    draftService.createDraft.mockReturnValue(save.promise);
    render(<ComposePage onPublish={onPublish} />);

    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), {
      target: { value: '待保存内容' },
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
      fireEvent.click(screen.getByRole('button', { name: '发布动态' }));
    });

    expect(draftService.createDraft).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '发布动态' })).toBeDisabled();

    await act(async () => {
      save.resolve(savedDraft('待保存内容'));
    });
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('does not restore compose navigation or draft state when a deferred save completes after unmount', async () => {
    const save = deferred();
    draftService.createDraft.mockReturnValue(save.promise);
    window.history.replaceState(null, '', '/compose');
    const view = render(<ComposePage onPublish={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), {
      target: { value: '离开后完成的保存' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(draftService.createDraft).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => {
      save.resolve(savedDraft('离开后完成的保存'));
    });

    expect(`${window.location.pathname}${window.location.search}`).toBe('/compose');
    expect(useUiStore.getState().draftId).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('does not redirect home when a pending draft publish completes after the editor unmounts', async () => {
    const publish = deferred();
    useUiStore.setState({ draftId: 'draft-1' });
    draftService.fetchDraftById.mockResolvedValue(savedDraft('待发布内容'));
    draftService.publishDraft.mockReturnValue(publish.promise);
    window.history.replaceState(null, '', '/compose?draftId=draft-1');
    const view = render(<ComposePage draftId="draft-1" onPublish={vi.fn()} />);

    await screen.findByDisplayValue('待发布内容');
    fireEvent.click(screen.getByRole('button', { name: '发布动态' }));
    await waitFor(() => expect(draftService.publishDraft).toHaveBeenCalledWith('draft-1'));

    view.unmount();
    window.history.replaceState(null, '', '/drafts');
    await act(async () => {
      publish.resolve({});
    });

    expect(`${window.location.pathname}${window.location.search}`).toBe('/drafts');
    expect(useUiStore.getState().draftId).toBe('draft-1');
    expect(showToast).not.toHaveBeenCalledWith('发布成功');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('adds the published draft response to the feed without creating a second post', async () => {
    const publishedPost = {
      id: 'post-from-draft',
      title: '草稿标题',
      content: '待发布内容',
      likes: 0,
      saves: 0,
      comments: 0,
      isLiked: false,
    };
    draftService.fetchDraftById.mockResolvedValue(savedDraft('待发布内容', { title: '草稿标题' }));
    draftService.publishDraft.mockResolvedValueOnce(publishedPost);

    render(<ComposePage draftId="draft-1" onPublish={vi.fn()} />);
    await screen.findByDisplayValue('待发布内容');
    fireEvent.click(screen.getByRole('button', { name: '发布动态' }));

    await waitFor(() => {
      expect(usePostStore.getState().posts[0]).toMatchObject(publishedPost);
    });
    expect(draftService.publishDraft).toHaveBeenCalledWith('draft-1');
    expect(createPostMock).not.toHaveBeenCalled();
    expect(usePostStore.getState().posts).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith('home', undefined, { force: true });
  });

  it('preserves the route history state when saving and publishing a draft', async () => {
    const routeState = { njuRouteIndex: 12 };
    draftService.createDraft.mockResolvedValueOnce(savedDraft('草稿正文'));
    draftService.publishDraft.mockResolvedValueOnce({
      id: 'published-post',
      content: '草稿正文',
      isLiked: false,
      likes: 0,
    });
    window.history.replaceState(routeState, '', '/compose');
    render(<ComposePage onPublish={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), {
      target: { value: '草稿正文' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(window.location.search).toBe('?draftId=draft-1'));
    expect(window.history.state).toEqual(routeState);

    fireEvent.click(screen.getByRole('button', { name: '发布动态' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('home', undefined, { force: true }));
    expect(window.location.pathname).toBe('/compose');
    expect(window.history.state).toEqual(routeState);
  });

  it('preserves edits made while a save is pending and marks them unsaved', async () => {
    const save = deferred();
    draftService.createDraft.mockReturnValue(save.promise);
    draftService.updateDraft.mockResolvedValue(savedDraft('第二版内容'));
    const view = render(<ComposePage onPublish={vi.fn()} />);

    const content = screen.getByRole('textbox', { name: '树洞内容' });
    fireEvent.change(content, { target: { value: '第一版内容' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByRole('button', { name: '保存中...' })).toBeDisabled();

    fireEvent.change(content, { target: { value: '第二版内容' } });
    expect(content).toHaveValue('第二版内容');

    await act(async () => {
      save.resolve(savedDraft('第一版内容'));
    });

    view.rerender(<ComposePage draftId="draft-1" onPublish={vi.fn()} />);

    expect(content).toHaveValue('第二版内容');
    expect(draftService.fetchDraftById).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('已保存，之后的修改尚未保存');
    expect(useUiStore.getState().unsavedChangesHandler).toEqual(expect.any(Function));

    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(draftService.updateDraft).toHaveBeenCalledWith('draft-1', expect.objectContaining({ content: '第二版内容' })));
    expect(content).toHaveValue('第二版内容');
  });

  it('keeps form values after a save failure and prevents title-only drafts', async () => {
    draftService.createDraft.mockRejectedValue(new Error('保存失败，请重试'));
    render(<ComposePage onPublish={vi.fn()} />);

    const title = screen.getByRole('textbox', { name: '树洞标题（选填）' });
    const content = screen.getByRole('textbox', { name: '树洞内容' });
    fireEvent.change(title, { target: { value: '只有标题' } });
    expect(screen.getByText('标题不能单独保存；请补充正文或上传图片。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled();
    expect(draftService.createDraft).not.toHaveBeenCalled();

    fireEvent.change(content, { target: { value: '正文内容' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('保存失败，请重试'));
    expect(title).toHaveValue('只有标题');
    expect(content).toHaveValue('正文内容');
    expect(useUiStore.getState().unsavedChangesHandler).toEqual(expect.any(Function));
  });

  it('adopts saved media URLs without making an unchanged draft dirty again', async () => {
    const upload = 'data:image/png;base64,cGhvdG8=';
    const url = '/api/media/drafts/draft-1/0?v=photo';
    useUiStore.setState({ composeSeed: { content: '图片正文', images: [upload] } });
    draftService.createDraft.mockResolvedValue(savedDraft('图片正文', { images: [url], imageBytes: [upload.length] }));
    draftService.updateDraft.mockResolvedValue(savedDraft('继续写正文', { images: [url], imageBytes: [upload.length] }));
    render(<ComposePage onPublish={vi.fn()} />);
    await screen.findByRole('img', { name: '待发布图片 1' });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => expect(screen.getByRole('img', { name: '待发布图片 1' })).toHaveAttribute('src', url));
    expect(showToast).toHaveBeenCalledWith('已保存');
    expect(useUiStore.getState().unsavedChangesHandler).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '继续写正文' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(draftService.updateDraft).toHaveBeenCalledWith('draft-1', expect.objectContaining({ images: [url] })));
  });

  it('maps duplicate uploaded images to separate saved positions and clears the dirty guard', async () => {
    const upload = 'data:image/png;base64,cGhvdG8=';
    const urls = ['/api/media/drafts/draft-1/0?v=photo', '/api/media/drafts/draft-1/1?v=photo'];
    useUiStore.setState({ composeSeed: { content: '相同图片两次', images: [upload, upload] } });
    draftService.createDraft.mockResolvedValue(savedDraft('相同图片两次', {
      images: urls, imageBytes: [upload.length, upload.length],
    }));
    render(<ComposePage onPublish={vi.fn()} />);
    await screen.findByRole('img', { name: '待发布图片 2' });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('已保存'));
    expect(screen.getAllByRole('img', { name: /待发布图片/ }).map((image) => image.getAttribute('src'))).toEqual(urls);
    expect(useUiStore.getState().unsavedChangesHandler).toBeNull();
  });

  it('counts stored image bytes instead of URL lengths when adding to an opened draft', async () => {
    const urls = ['/api/media/drafts/draft-1/0?v=first', '/api/media/drafts/draft-1/1?v=second'];
    const size = Math.floor(2.9 * 1024 * 1024);
    draftService.fetchDraftById.mockResolvedValue(savedDraft('已保存图片', { images: urls, imageBytes: [size, size] }));
    fileToOptimizedDataUrl.mockResolvedValue(makeImageDataUrl(size));
    render(<ComposePage draftId="draft-1" onPublish={vi.fn()} />);
    await screen.findByRole('img', { name: '待发布图片 2' });
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [new File(['third'], 'third.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('图片总大小不能超过 8MB，请移除部分图片后重试。'));
    expect(screen.getAllByRole('img', { name: /待发布图片/ }).map((image) => image.getAttribute('src'))).toEqual(urls);
  });

  it('keeps text edits and image removal made while uploaded images are being saved', async () => {
    const save = deferred();
    const upload = 'data:image/png;base64,cGhvdG8=';
    useUiStore.setState({ composeSeed: { content: '保存中的正文', images: [upload] } });
    draftService.createDraft.mockReturnValue(save.promise);
    render(<ComposePage onPublish={vi.fn()} />);
    await screen.findByRole('img', { name: '待发布图片 1' });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    fireEvent.change(screen.getByRole('textbox', { name: '树洞内容' }), { target: { value: '保存期间继续修改' } });
    fireEvent.click(screen.getByRole('button', { name: '删除第 1 张图片' }));
    await act(async () => save.resolve(savedDraft('保存中的正文', {
      images: ['/api/media/drafts/draft-1/0?v=photo'], imageBytes: [upload.length],
    })));
    expect(screen.queryByRole('img', { name: '待发布图片 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('保存期间继续修改');
    expect(useUiStore.getState().unsavedChangesHandler).toEqual(expect.any(Function));
    expect(showToast).toHaveBeenCalledWith('已保存，之后的修改尚未保存');
  });

  it('rejects an over-limit image batch, preserves existing content, and accepts a smaller retry', async () => {
    const existingImage = makeImageDataUrl(2_800_000, 'E');
    const nearLimitImage = makeImageDataUrl(Math.floor(2.9 * 1024 * 1024));
    const smallerImage = 'data:image/png;base64,small';
    const onPublish = vi.fn().mockResolvedValue(undefined);
    useUiStore.setState({
      composeSeed: { title: '', content: '正文保留', moodType: null, tags: [], images: [existingImage] },
    });
    fileToOptimizedDataUrl.mockResolvedValue(nearLimitImage);
    render(<ComposePage onPublish={onPublish} />);

    const fileInput = document.querySelector('input[type="file"]');
    await screen.findByRole('img', { name: '待发布图片 1' });
    fireEvent.change(fileInput, {
      target: { files: [
        new File(['one'], 'one.png', { type: 'image/png' }),
        new File(['two'], 'two.png', { type: 'image/png' }),
        new File(['three'], 'three.png', { type: 'image/png' }),
      ] },
    });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('图片总大小不能超过 8MB，请移除部分图片后重试。'));
    expect(screen.getAllByRole('img', { name: /待发布图片/ })).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('正文保留');

    fileToOptimizedDataUrl.mockResolvedValueOnce(smallerImage);
    fireEvent.change(fileInput, {
      target: { files: [new File(['retry'], 'retry.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getAllByRole('img', { name: /待发布图片/ })).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: '发布动态' }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish.mock.calls[0][0]).toMatchObject({
      content: '正文保留',
      images: [existingImage, smallerImage],
    });
  });

  it('checks concurrent image batches against the latest form total', async () => {
    const existingImage = makeImageDataUrl(2_800_000, 'E');
    const firstImage = makeImageDataUrl(Math.floor(2.9 * 1024 * 1024), 'A');
    const secondImage = makeImageDataUrl(Math.floor(2.9 * 1024 * 1024), 'B');
    const firstRead = deferred();
    const secondRead = deferred();
    fileToOptimizedDataUrl
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);
    useUiStore.setState({
      composeSeed: { title: '', content: '并发正文', moodType: null, tags: [], images: [existingImage] },
    });
    render(<ComposePage onPublish={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]');
    await screen.findByRole('img', { name: '待发布图片 1' });
    fireEvent.change(fileInput, {
      target: { files: [new File(['first'], 'first.png', { type: 'image/png' })] },
    });
    fireEvent.change(fileInput, {
      target: { files: [new File(['second'], 'second.png', { type: 'image/png' })] },
    });

    await act(async () => firstRead.resolve(firstImage));
    await waitFor(() => expect(screen.getAllByRole('img', { name: /待发布图片/ })).toHaveLength(2));
    await act(async () => secondRead.resolve(secondImage));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('图片总大小不能超过 8MB，请移除部分图片后重试。'));
    expect(screen.getAllByRole('img', { name: /待发布图片/ })).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: '树洞内容' })).toHaveValue('并发正文');
    expect(screen.getAllByRole('img', { name: /待发布图片/ }).map((image) => image.getAttribute('src'))).toEqual([
      existingImage,
      firstImage,
    ]);
  });

  it('reserves image slots while files are processing and refuses publish until they finish', async () => {
    const imageRead = deferred();
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const existingImages = Array.from({ length: 8 }, (_, index) => `data:image/png;base64,${index}`);
    useUiStore.setState({
      composeSeed: { title: '', content: '正文', moodType: null, tags: [], images: existingImages },
    });
    fileToOptimizedDataUrl.mockReturnValue(imageRead.promise);
    render(<ComposePage onPublish={onPublish} />);

    const fileInput = document.querySelector('input[type="file"]');
    const first = new File(['one'], 'one.png', { type: 'image/png' });
    const extra = new File(['extra'], 'extra.png', { type: 'image/png' });

    act(() => {
      fireEvent.change(fileInput, { target: { files: [first] } });
      fireEvent.click(screen.getByRole('button', { name: '发布动态' }));
      fireEvent.change(fileInput, { target: { files: [extra] } });
    });

    expect(fileToOptimizedDataUrl).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '发布动态' })).toBeDisabled();

    await act(async () => {
      imageRead.resolve('data:image/png;base64,processed');
    });

    fireEvent.click(screen.getByRole('button', { name: '发布动态' }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish.mock.calls[0][0].images).toHaveLength(9);
  });
});
