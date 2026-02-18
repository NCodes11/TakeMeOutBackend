import { StopType } from '@/types/models';

export interface CategoryPolicy {
  allowTypes: string[];
  denyTypes: string[];
  positiveKeywords: string[];
  denyKeywords: string[];
  nearbyTypes: string[];
  queryTerms: string[];
}

export interface CategoryEvalInput {
  name?: string;
  address?: string;
  types?: string[];
}

export interface CategoryEvalResult {
  accepted: boolean;
  score: number;
  reasons: string[];
}

/**
 * Global hard-deny keywords across all categories.
 * These eliminate grocery stores, big box chains, etc.
 */
const GLOBAL_DENY_KEYWORDS = [
  'walmart',
  'target',
  'costco',
  'kroger',
  'publix',
  'aldi',
  'whole foods',
  'trader joe',
  'pharmacy',
  'cvs',
  'walgreens',
  'supercenter',
  'grocery',
  'market',
  'liquor store',
  'dollar general',
];

/**
 * Hard deny place types across all categories.
 */
const GLOBAL_DENY_TYPES = [
  'grocery_or_supermarket',
  'supermarket',
  'convenience_store',
  'pharmacy',
  'drugstore',
  'gas_station',
  'hardware_store',
  'car_dealer',
  'car_rental',
  'atm',
  'bank',
];

export const CATEGORY_POLICIES: Record<StopType, CategoryPolicy> = {
  restaurant: {
    allowTypes: ['restaurant', 'meal_takeaway', 'food'],
    denyTypes: ['store', 'shopping_mall', ...GLOBAL_DENY_TYPES],
    positiveKeywords: ['restaurant', 'grill', 'kitchen', 'diner', 'eatery'],
    denyKeywords: [],
    nearbyTypes: ['restaurant'],
    queryTerms: ['restaurants near me', 'best food near me'],
  },

  coffee: {
    allowTypes: ['cafe', 'bakery'],
    denyTypes: ['bar', 'night_club', ...GLOBAL_DENY_TYPES],
    positiveKeywords: ['coffee', 'cafe', 'espresso', 'latte'],
    denyKeywords: [],
    nearbyTypes: ['cafe', 'bakery'],
    queryTerms: ['coffee shop near me', 'local cafe near me'],
  },

  dessert: {
    allowTypes: ['bakery', 'cafe'],
    denyTypes: [...GLOBAL_DENY_TYPES],
    positiveKeywords: ['ice cream', 'gelato', 'dessert', 'bakery', 'pastry'],
    denyKeywords: [],
    nearbyTypes: ['bakery'],
    queryTerms: ['dessert near me', 'ice cream near me'],
  },

  bar: {
    allowTypes: ['bar'],
    denyTypes: ['restaurant', ...GLOBAL_DENY_TYPES],
    positiveKeywords: ['bar', 'pub', 'taproom', 'cocktail'],
    denyKeywords: [],
    nearbyTypes: ['bar'],
    queryTerms: ['bars near me', 'cocktail bar near me'],
  },

  outdoors: {
    allowTypes: [
      'park',
      'tourist_attraction',
      'hiking_area',
      'trail',
      'nature_reserve',
      'beach',
      'viewpoint',
      'botanical_garden',
    ],
    denyTypes: [...GLOBAL_DENY_TYPES],
    positiveKeywords: [
      'park',
      'trail',
      'nature',
      'preserve',
      'garden',
      'lake',
      'beach',
      'boardwalk',
    ],
    denyKeywords: [],
    nearbyTypes: ['park', 'tourist_attraction'],
    queryTerms: ['parks near me', 'nature trails near me'],
  },

  arts: {
    allowTypes: ['museum', 'art_gallery', 'performing_arts_theater'],
    denyTypes: [...GLOBAL_DENY_TYPES],
    positiveKeywords: ['museum', 'gallery', 'theater', 'exhibit'],
    denyKeywords: [],
    nearbyTypes: ['museum', 'art_gallery'],
    queryTerms: ['museums near me', 'art galleries near me'],
  },

  activity: {
    allowTypes: [
      'bowling_alley',
      'amusement_center',
      'arcade',
      'tourist_attraction',
    ],
    denyTypes: [
      'movie_theater', // Explicitly block cinemas
      ...GLOBAL_DENY_TYPES,
    ],
    positiveKeywords: [
      'arcade',
      'bowling',
      'mini golf',
      'escape room',
      'go kart',
      'fun',
    ],
    denyKeywords: ['cinema', 'movie theater'],
    nearbyTypes: ['amusement_center', 'bowling_alley'],
    queryTerms: ['fun things to do near me', 'arcade near me'],
  },

  attraction: {
    allowTypes: [
      'tourist_attraction',
      'amusement_park',
      'zoo',
      'aquarium',
      'museum',
      'landmark',
    ],
    denyTypes: [...GLOBAL_DENY_TYPES],
    positiveKeywords: [
      'attraction',
      'theme park',
      'zoo',
      'aquarium',
      'landmark',
      'observation',
    ],
    denyKeywords: [],
    nearbyTypes: ['tourist_attraction', 'amusement_park'],
    queryTerms: ['top attractions near me', 'tourist attraction'],
  },

  shopping: {
    allowTypes: ['shopping_mall', 'clothing_store', 'department_store'],
    denyTypes: [...GLOBAL_DENY_TYPES],
    positiveKeywords: ['mall', 'boutique', 'shopping'],
    denyKeywords: [],
    nearbyTypes: ['shopping_mall'],
    queryTerms: ['shopping mall near me'],
  },
};

const containsAny = (haystack: string, needles: string[]) =>
  needles.some((needle) => haystack.includes(needle));

const overlaps = (values: string[], candidates: string[]) =>
  values.some((value) => candidates.includes(value));

export const evaluateCategoryCandidate = (
  stopType: StopType,
  place: CategoryEvalInput,
): CategoryEvalResult => {
  const policy = CATEGORY_POLICIES[stopType];

  const normalizedTypes = (place.types || []).map((t) => t.toLowerCase());
  const normalizedText = `${place.name || ''} ${place.address || ''}`.toLowerCase();

  const hasAllowType = overlaps(normalizedTypes, policy.allowTypes);
  const hasDenyType =
    overlaps(normalizedTypes, policy.denyTypes) ||
    overlaps(normalizedTypes, GLOBAL_DENY_TYPES);

  const hasPositiveKeyword = containsAny(normalizedText, policy.positiveKeywords);
  const hasDenyKeyword =
    containsAny(normalizedText, policy.denyKeywords) ||
    containsAny(normalizedText, GLOBAL_DENY_KEYWORDS);

  const reasons: string[] = [];

  let score = 0;
  if (hasAllowType) score += 3;
  if (hasPositiveKeyword) score += 2;
  if (hasDenyType) score -= 5;
  if (hasDenyKeyword) score -= 6;

  if (!hasAllowType && !hasPositiveKeyword) reasons.push('no_positive_signal');
  if (hasDenyType) reasons.push('deny_type');
  if (hasDenyKeyword) reasons.push('deny_keyword');

  const accepted = score >= 2 && !hasDenyType && !hasDenyKeyword;

  return {
    accepted,
    score,
    reasons,
  };
};
