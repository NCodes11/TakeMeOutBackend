const OUTDOORS_ALLOW_TYPES = [
  'park',
  'tourist_attraction',
  'campground',
  'zoo',
  'amusement_park',
  'museum',
  'aquarium',
  'stadium',
];

const OUTDOORS_DENY_TYPES = [
  'grocery_or_supermarket',
  'supermarket',
  'convenience_store',
  'department_store',
  'hardware_store',
  'pharmacy',
  'gas_station',
  'store',
  'shopping_mall',
];

const OUTDOORS_DENY_KEYWORDS = [
  'grocery',
  'market',
  'walmart',
  'target',
  'stop & shop',
  'hannaford',
  'aldi',
  'cvs',
  'walgreens',
  '7-eleven',
  'shell',
  'exxon',
  'mobil',
  'dollar general',
];

const OUTDOORS_POSITIVE_KEYWORDS = [
  'park',
  'trail',
  'beach',
  'reserve',
  'state park',
  'nature',
  'garden',
  'arboretum',
  'lake',
  'river',
  'hike',
];

export interface OutdoorsRelevanceInput {
  name?: string;
  vicinity?: string;
  types?: string[];
}

export interface OutdoorsRelevanceResult {
  accepted: boolean;
  score: number;
  reasons: string[];
}

const includesAny = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));
const intersects = (values: string[], candidates: string[]) => values.some((value) => candidates.includes(value));

export const evaluateOutdoorsRelevance = (place: OutdoorsRelevanceInput): OutdoorsRelevanceResult => {
  // Outdoors filter is intentionally strict to block retail/grocery false positives.
  const reasons: string[] = [];
  const types = (place.types || []).map((type) => type.toLowerCase());
  const searchable = `${place.name || ''} ${place.vicinity || ''}`.toLowerCase();

  const hasAllowType = intersects(types, OUTDOORS_ALLOW_TYPES);
  const hasDenyType = intersects(types, OUTDOORS_DENY_TYPES);
  const hasDenyKeyword = includesAny(searchable, OUTDOORS_DENY_KEYWORDS);
  const hasPositiveKeyword = includesAny(searchable, OUTDOORS_POSITIVE_KEYWORDS);

  if (!hasAllowType) reasons.push('missing_allow_type');
  if (hasDenyType) reasons.push('deny_type_match');
  if (hasDenyKeyword) reasons.push('deny_keyword_match');

  let score = 0;
  if (hasAllowType) score += 3;
  if (hasPositiveKeyword) score += 2;
  if (hasDenyKeyword) score -= 5;
  if (hasDenyType) score -= 2;

  if (score < 2) reasons.push('score_below_threshold');

  const hardRejected = hasDenyType || hasDenyKeyword || !hasAllowType;
  return {
    accepted: !hardRejected && score >= 2,
    score,
    reasons,
  };
};
