import { describe, expect, it } from 'vitest';
import { evaluateOutdoorsRelevance } from '../src/providers/outdoorsRelevance';

describe('outdoors relevance', () => {
  it('accepts a valid park result', () => {
    const result = evaluateOutdoorsRelevance({
      name: 'Bear Brook State Park',
      vicinity: 'NH',
      types: ['park', 'point_of_interest'],
    });
    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it('rejects grocery results even if text includes park', () => {
    const result = evaluateOutdoorsRelevance({
      name: 'Stop & Shop near Riverside Park',
      vicinity: 'Main St',
      types: ['grocery_or_supermarket', 'store'],
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain('deny_type_match');
    expect(result.reasons).toContain('deny_keyword_match');
  });
});
