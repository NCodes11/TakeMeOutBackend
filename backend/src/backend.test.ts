import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
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
});

describe('feedback backend', () => {
  it('rejects unauthorized ingest requests', async () => {
    const { dir, dbPath } = makeTempDbPath();
    cleanupDirs.push(dir);
    const app = createApp({ dbPath, ingestKey: 'top-secret', adminToken: 'admin-token', nodeEnv: 'test' });

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

  it('stores valid trip feedback payloads', async () => {
    const { dir, dbPath } = makeTempDbPath();
    cleanupDirs.push(dir);
    const app = createApp({ dbPath, ingestKey: 'top-secret', adminToken: 'admin-token', nodeEnv: 'test' });

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

    const response = await request(app)
      .get('/admin/export/tripFeedback.json')
      .query({ token: 'admin-token' })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('trip-2');
    expect(response.body[0].trip_id).toBe('plan-2');
  });

  it('exports feature requests as CSV', async () => {
    const { dir, dbPath } = makeTempDbPath();
    cleanupDirs.push(dir);
    const app = createApp({ dbPath, ingestKey: 'top-secret', adminToken: 'admin-token', nodeEnv: 'test' });

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

    const response = await request(app)
      .get('/admin/export/featureRequests.csv')
      .query({ token: 'admin-token' })
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('id,message,category');
    expect(response.text).toContain('feature-1');
  });
});
