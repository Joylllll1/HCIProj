import Select from '../common/Select';
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
  const [sentEmail, setSentEmail] = React.useState('');
  const [codeLoading, setCodeLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState({});
  const codeRequestLockRef = React.useRef(false);
  const submitLockRef = React.useRef(false);
  const countdownTimerRef = React.useRef(null);

  const email = prefix + domain;
  const emailRef = React.useRef(email);
  emailRef.current = email;

  const clearCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  React.useEffect(() => () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  const handleAddressChange = (nextPrefix, nextDomain) => {
    if (codeRequestLockRef.current || submitLockRef.current) return;
    const nextEmail = nextPrefix + nextDomain;
    emailRef.current = nextEmail;
    if (nextEmail !== email) {
      clearCountdown();
      setSentEmail('');
      setVerifyCode('');
      setCountdown(0);
      setFieldErrors((prev) => ({ ...prev, verifyCode: '' }));
      setError('');
    }
    setPrefix(nextPrefix);
    setDomain(nextDomain);
  };

  const handleSendCode = async () => {
    if (codeRequestLockRef.current || submitLockRef.current || countdown > 0) return;
    if (!prefix || !/^[a-zA-Z0-9._%+-]+$/.test(prefix)) {
      setError('请输入有效的邮箱前缀');
      return;
    }
    const requestedEmail = email;
    codeRequestLockRef.current = true;
    setCodeLoading(true);
    setError('');
    try {
      await sendVerifyCode(requestedEmail, 'reset_password');
      if (emailRef.current !== requestedEmail) return;
      setSentEmail(requestedEmail);
      clearCountdown();
      setCountdown(60);
      let remaining = 60;
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearCountdown();
          setCountdown(0);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      codeRequestLockRef.current = false;
      setCodeLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || codeRequestLockRef.current) return;
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

    if (!sentEmail || sentEmail !== email) {
      setFieldErrors((prev) => ({ ...prev, verifyCode: '请先向当前邮箱获取验证码' }));
      return;
    }

    submitLockRef.current = true;
    setLoading(true);
    try {
      // Verify code first
      await checkVerifyCode(sentEmail, verifyCode, 'reset_password');
      // Then reset password
      const res = await fetch(`${API_BASE}/api/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sentEmail, code: verifyCode, password: newPassword }),
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
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="auth-page">
        <button type="button" className="auth-brand auth-brand-button" onClick={() => onNavigate('home')} aria-label="返回南大树洞首页">
          <span className="auth-brand-mark"><Icon name="park" /></span>
          <span className="auth-brand-text">南大树洞</span>
        </button>
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
      <button type="button" className="auth-brand auth-brand-button" onClick={() => onNavigate('home')} aria-label="返回南大树洞首页">
        <span className="auth-brand-mark"><Icon name="park" /></span>
        <span className="auth-brand-text">南大树洞</span>
      </button>

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
          <div className="auth-general-error" role="alert">
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
                onChange={(e) => handleAddressChange(e.target.value, domain)}
                disabled={loading || codeLoading}
                autoComplete="off"
              />
              <Select aria-label="学校邮箱后缀" className="auth-email-select" value={domain} onChange={(nextDomain) => handleAddressChange(prefix, nextDomain)} disabled={loading || codeLoading} options={DOMAINS.map(d => ({ value: d.value, label: d.label }))} />
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
                disabled={loading || codeLoading}
                autoComplete="off"
              />
              <button
                type="button"
                className={`auth-code-btn ${countdown > 0 ? 'auth-code-btn-disabled' : ''}`}
                onClick={handleSendCode}
                disabled={loading || codeLoading || countdown > 0}
              >
              {codeLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="loop" />
                    <span>发送中</span>
                  </span>
                ) : countdown > 0 ? (
                  `${countdown}s`
                ) : sentEmail ? (
                  '重新发送'
                ) : (
                  '发送验证码'
                )}
              </button>
            </div>
            {sentEmail && <p className="auth-subtitle" role="status">验证码已发送至 {sentEmail}</p>}
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
              disabled={loading || codeLoading}
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
              disabled={loading || codeLoading}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && <p className="auth-error-text">{fieldErrors.confirmPassword}</p>}
          </div>

          <button type="submit" className="auth-submit" disabled={loading || codeLoading}>
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
