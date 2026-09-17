import { ReactNode, useEffect, useRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, spacing, useAppPalette } from '@/theme/appTheme';

interface AppScreenProps {
  children: ReactNode;
  /** Large title rendered in the scroll content (the compact title lives in the native header). */
  title?: string;
  /** Small monospaced overline above the title, e.g. "READY ROUTE". */
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  /** Extra bottom padding so content clears a CTA dock. */
  dockSpace?: boolean;
  /** Development capture helper for deterministic visual QA of long screens. */
  initialScrollY?: number;
  /** Safe-area edges; the native stack header already covers the top on most screens. */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export const AppScreen = ({
  children,
  title,
  eyebrow,
  subtitle,
  action,
  scroll = true,
  style,
  contentContainerStyle,
  dockSpace = false,
  initialScrollY,
  edges = ['bottom', 'left', 'right'],
}: AppScreenProps) => {
  const p = useAppPalette();
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!initialScrollY) return;
    const id = setTimeout(
      () => scrollRef.current?.scrollTo({ x: 0, y: initialScrollY, animated: false }),
      0,
    );
    return () => clearTimeout(id);
  }, [initialScrollY]);

  const header =
    title || eyebrow || subtitle ? (
      <View style={styles.header}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: p.textLow }]}>{eyebrow}</Text> : null}
        {title ? (
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: p.textHigh }]} accessibilityRole="header">
              {title}
            </Text>
            {action}
          </View>
        ) : null}
        {subtitle ? <Text style={[styles.subtitle, { color: p.textMid }]}>{subtitle}</Text> : null}
      </View>
    ) : null;

  const body = (
    <View style={[styles.content, style]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: p.canvas }]}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            dockSpace && styles.dockSpace,
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
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
  dockSpace: {
    paddingBottom: 132,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    flex: 1,
  },
  header: {
    gap: 8,
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.monoSemi,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.9,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 22,
  },
});
