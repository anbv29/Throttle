# Load-test execution record

This file records an actual execution of `server/scripts/load-test.js`. It is an environment-specific observation, not a promised production benchmark.

## Execution

- Date: 2026-08-19
- Runtime: Node.js 24.13.0 on Windows
- Database: temporary isolated PostgreSQL 15.4 instance
- Target: local Express server using a single Sliding Window client
- Total requests: 1,100
- Concurrent requests per batch: 550
- Configured 60-second limit: 500

## Measured result

| Measurement | Result |
| --- | ---: |
| Requests per second | 295.76 |
| Allowed | 500 |
| Denied | 600 |
| Failed | 0 |
| Network errors | 0 |
| Average response time | 1,052.22 ms |
| Correctness check | PASS |

The important correctness invariant held: despite 550 simultaneous checks against the same key, the service committed exactly 500 allowed decisions and did not exceed the configured limit. Same-key requests intentionally serialize on the PostgreSQL client-row lock, so throughput and latency depend heavily on database round-trip time and host performance. Run `npm run load:test` in the target deployment environment to obtain a relevant capacity measurement.
