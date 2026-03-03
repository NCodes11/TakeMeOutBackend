import path from 'node:path';
import { createDatabase } from './db.js';

const dbPath = process.env.FEEDBACK_DB_PATH ?? path.resolve(process.cwd(), 'data/feedback.sqlite');
const db = createDatabase(dbPath);
db.close();

console.log(`Migrations complete: ${dbPath}`);
