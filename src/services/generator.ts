import { PlaceCandidate, Stop, StopType, WizardInput, GroupType, BudgetType } from '@/types/models';
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

/**
 * Caps stops so short time windows never create impossible itineraries.
 */
const capStopsForWindow = (windowMinutes: number, requested: number) => {
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
 * If the user only selects restaurants, broaden slightly so the day isn't just 3 meals.
 */
const enrichStopTypesIfOnlyRestaurants = (types: StopType[]) => {
  const unique = Array.from(new Set(types));
  if (unique.length === 1 && unique[0] === 'restaurant') {
    return ['restaurant', 'activity', 'outdoors', 'coffee', 'dessert'] as StopType[];
  }
  return unique;
};

const uniqueStopTypes = (types: StopType[]) => Array.from(new Set(types));

export const buildFeelingLuckyStopTypes = (input: WizardInput): StopType[] => {
  const maxTravel = Math.max(5, Math.round(input.preferences.maxTravelMinutes || 30));

  let mix: StopType[];
  if (input.groupType === 'Family') {
    mix = ['activity', 'outdoors', 'attraction', 'dessert', 'restaurant', 'coffee'];
  } else if (input.groupType === 'Friends') {
    mix = ['activity', 'restaurant', 'outdoors', 'bar', 'coffee', 'dessert'];
  } else {
    mix = ['coffee', 'activity', 'restaurant', 'arts', 'dessert', 'outdoors'];
  }

  if (input.budget === '$') {
    mix = mix.filter((type) => type !== 'bar' && type !== 'attraction');
  } else if (input.budget === '$$$') {
    mix = uniqueStopTypes([...mix, 'arts', 'attraction']);
  }

  if (maxTravel <= 20) {
    mix = mix.filter((type) => type !== 'attraction');
  }

  if (input.returnToStart) {
    mix = uniqueStopTypes(['coffee', ...mix]);
  }

  if (input.groupType === 'Family') {
    mix = mix.filter((type) => type !== 'bar');
  }

  return uniqueStopTypes(mix);
};

/**
 * Removes stop types that don't make sense for the user's group type.
 */
const applyGroupTypeStopTypeConstraints = (groupType: GroupType, types: StopType[]) => {
  const unique = Array.from(new Set(types));

  if (groupType === 'Family') {
    return unique.filter((t) => t !== 'bar');
  }

  return unique;
};

const resolveSelectedStopTypes = (input: WizardInput) => {
  const selected = normalizeSelectedStopTypes(input.preferences.interests);
  if (selected.length > 0) {
    return applyGroupTypeStopTypeConstraints(input.groupType, enrichStopTypesIfOnlyRestaurants(selected));
  }

  if (input.feelingLucky) {
    return applyGroupTypeStopTypeConstraints(input.groupType, buildFeelingLuckyStopTypes(input));
  }

  return [] as StopType[];
};

/**
 * Limits restaurant frequency:
 * - If multiple categories are selected and restaurant is one of them -> max 1 restaurant
 * - If only restaurant is selected -> max 2 restaurants
 */
const enforceRestaurantCap = (tokens: StopType[], selectedTypes: StopType[], groupType: GroupType) => {
  const uniqueSelected = new Set(selectedTypes);
  const hasMultipleCategories = uniqueSelected.size > 1;
  const maxRestaurants = hasMultipleCategories ? 1 : 2;

  const restaurantCount = tokens.filter((t) => t === 'restaurant').length;
  if (restaurantCount <= maxRestaurants) return tokens;

  const baseReplacementOrder: StopType[] = [
    'activity',
    'attraction',
    'outdoors',
    'arts',
    'coffee',
    'dessert',
    'shopping',
    'bar',
  ];

  const replacementOrder = groupType === 'Family' ? baseReplacementOrder.filter((t) => t !== 'bar') : baseReplacementOrder;

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

/**
 * Produces a stable "brand key" so chain duplicates don't appear multiple times.
 */
const brandKeyFromName = (name: string) => {
  const raw = (name || '').toLowerCase().trim();
  if (!raw) return '';

  const cut = raw
    .split(' - ')[0]
    .split(' – ')[0]
    .split(' — ')[0]
    .split(' | ')[0]
    .split(' @ ')[0]
    .split(' at ')[0];

  const cleaned = cut
    .replace(/[#.,/\\()]/g, ' ')
    .replace(/\b(store|location|restaurant|cafe|coffee|bar|grill|kitchen|shop|market)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
};

const isLikelyDuplicateBrand = (nameA: string, nameB: string) => {
  const a = brandKeyFromName(nameA);
  const b = brandKeyFromName(nameB);
  if (!a || !b) return false;
  return a === b;
};

const buildDedupeKeys = (candidate: PlaceCandidate) => {
  const idKey = candidate.id ? `id:${candidate.id}` : '';
  const pidKey = candidate.providerId ? `pid:${candidate.providerId}` : '';
  const coordKey =
    Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng)
      ? `xy:${candidate.lat.toFixed(5)}:${candidate.lng.toFixed(5)}`
      : '';
  const brandKey = candidate.name ? `brand:${brandKeyFromName(candidate.name)}` : '';
  return { idKey, pidKey, coordKey, brandKey };
};

/**
 * Sorts candidates by quality signals (rating, review count, then name).
 */
const preferQualitySort = (a: PlaceCandidate, b: PlaceCandidate) => {
  const ar = typeof a.rating === 'number' ? a.rating : 0;
  const br = typeof b.rating === 'number' ? b.rating : 0;
  if (br !== ar) return br - ar;

  const ac = typeof a.reviewCount === 'number' ? a.reviewCount : 0;
  const bc = typeof b.reviewCount === 'number' ? b.reviewCount : 0;
  if (bc !== ac) return bc - ac;

  return (a.name || '').localeCompare(b.name || '');
};

const textBlob = (c: PlaceCandidate) =>
  `${c.name || ''} ${(c.category || '')} ${c.address || ''} ${(c.tags || []).join(' ')}`.toLowerCase();

/**
 * Maps budget choice to an expected price level range.
 * priceLevel is typically 0–4 depending on provider.
 */
const budgetBand = (budget: BudgetType) => {
  if (budget === '$') return { min: 0, max: 1, idealMin: 0, idealMax: 1 };
  if (budget === '$$') return { min: 1, max: 2, idealMin: 1, idealMax: 2 };
  return { min: 2, max: 4, idealMin: 2, idealMax: 3 };
};

/**
 * Returns a score based on how well a candidate matches the user's budget.
 * Missing priceLevel is treated as neutral so we don't throw away good candidates.
 */
const scoreBudgetFit = (input: WizardInput, c: PlaceCandidate) => {
  const p = typeof c.priceLevel === 'number' ? c.priceLevel : undefined;
  if (p == null) return 0;

  const band = budgetBand(input.budget);

  if (p >= band.idealMin && p <= band.idealMax) return 6;
  if (p >= band.min && p <= band.max) return 2;
  return -4;
};

/**
 * Returns a score based on group type.
 * Family implies kid-friendly behavior.
 */
const scoreGroupFit = (input: WizardInput, token: StopType, c: PlaceCandidate) => {
  const blob = textBlob(c);
  const hasAny = (words: string[]) => words.some((w) => blob.includes(w));

  const nightlife = ['nightclub', 'club', 'bar', 'cocktail', 'lounge', 'pub', 'brewery', 'speakeasy'];
  const familyFriendly = ['park', 'playground', 'zoo', 'aquarium', 'museum', 'ice cream', 'gelato', 'family', 'kids'];
  const romantic = ['romantic', 'cozy', 'wine', 'view', 'rooftop', 'date', 'bistro', 'tapas', 'dessert'];

  if (input.groupType === 'Family') {
    let score = 0;

    if (token === 'bar' || hasAny(nightlife)) score -= 10;
    if (token === 'outdoors' || token === 'activity' || token === 'attraction') score += 2;
    if (hasAny(familyFriendly)) score += 6;

    return score;
  }

  if (input.groupType === 'Date') {
    let score = 0;

    if (token === 'restaurant' || token === 'coffee' || token === 'dessert' || token === 'arts') score += 3;
    if (hasAny(romantic)) score += 5;
    if (hasAny(['playground', 'kids'])) score -= 2;

    return score;
  }

  // Friends
  {
    let score = 0;

    if (token === 'activity' || token === 'bar') score += 3;
    if (hasAny(['live', 'music', 'arcade', 'game', 'sports', 'brewery', 'pub', 'bar'])) score += 4;
    if (hasAny(['playground'])) score -= 1;

    return score;
  }
};

/**
 * Combines preference signals into a single score.
 */
const preferenceScore = (input: WizardInput, token: StopType, c: PlaceCandidate) => {
  return scoreBudgetFit(input, c) + scoreGroupFit(input, token, c);
};

/**
 * Sorts candidates so user preferences are applied first, then quality breaks ties.
 */
const preferInputAwareSort = (input: WizardInput, token: StopType) => {
  return (a: PlaceCandidate, b: PlaceCandidate) => {
    const sa = preferenceScore(input, token, a);
    const sb = preferenceScore(input, token, b);
    if (sb !== sa) return sb - sa;
    return preferQualitySort(a, b);
  };
};

export const generateStops = async (
  planId: string,
  input: WizardInput,
  candidates: PlaceCandidate[],
  routing: RoutingProvider,
): Promise<Stop[]> => {
  const selectedStopTypes = resolveSelectedStopTypes(input);

  const validCandidates = candidates
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
    .map((c) => ({ ...c, stopType: ensureStopType(c.stopType) }));

  if (selectedStopTypes.length === 0) throw new Error('Select at least one stop type to generate a plan.');

  const totalMinutes = parseMinutes(input.endTime) - parseMinutes(input.startTime);
  if (totalMinutes <= 0) throw new Error('End time must be after start time.');

  const rawRequested = Math.max(1, Math.min(8, Math.floor(input.stopCount || 3)));
  const requestedCount = capStopsForWindow(totalMinutes, rawRequested);

  const allocation = buildStopAllocation(selectedStopTypes, requestedCount);
  let orderedTokens = enforceCapsAndAdjacency(orderAllocation(allocation, input.startTime, input.endTime));
  orderedTokens = enforceRestaurantCap(orderedTokens, selectedStopTypes, input.groupType);

  const byType = new Map<StopType, PlaceCandidate[]>();
  for (const candidate of validCandidates) {
    const t = ensureStopType(candidate.stopType);
    const list = byType.get(t) || [];
    list.push({ ...candidate, stopType: t });
    byType.set(t, list);
  }

  for (const [t, list] of byType.entries()) {
    byType.set(t, [...list].sort(preferInputAwareSort(input, t)));
  }

  const selected: PlaceCandidate[] = [];
  const selectedTokens: StopType[] = [];

  const usedIdKeys = new Set<string>();
  const usedProviderKeys = new Set<string>();
  const usedCoordKeys = new Set<string>();
  const usedBrandKeys = new Set<string>();

  const isBlocked = (candidate: PlaceCandidate) => {
    const keys = buildDedupeKeys(candidate);
    if (keys.idKey && usedIdKeys.has(keys.idKey)) return true;
    if (keys.pidKey && usedProviderKeys.has(keys.pidKey)) return true;
    if (keys.coordKey && usedCoordKeys.has(keys.coordKey)) return true;
    if (keys.brandKey && usedBrandKeys.has(keys.brandKey)) return true;
    if (selected.some((s) => isLikelyDuplicateBrand(s.name, candidate.name))) return true;
    return false;
  };

  const markUsed = (candidate: PlaceCandidate) => {
    const keys = buildDedupeKeys(candidate);
    if (keys.idKey) usedIdKeys.add(keys.idKey);
    if (keys.pidKey) usedProviderKeys.add(keys.pidKey);
    if (keys.coordKey) usedCoordKeys.add(keys.coordKey);
    if (keys.brandKey) usedBrandKeys.add(keys.brandKey);
  };

  orderedTokens.forEach((token, tokenIndex) => {
    const typedPool = (byType.get(token) || []).filter((c) => !isBlocked(c));

    const acceptedPool = typedPool.filter((c) => {
      const check = evaluateCategoryCandidate(token, {
        name: c.name,
        address: c.address,
        types: c.tags,
      });
      return check.accepted;
    });

    const candidatePool = acceptedPool.length ? acceptedPool : typedPool;

    const picked =
      selectPlaceForToken({
        token,
        tokenIndex,
        seed: planId,
        candidates: candidatePool,
        selected,
        input,
      }) ||
      selectPlaceForToken({
        token,
        tokenIndex,
        seed: `${planId}-fallback`,
        candidates: (byType.get(token) || []).filter((c) => !isBlocked(c)).sort(preferInputAwareSort(input, token)),
        selected,
        input,
      });

    if (picked) {
      markUsed(picked);
      selected.push({ ...picked, stopType: ensureStopType(picked.stopType) });
      selectedTokens.push(token);
    }
  });

  for (let index = 0; index < selected.length; index += 1) {
    const tokenType = ensureStopType(selectedTokens[index] ?? selected[index]?.stopType);
    const current = selected[index];

    const validation = evaluateCategoryCandidate(tokenType, {
      name: current.name,
      address: current.address,
      types: current.tags,
    });
    if (validation.accepted) continue;

    const currentKeys = buildDedupeKeys(current);

    const replacementPool = (byType.get(tokenType) || [])
      .filter((c) => {
        if (c.id === current.id) return false;
        if (current.providerId && c.providerId && c.providerId === current.providerId) return false;
        if (isLikelyDuplicateBrand(c.name, current.name)) return false;

        const k = buildDedupeKeys(c);
        if (k.idKey && usedIdKeys.has(k.idKey) && k.idKey !== currentKeys.idKey) return false;
        if (k.pidKey && usedProviderKeys.has(k.pidKey) && k.pidKey !== currentKeys.pidKey) return false;
        if (k.coordKey && usedCoordKeys.has(k.coordKey) && k.coordKey !== currentKeys.coordKey) return false;
        if (k.brandKey && usedBrandKeys.has(k.brandKey) && k.brandKey !== currentKeys.brandKey) return false;

        const check = evaluateCategoryCandidate(tokenType, {
          name: c.name,
          address: c.address,
          types: c.tags,
        });
        return check.accepted;
      })
      .sort(preferInputAwareSort(input, tokenType));

    const replacement = selectPlaceForToken({
      token: tokenType,
      tokenIndex: index,
      seed: `${planId}-validation`,
      candidates: replacementPool,
      selected: selected.slice(0, index),
      input,
    });

    if (replacement) {
      selected[index] = { ...replacement, stopType: ensureStopType(replacement.stopType) };
      markUsed(replacement);
    }
  }

  if (selected.length === 0) throw new Error('No real nearby places found. Try another location or interests.');

  const coords = selected.map((s) => [s.lat, s.lng] as [number, number]);
  const routeLegs = await routing.route(coords, input.transport);

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
 * Rerolls a single stop while keeping the SAME stopType and avoiding duplicates.
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
  const tokenType = ensureStopType(targetStop.stopType);

  const orderedPlaces: PlaceCandidate[] = currentStops.map((s) => {
    const found = matchCandidateForStop(s, validCandidates);
    return found || toPlaceCandidateFromStop(s);
  });

  const usedIdKeys = new Set<string>();
  const usedProviderKeys = new Set<string>();
  const usedCoordKeys = new Set<string>();
  const usedBrandKeys = new Set<string>();

  orderedPlaces.forEach((p, i) => {
    if (i === stopIndex) return;
    const k = buildDedupeKeys(p);
    if (k.idKey) usedIdKeys.add(k.idKey);
    if (k.pidKey) usedProviderKeys.add(k.pidKey);
    if (k.coordKey) usedCoordKeys.add(k.coordKey);
    if (k.brandKey) usedBrandKeys.add(k.brandKey);
  });

  const currentPlace = orderedPlaces[stopIndex];
  const currentKeys = buildDedupeKeys(currentPlace);

  const isBlocked = (c: PlaceCandidate) => {
    const k = buildDedupeKeys(c);

    if (k.idKey && k.idKey === currentKeys.idKey) return true;
    if (k.pidKey && k.pidKey === currentKeys.pidKey) return true;
    if (k.coordKey && k.coordKey === currentKeys.coordKey) return true;

    if (k.idKey && usedIdKeys.has(k.idKey)) return true;
    if (k.pidKey && usedProviderKeys.has(k.pidKey)) return true;
    if (k.coordKey && usedCoordKeys.has(k.coordKey)) return true;
    if (k.brandKey && usedBrandKeys.has(k.brandKey)) return true;

    if (orderedPlaces.some((p, i) => i !== stopIndex && isLikelyDuplicateBrand(p.name, c.name))) return true;

    return false;
  };

  const pool = validCandidates
    .filter((c) => ensureStopType(c.stopType) === tokenType)
    .filter((c) => !isBlocked(c))
    .sort(preferInputAwareSort(input, tokenType));

  if (pool.length === 0) return currentStops;

  const acceptedPool = pool.filter((candidate) => {
    const check = evaluateCategoryCandidate(tokenType, {
      name: candidate.name,
      address: candidate.address,
      types: candidate.tags,
    });
    return check.accepted;
  });

  const finalPool = acceptedPool.length ? acceptedPool : pool;

  const nonce = rerollNonce ?? Date.now();
  const seedBase = `${planId}-reroll-${stopIndex}-${nonce}`;

  const selectedPrefix = orderedPlaces.slice(0, stopIndex);

  let replacement: PlaceCandidate | null = null;
  for (let attempt = 0; attempt < 8 && !replacement; attempt += 1) {
    replacement =
      selectPlaceForToken({
        token: tokenType,
        tokenIndex: stopIndex + attempt,
        seed: `${seedBase}-${attempt}`,
        candidates: finalPool,
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
