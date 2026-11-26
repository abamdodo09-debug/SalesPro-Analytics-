import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { MonthlyTrajectoryPoint } from '../services/executiveDashboardService';
import { formatRupiah } from '../utils/analytics';

export type SidebarLens =
  | 'overview'
  | 'tren_bulanan'
  | 'regional'
  | 'market_share'
  | 'product_mix'
  | 'channel_growth'
  | 'promo_ba'
  | 'finance_bills'
  | 'targets_alerts'
  | 'kpi_sales'
  | 'kpi_trainer'
  | 'achieve_quartal';

export function formatCompactIdr(val: number): string {
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

export function formatSharePct(pct: number): string {
  if (!Number.isFinite(pct)) return '0,0%';
  const hasSecondDecimal = Math.abs(pct * 10 - Math.round(pct * 10)) > 1e-4;
  return `${(hasSecondDecimal ? pct.toFixed(2) : pct.toFixed(1)).replace('.', ',')}%`;
}

export const MiniProgressRing: React.FC<{
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

export const BrandShareDonutCard: React.FC<{
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

export const TrajectoryChartCard: React.FC<{
  monthlyTrajectory: MonthlyTrajectoryPoint[];
  avgMonthlyRevenue: number;
  selectedYear: number;
  onOpenTrendView?: () => void;
}> = React.memo(({ monthlyTrajectory, avgMonthlyRevenue, selectedYear, onOpenTrendView }) => {
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
        <div className="flex items-center gap-2">
          <span
            className="text-[10.5px] font-bold font-mono tabular-nums text-emerald-400 whitespace-nowrap"
            title={`Rata-rata: ${formatRupiah(avgMonthlyRevenue)} / bulan`}
          >
            Avg: {formatCompactIdr(avgMonthlyRevenue)}/bln
          </span>
          {onOpenTrendView && (
            <button
              type="button"
              onClick={onOpenTrendView}
              className="px-2 py-0.5 rounded bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 text-[#FFB067] border border-[#FF6B00]/30 text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors"
            >
              Tren &amp; Rincian →
            </button>
          )}
        </div>
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

export const DashboardSidebar: React.FC<{
  sidebarItems: ReadonlyArray<{
    id: SidebarLens;
    label: string;
    icon: React.ReactNode;
  }>;
  uiLens: SidebarLens;
  onSelectLens: (lens: SidebarLens) => void;
  selectedYear: number;
  targetTotal: number;
  achievementPercent: number;
  totalRevenue: number;
  selectedMonthLabel: string;
}> = React.memo(
  ({
    sidebarItems,
    uiLens,
    onSelectLens,
    selectedYear,
    targetTotal,
    achievementPercent,
    totalRevenue,
    selectedMonthLabel,
  }) => {
    const targetProgressClamped = Math.max(0, Math.min(100, achievementPercent));
    const isTargetOnTrack = achievementPercent >= 75;

    return (
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
                  onClick={() => onSelectLens(item.id)}
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
            TARGET PERIODE ({selectedYear})
          </span>
          <div>
            <span className="text-[10px] text-slate-400 block">Target Omset</span>
            <span
              className="text-[12.5px] font-black font-mono tabular-nums text-white block whitespace-nowrap"
              title={formatRupiah(targetTotal)}
            >
              {formatRupiah(targetTotal)}
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
              <span className="font-bold text-emerald-400">{achievementPercent}%</span>
            </div>
          </div>

          <div className="pt-1 border-t border-[#1C2536]">
            <span
              className="text-[12px] font-extrabold font-mono tabular-nums text-white block whitespace-nowrap"
              title={formatRupiah(totalRevenue)}
            >
              {formatRupiah(totalRevenue)}
            </span>
            <span className="text-[9.5px] text-slate-400 block mt-0.5">
              {selectedMonthLabel}
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
    );
  }
);
