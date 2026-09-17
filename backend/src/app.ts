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
  const dbPath =
    config.dbPath ??
    process.env.FEEDBACK_DB_PATH ??
    path.resolve(process.cwd(), 'data/feedback.sqlite');
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
    console.error(`[alerts] Failed to deliver ${eventType} webhook`, error);
    if (nodeEnv === 'production') return;
  };

  app.use(express.json({ limit: '256kb' }));

  if (nodeEnv !== 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
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

  app.get('/health', (_req: Request, res: Response) => {
    console.log('[health] hit');
    res.json({ ok: true });
  });

  app.post('/tripFeedback', requireIngestKey, (req: Request, res: Response) => {
    const parsed = tripFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[tripFeedback] invalid payload', parsed.error.flatten());
      return res.status(400).json({
        ok: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    console.log('[tripFeedback] received payload:', parsed.data);

    const metadata = buildRequestMetadata(req, parsed.data.appVersion);
    insertTripFeedback(db, parsed.data, metadata);

    const tripWebhookUrl = parsed.data.thumbsUp
      ? discordTripFeedbackWebhookUrl ?? fallbackWebhookUrl
      : discordTripDownWebhookUrl ?? discordTripFeedbackWebhookUrl ?? fallbackWebhookUrl;

    console.log('[tripFeedback] thumbsUp:', parsed.data.thumbsUp);
    console.log('[tripFeedback] webhook configured:', Boolean(tripWebhookUrl));

    void sendTripFeedbackAlert({
      webhookUrl: tripWebhookUrl,
      payload: parsed.data,
    })
      .then(() => {
        console.log('[tripFeedback] alert sent successfully');
      })
      .catch((error) => {
        console.error('[tripFeedback] alert send failed', error);
        logAlertFailure('tripFeedback', error);
      });

    return res.status(200).json({ ok: true });
  });

  app.post('/featureRequests', requireIngestKey, (req: Request, res: Response) => {
    const parsed = featureRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[featureRequests] invalid payload', parsed.error.flatten());
      return res.status(400).json({
        ok: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    console.log('[featureRequests] received payload:', parsed.data);

    const metadata = buildRequestMetadata(req, parsed.data.appVersion);
    insertFeatureRequest(db, parsed.data, metadata);

    const featureWebhookUrl = discordFeatureWebhookUrl ?? fallbackWebhookUrl;
    console.log('[featureRequests] webhook configured:', Boolean(featureWebhookUrl));

    void sendFeatureRequestAlert({
      webhookUrl: featureWebhookUrl,
      payload: parsed.data,
    })
      .then(() => {
        console.log('[featureRequests] alert sent successfully');
      })
      .catch((error) => {
        console.error('[featureRequests] alert send failed', error);
        logAlertFailure('featureRequests', error);
      });

    return res.status(200).json({ ok: true });
  });

  return app;
};