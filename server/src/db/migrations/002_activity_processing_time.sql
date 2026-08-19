ALTER TABLE rate_limit_activity
  ADD COLUMN response_time_ms NUMERIC(10, 3);

CREATE INDEX rate_limit_activity_allowed_time_idx
  ON rate_limit_activity (allowed, requested_at DESC);
