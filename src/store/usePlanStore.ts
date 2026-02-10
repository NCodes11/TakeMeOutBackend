import { create } from 'zustand';
import { initDb, getPlans, getPlanStops, savePlan } from '@/db/sqlite';
import { NominatimOverpassProvider } from '@/providers/placesProvider';
import { OsrmProvider } from '@/providers/routingProvider';
import { generateStops } from '@/services/generator';
import { Plan, Stop, WizardInput } from '@/types/models';
import { v4 as uuid } from 'uuid';

interface PlanState {
  plans: Plan[];
  stopsByPlan: Record<string, Stop[]>;
  loading: boolean;
  error?: string;
  boot: () => void;
  loadPlans: () => void;
  createPlan: (input: WizardInput) => Promise<string>;
  lockStop: (planId: string, stopId: string, locked: boolean) => void;
  reorderStops: (planId: string, from: number, to: number) => void;
  regenerate: (planId: string, input: WizardInput) => Promise<void>;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  stopsByPlan: {},
  loading: false,
  boot: () => {
    initDb();
    get().loadPlans();
  },
  loadPlans: () => {
    const plans = getPlans();
    const stopsByPlan: Record<string, Stop[]> = {};
    for (const p of plans) stopsByPlan[p.id] = getPlanStops(p.id);
    set({ plans, stopsByPlan });
  },
  createPlan: async (input) => {
    set({ loading: true, error: undefined });
    try {
      const provider = new NominatimOverpassProvider();
      const routing = new OsrmProvider();
      const planId = uuid();
      const candidates = await provider.search(input.city, input.preferences.interests);
      const stops = await generateStops(planId, input, candidates, routing);
      const plan: Plan = {
        id: planId,
        title: `${input.city} ${input.groupType} Day`,
        city: input.city,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        groupType: input.groupType,
        transport: input.transport,
        pace: input.pace,
        budget: input.budget,
        preferencesJSON: JSON.stringify(input.preferences),
        createdAt: new Date().toISOString(),
        returnToStart: input.returnToStart,
      };
      savePlan(plan, stops);
      get().loadPlans();
      return planId;
    } catch (e) {
      set({ error: 'Unable to create plan. Please try again.' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
  lockStop: (planId, stopId, locked) => {
    const stops = (get().stopsByPlan[planId] || []).map((s) => (s.id === stopId ? { ...s, locked: locked ? 1 : 0 } : s));
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
    const provider = new NominatimOverpassProvider();
    const routing = new OsrmProvider();
    const existing = get().stopsByPlan[planId] || [];
    const locked = existing.filter((s) => s.locked === 1);
    const candidates = await provider.search(input.city, input.preferences.interests);
    let stops = await generateStops(planId, input, candidates, routing);
    stops = stops.map((s) => locked.find((l) => l.order === s.order) || s);
    const plan = get().plans.find((p) => p.id === planId);
    if (plan) savePlan(plan, stops);
    get().loadPlans();
  },
}));
