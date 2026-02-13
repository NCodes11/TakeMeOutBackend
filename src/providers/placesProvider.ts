import { getCachedPlaces } from '@/db/sqlite';
import { normalizeSelectedStopTypes, STOP_TYPE_OPTIONS } from '@/constants/stopTypes';
import { PlaceCandidate, StopType, TransportType } from '@/types/models';
import { CATEGORY_POLICIES, evaluateCategoryCandidate } from './categoryPolicy';

interface SearchOrigin {
  lat: number;
  lng: number;
}

interface OverpassElement {
  id: number | string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

interface NominatimPlace {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
}

interface GoogleNearbyPlace {
  place_id: string;
  name?: string;
  vicinity?: string;
  formatted_address?: string;
  rating?: number;
  price_level?: number;
  opening_hours?: {
    open_now?: boolean;
  };
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  types?: string[];
}

export interface PlacesSearchOptions {
  transport?: TransportType;
  maxTravelMinutes?: number;
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
const MAX_RADIUS_METERS = 60000;
const rateLimiter = { lastMs: 0 };

const waitIfNeeded = async () => {
  const gap = 1100 - (Date.now() - rateLimiter.lastMs);
  if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
  rateLimiter.lastMs = Date.now();
};

const stopTypesToKeywords = (): Record<StopType, { type?: string; keyword?: string }> => ({
  coffee: { type: 'cafe', keyword: 'coffee shop' },
  restaurant: { type: 'restaurant', keyword: 'restaurant' },
  bar: { type: 'bar', keyword: 'bar pub' },
  dessert: { type: 'bakery', keyword: 'dessert ice cream' },
  activity: { type: 'tourist_attraction', keyword: 'activities' },
  attraction: { type: 'tourist_attraction', keyword: 'theme park attraction' },
  outdoors: { type: 'park', keyword: 'park trail nature preserve' },
  shopping: { type: 'shopping_mall', keyword: 'shopping store mall' },
  arts: { type: 'museum', keyword: 'museum gallery' },
});

const toRadians = (value: number) => (value * Math.PI) / 180;
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const buildRadiusSteps = (options?: PlacesSearchOptions) => {
  const speed = options?.transport === 'walk' ? 4.5 : 35;
  const minutes = Math.max(10, options?.maxTravelMinutes || 20);
  const baseMeters = Math.max(10000, Math.min(MAX_RADIUS_METERS, Math.round(((speed * minutes) / 60) * 1000)));
  const steps = [baseMeters, 20000, 40000, 60000];
  return Array.from(new Set(steps.filter((value) => value <= MAX_RADIUS_METERS))).sort((a, b) => a - b);
};

const toCostLevel = (priceLevel?: number): string => {
  if (typeof priceLevel !== 'number') return 'Unknown';
  if (priceLevel <= 1) return '$';
  if (priceLevel <= 3) return '$$';
  return '$$$';
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
    const targetCount = Math.max(1, Math.min(6, Math.floor(desiredCount)));
    const maxResults = Math.max(targetCount * 8, 24);
    const warnings: string[] = [];
    const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    const cacheKey = origin
      ? `nomi-${origin.lat.toFixed(3)}-${origin.lng.toFixed(3)}-${requestedStopTypes.join('-')}`
      : `nomi-${city.toLowerCase()}-${requestedStopTypes.join('-')}`;

    const cached = getCachedPlaces(cacheKey);
    if (cached.length > 0) {
      const mapped = cached.map((row) => ({
        id: `${row.lat}-${row.lng}-${row.name}`,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        category: row.category,
        address: row.name,
        tags: [row.category],
        stopType: this.categoryToStopType(row.category),
      }));
      const unique = this.dedupePlaces(mapped).slice(0, maxResults);
      if (unique.length < targetCount) warnings.push('Not enough places found nearby.');
      return { places: unique, warnings };
    }

    if (googleApiKey && origin) {
      const googleRows = await this.searchViaGoogle(requestedStopTypes, origin, maxResults, googleApiKey, options);
      const strictGoogleRows = this.filterRowsByStopTypes(googleRows, requestedStopTypes);
      const uniqueGoogleRows = this.dedupePlaces(strictGoogleRows).slice(0, maxResults);
      if (uniqueGoogleRows.length >= targetCount) {
        return { places: uniqueGoogleRows, warnings };
      }
      warnings.push(`Google Places returned only ${uniqueGoogleRows.length} nearby matches. Falling back to OpenStreetMap.`);
    }

    const openStreet = await this.searchViaOpenStreetMap(city, requestedStopTypes, origin, maxResults, warnings);
    const unique = this.dedupePlaces(openStreet).slice(0, maxResults);
    if (unique.length < targetCount) warnings.push('Not enough places found nearby.');
    return { places: unique, warnings };
  }

  private async searchViaGoogle(
    stopTypes: StopType[],
    origin: SearchOrigin,
    maxResults: number,
    apiKey: string,
    options?: PlacesSearchOptions,
  ): Promise<PlaceCandidate[]> {
    const mapping = stopTypesToKeywords();
    const radiusSteps = buildRadiusSteps(options);
    const perTypeLimit = Math.max(8, Math.min(20, Math.ceil(maxResults / Math.max(1, stopTypes.length)) + 4));
    const results: PlaceCandidate[] = [];

    for (const stopType of stopTypes) {
      const policy = CATEGORY_POLICIES[stopType];
      const merged = new Map<string, GoogleNearbyPlace>();
      let usedRadius = radiusSteps[0];
      let rawCandidates = 0;

      for (const radius of radiusSteps) {
        usedRadius = radius;
        const nearbyTypes = policy.nearbyTypes.length ? policy.nearbyTypes : [mapping[stopType].type || 'point_of_interest'];
        for (const nearbyType of nearbyTypes) {
          const nearbyUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
          nearbyUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
          nearbyUrl.searchParams.set('radius', String(radius));
          nearbyUrl.searchParams.set('type', nearbyType);
          if (mapping[stopType].keyword) nearbyUrl.searchParams.set('keyword', mapping[stopType].keyword as string);
          nearbyUrl.searchParams.set('key', apiKey);
          const nearbyRows = await this.fetchGooglePlaces(nearbyUrl.toString(), perTypeLimit);
          rawCandidates += nearbyRows.length;
          nearbyRows.forEach((row) => merged.set(row.place_id, row));
        }

        if (merged.size < perTypeLimit) {
          for (const query of policy.queryTerms) {
            const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
            textUrl.searchParams.set('query', query);
            textUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
            textUrl.searchParams.set('radius', String(radius));
            textUrl.searchParams.set('key', apiKey);
            const textRows = await this.fetchGooglePlaces(textUrl.toString(), perTypeLimit);
            rawCandidates += textRows.length;
            textRows.forEach((row) => merged.set(row.place_id, row));
          }
        }

        const filteredCount = Array.from(merged.values()).filter((row) => {
          const lat = row.geometry?.location?.lat;
          const lng = row.geometry?.location?.lng;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
          return haversineKm(origin.lat, origin.lng, Number(lat), Number(lng)) * 1000 <= radius;
        }).length;
        if (filteredCount >= perTypeLimit) break;
      }

      const acceptedRows: PlaceCandidate[] = [];
      const debugRows: Array<{ name: string; accepted: boolean; score: number; reasons: string[]; distanceKm: number; types: string[] }> = [];

      for (const row of merged.values()) {
        const lat = row.geometry?.location?.lat;
        const lng = row.geometry?.location?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const name = (row.name || '').trim();
        if (!name) continue;
        const distanceKm = haversineKm(origin.lat, origin.lng, Number(lat), Number(lng));
        if (distanceKm * 1000 > usedRadius) continue;

        const evaluation = evaluateCategoryCandidate(stopType, {
          name,
          address: row.vicinity || row.formatted_address || '',
          types: row.types || [],
        });

        debugRows.push({
          name,
          accepted: evaluation.accepted,
          score: evaluation.score,
          reasons: evaluation.reasons,
          distanceKm,
          types: row.types || [],
        });

        if (!evaluation.accepted) continue;
        acceptedRows.push({
          id: row.place_id || `${name}-${lat}-${lng}`,
          name,
          lat: Number(lat),
          lng: Number(lng),
          category: this.categoryFromGoogleTypes(row.types || [], stopType),
          address: row.vicinity || row.formatted_address || 'Address unavailable',
          tags: row.types || [stopType],
          costLevel: toCostLevel(row.price_level),
          stopType,
          openNow: row.opening_hours?.open_now,
          rating: row.rating,
          priceLevel: row.price_level,
          openingHoursText:
            typeof row.opening_hours?.open_now === 'boolean'
              ? row.opening_hours?.open_now
                ? 'Open now'
                : 'Closed now'
              : undefined,
        });
      }

      if (isDev) {
        const topDebug = debugRows
          .sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.score - a.score)
          .slice(0, 5)
          .map((row) => ({
            name: row.name,
            accepted: row.accepted,
            score: row.score,
            reasons: row.reasons,
            distanceKm: Math.round(row.distanceKm * 10) / 10,
            types: row.types,
          }));
        console.log('[places][debug]', {
          stopType,
          center: origin,
          radiusUsed: usedRadius,
          queryTerms: policy.queryTerms,
          rawCandidates,
          filteredCandidates: acceptedRows.length,
          topCandidates: topDebug,
        });
      }

      results.push(...acceptedRows.slice(0, perTypeLimit));
    }

    return results;
  }

  private async fetchGooglePlaces(url: string, limit: number): Promise<GoogleNearbyPlace[]> {
    try {
      const response = await fetch(url);
      const json = (await response.json()) as { results?: GoogleNearbyPlace[] };
      return (json.results || []).slice(0, limit);
    } catch {
      return [];
    }
  }

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
      const overpassJson = (await overpass.json()) as { elements?: OverpassElement[] };
      const rows = (overpassJson.elements || [])
        .filter((element) => typeof element.lat === 'number' && typeof element.lon === 'number' && element.tags?.name)
        .slice(0, maxResults)
        .map((element) => {
          const tags = element.tags || {};
          return {
            id: String(element.id),
            name: String(tags.name),
            lat: Number(element.lat),
            lng: Number(element.lon),
            category: this.categoryFromTags(tags),
            address: this.addressFromTags(tags, city),
            tags: Object.values(tags).map(String),
            costLevel: this.costLevelFromTags(tags),
            stopType: this.stopTypeFromTags(tags),
          };
        });

      const filtered = this.filterRowsByStopTypes(rows, stopTypes);
      const missingTypes = stopTypes.filter((type) => !filtered.some((row) => row.stopType === type));
      if (missingTypes.length > 0 && warnings) warnings.push(`Limited results for ${missingTypes.join(', ')}.`);
      return filtered.slice(0, maxResults);
    } catch {
      const nominatimFallback = await this.searchViaNominatim(city, stopTypes, origin, maxResults, warnings);
      return nominatimFallback;
    }
  }

  private buildOverpassQuery(lat: number, lng: number, stopTypes: StopType[]) {
    const queryKeywords = Array.from(
      new Set(stopTypes.flatMap((stopType) => STOP_TYPE_OPTIONS.find((option) => option.id === stopType)?.queryKeywords || [])),
    );
    const pattern = queryKeywords.join('|');
    return `[out:json][timeout:25];
(
  node(around:6500,${lat},${lng})[name][amenity~"${pattern}",i];
  node(around:6500,${lat},${lng})[name][tourism~"${pattern}",i];
  node(around:6500,${lat},${lng})[name][leisure~"${pattern}",i];
  node(around:6500,${lat},${lng})[name][shop~"${pattern}",i];
);
out body 80;`;
  }

  private categoryFromTags(tags: Record<string, string>) {
    const values = Object.values(tags).join(' ').toLowerCase();
    if (values.includes('museum')) return 'Museums';
    if (values.includes('park')) return 'Parks';
    if (values.includes('cafe')) return 'Coffee/Dessert';
    if (values.includes('restaurant')) return 'Food';
    if (values.includes('shop')) return 'Shopping';
    if (values.includes('amusement') || values.includes('tourist')) return 'Attractions';
    return 'Outdoors';
  }

  private stopTypeFromTags(tags: Record<string, string>): StopType {
    const values = Object.values(tags).join(' ').toLowerCase();
    if (/cafe|coffee/.test(values)) return 'coffee';
    if (/ice_cream|dessert|bakery/.test(values)) return 'dessert';
    if (/bar|pub|brewery/.test(values)) return 'bar';
    if (/museum|gallery|theatre|arts/.test(values)) return 'arts';
    if (/amusement|theme_park|tourist_attraction|zoo|aquarium/.test(values)) return 'attraction';
    if (/park|trail|viewpoint|garden|nature/.test(values)) return 'outdoors';
    if (/shop|mall|market|supermarket/.test(values)) return 'shopping';
    if (/cinema|arcade|bowling|activity/.test(values)) return 'activity';
    return 'restaurant';
  }

  private costLevelFromTags(tags: Record<string, string>) {
    const value = tags.price_range || '';
    if (value.includes('$$$')) return '$$$';
    if (value.includes('$$')) return '$$';
    return '$$';
  }

  private addressFromTags(tags: Record<string, string>, city: string) {
    const house = tags['addr:housenumber'];
    const street = tags['addr:street'];
    const locality = tags['addr:city'] || city;
    if (house && street) return `${house} ${street}, ${locality}`;
    if (street) return `${street}, ${locality}`;
    return locality;
  }

  private async searchViaNominatim(
    city: string,
    stopTypes: StopType[],
    origin?: SearchOrigin,
    maxResults = 60,
    warnings?: string[],
  ): Promise<PlaceCandidate[]> {
    const keywords = this.fallbackKeywords(stopTypes);
    const results: PlaceCandidate[] = [];
    const seen = new Set<string>();
    const perQueryLimit = Math.min(16, Math.max(8, Math.ceil(maxResults / Math.max(1, keywords.length)) + 2));

    for (const entry of keywords) {
      await waitIfNeeded();
      const query = `${entry.keyword} near ${city}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=${perQueryLimit}`;
      const response = await fetch(url, { headers: { 'User-Agent': 'TakeMeOut/1.0' } });
      const json = (await response.json()) as NominatimPlace[];
      for (const row of json) {
        const lat = Number(row.lat);
        const lng = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (origin && haversineKm(origin.lat, origin.lng, lat, lng) > 60) continue;
        const dedupe = `${lat.toFixed(4)}-${lng.toFixed(4)}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        results.push({
          id: String(row.place_id),
          name: row.name || this.titleFromDisplayName(row.display_name),
          lat,
          lng,
          category: this.categoryFromTags({ type: row.type || '', class: row.class || '', keyword: entry.keyword }),
          address: row.display_name,
          tags: [entry.keyword, row.type || '', row.class || ''].filter(Boolean),
          costLevel: '$$',
          stopType: entry.stopType,
        });
      }
    }

    const filtered = this.filterRowsByStopTypes(results, stopTypes);
    const missingTypes = stopTypes.filter((type) => !filtered.some((row) => row.stopType === type));
    if (missingTypes.length > 0 && warnings) warnings.push(`Limited results for ${missingTypes.join(', ')}.`);
    return filtered.slice(0, maxResults);
  }

  private fallbackKeywords(stopTypes: StopType[]) {
    const entries: Array<{ keyword: string; stopType: StopType }> = [];
    const selected: StopType[] = stopTypes.length ? stopTypes : ['activity', 'outdoors'];
    for (const stopType of selected) {
      const option = STOP_TYPE_OPTIONS.find((item) => item.id === stopType);
      if (!option) continue;
      option.queryKeywords.forEach((keyword) => entries.push({ keyword, stopType }));
    }
    const seen = new Set<string>();
    return entries.filter((entry) => {
      const key = `${entry.stopType}:${entry.keyword}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private titleFromDisplayName(displayName: string) {
    const first = displayName.split(',')[0]?.trim();
    return first || 'Interesting spot';
  }

  private filterRowsByStopTypes(rows: PlaceCandidate[], requestedStopTypes: StopType[]) {
    if (requestedStopTypes.length === 0) return rows;
    const allowed = new Set<StopType>(requestedStopTypes);
    return rows.filter((row) => allowed.has(row.stopType));
  }

  private categoryToStopType(category: string): StopType {
    const lower = category.toLowerCase();
    if (lower.includes('coffee')) return 'coffee';
    if (lower.includes('food')) return 'restaurant';
    if (lower.includes('shop')) return 'shopping';
    if (lower.includes('attraction')) return 'attraction';
    if (lower.includes('museum')) return 'arts';
    if (lower.includes('park') || lower.includes('outdoors')) return 'outdoors';
    return 'activity';
  }

  private categoryFromGoogleTypes(types: string[], stopType: StopType): string {
    const joined = types.join(' ').toLowerCase();
    if (joined.includes('cafe')) return 'Coffee/Dessert';
    if (joined.includes('restaurant')) return 'Food';
    if (joined.includes('bar')) return 'Bars';
    if (joined.includes('park')) return 'Outdoors';
    if (joined.includes('amusement_park') || joined.includes('theme_park') || joined.includes('tourist_attraction')) return 'Attractions';
    if (joined.includes('museum') || joined.includes('art_gallery')) return 'Arts';
    if (joined.includes('shopping_mall') || joined.includes('store')) return 'Shopping';
    return stopType.charAt(0).toUpperCase() + stopType.slice(1);
  }

  private dedupePlaces(rows: PlaceCandidate[]): PlaceCandidate[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = `${row.id}-${row.name.toLowerCase()}-${row.lat.toFixed(4)}-${row.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
