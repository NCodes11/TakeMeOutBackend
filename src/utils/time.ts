const MINUTES_PER_DAY = 24 * 60;
const STEP_MINUTES = 15;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_12H_REGEX = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;

export type TimeFormat = '12h' | '24h';

const pad = (value: number) => String(value).padStart(2, '0');

export const minutesToTime = (minutes: number) => {
  const normalized = Math.max(0, Math.min(MINUTES_PER_DAY - STEP_MINUTES, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${pad(h)}:${pad(m)}`;
};

export const parseTimeToMinutes = (time: string): number => {
  const match = TIME_24H_REGEX.exec(time.trim());
  if (!match) return Number.NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h * 60 + m;
};

export const formatTimeDisplay = (time24h: string, timeFormat: TimeFormat): string => {
  if (timeFormat === '24h') return time24h;
  const minutes = parseTimeToMinutes(time24h);
  if (!Number.isFinite(minutes)) return time24h;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad(mins)} ${suffix}`;
};

/** Compact display for tight layouts: "9:00a" / "8:30p" in 12h mode, unchanged in 24h mode. */
export const formatTimeCompact = (time24h: string, timeFormat: TimeFormat): string => {
  if (timeFormat === '24h') return time24h;
  const display = formatTimeDisplay(time24h, timeFormat);
  return display.replace(/ AM$/, 'a').replace(/ PM$/, 'p');
};

export const parseTimeDisplayTo24h = (displayTime: string, timeFormat: TimeFormat): string => {
  const normalized = displayTime.trim();
  if (timeFormat === '24h') {
    return TIME_24H_REGEX.test(normalized) ? normalized : '';
  }
  const match = TIME_12H_REGEX.exec(normalized);
  if (!match) return '';
  const hours12 = Number(match[1]);
  const mins = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  const hours24 = (hours12 % 12) + (meridiem === 'PM' ? 12 : 0);
  return `${pad(hours24)}:${pad(mins)}`;
};

export const TIME_OPTIONS: string[] = Array.from(
  { length: MINUTES_PER_DAY / STEP_MINUTES },
  (_, index) => minutesToTime(index * STEP_MINUTES),
);

export const isEndAfterStart = (startTime: string, endTime: string) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end > start;
};

export const snapEndTimeAfterStart = (startTime: string, currentEndTime: string) => {
  if (isEndAfterStart(startTime, currentEndTime)) return currentEndTime;

  const startIndex = TIME_OPTIONS.indexOf(startTime);
  if (startIndex < 0) return '09:15';

  const snappedIndex = Math.min(TIME_OPTIONS.length - 1, startIndex + 1);
  return TIME_OPTIONS[snappedIndex];
};

export const START_TIME_OPTIONS = TIME_OPTIONS.slice(0, -1);
export const END_TIME_OPTIONS = TIME_OPTIONS.slice(1);
