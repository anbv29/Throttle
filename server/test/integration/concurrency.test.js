import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

async function prepareApplication() {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';
  const [{ createApp }, { runMigrations }, { pool }] = await Promise.all([
    import('../../src/app.js'),
    import('../../src/db/migrate.js'),
    import('../../src/db/pool.js'),
  ]);
  await runMigrations();
  await pool.query('TRUNCATE rate_limit_activity, sliding_window_events, token_bucket_state, clients RESTART IDENTITY CASCADE');
  return { app: createApp(), createApp, pool };
}

test('PostgreSQL transactions preserve concurrency limits', {
  skip: !testDatabaseUrl,
}, async (context) => {
  const { app, createApp, pool } = await prepareApplication();

  try {
    await context.test('health endpoints and request tracing expose operational status', async () => {
      const liveResponse = await request(app)
        .get('/health/live')
        .set('X-Request-ID', 'integration-health-1')
        .expect(200);

      assert.equal(liveResponse.headers['x-request-id'], 'integration-health-1');
      assert.equal(liveResponse.body.status, 'ok');
      assert.equal(typeof liveResponse.body.uptimeSeconds, 'number');

      const readyResponse = await request(app).get('/health/ready').expect(200);
      assert.equal(readyResponse.body.database, 'ready');
      assert.equal(typeof readyResponse.body.databaseLatencyMilliseconds, 'number');
      assert.ok(readyResponse.headers['x-request-id']);
    });

    await context.test('admin CRUD, validation, headers, persistence, and both algorithms honor the API contract', async () => {
      const invalidResponse = await request(app)
        .post('/api/v1/admin/clients')
        .set('X-Request-ID', 'contract-validation-1')
        .send({
          clientKey: 'contract_client',
          algorithm: 'token_bucket',
          requestsPerSecond: -1,
          burstSize: 2,
        })
        .expect(400);
      assert.equal(invalidResponse.body.error, 'VALIDATION_ERROR');
      assert.equal(invalidResponse.body.requestId, 'contract-validation-1');

      const createResponse = await request(app).post('/api/v1/admin/clients').send({
        clientKey: 'contract_client',
        algorithm: 'token_bucket',
        requestsPerSecond: 0.000001,
        burstSize: 2,
      }).expect(201);
      assert.equal(createResponse.body.client.clientKey, 'contract_client');
      assert.equal(createResponse.body.client.state.availableTokens, 2);

      const duplicateResponse = await request(app).post('/api/v1/admin/clients').send({
        clientKey: 'contract_client',
        algorithm: 'token_bucket',
        requestsPerSecond: 1,
        burstSize: 2,
      }).expect(409);
      assert.equal(duplicateResponse.body.error, 'DUPLICATE_CLIENT_KEY');

      const firstDecision = await request(app)
        .post('/api/v1/rate-limit/check')
        .send({ clientKey: 'contract_client' })
        .expect(200);
      assert.equal(firstDecision.body.allowed, true);
      assert.equal(firstDecision.body.remaining, 1);
      assert.equal(firstDecision.headers['x-ratelimit-limit'], '2');
      assert.equal(firstDecision.headers['x-ratelimit-remaining'], '1');
      assert.match(firstDecision.headers['x-ratelimit-reset'], /^\d+$/);

      const restartedApplication = createApp();
      await request(restartedApplication)
        .post('/api/v1/rate-limit/check')
        .send({ clientKey: 'contract_client' })
        .expect(200)
        .expect((response) => {
          assert.equal(response.body.remaining, 0);
        });

      const deniedDecision = await request(app)
        .post('/api/v1/rate-limit/check')
        .send({ clientKey: 'contract_client' })
        .expect(429);
      assert.equal(deniedDecision.body.allowed, false);
      assert.equal(deniedDecision.body.message, 'Rate limit exceeded');
      assert.ok(Number(deniedDecision.headers['retry-after']) >= 1);

      const getResponse = await request(app)
        .get('/api/v1/admin/clients/contract_client')
        .expect(200);
      assert.equal(getResponse.body.client.algorithm, 'token_bucket');

      await request(app)
        .put('/api/v1/admin/clients/contract_client')
        .send({
          clientKey: 'contract_client',
          algorithm: 'sliding_window',
          maxRequests: 2,
          windowSeconds: 60,
        })
        .expect(200)
        .expect((response) => {
          assert.equal(response.body.client.algorithm, 'sliding_window');
          assert.equal(response.body.client.state, undefined);
        });

      const slidingResponses = await Promise.all(
        Array.from({ length: 3 }, () => request(app)
          .post('/api/v1/rate-limit/check')
          .send({ clientKey: 'contract_client' })),
      );
      assert.equal(slidingResponses.filter((response) => response.status === 200).length, 2);
      assert.equal(slidingResponses.filter((response) => response.status === 429).length, 1);

      const overviewResponse = await request(app).get('/api/v1/admin/overview').expect(200);
      assert.equal(overviewResponse.body.totalClients, 1);
      assert.equal(overviewResponse.body.totalAllowed, 4);
      assert.equal(overviewResponse.body.totalDenied, 2);
      assert.equal(overviewResponse.body.recentActivity.length, 6);

      const clientsResponse = await request(app).get('/api/v1/admin/clients').expect(200);
      assert.equal(clientsResponse.body.clients.length, 1);
      assert.equal(clientsResponse.body.clients[0].totalRequests, 6);
      assert.ok(clientsResponse.body.clients[0].lastActivityAt);

      const analyticsResponse = await request(app)
        .get('/api/v1/admin/analytics?range=15m')
        .expect(200);
      assert.equal(analyticsResponse.body.range, '15m');
      assert.equal(analyticsResponse.body.dataSource, 'postgresql_activity_history');
      assert.ok(analyticsResponse.body.points.length > 0);
      assert.equal(
        analyticsResponse.body.points.reduce((total, point) => total + point.incoming, 0),
        6,
      );

      const activityResponse = await request(app)
        .get('/api/v1/admin/clients/contract_client/activity')
        .expect(200);
      assert.equal(activityResponse.body.currentState.currentUsage, 2);
      assert.equal(activityResponse.body.summary.totalRequests, 6);
      assert.equal(activityResponse.body.summary.allowedRequests, 4);
      assert.equal(activityResponse.body.summary.deniedRequests, 2);
      assert.equal(activityResponse.body.recentActivity.length, 6);

      await request(app)
        .get('/api/v1/admin/analytics?range=unsupported')
        .expect(400)
        .expect((response) => assert.equal(response.body.error, 'VALIDATION_ERROR'));

      await request(app).delete('/api/v1/admin/clients/contract_client').expect(204);
      const missingResponse = await request(app)
        .post('/api/v1/rate-limit/check')
        .send({ clientKey: 'contract_client' })
        .expect(404);
      assert.equal(missingResponse.body.error, 'CLIENT_NOT_FOUND');
      assert.ok(missingResponse.body.requestId);
    });

    await pool.query('TRUNCATE rate_limit_activity, sliding_window_events, token_bucket_state, clients RESTART IDENTITY CASCADE');

    await context.test('500 simultaneous sliding-window checks never exceed a limit of 100', async () => {
      await request(app).post('/api/v1/admin/clients').send({
        clientKey: 'concurrency_sliding',
        algorithm: 'sliding_window',
        maxRequests: 100,
        windowSeconds: 60,
      }).expect(201);

      const responses = await Promise.all(
        Array.from({ length: 500 }, () =>
          request(app)
            .post('/api/v1/rate-limit/check')
            .send({ clientKey: 'concurrency_sliding' }),
        ),
      );

      assert.equal(responses.filter((response) => response.status === 200).length, 100);
      assert.equal(responses.filter((response) => response.status === 429).length, 400);
    });

    await pool.query('TRUNCATE rate_limit_activity, sliding_window_events, token_bucket_state, clients RESTART IDENTITY CASCADE');

    await context.test('simultaneous token-bucket checks cannot double-spend the last token', async () => {
      await request(app).post('/api/v1/admin/clients').send({
        clientKey: 'concurrency_token',
        algorithm: 'token_bucket',
        requestsPerSecond: 0.000001,
        burstSize: 1,
      }).expect(201);

      const responses = await Promise.all(
        Array.from({ length: 50 }, () =>
          request(app)
            .post('/api/v1/rate-limit/check')
            .send({ clientKey: 'concurrency_token' }),
        ),
      );

      assert.equal(responses.filter((response) => response.status === 200).length, 1);
      assert.equal(responses.filter((response) => response.status === 429).length, 49);
    });
  } finally {
    await pool.end();
  }
});
