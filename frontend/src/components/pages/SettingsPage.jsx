import React, { useState, useCallback, useEffect, useRef } from 'react';
import Icon from '../common/Icon';
import PageHeader from '../common/PageHeader';
import ThemeSelect from '../common/ThemeSelect';
import useAuthStore from '../../store/authStore';
import * as authService from '../../services/authService';
import useUiStore from '../../store/uiStore';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function getNotificationPreferences(user) {
  return {
    reply: user?.notificationPreferences?.reply ?? true,
    like: user?.notificationPreferences?.like ?? true,
    announcement: user?.notificationPreferences?.announcement ?? true,
    reportResult: user?.notificationPreferences?.reportResult ?? true,
  };
}

function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useUiStore((s) => s.showToast);
  const navigate = useUiStore((s) => s.navigate);
  const unsavedChangesHandler = useUiStore((s) => s.unsavedChangesHandler);
  const requestNavigationConfirmation = useUiStore((s) => s.requestNavigationConfirmation);
  const [prefs, setPrefs] = useState(() => getNotificationPreferences(user));
  const [savingKey, setSavingKey] = useState(null);
  const prefsRef = useRef(prefs);
  const savingRef = useRef(false);

  useEffect(() => {
    const nextPrefs = getNotificationPreferences(user);
    prefsRef.current = nextPrefs;
    setPrefs(nextPrefs);
  }, [user]);

  const toggle = useCallback(async (key) => {
    if (savingRef.current) return;

    const prev = prefsRef.current;
    const next = { ...prev, [key]: !prev[key] };
    prefsRef.current = next;
    setPrefs(next);
    savingRef.current = true;
    setSavingKey(key);

    try {
      const data = await authService.updateProfile({ notificationPreferences: next });
      const savedPrefs = getNotificationPreferences(data.user);
      prefsRef.current = savedPrefs;
      setPrefs(savedPrefs);
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, ...data.user } : data.user,
      }));
    } catch {
      prefsRef.current = prev;
      setPrefs(prev);
      showToast('更新失败，请重试');
    } finally {
      savingRef.current = false;
      setSavingKey(null);
    }
  }, [showToast]);

  const handleLogout = () => {
    if (!unsavedChangesHandler) {
      Promise.resolve(logout()).finally(() => {
        navigate('home', undefined, { force: true });
      });
      return;
    }

    requestNavigationConfirmation({
      pendingNavigation: {
        mode: 'discard',
        action: async () => {
          await logout();
          navigate('home', undefined, { force: true });
        },
      },
      dialog: {
        title: '退出登录？',
        description: '当前内容还没有保存。退出后本次修改会丢失，你需要重新登录才能继续编辑。',
        confirmText: '退出登录',
        cancelText: '继续编辑',
        mode: 'discard',
      },
    });
  };

  return (
    <div className="settings-page max-w-[960px] mx-auto">
      <PageHeader title="个人设置" description="管理显示、通知和账号。" />
      <div className="settings-grid grid gap-[18px]">
        <section className="settings-card display-settings p-5"><h2 className="text-base font-semibold mb-3">显示偏好</h2><div className="flex items-center justify-between gap-4"><span>界面主题</span><ThemeSelect /></div><p className="text-xs text-text-3 mt-2">跟随系统会自动适应设备的深浅色设置。</p></section>
        {/* 账号信息 */}
        <section className="settings-card overflow-hidden rounded-md border border-line-soft bg-surface shadow-sm">
          <div className="settings-card-head flex items-center gap-[14px] px-5 py-[18px] border-b border-line-soft bg-surface-soft">
            <Icon name="person" />
            <div><strong className="block text-base tracking-tight">账号信息</strong><p className="mt-[3px] mb-0 text-text-3 text-[13px]">你的校园邮箱与身份验证状态。</p></div>
          </div>
          <div className="settings-rows grid">
            <div className="settings-row flex items-center justify-between gap-4 px-5 py-[14px] border-b border-line-soft text-sm last:border-0"><span className="text-text-2">校园邮箱</span><strong className="text-sm font-semibold">{user?.email || '—'}</strong></div>
            <div className="settings-row flex items-center justify-between gap-4 px-5 py-[14px] border-b border-line-soft text-sm last:border-0"><span className="text-text-2">验证状态</span><span className="pill green inline-flex items-center gap-[5px] w-fit rounded-full px-3 py-2 text-xs font-semibold text-white bg-green">已验证</span></div>
            <div className="settings-row flex items-center justify-between gap-4 px-5 py-[14px] text-sm"><span className="text-text-2">注册时间</span><strong className="text-sm font-semibold">{formatDate(user?.createdAt)}</strong></div>
          </div>
        </section>

        {/* 通知偏好 */}
        <section className="settings-card overflow-hidden rounded-md border border-line-soft bg-surface shadow-sm">
          <div className="settings-card-head flex items-center gap-[14px] px-5 py-[18px] border-b border-line-soft bg-surface-soft">
            <Icon name="notifications" />
            <div><strong className="block text-base tracking-tight">通知偏好</strong><p className="mt-[3px] mb-0 text-text-3 text-[13px]">选择你希望接收的通知类型。</p></div>
          </div>
          <div className="settings-rows grid">
            {[
              ['评论回复', 'reply'],
              ['点赞通知', 'like'],
              ['系统公告', 'announcement'],
              ['投诉处理结果', 'reportResult'],
            ].map(([label, key]) => (
              <div className="settings-row toggle-row flex items-center justify-between gap-4 px-5 py-3 border-b border-line-soft text-sm last:border-0" key={key}>
                <span className="text-text-2">{label}</span>
                <label className="toggle relative inline-block w-[44px] h-[26px] flex-shrink-0">
                  <input className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0" type="checkbox" aria-label={label} checked={prefs[key]} onChange={() => toggle(key)} disabled={savingKey !== null} />
                  <span className={`toggle-slider absolute inset-0 rounded-full transition-colors duration-200 ${savingKey !== null ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${prefs[key] ? 'bg-blue' : 'bg-[#d1d5db]'}`}>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* 隐私与安全 */}
        <section className="settings-card overflow-hidden rounded-md border border-line-soft bg-surface shadow-sm">
          <div className="settings-card-head flex items-center gap-[14px] px-5 py-[18px] border-b border-line-soft bg-surface-soft">
            <Icon name="shield_person" />
            <div><strong className="block text-base tracking-tight">隐私与安全</strong><p className="mt-[3px] mb-0 text-text-3 text-[13px]">管理密码与安全设置。</p></div>
          </div>
          <div className="settings-rows grid">
            <div className="settings-row flex items-center justify-between gap-4 px-5 py-[14px] text-sm">
              <span className="text-text-2">修改密码</span>
              <button className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-[14px] py-[7px] bg-surface text-text-2 text-[13px] font-semibold transition-all duration-150" type="button" onClick={() => navigate('settings-password')}>修改</button>
            </div>
          </div>
        </section>

        {/* 账号操作统一位于设置页底部。 */}
        <section className="settings-card settings-session-actions overflow-hidden rounded-md border border-line bg-surface">
          <button
            className="settings-logout"
            onClick={handleLogout}
            type="button"
          >
            <Icon name="logout" />
            <span>退出登录</span>
          </button>
        </section>
      </div>
    </div>
  );
}

export default SettingsPage;
