import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const makeTempDbPath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-backend-test-'));
  return { dir, dbPath: path.join(dir, 'feedback.sqlite') };
};

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const dir of cleanupDirs.splice(0, cleanupDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('feedback backend', () => {
  it('rejects unauthorized ingest requests', async () => {
    const { dir, dbPath } = makeTempDbPath();
    cleanupDirs.push(dir);
    const app = createApp({ dbPath, ingestKey: 'top-secret', nodeEnv: 'test' });

    await request(app)
      .post('/tripFeedback')
      .send({
        id: 'trip-1',
        tripId: 'plan-1',
        thumbsUp: true,
        stopCount: 3,
        priceTier: '$$',
      })
      .expect(401);
  });

  it('stores valid trip feedback and feature requests in SQLite', async () => {
    const { dir, dbPath } = makeTempDbPath();
    cleanupDirs.push(dir);
    const app = createApp({ dbPath, ingestKey: 'top-secret', nodeEnv: 'test' });

    await request(app)
      .post('/tripFeedback')
      .set('X-Feedback-Key', 'top-secret')
      .send({
        id: 'trip-2',
        tripId: 'plan-2',
        timestamp: '2026-03-01T10:00:00.000Z',
        thumbsUp: false,
        feedbackText: 'Too much travel between stops',
        selectedStopTypes: ['coffee', 'outdoors'],
        locationCity: 'Orlando',
        locationState: 'FL',
        stopCount: 4,
        priceTier: '$$',
        appVersion: '1.0.0',
        deviceType: 'ios',
        extraFieldThatShouldBeIgnored: true,
      })
      .expect(200);

    await request(app)
      .post('/featureRequests')
      .set('X-Feedback-Key', 'top-secret')
      .send({
        id: 'feature-1',
        message: 'Add weather-aware trip planning',
        category: 'New Feature',
        appVersion: '1.0.0',
        deviceType: 'android',
      })
      .expect(200);

    const db = new Database(dbPath, { readonly: true });
    const tripCount = db.prepare('SELECT COUNT(*) AS c FROM trip_feedback').get() as { c: number };
    const featureCount = db.prepare('SELECT COUNT(*) AS c FROM feature_requests').get() as { c: number };
    db.close();
    expect(tripCount.c).toBe(1);
    expect(featureCount.c).toBe(1);
  });

  it('routes alerts to discord webhooks by feedback type', async () => {
    const { dir, dbPath } = makeTempDbPath();
    cleanupDirs.push(dir);
    const app = createApp({
      dbPath,
      ingestKey: 'top-secret',
      fallbackWebhookUrl: 'https://alerts.example/fallback',
      discordTripFeedbackWebhookUrl: 'https://alerts.example/trips',
      discordTripDownWebhookUrl: 'https://alerts.example/trip-down',
      discordFeatureWebhookUrl: 'https://alerts.example/features',
      nodeEnv: 'test',
    });

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    await request(app)
      .post('/tripFeedback')
      .set('X-Feedback-Key', 'top-secret')
      .send({
        id: 'trip-no-alert',
        tripId: 'plan-ok',
        thumbsUp: true,
        stopCount: 3,
        priceTier: '$$',
      })
      .expect(200);

    await request(app)
      .post('/tripFeedback')
      .set('X-Feedback-Key', 'top-secret')
      .send({
        id: 'trip-alert',
        tripId: 'plan-bad',
        thumbsUp: false,
        feedbackText: 'Too much travel time.',
        stopCount: 3,
        priceTier: '$$',
      })
      .expect(200);

    await request(app)
      .post('/featureRequests')
      .set('X-Feedback-Key', 'top-secret')
      .send({
        id: 'feature-alert',
        message: 'Please add rainy day mode.',
        category: 'New Feature',
      })
      .expect(200);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://alerts.example/trips',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://alerts.example/trip-down',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      'https://alerts.example/features',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
