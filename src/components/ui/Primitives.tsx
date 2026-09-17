import { ReactNode, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, radius, shadows, spacing, useAppPalette } from '@/theme/appTheme';

/* ------------------------------------------------------------------ */
/* Text roles                                                          */
/* ------------------------------------------------------------------ */

/** Small monospaced uppercase label (metadata, overlines). */
export const MonoLabel = ({
  children,
  style,
  color,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  color?: string;
  numberOfLines?: number;
}) => {
  const p = useAppPalette();
  return (
    <Text
      style={[styles.monoLabel, { color: color ?? p.textLow }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/** Time or duration value — always bronze, always mono. */
export const TimeText = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) => {
  const p = useAppPalette();
  return <Text style={[styles.time, { color: p.signal }, style]}>{children}</Text>;
};

/** Section heading: mono label followed by a hairline. */
export const SectionLabel = ({
  children,
  first = false,
  trailing,
}: {
  children: ReactNode;
  first?: boolean;
  trailing?: ReactNode;
}) => {
  const p = useAppPalette();
  return (
    <View style={[styles.section, first && styles.sectionFirst]}>
      <MonoLabel>{children}</MonoLabel>
      <View style={[styles.rule, { backgroundColor: p.line }]} />
      {trailing}
    </View>
  );
};

export const Hairline = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const p = useAppPalette();
  return <View style={[styles.hairline, { backgroundColor: p.line }, style]} />;
};

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

interface UnderlineInputProps extends TextInputProps {
  label?: string;
  error?: boolean;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Transparent input with a bottom border; focus thickens the underline without moving layout. */
export const UnderlineInput = ({
  label,
  error,
  right,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: UnderlineInputProps) => {
  const p = useAppPalette();
  const [focused, setFocused] = useState(false);
  const lineColor = error ? p.danger : focused ? p.violetFill : p.lineStrong;

  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text style={[styles.fieldLabel, { color: p.textMid }]}>{label}</Text> : null}
      <View
        style={[
          styles.underlineRow,
          {
            borderBottomColor: lineColor,
            borderBottomWidth: focused || error ? 2 : 1,
          },
          (focused || error) && styles.underlineRowFocused,
        ]}
      >
        <TextInput
          placeholderTextColor={p.textLow}
          selectionColor={p.violetFill}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.underlineInput, { color: p.textHigh }, style]}
          {...props}
        />
        {right}
      </View>
    </View>
  );
};

/** A tappable underline "input" that opens a picker (times, dates). */
export const UnderlineValue = ({
  label,
  value,
  onPress,
  mono = false,
  time = false,
  style,
}: {
  label?: string;
  value: string;
  onPress?: () => void;
  mono?: boolean;
  time?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const p = useAppPalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.field, style]}>
      {label ? <Text style={[styles.fieldLabel, { color: p.textMid }]}>{label}</Text> : null}
      <View style={[styles.underlineRow, { borderBottomColor: p.lineStrong }]}>
        <Text
          style={[
            styles.underlineInput,
            { color: time ? p.signal : p.textHigh },
            (mono || time) && styles.underlineMono,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={p.textLow} />
      </View>
    </Pressable>
  );
};

/* ------------------------------------------------------------------ */
/* Choice controls                                                     */
/* ------------------------------------------------------------------ */

export const Chip = ({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) => {
  const p = useAppPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        shadows.raised,
        {
          backgroundColor: selected ? p.violetFill : pressed ? p.surfaceRecessed : p.surfaceRaised,
          borderColor: selected ? p.violetFill : p.lineStrong,
          shadowColor: p.shadowColor,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? p.onFill : p.textHigh }]}>{label}</Text>
    </Pressable>
  );
};

export const ChipGroup = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <View style={styles.chips}>
    {options.map((o) => (
      <Chip
        key={o.value}
        label={o.label}
        selected={o.value === value}
        onPress={() => onChange(o.value)}
      />
    ))}
  </View>
);

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const p = useAppPalette();
  return (
    <View
      style={[styles.seg, { backgroundColor: p.surfaceRecessed }, style]}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              styles.segItem,
              on && shadows.raised,
              on && {
                backgroundColor: p.surfaceRaised,
                shadowColor: p.shadowColor,
              },
            ]}
          >
            <Text
              style={[styles.segLabel, { color: on ? p.violetText : p.textMid }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const SwitchRow = ({
  label,
  hint,
  value,
  onValueChange,
  divider = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
}) => {
  const p = useAppPalette();
  return (
    <View style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: p.line }]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color: p.textHigh }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: p.textLow }]}>{hint}</Text> : null}
      </View>
      <Pressable
        onPress={() => onValueChange(!value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        style={[styles.switchTrack, { backgroundColor: value ? p.violetFill : p.surfacePressed }]}
      >
        <View
          style={[
            styles.switchThumb,
            shadows.raised,
            {
              backgroundColor: p.surfaceRaised,
              shadowColor: p.shadowColor,
              transform: [{ translateX: value ? 20 : 0 }],
            },
          ]}
        />
      </Pressable>
    </View>
  );
};

export const ValueRow = ({
  label,
  children,
  divider = false,
  onPress,
}: {
  label: string;
  children?: ReactNode;
  divider?: boolean;
  onPress?: () => void;
}) => {
  const p = useAppPalette();
  const inner = (
    <View style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: p.line }]}>
      <Text style={[styles.rowLabel, { color: p.textHigh, flex: 1 }]}>{label}</Text>
      {children}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={p.textLow} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {inner}
    </Pressable>
  ) : (
    inner
  );
};

export const Stepper = ({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => {
  const p = useAppPalette();
  const Btn = ({
    icon,
    disabled,
    onPress,
  }: {
    icon: 'minus' | 'plus';
    disabled: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={icon === 'minus' ? 'Fewer stops' : 'More stops'}
      style={[styles.stepBtn, { opacity: disabled ? 0.35 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={p.violetText} />
    </Pressable>
  );
  return (
    <View
      style={[
        styles.stepper,
        shadows.raised,
        {
          backgroundColor: p.surfaceRaised,
          borderColor: p.lineStrong,
          shadowColor: p.shadowColor,
        },
      ]}
    >
      <Btn
        icon="minus"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <Text style={[styles.stepValue, { color: p.textHigh }]}>{value}</Text>
      <Btn icon="plus" disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export const Notice = ({
  children,
  tone = 'danger',
  title,
}: {
  children: ReactNode;
  tone?: 'danger' | 'signal' | 'violet';
  title?: string;
}) => {
  const p = useAppPalette();
  const color = tone === 'danger' ? p.danger : tone === 'signal' ? p.signal : p.violetText;
  const wash = tone === 'danger' ? p.dangerWash : tone === 'signal' ? p.signalWash : p.violetWash;
  return (
    <View style={[styles.notice, { backgroundColor: wash, borderColor: color }]}>
      {title ? <Text style={[styles.noticeTitle, { color }]}>{title}</Text> : null}
      <Text style={[styles.noticeBody, { color: p.textMid }]}>{children}</Text>
    </View>
  );
};

/** Sticky bottom action area with a canvas fade. */
export const Dock = ({ children }: { children: ReactNode }) => {
  const p = useAppPalette();
  return (
    <View pointerEvents="box-none" style={styles.dockWrap}>
      <View style={[styles.dockFade, { backgroundColor: p.canvas, opacity: 0.6 }]} />
      <View style={[styles.dock, { backgroundColor: p.canvas }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  monoLabel: {
    fontFamily: fonts.monoSemi,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  time: {
    fontFamily: fonts.monoSemi,
    fontSize: 13,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionFirst: {
    marginTop: 18,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  hairline: {
    height: 1,
    width: '100%',
  },

  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12.5,
  },
  underlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 10,
    minHeight: 44,
  },
  underlineRowFocused: {
    paddingBottom: 9,
  },
  underlineInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  underlineMono: {
    fontFamily: fonts.monoSemi,
    fontSize: 15,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompact: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  chipLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
  },

  seg: {
    flexDirection: 'row',
    borderRadius: radius.control,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: 8,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  rowHint: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 11,
  },
  stepBtn: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    width: 34,
    textAlign: 'center',
    fontFamily: fonts.monoSemi,
    fontSize: 15,
  },

  notice: {
    borderWidth: 1,
    borderRadius: radius.control,
    padding: 13,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 14.5,
  },
  noticeBody: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
  },

  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockFade: {
    height: 18,
  },
  dock: {
    paddingHorizontal: spacing.gutter,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
});
