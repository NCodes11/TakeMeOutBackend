import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Menu,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay';
import { AppCard, AppScreen, ChoiceButtonGroup, PrimaryButton } from '@/components/ui';
import { GROUP_TYPE_OPTIONS } from '@/constants/groupTypes';
import { STOP_TYPE_OPTIONS, stopTypeLabel } from '@/constants/stopTypes';
import { useLocation } from '@/context/LocationContext';
import { useTimeFormat } from '@/context/PreferencesContext';
import { usePlanStore } from '@/store/usePlanStore';
import { BudgetType, StopType, TransportType, WizardInput } from '@/types/models';
import { spacing } from '@/theme/appTheme';
import { END_TIME_OPTIONS, START_TIME_OPTIONS, formatTimeDisplay, snapEndTimeAfterStart } from '@/utils/time';

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

  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
};

const defaultInput = (city: string): WizardInput => ({
  city,
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '20:00',
  groupType: 'Date',
  adults: 2,
  kids: 0,
  kidAges: [],
  transport: 'drive',
  budget: '$$',
  feelingLucky: false,
  preferences: {
    interests: [],
    avoid: [],
    mustInclude: '',
    maxTravelMinutes: DEFAULT_TRAVEL_MINUTES,
    accessibleFriendly: false,
  },
  startLocationMode: 'my-location',
  startAddress: '',
  returnToStart: true,
  stopCount: 3,
});

export default function WizardScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ city?: string; originLat?: string; originLng?: string }>();
  const location = useLocation();
  const timeFormat = useTimeFormat();

  const [input, setInput] = useState<WizardInput>(() => defaultInput(params.city || ''));
  const [maxTravel, setMaxTravel] = useState<number>(DEFAULT_TRAVEL_MINUTES);
  const [startMenuVisible, setStartMenuVisible] = useState(false);
  const [endMenuVisible, setEndMenuVisible] = useState(false);

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

  useEffect(() => {
    const lat = params.originLat ? Number(params.originLat) : undefined;
    const lng = params.originLng ? Number(params.originLng) : undefined;
    const hasLat = typeof lat === 'number' && Number.isFinite(lat);
    const hasLng = typeof lng === 'number' && Number.isFinite(lng);

    setInput((prev) => ({
      ...prev,
      city: prev.city || params.city || prev.city,
      startLat: hasLat ? lat : prev.startLat,
      startLng: hasLng ? lng : prev.startLng,
    }));
  }, [params.city, params.originLat, params.originLng]);

  useEffect(() => {
    if (!location.coords) return;

    setInput((prev) => ({
      ...prev,
      city: prev.city || location.placeLabel || prev.city,
      startLat: location.coords?.latitude ?? prev.startLat,
      startLng: location.coords?.longitude ?? prev.startLng,
    }));
  }, [location.coords, location.placeLabel]);

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
          interests.map((type) => stopTypeLabel(type as StopType))
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
    if (maxTravel <= 10) return `${maxTravel} min (tight)`;
    if (maxTravel <= 25) return `${maxTravel} min (reasonable)`;
    if (maxTravel <= 45) return `${maxTravel} min (flexible)`;
    return `${maxTravel} min (wide)`;
  }, [maxTravel]);

  const onSelectStartTime = (value: string) => {
    setInput((prev) => ({
      ...prev,
      startTime: value,
      endTime: snapEndTimeAfterStart(value, prev.endTime),
    }));
    setStartMenuVisible(false);
  };

  const onSelectEndTime = (value: string) => {
    setInput((prev) => ({
      ...prev,
      endTime: snapEndTimeAfterStart(prev.startTime, value),
    }));
    setEndMenuVisible(false);
  };

  const hasSelectedStopTypes = input.preferences.interests.length > 0;
  const hasValidStops = input.feelingLucky || hasSelectedStopTypes;
  const hasValidCity = input.city.trim().length > 0;
  const hasValidDate = isValidDateInput(input.date);

  const isSubmitDisabled = loading || !hasValidCity || !hasValidDate || !hasValidStops;

  const handleGenerate = async () => {
    if (isSubmitDisabled) return;

    try {
      const fresh = await location
        .refreshLocation()
        .catch(() => ({ coords: location.coords, placeLabel: location.placeLabel }));

      const lat = fresh.coords?.latitude ?? input.startLat;
      const lng = fresh.coords?.longitude ?? input.startLng;
      const city = input.city.trim() || fresh.placeLabel || '';

      const payload: WizardInput = {
        ...input,
        city,
        endTime: snapEndTimeAfterStart(input.startTime, input.endTime),
        startLat: lat,
        startLng: lng,
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
    }
  };

  return (
    <>
    <AppScreen title="Plan your day">
      <Stack.Screen
        options={{
          title: 'TAKE ME OUT',
          headerBackTitle: 'Home',
        }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <AppCard>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Location
            </Text>

            <TextInput
              label="City"
              value={input.city}
              onChangeText={(value) => updateInput({ city: value })}
              mode="outlined"
            />

            <TextInput
              label="Date"
              value={input.date}
              onChangeText={(value) => updateInput({ date: value })}
              mode="outlined"
              placeholder="YYYY-MM-DD"
              error={input.date.length > 0 && !hasValidDate}
            />

            {input.date.length > 0 && !hasValidDate ? (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                Enter a valid date in YYYY-MM-DD format.
              </Text>
            ) : null}
          </Card.Content>
        </AppCard>

        <AppCard>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Time
            </Text>

            <View style={styles.row}>
              <Menu
                visible={startMenuVisible}
                onDismiss={() => setStartMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setStartMenuVisible(true)} style={styles.timeButton}>
                    Start: {formatTimeDisplay(input.startTime, timeFormat)}
                  </Button>
                }
              >
                <ScrollView style={styles.timeMenuScroll}>
                  {START_TIME_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option}
                      onPress={() => onSelectStartTime(option)}
                      title={formatTimeDisplay(option, timeFormat)}
                    />
                  ))}
                </ScrollView>
              </Menu>

              <Menu
                visible={endMenuVisible}
                onDismiss={() => setEndMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setEndMenuVisible(true)} style={styles.timeButton}>
                    End: {formatTimeDisplay(input.endTime, timeFormat)}
                  </Button>
                }
              >
                <ScrollView style={styles.timeMenuScroll}>
                  {END_TIME_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option}
                      onPress={() => onSelectEndTime(option)}
                      title={formatTimeDisplay(option, timeFormat)}
                    />
                  ))}
                </ScrollView>
              </Menu>
            </View>
          </Card.Content>
        </AppCard>

        <AppCard>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Preferences
            </Text>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
                Group type
              </Text>
              <ChoiceButtonGroup
                value={input.groupType}
                onValueChange={(value) => updateInput({ groupType: value })}
                options={GROUP_TYPE_OPTIONS}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
                Transport
              </Text>
              <SegmentedButtons
                value={input.transport}
                onValueChange={(value) => updateInput({ transport: value as TransportType })}
                buttons={[
                  { value: 'walk', label: 'Walk' },
                  { value: 'drive', label: 'Drive' },
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
                Budget
              </Text>
              <SegmentedButtons
                value={input.budget}
                onValueChange={(value) => updateInput({ budget: value as BudgetType })}
                buttons={[
                  { value: '$', label: '$' },
                  { value: '$$', label: '$$' },
                  { value: '$$$', label: '$$$' },
                ]}
              />
            </View>
          </Card.Content>
        </AppCard>

        <AppCard>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Stops
            </Text>

            <View style={styles.switchRow}>
              <Text style={{ color: theme.colors.onSurface }}>Feeling Lucky</Text>
              <Switch
                value={input.feelingLucky}
                onValueChange={(value) => updateInput({ feelingLucky: value })}
              />
            </View>

            {!input.feelingLucky ? (
              <>
                <View style={styles.chips}>
                  {STOP_TYPE_OPTIONS.map((option) => (
                    <Chip
                      key={option.id}
                      selected={input.preferences.interests.includes(option.id)}
                      onPress={() => toggleInterest(option.id)}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>

                {!hasSelectedStopTypes ? (
                  <Text variant="bodySmall" style={[styles.emptyHint, { color: theme.colors.error }]}>
                    Select at least one stop type or enable Feeling Lucky.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                Feeling Lucky will choose the stop types for you.
              </Text>
            )}

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
                Number of stops
              </Text>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <Chip
                    key={count}
                    selected={input.stopCount === count}
                    onPress={() => updateInput({ stopCount: count })}
                  >
                    {count}
                  </Chip>
                ))}
              </View>
            </View>
          </Card.Content>
        </AppCard>

        <AppCard>
          <Card.Content style={styles.section}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Trip settings
            </Text>

            <TextInput
              label="Avoid list (comma separated)"
              value={input.preferences.avoid.join(',')}
              onChangeText={(value) =>
                updatePreferences({
                  avoid: value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              mode="outlined"
            />

            <TextInput
              label="Must include"
              value={input.preferences.mustInclude}
              onChangeText={(value) => updatePreferences({ mustInclude: value })}
              mode="outlined"
            />

            <View style={styles.fieldGroup}>
              <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
                Max travel time between stops
              </Text>
              <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                {sliderLabel}
              </Text>

              <View style={styles.sliderRow}>
                <Text style={[styles.sliderMin, { color: theme.colors.onSurfaceVariant }]}>
                  {MIN_TRAVEL_MINUTES}
                </Text>
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
                    updatePreferences({
                      maxTravelMinutes: bounded,
                    });
                  }}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.onSurfaceVariant}
                  thumbTintColor={theme.colors.primary}
                />
                <Text style={[styles.sliderMax, { color: theme.colors.onSurfaceVariant }]}>
                  {MAX_TRAVEL_MINUTES}
                </Text>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={{ color: theme.colors.onSurface }}>Accessible-friendly</Text>
              <Switch
                value={input.preferences.accessibleFriendly}
                onValueChange={(value) =>
                  updatePreferences({
                    accessibleFriendly: value,
                  })
                }
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={{ color: theme.colors.onSurface }}>Return to start</Text>
              <Switch
                value={input.returnToStart}
                onValueChange={(value) => updateInput({ returnToStart: value })}
              />
            </View>
          </Card.Content>
        </AppCard>

        <PrimaryButton loading={loading} disabled={isSubmitDisabled} onPress={handleGenerate}>
          Generate Day Plan
        </PrimaryButton>

        {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
      </ScrollView>
    </AppScreen>
    <GenerationLoadingOverlay visible={loading} progress={loadingProgress} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeButton: {
    flex: 1,
  },
  timeMenuScroll: {
    maxHeight: 260,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {},
  emptyHint: {},
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderMin: {
    width: 22,
    textAlign: 'center',
  },
  sliderMax: {
    width: 32,
    textAlign: 'center',
  },
  error: {
    textAlign: 'center',
  },
});
