import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { INTERESTS } from '@/constants/interests';
import { usePlanStore } from '@/store/usePlanStore';
import { WizardInput } from '@/types/models';

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
    interests: ['Food', 'Scenic views'],
    avoid: [],
    mustInclude: '',
    maxTravelMinutes: 30,
    kidFriendly: false,
    accessibleFriendly: false,
  },
  startLocationMode: 'my-location',
  startAddress: '',
  returnToStart: true,
});

export default function WizardScreen() {
  const params = useLocalSearchParams<{ city?: string }>();
  const [input, setInput] = useState(defaultInput(params.city || 'San Francisco'));
  const createPlan = usePlanStore((s) => s.createPlan);
  const loading = usePlanStore((s) => s.loading);

  const toggleInterest = (name: string) =>
    setInput((p) => ({
      ...p,
      preferences: {
        ...p.preferences,
        interests: p.preferences.interests.includes(name)
          ? p.preferences.interests.filter((i) => i !== name)
          : [...p.preferences.interests, name],
      },
    }));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TextInput label="City" value={input.city} onChangeText={(v) => setInput({ ...input, city: v })} mode="outlined" />
      <TextInput label="Date" value={input.date} onChangeText={(v) => setInput({ ...input, date: v })} mode="outlined" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={{ flex: 1 }} label="Start" value={input.startTime} onChangeText={(v) => setInput({ ...input, startTime: v })} mode="outlined" />
        <TextInput style={{ flex: 1 }} label="End" value={input.endTime} onChangeText={(v) => setInput({ ...input, endTime: v })} mode="outlined" />
      </View>
      <SegmentedButtons
        value={input.groupType}
        onValueChange={(v) => setInput({ ...input, groupType: v as any })}
        buttons={[{ value: 'Date', label: 'Date' }, { value: 'Family', label: 'Family' }, { value: 'Friends', label: 'Friends' }]}
      />
      <SegmentedButtons
        value={input.transport}
        onValueChange={(v) => setInput({ ...input, transport: v as any })}
        buttons={[{ value: 'walk', label: 'Walk' }, { value: 'drive', label: 'Drive' }]}
      />
      <SegmentedButtons
        value={input.pace}
        onValueChange={(v) => setInput({ ...input, pace: v as any })}
        buttons={[{ value: 'relaxed', label: 'Relaxed' }, { value: 'balanced', label: 'Balanced' }, { value: 'packed', label: 'Packed' }]}
      />
      <SegmentedButtons
        value={input.budget}
        onValueChange={(v) => setInput({ ...input, budget: v as any })}
        buttons={[{ value: '$', label: '$' }, { value: '$$', label: '$$' }, { value: '$$$', label: '$$$' }]}
      />
      <Text>Interests</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {INTERESTS.map((i) => <Chip key={i} selected={input.preferences.interests.includes(i)} onPress={() => toggleInterest(i)}>{i}</Chip>)}
      </View>
      <TextInput
        label="Avoid list (comma separated)"
        value={input.preferences.avoid.join(',')}
        onChangeText={(v) => setInput({ ...input, preferences: { ...input.preferences, avoid: v.split(',').map((x) => x.trim()).filter(Boolean) } })}
        mode="outlined"
      />
      <TextInput label="Must include" value={input.preferences.mustInclude} onChangeText={(v) => setInput({ ...input, preferences: { ...input.preferences, mustInclude: v } })} mode="outlined" />
      <TextInput label="Max travel mins between stops" value={String(input.preferences.maxTravelMinutes)} onChangeText={(v) => setInput({ ...input, preferences: { ...input.preferences, maxTravelMinutes: Number(v) || 30 } })} mode="outlined" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Kid-friendly</Text><Switch value={input.preferences.kidFriendly} onValueChange={(v) => setInput({ ...input, preferences: { ...input.preferences, kidFriendly: v } })} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Accessible-friendly</Text><Switch value={input.preferences.accessibleFriendly} onValueChange={(v) => setInput({ ...input, preferences: { ...input.preferences, accessibleFriendly: v } })} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Return to start</Text><Switch value={input.returnToStart} onValueChange={(v) => setInput({ ...input, returnToStart: v })} /></View>
      <Button
        mode="contained"
        loading={loading}
        onPress={async () => {
          const id = await createPlan(input);
          router.replace(`/generated/${id}`);
        }}
      >
        Generate Day Plan
      </Button>
    </ScrollView>
  );
}
