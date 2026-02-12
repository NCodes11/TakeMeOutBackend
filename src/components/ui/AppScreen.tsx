import { ReactNode } from 'react';
import { ScrollView, ScrollViewProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { palette, spacing } from '@/theme/appTheme';

interface AppScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}

export const AppScreen = ({ children, title, subtitle, scroll = true, style, contentContainerStyle }: AppScreenProps) => {
  const body = (
    <View style={[styles.content, style]}>
      {title ? <Text variant="headlineSmall" style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text variant="bodyMedium" style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, contentContainerStyle]}>{body}</ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  title: {
    color: palette.text,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.muted,
    marginTop: -spacing.xs,
  },
});
