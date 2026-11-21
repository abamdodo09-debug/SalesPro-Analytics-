import React, { useState, useMemo, useEffect } from 'react';
import {
  TransactionRecord,
  FilterState,
  StoreBaContributionItem,
  StoreBaContributionSummary,
  MonthlyStoreBaSellInRow,
} from '../types/dashboard';
import {
  calculateStoreBaContribution,
  calculateMonthlyStoreBaSellInContribution,
  summarizeStoreItems,
  exportStoreBaContributionToExcel,
} from '../services/storeBaContributionService';
import { MONTH_NAMES_LIST, resolveRecordMonthAndYear } from '../services/sellInSellOutService';
import { formatRupiah } from '../utils/analytics';
import {
  Store,
  Users,
  Building2,
  Calendar,
  Search,
  FileSpreadsheet,
  Printer,
  X,
  Sliders,
  BarChart3,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface StoreBaContributionViewProps {
  records: TransactionRecord[];
  allRecords?: TransactionRecord[];
  filters: FilterState;
  onNavigateToSettings?: () => void;
}

type StoreFilterType = 'all' | 'ba_only' | 'non_ba_only';

const SHORT_MONTH_MAP: Record<string, string> = {
  JANUARI: 'Jan',
  FEBRUARI: 'Feb',
  MARET: 'Mar',
  APRIL: 'Apr',
  MEI: 'Mei',
  JUNI: 'Jun',
  JULI: 'Jul',
  AGUSTUS: 'Agu',
  SEPTEMBER: 'Sep',
  OKTOBER: 'Okt',
  NOVEMBER: 'Nov',
  DESEMBER: 'Des',
};

function formatCompactRupiah(val: number): string {
  if (val >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (val >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  if (val >= 1_000) {
    return `Rp ${Math.round(val / 1_000)} Rb`;
  }
  return `Rp ${Math.round(val)}`;
}

export const StoreBaContributionView: React.FC<StoreBaContributionViewProps> = ({
  records,
  allRecords,
  filters,
  onNavigateToSettings,
}) => {
  const sourceRecords = allRecords && allRecords.length > 0 ? allRecords : records;

  // Determine available years dynamically from Sell In records
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([2026, 2025]);
    sourceRecords.forEach((r) => {
      const { year } = resolveRecordMonthAndYear(r);
      if (year >= 2020 && year <= 2035) yearSet.add(year);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [sourceRecords]);

  // State for local filters synced with global filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') return filters.BULAN.toUpperCase();
    return 'ALL';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (filters.TAHUN && filters.TAHUN !== 'ALL') {
      const parsed = parseInt(filters.TAHUN, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 2026;
  });
  const [selectedArea, setSelectedArea] = useState<string>(() => {
    if (filters.REGION && filters.REGION !== 'ALL') return filters.REGION;
    return 'ALL';
  });
  const [storeFilterType, setStoreFilterType] = useState<StoreFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartMode, setChartMode] = useState<'stacked' | 'grouped'>('stacked');
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyStoreBaSellInRow | null>(null);
  const [selectedStoreModal, setSelectedStoreModal] = useState<StoreBaContributionItem | null>(null);

  // Sync with global Filter Terintegrasi
  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      setSelectedMonth(filters.BULAN.toUpperCase());
    } else if (filters.BULAN === 'ALL') {
      setSelectedMonth('ALL');
    }
  }, [filters.BULAN]);

  useEffect(() => {
    if (filters.TAHUN && filters.TAHUN !== 'ALL') {
      const y = parseInt(filters.TAHUN, 10);
      if (!isNaN(y)) setSelectedYear(y);
    }
  }, [filters.TAHUN]);

  useEffect(() => {
    if (filters.REGION && filters.REGION !== 'ALL') {
      setSelectedArea(filters.REGION);
    } else if (filters.REGION === 'ALL') {
      setSelectedArea('ALL');
    }
  }, [filters.REGION]);

  // Available Areas from records
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    sourceRecords.forEach((r) => {
      if (r.COVER_AREA && r.COVER_AREA !== '-') set.add(r.COVER_AREA.trim());
      if (r.REGION && r.REGION !== '-') set.add(r.REGION.trim());
    });
    return Array.from(set).sort();
  }, [sourceRecords]);

  const effectiveSearch = (searchQuery || filters.searchQuery || '').trim().toLowerCase();

  // 1. Store-level Sell In computation for selected period
  const { stores: rawStores } = useMemo(() => {
    return calculateStoreBaContribution(
      sourceRecords,
      selectedMonth,
      selectedYear,
      selectedArea,
      filters
    );
  }, [sourceRecords, selectedMonth, selectedYear, selectedArea, filters]);

  // Counts before storeFilterType tab split (respecting search & global filters)
  const searchFilteredStoresAllTypes = useMemo(() => {
    if (!effectiveSearch) return rawStores;
    return rawStores.filter((s) => {
      return (
        s.storeName.toLowerCase().includes(effectiveSearch) ||
        s.baName.toLowerCase().includes(effectiveSearch) ||
        s.salesName.toLowerCase().includes(effectiveSearch) ||
        s.coverArea.toLowerCase().includes(effectiveSearch) ||
        s.spvName.toLowerCase().includes(effectiveSearch) ||
        s.region.toLowerCase().includes(effectiveSearch)
      );
    });
  }, [rawStores, effectiveSearch]);

  const filteredStores = useMemo(() => {
    const list = searchFilteredStoresAllTypes.filter((s) => {
      if (storeFilterType === 'ba_only' && !s.hasBa) return false;
      if (storeFilterType === 'non_ba_only' && s.hasBa) return false;
      return true;
    });

    // Recompute share against filtered total if tabbed/searched
    const total = list.reduce((sum, s) => sum + s.totalRevenue, 0);
    if (total <= 0) return list;
    return list.map((s) => ({
      ...s,
      contributionPercent: Math.round((s.totalRevenue / total) * 10000) / 100,
    }));
  }, [searchFilteredStoresAllTypes, storeFilterType]);

  // Tab badge counts from full Sell In set (regardless of active storeFilterType tab)
  const tabCounts = useMemo(() => {
    const ba = searchFilteredStoresAllTypes.filter((s) => s.hasBa).length;
    const nonBa = searchFilteredStoresAllTypes.filter((s) => !s.hasBa).length;
    return {
      all: searchFilteredStoresAllTypes.length,
      ba,
      nonBa,
    };
  }, [searchFilteredStoresAllTypes]);

  // Summary metrics for top 4 KPI cards
  const summary: StoreBaContributionSummary = useMemo(() => {
    return summarizeStoreItems(filteredStores, selectedMonth, selectedYear);
  }, [filteredStores, selectedMonth, selectedYear]);

  // 2. Monthly Per-Month Breakdown (JANUARI - DESEMBER) strictly for OMSET SELL IN
  const { months: monthlyRows, yearlyTotals } = useMemo(() => {
    return calculateMonthlyStoreBaSellInContribution(
      sourceRecords,
      selectedYear,
      selectedArea,
      filters,
      storeFilterType,
      effectiveSearch
    );
  }, [sourceRecords, selectedYear, selectedArea, filters, storeFilterType, effectiveSearch]);

  // Max value for chart scaling
  const chartMaxVal = useMemo(() => {
    if (monthlyRows.length === 0) return 100_000_000;
    const rawMax = Math.max(
      ...monthlyRows.map((m) =>
        chartMode === 'stacked' ? m.totalSellIn : Math.max(m.tokoBaSellIn, m.tokoNonBaSellIn)
      )
    );
    return Math.max(1, rawMax * 1.15);
  }, [monthlyRows, chartMode]);

  const periodDisplayLabel =
    selectedMonth === 'ALL' ? `Semua Bulan ${selectedYear}` : `${selectedMonth} ${selectedYear}`;

  const handleExport = () => {
    exportStoreBaContributionToExcel(
      filteredStores,
      summary,
      monthlyRows,
      selectedMonth,
      selectedYear
    );
  };

  return (
    <div className="space-y-6 pb-12 print:p-0">
      {/* 1. Header & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Analisa Toko Ada BA vs Toko Non-BA
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                  Khusus Omset Sell In
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekapitulasi jumlah toko, total BA, omset Sell In, serta persentase kontribusi per bulan ({periodDisplayLabel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Kelola daftar Toko & Penugasan BA"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>Pengaturan Toko &amp; BA</span>
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented Store Type Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto">
            {[
              { id: 'all' as StoreFilterType, label: 'Semua Toko', count: tabCounts.all },
              { id: 'ba_only' as StoreFilterType, label: 'Toko Ada BA', count: tabCounts.ba },
              { id: 'non_ba_only' as StoreFilterType, label: 'Toko Non-BA', count: tabCounts.nonBa },
            ].map((tab) => {
              const active = storeFilterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStoreFilterType(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded-md ${
                      active ? 'bg-slate-900 text-white' : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Period & Area Filters */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-500">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {MONTH_NAMES_LIST.map((m) => (
                  <option key={m} value={m}>
                    {m === 'ALL' ? 'Semua Bulan' : m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="font-semibold text-slate-500">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-500">Area:</span>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="ALL">Semua Area</option>
                {availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards (4 Kolom Seimbang - Khusus Omset Sell In) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Semua Toko */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Total Semua Toko</span>
              <Store className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900">
                {summary.totalStoresCount}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Toko Aktif Sell In
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">
              Total Omset Sell In ({periodDisplayLabel})
            </span>
            <span className="text-lg font-black font-mono tabular-nums text-slate-900 mt-0.5 block">
              {formatRupiah(summary.totalAreaRevenue, true)}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5 block">
              Volume: {summary.totalAreaQty.toLocaleString('id-ID')} pcs (100%)
            </span>
          </div>
        </div>

        {/* Card 2: Toko Ada BA + Total BA */}
        <div className="bg-white rounded-2xl border border-rose-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-rose-700 uppercase tracking-wider">
              <span>Toko Ada BA</span>
              <span className="font-mono tabular-nums text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Kontribusi {summary.tokoBaRevenuePercent}%
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900">
                  {summary.tokoBaCount}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Toko ({summary.tokoBaStorePercent}%)
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-extrabold text-rose-700 bg-rose-50/80 px-2 py-1 rounded-lg border border-rose-100">
                <Users className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{summary.totalBaCount} Total BA</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">
              Omset Sell In Toko Ada BA
            </span>
            <span className="text-lg font-black font-mono tabular-nums text-rose-700 mt-0.5 block">
              {formatRupiah(summary.tokoBaTotalRevenue, true)}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5 block">
              Rata-rata / toko: {formatRupiah(summary.tokoBaAvgRevenuePerStore, true)}
            </span>
          </div>
        </div>

        {/* Card 3: Toko Non-BA */}
        <div className="bg-white rounded-2xl border border-blue-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-blue-700 uppercase tracking-wider">
              <span>Toko Non-BA</span>
              <span className="font-mono tabular-nums text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Kontribusi {summary.tokoNonBaRevenuePercent}%
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900">
                {summary.tokoNonBaCount}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Toko Tanpa BA ({summary.tokoNonBaStorePercent}%)
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">
              Omset Sell In Toko Non-BA
            </span>
            <span className="text-lg font-black font-mono tabular-nums text-blue-700 mt-0.5 block">
              {formatRupiah(summary.tokoNonBaTotalRevenue, true)}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5 block">
              Rata-rata / toko: {formatRupiah(summary.tokoNonBaAvgRevenuePerStore, true)}
            </span>
          </div>
        </div>

        {/* Card 4: Porsi Kontribusi & Produktivitas Sell In */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Rasio Kontribusi Sell In</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>

            {/* Porsi Omset Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold font-mono tabular-nums">
                <span className="text-rose-700">Ada BA {summary.tokoBaRevenuePercent}%</span>
                <span className="text-blue-700">Non-BA {summary.tokoNonBaRevenuePercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-rose-600 h-full transition-all duration-300"
                  style={{ width: `${summary.tokoBaRevenuePercent}%` }}
                />
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${summary.tokoNonBaRevenuePercent}%` }}
                />
              </div>
            </div>

            {/* Porsi Jumlah Toko Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold font-mono tabular-nums text-slate-500">
                <span>Porsi Gerai BA {summary.tokoBaStorePercent}%</span>
                <span>Non-BA {summary.tokoNonBaStorePercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-rose-400 h-full transition-all duration-300"
                  style={{ width: `${summary.tokoBaStorePercent}%` }}
                />
                <div
                  className="bg-blue-400 h-full transition-all duration-300"
                  style={{ width: `${summary.tokoNonBaStorePercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Produktivitas Sell In BA:</span>
            <span className="font-mono tabular-nums font-black text-slate-900">
              {summary.productivityMultiplier}x Non-BA
            </span>
          </div>
        </div>
      </div>

      {/* 3. Rekapitulasi Per Bulan (Grafik + Tabel Rapi) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-600" />
              <span>Rekap Per Bulan Kontribusi Omset Sell In ({selectedYear})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian bulanan jumlah toko, omset Sell In, serta kontribusi Toko Ada BA vs Toko Non-BA. Klik bulan untuk memfilter detail toko.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedMonth !== 'ALL' && (
              <button
                onClick={() => setSelectedMonth('ALL')}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Tampilkan Semua Bulan
              </button>
            )}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-bold">
              <button
                onClick={() => setChartMode('stacked')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  chartMode === 'stacked' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Grafik Total (Stacked)
              </button>
              <button
                onClick={() => setChartMode('grouped')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  chartMode === 'grouped' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Perbandingan (Side-by-Side)
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Monthly Bar Chart */}
        {monthlyRows.length > 0 ? (
          <div className="p-5 border-b border-slate-100 bg-slate-50/40">
            {/* Legend + Hover Inspection Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block" />
                  <span className="text-slate-700">Toko Ada BA (Omset Sell In)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                  <span className="text-slate-700">Toko Non-BA (Omset Sell In)</span>
                </div>
              </div>

              {hoveredMonth ? (
                <div className="text-[11px] font-mono tabular-nums bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex flex-wrap items-center gap-3 shadow-2xs">
                  <span className="font-sans font-extrabold text-slate-900">
                    {hoveredMonth.monthName} {hoveredMonth.year}:
                  </span>
                  <span className="text-slate-700">
                    Total {hoveredMonth.totalStoresCount} Toko ({formatCompactRupiah(hoveredMonth.totalSellIn)})
                  </span>
                  <span className="text-rose-700 font-bold">
                    Ada BA: {hoveredMonth.tokoBaCount} Toko ({hoveredMonth.tokoBaContributionPct}%)
                  </span>
                  <span className="text-blue-700 font-bold">
                    Non-BA: {hoveredMonth.tokoNonBaCount} Toko ({hoveredMonth.tokoNonBaContributionPct}%)
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Arahkan kursor ke batang bulan untuk melihat rincian cepat
                </span>
              )}
            </div>

            {/* Chart Area */}
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[640px]">
                <div className="relative h-60 flex items-end gap-2 sm:gap-3 pt-8 pb-2 px-2 border-b border-slate-200">
                  {/* Horizontal Grid Lines */}
                  {[0.25, 0.5, 0.75, 1].map((ratio) => (
                    <div
                      key={ratio}
                      className="absolute left-0 right-0 border-t border-dashed border-slate-200/80 pointer-events-none flex items-center"
                      style={{ bottom: `${ratio * 100 * 0.85}%` }}
                    >
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 bg-slate-50/90 pr-1.5 -mt-4">
                        {formatCompactRupiah(chartMaxVal * ratio)}
                      </span>
                    </div>
                  ))}

                  {monthlyRows.map((m) => {
                    const isActive = selectedMonth === m.monthName;
                    const baHeightPct = Math.max(0, (m.tokoBaSellIn / chartMaxVal) * 100);
                    const nonBaHeightPct = Math.max(0, (m.tokoNonBaSellIn / chartMaxVal) * 100);

                    return (
                      <button
                        key={m.monthName}
                        type="button"
                        onClick={() =>
                          setSelectedMonth((prev) =>
                            prev === m.monthName ? 'ALL' : m.monthName
                          )
                        }
                        onMouseEnter={() => setHoveredMonth(m)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        className={`flex-1 h-full flex flex-col justify-end items-center group cursor-pointer rounded-lg px-1 transition-colors ${
                          isActive ? 'bg-rose-50/80 ring-1 ring-rose-300' : 'hover:bg-slate-100/70'
                        }`}
                      >
                        {/* Value Label Above Bar */}
                        <div className="text-[10px] font-mono tabular-nums font-bold text-slate-600 mb-1 whitespace-nowrap">
                          {formatCompactRupiah(m.totalSellIn)}
                        </div>

                        {/* Bar Column */}
                        <div className="w-full max-w-[46px] h-[78%] flex items-end justify-center gap-1">
                          {chartMode === 'stacked' ? (
                            <div className="w-full h-full flex flex-col justify-end rounded-t-md overflow-hidden">
                              <div
                                className="w-full bg-blue-600 group-hover:bg-blue-500 transition-all duration-300"
                                style={{ height: `${nonBaHeightPct}%` }}
                                title={`Toko Non-BA: ${formatRupiah(m.tokoNonBaSellIn, true)} (${m.tokoNonBaContributionPct}%)`}
                              />
                              <div
                                className="w-full bg-rose-600 group-hover:bg-rose-500 transition-all duration-300"
                                style={{ height: `${baHeightPct}%` }}
                                title={`Toko Ada BA: ${formatRupiah(m.tokoBaSellIn, true)} (${m.tokoBaContributionPct}%)`}
                              />
                            </div>
                          ) : (
                            <>
                              <div
                                className="w-1/2 bg-rose-600 group-hover:bg-rose-500 rounded-t-sm transition-all duration-300"
                                style={{ height: `${baHeightPct}%` }}
                                title={`Toko Ada BA: ${formatRupiah(m.tokoBaSellIn, true)} (${m.tokoBaContributionPct}%)`}
                              />
                              <div
                                className="w-1/2 bg-blue-600 group-hover:bg-blue-500 rounded-t-sm transition-all duration-300"
                                style={{ height: `${nonBaHeightPct}%` }}
                                title={`Toko Non-BA: ${formatRupiah(m.tokoNonBaSellIn, true)} (${m.tokoNonBaContributionPct}%)`}
                              />
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* X-Axis Labels + Monthly Share Badges */}
                <div className="flex items-start gap-2 sm:gap-3 px-2 pt-2">
                  {monthlyRows.map((m) => {
                    const isActive = selectedMonth === m.monthName;
                    return (
                      <div key={m.monthName} className="flex-1 text-center">
                        <span
                          className={`text-[11px] font-extrabold block ${
                            isActive ? 'text-rose-700' : 'text-slate-700'
                          }`}
                        >
                          {SHORT_MONTH_MAP[m.monthName] || m.monthName.slice(0, 3)}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-rose-700 font-bold block">
                          {m.tokoBaContributionPct}%
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-blue-700 block">
                          {m.tokoNonBaContributionPct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Monthly Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th rowSpan={2} className="py-2.5 px-4 border-r border-slate-200/80">
                  Bulan
                </th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200/80 bg-slate-100 text-slate-800">
                  Total Semua Toko (Sell In)
                </th>
                <th colSpan={3} className="py-2 px-3 text-center border-r border-slate-200/80 bg-rose-50/80 text-rose-800">
                  Toko Ada BA
                </th>
                <th colSpan={3} className="py-2 px-3 text-center border-r border-slate-200/80 bg-blue-50/80 text-blue-800">
                  Toko Non-BA
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center min-w-[130px]">
                  Porsi Kontribusi
                </th>
              </tr>
              <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-slate-200">
                <th className="py-2 px-3 text-center">Jml Toko</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/80">Omset Sell In</th>
                <th className="py-2 px-3 text-center bg-rose-50/40 text-rose-900">Jml Toko</th>
                <th className="py-2 px-3 text-right bg-rose-50/40 text-rose-900">Omset Sell In</th>
                <th className="py-2 px-3 text-center border-r border-slate-200/80 bg-rose-50/40 text-rose-900">
                  Kontribusi
                </th>
                <th className="py-2 px-3 text-center bg-blue-50/40 text-blue-900">Jml Toko</th>
                <th className="py-2 px-3 text-right bg-blue-50/40 text-blue-900">Omset Sell In</th>
                <th className="py-2 px-3 text-center border-r border-slate-200/80 bg-blue-50/40 text-blue-900">
                  Kontribusi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyRows.map((m) => {
                const isSelected = selectedMonth === m.monthName;
                return (
                  <tr
                    key={m.monthName}
                    onClick={() =>
                      setSelectedMonth((prev) => (prev === m.monthName ? 'ALL' : m.monthName))
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-rose-50/70' : 'hover:bg-slate-50/90'
                    }`}
                  >
                    <td className="py-3 px-4 border-r border-slate-100 font-extrabold text-slate-900 whitespace-nowrap">
                      <span>{m.monthName}</span>
                      {isSelected && (
                        <span className="ml-2 text-[10px] font-bold text-rose-700">• Aktif</span>
                      )}
                    </td>

                    {/* Total Semua Toko */}
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-slate-800">
                      {m.totalStoresCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-black text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {formatRupiah(m.totalSellIn, true)}
                    </td>

                    {/* Toko Ada BA */}
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-rose-800 bg-rose-50/20">
                      {m.tokoBaCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-rose-50/20 whitespace-nowrap">
                      {formatRupiah(m.tokoBaSellIn, true)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-black text-rose-700 border-r border-slate-100 bg-rose-50/20">
                      {m.tokoBaContributionPct}%
                    </td>

                    {/* Toko Non-BA */}
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-blue-800 bg-blue-50/20">
                      {m.tokoNonBaCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-blue-50/20 whitespace-nowrap">
                      {formatRupiah(m.tokoNonBaSellIn, true)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-black text-blue-700 border-r border-slate-100 bg-blue-50/20">
                      {m.tokoNonBaContributionPct}%
                    </td>

                    {/* Visual Share */}
                    <td className="py-3 px-3">
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-rose-600 h-full"
                          style={{ width: `${m.tokoBaContributionPct}%` }}
                        />
                        <div
                          className="bg-blue-600 h-full"
                          style={{ width: `${m.tokoNonBaContributionPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-500 mt-1">
                        <span>{m.tokoBaContributionPct}%</span>
                        <span>{m.tokoNonBaContributionPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {monthlyRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Belum ada transaksi Omset Sell In untuk filter tahun {selectedYear}.
                  </td>
                </tr>
              )}
            </tbody>

            {monthlyRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-mono tabular-nums text-xs">
                  <td className="py-3 px-4 font-sans font-extrabold border-r border-slate-800 whitespace-nowrap">
                    TOTAL {selectedYear} (Unik)
                  </td>
                  <td className="py-3 px-3 text-center font-bold">
                    {yearlyTotals.distinctStoresCount}
                  </td>
                  <td className="py-3 px-3 text-right font-black border-r border-slate-800 whitespace-nowrap">
                    {formatRupiah(yearlyTotals.totalSellIn, true)}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-rose-300">
                    {yearlyTotals.distinctTokoBaCount}
                  </td>
                  <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                    {formatRupiah(yearlyTotals.tokoBaSellIn, true)}
                  </td>
                  <td className="py-3 px-3 text-center font-black text-rose-300 border-r border-slate-800">
                    {yearlyTotals.tokoBaContributionPct}%
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-blue-300">
                    {yearlyTotals.distinctTokoNonBaCount}
                  </td>
                  <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                    {formatRupiah(yearlyTotals.tokoNonBaSellIn, true)}
                  </td>
                  <td className="py-3 px-3 text-center font-black text-blue-300 border-r border-slate-800">
                    {yearlyTotals.tokoNonBaContributionPct}%
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden flex">
                      <div
                        className="bg-rose-500 h-full"
                        style={{ width: `${yearlyTotals.tokoBaContributionPct}%` }}
                      />
                      <div
                        className="bg-blue-500 h-full"
                        style={{ width: `${yearlyTotals.tokoNonBaContributionPct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. Store-Level Sell In Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Daftar Rincian Omset Sell In per Toko ({periodDisplayLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {filteredStores.length} toko dengan transaksi Sell In • Total {summary.totalBaCount} BA aktif
            </p>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama toko, nama BA, sales, area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Nama Toko</th>
                <th className="py-3 px-3">Nama BA</th>
                <th className="py-3 px-3">Area &amp; Sales</th>
                <th className="py-3 px-3 text-right">Omset Sell In (Rp)</th>
                <th className="py-3 px-3 text-center">% Kontribusi</th>
                <th className="py-3 px-3 text-center">Qty Sell In</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStores.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        item.hasBa
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {item.hasBa ? 'Toko Ada BA' : 'Toko Non-BA'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{item.storeName}</span>
                    <span className="text-[11px] text-slate-400 block">{item.region}</span>
                  </td>
                  <td className="py-3 px-3">
                    {item.hasBa ? (
                      <div>
                        <span className="font-bold text-rose-700 block">{item.baName}</span>
                        {item.baCountInStore > 1 && (
                          <span className="text-[10px] font-mono text-slate-500">
                            ({item.baCountInStore} BA)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">- (Tanpa BA)</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800 block">{item.coverArea}</span>
                    <span className="text-[11px] text-slate-400 block">Sales: {item.salesName}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-black text-slate-900 whitespace-nowrap">
                    {formatRupiah(item.totalRevenue, true)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-slate-800">
                    {item.contributionPercent}%
                  </td>
                  <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-600">
                    {item.totalQtySold.toLocaleString('id-ID')} pcs
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => setSelectedStoreModal(item)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}

              {filteredStores.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Tidak ada transaksi Omset Sell In yang cocok dengan filter saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail Modal (Khusus Omset Sell In) */}
      {selectedStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      selectedStoreModal.hasBa
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedStoreModal.hasBa ? 'Toko Ada BA' : 'Toko Non-BA'}
                  </span>
                  <span className="text-xs text-slate-400">• {periodDisplayLabel}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedStoreModal.storeName}
                </h3>
                <p className="text-xs text-slate-500">
                  Area: {selectedStoreModal.coverArea} • Sales: {selectedStoreModal.salesName} • SPV: {selectedStoreModal.spvName}
                </p>
              </div>
              <button
                onClick={() => setSelectedStoreModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Total Omset Sell In</span>
                <span className="font-mono tabular-nums font-black text-base text-slate-900 block mt-0.5">
                  {formatRupiah(selectedStoreModal.totalRevenue, true)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Kontribusi Sell In</span>
                <span className="font-mono tabular-nums font-black text-emerald-700 text-base block mt-0.5">
                  {selectedStoreModal.contributionPercent}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total Qty Sell In</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 text-sm block mt-0.5">
                  {selectedStoreModal.totalQtySold.toLocaleString('id-ID')} pcs
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Produk Fokus (Sell In)</span>
                <span className="font-mono tabular-nums font-bold text-rose-700 text-sm block mt-0.5">
                  {selectedStoreModal.focusProductPcs} pcs ({formatRupiah(selectedStoreModal.focusProductValue, true)})
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Status BA di Toko:</span>
              <p className="text-slate-600">
                {selectedStoreModal.hasBa
                  ? `Dikelola oleh ${selectedStoreModal.baCountInStore} BA: ${selectedStoreModal.baName}.`
                  : 'Gerai Non-BA (pasokan melalui Sales Taking Order reguler tanpa BA counter).'}
              </p>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 space-y-1">
              <span className="font-extrabold flex items-center gap-1.5 text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Catatan Evaluasi ({selectedStoreModal.performanceClass})
              </span>
              <p className="leading-relaxed">{selectedStoreModal.recommendationNote}</p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedStoreModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
