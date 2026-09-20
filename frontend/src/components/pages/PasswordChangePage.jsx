import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import { sendVerifyCode, checkVerifyCode } from '../../services/verifyService';
import * as authService from '../../services/authService';

export default function PasswordChangePage() {
  const user = useAuthStore((s) => s.user);
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useUiStore((s) => s.navigate);

  const [verifyCode, setVerifyCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!user?.email) return;
    setSending(true);
    setError('');
    try {
      await sendVerifyCode(user.email, 'change_password');
      setCountdown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const fe = {};
    if (!verifyCode) fe.verifyCode = '请输入验证码';
    if (!newPassword || newPassword.length < 8) {
      fe.password = '密码至少 8 位';
    } else if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      fe.password = '密码需包含字母和数字';
    }
    if (newPassword !== confirmPassword) {
      fe.confirmPassword = '两次密码不一致';
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    setLoading(true);
    try {
      await checkVerifyCode(user.email, verifyCode, 'change_password');
      await authService.changePassword({ code: verifyCode, newPassword });
      showToast('密码已更新');
      navigate('settings');
    } catch (err) {
      const msg = err.data?.error || err.message || '修改失败，请重试';
      if (msg.includes('验证码') || msg.includes('code')) {
        setFieldErrors((prev) => ({ ...prev, verifyCode: msg }));
      } else if (msg.includes('密码') || msg.includes('password')) {
        setFieldErrors((prev) => ({ ...prev, password: msg }));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page max-w-[960px] mx-auto">
      <section className="section-head large flex items-center justify-between gap-[18px]">
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-text-2 hover:text-text mb-4 transition-colors"
            onClick={() => navigate('settings')}
          >
            <Icon name="arrow_back" />
            返回设置
          </button>
          <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">修改密码</h1>
          <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">通过邮箱验证码确认身份后修改密码。</p>
        </div>
      </section>

      <div className="settings-card overflow-hidden rounded-md border border-line-soft bg-surface shadow-sm max-w-[480px]">
        <div className="p-6">
          {error && (
            <div className="auth-general-error">
              <Icon name="error_outline" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Code + Send */}
            <div className="auth-field">
              <label className="auth-label">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`auth-input flex-1 ${fieldErrors.verifyCode ? 'auth-input-error' : ''}`}
                  placeholder="6 位验证码"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setFieldErrors((prev) => ({ ...prev, verifyCode: '' })); }}
                  disabled={loading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={`auth-code-btn ${countdown > 0 ? 'auth-code-btn-disabled' : ''}`}
                  onClick={handleSendCode}
                  disabled={sending || countdown > 0}
                >
                  {sending ? (
                    <span className="flex items-center gap-1.5">
                      <Icon name="loop" />
                      <span>发送中</span>
                    </span>
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : (
                    '发送验证码'
                  )}
                </button>
              </div>
              {fieldErrors.verifyCode && <p className="auth-error-text">{fieldErrors.verifyCode}</p>}
            </div>

            {/* New Password */}
            <div className="auth-field">
              <label className="auth-label">新密码</label>
              <input
                type="password"
                className={`auth-input ${fieldErrors.password ? 'auth-input-error' : ''}`}
                placeholder="至少 8 位，包含字母和数字"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: '' })); }}
                disabled={loading}
                autoComplete="new-password"
              />
              {fieldErrors.password && <p className="auth-error-text">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="auth-field">
              <label className="auth-label">确认新密码</label>
              <input
                type="password"
                className={`auth-input ${fieldErrors.confirmPassword ? 'auth-input-error' : ''}`}
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, confirmPassword: '' })); }}
                disabled={loading}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && <p className="auth-error-text">{fieldErrors.confirmPassword}</p>}
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner">
                  <Icon name="loop" />
                  修改中…
                </span>
              ) : (
                '保存修改'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
