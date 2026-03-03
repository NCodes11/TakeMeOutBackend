import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { AdminFilters, FeatureRequestIngest, RequestMetadata, TripFeedbackIngest } from './types.js';

export interface TripFeedbackRow {
  id: string;
  trip_id: string;
  event_timestamp: string;
  thumbs_up: number;
  feedback_text: string | null;
  selected_stop_types_json: string;
  location_city: string | null;
  location_state: string | null;
  stop_count: number;
  price_tier: string;
  distance_preference: number | null;
  received_at: string;
  user_agent: string | null;
  app_version: string | null;
  device_type: string | null;
  platform: string | null;
}

export interface FeatureRequestRow {
  id: string;
  message: string;
  category: string | null;
  event_timestamp: string;
  app_version: string | null;
  device_type: string | null;
  platform: string | null;
  location_city: string | null;
  location_state: string | null;
  received_at: string;
  user_agent: string | null;
}

const toDayStartIso = (date: string) => new Date(`${date}T00:00:00.000Z`).toISOString();
const toDayEndIso = (date: string) => new Date(`${date}T23:59:59.999Z`).toISOString();

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

const addDateFilters = (filters: AdminFilters, where: string[], params: Record<string, unknown>) => {
  if (filters.startDate) {
    where.push('received_at >= @startDate');
    params.startDate = toDayStartIso(filters.startDate);
  }
  if (filters.endDate) {
    where.push('received_at <= @endDate');
    params.endDate = toDayEndIso(filters.endDate);
  }
};

export const listTripFeedback = (
  db: Database.Database,
  filters: AdminFilters,
): TripFeedbackRow[] => {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  addDateFilters(filters, where, params);

  if (filters.thumbsUp === 'up') where.push('thumbs_up = 1');
  if (filters.thumbsUp === 'down') where.push('thumbs_up = 0');

  if (filters.city) {
    where.push('LOWER(COALESCE(location_city, \'\')) = LOWER(@city)');
    params.city = filters.city.trim();
  }

  if (filters.state) {
    where.push('LOWER(COALESCE(location_state, \'\')) = LOWER(@state)');
    params.state = filters.state.trim();
  }

  if (filters.q) {
    where.push('(LOWER(COALESCE(feedback_text, \'\')) LIKE LOWER(@q) OR LOWER(COALESCE(trip_id, \'\')) LIKE LOWER(@q))');
    params.q = `%${filters.q.trim()}%`;
  }

  const sql = `
    SELECT *
    FROM trip_feedback
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY received_at DESC
    LIMIT 2000
  `;

  return db.prepare(sql).all(params) as TripFeedbackRow[];
};

export const listFeatureRequests = (
  db: Database.Database,
  filters: AdminFilters,
): FeatureRequestRow[] => {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  addDateFilters(filters, where, params);

  if (filters.category) {
    where.push('LOWER(COALESCE(category, \'\')) = LOWER(@category)');
    params.category = filters.category.trim();
  }

  if (filters.city) {
    where.push('LOWER(COALESCE(location_city, \'\')) = LOWER(@city)');
    params.city = filters.city.trim();
  }

  if (filters.state) {
    where.push('LOWER(COALESCE(location_state, \'\')) = LOWER(@state)');
    params.state = filters.state.trim();
  }

  if (filters.q) {
    where.push('LOWER(COALESCE(message, \'\')) LIKE LOWER(@q)');
    params.q = `%${filters.q.trim()}%`;
  }

  const sql = `
    SELECT *
    FROM feature_requests
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY received_at DESC
    LIMIT 2000
  `;

  return db.prepare(sql).all(params) as FeatureRequestRow[];
};
