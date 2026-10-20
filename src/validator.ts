import { ConnectionRecord, ValidationIssue, ValidationResult } from './types.js';

export function validateRecords(rawRecords: any[]): {
  normalizedRecords: ConnectionRecord[];
  validationResult: ValidationResult;
} {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  let invalidRowCount = 0;
  const normalizedRecords: ConnectionRecord[] = [];

  rawRecords.forEach((record, index) => {
    const rowIndex = index + 1; // 1-based
    let rowHasIssue = false;

    // Check if record is object
    if (!record || typeof record !== 'object') {
      issues.push({ row_index: rowIndex, field: 'record', rule_id: 'R1' });
      invalidRowCount++;
      return;
    }

    // 1. Trim strings if applicable
    const rawId = typeof record.record_id === 'string' ? record.record_id.trim() : record.record_id;
    const rawEnv = typeof record.environment === 'string' ? record.environment.trim() : record.environment;
    const statusCode = record.status_code;
    const latencyMs = record.latency_ms;

    // R1: record_id nonempty string, <=20 chars, unique in batch (only LATER duplicates are flagged)
    if (typeof rawId !== 'string' || rawId.length === 0 || rawId.length > 20) {
      issues.push({ row_index: rowIndex, field: 'record_id', rule_id: 'R1' });
      rowHasIssue = true;
    } else if (seenIds.has(rawId)) {
      // Duplicate ID (only later occurrences flagged)
      issues.push({ row_index: rowIndex, field: 'record_id', rule_id: 'R1' });
      rowHasIssue = true;
    } else {
      seenIds.add(rawId);
    }

    // R2: status_code is integer in {200, 401, 429, 504}
    // Reject booleans and numeric strings
    if (typeof statusCode !== 'number' || typeof statusCode === 'boolean' || !Number.isInteger(statusCode) || ![200, 401, 429, 504].includes(statusCode)) {
      issues.push({ row_index: rowIndex, field: 'status_code', rule_id: 'R2' });
      rowHasIssue = true;
    }

    // R3: latency_ms is integer 0..60000 inclusive
    // Reject booleans and numeric strings
    if (typeof latencyMs !== 'number' || typeof latencyMs === 'boolean' || !Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 60000) {
      issues.push({ row_index: rowIndex, field: 'latency_ms', rule_id: 'R3' });
      rowHasIssue = true;
    }

    // R4: environment is TEST or STAGE
    if (typeof rawEnv !== 'string' || !['TEST', 'STAGE'].includes(rawEnv)) {
      issues.push({ row_index: rowIndex, field: 'environment', rule_id: 'R4' });
      rowHasIssue = true;
    }

    if (rowHasIssue) {
      invalidRowCount++;
    }

    normalizedRecords.push({
      record_id: rawId,
      status_code: statusCode,
      latency_ms: latencyMs,
      environment: rawEnv,
    });
  });

  return {
    normalizedRecords,
    validationResult: {
      valid_rows: rawRecords.length - invalidRowCount,
      invalid_rows: invalidRowCount,
      issues,
    },
  };
}
