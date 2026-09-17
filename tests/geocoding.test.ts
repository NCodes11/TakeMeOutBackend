import { describe, expect, it } from 'vitest';
import { buildNominatimGeocodeUrl, parseNominatimCoordinates } from '../src/utils/geocoding';

describe('geocoding', () => {
  it('uses free-form Nominatim queries for city/state destinations', () => {
    const url = buildNominatimGeocodeUrl('Las Vegas, NV');

    expect(url).toContain('q=Las%20Vegas%2C%20NV');
    expect(url).not.toContain('city=');
  });

  it('parses valid Nominatim coordinates', () => {
    expect(parseNominatimCoordinates([{ lat: '36.1716', lon: '-115.1391' }])).toEqual({
      latitude: 36.1716,
      longitude: -115.1391,
    });
  });

  it('rejects missing coordinates', () => {
    expect(parseNominatimCoordinates([{ lat: 'not-a-number' }])).toBeNull();
  });
});
