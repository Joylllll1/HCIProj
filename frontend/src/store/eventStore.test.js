import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventStore from './eventStore';
import * as eventService from '../services/eventService';

vi.mock('../services/eventService', () => ({
  getPublicEvents: vi.fn(), getMyEvents: vi.fn(),
  getPendingEvents: vi.fn(), getApprovedEvents: vi.fn(), getRejectedEvents: vi.fn(),
  createEvent: vi.fn(), approveEvent: vi.fn(), rejectEvent: vi.fn(),
  archiveEvent: vi.fn(), deleteEvent: vi.fn(),
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  useEventStore.setState(useEventStore.getInitialState(), true);
  useEventStore.getState().resetForAccountChange();
});

describe('eventStore list fetch recovery', () => {
  it('retains public events on failure and replaces them after a successful retry', async () => {
    const cachedEvent = { _id: 'event-old', title: '已加载活动' };
    const refreshedEvent = { _id: 'event-new', title: '新活动' };
    useEventStore.setState({ publicEvents: [cachedEvent] });
    eventService.getPublicEvents.mockRejectedValueOnce(new Error('连接失败')).mockResolvedValueOnce([refreshedEvent]);

    await useEventStore.getState().fetchPublicEvents();
    expect(useEventStore.getState().publicEvents).toEqual([cachedEvent]);
    expect(useEventStore.getState().publicError).toBe('连接失败');
    expect(useEventStore.getState().publicLoading).toBe(false);

    await useEventStore.getState().fetchPublicEvents();
    expect(useEventStore.getState().publicEvents).toEqual([refreshedEvent]);
    expect(useEventStore.getState().publicError).toBeNull();
  });

  it('tracks application errors separately and retains prior applications on failure', async () => {
    const cachedApplication = { _id: 'application-old', title: '已提交申请' };
    useEventStore.setState({ myEvents: [cachedApplication], publicError: '另一列表错误' });
    eventService.getMyEvents.mockRejectedValueOnce(new Error('登录服务暂不可用'));

    await useEventStore.getState().fetchMyEvents();

    expect(useEventStore.getState().myEvents).toEqual([cachedApplication]);
    expect(useEventStore.getState().myEventsError).toBe('登录服务暂不可用');
    expect(useEventStore.getState().publicError).toBe('另一列表错误');
    expect(useEventStore.getState().myEventsLoading).toBe(false);
  });
});

describe('activity application request ownership', () => {
  it('clears private applications and ignores the previous account response', async () => {
    const previous = deferred();
    const publicEvents = [{ _id: 'public' }];
    useEventStore.setState({ publicEvents, myEvents: [{ _id: 'old', applicantPhone: '13800000000' }] });
    eventService.getMyEvents.mockReturnValueOnce(previous.promise);
    const request = useEventStore.getState().fetchMyEvents();
    useEventStore.getState().resetForAccountChange();
    previous.resolve([{ _id: 'old-private-response' }]);
    await request;
    expect(useEventStore.getState()).toMatchObject({ publicEvents, myEvents: [], myEventsLoading: false });
  });

  it('keeps the newest application refresh when an older request finishes later', async () => {
    const previous = deferred();
    eventService.getMyEvents.mockReturnValueOnce(previous.promise).mockResolvedValueOnce([{ _id: 'latest' }]);
    const request = useEventStore.getState().fetchMyEvents();
    await useEventStore.getState().fetchMyEvents();
    previous.resolve([{ _id: 'stale' }]);
    await request;
    expect(useEventStore.getState().myEvents).toEqual([{ _id: 'latest' }]);
  });

  it('does not show an old account error after reset', async () => {
    const previous = deferred();
    eventService.getMyEvents.mockReturnValueOnce(previous.promise);
    const request = useEventStore.getState().fetchMyEvents();
    useEventStore.getState().resetForAccountChange();
    previous.reject(new Error('previous account failed'));
    await request;
    expect(useEventStore.getState()).toMatchObject({ myEventsError: null, error: null, myEventsLoading: false });
  });
});
