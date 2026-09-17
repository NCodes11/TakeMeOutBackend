import { BudgetType } from '@/types/models';

export const budgetToMaxTier = (budget: BudgetType): number => {
  if (budget === '$') return 1;
  if (budget === '$$') return 2;
  return 4;
};

export const priceLevelToTier = (priceLevel?: number): number | null => {
  if (typeof priceLevel !== 'number' || !Number.isFinite(priceLevel)) return null;
  if (priceLevel <= 1) return 1;
  if (priceLevel === 2) return 2;
  if (priceLevel === 3) return 3;
  return 4;
};

export const costLabelToTier = (costLevel?: string): number | null => {
  if (!costLevel) return null;
  const value = costLevel.trim();
  if (value === '$') return 1;
  if (value === '$$') return 2;
  if (value === '$$$') return 3;
  if (value === '$$$$') return 4;
  return null;
};

export const resolvePlaceTier = (priceLevel?: number, costLevel?: string): number | null =>
  priceLevelToTier(priceLevel) ?? costLabelToTier(costLevel);

export const resolveDisplayPriceTier = (
  priceLevel: number | undefined,
  costLevel: string | undefined,
  selectedBudget: BudgetType,
): BudgetType => {
  const tier = resolvePlaceTier(priceLevel, costLevel);
  if (tier == null) return selectedBudget;
  if (tier <= 1) return '$';
  if (tier === 2) return '$$';
  return '$$$';
};

export const isTierAllowed = (placeTier: number | null, selectedBudget: BudgetType): boolean =>
  placeTier == null || placeTier <= budgetToMaxTier(selectedBudget);

/**
 * Softer scoring so plans stay stable:
 * - $ prefers cheap only
 * - $$ prefers moderate, still allows cheap
 * - $$$ prefers expensive/very expensive, still allows moderate
 * - unknown price is allowed with a mild penalty
 */
export const budgetScoreAdjustment = (placeTier: number | null, selectedBudget: BudgetType): number => {
  if (placeTier == null) return -1;

  if (selectedBudget === '$') {
    if (placeTier === 1) return 5;
    return -999;
  }

  if (selectedBudget === '$$') {
    if (placeTier === 2) return 5;
    if (placeTier === 1) return 2;
    return -999;
  }

  if (placeTier === 4) return 6;
  if (placeTier === 3) return 5;
  if (placeTier === 2) return 2;
  return -999;
};
