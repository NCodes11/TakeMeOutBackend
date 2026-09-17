import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, spacing, useAppPalette } from '@/theme/appTheme';

const ROW_HEIGHT = 48;

/** Bottom sheet list picker used for times and other short option lists. */
export const OptionSheet = <T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onDismiss,
  mono = false,
}: {
  visible: boolean;
  title: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
  onDismiss: () => void;
  mono?: boolean;
}) => {
  const p = useAppPalette();
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!visible) return;
    const index = Math.max(0, options.findIndex((o) => o.value === value) - 2);
    const id = setTimeout(
      () => scrollRef.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false }),
      0,
    );
    return () => clearTimeout(id);
  }, [options, value, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={[styles.backdrop, { backgroundColor: p.backdrop }]} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: p.surfaceRaised, borderColor: p.line }]}>
          <View style={[styles.grabber, { backgroundColor: p.lineStrong }]} />
          <Text style={[styles.title, { color: p.textHigh }]}>{title}</Text>
          <ScrollView ref={scrollRef} style={styles.list} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onSelect(o.value)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: p.line,
                      backgroundColor: pressed ? p.surfaceRecessed : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      mono && styles.rowMono,
                      { color: on ? p.violetText : p.textHigh },
                    ]}
                  >
                    {o.label}
                  </Text>
                  {on ? (
                    <MaterialCommunityIcons name="check" size={18} color={p.violetText} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.gutter,
    paddingBottom: 28,
    maxHeight: '60%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  rowMono: {
    fontFamily: fonts.monoMedium,
    fontSize: 15,
  },
});
