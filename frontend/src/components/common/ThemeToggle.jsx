import React, { useSyncExternalStore } from 'react';
import Icon from './Icon';
import { usePreferencesStore } from '../../store/preferencesStore';

const subscribeToSystemTheme = (listener) => {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', listener);
  return () => media?.removeEventListener('change', listener);
};
const systemIsDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export default function ThemeToggle() {
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemIsDark, () => false);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const label = dark ? '切换到浅色模式' : '切换到深色模式';
  return (
    <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      <Icon name={dark ? 'moon' : 'sun'} size={17} />
    </button>
  );
}
