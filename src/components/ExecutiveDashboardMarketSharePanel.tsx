import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronRight, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { MarketShareLensData } from '../services/executiveDashboardService';
import { aggregatePerStoreMgRecap } from '../services/missGlamMarketShareService';
import { formatRupiah } from '../utils/analytics';
import { formatCompactIdr, formatSharePct } from './ExecutiveDashboardWidgets';

interface MarketShareDashboardPanelProps {
  marketShareData: MarketShareLensData;
  onOpenMarketShareMg: () => void;
}

export const MarketShareDashboardPanel: React.FC<MarketShareDashboardPanelProps> = React.memo(
  ({ marketShareData, onOpenMarketShareMg }) => {
    const [mgFilterMonth, setMgFilterMonth] = useState<string>('ALL');
    const [mgFilterStore, setMgFilterStore] = useState<string>('ALL');
    const [mgHoveredChartMonthIdx, setMgHoveredChartMonthIdx] = useState<number | null>(null);

    const mgMaxChartSharePct = useMemo(() => {
      const { mgStoreAnalytics } = marketShareData;
      const vals = [
        ...mgStoreAnalytics.monthlyTrendChartData.map((m) => Math.max(0, m.marketSharePercent)),
        ...mgStoreAnalytics.allActiveStores.map((s) => Math.max(0, s.latestShare)),
        mgStoreAnalytics.networkAvgShare,
      ];
      return Math.max(...vals, 10);
    }, [marketShareData]);

    const filteredMgPerStoreRecap = useMemo(() => {
      const base =
        mgFilterMonth === 'ALL'
          ? marketShareData.mgPerStoreRecap
          : aggregatePerStoreMgRecap(
              marketShareData.mgItems,
              marketShareData.mgStoreOptions,
              mgFilterMonth
            );
      if (mgFilterStore === 'ALL') return base;
      const targetUpper = mgFilterStore.trim().toUpperCase();
      return base.filter((r) => r.storeName.trim().toUpperCase() === targetUpper);
    }, [marketShareData, mgFilterMonth, mgFilterStore]);

    return (
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
              Market Share MissGlam (MG) — Semua Gerai
            </h2>
            <p className="text-xs text-slate-400">
              Rekap Actual vs Omset Toko, Grafik Pergerakan &amp; Analisa Potensi Market Share (%) seluruh cabang MissGlam
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenMarketShareMg}
            className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Kelola &amp; Input Market Share MG</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Rata-rata Market Share MG</span>
            <span className="text-xl font-black font-mono tabular-nums text-[#00D2FF] mt-1 block whitespace-nowrap">
              {formatSharePct(marketShareData.mgAvgSharePct)}
            </span>
          </div>
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Actual MG</span>
            <span className="text-xl font-black font-mono tabular-nums text-[#FF6B00] mt-1 block whitespace-nowrap">
              {formatRupiah(marketShareData.mgTotalActual)}
            </span>
          </div>
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Omset Toko MG</span>
            <span className="text-xl font-black font-mono tabular-nums text-white mt-1 block whitespace-nowrap">
              {formatRupiah(marketShareData.mgTotalStoreOmset)}
            </span>
          </div>
        </div>

        {marketShareData.mgItems.length > 0 ? (
          <>
            <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0F1623] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-pink-500/20 border border-pink-500/35 text-pink-400 shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white">
                      Grafik Pergerakan &amp; Perbandingan Market Share MissGlam
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tren Market Share (%) antar bulan serta posisi &amp; perubahan setiap cabang terhadap rata-rata toko ({formatSharePct(marketShareData.mgStoreAnalytics.networkAvgShare)}).
                    </p>
                  </div>
                </div>
                {(mgFilterMonth !== 'ALL' || mgFilterStore !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMgFilterMonth('ALL');
                      setMgFilterStore('ALL');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#1A2438] border border-[#2D3E5E] hover:bg-[#23314A] text-cyan-300 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Reset Filter Grafik
                  </button>
                )}
              </div>

              <div className="flex flex-col divide-y divide-[#1E293B]">
                <div className="w-full p-4 flex flex-col justify-between space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">
                        Tren Market Share Bulanan (%)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Klik batang bulan untuk memfilter tabel. Angka di atas batang menunjukkan selisih poin % MoM.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {marketShareData.mgStoreAnalytics.monthlyTrendChartData.length} Bulan Terdata
                    </span>
                  </div>

                  <div className="relative pt-7">
                    {mgHoveredChartMonthIdx !== null &&
                      marketShareData.mgStoreAnalytics.monthlyTrendChartData[mgHoveredChartMonthIdx] &&
                      (() => {
                        const hm = marketShareData.mgStoreAnalytics.monthlyTrendChartData[mgHoveredChartMonthIdx];
                        return (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#080D16] text-white px-3.5 py-2 rounded-lg shadow-xl text-xs z-20 pointer-events-none border border-[#2D3E5E] whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{hm.monthPeriod}</span>
                              <span className="text-slate-500">·</span>
                              <span className="text-[#00D2FF] font-mono font-extrabold">
                                {formatSharePct(hm.marketSharePercent)}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 tabular-nums mt-0.5">
                              Actual {formatCompactIdr(hm.totalActual)} / Omset{' '}
                              {formatCompactIdr(hm.totalStoreOmset)} ({hm.storeCount} toko)
                            </div>
                          </div>
                        );
                      })()}

                    <div className="flex items-stretch gap-2">
                      <div className="flex flex-col justify-between text-right font-mono text-[10px] text-slate-500 tabular-nums py-7 pr-2 border-r border-[#1E293B] shrink-0 w-11">
                        <span>{formatSharePct(mgMaxChartSharePct)}</span>
                        <span>{formatSharePct(mgMaxChartSharePct * 0.5)}</span>
                        <span>0%</span>
                      </div>

                      <div className="flex-1 flex items-end gap-1.5 sm:gap-2.5 h-56 pt-8 pb-2 min-w-0">
                        {marketShareData.mgStoreAnalytics.monthlyTrendChartData.map((pt, idx) => {
                          const heightPct =
                            mgMaxChartSharePct > 0
                              ? Math.max(6, (Math.max(0, pt.marketSharePercent) / mgMaxChartSharePct) * 100)
                              : 6;
                          const isSelected = mgFilterMonth.toUpperCase() === pt.monthPeriod.toUpperCase();
                          const isUp = pt.deltaSharePercent !== null && pt.deltaSharePercent > 0;
                          const isDown = pt.deltaSharePercent !== null && pt.deltaSharePercent < 0;

                          return (
                            <button
                              key={pt.monthPeriod}
                              type="button"
                              onClick={() =>
                                setMgFilterMonth(isSelected ? 'ALL' : pt.monthPeriod)
                              }
                              onMouseEnter={() => setMgHoveredChartMonthIdx(idx)}
                              onMouseLeave={() => setMgHoveredChartMonthIdx(null)}
                              className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none"
                            >
                              <div className="mb-1 flex flex-col items-center w-full">
                                {pt.deltaSharePercent !== null ? (
                                  <span
                                    className={`text-[9.5px] font-mono font-bold tabular-nums leading-none truncate max-w-full ${
                                      isUp
                                        ? 'text-emerald-400'
                                        : isDown
                                        ? 'text-rose-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {pt.deltaSharePercent > 0 ? '+' : ''}
                                    {pt.deltaSharePercent.toFixed(1).replace('.', ',')}%
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] font-mono text-slate-500 leading-none">
                                    Awal
                                  </span>
                                )}
                                <span className="text-[10.5px] font-mono font-extrabold text-[#00D2FF] tabular-nums mt-0.5 truncate max-w-full">
                                  {formatSharePct(pt.marketSharePercent)}
                                </span>
                              </div>

                              <div className="w-full relative flex items-end justify-center h-full px-1">
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className={`w-full max-w-[46px] rounded-t-md transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-pink-500 ring-2 ring-pink-300'
                                      : isUp
                                      ? 'bg-emerald-500 group-hover:bg-emerald-400'
                                      : isDown
                                      ? 'bg-rose-500 group-hover:bg-rose-400'
                                      : 'bg-pink-500/85 group-hover:bg-pink-400'
                                  }`}
                                />
                              </div>

                              <div className="mt-2 text-center w-full">
                                <span className="block text-[10px] font-bold text-slate-200 truncate">
                                  {pt.monthPeriod}
                                </span>
                                <span className="block text-[9.5px] font-mono text-slate-400 tabular-nums truncate">
                                  {formatCompactIdr(pt.totalActual)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">
                        Perbandingan &amp; Perubahan Market Share per Toko
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Garis putus-putus menandai rata-rata jaringan ({formatSharePct(marketShareData.mgStoreAnalytics.networkAvgShare)}). Klik baris toko untuk filter tabel.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                        Naik
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                        Turun
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-pink-500 inline-block" />
                        Stabil / 1 Bln
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {marketShareData.mgStoreAnalytics.allActiveStores.map((st) => {
                      const barPct =
                        mgMaxChartSharePct > 0
                          ? Math.min(100, Math.max(2, (Math.max(0, st.latestShare) / mgMaxChartSharePct) * 100))
                          : 0;
                      const avgLinePct =
                        mgMaxChartSharePct > 0
                          ? Math.min(100, Math.max(0, (marketShareData.mgStoreAnalytics.networkAvgShare / mgMaxChartSharePct) * 100))
                          : 0;
                      const isSelected = mgFilterStore.toUpperCase() === st.storeName.toUpperCase();
                      const barColor =
                        st.trend === 'up'
                          ? 'bg-emerald-500'
                          : st.trend === 'down'
                          ? 'bg-rose-500'
                          : 'bg-pink-500';

                      return (
                        <button
                          key={st.storeName}
                          type="button"
                          onClick={() =>
                            setMgFilterStore(isSelected ? 'ALL' : st.storeName)
                          }
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer border ${
                            isSelected
                              ? 'bg-pink-500/15 border-pink-500/45'
                              : 'border-[#1A2334] hover:bg-[#172033]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-extrabold text-white truncate">
                                {st.storeName}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {st.latestMonth}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 font-mono tabular-nums shrink-0">
                              {st.deltaShare !== null ? (
                                <span
                                  className={`text-[11px] font-bold ${
                                    st.trend === 'up'
                                      ? 'text-emerald-400'
                                      : st.trend === 'down'
                                      ? 'text-rose-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {st.trend === 'up'
                                    ? `▲ +${st.deltaShare.toFixed(1).replace('.', ',')}%`
                                    : st.trend === 'down'
                                    ? `▼ ${st.deltaShare.toFixed(1).replace('.', ',')}%`
                                    : 'Stabil (0,0%)'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500">1 Bulan</span>
                              )}
                              <span className="font-extrabold text-[#00D2FF] min-w-[52px] text-right">
                                {formatSharePct(st.latestShare)}
                              </span>
                            </div>
                          </div>

                          <div className="relative h-2.5 w-full rounded-full bg-[#1B2436] overflow-visible">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${barPct}%` }}
                            />
                            {marketShareData.mgStoreAnalytics.networkAvgShare > 0 && (
                              <div
                                title={`Rata-rata: ${formatSharePct(marketShareData.mgStoreAnalytics.networkAvgShare)}`}
                                className="absolute top-[-3px] bottom-[-3px] w-0.5 border-l-2 border-dashed border-cyan-300/80 pointer-events-none"
                                style={{ left: `${avgLinePct}%` }}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0F1623] flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">
                    Analisa Perubahan &amp; Potensi Market Share Toko MissGlam
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pemetaan otomatis cabang yang mengalami peningkatan, penurunan antar bulan, serta peluang terbesar untuk ditingkatkan.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-300 tabular-nums">
                  Rata-rata jaringan:{' '}
                  <strong className="text-[#00D2FF]">
                    {formatSharePct(marketShareData.mgStoreAnalytics.networkAvgShare)}
                  </strong>
                  {marketShareData.mgStoreAnalytics.topStoreName && (
                    <>
                      <span className="mx-1.5 text-slate-600">·</span>
                      Tertinggi:{' '}
                      <strong className="text-emerald-400">
                        {marketShareData.mgStoreAnalytics.topStoreName} (
                        {formatSharePct(marketShareData.mgStoreAnalytics.topShare)})
                      </strong>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#1E293B]">
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h4 className="text-xs font-extrabold text-white">
                        Toko Mengalami Peningkatan
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                      {marketShareData.mgStoreAnalytics.increasingStores.length} Toko
                    </span>
                  </div>

                  {marketShareData.mgStoreAnalytics.increasingStores.length === 0 ? (
                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      {marketShareData.mgStoreAnalytics.allActiveStores.some((s) => s.monthsCount >= 2)
                        ? 'Belum ada toko yang mencatat kenaikan market share dibanding bulan sebelumnya.'
                        : 'Perbandingan kenaikan akan otomatis tampil setelah minimal 2 bulan data diinput untuk toko yang sama.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-[#1A2334] max-h-[300px] overflow-y-auto pr-1">
                      {marketShareData.mgStoreAnalytics.increasingStores.map((st) => {
                        const isSelected = mgFilterStore.toUpperCase() === st.storeName.toUpperCase();
                        return (
                          <button
                            key={st.storeName}
                            type="button"
                            onClick={() =>
                              setMgFilterStore(isSelected ? 'ALL' : st.storeName)
                            }
                            className={`w-full text-left py-2.5 first:pt-1 last:pb-0 rounded-md px-1.5 transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-500/15' : 'hover:bg-[#172033]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-extrabold text-white">
                                {st.storeName}
                              </span>
                              <span className="font-mono font-extrabold text-emerald-400 tabular-nums">
                                ▲ +{st.deltaShare?.toFixed(1).replace('.', ',')}%
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 tabular-nums mt-0.5">
                              {st.prevMonth}: {formatSharePct(st.prevShare ?? 0)} → {st.latestMonth}:{' '}
                              <strong className="text-white">
                                {formatSharePct(st.latestShare)}
                              </strong>
                            </div>
                            {st.deltaActual !== null && (
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                Actual {st.deltaActual >= 0 ? '+' : ''}
                                {formatCompactIdr(st.deltaActual)} vs bulan lalu
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                      <h4 className="text-xs font-extrabold text-white">
                        Toko Mengalami Penurunan
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-rose-400 tabular-nums">
                      {marketShareData.mgStoreAnalytics.decreasingStores.length} Toko
                    </span>
                  </div>

                  {marketShareData.mgStoreAnalytics.decreasingStores.length === 0 ? (
                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      {marketShareData.mgStoreAnalytics.allActiveStores.some((s) => s.monthsCount >= 2)
                        ? 'Tidak ada toko yang mengalami penurunan market share pada periode terbaru.'
                        : 'Perbandingan penurunan akan otomatis tampil setelah minimal 2 bulan data diinput untuk toko yang sama.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-[#1A2334] max-h-[300px] overflow-y-auto pr-1">
                      {marketShareData.mgStoreAnalytics.decreasingStores.map((st) => {
                        const isSelected = mgFilterStore.toUpperCase() === st.storeName.toUpperCase();
                        return (
                          <button
                            key={st.storeName}
                            type="button"
                            onClick={() =>
                              setMgFilterStore(isSelected ? 'ALL' : st.storeName)
                            }
                            className={`w-full text-left py-2.5 first:pt-1 last:pb-0 rounded-md px-1.5 transition-colors cursor-pointer ${
                              isSelected ? 'bg-rose-500/15' : 'hover:bg-[#172033]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-extrabold text-white">
                                {st.storeName}
                              </span>
                              <span className="font-mono font-extrabold text-rose-400 tabular-nums">
                                ▼ {st.deltaShare?.toFixed(1).replace('.', ',')}%
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 tabular-nums mt-0.5">
                              {st.prevMonth}: {formatSharePct(st.prevShare ?? 0)} → {st.latestMonth}:{' '}
                              <strong className="text-white">
                                {formatSharePct(st.latestShare)}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                              Puncak: {formatSharePct(st.peakShare)} ({st.peakMonth})
                              {st.deltaActual !== null
                                ? ` · Actual ${st.deltaActual >= 0 ? '+' : ''}${formatCompactIdr(st.deltaActual)}`
                                : ''}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-pink-400 shrink-0" />
                      <h4 className="text-xs font-extrabold text-white">
                        Toko Berpotensi Ditingkatkan
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-pink-400 tabular-nums">
                      {marketShareData.mgStoreAnalytics.potentialStores.length} Toko
                    </span>
                  </div>

                  {marketShareData.mgStoreAnalytics.potentialStores.length === 0 ? (
                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      Semua toko aktif telah mencapai performa optimal terhadap tolok ukur saat ini.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#1A2334] max-h-[300px] overflow-y-auto pr-1">
                      {marketShareData.mgStoreAnalytics.potentialStores.map((st) => {
                        const isSelected = mgFilterStore.toUpperCase() === st.storeName.toUpperCase();
                        return (
                          <button
                            key={st.storeName}
                            type="button"
                            onClick={() =>
                              setMgFilterStore(isSelected ? 'ALL' : st.storeName)
                            }
                            className={`w-full text-left py-2.5 first:pt-1 last:pb-0 rounded-md px-1.5 transition-colors cursor-pointer ${
                              isSelected ? 'bg-pink-500/15' : 'hover:bg-[#172033]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-extrabold text-white">
                                {st.storeName}
                              </span>
                              <span className="font-mono font-extrabold text-pink-400 tabular-nums">
                                {st.upsideActualRp > 0
                                  ? `+${formatCompactIdr(st.upsideActualRp)}`
                                  : `Target ${formatSharePct(st.targetBenchmarkShare)}`}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 tabular-nums mt-0.5">
                              Share {formatSharePct(st.latestShare)} → Target{' '}
                              {formatSharePct(st.targetBenchmarkShare)} · Omset{' '}
                              {formatCompactIdr(st.latestOmset)}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              {st.potentialReason}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white">
                Grafik &amp; Analisa Market Share Belum Tersedia
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Input minimal 1 data toko MissGlam terlebih dahulu untuk menampilkan Grafik Pergerakan, Perbandingan Toko, serta Analisa Perubahan &amp; Potensi Market Share.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMarketShareMg}
              className="px-3.5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Input Data Market Share MG
            </button>
          </div>
        )}

        <div className="bg-[#121926] border border-[#1F293B] rounded-xl p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Rekap Market Share Per Toko
              </h3>
              {mgFilterMonth !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10.5px] font-bold">
                  Bulan: {mgFilterMonth}
                </span>
              )}
              {mgFilterStore !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-pink-500/15 border border-pink-500/40 text-pink-300 text-[10.5px] font-bold">
                  Toko: {mgFilterStore}
                </span>
              )}
            </div>
            {(mgFilterMonth !== 'ALL' || mgFilterStore !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setMgFilterMonth('ALL');
                  setMgFilterStore('ALL');
                }}
                className="text-[11px] font-bold text-slate-300 hover:text-white underline cursor-pointer"
              >
                Tampilkan Semua Data
              </button>
            )}
          </div>
          <div className="overflow-auto max-h-[420px]">
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
                {filteredMgPerStoreRecap.map((row) => (
                  <tr key={row.storeName} className="hover:bg-[#172033]">
                    <td className="py-2 pr-2 font-sans font-bold text-white whitespace-nowrap">{row.storeName}</td>
                    <td className="py-2 px-2 text-right text-[#FF6B00] font-bold whitespace-nowrap">{formatRupiah(row.totalActual)}</td>
                    <td className="py-2 px-2 text-right text-slate-300 whitespace-nowrap">{formatRupiah(row.totalStoreOmset)}</td>
                    <td className="py-2 px-2 text-right font-black text-[#00D2FF] whitespace-nowrap">
                      {formatSharePct(row.marketSharePercent)}
                    </td>
                    <td className="py-2 pl-2 text-center text-slate-400 whitespace-nowrap">{row.monthsCount} bln</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
);
