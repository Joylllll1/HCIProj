import React from 'react';
import Icon from '../common/Icon';
import { sendVerifyCode, checkVerifyCode } from '../../services/verifyService';

const API_BASE = '';

const DOMAINS = [
  { label: '@nju.edu.cn', value: '@nju.edu.cn' },
  { label: '@smail.nju.edu.cn', value: '@smail.nju.edu.cn' },
];

export default function ForgetPasswordPage({ onNavigate }) {
  const [step, setStep] = React.useState('email'); // email → code → done
  const [prefix, setPrefix] = React.useState('');
  const [domain, setDomain] = React.useState(DOMAINS[0].value);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [countdown, setCountdown] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState({});

  const email = prefix + domain;

  const handleSendCode = async () => {
    if (!prefix || !/^[a-zA-Z0-9._%+-]+$/.test(prefix)) {
      setError('请输入有效的邮箱前缀');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendVerifyCode(email, 'reset_password');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
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
      fe.confirmPassword = '两次密码输入不一致';
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    setLoading(true);
    try {
      // Verify code first
      await checkVerifyCode(email, verifyCode, 'reset_password');
      // Then reset password
      const res = await fetch(`${API_BASE}/api/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verifyCode, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '重置失败');
      setStep('done');
    } catch (err) {
      const msg = err.message || '重置失败，请重试';
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

  if (step === 'done') {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <span className="auth-brand-mark">Ｎ</span>
          <span className="auth-brand-text">NJU 树洞</span>
        </div>
        <div className="auth-card">
          <div className="grid place-items-center py-6">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 grid place-items-center mb-4">
              <Icon name="check" />
            </div>
            <h1 className="auth-title">密码已重置</h1>
            <p className="auth-subtitle mb-6">请使用新密码登录</p>
            <button type="button" className="auth-submit" onClick={() => onNavigate('login')}>
              去登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="auth-brand-mark">Ｎ</span>
        <span className="auth-brand-text">NJU 树洞</span>
      </div>

      <div className="auth-card">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-text-2 hover:text-text mb-4 transition-colors"
          onClick={() => onNavigate('login')}
        >
          <Icon name="arrow_back" />
          返回登录
        </button>

        <h1 className="auth-title">忘记密码</h1>
        <p className="auth-subtitle">通过邮箱验证码重置密码</p>

        {error && (
          <div className="auth-general-error">
            <Icon name="error_outline" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleReset} noValidate>
          {/* Email */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="fp-email">学校邮箱</label>
            <div className={`auth-email-group ${error.includes('邮箱') || error.includes('nju') ? 'auth-input-error' : ''}`}>
              <input
                id="fp-email"
                type="text"
                className="auth-email-input"
                placeholder="学号"
                value={prefix}
                onChange={(e) => { setPrefix(e.target.value); setError(''); }}
                disabled={loading}
                autoComplete="off"
              />
              <select className="auth-email-select" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={loading}>
                {DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Code + Send */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="fp-code">验证码</label>
            <div className="flex gap-2">
              <input
                id="fp-code"
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
                disabled={loading || countdown > 0}
              >
              {loading ? (
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
            <label className="auth-label" htmlFor="fp-password">新密码</label>
            <input
              id="fp-password"
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
            <label className="auth-label" htmlFor="fp-confirm">确认新密码</label>
            <input
              id="fp-confirm"
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
                重置中…
              </span>
            ) : (
              '重置密码'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
