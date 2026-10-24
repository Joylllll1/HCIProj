import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEventStore from './eventStore';

const getPublicEventsMock = vi.fn();
const getMyEventsMock = vi.fn();

vi.mock('../services/eventService', () => ({
  getPublicEvents: (...args) => getPublicEventsMock(...args),
  getMyEvents: (...args) => getMyEventsMock(...args),
  getPendingEvents: vi.fn(),
  getApprovedEvents: vi.fn(),
  getRejectedEvents: vi.fn(),
  createEvent: vi.fn(),
  approveEvent: vi.fn(),
  rejectEvent: vi.fn(),
  archiveEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

describe('eventStore list fetch recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEventStore.setState(useEventStore.getInitialState(), true);
  });

  it('retains public events on failure and replaces them after a successful retry', async () => {
    const cachedEvent = { _id: 'event-old', title: '已加载活动' };
    const refreshedEvent = { _id: 'event-new', title: '新活动' };
    useEventStore.setState({ publicEvents: [cachedEvent] });
    getPublicEventsMock.mockRejectedValueOnce(new Error('连接失败')).mockResolvedValueOnce([refreshedEvent]);

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
    getMyEventsMock.mockRejectedValueOnce(new Error('登录服务暂不可用'));

    await useEventStore.getState().fetchMyEvents();

    expect(useEventStore.getState().myEvents).toEqual([cachedApplication]);
    expect(useEventStore.getState().myEventsError).toBe('登录服务暂不可用');
    expect(useEventStore.getState().publicError).toBe('另一列表错误');
    expect(useEventStore.getState().myEventsLoading).toBe(false);
  });
});
