import { StopType } from '@/types/models';

export interface StopTypeOption {
  id: StopType;
  label: string;
  queryKeywords: string[];
  fallback: StopType[];
}

export const STOP_TYPE_OPTIONS: StopTypeOption[] = [
  { id: 'coffee', label: 'Coffee', queryKeywords: ['cafe', 'coffee_shop'], fallback: ['dessert', 'restaurant'] },
  { id: 'restaurant', label: 'Restaurants', queryKeywords: ['restaurant', 'food_court'], fallback: ['coffee'] },
  { id: 'bar', label: 'Bars', queryKeywords: ['bar', 'pub', 'brewery'], fallback: ['restaurant', 'arts'] },
  { id: 'dessert', label: 'Dessert', queryKeywords: ['ice_cream', 'bakery', 'dessert'], fallback: ['coffee'] },
  { id: 'activity', label: 'Activities', queryKeywords: ['bowling_alley', 'cinema', 'arcade'], fallback: ['arts', 'outdoors'] },
  { id: 'attraction', label: 'Major Attractions', queryKeywords: ['tourist_attraction', 'theme_park', 'amusement_park'], fallback: ['activity', 'outdoors'] },
  { id: 'outdoors', label: 'Outdoors', queryKeywords: ['park', 'garden', 'viewpoint', 'trail'], fallback: ['activity'] },
  { id: 'shopping', label: 'Shopping', queryKeywords: ['mall', 'supermarket', 'gift_shop'], fallback: ['arts', 'coffee'] },
  { id: 'arts', label: 'Arts & Culture', queryKeywords: ['museum', 'gallery', 'theatre'], fallback: ['activity'] },
];

const LEGACY_LABEL_TO_TYPE: Record<string, StopType> = {
  food: 'restaurant',
  'coffee/dessert': 'coffee',
  outdoors: 'outdoors',
  museums: 'arts',
  shopping: 'shopping',
  movies: 'activity',
  arcade: 'activity',
  attractions: 'attraction',
  'theme parks': 'attraction',
  'live music': 'arts',
  'scenic views': 'outdoors',
  parks: 'outdoors',
};

const VALID_TYPES = new Set<StopType>(STOP_TYPE_OPTIONS.map((o) => o.id));

export const normalizeSelectedStopTypes = (values: string[]): StopType[] => {
  const mapped = values
    .map((value) => value.toLowerCase().trim())
    .map((value) => {
      if (VALID_TYPES.has(value as StopType)) return value as StopType;
      return LEGACY_LABEL_TO_TYPE[value];
    })
    .filter((value): value is StopType => Boolean(value));
  return Array.from(new Set(mapped));
};

export const stopTypeLabel = (stopType: StopType) => STOP_TYPE_OPTIONS.find((o) => o.id === stopType)?.label || stopType;
