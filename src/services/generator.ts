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

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const generateStops = async (
  planId: string,
  input: WizardInput,
  candidates: PlaceCandidate[],
  routing: RoutingProvider,
): Promise<Stop[]> => {
  // Normalize user-selected interests into stop types and filter out invalid coordinates.
  const selectedStopTypes = normalizeSelectedStopTypes(input.preferences.interests);
  const validCandidates = candidates.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0),
  );

  // Validate inputs and compute the number of stops to generate.
  if (selectedStopTypes.length === 0) throw new Error('Select at least one stop type to generate a plan.');
  const totalMinutes = parseMinutes(input.endTime) - parseMinutes(input.startTime);
  if (totalMinutes <= 0) throw new Error('End time must be after start time.');
  const requestedCount = Math.max(2, Math.min(8, Math.floor(input.stopCount || 3)));

  // Build a stop-type allocation and order it across the time window.
  const allocation = buildStopAllocation(selectedStopTypes, requestedCount);
  const orderedTokens = enforceCapsAndAdjacency(orderAllocation(allocation, input.startTime, input.endTime));

  if (isDev) {
    console.log('[plan][engine] allocation_tokens', allocation);
    console.log('[plan][engine] ordered_tokens', orderedTokens);
  }

  // Index candidates by stop type for faster selection.
  const byType = new Map<StopType, PlaceCandidate[]>();
  validCandidates.forEach((candidate) => {
    const list = byType.get(candidate.stopType) || [];
    list.push(candidate);
    byType.set(candidate.stopType, list);
  });

  // Select one place per token, avoiding duplicate place IDs.
  const selected: PlaceCandidate[] = [];
  const selectedTokens: StopType[] = [];
  const usedPlaceIds = new Set<string>();

  orderedTokens.forEach((token, tokenIndex) => {
    const tokenCandidates = (byType.get(token) || []).filter((candidate) => !usedPlaceIds.has(candidate.id));

    // Try selecting within the token type first, then fall back to any candidate matching the user's chosen stop types.
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
        candidates: validCandidates.filter(
          (candidate) => !usedPlaceIds.has(candidate.id) && selectedStopTypes.includes(candidate.stopType),
        ),
        selected,
        input,
      });

    if (picked) {
      usedPlaceIds.add(picked.id);
      selected.push(picked);
      selectedTokens.push(token);

      if (isDev) {
        console.log('[plan][engine] selected_place', {
          token,
          tokenIndex,
          place: picked.name,
          stopType: picked.stopType,
        });
      }
    }
  });

  // Validate selected places against category policy and attempt replacements when rejected.
  for (let index = 0; index < selected.length; index += 1) {
    const tokenType = selectedTokens[index] || selected[index].stopType;
    const current = selected[index];

    const validation = evaluateCategoryCandidate(tokenType, {
      name: current.name,
      address: current.address,
      types: current.tags,
    });
    if (validation.accepted) continue;

    const replacementPool = validCandidates.filter((candidate) => {
      if (usedPlaceIds.has(candidate.id) && candidate.id !== current.id) return false;
      if (candidate.id === current.id) return false;

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
      usedPlaceIds.add(replacement.id);
      selected[index] = replacement;

      if (isDev) {
        console.log('[plan][engine] validation_replaced', {
          token: tokenType,
          replaced: current.name,
          replacement: replacement.name,
          reasons: validation.reasons,
        });
      }
    } else if (isDev) {
      console.log('[plan][engine] validation_reject_no_replacement', {
        token: tokenType,
        place: current.name,
        reasons: validation.reasons,
      });
    }
  }

  if (selected.length === 0) throw new Error('No real nearby places found. Try another location or interests.');

  // Compute travel legs for ETA/distance metadata between consecutive stops.
  const coords = selected.map((s) => [s.lat, s.lng] as [number, number]);
  const routeLegs = await routing.route(coords, input.transport);

  // Assign start/end times and per-stop durations across the time window.
  const scheduled: ScheduledStop[] = scheduleItinerary(selected, input, input.startTime, input.endTime);

  // Produce the final Stop[] payload used by the UI.
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
      why: `Fits your ${input.groupType.toLowerCase()} day and ${
        input.preferences.interests[0] || 'general'
      } interests.`,
      locked: 0,
      openNow: s.openNow,
      rating: s.rating,
      openingHoursText: s.openingHoursText,
      priceLevel: s.priceLevel,

      etaMin: travel,
      distanceKm: distance,

      stopType: s.stopType,
      providerId: s.providerId,
      reviewCount: s.reviewCount,
    };
  });
};
