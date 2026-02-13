import { PlaceCandidate, Stop, StopType, WizardInput } from '@/types/models';
import { normalizeSelectedStopTypes } from '@/constants/stopTypes';
import { RoutingProvider } from '@/providers/routingProvider';
import { buildStopAllocation, enforceCapsAndAdjacency, orderAllocation, selectPlaceForToken } from './itineraryEngine';

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const generateStops = async (
  planId: string,
  input: WizardInput,
  candidates: PlaceCandidate[],
  routing: RoutingProvider,
): Promise<Stop[]> => {
  const selectedStopTypes = normalizeSelectedStopTypes(input.preferences.interests);
  const validCandidates = candidates.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0),
  );

  if (selectedStopTypes.length === 0) throw new Error('Select at least one stop type to generate a plan.');
  const totalMinutes = parseMinutes(input.endTime) - parseMinutes(input.startTime);
  if (totalMinutes <= 0) throw new Error('End time must be after start time.');
  const requestedCount = Math.max(1, Math.min(6, Math.floor(input.stopCount || 1)));

  const allocation = buildStopAllocation(selectedStopTypes, requestedCount);
  const orderedTokens = enforceCapsAndAdjacency(orderAllocation(allocation, input.startTime, input.endTime));
  if (isDev) {
    console.log('[plan][engine] allocation_tokens', allocation);
    console.log('[plan][engine] ordered_tokens', orderedTokens);
  }

  const byType = new Map<StopType, PlaceCandidate[]>();
  validCandidates.forEach((candidate) => {
    const list = byType.get(candidate.stopType) || [];
    list.push(candidate);
    byType.set(candidate.stopType, list);
  });

  const selected: PlaceCandidate[] = [];
  const usedPlaceIds = new Set<string>();
  orderedTokens.forEach((token, tokenIndex) => {
    const tokenCandidates = (byType.get(token) || []).filter((candidate) => !usedPlaceIds.has(candidate.id));
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

  if (selected.length === 0) throw new Error('No real nearby places found. Try another location or interests.');

  const coords = selected.map((s) => [s.lat, s.lng] as [number, number]);
  const routeLegs = await routing.route(coords, input.transport);
  const stopDuration = Math.max(45, Math.floor(totalMinutes / selected.length) - 15);

  let cursor = parseMinutes(input.startTime);
  return selected.map((s, index) => {
    const travel = index === 0 ? 0 : routeLegs[index - 1]?.etaMin || 10;
    const distance = index === 0 ? 0 : routeLegs[index - 1]?.distanceKm || 1;
    cursor += travel;
    const start = cursor;
    const end = Math.min(cursor + stopDuration, parseMinutes(input.endTime));
    cursor = end;
    return {
      id: createId(),
      planId,
      order: index,
      name: s.name,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      startTime: toTime(start),
      endTime: toTime(end),
      durationMin: stopDuration,
      costLevel: s.costLevel || input.budget,
      why: `Fits your ${input.groupType.toLowerCase()} day and ${input.preferences.interests[0] || 'general'} interests.`,
      locked: 0,
      openNow: s.openNow,
      rating: s.rating,
      openingHoursText: s.openingHoursText,
      priceLevel: s.priceLevel,
      etaMin: travel,
      distanceKm: distance,
      stopType: s.stopType,
    };
  });
};
