import { cachePlaces, getCachedPlaces } from '@/db/sqlite';
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
  user_ratings_total?: number;
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

interface GooglePlaceDetailsResponse {
  result?: {
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
}

export interface PlacesSearchOptions {
  transport?: TransportType;
  maxTravelMinutes?: number;
  stopCount?: number;

  /** 'plan' favors caching; 'reroll' prioritizes fresh results and larger pools. */
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

const MAX_RADIUS_METERS = 60000;
const rateLimiter = { lastMs: 0 };

const waitIfNeeded = async () => {
  const gap = 1100 - (Date.now() - rateLimiter.lastMs);
  if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
  rateLimiter.lastMs = Date.now();
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const buildRadiusSteps = (options?: PlacesSearchOptions) => {
  const stopCount = Math.max(2, Math.min(8, Math.floor(options?.stopCount || 3)));
  const byStopCount =
    stopCount <= 3 ? [8000, 12000, 20000] : stopCount <= 6 ? [12000, 20000, 30000] : [20000, 30000, 45000];

  const speed = options?.transport === 'walk' ? 4.5 : 35;
  const minutes = Math.max(10, options?.maxTravelMinutes || 20);
  const baseMeters = Math.max(8000, Math.min(MAX_RADIUS_METERS, Math.round(((speed * minutes) / 60) * 1000)));

  const speedScale = options?.transport === 'walk' ? 0.75 : 1;
  const scaledByCount = byStopCount.map((value) => Math.round(value * speedScale));

  const expanded = Math.min(MAX_RADIUS_METERS, Math.round(baseMeters * 1.35));
  const steps = [baseMeters, expanded, ...scaledByCount, 60000];

  return Array.from(new Set(steps.filter((value) => value <= MAX_RADIUS_METERS))).sort((a, b) => a - b);
};

const ATTRACTION_RADIUS_STEPS = [15000, 30000, 60000, 80000];

const toCostLevel = (priceLevel?: number): string => {
  if (typeof priceLevel !== 'number') return 'Unknown';
  if (priceLevel <= 1) return '$';
  if (priceLevel === 2) return '$$';
  if (priceLevel === 3) return '$$$';
  return '$$$$';
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const normalizePlaceName = (name: string) => {
  return (name || '')
    .toLowerCase()
    .replace(/[#@].*$/g, '')
    .replace(/\s+-\s+.*$/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const brandKeyForPlace = (p: { name: string }) => normalizePlaceName(p.name);

/**
 * Extra hard-block safety net (in addition to categoryPolicy.ts).
 * This prevents “bad” classes/types slipping through from inconsistent provider tagging.
 */
const isGloballyBlocked = (place: { name?: string; address?: string; tags?: string[]; stopType?: StopType }) => {
  const txt = `${place.name || ''} ${place.address || ''} ${(place.tags || []).join(' ')}`.toLowerCase();

  // grocery / supermarket / convenience
  if (/\b(grocery|supermarket|convenience store|market)\b/.test(txt)) return true;

  // movie theaters / cinemas (user request)
  if (/\b(movie theater|cinema|cineplex)\b/.test(txt)) return true;

  return false;
};

const scoreCandidate = (p: PlaceCandidate, origin?: SearchOrigin) => {
  // Higher is better
  const rating = typeof p.rating === 'number' ? p.rating : 0;
  const reviews = typeof p.reviewCount === 'number' ? p.reviewCount : 0;

  const ratingScore = clamp01(rating / 5) * 4; // 0..4
  const reviewScore = Math.log10(reviews + 1) * 1.2; // ~0..(small)
  const distanceKm = origin ? haversineKm(origin.lat, origin.lng, p.lat, p.lng) : 0;
  const distancePenalty = origin ? clamp01(distanceKm / 35) * 1.4 : 0; // penalize far results

  return ratingScore + reviewScore - distancePenalty;
};

/**
 * Dedupes aggressively:
 * - providerId (best when available)
 * - exact coords + name
 * - brand-level name normalization (prevents Pizza Hut twice)
 */
const dedupeAggressive = (rows: PlaceCandidate[]) => {
  const seenProvider = new Set<string>();
  const seenCoordName = new Set<string>();
  const seenBrand = new Set<string>();

  const out: PlaceCandidate[] = [];
  for (const r of rows) {
    if (!r?.name || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;

    const pid = r.providerId ? String(r.providerId) : '';
    if (pid) {
      if (seenProvider.has(pid)) continue;
      seenProvider.add(pid);
    }

    const coordNameKey = `${r.lat.toFixed(5)}|${r.lng.toFixed(5)}|${normalizePlaceName(r.name)}`;
    if (seenCoordName.has(coordNameKey)) continue;
    seenCoordName.add(coordNameKey);

    const brandKey = brandKeyForPlace(r);
    if (brandKey && seenBrand.has(brandKey)) continue;
    if (brandKey) seenBrand.add(brandKey);

    out.push(r);
  }

  return out;
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
    const maxResults = Math.max(targetCount * 12, 48);
    const warnings: string[] = [];

    const mode = options?.mode ?? 'plan';
    const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

    const ttlMinutes = Math.max(5, options?.cacheTtlMinutes ?? (mode === 'reroll' ? 10 : 60));
    const bucket = Math.floor(Date.now() / (ttlMinutes * 60 * 1000));
    const buster = options?.cacheBuster ? `-${options.cacheBuster}` : '';

    const cacheKey = origin
      ? `places-${origin.lat.toFixed(3)}-${origin.lng.toFixed(3)}-${requestedStopTypes.join('-')}-${bucket}${buster}`
      : `places-${city.toLowerCase()}-${requestedStopTypes.join('-')}-${bucket}${buster}`;

    const cachedRows = getCachedPlaces(cacheKey, 12, mode === 'reroll');

    const cachedPlaces: PlaceCandidate[] =
      cachedRows.length > 0
        ? cachedRows
            .map((row) => {
              try {
                const parsed = JSON.parse(row.rawJSON) as PlaceCandidate;
                if (parsed && parsed.name && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) return parsed;
              } catch {}
              return {
                id: `${row.lat}-${row.lng}-${row.name}`,
                providerId: `${row.lat}-${row.lng}-${row.name}`,
                name: row.name,
                lat: row.lat,
                lng: row.lng,
                category: row.category,
                address: row.name,
                tags: [row.category],
                stopType: this.categoryToStopType(row.category),
              } as PlaceCandidate;
            })
            .filter(Boolean)
        : [];

    const merged: PlaceCandidate[] = [];

    if (mode === 'plan') merged.push(...cachedPlaces);

    if (googleApiKey && origin) {
      const googleRows = await this.searchViaGoogle(requestedStopTypes, city, origin, maxResults, googleApiKey, options);
      merged.push(...googleRows);
    }

    if (merged.length < maxResults) {
      const openStreet = await this.searchViaOpenStreetMap(city, requestedStopTypes, origin, maxResults, warnings);
      merged.push(...openStreet);
    }

    if (mode === 'reroll' && merged.length < targetCount && cachedPlaces.length > 0) {
      merged.push(...cachedPlaces);
    }

    // Policy filter + global blocks
    const policyFiltered = merged.filter((row) => {
      if (!row) return false;
      if (!requestedStopTypes.includes(row.stopType)) return false;
      if (isGloballyBlocked(row)) return false;

      const evaluation = evaluateCategoryCandidate(row.stopType, {
        name: row.name,
        address: row.address,
        types: row.tags,
      });

      return evaluation.accepted;
    });

    // Rank by quality and remove duplicates (including chain duplicates)
    policyFiltered.sort((a, b) => scoreCandidate(b, origin) - scoreCandidate(a, origin));
    const unique = dedupeAggressive(policyFiltered);

    const final = unique.slice(0, maxResults);

    if (origin && final.length > 0) {
      try {
        cachePlaces(
          final.slice(0, 100).map((p) => ({
            providerKey: cacheKey,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            category: p.category,
            rawJSON: JSON.stringify(p),
          })),
        );
      } catch {
        // best-effort
      }
    }

    if (final.length < targetCount) warnings.push('Not enough places found nearby.');
    return { places: final, warnings };
  }

  private async searchViaGoogle(
    stopTypes: StopType[],
    city: string,
    origin: SearchOrigin,
    maxResults: number,
    apiKey: string,
    options?: PlacesSearchOptions,
  ): Promise<PlaceCandidate[]> {
    const radiusSteps = buildRadiusSteps(options);
    const mode = options?.mode ?? 'plan';

    const base = Math.max(14, Math.min(30, Math.ceil(maxResults / Math.max(1, stopTypes.length)) + 8));
    const perTypeLimit = mode === 'reroll' ? Math.min(55, base + 18) : base;

    const results: PlaceCandidate[] = [];

    for (const stopType of stopTypes) {
      if (stopType === 'attraction') {
        results.push(...(await this.searchGoogleAttractions(origin, city, perTypeLimit, apiKey, options)));
        continue;
      }

      const policy = CATEGORY_POLICIES[stopType];
      const merged = new Map<string, GoogleNearbyPlace>();
      let usedRadius = radiusSteps[0];

      for (const radius of radiusSteps) {
        usedRadius = radius;

        const nearbyTypes = policy.nearbyTypes.length ? policy.nearbyTypes : ['point_of_interest'];

        for (const nearbyType of nearbyTypes) {
          const nearbyUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
          nearbyUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
          nearbyUrl.searchParams.set('radius', String(radius));
          nearbyUrl.searchParams.set('type', nearbyType);
          nearbyUrl.searchParams.set('key', apiKey);

          const nearbyRows = await this.fetchGooglePlaces(nearbyUrl.toString(), perTypeLimit);
          nearbyRows.forEach((row) => merged.set(row.place_id, row));
        }

        for (const query of policy.queryTerms) {
          const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
          textUrl.searchParams.set('query', `${query} in ${city}`);
          textUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
          textUrl.searchParams.set('radius', String(radius));
          textUrl.searchParams.set('key', apiKey);

          const textRows = await this.fetchGooglePlaces(textUrl.toString(), perTypeLimit);
          textRows.forEach((row) => merged.set(row.place_id, row));
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

      for (const row of merged.values()) {
        const geometry = await this.resolveGoogleGeometry(row, apiKey);
        const lat = geometry?.lat;
        const lng = geometry?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const name = (row.name || '').trim();
        if (!name) continue;

        const distanceKm = haversineKm(origin.lat, origin.lng, Number(lat), Number(lng));
        if (distanceKm * 1000 > usedRadius) continue;

        const tags = row.types || [stopType];
        const address = row.vicinity || row.formatted_address || '';

        if (isGloballyBlocked({ name, address, tags, stopType })) continue;

        const evaluation = evaluateCategoryCandidate(stopType, {
          name,
          address,
          types: tags,
        });
        if (!evaluation.accepted) continue;

        acceptedRows.push({
          id: row.place_id || `${name}-${lat}-${lng}`,
          providerId: row.place_id,
          name,
          lat: Number(lat),
          lng: Number(lng),
          category: this.categoryFromGoogleTypes(row.types || [], stopType),
          address: address || 'Address unavailable',
          tags,
          costLevel: toCostLevel(row.price_level),
          stopType,
          openNow: row.opening_hours?.open_now,
          rating: row.rating,
          reviewCount: row.user_ratings_total,
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
        console.log('[places][google]', {
          stopType,
          radiusUsed: usedRadius,
          candidates: acceptedRows.length,
        });
      }

      results.push(...acceptedRows.slice(0, perTypeLimit));
    }

    return results;
  }

  private async fetchGooglePlaces(url: string, limit: number): Promise<GoogleNearbyPlace[]> {
    const all: GoogleNearbyPlace[] = [];
    let pageUrl = url;

    for (let page = 0; page < 3 && all.length < limit; page += 1) {
      try {
        const response = await fetch(pageUrl);
        const json = (await response.json()) as { results?: GoogleNearbyPlace[]; next_page_token?: string };

        const rows = json.results || [];
        for (const r of rows) {
          all.push(r);
          if (all.length >= limit) break;
        }

        const token = json.next_page_token;
        if (!token || all.length >= limit) break;

        await new Promise((res) => setTimeout(res, 1600));

        const next = new URL(url);
        next.searchParams.set('pagetoken', token);
        pageUrl = next.toString();
      } catch {
        break;
      }
    }

    return all.slice(0, limit);
  }

  private async fetchGooglePlaceDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetailsResponse['result'] | null> {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('fields', 'geometry');
      url.searchParams.set('key', apiKey);
      const response = await fetch(url.toString());
      const json = (await response.json()) as GooglePlaceDetailsResponse;
      return json.result || null;
    } catch {
      return null;
    }
  }

  private async resolveGoogleGeometry(row: GoogleNearbyPlace, apiKey: string): Promise<{ lat: number; lng: number } | null> {
    const lat = row.geometry?.location?.lat;
    const lng = row.geometry?.location?.lng;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };

    if (!row.place_id) return null;
    const details = await this.fetchGooglePlaceDetails(row.place_id, apiKey);
    const detailLat = details?.geometry?.location?.lat;
    const detailLng = details?.geometry?.location?.lng;
    if (!Number.isFinite(detailLat) || !Number.isFinite(detailLng)) return null;
    return { lat: Number(detailLat), lng: Number(detailLng) };
  }

  private async searchGoogleAttractions(
    origin: SearchOrigin,
    city: string,
    perTypeLimit: number,
    apiKey: string,
    options?: PlacesSearchOptions,
  ): Promise<PlaceCandidate[]> {
    const policy = CATEGORY_POLICIES.attraction;
    const merged = new Map<string, GoogleNearbyPlace>();
    const radiusSteps = options ? Array.from(new Set([...ATTRACTION_RADIUS_STEPS])) : ATTRACTION_RADIUS_STEPS;

    const requestedMin = Math.max(24, perTypeLimit);

    for (const radius of radiusSteps) {
      for (const nearbyType of policy.nearbyTypes) {
        const nearbyUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
        nearbyUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
        nearbyUrl.searchParams.set('radius', String(radius));
        nearbyUrl.searchParams.set('type', nearbyType);
        nearbyUrl.searchParams.set('key', apiKey);

        const nearbyRows = await this.fetchGooglePlaces(nearbyUrl.toString(), requestedMin);
        nearbyRows.forEach((row) => merged.set(row.place_id, row));
      }

      for (const query of policy.queryTerms) {
        const textUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        textUrl.searchParams.set('query', `${query} in ${city}`);
        textUrl.searchParams.set('location', `${origin.lat},${origin.lng}`);
        textUrl.searchParams.set('radius', String(radius));
        textUrl.searchParams.set('key', apiKey);

        const textRows = await this.fetchGooglePlaces(textUrl.toString(), requestedMin);
        textRows.forEach((row) => merged.set(row.place_id, row));
      }

      const filtered = await this.filterAttractionCandidates(merged, origin, radius, apiKey);
      if (filtered.length >= requestedMin) return filtered.slice(0, perTypeLimit);
    }

    const lastRadius = radiusSteps[radiusSteps.length - 1] ?? 60000;
    const fallback = await this.filterAttractionCandidates(merged, origin, lastRadius, apiKey);
    return fallback.slice(0, perTypeLimit);
  }

  private async filterAttractionCandidates(
    merged: Map<string, GoogleNearbyPlace>,
    origin: SearchOrigin,
    radius: number,
    apiKey: string,
  ): Promise<PlaceCandidate[]> {
    const acceptedRows: PlaceCandidate[] = [];

    for (const row of merged.values()) {
      const geometry = await this.resolveGoogleGeometry(row, apiKey);
      const lat = geometry?.lat;
      const lng = geometry?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const name = (row.name || '').trim();
      if (!name) continue;

      const distanceKm = haversineKm(origin.lat, origin.lng, Number(lat), Number(lng));
      if (distanceKm * 1000 > radius) continue;

      const tags = row.types || ['attraction'];
      const address = row.vicinity || row.formatted_address || '';

      if (isGloballyBlocked({ name, address, tags, stopType: 'attraction' })) continue;

      const evaluation = evaluateCategoryCandidate('attraction', {
        name,
        address,
        types: tags,
      });
      if (!evaluation.accepted) continue;

      acceptedRows.push({
        id: row.place_id || `${name}-${lat}-${lng}`,
        providerId: row.place_id,
        name,
        lat: Number(lat),
        lng: Number(lng),
        category: this.categoryFromGoogleTypes(row.types || [], 'attraction'),
        address: address || 'Address unavailable',
        tags,
        costLevel: toCostLevel(row.price_level),
        stopType: 'attraction',
        openNow: row.opening_hours?.open_now,
        rating: row.rating,
        reviewCount: row.user_ratings_total,
        priceLevel: row.price_level,
        openingHoursText:
          typeof row.opening_hours?.open_now === 'boolean'
            ? row.opening_hours?.open_now
              ? 'Open now'
              : 'Closed now'
            : undefined,
      });
    }

    acceptedRows.sort((a, b) => scoreCandidate(b, origin) - scoreCandidate(a, origin));
    return acceptedRows;
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
          const stopType = this.stopTypeFromTags(tags);
          const name = String(tags.name);

          const candidate: PlaceCandidate = {
            id: String(element.id),
            providerId: String(element.id),
            name,
            lat: Number(element.lat),
            lng: Number(element.lon),
            category: this.categoryFromTags(tags),
            address: this.addressFromTags(tags, city),
            tags: Object.values(tags).map(String),
            costLevel: this.costLevelFromTags(tags),
            stopType,
          };

          return candidate;
        })
        .filter((row) => !isGloballyBlocked(row));

      const filtered = rows.filter((row) => stopTypes.includes(row.stopType));
      const missingTypes = stopTypes.filter((type) => !filtered.some((row) => row.stopType === type));
      if (missingTypes.length > 0 && warnings) warnings.push(`Limited results for ${missingTypes.join(', ')}.`);
      return filtered.slice(0, maxResults);
    } catch {
      return this.searchViaNominatim(city, stopTypes, origin, maxResults, warnings);
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
out body 120;`;
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
    const perQueryLimit = Math.min(22, Math.max(12, Math.ceil(maxResults / Math.max(1, keywords.length)) + 4));

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

        const name = row.name || this.titleFromDisplayName(row.display_name);

        const candidate: PlaceCandidate = {
          id: String(row.place_id),
          providerId: String(row.place_id),
          name,
          lat,
          lng,
          category: this.categoryFromTags({ type: row.type || '', class: row.class || '', keyword: entry.keyword }),
          address: row.display_name,
          tags: [entry.keyword, row.type || '', row.class || ''].filter(Boolean),
          costLevel: '$$',
          stopType: entry.stopType,
        };

        if (isGloballyBlocked(candidate)) continue;

        const dedupeKey = `${brandKeyForPlace(candidate)}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push(candidate);
      }
    }

    const filtered = results.filter((row) => stopTypes.includes(row.stopType));
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
    if (value.includes('$$$$')) return '$$$$';
    if (value.includes('$$$')) return '$$$';
    if (value.includes('$$')) return '$$';
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
}
