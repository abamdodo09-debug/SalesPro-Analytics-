/**
 * Security Rule Verification Matrix (Phase 0 TDD)
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected (PERMISSION_DENIED)
 * and legitimate verified owner operations succeed.
 */
export interface DirtyDozenScenario {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated read on configs',
    path: '/users/user_abc/configs/salespro_gas_config',
    operation: 'get',
    auth: null,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email creating private profile',
    path: '/users/user_abc/private/profile',
    operation: 'create',
    auth: { uid: 'user_abc', email_verified: false },
    payload: {
      uid: 'user_abc',
      ownerId: 'user_abc',
      displayName: 'Test',
      email: 'test@example.com',
      photoURL: '',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-tenant read of another user PII',
    path: '/users/user_abc/private/profile',
    operation: 'get',
    auth: { uid: 'attacker_xyz', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity spoofing ownerId on transaction create',
    path: '/users/user_abc/transactions/tx_001',
    operation: 'create',
    auth: { uid: 'user_abc', email_verified: true },
    payload: { ownerId: 'victim_999', id: 'tx_001' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow field injection (isAdmin: true) on UserAccount',
    path: '/users/user_abc',
    operation: 'create',
    auth: { uid: 'user_abc', email_verified: true },
    payload: {
      uid: 'user_abc',
      accountType: 'standard',
      isAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Privilege escalation updating accountType on UserAccount',
    path: '/users/user_abc',
    operation: 'update',
    auth: { uid: 'user_abc', email_verified: true },
    payload: { accountType: 'admin', updatedAt: 'REQUEST_TIME' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Mutating immutable createdAt field on config update',
    path: '/users/user_abc/configs/salespro_gas_config',
    operation: 'update',
    auth: { uid: 'user_abc', email_verified: true },
    payload: { payload: { value: {} }, createdAt: 'NEW_TIME', updatedAt: 'REQUEST_TIME' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged timestamp bypassing request.time',
    path: '/users/user_abc/configs/salespro_gas_config',
    operation: 'create',
    auth: { uid: 'user_abc', email_verified: true },
    payload: {
      ownerId: 'user_abc',
      configKey: 'salespro_gas_config',
      payload: { value: {} },
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID poisoning with invalid characters',
    path: '/users/user_abc/transactions/bad$id/../../../etc',
    operation: 'create',
    auth: { uid: 'user_abc', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized transaction batch (>250 records)',
    path: '/users/user_abc/transactionBatches/batch_0',
    operation: 'create',
    auth: { uid: 'user_abc', email_verified: true },
    payload: {
      ownerId: 'user_abc',
      batchIndex: 0,
      totalBatches: 1,
      datasetVersion: 'v1',
      records: Array.from({ length: 251 }, (_, i) => ({ id: `r_${i}` })),
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value poisoning storing stringified JSON in AppConfigDoc.payload',
    path: '/users/user_abc/configs/salespro_gas_config',
    operation: 'update',
    auth: { uid: 'user_abc', email_verified: true },
    payload: { payload: '{"hacked":true}', updatedAt: 'REQUEST_TIME' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Listing private PII subcollection or root users collection',
    path: '/users/user_abc/private',
    operation: 'list',
    auth: { uid: 'user_abc', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
