import React, { useMemo, useState, useEffect, useTransition, useDeferredValue } from 'react';
import {
  TransactionRecord,
  DashboardFilters,
  ActiveTab,
  StoreGapDetailItem,
  QuarterPeriodKey,
  SalesQuarterlySummaryItem,
  BaQuarterlySummaryItem,
  TrainerQuarterlySummaryItem,
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
  MonthlyTrajectoryPoint,
  MonthlyProfitHrSummary,
} from '../services/executiveDashboardService';
import { calculateQuarterlySummary } from '../services/quarterlySummaryService';
import { SALES_MASTER_6_CONFIG } from '../services/kpiSalesData';
import { MonthlyOnlinePromoRecapRow } from '../services/onlinePromoService';
import { formatRupiah, formatNumber, formatPercent, filterRecords } from '../utils/analytics';
import {
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
  CheckCircle2,
  Star,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  Tag,
  Search,
  X,
  Building2,
  Users,
  BarChart2,
  BarChart3,
  Calendar,
  Award,
  PanelTopOpen,
  PanelTopClose,
  Edit3,
  Crown,
  Medal,
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
}

type SidebarLens =
  | 'overview'
  | 'regional'
  | 'market_share'
  | 'product_mix'
  | 'channel_growth'
  | 'promo_ba'
  | 'finance_bills'
  | 'targets_alerts'
  | 'achieve_quartal';

function formatCompactIdr(val: number): string {
  if (!Number.isFinite(val)) return 'Rp 0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')}Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${Math.round(abs / 1_000)}Rb`;
  }
  return `${sign}Rp ${Math.round(abs)}`;
}

const MiniProgressRing: React.FC<{
  percent: number;
  color: string;
  label?: string;
}> = React.memo(({ percent, color, label }) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const r = 15.5;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#1E293B" strokeWidth="3.8" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute text-[9px] font-mono tabular-nums font-bold text-slate-100">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
});

// Isolated Memoized Donut Card (hovering does NOT re-render dashboard)
const BrandShareDonutCard: React.FC<{
  topBrands: { name: string; value: number; sharePct: number; color: string }[];
  selectedYear: number;
}> = React.memo(({ topBrands, selectedYear }) => {
  const [hoveredBrandIdx, setHoveredBrandIdx] = useState<number | null>(null);
  const topBrand = topBrands[0];

  const donutSegments = useMemo(() => {
    const r = 56;
    const circumference = 2 * Math.PI * r;
    const totalShare = topBrands.reduce((s, b) => s + Math.max(0, b.sharePct), 0);
    let offset = 0;
    return topBrands.map((b) => {
      const normalizedPct = totalShare > 0 ? (Math.max(0, b.sharePct) / totalShare) * 100 : 0;
      const len = (normalizedPct / 100) * circumference;
      const seg = {
        ...b,
        strokeLength: Math.max(0, len - 2),
        strokeOffset: -offset,
      };
      offset += len;
      return seg;
    });
  }, [topBrands]);

  return (
    <div className="lg:col-span-4 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
          PANGSA BRAND KOSMETIK ({selectedYear})
        </h2>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          Data SalesPro Aktual
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-auto">
        <div className="relative w-[124px] h-[124px] shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="56" fill="none" stroke="#1B2436" strokeWidth="22" />
            {donutSegments.map((seg, idx) => (
              <circle
                key={seg.name}
                cx="75"
                cy="75"
                r="56"
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredBrandIdx === idx ? 25 : 22}
                strokeDasharray={`${seg.strokeLength} ${2 * Math.PI * 56}`}
                strokeDashoffset={seg.strokeOffset}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredBrandIdx(idx)}
                onMouseLeave={() => setHoveredBrandIdx(null)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none">
            <span className="text-base font-black font-mono tabular-nums text-white leading-none">
              {hoveredBrandIdx !== null && topBrands[hoveredBrandIdx]
                ? `${topBrands[hoveredBrandIdx].sharePct}%`
                : topBrand
                ? `${topBrand.sharePct}%`
                : '0%'}
            </span>
            <span className="text-[9.5px] font-extrabold uppercase text-[#FF6B00] mt-0.5 truncate max-w-[78px]">
              {hoveredBrandIdx !== null && topBrands[hoveredBrandIdx]
                ? topBrands[hoveredBrandIdx].name
                : topBrand?.name || '-'}
            </span>
            <span className="text-[8.5px] text-slate-400 font-mono tabular-nums">
              {hoveredBrandIdx !== null
                ? formatCompactIdr(topBrands[hoveredBrandIdx]?.value || 0)
                : '#1 Brand'}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 space-y-1 text-[11px]">
          {topBrands.map((b, idx) => (
            <div
              key={b.name}
              onMouseEnter={() => setHoveredBrandIdx(idx)}
              onMouseLeave={() => setHoveredBrandIdx(null)}
              className={`flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                hoveredBrandIdx === idx ? 'bg-[#1A2438]' : ''
              }`}
              title={`${b.name}: ${formatRupiah(b.value)} (${b.sharePct}%)`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                <span className="font-medium text-slate-200 truncate">{b.name}</span>
              </div>
              <span
                className="font-mono tabular-nums font-bold shrink-0 whitespace-nowrap"
                style={{ color: idx === 0 ? '#FF6B00' : '#E2E8F0' }}
              >
                {b.sharePct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// Isolated Memoized Trajectory Card (hovering does NOT re-render dashboard)
const TrajectoryChartCard: React.FC<{
  monthlyTrajectory: MonthlyTrajectoryPoint[];
  avgMonthlyRevenue: number;
  selectedYear: number;
}> = React.memo(({ monthlyTrajectory, avgMonthlyRevenue, selectedYear }) => {
  const [hoveredTrajIdx, setHoveredTrajIdx] = useState<number | null>(null);

  const trajectoryChart = useMemo(() => {
    const pts = monthlyTrajectory;
    const maxVal = Math.max(1, ...pts.map((p) => p.totalValue)) * 1.18;
    const width = 460;
    const height = 136;
    const padLeft = 52;
    const padRight = 20;
    const padTop = 24;
    const padBottom = 22;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const coords = pts.map((p, idx) => {
      const x =
        pts.length > 1 ? padLeft + (idx / (pts.length - 1)) * plotW : padLeft + plotW / 2;
      const y = padTop + plotH - (p.totalValue / maxVal) * plotH;
      return { ...p, x, y };
    });

    const linePath =
      coords.length > 0
        ? coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
        : '';

    const areaPath =
      coords.length > 1
        ? `${linePath} L ${coords[coords.length - 1].x} ${padTop + plotH} L ${coords[0].x} ${padTop + plotH} Z`
        : '';

    const peakCoord =
      coords.length > 0 ? [...coords].sort((a, b) => b.totalValue - a.totalValue)[0] : null;

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      plotH,
      maxVal,
      coords,
      linePath,
      areaPath,
      peakCoord,
    };
  }, [monthlyTrajectory]);

  return (
    <div className="lg:col-span-7 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
          TRAJEKTORI OMSET BULANAN {selectedYear}
        </h2>
        <span
          className="text-[10.5px] font-bold font-mono tabular-nums text-emerald-400 whitespace-nowrap"
          title={`Rata-rata: ${formatRupiah(avgMonthlyRevenue)} / bulan`}
        >
          Avg: {formatCompactIdr(avgMonthlyRevenue)}/bln
        </span>
      </div>

      <div className="relative my-auto">
        {hoveredTrajIdx !== null && trajectoryChart.coords[hoveredTrajIdx] && (
          <div className="mb-1 px-2 py-0.5 rounded bg-[#1A2438] border border-[#2C3B57] text-[10px] font-mono tabular-nums flex items-center justify-between">
            <span className="font-sans font-bold text-white">
              {trajectoryChart.coords[hoveredTrajIdx].month} {selectedYear}
            </span>
            <span className="text-[#FF6B00] font-bold">
              {formatRupiah(trajectoryChart.coords[hoveredTrajIdx].totalValue)}
            </span>
          </div>
        )}

        <svg viewBox={`0 0 ${trajectoryChart.width} ${trajectoryChart.height}`} className="w-full h-[132px]">
          <defs>
            <linearGradient id="trajOrangeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.33, 0.66, 1].map((ratio) => {
            const yPos = trajectoryChart.padTop + trajectoryChart.plotH - ratio * trajectoryChart.plotH;
            const tickVal = trajectoryChart.maxVal * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={trajectoryChart.padLeft}
                  y1={yPos}
                  x2={trajectoryChart.width - trajectoryChart.padRight}
                  y2={yPos}
                  stroke="#1E293B"
                  strokeDasharray="3 3"
                />
                <text
                  x={trajectoryChart.padLeft - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {ratio === 0 ? '0' : formatCompactIdr(tickVal).replace('Rp ', '')}
                </text>
              </g>
            );
          })}

          {trajectoryChart.areaPath && (
            <path d={trajectoryChart.areaPath} fill="url(#trajOrangeFill)" />
          )}

          {trajectoryChart.linePath && (
            <path
              d={trajectoryChart.linePath}
              fill="none"
              stroke="#FF6B00"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {trajectoryChart.peakCoord && trajectoryChart.peakCoord.totalValue > 0 && (
            <g
              transform={`translate(${Math.min(
                trajectoryChart.width - 96,
                Math.max(trajectoryChart.padLeft + 4, trajectoryChart.peakCoord.x - 45)
              )}, ${Math.max(2, trajectoryChart.peakCoord.y - 22)})`}
            >
              <rect width="90" height="16" rx="4" fill="#10B981" />
              <text
                x="45"
                y="11"
                textAnchor="middle"
                fill="#052E16"
                fontSize="8.5"
                fontWeight="800"
                fontFamily="JetBrains Mono, monospace"
              >
                PEAK {formatCompactIdr(trajectoryChart.peakCoord.totalValue).replace('Rp ', '')}
              </text>
            </g>
          )}

          {trajectoryChart.coords.map((pt, idx) => (
            <g
              key={pt.month}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredTrajIdx(idx)}
              onMouseLeave={() => setHoveredTrajIdx(null)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredTrajIdx === idx ? 5 : 3.5}
                fill="#FFFFFF"
                stroke="#FF6B00"
                strokeWidth="2.2"
              />
              <text
                x={pt.x}
                y={trajectoryChart.height - 5}
                textAnchor="middle"
                fill={hoveredTrajIdx === idx ? '#FFFFFF' : '#94A3B8'}
                fontSize="8.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {pt.shortMonth}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
});

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
              <div className="flex-1 flex items-end gap-2.5 sm:gap-4 h-56 pt-8 pb-1 overflow-x-auto">
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
                      className={`flex-1 min-w-[78px] max-w-[136px] flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none rounded-lg px-1 py-1 transition-colors ${
                        isSelected ? 'bg-[#172236]/80' : 'hover:bg-[#141D2E]/60'
                      }`}
                    >
                      <div className="mb-1.5 flex flex-col items-center">
                        {row.growthPercent !== null ? (
                          <span
                            className={`text-[10px] font-mono font-extrabold tabular-nums leading-none px-1.5 py-0.5 rounded ${
                              isPositive
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {row.growthPercent.toFixed(1).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 leading-none">
                            Awal
                          </span>
                        )}
                        <span
                          className={`text-[10.5px] font-mono font-extrabold tabular-nums mt-1 whitespace-nowrap ${
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

                      <div className="w-full relative flex items-end justify-center h-full px-2">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[52px] rounded-t-md transition-all duration-200 ${
                            isSelected
                              ? 'bg-[#00D2FF] ring-2 ring-[#00D2FF]/40'
                              : isPeak
                              ? 'bg-emerald-500 group-hover:bg-emerald-400'
                              : 'bg-[#FF6B00] group-hover:bg-[#FF8533]'
                          }`}
                        />
                      </div>

                      <div className="mt-2 text-center w-full">
                        <span
                          className={`block text-[10.5px] font-bold truncate ${
                            isSelected
                              ? 'text-[#00D2FF]'
                              : isPeak
                              ? 'text-emerald-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {row.monthPeriod}
                        </span>
                        <span className="block text-[9.5px] font-mono text-slate-400 tabular-nums">
                          {row.promoDaysCount} hr · {row.storeCount} toko
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
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

          {/* Monthly Table */}
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-[#0E1523] z-10">
                <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                  <th className="py-2.5 px-4 whitespace-nowrap">Bulan</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Hari Promo</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Toko</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Rata-rata / Hari</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Actual Bulanan</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">
                    Growth Bulanan (MoM)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                {promoMonthlyRecap.map((r, idx) => {
                  const isSelected = selectedMonth === r.monthPeriod;
                  const isPeak = idx === stats.peakIdx && r.totalActual > 0;
                  const isPos = r.growthPercent !== null && r.growthPercent >= 0;
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
                      <td className="py-2.5 px-4 font-sans font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{r.monthPeriod}</span>
                          {isPeak && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              PEAK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-300 whitespace-nowrap">
                        {r.promoDaysCount} hr{' '}
                        <span className="text-slate-500">/ {r.calendarDaysInMonth} hr</span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-cyan-300 font-bold whitespace-nowrap">
                        {r.storeCount}
                      </td>
                      <td className="py-2.5 px-3 text-right text-cyan-400 whitespace-nowrap">
                        {formatRupiah(r.avgPerPromoDay)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#FF6B00] whitespace-nowrap">
                        {formatRupiah(r.totalActual)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {r.growthPercent !== null ? (
                          <div className="inline-flex flex-col items-end">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                isPos
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
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
                            {r.growthDelta !== null && (
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                {r.growthDelta >= 0 ? '+' : '-'}
                                {formatCompactIdr(Math.abs(r.growthDelta))}
                                {r.previousMonthPeriod ? ` vs ${r.previousMonthPeriod}` : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-sans">
                            Bulan Awal (-)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#0E1523] border-t border-[#243147] font-mono tabular-nums text-[11px]">
                <tr>
                  <td className="py-2.5 px-4 font-sans font-extrabold uppercase text-slate-300 whitespace-nowrap">
                    Total / Rata-rata ({promoMonthlyRecap.length} Bln)
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-200 whitespace-nowrap">
                    {stats.totalPromoDays} hr
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400 whitespace-nowrap">
                    {stats.totalEntries} lap
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-cyan-300 whitespace-nowrap">
                    {formatRupiah(stats.avgOverallPerDay)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-black text-[#FF6B00] whitespace-nowrap">
                    {formatRupiah(stats.totalActual)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold whitespace-nowrap">
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

// Isolated Memoized Store Gap Table (deferred search + smart row limit so typing/clicking stays instant)
const TargetsGapPanel: React.FC<{
  storeGapDetails: StoreGapDetailItem[];
  totalStoreGapDeficit: number;
  gapPreviousPeriodName: string;
  gapCurrentPeriodName: string;
}> = React.memo(
  ({ storeGapDetails, totalStoreGapDeficit, gapPreviousPeriodName, gapCurrentPeriodName }) => {
    const [storeGapSearch, setStoreGapSearch] = useState<string>('');
    const deferredSearch = useDeferredValue(storeGapSearch);
    const [storeGapCategory, setStoreGapCategory] = useState<
      'ALL' | 'lost_outlet' | 'volume_drop' | 'return_impact'
    >('ALL');
    const [showAllRows, setShowAllRows] = useState<boolean>(false);

    const storeGapStats = useMemo(() => {
      let lostCount = 0;
      let volCount = 0;
      let retCount = 0;
      let lostSum = 0;
      let volSum = 0;
      let totalSellInDeficit = 0;
      let totalSellOutDeficit = 0;

      for (let i = 0; i < storeGapDetails.length; i++) {
        const st = storeGapDetails[i];
        if (st.gapCategory === 'lost_outlet') {
          lostCount += 1;
          lostSum += st.deficitValue || 0;
        } else if (st.gapCategory === 'return_impact') {
          retCount += 1;
        } else {
          volCount += 1;
          volSum += st.deficitValue || 0;
        }
        totalSellInDeficit += Math.max(0, st.sellInPrevious - st.sellInCurrent);
        totalSellOutDeficit += Math.max(0, st.sellOutPrevious - st.sellOutCurrent);
      }

      const q = deferredSearch.trim().toLowerCase();
      const filtered = storeGapDetails.filter((st) => {
        if (storeGapCategory !== 'ALL' && st.gapCategory !== storeGapCategory) return false;
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

      return {
        allCount: storeGapDetails.length,
        lostCount,
        volCount,
        retCount,
        lostSum,
        volSum,
        totalSellInDeficit,
        totalSellOutDeficit,
        filtered,
      };
    }, [storeGapDetails, deferredSearch, storeGapCategory]);

    const visibleRows = showAllRows
      ? storeGapStats.filtered
      : storeGapStats.filtered.slice(0, 80);

    return (
      <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-2.5 border-b border-[#1E293B]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#FF6B00]" />
                <span>Rincian Sumber Data Gap Penjualan per Toko</span>
              </h3>
              <span className="text-[10px] font-bold text-[#00D2FF] font-mono">
                {gapPreviousPeriodName} vs {gapCurrentPeriodName}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar asal toko penyumbang defisit omzet Sell In &amp; Sell Out (mengikuti filter Periode, Area, Sales &amp; Brand)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={storeGapSearch}
                onChange={(e) => setStoreGapSearch(e.target.value)}
                placeholder="Cari toko, sales, SPV..."
                className="w-full pl-8 pr-7 py-1.5 text-[11px] rounded-lg bg-[#0D121D] border border-[#243147] text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6B00]"
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

            <div className="flex flex-wrap items-center gap-1 p-0.5 bg-[#0D121D] rounded-lg border border-[#243147] text-[10.5px] font-bold">
              <button
                type="button"
                onClick={() => setStoreGapCategory('ALL')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  storeGapCategory === 'ALL'
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
                  storeGapCategory === 'lost_outlet'
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
                  storeGapCategory === 'volume_drop'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Turun Order ({storeGapStats.volCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreGapCategory('return_impact')}
                className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                  storeGapCategory === 'return_impact'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-purple-300'
                }`}
              >
                Retur ({storeGapStats.retCount})
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono tabular-nums">
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-rose-300 text-[11px]">
              Toko Pasif ({storeGapStats.lostCount})
            </span>
            <span className="font-black text-rose-400 whitespace-nowrap">
              -{formatRupiah(storeGapStats.lostSum)}
            </span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-amber-300 text-[11px]">
              Turun Order ({storeGapStats.volCount})
            </span>
            <span className="font-black text-amber-400 whitespace-nowrap">
              -{formatRupiah(storeGapStats.volSum)}
            </span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#0D121D] border border-[#243147] flex items-center justify-between gap-2">
            <span className="font-sans font-bold text-slate-300 text-[11px]">
              Total Defisit Toko ({storeGapStats.allCount})
            </span>
            <span className="font-black text-[#FF6B00] whitespace-nowrap">
              -{formatRupiah(totalStoreGapDeficit)}
            </span>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-445px)] min-h-[220px] border border-[#1E293B] rounded-lg">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0D121D]">
              <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                <th className="py-2 px-2.5 text-center w-9">No</th>
                <th className="py-2 px-2.5 min-w-[150px]">Nama Toko</th>
                <th className="py-2 px-2.5 min-w-[110px]">Sales &amp; SPV</th>
                <th className="py-2 px-2.5 min-w-[200px]">Kategori Penyebab</th>
                <th className="py-2 px-2.5 text-right text-[#FF6B00] whitespace-nowrap">
                  Sell In (Lalu → Skg)
                </th>
                <th className="py-2 px-2.5 text-right text-[#00D2FF] whitespace-nowrap">
                  Sell Out (Lalu → Skg)
                </th>
                <th className="py-2 px-2.5 text-right text-[#FF6B00] whitespace-nowrap">
                  Gap Sell In
                </th>
                <th className="py-2 px-2.5 text-right text-[#00D2FF] whitespace-nowrap">
                  Gap Sell Out
                </th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">Porsi In</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">Porsi Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center font-sans text-slate-500">
                    Tidak ada toko penyumbang gap yang cocok dengan filter saat ini.
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
                    <tr key={`${st.storeName}-${idx}`} className="hover:bg-[#172033] align-top">
                      <td className="py-2 px-2.5 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-sans">
                        <div className="font-bold text-white leading-snug">{st.storeName}</div>
                        <div className="text-[10px] text-slate-400">{st.region}</div>
                      </td>
                      <td className="py-2 px-2.5 font-sans whitespace-nowrap">
                        <div className="font-semibold text-slate-200">{st.salesName}</div>
                        <div className="text-[10px] text-slate-400">SPV: {st.spvName}</div>
                      </td>
                      <td className="py-2 px-2.5 font-sans">
                        <span
                          className={`text-[10px] font-bold block ${
                            st.gapCategory === 'lost_outlet'
                              ? 'text-rose-400'
                              : st.gapCategory === 'return_impact'
                              ? 'text-purple-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {st.gapCategory === 'lost_outlet'
                            ? 'Toko Pasif (0 Order)'
                            : st.gapCategory === 'return_impact'
                            ? 'Dampak Retur'
                            : 'Turun Order'}
                        </span>
                        <div className="text-[10.5px] text-slate-300 mt-0.5 whitespace-normal break-words leading-snug">
                          {st.primaryReason}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <div className="text-[10px] text-slate-400">
                          {formatCompactIdr(st.sellInPrevious)}
                        </div>
                        <div className="font-bold text-white">
                          → {formatCompactIdr(st.sellInCurrent)}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <div className="text-[10px] text-slate-400">
                          {formatCompactIdr(st.sellOutPrevious)}
                        </div>
                        <div className="font-bold text-[#00D2FF]">
                          → {formatCompactIdr(st.sellOutCurrent)}
                        </div>
                      </td>
                      <td
                        className={`py-2 px-2.5 text-right font-bold whitespace-nowrap ${
                          sellInGap < 0
                            ? 'text-rose-400'
                            : sellInGap > 0
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {sellInGap < 0
                          ? `-${formatRupiah(Math.abs(sellInGap))}`
                          : sellInGap > 0
                          ? `+${formatRupiah(sellInGap)}`
                          : 'Rp 0'}
                      </td>
                      <td
                        className={`py-2 px-2.5 text-right font-bold whitespace-nowrap ${
                          sellOutGap < 0
                            ? 'text-rose-400'
                            : sellOutGap > 0
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {sellOutGap < 0
                          ? `-${formatRupiah(Math.abs(sellOutGap))}`
                          : sellOutGap > 0
                          ? `+${formatRupiah(sellOutGap)}`
                          : 'Rp 0'}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-[#FF6B00] whitespace-nowrap">
                        {porsiIn.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-[#00D2FF] whitespace-nowrap">
                        {porsiOut.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {storeGapStats.filtered.length > 80 && (
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
                ? 'Ringkas ke 80 Baris'
                : `Tampilkan Semua (${storeGapStats.filtered.length} Toko)`}
            </button>
          </div>
        )}
      </div>
    );
  }
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
}) => {
  // 2-tier lens state for instant 0ms sidebar button feedback
  const [uiLens, setUiLens] = useState<SidebarLens>('overview');
  const [activeLens, setActiveLens] = useState<SidebarLens>('overview');
  const [isPendingLens, startLensTransition] = useTransition();

  // Periode Tanggal Filter (e.g. Tgl 1-10 OKTOBER vs NOVEMBER)
  const [dayPreset, setDayPreset] = useState<'ALL' | '1-10' | '1-15' | '1-20' | '11-20' | '21-31' | 'CUSTOM'>('ALL');
  const [startDayInput, setStartDayInput] = useState<string>('');
  const [endDayInput, setEndDayInput] = useState<string>('');

  const handleSelectDayPreset = (preset: 'ALL' | '1-10' | '1-15' | '1-20' | '11-20' | '21-31' | 'CUSTOM') => {
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
  };

  const rawDayRange = useMemo<ExecutiveDayRange | undefined>(() => {
    if (!startDayInput && !endDayInput) return undefined;
    return {
      startDay: startDayInput ? Number(startDayInput) : undefined,
      endDay: endDayInput ? Number(endDayInput) : undefined,
    };
  }, [startDayInput, endDayInput]);

  const deferredDayRange = useDeferredValue(rawDayRange);

  const handleSelectLens = (lens: SidebarLens) => {
    setUiLens(lens);
    startLensTransition(() => {
      setActiveLens(lens);
    });
  };

  // Fast Core & Overview Snapshot (NO 12x P&L, NO 2nd gap pass, NO unused dimension scans)
  const snap = useMemo(() => {
    return buildExecutiveCoreSnapshot(allRecords, filteredRecords, filters, deferredDayRange);
  }, [allRecords, filteredRecords, filters, deferredDayRange]);

  // Lazy Sub-Lens Data (ONLY computed when that specific sub-menu is active!)
  const marketShareData = useMemo(() => {
    if (activeLens !== 'market_share') return null;
    return buildMarketShareLensData();
  }, [activeLens]);

  const productMixData = useMemo(() => {
    if (activeLens !== 'product_mix') return null;
    return buildProductMixLensData(filteredRecords, deferredDayRange);
  }, [activeLens, filteredRecords, deferredDayRange]);

  const channelGrowthRows = useMemo(() => {
    if (activeLens !== 'channel_growth') return null;
    return buildChannelGrowthLensData(allRecords, snap.selectedYear, filters, deferredDayRange);
  }, [activeLens, allRecords, snap.selectedYear, filters, deferredDayRange]);

  const promoBaData = useMemo(() => {
    if (activeLens !== 'promo_ba') return null;
    return buildPromoBaLensData();
  }, [activeLens]);

  const monthlyProfitHrSummary = useMemo(() => {
    if (activeLens !== 'finance_bills') return null;
    return buildMonthlyProfitHrSummary(allRecords, filters, snap.selectedYear, deferredDayRange);
  }, [activeLens, allRecords, filters, snap.selectedYear, deferredDayRange]);

  const targetsAlertsData = useMemo(() => {
    if (activeLens !== 'targets_alerts') return null;
    return buildTargetsAlertsLensData(
      allRecords,
      filteredRecords,
      filters,
      snap.gapDiagnosis,
      deferredDayRange
    );
  }, [activeLens, allRecords, filteredRecords, filters, snap.gapDiagnosis, deferredDayRange]);

  const [selectedQuarter, setSelectedQuarter] = useState<QuarterPeriodKey>('Q4');
  const [hallOfFameTab, setHallOfFameTab] = useState<'sales' | 'ba' | 'trainer'>('sales');
  const [quartalSearch, setQuartalSearch] = useState<string>('');

  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      const b = filters.BULAN.trim().toUpperCase();
      if (['JANUARI', 'FEBRUARI', 'MARET'].includes(b)) setSelectedQuarter('Q1');
      else if (['APRIL', 'MEI', 'JUNI'].includes(b)) setSelectedQuarter('Q2');
      else if (['JULI', 'AGUSTUS', 'SEPTEMBER'].includes(b)) setSelectedQuarter('Q3');
      else if (['OKTOBER', 'NOVEMBER', 'DESEMBER'].includes(b)) setSelectedQuarter('Q4');
    }
  }, [filters.BULAN]);

  const achieveQuartalData = useMemo(() => {
    if (activeLens !== 'achieve_quartal') return null;

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
    const rawQuarter = calculateQuarterlySummary(
      baseQuarterRecords,
      selectedQuarter,
      snap.selectedYear,
      filters.REGION,
      filters.SPV,
      activeKet
    );

    const effSearch = (quartalSearch || filters.searchQuery || '').trim().toLowerCase();

    const filteredSales: SalesQuarterlySummaryItem[] = rawQuarter.salesList
      .filter((s) => {
        if (filters.SALES && filters.SALES !== 'ALL') {
          const fSales = filters.SALES.trim().toUpperCase();
          const canonical = fSales === 'ALBERT' ? 'ALBERT FERNANDO' : fSales;
          if (s.salesName.toUpperCase() !== canonical) return false;
        }
        if (filters.TRAINER && filters.TRAINER !== 'ALL') {
          const cfg = SALES_MASTER_6_CONFIG[s.salesName];
          if (cfg && !cfg.trainerCovered.toUpperCase().includes(filters.TRAINER.toUpperCase())) {
            return false;
          }
        }
        if (filters.SPV && filters.SPV !== 'ALL' && s.spvName.toUpperCase() !== filters.SPV.toUpperCase()) {
          return false;
        }
        if (
          filters.REGION &&
          filters.REGION !== 'ALL' &&
          (s.region || '').toUpperCase() !== filters.REGION.toUpperCase() &&
          (s.coverArea || '').toUpperCase() !== filters.REGION.toUpperCase()
        ) {
          return false;
        }
        if (!effSearch) return true;
        return (
          s.salesName.toLowerCase().includes(effSearch) ||
          s.coverArea.toLowerCase().includes(effSearch) ||
          s.spvName.toLowerCase().includes(effSearch) ||
          (s.region && s.region.toLowerCase().includes(effSearch))
        );
      })
      .sort((a, b) => {
        const diff = b.quarterAchievementPercent - a.quarterAchievementPercent;
        if (Math.abs(diff) > 0.0001) return diff;
        return b.quarterActual - a.quarterActual;
      });

    const filteredBa: BaQuarterlySummaryItem[] = rawQuarter.baList
      .filter((b) => {
        if (filters.SPV && filters.SPV !== 'ALL' && b.spvName && b.spvName.toUpperCase() !== filters.SPV.toUpperCase()) {
          return false;
        }
        if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL' && b.storeName.toUpperCase() !== filters.NAMA_STORE.toUpperCase()) {
          return false;
        }
        if (
          filters.REGION &&
          filters.REGION !== 'ALL' &&
          (b.region || '').toUpperCase() !== filters.REGION.toUpperCase() &&
          (b.coverArea || '').toUpperCase() !== filters.REGION.toUpperCase()
        ) {
          return false;
        }
        if (!effSearch) return true;
        return (
          b.baName.toLowerCase().includes(effSearch) ||
          b.storeName.toLowerCase().includes(effSearch) ||
          b.coverArea.toLowerCase().includes(effSearch) ||
          b.baNumber.toLowerCase().includes(effSearch) ||
          (b.spvName && b.spvName.toLowerCase().includes(effSearch))
        );
      })
      .sort((a, b) => {
        const diff = b.quarterAchievementPercent - a.quarterAchievementPercent;
        if (Math.abs(diff) > 0.0001) return diff;
        return b.quarterActual - a.quarterActual;
      });

    const filteredTrainer: TrainerQuarterlySummaryItem[] = rawQuarter.trainerList
      .filter((t) => {
        if (filters.TRAINER && filters.TRAINER !== 'ALL' && t.trainerName.toUpperCase() !== filters.TRAINER.toUpperCase()) {
          return false;
        }
        if (
          filters.REGION &&
          filters.REGION !== 'ALL' &&
          (t.areaCovered || '').toUpperCase() !== filters.REGION.toUpperCase() &&
          (t.region || '').toUpperCase() !== filters.REGION.toUpperCase()
        ) {
          return false;
        }
        if (!effSearch) return true;
        return (
          t.trainerName.toLowerCase().includes(effSearch) ||
          t.areaCovered.toLowerCase().includes(effSearch)
        );
      })
      .sort((a, b) => {
        const diff = b.quarterAchievementPercent - a.quarterAchievementPercent;
        if (Math.abs(diff) > 0.0001) return diff;
        return b.quarterActual - a.quarterActual;
      });

    const isKetSellIn = activeKet === 'SELL IN';
    const isKetSellOut = activeKet === 'SELL OUT';
    const activeKetDisplayLabel = isKetSellIn
      ? 'SELL IN (Pencapaian Sell In)'
      : isKetSellOut
      ? 'SELL OUT (Pencapaian Sell Out)'
      : activeKet === 'ALL'
      ? 'SEMUA KET (Sell In & Sell Out)'
      : activeKet;

    const topSales = filteredSales[0]
      ? {
          name: filteredSales[0].salesName,
          actual: filteredSales[0].quarterActual,
          target: filteredSales[0].quarterTarget,
          percent: filteredSales[0].quarterAchievementPercent,
        }
      : null;

    const topBa = filteredBa[0]
      ? {
          name: filteredBa[0].baName,
          store: filteredBa[0].storeName,
          actual: filteredBa[0].quarterActual,
          target: filteredBa[0].quarterTarget,
          percent: filteredBa[0].quarterAchievementPercent,
        }
      : null;

    const topTrainer = filteredTrainer[0]
      ? {
          name: filteredTrainer[0].trainerName,
          actual: filteredTrainer[0].quarterActual,
          score: filteredTrainer[0].avgKpiScore,
          percent: filteredTrainer[0].quarterAchievementPercent,
        }
      : null;

    return {
      overall: rawQuarter.overall,
      filteredSales,
      filteredBa,
      filteredTrainer,
      topSales,
      topBa,
      topTrainer,
      isKetSellIn,
      isKetSellOut,
      activeKetDisplayLabel,
    };
  }, [activeLens, allRecords, filters, selectedQuarter, snap.selectedYear, deferredDayRange, quartalSearch]);

  const sidebarItems: Array<{
    id: SidebarLens;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'overview', label: 'Overview Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'regional', label: 'Area & Tim Sales', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'market_share', label: 'Market Share MG', icon: <PieChartIcon className="w-3.5 h-3.5" /> },
    { id: 'product_mix', label: 'Brand, Kategori & SKU', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'channel_growth', label: 'Growth & BA vs Non-BA', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'promo_ba', label: 'Tim BA, Promo & Visit', icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'finance_bills', label: 'Profit, Cost & Tagihan', icon: <Wallet className="w-3.5 h-3.5" /> },
    { id: 'targets_alerts', label: 'Target & Analisa Gap', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'achieve_quartal', label: 'Achieve Quartal', icon: <Crown className="w-3.5 h-3.5" /> },
  ];

  const maxRegionalBar = useMemo(() => {
    return (
      Math.max(1, ...snap.regionalBars.map((b) => Math.max(b.value, b.target))) * 1.1
    );
  }, [snap.regionalBars]);

  const profitPctVsSellIn =
    Math.round((snap.profitSummary.remainingProfitPercentSellIn || 0) * 10) / 10;
  const avgPricePerUnit =
    snap.summary.totalQty > 0
      ? Math.round(snap.summary.totalRevenue / snap.summary.totalQty)
      : 0;
  const topSku = snap.topSku;
  const topBrand = snap.topBrands[0];
  const fastestGrowthArea =
    snap.brandComparisonRows.length > 0
      ? [...snap.brandComparisonRows].sort((a, b) => b.growth - a.growth)[0]
      : null;

  const targetProgressClamped = Math.max(0, Math.min(100, snap.achievementPercent));
  const isTargetOnTrack = snap.achievementPercent >= 75;

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
        <aside className="w-full lg:w-[200px] xl:w-[214px] shrink-0 bg-[#0D121D] border-b lg:border-b-0 lg:border-r border-[#1C2536] flex flex-col justify-between p-3">
          <div>
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-[#1C2536]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF7A00] to-[#EA580C] flex items-center justify-center font-black text-white text-xs shadow-md shadow-orange-600/30 shrink-0">
                SP
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold tracking-wide text-white block leading-tight">
                  SALESPRO
                </span>
                <span className="text-[9.5px] font-extrabold tracking-wider text-[#FF6B00] block uppercase">
                  MARKET INTELLIGENCE
                </span>
              </div>
            </div>

            <nav className="mt-2.5 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1.5 lg:pb-0 no-scrollbar">
              {sidebarItems.map((item) => {
                const isActive = uiLens === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectLens(item.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-[#FF6B00] to-[#F97316] text-white font-bold shadow-md shadow-orange-600/25'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#151D2E]'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden lg:block mt-3 bg-[#111826] border border-[#1F2A3D] rounded-xl p-3 space-y-2">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">
              TARGET PERIODE ({snap.selectedYear})
            </span>
            <div>
              <span className="text-[10px] text-slate-400 block">Target Omset</span>
              <span
                className="text-[12.5px] font-black font-mono tabular-nums text-white block whitespace-nowrap"
                title={formatRupiah(snap.targetTotal)}
              >
                {formatRupiah(snap.targetTotal)}
              </span>
            </div>

            <div className="space-y-1">
              <div className="w-full h-1.5 bg-[#1D283A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B00] to-[#F59E0B] rounded-full transition-all duration-300"
                  style={{ width: `${targetProgressClamped}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums">
                <span className="text-slate-400">Realisasi</span>
                <span className="font-bold text-emerald-400">{snap.achievementPercent}%</span>
              </div>
            </div>

            <div className="pt-1 border-t border-[#1C2536]">
              <span
                className="text-[12px] font-extrabold font-mono tabular-nums text-white block whitespace-nowrap"
                title={formatRupiah(snap.summary.totalRevenue)}
              >
                {formatRupiah(snap.summary.totalRevenue)}
              </span>
              <span className="text-[9.5px] text-slate-400 block mt-0.5">
                {snap.selectedMonthLabel}
              </span>
            </div>

            <div
              className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold flex items-center gap-1.5 ${
                isTargetOnTrack
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {isTargetOnTrack ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isTargetOnTrack ? 'On Track' : 'Perlu Akselerasi'}
              </span>
            </div>
          </div>
        </aside>

        {/* MAIN RIGHT CONTENT PANEL */}
        <div className="flex-1 min-w-0 flex flex-col justify-between p-3 xl:p-3.5 gap-2.5">
          {/* TOP DASHBOARD HEADER */}
          <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-2 pb-2 border-b border-[#1C2536]">
            <div className="min-w-0 flex items-center gap-3 flex-wrap">
              {onToggleFullScreen && (
                <button
                  type="button"
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

            {/* Interactive Controls (Periode + Area + Sales + Brand + Tipe + PDF) */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
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

              <button
                type="button"
                onClick={onExportPdf}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-orange-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
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

          {/* ACTIVE LENS CONTENT */}
          {activeLens === 'overview' && (
            <div className="flex-1 flex flex-col justify-between gap-2.5">
              {/* ROW 1: 7 COMPACT KPI STRIP CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    TOTAL OMSET
                  </span>
                  <div className="flex items-center gap-2">
                    <MiniProgressRing percent={snap.achievementPercent} color="#FF6B00" />
                    <div className="min-w-0">
                      <span
                        className="text-[13px] font-black font-mono tabular-nums text-white block leading-tight whitespace-nowrap"
                        title={formatRupiah(snap.summary.totalRevenue)}
                      >
                        {formatCompactIdr(snap.summary.totalRevenue)}
                      </span>
                      <span
                        className={`text-[10px] font-mono tabular-nums font-bold block leading-tight mt-0.5 whitespace-nowrap ${
                          snap.overallGrowthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {snap.overallGrowthPct >= 0 ? '↑' : '↓'} {formatPercent(snap.overallGrowthPct)} MoM
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] text-slate-400 font-mono tabular-nums leading-tight whitespace-nowrap"
                    title={`Target: ${formatRupiah(snap.targetTotal)}`}
                  >
                    Tgt: {formatCompactIdr(snap.targetTotal)}
                  </span>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    MARKET SHARE MG
                  </span>
                  <div className="flex items-center gap-2">
                    <MiniProgressRing
                      percent={snap.mgAvgSharePct > 0 ? snap.mgAvgSharePct : (topBrand?.sharePct || 0)}
                      color="#00D2FF"
                      label={`${Math.round(snap.mgAvgSharePct > 0 ? snap.mgAvgSharePct : (topBrand?.sharePct || 0))}%`}
                    />
                    <div className="min-w-0">
                      <span className="text-[12.5px] font-black font-mono tabular-nums text-white block leading-tight whitespace-nowrap">
                        {snap.mgAvgSharePct > 0
                          ? `${snap.mgAvgSharePct}% Share`
                          : topBrand
                          ? `${topBrand.sharePct}% Top`
                          : '0% Share'}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums font-bold text-cyan-400 block leading-tight mt-0.5 whitespace-nowrap">
                        {snap.mgShareDeltaPp !== null
                          ? `${snap.mgShareDeltaPp >= 0 ? '↑ +' : '↓ '}${snap.mgShareDeltaPp} pp`
                          : `${snap.mgActiveStoreCount} Toko MG`}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] text-slate-400 leading-tight truncate"
                    title={snap.mgTopStore?.storeName || topBrand?.name || 'Input Market Share'}
                  >
                    {snap.mgTopStore
                      ? `Top: ${snap.mgTopStore.storeName}`
                      : topBrand
                      ? `#1 ${topBrand.name}`
                      : 'Input Market Share'}
                  </span>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    UNIT TERJUAL (QTY)
                  </span>
                  <div className="flex items-center gap-2">
                    <MiniProgressRing
                      percent={snap.sellThroughPct > 0 ? Math.min(100, snap.sellThroughPct) : 85}
                      color="#3B82F6"
                    />
                    <div className="min-w-0">
                      <span className="text-[13px] font-black font-mono tabular-nums text-white block leading-tight whitespace-nowrap">
                        {formatNumber(snap.summary.totalQty)} pcs
                      </span>
                      <span
                        className={`text-[10px] font-mono tabular-nums font-bold block leading-tight mt-0.5 whitespace-nowrap ${
                          snap.overallQtyGrowthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {snap.overallQtyGrowthPct >= 0 ? '↑' : '↓'} {formatPercent(snap.overallQtyGrowthPct)} MoM
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono tabular-nums leading-tight whitespace-nowrap">
                    {formatNumber(snap.summary.totalTransactions)} Transaksi
                  </span>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1.5">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    PROFIT &amp; MARGIN
                  </span>
                  <div className="flex items-center gap-2">
                    <MiniProgressRing
                      percent={Math.max(0, profitPctVsSellIn)}
                      color="#10B981"
                      label={`${Math.round(profitPctVsSellIn)}%`}
                    />
                    <div className="min-w-0">
                      <span className="text-[13px] font-black font-mono tabular-nums text-white block leading-tight whitespace-nowrap">
                        {profitPctVsSellIn}% Net
                      </span>
                      <span
                        className="text-[10px] font-mono tabular-nums font-bold text-emerald-400 block leading-tight mt-0.5 whitespace-nowrap"
                        title={formatRupiah(snap.profitSummary.remainingProfitValue)}
                      >
                        {formatCompactIdr(snap.profitSummary.remainingProfitValue)}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono tabular-nums leading-tight whitespace-nowrap">
                    Margin 55% · Ops 33%
                  </span>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    AVG HARGA / UNIT
                  </span>
                  <span
                    className="text-base font-black font-mono tabular-nums text-white leading-tight whitespace-nowrap"
                    title={formatRupiah(avgPricePerUnit)}
                  >
                    {formatCompactIdr(avgPricePerUnit)}
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono tabular-nums font-bold text-emerald-400 block leading-tight whitespace-nowrap">
                      Fokus: {snap.focusPct}% Omset
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block leading-tight whitespace-nowrap">
                      Produk New: {snap.newPct}%
                    </span>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    TOKO SELL IN (BA)
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-white leading-tight whitespace-nowrap">
                    {snap.storeBaSummary.totalStoresCount} Toko
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono tabular-nums font-bold text-cyan-400 block leading-tight whitespace-nowrap">
                      BA: {snap.storeBaSummary.tokoBaCount} ({snap.storeBaSummary.totalBaCount} BA)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block leading-tight whitespace-nowrap">
                      Non-BA: {snap.storeBaSummary.tokoNonBaCount} Toko
                    </span>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex flex-col justify-between gap-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    PROMO TOKO ONLINE
                  </span>
                  <span
                    className="text-base font-black font-mono tabular-nums text-white leading-tight whitespace-nowrap"
                    title={formatRupiah(snap.promoTotalActual)}
                  >
                    {formatCompactIdr(snap.promoTotalActual)}
                  </span>
                  <div className="space-y-0.5">
                    <span
                      className={`text-[10px] font-mono tabular-nums font-bold block leading-tight whitespace-nowrap ${
                        snap.promoLatestGrowthPct === null
                          ? 'text-slate-300'
                          : snap.promoLatestGrowthPct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {snap.promoLatestGrowthPct !== null
                        ? `${snap.promoLatestGrowthPct >= 0 ? '↑' : '↓'} ${formatPercent(snap.promoLatestGrowthPct)} MoM`
                        : `${snap.promoStoreCount} Toko Online`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block leading-tight whitespace-nowrap">
                      {snap.promoDaysCount} Hari Promo
                    </span>
                  </div>
                </div>
              </div>

              {/* ROW 2: 3 MIDDLE CHART PANELS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                {/* PANEL 2A: HORIZONTAL BAR CHART (TIM SALES PERFORMANCE) */}
                <div className="lg:col-span-4 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                      PERFORMA PENJUALAN TIM SALES
                    </h2>
                    <span className="text-[10px] font-bold text-[#FF6B00] font-mono tabular-nums whitespace-nowrap shrink-0">
                      Urut % Tertinggi · Target: 100%
                    </span>
                  </div>

                  <div className="space-y-2 my-auto">
                    {snap.regionalBars.length > 0 ? (
                      <>
                        {snap.regionalBars.map((bar) => {
                          const widthPct = Math.max(4, Math.min(94, (bar.value / maxRegionalBar) * 100));
                          const targetPct = Math.max(8, Math.min(96, (bar.target / maxRegionalBar) * 100));
                          return (
                            <div key={bar.name} className="flex items-center gap-2 text-xs">
                              <span
                                className="w-[82px] xl:w-[92px] shrink-0 text-[10.5px] font-semibold text-slate-200 truncate"
                                title={`${bar.name} (${bar.subLabel})`}
                              >
                                {bar.name}
                              </span>
                              <div className="relative flex-1 min-w-[90px] h-4 bg-[#1B2436] rounded-sm overflow-visible flex items-center">
                                <div
                                  className="h-full rounded-sm bg-gradient-to-r from-[#2563EB] to-[#00D2FF] flex items-center justify-center transition-all duration-300"
                                  style={{ width: `${widthPct}%` }}
                                >
                                  {widthPct >= 26 && (
                                    <span className="text-[9.5px] font-mono tabular-nums font-extrabold text-slate-950 px-1">
                                      {bar.achievementPct}%
                                    </span>
                                  )}
                                </div>
                                {widthPct < 26 && (
                                  <span className="text-[9.5px] font-mono tabular-nums font-bold text-cyan-300 pl-1.5">
                                    {bar.achievementPct}%
                                  </span>
                                )}
                                <div
                                  className="absolute top-[-2px] bottom-[-2px] border-l-2 border-dashed border-[#FF6B00] pointer-events-none"
                                  style={{ left: `${targetPct}%` }}
                                  title={`Target: ${formatRupiah(bar.target)}`}
                                />
                              </div>
                              <span
                                className="w-[74px] shrink-0 text-[10.5px] font-mono tabular-nums font-bold text-white text-right whitespace-nowrap"
                                title={formatRupiah(bar.value)}
                              >
                                {formatCompactIdr(bar.value)}
                              </span>
                            </div>
                          );
                        })}

                        <div className="flex items-center gap-2 pt-0.5 text-[9.5px] font-mono tabular-nums text-slate-500">
                          <div className="w-[82px] xl:w-[92px] shrink-0" />
                          <div className="flex-1 flex justify-between whitespace-nowrap">
                            <span>0</span>
                            <span>{formatCompactIdr(maxRegionalBar * 0.33)}</span>
                            <span>{formatCompactIdr(maxRegionalBar * 0.66)}</span>
                            <span>{formatCompactIdr(maxRegionalBar)}</span>
                          </div>
                          <div className="w-[74px] shrink-0" />
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Belum ada data penjualan tim sales pada filter ini.
                      </div>
                    )}
                  </div>
                </div>

                {/* PANEL 2B: ISOLATED MEMOIZED DONUT CHART */}
                <BrandShareDonutCard topBrands={snap.topBrands} selectedYear={snap.selectedYear} />

                {/* PANEL 2C: QUARTERLY STACKED BAR CHART */}
                <div className="lg:col-span-4 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                      BAURAN PRODUK KUARTAL (%)
                    </h2>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      Q1–Q4 {snap.selectedYear}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col justify-end pt-1">
                    <div className="relative h-[116px] flex items-end gap-3 pl-9 pr-2 border-b border-[#1E293B]">
                      {[0, 25, 50, 75, 100].map((pct) => (
                        <React.Fragment key={pct}>
                          <span
                            className="absolute left-0 w-8 text-right pr-1.5 text-[9px] font-mono tabular-nums text-slate-500 -translate-y-1/2 pointer-events-none"
                            style={{
                              bottom: `${pct}%`,
                              transform:
                                pct === 0
                                  ? 'translateY(4px)'
                                  : pct === 100
                                  ? 'translateY(6px)'
                                  : 'translateY(50%)',
                            }}
                          >
                            {pct}%
                          </span>
                          <div
                            className="absolute left-9 right-0 border-t border-dashed border-[#1E293B] pointer-events-none"
                            style={{ bottom: `${pct}%` }}
                          />
                        </React.Fragment>
                      ))}

                      {snap.quarterlyMix.map((q) => {
                        const hasData = q.totalValue > 0;
                        return (
                          <div
                            key={q.quarter}
                            className="flex-1 h-full flex flex-col justify-end items-center z-10"
                            title={`${q.label}: Fokus ${q.focusPct}% | New ${q.newPct}% | Reguler ${q.regularPct}%`}
                          >
                            {hasData ? (
                              <div className="w-10 sm:w-11 h-full flex flex-col justify-end rounded-t-sm overflow-hidden">
                                {q.focusPct > 0 && (
                                  <div
                                    className="w-full bg-[#FF6B00] flex items-center justify-center text-[9.5px] font-mono tabular-nums font-bold text-white"
                                    style={{ height: `${q.focusPct}%` }}
                                  >
                                    {q.focusPct >= 14 ? `${q.focusPct}%` : ''}
                                  </div>
                                )}
                                {q.newPct > 0 && (
                                  <div
                                    className="w-full bg-[#2563EB] flex items-center justify-center text-[9.5px] font-mono tabular-nums font-bold text-white"
                                    style={{ height: `${q.newPct}%` }}
                                  >
                                    {q.newPct >= 14 ? `${q.newPct}%` : ''}
                                  </div>
                                )}
                                {q.regularPct > 0 && (
                                  <div
                                    className="w-full bg-[#00D2FF] flex items-center justify-center text-[9.5px] font-mono tabular-nums font-bold text-slate-950"
                                    style={{ height: `${q.regularPct}%` }}
                                  >
                                    {q.regularPct >= 14 ? `${q.regularPct}%` : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-10 sm:w-11 h-1.5 bg-[#1B2436] rounded-t-sm" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3 pl-9 pr-2 pt-1.5 text-[9.5px] font-bold text-slate-400">
                      {snap.quarterlyMix.map((q) => (
                        <span key={q.quarter} className="flex-1 text-center whitespace-nowrap">
                          {q.label}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-center gap-3.5 pt-1.5 text-[10px] text-slate-300 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                        Produk Fokus
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                        Produk New
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#00D2FF]" />
                        Produk Reguler
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 3: PERBANDINGAN PERFORMA BRAND (MoM) + PERBANDINGAN PERFORMA SALES (MoM) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                {/* PANEL 3A: BRAND COMPARISON (MoM) */}
                <div className="lg:col-span-5 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                      PERBANDINGAN PERFORMA BRAND (MoM)
                    </h2>
                    <span className="text-[10px] font-bold text-[#FF6B00] whitespace-nowrap font-mono">
                      {snap.previousPeriodLabel || 'OKTOBER 2026'} vs {snap.currentPeriodLabel || 'NOVEMBER 2026'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1E293B]">
                          <th className="py-1.5 pr-2 whitespace-nowrap">BRAND</th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">BLN LALU</th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">BLN INI</th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">MoM</th>
                          <th className="py-1.5 pl-2 text-right whitespace-nowrap">SHARE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                        {snap.brandComparisonRows.slice(0, 5).map((row) => (
                          <tr key={row.name} className="hover:bg-[#172033] transition-colors">
                            <td className="py-1.5 pr-2 font-sans font-semibold text-slate-200 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: row.color }}
                                />
                                <span>{row.name}</span>
                              </span>
                            </td>
                            <td
                              className="py-1.5 px-2 text-right text-slate-400 whitespace-nowrap"
                              title={formatRupiah(row.previous)}
                            >
                              {formatCompactIdr(row.previous)}
                            </td>
                            <td
                              className="py-1.5 px-2 text-right font-bold text-white whitespace-nowrap"
                              title={formatRupiah(row.current)}
                            >
                              {formatCompactIdr(row.current)}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-bold whitespace-nowrap ${
                                row.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {row.growth >= 0 ? `+${row.growth}% ↑` : `${row.growth}% ↓`}
                            </td>
                            <td className="py-1.5 pl-2 text-right text-slate-300 whitespace-nowrap">
                              {row.sharePct}%
                            </td>
                          </tr>
                        ))}

                        {snap.brandComparisonRows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-5 text-center font-sans text-slate-500">
                              Data perbandingan belum tersedia pada filter ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#28354D] font-mono tabular-nums text-[11px]">
                          <td className="pt-1.5 pr-2 font-sans font-extrabold text-white whitespace-nowrap">
                            TOTAL PORTFOLIO
                          </td>
                          <td
                            className="pt-1.5 px-2 text-right font-bold text-slate-300 whitespace-nowrap"
                            title={formatRupiah(snap.brandComparisonTotals.previous)}
                          >
                            {formatCompactIdr(snap.brandComparisonTotals.previous)}
                          </td>
                          <td
                            className="pt-1.5 px-2 text-right font-black text-[#FF6B00] whitespace-nowrap"
                            title={formatRupiah(snap.brandComparisonTotals.current)}
                          >
                            {formatCompactIdr(snap.brandComparisonTotals.current)}
                          </td>
                          <td
                            className={`pt-1.5 px-2 text-right font-bold whitespace-nowrap ${
                              snap.brandComparisonTotals.growth >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {snap.brandComparisonTotals.growth >= 0 ? '+' : ''}
                            {snap.brandComparisonTotals.growth}%
                          </td>
                          <td className="pt-1.5 pl-2 text-right font-bold text-white whitespace-nowrap">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* PANEL 3B: PERBANDINGAN PERFORMA SALES (MoM) */}
                <div className="lg:col-span-7 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                        PERBANDINGAN PERFORMA SALES (MoM)
                      </h2>
                      {snap.activeDayRangeLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF6B00] text-[9.5px] font-mono font-bold whitespace-nowrap">
                          {snap.activeDayRangeLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-[#00D2FF] whitespace-nowrap font-mono">
                      {snap.previousPeriodLabel || 'OKTOBER 2026'} vs {snap.currentPeriodLabel || 'NOVEMBER 2026'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1E293B]">
                          <th className="py-1.5 pr-2 whitespace-nowrap">NAMA SALES</th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">
                            {snap.previousPeriodLabel || 'OKTOBER 2026'}
                          </th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">
                            {snap.currentPeriodLabel || 'NOVEMBER 2026'}
                          </th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">SELISIH (Δ)</th>
                          <th className="py-1.5 px-2 text-right whitespace-nowrap">MoM (%)</th>
                          <th className="py-1.5 pl-2 text-right whitespace-nowrap">SHARE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                        {snap.salesComparisonRows.map((row) => (
                          <tr key={row.name} className="hover:bg-[#172033] transition-colors">
                            <td className="py-1.5 pr-2 font-sans font-semibold text-slate-200 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: row.color }}
                                />
                                <span>{row.name}</span>
                                <span className="text-[9.5px] text-slate-400 font-normal hidden sm:inline">
                                  ({row.subLabel})
                                </span>
                              </div>
                            </td>
                            <td
                              className="py-1.5 px-2 text-right text-slate-400 whitespace-nowrap"
                              title={formatRupiah(row.previous)}
                            >
                              {formatCompactIdr(row.previous)}
                            </td>
                            <td
                              className="py-1.5 px-2 text-right font-bold text-white whitespace-nowrap"
                              title={formatRupiah(row.current)}
                            >
                              {formatCompactIdr(row.current)}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-bold whitespace-nowrap ${
                                row.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                              title={formatRupiah(row.delta)}
                            >
                              {row.delta >= 0 ? '+' : ''}
                              {formatCompactIdr(row.delta)}
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right font-bold whitespace-nowrap ${
                                row.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {row.growth >= 0 ? `+${row.growth}% ↑` : `${row.growth}% ↓`}
                            </td>
                            <td className="py-1.5 pl-2 text-right text-cyan-300 font-semibold whitespace-nowrap">
                              {row.sharePct}%
                            </td>
                          </tr>
                        ))}

                        {snap.salesComparisonRows.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-5 text-center font-sans text-slate-500">
                              Belum ada data perbandingan Sales pada filter periode ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#28354D] font-mono tabular-nums text-[11px]">
                          <td className="pt-1.5 pr-2 font-sans font-extrabold text-white whitespace-nowrap">
                            TOTAL TIM SALES ({snap.salesComparisonRows.length})
                          </td>
                          <td
                            className="pt-1.5 px-2 text-right font-bold text-slate-300 whitespace-nowrap"
                            title={formatRupiah(snap.salesComparisonTotals.previous)}
                          >
                            {formatCompactIdr(snap.salesComparisonTotals.previous)}
                          </td>
                          <td
                            className="pt-1.5 px-2 text-right font-black text-[#00D2FF] whitespace-nowrap"
                            title={formatRupiah(snap.salesComparisonTotals.current)}
                          >
                            {formatCompactIdr(snap.salesComparisonTotals.current)}
                          </td>
                          <td
                            className={`pt-1.5 px-2 text-right font-bold whitespace-nowrap ${
                              snap.salesComparisonTotals.delta >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                            title={formatRupiah(snap.salesComparisonTotals.delta)}
                          >
                            {snap.salesComparisonTotals.delta >= 0 ? '+' : ''}
                            {formatCompactIdr(snap.salesComparisonTotals.delta)}
                          </td>
                          <td
                            className={`pt-1.5 px-2 text-right font-bold whitespace-nowrap ${
                              snap.salesComparisonTotals.growth >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {snap.salesComparisonTotals.growth >= 0 ? '+' : ''}
                            {snap.salesComparisonTotals.growth}%
                          </td>
                          <td className="pt-1.5 pl-2 text-right font-bold text-white whitespace-nowrap">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* ROW 4: TRAJEKTORI OMSET BULANAN + KANAL TOKO & INTELIJEN ALERT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                <TrajectoryChartCard
                  monthlyTrajectory={snap.monthlyTrajectory}
                  avgMonthlyRevenue={snap.avgMonthlyRevenue}
                  selectedYear={snap.selectedYear}
                />

                <div className="lg:col-span-5 bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between gap-2.5">
                  <div>
                    <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100 mb-2">
                      KANAL TOKO &amp; INTELIJEN ALERT
                    </h2>

                    <div className="space-y-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-2 text-[10.5px]">
                          <span className="text-slate-200 font-semibold whitespace-nowrap">
                            Toko BA ({snap.storeBaSummary.tokoBaCount})
                          </span>
                          <span
                            className="font-mono tabular-nums font-bold text-[#FF6B00] whitespace-nowrap"
                            title={formatRupiah(snap.storeBaSummary.tokoBaTotalRevenue)}
                          >
                            {snap.storeBaSummary.tokoBaRevenuePercent}% · {formatCompactIdr(snap.storeBaSummary.tokoBaTotalRevenue)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1D283A] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FF6B00] rounded-full"
                            style={{ width: `${snap.storeBaSummary.tokoBaRevenuePercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-2 text-[10.5px]">
                          <span className="text-slate-200 font-semibold whitespace-nowrap">
                            Non-BA ({snap.storeBaSummary.tokoNonBaCount})
                          </span>
                          <span
                            className="font-mono tabular-nums font-bold text-[#3B82F6] whitespace-nowrap"
                            title={formatRupiah(snap.storeBaSummary.tokoNonBaTotalRevenue)}
                          >
                            {snap.storeBaSummary.tokoNonBaRevenuePercent}% · {formatCompactIdr(snap.storeBaSummary.tokoNonBaTotalRevenue)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1D283A] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3B82F6] rounded-full"
                            style={{ width: `${snap.storeBaSummary.tokoNonBaRevenuePercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-2 text-[10.5px]">
                          <span className="text-slate-200 font-semibold whitespace-nowrap">
                            Sell Out / In
                          </span>
                          <span
                            className="font-mono tabular-nums font-bold text-[#00D2FF] whitespace-nowrap"
                            title={formatRupiah(snap.totalSellOut)}
                          >
                            {snap.sellThroughPct}% · {formatCompactIdr(snap.totalSellOut)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1D283A] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00D2FF] rounded-full"
                            style={{ width: `${Math.min(100, snap.sellThroughPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">
                      INTELLIGENCE ALERTS
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5">
                      {snap.alerts.map((al) => {
                        const isWarn = al.severity === 'warning';
                        return (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() => onNavigateTab(al.targetTab as ActiveTab)}
                            className={`w-full text-left p-2 rounded-lg border transition-colors cursor-pointer flex items-start gap-1.5 ${
                              isWarn
                                ? 'bg-amber-500/10 border-amber-500/35 hover:bg-amber-500/15'
                                : 'bg-emerald-500/10 border-emerald-500/35 hover:bg-emerald-500/15'
                            }`}
                          >
                            {isWarn ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <span
                                className={`text-[10.5px] font-bold block leading-tight ${
                                  isWarn ? 'text-amber-300' : 'text-emerald-300'
                                }`}
                              >
                                {al.title}
                              </span>
                              <span className="text-[9.5px] text-slate-300 leading-tight block mt-0.5 line-clamp-2">
                                {al.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 5: BOTTOM 5 SUMMARY CARDS STRIP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/30 text-[#FF6B00] flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                      REALISASI OMSET AKTIF
                    </span>
                    <span className="text-[12.5px] xl:text-[13px] font-black font-mono tabular-nums text-white block mt-1 whitespace-nowrap">
                      {formatRupiah(snap.summary.totalRevenue)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block whitespace-nowrap">
                      Target: {formatRupiah(snap.targetTotal)}
                    </span>
                    <div className="w-full h-1.5 bg-[#1D283A] rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-[#FF6B00] rounded-full"
                        style={{ width: `${targetProgressClamped}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 text-[#3B82F6] flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                      PROYEKSI TAHUN {snap.selectedYear}
                    </span>
                    <span className="text-[12.5px] xl:text-[13px] font-black font-mono tabular-nums text-white block mt-1 whitespace-nowrap">
                      {formatRupiah(snap.projectedYearEnd)}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-emerald-400 block mt-0.5 whitespace-nowrap">
                      Peak: {snap.peakMonth ? `${snap.peakMonth.shortMonth} (${formatCompactIdr(snap.peakMonth.totalValue)})` : '-'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block whitespace-nowrap">
                      Avg: {formatCompactIdr(snap.avgMonthlyRevenue)} / bln
                    </span>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Star className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                      PRODUK / SKU TERLARIS
                    </span>
                    <span
                      className="text-[12.5px] font-extrabold text-white block mt-1 truncate"
                      title={topSku?.name || '-'}
                    >
                      {topSku?.name || '-'}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-[#FF6B00] block mt-0.5 whitespace-nowrap">
                      {topSku ? `${formatCompactIdr(topSku.totalValue)} (${formatNumber(topSku.totalQty)} pcs)` : '-'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block whitespace-nowrap">
                      Kontribusi: {topSku ? `${topSku.contributionPercent.toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                      PERTUMBUHAN TERCEPAT
                    </span>
                    <span className="text-[12.5px] font-extrabold text-white block mt-1 truncate">
                      {fastestGrowthArea?.name || topBrand?.name || '-'}
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums font-bold block mt-0.5 whitespace-nowrap ${
                        (fastestGrowthArea?.growth || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {fastestGrowthArea
                        ? `${fastestGrowthArea.growth >= 0 ? '↑ +' : '↓ '}${fastestGrowthArea.growth}% MoM`
                        : 'Periode Aktif'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums block whitespace-nowrap">
                      Visit: {snap.salesVisitsCount} Sales · {snap.trainerVisitsCount} Trainer
                    </span>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-2.5 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[#00D2FF] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                      PIUTANG &amp; DISIPLIN BA
                    </span>
                    <span className="text-[12.5px] font-black font-mono tabular-nums text-white block mt-1 whitespace-nowrap">
                      Lancar ({snap.healthyBillsPct}%)
                    </span>
                    <span className="text-[10px] font-mono tabular-nums font-bold text-emerald-400 block mt-0.5 whitespace-nowrap">
                      {snap.overdueBillsCount === 0
                        ? 'Tagihan Sehat'
                        : `${snap.overdueBillsCount} Nota > 30 Hari`}
                    </span>
                    <span
                      className="text-[10px] text-slate-400 font-mono tabular-nums block whitespace-nowrap"
                      title={`Denda BA: ${formatRupiah(snap.baTotalDenda)}`}
                    >
                      Denda BA: {formatCompactIdr(snap.baTotalDenda)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-LENS: AREA & TIM SALES */}
          {activeLens === 'regional' && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Performa Area, Supervisor &amp; Tim Sales
                  </h2>
                  <p className="text-xs text-slate-400">
                    Data pencapaian aktual vs target Sell In &amp; Sell Out dari SalesPro Analytics
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('sales')}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Buka Analisis Sales</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('spv')}
                    className="px-3 py-1.5 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
                  >
                    Buka Analisis SPV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00D2FF] mb-2">
                    Daftar Pencapaian Tim Sales ({snap.targetMatrix.sales.length})
                  </h3>
                  <div className="overflow-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-[#121926] z-10">
                        <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                          <th className="py-2 pr-2 whitespace-nowrap">Sales</th>
                          <th className="py-2 px-2 whitespace-nowrap">Area</th>
                          <th className="py-2 px-2 text-right whitespace-nowrap">Target Sell In</th>
                          <th className="py-2 px-2 text-right whitespace-nowrap">Aktual Sell In</th>
                          <th className="py-2 pl-2 text-right whitespace-nowrap">Achv</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                        {snap.targetMatrix.sales.map((s) => (
                          <tr key={s.salesName} className="hover:bg-[#172033]">
                            <td className="py-2 pr-2 font-sans font-bold text-white whitespace-nowrap">{s.salesName}</td>
                            <td className="py-2 px-2 font-sans text-slate-400 whitespace-nowrap">{s.coverArea}</td>
                            <td className="py-2 px-2 text-right text-slate-400 whitespace-nowrap">{formatRupiah(s.targetSellIn)}</td>
                            <td className="py-2 px-2 text-right font-bold text-white whitespace-nowrap">{formatRupiah(s.actualSellIn)}</td>
                            <td className={`py-2 pl-2 text-right font-bold whitespace-nowrap ${s.achievementPct >= 100 ? 'text-emerald-400' : s.achievementPct >= 75 ? 'text-cyan-400' : 'text-amber-400'}`}>
                              {s.achievementPct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF6B00] mb-2">
                    Daftar Area &amp; Supervisor ({snap.targetMatrix.areas.length} Area)
                  </h3>
                  <div className="overflow-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-[#121926] z-10">
                        <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                          <th className="py-2 pr-2 whitespace-nowrap">Cover Area</th>
                          <th className="py-2 px-2 text-right whitespace-nowrap">Target</th>
                          <th className="py-2 px-2 text-right whitespace-nowrap">Sell In</th>
                          <th className="py-2 px-2 text-right whitespace-nowrap">Sell Out</th>
                          <th className="py-2 pl-2 text-right whitespace-nowrap">Achv</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                        {snap.targetMatrix.areas.map((a) => (
                          <tr key={a.coverArea} className="hover:bg-[#172033]">
                            <td className="py-2 pr-2 font-sans font-bold text-white whitespace-nowrap">{a.coverArea}</td>
                            <td className="py-2 px-2 text-right text-slate-400 whitespace-nowrap">{formatRupiah(a.targetOmzet)}</td>
                            <td className="py-2 px-2 text-right text-white whitespace-nowrap">{formatRupiah(a.actualSellIn)}</td>
                            <td className="py-2 px-2 text-right text-cyan-400 whitespace-nowrap">{formatRupiah(a.actualSellOut)}</td>
                            <td className="py-2 pl-2 text-right font-bold text-emerald-400 whitespace-nowrap">{a.achievementPct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-LENS: MARKET SHARE MISSGLAM */}
          {activeLens === 'market_share' && marketShareData && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Market Share MissGlam (MG) — Semua Gerai
                  </h2>
                  <p className="text-xs text-slate-400">
                    Rekap Actual vs Omset Toko &amp; Persentase Market Share (%) seluruh cabang MissGlam
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('market_share_mg')}
                  className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Kelola &amp; Input Market Share MG</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Rata-rata Market Share MG</span>
                  <span className="text-xl font-black font-mono tabular-nums text-[#00D2FF] mt-1 block whitespace-nowrap">{marketShareData.mgAvgSharePct}%</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Actual MG</span>
                  <span className="text-xl font-black font-mono tabular-nums text-[#FF6B00] mt-1 block whitespace-nowrap">{formatRupiah(marketShareData.mgTotalActual)}</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Omset Toko MG</span>
                  <span className="text-xl font-black font-mono tabular-nums text-white mt-1 block whitespace-nowrap">{formatRupiah(marketShareData.mgTotalStoreOmset)}</span>
                </div>
              </div>

              <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 overflow-auto max-h-[calc(100vh-345px)]">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#121926] z-10">
                    <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                      <th className="py-2 pr-2 whitespace-nowrap">Nama Toko MissGlam</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Actual (Rp)</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Omset Toko (Rp)</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Market Share (%)</th>
                      <th className="py-2 pl-2 text-center whitespace-nowrap">Bulan Terdata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                    {marketShareData.mgPerStoreRecap.map((row) => (
                      <tr key={row.storeName} className="hover:bg-[#172033]">
                        <td className="py-2 pr-2 font-sans font-bold text-white whitespace-nowrap">{row.storeName}</td>
                        <td className="py-2 px-2 text-right text-[#FF6B00] font-bold whitespace-nowrap">{formatRupiah(row.totalActual)}</td>
                        <td className="py-2 px-2 text-right text-slate-300 whitespace-nowrap">{formatRupiah(row.totalStoreOmset)}</td>
                        <td className="py-2 px-2 text-right font-black text-[#00D2FF] whitespace-nowrap">{row.marketSharePercent}%</td>
                        <td className="py-2 pl-2 text-center text-slate-400 whitespace-nowrap">{row.monthsCount} bln</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-LENS: BRAND, KATEGORI & SKU */}
          {activeLens === 'product_mix' && productMixData && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Brand Kosmetik, Kategori &amp; Top SKU
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pangsa pasar per brand, kategori produk, serta peringkat SKU terlaris
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('brand')}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6B00] text-white text-xs font-bold cursor-pointer"
                  >
                    Buka Brand
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('category')}
                    className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
                  >
                    Buka Kategori
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('sku')}
                    className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
                  >
                    Buka SKU
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 overflow-auto max-h-[calc(100vh-280px)]">
                  <h3 className="text-xs font-bold uppercase text-[#FF6B00] mb-2.5">
                    Top Kategori Produk ({productMixData.topCategories.length})
                  </h3>
                  <div className="space-y-2 text-xs">
                    {productMixData.topCategories.slice(0, 10).map((cat) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex justify-between gap-2 font-mono tabular-nums">
                          <span className="font-sans font-semibold text-white truncate">{cat.category}</span>
                          <span className="text-cyan-400 font-bold whitespace-nowrap shrink-0">
                            {formatRupiah(cat.totalValue)} ({cat.contributionPercent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1B2436] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#2563EB] to-[#00D2FF]"
                            style={{ width: `${Math.min(100, Math.max(2, cat.contributionPercent))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 overflow-auto max-h-[calc(100vh-280px)]">
                  <h3 className="text-xs font-bold uppercase text-[#00D2FF] mb-2.5">
                    Top 10 SKU Terlaris
                  </h3>
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-[#121926] z-10">
                      <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                        <th className="py-2 pr-2">SKU</th>
                        <th className="py-2 px-2 text-right whitespace-nowrap">Qty</th>
                        <th className="py-2 px-2 text-right whitespace-nowrap">Omset</th>
                        <th className="py-2 pl-2 text-right whitespace-nowrap">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                      {productMixData.topSkus.slice(0, 10).map((sku) => (
                        <tr key={sku.name} className="hover:bg-[#172033]">
                          <td className="py-2 pr-2 font-sans font-semibold text-white min-w-[180px] whitespace-normal break-words leading-snug">
                            {sku.name}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-300 whitespace-nowrap">{formatNumber(sku.totalQty)}</td>
                          <td className="py-2 px-2 text-right font-bold text-[#FF6B00] whitespace-nowrap">{formatRupiah(sku.totalValue)}</td>
                          <td className="py-2 pl-2 text-right text-emerald-400 whitespace-nowrap">{sku.contributionPercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-LENS: PERTUMBUHAN & TOKO BA VS NON-BA (SELL IN) */}
          {activeLens === 'channel_growth' && channelGrowthRows && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Kontribusi Toko Ada BA vs Non-BA (Khusus Omset Sell In) &amp; Sell In vs Out
                  </h2>
                  <p className="text-xs text-slate-400">
                    Rekapitulasi bulanan jumlah toko, Omset Sell In, dan rasio Sell Through
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('kontribusi_toko_ba')}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6B00] text-white text-xs font-bold cursor-pointer"
                  >
                    Buka Toko BA vs Non-BA
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('sell_in_vs_sell_out')}
                    className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
                  >
                    Buka Sell In vs Out
                  </button>
                </div>
              </div>

              <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 overflow-auto max-h-[calc(100vh-260px)]">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#121926] z-10">
                    <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                      <th className="py-2 pr-2 whitespace-nowrap">Bulan</th>
                      <th className="py-2 px-2 text-center whitespace-nowrap">Semua Toko</th>
                      <th className="py-2 px-2 text-right whitespace-nowrap">Omset Sell In</th>
                      <th className="py-2 px-2 text-center text-[#FF6B00] whitespace-nowrap">Toko Ada BA</th>
                      <th className="py-2 px-2 text-right text-[#FF6B00] whitespace-nowrap">Sell In BA</th>
                      <th className="py-2 px-2 text-right text-[#FF6B00] whitespace-nowrap">Kontribusi BA</th>
                      <th className="py-2 px-2 text-center text-[#00D2FF] whitespace-nowrap">Toko Non-BA</th>
                      <th className="py-2 px-2 text-right text-[#00D2FF] whitespace-nowrap">Sell In Non-BA</th>
                      <th className="py-2 pl-2 text-right text-[#00D2FF] whitespace-nowrap">Kontribusi Non-BA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                    {channelGrowthRows.map((m) => (
                      <tr key={m.monthName} className="hover:bg-[#172033]">
                        <td className="py-2 pr-2 font-sans font-bold text-white whitespace-nowrap">{m.monthName}</td>
                        <td className="py-2 px-2 text-center text-slate-300 whitespace-nowrap">{m.totalStoresCount}</td>
                        <td className="py-2 px-2 text-right font-bold text-white whitespace-nowrap">{formatRupiah(m.totalSellIn)}</td>
                        <td className="py-2 px-2 text-center text-[#FF6B00] font-bold whitespace-nowrap">{m.tokoBaCount} Toko</td>
                        <td className="py-2 px-2 text-right text-slate-200 whitespace-nowrap">{formatRupiah(m.tokoBaSellIn)}</td>
                        <td className="py-2 px-2 text-right font-black text-[#FF6B00] whitespace-nowrap">{m.tokoBaContributionPct}%</td>
                        <td className="py-2 px-2 text-center text-[#00D2FF] font-bold whitespace-nowrap">{m.tokoNonBaCount}</td>
                        <td className="py-2 px-2 text-right text-slate-200 whitespace-nowrap">{formatRupiah(m.tokoNonBaSellIn)}</td>
                        <td className="py-2 pl-2 text-right font-black text-[#00D2FF] whitespace-nowrap">{m.tokoNonBaContributionPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-LENS: TIM BA, PROMO TOKO ONLINE & KUNJUNGAN */}
          {activeLens === 'promo_ba' && promoBaData && (
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
                    onClick={() => onNavigateTab('promo_toko_online')}
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
                  <span className="text-base font-black text-[#FF6B00] mt-1 block whitespace-nowrap">{formatRupiah(snap.promoTotalActual)}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{snap.promoStoreCount} Toko · {snap.promoDaysCount} Hari</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Denda Nihil BA Aktif</span>
                  <span className="text-base font-black text-rose-400 mt-1 block whitespace-nowrap">{formatRupiah(snap.baTotalDenda)}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{snap.baIncidentsCount} Kejadian Nihil</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Kunjungan Sales</span>
                  <span className="text-base font-black text-[#00D2FF] mt-1 block whitespace-nowrap">{snap.salesVisitsCount} Check-In</span>
                  <span className="text-[11px] text-slate-400">ILHAMSYAH, TIWI, ALBERT</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Kunjungan Trainer</span>
                  <span className="text-base font-black text-emerald-400 mt-1 block whitespace-nowrap">{snap.trainerVisitsCount} Check-In</span>
                  <span className="text-[11px] text-slate-400">ARA &amp; RATIH</span>
                </div>
              </div>

              <PromoMonthlyGrowthPanel
                promoMonthlyRecap={promoBaData.promoMonthlyRecap}
                onOpenPromo={() => onNavigateTab('promo_toko_online')}
              />
            </div>
          )}

          {/* SUB-LENS: KEUANGAN, PROFIT, COST & TAGIHAN */}
          {activeLens === 'finance_bills' && monthlyProfitHrSummary && (
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
                  <span className="text-base xl:text-lg font-black text-white mt-1 block whitespace-nowrap">{formatRupiah(snap.profitSummary.marginValue)}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Sell In: {formatRupiah(snap.profitSummary.sellInActual)}</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Total Beban (Ops + Gaji)</span>
                  <span className="text-base xl:text-lg font-black text-[#FF6B00] mt-1 block whitespace-nowrap">{formatRupiah(snap.profitSummary.totalExpense)}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Gaji: {formatRupiah(snap.profitSummary.salaryCost)}</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Sisa Profit Bersih</span>
                  <span className={`text-base xl:text-lg font-black mt-1 block whitespace-nowrap ${snap.profitSummary.remainingProfitValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatRupiah(snap.profitSummary.remainingProfitValue)}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{profitPctVsSellIn}% vs Sell In</span>
                </div>
                <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-4">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">Tagihan Belum Lunas</span>
                  <span className="text-base xl:text-lg font-black text-[#00D2FF] mt-1 block whitespace-nowrap">{formatRupiah(snap.unpaidBillsAmount)}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{snap.overdueBillsCount} Nota &gt; 30 Hari</span>
                </div>
              </div>

              <MonthlyProfitHrPanel pnlData={monthlyProfitHrSummary} filterMonth={filters.BULAN} />
            </div>
          )}

          {/* SUB-LENS: TARGET & ANALISA GAP */}
          {activeLens === 'targets_alerts' && targetsAlertsData && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Target Management &amp; Diagnosa Gap Defisit
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pemantauan target multi-level dan akar penyebab gap pencapaian
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('target_mgmt')}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6B00] text-white text-xs font-bold cursor-pointer"
                  >
                    Kelola Target
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('gap')}
                    className="px-3 py-1.5 rounded-lg bg-[#192234] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer"
                  >
                    Buka Analisa Gap
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono tabular-nums">
                <div className="bg-[#121926] border border-[#1F293B] hover:border-rose-500/40 transition-colors rounded-xl p-3 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400">Defisit Gap Target</span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('gap')}
                        title="Buka & Edit Kuota Target Gap di Menu Awal"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-sans font-bold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                    <span className="text-base xl:text-lg font-black text-rose-400 mt-1 block whitespace-nowrap">-{formatRupiah(snap.gapDiagnosis.gapDeficit)}</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{snap.gapDiagnosis.lostStoresCount} Toko Pasif</span>
                  </div>
                  <div className="pt-2 border-t border-[#1F293B] flex flex-wrap items-center gap-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('gap')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Edit Kuota &amp; Gap</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('target_mgmt')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Edit Target</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] hover:border-[#FF6B00]/40 transition-colors rounded-xl p-3 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400">Total BA Terdaftar</span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('pengaturan_master')}
                        title="Buka & Edit Master BA, Trainer & Toko di Menu Awal"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 text-[#FFA04D] border border-[#FF6B00]/30 text-[10px] font-sans font-bold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                    <span className="text-base xl:text-lg font-black text-[#FF6B00] mt-1 block whitespace-nowrap">{snap.targetMatrix.bas.length} BA</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{snap.targetMatrix.trainers.length} Trainer Aktif</span>
                  </div>
                  <div className="pt-2 border-t border-[#1F293B] flex flex-wrap items-center gap-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('target_mgmt')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 text-[#FFB067] border border-[#FF6B00]/30 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Edit Target BA &amp; Trainer</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('pengaturan_master')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Edit Master BA &amp; Toko</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1F293B] hover:border-[#00D2FF]/40 transition-colors rounded-xl p-3 flex flex-col justify-between gap-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-sans font-bold uppercase text-slate-400">Kesiapan Status Produk</span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('produk_fokus')}
                        title="Buka & Edit Pengaturan Produk Fokus & Status SKU di Menu Awal"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00D2FF]/15 hover:bg-[#00D2FF]/25 text-[#67E8F9] border border-[#00D2FF]/30 text-[10px] font-sans font-bold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                    <span className="text-base xl:text-lg font-black text-[#00D2FF] mt-1 block whitespace-nowrap">{targetsAlertsData.productStatusSummary.totalSkuCount} SKU</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">Clearance/Risk: {targetsAlertsData.productStatusSummary.clearanceObsoleteShare.toFixed(1)}%</span>
                  </div>
                  <div className="pt-2 border-t border-[#1F293B] flex flex-wrap items-center gap-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('produk_fokus')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00D2FF]/15 hover:bg-[#00D2FF]/25 text-[#67E8F9] border border-[#00D2FF]/30 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Edit Produk Fokus</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('sku')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Lihat Semua SKU</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <TargetsGapPanel
                storeGapDetails={targetsAlertsData.storeGapDetails}
                totalStoreGapDeficit={targetsAlertsData.totalStoreGapDeficit}
                gapPreviousPeriodName={targetsAlertsData.gapPreviousPeriodName}
                gapCurrentPeriodName={targetsAlertsData.gapCurrentPeriodName}
              />
            </div>
          )}

          {/* SUB-LENS: ACHIEVE QUARTAL — HALL OF FAME */}
          {activeLens === 'achieve_quartal' && achieveQuartalData && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-gradient-to-r from-[#0E1525] via-[#171E38] to-[#0E1525] text-white rounded-2xl p-4 sm:p-5 border border-[#24314D] shadow-lg">
                {/* Header Hall of Fame */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#24314D]">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/30 shrink-0">
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
                        Hall of Fame • Juara Terhebat {achieveQuartalData.overall.quarterLabel}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                        Peringkat diurutkan dari pencapaian persentase (%) tertinggi • Mengikuti Filter Terintegrasi ({achieveQuartalData.activeKetDisplayLabel})
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B101C] border border-[#24314D]">
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as QuarterPeriodKey[]).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setSelectedQuarter(q)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                            selectedQuarter === q
                              ? 'bg-[#FF6B00] text-white shadow-xs'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <span
                      className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${
                        achieveQuartalData.isKetSellIn
                          ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                          : achieveQuartalData.isKetSellOut
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                          : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                      }`}
                    >
                      Filter KET: {achieveQuartalData.activeKetDisplayLabel}
                    </span>

                    <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                      {achieveQuartalData.overall.dateRangeLabel}
                    </span>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('rangkuman_kuartal')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span>Buka Menu Achieve Quartal</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3 Champion Podium Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
                  {/* Top Sales */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <Medal className="w-4 h-4 text-blue-400" />
                        Top Sales Champion
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        Peringkat 1
                      </span>
                    </div>
                    <div className="mt-3">
                      <h4 className="text-base font-extrabold text-white truncate">
                        {achieveQuartalData.topSales?.name || 'Tidak ada data'}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {achieveQuartalData.isKetSellIn
                          ? 'Realisasi Sell In:'
                          : achieveQuartalData.isKetSellOut
                          ? 'Realisasi Sell Out:'
                          : 'Omset Kuartal:'}{' '}
                        <span className="font-bold text-amber-300 font-mono">
                          {formatRupiah(achieveQuartalData.topSales?.actual || 0, true)}
                        </span>
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-slate-400 font-sans">
                          Target: {formatRupiah(achieveQuartalData.topSales?.target || 0, true)}
                        </span>
                        <span className="font-black text-emerald-400">
                          {formatPercent(achieveQuartalData.topSales?.percent || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top BA */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                        <Medal className="w-4 h-4 text-pink-400" />
                        Top Beauty Advisor Star
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/30">
                        Peringkat 1
                      </span>
                    </div>
                    <div className="mt-3">
                      <h4 className="text-base font-extrabold text-white truncate">
                        {achieveQuartalData.topBa?.name || 'Tidak ada data'}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 truncate">
                        Outlet:{' '}
                        <span className="font-bold text-pink-300">
                          {achieveQuartalData.topBa?.store || '-'}
                        </span>
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {achieveQuartalData.isKetSellIn
                          ? 'Realisasi Sell In:'
                          : achieveQuartalData.isKetSellOut
                          ? 'Realisasi Sell Out:'
                          : 'Omset Kuartal:'}{' '}
                        <span className="font-bold text-amber-300 font-mono">
                          {formatRupiah(achieveQuartalData.topBa?.actual || 0, true)}
                        </span>
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-slate-400 font-sans">
                          Target: {formatRupiah(achieveQuartalData.topBa?.target || 0, true)}
                        </span>
                        <span className="font-black text-emerald-400">
                          {formatPercent(achieveQuartalData.topBa?.percent || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Trainer */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                        <Medal className="w-4 h-4 text-purple-400" />
                        Top Trainer of The Quarter
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                        Peringkat 1
                      </span>
                    </div>
                    <div className="mt-3">
                      <h4 className="text-base font-extrabold text-white truncate">
                        {achieveQuartalData.topTrainer?.name || 'Tidak ada data'}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {achieveQuartalData.isKetSellIn
                          ? 'Realisasi Sell In:'
                          : achieveQuartalData.isKetSellOut
                          ? 'Realisasi Sell Out:'
                          : 'Realisasi Area:'}{' '}
                        <span className="font-bold text-purple-300 font-mono">
                          {formatRupiah(achieveQuartalData.topTrainer?.actual || 0, true)}
                        </span>
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-slate-400 font-sans">
                          KPI: {achieveQuartalData.topTrainer?.score || 0} Poin
                        </span>
                        <span className="font-black text-emerald-400">
                          {formatPercent(achieveQuartalData.topTrainer?.percent || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Leaderboard Table Mengikuti Filter Terintegrasi */}
                <div className="mt-5 pt-4 border-t border-[#24314D]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                        Rincian Pencapaian {achieveQuartalData.overall.quarterLabel} —{' '}
                        {achieveQuartalData.isKetSellIn
                          ? 'Semua Pencapaian SELL IN'
                          : achieveQuartalData.isKetSellOut
                          ? 'Semua Pencapaian SELL OUT'
                          : 'Semua Pencapaian SELL IN & SELL OUT'}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Urutan peringkat berdasarkan persentase pencapaian (%) tertinggi • Filter KET ({achieveQuartalData.activeKetDisplayLabel})
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={quartalSearch}
                          onChange={(e) => setQuartalSearch(e.target.value)}
                          placeholder="Cari nama / area / toko..."
                          className="pl-8 pr-7 py-1.5 rounded-lg bg-[#0B101C] border border-[#24314D] focus:border-amber-400 text-xs text-white placeholder:text-slate-500 outline-none w-44 sm:w-52"
                        />
                        {quartalSearch && (
                          <button
                            type="button"
                            onClick={() => setQuartalSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/10">
                        {([
                          { id: 'sales', label: `Sales (${achieveQuartalData.filteredSales.length})` },
                          { id: 'ba', label: `BA (${achieveQuartalData.filteredBa.length})` },
                          { id: 'trainer', label: `Trainer (${achieveQuartalData.filteredTrainer.length})` },
                        ] as const).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setHallOfFameTab(tab.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              hallOfFameTab === tab.id
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : 'text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#090E1A]/80 border border-white/10 rounded-xl overflow-x-auto max-h-[430px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-[#0F172A]">
                        <tr className="border-b border-white/10 text-slate-300 font-bold">
                          <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                          <th className="py-2.5 px-3">
                            {hallOfFameTab === 'sales'
                              ? 'Personil Sales'
                              : hallOfFameTab === 'ba'
                              ? 'Nama BA & Toko'
                              : 'Nama Trainer'}
                          </th>
                          <th className="py-2.5 px-3">Area</th>
                          {(achieveQuartalData.isKetSellIn || !achieveQuartalData.isKetSellOut) && (
                            <>
                              <th className="py-2.5 px-3 text-right">Target Sell In</th>
                              <th className="py-2.5 px-3 text-right">Realisasi Sell In</th>
                              <th className="py-2.5 px-3 text-center">% Sell In</th>
                            </>
                          )}
                          {(achieveQuartalData.isKetSellOut || !achieveQuartalData.isKetSellIn) && (
                            <>
                              <th className="py-2.5 px-3 text-right">Target Sell Out</th>
                              <th className="py-2.5 px-3 text-right">Realisasi Sell Out</th>
                              <th className="py-2.5 px-3 text-center">% Sell Out</th>
                            </>
                          )}
                          {!achieveQuartalData.isKetSellIn && !achieveQuartalData.isKetSellOut && (
                            <th className="py-2.5 px-3 text-center">% Peringkat</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                        {hallOfFameTab === 'sales' &&
                          (achieveQuartalData.filteredSales.length > 0 ? (
                            achieveQuartalData.filteredSales.map((s, idx) => (
                              <tr key={s.salesName} className="hover:bg-white/5 transition-colors">
                                <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                                <td className="py-2 px-3 font-sans font-bold text-white">{s.salesName}</td>
                                <td className="py-2 px-3 font-sans text-slate-400">{s.coverArea}</td>
                                {(achieveQuartalData.isKetSellIn || !achieveQuartalData.isKetSellOut) && (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {formatRupiah(s.quarterTargetSellIn, true)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-sky-300">
                                      {formatRupiah(s.quarterActualSellIn, true)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-emerald-300">
                                      {formatPercent(s.quarterAchievementSellInPercent, false)}
                                    </td>
                                  </>
                                )}
                                {(achieveQuartalData.isKetSellOut || !achieveQuartalData.isKetSellIn) && (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {formatRupiah(s.quarterTargetSellOut, true)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-300">
                                      {formatRupiah(s.quarterActualSellOut, true)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-emerald-300">
                                      {formatPercent(s.quarterAchievementSellOutPercent, false)}
                                    </td>
                                  </>
                                )}
                                {!achieveQuartalData.isKetSellIn && !achieveQuartalData.isKetSellOut && (
                                  <td className="py-2 px-3 text-center font-extrabold text-amber-300">
                                    {formatPercent(s.quarterAchievementPercent, false)}
                                  </td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="py-8 text-center font-sans text-slate-400">
                                Tidak ada data Sales pada filter yang dipilih.
                              </td>
                            </tr>
                          ))}

                        {hallOfFameTab === 'ba' &&
                          (achieveQuartalData.filteredBa.length > 0 ? (
                            achieveQuartalData.filteredBa.map((b, idx) => (
                              <tr key={`${b.baName}-${b.storeName}`} className="hover:bg-white/5 transition-colors">
                                <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                                <td className="py-2 px-3 font-sans">
                                  <span className="font-bold text-white block">{b.baName}</span>
                                  <span className="text-[10px] text-slate-400">{b.storeName}</span>
                                </td>
                                <td className="py-2 px-3 font-sans text-slate-400">{b.coverArea}</td>
                                {(achieveQuartalData.isKetSellIn || !achieveQuartalData.isKetSellOut) && (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {formatRupiah(b.quarterTargetSellIn, true)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-sky-300">
                                      {formatRupiah(b.quarterActualSellIn, true)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-emerald-300">
                                      {formatPercent(b.quarterAchievementSellInPercent, false)}
                                    </td>
                                  </>
                                )}
                                {(achieveQuartalData.isKetSellOut || !achieveQuartalData.isKetSellIn) && (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {formatRupiah(b.quarterTargetSellOut, true)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-300">
                                      {formatRupiah(b.quarterActualSellOut, true)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-emerald-300">
                                      {formatPercent(b.quarterAchievementSellOutPercent, false)}
                                    </td>
                                  </>
                                )}
                                {!achieveQuartalData.isKetSellIn && !achieveQuartalData.isKetSellOut && (
                                  <td className="py-2 px-3 text-center font-extrabold text-amber-300">
                                    {formatPercent(b.quarterAchievementPercent, false)}
                                  </td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="py-8 text-center font-sans text-slate-400">
                                Tidak ada data BA pada filter yang dipilih.
                              </td>
                            </tr>
                          ))}

                        {hallOfFameTab === 'trainer' &&
                          (achieveQuartalData.filteredTrainer.length > 0 ? (
                            achieveQuartalData.filteredTrainer.map((t, idx) => (
                              <tr key={t.trainerName} className="hover:bg-white/5 transition-colors">
                                <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                                <td className="py-2 px-3 font-sans font-bold text-white">{t.trainerName}</td>
                                <td className="py-2 px-3 font-sans text-slate-400">{t.areaCovered}</td>
                                {(achieveQuartalData.isKetSellIn || !achieveQuartalData.isKetSellOut) && (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {formatRupiah(t.quarterTargetSellIn, true)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-sky-300">
                                      {formatRupiah(t.quarterActualSellIn, true)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-emerald-300">
                                      {formatPercent(t.quarterAchievementSellInPercent, false)}
                                    </td>
                                  </>
                                )}
                                {(achieveQuartalData.isKetSellOut || !achieveQuartalData.isKetSellIn) && (
                                  <>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {formatRupiah(t.quarterTargetSellOut, true)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-300">
                                      {formatRupiah(t.quarterActualSellOut, true)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-bold text-emerald-300">
                                      {formatPercent(t.quarterAchievementSellOutPercent, false)}
                                    </td>
                                  </>
                                )}
                                {!achieveQuartalData.isKetSellIn && !achieveQuartalData.isKetSellOut && (
                                  <td className="py-2 px-3 text-center font-extrabold text-amber-300">
                                    {formatPercent(t.quarterAchievementPercent, false)}
                                  </td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={10} className="py-8 text-center font-sans text-slate-400">
                                Tidak ada data Trainer pada filter yang dipilih.
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
