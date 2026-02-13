export type GroupType = 'Date' | 'Family' | 'Friends';
export type TransportType = 'walk' | 'drive';
export type BudgetType = '$' | '$$' | '$$$';
export type StopType = 'coffee' | 'restaurant' | 'bar' | 'dessert' | 'activity' | 'outdoors' | 'shopping' | 'arts' | 'attraction';

export interface PlanPreferences {
  interests: string[];
  avoid: string[];
  mustInclude: string;
  maxTravelMinutes: number;
  kidFriendly: boolean;
  accessibleFriendly: boolean;
}

export interface Plan {
  id: string;
  title: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  groupType: GroupType;
  transport: TransportType;
  budget: BudgetType;
  preferencesJSON: string;
  createdAt: string;
  returnToStart: boolean;
}

export interface Stop {
  id: string;
  planId: string;
  order: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  costLevel: string;
  why: string;
  locked: number;
  openNow?: boolean;
  rating?: number;
  openingHoursText?: string;
  priceLevel?: number;
  distanceKm?: number;
  etaMin?: number;
  stopType?: StopType;
}

export interface ChecklistItem {
  id: string;
  planId: string;
  text: string;
  done: number;
}

export interface CachedPlace {
  providerKey: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  rawJSON: string;
  cachedAt: string;
}

export interface PlaceCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  address: string;
  costLevel?: string;
  openNow?: boolean;
  rating?: number;
  openingHoursText?: string;
  priceLevel?: number;
  tags: string[];
  stopType: StopType;
}

export interface WizardInput {
  city: string;
  startLat?: number;
  startLng?: number;
  stopCount: number;
  date: string;
  startTime: string;
  endTime: string;
  groupType: GroupType;
  adults: number;
  kids: number;
  kidAges: number[];
  transport: TransportType;
  budget: BudgetType;
  preferences: PlanPreferences;
  startLocationMode: 'my-location' | 'custom';
  startAddress: string;
  returnToStart: boolean;
}
