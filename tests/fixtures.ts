import { ConnectionRecord } from '../src/types.js';

export const VALID_FIXTURE_RECORDS: ConnectionRecord[] = [
  { record_id: 'S01', status_code: 200, latency_ms: 80, environment: 'TEST' },
  { record_id: 'S02', status_code: 504, latency_ms: 3000, environment: 'STAGE' },
];

export const INVALID_FIXTURE_RECORDS: any[] = [
  // 2 valid rows
  { record_id: 'S01', status_code: 200, latency_ms: 80, environment: 'TEST' },
  { record_id: 'S02', status_code: 504, latency_ms: 3000, environment: 'STAGE' },
  // 4 invalid mutations of S01
  { record_id: 'S01', status_code: 200, latency_ms: 80, environment: 'TEST' }, // X1: duplicate ID (R1)
  { record_id: 'X2', status_code: 999, latency_ms: 80, environment: 'TEST' },   // X2: invalid status_code (R2)
  { record_id: 'X3', status_code: 200, latency_ms: -1, environment: 'TEST' },   // X3: latency_ms < 0 (R3)
  { record_id: 'X4', status_code: 200, latency_ms: 80, environment: 'PROD' },  // X4: environment invalid (R4)
];
