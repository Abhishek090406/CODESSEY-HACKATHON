import { ConnectionRecord, ProcessedRow, ProcessingResult } from './types.js';

/**
 * Supplied pure processing helper for UC-03 Connection Health reporting.
 * Maps status_code and latency_ms into health classifications:
 * - 401 -> UNAUTHORISED
 * - 429 -> RATE_LIMITED
 * - 504 -> TIMEOUT
 * - 200 -> SLOW (if latency_ms > 1000), otherwise HEALTHY
 * 
 * Preserves row order and returns { summary, rows, issues: [] }.
 */
export function processConnectionRecords(records: ConnectionRecord[]): ProcessingResult {
  let healthyRows = 0;
  let otherRows = 0;

  const rows: ProcessedRow[] = records.map((record) => {
    let health: ProcessedRow['health'];

    switch (record.status_code) {
      case 200:
        health = record.latency_ms > 1000 ? 'SLOW' : 'HEALTHY';
        break;
      case 401:
        health = 'UNAUTHORISED';
        break;
      case 429:
        health = 'RATE_LIMITED';
        break;
      case 504:
        health = 'TIMEOUT';
        break;
      default:
        health = 'SLOW';
    }

    if (health === 'HEALTHY') {
      healthyRows++;
    } else {
      otherRows++;
    }

    return {
      ...record,
      health,
    };
  });

  return {
    summary: {
      input_rows: records.length,
      healthy_rows: healthyRows,
      other_rows: otherRows,
    },
    rows,
    issues: [],
  };
}
