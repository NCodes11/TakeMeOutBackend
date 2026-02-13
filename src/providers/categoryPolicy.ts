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

export const CATEGORY_POLICIES: Record<StopType, CategoryPolicy> = {
  outdoors: {
    allowTypes: [
      'park',
      'tourist_attraction',
      'campground',
      'hiking_area',
      'trail',
      'national_park',
      'nature_reserve',
      'botanical_garden',
      'amusement_park',
      'zoo',
      'aquarium',
      'beach',
      'marina',
      'viewpoint',
      'natural_feature',
    ],
    denyTypes: [
      'grocery_or_supermarket',
      'supermarket',
      'convenience_store',
      'department_store',
      'clothing_store',
      'electronics_store',
      'home_goods_store',
      'furniture_store',
      'hardware_store',
      'pharmacy',
      'gas_station',
      'car_dealer',
      'car_rental',
      'bank',
      'atm',
      'store',
      'shopping_mall',
    ],
    positiveKeywords: [
      'park',
      'trail',
      'nature',
      'preserve',
      'garden',
      'lake',
      'river',
      'beach',
      'state park',
      'national park',
      'wildlife',
      'boardwalk',
    ],
    denyKeywords: [
      'walmart',
      'target',
      'costco',
      'publix',
      'kroger',
      'market',
      'supercenter',
      'grocery',
      'pharmacy',
      'outlet',
      'cvs',
      'walgreens',
      'aldi',
      'dollar general',
    ],
    nearbyTypes: ['park', 'tourist_attraction'],
    queryTerms: ['parks near me', 'hiking trails near me', 'nature preserve near me', 'boardwalk near me'],
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
      'supermarket',
      'grocery_or_supermarket',
      'convenience_store',
      'store',
    ],
    denyTypes: ['park', 'campground', 'hiking_area', 'trail', 'natural_feature', 'nature_reserve', 'beach'],
    positiveKeywords: ['mall', 'outlet', 'store', 'shop', 'market', 'plaza'],
    denyKeywords: ['park', 'trail', 'preserve', 'nature', 'beach', 'campground'],
    nearbyTypes: ['shopping_mall', 'department_store', 'store'],
    queryTerms: ['shopping mall near me', 'stores near me', 'outlet mall near me'],
  },
  restaurant: {
    allowTypes: ['restaurant', 'meal_takeaway', 'meal_delivery', 'food'],
    denyTypes: ['store', 'shopping_mall', 'park', 'campground', 'grocery_or_supermarket'],
    positiveKeywords: ['restaurant', 'grill', 'kitchen', 'diner', 'eatery'],
    denyKeywords: ['walmart', 'target', 'park', 'trail'],
    nearbyTypes: ['restaurant'],
    queryTerms: ['restaurants near me', 'food near me'],
  },
  coffee: {
    allowTypes: ['cafe', 'bakery', 'coffee_shop'],
    denyTypes: ['bar', 'night_club', 'store', 'shopping_mall'],
    positiveKeywords: ['coffee', 'cafe', 'espresso', 'latte'],
    denyKeywords: ['walmart', 'target', 'outlet', 'pharmacy'],
    nearbyTypes: ['cafe', 'bakery'],
    queryTerms: ['coffee shops near me', 'cafes near me'],
  },
  bar: {
    allowTypes: ['bar', 'night_club'],
    denyTypes: ['store', 'shopping_mall', 'park', 'grocery_or_supermarket', 'restaurant'],
    positiveKeywords: ['bar', 'pub', 'taproom', 'cocktail'],
    denyKeywords: ['walmart', 'target', 'market', 'park'],
    nearbyTypes: ['bar', 'night_club'],
    queryTerms: ['bars near me', 'pub near me'],
  },
  dessert: {
    allowTypes: ['bakery', 'cafe', 'ice_cream_shop', 'dessert_shop'],
    denyTypes: ['shopping_mall', 'park', 'hardware_store', 'gas_station'],
    positiveKeywords: ['dessert', 'ice cream', 'gelato', 'bakery', 'pastry'],
    denyKeywords: ['walmart', 'target', 'gas'],
    nearbyTypes: ['bakery', 'cafe'],
    queryTerms: ['dessert near me', 'ice cream near me', 'bakery near me'],
  },
  activity: {
    allowTypes: ['bowling_alley', 'movie_theater', 'amusement_center', 'arcade', 'tourist_attraction', 'amusement_park'],
    denyTypes: ['grocery_or_supermarket', 'shopping_mall', 'hardware_store', 'pharmacy'],
    positiveKeywords: ['arcade', 'bowling', 'cinema', 'activity', 'fun', 'mini golf', 'go kart', 'escape room'],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter'],
    nearbyTypes: ['tourist_attraction', 'movie_theater', 'bowling_alley'],
    queryTerms: ['things to do near me', 'arcade near me', 'mini golf near me', 'bowling near me'],
  },
  arts: {
    allowTypes: ['museum', 'art_gallery', 'performing_arts_theater'],
    denyTypes: ['grocery_or_supermarket', 'shopping_mall', 'hardware_store', 'pharmacy'],
    positiveKeywords: ['museum', 'gallery', 'theater', 'arts', 'exhibit'],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter'],
    nearbyTypes: ['museum', 'art_gallery'],
    queryTerms: ['museums near me', 'art galleries near me', 'theaters near me'],
  },
  attraction: {
    allowTypes: ['tourist_attraction', 'amusement_park', 'point_of_interest', 'zoo', 'aquarium', 'museum', 'landmark'],
    denyTypes: [
      'grocery_or_supermarket',
      'shopping_mall',
      'hardware_store',
      'pharmacy',
      'gas_station',
      'department_store',
      'convenience_store',
      'electronics_store',
      'store',
    ],
    positiveKeywords: [
      'theme park',
      'attraction',
      'zoo',
      'aquarium',
      'museum',
      'resort',
      'disney',
      'universal',
      'observation',
      'visitor center',
      'landmark',
      'water park',
    ],
    denyKeywords: ['walmart', 'target', 'market', 'supercenter'],
    nearbyTypes: ['tourist_attraction', 'amusement_park', 'museum', 'aquarium', 'zoo'],
    queryTerms: [
      'tourist attraction',
      'theme park',
      'amusement park',
      'landmark',
      'things to do',
      'museum',
      'aquarium',
      'zoo',
      'water park',
      'observation wheel',
      'visitor center',
    ],
  },
};

const containsAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));
const overlaps = (values: string[], candidates: string[]) => values.some((value) => candidates.includes(value));

export const evaluateCategoryCandidate = (stopType: StopType, place: CategoryEvalInput): CategoryEvalResult => {
  const policy = CATEGORY_POLICIES[stopType];
  const normalizedTypes = (place.types || []).map((type) => type.toLowerCase());
  const normalizedText = `${place.name || ''} ${place.address || ''}`.toLowerCase();

  const hasAllowType = overlaps(normalizedTypes, policy.allowTypes);
  const hasDenyType = overlaps(normalizedTypes, policy.denyTypes);
  const hasPositiveKeyword = containsAny(normalizedText, policy.positiveKeywords);
  const hasDenyKeyword = containsAny(normalizedText, policy.denyKeywords);

  const reasons: string[] = [];
  if (!hasAllowType && !hasPositiveKeyword) reasons.push('missing_allow_signal');
  if (hasDenyType) reasons.push('deny_type_match');
  if (hasDenyKeyword) reasons.push('deny_keyword_match');

  let score = 0;
  if (hasAllowType) score += 3;
  if (hasPositiveKeyword) score += 2;
  if (hasDenyKeyword) score -= 5;
  if (hasDenyType) score -= 2;
  if (score < 2) reasons.push('score_below_threshold');

  const hardRejected = hasDenyType || hasDenyKeyword || (!hasAllowType && !hasPositiveKeyword);
  return {
    accepted: !hardRejected && score >= 2,
    score,
    reasons,
  };
};
