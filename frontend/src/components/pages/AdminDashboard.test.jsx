import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import useAdminStore from '../../store/adminStore';
import useEventStore from '../../store/eventStore';
import useUiStore from '../../store/uiStore';

vi.mock('../common/Icon', () => ({
  default: () => <span data-testid="icon" />,
}));

vi.mock('../layout/AdminSidebar', () => ({
  default: () => <div data-testid="admin-sidebar" />,
}));

vi.mock('../layout/AdminMobileNav', () => ({
  default: () => <div data-testid="admin-mobile-nav" />,
}));

vi.mock('../layout/AdminTopBar', () => ({
  default: () => <div data-testid="admin-topbar" />,
}));

vi.mock('../common/EventModals', () => ({
  EventDetailModal: () => null,
  RejectionModal: () => null,
}));

describe('AdminDashboard multiline content rendering', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    useUiStore.setState(useUiStore.getInitialState(), true);
    useAdminStore.setState(useAdminStore.getInitialState(), true);
    useEventStore.setState(useEventStore.getInitialState(), true);

    useUiStore.setState({
      activePage: 'admin-reports',
      navigate: vi.fn(),
      showToast: vi.fn(),
    });

    useAdminStore.setState({
      reports: [
        {
          _id: 'report-1',
          targetId: 'comment-1',
          targetType: 'comment',
          targetContent: 'first line\nsecond line',
          reportCount: 1,
          reasons: [{ reason: '辱骂/攻击' }],
          createdAt: '2026-06-07T00:00:00.000Z',
          postId: {
            _id: 'post-1',
            title: '所属帖子',
          },
        },
      ],
      reportsLoading: false,
      bans: [
        {
          _id: 'ban-1',
          userId: { email: 'banned@nju.edu.cn' },
          reason: 'line 1\nline 2',
          days: 7,
          remainingDays: 3,
          isActive: true,
          isExpired: false,
          createdAt: '2026-06-07T00:00:00.000Z',
        },
      ],
      bansLoading: false,
      traceResult: null,
      auditLogs: [],
      auditLogsLoading: false,
      fetchReports: vi.fn().mockResolvedValue(undefined),
      dismissReport: vi.fn().mockResolvedValue(undefined),
      deletePost: vi.fn().mockResolvedValue(undefined),
      deleteComment: vi.fn().mockResolvedValue(undefined),
      fetchBans: vi.fn().mockResolvedValue(undefined),
      banUser: vi.fn().mockResolvedValue(undefined),
      unbanUser: vi.fn().mockResolvedValue(undefined),
      tracePost: vi.fn().mockResolvedValue(undefined),
      clearTraceResult: vi.fn(),
      fetchAuditLogs: vi.fn().mockResolvedValue(undefined),
    });

    useEventStore.setState({
      pendingEvents: [],
      approvedEvents: [],
      rejectedEvents: [],
      pendingLoading: false,
      approvedLoading: false,
      rejectedLoading: false,
      fetchAllEvents: vi.fn().mockResolvedValue(undefined),
      approveEvent: vi.fn().mockResolvedValue(undefined),
      rejectEvent: vi.fn().mockResolvedValue(undefined),
      archiveEvent: vi.fn().mockResolvedValue(undefined),
      deleteEvent: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('preserves line breaks in report detail modal content', () => {
    const { container, getByRole } = render(<AdminDashboard />);

    fireEvent.click(getByRole('button', { name: '查看详情' }));

    const multilineNodes = Array.from(container.querySelectorAll('.whitespace-pre-wrap'));
    expect(multilineNodes.some((node) => node.textContent?.includes('first line\nsecond line'))).toBe(true);
  });

  it('preserves line breaks in ban reasons', () => {
    useUiStore.setState({
      activePage: 'admin-bans',
      navigate: vi.fn(),
      showToast: vi.fn(),
    });

    const { container } = render(<AdminDashboard />);

    const multilineNodes = Array.from(container.querySelectorAll('.whitespace-pre-wrap'));
    expect(multilineNodes.some((node) => node.textContent?.includes('line 1\nline 2'))).toBe(true);
  });
});
