import { TransactionRecord } from '../types/dashboard';
import { SALES_MASTER_6_CONFIG, VALID_KPI_SALES_NAMES } from './kpiSalesData';
import { MONTH_OPTIONS_2026, recordMatchesMonth } from './targetManagementService';

export const MASTER_STORE_STORAGE_KEY = 'salespro_master_store_config_v2';
export const KA_MG_SALES_OVERRIDE_KEY = 'salespro_ka_mg_sales_override_v2';

export interface MasterStoreItem {
  id: string;
  storeName: string;
  monthlyStoreNames?: Record<string, string>; // Key: '2026-01' .. '2026-12'
  hasBa: boolean;
  baName: string;
  baNumber?: string;
  salesName: string;
  trainerName: string;
  coverArea: string;
  region: string;
  spvName: string;
  channel: 'KA' | 'MG'; // KA: Key Account / Modern Trade | MG: Market Group / General Trade
  isCustom?: boolean;
  notes?: string;
}

export interface KaMgSalesOverride {
  isManual: boolean;
  spvSalesValue?: number; // Semua Penjualan SPV (WIDODO + HENDRA GUNAWAN)
  kaSalesValue: number; // Nilai Penjualan KA (Key Account)
  mgSalesValue: number; // PENJUALAN DAZZLE ME MG (Market Group)
  dazzleMeMgSalesValue?: number; // PENJUALAN DAZZLE ME MG
  notes?: string;
  updatedAt?: string;
}

const GENERIC_BA_PREFIXES = new Set([
  'BA TOKO',
  'BA GUARDIAN',
  'BA MISS',
  'BA WATSON',
  'BA SWALAYAN',
  'BA APOTEK',
  'BA WARUNG',
  'BA KIOS',
  'BA MART',
  'BA GROSIR',
  'BA KOSMETIK',
  'BA COSMETIC',
  'BA COUNTER',
  'BA STANDBY',
]);

/**
 * Mengecek apakah nama BA hanyalah placeholder / Non-BA / hasil generate otomatis dari nama toko
 */
export function isPlaceholderBaName(baName?: string, storeName?: string): boolean {
  const clean = (baName || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (
    !clean ||
    clean === '-' ||
    clean === '- (NON-BA)' ||
    clean === 'NON BA' ||
    clean === 'NON-BA' ||
    clean === 'STANDBY' ||
    clean === 'BA STANDBY' ||
    clean === 'ALL' ||
    clean === 'EMPTY' ||
    clean === 'KOSONG' ||
    clean === 'VACANT' ||
    clean === 'NO BA' ||
    clean === 'TANPA BA' ||
    GENERIC_BA_PREFIXES.has(clean)
  ) {
    return true;
  }

  // Deteksi placeholder otomatis "BA <KATA_PERTAMA_TOKO>" agar toko tanpa data transaksi sheet tidak tergabung salah
  if (clean.startsWith('BA ') && storeName) {
    const firstStoreToken = splitMasterStoreNames(storeName)[0] || storeName;
    const firstWord = firstStoreToken.trim().split(/\s+/)[0]?.toUpperCase();
    if (firstWord && clean === `BA ${firstWord}`) {
      return true;
    }
  }

  return false;
}

export function normalizeBaGroupKey(baName?: string): string {
  return (baName || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Memecah gabungan nama toko (dipisahkan koma) menjadi array toko unik tanpa menghilangkan urutan
 */
export function splitMasterStoreNames(rawStoreName?: string): string[] {
  if (!rawStoreName) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  rawStoreName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const upper = part.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        result.push(part);
      }
    });

  return result;
}

/**
 * Menggabungkan dua string daftar toko (comma-separated) menjadi daftar toko unik
 */
export function joinUniqueStoreNames(...storeStrings: Array<string | undefined>): string {
  const seen = new Set<string>();
  const list: string[] = [];

  storeStrings.forEach((raw) => {
    splitMasterStoreNames(raw).forEach((tok) => {
      const upper = tok.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        list.push(tok);
      }
    });
  });

  return list.join(', ');
}

/**
 * Menggabungkan toko-toko berbeda yang memiliki Nama BA sama (untuk BA valid)
 */
export function mergeMasterStoresByBa(items: MasterStoreItem[]): MasterStoreItem[] {
  const groupMap = new Map<string, MasterStoreItem>();

  items.forEach((item) => {
    const cleanStore = joinUniqueStoreNames(item.storeName);
    if (!cleanStore) return;

    const hasValidRealBa = item.hasBa && !isPlaceholderBaName(item.baName, cleanStore);
    const groupKey = hasValidRealBa
      ? `BA::${normalizeBaGroupKey(item.baName)}`
      : `STORE::${cleanStore.toUpperCase()}`;

    const existing = groupMap.get(groupKey);
    if (!existing) {
      const cleanMonthly: Record<string, string> = {};
      if (item.monthlyStoreNames) {
        Object.entries(item.monthlyStoreNames).forEach(([mk, val]) => {
          const joined = joinUniqueStoreNames(val);
          if (joined) cleanMonthly[mk] = joined;
        });
      }

      groupMap.set(groupKey, {
        ...item,
        storeName: cleanStore,
        baName: item.hasBa ? item.baName.trim() : '- (Non-BA)',
        monthlyStoreNames: Object.keys(cleanMonthly).length > 0 ? cleanMonthly : undefined,
      });
      return;
    }

    // Gabungkan nama toko yang berbeda untuk BA yang sama
    existing.storeName = joinUniqueStoreNames(existing.storeName, cleanStore);

    // Gabungkan override nama toko per bulan jika keduanya punya
    if (item.monthlyStoreNames) {
      const nextMonthly: Record<string, string> = { ...(existing.monthlyStoreNames || {}) };
      Object.entries(item.monthlyStoreNames).forEach(([mk, val]) => {
        const mergedMonthStore = joinUniqueStoreNames(nextMonthly[mk], val);
        if (mergedMonthStore) {
          nextMonthly[mk] = mergedMonthStore;
        }
      });
      existing.monthlyStoreNames = Object.keys(nextMonthly).length > 0 ? nextMonthly : undefined;
    }

    if (!existing.baNumber && item.baNumber) existing.baNumber = item.baNumber;
    if ((!existing.salesName || existing.salesName === '-') && item.salesName) existing.salesName = item.salesName;
    if ((!existing.trainerName || existing.trainerName === '-') && item.trainerName) existing.trainerName = item.trainerName;
    if ((!existing.coverArea || existing.coverArea === '-') && item.coverArea) existing.coverArea = item.coverArea;
    if ((!existing.region || existing.region === '-') && item.region) existing.region = item.region;
    if ((!existing.spvName || existing.spvName === '-') && item.spvName) existing.spvName = item.spvName;
    if (item.isCustom) existing.isCustom = true;
    if (item.notes && item.notes.trim()) {
      if (!existing.notes || !existing.notes.trim()) {
        existing.notes = item.notes.trim();
      } else if (!existing.notes.includes(item.notes.trim())) {
        existing.notes = `${existing.notes}; ${item.notes.trim()}`;
      }
    }
    if (item.channel === 'KA') existing.channel = 'KA';
  });

  return Array.from(groupMap.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
}

/**
 * Membangun peta `${monthKey}__${baUpper}` -> Nama Toko dari transaksi Google Sheet per bulan
 */
export function buildSheetMonthlyBaStoreMap(
  transactions: TransactionRecord[] = []
): Map<string, string> {
  const bucketMap = new Map<string, Set<string>>();

  if (transactions.length === 0) return new Map();

  MONTH_OPTIONS_2026.forEach((m) => {
    transactions.forEach((r) => {
      if (!recordMatchesMonth(r, m.key)) return;
      const store = (r.NAMA_STORE || '').trim();
      const rawBa = (r.BA || '').trim();
      if (!store || isPlaceholderBaName(rawBa, store)) return;

      const key = `${m.key}__${normalizeBaGroupKey(rawBa)}`;
      if (!bucketMap.has(key)) {
        bucketMap.set(key, new Set<string>());
      }
      const set = bucketMap.get(key)!;
      // Hindari duplikasi case-insensitive
      const existsCaseInsensitive = Array.from(set).some(
        (s) => s.toUpperCase() === store.toUpperCase()
      );
      if (!existsCaseInsensitive) {
        set.add(store);
      }
    });
  });

  const result = new Map<string, string>();
  bucketMap.forEach((storeSet, key) => {
    result.set(key, Array.from(storeSet).join(', '));
  });
  return result;
}

/**
 * Menentukan nama toko yang ditampilkan & sumbernya untuk bulan tertentu
 */
export function resolveMasterStoreNameForMonth(
  item: MasterStoreItem,
  monthKey: string,
  sheetBaMonthMap?: Map<string, string>
): {
  storeName: string;
  source: 'manual_month' | 'sheet_month' | 'master';
} {
  if (!monthKey || monthKey === 'ALL') {
    return {
      storeName: item.storeName,
      source: 'master',
    };
  }

  const manualMonthStore = item.monthlyStoreNames?.[monthKey]?.trim();
  if (manualMonthStore) {
    return {
      storeName: manualMonthStore,
      source: 'manual_month',
    };
  }

  if (item.hasBa && !isPlaceholderBaName(item.baName, item.storeName) && sheetBaMonthMap) {
    const sheetStore = sheetBaMonthMap.get(`${monthKey}__${normalizeBaGroupKey(item.baName)}`);
    if (sheetStore && sheetStore.trim()) {
      return {
        storeName: sheetStore,
        source: 'sheet_month',
      };
    }
  }

  return {
    storeName: item.storeName,
    source: 'master',
  };
}

/**
 * Helper untuk menentukan channel default berdasarkan nama toko
 */
export function detectStoreChannel(storeName: string): 'KA' | 'MG' {
  const upper = storeName.toUpperCase();
  if (
    upper.includes('GUARDIAN') ||
    upper.includes('WATSON') ||
    upper.includes('MISS GLAM') ||
    upper.includes('MALL') ||
    upper.includes('SWALAYAN') ||
    upper.includes('MART') ||
    upper.includes('PARETO') ||
    upper.includes('KEY ACCOUNT')
  ) {
    return 'KA';
  }
  return 'MG';
}

/**
 * Mencari sales dan trainer resmi untuk suatu toko berdasarkan SALES_MASTER_6_CONFIG
 */
export function findOfficialSalesAndTrainerForStore(storeName: string): {
  salesName: string;
  trainerName: string;
  coverArea: string;
} {
  const cleanName = storeName.trim().toUpperCase();

  for (const sName of VALID_KPI_SALES_NAMES) {
    const cfg = SALES_MASTER_6_CONFIG[sName];
    if (cfg) {
      const match = cfg.coveredStores.some(
        (cs) => cs.toUpperCase() === cleanName || cleanName.includes(cs.toUpperCase()) || cs.toUpperCase().includes(cleanName)
      );
      if (match) {
        return {
          salesName: cfg.salesName,
          trainerName: cfg.trainerCovered,
          coverArea: cfg.area,
        };
      }
    }
  }

  return {
    salesName: 'ILHAMSYAH',
    trainerName: 'ARA & RATIH',
    coverArea: 'PEKAN BARU',
  };
}

/**
 * Inisialisasi awal master toko dari transaksi Google Sheet yang terhubung
 */
export function extractInitialMasterStoresFromTransactions(
  transactions: TransactionRecord[]
): MasterStoreItem[] {
  const storeMap = new Map<string, MasterStoreItem>();

  // 1. Masukkan semua toko unik dari transaksi Google Sheet
  transactions.forEach((r, idx) => {
    const sName = (r.NAMA_STORE || '').trim();
    if (!sName) return;

    const key = sName.toUpperCase();
    const rawBa = (r.BA || '').trim();
    const isBaValid = !isPlaceholderBaName(rawBa, sName);

    if (!storeMap.has(key)) {
      const official = findOfficialSalesAndTrainerForStore(sName);
      storeMap.set(key, {
        id: `store-m-${idx + 1}-${Date.now().toString(36)}`,
        storeName: sName,
        hasBa: isBaValid,
        baName: isBaValid ? rawBa : '- (Non-BA)',
        baNumber: isBaValid ? (r.BA_Number || `BA-${Math.floor(100 + Math.random() * 900)}`) : undefined,
        salesName: (r.SALES && r.SALES !== '-' ? r.SALES : official.salesName).trim(),
        trainerName: official.trainerName,
        coverArea: (r.COVER_AREA && r.COVER_AREA !== '-' ? r.COVER_AREA : official.coverArea).trim(),
        region: (r.REGION && r.REGION !== '-' ? r.REGION : 'PEKAN BARU').trim(),
        spvName: (r.SPV && r.SPV !== '-' ? r.SPV : 'WIDODO').trim(),
        channel: detectStoreChannel(sName),
      });
    } else {
      // Jika sebelumnya belum tercatat BA valid namun di baris ini ada BA valid, perbarui BA-nya
      const current = storeMap.get(key)!;
      if (!current.hasBa && isBaValid) {
        current.hasBa = true;
        current.baName = rawBa;
        if (r.BA_Number) current.baNumber = r.BA_Number;
      }
      if (r.SALES && r.SALES !== '-' && (!current.salesName || current.salesName === '-')) {
        current.salesName = r.SALES;
      }
    }
  });

  // 2. Pastikan 69 toko resmi dari konfigurasi 6 Sales tercover
  VALID_KPI_SALES_NAMES.forEach((sName) => {
    const cfg = SALES_MASTER_6_CONFIG[sName];
    if (cfg && cfg.coveredStores) {
      cfg.coveredStores.forEach((cs, cIdx) => {
        const key = cs.toUpperCase();
        if (!storeMap.has(key)) {
          storeMap.set(key, {
            id: `store-official-${sName.toLowerCase().replace(/\s+/g, '')}-${cIdx + 1}`,
            storeName: cs,
            hasBa: true,
            baName: `BA ${cs.split(' ')[0]}`,
            baNumber: `BA-0${cIdx + 1}`,
            salesName: cfg.salesName,
            trainerName: cfg.trainerCovered,
            coverArea: cfg.area,
            region: 'PEKAN BARU',
            spvName: cfg.spv || 'WIDODO',
            channel: detectStoreChannel(cs),
          });
        }
      });
    }
  });

  // Gabungkan otomatis toko yang memiliki Nama BA sama
  return mergeMasterStoresByBa(Array.from(storeMap.values()));
}

/**
 * Memuat master list toko (dengan dukungan localStorage persistensi & penggabungan BA sama)
 */
export function loadMasterStoreList(transactions: TransactionRecord[] = []): MasterStoreItem[] {
  try {
    const raw = localStorage.getItem(MASTER_STORE_STORAGE_KEY);
    if (raw) {
      const parsed: MasterStoreItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Kumpulkan semua nama toko (termasuk toko yang sudah digabung dengan koma)
        const existingSet = new Set<string>();
        parsed.forEach((p) => {
          splitMasterStoreNames(p.storeName).forEach((tok) => {
            existingSet.add(tok.toUpperCase());
          });
          if (p.monthlyStoreNames) {
            Object.values(p.monthlyStoreNames).forEach((mStore) => {
              splitMasterStoreNames(mStore).forEach((tok) => {
                existingSet.add(tok.toUpperCase());
              });
            });
          }
        });

        const missingStores: MasterStoreItem[] = [];

        if (transactions.length > 0) {
          transactions.forEach((r) => {
            const sName = (r.NAMA_STORE || '').trim();
            if (!sName) return;
            const key = sName.toUpperCase();
            if (!existingSet.has(key)) {
              existingSet.add(key);
              const official = findOfficialSalesAndTrainerForStore(sName);
              const rawBa = (r.BA || '').trim();
              const isBaValid = !isPlaceholderBaName(rawBa, sName);

              missingStores.push({
                id: `store-new-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
                storeName: sName,
                hasBa: isBaValid,
                baName: isBaValid ? rawBa : '- (Non-BA)',
                baNumber: r.BA_Number || undefined,
                salesName: (r.SALES && r.SALES !== '-' ? r.SALES : official.salesName).trim(),
                trainerName: official.trainerName,
                coverArea: (r.COVER_AREA && r.COVER_AREA !== '-' ? r.COVER_AREA : official.coverArea).trim(),
                region: (r.REGION && r.REGION !== '-' ? r.REGION : 'PEKAN BARU').trim(),
                spvName: (r.SPV && r.SPV !== '-' ? r.SPV : 'WIDODO').trim(),
                channel: detectStoreChannel(sName),
              });
            }
          });
        }

        const combined = [...parsed, ...missingStores];
        const mergedByBa = mergeMasterStoresByBa(combined);

        if (missingStores.length > 0 || mergedByBa.length !== parsed.length) {
          saveMasterStoreList(mergedByBa);
        }
        return mergedByBa;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca master store dari localStorage', e);
  }

  // Jika belum ada di localStorage, buat baru dari transaksi
  const initial = extractInitialMasterStoresFromTransactions(transactions);
  if (initial.length > 0) {
    saveMasterStoreList(initial);
  }
  return initial;
}

/**
 * Menyimpan master list toko ke localStorage (otomatis menjaga penggabungan BA sama)
 */
export function saveMasterStoreList(stores: MasterStoreItem[]): void {
  try {
    const normalized = mergeMasterStoresByBa(stores);
    localStorage.setItem(MASTER_STORE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Gagal menyimpan master store ke localStorage', e);
  }
}

/**
 * Reset master list toko ke data awal transaksi Google Sheet
 */
export function resetMasterStoreListToSheet(transactions: TransactionRecord[]): MasterStoreItem[] {
  try {
    localStorage.removeItem(MASTER_STORE_STORAGE_KEY);
  } catch {}
  const fresh = extractInitialMasterStoresFromTransactions(transactions);
  saveMasterStoreList(fresh);
  return fresh;
}

/**
 * Memuat data override manual Penjualan KA & Penjualan MG
 */
export function loadKaMgSalesOverride(): KaMgSalesOverride {
  try {
    const raw = localStorage.getItem(KA_MG_SALES_OVERRIDE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca override KA & MG dari localStorage', e);
  }
  return {
    isManual: false,
    kaSalesValue: 0,
    mgSalesValue: 0,
    notes: '',
  };
}

/**
 * Menyimpan data override manual Penjualan KA & Penjualan MG
 */
export function saveKaMgSalesOverride(data: KaMgSalesOverride): void {
  try {
    localStorage.setItem(
      KA_MG_SALES_OVERRIDE_KEY,
      JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
    );
  } catch (e) {
    console.warn('Gagal menyimpan override KA & MG ke localStorage', e);
  }
}

/**
 * Reset override KA & MG ke hitungan otomatis
 */
export function resetKaMgSalesOverride(): void {
  try {
    localStorage.removeItem(KA_MG_SALES_OVERRIDE_KEY);
  } catch {}
}
