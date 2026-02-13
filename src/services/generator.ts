import { PlaceCandidate, Stop, StopType, WizardInput } from '@/types/models';
import { normalizeSelectedStopTypes, STOP_TYPE_OPTIONS } from '@/constants/stopTypes';
import { stopsForPace, scorePlace } from './scoring';
import { RoutingProvider } from '@/providers/routingProvider';

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

  const totalMinutes = parseMinutes(input.endTime) - parseMinutes(input.startTime);
  const defaultCount = stopsForPace(input.pace, totalMinutes);
  const requestedCount = Math.max(1, Math.min(6, Math.floor(input.stopCount || defaultCount)));

  const ranked = [...validCandidates]
    .map((p) => ({ p, s: scorePlace(p, input.preferences) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(requestedCount * 3, 8))
    .map((r) => r.p);

  const selected = pickDiverseStops(ranked, selectedStopTypes, requestedCount);
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

const pickDiverseStops = (ranked: PlaceCandidate[], selectedStopTypes: StopType[], targetCount: number): PlaceCandidate[] => {
  const byType = new Map<StopType, PlaceCandidate[]>();
  for (const candidate of ranked) {
    const list = byType.get(candidate.stopType) || [];
    list.push(candidate);
    byType.set(candidate.stopType, list);
  }

  const selected: PlaceCandidate[] = [];
  const used = new Set<string>();
  const pattern = selectedStopTypes.length > 0 ? selectedStopTypes : inferPatternFromCandidates(ranked);

  let index = 0;
  while (selected.length < targetCount) {
    const preferredType = pattern[index % pattern.length];
    const preferredList = (byType.get(preferredType) || []).filter((candidate) => !used.has(candidate.id));
    const lastType = selected[selected.length - 1]?.stopType;
    let next = preferredList.find((candidate) => pattern.length === 1 || candidate.stopType !== lastType);

    if (!next) {
      next = ranked.find((candidate) => {
        if (used.has(candidate.id)) return false;
        if (pattern.length === 1) return true;
        return candidate.stopType !== lastType;
      });
    }

    if (!next) break;
    selected.push(next);
    used.add(next.id);
    index += 1;
  }

  return selected;
};

const inferPatternFromCandidates = (ranked: PlaceCandidate[]): StopType[] => {
  const stopTypes = Array.from(new Set(ranked.map((candidate) => candidate.stopType)));
  if (stopTypes.length > 0) return stopTypes;
  return STOP_TYPE_OPTIONS.map((option) => option.id).slice(0, 2);
};
