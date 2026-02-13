import { describe, expect, it } from 'vitest';
import { generateStops } from '../src/services/generator';

const routing = {
  route: async (points: [number, number][]) => points.slice(0, -1).map(() => ({ distanceKm: 2, etaMin: 10, polyline: [] })),
};

describe('generator', () => {
  it('generates requested stop count when enough candidates exist', async () => {
    const candidates = [
      { id: '1', name: 'Cafe One', lat: 37.77, lng: -122.41, category: 'Coffee/Dessert', address: 'A', tags: ['coffee'], stopType: 'coffee' },
      { id: '2', name: 'Cafe Two', lat: 37.78, lng: -122.42, category: 'Coffee/Dessert', address: 'B', tags: ['coffee'], stopType: 'coffee' },
      { id: '3', name: 'Cafe Three', lat: 37.79, lng: -122.43, category: 'Coffee/Dessert', address: 'C', tags: ['coffee'], stopType: 'coffee' },
      { id: '4', name: 'Cafe Four', lat: 37.8, lng: -122.44, category: 'Coffee/Dessert', address: 'D', tags: ['coffee'], stopType: 'coffee' },
    ];
    const stops = await generateStops(
      'p1',
      {
        city: 'Orlando,FL',
        stopCount: 4,
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
        preferences: { interests: ['coffee'], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
        startLocationMode: 'my-location',
        startAddress: '',
        returnToStart: true,
      },
      candidates,
      routing,
    );

    expect(stops.length).toBe(4);
    expect(stops[0].planId).toBe('p1');
    expect(stops.every((stop) => stop.stopType === 'coffee')).toBe(true);
  });

  it('returns only selected stop types when multiple exist', async () => {
    const candidates = [
      { id: '1', name: 'Cafe One', lat: 37.77, lng: -122.41, category: 'Coffee/Dessert', address: 'A', tags: ['coffee'], stopType: 'coffee' },
      { id: '2', name: 'Pub One', lat: 37.78, lng: -122.42, category: 'Nightlife', address: 'B', tags: ['bar'], stopType: 'bar' },
      { id: '3', name: 'Cafe Two', lat: 37.79, lng: -122.43, category: 'Coffee/Dessert', address: 'C', tags: ['coffee'], stopType: 'coffee' },
      { id: '4', name: 'Pub Two', lat: 37.8, lng: -122.44, category: 'Nightlife', address: 'D', tags: ['bar'], stopType: 'bar' },
      { id: '5', name: 'Bistro', lat: 37.81, lng: -122.45, category: 'Food', address: 'E', tags: ['restaurant'], stopType: 'restaurant' },
    ];
    const stops = await generateStops(
      'p2',
      {
        city: 'Orlando,FL',
        stopCount: 4,
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
        preferences: { interests: ['coffee', 'bar'], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
        startLocationMode: 'my-location',
        startAddress: '',
        returnToStart: true,
      },
      candidates,
      routing,
    );

    expect(stops.length).toBe(4);
    expect(stops.every((stop) => stop.stopType === 'coffee' || stop.stopType === 'bar')).toBe(true);
  });
});
