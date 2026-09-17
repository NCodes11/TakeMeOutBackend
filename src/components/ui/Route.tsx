import { ReactNode, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDistance, useDistanceUnits, useTimeFormat } from '@/context/PreferencesContext';
import { fonts, spacing, useAppPalette } from '@/theme/appTheme';
import { Stop } from '@/types/models';
import { formatTimeCompact, formatTimeDisplay } from '@/utils/time';
import { PrimaryButton, SecondaryButton } from './AppButton';
import { MonoLabel, TimeText, UnderlineInput } from './Primitives';

/** Human date for a YYYY-MM-DD string, e.g. "Sat Sep 5". */
export const formatPlanDate = (iso: string) => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/** Open route header: eyebrow, large city title, three-column metadata strip. */
export const RouteHeader = ({
  eyebrow,
  title,
  date,
  startTime,
  endTime,
  stopCount,
  distanceKm,
  travelMin,
  transport,
  action,
}: {
  eyebrow: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  stopCount: number;
  distanceKm?: number;
  travelMin?: number;
  transport?: 'walk' | 'drive';
  action?: ReactNode;
}) => {
  const p = useAppPalette();
  const timeFormat = useTimeFormat();
  const units = useDistanceUnits();

  const routeValue = [
    `${stopCount} stop${stopCount === 1 ? '' : 's'}`,
    typeof distanceKm === 'number' ? formatDistance(distanceKm, units) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const travelValue =
    typeof travelMin === 'number'
      ? `${travelMin} min ${transport === 'drive' ? 'drive' : 'walk'}`
      : transport === 'drive'
        ? 'Driving'
        : 'Walking';

  return (
    <View>
      <MonoLabel>{eyebrow}</MonoLabel>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: p.textHigh }]} accessibilityRole="header">
          {title}
        </Text>
        {action}
      </View>
      <View style={[styles.strip, { borderTopColor: p.line, borderBottomColor: p.line }]}>
        <View style={styles.cell}>
          <MonoLabel>Date</MonoLabel>
          <Text style={[styles.cellValue, { color: p.textHigh }]} numberOfLines={1}>
            {formatPlanDate(date)}
          </Text>
        </View>
        <View style={[styles.cellDivider, { backgroundColor: p.line }]} />
        <View style={[styles.cell, styles.cellInner]}>
          <MonoLabel>Window</MonoLabel>
          <TimeText style={styles.cellTime}>
            {formatTimeCompact(startTime, timeFormat)}–{formatTimeCompact(endTime, timeFormat)}
          </TimeText>
        </View>
        <View style={[styles.cellDivider, { backgroundColor: p.line }]} />
        <View style={[styles.cell, styles.cellInner]}>
          <MonoLabel>Route</MonoLabel>
          <Text style={[styles.cellValue, { color: p.textHigh }]} numberOfLines={2}>
            {routeValue}
          </Text>
          <Text style={[styles.cellSub, { color: p.textLow }]} numberOfLines={1}>
            {travelValue}
          </Text>
        </View>
      </View>
    </View>
  );
};

/** Compact de-boxed row for the List view. */
export const RouteListRow = ({
  stop,
  divider = true,
  onPress,
  actions,
}: {
  stop: Stop;
  divider?: boolean;
  onPress?: () => void;
  actions?: ReactNode;
}) => {
  const p = useAppPalette();
  const timeFormat = useTimeFormat();
  const time =
    stop.startTime && stop.endTime
      ? `${formatTimeDisplay(stop.startTime, timeFormat)}–${formatTimeDisplay(stop.endTime, timeFormat)}`
      : '';

  return (
    <View style={[styles.listRow, divider && { borderBottomWidth: 1, borderBottomColor: p.line }]}>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.listMain}>
        <Text style={[styles.listIndex, { color: p.violetText }]}>
          {String(stop.order + 1).padStart(2, '0')}
        </Text>
        <View style={styles.listCopy}>
          <Text style={[styles.listName, { color: p.textHigh }]} numberOfLines={1}>
            {stop.name}
          </Text>
          <Text style={[styles.listMeta, { color: p.textMid }]} numberOfLines={1}>
            {[stop.category, stop.address].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {time ? <TimeText style={styles.listTime}>{time}</TimeText> : null}
        <MaterialCommunityIcons name="chevron-right" size={18} color={p.textLow} />
      </Pressable>
      {actions ? <View style={styles.listActions}>{actions}</View> : null}
    </View>
  );
};

/** Bottom sheet for naming a plan before saving it. */
export const SaveSheet = ({
  visible,
  initialTitle,
  onDismiss,
  onSave,
}: {
  visible: boolean;
  initialTitle: string;
  onDismiss: () => void;
  onSave: (title: string) => void;
}) => {
  const p = useAppPalette();
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (visible) setTitle(initialTitle);
  }, [initialTitle, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: p.backdrop }]} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: p.surfaceRaised, borderColor: p.line }]}>
          <View style={[styles.grabber, { backgroundColor: p.lineStrong }]} />
          <Text style={[styles.sheetTitle, { color: p.textHigh }]}>Save this plan</Text>
          <UnderlineInput
            label="Plan name"
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onSave(title.trim() || initialTitle)}
          />
          <View style={styles.sheetActions}>
            <SecondaryButton onPress={onDismiss}>Cancel</SecondaryButton>
            <View style={styles.sheetPrimary}>
              <PrimaryButton
                icon="bookmark-outline"
                onPress={() => onSave(title.trim() || initialTitle)}
                style={styles.sheetPrimaryButton}
              >
                Save
              </PrimaryButton>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.9,
    marginTop: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  strip: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  cell: {
    flex: 1,
    paddingVertical: 10,
    gap: 4,
  },
  cellInner: {
    paddingLeft: 12,
  },
  cellDivider: {
    width: 1,
  },
  cellValue: {
    fontFamily: fonts.monoSemi,
    fontSize: 12.5,
    lineHeight: 17,
  },
  cellTime: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  cellSub: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
  },

  listRow: {
    paddingVertical: 12,
    gap: 10,
  },
  listMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  listIndex: {
    fontFamily: fonts.monoSemi,
    fontSize: 12,
    width: 22,
  },
  listCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  listName: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
  },
  listMeta: {
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  listTime: {
    fontSize: 11.5,
  },
  listActions: {
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 34,
  },

  sheetOverlay: {
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
    gap: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
  sheetTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetPrimary: {
    flex: 1.4,
  },
  sheetPrimaryButton: {
    minHeight: 44,
    borderRadius: 12,
  },
});
