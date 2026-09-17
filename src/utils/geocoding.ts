export interface GeocodedCoordinates {
  latitude: number;
  longitude: number;
}

export const buildNominatimGeocodeUrl = (query: string) => {
  const trimmed = query.trim();
  return `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    trimmed,
  )}&format=json&limit=1`;
};

export const parseNominatimCoordinates = (rows: unknown): GeocodedCoordinates | null => {
  if (!Array.isArray(rows)) return null;

  const first = rows[0] as { lat?: unknown; lon?: unknown } | undefined;
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
};

export const fetchNominatimCoordinates = async (
  query: string,
): Promise<GeocodedCoordinates | null> => {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const response = await fetch(buildNominatimGeocodeUrl(trimmed));
  if (!response.ok) return null;

  return parseNominatimCoordinates(await response.json());
};
