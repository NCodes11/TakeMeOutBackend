import { cachePlaces, getCachedPlaces } from '@/db/sqlite';
import { PlaceCandidate } from '@/types/models';

export interface PlacesProvider {
  search(city: string, interests: string[]): Promise<PlaceCandidate[]>;
}

const rateLimiter = { lastMs: 0 };
const waitIfNeeded = async () => {
  const gap = 1100 - (Date.now() - rateLimiter.lastMs);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  rateLimiter.lastMs = Date.now();
};

export class NominatimOverpassProvider implements PlacesProvider {
  async search(city: string, interests: string[]): Promise<PlaceCandidate[]> {
    const cacheKey = `nomi-${city.toLowerCase()}`;
    const cached = getCachedPlaces(cacheKey);
    if (cached.length > 0) {
      return cached.map((c) => ({
        id: `${c.lat}-${c.lng}-${c.name}`,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        category: c.category,
        address: c.name,
        tags: [c.category],
      }));
    }

    try {
      await waitIfNeeded();
      const geocode = await fetch(
        `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'DayDate/1.0' } },
      );
      const geoJson = (await geocode.json()) as { lat: string; lon: string }[];
      const center = geoJson[0];
      if (!center) throw new Error('City not found');

      const query = this.buildOverpassQuery(Number(center.lat), Number(center.lon), interests);
      await waitIfNeeded();
      const overpass = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });
      const overpassJson = (await overpass.json()) as { elements?: any[] };
      const rows = (overpassJson.elements || []).slice(0, 60).map((el) => ({
        id: String(el.id),
        name: el.tags?.name || 'Interesting spot',
        lat: el.lat,
        lng: el.lon,
        category: this.categoryFromTags(el.tags || {}),
        address: el.tags?.['addr:street'] || city,
        tags: Object.values(el.tags || {}).map(String),
      }));

      cachePlaces(
        rows.map((r) => ({
          providerKey: cacheKey,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          category: r.category,
          rawJSON: JSON.stringify(r),
        })),
      );

      return rows;
    } catch {
      return [
        {
          id: 'fallback-park',
          name: `${city} Central Park`,
          lat: 0,
          lng: 0,
          category: 'Parks',
          address: city,
          tags: ['Parks', 'Scenic views'],
        },
        {
          id: 'fallback-cafe',
          name: `${city} Neighborhood Cafe`,
          lat: 0,
          lng: 0,
          category: 'Coffee/Dessert',
          address: city,
          tags: ['Coffee/Dessert'],
        },
      ];
    }
  }

  private buildOverpassQuery(lat: number, lng: number, interests: string[]) {
    const keyTags = ['amenity', 'tourism', 'leisure'];
    const filter = interests.length ? interests.join('|') : 'restaurant|cafe|park|museum';
    return `[out:json][timeout:25];(node(around:6000,${lat},${lng})[${keyTags
      .map((t) => `${t}~"${filter}"`)
      .join('|')}];);out body;`;
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
}
