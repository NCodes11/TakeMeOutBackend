import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { FeatureRequestIngest, RequestMetadata, TripFeedbackIngest } from './types.js';

export const createDatabase = (dbPath: string) => {
  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  runMigrations(db);
  return db;
};

const runMigrations = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trip_feedback (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      event_timestamp TEXT NOT NULL,
      thumbs_up INTEGER NOT NULL,
      feedback_text TEXT,
      selected_stop_types_json TEXT NOT NULL,
      location_city TEXT,
      location_state TEXT,
      stop_count INTEGER NOT NULL,
      price_tier TEXT NOT NULL,
      distance_preference REAL,
      received_at TEXT NOT NULL,
      user_agent TEXT,
      app_version TEXT,
      device_type TEXT,
      platform TEXT
    );

    CREATE TABLE IF NOT EXISTS feature_requests (
      id TEXT PRIMARY KEY NOT NULL,
      message TEXT NOT NULL,
      category TEXT,
      event_timestamp TEXT NOT NULL,
      app_version TEXT,
      device_type TEXT,
      platform TEXT,
      location_city TEXT,
      location_state TEXT,
      received_at TEXT NOT NULL,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trip_feedback_received_at ON trip_feedback(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trip_feedback_thumbs_up ON trip_feedback(thumbs_up);
    CREATE INDEX IF NOT EXISTS idx_trip_feedback_city_state ON trip_feedback(location_city, location_state);
    CREATE INDEX IF NOT EXISTS idx_feature_requests_received_at ON feature_requests(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feature_requests_category ON feature_requests(category);
  `);
};

export const insertTripFeedback = (
  db: Database.Database,
  payload: TripFeedbackIngest,
  metadata: RequestMetadata,
) => {
  db.prepare(
    `INSERT OR REPLACE INTO trip_feedback (
      id, trip_id, event_timestamp, thumbs_up, feedback_text, selected_stop_types_json,
      location_city, location_state, stop_count, price_tier, distance_preference,
      received_at, user_agent, app_version, device_type, platform
    ) VALUES (
      @id, @trip_id, @event_timestamp, @thumbs_up, @feedback_text, @selected_stop_types_json,
      @location_city, @location_state, @stop_count, @price_tier, @distance_preference,
      @received_at, @user_agent, @app_version, @device_type, @platform
    )`,
  ).run({
    id: payload.id,
    trip_id: payload.tripId,
    event_timestamp: payload.timestamp ?? metadata.receivedAt,
    thumbs_up: payload.thumbsUp ? 1 : 0,
    feedback_text: payload.feedbackText ?? null,
    selected_stop_types_json: JSON.stringify(payload.selectedStopTypes ?? []),
    location_city: payload.locationCity ?? null,
    location_state: payload.locationState ?? null,
    stop_count: payload.stopCount,
    price_tier: payload.priceTier,
    distance_preference:
      typeof payload.distancePreference === 'number' ? payload.distancePreference : null,
    received_at: metadata.receivedAt,
    user_agent: metadata.userAgent ?? null,
    app_version: payload.appVersion ?? metadata.appVersion ?? null,
    device_type: payload.deviceType ?? metadata.deviceType ?? null,
    platform: payload.platform ?? metadata.platform ?? payload.deviceType ?? null,
  });
};

export const insertFeatureRequest = (
  db: Database.Database,
  payload: FeatureRequestIngest,
  metadata: RequestMetadata,
) => {
  db.prepare(
    `INSERT OR REPLACE INTO feature_requests (
      id, message, category, event_timestamp, app_version, device_type, platform,
      location_city, location_state, received_at, user_agent
    ) VALUES (
      @id, @message, @category, @event_timestamp, @app_version, @device_type, @platform,
      @location_city, @location_state, @received_at, @user_agent
    )`,
  ).run({
    id: payload.id,
    message: payload.message,
    category: payload.category ?? null,
    event_timestamp: payload.timestamp ?? metadata.receivedAt,
    app_version: payload.appVersion ?? metadata.appVersion ?? null,
    device_type: payload.deviceType ?? metadata.deviceType ?? null,
    platform: payload.platform ?? metadata.platform ?? payload.deviceType ?? null,
    location_city: payload.locationCity ?? null,
    location_state: payload.locationState ?? null,
    received_at: metadata.receivedAt,
    user_agent: metadata.userAgent ?? null,
  });
};
