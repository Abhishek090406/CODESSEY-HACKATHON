# Azure Deployment & Live Application Verification Document

**Project:** UC-03: Connection Health Reporting SaaS (AetherHealth)
**Challenge:** Advantix & Rajalakshmi University Campus Hiring Challenge
**Team / Repository:** Abhishek090406/CODESSEY-HACKATHON
**Date:** October 21, 2026
**Status:** ACTIVE & RUNNING (Verified)

## 1. Live Application & UI URLs

| Endpoint | URL | Description / Status |
|---|---|---|
| Live Azure Application FQDN | https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/ | AetherHealth running on Azure Container Apps (HTTP 200 OK) |
| Azure Health Endpoint | https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/health | Container App public health route |
| Local Interactive Web UI | http://localhost:3000 | Full-stack interactive telemetry workbench, live charts & inspector |

## 2. Deployed Commit & Container Image Information

| Parameter | Value |
|---|---|
| Git Repository | https://github.com/Abhishek090406/CODESSEY-HACKATHON.git |
| Active Git Branch | main |
| Image Built From Commit | 14d460b (ci: GitHub Actions workflow that builds and pushes the container image) |
| Application Commit | c3bb873 (fix(infra): update azurerm provider version and lifecycle ignore rules for idempotency) |
| Previous Feature Commit | 01b5892 (feat: complete UC-03 connection health reporting SaaS implementation with tests, infra, and copilot) |
| Azure Container Image | ghcr.io/abhishek090406/aetherhealth |
| Container Image Tag | latest (also tagged with the commit SHA) |
| Image Build | GitHub Actions workflow `build-and-push`, multi-stage Dockerfile (Node 22 Alpine) |
| Target Port | 3000 (HTTP Ingress external enabled) |

### Build and Deployment Flow

1. Code is pushed to the `main` branch on GitHub.
2. The GitHub Actions workflow `build-and-push` builds the Docker image from the repository Dockerfile.
3. The image is published to the public GitHub Container Registry as `ghcr.io/abhishek090406/aetherhealth`.
4. The Azure Container App `uc03-connection-health-dev` pulls this image and serves it through external HTTPS ingress on port 3000.

### Runtime Configuration (Container App Environment Variables)

| Variable | Purpose |
|---|---|
| PORT | Application listen port (3000) |
| NODE_ENV | Runtime mode (production) |
| COMMIT_SHA | Git commit the running image was built from |
| REPORTS_CONTAINER | Blob container for generated reports (connection-reports-dev) |
| AZURE_STORAGE_CONNECTION_STRING | Access to the storage account (secret, value not shown) |

Scaling: 1 replica (min 1, max 1) so the application is always available and SQLite state stays consistent.

## 3. Azure Resource Names & Provisioning Status

All infrastructure is provisioned strictly in the Central India region under resource group `rg-codessey-dev`:

| Azure Resource Name | Resource Type | Location | Provisioning State | Running Status |
|---|---|---|---|---|
| uc03-connection-health-dev | Microsoft.App/containerApps | Central India | Succeeded | Running |
| cae-codessey-dev | Microsoft.App/managedEnvironments | Central India | Succeeded | Active |
| stcodesseydev0904 | Microsoft.Storage/storageAccounts | Central India | Succeeded | Active |
| connection-reports-dev | Private Blob Storage Container | Central India | Succeeded | Private |
| law-codessey-dev | Microsoft.OperationalInsights/workspaces | Central India | Succeeded | Active |

**Azure Resource Group Details:**

- Subscription ID: 0b1fb619-8b2d-4ed5-9da7-972cc66bbff5
- Resource Group: rg-codessey-dev
- Managed Container App ID: /subscriptions/0b1fb619-8b2d-4ed5-9da7-972cc66bbff5/resourceGroups/rg-codessey-dev/providers/Microsoft.App/containerApps/uc03-connection-health-dev
- Blob Storage ID: https://stcodesseydev0904.blob.core.windows.net/connection-reports-dev

**Azure Portal Verification Screenshots:**

![Azure Portal - Resource Group rg-codessey-dev](evidence/azure-portal-resource-group.png)

![Azure Portal - Container App running the AetherHealth image from ghcr.io](evidence/container-app-image.png)

## 4. Test Login Details & Tenant Credentials

The SaaS platform features a multi-tenant isolation model with seeded accounts across Pro, Basic, and Suspended plans. Evaluators can log into the UI or supply the bearer token in API requests:

| Tenant / Company | Plan & Status | Role | Email | Password | Session Token (Bearer) | Capabilities |
|---|---|---|---|---|---|---|
| Tenant A, Acme Cloud Dynamics | Pro (Active) | Operator | operator@tenanta.com | Password123! | token-tenant-a-operator | Full execution: validate, process, quota view, SLA Copilot |
| Tenant A, Acme Cloud Dynamics | Pro (Active) | Viewer | viewer@tenanta.com | Password123! | token-tenant-a-viewer | Read-only audit access (cannot submit new runs) |
| Tenant B, BetaLabs Research | Basic (Active) | Operator | operator@tenantb.com | Password123! | token-tenant-b-operator | Validate runs (limit: 3 runs/day); process blocked with 403 |
| Tenant B, BetaLabs Research | Basic (Active) | Viewer | viewer@tenantb.com | Password123! | token-tenant-b-viewer | Read-only audit access |
| Tenant C, Omega Systems | Basic (Suspended) | Operator | operator@tenantc.com | Password123! | token-tenant-c-suspended | Historical reads only; all new run submissions blocked (403) |
| Tenant Ultra, Nexus Global | Ultra (Active) | Operator | operator@ultra.com | Password123! | token-tenant-ultra-operator | Enterprise SLA Tier |

## 5. Brief Running & Verification Steps

### Option A: Verify Live Azure Deployment via Azure CLI / cURL

```bash
# 1. Verify the Azure Container App is in 'Running' status and see which image it runs:
az containerapp show \
  --name uc03-connection-health-dev \
  --resource-group rg-codessey-dev \
  --query "{name:name, status:properties.runningStatus, provisioning:properties.provisioningState, image:properties.template.containers[0].image, fqdn:properties.configuration.ingress.fqdn}" \
  -o table

# 2. Query the live public endpoints:
curl -I https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/
curl https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/health
```

### Option B: Run the Full Application & Interactive Console Locally (< 60 Seconds)

```bash
# Step 1: Install dependencies
npm install

# Step 2: Run the automated acceptance test suite (A01 - A11)
npm test

# Step 3: Start the local server and web console
npm run dev
```

Open http://localhost:3000 in your browser.
Log in with operator@tenanta.com / Password123! to access the live dashboard, trigger telemetry runs, and explore the database health monitor and SLA Copilot.

### Option C: Re-deploy or Check Terraform Idempotency

```bash
# Run the deployment and idempotency check script
./scripts/deploy.sh latest infra/dev.tfvars
```

The script applies the configuration and verifies that a second plan outputs zero changes (idempotency requirement).
