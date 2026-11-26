import React, { useDeferredValue, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Crown, Edit3, Medal, Search, X } from 'lucide-react';
import {
  ActiveTab,
  BaQuarterlySummaryItem,
  DashboardFilters,
  QuarterPeriodKey,
  SalesQuarterlySummaryItem,
  TrainerQuarterlySummaryItem,
} from '../types/dashboard';
import { SALES_MASTER_6_CONFIG } from '../services/kpiSalesData';
import {
  calculateQuarterlySummary,
  saveQuarterlyTargetOverride,
} from '../services/quarterlySummaryService';
import { syncQuarterBaSellInToStores } from '../services/targetManagementService';
import { formatPercent, formatRupiah } from '../utils/analytics';

interface AchieveQuartalDashboardPanelProps {
  rawQuarter: ReturnType<typeof calculateQuarterlySummary>;
  filters: DashboardFilters;
  selectedQuarter: QuarterPeriodKey;
  onSelectQuarter: (q: QuarterPeriodKey) => void;
  selectedYear: number;
  onNavigateTab: (tab: ActiveTab) => void;
  onTargetsUpdated: () => void;
}

export const AchieveQuartalDashboardPanel: React.FC<AchieveQuartalDashboardPanelProps> = React.memo(
  ({
    rawQuarter,
    filters,
    selectedQuarter,
    onSelectQuarter,
    selectedYear,
    onNavigateTab,
    onTargetsUpdated,
  }) => {
    const [hallOfFameTab, setHallOfFameTab] = useState<'sales' | 'ba' | 'trainer'>('sales');
    const [quartalSearch, setQuartalSearch] = useState<string>('');
    const deferredQuartalSearch = useDeferredValue(quartalSearch);
    const [editingBaSellInName, setEditingBaSellInName] = useState<string | null>(null);
    const [editingBaSellInDraft, setEditingBaSellInDraft] = useState<string>('');

    const achieveQuartalData = useMemo(() => {
      const activeKet = (filters.KET || 'ALL').toUpperCase().trim();
      const effSearch = (deferredQuartalSearch || filters.searchQuery || '').trim().toLowerCase();

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
          if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL') {
            const targetStore = filters.NAMA_STORE.toUpperCase().trim();
            const storeTokens = (b.storeName || '')
              .split(',')
              .map((t) => t.trim().toUpperCase())
              .filter(Boolean);
            if ((b.storeName || '').toUpperCase().trim() !== targetStore && !storeTokens.includes(targetStore)) {
              return false;
            }
          }
          if (filters.REGION && filters.REGION !== 'ALL') {
            const targetReg = filters.REGION.toUpperCase().trim();
            const regionMatch = (b.region || '').toUpperCase().trim() === targetReg;
            const areaTokens = (b.coverArea || '')
              .split(',')
              .map((t) => t.trim().toUpperCase())
              .filter(Boolean);
            if (!regionMatch && (b.coverArea || '').toUpperCase().trim() !== targetReg && !areaTokens.includes(targetReg)) {
              return false;
            }
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
    }, [rawQuarter, filters, deferredQuartalSearch]);

    const handleSaveBaSellInTarget = (baName: string) => {
      const rawDigits = editingBaSellInDraft.replace(/[^\d]/g, '');
      const parsedVal = Number(rawDigits);
      if (!Number.isFinite(parsedVal) || rawDigits === '') {
        setEditingBaSellInName(null);
        return;
      }
      const cleanTarget = Math.max(0, Math.round(parsedVal));
      const baItem = achieveQuartalData.filteredBa.find(
        (b) => b.baName.toLowerCase() === baName.toLowerCase()
      );
      const syncedToStores = syncQuarterBaSellInToStores({
        year: selectedYear,
        quarter: selectedQuarter,
        baName,
        storeName: baItem?.storeName || '',
        quarterTargetSellIn: cleanTarget,
        monthlyBreakdown: baItem?.monthlyBreakdown,
      });
      if (!syncedToStores) {
        saveQuarterlyTargetOverride(selectedYear, selectedQuarter, 'ba', baName, {
          targetSellIn: cleanTarget,
        });
      }
      setEditingBaSellInName(null);
      onTargetsUpdated();
    };

    return (
      <div className="flex-1 flex flex-col gap-3">
        <div className="bg-gradient-to-r from-[#0E1525] via-[#171E38] to-[#0E1525] text-white rounded-2xl p-4 sm:p-5 border border-[#24314D] shadow-lg">
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
                    onClick={() => onSelectQuarter(q)}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
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
                  {hallOfFameTab === 'ba' && (achieveQuartalData.isKetSellIn || !achieveQuartalData.isKetSellOut) && (
                    <span className="text-amber-300 font-semibold">
                      {' '}· Klik nilai Target Sell In pada Nama BA &amp; Toko untuk edit langsung
                    </span>
                  )}
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
                      onClick={() => {
                        setEditingBaSellInName(null);
                        setHallOfFameTab(tab.id);
                      }}
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

            <div className="bg-[#090E1A]/80 border border-white/10 rounded-xl overflow-x-auto max-h-[540px] overflow-y-auto">
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
                        <th className="py-2.5 px-3 text-right">
                          Target Sell In
                          {hallOfFameTab === 'ba' && (
                            <span className="ml-1 text-[9px] font-semibold text-amber-300 normal-case">
                              (Edit)
                            </span>
                          )}
                        </th>
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
                      achieveQuartalData.filteredBa.map((b, idx) => {
                        const isEditingTarget = editingBaSellInName === b.baName;
                        return (
                          <tr key={`${b.baName}-${b.storeName}`} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                            <td className="py-2 px-3 font-sans max-w-[260px]">
                              <span className="font-bold text-white block">{b.baName}</span>
                              <span className="text-[10px] text-slate-400 leading-snug block">{b.storeName}</span>
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-400">{b.coverArea}</td>
                            {(achieveQuartalData.isKetSellIn || !achieveQuartalData.isKetSellOut) && (
                              <>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  {isEditingTarget ? (
                                    <div className="inline-flex items-center justify-end gap-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        autoFocus
                                        value={editingBaSellInDraft}
                                        onChange={(e) => setEditingBaSellInDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveBaSellInTarget(b.baName);
                                          if (e.key === 'Escape') setEditingBaSellInName(null);
                                        }}
                                        className="w-28 px-2 py-1 rounded bg-[#0B101C] border border-amber-400 text-right text-xs font-mono font-bold text-white outline-none"
                                        placeholder="Nominal Rp"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveBaSellInTarget(b.baName)}
                                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                        title="Simpan Target Sell In"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingBaSellInName(null)}
                                        className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
                                        title="Batal"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingBaSellInName(b.baName);
                                        setEditingBaSellInDraft(String(Math.round(b.quarterTargetSellIn || 0)));
                                      }}
                                      title="Klik untuk edit Target Sell In BA & Toko ini"
                                      className="inline-flex items-center gap-1.5 text-slate-200 hover:text-amber-300 border-b border-dashed border-slate-500 hover:border-amber-400 pb-0.5 cursor-pointer transition-colors group"
                                    >
                                      <span className={b.isCustomQuarterTarget ? 'text-amber-300 font-bold' : ''}>
                                        {formatRupiah(b.quarterTargetSellIn, true)}
                                      </span>
                                      <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-amber-300 shrink-0" />
                                    </button>
                                  )}
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
                                  <span className="block">{formatRupiah(b.quarterTargetSellOut, true)}</span>
                                  <span className="text-[9.5px] text-slate-400 font-sans block">
                                    NL: {formatRupiah(b.quarterTargetNonLavojoy ?? 0, true)} • Lav: {formatRupiah(b.quarterTargetLavojoy ?? 0, true)}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-300">
                                  <span className="block">{formatRupiah(b.quarterActualSellOut, true)}</span>
                                  <span className="text-[9.5px] text-slate-400 font-sans font-normal block">
                                    NL: {formatRupiah(b.quarterActualNonLavojoy ?? 0, true)} • Lav: {formatRupiah(b.quarterActualLavojoy ?? 0, true)} • Fokus: {b.focusActualPcs}/{b.focusTargetPcs} pcs
                                  </span>
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
                        );
                      })
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
    );
  }
);
