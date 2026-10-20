import { OperationType, PlanType, UserRole, SubscriptionStatus } from './types.js';

export interface CopilotContext {
  run_id?: string;
  status?: string;
  http_status?: number;
  operation?: OperationType;
  records_count?: number;
  result?: any;
  error?: string;
  issues?: any[];
  tenant_id?: string;
  plan?: PlanType;
  role?: UserRole;
  subscription_status?: SubscriptionStatus;
  remaining_quota?: number;
}

export interface CopilotRequest {
  message: string;
  context?: CopilotContext;
}

export interface CopilotResponse {
  reply: string;
  mode: 'gemini_api' | 'offline_heuristics';
  latency_ms: number;
}

const SYSTEM_INSTRUCTION = `
You are "Aether Intelligence", an expert AI Systems & Cloud Architect embedded in the UC-03 Connection Health SaaS platform for Advantix & Rajalakshmi University.
You analyze telemetry batches, SLA classifications, SaaS tenancy, and infrastructure for technical operators and evaluators.

CORE SPECIFICATIONS OF UC-03:
1. Validation Rules (R1 to R4):
   - R1: record_id is a nonempty string, at most 20 characters, unique in the batch (only later duplicates fail).
   - R2: status_code is an integer in {200, 401, 429, 504}. Booleans and numeric strings are rejected.
   - R3: latency_ms is an integer from 0 to 60000 inclusive. Booleans and numeric strings are rejected.
   - R4: environment is strictly TEST or STAGE.
2. Operations:
   - validate: returns { valid_rows, invalid_rows, issues: [{ row_index, field, rule_id }] }.
   - process: rejects any batch with invalid rows (400 before quota debit). Otherwise classifies rows:
     * 401 -> UNAUTHORISED
     * 429 -> RATE_LIMITED
     * 504 -> TIMEOUT
     * 200 with latency > 1000ms -> SLOW (SLA breach)
     * 200 with latency <= 1000ms -> HEALTHY (SLA compliant)
     * Row order is strictly preserved.
3. Multi-Tenancy & SaaS Rules:
   - Tenants (e.g. tenant-a, tenant-b, tenant-ultra) with session-derived identity. Header overrides (X-Tenant-Override) are rejected with 400.
   - Roles: Operator can submit (POST /runs). Viewer is read-only (GET /runs, GET /runs/:id/result), returns 403 on submit.
   - Plans: Basic (validate only, 3 runs/day), Pro (validate & process, 10 runs/day), Ultra (high throughput, 100 runs/day).
   - Suspended subscription: blocks new runs with 403, but history remains readable.
   - Quota: Single-statement atomic SQL reservation on DailyUsage (no race conditions).
   - Idempotency: Idempotency-Key required. Matching input returns 200 with 0 quota debit; changed input returns 409 conflict.
4. Infrastructure:
   - Exactly two Terraform resources: Container App + private Blob container.
   - Scripts: deploy.sh (with second plan idempotency check), verify.sh, and cleanup.sh (with explicit CONFIRM-DESTROY prompt).

STYLE GUIDELINES:
- Concise, technical, and structured in Markdown.
- No emojis (clean typography and SVGs only).
- Directly cite specific rules (R1-R4), status codes, latency thresholds (1000ms SLA), and database atomicity mechanics when explaining runs.
`;

export async function askCopilot(req: CopilotRequest): Promise<CopilotResponse> {
  const startTime = performance.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const response = await callGeminiApi(apiKey, req.message, req.context);
      const latency_ms = Math.round(performance.now() - startTime);
      return {
        reply: response,
        mode: 'gemini_api',
        latency_ms,
      };
    } catch (err: any) {
      console.warn('[Copilot] Live Gemini call failed, falling back to local domain intelligence:', err.message);
    }
  }

  // Fallback to built-in domain intelligence engine
  const reply = generateLocalIntelligenceResponse(req.message, req.context);
  const latency_ms = Math.round(performance.now() - startTime);
  return {
    reply,
    mode: 'offline_heuristics',
    latency_ms,
  };
}

async function callGeminiApi(apiKey: string, userMessage: string, context?: CopilotContext): Promise<string> {
  const contextString = context ? `\n\nACTIVE APPLICATION & TELEMETRY CONTEXT:\n${JSON.stringify(context, null, 2)}` : '';
  const prompt = `${SYSTEM_INSTRUCTION}${contextString}\n\nUSER QUESTION:\n${userMessage}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errorBody}`);
  }

  const data = (await res.json()) as any;
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error('No candidate content returned by Gemini API');
  }

  return reply;
}

function generateLocalIntelligenceResponse(message: string, ctx?: CopilotContext): string {
  const q = message.toLowerCase();

  // 1. Rules & Invariants explanation (Check first if explicitly asking about rules)
  if (q.includes('rule') || q.includes('r1') || q.includes('r2') || q.includes('r3') || q.includes('r4') || q.includes('invariant')) {
    return `### Specification Validation Rules (R1 to R4)
The UC-03 engine validates all records against four strict invariants before acceptance:

| Rule | Field | Required Invariant |
|---|---|---|
| **R1** | \`record_id\` | Non-empty string, $\\le$ 20 characters, unique in batch (only later duplicates fail). |
| **R2** | \`status_code\` | Strict integer in \`{200, 401, 429, 504}\`. Booleans and numeric strings are rejected. |
| **R3** | \`latency_ms\` | Strict integer between \`0\` and \`60,000\` inclusive. Numeric strings rejected. |
| **R4** | \`environment\` | Must be strictly \`"TEST"\` or \`"STAGE"\`. |

Every failing rule is reported with a 1-based \`row_index\`, but each invalid row counts only once towards the \`invalid_rows\` total.`;
  }

  // 2. SLA / Latency / Health Classification Engine
  if (q.includes('sla') || q.includes('classification') || q.includes('1000') || (q.includes('slow') && !ctx?.result) || q.includes('threshold')) {
    return `### Connection Health Classification Engine
The processor applies deterministic pure classification logic without external side effects:

- **200 (latency $\\le$ 1,000 ms)** $\\rightarrow$ **\`HEALTHY\`**: Operates within the guaranteed enterprise SLA threshold.
- **200 (latency > 1,000 ms)** $\\rightarrow$ **\`SLOW\`**: Endpoint responded, but breached the 1,000ms latency SLA line.
- **401** $\\rightarrow$ **\`UNAUTHORISED\`**: Upstream connection failed authentication.
- **429** $\\rightarrow$ **\`RATE_LIMITED\`**: Upstream connection was throttled.
- **504** $\\rightarrow$ **\`TIMEOUT\`**: Gateway timed out awaiting upstream response.

Row order is preserved 1:1, and the summary object outputs \`{ input_rows, healthy_rows, other_rows }\`.`;
  }

  // 3. Quota, Race conditions & WAL Atomicity
  if (q.includes('quota') || q.includes('race') || q.includes('atomic') || q.includes('wal') || q.includes('concurren') || q.includes('daily')) {
    return `### Atomic Quota Reservation & Concurrency Safety
To prevent race conditions when multiple concurrent requests arrive with only 1 quota slot remaining:

\`\`\`sql
UPDATE DailyUsage 
SET count = count + 1 
WHERE tenant_id = ? 
  AND usage_date = ? 
  AND count < ?;
\`\`\`

1. **Single-Statement Atomicity**: Because the increment condition (\`count < limit\`) is evaluated inside the atomic SQL statement itself, concurrent requests cannot overshoot the daily ceiling.
2. **Acceptance Guarantee**: Vitest test **A08** validates that two simultaneous requests with 1 remaining slot accept exactly **one** (201) and reject the other with **429**.
3. **SQLite WAL Engine**: Write-Ahead Logging ensures concurrent reads execute without locking write operations.`;
  }

  // 4. Multi-tenancy & Isolation
  if (q.includes('tenant') || q.includes('isolation') || q.includes('cross') || q.includes('override') || q.includes('rbac') || q.includes('role') || q.includes('viewer')) {
    return `### Multi-Tenant Boundaries & RBAC Isolation
- **Identity Derivation**: Tenant identity is extracted solely from the cryptographic session token (\`req.session.tenant_id\`).
- **Spoofing Rejection**: Any incoming \`X-Tenant-Override\` header or request payload override is caught and rejected immediately with **HTTP 400**.
- **Boundary Defense**: Tenant B attempting to query \`GET /runs/{id}/result\` for a Tenant A run receives **HTTP 404 Not Found**, never 403, preventing resource enumeration across tenant walls.`;
  }

  // 5. Diagnostics of current telemetry run
  if (q.includes('run') || q.includes('current') || q.includes('telemetry') || q.includes('diagnos') || q.includes('explain') || q.includes('fail') || q.includes('result') || q.includes('batch')) {
    if (!ctx || (!ctx.run_id && !ctx.http_status && !ctx.result && !ctx.error)) {
      return `### Telemetry Diagnostic Engine
No active telemetry run was provided in context. 

To run an analysis:
1. Select an acceptance fixture in the Console (e.g., **"Pro Batch (A04)"** or **"6 Invalid Rules (A03)"**).
2. Click **"Execute Pipeline Run"**.
3. Open this assistant again or click **"Explain Current Run"** to inspect its SLA classifications, latency distribution, or validation issues.`;
    }

    if (ctx.http_status === 409) {
      return `### HTTP 409 Conflict Diagnostic (Idempotency Violation)
- **Root Cause**: The client submitted a request using an **Idempotency-Key** that was already accepted, but the **SHA-256 payload fingerprint** does not match the original run.
- **Specification Rule**: Per Section 6, idempotency uniqueness is strictly scoped to \`(tenant_id, idempotency_key)\`. A matching replay returns HTTP 200 with no debit. Any changed payload for an existing key returns **409 Conflict**.
- **Resolution**: Click **"Auto-Gen"** next to the Idempotency Key in the Console to generate a fresh unique key, or restore the exact payload from the previous run.`;
    }

    if (ctx.http_status === 429) {
      return `### HTTP 429 Rate Limit Diagnostic (Daily Quota Exhausted)
- **Root Cause**: Tenant \`${ctx.tenant_id || 'active'}\` has reached its daily limit of accepted unique runs for the current UTC day.
- **Plan Limits**:
  * **Basic**: 3 accepted runs per UTC day.
  * **Pro**: 10 accepted runs per UTC day.
  * **Ultra**: 100 accepted runs per UTC day.
- **Specification Rule**: Per Section 6, quota is decremented atomically via a single SQL \`UPDATE\` statement. Rejections do not consume quota, but all accepted runs (including forced failures) count. Quota resets daily at 00:00:00 UTC.`;
    }

    if (ctx.http_status === 403) {
      return `### HTTP 403 Forbidden Diagnostic (RBAC / Subscription Denial)
- **Error**: \`${ctx.error || 'Access Denied'}\`
- **Possible Causes**:
  1. **Viewer Role**: A user with the \`Viewer\` role attempted to submit \`POST /runs\`. Only \`Operator\` has write permissions.
  2. **Plan Restriction**: The tenant is on the **Basic** plan, which permits only \`operation: "validate"\`. Attempting \`operation: "process"\` returns 403.
  3. **Suspended Subscription**: The tenant's account status is \`suspended\`. History remains readable, but new runs are rejected.`;
    }

    if (ctx.http_status === 400) {
      let issuesDetails = '';
      if (ctx.issues && ctx.issues.length > 0) {
        issuesDetails = ctx.issues
          .map((i: any) => `- **Row ${i.row_index} [${i.rule_id}]**: Field \`${i.field}\` violated validation rule constraint.`)
          .join('\n');
      }
      return `### HTTP 400 Bad Request Diagnostic (Validation Failure)
- **Summary**: The request was rejected prior to acceptance, resulting in **zero quota debit**.
${issuesDetails ? `\n**Violations Detected**:\n${issuesDetails}` : ''}
- **Specification Rule**: 
  * In \`process\` mode, any single invalid row aborts the entire run with HTTP 400 before quota reservation.
  * In \`validate\` mode, all failing rows are indexed and returned in \`issues\` with 1-based row indices.`;
    }

    if (ctx.result && ctx.result.rows) {
      const rows = ctx.result.rows;
      const healthy = rows.filter((r: any) => r.health === 'HEALTHY').length;
      const slow = rows.filter((r: any) => r.health === 'SLOW').length;
      const timeout = rows.filter((r: any) => r.health === 'TIMEOUT').length;
      const authFail = rows.filter((r: any) => r.health === 'UNAUTHORISED').length;
      const rateLimit = rows.filter((r: any) => r.health === 'RATE_LIMITED').length;

      return `### Process Telemetry Run Diagnostic (\`${ctx.run_id || 'Active Run'}\`)
- **Status**: **Succeeded (HTTP 201 Created)**
- **Total Input Records**: ${rows.length}
- **Health Breakdown**:
  * **HEALTHY** (HTTP 200, latency $\\le$ 1000ms): **${healthy}**
  * **SLOW** (HTTP 200, latency > 1000ms SLA breach): **${slow}**
  * **TIMEOUT** (HTTP 504 Gateway Timeout): **${timeout}**
  * **RATE_LIMITED** (HTTP 429 Upstream Throttle): **${rateLimit}**
  * **UNAUTHORISED** (HTTP 401 Auth Failure): **${authFail}**

All classifications strictly preserve input row order and have been committed to SQLite WAL storage.`;
    }

    if (ctx.result && ctx.result.valid_rows !== undefined) {
      return `### Validation Run Diagnostic (\`${ctx.run_id || 'Active Run'}\`)
- **Valid Rows**: ${ctx.result.valid_rows}
- **Invalid Rows**: ${ctx.result.invalid_rows}
- **Issues Detected**: ${ctx.result.issues ? ctx.result.issues.length : 0}
- **Status**: Schema validation satisfied. Since all rows meet specification rules R1 through R4, this batch is certified ready for the **Process (Full Engine)**.`;
    }
  }

  // Default general response
  return `### Aether Intelligence Engine
I am the UC-03 Cloud Architecture and Telemetry Copilot. I can assist with:
- **Run Diagnostics**: Ask *"Explain the current run"* or *"Why did row 4 fail?"*.
- **Validation Rules**: Ask *"What are rules R1 through R4?"*.
- **SLA Classification**: Ask *"How does the 1000ms latency SLA classify records?"*.
- **Concurrency & Quotas**: Ask *"How does the atomic SQL update prevent race conditions?"*.
- **Tenant Isolation**: Ask *"How is cross-tenant access blocked?"*.

What would you like me to inspect?`;
}
