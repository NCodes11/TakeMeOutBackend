import { cachePlaces, getCachedPlaces } from '@/db/sqlite';
import { PlaceCandidate, StopType } from '@/types/models';
import { normalizeSelectedStopTypes, STOP_TYPE_OPTIONS } from '@/constants/stopTypes';

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

export interface PlacesProvider {
  search(city: string, interests: string[], origin?: SearchOrigin, desiredCount?: number): Promise<{ places: PlaceCandidate[]; warnings: string[] }>;
}

const rateLimiter = { lastMs: 0 };
const waitIfNeeded = async () => {
  const gap = 1100 - (Date.now() - rateLimiter.lastMs);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  rateLimiter.lastMs = Date.now();
};

const stopTypesToKeywords = (stopTypes: StopType[]): Record<StopType, { type?: string; keyword?: string }> => {
  const defaults: Record<StopType, { type?: string; keyword?: string }> = {
    coffee: { type: 'cafe', keyword: 'coffee' },
    restaurant: { type: 'restaurant' },
    bar: { type: 'bar', keyword: 'pub' },
    dessert: { type: 'bakery', keyword: 'dessert' },
    activity: { type: 'tourist_attraction', keyword: 'activity' },
    outdoors: { type: 'park', keyword: 'outdoor' },
    shopping: { type: 'shopping_mall', keyword: 'store' },
    arts: { type: 'museum', keyword: 'art' },
  };
  return stopTypes.reduce((acc, stopType) => {
    acc[stopType] = defaults[stopType];
    return acc;
  }, { ...defaults });
};

export class NominatimOverpassProvider implements PlacesProvider {
  async search(city: string, interests: string[], origin?: SearchOrigin, desiredCount = 3): Promise<{ places: PlaceCandidate[]; warnings: string[] }> {
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
      const mapped = cached.map((c) => ({
        id: `${c.lat}-${c.lng}-${c.name}`,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        category: c.category,
        address: c.name,
        tags: [c.category],
        stopType: this.categoryToStopType(c.category),
      }));
      const unique = this.dedupePlaces(mapped).slice(0, maxResults);
      if (unique.length < targetCount) warnings.push('Not enough places found nearby.');
      return {
        warnings,
        places: unique,
      };
    }

    if (googleApiKey && origin) {
      const googleRows = await this.searchViaGoogle(stopTypesToKeywords(requestedStopTypes), requestedStopTypes, origin, maxResults, googleApiKey);
      const strictGoogleRows = this.filterRowsByStopTypes(googleRows, requestedStopTypes);
      const uniqueGoogleRows = this.dedupePlaces(strictGoogleRows).slice(0, maxResults);
      if (uniqueGoogleRows.length >= targetCount) {
        console.log('[places] results_sample', {
          provider: 'google',
          requestedStopTypes,
          count: uniqueGoogleRows.length,
          top: uniqueGoogleRows.slice(0, 3).map((row) => ({ name: row.name, stopType: row.stopType, category: row.category })),
        });
        return { places: uniqueGoogleRows, warnings };
      }
      warnings.push(`Google Places returned only ${uniqueGoogleRows.length} nearby matches. Falling back to OpenStreetMap.`);
    }

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
        if (!center) return { places: [], warnings: ['Could not resolve this city. Try entering a nearby city.'] };
        centerLat = Number(center.lat);
        centerLng = Number(center.lon);
      }

      const query = this.buildOverpassQuery(centerLat, centerLng, requestedStopTypes);
      console.log('[places] overpass_query', { city, requestedStopTypes, centerLat, centerLng, stopCount: targetCount, query });
      await waitIfNeeded();
      const overpass = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });
      const overpassJson = (await overpass.json()) as { elements?: OverpassElement[] };
      const rows = (overpassJson.elements || [])
        .filter((el) => typeof el.lat === 'number' && typeof el.lon === 'number' && el.tags?.name)
        .slice(0, maxResults)
        .map((el) => {
          const tags = el.tags || {};
          return {
            id: String(el.id),
            name: String(tags.name),
            lat: Number(el.lat),
            lng: Number(el.lon),
            category: this.categoryFromTags(tags),
            address: this.addressFromTags(tags, city),
            tags: Object.values(tags).map(String),
            costLevel: this.costLevelFromTags(tags),
            stopType: this.stopTypeFromTags(tags),
          };
        });

      const filteredRows = this.filterRowsByStopTypes(rows, requestedStopTypes);
      const missingTypes = requestedStopTypes.filter((type) => !filteredRows.some((row) => row.stopType === type));
      if (missingTypes.length > 0) {
        warnings.push(`Limited results for ${missingTypes.join(', ')}. Added nearby alternatives.`);
      }

      const mergedRows =
        filteredRows.length > 0
          ? filteredRows
          : await this.searchViaNominatim(city, requestedStopTypes, origin, maxResults, warnings);
      const uniqueRows = this.dedupePlaces(mergedRows).slice(0, maxResults);
      if (uniqueRows.length < targetCount) warnings.push('Not enough places found nearby.');

      cachePlaces(
        uniqueRows.map((r) => ({
          providerKey: cacheKey,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          category: r.category,
          rawJSON: JSON.stringify(r),
        })),
      );

      console.log('[places] results_sample', {
        requestedStopTypes,
        count: uniqueRows.length,
        top: uniqueRows.slice(0, 3).map((row) => ({ name: row.name, stopType: row.stopType, category: row.category })),
      });
      return { places: uniqueRows, warnings };
    } catch {
      const nomiFallback = await this.searchViaNominatim(city, requestedStopTypes, origin, maxResults, warnings);
      const uniqueFallback = this.dedupePlaces(nomiFallback).slice(0, maxResults);
      if (uniqueFallback.length < targetCount) warnings.push('Not enough places found nearby.');
      return { places: uniqueFallback, warnings };
    }
  }

  private async searchViaGoogle(
    keywordsByType: Record<StopType, { type?: string; keyword?: string }>,
    stopTypes: StopType[],
    origin: SearchOrigin,
    maxResults: number,
    apiKey: string,
  ): Promise<PlaceCandidate[]> {
    const results: PlaceCandidate[] = [];
    const perTypeLimit = Math.max(8, Math.min(20, Math.ceil(maxResults / Math.max(1, stopTypes.length)) + 4));
    const radiusMeters = 8000;

    for (const stopType of stopTypes) {
      const mapping = keywordsByType[stopType] || {};
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.set('location', `${origin.lat},${origin.lng}`);
      url.searchParams.set('radius', String(radiusMeters));
      if (mapping.type) url.searchParams.set('type', mapping.type);
      if (mapping.keyword) url.searchParams.set('keyword', mapping.keyword);
      url.searchParams.set('key', apiKey);

      try {
        const response = await fetch(url.toString());
        const json = (await response.json()) as { results?: GoogleNearbyPlace[]; status?: string };
        const rows = (json.results || []).slice(0, perTypeLimit);
        for (const row of rows) {
          const lat = row.geometry?.location?.lat;
          const lng = row.geometry?.location?.lng;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const placeName = (row.name || '').trim();
          if (!placeName) continue;
          results.push({
            id: row.place_id || `${placeName}-${lat}-${lng}`,
            name: placeName,
            lat: Number(lat),
            lng: Number(lng),
            category: this.categoryFromGoogleTypes(row.types || [], stopType),
            address: row.vicinity || row.formatted_address || 'Address unavailable',
            tags: row.types || [stopType],
            costLevel: this.priceLevelToCost(row.price_level),
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
      } catch {
        // Keep provider resilient; caller handles fallback warning path.
      }
    }

    return results;
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
    return 'Outdoors';
  }

  private stopTypeFromTags(tags: Record<string, string>): StopType {
    const values = Object.values(tags).join(' ').toLowerCase();
    if (/cafe|coffee/.test(values)) return 'coffee';
    if (/ice_cream|dessert|bakery/.test(values)) return 'dessert';
    if (/bar|pub|brewery/.test(values)) return 'bar';
    if (/museum|gallery|theatre|arts/.test(values)) return 'arts';
    if (/park|trail|viewpoint|garden|nature/.test(values)) return 'outdoors';
    if (/shop|mall|market|supermarket/.test(values)) return 'shopping';
    if (/cinema|arcade|bowling|amusement|activity/.test(values)) return 'activity';
    return 'restaurant';
  }

  private costLevelFromTags(tags: Record<string, string>) {
    const value = tags['addr:postcode'] || tags.price_range || '';
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
        if (origin && this.distanceKm(origin.lat, origin.lng, lat, lng) > 25) continue;
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
    if (missingTypes.length > 0 && warnings) {
      warnings.push(`Limited results for ${missingTypes.join(', ')}. Used nearby alternatives.`);
    }

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

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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
    if (joined.includes('museum') || joined.includes('art_gallery')) return 'Arts';
    if (joined.includes('shopping_mall') || joined.includes('store')) return 'Shopping';
    return stopType.charAt(0).toUpperCase() + stopType.slice(1);
  }

  private priceLevelToCost(priceLevel?: number): string {
    if (typeof priceLevel !== 'number') return 'Unknown';
    if (priceLevel <= 1) return '$';
    if (priceLevel <= 3) return '$$';
    return '$$$';
  }

  private dedupePlaces(rows: PlaceCandidate[]): PlaceCandidate[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = `${row.name.toLowerCase()}-${row.lat.toFixed(4)}-${row.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
