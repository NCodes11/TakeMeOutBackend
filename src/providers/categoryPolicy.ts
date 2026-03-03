import { StopType } from '@/types/models';

export interface CategoryPolicy {
  allowTypes: string[];
  denyTypes: string[];
  positiveKeywords: string[];
  denyKeywords: string[];
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
 * Types to hard-reject across the entire app (regardless of stopType),
 * because you explicitly don't want these suggested.
 */
const GLOBAL_DENY_TYPES = new Set<string>([
  'movie_theater',
  'grocery_store',
  'supermarket',
  'grocery_or_supermarket',
  'convenience_store',
  'wholesaler',
]);

const GLOBAL_DENY_KEYWORDS = [
  'movie theater',
  'cinema',
  'cine',
  'theatre',
  'theater',
  'grocery',
  'supermarket',
  'convenience store',
];

export const CATEGORY_POLICIES: Record<StopType, CategoryPolicy> = {
  outdoors: {
    allowTypes: [
      'park',
      'national_park',
      'nature_reserve',
      'botanical_garden',
      'hiking_area',
      'trail',
      'campground',
      'beach',
      'marina',
      'viewpoint',
      'natural_feature',
      'tourist_attraction',
      'zoo',
      'aquarium',
    ],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'shopping_mall',
      'department_store',
      'clothing_store',
      'electronics_store',
      'home_goods_store',
      'furniture_store',
      'hardware_store',
      'pharmacy',
      'gas_station',
      'bank',
      'atm',
      'car_dealer',
      'car_rental',
      'store',
    ],
    positiveKeywords: ['park', 'trail', 'nature', 'garden', 'lake', 'river', 'beach', 'preserve', 'boardwalk', 'viewpoint'],
    denyKeywords: ['walmart', 'target', 'costco', 'outlet', 'mall', 'pharmacy', ...GLOBAL_DENY_KEYWORDS],
  },

  shopping: {
    allowTypes: [
      'shopping_mall',
      'department_store',
      'clothing_store',
      'shoe_store',
      'electronics_store',
      'home_goods_store',
      'furniture_store',
      'hardware_store',
      'store',
    ],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'park',
      'campground',
      'hiking_area',
      'trail',
      'natural_feature',
      'nature_reserve',
      'beach',
    ],
    positiveKeywords: ['mall', 'outlet', 'plaza', 'shopping', 'store', 'boutique'],
    denyKeywords: ['park', 'trail', 'preserve', 'nature', 'beach', ...GLOBAL_DENY_KEYWORDS],
  },

  restaurant: {
    allowTypes: ['restaurant', 'meal_takeaway', 'meal_delivery', 'food'],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'shopping_mall',
      'department_store',
      'store',
      'park',
      'campground',
      'gas_station',
    ],
    positiveKeywords: ['restaurant', 'grill', 'kitchen', 'diner', 'eatery', 'bistro', 'steakhouse', 'sushi', 'pizza'],
    denyKeywords: ['walmart', 'target', 'costco', 'mall', 'gas', 'station', ...GLOBAL_DENY_KEYWORDS],
  },

  coffee: {
    allowTypes: ['cafe', 'coffee_shop', 'bakery'],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'night_club',
      'bar',
      'shopping_mall',
      'department_store',
      'store',
      'gas_station',
      'pharmacy',
    ],
    positiveKeywords: ['coffee', 'cafe', 'espresso', 'latte', 'roastery', 'tea'],
    denyKeywords: ['walmart', 'target', 'outlet', 'pharmacy', 'gas', ...GLOBAL_DENY_KEYWORDS],
  },

  bar: {
    allowTypes: ['bar', 'night_club'],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'shopping_mall',
      'department_store',
      'store',
      'park',
      'restaurant', // helps avoid generic restaurants getting labeled as "bar"
    ],
    positiveKeywords: ['bar', 'pub', 'taproom', 'cocktail', 'brewery', 'speakeasy'],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter', ...GLOBAL_DENY_KEYWORDS],
  },

  dessert: {
    allowTypes: ['bakery', 'dessert_shop', 'ice_cream_shop', 'cafe'],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'shopping_mall',
      'department_store',
      'store',
      'hardware_store',
      'gas_station',
      'pharmacy',
    ],
    positiveKeywords: ['dessert', 'ice cream', 'gelato', 'bakery', 'pastry', 'donut', 'cake', 'cookies'],
    denyKeywords: ['walmart', 'target', 'gas', 'station', ...GLOBAL_DENY_KEYWORDS],
  },

  activity: {
    // IMPORTANT: movie_theater intentionally not allowed.
    allowTypes: [
      'bowling_alley',
      'arcade',
      'amusement_center',
      'amusement_park',
      'tourist_attraction',
      'mini_golf_course',
      'escape_room',
      'water_park',
    ],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'grocery_or_supermarket',
      'shopping_mall',
      'department_store',
      'hardware_store',
      'pharmacy',
      'store',
    ],
    positiveKeywords: ['arcade', 'bowling', 'mini golf', 'escape room', 'go kart', 'fun', 'activity', 'laser tag'],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter', ...GLOBAL_DENY_KEYWORDS],
  },

  arts: {
    allowTypes: ['museum', 'art_gallery', 'performing_arts_theater', 'cultural_center'],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'shopping_mall',
      'department_store',
      'hardware_store',
      'pharmacy',
      'store',
    ],
    positiveKeywords: ['museum', 'gallery', 'exhibit', 'arts', 'cultural', 'theater', 'theatre'],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter', ...GLOBAL_DENY_KEYWORDS],
  },

  attraction: {
    allowTypes: ['tourist_attraction', 'amusement_park', 'zoo', 'aquarium', 'museum', 'landmark', 'point_of_interest'],
    denyTypes: [
      ...Array.from(GLOBAL_DENY_TYPES),
      'shopping_mall',
      'department_store',
      'convenience_store',
      'electronics_store',
      'home_goods_store',
      'hardware_store',
      'pharmacy',
      'gas_station',
      'store',
    ],
    positiveKeywords: ['attraction', 'landmark', 'zoo', 'aquarium', 'museum', 'theme park', 'water park', 'observation', 'visitor center'],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter', ...GLOBAL_DENY_KEYWORDS],
  },
};

const containsAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));
const overlaps = (values: string[], candidates: string[]) => values.some((value) => candidates.includes(value));

const normalizeTypes = (types?: string[]) => (types || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);

export const evaluateCategoryCandidate = (stopType: StopType, place: CategoryEvalInput): CategoryEvalResult => {
  const policy = CATEGORY_POLICIES[stopType];

  const types = normalizeTypes(place.types);
  const text = `${place.name || ''} ${place.address || ''}`.toLowerCase();

  // 1) Global hard rejects
  const globalDenyType = types.some((t) => GLOBAL_DENY_TYPES.has(t));
  const globalDenyKeyword = containsAny(text, GLOBAL_DENY_KEYWORDS);

  // 2) Per-category type + keyword signals
  const hasAllowType = overlaps(types, policy.allowTypes);
  const hasDenyType = overlaps(types, policy.denyTypes);

  const hasPositiveKeyword = containsAny(text, policy.positiveKeywords);
  const hasDenyKeyword = containsAny(text, policy.denyKeywords);

  const reasons: string[] = [];

  if (globalDenyType) reasons.push('global_deny_type_match');
  if (globalDenyKeyword) reasons.push('global_deny_keyword_match');

  if (hasDenyType) reasons.push('deny_type_match');
  if (hasDenyKeyword) reasons.push('deny_keyword_match');

  // If we have types, demand at least one allow-type (keywords are fallback)
  const hasAnyTypes = types.length > 0;
  if (hasAnyTypes && !hasAllowType) reasons.push('missing_allow_type');

  // Scoring (simple + robust)
  let score = 0;
  if (hasAllowType) score += 4;
  if (!hasAnyTypes && hasPositiveKeyword) score += 2; // keyword fallback only when types are missing
  if (hasDenyKeyword) score -= 6;
  if (hasDenyType) score -= 3;
  if (globalDenyType || globalDenyKeyword) score -= 10;

  const hardRejected =
    globalDenyType ||
    globalDenyKeyword ||
    hasDenyType ||
    hasDenyKeyword ||
    (hasAnyTypes && !hasAllowType);

  // If we had no types, allow keyword-only acceptance with a higher threshold.
  const threshold = hasAnyTypes ? 2 : 3;

  const accepted = !hardRejected && score >= threshold;

  if (!accepted) reasons.push('rejected');

  return { accepted, score, reasons };
};
