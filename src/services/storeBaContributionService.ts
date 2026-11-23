import {
  TransactionRecord,
  FilterState,
  StoreBaContributionItem,
  StoreBaContributionSummary,
  MonthlyStoreBaSellInRow,
} from '../types/dashboard';
import {
  MONTHS_12,
  resolveRecordMonthAndYear,
  classifyRecordKet,
} from './sellInSellOutService';
import { isFocusProduct } from '../utils/analytics';
import { loadMasterStoreList, splitMasterStoreNames } from './masterStoreService';
import { resolveWeeklyBaStores, normalizeStoreAlnum } from '../utils/weeklyBaRegistry';
import * as XLSX from 'xlsx';

interface ResolvedStoreMeta {
  storeName: string;
  hasBa: boolean;
  baName: string;
  baNumber?: string;
  coverArea: string;
  region: string;
  salesName: string;
  spvName: string;
  trainerName: string;
}

const PLACEHOLDER_BA_TOKENS = new Set([
  '',
  '-',
  'NON BA',
  'NON-BA',
  'NONBA',
  'TANPA BA',
  '- (NON-BA)',
  '- (TANPA BA)',
  'STANDBY',
  'BA STANDBY',
  'ALL',
  'EMPTY',
  'NULL',
  'UNDEFINED',
  'N/A',
]);

export function isPlaceholderBaName(raw?: string): boolean {
  const upper = (raw || '').trim().toUpperCase();
  if (!upper) return true;
  if (PLACEHOLDER_BA_TOKENS.has(upper)) return true;
  if (upper.includes('NON BA') || upper.includes('NON-BA') || upper.includes('TANPA BA')) {
    return true;
  }
  return false;
}

export function splitBaNames(raw?: string): string[] {
  if (isPlaceholderBaName(raw)) return [];
  const cleaned = (raw || '').trim();
  const parts = cleaned
    .split(/[\/&,+\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && !isPlaceholderBaName(p));

  if (parts.length > 0) return parts;
  return [cleaned];
}

export function countUniqueBasFromStores(
  stores: Array<{ hasBa: boolean; baName: string; storeName: string }>
): number {
  const uniqueBaSet = new Set<string>();
  stores.forEach((s) => {
    if (!s.hasBa) return;
    const names = splitBaNames(s.baName);
    if (names.length > 0) {
      names.forEach((n) => uniqueBaSet.add(n.toUpperCase()));
    } else {
      uniqueBaSet.add(`BA@${s.storeName.trim().toUpperCase()}`);
    }
  });
  return uniqueBaSet.size;
}

function isGenericGeneratedBa(baName: string): boolean {
  const trimmed = baName.trim().toUpperCase();
  return trimmed.startsWith('BA ') && trimmed.split(/\s+/).length <= 3;
}

/**
 * Membangun direktori status BA per toko dari seluruh sumber:
 * 1. Pengaturan Master Toko, BA & Sales
 * 2. Roster Weekly Sell Out BA (sinkron Google Sheet SELL OUT & editan user)
 * 3. Live transaksi sheet (SELL OUT / SELL IN) yang memiliki nama BA valid
 */
function buildStoreDirectory(allRecords: TransactionRecord[]): {
  findMeta: (storeName: string, fallbackRecord?: TransactionRecord) => ResolvedStoreMeta;
} {
  const byExact = new Map<string, ResolvedStoreMeta>();
  const byAlnum = new Map<string, ResolvedStoreMeta>();

  const upsertMeta = (meta: ResolvedStoreMeta, priority: 'master' | 'weekly' | 'live') => {
    const exactKey = meta.storeName.trim().toUpperCase();
    const alnumKey = normalizeStoreAlnum(meta.storeName);
    const existing = byExact.get(exactKey) || (alnumKey ? byAlnum.get(alnumKey) : undefined);

    if (!existing) {
      byExact.set(exactKey, meta);
      if (alnumKey) byAlnum.set(alnumKey, meta);
      return;
    }

    // Weekly BA roster & live BA names override placeholder/generic BA
    if (priority === 'weekly') {
      existing.hasBa = true;
      if (!isPlaceholderBaName(meta.baName)) {
        existing.baName = meta.baName;
      }
      if (meta.salesName && meta.salesName !== '-') existing.salesName = meta.salesName;
      if (meta.trainerName && meta.trainerName !== '-') existing.trainerName = meta.trainerName;
      if (meta.coverArea && meta.coverArea !== '-') existing.coverArea = meta.coverArea;
      if (meta.region && meta.region !== '-') existing.region = meta.region;
    } else if (priority === 'live') {
      if (meta.hasBa && (!existing.hasBa || isPlaceholderBaName(existing.baName) || isGenericGeneratedBa(existing.baName))) {
        existing.hasBa = true;
        existing.baName = meta.baName;
      }
      if (meta.baNumber && !existing.baNumber) existing.baNumber = meta.baNumber;
    }
  };

  // 1. Master Store Config
  const masterStores = loadMasterStoreList(allRecords);
  masterStores.forEach((ms) => {
    if (!ms.storeName) return;
    const validBa = ms.hasBa && !isPlaceholderBaName(ms.baName);
    const individualStores = splitMasterStoreNames(ms.storeName);
    individualStores.forEach((individualStore) => {
      upsertMeta(
        {
          storeName: individualStore,
          hasBa: validBa,
          baName: validBa ? ms.baName.trim() : '- (Non-BA)',
          baNumber: ms.baNumber,
          coverArea: (ms.coverArea || 'PEKAN BARU').trim(),
          region: (ms.region || 'PEKAN BARU').trim(),
          salesName: (ms.salesName || '-').trim(),
          spvName: (ms.spvName || 'WIDODO').trim(),
          trainerName: (ms.trainerName || '-').trim(),
        },
        'master'
      );
    });
  });

  // 2. Weekly BA Stores (sinkron dengan Google Sheet SELL OUT & roster aktif)
  const weeklyStores = resolveWeeklyBaStores(allRecords);
  weeklyStores.forEach((ws) => {
    if (!ws.storeName) return;
    const validBa = !isPlaceholderBaName(ws.baName);
    upsertMeta(
      {
        storeName: ws.storeName.trim(),
        hasBa: true,
        baName: validBa ? ws.baName.trim() : `BA ${ws.storeName.trim().split(' ')[0]}`,
        coverArea: (ws.coverArea || 'PEKAN BARU').trim(),
        region: (ws.region || 'PEKAN BARU').trim(),
        salesName: (ws.salesName || '-').trim(),
        spvName: 'WIDODO',
        trainerName: (ws.trainerName || '-').trim(),
      },
      'weekly'
    );
  });

  // 3. Live Google Sheet rows with explicit BA
  allRecords.forEach((r) => {
    const sName = (r.NAMA_STORE || '').trim();
    if (!sName) return;
    const rawBa = (r.BA || '').trim();
    if (isPlaceholderBaName(rawBa)) return;

    upsertMeta(
      {
        storeName: sName,
        hasBa: true,
        baName: rawBa,
        baNumber: r.BA_Number,
        coverArea: (r.COVER_AREA && r.COVER_AREA !== '-' ? r.COVER_AREA : 'PEKAN BARU').trim(),
        region: (r.REGION && r.REGION !== '-' ? r.REGION : 'PEKAN BARU').trim(),
        salesName: (r.SALES && r.SALES !== '-' ? r.SALES : '-').trim(),
        spvName: (r.SPV && r.SPV !== '-' ? r.SPV : 'WIDODO').trim(),
        trainerName: '-',
      },
      'live'
    );
  });

  const findMeta = (storeName: string, fallbackRecord?: TransactionRecord): ResolvedStoreMeta => {
    const clean = (storeName || 'Toko Ritel').trim();
    const exactKey = clean.toUpperCase();
    const alnumKey = normalizeStoreAlnum(clean);
    const hit = byExact.get(exactKey) || (alnumKey ? byAlnum.get(alnumKey) : undefined);

    if (hit) {
      return {
        ...hit,
        coverArea: hit.coverArea || fallbackRecord?.COVER_AREA || 'PEKAN BARU',
        region: hit.region || fallbackRecord?.REGION || 'PEKAN BARU',
        salesName:
          hit.salesName && hit.salesName !== '-'
            ? hit.salesName
            : fallbackRecord?.SALES && fallbackRecord.SALES !== '-'
            ? fallbackRecord.SALES.trim()
            : '-',
        spvName:
          hit.spvName && hit.spvName !== '-'
            ? hit.spvName
            : fallbackRecord?.SPV && fallbackRecord.SPV !== '-'
            ? fallbackRecord.SPV.trim()
            : 'WIDODO',
      };
    }

    const rawBa = (fallbackRecord?.BA || '').trim();
    const hasBa = !isPlaceholderBaName(rawBa);
    return {
      storeName: clean,
      hasBa,
      baName: hasBa ? rawBa : '- (Non-BA)',
      baNumber: fallbackRecord?.BA_Number,
      coverArea: (fallbackRecord?.COVER_AREA && fallbackRecord.COVER_AREA !== '-' ? fallbackRecord.COVER_AREA : 'PEKAN BARU').trim(),
      region: (fallbackRecord?.REGION && fallbackRecord.REGION !== '-' ? fallbackRecord.REGION : 'PEKAN BARU').trim(),
      salesName: (fallbackRecord?.SALES && fallbackRecord.SALES !== '-' ? fallbackRecord.SALES : '-').trim(),
      spvName: (fallbackRecord?.SPV && fallbackRecord.SPV !== '-' ? fallbackRecord.SPV : 'WIDODO').trim(),
      trainerName: '-',
    };
  };

  return { findMeta };
}

function matchesGlobalAndAreaFilters(
  r: TransactionRecord,
  meta: ResolvedStoreMeta,
  selectedArea: string,
  filters?: Partial<FilterState>
): boolean {
  if (selectedArea && selectedArea !== 'ALL') {
    const targetArea = selectedArea.trim().toUpperCase();
    const areaMatch =
      (r.COVER_AREA || '').trim().toUpperCase() === targetArea ||
      (r.REGION || '').trim().toUpperCase() === targetArea ||
      meta.coverArea.toUpperCase() === targetArea ||
      meta.region.toUpperCase() === targetArea;
    if (!areaMatch) return false;
  }

  if (filters?.REGION && filters.REGION !== 'ALL') {
    const targetRegion = filters.REGION.trim().toUpperCase();
    const match =
      (r.REGION || '').trim().toUpperCase() === targetRegion ||
      (r.COVER_AREA || '').trim().toUpperCase() === targetRegion ||
      meta.region.toUpperCase() === targetRegion ||
      meta.coverArea.toUpperCase() === targetRegion;
    if (!match) return false;
  }

  if (filters?.SALES && filters.SALES !== 'ALL') {
    const targetSales = filters.SALES.trim().toUpperCase();
    const recSales = (r.SALES || '').trim().toUpperCase();
    if (recSales !== targetSales && meta.salesName.toUpperCase() !== targetSales) {
      return false;
    }
  }

  if (filters?.SPV && filters.SPV !== 'ALL') {
    const targetSpv = filters.SPV.trim().toUpperCase();
    const recSpv = (r.SPV || '').trim().toUpperCase();
    if (recSpv !== targetSpv && meta.spvName.toUpperCase() !== targetSpv) {
      return false;
    }
  }

  if (filters?.NAMA_STORE && filters.NAMA_STORE !== 'ALL') {
    const targetStore = filters.NAMA_STORE.trim().toUpperCase();
    const recStore = (r.NAMA_STORE || '').trim().toUpperCase();
    if (recStore !== targetStore && meta.storeName.toUpperCase() !== targetStore) {
      return false;
    }
  }

  return true;
}

/**
 * Menghitung kontribusi Toko Ada BA vs Toko Non-BA KHUSUS OMSET SELL IN
 */
export function calculateStoreBaContribution(
  allRecords: TransactionRecord[],
  selectedMonth: string,
  selectedYear: number,
  selectedArea: string = 'ALL',
  filters?: Partial<FilterState>
): {
  stores: StoreBaContributionItem[];
  summary: StoreBaContributionSummary;
} {
  const { findMeta } = buildStoreDirectory(allRecords);
  const targetMonth = (selectedMonth || 'ALL').trim().toUpperCase();

  interface StoreAgg {
    meta: ResolvedStoreMeta;
    totalRevenue: number;
    totalQtySold: number;
    focusProductPcs: number;
    focusProductValue: number;
    transactionCount: number;
  }

  const storeAggMap = new Map<string, StoreAgg>();

  allRecords.forEach((r) => {
    // STRICT: Hanya data OMSET SELL IN
    if (classifyRecordKet(r.KET) !== 'SELL IN') return;

    const { month: recMonth, year: recYear } = resolveRecordMonthAndYear(r);
    if (selectedYear > 0 && recYear > 0 && recYear !== selectedYear) return;
    if (targetMonth !== 'ALL' && recMonth !== targetMonth) return;

    const rawStore = (r.NAMA_STORE || 'Toko Ritel').trim();
    const meta = findMeta(rawStore, r);

    if (!matchesGlobalAndAreaFilters(r, meta, selectedArea, filters)) return;

    const key = meta.storeName.toUpperCase();
    if (!storeAggMap.has(key)) {
      storeAggMap.set(key, {
        meta,
        totalRevenue: 0,
        totalQtySold: 0,
        focusProductPcs: 0,
        focusProductValue: 0,
        transactionCount: 0,
      });
    }

    const agg = storeAggMap.get(key)!;
    const val = Number(r.VALUE) || 0;
    const qty = Math.max(0, Number(r.QTY) || 0);
    const isFocus = isFocusProduct(r.PRODUK_FOCUS);

    agg.totalRevenue += val;
    agg.totalQtySold += qty;
    agg.transactionCount += 1;

    if (isFocus) {
      agg.focusProductPcs += qty;
      agg.focusProductValue += val;
    }
  });

  let totalAreaRevenue = 0;
  let totalAreaQty = 0;

  storeAggMap.forEach((agg) => {
    totalAreaRevenue += agg.totalRevenue;
    totalAreaQty += agg.totalQtySold;
  });

  const effectiveTotalRevenue = totalAreaRevenue > 0 ? totalAreaRevenue : 1;
  const storeItems: StoreBaContributionItem[] = [];

  storeAggMap.forEach((agg, key) => {
    const contributionPercent =
      totalAreaRevenue > 0
        ? Math.round((agg.totalRevenue / effectiveTotalRevenue) * 10000) / 100
        : 0;
    const averageBasketSize =
      agg.transactionCount > 0 ? Math.round(agg.totalRevenue / agg.transactionCount) : 0;

    let performanceClass = '';
    let recommendationNote = '';

    if (agg.meta.hasBa) {
      if (agg.totalRevenue >= 50000000) {
        performanceClass = 'Top Kontributor BA';
        recommendationNote = 'Pertahankan ketersediaan stok & jaga performa BA dengan program produk fokus.';
      } else if (agg.totalRevenue >= 20000000) {
        performanceClass = 'Stabil & Produktif';
        recommendationNote = 'Dorong repeat order Sell In produk fokus dan promo counter rutin.';
      } else {
        performanceClass = 'Perlu Optimasi Sell In';
        recommendationNote = 'Evaluasi stok counter & dorong order ulang bersama Sales dan Trainer.';
      }
    } else {
      if (agg.totalRevenue >= 18000000) {
        performanceClass = 'Prioritas Pasang BA';
        recommendationNote = 'Sell In mandiri tinggi tanpa BA; sangat potensial ditempatkan BA baru.';
      } else if (agg.totalRevenue >= 10000000) {
        performanceClass = 'Kandidat Kuat BA';
        recommendationNote = 'Pantau pertumbuhan Sell In 2 bulan ke depan untuk penempatan BA counter.';
      } else {
        performanceClass = 'Gerai Reguler Non-BA';
        recommendationNote = 'Pertahankan pasokan Taking Order Sales reguler secara berkala.';
      }
    }

    const baCountInStore = agg.meta.hasBa ? Math.max(1, splitBaNames(agg.meta.baName).length) : 0;

    storeItems.push({
      id: `store-sellin-${key}`,
      storeName: agg.meta.storeName,
      hasBa: agg.meta.hasBa,
      baName: agg.meta.hasBa ? agg.meta.baName : '- (Non-BA)',
      baCountInStore,
      baNumber: agg.meta.baNumber,
      coverArea: agg.meta.coverArea,
      region: agg.meta.region,
      salesName: agg.meta.salesName,
      spvName: agg.meta.spvName,
      trainerName: agg.meta.trainerName,
      totalRevenue: agg.totalRevenue,
      contributionPercent,
      totalQtySold: agg.totalQtySold,
      focusProductPcs: agg.focusProductPcs,
      focusProductValue: agg.focusProductValue,
      transactionCount: agg.transactionCount,
      averageBasketSize,
      performanceClass,
      recommendationNote,
    });
  });

  storeItems.sort((a, b) => b.totalRevenue - a.totalRevenue);

  const summary = summarizeStoreItems(storeItems, targetMonth, selectedYear);

  return {
    stores: storeItems,
    summary,
  };
}

export function summarizeStoreItems(
  storeItems: StoreBaContributionItem[],
  periodMonth: string,
  periodYear: number
): StoreBaContributionSummary {
  const tokoBaList = storeItems.filter((s) => s.hasBa);
  const tokoNonBaList = storeItems.filter((s) => !s.hasBa);

  const totalStoresCount = storeItems.length;
  const tokoBaCount = tokoBaList.length;
  const tokoNonBaCount = tokoNonBaList.length;
  const totalBaCount = countUniqueBasFromStores(tokoBaList);

  const tokoBaTotalRevenue = tokoBaList.reduce((sum, s) => sum + s.totalRevenue, 0);
  const tokoNonBaTotalRevenue = tokoNonBaList.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalAreaRevenue = tokoBaTotalRevenue + tokoNonBaTotalRevenue;
  const totalAreaQty = storeItems.reduce((sum, s) => sum + s.totalQtySold, 0);

  const tokoBaRevenuePercent =
    totalAreaRevenue > 0 ? Math.round((tokoBaTotalRevenue / totalAreaRevenue) * 1000) / 10 : 0;
  const tokoNonBaRevenuePercent =
    totalAreaRevenue > 0 ? Math.round((100 - tokoBaRevenuePercent) * 10) / 10 : 0;

  const tokoBaStorePercent =
    totalStoresCount > 0 ? Math.round((tokoBaCount / totalStoresCount) * 1000) / 10 : 0;
  const tokoNonBaStorePercent =
    totalStoresCount > 0 ? Math.round((100 - tokoBaStorePercent) * 10) / 10 : 0;

  const tokoBaAvgRevenuePerStore =
    tokoBaCount > 0 ? Math.round(tokoBaTotalRevenue / tokoBaCount) : 0;
  const tokoNonBaAvgRevenuePerStore =
    tokoNonBaCount > 0 ? Math.round(tokoNonBaTotalRevenue / tokoNonBaCount) : 0;

  const tokoBaTotalQty = tokoBaList.reduce((sum, s) => sum + s.totalQtySold, 0);
  const tokoNonBaTotalQty = tokoNonBaList.reduce((sum, s) => sum + s.totalQtySold, 0);

  const tokoBaFocusPcs = tokoBaList.reduce((sum, s) => sum + s.focusProductPcs, 0);
  const tokoNonBaFocusPcs = tokoNonBaList.reduce((sum, s) => sum + s.focusProductPcs, 0);

  const productivityMultiplier =
    tokoNonBaAvgRevenuePerStore > 0
      ? Math.round((tokoBaAvgRevenuePerStore / tokoNonBaAvgRevenuePerStore) * 10) / 10
      : tokoBaAvgRevenuePerStore > 0
      ? 1
      : 0;

  const potentialBaCandidateStoresCount = tokoNonBaList.filter(
    (s) => s.totalRevenue >= 10000000
  ).length;

  return {
    periodMonth,
    periodYear,
    totalAreaRevenue,
    totalAreaQty,
    totalStoresCount,
    tokoBaCount,
    totalBaCount,
    tokoBaStorePercent,
    tokoBaTotalRevenue,
    tokoBaRevenuePercent,
    tokoBaAvgRevenuePerStore,
    tokoBaTotalQty,
    tokoBaFocusPcs,
    tokoNonBaCount,
    tokoNonBaStorePercent,
    tokoNonBaTotalRevenue,
    tokoNonBaRevenuePercent,
    tokoNonBaAvgRevenuePerStore,
    tokoNonBaTotalQty,
    tokoNonBaFocusPcs,
    productivityMultiplier,
    potentialBaCandidateStoresCount,
  };
}

/**
 * Menghitung rekapitulasi PER BULAN (JANUARI - DESEMBER) KHUSUS OMSET SELL IN:
 * Menampilkan setiap bulan berapa Total Semua Toko, Toko Non-BA & Omset Sell In + Kontribusi %,
 * serta Toko Ada BA, Total BA, Omset Sell In + Kontribusi %.
 */
export function calculateMonthlyStoreBaSellInContribution(
  allRecords: TransactionRecord[],
  selectedYear: number,
  selectedArea: string = 'ALL',
  filters?: Partial<FilterState>,
  storeFilterType: 'all' | 'ba_only' | 'non_ba_only' = 'all',
  searchText: string = ''
): {
  months: MonthlyStoreBaSellInRow[];
  yearlyTotals: {
    distinctStoresCount: number;
    distinctTokoBaCount: number;
    distinctTotalBaCount: number;
    distinctTokoNonBaCount: number;
    totalSellIn: number;
    tokoBaSellIn: number;
    tokoBaContributionPct: number;
    tokoNonBaSellIn: number;
    tokoNonBaContributionPct: number;
  };
} {
  const { findMeta } = buildStoreDirectory(allRecords);
  const query = searchText.trim().toLowerCase();

  interface MonthStoreAgg {
    meta: ResolvedStoreMeta;
    sellInValue: number;
    qty: number;
  }

  const monthBuckets = new Map<string, Map<string, MonthStoreAgg>>();
  MONTHS_12.forEach((m) => monthBuckets.set(m, new Map()));

  allRecords.forEach((r) => {
    // STRICT: Hanya data OMSET SELL IN
    if (classifyRecordKet(r.KET) !== 'SELL IN') return;

    const { month: recMonth, year: recYear } = resolveRecordMonthAndYear(r);
    if (selectedYear > 0 && recYear > 0 && recYear !== selectedYear) return;
    if (!recMonth || !monthBuckets.has(recMonth)) return;

    const rawStore = (r.NAMA_STORE || 'Toko Ritel').trim();
    const meta = findMeta(rawStore, r);

    if (!matchesGlobalAndAreaFilters(r, meta, selectedArea, filters)) return;

    if (storeFilterType === 'ba_only' && !meta.hasBa) return;
    if (storeFilterType === 'non_ba_only' && meta.hasBa) return;

    if (query) {
      const match =
        meta.storeName.toLowerCase().includes(query) ||
        meta.baName.toLowerCase().includes(query) ||
        meta.salesName.toLowerCase().includes(query) ||
        meta.coverArea.toLowerCase().includes(query) ||
        meta.spvName.toLowerCase().includes(query) ||
        meta.region.toLowerCase().includes(query);
      if (!match) return;
    }

    const storeMap = monthBuckets.get(recMonth)!;
    const storeKey = meta.storeName.toUpperCase();
    if (!storeMap.has(storeKey)) {
      storeMap.set(storeKey, {
        meta,
        sellInValue: 0,
        qty: 0,
      });
    }

    const entry = storeMap.get(storeKey)!;
    entry.sellInValue += Number(r.VALUE) || 0;
    entry.qty += Math.max(0, Number(r.QTY) || 0);
  });

  const rows: MonthlyStoreBaSellInRow[] = [];
  const allYearStores = new Map<string, { hasBa: boolean; baName: string; storeName: string }>();

  let yearlyTotalSellIn = 0;
  let yearlyTokoBaSellIn = 0;
  let yearlyTokoNonBaSellIn = 0;

  MONTHS_12.forEach((monthName, monthIndex) => {
    const storeMap = monthBuckets.get(monthName)!;
    if (storeMap.size === 0) return;

    const storeList = Array.from(storeMap.values());
    const baStores = storeList.filter((s) => s.meta.hasBa);
    const nonBaStores = storeList.filter((s) => !s.meta.hasBa);

    storeList.forEach((s) => {
      const key = s.meta.storeName.toUpperCase();
      if (!allYearStores.has(key)) {
        allYearStores.set(key, {
          hasBa: s.meta.hasBa,
          baName: s.meta.baName,
          storeName: s.meta.storeName,
        });
      }
    });

    const totalStoresCount = storeList.length;
    const tokoBaCount = baStores.length;
    const tokoNonBaCount = nonBaStores.length;
    const totalBaCount = countUniqueBasFromStores(
      baStores.map((s) => ({
        hasBa: s.meta.hasBa,
        baName: s.meta.baName,
        storeName: s.meta.storeName,
      }))
    );

    const tokoBaSellIn = baStores.reduce((sum, s) => sum + s.sellInValue, 0);
    const tokoNonBaSellIn = nonBaStores.reduce((sum, s) => sum + s.sellInValue, 0);
    const totalSellIn = tokoBaSellIn + tokoNonBaSellIn;
    const totalQtySellIn = storeList.reduce((sum, s) => sum + s.qty, 0);

    const tokoBaContributionPct =
      totalSellIn > 0 ? Math.round((tokoBaSellIn / totalSellIn) * 1000) / 10 : 0;
    const tokoNonBaContributionPct =
      totalSellIn > 0 ? Math.round((100 - tokoBaContributionPct) * 10) / 10 : 0;

    const tokoBaStorePct =
      totalStoresCount > 0 ? Math.round((tokoBaCount / totalStoresCount) * 1000) / 10 : 0;
    const tokoNonBaStorePct =
      totalStoresCount > 0 ? Math.round((100 - tokoBaStorePct) * 10) / 10 : 0;

    yearlyTotalSellIn += totalSellIn;
    yearlyTokoBaSellIn += tokoBaSellIn;
    yearlyTokoNonBaSellIn += tokoNonBaSellIn;

    rows.push({
      monthName,
      monthIndex,
      year: selectedYear,
      totalStoresCount,
      totalSellIn,
      totalQtySellIn,
      tokoBaCount,
      totalBaCount,
      tokoBaSellIn,
      tokoBaContributionPct,
      tokoBaStorePct,
      tokoBaAvgSellIn: tokoBaCount > 0 ? Math.round(tokoBaSellIn / tokoBaCount) : 0,
      tokoNonBaCount,
      tokoNonBaSellIn,
      tokoNonBaContributionPct,
      tokoNonBaStorePct,
      tokoNonBaAvgSellIn: tokoNonBaCount > 0 ? Math.round(tokoNonBaSellIn / tokoNonBaCount) : 0,
    });
  });

  const yearStoreArr = Array.from(allYearStores.values());
  const yearBaStores = yearStoreArr.filter((s) => s.hasBa);
  const yearNonBaStores = yearStoreArr.filter((s) => !s.hasBa);

  const yearlyBaPct =
    yearlyTotalSellIn > 0
      ? Math.round((yearlyTokoBaSellIn / yearlyTotalSellIn) * 1000) / 10
      : 0;
  const yearlyNonBaPct =
    yearlyTotalSellIn > 0 ? Math.round((100 - yearlyBaPct) * 10) / 10 : 0;

  return {
    months: rows,
    yearlyTotals: {
      distinctStoresCount: yearStoreArr.length,
      distinctTokoBaCount: yearBaStores.length,
      distinctTotalBaCount: countUniqueBasFromStores(yearBaStores),
      distinctTokoNonBaCount: yearNonBaStores.length,
      totalSellIn: yearlyTotalSellIn,
      tokoBaSellIn: yearlyTokoBaSellIn,
      tokoBaContributionPct: yearlyBaPct,
      tokoNonBaSellIn: yearlyTokoNonBaSellIn,
      tokoNonBaContributionPct: yearlyNonBaPct,
    },
  };
}

export function exportStoreBaContributionToExcel(
  stores: StoreBaContributionItem[],
  summary: StoreBaContributionSummary,
  monthlyRows: MonthlyStoreBaSellInRow[],
  selectedMonth: string,
  selectedYear: number
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Rekapan Per Bulan (Khusus Omset Sell In)
  const monthlyHeaders = [
    'Bulan',
    'Total Semua Toko',
    'Total Omset Sell In (IDR)',
    'Toko Ada BA (Jml Toko)',
    'Total BA (Orang)',
    'Omset Sell In Toko Ada BA (IDR)',
    '% Kontribusi Toko Ada BA',
    'Toko Non-BA (Jml Toko)',
    'Omset Sell In Toko Non-BA (IDR)',
    '% Kontribusi Toko Non-BA',
  ];

  const monthlyExcelRows = monthlyRows.map((m) => [
    `${m.monthName} ${m.year}`,
    m.totalStoresCount,
    m.totalSellIn,
    m.tokoBaCount,
    m.totalBaCount,
    m.tokoBaSellIn,
    `${m.tokoBaContributionPct}%`,
    m.tokoNonBaCount,
    m.tokoNonBaSellIn,
    `${m.tokoNonBaContributionPct}%`,
  ]);

  const wsMonthly = XLSX.utils.aoa_to_sheet([
    [`REKAP KONTRIBUSI OMSET SELL IN PER BULAN: TOKO ADA BA VS TOKO NON-BA (${selectedYear})`],
    ['Sumber Data: Khusus Omset Sell In'],
    [''],
    monthlyHeaders,
    ...monthlyExcelRows,
  ]);
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Rekap Per Bulan (Sell In)');

  // Sheet 2: Ringkasan Periode Aktif
  const periodLabel = selectedMonth === 'ALL' ? `Semua Bulan ${selectedYear}` : `${selectedMonth} ${selectedYear}`;
  const summaryAoa = [
    ['RINGKASAN KONTRIBUSI OMSET SELL IN: TOKO ADA BA VS TOKO NON-BA'],
    [`Periode: ${periodLabel}`],
    [''],
    ['METRIK (KHUSUS OMSET SELL IN)', 'TOKO ADA BA', 'TOKO NON-BA', 'TOTAL SEMUA TOKO'],
    ['Jumlah Toko Aktif', summary.tokoBaCount, summary.tokoNonBaCount, summary.totalStoresCount],
    ['Total BA (Orang)', summary.totalBaCount, 0, summary.totalBaCount],
    ['% Jumlah Toko', `${summary.tokoBaStorePercent}%`, `${summary.tokoNonBaStorePercent}%`, '100%'],
    ['Total Omset Sell In (IDR)', summary.tokoBaTotalRevenue, summary.tokoNonBaTotalRevenue, summary.totalAreaRevenue],
    ['% Kontribusi Omset Sell In', `${summary.tokoBaRevenuePercent}%`, `${summary.tokoNonBaRevenuePercent}%`, '100%'],
    ['Rata-rata Omset Sell In / Toko (IDR)', summary.tokoBaAvgRevenuePerStore, summary.tokoNonBaAvgRevenuePerStore, '-'],
    ['Total Qty Sell In (Pcs)', summary.tokoBaTotalQty, summary.tokoNonBaTotalQty, summary.totalAreaQty],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Periode');

  // Sheet 3: Detail Toko (Sell In)
  const detailHeaders = [
    'No',
    'Status Toko',
    'Nama Toko',
    'Nama BA',
    'Jml BA',
    'Area',
    'Sales',
    'SPV',
    'Omset Sell In (IDR)',
    '% Kontribusi Sell In',
    'Total Qty (Pcs)',
    'Produk Fokus (Pcs)',
    'Klasifikasi',
  ];

  const detailRows = stores.map((s, idx) => [
    idx + 1,
    s.hasBa ? 'Toko Ada BA' : 'Toko Non-BA',
    s.storeName,
    s.baName,
    s.baCountInStore,
    s.coverArea,
    s.salesName,
    s.spvName,
    s.totalRevenue,
    `${s.contributionPercent}%`,
    s.totalQtySold,
    s.focusProductPcs,
    s.performanceClass,
  ]);

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Toko (Sell In)');

  XLSX.writeFile(
    wb,
    `Analisa_Sell_In_Toko_BA_vs_Non_BA_${selectedMonth}_${selectedYear}.xlsx`
  );
}
