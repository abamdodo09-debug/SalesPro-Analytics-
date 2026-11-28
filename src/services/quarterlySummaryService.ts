import {
  TransactionRecord,
  QuarterPeriodKey,
  QuarterlyMonthDetail,
  SalesQuarterlySummaryItem,
  BaQuarterlySummaryItem,
  TrainerQuarterlySummaryItem,
  StoreQuarterlySummaryItem,
  QuarterlyOverallSummary,
} from '../types/dashboard';
import { loadKpiSalesData, loadBaIncidents } from './agingAndKpiService';
import { loadKpiTrainerData } from './kpiTrainerService';
import { DEFAULT_TRAINERS_DATA } from '../utils/costCalculations';
import { getTrainerForRecord, isFocusProduct, parseTransactionDate, getRecordDayOfMonth } from '../utils/analytics';
import { SALES_MASTER_6_CONFIG } from './kpiSalesData';
import {
  loadSalesTargets,
  loadSalesSellOutTargets,
  loadBaNonLavojoyTargets,
  loadBaLavojoyTargets,
  loadBaFocusTargets,
  loadCustomBaProfiles,
  CustomBaProfile,
  MONTH_OPTIONS_2026,
  loadTrainerConfigs,
  loadTrainerTargets,
  DEFAULT_BA_NON_LAVOJOY_TARGET,
  DEFAULT_BA_LAVOJOY_TARGET,
  DEFAULT_SALES_TARGET,
  DEFAULT_SALES_SELLOUT_TARGET,
  notifyTargetsUpdated,
  computeMonthlyStoreSellInLookup,
  findStoreSellInInLookup,
  getTargetsRevision,
} from './targetManagementService';
import { loadFocusOverrides, DEFAULT_FOCUS_TARGET_PCS } from './focusProductService';
import { loadMasterStoreList } from './masterStoreService';
import { resolveWeeklyBaStores, normalizeStoreAlnum } from '../utils/weeklyBaRegistry';

export const REGISTERED_QUARTERLY_SALES = [
  'ILHAMSYAH',
  'TIWI',
  'ABDUL RAHIM',
  'LUAR KOTA',
  'PARETO',
  'ALBERT FERNANDO',
] as const;

export const STORAGE_KEY_QUARTERLY_TARGETS = 'salespro_quarterly_targets_v1';

export type QuarterlyTargetRole = 'sales' | 'ba' | 'trainer';

export interface QuarterlyTargetOverrideEntry {
  targetSellIn?: number;
  targetSellOut?: number;
  updatedAt?: string;
}

export type QuarterlyTargetOverrideMap = Record<string, QuarterlyTargetOverrideEntry>;

function buildQuarterlyTargetKey(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entityName: string
): string {
  return `${year}|${quarter}|${role}|${entityName.trim().toUpperCase()}`;
}

export function loadQuarterlyTargetOverrides(): QuarterlyTargetOverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUARTERLY_TARGETS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getQuarterlyTargetOverride(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entityName: string
): QuarterlyTargetOverrideEntry | undefined {
  const all = loadQuarterlyTargetOverrides();
  return all[buildQuarterlyTargetKey(year, quarter, role, entityName)];
}

export function saveQuarterlyTargetOverride(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entityName: string,
  entry: { targetSellIn?: number; targetSellOut?: number }
): void {
  const all = loadQuarterlyTargetOverrides();
  const key = buildQuarterlyTargetKey(year, quarter, role, entityName);
  const prev = all[key] || {};
  all[key] = {
    ...prev,
    ...(entry.targetSellIn !== undefined ? { targetSellIn: Math.max(0, Math.round(entry.targetSellIn)) } : {}),
    ...(entry.targetSellOut !== undefined ? { targetSellOut: Math.max(0, Math.round(entry.targetSellOut)) } : {}),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY_QUARTERLY_TARGETS, JSON.stringify(all));
  notifyTargetsUpdated({ category: 'quarterly_targets' });
}

export function saveBulkQuarterlyTargetOverrides(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entries: { entityName: string; targetSellIn?: number; targetSellOut?: number }[]
): void {
  const all = loadQuarterlyTargetOverrides();
  const now = new Date().toISOString();
  entries.forEach((item) => {
    const key = buildQuarterlyTargetKey(year, quarter, role, item.entityName);
    const prev = all[key] || {};
    all[key] = {
      ...prev,
      ...(item.targetSellIn !== undefined ? { targetSellIn: Math.max(0, Math.round(item.targetSellIn)) } : {}),
      ...(item.targetSellOut !== undefined ? { targetSellOut: Math.max(0, Math.round(item.targetSellOut)) } : {}),
      updatedAt: now,
    };
  });
  localStorage.setItem(STORAGE_KEY_QUARTERLY_TARGETS, JSON.stringify(all));
  notifyTargetsUpdated({ category: 'quarterly_targets' });
}

export function clearQuarterlyTargetOverride(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entityName: string
): void {
  const all = loadQuarterlyTargetOverrides();
  const key = buildQuarterlyTargetKey(year, quarter, role, entityName);
  if (key in all) {
    delete all[key];
    localStorage.setItem(STORAGE_KEY_QUARTERLY_TARGETS, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'quarterly_targets' });
  }
}

export const STORAGE_KEY_QUARTERLY_ACTUAL_SELLIN = 'salespro_quarterly_actual_sellin_v1';

export interface QuarterlyActualSellInOverrideEntry {
  actualSellIn?: number;
  monthlySellIn?: [number, number, number];
  updatedAt?: string;
}

export type QuarterlyActualSellInOverrideMap = Record<string, QuarterlyActualSellInOverrideEntry>;

export function loadQuarterlyActualSellInOverrides(): QuarterlyActualSellInOverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUARTERLY_ACTUAL_SELLIN);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveQuarterlyActualSellInOverride(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entityName: string,
  entry: { actualSellIn?: number; monthlySellIn?: [number, number, number] }
): void {
  const all = loadQuarterlyActualSellInOverrides();
  const key = buildQuarterlyTargetKey(year, quarter, role, entityName);
  const nextEntry: QuarterlyActualSellInOverrideEntry = {
    updatedAt: new Date().toISOString(),
  };

  if (entry.monthlySellIn && entry.monthlySellIn.length === 3) {
    const cleaned: [number, number, number] = [
      Math.max(0, Math.round(entry.monthlySellIn[0] || 0)),
      Math.max(0, Math.round(entry.monthlySellIn[1] || 0)),
      Math.max(0, Math.round(entry.monthlySellIn[2] || 0)),
    ];
    nextEntry.monthlySellIn = cleaned;
    nextEntry.actualSellIn = cleaned[0] + cleaned[1] + cleaned[2];
  } else if (entry.actualSellIn !== undefined) {
    nextEntry.actualSellIn = Math.max(0, Math.round(entry.actualSellIn));
  }

  all[key] = nextEntry;
  localStorage.setItem(STORAGE_KEY_QUARTERLY_ACTUAL_SELLIN, JSON.stringify(all));
  notifyTargetsUpdated({ category: 'quarterly_actual_sellin' });
}

export function saveBulkQuarterlyActualSellInOverrides(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entries: { entityName: string; actualSellIn: number }[]
): void {
  const all = loadQuarterlyActualSellInOverrides();
  const now = new Date().toISOString();
  entries.forEach((item) => {
    const key = buildQuarterlyTargetKey(year, quarter, role, item.entityName);
    all[key] = {
      actualSellIn: Math.max(0, Math.round(item.actualSellIn || 0)),
      updatedAt: now,
    };
  });
  localStorage.setItem(STORAGE_KEY_QUARTERLY_ACTUAL_SELLIN, JSON.stringify(all));
  notifyTargetsUpdated({ category: 'quarterly_actual_sellin' });
}

export function clearQuarterlyActualSellInOverride(
  year: number,
  quarter: QuarterPeriodKey,
  role: QuarterlyTargetRole,
  entityName: string
): void {
  const all = loadQuarterlyActualSellInOverrides();
  const key = buildQuarterlyTargetKey(year, quarter, role, entityName);
  if (key in all) {
    delete all[key];
    localStorage.setItem(STORAGE_KEY_QUARTERLY_ACTUAL_SELLIN, JSON.stringify(all));
    notifyTargetsUpdated({ category: 'quarterly_actual_sellin' });
  }
}

function resolveMonthlySellInActuals(
  rawMonthly: number[],
  override?: QuarterlyActualSellInOverrideEntry
): { monthlySellIn: [number, number, number]; isCustomActualSellIn: boolean } {
  const base: [number, number, number] = [
    rawMonthly[0] || 0,
    rawMonthly[1] || 0,
    rawMonthly[2] || 0,
  ];
  if (!override) {
    return { monthlySellIn: base, isCustomActualSellIn: false };
  }
  if (Array.isArray(override.monthlySellIn) && override.monthlySellIn.length === 3) {
    return {
      monthlySellIn: [
        Math.max(0, Math.round(override.monthlySellIn[0] || 0)),
        Math.max(0, Math.round(override.monthlySellIn[1] || 0)),
        Math.max(0, Math.round(override.monthlySellIn[2] || 0)),
      ],
      isCustomActualSellIn: true,
    };
  }
  if (override.actualSellIn !== undefined && Number.isFinite(override.actualSellIn)) {
    const total = Math.max(0, Math.round(override.actualSellIn));
    const rawSum = base[0] + base[1] + base[2];
    if (rawSum > 0) {
      const m0 = Math.round(base[0] * (total / rawSum));
      const m1 = Math.round(base[1] * (total / rawSum));
      const m2 = Math.max(0, total - m0 - m1);
      return { monthlySellIn: [m0, m1, m2], isCustomActualSellIn: true };
    }
    const part = Math.floor(total / 3);
    const m2 = Math.max(0, total - part * 2);
    return { monthlySellIn: [part, part, m2], isCustomActualSellIn: true };
  }
  return { monthlySellIn: base, isCustomActualSellIn: false };
}

export function canonicalizeRegisteredSalesName(raw?: string): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (!upper) return null;
  if (upper === 'ALBERT' || upper === 'ALBERT FERNANDO') return 'ALBERT FERNANDO';
  const exact = REGISTERED_QUARTERLY_SALES.find((name) => name === upper);
  return exact || null;
}

export const QUARTER_MONTHS: Record<
  QuarterPeriodKey,
  { months: number[]; monthNames: string[]; label: string; dateRange: string }
> = {
  Q1: {
    months: [0, 1, 2],
    monthNames: ['JANUARI', 'FEBRUARI', 'MARET'],
    label: 'Kuartal 1 (Q1)',
    dateRange: '01 Januari - 31 Maret',
  },
  Q2: {
    months: [3, 4, 5],
    monthNames: ['APRIL', 'MEI', 'JUNI'],
    label: 'Kuartal 2 (Q2)',
    dateRange: '01 April - 30 Juni',
  },
  Q3: {
    months: [6, 7, 8],
    monthNames: ['JULI', 'AGUSTUS', 'SEPTEMBER'],
    label: 'Kuartal 3 (Q3)',
    dateRange: '01 Juli - 30 September',
  },
  Q4: {
    months: [9, 10, 11],
    monthNames: ['OKTOBER', 'NOVEMBER', 'DESEMBER'],
    label: 'Kuartal 4 (Q4)',
    dateRange: '01 Oktober - 31 Desember',
  },
};

const ALL_MONTH_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

const recordMonthYearCache = new WeakMap<
  TransactionRecord,
  { monthIndex: number; year: number } | null
>();

// Helper parsing transaction record dates safely (checks explicit BULAN first to stay 100% consistent with Kelola Target)
export function parseRecordMonthYear(record: TransactionRecord): { monthIndex: number; year: number } | null {
  const cached = recordMonthYearCache.get(record);
  if (cached !== undefined) return cached;

  let parsedTanggal: { monthIndex: number; year: number } | null = null;
  if (record.TANGGAL) {
    const trimmed = record.TANGGAL.trim();
    const parts = trimmed.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const yr = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(yr) && !isNaN(m) && m >= 0 && m <= 11) parsedTanggal = { monthIndex: m, year: yr };
      } else {
        const m = parseInt(parts[0], 10) - 1;
        const rawYr = parseInt(parts[2], 10);
        const yr = rawYr < 100 ? 2000 + rawYr : rawYr;
        if (!isNaN(yr) && !isNaN(m) && m >= 0 && m <= 11) parsedTanggal = { monthIndex: m, year: yr };
      }
    }
  }

  let result: { monthIndex: number; year: number } | null = parsedTanggal;
  if (record.BULAN) {
    const bUpper = record.BULAN.trim().toUpperCase();
    const fullIdx = ALL_MONTH_NAMES.findIndex((m) => bUpper.includes(m));
    if (fullIdx !== -1) {
      const yr = record.TAHUN || parsedTanggal?.year || 2026;
      result = { monthIndex: fullIdx, year: yr };
    } else {
      const metaMatch = MONTH_OPTIONS_2026.find((meta) =>
        meta.aliases.some((alias) => bUpper === alias || bUpper.includes(alias))
      );
      if (metaMatch) {
        const yr = record.TAHUN || parsedTanggal?.year || 2026;
        result = { monthIndex: metaMatch.monthIndex, year: yr };
      }
    }
  }

  recordMonthYearCache.set(record, result);
  return result;
}

export function formatBaCutOffRangeLabel(quarter: QuarterPeriodKey, year: number): string {
  if (quarter === 'Q1') return `26 Des ${year - 1} - 25 Mar ${year}`;
  if (quarter === 'Q2') return `26 Mar - 25 Jun ${year}`;
  if (quarter === 'Q3') return `26 Jun - 25 Sep ${year}`;
  return `26 Sep - 25 Des ${year}`;
}

const baCutOffYmdWindowCache = new Map<string, Array<[number, number]>>();

function getBaCutOffYmdWindows(qMonths: number[], year: number): Array<[number, number]> {
  const key = `${year}|${qMonths.join(',')}`;
  const cached = baCutOffYmdWindowCache.get(key);
  if (cached) return cached;
  const windows: Array<[number, number]> = qMonths.map((mIdx) => {
    const s = new Date(year, mIdx - 1, 26);
    const e = new Date(year, mIdx, 25);
    return [
      s.getFullYear() * 10000 + s.getMonth() * 100 + s.getDate(),
      e.getFullYear() * 10000 + e.getMonth() * 100 + e.getDate(),
    ];
  });
  baCutOffYmdWindowCache.set(key, windows);
  return windows;
}

// Cut-off Sell Out BA: tanggal 26 bulan sebelumnya s/d tanggal 25 bulan berjalan
export function resolveBaCutOffQuarterPos(
  record: TransactionRecord,
  qMonths: number[],
  year: number
): number {
  let txYmd: number;
  const txDate = parseTransactionDate(record);

  if (txDate) {
    txYmd = txDate.getFullYear() * 10000 + txDate.getMonth() * 100 + txDate.getDate();
  } else {
    const dt = parseRecordMonthYear(record);
    if (!dt) return -1;
    const day = getRecordDayOfMonth(record);
    if (day === null) {
      return dt.year === year ? qMonths.indexOf(dt.monthIndex) : -1;
    }
    txYmd = dt.year * 10000 + dt.monthIndex * 100 + day;
  }

  const windows = getBaCutOffYmdWindows(qMonths, year);
  for (let qPos = 0; qPos < windows.length; qPos++) {
    const [startYmd, endYmd] = windows[qPos];
    if (txYmd >= startYmd && txYmd <= endYmd) {
      return qPos;
    }
  }
  return -1;
}

function classifyKet(ketRaw?: string): 'SELL IN' | 'SELL OUT' | 'OTHER' {
  const upper = (ketRaw || '').toUpperCase().trim();
  if (upper.includes('RETURN') || upper.includes('RETUR')) return 'OTHER';
  if (
    upper.includes('SELL IN') ||
    upper.includes('SELL-IN') ||
    upper === 'SELLIN' ||
    upper.includes('TAKING ORDER')
  ) {
    return 'SELL IN';
  }
  if (upper.includes('SELL OUT') || upper.includes('SELL-OUT') || upper === 'SELLOUT') {
    return 'SELL OUT';
  }
  return 'OTHER';
}

export interface QuarterlySummaryResult {
  overall: QuarterlyOverallSummary;
  salesList: SalesQuarterlySummaryItem[];
  baList: BaQuarterlySummaryItem[];
  trainerList: TrainerQuarterlySummaryItem[];
  storeList: StoreQuarterlySummaryItem[];
}

const quarterlySummaryLru: Array<{
  records: TransactionRecord[];
  key: string;
  result: QuarterlySummaryResult;
}> = [];

function getQuarterlyStorageSignature(): string {
  try {
    return [
      getTargetsRevision(),
      localStorage.getItem(STORAGE_KEY_QUARTERLY_TARGETS) || '',
      localStorage.getItem(STORAGE_KEY_QUARTERLY_ACTUAL_SELLIN) || '',
      localStorage.getItem('salespro_kpi_sales_overrides_v7') || '',
      localStorage.getItem('salespro_custom_kpi_trainer_v5') || '',
      localStorage.getItem('salespro_ba_punishment_v2') || '',
      localStorage.getItem('salespro_master_store_config_v2') || '',
      localStorage.getItem('salespro_ba_focus_overrides_v2') || '',
      localStorage.getItem('salespro_weekly_ba_stores_v1') || '',
      localStorage.getItem('salespro_weekly_ba_deleted_v1') || '',
    ].join('§');
  } catch {
    return String(getTargetsRevision());
  }
}

// Compute complete quarterly summary for Sales, BA & Trainer
export function calculateQuarterlySummary(
  records: TransactionRecord[],
  quarter: QuarterPeriodKey = 'Q4',
  year: number = 2026,
  filterArea: string = 'ALL',
  filterSpv: string = 'ALL',
  filterKet: string = 'ALL'
): QuarterlySummaryResult {
  const qInfo = QUARTER_MONTHS[quarter] || QUARTER_MONTHS.Q4;
  const qMonths = qInfo.months;
  const qMonthNames = qInfo.monthNames;
  const activeKet = (filterKet || 'ALL').toUpperCase().trim();

  const cacheKey = `${quarter}|${year}|${filterArea}|${filterSpv}|${activeKet}|${getQuarterlyStorageSignature()}`;
  for (let i = 0; i < quarterlySummaryLru.length; i++) {
    const entry = quarterlySummaryLru[i];
    if (entry.records === records && entry.key === cacheKey) {
      if (i > 0) {
        quarterlySummaryLru.splice(i, 1);
        quarterlySummaryLru.unshift(entry);
      }
      return entry.result;
    }
  }

  // Filter records by area & SPV (KET is tracked separately for Sell In & Sell Out & Active)
  const scopedRecords = records.filter((r) => {
    if (
      filterArea !== 'ALL' &&
      (r.COVER_AREA || '').toUpperCase() !== filterArea.toUpperCase() &&
      (r.REGION || '').toUpperCase() !== filterArea.toUpperCase()
    ) {
      return false;
    }
    if (filterSpv !== 'ALL' && (r.SPV || '').toUpperCase() !== filterSpv.toUpperCase()) {
      return false;
    }
    return true;
  });

  const kpiSalesAll = loadKpiSalesData();
  const kpiTrainerAll = loadKpiTrainerData();
  const baIncidentsAll = loadBaIncidents();
  const quarterlyOverrides = loadQuarterlyTargetOverrides();
  const quarterlyActualSellInOverrides = loadQuarterlyActualSellInOverrides();

  // Hoist per-month target maps once for the 3 quarter months instead of reloading per entity
  const qSalesInMaps = qMonthNames.map((mName) => loadSalesTargets(mName));
  const qSalesOutMaps = qMonthNames.map((mName) => loadSalesSellOutTargets(mName));
  const qBaNonMaps = qMonthNames.map((mName) => loadBaNonLavojoyTargets(mName));
  const qBaLavMaps = qMonthNames.map((mName) => loadBaLavojoyTargets(mName));
  const qBaFocusMaps = qMonthNames.map((mName) => loadBaFocusTargets(mName));
  const qTrainerMaps = qMonthNames.map((mName) => loadTrainerTargets(mName));

  // -------------------------------------------------------------
  // 1. SALES QUARTERLY SUMMARY (STRICTLY 6 REGISTERED SALES)
  // -------------------------------------------------------------
  const salesMap = new Map<
    string,
    {
      coverArea: string;
      region: string;
      spvName: string;
      monthlySellInActual: number[];
      monthlySellOutActual: number[];
      monthlyAllActual: number[];
    }
  >();

  // Pre-seed strictly with the 6 registered Sales names
  REGISTERED_QUARTERLY_SALES.forEach((sName) => {
    const masterCfg = SALES_MASTER_6_CONFIG[sName];
    salesMap.set(sName, {
      coverArea: masterCfg?.area || (sName === 'LUAR KOTA' ? 'ONLINE & LUAR KOTA RIAU' : 'AREA BARU'),
      region: sName === 'LUAR KOTA' ? 'LUAR KOTA' : 'PEKAN BARU',
      spvName: masterCfg?.spv || 'WIDODO',
      monthlySellInActual: [0, 0, 0],
      monthlySellOutActual: [0, 0, 0],
      monthlyAllActual: [0, 0, 0],
    });
  });

  scopedRecords.forEach((r) => {
    const canonicalSales = canonicalizeRegisteredSalesName(r.SALES);
    if (!canonicalSales || !salesMap.has(canonicalSales)) return;

    const dt = parseRecordMonthYear(r);
    if (!dt || dt.year !== year) return;
    const qMonthPosition = qMonths.indexOf(dt.monthIndex);
    if (qMonthPosition === -1) return;

    const item = salesMap.get(canonicalSales)!;
    const val = r.VALUE || 0;
    const ketType = classifyKet(r.KET);

    if (ketType === 'SELL IN') {
      item.monthlySellInActual[qMonthPosition] += val;
    } else if (ketType === 'SELL OUT') {
      item.monthlySellOutActual[qMonthPosition] += val;
    }
    if (activeKet === 'ALL' || (r.KET || '').toUpperCase().trim() === activeKet) {
      item.monthlyAllActual[qMonthPosition] += val;
    }
  });

  const salesList: SalesQuarterlySummaryItem[] = [];

  salesMap.forEach((sData, sName) => {
    const defaultMonthlySellIn =
      sName === 'ILHAMSYAH' ? 320000000 : sName === 'TIWI' ? 300000000 : sName === 'PARETO' ? 280000000 : DEFAULT_SALES_TARGET;
    const defaultMonthlySellOut =
      sName === 'TIWI' ? 140000000 : sName === 'PARETO' ? 160000000 : DEFAULT_SALES_SELLOUT_TARGET;

    const actualSellInOv = quarterlyActualSellInOverrides[buildQuarterlyTargetKey(year, quarter, 'sales', sName)];
    const { monthlySellIn: resolvedSellInMonths, isCustomActualSellIn } = resolveMonthlySellInActuals(
      sData.monthlySellInActual,
      actualSellInOv
    );

    const baseMonths = qMonths.map((mIdx, i) => {
      const mName = qMonthNames[i];
      const mSalesInMap = qSalesInMaps[i];
      const mSalesOutMap = qSalesOutMaps[i];
      const upperSales = sName.toUpperCase().trim();
      const matchedInKey = Object.keys(mSalesInMap).find((k) => k.toUpperCase().trim() === upperSales);
      const matchedOutKey = Object.keys(mSalesOutMap).find((k) => k.toUpperCase().trim() === upperSales);

      const mTargetSellIn = matchedInKey !== undefined ? mSalesInMap[matchedInKey] : defaultMonthlySellIn;
      const mTargetSellOut = matchedOutKey !== undefined ? mSalesOutMap[matchedOutKey] : defaultMonthlySellOut;
      const actSellIn = resolvedSellInMonths[i];
      const actSellInDelta = actSellIn - sData.monthlySellInActual[i];

      return {
        mIdx,
        mName,
        mTargetSellIn,
        mTargetSellOut,
        actSellIn,
        actSellOut: sData.monthlySellOutActual[i],
        actAll: Math.max(0, sData.monthlyAllActual[i] + actSellInDelta),
      };
    });

    const baseQuarterSellInTarget = baseMonths.reduce((sum, m) => sum + m.mTargetSellIn, 0);
    const baseQuarterSellOutTarget = baseMonths.reduce((sum, m) => sum + m.mTargetSellOut, 0);

    const ov = quarterlyOverrides[buildQuarterlyTargetKey(year, quarter, 'sales', sName)];
    const quarterTargetSellIn = ov?.targetSellIn !== undefined ? ov.targetSellIn : baseQuarterSellInTarget;
    const quarterTargetSellOut = ov?.targetSellOut !== undefined ? ov.targetSellOut : baseQuarterSellOutTarget;
    const isCustomQuarterTarget = ov?.targetSellIn !== undefined || ov?.targetSellOut !== undefined;

    const inRatio = baseQuarterSellInTarget > 0 ? quarterTargetSellIn / baseQuarterSellInTarget : 1;
    const outRatio = baseQuarterSellOutTarget > 0 ? quarterTargetSellOut / baseQuarterSellOutTarget : 1;

    const monthlyBreakdown: QuarterlyMonthDetail[] = baseMonths.map((m) => {
      const targetIn = ov?.targetSellIn !== undefined ? Math.round(m.mTargetSellIn * inRatio) : m.mTargetSellIn;
      const targetOut = ov?.targetSellOut !== undefined ? Math.round(m.mTargetSellOut * outRatio) : m.mTargetSellOut;

      const activeMonthTarget =
        activeKet === 'SELL OUT' ? targetOut : targetIn;
      const activeMonthActual =
        activeKet === 'SELL IN'
          ? m.actSellIn
          : activeKet === 'SELL OUT'
          ? m.actSellOut
          : m.actAll;

      const pct = activeMonthTarget > 0 ? (activeMonthActual / activeMonthTarget) * 100 : 0;

      const matchedKpi = kpiSalesAll.find(
        (k) =>
          k.salesName.toLowerCase() === sName.toLowerCase() &&
          k.monthPeriod?.toUpperCase().includes(m.mName)
      );
      const kpiScore = matchedKpi
        ? matchedKpi.totalScore ?? (matchedKpi as unknown as { totalPoinKpi?: number }).totalPoinKpi ?? 0
        : Math.min(100, Math.round(pct * 0.95));

      return {
        monthName: m.mName,
        monthIndex: m.mIdx,
        targetSellIn: targetIn,
        targetSellOut: targetOut,
        actualSellIn: m.actSellIn,
        actualSellOut: m.actSellOut,
        target: activeMonthTarget,
        actual: activeMonthActual,
        achievementPercent: pct,
        kpiScore,
      };
    });

    const quarterActualSellIn = resolvedSellInMonths.reduce((sum, v) => sum + v, 0);
    const quarterActualSellOut = sData.monthlySellOutActual.reduce((sum, v) => sum + v, 0);
    const quarterActualAll = baseMonths.reduce((sum, m) => sum + m.actAll, 0);

    const quarterTarget = activeKet === 'SELL OUT' ? quarterTargetSellOut : quarterTargetSellIn;
    const quarterActual =
      activeKet === 'SELL IN'
        ? quarterActualSellIn
        : activeKet === 'SELL OUT'
        ? quarterActualSellOut
        : quarterActualAll;

    const quarterAchievementSellInPercent =
      quarterTargetSellIn > 0 ? (quarterActualSellIn / quarterTargetSellIn) * 100 : 0;
    const quarterAchievementSellOutPercent =
      quarterTargetSellOut > 0 ? (quarterActualSellOut / quarterTargetSellOut) * 100 : 0;
    const quarterAchievementPercent = quarterTarget > 0 ? (quarterActual / quarterTarget) * 100 : 0;

    const avgKpiScore = Math.round(
      monthlyBreakdown.reduce((sum, m) => sum + (m.kpiScore || 0), 0) / monthlyBreakdown.length
    );

    let kpiGrade: 'Grade A' | 'Grade B' | 'Grade C' | 'Grade D' = 'Grade B';
    if (avgKpiScore >= 90) kpiGrade = 'Grade A';
    else if (avgKpiScore >= 80) kpiGrade = 'Grade B';
    else if (avgKpiScore >= 70) kpiGrade = 'Grade C';
    else kpiGrade = 'Grade D';

    let commRate = 0.005;
    if (quarterAchievementPercent >= 110) commRate = 0.015;
    else if (quarterAchievementPercent >= 100) commRate = 0.01;
    else if (quarterAchievementPercent >= 85) commRate = 0.007;
    const totalCommission = Math.round(Math.max(0, quarterActual) * commRate);

    let statusBadge: 'Melampaui Target' | 'Mencapai Target' | 'Perlu Ditingkatkan' = 'Mencapai Target';
    if (quarterAchievementPercent >= 100) statusBadge = 'Melampaui Target';
    else if (quarterAchievementPercent >= 85) statusBadge = 'Mencapai Target';
    else statusBadge = 'Perlu Ditingkatkan';

    salesList.push({
      salesName: sName,
      coverArea: sData.coverArea,
      region: sData.region,
      spvName: sData.spvName,
      quarterTarget,
      quarterTargetSellIn,
      quarterTargetSellOut,
      quarterActual,
      quarterActualSellIn,
      quarterActualSellOut,
      quarterAchievementPercent,
      quarterAchievementSellInPercent,
      quarterAchievementSellOutPercent,
      isCustomQuarterTarget,
      isCustomActualSellIn,
      avgKpiScore,
      kpiGrade,
      totalCommission,
      statusBadge,
      monthlyBreakdown,
    });
  });

  salesList.sort((a, b) => {
    const pctDiff = b.quarterAchievementPercent - a.quarterAchievementPercent;
    if (Math.abs(pctDiff) > 0.0001) return pctDiff;
    return b.quarterActual - a.quarterActual;
  });

  // -------------------------------------------------------------
  // 2. BEAUTY ADVISOR (BA) QUARTERLY SUMMARY
  // -------------------------------------------------------------
  const isPlaceholderBaToken = (raw?: string): boolean => {
    const upper = (raw || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!upper) return true;
    return (
      upper === '-' ||
      upper === 'ALL' ||
      upper === 'NON BA' ||
      upper === 'NON-BA' ||
      upper === 'NONBA' ||
      upper === 'TANPA BA' ||
      upper === '- (NON-BA)' ||
      upper === '- (TANPA BA)' ||
      upper === 'STANDBY' ||
      upper === 'BA STANDBY' ||
      upper === 'BA COUNTER' ||
      upper === 'KOSONG' ||
      upper === 'VACANT' ||
      upper === 'NO BA' ||
      upper === 'BELUM ADA BA' ||
      upper === 'EMPTY' ||
      upper === 'NULL' ||
      upper === 'UNDEFINED' ||
      upper === 'N/A'
    );
  };

  const normalizeBaKey = (raw?: string): string =>
    (raw || '').trim().replace(/\s+/g, ' ').toUpperCase();

  const normalizeStoreDisplay = (raw?: string): string =>
    (raw || '').trim().replace(/\s+/g, ' ');

  const customBaProfiles = loadCustomBaProfiles();
  const customProfileByStoreUpper = new Map<string, CustomBaProfile>();
  const customProfileByBaUpper = new Map<string, CustomBaProfile>();
  Object.values(customBaProfiles).forEach((p) => {
    if (p.originalStoreName) {
      customProfileByStoreUpper.set(p.originalStoreName.trim().toUpperCase(), p);
    }
    if (p.storeName) {
      p.storeName.split(',').forEach((part) => {
        const s = part.trim().toUpperCase();
        if (s) customProfileByStoreUpper.set(s, p);
      });
    }
    const baUp = normalizeBaKey(p.baName);
    if (!isPlaceholderBaToken(baUp)) {
      customProfileByBaUpper.set(baUp, p);
    }
  });

  const resolveBaAndStoreFromRecord = (r: TransactionRecord) => {
    const rawStore = normalizeStoreDisplay(r.NAMA_STORE);
    const storeProfileMatch = rawStore ? customProfileByStoreUpper.get(rawStore.toUpperCase()) : undefined;
    const baProfileMatch = !storeProfileMatch
      ? customProfileByBaUpper.get(normalizeBaKey(r.BA))
      : undefined;

    const resolvedStoreRaw =
      storeProfileMatch &&
      storeProfileMatch.originalStoreName &&
      storeProfileMatch.originalStoreName.trim().toUpperCase() === rawStore.toUpperCase()
        ? normalizeStoreDisplay(storeProfileMatch.storeName)
        : rawStore;

    const resolvedBaRaw = storeProfileMatch
      ? storeProfileMatch.baName
      : baProfileMatch
      ? baProfileMatch.baName
      : (customBaProfiles[resolvedStoreRaw]?.baName || r.BA || '');

    return {
      resolvedBaName: (resolvedBaRaw || '').trim().replace(/\s+/g, ' '),
      resolvedStore: resolvedStoreRaw,
      resolvedBaNumber: storeProfileMatch?.baNumber || baProfileMatch?.baNumber || r.BA_Number,
      resolvedArea:
        (storeProfileMatch?.coverArea && storeProfileMatch.coverArea !== '-' ? storeProfileMatch.coverArea : '') ||
        (r.COVER_AREA && r.COVER_AREA !== '-' ? r.COVER_AREA : 'AREA BARU'),
      resolvedRegion:
        (storeProfileMatch?.region && storeProfileMatch.region !== '-' ? storeProfileMatch.region : '') ||
        (r.REGION && r.REGION !== '-' ? r.REGION : 'PEKAN BARU'),
      resolvedSpv:
        (storeProfileMatch?.spv && storeProfileMatch.spv !== '-' ? storeProfileMatch.spv : '') ||
        (r.SPV && r.SPV !== '-' ? r.SPV : 'WIDODO'),
    };
  };

  const baMap = new Map<
    string,
    {
      baNumber: string;
      storeName: string;
      quarterStoreNames: Set<string>;
      allYearStoreNames: Set<string>;
      monthlySellOutStores: [Set<string>, Set<string>, Set<string>];
      monthlyAnyRowStores: [Set<string>, Set<string>, Set<string>];
      preQuarterStores: { monthIdx: number; store: string }[];
      coverArea: string;
      region: string;
      spvName: string;
      monthlySellInActual: number[];
      monthlySellOutActual: number[];
      monthlySellOutNonLavojoyActual: number[];
      monthlySellOutLavojoyActual: number[];
      monthlyAllActual: number[];
      monthlyFocusActual: number[];
    }
  >();
  const baKeyByUpper = new Map<string, string>();

  // Pass 1: Kumpulkan seluruh BA terdaftar & relasi Nama Toko per bulan dari Google Sheet + Custom Profile
  scopedRecords.forEach((r) => {
    const resolved = resolveBaAndStoreFromRecord(r);
    const bName = resolved.resolvedBaName;
    if (isPlaceholderBaToken(bName)) return;

    const bUpper = normalizeBaKey(bName);
    let canonicalKey = baKeyByUpper.get(bUpper);
    if (!canonicalKey) {
      canonicalKey = bName;
      baKeyByUpper.set(bUpper, canonicalKey);
    }

    const recStore = resolved.resolvedStore;
    const validRecStore =
      recStore && recStore !== '-' && recStore.toUpperCase() !== 'ALL' ? recStore : '';

    if (!baMap.has(canonicalKey)) {
      baMap.set(canonicalKey, {
        baNumber: resolved.resolvedBaNumber || `BA-${baMap.size + 101}`,
        storeName: validRecStore || 'Counter Toko',
        quarterStoreNames: new Set(),
        allYearStoreNames: new Set(),
        monthlySellOutStores: [new Set(), new Set(), new Set()],
        monthlyAnyRowStores: [new Set(), new Set(), new Set()],
        preQuarterStores: [],
        coverArea: resolved.resolvedArea,
        region: resolved.resolvedRegion,
        spvName: resolved.resolvedSpv,
        monthlySellInActual: [0, 0, 0],
        monthlySellOutActual: [0, 0, 0],
        monthlySellOutNonLavojoyActual: [0, 0, 0],
        monthlySellOutLavojoyActual: [0, 0, 0],
        monthlyAllActual: [0, 0, 0],
        monthlyFocusActual: [0, 0, 0],
      });
    }

    const entry = baMap.get(canonicalKey)!;
    if (validRecStore) {
      const dt = parseRecordMonthYear(r);
      const ketRawUpper = (r.KET || '').toUpperCase().trim();
      const ketType = classifyKet(r.KET);
      const isSellOutLike = ketType === 'SELL OUT' || (ketType === 'OTHER' && !ketRawUpper);
      const existingAllUpper = new Set(Array.from(entry.allYearStoreNames).map((s) => s.toUpperCase()));
      if (!existingAllUpper.has(validRecStore.toUpperCase())) {
        entry.allYearStoreNames.add(validRecStore);
      }
      if (!entry.storeName || entry.storeName === 'Counter Toko') {
        entry.storeName = validRecStore;
      }

      if (isSellOutLike) {
        const cutOffPos = resolveBaCutOffQuarterPos(r, qMonths, year);
        if (cutOffPos !== -1) {
          const existingQUpper = new Set(Array.from(entry.quarterStoreNames).map((s) => s.toUpperCase()));
          if (!existingQUpper.has(validRecStore.toUpperCase())) {
            entry.quarterStoreNames.add(validRecStore);
          }
          entry.monthlyAnyRowStores[cutOffPos].add(validRecStore);
          entry.monthlySellOutStores[cutOffPos].add(validRecStore);
        } else if (dt && dt.year === year && dt.monthIndex < qMonths[0]) {
          entry.preQuarterStores.push({ monthIdx: dt.monthIndex, store: validRecStore });
        }
      } else if (dt && dt.year === year) {
        const qPos = qMonths.indexOf(dt.monthIndex);
        if (qPos !== -1) {
          const existingQUpper = new Set(Array.from(entry.quarterStoreNames).map((s) => s.toUpperCase()));
          if (!existingQUpper.has(validRecStore.toUpperCase())) {
            entry.quarterStoreNames.add(validRecStore);
          }
          entry.monthlyAnyRowStores[qPos].add(validRecStore);
        } else if (dt.monthIndex < qMonths[0]) {
          entry.preQuarterStores.push({ monthIdx: dt.monthIndex, store: validRecStore });
        }
      }
    }

    if ((!entry.coverArea || entry.coverArea === 'AREA BARU') && resolved.resolvedArea !== 'AREA BARU') {
      entry.coverArea = resolved.resolvedArea;
    }
    if ((!entry.region || entry.region === 'PEKAN BARU') && resolved.resolvedRegion !== 'PEKAN BARU') {
      entry.region = resolved.resolvedRegion;
    }
    if ((!entry.spvName || entry.spvName === 'WIDODO') && resolved.resolvedSpv !== 'WIDODO') {
      entry.spvName = resolved.resolvedSpv;
    }
  });

  // Gabungkan BA baru atau profil kustom dari Daftar Target Beauty Advisor (Kelola Target)
  Object.values(customBaProfiles).forEach((profile) => {
    const pBaKey = normalizeBaKey(profile.baName);
    if (isPlaceholderBaToken(pBaKey)) return;
    if (
      filterArea !== 'ALL' &&
      (profile.coverArea || '').toUpperCase() !== filterArea.toUpperCase() &&
      (profile.region || '').toUpperCase() !== filterArea.toUpperCase()
    ) {
      return;
    }
    if (filterSpv !== 'ALL' && (profile.spv || '').toUpperCase() !== filterSpv.toUpperCase()) {
      return;
    }

    const storeTokens = (profile.storeName || '')
      .split(',')
      .map((s) => normalizeStoreDisplay(s))
      .filter((s) => s && s !== '-');

    let canonicalKey = baKeyByUpper.get(pBaKey);
    if (!canonicalKey) {
      canonicalKey = profile.baName.trim().replace(/\s+/g, ' ');
      baKeyByUpper.set(pBaKey, canonicalKey);
      baMap.set(canonicalKey, {
        baNumber: profile.baNumber || `BA-${baMap.size + 101}`,
        storeName: storeTokens.join(', ') || 'Counter Toko',
        quarterStoreNames: new Set(storeTokens),
        allYearStoreNames: new Set(storeTokens),
        monthlySellOutStores: [new Set(), new Set(), new Set()],
        monthlyAnyRowStores: [new Set(), new Set(), new Set()],
        preQuarterStores: [],
        coverArea: profile.coverArea || 'PEKANBARU',
        region: profile.region || 'PEKAN BARU',
        spvName: profile.spv || 'WIDODO',
        monthlySellInActual: [0, 0, 0],
        monthlySellOutActual: [0, 0, 0],
        monthlySellOutNonLavojoyActual: [0, 0, 0],
        monthlySellOutLavojoyActual: [0, 0, 0],
        monthlyAllActual: [0, 0, 0],
        monthlyFocusActual: [0, 0, 0],
      });
    } else {
      const existing = baMap.get(canonicalKey)!;
      storeTokens.forEach((st) => {
        const up = st.toUpperCase();
        if (!Array.from(existing.allYearStoreNames).some((x) => x.toUpperCase() === up)) {
          existing.allYearStoreNames.add(st);
        }
        if (
          existing.quarterStoreNames.size > 0 &&
          !Array.from(existing.quarterStoreNames).some((x) => x.toUpperCase() === up)
        ) {
          existing.quarterStoreNames.add(st);
        }
      });
    }
  });

  const templateBAs = [
    { name: 'FITRI HANDAYANI', store: 'RIS IDOLA', target: 35000000 },
    { name: 'SITI RAHMAWATI', store: 'TOKO SEJATI', target: 35000000 },
    { name: 'YOLANDA OKTAVIA', store: 'MISS GLAM TEMBILAHAN', target: 35000000 },
    { name: 'DEWI LESTARI', store: 'IDOLA AIR MOLEK', target: 35000000 },
    { name: 'RINA ANGGRAINI', store: 'MY KOSMETIK (PKL KERINCI)', target: 35000000 },
    { name: 'CUT AMELIA', store: 'TG TENAGA BARU', target: 35000000 },
    { name: 'LILI LESTARI', store: 'HIDAYAH BEAUTY PERAWANG', target: 35000000 },
    { name: 'ANISA PUTRI', store: 'HIDAYAH BEAUTY KERINCI', target: 35000000 },
    { name: 'DWI WULANDARI', store: 'MY KOSMETIK SOREK', target: 35000000 },
    { name: 'NURUL AINI', store: 'TOKO JINAAN STORE', target: 35000000 },
    { name: 'WINDY PRATIWI', store: 'CITRA SWALAYAN', target: 35000000 },
  ];

  // Hanya gunakan template BA bawaan jika tidak ada BA dari Google Sheet maupun Kelola Target
  if (baMap.size === 0) {
    templateBAs.forEach((tb, idx) => {
      const tbUpper = normalizeBaKey(tb.name);
      if (!baKeyByUpper.has(tbUpper)) {
        baKeyByUpper.set(tbUpper, tb.name);
        baMap.set(tb.name, {
          baNumber: `BA-0${idx + 1}`,
          storeName: tb.store,
          quarterStoreNames: new Set([tb.store]),
          allYearStoreNames: new Set([tb.store]),
          monthlySellOutStores: [new Set([tb.store]), new Set([tb.store]), new Set([tb.store])],
          monthlyAnyRowStores: [new Set([tb.store]), new Set([tb.store]), new Set([tb.store])],
          preQuarterStores: [],
          coverArea: 'INDRAGIRI',
          region: 'PEKAN BARU',
          spvName: 'WIDODO',
          monthlySellInActual: [0, 0, 0],
          monthlySellOutActual: [0, 0, 0],
          monthlySellOutNonLavojoyActual: [0, 0, 0],
          monthlySellOutLavojoyActual: [0, 0, 0],
          monthlyAllActual: [0, 0, 0],
          monthlyFocusActual: [0, 0, 0],
        });
      }
    });
  }

  // Lengkapi nama toko hanya jika BA di Google Sheet belum memiliki toko sama sekali
  const weeklyStores = resolveWeeklyBaStores(records);
  weeklyStores.forEach((ws) => {
    if (isPlaceholderBaToken(ws.baName) || !ws.storeName) return;
    const key = baKeyByUpper.get(normalizeBaKey(ws.baName));
    if (key) {
      const entry = baMap.get(key)!;
      if (entry.allYearStoreNames.size === 0) {
        const cleanSt = normalizeStoreDisplay(ws.storeName);
        if (cleanSt) {
          entry.allYearStoreNames.add(cleanSt);
          if (!entry.storeName || entry.storeName === 'Counter Toko') {
            entry.storeName = cleanSt;
          }
        }
      }
    }
  });

  const masterStores = loadMasterStoreList(records);
  masterStores.forEach((ms) => {
    if (!ms.hasBa || isPlaceholderBaToken(ms.baName) || !ms.storeName) return;
    const key = baKeyByUpper.get(normalizeBaKey(ms.baName));
    if (key) {
      const entry = baMap.get(key)!;
      if (entry.allYearStoreNames.size === 0) {
        const cleanSt = normalizeStoreDisplay(ms.storeName);
        if (cleanSt) {
          entry.allYearStoreNames.add(cleanSt);
          if (!entry.storeName || entry.storeName === 'Counter Toko') {
            entry.storeName = cleanSt;
          }
        }
      }
    }
  });

  // Bangun indeks Nama Toko -> Daftar BA PER BULAN dalam kuartal (mPos: 0, 1, 2)
  // agar BA yang pindah toko setiap bulan hanya menarik Realisasi Sell In sesuai toko pada bulan tersebut
  const normStoreExact = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  const normStoreNoPrefix = (s: string) =>
    normalizeStoreAlnum(s.replace(/^\s*(TOKO|TK)\b\.?\s*/i, ''));
  const normStoreKosmetik = (s: string) =>
    normStoreNoPrefix(s).replace(/cosmetic/g, 'kosmetik').replace(/cosmetik/g, 'kosmetik');

  interface MonthlyStoreIndex {
    exactToBas: Map<string, Set<string>>;
    alnumToBas: Map<string, Set<string>>;
    noPrefixToBas: Map<string, Set<string>>;
    kosmetikToBas: Map<string, Set<string>>;
  }

  const createMonthlyStoreIndex = (): MonthlyStoreIndex => ({
    exactToBas: new Map<string, Set<string>>(),
    alnumToBas: new Map<string, Set<string>>(),
    noPrefixToBas: new Map<string, Set<string>>(),
    kosmetikToBas: new Map<string, Set<string>>(),
  });

  const baAssignedStoresByMonth: [
    Map<string, Set<string>>,
    Map<string, Set<string>>,
    Map<string, Set<string>>,
  ] = [new Map(), new Map(), new Map()];

  const registerStoreToMonthlyIndex = (
    idxObj: MonthlyStoreIndex,
    stName: string,
    baKey: string,
    mPos: number
  ) => {
    if (!stName || stName === 'Counter Toko' || stName === '-') return;
    if (!baAssignedStoresByMonth[mPos].has(baKey)) {
      baAssignedStoresByMonth[mPos].set(baKey, new Set());
    }
    baAssignedStoresByMonth[mPos].get(baKey)!.add(stName);

    const addKey = (map: Map<string, Set<string>>, k: string) => {
      if (!k) return;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(baKey);
    };
    addKey(idxObj.exactToBas, normStoreExact(stName));
    addKey(idxObj.alnumToBas, normalizeStoreAlnum(stName));
    addKey(idxObj.noPrefixToBas, normStoreNoPrefix(stName));
    addKey(idxObj.kosmetikToBas, normStoreKosmetik(stName));
  };

  const monthlyStoreIndexes: [MonthlyStoreIndex, MonthlyStoreIndex, MonthlyStoreIndex] = [0, 1, 2].map(
    (mPos) => {
      const idxObj = createMonthlyStoreIndex();
      const explicitClaimedKeys = new Set<string>();

      const markClaimed = (stName: string) => {
        const k1 = normStoreExact(stName);
        const k2 = normalizeStoreAlnum(stName);
        const k3 = normStoreKosmetik(stName);
        if (k1) explicitClaimedKeys.add(k1);
        if (k2) explicitClaimedKeys.add(k2);
        if (k3) explicitClaimedKeys.add(k3);
      };

      const isClaimedExplicitly = (stName: string): boolean => {
        const k1 = normStoreExact(stName);
        const k2 = normalizeStoreAlnum(stName);
        const k3 = normStoreKosmetik(stName);
        return (
          (Boolean(k1) && explicitClaimedKeys.has(k1)) ||
          (Boolean(k2) && explicitClaimedKeys.has(k2)) ||
          (Boolean(k3) && explicitClaimedKeys.has(k3))
        );
      };

      // Tahap 1: BA yang memiliki transaksi/absensi eksplisit di bulan mPos
      const basNeedingFallback: string[] = [];
      baMap.forEach((bData, baKey) => {
        if (isPlaceholderBaToken(baKey)) return;
        const explicitStores =
          bData.monthlySellOutStores[mPos].size > 0
            ? bData.monthlySellOutStores[mPos]
            : bData.monthlyAnyRowStores[mPos];
        if (explicitStores.size > 0) {
          explicitStores.forEach((stName) => {
            registerStoreToMonthlyIndex(idxObj, stName, baKey, mPos);
            markClaimed(stName);
          });
        } else {
          basNeedingFallback.push(baKey);
        }
      });

      // Tahap 2: Fallback toko terakhir/berikutnya hanya jika toko tersebut belum diklaim BA lain di bulan mPos
      basNeedingFallback.forEach((baKey) => {
        const bData = baMap.get(baKey)!;
        let fallbackStores: string[] = [];

        // Cek bulan sebelumnya di kuartal yang sama (mPos - 1 -> 0)
        for (let prev = mPos - 1; prev >= 0; prev--) {
          const prevSet =
            bData.monthlySellOutStores[prev].size > 0
              ? bData.monthlySellOutStores[prev]
              : bData.monthlyAnyRowStores[prev];
          if (prevSet.size > 0) {
            fallbackStores = Array.from(prevSet);
            break;
          }
        }

        // Jika bulan pertama kuartal belum punya data, cek bulan sebelum kuartal pada tahun yang sama
        if (fallbackStores.length === 0 && bData.preQuarterStores.length > 0) {
          const sortedPre = [...bData.preQuarterStores].sort((a, b) => b.monthIdx - a.monthIdx);
          const latestMonthIdx = sortedPre[0].monthIdx;
          fallbackStores = sortedPre
            .filter((p) => p.monthIdx === latestMonthIdx)
            .map((p) => p.store);
        }

        // Cek bulan berikutnya di kuartal yang sama jika memang baru muncul
        if (fallbackStores.length === 0) {
          for (let next = mPos + 1; next <= 2; next++) {
            const nextSet =
              bData.monthlySellOutStores[next].size > 0
                ? bData.monthlySellOutStores[next]
                : bData.monthlyAnyRowStores[next];
            if (nextSet.size > 0) {
              fallbackStores = Array.from(nextSet);
              break;
            }
          }
        }

        // Fallback terakhir dari daftar toko BA
        if (fallbackStores.length === 0 && bData.allYearStoreNames.size > 0) {
          fallbackStores = [Array.from(bData.allYearStoreNames)[0]];
        }

        fallbackStores.forEach((stName) => {
          if (!isClaimedExplicitly(stName)) {
            registerStoreToMonthlyIndex(idxObj, stName, baKey, mPos);
          }
        });
      });

      return idxObj;
    }
  ) as [MonthlyStoreIndex, MonthlyStoreIndex, MonthlyStoreIndex];

  const findBasByStoreNameInMonth = (mPos: number, rawStore?: string): string[] => {
    const clean = (rawStore || '').trim();
    if (!clean || clean === '-' || clean.toUpperCase() === 'ALL') return [];
    const idxObj = monthlyStoreIndexes[mPos];
    if (!idxObj) return [];
    const exactHit = idxObj.exactToBas.get(normStoreExact(clean));
    if (exactHit && exactHit.size > 0) return Array.from(exactHit);
    const alnumHit = idxObj.alnumToBas.get(normalizeStoreAlnum(clean));
    if (alnumHit && alnumHit.size > 0) return Array.from(alnumHit);
    const noPrefixHit = idxObj.noPrefixToBas.get(normStoreNoPrefix(clean));
    if (noPrefixHit && noPrefixHit.size > 0) return Array.from(noPrefixHit);
    const kosmetikHit = idxObj.kosmetikToBas.get(normStoreKosmetik(clean));
    if (kosmetikHit && kosmetikHit.size > 0) return Array.from(kosmetikHit);
    return [];
  };

  // Pass 2: Akumulasi Realisasi Kuartal mengikuti Daftar Target Beauty Advisor & Google Sheet terhubung:
  // - SELL IN ditarik berdasarkan NAMA TOKO pada bulan kalender transaksi tersebut
  // - SELL OUT BA (Non-Lavojoy & Lavojoy) & Produk Fokus (Pcs) mengikuti Cut-off Sell Out BA (26–25)
  scopedRecords.forEach((r) => {
    const val = r.VALUE || 0;
    const qty = Math.max(0, r.QTY || 0);
    const ketRawUpper = (r.KET || '').toUpperCase().trim();
    const ketType = classifyKet(r.KET);
    const isReturn = ketRawUpper.includes('RETURN') || ketRawUpper.includes('RETUR');
    const isSellOutRow = !isReturn && (ketType === 'SELL OUT' || !ketRawUpper);
    const resolved = resolveBaAndStoreFromRecord(r);
    const bNameNorm = normalizeBaKey(resolved.resolvedBaName);
    const matchedBaFromRow =
      bNameNorm && !isPlaceholderBaToken(bNameNorm)
        ? baKeyByUpper.get(bNameNorm)
        : undefined;

    if (ketType === 'SELL IN') {
      const dt = parseRecordMonthYear(r);
      if (!dt || dt.year !== year) return;
      const qMonthPosition = qMonths.indexOf(dt.monthIndex);
      if (qMonthPosition === -1) return;

      const storeMatchedBas = findBasByStoreNameInMonth(
        qMonthPosition,
        resolved.resolvedStore || r.NAMA_STORE
      );
      let targetBas: string[] = [];

      if (storeMatchedBas.length > 0) {
        if (matchedBaFromRow && storeMatchedBas.includes(matchedBaFromRow)) {
          targetBas = [matchedBaFromRow];
        } else {
          targetBas = storeMatchedBas;
        }
      } else if (matchedBaFromRow) {
        targetBas = [matchedBaFromRow];
      }

      targetBas.forEach((targetBaKey) => {
        const item = baMap.get(targetBaKey);
        if (!item) return;
        item.monthlySellInActual[qMonthPosition] += val;
        if (activeKet === 'ALL' || activeKet === 'SELL IN') {
          item.monthlyAllActual[qMonthPosition] += val;
        }
      });

      // Produk Fokus Pcs: hitung baris dengan Nama BA terdaftar agar sama persis dengan Daftar Target BA
      if (matchedBaFromRow && isFocusProduct(r.PRODUK_FOCUS || r)) {
        const baItem = baMap.get(matchedBaFromRow);
        if (baItem) {
          baItem.monthlyFocusActual[qMonthPosition] += qty;
        }
      }
      return;
    }

    const cutOffPos = resolveBaCutOffQuarterPos(r, qMonths, year);
    if (cutOffPos === -1) return;

    if (!matchedBaFromRow) return;
    const item = baMap.get(matchedBaFromRow);
    if (!item) return;

    if (isSellOutRow) {
      item.monthlySellOutActual[cutOffPos] += val;
      const isLavojoyBrand = (r.BRAND || '').toLowerCase().includes('lavojoy');
      if (isLavojoyBrand) {
        item.monthlySellOutLavojoyActual[cutOffPos] += val;
      } else {
        item.monthlySellOutNonLavojoyActual[cutOffPos] += val;
      }
    }
    if (activeKet === 'ALL' || (isSellOutRow && activeKet === 'SELL OUT') || ketType === activeKet) {
      item.monthlyAllActual[cutOffPos] += val;
    }
    if (isSellOutRow && isFocusProduct(r.PRODUK_FOCUS || r)) {
      item.monthlyFocusActual[cutOffPos] += qty;
    }
  });

  const focusOverridesAll = loadFocusOverrides();
  // Tarik Target Sell In Toko otomatis & override dari Kelola Target (menggunakan semua records agar % kontribusi toko akurat)
  const storeSellInLookupByMonth = computeMonthlyStoreSellInLookup(records, qMonthNames, year);
  const baListRaw: Omit<BaQuarterlySummaryItem, 'rank'>[] = [];

  baMap.forEach((bData, bName) => {
    // Gabungkan semua nama toko berbeda untuk BA yang sama (prioritaskan toko di kuartal aktif)
    const displayStoresSource =
      bData.quarterStoreNames.size > 0 ? bData.quarterStoreNames : bData.allYearStoreNames;
    const mergedStoresList = Array.from(displayStoresSource).filter(
      (s) => s && s !== 'Counter Toko' && s !== '-'
    );
    const mergedStoreName =
      mergedStoresList.length > 0
        ? mergedStoresList.join(', ')
        : bData.storeName || 'Counter Toko';

    const actualSellInOv = quarterlyActualSellInOverrides[buildQuarterlyTargetKey(year, quarter, 'ba', bName)];
    const { monthlySellIn: resolvedSellInMonths, isCustomActualSellIn } = resolveMonthlySellInActuals(
      bData.monthlySellInActual,
      actualSellInOv
    );

    const upperBa = normalizeBaKey(bName);
    const upperMergedStore = mergedStoreName.toUpperCase().trim();
    const upperStoreTokens = mergedStoresList.map((s) => s.toUpperCase().trim());

    const findTargetMapEntry = <T,>(mapObj: Record<string, T>): T | undefined => {
      const keys = Object.keys(mapObj);
      const byBa = keys.find((k) => normalizeBaKey(k) === upperBa);
      if (byBa !== undefined) return mapObj[byBa];
      const byMerged = keys.find((k) => k.toUpperCase().trim() === upperMergedStore);
      if (byMerged !== undefined) return mapObj[byMerged];
      const byToken = keys.find((k) => upperStoreTokens.includes(k.toUpperCase().trim()));
      return byToken !== undefined ? mapObj[byToken] : undefined;
    };

    const focusGlobalOv = findTargetMapEntry(focusOverridesAll) || {};

    const baseMonths = qMonths.map((mIdx, i) => {
      const mName = qMonthNames[i];
      const baNonMap = qBaNonMaps[i];
      const baLavMap = qBaLavMaps[i];
      const baFocusMap = qBaFocusMaps[i];

      // Mengikuti persis Daftar Target Beauty Advisor (Non-Lavojoy + Lavojoy & Produk Fokus Pcs)
      const customNonLav = findTargetMapEntry(baNonMap);
      const customLav = findTargetMapEntry(baLavMap);
      const customFocus = findTargetMapEntry(baFocusMap);

      const mTargetNonLav =
        customNonLav !== undefined ? customNonLav : DEFAULT_BA_NON_LAVOJOY_TARGET;
      const mTargetLav =
        customLav !== undefined ? customLav : DEFAULT_BA_LAVOJOY_TARGET;
      const monthBaSellOutTarget = mTargetNonLav + mTargetLav;

      // Sinkronkan Target Sell In BA dengan Target Sell In Toko di Kelola Target pada bulan mName
      const rawAssigned = Array.from(baAssignedStoresByMonth[i].get(bName) || []);
      const candidateStores = rawAssigned.length > 0 ? rawAssigned : mergedStoresList;
      const seenStoreNorms = new Set<string>();
      const uniqueAssignedStores: string[] = [];
      candidateStores.forEach((st) => {
        const normSt = normalizeStoreAlnum(st) || st.toUpperCase().trim();
        if (!normSt || seenStoreNorms.has(normSt)) return;
        seenStoreNorms.add(normSt);
        uniqueAssignedStores.push(st);
      });

      const monthStoreLookup = storeSellInLookupByMonth[mName];
      let monthBaSellInTarget = Math.round(monthBaSellOutTarget * 1.1);
      if (monthStoreLookup && monthStoreLookup.byExact.size > 0) {
        const seenResolvedStoreKeys = new Set<string>();
        let storeTargetSum = 0;
        uniqueAssignedStores.forEach((stName) => {
          const matchedStore = findStoreSellInInLookup(monthStoreLookup, stName);
          if (!matchedStore) return;
          const resolvedNormKey =
            normalizeStoreAlnum(matchedStore.storeName) || matchedStore.storeName.toUpperCase().trim();
          if (seenResolvedStoreKeys.has(resolvedNormKey)) return;
          seenResolvedStoreKeys.add(resolvedNormKey);

          const sharingBas = findBasByStoreNameInMonth(i, matchedStore.storeName);
          const baShareCount = Math.max(
            1,
            sharingBas.length > 0 ? sharingBas.length : findBasByStoreNameInMonth(i, stName).length
          );
          storeTargetSum += matchedStore.targetSellIn / baShareCount;
        });
        monthBaSellInTarget = Math.round(storeTargetSum);
      }

      const monthFocusTarget =
        customFocus !== undefined && customFocus > 0
          ? customFocus
          : focusGlobalOv.targetPcs !== undefined && focusGlobalOv.targetPcs > 0
          ? focusGlobalOv.targetPcs
          : DEFAULT_FOCUS_TARGET_PCS;

      const rawNon = bData.monthlySellOutNonLavojoyActual[i];
      const rawLav = bData.monthlySellOutLavojoyActual[i];
      // Jika Target Lavojoy diset 0 di Daftar Target BA, seluruh Sell Out (Non-Lav + Lav) masuk ke utama
      const actNonLav = mTargetLav === 0 ? rawNon + rawLav : rawNon;
      const actLav = mTargetLav === 0 ? 0 : rawLav;
      const actSellOutTotal = actNonLav + actLav;

      const actSellIn = resolvedSellInMonths[i];
      const actSellInDelta = actSellIn - bData.monthlySellInActual[i];

      return {
        mIdx,
        mName,
        mTargetNonLav,
        mTargetLav,
        monthBaSellInTarget,
        monthBaSellOutTarget,
        monthFocusTarget,
        actSellIn,
        actNonLav,
        actLav,
        actSellOut: actSellOutTotal,
        actAll: Math.max(0, bData.monthlyAllActual[i] + actSellInDelta),
        focusAct: bData.monthlyFocusActual[i],
        assignedStores: uniqueAssignedStores,
      };
    });

    const baseQuarterSellInTarget = baseMonths.reduce((sum, m) => sum + m.monthBaSellInTarget, 0);
    const baseQuarterSellOutTarget = baseMonths.reduce((sum, m) => sum + m.monthBaSellOutTarget, 0);
    const quarterTargetNonLavojoy = baseMonths.reduce((sum, m) => sum + m.mTargetNonLav, 0);
    const quarterTargetLavojoy = baseMonths.reduce((sum, m) => sum + m.mTargetLav, 0);

    const ov = quarterlyOverrides[buildQuarterlyTargetKey(year, quarter, 'ba', bName)];
    const quarterTargetSellIn = ov?.targetSellIn !== undefined ? ov.targetSellIn : baseQuarterSellInTarget;
    const quarterTargetSellOut = ov?.targetSellOut !== undefined ? ov.targetSellOut : baseQuarterSellOutTarget;
    const isCustomQuarterTarget = ov?.targetSellIn !== undefined || ov?.targetSellOut !== undefined;

    const inRatio = baseQuarterSellInTarget > 0 ? quarterTargetSellIn / baseQuarterSellInTarget : 1;
    const outRatio = baseQuarterSellOutTarget > 0 ? quarterTargetSellOut / baseQuarterSellOutTarget : 1;

    const monthlyBreakdown: QuarterlyMonthDetail[] = baseMonths.map((m) => {
      const targetIn =
        ov?.targetSellIn !== undefined ? Math.round(m.monthBaSellInTarget * inRatio) : m.monthBaSellInTarget;
      const targetOut =
        ov?.targetSellOut !== undefined ? Math.round(m.monthBaSellOutTarget * outRatio) : m.monthBaSellOutTarget;

      // Target & Pencapaian BA mengikuti Daftar Target BA (Sell Out = Non-Lavojoy + Lavojoy) kecuali filter KET = SELL IN
      const activeMonthTarget = activeKet === 'SELL IN' ? targetIn : targetOut;
      const activeMonthActual = activeKet === 'SELL IN' ? m.actSellIn : m.actSellOut;

      const pct = activeMonthTarget > 0 ? (activeMonthActual / activeMonthTarget) * 100 : 0;

      return {
        monthName: m.mName,
        monthIndex: m.mIdx,
        targetSellIn: targetIn,
        targetSellOut: targetOut,
        actualSellIn: m.actSellIn,
        actualSellOut: m.actSellOut,
        targetNonLavojoy: Math.round(m.mTargetNonLav * (ov?.targetSellOut !== undefined ? outRatio : 1)),
        targetLavojoy: Math.round(m.mTargetLav * (ov?.targetSellOut !== undefined ? outRatio : 1)),
        actualNonLavojoy: m.actNonLav,
        actualLavojoy: m.actLav,
        target: activeMonthTarget,
        actual: activeMonthActual,
        achievementPercent: pct,
        focusTargetPcs: m.monthFocusTarget,
        focusActualPcs: m.focusAct,
        assignedStores: m.assignedStores,
      };
    });

    const quarterActualSellIn = resolvedSellInMonths.reduce((sum, v) => sum + v, 0);
    const quarterActualNonLavojoy = baseMonths.reduce((sum, m) => sum + m.actNonLav, 0);
    const quarterActualLavojoy = baseMonths.reduce((sum, m) => sum + m.actLav, 0);
    const quarterActualSellOut = quarterActualNonLavojoy + quarterActualLavojoy;

    // Pada mode ALL maupun SELL OUT, Target BA & Pencapaian BA mengikuti Daftar Target Beauty Advisor (Non-Lavojoy + Lavojoy)
    const quarterTarget = activeKet === 'SELL IN' ? quarterTargetSellIn : quarterTargetSellOut;
    const quarterActual = activeKet === 'SELL IN' ? quarterActualSellIn : quarterActualSellOut;

    const quarterAchievementSellInPercent =
      quarterTargetSellIn > 0 ? (quarterActualSellIn / quarterTargetSellIn) * 100 : 0;
    const quarterAchievementSellOutPercent =
      quarterTargetSellOut > 0 ? (quarterActualSellOut / quarterTargetSellOut) * 100 : 0;
    const quarterAchievementPercent = quarterTarget > 0 ? (quarterActual / quarterTarget) * 100 : 0;

    const focusTargetPcs = monthlyBreakdown.reduce((sum, m) => sum + (m.focusTargetPcs || 0), 0);
    const focusActualPcs = monthlyBreakdown.reduce((sum, m) => sum + (m.focusActualPcs || 0), 0);
    const focusAchievementPercent = focusTargetPcs > 0 ? (focusActualPcs / focusTargetPcs) * 100 : 0;

    const baIncidents = baIncidentsAll.filter((inc) => {
      if (inc.baName.toLowerCase() !== bName.toLowerCase()) return false;
      if (!inc.date) return false;
      const parts = inc.date.split('-');
      if (parts.length === 3) {
        const incYr = parseInt(parts[0], 10);
        const incMo = parseInt(parts[1], 10) - 1;
        return incYr === year && qMonths.includes(incMo);
      }
      return false;
    });

    const totalNihilDays = baIncidents.filter((inc) => !inc.isOffDay && !inc.isDispensation).length;
    const totalOffDays = baIncidents.filter((inc) => inc.isOffDay).length;
    const totalDendaNominal = totalNihilDays * 25000;

    const baseQuarterSalary = 3900000 * 3;
    const focusDiff = focusActualPcs - focusTargetPcs;
    const focusIncentiveOrFine = focusDiff >= 0 ? focusDiff * 2000 : focusDiff * 1000;
    const totalTakeHomePay = Math.max(0, baseQuarterSalary + focusIncentiveOrFine - totalDendaNominal);

    const workingDaysInQuarter = 78;
    const disciplineRatePercent = Math.max(
      0,
      Math.min(100, Math.round(((workingDaysInQuarter - totalNihilDays) / workingDaysInQuarter) * 100))
    );

    baListRaw.push({
      baName: bName,
      baNumber: bData.baNumber,
      storeName: mergedStoreName,
      coverArea: bData.coverArea,
      region: bData.region,
      spvName: bData.spvName,
      quarterTarget,
      quarterTargetSellIn,
      quarterTargetSellOut,
      quarterTargetNonLavojoy,
      quarterTargetLavojoy,
      quarterActual,
      quarterActualSellIn,
      quarterActualSellOut,
      quarterActualNonLavojoy,
      quarterActualLavojoy,
      quarterAchievementPercent,
      quarterAchievementSellInPercent,
      quarterAchievementSellOutPercent,
      isCustomQuarterTarget,
      isCustomActualSellIn,
      focusTargetPcs,
      focusActualPcs,
      focusAchievementPercent,
      totalNihilDays,
      totalOffDays,
      disciplineRatePercent,
      totalDendaNominal,
      totalTakeHomePay,
      monthlyBreakdown,
    });
  });

  baListRaw.sort((a, b) => {
    const pctDiff = b.quarterAchievementPercent - a.quarterAchievementPercent;
    if (Math.abs(pctDiff) > 0.0001) return pctDiff;
    return b.quarterActual - a.quarterActual;
  });
  const baList: BaQuarterlySummaryItem[] = baListRaw.map((b, idx) => ({
    ...b,
    rank: idx + 1,
  }));

  // -------------------------------------------------------------
  // 3. TRAINER QUARTERLY SUMMARY (AGGREGATED BY REAL TRANSACTIONS + KPI)
  // -------------------------------------------------------------
  const trainerList: TrainerQuarterlySummaryItem[] = [];
  const dynamicTrainerList = loadTrainerConfigs();
  const activeTrainers = dynamicTrainerList.length > 0 ? dynamicTrainerList : DEFAULT_TRAINERS_DATA;

  // Pre-aggregate actual Sell In & Sell Out per trainer directly from scopedRecords
  const trainerTxTotals = new Map<
    string,
    {
      sellIn: number[];
      sellOut: number[];
      all: number[];
      focusPcs: number[];
    }
  >();

  activeTrainers.forEach((trn) => {
    trainerTxTotals.set(trn.trainerName.trim().toUpperCase(), {
      sellIn: [0, 0, 0],
      sellOut: [0, 0, 0],
      all: [0, 0, 0],
      focusPcs: [0, 0, 0],
    });
  });

  scopedRecords.forEach((r) => {
    const dt = parseRecordMonthYear(r);
    if (!dt || dt.year !== year) return;
    const qMonthPosition = qMonths.indexOf(dt.monthIndex);
    if (qMonthPosition === -1) return;

    const assignedTrainer = getTrainerForRecord(r).trim().toUpperCase();
    const bucket = trainerTxTotals.get(assignedTrainer);
    if (!bucket) return;

    const val = r.VALUE || 0;
    const ketType = classifyKet(r.KET);

    if (ketType === 'SELL IN') {
      bucket.sellIn[qMonthPosition] += val;
    } else if (ketType === 'SELL OUT') {
      bucket.sellOut[qMonthPosition] += val;
    }
    if (activeKet === 'ALL' || (r.KET || '').toUpperCase().trim() === activeKet) {
      bucket.all[qMonthPosition] += val;
      if (isFocusProduct(r.PRODUK_FOCUS || r)) {
        bucket.focusPcs[qMonthPosition] += Math.max(0, r.QTY || 0);
      }
    }
  });

  activeTrainers.forEach((trn) => {
    const tUpper = trn.trainerName.trim().toUpperCase();
    const bucket = trainerTxTotals.get(tUpper) || {
      sellIn: [0, 0, 0],
      sellOut: [0, 0, 0],
      all: [0, 0, 0],
      focusPcs: [0, 0, 0],
    };

    const baseTargetSellOut = trn.targetSellOut || 300000000;
    const baseTargetSellIn = Math.round(baseTargetSellOut * 1.1);
    const baseFocusTargetPcs = trn.targetProdukFokusPcs || 500;

    const actualSellInOv = quarterlyActualSellInOverrides[buildQuarterlyTargetKey(year, quarter, 'trainer', trn.trainerName)];
    const { monthlySellIn: resolvedSellInMonths, isCustomActualSellIn } = resolveMonthlySellInActuals(
      bucket.sellIn,
      actualSellInOv
    );

    const baseMonths = qMonths.map((mIdx, i) => {
      const mName = qMonthNames[i];
      const trMonthTargets = qTrainerMaps[i];
      const tOv = trMonthTargets[trn.id] || trMonthTargets[trn.trainerName] || {};
      const mTargetSellOut =
        tOv.targetSellOut !== undefined && tOv.targetSellOut > 0 ? tOv.targetSellOut : baseTargetSellOut;
      const mTargetSellIn = Math.round(mTargetSellOut * 1.1);
      const mFocusTargetPcs =
        tOv.targetProdukFokusPcs !== undefined && tOv.targetProdukFokusPcs > 0
          ? tOv.targetProdukFokusPcs
          : baseFocusTargetPcs;

      const matchedTrainerKpi = kpiTrainerAll.find(
        (k) =>
          k.trainerName.toLowerCase() === trn.trainerName.toLowerCase() &&
          k.monthPeriod?.toUpperCase().includes(mName)
      );
      const actSellIn = resolvedSellInMonths[i];
      const actSellInDelta = actSellIn - bucket.sellIn[i];

      return {
        mIdx,
        mName,
        mTargetSellIn: mTargetSellIn || baseTargetSellIn,
        mTargetSellOut,
        mFocusTargetPcs,
        actSellIn,
        actSellOut: bucket.sellOut[i],
        actAll: Math.max(0, bucket.all[i] + actSellInDelta),
        focusAct: bucket.focusPcs[i] || (matchedTrainerKpi as unknown as { produkFokusActual?: number })?.produkFokusActual || 0,
        kpiScoreFromCard:
          matchedTrainerKpi?.totalScore ??
          (matchedTrainerKpi as unknown as { totalPoinKpi?: number })?.totalPoinKpi ??
          0,
      };
    });

    const baseQuarterSellInTarget = baseMonths.reduce((sum, m) => sum + m.mTargetSellIn, 0);
    const baseQuarterSellOutTarget = baseMonths.reduce((sum, m) => sum + m.mTargetSellOut, 0);

    const ov = quarterlyOverrides[buildQuarterlyTargetKey(year, quarter, 'trainer', trn.trainerName)];
    const quarterTargetSellIn = ov?.targetSellIn !== undefined ? ov.targetSellIn : baseQuarterSellInTarget;
    const quarterTargetSellOut = ov?.targetSellOut !== undefined ? ov.targetSellOut : baseQuarterSellOutTarget;
    const isCustomQuarterTarget = ov?.targetSellIn !== undefined || ov?.targetSellOut !== undefined;

    const inRatio = baseQuarterSellInTarget > 0 ? quarterTargetSellIn / baseQuarterSellInTarget : 1;
    const outRatio = baseQuarterSellOutTarget > 0 ? quarterTargetSellOut / baseQuarterSellOutTarget : 1;

    const monthlyBreakdown: QuarterlyMonthDetail[] = baseMonths.map((m) => {
      const targetIn = ov?.targetSellIn !== undefined ? Math.round(m.mTargetSellIn * inRatio) : m.mTargetSellIn;
      const targetOut = ov?.targetSellOut !== undefined ? Math.round(m.mTargetSellOut * outRatio) : m.mTargetSellOut;

      const activeMonthTarget = activeKet === 'SELL IN' ? targetIn : targetOut;
      const activeMonthActual =
        activeKet === 'SELL IN'
          ? m.actSellIn
          : activeKet === 'SELL OUT'
          ? m.actSellOut
          : m.actAll;

      const pct = activeMonthTarget > 0 ? (activeMonthActual / activeMonthTarget) * 100 : 0;
      const kpiScore = m.kpiScoreFromCard > 0 ? m.kpiScoreFromCard : Math.min(100, Math.round(pct * 0.95));

      return {
        monthName: m.mName,
        monthIndex: m.mIdx,
        targetSellIn: targetIn,
        targetSellOut: targetOut,
        actualSellIn: m.actSellIn,
        actualSellOut: m.actSellOut,
        target: activeMonthTarget,
        actual: activeMonthActual,
        achievementPercent: pct,
        focusTargetPcs: m.mFocusTargetPcs,
        focusActualPcs: m.focusAct,
        kpiScore,
      };
    });

    const quarterActualSellIn = resolvedSellInMonths.reduce((sum, v) => sum + v, 0);
    const quarterActualSellOut = bucket.sellOut.reduce((sum, v) => sum + v, 0);
    const quarterActualAll = baseMonths.reduce((sum, m) => sum + m.actAll, 0);

    const quarterTarget = activeKet === 'SELL IN' ? quarterTargetSellIn : quarterTargetSellOut;
    const quarterActual =
      activeKet === 'SELL IN'
        ? quarterActualSellIn
        : activeKet === 'SELL OUT'
        ? quarterActualSellOut
        : quarterActualAll;

    const quarterAchievementSellInPercent =
      quarterTargetSellIn > 0 ? (quarterActualSellIn / quarterTargetSellIn) * 100 : 0;
    const quarterAchievementSellOutPercent =
      quarterTargetSellOut > 0 ? (quarterActualSellOut / quarterTargetSellOut) * 100 : 0;
    const quarterAchievementPercent = quarterTarget > 0 ? (quarterActual / quarterTarget) * 100 : 0;

    const focusTargetPcs = monthlyBreakdown.reduce((sum, m) => sum + (m.focusTargetPcs || 0), 0);
    const focusActualPcs = monthlyBreakdown.reduce((sum, m) => sum + (m.focusActualPcs || 0), 0);
    const focusAchievementPercent = focusTargetPcs > 0 ? (focusActualPcs / focusTargetPcs) * 100 : 0;

    const avgKpiScore = Math.round(
      monthlyBreakdown.reduce((sum, m) => sum + (m.kpiScore || 0), 0) / monthlyBreakdown.length
    );

    let totalIncentive = 0;
    let totalDendaSP1 = 0;
    let hadSp1 = false;

    monthlyBreakdown.forEach((m) => {
      const score = m.kpiScore || 0;
      if (score >= 100) totalIncentive += 2000000;
      else if (score >= 90) totalIncentive += 1000000;
      else if (score >= 80) totalIncentive += 500000;
      else if (score < 70) {
        totalDendaSP1 += 300000;
        hadSp1 = true;
      }
    });

    const netIncentive = Math.max(0, totalIncentive - totalDendaSP1);
    const spStatus: 'Aman' | 'Peringatan SP1' = hadSp1 ? 'Peringatan SP1' : 'Aman';

    const coveredBaCount =
      baList.filter((b) =>
        b.coverArea.toLowerCase().includes(trn.areaCovered.toLowerCase().slice(0, 4))
      ).length || 5;

    const trainingSessionCount = monthlyBreakdown.length * 8;

    trainerList.push({
      trainerName: trn.trainerName,
      areaCovered: trn.areaCovered,
      region: trn.region,
      quarterTarget,
      quarterTargetSellIn,
      quarterTargetSellOut,
      quarterActual,
      quarterActualSellIn,
      quarterActualSellOut,
      quarterAchievementPercent,
      quarterAchievementSellInPercent,
      quarterAchievementSellOutPercent,
      isCustomQuarterTarget,
      isCustomActualSellIn,
      focusTargetPcs,
      focusActualPcs,
      focusAchievementPercent,
      avgKpiScore,
      totalIncentive,
      totalDendaSP1,
      netIncentive,
      spStatus,
      coveredBaCount,
      trainingSessionCount,
      monthlyBreakdown,
    });
  });

  trainerList.sort((a, b) => {
    const pctDiff = b.quarterAchievementPercent - a.quarterAchievementPercent;
    if (Math.abs(pctDiff) > 0.0001) return pctDiff;
    return b.quarterActual - a.quarterActual;
  });

  // -------------------------------------------------------------
  // 3B. STORE QUARTERLY SELL IN RANKING (TOP TOKO PERINGKAT 1)
  // -------------------------------------------------------------
  const storeAggMap = new Map<
    string,
    {
      storeName: string;
      salesName: string;
      spvName: string;
      coverArea: string;
      region: string;
      trainerName: string;
      baName: string;
      monthlySellInActual: [number, number, number];
    }
  >();

  scopedRecords.forEach((r) => {
    if (classifyKet(r.KET) !== 'SELL IN') return;
    const dt = parseRecordMonthYear(r);
    if (!dt || dt.year !== year) return;
    const qPos = qMonths.indexOf(dt.monthIndex);
    if (qPos === -1) return;

    const resolved = resolveBaAndStoreFromRecord(r);
    const displayStore = normalizeStoreDisplay(resolved.resolvedStore || r.NAMA_STORE);
    const upperSt = displayStore.toUpperCase();
    if (!displayStore || upperSt === '-' || upperSt === 'ALL' || upperSt === 'COUNTER TOKO') return;

    const storeKey = normalizeStoreAlnum(displayStore) || upperSt;
    if (!storeAggMap.has(storeKey)) {
      const canonicalSales = canonicalizeRegisteredSalesName(r.SALES) || (r.SALES || '-').trim().toUpperCase();
      storeAggMap.set(storeKey, {
        storeName: displayStore,
        salesName: canonicalSales || '-',
        spvName: resolved.resolvedSpv || r.SPV || '-',
        coverArea: resolved.resolvedArea || r.COVER_AREA || '-',
        region: resolved.resolvedRegion || r.REGION || '-',
        trainerName: getTrainerForRecord(r).trim().toUpperCase(),
        baName: !isPlaceholderBaToken(resolved.resolvedBaName) ? resolved.resolvedBaName : '',
        monthlySellInActual: [0, 0, 0],
      });
    }

    const stEntry = storeAggMap.get(storeKey)!;
    stEntry.monthlySellInActual[qPos] += r.VALUE || 0;
    if (!stEntry.baName && !isPlaceholderBaToken(resolved.resolvedBaName)) {
      stEntry.baName = resolved.resolvedBaName;
    }
    if ((!stEntry.salesName || stEntry.salesName === '-') && r.SALES) {
      stEntry.salesName = canonicalizeRegisteredSalesName(r.SALES) || r.SALES.trim().toUpperCase();
    }
  });

  const storeList: StoreQuarterlySummaryItem[] = [];
  storeAggMap.forEach((st) => {
    const monthlySellInTarget: [number, number, number] = [0, 0, 0];
    let salesName = st.salesName;
    let spvName = st.spvName;
    let coverArea = st.coverArea;
    let region = st.region;
    let baName = st.baName;

    qMonthNames.forEach((mName, idx) => {
      const matched = findStoreSellInInLookup(storeSellInLookupByMonth[mName], st.storeName);
      if (matched) {
        monthlySellInTarget[idx] = matched.targetSellIn || 0;
        if ((!salesName || salesName === '-') && matched.salesName) salesName = matched.salesName;
        if ((!spvName || spvName === '-') && matched.spv) spvName = matched.spv;
        if ((!coverArea || coverArea === '-' || coverArea === 'AREA BARU') && matched.coverArea) {
          coverArea = matched.coverArea;
        }
        if ((!region || region === '-' || region === 'PEKAN BARU') && matched.region) {
          region = matched.region;
        }
        if (!baName && matched.baName && !isPlaceholderBaToken(matched.baName)) {
          baName = matched.baName;
        }
      }
    });

    const quarterTargetSellIn =
      monthlySellInTarget[0] + monthlySellInTarget[1] + monthlySellInTarget[2];
    const quarterActualSellIn =
      st.monthlySellInActual[0] + st.monthlySellInActual[1] + st.monthlySellInActual[2];
    const quarterAchievementSellInPercent =
      quarterTargetSellIn > 0 ? (quarterActualSellIn / quarterTargetSellIn) * 100 : 0;

    storeList.push({
      storeName: st.storeName,
      salesName,
      spvName,
      coverArea,
      region,
      trainerName: st.trainerName,
      baName,
      quarterTargetSellIn,
      quarterActualSellIn,
      quarterAchievementSellInPercent,
      monthlySellInTarget,
      monthlySellInActual: st.monthlySellInActual,
    });
  });

  storeList.sort((a, b) => {
    const pctDiff = b.quarterAchievementSellInPercent - a.quarterAchievementSellInPercent;
    if (Math.abs(pctDiff) > 0.0001) return pctDiff;
    return b.quarterActualSellIn - a.quarterActualSellIn;
  });

  // -------------------------------------------------------------
  // 4. OVERALL EXECUTIVE SUMMARY
  // -------------------------------------------------------------
  const totalTargetArea = salesList.reduce((acc, s) => acc + s.quarterTarget, 0);
  const totalTargetSellIn = salesList.reduce((acc, s) => acc + s.quarterTargetSellIn, 0);
  const totalTargetSellOut = salesList.reduce((acc, s) => acc + s.quarterTargetSellOut, 0);
  const totalActualArea = salesList.reduce((acc, s) => acc + s.quarterActual, 0);
  const totalActualSellIn = salesList.reduce((acc, s) => acc + s.quarterActualSellIn, 0);
  const totalActualSellOut = salesList.reduce((acc, s) => acc + s.quarterActualSellOut, 0);
  const areaAchievementPercent = totalTargetArea > 0 ? (totalActualArea / totalTargetArea) * 100 : 0;

  const totalSalesCommission = salesList.reduce((acc, s) => acc + s.totalCommission, 0);
  const totalBaTakeHomePay = baList.reduce((acc, b) => acc + b.totalTakeHomePay, 0);
  const totalTrainerIncentive = trainerList.reduce((acc, t) => acc + t.netIncentive, 0);

  const avgSalesKpiScore =
    salesList.length > 0
      ? Math.round(salesList.reduce((acc, s) => acc + s.avgKpiScore, 0) / salesList.length)
      : 0;

  const avgTrainerKpiScore =
    trainerList.length > 0
      ? Math.round(trainerList.reduce((acc, t) => acc + t.avgKpiScore, 0) / trainerList.length)
      : 0;

  const topSales =
    salesList.length > 0
      ? {
          name: salesList[0].salesName,
          actual: salesList[0].quarterActual,
          target: salesList[0].quarterTarget,
          percent: salesList[0].quarterAchievementPercent,
        }
      : null;

  const topBa =
    baList.length > 0
      ? {
          name: baList[0].baName,
          store: baList[0].storeName,
          actual: baList[0].quarterActual,
          target: baList[0].quarterTarget,
          percent: baList[0].quarterAchievementPercent,
        }
      : null;

  const topStore =
    storeList.length > 0
      ? {
          storeName: storeList[0].storeName,
          salesName: storeList[0].salesName,
          coverArea: storeList[0].coverArea,
          baName: storeList[0].baName || undefined,
          actualSellIn: storeList[0].quarterActualSellIn,
          targetSellIn: storeList[0].quarterTargetSellIn,
          percent: storeList[0].quarterAchievementSellInPercent,
        }
      : null;

  const topTrainer =
    trainerList.length > 0
      ? {
          name: trainerList[0].trainerName,
          actual: trainerList[0].quarterActual,
          target: trainerList[0].quarterTarget,
          percent: trainerList[0].quarterAchievementPercent,
          score: trainerList[0].avgKpiScore,
        }
      : null;

  const overall: QuarterlyOverallSummary = {
    quarter,
    year,
    quarterLabel: `${qInfo.label} • ${year}`,
    dateRangeLabel: qInfo.dateRange,
    baSellOutDateRangeLabel: formatBaCutOffRangeLabel(quarter, year),
    activeKetFilter: activeKet,
    totalTargetArea,
    totalTargetSellIn,
    totalTargetSellOut,
    totalActualArea,
    totalActualSellIn,
    totalActualSellOut,
    areaAchievementPercent,
    totalSalesCount: salesList.length,
    totalBaCount: baList.length,
    totalTrainerCount: trainerList.length,
    totalSalesCommission,
    totalBaTakeHomePay,
    totalTrainerIncentive,
    avgSalesKpiScore,
    avgTrainerKpiScore,
    topSales,
    topBa,
    topStore,
    topTrainer,
  };

  const result: QuarterlySummaryResult = {
    overall,
    salesList,
    baList,
    trainerList,
    storeList,
  };
  quarterlySummaryLru.unshift({ records, key: cacheKey, result });
  if (quarterlySummaryLru.length > 6) {
    quarterlySummaryLru.pop();
  }
  return result;
}

export function exportQuarterlyToExcel(
  data: ReturnType<typeof calculateQuarterlySummary>,
  quarter: QuarterPeriodKey,
  year: number
) {
  import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new();

    const overallRows = [
      ['RANGKUMAN EKSEKUTIF KUARTAL - PENCAPAIAN & KPI'],
      ['Periode', data.overall.quarterLabel],
      ['Rentang Tanggal', data.overall.dateRangeLabel],
      ['Filter Keterangan Aktif', data.overall.activeKetFilter],
      ['Target Kuartal Sell In (IDR)', data.overall.totalTargetSellIn],
      ['Realisasi Kuartal Sell In (IDR)', data.overall.totalActualSellIn],
      ['Target Kuartal Sell Out (IDR)', data.overall.totalTargetSellOut],
      ['Realisasi Kuartal Sell Out (IDR)', data.overall.totalActualSellOut],
      ['Total Target Aktif (IDR)', data.overall.totalTargetArea],
      ['Total Realisasi Aktif (IDR)', data.overall.totalActualArea],
      ['Pencapaian (%)', `${data.overall.areaAchievementPercent.toFixed(1)}%`],
      [],
      ['Total Personil Sales', data.overall.totalSalesCount],
      ['Total Personil BA', data.overall.totalBaCount],
      ['Total Personil Trainer', data.overall.totalTrainerCount],
      [],
      ['Total Komisi Sales Kuartal (IDR)', data.overall.totalSalesCommission],
      ['Total Estimasi Gaji/THP BA Kuartal (IDR)', data.overall.totalBaTakeHomePay],
      ['Total Insentif Netto Trainer Kuartal (IDR)', data.overall.totalTrainerIncentive],
    ];
    const wsOverall = XLSX.utils.aoa_to_sheet(overallRows);
    XLSX.utils.book_append_sheet(wb, wsOverall, 'Ringkasan Eksekutif');

    const salesHeader = [
      'Nama Sales',
      'Area Coverage',
      'Target Kuartal Sell In (IDR)',
      'Realisasi Sell In (IDR)',
      '% Ach Sell In',
      'Target Kuartal Sell Out (IDR)',
      'Realisasi Sell Out (IDR)',
      '% Ach Sell Out',
      'Target Aktif (IDR)',
      'Realisasi Aktif (IDR)',
      '% Pencapaian Aktif',
      'Skor KPI Rata-rata',
      'Grade KPI',
      'Total Komisi (IDR)',
      'Status Pencapaian',
    ];
    const salesRows = data.salesList.map((s) => [
      s.salesName,
      s.coverArea,
      s.quarterTargetSellIn,
      s.quarterActualSellIn,
      `${s.quarterAchievementSellInPercent.toFixed(1)}%`,
      s.quarterTargetSellOut,
      s.quarterActualSellOut,
      `${s.quarterAchievementSellOutPercent.toFixed(1)}%`,
      s.quarterTarget,
      s.quarterActual,
      `${s.quarterAchievementPercent.toFixed(1)}%`,
      s.avgKpiScore,
      s.kpiGrade,
      s.totalCommission,
      s.statusBadge,
    ]);
    const wsSales = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]);
    XLSX.utils.book_append_sheet(wb, wsSales, 'Rangkuman Sales');

    const baHeader = [
      'Peringkat',
      'Nama BA',
      'Nomor Induk (NIK)',
      'Nama Toko / Outlet',
      'Cover Area',
      'SPV',
      'Target Kuartal Sell In (IDR)',
      'Realisasi Sell In (IDR)',
      'Target Non-Lavojoy (IDR)',
      'Realisasi Non-Lavojoy (IDR)',
      'Target Lavojoy (IDR)',
      'Realisasi Lavojoy (IDR)',
      'Target Kuartal Sell Out (IDR)',
      'Realisasi Sell Out (IDR)',
      'Target Aktif (IDR)',
      'Realisasi Aktif (IDR)',
      '% Pencapaian Aktif',
      'Target Produk Fokus (Pcs)',
      'Realisasi Produk Fokus (Pcs)',
      'Hari Nihil (Non-Off)',
      'Hari Off Resmi',
      'Total Denda Nihil (IDR)',
      'Estimasi Take Home Pay (IDR)',
    ];
    const baRows = data.baList.map((b) => [
      b.rank,
      b.baName,
      b.baNumber,
      b.storeName,
      b.coverArea,
      b.spvName,
      b.quarterTargetSellIn,
      b.quarterActualSellIn,
      b.quarterTargetNonLavojoy ?? 0,
      b.quarterActualNonLavojoy ?? 0,
      b.quarterTargetLavojoy ?? 0,
      b.quarterActualLavojoy ?? 0,
      b.quarterTargetSellOut,
      b.quarterActualSellOut,
      b.quarterTarget,
      b.quarterActual,
      `${b.quarterAchievementPercent.toFixed(1)}%`,
      b.focusTargetPcs,
      b.focusActualPcs,
      b.totalNihilDays,
      b.totalOffDays,
      b.totalDendaNominal,
      b.totalTakeHomePay,
    ]);
    const wsBa = XLSX.utils.aoa_to_sheet([baHeader, ...baRows]);
    XLSX.utils.book_append_sheet(wb, wsBa, 'Rangkuman BA');

    const trainerHeader = [
      'Nama Trainer',
      'Area Coverage',
      'Target Kuartal Sell In (IDR)',
      'Realisasi Sell In (IDR)',
      'Target Kuartal Sell Out (IDR)',
      'Realisasi Sell Out (IDR)',
      'Target Aktif (IDR)',
      'Realisasi Aktif (IDR)',
      '% Pencapaian Aktif',
      'Target Produk Fokus (Pcs)',
      'Realisasi Produk Fokus (Pcs)',
      'Skor KPI Rata-rata (Poin)',
      'Insentif Tier KPI (IDR)',
      'Denda SP1 (IDR)',
      'Total Insentif Netto (IDR)',
      'Status SP',
    ];
    const trainerRows = data.trainerList.map((t) => [
      t.trainerName,
      t.areaCovered,
      t.quarterTargetSellIn,
      t.quarterActualSellIn,
      t.quarterTargetSellOut,
      t.quarterActualSellOut,
      t.quarterTarget,
      t.quarterActual,
      `${t.quarterAchievementPercent.toFixed(1)}%`,
      t.focusTargetPcs,
      t.focusActualPcs,
      t.avgKpiScore,
      t.totalIncentive,
      t.totalDendaSP1,
      t.netIncentive,
      t.spStatus,
    ]);
    const wsTrainer = XLSX.utils.aoa_to_sheet([trainerHeader, ...trainerRows]);
    XLSX.utils.book_append_sheet(wb, wsTrainer, 'Rangkuman Trainer');

    XLSX.writeFile(wb, `Rangkuman_Kuartal_${quarter}_${year}_Sales_BA_Trainer.xlsx`);
  });
}
