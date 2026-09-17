import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, shadows, useAppPalette } from '@/theme/appTheme';

interface AppCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Raised white surface — the single elevation step of the light system. */
export const AppCard = ({ children, style }: AppCardProps) => {
  const p = useAppPalette();

  return (
    <View
      style={[
        styles.card,
        shadows.raised,
        {
          backgroundColor: p.surfaceRaised,
          borderColor: p.line,
          shadowColor: p.shadowColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.media,
    overflow: 'hidden',
  },
});
