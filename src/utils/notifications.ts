import * as Notifications from 'expo-notifications';
import { Stop } from '@/types/models';

export const requestNotificationPermissions = async () => {
  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) await Notifications.requestPermissionsAsync();
};

export const scheduleLeaveNowReminders = async (stops: Stop[]) => {
  for (const stop of stops) {
    const [h, m] = stop.startTime.split(':').map(Number);
    const trigger = new Date();
    trigger.setHours(h, Math.max(0, m - 15), 0, 0);
    if (trigger.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DayDate reminder',
        body: `Leave soon for ${stop.name} (${stop.etaMin || 10} min away).`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
  }
};
