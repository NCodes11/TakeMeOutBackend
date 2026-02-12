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
};

export const savePlan = (plan: Plan, stops: Stop[]) => {
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT OR REPLACE INTO Plan (id,title,city,date,startTime,endTime,groupType,transport,pace,budget,preferencesJSON,createdAt,returnToStart)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        plan.id,
        plan.title,
        plan.city,
        plan.date,
        plan.startTime,
        plan.endTime,
        plan.groupType,
        plan.transport,
        plan.pace,
        plan.budget,
        plan.preferencesJSON,
        plan.createdAt,
        plan.returnToStart ? 1 : 0,
      ],
    );
    db.runSync('DELETE FROM Stop WHERE planId = ?', [plan.id]);
    for (const s of stops) {
      db.runSync(
        `INSERT INTO Stop (id,planId,"order",name,category,lat,lng,address,startTime,endTime,durationMin,costLevel,why,locked)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        ],
      );
    }
  });
};

export const getPlans = (): Plan[] =>
  db
    .getAllSync<Omit<Plan, 'returnToStart'> & { returnToStart: unknown }>('SELECT * FROM Plan ORDER BY createdAt DESC')
    .map((plan) => ({
      ...plan,
      returnToStart: coerceBoolean(plan.returnToStart),
    }));

export const getPlanStops = (planId: string): Stop[] =>
  db
    .getAllSync<Omit<Stop, 'locked'> & { locked: unknown }>('SELECT * FROM Stop WHERE planId = ? ORDER BY "order" ASC', [planId])
    .map((stop) => ({
      ...stop,
      locked: coerceNumber(stop.locked),
    }));

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

export const getCachedPlaces = (providerKey: string, maxAgeHours = 12): any[] => {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
  return db.getAllSync<any>(
    'SELECT * FROM CachedPlace WHERE providerKey = ? AND cachedAt > ? ORDER BY cachedAt DESC LIMIT 100',
    [providerKey, cutoff],
  );
};
