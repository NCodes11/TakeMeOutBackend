import { BudgetType } from '@/types/models';

export const budgetToMaxTier = (budget: BudgetType): number => {
  if (budget === '$') return 1;
  if (budget === '$$') return 2;
  return 3;
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

export const tierToBudgetLabel = (tier: number | null | undefined, fallback: BudgetType = '$$'): BudgetType => {
  if (typeof tier !== 'number' || !Number.isFinite(tier)) return fallback;
  if (tier <= 1) return '$';
  if (tier === 2) return '$$';
  return '$$$';
};

export const resolveDisplayPriceTier = (
  priceLevel?: number,
  costLevel?: string,
  fallback: BudgetType = '$$',
): BudgetType => tierToBudgetLabel(resolvePlaceTier(priceLevel, costLevel), fallback);

// Unknown price is allowed but slightly penalized in ranking instead of being excluded.
export const isTierAllowed = (placeTier: number | null, selectedBudget: BudgetType): boolean =>
  placeTier == null || placeTier <= budgetToMaxTier(selectedBudget);

export const budgetScoreAdjustment = (placeTier: number | null, selectedBudget: BudgetType): number => {
  if (placeTier == null) return -1;
  const maxTier = budgetToMaxTier(selectedBudget);
  if (placeTier > maxTier) return -999;
  const diff = maxTier - placeTier;
  return diff === 0 ? 2 : diff === 1 ? 1 : 0;
};
