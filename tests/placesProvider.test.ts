import { describe, expect, it } from 'vitest';
import { formatOsmDisplayAddress } from '../src/utils/osmAddress';

describe('formatOsmDisplayAddress', () => {
  it('builds a full address from OSM street and locality tags', () => {
    expect(
      formatOsmDisplayAddress({
        'addr:housenumber': '145',
        'addr:street': 'South Broadway',
        'addr:city': 'Lawrence',
        'addr:state': 'MA',
      }),
    ).toBe('145 South Broadway, Lawrence, MA');
  });

  it('falls back to locality information when street details are missing', () => {
    expect(
      formatOsmDisplayAddress({
        'addr:town': 'Lawrence',
        'addr:state': 'MA',
      }),
    ).toBe('Lawrence, MA');
  });

  it('returns an empty string instead of stamping the query city onto the place', () => {
    expect(
      formatOsmDisplayAddress({
        name: "King's Subs",
      }),
    ).toBe('');
  });
});
