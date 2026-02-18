import { PlaceCandidate, Stop, StopType, WizardInput } from '@/types/models';
import { normalizeSelectedStopTypes } from '@/constants/stopTypes';
import { RoutingProvider } from '@/providers/routingProvider';
import {
  buildStopAllocation,
  enforceCapsAndAdjacency,
  orderAllocation,
  selectPlaceForToken,
  scheduleItinerary,
  ScheduledStop,
} from './itineraryEngine';
import { evaluateCategoryCandidate } from '@/providers/categoryPolicy';

const DEFAULT_STOP_TYPE: StopType = 'restaurant';
const ensureStopType = (value: StopType | undefined | null): StopType => value ?? DEFAULT_STOP_TYPE;

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const capStopsForWindow = (windowMinutes: number, requested: number) => {
  // Prevent unrealistic stop counts for short day windows.
  let maxStops = 8;
  if (windowMinutes <= 60) maxStops = 2;
  else if (windowMinutes <= 90) maxStops = 3;
  else if (windowMinutes <= 120) maxStops = 4;
  else if (windowMinutes <= 180) maxStops = 6;
  return Math.max(1, Math.min(maxStops, requested));
};

const matchCandidateForStop = (stop: Stop, candidates: PlaceCandidate[]) => {
  if (stop.providerId) {
    const byProvider = candidates.find((c) => c.providerId && c.providerId === stop.providerId);
    if (byProvider) return byProvider;
  }

  const byCoords = candidates.find(
    (c) => c.name === stop.name && Math.abs(c.lat - stop.lat) < 1e-6 && Math.abs(c.lng - stop.lng) < 1e-6,
  );

  return byCoords || null;
};

const toPlaceCandidateFromStop = (stop: Stop): PlaceCandidate => {
  const candidateId = stop.providerId || stop.id || `${stop.name}-${stop.lat}-${stop.lng}`;
  return {
    id: candidateId,
    providerId: stop.providerId,
    name: stop.name,
    address: stop.address || '',
    lat: stop.lat,
    lng: stop.lng,
    category: stop.category,
    costLevel: stop.costLevel,
    openNow: stop.openNow,
    rating: stop.rating,
    reviewCount: stop.reviewCount,
    openingHoursText: stop.openingHoursText,
    priceLevel: stop.priceLevel,
    tags: (stop as any).tags || [],
    stopType: ensureStopType(stop.stopType),
  } as PlaceCandidate;
};

/**
 * If only restaurants were selected, add a few compatible types so the plan stays usable.
 */
const enrichStopTypesIfOnlyRestaurants = (types: StopType[]) => {
  const unique = Array.from(new Set(types));
  if (unique.length === 1 && unique[0] === 'restaurant') {
    return ['restaurant', 'activity', 'outdoors', 'coffee', 'dessert'] as StopType[];
  }
  return unique;
};

/**
 * Keeps restaurant stops to a sensible number:
 * - multiple selected categories -> max 1 restaurant
 * - only restaurant selected -> max 2 restaurants
 */
const enforceRestaurantCap = (tokens: StopType[], selectedTypes: StopType[]) => {
  const uniqueSelected = new Set(selectedTypes);
  const hasMultipleCategories = uniqueSelected.size > 1;
  const maxRestaurants = hasMultipleCategories ? 1 : 2;

  const restaurantCount = tokens.filter((t) => t === 'restaurant').length;
  if (restaurantCount <= maxRestaurants) return tokens;

  const replacementOrder: StopType[] = ['activity', 'attraction', 'outdoors', 'arts', 'coffee', 'dessert', 'shopping', 'bar'];

  const pickReplacement = (): StopType => {
    for (const t of replacementOrder) {
      if (uniqueSelected.has(t)) return t;
    }
    return 'activity';
  };

  const replacement = pickReplacement();
  let toReplace = restaurantCount - maxRestaurants;

  const out = [...tokens];
  for (let i = out.length - 1; i >= 0 && toReplace > 0; i -= 1) {
    if (out[i] === 'restaurant') {
      out[i] = replacement;
      toReplace -= 1;
    }
  }

  return out;
};

const COMPATIBLE_FALLBACKS: Record<StopType, StopType[]> = {
  coffee: ['dessert', 'activity'],
  dessert: ['coffee', 'activity'],
  restaurant: ['dessert', 'coffee'],
  bar: ['restaurant', 'activity'],
  activity: ['attraction', 'arts', 'outdoors'],
  attraction: ['activity', 'arts', 'outdoors'],
  outdoors: ['activity', 'attraction'],
  arts: ['activity', 'attraction'],
  shopping: ['activity', 'arts'],
};

const getCompatibleTypes = (t: StopType): StopType[] => [t, ...(COMPATIBLE_FALLBACKS[t] || [])];

export const generateStops = async (
  planId: string,
  input: WizardInput,
  candidates: PlaceCandidate[],
  routing: RoutingProvider,
): Promise<Stop[]> => {
  // 1) Normalize request + validate candidate coordinates.
  const normalized = normalizeSelectedStopTypes(input.preferences.interests);
  const selectedStopTypes = enrichStopTypesIfOnlyRestaurants(normalized);

  const validCandidates = candidates
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
    .map((c) => ({ ...c, stopType: ensureStopType(c.stopType) }));

  if (selectedStopTypes.length === 0) throw new Error('Select at least one stop type to generate a plan.');

  const totalMinutes = parseMinutes(input.endTime) - parseMinutes(input.startTime);
  if (totalMinutes <= 0) throw new Error('End time must be after start time.');

  const rawRequested = Math.max(1, Math.min(8, Math.floor(input.stopCount || 3)));
  const requestedCount = capStopsForWindow(totalMinutes, rawRequested);

  // 2) Build a target sequence of stop-type tokens, then smooth adjacency/caps.
  const allocation = buildStopAllocation(selectedStopTypes, requestedCount);

  let orderedTokens = enforceCapsAndAdjacency(orderAllocation(allocation, input.startTime, input.endTime));
  orderedTokens = enforceRestaurantCap(orderedTokens, selectedStopTypes);

  const byType = new Map<StopType, PlaceCandidate[]>();
  for (const candidate of validCandidates) {
    const t = ensureStopType(candidate.stopType);
    const list = byType.get(t) || [];
    list.push({ ...candidate, stopType: t });
    byType.set(t, list);
  }

  const selected: PlaceCandidate[] = [];
  const selectedTokens: StopType[] = [];
  const usedPlaceIds = new Set<string>();
  const usedProviderIds = new Set<string>();

  // 3) Pick one place per token, then run a secondary fallback pass if needed.
  orderedTokens.forEach((token, tokenIndex) => {
    const tokenCandidates = (byType.get(token) || []).filter((candidate) => {
      if (usedPlaceIds.has(candidate.id)) return false;
      if (candidate.providerId && usedProviderIds.has(candidate.providerId)) return false;
      return true;
    });

    const picked =
      selectPlaceForToken({
        token,
        tokenIndex,
        seed: planId,
        candidates: tokenCandidates,
        selected,
        input,
      }) ||
      selectPlaceForToken({
        token,
        tokenIndex,
        seed: `${planId}-fallback`,
        candidates: validCandidates.filter((candidate) => {
          if (usedPlaceIds.has(candidate.id)) return false;
          if (candidate.providerId && usedProviderIds.has(candidate.providerId)) return false;
          return selectedStopTypes.includes(candidate.stopType);
        }),
        selected,
        input,
      });

    if (picked) {
      usedPlaceIds.add(picked.id);
      if (picked.providerId) usedProviderIds.add(picked.providerId);
      selected.push({ ...picked, stopType: ensureStopType(picked.stopType) });
      selectedTokens.push(token);
    }
  });

  // Ensure selected places match the target type policy; replace when possible.
  for (let index = 0; index < selected.length; index += 1) {
    const tokenType = ensureStopType(selectedTokens[index] ?? selected[index]?.stopType);
    const current = selected[index];

    const validation = evaluateCategoryCandidate(tokenType, {
      name: current.name,
      address: current.address,
      types: current.tags,
    });
    if (validation.accepted) continue;

    const replacementPool = validCandidates.filter((candidate) => {
      if (candidate.id === current.id) return false;
      if (usedPlaceIds.has(candidate.id)) return false;
      if (candidate.providerId && usedProviderIds.has(candidate.providerId)) return false;

      const check = evaluateCategoryCandidate(tokenType, {
        name: candidate.name,
        address: candidate.address,
        types: candidate.tags,
      });

      return check.accepted;
    });

    const replacement = selectPlaceForToken({
      token: tokenType,
      tokenIndex: index,
      seed: `${planId}-validation`,
      candidates: replacementPool,
      selected: selected.slice(0, index),
      input,
    });

    if (replacement) {
      usedPlaceIds.delete(current.id);
      if (current.providerId) usedProviderIds.delete(current.providerId);

      usedPlaceIds.add(replacement.id);
      if (replacement.providerId) usedProviderIds.add(replacement.providerId);

      selected[index] = { ...replacement, stopType: ensureStopType(replacement.stopType) };
    }
  }

  if (selected.length === 0) throw new Error('No real nearby places found. Try another location or interests.');

  const coords = selected.map((s) => [s.lat, s.lng] as [number, number]);
  const routeLegs = await routing.route(coords, input.transport);

  // 4) Assign clock times and enrich each stop with travel metadata.
  const scheduled: ScheduledStop[] = scheduleItinerary(selected, input, input.startTime, input.endTime);

  return scheduled.map((s, index) => {
    const travel = index === 0 ? 0 : routeLegs[index - 1]?.etaMin || 10;
    const distance = index === 0 ? 0 : routeLegs[index - 1]?.distanceKm || 1;

    return {
      id: createId(),
      planId,
      order: index,
      name: s.name,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
      address: s.address,

      startTime: s.startTime,
      endTime: s.endTime,
      durationMin: s.durationMinutes,

      costLevel: s.costLevel || input.budget,
      why: `Fits your ${input.groupType.toLowerCase()} day and ${input.preferences.interests[0] || 'general'} interests.`,
      locked: 0,

      openNow: s.openNow,
      rating: s.rating,
      openingHoursText: s.openingHoursText,
      priceLevel: s.priceLevel,
      providerId: s.providerId,
      reviewCount: s.reviewCount,
      stopType: ensureStopType(s.stopType),

      etaMin: travel,
      distanceKm: distance,
    };
  });
};

/**
 * Replaces one stop with a new place from the same type, falling back to compatible types if needed.
 * The result is re-routed and re-scheduled so times stay consistent.
 */
export const rerollStop = async (params: {
  planId: string;
  input: WizardInput;
  candidates: PlaceCandidate[];
  routing: RoutingProvider;
  currentStops: Stop[];
  stopIndex: number;
  rerollNonce?: string | number;
}): Promise<Stop[]> => {
  const { planId, input, candidates, routing, currentStops, stopIndex, rerollNonce } = params;

  if (stopIndex < 0 || stopIndex >= currentStops.length) return currentStops;

  const validCandidates = candidates
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
    .map((c) => ({ ...c, stopType: ensureStopType(c.stopType) }));

  const targetStop = currentStops[stopIndex];
  const primaryType = ensureStopType(targetStop.stopType);

  const orderedPlaces: PlaceCandidate[] = currentStops.map((s) => {
    const found = matchCandidateForStop(s, validCandidates);
    return found || toPlaceCandidateFromStop(s);
  });

  const usedIds = new Set<string>();
  const usedProviderIds = new Set<string>();

  orderedPlaces.forEach((p, i) => {
    if (i === stopIndex) return;
    usedIds.add(p.id);
    if (p.providerId) usedProviderIds.add(p.providerId);
  });

  const currentPlace = orderedPlaces[stopIndex];
  const currentId = currentPlace?.id;
  const currentProviderId = currentPlace?.providerId;

  const compatibleTypes = getCompatibleTypes(primaryType);

  // Candidate pool prefers same type but allows compatible fallbacks to avoid dead ends.
  const basePool = validCandidates.filter((c) => {
    const cType = ensureStopType(c.stopType);
    if (!compatibleTypes.includes(cType)) return false;

    if (usedIds.has(c.id)) return false;
    if (c.providerId && usedProviderIds.has(c.providerId)) return false;

    if (currentId && c.id === currentId) return false;
    if (currentProviderId && c.providerId && c.providerId === currentProviderId) return false;

    return true;
  });

  if (basePool.length === 0) return currentStops;

  const acceptedPool = basePool.filter((candidate) => {
    const desiredType = ensureStopType(candidate.stopType) === primaryType ? primaryType : ensureStopType(candidate.stopType);
    const check = evaluateCategoryCandidate(desiredType, {
      name: candidate.name,
      address: candidate.address,
      types: candidate.tags,
    });
    return check.accepted;
  });

  const pool = (acceptedPool.length ? acceptedPool : basePool).sort((a, b) => {
    const aSame = ensureStopType(a.stopType) === primaryType ? 1 : 0;
    const bSame = ensureStopType(b.stopType) === primaryType ? 1 : 0;
    return bSame - aSame;
  });

  const nonce = rerollNonce ?? Date.now();
  const seedBase = `${planId}-reroll-${stopIndex}-${nonce}`;
  const selectedPrefix = orderedPlaces.slice(0, stopIndex);

  let replacement: PlaceCandidate | null = null;
  for (let attempt = 0; attempt < 8 && !replacement; attempt += 1) {
    replacement =
      selectPlaceForToken({
        token: primaryType,
        tokenIndex: stopIndex + attempt,
        seed: `${seedBase}-${attempt}`,
        candidates: pool,
        selected: selectedPrefix,
        input,
      }) || null;
  }

  if (!replacement) return currentStops;

  const nextPlaces = [...orderedPlaces];
  nextPlaces[stopIndex] = { ...replacement, stopType: ensureStopType(replacement.stopType) };

  const coords = nextPlaces.map((s) => [s.lat, s.lng] as [number, number]);
  const routeLegs = await routing.route(coords, input.transport);

  const scheduled: ScheduledStop[] = scheduleItinerary(nextPlaces, input, input.startTime, input.endTime);

  return scheduled.map((s, index) => {
    const prevStop = currentStops[index];
    const travel = index === 0 ? 0 : routeLegs[index - 1]?.etaMin || 10;
    const distance = index === 0 ? 0 : routeLegs[index - 1]?.distanceKm || 1;

    return {
      id: prevStop?.id || createId(),
      planId: prevStop?.planId || planId,
      order: index,
      name: s.name,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
      address: s.address,

      startTime: s.startTime,
      endTime: s.endTime,
      durationMin: s.durationMinutes,

      costLevel: s.costLevel || input.budget,
      why:
        prevStop?.why ||
        `Fits your ${input.groupType.toLowerCase()} day and ${input.preferences.interests[0] || 'general'} interests.`,
      locked: prevStop?.locked ?? 0,

      openNow: s.openNow,
      rating: s.rating,
      openingHoursText: s.openingHoursText,
      priceLevel: s.priceLevel,
      providerId: s.providerId,
      reviewCount: s.reviewCount,
      stopType: ensureStopType(s.stopType),

      etaMin: travel,
      distanceKm: distance,
    };
  });
};
