import { ReactNode } from 'react';
import { ScrollView, ScrollViewProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'react-native-paper';
import { spacing } from '@/theme/appTheme';

interface AppScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}

export const AppScreen = ({ children, title, subtitle, scroll = true, style, contentContainerStyle }: AppScreenProps) => {
  const theme = useTheme();
  const body = (
    <View style={[styles.content, style]}>
      {title ? <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text> : null}
      {subtitle ? <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
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
    fontWeight: '700',
  },
  subtitle: {
    marginTop: -spacing.xs,
  },
});
