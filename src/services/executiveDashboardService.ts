import {
  TransactionRecord,
  DashboardFilters,
  MetricSummary,
  DimensionPerformance,
  SalesGapDiagnosis,
  StoreGapDetailItem,
  ProductStatusSummary,
  ProfitAreaSummary,
  StoreBaContributionSummary,
  MonthlyStoreBaSellInRow,
  StoreInvoiceBillItem,
  BaNihilIncidentRecord,
  AreaTargetItem,
  SalesTargetItem,
  SpvTargetItem,
  BaTargetItem,
  TrainerTargetItem,
  MissGlamMarketShareItem,
} from '../types/dashboard';
import {
  calculateSummary,
  aggregateByDimension,
  detectCategoryFromSku,
  calculateComparisonGrowth,
  diagnoseSalesGap,
  calculateProductStatusAnalysis,
  filterRecords,
  getRecordDayOfMonth,
  isFocusProduct,
  isNewProduct,
  CategoryDetailData,
  MONTH_NAMES_ID,
} from '../utils/analytics';
import {
  aggregateTargetMatrix,
  loadSalesTargets,
  loadBaNonLavojoyTargets,
  loadBaLavojoyTargets,
  loadBaFocusTargets,
  loadTrainerConfigs,
  loadTrainerTargets,
  DEFAULT_SALES_TARGET,
  DEFAULT_BA_NON_LAVOJOY_TARGET,
  DEFAULT_BA_LAVOJOY_TARGET,
} from './targetManagementService';
import {
  calculateStoreBaContribution,
  calculateMonthlyStoreBaSellInContribution,
} from './storeBaContributionService';
import {
  calculateProfitArea,
  combineMonthlyProfitAreaSummaries,
  MonthlyProfitOverrideInput,
  MonthlyProfitSummaryEntry,
} from '../utils/profitCalculations';
import { loadStoreBillsWithRecords, loadBaIncidents } from './agingAndKpiService';
import {
  loadOnlinePromoReports,
  aggregateMonthlyOnlinePromoRecap,
  MonthlyOnlinePromoRecapRow,
} from './onlinePromoService';
import {
  loadMgMarketShareItems,
  loadMgStoreOptions,
  aggregateMonthlyMgRecap,
  aggregatePerStoreMgRecap,
  analyzeMgStoreMarketShare,
  MonthlyMgMarketShareRecapRow,
  PerStoreMgMarketShareRecapRow,
  MgMarketShareAnalyticsResult,
} from './missGlamMarketShareService';
import { loadSalesVisits } from './salesVisitService';
import { loadTrainerVisits } from './trainerVisitService';
import {
  classifyRecordKet,
  resolveRecordMonthAndYear,
  MONTHS_12,
} from './sellInSellOutService';

export interface ExecutiveDayRange {
  startDay?: number;
  endDay?: number;
}

export interface QuarterlyProductMixBar {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  label: string;
  totalValue: number;
  focusValue: number;
  newValue: number;
  regularValue: number;
  focusPct: number;
  newPct: number;
  regularPct: number;
}

export interface MonthlyTrajectoryPoint {
  month: string;
  shortMonth: string;
  monthIndex: number;
  totalValue: number;
  sellInValue: number;
  sellOutValue: number;
  qty: number;
}

export interface RegionalBarItem {
  name: string;
  subLabel: string;
  value: number;
  target: number;
  achievementPct: number;
  sharePct: number;
}

export interface SalesComparisonRow {
  name: string;
  subLabel: string;
  color: string;
  previous: number;
  current: number;
  delta: number;
  growth: number;
  sharePct: number;
  previousSellIn: number;
  currentSellIn: number;
  previousSellOut: number;
  currentSellOut: number;
}

export interface ExecutiveAlertItem {
  id: string;
  severity: 'warning' | 'success' | 'info';
  title: string;
  description: string;
  targetTab: string;
}

export interface MonthlyProfitHrBarItem {
  key: string;
  label: string;
  fullName: string;
  sellIn: number;
  margin: number;
  opsCost: number;
  salaryCost: number;
  totalExpense: number;
  netProfit: number;
  profitPct: number;
  salesCount: number;
  baCount: number;
  trainerCount: number;
  spvCount: number;
  sdmCount: number;
  isCustomEdited: boolean;
  hasData: boolean;
}

export interface MonthlyProfitHrSummary {
  year: number;
  monthlyList: MonthlyProfitHrBarItem[];
  maxProfitItem: MonthlyProfitHrBarItem;
  maxSalaryItem: MonthlyProfitHrBarItem;
  totalYearlySellIn: number;
  totalYearlySalary: number;
  totalYearlyProfit: number;
  avgMonthlyProfit: number;
  avgMonthlySalary: number;
  avgNetMarginPct: number;
  activeMonthCount: number;
}

export interface ExecutiveCoreSnapshot {
  selectedYear: number;
  selectedMonthLabel: string;
  activeDayRangeLabel: string;
  effectiveFilteredCount: number;
  summary: MetricSummary;
  targetTotal: number;
  achievementPercent: number;
  overallGrowthPct: number;
  overallQtyGrowthPct: number;
  previousPeriodLabel: string;
  currentPeriodLabel: string;

  totalSellIn: number;
  totalSellOut: number;
  sellThroughPct: number;
  sellInOutGapPct: number;

  focusValue: number;
  focusPct: number;
  newValue: number;
  newPct: number;
  regularValue: number;
  regularPct: number;
  quarterlyMix: QuarterlyProductMixBar[];

  regionalBars: RegionalBarItem[];
  topSku: DimensionPerformance | null;
  topBrands: { name: string; value: number; sharePct: number; color: string }[];
  brandComparisonRows: {
    name: string;
    color: string;
    previous: number;
    current: number;
    growth: number;
    sharePct: number;
  }[];
  brandComparisonTotals: {
    previous: number;
    current: number;
    growth: number;
  };
  salesComparisonRows: SalesComparisonRow[];
  salesComparisonTotals: {
    previous: number;
    current: number;
    delta: number;
    growth: number;
  };

  monthlyTrajectory: MonthlyTrajectoryPoint[];
  avgMonthlyRevenue: number;
  peakMonth: MonthlyTrajectoryPoint | null;
  projectedYearEnd: number;

  storeBaSummary: StoreBaContributionSummary;
  profitSummary: ProfitAreaSummary;

  totalBillsCount: number;
  unpaidBillsAmount: number;
  overdueBillsCount: number;
  healthyBillsPct: number;

  baIncidentsCount: number;
  baTotalDenda: number;

  promoTotalActual: number;
  promoLatestGrowthPct: number | null;
  promoStoreCount: number;
  promoDaysCount: number;

  mgAvgSharePct: number;
  mgShareDeltaPp: number | null;
  mgActiveStoreCount: number;
  mgTopStore: PerStoreMgMarketShareRecapRow | null;

  salesVisitsCount: number;
  trainerVisitsCount: number;

  targetMatrix: {
    areas: AreaTargetItem[];
    spvs: SpvTargetItem[];
    sales: SalesTargetItem[];
    bas: BaTargetItem[];
    trainers: TrainerTargetItem[];
  };
  gapDiagnosis: SalesGapDiagnosis;
  alerts: ExecutiveAlertItem[];
}

export interface SlowMovingSkuItem {
  name: string;
  brand: string;
  category: string;
  totalValue: number;
  totalQty: number;
  transactionCount: number;
  storeCount: number;
  contributionPercent: number;
}

export interface ProductMixLensData {
  topCategories: CategoryDetailData[];
  topSkus: DimensionPerformance[];
  slowMovingSkus: SlowMovingSkuItem[];
}

export interface MarketShareLensData {
  mgTotalActual: number;
  mgTotalStoreOmset: number;
  mgAvgSharePct: number;
  mgMonthlyRecap: MonthlyMgMarketShareRecapRow[];
  mgPerStoreRecap: PerStoreMgMarketShareRecapRow[];
  mgItems: MissGlamMarketShareItem[];
  mgStoreOptions: string[];
  mgStoreAnalytics: MgMarketShareAnalyticsResult;
}

export interface PromoBaLensData {
  promoMonthlyRecap: MonthlyOnlinePromoRecapRow[];
}

export interface TargetsAlertsLensData {
  productStatusSummary: ProductStatusSummary;
  storeGapDetails: StoreGapDetailItem[];
  totalStoreGapDeficit: number;
  gapPreviousPeriodName: string;
  gapCurrentPeriodName: string;
}

export interface SalesProExecutiveSnapshot extends ExecutiveCoreSnapshot {
  topSkus: DimensionPerformance[];
  slowMovingSkus: SlowMovingSkuItem[];
  topCategories: CategoryDetailData[];
  productStatusSummary: ProductStatusSummary;
  storeBaMonthlyRows: MonthlyStoreBaSellInRow[];
  monthlyProfitHrSummary: MonthlyProfitHrSummary;
  billsList: StoreInvoiceBillItem[];
  baIncidents: BaNihilIncidentRecord[];
  promoMonthlyRecap: MonthlyOnlinePromoRecapRow[];
  mgTotalActual: number;
  mgTotalStoreOmset: number;
  mgMonthlyRecap: MonthlyMgMarketShareRecapRow[];
  mgPerStoreRecap: PerStoreMgMarketShareRecapRow[];
  storeGapDetails: StoreGapDetailItem[];
  totalStoreGapDeficit: number;
  gapPreviousPeriodName: string;
  gapCurrentPeriodName: string;
}

const BRAND_PALETTE = ['#FF6B00', '#2563EB', '#00D2FF', '#F59E0B', '#64748B'];
const SALES_PALETTE = ['#10B981', '#00D2FF', '#FF6B00', '#3B82F6', '#A855F7', '#F59E0B'];
const SHORT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

const FULL_MONTH_LABELS: Record<string, string> = {
  JANUARI: 'Januari',
  FEBRUARI: 'Februari',
  MARET: 'Maret',
  APRIL: 'April',
  MEI: 'Mei',
  JUNI: 'Juni',
  JULI: 'Juli',
  AGUSTUS: 'Agustus',
  SEPTEMBER: 'September',
  OKTOBER: 'Oktober',
  NOVEMBER: 'November',
  DESEMBER: 'Desember',
};

export function normalizeDayRange(dayRange?: ExecutiveDayRange): {
  active: boolean;
  startDay: number;
  endDay: number;
  label: string;
  rangeObj?: { startDay?: number; endDay?: number };
} {
  const hasStart = dayRange?.startDay !== undefined && dayRange.startDay >= 1;
  const hasEnd = dayRange?.endDay !== undefined && dayRange.endDay >= 1;
  if (!hasStart && !hasEnd) {
    return { active: false, startDay: 1, endDay: 31, label: '' };
  }
  let dStart = Math.max(1, Math.min(31, dayRange?.startDay ?? 1));
  let dEnd = Math.max(1, Math.min(31, dayRange?.endDay ?? 31));
  if (dStart > dEnd) {
    [dStart, dEnd] = [dEnd, dStart];
  }
  const label = dStart === dEnd ? `Tgl ${dStart}` : `Tgl ${dStart}–${dEnd}`;
  return {
    active: true,
    startDay: dStart,
    endDay: dEnd,
    label,
    rangeObj: { startDay: dStart, endDay: dEnd },
  };
}

export function filterRecordsByDayRange(
  records: TransactionRecord[],
  dayRange?: ExecutiveDayRange
): TransactionRecord[] {
  const norm = normalizeDayRange(dayRange);
  if (!norm.active) return records;
  const out: TransactionRecord[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const d = getRecordDayOfMonth(r);
    if (d !== null && d >= norm.startDay && d <= norm.endDay) {
      out.push(r);
    }
  }
  return out;
}

export function buildExecutiveCoreSnapshot(
  allRecords: TransactionRecord[],
  filteredRecords: TransactionRecord[],
  filters: DashboardFilters,
  dayRange?: ExecutiveDayRange
): ExecutiveCoreSnapshot {
  const normDay = normalizeDayRange(dayRange);
  const effectiveFilteredRecords = normDay.active
    ? filterRecordsByDayRange(filteredRecords, dayRange)
    : filteredRecords;

  // Resolve Year cleanly in O(n) without spread stack limits
  let selectedYear = 2026;
  if (filters.TAHUN && filters.TAHUN !== 'ALL') {
    const y = Number(filters.TAHUN);
    if (!isNaN(y) && y > 1900) selectedYear = y;
  } else if (effectiveFilteredRecords.length > 0) {
    let maxYear = 0;
    for (let i = 0; i < effectiveFilteredRecords.length; i++) {
      const y = resolveRecordMonthAndYear(effectiveFilteredRecords[i]).year;
      if (y > 1900 && y > maxYear) maxYear = y;
    }
    if (maxYear > 0) selectedYear = maxYear;
  } else if (filteredRecords.length > 0) {
    let maxYear = 0;
    for (let i = 0; i < filteredRecords.length; i++) {
      const y = resolveRecordMonthAndYear(filteredRecords[i]).year;
      if (y > 1900 && y > maxYear) maxYear = y;
    }
    if (maxYear > 0) selectedYear = maxYear;
  }

  const baseMonthLabel =
    filters.BULAN && filters.BULAN !== 'ALL'
      ? `${filters.BULAN.toUpperCase()} ${selectedYear}`
      : `Tahun ${selectedYear} (Semua Bulan)`;
  const selectedMonthLabel = normDay.active
    ? `${baseMonthLabel} · ${normDay.label}`
    : baseMonthLabel;

  // 1. Core Summary & Target Matrix
  const summary = calculateSummary(effectiveFilteredRecords);
  const matrix = aggregateTargetMatrix(effectiveFilteredRecords, filters.BULAN);

  let targetTotal = 0;
  if (filters.KET === 'SELL OUT') {
    if (filters.NAMA_STORE !== 'ALL') {
      targetTotal = matrix.summary.totalBaTarget || matrix.summary.totalSalesTargetSellOut;
    } else if (filters.SALES !== 'ALL') {
      targetTotal = matrix.summary.totalSalesTargetSellOut || matrix.summary.totalBaTarget;
    } else if (filters.REGION !== 'ALL') {
      targetTotal = matrix.summary.totalAreaTargetSellOut || matrix.summary.totalSalesTargetSellOut;
    } else if (filters.SPV !== 'ALL') {
      targetTotal = matrix.summary.totalSpvTargetSellOut || matrix.summary.totalSalesTargetSellOut;
    } else {
      targetTotal = matrix.summary.totalSalesTargetSellOut || matrix.summary.totalBaTarget;
    }
  } else if (filters.SALES !== 'ALL') {
    targetTotal = matrix.summary.totalSalesTarget;
  } else if (filters.REGION !== 'ALL') {
    targetTotal = matrix.summary.totalAreaTarget;
  } else if (filters.SPV !== 'ALL') {
    targetTotal = matrix.summary.totalSpvTarget;
  } else {
    targetTotal =
      matrix.summary.totalSalesTarget > 0
        ? matrix.summary.totalSalesTarget
        : matrix.summary.totalSpvTarget;
  }

  const achievementPercent =
    targetTotal > 0 ? Math.round((summary.totalRevenue / targetTotal) * 1000) / 10 : 0;

  // 2. Growth Comparison (MoM) — respects active dayRange (e.g. Tgl 1-10 OKTOBER vs NOVEMBER)
  const growthComparison = calculateComparisonGrowth(
    allRecords,
    'mom',
    filters,
    normDay.rangeObj
  );
  const overallGrowthPct = growthComparison.overall.growthPercent || 0;
  const prevQty = growthComparison.overall.previousQty || 0;
  const currQty = growthComparison.overall.currentQty || 0;
  const overallQtyGrowthPct =
    prevQty > 0 ? Math.round(((currQty - prevQty) / prevQty) * 1000) / 10 : 0;

  // 3. Single O(n) pass over effectiveFilteredRecords for Sell In/Out, Product Mix & Top SKU
  let totalSellIn = 0;
  let totalSellOut = 0;
  let focusValue = 0;
  let newValue = 0;
  let regularValue = 0;
  const skuAgg = new Map<string, { val: number; qty: number; count: number }>();

  for (let i = 0; i < effectiveFilteredRecords.length; i++) {
    const r = effectiveFilteredRecords[i];
    const val = Number(r.VALUE) || 0;
    const qty = Number(r.QTY) || 0;
    const ket = classifyRecordKet(r.KET);
    if (ket === 'SELL IN') totalSellIn += val;
    else if (ket === 'SELL OUT') totalSellOut += val;

    if (isFocusProduct(r.PRODUK_FOCUS || r)) {
      focusValue += val;
    } else if (isNewProduct(r.PRODUK_NEW || r)) {
      newValue += val;
    } else {
      regularValue += val;
    }

    const skuKey = (r.SKU || '').trim();
    if (skuKey) {
      const existing = skuAgg.get(skuKey);
      if (existing) {
        existing.val += val;
        existing.qty += qty;
        existing.count += 1;
      } else {
        skuAgg.set(skuKey, { val, qty, count: 1 });
      }
    }
  }

  let topSku: DimensionPerformance | null = null;
  let bestSkuVal = -Infinity;
  skuAgg.forEach((v, name) => {
    if (v.val > bestSkuVal) {
      bestSkuVal = v.val;
      topSku = {
        name,
        totalValue: v.val,
        totalQty: v.qty,
        transactionCount: v.count,
        contributionPercent:
          summary.totalRevenue > 0 ? (v.val / summary.totalRevenue) * 100 : 0,
      };
    }
  });

  const mixDenom = Math.max(1, focusValue + newValue + regularValue);
  const focusPct = Math.round((focusValue / mixDenom) * 1000) / 10;
  const newPct = Math.round((newValue / mixDenom) * 1000) / 10;
  const regularPct = Math.max(0, Math.round((100 - focusPct - newPct) * 10) / 10);

  const sellThroughPct =
    totalSellIn > 0 ? Math.round((totalSellOut / totalSellIn) * 1000) / 10 : 0;
  const sellInOutGapPct =
    totalSellIn > 0
      ? Math.round(((totalSellIn - totalSellOut) / totalSellIn) * 1000) / 10
      : 0;

  // 4. Single O(n) pass over allRecords for Quarterly Mix + Monthly Trajectory
  const fSales = filters.SALES !== 'ALL' ? filters.SALES.trim().toUpperCase() : '';
  const fSpv = filters.SPV !== 'ALL' ? filters.SPV.trim().toUpperCase() : '';
  const fRegion = filters.REGION !== 'ALL' ? filters.REGION.trim().toUpperCase() : '';
  const fBrand = filters.BRAND !== 'ALL' ? filters.BRAND.trim().toUpperCase() : '';
  const fKet = filters.KET !== 'ALL' ? filters.KET.trim().toUpperCase() : '';

  const qBuckets: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', { focus: number; newVal: number; reg: number }> = {
    Q1: { focus: 0, newVal: 0, reg: 0 },
    Q2: { focus: 0, newVal: 0, reg: 0 },
    Q3: { focus: 0, newVal: 0, reg: 0 },
    Q4: { focus: 0, newVal: 0, reg: 0 },
  };
  const monthBuckets = MONTHS_12.map(() => ({ val: 0, sellIn: 0, sellOut: 0, qty: 0 }));
  const monthIndexMap = new Map<string, number>();
  MONTHS_12.forEach((m, idx) => monthIndexMap.set(m, idx));

  for (let i = 0; i < allRecords.length; i++) {
    const r = allRecords[i];
    if (fSales && (r.SALES || '').trim().toUpperCase() !== fSales) continue;
    if (fSpv && (r.SPV || '').trim().toUpperCase() !== fSpv) continue;
    if (fRegion && (r.REGION || '').trim().toUpperCase() !== fRegion) continue;
    if (fBrand && (r.BRAND || '').trim().toUpperCase() !== fBrand) continue;
    if (fKet && (r.KET || '').trim().toUpperCase() !== fKet) continue;
    if (normDay.active) {
      const d = getRecordDayOfMonth(r);
      if (d === null || d < normDay.startDay || d > normDay.endDay) continue;
    }

    const { year, month } = resolveRecordMonthAndYear(r);
    if (year > 0 && year !== selectedYear) continue;
    const mIdx = monthIndexMap.get(month);
    if (mIdx === undefined) continue;

    const val = Number(r.VALUE) || 0;
    const qty = Number(r.QTY) || 0;

    // Quarterly Mix accumulation
    const qKey: 'Q1' | 'Q2' | 'Q3' | 'Q4' =
      mIdx <= 2 ? 'Q1' : mIdx <= 5 ? 'Q2' : mIdx <= 8 ? 'Q3' : 'Q4';
    if (isFocusProduct(r.PRODUK_FOCUS || r)) qBuckets[qKey].focus += val;
    else if (isNewProduct(r.PRODUK_NEW || r)) qBuckets[qKey].newVal += val;
    else qBuckets[qKey].reg += val;

    // Monthly Trajectory accumulation
    const mb = monthBuckets[mIdx];
    mb.val += val;
    mb.qty += qty;
    const ket = classifyRecordKet(r.KET);
    if (ket === 'SELL IN') mb.sellIn += val;
    else if (ket === 'SELL OUT') mb.sellOut += val;
  }

  const quarterlyMix: QuarterlyProductMixBar[] = (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
    const b = qBuckets[q];
    const total = b.focus + b.newVal + b.reg;
    const fPct = total > 0 ? Math.round((b.focus / total) * 100) : 0;
    const nPct = total > 0 ? Math.round((b.newVal / total) * 100) : 0;
    const rPct = total > 0 ? Math.max(0, 100 - fPct - nPct) : 0;
    return {
      quarter: q,
      label: `${q} ${selectedYear}`,
      totalValue: total,
      focusValue: b.focus,
      newValue: b.newVal,
      regularValue: b.reg,
      focusPct: fPct,
      newPct: nPct,
      regularPct: rPct,
    };
  });

  const allMonthlyTrajectory: MonthlyTrajectoryPoint[] = MONTHS_12.map((m, idx) => {
    const b = monthBuckets[idx];
    return {
      month: m,
      shortMonth: SHORT_MONTHS[idx] || m.slice(0, 3),
      monthIndex: idx,
      totalValue: b.val,
      sellInValue: b.sellIn,
      sellOutValue: b.sellOut,
      qty: b.qty,
    };
  });

  const activeMonthsTrajectory = allMonthlyTrajectory.filter((m) => m.totalValue > 0);
  const monthlyTrajectory =
    activeMonthsTrajectory.length > 0 ? activeMonthsTrajectory : allMonthlyTrajectory;
  const totalYearTrajectory = activeMonthsTrajectory.reduce((s, m) => s + m.totalValue, 0);
  const avgMonthlyRevenue =
    activeMonthsTrajectory.length > 0
      ? Math.round(totalYearTrajectory / activeMonthsTrajectory.length)
      : 0;
  let peakMonth: MonthlyTrajectoryPoint | null = null;
  for (let i = 0; i < activeMonthsTrajectory.length; i++) {
    if (!peakMonth || activeMonthsTrajectory[i].totalValue > peakMonth.totalValue) {
      peakMonth = activeMonthsTrajectory[i];
    }
  }
  const projectedYearEnd =
    avgMonthlyRevenue > 0 ? avgMonthlyRevenue * 12 : summary.totalRevenue;

  // 5. Sales Bars & Top Brands
  const salesPerfList = aggregateByDimension(effectiveFilteredRecords, 'SALES');
  const rawBrands = aggregateByDimension(effectiveFilteredRecords, 'BRAND');

  const salesTargetLookup = new Map<string, SalesTargetItem>();
  matrix.sales.forEach((s) => salesTargetLookup.set(s.salesName.trim().toUpperCase(), s));

  const validSalesPerf = salesPerfList.filter((s) => {
    const upper = s.name.trim().toUpperCase();
    return upper && upper !== 'N/A' && upper !== '-' && upper !== 'NONE';
  });
  const baseSalesList = validSalesPerf.length > 0 ? validSalesPerf : salesPerfList;

  const regionalBars: RegionalBarItem[] = baseSalesList
    .map((s) => {
      const tItem = salesTargetLookup.get(s.name.trim().toUpperCase());
      const target =
        filters.KET === 'SELL OUT'
          ? tItem?.targetSellOut || s.target || Math.max(1, s.totalValue)
          : tItem?.targetSellIn || s.target || Math.max(1, s.totalValue);
      const rawAch = target > 0 ? (s.totalValue / target) * 100 : 0;
      const ach = Math.round(rawAch * 10) / 10;
      return {
        name: s.name,
        subLabel: tItem?.coverArea || 'Sales Area',
        value: s.totalValue,
        target,
        achievementPct: ach,
        sharePct: Math.round(s.contributionPercent * 10) / 10,
        _rawAch: rawAch,
      };
    })
    .sort((a, b) => {
      if (b._rawAch !== a._rawAch) return b._rawAch - a._rawAch;
      return b.value - a.value;
    })
    .slice(0, 5)
    .map(({ _rawAch: _ignored, ...rest }) => rest);

  // 6. Top Brand Share (Top 4 + Lainnya)
  const brandTotal = rawBrands.reduce((acc, b) => acc + Math.max(0, b.totalValue), 0);
  const top4Brands = rawBrands.slice(0, 4).map((b, idx) => ({
    name: b.name,
    value: b.totalValue,
    sharePct: brandTotal > 0 ? Math.round((b.totalValue / brandTotal) * 1000) / 10 : 0,
    color: BRAND_PALETTE[idx % BRAND_PALETTE.length],
  }));
  if (rawBrands.length > 4) {
    const othersVal = rawBrands.slice(4).reduce((sum, b) => sum + b.totalValue, 0);
    const othersPct = brandTotal > 0 ? Math.round((othersVal / brandTotal) * 1000) / 10 : 0;
    top4Brands.push({
      name: 'Brand Lainnya',
      value: othersVal,
      sharePct: othersPct,
      color: BRAND_PALETTE[4],
    });
  }

  // 7. Brand MoM Comparison Table
  const compBrands = growthComparison.byBrand || [];
  const totalCurBrands = compBrands.reduce((s, b) => s + b.current, 0);
  const totalPrevBrands = compBrands.reduce((s, b) => s + b.previous, 0);
  const brandComparisonRows = compBrands.slice(0, 5).map((b, idx) => ({
    name: b.name,
    color: BRAND_PALETTE[idx % BRAND_PALETTE.length],
    previous: b.previous,
    current: b.current,
    growth: Math.round(b.growth * 10) / 10,
    sharePct:
      totalCurBrands > 0 ? Math.round((b.current / totalCurBrands) * 1000) / 10 : 0,
  }));
  const portfolioGrowth =
    totalPrevBrands > 0
      ? Math.round(((totalCurBrands - totalPrevBrands) / totalPrevBrands) * 1000) / 10
      : 0;

  // 7B. Perbandingan Performa Sales (MoM) — e.g. OKTOBER 2026 vs NOVEMBER 2026
  const compSales = (growthComparison.bySales || []).filter((s) => {
    const upper = s.name.trim().toUpperCase();
    return upper && upper !== 'N/A' && upper !== '-' && upper !== 'NONE' && upper !== 'TIDAK DIKETAHUI';
  });
  const totalCurSales = compSales.reduce((s, item) => s + item.current, 0);
  const totalPrevSales = compSales.reduce((s, item) => s + item.previous, 0);
  const totalDeltaSales = totalCurSales - totalPrevSales;
  const totalGrowthSales =
    totalPrevSales !== 0
      ? Math.round((totalDeltaSales / Math.abs(totalPrevSales)) * 1000) / 10
      : totalCurSales > 0
      ? 100
      : 0;

  const salesComparisonRows: SalesComparisonRow[] = compSales.map((s, idx) => {
    const tItem = salesTargetLookup.get(s.name.trim().toUpperCase());
    return {
      name: s.name,
      subLabel: tItem?.coverArea || 'Sales Area',
      color: SALES_PALETTE[idx % SALES_PALETTE.length],
      previous: s.previous,
      current: s.current,
      delta: s.delta,
      growth: Math.round(s.growth * 10) / 10,
      sharePct:
        totalCurSales > 0 ? Math.round((s.current / totalCurSales) * 1000) / 10 : 0,
      previousSellIn: s.previousSellIn || 0,
      currentSellIn: s.currentSellIn || 0,
      previousSellOut: s.previousSellOut || 0,
      currentSellOut: s.currentSellOut || 0,
    };
  });

  // 8. Store BA vs Non-BA Summary (Sell In — fast summary only; 12-mo table is lazy-loaded)
  const { summary: storeBaSummary } = calculateStoreBaContribution(
    normDay.active ? filterRecordsByDayRange(allRecords, dayRange) : allRecords,
    filters.BULAN === 'ALL' ? 'ALL' : filters.BULAN,
    selectedYear,
    filters.REGION === 'ALL' ? 'ALL' : filters.REGION,
    filters
  );

  // 9. Profit Area Summary
  // Jika filter BULAN === 'ALL' (Semua Bulan), akumulasikan P&L + Gaji SDM per bulan (Jan-Des)
  // agar total beban gaji bulanan dan Sisa Profit Bersih tepat & sama persis dengan Total Profit Tahunan.
  const normMonthKey =
    filters.BULAN && filters.BULAN !== 'ALL' ? filters.BULAN.toUpperCase() : 'ALL';
  const trainerConfigs = loadTrainerConfigs();
  let profitSummary: ProfitAreaSummary;

  if (normMonthKey === 'ALL') {
    const canApplyOverrides = canApplyMonthlyPnlOverrides(filters, dayRange);
    const savedPnlOverrides = canApplyOverrides ? loadSavedMonthlyPnlOverrides() : {};
    const monthBuckets = new Map<string, TransactionRecord[]>();
    MONTHS_12.forEach((m) => monthBuckets.set(m, []));
    const unmappedRecs: TransactionRecord[] = [];

    for (let i = 0; i < effectiveFilteredRecords.length; i++) {
      const r = effectiveFilteredRecords[i];
      const mKey = resolveRecordMonthAndYear(r).month || (r.BULAN || '').trim().toUpperCase();
      const arr = monthBuckets.get(mKey);
      if (arr) arr.push(r);
      else unmappedRecs.push(r);
    }

    const entries: MonthlyProfitSummaryEntry[] = MONTHS_12.map((mKey) => {
      const mRecs = monthBuckets.get(mKey) || [];
      const summaryForMonth =
        mRecs.length > 0
          ? calculateProfitArea(
              mRecs,
              0.55,
              0.33,
              loadSalesTargets(mKey),
              loadBaNonLavojoyTargets(mKey),
              loadBaLavojoyTargets(mKey),
              {},
              {},
              DEFAULT_SALES_TARGET,
              DEFAULT_BA_NON_LAVOJOY_TARGET,
              DEFAULT_BA_LAVOJOY_TARGET,
              undefined,
              trainerConfigs,
              loadTrainerTargets(mKey),
              `${mKey} ${selectedYear}`,
              loadBaFocusTargets(mKey)
            )
          : null;
      return {
        monthKey: mKey,
        summary: summaryForMonth,
        override: canApplyOverrides ? savedPnlOverrides[mKey] : undefined,
      };
    });

    if (unmappedRecs.length > 0) {
      entries.push({
        monthKey: 'LAINNYA',
        summary: calculateProfitArea(
          unmappedRecs,
          0.55,
          0.33,
          loadSalesTargets('ALL'),
          loadBaNonLavojoyTargets('ALL'),
          loadBaLavojoyTargets('ALL'),
          {},
          {},
          DEFAULT_SALES_TARGET,
          DEFAULT_BA_NON_LAVOJOY_TARGET,
          DEFAULT_BA_LAVOJOY_TARGET,
          undefined,
          trainerConfigs,
          loadTrainerTargets('ALL'),
          `NOVEMBER ${selectedYear}`,
          loadBaFocusTargets('ALL')
        ),
      });
    }

    profitSummary = combineMonthlyProfitAreaSummaries(entries, 0.55, 0.33);
  } else {
    profitSummary = calculateProfitArea(
      effectiveFilteredRecords,
      0.55,
      0.33,
      loadSalesTargets(normMonthKey),
      loadBaNonLavojoyTargets(normMonthKey),
      loadBaLavojoyTargets(normMonthKey),
      {},
      {},
      DEFAULT_SALES_TARGET,
      DEFAULT_BA_NON_LAVOJOY_TARGET,
      DEFAULT_BA_LAVOJOY_TARGET,
      undefined,
      trainerConfigs,
      loadTrainerTargets(normMonthKey),
      `${normMonthKey} ${selectedYear}`,
      loadBaFocusTargets(normMonthKey)
    );
  }

  // 10. Aging Piutang & Tagihan (lightweight summary scalars)
  const billsList = loadStoreBillsWithRecords(allRecords);
  let unpaidBillsAmount = 0;
  let overdueBillsCount = 0;
  for (let i = 0; i < billsList.length; i++) {
    const b = billsList[i];
    if (!b.isPaid) {
      unpaidBillsAmount += b.amount || 0;
      if (b.agingDays > 30) overdueBillsCount += 1;
    }
  }
  const healthyBillsPct =
    billsList.length > 0
      ? Math.round(((billsList.length - overdueBillsCount) / billsList.length) * 1000) / 10
      : 100;

  // 11. BA Punishment scalars
  const baIncidents = loadBaIncidents();
  let baIncidentsCount = 0;
  let baTotalDenda = 0;
  for (let i = 0; i < baIncidents.length; i++) {
    const inc = baIncidents[i];
    if (!inc.isDispensation && !inc.isOffDay) {
      baIncidentsCount += 1;
      baTotalDenda +=
        inc.customDendaNominal !== undefined
          ? inc.customDendaNominal
          : inc.dendaNominal || 25000;
    }
  }

  // 12. Online Promo Toko scalars
  const promoItems = loadOnlinePromoReports();
  const promoMonthlyRecap = aggregateMonthlyOnlinePromoRecap(promoItems);
  let promoTotalActual = 0;
  const promoStores = new Set<string>();
  const promoDates = new Set<string>();
  for (let i = 0; i < promoItems.length; i++) {
    const p = promoItems[i];
    promoTotalActual += Number(p.actual) || 0;
    if (p.storeName) promoStores.add(p.storeName.trim().toUpperCase());
    if (p.date && p.date.trim()) promoDates.add(p.date.trim());
  }
  const latestPromoRow =
    promoMonthlyRecap.length > 0 ? promoMonthlyRecap[promoMonthlyRecap.length - 1] : null;
  const promoLatestGrowthPct =
    latestPromoRow && latestPromoRow.growthPercent !== null
      ? Math.round(latestPromoRow.growthPercent * 10) / 10
      : null;

  // 13. Market Share MissGlam scalars
  const mgItems = loadMgMarketShareItems();
  const mgStoreOptions = loadMgStoreOptions();
  const mgMonthlyRecap = aggregateMonthlyMgRecap(mgItems);
  const mgPerStoreRecap = aggregatePerStoreMgRecap(mgItems, mgStoreOptions, 'ALL');
  let mgTotalActual = 0;
  let mgTotalStoreOmset = 0;
  for (let i = 0; i < mgItems.length; i++) {
    mgTotalActual += Number(mgItems[i].actual) || 0;
    mgTotalStoreOmset += Number(mgItems[i].storeOmset) || 0;
  }
  const mgAvgSharePct =
    mgTotalStoreOmset > 0
      ? Math.round((mgTotalActual / mgTotalStoreOmset) * 1000) / 10
      : 0;
  const mgShareDeltaPp =
    mgMonthlyRecap.length >= 2
      ? Math.round(
          (mgMonthlyRecap[0].marketSharePercent - mgMonthlyRecap[1].marketSharePercent) * 10
        ) / 10
      : null;
  const mgActiveStores = mgPerStoreRecap.filter((s) => s.entryCount > 0);
  const mgTopStore = mgActiveStores.length > 0 ? mgActiveStores[0] : null;

  // 14. Visits counts (skip heavy recap aggregations)
  const salesVisitsCount = loadSalesVisits().length;
  const trainerVisitsCount = loadTrainerVisits().length;

  // 15. Gap Diagnosis (single call; storeGapDetails is lazy-loaded in Targets & Gap lens)
  const gapDiagnosis = diagnoseSalesGap(allRecords, effectiveFilteredRecords, filters);

  // 16. Intelligence Alerts
  const alerts: ExecutiveAlertItem[] = [];
  if (gapDiagnosis.gapDeficit > 0) {
    alerts.push({
      id: 'alert-gap',
      severity: 'warning',
      title: `Gap Defisit Target: -${Math.round(gapDiagnosis.gapPercentage)}%`,
      description: `${gapDiagnosis.lostStoresCount} toko pasif / de-stocking memengaruhi pencapaian.`,
      targetTab: 'gap',
    });
  } else if (overdueBillsCount > 0) {
    alerts.push({
      id: 'alert-aging',
      severity: 'warning',
      title: `${overdueBillsCount} Tagihan Toko > 30 Hari`,
      description: `Total tagihan belum lunas membutuhkan tindak lanjut tim sales.`,
      targetTab: 'aging',
    });
  } else {
    alerts.push({
      id: 'alert-sellin-out',
      severity: 'info',
      title: `Rasio Sell Out / Sell In: ${sellThroughPct}%`,
      description: `Monitoring pergerakan stok Sell In ke Sell Out di seluruh gerai.`,
      targetTab: 'sell_in_vs_sell_out',
    });
  }

  const topBrand = top4Brands[0];
  if (topBrand && topBrand.value > 0) {
    alerts.push({
      id: 'alert-top-brand',
      severity: 'success',
      title: `Top Brand: ${topBrand.name} (${topBrand.sharePct}%)`,
      description:
        storeBaSummary.tokoBaCount > 0
          ? `Toko Ada BA (${storeBaSummary.totalBaCount} BA) berkontribusi ${storeBaSummary.tokoBaRevenuePercent}% Sell In.`
          : `Memimpin kontribusi penjualan pada periode ${selectedMonthLabel}.`,
      targetTab: 'kontribusi_toko_ba',
    });
  }

  return {
    selectedYear,
    selectedMonthLabel,
    activeDayRangeLabel: normDay.label,
    effectiveFilteredCount: effectiveFilteredRecords.length,
    summary,
    targetTotal,
    achievementPercent,
    overallGrowthPct: Math.round(overallGrowthPct * 10) / 10,
    overallQtyGrowthPct,
    previousPeriodLabel: growthComparison.previousPeriodLabel,
    currentPeriodLabel: growthComparison.currentPeriodLabel,

    totalSellIn,
    totalSellOut,
    sellThroughPct,
    sellInOutGapPct,

    focusValue,
    focusPct,
    newValue,
    newPct,
    regularValue,
    regularPct,
    quarterlyMix,

    regionalBars,
    topSku,
    topBrands: top4Brands,
    brandComparisonRows,
    brandComparisonTotals: {
      previous: totalPrevBrands,
      current: totalCurBrands,
      growth: portfolioGrowth,
    },
    salesComparisonRows,
    salesComparisonTotals: {
      previous: totalPrevSales,
      current: totalCurSales,
      delta: totalDeltaSales,
      growth: totalGrowthSales,
    },

    monthlyTrajectory,
    avgMonthlyRevenue,
    peakMonth,
    projectedYearEnd,

    storeBaSummary,
    profitSummary,

    totalBillsCount: billsList.length,
    unpaidBillsAmount,
    overdueBillsCount,
    healthyBillsPct,

    baIncidentsCount,
    baTotalDenda,

    promoTotalActual,
    promoLatestGrowthPct,
    promoStoreCount: promoStores.size,
    promoDaysCount: promoDates.size,

    mgAvgSharePct,
    mgShareDeltaPp,
    mgActiveStoreCount: mgActiveStores.length,
    mgTopStore,

    salesVisitsCount,
    trainerVisitsCount,

    targetMatrix: {
      areas: matrix.areas,
      spvs: matrix.spvs,
      sales: matrix.sales,
      bas: matrix.bas,
      trainers: matrix.trainers,
    },
    gapDiagnosis,
    alerts,
  };
}

// =========================================================================
// LAZY LENS-SCOPED BUILDERS (Executed ONLY when that sub-menu is active!)
// =========================================================================

export function buildMarketShareLensData(): MarketShareLensData {
  const mgItems = loadMgMarketShareItems();
  const mgStoreOptions = loadMgStoreOptions();
  const mgMonthlyRecap = aggregateMonthlyMgRecap(mgItems);
  const mgPerStoreRecap = aggregatePerStoreMgRecap(mgItems, mgStoreOptions, 'ALL');
  const mgStoreAnalytics = analyzeMgStoreMarketShare(mgItems, mgStoreOptions);
  let mgTotalActual = 0;
  let mgTotalStoreOmset = 0;
  for (let i = 0; i < mgItems.length; i++) {
    mgTotalActual += Number(mgItems[i].actual) || 0;
    mgTotalStoreOmset += Number(mgItems[i].storeOmset) || 0;
  }
  const mgAvgSharePct =
    mgTotalStoreOmset > 0
      ? Math.round((mgTotalActual / mgTotalStoreOmset) * 1000) / 10
      : 0;
  return {
    mgTotalActual,
    mgTotalStoreOmset,
    mgAvgSharePct,
    mgMonthlyRecap,
    mgPerStoreRecap,
    mgItems,
    mgStoreOptions,
    mgStoreAnalytics,
  };
}

const DASHBOARD_TOP_CATEGORIES = [
  'MAKEUP',
  'PERSONAL CARE',
  'SKIN CARE',
  'TOOLS',
  'HUED',
] as const;

type DashboardTopCategory = (typeof DASHBOARD_TOP_CATEGORIES)[number];

function mapRecordToDashboardTopCategory(r: TransactionRecord): DashboardTopCategory | null {
  const rawCat = String(r.KATEGORI || '').trim().toUpperCase();
  const rawBrand = String(r.BRAND || '').trim().toUpperCase();

  if (rawCat === 'HUED') return 'HUED';
  if (rawCat === 'MAKEUP' || rawCat === 'MAKE UP') return 'MAKEUP';
  if (rawCat === 'PERSONAL CARE' || rawCat === 'PERSONALCARE') return 'PERSONAL CARE';
  if (rawCat === 'SKIN CARE' || rawCat === 'SKINCARE') return 'SKIN CARE';
  if (rawCat === 'TOOLS' || rawCat === 'TOOL' || rawCat === 'BEAUTY TOOLS') return 'TOOLS';

  // Map internal auto-detected sub-categories (e.g., demo/offline records) to the 5 main categories
  if (
    rawCat === 'LIP MAKEUP' ||
    rawCat === 'FACE MAKEUP' ||
    rawCat === 'COMPLEXION & POWDER' ||
    rawCat === 'EYE MAKEUP'
  ) {
    return rawBrand === 'HUED' ? 'HUED' : 'MAKEUP';
  }
  if (rawCat === 'BODY CARE' || rawCat === 'HAIR CARE') {
    return 'PERSONAL CARE';
  }
  if (rawCat === 'SUNSCREEN') {
    return 'SKIN CARE';
  }
  if (rawCat === 'EYE & LASH TOOLS') {
    return 'TOOLS';
  }

  // If explicit category column from Google Sheet is empty, infer via brand/SKU
  if (!rawCat) {
    if (rawBrand === 'HUED') return 'HUED';
    const inferred = detectCategoryFromSku(r.SKU, r.BRAND).toUpperCase();
    if (inferred === 'BODY CARE' || inferred === 'HAIR CARE') return 'PERSONAL CARE';
    if (inferred === 'SKINCARE' || inferred === 'SUNSCREEN') return 'SKIN CARE';
    if (inferred === 'EYE & LASH TOOLS') return 'TOOLS';
    return 'MAKEUP';
  }

  // Any other explicit category (e.g. GIFT, TESTER, POSM, LAINNYA, etc.) is excluded
  return null;
}

export function buildProductMixLensData(
  filteredRecords: TransactionRecord[],
  dayRange?: ExecutiveDayRange
): ProductMixLensData {
  const effective = filterRecordsByDayRange(filteredRecords, dayRange);

  // 1. Strictly aggregate the 5 requested Top Kategori Produk
  const catBuckets: Record<
    DashboardTopCategory,
    {
      totalValue: number;
      totalQty: number;
      txCount: number;
      returnValue: number;
      focusValue: number;
      regularValue: number;
      brands: Record<string, { value: number; qty: number }>;
      skus: Record<string, { sku: string; brand: string; value: number; qty: number }>;
      stores: Set<string>;
    }
  > = {
    MAKEUP: {
      totalValue: 0,
      totalQty: 0,
      txCount: 0,
      returnValue: 0,
      focusValue: 0,
      regularValue: 0,
      brands: {},
      skus: {},
      stores: new Set(),
    },
    'PERSONAL CARE': {
      totalValue: 0,
      totalQty: 0,
      txCount: 0,
      returnValue: 0,
      focusValue: 0,
      regularValue: 0,
      brands: {},
      skus: {},
      stores: new Set(),
    },
    'SKIN CARE': {
      totalValue: 0,
      totalQty: 0,
      txCount: 0,
      returnValue: 0,
      focusValue: 0,
      regularValue: 0,
      brands: {},
      skus: {},
      stores: new Set(),
    },
    TOOLS: {
      totalValue: 0,
      totalQty: 0,
      txCount: 0,
      returnValue: 0,
      focusValue: 0,
      regularValue: 0,
      brands: {},
      skus: {},
      stores: new Set(),
    },
    HUED: {
      totalValue: 0,
      totalQty: 0,
      txCount: 0,
      returnValue: 0,
      focusValue: 0,
      regularValue: 0,
      brands: {},
      skus: {},
      stores: new Set(),
    },
  };

  let fiveCatTotalValue = 0;

  // 2. Simultaneously aggregate per-SKU movement for Top 10 & Slow Moving 10
  const skuMap: Record<
    string,
    {
      totalValue: number;
      totalQty: number;
      txCount: number;
      brands: Record<string, number>;
      categories: Record<string, number>;
      stores: Set<string>;
    }
  > = {};
  let totalSkuPositiveValue = 0;

  for (let i = 0; i < effective.length; i++) {
    const r = effective[i];
    const val = r.VALUE || 0;
    const qty = r.QTY || 0;
    const mappedCat = mapRecordToDashboardTopCategory(r);

    if (mappedCat) {
      const bucket = catBuckets[mappedCat];
      bucket.totalValue += val;
      bucket.totalQty += qty;
      bucket.txCount += 1;
      fiveCatTotalValue += val;
      if (r.NAMA_STORE) bucket.stores.add(r.NAMA_STORE);
      if (val < 0 || r.KET === 'RETURN') {
        bucket.returnValue += Math.abs(val);
      }
      if (isFocusProduct(r.PRODUK_FOCUS || r)) {
        bucket.focusValue += val;
      } else {
        bucket.regularValue += val;
      }
      const brandKey = r.BRAND || 'LAINNYA';
      if (!bucket.brands[brandKey]) {
        bucket.brands[brandKey] = { value: 0, qty: 0 };
      }
      bucket.brands[brandKey].value += val;
      bucket.brands[brandKey].qty += qty;

      const catSkuKey = r.SKU || r.SPU || r.NO_SKU;
      if (catSkuKey) {
        if (!bucket.skus[catSkuKey]) {
          bucket.skus[catSkuKey] = { sku: catSkuKey, brand: brandKey, value: 0, qty: 0 };
        }
        bucket.skus[catSkuKey].value += val;
        bucket.skus[catSkuKey].qty += qty;
      }
    }

    const skuName = String(r.SKU || '').trim();
    if (skuName && skuName.toUpperCase() !== 'N/A') {
      if (!skuMap[skuName]) {
        skuMap[skuName] = {
          totalValue: 0,
          totalQty: 0,
          txCount: 0,
          brands: {},
          categories: {},
          stores: new Set(),
        };
      }
      const sk = skuMap[skuName];
      sk.totalValue += val;
      sk.totalQty += qty;
      sk.txCount += 1;
      if (r.NAMA_STORE) sk.stores.add(r.NAMA_STORE);
      const bKey = String(r.BRAND || '-').trim();
      sk.brands[bKey] = (sk.brands[bKey] || 0) + Math.max(0, val);
      const cKey = mappedCat || String(r.KATEGORI || '-').trim().toUpperCase();
      sk.categories[cKey] = (sk.categories[cKey] || 0) + Math.max(0, val);
      if (val > 0) totalSkuPositiveValue += val;
    }
  }

  const topCategories: CategoryDetailData[] = DASHBOARD_TOP_CATEGORIES.map((cat) => {
    const item = catBuckets[cat];
    const contributionPercent =
      fiveCatTotalValue > 0 ? (item.totalValue / fiveCatTotalValue) * 100 : 0;
    const avgPrice = item.totalQty > 0 ? item.totalValue / item.totalQty : 0;
    const grossVal = item.totalValue + item.returnValue;
    const returnRate = grossVal > 0 ? (item.returnValue / grossVal) * 100 : 0;
    const focusPercent = item.totalValue > 0 ? (item.focusValue / item.totalValue) * 100 : 0;

    const brandBreakdown = Object.entries(item.brands)
      .map(([brand, bData]) => ({
        brand,
        value: bData.value,
        qty: bData.qty,
        percent: item.totalValue > 0 ? (bData.value / item.totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const topCatSkus = Object.values(item.skus)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      category: cat,
      totalValue: item.totalValue,
      totalQty: item.totalQty,
      txCount: item.txCount,
      contributionPercent,
      avgPrice,
      brandBreakdown,
      focusValue: item.focusValue,
      focusPercent,
      regularValue: item.regularValue,
      topSkus: topCatSkus,
      storeCount: item.stores.size,
      returnValue: item.returnValue,
      returnRate,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const topSkus = aggregateByDimension(effective, 'SKU').slice(0, 15);
  const top10Set = new Set(topSkus.slice(0, 10).map((s) => s.name.trim()));

  const nonSellablePattern = /\b(GIFT|FREEBIE|FREE\b|TESTER|SAMPLE|POSM|DISPLAY|GWP|PAPER\s*BAG|VOUCHER|POUCH)\b/i;

  const allSlowCandidates: SlowMovingSkuItem[] = Object.entries(skuMap)
    .filter(([, data]) => data.totalQty > 0 && data.totalValue > 0)
    .map(([name, data]) => {
      const primaryBrand =
        Object.entries(data.brands).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      const primaryCat =
        Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      const contributionPercent =
        totalSkuPositiveValue > 0 ? (data.totalValue / totalSkuPositiveValue) * 100 : 0;
      return {
        name,
        brand: primaryBrand,
        category: primaryCat,
        totalValue: data.totalValue,
        totalQty: data.totalQty,
        transactionCount: data.txCount,
        storeCount: data.stores.size,
        contributionPercent,
      };
    });

  const cleanCandidates = allSlowCandidates.filter(
    (s) => !nonSellablePattern.test(s.name) && !top10Set.has(s.name)
  );
  const pool =
    cleanCandidates.length >= 10
      ? cleanCandidates
      : allSlowCandidates.filter((s) => !top10Set.has(s.name)).length >= 10
      ? allSlowCandidates.filter((s) => !top10Set.has(s.name))
      : allSlowCandidates;

  const slowMovingSkus = [...pool]
    .sort((a, b) => {
      if (a.totalQty !== b.totalQty) return a.totalQty - b.totalQty;
      if (a.totalValue !== b.totalValue) return a.totalValue - b.totalValue;
      if (a.transactionCount !== b.transactionCount) {
        return a.transactionCount - b.transactionCount;
      }
      return a.storeCount - b.storeCount;
    })
    .slice(0, 10);

  return {
    topCategories,
    topSkus,
    slowMovingSkus,
  };
}

export function buildChannelGrowthLensData(
  allRecords: TransactionRecord[],
  selectedYear: number,
  filters: DashboardFilters,
  dayRange?: ExecutiveDayRange
): MonthlyStoreBaSellInRow[] {
  const norm = normalizeDayRange(dayRange);
  const scopedRecords = norm.active
    ? filterRecordsByDayRange(allRecords, dayRange)
    : allRecords;
  const { months } = calculateMonthlyStoreBaSellInContribution(
    scopedRecords,
    selectedYear,
    filters.REGION === 'ALL' ? 'ALL' : filters.REGION,
    filters
  );
  return months;
}

export function buildPromoBaLensData(): PromoBaLensData {
  const promoItems = loadOnlinePromoReports();
  return {
    promoMonthlyRecap: aggregateMonthlyOnlinePromoRecap(promoItems),
  };
}

type StoredMonthlyPnlOverride = MonthlyProfitOverrideInput & {
  salesCount?: number;
  baCount?: number;
  trainerCount?: number;
  spvCount?: number;
  sdmCount?: number;
};

function loadSavedMonthlyPnlOverrides(): Record<string, StoredMonthlyPnlOverride> {
  try {
    const rawOv = localStorage.getItem('salespro_monthly_pnl_overrides_v2');
    return rawOv ? JSON.parse(rawOv) : {};
  } catch {
    return {};
  }
}

function canApplyMonthlyPnlOverrides(
  filters: DashboardFilters,
  dayRange?: ExecutiveDayRange
): boolean {
  if (normalizeDayRange(dayRange).active) return false;
  return (
    filters.SALES === 'ALL' &&
    (!filters.TRAINER || filters.TRAINER === 'ALL') &&
    filters.SPV === 'ALL' &&
    filters.REGION === 'ALL' &&
    filters.BRAND === 'ALL' &&
    (!filters.KATEGORI || filters.KATEGORI === 'ALL') &&
    (!filters.STATUS_PRODUK || filters.STATUS_PRODUK === 'ALL') &&
    filters.NAMA_STORE === 'ALL' &&
    filters.SKU === 'ALL' &&
    (!filters.KET || filters.KET === 'ALL') &&
    (!filters.searchQuery || !filters.searchQuery.trim())
  );
}

export function buildMonthlyProfitHrSummary(
  allRecords: TransactionRecord[],
  filters: DashboardFilters,
  selectedYear: number,
  dayRange?: ExecutiveDayRange
): MonthlyProfitHrSummary {
  const canApplyOverrides = canApplyMonthlyPnlOverrides(filters, dayRange);
  const savedPnlOverrides = canApplyOverrides ? loadSavedMonthlyPnlOverrides() : {};

  const nonMonthBase = filterRecords(allRecords, {
    ...filters,
    BULAN: 'ALL',
    TAHUN: filters.TAHUN !== 'ALL' ? String(filters.TAHUN).trim() : 'ALL',
  });
  const profitNonMonthFiltered = normalizeDayRange(dayRange).active
    ? filterRecordsByDayRange(nonMonthBase, dayRange)
    : nonMonthBase;

  const monthRecsBucket = new Map<string, TransactionRecord[]>();
  MONTHS_12.forEach((m) => monthRecsBucket.set(m, []));
  for (let i = 0; i < profitNonMonthFiltered.length; i++) {
    const r = profitNonMonthFiltered[i];
    const mKey = resolveRecordMonthAndYear(r).month || (r.BULAN || '').trim().toUpperCase();
    const arr = monthRecsBucket.get(mKey);
    if (arr) arr.push(r);
  }

  const trainerConfigsForMonthly = loadTrainerConfigs();

  const monthlyProfitList: MonthlyProfitHrBarItem[] = MONTHS_12.map((mKey, idx) => {
    const mRecs = monthRecsBucket.get(mKey) || [];
    const mSummary =
      mRecs.length > 0
        ? calculateProfitArea(
            mRecs,
            0.55,
            0.33,
            loadSalesTargets(mKey),
            loadBaNonLavojoyTargets(mKey),
            loadBaLavojoyTargets(mKey),
            undefined,
            undefined,
            DEFAULT_SALES_TARGET,
            DEFAULT_BA_NON_LAVOJOY_TARGET,
            DEFAULT_BA_LAVOJOY_TARGET,
            undefined,
            trainerConfigsForMonthly,
            loadTrainerTargets(mKey),
            `${mKey} ${selectedYear}`,
            loadBaFocusTargets(mKey)
          )
        : null;

    const sheetSellIn = mSummary ? mSummary.sellInActual : 0;
    const ov = canApplyOverrides ? savedPnlOverrides[mKey] || {} : {};
    const sellIn = ov.sellIn !== undefined ? ov.sellIn : sheetSellIn;
    const margin = ov.margin !== undefined ? ov.margin : Math.round(sellIn * 0.55);
    const opsCost = ov.opsCost !== undefined ? ov.opsCost : Math.round(sellIn * 0.33);
    const baseSalaryCost = mSummary ? mSummary.salaryCost : 0;
    const salaryCost = ov.salaryCost !== undefined ? ov.salaryCost : baseSalaryCost;
    const totalExpense = opsCost + salaryCost;
    const netProfit = ov.netProfit !== undefined ? ov.netProfit : margin - totalExpense;
    const profitPct = sellIn > 0 ? (netProfit / sellIn) * 100 : 0;

    const cb = mSummary?.costBreakdown;
    const baseSales = cb ? cb.salesCount : mSummary?.profitBySales?.length || 0;
    const baseBa = cb
      ? cb.baCount
      : mRecs.length > 0
      ? new Set(mRecs.filter((r) => r.BA && r.BA !== '-' && r.NAMA_STORE).map((r) => r.NAMA_STORE)).size
      : 0;
    const baseTrainer = cb
      ? cb.trainerCount ?? 0
      : mSummary && (mSummary.totalTrainerSalary || 0) > 0
      ? trainerConfigsForMonthly.length > 0
        ? Math.min(trainerConfigsForMonthly.length, 2)
        : 2
      : 0;
    const baseSpv =
      mRecs.length > 0
        ? new Set(mRecs.map((r) => r.SPV).filter((s) => s && s !== '-')).size || 1
        : 0;

    const salesCount = ov.salesCount !== undefined ? ov.salesCount : baseSales;
    const baCount = ov.baCount !== undefined ? ov.baCount : baseBa;
    const trainerCount = ov.trainerCount !== undefined ? ov.trainerCount : baseTrainer;
    const spvCount = ov.spvCount !== undefined ? ov.spvCount : baseSpv;
    const sdmCount =
      ov.sdmCount !== undefined
        ? ov.sdmCount
        : salesCount + baCount + trainerCount + spvCount;

    const rawShort = SHORT_MONTHS[idx] || mKey.slice(0, 3);
    const shortCap = rawShort.charAt(0) + rawShort.slice(1).toLowerCase();

    return {
      key: mKey,
      label: shortCap,
      fullName: FULL_MONTH_LABELS[mKey] || mKey,
      sellIn,
      margin,
      opsCost,
      salaryCost,
      totalExpense,
      netProfit,
      profitPct,
      salesCount,
      baCount,
      trainerCount,
      spvCount,
      sdmCount,
      isCustomEdited: Object.keys(ov).length > 0,
      hasData: mRecs.length > 0,
    };
  });

  const activeProfitMonths = monthlyProfitList.filter(
    (d) => d.sellIn > 0 || d.salaryCost > 0 || d.hasData || d.isCustomEdited
  );
  const profitPool = activeProfitMonths.length > 0 ? activeProfitMonths : monthlyProfitList;
  let maxProfitItem = profitPool[0];
  let maxSalaryItem = profitPool[0];
  for (let i = 0; i < profitPool.length; i++) {
    if (profitPool[i].netProfit > maxProfitItem.netProfit) maxProfitItem = profitPool[i];
    if (profitPool[i].salaryCost > maxSalaryItem.salaryCost) maxSalaryItem = profitPool[i];
  }
  const totalYearlySellInProfit = monthlyProfitList.reduce((acc, d) => acc + d.sellIn, 0);
  const totalYearlySalaryProfit = monthlyProfitList.reduce((acc, d) => acc + d.salaryCost, 0);
  const totalYearlyNetProfit = monthlyProfitList.reduce((acc, d) => acc + d.netProfit, 0);
  const dividerMonthsCount = activeProfitMonths.length > 0 ? activeProfitMonths.length : 12;

  return {
    year: selectedYear,
    monthlyList: monthlyProfitList,
    maxProfitItem,
    maxSalaryItem,
    totalYearlySellIn: totalYearlySellInProfit,
    totalYearlySalary: totalYearlySalaryProfit,
    totalYearlyProfit: totalYearlyNetProfit,
    avgMonthlyProfit: totalYearlyNetProfit / dividerMonthsCount,
    avgMonthlySalary: totalYearlySalaryProfit / dividerMonthsCount,
    avgNetMarginPct:
      totalYearlySellInProfit > 0
        ? (totalYearlyNetProfit / totalYearlySellInProfit) * 100
        : 0,
    activeMonthCount: activeProfitMonths.length,
  };
}

export function buildTargetsAlertsLensData(
  allRecords: TransactionRecord[],
  filteredRecords: TransactionRecord[],
  filters: DashboardFilters,
  coreGapDiagnosis?: SalesGapDiagnosis,
  dayRange?: ExecutiveDayRange
): TargetsAlertsLensData {
  const effective = filterRecordsByDayRange(filteredRecords, dayRange);
  const storeGapDiagnosis =
    (filters.KET || 'ALL').trim().toUpperCase() === 'ALL' && coreGapDiagnosis
      ? coreGapDiagnosis
      : diagnoseSalesGap(allRecords, [], { ...filters, KET: 'ALL' });
  const productStatusSummary = calculateProductStatusAnalysis(effective);

  return {
    productStatusSummary,
    storeGapDetails: storeGapDiagnosis.storeGapDetails || [],
    totalStoreGapDeficit: storeGapDiagnosis.totalStoreGapDeficit || 0,
    gapPreviousPeriodName: storeGapDiagnosis.previousPeriodName || 'Periode Lalu',
    gapCurrentPeriodName: storeGapDiagnosis.currentPeriodName || 'Periode Ini',
  };
}

// Backwards-compatible unified snapshot builder
export function buildSalesProExecutiveSnapshot(
  allRecords: TransactionRecord[],
  filteredRecords: TransactionRecord[],
  filters: DashboardFilters,
  dayRange?: ExecutiveDayRange
): SalesProExecutiveSnapshot {
  const core = buildExecutiveCoreSnapshot(allRecords, filteredRecords, filters, dayRange);
  const mix = buildProductMixLensData(filteredRecords, dayRange);
  const mg = buildMarketShareLensData();
  const promo = buildPromoBaLensData();
  const channelRows = buildChannelGrowthLensData(allRecords, core.selectedYear, filters, dayRange);
  const monthlyProfitHrSummary = buildMonthlyProfitHrSummary(allRecords, filters, core.selectedYear, dayRange);
  const targetsGap = buildTargetsAlertsLensData(allRecords, filteredRecords, filters, core.gapDiagnosis, dayRange);

  return {
    ...core,
    topSkus: mix.topSkus,
    slowMovingSkus: mix.slowMovingSkus,
    topCategories: mix.topCategories,
    productStatusSummary: targetsGap.productStatusSummary,
    storeBaMonthlyRows: channelRows,
    monthlyProfitHrSummary,
    billsList: loadStoreBillsWithRecords(allRecords),
    baIncidents: loadBaIncidents(),
    promoMonthlyRecap: promo.promoMonthlyRecap,
    mgTotalActual: mg.mgTotalActual,
    mgTotalStoreOmset: mg.mgTotalStoreOmset,
    mgMonthlyRecap: mg.mgMonthlyRecap,
    mgPerStoreRecap: mg.mgPerStoreRecap,
    storeGapDetails: targetsGap.storeGapDetails,
    totalStoreGapDeficit: targetsGap.totalStoreGapDeficit,
    gapPreviousPeriodName: targetsGap.gapPreviousPeriodName,
    gapCurrentPeriodName: targetsGap.gapCurrentPeriodName,
  };
}

export { MONTH_NAMES_ID };
