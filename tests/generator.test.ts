import { describe, expect, it } from 'vitest';
import { generateStops } from '../src/services/generator';

const routing = {
  route: async (points: [number, number][]) => points.slice(0, -1).map(() => ({ distanceKm: 2, etaMin: 10, polyline: [] })),
};

describe('generator', () => {
  it('generates valid timeline stops', async () => {
    const stops = await generateStops(
      'p1',
      {
        city: 'SF',
        date: '2026-01-01',
        startTime: '09:00',
        endTime: '18:00',
        groupType: 'Date',
        adults: 2,
        kids: 0,
        kidAges: [],
        transport: 'drive',
        pace: 'balanced',
        budget: '$$',
        preferences: { interests: ['Food'], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
        startLocationMode: 'my-location',
        startAddress: '',
        returnToStart: true,
      },
      [
        { id: '1', name: 'Cafe', lat: 1, lng: 1, category: 'Food', address: 'A', tags: ['Food'] },
        { id: '2', name: 'Park', lat: 1, lng: 1, category: 'Parks', address: 'B', tags: ['Outdoors'] },
        { id: '3', name: 'Museum', lat: 1, lng: 1, category: 'Museums', address: 'C', tags: ['Museums'] },
        { id: '4', name: 'Dinner', lat: 1, lng: 1, category: 'Food', address: 'D', tags: ['Food'] },
      ],
      routing as any,
    );

    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0].planId).toBe('p1');
  });
});
