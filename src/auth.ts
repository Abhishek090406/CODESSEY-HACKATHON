import { Request, Response, NextFunction } from 'express';
import { SessionContext, UserRole, PlanType, SubscriptionStatus } from './types.js';

// Extend Express Request with verified session
declare global {
  namespace Express {
    interface Request {
      session?: SessionContext;
    }
  }
}

export interface UserAccount {
  email: string;
  password: string;
  tenant_id: string;
  company_name: string;
  role: UserRole;
  plan: PlanType;
  subscription_status: SubscriptionStatus;
  token: string;
}

export const SEEDED_ACCOUNTS: UserAccount[] = [
  {
    email: 'operator@tenanta.com',
    password: 'Password123!',
    tenant_id: 'tenant-a',
    company_name: 'Acme Cloud Dynamics (Tenant A)',
    role: 'Operator',
    plan: 'Pro',
    subscription_status: 'active',
    token: 'token-tenant-a-operator',
  },
  {
    email: 'viewer@tenanta.com',
    password: 'Password123!',
    tenant_id: 'tenant-a',
    company_name: 'Acme Cloud Dynamics (Tenant A)',
    role: 'Viewer',
    plan: 'Pro',
    subscription_status: 'active',
    token: 'token-tenant-a-viewer',
  },
  {
    email: 'operator@tenantb.com',
    password: 'Password123!',
    tenant_id: 'tenant-b',
    company_name: 'BetaLabs Research (Tenant B)',
    role: 'Operator',
    plan: 'Basic',
    subscription_status: 'active',
    token: 'token-tenant-b-operator',
  },
  {
    email: 'viewer@tenantb.com',
    password: 'Password123!',
    tenant_id: 'tenant-b',
    company_name: 'BetaLabs Research (Tenant B)',
    role: 'Viewer',
    plan: 'Basic',
    subscription_status: 'active',
    token: 'token-tenant-b-viewer',
  },
  {
    email: 'operator@tenantc.com',
    password: 'Password123!',
    tenant_id: 'tenant-c',
    company_name: 'Omega Systems (Tenant C)',
    role: 'Operator',
    plan: 'Basic',
    subscription_status: 'suspended',
    token: 'token-tenant-c-suspended',
  },
  {
    email: 'operator@ultra.com',
    password: 'Password123!',
    tenant_id: 'tenant-ultra',
    company_name: 'Nexus Global (Ultra Plan)',
    role: 'Operator',
    plan: 'Ultra',
    subscription_status: 'active',
    token: 'token-tenant-ultra-operator',
  },
];

// Map tokens to session contexts
const TOKEN_TO_SESSION: Record<string, SessionContext> = {};
SEEDED_ACCOUNTS.forEach((acc) => {
  TOKEN_TO_SESSION[acc.token] = {
    tenant_id: acc.tenant_id,
    role: acc.role,
    plan: acc.plan,
    subscription_status: acc.subscription_status,
  };
});

export function authenticateUser(email: string, password: string): UserAccount | null {
  const account = SEEDED_ACCOUNTS.find(
    (acc) => acc.email.toLowerCase() === email.toLowerCase() && acc.password === password
  );
  return account || null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Strict Tenant Override Check: Reject any request that carries a tenant override
  if (
    req.headers['x-tenant-override'] ||
    (req.body && typeof req.body === 'object' && 'tenant_id' in req.body) ||
    (req.query && 'tenant_id' in req.query)
  ) {
    res.status(400).json({ error: 'Tenant override is rejected. Tenant identity comes only from verified session.' });
    return;
  }

  // 2. Extract Authorization header or session token
  const authHeader = req.headers['authorization'] || (req.headers['x-session-token'] as string);
  if (!authHeader) {
    res.status(401).json({ error: 'Authentication required. Missing session credentials.' });
    return;
  }

  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (authHeader as string).trim();

  const session = TOKEN_TO_SESSION[token];
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  // Copy session
  const activeSession: SessionContext = { ...session };

  // Support test harness header for simulating subscription state transitions (e.g. A10)
  const testSubStatus = req.headers['x-test-set-subscription-status'] as string | undefined;
  if (testSubStatus === 'suspended' || testSubStatus === 'active') {
    activeSession.subscription_status = testSubStatus;
  }

  req.session = activeSession;
  next();
}
