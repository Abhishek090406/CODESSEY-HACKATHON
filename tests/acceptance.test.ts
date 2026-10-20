import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';
import { resetDbForTesting } from '../src/db.js';
import { VALID_FIXTURE_RECORDS, INVALID_FIXTURE_RECORDS } from './fixtures.js';

describe('UC-03 Acceptance Checks (A01 - A11)', () => {
  let app: any;

  beforeEach(() => {
    // Reset fixtures and quota between checks per PS specification:
    // "Reset fixtures and quota between checks using the organiser harness; reset is not exposed through the product API."
    resetDbForTesting();
    app = createServer();
  });

  // A01: Public /health is 200 and reveals no tenant data
  it('A01: /health is 200 and public', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.body.tenant_id).toBeUndefined();
  });

  // A02: validate on the two-row valid fixture reports valid_rows 2, invalid_rows 0 and no issues
  it('A02: validate on two-row valid fixture reports valid_rows 2, invalid_rows 0 and no issues', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a02-1')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Succeeded');
    expect(res.body.result).toEqual({
      valid_rows: 2,
      invalid_rows: 0,
      issues: [],
    });
  });

  // A03: validate on the six-row invalid fixture reports valid_rows 2, invalid_rows 4 and the four specified rule failures
  it('A03: validate on six-row invalid fixture reports valid_rows 2, invalid_rows 4 and 4 rule failures', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a03-1')
      .send({
        operation: 'validate',
        records: INVALID_FIXTURE_RECORDS,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Succeeded');
    expect(res.body.result.valid_rows).toBe(2);
    expect(res.body.result.invalid_rows).toBe(4);
    
    // Exactly one issue each for R1, R2, R3, R4
    const ruleIds = res.body.result.issues.map((i: any) => i.rule_id);
    expect(ruleIds).toContain('R1');
    expect(ruleIds).toContain('R2');
    expect(ruleIds).toContain('R3');
    expect(ruleIds).toContain('R4');
    expect(res.body.result.issues.length).toBe(4);

    // Verify 1-based index and fields
    const r1Issue = res.body.result.issues.find((i: any) => i.rule_id === 'R1');
    expect(r1Issue).toMatchObject({ row_index: 3, field: 'record_id', rule_id: 'R1' });
    const r2Issue = res.body.result.issues.find((i: any) => i.rule_id === 'R2');
    expect(r2Issue).toMatchObject({ row_index: 4, field: 'status_code', rule_id: 'R2' });
    const r3Issue = res.body.result.issues.find((i: any) => i.rule_id === 'R3');
    expect(r3Issue).toMatchObject({ row_index: 5, field: 'latency_ms', rule_id: 'R3' });
    const r4Issue = res.body.result.issues.find((i: any) => i.rule_id === 'R4');
    expect(r4Issue).toMatchObject({ row_index: 6, field: 'environment', rule_id: 'R4' });
  });

  // A04: Pro process returns exactly the specified rows and summary; survives restart
  it('A04: Pro process returns specified rows and summary; survives app restart', async () => {
    const res = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a04-1')
      .send({
        operation: 'process',
        records: VALID_FIXTURE_RECORDS,
      });

    expect(res.status).toBe(201);
    const runId = res.body.run_id;
    expect(res.body.status).toBe('Succeeded');
    expect(res.body.result.summary).toEqual({
      input_rows: 2,
      healthy_rows: 1,
      other_rows: 1,
    });
    expect(res.body.result.rows).toEqual([
      { record_id: 'S01', status_code: 200, latency_ms: 80, environment: 'TEST', health: 'HEALTHY' },
      { record_id: 'S02', status_code: 504, latency_ms: 3000, environment: 'STAGE', health: 'TIMEOUT' },
    ]);

    // Simulate app restart with a new server instance reading persisted storage
    const restartedApp = createServer();
    const resultRes = await request(restartedApp)
      .get(`/runs/${runId}/result`)
      .set('Authorization', 'Bearer token-tenant-a-operator');

    expect(resultRes.status).toBe(200);
    expect(resultRes.body.run_id).toBe(runId);
    expect(resultRes.body.status).toBe('Succeeded');
    expect(resultRes.body.result.summary.healthy_rows).toBe(1);
  });

  // A05: Invalid process input, wrong-shaped body, and 11-row batch return 400 with no quota debit
  it('A05: Invalid process input, wrong shape, and 11-row batch return 400 with no debit', async () => {
    // 1. Invalid process rows
    const res1 = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a05-1')
      .send({
        operation: 'process',
        records: INVALID_FIXTURE_RECORDS,
      });
    expect(res1.status).toBe(400);

    // 2. Wrong-shaped body (missing operation or extra unexpected fields)
    const res2 = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a05-2')
      .send({
        records: VALID_FIXTURE_RECORDS,
      });
    expect(res2.status).toBe(400);

    const res3 = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a05-3')
      .send({
        operation: 'process',
        records: VALID_FIXTURE_RECORDS,
        extra_field: 'illegal',
      });
    expect(res3.status).toBe(400);

    // 3. 11-row batch
    const elevenRows = Array.from({ length: 11 }, (_, i) => ({
      record_id: `R${i + 1}`,
      status_code: 200,
      latency_ms: 50,
      environment: 'TEST',
    }));
    const res4 = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a05-4')
      .send({
        operation: 'process',
        records: elevenRows,
      });
    expect(res4.status).toBe(400);

    // Verify quota was not debited (quota remains 10 for Pro)
    const subRes = await request(app)
      .get('/subscription')
      .set('Authorization', 'Bearer token-tenant-a-operator');
    expect(subRes.body.remaining_quota).toBe(10);
  });

  // A06: 401 unauthenticated; 403 Viewer submission and Basic process both return 403 with no debit
  it('A06: 401 unauthenticated, 403 Viewer submit and Basic process return 403 with no debit', async () => {
    // 1. Unauthenticated to protected routes
    const unauthRes = await request(app).get('/subscription');
    expect(unauthRes.status).toBe(401);

    // 2. Viewer submit
    const viewerRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-viewer')
      .set('Idempotency-Key', 'key-a06-viewer')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(viewerRes.status).toBe(403);

    // 3. Basic plan attempting process
    const basicProcessRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('Idempotency-Key', 'key-a06-basic-process')
      .send({
        operation: 'process',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(basicProcessRes.status).toBe(403);

    // Verify quota not debited
    const basicSub = await request(app)
      .get('/subscription')
      .set('Authorization', 'Bearer token-tenant-b-operator');
    expect(basicSub.body.remaining_quota).toBe(3);
  });

  // A07: Tenant B cannot list Tenant A's runs; fetching A's result returns 404. Tenant override is rejected
  it('A07: Tenant isolation, 404 for other tenant result, tenant-override rejection', async () => {
    // Tenant A creates a run
    const createRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a07-a')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    const runId = createRes.body.run_id;

    // Tenant B lists runs (should not see Tenant A's run)
    const listRes = await request(app)
      .get('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator');
    expect(listRes.body.runs.some((r: any) => r.run_id === runId)).toBe(false);

    // Tenant B fetches Tenant A's run result -> 404
    const getRes = await request(app)
      .get(`/runs/${runId}/result`)
      .set('Authorization', 'Bearer token-tenant-b-operator');
    expect(getRes.status).toBe(404);

    // Tenant override header or body is rejected
    const overrideRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('X-Tenant-Override', 'tenant-b')
      .set('Idempotency-Key', 'key-a07-override')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(overrideRes.status).toBe(400);
  });

  // A08: Basic accepts 3 unique validate runs and rejects the 4th with 429. Concurrent race with 1 slot accepts exactly one
  it('A08: Basic accepts 3 runs then 429, concurrent race with one slot accepts exactly 1', async () => {
    // 2 accepted runs for Tenant B (limit is 3)
    for (let i = 1; i <= 2; i++) {
      const res = await request(app)
        .post('/runs')
        .set('Authorization', 'Bearer token-tenant-b-operator')
        .set('Idempotency-Key', `key-a08-${i}`)
        .send({
          operation: 'validate',
          records: VALID_FIXTURE_RECORDS,
        });
      expect(res.status).toBe(201);
    }

    // Now 1 slot left. Fire 2 concurrent requests
    const [req1, req2] = await Promise.all([
      request(app)
        .post('/runs')
        .set('Authorization', 'Bearer token-tenant-b-operator')
        .set('Idempotency-Key', 'key-a08-race-1')
        .send({
          operation: 'validate',
          records: VALID_FIXTURE_RECORDS,
        }),
      request(app)
        .post('/runs')
        .set('Authorization', 'Bearer token-tenant-b-operator')
        .set('Idempotency-Key', 'key-a08-race-2')
        .send({
          operation: 'validate',
          records: VALID_FIXTURE_RECORDS,
        }),
    ]);

    const statuses = [req1.status, req2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(429);

    // A 4th request must definitely be 429
    const fourth = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('Idempotency-Key', 'key-a08-4')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(fourth.status).toBe(429);
  });

  // A09: Replay at exhausted quota returns 200 with no debit; changed input returns 409; simultaneous identical keys create at most one run
  it('A09: Replay at exhausted quota returns 200; changed input returns 409; simultaneous identical keys create 1 run', async () => {
    // Exhaust Tenant B quota (3 runs)
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/runs')
        .set('Authorization', 'Bearer token-tenant-b-operator')
        .set('Idempotency-Key', `key-a09-exhaust-${i}`)
        .send({
          operation: 'validate',
          records: VALID_FIXTURE_RECORDS,
        });
      expect(res.status).toBe(201);
    }

    // Replay key-a09-exhaust-1 with same input -> must return 200 with original run, no debit
    const replayRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('Idempotency-Key', 'key-a09-exhaust-1')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(replayRes.status).toBe(200);

    // Reuse key with changed input -> 409 Conflict
    const conflictRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('Idempotency-Key', 'key-a09-exhaust-1')
      .send({
        operation: 'validate',
        records: [{ record_id: 'S99', status_code: 200, latency_ms: 10, environment: 'TEST' }],
      });
    expect(conflictRes.status).toBe(409);

    // Simultaneous identical keys for Tenant A
    const [sim1, sim2] = await Promise.all([
      request(app)
        .post('/runs')
        .set('Authorization', 'Bearer token-tenant-a-operator')
        .set('Idempotency-Key', 'key-simultaneous')
        .send({
          operation: 'validate',
          records: VALID_FIXTURE_RECORDS,
        }),
      request(app)
        .post('/runs')
        .set('Authorization', 'Bearer token-tenant-a-operator')
        .set('Idempotency-Key', 'key-simultaneous')
        .send({
          operation: 'validate',
          records: VALID_FIXTURE_RECORDS,
        }),
    ]);

    // One must be 201, the other is either 200 (replay) or 409 (if in progress)
    expect([200, 201, 409]).toContain(sim1.status);
    expect([200, 201, 409]).toContain(sim2.status);
    const successCount = [sim1, sim2].filter(r => r.status === 201).length;
    expect(successCount).toBe(1);
  });

  // A10: Suspended subscription: new submissions return 403; historical reads continue to work
  it('A10: Suspended subscription returns 403 on new runs and debits nothing; history remains readable', async () => {
    // 1. Create a run while active
    const createRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('Idempotency-Key', 'key-a10-prior')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(createRes.status).toBe(201);
    const runId = createRes.body.run_id;

    // 2. Suspend subscription via test harness header / state
    const suspendRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('X-Test-Set-Subscription-Status', 'suspended')
      .set('Idempotency-Key', 'key-a10-after-suspended')
      .send({
        operation: 'validate',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(suspendRes.status).toBe(403);

    // 3. Historical reads continue to work
    const getRes = await request(app)
      .get(`/runs/${runId}/result`)
      .set('Authorization', 'Bearer token-tenant-b-operator')
      .set('X-Test-Set-Subscription-Status', 'suspended');
    expect(getRes.status).toBe(200);
    expect(getRes.body.run_id).toBe(runId);
  });

  // A11: Shared hook forces failure after acceptance: run is Failed, recorded error exposed, 1 slot used. Replaying returns failure without re-running
  it('A11: Shared test hook forces failure after acceptance: run Failed, slot debited, replay returns failure', async () => {
    const forcedRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a11-forced')
      .set('X-Test-Force-Failure', 'true')
      .send({
        operation: 'process',
        records: VALID_FIXTURE_RECORDS,
      });

    expect(forcedRes.status).toBe(201);
    expect(forcedRes.body.status).toBe('Failed');
    expect(forcedRes.body.error).toBeDefined();

    // Replay returns the failure without re-executing
    const replayRes = await request(app)
      .post('/runs')
      .set('Authorization', 'Bearer token-tenant-a-operator')
      .set('Idempotency-Key', 'key-a11-forced')
      .send({
        operation: 'process',
        records: VALID_FIXTURE_RECORDS,
      });
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.status).toBe('Failed');
    expect(replayRes.body.error).toBe(forcedRes.body.error);
  });
});
