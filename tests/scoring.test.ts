import { describe, expect, it } from 'vitest';
import { scorePlace, stopsForPace } from '../src/services/scoring';

describe('scoring', () => {
  it('scores matching interests and constraints', () => {
    const score = scorePlace(
      { id: '1', name: 'Family Park', lat: 0, lng: 0, category: 'Parks', address: 'A', tags: ['kid', 'park'], stopType: 'outdoors' },
      {
        interests: ['Parks'],
        avoid: ['bar'],
        mustInclude: 'family',
        maxTravelMinutes: 30,
        kidFriendly: true,
        accessibleFriendly: false,
      },
    );
    expect(score).toBeGreaterThan(5);
  });

  it('sets pace stop count', () => {
    expect(stopsForPace('relaxed', 600)).toBe(3);
    expect(stopsForPace('balanced', 600)).toBe(4);
    expect(stopsForPace('packed', 600)).toBe(6);
  });
});
