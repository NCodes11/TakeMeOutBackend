import { MD3LightTheme } from 'react-native-paper';

export const palette = {
  primary: '#2563eb',
  primaryContainer: '#dbeafe',
  secondary: '#0f766e',
  accent: '#f59e0b',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#475569',
  border: '#e2e8f0',
  success: '#15803d',
  danger: '#dc2626',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const appTheme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    onPrimary: '#ffffff',
    primaryContainer: palette.primaryContainer,
    onPrimaryContainer: '#1e3a8a',
    secondary: palette.secondary,
    onSecondary: '#ffffff',
    secondaryContainer: '#ccfbf1',
    onSecondaryContainer: '#134e4a',
    background: palette.background,
    surface: palette.surface,
    surfaceVariant: '#f1f5f9',
    outline: palette.border,
    error: palette.danger,
    onSurface: palette.text,
    onSurfaceVariant: palette.muted,
  },
};
