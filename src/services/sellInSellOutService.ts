import {
  TransactionRecord,
  SellInSellOutDimension,
  SellInSellOutItem,
  SellInSellOutSummary,
  FilterState,
} from '../types/dashboard';
import { DEFAULT_WEEKLY_STORES } from '../components/ReviewWeeklySellOutBa';
import { DEFAULT_TRAINERS_DATA } from '../utils/costCalculations';
import { loadMasterStoreList } from './masterStoreService';
import {
  getTrainerForRecord,
  parseTransactionDate,
  resolveCategory,
  resolveProductStatus,
} from '../utils/analytics';
import {
  loadSalesTargets,
  loadSalesSellOutTargets,
  loadBaNonLavojoyTargets,
  loadBaLavojoyTargets,
  loadTrainerConfigs,
  loadTrainerTargets,
  DEFAULT_SALES_SELLOUT_TARGET,
  DEFAULT_BA_NON_LAVOJOY_TARGET,
  DEFAULT_BA_LAVOJOY_TARGET,
  notifyTargetsUpdated,
} from './targetManagementService';

export const BA_EVALUATION_STORAGE_KEY = 'salespro_ba_evaluation_overrides_v2';
export const MONTHLY_SELLIN_SELLOUT_STORAGE_KEY = 'salespro_monthly_sellin_sellout_overrides_v1';
export const ENTITY_SELLIN_SELLOUT_STORAGE_KEY = 'salespro_entity_sellin_sellout_overrides_v1';

export interface BaEvaluationOverride {
  baName: string;
  storeName?: string;
  salesName?: string;
  coverArea?: string;
  sellIn?: number;
  sellOut?: number;
  target?: number;
  notes?: string;
}

export interface MonthlySellInOutOverride {
  sellIn?: number;
  sellOut?: number;
  notes?: string;
  updatedAt?: string;
}

export interface EntitySellInOutOverride {
  sellIn?: number;
  sellOut?: number;
  target?: number;
  notes?: string;
  updatedAt?: string;
}

export interface MonthlySellInOutRow {
  month: string;
  monthNumber: number;
  year: number;
  sheetSellIn: number;
  sheetSellOut: number;
  sellInValue: number;
  sellOutValue: number;
  gapValue: number;
  absGapValue: number;
  gapPercent: number;
  sellThroughPercent: number;
  isOver20Percent: boolean;
  statusType: 'overstock' | 'healthy' | 'stockout_risk' | 'empty';
  statusLabel: string;
  txSellInCount: number;
  txSellOutCount: number;
  isManualEdit: boolean;
  notes: string;
}

export const MONTH_NAMES_LIST = [
  'ALL',
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
];

export const MONTHS_12 = MONTH_NAMES_LIST.slice(1);

const MONTH_ALIASES: Record<string, string> = {
  JANUARI: 'JANUARI',
  JANUARY: 'JANUARI',
  JAN: 'JANUARI',
  FEBRUARI: 'FEBRUARI',
  FEBRUARY: 'FEBRUARI',
  FEB: 'FEBRUARI',
  MARET: 'MARET',
  MARCH: 'MARET',
  MAR: 'MARET',
  APRIL: 'APRIL',
  APR: 'APRIL',
  MEI: 'MEI',
  MAY: 'MEI',
  JUNI: 'JUNI',
  JUNE: 'JUNI',
  JUN: 'JUNI',
  JULI: 'JULI',
  JULY: 'JULI',
  JUL: 'JULI',
  AGUSTUS: 'AGUSTUS',
  AUGUST: 'AGUSTUS',
  AGU: 'AGUSTUS',
  AUG: 'AGUSTUS',
  SEPTEMBER: 'SEPTEMBER',
  SEP: 'SEPTEMBER',
  SEPT: 'SEPTEMBER',
  OKTOBER: 'OKTOBER',
  OCTOBER: 'OKTOBER',
  OKT: 'OKTOBER',
  OCT: 'OKTOBER',
  NOVEMBER: 'NOVEMBER',
  NOV: 'NOVEMBER',
  DESEMBER: 'DESEMBER',
  DECEMBER: 'DESEMBER',
  DES: 'DESEMBER',
  DEC: 'DESEMBER',
};

export function loadBaEvaluationOverrides(): Record<string, BaEvaluationOverride> {
  try {
    const raw = localStorage.getItem(BA_EVALUATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBaEvaluationOverride(override: BaEvaluationOverride): void {
  try {
    const all = loadBaEvaluationOverrides();
    all[override.baName.toUpperCase().trim()] = override;
    localStorage.setItem(BA_EVALUATION_STORAGE_KEY, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'ba_eval' });
  } catch {
    // ignore
  }
}

export function resetBaEvaluationOverrides(): void {
  try {
    localStorage.removeItem(BA_EVALUATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildFilterScopeKey(
  selectedYear: number,
  selectedArea: string = 'ALL',
  filters?: FilterState
): string {
  const parts = [
    String(selectedYear || 'ALL'),
    (selectedArea || 'ALL').trim().toUpperCase(),
    (filters?.SPV || 'ALL').trim().toUpperCase(),
    (filters?.SALES || 'ALL').trim().toUpperCase(),
    (filters?.TRAINER || 'ALL').trim().toUpperCase(),
    (filters?.BRAND || 'ALL').trim().toUpperCase(),
    (filters?.KATEGORI || 'ALL').trim().toUpperCase(),
    (filters?.NAMA_STORE || 'ALL').trim().toUpperCase(),
    (filters?.SKU || 'ALL').trim().toUpperCase(),
    (filters?.searchQuery || '').trim().toUpperCase(),
  ];
  return parts.join('|');
}

export function loadMonthlySellInOutOverrides(): Record<string, MonthlySellInOutOverride> {
  try {
    const raw = localStorage.getItem(MONTHLY_SELLIN_SELLOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMonthlySellInOutOverride(
  scopeKey: string,
  month: string,
  override: MonthlySellInOutOverride
): void {
  try {
    const all = loadMonthlySellInOutOverrides();
    const key = `${scopeKey}::${month.trim().toUpperCase()}`;
    all[key] = {
      ...override,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(MONTHLY_SELLIN_SELLOUT_STORAGE_KEY, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'monthly_sellin_sellout' });
  } catch {
    // ignore
  }
}

export function resetMonthlySellInOutOverride(scopeKey: string, month: string): void {
  try {
    const all = loadMonthlySellInOutOverrides();
    const key = `${scopeKey}::${month.trim().toUpperCase()}`;
    delete all[key];
    localStorage.setItem(MONTHLY_SELLIN_SELLOUT_STORAGE_KEY, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'monthly_sellin_sellout' });
  } catch {
    // ignore
  }
}

export function resetAllMonthlyOverridesForScope(scopeKey: string): void {
  try {
    const all = loadMonthlySellInOutOverrides();
    const prefix = `${scopeKey}::`;
    Object.keys(all).forEach((k) => {
      if (k.startsWith(prefix)) delete all[k];
    });
    localStorage.setItem(MONTHLY_SELLIN_SELLOUT_STORAGE_KEY, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'monthly_sellin_sellout' });
  } catch {
    // ignore
  }
}

export function loadEntitySellInOutOverrides(): Record<string, EntitySellInOutOverride> {
  try {
    const raw = localStorage.getItem(ENTITY_SELLIN_SELLOUT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function buildEntityOverrideKey(
  selectedYear: number,
  selectedMonth: string,
  dimension: SellInSellOutDimension,
  entityName: string
): string {
  return `${selectedYear}|${selectedMonth.trim().toUpperCase()}|${dimension}|${entityName.trim().toUpperCase()}`;
}

export function saveEntitySellInOutOverride(
  selectedYear: number,
  selectedMonth: string,
  dimension: SellInSellOutDimension,
  entityName: string,
  override: EntitySellInOutOverride
): void {
  try {
    const all = loadEntitySellInOutOverrides();
    const key = buildEntityOverrideKey(selectedYear, selectedMonth, dimension, entityName);
    all[key] = {
      ...override,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(ENTITY_SELLIN_SELLOUT_STORAGE_KEY, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'entity_sellin_sellout' });
  } catch {
    // ignore
  }
}

export function resetEntitySellInOutOverride(
  selectedYear: number,
  selectedMonth: string,
  dimension: SellInSellOutDimension,
  entityName: string
): void {
  try {
    const all = loadEntitySellInOutOverrides();
    const key = buildEntityOverrideKey(selectedYear, selectedMonth, dimension, entityName);
    delete all[key];
    localStorage.setItem(ENTITY_SELLIN_SELLOUT_STORAGE_KEY, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'entity_sellin_sellout' });
  } catch {
    // ignore
  }
}

export function resolveRecordMonthAndYear(r: TransactionRecord): { month: string; year: number } {
  const dt = parseTransactionDate(r);
  const rawBulan = (r.BULAN || '').trim().toUpperCase();

  let resolvedMonth = '';
  if (rawBulan) {
    if (MONTH_ALIASES[rawBulan]) {
      resolvedMonth = MONTH_ALIASES[rawBulan];
    } else {
      const matched = MONTHS_12.find((m) => rawBulan.includes(m));
      if (matched) resolvedMonth = matched;
    }
  }
  if (!resolvedMonth && dt) {
    resolvedMonth = MONTHS_12[dt.getMonth()] || '';
  }

  const parsedYear = Number(r.TAHUN);
  const resolvedYear =
    !isNaN(parsedYear) && parsedYear > 1900
      ? parsedYear
      : dt
      ? dt.getFullYear()
      : 0;

  return { month: resolvedMonth, year: resolvedYear };
}

export function classifyRecordKet(ketRaw?: string): 'SELL IN' | 'SELL OUT' | 'RETURN' {
  const upper = (ketRaw || '').toUpperCase().trim();
  if (upper.includes('RETURN') || upper.includes('RETUR')) return 'RETURN';
  if (upper.includes('SELL IN') || upper.includes('SELL-IN') || upper.includes('TAKING ORDER')) {
    return 'SELL IN';
  }
  return 'SELL OUT';
}

/**
 * Filter transaksi Google Sheet berdasarkan filter terintegrasi,
 * KECUALI filter KET (SELL IN / SELL OUT) yang sengaja dinonaktifkan di menu perbandingan ini.
 */
function filterSheetRecordsIgnoringKet(
  records: TransactionRecord[],
  selectedMonth: string,
  selectedYear: number,
  selectedArea: string,
  filters?: FilterState
): TransactionRecord[] {
  const targetMonth = (selectedMonth || 'ALL').trim().toUpperCase();
  const targetArea = (selectedArea || 'ALL').trim().toUpperCase();

  return records.filter((r) => {
    const { month: recMonth, year: recYear } = resolveRecordMonthAndYear(r);

    // Filter Tahun
    if (selectedYear > 0 && recYear > 0 && recYear !== selectedYear) {
      return false;
    }

    // Filter Bulan
    if (targetMonth !== 'ALL') {
      if (!recMonth || recMonth !== targetMonth) {
        return false;
      }
    }

    // Filter Area (Area Dropdown / Global Region)
    if (targetArea !== 'ALL') {
      const recArea = (r.COVER_AREA || '').trim().toUpperCase();
      const recRegion = (r.REGION || '').trim().toUpperCase();
      if (recArea !== targetArea && recRegion !== targetArea) {
        return false;
      }
    }

    // Global Integrated Filters (SELURUHNYA BERFUNGSI KECUALI KET!)
    if (filters) {
      if (filters.REGION && filters.REGION !== 'ALL' && targetArea === 'ALL') {
        const reg = filters.REGION.trim().toUpperCase();
        const recRegion = (r.REGION || '').trim().toUpperCase();
        const recArea = (r.COVER_AREA || '').trim().toUpperCase();
        if (recRegion !== reg && recArea !== reg) return false;
      }
      if (filters.BRAND && filters.BRAND !== 'ALL') {
        if ((r.BRAND || '').trim().toUpperCase() !== filters.BRAND.trim().toUpperCase()) return false;
      }
      if (filters.KATEGORI && filters.KATEGORI !== 'ALL') {
        if (resolveCategory(r).trim().toUpperCase() !== filters.KATEGORI.trim().toUpperCase()) return false;
      }
      if (filters.STATUS_PRODUK && filters.STATUS_PRODUK !== 'ALL') {
        if (resolveProductStatus(r) !== filters.STATUS_PRODUK) return false;
      }
      if (filters.SKU && filters.SKU !== 'ALL') {
        const qSku = filters.SKU.toLowerCase();
        const matchSku =
          (r.SKU || '').toLowerCase().includes(qSku) ||
          (r.NO_SKU || '').toLowerCase().includes(qSku) ||
          (r.SPU || '').toLowerCase().includes(qSku);
        if (!matchSku) return false;
      }
      if (filters.SALES && filters.SALES !== 'ALL') {
        if ((r.SALES || '').trim().toUpperCase() !== filters.SALES.trim().toUpperCase()) return false;
      }
      if (filters.TRAINER && filters.TRAINER !== 'ALL') {
        if (getTrainerForRecord(r).trim().toUpperCase() !== filters.TRAINER.trim().toUpperCase()) return false;
      }
      if (filters.SPV && filters.SPV !== 'ALL') {
        if ((r.SPV || '').trim().toUpperCase() !== filters.SPV.trim().toUpperCase()) return false;
      }
      if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL') {
        if ((r.NAMA_STORE || '').trim().toUpperCase() !== filters.NAMA_STORE.trim().toUpperCase()) return false;
      }
      // NOTE: filters.KET sengaja TIDAK difilter agar SELL IN dan SELL OUT selalu terbaca berdampingan!

      if (filters.searchQuery && filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim().toLowerCase();
        const str = `${r.TANGGAL || ''} ${r.BULAN || ''} ${r.NAMA_STORE || ''} ${r.SKU || ''} ${r.NO_SKU || ''} ${r.BRAND || ''} ${resolveCategory(r)} ${r.SALES || ''} ${r.BA || ''} ${r.SPV || ''} ${getTrainerForRecord(r)} ${r.COVER_AREA || ''} ${r.REGION || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
    }

    return true;
  });
}

function evaluateGapMetrics(sellInValue: number, sellOutValue: number) {
  const gapValue = sellInValue - sellOutValue;
  const absGapValue = Math.abs(gapValue);
  const baseDenom = sellInValue > 0 ? sellInValue : sellOutValue > 0 ? sellOutValue : 0;
  const gapPercent = baseDenom > 0 ? Math.round(((sellInValue - sellOutValue) / baseDenom) * 1000) / 10 : 0;
  const absGapPercent = Math.abs(gapPercent);
  const sellThroughPercent = sellInValue > 0 ? Math.round((sellOutValue / sellInValue) * 1000) / 10 : 0;
  const isOver20Percent = (sellInValue > 0 || sellOutValue > 0) && absGapPercent > 20;

  let statusType: 'overstock' | 'healthy' | 'stockout_risk' | 'empty' = 'healthy';
  let statusLabel = 'Serapan Seimbang (≤ 20%)';
  let rootCauseAnalysis = '';
  let recommendedAction = '';

  if (sellInValue === 0 && sellOutValue === 0) {
    statusType = 'empty';
    statusLabel = 'Belum Ada Transaksi';
    rootCauseAnalysis = 'Belum tercatat transaksi Sell In maupun Sell Out dari Google Sheet pada periode & filter ini.';
    recommendedAction = 'Periksa sinkronisasi Google Sheet atau pilih bulan/filter lain yang memiliki transaksi aktif.';
  } else if (gapPercent > 20) {
    statusType = 'overstock';
    statusLabel = `Penumpukan Stok (+${gapPercent}%)`;
    rootCauseAnalysis = `Pesanan Sell In (${Math.round(sellInValue / 1e6)} Jt) melampaui serapan konsumen (${Math.round(sellOutValue / 1e6)} Jt) sebesar ${absGapPercent}%. Terjadi akumulasi inventori yang perlu dipercepat perputarannya.`;
    recommendedAction = `1. Tahan order Sell In baru untuk SKU lambat.\n2. Dorong promo bundling atau flash sale di counter.\n3. Evaluasi posisi display produk di rak toko.`;
  } else if (gapPercent < -20) {
    statusType = 'stockout_risk';
    statusLabel = `Rawan Habis Stok (${gapPercent}%)`;
    rootCauseAnalysis = `Penjualan Sell Out konsumen (${Math.round(sellOutValue / 1e6)} Jt) melampaui pasokan Sell In (${Math.round(sellInValue / 1e6)} Jt) sebesar ${absGapPercent}%. Stok toko menipis dan berisiko kehilangan omset.`;
    recommendedAction = `1. Terbitkan PO ulang (Restock) segera untuk Hero SKU.\n2. Koordinasi pengiriman cepat ke gerai prioritas.\n3. Jaga buffer stok minimal 1.5x rata-rata mingguan.`;
  } else {
    statusType = 'healthy';
    statusLabel = `Serapan Seimbang (${gapPercent >= 0 ? '+' : ''}${gapPercent}%)`;
    rootCauseAnalysis = `Aliran stok antara Sell In dan serapan Sell Out seimbang (${absGapPercent}% selisih, berada dalam batas aman ≤ 20%).`;
    recommendedAction = `Pertahankan ritme pengiriman dan pantau pergerakan stok mingguan di toko binaan.`;
  }

  return {
    gapValue,
    absGapValue,
    gapPercent,
    absGapPercent,
    sellThroughPercent,
    isOver20Percent,
    statusType,
    statusLabel,
    rootCauseAnalysis,
    recommendedAction,
  };
}

/**
 * Hitung Rincian Perbandingan Sell In vs Sell Out Per Bulan (Januari s/d Desember)
 * 100% mengambil SELL IN dan SELL OUT dari Google Sheet terhubung + override edit manual per bulan.
 * Filter KET sengaja dinonaktifkan.
 */
export function calculateMonthlySellInVsSellOut(
  records: TransactionRecord[],
  selectedYear: number,
  selectedArea: string = 'ALL',
  filters?: FilterState
): {
  rows: MonthlySellInOutRow[];
  scopeKey: string;
  totals: {
    totalSheetSellIn: number;
    totalSheetSellOut: number;
    totalSellIn: number;
    totalSellOut: number;
    totalGapValue: number;
    avgGapPercent: number;
    sellThroughPercent: number;
    editedMonthsCount: number;
  };
} {
  const scopeKey = buildFilterScopeKey(selectedYear, selectedArea, filters);
  const allOverrides = loadMonthlySellInOutOverrides();

  // Filter semua kecuali BULAN dan KET agar rincian 12 bulan lengkap terlihat
  const yearFiltered = filterSheetRecordsIgnoringKet(records, 'ALL', selectedYear, selectedArea, filters);

  const monthBuckets = new Map<
    string,
    { sheetSellIn: number; sheetSellOut: number; txSellInCount: number; txSellOutCount: number }
  >();
  MONTHS_12.forEach((m) => {
    monthBuckets.set(m, { sheetSellIn: 0, sheetSellOut: 0, txSellInCount: 0, txSellOutCount: 0 });
  });

  yearFiltered.forEach((r) => {
    const { month } = resolveRecordMonthAndYear(r);
    if (!month || !monthBuckets.has(month)) return;
    const bucket = monthBuckets.get(month)!;
    const val = Number(r.VALUE) || 0;
    const ketType = classifyRecordKet(r.KET);
    if (ketType === 'SELL IN') {
      bucket.sheetSellIn += val;
      bucket.txSellInCount += 1;
    } else if (ketType === 'SELL OUT') {
      bucket.sheetSellOut += val;
      bucket.txSellOutCount += 1;
    }
  });

  let totalSheetSellIn = 0;
  let totalSheetSellOut = 0;
  let totalSellIn = 0;
  let totalSellOut = 0;
  let editedMonthsCount = 0;

  const rows: MonthlySellInOutRow[] = MONTHS_12.map((month, idx) => {
    const bucket = monthBuckets.get(month)!;
    const ov = allOverrides[`${scopeKey}::${month}`];
    const isManualEdit = Boolean(ov && (ov.sellIn !== undefined || ov.sellOut !== undefined));
    if (isManualEdit) editedMonthsCount += 1;

    const sellInValue = ov?.sellIn !== undefined ? ov.sellIn : bucket.sheetSellIn;
    const sellOutValue = ov?.sellOut !== undefined ? ov.sellOut : bucket.sheetSellOut;

    totalSheetSellIn += bucket.sheetSellIn;
    totalSheetSellOut += bucket.sheetSellOut;
    totalSellIn += sellInValue;
    totalSellOut += sellOutValue;

    const metrics = evaluateGapMetrics(sellInValue, sellOutValue);

    return {
      month,
      monthNumber: idx + 1,
      year: selectedYear,
      sheetSellIn: bucket.sheetSellIn,
      sheetSellOut: bucket.sheetSellOut,
      sellInValue,
      sellOutValue,
      gapValue: metrics.gapValue,
      absGapValue: metrics.absGapValue,
      gapPercent: metrics.gapPercent,
      sellThroughPercent: metrics.sellThroughPercent,
      isOver20Percent: metrics.isOver20Percent,
      statusType: metrics.statusType,
      statusLabel: metrics.statusLabel,
      txSellInCount: bucket.txSellInCount,
      txSellOutCount: bucket.txSellOutCount,
      isManualEdit,
      notes: ov?.notes || '',
    };
  });

  const totalGapValue = totalSellIn - totalSellOut;
  const baseDenom = totalSellIn > 0 ? totalSellIn : totalSellOut > 0 ? totalSellOut : 0;
  const avgGapPercent = baseDenom > 0 ? Math.round(((totalSellIn - totalSellOut) / baseDenom) * 1000) / 10 : 0;
  const sellThroughPercent = totalSellIn > 0 ? Math.round((totalSellOut / totalSellIn) * 1000) / 10 : 0;

  return {
    rows,
    scopeKey,
    totals: {
      totalSheetSellIn,
      totalSheetSellOut,
      totalSellIn,
      totalSellOut,
      totalGapValue,
      avgGapPercent,
      sellThroughPercent,
      editedMonthsCount,
    },
  };
}

export function calculateSellInVsSellOut(
  records: TransactionRecord[],
  dimension: SellInSellOutDimension,
  selectedMonth: string, // 'ALL' or specific uppercase month
  selectedYear: number,
  selectedArea: string = 'ALL',
  filters?: FilterState
): {
  items: SellInSellOutItem[];
  summary: SellInSellOutSummary;
  monthlyRows: MonthlySellInOutRow[];
  monthlyScopeKey: string;
} {
  // 1. Hitung Rincian Per Bulan (Jan–Des) dari Google Sheet + edit manual bulanan
  const monthlyData = calculateMonthlySellInVsSellOut(records, selectedYear, selectedArea, filters);

  // 2. Filter records berdasarkan periode, area, dan filter terintegrasi (TANPA filter KET!)
  const filtered = filterSheetRecordsIgnoringKet(records, selectedMonth, selectedYear, selectedArea, filters);

  interface EntityAgg {
    id: string;
    name: string;
    secondaryInfo: string;
    area: string;
    region: string;
    storeName?: string;
    baName?: string;
    salesName?: string;
    trainerName?: string;
    spvName?: string;
    sellIn: number;
    sellOut: number;
    target?: number;
  }

  const aggMap = new Map<string, EntityAgg>();

  const getOrCreate = (key: string, base: Partial<EntityAgg>): EntityAgg => {
    if (!aggMap.has(key)) {
      aggMap.set(key, {
        id: `agg-${dimension}-${key}`,
        name: key,
        secondaryInfo: '',
        area: 'RIAU',
        region: 'PEKAN BARU',
        sellIn: 0,
        sellOut: 0,
        ...base,
      });
    }
    return aggMap.get(key)!;
  };

  // Agregasi 100% dari transaksi Google Sheet
  filtered.forEach((r) => {
    const val = Number(r.VALUE) || 0;
    const ketType = classifyRecordKet(r.KET);
    if (ketType === 'RETURN') return;

    const trainerResolved = getTrainerForRecord(r);
    let entityKey = '';
    let secInfo = '';

    if (dimension === 'store') {
      entityKey = (r.NAMA_STORE || 'Toko Lainnya').trim();
      secInfo = `${r.COVER_AREA || r.REGION || 'Area'} · SPV: ${r.SPV || '-'}`;
    } else if (dimension === 'ba') {
      entityKey = (r.BA || 'Non-BA / Counter').trim();
      if (!entityKey || entityKey === '-') entityKey = 'Non-BA / Counter';
      secInfo = `${r.NAMA_STORE || 'Outlet'} · ${r.COVER_AREA || r.REGION || 'Area'}`;
    } else if (dimension === 'sales') {
      entityKey = (r.SALES || 'SALES UMUM').trim();
      secInfo = `${r.COVER_AREA || r.REGION || 'Area'} · SPV: ${r.SPV || '-'}`;
    } else if (dimension === 'trainer') {
      entityKey = trainerResolved;
      secInfo = `Trainer Coverage ${r.COVER_AREA || r.REGION || 'Area'}`;
    } else if (dimension === 'spv') {
      entityKey = (r.SPV || 'WIDODO').trim().toUpperCase();
      secInfo = `Supervisor Area ${r.REGION || r.COVER_AREA || 'Riau'}`;
    }

    if (!entityKey) return;

    const entry = getOrCreate(entityKey, {
      name: entityKey,
      secondaryInfo: secInfo,
      area: r.COVER_AREA || r.REGION || 'RIAU',
      region: r.REGION || 'PEKAN BARU',
      storeName: r.NAMA_STORE,
      baName: r.BA,
      salesName: r.SALES,
      trainerName: trainerResolved,
      spvName: (r.SPV || 'WIDODO').trim().toUpperCase(),
    });

    if (ketType === 'SELL IN') {
      entry.sellIn += val;
    } else if (ketType === 'SELL OUT') {
      entry.sellOut += val;
    }
  });

  // Seeding entitas master (nilai tetap 0 dari sheet jika tidak ada transaksi, TIDAK dibuat angka fiktif)
  const hasSpecificSearch = Boolean(filters?.searchQuery?.trim());
  const hasStoreFilter = Boolean(filters?.NAMA_STORE && filters.NAMA_STORE !== 'ALL');
  const hasSalesFilter = Boolean(filters?.SALES && filters.SALES !== 'ALL');
  const hasTrainerFilter = Boolean(filters?.TRAINER && filters.TRAINER !== 'ALL');

  if (dimension === 'store' && !hasStoreFilter && !hasSpecificSearch) {
    DEFAULT_WEEKLY_STORES.forEach((ws) => {
      if (hasSalesFilter && ws.salesName.toUpperCase() !== filters!.SALES.toUpperCase()) return;
      if (hasTrainerFilter && ws.trainerName.toUpperCase() !== (filters?.TRAINER || '').toUpperCase()) return;
      if (selectedArea !== 'ALL' && ws.coverArea.toUpperCase() !== selectedArea.toUpperCase() && ws.region.toUpperCase() !== selectedArea.toUpperCase()) return;

      if (!aggMap.has(ws.storeName)) {
        aggMap.set(ws.storeName, {
          id: `ws-${ws.id}`,
          name: ws.storeName,
          secondaryInfo: `${ws.coverArea} · BA: ${ws.baName}`,
          area: ws.coverArea,
          region: ws.region,
          storeName: ws.storeName,
          baName: ws.baName,
          salesName: ws.salesName,
          trainerName: ws.trainerName,
          spvName: 'WIDODO',
          sellIn: 0,
          sellOut: 0,
        });
      }
    });
  } else if (dimension === 'trainer' && !hasTrainerFilter && !hasSpecificSearch) {
    const dynamicTrainers = loadTrainerConfigs();
    const trainerSource = dynamicTrainers.length > 0 ? dynamicTrainers : DEFAULT_TRAINERS_DATA;
    trainerSource.forEach((tr) => {
      if (!aggMap.has(tr.trainerName)) {
        aggMap.set(tr.trainerName, {
          id: `tr-${tr.id}`,
          name: tr.trainerName,
          secondaryInfo: tr.areaCovered,
          area: tr.region,
          region: tr.region,
          trainerName: tr.trainerName,
          sellIn: 0,
          sellOut: 0,
          target: tr.targetSellOut,
        });
      }
    });
  } else if (dimension === 'ba' && !hasStoreFilter && !hasSpecificSearch) {
    const masterStores = loadMasterStoreList(records);
    masterStores.forEach((ms) => {
      if (hasSalesFilter && ms.salesName.toUpperCase() !== filters!.SALES.toUpperCase()) return;
      if (hasTrainerFilter && ms.trainerName.toUpperCase() !== (filters?.TRAINER || '').toUpperCase()) return;
      if (selectedArea !== 'ALL' && ms.coverArea.toUpperCase() !== selectedArea.toUpperCase() && ms.region.toUpperCase() !== selectedArea.toUpperCase()) return;

      if (ms.hasBa && ms.baName && ms.baName !== '- (Non-BA)') {
        const bName = ms.baName.trim();
        if (!aggMap.has(bName)) {
          aggMap.set(bName, {
            id: `ba-${bName.replace(/\s+/g, '_')}`,
            name: bName,
            secondaryInfo: `${ms.storeName} · ${ms.coverArea || 'Area'}`,
            area: ms.coverArea || 'PEKANBARU',
            region: ms.region || 'PEKANBARU',
            storeName: ms.storeName,
            baName: bName,
            salesName: ms.salesName,
            trainerName: ms.trainerName,
            spvName: 'WIDODO',
            sellIn: 0,
            sellOut: 0,
            target: 35000000,
          });
        }
      }
    });
  }

  // Muat override entitas & target terpadu
  const entityOverrides = loadEntitySellInOutOverrides();
  const baOverrides = dimension === 'ba' ? loadBaEvaluationOverrides() : {};
  const salesSellOutTargets = dimension === 'sales' ? loadSalesSellOutTargets(selectedMonth) : {};
  const salesSellInTargets = dimension === 'sales' ? loadSalesTargets(selectedMonth) : {};
  const baNonTargets = dimension === 'ba' ? loadBaNonLavojoyTargets(selectedMonth) : {};
  const baLavTargets = dimension === 'ba' ? loadBaLavojoyTargets(selectedMonth) : {};
  const trainerConfigs = dimension === 'trainer' ? loadTrainerConfigs() : [];
  const trainerMonthlyTargets = dimension === 'trainer' ? loadTrainerTargets(selectedMonth) : {};

  const items: SellInSellOutItem[] = [];

  aggMap.forEach((entry, key) => {
    let sIn = entry.sellIn;
    let sOut = entry.sellOut;

    if (dimension === 'sales') {
      const mKey =
        Object.keys(salesSellOutTargets).find((k) => k.toUpperCase().trim() === key.toUpperCase().trim()) ||
        Object.keys(salesSellInTargets).find((k) => k.toUpperCase().trim() === key.toUpperCase().trim());
      entry.target = mKey
        ? salesSellOutTargets[mKey] ?? salesSellInTargets[mKey] ?? DEFAULT_SALES_SELLOUT_TARGET
        : DEFAULT_SALES_SELLOUT_TARGET;
    } else if (dimension === 'trainer') {
      const matchedCfg = trainerConfigs.find((t) => t.trainerName.toUpperCase().trim() === key.toUpperCase().trim());
      const mTr =
        (matchedCfg ? trainerMonthlyTargets[matchedCfg.id] : undefined) ||
        trainerMonthlyTargets[key] ||
        trainerMonthlyTargets[key.toUpperCase().trim()];
      if (mTr?.targetSellOut && mTr.targetSellOut > 0) {
        entry.target = mTr.targetSellOut;
      } else if (matchedCfg?.targetSellOut) {
        entry.target = matchedCfg.targetSellOut;
      }
    } else if (dimension === 'ba') {
      const stName = (entry.storeName || '').trim();
      const nonKey = Object.keys(baNonTargets).find((k) => k.toUpperCase().trim() === stName.toUpperCase());
      const lavKey = Object.keys(baLavTargets).find((k) => k.toUpperCase().trim() === stName.toUpperCase());
      if (nonKey !== undefined || lavKey !== undefined) {
        entry.target =
          (nonKey !== undefined ? baNonTargets[nonKey] : DEFAULT_BA_NON_LAVOJOY_TARGET) +
          (lavKey !== undefined ? baLavTargets[lavKey] : DEFAULT_BA_LAVOJOY_TARGET);
      }
    }

    // Terapkan override manual entitas jika ada
    const entKey = buildEntityOverrideKey(selectedYear, selectedMonth, dimension, key);
    const entOv = entityOverrides[entKey];
    let isManualEntity = false;
    if (entOv) {
      if (entOv.sellIn !== undefined) {
        sIn = entOv.sellIn;
        isManualEntity = true;
      }
      if (entOv.sellOut !== undefined) {
        sOut = entOv.sellOut;
        isManualEntity = true;
      }
      if (entOv.target !== undefined) entry.target = entOv.target;
    } else if (dimension === 'ba' && baOverrides[key.toUpperCase().trim()]) {
      const ov = baOverrides[key.toUpperCase().trim()];
      if (ov.sellIn !== undefined) {
        sIn = ov.sellIn;
        isManualEntity = true;
      }
      if (ov.sellOut !== undefined) {
        sOut = ov.sellOut;
        isManualEntity = true;
      }
      if (ov.target !== undefined) entry.target = ov.target;
    }

    const metrics = evaluateGapMetrics(sIn, sOut);
    const targetVal = entry.target || 0;
    const achievementPercent = targetVal > 0 ? Math.round((sOut / targetVal) * 1000) / 10 : 0;

    items.push({
      id: entry.id,
      name: entry.name,
      secondaryInfo: isManualEntity ? `${entry.secondaryInfo} · Diedit Manual` : entry.secondaryInfo,
      dimension,
      sellInValue: sIn,
      sellOutValue: sOut,
      gapValue: metrics.gapValue,
      absGapValue: metrics.absGapValue,
      gapPercent: metrics.gapPercent,
      sellThroughPercent: metrics.sellThroughPercent,
      isOver20Percent: metrics.isOver20Percent,
      statusType: metrics.statusType === 'empty' ? 'healthy' : metrics.statusType,
      statusLabel: metrics.statusLabel,
      rootCauseAnalysis: metrics.rootCauseAnalysis,
      recommendedAction: metrics.recommendedAction,
      area: entry.area,
      region: entry.region,
      storeName: entry.storeName,
      baName: entry.baName,
      salesName: entry.salesName,
      trainerName: entry.trainerName,
      spvName: entry.spvName,
      target: targetVal,
      achievementPercent,
    });
  });

  // Sort: Entitas aktif > 20% dulu, lalu berdasarkan volume transaksi / absGap terbesar
  items.sort((a, b) => {
    const aHasData = a.sellInValue > 0 || a.sellOutValue > 0;
    const bHasData = b.sellInValue > 0 || b.sellOutValue > 0;
    if (aHasData && !bHasData) return -1;
    if (!aHasData && bHasData) return 1;
    if (a.isOver20Percent && !b.isOver20Percent) return -1;
    if (!a.isOver20Percent && b.isOver20Percent) return 1;
    return b.absGapValue - a.absGapValue || b.sellOutValue - a.sellOutValue;
  });

  // 3. Hitung Summary KPI langsung dari data Google Sheet (+ edit bulanan jika ada)
  const upperMonth = (selectedMonth || 'ALL').trim().toUpperCase();
  let totalSellIn = 0;
  let totalSellOut = 0;
  let isManualOverride = false;

  if (upperMonth === 'ALL') {
    totalSellIn = monthlyData.totals.totalSellIn;
    totalSellOut = monthlyData.totals.totalSellOut;
    isManualOverride = monthlyData.totals.editedMonthsCount > 0;
  } else {
    const matchedMonthRow = monthlyData.rows.find((row) => row.month === upperMonth);
    if (matchedMonthRow) {
      totalSellIn = matchedMonthRow.sellInValue;
      totalSellOut = matchedMonthRow.sellOutValue;
      isManualOverride = matchedMonthRow.isManualEdit;
    } else {
      totalSellIn = items.reduce((sum, i) => sum + i.sellInValue, 0);
      totalSellOut = items.reduce((sum, i) => sum + i.sellOutValue, 0);
    }
  }

  const totalGapValue = totalSellIn - totalSellOut;
  const baseDenom = totalSellIn > 0 ? totalSellIn : totalSellOut > 0 ? totalSellOut : 0;
  const avgGapPercent = baseDenom > 0 ? Math.round(((totalSellIn - totalSellOut) / baseDenom) * 1000) / 10 : 0;
  const overallSellThroughPercent = totalSellIn > 0 ? Math.round((totalSellOut / totalSellIn) * 1000) / 10 : 0;

  const over20Count = items.filter((i) => i.isOver20Percent).length;
  const overstockCount = items.filter((i) => (i.sellInValue > 0 || i.sellOutValue > 0) && i.statusType === 'overstock').length;
  const stockoutRiskCount = items.filter((i) => (i.sellInValue > 0 || i.sellOutValue > 0) && i.statusType === 'stockout_risk').length;
  const healthyCount = items.filter((i) => (i.sellInValue > 0 || i.sellOutValue > 0) && i.statusType === 'healthy').length;

  const summary: SellInSellOutSummary = {
    periodMonth: selectedMonth,
    periodYear: selectedYear,
    totalSellIn,
    totalSellOut,
    totalGapValue,
    avgGapPercent,
    overallSellThroughPercent,
    totalEntitiesCount: items.length,
    over20Count,
    overstockCount,
    stockoutRiskCount,
    healthyCount,
    isManualOverride,
  };

  return {
    items,
    summary,
    monthlyRows: monthlyData.rows,
    monthlyScopeKey: monthlyData.scopeKey,
  };
}

export function exportSellInVsSellOutToExcel(
  items: SellInSellOutItem[],
  summary: SellInSellOutSummary,
  monthlyRows: MonthlySellInOutRow[],
  dimensionLabel: string,
  selectedMonth: string,
  selectedYear: number
) {
  import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rincian Per Bulan (Januari - Desember)
    const monthlyHeaders = [
      'Bulan',
      'Tahun',
      'Sell In Efektif (IDR)',
      'Sell Out Efektif (IDR)',
      'Sell In Google Sheet (IDR)',
      'Sell Out Google Sheet (IDR)',
      'Selisih / Gap (IDR)',
      'Persen Selisih (%)',
      'Sell-Through (%)',
      'Status Evaluasi',
      'Sumber Data',
      'Catatan',
    ];

    const monthlyBody = monthlyRows.map((row) => [
      row.month,
      row.year,
      row.sellInValue,
      row.sellOutValue,
      row.sheetSellIn,
      row.sheetSellOut,
      row.gapValue,
      `${row.gapPercent}%`,
      `${row.sellThroughPercent}%`,
      row.statusLabel,
      row.isManualEdit ? 'Edit Manual' : 'Google Sheet',
      row.notes || '-',
    ]);

    const totalSellInYear = monthlyRows.reduce((s, r) => s + r.sellInValue, 0);
    const totalSellOutYear = monthlyRows.reduce((s, r) => s + r.sellOutValue, 0);
    const totalGapYear = totalSellInYear - totalSellOutYear;
    const totalGapPctYear =
      totalSellInYear > 0 ? Math.round((totalGapYear / totalSellInYear) * 1000) / 10 : 0;
    const totalStPctYear =
      totalSellInYear > 0 ? Math.round((totalSellOutYear / totalSellInYear) * 1000) / 10 : 0;

    monthlyBody.push([
      'TOTAL AKUMULASI',
      selectedYear,
      totalSellInYear,
      totalSellOutYear,
      monthlyRows.reduce((s, r) => s + r.sheetSellIn, 0),
      monthlyRows.reduce((s, r) => s + r.sheetSellOut, 0),
      totalGapYear,
      `${totalGapPctYear}%`,
      `${totalStPctYear}%`,
      totalGapPctYear > 20 ? 'Penumpukan Stok' : totalGapPctYear < -20 ? 'Rawan Habis Stok' : 'Serapan Seimbang',
      'Rekap Tahunan',
      '-',
    ]);

    const wsMonthly = XLSX.utils.aoa_to_sheet([
      [`RINCIAN PERBANDINGAN SELL IN VS SELL OUT PER BULAN (${selectedYear})`],
      ['Sumber Data', 'Google Sheet Terhubung (Filter KET Dinonaktifkan)'],
      ['Periode Filter Aktif', `${selectedMonth} ${selectedYear}`],
      [],
      monthlyHeaders,
      ...monthlyBody,
    ]);
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Rincian Per Bulan');

    // Sheet 2: Detail Entitas
    const headers = [
      'Nama Entitas',
      'Keterangan / Wilayah',
      'Sell In (IDR)',
      'Sell Out (IDR)',
      'Selisih Nilai (IDR)',
      'Persen Selisih (%)',
      'Sell-Through (%)',
      'Target (IDR)',
      '% Pencapaian',
      'Status Evaluasi',
      'Peringatan > 20%',
      'Rincian Analisis Akar Masalah',
      'Rencana Tindakan (Action Plan)',
    ];

    const dataRows = items.map((item) => [
      item.name,
      item.secondaryInfo || '-',
      item.sellInValue,
      item.sellOutValue,
      item.gapValue,
      `${item.gapPercent}%`,
      `${item.sellThroughPercent}%`,
      item.target || 0,
      `${item.achievementPercent || 0}%`,
      item.statusLabel,
      item.isOver20Percent ? 'YA (PERINGATAN > 20%)' : 'NORMAL',
      item.rootCauseAnalysis,
      item.recommendedAction,
    ]);

    const wsData = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    XLSX.utils.book_append_sheet(wb, wsData, `Detail_${dimensionLabel}`);

    XLSX.writeFile(
      wb,
      `Perbandingan_SellIn_vs_SellOut_${dimensionLabel}_${selectedMonth}_${selectedYear}.xlsx`
    );
  });
}
