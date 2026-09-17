import { cachePlaces, clearCachedPlaces, getCachedPlaces } from '@/db/sqlite';
import { normalizeSelectedStopTypes, stopTypeLabel } from '@/constants/stopTypes';
import {
  BudgetType,
  GroupType,
  OpeningPeriod,
  PlaceCandidate,
  PlacePhoto,
  StopType,
  TransportType,
} from '@/types/models';
import { logPerf, perfNow } from '@/utils/perf';
import { formatOsmDisplayAddress } from '@/utils/osmAddress';
import {
  buildOsmCandidateTypes,
  buildOsmQueryPattern,
  inferOsmStopType,
} from '@/utils/osmStopTypes';
import { fetchNominatimCoordinates } from '@/utils/geocoding';

interface SearchOrigin {
  lat: number;
  lng: number;
}

interface GooglePhotoRow {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: Array<string | { displayName?: string; uri?: string }>;
}

interface GoogleOpeningPoint {
  day?: number;
  hour?: number;
  minute?: number;
}

interface GoogleOpeningPeriodRow {
  open?: GoogleOpeningPoint;
  close?: GoogleOpeningPoint;
}

interface GoogleOpeningHoursRow {
  openNow?: boolean;
  periods?: GoogleOpeningPeriodRow[];
  weekdayDescriptions?: string[];
}

type GooglePriceLevel =
  | number
  | 'PRICE_LEVEL_UNSPECIFIED'
  | 'PRICE_LEVEL_FREE'
  | 'PRICE_LEVEL_INEXPENSIVE'
  | 'PRICE_LEVEL_MODERATE'
  | 'PRICE_LEVEL_EXPENSIVE'
  | 'PRICE_LEVEL_VERY_EXPENSIVE';

interface GooglePlaceRow {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: GooglePriceLevel;
  photos?: GooglePhotoRow[];
  currentOpeningHours?: GoogleOpeningHoursRow;
  regularOpeningHours?: GoogleOpeningHoursRow;
}

interface OverpassElementRow {
  id: string | number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export interface PlacesSearchOptions {
  transport?: TransportType;
  maxTravelMinutes?: number;
  stopCount?: number;

  groupType?: GroupType;
  budget?: BudgetType;

  mode?: 'plan' | 'reroll';
  cacheTtlMinutes?: number;
  cacheBuster?: string;
}

export interface PlacesProvider {
  search(
    city: string,
    interests: string[],
    origin?: SearchOrigin,
    desiredCount?: number,
    options?: PlacesSearchOptions,
  ): Promise<{ places: PlaceCandidate[]; warnings: string[] }>;
}

const GOOGLE_MAX_RADIUS_METERS = 50000;
const OSM_RADIUS_METERS = 12000;
const DEFAULT_CACHE_TTL_MINUTES = 30;
const GEO_CACHE_TTL_MS = 12 * 3600_000;
const PROVIDER_CACHE_VERSION = 'search-v3';

const searchResultCache = new Map<
  string,
  { expiresAt: number; result: { places: PlaceCandidate[]; warnings: string[] } }
>();
const inflightSearchCache = new Map<
  string,
  Promise<{ places: PlaceCandidate[]; warnings: string[] }>
>();
const geocodeCache = new Map<string, { expiresAt: number; origin: SearchOrigin }>();

const speedKmh = (mode: TransportType) => (mode === 'walk' ? 4.5 : 35);

const computeSearchRadius = (transport: TransportType, maxTravelMinutes: number) => {
  const speed = speedKmh(transport);
  const km = (speed * maxTravelMinutes) / 60;
  const meters = km * 1000;

  if (transport === 'walk') {
    return Math.min(3500, Math.max(500, meters * 1.15));
  }

  return Math.min(GOOGLE_MAX_RADIUS_METERS, Math.max(4000, meters * 2.2));
};

const googlePriceLevelToNumeric = (priceLevel?: GooglePriceLevel): number | undefined => {
  if (priceLevel == null) return undefined;

  if (typeof priceLevel === 'number' && Number.isFinite(priceLevel)) {
    return priceLevel;
  }

  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4;
    default:
      return undefined;
  }
};

const googlePriceLevelToCostLevel = (priceLevel?: GooglePriceLevel): string => {
  const numeric = googlePriceLevelToNumeric(priceLevel);
  if (numeric == null) return 'Unknown';
  if (numeric <= 1) return '$';
  if (numeric === 2) return '$$';
  if (numeric === 3) return '$$$';
  return '$$$$';
};

const roundCoord = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : 'na';

const buildSearchCacheKey = (
  city: string,
  stopTypes: StopType[],
  origin: SearchOrigin | undefined,
  desiredCount: number,
  radiusMeters: number,
  options?: PlacesSearchOptions,
) =>
  [
    PROVIDER_CACHE_VERSION,
    city.trim().toLowerCase(),
    stopTypes.slice().sort().join(','),
    roundCoord(origin?.lat),
    roundCoord(origin?.lng),
    desiredCount,
    radiusMeters,
    options?.transport ?? 'drive',
    options?.maxTravelMinutes ?? '',
    options?.groupType ?? '',
    options?.budget ?? '',
    options?.mode ?? 'plan',
  ].join('|');

const buildProviderKey = (
  provider: 'google' | 'osm',
  city: string,
  token: string,
  origin: SearchOrigin | undefined,
  radiusMeters: number,
  budget?: BudgetType,
) =>
  [
    PROVIDER_CACHE_VERSION,
    provider,
    city.trim().toLowerCase(),
    token,
    roundCoord(origin?.lat),
    roundCoord(origin?.lng),
    radiusMeters,
    budget ?? '',
  ].join('|');

const cacheTtlMinutes = (value?: number) =>
  Math.max(
    1,
    Math.round(
      typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_CACHE_TTL_MINUTES,
    ),
  );

const readProviderCache = (
  providerKey: string,
  ttlMinutes: number,
  bypass: boolean,
): PlaceCandidate[] => {
  const rows = getCachedPlaces(providerKey, ttlMinutes / 60, bypass);
  return rows
    .map((row) => {
      try {
        return JSON.parse(row.rawJSON) as PlaceCandidate;
      } catch {
        return null;
      }
    })
    .filter((row): row is PlaceCandidate => Boolean(row));
};

const writeProviderCache = (providerKey: string, places: PlaceCandidate[]) => {
  clearCachedPlaces(providerKey);
  if (places.length === 0) return;

  cachePlaces(
    places.map((place) => ({
      providerKey,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      category: place.category,
      rawJSON: JSON.stringify(place),
    })),
  );
};

const toOpeningPeriods = (periods?: GoogleOpeningPeriodRow[]): OpeningPeriod[] => {
  if (!Array.isArray(periods)) return [];

  return periods
    .map((period) => {
      const open = period?.open;
      const close = period?.close;

      if (typeof open?.day !== 'number') return null;
      if (typeof open?.hour !== 'number') return null;
      if (typeof close?.hour !== 'number') return null;

      const openMinutes = open.hour * 60 + (open.minute || 0);
      const closeMinutes = close.hour * 60 + (close.minute || 0);

      return {
        day: open.day,
        openMinutes,
        closeMinutes,
      } satisfies OpeningPeriod;
    })
    .filter((row): row is OpeningPeriod => Boolean(row));
};

const stopTypeQueryVariants = (stopType: StopType): string[] => {
  switch (stopType) {
    case 'restaurant':
      return ['restaurant', 'fine dining restaurant', 'popular restaurant'];
    case 'coffee':
      return ['coffee shop', 'cafe', 'specialty coffee'];
    case 'dessert':
      return ['dessert', 'bakery', 'ice cream shop'];
    case 'bar':
      return ['bar', 'cocktail bar', 'wine bar'];
    case 'activity':
      return ['activity', 'things to do', 'fun activity'];
    case 'outdoors':
      return ['park', 'outdoor attraction', 'scenic spot'];
    case 'shopping':
      return ['shopping', 'boutique', 'mall'];
    case 'arts':
      return ['art gallery', 'museum', 'cultural center'];
    case 'attraction':
      return ['tourist attraction', 'landmark', 'must see attraction'];
    default:
      return [stopType];
  }
};

const firstAvailableTag = (tags: Record<string, string> | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = tags?.[key]?.trim();
    if (value) return value;
  }

  return undefined;
};

const buildWikimediaImageUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const fileName = trimmed.replace(/^File:/i, '');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=900`;
};

export class NominatimOverpassProvider implements PlacesProvider {
  async search(
    city: string,
    interests: string[],
    origin?: SearchOrigin,
    desiredCount = 3,
    options?: PlacesSearchOptions,
  ): Promise<{ places: PlaceCandidate[]; warnings: string[] }> {
    const selectedStopTypes = normalizeSelectedStopTypes(interests);
    const requestedStopTypes: StopType[] =
      selectedStopTypes.length > 0 ? selectedStopTypes : ['activity', 'outdoors'];

    const transport = options?.transport ?? 'drive';
    const maxTravelMinutes = Math.max(5, options?.maxTravelMinutes ?? 30);

    const radiusMeters = computeSearchRadius(transport, maxTravelMinutes);
    const ttlMinutes = cacheTtlMinutes(options?.cacheTtlMinutes);
    const bypassCache = Boolean(options?.cacheBuster);
    const searchCacheKey = buildSearchCacheKey(
      city,
      requestedStopTypes,
      origin,
      desiredCount,
      radiusMeters,
      options,
    );

    if (!bypassCache) {
      const cached = searchResultCache.get(searchCacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (__DEV__) {
          console.log('[perf] place_search_cache_hit', {
            requestedStopTypes,
            city,
            returned: cached.result.places.length,
          });
        }
        return cached.result;
      }

      const inflight = inflightSearchCache.get(searchCacheKey);
      if (inflight) return inflight;
    }

    const request = this.performSearch(
      city,
      requestedStopTypes,
      origin,
      desiredCount,
      radiusMeters,
      ttlMinutes,
      bypassCache,
      options,
    );

    if (!bypassCache) {
      inflightSearchCache.set(searchCacheKey, request);
    }

    try {
      const result = await request;
      if (!bypassCache) {
        searchResultCache.set(searchCacheKey, {
          expiresAt: Date.now() + ttlMinutes * 60_000,
          result,
        });
      }
      return result;
    } finally {
      if (!bypassCache) {
        inflightSearchCache.delete(searchCacheKey);
      }
    }
  }

  private async performSearch(
    city: string,
    requestedStopTypes: StopType[],
    origin: SearchOrigin | undefined,
    desiredCount: number,
    radiusMeters: number,
    ttlMinutes: number,
    bypassCache: boolean,
    options?: PlacesSearchOptions,
  ): Promise<{ places: PlaceCandidate[]; warnings: string[] }> {
    const totalStart = perfNow();

    const warnings: string[] = [];
    const merged: PlaceCandidate[] = [];

    const googleApiKey =
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

    const resolvedOrigin = origin || (await this.geocodeCity(city, bypassCache));

    if (googleApiKey && resolvedOrigin) {
      const googleStart = perfNow();
      const googlePlaces = await this.searchViaGoogle(
        city,
        requestedStopTypes,
        resolvedOrigin,
        googleApiKey,
        radiusMeters,
        ttlMinutes,
        bypassCache,
        options,
      );

      merged.push(...googlePlaces);
      logPerf('candidate_fetch_google', googleStart, {
        city,
        requestedStopTypes: requestedStopTypes.length,
        places: googlePlaces.length,
      });
    } else {
      warnings.push('Google Places unavailable, using OpenStreetMap fallback.');
    }

    if (merged.length < desiredCount * 8) {
      const osmStart = perfNow();
      const osm = await this.searchViaOpenStreetMap(
        city,
        requestedStopTypes,
        resolvedOrigin,
        radiusMeters,
        ttlMinutes,
        bypassCache,
      );
      merged.push(...osm);
      logPerf('candidate_fetch_osm', osmStart, {
        city,
        requestedStopTypes: requestedStopTypes.length,
        places: osm.length,
      });
    }

    const unique = this.dedupePlaces(merged);
    const result = {
      places: unique.slice(0, Math.max(60, desiredCount * 40)),
      warnings,
    };

    logPerf('candidate_fetch_total', totalStart, {
      city,
      requestedStopTypes: requestedStopTypes.length,
      merged: merged.length,
      unique: unique.length,
      returned: result.places.length,
      warnings: warnings.length,
    });

    return result;
  }

  private async searchViaGoogle(
    city: string,
    stopTypes: StopType[],
    origin: SearchOrigin,
    apiKey: string,
    radius: number,
    ttlMinutes: number,
    bypassCache: boolean,
    options?: PlacesSearchOptions,
  ): Promise<PlaceCandidate[]> {
    const requests = stopTypes.flatMap((stopType) =>
      stopTypeQueryVariants(stopType).map(async (variant) => {
        const providerKey = buildProviderKey(
          'google',
          city,
          `${stopType}:${variant}`,
          origin,
          radius,
          options?.budget,
        );

        const cached = readProviderCache(providerKey, ttlMinutes, bypassCache);
        if (cached.length > 0) return cached;

        const q = `${variant} near ${city}`;
        const body = {
          textQuery: q,
          maxResultCount: 50,
          locationBias: {
            circle: {
              center: { latitude: origin.lat, longitude: origin.lng },
              radius,
            },
          },
        };

        const fieldMask = [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.types',
          'places.rating',
          'places.userRatingCount',
          'places.priceLevel',
          'places.photos',
          'places.currentOpeningHours',
          'places.currentOpeningHours.openNow',
          'places.regularOpeningHours',
          'places.regularOpeningHours.periods',
          'places.regularOpeningHours.weekdayDescriptions',
        ].join(',');

        try {
          const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify(body),
          });

          if (!r.ok) return [] as PlaceCandidate[];

          const j = (await r.json()) as { places?: GooglePlaceRow[] };
          const rows = Array.isArray(j.places) ? j.places : [];

          const places = rows.reduce<PlaceCandidate[]>((acc, row) => {
            const lat =
              typeof row.location?.latitude === 'number' ? row.location.latitude : undefined;
            const lng =
              typeof row.location?.longitude === 'number' ? row.location.longitude : undefined;
            if (lat == null || lng == null) return acc;

            const photos: PlacePhoto[] = Array.isArray(row.photos)
              ? (row.photos
                  .map((photo) => {
                    if (!photo?.name) return null;

                    return {
                      name: photo.name,
                      url: `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=900&maxWidthPx=1600&key=${apiKey}`,
                      widthPx: typeof photo.widthPx === 'number' ? photo.widthPx : undefined,
                      heightPx: typeof photo.heightPx === 'number' ? photo.heightPx : undefined,
                      authorAttributions: Array.isArray(photo.authorAttributions)
                        ? photo.authorAttributions
                            .map((a) => {
                              if (typeof a === 'string') return a;
                              if (typeof a?.displayName === 'string') return a.displayName;
                              if (typeof a?.uri === 'string') return a.uri;
                              return '';
                            })
                            .filter(Boolean)
                        : undefined,
                    } satisfies PlacePhoto;
                  })
                  .filter(Boolean)
                  .slice(0, 6) as PlacePhoto[])
              : [];

            const openingPeriods = toOpeningPeriods(row.regularOpeningHours?.periods);
            const weekdayDescriptions = row.regularOpeningHours?.weekdayDescriptions;
            const openingHoursText = Array.isArray(weekdayDescriptions)
              ? weekdayDescriptions.join('\n')
              : undefined;

            acc.push({
              id: row.id,
              providerId: row.id,
              name: row.displayName?.text || 'Unknown',
              lat,
              lng,
              category: stopType,
              address: row.formattedAddress || '',
              tags: Array.isArray(row.types) ? row.types : [],
              costLevel: googlePriceLevelToCostLevel(row.priceLevel),
              stopType,
              rating: row.rating,
              reviewCount: row.userRatingCount,
              priceLevel: googlePriceLevelToNumeric(row.priceLevel),
              openNow: row.currentOpeningHours?.openNow,
              openingHoursText,
              openingPeriods,
              photoUrl: photos[0]?.url,
              photos,
            } satisfies PlaceCandidate);
            return acc;
          }, []);

          writeProviderCache(providerKey, places);
          return places;
        } catch {
          return [] as PlaceCandidate[];
        }
      }),
    );

    const results = await Promise.all(requests);
    return this.dedupePlaces(results.flat());
  }

  private async searchViaOpenStreetMap(
    city: string,
    stopTypes: StopType[],
    origin?: SearchOrigin,
    radiusMeters = OSM_RADIUS_METERS,
    ttlMinutes = DEFAULT_CACHE_TTL_MINUTES,
    bypassCache = false,
  ): Promise<PlaceCandidate[]> {
    try {
      const resolvedOrigin = origin || (await this.geocodeCity(city, bypassCache));
      const providerKey = buildProviderKey(
        'osm',
        city,
        stopTypes.slice().sort().join(','),
        resolvedOrigin,
        radiusMeters,
      );
      const cached = readProviderCache(providerKey, ttlMinutes, bypassCache);
      if (cached.length > 0) return cached;

      const centerLat = resolvedOrigin?.lat;
      const centerLng = resolvedOrigin?.lng;
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return [];

      const elementTypes = ['node', 'way', 'relation'];
      const tagKeys = ['amenity', 'tourism', 'leisure', 'shop', 'natural'] as const;

      const queryLines = tagKeys.flatMap((tagKey) => {
        const pattern = buildOsmQueryPattern(stopTypes, tagKey);
        if (!pattern) return [];

        return elementTypes.map(
          (elementType) =>
            `  ${elementType}(around:${radiusMeters},${centerLat},${centerLng})[name][${tagKey}~"${pattern}",i];`,
        );
      });

      const query = `[out:json][timeout:25];
(
${queryLines.join('\n')}
);
out center 150;`;

      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });

      const j = (await r.json()) as { elements?: OverpassElementRow[] };
      const places = (j.elements || []).reduce<PlaceCandidate[]>((acc, e) => {
        const tags = e.tags;
        if (!tags?.name) return acc;

        const lat = typeof e.lat === 'number' ? e.lat : e.center?.lat;
        const lng = typeof e.lon === 'number' ? e.lon : e.center?.lon;
        if (typeof lat !== 'number' || typeof lng !== 'number') return acc;

        const inferredStopType = inferOsmStopType(tags, stopTypes) || stopTypes[0] || 'activity';
        const normalizedTypes = buildOsmCandidateTypes(tags, inferredStopType);
        const photoUrl =
          buildWikimediaImageUrl(firstAvailableTag(tags, ['image', 'wikimedia_commons'])) ||
          undefined;

        acc.push({
          id: String(e.id),
          providerId: String(e.id),
          name: tags.name,
          lat,
          lng,
          category: stopTypeLabel(inferredStopType),
          address: formatOsmDisplayAddress(tags),
          tags: normalizedTypes,
          costLevel: 'Unknown',
          stopType: inferredStopType,
          websiteUri: firstAvailableTag(tags, ['website', 'contact:website']),
          photoUrl,
          photos: photoUrl ? [{ url: photoUrl }] : [],
          openNow: undefined,
          openingHoursText: undefined,
          openingPeriods: [],
        } satisfies PlaceCandidate);
        return acc;
      }, []);

      const deduped = this.dedupePlaces(places);
      writeProviderCache(providerKey, deduped);
      return deduped;
    } catch {
      return [];
    }
  }

  private async geocodeCity(city: string, bypassCache: boolean): Promise<SearchOrigin | undefined> {
    const trimmed = city.trim();
    if (!trimmed) return undefined;

    const cacheKey = trimmed.toLowerCase();

    if (!bypassCache) {
      const cached = geocodeCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.origin;
      }
    }

    const geocoded = await fetchNominatimCoordinates(trimmed);
    const origin = geocoded
      ? {
          lat: geocoded.latitude,
          lng: geocoded.longitude,
        }
      : undefined;

    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
      return undefined;
    }

    if (!bypassCache) {
      geocodeCache.set(cacheKey, {
        expiresAt: Date.now() + GEO_CACHE_TTL_MS,
        origin,
      });
    }

    return origin;
  }

  private dedupePlaces(rows: PlaceCandidate[]): PlaceCandidate[] {
    const seen = new Set<string>();

    return rows.filter((r) => {
      const key = `${r.name.toLowerCase()}-${r.lat.toFixed(4)}-${r.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
