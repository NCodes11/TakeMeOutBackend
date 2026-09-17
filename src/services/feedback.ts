import { Linking, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { saveFeatureRequest, saveTripFeedback } from '@/db/sqlite';
import { FeatureRequest, FeatureRequestCategory, Plan, Stop, TripFeedback } from '@/types/models';

const FEEDBACK_URL = 'https://takemeoutapp.com/feedback';

const resolveDeviceType = (): FeatureRequest['deviceType'] =>
  Platform.OS === 'android' ? 'android' : Platform.OS === 'web' ? 'web' : 'ios';

const toCityState = (value: string): { city?: string; state?: string } => {
  const [cityRaw, stateRaw] = value
    .split(',')
    .map((part) => part?.trim())
    .filter(Boolean);

  return { city: cityRaw, state: stateRaw };
};

const parseDistancePreference = (preferencesJSON: string): number | undefined => {
  try {
    const parsed = JSON.parse(preferencesJSON || '{}');
    const maxTravelMinutes = parsed?.maxTravelMinutes;
    if (typeof maxTravelMinutes === 'number' && Number.isFinite(maxTravelMinutes)) {
      return maxTravelMinutes;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const openFeedbackPage = async (type?: 'trip' | 'feature') => {
  const url = type ? `${FEEDBACK_URL}?type=${type}` : FEEDBACK_URL;

  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    throw new Error('feedback_url_not_supported');
  }

  await Linking.openURL(url);
};

export const submitTripFeedback = async ({
  plan,
  stops,
  thumbsUp,
}: {
  plan: Plan;
  stops: Stop[];
  thumbsUp: boolean;
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
    feedbackText: undefined,
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

  // Optional local save
  try {
    saveTripFeedback(entry);
  } catch (error) {
    console.warn('[feedback] unable to persist trip feedback locally', error);
  }

  // 👉 Button action: open link
  await openFeedbackPage('trip');
};

export const submitFeatureRequest = async ({
  message,
  category,
}: {
  message?: string;
  category?: FeatureRequestCategory;
}) => {
  const deviceType = resolveDeviceType();

  const entry: FeatureRequest = {
    id: Crypto.randomUUID(),
    message: message?.trim() || '',
    category,
    timestamp: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version || 'unknown',
    deviceType,
    platform: deviceType,
  };

  // Optional local save
  try {
    saveFeatureRequest(entry);
  } catch (error) {
    console.warn('[feedback] unable to persist feature request locally', error);
  }

  // 👉 Button action: open link
  await openFeedbackPage('feature');
};
