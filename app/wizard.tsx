import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay';
import {
  AppScreen,
  Chip,
  ChipGroup,
  Dock,
  Notice,
  OptionSheet,
  PrimaryButton,
  SectionLabel,
  Segmented,
  Stepper,
  SwitchRow,
  TimeText,
  UnderlineInput,
  UnderlineValue,
  ValueRow,
} from '@/components/ui';
import { GROUP_TYPE_OPTIONS } from '@/constants/groupTypes';
import { STOP_TYPE_OPTIONS, stopTypeLabel } from '@/constants/stopTypes';
import { useLocation } from '@/context/LocationContext';
import { useTimeFormat } from '@/context/PreferencesContext';
import { usePlanStore } from '@/store/usePlanStore';
import { BudgetType, StopType, TransportType, WizardInput } from '@/types/models';
import { fonts, spacing, useAppPalette } from '@/theme/appTheme';
import {
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  formatTimeDisplay,
  snapEndTimeAfterStart,
} from '@/utils/time';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const MIN_TRAVEL_MINUTES = 5;
const MAX_TRAVEL_MINUTES = 90;
const DEFAULT_TRAVEL_MINUTES = 30;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateInput = (value: string) => {
  if (!DATE_REGEX.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
};

const defaultInput = (
  city: string,
  startLocationMode: WizardInput['startLocationMode'] = 'my-location',
): WizardInput => ({
  city,
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '20:00',
  groupType: 'Date',
  adults: 2,
  kids: 0,
  kidAges: [],
  transport: 'walk',
  budget: '$$',
  pace: 'standard',
  feelingLucky: false,
  preferences: {
    interests: ['coffee', 'restaurant', 'attraction', 'shopping'],
    avoid: [],
    mustInclude: '',
    maxTravelMinutes: DEFAULT_TRAVEL_MINUTES,
    accessibleFriendly: false,
  },
  startLocationMode,
  startAddress: startLocationMode === 'custom' ? city : '',
  returnToStart: true,
  stopCount: 4,
});

const TRANSPORT_OPTIONS = [
  { value: 'walk', label: 'Walk' },
  { value: 'drive', label: 'Drive' },
] as const;

const BUDGET_OPTIONS = [
  { value: '$', label: '$' },
  { value: '$$', label: '$$' },
  { value: '$$$', label: '$$$' },
] as const;

const PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'standard', label: 'Standard' },
  { value: 'packed', label: 'Packed' },
] as const;

export default function WizardScreen() {
  const p = useAppPalette();
  const params = useLocalSearchParams<{
    city?: string;
    locationMode?: 'live' | 'manual';
    originLat?: string;
    originLng?: string;
    capture?: string;
  }>();
  const location = useLocation();
  const timeFormat = useTimeFormat();

  const initialLocationMode =
    params.locationMode === 'manual' || location.mode === 'manual' ? 'custom' : 'my-location';

  const [input, setInput] = useState<WizardInput>(() =>
    defaultInput(params.city || '', initialLocationMode),
  );
  const [maxTravel, setMaxTravel] = useState<number>(DEFAULT_TRAVEL_MINUTES);
  const [startSheetVisible, setStartSheetVisible] = useState(false);
  const [endSheetVisible, setEndSheetVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createPlan = usePlanStore((s) => s.createPlan);
  const loading = usePlanStore((s) => s.loading);
  const loadingProgress = usePlanStore((s) => s.loadingProgress);
  const error = usePlanStore((s) => s.error);

  const updateInput = (patch: Partial<WizardInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  };

  const updatePreferences = (patch: Partial<WizardInput['preferences']>) => {
    setInput((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...patch,
      },
    }));
  };

  const updateCity = (value: string) => {
    setInput((prev) => ({
      ...prev,
      city: value,
      startLocationMode: 'custom',
      startAddress: value,
      startLat: undefined,
      startLng: undefined,
    }));
  };

  useEffect(() => {
    const lat = params.originLat ? Number(params.originLat) : undefined;
    const lng = params.originLng ? Number(params.originLng) : undefined;
    const hasLat = typeof lat === 'number' && Number.isFinite(lat);
    const hasLng = typeof lng === 'number' && Number.isFinite(lng);
    const paramStartLocationMode =
      params.locationMode === 'manual'
        ? 'custom'
        : params.locationMode === 'live'
          ? 'my-location'
          : undefined;

    setInput((prev) => ({
      ...prev,
      city: prev.city || params.city || prev.city,
      startLat: hasLat ? lat : prev.startLat,
      startLng: hasLng ? lng : prev.startLng,
      startLocationMode: paramStartLocationMode || prev.startLocationMode,
      startAddress:
        paramStartLocationMode === 'custom'
          ? params.city || prev.startAddress || prev.city
          : prev.startAddress,
    }));
  }, [params.city, params.locationMode, params.originLat, params.originLng]);

  useEffect(() => {
    if (!location.coords) return;
    if (location.mode !== 'live') return;

    setInput((prev) => ({
      ...(prev.startLocationMode === 'custom'
        ? prev
        : {
            ...prev,
            city: prev.city || location.placeLabel || prev.city,
            startLat: location.coords?.latitude ?? prev.startLat,
            startLng: location.coords?.longitude ?? prev.startLng,
          }),
    }));
  }, [location.coords, location.mode, location.placeLabel]);

  useEffect(() => {
    const value =
      typeof input.preferences.maxTravelMinutes === 'number'
        ? input.preferences.maxTravelMinutes
        : DEFAULT_TRAVEL_MINUTES;

    setMaxTravel(clamp(value, MIN_TRAVEL_MINUTES, MAX_TRAVEL_MINUTES));
  }, [input.preferences.maxTravelMinutes]);

  const toggleInterest = (name: string) => {
    setInput((prev) => {
      const interests = prev.preferences.interests.includes(name)
        ? prev.preferences.interests.filter((i) => i !== name)
        : [...prev.preferences.interests, name];

      if (__DEV__) {
        console.log(
          '[plan] selected_stop_types',
          interests.map((type) => stopTypeLabel(type as StopType)),
        );
      }

      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          interests,
        },
      };
    });
  };

  const sliderLabel = useMemo(() => {
    if (maxTravel <= 10) return 'tight';
    if (maxTravel <= 25) return 'reasonable';
    if (maxTravel <= 45) return 'flexible';
    return 'wide';
  }, [maxTravel]);

  const startTimeOptions = useMemo(
    () =>
      START_TIME_OPTIONS.map((t) => ({
        value: t,
        label: formatTimeDisplay(t, timeFormat),
      })),
    [timeFormat],
  );
  const endTimeOptions = useMemo(
    () =>
      END_TIME_OPTIONS.map((t) => ({
        value: t,
        label: formatTimeDisplay(t, timeFormat),
      })),
    [timeFormat],
  );

  const onSelectStartTime = (value: string) => {
    setInput((prev) => ({
      ...prev,
      startTime: value,
      endTime: snapEndTimeAfterStart(value, prev.endTime),
    }));
    setStartSheetVisible(false);
  };

  const onSelectEndTime = (value: string) => {
    setInput((prev) => ({
      ...prev,
      endTime: snapEndTimeAfterStart(prev.startTime, value),
    }));
    setEndSheetVisible(false);
  };

  const hasSelectedStopTypes = input.preferences.interests.length > 0;
  const hasValidStops = input.feelingLucky || hasSelectedStopTypes;
  const hasValidCity = input.city.trim().length > 0;
  const hasValidDate = isValidDateInput(input.date);

  const isSubmitDisabled = loading || !hasValidCity || !hasValidDate || !hasValidStops;

  const handleGenerate = async () => {
    if (isSubmitDisabled) return;

    try {
      setSubmitError(null);

      let lat = input.startLat;
      let lng = input.startLng;
      let city = input.city.trim();

      if (input.startLocationMode === 'custom') {
        const fresh = await location.setManualLocation(city);
        lat = fresh.coords.latitude;
        lng = fresh.coords.longitude;
        city = fresh.placeLabel;
      } else {
        const fresh = await location.refreshLocation().catch(() => ({
          coords: location.coords,
          placeLabel: location.placeLabel,
        }));

        lat = fresh.coords?.latitude ?? lat;
        lng = fresh.coords?.longitude ?? lng;
        city = city || fresh.placeLabel || '';
      }

      const payload: WizardInput = {
        ...input,
        city,
        endTime: snapEndTimeAfterStart(input.startTime, input.endTime),
        startLat: lat,
        startLng: lng,
        startAddress: input.startLocationMode === 'custom' ? city : input.startAddress,
        preferences: {
          ...input.preferences,
          maxTravelMinutes: clamp(maxTravel, MIN_TRAVEL_MINUTES, MAX_TRAVEL_MINUTES),
        },
      };

      if (__DEV__) {
        console.log('[plan] wizard_submit', {
          city,
          origin: { lat, lng },
          stopCount: payload.stopCount,
          selectedTypes: payload.preferences.interests,
          maxTravelMinutes: payload.preferences.maxTravelMinutes,
        });
      }

      const id = await createPlan(payload);

      if (!id) {
        if (__DEV__) {
          console.warn('[plan] createPlan returned no id');
        }
        return;
      }

      router.push(`/generated/${id}`);
    } catch (submitError) {
      console.error('[plan] wizard_submit_failed', submitError);
      setSubmitError(
        submitError instanceof Error ? submitError.message : 'Unable to generate your plan.',
      );
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AppScreen
          title="Plan your day"
          subtitle="Four things to set. Everything else we'll figure out."
          dockSpace
          initialScrollY={__DEV__ && params.capture === 'settings' ? 720 : undefined}
        >
          <SectionLabel first>Where &amp; when</SectionLabel>

          <UnderlineInput
            label="City"
            value={input.city}
            onChangeText={updateCity}
            placeholder="Where are you starting?"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <View style={styles.tripleRow}>
            <UnderlineInput
              label="Date"
              value={input.date}
              onChangeText={(value) => updateInput({ date: value })}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              error={input.date.length > 0 && !hasValidDate}
              containerStyle={styles.dateField}
              style={styles.monoInput}
            />
            <UnderlineValue
              label="Start"
              value={formatTimeDisplay(input.startTime, timeFormat)}
              onPress={() => setStartSheetVisible(true)}
              time
              style={styles.timeField}
            />
            <UnderlineValue
              label="End"
              value={formatTimeDisplay(input.endTime, timeFormat)}
              onPress={() => setEndSheetVisible(true)}
              time
              style={styles.timeField}
            />
          </View>

          {input.date.length > 0 && !hasValidDate ? (
            <Text style={[styles.fieldError, { color: p.danger }]}>
              Enter a valid date in YYYY-MM-DD format.
            </Text>
          ) : null}

          <SectionLabel>Who &amp; how</SectionLabel>

          <ChipGroup
            options={GROUP_TYPE_OPTIONS}
            value={input.groupType}
            onChange={(value) => updateInput({ groupType: value })}
          />

          <View style={styles.segRow}>
            <Segmented
              options={TRANSPORT_OPTIONS}
              value={input.transport}
              onChange={(value) => updateInput({ transport: value as TransportType })}
              style={styles.segTransport}
            />
            <Segmented
              options={BUDGET_OPTIONS}
              value={input.budget}
              onChange={(value) => updateInput({ budget: value as BudgetType })}
              style={styles.segBudget}
            />
          </View>

          <Segmented
            options={PACE_OPTIONS}
            value={input.pace || 'standard'}
            onChange={(value) => updateInput({ pace: value })}
            style={styles.segPace}
          />

          <SectionLabel>Stops</SectionLabel>

          <SwitchRow
            label="Feeling lucky"
            hint="Let us pick the mix of places"
            value={input.feelingLucky}
            onValueChange={(value) => updateInput({ feelingLucky: value })}
          />

          {!input.feelingLucky ? (
            <>
              <View style={styles.chips}>
                {STOP_TYPE_OPTIONS.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    selected={input.preferences.interests.includes(option.id)}
                    onPress={() => toggleInterest(option.id)}
                  />
                ))}
              </View>

              {!hasSelectedStopTypes ? (
                <Text style={[styles.fieldError, { color: p.danger }]}>
                  Select at least one stop type or turn on Feeling lucky.
                </Text>
              ) : null}
            </>
          ) : null}

          <ValueRow label="Number of stops" divider>
            <Stepper
              value={input.stopCount}
              min={1}
              max={8}
              onChange={(value) => updateInput({ stopCount: value })}
            />
          </ValueRow>

          <SectionLabel>Trip settings</SectionLabel>

          <UnderlineInput
            label="Must include"
            placeholder="A place or type you don't want to miss"
            value={input.preferences.mustInclude}
            onChangeText={(value) => updatePreferences({ mustInclude: value })}
          />

          <UnderlineInput
            label="Avoid"
            placeholder="Comma separated, e.g. chains, seafood"
            value={input.preferences.avoid.join(', ')}
            onChangeText={(value) =>
              updatePreferences({
                avoid: value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            containerStyle={styles.fieldGap}
          />

          <View style={[styles.sliderBlock, { borderBottomColor: p.line }]}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.rowLabel, { color: p.textHigh }]}>Max travel between stops</Text>
              <TimeText style={styles.sliderValue}>
                {maxTravel} min <Text style={{ color: p.textLow }}>· {sliderLabel}</Text>
              </TimeText>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={MIN_TRAVEL_MINUTES}
              maximumValue={MAX_TRAVEL_MINUTES}
              step={5}
              value={clamp(maxTravel, MIN_TRAVEL_MINUTES, MAX_TRAVEL_MINUTES)}
              onValueChange={(value) => setMaxTravel(value)}
              onSlidingComplete={(value) => {
                const bounded = clamp(value, MIN_TRAVEL_MINUTES, MAX_TRAVEL_MINUTES);
                setMaxTravel(bounded);
                updatePreferences({ maxTravelMinutes: bounded });
              }}
              minimumTrackTintColor={p.violetFill}
              maximumTrackTintColor={p.surfacePressed}
              thumbTintColor={p.violetFill}
              accessibilityLabel="Max travel time between stops"
            />
          </View>

          <SwitchRow
            label="Accessible-friendly"
            hint="Prefer step-free places and routes"
            value={input.preferences.accessibleFriendly}
            onValueChange={(value) => updatePreferences({ accessibleFriendly: value })}
          />
          <SwitchRow
            label="Return to start"
            value={input.returnToStart}
            onValueChange={(value) => updateInput({ returnToStart: value })}
            divider
          />

          {error || submitError ? (
            <View style={styles.errorWrap}>
              <Notice title="Couldn't build your day">{error || submitError}</Notice>
            </View>
          ) : null}
        </AppScreen>

        <Dock>
          <PrimaryButton loading={loading} disabled={isSubmitDisabled} onPress={handleGenerate}>
            Generate day plan
          </PrimaryButton>
          <Text style={[styles.dockHint, { color: p.textLow }]}>Takes about 6 seconds</Text>
        </Dock>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={startSheetVisible}
        title="Start time"
        options={startTimeOptions}
        value={input.startTime}
        onSelect={onSelectStartTime}
        onDismiss={() => setStartSheetVisible(false)}
        mono
      />
      <OptionSheet
        visible={endSheetVisible}
        title="End time"
        options={endTimeOptions}
        value={input.endTime}
        onSelect={onSelectEndTime}
        onDismiss={() => setEndSheetVisible(false)}
        mono
      />

      <GenerationLoadingOverlay visible={loading} progress={loadingProgress} />
    </>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  tripleRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
  },
  dateField: {
    flex: 1.35,
  },
  timeField: {
    flex: 1,
  },
  monoInput: {
    fontFamily: fonts.monoMedium,
    fontSize: 15,
  },
  fieldError: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
  },
  segRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  segTransport: {
    flex: 1,
  },
  segBudget: {
    flex: 1.3,
  },
  segPace: {
    marginTop: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  fieldGap: {
    marginTop: 14,
  },
  sliderBlock: {
    marginTop: 18,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sliderValue: {
    fontSize: 12.5,
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 2,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  errorWrap: {
    marginTop: spacing.lg,
  },
  dockHint: {
    fontFamily: fonts.monoSemi,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
