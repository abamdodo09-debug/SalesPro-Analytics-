import {
  TransactionRecord,
  QuarterPeriodKey,
  QuarterlyMonthDetail,
  SalesQuarterlySummaryItem,
  BaQuarterlySummaryItem,
  TrainerQuarterlySummaryItem,
  QuarterlyOverallSummary,
} from '../types/dashboard';
import { loadKpiSalesData, loadBaIncidents } from './agingAndKpiService';
import { loadKpiTrainerData } from './kpiTrainerService';
import { DEFAULT_TRAINERS_DATA } from '../utils/costCalculations';
import { getTrainerForRecord, isFocusProduct } from '../utils/analytics';
import { SALES_MASTER_6_CONFIG } from './kpiSalesData';
import {
  loadSalesTargets,
  loadSalesSellOutTargets,
  loadBaNonLavojoyTargets,
  loadBaLavojoyTargets,
  loadBaFocusTargets,
  loadTrainerConfigs,
  loadTrainerTargets,
  DEFAULT_BA_NON_LAVOJOY_TARGET,
  DEFAULT_BA_LAVOJOY_TARGET,
  DEFAULT_SALES_TARGET,
  DEFAULT_SALES_SELLOUT_TARGET,
  notifyTargetsUpdated,
} from './targetManagementService';

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

// Helper parsing transaction record dates safely
export function parseRecordMonthYear(record: TransactionRecord): { monthIndex: number; year: number } | null {
  if (record.TANGGAL) {
    const trimmed = record.TANGGAL.trim();
    const parts = trimmed.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const yr = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(yr) && !isNaN(m) && m >= 0 && m <= 11) return { monthIndex: m, year: yr };
      } else {
        const m = parseInt(parts[0], 10) - 1;
        const yr = parseInt(parts[2], 10);
        if (!isNaN(yr) && !isNaN(m) && m >= 0 && m <= 11) return { monthIndex: m, year: yr };
      }
    }
  }

  if (record.BULAN) {
    const bUpper = record.BULAN.toUpperCase();
    const idx = ALL_MONTH_NAMES.findIndex((m) => bUpper.includes(m));
    if (idx !== -1) {
      const yr = record.TAHUN || 2026;
      return { monthIndex: idx, year: yr };
    }
  }

  return null;
}

function classifyKet(ketRaw?: string): 'SELL IN' | 'SELL OUT' | 'OTHER' {
  const upper = (ketRaw || '').toUpperCase().trim();
  if (upper.includes('SELL IN')) return 'SELL IN';
  if (upper.includes('SELL OUT')) return 'SELL OUT';
  return 'OTHER';
}

// Compute complete quarterly summary for Sales, BA & Trainer
export function calculateQuarterlySummary(
  records: TransactionRecord[],
  quarter: QuarterPeriodKey = 'Q4',
  year: number = 2026,
  filterArea: string = 'ALL',
  filterSpv: string = 'ALL',
  filterKet: string = 'ALL'
): {
  overall: QuarterlyOverallSummary;
  salesList: SalesQuarterlySummaryItem[];
  baList: BaQuarterlySummaryItem[];
  trainerList: TrainerQuarterlySummaryItem[];
} {
  const qInfo = QUARTER_MONTHS[quarter] || QUARTER_MONTHS.Q4;
  const qMonths = qInfo.months;
  const qMonthNames = qInfo.monthNames;
  const activeKet = (filterKet || 'ALL').toUpperCase().trim();

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
      const mSalesInMap = loadSalesTargets(mName);
      const mSalesOutMap = loadSalesSellOutTargets(mName);
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
  const baMap = new Map<
    string,
    {
      baNumber: string;
      storeName: string;
      coverArea: string;
      region: string;
      spvName: string;
      monthlySellInActual: number[];
      monthlySellOutActual: number[];
      monthlyAllActual: number[];
      monthlyFocusActual: number[];
    }
  >();

  scopedRecords.forEach((r) => {
    const bName = (r.BA || '').trim();
    if (!bName || bName === '-' || bName.toLowerCase() === 'all') return;

    if (!baMap.has(bName)) {
      baMap.set(bName, {
        baNumber: r.BA_Number || `BA-${baMap.size + 101}`,
        storeName: r.NAMA_STORE || 'Counter Toko',
        coverArea: r.COVER_AREA || 'AREA BARU',
        region: r.REGION || 'PEKAN BARU',
        spvName: r.SPV || 'WIDODO',
        monthlySellInActual: [0, 0, 0],
        monthlySellOutActual: [0, 0, 0],
        monthlyAllActual: [0, 0, 0],
        monthlyFocusActual: [0, 0, 0],
      });
    }

    const dt = parseRecordMonthYear(r);
    if (!dt || dt.year !== year) return;
    const qMonthPosition = qMonths.indexOf(dt.monthIndex);
    if (qMonthPosition === -1) return;

    const item = baMap.get(bName)!;
    const val = r.VALUE || 0;
    const ketType = classifyKet(r.KET);

    if (ketType === 'SELL IN') {
      item.monthlySellInActual[qMonthPosition] += val;
    } else if (ketType === 'SELL OUT') {
      item.monthlySellOutActual[qMonthPosition] += val;
    }
    if (activeKet === 'ALL' || (r.KET || '').toUpperCase().trim() === activeKet) {
      item.monthlyAllActual[qMonthPosition] += val;
      if (isFocusProduct(r.PRODUK_FOCUS || r)) {
        item.monthlyFocusActual[qMonthPosition] += Math.max(0, r.QTY || 0);
      }
    }
  });

  const templateBAs = [
    { name: 'FITRI HANDAYANI', store: 'RIS IDOLA', target: 55000000 },
    { name: 'SITI RAHMAWATI', store: 'TOKO SEJATI', target: 45000000 },
    { name: 'YOLANDA OKTAVIA', store: 'MISS GLAM TEMBILAHAN', target: 100000000 },
    { name: 'DEWI LESTARI', store: 'IDOLA AIR MOLEK', target: 47000000 },
    { name: 'RINA ANGGRAINI', store: 'MY KOSMETIK (PKL KERINCI)', target: 45000000 },
    { name: 'CUT AMELIA', store: 'TG TENAGA BARU', target: 45000000 },
    { name: 'LILI LESTARI', store: 'HIDAYAH BEAUTY PERAWANG', target: 45000000 },
    { name: 'ANISA PUTRI', store: 'HIDAYAH BEAUTY KERINCI', target: 47000000 },
    { name: 'DWI WULANDARI', store: 'MY KOSMETIK SOREK', target: 45000000 },
    { name: 'NURUL AINI', store: 'TOKO JINAAN STORE', target: 47000000 },
    { name: 'WINDY PRATIWI', store: 'CITRA SWALAYAN', target: 60000000 },
  ];

  templateBAs.forEach((tb, idx) => {
    if (!baMap.has(tb.name)) {
      baMap.set(tb.name, {
        baNumber: `BA-0${idx + 1}`,
        storeName: tb.store,
        coverArea: 'INDRAGIRI',
        region: 'PEKAN BARU',
        spvName: 'WIDODO',
        monthlySellInActual: [0, 0, 0],
        monthlySellOutActual: [0, 0, 0],
        monthlyAllActual: [0, 0, 0],
        monthlyFocusActual: [0, 0, 0],
      });
    }
  });

  const baListRaw: Omit<BaQuarterlySummaryItem, 'rank'>[] = [];

  baMap.forEach((bData, bName) => {
    const matchedTemplate = templateBAs.find((t) => t.name.toLowerCase() === bName.toLowerCase());
    const monthlyTargetNominal = matchedTemplate ? matchedTemplate.target : 45000000;
    const monthlyFocusTargetPcs = 120;

    const actualSellInOv = quarterlyActualSellInOverrides[buildQuarterlyTargetKey(year, quarter, 'ba', bName)];
    const { monthlySellIn: resolvedSellInMonths, isCustomActualSellIn } = resolveMonthlySellInActuals(
      bData.monthlySellInActual,
      actualSellInOv
    );

    const baseMonths = qMonths.map((mIdx, i) => {
      const mName = qMonthNames[i];
      const baNonMap = loadBaNonLavojoyTargets(mName);
      const baLavMap = loadBaLavojoyTargets(mName);
      const baFocusMap = loadBaFocusTargets(mName);
      const upperStore = bData.storeName.toUpperCase().trim();
      const nonKey = Object.keys(baNonMap).find((k) => k.toUpperCase().trim() === upperStore);
      const lavKey = Object.keys(baLavMap).find((k) => k.toUpperCase().trim() === upperStore);
      const focusKey = Object.keys(baFocusMap).find(
        (k) => k.toUpperCase().trim() === upperStore || k.toUpperCase().trim() === bName.toUpperCase().trim()
      );

      const monthBaSellOutTarget =
        nonKey !== undefined || lavKey !== undefined
          ? (nonKey !== undefined ? baNonMap[nonKey] : DEFAULT_BA_NON_LAVOJOY_TARGET) +
            (lavKey !== undefined ? baLavMap[lavKey] : DEFAULT_BA_LAVOJOY_TARGET)
          : monthlyTargetNominal;
      const monthBaSellInTarget = Math.round(monthBaSellOutTarget * 1.1);
      const monthFocusTarget = focusKey !== undefined ? baFocusMap[focusKey] : monthlyFocusTargetPcs;
      const actSellIn = resolvedSellInMonths[i];
      const actSellInDelta = actSellIn - bData.monthlySellInActual[i];

      return {
        mIdx,
        mName,
        monthBaSellInTarget,
        monthBaSellOutTarget,
        monthFocusTarget,
        actSellIn,
        actSellOut: bData.monthlySellOutActual[i],
        actAll: Math.max(0, bData.monthlyAllActual[i] + actSellInDelta),
        focusAct: bData.monthlyFocusActual[i],
      };
    });

    const baseQuarterSellInTarget = baseMonths.reduce((sum, m) => sum + m.monthBaSellInTarget, 0);
    const baseQuarterSellOutTarget = baseMonths.reduce((sum, m) => sum + m.monthBaSellOutTarget, 0);

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

      const activeMonthTarget = activeKet === 'SELL IN' ? targetIn : targetOut;
      const activeMonthActual =
        activeKet === 'SELL IN'
          ? m.actSellIn
          : activeKet === 'SELL OUT'
          ? m.actSellOut
          : m.actAll;

      const pct = activeMonthTarget > 0 ? (activeMonthActual / activeMonthTarget) * 100 : 0;

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
        focusTargetPcs: m.monthFocusTarget,
        focusActualPcs: m.focusAct,
      };
    });

    const quarterActualSellIn = resolvedSellInMonths.reduce((sum, v) => sum + v, 0);
    const quarterActualSellOut = bData.monthlySellOutActual.reduce((sum, v) => sum + v, 0);
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
      storeName: bData.storeName,
      coverArea: bData.coverArea,
      region: bData.region,
      spvName: bData.spvName,
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
      const trMonthTargets = loadTrainerTargets(mName);
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
    topTrainer,
  };

  return {
    overall,
    salesList,
    baList,
    trainerList,
  };
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
