import { create } from 'zustand';
import { initDb, getPlans, getPlanStops, savePlan } from '@/db/sqlite';
import { NominatimOverpassProvider } from '@/providers/placesProvider';
import { OsrmProvider } from '@/providers/routingProvider';
import { buildFeelingLuckyStopTypes, generateStops, rerollStop as rerollStopService } from '@/services/generator';
import { Plan, Stop, WizardInput } from '@/types/models';
import * as Crypto from 'expo-crypto';

interface PlanState {
  plans: Plan[];
  stopsByPlan: Record<string, Stop[]>;
  loading: boolean;
  error?: string;
  warning?: string;

  /**
   * Tracks reroll state per plan and per stop order.
   * Structure:
   * { [planId]: { [stopOrder]: boolean } }
   */
  rerollingByPlan: Record<string, Record<number, boolean>>;

  /**
   * Returns true if a specific stop in a plan is currently being rerolled.
   */
  isRerollingStop: (planId: string, stopOrder: number) => boolean;

  boot: () => void;
  loadPlans: () => void;

  createPlan: (input: WizardInput) => Promise<string>;
  reorderStops: (planId: string, from: number, to: number) => void;

  regenerate: (planId: string, input: WizardInput) => Promise<void>;
  rerollStop: (planId: string, input: WizardInput, stopOrder: number) => Promise<void>;
}

/**
 * Extracts an origin coordinate pair if present and valid.
 * Used to keep search results geographically consistent.
 */
const buildOrigin = (inputOrPlan: { startLat?: number; startLng?: number }) => {
  const lat = inputOrPlan.startLat;
  const lng = inputOrPlan.startLng;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return undefined;
};

/**
 * Returns the first provider warning if available.
 */
const firstWarning = (warnings: string[] | undefined) => {
  if (!warnings || warnings.length === 0) return undefined;
  return warnings[0];
};

/**
 * Ensures maxTravelMinutes stays within a safe and usable range.
 */
const resolveMaxTravelMinutes = (input: WizardInput) => {
  const v = input?.preferences?.maxTravelMinutes;
  if (typeof v !== 'number' || !Number.isFinite(v)) return 30;
  return Math.max(5, Math.min(120, Math.round(v)));
};

const serializePreferencesJSON = (input: WizardInput) =>
  JSON.stringify({
    ...input.preferences,
    feelingLucky: input.feelingLucky,
    stopCount: input.stopCount,
    adults: input.adults,
    kids: input.kids,
    kidAges: input.kidAges,
    startLocationMode: input.startLocationMode,
    startAddress: input.startAddress,
  });

const resolveSearchInterests = (input: WizardInput) => {
  if (input.preferences.interests.length > 0) return input.preferences.interests;
  if (!input.feelingLucky) return input.preferences.interests;
  return buildFeelingLuckyStopTypes(input);
};

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  stopsByPlan: {},
  loading: false,
  error: undefined,
  warning: undefined,

  rerollingByPlan: {},

  isRerollingStop: (planId, stopOrder) => Boolean(get().rerollingByPlan[planId]?.[stopOrder]),

  /**
   * Initializes the database and loads saved plans.
   */
  boot: () => {
    initDb();
    get().loadPlans();
  },

  /**
   * Loads all plans and their associated stops from SQLite.
   */
  loadPlans: () => {
    const plans = getPlans();
    const stopsByPlan: Record<string, Stop[]> = {};

    for (const p of plans) {
      stopsByPlan[p.id] = getPlanStops(p.id);
    }

    set({ plans, stopsByPlan });
  },

  /**
   * Creates a brand new plan:
   * - Fetches place candidates
   * - Generates an itinerary
   * - Persists plan + stops to SQLite
   */
  createPlan: async (input) => {
    set({ loading: true, error: undefined, warning: undefined });

    try {
      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const origin = buildOrigin(input);
      const planId = Crypto.randomUUID();

      const maxTravelMinutes = resolveMaxTravelMinutes(input);
      const searchInterests = resolveSearchInterests(input);

      const { places, warnings } = await provider.search(input.city, searchInterests, origin, input.stopCount, {
        transport: input.transport,
        maxTravelMinutes,
        stopCount: input.stopCount,
        mode: 'plan',
        cacheTtlMinutes: 60,
      });

      const stops = await generateStops(planId, input, places, routing);

      const plan: Plan = {
        id: planId,
        title: `${input.city} ${input.groupType} Day`,
        city: input.city,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        groupType: input.groupType,
        transport: input.transport,
        budget: input.budget,
        preferencesJSON: serializePreferencesJSON(input),
        createdAt: new Date().toISOString(),
        returnToStart: input.returnToStart,
        startLat: input.startLat,
        startLng: input.startLng,
      };

      savePlan(plan, stops);
      get().loadPlans();

      const providerWarning = firstWarning(warnings);
      if (providerWarning) {
        set({ warning: providerWarning });
      } else if (stops.length < (input.stopCount || 0)) {
        set({ warning: 'Not enough places found nearby.' });
      }

      return planId;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to create plan. Please try again.';
      set({ error: message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Reorders stops within a plan and persists the new order.
   */
  reorderStops: (planId, from, to) => {
    const current = [...(get().stopsByPlan[planId] || [])];
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);

    const reordered = current.map((s, i) => ({ ...s, order: i }));

    const plan = get().plans.find((p) => p.id === planId);
    if (plan) savePlan(plan, reordered);

    get().loadPlans();
  },

  /**
   * Regenerates an entire plan while keeping locked stops in place.
   */
  regenerate: async (planId, input) => {
    set({ loading: true, error: undefined, warning: undefined });

    try {
      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const plan = get().plans.find((p) => p.id === planId);
      if (!plan) {
        set({ error: 'Plan not found.' });
        return;
      }

      const existing = get().stopsByPlan[planId] || [];
      const locked = existing.filter((s) => s.locked === 1);

      const origin = buildOrigin(plan) || buildOrigin(input);
      const maxTravelMinutes = resolveMaxTravelMinutes(input);
      const searchInterests = resolveSearchInterests(input);

      const { places, warnings } = await provider.search(plan.city, searchInterests, origin, input.stopCount, {
        transport: input.transport,
        maxTravelMinutes,
        stopCount: input.stopCount,
        mode: 'plan',
        cacheTtlMinutes: 60,
      });

      let stops = await generateStops(planId, input, places, routing);

      stops = stops.map((s) => locked.find((l) => l.order === s.order) || s);

      const nextPlan: Plan = {
        ...plan,
        city: input.city || plan.city,
        date: input.date || plan.date,
        startTime: input.startTime || plan.startTime,
        endTime: input.endTime || plan.endTime,
        groupType: input.groupType || plan.groupType,
        transport: input.transport || plan.transport,
        budget: input.budget || plan.budget,
        preferencesJSON: serializePreferencesJSON(input),
        returnToStart: input.returnToStart ?? plan.returnToStart,
        startLat: typeof input.startLat === 'number' ? input.startLat : plan.startLat,
        startLng: typeof input.startLng === 'number' ? input.startLng : plan.startLng,
      };

      savePlan(nextPlan, stops);
      get().loadPlans();

      const providerWarning = firstWarning(warnings);
      if (providerWarning) {
        set({ warning: providerWarning });
      } else if (stops.length < (input.stopCount || 0)) {
        set({ warning: 'Not enough places found nearby.' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to regenerate plan.';
      set({ error: message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Rerolls a single stop.
   * stopOrder refers to the stop's `order` field, not a UI index.
   */
  rerollStop: async (planId, input, stopOrder) => {
    set({ error: undefined, warning: undefined });

    if (get().rerollingByPlan[planId]?.[stopOrder]) return;

    set((state) => ({
      rerollingByPlan: {
        ...state.rerollingByPlan,
        [planId]: {
          ...(state.rerollingByPlan[planId] || {}),
          [stopOrder]: true,
        },
      },
    }));

    try {
      const existing = get().stopsByPlan[planId] || [];
      const targetIndex = existing.findIndex((s) => s.order === stopOrder);
      if (targetIndex < 0) return;

      const target = existing[targetIndex];
      if (target.locked === 1) {
        set({ warning: 'This stop is locked. Unlock it to reroll.' });
        return;
      }

      const plan = get().plans.find((p) => p.id === planId);
      if (!plan) {
        set({ error: 'Plan not found.' });
        return;
      }

      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const origin = buildOrigin(plan) || buildOrigin(input);
      const maxTravelMinutes = resolveMaxTravelMinutes(input);
      const searchInterests = resolveSearchInterests(input);

      const buster = `${planId}:${stopOrder}:${Date.now()}`;

      const { places, warnings } = await provider.search(plan.city, searchInterests, origin, input.stopCount, {
        transport: input.transport,
        maxTravelMinutes,
        stopCount: input.stopCount,
        mode: 'reroll',
        cacheTtlMinutes: 10,
        cacheBuster: buster,
      });

      const updated = await rerollStopService({
        planId,
        input,
        candidates: places,
        routing,
        currentStops: existing,
        stopIndex: targetIndex,
        rerollNonce: Date.now(),
      });

      savePlan(plan, updated);
      get().loadPlans();

      const providerWarning = firstWarning(warnings);
      if (providerWarning) set({ warning: providerWarning });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to reroll stop. Please try again.';
      set({ error: message });
      throw e;
    } finally {
      set((state) => ({
        rerollingByPlan: {
          ...state.rerollingByPlan,
          [planId]: {
            ...(state.rerollingByPlan[planId] || {}),
            [stopOrder]: false,
          },
        },
      }));
    }
  },
}));
