import { RouteMap } from '@/components/RouteMap';
import { StopCard } from '@/components/StopCard';
import { usePlanStore } from '@/store/usePlanStore';
import { exportIcs, planCode, shareJson } from '@/utils/share';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { useState } from 'react';

export default function GeneratedPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plans = usePlanStore((s) => s.plans);
  const lockStop = usePlanStore((s) => s.lockStop);
  const stops = usePlanStore((s) => s.stopsByPlan[id] || []);
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const plan = plans.find((p) => p.id === id);
  if (!plan) return <Text>Plan not found</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <SegmentedButtons
        value={view}
        onValueChange={(v) => setView(v as any)}
        buttons={[{ value: 'timeline', label: 'Timeline' }, { value: 'list', label: 'List' }]}
      />
      <RouteMap stops={stops} />
      {stops.map((s) => (
        <StopCard key={s.id} stop={s} onLock={() => lockStop(id, s.id, s.locked !== 1)} />
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button mode="outlined" onPress={() => router.push(`/plan/${id}`)}>Plan detail</Button>
        <Button mode="outlined" onPress={() => router.push(`/today/${id}`)}>Today mode</Button>
        <Button mode="outlined" onPress={() => shareJson(plan, stops)}>Share JSON</Button>
        <Button mode="outlined" onPress={() => exportIcs(plan, stops)}>Export .ics</Button>
      </View>
      <Text>Plan code: {planCode(plan)}</Text>
      <QRCode value={JSON.stringify({ planId: plan.id, code: planCode(plan) })} size={140} />
    </ScrollView>
  );
}
