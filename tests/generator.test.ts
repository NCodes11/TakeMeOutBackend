import { describe, expect, it } from 'vitest';
import { buildFeelingLuckyStopTypes, generateStops, resolvePlannableStopCount } from '../src/services/generator';
import { PlaceCandidate } from '../src/types/models';

const routing = {
  route: async (points: [number, number][]) => points.slice(0, -1).map(() => ({ distanceKm: 2, etaMin: 10, polyline: [] })),
};

describe('generator', () => {
  it('builds a family-safe feeling lucky mix without bars', () => {
    const mix = buildFeelingLuckyStopTypes({
      city: 'Orlando,FL',
      stopCount: 4,
      date: '2026-01-01',
      startTime: '09:00',
      endTime: '18:00',
      groupType: 'Family',
      adults: 2,
      kids: 2,
      kidAges: [6, 10],
      transport: 'drive',
      budget: '$$',
      feelingLucky: true,
      preferences: { interests: [], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
      startLocationMode: 'my-location',
      startAddress: '',
      returnToStart: true,
    });

    expect(mix.includes('bar')).toBe(false);
    expect(mix.some((type) => type === 'activity' || type === 'outdoors' || type === 'attraction')).toBe(true);
  });

  it('builds a solo feeling lucky mix without default nightlife bias', () => {
    const mix = buildFeelingLuckyStopTypes({
      city: 'Austin,TX',
      stopCount: 4,
      date: '2026-01-01',
      startTime: '09:00',
      endTime: '18:00',
      groupType: 'Solo',
      adults: 1,
      kids: 0,
      kidAges: [],
      transport: 'walk',
      budget: '$$',
      feelingLucky: true,
      preferences: { interests: [], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
      startLocationMode: 'my-location',
      startAddress: '',
      returnToStart: true,
    });

    expect(mix.includes('bar')).toBe(false);
    expect(mix.some((type) => type === 'coffee' || type === 'arts' || type === 'outdoors')).toBe(true);
  });

  it('keeps feeling lucky mix budget/travel constrained for low-budget short trips', () => {
    const mix = buildFeelingLuckyStopTypes({
      city: 'Orlando,FL',
      stopCount: 4,
      date: '2026-01-01',
      startTime: '09:00',
      endTime: '18:00',
      groupType: 'Friends',
      adults: 3,
      kids: 0,
      kidAges: [],
      transport: 'walk',
      budget: '$',
      feelingLucky: true,
      preferences: { interests: [], avoid: [], mustInclude: '', maxTravelMinutes: 15, kidFriendly: false, accessibleFriendly: false },
      startLocationMode: 'my-location',
      startAddress: '',
      returnToStart: false,
    });

    expect(mix.includes('bar')).toBe(false);
    expect(mix.includes('attraction')).toBe(false);
  });

  it('generates requested stop count when enough candidates exist', async () => {
    const candidates: PlaceCandidate[] = [
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
        budget: '$$',
        feelingLucky: false,
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
    const candidates: PlaceCandidate[] = [
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
        budget: '$$',
        feelingLucky: false,
        preferences: { interests: ['coffee', 'bar'], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
        startLocationMode: 'my-location',
        startAddress: '',
        returnToStart: true,
      },
      candidates,
      routing,
    );

    expect(stops.length).toBe(3);
    expect(stops.every((stop) => stop.stopType === 'coffee' || stop.stopType === 'bar')).toBe(true);
    expect(stops.filter((stop) => stop.stopType === 'coffee')).toHaveLength(1);
  });

  it('keeps explicitly selected solo categories while favoring lower-pressure repeats', async () => {
    const candidates: PlaceCandidate[] = [
      { id: '1', name: 'Cafe One', lat: 37.77, lng: -122.41, category: 'Cafe', address: 'A', tags: ['cafe', 'quiet'], stopType: 'coffee' },
      { id: '2', name: 'Cafe Two', lat: 37.78, lng: -122.42, category: 'Cafe', address: 'B', tags: ['cafe', 'book_store'], stopType: 'coffee' },
      { id: '3', name: 'Cafe Three', lat: 37.79, lng: -122.43, category: 'Cafe', address: 'C', tags: ['cafe'], stopType: 'coffee' },
      { id: '4', name: 'Bar One', lat: 37.8, lng: -122.44, category: 'Nightlife', address: 'D', tags: ['bar', 'night_club'], stopType: 'bar' },
      { id: '5', name: 'Bar Two', lat: 37.81, lng: -122.45, category: 'Nightlife', address: 'E', tags: ['bar'], stopType: 'bar' },
    ];

    const stops = await generateStops(
      'p3',
      {
        city: 'Austin,TX',
        stopCount: 4,
        date: '2026-01-01',
        startTime: '09:00',
        endTime: '18:00',
        groupType: 'Solo',
        adults: 1,
        kids: 0,
        kidAges: [],
        transport: 'drive',
        budget: '$$',
        feelingLucky: false,
        preferences: { interests: ['coffee', 'bar'], avoid: [], mustInclude: '', maxTravelMinutes: 30, kidFriendly: false, accessibleFriendly: false },
        startLocationMode: 'my-location',
        startAddress: '',
        returnToStart: true,
      },
      candidates,
      routing,
    );

    expect(stops.some((stop) => stop.stopType === 'bar')).toBe(true);
    expect(stops.filter((stop) => stop.stopType === 'coffee').length).toBeGreaterThan(
      stops.filter((stop) => stop.stopType === 'bar').length,
    );
  });

  it('caps requested stops to what the time window can realistically support', () => {
    expect(resolvePlannableStopCount('09:00', '10:00', 8)).toBe(2);
    expect(resolvePlannableStopCount('09:00', '12:00', 8)).toBe(6);
    expect(resolvePlannableStopCount('09:00', '18:00', 8)).toBe(8);
  });
});
