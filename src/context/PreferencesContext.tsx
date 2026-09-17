import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TimeFormat } from '@/utils/time';

export type ThemeMode = 'light' | 'dark';
export type DistanceUnits = 'miles' | 'km';

interface PreferencesContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (next: TimeFormat) => Promise<void>;
  themeMode: ThemeMode;
  setThemeMode: (next: ThemeMode) => Promise<void>;
  distanceUnits: DistanceUnits;
  setDistanceUnits: (next: DistanceUnits) => Promise<void>;
}

const TIME_FORMAT_KEY = 'take-me-out.time-format';
const THEME_MODE_KEY = 'take-me-out.theme-mode';
const DISTANCE_UNITS_KEY = 'take-me-out.distance-units';

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const normalizeTimeFormat = (value: string | null): TimeFormat => (value === '24h' ? '24h' : '12h');
const normalizeThemeMode = (value: string | null): ThemeMode =>
  value === 'dark' ? 'dark' : 'light';
const normalizeDistanceUnits = (value: string | null): DistanceUnits =>
  value === 'km' ? 'km' : 'miles';

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('12h');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [distanceUnits, setDistanceUnitsState] = useState<DistanceUnits>('miles');

  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(TIME_FORMAT_KEY),
      AsyncStorage.getItem(THEME_MODE_KEY),
      AsyncStorage.getItem(DISTANCE_UNITS_KEY),
    ])
      .then(([storedTimeFormat, storedThemeMode, storedUnits]) => {
        if (!mounted) return;
        setTimeFormatState(normalizeTimeFormat(storedTimeFormat));
        setThemeModeState(normalizeThemeMode(storedThemeMode));
        setDistanceUnitsState(normalizeDistanceUnits(storedUnits));
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

  const setDistanceUnits = useCallback(async (next: DistanceUnits) => {
    setDistanceUnitsState(next);
    await AsyncStorage.setItem(DISTANCE_UNITS_KEY, next);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      timeFormat,
      setTimeFormat,
      themeMode,
      setThemeMode,
      distanceUnits,
      setDistanceUnits,
    }),
    [distanceUnits, setDistanceUnits, setThemeMode, setTimeFormat, themeMode, timeFormat],
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
export const useDistanceUnits = () => usePreferences().distanceUnits;

/** Format a distance in km according to the user's unit preference. */
export const formatDistance = (km: number, units: DistanceUnits) => {
  const value = units === 'miles' ? km * 0.621371 : km;
  return `${value.toFixed(1)} ${units === 'miles' ? 'mi' : 'km'}`;
};
