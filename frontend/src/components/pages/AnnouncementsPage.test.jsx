import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      publicError: null,
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
      myEventsError: null,
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

  it('shows a retry instead of an empty state when public events fail to load', () => {
    useEventStore.setState({
      publicEvents: [],
      publicError: '活动服务暂不可用',
      fetchPublicEvents: vi.fn().mockResolvedValue(undefined),
    });
    const { getByRole, queryByText } = render(<AnnouncementsPage showToast={vi.fn()} />);

    expect(getByRole('alert')).toHaveTextContent('活动服务暂不可用');
    expect(getByRole('button', { name: '重试加载活动' })).toBeInTheDocument();
    expect(queryByText('这个分类暂时没有近期活动。')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: '重试加载活动' }));
    expect(useEventStore.getState().fetchPublicEvents).toHaveBeenCalledTimes(2);
  });

  it('shows retry for failed application loads instead of claiming there are no applications', () => {
    useEventStore.setState({
      myEvents: [],
      myEventsError: '申请记录暂不可用',
      fetchMyEvents: vi.fn().mockResolvedValue(undefined),
    });
    const { getByRole, queryByText } = render(<AnnouncementsPage showToast={vi.fn()} />);

    fireEvent.click(getByRole('button', { name: '我的申请' }));
    expect(getByRole('alert')).toHaveTextContent('申请记录暂不可用');
    expect(getByRole('button', { name: '重试加载申请' })).toBeInTheDocument();
    expect(queryByText('您还没有提交过活动申请')).not.toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: '重试加载申请' }));
    expect(useEventStore.getState().fetchMyEvents).toHaveBeenCalledTimes(2);
  });

  it('keeps the application draft when the dialog is closed and reopened', () => {
    const { getByRole, getByLabelText } = render(<AnnouncementsPage showToast={vi.fn()} />);
    fireEvent.click(getByRole('button', { name: '发布活动' }));
    fireEvent.change(getByLabelText('活动名称'), { target: { value: '学院讲座' } });

    fireEvent.click(getByRole('button', { name: '关闭发布活动' }));
    expect(getByRole('button', { name: '继续编辑申请' })).toBeInTheDocument();
    expect(screen.getByText('活动申请草稿已保留，可继续编辑。')).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: '继续编辑申请' }));
    expect(getByLabelText('活动名称')).toHaveValue('学院讲座');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '发布新活动' })).not.toBeInTheDocument();
    fireEvent.click(getByRole('button', { name: '继续编辑申请' }));
    expect(getByLabelText('活动名称')).toHaveValue('学院讲座');
  });

  it('blocks edits and closing while submitting, then keeps the draft with an inline error on failure', async () => {
    let rejectSubmit;
    const submitPromise = new Promise((_, reject) => { rejectSubmit = reject; });
    const submitEvent = vi.fn(() => submitPromise);
    useEventStore.setState({ submitEvent });
    const { getByRole, getByLabelText } = render(<AnnouncementsPage showToast={vi.fn()} />);
    fireEvent.click(getByRole('button', { name: '发布活动' }));

    fireEvent.change(getByLabelText('活动名称'), { target: { value: '学院讲座' } });
    fireEvent.change(getByLabelText('活动地点'), { target: { value: '仙林校区' } });
    fireEvent.change(getByLabelText('活动时间'), { target: { value: '2027-01-01T12:00' } });
    fireEvent.change(getByLabelText('申请人姓名'), { target: { value: '李同学' } });
    fireEvent.change(getByLabelText('申请人学号'), { target: { value: '123456' } });
    fireEvent.change(getByLabelText('申请人手机号'), { target: { value: '13800000000' } });
    fireEvent.change(getByLabelText('申请人 QQ 号'), { target: { value: '12345' } });
    fireEvent.click(getByRole('button', { name: '提交申请' }));

    expect(submitEvent).toHaveBeenCalledTimes(1);
    // datetime-local is interpreted in the browser's timezone before sending.
    expect(submitEvent.mock.calls[0][0].time).toBe(new Date(2027, 0, 1, 12).toISOString());
    expect(getByRole('button', { name: '正在提交…' })).toBeDisabled();
    expect(getByLabelText('活动名称')).toBeDisabled();
    expect(getByRole('button', { name: '取消' })).toBeDisabled();
    expect(getByRole('button', { name: '关闭发布活动' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getByRole('dialog', { name: '发布新活动' })).toBeInTheDocument();

    rejectSubmit(new Error('网络异常，请重试'));

    await waitFor(() => expect(getByRole('alert')).toHaveTextContent('网络异常，请重试'));
    expect(getByLabelText('活动名称')).toHaveValue('学院讲座');
    expect(getByRole('button', { name: '提交申请' })).toBeEnabled();
  });

  it('reports poster read failures without clearing the rest of the application form', () => {
    vi.stubGlobal('FileReader', class {
      readAsDataURL() {
        this.onerror?.();
      }
    });
    const { container, getByRole, getByLabelText } = render(<AnnouncementsPage showToast={vi.fn()} />);
    fireEvent.click(getByRole('button', { name: '发布活动' }));
    fireEvent.change(getByLabelText('活动名称'), { target: { value: '学院讲座' } });
    const posterInput = container.querySelector('input[type="file"]');
    fireEvent.change(posterInput, { target: { files: [new File(['poster'], 'poster.png', { type: 'image/png' })] } });

    expect(getByRole('alert')).toHaveTextContent('海报读取失败');
    expect(getByLabelText('活动名称')).toHaveValue('学院讲座');
    expect(getByLabelText('活动名称')).toBeEnabled();
  });
});
