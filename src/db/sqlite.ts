import * as SQLite from 'expo-sqlite';
import { BudgetType, ChecklistItem, FeatureRequest, Plan, Stop, TripFeedback } from '@/types/models';

const db = SQLite.openDatabaseSync('daydate.db');

interface StopRow {
  id: string;
  planId: string;
  order?: unknown;
  name?: unknown;
  category?: unknown;
  lat?: unknown;
  lng?: unknown;
  address?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  durationMin?: unknown;
  costLevel?: unknown;
  why?: unknown;
  locked?: unknown;
  openNow?: unknown;
  rating?: unknown;
  openingHoursText?: unknown;
  priceLevel?: unknown;
  distanceKm?: unknown;
  etaMin?: unknown;
  stopType?: unknown;
  providerId?: unknown;
  reviewCount?: unknown;
}

interface TripFeedbackRow {
  id: string;
  tripId: string;
  timestamp: string;
  thumbsUp: unknown;
  feedbackText?: unknown;
  selectedStopTypesJSON?: unknown;
  locationCity?: unknown;
  locationState?: unknown;
  stopCount?: unknown;
  priceTier?: unknown; // <- was string; SQLite returns unknown-ish shapes sometimes
  distancePreference?: unknown;
}

interface FeatureRequestRow {
  id: string;
  message?: unknown;
  category?: unknown;
  timestamp: string;
  appVersion?: unknown;
  deviceType?: unknown;
}

const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return false;
};

const coerceNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const coerceNullableNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const n = coerceNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : undefined;
};

const coerceNullableString = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  return String(value);
};

const isBudgetType = (value: unknown): value is BudgetType => value === '$' || value === '$$' || value === '$$$';

const coerceBudgetType = (value: unknown, fallback: BudgetType = '$$'): BudgetType => {
  if (isBudgetType(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isBudgetType(trimmed)) return trimmed;
  }
  return fallback;
};

const tableHasColumn = (table: string, column: string): boolean => {
  try {
    const rows = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table});`);
    return rows.some((r) => r.name === column);
  } catch {
    return false;
  }
};

const addColumnIfMissing = (table: string, column: string, sqlType: string) => {
  if (tableHasColumn(table, column)) return;
  db.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType};`);
};

export const initDb = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS Plan (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      date TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      groupType TEXT NOT NULL,
      transport TEXT NOT NULL,
      pace TEXT NOT NULL,
      budget TEXT NOT NULL,
      preferencesJSON TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      returnToStart INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Stop (
      id TEXT PRIMARY KEY NOT NULL,
      planId TEXT NOT NULL,
      "order" INTEGER,
      name TEXT,
      category TEXT,
      lat REAL,
      lng REAL,
      address TEXT,
      startTime TEXT,
      endTime TEXT,
      durationMin INTEGER,
      costLevel TEXT,
      why TEXT,
      locked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ChecklistItem (
      id TEXT PRIMARY KEY NOT NULL,
      planId TEXT NOT NULL,
      text TEXT,
      done INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS CachedPlace (
      providerKey TEXT,
      name TEXT,
      lat REAL,
      lng REAL,
      category TEXT,
      rawJSON TEXT,
      cachedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS TripFeedback (
      id TEXT PRIMARY KEY NOT NULL,
      tripId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      thumbsUp INTEGER NOT NULL,
      feedbackText TEXT,
      selectedStopTypesJSON TEXT NOT NULL,
      locationCity TEXT,
      locationState TEXT,
      stopCount INTEGER NOT NULL,
      priceTier TEXT NOT NULL,
      distancePreference INTEGER
    );

    CREATE TABLE IF NOT EXISTS FeatureRequest (
      id TEXT PRIMARY KEY NOT NULL,
      message TEXT NOT NULL,
      category TEXT,
      timestamp TEXT NOT NULL,
      appVersion TEXT NOT NULL,
      deviceType TEXT NOT NULL
    );
  `);

  // Safe migrations (run every boot)
  addColumnIfMissing('Plan', 'startLat', 'REAL');
  addColumnIfMissing('Plan', 'startLng', 'REAL');

  addColumnIfMissing('Stop', 'openNow', 'INTEGER');
  addColumnIfMissing('Stop', 'rating', 'REAL');
  addColumnIfMissing('Stop', 'openingHoursText', 'TEXT');
  addColumnIfMissing('Stop', 'priceLevel', 'INTEGER');
  addColumnIfMissing('Stop', 'distanceKm', 'REAL');
  addColumnIfMissing('Stop', 'etaMin', 'INTEGER');
  addColumnIfMissing('Stop', 'stopType', 'TEXT');
  addColumnIfMissing('Stop', 'providerId', 'TEXT');
  addColumnIfMissing('Stop', 'reviewCount', 'INTEGER');
};

export const savePlan = (plan: Plan, stops: Stop[]) => {
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT OR REPLACE INTO Plan (
        id,title,city,date,startTime,endTime,groupType,transport,pace,budget,preferencesJSON,createdAt,returnToStart,startLat,startLng
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        plan.id,
        plan.title,
        plan.city,
        plan.date,
        plan.startTime,
        plan.endTime,
        plan.groupType,
        plan.transport,
        'legacy',
        plan.budget,
        plan.preferencesJSON,
        plan.createdAt,
        plan.returnToStart ? 1 : 0,
        (plan as any).startLat ?? null,
        (plan as any).startLng ?? null,
      ],
    );

    db.runSync('DELETE FROM Stop WHERE planId = ?', [plan.id]);

    for (const s of stops) {
      db.runSync(
        `INSERT INTO Stop (
          id,planId,"order",name,category,lat,lng,address,startTime,endTime,durationMin,costLevel,why,locked,
          openNow,rating,openingHoursText,priceLevel,distanceKm,etaMin,stopType,providerId,reviewCount
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.id,
          s.planId,
          s.order,
          s.name,
          s.category,
          s.lat,
          s.lng,
          s.address,
          s.startTime,
          s.endTime,
          s.durationMin,
          s.costLevel,
          s.why,
          s.locked,

          typeof s.openNow === 'boolean' ? (s.openNow ? 1 : 0) : null,
          typeof s.rating === 'number' ? s.rating : null,
          s.openingHoursText ?? null,
          typeof s.priceLevel === 'number' ? s.priceLevel : null,
          typeof s.distanceKm === 'number' ? s.distanceKm : null,
          typeof s.etaMin === 'number' ? s.etaMin : null,
          s.stopType ?? null,
          s.providerId ?? null,
          typeof s.reviewCount === 'number' ? s.reviewCount : null,
        ],
      );
    }
  });
};

export const getPlans = (): Plan[] =>
  db
    .getAllSync<
      Omit<Plan, 'returnToStart'> & {
        pace?: unknown;
        returnToStart: unknown;
        startLat?: unknown;
        startLng?: unknown;
      }
    >('SELECT * FROM Plan ORDER BY createdAt DESC')
    .map((plan) => ({
      id: plan.id,
      title: plan.title,
      city: plan.city,
      date: plan.date,
      startTime: plan.startTime,
      endTime: plan.endTime,
      groupType: plan.groupType as Plan['groupType'],
      transport: plan.transport as Plan['transport'],
      budget: plan.budget as Plan['budget'],
      preferencesJSON: plan.preferencesJSON,
      createdAt: plan.createdAt,
      returnToStart: coerceBoolean(plan.returnToStart),
      ...(tableHasColumn('Plan', 'startLat') ? { startLat: coerceNullableNumber(plan.startLat) } : {}),
      ...(tableHasColumn('Plan', 'startLng') ? { startLng: coerceNullableNumber(plan.startLng) } : {}),
    })) as Plan[];

export const getPlanStops = (planId: string): Stop[] =>
  db
    .getAllSync<StopRow>('SELECT * FROM Stop WHERE planId = ? ORDER BY "order" ASC', [planId])
    .map((stop) => ({
      id: stop.id,
      planId: stop.planId,
      order: coerceNumber(stop.order),
      name: String(stop.name ?? ''),
      category: String(stop.category ?? ''),
      lat: coerceNumber(stop.lat),
      lng: coerceNumber(stop.lng),
      address: String(stop.address ?? ''),
      startTime: String(stop.startTime ?? ''),
      endTime: String(stop.endTime ?? ''),
      durationMin: coerceNumber(stop.durationMin),
      costLevel: String(stop.costLevel ?? ''),
      why: String(stop.why ?? ''),
      locked: coerceNumber(stop.locked),

      openNow: stop.openNow == null ? undefined : coerceBoolean(stop.openNow),
      rating: coerceNullableNumber(stop.rating),
      openingHoursText: coerceNullableString(stop.openingHoursText),
      priceLevel: coerceNullableNumber(stop.priceLevel),
      distanceKm: coerceNullableNumber(stop.distanceKm),
      etaMin: coerceNullableNumber(stop.etaMin),
      stopType: coerceNullableString(stop.stopType) as Stop['stopType'],
      providerId: coerceNullableString(stop.providerId),
      reviewCount: coerceNullableNumber(stop.reviewCount),
    })) as Stop[];

export const saveChecklist = (items: ChecklistItem[]) => {
  db.withTransactionSync(() => {
    for (const i of items) {
      db.runSync('INSERT OR REPLACE INTO ChecklistItem (id,planId,text,done) VALUES (?,?,?,?)', [
        i.id,
        i.planId,
        i.text,
        i.done,
      ]);
    }
  });
};

export const getChecklist = (planId: string): ChecklistItem[] =>
  db.getAllSync<ChecklistItem>('SELECT * FROM ChecklistItem WHERE planId = ?', [planId]);

export const saveTripFeedback = (entry: TripFeedback) => {
  db.runSync(
    `INSERT OR REPLACE INTO TripFeedback (
      id,tripId,timestamp,thumbsUp,feedbackText,selectedStopTypesJSON,locationCity,locationState,stopCount,priceTier,distancePreference
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      entry.id,
      entry.tripId,
      entry.timestamp,
      entry.thumbsUp ? 1 : 0,
      entry.feedbackText ?? null,
      JSON.stringify(entry.selectedStopTypes),
      entry.locationCity ?? null,
      entry.locationState ?? null,
      entry.stopCount,
      entry.priceTier, // stored as TEXT
      typeof entry.distancePreference === 'number' ? entry.distancePreference : null,
    ],
  );
};

export const saveFeatureRequest = (entry: FeatureRequest) => {
  db.runSync(
    'INSERT OR REPLACE INTO FeatureRequest (id,message,category,timestamp,appVersion,deviceType) VALUES (?,?,?,?,?,?)',
    [entry.id, entry.message, entry.category ?? null, entry.timestamp, entry.appVersion, entry.deviceType],
  );
};

export const getTripFeedback = (): TripFeedback[] =>
  db.getAllSync<TripFeedbackRow>('SELECT * FROM TripFeedback ORDER BY timestamp DESC').map((row) => ({
    id: row.id,
    tripId: row.tripId,
    timestamp: row.timestamp,
    thumbsUp: coerceBoolean(row.thumbsUp),
    feedbackText: coerceNullableString(row.feedbackText),
    selectedStopTypes: (() => {
      try {
        const parsed = JSON.parse(String(row.selectedStopTypesJSON ?? '[]'));
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
      } catch {
        return [];
      }
    })(),
    locationCity: coerceNullableString(row.locationCity),
    locationState: coerceNullableString(row.locationState),
    stopCount: coerceNumber(row.stopCount),
    priceTier: coerceBudgetType(row.priceTier, '$$'), // ✅ FIX: always return BudgetType
    distancePreference: coerceNullableNumber(row.distancePreference),
  }));

export const getFeatureRequests = (): FeatureRequest[] =>
  db.getAllSync<FeatureRequestRow>('SELECT * FROM FeatureRequest ORDER BY timestamp DESC').map((row) => ({
    id: row.id,
    message: String(row.message ?? ''),
    category: coerceNullableString(row.category) as FeatureRequest['category'],
    timestamp: row.timestamp,
    appVersion: String(row.appVersion ?? ''),
    deviceType: (row.deviceType as FeatureRequest['deviceType']) ?? 'ios',
  }));

export const cachePlaces = (rows: { providerKey: string; name: string; lat: number; lng: number; category: string; rawJSON: string }[]) => {
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    for (const row of rows) {
      db.runSync(
        'INSERT INTO CachedPlace (providerKey,name,lat,lng,category,rawJSON,cachedAt) VALUES (?,?,?,?,?,?,?)',
        [row.providerKey, row.name, row.lat, row.lng, row.category, row.rawJSON, now],
      );
    }
  });
};

export const clearCachedPlaces = (providerKey?: string) => {
  if (providerKey) {
    db.runSync('DELETE FROM CachedPlace WHERE providerKey = ?', [providerKey]);
    return;
  }
  db.runSync('DELETE FROM CachedPlace');
};

interface CachedPlaceRow {
  providerKey: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  rawJSON: string;
  cachedAt: string;
}

export const getCachedPlaces = (providerKey: string, maxAgeHours = 12, bypass = false): CachedPlaceRow[] => {
  if (bypass) return [];
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  return db.getAllSync<CachedPlaceRow>(
    'SELECT * FROM CachedPlace WHERE providerKey = ? AND cachedAt > ? ORDER BY cachedAt DESC LIMIT 120',
    [providerKey, cutoff],
  );
};
