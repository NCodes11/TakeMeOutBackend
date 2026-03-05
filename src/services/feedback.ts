import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { saveFeatureRequest, saveTripFeedback } from '@/db/sqlite';
import { FeatureRequest, FeatureRequestCategory, Plan, Stop, TripFeedback } from '@/types/models';

const parseHostFromUri = (value: string): string | undefined => {
  const raw = value.trim();
  if (!raw) return undefined;

  if (/^(exp|exps|http|https):\/\//i.test(raw)) {
    try {
      return new URL(raw).hostname;
    } catch {
      return undefined;
    }
  }

  const withoutPath = raw.split('/')[0]?.trim();
  const host = withoutPath?.split(':')[0]?.trim();
  return host || undefined;
};

const resolveExpoHost = (): string | undefined => {
  const candidates = [Constants.expoConfig?.hostUri, Constants.linkingUri];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const host = parseHostFromUri(candidate);
    if (host) return host;
  }
  return undefined;
};

const resolveFeedbackBaseUrl = (): string | undefined => {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_FEEDBACK_API_BASE_URL?.trim();
  if (explicitBaseUrl) return explicitBaseUrl;

  // Expo Go convenience fallback: use Metro host with backend default port.
  const expoHost = resolveExpoHost();
  if (!expoHost) return undefined;
  return `http://${expoHost}:4000`;
};

const FEEDBACK_BASE_URL = resolveFeedbackBaseUrl();
const FEEDBACK_API_KEY = process.env.EXPO_PUBLIC_FEEDBACK_API_KEY?.trim();

const resolveDeviceType = (): FeatureRequest['deviceType'] =>
  Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';

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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (FEEDBACK_API_KEY) headers['X-Feedback-Key'] = FEEDBACK_API_KEY;

    const response = await fetch(`${FEEDBACK_BASE_URL.replace(/\/+$/, '')}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`feedback_backend_${response.status}`);
    }
  } catch (error) {
    // Keep UX resilient while still surfacing diagnostics in dev.
    if (__DEV__) {
      console.warn(`[feedback] Failed to sync "${path}" to ${FEEDBACK_BASE_URL}`, error);
    }
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
    appVersion: Constants.expoConfig?.version || 'unknown',
    deviceType: resolveDeviceType(),
    platform: resolveDeviceType(),
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
  const deviceType = resolveDeviceType();
  const entry: FeatureRequest = {
    id: Crypto.randomUUID(),
    message: message.trim(),
    category,
    timestamp: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || 'unknown',
    deviceType,
    platform: deviceType,
  };

  try {
    saveFeatureRequest(entry);
  } catch {
    // Keep submission flow resilient even if storage is temporarily unavailable.
  }
  await postToBackend('featureRequests', entry as Record<string, unknown>);
};
