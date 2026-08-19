import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTokenBucket } from '../../src/services/tokenBucketService.js';

const baseTime = new Date('2026-01-01T00:00:00.000Z');

test('a new full bucket consumes one token', () => {
  const result = calculateTokenBucket({
    availableTokens: 10,
    lastRefillAt: baseTime,
    requestsPerSecond: 5,
    burstSize: 10,
    now: baseTime,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.availableTokens, 9);
  assert.equal(result.remaining, 9);
});

test('an empty bucket denies a request and calculates retry time', () => {
  const result = calculateTokenBucket({
    availableTokens: 0,
    lastRefillAt: baseTime,
    requestsPerSecond: 2,
    burstSize: 5,
    now: baseTime,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterSeconds, 0.5);
});

test('fractional elapsed time refills enough for a later request', () => {
  const result = calculateTokenBucket({
    availableTokens: 0.25,
    lastRefillAt: baseTime,
    requestsPerSecond: 2,
    burstSize: 5,
    now: new Date(baseTime.getTime() + 375),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.availableTokens, 0);
});

test('refill never exceeds the configured burst capacity', () => {
  const result = calculateTokenBucket({
    availableTokens: 2,
    lastRefillAt: baseTime,
    requestsPerSecond: 100,
    burstSize: 10,
    now: new Date(baseTime.getTime() + 60_000),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.availableTokens, 9);
});

test('clock skew does not subtract tokens', () => {
  const result = calculateTokenBucket({
    availableTokens: 3,
    lastRefillAt: new Date(baseTime.getTime() + 1_000),
    requestsPerSecond: 1,
    burstSize: 5,
    now: baseTime,
  });

  assert.equal(result.availableTokens, 2);
});
