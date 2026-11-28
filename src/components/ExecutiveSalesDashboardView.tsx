import React, {
  useMemo,
  useState,
  useEffect,
  useTransition,
  useDeferredValue,
  useRef,
  useCallback,
} from 'react';
import {
  TransactionRecord,
  DashboardFilters,
  ActiveTab,
  StoreGapDetailItem,
  QuarterPeriodKey,
  AreaTargetItem,
  SalesTargetItem,
  SpvTargetItem,
  KpiSalesScorecardItem,
  KpiTrainerScorecardItem,
  TimeframeMode,
} from '../types/dashboard';
import {
  buildExecutiveCoreSnapshot,
  buildMarketShareLensData,
  buildProductMixLensData,
  buildChannelGrowthLensData,
  buildPromoBaLensData,
  buildMonthlyProfitHrSummary,
  buildTargetsAlertsLensData,
  filterRecordsByDayRange,
  ExecutiveDayRange,
  ExecutiveCoreSnapshot,
  MarketShareLensData,
  ProductMixLensData,
  PromoBaLensData,
  TargetsAlertsLensData,
  MonthlyProfitHrSummary,
} from '../services/executiveDashboardService';
import { calculateQuarterlySummary } from '../services/quarterlySummaryService';
import { SALES_MASTER_6_CONFIG } from '../services/kpiSalesData';
import { loadKpiSalesData, calculateKpiPoints } from '../services/agingAndKpiService';
import { loadKpiTrainerData, calculateTrainerKpiPoints } from '../services/kpiTrainerService';
import {
  TARGETS_UPDATED_EVENT,
  loadSalesSellOutTargets,
  loadTrainerConfigs,
  loadTrainerTargets,
  buildMonthlySpvTargetsMap,
} from '../services/targetManagementService';
import { MonthlyOnlinePromoRecapRow } from '../services/onlinePromoService';
import {
  formatRupiah,
  formatNumber,
  filterRecords,
  aggregateTimeframe,
  MONTH_ORDER,
} from '../utils/analytics';
import { captureElementToPng } from '../utils/screenCapture';
import { TimeframeTrendChart } from './TimeframeTrendChart';
import { SearchableStoreFilter } from './SearchableStoreFilter';
import {
  SidebarLens,
  formatCompactIdr,
  DashboardSidebar,
} from './ExecutiveDashboardWidgets';
import { OverviewDashboardPanel } from './ExecutiveDashboardOverviewPanel';
import { MarketShareDashboardPanel } from './ExecutiveDashboardMarketSharePanel';
import {
  ProductMixDashboardPanel,
  ChannelGrowthDashboardPanel,
  TargetsAlertsHeaderCards,
} from './ExecutiveDashboardMidPanels';
import { AchieveQuartalDashboardPanel } from './ExecutiveDashboardQuartalPanel';
import {
  Camera,
  Loader2,
  LayoutDashboard,
  MapPin,
  PieChart as PieChartIcon,
  Layers,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Download,
  AlertTriangle,
  ChevronRight,
  Tag,
  Search,
  X,
  Building2,
  Users,
  BarChart2,
  BarChart3,
  Calendar,
  Award,
  GraduationCap,
  PanelTopOpen,
  PanelTopClose,
  Check,
  Crown,
} from 'lucide-react';

interface ExecutiveSalesDashboardViewProps {
  allRecords: TransactionRecord[];
  filteredRecords: TransactionRecord[];
  filters: DashboardFilters;
  cascadingOptions: {
    months: string[];
    years: string[];
    regions: string[];
    sales: string[];
    stores?: string[];
    brands: string[];
    ket: string[];
  };
  onChangeFilter: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K]
  ) => void;
  onExportPdf: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  isActive?: boolean;
}

let cachedKpiSalesItems: KpiSalesScorecardItem[] | null = null;
let cachedKpiTrainerItems: KpiTrainerScorecardItem[] | null = null;

function getCachedKpiSalesItems(forceRefresh = false): KpiSalesScorecardItem[] {
  if (forceRefresh || !cachedKpiSalesItems) {
    cachedKpiSalesItems = syncKpiSalesItemsForDashboard(loadKpiSalesData());
  }
  return cachedKpiSalesItems;
}

function getCachedKpiTrainerItems(forceRefresh = false): KpiTrainerScorecardItem[] {
  if (forceRefresh || !cachedKpiTrainerItems) {
    cachedKpiTrainerItems = syncKpiTrainerItemsForDashboard(loadKpiTrainerData());
  }
  return cachedKpiTrainerItems;
}

function invalidateKpiDashboardCaches(): void {
  cachedKpiSalesItems = null;
  cachedKpiTrainerItems = null;
}

// Isolated Memoized Monthly Profit & HR Capacity Panel
const MonthlyProfitHrPanel: React.FC<{
  pnlData: MonthlyProfitHrSummary;
  filterMonth: string;
}> = React.memo(({ pnlData, filterMonth }) => {
  const [selectedProfitMonth, setSelectedProfitMonth] = useState<string>(() =>
    filterMonth && filterMonth !== 'ALL' ? filterMonth.toUpperCase() : ''
  );

  const monthlyList = pnlData.monthlyList;
  const fallbackKey =
    (filterMonth && filterMonth !== 'ALL' ? filterMonth.toUpperCase() : '') ||
    pnlData.maxProfitItem?.key ||
    'OKTOBER';
  const activeMonthKey = selectedProfitMonth || fallbackKey;
  const selMonth =
    monthlyList.find((m) => m.key === activeMonthKey) ||
    pnlData.maxProfitItem ||
    monthlyList[9] ||
    monthlyList[0];

  const maxRef = useMemo(
    () =>
      Math.max(
        1,
        pnlData.maxProfitItem?.netProfit || 0,
        pnlData.maxSalaryItem?.salaryCost || 0,
        ...monthlyList.map((m) => Math.max(m.netProfit, m.salaryCost))
      ),
    [pnlData.maxProfitItem, pnlData.maxSalaryItem, monthlyList]
  );

  return (
    <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col gap-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-3 border-b border-[#1E293B]">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
              Grafik Bulanan Profit, Beban Gaji &amp; Kapasitas SDM (Januari – Desember {pnlData.year})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Komparasi 12 bulan sisa profit bersih, biaya gaji karyawan, dan jumlah personil SDM aktif. Klik kolom bulan untuk rincian.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0E1523] border border-[#1E293B] text-emerald-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            Profit Bersih
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0E1523] border border-[#1E293B] text-rose-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
            Beban Gaji SDM
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0E1523] border border-[#1E293B] text-[#00D2FF] font-bold">
            <Users className="w-3 h-3" />
            Kapasitas SDM
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 font-mono tabular-nums">
        <div className="bg-[#0E1523] border border-emerald-500/25 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-sans font-bold uppercase text-emerald-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              Bulan Profit Terbesar
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
              TOP LABA
            </span>
          </div>
          <div className="text-sm font-black text-white mt-1">
            {pnlData.maxProfitItem?.fullName || '-'} {pnlData.year}
          </div>
          <div className="text-sm font-black text-emerald-400 whitespace-nowrap">
            {formatRupiah(pnlData.maxProfitItem?.netProfit || 0)}
          </div>
          <div className="text-[10px] font-sans text-slate-400 mt-0.5 whitespace-nowrap">
            Margin Bersih:{' '}
            <span className="font-mono font-bold text-slate-200">
              {(pnlData.maxProfitItem?.profitPct || 0).toFixed(1)}%
            </span>{' '}
            dari Sell In
          </div>
        </div>

        <div className="bg-[#0E1523] border border-rose-500/25 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-sans font-bold uppercase text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Bulan Beban Gaji Terbesar
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">
              BIAYA MAX
            </span>
          </div>
          <div className="text-sm font-black text-white mt-1">
            {pnlData.maxSalaryItem?.fullName || '-'} {pnlData.year}
          </div>
          <div className="text-sm font-black text-rose-400 whitespace-nowrap">
            {formatRupiah(pnlData.maxSalaryItem?.salaryCost || 0)}
          </div>
          <div className="text-[10px] font-sans text-slate-400 mt-0.5 whitespace-nowrap">
            Menanggung{' '}
            <span className="font-mono font-bold text-slate-200">
              {pnlData.maxSalaryItem?.sdmCount || 0} Personil SDM
            </span>
          </div>
        </div>

        <div className="bg-[#0E1523] border border-cyan-500/25 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-sans font-bold uppercase text-[#00D2FF] flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Kapasitas SDM ({selMonth?.label || '-'})
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
              TIM AKTIF
            </span>
          </div>
          <div className="text-sm font-black text-white mt-1 whitespace-nowrap">
            {selMonth?.sdmCount || 0} Personil SDM
          </div>
          <div className="text-[11px] font-sans font-semibold text-cyan-300 whitespace-nowrap">
            {selMonth?.salesCount || 0} Sales · {selMonth?.baCount || 0} BA · {selMonth?.trainerCount || 0} Trainer · {selMonth?.spvCount || 0} SPV
          </div>
          <div className="text-[10px] font-sans text-slate-400 mt-0.5 whitespace-nowrap">
            Rata-rata Gaji:{' '}
            <span className="font-mono font-bold text-slate-200">
              {formatCompactIdr(pnlData.avgMonthlySalary)}/bln
            </span>
          </div>
        </div>

        <div className="bg-[#0E1523] border border-[#FF6B00]/25 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-sans font-bold uppercase text-[#FF6B00] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Total Profit Tahunan
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF6B00]/15 text-amber-300">
              {pnlData.activeMonthCount} BLN AKTIF
            </span>
          </div>
          <div className="text-sm font-black text-white mt-1 whitespace-nowrap">
            {formatRupiah(pnlData.totalYearlyProfit)}
          </div>
          <div className="text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
            Rata-rata: {formatRupiah(pnlData.avgMonthlyProfit)}/bln
          </div>
          <div className="text-[10px] font-sans text-slate-400 mt-0.5 whitespace-nowrap">
            Total Gaji:{' '}
            <span className="font-mono font-bold text-rose-300">
              {formatCompactIdr(pnlData.totalYearlySalary)}
            </span>{' '}
            · Avg Margin {pnlData.avgNetMarginPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-2 pt-1">
        {monthlyList.map((m) => {
          const isSelected = selMonth?.key === m.key;
          const isMaxProfit = pnlData.maxProfitItem?.key === m.key && m.netProfit > 0;
          const isMaxSalary = pnlData.maxSalaryItem?.key === m.key && m.salaryCost > 0;
          const profitHeight =
            m.netProfit > 0 ? Math.max(10, Math.round((m.netProfit / maxRef) * 108)) : 4;
          const salaryHeight =
            m.salaryCost > 0 ? Math.max(10, Math.round((m.salaryCost / maxRef) * 108)) : 4;

          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedProfitMonth(m.key)}
              className={`flex flex-col items-center justify-between p-2 rounded-xl border text-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#172236] border-emerald-500 ring-1 ring-emerald-500/40'
                  : isMaxProfit
                  ? 'bg-[#0F1B26] border-emerald-500/35 hover:border-emerald-400'
                  : isMaxSalary
                  ? 'bg-[#181423] border-rose-500/35 hover:border-rose-400'
                  : 'bg-[#0E1523] border-[#1E293B] hover:border-slate-600'
              }`}
            >
              <div className="w-full flex flex-col items-center gap-1 min-h-[36px] justify-end">
                {isMaxProfit && (
                  <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                    TOP LABA
                  </span>
                )}
                {isMaxSalary && !isMaxProfit && (
                  <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                    BIAYA MAX
                  </span>
                )}
                {m.isCustomEdited && (
                  <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Edited
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#162033] text-cyan-300 border border-cyan-500/20 inline-flex items-center gap-1 whitespace-nowrap">
                  <Users className="w-2.5 h-2.5 text-cyan-400" />
                  {m.sdmCount}
                </span>
              </div>

              <div className="h-28 w-full flex items-end justify-center gap-1.5 px-1 py-1.5 mt-1.5 bg-[#090E17] rounded-lg border border-[#182235]">
                <div
                  title={`Profit Bersih ${m.fullName}: ${formatRupiah(m.netProfit)}`}
                  style={{ height: `${profitHeight}px` }}
                  className={`w-3.5 rounded-t-sm transition-all ${
                    m.netProfit > 0
                      ? isSelected || isMaxProfit
                        ? 'bg-emerald-400'
                        : 'bg-emerald-500/85'
                      : m.netProfit < 0
                      ? 'bg-rose-500'
                      : 'bg-slate-700/50'
                  }`}
                />
                <div
                  title={`Beban Gaji ${m.fullName}: ${formatRupiah(m.salaryCost)}`}
                  style={{ height: `${salaryHeight}px` }}
                  className={`w-3.5 rounded-t-sm transition-all ${
                    m.salaryCost > 0
                      ? isSelected || isMaxSalary
                        ? 'bg-rose-400'
                        : 'bg-rose-500/80'
                      : 'bg-slate-700/50'
                  }`}
                />
              </div>

              <div
                title={`Profit Bersih ${m.fullName}: ${formatRupiah(m.netProfit)}`}
                className={`text-[10px] font-mono tabular-nums font-extrabold mt-1.5 whitespace-nowrap ${
                  m.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCompactIdr(m.netProfit)}
              </div>
              <div
                title={`Beban Gaji ${m.fullName}: ${formatRupiah(m.salaryCost)}`}
                className="text-[9px] font-mono tabular-nums font-semibold text-rose-300 whitespace-nowrap"
              >
                Gaji: {formatCompactIdr(m.salaryCost)}
              </div>

              <div className="text-[9px] font-mono tabular-nums font-bold text-slate-300 mt-1 px-1.5 py-0.5 rounded bg-[#162033] whitespace-nowrap">
                {m.profitPct >= 0 ? '+' : ''}
                {m.profitPct.toFixed(1)}%
              </div>

              <div
                className={`mt-1.5 text-[11px] font-black uppercase tracking-wide ${
                  isSelected ? 'text-emerald-400' : 'text-white'
                }`}
              >
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      {selMonth && (
        <div className="bg-[#0E1523] border border-[#1E293B] rounded-xl p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Rincian Kinerja P&amp;L &amp; Kapasitas SDM: Bulan {selMonth.fullName} {pnlData.year}
              </h4>
            </div>
            <span className="text-[11px] font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-0.5 rounded-md whitespace-nowrap">
              {selMonth.sdmCount} Personil ({selMonth.salesCount} Sales · {selMonth.baCount} BA · {selMonth.trainerCount} Trainer · {selMonth.spvCount} SPV)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono tabular-nums">
            <div className="bg-[#121926] border border-[#1F293B] rounded-lg p-2.5">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Omset Sell In</span>
              <span className="text-xs sm:text-sm font-black text-white mt-0.5 block whitespace-nowrap">
                {formatRupiah(selMonth.sellIn)}
              </span>
            </div>
            <div className="bg-[#121926] border border-[#1F293B] rounded-lg p-2.5">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Margin Kotor (55%)</span>
              <span className="text-xs sm:text-sm font-black text-cyan-300 mt-0.5 block whitespace-nowrap">
                {formatRupiah(selMonth.margin)}
              </span>
            </div>
            <div className="bg-[#121926] border border-[#1F293B] rounded-lg p-2.5">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Biaya Ops (33%)</span>
              <span className="text-xs sm:text-sm font-black text-amber-300 mt-0.5 block whitespace-nowrap">
                {formatRupiah(selMonth.opsCost)}
              </span>
            </div>
            <div className="bg-[#121926] border border-[#1F293B] rounded-lg p-2.5">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Beban Gaji SDM</span>
              <span className="text-xs sm:text-sm font-black text-rose-400 mt-0.5 block whitespace-nowrap">
                {formatRupiah(selMonth.salaryCost)}
              </span>
            </div>
            <div className="bg-[#121926] border border-[#1F293B] rounded-lg p-2.5">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Sisa Profit Bersih</span>
              <span
                className={`text-xs sm:text-sm font-black mt-0.5 block whitespace-nowrap ${
                  selMonth.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRupiah(selMonth.netProfit)}
              </span>
            </div>
            <div className="bg-[#121926] border border-[#1F293B] rounded-lg p-2.5">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Net Margin (%)</span>
              <span
                className={`text-xs sm:text-sm font-black mt-0.5 block whitespace-nowrap ${
                  selMonth.profitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {selMonth.profitPct >= 0 ? '+' : ''}
                {selMonth.profitPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Isolated Memoized Promo Online Monthly Recap (Growth MoM) & Chart Panel
const PromoMonthlyGrowthPanel: React.FC<{
  promoMonthlyRecap: MonthlyOnlinePromoRecapRow[];
  onOpenPromo: () => void;
}> = React.memo(({ promoMonthlyRecap, onOpenPromo }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const stats = useMemo(() => {
    let maxActual = 0;
    let peakIdx = -1;
    let totalActual = 0;
    let totalPromoDays = 0;
    let totalEntries = 0;
    let growthSum = 0;
    let growthCount = 0;

    for (let i = 0; i < promoMonthlyRecap.length; i++) {
      const r = promoMonthlyRecap[i];
      totalActual += r.totalActual;
      totalPromoDays += r.promoDaysCount;
      totalEntries += r.entryCount;
      if (r.totalActual > maxActual) {
        maxActual = r.totalActual;
        peakIdx = i;
      }
      if (r.growthPercent !== null && Number.isFinite(r.growthPercent)) {
        growthSum += r.growthPercent;
        growthCount += 1;
      }
    }

    const avgGrowthPct = growthCount > 0 ? growthSum / growthCount : null;
    const avgOverallPerDay = totalPromoDays > 0 ? totalActual / totalPromoDays : 0;

    return {
      maxActual,
      peakIdx,
      totalActual,
      totalPromoDays,
      totalEntries,
      avgGrowthPct,
      avgOverallPerDay,
    };
  }, [promoMonthlyRecap]);

  const activeInspectRow = useMemo(() => {
    if (hoveredIdx !== null && promoMonthlyRecap[hoveredIdx]) {
      return promoMonthlyRecap[hoveredIdx];
    }
    if (selectedMonth) {
      const found = promoMonthlyRecap.find((r) => r.monthPeriod === selectedMonth);
      if (found) return found;
    }
    if (stats.peakIdx >= 0 && promoMonthlyRecap[stats.peakIdx]) {
      return promoMonthlyRecap[stats.peakIdx];
    }
    return promoMonthlyRecap[promoMonthlyRecap.length - 1] || null;
  }, [hoveredIdx, selectedMonth, promoMonthlyRecap, stats.peakIdx]);

  return (
    <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0E1523] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Rekapan Pencapaian Bulanan (Growth MoM) &amp; Grafik
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Grafik perbandingan Actual &amp; laju Growth MoM per bulan. Klik batang grafik atau baris tabel untuk menyorot bulan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
          <div className="px-2.5 py-1 rounded-lg bg-[#121926] border border-[#243147]">
            <span className="font-sans text-[10px] text-slate-400 mr-1.5">Akumulasi:</span>
            <span className="font-black text-[#FF6B00]">{formatRupiah(stats.totalActual)}</span>
          </div>
          {stats.avgGrowthPct !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-[#121926] border border-[#243147]">
              <span className="font-sans text-[10px] text-slate-400 mr-1.5">Avg MoM:</span>
              <span
                className={`font-black ${
                  stats.avgGrowthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.avgGrowthPct >= 0 ? '+' : ''}
                {stats.avgGrowthPct.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          )}
          {selectedMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="px-2.5 py-1 rounded-lg bg-[#192234] hover:bg-[#23304A] border border-[#2A3952] text-cyan-300 font-sans font-bold cursor-pointer"
            >
              Reset Pilihan
            </button>
          )}
        </div>
      </div>

      {promoMonthlyRecap.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center gap-2.5">
          <div className="p-3 rounded-full bg-[#182235] border border-[#243147] text-slate-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-300">
            Belum ada data input manual Promo Toko Online.
          </p>
          <p className="text-[11px] text-slate-500 max-w-md">
            Tambahkan data laporan harian pada menu Report Promo Toko Online agar grafik pencapaian dan Growth MoM bulanan muncul otomatis di sini.
          </p>
          <button
            type="button"
            onClick={onOpenPromo}
            className="mt-1 px-3.5 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#E55E00] text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Input Data Promo Online
          </button>
        </div>
      ) : (
        <>
          {/* Monthly Bar & Growth MoM Chart */}
          <div className="p-4 border-b border-[#1E293B] bg-[#0B101A]">
            {activeInspectRow && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-[#121926] border border-[#243147] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#FF6B00]/15 text-[#FF6B00] font-extrabold text-[10px] uppercase">
                    {hoveredIdx !== null
                      ? 'Sorotan Grafik'
                      : selectedMonth
                      ? 'Bulan Dipilih'
                      : 'Puncak Bulanan'}
                  </span>
                  <span className="font-bold text-white">{activeInspectRow.monthPeriod}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {activeInspectRow.promoDaysCount}/{activeInspectRow.calendarDaysInMonth} hari promo ·{' '}
                    {activeInspectRow.storeCount} toko
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                  <span className="text-cyan-300 font-bold text-[11px]">
                    Avg/Hr: {formatCompactIdr(activeInspectRow.avgPerPromoDay)}
                  </span>
                  <span className="text-emerald-400 font-black text-xs">
                    {formatRupiah(activeInspectRow.totalActual)}
                  </span>
                  {activeInspectRow.growthPercent !== null && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        activeInspectRow.growthPercent >= 0
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {activeInspectRow.growthPercent >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      MoM {activeInspectRow.growthPercent >= 0 ? '+' : ''}
                      {activeInspectRow.growthPercent.toFixed(1).replace('.', ',')}%
                      {activeInspectRow.growthDelta !== null && (
                        <span className="text-[10px] opacity-85 ml-0.5">
                          ({activeInspectRow.growthDelta >= 0 ? '+' : '-'}
                          {formatCompactIdr(Math.abs(activeInspectRow.growthDelta))})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-stretch gap-3">
              {/* Left Y-axis */}
              <div className="hidden sm:flex flex-col justify-between text-right font-mono text-[10px] text-slate-500 tabular-nums py-7 pr-2 border-r border-[#1E293B] shrink-0 w-20">
                <span>{formatCompactIdr(stats.maxActual)}</span>
                <span>{formatCompactIdr(stats.maxActual * 0.5)}</span>
                <span>Rp 0</span>
              </div>

              {/* Bars */}
              <div className="flex-1 flex items-end gap-1.5 sm:gap-2.5 h-48 pt-6 pb-1 overflow-x-auto">
                {promoMonthlyRecap.map((row, idx) => {
                  const heightPct =
                    stats.maxActual > 0
                      ? Math.max(8, (Math.max(0, row.totalActual) / stats.maxActual) * 100)
                      : 8;
                  const isPeak = idx === stats.peakIdx && row.totalActual > 0;
                  const isSelected = selectedMonth === row.monthPeriod;
                  const isPositive = row.growthPercent !== null && row.growthPercent >= 0;

                  return (
                    <button
                      key={row.monthPeriod}
                      type="button"
                      onClick={() =>
                        setSelectedMonth((prev) =>
                          prev === row.monthPeriod ? null : row.monthPeriod
                        )
                      }
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className={`flex-1 min-w-[52px] flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none rounded-lg px-1 py-1 transition-colors ${
                        isSelected ? 'bg-[#172236]/80' : 'hover:bg-[#141D2E]/60'
                      }`}
                    >
                      <div className="mb-1 flex flex-col items-center">
                        {row.growthPercent !== null ? (
                          <span
                            className={`text-[9.5px] font-mono font-extrabold tabular-nums leading-none px-1 py-0.5 rounded ${
                              isPositive
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {row.growthPercent.toFixed(1).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-mono text-slate-500 leading-none">
                            Awal
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono font-extrabold tabular-nums mt-0.5 whitespace-nowrap ${
                            isSelected
                              ? 'text-[#00D2FF]'
                              : isPeak
                              ? 'text-emerald-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {formatCompactIdr(row.totalActual)}
                        </span>
                      </div>

                      <div className="w-full relative flex items-end justify-center h-full px-1.5">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[46px] rounded-t-md transition-all duration-200 ${
                            isSelected
                              ? 'bg-[#00D2FF] ring-2 ring-[#00D2FF]/40'
                              : isPeak
                              ? 'bg-emerald-500 group-hover:bg-emerald-400'
                              : 'bg-[#FF6B00] group-hover:bg-[#FF8533]'
                          }`}
                        />
                      </div>

                      <div className="mt-1.5 text-center w-full">
                        <span
                          className={`block text-[10px] font-bold truncate ${
                            isSelected
                              ? 'text-[#00D2FF]'
                              : isPeak
                              ? 'text-emerald-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {row.monthPeriod}
                        </span>
                        <span className="block text-[9px] font-mono text-slate-400 tabular-nums truncate">
                          {row.promoDaysCount} hr · {row.storeCount} tk
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 text-[10.5px] text-slate-400">
              <div className="flex flex-wrap items-center gap-4 font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                  Puncak Bulanan (
                  {stats.peakIdx >= 0 ? promoMonthlyRecap[stats.peakIdx]?.monthPeriod : '-'})
                </span>
                <span className="flex items-center gap-1.5 text-[#FF6B00]">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#FF6B00] inline-block" />
                  Bulan Lainnya
                </span>
                {selectedMonth && (
                  <span className="flex items-center gap-1.5 text-[#00D2FF] font-semibold">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#00D2FF] inline-block" />
                    Dipilih ({selectedMonth})
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-300 font-semibold tabular-nums">
                {promoMonthlyRecap.length} Bulan Tercatat
              </span>
            </div>
          </div>

          {/* Monthly Table — Full Columns & Compact Multi-Row Viewport */}
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-[10.5px] text-left border-collapse">
              <thead className="sticky top-0 bg-[#0E1523] z-10">
                <tr className="text-[9.5px] uppercase text-slate-400 border-b border-[#1E293B]">
                  <th className="py-2 px-2.5 whitespace-nowrap">Bulan</th>
                  <th className="py-2 px-2 text-center whitespace-nowrap">Hari Promo</th>
                  <th className="py-2 px-2 text-center whitespace-nowrap">Aktif %</th>
                  <th className="py-2 px-2 text-center whitespace-nowrap">Toko</th>
                  <th className="py-2 px-2 text-center whitespace-nowrap">Entri</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Avg / Hari</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Bulan Lalu</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap text-[#FF6B00]">Actual Bln Ini</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Selisih (Δ)</th>
                  <th className="py-2 px-2.5 text-right whitespace-nowrap">Growth MoM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                {promoMonthlyRecap.map((r, idx) => {
                  const isSelected = selectedMonth === r.monthPeriod;
                  const isPeak = idx === stats.peakIdx && r.totalActual > 0;
                  const isPos = r.growthPercent !== null && r.growthPercent >= 0;
                  const activeDaysPct =
                    r.calendarDaysInMonth > 0
                      ? (r.promoDaysCount / r.calendarDaysInMonth) * 100
                      : 0;
                  return (
                    <tr
                      key={r.monthPeriod}
                      onClick={() =>
                        setSelectedMonth((prev) =>
                          prev === r.monthPeriod ? null : r.monthPeriod
                        )
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#17263D]' : 'hover:bg-[#172033]'
                      }`}
                    >
                      <td className="py-1.5 px-2.5 font-sans font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{r.monthPeriod}</span>
                          {isPeak && (
                            <span className="text-[8.5px] font-mono px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              PEAK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-300 whitespace-nowrap">
                        {r.promoDaysCount}/{r.calendarDaysInMonth} hr
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-300 whitespace-nowrap">
                        {activeDaysPct.toFixed(0)}%
                      </td>
                      <td className="py-1.5 px-2 text-center text-cyan-300 font-bold whitespace-nowrap">
                        {r.storeCount}
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-400 whitespace-nowrap">
                        {r.entryCount}
                      </td>
                      <td
                        className="py-1.5 px-2 text-right text-cyan-400 whitespace-nowrap"
                        title={formatRupiah(r.avgPerPromoDay)}
                      >
                        {formatCompactIdr(r.avgPerPromoDay)}
                      </td>
                      <td
                        className="py-1.5 px-2 text-right text-slate-400 whitespace-nowrap"
                        title={
                          r.previousTotalActual !== null
                            ? `${r.previousMonthPeriod || 'Bulan Lalu'}: ${formatRupiah(r.previousTotalActual)}`
                            : '-'
                        }
                      >
                        {r.previousTotalActual !== null ? formatCompactIdr(r.previousTotalActual) : '-'}
                      </td>
                      <td
                        className="py-1.5 px-2 text-right font-extrabold text-[#FF6B00] whitespace-nowrap"
                        title={formatRupiah(r.totalActual)}
                      >
                        {formatRupiah(r.totalActual)}
                      </td>
                      <td
                        className={`py-1.5 px-2 text-right font-bold whitespace-nowrap ${
                          r.growthDelta === null
                            ? 'text-slate-500'
                            : r.growthDelta >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                        title={r.growthDelta !== null ? formatRupiah(r.growthDelta) : '-'}
                      >
                        {r.growthDelta !== null
                          ? `${r.growthDelta >= 0 ? '+' : '-'}${formatCompactIdr(Math.abs(r.growthDelta))}`
                          : '-'}
                      </td>
                      <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                        {r.growthPercent !== null ? (
                          <span
                            className={`inline-flex items-center gap-0.5 font-extrabold ${
                              isPos ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPos ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {isPos ? '+' : ''}
                            {r.growthPercent.toFixed(1).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-sans">Awal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#0E1523] border-t border-[#243147] font-mono tabular-nums text-[10.5px]">
                <tr>
                  <td className="py-2 px-2.5 font-sans font-extrabold uppercase text-slate-300 whitespace-nowrap">
                    Total ({promoMonthlyRecap.length} Bln)
                  </td>
                  <td className="py-2 px-2 text-center font-bold text-slate-200 whitespace-nowrap">
                    {stats.totalPromoDays} hr
                  </td>
                  <td className="py-2 px-2 text-center text-slate-400 whitespace-nowrap">-</td>
                  <td className="py-2 px-2 text-center text-slate-400 whitespace-nowrap">-</td>
                  <td className="py-2 px-2 text-center text-slate-300 whitespace-nowrap">
                    {stats.totalEntries}
                  </td>
                  <td
                    className="py-2 px-2 text-right font-bold text-cyan-300 whitespace-nowrap"
                    title={formatRupiah(stats.avgOverallPerDay)}
                  >
                    {formatCompactIdr(stats.avgOverallPerDay)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500 whitespace-nowrap">-</td>
                  <td className="py-2 px-2 text-right font-black text-[#FF6B00] whitespace-nowrap">
                    {formatRupiah(stats.totalActual)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-500 whitespace-nowrap">-</td>
                  <td className="py-2 px-2.5 text-right font-bold whitespace-nowrap">
                    {stats.avgGrowthPct !== null ? (
                      <span
                        className={
                          stats.avgGrowthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        Avg {stats.avgGrowthPct >= 0 ? '+' : ''}
                        {stats.avgGrowthPct.toFixed(1).replace('.', ',')}%
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
});

const REGIONAL_SALES_PALETTE = [
  '#10B981',
  '#00D2FF',
  '#FF6B00',
  '#3B82F6',
  '#A855F7',
  '#F59E0B',
];

// Isolated Memoized Area & Tim Sales Panel (KET-aware Sell In / Sell Out / All + Cool Charts + Full-Width Tables)
const RegionalSalesPanel: React.FC<{
  sales: SalesTargetItem[];
  areas: AreaTargetItem[];
  spvs: SpvTargetItem[];
  ketFilter: string;
  selectedMonthLabel: string;
  onChangeKet: (ket: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(
  ({ sales, areas, spvs, ketFilter, selectedMonthLabel, onChangeKet, onNavigateTab }) => {
    const normalizedKet = (ketFilter || 'ALL').trim().toUpperCase();
    const isSellInOnly = normalizedKet === 'SELL IN';
    const isSellOutOnly = normalizedKet === 'SELL OUT';

    const [chartMetricMode, setChartMetricMode] = useState<'sell_in' | 'sell_out' | 'compare'>(
      isSellOutOnly ? 'sell_out' : 'sell_in'
    );
    const [sortBy, setSortBy] = useState<'achv' | 'actual'>('achv');
    const [hoveredSalesIdx, setHoveredSalesIdx] = useState<number | null>(null);
    const [selectedSalesName, setSelectedSalesName] = useState<string | null>(null);

    useEffect(() => {
      if (normalizedKet === 'SELL IN') setChartMetricMode('sell_in');
      else if (normalizedKet === 'SELL OUT') setChartMetricMode('sell_out');
    }, [normalizedKet]);

    const effectiveChartMetric: 'sell_in' | 'sell_out' | 'compare' = isSellInOnly
      ? 'sell_in'
      : isSellOutOnly
      ? 'sell_out'
      : chartMetricMode;

    // Map Area -> Supervisor names
    const spvsByArea = useMemo(() => {
      const map = new Map<string, string[]>();
      areas.forEach((a) => {
        const aUpper = a.coverArea.trim().toUpperCase();
        const matching = spvs
          .filter((sp) =>
            sp.coverAreas.some((c) => c.trim().toUpperCase() === aUpper)
          )
          .map((sp) => sp.spvName);
        map.set(
          aUpper,
          matching.length > 0 ? matching : spvs.map((sp) => sp.spvName)
        );
      });
      return map;
    }, [areas, spvs]);

    // Prepare sorted sales items & totals
    const salesMetrics = useMemo(() => {
      const rows = sales.map((s) => {
        const tIn = s.targetSellIn || 0;
        const aIn = s.actualSellIn || 0;
        const pctIn = tIn > 0 ? (aIn / tIn) * 100 : 0;

        const tOut = s.targetSellOut ?? 0;
        const aOut = s.actualSellOut ?? 0;
        const pctOut = tOut > 0 ? (aOut / tOut) * 100 : 0;

        return {
          ...s,
          tIn,
          aIn,
          pctIn,
          tOut,
          aOut,
          pctOut,
        };
      });

      const sorted = [...rows].sort((a, b) => {
        const aPct = effectiveChartMetric === 'sell_out' ? a.pctOut : a.pctIn;
        const bPct = effectiveChartMetric === 'sell_out' ? b.pctOut : b.pctIn;
        const aAct = effectiveChartMetric === 'sell_out' ? a.aOut : a.aIn;
        const bAct = effectiveChartMetric === 'sell_out' ? b.aOut : b.aIn;
        if (sortBy === 'achv') {
          if (Math.abs(bPct - aPct) > 0.01) return bPct - aPct;
          return bAct - aAct;
        }
        return bAct - aAct;
      });

      const totalTgtIn = rows.reduce((acc, r) => acc + r.tIn, 0);
      const totalActIn = rows.reduce((acc, r) => acc + r.aIn, 0);
      const totalPctIn = totalTgtIn > 0 ? (totalActIn / totalTgtIn) * 100 : 0;

      const totalTgtOut = rows.reduce((acc, r) => acc + r.tOut, 0);
      const totalActOut = rows.reduce((acc, r) => acc + r.aOut, 0);
      const totalPctOut = totalTgtOut > 0 ? (totalActOut / totalTgtOut) * 100 : 0;

      const maxChartValue = Math.max(
        1,
        ...sorted.map((r) => {
          if (effectiveChartMetric === 'sell_out') return Math.max(r.tOut, r.aOut);
          if (effectiveChartMetric === 'compare') return Math.max(r.aIn, r.aOut, r.tIn, r.tOut);
          return Math.max(r.tIn, r.aIn);
        })
      );

      const topSales = sorted[0] || null;

      return {
        sorted,
        totalTgtIn,
        totalActIn,
        totalPctIn,
        totalTgtOut,
        totalActOut,
        totalPctOut,
        maxChartValue,
        topSales,
      };
    }, [sales, effectiveChartMetric, sortBy]);

    // Area totals & SPV labels
    const areaMetrics = useMemo(() => {
      const rows = areas.map((a) => {
        const tIn = a.targetOmzet || 0;
        const aIn = a.actualSellIn || 0;
        const pctIn = tIn > 0 ? (aIn / tIn) * 100 : 0;

        const tOut = a.targetSellOut ?? 0;
        const aOut = a.actualSellOut || 0;
        const pctOut = tOut > 0 ? (aOut / tOut) * 100 : 0;

        const supList = spvsByArea.get(a.coverArea.trim().toUpperCase()) || [];
        const spvLabel = supList.length > 0 ? supList.join(', ') : `${a.spvCount} SPV`;

        return {
          ...a,
          spvLabel,
          tIn,
          aIn,
          pctIn,
          tOut,
          aOut,
          pctOut,
        };
      });

      const totalTgtIn = rows.reduce((acc, r) => acc + r.tIn, 0);
      const totalActIn = rows.reduce((acc, r) => acc + r.aIn, 0);
      const totalPctIn = totalTgtIn > 0 ? (totalActIn / totalTgtIn) * 100 : 0;

      const totalTgtOut = rows.reduce((acc, r) => acc + r.tOut, 0);
      const totalActOut = rows.reduce((acc, r) => acc + r.aOut, 0);
      const totalPctOut = totalTgtOut > 0 ? (totalActOut / totalTgtOut) * 100 : 0;

      return { rows, totalTgtIn, totalActIn, totalPctIn, totalTgtOut, totalActOut, totalPctOut };
    }, [areas, spvsByArea]);

    // Donut share segments for Right Chart
    const shareBreakdown = useMemo(() => {
      const totalAct =
        effectiveChartMetric === 'sell_out'
          ? salesMetrics.totalActOut
          : salesMetrics.totalActIn;
      const items = salesMetrics.sorted.map((s, idx) => {
        const val = effectiveChartMetric === 'sell_out' ? s.aOut : s.aIn;
        const share = totalAct > 0 ? (val / totalAct) * 100 : 0;
        return {
          name: s.salesName,
          area: s.coverArea,
          val,
          share,
          color: REGIONAL_SALES_PALETTE[idx % REGIONAL_SALES_PALETTE.length],
        };
      });
      const r = 46;
      const circ = 2 * Math.PI * r;
      let offset = 0;
      const segments = items.map((item) => {
        const len = (item.share / 100) * circ;
        const seg = {
          ...item,
          strokeLength: Math.max(0, len - 1.5),
          strokeOffset: -offset,
        };
        offset += len;
        return seg;
      });
      return { totalAct, items, segments, r, circ };
    }, [salesMetrics, effectiveChartMetric]);

    const activeSalesFocus =
      hoveredSalesIdx !== null && salesMetrics.sorted[hoveredSalesIdx]
        ? salesMetrics.sorted[hoveredSalesIdx]
        : selectedSalesName
        ? salesMetrics.sorted.find((s) => s.salesName === selectedSalesName) || null
        : salesMetrics.topSales;

    const headlineTarget = isSellOutOnly ? salesMetrics.totalTgtOut : salesMetrics.totalTgtIn;
    const headlineActual = isSellOutOnly ? salesMetrics.totalActOut : salesMetrics.totalActIn;
    const headlinePct = isSellOutOnly ? salesMetrics.totalPctOut : salesMetrics.totalPctIn;
    const headlineGap = headlineActual - headlineTarget;

    return (
      <div className="flex-1 flex flex-col gap-3">
        {/* Top Header + Quick KET Switcher + Action Links */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Performa Area, Supervisor &amp; Tim Sales
            </h2>
            <p className="text-xs text-slate-400">
              {isSellInOnly
                ? `Mode Filter: SELL IN · Target vs Aktual Sell In (${selectedMonthLabel})`
                : isSellOutOnly
                ? `Mode Filter: SELL OUT · Target vs Aktual Sell Out (${selectedMonthLabel})`
                : `Mode Filter: SEMUA (Sell In & Sell Out) · Periode ${selectedMonthLabel}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented KET Quick Filter */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D121D] border border-[#243147] text-[11px] font-bold">
              {(
                [
                  { key: 'ALL', label: 'Semua' },
                  { key: 'SELL IN', label: 'Sell In' },
                  { key: 'SELL OUT', label: 'Sell Out' },
                ] as const
              ).map((tab) => {
                const isActive =
                  (tab.key === 'ALL' && !isSellInOnly && !isSellOutOnly) ||
                  (tab.key === 'SELL IN' && isSellInOnly) ||
                  (tab.key === 'SELL OUT' && isSellOutOnly);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onChangeKet(tab.key)}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? tab.key === 'SELL OUT'
                          ? 'bg-[#00D2FF] text-slate-950 font-extrabold'
                          : 'bg-[#FF6B00] text-white font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('sales')}
              className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Buka Analisis Sales</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('spv')}
              className="px-3 py-1.5 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Buka Analisis SPV
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 font-mono tabular-nums">
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
              {isSellOutOnly
                ? 'Total Target Sell Out Tim'
                : isSellInOnly
                ? 'Total Target Sell In Tim'
                : 'Total Target Tim (In / Out)'}
            </span>
            <span
              className="text-base sm:text-lg font-black text-white mt-1 block whitespace-nowrap"
              title={formatRupiah(headlineTarget)}
            >
              {formatRupiah(headlineTarget)}
            </span>
            {!isSellInOnly && !isSellOutOnly && (
              <span className="text-[10.5px] text-cyan-400 font-bold mt-0.5 block whitespace-nowrap">
                Target Sell Out: {formatCompactIdr(salesMetrics.totalTgtOut)}
              </span>
            )}
            {(isSellInOnly || isSellOutOnly) && (
              <span className="text-[10.5px] font-sans text-slate-400 mt-0.5 block">
                {sales.length} Sales · {areas.length} Area Aktif
              </span>
            )}
          </div>

          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
              {isSellOutOnly
                ? 'Total Aktual Sell Out'
                : isSellInOnly
                ? 'Total Aktual Sell In'
                : 'Total Aktual Tim (In / Out)'}
            </span>
            <span
              className={`text-base sm:text-lg font-black mt-1 block whitespace-nowrap ${
                isSellOutOnly ? 'text-[#00D2FF]' : 'text-[#FF6B00]'
              }`}
              title={formatRupiah(headlineActual)}
            >
              {formatRupiah(headlineActual)}
            </span>
            {!isSellInOnly && !isSellOutOnly ? (
              <span className="text-[10.5px] text-cyan-300 font-bold mt-0.5 block whitespace-nowrap">
                Aktual Sell Out: {formatCompactIdr(salesMetrics.totalActOut)}
              </span>
            ) : (
              <span
                className={`text-[10.5px] font-bold mt-0.5 block whitespace-nowrap ${
                  headlineGap >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                Gap: {headlineGap >= 0 ? '+' : '-'}
                {formatCompactIdr(Math.abs(headlineGap))}
              </span>
            )}
          </div>

          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
              {isSellOutOnly
                ? 'Pencapaian Sell Out (Achv)'
                : isSellInOnly
                ? 'Pencapaian Sell In (Achv)'
                : 'Pencapaian Tim (In & Out)'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-lg font-black ${
                  headlinePct >= 100
                    ? 'text-emerald-400'
                    : headlinePct >= 75
                    ? 'text-cyan-400'
                    : 'text-amber-400'
                }`}
              >
                {headlinePct.toFixed(1)}%
              </span>
              {!isSellInOnly && !isSellOutOnly && (
                <span className="text-xs font-bold text-cyan-300">
                  · Out: {salesMetrics.totalPctOut.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-[#1D283A] rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  headlinePct >= 100
                    ? 'bg-emerald-500'
                    : isSellOutOnly
                    ? 'bg-[#00D2FF]'
                    : 'bg-[#FF6B00]'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, headlinePct))}%` }}
              />
            </div>
          </div>

          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-sans font-bold uppercase text-emerald-400 flex items-center gap-1">
              <Crown className="w-3 h-3" />
              Top Sales ({isSellOutOnly ? 'Sell Out' : 'Sell In'})
            </span>
            {salesMetrics.topSales ? (
              <>
                <span className="text-sm sm:text-base font-sans font-black text-white mt-1 block truncate">
                  {salesMetrics.topSales.salesName}
                </span>
                <span className="text-[11px] font-bold text-emerald-400 mt-0.5 block whitespace-nowrap">
                  {(isSellOutOnly
                    ? salesMetrics.topSales.pctOut
                    : salesMetrics.topSales.pctIn
                  ).toFixed(1)}
                  % ·{' '}
                  {formatCompactIdr(
                    isSellOutOnly
                      ? salesMetrics.topSales.aOut
                      : salesMetrics.topSales.aIn
                  )}
                </span>
              </>
            ) : (
              <span className="text-xs font-sans text-slate-400 mt-1 block">Belum ada data</span>
            )}
          </div>
        </div>

        {/* COOL CHARTS SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          {/* LEFT CHART: Target vs Aktual & % Achv per Sales */}
          <div className="xl:col-span-8 bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Grafik Pencapaian Tim Sales:{' '}
                    {effectiveChartMetric === 'sell_out'
                      ? 'Target vs Aktual Sell Out'
                      : effectiveChartMetric === 'compare'
                      ? 'Komparasi Sell In vs Sell Out'
                      : 'Target vs Aktual Sell In'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Arahkan kursor atau klik batang sales untuk menyorot baris &amp; detail pencapaian.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isSellInOnly && !isSellOutOnly && (
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0B101A] border border-[#243147] text-[10.5px] font-bold">
                    <button
                      type="button"
                      onClick={() => setChartMetricMode('sell_in')}
                      className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                        chartMetricMode === 'sell_in'
                          ? 'bg-[#FF6B00] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sell In
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetricMode('sell_out')}
                      className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                        chartMetricMode === 'sell_out'
                          ? 'bg-[#00D2FF] text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sell Out
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetricMode('compare')}
                      className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                        chartMetricMode === 'compare'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      In vs Out
                    </button>
                  </div>
                )}

                <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0B101A] border border-[#243147] text-[10.5px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSortBy('achv')}
                    className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                      sortBy === 'achv'
                        ? 'bg-[#1E2B45] text-cyan-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Urut % Achv
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('actual')}
                    className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                      sortBy === 'actual'
                        ? 'bg-[#1E2B45] text-cyan-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Urut Omset
                  </button>
                </div>
              </div>
            </div>

            {/* Active Inspect Strip */}
            {activeSalesFocus && (
              <div className="px-3 py-2 rounded-lg bg-[#0B101A] border border-[#243147] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-extrabold uppercase text-[#00D2FF]">
                    {hoveredSalesIdx !== null
                      ? 'Sorotan Grafik'
                      : selectedSalesName
                      ? 'Sales Dipilih'
                      : 'Peringkat #1'}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="font-bold text-white truncate">{activeSalesFocus.salesName}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {activeSalesFocus.coverArea}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
                  {effectiveChartMetric === 'compare' ? (
                    <>
                      <span className="text-[#FF6B00] font-bold">
                        Sell In: {formatRupiah(activeSalesFocus.aIn)} ({activeSalesFocus.pctIn.toFixed(1)}%)
                      </span>
                      <span className="text-[#00D2FF] font-bold">
                        Sell Out: {formatRupiah(activeSalesFocus.aOut)} ({activeSalesFocus.pctOut.toFixed(1)}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-400">
                        Tgt:{' '}
                        <strong className="text-slate-200">
                          {formatRupiah(
                            effectiveChartMetric === 'sell_out'
                              ? activeSalesFocus.tOut
                              : activeSalesFocus.tIn
                          )}
                        </strong>
                      </span>
                      <span className="text-white font-extrabold">
                        Akt:{' '}
                        {formatRupiah(
                          effectiveChartMetric === 'sell_out'
                            ? activeSalesFocus.aOut
                            : activeSalesFocus.aIn
                        )}
                      </span>
                      {(() => {
                        const pct =
                          effectiveChartMetric === 'sell_out'
                            ? activeSalesFocus.pctOut
                            : activeSalesFocus.pctIn;
                        return (
                          <span
                            className={`font-black ${
                              pct >= 100
                                ? 'text-emerald-400'
                                : pct >= 75
                                ? 'text-cyan-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Vertical Bar Chart Canvas */}
            {salesMetrics.sorted.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Tidak ada data sales untuk filter yang dipilih.
              </div>
            ) : (
              <div className="flex items-stretch gap-3 pt-1">
                {/* Y Axis */}
                <div className="hidden sm:flex flex-col justify-between text-right font-mono text-[10px] text-slate-500 tabular-nums py-7 pr-2 border-r border-[#1E293B] shrink-0 w-16">
                  <span>{formatCompactIdr(salesMetrics.maxChartValue)}</span>
                  <span>{formatCompactIdr(salesMetrics.maxChartValue * 0.5)}</span>
                  <span>Rp 0</span>
                </div>

                {/* Bars */}
                <div className="flex-1 flex items-end gap-2 sm:gap-3.5 h-56 pt-8 pb-1 overflow-x-auto">
                  {salesMetrics.sorted.map((item, idx) => {
                    const isSelected = selectedSalesName === item.salesName;
                    const isHovered = hoveredSalesIdx === idx;
                    const primaryTgt =
                      effectiveChartMetric === 'sell_out' ? item.tOut : item.tIn;
                    const primaryAct =
                      effectiveChartMetric === 'sell_out' ? item.aOut : item.aIn;
                    const primaryPct =
                      effectiveChartMetric === 'sell_out' ? item.pctOut : item.pctIn;

                    const tgtHeightPct =
                      salesMetrics.maxChartValue > 0
                        ? Math.max(6, (primaryTgt / salesMetrics.maxChartValue) * 100)
                        : 6;
                    const actHeightPct =
                      salesMetrics.maxChartValue > 0
                        ? Math.max(6, (primaryAct / salesMetrics.maxChartValue) * 100)
                        : 6;
                    const outHeightPct =
                      salesMetrics.maxChartValue > 0
                        ? Math.max(6, (item.aOut / salesMetrics.maxChartValue) * 100)
                        : 6;

                    return (
                      <button
                        key={item.salesName}
                        type="button"
                        onClick={() =>
                          setSelectedSalesName((prev) =>
                            prev === item.salesName ? null : item.salesName
                          )
                        }
                        onMouseEnter={() => setHoveredSalesIdx(idx)}
                        onMouseLeave={() => setHoveredSalesIdx(null)}
                        className={`flex-1 min-w-[74px] flex flex-col items-center h-full justify-end rounded-lg px-1.5 py-1 transition-colors cursor-pointer focus:outline-none ${
                          isSelected
                            ? 'bg-[#17263D] ring-1 ring-[#00D2FF]/50'
                            : isHovered
                            ? 'bg-[#151F33]'
                            : ''
                        }`}
                      >
                        <div className="mb-1.5 flex flex-col items-center">
                          <span
                            className={`text-[10.5px] font-mono font-black tabular-nums leading-none ${
                              primaryPct >= 100
                                ? 'text-emerald-400'
                                : primaryPct >= 75
                                ? 'text-cyan-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {primaryPct.toFixed(1)}%
                          </span>
                          <span className="text-[9.5px] font-mono font-bold text-slate-300 tabular-nums mt-0.5 whitespace-nowrap">
                            {formatCompactIdr(primaryAct)}
                          </span>
                        </div>

                        <div className="w-full h-full flex items-end justify-center gap-1.5 px-1">
                          {effectiveChartMetric === 'compare' ? (
                            <>
                              <div
                                style={{ height: `${actHeightPct}%` }}
                                title={`Aktual Sell In ${item.salesName}: ${formatRupiah(item.aIn)}`}
                                className="w-5 sm:w-6 rounded-t-md bg-gradient-to-t from-[#EA580C] to-[#FF8533] transition-all duration-200"
                              />
                              <div
                                style={{ height: `${outHeightPct}%` }}
                                title={`Aktual Sell Out ${item.salesName}: ${formatRupiah(item.aOut)}`}
                                className="w-5 sm:w-6 rounded-t-md bg-gradient-to-t from-[#0284C7] to-[#00D2FF] transition-all duration-200"
                              />
                            </>
                          ) : (
                            <>
                              <div
                                style={{ height: `${tgtHeightPct}%` }}
                                title={`Target ${item.salesName}: ${formatRupiah(primaryTgt)}`}
                                className="w-3.5 sm:w-4 rounded-t-sm bg-[#1E293B] border border-slate-600/80 transition-all duration-200"
                              />
                              <div
                                style={{ height: `${actHeightPct}%` }}
                                title={`Aktual ${item.salesName}: ${formatRupiah(primaryAct)}`}
                                className={`w-5 sm:w-7 rounded-t-md transition-all duration-200 ${
                                  primaryPct >= 100
                                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                                    : effectiveChartMetric === 'sell_out'
                                    ? 'bg-gradient-to-t from-cyan-600 to-[#00D2FF]'
                                    : 'bg-gradient-to-t from-[#EA580C] to-[#FF8533]'
                                }`}
                              />
                            </>
                          )}
                        </div>

                        <div className="mt-2 text-center w-full">
                          <span className="block text-[10px] font-extrabold text-white truncate">
                            {item.salesName}
                          </span>
                          <span className="block text-[9px] text-slate-400 truncate">
                            {item.coverArea}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chart Legend */}
            <div className="pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-4">
                {effectiveChartMetric === 'compare' ? (
                  <>
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#FF6B00] inline-block" />
                      Aktual Sell In
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#00D2FF] inline-block" />
                      Aktual Sell Out
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#1E293B] border border-slate-500 inline-block" />
                      Target ({effectiveChartMetric === 'sell_out' ? 'Sell Out' : 'Sell In'})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs inline-block ${
                          effectiveChartMetric === 'sell_out' ? 'bg-[#00D2FF]' : 'bg-[#FF6B00]'
                        }`}
                      />
                      Aktual (&lt;100%)
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                      Target Capai (≥100%)
                    </span>
                  </>
                )}
              </div>
              {selectedSalesName && (
                <button
                  type="button"
                  onClick={() => setSelectedSalesName(null)}
                  className="text-cyan-300 font-bold hover:underline cursor-pointer"
                >
                  Hapus Sorotan ({selectedSalesName})
                </button>
              )}
            </div>
          </div>

          {/* RIGHT CHART: Area & Supervisor Achievement Gauge + Sales Share Donut */}
          <div className="xl:col-span-4 bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col justify-between gap-3">
            {/* Area & SPV Achievement Bars */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Pencapaian Area &amp; Supervisor
                </h3>
                <span className="text-[10px] font-mono font-bold text-[#FF6B00]">
                  {areas.length} Area · {spvs.length} SPV
                </span>
              </div>

              <div className="space-y-2.5">
                {areaMetrics.rows.map((a) => {
                  const pct = effectiveChartMetric === 'sell_out' ? a.pctOut : a.pctIn;
                  const act = effectiveChartMetric === 'sell_out' ? a.aOut : a.aIn;
                  const tgt = effectiveChartMetric === 'sell_out' ? a.tOut : a.tIn;
                  const barW = Math.max(2, Math.min(100, pct));
                  return (
                    <div
                      key={a.coverArea}
                      className="p-2.5 rounded-lg bg-[#0B101A] border border-[#1E293B] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-extrabold text-white block truncate">
                            {a.coverArea}
                          </span>
                          <span className="text-[10.5px] text-slate-400 block truncate">
                            SPV: {a.spvLabel} · {a.salesCount} Sales
                          </span>
                        </div>
                        <span
                          className={`font-mono tabular-nums text-sm font-black shrink-0 ${
                            pct >= 100
                              ? 'text-emerald-400'
                              : pct >= 75
                              ? 'text-cyan-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-[#161F30] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            pct >= 100
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                              : effectiveChartMetric === 'sell_out'
                              ? 'bg-gradient-to-r from-cyan-600 to-[#00D2FF]'
                              : 'bg-gradient-to-r from-[#EA580C] to-[#FF8533]'
                          }`}
                          style={{ width: `${barW}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums text-slate-400">
                        <span>Aktual: {formatCompactIdr(act)}</span>
                        <span>Target: {formatCompactIdr(tgt)}</span>
                      </div>
                      {effectiveChartMetric !== 'sell_out' && (a.kaMgSellIn || 0) > 0 && (
                        <div className="text-[9.5px] font-mono tabular-nums text-cyan-300/90">
                          Reg {formatCompactIdr(a.regularSellIn ?? 0)} + KA &amp; MG {formatCompactIdr(a.kaMgSellIn ?? 0)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kontribusi Tim Sales Donut */}
            <div className="pt-3 border-t border-[#1E293B] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  Kontribusi Omset Tim Sales (
                  {effectiveChartMetric === 'sell_out' ? 'Sell Out' : 'Sell In'})
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatCompactIdr(shareBreakdown.totalAct)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-[108px] h-[108px] shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r={shareBreakdown.r}
                      fill="none"
                      stroke="#1B2436"
                      strokeWidth="16"
                    />
                    {shareBreakdown.segments.map((seg) => (
                      <circle
                        key={seg.name}
                        cx="60"
                        cy="60"
                        r={shareBreakdown.r}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={selectedSalesName === seg.name ? 19 : 16}
                        strokeDasharray={`${seg.strokeLength} ${shareBreakdown.circ}`}
                        strokeDashoffset={seg.strokeOffset}
                        className="cursor-pointer transition-all duration-150"
                        onClick={() =>
                          setSelectedSalesName((prev) =>
                            prev === seg.name ? null : seg.name
                          )
                        }
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-1">
                    <span className="text-xs font-black font-mono tabular-nums text-white leading-none">
                      {shareBreakdown.items[0]
                        ? `${shareBreakdown.items[0].share.toFixed(0)}%`
                        : '0%'}
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-400 truncate max-w-[64px] mt-0.5">
                      {shareBreakdown.items[0]?.name || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1 text-[11px]">
                  {shareBreakdown.items.slice(0, 6).map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() =>
                        setSelectedSalesName((prev) =>
                          prev === item.name ? null : item.name
                        )
                      }
                      className={`w-full flex items-center justify-between gap-2 px-1.5 py-0.5 rounded transition-colors cursor-pointer text-left ${
                        selectedSalesName === item.name
                          ? 'bg-[#17263D]'
                          : 'hover:bg-[#172033]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-200 truncate">
                          {item.name}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-300 shrink-0">
                        {item.share.toFixed(1)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FULL-WIDTH TABLES SO ALL COLUMNS ARE 100% VISIBLE ON SCREEN */}
        {/* TABLE 1: DAFTAR PENCAPAIAN TIM SALES */}
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0E1523] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#00D2FF]">
              Daftar Pencapaian Tim Sales ({salesMetrics.sorted.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {isSellInOnly
                ? 'Menampilkan Kolom: Sales · Area · Target Sell In · Aktual Sell In · Achv'
                : isSellOutOnly
                ? 'Menampilkan Kolom: Sales · Area · Target Sell Out · Aktual Sell Out · Achv'
                : 'Menampilkan Sell In & Sell Out Lengkap'}
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#0B101A]">
                <tr className="text-[10.5px] uppercase text-slate-400 border-b border-[#1E293B]">
                  <th className="py-2.5 px-3 font-bold">Sales</th>
                  <th className="py-2.5 px-3 font-bold">Area</th>
                  {!isSellOutOnly && (
                    <>
                      <th className="py-2.5 px-3 text-right font-bold">Target Sell In</th>
                      <th className="py-2.5 px-3 text-right font-bold">Aktual Sell In</th>
                      <th className="py-2.5 px-3 text-right font-bold">
                        {isSellInOnly ? 'Achv' : 'Achv In'}
                      </th>
                    </>
                  )}
                  {!isSellInOnly && (
                    <>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-300">
                        Target Sell Out
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-300">
                        Aktual Sell Out
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-300">
                        {isSellOutOnly ? 'Achv' : 'Achv Out'}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                {salesMetrics.sorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSellInOnly || isSellOutOnly ? 5 : 8}
                      className="py-8 text-center font-sans text-slate-400"
                    >
                      Tidak ada data pencapaian sales pada filter aktif.
                    </td>
                  </tr>
                ) : (
                  salesMetrics.sorted.map((s) => {
                    const isHighlighted = selectedSalesName === s.salesName;
                    return (
                      <tr
                        key={s.salesName}
                        onClick={() =>
                          setSelectedSalesName((prev) =>
                            prev === s.salesName ? null : s.salesName
                          )
                        }
                        className={`transition-colors cursor-pointer ${
                          isHighlighted ? 'bg-[#17263D]' : 'hover:bg-[#172033]'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-bold text-white whitespace-nowrap">
                          {s.salesName}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300 whitespace-nowrap">
                          {s.coverArea}
                        </td>
                        {!isSellOutOnly && (
                          <>
                            <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                              {formatRupiah(s.tIn)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                              {formatRupiah(s.aIn)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                                s.pctIn >= 100
                                  ? 'text-emerald-400'
                                  : s.pctIn >= 75
                                  ? 'text-cyan-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {s.pctIn.toFixed(1)}%
                            </td>
                          </>
                        )}
                        {!isSellInOnly && (
                          <>
                            <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                              {formatRupiah(s.tOut)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#00D2FF] whitespace-nowrap">
                              {formatRupiah(s.aOut)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                                s.pctOut >= 100
                                  ? 'text-emerald-400'
                                  : s.pctOut >= 75
                                  ? 'text-cyan-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {s.pctOut.toFixed(1)}%
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {salesMetrics.sorted.length > 0 && (
                <tfoot className="bg-[#0E1523] border-t border-[#243147] font-mono tabular-nums text-xs">
                  <tr>
                    <td className="py-2.5 px-3 font-sans font-extrabold uppercase text-slate-200 whitespace-nowrap">
                      Total Tim Sales ({salesMetrics.sorted.length})
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400 whitespace-nowrap">
                      Semua Area
                    </td>
                    {!isSellOutOnly && (
                      <>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-300 whitespace-nowrap">
                          {formatRupiah(salesMetrics.totalTgtIn)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#FF6B00] whitespace-nowrap">
                          {formatRupiah(salesMetrics.totalActIn)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                            salesMetrics.totalPctIn >= 100
                              ? 'text-emerald-400'
                              : salesMetrics.totalPctIn >= 75
                              ? 'text-cyan-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {salesMetrics.totalPctIn.toFixed(1)}%
                        </td>
                      </>
                    )}
                    {!isSellInOnly && (
                      <>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-300 whitespace-nowrap">
                          {formatRupiah(salesMetrics.totalTgtOut)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#00D2FF] whitespace-nowrap">
                          {formatRupiah(salesMetrics.totalActOut)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                            salesMetrics.totalPctOut >= 100
                              ? 'text-emerald-400'
                              : salesMetrics.totalPctOut >= 75
                              ? 'text-cyan-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {salesMetrics.totalPctOut.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* TABLE 2: DAFTAR AREA & SUPERVISOR */}
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0E1523] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#FF6B00]">
              Daftar Area &amp; Supervisor ({areaMetrics.rows.length} Area)
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {isSellInOnly
                ? 'Menampilkan Kolom: Cover Area · Supervisor · Target Sell In · Aktual Sell In · Achv'
                : isSellOutOnly
                ? 'Menampilkan Kolom: Cover Area · Supervisor · Target Sell Out · Aktual Sell Out · Achv'
                : 'Menampilkan Sell In & Sell Out Area & Supervisor'}
            </span>
          </div>

          {!isSellOutOnly && spvs.length > 0 && (
            <div className="px-4 py-2.5 border-b border-[#1E293B] bg-[#0B101A] flex flex-wrap items-center justify-between gap-3 text-xs">
              {spvs.map((sp) => (
                <div key={sp.spvName} className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                  <span className="font-sans text-[10.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    SPV {sp.spvName}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Target Sell In: <strong className="text-slate-200">{formatRupiah(sp.targetOmzet)}</strong>
                  </span>
                  <span className="text-slate-300 text-[11px]">
                    Aktual Sell In: <strong className="text-[#FF6B00]">{formatRupiah(sp.actualSellIn)}</strong>
                    {(sp.kaMgSellIn || 0) > 0 && (
                      <span className="text-cyan-300 ml-1.5 text-[10px]">
                        (Reg {formatCompactIdr(sp.regularSellIn ?? 0)} + KA &amp; MG {formatCompactIdr(sp.kaMgSellIn ?? 0)})
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-black text-[11px] ${
                      sp.achievementPct >= 100
                        ? 'text-emerald-400'
                        : sp.achievementPct >= 75
                        ? 'text-cyan-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {sp.achievementPct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#0B101A]">
                <tr className="text-[10.5px] uppercase text-slate-400 border-b border-[#1E293B]">
                  <th className="py-2.5 px-3 font-bold">Cover Area</th>
                  <th className="py-2.5 px-3 font-bold">Supervisor</th>
                  {!isSellOutOnly && (
                    <>
                      <th className="py-2.5 px-3 text-right font-bold">Target Sell In</th>
                      <th className="py-2.5 px-3 text-right font-bold">Aktual Sell In</th>
                      <th className="py-2.5 px-3 text-right font-bold">
                        {isSellInOnly ? 'Achv' : 'Achv In'}
                      </th>
                    </>
                  )}
                  {!isSellInOnly && (
                    <>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-300">
                        Target Sell Out
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-300">
                        Aktual Sell Out
                      </th>
                      <th className="py-2.5 px-3 text-right font-bold text-cyan-300">
                        {isSellOutOnly ? 'Achv' : 'Achv Out'}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                {areaMetrics.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSellInOnly || isSellOutOnly ? 5 : 8}
                      className="py-8 text-center font-sans text-slate-400"
                    >
                      Tidak ada data area &amp; supervisor pada filter aktif.
                    </td>
                  </tr>
                ) : (
                  areaMetrics.rows.map((a) => (
                    <tr key={a.coverArea} className="hover:bg-[#172033] transition-colors">
                      <td className="py-2.5 px-3 font-sans font-bold text-white whitespace-nowrap">
                        {a.coverArea}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300 whitespace-nowrap">
                        {a.spvLabel}
                      </td>
                      {!isSellOutOnly && (
                        <>
                          <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                            {formatRupiah(a.tIn)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                            <div>{formatRupiah(a.aIn)}</div>
                            {(a.kaMgSellIn || 0) > 0 && (
                              <div className="text-[10px] font-normal text-cyan-300/90 mt-0.5">
                                Reg {formatCompactIdr(a.regularSellIn ?? 0)} + KA &amp; MG {formatCompactIdr(a.kaMgSellIn ?? 0)}
                              </div>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                              a.pctIn >= 100
                                ? 'text-emerald-400'
                                : a.pctIn >= 75
                                ? 'text-cyan-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {a.pctIn.toFixed(1)}%
                          </td>
                        </>
                      )}
                      {!isSellInOnly && (
                        <>
                          <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                            {formatRupiah(a.tOut)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#00D2FF] whitespace-nowrap">
                            {formatRupiah(a.aOut)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                              a.pctOut >= 100
                                ? 'text-emerald-400'
                                : a.pctOut >= 75
                                ? 'text-cyan-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {a.pctOut.toFixed(1)}%
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {areaMetrics.rows.length > 0 && (
                <tfoot className="bg-[#0E1523] border-t border-[#243147] font-mono tabular-nums text-xs">
                  <tr>
                    <td className="py-2.5 px-3 font-sans font-extrabold uppercase text-slate-200 whitespace-nowrap">
                      Total Area ({areaMetrics.rows.length})
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400 whitespace-nowrap">
                      {spvs.length} SPV
                    </td>
                    {!isSellOutOnly && (
                      <>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-300 whitespace-nowrap">
                          {formatRupiah(areaMetrics.totalTgtIn)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#FF6B00] whitespace-nowrap">
                          {formatRupiah(areaMetrics.totalActIn)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                            areaMetrics.totalPctIn >= 100
                              ? 'text-emerald-400'
                              : areaMetrics.totalPctIn >= 75
                              ? 'text-cyan-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {areaMetrics.totalPctIn.toFixed(1)}%
                        </td>
                      </>
                    )}
                    {!isSellInOnly && (
                      <>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-300 whitespace-nowrap">
                          {formatRupiah(areaMetrics.totalTgtOut)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#00D2FF] whitespace-nowrap">
                          {formatRupiah(areaMetrics.totalActOut)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                            areaMetrics.totalPctOut >= 100
                              ? 'text-emerald-400'
                              : areaMetrics.totalPctOut >= 75
                              ? 'text-cyan-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {areaMetrics.totalPctOut.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }
);

// Isolated Memoized Store Gap Table (deferred search + smart row limit so typing/clicking stays instant)
const TargetsGapPanel: React.FC<{
  storeGapDetails: StoreGapDetailItem[];
  totalStoreGapDeficit: number;
  gapPreviousPeriodName: string;
  gapCurrentPeriodName: string;
  ketFilter?: string;
  onChangeKet?: (ket: string) => void;
}> = React.memo(
  ({
    storeGapDetails,
    totalStoreGapDeficit,
    gapPreviousPeriodName,
    gapCurrentPeriodName,
    ketFilter = 'ALL',
    onChangeKet,
  }) => {
    const [storeGapSearch, setStoreGapSearch] = useState<string>('');
    const deferredSearch = useDeferredValue(storeGapSearch);
    const [storeGapCategory, setStoreGapCategory] = useState<
      'ALL' | 'lost_outlet' | 'volume_drop' | 'return_impact'
    >('ALL');
    const [showAllRows, setShowAllRows] = useState<boolean>(false);

    const activeKet = (ketFilter || 'ALL').trim().toUpperCase();
    const isSellOutFocus = activeKet === 'SELL OUT';
    const isSellInFocus = activeKet === 'SELL IN';
    const effectiveStoreGapCategory =
      (isSellOutFocus || isSellInFocus) && storeGapCategory === 'return_impact'
        ? 'ALL'
        : storeGapCategory;

    const storeGapStats = useMemo(() => {
      const scopedRows = isSellOutFocus
        ? storeGapDetails
            .filter((st) => st.sellOutCurrent - st.sellOutPrevious < 0)
            .sort(
              (a, b) =>
                a.sellOutCurrent -
                a.sellOutPrevious -
                (b.sellOutCurrent - b.sellOutPrevious)
            )
        : isSellInFocus
        ? storeGapDetails
            .filter((st) => st.sellInCurrent - st.sellInPrevious < 0)
            .sort(
              (a, b) =>
                a.sellInCurrent -
                a.sellInPrevious -
                (b.sellInCurrent - b.sellInPrevious)
            )
        : storeGapDetails;

      let lostCount = 0;
      let volCount = 0;
      let retCount = 0;
      let lostSum = 0;
      let volSum = 0;
      let totalSellInDeficit = 0;
      let totalSellOutDeficit = 0;

      for (let i = 0; i < scopedRows.length; i++) {
        const st = scopedRows[i];
        const focusedDeficit = isSellOutFocus
          ? Math.max(0, st.sellOutPrevious - st.sellOutCurrent)
          : isSellInFocus
          ? Math.max(0, st.sellInPrevious - st.sellInCurrent)
          : st.deficitValue || 0;

        if (st.gapCategory === 'lost_outlet') {
          lostCount += 1;
          lostSum += focusedDeficit;
        } else if (st.gapCategory === 'return_impact') {
          retCount += 1;
        } else {
          volCount += 1;
          volSum += focusedDeficit;
        }
        totalSellInDeficit += Math.max(0, st.sellInPrevious - st.sellInCurrent);
        totalSellOutDeficit += Math.max(0, st.sellOutPrevious - st.sellOutCurrent);
      }

      const q = deferredSearch.trim().toLowerCase();
      const filtered = scopedRows.filter((st) => {
        if (effectiveStoreGapCategory !== 'ALL' && st.gapCategory !== effectiveStoreGapCategory) return false;
        if (q) {
          return (
            st.storeName.toLowerCase().includes(q) ||
            st.salesName.toLowerCase().includes(q) ||
            st.spvName.toLowerCase().includes(q) ||
            st.region.toLowerCase().includes(q) ||
            st.primaryReason.toLowerCase().includes(q)
          );
        }
        return true;
      });

      const filteredTotals = filtered.reduce(
        (acc, st) => {
          acc.inPrev += st.sellInPrevious;
          acc.inCur += st.sellInCurrent;
          acc.outPrev += st.sellOutPrevious;
          acc.outCur += st.sellOutCurrent;
          acc.deficit += st.deficitValue;
          return acc;
        },
        { inPrev: 0, inCur: 0, outPrev: 0, outCur: 0, deficit: 0 }
      );

      return {
        allCount: scopedRows.length,
        lostCount,
        volCount,
        retCount,
        lostSum,
        volSum,
        totalSellInDeficit,
        totalSellOutDeficit,
        filtered,
        filteredTotals,
      };
    }, [storeGapDetails, deferredSearch, effectiveStoreGapCategory, isSellOutFocus, isSellInFocus]);

    const visibleRows = showAllRows
      ? storeGapStats.filtered
      : storeGapStats.filtered.slice(0, 120);

    return (
      <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col gap-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#FF6B00]" />
                <span>Rincian Sumber Data Gap Penjualan per Toko</span>
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                  isSellOutFocus
                    ? 'bg-[#00D2FF]/15 text-[#00D2FF] border-[#00D2FF]/40'
                    : isSellInFocus
                    ? 'bg-[#FF6B00]/15 text-[#FFB067] border-[#FF6B00]/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isSellOutFocus
                  ? 'FOKUS: SELL OUT (GAP OUT MINUS TERBESAR)'
                  : isSellInFocus
                  ? 'FOKUS: SELL IN (GAP IN MINUS TERBESAR)'
                  : 'SEMUA TIPE (SELL IN & SELL OUT)'}
              </span>
              <span className="text-[10px] font-bold text-[#00D2FF] font-mono">
                {gapPreviousPeriodName} vs {gapCurrentPeriodName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isSellOutFocus
                ? 'Menampilkan Gap Out mulai dari minus paling tinggi sesuai data Google Sheet yang terhubung'
                : isSellInFocus
                ? 'Menampilkan Gap In mulai dari minus paling tinggi sesuai data Google Sheet yang terhubung'
                : 'Seluruh kolom Sell In/Out (Lalu & Skg), Gap, Defisit, Growth & Porsi sesuai data Google Sheet yang terhubung'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onChangeKet && (
              <div className="flex items-center gap-0.5 p-0.5 bg-[#0D121D] rounded-lg border border-[#243147] text-[10px] font-bold">
                {(
                  [
                    { value: 'ALL', label: 'Semua' },
                    { value: 'SELL IN', label: 'Sell In' },
                    { value: 'SELL OUT', label: 'Sell Out' },
                  ] as const
                ).map((opt) => {
                  const isActive = activeKet === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChangeKet(opt.value)}
                      className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                        isActive
                          ? opt.value === 'SELL OUT'
                            ? 'bg-[#00D2FF] text-slate-950'
                            : opt.value === 'SELL IN'
                            ? 'bg-[#FF6B00] text-white'
                            : 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={storeGapSearch}
                onChange={(e) => setStoreGapSearch(e.target.value)}
                placeholder="Cari toko, sales, SPV..."
                className="w-full pl-8 pr-7 py-1 text-[11px] rounded-lg bg-[#0D121D] border border-[#243147] text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00]"
              />
              {storeGapSearch && (
                <button
                  type="button"
                  onClick={() => setStoreGapSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1 p-0.5 bg-[#0D121D] rounded-lg border border-[#243147] text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setStoreGapCategory('ALL')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  effectiveStoreGapCategory === 'ALL'
                    ? 'bg-[#FF6B00] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua ({storeGapStats.allCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreGapCategory('lost_outlet')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  effectiveStoreGapCategory === 'lost_outlet'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-rose-300'
                }`}
              >
                Toko Pasif ({storeGapStats.lostCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreGapCategory('volume_drop')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  effectiveStoreGapCategory === 'volume_drop'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Turun Order ({storeGapStats.volCount})
              </button>
              {!isSellOutFocus && !isSellInFocus && (
                <button
                  type="button"
                  onClick={() => setStoreGapCategory('return_impact')}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    effectiveStoreGapCategory === 'return_impact'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-purple-300'
                  }`}
                >
                  Retur ({storeGapStats.retCount})
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono tabular-nums">
          <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-rose-300 text-[11px]">
              {isSellOutFocus
                ? `Nihil Sell Out (${storeGapStats.lostCount})`
                : isSellInFocus
                ? `Nihil Sell In (${storeGapStats.lostCount})`
                : `Toko Pasif (${storeGapStats.lostCount})`}
            </span>
            <span className="font-black text-rose-400 whitespace-nowrap">
              -{formatRupiah(storeGapStats.lostSum)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-amber-300 text-[11px]">
              {isSellOutFocus
                ? `Turun Sell Out (${storeGapStats.volCount})`
                : isSellInFocus
                ? `Turun Sell In (${storeGapStats.volCount})`
                : `Turun Order (${storeGapStats.volCount})`}
            </span>
            <span className="font-black text-amber-400 whitespace-nowrap">
              -{formatRupiah(storeGapStats.volSum)}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#0D121D] border border-[#243147] flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-slate-300 text-[11px]">
              {isSellOutFocus
                ? `Total Gap Out Minus (${storeGapStats.allCount} Toko)`
                : isSellInFocus
                ? `Total Gap In Minus (${storeGapStats.allCount} Toko)`
                : `Total Defisit Toko (${storeGapStats.allCount})`}
            </span>
            <span
              className={`font-black whitespace-nowrap ${
                isSellOutFocus ? 'text-[#00D2FF]' : 'text-[#FF6B00]'
              }`}
            >
              -
              {formatRupiah(
                isSellOutFocus
                  ? storeGapStats.totalSellOutDeficit
                  : isSellInFocus
                  ? storeGapStats.totalSellInDeficit
                  : totalStoreGapDeficit
              )}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto overflow-x-auto max-h-[540px] min-h-[260px] border border-[#1E293B] rounded-lg">
          <table className="w-full table-fixed text-[10px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0D121D]">
              <tr className="text-[9px] uppercase text-slate-400 border-b border-[#1E293B] leading-tight">
                <th className="py-2 px-1 text-center w-[3.5%]">No</th>
                <th className="py-2 px-1.5 w-[18%]">Nama Toko &amp; Area</th>
                <th className="py-2 px-1 w-[11%]">Sales / SPV</th>
                <th className="py-2 px-1.5 w-[21%]">
                  {isSellOutFocus
                    ? 'Penyebab Gap Out'
                    : isSellInFocus
                    ? 'Penyebab Gap In'
                    : 'Penyebab Gap'}
                </th>
                {isSellOutFocus ? (
                  <>
                    <th className="py-2 px-1.5 text-right w-[10%] text-slate-400">Out Lalu</th>
                    <th className="py-2 px-1.5 text-right w-[10%] text-[#00D2FF]">Out Skg</th>
                    <th className="py-2 px-1.5 text-right w-[12%] text-rose-300">
                      Gap Out (Minus ↓)
                    </th>
                    <th className="py-2 px-1.5 text-right w-[7.5%]">Growth</th>
                    <th className="py-2 px-1.5 text-right w-[7%] text-[#00D2FF]">Porsi Out</th>
                  </>
                ) : isSellInFocus ? (
                  <>
                    <th className="py-2 px-1.5 text-right w-[10%] text-slate-400">In Lalu</th>
                    <th className="py-2 px-1.5 text-right w-[10%] text-[#FF6B00]">In Skg</th>
                    <th className="py-2 px-1.5 text-right w-[12%] text-rose-300">
                      Gap In (Minus ↓)
                    </th>
                    <th className="py-2 px-1.5 text-right w-[7.5%]">Growth</th>
                    <th className="py-2 px-1.5 text-right w-[7%] text-[#FF6B00]">Porsi In</th>
                  </>
                ) : (
                  <>
                    <th className="py-2 px-1 text-right w-[6%] text-slate-400">In Lalu</th>
                    <th className="py-2 px-1 text-right w-[6%] text-[#FF6B00]">In Skg</th>
                    <th className="py-2 px-1 text-right w-[6.5%] text-[#FF6B00]">Gap In</th>
                    <th className="py-2 px-1 text-right w-[6%] text-slate-400">Out Lalu</th>
                    <th className="py-2 px-1 text-right w-[6%] text-[#00D2FF]">Out Skg</th>
                    <th className="py-2 px-1 text-right w-[6.5%] text-[#00D2FF]">Gap Out</th>
                    <th className="py-2 px-1 text-right w-[6.5%] text-rose-300">Defisit</th>
                    <th className="py-2 px-1 text-right w-[5.5%]">Growth</th>
                    <th className="py-2 px-1 text-right w-[4.5%]">P. In</th>
                    <th className="py-2 px-1 text-right w-[4.5%]">P. Out</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSellOutFocus || isSellInFocus ? 9 : 14}
                    className="py-8 text-center font-sans text-slate-500"
                  >
                    {isSellOutFocus
                      ? 'Tidak ada toko dengan Gap Out minus pada filter saat ini.'
                      : isSellInFocus
                      ? 'Tidak ada toko dengan Gap In minus pada filter saat ini.'
                      : 'Tidak ada toko penyumbang gap yang cocok dengan filter saat ini.'}
                  </td>
                </tr>
              ) : (
                visibleRows.map((st, idx) => {
                  const sellInGap = st.sellInCurrent - st.sellInPrevious;
                  const sellOutGap = st.sellOutCurrent - st.sellOutPrevious;
                  const sellInDef = Math.max(0, st.sellInPrevious - st.sellInCurrent);
                  const sellOutDef = Math.max(0, st.sellOutPrevious - st.sellOutCurrent);
                  const porsiIn =
                    storeGapStats.totalSellInDeficit > 0
                      ? (sellInDef / storeGapStats.totalSellInDeficit) * 100
                      : 0;
                  const porsiOut =
                    storeGapStats.totalSellOutDeficit > 0
                      ? (sellOutDef / storeGapStats.totalSellOutDeficit) * 100
                      : 0;

                  return (
                    <tr key={`${st.storeName}-${idx}`} className="hover:bg-[#172033]">
                      <td className="py-1.5 px-1 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-1.5 font-sans">
                        <div className="font-bold text-white truncate" title={st.storeName}>
                          {st.storeName}
                        </div>
                        <div className="text-[8.5px] text-slate-400 truncate" title={st.region}>
                          {st.region}
                        </div>
                      </td>
                      <td className="py-1.5 px-1 font-sans">
                        <div className="font-semibold text-slate-200 truncate" title={st.salesName}>
                          {st.salesName}
                        </div>
                        <div className="text-[8.5px] text-slate-400 truncate" title={`SPV: ${st.spvName}`}>
                          {st.spvName}
                        </div>
                      </td>
                      <td className="py-1.5 px-1.5 font-sans" title={st.primaryReason}>
                        <span
                          className={`text-[9px] font-bold block truncate ${
                            st.gapCategory === 'lost_outlet'
                              ? 'text-rose-400'
                              : st.gapCategory === 'return_impact'
                              ? 'text-purple-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {st.gapCategory === 'lost_outlet'
                            ? isSellOutFocus
                              ? 'Nihil Sell Out (0)'
                              : isSellInFocus
                              ? 'Nihil Sell In (0 PO)'
                              : 'Toko Pasif (0 Order)'
                            : st.gapCategory === 'return_impact'
                            ? 'Dampak Retur'
                            : isSellOutFocus
                            ? 'Turun Sell Out'
                            : isSellInFocus
                            ? 'Turun Sell In'
                            : 'Turun Order'}
                        </span>
                        <div className="text-[9px] text-slate-400 truncate">
                          {st.primaryReason}
                        </div>
                      </td>
                      {isSellOutFocus ? (
                        <>
                          <td
                            className="py-1.5 px-1.5 text-right text-slate-400 whitespace-nowrap"
                            title={formatRupiah(st.sellOutPrevious)}
                          >
                            {formatRupiah(st.sellOutPrevious, true)}
                          </td>
                          <td
                            className="py-1.5 px-1.5 text-right font-bold text-[#00D2FF] whitespace-nowrap"
                            title={formatRupiah(st.sellOutCurrent)}
                          >
                            {formatRupiah(st.sellOutCurrent, true)}
                          </td>
                          <td
                            className="py-1.5 px-1.5 text-right font-extrabold text-rose-400 whitespace-nowrap"
                            title={formatRupiah(sellOutGap)}
                          >
                            -{formatRupiah(Math.abs(sellOutGap))}
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-rose-400 whitespace-nowrap">
                            {st.growthPercent.toFixed(1)}%
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-[#00D2FF] whitespace-nowrap">
                            {porsiOut.toFixed(1)}%
                          </td>
                        </>
                      ) : isSellInFocus ? (
                        <>
                          <td
                            className="py-1.5 px-1.5 text-right text-slate-400 whitespace-nowrap"
                            title={formatRupiah(st.sellInPrevious)}
                          >
                            {formatRupiah(st.sellInPrevious, true)}
                          </td>
                          <td
                            className="py-1.5 px-1.5 text-right font-bold text-[#FF6B00] whitespace-nowrap"
                            title={formatRupiah(st.sellInCurrent)}
                          >
                            {formatRupiah(st.sellInCurrent, true)}
                          </td>
                          <td
                            className="py-1.5 px-1.5 text-right font-extrabold text-rose-400 whitespace-nowrap"
                            title={formatRupiah(sellInGap)}
                          >
                            -{formatRupiah(Math.abs(sellInGap))}
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-rose-400 whitespace-nowrap">
                            {st.growthPercent.toFixed(1)}%
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-bold text-[#FF6B00] whitespace-nowrap">
                            {porsiIn.toFixed(1)}%
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            className="py-1.5 px-1 text-right text-slate-400 whitespace-nowrap"
                            title={formatRupiah(st.sellInPrevious)}
                          >
                            {formatCompactIdr(st.sellInPrevious)}
                          </td>
                          <td
                            className="py-1.5 px-1 text-right font-bold text-white whitespace-nowrap"
                            title={formatRupiah(st.sellInCurrent)}
                          >
                            {formatCompactIdr(st.sellInCurrent)}
                          </td>
                          <td
                            className={`py-1.5 px-1 text-right font-bold whitespace-nowrap ${
                              sellInGap < 0
                                ? 'text-rose-400'
                                : sellInGap > 0
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                            title={formatRupiah(sellInGap)}
                          >
                            {sellInGap < 0
                              ? `-${formatCompactIdr(Math.abs(sellInGap))}`
                              : sellInGap > 0
                              ? `+${formatCompactIdr(sellInGap)}`
                              : '0'}
                          </td>
                          <td
                            className="py-1.5 px-1 text-right text-slate-400 whitespace-nowrap"
                            title={formatRupiah(st.sellOutPrevious)}
                          >
                            {formatCompactIdr(st.sellOutPrevious)}
                          </td>
                          <td
                            className="py-1.5 px-1 text-right font-bold text-[#00D2FF] whitespace-nowrap"
                            title={formatRupiah(st.sellOutCurrent)}
                          >
                            {formatCompactIdr(st.sellOutCurrent)}
                          </td>
                          <td
                            className={`py-1.5 px-1 text-right font-bold whitespace-nowrap ${
                              sellOutGap < 0
                                ? 'text-rose-400'
                                : sellOutGap > 0
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                            }`}
                            title={formatRupiah(sellOutGap)}
                          >
                            {sellOutGap < 0
                              ? `-${formatCompactIdr(Math.abs(sellOutGap))}`
                              : sellOutGap > 0
                              ? `+${formatCompactIdr(sellOutGap)}`
                              : '0'}
                          </td>
                          <td
                            className="py-1.5 px-1 text-right font-extrabold text-rose-400 whitespace-nowrap"
                            title={formatRupiah(st.deficitValue)}
                          >
                            -{formatCompactIdr(st.deficitValue)}
                          </td>
                          <td
                            className={`py-1.5 px-1 text-right font-bold whitespace-nowrap ${
                              st.growthPercent < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {st.growthPercent > 0 ? '+' : ''}
                            {st.growthPercent.toFixed(0)}%
                          </td>
                          <td className="py-1.5 px-1 text-right font-bold text-[#FF6B00] whitespace-nowrap">
                            {porsiIn.toFixed(1)}%
                          </td>
                          <td className="py-1.5 px-1 text-right font-bold text-[#00D2FF] whitespace-nowrap">
                            {porsiOut.toFixed(1)}%
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {storeGapStats.filtered.length > 0 && (() => {
              const ft = storeGapStats.filteredTotals;
              const totGapIn = ft.inCur - ft.inPrev;
              const totGapOut = ft.outCur - ft.outPrev;
              return (
                <tfoot className="sticky bottom-0 z-10 bg-[#0D121D] border-t-2 border-[#2A3952] font-mono tabular-nums text-[10px] font-black text-white">
                  <tr>
                    <td colSpan={4} className="py-2 px-2 text-right font-sans uppercase text-slate-300">
                      Total ({storeGapStats.filtered.length} Toko)
                    </td>
                    {isSellOutFocus ? (
                      <>
                        <td className="py-2 px-1.5 text-right text-slate-400 whitespace-nowrap">
                          {formatRupiah(ft.outPrev, true)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#00D2FF] whitespace-nowrap">
                          {formatRupiah(ft.outCur, true)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-rose-400 whitespace-nowrap">
                          {totGapOut < 0 ? `-${formatRupiah(Math.abs(totGapOut))}` : formatRupiah(totGapOut)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-rose-400 whitespace-nowrap">
                          {ft.outPrev > 0 ? `${((totGapOut / ft.outPrev) * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#00D2FF] whitespace-nowrap">
                          100.0%
                        </td>
                      </>
                    ) : isSellInFocus ? (
                      <>
                        <td className="py-2 px-1.5 text-right text-slate-400 whitespace-nowrap">
                          {formatRupiah(ft.inPrev, true)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#FF6B00] whitespace-nowrap">
                          {formatRupiah(ft.inCur, true)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-rose-400 whitespace-nowrap">
                          {totGapIn < 0 ? `-${formatRupiah(Math.abs(totGapIn))}` : formatRupiah(totGapIn)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-rose-400 whitespace-nowrap">
                          {ft.inPrev > 0 ? `${((totGapIn / ft.inPrev) * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="py-2 px-1.5 text-right text-[#FF6B00] whitespace-nowrap">
                          100.0%
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-1 text-right text-slate-400 whitespace-nowrap">
                          {formatCompactIdr(ft.inPrev)}
                        </td>
                        <td className="py-2 px-1 text-right text-white whitespace-nowrap">
                          {formatCompactIdr(ft.inCur)}
                        </td>
                        <td className={`py-2 px-1 text-right whitespace-nowrap ${totGapIn < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {totGapIn < 0 ? `-${formatCompactIdr(Math.abs(totGapIn))}` : `+${formatCompactIdr(totGapIn)}`}
                        </td>
                        <td className="py-2 px-1 text-right text-slate-400 whitespace-nowrap">
                          {formatCompactIdr(ft.outPrev)}
                        </td>
                        <td className="py-2 px-1 text-right text-[#00D2FF] whitespace-nowrap">
                          {formatCompactIdr(ft.outCur)}
                        </td>
                        <td className={`py-2 px-1 text-right whitespace-nowrap ${totGapOut < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {totGapOut < 0 ? `-${formatCompactIdr(Math.abs(totGapOut))}` : `+${formatCompactIdr(totGapOut)}`}
                        </td>
                        <td className="py-2 px-1 text-right text-rose-400 whitespace-nowrap">
                          -{formatCompactIdr(ft.deficit)}
                        </td>
                        <td className="py-2 px-1 text-right text-slate-400">-</td>
                        <td className="py-2 px-1 text-right text-[#FF6B00] whitespace-nowrap">
                          100%
                        </td>
                        <td className="py-2 px-1 text-right text-[#00D2FF] whitespace-nowrap">
                          100%
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>

        {storeGapStats.filtered.length > 120 && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>
              Menampilkan {visibleRows.length} dari {storeGapStats.filtered.length} toko
            </span>
            <button
              type="button"
              onClick={() => setShowAllRows((prev) => !prev)}
              className="px-2.5 py-1 rounded-md bg-[#192234] hover:bg-[#233049] text-[#00D2FF] font-bold border border-[#2A3952] cursor-pointer"
            >
              {showAllRows
                ? 'Ringkas ke 120 Baris'
                : `Tampilkan Semua (${storeGapStats.filtered.length} Toko)`}
            </button>
          </div>
        )}
      </div>
    );
  }
);

function parsePeriodOrderKey(periodStr: string): number {
  const parts = String(periodStr || '').trim().toUpperCase().split(/\s+/);
  let monthNum = 99;
  let yearNum = 2026;
  for (const p of parts) {
    if (MONTH_ORDER[p]) monthNum = MONTH_ORDER[p];
    else if (/^\d{4}$/.test(p)) yearNum = Number(p);
  }
  return yearNum * 100 + monthNum;
}

function formatShortMonthPeriod(periodStr: string): string {
  const parts = String(periodStr || '').trim().toUpperCase().split(/\s+/);
  const shortMap: Record<string, string> = {
    JANUARI: 'JAN',
    FEBRUARI: 'FEB',
    MARET: 'MAR',
    APRIL: 'APR',
    MEI: 'MEI',
    JUNI: 'JUN',
    JULI: 'JUL',
    AGUSTUS: 'AGT',
    SEPTEMBER: 'SEP',
    OKTOBER: 'OKT',
    NOVEMBER: 'NOV',
    DESEMBER: 'DES',
  };
  const m = shortMap[parts[0]] || parts[0]?.slice(0, 3) || '-';
  const y = parts[1] ? ` '${parts[1].slice(-2)}` : '';
  return `${m}${y}`;
}

const DASHBOARD_KPI_3_SALES = new Set(['ILHAMSYAH', 'TIWI', 'ALBERT FERNANDO']);

function syncKpiSalesItemsForDashboard(items: KpiSalesScorecardItem[]): KpiSalesScorecardItem[] {
  // 1. Sinkronkan setiap baris dengan override Target Sell Out per bulan dari Pusat Kelola Target
  const targetSynced = items.map((item) => {
    const monthTargets = loadSalesSellOutTargets(item.monthPeriod || 'ALL');
    const matchKey = Object.keys(monthTargets).find(
      (k) => k.toUpperCase().trim() === item.salesName.toUpperCase().trim()
    );
    const overrideTarget = matchKey ? monthTargets[matchKey] : undefined;
    if (overrideTarget && overrideTarget > 0 && overrideTarget !== item.sellOutTarget) {
      const newPct = (item.sellOutActual / overrideTarget) * 100;
      const calc = calculateKpiPoints({
        sellOutAchievementPct: newPct,
        overdueStoresUp45Count: item.overdueStoresUp45Count,
        visitLogsCount: item.visitLogsCount,
        baReportWeeklyPct: item.baReportWeeklyPct,
        baStockOpnameAppPct: item.baStockOpnameAppPct,
        storesUsingBufferAppPct: item.storesUsingBufferAppPct,
      });
      const finalTHP =
        item.baseSalary +
        item.sellInIncentive +
        item.baBonus -
        item.baPenalty +
        calc.kpiIncentive -
        calc.kpiPenalty -
        item.tagihanPenalty;
      return {
        ...item,
        sellOutTarget: overrideTarget,
        sellOutAchievementPct: newPct,
        pointSellOut: calc.pointSellOut,
        pointTagihan45H: calc.pointTagihan45H,
        pointKunjungan: calc.pointKunjungan,
        pointBaReportWeekly: calc.pointBaReportWeekly,
        pointBaStockOpname: calc.pointBaStockOpname,
        pointMonitoringBa: calc.pointMonitoringBa,
        pointBufferStock: calc.pointBufferStock,
        totalScore: calc.totalScore,
        grade: calc.grade,
        kpiIncentive: calc.kpiIncentive,
        kpiPenalty: calc.kpiPenalty,
        hasSp1: calc.hasSp1,
        finalTakeHomePay: finalTHP,
      };
    }
    return item;
  });

  // 2. Kumpulkan data ABDUL RAHIM per bulan untuk digabungkan ke Sell Out & Target Sell Out ALBERT FERNANDO
  const abdulByMonth = new Map<string, KpiSalesScorecardItem>();
  targetSynced.forEach((item) => {
    if (item.salesName.trim().toUpperCase() === 'ABDUL RAHIM') {
      abdulByMonth.set((item.monthPeriod || '').trim().toUpperCase(), item);
    }
  });

  // 3. Tampilkan hanya 3 Sales (ILHAMSYAH, TIWI, ALBERT FERNANDO) dengan penggabungan Sell Out Abdul Rahim -> Albert Fernando
  return targetSynced
    .filter((item) => DASHBOARD_KPI_3_SALES.has(item.salesName.trim().toUpperCase()))
    .map((item) => {
      if (item.salesName.trim().toUpperCase() !== 'ALBERT FERNANDO') return item;
      const periodKey = (item.monthPeriod || '').trim().toUpperCase();
      const abdul = abdulByMonth.get(periodKey);
      if (!abdul) return item;

      const combinedTarget = (item.sellOutTarget || 0) + (abdul.sellOutTarget || 0);
      const combinedActual = (item.sellOutActual || 0) + (abdul.sellOutActual || 0);
      const combinedPct = combinedTarget > 0 ? (combinedActual / combinedTarget) * 100 : 0;
      const calc = calculateKpiPoints({
        sellOutAchievementPct: combinedPct,
        overdueStoresUp45Count: item.overdueStoresUp45Count,
        visitLogsCount: item.visitLogsCount,
        baReportWeeklyPct: item.baReportWeeklyPct,
        baStockOpnameAppPct: item.baStockOpnameAppPct,
        storesUsingBufferAppPct: item.storesUsingBufferAppPct,
      });
      const finalTHP =
        item.baseSalary +
        item.sellInIncentive +
        item.baBonus -
        item.baPenalty +
        calc.kpiIncentive -
        calc.kpiPenalty -
        item.tagihanPenalty;

      return {
        ...item,
        sellOutTarget: combinedTarget,
        sellOutActual: combinedActual,
        sellOutAchievementPct: combinedPct,
        pointSellOut: calc.pointSellOut,
        pointTagihan45H: calc.pointTagihan45H,
        pointKunjungan: calc.pointKunjungan,
        pointBaReportWeekly: calc.pointBaReportWeekly,
        pointBaStockOpname: calc.pointBaStockOpname,
        pointMonitoringBa: calc.pointMonitoringBa,
        pointBufferStock: calc.pointBufferStock,
        totalScore: calc.totalScore,
        grade: calc.grade,
        kpiIncentive: calc.kpiIncentive,
        kpiPenalty: calc.kpiPenalty,
        hasSp1: calc.hasSp1,
        finalTakeHomePay: finalTHP,
      };
    });
}

function syncKpiTrainerItemsForDashboard(
  items: KpiTrainerScorecardItem[]
): KpiTrainerScorecardItem[] {
  const trainerConfigs = loadTrainerConfigs();
  return items.map((item) => {
    const monthTargets = loadTrainerTargets(item.monthPeriod || 'ALL');
    const cfg = trainerConfigs.find(
      (t) => t.trainerName.toUpperCase().trim() === item.trainerName.toUpperCase().trim()
    );
    const mOv =
      (cfg ? monthTargets[cfg.id] : undefined) ||
      monthTargets[item.trainerName] ||
      monthTargets[item.trainerName.toUpperCase()];

    if (mOv?.targetSellOut && mOv.targetSellOut > 0 && mOv.targetSellOut !== item.sellOutTarget) {
      const calc = calculateTrainerKpiPoints({
        sellOutTarget: mOv.targetSellOut,
        sellOutActual: item.sellOutActual,
        eventOmsetTarget: item.eventOmsetTarget,
        eventOmsetActual: item.eventOmsetActual,
        visitTarget: item.visitTarget,
        visitActual: item.visitActual,
        trainingTarget: item.trainingTarget,
        trainingActual: item.trainingActual,
        baProductivityTarget: item.baProductivityTarget,
        baProductivityActual: item.baProductivityActual,
      });
      return {
        ...item,
        sellOutTarget: mOv.targetSellOut,
        sellOutAchievementPct: calc.sellOutAchievementPct,
        pointSellOut: calc.pointSellOut,
        totalScore: calc.totalScore,
        grade: calc.grade,
        scoreCategory: calc.scoreCategory,
        hasSp1: calc.hasSp1,
      };
    }
    return item;
  });
}

const KPI_SALES_COLORS: Record<string, string> = {
  'ALBERT FERNANDO': '#10B981',
  ILHAMSYAH: '#00D2FF',
  TIWI: '#FF6B00',
  'ABDUL RAHIM': '#A855F7',
  PARETO: '#3B82F6',
  'LUAR KOTA': '#F59E0B',
};

// Isolated Memoized KPI Sales Panel (Monthly Trend Chart + Full-Column Scorecard Table)
const KpiSalesDashboardPanel: React.FC<{
  filters: DashboardFilters;
  selectedYear: number;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(({ filters, selectedYear, onNavigateTab }) => {
  const [rawItems, setRawItems] = useState<KpiSalesScorecardItem[]>(() =>
    getCachedKpiSalesItems(false)
  );
  const [chartViewMode, setChartViewMode] = useState<'per_sales' | 'team_avg'>('per_sales');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [highlightedSales, setHighlightedSales] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    period: string;
    salesName?: string;
    score: number;
    sellOutPct: number;
    grade: string;
    incentive: number;
  } | null>(null);

  useEffect(() => {
    const refresh = () => setRawItems(getCachedKpiSalesItems(true));
    window.addEventListener(TARGETS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Sync period filter with global BULAN when user picks a specific month in header
  useEffect(() => {
    if (!filters.BULAN || filters.BULAN === 'ALL') {
      setSelectedPeriod('ALL');
    } else {
      const upper = filters.BULAN.trim().toUpperCase();
      const target = upper.includes(String(selectedYear)) ? upper : `${upper} ${selectedYear}`;
      setSelectedPeriod(target);
    }
  }, [filters.BULAN, selectedYear]);

  const {
    monthsList,
    scopedAllMonthsItems,
    monthlySeries,
    tableRows,
    latestPeriodRows,
    summary,
  } = useMemo(() => {
    const salesFilterUpper =
      filters.SALES && filters.SALES !== 'ALL'
        ? filters.SALES.trim().toUpperCase() === 'ALBERT'
          ? 'ALBERT FERNANDO'
          : filters.SALES.trim().toUpperCase()
        : 'ALL';
    const regionFilterUpper =
      filters.REGION && filters.REGION !== 'ALL' ? filters.REGION.trim().toUpperCase() : 'ALL';

    const scoped = rawItems.filter((item) => {
      if (salesFilterUpper !== 'ALL' && item.salesName.trim().toUpperCase() !== salesFilterUpper) {
        return false;
      }
      if (regionFilterUpper !== 'ALL') {
        const areaMatch = (item.coverArea || '').toUpperCase().includes(regionFilterUpper);
        const cfg = SALES_MASTER_6_CONFIG[item.salesName];
        const cfgMatch = cfg ? cfg.area.toUpperCase().includes(regionFilterUpper) : false;
        if (!areaMatch && !cfgMatch) return false;
      }
      return true;
    });

    const periodSet = new Set<string>();
    scoped.forEach((i) => periodSet.add((i.monthPeriod || 'OKTOBER 2026').toUpperCase()));
    const sortedMonths = Array.from(periodSet).sort(
      (a, b) => parsePeriodOrderKey(a) - parsePeriodOrderKey(b)
    );

    const series = sortedMonths.map((period) => {
      const rows = scoped
        .filter((i) => (i.monthPeriod || '').toUpperCase() === period)
        .sort((a, b) => b.totalScore - a.totalScore || b.sellOutAchievementPct - a.sellOutAchievementPct);
      const count = rows.length;
      const avgScore =
        count > 0 ? rows.reduce((s, r) => s + (r.totalScore || 0), 0) / count : 0;
      const totalTgt = rows.reduce((s, r) => s + (r.sellOutTarget || 0), 0);
      const totalAct = rows.reduce((s, r) => s + (r.sellOutActual || 0), 0);
      const sellOutPct = totalTgt > 0 ? (totalAct / totalTgt) * 100 : 0;
      const totalInc = rows.reduce((s, r) => s + (r.kpiIncentive || 0), 0);
      const totalPen = rows.reduce((s, r) => s + (r.kpiPenalty || 0), 0);
      const sp1Count = rows.filter((r) => r.hasSp1 || r.totalScore < 70).length;
      return {
        period,
        shortLabel: formatShortMonthPeriod(period),
        rows,
        avgScore,
        totalTgt,
        totalAct,
        sellOutPct,
        totalInc,
        totalPen,
        sp1Count,
      };
    });

    const activePeriodKey =
      selectedPeriod !== 'ALL' && sortedMonths.includes(selectedPeriod)
        ? selectedPeriod
        : 'ALL';

    const filteredTable = scoped
      .filter((item) => {
        if (activePeriodKey !== 'ALL' && (item.monthPeriod || '').toUpperCase() !== activePeriodKey) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pd = parsePeriodOrderKey(b.monthPeriod) - parsePeriodOrderKey(a.monthPeriod);
        if (pd !== 0) return pd;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return b.sellOutAchievementPct - a.sellOutAchievementPct;
      });

    const latestPeriod =
      activePeriodKey !== 'ALL'
        ? activePeriodKey
        : sortedMonths[sortedMonths.length - 1] || 'OKTOBER 2026';

    const latestRows = scoped
      .filter((i) => (i.monthPeriod || '').toUpperCase() === latestPeriod)
      .sort((a, b) => b.totalScore - a.totalScore || b.sellOutAchievementPct - a.sellOutAchievementPct);

    const avgScore =
      filteredTable.length > 0
        ? filteredTable.reduce((s, r) => s + (r.totalScore || 0), 0) / filteredTable.length
        : 0;
    const totalSellOutTarget = filteredTable.reduce((s, r) => s + (r.sellOutTarget || 0), 0);
    const totalSellOutActual = filteredTable.reduce((s, r) => s + (r.sellOutActual || 0), 0);
    const sellOutAchvPct =
      totalSellOutTarget > 0 ? (totalSellOutActual / totalSellOutTarget) * 100 : 0;
    const totalIncentive = filteredTable.reduce((s, r) => s + (r.kpiIncentive || 0), 0);
    const totalPenalty = filteredTable.reduce((s, r) => s + (r.kpiPenalty || 0), 0);
    const sp1Count = filteredTable.filter((r) => r.hasSp1 || r.totalScore < 70).length;
    const gradeACount = filteredTable.filter((r) => r.grade === 'A').length;

    return {
      monthsList: sortedMonths,
      scopedAllMonthsItems: scoped,
      monthlySeries: series,
      tableRows: filteredTable,
      latestPeriodRows: { period: latestPeriod, rows: latestRows },
      summary: {
        avgScore,
        totalSellOutTarget,
        totalSellOutActual,
        sellOutAchvPct,
        totalIncentive,
        totalPenalty,
        sp1Count,
        gradeACount,
      },
    };
  }, [rawItems, filters.SALES, filters.REGION, selectedPeriod]);

  const uniqueSalesInChart = useMemo(() => {
    const names = new Set<string>();
    scopedAllMonthsItems.forEach((i) => names.add(i.salesName));
    return Array.from(names);
  }, [scopedAllMonthsItems]);

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Pencapaian KPI Sales Bulanan (Balanced Scorecard 100 Poin)
          </h2>
          <p className="text-xs text-slate-400">
            3 Sales Utama (Ilhamsyah, Tiwi &amp; Albert Fernando · Sell Out &amp; Target Albert + Abdul Rahim) per bulan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D121D] border border-[#243147] text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedPeriod('ALL')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                selectedPeriod === 'ALL'
                  ? 'bg-[#FF6B00] text-white font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua Bulan ({monthsList.length})
            </button>
            {monthsList.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedPeriod(m)}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                  selectedPeriod === m
                    ? 'bg-[#00D2FF] text-slate-950 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {formatShortMonthPeriod(m)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('kpi')}
            className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Kelola KPI Sales</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 font-mono tabular-nums">
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Rata-rata Skor KPI Sales
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-xl font-black ${
                summary.avgScore >= 90
                  ? 'text-emerald-400'
                  : summary.avgScore >= 80
                  ? 'text-[#00D2FF]'
                  : summary.avgScore >= 70
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {summary.avgScore.toFixed(1)} pt
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <span className="text-[10.5px] font-sans text-emerald-400 font-semibold mt-0.5 block">
            {summary.gradeACount} Scorecard Grade A (≥90 pt)
          </span>
        </div>

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Pencapaian Sell Out KPI
          </span>
          <span
            className="text-lg font-black text-[#00D2FF] mt-1 block whitespace-nowrap"
            title={formatRupiah(summary.totalSellOutActual)}
          >
            {formatRupiah(summary.totalSellOutActual)}
          </span>
          <span className="text-[10.5px] text-slate-300 mt-0.5 block whitespace-nowrap">
            Target: {formatCompactIdr(summary.totalSellOutTarget)} ·{' '}
            <strong
              className={
                summary.sellOutAchvPct >= 100 ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {summary.sellOutAchvPct.toFixed(1)}%
            </strong>
          </span>
        </div>

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Total Reward Insentif KPI
          </span>
          <span className="text-lg font-black text-emerald-400 mt-1 block whitespace-nowrap">
            +{formatRupiah(summary.totalIncentive)}
          </span>
          <span className="text-[10.5px] font-sans text-slate-400 mt-0.5 block">
            Periode {selectedPeriod === 'ALL' ? `${monthsList.length} Bulan` : selectedPeriod}
          </span>
        </div>

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Status Kepatuhan &amp; Denda SP1
          </span>
          <span
            className={`text-lg font-black mt-1 block whitespace-nowrap ${
              summary.sp1Count > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {summary.sp1Count > 0
              ? `${summary.sp1Count} Kasus SP1`
              : '0 SP1 (100% Aman)'}
          </span>
          <span className="text-[10.5px] text-slate-400 mt-0.5 block whitespace-nowrap">
            Total Denda KPI: {summary.totalPenalty > 0 ? `-${formatRupiah(summary.totalPenalty)}` : 'Rp 0'}
          </span>
        </div>
      </div>

      {/* MONTHLY KPI SALES ACHIEVEMENT CHART + LATEST PERIOD RANKING */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* LEFT: Monthly KPI Sales Trend / Grouped Bars */}
        <div className="xl:col-span-8 bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Grafik Pencapaian KPI Sales Setiap Bulan
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Skala 0–100 Poin · Garis merah batas SP1 (70 pt) &amp; garis hijau Grade A (90 pt). Klik bulan untuk filter tabel.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0B101A] border border-[#243147] text-[10.5px] font-bold">
              <button
                type="button"
                onClick={() => setChartViewMode('per_sales')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  chartViewMode === 'per_sales'
                    ? 'bg-[#FF6B00] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Per Sales / Bulan
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('team_avg')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  chartViewMode === 'team_avg'
                    ? 'bg-[#00D2FF] text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rata-rata Tim / Bulan
              </button>
            </div>
          </div>

          {/* Interactive Inspect Strip */}
          {hoveredBar && (
            <div className="px-3 py-1.5 rounded-lg bg-[#0B101A] border border-[#243147] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <div className="flex items-center gap-2 font-sans">
                <span className="text-[#00D2FF] font-extrabold">{hoveredBar.period}</span>
                {hoveredBar.salesName && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span className="font-bold text-white">{hoveredBar.salesName}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="font-black text-white">
                  Skor: <span className="text-emerald-400">{hoveredBar.score.toFixed(1)} pt</span>
                </span>
                <span className="text-slate-300">
                  Sell Out: <strong className="text-[#00D2FF]">{hoveredBar.sellOutPct.toFixed(1)}%</strong>
                </span>
                <span className="text-amber-300 font-bold">Grade {hoveredBar.grade}</span>
                <span className="text-emerald-400 font-bold">
                  Insentif: +{formatCompactIdr(hoveredBar.incentive)}
                </span>
              </div>
            </div>
          )}

          {monthlySeries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada data KPI Sales untuk filter saat ini.
            </div>
          ) : (
            <div className="relative pt-2">
              <div className="flex items-stretch gap-2.5">
                {/* Y-Axis 0-100 */}
                <div className="flex flex-col justify-between text-right font-mono text-[10px] text-slate-500 tabular-nums py-7 pr-2 border-r border-[#1E293B] shrink-0 w-10">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>0</span>
                </div>

                {/* Plot Area */}
                <div className="flex-1 relative h-60 flex items-end gap-3 pt-7 pb-1 min-w-0">
                  {/* Threshold 90 pt (Grade A) & 70 pt (SP1 limit) */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-emerald-500/40 pointer-events-none"
                    style={{ bottom: 'calc(28px + 0.9 * (100% - 56px))' }}
                  >
                    <span className="text-[9px] font-mono text-emerald-400/80 bg-[#121926] px-1">
                      90 pt (Grade A)
                    </span>
                  </div>
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-rose-500/45 pointer-events-none"
                    style={{ bottom: 'calc(28px + 0.7 * (100% - 56px))' }}
                  >
                    <span className="text-[9px] font-mono text-rose-400/80 bg-[#121926] px-1">
                      70 pt (Batas SP1)
                    </span>
                  </div>

                  {monthlySeries.map((m) => {
                    const isMonthSelected = selectedPeriod === m.period;
                    if (chartViewMode === 'team_avg') {
                      const heightPct = Math.max(6, Math.min(100, m.avgScore));
                      return (
                        <button
                          key={m.period}
                          type="button"
                          onClick={() =>
                            setSelectedPeriod((prev) => (prev === m.period ? 'ALL' : m.period))
                          }
                          onMouseEnter={() =>
                            setHoveredBar({
                              period: m.period,
                              score: m.avgScore,
                              sellOutPct: m.sellOutPct,
                              grade:
                                m.avgScore >= 90
                                  ? 'A'
                                  : m.avgScore >= 80
                                  ? 'B'
                                  : m.avgScore >= 70
                                  ? 'C'
                                  : 'D',
                              incentive: m.totalInc,
                            })
                          }
                          onMouseLeave={() => setHoveredBar(null)}
                          className={`flex-1 min-w-0 flex flex-col items-center h-full justify-end rounded-lg px-1.5 py-1 cursor-pointer transition-colors ${
                            isMonthSelected ? 'bg-[#17263D] ring-1 ring-[#00D2FF]/50' : 'hover:bg-[#151F33]'
                          }`}
                        >
                          <div className="mb-1 text-center">
                            <span className="text-[11px] font-mono font-black text-white block">
                              {m.avgScore.toFixed(1)}
                            </span>
                            <span className="text-[9.5px] font-mono text-[#00D2FF] block">
                              SO {m.sellOutPct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-full flex items-end justify-center px-2">
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full max-w-[54px] rounded-t-md transition-all duration-200 ${
                                m.avgScore >= 90
                                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                                  : m.avgScore >= 80
                                  ? 'bg-gradient-to-t from-cyan-600 to-[#00D2FF]'
                                  : 'bg-gradient-to-t from-amber-600 to-amber-400'
                              }`}
                            />
                          </div>
                          <span className="mt-1.5 text-[10.5px] font-extrabold text-slate-200 truncate">
                            {m.shortLabel}
                          </span>
                        </button>
                      );
                    }

                    // Grouped Per Sales Bars per Month
                    return (
                      <div
                        key={m.period}
                        onClick={() =>
                          setSelectedPeriod((prev) => (prev === m.period ? 'ALL' : m.period))
                        }
                        className={`flex-1 min-w-0 flex flex-col items-center h-full justify-end rounded-lg px-2 py-1 cursor-pointer transition-colors ${
                          isMonthSelected ? 'bg-[#17263D] ring-1 ring-[#00D2FF]/50' : 'hover:bg-[#141D2E]/70'
                        }`}
                      >
                        <div className="w-full h-full flex items-end justify-center gap-1 sm:gap-1.5">
                          {m.rows.map((r) => {
                            const hPct = Math.max(8, Math.min(100, r.totalScore));
                            const color = KPI_SALES_COLORS[r.salesName] || '#3B82F6';
                            const isDimmed =
                              highlightedSales !== null && highlightedSales !== r.salesName;
                            return (
                              <div
                                key={r.salesName}
                                onMouseEnter={(e) => {
                                  e.stopPropagation();
                                  setHoveredBar({
                                    period: m.period,
                                    salesName: r.salesName,
                                    score: r.totalScore,
                                    sellOutPct: r.sellOutAchievementPct,
                                    grade: r.grade,
                                    incentive: r.kpiIncentive,
                                  });
                                }}
                                onMouseLeave={() => setHoveredBar(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHighlightedSales((prev) =>
                                    prev === r.salesName ? null : r.salesName
                                  );
                                }}
                                className="flex-1 flex flex-col items-center justify-end h-full min-w-[10px] max-w-[26px] group"
                              >
                                <span className="text-[9px] font-mono font-bold text-slate-300 mb-0.5 leading-none">
                                  {r.totalScore}
                                </span>
                                <div
                                  style={{
                                    height: `${hPct}%`,
                                    backgroundColor: color,
                                    opacity: isDimmed ? 0.28 : 1,
                                  }}
                                  className="w-full rounded-t-sm transition-all duration-200 group-hover:brightness-110"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-1.5 text-center w-full">
                          <span className="text-[10.5px] font-extrabold text-white block truncate">
                            {m.shortLabel}
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-400 block">
                            Avg {m.avgScore.toFixed(1)} pt
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          {chartViewMode === 'per_sales' && (
            <div className="pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
              <div className="flex flex-wrap items-center gap-3">
                {uniqueSalesInChart.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setHighlightedSales((prev) => (prev === name ? null : name))
                    }
                    className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
                      highlightedSales && highlightedSales !== name ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: KPI_SALES_COLORS[name] || '#3B82F6' }}
                    />
                    <span className="font-bold text-slate-200">{name}</span>
                  </button>
                ))}
              </div>
              {highlightedSales && (
                <button
                  type="button"
                  onClick={() => setHighlightedSales(null)}
                  className="text-cyan-300 font-bold hover:underline cursor-pointer"
                >
                  Reset Sorotan
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Per-Sales KPI Gauge Ranking (Active / Latest Month) */}
        <div className="xl:col-span-4 bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Peringkat Skor KPI Sales
              </h3>
              <span className="text-[10px] font-mono font-bold text-[#00D2FF]">
                {latestPeriodRows.period}
              </span>
            </div>

            <div className="space-y-2 mt-2.5">
              {latestPeriodRows.rows.map((r, idx) => {
                const color = KPI_SALES_COLORS[r.salesName] || '#3B82F6';
                return (
                  <button
                    key={r.salesName}
                    type="button"
                    onClick={() =>
                      setHighlightedSales((prev) => (prev === r.salesName ? null : r.salesName))
                    }
                    className={`w-full text-left p-2 rounded-lg border transition-colors cursor-pointer ${
                      highlightedSales === r.salesName
                        ? 'bg-[#17263D] border-[#00D2FF]/50'
                        : 'bg-[#0B101A] border-[#1E293B] hover:bg-[#151E30]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-white truncate">
                        #{idx + 1} {r.salesName}
                        {r.salesName.trim().toUpperCase() === 'ALBERT FERNANDO' && (
                          <span className="ml-1.5 text-[9.5px] font-semibold text-emerald-300">
                            (+SO Abdul Rahim)
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-mono font-black tabular-nums shrink-0 ${
                          r.totalScore >= 90
                            ? 'text-emerald-400'
                            : r.totalScore >= 80
                            ? 'text-[#00D2FF]'
                            : r.totalScore >= 70
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {r.totalScore} pt · Grade {r.grade}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#192234] rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(4, Math.min(100, r.totalScore))}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400 mt-1">
                      <span>Sell Out: {r.sellOutAchievementPct.toFixed(1)}%</span>
                      <span>
                        {r.kpiIncentive > 0
                          ? `+${formatCompactIdr(r.kpiIncentive)}`
                          : r.kpiPenalty > 0
                          ? `-${formatCompactIdr(r.kpiPenalty)} (SP1)`
                          : 'Rp 0'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH TABLE: ALL COLUMNS VISIBLE ON SCREEN */}
      <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0E1523] flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#00D2FF]">
            Rekap Lengkap Scorecard KPI Sales ({tableRows.length} Data)
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            5 Pilar Balanced Scorecard (100 Poin) · Tampilan Penuh Semua Kolom
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-[10.5px] text-left border-collapse">
            <thead className="bg-[#0B101A]">
              <tr className="text-[9.5px] uppercase text-slate-400 border-b border-[#1E293B] leading-tight">
                <th className="py-2.5 px-2">Periode</th>
                <th className="py-2.5 px-2">Sales &amp; Area</th>
                <th className="py-2.5 px-2 text-right">
                  Sell Out<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">
                    (Tgt → Akt / %)
                  </span>
                </th>
                <th className="py-2.5 px-1.5 text-center text-[#00D2FF]">
                  P1: Out<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 40)</span>
                </th>
                <th className="py-2.5 px-1.5 text-center">
                  P2: Tag &gt;45H<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 30)</span>
                </th>
                <th className="py-2.5 px-1.5 text-center">
                  P3: Visit<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 10)</span>
                </th>
                <th className="py-2.5 px-1.5 text-center">
                  P4: Mon BA<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 10)</span>
                </th>
                <th className="py-2.5 px-1.5 text-center">
                  P5: Buffer<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 10)</span>
                </th>
                <th className="py-2.5 px-2 text-center text-white">Total<br />Skor</th>
                <th className="py-2.5 px-2 text-center">Grade &amp;<br />Status</th>
                <th className="py-2.5 px-2 text-right">Insentif /<br />Denda KPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center font-sans text-slate-400">
                    Tidak ada data KPI Sales untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const isHighlighted = highlightedSales === row.salesName;
                  return (
                    <tr
                      key={row.id || `${row.salesName}-${row.monthPeriod}`}
                      onClick={() =>
                        setHighlightedSales((prev) =>
                          prev === row.salesName ? null : row.salesName
                        )
                      }
                      className={`transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-[#17263D]' : 'hover:bg-[#172033]'
                      }`}
                    >
                      <td className="py-2 px-2 font-bold text-cyan-300 whitespace-nowrap">
                        {formatShortMonthPeriod(row.monthPeriod)}
                      </td>
                      <td className="py-2 px-2 font-sans">
                        <div className="font-bold text-white leading-snug">{row.salesName}</div>
                        <div className="text-[9.5px] text-slate-400 leading-tight">
                          {row.salesName.trim().toUpperCase() === 'ALBERT FERNANDO'
                            ? `${row.coverArea} · + Sell Out & Target Abdul Rahim`
                            : row.coverArea}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div
                          className="text-[9.5px] text-slate-400"
                          title={`Target: ${formatRupiah(row.sellOutTarget)}`}
                        >
                          T: {formatCompactIdr(row.sellOutTarget)}
                        </div>
                        <div
                          className="font-bold text-white"
                          title={`Aktual: ${formatRupiah(row.sellOutActual)}`}
                        >
                          A: {formatCompactIdr(row.sellOutActual)}{' '}
                          <span
                            className={
                              row.sellOutAchievementPct >= 100
                                ? 'text-emerald-400'
                                : row.sellOutAchievementPct >= 80
                                ? 'text-cyan-400'
                                : 'text-amber-400'
                            }
                          >
                            ({row.sellOutAchievementPct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-1.5 text-center font-bold text-[#00D2FF] whitespace-nowrap">
                        {row.pointSellOut} pt
                      </td>
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointTagihan45H} pt</div>
                        <div className="text-[9px] text-slate-400">
                          {row.overdueStoresUp45Count} tk
                        </div>
                      </td>
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointKunjungan} pt</div>
                        <div className="text-[9px] text-slate-400">{row.visitLogsCount}x</div>
                      </td>
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointMonitoringBa} pt</div>
                        <div className="text-[9px] text-slate-400">
                          {row.baReportWeeklyPct}%/{row.baStockOpnameAppPct}%
                        </div>
                      </td>
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointBufferStock} pt</div>
                        <div className="text-[9px] text-slate-400">
                          {row.storesUsingBufferAppPct}%
                        </div>
                      </td>
                      <td
                        className={`py-2 px-2 text-center font-black text-xs whitespace-nowrap ${
                          row.totalScore >= 90
                            ? 'text-emerald-400'
                            : row.totalScore >= 80
                            ? 'text-[#00D2FF]'
                            : row.totalScore >= 70
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {row.totalScore}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span
                          className={`font-extrabold ${
                            row.grade === 'A'
                              ? 'text-emerald-400'
                              : row.grade === 'B'
                              ? 'text-[#00D2FF]'
                              : row.grade === 'C'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          Grade {row.grade}
                        </span>
                        <div
                          className={`text-[9px] font-sans font-bold ${
                            row.hasSp1 ? 'text-rose-400' : 'text-emerald-400/80'
                          }`}
                        >
                          {row.hasSp1 ? 'Kena SP1' : 'Aman'}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap font-bold">
                        {row.kpiIncentive > 0 ? (
                          <span className="text-emerald-400">
                            +{formatRupiah(row.kpiIncentive)}
                          </span>
                        ) : row.kpiPenalty > 0 ? (
                          <span className="text-rose-400">-{formatRupiah(row.kpiPenalty)}</span>
                        ) : (
                          <span className="text-slate-500">Rp 0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot className="bg-[#0E1523] border-t border-[#243147] font-mono tabular-nums text-[10.5px]">
                <tr>
                  <td colSpan={2} className="py-2.5 px-2 font-sans font-extrabold uppercase text-slate-200">
                    Total / Rata-rata ({tableRows.length} Scorecard)
                  </td>
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="text-[9.5px] text-slate-400">
                      T: {formatCompactIdr(summary.totalSellOutTarget)}
                    </div>
                    <div className="font-black text-[#00D2FF]">
                      A: {formatCompactIdr(summary.totalSellOutActual)} ({summary.sellOutAchvPct.toFixed(1)}%)
                    </div>
                  </td>
                  <td colSpan={5} className="py-2.5 px-2 text-center font-sans text-slate-400">
                    Rata-rata Skor Tim Sales
                  </td>
                  <td className="py-2.5 px-2 text-center font-black text-emerald-400">
                    {summary.avgScore.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-slate-300">
                    {summary.sp1Count} SP1
                  </td>
                  <td className="py-2.5 px-2 text-right font-black text-emerald-400 whitespace-nowrap">
                    +{formatCompactIdr(summary.totalIncentive)}
                    {summary.totalPenalty > 0 ? ` / -${formatCompactIdr(summary.totalPenalty)}` : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
});

const KPI_TRAINER_COLORS: Record<string, string> = {
  ARA: '#00D2FF',
  RATIH: '#FF6B00',
};

// Isolated Memoized KPI Trainer Panel (Monthly Achievement Chart + Full-Column Scorecard Table)
const KpiTrainerDashboardPanel: React.FC<{
  filters: DashboardFilters;
  selectedYear: number;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(({ filters, selectedYear, onNavigateTab }) => {
  const [rawItems, setRawItems] = useState<KpiTrainerScorecardItem[]>(() =>
    getCachedKpiTrainerItems(false)
  );
  const [chartMetric, setChartMetric] = useState<'score' | 'sell_out'>('score');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [highlightedTrainer, setHighlightedTrainer] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<KpiTrainerScorecardItem | null>(null);

  useEffect(() => {
    const refresh = () => setRawItems(getCachedKpiTrainerItems(true));
    window.addEventListener(TARGETS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!filters.BULAN || filters.BULAN === 'ALL') {
      setSelectedPeriod('ALL');
    } else {
      const upper = filters.BULAN.trim().toUpperCase();
      const target = upper.includes(String(selectedYear)) ? upper : `${upper} ${selectedYear}`;
      setSelectedPeriod(target);
    }
  }, [filters.BULAN, selectedYear]);

  const {
    monthsList,
    trainerNames,
    monthlySeries,
    tableRows,
    latestPeriodRows,
    summary,
  } = useMemo(() => {
    const trainerFilterUpper =
      filters.TRAINER && filters.TRAINER !== 'ALL'
        ? filters.TRAINER.trim().toUpperCase()
        : 'ALL';

    const scoped = rawItems.filter((item) => {
      if (
        trainerFilterUpper !== 'ALL' &&
        !item.trainerName.trim().toUpperCase().includes(trainerFilterUpper)
      ) {
        return false;
      }
      return true;
    });

    const periodSet = new Set<string>();
    const trainerSet = new Set<string>();
    scoped.forEach((i) => {
      periodSet.add((i.monthPeriod || 'OKTOBER 2026').toUpperCase());
      trainerSet.add(i.trainerName.toUpperCase());
    });

    const sortedMonths = Array.from(periodSet).sort(
      (a, b) => parsePeriodOrderKey(a) - parsePeriodOrderKey(b)
    );
    const trainers = Array.from(trainerSet).sort();

    const series = sortedMonths.map((period) => {
      const rows = scoped
        .filter((i) => (i.monthPeriod || '').toUpperCase() === period)
        .sort((a, b) => b.totalScore - a.totalScore);
      const avgScore =
        rows.length > 0 ? rows.reduce((s, r) => s + (r.totalScore || 0), 0) / rows.length : 0;
      const totalTgt = rows.reduce((s, r) => s + (r.sellOutTarget || 0), 0);
      const totalAct = rows.reduce((s, r) => s + (r.sellOutActual || 0), 0);
      const sellOutPct = totalTgt > 0 ? (totalAct / totalTgt) * 100 : 0;
      return {
        period,
        shortLabel: formatShortMonthPeriod(period),
        rows,
        avgScore,
        sellOutPct,
      };
    });

    const activePeriodKey =
      selectedPeriod !== 'ALL' && sortedMonths.includes(selectedPeriod)
        ? selectedPeriod
        : 'ALL';

    const filteredTable = scoped
      .filter((item) => {
        if (activePeriodKey !== 'ALL' && (item.monthPeriod || '').toUpperCase() !== activePeriodKey) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pd = parsePeriodOrderKey(b.monthPeriod) - parsePeriodOrderKey(a.monthPeriod);
        if (pd !== 0) return pd;
        return b.totalScore - a.totalScore;
      });

    const latestPeriod =
      activePeriodKey !== 'ALL'
        ? activePeriodKey
        : sortedMonths[sortedMonths.length - 1] || 'OKTOBER 2026';

    const latestRows = scoped
      .filter((i) => (i.monthPeriod || '').toUpperCase() === latestPeriod)
      .sort((a, b) => b.totalScore - a.totalScore);

    const avgScore =
      filteredTable.length > 0
        ? filteredTable.reduce((s, r) => s + (r.totalScore || 0), 0) / filteredTable.length
        : 0;
    const totalSellOutTarget = filteredTable.reduce((s, r) => s + (r.sellOutTarget || 0), 0);
    const totalSellOutActual = filteredTable.reduce((s, r) => s + (r.sellOutActual || 0), 0);
    const sellOutAchvPct =
      totalSellOutTarget > 0 ? (totalSellOutActual / totalSellOutTarget) * 100 : 0;
    const totalEventTarget = filteredTable.reduce((s, r) => s + (r.eventOmsetTarget || 0), 0);
    const totalEventActual = filteredTable.reduce((s, r) => s + (r.eventOmsetActual || 0), 0);
    const eventAchvPct =
      totalEventTarget > 0 ? (totalEventActual / totalEventTarget) * 100 : 0;
    const totalVisitAct = filteredTable.reduce((s, r) => s + (r.visitActual || 0), 0);
    const totalVisitTgt = filteredTable.reduce((s, r) => s + (r.visitTarget || 0), 0);
    const totalTrainAct = filteredTable.reduce((s, r) => s + (r.trainingActual || 0), 0);
    const totalTrainTgt = filteredTable.reduce((s, r) => s + (r.trainingTarget || 0), 0);

    return {
      monthsList: sortedMonths,
      trainerNames: trainers,
      monthlySeries: series,
      tableRows: filteredTable,
      latestPeriodRows: { period: latestPeriod, rows: latestRows },
      summary: {
        avgScore,
        totalSellOutTarget,
        totalSellOutActual,
        sellOutAchvPct,
        totalEventTarget,
        totalEventActual,
        eventAchvPct,
        totalVisitAct,
        totalVisitTgt,
        totalTrainAct,
        totalTrainTgt,
      },
    };
  }, [rawItems, filters.TRAINER, selectedPeriod]);

  const maxChartScale = useMemo(() => {
    if (chartMetric === 'score') return 100;
    const maxPct = Math.max(
      110,
      ...monthlySeries.flatMap((m) => m.rows.map((r) => r.sellOutAchievementPct || 0))
    );
    return Math.ceil(maxPct / 10) * 10;
  }, [chartMetric, monthlySeries]);

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Pencapaian KPI Trainer Bulanan (5 Indikator · 100 Poin)
          </h2>
          <p className="text-xs text-slate-400">
            Monitoring poin Sell Out, Omset Event, Kunjungan, Training &amp; Produktivitas BA per Trainer setiap bulan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0D121D] border border-[#243147] text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedPeriod('ALL')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                selectedPeriod === 'ALL'
                  ? 'bg-[#FF6B00] text-white font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua Bulan ({monthsList.length})
            </button>
            {monthsList.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedPeriod(m)}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                  selectedPeriod === m
                    ? 'bg-[#00D2FF] text-slate-950 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {formatShortMonthPeriod(m)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('kpi_trainer')}
            className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Kelola KPI Trainer</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 font-mono tabular-nums">
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Rata-rata Skor KPI Trainer
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-xl font-black ${
                summary.avgScore >= 90
                  ? 'text-emerald-400'
                  : summary.avgScore >= 80
                  ? 'text-[#00D2FF]'
                  : 'text-amber-400'
              }`}
            >
              {summary.avgScore.toFixed(1)} pt
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <span className="text-[10.5px] font-sans text-slate-400 mt-0.5 block">
            {trainerNames.length} Trainer Aktif ({trainerNames.join(' & ') || '-'})
          </span>
        </div>

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Sell Out Binaan Trainer
          </span>
          <span className="text-lg font-black text-[#00D2FF] mt-1 block whitespace-nowrap">
            {formatRupiah(summary.totalSellOutActual)}
          </span>
          <span className="text-[10.5px] text-slate-300 mt-0.5 block whitespace-nowrap">
            Target: {formatCompactIdr(summary.totalSellOutTarget)} ·{' '}
            <strong
              className={
                summary.sellOutAchvPct >= 100 ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {summary.sellOutAchvPct.toFixed(1)}%
            </strong>
          </span>
        </div>

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Realisasi Omset Event
          </span>
          <span className="text-lg font-black text-[#FF6B00] mt-1 block whitespace-nowrap">
            {formatRupiah(summary.totalEventActual)}
          </span>
          <span className="text-[10.5px] text-slate-300 mt-0.5 block whitespace-nowrap">
            Target: {formatCompactIdr(summary.totalEventTarget)} ·{' '}
            <strong
              className={
                summary.eventAchvPct >= 100 ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              {summary.eventAchvPct.toFixed(1)}%
            </strong>
          </span>
        </div>

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
            Training &amp; Kunjungan Lapangan
          </span>
          <span className="text-lg font-black text-emerald-400 mt-1 block whitespace-nowrap">
            {summary.totalTrainAct}/{summary.totalTrainTgt} Training
          </span>
          <span className="text-[10.5px] text-slate-300 mt-0.5 block whitespace-nowrap">
            Kunjungan: {summary.totalVisitAct} / {summary.totalVisitTgt} visit
          </span>
        </div>
      </div>

      {/* MONTHLY KPI TRAINER CHART + PILLAR BREAKDOWN */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-7 bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#00D2FF]/15 border border-[#00D2FF]/30 text-[#00D2FF] shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Grafik Pencapaian KPI Trainer Setiap Bulan
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Perbandingan bulanan skor KPI &amp; capaian Sell Out antar Trainer. Klik bulan untuk filter tabel.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0B101A] border border-[#243147] text-[10.5px] font-bold">
              <button
                type="button"
                onClick={() => setChartMetric('score')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  chartMetric === 'score'
                    ? 'bg-[#00D2FF] text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Skor KPI (Poin)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('sell_out')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  chartMetric === 'sell_out'
                    ? 'bg-[#FF6B00] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                % Sell Out
              </button>
            </div>
          </div>

          {hoveredItem && (
            <div className="px-3 py-1.5 rounded-lg bg-[#0B101A] border border-[#243147] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <div className="flex items-center gap-2 font-sans">
                <span className="text-[#00D2FF] font-extrabold">{hoveredItem.monthPeriod}</span>
                <span className="text-slate-500">·</span>
                <span className="font-bold text-white">{hoveredItem.trainerName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="font-black text-emerald-400">
                  Skor: {hoveredItem.totalScore} pt ({hoveredItem.grade})
                </span>
                <span className="text-cyan-300">
                  SO: {hoveredItem.sellOutAchievementPct.toFixed(1)}%
                </span>
                <span className="text-[#FF6B00]">
                  Event: {hoveredItem.eventOmsetAchievementPct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {monthlySeries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada data KPI Trainer pada filter aktif.
            </div>
          ) : (
            <div className="flex items-stretch gap-2.5 pt-2">
              <div className="flex flex-col justify-between text-right font-mono text-[10px] text-slate-500 tabular-nums py-7 pr-2 border-r border-[#1E293B] shrink-0 w-10">
                <span>{maxChartScale}{chartMetric === 'sell_out' ? '%' : ''}</span>
                <span>{Math.round(maxChartScale * 0.5)}{chartMetric === 'sell_out' ? '%' : ''}</span>
                <span>0</span>
              </div>

              <div className="flex-1 flex items-end gap-4 h-60 pt-7 pb-1 min-w-0">
                {monthlySeries.map((m) => {
                  const isMonthSelected = selectedPeriod === m.period;
                  return (
                    <div
                      key={m.period}
                      onClick={() =>
                        setSelectedPeriod((prev) => (prev === m.period ? 'ALL' : m.period))
                      }
                      className={`flex-1 min-w-0 flex flex-col items-center h-full justify-end rounded-lg px-2 py-1 cursor-pointer transition-colors ${
                        isMonthSelected ? 'bg-[#17263D] ring-1 ring-[#00D2FF]/50' : 'hover:bg-[#141D2E]/70'
                      }`}
                    >
                      <div className="w-full h-full flex items-end justify-center gap-2 sm:gap-3">
                        {m.rows.map((r) => {
                          const val =
                            chartMetric === 'score' ? r.totalScore : r.sellOutAchievementPct;
                          const hPct =
                            maxChartScale > 0
                              ? Math.max(8, Math.min(100, (val / maxChartScale) * 100))
                              : 8;
                          const color =
                            KPI_TRAINER_COLORS[r.trainerName.toUpperCase()] || '#10B981';
                          const isDimmed =
                            highlightedTrainer !== null &&
                            highlightedTrainer !== r.trainerName.toUpperCase();

                          return (
                            <div
                              key={r.trainerName}
                              onMouseEnter={(e) => {
                                e.stopPropagation();
                                setHoveredItem(r);
                              }}
                              onMouseLeave={() => setHoveredItem(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                const upper = r.trainerName.toUpperCase();
                                setHighlightedTrainer((prev) => (prev === upper ? null : upper));
                              }}
                              className="flex flex-col items-center justify-end h-full w-10 sm:w-14 group"
                            >
                              <span className="text-[10.5px] font-mono font-black text-white mb-0.5 whitespace-nowrap">
                                {chartMetric === 'score' ? `${r.totalScore}` : `${val.toFixed(0)}%`}
                              </span>
                              <div
                                style={{
                                  height: `${hPct}%`,
                                  backgroundColor: color,
                                  opacity: isDimmed ? 0.3 : 1,
                                }}
                                className="w-full rounded-t-md transition-all duration-200 group-hover:brightness-110"
                              />
                              <span className="text-[9.5px] font-bold text-slate-300 mt-1">
                                {r.trainerName}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-1.5 text-center w-full border-t border-[#1E293B] pt-1">
                        <span className="text-[10.5px] font-extrabold text-white block truncate">
                          {m.shortLabel}
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-400 block">
                          Avg {m.avgScore.toFixed(1)} pt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
            <div className="flex flex-wrap items-center gap-4">
              {trainerNames.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setHighlightedTrainer((prev) => (prev === t ? null : t))
                  }
                  className={`inline-flex items-center gap-1.5 cursor-pointer ${
                    highlightedTrainer && highlightedTrainer !== t ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: KPI_TRAINER_COLORS[t] || '#10B981' }}
                  />
                  <span className="font-bold text-slate-200">Trainer {t}</span>
                </button>
              ))}
            </div>
            {highlightedTrainer && (
              <button
                type="button"
                onClick={() => setHighlightedTrainer(null)}
                className="text-cyan-300 font-bold hover:underline cursor-pointer"
              >
                Reset Sorotan
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: 5-Indicator Breakdown per Trainer */}
        <div className="xl:col-span-5 bg-[#121926] border border-[#1F293B] rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Breakdown 5 Indikator Trainer
              </h3>
              <span className="text-[10px] font-mono font-bold text-[#FF6B00]">
                {latestPeriodRows.period}
              </span>
            </div>

            <div className="space-y-3 mt-3">
              {latestPeriodRows.rows.map((r) => {
                const color = KPI_TRAINER_COLORS[r.trainerName.toUpperCase()] || '#10B981';
                const pillars = [
                  { label: 'Sell Out (40)', pt: r.pointSellOut, max: 40 },
                  { label: 'Event (30)', pt: r.pointEvent, max: 30 },
                  { label: 'Visit (10)', pt: r.pointKunjungan, max: 10 },
                  { label: 'Training (10)', pt: r.pointTraining, max: 10 },
                  { label: 'Prod. BA (10)', pt: r.pointBaProductivity, max: 10 },
                ];
                return (
                  <div
                    key={r.id || r.trainerName}
                    className="p-3 rounded-lg bg-[#0B101A] border border-[#1E293B] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-white">
                          TRAINER {r.trainerName}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{r.region}</span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span className="text-sm font-black" style={{ color }}>
                          {r.totalScore} / 100 pt
                        </span>
                        <span className="block text-[10px] text-emerald-400 font-bold">
                          {r.grade}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center font-mono tabular-nums">
                      {pillars.map((p) => (
                        <div
                          key={p.label}
                          className="p-1.5 rounded bg-[#121926] border border-[#1E293B]"
                        >
                          <span className="text-[9px] font-sans text-slate-400 block truncate">
                            {p.label}
                          </span>
                          <span
                            className={`text-[11px] font-extrabold ${
                              p.pt >= p.max
                                ? 'text-emerald-400'
                                : p.pt > 0
                                ? 'text-cyan-300'
                                : 'text-rose-400'
                            }`}
                          >
                            {p.pt} pt
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH TABLE: ALL COLUMNS VISIBLE ON SCREEN */}
      <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0E1523] flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#FF6B00]">
            Rekap Lengkap Scorecard KPI Trainer ({tableRows.length} Data)
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            5 Indikator Penilaian · Seluruh Kolom Tampil Penuh di Layar
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-[10.5px] text-left border-collapse">
            <thead className="bg-[#0B101A]">
              <tr className="text-[9.5px] uppercase text-slate-400 border-b border-[#1E293B] leading-tight">
                <th className="py-2.5 px-2">Periode</th>
                <th className="py-2.5 px-2">Trainer &amp; Area</th>
                <th className="py-2.5 px-2 text-right text-[#00D2FF]">
                  Sell Out (Maks 40 pt)<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">
                    (Tgt → Akt / % · Poin)
                  </span>
                </th>
                <th className="py-2.5 px-2 text-right text-[#FF6B00]">
                  Omset Event (Maks 30 pt)<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">
                    (Tgt → Akt / % · Poin)
                  </span>
                </th>
                <th className="py-2.5 px-2 text-center">
                  Kunjungan<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 10)</span>
                </th>
                <th className="py-2.5 px-2 text-center">
                  Training<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 10)</span>
                </th>
                <th className="py-2.5 px-2 text-center">
                  Prod. BA<br />
                  <span className="text-[8.5px] font-normal text-slate-400 normal-case">(Maks 10)</span>
                </th>
                <th className="py-2.5 px-2 text-center text-white">Total<br />Skor</th>
                <th className="py-2.5 px-2 text-center">Kategori &amp;<br />Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center font-sans text-slate-400">
                    Tidak ada data KPI Trainer pada filter yang dipilih.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const isHighlighted =
                    highlightedTrainer === row.trainerName.toUpperCase();
                  return (
                    <tr
                      key={row.id || `${row.trainerName}-${row.monthPeriod}`}
                      onClick={() => {
                        const upper = row.trainerName.toUpperCase();
                        setHighlightedTrainer((prev) => (prev === upper ? null : upper));
                      }}
                      className={`transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-[#17263D]' : 'hover:bg-[#172033]'
                      }`}
                    >
                      <td className="py-2 px-2 font-bold text-cyan-300 whitespace-nowrap">
                        {formatShortMonthPeriod(row.monthPeriod)}
                      </td>
                      <td className="py-2 px-2 font-sans">
                        <div className="font-extrabold text-white">{row.trainerName}</div>
                        <div className="text-[9.5px] text-slate-400 leading-tight">
                          {row.region}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div className="text-[9.5px] text-slate-400">
                          T: {formatCompactIdr(row.sellOutTarget)} ·{' '}
                          <strong className="text-[#00D2FF]">{row.pointSellOut} pt</strong>
                        </div>
                        <div className="font-bold text-white">
                          A: {formatCompactIdr(row.sellOutActual)}{' '}
                          <span
                            className={
                              row.sellOutAchievementPct >= 100
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            ({row.sellOutAchievementPct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div className="text-[9.5px] text-slate-400">
                          T: {formatCompactIdr(row.eventOmsetTarget)} ·{' '}
                          <strong className="text-[#FF6B00]">{row.pointEvent} pt</strong>
                        </div>
                        <div className="font-bold text-white">
                          A: {formatCompactIdr(row.eventOmsetActual)}{' '}
                          <span
                            className={
                              row.eventOmsetAchievementPct >= 100
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            ({row.eventOmsetAchievementPct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointKunjungan} pt</div>
                        <div className="text-[9.5px] text-slate-400">
                          {row.visitActual}/{row.visitTarget} ({row.visitAchievementPct.toFixed(0)}%)
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointTraining} pt</div>
                        <div className="text-[9.5px] text-slate-400">
                          {row.trainingActual}/{row.trainingTarget} ({row.trainingAchievementPct.toFixed(0)}%)
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="font-bold text-white">{row.pointBaProductivity} pt</div>
                        <div className="text-[9.5px] text-slate-400">
                          {row.baProductivityActual}/{row.baProductivityTarget} ({row.baProductivityAchievementPct.toFixed(0)}%)
                        </div>
                      </td>
                      <td
                        className={`py-2 px-2 text-center font-black text-xs whitespace-nowrap ${
                          row.totalScore >= 90
                            ? 'text-emerald-400'
                            : row.totalScore >= 80
                            ? 'text-[#00D2FF]'
                            : 'text-amber-400'
                        }`}
                      >
                        {row.totalScore}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span
                          className={`font-extrabold ${
                            row.totalScore >= 90
                              ? 'text-emerald-400'
                              : row.totalScore >= 80
                              ? 'text-[#00D2FF]'
                              : row.totalScore >= 70
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {row.grade}
                        </span>
                        <div
                          className={`text-[9px] font-sans font-bold ${
                            row.hasSp1 ? 'text-rose-400' : 'text-emerald-400/80'
                          }`}
                        >
                          {row.hasSp1 ? 'SP1 (<70)' : 'Aman'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot className="bg-[#0E1523] border-t border-[#243147] font-mono tabular-nums text-[10.5px]">
                <tr>
                  <td colSpan={2} className="py-2.5 px-2 font-sans font-extrabold uppercase text-slate-200">
                    Total / Rata-rata ({tableRows.length} Scorecard)
                  </td>
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="text-[9.5px] text-slate-400">
                      T: {formatCompactIdr(summary.totalSellOutTarget)}
                    </div>
                    <div className="font-black text-[#00D2FF]">
                      A: {formatCompactIdr(summary.totalSellOutActual)} ({summary.sellOutAchvPct.toFixed(1)}%)
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="text-[9.5px] text-slate-400">
                      T: {formatCompactIdr(summary.totalEventTarget)}
                    </div>
                    <div className="font-black text-[#FF6B00]">
                      A: {formatCompactIdr(summary.totalEventActual)} ({summary.eventAchvPct.toFixed(1)}%)
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-slate-200">
                    {summary.totalVisitAct}/{summary.totalVisitTgt}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-slate-200">
                    {summary.totalTrainAct}/{summary.totalTrainTgt}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-400 font-sans">
                    Rata-rata
                  </td>
                  <td className="py-2.5 px-2 text-center font-black text-emerald-400">
                    {summary.avgScore.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-slate-300">
                    {tableRows.filter((r) => r.hasSp1).length} SP1
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
});

const TrenBulananDashboardPanel: React.FC<{
  trendChartData: ReturnType<typeof aggregateTimeframe>;
  trendTimeframeMode: TimeframeMode;
  onTrendTimeframeModeChange: (mode: TimeframeMode) => void;
  filters: DashboardFilters;
  effectiveFilteredCount: number;
  monthlySpvTargetsData: ReturnType<typeof buildMonthlySpvTargetsMap> | null;
  onShowAllMonths: () => void;
  onOpenTargetMgmt: () => void;
}> = React.memo(
  ({
    trendChartData,
    trendTimeframeMode,
    onTrendTimeframeModeChange,
    filters,
    effectiveFilteredCount,
    monthlySpvTargetsData,
    onShowAllMonths,
    onOpenTargetMgmt,
  }) => (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Tren Pencapaian Bulanan &amp; Rincian Data
          </h2>
          <p className="text-xs text-slate-400">
            Indikator Growth (Bulanan) serta Rincian Data Bulanan sesuai Filter Terintegrasi
          </p>
        </div>
        {filters.BULAN !== 'ALL' && (
          <button
            type="button"
            onClick={onShowAllMonths}
            className="px-3 py-1.5 rounded-lg bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 border border-[#FF6B00]/40 text-[#FFB067] text-xs font-bold cursor-pointer transition-colors"
          >
            Tampilkan Semua Bulan (Jan–Des)
          </button>
        )}
      </div>

      <TimeframeTrendChart
        theme="dark"
        data={trendChartData}
        mode={trendTimeframeMode}
        onModeChange={onTrendTimeframeModeChange}
        selectedMonth={filters.BULAN}
        filters={filters}
        totalFilteredRecords={effectiveFilteredCount}
        spvTargetByMonth={monthlySpvTargetsData?.byKey}
        spvScopeLabel={monthlySpvTargetsData?.spvScopeLabel}
        targetMode={monthlySpvTargetsData?.targetMode}
        targetEntityLabel={monthlySpvTargetsData?.targetEntityLabel}
        onOpenTargetMgmt={onOpenTargetMgmt}
      />
    </div>
  )
);

const PromoBaDashboardPanel: React.FC<{
  promoBaData: PromoBaLensData;
  promoTotalActual: number;
  promoStoreCount: number;
  promoDaysCount: number;
  baTotalDenda: number;
  baIncidentsCount: number;
  salesVisitsCount: number;
  trainerVisitsCount: number;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenPromo: () => void;
}> = React.memo(
  ({
    promoBaData,
    promoTotalActual,
    promoStoreCount,
    promoDaysCount,
    baTotalDenda,
    baIncidentsCount,
    salesVisitsCount,
    trainerVisitsCount,
    onNavigateTab,
    onOpenPromo,
  }) => (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Tim BA, Report Promo Toko Online &amp; Kunjungan Lapangan
          </h2>
          <p className="text-xs text-slate-400">
            Rekap promo online, evaluasi denda nihil BA, serta check-in tim Sales &amp; Trainer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPromo}
            className="px-3 py-1.5 rounded-lg bg-[#FF6B00] text-white text-xs font-bold cursor-pointer"
          >
            Buka Promo Online
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('punishment')}
            className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
          >
            Evaluasi Denda BA
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('kunjungan_sales')}
            className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
          >
            Kunjungan Sales
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono tabular-nums">
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Promo Toko Online</span>
          <span className="text-base font-black text-[#FF6B00] mt-1 block whitespace-nowrap">{formatRupiah(promoTotalActual)}</span>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{promoStoreCount} Toko · {promoDaysCount} Hari</span>
        </div>
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Denda Nihil BA Aktif</span>
          <span className="text-base font-black text-rose-400 mt-1 block whitespace-nowrap">{formatRupiah(baTotalDenda)}</span>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{baIncidentsCount} Kejadian Nihil</span>
        </div>
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Kunjungan Sales</span>
          <span className="text-base font-black text-[#00D2FF] mt-1 block whitespace-nowrap">{salesVisitsCount} Check-In</span>
          <span className="text-[11px] text-slate-400">ILHAMSYAH, TIWI, ALBERT</span>
        </div>
        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Kunjungan Trainer</span>
          <span className="text-base font-black text-emerald-400 mt-1 block whitespace-nowrap">{trainerVisitsCount} Check-In</span>
          <span className="text-[11px] text-slate-400">ARA &amp; RATIH</span>
        </div>
      </div>

      <PromoMonthlyGrowthPanel
        promoMonthlyRecap={promoBaData.promoMonthlyRecap}
        onOpenPromo={onOpenPromo}
      />
    </div>
  )
);

const FinanceBillsDashboardPanel: React.FC<{
  monthlyProfitHrSummary: MonthlyProfitHrSummary;
  profitSummary: ExecutiveCoreSnapshot['profitSummary'];
  unpaidBillsAmount: number;
  overdueBillsCount: number;
  filterMonth: string;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(
  ({
    monthlyProfitHrSummary,
    profitSummary,
    unpaidBillsAmount,
    overdueBillsCount,
    filterMonth,
    onNavigateTab,
  }) => {
    const profitPctVsSellIn = Math.round((profitSummary.remainingProfitPercentSellIn || 0) * 10) / 10;
    return (
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Profit Area (P&amp;L), Estimasi Cost Gaji &amp; Tagihan Piutang
            </h2>
            <p className="text-xs text-slate-400">
              Margin kotor 55%, biaya operasional 33%, beban gaji tim, serta kesehatan aging tagihan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('profit')}
              className="px-3 py-1.5 rounded-lg bg-[#FF6B00] text-white text-xs font-bold cursor-pointer"
            >
              Buka Profit Area
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('cost')}
              className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
            >
              Buka Cost &amp; Gaji
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('aging')}
              className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
            >
              Buka Aging Tagihan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Margin Kotor (55%)</span>
            <span className="text-base xl:text-lg font-black text-white mt-1 block whitespace-nowrap">{formatRupiah(profitSummary.marginValue)}</span>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Sell In: {formatRupiah(profitSummary.sellInActual)}</span>
          </div>
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Beban (Ops + Gaji)</span>
            <span className="text-base xl:text-lg font-black text-[#FF6B00] mt-1 block whitespace-nowrap">{formatRupiah(profitSummary.totalExpense)}</span>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Gaji: {formatRupiah(profitSummary.salaryCost)}</span>
          </div>
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Sisa Profit Bersih</span>
            <span className={`text-base xl:text-lg font-black mt-1 block whitespace-nowrap ${profitSummary.remainingProfitValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatRupiah(profitSummary.remainingProfitValue)}
            </span>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{profitPctVsSellIn}% vs Sell In</span>
          </div>
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
            <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Tagihan Belum Lunas</span>
            <span className="text-base xl:text-lg font-black text-[#00D2FF] mt-1 block whitespace-nowrap">{formatRupiah(unpaidBillsAmount)}</span>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{overdueBillsCount} Nota &gt; 30 Hari</span>
          </div>
        </div>

        <MonthlyProfitHrPanel pnlData={monthlyProfitHrSummary} filterMonth={filterMonth} />
      </div>
    );
  }
);

const TargetsAlertsDashboardPanel: React.FC<{
  targetsAlertsData: TargetsAlertsLensData;
  targetGapSummary: ExecutiveCoreSnapshot['targetGapSummary'];
  lostStoresCount: number;
  registeredSheetBaCount: number;
  registeredSheetTrainerCount: number;
  ketFilter: string;
  onChangeKet: (ket: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(
  ({
    targetsAlertsData,
    targetGapSummary,
    lostStoresCount,
    registeredSheetBaCount,
    registeredSheetTrainerCount,
    ketFilter,
    onChangeKet,
    onNavigateTab,
  }) => (
    <div className="flex-1 flex flex-col gap-3">
      <TargetsAlertsHeaderCards
        targetGapSummary={targetGapSummary}
        lostStoresCount={lostStoresCount}
        registeredSheetBaCount={registeredSheetBaCount}
        registeredSheetTrainerCount={registeredSheetTrainerCount}
        productStatusSummary={targetsAlertsData.productStatusSummary}
        ketFilter={ketFilter}
        onNavigateTab={onNavigateTab}
      />
      <TargetsGapPanel
        storeGapDetails={targetsAlertsData.storeGapDetails}
        totalStoreGapDeficit={targetsAlertsData.totalStoreGapDeficit}
        gapPreviousPeriodName={targetsAlertsData.gapPreviousPeriodName}
        gapCurrentPeriodName={targetsAlertsData.gapCurrentPeriodName}
        ketFilter={ketFilter}
        onChangeKet={onChangeKet}
      />
    </div>
  )
);

export const ExecutiveSalesDashboardView: React.FC<ExecutiveSalesDashboardViewProps> = ({
  allRecords,
  filteredRecords,
  filters,
  cascadingOptions,
  onChangeFilter,
  onExportPdf,
  onNavigateTab,
  isFullScreen = false,
  onToggleFullScreen,
  isActive = true,
}) => {
  // 2-tier lens state for instant 0ms sidebar button feedback
  const [uiLens, setUiLens] = useState<SidebarLens>('overview');
  const [activeLens, setActiveLens] = useState<SidebarLens>('overview');
  const [visitedLenses, setVisitedLenses] = useState<Set<SidebarLens>>(() => new Set(['overview']));
  const [isPendingLens, startLensTransition] = useTransition();

  // Periode Tanggal Filter (e.g. Tgl 1-10 OKTOBER vs NOVEMBER)
  const [dayPreset, setDayPreset] = useState<'ALL' | '1-10' | '1-15' | '1-20' | '11-20' | '21-31' | 'CUSTOM'>('ALL');
  const [startDayInput, setStartDayInput] = useState<string>('');
  const [endDayInput, setEndDayInput] = useState<string>('');

  const handleSelectDayPreset = useCallback(
    (preset: 'ALL' | '1-10' | '1-15' | '1-20' | '11-20' | '21-31' | 'CUSTOM') => {
      setDayPreset(preset);
      if (preset === 'ALL') {
        setStartDayInput('');
        setEndDayInput('');
      } else if (preset === '1-10') {
        setStartDayInput('1');
        setEndDayInput('10');
      } else if (preset === '1-15') {
        setStartDayInput('1');
        setEndDayInput('15');
      } else if (preset === '1-20') {
        setStartDayInput('1');
        setEndDayInput('20');
      } else if (preset === '11-20') {
        setStartDayInput('11');
        setEndDayInput('20');
      } else if (preset === '21-31') {
        setStartDayInput('21');
        setEndDayInput('31');
      }
    },
    []
  );

  const rawDayRange = useMemo<ExecutiveDayRange | undefined>(() => {
    if (!startDayInput && !endDayInput) return undefined;
    return {
      startDay: startDayInput ? Number(startDayInput) : undefined,
      endDay: endDayInput ? Number(endDayInput) : undefined,
    };
  }, [startDayInput, endDayInput]);

  const deferredDayRange = useDeferredValue(rawDayRange);

  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');

  const handleSelectLens = useCallback((lens: SidebarLens) => {
    setUiLens(lens);
    startLensTransition(() => {
      setVisitedLenses((prev) => {
        if (prev.has(lens)) return prev;
        const next = new Set(prev);
        next.add(lens);
        return next;
      });
      setActiveLens(lens);
    });
  }, []);

  const handleOpenTrendView = useCallback(() => {
    handleSelectLens('tren_bulanan');
  }, [handleSelectLens]);

  const handleShowAllMonths = useCallback(() => {
    onChangeFilter('BULAN', 'ALL');
  }, [onChangeFilter]);

  const handleChangeKet = useCallback(
    (ket: string) => {
      onChangeFilter('KET', ket as DashboardFilters['KET']);
    },
    [onChangeFilter]
  );

  const handleOpenTargetMgmt = useCallback(() => {
    onNavigateTab('target_mgmt');
  }, [onNavigateTab]);

  const handleOpenMarketShareMg = useCallback(() => {
    onNavigateTab('market_share_mg');
  }, [onNavigateTab]);

  const handleOpenPromo = useCallback(() => {
    onNavigateTab('promo_toko_online');
  }, [onNavigateTab]);

  const [quartalRefreshTick, setQuartalRefreshTick] = useState<number>(0);

  const handleTargetsUpdated = useCallback(() => {
    invalidateKpiDashboardCaches();
    setQuartalRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const onTargetsChanged = () => {
      invalidateKpiDashboardCaches();
      setQuartalRefreshTick((t) => t + 1);
    };
    window.addEventListener(TARGETS_UPDATED_EVENT, onTargetsChanged);
    window.addEventListener('storage', onTargetsChanged);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, onTargetsChanged);
      window.removeEventListener('storage', onTargetsChanged);
    };
  }, []);

  // Fast Core & Overview Snapshot
  const snap = useMemo(() => {
    void quartalRefreshTick;
    return buildExecutiveCoreSnapshot(allRecords, filteredRecords, filters, deferredDayRange);
  }, [allRecords, filteredRecords, filters, deferredDayRange, quartalRefreshTick]);

  // Persistent Per-Lens Cache (keeps visited menus instant on re-switch)
  const lensCacheRef = useRef<{
    allRecords: TransactionRecord[];
    filteredRecords: TransactionRecord[];
    filters: DashboardFilters;
    deferredDayRange: ExecutiveDayRange | undefined;
    quartalRefreshTick: number;
    selectedYear: number;
    trendRecords?: TransactionRecord[];
    trendByMode: Partial<Record<TimeframeMode, ReturnType<typeof aggregateTimeframe>>>;
    monthlySpvTargets?: ReturnType<typeof buildMonthlySpvTargetsMap>;
    marketShare?: { tick: number; data: MarketShareLensData };
    productMix?: ProductMixLensData;
    channelGrowth?: ReturnType<typeof buildChannelGrowthLensData>;
    promoBa?: { tick: number; data: PromoBaLensData };
    monthlyProfit?: MonthlyProfitHrSummary;
    targetsAlerts?: TargetsAlertsLensData;
    quarterRawByQ: Partial<Record<QuarterPeriodKey, ReturnType<typeof calculateQuarterlySummary>>>;
  }>({
    allRecords,
    filteredRecords,
    filters,
    deferredDayRange,
    quartalRefreshTick,
    selectedYear: snap.selectedYear,
    trendByMode: {},
    quarterRawByQ: {},
  });

  const lensCache = lensCacheRef.current;
  if (
    lensCache.allRecords !== allRecords ||
    lensCache.filteredRecords !== filteredRecords ||
    lensCache.filters !== filters ||
    lensCache.deferredDayRange !== deferredDayRange ||
    lensCache.quartalRefreshTick !== quartalRefreshTick ||
    lensCache.selectedYear !== snap.selectedYear
  ) {
    lensCache.allRecords = allRecords;
    lensCache.filteredRecords = filteredRecords;
    lensCache.filters = filters;
    lensCache.deferredDayRange = deferredDayRange;
    lensCache.quartalRefreshTick = quartalRefreshTick;
    lensCache.selectedYear = snap.selectedYear;
    lensCache.trendRecords = undefined;
    lensCache.trendByMode = {};
    lensCache.monthlySpvTargets = undefined;
    lensCache.productMix = undefined;
    lensCache.channelGrowth = undefined;
    lensCache.monthlyProfit = undefined;
    lensCache.targetsAlerts = undefined;
    lensCache.quarterRawByQ = {};
  }

  const needTrenBulanan = activeLens === 'tren_bulanan' || visitedLenses.has('tren_bulanan');
  const needMarketShare = activeLens === 'market_share' || visitedLenses.has('market_share');
  const needProductMix = activeLens === 'product_mix' || visitedLenses.has('product_mix');
  const needChannelGrowth = activeLens === 'channel_growth' || visitedLenses.has('channel_growth');
  const needPromoBa = activeLens === 'promo_ba' || visitedLenses.has('promo_ba');
  const needFinanceBills = activeLens === 'finance_bills' || visitedLenses.has('finance_bills');
  const needTargetsAlerts = activeLens === 'targets_alerts' || visitedLenses.has('targets_alerts');
  const needAchieveQuartal = activeLens === 'achieve_quartal' || visitedLenses.has('achieve_quartal');

  // Tren Pencapaian Bulanan & Rincian Data state & cached memo
  const [trendTimeframeMode, setTrendTimeframeMode] = useState<TimeframeMode>('bulanan');
  const trendRecords = useMemo(() => {
    if (!needTrenBulanan) return [];
    if (!lensCacheRef.current.trendRecords) {
      lensCacheRef.current.trendRecords = deferredDayRange
        ? filterRecordsByDayRange(filteredRecords, deferredDayRange)
        : filteredRecords;
    }
    return lensCacheRef.current.trendRecords;
  }, [needTrenBulanan, filteredRecords, deferredDayRange]);

  const trendChartData = useMemo(() => {
    if (!needTrenBulanan) return [];
    const existing = lensCacheRef.current.trendByMode[trendTimeframeMode];
    if (existing) return existing;
    const computed = aggregateTimeframe(trendRecords, trendTimeframeMode);
    lensCacheRef.current.trendByMode[trendTimeframeMode] = computed;
    return computed;
  }, [needTrenBulanan, trendRecords, trendTimeframeMode]);

  const monthlySpvTargetsData = useMemo(() => {
    void quartalRefreshTick;
    if (!needTrenBulanan) return null;
    if (!lensCacheRef.current.monthlySpvTargets) {
      lensCacheRef.current.monthlySpvTargets = buildMonthlySpvTargetsMap(allRecords, {
        TAHUN: filters.TAHUN,
        SPV: filters.SPV,
        REGION: filters.REGION,
        SALES: filters.SALES,
        NAMA_STORE: filters.NAMA_STORE,
      });
    }
    return lensCacheRef.current.monthlySpvTargets;
  }, [
    needTrenBulanan,
    allRecords,
    filters.TAHUN,
    filters.SPV,
    filters.REGION,
    filters.SALES,
    filters.NAMA_STORE,
    quartalRefreshTick,
  ]);

  const marketShareData = useMemo(() => {
    if (!needMarketShare) return null;
    if (lensCacheRef.current.marketShare?.tick === quartalRefreshTick) {
      return lensCacheRef.current.marketShare.data;
    }
    const data = buildMarketShareLensData();
    lensCacheRef.current.marketShare = { tick: quartalRefreshTick, data };
    return data;
  }, [needMarketShare, quartalRefreshTick]);

  const productMixData = useMemo(() => {
    if (!needProductMix) return null;
    if (!lensCacheRef.current.productMix) {
      lensCacheRef.current.productMix = buildProductMixLensData(filteredRecords, deferredDayRange);
    }
    return lensCacheRef.current.productMix;
  }, [needProductMix, filteredRecords, deferredDayRange]);

  const channelGrowthRows = useMemo(() => {
    if (!needChannelGrowth) return null;
    if (!lensCacheRef.current.channelGrowth) {
      lensCacheRef.current.channelGrowth = buildChannelGrowthLensData(
        allRecords,
        snap.selectedYear,
        filters,
        deferredDayRange
      );
    }
    return lensCacheRef.current.channelGrowth;
  }, [needChannelGrowth, allRecords, snap.selectedYear, filters, deferredDayRange]);

  const promoBaData = useMemo(() => {
    if (!needPromoBa) return null;
    if (lensCacheRef.current.promoBa?.tick === quartalRefreshTick) {
      return lensCacheRef.current.promoBa.data;
    }
    const data = buildPromoBaLensData();
    lensCacheRef.current.promoBa = { tick: quartalRefreshTick, data };
    return data;
  }, [needPromoBa, quartalRefreshTick]);

  const monthlyProfitHrSummary = useMemo(() => {
    if (!needFinanceBills) return null;
    if (!lensCacheRef.current.monthlyProfit) {
      lensCacheRef.current.monthlyProfit = buildMonthlyProfitHrSummary(
        allRecords,
        filters,
        snap.selectedYear,
        deferredDayRange
      );
    }
    return lensCacheRef.current.monthlyProfit;
  }, [needFinanceBills, allRecords, filters, snap.selectedYear, deferredDayRange]);

  const targetsAlertsData = useMemo(() => {
    if (!needTargetsAlerts) return null;
    if (!lensCacheRef.current.targetsAlerts) {
      lensCacheRef.current.targetsAlerts = buildTargetsAlertsLensData(
        allRecords,
        filteredRecords,
        filters,
        snap.gapDiagnosis,
        deferredDayRange
      );
    }
    return lensCacheRef.current.targetsAlerts;
  }, [needTargetsAlerts, allRecords, filteredRecords, filters, snap.gapDiagnosis, deferredDayRange]);

  const [selectedQuarter, setSelectedQuarter] = useState<QuarterPeriodKey>('Q4');

  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      const b = filters.BULAN.trim().toUpperCase();
      if (['JANUARI', 'FEBRUARI', 'MARET'].includes(b)) setSelectedQuarter('Q1');
      else if (['APRIL', 'MEI', 'JUNI'].includes(b)) setSelectedQuarter('Q2');
      else if (['JULI', 'AGUSTUS', 'SEPTEMBER'].includes(b)) setSelectedQuarter('Q3');
      else if (['OKTOBER', 'NOVEMBER', 'DESEMBER'].includes(b)) setSelectedQuarter('Q4');
    }
  }, [filters.BULAN]);

  const computeQuarterSummaryForSelected = useCallback(
    (qKey: QuarterPeriodKey) => {
      const hasProductSubFilters =
        filters.BRAND !== 'ALL' ||
        (filters.KATEGORI && filters.KATEGORI !== 'ALL') ||
        (filters.STATUS_PRODUK && filters.STATUS_PRODUK !== 'ALL') ||
        filters.SKU !== 'ALL';

      let baseQuarterRecords = allRecords;
      if (hasProductSubFilters) {
        baseQuarterRecords = filterRecords(allRecords, {
          ...filters,
          BULAN: 'ALL',
          TAHUN: 'ALL',
          SALES: 'ALL',
          TRAINER: 'ALL',
          SPV: 'ALL',
          REGION: 'ALL',
          NAMA_STORE: 'ALL',
          KET: 'ALL',
          searchQuery: '',
        });
      }
      if (deferredDayRange && (deferredDayRange.startDay || deferredDayRange.endDay)) {
        baseQuarterRecords = filterRecordsByDayRange(baseQuarterRecords, deferredDayRange);
      }

      const activeKet = (filters.KET || 'ALL').toUpperCase().trim();
      return calculateQuarterlySummary(
        baseQuarterRecords,
        qKey,
        snap.selectedYear,
        filters.REGION,
        filters.SPV,
        activeKet
      );
    },
    [allRecords, filters, snap.selectedYear, deferredDayRange]
  );

  const rawQuarterSummary = useMemo(() => {
    if (!needAchieveQuartal) return null;
    const cachedQ = lensCacheRef.current.quarterRawByQ[selectedQuarter];
    if (cachedQ) return cachedQ;
    const rawQuarter = computeQuarterSummaryForSelected(selectedQuarter);
    lensCacheRef.current.quarterRawByQ[selectedQuarter] = rawQuarter;
    return rawQuarter;
  }, [needAchieveQuartal, selectedQuarter, computeQuarterSummaryForSelected, quartalRefreshTick]);

  // Cancellable idle pre-warmer: silently warms unvisited lens caches in short idle slices
  // without causing re-renders, so clicking any unvisited menu feels instantaneous.
  useEffect(() => {
    if (!isActive || activeLens !== 'overview') return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const tasks: Array<() => void> = [
      () => {
        if (!lensCacheRef.current.monthlySpvTargets) {
          lensCacheRef.current.monthlySpvTargets = buildMonthlySpvTargetsMap(allRecords, {
            TAHUN: filters.TAHUN,
            SPV: filters.SPV,
            REGION: filters.REGION,
            SALES: filters.SALES,
            NAMA_STORE: filters.NAMA_STORE,
          });
        }
        if (!lensCacheRef.current.trendRecords) {
          lensCacheRef.current.trendRecords = deferredDayRange
            ? filterRecordsByDayRange(filteredRecords, deferredDayRange)
            : filteredRecords;
        }
        if (!lensCacheRef.current.trendByMode[trendTimeframeMode]) {
          lensCacheRef.current.trendByMode[trendTimeframeMode] = aggregateTimeframe(
            lensCacheRef.current.trendRecords,
            trendTimeframeMode
          );
        }
      },
      () => {
        if (!lensCacheRef.current.productMix) {
          lensCacheRef.current.productMix = buildProductMixLensData(filteredRecords, deferredDayRange);
        }
      },
      () => {
        if (!lensCacheRef.current.channelGrowth) {
          lensCacheRef.current.channelGrowth = buildChannelGrowthLensData(
            allRecords,
            snap.selectedYear,
            filters,
            deferredDayRange
          );
        }
      },
      () => {
        if (!lensCacheRef.current.targetsAlerts) {
          lensCacheRef.current.targetsAlerts = buildTargetsAlertsLensData(
            allRecords,
            filteredRecords,
            filters,
            snap.gapDiagnosis,
            deferredDayRange
          );
        }
      },
      () => {
        if (!lensCacheRef.current.monthlyProfit) {
          lensCacheRef.current.monthlyProfit = buildMonthlyProfitHrSummary(
            allRecords,
            filters,
            snap.selectedYear,
            deferredDayRange
          );
        }
      },
      () => {
        if (lensCacheRef.current.marketShare?.tick !== quartalRefreshTick) {
          lensCacheRef.current.marketShare = {
            tick: quartalRefreshTick,
            data: buildMarketShareLensData(),
          };
        }
        if (lensCacheRef.current.promoBa?.tick !== quartalRefreshTick) {
          lensCacheRef.current.promoBa = {
            tick: quartalRefreshTick,
            data: buildPromoBaLensData(),
          };
        }
      },
      () => {
        getCachedKpiSalesItems();
        getCachedKpiTrainerItems();
      },
      () => {
        if (!lensCacheRef.current.quarterRawByQ[selectedQuarter]) {
          lensCacheRef.current.quarterRawByQ[selectedQuarter] =
            computeQuarterSummaryForSelected(selectedQuarter);
        }
      },
    ];

    let idx = 0;
    const runNext = () => {
      if (cancelled || idx >= tasks.length) return;
      try {
        tasks[idx]();
      } catch {
        // Ignore background warmup errors; on-demand memo remains authoritative
      }
      idx += 1;
      if (!cancelled && idx < tasks.length) {
        scheduleNext();
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      };
      if (typeof win.requestIdleCallback === 'function') {
        idleHandle = win.requestIdleCallback(() => {
          timeoutHandle = setTimeout(runNext, 90);
        }, { timeout: 600 });
      } else {
        timeoutHandle = setTimeout(runNext, 140);
      }
    };

    timeoutHandle = setTimeout(scheduleNext, 260);

    return () => {
      cancelled = true;
      const win = window as Window & {
        cancelIdleCallback?: (id: number) => void;
      };
      if (idleHandle !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [
    isActive,
    activeLens,
    allRecords,
    filteredRecords,
    filters,
    deferredDayRange,
    snap.selectedYear,
    snap.gapDiagnosis,
    trendTimeframeMode,
    selectedQuarter,
    quartalRefreshTick,
    computeQuarterSummaryForSelected,
  ]);

  const sidebarItems = useMemo<
    ReadonlyArray<{
      id: SidebarLens;
      label: string;
      icon: React.ReactNode;
    }>
  >(
    () => [
      { id: 'overview', label: 'Overview Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      { id: 'tren_bulanan', label: 'Tren Bulanan & Rincian', icon: <Calendar className="w-3.5 h-3.5" /> },
      { id: 'regional', label: 'Area & Tim Sales', icon: <MapPin className="w-3.5 h-3.5" /> },
      { id: 'market_share', label: 'Market Share MG', icon: <PieChartIcon className="w-3.5 h-3.5" /> },
      { id: 'product_mix', label: 'Brand, Kategori & SKU', icon: <Layers className="w-3.5 h-3.5" /> },
      { id: 'channel_growth', label: 'Growth & BA vs Non-BA', icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { id: 'promo_ba', label: 'Tim BA, Promo & Visit', icon: <Tag className="w-3.5 h-3.5" /> },
      { id: 'finance_bills', label: 'Profit, Cost & Tagihan', icon: <Wallet className="w-3.5 h-3.5" /> },
      { id: 'targets_alerts', label: 'Target & Analisa Gap', icon: <Target className="w-3.5 h-3.5" /> },
      { id: 'kpi_sales', label: 'KPI Sales', icon: <Award className="w-3.5 h-3.5" /> },
      { id: 'kpi_trainer', label: 'KPI Trainer', icon: <GraduationCap className="w-3.5 h-3.5" /> },
      { id: 'achieve_quartal', label: 'Achieve Quartal', icon: <Crown className="w-3.5 h-3.5" /> },
    ],
    []
  );

  const handleScreenshot = useCallback(async () => {
    if (!mainPanelRef.current || screenshotStatus === 'capturing') return;
    setScreenshotStatus('capturing');
    const activeLabel =
      sidebarItems.find((s) => s.id === activeLens)?.label || 'Dashboard';
    const safeMenu = activeLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
    const safeMonth = (filters.BULAN || 'ALL').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      await captureElementToPng({
        element: mainPanelRef.current,
        filename: `Screenshoot_${safeMenu}_${safeMonth}_${snap.selectedYear}_${stamp}.png`,
        backgroundColor: '#0A0E17',
        scale: 1.5,
      });
      setScreenshotStatus('done');
      setTimeout(() => setScreenshotStatus('idle'), 2200);
    } catch (err) {
      console.error('Screenshoot gagal:', err);
      setScreenshotStatus('error');
      setTimeout(() => setScreenshotStatus('idle'), 2500);
    }
  }, [activeLens, filters.BULAN, screenshotStatus, sidebarItems, snap.selectedYear]);

  return (
    <div
      className={
        isFullScreen
          ? 'bg-[#0A0E17] text-slate-100 min-h-screen w-full overflow-hidden'
          : 'rounded-xl overflow-hidden bg-[#0A0E17] text-slate-100 border border-[#1E293B] shadow-2xl'
      }
    >
      <div
        className={`flex flex-col lg:flex-row ${
          isFullScreen ? 'min-h-screen' : 'lg:min-h-[calc(100vh-118px)]'
        }`}
      >
        {/* LEFT DARK SIDEBAR */}
        <DashboardSidebar
          sidebarItems={sidebarItems}
          uiLens={uiLens}
          onSelectLens={handleSelectLens}
          selectedYear={snap.selectedYear}
          targetTotal={snap.targetTotal}
          achievementPercent={snap.achievementPercent}
          totalRevenue={snap.summary.totalRevenue}
          selectedMonthLabel={snap.selectedMonthLabel}
        />

        {/* MAIN RIGHT CONTENT PANEL */}
        <div
          ref={mainPanelRef}
          className="flex-1 min-w-0 flex flex-col justify-between p-3 xl:p-3.5 gap-2.5 bg-[#0A0E17]"
        >
          {/* TOP DASHBOARD HEADER */}
          <div className="flex flex-col gap-2 pb-2 border-b border-[#1C2536]">
            {/* ROW 1: TITLE (LEFT) & PRIMARY ACTIONS AT VERY TOP-RIGHT */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-3 flex-wrap">
                {onToggleFullScreen && (
                  <button
                    type="button"
                    data-capture-hide="true"
                    onClick={onToggleFullScreen}
                    title={
                      isFullScreen
                        ? 'Tampilkan kembali semua menu navigasi SalesPro Analytics'
                        : 'Sembunyikan menu SalesPro Analytics agar Dashboard tampil penuh di layar'
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                      isFullScreen
                        ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-400/50 text-cyan-200 shadow-sm shadow-cyan-500/10'
                        : 'bg-[#162033] hover:bg-[#1E2B45] border-[#2C3E5E] text-slate-200'
                    }`}
                  >
                    {isFullScreen ? (
                      <>
                        <PanelTopOpen className="w-4 h-4 text-cyan-300" />
                        <span>Tampilkan Menu</span>
                      </>
                    ) : (
                      <>
                        <PanelTopClose className="w-4 h-4 text-[#FF6B00]" />
                        <span>Sembunyikan Menu (Full Layar)</span>
                      </>
                    )}
                  </button>
                )}
                <div>
                  <h1 className="text-sm xl:text-base font-extrabold tracking-tight text-white uppercase leading-tight">
                    SALESPRO ANALYTICS &amp; MARKET SHARE DASHBOARD
                  </h1>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                    Semua Data SalesPro Analytics Terintegrasi · Ringkasan Eksekutif {snap.selectedMonthLabel}
                    {isPendingLens ? ' · Memuat...' : ''}
                  </p>
                </div>
              </div>

              {/* TOP-RIGHT ACTIONS: EXPORT PDF + SCREENSHOOT LAYAR */}
              <div data-capture-hide="true" className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  type="button"
                  onClick={onExportPdf}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-orange-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>

                <button
                  type="button"
                  disabled={screenshotStatus === 'capturing'}
                  onClick={handleScreenshot}
                  title="Ambil gambar seluruh tampilan menu dashboard yang sedang dibuka"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md ${
                    screenshotStatus === 'done'
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 shadow-emerald-500/15'
                      : screenshotStatus === 'error'
                      ? 'bg-rose-500/20 border-rose-400/60 text-rose-200 shadow-rose-500/15'
                      : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-400/50 text-cyan-200 shadow-cyan-500/15'
                  }`}
                >
                  {screenshotStatus === 'capturing' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                      <span>Menyimpan...</span>
                    </>
                  ) : screenshotStatus === 'done' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Tersimpan ✓</span>
                    </>
                  ) : screenshotStatus === 'error' ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                      <span>Gagal</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Screenshoot Layar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ROW 2: INTEGRATED FILTERS (Periode + Area + Sales + Toko + Brand + Tipe) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-[#121926] border border-[#243147] rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Periode:</span>
                <select
                  value={filters.BULAN}
                  onChange={(e) => onChangeFilter('BULAN', e.target.value)}
                  className="bg-transparent font-bold text-white outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#121926]">
                    Semua Bulan ({snap.selectedYear})
                  </option>
                  {cascadingOptions.months.map((m) => (
                    <option key={m} value={m} className="bg-[#121926]">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-[#121926] border border-[#243147] rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Area:</span>
                <select
                  value={filters.REGION}
                  onChange={(e) => onChangeFilter('REGION', e.target.value)}
                  className="bg-transparent font-bold text-white outline-none cursor-pointer max-w-[120px]"
                >
                  <option value="ALL" className="bg-[#121926]">
                    Semua Area
                  </option>
                  {cascadingOptions.regions.map((reg) => (
                    <option key={reg} value={reg} className="bg-[#121926]">
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-[#121926] border border-[#243147] rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Sales:</span>
                <select
                  value={filters.SALES}
                  onChange={(e) => onChangeFilter('SALES', e.target.value)}
                  className="bg-transparent font-bold text-white outline-none cursor-pointer max-w-[120px]"
                >
                  <option value="ALL" className="bg-[#121926]">
                    Semua Sales
                  </option>
                  {cascadingOptions.sales.map((s) => (
                    <option key={s} value={s} className="bg-[#121926]">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <SearchableStoreFilter
                theme="dark"
                label="Toko"
                value={filters.NAMA_STORE}
                stores={cascadingOptions.stores || []}
                onChange={(val) => onChangeFilter('NAMA_STORE', val)}
              />

              <div className="flex items-center gap-1 bg-[#121926] border border-[#243147] rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Brand:</span>
                <select
                  value={filters.BRAND}
                  onChange={(e) => onChangeFilter('BRAND', e.target.value)}
                  className="bg-transparent font-bold text-white outline-none cursor-pointer max-w-[120px]"
                >
                  <option value="ALL" className="bg-[#121926]">
                    Semua Brand
                  </option>
                  {cascadingOptions.brands.map((b) => (
                    <option key={b} value={b} className="bg-[#121926]">
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-[#121926] border border-[#243147] rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-slate-400 font-medium">Tipe:</span>
                <select
                  value={filters.KET}
                  onChange={(e) => onChangeFilter('KET', e.target.value)}
                  className="bg-transparent font-bold text-white outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#121926]">
                    Semua (In &amp; Out)
                  </option>
                  {cascadingOptions.ket.map((k) => (
                    <option key={k} value={k} className="bg-[#121926]">
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PROMINENT ENLARGED FILTER PERIODE TANGGAL BAR */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 border transition-colors ${
              snap.activeDayRangeLabel
                ? 'bg-[#152035] border-[#FF6B00]/70 shadow-sm shadow-orange-500/10'
                : 'bg-[#121926] border-[#243147]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/35 text-[#FF6B00]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white block leading-none">
                    Filter Periode Tanggal
                  </span>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    Bandingkan rentang tanggal yang sama antar bulan (contoh: Tgl 1–10)
                  </span>
                </div>
              </div>

              <select
                value={dayPreset}
                onChange={(e) =>
                  handleSelectDayPreset(
                    e.target.value as 'ALL' | '1-10' | '1-15' | '1-20' | '11-20' | '21-31' | 'CUSTOM'
                  )
                }
                className="bg-[#0D121D] border border-[#2A3952] focus:border-[#FF6B00] rounded-lg px-3 py-1.5 text-xs sm:text-sm font-extrabold text-white outline-none cursor-pointer min-w-[140px]"
              >
                <option value="ALL" className="bg-[#121926]">
                  Semua Tanggal
                </option>
                <option value="1-10" className="bg-[#121926]">
                  Tgl 1 – 10
                </option>
                <option value="1-15" className="bg-[#121926]">
                  Tgl 1 – 15
                </option>
                <option value="1-20" className="bg-[#121926]">
                  Tgl 1 – 20
                </option>
                <option value="11-20" className="bg-[#121926]">
                  Tgl 11 – 20
                </option>
                <option value="21-31" className="bg-[#121926]">
                  Tgl 21 – 31
                </option>
                <option value="CUSTOM" className="bg-[#121926]">
                  Custom Tanggal
                </option>
              </select>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { key: 'ALL', label: 'Semua' },
                    { key: '1-10', label: '1–10' },
                    { key: '1-15', label: '1–15' },
                    { key: '1-20', label: '1–20' },
                    { key: '11-20', label: '11–20' },
                    { key: '21-31', label: '21–31' },
                  ] as const
                ).map((preset) => {
                  const active = dayPreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelectDayPreset(preset.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer border whitespace-nowrap ${
                        active
                          ? 'bg-[#FF6B00] border-[#FF6B00] text-white shadow-sm shadow-orange-600/25'
                          : 'bg-[#0D121D] border-[#243147] text-slate-300 hover:text-white hover:border-[#3A4D6E]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 bg-[#0D121D] border border-[#2A3952] rounded-lg px-3 py-1">
                <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Dari Tgl</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="1"
                  value={startDayInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDayPreset('CUSTOM');
                    setStartDayInput(v === '' ? '' : String(Math.max(1, Math.min(31, Number(v) || 1))));
                  }}
                  title="Tanggal Awal (1-31)"
                  className="w-14 h-8 bg-[#121926] border border-[#334563] rounded-md px-1.5 text-center font-mono text-sm font-black text-cyan-300 outline-none focus:border-[#FF6B00]"
                />
                <span className="text-sm font-bold text-slate-400">s/d</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="31"
                  value={endDayInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDayPreset('CUSTOM');
                    setEndDayInput(v === '' ? '' : String(Math.max(1, Math.min(31, Number(v) || 31))));
                  }}
                  title="Tanggal Akhir (1-31)"
                  className="w-14 h-8 bg-[#121926] border border-[#334563] rounded-md px-1.5 text-center font-mono text-sm font-black text-cyan-300 outline-none focus:border-[#FF6B00]"
                />
              </div>

              {(startDayInput || endDayInput) && (
                <button
                  type="button"
                  onClick={() => handleSelectDayPreset('ALL')}
                  title="Reset Filter Tanggal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-extrabold cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Tgl</span>
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE LENS CONTENT (Visited panels stay mounted via CSS hidden + React.memo for 0ms re-switch) */}
          {(activeLens === 'overview' || visitedLenses.has('overview')) && (
            <div
              className={activeLens === 'overview' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'overview' ? 'true' : undefined}
            >
              <OverviewDashboardPanel
                snap={snap}
                onOpenTrendView={handleOpenTrendView}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {needTrenBulanan && (
            <div
              className={activeLens === 'tren_bulanan' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'tren_bulanan' ? 'true' : undefined}
            >
              <TrenBulananDashboardPanel
                trendChartData={trendChartData}
                trendTimeframeMode={trendTimeframeMode}
                onTrendTimeframeModeChange={setTrendTimeframeMode}
                filters={filters}
                effectiveFilteredCount={snap.effectiveFilteredCount}
                monthlySpvTargetsData={monthlySpvTargetsData}
                onShowAllMonths={handleShowAllMonths}
                onOpenTargetMgmt={handleOpenTargetMgmt}
              />
            </div>
          )}

          {(activeLens === 'regional' || visitedLenses.has('regional')) && (
            <div
              className={activeLens === 'regional' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'regional' ? 'true' : undefined}
            >
              <RegionalSalesPanel
                sales={snap.targetMatrix.sales}
                areas={snap.targetMatrix.areas}
                spvs={snap.targetMatrix.spvs}
                ketFilter={filters.KET}
                selectedMonthLabel={snap.selectedMonthLabel}
                onChangeKet={handleChangeKet}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {needMarketShare && marketShareData && (
            <div
              className={activeLens === 'market_share' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'market_share' ? 'true' : undefined}
            >
              <MarketShareDashboardPanel
                marketShareData={marketShareData}
                onOpenMarketShareMg={handleOpenMarketShareMg}
              />
            </div>
          )}

          {needProductMix && productMixData && (
            <div
              className={activeLens === 'product_mix' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'product_mix' ? 'true' : undefined}
            >
              <ProductMixDashboardPanel
                productMixData={productMixData}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {needChannelGrowth && channelGrowthRows && (
            <div
              className={activeLens === 'channel_growth' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'channel_growth' ? 'true' : undefined}
            >
              <ChannelGrowthDashboardPanel
                channelGrowthRows={channelGrowthRows}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {needPromoBa && promoBaData && (
            <div
              className={activeLens === 'promo_ba' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'promo_ba' ? 'true' : undefined}
            >
              <PromoBaDashboardPanel
                promoBaData={promoBaData}
                promoTotalActual={snap.promoTotalActual}
                promoStoreCount={snap.promoStoreCount}
                promoDaysCount={snap.promoDaysCount}
                baTotalDenda={snap.baTotalDenda}
                baIncidentsCount={snap.baIncidentsCount}
                salesVisitsCount={snap.salesVisitsCount}
                trainerVisitsCount={snap.trainerVisitsCount}
                onNavigateTab={onNavigateTab}
                onOpenPromo={handleOpenPromo}
              />
            </div>
          )}

          {needFinanceBills && monthlyProfitHrSummary && (
            <div
              className={activeLens === 'finance_bills' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'finance_bills' ? 'true' : undefined}
            >
              <FinanceBillsDashboardPanel
                monthlyProfitHrSummary={monthlyProfitHrSummary}
                profitSummary={snap.profitSummary}
                unpaidBillsAmount={snap.unpaidBillsAmount}
                overdueBillsCount={snap.overdueBillsCount}
                filterMonth={filters.BULAN}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {needTargetsAlerts && targetsAlertsData && (
            <div
              className={activeLens === 'targets_alerts' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'targets_alerts' ? 'true' : undefined}
            >
              <TargetsAlertsDashboardPanel
                targetsAlertsData={targetsAlertsData}
                targetGapSummary={snap.targetGapSummary}
                lostStoresCount={snap.gapDiagnosis.lostStoresCount}
                registeredSheetBaCount={snap.registeredSheetBaCount}
                registeredSheetTrainerCount={snap.registeredSheetTrainerCount}
                ketFilter={filters.KET}
                onChangeKet={handleChangeKet}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {needAchieveQuartal && rawQuarterSummary && (
            <div
              className={activeLens === 'achieve_quartal' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'achieve_quartal' ? 'true' : undefined}
            >
              <AchieveQuartalDashboardPanel
                rawQuarter={rawQuarterSummary}
                filters={filters}
                selectedQuarter={selectedQuarter}
                onSelectQuarter={setSelectedQuarter}
                selectedYear={snap.selectedYear}
                onNavigateTab={onNavigateTab}
                onTargetsUpdated={handleTargetsUpdated}
              />
            </div>
          )}

          {(activeLens === 'kpi_sales' || visitedLenses.has('kpi_sales')) && (
            <div
              className={activeLens === 'kpi_sales' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'kpi_sales' ? 'true' : undefined}
            >
              <KpiSalesDashboardPanel
                filters={filters}
                selectedYear={snap.selectedYear}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {(activeLens === 'kpi_trainer' || visitedLenses.has('kpi_trainer')) && (
            <div
              className={activeLens === 'kpi_trainer' ? 'flex-1 flex flex-col' : 'hidden'}
              data-capture-hide={activeLens !== 'kpi_trainer' ? 'true' : undefined}
            >
              <KpiTrainerDashboardPanel
                filters={filters}
                selectedYear={snap.selectedYear}
                onNavigateTab={onNavigateTab}
              />
            </div>
          )}

          {/* BOTTOM QUIET FOOTER */}
          <div className="pt-1.5 border-t border-[#1C2536] flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>
              Sumber Data: Data Transaksi Google Sheets, Market Share MG, Promo Toko Online &amp; Pengaturan SalesPro Analytics
            </span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              {formatNumber(snap.effectiveFilteredCount)} Baris Transaksi Aktif · {snap.selectedMonthLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

