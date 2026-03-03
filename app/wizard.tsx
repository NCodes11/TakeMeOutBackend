import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Menu, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { AppCard, AppScreen, PrimaryButton } from '@/components/ui';
import { STOP_TYPE_OPTIONS, stopTypeLabel } from '@/constants/stopTypes';
import { useLocation } from '@/context/LocationContext';
import { usePlanStore } from '@/store/usePlanStore';
import { BudgetType, GroupType, StopType, TransportType, WizardInput } from '@/types/models';
import { palette, spacing } from '@/theme/appTheme';
import { END_TIME_OPTIONS, START_TIME_OPTIONS, snapEndTimeAfterStart } from '@/utils/time';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
    maxTravelMinutes: 30,
    accessibleFriendly: false,
  },
  startLocationMode: 'my-location',
  startAddress: '',
  returnToStart: true,
  stopCount: 3,
});

export default function WizardScreen() {
  const params = useLocalSearchParams<{ city?: string; originLat?: string; originLng?: string }>();
  const location = useLocation();
  const [input, setInput] = useState(defaultInput(params.city || ''));
  const createPlan = usePlanStore((s) => s.createPlan);
  const loading = usePlanStore((s) => s.loading);
  const error = usePlanStore((s) => s.error);

  /**
   * Slider state is kept separate from input so the slider stays smooth.
   */
  const [maxTravel, setMaxTravel] = useState<number>(input.preferences.maxTravelMinutes ?? 30);
  const [startMenuVisible, setStartMenuVisible] = useState(false);
  const [endMenuVisible, setEndMenuVisible] = useState(false);

  useEffect(() => {
    const lat = params.originLat ? Number(params.originLat) : undefined;
    const lng = params.originLng ? Number(params.originLng) : undefined;
    const hasLat = typeof lat === 'number' && Number.isFinite(lat);
    const hasLng = typeof lng === 'number' && Number.isFinite(lng);

    setInput((prev) => ({
      ...prev,
      city: params.city || prev.city,
      startLat: hasLat ? lat : prev.startLat,
      startLng: hasLng ? lng : prev.startLng,
    }));
  }, [params.city, params.originLat, params.originLng]);

  useEffect(() => {
    if (!location.coords) return;
    setInput((prev) => ({
      ...prev,
      city: location.placeLabel || prev.city,
      startLat: location.coords?.latitude ?? prev.startLat,
      startLng: location.coords?.longitude ?? prev.startLng,
    }));
  }, [location.coords, location.placeLabel]);

  useEffect(() => {
    const v = typeof input.preferences.maxTravelMinutes === 'number' ? input.preferences.maxTravelMinutes : 30;
    setMaxTravel(v);
  }, [input.preferences.maxTravelMinutes]);

  const toggleInterest = (name: string) =>
    setInput((p) => {
      const interests = p.preferences.interests.includes(name)
        ? p.preferences.interests.filter((i) => i !== name)
        : [...p.preferences.interests, name];

      console.log('[plan] selected_stop_types', interests.map((type) => stopTypeLabel(type as StopType)));

      return {
        ...p,
        preferences: {
          ...p.preferences,
          interests,
        },
      };
    });

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

  return (
    <AppScreen title="Take Me Out" subtitle="Fine-tune your real-world plan before generating stops.">
      <AppCard>
        <Card.Content style={styles.content}>
          <TextInput label="City" value={input.city} onChangeText={(v) => setInput({ ...input, city: v })} mode="outlined" />
          <Text variant="bodySmall" style={styles.helperText}>
            Tip: use `City,ST` for best location matching.
          </Text>

          <TextInput label="Date" value={input.date} onChangeText={(v) => setInput({ ...input, date: v })} mode="outlined" />

          <View style={styles.row}>
            <Menu
              visible={startMenuVisible}
              onDismiss={() => setStartMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setStartMenuVisible(true)}
                  contentStyle={styles.timeButtonContent}
                  style={styles.timeButton}
                >
                  Start: {input.startTime}
                </Button>
              }
            >
              <ScrollView style={styles.timeMenuScroll}>
                {START_TIME_OPTIONS.map((option) => (
                  <Menu.Item key={option} onPress={() => onSelectStartTime(option)} title={option} />
                ))}
              </ScrollView>
            </Menu>

            <Menu
              visible={endMenuVisible}
              onDismiss={() => setEndMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setEndMenuVisible(true)}
                  contentStyle={styles.timeButtonContent}
                  style={styles.timeButton}
                >
                  End: {input.endTime}
                </Button>
              }
            >
              <ScrollView style={styles.timeMenuScroll}>
                {END_TIME_OPTIONS.map((option) => (
                  <Menu.Item key={option} onPress={() => onSelectEndTime(option)} title={option} />
                ))}
              </ScrollView>
            </Menu>
          </View>

          <Text variant="bodySmall" style={styles.helperText}>
            Times use 24h format in 15-minute increments.
          </Text>

          <SegmentedButtons
            value={input.groupType}
            onValueChange={(v) => setInput({ ...input, groupType: v as GroupType })}
            buttons={[
              { value: 'Date', label: 'Date' },
              { value: 'Family', label: 'Family' },
              { value: 'Friends', label: 'Friends' },
            ]}
          />

          <SegmentedButtons
            value={input.transport}
            onValueChange={(v) => setInput({ ...input, transport: v as TransportType })}
            buttons={[
              { value: 'walk', label: 'Walk' },
              { value: 'drive', label: 'Drive' },
            ]}
          />

          <SegmentedButtons
            value={input.budget}
            onValueChange={(v) => setInput({ ...input, budget: v as BudgetType })}
            buttons={[
              { value: '$', label: '$' },
              { value: '$$', label: '$$' },
              { value: '$$$', label: '$$$' },
            ]}
          />

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Stop types
          </Text>
          <Text variant="bodySmall" style={styles.helperText}>
            Choose where your plan should go, or turn on Feeling Lucky to auto-pick a balanced day.
          </Text>

          <View style={styles.switchRow}>
            <Text>Feeling Lucky</Text>
            <Switch value={input.feelingLucky} onValueChange={(v) => setInput((prev) => ({ ...prev, feelingLucky: v }))} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STOP_TYPE_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                selected={input.preferences.interests.includes(option.id)}
                onPress={() => toggleInterest(option.id)}
              >
                {option.label}
              </Chip>
            ))}
          </ScrollView>

          {input.preferences.interests.length === 0 && !input.feelingLucky ? (
            <Text variant="bodySmall" style={styles.emptyHint}>
              Select at least one stop type or enable Feeling Lucky.
            </Text>
          ) : null}

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Number of Stops
          </Text>
          <Text variant="bodySmall" style={styles.helperText}>
            Select between 1 and 8 stops.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
              <Chip key={count} selected={input.stopCount === count} onPress={() => setInput((prev) => ({ ...prev, stopCount: count }))}>
                {count}
              </Chip>
            ))}
          </ScrollView>

          <TextInput
            label="Avoid list (comma separated)"
            value={input.preferences.avoid.join(',')}
            onChangeText={(v) =>
              setInput({
                ...input,
                preferences: {
                  ...input.preferences,
                  avoid: v
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
              })
            }
            mode="outlined"
          />

          <TextInput
            label="Must include"
            value={input.preferences.mustInclude}
            onChangeText={(v) =>
              setInput({
                ...input,
                preferences: { ...input.preferences, mustInclude: v },
              })
            }
            mode="outlined"
          />

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Max travel time between stops
          </Text>
          <Text variant="bodySmall" style={styles.helperText}>
            {sliderLabel}
          </Text>

          <View style={styles.sliderRow}>
            <Text style={styles.sliderMin}>5</Text>
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={5}
              maximumValue={90}
              step={5}
              value={clamp(maxTravel, 5, 90)}
              onValueChange={(v) => setMaxTravel(v)}
              onSlidingComplete={(v) => {
                const bounded = clamp(v, 5, 180);
                setMaxTravel(bounded);
                setInput((prev) => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    maxTravelMinutes: bounded,
                  },
                }));
              }}
              minimumTrackTintColor={palette.primary}
              maximumTrackTintColor={palette.muted}
              thumbTintColor={palette.primary}
            />
            <Text style={styles.sliderMax}>90</Text>
          </View>

          <View style={styles.switchRow}>
            <Text>Accessible-friendly</Text>
            <Switch
              value={input.preferences.accessibleFriendly}
              onValueChange={(v) => setInput({ ...input, preferences: { ...input.preferences, accessibleFriendly: v } })}
            />
          </View>

          <View style={styles.switchRow}>
            <Text>Return to start</Text>
            <Switch value={input.returnToStart} onValueChange={(v) => setInput({ ...input, returnToStart: v })} />
          </View>

          <PrimaryButton
            loading={loading}
            disabled={loading || !input.city.trim() || (!input.feelingLucky && input.preferences.interests.length === 0)}
            onPress={async () => {
              const fresh = await location
                .refreshLocation()
                .catch(() => ({ coords: location.coords, placeLabel: location.placeLabel }));

              const lat = fresh.coords?.latitude ?? input.startLat;
              const lng = fresh.coords?.longitude ?? input.startLng;
              const city = fresh.placeLabel || input.city;

              const payload: WizardInput = {
                ...input,
                city,
                startLat: lat,
                startLng: lng,
                preferences: {
                  ...input.preferences,
                  maxTravelMinutes: clamp(maxTravel, 5, 180),
                },
              };

              console.log('[plan] wizard_submit', {
                city,
                origin: { lat, lng },
                stopCount: payload.stopCount,
                selectedTypes: payload.preferences.interests,
                maxTravelMinutes: payload.preferences.maxTravelMinutes,
              });

              const id = await createPlan(payload);
              router.replace(`/generated/${id}`);
            }}
          >
            Generate Day Plan
          </PrimaryButton>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </Card.Content>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
  helperText: {
    color: palette.muted,
    marginTop: -spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeButton: {
    flex: 1,
  },
  timeButtonContent: {
    justifyContent: 'flex-start',
    height: 48,
  },
  timeMenuScroll: {
    maxHeight: 260,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: palette.danger,
    marginTop: spacing.xs,
  },
  emptyHint: {
    color: palette.danger,
    marginTop: -spacing.xs,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sliderMin: {
    width: 22,
    textAlign: 'center',
    color: palette.muted,
  },
  sliderMax: {
    width: 32,
    textAlign: 'center',
    color: palette.muted,
  },
});
