import { beforeEach, expect, it, vi } from 'vitest';
import useUiStore from './uiStore';

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState(), true);
  window.history.replaceState({}, '', '/compose');
  window.scrollTo = vi.fn();
  useUiStore.setState({ activePage: 'compose' });
});

it('serializes save-and-leave and prevents cancellation while the save is pending', async () => {
  let finish;
  const save = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  useUiStore.getState().setUnsavedChangesHandler(save);
  useUiStore.getState().navigate('drafts');
  const pending = useUiStore.getState().confirmPendingNavigation();
  await useUiStore.getState().confirmPendingNavigation();
  useUiStore.getState().closeLeaveConfirm();
  await useUiStore.getState().discardPendingNavigation();
  expect(useUiStore.getState().navigate('home')).toBe(false);
  expect(save).toHaveBeenCalledTimes(1);
  expect(useUiStore.getState().leaveConfirm.open).toBe(true);
  expect(useUiStore.getState().activePage).toBe('compose');
  finish(true); await pending;
  expect(useUiStore.getState().activePage).toBe('drafts');
  expect(useUiStore.getState().navigationSaving).toBe(false);
  expect(useUiStore.getState().leaveConfirm.open).toBe(false);
});

it('retains the pending destination and dirty handler when saving fails, then retries', async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  useUiStore.getState().setUnsavedChangesHandler(save);
  useUiStore.getState().navigate('drafts');
  await useUiStore.getState().confirmPendingNavigation();
  expect(useUiStore.getState().navigationError).toContain('内容已保留');
  expect(useUiStore.getState().leaveConfirm.open).toBe(true);
  expect(useUiStore.getState().unsavedChangesHandler).toBe(save);
  expect(useUiStore.getState().activePage).toBe('compose');
  await useUiStore.getState().confirmPendingNavigation();
  expect(useUiStore.getState().activePage).toBe('drafts');
});
