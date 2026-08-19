import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const concurrency = Number(process.env.CONCURRENCY ?? 550);
const totalRequests = Number(process.env.TOTAL_REQUESTS ?? 1100);
const configuredLimit = Number(process.env.RATE_LIMIT ?? 500);
const clientKey = process.env.CLIENT_KEY ?? `load_test_${Date.now()}`;

if (
  ![concurrency, totalRequests, configuredLimit].every((value) => Number.isSafeInteger(value) && value > 0)
  || concurrency < 500
) {
  throw new Error('CONCURRENCY must be an integer of at least 500; TOTAL_REQUESTS and RATE_LIMIT must be positive integers');
}

async function configureClient() {
  const response = await fetch(`${baseUrl}/api/v1/admin/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey,
      algorithm: 'sliding_window',
      maxRequests: configuredLimit,
      windowSeconds: 60,
    }),
  });
  if (!response.ok) throw new Error(`Unable to create load-test client: ${response.status} ${await response.text()}`);
}

async function sendCheck() {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/v1/rate-limit/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey }),
    });
    return {
      status: response.status,
      duration: performance.now() - startedAt,
      failed: response.status !== 200 && response.status !== 429,
    };
  } catch (error) {
    return { status: 0, duration: performance.now() - startedAt, failed: true, error };
  }
}

async function runInBatches() {
  const results = [];
  const startedAt = performance.now();
  for (let offset = 0; offset < totalRequests; offset += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - offset);
    results.push(...await Promise.all(Array.from({ length: batchSize }, sendCheck)));
  }
  return { results, elapsedMilliseconds: performance.now() - startedAt };
}

async function cleanUp() {
  await fetch(`${baseUrl}/api/v1/admin/clients/${encodeURIComponent(clientKey)}`, { method: 'DELETE' });
}

await configureClient();
try {
  const { results, elapsedMilliseconds } = await runInBatches();
  const allowed = results.filter((result) => result.status === 200).length;
  const denied = results.filter((result) => result.status === 429).length;
  const failed = results.filter((result) => result.failed).length;
  const errors = results.filter((result) => result.error).length;
  const averageResponseTime = results.reduce((sum, result) => sum + result.duration, 0) / results.length;
  const requestsPerSecond = totalRequests / (elapsedMilliseconds / 1000);
  const correct = allowed <= configuredLimit && failed === 0;

  console.table({
    totalRequests,
    concurrency,
    requestsPerSecond: requestsPerSecond.toFixed(2),
    allowed,
    denied,
    failed,
    averageResponseTimeMs: averageResponseTime.toFixed(2),
    errorCount: errors,
    correctness: correct ? 'PASS' : 'FAIL',
  });

  if (!correct) process.exitCode = 1;
} finally {
  await cleanUp();
}
