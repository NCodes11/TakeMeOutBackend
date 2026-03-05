import { FeatureRequestIngest, TripFeedbackIngest } from './types.js';

const truncate = (value: string | undefined, max = 280) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
};

const toLocationLabel = (city?: string, state?: string) => {
  if (city && state) return `${city}, ${state}`;
  return city || state || 'Unknown location';
};

const buildTripFeedbackText = (payload: TripFeedbackIngest) => {
  const sentiment = payload.thumbsUp ? '👍 Positive trip feedback' : '👎 Negative trip feedback';
  const location = toLocationLabel(payload.locationCity, payload.locationState);
  const note = truncate(payload.feedbackText, 220);
  return [
    sentiment,
    `Trip: ${payload.tripId}`,
    `Location: ${location}`,
    `Stops: ${payload.stopCount}`,
    `Budget: ${payload.priceTier}`,
    note ? `Note: ${note}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
};

const buildFeatureRequestText = (payload: FeatureRequestIngest) => {
  const category = payload.category?.trim() || 'Uncategorized';
  const note = truncate(payload.message, 260);
  return [`💡 New feature request`, `Category: ${category}`, `Message: ${note}`].join('\n');
};

const postAlert = async (
  webhookUrl: string,
  text: string,
  eventType: 'tripFeedback' | 'featureRequest',
  payload: Record<string, unknown>,
) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // `text` works for Slack; `content` works for Discord.
    body: JSON.stringify({
      text,
      content: text,
      eventType,
      payload,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorBody = truncate(await response.text().catch(() => ''), 180);
    throw new Error(
      `Webhook request failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }
};

export const sendTripFeedbackAlert = async ({
  webhookUrl,
  payload,
}: {
  webhookUrl?: string;
  payload: TripFeedbackIngest;
}) => {
  if (!webhookUrl) return;
  const text = buildTripFeedbackText(payload);
  await postAlert(webhookUrl, text, 'tripFeedback', payload as unknown as Record<string, unknown>);
};

export const sendFeatureRequestAlert = async ({
  webhookUrl,
  payload,
}: {
  webhookUrl?: string;
  payload: FeatureRequestIngest;
}) => {
  if (!webhookUrl) return;
  const text = buildFeatureRequestText(payload);
  await postAlert(webhookUrl, text, 'featureRequest', payload as unknown as Record<string, unknown>);
};
