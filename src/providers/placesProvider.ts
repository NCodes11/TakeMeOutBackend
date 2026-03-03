import { cachePlaces, getCachedPlaces } from '@/db/sqlite';
import { normalizeSelectedStopTypes, STOP_TYPE_OPTIONS } from '@/constants/stopTypes';
import { PlaceCandidate, StopType, TransportType } from '@/types/models';

interface SearchOrigin {
  lat: number;
  lng: number;
}

export interface PlacesSearchOptions {
  transport?: TransportType;
  maxTravelMinutes?: number;
  stopCount?: number;

  /** 'plan' favors caching; 'reroll' prioritizes fresher results and larger pools. */
  mode?: 'plan' | 'reroll';

  /** Cache bucket size for stable reuse. */
  cacheTtlMinutes?: number;

  /** Optional extra entropy for cache keys (e.g. planId-stopIndex). */
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

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

// Places API (New) circle radius must be <= 50,000.
const GOOGLE_MAX_RADIUS_METERS = 50_000;
// OSM fallback can go a bit wider.
const OSM_RADIUS_METERS = 12_000;

const rateLimiter = { lastMs: 0 };
const waitIfNeeded = async () => {
  const gap = 1100 - (Date.now() - rateLimiter.lastMs);
  if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
  rateLimiter.lastMs = Date.now();
};

const shuffleInPlace = <T,>(arr: T[]) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
};

const normalizeChainName = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isLikelyGenericName = (name: string) => {
  const n = normalizeChainName(name);
  if (n.length < 5) return true;
  const generic = [
    'park',
    'playground',
    'museum',
    'gallery',
    'theater',
    'theatre',
    'trail',
    'lake',
    'river',
    'beach',
    'plaza',
    'mall',
    'market',
  ];
  return generic.some((g) => n === g || n.endsWith(` ${g}`) || n.startsWith(`${g} `));
};

const toCostLevel = (priceLevel?: number): string => {
  if (typeof priceLevel !== 'number') return 'Unknown';
  if (priceLevel <= 1) return '$';
  if (priceLevel === 2) return '$$';
  if (priceLevel === 3) return '$$$';
  return '$$$$';
};

type GoogleV1Place = {
  id?: string; // place id
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  currentOpeningHours?: { openNow?: boolean };
};

type SearchTextResponse = { places?: GoogleV1Place[] };

const STOPTYPE_QUERY: Record<StopType, (city: string) => string[]> = {
  restaurant: (city) => [`restaurants near ${city}`, `best restaurants in ${city}`],
  coffee: (city) => [`coffee shops near ${city}`, `cafes near ${city}`],
  dessert: (city) => [`dessert near ${city}`, `ice cream near ${city}`, `bakery near ${city}`],
  bar: (city) => [`bars near ${city}`, `cocktail bars near ${city}`],
  arts: (city) => [`museums near ${city}`, `art galleries near ${city}`],
  outdoors: (city) => [`parks near ${city}`, `trails near ${city}`, `gardens near ${city}`],
  attraction: (city) => [`tourist attractions near ${city}`, `things to see near ${city}`],
  activity: (city) => [`fun activities near ${city}`, `things to do near ${city}`],
  shopping: (city) => [`shopping near ${city}`, `shopping malls near ${city}`],
};

// Things you never want as stops.
const BANNED_NAME_SIGNALS = ['cinema', 'movie', 'theatre', 'theater', 'supermarket', 'grocery', 'walmart', 'costco', 'target'];
const BANNED_TYPES = new Set<string>([
  'movie_theater',
  'grocery_store',
  'supermarket',
  'convenience_store',
  'wholesaler',
]);

const isBanned = (name: string, types: string[], primaryType?: string) => {
  const n = (name || '').toLowerCase();
  if (BANNED_NAME_SIGNALS.some((s) => n.includes(s))) return true;
  const tset = new Set<string>([...types, primaryType || ''].filter(Boolean).map((t) => String(t).toLowerCase()));
  for (const t of tset) if (BANNED_TYPES.has(t)) return true;
  return false;
};

const inferStopTypeFromTypes = (types: string[], primaryType?: string, name?: string): StopType | null => {
  const all = new Set<string>([...types, primaryType || ''].filter(Boolean).map((t) => String(t).toLowerCase()));
  const has = (...candidates: string[]) => candidates.some((t) => all.has(t));

  if (has('restaurant')) return 'restaurant';
  if (has('bar', 'night_club')) return 'bar';
  if (has('ice_cream_shop', 'dessert_shop')) return 'dessert';
  if (has('cafe', 'coffee_shop', 'bakery')) return 'coffee';

  if (has('museum', 'art_gallery', 'performing_arts_theater')) return 'arts';

  if (
    has(
      'shopping_mall',
      'department_store',
      'clothing_store',
      'shoe_store',
      'electronics_store',
      'home_goods_store',
      'furniture_store',
    )
  )
    return 'shopping';

  if (has('bowling_alley', 'amusement_center', 'arcade', 'mini_golf_course', 'escape_room')) return 'activity';

  if (has('tourist_attraction', 'amusement_park', 'zoo', 'aquarium')) return 'attraction';

  if (
    has('park', 'hiking_area', 'trail', 'botanical_garden', 'national_park', 'nature_reserve', 'campground', 'playground')
  )
    return 'outdoors';

  // Fallback keyword hint from name (light touch)
  const n = (name || '').toLowerCase();
  if (/museum|gallery|exhibit/.test(n)) return 'arts';
  if (/park|trail|garden|nature|hike/.test(n)) return 'outdoors';
  if (/bowling|arcade|escape|mini golf/.test(n)) return 'activity';
  if (/zoo|aquarium|attraction|tour/.test(n)) return 'attraction';
  if (/coffee|cafe|espresso/.test(n)) return 'coffee';
  if (/dessert|ice cream|bakery/.test(n)) return 'dessert';
  if (/bar|pub|brew/.test(n)) return 'bar';
  if (/restaurant|grill|diner/.test(n)) return 'restaurant';
  if (/mall|shop|store|boutique/.test(n)) return 'shopping';

  return null;
};

const categoryLabelForStopType = (stopType: StopType): string => {
  switch (stopType) {
    case 'coffee':
      return 'Coffee';
    case 'dessert':
      return 'Dessert';
    case 'bar':
      return 'Bars';
    case 'arts':
      return 'Arts';
    case 'outdoors':
      return 'Outdoors';
    case 'attraction':
      return 'Attractions';
    case 'activity':
      return 'Activities';
    case 'shopping':
      return 'Shopping';
    case 'restaurant':
    default:
      return 'Food';
  }
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
    const requestedStopTypes: StopType[] = selectedStopTypes.length > 0 ? selectedStopTypes : ['activity', 'outdoors'];

    const targetCount = Math.max(2, Math.min(8, Math.floor(desiredCount)));
    // Pull a bigger pool so the generator has enough after policy/dedupe.
    const maxResults = Math.max(targetCount * 24, 96);
    const warnings: string[] = [];

    const mode = options?.mode ?? 'plan';

    const googleApiKey =
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
      process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

    const ttlMinutes = Math.max(5, options?.cacheTtlMinutes ?? (mode === 'reroll' ? 10 : 60));
    const bucket = Math.floor(Date.now() / (ttlMinutes * 60 * 1000));
    const buster = options?.cacheBuster ? `-${options.cacheBuster}` : '';

    const cacheKey = origin
      ? `places-${origin.lat.toFixed(3)}-${origin.lng.toFixed(3)}-${requestedStopTypes.join('-')}-${bucket}${buster}`
      : `places-${city.toLowerCase()}-${requestedStopTypes.join('-')}-${bucket}${buster}`;

    const cachedRows = getCachedPlaces(cacheKey, 16, mode === 'reroll');
    const cachedPlaces: PlaceCandidate[] =
      cachedRows.length > 0
        ? this.dedupePlaces(
            cachedRows
              .map((row) => {
                try {
                  const parsed = JSON.parse(row.rawJSON) as PlaceCandidate;
                  if (parsed && parsed.name && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) return parsed;
                } catch {}
                return null;
              })
              .filter((x): x is PlaceCandidate => Boolean(x)),
          )
        : [];

    const merged: PlaceCandidate[] = [];
    if (mode === 'plan') merged.push(...cachedPlaces);

    // Google path: rely on broad text search + client-side classification.
    if (googleApiKey && origin) {
      const googlePlaces = await this.searchViaGoogleTextOnly(requestedStopTypes, city, origin, googleApiKey, maxResults);
      merged.push(...googlePlaces);

      const uniqueSoFar = this.dedupePlaces(this.filterRowsByStopTypes(merged, requestedStopTypes));
      if (uniqueSoFar.length < targetCount) {
        warnings.push(`Limited results from Google near the start point (${uniqueSoFar.length} matches). Expanding with OpenStreetMap.`);
      }
    } else if (!origin) {
      warnings.push('No start coordinates available; using OpenStreetMap for search.');
    } else if (!googleApiKey) {
      warnings.push('Google API key not found; using OpenStreetMap for search.');
    }

    // OSM fallback
    if (merged.length < maxResults) {
      const openStreet = await this.searchViaOpenStreetMap(city, requestedStopTypes, origin, maxResults, warnings);
      merged.push(...openStreet);
    }

    if (mode === 'reroll' && merged.length < targetCount && cachedPlaces.length > 0) {
      merged.push(...cachedPlaces);
    }

    const unique = this.dedupePlaces(this.filterRowsByStopTypes(merged, requestedStopTypes));
    shuffleInPlace(unique);

    const final = unique.slice(0, maxResults);

    if (origin && final.length > 0) {
      try {
        cachePlaces(
          final.slice(0, 180).map((p) => ({
            providerKey: cacheKey,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            category: p.category,
            rawJSON: JSON.stringify(p),
          })),
        );
      } catch {}
    }

    if (final.length < targetCount) warnings.push('Not enough places found nearby.');
    return { places: final, warnings };
  }

  private async searchViaGoogleTextOnly(
    stopTypes: StopType[],
    city: string,
    origin: SearchOrigin,
    apiKey: string,
    maxResults: number,
  ): Promise<PlaceCandidate[]> {
    const perTypeTarget = Math.max(30, Math.min(80, Math.floor(maxResults / Math.max(1, stopTypes.length))));
    const all: PlaceCandidate[] = [];

    for (const stopType of stopTypes) {
      const queries = STOPTYPE_QUERY[stopType]?.(city) ?? [`things to do near ${city}`];
      const collected: PlaceCandidate[] = [];

      // Try a couple of queries per type and merge.
      for (const q of queries) {
        const rows = await this.googleV1SearchText({
          apiKey,
          textQuery: q,
          origin,
          radiusMeters: GOOGLE_MAX_RADIUS_METERS,
          maxResultCount: 20,
        });

        collected.push(...this.mapGoogleV1PlacesText(rows, stopType));
        const unique = this.dedupePlaces(collected);
        if (unique.length >= perTypeTarget) break;
      }

      all.push(...this.dedupePlaces(collected).slice(0, perTypeTarget));
    }

    return this.dedupePlaces(all).slice(0, maxResults);
  }

  private async googleV1SearchText(params: {
    apiKey: string;
    textQuery: string;
    origin: SearchOrigin;
    radiusMeters: number;
    maxResultCount: number;
  }): Promise<GoogleV1Place[]> {
    const url = 'https://places.googleapis.com/v1/places:searchText';

    const body = {
      textQuery: params.textQuery,
      maxResultCount: Math.max(1, Math.min(20, params.maxResultCount)),
      locationBias: {
        circle: {
          center: { latitude: params.origin.lat, longitude: params.origin.lng },
          radius: Math.max(1, Math.min(GOOGLE_MAX_RADIUS_METERS, params.radiusMeters)),
        },
      },
    };

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.types',
      'places.primaryType',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.currentOpeningHours',
    ].join(',');

    try {
      await waitIfNeeded();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': params.apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (isDev) {
          const text = await response.text().catch(() => '');
          console.log('[places][google-v1][text][error]', response.status, text);
        }
        return [];
      }

      const json = (await response.json()) as SearchTextResponse;
      return Array.isArray(json.places) ? json.places : [];
    } catch (e) {
      if (isDev) console.log('[places][google-v1][text][exception]', String(e));
      return [];
    }
  }

  private mapGoogleV1PlacesText(rows: GoogleV1Place[], requestedStopType: StopType): PlaceCandidate[] {
    const out: PlaceCandidate[] = [];

    for (const row of rows) {
      const lat = row.location?.latitude;
      const lng = row.location?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const name = (row.displayName?.text || '').trim();
      if (!name) continue;

      const types = (row.types || []).map((t) => String(t).toLowerCase());
      const primaryType = row.primaryType ? String(row.primaryType).toLowerCase() : undefined;

      if (isBanned(name, types, primaryType)) continue;

      // Prefer actual classification; fallback to requested token if unknown.
      const inferred = inferStopTypeFromTypes(types, primaryType, name);
      const stopType = inferred ?? requestedStopType;

      out.push({
        id: row.id || `${name}-${lat}-${lng}`,
        providerId: row.id,
        name,
        lat: Number(lat),
        lng: Number(lng),
        category: categoryLabelForStopType(stopType),
        address: row.formattedAddress || 'Address unavailable',
        tags: types.length ? types : [stopType],
        costLevel: toCostLevel(row.priceLevel),
        stopType,
        openNow: typeof row.currentOpeningHours?.openNow === 'boolean' ? row.currentOpeningHours.openNow : undefined,
        rating: typeof row.rating === 'number' ? row.rating : undefined,
        reviewCount: typeof row.userRatingCount === 'number' ? row.userRatingCount : undefined,
        priceLevel: typeof row.priceLevel === 'number' ? row.priceLevel : undefined,
        openingHoursText:
          typeof row.currentOpeningHours?.openNow === 'boolean'
            ? row.currentOpeningHours.openNow
              ? 'Open now'
              : 'Closed now'
            : undefined,
      });
    }

    // Prefer quality for stable top picks.
    out.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    return out;
  }

  // ---- OpenStreetMap fallback ----

  private async searchViaOpenStreetMap(
    city: string,
    stopTypes: StopType[],
    origin?: SearchOrigin,
    maxResults = 60,
    warnings?: string[],
  ): Promise<PlaceCandidate[]> {
    try {
      let centerLat = origin?.lat;
      let centerLng = origin?.lng;

      if (centerLat == null || centerLng == null) {
        await waitIfNeeded();
        const geocode = await fetch(
          `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'TakeMeOut/1.0' } },
        );
        const geoJson = (await geocode.json()) as { lat: string; lon: string }[];
        const center = geoJson[0];
        if (!center) return [];
        centerLat = Number(center.lat);
        centerLng = Number(center.lon);
      }

      const query = this.buildOverpassQuery(centerLat, centerLng, stopTypes);
      await waitIfNeeded();

      const overpass = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });

      const overpassJson = (await overpass.json()) as {
        elements?: Array<{ id: number | string; lat?: number; lon?: number; tags?: Record<string, string> }>;
      };

      const rows = (overpassJson.elements || [])
        .filter((element) => typeof element.lat === 'number' && typeof element.lon === 'number' && element.tags?.name)
        .slice(0, maxResults)
        .map((element) => {
          const tags = element.tags || {};
          const name = String(tags.name || '').trim();
          const stopType = this.stopTypeFromTags(tags);
          return {
            id: String(element.id),
            providerId: String(element.id),
            name,
            lat: Number(element.lat),
            lng: Number(element.lon),
            category: categoryLabelForStopType(stopType),
            address: this.addressFromTags(tags, city),
            tags: Object.values(tags).map(String),
            costLevel: this.costLevelFromTags(tags),
            stopType,
          } as PlaceCandidate;
        });

      const filtered = this.filterRowsByStopTypes(rows, stopTypes).filter((p) => !this.isGloballyBanned(p));
      const missingTypes = stopTypes.filter((type) => !filtered.some((row) => row.stopType === type));
      if (missingTypes.length > 0 && warnings) warnings.push(`Limited OpenStreetMap results for ${missingTypes.join(', ')}.`);
      return filtered.slice(0, maxResults);
    } catch {
      return [];
    }
  }

  private buildOverpassQuery(lat: number, lng: number, stopTypes: StopType[]) {
    const queryKeywords = Array.from(
      new Set(stopTypes.flatMap((stopType) => STOP_TYPE_OPTIONS.find((option) => option.id === stopType)?.queryKeywords || [])),
    );
    const pattern = queryKeywords.join('|');
    return `[out:json][timeout:25];
(
  node(around:${OSM_RADIUS_METERS},${lat},${lng})[name][amenity~"${pattern}",i];
  node(around:${OSM_RADIUS_METERS},${lat},${lng})[name][tourism~"${pattern}",i];
  node(around:${OSM_RADIUS_METERS},${lat},${lng})[name][leisure~"${pattern}",i];
  node(around:${OSM_RADIUS_METERS},${lat},${lng})[name][shop~"${pattern}",i];
);
out body 200;`;
  }

  private filterRowsByStopTypes(rows: PlaceCandidate[], requestedStopTypes: StopType[]) {
    if (requestedStopTypes.length === 0) return rows;
    const allowed = new Set<StopType>(requestedStopTypes);
    return rows.filter((row) => allowed.has(row.stopType));
  }

  private isGloballyBanned(row: PlaceCandidate) {
    const tags = (row.tags || []).map((t) => String(t).toLowerCase());
    const name = (row.name || '').toLowerCase();
    if (BANNED_NAME_SIGNALS.some((s) => name.includes(s))) return true;
    return tags.some((t) => BANNED_TYPES.has(t));
  }

  private stopTypeFromTags(tags: Record<string, string>): StopType {
    const values = Object.values(tags).join(' ').toLowerCase();
    if (/cafe|coffee/.test(values)) return 'coffee';
    if (/ice_cream|dessert|bakery/.test(values)) return 'dessert';
    if (/bar|pub|brewery/.test(values)) return 'bar';
    if (/museum|gallery|theatre|arts/.test(values)) return 'arts';
    if (/amusement|theme_park|tourist_attraction|zoo|aquarium/.test(values)) return 'attraction';
    if (/bowling|arcade|mini_golf|escape/.test(values)) return 'activity';
    if (/park|trail|viewpoint|garden|nature|campground|playground/.test(values)) return 'outdoors';
    if (/shop|mall/.test(values)) return 'shopping';
    if (/restaurant|food/.test(values)) return 'restaurant';
    return 'restaurant';
  }

  private costLevelFromTags(tags: Record<string, string>) {
    const value = (tags as any).price_range || '';
    if (String(value).includes('$$$$')) return '$$$$';
    if (String(value).includes('$$$')) return '$$$';
    if (String(value).includes('$$')) return '$$';
    return '$';
  }

  private addressFromTags(tags: Record<string, string>, city: string) {
    const house = tags['addr:housenumber'];
    const street = tags['addr:street'];
    const locality = tags['addr:city'] || city;
    if (house && street) return `${house} ${street}, ${locality}`;
    if (street) return `${street}, ${locality}`;
    return locality;
  }

  private dedupePlaces(rows: PlaceCandidate[]): PlaceCandidate[] {
    const seenByProvider = new Set<string>();
    const seenByCoordName = new Set<string>();
    const seenChain = new Set<string>();

    return rows.filter((row) => {
      const name = row.name?.trim();
      if (!name) return false;

      // Provider ID dedupe.
      if (row.providerId) {
        const k = `pid:${row.providerId}`;
        if (seenByProvider.has(k)) return false;
        seenByProvider.add(k);
      }

      // Coordinate + normalized name dedupe.
      const coordKey = `${row.lat.toFixed(5)}-${row.lng.toFixed(5)}`;
      const nameKey = normalizeChainName(name);
      const coordNameKey = `${coordKey}|${nameKey}`;
      if (seenByCoordName.has(coordNameKey)) return false;
      seenByCoordName.add(coordNameKey);

      // Chain dedupe for chain-sensitive categories.
      const chainSensitive =
        row.stopType === 'restaurant' || row.stopType === 'coffee' || row.stopType === 'dessert' || row.stopType === 'bar' || row.stopType === 'shopping';

      if (chainSensitive && !isLikelyGenericName(name)) {
        const chainKey = `chain:${row.stopType}:${nameKey}`;
        if (seenChain.has(chainKey)) return false;
        seenChain.add(chainKey);
      }

      return true;
    });
  }
}