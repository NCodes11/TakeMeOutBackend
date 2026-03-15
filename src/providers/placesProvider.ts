import { cachePlaces, clearCachedPlaces, getCachedPlaces } from '@/db/sqlite';
import { normalizeSelectedStopTypes } from '@/constants/stopTypes';
import { BudgetType, GroupType, PlaceCandidate, PlacePhoto, StopType, TransportType } from '@/types/models';
import { logPerf, perfNow } from '@/utils/perf';

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

interface GooglePlaceRow {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  photos?: GooglePhotoRow[];
}

interface OverpassElementRow {
  id: string | number;
  lat: number;
  lon: number;
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

const searchResultCache = new Map<string, { expiresAt: number; result: { places: PlaceCandidate[]; warnings: string[] } }>();
const inflightSearchCache = new Map<string, Promise<{ places: PlaceCandidate[]; warnings: string[] }>>();
const geocodeCache = new Map<string, { expiresAt: number; origin: SearchOrigin }>();

const speedKmh = (mode: TransportType) => (mode === 'walk' ? 4.5 : 35);

const computeSearchRadius = (transport: TransportType, maxTravelMinutes: number) => {
  const speed = speedKmh(transport);
  const km = (speed * maxTravelMinutes) / 60;
  const meters = km * 1000;

  if (transport === 'walk') {
    return Math.min(3000, Math.max(400, meters));
  }

  return Math.min(GOOGLE_MAX_RADIUS_METERS, Math.max(2000, meters * 1.5));
};

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
};

const toCostLevel = (priceLevel?: number): string => {
  if (typeof priceLevel !== 'number') return 'Unknown';
  if (priceLevel <= 1) return '$';
  if (priceLevel === 2) return '$$';
  if (priceLevel === 3) return '$$$';
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
) =>
  [
    provider,
    city.trim().toLowerCase(),
    token,
    roundCoord(origin?.lat),
    roundCoord(origin?.lng),
    radiusMeters,
  ].join('|');

const cacheTtlMinutes = (value?: number) =>
  Math.max(1, Math.round(typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_CACHE_TTL_MINUTES));

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
    const searchCacheKey = buildSearchCacheKey(city, requestedStopTypes, origin, desiredCount, radiusMeters, options);

    if (!bypassCache) {
      const cached = searchResultCache.get(searchCacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (__DEV__) {
          console.log('[perf] place_search_cache_hit', {
            requestedStopTypes,
            city,
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
  ): Promise<{ places: PlaceCandidate[]; warnings: string[] }> {
    const totalStart = perfNow();

    const warnings: string[] = [];
    const merged: PlaceCandidate[] = [];

    const googleApiKey =
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

    if (googleApiKey && origin) {
      const googleStart = perfNow();
      const googlePlaces = await this.searchViaGoogle(
        city,
        requestedStopTypes,
        origin,
        googleApiKey,
        radiusMeters,
        ttlMinutes,
        bypassCache,
      );

      merged.push(...googlePlaces);
      logPerf('candidate_fetch_google', googleStart, {
        city,
        requestedStopTypes: requestedStopTypes.length,
        places: googlePlaces.length,
      });
    } else {
      warnings.push('Google API key missing, using OpenStreetMap.');
    }

    if (merged.length < desiredCount * 4) {
      const osmStart = perfNow();
      const osm = await this.searchViaOpenStreetMap(
        city,
        requestedStopTypes,
        origin,
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
    const shuffled = shuffle(unique);
    const result = {
      places: shuffled.slice(0, desiredCount * 12),
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
  ): Promise<PlaceCandidate[]> {
    const requests = stopTypes.map(async (stopType) => {
      const providerKey = buildProviderKey('google', city, stopType, origin, radius);
      const cached = readProviderCache(providerKey, ttlMinutes, bypassCache);
      if (cached.length > 0) return cached;

      const q = `${stopType} near ${city}`;
      const body = {
        textQuery: q,
        maxResultCount: 20,
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
            const lat = typeof row.location?.latitude === 'number' ? row.location.latitude : undefined;
            const lng = typeof row.location?.longitude === 'number' ? row.location.longitude : undefined;
            if (lat == null || lng == null) return acc;

            const photos: PlacePhoto[] = Array.isArray(row.photos)
              ? row.photos
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
                  .slice(0, 6) as PlacePhoto[]
              : [];

            acc.push({
              id: row.id,
              providerId: row.id,
              name: row.displayName?.text || 'Unknown',
              lat,
              lng,
              category: stopType,
              address: row.formattedAddress || '',
              tags: Array.isArray(row.types) ? row.types : [],
              costLevel: toCostLevel(row.priceLevel),
              stopType,
              rating: row.rating,
              reviewCount: row.userRatingCount,
              priceLevel: row.priceLevel,
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
    });

    const results = await Promise.all(requests);
    return results.flat();
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

      const pattern = stopTypes.join('|');

      const query = `[out:json][timeout:25];
(
  node(around:${radiusMeters},${centerLat},${centerLng})[name][amenity~"${pattern}",i];
  node(around:${radiusMeters},${centerLat},${centerLng})[name][tourism~"${pattern}",i];
  node(around:${radiusMeters},${centerLat},${centerLng})[name][leisure~"${pattern}",i];
);
out body 100;`;

      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });

      const j = (await r.json()) as { elements?: OverpassElementRow[] };
      const places = (j.elements || []).reduce<PlaceCandidate[]>((acc, e) => {
          const tags = e.tags;
          if (!tags?.name) return acc;

          acc.push({
            id: String(e.id),
            providerId: String(e.id),
            name: tags.name,
            lat: e.lat,
            lng: e.lon,
            category: 'activity',
            address: city,
            tags: Object.values(tags),
            costLevel: '$',
            stopType: 'activity',
            photoUrl: undefined,
            photos: [],
          } satisfies PlaceCandidate);
          return acc;
        }, []);

      writeProviderCache(providerKey, places);
      return places;
    } catch {
      return [];
    }
  }

  private async geocodeCity(city: string, bypassCache: boolean): Promise<SearchOrigin | undefined> {
    const cacheKey = city.trim().toLowerCase();

    if (!bypassCache) {
      const cached = geocodeCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.origin;
      }
    }

    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`,
    );
    const rows = await geo.json();
    const origin = {
      lat: Number(rows?.[0]?.lat),
      lng: Number(rows?.[0]?.lon),
    };

    if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
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
      const key = `${r.name}-${r.lat.toFixed(4)}-${r.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
