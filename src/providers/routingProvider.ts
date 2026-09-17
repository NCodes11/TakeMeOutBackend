export interface RouteLeg {
  distanceKm: number;
  etaMin: number;
  polyline: [number, number][];
}

export interface RoutingProvider {
  route(points: [number, number][], mode: 'walk' | 'drive'): Promise<RouteLeg[]>;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

const fallbackEtaMin = (mode: 'walk' | 'drive') => (mode === 'walk' ? 25 : 8);

const fallbackLeg = (
  a: [number, number],
  b: [number, number],
  mode: 'walk' | 'drive',
): RouteLeg => ({
  distanceKm: 2,
  etaMin: fallbackEtaMin(mode),
  polyline: [a, b],
});

const chunkGeometryByLegs = (
  geometry: [number, number][],
  legCount: number,
): [number, number][][] => {
  if (legCount <= 0) return [];
  if (geometry.length <= 1) {
    return Array.from({ length: legCount }, () => geometry.length ? [...geometry] : []);
  }

  const chunks: [number, number][][] = [];
  const lastIndex = geometry.length - 1;

  for (let i = 0; i < legCount; i += 1) {
    const startIdx = Math.floor((i / legCount) * lastIndex);
    const endIdx = i === legCount - 1 ? lastIndex : Math.floor(((i + 1) / legCount) * lastIndex);

    const slice = geometry.slice(startIdx, Math.max(startIdx + 2, endIdx + 1));
    chunks.push(slice.length >= 2 ? slice : [geometry[startIdx], geometry[Math.min(lastIndex, startIdx + 1)]]);
  }

  return chunks;
};

export class OsrmProvider implements RoutingProvider {
  async route(points: [number, number][], mode: 'walk' | 'drive'): Promise<RouteLeg[]> {
    if (points.length < 2) return [];

    const profile = mode === 'walk' ? 'walking' : 'driving';
    const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/${coords}` +
      `?overview=full&geometries=geojson&steps=false`;

    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`OSRM ${r.status}`);

      const j = (await r.json()) as {
        routes?: Array<{
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: [number, number][] };
          legs?: Array<{
            distance?: number;
            duration?: number;
          }>;
        }>;
      };

      const route = j.routes?.[0];
      const rawLegs = route?.legs;

      if (!route || !rawLegs || rawLegs.length === 0) {
        throw new Error('No route legs returned');
      }

      const fullGeometry: [number, number][] = Array.isArray(route.geometry?.coordinates)
        ? route.geometry!.coordinates.map((c) => [c[1], c[0]])
        : [];

      const geometryChunks = chunkGeometryByLegs(fullGeometry, rawLegs.length);

      return rawLegs.map((leg, index) => ({
        distanceKm: round1((leg.distance || 0) / 1000),
        etaMin: Math.max(1, Math.round((leg.duration || 0) / 60)),
        polyline:
          geometryChunks[index] && geometryChunks[index].length >= 2
            ? geometryChunks[index]
            : [points[index], points[index + 1]],
      }));
    } catch {
      const legs: RouteLeg[] = [];
      for (let i = 0; i < points.length - 1; i += 1) {
        legs.push(fallbackLeg(points[i], points[i + 1], mode));
      }
      return legs;
    }
  }
}