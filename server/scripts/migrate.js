import { runMigrations } from '../src/db/migrate.js';
import { pool } from '../src/db/pool.js';

try {
  await runMigrations();
  await pool.end();
} catch (error) {
  console.error('Migration failed', error);
  await pool.end();
  process.exitCode = 1;
}
