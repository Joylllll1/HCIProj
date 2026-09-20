import React from 'react';
import useAuthStore from '../../store/authStore';
import Icon from '../common/Icon';
import { sendVerifyCode, checkVerifyCode } from '../../services/verifyService';

const DOMAINS = [
  { label: '@nju.edu.cn', value: '@nju.edu.cn' },
  { label: '@smail.nju.edu.cn', value: '@smail.nju.edu.cn' },
];

// ─── Stable store selectors ───
const selectRegister = (s) => s.register;
const selectLoading = (s) => s.loading;

export default function RegisterPage({ onNavigate }) {
  const register = useAuthStore(selectRegister);
  const loading = useAuthStore(selectLoading);

  const [prefix, setPrefix] = React.useState('');
  const [domain, setDomain] = React.useState(DOMAINS[0].value);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [verifyCode, setVerifyCode] = React.useState('');
  const [codeSent, setCodeSent] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [errors, setErrors] = React.useState({});
  const [generalError, setGeneralError] = React.useState('');
  const [codeLoading, setCodeLoading] = React.useState(false);

  const validate = () => {
    const e = {};
    if (!prefix || !/^[a-zA-Z0-9._%+-]+$/.test(prefix)) {
      e.email = '请输入有效的邮箱前缀';
    }
    if (!verifyCode || verifyCode.length !== 6) {
      e.verifyCode = '请输入 6 位验证码';
    }
    if (!password || password.length < 8) {
      e.password = '密码至少 8 位';
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      e.password = '密码需包含字母和数字';
    }
    if (password !== confirmPassword) {
      e.confirmPassword = '两次密码输入不一致';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSendCode = async () => {
    if (!prefix || !/^[a-zA-Z0-9._%+-]+$/.test(prefix)) {
      setErrors((prev) => ({ ...prev, email: '请输入有效的邮箱前缀' }));
      return;
    }
    setGeneralError('');
    setCodeLoading(true);
    try {
      await sendVerifyCode(prefix + domain, 'register');
      setCodeSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setErrors((prev) => ({ ...prev, email: err.message }));
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    if (!validate()) return;
    try {
      // Verify code then register
      await checkVerifyCode(prefix + domain, verifyCode, 'register');
      await register(prefix + domain, password);
      onNavigate('home');
    } catch (err) {
      const msg = err.message || '注册失败，请重试';
      if (msg.includes('验证码')) {
        setErrors((prev) => ({ ...prev, verifyCode: msg }));
      } else if (msg.includes('邮箱')) {
        setErrors((prev) => ({ ...prev, email: msg }));
      } else if (msg.includes('密码')) {
        setErrors((prev) => ({ ...prev, password: msg }));
      } else {
        setGeneralError(msg);
      }
    }
  };

  return (
    <div className="auth-page">
      {/* Brand */}
      <div className="auth-brand">
        <span className="auth-brand-mark">Ｎ</span>
        <span className="auth-brand-text">NJU 树洞</span>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">创建账号</h1>
        <p className="auth-subtitle">使用 NJU 邮箱注册，加入树洞</p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">学校邮箱</label>
            <div className={`auth-email-group ${errors.email ? 'auth-input-error' : ''}`}>
              <input
                id="reg-email"
                type="text"
                className="auth-email-input"
                placeholder="学号"
                value={prefix}
                onChange={(e) => { setPrefix(e.target.value); setErrors((prev) => ({ ...prev, email: '' })); }}
                autoComplete="off"
                disabled={loading}
              />
              <select className="auth-email-select" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={loading}>
                {DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            {errors.email && <p className="auth-error-text">{errors.email}</p>}
          </div>

          {/* Verification Code */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-code">邮箱验证码</label>
            <div className="flex gap-2">
              <input
                id="reg-code"
                type="text"
                className={`auth-input flex-1 ${errors.verifyCode ? 'auth-input-error' : ''}`}
                placeholder="6 位验证码"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors((prev) => ({ ...prev, verifyCode: '' })); }}
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="button"
                className={`auth-code-btn ${countdown > 0 ? 'auth-code-btn-disabled' : ''}`}
                onClick={handleSendCode}
                disabled={codeLoading || countdown > 0}
              >
                {codeLoading ? (
                <span className="flex items-center gap-1.5">
                  <Icon name="loop" />
                  <span>发送中</span>
                </span>
              ) : countdown > 0 ? (
                  `${countdown}s`
                ) : codeSent ? (
                  '重新发送'
                ) : (
                  '发送验证码'
                )}
              </button>
            </div>
            {errors.verifyCode && <p className="auth-error-text">{errors.verifyCode}</p>}
          </div>

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-password">密码</label>
            <input
              id="reg-password"
              type="password"
              className={`auth-input ${errors.password ? 'auth-input-error' : ''}`}
              placeholder="至少 8 位，包含字母和数字"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '' })); }}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.password && <p className="auth-error-text">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-confirm">确认密码</label>
            <input
              id="reg-confirm"
              type="password"
              className={`auth-input ${errors.confirmPassword ? 'auth-input-error' : ''}`}
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => ({ ...prev, confirmPassword: '' })); }}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.confirmPassword && <p className="auth-error-text">{errors.confirmPassword}</p>}
          </div>

          {/* General error */}
          {generalError && (
            <div className="auth-general-error">
              <Icon name="error_outline" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-spinner">
                <Icon name="loop" />
                创建中…
              </span>
            ) : (
              '创建账号'
            )}
          </button>
        </form>

        <p className="auth-switch">
          已有账号？
          <button
            type="button"
            className="auth-switch-link"
            onClick={() => onNavigate('login')}
          >
            登录
          </button>
        </p>
      </div>
    </div>
  );
}
