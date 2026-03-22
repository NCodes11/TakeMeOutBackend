import { describe, expect, it } from 'vitest';
import { resolveDisplayPriceTier } from '../src/utils/priceTier';

describe('resolveDisplayPriceTier', () => {
  it('falls back to the selected budget when provider pricing is unknown', () => {
    expect(resolveDisplayPriceTier(undefined, 'Unknown', '$')).toBe('$');
    expect(resolveDisplayPriceTier(undefined, undefined, '$$')).toBe('$$');
    expect(resolveDisplayPriceTier(undefined, '', '$$$')).toBe('$$$');
  });

  it('preserves known three-tier pricing labels', () => {
    expect(resolveDisplayPriceTier(1, undefined, '$$$')).toBe('$');
    expect(resolveDisplayPriceTier(undefined, '$$', '$')).toBe('$$');
    expect(resolveDisplayPriceTier(3, '$', '$')).toBe('$$$');
  });

  it('clamps higher provider tiers into the app three-tier display', () => {
    expect(resolveDisplayPriceTier(4, undefined, '$')).toBe('$$$');
    expect(resolveDisplayPriceTier(undefined, '$$$$', '$')).toBe('$$$');
  });
});
