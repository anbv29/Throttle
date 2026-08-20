import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';

test('accepts the deployment origin forwarded by Vercel', async () => {
  const response = await request(createApp())
    .get('/health/live')
    .set('Origin', 'https://throttle.vercel.app')
    .set('X-Forwarded-Proto', 'https')
    .set('X-Forwarded-Host', 'throttle.vercel.app')
    .expect(200);

  assert.equal(response.headers['access-control-allow-origin'], 'https://throttle.vercel.app');
});

test('accepts Vercel preview deployments while running on Vercel', async () => {
  const originalVercel = process.env.VERCEL;
  process.env.VERCEL = '1';

  try {
    const response = await request(createApp())
      .get('/health/live')
      .set('Origin', 'https://throttle-git-feature-team.vercel.app')
      .expect(200);

    assert.equal(
      response.headers['access-control-allow-origin'],
      'https://throttle-git-feature-team.vercel.app',
    );
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

test('rejects unrelated browser origins', async () => {
  const response = await request(createApp())
    .get('/health/live')
    .set('Origin', 'https://untrusted.example')
    .expect(403);

  assert.equal(response.body.error, 'CORS_ORIGIN_DENIED');
});
