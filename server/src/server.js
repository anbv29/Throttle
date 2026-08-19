import { env } from './config/env.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { pool } from './db/pool.js';

async function startServer() {
  await runMigrations();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Rate limiter API listening on port ${env.port}`);
  });
  server.requestTimeout = env.requestTimeoutMs;
  server.headersTimeout = env.headersTimeoutMs;
  server.keepAliveTimeout = env.keepAliveTimeoutMs;

  async function shutDown(signal) {
    console.log(`${signal} received; shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutDown('SIGTERM'));
  process.on('SIGINT', () => shutDown('SIGINT'));
}

startServer().catch(async (error) => {
  console.error('Unable to start server', error);
  await pool.end();
  process.exit(1);
});
