import { afterEach, expect, it, vi } from 'vitest';
import { initializeTheme, usePreferencesStore } from './preferencesStore';
afterEach(() => { vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-theme'); });

it('follows system changes until an explicit preference overrides them', () => {
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  usePreferencesStore.setState({ theme: 'system' });
  const dispose = initializeTheme();
  expect(document.documentElement.dataset.theme).toBe('light');
  media.matches = true;
  media.addEventListener.mock.calls[0][1]();
  expect(document.documentElement.dataset.theme).toBe('dark');
  usePreferencesStore.getState().setTheme('light');
  expect(document.documentElement.dataset.theme).toBe('light');
  media.addEventListener.mock.calls[0][1]();
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(JSON.parse(localStorage.getItem('nju_display_preferences'))).toEqual({ theme: 'light' });
  dispose();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});
