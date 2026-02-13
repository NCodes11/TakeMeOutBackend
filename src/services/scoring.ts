import { PlaceCandidate, PlanPreferences } from '@/types/models';
import { normalizeSelectedStopTypes } from '@/constants/stopTypes';

export const scorePlace = (place: PlaceCandidate, preferences: PlanPreferences): number => {
  let score = 0;
  const selectedTypes = normalizeSelectedStopTypes(preferences.interests);
  if (selectedTypes.includes(place.stopType)) score += 5;
  if (preferences.interests.includes(place.category)) score += 4;
  for (const tag of place.tags) {
    if (preferences.interests.some((i) => tag.toLowerCase().includes(i.toLowerCase()))) score += 1;
  }
  if (preferences.kidFriendly && place.tags.some((t) => /kid|family|park/i.test(t))) score += 2;
  if (preferences.accessibleFriendly && place.tags.some((t) => /accessible|wheelchair/i.test(t))) score += 2;
  if (preferences.avoid.some((a) => place.name.toLowerCase().includes(a.toLowerCase()))) score -= 4;
  if (preferences.mustInclude && place.name.toLowerCase().includes(preferences.mustInclude.toLowerCase())) score += 3;
  return score;
};
