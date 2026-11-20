import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Users,
  Building2,
  Store,
  CalendarDays,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  Flame,
  Package,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Info,
  GraduationCap,
  RotateCcw,
} from 'lucide-react';
import { ComparisonMode, TransactionRecord, DashboardFilters, EntityProductAnalysisItem } from '../types/dashboard';
import { calculateComparisonGrowth, formatRupiah, formatNumber, formatPercent } from '../utils/analytics';

interface ComparisonViewProps {
  records: TransactionRecord[];
  allRecords: TransactionRecord[];
  filters: DashboardFilters;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  records,
  allRecords,
  filters,
}) => {
  const [compMode, setCompMode] = useState<ComparisonMode>('mom');
  const [dimensionTab, setDimensionTab] = useState<'brand' | 'sales' | 'spv' | 'store' | 'category' | 'trainer'>('brand');
  const [viewFilter, setViewFilter] = useState<'all' | 'focus' | 'new'>('all');
  const [ketOverride, setKetOverride] = useState<'INHERIT' | 'ALL' | 'SELL IN' | 'SELL OUT'>('INHERIT');
  const [startDay, setStartDay] = useState<string>('');
  const [endDay, setEndDay] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'previous' | 'current' | 'growth' | 'focusPrev' | 'focusVal' | 'focusGrowth' | 'newPrev' | 'newVal' | 'newGrowth'
  >('current');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  useEffect(() => {
    setKetOverride('INHERIT');
  }, [filters.KET]);

  const activeKet = ketOverride === 'INHERIT' ? (filters.KET || 'ALL') : ketOverride;
  const effectiveFilters = useMemo<DashboardFilters>(
    () => ({ ...filters, KET: activeKet }),
    [filters, activeKet]
  );

  const dayRange = useMemo(
    () =>
      startDay || endDay
        ? {
            startDay: startDay ? Number(startDay) : undefined,
            endDay: endDay ? Number(endDay) : undefined,
          }
        : undefined,
    [startDay, endDay]
  );

  const comparison = calculateComparisonGrowth(
    allRecords && allRecords.length > 0 ? allRecords : records,
    compMode,
    effectiveFilters,
    dayRange
  );
  const { overall, currentPeriodLabel, previousPeriodLabel, focusSummary, newSummary } = comparison;

  const isPos = overall.growthPercent >= 0;
  const isFocusPos = focusSummary.growth >= 0;
  const isNewPos = newSummary.growth >= 0;

  // Active dimension items
  const rawDimensionItems = useMemo(() => {
    switch (dimensionTab) {
      case 'brand':
        return comparison.byBrand;
      case 'sales':
        return comparison.bySales;
      case 'spv':
        return comparison.bySpv;
      case 'store':
        return comparison.byStore;
      case 'category':
        return comparison.byCategory;
      case 'trainer':
        return comparison.byTrainer || [];
      default:
        return comparison.byBrand;
    }
  }, [dimensionTab, comparison]);

  // Filter & Sort dimension items
  const dimensionItems = useMemo(() => {
    let items = rawDimensionItems.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

    items.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortBy) {
        case 'previous':
          valA = a.previous;
          valB = b.previous;
          break;
        case 'current':
          valA = a.current;
          valB = b.current;
          break;
        case 'growth':
          valA = a.growth;
          valB = b.growth;
          break;
        case 'focusPrev':
          valA = a.previousFocus;
          valB = b.previousFocus;
          break;
        case 'focusVal':
          valA = a.currentFocus;
          valB = b.currentFocus;
          break;
        case 'focusGrowth':
          valA = a.focusGrowth;
          valB = b.focusGrowth;
          break;
        case 'newPrev':
          valA = a.previousNew;
          valB = b.previousNew;
          break;
        case 'newVal':
          valA = a.currentNew;
          valB = b.currentNew;
          break;
        case 'newGrowth':
          valA = a.newGrowth;
          valB = b.newGrowth;
          break;
      }

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return items;
  }, [rawDimensionItems, searchQuery, sortBy, sortOrder]);

  const tableColSpan =
    1 +
    3 +
    (viewFilter === 'all' || viewFilter === 'focus' ? 4 : 0) +
    (viewFilter === 'all' || viewFilter === 'new' ? 4 : 0) +
    2;

  const maxVal = Math.max(
    ...rawDimensionItems.map((d) => Math.max(d.current, d.previous)),
    1
  );

  const toggleSort = (newSort: typeof sortBy) => {
    if (sortBy === newSort) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(newSort);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6 mb-8">
      {/* Header & Comparison Mode Switcher */}
      <div className="bg-gradient-to-r from-white via-blue-50/20 to-teal-50/20 rounded-2xl border border-blue-200/80 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-blue-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900">
                Analisa Perbandingan Periode & Pertumbuhan
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Analisa pertumbuhan penjualan, penetrasi produk fokus, dan performa produk new secara komprehensif
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setCompMode('wow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                compMode === 'wow'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              WoW <span className="hidden sm:inline font-normal text-[11px]">(Week vs Week)</span>
            </button>
            <button
              onClick={() => setCompMode('mom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                compMode === 'mom'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              MoM <span className="hidden sm:inline font-normal text-[11px]">(Month vs Month)</span>
            </button>
            <button
              onClick={() => setCompMode('yoy')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                compMode === 'yoy'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              YoY <span className="hidden sm:inline font-normal text-[11px]">(Year vs Year)</span>
            </button>
          </div>
        </div>

        {/* Top 4 Overall KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* Card 1: Periode Sekarang */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:-translate-y-0.5 transition-all">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Periode Sekarang ({currentPeriodLabel})
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums">
              {formatRupiah(overall.currentValue)}
            </div>
            <span className="text-xs font-semibold text-slate-500 mt-2 block">
              Volume: {formatNumber(overall.currentQty)} pcs
            </span>
          </div>

          {/* Card 2: Periode Sebelumnya */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:-translate-y-0.5 transition-all">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Periode Sebelumnya ({previousPeriodLabel})
            </span>
            <div className="text-2xl font-black text-slate-700 font-mono tabular-nums">
              {formatRupiah(overall.previousValue)}
            </div>
            <span className="text-xs font-semibold text-slate-500 mt-2 block">
              Volume: {formatNumber(overall.previousQty)} pcs
            </span>
          </div>

          {/* Card 3: Selisih Nominal (Delta) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:-translate-y-0.5 transition-all">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Selisih Nominal (Delta)
            </span>
            <div
              className={`text-2xl font-black font-mono tabular-nums ${
                isPos ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isPos ? '+ ' : ''}
              {formatRupiah(overall.deltaValue)}
            </div>
            <span className="text-xs font-semibold text-slate-500 mt-2 block">
              Selisih Unit: {overall.currentQty - overall.previousQty >= 0 ? '+' : ''}
              {formatNumber(overall.currentQty - overall.previousQty)} pcs
            </span>
          </div>

          {/* Card 4: Persentase Pertumbuhan (Growth %) */}
          <div
            className={`p-4 rounded-xl border shadow-sm border-t-4 flex flex-col justify-between hover:-translate-y-0.5 transition-all ${
              isPos
                ? 'bg-gradient-to-br from-white via-emerald-50 to-teal-100/50 border-emerald-300 border-t-emerald-600'
                : 'bg-gradient-to-br from-white via-rose-50 to-red-100/50 border-rose-300 border-t-rose-600'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider block mb-1 text-slate-700">
                Tingkat Pertumbuhan Total
              </span>
              <div
                className={`text-3xl font-black font-mono tabular-nums flex items-center gap-1.5 ${
                  isPos ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isPos ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
                {formatPercent(overall.growthPercent)}
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-600 mt-2 block">
              {compMode.toUpperCase()}: {currentPeriodLabel} vs {previousPeriodLabel}
            </span>
          </div>
        </div>
      </div>

      {/* HIGHLIGHT PERFORMA PRODUK FOKUS & PRODUK NEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Highlight Card 1: PRODUK FOKUS */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white rounded-2xl border-2 border-amber-300/80 p-5 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/30 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl shadow-xs">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-1.5">
                  Performa Produk Fokus (Focus Product)
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/90 text-amber-900 border border-amber-300">
                    Prioritas Utama
                  </span>
                </h3>
                <p className="text-[11px] text-amber-800 font-medium">
                  SKU andalan target pertumbuhan penjualan
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                isFocusPos
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {isFocusPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {formatPercent(focusSummary.growth)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-amber-200/60 relative z-10">
            <div>
              <span className="text-[10px] font-bold text-amber-900/80 uppercase block">Periode Ini</span>
              <span className="text-sm sm:text-base font-black text-amber-950 font-mono tabular-nums block">
                {formatRupiah(focusSummary.current, true)}
              </span>
              <span className="text-[10px] text-amber-800/90 font-medium">
                {formatNumber(focusSummary.currentQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-900/80 uppercase block">Sebelumnya</span>
              <span className="text-sm sm:text-base font-bold text-slate-600 font-mono tabular-nums block">
                {formatRupiah(focusSummary.previous, true)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {formatNumber(focusSummary.previousQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-900/80 uppercase block">Penetrasi Omset</span>
              <span className="text-sm sm:text-base font-black text-amber-900 font-mono tabular-nums block">
                {formatPercent(focusSummary.shareCurrent)}
              </span>
              <span className="text-[10px] text-amber-800 font-medium">
                Prev: {formatPercent(focusSummary.sharePrevious)}
              </span>
            </div>
          </div>

          {/* Mini progress bar of focus share */}
          <div className="mt-3 relative z-10">
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-900 mb-1">
              <span>Share Produk Fokus terhadap Total Omset</span>
              <span className="font-mono">{formatPercent(focusSummary.shareCurrent)}</span>
            </div>
            <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden border border-amber-200 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(3, focusSummary.shareCurrent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Highlight Card 2: PRODUK NEW */}
        <div className="bg-gradient-to-br from-teal-500/10 via-emerald-50/50 to-white rounded-2xl border-2 border-teal-300/80 p-5 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-200/30 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-xl shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-teal-950 flex items-center gap-1.5">
                  Performa Produk Baru (New Product)
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-200/90 text-teal-900 border border-teal-300">
                    Inovasi Launching
                  </span>
                </h3>
                <p className="text-[11px] text-teal-800 font-medium">
                  Tingkat adopsi & respon pasar atas SKU baru
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                isNewPos
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {isNewPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {formatPercent(newSummary.growth)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-teal-200/60 relative z-10">
            <div>
              <span className="text-[10px] font-bold text-teal-900/80 uppercase block">Periode Ini</span>
              <span className="text-sm sm:text-base font-black text-teal-950 font-mono tabular-nums block">
                {formatRupiah(newSummary.current, true)}
              </span>
              <span className="text-[10px] text-teal-800/90 font-medium">
                {formatNumber(newSummary.currentQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-teal-900/80 uppercase block">Sebelumnya</span>
              <span className="text-sm sm:text-base font-bold text-slate-600 font-mono tabular-nums block">
                {formatRupiah(newSummary.previous, true)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {formatNumber(newSummary.previousQty)} pcs
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-teal-900/80 uppercase block">Kontribusi Launching</span>
              <span className="text-sm sm:text-base font-black text-teal-900 font-mono tabular-nums block">
                {formatPercent(newSummary.shareCurrent)}
              </span>
              <span className="text-[10px] text-teal-800 font-medium">
                Prev: {formatPercent(newSummary.sharePrevious)}
              </span>
            </div>
          </div>

          {/* Mini progress bar of new product share */}
          <div className="mt-3 relative z-10">
            <div className="flex items-center justify-between text-[11px] font-semibold text-teal-900 mb-1">
              <span>Kontribusi Produk New terhadap Total Omset</span>
              <span className="font-mono">{formatPercent(newSummary.shareCurrent)}</span>
            </div>
            <div className="h-2 w-full bg-teal-100 rounded-full overflow-hidden border border-teal-200 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(3, newSummary.shareCurrent))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* DIMENSIONAL GROWTH BREAKDOWN TABLE WITH PRODUK FOKUS & PRODUK NEW */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-extrabold text-slate-900">
                Rincian Pertumbuhan Berdasarkan Entitas
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Analisa mendalam pertumbuhan penjualan total, penetrasi Produk Fokus, dan adopsi Produk New
            </p>
          </div>

          {/* Dimension Selector Tabs (Brand, Sales, SPV, Store, Kategori) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              onClick={() => {
                setDimensionTab('brand');
                setExpandedEntity(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dimensionTab === 'brand'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Brand
            </button>
            <button
              onClick={() => {
                setDimensionTab('sales');
                setExpandedEntity(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dimensionTab === 'sales'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Sales
            </button>
            <button
              onClick={() => {
                setDimensionTab('spv');
                setExpandedEntity(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dimensionTab === 'spv'
                  ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              SPV
            </button>
            <button
              onClick={() => {
                setDimensionTab('store');
                setExpandedEntity(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dimensionTab === 'store'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Store
            </button>
            <button
              onClick={() => {
                setDimensionTab('category');
                setExpandedEntity(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dimensionTab === 'category'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Kategori
            </button>
            <button
              onClick={() => {
                setDimensionTab('trainer');
                setExpandedEntity(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dimensionTab === 'trainer'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Trainer
            </button>
          </div>
        </div>

        {/* Filter & View Mode Controls Bar */}
        <div className="flex flex-col gap-3 mt-4 pt-1">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Cari nama ${dimensionTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Filter Tanggal (1 - 31) untuk perbandingan MoM / YoY / WoW */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 whitespace-nowrap shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                Filter Tanggal:
              </span>
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Dari Tanggal"
                  title="Dari Tanggal"
                  value={startDay}
                  onChange={(e) => setStartDay(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono tabular-nums rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Tgl Awal</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>
                      Tgl {d}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 font-semibold px-0.5">s/d</span>
                <select
                  aria-label="Sampai Tanggal"
                  title="Sampai Tanggal"
                  value={endDay}
                  onChange={(e) => setEndDay(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono tabular-nums rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Tgl Akhir</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>
                      Tgl {d}
                    </option>
                  ))}
                </select>
              </div>
              {(startDay || endDay) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDay('');
                    setEndDay('');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick Ket Transaksi & Focus / New / All View Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {(['ALL', 'SELL IN', 'SELL OUT'] as const).map((kTab) => {
                const normalizedActive = (activeKet || 'ALL').trim().toUpperCase();
                const isActive =
                  kTab === 'ALL'
                    ? normalizedActive === 'ALL'
                    : normalizedActive === kTab;
                return (
                  <button
                    key={kTab}
                    type="button"
                    onClick={() => setKetOverride(kTab)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? kTab === 'SELL IN'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : kTab === 'SELL OUT'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {kTab === 'ALL' ? 'Semua Ket' : kTab}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setViewFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 ${
                  viewFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Kolom
              </button>
              <button
                onClick={() => setViewFilter('focus')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                  viewFilter === 'focus'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                <Target className="w-3 h-3" />
                Fokus Produk Fokus
              </button>
              <button
                onClick={() => setViewFilter('new')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all whitespace-nowrap shrink-0 ${
                  viewFilter === 'new'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-teal-800 hover:bg-teal-100/60'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Fokus Produk New
              </button>
            </div>
          </div>
        </div>

        {/* Legend & Active Period Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 py-2.5 px-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-700">
              Periode Sebelumnya: <strong className="text-slate-900">{previousPeriodLabel}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700">
              Periode Sekarang: <strong className="text-blue-700">{currentPeriodLabel}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 hidden sm:inline">|</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-500 to-orange-500" />
                <span className="font-semibold text-slate-700">Produk Fokus</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-teal-500 to-emerald-500" />
                <span className="font-semibold text-slate-700">Produk New</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
                <span className="font-semibold text-slate-600">Regular</span>
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-medium hidden md:inline">
            Klik baris entitas untuk detail Top SKU Fokus &amp; Produk New
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-x-auto mt-3 border border-slate-200 rounded-xl">
          <table className="w-full min-w-[1160px] text-left border-collapse text-xs">
            <thead>
              {/* Group Header Row */}
              <tr className="border-b border-slate-200 text-slate-700 font-bold bg-slate-100/90">
                <th
                  rowSpan={2}
                  className="py-2.5 px-3.5 align-middle sticky left-0 z-20 bg-slate-100 border-r border-slate-200 min-w-[180px]"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 block">
                    Nama {dimensionTab.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">
                    Jenis Transaksi &amp; Volume
                  </span>
                </th>

                <th
                  colSpan={3}
                  className="py-2 px-3 text-center bg-slate-100/90 border-r border-slate-200 text-slate-800"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-wider">
                    Total Penjualan
                  </span>
                </th>

                {(viewFilter === 'all' || viewFilter === 'focus') && (
                  <th
                    colSpan={4}
                    className="py-2 px-3 text-center bg-amber-100/80 border-r border-amber-200/80 text-amber-950"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider">
                        Produk Fokus
                      </span>
                    </div>
                  </th>
                )}

                {(viewFilter === 'all' || viewFilter === 'new') && (
                  <th
                    colSpan={4}
                    className="py-2 px-3 text-center bg-teal-100/80 border-r border-teal-200/80 text-teal-950"
                  >
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider">
                        Produk New
                      </span>
                    </div>
                  </th>
                )}

                <th
                  rowSpan={2}
                  className="py-2.5 px-3 align-middle w-40 bg-slate-100/90 border-r border-slate-200 text-slate-700"
                >
                  Komposisi &amp; Perbandingan
                </th>
                <th
                  rowSpan={2}
                  className="py-2.5 px-2.5 align-middle text-center w-14 bg-slate-100/90 text-slate-700"
                >
                  Detail
                </th>
              </tr>

              {/* Sub-Column Header Row */}
              <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50/95 text-[11px]">
                {/* Total: Periode Sebelumnya, Periode Sekarang, Total Growth */}
                <th
                  onClick={() => toggleSort('previous')}
                  className="py-2 px-2.5 text-right cursor-pointer hover:bg-slate-200/50 transition-colors whitespace-nowrap border-r border-slate-200/70"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Periode Sebelumnya</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('current')}
                  className="py-2 px-2.5 text-right cursor-pointer hover:bg-slate-200/50 transition-colors whitespace-nowrap border-r border-slate-200/70"
                >
                  <div className="flex items-center justify-end gap-1 text-slate-900">
                    <span>Periode Sekarang</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('growth')}
                  className="py-2 px-2.5 text-right cursor-pointer hover:bg-slate-200/50 transition-colors whitespace-nowrap border-r border-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Growth</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                </th>

                {/* Produk Fokus Sub-Columns */}
                {(viewFilter === 'all' || viewFilter === 'focus') && (
                  <>
                    <th
                      onClick={() => toggleSort('focusPrev')}
                      className="py-2 px-2.5 text-right bg-amber-50/80 border-r border-amber-200/60 text-amber-900 cursor-pointer hover:bg-amber-100/60 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Periode Sebelumnya</span>
                        <ArrowUpDown className="w-3 h-3 text-amber-400 shrink-0" />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('focusVal')}
                      className="py-2 px-2.5 text-right bg-amber-50/80 border-r border-amber-200/60 text-amber-950 cursor-pointer hover:bg-amber-100/60 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Periode Sekarang</span>
                        <ArrowUpDown className="w-3 h-3 text-amber-500 shrink-0" />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('focusGrowth')}
                      className="py-2 px-2.5 text-right bg-amber-50/80 border-r border-amber-200/60 text-amber-950 cursor-pointer hover:bg-amber-100/60 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Growth</span>
                        <ArrowUpDown className="w-3 h-3 text-amber-400 shrink-0" />
                      </div>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-50/80 border-r border-amber-200/80 text-amber-950 whitespace-nowrap">
                      <span>Penetrasi %</span>
                    </th>
                  </>
                )}

                {/* Produk New Sub-Columns */}
                {(viewFilter === 'all' || viewFilter === 'new') && (
                  <>
                    <th
                      onClick={() => toggleSort('newPrev')}
                      className="py-2 px-2.5 text-right bg-teal-50/80 border-r border-teal-200/60 text-teal-900 cursor-pointer hover:bg-teal-100/60 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Periode Sebelumnya</span>
                        <ArrowUpDown className="w-3 h-3 text-teal-400 shrink-0" />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('newVal')}
                      className="py-2 px-2.5 text-right bg-teal-50/80 border-r border-teal-200/60 text-teal-950 cursor-pointer hover:bg-teal-100/60 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Periode Sekarang</span>
                        <ArrowUpDown className="w-3 h-3 text-teal-500 shrink-0" />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('newGrowth')}
                      className="py-2 px-2.5 text-right bg-teal-50/80 border-r border-teal-200/60 text-teal-950 cursor-pointer hover:bg-teal-100/60 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Growth</span>
                        <ArrowUpDown className="w-3 h-3 text-teal-400 shrink-0" />
                      </div>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-teal-50/80 border-r border-teal-200/80 text-teal-950 whitespace-nowrap">
                      <span>Adopsi %</span>
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {dimensionItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="py-10 text-center text-slate-400 font-medium">
                    Tidak ada data entitas yang cocok dengan filter aktif{searchQuery ? ` ("${searchQuery}")` : ''}.
                  </td>
                </tr>
              ) : (
                dimensionItems.map((item, index) => {
                  const itemIsPos = item.growth >= 0;
                  const itemFocusIsPos = item.focusGrowth >= 0;
                  const itemNewIsPos = item.newGrowth >= 0;
                  const isExpanded = expandedEntity === item.name;

                  // Percentages for stacked composition
                  const focusPct = item.current > 0 ? (item.currentFocus / item.current) * 100 : 0;
                  const newPct = item.current > 0 ? (item.currentNew / item.current) * 100 : 0;
                  const regularPct = Math.max(0, 100 - focusPct - newPct);

                  const ketColorClass =
                    item.ket === 'SELL IN'
                      ? 'text-blue-700'
                      : item.ket === 'SELL OUT'
                      ? 'text-emerald-700'
                      : 'text-indigo-700';

                  return (
                    <React.Fragment key={item.name}>
                      <tr
                        onClick={() => setExpandedEntity(isExpanded ? null : item.name)}
                        className={`group cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Name, Rank & Transaction Type Metadata */}
                        <td
                          className={`py-2.5 px-3.5 sticky left-0 z-10 border-r border-slate-200 transition-colors ${
                            isExpanded
                              ? 'bg-blue-50'
                              : 'bg-white group-hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 mt-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-slate-200 tabular-nums">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-900 leading-snug">{item.name}</div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
                                <span className={`font-bold ${ketColorClass}`}>
                                  {item.ket || 'SELL IN & OUT'}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span>{formatNumber(item.currentQty)} pcs</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Total: Periode Sebelumnya, Periode Sekarang, Growth */}
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-100 whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-600 tabular-nums">
                            {formatRupiah(item.previous)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                            {formatNumber(item.previousQty)} pcs
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-100 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900 tabular-nums">
                            {formatRupiah(item.current)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                            {formatNumber(item.currentQty)} pcs
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-200 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] tabular-nums ${
                              itemIsPos
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {itemIsPos ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {formatPercent(item.growth)}
                          </span>
                        </td>

                        {/* PRODUK FOKUS METRICS: Periode Sebelumnya, Periode Sekarang, Growth, Penetrasi % */}
                        {(viewFilter === 'all' || viewFilter === 'focus') && (
                          <>
                            <td className="py-2.5 px-2.5 text-right bg-amber-50/20 border-r border-amber-100/80 whitespace-nowrap">
                              <div className="font-mono font-semibold text-amber-900/75 tabular-nums">
                                {formatRupiah(item.previousFocus)}
                              </div>
                              <div className="text-[10px] text-amber-800/60 font-mono tabular-nums">
                                {formatNumber(item.focusQtyPrevious)} pcs
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 text-right bg-amber-50/40 border-r border-amber-100/80 whitespace-nowrap">
                              <div className="font-mono font-bold text-amber-950 tabular-nums">
                                {formatRupiah(item.currentFocus)}
                              </div>
                              <div className="text-[10px] text-amber-800/80 font-mono tabular-nums">
                                {formatNumber(item.focusQtyCurrent)} pcs
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 text-right bg-amber-50/25 border-r border-amber-100/80 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-bold text-[11px] tabular-nums ${
                                  itemFocusIsPos
                                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                    : 'text-rose-700 bg-rose-50 border border-rose-200'
                                }`}
                              >
                                {formatPercent(item.focusGrowth)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-right bg-amber-50/25 border-r border-amber-200/70 whitespace-nowrap">
                              <div className="font-mono font-semibold text-amber-900 tabular-nums">
                                {formatPercent(item.focusShareCurrent, false)}
                              </div>
                              <div className="text-[10px] text-amber-800/60 font-mono tabular-nums">
                                Prev: {formatPercent(item.focusSharePrevious, false)}
                              </div>
                            </td>
                          </>
                        )}

                        {/* PRODUK NEW METRICS: Periode Sebelumnya, Periode Sekarang, Growth, Adopsi % */}
                        {(viewFilter === 'all' || viewFilter === 'new') && (
                          <>
                            <td className="py-2.5 px-2.5 text-right bg-teal-50/20 border-r border-teal-100/80 whitespace-nowrap">
                              <div className="font-mono font-semibold text-teal-900/75 tabular-nums">
                                {formatRupiah(item.previousNew)}
                              </div>
                              <div className="text-[10px] text-teal-800/60 font-mono tabular-nums">
                                {formatNumber(item.newQtyPrevious)} pcs
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 text-right bg-teal-50/40 border-r border-teal-100/80 whitespace-nowrap">
                              <div className="font-mono font-bold text-teal-950 tabular-nums">
                                {formatRupiah(item.currentNew)}
                              </div>
                              <div className="text-[10px] text-teal-800/80 font-mono tabular-nums">
                                {formatNumber(item.newQtyCurrent)} pcs
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 text-right bg-teal-50/25 border-r border-teal-100/80 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-bold text-[11px] tabular-nums ${
                                  itemNewIsPos
                                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                    : 'text-rose-700 bg-rose-50 border border-rose-200'
                                }`}
                              >
                                {formatPercent(item.newGrowth)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-right bg-teal-50/25 border-r border-teal-200/70 whitespace-nowrap">
                              <div className="font-mono font-semibold text-teal-900 tabular-nums">
                                {formatPercent(item.newShareCurrent, false)}
                              </div>
                              <div className="text-[10px] text-teal-800/60 font-mono tabular-nums">
                                Prev: {formatPercent(item.newSharePrevious, false)}
                              </div>
                            </td>
                          </>
                        )}

                        {/* Stacked Composition Bar */}
                        <td className="py-2.5 px-3 border-r border-slate-100">
                          <div className="space-y-1">
                            {/* Stacked Bar */}
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex border border-slate-200/80 shadow-2xs">
                              {focusPct > 0 && (
                                <div
                                  title={`Produk Fokus: ${formatPercent(focusPct)} (${formatRupiah(item.currentFocus)})`}
                                  style={{ width: `${focusPct}%` }}
                                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                                />
                              )}
                              {newPct > 0 && (
                                <div
                                  title={`Produk New: ${formatPercent(newPct)} (${formatRupiah(item.currentNew)})`}
                                  style={{ width: `${newPct}%` }}
                                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500"
                                />
                              )}
                              {regularPct > 0 && (
                                <div
                                  title={`Regular: ${formatPercent(regularPct)} (${formatRupiah(item.currentRegular)})`}
                                  style={{ width: `${regularPct}%` }}
                                  className="h-full bg-slate-300"
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono tabular-nums">
                              <span>Fokus: {Math.round(focusPct)}%</span>
                              <span>New: {Math.round(newPct)}%</span>
                            </div>
                          </div>
                        </td>

                        {/* Expand Button */}
                        <td className="py-2.5 px-2.5 text-center">
                          <button
                            type="button"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* EXPANDABLE ROW DETAILS: TOP SKUS BREAKDOWN */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={tableColSpan} className="p-4 sm:p-5">
                            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
                              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <Info className="w-4 h-4 text-blue-600" />
                                  <h4 className="text-xs font-bold text-slate-900">
                                    Detail SKU Produk Unggulan untuk {item.name}
                                  </h4>
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Periode: {currentPeriodLabel}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Top Focus SKUs */}
                                <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/70">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 mb-2">
                                    <Target className="w-4 h-4 text-amber-600" />
                                    <span>Top SKU Produk Fokus</span>
                                  </div>
                                  {(!item.topFocusSkus || item.topFocusSkus.length === 0) ? (
                                    <div className="text-[11px] text-slate-400 italic py-2">
                                      Tidak ada transaksi produk fokus pada periode ini.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {item.topFocusSkus.map((sku, sIdx) => (
                                        <div
                                          key={sIdx}
                                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-amber-200/60 shadow-2xs"
                                        >
                                          <div className="truncate mr-2">
                                            <span className="font-semibold text-slate-800 block truncate">
                                              {sku.sku}
                                            </span>
                                            <span className="text-[10px] text-amber-700 font-medium">
                                              Brand: {sku.brand}
                                            </span>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-mono font-bold text-amber-950 block">
                                              {formatRupiah(sku.value)}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                              {formatNumber(sku.qty)} pcs
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Top New SKUs */}
                                <div className="p-3 bg-teal-50/40 rounded-xl border border-teal-200/70">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950 mb-2">
                                    <Sparkles className="w-4 h-4 text-teal-600" />
                                    <span>Top SKU Produk New (Launching)</span>
                                  </div>
                                  {(!item.topNewSkus || item.topNewSkus.length === 0) ? (
                                    <div className="text-[11px] text-slate-400 italic py-2">
                                      Tidak ada transaksi produk baru pada periode ini.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {item.topNewSkus.map((sku, sIdx) => (
                                        <div
                                          key={sIdx}
                                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-teal-200/60 shadow-2xs"
                                        >
                                          <div className="truncate mr-2">
                                            <span className="font-semibold text-slate-800 block truncate">
                                              {sku.sku}
                                            </span>
                                            <span className="text-[10px] text-teal-700 font-medium">
                                              Brand: {sku.brand}
                                            </span>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span className="font-mono font-bold text-teal-950 block">
                                              {formatRupiah(sku.value)}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                              {formatNumber(sku.qty)} pcs
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Summary Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-bold text-slate-800">{dimensionItems.length}</span> dari{' '}
            <span className="font-bold text-slate-800">{rawDimensionItems.length}</span> {dimensionTab}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Fokus: {formatRupiah(focusSummary.current, true)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span>New: {formatRupiah(newSummary.current, true)}</span>
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-slate-700">
              Total: {formatRupiah(overall.currentValue, true)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
