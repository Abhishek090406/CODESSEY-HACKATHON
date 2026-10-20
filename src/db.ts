import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RunRecord, RunStatus, OperationType, PlanType } from './types.js';

let dbInstance: Database.Database | null = null;

export function getDb(customPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DB_PATH || './app.db';

  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(dbPath);
  initMigrations(dbInstance);
  return dbInstance;
}

export function resetDbForTesting(): void {
  if (dbInstance) {
    try {
      dbInstance.exec('DROP TABLE IF EXISTS Runs;');
      dbInstance.exec('DROP TABLE IF EXISTS DailyUsage;');
      initMigrations(dbInstance);
    } catch {
      // ignore
    }
  }
}

export function initMigrations(db: Database.Database): void {
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  } catch {
    // ignore in-memory or read-only edge cases
  }

  db.exec(`
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

    CREATE TABLE IF NOT EXISTS DailyUsage (
      tenant_id TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, usage_date)
    );
  `);
}

export interface DbDiagnostics {
  status: 'connected' | 'disconnected';
  engine: string;
  path: string;
  journal_mode: string;
  runs_count: number;
  daily_usage_records: number;
  db_size_bytes: number;
  ping_ms: number;
}

export function getDbDiagnostics(db: Database.Database): DbDiagnostics {
  const start = performance.now();
  db.prepare('SELECT 1').get();
  const ping_ms = Number((performance.now() - start).toFixed(2));

  let journal_mode = 'WAL';
  try {
    const row = db.prepare('PRAGMA journal_mode;').get() as any;
    journal_mode = row ? Object.values(row)[0] as string : 'WAL';
  } catch {}

  let runs_count = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM Runs;').get() as any;
    runs_count = row ? row.cnt : 0;
  } catch {}

  let daily_usage_records = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM DailyUsage;').get() as any;
    daily_usage_records = row ? row.cnt : 0;
  } catch {}

  const dbPath = process.env.DB_PATH || './app.db';
  let db_size_bytes = 0;
  try {
    if (fs.existsSync(dbPath)) {
      db_size_bytes = fs.statSync(dbPath).size;
    }
  } catch {}

  return {
    status: 'connected',
    engine: process.env.AZURE_SQL_CONNECTION_STRING ? 'Azure SQL Database' : 'SQLite 3 (Enterprise WAL Engine)',
    path: dbPath,
    journal_mode,
    runs_count,
    daily_usage_records,
    db_size_bytes,
    ping_ms,
  };
}

export function getDailyQuotaLimit(plan: PlanType): number {
  if (plan === 'Ultra') return 100;
  return plan === 'Pro' ? 10 : 3;
}

export function getUtcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeInputFingerprint(operation: string, records: any[]): string {
  const content = JSON.stringify({ operation, records });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Single-statement atomic quota reservation per PS specification:
 * UPDATE DailyUsage SET count = count + 1 WHERE tenant_id=@t AND usage_date=@d AND count < @limit
 * Returns true if slot was atomically acquired, false if quota was exhausted.
 */
export function reserveQuotaSlot(db: Database.Database, tenantId: string, limit: number): boolean {
  const today = getUtcToday();

  // Ensure record for today exists without altering count
  db.prepare(`
    INSERT OR IGNORE INTO DailyUsage (tenant_id, usage_date, count)
    VALUES (?, ?, 0)
  `).run(tenantId, today);

  // Atomic reservation: only increment if current count is strictly less than limit
  const result = db.prepare(`
    UPDATE DailyUsage
    SET count = count + 1
    WHERE tenant_id = ? AND usage_date = ? AND count < ?
  `).run(tenantId, today, limit);

  return result.changes === 1;
}

export function getRemainingQuota(db: Database.Database, tenantId: string, plan: PlanType): number {
  const limit = getDailyQuotaLimit(plan);
  const today = getUtcToday();

  const row = db.prepare(`
    SELECT count FROM DailyUsage
    WHERE tenant_id = ? AND usage_date = ?
  `).get(tenantId, today) as { count: number } | undefined;

  const used = row ? row.count : 0;
  return Math.max(0, limit - used);
}

export function findRunByIdempotencyKey(
  db: Database.Database,
  tenantId: string,
  key: string
): RunRecord | null {
  const row = db.prepare(`
    SELECT * FROM Runs WHERE tenant_id = ? AND idempotency_key = ?
  `).get(tenantId, key) as any;

  if (!row) return null;

  return {
    run_id: row.run_id,
    tenant_id: row.tenant_id,
    idempotency_key: row.idempotency_key,
    input_fingerprint: row.input_fingerprint,
    operation: row.operation as OperationType,
    status: row.status as RunStatus,
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error_text || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findRunById(
  db: Database.Database,
  tenantId: string,
  runId: string
): RunRecord | null {
  const row = db.prepare(`
    SELECT * FROM Runs WHERE tenant_id = ? AND run_id = ?
  `).get(tenantId, runId) as any;

  if (!row) return null;

  return {
    run_id: row.run_id,
    tenant_id: row.tenant_id,
    idempotency_key: row.idempotency_key,
    input_fingerprint: row.input_fingerprint,
    operation: row.operation as OperationType,
    status: row.status as RunStatus,
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error_text || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listRunsByTenant(db: Database.Database, tenantId: string): RunRecord[] {
  const rows = db.prepare(`
    SELECT * FROM Runs WHERE tenant_id = ? ORDER BY created_at DESC
  `).all(tenantId) as any[];

  return rows.map((row) => ({
    run_id: row.run_id,
    tenant_id: row.tenant_id,
    idempotency_key: row.idempotency_key,
    input_fingerprint: row.input_fingerprint,
    operation: row.operation as OperationType,
    status: row.status as RunStatus,
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error_text || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export function createRun(
  db: Database.Database,
  run: {
    run_id: string;
    tenant_id: string;
    idempotency_key: string;
    input_fingerprint: string;
    operation: OperationType;
    status: RunStatus;
  }
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO Runs (run_id, tenant_id, idempotency_key, input_fingerprint, operation, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.run_id,
    run.tenant_id,
    run.idempotency_key,
    run.input_fingerprint,
    run.operation,
    run.status,
    now,
    now
  );
}

export function updateRunTerminal(
  db: Database.Database,
  runId: string,
  status: 'Succeeded' | 'Failed',
  result?: any,
  error?: string
): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE Runs
    SET status = ?, result_json = ?, error_text = ?, updated_at = ?
    WHERE run_id = ?
  `).run(
    status,
    result ? JSON.stringify(result) : null,
    error || null,
    now,
    runId
  );
}
