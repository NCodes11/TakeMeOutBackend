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
  const sentiment = payload.thumbsUp ? '👍 **Loved it**' : '👎 **Could be better**';
  const location = toLocationLabel(payload.locationCity, payload.locationState);
  const note = truncate(payload.feedbackText, 300);

  return [
    `📍 **Trip Feedback**`,
    '',
    sentiment,
    `**Trip ID:** ${payload.tripId}`,
    `**Location:** ${location}`,
    `**Stops:** ${payload.stopCount}`,
    `**Budget:** ${payload.priceTier}`,
    note ? '' : undefined,
    note ? `📝 **Feedback:**\n${note}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
};

const buildFeatureRequestText = (payload: FeatureRequestIngest) => {
  const category = payload.category?.trim() || 'Uncategorized';
  const note = truncate(payload.message, 260);

  return [
    `💡 **New Feature Request**`,
    '',
    `**Category:** ${category}`,
    `**Message:** ${note}`,
  ].join('\n');
};

const postAlert = async (
  webhookUrl: string,
  text: string,
  eventType: 'tripFeedback' | 'featureRequest',
  payload: Record<string, unknown>,
) => {
  console.log(`[alerts] posting ${eventType} to webhook`);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: text,
      text,
      eventType,
      payload,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const errorBody = truncate(await response.text().catch(() => ''), 500);
    throw new Error(
      `Webhook request failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }

  console.log(`[alerts] ${eventType} webhook delivered successfully`);
};

export const sendTripFeedbackAlert = async ({
  webhookUrl,
  payload,
}: {
  webhookUrl?: string;
  payload: TripFeedbackIngest;
}) => {
  if (!webhookUrl) {
    console.warn('[alerts] No trip feedback webhook configured');
    return;
  }

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
  if (!webhookUrl) {
    console.warn('[alerts] No feature request webhook configured');
    return;
  }

  const text = buildFeatureRequestText(payload);
  await postAlert(webhookUrl, text, 'featureRequest', payload as unknown as Record<string, unknown>);
};