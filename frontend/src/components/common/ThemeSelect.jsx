import React from 'react';
import Select from './Select';
import { usePreferencesStore } from '../../store/preferencesStore';

export default function ThemeSelect() {
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  return <Select className="theme-select" aria-label="显示主题" value={theme} onChange={setTheme} options={[{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]} />;
}
