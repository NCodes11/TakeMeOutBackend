import { normalizeSelectedStopTypes } from '@/constants/stopTypes';
import { GroupType, PlaceCandidate, StopType } from '@/types/models';

type SoloScorePlace = Pick<
  PlaceCandidate,
  'stopType' | 'category' | 'tags' | 'name' | 'address' | 'editorialSummary'
>;

type StopTypeRuleOverride = {
  maxDefault?: number;
  repeatWeight?: number;
  importance?: number;
};

export const SOLO_CATEGORY_WEIGHTS: Record<StopType, number> = {
  coffee: 4,
  restaurant: 1,
  bar: -3,
  dessert: 1,
  activity: 0,
  outdoors: 4,
  shopping: 3,
  arts: 3,
  attraction: 2,
};

export const SOLO_STOP_TYPE_RULE_OVERRIDES: Partial<Record<StopType, StopTypeRuleOverride>> = {
  coffee: { importance: 5, repeatWeight: 4 },
  restaurant: { importance: 4, repeatWeight: 2 },
  bar: { importance: 0, repeatWeight: 0, maxDefault: 1 },
  dessert: { importance: 3, repeatWeight: 2 },
  activity: { importance: 3, repeatWeight: 2 },
  outdoors: { importance: 6, repeatWeight: 5 },
  shopping: { importance: 5, repeatWeight: 4 },
  arts: { importance: 6, repeatWeight: 4 },
  attraction: { importance: 5, repeatWeight: 3 },
};

const SOLO_CASUAL_KEYWORDS = [
  'cafe',
  'coffee',
  'bakery',
  'tea',
  'park',
  'trail',
  'garden',
  'museum',
  'gallery',
  'quiet',
  'cozy',
  'casual',
  'scenic',
  'view',
  'viewpoint',
  'waterfront',
  'boardwalk',
  'self-guided',
  'independent',
];

const SOLO_BROWSING_KEYWORDS = [
  'book',
  'bookstore',
  'book store',
  'browse',
  'browsing',
  'boutique',
  'market',
  'record store',
  'records',
  'historic',
];

const SOLO_SOCIAL_KEYWORDS = [
  'night_club',
  'nightclub',
  'karaoke',
  'sports bar',
  'sports_bar',
  'party',
  'banquet',
  'event_venue',
  'event venue',
  'dance',
  'crowd',
  'shared plates',
];

const containsAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

export const getExplicitSelectedStopTypes = (interests: string[]) => normalizeSelectedStopTypes(interests);

export const getSoloSuitabilityScore = (
  place: SoloScorePlace,
  explicitSelectedStopTypes: readonly StopType[] = [],
  outingType?: GroupType,
): number => {
  if (outingType !== 'Solo') return 0;

  const blob = [
    place.stopType,
    place.category,
    place.name,
    place.address,
    place.editorialSummary || '',
    ...place.tags,
  ]
    .join(' ')
    .toLowerCase();

  let score = SOLO_CATEGORY_WEIGHTS[place.stopType] ?? 0;

  if (containsAny(blob, SOLO_CASUAL_KEYWORDS)) score += 2;
  if (containsAny(blob, SOLO_BROWSING_KEYWORDS)) score += 1;
  if (containsAny(blob, SOLO_SOCIAL_KEYWORDS)) score -= 2;

  if (explicitSelectedStopTypes.includes(place.stopType) && score < 0) {
    score = Math.ceil(score / 2);
  }

  return score;
};

export const getSoloPreferredPosition = (
  stopType: StopType,
  totalWindowMinutes: number,
  startsLate: boolean,
) => {
  if (stopType === 'coffee') return Math.floor(totalWindowMinutes * 0.08);
  if (stopType === 'outdoors') return Math.floor(totalWindowMinutes * (startsLate ? 0.4 : 0.24));
  if (stopType === 'arts') return Math.floor(totalWindowMinutes * 0.38);
  if (stopType === 'shopping') return Math.floor(totalWindowMinutes * 0.48);
  if (stopType === 'attraction') return Math.floor(totalWindowMinutes * 0.56);
  if (stopType === 'activity') return Math.floor(totalWindowMinutes * 0.6);
  if (stopType === 'restaurant') return Math.floor(totalWindowMinutes * 0.72);
  if (stopType === 'dessert') return Math.floor(totalWindowMinutes * 0.84);
  return totalWindowMinutes - 1;
};
