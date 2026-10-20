---
name: connection-report
description: Operational automation skill to deploy, verify, troubleshoot, and clean up UC-03 Connection Health Reporting SaaS on Azure Container Apps.
---

# Connection Health Reporting SaaS Operational Skill

This skill provides step-by-step instructions to deploy, verify, troubleshoot forced failures, rollback, and clean up the UC-03 Connection Health Reporting SaaS product.

## 1. Trigger
Activate this skill whenever deploying or verifying the UC-03 Connection Health SaaS, testing the connection report classification pipeline, performing disaster recovery/rollback, or cleaning up team-assigned sandbox resources.

## 2. Required Inputs
- Target environment: `dev` or `test` (defaults to `dev`).
- Azure Sandbox credentials configured (`AZURE_SUBSCRIPTION_ID`, `ARM_CLIENT_ID`, etc., or logged-in `az` session).
- Environment file: `infra/dev.tfvars` or `infra/test.tfvars`.
- Container image reference and tag (e.g., `image_tag="v0.1.0"`).

## 3. Preflight Checks
Before executing any script, ensure the following commands succeed locally:
```bash
# Verify Node.js and TypeScript environment
node -v
npm test

# Verify Terraform configuration syntax
cd infra && terraform fmt -check && cd ..
```

## 4. Deployment Instructions
Execute the deployment script providing the target container image tag and environment variables file:
```bash
# Standard Deployment
./scripts/deploy.sh v0.1.0 infra/dev.tfvars
```

### Expected Results
- Terraform initializes providers and creates exactly two resources:
  1. `azurerm_storage_container.reports_blob_container`
  2. `azurerm_container_app.app`
- Container App FQDN is outputted.
- Second `terraform plan` completes with code `0` and shows **no changes** (idempotency check passes).

## 5. Verification Instructions
Run the automated verification script against the deployed Container App endpoint:
```bash
./scripts/verify.sh https://<container_app_fqdn>
```

### Verification Checks
1. Public `/health` endpoint returns `HTTP 200` with `{"status":"ok"}`.
2. Valid fixture execution:
   ```bash
   curl -s -X POST https://<fqdn>/runs \
     -H "Authorization: Bearer token-tenant-a-operator" \
     -H "Idempotency-Key: manual-verify-1" \
     -H "Content-Type: application/json" \
     -d '{
       "operation": "validate",
       "records": [
         {"record_id":"S01","status_code":200,"latency_ms":80,"environment":"TEST"},
         {"record_id":"S02","status_code":504,"latency_ms":3000,"environment":"STAGE"}
       ]
     }'
   ```
   **Expected**: `201 Created` with `valid_rows: 2, invalid_rows: 0`.

3. Pro Process execution:
   ```bash
   curl -s -X POST https://<fqdn>/runs \
     -H "Authorization: Bearer token-tenant-a-operator" \
     -H "Idempotency-Key: manual-verify-2" \
     -H "Content-Type: application/json" \
     -d '{
       "operation": "process",
       "records": [
         {"record_id":"S01","status_code":200,"latency_ms":80,"environment":"TEST"},
         {"record_id":"S02","status_code":504,"latency_ms":3000,"environment":"STAGE"}
       ]
     }'
   ```
   **Expected**: `201 Created` with `summary: {input_rows: 2, healthy_rows: 1, other_rows: 1}` and rows classified as `HEALTHY` and `TIMEOUT`.

## 6. Troubleshooting: Injected Forced Failure Check
To verify resilience and error persistence under post-acceptance failures:
```bash
curl -s -X POST https://<fqdn>/runs \
  -H "Authorization: Bearer token-tenant-a-operator" \
  -H "Idempotency-Key: force-fail-test" \
  -H "X-Test-Force-Failure: true" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "process",
    "records": [
      {"record_id":"S01","status_code":200,"latency_ms":80,"environment":"TEST"}
    ]
  }'
```
**Expected**:
- Response returns `201 Created` with `status: "Failed"` and `error: "Processing failed: Injected test hook failure"`.
- Daily quota slot is consumed (1 run debited).
- Replaying the same key `force-fail-test` returns `200 OK` with the recorded failure without re-executing or consuming another quota slot.

## 7. Rollback Instructions
To roll back a problematic release to a known-stable image:
```bash
# Roll back by deploying the previous verified image tag
./scripts/deploy.sh v0.0.9 infra/dev.tfvars
```

## 8. Cleanup Instructions
To destroy the deployed Azure resources:
```bash
./scripts/cleanup.sh infra/dev.tfvars
```
**Safety Stop Condition**: The cleanup script demands explicit interactive input `CONFIRM-DESTROY`. Any other input aborts the teardown.
