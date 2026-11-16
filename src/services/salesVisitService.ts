import {
  SalesVisitRecord,
  SalesVisitSalesName,
  TransactionRecord,
} from '../types/dashboard';
import { loadMasterStoreList } from './masterStoreService';

export const SALES_VISIT_STORAGE_KEY = 'salespro_sales_visits_v1';

export const SALES_VISIT_OPTIONS: SalesVisitSalesName[] = [
  'ILHAMSYAH',
  'TIWI',
  'ALBERT',
];

export const MONTH_NAMES_ID = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
] as const;

export const MONTH_OPTIONS_2026 = MONTH_NAMES_ID.map((m) => `${m} 2026`);

export const DEFAULT_PEKANBARU_CENTER = {
  lat: 0.5070677,
  lng: 101.4477793,
};

export interface PresetAreaLocation {
  label: string;
  lat: number;
  lng: number;
}

export const RIAU_PRESET_LOCATIONS: PresetAreaLocation[] = [
  { label: 'Pekanbaru Kota (Sudirman)', lat: 0.5071, lng: 101.4478 },
  { label: 'Marpoyan / Arifin Ahmad', lat: 0.4718, lng: 101.4342 },
  { label: 'Panam / Tampan Pekanbaru', lat: 0.4648, lng: 101.3852 },
  { label: 'Bangkinang (Kampar)', lat: 0.3358, lng: 101.0253 },
  { label: 'Duri (Mandau)', lat: 1.2587, lng: 101.2089 },
  { label: 'Dumai Kota', lat: 1.6671, lng: 101.4432 },
];

export function getMonthOptions(visits: SalesVisitRecord[] = []): string[] {
  const currentYear = new Date().getFullYear();
  const baseYears = Array.from(new Set([2026, currentYear])).sort();
  const options: string[] = [];
  baseYears.forEach((yr) => {
    MONTH_NAMES_ID.forEach((m) => options.push(`${m} ${yr}`));
  });
  visits.forEach((v) => {
    const normalized = (v.monthPeriod || '').trim().toUpperCase();
    if (normalized && !options.includes(normalized)) {
      options.push(normalized);
    }
  });
  return options;
}

export function getDefaultRunningMonth(filterBulan?: string, filterTahun?: string): string {
  const now = new Date();
  const yr =
    filterTahun && filterTahun !== 'ALL'
      ? Number(filterTahun) || 2026
      : 2026;
  if (filterBulan && filterBulan !== 'ALL') {
    const clean = filterBulan.trim().toUpperCase();
    if (/\d{4}$/.test(clean)) return clean;
    return `${clean} ${yr}`;
  }
  const monthIdx = now.getMonth();
  const monthName = MONTH_NAMES_ID[monthIdx] || 'OKTOBER';
  const activeYear = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  return `${monthName} ${activeYear}`;
}

export function getCurrentFormattedTimestamp(date: Date = new Date()): {
  display: string;
  iso: string;
} {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return {
    display: `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`,
    iso: date.toISOString(),
  };
}

export function loadSalesVisits(): SalesVisitRecord[] {
  try {
    const raw = localStorage.getItem(SALES_VISIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SalesVisitRecord =>
          Boolean(item && typeof item.id === 'string' && typeof item.storeName === 'string')
      )
      .sort((a, b) => (b.visitIso || b.createdAt).localeCompare(a.visitIso || a.createdAt));
  } catch (err) {
    console.warn('Gagal memuat riwayat kunjungan sales dari localStorage', err);
    return [];
  }
}

export function saveSalesVisits(visits: SalesVisitRecord[]): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(SALES_VISIT_STORAGE_KEY, JSON.stringify(visits));
    return { ok: true };
  } catch (err) {
    console.warn('Gagal menyimpan riwayat kunjungan sales ke localStorage', err);
    return {
      ok: false,
      error: 'Penyimpanan browser penuh. Coba hapus beberapa foto kunjungan lama atau gunakan foto berukuran lebih kecil.',
    };
  }
}

export function upsertSalesVisit(
  currentList: SalesVisitRecord[],
  record: SalesVisitRecord
): { nextList: SalesVisitRecord[]; ok: boolean; error?: string } {
  const existsIdx = currentList.findIndex((v) => v.id === record.id);
  const nextList =
    existsIdx >= 0
      ? currentList.map((v) => (v.id === record.id ? record : v))
      : [record, ...currentList];
  nextList.sort((a, b) => (b.visitIso || b.createdAt).localeCompare(a.visitIso || a.createdAt));
  const saved = saveSalesVisits(nextList);
  return { nextList: saved.ok ? nextList : currentList, ok: saved.ok, error: saved.error };
}

export function deleteSalesVisit(
  currentList: SalesVisitRecord[],
  id: string
): { nextList: SalesVisitRecord[]; ok: boolean; error?: string } {
  const nextList = currentList.filter((v) => v.id !== id);
  const saved = saveSalesVisits(nextList);
  return { nextList: saved.ok ? nextList : currentList, ok: saved.ok, error: saved.error };
}

export function extractStoreOptions(transactions: TransactionRecord[]): string[] {
  const seen: Record<string, string> = {};
  const masterStores = loadMasterStoreList(transactions);
  masterStores.forEach((m) => {
    const clean = (m.storeName || '').trim();
    if (clean) {
      seen[clean.toUpperCase()] = clean;
    }
  });
  transactions.forEach((r) => {
    const clean = (r.NAMA_STORE || '').trim();
    if (clean && !seen[clean.toUpperCase()]) {
      seen[clean.toUpperCase()] = clean;
    }
  });
  return Object.values(seen).sort((a, b) => a.localeCompare(b, 'id-ID'));
}

export function compressImageFileToDataUrl(
  file: File,
  maxDim = 640,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto selfie.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia untuk memproses foto.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function captureVideoFrameToDataUrl(
  video: HTMLVideoElement,
  maxDim = 640,
  quality = 0.75
): string {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  let width = vw;
  let height = vh;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Gagal menangkap gambar dari kamera.');
  }
  // Mirror horizontally for natural selfie view
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export interface MonthlyVisitRecapRow {
  monthPeriod: string;
  counts: Record<SalesVisitSalesName, number>;
  total: number;
  uniqueStores: number;
}

export interface SalesVisitsRecapSummary {
  totalVisits: number;
  totalsBySales: Record<SalesVisitSalesName, number>;
  uniqueStoresCount: number;
  monthlyRows: MonthlyVisitRecapRow[];
}

export function aggregateSalesVisitsRecap(
  visits: SalesVisitRecord[],
  monthList: string[]
): SalesVisitsRecapSummary {
  const totalsBySales: Record<SalesVisitSalesName, number> = {
    ILHAMSYAH: 0,
    TIWI: 0,
    ALBERT: 0,
  };
  const globalStoreSet: Record<string, boolean> = {};
  const monthBuckets: Record<
    string,
    {
      counts: Record<SalesVisitSalesName, number>;
      stores: Record<string, boolean>;
    }
  > = {};

  monthList.forEach((m) => {
    monthBuckets[m] = {
      counts: { ILHAMSYAH: 0, TIWI: 0, ALBERT: 0 },
      stores: {},
    };
  });

  visits.forEach((v) => {
    const sName = v.salesName;
    if (sName === 'ILHAMSYAH' || sName === 'TIWI' || sName === 'ALBERT') {
      totalsBySales[sName] += 1;
    }
    const storeKey = (v.storeName || '').trim().toUpperCase();
    if (storeKey) globalStoreSet[storeKey] = true;

    const mKey = (v.monthPeriod || '').trim().toUpperCase();
    if (!monthBuckets[mKey]) {
      monthBuckets[mKey] = {
        counts: { ILHAMSYAH: 0, TIWI: 0, ALBERT: 0 },
        stores: {},
      };
    }
    if (sName === 'ILHAMSYAH' || sName === 'TIWI' || sName === 'ALBERT') {
      monthBuckets[mKey].counts[sName] += 1;
    }
    if (storeKey) {
      monthBuckets[mKey].stores[storeKey] = true;
    }
  });

  const orderedMonths = Array.from(
    new Set([...monthList, ...Object.keys(monthBuckets)])
  );

  const monthlyRows: MonthlyVisitRecapRow[] = orderedMonths.map((monthPeriod) => {
    const bucket = monthBuckets[monthPeriod] || {
      counts: { ILHAMSYAH: 0, TIWI: 0, ALBERT: 0 },
      stores: {},
    };
    const total =
      bucket.counts.ILHAMSYAH + bucket.counts.TIWI + bucket.counts.ALBERT;
    return {
      monthPeriod,
      counts: bucket.counts,
      total,
      uniqueStores: Object.keys(bucket.stores).length,
    };
  });

  return {
    totalVisits: visits.length,
    totalsBySales,
    uniqueStoresCount: Object.keys(globalStoreSet).length,
    monthlyRows,
  };
}
