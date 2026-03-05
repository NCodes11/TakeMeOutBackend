import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { sendFeatureRequestAlert, sendTripFeedbackAlert } from './alerts.js';
import {
  createDatabase,
  insertFeatureRequest,
  insertTripFeedback,
} from './db.js';
import {
  featureRequestSchema,
  RequestMetadata,
  tripFeedbackSchema,
} from './types.js';

export interface BackendConfig {
  dbPath?: string;
  ingestKey?: string;
  fallbackWebhookUrl?: string;
  discordTripFeedbackWebhookUrl?: string;
  discordTripDownWebhookUrl?: string;
  discordFeatureWebhookUrl?: string;
  nodeEnv?: string;
}

const buildRequestMetadata = (req: Request, fallbackAppVersion?: string): RequestMetadata => ({
  receivedAt: new Date().toISOString(),
  userAgent: req.header('user-agent') ?? undefined,
  appVersion: fallbackAppVersion ?? req.header('x-app-version') ?? undefined,
  deviceType: req.header('x-device-type') ?? undefined,
  platform: req.header('x-platform') ?? undefined,
});

export const createApp = (config: BackendConfig = {}) => {
  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const dbPath = config.dbPath ?? process.env.FEEDBACK_DB_PATH ?? path.resolve(process.cwd(), 'data/feedback.sqlite');
  const ingestKey = config.ingestKey ?? process.env.FEEDBACK_INGEST_KEY;
  const fallbackWebhookUrl =
    config.fallbackWebhookUrl ??
    process.env.FEEDBACK_ALERT_WEBHOOK_URL;
  const discordTripFeedbackWebhookUrl =
    config.discordTripFeedbackWebhookUrl ??
    process.env.DISCORD_WEBHOOK_TRIP_FEEDBACK;
  const discordTripDownWebhookUrl =
    config.discordTripDownWebhookUrl ??
    process.env.DISCORD_WEBHOOK_TRIP_DOWN;
  const discordFeatureWebhookUrl =
    config.discordFeatureWebhookUrl ??
    process.env.DISCORD_WEBHOOK_FEATURE_REQUESTS;

  const db = createDatabase(dbPath);
  const app = express();
  const logAlertFailure = (eventType: 'tripFeedback' | 'featureRequests', error: unknown) => {
    if (nodeEnv === 'production') return;
    console.error(`[alerts] Failed to deliver ${eventType} webhook`, error);
  };

  app.use(express.json({ limit: '256kb' }));

  if (nodeEnv !== 'production') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        // Dev-only request logging.
        console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  const requireIngestKey = (req: Request, res: Response, next: NextFunction) => {
    if (!ingestKey) return next();
    const key = req.header('x-feedback-key');
    if (!key || key !== ingestKey) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    return next();
  };

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/tripFeedback', requireIngestKey, (req, res) => {
    const parsed = tripFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const metadata = buildRequestMetadata(req, parsed.data.appVersion);
    insertTripFeedback(db, parsed.data, metadata);
    const tripWebhookUrl = parsed.data.thumbsUp
      ? discordTripFeedbackWebhookUrl ?? fallbackWebhookUrl
      : discordTripDownWebhookUrl ?? discordTripFeedbackWebhookUrl ?? fallbackWebhookUrl;
    void sendTripFeedbackAlert({
      webhookUrl: tripWebhookUrl,
      payload: parsed.data,
    }).catch((error) => logAlertFailure('tripFeedback', error));
    return res.status(200).json({ ok: true });
  });

  app.post('/featureRequests', requireIngestKey, (req, res) => {
    const parsed = featureRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const metadata = buildRequestMetadata(req, parsed.data.appVersion);
    insertFeatureRequest(db, parsed.data, metadata);
    void sendFeatureRequestAlert({
      webhookUrl: discordFeatureWebhookUrl ?? fallbackWebhookUrl,
      payload: parsed.data,
    }).catch((error) => logAlertFailure('featureRequests', error));
    return res.status(200).json({ ok: true });
  });

  return app;
};
