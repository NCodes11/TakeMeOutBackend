import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getFeatureRequests, getTripFeedback } from '@/db/sqlite';
import { Plan, Stop } from '@/types/models';

export const planCode = (plan: Plan) => `${plan.city.slice(0, 3).toUpperCase()}-${plan.date.replaceAll('-', '')}-${plan.id.slice(0, 4).toUpperCase()}`;

export const shareJson = async (plan: Plan, stops: Stop[]) => {
  const data = JSON.stringify({ plan, stops }, null, 2);
  const uri = `${FileSystem.cacheDirectory}${plan.id}.json`;
  await FileSystem.writeAsStringAsync(uri, data);
  await Sharing.shareAsync(uri);
};

export const exportIcs = async (plan: Plan, stops: Stop[]) => {
  const events = stops
    .map((s) => {
      const start = `${plan.date.replaceAll('-', '')}T${s.startTime.replace(':', '')}00`;
      const end = `${plan.date.replaceAll('-', '')}T${s.endTime.replace(':', '')}00`;
      return `BEGIN:VEVENT\nUID:${s.id}\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${s.name}\nLOCATION:${s.address}\nDESCRIPTION:${s.why}\nEND:VEVENT`;
    })
    .join('\n');

  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DayDate//EN\n${events}\nEND:VCALENDAR`;
  const uri = `${FileSystem.cacheDirectory}${plan.id}.ics`;
  await FileSystem.writeAsStringAsync(uri, ics);
  await Sharing.shareAsync(uri);
};

export const exportFeedbackJson = async () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    tripFeedback: getTripFeedback(),
    featureRequests: getFeatureRequests(),
  };
  const uri = `${FileSystem.cacheDirectory}feedback-export.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(uri);
};
