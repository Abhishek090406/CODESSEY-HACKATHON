export type OperationType = 'validate' | 'process';

export type EnvironmentType = 'TEST' | 'STAGE';

export interface ConnectionRecord {
  record_id: string;
  status_code: number;
  latency_ms: number;
  environment: EnvironmentType;
}

export interface ValidationIssue {
  row_index: number; // 1-based
  field: string;
  rule_id: 'R1' | 'R2' | 'R3' | 'R4';
}

export interface ValidationResult {
  valid_rows: number;
  invalid_rows: number;
  issues: ValidationIssue[];
}

export interface ProcessedRow extends ConnectionRecord {
  health: 'HEALTHY' | 'SLOW' | 'UNAUTHORISED' | 'RATE_LIMITED' | 'TIMEOUT';
}

export interface ProcessingSummary {
  input_rows: number;
  healthy_rows: number;
  other_rows: number;
}

export interface ProcessingResult {
  summary: ProcessingSummary;
  rows: ProcessedRow[];
  issues: ValidationIssue[];
}

export type RunStatus = 'Running' | 'Succeeded' | 'Failed';

export interface RunRecord {
  run_id: string;
  tenant_id: string;
  idempotency_key: string;
  input_fingerprint: string;
  operation: OperationType;
  status: RunStatus;
  result?: ProcessingResult | ValidationResult;
  error?: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'Operator' | 'Viewer';
export type PlanType = 'Basic' | 'Pro' | 'Ultra';
export type SubscriptionStatus = 'active' | 'suspended';

export interface SessionContext {
  tenant_id: string;
  role: UserRole;
  plan: PlanType;
  subscription_status: SubscriptionStatus;
}
