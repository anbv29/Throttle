CREATE TYPE rate_limit_algorithm AS ENUM ('token_bucket', 'sliding_window');

CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  client_key VARCHAR(128) NOT NULL UNIQUE,
  algorithm rate_limit_algorithm NOT NULL,
  requests_per_second NUMERIC(20, 6),
  burst_size INTEGER,
  max_requests INTEGER,
  window_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT clients_algorithm_configuration_check CHECK (
    (
      algorithm = 'token_bucket'
      AND requests_per_second > 0
      AND burst_size > 0
      AND max_requests IS NULL
      AND window_seconds IS NULL
    )
    OR
    (
      algorithm = 'sliding_window'
      AND max_requests > 0
      AND window_seconds > 0
      AND requests_per_second IS NULL
      AND burst_size IS NULL
    )
  )
);

CREATE TABLE token_bucket_state (
  client_id BIGINT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  available_tokens NUMERIC(20, 6) NOT NULL CHECK (available_tokens >= 0),
  last_refill_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE sliding_window_events (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX sliding_window_events_client_time_idx
  ON sliding_window_events (client_id, requested_at);

CREATE TABLE rate_limit_activity (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  client_key VARCHAR(128) NOT NULL,
  algorithm rate_limit_algorithm NOT NULL,
  allowed BOOLEAN NOT NULL,
  remaining INTEGER NOT NULL CHECK (remaining >= 0),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX rate_limit_activity_requested_at_idx
  ON rate_limit_activity (requested_at DESC);

CREATE INDEX rate_limit_activity_client_time_idx
  ON rate_limit_activity (client_id, requested_at DESC);
