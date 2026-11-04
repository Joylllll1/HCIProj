import { create } from 'zustand';
import { loadJSON, saveJSON } from '../utils';

const saved = loadJSON('nju_display_preferences', {});
const modes = ['system', 'light', 'dark'];
export const usePreferencesStore = create((set) => ({
  theme: modes.includes(saved?.theme) ? saved.theme : 'system',
  setTheme: (theme) => {
    if (!modes.includes(theme)) return;
    set({ theme });
    saveJSON('nju_display_preferences', { theme });
  },
}));

export function initializeTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const mode = usePreferencesStore.getState().theme;
    document.documentElement.classList.add('theme-changing');
    document.documentElement.dataset.theme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('theme-changing')));
  };
  apply();
  const unsubscribe = usePreferencesStore.subscribe(apply);
  media.addEventListener('change', apply);
  return () => { unsubscribe(); media.removeEventListener('change', apply); };
}
