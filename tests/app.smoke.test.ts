import { describe, it, expect } from 'vitest';
import { stopsForPace } from '../src/services/scoring';

describe('smoke flow approximator', () => {
  it('can compute a packed day stop target for plan creation', () => {
    expect(stopsForPace('packed', 540)).toBeGreaterThanOrEqual(5);
  });
});
