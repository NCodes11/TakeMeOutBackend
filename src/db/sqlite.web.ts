import { ChecklistItem, FeatureRequest, Plan, Stop, TripFeedback } from '@/types/models';

type CachedPlaceRow = {
  providerKey: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  rawJSON: string;
  cachedAt: string;
};

const plans = new Map<string, Plan>();
const stopsByPlan = new Map<string, Stop[]>();
const checklistByPlan = new Map<string, ChecklistItem[]>();
const tripFeedback = new Map<string, TripFeedback>();
const featureRequests = new Map<string, FeatureRequest>();
let cachedPlaces: CachedPlaceRow[] = [];

const sortByCreated = (a: Plan, b: Plan) => b.createdAt.localeCompare(a.createdAt);
const sortByTimestamp = <T extends { timestamp: string }>(a: T, b: T) =>
  b.timestamp.localeCompare(a.timestamp);

export const initDb = () => undefined;

export const savePlan = (plan: Plan, stops: Stop[]) => {
  plans.set(plan.id, plan);
  stopsByPlan.set(
    plan.id,
    [...stops].sort((a, b) => a.order - b.order),
  );
};

export const getPlans = (): Plan[] => [...plans.values()].sort(sortByCreated);

export const getPlanStops = (planId: string): Stop[] => [...(stopsByPlan.get(planId) ?? [])];

export const saveChecklist = (items: ChecklistItem[]) => {
  const grouped = new Map<string, ChecklistItem[]>();

  for (const item of items) {
    const next = grouped.get(item.planId) ?? [];
    next.push(item);
    grouped.set(item.planId, next);
  }

  for (const [planId, next] of grouped) {
    checklistByPlan.set(planId, next);
  }
};

export const getChecklist = (planId: string): ChecklistItem[] => [
  ...(checklistByPlan.get(planId) ?? []),
];

export const saveTripFeedback = (entry: TripFeedback) => {
  tripFeedback.set(entry.id, entry);
};

export const saveFeatureRequest = (entry: FeatureRequest) => {
  featureRequests.set(entry.id, entry);
};

export const getTripFeedback = (): TripFeedback[] =>
  [...tripFeedback.values()].sort(sortByTimestamp);

export const getFeatureRequests = (): FeatureRequest[] =>
  [...featureRequests.values()].sort(sortByTimestamp);

export const cachePlaces = (
  rows: {
    providerKey: string;
    name: string;
    lat: number;
    lng: number;
    category: string;
    rawJSON: string;
  }[],
) => {
  const cachedAt = new Date().toISOString();
  cachedPlaces.push(...rows.map((row) => ({ ...row, cachedAt })));
};

export const clearCachedPlaces = (providerKey?: string) => {
  cachedPlaces = providerKey
    ? cachedPlaces.filter((row) => row.providerKey !== providerKey)
    : [];
};

export const getCachedPlaces = (
  providerKey: string,
  maxAgeHours = 12,
  bypass = false,
): CachedPlaceRow[] => {
  if (bypass) return [];
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  return cachedPlaces
    .filter((row) => row.providerKey === providerKey && row.cachedAt > cutoff)
    .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))
    .slice(0, 120);
};
