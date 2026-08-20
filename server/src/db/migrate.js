import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const migrationsDirectory = fileURLToPath(new URL('./migrations', import.meta.url));

export async function runMigrations() {
  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');
    // One transaction-level advisory lock makes concurrent serverless cold starts safe.
    await connection.query('SELECT pg_advisory_xact_lock($1)', [781_240_611]);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )
    `);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      const existing = await connection.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [fileName],
      );
      if (existing.rowCount > 0) continue;

      const sql = await readFile(path.join(migrationsDirectory, fileName), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name) VALUES ($1)', [fileName]);
      console.log(`Applied migration ${fileName}`);
    }
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
