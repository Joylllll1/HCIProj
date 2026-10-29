import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import useUiStore from './uiStore';

const handlePop = () => useUiStore.getState().handlePopState();
let observedPopListener = null;

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState(), true);
  window.history.replaceState({}, '', '/compose');
  window.scrollTo = vi.fn();
  useUiStore.setState({ activePage: 'compose' });
  window.addEventListener('popstate', handlePop);
});

afterEach(() => {
  window.removeEventListener('popstate', handlePop);
  if (observedPopListener) window.removeEventListener('popstate', observedPopListener);
  observedPopListener = null;
  vi.restoreAllMocks();
});

async function startRapidBackScenario(saveHandler) {
  window.history.replaceState({ njuRouteIndex: 0 }, '', '/');
  useUiStore.setState({
    activePage: 'home',
    historyIndex: 0,
    historyAction: null,
    historyRestore: null,
    historyContinuation: null,
    pendingNavigation: null,
    navigationSaving: false,
    navigationError: '',
    leaveConfirm: { ...useUiStore.getInitialState().leaveConfirm, open: false },
    unsavedChangesHandler: null,
    routeVersion: 0,
  });
  useUiStore.getState().navigate('detail', { selectedPost: { id: 'post-a' } });
  useUiStore.getState().navigate('compose');
  useUiStore.getState().setUnsavedChangesHandler(saveHandler);

  const popPaths = [];
  observedPopListener = () => popPaths.push(window.location.pathname);
  window.addEventListener('popstate', observedPopListener);
  const go = vi.spyOn(window.history, 'go');
  window.history.back();
  setTimeout(() => window.history.back(), 0);

  await waitFor(() => expect(useUiStore.getState().leaveConfirm.open).toBe(true));
  await waitFor(() => expect(useUiStore.getState().pendingNavigation?.target?.index).toBe(0));
  return { go, popPaths };
}

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

it('waits for an in-flight Back restoration before pushing a saved app destination', async () => {
  window.history.replaceState({ njuRouteIndex: 0 }, '', '/');
  useUiStore.setState({ activePage: 'home', historyIndex: 0, historyAction: null, historyRestore: null });
  useUiStore.getState().navigate('detail', { selectedPost: { id: 'post-a' } });
  useUiStore.getState().navigate('compose');

  let finishSave;
  const save = vi.fn(() => new Promise((resolve) => { finishSave = resolve; }));
  useUiStore.getState().setUnsavedChangesHandler(save);
  useUiStore.getState().navigate('drafts');
  const saving = useUiStore.getState().confirmPendingNavigation();

  const finishSaveAfterBack = () => {
    if (window.location.pathname === '/detail/post-a') finishSave(true);
  };
  window.addEventListener('popstate', finishSaveAfterBack);
  window.history.back();

  try {
    await saving;
    await waitFor(() => expect(window.location.pathname).toBe('/drafts'));
    expect(useUiStore.getState()).toMatchObject({
      activePage: 'drafts',
      historyIndex: 3,
      historyAction: null,
      historyRestore: null,
      navigationSaving: false,
    });
    expect(save).toHaveBeenCalledTimes(1);

    useUiStore.getState().clearUnsavedChangesHandler();
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/compose'));
    await waitFor(() => expect(useUiStore.getState().activePage).toBe('compose'));
    expect(useUiStore.getState().historyRestore).toBeNull();
  } finally {
    window.removeEventListener('popstate', finishSaveAfterBack);
  }
});

it('keeps the current URL when cancelling Back, then follows the original detail entry on discard', async () => {
  useUiStore.getState().navigate('detail', { selectedPost: { id: 'post-2' } });
  useUiStore.getState().navigate('compose');
  useUiStore.getState().setUnsavedChangesHandler(vi.fn().mockResolvedValue(true));

  window.history.back();
  await waitFor(() => expect(useUiStore.getState().leaveConfirm.open).toBe(true));
  await waitFor(() => expect(window.location.pathname).toBe('/compose'));
  await waitFor(() => expect(useUiStore.getState().historyAction).toBeNull());
  useUiStore.getState().closeLeaveConfirm();
  expect(useUiStore.getState().activePage).toBe('compose');

  window.history.back();
  await waitFor(() => expect(useUiStore.getState().leaveConfirm.open).toBe(true));
  await waitFor(() => expect(useUiStore.getState().historyAction).toBeNull());
  await useUiStore.getState().discardPendingNavigation();
  await waitFor(() => expect(useUiStore.getState().activePage).toBe('detail'));
  expect(window.location.pathname).toBe('/detail/post-2');
});

it('restores the current entry for guarded Forward and continues forward after saving', async () => {
  useUiStore.getState().navigate('compose', { draftId: 'draft-1' });
  useUiStore.getState().navigate('home');
  window.history.back();
  await waitFor(() => expect(useUiStore.getState().activePage).toBe('compose'));
  const save = vi.fn().mockResolvedValue(true);
  useUiStore.getState().setUnsavedChangesHandler(save);

  window.history.forward();
  await waitFor(() => expect(useUiStore.getState().leaveConfirm.open).toBe(true));
  await waitFor(() => expect(window.location.pathname).toBe('/compose'));
  await waitFor(() => expect(useUiStore.getState().historyAction).toBeNull());
  expect(new URLSearchParams(window.location.search).get('draftId')).toBe('draft-1');
  await useUiStore.getState().confirmPendingNavigation();
  await waitFor(() => expect(useUiStore.getState().activePage).toBe('home'));
  expect(window.location.pathname).toBe('/');
  expect(save).toHaveBeenCalledTimes(1);
});

it('increments routeVersion when Back and Forward traverse distinct detail entries', async () => {
  window.history.replaceState({ njuRouteIndex: 0 }, '', '/');
  useUiStore.setState({ activePage: 'home', historyIndex: 0, routeVersion: 0 });
  useUiStore.getState().navigate('detail', { selectedPost: { id: 'post-a' } });
  useUiStore.getState().navigate('detail', { selectedPost: { id: 'post-b' } });

  const versionBeforeTraversal = useUiStore.getState().routeVersion;
  window.history.back();
  await waitFor(() => expect(window.location.pathname).toBe('/detail/post-a'));
  await waitFor(() => expect(useUiStore.getState().historyIndex).toBe(1));
  expect(useUiStore.getState().activePage).toBe('detail');
  expect(useUiStore.getState().routeVersion).toBe(versionBeforeTraversal + 1);

  window.history.forward();
  await waitFor(() => expect(window.location.pathname).toBe('/detail/post-b'));
  await waitFor(() => expect(useUiStore.getState().historyIndex).toBe(2));
  expect(useUiStore.getState().activePage).toBe('detail');
  expect(useUiStore.getState().routeVersion).toBe(versionBeforeTraversal + 2);
});

it('keeps the latest destination through rapid Back events and stays put when cancelled', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const { go, popPaths } = await startRapidBackScenario(save);

  await waitFor(() => expect(window.location.pathname).toBe('/compose'));
  await waitFor(() => expect(useUiStore.getState().historyAction).toBeNull());
  expect(useUiStore.getState()).toMatchObject({
    activePage: 'compose',
    historyIndex: 2,
    historyRestore: null,
    pendingNavigation: expect.objectContaining({ page: 'home', target: expect.objectContaining({ index: 0 }) }),
  });
  expect(go.mock.calls).toContainEqual([1]);
  expect(go.mock.calls.some(([delta]) => delta === 0)).toBe(false);
  expect(popPaths).toEqual(['/detail/post-a', '/', '/compose']);

  useUiStore.getState().closeLeaveConfirm();
  expect(useUiStore.getState()).toMatchObject({
    activePage: 'compose',
    historyAction: null,
    historyRestore: null,
    pendingNavigation: null,
  });
  expect(window.location.pathname).toBe('/compose');
  expect(save).not.toHaveBeenCalled();
});

it('reissues restoration when a later Back cancels the queued restore traversal', async () => {
  window.history.replaceState({ njuRouteIndex: 0 }, '', '/');
  useUiStore.setState({
    activePage: 'home',
    historyIndex: 0,
    historyAction: null,
    historyRestore: null,
    historyContinuation: null,
    pendingNavigation: null,
    unsavedChangesHandler: null,
    routeVersion: 0,
  });
  useUiStore.getState().navigate('detail', { selectedPost: { id: 'demo-1' } });
  useUiStore.getState().navigate('compose');
  useUiStore.getState().setUnsavedChangesHandler(vi.fn().mockResolvedValue(true));

  const nativeGo = window.history.go.bind(window.history);
  let cancelFirstRestore = true;
  const go = vi.spyOn(window.history, 'go').mockImplementation((delta) => {
    if (cancelFirstRestore && delta === 1) {
      cancelFirstRestore = false;
      return;
    }
    nativeGo(delta);
  });

  window.history.back();
  setTimeout(() => window.history.back(), 0);
  await waitFor(() => expect(useUiStore.getState().pendingNavigation?.target?.index).toBe(0));
  useUiStore.getState().closeLeaveConfirm();

  await waitFor(() => expect(window.location.pathname).toBe('/compose'));
  await waitFor(() => expect(useUiStore.getState().historyRestore).toBeNull());
  expect(useUiStore.getState()).toMatchObject({
    activePage: 'compose',
    historyIndex: 2,
    historyAction: null,
    historyRestore: null,
    pendingNavigation: null,
    leaveConfirm: expect.objectContaining({ open: false }),
  });
  expect(go.mock.calls).toEqual([[1], [2]]);
  expect(go.mock.calls.some(([delta]) => delta === 0)).toBe(false);
});

it('discards after rapid Back events and follows the latest destination', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const { go, popPaths } = await startRapidBackScenario(save);

  await useUiStore.getState().discardPendingNavigation();
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  await waitFor(() => expect(useUiStore.getState().activePage).toBe('home'));
  expect(useUiStore.getState()).toMatchObject({
    historyIndex: 0,
    historyAction: null,
    historyRestore: null,
    historyContinuation: null,
    pendingNavigation: null,
  });
  expect(go.mock.calls.some(([delta]) => delta === 0)).toBe(false);
  expect(popPaths).toEqual(['/detail/post-a', '/', '/compose', '/']);
  expect(save).not.toHaveBeenCalled();
});

it('saves once after rapid Back events and follows the latest destination', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const { go, popPaths } = await startRapidBackScenario(save);

  await useUiStore.getState().confirmPendingNavigation();
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  await waitFor(() => expect(useUiStore.getState().activePage).toBe('home'));
  expect(useUiStore.getState()).toMatchObject({
    historyIndex: 0,
    historyAction: null,
    historyRestore: null,
    historyContinuation: null,
    pendingNavigation: null,
  });
  expect(go.mock.calls.some(([delta]) => delta === 0)).toBe(false);
  expect(popPaths).toEqual(['/detail/post-a', '/', '/compose', '/']);
  expect(save).toHaveBeenCalledTimes(1);
});
