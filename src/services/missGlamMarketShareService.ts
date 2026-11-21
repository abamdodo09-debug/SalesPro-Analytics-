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

export interface MonthlyMgTrendPoint {
  monthPeriod: string;
  totalActual: number;
  totalStoreOmset: number;
  marketSharePercent: number;
  prevSharePercent: number | null;
  deltaSharePercent: number | null;
  storeCount: number;
}

export interface StoreMarketShareAnalysisItem {
  storeName: string;
  monthsCount: number;
  latestMonth: string | null;
  latestActual: number;
  latestOmset: number;
  latestShare: number;
  prevMonth: string | null;
  prevActual: number | null;
  prevOmset: number | null;
  prevShare: number | null;
  deltaShare: number | null;
  deltaActual: number | null;
  peakShare: number;
  peakMonth: string | null;
  trend: 'up' | 'down' | 'stable' | 'single' | 'empty';
  totalActual: number;
  totalOmset: number;
  overallShare: number;
  gapToAvgShare: number;
  targetBenchmarkShare: number;
  upsideActualRp: number;
  potentialScore: number;
  potentialReason: string;
  isHighPotential: boolean;
}

export interface MgMarketShareAnalyticsResult {
  networkAvgShare: number;
  topShare: number;
  topStoreName: string | null;
  increasingStores: StoreMarketShareAnalysisItem[];
  decreasingStores: StoreMarketShareAnalysisItem[];
  stableStores: StoreMarketShareAnalysisItem[];
  singleMonthStores: StoreMarketShareAnalysisItem[];
  potentialStores: StoreMarketShareAnalysisItem[];
  allActiveStores: StoreMarketShareAnalysisItem[];
  monthlyTrendChartData: MonthlyMgTrendPoint[];
}

export function analyzeMgStoreMarketShare(
  items: MissGlamMarketShareItem[],
  storeOptions: string[]
): MgMarketShareAnalyticsResult {
  // 1) Chronological monthly trend (ascending)
  const monthBuckets: Record<
    string,
    {
      actual: number;
      omset: number;
      stores: Record<string, boolean>;
      manualShares: number[];
    }
  > = {};

  items.forEach((it) => {
    const mp = (it.monthPeriod || '').trim().toUpperCase();
    if (!mp) return;
    if (!monthBuckets[mp]) {
      monthBuckets[mp] = { actual: 0, omset: 0, stores: {}, manualShares: [] };
    }
    monthBuckets[mp].actual += Number(it.actual) || 0;
    monthBuckets[mp].omset += Number(it.storeOmset) || 0;
    monthBuckets[mp].stores[it.storeName.trim().toUpperCase()] = true;
    if (Number.isFinite(Number(it.marketSharePercent))) {
      monthBuckets[mp].manualShares.push(Number(it.marketSharePercent));
    }
  });

  const sortedMonthsAsc = Object.keys(monthBuckets).sort(
    (a, b) => parseMonthPeriodOrder(a) - parseMonthPeriodOrder(b)
  );

  const monthlyTrendChartData: MonthlyMgTrendPoint[] = sortedMonthsAsc.map((mp, idx) => {
    const b = monthBuckets[mp];
    const share =
      b.omset > 0
        ? computeMarketSharePct(b.actual, b.omset)
        : b.manualShares.length > 0
        ? b.manualShares.reduce((s, v) => s + v, 0) / b.manualShares.length
        : 0;

    let prevShare: number | null = null;
    if (idx > 0) {
      const prevB = monthBuckets[sortedMonthsAsc[idx - 1]];
      prevShare =
        prevB.omset > 0
          ? computeMarketSharePct(prevB.actual, prevB.omset)
          : prevB.manualShares.length > 0
          ? prevB.manualShares.reduce((s, v) => s + v, 0) / prevB.manualShares.length
          : 0;
    }

    return {
      monthPeriod: mp,
      totalActual: b.actual,
      totalStoreOmset: b.omset,
      marketSharePercent: Number(share.toFixed(2)),
      prevSharePercent: prevShare !== null ? Number(prevShare.toFixed(2)) : null,
      deltaSharePercent: prevShare !== null ? Number((share - prevShare).toFixed(2)) : null,
      storeCount: Object.keys(b.stores).length,
    };
  });

  // 2) Per-store monthly grouping
  const storeNamesMap: Record<string, string> = {};
  storeOptions.forEach((s) => {
    const up = s.trim().toUpperCase();
    if (up) storeNamesMap[up] = up;
  });
  items.forEach((it) => {
    const up = it.storeName.trim().toUpperCase();
    if (up) storeNamesMap[up] = up;
  });

  const byStoreMonth: Record<
    string,
    Record<
      string,
      { actual: number; omset: number; entries: MissGlamMarketShareItem[] }
    >
  > = {};

  items.forEach((it) => {
    const st = it.storeName.trim().toUpperCase();
    const mp = (it.monthPeriod || '').trim().toUpperCase();
    if (!st || !mp) return;
    if (!byStoreMonth[st]) byStoreMonth[st] = {};
    if (!byStoreMonth[st][mp]) {
      byStoreMonth[st][mp] = { actual: 0, omset: 0, entries: [] };
    }
    byStoreMonth[st][mp].actual += Number(it.actual) || 0;
    byStoreMonth[st][mp].omset += Number(it.storeOmset) || 0;
    byStoreMonth[st][mp].entries.push(it);
  });

  const getStoreMonthShare = (bucket: {
    actual: number;
    omset: number;
    entries: MissGlamMarketShareItem[];
  }): number => {
    if (bucket.entries.length === 1 && bucket.entries[0].isManualShareOverride) {
      return Number(bucket.entries[0].marketSharePercent) || 0;
    }
    if (bucket.omset > 0) {
      return computeMarketSharePct(bucket.actual, bucket.omset);
    }
    if (bucket.entries.length > 0) {
      const avg =
        bucket.entries.reduce((s, e) => s + (Number(e.marketSharePercent) || 0), 0) /
        bucket.entries.length;
      return Number(avg.toFixed(2));
    }
    return 0;
  };

  // First pass: base store stats + network average
  let totalNetworkActual = 0;
  let totalNetworkOmset = 0;
  const activeShareValues: number[] = [];

  const preliminary = Object.keys(storeNamesMap).map((st) => {
    const monthsMap = byStoreMonth[st] || {};
    const storeMonthsAsc = Object.keys(monthsMap).sort(
      (a, b) => parseMonthPeriodOrder(a) - parseMonthPeriodOrder(b)
    );

    const monthlySeries = storeMonthsAsc.map((mp) => {
      const b = monthsMap[mp];
      return {
        monthPeriod: mp,
        actual: b.actual,
        omset: b.omset,
        share: getStoreMonthShare(b),
      };
    });

    const totalActual = monthlySeries.reduce((s, x) => s + x.actual, 0);
    const totalOmset = monthlySeries.reduce((s, x) => s + x.omset, 0);
    totalNetworkActual += totalActual;
    totalNetworkOmset += totalOmset;

    const latest = monthlySeries.length > 0 ? monthlySeries[monthlySeries.length - 1] : null;
    const prev = monthlySeries.length > 1 ? monthlySeries[monthlySeries.length - 2] : null;

    if (latest) {
      activeShareValues.push(latest.share);
    }

    let peakShare = 0;
    let peakMonth: string | null = null;
    monthlySeries.forEach((pt, idx) => {
      if (idx === 0 || pt.share > peakShare) {
        peakShare = pt.share;
        peakMonth = pt.monthPeriod;
      }
    });

    const overallShare =
      totalOmset > 0
        ? computeMarketSharePct(totalActual, totalOmset)
        : latest
        ? latest.share
        : 0;

    return {
      storeName: st,
      monthlySeries,
      totalActual,
      totalOmset,
      overallShare,
      latest,
      prev,
      peakShare,
      peakMonth,
    };
  });

  const networkAvgShare =
    totalNetworkOmset > 0
      ? computeMarketSharePct(totalNetworkActual, totalNetworkOmset)
      : activeShareValues.length > 0
      ? Number(
          (
            activeShareValues.reduce((s, v) => s + v, 0) / activeShareValues.length
          ).toFixed(2)
        )
      : 0;

  let topShare = 0;
  let topStoreName: string | null = null;
  preliminary.forEach((p) => {
    if (p.latest && (topStoreName === null || p.latest.share > topShare)) {
      topShare = p.latest.share;
      topStoreName = p.storeName;
    }
  });

  const formatRpCompact = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
    if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
    if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
    return `${sign}Rp ${Math.round(abs)}`;
  };

  // Second pass: classify trend & potential
  const fullAnalysis: StoreMarketShareAnalysisItem[] = preliminary.map((p) => {
    const latestShare = p.latest ? p.latest.share : 0;
    const latestActual = p.latest ? p.latest.actual : 0;
    const latestOmset = p.latest ? p.latest.omset : 0;
    const prevShare = p.prev ? p.prev.share : null;
    const prevActual = p.prev ? p.prev.actual : null;
    const prevOmset = p.prev ? p.prev.omset : null;

    const deltaShare =
      prevShare !== null ? Number((latestShare - prevShare).toFixed(2)) : null;
    const deltaActual = prevActual !== null ? latestActual - prevActual : null;

    let trend: StoreMarketShareAnalysisItem['trend'] = 'empty';
    if (p.monthlySeries.length === 1) {
      trend = 'single';
    } else if (deltaShare !== null) {
      if (deltaShare > 0.05) trend = 'up';
      else if (deltaShare < -0.05) trend = 'down';
      else trend = 'stable';
    }

    const gapToAvgShare = Number((networkAvgShare - latestShare).toFixed(2));
    const targetBenchmarkShare =
      latestShare < networkAvgShare
        ? networkAvgShare
        : p.peakShare > latestShare + 0.1
        ? p.peakShare
        : topShare > latestShare
        ? topShare
        : networkAvgShare;

    const gapToTarget = Math.max(0, Number((targetBenchmarkShare - latestShare).toFixed(2)));
    const upsideActualRp =
      latestOmset > 0 && gapToTarget > 0 ? (gapToTarget / 100) * latestOmset : 0;

    let potentialReason = '';
    if (!p.latest) {
      potentialReason = 'Belum ada input data untuk toko ini.';
    } else if (trend === 'down' && p.peakShare > latestShare) {
      potentialReason = `Turun dari puncak ${p.peakShare.toFixed(1).replace('.', ',')}% (${p.peakMonth}). Peluang pemulihan +${(p.peakShare - latestShare).toFixed(1).replace('.', ',')}%${upsideActualRp > 0 ? ` (~${formatRpCompact(upsideActualRp)})` : ''}.`;
    } else if (latestShare < networkAvgShare && latestOmset > 0) {
      potentialReason = `Omset toko ${formatRpCompact(latestOmset)}, namun share baru ${latestShare.toFixed(1).replace('.', ',')}% (rata-rata ${networkAvgShare.toFixed(1).replace('.', ',')}%). Potensi naik ~${formatRpCompact(upsideActualRp)}.`;
    } else if (gapToTarget > 0 && latestOmset > 0) {
      potentialReason = `Share ${latestShare.toFixed(1).replace('.', ',')}% di atas rata-rata, masih ada ruang naik menuju puncak ${targetBenchmarkShare.toFixed(1).replace('.', ',')}% (~${formatRpCompact(upsideActualRp)}).`;
    } else if (latestShare >= topShare && topShare > 0) {
      potentialReason = `Pemimpin market share saat ini (${latestShare.toFixed(1).replace('.', ',')}%). Pertahankan stok & promo untuk menjaga dominasi.`;
    } else {
      potentialReason = `Market share ${latestShare.toFixed(1).replace('.', ',')}% pada periode ${p.latest.monthPeriod}.`;
    }

    const isHighPotential =
      Boolean(p.latest) &&
      (latestShare < networkAvgShare || trend === 'down' || (gapToTarget > 0.5 && latestOmset > 0));

    const potentialScore =
      upsideActualRp > 0
        ? upsideActualRp + (trend === 'down' ? 1_000_000 : 0)
        : gapToTarget * 100_000;

    return {
      storeName: p.storeName,
      monthsCount: p.monthlySeries.length,
      latestMonth: p.latest ? p.latest.monthPeriod : null,
      latestActual,
      latestOmset,
      latestShare,
      prevMonth: p.prev ? p.prev.monthPeriod : null,
      prevActual,
      prevOmset,
      prevShare,
      deltaShare,
      deltaActual,
      peakShare: p.peakShare,
      peakMonth: p.peakMonth,
      trend,
      totalActual: p.totalActual,
      totalOmset: p.totalOmset,
      overallShare: p.overallShare,
      gapToAvgShare,
      targetBenchmarkShare,
      upsideActualRp,
      potentialScore,
      potentialReason,
      isHighPotential,
    };
  });

  const allActiveStores = fullAnalysis
    .filter((s) => s.monthsCount > 0)
    .sort((a, b) => b.latestShare - a.latestShare || b.latestActual - a.latestActual);

  const increasingStores = fullAnalysis
    .filter((s) => s.trend === 'up')
    .sort((a, b) => (b.deltaShare ?? 0) - (a.deltaShare ?? 0));

  const decreasingStores = fullAnalysis
    .filter((s) => s.trend === 'down')
    .sort((a, b) => (a.deltaShare ?? 0) - (b.deltaShare ?? 0));

  const stableStores = fullAnalysis
    .filter((s) => s.trend === 'stable')
    .sort((a, b) => b.latestShare - a.latestShare);

  const singleMonthStores = fullAnalysis
    .filter((s) => s.trend === 'single')
    .sort((a, b) => b.latestShare - a.latestShare);

  const potentialStores = fullAnalysis
    .filter((s) => s.isHighPotential)
    .sort(
      (a, b) =>
        b.potentialScore - a.potentialScore ||
        b.latestOmset - a.latestOmset ||
        a.latestShare - b.latestShare
    );

  return {
    networkAvgShare,
    topShare,
    topStoreName,
    increasingStores,
    decreasingStores,
    stableStores,
    singleMonthStores,
    potentialStores,
    allActiveStores,
    monthlyTrendChartData,
  };
}
