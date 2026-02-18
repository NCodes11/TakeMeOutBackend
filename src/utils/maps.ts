export interface LatLng {
  lat: number;
  lng: number;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const hasValidCoords = (coords?: Partial<LatLng> | null): coords is LatLng =>
  !!coords && isFiniteNumber(coords.lat) && isFiniteNumber(coords.lng);

// Use explicit coordinate URLs to avoid Apple Maps falling back to broad geocode searches.
export const buildAppleMapsDirectionsUrl = (origin: LatLng, destination: LatLng, mode: 'd' | 'w' = 'd') =>
  `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}&dirflg=${mode}`;

export const buildAppleMapsPinUrl = (destination: LatLng, name: string) =>
  `https://maps.apple.com/?ll=${destination.lat},${destination.lng}&q=${encodeURIComponent(name)}`;
