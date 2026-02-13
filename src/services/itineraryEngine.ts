import { PlaceCandidate, StopType, TransportType, WizardInput } from '@/types/models';

interface StopTypeRule {
  maxDefault: number;
  repeatWeight: number;
  importance: number;
}

const TYPE_RULES: Record<StopType, StopTypeRule> = {
  coffee: { maxDefault: 1, repeatWeight: 1, importance: 2 },
  restaurant: { maxDefault: 1, repeatWeight: 2, importance: 6 },
  bar: { maxDefault: 1, repeatWeight: 2, importance: 1 },
  dessert: { maxDefault: 1, repeatWeight: 2, importance: 3 },
  activity: { maxDefault: 1, repeatWeight: 4, importance: 5 },
  attraction: { maxDefault: 1, repeatWeight: 4, importance: 5 },
  outdoors: { maxDefault: 1, repeatWeight: 3, importance: 5 },
  shopping: { maxDefault: Number.POSITIVE_INFINITY, repeatWeight: 5, importance: 4 },
  arts: { maxDefault: 1, repeatWeight: 4, importance: 5 },
};

const NO_REPEAT_ADJACENT = new Set<StopType>(['coffee', 'restaurant', 'bar', 'outdoors', 'arts', 'dessert', 'activity', 'attraction']);
const CHAIN_NAMES = ['dunkin', 'starbucks', 'mcdonald', 'burger king', 'subway', 'chipotle', 'taco bell'];

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const estimatedSpeedKmh = (transport: TransportType) => (transport === 'walk' ? 4.5 : 35);

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const deterministicIndex = (seed: string, size: number) => {
  if (size <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % size;
};

const budgetPenalty = (candidateBudget: string | undefined, targetBudget: string) => {
  if (!candidateBudget || candidateBudget === 'Unknown') return 0;
  const rank = (value: string) => (value === '$' ? 1 : value === '$$' ? 2 : value === '$$$' ? 3 : 2);
  const diff = Math.abs(rank(candidateBudget) - rank(targetBudget));
  if (diff === 0) return 2;
  if (diff === 1) return 0;
  return -2;
};

const detectChain = (name: string) => {
  const normalized = name.toLowerCase();
  const known = CHAIN_NAMES.find((chain) => normalized.includes(chain));
  if (known) return known;
  const first = normalized.split(/\s+/)[0];
  return first || normalized;
};

export const buildStopAllocation = (selectedTypes: StopType[], numberOfStops: number): StopType[] => {
  const uniqueTypes = Array.from(new Set(selectedTypes));
  const target = Math.max(1, numberOfStops);
  if (uniqueTypes.length === 0) return [];
  if (uniqueTypes.length === 1) return Array.from({ length: target }, () => uniqueTypes[0]);

  const sortedByImportance = [...uniqueTypes].sort((a, b) => TYPE_RULES[b].importance - TYPE_RULES[a].importance);
  const selected = target < uniqueTypes.length ? sortedByImportance.slice(0, target) : sortedByImportance;
  const counts = new Map<StopType, number>(selected.map((type) => [type, 1]));
  const allocation = [...selected];

  while (allocation.length < target) {
    const expandable = selected
      .filter((type) => (counts.get(type) || 0) < TYPE_RULES[type].maxDefault)
      .sort((a, b) => TYPE_RULES[b].repeatWeight - TYPE_RULES[a].repeatWeight);
    if (expandable.length === 0) break;
    const next = expandable[0];
    allocation.push(next);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  while (allocation.length < target) {
    const sortedByRepeat = [...selected].sort((a, b) => TYPE_RULES[b].repeatWeight - TYPE_RULES[a].repeatWeight);
    const next = sortedByRepeat[0];
    allocation.push(next);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  return allocation.slice(0, target);
};

export const orderAllocation = (allocationTokens: StopType[], startTime: string, endTime: string): StopType[] => {
  const tokens = [...allocationTokens];
  if (tokens.length <= 1) return tokens;

  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  const startsLate = start >= 12 * 60;
  const total = Math.max(1, end - start);

  const preferredPosition = (type: StopType) => {
    if (type === 'coffee') return 0;
    if (type === 'bar') return total - 1;
    if (type === 'restaurant') return Math.floor(total * 0.5);
    if (type === 'shopping') return Math.floor(total * 0.45);
    if (type === 'outdoors') return startsLate ? Math.floor(total * 0.75) : Math.floor(total * 0.35);
    if (type === 'attraction') return Math.floor(total * 0.55);
    if (type === 'activity' || type === 'arts') return Math.floor(total * 0.6);
    return Math.floor(total * 0.55);
  };

  const ordered = tokens
    .map((type, index) => ({ type, index, pref: preferredPosition(type) }))
    .sort((a, b) => a.pref - b.pref || a.index - b.index)
    .map((item) => item.type);

  return enforceCapsAndAdjacency(ordered);
};

export const enforceCapsAndAdjacency = (tokens: StopType[]): StopType[] => {
  if (tokens.length <= 1) return tokens;
  const unique = new Set(tokens);
  if (unique.size <= 1) return tokens;

  const output = [...tokens];
  for (let i = 1; i < output.length; i += 1) {
    const current = output[i];
    const prev = output[i - 1];
    if (current !== prev) continue;
    if (!NO_REPEAT_ADJACENT.has(current)) continue;

    let swapIndex = -1;
    for (let j = i + 1; j < output.length; j += 1) {
      if (output[j] !== current && output[j] !== prev) {
        swapIndex = j;
        break;
      }
      if (output[j] !== current) {
        swapIndex = j;
        break;
      }
    }
    if (swapIndex > -1) {
      const temp = output[i];
      output[i] = output[swapIndex];
      output[swapIndex] = temp;
    }
  }
  return output;
};

interface SelectionContext {
  token: StopType;
  tokenIndex: number;
  seed: string;
  candidates: PlaceCandidate[];
  selected: PlaceCandidate[];
  input: WizardInput;
}

export const selectPlaceForToken = ({
  token,
  tokenIndex,
  seed,
  candidates,
  selected,
  input,
}: SelectionContext): PlaceCandidate | null => {
  if (candidates.length === 0) return null;
  const prev = selected[selected.length - 1];
  const maxTravel = Math.max(5, input.preferences.maxTravelMinutes || 30);
  const usedChains = new Set(selected.filter((s) => s.stopType !== 'shopping').map((s) => detectChain(s.name)));
  const chosenTypeCount = selected.filter((s) => s.stopType === token).length;
  const onlyOneType = new Set(input.preferences.interests).size <= 1;
  const coffeeAlreadyUsed = selected.some((item) => item.stopType === 'coffee');

  const ranked = candidates
    .map((candidate) => {
      const name = candidate.name.toLowerCase();
      const address = candidate.address.toLowerCase();
      if (input.preferences.avoid.some((deny) => name.includes(deny.toLowerCase()) || address.includes(deny.toLowerCase()))) {
        return { candidate, score: -999 };
      }
      if (!onlyOneType && candidate.stopType === 'coffee' && coffeeAlreadyUsed) {
        return { candidate, score: -999 };
      }
      let score = 10;
      score += candidate.stopType === token ? 8 : -6;
      score += (candidate.rating || 0) * 1.5;
      score += budgetPenalty(candidate.costLevel, input.budget);
      if (candidate.openNow) score += 2;
      if (input.preferences.mustInclude && (name.includes(input.preferences.mustInclude.toLowerCase()) || address.includes(input.preferences.mustInclude.toLowerCase()))) {
        score += 4;
      }

      const chain = detectChain(candidate.name);
      if (!onlyOneType && token !== 'shopping' && usedChains.has(chain)) score -= 3;

      if (prev) {
        const dist = haversineKm(prev.lat, prev.lng, candidate.lat, candidate.lng);
        const eta = (dist / estimatedSpeedKmh(input.transport)) * 60;
        if (eta > maxTravel) return { candidate, score: -999 };
        score += Math.max(0, 3 - eta / 10);
      }

      if (!onlyOneType && chosenTypeCount >= 1 && NO_REPEAT_ADJACENT.has(token)) score -= 2;
      return { candidate, score };
    })
    .filter((entry) => entry.score > -900)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const pickIndex = deterministicIndex(`${seed}-${token}-${tokenIndex}`, top.length);
  return top[pickIndex].candidate;
};
