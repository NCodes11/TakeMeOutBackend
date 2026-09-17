import { MD3DarkTheme, MD3LightTheme, useTheme } from 'react-native-paper';

/**
 * Take Me Out design tokens.
 *
 * Light is the primary ramp (a deliberately built violet-tinted ramp, not an
 * inversion). Dark is derived from the same roles so every component reads
 * the same token names from `useAppPalette()`.
 */
export const lightPalette = {
  // Surfaces
  paper: '#EFEDF7',
  canvas: '#F7F6FC',
  surfaceRaised: '#FFFFFF',
  surfaceRecessed: '#EDEAF6',
  surfacePressed: '#E3DFF1',

  // Lines
  line: '#E6E2EF',
  lineStrong: '#D3CDDF',

  // Violet roles
  violetText: '#4A34C4',
  violetFill: '#5B48E8',
  violetFillDeep: '#4A34C4',
  violetDecorative: '#7C6BFF',
  violetWash: '#E6E1FB',

  // Signal (time / duration only)
  signal: '#8F4E06',
  signalWash: '#FBEEDC',

  danger: '#B32B1E',
  dangerWash: '#FDEDEA',
  success: '#1F7A4D',

  // Text
  textHigh: '#171232',
  textMid: '#57516F',
  textLow: '#847EA0',
  onFill: '#FFFFFF',

  // Map
  mapBase: '#EAE7F4',

  // Category tiles (fallback media)
  tileViolet: '#EBE6FB',
  tileAmber: '#FBEEDC',
  tileGreen: '#E1EEDF',
  tileBlue: '#DCE6F7',
  tileRose: '#F8E3EA',

  shadowColor: '#1D1740',
  backdrop: 'rgba(23,18,50,0.42)',
};

export const darkPalette: AppPalette = {
  paper: '#0B0918',
  canvas: '#100D22',
  surfaceRaised: '#1A1630',
  surfaceRecessed: '#221D3C',
  surfacePressed: '#2C2650',

  line: '#26213F',
  lineStrong: '#37305A',

  violetText: '#B3A7FF',
  violetFill: '#6B58F0',
  violetFillDeep: '#5443D8',
  violetDecorative: '#8C7CFF',
  violetWash: '#2A2358',

  signal: '#E4B06A',
  signalWash: '#3A2C17',

  danger: '#F08A7E',
  dangerWash: '#3D1F1D',
  success: '#6FD3A0',

  textHigh: '#F3F1FA',
  textMid: '#B4AECB',
  textLow: '#7F789E',
  onFill: '#FFFFFF',

  mapBase: '#1B1733',

  tileViolet: '#2A2358',
  tileAmber: '#3A2C17',
  tileGreen: '#1D2A2A',
  tileBlue: '#1A2140',
  tileRose: '#3A2030',

  shadowColor: '#000000',
  backdrop: 'rgba(0,0,0,0.6)',
};

export type AppPalette = typeof lightPalette;

export const getAppPalette = (isDark: boolean): AppPalette => (isDark ? darkPalette : lightPalette);

export const useAppPalette = (): AppPalette => {
  const theme = useTheme();
  return getAppPalette(Boolean(theme.dark));
};

/** Loaded font family names (see app/_layout.tsx). */
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  gutter: 22,
};

export const radius = {
  control: 12,
  cta: 16,
  media: 16,
  pill: 999,
};

export const shadows = {
  raised: {
    shadowColor: lightPalette.shadowColor,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  strong: {
    shadowColor: lightPalette.shadowColor,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cta: {
    shadowColor: '#4A34C4',
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

const buildPaperTheme = (p: AppPalette, dark: boolean) => {
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark,
    roundness: 12,
    colors: {
      ...base.colors,
      primary: p.violetFill,
      onPrimary: p.onFill,
      primaryContainer: p.violetWash,
      onPrimaryContainer: p.violetText,

      secondary: p.signal,
      onSecondary: p.onFill,
      secondaryContainer: p.signalWash,
      onSecondaryContainer: p.signal,

      tertiary: p.violetDecorative,
      onTertiary: p.onFill,
      tertiaryContainer: p.violetWash,
      onTertiaryContainer: p.violetText,

      background: p.canvas,
      onBackground: p.textHigh,

      surface: p.surfaceRaised,
      onSurface: p.textHigh,
      surfaceVariant: p.surfaceRecessed,
      onSurfaceVariant: p.textMid,
      surfaceDisabled: p.surfaceRecessed,
      onSurfaceDisabled: p.textLow,

      outline: p.lineStrong,
      outlineVariant: p.line,

      error: p.danger,
      onError: p.onFill,
      errorContainer: p.dangerWash,
      onErrorContainer: p.danger,

      elevation: {
        level0: 'transparent',
        level1: p.surfaceRaised,
        level2: p.surfaceRaised,
        level3: p.surfaceRaised,
        level4: p.surfaceRaised,
        level5: p.surfaceRaised,
      },

      shadow: p.shadowColor,
      scrim: p.backdrop,
      backdrop: p.backdrop,
      inverseSurface: p.textHigh,
      inverseOnSurface: p.canvas,
      inversePrimary: p.violetDecorative,
    },
  };
};

export const lightTheme = buildPaperTheme(lightPalette, false);
export const darkTheme = buildPaperTheme(darkPalette, true);

/** @deprecated Prefer `useAppPalette()` so components react to dark mode. */
export const palette = lightPalette;
export const appTheme = lightTheme;
