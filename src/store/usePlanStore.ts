import { create } from 'zustand';
import { initDb, getPlans, getPlanStops, savePlan } from '@/db/sqlite';
import { NominatimOverpassProvider } from '@/providers/placesProvider';
import { OsrmProvider, RouteLeg } from '@/providers/routingProvider';
import { buildFeelingLuckyStopTypes, generateStops, rerollStop as rerollStopService } from '@/services/generator';
import { Plan, Stop, WizardInput } from '@/types/models';
import * as Crypto from 'expo-crypto';
import { logPerf, perfNow } from '@/utils/perf';

interface PlanState {
  plans: Plan[];
  stopsByPlan: Record<string, Stop[]>;
  routeLegsByPlan: Record<string, RouteLeg[]>;
  loading: boolean;
  loadingProgress: number;
  error?: string;
  warning?: string;

  rerollingByPlan: Record<string, Record<number, boolean>>;

  isRerollingStop: (planId: string, stopOrder: number) => boolean;

  boot: () => void;
  loadPlans: () => void;

  createPlan: (input: WizardInput) => Promise<string>;
  reorderStops: (planId: string, from: number, to: number) => void;

  regenerate: (planId: string, input: WizardInput) => Promise<void>;
  rerollStop: (planId: string, input: WizardInput, stopOrder: number) => Promise<void>;
}

const buildOrigin = (inputOrPlan: { startLat?: number; startLng?: number }) => {
  const lat = inputOrPlan.startLat;
  const lng = inputOrPlan.startLng;

  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return undefined;
};

const firstWarning = (warnings: string[] | undefined) => {
  if (!warnings || warnings.length === 0) return undefined;
  return warnings[0];
};

const resolveMaxTravelMinutes = (input: WizardInput) => {
  const value = input?.preferences?.maxTravelMinutes;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 30;
  return Math.max(5, Math.min(120, Math.round(value)));
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

const buildRouteLegs = async (
  routing: OsrmProvider,
  stops: Stop[],
  transport: 'walk' | 'drive',
): Promise<RouteLeg[]> => {
  if (stops.length < 2) return [];
  const coords = stops.map((s) => [s.lat, s.lng] as [number, number]);
  return routing.route(coords, transport);
};

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  stopsByPlan: {},
  routeLegsByPlan: {},
  loading: false,
  loadingProgress: 0,
  error: undefined,
  warning: undefined,
  rerollingByPlan: {},

  isRerollingStop: (planId, stopOrder) => Boolean(get().rerollingByPlan[planId]?.[stopOrder]),

  boot: () => {
    initDb();
    get().loadPlans();
  },

  loadPlans: () => {
    const plans = getPlans();
    const stopsByPlan: Record<string, Stop[]> = {};
    const routeLegsByPlan: Record<string, RouteLeg[]> = {};

    for (const plan of plans) {
      const stops = getPlanStops(plan.id);
      const orderedStops = [...stops].sort((a, b) => a.order - b.order);
      stopsByPlan[plan.id] = orderedStops;
      routeLegsByPlan[plan.id] = [];
    }

    set({ plans, stopsByPlan, routeLegsByPlan });
  },

  createPlan: async (input) => {
    set({ loading: true, loadingProgress: 0.08, error: undefined, warning: undefined });

    try {
      const totalStart = perfNow();
      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const origin = buildOrigin(input);
      const planId = Crypto.randomUUID();

      const maxTravelMinutes = resolveMaxTravelMinutes(input);
      const searchInterests = resolveSearchInterests(input);

      const fetchStart = perfNow();
      const { places, warnings } = await provider.search(input.city, searchInterests, origin, input.stopCount, {
        transport: input.transport,
        maxTravelMinutes,
        stopCount: input.stopCount,
        groupType: input.groupType,
        budget: input.budget,
        mode: 'plan',
        cacheTtlMinutes: 60,
      });
      set({ loadingProgress: 0.42 });
      logPerf('plan_candidate_fetch', fetchStart, {
        city: input.city,
        interests: searchInterests.length,
        candidates: places.length,
      });

      const generationStart = perfNow();
      const stops = await generateStops(planId, input, places, routing);
      set({ loadingProgress: 0.76 });
      logPerf('plan_scoring_generation', generationStart, {
        city: input.city,
        candidates: places.length,
        stops: stops.length,
      });
      const orderedStops = [...stops].sort((a, b) => a.order - b.order);

      const routingStart = perfNow();
      const routeLegs = await buildRouteLegs(routing, orderedStops, input.transport);
      set({ loadingProgress: 0.9 });
      logPerf('plan_final_routing', routingStart, {
        city: input.city,
        legs: routeLegs.length,
      });

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

      savePlan(plan, orderedStops);
      get().loadPlans();

      set((state) => ({
        routeLegsByPlan: {
          ...state.routeLegsByPlan,
          [planId]: routeLegs,
        },
      }));

      const providerWarning = firstWarning(warnings);
      if (providerWarning) {
        set({ warning: providerWarning });
      } else if (orderedStops.length < (input.stopCount || 0)) {
        set({ warning: 'Not enough places found nearby.' });
      }

      logPerf('plan_total_generation', totalStart, {
        city: input.city,
        requestedStops: input.stopCount,
        generatedStops: orderedStops.length,
      });
      set({ loadingProgress: 0.99 });

      return planId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create plan. Please try again.';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  reorderStops: (planId, from, to) => {
    const current = [...(get().stopsByPlan[planId] || [])];
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);

    const reordered = current.map((stop, index) => ({ ...stop, order: index }));

    const plan = get().plans.find((p) => p.id === planId);
    if (plan) savePlan(plan, reordered);

    get().loadPlans();
  },

  regenerate: async (planId, input) => {
    set({ loading: true, loadingProgress: 0.08, error: undefined, warning: undefined });

    try {
      const totalStart = perfNow();
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

      const fetchStart = perfNow();
      const { places, warnings } = await provider.search(plan.city, searchInterests, origin, input.stopCount, {
        transport: input.transport,
        maxTravelMinutes,
        stopCount: input.stopCount,
        groupType: input.groupType,
        budget: input.budget,
        mode: 'plan',
        cacheTtlMinutes: 60,
      });
      set({ loadingProgress: 0.42 });
      logPerf('plan_regenerate_candidate_fetch', fetchStart, {
        city: plan.city,
        interests: searchInterests.length,
        candidates: places.length,
      });

      const generationStart = perfNow();
      let stops = await generateStops(planId, input, places, routing);
      set({ loadingProgress: 0.76 });
      logPerf('plan_regenerate_scoring_generation', generationStart, {
        city: plan.city,
        candidates: places.length,
        stops: stops.length,
      });

      stops = stops.map((stop) => locked.find((lockedStop) => lockedStop.order === stop.order) || stop);

      const orderedStops = [...stops].sort((a, b) => a.order - b.order);
      const routingStart = perfNow();
      const routeLegs = await buildRouteLegs(routing, orderedStops, input.transport);
      set({ loadingProgress: 0.9 });
      logPerf('plan_regenerate_final_routing', routingStart, {
        city: plan.city,
        legs: routeLegs.length,
      });

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

      savePlan(nextPlan, orderedStops);
      get().loadPlans();

      set((state) => ({
        routeLegsByPlan: {
          ...state.routeLegsByPlan,
          [planId]: routeLegs,
        },
      }));

      const providerWarning = firstWarning(warnings);
      if (providerWarning) {
        set({ warning: providerWarning });
      } else if (orderedStops.length < (input.stopCount || 0)) {
        set({ warning: 'Not enough places found nearby.' });
      }

      logPerf('plan_regenerate_total', totalStart, {
        city: plan.city,
        requestedStops: input.stopCount,
        generatedStops: orderedStops.length,
      });
      set({ loadingProgress: 0.99 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to regenerate plan.';
      set({ error: message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

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
      const totalStart = perfNow();
      const existing = get().stopsByPlan[planId] || [];
      const targetIndex = existing.findIndex((stop) => stop.order === stopOrder);
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

      const fetchStart = perfNow();
      const { places, warnings } = await provider.search(plan.city, searchInterests, origin, input.stopCount, {
        transport: input.transport,
        maxTravelMinutes,
        stopCount: input.stopCount,
        groupType: input.groupType,
        budget: input.budget,
        mode: 'reroll',
        cacheTtlMinutes: 10,
        cacheBuster: buster,
      });
      logPerf('plan_reroll_candidate_fetch', fetchStart, {
        city: plan.city,
        stopOrder,
        candidates: places.length,
      });

      const rerollStart = perfNow();
      const updated = await rerollStopService({
        planId,
        input,
        candidates: places,
        routing,
        currentStops: existing,
        stopIndex: targetIndex,
        rerollNonce: Date.now(),
      });
      logPerf('plan_reroll_scoring_generation', rerollStart, {
        city: plan.city,
        stopOrder,
        stops: updated.length,
      });

      const orderedStops = [...updated].sort((a, b) => a.order - b.order);
      const routingStart = perfNow();
      const routeLegs = await buildRouteLegs(routing, orderedStops, input.transport);
      logPerf('plan_reroll_final_routing', routingStart, {
        city: plan.city,
        stopOrder,
        legs: routeLegs.length,
      });

      savePlan(plan, orderedStops);
      get().loadPlans();

      set((state) => ({
        routeLegsByPlan: {
          ...state.routeLegsByPlan,
          [planId]: routeLegs,
        },
      }));

      const providerWarning = firstWarning(warnings);
      if (providerWarning) set({ warning: providerWarning });

      logPerf('plan_reroll_total', totalStart, {
        city: plan.city,
        stopOrder,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reroll stop. Please try again.';
      set({ error: message });
      throw error;
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
