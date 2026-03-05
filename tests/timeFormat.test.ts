import { describe, expect, it } from 'vitest';
import { formatTimeDisplay, parseTimeDisplayTo24h } from '../src/utils/time';

describe('time display formatting', () => {
  it('keeps canonical time in 24-hour mode', () => {
    expect(formatTimeDisplay('19:30', '24h')).toBe('19:30');
  });

  it('formats canonical time in 12-hour mode', () => {
    expect(formatTimeDisplay('19:30', '12h')).toBe('7:30 PM');
  });

  it('handles edge cases in 12-hour mode', () => {
    expect(formatTimeDisplay('00:00', '12h')).toBe('12:00 AM');
    expect(formatTimeDisplay('12:00', '12h')).toBe('12:00 PM');
    expect(formatTimeDisplay('23:45', '12h')).toBe('11:45 PM');
  });
});

describe('time parsing to canonical 24-hour format', () => {
  it('parses 12-hour display times into HH:MM', () => {
    expect(parseTimeDisplayTo24h('12:00 AM', '12h')).toBe('00:00');
    expect(parseTimeDisplayTo24h('12:00 PM', '12h')).toBe('12:00');
    expect(parseTimeDisplayTo24h('11:45 PM', '12h')).toBe('23:45');
  });

  it('accepts canonical times in 24-hour mode', () => {
    expect(parseTimeDisplayTo24h('07:15', '24h')).toBe('07:15');
    expect(parseTimeDisplayTo24h('7:15', '24h')).toBe('');
  });
});
