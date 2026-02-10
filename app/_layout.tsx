import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { usePlanStore } from '@/store/usePlanStore';

export default function RootLayout() {
  const boot = usePlanStore((s) => s.boot);
  useEffect(() => {
    boot();
  }, [boot]);

  return (
    <PaperProvider>
      <Stack screenOptions={{ headerTintColor: '#111827', contentStyle: { backgroundColor: '#f8fafc' } }}>
        <Stack.Screen name="index" options={{ title: 'DayDate' }} />
        <Stack.Screen name="wizard" options={{ title: 'Plan Wizard' }} />
        <Stack.Screen name="generated/[id]" options={{ title: 'Generated Plan' }} />
        <Stack.Screen name="plan/[id]" options={{ title: 'Plan Detail' }} />
        <Stack.Screen name="today/[id]" options={{ title: 'Today Mode' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved Plans' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </PaperProvider>
  );
}
