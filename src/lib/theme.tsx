import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ChartThemePalette {
  grid: string;
  axis: string;
  tick: string;
  cursor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipTitle: string;
  tooltipText: string;
  tooltipMuted: string;
  red: string;
  pending: string;
  yellow: string;
  green: string;
}

const CHART_PALETTES: Record<ThemeMode, ChartThemePalette> = {
  light: {
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    tick: '#475569',
    cursor: '#f1f5f9',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipTitle: '#0f2342',
    tooltipText: '#334155',
    tooltipMuted: '#475569',
    red: '#dc2626',
    pending: '#7e22ce',
    yellow: '#d97706',
    green: '#16a34a',
  },
  dark: {
    grid: '#262626',
    axis: '#3a3a40',
    tick: '#b4b4be',
    cursor: '#1a1a1f',
    tooltipBg: '#121212',
    tooltipBorder: '#3a3a40',
    tooltipTitle: '#93c5fd',
    tooltipText: '#e4e4e7',
    tooltipMuted: '#a1a1aa',
    red: '#ef4444',
    pending: '#a855f7',
    yellow: '#f59e0b',
    green: '#22c55e',
  },
};

const STORAGE_KEY = 'mindworx-theme';

function getStoredTheme(): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Ignore storage access restrictions
  }
  return null;
}

function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  chartPalette: ChartThemePalette;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        setThemeState(event.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handleSystemChange);
    return () => mq.removeEventListener('change', handleSystemChange);
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage access restrictions
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      chartPalette: CHART_PALETTES[theme],
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
