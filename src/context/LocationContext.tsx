import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';
type LocationMode = 'live' | 'manual';

interface AppLocationState {
  coords: { latitude: number; longitude: number } | null;
  placeLabel: string;
  mode: LocationMode;
  updatedAt: number;
  permission: PermissionStatus;
}

interface LocationContextValue extends AppLocationState {
  setMode: (mode: LocationMode) => Promise<void>;
  setManualLocation: (query: string) => Promise<{ coords: { latitude: number; longitude: number }; placeLabel: string }>;
  refreshLocation: () => Promise<{ coords: { latitude: number; longitude: number } | null; placeLabel: string }>;
}

const STORAGE_KEY = 'take-me-out.manual-location';
const MODE_KEY = 'take-me-out.location-mode';

const LocationContext = createContext<LocationContextValue | null>(null);

const toPermission = (status: Location.PermissionStatus): PermissionStatus => {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
};

const usStateFromRegion = (region?: string | null) => {
  if (!region) return '';
  const value = region.trim();
  if (value.length <= 2) return value.toUpperCase();
  return value;
};

const formatPlaceLabel = (place?: Location.LocationGeocodedAddress | null) => {
  if (!place) return '';
  const city = place.city || place.district || place.subregion || '';
  const state = usStateFromRegion(place.region);
  if (city && state) return `${city},${state}`;
  return city || state || place.formattedAddress || '';
};

const loadManualLocation = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { coords: { latitude: number; longitude: number }; placeLabel: string; updatedAt: number };
  if (
    !parsed?.coords ||
    !Number.isFinite(parsed.coords.latitude) ||
    !Number.isFinite(parsed.coords.longitude)
  ) {
    return null;
  }
  return parsed;
};

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppLocationState>({
    coords: null,
    placeLabel: '',
    mode: 'live',
    updatedAt: 0,
    permission: 'undetermined',
  });
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const setCoordsFromLocation = useCallback(async (coords: { latitude: number; longitude: number }) => {
    const reverse = await Location.reverseGeocodeAsync(coords);
    const label = formatPlaceLabel(reverse[0]);
    console.log('[location] live_update', { coords, placeLabel: label });
    setState((prev) => ({
      ...prev,
      coords,
      placeLabel: label || prev.placeLabel,
      updatedAt: Date.now(),
    }));
  }, []);

  const stopWatching = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const startWatching = useCallback(async () => {
    stopWatching();
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15000 },
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCoordsFromLocation(coords).catch(() => undefined);
      },
    );
  }, [setCoordsFromLocation, stopWatching]);

  const refreshLive = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    const permissionState = toPermission(permission.status);
    setState((prev) => ({ ...prev, permission: permissionState }));
    if (permissionState !== 'granted') return { coords: null, placeLabel: '' };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    await setCoordsFromLocation(coords);
    const reverse = await Location.reverseGeocodeAsync(coords);
    return { coords, placeLabel: formatPlaceLabel(reverse[0]) };
  }, [setCoordsFromLocation]);

  const refreshLocation = useCallback(async () => {
    if (state.mode === 'live') {
      return refreshLive();
    }
    if (!state.placeLabel) return { coords: state.coords, placeLabel: state.placeLabel };
    const results = await Location.geocodeAsync(state.placeLabel);
    const first = results[0];
    if (!first) return { coords: state.coords, placeLabel: state.placeLabel };
    const coords = { latitude: first.latitude, longitude: first.longitude };
    console.log('[location] manual_refresh', { placeLabel: state.placeLabel, coords });
    const next = { coords, placeLabel: state.placeLabel, updatedAt: Date.now() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState((prev) => ({ ...prev, ...next }));
    return { coords, placeLabel: state.placeLabel };
  }, [refreshLive, state.mode, state.placeLabel]);

  const setManualLocation = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) throw new Error('Enter a location first.');
    const geocoded = await Location.geocodeAsync(trimmed);
    const first = geocoded[0];
    if (!first) throw new Error('Unable to geocode that manual location.');
    const coords = { latitude: first.latitude, longitude: first.longitude };
    const payload = { coords, placeLabel: trimmed, updatedAt: Date.now() };
    console.log('[location] manual_set', payload);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    await AsyncStorage.setItem(MODE_KEY, 'manual');
    setState((prev) => ({
      ...prev,
      ...payload,
      mode: 'manual',
    }));
    stopWatching();
    return { coords, placeLabel: trimmed };
  }, [stopWatching]);

  const setMode = useCallback(async (mode: LocationMode) => {
    await AsyncStorage.setItem(MODE_KEY, mode);
    if (mode === 'manual') {
      const manual = await loadManualLocation();
      if (manual) {
        setState((prev) => ({ ...prev, ...manual, mode: 'manual' }));
        stopWatching();
        return;
      }
    }
    setState((prev) => ({ ...prev, mode }));
    if (mode === 'live') {
      await refreshLive();
      await startWatching();
    } else {
      stopWatching();
    }
  }, [refreshLive, startWatching, stopWatching]);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const persistedMode = ((await AsyncStorage.getItem(MODE_KEY)) as LocationMode | null) || 'live';
      const manual = await loadManualLocation();
      if (!mounted) return;
      if (persistedMode === 'manual' && manual) {
        setState((prev) => ({ ...prev, ...manual, mode: 'manual' }));
      } else {
        await AsyncStorage.setItem(MODE_KEY, 'live');
        await refreshLive();
        await startWatching();
      }
    };

    boot().catch(() => undefined);
    return () => {
      mounted = false;
      stopWatching();
    };
  }, [refreshLive, startWatching, stopWatching]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      if (state.mode !== 'live') return;
      refreshLive().catch(() => undefined);
    });
    return () => sub.remove();
  }, [refreshLive, state.mode]);

  const value = useMemo<LocationContextValue>(
    () => ({
      ...state,
      setMode,
      setManualLocation,
      refreshLocation,
    }),
    [refreshLocation, setManualLocation, setMode, state],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
};
