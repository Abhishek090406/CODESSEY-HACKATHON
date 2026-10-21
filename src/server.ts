import express, { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { authMiddleware, authenticateUser, SEEDED_ACCOUNTS } from './auth.js';
import {
  getDb,
  getDbDiagnostics,
  getDailyQuotaLimit,
  getRemainingQuota,
  reserveQuotaSlot,
  findRunByIdempotencyKey,
  findRunById,
  listRunsByTenant,
  createRun,
  updateRunTerminal,
  computeInputFingerprint,
} from './db.js';
import { validateRecords } from './validator.js';
import { processConnectionRecords } from './processor.js';
import { OperationType } from './types.js';
import { askCopilot } from './copilot.js';
import { persistReport } from './storage.js';

export function createServer() {
  const app = express();
  const db = getDb();
  const gitCommit = process.env.COMMIT_SHA || process.env.GIT_COMMIT || 'f074cd4';

  // Enforce JSON parsing with 64 KiB body limit per specification
  app.use(express.json({ limit: '64kb' }));

  // Serve static UI assets from public/
  app.use(express.static(path.join(process.cwd(), 'public')));

  // 1. GET /health - Public, reveals no tenant data
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      app: 'AetherHealth',
      commit: gitCommit,
    });
  });

  // System Database Diagnostics - Public health check
  app.get('/api/db/status', (_req: Request, res: Response) => {
    try {
      const diag = getDbDiagnostics(db);
      res.status(200).json(diag);
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Database Speed Benchmark - Public diagnostic test
  app.post('/api/db/benchmark', (_req: Request, res: Response) => {
    try {
      const iterations = 50;
      const times: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        db.prepare('SELECT 1').get();
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      const min = Number(times[0].toFixed(3));
      const p50 = Number(times[Math.floor(iterations * 0.5)].toFixed(3));
      const p95 = Number(times[Math.floor(iterations * 0.95)].toFixed(3));
      const max = Number(times[times.length - 1].toFixed(3));
      res.status(200).json({
        iterations,
        min_ms: min,
        p50_ms: p50,
        p95_ms: p95,
        max_ms: max,
        status: 'optimal',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Aether Intelligence / Gemini SLA Copilot Endpoint
  app.post('/api/copilot/chat', async (req: Request, res: Response) => {
    try {
      const { message, context } = req.body || {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const copilotResponse = await askCopilot({
        message,
        context,
      });

      res.status(200).json(copilotResponse);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Copilot engine failure' });
    }
  });

  // Enterprise Authentication Portal Endpoints
  app.post('/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const account = authenticateUser(email, password);
    if (!account) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    res.status(200).json({
      token: account.token,
      user: {
        email: account.email,
        company_name: account.company_name,
        tenant_id: account.tenant_id,
        role: account.role,
        plan: account.plan,
        subscription_status: account.subscription_status,
      },
    });
  });

  app.get('/auth/accounts', (_req: Request, res: Response) => {
    res.status(200).json({
      accounts: SEEDED_ACCOUNTS.map((a: any) => ({
        email: a.email,
        password: a.password,
        company_name: a.company_name,
        tenant_id: a.tenant_id,
        role: a.role,
        plan: a.plan,
        subscription_status: a.subscription_status,
        token: a.token,
      })),
    });
  });

  // Protected routes require verified session
  app.use(authMiddleware);

  // 2. GET /tools - Authenticated, returns allowed operations
  app.get('/tools', (req: Request, res: Response) => {
    const session = req.session!;
    const operations: OperationType[] = (session.plan === 'Pro' || session.plan === 'Ultra') ? ['validate', 'process'] : ['validate'];
    res.status(200).json({
      role: session.role,
      plan: session.plan,
      subscription_status: session.subscription_status,
      allowed_operations: operations,
      can_submit: session.role === 'Operator' && session.subscription_status === 'active',
    });
  });

  // 3. GET /subscription - Authenticated, returns quota and subscription status
  app.get('/subscription', (req: Request, res: Response) => {
    const session = req.session!;
    const remainingQuota = getRemainingQuota(db, session.tenant_id, session.plan);
    const dailyLimit = getDailyQuotaLimit(session.plan);

    res.status(200).json({
      plan: session.plan,
      status: session.subscription_status,
      remaining_quota: remainingQuota,
      daily_limit: dailyLimit,
    });
  });

  // 4. POST /runs - Authenticated, strict ordering of checks
  app.post('/runs', async (req: Request, res: Response) => {
    const session = req.session!;

    // Check Idempotency-Key header
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      res.status(400).json({ error: 'Idempotency-Key header is required.' });
      return;
    }

    // Role check: Operator can submit; Viewer is read-only (403)
    if (session.role !== 'Operator') {
      res.status(403).json({ error: 'Forbidden: Viewer role cannot submit runs.' });
      return;
    }

    // Subscription status check: Suspended subscriptions cannot start new runs (403)
    if (session.subscription_status === 'suspended') {
      res.status(403).json({ error: 'Forbidden: Subscription is suspended.' });
      return;
    }

    // Body shape check: Body must be exactly { operation, records }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Body must be a JSON object.' });
      return;
    }

    const keys = Object.keys(body);
    const allowedKeys = ['operation', 'records'];
    const hasInvalidKeys = keys.some((k) => !allowedKeys.includes(k));
    if (hasInvalidKeys || !('operation' in body) || !('records' in body)) {
      res.status(400).json({ error: 'Body must contain exactly operation and records fields.' });
      return;
    }

    const { operation, records } = body;
    if (operation !== 'validate' && operation !== 'process') {
      res.status(400).json({ error: "Operation must be either 'validate' or 'process'." });
      return;
    }

    // Plan check: Basic is validate only (403)
    if (operation === 'process' && session.plan === 'Basic') {
      res.status(403).json({ error: 'Forbidden: Basic plan does not allow process operation.' });
      return;
    }

    if (!Array.isArray(records) || records.length < 1 || records.length > 10) {
      res.status(400).json({ error: 'Records must be an array containing 1 to 10 rows.' });
      return;
    }

    // Fingerprint computation
    const currentFingerprint = computeInputFingerprint(operation, records);

    // Matching replay check
    const existingRun = findRunByIdempotencyKey(db, session.tenant_id, idempotencyKey);
    if (existingRun) {
      if (existingRun.input_fingerprint !== currentFingerprint) {
        // Changed input for same key -> 409
        res.status(409).json({ error: 'Idempotency key reused with different input payload.' });
        return;
      }

      if (existingRun.status === 'Running') {
        res.status(409).json({ error: 'RUN_IN_PROGRESS' });
        return;
      }

      // Matching terminal replay -> 200 with no re-execution or quota debit
      res.status(200).json({
        run_id: existingRun.run_id,
        status: existingRun.status,
        result: existingRun.result,
        error: existingRun.error,
      });
      return;
    }

    // For process: any invalid row -> 400 before acceptance and before quota debit
    const { normalizedRecords, validationResult } = validateRecords(records);
    if (operation === 'process' && validationResult.invalid_rows > 0) {
      res.status(400).json({
        error: 'Validation failed for process operation.',
        issues: validationResult.issues,
      });
      return;
    }

    // Atomic quota reserve in a single SQL statement
    const limit = getDailyQuotaLimit(session.plan);
    const reserved = reserveQuotaSlot(db, session.tenant_id, limit);
    if (!reserved) {
      res.status(429).json({ error: 'Daily quota exhausted.' });
      return;
    }

    // Run creation with lifecycle
    const runId = crypto.randomUUID();

    try {
      createRun(db, {
        run_id: runId,
        tenant_id: session.tenant_id,
        idempotency_key: idempotencyKey,
        input_fingerprint: currentFingerprint,
        operation,
        status: 'Running',
      });
    } catch (err: any) {
      // Handle simultaneous duplicate key race condition
      const racedRun = findRunByIdempotencyKey(db, session.tenant_id, idempotencyKey);
      if (racedRun) {
        if (racedRun.input_fingerprint !== currentFingerprint) {
          res.status(409).json({ error: 'Idempotency key conflict.' });
          return;
        }
        if (racedRun.status === 'Running') {
          res.status(409).json({ error: 'RUN_IN_PROGRESS' });
          return;
        }
        res.status(200).json({
          run_id: racedRun.run_id,
          status: racedRun.status,
          result: racedRun.result,
          error: racedRun.error,
        });
        return;
      }
      throw err;
    }

    // Check shared test hook that forces a failure after acceptance (A11)
    if (req.headers['x-test-force-failure'] === 'true') {
      const forcedError = 'Processing failed: Injected test hook failure';
      updateRunTerminal(db, runId, 'Failed', undefined, forcedError);
      res.status(201).json({
        run_id: runId,
        status: 'Failed',
        error: forcedError,
      });
      return;
    }

    // Normal processing
    if (operation === 'validate') {
      updateRunTerminal(db, runId, 'Succeeded', validationResult);
      await persistReport(session.tenant_id, runId, validationResult);
      res.status(201).json({
        run_id: runId,
        status: 'Succeeded',
        result: validationResult,
      });
    } else {
      const processingResult = processConnectionRecords(normalizedRecords);
      updateRunTerminal(db, runId, 'Succeeded', processingResult);
      await persistReport(session.tenant_id, runId, processingResult);
      res.status(201).json({
        run_id: runId,
        status: 'Succeeded',
        result: processingResult,
      });
    }
  });

  // 5. GET /runs - Authenticated, lists only caller's tenant
  app.get('/runs', (req: Request, res: Response) => {
    const session = req.session!;
    const runs = listRunsByTenant(db, session.tenant_id);
    res.status(200).json({ runs });
  });

  // 6. GET /runs/:id/result - Authenticated, returns { run_id, status, result | error }
  app.get('/runs/:id/result', (req: Request, res: Response) => {
    const session = req.session!;
    const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const run = findRunById(db, session.tenant_id, runId);

    if (!run) {
      res.status(404).json({ error: 'Run not found or unauthorized.' });
      return;
    }

    if (run.status === 'Failed') {
      res.status(200).json({
        run_id: run.run_id,
        status: run.status,
        error: run.error,
      });
    } else {
      res.status(200).json({
        run_id: run.run_id,
        status: run.status,
        result: run.result,
      });
    }
  });

  return app;
}
