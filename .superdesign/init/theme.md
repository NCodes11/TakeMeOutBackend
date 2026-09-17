# Theme

## Compact token summary

- Framework: React Native Paper Material 3 theme, selected from the saved `themeMode` preference.
- Current light palette: primary `#6D28D9`, secondary `#7C3AED`, accent `#8B5CF6`, background `#F8F7FC`, surface `#FFFFFF`, alternate surface `#F0EDF8`, text `#15181D`, muted `#6C6678`, border `#DED8EA`.
- Current dark palette: primary `#7DD3FC`, secondary `#A78BFA`, accent `#C4B5FD`, background `#070B1F`, surface `#10162D`, alternate surface `#171E3A`, text `#F7F8FF`, muted `#B9C1E3`, border `#2B355F`.
- Typography: system body typography via React Native Paper; `JosefinSans_700Bold` is loaded globally and used for branded home-page display text.
- Spacing scale: `xs=6`, `sm=10`, `md=16`, `lg=24`, `xl=32`, `xxl=40`.
- Component radius: Paper `roundness=8`; existing UI components use 8–12 px radii.
- Shadows: light `rgba(21, 24, 29, 0.12)` and dark `rgba(0, 0, 0, 0.52)` with iOS shadow plus Android elevation.
- Responsive layout: no global breakpoints; `AppScreen` caps regular content at 760 px and home implements local width-responsive behavior.

## Raw source: `src/theme/appTheme.ts`

```ts
import { useTheme, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightPalette = {
  primary: '#6D28D9',
  primaryContainer: '#EDE9FE',

  secondary: '#7C3AED',
  secondaryContainer: '#F3E8FF',

  accent: '#8B5CF6',
  accentContainer: '#F5F3FF',

  background: '#F8F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EDF8',

  text: '#15181D',
  muted: '#6C6678',
  border: '#DED8EA',

  success: '#16815F',
  danger: '#C93D3D',

  white: '#FFFFFF',
  black: '#000000',

  buttonBlue: '#6D28D9',
  buttonBlueDark: '#4C1D95',

  lavender: '#6D28D9',
  lavenderDark: '#4C1D95',
  lavenderSoft: '#EDE9FE',
  lavenderSoftAlt: '#F5F3FF',
  lavenderBorder: '#C4B5FD',
  lavenderText: '#3B0764',

  selected: '#6D28D9',
  selectedSoft: '#EDE9FE',
  selectedText: '#3B0764',

  chip: '#FFFFFF',
  chipSelected: '#EDE9FE',
  chipSelectedText: '#4C1D95',

  inputBackground: '#FFFFFF',
  inputBorder: '#D8D1E6',
};

export const darkPalette = {
  primary: '#7DD3FC',
  primaryContainer: '#14385C',

  secondary: '#A78BFA',
  secondaryContainer: '#2B2149',

  accent: '#C4B5FD',
  accentContainer: '#2A2450',

  background: '#070B1F',
  surface: '#10162D',
  surfaceAlt: '#171E3A',

  text: '#F7F8FF',
  muted: '#B9C1E3',
  border: '#2B355F',

  success: '#86DFC4',
  danger: '#FF8A8A',

  white: '#FFFFFF',
  black: '#000000',

  buttonBlue: '#7DD3FC',
  buttonBlueDark: '#38BDF8',

  lavender: '#C4B5FD',
  lavenderDark: '#A78BFA',
  lavenderSoft: '#1A2550',
  lavenderSoftAlt: '#212A5A',
  lavenderBorder: '#4A5C95',
  lavenderText: '#F4F0FF',

  selected: '#7DD3FC',
  selectedSoft: '#14385C',
  selectedText: '#EAF8FF',

  chip: '#10162D',
  chipSelected: '#14385C',
  chipSelectedText: '#EAF8FF',

  inputBackground: '#10162D',
  inputBorder: '#374575',
};

export type AppPalette = typeof lightPalette;

export const getAppPalette = (isDark: boolean): AppPalette => {
  return isDark ? darkPalette : lightPalette;
};

export const useAppPalette = (): AppPalette => {
  const theme = useTheme();
  return getAppPalette(Boolean(theme.dark));
};

export const palette = lightPalette;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const lightTheme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 8,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightPalette.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: lightPalette.primaryContainer,
    onPrimaryContainer: lightPalette.selectedText,
    secondary: lightPalette.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: lightPalette.secondaryContainer,
    onSecondaryContainer: lightPalette.selectedText,
    tertiary: lightPalette.accent,
    onTertiary: '#FFFFFF',
    tertiaryContainer: lightPalette.accentContainer,
    onTertiaryContainer: lightPalette.selectedText,
    background: lightPalette.background,
    onBackground: lightPalette.text,
    surface: lightPalette.surface,
    onSurface: lightPalette.text,
    surfaceVariant: lightPalette.surfaceAlt,
    onSurfaceVariant: lightPalette.muted,
    outline: lightPalette.border,
    outlineVariant: lightPalette.lavenderBorder,
    error: lightPalette.danger,
    onError: '#FFFFFF',
    errorContainer: '#FFE8E8',
    onErrorContainer: '#7F1D1D',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FBFAFF',
      level3: '#F6F3FC',
      level4: '#F0ECF8',
      level5: '#E8E1F2',
    },
    shadow: 'rgba(21, 24, 29, 0.12)',
    scrim: 'rgba(21, 24, 29, 0.30)',
    inverseSurface: '#241A3D',
    inverseOnSurface: '#FFFFFF',
    inversePrimary: '#DDD6FE',
    backdrop: 'rgba(21, 24, 29, 0.36)',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  dark: true,
  roundness: 8,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkPalette.primary,
    onPrimary: '#071124',
    primaryContainer: darkPalette.primaryContainer,
    onPrimaryContainer: darkPalette.selectedText,
    secondary: darkPalette.secondary,
    onSecondary: '#121027',
    secondaryContainer: darkPalette.secondaryContainer,
    onSecondaryContainer: '#F4F0FF',
    tertiary: darkPalette.accent,
    onTertiary: '#121027',
    tertiaryContainer: darkPalette.accentContainer,
    onTertiaryContainer: '#F4F0FF',
    background: darkPalette.background,
    onBackground: darkPalette.text,
    surface: darkPalette.surface,
    onSurface: darkPalette.text,
    surfaceVariant: darkPalette.surfaceAlt,
    onSurfaceVariant: darkPalette.muted,
    outline: darkPalette.border,
    outlineVariant: darkPalette.lavenderBorder,
    error: darkPalette.danger,
    onError: '#3B0B0B',
    errorContainer: '#652020',
    onErrorContainer: '#FFE8E8',
    elevation: {
      level0: 'transparent',
      level1: '#10162D',
      level2: '#141B35',
      level3: '#182140',
      level4: '#1E294B',
      level5: '#243056',
    },
    shadow: 'rgba(0, 0, 0, 0.52)',
    scrim: 'rgba(0, 0, 0, 0.58)',
    inverseSurface: '#11182F',
    inverseOnSurface: '#FFFFFF',
    inversePrimary: '#7DD3FC',
    backdrop: 'rgba(0, 0, 0, 0.52)',
  },
};

export const appTheme = lightTheme;
```
