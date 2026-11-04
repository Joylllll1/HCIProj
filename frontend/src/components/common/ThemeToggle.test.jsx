import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';
import { usePreferencesStore } from '../../store/preferencesStore';

let media;
let change;
beforeEach(() => {
  media = { matches: false, addEventListener: vi.fn((_, listener) => { change = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  usePreferencesStore.setState({ theme: 'light' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('toggles between light and dark and persists the explicit choice', () => {
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole('button', { name: '切换到深色模式' }));
  expect(usePreferencesStore.getState().theme).toBe('dark');
  expect(JSON.parse(localStorage.getItem('nju_display_preferences'))).toEqual({ theme: 'dark' });
  fireEvent.click(screen.getByRole('button', { name: '切换到浅色模式' }));
  expect(usePreferencesStore.getState().theme).toBe('light');
});

it('reflects the actual system appearance before the user overrides it', () => {
  usePreferencesStore.setState({ theme: 'system' });
  media.matches = true;
  render(<ThemeToggle />);
  expect(screen.getByRole('button', { name: '切换到浅色模式' })).toBeInTheDocument();
  act(() => { media.matches = false; change(); });
  expect(screen.getByRole('button', { name: '切换到深色模式' })).toBeInTheDocument();
  expect(usePreferencesStore.getState().theme).toBe('system');
  fireEvent.click(screen.getByRole('button', { name: '切换到深色模式' }));
  expect(usePreferencesStore.getState().theme).toBe('dark');
});
