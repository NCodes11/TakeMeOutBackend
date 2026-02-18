import * as SQLite from 'expo-sqlite';
import { ChecklistItem, Plan, Stop } from '@/types/models';

const db = SQLite.openDatabaseSync('daydate.db');

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
  `);

  // --- Migrations (safe to run every boot) ---

  // Plan additions
  addColumnIfMissing('Plan', 'startLat', 'REAL');
  addColumnIfMissing('Plan', 'startLng', 'REAL');

  // Stop additions (richer place + routing + type metadata)
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
        // These may be undefined; SQLite will store NULL
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
      groupType: plan.groupType as any,
      transport: plan.transport as any,
      budget: plan.budget as any,
      preferencesJSON: plan.preferencesJSON,
      createdAt: plan.createdAt,
      returnToStart: coerceBoolean(plan.returnToStart),
      // Optional fields (safe if your Plan type includes them; if not, they’ll just be ignored by TS if you remove them)
      ...(tableHasColumn('Plan', 'startLat') ? { startLat: coerceNullableNumber(plan.startLat) } : {}),
      ...(tableHasColumn('Plan', 'startLng') ? { startLng: coerceNullableNumber(plan.startLng) } : {}),
    })) as Plan[];

export const getPlanStops = (planId: string): Stop[] =>
  db
    .getAllSync<any>('SELECT * FROM Stop WHERE planId = ? ORDER BY "order" ASC', [planId])
    .map((stop) => ({
      id: stop.id,
      planId: stop.planId,
      order: coerceNumber(stop.order),
      name: stop.name ?? '',
      category: stop.category ?? '',
      lat: coerceNumber(stop.lat),
      lng: coerceNumber(stop.lng),
      address: stop.address ?? '',
      startTime: stop.startTime ?? '',
      endTime: stop.endTime ?? '',
      durationMin: coerceNumber(stop.durationMin),
      costLevel: stop.costLevel ?? '',
      why: stop.why ?? '',
      locked: coerceNumber(stop.locked),

      openNow: stop.openNow == null ? undefined : coerceBoolean(stop.openNow),
      rating: coerceNullableNumber(stop.rating),
      openingHoursText: coerceNullableString(stop.openingHoursText),
      priceLevel: coerceNullableNumber(stop.priceLevel),
      distanceKm: coerceNullableNumber(stop.distanceKm),
      etaMin: coerceNullableNumber(stop.etaMin),
      stopType: coerceNullableString(stop.stopType) as any,
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

/**
 * Returns recently cached places for a providerKey.
 * Set bypass=true to force a fresh provider fetch.
 */
export const getCachedPlaces = (providerKey: string, maxAgeHours = 12, bypass = false): CachedPlaceRow[] => {
  if (bypass) return [];
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  return db.getAllSync<CachedPlaceRow>(
    'SELECT * FROM CachedPlace WHERE providerKey = ? AND cachedAt > ? ORDER BY cachedAt DESC LIMIT 120',
    [providerKey, cutoff],
  );
};
