export interface RouteLeg {
  distanceKm: number;
  etaMin: number;
  polyline: [number, number][];
}

export interface RoutingProvider {
  route(points: [number, number][], mode: 'walk' | 'drive'): Promise<RouteLeg[]>;
}

export class OsrmProvider implements RoutingProvider {
  async route(points: [number, number][], mode: 'walk' | 'drive'): Promise<RouteLeg[]> {
    if (points.length < 2) return [];
    const profile = mode === 'walk' ? 'walking' : 'driving';
    // Build per-leg routes so each stop can display ETA from previous stop.
    const pairs = points.slice(0, -1).map((p, i) => [p, points[i + 1]] as const);
    const legs: RouteLeg[] = [];

    for (const [a, b] of pairs) {
      try {
        const url = `https://router.project-osrm.org/route/v1/${profile}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
        const r = await fetch(url);
        const j = (await r.json()) as any;
        const route = j.routes?.[0];
        legs.push({
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          etaMin: Math.round(route.duration / 60),
          polyline: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
        });
      } catch {
        // Keep itinerary generation resilient if OSRM is unavailable.
        legs.push({ distanceKm: 2, etaMin: mode === 'walk' ? 25 : 8, polyline: [a, b] });
      }
    }

    return legs;
  }
}
