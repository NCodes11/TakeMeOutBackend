import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { saveFeatureRequest, saveTripFeedback } from '@/db/sqlite';
import { FeatureRequest, FeatureRequestCategory, Plan, Stop, TripFeedback } from '@/types/models';

const FEEDBACK_BASE_URL = process.env.EXPO_PUBLIC_FEEDBACK_API_BASE_URL?.trim();

const toCityState = (value: string): { city?: string; state?: string } => {
  const [cityRaw, stateRaw] = value.split(',').map((part) => part?.trim()).filter(Boolean);
  return { city: cityRaw, state: stateRaw };
};

const parseDistancePreference = (preferencesJSON: string): number | undefined => {
  try {
    const parsed = JSON.parse(preferencesJSON || '{}');
    const maxTravelMinutes = parsed?.maxTravelMinutes;
    if (typeof maxTravelMinutes === 'number' && Number.isFinite(maxTravelMinutes)) return maxTravelMinutes;
  } catch {
    return undefined;
  }
  return undefined;
};

const postToBackend = async (path: string, payload: Record<string, unknown>) => {
  // Optional remote sync; local persistence is the source of truth for beta collection.
  if (!FEEDBACK_BASE_URL) return;
  try {
    await fetch(`${FEEDBACK_BASE_URL.replace(/\/+$/, '')}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fail silently for beta feedback collection.
  }
};

export const submitTripFeedback = async ({
  plan,
  stops,
  thumbsUp,
  feedbackText,
}: {
  plan: Plan;
  stops: Stop[];
  thumbsUp: boolean;
  feedbackText?: string;
}) => {
  const id = Crypto.randomUUID();
  const { city, state } = toCityState(plan.city);
  const selectedStopTypes = Array.from(
    new Set(
      stops
        .map((stop) => (stop.stopType || stop.category || '').trim())
        .filter(Boolean),
    ),
  );
  const entry: TripFeedback = {
    id,
    tripId: plan.id,
    timestamp: new Date().toISOString(),
    thumbsUp,
    feedbackText: feedbackText?.trim() || undefined,
    selectedStopTypes,
    locationCity: city,
    locationState: state,
    stopCount: stops.length,
    priceTier: plan.budget,
    distancePreference: parseDistancePreference(plan.preferencesJSON),
  };

  try {
    saveTripFeedback(entry);
  } catch {
    // Local write failures should never break trip completion UX.
  }
  await postToBackend('tripFeedback', entry as Record<string, unknown>);
};

export const submitFeatureRequest = async ({
  message,
  category,
}: {
  message: string;
  category?: FeatureRequestCategory;
}) => {
  const deviceType: FeatureRequest['deviceType'] =
    Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';
  const entry: FeatureRequest = {
    id: Crypto.randomUUID(),
    message: message.trim(),
    category,
    timestamp: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || 'unknown',
    deviceType,
  };

  try {
    saveFeatureRequest(entry);
  } catch {
    // Keep submission flow resilient even if storage is temporarily unavailable.
  }
  await postToBackend('featureRequests', entry as Record<string, unknown>);
};
