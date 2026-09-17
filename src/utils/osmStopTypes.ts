import { StopType } from '@/types/models';

type OsmTagKey = 'amenity' | 'tourism' | 'leisure' | 'shop' | 'natural';
type OsmTagPatterns = Partial<Record<OsmTagKey, string[]>>;

const normalizeTagValue = (value?: string) => value?.trim().toLowerCase() || '';

const unique = <T,>(values: T[]) => Array.from(new Set(values));

export const OSM_STOP_TYPE_PATTERNS: Record<StopType, OsmTagPatterns> = {
  restaurant: {
    amenity: ['restaurant', 'fast_food', 'food_court'],
  },
  coffee: {
    amenity: ['cafe'],
    shop: ['coffee', 'tea', 'bakery'],
  },
  bar: {
    amenity: ['bar', 'pub', 'biergarten', 'nightclub'],
  },
  dessert: {
    amenity: ['ice_cream'],
    shop: ['bakery', 'chocolate', 'confectionery', 'pastry'],
  },
  activity: {
    amenity: ['bowling_alley', 'cinema', 'casino'],
    leisure: ['amusement_arcade', 'escape_game', 'miniature_golf', 'water_park', 'sports_centre'],
    tourism: ['theme_park'],
  },
  attraction: {
    tourism: ['attraction', 'theme_park', 'zoo', 'aquarium', 'museum', 'gallery'],
    leisure: ['water_park', 'amusement_arcade'],
  },
  outdoors: {
    leisure: ['park', 'garden', 'nature_reserve', 'beach_resort'],
    tourism: ['viewpoint', 'picnic_site', 'camp_site'],
    natural: ['beach'],
  },
  shopping: {
    shop: ['mall', 'department_store', 'clothes', 'gift', 'shoes', 'jewelry', 'books', 'electronics', 'boutique'],
  },
  arts: {
    amenity: ['arts_centre', 'theatre'],
    tourism: ['museum', 'gallery', 'artwork'],
  },
};

const OSM_STOP_TYPE_ALIASES: Record<StopType, string[]> = {
  restaurant: ['restaurant', 'food', 'meal_takeaway'],
  coffee: ['cafe', 'coffee_shop', 'bakery'],
  bar: ['bar', 'night_club'],
  dessert: ['dessert_shop', 'ice_cream_shop', 'bakery'],
  activity: ['tourist_attraction', 'amusement_center', 'bowling_alley'],
  attraction: ['tourist_attraction', 'amusement_park', 'point_of_interest'],
  outdoors: ['park', 'tourist_attraction', 'natural_feature'],
  shopping: ['shopping_mall', 'department_store', 'store'],
  arts: ['museum', 'art_gallery', 'performing_arts_theater', 'cultural_center'],
};

const matchesStopType = (tags: Record<string, string> | undefined, stopType: StopType) => {
  const patterns = OSM_STOP_TYPE_PATTERNS[stopType];

  return (Object.entries(patterns) as Array<[OsmTagKey, string[] | undefined]>).some(([key, values]) => {
    if (!values?.length) return false;
    const tagValue = normalizeTagValue(tags?.[key]);
    return Boolean(tagValue) && values.includes(tagValue);
  });
};

export const buildOsmQueryPattern = (stopTypes: StopType[], key: OsmTagKey) => {
  const values = unique(
    stopTypes.flatMap((stopType) => OSM_STOP_TYPE_PATTERNS[stopType][key] || []),
  );

  return values.join('|');
};

export const inferOsmStopType = (
  tags: Record<string, string> | undefined,
  requestedStopTypes: StopType[],
): StopType | null => {
  const orderedStopTypes = requestedStopTypes.length
    ? requestedStopTypes
    : (Object.keys(OSM_STOP_TYPE_PATTERNS) as StopType[]);

  for (const stopType of orderedStopTypes) {
    if (matchesStopType(tags, stopType)) return stopType;
  }

  return null;
};

export const buildOsmCandidateTypes = (
  tags: Record<string, string> | undefined,
  inferredStopType: StopType,
) => {
  const rawTypes = [
    tags?.amenity,
    tags?.tourism,
    tags?.leisure,
    tags?.shop,
    tags?.natural,
  ]
    .map(normalizeTagValue)
    .filter(Boolean);

  return unique([...rawTypes, ...OSM_STOP_TYPE_ALIASES[inferredStopType]]);
};
