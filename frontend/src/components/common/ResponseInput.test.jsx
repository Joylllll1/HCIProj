import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResponseInput from './ResponseInput';
import useUiStore from '../../store/uiStore';
import { fileToOptimizedDataUrl } from '../../utils/image';
vi.mock('../../utils/image', () => ({ fileToOptimizedDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,dGVzdA==') }));
afterEach(cleanup);

describe('ResponseInput recovery', () => {
  it('retains failed content, blocks duplicate sends, then clears on successful retry', async () => {
    let reject;
    const submit = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValueOnce({});
    render(<ResponseInput onSubmit={submit} />);
    const input = screen.getByRole('textbox', { name: '评论内容' });
    fireEvent.change(input, { target: { value: '请保留这段话' } });
    fireEvent.click(screen.getByRole('button', { name: '发送评论' }));
    expect(screen.getByRole('button', { name: '发送中…' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form'));
    expect(submit).toHaveBeenCalledTimes(1);
    reject(new Error('网络暂时不可用'));
    await screen.findByRole('alert');
    expect(input).toHaveValue('请保留这段话');
    fireEvent.click(screen.getByRole('button', { name: '发送评论' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(submit).toHaveBeenCalledTimes(2);
  });
});

it('retains the attached image when the server rejects the response', async () => {
  const submit = vi.fn().mockRejectedValue(new Error('服务器暂时不可用'));
  const { container } = render(<ResponseInput onSubmit={submit} />);
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  await screen.findByAltText('待发送的图片');
  fireEvent.click(screen.getByRole('button', { name: '发送评论' }));
  await screen.findByRole('alert');
  expect(screen.getByAltText('待发送的图片')).toBeInTheDocument();
  expect(submit).toHaveBeenCalledWith('', 'data:image/png;base64,dGVzdA==');
});

it('keeps the latest comment text when image conversion finishes after more typing', async () => {
  useUiStore.setState({ responseDrafts: {} });
  let finish;
  fileToOptimizedDataUrl.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { container, unmount } = render(<ResponseInput draftKey="late-image" onSubmit={vi.fn()} />);
  const input = screen.getByRole('textbox', { name: '评论内容' });
  fireEvent.change(input, { target: { value: '先写' } });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  fireEvent.change(input, { target: { value: '先写，然后继续写完' } });
  finish('data:image/png;base64,dGVzdA==');
  await screen.findByAltText('待发送的图片');
  unmount();
  render(<ResponseInput draftKey="late-image" onSubmit={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: '评论内容' })).toHaveValue('先写，然后继续写完');
  expect(screen.getByAltText('待发送的图片')).toBeInTheDocument();
});

it('keeps sending state across remounts and never clears a newer shared draft', async () => {
  useUiStore.setState({ responseDrafts: {}, responseActivities: {} });
  let finish;
  const submit = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  const first = render(<ResponseInput draftKey="sending-remount" onSubmit={submit} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '发出的内容' } });
  fireEvent.submit(screen.getByRole('form'));
  first.unmount();
  const second = render(<ResponseInput draftKey="sending-remount" onSubmit={submit} />);
  expect(screen.getByRole('textbox')).toBeDisabled();
  fireEvent.submit(screen.getByRole('form'));
  expect(submit).toHaveBeenCalledTimes(1);
  act(() => useUiStore.setState({ responseDrafts: { 'sending-remount': { text: '另一处更新的未发送内容', image: '' } } }));
  await act(async () => finish());
  second.unmount();
  render(<ResponseInput draftKey="sending-remount" onSubmit={submit} />);
  expect(screen.getByRole('textbox')).toHaveValue('另一处更新的未发送内容');
});

it('merges a late image with text edited after returning to the discussion', async () => {
  useUiStore.setState({ responseDrafts: {}, responseActivities: {} });
  let finish;
  fileToOptimizedDataUrl.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = render(<ResponseInput draftKey="image-remount" onSubmit={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '原来的内容' } });
  fireEvent.change(first.container.querySelector('input[type="file"]'), { target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] } });
  first.unmount();
  render(<ResponseInput draftKey="image-remount" onSubmit={vi.fn()} />);
  expect(screen.getByRole('button', { name: '发送评论' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '返回后继续写的内容' } });
  await act(async () => finish('data:image/png;base64,dGVzdA=='));
  expect(screen.getByRole('textbox')).toHaveValue('返回后继续写的内容');
  expect(screen.getByAltText('待发送的图片')).toBeInTheDocument();
});

it('does not restore an image after account changes clear all draft operations', async () => {
  useUiStore.setState({ responseDrafts: {}, responseActivities: {} });
  let finish;
  fileToOptimizedDataUrl.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { container } = render(<ResponseInput draftKey="old-account" onSubmit={vi.fn()} />);
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] } });
  act(() => useUiStore.setState({ responseDrafts: {}, responseActivities: {} }));
  await act(async () => finish('data:image/png;base64,dGVzdA=='));
  expect(useUiStore.getState().responseDrafts).toEqual({});
  expect(screen.queryByAltText('待发送的图片')).not.toBeInTheDocument();
});
