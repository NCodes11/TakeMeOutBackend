import { describe, expect, it } from 'vitest';
import { buildOsmCandidateTypes, inferOsmStopType } from '../src/utils/osmStopTypes';

describe('osm stop type inference', () => {
  it('classifies fast food results as restaurants and adds normalized category types', () => {
    const tags = {
      amenity: 'fast_food',
      cuisine: 'sandwich',
      name: "King's Subs",
    };

    const inferred = inferOsmStopType(tags, ['restaurant', 'bar']);

    expect(inferred).toBe('restaurant');
    expect(buildOsmCandidateTypes(tags, inferred || 'activity')).toContain('restaurant');
  });

  it('classifies pubs as bars', () => {
    const tags = {
      amenity: 'pub',
      name: 'The Local',
    };

    expect(inferOsmStopType(tags, ['restaurant', 'bar'])).toBe('bar');
  });

  it('classifies shop-based results as shopping stops', () => {
    const tags = {
      shop: 'department_store',
      name: 'The Mall at Millenia',
    };

    expect(inferOsmStopType(tags, ['shopping'])).toBe('shopping');
  });
});
