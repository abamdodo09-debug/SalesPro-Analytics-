import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  testConnection,
} from '../firebase';
import { TransactionRecord } from '../types/dashboard';
import { TARGETS_UPDATED_EVENT } from './targetManagementService';

export const FIREBASE_CLOUD_HYDRATED_EVENT = 'salespro-firebase-hydrated';

const CONFIG_KEY_PREFIX = 'salespro_';
const EXCLUDED_CONFIG_KEYS = new Set([
  'salespro_transactions_data',
  'salespro_online_promo_reports_v1',
]);

const MAX_BATCH_RECORDS = 250;
const MAX_TOTAL_BATCHES = 500;
const MAX_STRING_IMAGE_LENGTH = 160_000;

let isApplyingCloudSnapshot = false;
const lastSyncedConfigHashes = new Map<string, string>();
let lastSyncedTxSignature = '';

function sanitizeId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function clampString(val: unknown, maxLen: number): string {
  const s = val === null || val === undefined ? '' : String(val);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeNumber(val: unknown, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Recursively strips undefined, converts NaN/Infinity to 0,
 * and caps large base64 data URLs so native Firestore maps always stay < 1MB.
 */
function sanitizeValueForFirestore(value: unknown, depth = 0): unknown {
  if (depth > 15) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    if (value.startsWith('data:image/') && value.length > MAX_STRING_IMAGE_LENGTH) {
      return '';
    }
    return value.length > 100_000 ? value.slice(0, 100_000) : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 2000).map((item) => sanitizeValueForFirestore(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      const safeKey = String(k).slice(0, 200);
      out[safeKey] = sanitizeValueForFirestore(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/**
 * Normalizes a TransactionRecord so it strictly adheres to firebase-blueprint.json
 * volumetric boundaries and schema types.
 */
function sanitizeTransactionForFirestore(
  rec: TransactionRecord,
  ownerId: string,
  txId: string
): Record<string, unknown> {
  const yearNum = safeNumber(rec.TAHUN, 2026);
  const clampedYear = Math.min(2100, Math.max(2000, Math.round(yearNum)));

  const docData: Record<string, unknown> = {
    ownerId,
    id: txId,
    TANGGAL: clampString(rec.TANGGAL || '1/1/2026', 32) || '1/1/2026',
    BULAN: clampString(rec.BULAN || 'JANUARI', 32) || 'JANUARI',
    TAHUN: clampedYear,
    BA: clampString(rec.BA, 120),
    BA_Number: clampString(rec.BA_Number, 64),
    COVER_AREA: clampString(rec.COVER_AREA, 120),
    SALES: clampString(rec.SALES, 120),
    SPV: clampString(rec.SPV, 120),
    BRAND: clampString(rec.BRAND, 80),
    NO_SKU: clampString(rec.NO_SKU, 64),
    SPU: clampString(rec.SPU, 160),
    SKU: clampString(rec.SKU, 240),
    PRODUK_FOCUS: clampString(rec.PRODUK_FOCUS, 40),
    PRODUK_NEW: clampString(rec.PRODUK_NEW, 40),
    NAMA_STORE: clampString(rec.NAMA_STORE || 'TOKO', 180) || 'TOKO',
    REGION: clampString(rec.REGION, 120),
    KATEGORI: clampString(rec.KATEGORI, 120),
    QTY: safeNumber(rec.QTY, 0),
    VALUE: safeNumber(rec.VALUE, 0),
    KET: clampString(rec.KET || 'SELL OUT', 32) || 'SELL OUT',
  };

  if (rec.weekNumber !== undefined && Number.isFinite(Number(rec.weekNumber))) {
    docData.weekNumber = Number(rec.weekNumber);
  }
  if (rec.STATUS_PRODUK !== undefined) {
    docData.STATUS_PRODUK = clampString(rec.STATUS_PRODUK, 120);
  }

  return docData;
}

export async function signInWithGoogle(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  lastSyncedConfigHashes.clear();
  lastSyncedTxSignature = '';
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function verifyFirestoreConnection(): Promise<boolean> {
  return testConnection();
}

/**
 * Ensures root /users/{uid} (non-PII) and /users/{uid}/private/profile (PII) exist
 * while respecting immutable createdAt and strict affectedKeys rules.
 */
export async function ensureUserDocuments(user: User): Promise<void> {
  if (!user.emailVerified) return;

  const userDocPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: sanitizeId(user.uid),
        accountType: 'standard',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userDocPath);
  }

  const profilePath = `users/${user.uid}/private/profile`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'profile');

  try {
    const profileSnap = await getDoc(profileRef);
    const displayName = clampString(user.displayName || 'Pengguna SalesPro', 120);
    const email = clampString(user.email || 'user@example.com', 254);
    const photoURL = clampString(user.photoURL || '', 1000);

    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid: sanitizeId(user.uid),
        ownerId: sanitizeId(user.uid),
        displayName,
        email,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(profileRef, {
        displayName,
        email,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

function collectLocalConfigSlices(): { configKey: string; payloadValue: unknown; hash: string }[] {
  const slices: { configKey: string; payloadValue: unknown; hash: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(CONFIG_KEY_PREFIX) || EXCLUDED_CONFIG_KEYS.has(key)) {
      continue;
    }
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    const safeKey = sanitizeId(key, 'cfg');
    if (safeKey.length < 3 || safeKey.length > 100) continue;

    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }

    const sanitizedValue = sanitizeValueForFirestore(parsed);
    const hash = JSON.stringify(sanitizedValue);
    // Guard against exceeding 1MB doc limit
    if (hash.length > 850_000) continue;

    slices.push({
      configKey: safeKey,
      payloadValue: sanitizedValue,
      hash,
    });
  }
  return slices;
}

/**
 * Pushes changed SalesPro configuration slices (targets, master stores, KPI overrides,
 * GAS settings, visits, weekly BA settings, etc.) to Firestore as native Maps.
 */
export async function syncLocalConfigsToFirestore(uid: string, forceAll = false): Promise<number> {
  if (!auth.currentUser?.emailVerified) return 0;

  const slices = collectLocalConfigSlices();
  let syncedCount = 0;

  for (const slice of slices) {
    if (!forceAll && lastSyncedConfigHashes.get(slice.configKey) === slice.hash) {
      continue;
    }

    const docPath = `users/${uid}/configs/${slice.configKey}`;
    const docRef = doc(db, 'users', uid, 'configs', slice.configKey);

    try {
      const existingSnap = await getDoc(docRef);
      const nativePayload = { value: slice.payloadValue };

      if (!existingSnap.exists()) {
        await setDoc(docRef, {
          ownerId: uid,
          configKey: slice.configKey,
          payload: nativePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, {
          payload: nativePayload,
          updatedAt: serverTimestamp(),
        });
      }

      lastSyncedConfigHashes.set(slice.configKey, slice.hash);
      syncedCount++;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  return syncedCount;
}

/**
 * Saves an individual manual transaction document cleanly to Firestore.
 */
export async function saveSingleTransactionToFirestore(
  uid: string,
  record: TransactionRecord
): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;

  const txId = sanitizeId(record.id, 'tx');
  const docPath = `users/${uid}/transactions/${txId}`;
  const docRef = doc(db, 'users', uid, 'transactions', txId);

  try {
    const existingSnap = await getDoc(docRef);
    const payload = sanitizeTransactionForFirestore(record, uid, txId);

    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _o, id: _i, ...updatableFields } = payload;
      await updateDoc(docRef, {
        ...updatableFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

/**
 * Syncs full dataset (e.g. from Google Sheets or CSV) to Firestore using chunked native Lists
 * (up to 250 records/doc) to stay quota-efficient and within the 1MB doc limit.
 */
export async function syncTransactionDatasetToFirestore(
  uid: string,
  records: TransactionRecord[],
  force = false
): Promise<void> {
  if (!auth.currentUser?.emailVerified || !records || records.length === 0) return;

  const signature = `${records.length}:${records[0]?.id || ''}:${records[records.length - 1]?.id || ''}:${records[0]?.VALUE || 0}`;
  if (!force && signature === lastSyncedTxSignature) {
    return;
  }

  const maxRecordsSupported = MAX_BATCH_RECORDS * MAX_TOTAL_BATCHES;
  const boundedRecords = records.slice(0, maxRecordsSupported);
  const totalBatches = Math.ceil(boundedRecords.length / MAX_BATCH_RECORDS);
  const datasetVersion = `v_${Date.now()}`;
  const colPath = `users/${uid}/transactionBatches`;

  try {
    const existingListQuery = query(
      collection(db, 'users', uid, 'transactionBatches'),
      where('ownerId', '==', uid)
    );
    const existingSnap = await getDocs(existingListQuery);
    const existingMap = new Map<string, boolean>();
    existingSnap.forEach((d) => existingMap.set(d.id, true));

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const chunk = boundedRecords
        .slice(batchIdx * MAX_BATCH_RECORDS, (batchIdx + 1) * MAX_BATCH_RECORDS)
        .map((rec) => {
          const safeId = sanitizeId(rec.id, 'row');
          return sanitizeTransactionForFirestore(rec, uid, safeId);
        });

      const batchId = `batch_${batchIdx}`;
      const batchRef = doc(db, 'users', uid, 'transactionBatches', batchId);

      if (!existingMap.has(batchId)) {
        await setDoc(batchRef, {
          ownerId: uid,
          batchIndex: batchIdx,
          totalBatches,
          datasetVersion,
          records: chunk,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(batchRef, {
          batchIndex: batchIdx,
          totalBatches,
          datasetVersion,
          records: chunk,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Delete excess old batch documents if dataset shrank
    const deletePromises: Promise<void>[] = [];
    existingSnap.forEach((docSnap) => {
      const match = /^batch_(\d+)$/.exec(docSnap.id);
      const idx = match ? Number(match[1]) : -1;
      if (idx >= totalBatches || idx < 0) {
        deletePromises.push(deleteDoc(docSnap.ref));
      }
    });
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }

    lastSyncedTxSignature = signature;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
}

/**
 * Deletes excess transaction docs and cleans up if resetting dataset.
 */
export async function clearCloudTransactions(uid: string): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;

  const batchesPath = `users/${uid}/transactionBatches`;
  try {
    const qBatches = query(
      collection(db, 'users', uid, 'transactionBatches'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(qBatches);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    lastSyncedTxSignature = '';
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, batchesPath);
  }
}

/**
 * Subscribes to user's Firestore configs, transactionBatches, and manual transactions
 * ONLY when Auth is verified.
 */
export function subscribeToUserCloudData(
  user: User,
  callbacks: {
    onCloudTransactionsLoaded: (records: TransactionRecord[]) => void;
    onCloudConfigsApplied: (keysCount: number) => void;
  }
): () => void {
  if (!user.emailVerified) {
    return () => {};
  }

  const uid = user.uid;
  const configsPath = `users/${uid}/configs`;
  const batchesPath = `users/${uid}/transactionBatches`;
  const txPath = `users/${uid}/transactions`;

  let latestBatchesRecords: TransactionRecord[] = [];
  let latestManualRecords: TransactionRecord[] = [];
  let batchesLoaded = false;
  let manualLoaded = false;

  const emitMergedTransactions = () => {
    if (!batchesLoaded && !manualLoaded) return;
    if (latestBatchesRecords.length === 0 && latestManualRecords.length === 0) return;

    const seenIds = new Set<string>();
    const merged: TransactionRecord[] = [];

    for (const r of latestManualRecords) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        merged.push(r);
      }
    }
    for (const r of latestBatchesRecords) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        merged.push(r);
      }
    }

    lastSyncedTxSignature = `${merged.length}:${merged[0]?.id || ''}:${merged[merged.length - 1]?.id || ''}:${merged[0]?.VALUE || 0}`;
    callbacks.onCloudTransactionsLoaded(merged);
  };

  // 1. Configs real-time listener (enforces ownerId filter matching security rule)
  const qConfigs = query(
    collection(db, 'users', uid, 'configs'),
    where('ownerId', '==', uid)
  );
  const unsubConfigs = onSnapshot(
    qConfigs,
    (snapshot) => {
      if (snapshot.empty) return;
      isApplyingCloudSnapshot = true;
      let appliedCount = 0;
      try {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const configKey = typeof data?.configKey === 'string' ? data.configKey : docSnap.id;
          const val = data?.payload?.value;
          if (!configKey || val === undefined || EXCLUDED_CONFIG_KEYS.has(configKey)) return;

          const serialized = typeof val === 'string' ? val : JSON.stringify(val);
          const hash = JSON.stringify(val);
          lastSyncedConfigHashes.set(configKey, hash);

          if (localStorage.getItem(configKey) !== serialized) {
            localStorage.setItem(configKey, serialized);
            appliedCount++;
          }
        });
      } finally {
        isApplyingCloudSnapshot = false;
      }

      if (appliedCount > 0) {
        window.dispatchEvent(new Event(TARGETS_UPDATED_EVENT));
        window.dispatchEvent(new Event(FIREBASE_CLOUD_HYDRATED_EVENT));
        callbacks.onCloudConfigsApplied(appliedCount);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, configsPath);
    }
  );

  // 2. Transaction Batches real-time listener
  const qBatches = query(
    collection(db, 'users', uid, 'transactionBatches'),
    where('ownerId', '==', uid)
  );
  const unsubBatches = onSnapshot(
    qBatches,
    (snapshot) => {
      batchesLoaded = true;
      const docs = snapshot.docs
        .map((d) => d.data())
        .sort((a, b) => Number(a.batchIndex ?? 0) - Number(b.batchIndex ?? 0));

      const assembled: TransactionRecord[] = [];
      for (const batchDoc of docs) {
        if (Array.isArray(batchDoc.records)) {
          for (const rec of batchDoc.records) {
            if (rec && typeof rec === 'object') {
              assembled.push(rec as TransactionRecord);
            }
          }
        }
      }
      latestBatchesRecords = assembled;
      emitMergedTransactions();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, batchesPath);
    }
  );

  // 3. Individual Manual Transactions real-time listener
  const qTx = query(
    collection(db, 'users', uid, 'transactions'),
    where('ownerId', '==', uid)
  );
  const unsubTx = onSnapshot(
    qTx,
    (snapshot) => {
      manualLoaded = true;
      const items: TransactionRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d && typeof d === 'object') {
          const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = d;
          items.push(rest as TransactionRecord);
        }
      });
      latestManualRecords = items;
      emitMergedTransactions();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, txPath);
    }
  );

  return () => {
    unsubConfigs();
    unsubBatches();
    unsubTx();
  };
}

export function getIsApplyingCloudSnapshot(): boolean {
  return isApplyingCloudSnapshot;
}
