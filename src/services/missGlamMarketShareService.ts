import { MissGlamMarketShareItem } from '../types/dashboard';
import { parseMonthPeriodOrder } from './onlinePromoService';

export const MG_STORES_STORAGE_KEY = 'salespro_mg_stores_v1';
export const MG_MARKET_SHARE_STORAGE_KEY = 'salespro_mg_market_share_v1';

export const DEFAULT_MG_STORES: string[] = [
  'MG PANAM',
  'MG MARPOYAN',
  'MG SUDIRMAN2',
  'MG DUMAI',
  'MG DURI',
  'MG TEMBILAHAN',
  'MG BUKIT BARISAN',
  'MG BAGAN BATU',
];

export function loadMgStoreOptions(): string[] {
  try {
    const raw = localStorage.getItem(MG_STORES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleanSet: Record<string, string> = {};
        DEFAULT_MG_STORES.forEach((s) => {
          cleanSet[s.toUpperCase()] = s;
        });
        parsed.forEach((s) => {
          if (typeof s === 'string' && s.trim()) {
            const clean = s.trim().toUpperCase();
            cleanSet[clean] = clean;
          }
        });
        return Object.values(cleanSet);
      }
    }
  } catch (err) {
    console.warn('Gagal memuat daftar toko MissGlam dari localStorage', err);
  }
  return [...DEFAULT_MG_STORES];
}

export function saveMgStoreOptions(stores: string[]): void {
  try {
    localStorage.setItem(MG_STORES_STORAGE_KEY, JSON.stringify(stores));
  } catch (err) {
    console.warn('Gagal menyimpan daftar toko MissGlam ke localStorage', err);
  }
}

export function addMgStoreOption(
  currentStores: string[],
  newStoreName: string
): { nextStores: string[]; addedName: string; alreadyExists: boolean } {
  const clean = newStoreName.trim().toUpperCase();
  if (!clean) {
    return { nextStores: currentStores, addedName: '', alreadyExists: false };
  }
  const exists = currentStores.some((s) => s.toUpperCase() === clean);
  if (exists) {
    return { nextStores: currentStores, addedName: clean, alreadyExists: true };
  }
  const nextStores = [...currentStores, clean];
  saveMgStoreOptions(nextStores);
  return { nextStores, addedName: clean, alreadyExists: false };
}

export function removeMgStoreOption(
  currentStores: string[],
  storeName: string
): string[] {
  const upper = storeName.trim().toUpperCase();
  if (DEFAULT_MG_STORES.includes(upper)) {
    return currentStores;
  }
  const nextStores = currentStores.filter((s) => s.toUpperCase() !== upper);
  saveMgStoreOptions(nextStores);
  return nextStores;
}

export function loadMgMarketShareItems(): MissGlamMarketShareItem[] {
  try {
    const raw = localStorage.getItem(MG_MARKET_SHARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MissGlamMarketShareItem =>
        Boolean(item && typeof item.id === 'string' && typeof item.storeName === 'string')
    );
  } catch (err) {
    console.warn('Gagal membaca data Market Share MissGlam dari localStorage', err);
    return [];
  }
}

export function saveMgMarketShareItems(items: MissGlamMarketShareItem[]): void {
  try {
    localStorage.setItem(MG_MARKET_SHARE_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Gagal menyimpan data Market Share MissGlam ke localStorage', err);
  }
}

export function clearAllMgMarketShareItems(): MissGlamMarketShareItem[] {
  try {
    localStorage.removeItem(MG_MARKET_SHARE_STORAGE_KEY);
  } catch {}
  return [];
}

export function upsertMgMarketShareItem(
  currentList: MissGlamMarketShareItem[],
  item: MissGlamMarketShareItem
): MissGlamMarketShareItem[] {
  const exists = currentList.some((x) => x.id === item.id);
  const next = exists
    ? currentList.map((x) => (x.id === item.id ? item : x))
    : [item, ...currentList];
  saveMgMarketShareItems(next);
  return next;
}

export function deleteMgMarketShareItem(
  currentList: MissGlamMarketShareItem[],
  id: string
): MissGlamMarketShareItem[] {
  const next = currentList.filter((x) => x.id !== id);
  saveMgMarketShareItems(next);
  return next;
}

export function computeMarketSharePct(actual: number, storeOmset: number): number {
  if (!Number.isFinite(actual) || !Number.isFinite(storeOmset) || storeOmset <= 0) {
    return 0;
  }
  return Number(((actual / storeOmset) * 100).toFixed(2));
}

export interface MonthlyMgMarketShareRecapRow {
  monthPeriod: string;
  totalActual: number;
  totalStoreOmset: number;
  marketSharePercent: number;
  storeCount: number;
  entryCount: number;
}

export function aggregateMonthlyMgRecap(
  items: MissGlamMarketShareItem[]
): MonthlyMgMarketShareRecapRow[] {
  const buckets: Record<
    string,
    { actual: number; omset: number; stores: Record<string, boolean>; count: number }
  > = {};

  items.forEach((it) => {
    const mp = (it.monthPeriod || '').trim().toUpperCase();
    if (!mp) return;
    if (!buckets[mp]) {
      buckets[mp] = { actual: 0, omset: 0, stores: {}, count: 0 };
    }
    buckets[mp].actual += Number(it.actual) || 0;
    buckets[mp].omset += Number(it.storeOmset) || 0;
    buckets[mp].stores[it.storeName.trim().toUpperCase()] = true;
    buckets[mp].count += 1;
  });

  const sortedMonths = Object.keys(buckets).sort(
    (a, b) => parseMonthPeriodOrder(b) - parseMonthPeriodOrder(a)
  );

  return sortedMonths.map((mp) => {
    const b = buckets[mp];
    return {
      monthPeriod: mp,
      totalActual: b.actual,
      totalStoreOmset: b.omset,
      marketSharePercent: computeMarketSharePct(b.actual, b.omset),
      storeCount: Object.keys(b.stores).length,
      entryCount: b.count,
    };
  });
}

export interface PerStoreMgMarketShareRecapRow {
  storeName: string;
  totalActual: number;
  totalStoreOmset: number;
  marketSharePercent: number;
  monthsCount: number;
  entryCount: number;
  isDefaultStore: boolean;
}

export function aggregatePerStoreMgRecap(
  items: MissGlamMarketShareItem[],
  storeOptions: string[],
  filterMonth: string = 'ALL'
): PerStoreMgMarketShareRecapRow[] {
  const relevantItems =
    filterMonth === 'ALL'
      ? items
      : items.filter(
          (i) => i.monthPeriod.trim().toUpperCase() === filterMonth.trim().toUpperCase()
        );

  const buckets: Record<
    string,
    {
      display: string;
      actual: number;
      omset: number;
      months: Record<string, boolean>;
      count: number;
    }
  > = {};

  storeOptions.forEach((s) => {
    const up = s.trim().toUpperCase();
    buckets[up] = { display: up, actual: 0, omset: 0, months: {}, count: 0 };
  });

  relevantItems.forEach((it) => {
    const up = it.storeName.trim().toUpperCase();
    if (!buckets[up]) {
      buckets[up] = { display: up, actual: 0, omset: 0, months: {}, count: 0 };
    }
    buckets[up].actual += Number(it.actual) || 0;
    buckets[up].omset += Number(it.storeOmset) || 0;
    if (it.monthPeriod) {
      buckets[up].months[it.monthPeriod.trim().toUpperCase()] = true;
    }
    buckets[up].count += 1;
  });

  return Object.values(buckets)
    .map((b) => ({
      storeName: b.display,
      totalActual: b.actual,
      totalStoreOmset: b.omset,
      marketSharePercent: computeMarketSharePct(b.actual, b.omset),
      monthsCount: Object.keys(b.months).length,
      entryCount: b.count,
      isDefaultStore: DEFAULT_MG_STORES.includes(b.display),
    }))
    .sort((a, b) => {
      if (b.marketSharePercent !== a.marketSharePercent) {
        return b.marketSharePercent - a.marketSharePercent;
      }
      if (b.totalActual !== a.totalActual) {
        return b.totalActual - a.totalActual;
      }
      return a.storeName.localeCompare(b.storeName, 'id-ID');
    });
}
