import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import AnnouncementsPage from './AnnouncementsPage';
import useAuthStore from '../../store/authStore';
import useEventStore from '../../store/eventStore';
import useUiStore from '../../store/uiStore';

vi.mock('../common/Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

describe('AnnouncementsPage multiline content rendering', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    useAuthStore.setState(useAuthStore.getInitialState(), true);
    useEventStore.setState(useEventStore.getInitialState(), true);
    useUiStore.setState(useUiStore.getInitialState(), true);

    useAuthStore.setState({
      isAuthenticated: true,
    });

    useUiStore.setState({
      query: '',
    });

    useEventStore.setState({
      publicEvents: [],
      myEvents: [
        {
          _id: 'event-1',
          title: '活动标题',
          type: '学术讲座',
          time: '2026-06-08T12:00:00.000Z',
          place: '仙林校区',
          description: 'description line 1\ndescription line 2',
          status: 'rejected',
          rejectionReason: 'reason line 1\nreason line 2',
        },
      ],
      publicLoading: false,
      myEventsLoading: false,
      fetchPublicEvents: vi.fn().mockResolvedValue(undefined),
      fetchMyEvents: vi.fn().mockResolvedValue(undefined),
      submitEvent: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('preserves line breaks in application detail description and rejection reason', () => {
    const { container, getByRole } = render(<AnnouncementsPage showToast={vi.fn()} />);

    fireEvent.click(getByRole('button', { name: '我的申请' }));
    fireEvent.click(getByRole('button', { name: '查看' }));

    const multilineNodes = Array.from(container.querySelectorAll('.whitespace-pre-wrap'));
    expect(multilineNodes.some((node) => node.textContent?.includes('description line 1\ndescription line 2'))).toBe(true);
    expect(multilineNodes.some((node) => node.textContent?.includes('reason line 1\nreason line 2'))).toBe(true);
  });
});
