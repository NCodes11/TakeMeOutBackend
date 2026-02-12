import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { AppCard, AppScreen, PrimaryButton } from '@/components/ui';
import { STOP_TYPE_OPTIONS, stopTypeLabel } from '@/constants/stopTypes';
import { useLocation } from '@/context/LocationContext';
import { usePlanStore } from '@/store/usePlanStore';
import { BudgetType, GroupType, PaceType, StopType, TransportType, WizardInput } from '@/types/models';
import { palette, spacing } from '@/theme/appTheme';

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
  pace: 'balanced',
  budget: '$$',
  preferences: {
    interests: ['coffee', 'activity', 'outdoors'],
    avoid: [],
    mustInclude: '',
    maxTravelMinutes: 30,
    kidFriendly: false,
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
    if (location.mode !== 'live' || !location.coords) return;
    setInput((prev) => ({
      ...prev,
      city: location.placeLabel || prev.city,
      startLat: location.coords?.latitude ?? prev.startLat,
      startLng: location.coords?.longitude ?? prev.startLng,
    }));
  }, [location.coords, location.mode, location.placeLabel]);

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

  return (
    <AppScreen title="Take Me Out" subtitle="Fine-tune your real-world plan before generating stops.">
      <AppCard>
        <Card.Content style={styles.content}>
      <TextInput label="City" value={input.city} onChangeText={(v) => setInput({ ...input, city: v })} mode="outlined" />
      <Text variant="bodySmall" style={styles.helperText}>Tip: use `City,ST` for best location matching.</Text>
      <TextInput label="Date" value={input.date} onChangeText={(v) => setInput({ ...input, date: v })} mode="outlined" />
      <View style={styles.row}>
        <TextInput style={{ flex: 1 }} label="Start" value={input.startTime} onChangeText={(v) => setInput({ ...input, startTime: v })} mode="outlined" />
        <TextInput style={{ flex: 1 }} label="End" value={input.endTime} onChangeText={(v) => setInput({ ...input, endTime: v })} mode="outlined" />
      </View>
      <SegmentedButtons
        value={input.groupType}
        onValueChange={(v) => setInput({ ...input, groupType: v as GroupType })}
        buttons={[{ value: 'Date', label: 'Date' }, { value: 'Family', label: 'Family' }, { value: 'Friends', label: 'Friends' }]}
      />
      <SegmentedButtons
        value={input.transport}
        onValueChange={(v) => setInput({ ...input, transport: v as TransportType })}
        buttons={[{ value: 'walk', label: 'Walk' }, { value: 'drive', label: 'Drive' }]}
      />
      <SegmentedButtons
        value={input.pace}
        onValueChange={(v) => setInput({ ...input, pace: v as PaceType })}
        buttons={[{ value: 'relaxed', label: 'Relaxed' }, { value: 'balanced', label: 'Balanced' }, { value: 'packed', label: 'Packed' }]}
      />
      <SegmentedButtons
        value={input.budget}
        onValueChange={(v) => setInput({ ...input, budget: v as BudgetType })}
        buttons={[{ value: '$', label: '$' }, { value: '$$', label: '$$' }, { value: '$$$', label: '$$$' }]}
      />
      <Text variant="titleSmall" style={styles.sectionTitle}>Stop types</Text>
      <Text variant="bodySmall" style={styles.helperText}>Choose where your plan should go. Restaurants appear only if selected.</Text>
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
      <Text variant="titleSmall" style={styles.sectionTitle}>Number of Stops</Text>
      <Text variant="bodySmall" style={styles.helperText}>Select between 1 and 6 stops.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[1, 2, 3, 4, 5, 6].map((count) => (
          <Chip
            key={count}
            selected={input.stopCount === count}
            onPress={() => setInput((prev) => ({ ...prev, stopCount: count }))}
          >
            {count}
          </Chip>
        ))}
      </ScrollView>
      <TextInput
        label="Avoid list (comma separated)"
        value={input.preferences.avoid.join(',')}
        onChangeText={(v) => setInput({ ...input, preferences: { ...input.preferences, avoid: v.split(',').map((x) => x.trim()).filter(Boolean) } })}
        mode="outlined"
      />
      <TextInput label="Must include" value={input.preferences.mustInclude} onChangeText={(v) => setInput({ ...input, preferences: { ...input.preferences, mustInclude: v } })} mode="outlined" />
      <TextInput label="Max travel mins between stops" value={String(input.preferences.maxTravelMinutes)} onChangeText={(v) => setInput({ ...input, preferences: { ...input.preferences, maxTravelMinutes: Number(v) || 30 } })} mode="outlined" />
      <View style={styles.switchRow}><Text>Kid-friendly</Text><Switch value={input.preferences.kidFriendly} onValueChange={(v) => setInput({ ...input, preferences: { ...input.preferences, kidFriendly: v } })} /></View>
      <View style={styles.switchRow}><Text>Accessible-friendly</Text><Switch value={input.preferences.accessibleFriendly} onValueChange={(v) => setInput({ ...input, preferences: { ...input.preferences, accessibleFriendly: v } })} /></View>
      <View style={styles.switchRow}><Text>Return to start</Text><Switch value={input.returnToStart} onValueChange={(v) => setInput({ ...input, returnToStart: v })} /></View>
      <PrimaryButton
        loading={loading}
        disabled={loading || !input.city.trim() || input.preferences.interests.length === 0}
        onPress={async () => {
          console.log('[plan] wizard_submit', {
            city: input.city,
            origin: { lat: input.startLat, lng: input.startLng },
            stopCount: input.stopCount,
            selectedTypes: input.preferences.interests,
          });
          const id = await createPlan(input);
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
});
