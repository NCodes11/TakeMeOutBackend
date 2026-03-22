import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeMode } from '@/theme/appTheme';
import { TimeFormat } from '@/utils/time';

interface PreferencesContextValue {
  timeFormat: TimeFormat;
  themeMode: ThemeMode;
  setTimeFormat: (next: TimeFormat) => Promise<void>;
  setThemeMode: (next: ThemeMode) => Promise<void>;
}

const TIME_FORMAT_KEY = 'take-me-out.time-format';
const THEME_MODE_KEY = 'take-me-out.theme-mode';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const normalizeTimeFormat = (value: string | null): TimeFormat => (value === '24h' ? '24h' : '12h');
const normalizeThemeMode = (value: string | null): ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system' ? value : 'system';

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('12h');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(TIME_FORMAT_KEY), AsyncStorage.getItem(THEME_MODE_KEY)])
      .then(([storedTimeFormat, storedThemeMode]) => {
        if (!mounted) return;
        setTimeFormatState(normalizeTimeFormat(storedTimeFormat));
        setThemeModeState(normalizeThemeMode(storedThemeMode));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const setTimeFormat = useCallback(async (next: TimeFormat) => {
    setTimeFormatState(next);
    await AsyncStorage.setItem(TIME_FORMAT_KEY, next);
  }, []);

  const setThemeMode = useCallback(async (next: ThemeMode) => {
    setThemeModeState(next);
    await AsyncStorage.setItem(THEME_MODE_KEY, next);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      timeFormat,
      themeMode,
      setTimeFormat,
      setThemeMode,
    }),
    [setThemeMode, setTimeFormat, themeMode, timeFormat],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
};

export const useTimeFormat = () => usePreferences().timeFormat;
export const useThemeMode = () => usePreferences().themeMode;
