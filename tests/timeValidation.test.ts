import { describe, expect, it } from 'vitest';
import { isEndAfterStart, snapEndTimeAfterStart } from '../src/utils/time';

describe('time validation', () => {
  it('keeps valid end times unchanged', () => {
    expect(isEndAfterStart('09:00', '10:15')).toBe(true);
    expect(snapEndTimeAfterStart('09:00', '10:15')).toBe('10:15');
  });

  it('auto-snaps end time when it is not after start', () => {
    expect(isEndAfterStart('14:30', '14:30')).toBe(false);
    expect(snapEndTimeAfterStart('14:30', '14:30')).toBe('14:45');
    expect(snapEndTimeAfterStart('14:30', '13:45')).toBe('14:45');
  });
});
