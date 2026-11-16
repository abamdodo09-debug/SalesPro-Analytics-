import {
  OnlinePromoReportComputedItem,
  OnlinePromoReportItem,
} from '../types/dashboard';
import { MONTH_NAMES_ID } from './salesVisitService';

// Dedicated manual-only storage key (starts completely empty as requested)
export const ONLINE_PROMO_STORAGE_KEY = 'salespro_online_promo_manual_v2';
const LEGACY_ONLINE_PROMO_STORAGE_KEY = 'salespro_online_promo_reports_v1';

export function parseMonthPeriodOrder(monthPeriod: string): number {
  const clean = (monthPeriod || '').trim().toUpperCase();
  const parts = clean.split(/\s+/);
  const mIdx = MONTH_NAMES_ID.findIndex((m) => m === parts[0]);
  const year = parts[1] ? Number(parts[1]) || 2026 : 2026;
  return year * 100 + (mIdx >= 0 ? mIdx + 1 : 0);
}

export function deriveMonthPeriodFromIsoDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return 'NOVEMBER 2026';
  }
  const [yrStr, moStr] = isoDate.split('-');
  const moIdx = Math.max(0, Math.min(11, Number(moStr) - 1));
  const mName = MONTH_NAMES_ID[moIdx] || 'NOVEMBER';
  return `${mName} ${yrStr}`;
}

export function formatDisplayDateId(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export function loadOnlinePromoReports(): OnlinePromoReportItem[] {
  try {
    // Ensure any legacy pre-seeded key is cleared so report starts cleanly empty & manual-only
    if (localStorage.getItem(LEGACY_ONLINE_PROMO_STORAGE_KEY) !== null) {
      localStorage.removeItem(LEGACY_ONLINE_PROMO_STORAGE_KEY);
    }
    const raw = localStorage.getItem(ONLINE_PROMO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OnlinePromoReportItem =>
        Boolean(item && typeof item.id === 'string' && typeof item.storeName === 'string')
    );
  } catch (err) {
    console.warn('Gagal membaca Report Promo Toko Online dari localStorage', err);
    return [];
  }
}

export function saveOnlinePromoReports(items: OnlinePromoReportItem[]): void {
  try {
    localStorage.setItem(ONLINE_PROMO_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Gagal menyimpan Report Promo Toko Online ke localStorage', err);
  }
}

export function clearAllOnlinePromoReports(): OnlinePromoReportItem[] {
  try {
    localStorage.removeItem(ONLINE_PROMO_STORAGE_KEY);
  } catch {}
  return [];
}

export function upsertOnlinePromoReport(
  currentList: OnlinePromoReportItem[],
  item: OnlinePromoReportItem
): OnlinePromoReportItem[] {
  const exists = currentList.some((x) => x.id === item.id);
  const next = exists
    ? currentList.map((x) => (x.id === item.id ? item : x))
    : [item, ...currentList];
  saveOnlinePromoReports(next);
  return next;
}

export function deleteOnlinePromoReport(
  currentList: OnlinePromoReportItem[],
  id: string
): OnlinePromoReportItem[] {
  const next = currentList.filter((x) => x.id !== id);
  saveOnlinePromoReports(next);
  return next;
}

export function computeOnlinePromoGrowth(
  items: OnlinePromoReportItem[]
): OnlinePromoReportComputedItem[] {
  // Group manual entries by normalized store name
  const byStore: Record<string, OnlinePromoReportItem[]> = {};
  items.forEach((item) => {
    const key = (item.storeName || '').trim().toUpperCase();
    if (!byStore[key]) byStore[key] = [];
    byStore[key].push(item);
  });

  const computedById: Record<string, OnlinePromoReportComputedItem> = {};

  Object.values(byStore).forEach((storeItems) => {
    // 1) Daily chronological order per store (by date ascending, then createdAt)
    const sortedDailyAsc = [...storeItems].sort((a, b) => {
      const dDiff = (a.date || '').localeCompare(b.date || '');
      if (dDiff !== 0) return dDiff;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Aggregate per date so multiple entries on the same day or sequential days compare cleanly
    const dateTotalsAsc: Array<{ date: string; total: number }> = [];
    const dateTotalLookup: Record<string, number> = {};
    sortedDailyAsc.forEach((it) => {
      const d = it.date || '';
      if (dateTotalLookup[d] === undefined) {
        dateTotalLookup[d] = 0;
        dateTotalsAsc.push({ date: d, total: 0 });
      }
      dateTotalLookup[d] += it.actual;
    });
    dateTotalsAsc.forEach((entry) => {
      entry.total = dateTotalLookup[entry.date];
    });

    // 2) Monthly totals per store sorted chronologically ascending
    const monthTotalsMap: Record<string, number> = {};
    storeItems.forEach((it) => {
      const mp = (it.monthPeriod || '').trim().toUpperCase();
      monthTotalsMap[mp] = (monthTotalsMap[mp] || 0) + it.actual;
    });
    const sortedMonthsAsc = Object.keys(monthTotalsMap).sort(
      (a, b) => parseMonthPeriodOrder(a) - parseMonthPeriodOrder(b)
    );

    sortedDailyAsc.forEach((item, idx) => {
      // Daily comparison: vs immediately previous date entry (or previous distinct date)
      let dailyPreviousActual: number | null = null;
      let dailyPreviousDate: string | null = null;

      // Prefer previous distinct date for the store; if multiple entries exist on same date, fall back to previous entry
      const currentDateIdx = dateTotalsAsc.findIndex((d) => d.date === item.date);
      if (currentDateIdx > 0) {
        const prevDateObj = dateTotalsAsc[currentDateIdx - 1];
        dailyPreviousActual = prevDateObj.total;
        dailyPreviousDate = prevDateObj.date;
      } else if (idx > 0) {
        const prevItem = sortedDailyAsc[idx - 1];
        dailyPreviousActual = prevItem.actual;
        dailyPreviousDate = prevItem.date;
      }

      const dailyBaseValue =
        currentDateIdx > 0 && dateTotalLookup[item.date] !== undefined
          ? dateTotalLookup[item.date]
          : item.actual;

      let dailyGrowthDelta: number | null = null;
      let dailyGrowthPercent: number | null = null;
      if (dailyPreviousActual !== null && dailyPreviousActual > 0) {
        dailyGrowthDelta = item.actual - dailyPreviousActual;
        dailyGrowthPercent = ((item.actual - dailyPreviousActual) / dailyPreviousActual) * 100;
        // Note: if only one row on that date, dailyBaseValue === item.actual. Keep row-level actual vs prev day!
        void dailyBaseValue;
      }

      // Monthly comparison: cumulative store total in item.monthPeriod vs previous month
      const mp = (item.monthPeriod || '').trim().toUpperCase();
      const monthlyStoreTotal = monthTotalsMap[mp] ?? item.actual;
      const mpIdx = sortedMonthsAsc.indexOf(mp);
      const prevMp = mpIdx > 0 ? sortedMonthsAsc[mpIdx - 1] : null;
      const monthlyPreviousActual = prevMp ? monthTotalsMap[prevMp] : null;

      let monthlyGrowthDelta: number | null = null;
      let monthlyGrowthPercent: number | null = null;
      if (monthlyPreviousActual !== null && monthlyPreviousActual > 0) {
        monthlyGrowthDelta = monthlyStoreTotal - monthlyPreviousActual;
        monthlyGrowthPercent =
          ((monthlyStoreTotal - monthlyPreviousActual) / monthlyPreviousActual) * 100;
      }

      computedById[item.id] = {
        ...item,
        dailyPreviousActual,
        dailyPreviousDate,
        dailyGrowthDelta,
        dailyGrowthPercent,
        monthlyStoreTotal,
        monthlyPreviousActual,
        monthlyPreviousLabel: prevMp,
        monthlyGrowthDelta,
        monthlyGrowthPercent,
      };
    });
  });

  // Sort newest date / month first for clean display
  return items
    .map((i) => computedById[i.id])
    .filter(Boolean)
    .sort((a, b) => {
      const dDiff = (b.date || '').localeCompare(a.date || '');
      if (dDiff !== 0) return dDiff;
      const mDiff = parseMonthPeriodOrder(b.monthPeriod) - parseMonthPeriodOrder(a.monthPeriod);
      if (mDiff !== 0) return mDiff;
      return b.actual - a.actual;
    });
}

export interface DailyOnlinePromoRecapRow {
  date: string;
  monthPeriod: string;
  totalActual: number;
  previousTotalActual: number | null;
  previousDate: string | null;
  growthDelta: number | null;
  growthPercent: number | null;
  storeCount: number;
  entryCount: number;
}

export function aggregateDailyOnlinePromoRecap(
  items: OnlinePromoReportItem[]
): DailyOnlinePromoRecapRow[] {
  const buckets: Record<
    string,
    { date: string; monthPeriod: string; totalActual: number; stores: Record<string, boolean>; count: number }
  > = {};

  items.forEach((item) => {
    const d = (item.date || '').trim();
    if (!d) return;
    if (!buckets[d]) {
      buckets[d] = {
        date: d,
        monthPeriod: item.monthPeriod,
        totalActual: 0,
        stores: {},
        count: 0,
      };
    }
    buckets[d].totalActual += item.actual;
    buckets[d].stores[item.storeName.trim().toUpperCase()] = true;
    buckets[d].count += 1;
  });

  const sortedDatesAsc = Object.keys(buckets).sort((a, b) => a.localeCompare(b));

  const rowsAsc = sortedDatesAsc.map((d, idx) => {
    const b = buckets[d];
    const prevDate = idx > 0 ? sortedDatesAsc[idx - 1] : null;
    const prevActual = prevDate ? buckets[prevDate].totalActual : null;
    const growthDelta = prevActual !== null ? b.totalActual - prevActual : null;
    const growthPercent =
      prevActual !== null && prevActual > 0
        ? ((b.totalActual - prevActual) / prevActual) * 100
        : null;

    return {
      date: b.date,
      monthPeriod: b.monthPeriod,
      totalActual: b.totalActual,
      previousTotalActual: prevActual,
      previousDate: prevDate,
      growthDelta,
      growthPercent,
      storeCount: Object.keys(b.stores).length,
      entryCount: b.count,
    };
  });

  return rowsAsc.reverse();
}

export interface MonthlyOnlinePromoRecapRow {
  monthPeriod: string;
  totalActual: number;
  previousTotalActual: number | null;
  previousMonthPeriod: string | null;
  growthPercent: number | null;
  growthDelta: number | null;
  storeCount: number;
  entryCount: number;
}

export function aggregateMonthlyOnlinePromoRecap(
  items: OnlinePromoReportItem[]
): MonthlyOnlinePromoRecapRow[] {
  const buckets: Record<
    string,
    { totalActual: number; stores: Record<string, boolean>; count: number }
  > = {};

  items.forEach((item) => {
    const mp = (item.monthPeriod || '').trim().toUpperCase();
    if (!mp) return;
    if (!buckets[mp]) {
      buckets[mp] = { totalActual: 0, stores: {}, count: 0 };
    }
    buckets[mp].totalActual += item.actual;
    buckets[mp].stores[item.storeName.trim().toUpperCase()] = true;
    buckets[mp].count += 1;
  });

  const sortedMonthsAsc = Object.keys(buckets).sort(
    (a, b) => parseMonthPeriodOrder(a) - parseMonthPeriodOrder(b)
  );

  return sortedMonthsAsc.map((mp, idx) => {
    const b = buckets[mp];
    const prevMp = idx > 0 ? sortedMonthsAsc[idx - 1] : null;
    const prevActual = prevMp ? buckets[prevMp].totalActual : null;
    const growthDelta = prevActual !== null ? b.totalActual - prevActual : null;
    const growthPercent =
      prevActual !== null && prevActual > 0
        ? ((b.totalActual - prevActual) / prevActual) * 100
        : null;

    return {
      monthPeriod: mp,
      totalActual: b.totalActual,
      previousTotalActual: prevActual,
      previousMonthPeriod: prevMp,
      growthPercent,
      growthDelta,
      storeCount: Object.keys(b.stores).length,
      entryCount: b.count,
    };
  });
}
