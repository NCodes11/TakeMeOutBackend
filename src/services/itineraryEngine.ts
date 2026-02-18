import { PlaceCandidate, StopType, TransportType, WizardInput } from '@/types/models';
import { budgetScoreAdjustment, resolvePlaceTier } from '@/utils/priceTier';

type Minutes = number;

interface StopTypeRule {
  maxDefault: number;
  repeatWeight: number;
  importance: number;
}

interface DurationRule {
  min: Minutes;
  max: Minutes;
  weight: number;
}

const TYPE_RULES: Record<StopType, StopTypeRule> = {
  coffee: { maxDefault: 1, repeatWeight: 1, importance: 2 },
  restaurant: { maxDefault: 1, repeatWeight: 2, importance: 6 },
  bar: { maxDefault: 1, repeatWeight: 2, importance: 1 },
  dessert: { maxDefault: 1, repeatWeight: 2, importance: 3 },
  activity: { maxDefault: 1, repeatWeight: 4, importance: 5 },
  attraction: { maxDefault: 1, repeatWeight: 4, importance: 5 },
  outdoors: { maxDefault: 1, repeatWeight: 3, importance: 5 },
  shopping: { maxDefault: Number.POSITIVE_INFINITY, repeatWeight: 5, importance: 4 },
  arts: { maxDefault: 1, repeatWeight: 4, importance: 5 },
};

const NO_REPEAT_ADJACENT = new Set<StopType>([
  'coffee',
  'restaurant',
  'bar',
  'dessert',
  'activity',
  'attraction',
  'outdoors',
  'arts',
]);

const DURATION_RULES: Record<StopType, DurationRule> = {
  coffee: { min: 15, max: 35, weight: 1 },
  dessert: { min: 20, max: 45, weight: 1.2 },
  bar: { min: 30, max: 75, weight: 1.5 },
  restaurant: { min: 60, max: 110, weight: 2.5 },
  shopping: { min: 45, max: 120, weight: 2.0 },
  outdoors: { min: 60, max: 150, weight: 3.0 },
  arts: { min: 60, max: 150, weight: 3.0 },
  activity: { min: 75, max: 180, weight: 3.5 },
  attraction: { min: 75, max: 180, weight: 3.5 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const estimatedSpeedKmh = (transport: TransportType) => (transport === 'walk' ? 4.5 : 35);

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const deterministicIndex = (seed: string, size: number) => {
  if (size <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % size;
};

/**
 * Distributes stop types across the requested stop count.
 */
export const buildStopAllocation = (selectedTypes: StopType[], numberOfStops: number): StopType[] => {
  const uniqueTypes = Array.from(new Set(selectedTypes));
  const target = Math.max(1, numberOfStops);

  if (uniqueTypes.length === 0) return [];
  if (uniqueTypes.length === 1) return Array.from({ length: target }, () => uniqueTypes[0]);

  const sortedByImportance = [...uniqueTypes].sort(
    (a, b) => TYPE_RULES[b].importance - TYPE_RULES[a].importance,
  );

  const selected = target < uniqueTypes.length ? sortedByImportance.slice(0, target) : sortedByImportance;
  const counts = new Map<StopType, number>(selected.map((type) => [type, 1]));
  const allocation = [...selected];

  // First pass: fill remaining slots without violating default per-type caps.
  while (allocation.length < target) {
    const expandable = selected
      .filter((type) => (counts.get(type) || 0) < TYPE_RULES[type].maxDefault)
      .sort((a, b) => TYPE_RULES[b].repeatWeight - TYPE_RULES[a].repeatWeight);

    if (expandable.length === 0) break;

    const next = expandable[0];
    allocation.push(next);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  // Second pass: if still short, allow repeats by repeatWeight priority.
  while (allocation.length < target) {
    const sortedByRepeat = [...selected].sort(
      (a, b) => TYPE_RULES[b].repeatWeight - TYPE_RULES[a].repeatWeight,
    );
    const next = sortedByRepeat[0];
    allocation.push(next);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  return allocation.slice(0, target);
};

/**
 * Orders stop types into a logical day structure.
 */
export const orderAllocation = (
  allocationTokens: StopType[],
  startTime: string,
  endTime: string,
): StopType[] => {
  const tokens = [...allocationTokens];
  if (tokens.length <= 1) return tokens;

  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  const total = Math.max(1, end - start);
  const startsLate = start >= 12 * 60;

  const preferredPosition = (type: StopType) => {
    if (type === 'coffee') return 0;
    if (type === 'restaurant') return Math.floor(total * 0.5);
    if (type === 'bar') return total - 1;
    if (type === 'outdoors') return startsLate ? Math.floor(total * 0.75) : Math.floor(total * 0.35);
    return Math.floor(total * 0.6);
  };

  const ordered = tokens
    .map((type, index) => ({ type, index, pref: preferredPosition(type) }))
    .sort((a, b) => a.pref - b.pref || a.index - b.index)
    .map((item) => item.type);

  return enforceCapsAndAdjacency(ordered);
};

export const enforceCapsAndAdjacency = (tokens: StopType[]): StopType[] => {
  if (tokens.length <= 1) return tokens;

  const output = [...tokens];

  // Swap forward duplicates with later alternatives where possible.
  for (let i = 1; i < output.length; i += 1) {
    const current = output[i];
    const prev = output[i - 1];

    if (current !== prev) continue;
    if (!NO_REPEAT_ADJACENT.has(current)) continue;

    for (let j = i + 1; j < output.length; j += 1) {
      if (output[j] !== current) {
        const tmp = output[i];
        output[i] = output[j];
        output[j] = tmp;
        break;
      }
    }
  }

  return output;
};

interface SelectionContext {
  token: StopType;
  tokenIndex: number;
  seed: string;
  candidates: PlaceCandidate[];
  selected: PlaceCandidate[];
  input: WizardInput;
}

/**
 * Scores candidates and deterministically selects one from the top results.
 */
export const selectPlaceForToken = ({
  token,
  tokenIndex,
  seed,
  candidates,
  selected,
  input,
}: SelectionContext): PlaceCandidate | null => {
  if (candidates.length === 0) return null;

  const prev = selected[selected.length - 1];
  const maxTravel = Math.max(5, input.preferences.maxTravelMinutes || 30);

  // Rank by type match, quality signals, budget fit, and travel-time feasibility.
  const ranked = candidates
    .map((candidate) => {
      let score = 10;

      score += candidate.stopType === token ? 8 : -6;
      score += (candidate.rating || 0) * 1.5;

      const placeTier = resolvePlaceTier(candidate.priceLevel, candidate.costLevel);
      const budgetScore = budgetScoreAdjustment(placeTier, input.budget);
      if (budgetScore <= -900) return { candidate, score: -999 };
      score += budgetScore;

      if (candidate.openNow) score += 2;

      if (prev) {
        const dist = haversineKm(prev.lat, prev.lng, candidate.lat, candidate.lng);
        const eta = (dist / estimatedSpeedKmh(input.transport)) * 60;
        if (eta > maxTravel) return { candidate, score: -999 };
        score += Math.max(0, 3 - eta / 10);
      }

      return { candidate, score };
    })
    .filter((entry) => entry.score > -900)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;

  const top = ranked.slice(0, Math.min(3, ranked.length));
  const pickIndex = deterministicIndex(`${seed}-${token}-${tokenIndex}`, top.length);

  return top[pickIndex].candidate;
};

export interface ScheduledStop extends PlaceCandidate {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  travelMinutesFromPrev: number;
}

/**
 * Builds a time-based schedule that never exceeds the time window.
 * If travel or minimum durations do not fit, stops are reduced and durations shrink proportionally.
 */
export const scheduleItinerary = (
  orderedStops: PlaceCandidate[],
  input: WizardInput,
  startTime: string,
  endTime: string,
): ScheduledStop[] => {
  if (orderedStops.length === 0) return [];

  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  const totalWindow = Math.max(0, end - start);
  if (totalWindow <= 0) return [];

  const maxTravel = Math.max(5, input.preferences.maxTravelMinutes || 30);

  // Travel is derived from straight-line distance and capped by maxTravelMinutes.
  const computeTravel = (stops: PlaceCandidate[]) =>
    stops.map((_, i) => {
      if (i === 0) return 0;
      const prev = stops[i - 1];
      const curr = stops[i];
      const dist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
      const eta = (dist / estimatedSpeedKmh(input.transport)) * 60;
      return clamp(Math.round(eta), 0, maxTravel);
    });

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  let stops = [...orderedStops];
  let travel = computeTravel(stops);

  // Trim tail stops until at least some stop-time fits inside the time window.
  while (stops.length > 1 && sum(travel) >= totalWindow) {
    stops = stops.slice(0, -1);
    travel = computeTravel(stops);
  }

  const totalTravel = sum(travel);
  const usable = Math.max(0, totalWindow - totalTravel);

  if (stops.length === 1 && usable === 0) {
    return [
      {
        ...stops[0],
        travelMinutesFromPrev: 0,
        durationMinutes: totalWindow,
        startTime,
        endTime,
      },
    ];
  }

  if (usable <= 0) return [];

  const rules = stops.map(
    (s) => DURATION_RULES[s.stopType] ?? { min: 20, max: 90, weight: 1.5 },
  );

  const weights = rules.map((r) => r.weight);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const minSum = rules.reduce((sum, r) => sum + r.min, 0);

  const effectiveMins =
    minSum <= usable
      ? rules.map((r) => r.min)
      : rules.map((r) => Math.floor((r.min / minSum) * usable));

  let durations = stops.map((_, i) => {
    const target = Math.round((usable * weights[i]) / weightSum);
    return clamp(target, effectiveMins[i], rules[i].max);
  });

  const normalize = (targetTotal: number) => {
    // Rebalance durations so total exactly matches available minutes.
    for (let pass = 0; pass < 10; pass += 1) {
      const current = sum(durations);
      let diff = targetTotal - current;
      if (diff === 0) return;

      for (let i = 0; i < durations.length && diff !== 0; i += 1) {
        if (diff > 0) {
          const roomUp = rules[i].max - durations[i];
          const give = Math.min(roomUp, diff);
          durations[i] += give;
          diff -= give;
        } else {
          const roomDown = durations[i] - effectiveMins[i];
          const take = Math.min(roomDown, Math.abs(diff));
          durations[i] -= take;
          diff += take;
        }
      }
    }
  };

  normalize(usable);

  let cursor = start;
  const scheduled: ScheduledStop[] = [];

  for (let i = 0; i < stops.length; i += 1) {
    cursor += travel[i];
    if (cursor >= end) break;

    const stopStart = cursor;
    const stopEnd = Math.min(end, stopStart + durations[i]);
    const durationMinutes = Math.max(0, stopEnd - stopStart);

    scheduled.push({
      ...stops[i],
      travelMinutesFromPrev: travel[i],
      durationMinutes,
      startTime: minutesToTime(stopStart),
      endTime: minutesToTime(stopEnd),
    });

    cursor = stopEnd;
  }

  return scheduled;
};
