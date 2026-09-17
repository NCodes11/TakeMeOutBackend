export interface LatLng {
  lat: number;
  lng: number;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const hasValidCoords = (coords?: Partial<LatLng> | null): coords is LatLng =>
  !!coords && isFiniteNumber(coords.lat) && isFiniteNumber(coords.lng);

export const buildGoogleMapsDirectionsUrl = (
  origin: LatLng,
  destination: LatLng,
  mode: 'drive' | 'walk' = 'drive',
) => {
  const travelmode = mode === 'walk' ? 'walking' : 'driving';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${travelmode}`;
};

export const buildGoogleMapsPinUrl = (destination: LatLng) =>
  `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;

/** Apple Maps turn-by-turn deep link. `mode` uses Apple's dirflg values: 'd' = drive, 'w' = walk. */
export const buildAppleMapsDirectionsUrl = (origin: LatLng, destination: LatLng, mode: 'd' | 'w' = 'd') =>
  `http://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}&dirflg=${mode}`;