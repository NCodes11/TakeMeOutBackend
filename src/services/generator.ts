import { v4 as uuid } from 'uuid';
import { PlaceCandidate, Stop, WizardInput } from '@/types/models';
import { stopsForPace, scorePlace } from './scoring';
import { RoutingProvider } from '@/providers/routingProvider';

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const generateStops = async (
  planId: string,
  input: WizardInput,
  candidates: PlaceCandidate[],
  routing: RoutingProvider,
): Promise<Stop[]> => {
  const totalMinutes = parseMinutes(input.endTime) - parseMinutes(input.startTime);
  const count = stopsForPace(input.pace, totalMinutes);

  const ranked = [...candidates]
    .map((p) => ({ p, s: scorePlace(p, input.preferences) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(count * 2, 6))
    .map((r) => r.p);

  const selected = ranked.slice(0, count);
  if (selected.length === 0) {
    selected.push({ id: 'generic-park', name: 'City Park Walk', lat: 0, lng: 0, category: 'Parks', address: input.city, tags: ['Outdoors'] });
    selected.push({ id: 'generic-cafe', name: 'Local Cafe Break', lat: 0, lng: 0, category: 'Coffee/Dessert', address: input.city, tags: ['Coffee'] });
    selected.push({ id: 'generic-dinner', name: 'Dinner Reservation', lat: 0, lng: 0, category: 'Food', address: input.city, tags: ['Food'] });
  }

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
      id: uuid(),
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
      etaMin: travel,
      distanceKm: distance,
    };
  });
};
