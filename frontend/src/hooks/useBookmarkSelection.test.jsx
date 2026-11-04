import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useBookmarkSelection from './useBookmarkSelection';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

describe('useBookmarkSelection', () => {
  it('retries only visible failed moves after a post disappears during the request', async () => {
    const request = deferred();
    const onMove = vi.fn().mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce({ results: [{ postId: 'retryable', status: 'moved' }] });
    const { result, rerender } = renderHook(
      ({ visibleIds }) => useBookmarkSelection({ scope: 'folder', visibleIds, onMove }),
      { initialProps: { visibleIds: ['deleted', 'retryable', 'moved'] } },
    );

    act(() => {
      result.current.selectAll();
      result.current.openTarget();
      result.current.setTarget('destination');
    });
    act(() => { void result.current.execute('move'); });
    expect(onMove).toHaveBeenCalledWith(['deleted', 'retryable', 'moved'], 'destination');

    rerender({ visibleIds: ['retryable'] });
    expect(result.current.selected).toEqual(['retryable']);
    await act(async () => {
      request.resolve({ results: [
        { postId: 'deleted', status: 'failed' },
        { postId: 'retryable', status: 'failed' },
        { postId: 'moved', status: 'moved' },
      ] });
    });

    expect(result.current.selected).toEqual(['retryable']);
    expect(result.current.choosingTarget).toBe(true);
    expect(result.current.message).toBe('已移动 1 篇，2 篇失败，请重试');
    await act(async () => { await result.current.execute('move'); });
    expect(onMove).toHaveBeenNthCalledWith(2, ['retryable'], 'destination');
  });

  it('closes the move dialog when every failed post has disappeared', async () => {
    const request = deferred();
    const onMove = vi.fn().mockReturnValue(request.promise);
    const { result, rerender } = renderHook(
      ({ visibleIds }) => useBookmarkSelection({ scope: 'folder', visibleIds, onMove }),
      { initialProps: { visibleIds: ['deleted', 'unselected'] } },
    );

    act(() => {
      result.current.toggle('deleted');
      result.current.openTarget();
      result.current.setTarget('destination');
    });
    act(() => { void result.current.execute('move'); });
    expect(onMove).toHaveBeenCalledWith(['deleted'], 'destination');

    rerender({ visibleIds: ['unselected'] });
    expect(result.current.selected).toEqual([]);
    expect(result.current.pending).toBe(true);
    expect(result.current.choosingTarget).toBe(true);
    await act(async () => {
      request.resolve({ results: [{ postId: 'deleted', status: 'failed' }] });
    });

    expect(result.current.selected).toEqual([]);
    expect(result.current.choosingTarget).toBe(false);
    expect(result.current.target).toBe('');
    expect(result.current.message).toBe('1 篇失败');
  });

  it.each(['remove', 'move'])('closes an idle %s dialog when all selected posts disappear', (kind) => {
    const { result, rerender } = renderHook(
      ({ visibleIds }) => useBookmarkSelection({ scope: 'folder', visibleIds }),
      { initialProps: { visibleIds: ['deleted', 'unselected'] } },
    );

    act(() => {
      result.current.toggle('deleted');
      if (kind === 'remove') {
        result.current.setConfirming(true);
      } else {
        result.current.openTarget();
        result.current.setTarget('destination');
      }
    });
    const dialogKey = kind === 'remove' ? 'confirming' : 'choosingTarget';
    expect(result.current[dialogKey]).toBe(true);

    rerender({ visibleIds: ['unselected'] });
    expect(result.current.selected).toEqual([]);
    expect(result.current[dialogKey]).toBe(false);
    expect(result.current.target).toBe('');

    act(() => result.current.toggle('unselected'));
    expect(result.current[dialogKey]).toBe(false);
  });
});
