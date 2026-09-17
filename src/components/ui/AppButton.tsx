import { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, radius, shadows, spacing, useAppPalette } from '@/theme/appTheme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface AppButtonProps {
  children: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Kept for call-site compatibility; the new buttons size themselves. */
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Full-width violet CTA. */
export const PrimaryButton = ({
  children,
  onPress,
  icon,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: AppButtonProps) => {
  const p = useAppPalette();
  const inactive = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        shadows.cta,
        {
          backgroundColor: pressed ? p.violetFillDeep : p.violetFill,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.onFill} />
      ) : (
        <View style={styles.inner}>
          {icon ? <MaterialCommunityIcons name={icon} size={19} color={p.onFill} /> : null}
          <Text style={[styles.primaryLabel, { color: p.onFill }]}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
};

/** White, bordered, monospaced action. Meant to sit in equal-width rows. */
export const SecondaryButton = ({
  children,
  onPress,
  icon,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: AppButtonProps) => {
  const p = useAppPalette();
  const inactive = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        shadows.raised,
        {
          backgroundColor: pressed ? p.surfaceRecessed : p.surfaceRaised,
          borderColor: p.lineStrong,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.violetText} />
      ) : (
        <View style={styles.inner}>
          {icon ? <MaterialCommunityIcons name={icon} size={16} color={p.violetText} /> : null}
          <Text style={[styles.secondaryLabel, { color: p.violetText }]} numberOfLines={1}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

/** Quiet monospaced text link. */
export const GhostButton = ({
  children,
  onPress,
  icon,
  disabled,
  style,
  accessibilityLabel,
}: AppButtonProps) => {
  const p = useAppPalette();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.ghost, { opacity: pressed || disabled ? 0.55 : 1 }, style]}
    >
      <View style={styles.inner}>
        {icon ? <MaterialCommunityIcons name={icon} size={15} color={p.violetText} /> : null}
        <Text style={[styles.secondaryLabel, { color: p.violetText }]}>{children}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    minHeight: 54,
    borderRadius: radius.cta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryLabel: {
    fontFamily: fonts.displayBold,
    fontSize: 16.5,
    letterSpacing: -0.2,
  },
  secondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryLabel: {
    fontFamily: fonts.monoSemi,
    fontSize: 11.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ghost: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
