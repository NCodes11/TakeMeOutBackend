import { ColorSchemeName } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export type ThemeMode = 'system' | 'light' | 'dark';

export const lightPalette = {
  primary: '#2563eb',
  primaryContainer: '#dbeafe',
  secondary: '#0f766e',
  accent: '#f59e0b',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceVariant: '#f1f5f9',
  text: '#0f172a',
  muted: '#475569',
  border: '#e2e8f0',
  success: '#15803d',
  danger: '#dc2626',
  backdrop: 'rgba(15, 23, 42, 0.45)',
};

export const darkPalette = {
  primary: '#60a5fa',
  primaryContainer: '#1d4ed8',
  secondary: '#2dd4bf',
  accent: '#fbbf24',
  background: '#020617',
  surface: '#0f172a',
  surfaceVariant: '#172033',
  text: '#e2e8f0',
  muted: '#94a3b8',
  border: '#334155',
  success: '#4ade80',
  danger: '#f87171',
  backdrop: 'rgba(2, 6, 23, 0.72)',
};

export const palette = lightPalette;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const createAppTheme = (baseTheme: typeof MD3LightTheme, currentPalette: typeof lightPalette) => ({
  ...baseTheme,
  roundness: 12,
  colors: {
    ...baseTheme.colors,
    primary: currentPalette.primary,
    onPrimary: '#ffffff',
    primaryContainer: currentPalette.primaryContainer,
    onPrimaryContainer: baseTheme.dark ? '#dbeafe' : '#1e3a8a',
    secondary: currentPalette.secondary,
    onSecondary: '#ffffff',
    secondaryContainer: baseTheme.dark ? '#134e4a' : '#ccfbf1',
    onSecondaryContainer: baseTheme.dark ? '#ccfbf1' : '#134e4a',
    background: currentPalette.background,
    surface: currentPalette.surface,
    surfaceVariant: currentPalette.surfaceVariant,
    outline: currentPalette.border,
    outlineVariant: currentPalette.border,
    error: currentPalette.danger,
    onSurface: currentPalette.text,
    onSurfaceVariant: currentPalette.muted,
    backdrop: currentPalette.backdrop,
  },
});

export const lightTheme = createAppTheme(MD3LightTheme, lightPalette);
export const darkTheme = createAppTheme(MD3DarkTheme, darkPalette);
export const appTheme = lightTheme;

export const resolveThemeMode = (themeMode: ThemeMode, systemScheme: ColorSchemeName): Exclude<ThemeMode, 'system'> =>
  themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;

export const resolveAppTheme = (themeMode: ThemeMode, systemScheme: ColorSchemeName) =>
  resolveThemeMode(themeMode, systemScheme) === 'dark' ? darkTheme : lightTheme;
