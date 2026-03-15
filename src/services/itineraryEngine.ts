import { PlaceCandidate, StopType, TransportType, WizardInput, GroupType } from '@/types/models';
import { RouteLeg, RoutingProvider } from '@/providers/routingProvider';
import { budgetScoreAdjustment, resolvePlaceTier } from '@/utils/priceTier';
import {
  getExplicitSelectedStopTypes,
  getSoloPreferredPosition,
  getSoloSuitabilityScore,
  SOLO_STOP_TYPE_RULE_OVERRIDES,
} from './soloSuitability';

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

const getTypeRule = (type: StopType, groupType: GroupType = 'Date'): StopTypeRule => {
  const base = TYPE_RULES[type];
  if (groupType !== 'Solo') return base;

  return {
    ...base,
    ...SOLO_STOP_TYPE_RULE_OVERRIDES[type],
  };
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
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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
 * Allocates stop types across the requested number of slots using importance
 * and repeat weights so the itinerary has a balanced structure.
 */
export const buildStopAllocation = (
  selectedTypes: StopType[],
  numberOfStops: number,
  groupType: GroupType = 'Date',
): StopType[] => {
  const uniqueTypes = Array.from(new Set(selectedTypes));
  const target = Math.max(1, numberOfStops);

  if (uniqueTypes.length === 0) return [];
  if (uniqueTypes.length === 1) return Array.from({ length: target }, () => uniqueTypes[0]);

  const sortedByImportance = [...uniqueTypes].sort(
    (a, b) => getTypeRule(b, groupType).importance - getTypeRule(a, groupType).importance,
  );

  const selected = target < uniqueTypes.length ? sortedByImportance.slice(0, target) : sortedByImportance;
  const counts = new Map<StopType, number>(selected.map((type) => [type, 1]));
  const allocation = [...selected];

  while (allocation.length < target) {
    const expandable = selected
      .filter((type) => (counts.get(type) || 0) < getTypeRule(type, groupType).maxDefault)
      .sort((a, b) => getTypeRule(b, groupType).repeatWeight - getTypeRule(a, groupType).repeatWeight);

    if (expandable.length === 0) break;

    const next = expandable[0];
    allocation.push(next);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  while (allocation.length < target) {
    const sortedByRepeat = [...selected].sort(
      (a, b) => getTypeRule(b, groupType).repeatWeight - getTypeRule(a, groupType).repeatWeight,
    );
    const next = sortedByRepeat[0];
    allocation.push(next);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  return allocation.slice(0, target);
};

/**
 * Orders the chosen stop types through the day so early, middle, and late slots
 * tend to match how people usually use those categories.
 */
export const orderAllocation = (
  allocationTokens: StopType[],
  startTime: string,
  endTime: string,
  groupType: GroupType = 'Date',
): StopType[] => {
  const tokens = [...allocationTokens];
  if (tokens.length <= 1) return tokens;

  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  const total = Math.max(1, end - start);
  const startsLate = start >= 12 * 60;

  const preferredPosition = (type: StopType) => {
    if (groupType === 'Solo') {
      return getSoloPreferredPosition(type, total, startsLate);
    }
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

/**
 * Prevents certain stop categories from appearing back-to-back when another
 * category is available later in the sequence.
 */
export const enforceCapsAndAdjacency = (tokens: StopType[]): StopType[] => {
  if (tokens.length <= 1) return tokens;

  const output = [...tokens];

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
  routing: RoutingProvider;
  selectionWindow?: number;
  qualityFloorOffset?: number;
}

const hasOrigin = (input: WizardInput) =>
  typeof input.startLat === 'number' &&
  typeof input.startLng === 'number' &&
  Number.isFinite(input.startLat) &&
  Number.isFinite(input.startLng);

const estimateFallbackEtaMinutes = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport: TransportType,
) => {
  const dist = haversineKm(from.lat, from.lng, to.lat, to.lng);
  return Math.max(1, Math.round((dist / estimatedSpeedKmh(transport)) * 60));
};

const buildLegCacheKey = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport: TransportType,
) => `${transport}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;

const routeEtaCache = new Map<string, number>();

/**
 * Resolves travel time between two points. Routing results are cached by leg so
 * the selection step can reuse them while scoring candidate pools.
 */
const getLegEtaMinutes = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  transport: TransportType,
  routing: RoutingProvider,
) => {
  const cacheKey = buildLegCacheKey(from, to, transport);
  const cached = routeEtaCache.get(cacheKey);
  if (typeof cached === 'number') return cached;

  try {
    const legs = await routing.route(
      [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      transport,
    );
    const eta = legs[0]?.etaMin;
    if (typeof eta === 'number' && Number.isFinite(eta)) {
      routeEtaCache.set(cacheKey, eta);
      return eta;
    }
  } catch {
    // Fall back to straight-line travel estimates when routing is unavailable.
  }

  const fallback = estimateFallbackEtaMinutes(from, to, transport);
  routeEtaCache.set(cacheKey, fallback);
  return fallback;
};

interface RankedCandidate {
  candidate: PlaceCandidate;
  score: number;
  estimatedEta?: number;
}

/**
 * Scores candidates in two stages:
 * 1. cheap synchronous pre-ranking using estimated ETA
 * 2. exact routing only for the best few candidates
 *
 * This keeps results similar while avoiding route lookups for every candidate.
 */
export const selectPlaceForToken = async ({
  token,
  tokenIndex,
  seed,
  candidates,
  selected,
  input,
  routing,
  selectionWindow = 12,
  qualityFloorOffset = 8,
}: SelectionContext): Promise<PlaceCandidate | null> => {
  if (candidates.length === 0) return null;

  const maxTravel = Math.max(5, input.preferences.maxTravelMinutes || 30);
  const explicitSelectedStopTypes = getExplicitSelectedStopTypes(input.preferences.interests);
  const previous = selected[selected.length - 1];

  const from = previous
    ? { lat: previous.lat, lng: previous.lng }
    : hasOrigin(input)
      ? { lat: input.startLat as number, lng: input.startLng as number }
      : null;

  const cheapRanked: RankedCandidate[] = [];

  for (const candidate of candidates) {
    let score = 10;

    score += candidate.stopType === token ? 8 : -12;
    score += (candidate.rating || 0) * 1.5;
    score += Math.min(3, (candidate.reviewCount || 0) / 500);

    const placeTier = resolvePlaceTier(candidate.priceLevel, candidate.costLevel);
    const budgetScore = budgetScoreAdjustment(placeTier, input.budget);
    if (budgetScore <= -900) continue;
    score += budgetScore;
    score += getSoloSuitabilityScore(candidate, explicitSelectedStopTypes, input.groupType);

    if (candidate.openNow) score += 2;

    let estimatedEta: number | undefined;

    if (from) {
      estimatedEta = estimateFallbackEtaMinutes(from, { lat: candidate.lat, lng: candidate.lng }, input.transport);

      // Slightly relaxed early cutoff so we do not over-prune before exact routing.
      if (estimatedEta > maxTravel + 12) {
        continue;
      }

      score += Math.max(0, 4 - estimatedEta / 8);

      if (input.transport === 'walk') {
        score += Math.max(0, 6 - estimatedEta / 4);
      } else {
        score += Math.max(0, 2 - estimatedEta / 15);
      }
    }

    cheapRanked.push({ candidate, score, estimatedEta });
  }

  if (cheapRanked.length === 0) return null;

  cheapRanked.sort((a, b) => b.score - a.score);

  const routingPoolSize = Math.min(
    cheapRanked.length,
    Math.max(selectionWindow * 2, input.feelingLucky ? 20 : 14),
  );

  const preselected = cheapRanked.slice(0, routingPoolSize);

  const exactRanked = await Promise.all(
    preselected.map(async (entry) => {
      const candidate = entry.candidate;
      let score = 10;

      score += candidate.stopType === token ? 8 : -12;
      score += (candidate.rating || 0) * 1.5;
      score += Math.min(3, (candidate.reviewCount || 0) / 500);

      const placeTier = resolvePlaceTier(candidate.priceLevel, candidate.costLevel);
      const budgetScore = budgetScoreAdjustment(placeTier, input.budget);
      if (budgetScore <= -900) return { candidate, score: -999 };
      score += budgetScore;
      score += getSoloSuitabilityScore(candidate, explicitSelectedStopTypes, input.groupType);

      if (candidate.openNow) score += 2;

      if (from) {
        const eta = await getLegEtaMinutes(from, { lat: candidate.lat, lng: candidate.lng }, input.transport, routing);

        if (eta > maxTravel) {
          return { candidate, score: -999 };
        }

        score += Math.max(0, 4 - eta / 8);

        if (input.transport === 'walk') {
          score += Math.max(0, 6 - eta / 4);
        } else {
          score += Math.max(0, 2 - eta / 15);
        }
      }

      return { candidate, score };
    }),
  );

  const viable = exactRanked.filter((entry) => entry.score > -900).sort((a, b) => b.score - a.score);

  if (viable.length === 0) {
    // As a fallback, return the best cheap-ranked candidate.
    return cheapRanked[0]?.candidate || null;
  }

  const bestScore = viable[0].score;
  const qualityPool = viable.filter((entry) => entry.score >= bestScore - qualityFloorOffset);
  const windowedPool = qualityPool.slice(0, Math.min(selectionWindow, qualityPool.length));

  if (windowedPool.length === 0) {
    return viable[0].candidate;
  }

  const pickIndex = deterministicIndex(`${seed}-${token}-${tokenIndex}`, windowedPool.length);
  return windowedPool[pickIndex].candidate;
};

export interface ScheduledStop extends PlaceCandidate {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  travelMinutesFromPrev: number;
}

/**
 * Builds timed stops from ordered places and route legs. The time budget first
 * reserves travel, then distributes remaining minutes across stops by category.
 */
export const scheduleItinerary = (
  orderedStops: PlaceCandidate[],
  input: WizardInput,
  startTime: string,
  endTime: string,
  routeLegs: RouteLeg[] = [],
  originLeg?: RouteLeg,
): ScheduledStop[] => {
  if (orderedStops.length === 0) return [];

  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  const totalWindow = Math.max(0, end - start);
  if (totalWindow <= 0) return [];

  const computeTravel = (stops: PlaceCandidate[]) =>
    stops.map((_, i) => {
      if (i === 0) {
        const originEta = originLeg?.etaMin;
        if (typeof originEta === 'number' && Number.isFinite(originEta)) return originEta;
        return 0;
      }

      const routeEta = routeLegs[i - 1]?.etaMin;
      if (typeof routeEta === 'number' && Number.isFinite(routeEta)) return routeEta;

      const prev = stops[i - 1];
      const curr = stops[i];
      const dist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
      return Math.max(1, Math.round((dist / estimatedSpeedKmh(input.transport)) * 60));
    });

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  let stops = [...orderedStops];
  let travel = computeTravel(stops);

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
        travelMinutesFromPrev: travel[0] ?? 0,
        durationMinutes: totalWindow,
        startTime,
        endTime,
      },
    ];
  }

  if (usable <= 0) return [];

  const rules = stops.map((s) => DURATION_RULES[s.stopType] ?? { min: 20, max: 90, weight: 1.5 });

  const weights = rules.map((r) => r.weight);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const minSum = rules.reduce((acc, r) => acc + r.min, 0);

  const effectiveMins =
    minSum <= usable ? rules.map((r) => r.min) : rules.map((r) => Math.max(1, Math.floor((r.min / minSum) * usable)));

  const durations = stops.map((_, i) => {
    const target = Math.round((usable * weights[i]) / weightSum);
    return clamp(target, effectiveMins[i], rules[i].max);
  });

  const normalize = (targetTotal: number) => {
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
    cursor += travel[i] ?? 0;
    if (cursor >= end) break;

    const stopStart = cursor;
    const stopEnd = Math.min(end, stopStart + durations[i]);
    const durationMinutes = Math.max(0, stopEnd - stopStart);

    scheduled.push({
      ...stops[i],
      travelMinutesFromPrev: travel[i] ?? 0,
      durationMinutes,
      startTime: minutesToTime(stopStart),
      endTime: minutesToTime(stopEnd),
    });

    cursor = stopEnd;
  }

  return scheduled;
};
