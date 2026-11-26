import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ActiveTab } from '../types/dashboard';
import { ExecutiveCoreSnapshot } from '../services/executiveDashboardService';
import { formatNumber, formatPercent, formatRupiah } from '../utils/analytics';
import {
  BrandShareDonutCard,
  MiniProgressRing,
  TrajectoryChartCard,
  formatCompactIdr,
} from './ExecutiveDashboardWidgets';

interface OverviewDashboardPanelProps {
  snap: ExecutiveCoreSnapshot;
  onOpenTrendView: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const OverviewDashboardPanel: React.FC<OverviewDashboardPanelProps> = React.memo(
  ({ snap, onOpenTrendView, onNavigateTab }) => {
    const derived = useMemo(() => {
      const maxRegionalBar =
        Math.max(1, ...snap.regionalBars.map((b) => Math.max(b.value, b.target))) * 1.1;
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
      const totalBrandDelta =
        snap.brandComparisonTotals.current - snap.brandComparisonTotals.previous;

      return {
        maxRegionalBar,
        profitPctVsSellIn,
        avgPricePerUnit,
        topSku,
        topBrand,
        fastestGrowthArea,
        targetProgressClamped,
        totalBrandDelta,
      };
    }, [snap]);

    const {
      maxRegionalBar,
      profitPctVsSellIn,
      avgPricePerUnit,
      topSku,
      topBrand,
      fastestGrowthArea,
      targetProgressClamped,
      totalBrandDelta,
    } = derived;

    return (
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

        {/* ROW 3: BRAND & SALES COMPARISON (MoM) */}
        <div className="flex flex-col gap-2.5">
          <div className="w-full bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
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
                    <th className="py-1.5 pr-3 whitespace-nowrap">BRAND</th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">BLN LALU ({snap.previousPeriodLabel || 'OKTOBER 2026'})</th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">BLN INI ({snap.currentPeriodLabel || 'NOVEMBER 2026'})</th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">SELISIH (Δ)</th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">MoM</th>
                    <th className="py-1.5 pl-2.5 text-right whitespace-nowrap">SHARE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                  {snap.brandComparisonRows.map((row) => {
                    const delta = row.current - row.previous;
                    return (
                      <tr key={row.name} className="hover:bg-[#172033] transition-colors">
                        <td className="py-1.5 pr-3 font-sans font-semibold text-slate-200 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-xs shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            <span>{row.name}</span>
                          </span>
                        </td>
                        <td
                          className="py-1.5 px-2.5 text-right text-slate-400 whitespace-nowrap"
                          title={formatRupiah(row.previous)}
                        >
                          {formatRupiah(row.previous)}
                        </td>
                        <td
                          className="py-1.5 px-2.5 text-right font-bold text-white whitespace-nowrap"
                          title={formatRupiah(row.current)}
                        >
                          {formatRupiah(row.current)}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-bold whitespace-nowrap ${
                            delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                          title={formatRupiah(delta)}
                        >
                          {delta >= 0 ? `+${formatCompactIdr(delta)}` : `-${formatCompactIdr(Math.abs(delta))}`}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-bold whitespace-nowrap ${
                            row.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {row.growth >= 0 ? `+${row.growth}% ↑` : `${row.growth}% ↓`}
                        </td>
                        <td className="py-1.5 pl-2.5 text-right text-slate-300 font-semibold whitespace-nowrap">
                          {row.sharePct}%
                        </td>
                      </tr>
                    );
                  })}

                  {snap.brandComparisonRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-5 text-center font-sans text-slate-500">
                        Data perbandingan belum tersedia pada filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#28354D] font-mono tabular-nums text-[11px]">
                    <td className="pt-2 pr-3 font-sans font-extrabold text-white whitespace-nowrap">
                      TOTAL PORTFOLIO ({snap.brandComparisonRows.length} Brand)
                    </td>
                    <td
                      className="pt-2 px-2.5 text-right font-bold text-slate-300 whitespace-nowrap"
                      title={formatRupiah(snap.brandComparisonTotals.previous)}
                    >
                      {formatRupiah(snap.brandComparisonTotals.previous)}
                    </td>
                    <td
                      className="pt-2 px-2.5 text-right font-black text-[#FF6B00] whitespace-nowrap"
                      title={formatRupiah(snap.brandComparisonTotals.current)}
                    >
                      {formatRupiah(snap.brandComparisonTotals.current)}
                    </td>
                    <td
                      className={`pt-2 px-2.5 text-right font-bold whitespace-nowrap ${
                        totalBrandDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                      title={formatRupiah(totalBrandDelta)}
                    >
                      {totalBrandDelta >= 0
                        ? `+${formatCompactIdr(totalBrandDelta)}`
                        : `-${formatCompactIdr(Math.abs(totalBrandDelta))}`}
                    </td>
                    <td
                      className={`pt-2 px-2.5 text-right font-bold whitespace-nowrap ${
                        snap.brandComparisonTotals.growth >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {snap.brandComparisonTotals.growth >= 0 ? '+' : ''}
                      {snap.brandComparisonTotals.growth}%
                    </td>
                    <td className="pt-2 pl-2.5 text-right font-bold text-white whitespace-nowrap">
                      100.0%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="w-full bg-[#121926] border border-[#1F293B] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
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
                    <th className="py-1.5 pr-3 whitespace-nowrap">NAMA SALES</th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      {snap.previousPeriodLabel || 'OKTOBER 2026'}
                    </th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      {snap.currentPeriodLabel || 'NOVEMBER 2026'}
                    </th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">SELISIH (Δ)</th>
                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">MoM (%)</th>
                    <th className="py-1.5 pl-2.5 text-right whitespace-nowrap">SHARE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
                  {snap.salesComparisonRows.map((row) => (
                    <tr key={row.name} className="hover:bg-[#172033] transition-colors">
                      <td className="py-1.5 pr-3 font-sans font-semibold text-slate-200 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.name}</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">
                            ({row.subLabel})
                          </span>
                        </div>
                      </td>
                      <td
                        className="py-1.5 px-2.5 text-right text-slate-400 whitespace-nowrap"
                        title={formatRupiah(row.previous)}
                      >
                        {formatRupiah(row.previous)}
                      </td>
                      <td
                        className="py-1.5 px-2.5 text-right font-bold text-white whitespace-nowrap"
                        title={formatRupiah(row.current)}
                      >
                        {formatRupiah(row.current)}
                      </td>
                      <td
                        className={`py-1.5 px-2.5 text-right font-bold whitespace-nowrap ${
                          row.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                        title={formatRupiah(row.delta)}
                      >
                        {row.delta >= 0
                          ? `+${formatCompactIdr(row.delta)}`
                          : `-${formatCompactIdr(Math.abs(row.delta))}`}
                      </td>
                      <td
                        className={`py-1.5 px-2.5 text-right font-bold whitespace-nowrap ${
                          row.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {row.growth >= 0 ? `+${row.growth}% ↑` : `${row.growth}% ↓`}
                      </td>
                      <td className="py-1.5 pl-2.5 text-right text-cyan-300 font-semibold whitespace-nowrap">
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
                    <td className="pt-2 pr-3 font-sans font-extrabold text-white whitespace-nowrap">
                      TOTAL TIM SALES ({snap.salesComparisonRows.length})
                    </td>
                    <td
                      className="pt-2 px-2.5 text-right font-bold text-slate-300 whitespace-nowrap"
                      title={formatRupiah(snap.salesComparisonTotals.previous)}
                    >
                      {formatRupiah(snap.salesComparisonTotals.previous)}
                    </td>
                    <td
                      className="pt-2 px-2.5 text-right font-black text-[#00D2FF] whitespace-nowrap"
                      title={formatRupiah(snap.salesComparisonTotals.current)}
                    >
                      {formatRupiah(snap.salesComparisonTotals.current)}
                    </td>
                    <td
                      className={`pt-2 px-2.5 text-right font-bold whitespace-nowrap ${
                        snap.salesComparisonTotals.delta >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                      title={formatRupiah(snap.salesComparisonTotals.delta)}
                    >
                      {snap.salesComparisonTotals.delta >= 0
                        ? `+${formatCompactIdr(snap.salesComparisonTotals.delta)}`
                        : `-${formatCompactIdr(Math.abs(snap.salesComparisonTotals.delta))}`}
                    </td>
                    <td
                      className={`pt-2 px-2.5 text-right font-bold whitespace-nowrap ${
                        snap.salesComparisonTotals.growth >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {snap.salesComparisonTotals.growth >= 0 ? '+' : ''}
                      {snap.salesComparisonTotals.growth}%
                    </td>
                    <td className="pt-2 pl-2.5 text-right font-bold text-white whitespace-nowrap">
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
            onOpenTrendView={onOpenTrendView}
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
    );
  }
);
