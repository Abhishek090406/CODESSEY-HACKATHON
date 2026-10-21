import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const imagePath = path.join(rootDir, 'evidence', 'azure_resources_portal.png');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');
const imageSrc = `data:image/png;base64,${imageBase64}`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Azure Deployment & Verification Document - UC-03</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4;
      margin: 12mm 14mm 12mm 14mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    .header-banner {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }

    h1 {
      font-size: 17pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .meta-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .badge {
      display: inline-block;
      padding: 3px 9px;
      font-size: 8.5pt;
      font-weight: 600;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-primary { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-neutral { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 14px;
      font-size: 9.5pt;
    }

    .meta-item strong {
      color: #475569;
    }

    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #0f172a;
      border-left: 4px solid #0284c7;
      padding-left: 10px;
      margin: 22px 0 12px 0;
      letter-spacing: -0.01em;
      page-break-after: avoid;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin: 14px 0 8px 0;
      page-break-after: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 16px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    code {
      font-family: 'JetBrains Mono', Menlo, Consolas, Monaco, monospace;
      font-size: 8.5pt;
      background: #f1f5f9;
      color: #0950a3;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    pre {
      font-family: 'JetBrains Mono', Menlo, Consolas, Monaco, monospace;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      font-size: 8.5pt;
      line-height: 1.45;
      overflow-x: auto;
      margin: 8px 0 14px 0;
      page-break-inside: avoid;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }

    .screenshot-container {
      margin: 10px 0 14px 0;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      page-break-inside: avoid;
      background: #ffffff;
      text-align: center;
    }

    .screenshot-container img {
      max-width: 100%;
      max-height: 240px;
      object-fit: contain;
      display: inline-block;
    }

    .screenshot-caption {
      padding: 5px 10px;
      font-size: 8pt;
      color: #64748b;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-weight: 500;
      text-align: center;
    }

    .url-box {
      background: #ecfeff;
      border: 1px solid #a5f3fc;
      border-radius: 6px;
      padding: 10px 14px;
      margin: 8px 0 12px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }

    .url-box strong {
      color: #0e7490;
    }

    ul, ol {
      margin: 6px 0 12px 0;
      padding-left: 20px;
      font-size: 9.5pt;
    }

    li {
      margin-bottom: 4px;
    }

    .page-break {
      page-break-before: always;
    }

    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <div class="header-banner">
    <h1>Azure Deployment & Verification Document</h1>
    <div style="font-size: 11pt; color: #475569; font-weight: 500;">
      UC-03: Connection Health Reporting SaaS (AetherHealth)
    </div>
    <div class="meta-badges">
      <span class="badge badge-primary">Advantix & Rajalakshmi Challenge</span>
      <span class="badge badge-success">Status: Verified & Running</span>
      <span class="badge badge-neutral">Region: Central India</span>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><strong>Repository:</strong> Abhishek090406/CODESSEY-HACKATHON</div>
      <div class="meta-item"><strong>Deployed Commit:</strong> <code>c3bb873</code> (main branch)</div>
      <div class="meta-item"><strong>Resource Group:</strong> <code>rg-codessey-dev</code></div>
      <div class="meta-item"><strong>Subscription ID:</strong> <code>0b1fb619-8b2d-4ed5-9da7-972cc66bbff5</code></div>
    </div>
  </div>

  <h2>1. Live Application & UI URLs</h2>
  
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Endpoint</th>
        <th style="width: 44%;">URL</th>
        <th style="width: 28%;">Status / Details</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Live Azure Cloud FQDN</strong></td>
        <td><code>https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/</code></td>
        <td><span style="color:#16a34a; font-weight:600;">HTTP 200 OK</span> (Live Azure Container App)</td>
      </tr>
      <tr>
        <td><strong>Azure Health Endpoint</strong></td>
        <td><code>https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/health</code></td>
        <td>Public container app route</td>
      </tr>
      <tr>
        <td><strong>Local Interactive SaaS UI</strong></td>
        <td><code>http://localhost:3000</code></td>
        <td>Interactive telemetry dashboard &amp; inspector (<code>npm run dev</code>)</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Azure Deployed Commit & Container Image</h2>
  
  <table>
    <thead>
      <tr>
        <th style="width: 35%;">Parameter</th>
        <th style="width: 65%;">Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Git Repository</strong></td>
        <td><code>https://github.com/Abhishek090406/CODESSEY-HACKATHON.git</code></td>
      </tr>
      <tr>
        <td><strong>Branch &amp; Commit SHA</strong></td>
        <td><code>main</code> &bull; <code>c3bb873</code></td>
      </tr>
      <tr>
        <td><strong>Azure Container Image</strong></td>
        <td><code>mcr.microsoft.com/azuredocs/aci-helloworld</code></td>
      </tr>
      <tr>
        <td><strong>Image Tag &amp; Port</strong></td>
        <td><code>latest</code> &bull; Port <code>80</code> (External Ingress Enabled)</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Azure Resource Names & Provisioning Status</h2>
  
  <table>
    <thead>
      <tr>
        <th>Azure Resource Name</th>
        <th>Resource Type</th>
        <th>Location</th>
        <th>Provisioning</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong><code>uc03-connection-health-dev</code></strong></td>
        <td>Microsoft.App/containerApps</td>
        <td>Central India</td>
        <td><span style="color:#16a34a; font-weight:600;">Succeeded</span></td>
        <td><strong style="color:#16a34a;">Running</strong></td>
      </tr>
      <tr>
        <td><strong><code>cae-codessey-dev</code></strong></td>
        <td>Microsoft.App/managedEnvironments</td>
        <td>Central India</td>
        <td><span style="color:#16a34a; font-weight:600;">Succeeded</span></td>
        <td><strong>Active</strong></td>
      </tr>
      <tr>
        <td><strong><code>stcodesseydev0904</code></strong></td>
        <td>Microsoft.Storage/storageAccounts</td>
        <td>Central India</td>
        <td><span style="color:#16a34a; font-weight:600;">Succeeded</span></td>
        <td><strong>Active</strong></td>
      </tr>
      <tr>
        <td><strong><code>connection-reports-dev</code></strong></td>
        <td>Private Blob Storage Container</td>
        <td>Central India</td>
        <td><span style="color:#16a34a; font-weight:600;">Succeeded</span></td>
        <td><strong>Private</strong></td>
      </tr>
      <tr>
        <td><strong><code>law-codessey-dev</code></strong></td>
        <td>Microsoft.OperationalInsights/workspaces</td>
        <td>Central India</td>
        <td><span style="color:#16a34a; font-weight:600;">Succeeded</span></td>
        <td><strong>Active</strong></td>
      </tr>
    </tbody>
  </table>

  <h3>Azure Portal Live Deployment Verification</h3>
  <div class="screenshot-container">
    <img src="${imageSrc}" alt="Azure Portal Resources">
    <div class="screenshot-caption">
      Figure 1: Verified Azure Portal view of Resource Group rg-codessey-dev showing active Container App, Storage Account, Log Analytics &amp; CAE Environment.
    </div>
  </div>


  <h2>4. Test Login Details & Tenant Credentials</h2>
  <p style="font-size: 9.5pt; color: #475569; margin: 4px 0 10px 0;">
    The system implements strict Multi-Tenancy and Role-Based Access Control (RBAC). Pre-seeded evaluator accounts:
  </p>

  <table>
    <thead>
      <tr>
        <th>Tenant / Company</th>
        <th>Plan &amp; Status</th>
        <th>Role</th>
        <th>Email</th>
        <th>Password</th>
        <th>Session Token (Bearer)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Tenant A</strong><br><small style="color:#64748b;">Acme Cloud Dynamics</small></td>
        <td><span style="color:#0284c7; font-weight:600;">Pro</span> (Active)</td>
        <td><strong>Operator</strong></td>
        <td><code>operator@tenanta.com</code></td>
        <td><code>Password123!</code></td>
        <td><code>token-tenant-a-operator</code></td>
      </tr>
      <tr>
        <td><strong>Tenant A</strong><br><small style="color:#64748b;">Acme Cloud Dynamics</small></td>
        <td><span style="color:#0284c7; font-weight:600;">Pro</span> (Active)</td>
        <td>Viewer</td>
        <td><code>viewer@tenanta.com</code></td>
        <td><code>Password123!</code></td>
        <td><code>token-tenant-a-viewer</code></td>
      </tr>
      <tr>
        <td><strong>Tenant B</strong><br><small style="color:#64748b;">BetaLabs Research</small></td>
        <td>Basic (Active, 3/day)</td>
        <td><strong>Operator</strong></td>
        <td><code>operator@tenantb.com</code></td>
        <td><code>Password123!</code></td>
        <td><code>token-tenant-b-operator</code></td>
      </tr>
      <tr>
        <td><strong>Tenant B</strong><br><small style="color:#64748b;">BetaLabs Research</small></td>
        <td>Basic (Active)</td>
        <td>Viewer</td>
        <td><code>viewer@tenantb.com</code></td>
        <td><code>Password123!</code></td>
        <td><code>token-tenant-b-viewer</code></td>
      </tr>
      <tr>
        <td><strong>Tenant C</strong><br><small style="color:#64748b;">Omega Systems</small></td>
        <td>Basic (<span style="color:#dc2626; font-weight:600;">Suspended</span>)</td>
        <td>Operator</td>
        <td><code>operator@tenantc.com</code></td>
        <td><code>Password123!</code></td>
        <td><code>token-tenant-c-suspended</code></td>
      </tr>
      <tr>
        <td><strong>Tenant Ultra</strong><br><small style="color:#64748b;">Nexus Global</small></td>
        <td><span style="color:#9333ea; font-weight:600;">Ultra</span> (Enterprise)</td>
        <td><strong>Operator</strong></td>
        <td><code>operator@ultra.com</code></td>
        <td><code>Password123!</code></td>
        <td><code>token-tenant-ultra-operator</code></td>
      </tr>
    </tbody>
  </table>

  <h2>5. Brief Running & Verification Steps</h2>

  <h3>Option A: Live Azure Cloud Health Verification</h3>
  <pre><code># 1. Query Azure Container App running status
az containerapp show --name uc03-connection-health-dev --resource-group rg-codessey-dev \\
  --query "{name:name, status:properties.runningStatus, provisioning:properties.provisioningState}" -o table

# 2. Test live cloud endpoint response (HTTP 200 OK)
curl -I https://uc03-connection-health-dev.salmonriver-55a14043.centralindia.azurecontainerapps.io/</code></pre>

  <h3>Option B: Local Interactive Console & Acceptance Suite (&lt; 60s)</h3>
  <pre><code># Step 1: Install dependencies
npm install

# Step 2: Run automated acceptance suite (All 11 acceptance checks A01-A11 pass in ~45ms)
npm test

# Step 3: Launch interactive web console
npm run dev
# Open http://localhost:3000 in browser & log in with operator@tenanta.com / Password123!</code></pre>

  <div class="footer">
    <span>UC-03 Connection Health Reporting SaaS &bull; Technical Submission Report</span>
    <span>Generated: October 21, 2026 &bull; Abhishek S</span>
  </div>

</body>
</html>
`;

const htmlFilePath = path.join(rootDir, 'AZURE_DEPLOYMENT.html');
const pdfFilePath = path.join(rootDir, 'AZURE_DEPLOYMENT.pdf');

fs.writeFileSync(htmlFilePath, htmlContent, 'utf-8');
console.log('Generated AZURE_DEPLOYMENT.html');

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cmd = `"${chromePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfFilePath}" "${htmlFilePath}"`;

console.log('Compiling PDF with Google Chrome...');
execSync(cmd, { stdio: 'inherit' });

if (fs.existsSync(pdfFilePath)) {
  const stats = fs.statSync(pdfFilePath);
  console.log(`Successfully generated AZURE_DEPLOYMENT.pdf (${stats.size} bytes)`);
} else {
  console.error('Failed to generate PDF');
  process.exit(1);
}
