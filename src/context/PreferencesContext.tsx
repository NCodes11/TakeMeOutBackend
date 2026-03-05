import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TimeFormat } from '@/utils/time';

interface PreferencesContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (next: TimeFormat) => Promise<void>;
}

const TIME_FORMAT_KEY = 'take-me-out.time-format';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const normalizeTimeFormat = (value: string | null): TimeFormat => (value === '24h' ? '24h' : '12h');

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('12h');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(TIME_FORMAT_KEY)
      .then((stored) => {
        if (!mounted) return;
        setTimeFormatState(normalizeTimeFormat(stored));
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

  const value = useMemo<PreferencesContextValue>(
    () => ({
      timeFormat,
      setTimeFormat,
    }),
    [setTimeFormat, timeFormat],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
};

export const useTimeFormat = () => usePreferences().timeFormat;
