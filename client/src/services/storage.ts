import type { AuthSession } from '../types';

const AUTH_KEY = 'researchlens-auth';
const THEME_KEY = 'researchlens-theme';

export function readSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(AUTH_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthSession;
    return parsed?.token && parsed?.user?.id ? parsed : null;
  } catch { return null; }
}

export function saveSession(session: AuthSession): void { localStorage.setItem(AUTH_KEY, JSON.stringify(session)); }
export function clearSession(): void { localStorage.removeItem(AUTH_KEY); }
export function readTheme(): 'light' | 'dark' {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}
export function saveTheme(theme: 'light' | 'dark'): void { localStorage.setItem(THEME_KEY, theme); }
