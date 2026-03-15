import { describe, expect, it } from 'vitest';
import { evaluateCategoryCandidate } from '../src/providers/categoryPolicy';

describe('category policy', () => {
  it('rejects Walmart-like result for outdoors', () => {
    const result = evaluateCategoryCandidate('outdoors', {
      name: 'Walmart Supercenter',
      address: 'Kissimmee, FL',
      types: ['department_store', 'grocery_or_supermarket', 'store'],
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain('deny_type_match');
    expect(result.reasons).toContain('deny_keyword_match');
  });

  it('accepts park-style result for outdoors', () => {
    const result = evaluateCategoryCandidate('outdoors', {
      name: 'Shingle Creek Regional Park',
      address: 'Kissimmee, FL',
      types: ['park', 'tourist_attraction'],
    });
    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it('rejects nature-style result for shopping', () => {
    const result = evaluateCategoryCandidate('shopping', {
      name: 'Lakefront Nature Preserve',
      address: 'Kissimmee, FL',
      types: ['park', 'natural_feature'],
    });
    expect(result.accepted).toBe(false);
  });

  it('accepts landmark-style result for attractions', () => {
    const result = evaluateCategoryCandidate('attraction', {
      name: 'Riverfront Observation Deck',
      address: 'Orlando, FL',
      types: ['tourist_attraction', 'point_of_interest'],
    });
    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });
});
