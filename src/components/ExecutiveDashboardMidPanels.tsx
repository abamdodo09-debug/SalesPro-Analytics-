import React from 'react';
import { AlertTriangle, ArrowUpRight, ChevronRight, Edit3 } from 'lucide-react';
import { ActiveTab } from '../types/dashboard';
import {
  ExecutiveCoreSnapshot,
  ProductMixLensData,
  TargetsAlertsLensData,
  buildChannelGrowthLensData,
} from '../services/executiveDashboardService';
import { formatNumber, formatRupiah } from '../utils/analytics';
import { formatCompactIdr } from './ExecutiveDashboardWidgets';

export const ProductMixDashboardPanel: React.FC<{
  productMixData: ProductMixLensData;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(({ productMixData, onNavigateTab }) => {
  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
            Brand Kosmetik, Kategori &amp; Performa SKU
          </h2>
          <p className="text-xs text-slate-400">
            Top Kategori (Makeup, Personal Care, Skin Care, Tools, Hued), Top 10 SKU Terlaris &amp; 10 SKU Slow Moving
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateTab('brand')}
            className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#EA580C] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Buka Brand
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('category')}
            className="px-3 py-1.5 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Buka Kategori
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('sku')}
            className="px-3 py-1.5 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Buka SKU
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B] mb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#FF6B00]">
                  Top Kategori Produk ({productMixData.topCategories.length})
                </h3>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  MAKEUP · PERSONAL CARE · SKIN CARE · TOOLS · HUED
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {productMixData.topCategories.map((cat) => {
                const barGradient =
                  cat.category === 'MAKEUP'
                    ? 'from-[#EA580C] to-[#FF8533]'
                    : cat.category === 'PERSONAL CARE'
                    ? 'from-emerald-600 to-emerald-400'
                    : cat.category === 'SKIN CARE'
                    ? 'from-cyan-600 to-[#00D2FF]'
                    : cat.category === 'TOOLS'
                    ? 'from-violet-600 to-purple-400'
                    : 'from-pink-600 to-rose-400';

                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                      <div className="min-w-0">
                        <span className="font-sans font-extrabold text-white tracking-wide">
                          {cat.category}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          · {formatNumber(cat.totalQty)} pcs
                        </span>
                      </div>
                      <span className="text-cyan-400 font-bold whitespace-nowrap shrink-0">
                        {formatRupiah(cat.totalValue)}{' '}
                        <span className="text-slate-300">({cat.contributionPercent.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#1B2436] rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-300`}
                        style={{
                          width: `${
                            cat.totalValue > 0
                              ? Math.min(100, Math.max(3, cat.contributionPercent))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-[#1E293B] flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
            <span className="font-sans font-bold text-slate-400">
              Total 5 Kategori Utama
            </span>
            <span className="font-black text-[#FF6B00] whitespace-nowrap">
              {formatRupiah(
                productMixData.topCategories.reduce((sum, c) => sum + c.totalValue, 0)
              )}{' '}
              ·{' '}
              {formatNumber(
                productMixData.topCategories.reduce((sum, c) => sum + c.totalQty, 0)
              )}{' '}
              pcs
            </span>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#121926] border border-[#1F293B] rounded-xl p-3.5 overflow-auto max-h-[430px]">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E293B] mb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#00D2FF]">
              Top 10 SKU Terlaris
            </h3>
            <span className="text-[10.5px] font-mono text-slate-400">
              Urutan Omset Tertinggi
            </span>
          </div>
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-[#121926] z-10">
              <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                <th className="py-2 pr-2 text-center w-7">No</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">Qty</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">Omset</th>
                <th className="py-2 pl-2 text-right whitespace-nowrap">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
              {productMixData.topSkus.slice(0, 10).map((sku, idx) => (
                <tr key={sku.name} className="hover:bg-[#172033] transition-colors">
                  <td className="py-2 pr-2 text-center text-slate-500 font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-2 pr-2 font-sans font-semibold text-white whitespace-normal break-words leading-snug">
                    {sku.name}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-300 whitespace-nowrap">
                    {formatNumber(sku.totalQty)}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-[#FF6B00] whitespace-nowrap">
                    {formatRupiah(sku.totalValue)}
                  </td>
                  <td className="py-2 pl-2 text-right text-emerald-400 font-bold whitespace-nowrap">
                    {sku.contributionPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {productMixData.topSkus.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center font-sans text-slate-400">
                    Belum ada data SKU pada filter aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-full bg-[#121926] border border-[#1F293B] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0E1523] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>10 SKU Slow Moving</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar 10 SKU aktif dengan perputaran Qty &amp; Omset terendah pada filter periode aktif untuk evaluasi promo atau stok
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-300 tabular-nums whitespace-nowrap">
            Total 10 SKU:{' '}
            {formatNumber(
              productMixData.slowMovingSkus.reduce((s, r) => s + r.totalQty, 0)
            )}{' '}
            pcs ·{' '}
            <span className="text-amber-400">
              {formatRupiah(
                productMixData.slowMovingSkus.reduce((s, r) => s + r.totalValue, 0)
              )}
            </span>
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#0B101A]">
              <tr className="text-[10px] uppercase text-slate-400 border-b border-[#1E293B]">
                <th className="py-2.5 px-3 text-center w-10">No</th>
                <th className="py-2.5 px-3">Nama SKU</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Brand</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Kategori</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Qty (Pcs)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Tx / Toko</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Omset</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2334] font-mono tabular-nums">
              {productMixData.slowMovingSkus.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-sans text-slate-400">
                    Belum ada data SKU slow moving pada filter yang dipilih.
                  </td>
                </tr>
              ) : (
                productMixData.slowMovingSkus.map((sku, idx) => (
                  <tr key={sku.name} className="hover:bg-[#172033] transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-amber-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-white whitespace-normal break-words leading-snug">
                      {sku.name}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-200 whitespace-nowrap">
                      {sku.brand}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-cyan-300 whitespace-nowrap">
                      {sku.category}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-amber-400 whitespace-nowrap">
                      {formatNumber(sku.totalQty)} pcs
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">
                      {sku.transactionCount} tx · {sku.storeCount} toko
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-200 whitespace-nowrap">
                      {formatRupiah(sku.totalValue)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400 whitespace-nowrap">
                      {sku.contributionPercent.toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const ChannelGrowthDashboardPanel: React.FC<{
  channelGrowthRows: ReturnType<typeof buildChannelGrowthLensData>;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(({ channelGrowthRows, onNavigateTab }) => {
  return (
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
  );
});

export const TargetsAlertsHeaderCards: React.FC<{
  targetGapSummary: ExecutiveCoreSnapshot['targetGapSummary'];
  lostStoresCount: number;
  registeredSheetBaCount: number;
  registeredSheetTrainerCount: number;
  productStatusSummary: TargetsAlertsLensData['productStatusSummary'];
  ketFilter: string;
  onNavigateTab: (tab: ActiveTab) => void;
}> = React.memo(
  ({
    targetGapSummary,
    lostStoresCount,
    registeredSheetBaCount,
    registeredSheetTrainerCount,
    productStatusSummary,
    ketFilter,
    onNavigateTab,
  }) => {
    return (
      <>
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
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-sans font-bold uppercase text-slate-400">
                    Defisit Gap Target
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-sans font-bold border whitespace-nowrap ${
                      targetGapSummary.mode === 'spv'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : targetGapSummary.mode === 'store'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    }`}
                  >
                    {targetGapSummary.mode === 'spv'
                      ? 'Target ALL (SPV)'
                      : targetGapSummary.mode === 'store'
                      ? 'Target Toko'
                      : 'Target Sales'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('target_mgmt')}
                  title="Edit Target SPV & Sales di Menu Kelola Target"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-sans font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Edit</span>
                </button>
              </div>

              {targetGapSummary.activeTarget <= 0 ? (
                <span className="text-base xl:text-lg font-black text-slate-400 mt-1 block whitespace-nowrap">
                  Rp 0
                </span>
              ) : targetGapSummary.deficitAmount > 0 ? (
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span className="text-base xl:text-lg font-black text-rose-400 whitespace-nowrap">
                    -{formatRupiah(targetGapSummary.deficitAmount)}
                  </span>
                  <span className="text-[10.5px] font-bold text-rose-300 whitespace-nowrap">
                    (-{targetGapSummary.gapPercentage.toFixed(1)}%)
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span className="text-base xl:text-lg font-black text-emerald-400 whitespace-nowrap">
                    +{formatRupiah(targetGapSummary.surplusAmount)}
                  </span>
                  <span className="text-[10.5px] font-bold text-emerald-300 whitespace-nowrap">
                    (Target Tercapai)
                  </span>
                </div>
              )}

              <div className="mt-1.5 space-y-0.5 text-[11px] bg-[#0D131F] border border-[#1B2538] rounded-lg px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-slate-400 truncate" title={targetGapSummary.scopeLabel}>
                    {targetGapSummary.scopeLabel}
                  </span>
                  <span className="font-bold text-white whitespace-nowrap">
                    {formatRupiah(targetGapSummary.activeTarget)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-slate-400">
                    Realisasi {targetGapSummary.activeMetricLabel} ({targetGapSummary.achievementPct.toFixed(1)}%)
                  </span>
                  <span className="font-bold text-[#00D2FF] whitespace-nowrap">
                    {formatRupiah(targetGapSummary.activeActual)}
                  </span>
                </div>
                {(targetGapSummary.kaMgSellInActual || 0) > 0 &&
                  targetGapSummary.activeMetricLabel === 'Sell In' && (
                    <div className="flex items-center justify-between gap-2 text-[10px] text-cyan-300/90">
                      <span className="font-sans">Komposisi Sell In SPV:</span>
                      <span className="whitespace-nowrap">
                        Reg {formatCompactIdr(targetGapSummary.regularSellInActual ?? 0)} + KA &amp; MG{' '}
                        {formatCompactIdr(targetGapSummary.kaMgSellInActual ?? 0)}
                      </span>
                    </div>
                  )}
                {ketFilter === 'ALL' && targetGapSummary.targetSellOut > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-[#182234] text-[10px]">
                    <span className="font-sans text-slate-400">
                      Target Sell Out ({targetGapSummary.sellOutDeficitAmount > 0 ? `Defisit -${formatCompactIdr(targetGapSummary.sellOutDeficitAmount)}` : `Surplus +${formatCompactIdr(targetGapSummary.sellOutSurplusAmount)}`})
                    </span>
                    <span className="text-slate-300 whitespace-nowrap">
                      {formatCompactIdr(targetGapSummary.actualSellOut)} / {formatCompactIdr(targetGapSummary.targetSellOut)}
                    </span>
                  </div>
                )}
              </div>

              <span className="text-[10.5px] text-slate-400 mt-1.5 block whitespace-nowrap">
                {lostStoresCount} Toko Pasif · Sumber: Kelola Target
              </span>
            </div>
            <div className="pt-2 border-t border-[#1F293B] flex flex-wrap items-center gap-1.5 font-sans">
              <button
                type="button"
                onClick={() => onNavigateTab('target_mgmt')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 text-[#FFB067] border border-[#FF6B00]/30 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <span>Edit Target di Kelola Target</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('gap')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-[11px] font-bold transition-colors cursor-pointer"
              >
                <span>Analisa Gap</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="bg-[#121926] border border-[#1F293B] hover:border-[#FF6B00]/40 transition-colors rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-sans font-bold uppercase text-slate-400">Total BA Terdaftar</span>
              </div>
              <span className="text-base xl:text-lg font-black text-[#FF6B00] mt-1 block whitespace-nowrap">{registeredSheetBaCount} BA</span>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">{registeredSheetTrainerCount} Trainer Aktif (Google Sheet)</span>
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
                onClick={() => onNavigateTab('info_keaktifan')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#192234] hover:bg-[#233049] text-slate-200 border border-[#2A3952] text-[11px] font-bold transition-colors cursor-pointer"
              >
                <span>Info Keaktifan SDM</span>
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
              <span className="text-base xl:text-lg font-black text-[#00D2FF] mt-1 block whitespace-nowrap">{productStatusSummary.totalSkuCount} SKU</span>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">Clearance/Risk: {productStatusSummary.clearanceObsoleteShare.toFixed(1)}%</span>
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
      </>
    );
  }
);
