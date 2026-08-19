import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSlidingWindow } from '../../src/services/slidingWindowService.js';

const now = new Date('2026-01-01T00:01:00.000Z');

test('allows requests while the moving window is below its limit', () => {
  const result = calculateSlidingWindow({
    eventTimestamps: [new Date(now.getTime() - 10_000)],
    maxRequests: 3,
    windowSeconds: 60,
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 1);
  assert.equal(result.activeEvents.length, 2);
});

test('denies requests when active events equal the limit', () => {
  const result = calculateSlidingWindow({
    eventTimestamps: [
      new Date(now.getTime() - 20_000),
      new Date(now.getTime() - 10_000),
    ],
    maxRequests: 2,
    windowSeconds: 60,
    now,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterSeconds, 40);
});

test('expires events outside the moving window', () => {
  const result = calculateSlidingWindow({
    eventTimestamps: [
      new Date(now.getTime() - 60_001),
      new Date(now.getTime() - 30_000),
    ],
    maxRequests: 2,
    windowSeconds: 60,
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.activeEvents.length, 2);
  assert.equal(result.remaining, 0);
});

test('an event exactly on the cutoff has expired', () => {
  const result = calculateSlidingWindow({
    eventTimestamps: [new Date(now.getTime() - 60_000)],
    maxRequests: 1,
    windowSeconds: 60,
    now,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.activeEvents.length, 1);
});
