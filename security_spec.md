# Security Specification: SalesPro Analytics Firestore Rules

## 1. Data Invariants & Relationship Mapping
- **Master Root**: `/users/{userId}` (`UserAccount`) is the non-PII root anchor for each verified Google Sign-In user (`request.auth.uid == userId && request.auth.token.email_verified == true`).
- **PII Isolation**: Email, `displayName`, and `photoURL` are strictly isolated in `/users/{userId}/private/profile` (`docId == 'profile'`). No `list` queries are permitted on `private`, and `get`/`write` require exact ownership.
- **Subcollection Master Gate & Ownership**:
  - Every `configs`, `transactions`, and `transactionBatches` document MUST verify `exists(/databases/$(database)/documents/users/$(userId))` on create/update and match `incoming().ownerId == request.auth.uid == userId`.
  - Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid` directly without calling `get()` or `exists()` inside `allow list`.
  - `createdAt` and `ownerId` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on create & update.
  - All document IDs (`userId`, `docId`, `configId`, `txId`, `batchId`) must match `^[a-zA-Z0-9_\\-]+$` and have `.size() <= 128`.
  - All strings enforce explicit `.size()` bounds; arrays (`records` in `transactionBatches`) enforce `size() >= 1 && size() <= 250 && records[0] is map`.
  - Every `update` validates `isValid*()` over `incoming()` AND strictly gates changed keys with `incoming().diff(existing()).affectedKeys().hasOnly([...])`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read/Write**: Signed-out request to `/users/uid1/configs/salespro_gas_config` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: Signed-in user with `email_verified: false` writing `/users/uid1/private/profile` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read/List**: User `uid2` querying `collection(db, 'users/uid1/configs')` or `getDoc('users/uid1/private/profile')` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: User `uid1` creating `users/uid1/transactions/tx1` with `ownerId: 'uid2'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: User `uid1` creating `users/uid1` with `{ uid: 'uid1', accountType: 'standard', isAdmin: true, createdAt, updatedAt }` -> `PERMISSION_DENIED`.
6. **Privilege Escalation on Update**: User `uid1` updating `/users/uid1` to `{ accountType: 'admin' }` -> `PERMISSION_DENIED`.
7. **Immutable `createdAt` / `ownerId` Tampering**: User `uid1` updating `configs/cfg1` with a modified `createdAt` or `ownerId` -> `PERMISSION_DENIED`.
8. **Client-Forged Timestamp**: User `uid1` creating `configs/cfg1` with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: User `uid1` creating `transactions/<200-char-invalid-id!@#>` -> `PERMISSION_DENIED`.
10. **Oversized Array / Denial of Wallet**: User `uid1` creating `transactionBatches/b1` with `records.length === 251` or `records: []` -> `PERMISSION_DENIED`.
11. **Value Type Poisoning on Update**: User `uid1` updating `configs/cfg1` with `payload: "JSON_STRINGIFIED_TEXT"` instead of a native `map` -> `PERMISSION_DENIED`.
12. **PII Collection Listing**: Any user (even `uid1`) attempting a `list` query on `/users/uid1/private` or `/users` -> `PERMISSION_DENIED`.
