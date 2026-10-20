-- =========================================================================
-- UC-03 Connection Health SaaS: Database Migrations
-- Target Engine: SQLite 3 with Write-Ahead Logging (WAL) / Azure SQL
-- =========================================================================

-- Migration 001: Create Runs Table
-- Stores execution run lifecycles, cryptographic input fingerprints, and results.
-- Enforces strict (tenant_id, idempotency_key) uniqueness for replay safety.
CREATE TABLE IF NOT EXISTS Runs (
  run_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  result_json TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);

-- Migration 002: Create DailyUsage Table
-- Enforces atomic daily quota reservations per UTC day.
-- Eliminates read-then-write race conditions under high concurrency.
CREATE TABLE IF NOT EXISTS DailyUsage (
  tenant_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, usage_date)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_runs_tenant_created 
  ON Runs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_lookup 
  ON Runs (tenant_id, idempotency_key);
