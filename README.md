# Throttle Rate Limiter Service

Throttle is a standalone, networked rate-limiting service built entirely with the PERN stack: PostgreSQL, Express, React, and Node.js. Applications call one HTTP endpoint with a client key. Throttle loads that client's policy, makes an atomic decision using either Token Bucket or Sliding Window, persists the result, and returns `ALLOW` or `DENY` semantics with standard rate-limit headers.

The repository includes a responsive administrative dashboard, PostgreSQL migrations, Docker Compose development infrastructure, unit and database-backed API/concurrency tests, request tracing and health probes, and a 550-concurrent-request load test.

## Architecture

```text
Calling service / React dashboard
              |
              | HTTP + JSON
              v
      Express routes/controllers
              |
              v
   Validation + rate limiter service
              |
              | transaction + SELECT ... FOR UPDATE
              v
          PostgreSQL 16
      /           |             \
 client policy  algorithm state  activity history
```

The system is intentionally database-coordinated. Node processes do not own rate-limit state, so restarting one process does not reset limits, and multiple backend instances can safely share the same database.

### Repository layout

```text
client/                         React + Vite product interface
  src/components/              Shell, theme, charts, modals, glass primitives
  src/pages/                   Nine routed product and learning pages
  src/lib/api.js               Browser API client
  Dockerfile                   Production frontend image
  nginx.conf                   Static hosting and /api reverse proxy
server/
  src/config/                  Environment configuration
  src/controllers/             HTTP request/response mapping
  src/db/                      Pool, transaction helper, migrations
  src/middleware/              Central error handling
  src/routes/                  API route definitions
  src/services/                Algorithms and business logic
  src/validators/              Input validation
  test/unit/                   Deterministic algorithm tests
  test/integration/            Real-PostgreSQL concurrency tests
  scripts/load-test.js         500+ concurrency load test
docker/postgres/init/          Test database bootstrap
docker-compose.yml             PostgreSQL, API, and dashboard
```

## Technology

- PostgreSQL 16 is the authoritative configuration, state, locking, and activity store.
- Node.js 20.19+ runs the service and the built-in test runner.
- Express 5 exposes the REST API.
- `pg` performs explicit parameterized SQL, transactions, and row locks; there is no ORM.
- React 19 and Vite 7 power the dashboard; Motion provides reduced-motion-aware route, chart, navigation, and tester transitions.
- Nginx serves the production frontend container and proxies `/api` to Express.
- Docker Compose runs the complete local stack.

## Algorithms

### Token Bucket

A Token Bucket client has a refill rate (`requestsPerSecond`) and a capacity (`burstSize`). Its persisted state contains a decimal token balance and a last-refill timestamp.

For every check, the service calculates:

```text
elapsed seconds = database time - last refill time
refilled tokens = min(burst size, old tokens + elapsed seconds × refill rate)
```

If at least one token exists, the request is allowed and one token is deducted. Otherwise it is denied. Fractional balances are stored in PostgreSQL using `NUMERIC(20, 6)`, so sub-second refills are preserved. The bucket never grows beyond its burst capacity. The reset time is when the bucket will be full; for a denial, `Retry-After` is the time until the next whole token.

### Sliding Window

A Sliding Window client has `maxRequests` and `windowSeconds`. Every allowed request creates a timestamped row. During a check the service:

1. Deletes this client's events at or before the moving cutoff.
2. Counts the remaining events within the exact rolling interval.
3. Inserts the current event only when the count is below the limit.

There are no fixed minute boundaries. The reset time is when the oldest active request leaves the window. Denied requests are recorded in activity history but do not consume a window slot.

## Database design

The migration creates:

| Table | Purpose |
| --- | --- |
| `clients` | Unique client key and one validated algorithm configuration |
| `token_bucket_state` | One persistent token balance and refill timestamp per Token Bucket client |
| `sliding_window_events` | Timestamped allowed requests used for exact moving-window counts |
| `rate_limit_activity` | Persistent allowed/denied audit history, decision latency, and dashboard metrics |
| `schema_migrations` | Tracks applied SQL migration files |

Important constraints include a unique client key, foreign keys with appropriate deletion behavior, positive-limit checks, mutually exclusive algorithm fields, and indexes on client/time combinations used by window and activity queries.

## Concurrency and race-condition prevention

Every rate-limit decision runs in one PostgreSQL transaction. It selects the matching `clients` row with `FOR UPDATE`. That row is the distributed, per-client mutex:

```text
BEGIN
  lock client row
  read authoritative database time
  read and calculate algorithm state
  decide allow or deny
  write state/event and activity row
COMMIT
```

If 500 checks arrive for the same client, the first transaction obtains the lock and the other 499 wait. Each waiter sees the state committed by its predecessor before making a decision. A token or window slot cannot be double-spent. Requests for different clients lock different rows and can proceed concurrently. The same behavior applies across multiple Express instances because PostgreSQL, not in-process JavaScript, owns the lock.

Policy updates also lock the client row. An update cannot replace or reset an algorithm halfway through a check.

## API

Base URL for local development: `http://localhost:4000`

### Health

```http
GET /health
GET /health/live
GET /health/ready
```

`/health/live` confirms the Node process is responsive without depending on PostgreSQL. `/health/ready` verifies that the database can answer a query and reports its latency. `/health` remains an alias of readiness for simple local tooling. Docker uses the readiness endpoint before starting the frontend.

Every HTTP response includes `X-Request-ID`. A caller-supplied safe request ID is preserved; otherwise the API creates a UUID. Error JSON also contains `requestId`, making a caller-visible failure traceable to the structured server access log.

### Check a rate limit

```http
POST /api/v1/rate-limit/check
Content-Type: application/json

{"clientKey":"client_free"}
```

Allowed response (`200`):

```json
{
  "allowed": true,
  "clientKey": "client_free",
  "algorithm": "token_bucket",
  "limit": 10,
  "remaining": 9,
  "resetAt": "2026-08-19T10:00:00.200Z"
}
```

Denied response (`429`):

```json
{
  "allowed": false,
  "clientKey": "client_free",
  "algorithm": "token_bucket",
  "limit": 10,
  "remaining": 0,
  "resetAt": "2026-08-19T10:00:02.000Z",
  "message": "Rate limit exceeded"
}
```

Decision responses contain:

- `X-RateLimit-Limit`: configured burst capacity or window request limit.
- `X-RateLimit-Remaining`: whole tokens or request slots remaining.
- `X-RateLimit-Reset`: reset time as Unix epoch seconds.
- `Retry-After`: whole seconds until another request can be accepted, on a denial.

### Admin endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/overview` | Counts and the 20 latest decisions |
| `GET` | `/api/v1/admin/analytics?range=15m` | Real time-bucketed traffic and latency (`1m`, `5m`, `15m`, `1h`, `24h`) |
| `GET` | `/api/v1/admin/clients` | List clients and current configuration |
| `GET` | `/api/v1/admin/clients/:clientKey` | Get one client |
| `GET` | `/api/v1/admin/clients/:clientKey/activity` | Current algorithm state, lifetime summary, and recent decisions |
| `POST` | `/api/v1/admin/clients` | Create a client |
| `PUT` | `/api/v1/admin/clients/:clientKey` | Fully replace a client's configuration |
| `DELETE` | `/api/v1/admin/clients/:clientKey` | Delete configuration and limiter state |

Create a Token Bucket client:

```bash
curl -X POST http://localhost:4000/api/v1/admin/clients \
  -H "Content-Type: application/json" \
  -d '{"clientKey":"client_free","algorithm":"token_bucket","requestsPerSecond":5,"burstSize":10}'
```

Create a Sliding Window client:

```bash
curl -X POST http://localhost:4000/api/v1/admin/clients \
  -H "Content-Type: application/json" \
  -d '{"clientKey":"client_pro","algorithm":"sliding_window","maxRequests":1000,"windowSeconds":60}'
```

Checks reject missing clients with `CLIENT_NOT_FOUND`. Invalid keys, unsupported algorithms, negative limits, non-integer capacities/windows, and malformed JSON return a safe JSON error. Duplicate keys return `DUPLICATE_CLIENT_KEY`. Raw PostgreSQL errors are never returned to callers.

## Run with Docker (recommended)

Requirements: Docker Desktop with Compose.

```bash
docker compose up --build
```

Then open:

- Dashboard: `http://localhost:3000`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- PostgreSQL host port: `5433` by default (the container still uses `5432` internally)

The API applies pending migrations before listening. PostgreSQL data is retained in the named `postgres_data` volume across container restarts.

Stop containers without deleting data:

```bash
docker compose down
```

To deliberately erase the local database volume, use `docker compose down -v`.

## Run without Docker

Requirements: Node.js 20.19+ and PostgreSQL 16+.

1. Copy `.env.example` to `.env` and adjust the database credentials.
2. Create the `rate_limiter` and `rate_limiter_test` databases.
3. Install dependencies and apply migrations.

```bash
npm install
npm run migrate --workspace server
npm run dev
```

Vite runs at `http://localhost:5173` and proxies API calls to Express at `http://localhost:4000`. `npm run dev` starts both processes.

Production-style local commands:

```bash
npm run build
npm start
```

### Windows local database helper

This workspace includes an ignored, localhost-only PostgreSQL development cluster on port `5433`. On this machine it can be managed with:

```bash
npm run db:local:status
npm run db:local:start
npm run db:local:stop
```

Then `npm run dev` starts the Express and Vite processes. The helper expects PostgreSQL 15 at `C:\Program Files\PostgreSQL\15\bin`; set `PG_BIN` if PostgreSQL is installed elsewhere. Docker Compose remains the portable recommended setup.

If the dashboard displays `The API is unavailable` or an old `Request failed with status 500` message, check `http://localhost:4000/health/ready`. Start PostgreSQL first and then run `npm run dev`. The dashboard marks the service offline and automatically retries every five seconds.

## Tests

Deterministic unit tests do not require a database:

```bash
npm test
```

They verify initial consumption, empty denial, fractional refill, capacity clamping, clock safety, requests inside and over a window, old-event expiration, and the continuously moving cutoff.

Concurrency tests require `TEST_DATABASE_URL`. The Docker bootstrap creates `rate_limiter_test` automatically on a new volume. When PostgreSQL is running:

```bash
npm run test:integration
```

The integration suite also verifies health probes, request IDs, validation errors, duplicate handling, client CRUD, standard headers, 429 responses, activity metrics, both algorithms, and persistence through a freshly constructed Express application. The mandatory concurrency scenario creates a 100-request Sliding Window policy and sends 500 simultaneous HTTP checks. It asserts exactly 100 responses are allowed and 400 are denied. A Token Bucket scenario also verifies that simultaneous calls cannot double-spend a final token. Integration tests truncate test tables, so never point `TEST_DATABASE_URL` at a database containing useful data.

## Load test

Start the full service, then run:

```bash
npm run load:test
```

Defaults:

- 1,100 total checks
- 550 concurrent checks per batch
- 500 allowed requests in a 60-second Sliding Window

The script creates a unique temporary client, reports total requests, achieved requests/second, allowed, denied, failed, average response time, and network errors, validates that allowed responses do not exceed the configured limit, then removes the client. It reports real measurements from the current machine and does not contain hard-coded performance results.

An actual local execution record is available in [LOAD_TEST_RESULTS.md](LOAD_TEST_RESULTS.md). It records the environment separately from the reusable script so measured throughput is never presented as a universal benchmark.

Override settings when needed:

```bash
BASE_URL=http://localhost:4000 CONCURRENCY=600 TOTAL_REQUESTS=1800 RATE_LIMIT=500 npm run load:test
```

`CONCURRENCY` is intentionally rejected when it is lower than 500. Achieved throughput depends on PostgreSQL, Docker, CPU, and connection settings; concurrency is guaranteed by the workload, while requests per second is measured and reported.

## Dashboard

The responsive, keyboard-accessible product interface provides:

- A public landing page and a glass-style application shell with persisted Light, Dark, and System themes.
- A live operations dashboard with configured/active clients, allow/deny totals, measured decision latency, database health, recent events, and real PostgreSQL traffic buckets.
- Searchable/filterable client management, algorithm-aware creation/editing, and detail pages showing current Token Bucket or Sliding Window state.
- A request lab with animated backend stages and a configurable 1–1,000 request worker-pool test that reports real decisions, transport errors, achieved requests/second, and supports cancellation.
- A dedicated analytics page with actual range-filtered traffic and latency data.
- How It Works, API Guide, Architecture, and Settings pages with interactive algorithm explainers, request examples, system topology, health status, and theme controls.

The UI uses the real API. It does not simulate decisions or keep authoritative limiter state in browser storage.

## Environment variables

| Variable | Default / example | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL | Main persistent database |
| `TEST_DATABASE_URL` | Separate PostgreSQL URL | Destructive integration-test database |
| `DATABASE_SSL` | `false` | Enables TLS for hosted PostgreSQL |
| `PORT` | `4000` | Express listen port |
| `NODE_ENV` | `development` | Runtime mode |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `REQUEST_LOGGING` | `true` outside tests | Structured JSON access logs |
| `REQUEST_TIMEOUT_MS` | `30000` | Maximum time for an HTTP request |
| `HEADERS_TIMEOUT_MS` | `35000` | Maximum time to receive request headers |
| `KEEP_ALIVE_TIMEOUT_MS` | `5000` | Idle HTTP keep-alive duration |
| `VITE_API_URL` | empty when proxied | Browser API origin baked into a Vite build |

Do not commit a real `.env` file or credentials.

## Trade-offs and limitations

- Exact Sliding Window storage grows with allowed traffic. Expired rows are pruned during checks; a high-volume production deployment should also run scheduled retention for inactive clients.
- One row lock serializes checks for the same client. That is deliberate for correctness, but a single extremely hot client is limited by database transaction throughput. Different clients remain parallel.
- Activity history is retained without automatic archival. Production retention/partitioning should match compliance and reporting needs.
- The admin API has no authentication because identity was not part of the requested PERN scope. It must be protected by an API gateway, private network, or added authentication before public exposure.
- Client updates reset current algorithm state so old limits cannot leak into a new policy.
- PostgreSQL pool size defaults to 20 per backend instance. Production values should be coordinated with the database connection budget and a pooler where appropriate.
- The service trusts its own database clock, avoiding disagreement between backend hosts, but all times returned to callers are UTC ISO timestamps/Unix seconds.
