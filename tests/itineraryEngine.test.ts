import { describe, expect, it } from 'vitest';
import { buildStopAllocation, enforceCapsAndAdjacency, orderAllocation } from '../src/services/itineraryEngine';

describe('itinerary engine', () => {
  it('allocates coffee once, outdoors once, shopping twice for 4 stops', () => {
    const allocation = buildStopAllocation(['coffee', 'outdoors', 'shopping'], 4);
    expect(allocation.filter((token) => token === 'coffee')).toHaveLength(1);
    expect(allocation.filter((token) => token === 'outdoors')).toHaveLength(1);
    expect(allocation.filter((token) => token === 'shopping')).toHaveLength(2);
  });

  it('keeps coffee at one and allocates extras to more repeatable type', () => {
    const allocation = buildStopAllocation(['coffee', 'restaurant'], 4);
    expect(allocation.filter((token) => token === 'coffee')).toHaveLength(1);
    expect(allocation.filter((token) => token === 'restaurant').length).toBeGreaterThanOrEqual(2);
  });

  it('allows repeats when only one type selected', () => {
    const allocation = buildStopAllocation(['outdoors'], 4);
    expect(allocation).toEqual(['outdoors', 'outdoors', 'outdoors', 'outdoors']);
  });

  it('orders coffee early and bars late', () => {
    const ordered = orderAllocation(['bar', 'shopping', 'coffee', 'restaurant'], '09:00', '20:00');
    expect(ordered[0]).toBe('coffee');
    expect(ordered[ordered.length - 1]).toBe('bar');
  });

  it('prevents disallowed back-to-back adjacency where alternatives exist', () => {
    const fixed = enforceCapsAndAdjacency(['coffee', 'coffee', 'shopping', 'outdoors']);
    expect(fixed[0] === 'coffee' && fixed[1] === 'coffee').toBe(false);
  });
});
