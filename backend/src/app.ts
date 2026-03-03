import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { renderAdminPage } from './admin.js';
import { toCsv } from './csv.js';
import {
  createDatabase,
  insertFeatureRequest,
  insertTripFeedback,
  listFeatureRequests,
  listTripFeedback,
} from './db.js';
import {
  AdminFilters,
  adminFilterSchema,
  featureRequestSchema,
  RequestMetadata,
  tripFeedbackSchema,
} from './types.js';

export interface BackendConfig {
  dbPath?: string;
  ingestKey?: string;
  adminToken?: string;
  nodeEnv?: string;
}

const normalizeQueryRecord = (query: Request['query']) => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
};

const getAuthBearerToken = (req: Request) => {
  const auth = req.header('authorization');
  if (!auth) return undefined;
  if (!auth.toLowerCase().startsWith('bearer ')) return undefined;
  return auth.slice(7).trim();
};

const buildRequestMetadata = (req: Request, fallbackAppVersion?: string): RequestMetadata => ({
  receivedAt: new Date().toISOString(),
  userAgent: req.header('user-agent') ?? undefined,
  appVersion: fallbackAppVersion ?? req.header('x-app-version') ?? undefined,
  deviceType: req.header('x-device-type') ?? undefined,
  platform: req.header('x-platform') ?? undefined,
});

const parseAdminFilters = (req: Request): AdminFilters =>
  adminFilterSchema.parse(normalizeQueryRecord(req.query));

const toAdminRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    const next = { ...row };
    if (typeof next.selected_stop_types_json === 'string') {
      try {
        next.selected_stop_types_json = JSON.parse(next.selected_stop_types_json as string);
      } catch {}
    }
    return next;
  });

export const createApp = (config: BackendConfig = {}) => {
  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const dbPath = config.dbPath ?? process.env.FEEDBACK_DB_PATH ?? path.resolve(process.cwd(), 'data/feedback.sqlite');
  const ingestKey = config.ingestKey ?? process.env.FEEDBACK_INGEST_KEY;
  const adminToken = config.adminToken ?? process.env.ADMIN_TOKEN;

  const db = createDatabase(dbPath);
  const app = express();

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

  const requireAdminToken = (req: Request, res: Response, next: NextFunction) => {
    if (!adminToken) {
      return res.status(500).send('ADMIN_TOKEN is not configured.');
    }

    const queryToken =
      typeof req.query.token === 'string' && req.query.token.trim().length > 0
        ? req.query.token.trim()
        : undefined;
    const bearerToken = getAuthBearerToken(req);
    const provided = queryToken ?? bearerToken;

    if (!provided || provided !== adminToken) {
      return res.status(401).send('Unauthorized');
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
    return res.status(200).json({ ok: true });
  });

  app.post('/featureRequests', requireIngestKey, (req, res) => {
    const parsed = featureRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const metadata = buildRequestMetadata(req, parsed.data.appVersion);
    insertFeatureRequest(db, parsed.data, metadata);
    return res.status(200).json({ ok: true });
  });

  app.get('/admin', requireAdminToken, (req, res) => {
    const filters = parseAdminFilters(req);
    const tab =
      typeof req.query.tab === 'string' && req.query.tab === 'featureRequests'
        ? 'featureRequests'
        : 'tripFeedback';

    const tripRows = toAdminRows(listTripFeedback(db, filters) as unknown as Record<string, unknown>[]);
    const featureRows = toAdminRows(listFeatureRequests(db, filters) as unknown as Record<string, unknown>[]);
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;

    res.type('html').send(
      renderAdminPage({
        tab,
        filters,
        token: queryToken,
        tripRows,
        featureRows,
      }),
    );
  });

  app.get('/admin/export/tripFeedback.csv', requireAdminToken, (req, res) => {
    const filters = parseAdminFilters(req);
    const rows = toAdminRows(listTripFeedback(db, filters) as unknown as Record<string, unknown>[]);
    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tripFeedback.csv"');
    res.status(200).send(csv);
  });

  app.get('/admin/export/tripFeedback.json', requireAdminToken, (req, res) => {
    const filters = parseAdminFilters(req);
    const rows = toAdminRows(listTripFeedback(db, filters) as unknown as Record<string, unknown>[]);
    res.json(rows);
  });

  app.get('/admin/export/featureRequests.csv', requireAdminToken, (req, res) => {
    const filters = parseAdminFilters(req);
    const rows = toAdminRows(listFeatureRequests(db, filters) as unknown as Record<string, unknown>[]);
    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="featureRequests.csv"');
    res.status(200).send(csv);
  });

  app.get('/admin/export/featureRequests.json', requireAdminToken, (req, res) => {
    const filters = parseAdminFilters(req);
    const rows = toAdminRows(listFeatureRequests(db, filters) as unknown as Record<string, unknown>[]);
    res.json(rows);
  });

  return app;
};
