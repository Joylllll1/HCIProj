import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from './RegisterPage';
import ForgetPasswordPage from './ForgetPasswordPage';

const { registerMock, sendVerifyCodeMock, checkVerifyCodeMock } = vi.hoisted(() => ({
  registerMock: vi.fn(),
  sendVerifyCodeMock: vi.fn(),
  checkVerifyCodeMock: vi.fn(),
}));

vi.mock('../../store/authStore', () => ({
  default: (selector) => selector({ register: registerMock, loading: false }),
}));

vi.mock('../../services/verifyService', () => ({
  sendVerifyCode: sendVerifyCodeMock,
  checkVerifyCode: checkVerifyCodeMock,
}));

vi.mock('../common/Select', () => ({
  default: ({ value, onChange, options, ...props }) => (
    <select {...props} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

vi.mock('../common/Icon', () => ({ default: () => null }));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setEmailPrefix(value) {
  fireEvent.change(screen.getByLabelText('学校邮箱'), { target: { value } });
}

function setCode(value) {
  fireEvent.change(screen.getByLabelText(/验证码/), { target: { value } });
}

function setPasswordFields() {
  fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'secure123' } });
  fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'secure123' } });
}

describe('verification code email binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerMock.mockResolvedValue({});
    checkVerifyCodeMock.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('prevents a registration code from being used after the email changes', async () => {
    sendVerifyCodeMock.mockResolvedValueOnce({});
    const onNavigate = vi.fn();
    render(<RegisterPage onNavigate={onNavigate} />);

    setEmailPrefix('old.address');
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(await screen.findByRole('status')).toHaveTextContent('old.address@nju.edu.cn');
    setCode('123456');

    setEmailPrefix('new.address');
    expect(screen.getByLabelText(/验证码/)).toHaveValue('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    setCode('123456');
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secure123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'secure123' } });
    fireEvent.click(screen.getByRole('button', { name: '创建账号' }));

    expect(await screen.findByText('请先向当前邮箱获取验证码')).toBeInTheDocument();
    expect(checkVerifyCodeMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('prevents a password-reset code from being used after the email changes', async () => {
    sendVerifyCodeMock.mockResolvedValueOnce({});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ForgetPasswordPage onNavigate={vi.fn()} />);

    setEmailPrefix('old.address');
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(await screen.findByRole('status')).toHaveTextContent('old.address@nju.edu.cn');
    setCode('123456');

    setEmailPrefix('new.address');
    expect(screen.getByLabelText(/验证码/)).toHaveValue('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    setCode('123456');
    setPasswordFields();
    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));

    expect(await screen.findByText('请先向当前邮箱获取验证码')).toBeInTheDocument();
    expect(checkVerifyCodeMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the registration address while sending, recovers after failure, and requests a code for a changed address', async () => {
    const firstRequest = deferred();
    sendVerifyCodeMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    render(<RegisterPage onNavigate={vi.fn()} />);

    setEmailPrefix('first.address');
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(sendVerifyCodeMock).toHaveBeenCalledWith('first.address@nju.edu.cn', 'register');
    expect(screen.getByLabelText('学校邮箱')).toBeDisabled();
    expect(screen.getByLabelText('学校邮箱')).toHaveValue('first.address');
    firstRequest.reject(new Error('邮件暂时无法发送'));

    expect(await screen.findByText('邮件暂时无法发送')).toBeInTheDocument();
    expect(screen.getByLabelText('学校邮箱')).toBeEnabled();
    expect(screen.getByLabelText('学校邮箱')).toHaveValue('first.address');
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(await screen.findByRole('status')).toHaveTextContent('first.address@nju.edu.cn');

    setEmailPrefix('second.address');
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));

    await waitFor(() => expect(sendVerifyCodeMock).toHaveBeenCalledTimes(3));
    expect(sendVerifyCodeMock).toHaveBeenLastCalledWith('second.address@nju.edu.cn', 'register');
    expect(await screen.findByRole('status')).toHaveTextContent('second.address@nju.edu.cn');
  });

  it('keeps the reset address while sending, recovers after failure, and requests a code for a changed address', async () => {
    const firstRequest = deferred();
    sendVerifyCodeMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    render(<ForgetPasswordPage onNavigate={vi.fn()} />);

    setEmailPrefix('first.address');
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(sendVerifyCodeMock).toHaveBeenCalledWith('first.address@nju.edu.cn', 'reset_password');
    expect(screen.getByLabelText('学校邮箱')).toBeDisabled();
    expect(screen.getByLabelText('学校邮箱')).toHaveValue('first.address');
    firstRequest.reject(new Error('邮件暂时无法发送'));

    expect(await screen.findByText('邮件暂时无法发送')).toBeInTheDocument();
    expect(screen.getByLabelText('学校邮箱')).toBeEnabled();
    expect(screen.getByLabelText('学校邮箱')).toHaveValue('first.address');
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(await screen.findByRole('status')).toHaveTextContent('first.address@nju.edu.cn');

    setEmailPrefix('second.address');
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));

    await waitFor(() => expect(sendVerifyCodeMock).toHaveBeenCalledTimes(3));
    expect(sendVerifyCodeMock).toHaveBeenLastCalledWith('second.address@nju.edu.cn', 'reset_password');
    expect(await screen.findByRole('status')).toHaveTextContent('second.address@nju.edu.cn');
  });

  it('blocks registration submission while a resend is pending', async () => {
    vi.useFakeTimers();
    const resend = deferred();
    sendVerifyCodeMock
      .mockResolvedValueOnce({})
      .mockReturnValueOnce(resend.promise);
    render(<RegisterPage onNavigate={vi.fn()} />);

    setEmailPrefix('student');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('student@nju.edu.cn');
    setCode('123456');
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secure123' } });
    fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'secure123' } });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    fireEvent.click(screen.getByRole('button', { name: '重新发送' }));
    expect(screen.getByRole('button', { name: '创建账号' })).toBeDisabled();

    fireEvent.submit(screen.getByLabelText('密码').closest('form'));
    expect(checkVerifyCodeMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();

    await act(async () => {
      resend.resolve({});
      await Promise.resolve();
    });
  });

  it('blocks password reset submission while a resend is pending', async () => {
    vi.useFakeTimers();
    const resend = deferred();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    sendVerifyCodeMock
      .mockResolvedValueOnce({})
      .mockReturnValueOnce(resend.promise);
    render(<ForgetPasswordPage onNavigate={vi.fn()} />);

    setEmailPrefix('student');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('student@nju.edu.cn');
    setCode('123456');
    setPasswordFields();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    fireEvent.click(screen.getByRole('button', { name: '重新发送' }));
    expect(screen.getByRole('button', { name: '重置密码' })).toBeDisabled();

    fireEvent.submit(screen.getByLabelText('新密码').closest('form'));
    expect(checkVerifyCodeMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      resend.resolve({});
      await Promise.resolve();
    });
  });
});
