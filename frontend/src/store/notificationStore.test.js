import { beforeEach, describe, expect, it, vi } from 'vitest';
import useNotificationStore from './notificationStore';
import * as service from '../services/notificationService';

vi.mock('../services/notificationService', () => ({
  fetchNotifications: vi.fn(), fetchUnreadCount: vi.fn(),
  markNotificationAsRead: vi.fn(), markAllNotificationsAsRead: vi.fn(),
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const notification = (id) => ({ _id: id, type: 'comment', title: id, read: false, createdAt: '2026-10-26T00:00:00Z' });

beforeEach(() => {
  vi.resetAllMocks();
  service.fetchNotifications.mockResolvedValue({ notifications: [] });
  service.fetchUnreadCount.mockResolvedValue({ count: 0 });
  useNotificationStore.getState().reset();
});

describe('notification request ownership', () => {
  it('does not restore old notifications or unread counts after logout/reset', async () => {
    const list = deferred(), count = deferred();
    service.fetchNotifications.mockReturnValueOnce(list.promise);
    service.fetchUnreadCount.mockReturnValueOnce(count.promise);
    const pending = useNotificationStore.getState().refresh();
    useNotificationStore.getState().reset();
    list.resolve({ notifications: [notification('old-account')] });
    count.resolve({ count: 9 });
    await pending;
    expect(useNotificationStore.getState()).toMatchObject({ notifications: [], unreadCount: 0, loading: false });
  });

  it('keeps the newest result when two refreshes finish out of order', async () => {
    const list = deferred(), count = deferred();
    service.fetchNotifications.mockReturnValueOnce(list.promise).mockResolvedValueOnce({ notifications: [notification('latest')] });
    service.fetchUnreadCount.mockReturnValueOnce(count.promise).mockResolvedValueOnce({ count: 2 });
    const old = useNotificationStore.getState().refresh();
    await useNotificationStore.getState().refresh();
    list.resolve({ notifications: [notification('stale')] });
    count.resolve({ count: 7 });
    await old;
    expect(useNotificationStore.getState().notifications.map((item) => item._id)).toEqual(['latest']);
    expect(useNotificationStore.getState().unreadCount).toBe(2);
  });

  it('does not undo marking all read with a snapshot requested before that action', async () => {
    const list = deferred(), count = deferred();
    const old = notification('old');
    useNotificationStore.setState({ notifications: [old], unreadCount: 1 });
    service.fetchNotifications.mockReturnValueOnce(list.promise);
    service.fetchNotifications.mockResolvedValueOnce({ notifications: [{ ...old, read: true }] });
    service.fetchUnreadCount.mockReturnValueOnce(count.promise);
    service.markAllNotificationsAsRead.mockResolvedValueOnce({ success: true });
    const pending = useNotificationStore.getState().refresh();
    await useNotificationStore.getState().markAllAsRead();
    list.resolve({ notifications: [old] });
    count.resolve({ count: 1 });
    await pending;
    expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 0, loading: false });
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('does not launch a recovery fetch for an old account after its read request fails', async () => {
    const mark = deferred();
    useNotificationStore.setState({ notifications: [notification('old-account')], unreadCount: 1 });
    service.markNotificationAsRead.mockReturnValueOnce(mark.promise);
    const pending = useNotificationStore.getState().markAsRead('old-account');
    useNotificationStore.getState().reset();
    mark.reject(new Error('old account response'));
    await pending;
    expect(service.fetchNotifications).not.toHaveBeenCalled();
    expect(service.fetchUnreadCount).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it.each(['one', 'all'])('reconciles %s read action when a refresh returns before the write finishes', async (mode) => {
    const mark = deferred();
    const item = notification('pending-read');
    useNotificationStore.setState({ notifications: [item], unreadCount: 1 });
    service.markNotificationAsRead.mockReturnValueOnce(mark.promise);
    service.markAllNotificationsAsRead.mockReturnValueOnce(mark.promise);
    service.fetchNotifications.mockResolvedValueOnce({ notifications: [item] })
      .mockResolvedValueOnce({ notifications: [{ ...item, read: true }] });
    service.fetchUnreadCount.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const marking = mode === 'one'
      ? useNotificationStore.getState().markAsRead(item._id)
      : useNotificationStore.getState().markAllAsRead();
    await useNotificationStore.getState().refresh();
    expect(useNotificationStore.getState().notifications[0].read).toBe(false);
    mark.resolve({ success: true });
    await marking;
    expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 0, loading: false });
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('does not refresh an old account after a successful read write finishes late', async () => {
    const mark = deferred();
    useNotificationStore.setState({ notifications: [notification('old-account')], unreadCount: 1 });
    service.markNotificationAsRead.mockReturnValueOnce(mark.promise);
    const pending = useNotificationStore.getState().markAsRead('old-account');
    useNotificationStore.getState().reset();
    mark.resolve({ success: true });
    await pending;
    expect(service.fetchNotifications).not.toHaveBeenCalled();
    expect(service.fetchUnreadCount).not.toHaveBeenCalled();
  });
});
