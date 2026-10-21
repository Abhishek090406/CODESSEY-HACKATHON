import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';

export interface ReportSaveResult {
  saved: boolean;
  destination: 'azure-blob' | 'local';
  path: string;
  error?: string;
}

/**
 * Persist generated connection health reports.
 * Uses Azure Blob Storage when AZURE_STORAGE_CONNECTION_STRING is defined.
 * Falls back to local directory persistence when running locally without Azure credentials.
 */
export async function persistReport(
  tenantId: string,
  runId: string,
  reportData: any
): Promise<ReportSaveResult> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.REPORTS_CONTAINER || 'connection-reports-dev';

  const payload = {
    tenant_id: tenantId,
    run_id: runId,
    timestamp: new Date().toISOString(),
    report: reportData,
  };
  const jsonContent = JSON.stringify(payload, null, 2);

  // 1. Azure Blob Storage Persistence
  if (connectionString) {
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      // Ensure container exists
      await containerClient.createIfNotExists();

      const blobName = `reports/${tenantId}/${runId}.json`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.upload(jsonContent, Buffer.byteLength(jsonContent), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });

      console.log(`[Storage] Report successfully uploaded to Azure Blob: ${containerName}/${blobName}`);
      return {
        saved: true,
        destination: 'azure-blob',
        path: `${containerName}/${blobName}`,
      };
    } catch (err: any) {
      console.error(`[Storage] Failed to upload report to Azure Blob:`, err.message);
      // Fall through to local fallback
    }
  }

  // 2. Local Fallback Persistence
  try {
    const localDir = path.join(process.cwd(), 'reports', tenantId);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, `${runId}.json`);
    fs.writeFileSync(localPath, jsonContent, 'utf-8');
    return {
      saved: true,
      destination: 'local',
      path: localPath,
    };
  } catch (err: any) {
    console.error(`[Storage] Failed local report persistence:`, err.message);
    return {
      saved: false,
      destination: 'local',
      path: '',
      error: err.message,
    };
  }
}
