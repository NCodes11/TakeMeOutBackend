import { create } from 'zustand';
import { initDb, getPlans, getPlanStops, savePlan } from '@/db/sqlite';
import { NominatimOverpassProvider } from '@/providers/placesProvider';
import { OsrmProvider } from '@/providers/routingProvider';
import { generateStops, rerollStop as rerollStopService } from '@/services/generator';
import { Plan, Stop, WizardInput } from '@/types/models';
import * as Crypto from 'expo-crypto';

interface PlanState {
  plans: Plan[];
  stopsByPlan: Record<string, Stop[]>;
  loading: boolean;
  error?: string;
  warning?: string;

  boot: () => void;
  loadPlans: () => void;

  createPlan: (input: WizardInput) => Promise<string>;
  lockStop: (planId: string, stopId: string, locked: boolean) => void;
  reorderStops: (planId: string, from: number, to: number) => void;

  regenerate: (planId: string, input: WizardInput) => Promise<void>;
  rerollStop: (planId: string, input: WizardInput, stopIndex: number) => Promise<void>;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  stopsByPlan: {},
  loading: false,
  warning: undefined,

  boot: () => {
    initDb();
    get().loadPlans();
  },

  loadPlans: () => {
    const plans = getPlans();
    const stopsByPlan: Record<string, Stop[]> = {};
    for (const p of plans) {
      stopsByPlan[p.id] = getPlanStops(p.id);
    }
    set({ plans, stopsByPlan });
  },

  createPlan: async (input) => {
    set({ loading: true, error: undefined, warning: undefined });

    try {
      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const origin =
        input.startLat != null && input.startLng != null
          ? { lat: input.startLat, lng: input.startLng }
          : undefined;

      const planId = Crypto.randomUUID();

      const { places, warnings } = await provider.search(
        input.city,
        input.preferences.interests,
        origin,
        input.stopCount,
        {
          transport: input.transport,
          maxTravelMinutes: input.preferences.maxTravelMinutes,
          stopCount: input.stopCount,
          mode: 'plan',
          cacheTtlMinutes: 60,
        },
      );

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
        preferencesJSON: JSON.stringify(input.preferences),
        createdAt: new Date().toISOString(),
        returnToStart: input.returnToStart,
        startLat: input.startLat,
        startLng: input.startLng,
      };

      savePlan(plan, stops);
      get().loadPlans();

      if (warnings.length > 0 || stops.length < input.stopCount) {
        set({ warning: warnings[0] || 'Not enough places found nearby.' });
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

  lockStop: (planId, stopId, locked) => {
    const stops = (get().stopsByPlan[planId] || []).map((s) =>
      s.id === stopId ? { ...s, locked: locked ? 1 : 0 } : s,
    );

    const plan = get().plans.find((p) => p.id === planId);
    if (plan) savePlan(plan, stops);

    get().loadPlans();
  },

  reorderStops: (planId, from, to) => {
    const current = [...(get().stopsByPlan[planId] || [])];
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);

    const reordered = current.map((s, i) => ({ ...s, order: i }));

    const plan = get().plans.find((p) => p.id === planId);
    if (plan) savePlan(plan, reordered);

    get().loadPlans();
  },

  regenerate: async (planId, input) => {
    set({ loading: true, error: undefined, warning: undefined });

    try {
      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const existing = get().stopsByPlan[planId] || [];
      const locked = existing.filter((s) => s.locked === 1);

      const origin =
        input.startLat != null && input.startLng != null
          ? { lat: input.startLat, lng: input.startLng }
          : undefined;

      const { places, warnings } = await provider.search(
        input.city,
        input.preferences.interests,
        origin,
        input.stopCount,
        {
          transport: input.transport,
          maxTravelMinutes: input.preferences.maxTravelMinutes,
          stopCount: input.stopCount,
          mode: 'plan',
          cacheTtlMinutes: 60,
        },
      );

      let stops = await generateStops(planId, input, places, routing);

      // Preserve locked stops in their original positions.
      stops = stops.map((s) => locked.find((l) => l.order === s.order) || s);

      const plan = get().plans.find((p) => p.id === planId);
      if (plan) savePlan(plan, stops);

      if (warnings.length > 0 || stops.length < input.stopCount) {
        set({ warning: warnings[0] || 'Not enough places found nearby.' });
      }

      get().loadPlans();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to regenerate plan.';
      set({ error: message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  rerollStop: async (planId, input, stopIndex) => {
    set({ loading: true, error: undefined, warning: undefined });

    try {
      const existing = get().stopsByPlan[planId] || [];
      const target = existing[stopIndex];
      if (!target) return;

      if (target.locked === 1) {
        set({ warning: 'This stop is locked. Unlock it to reroll.' });
        return;
      }

      const plan = get().plans.find((p) => p.id === planId);
      if (!plan) return;

      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();

      const origin =
        plan.startLat != null && plan.startLng != null
          ? { lat: plan.startLat, lng: plan.startLng }
          : undefined;

      const { places, warnings } = await provider.search(
        plan.city,
        input.preferences.interests,
        origin,
        input.stopCount,
        {
          transport: input.transport,
          maxTravelMinutes: input.preferences.maxTravelMinutes,
          stopCount: input.stopCount,
          mode: 'reroll',
          cacheTtlMinutes: 10,
          cacheBuster: `${planId}-${stopIndex}-${Date.now()}`,
        },
      );

      const updated = await rerollStopService({
        planId,
        input,
        candidates: places,
        routing,
        currentStops: existing,
        stopIndex,
        rerollNonce: Date.now(),
      });

      savePlan(plan, updated);

      if (warnings.length > 0) {
        set({ warning: warnings[0] });
      }

      get().loadPlans();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to reroll stop. Please try again.';
      set({ error: message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));
