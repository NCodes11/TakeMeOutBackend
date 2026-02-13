import { describe, it, expect } from 'vitest';
import { buildStopAllocation } from '../src/services/itineraryEngine';

describe('smoke flow approximator', () => {
  it('builds stable allocation token count for plan creation', () => {
    const allocation = buildStopAllocation(['coffee', 'outdoors', 'shopping'], 4);
    expect(allocation.length).toBe(4);
  });
});
