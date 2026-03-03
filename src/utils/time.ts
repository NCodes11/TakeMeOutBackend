const MINUTES_PER_DAY = 24 * 60;
const STEP_MINUTES = 15;

const pad = (value: number) => String(value).padStart(2, '0');

export const minutesToTime = (minutes: number) => {
  const normalized = Math.max(0, Math.min(MINUTES_PER_DAY - STEP_MINUTES, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${pad(h)}:${pad(m)}`;
};

export const parseTimeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN;
  return h * 60 + m;
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
