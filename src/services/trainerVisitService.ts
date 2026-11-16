import { TrainerVisitName, TrainerVisitRecord } from '../types/dashboard';
import { MONTH_NAMES_ID } from './salesVisitService';

export const TRAINER_VISIT_STORAGE_KEY = 'salespro_trainer_visits_v1';

export const TRAINER_VISIT_OPTIONS: TrainerVisitName[] = ['ARA', 'RATIH'];

export function getTrainerMonthOptions(visits: TrainerVisitRecord[] = []): string[] {
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

export function loadTrainerVisits(): TrainerVisitRecord[] {
  try {
    const raw = localStorage.getItem(TRAINER_VISIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is TrainerVisitRecord =>
          Boolean(item && typeof item.id === 'string' && typeof item.storeName === 'string')
      )
      .sort((a, b) => (b.visitIso || b.createdAt).localeCompare(a.visitIso || a.createdAt));
  } catch (err) {
    console.warn('Gagal memuat riwayat kunjungan trainer dari localStorage', err);
    return [];
  }
}

export function saveTrainerVisits(
  visits: TrainerVisitRecord[]
): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(TRAINER_VISIT_STORAGE_KEY, JSON.stringify(visits));
    return { ok: true };
  } catch (err) {
    console.warn('Gagal menyimpan riwayat kunjungan trainer ke localStorage', err);
    return {
      ok: false,
      error:
        'Penyimpanan browser penuh. Coba hapus beberapa foto kunjungan lama atau gunakan foto berukuran lebih kecil.',
    };
  }
}

export function upsertTrainerVisit(
  currentList: TrainerVisitRecord[],
  record: TrainerVisitRecord
): { nextList: TrainerVisitRecord[]; ok: boolean; error?: string } {
  const existsIdx = currentList.findIndex((v) => v.id === record.id);
  const nextList =
    existsIdx >= 0
      ? currentList.map((v) => (v.id === record.id ? record : v))
      : [record, ...currentList];
  nextList.sort((a, b) => (b.visitIso || b.createdAt).localeCompare(a.visitIso || a.createdAt));
  const saved = saveTrainerVisits(nextList);
  return { nextList: saved.ok ? nextList : currentList, ok: saved.ok, error: saved.error };
}

export function deleteTrainerVisit(
  currentList: TrainerVisitRecord[],
  id: string
): { nextList: TrainerVisitRecord[]; ok: boolean; error?: string } {
  const nextList = currentList.filter((v) => v.id !== id);
  const saved = saveTrainerVisits(nextList);
  return { nextList: saved.ok ? nextList : currentList, ok: saved.ok, error: saved.error };
}

export interface MonthlyTrainerVisitRecapRow {
  monthPeriod: string;
  counts: Record<TrainerVisitName, number>;
  total: number;
  uniqueStores: number;
}

export interface TrainerVisitsRecapSummary {
  totalVisits: number;
  totalsByTrainer: Record<TrainerVisitName, number>;
  uniqueStoresCount: number;
  monthlyRows: MonthlyTrainerVisitRecapRow[];
}

export function aggregateTrainerVisitsRecap(
  visits: TrainerVisitRecord[],
  monthList: string[]
): TrainerVisitsRecapSummary {
  const totalsByTrainer: Record<TrainerVisitName, number> = {
    ARA: 0,
    RATIH: 0,
  };
  const globalStoreSet: Record<string, boolean> = {};
  const monthBuckets: Record<
    string,
    {
      counts: Record<TrainerVisitName, number>;
      stores: Record<string, boolean>;
    }
  > = {};

  monthList.forEach((m) => {
    monthBuckets[m] = {
      counts: { ARA: 0, RATIH: 0 },
      stores: {},
    };
  });

  visits.forEach((v) => {
    const tName = v.trainerName;
    if (tName === 'ARA' || tName === 'RATIH') {
      totalsByTrainer[tName] += 1;
    }
    const storeKey = (v.storeName || '').trim().toUpperCase();
    if (storeKey) globalStoreSet[storeKey] = true;

    const mKey = (v.monthPeriod || '').trim().toUpperCase();
    if (!monthBuckets[mKey]) {
      monthBuckets[mKey] = {
        counts: { ARA: 0, RATIH: 0 },
        stores: {},
      };
    }
    if (tName === 'ARA' || tName === 'RATIH') {
      monthBuckets[mKey].counts[tName] += 1;
    }
    if (storeKey) {
      monthBuckets[mKey].stores[storeKey] = true;
    }
  });

  const orderedMonths = Array.from(
    new Set([...monthList, ...Object.keys(monthBuckets)])
  );

  const monthlyRows: MonthlyTrainerVisitRecapRow[] = orderedMonths.map((monthPeriod) => {
    const bucket = monthBuckets[monthPeriod] || {
      counts: { ARA: 0, RATIH: 0 },
      stores: {},
    };
    const total = bucket.counts.ARA + bucket.counts.RATIH;
    return {
      monthPeriod,
      counts: bucket.counts,
      total,
      uniqueStores: Object.keys(bucket.stores).length,
    };
  });

  return {
    totalVisits: visits.length,
    totalsByTrainer,
    uniqueStoresCount: Object.keys(globalStoreSet).length,
    monthlyRows,
  };
}
