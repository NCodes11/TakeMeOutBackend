import { describe, expect, it } from 'vitest';
import { scorePlace } from '../src/services/scoring';

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

  it('boosts solo-friendly places over nightlife-oriented ones in solo mode', () => {
    const preferences = {
      interests: [],
      avoid: [],
      mustInclude: '',
      maxTravelMinutes: 30,
      kidFriendly: false,
      accessibleFriendly: false,
    };

    const soloFriendly = scorePlace(
      {
        id: 'solo-1',
        name: 'Corner Cafe',
        lat: 0,
        lng: 0,
        category: 'Cafe',
        address: 'A',
        tags: ['cafe', 'book_store', 'quiet'],
        stopType: 'coffee',
      },
      preferences,
      { groupType: 'Solo' },
    );

    const nightlife = scorePlace(
      {
        id: 'solo-2',
        name: 'Late Night Lounge',
        lat: 0,
        lng: 0,
        category: 'Nightlife',
        address: 'B',
        tags: ['bar', 'night_club', 'party'],
        stopType: 'bar',
      },
      preferences,
      { groupType: 'Solo' },
    );

    expect(soloFriendly).toBeGreaterThan(nightlife);
  });

  it('softens solo penalties when the user explicitly selected that category', () => {
    const basePreferences = {
      interests: [],
      avoid: [],
      mustInclude: '',
      maxTravelMinutes: 30,
      kidFriendly: false,
      accessibleFriendly: false,
    };

    const barPlace = {
      id: 'bar-1',
      name: 'Neighborhood Bar',
      lat: 0,
      lng: 0,
      category: 'Nightlife',
      address: 'A',
      tags: ['bar', 'night_club'],
      stopType: 'bar' as const,
    };

    const withoutExplicitSelection = scorePlace(barPlace, basePreferences, { groupType: 'Solo' });
    const withExplicitSelection = scorePlace(
      barPlace,
      { ...basePreferences, interests: ['bar'] },
      { groupType: 'Solo' },
    );

    expect(withExplicitSelection).toBeGreaterThan(withoutExplicitSelection);
  });

  it('keeps non-solo scoring unchanged', () => {
    const place = {
      id: 'same-1',
      name: 'City Cafe',
      lat: 0,
      lng: 0,
      category: 'Cafe',
      address: 'A',
      tags: ['cafe'],
      stopType: 'coffee' as const,
    };
    const preferences = {
      interests: ['coffee'],
      avoid: [],
      mustInclude: '',
      maxTravelMinutes: 30,
      kidFriendly: false,
      accessibleFriendly: false,
    };

    expect(scorePlace(place, preferences)).toBe(
      scorePlace(place, preferences, { groupType: 'Date' }),
    );
  });
});
