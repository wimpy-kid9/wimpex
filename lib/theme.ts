export const THEME_NAMES = ['gold', 'blue', 'green', 'red', 'pink', 'yellow', 'violet', 'orange', 'black'] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && THEME_NAMES.includes(value as ThemeName);
}

export function applyTheme(themeName: string) {
  if (typeof document === 'undefined' || !isThemeName(themeName)) return;
  document.documentElement.dataset.theme = themeName;
  window.localStorage.setItem('wimpex-theme', themeName);
}

export function getStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'gold';
  const value = window.localStorage.getItem('wimpex-theme');
  return isThemeName(value) ? value : 'gold';
}
