SELECT 'CREATE DATABASE rate_limiter_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rate_limiter_test')\gexec
