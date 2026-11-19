import React, { useState, useMemo, useEffect } from 'react';
import {
  TransactionRecord,
  FilterState,
  DashboardFilters,
  SellInSellOutDimension,
  SellInSellOutItem,
  SellInSellOutSummary,
} from '../types/dashboard';
import {
  calculateSellInVsSellOut,
  MONTH_NAMES_LIST,
  exportSellInVsSellOutToExcel,
  saveMonthlySellInOutOverride,
  resetMonthlySellInOutOverride,
  resetAllMonthlyOverridesForScope,
  saveEntitySellInOutOverride,
  resetEntitySellInOutOverride,
  loadEntitySellInOutOverrides,
  MonthlySellInOutRow,
} from '../services/sellInSellOutService';
import { TARGETS_UPDATED_EVENT } from '../services/targetManagementService';
import { formatRupiah } from '../utils/analytics';
import {
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Search,
  FileSpreadsheet,
  Printer,
  X,
  Store,
  Users,
  Building2,
  GraduationCap,
  Sparkles,
  Calendar,
  Info,
  Edit2,
  Save,
  RotateCcw,
} from 'lucide-react';

interface SellInVsSellOutViewProps {
  records: TransactionRecord[];
  allRecords?: TransactionRecord[];
  filters: FilterState;
  onFilterChange?: (key: keyof DashboardFilters, value: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const SellInVsSellOutView: React.FC<SellInVsSellOutViewProps> = ({
  records,
  allRecords,
  filters,
  onFilterChange,
  onNavigateTab,
}) => {
  const sourceRecords = allRecords && allRecords.length > 0 ? allRecords : records;

  const [activeDimension, setActiveDimension] = useState<SellInSellOutDimension>('sales');
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
  const [onlyOver20, setOnlyOver20] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemModal, setSelectedItemModal] = useState<SellInSellOutItem | null>(null);
  const [refreshVersion, setRefreshVersion] = useState<number>(0);

  // Inline edit state untuk Rincian Per Bulan
  const [editingMonthKey, setEditingMonthKey] = useState<string | null>(null);
  const [draftMonthSellIn, setDraftMonthSellIn] = useState<string>('0');
  const [draftMonthSellOut, setDraftMonthSellOut] = useState<string>('0');
  const [draftMonthNotes, setDraftMonthNotes] = useState<string>('');
  const [confirmResetAllMonths, setConfirmResetAllMonths] = useState<boolean>(false);

  // Inline edit state untuk Tabel Evaluasi Entitas
  const [editingEntityName, setEditingEntityName] = useState<string | null>(null);
  const [draftEntitySellIn, setDraftEntitySellIn] = useState<string>('0');
  const [draftEntitySellOut, setDraftEntitySellOut] = useState<string>('0');
  const [draftEntityTarget, setDraftEntityTarget] = useState<string>('0');

  useEffect(() => {
    const onTargetsUpdated = () => setRefreshVersion((v) => v + 1);
    window.addEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
    window.addEventListener('storage', onTargetsUpdated);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
      window.removeEventListener('storage', onTargetsUpdated);
    };
  }, []);

  // Sinkronisasi dua arah dengan Global FilterBar (KECUALI KET)
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

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    setEditingEntityName(null);
    if (onFilterChange) {
      onFilterChange('BULAN', newMonth);
    }
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    setEditingMonthKey(null);
    setEditingEntityName(null);
    if (onFilterChange) {
      onFilterChange('TAHUN', newYear.toString());
    }
  };

  const handleAreaChange = (newArea: string) => {
    setSelectedArea(newArea);
    setEditingMonthKey(null);
    setEditingEntityName(null);
    if (onFilterChange) {
      onFilterChange('REGION', newArea);
    }
  };

  const availableYears = useMemo(() => {
    const set = new Set<number>([2025, 2026]);
    sourceRecords.forEach((r) => {
      const y = Number(r.TAHUN);
      if (!isNaN(y) && y > 2000) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [sourceRecords]);

  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    sourceRecords.forEach((r) => {
      if (r.COVER_AREA) set.add(r.COVER_AREA);
      if (r.REGION) set.add(r.REGION);
    });
    return Array.from(set).sort();
  }, [sourceRecords]);

  const effectiveSearch = (searchQuery || filters.searchQuery || '').trim().toLowerCase();

  // Gabungkan searchQuery lokal ke filters agar konsisten
  const effectiveFilters = useMemo<FilterState>(() => {
    const combinedQuery = searchQuery.trim() || filters.searchQuery || '';
    return {
      ...filters,
      searchQuery: combinedQuery,
    };
  }, [filters, searchQuery]);

  // Hitung data 100% dari Google Sheet (tanpa filter KET) + rincian bulanan
  const { items: rawItems, summary: baseSummary, monthlyRows, monthlyScopeKey } = useMemo(() => {
    return calculateSellInVsSellOut(
      sourceRecords,
      activeDimension,
      selectedMonth,
      selectedYear,
      selectedArea,
      effectiveFilters
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRecords, activeDimension, selectedMonth, selectedYear, selectedArea, effectiveFilters, refreshVersion]);

  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (onlyOver20 && !item.isOver20Percent) return false;
      return true;
    });
  }, [rawItems, onlyOver20]);

  // Summary KPI Cards
  const summary: SellInSellOutSummary = useMemo(() => {
    if (!onlyOver20 && !effectiveSearch) return baseSummary;

    const totalSellIn = filteredItems.reduce((acc, i) => acc + i.sellInValue, 0);
    const totalSellOut = filteredItems.reduce((acc, i) => acc + i.sellOutValue, 0);
    const totalGapValue = totalSellIn - totalSellOut;
    const baseDenom = totalSellIn > 0 ? totalSellIn : totalSellOut > 0 ? totalSellOut : 0;
    const avgGapPercent = baseDenom > 0 ? Math.round((totalGapValue / baseDenom) * 1000) / 10 : 0;
    const overallSellThroughPercent = totalSellIn > 0 ? Math.round((totalSellOut / totalSellIn) * 1000) / 10 : 0;

    return {
      ...baseSummary,
      totalSellIn,
      totalSellOut,
      totalGapValue,
      avgGapPercent,
      overallSellThroughPercent,
      totalEntitiesCount: filteredItems.length,
      over20Count: filteredItems.filter((i) => i.isOver20Percent).length,
      overstockCount: filteredItems.filter((i) => i.statusType === 'overstock').length,
      stockoutRiskCount: filteredItems.filter((i) => i.statusType === 'stockout_risk').length,
      healthyCount: filteredItems.filter((i) => i.statusType === 'healthy').length,
    };
  }, [baseSummary, filteredItems, onlyOver20, effectiveSearch]);

  // Total 12 bulan untuk Footer Rincian Per Bulan
  const monthlyTotals = useMemo(() => {
    const totalSellIn = monthlyRows.reduce((s, r) => s + r.sellInValue, 0);
    const totalSellOut = monthlyRows.reduce((s, r) => s + r.sellOutValue, 0);
    const totalSheetSellIn = monthlyRows.reduce((s, r) => s + r.sheetSellIn, 0);
    const totalSheetSellOut = monthlyRows.reduce((s, r) => s + r.sheetSellOut, 0);
    const totalGapValue = totalSellIn - totalSellOut;
    const baseDenom = totalSellIn > 0 ? totalSellIn : totalSellOut > 0 ? totalSellOut : 0;
    const avgGapPercent = baseDenom > 0 ? Math.round((totalGapValue / baseDenom) * 1000) / 10 : 0;
    const sellThroughPercent = totalSellIn > 0 ? Math.round((totalSellOut / totalSellIn) * 1000) / 10 : 0;
    const editedCount = monthlyRows.filter((r) => r.isManualEdit).length;

    return {
      totalSellIn,
      totalSellOut,
      totalSheetSellIn,
      totalSheetSellOut,
      totalGapValue,
      avgGapPercent,
      sellThroughPercent,
      editedCount,
    };
  }, [monthlyRows]);

  // Handlers Inline Edit Bulanan
  const startEditMonth = (row: MonthlySellInOutRow) => {
    setEditingMonthKey(row.month);
    setDraftMonthSellIn(String(Math.round(row.sellInValue)));
    setDraftMonthSellOut(String(Math.round(row.sellOutValue)));
    setDraftMonthNotes(row.notes || '');
  };

  const cancelEditMonth = () => {
    setEditingMonthKey(null);
  };

  const saveEditMonth = (month: string) => {
    const parsedIn = Math.max(0, Number(draftMonthSellIn) || 0);
    const parsedOut = Math.max(0, Number(draftMonthSellOut) || 0);
    saveMonthlySellInOutOverride(monthlyScopeKey, month, {
      sellIn: parsedIn,
      sellOut: parsedOut,
      notes: draftMonthNotes.trim(),
    });
    setEditingMonthKey(null);
    setRefreshVersion((v) => v + 1);
  };

  const handleResetSingleMonth = (month: string) => {
    resetMonthlySellInOutOverride(monthlyScopeKey, month);
    setEditingMonthKey(null);
    setRefreshVersion((v) => v + 1);
  };

  const handleResetAllMonths = () => {
    resetAllMonthlyOverridesForScope(monthlyScopeKey);
    setConfirmResetAllMonths(false);
    setEditingMonthKey(null);
    setRefreshVersion((v) => v + 1);
  };

  // Handlers Inline Edit Entitas
  const entityOverridesMap = useMemo(() => {
    void refreshVersion;
    return loadEntitySellInOutOverrides();
  }, [refreshVersion]);

  const hasEntityOverride = (entityName: string) => {
    const key = `${selectedYear}|${selectedMonth.trim().toUpperCase()}|${activeDimension}|${entityName.trim().toUpperCase()}`;
    return Boolean(entityOverridesMap[key]);
  };

  const startEditEntity = (item: SellInSellOutItem) => {
    setEditingEntityName(item.name);
    setDraftEntitySellIn(String(Math.round(item.sellInValue)));
    setDraftEntitySellOut(String(Math.round(item.sellOutValue)));
    setDraftEntityTarget(String(Math.round(item.target || 0)));
  };

  const cancelEditEntity = () => {
    setEditingEntityName(null);
  };

  const saveEditEntity = (entityName: string) => {
    saveEntitySellInOutOverride(selectedYear, selectedMonth, activeDimension, entityName, {
      sellIn: Math.max(0, Number(draftEntitySellIn) || 0),
      sellOut: Math.max(0, Number(draftEntitySellOut) || 0),
      target: Math.max(0, Number(draftEntityTarget) || 0),
    });
    setEditingEntityName(null);
    setRefreshVersion((v) => v + 1);
  };

  const handleResetEntity = (entityName: string) => {
    resetEntitySellInOutOverride(selectedYear, selectedMonth, activeDimension, entityName);
    setEditingEntityName(null);
    setRefreshVersion((v) => v + 1);
  };

  const dimensionMeta: Record<
    SellInSellOutDimension,
    { label: string; icon: React.ReactNode; desc: string }
  > = {
    sales: {
      label: 'Sales Personil',
      icon: <Users className="w-4 h-4" />,
      desc: 'Perbandingan Sell In vs Sell Out per Sales berdasarkan data Google Sheet',
    },
    store: {
      label: 'Toko / Outlet',
      icon: <Store className="w-4 h-4" />,
      desc: 'Perbandingan pemesanan stok toko (Sell In) vs serapan konsumen (Sell Out)',
    },
    ba: {
      label: 'Beauty Advisor (BA)',
      icon: <Sparkles className="w-4 h-4" />,
      desc: 'Evaluasi stok masuk counter vs realisasi penjualan oleh BA dari Google Sheet',
    },
    trainer: {
      label: 'Trainer',
      icon: <GraduationCap className="w-4 h-4" />,
      desc: 'Perbandingan Sell In vs Sell Out berdasarkan wilayah pembinaan Trainer',
    },
    spv: {
      label: 'Supervisor (SPV)',
      icon: <Building2 className="w-4 h-4" />,
      desc: 'Ringkasan Sell In vs Sell Out per Supervisor berdasarkan Google Sheet',
    },
  };

  const currentMeta = dimensionMeta[activeDimension];

  // Ringkasan label filter aktif untuk informasi user
  const activeFilterSummary = useMemo(() => {
    const active: string[] = [];
    if (filters.SPV && filters.SPV !== 'ALL') active.push(`SPV: ${filters.SPV}`);
    if (filters.SALES && filters.SALES !== 'ALL') active.push(`Sales: ${filters.SALES}`);
    if (filters.TRAINER && filters.TRAINER !== 'ALL') active.push(`Trainer: ${filters.TRAINER}`);
    if (filters.BRAND && filters.BRAND !== 'ALL') active.push(`Brand: ${filters.BRAND}`);
    if (filters.KATEGORI && filters.KATEGORI !== 'ALL') active.push(`Kategori: ${filters.KATEGORI}`);
    if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL') active.push(`Toko: ${filters.NAMA_STORE}`);
    if (selectedArea !== 'ALL') active.push(`Area: ${selectedArea}`);
    if (filters.SKU && filters.SKU !== 'ALL') active.push(`SKU: ${filters.SKU}`);
    return active;
  }, [filters, selectedArea]);

  return (
    <div className="space-y-6 pb-12 print:p-0">
      {/* 1. Header & Kontrol Sinkronisasi */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Perbandingan Sell In vs Sell Out
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1">
                <span>Sumber: Google Sheet Terhubung (Sell In &amp; Sell Out)</span>
                <span aria-hidden="true">·</span>
                <span>
                  Periode: {selectedMonth === 'ALL' ? 'Semua Bulan' : selectedMonth} {selectedYear}
                </span>
                <span aria-hidden="true">·</span>
                <span className={filters.KET && filters.KET !== 'ALL' ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                  {filters.KET && filters.KET !== 'ALL'
                    ? `Filter KET (${filters.KET}) dinonaktifkan otomatis di menu ini`
                    : 'Filter KET (Sell In / Sell Out) tidak aktif di menu ini'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('pengaturan_master')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Store className="w-3.5 h-3.5 text-slate-600" />
                <span>Master Data &amp; Tim Coverage</span>
              </button>
            )}

            <button
              onClick={() =>
                exportSellInVsSellOutToExcel(
                  filteredItems,
                  summary,
                  monthlyRows,
                  currentMeta.label,
                  selectedMonth,
                  selectedYear
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0 print:hidden"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak PDF</span>
            </button>
          </div>
        </div>

        {/* Kontrol Dimensi & Filter */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(Object.keys(dimensionMeta) as SellInSellOutDimension[]).map((dim) => {
              const meta = dimensionMeta[dim];
              const isActive = activeDimension === dim;
              return (
                <button
                  key={dim}
                  onClick={() => {
                    setActiveDimension(dim);
                    setEditingEntityName(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-slate-600">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
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
              <span className="font-medium text-slate-600">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-slate-600">Area:</span>
              <select
                value={selectedArea}
                onChange={(e) => handleAreaChange(e.target.value)}
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

            <button
              onClick={() => setOnlyOver20(!onlyOver20)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                onlyOver20
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${onlyOver20 ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Hanya Selisih &gt; 20% ({summary.over20Count})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive KPI Cards (100% Google Sheet + Manual Monthly Override) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Sell In</span>
            <span className="text-[11px] text-slate-400">
              {summary.isManualOverride ? 'Terdapat Edit Manual' : 'Google Sheet'}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block">
              {formatRupiah(summary.totalSellIn, true)}
            </span>
            <span className="text-xs text-slate-500 mt-1 block font-mono tabular-nums">
              {formatRupiah(summary.totalSellIn, false)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Sell Out</span>
            <span className="text-[11px] text-slate-400">
              {selectedMonth === 'ALL' ? `Jan–Des ${selectedYear}` : `${selectedMonth} ${selectedYear}`}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-indigo-950 font-mono tabular-nums block">
              {formatRupiah(summary.totalSellOut, true)}
            </span>
            <span className="text-xs text-slate-500 mt-1 block font-mono tabular-nums">
              {formatRupiah(summary.totalSellOut, false)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Selisih Nilai (Gap)</span>
            <span className="text-[11px] text-slate-400">Sell In − Sell Out</span>
          </div>
          <div className="mt-2">
            <span
              className={`text-xl font-bold font-mono tabular-nums block ${
                summary.totalGapValue >= 0 ? 'text-indigo-700' : 'text-rose-600'
              }`}
            >
              {summary.totalGapValue >= 0 ? '+' : ''}
              {formatRupiah(summary.totalGapValue, true)}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              {summary.totalGapValue >= 0
                ? 'Surplus stok outlet (Sell In > Sell Out)'
                : 'Defisit stok (Sell Out > Sell In)'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Rasio Serapan (Sell-Through)</span>
            <span className="text-[11px] text-slate-400">Ideal 80%–120%</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  summary.overallSellThroughPercent >= 80 && summary.overallSellThroughPercent <= 120
                    ? 'text-emerald-700'
                    : summary.totalSellIn === 0 && summary.totalSellOut === 0
                    ? 'text-slate-500'
                    : 'text-amber-700'
                }`}
              >
                {summary.overallSellThroughPercent}%
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                (Gap: {summary.avgGapPercent >= 0 ? '+' : ''}
                {summary.avgGapPercent}%)
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              {summary.over20Count} entitas dengan selisih &gt; 20%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Rincian Perbandingan Sell In vs Sell Out Per Bulan (Januari - Desember, Bisa Diedit) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Rincian Per Bulan Sell In vs Sell Out ({selectedYear})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeFilterSummary.length > 0
                ? `Filter aktif: ${activeFilterSummary.join(' · ')} · Klik Edit pada baris bulan untuk penyesuaian`
                : 'Menampilkan seluruh bulan Januari s/d Desember langsung dari Google Sheet · Klik Edit pada baris bulan untuk penyesuaian'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedMonth !== 'ALL' && (
              <button
                onClick={() => handleMonthChange('ALL')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Tampilkan Semua Bulan
              </button>
            )}

            {monthlyTotals.editedCount > 0 && !confirmResetAllMonths && (
              <button
                onClick={() => setConfirmResetAllMonths(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Edit Manual ({monthlyTotals.editedCount})</span>
              </button>
            )}

            {confirmResetAllMonths && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleResetAllMonths}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Ya, Kembalikan ke Google Sheet
                </button>
                <button
                  onClick={() => setConfirmResetAllMonths(false)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 text-center w-10">No</th>
                <th className="py-2.5 px-3">Bulan</th>
                <th className="py-2.5 px-3 text-right">Sell In (Rp)</th>
                <th className="py-2.5 px-3 text-right">Sell Out (Rp)</th>
                <th className="py-2.5 px-3 text-right">Selisih (Gap)</th>
                <th className="py-2.5 px-3 text-center">% Selisih</th>
                <th className="py-2.5 px-3 text-center">Sell-Through</th>
                <th className="py-2.5 px-3">Status Evaluasi</th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyRows.map((row) => {
                const isEditing = editingMonthKey === row.month;
                const isSelectedRow = selectedMonth === row.month;

                const liveSellIn = isEditing ? Math.max(0, Number(draftMonthSellIn) || 0) : row.sellInValue;
                const liveSellOut = isEditing ? Math.max(0, Number(draftMonthSellOut) || 0) : row.sellOutValue;
                const liveGap = liveSellIn - liveSellOut;
                const liveDenom = liveSellIn > 0 ? liveSellIn : liveSellOut > 0 ? liveSellOut : 0;
                const liveGapPct = liveDenom > 0 ? Math.round((liveGap / liveDenom) * 1000) / 10 : 0;
                const liveStPct = liveSellIn > 0 ? Math.round((liveSellOut / liveSellIn) * 1000) / 10 : 0;

                return (
                  <tr
                    key={row.month}
                    className={`transition-colors ${
                      isEditing
                        ? 'bg-indigo-50/50'
                        : isSelectedRow
                        ? 'bg-slate-100/90'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500">
                      {row.monthNumber}
                    </td>

                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleMonthChange(isSelectedRow ? 'ALL' : row.month)}
                        className={`text-left font-semibold cursor-pointer hover:text-indigo-700 transition-colors ${
                          isSelectedRow ? 'text-indigo-700 underline underline-offset-4' : 'text-slate-900'
                        }`}
                        title={isSelectedRow ? 'Klik untuk tampilkan semua bulan' : `Filter detail ke bulan ${row.month}`}
                      >
                        {row.month}
                      </button>
                      <div className="text-[11px] text-slate-400">
                        {row.isManualEdit ? 'Edit Manual' : `Sheet (${row.txSellInCount} IN / ${row.txSellOutCount} OUT)`}
                      </div>
                    </td>

                    {/* Sell In */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={draftMonthSellIn}
                          onChange={(e) => setDraftMonthSellIn(e.target.value)}
                          className="w-36 px-2 py-1 text-right text-xs font-mono font-semibold border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {formatRupiah(row.sellInValue, false)}
                          </span>
                          {row.isManualEdit && (
                            <span className="text-[10px] text-slate-400 block">
                              Sheet: {formatRupiah(row.sheetSellIn, true)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Sell Out */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={draftMonthSellOut}
                          onChange={(e) => setDraftMonthSellOut(e.target.value)}
                          className="w-36 px-2 py-1 text-right text-xs font-mono font-semibold border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <div>
                          <span className="font-semibold text-indigo-950 block">
                            {formatRupiah(row.sellOutValue, false)}
                          </span>
                          {row.isManualEdit && (
                            <span className="text-[10px] text-slate-400 block">
                              Sheet: {formatRupiah(row.sheetSellOut, true)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Gap */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      <span className={liveGap >= 0 ? 'text-indigo-700' : 'text-rose-600'}>
                        {liveGap >= 0 ? '+' : ''}
                        {formatRupiah(liveGap, false)}
                      </span>
                    </td>

                    {/* % Selisih */}
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                      <span
                        className={`font-semibold ${
                          Math.abs(liveGapPct) > 20 && (liveSellIn > 0 || liveSellOut > 0)
                            ? liveGapPct > 0
                              ? 'text-amber-700'
                              : 'text-rose-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {liveGapPct >= 0 ? '+' : ''}
                        {liveGapPct}%
                      </span>
                    </td>

                    {/* Sell-Through */}
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700">
                      {liveStPct}%
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-medium ${
                          row.statusType === 'empty'
                            ? 'text-slate-400'
                            : row.statusType === 'overstock'
                            ? 'text-amber-700'
                            : row.statusType === 'stockout_risk'
                            ? 'text-rose-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>

                    {/* Catatan */}
                    <td className="py-2.5 px-3 max-w-[180px]">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draftMonthNotes}
                          onChange={(e) => setDraftMonthNotes(e.target.value)}
                          placeholder="Catatan penyesuaian..."
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="text-slate-500 truncate block" title={row.notes || '-'}>
                          {row.notes || '-'}
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-2.5 px-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveEditMonth(row.month)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            <span>Simpan</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditMonth}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditMonth(row)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          {row.isManualEdit && (
                            <button
                              type="button"
                              onClick={() => handleResetSingleMonth(row.month)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Kembalikan ke angka Google Sheet"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-semibold">
                <td className="py-3 px-3 text-center">—</td>
                <td className="py-3 px-3">Total Akumulasi ({selectedYear})</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatRupiah(monthlyTotals.totalSellIn, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatRupiah(monthlyTotals.totalSellOut, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  <span className={monthlyTotals.totalGapValue >= 0 ? 'text-cyan-300' : 'text-rose-300'}>
                    {monthlyTotals.totalGapValue >= 0 ? '+' : ''}
                    {formatRupiah(monthlyTotals.totalGapValue, false)}
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums">
                  {monthlyTotals.avgGapPercent >= 0 ? '+' : ''}
                  {monthlyTotals.avgGapPercent}%
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums">
                  {monthlyTotals.sellThroughPercent}%
                </td>
                <td className="py-3 px-3 text-xs text-slate-300" colSpan={3}>
                  {monthlyTotals.editedCount > 0
                    ? `${monthlyTotals.editedCount} bulan menggunakan penyesuaian manual`
                    : '100% Realisasi Google Sheet'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Daftar Evaluasi Entitas (Bisa Diedit per Baris + Rincian Analisa) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Daftar Evaluasi {currentMeta.label} ({selectedMonth === 'ALL' ? 'Semua Bulan' : selectedMonth} {selectedYear}) · {filteredItems.length} Data
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{currentMeta.desc}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Cari nama ${currentMeta.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 text-center w-10">No</th>
                <th className="py-2.5 px-3">Nama {currentMeta.label}</th>
                <th className="py-2.5 px-3">Keterangan / Wilayah</th>
                <th className="py-2.5 px-3 text-right">Sell In (Rp)</th>
                <th className="py-2.5 px-3 text-right">Sell Out (Rp)</th>
                <th className="py-2.5 px-3 text-right">Selisih (Gap)</th>
                <th className="py-2.5 px-3 text-center">% Selisih</th>
                <th className="py-2.5 px-3 text-center">Sell-Through</th>
                <th className="py-2.5 px-3">Status Evaluasi</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, idx) => {
                const isEditing = editingEntityName === item.name;
                const isManual = hasEntityOverride(item.name);
                const liveSellIn = isEditing ? Math.max(0, Number(draftEntitySellIn) || 0) : item.sellInValue;
                const liveSellOut = isEditing ? Math.max(0, Number(draftEntitySellOut) || 0) : item.sellOutValue;
                const liveGap = liveSellIn - liveSellOut;
                const liveDenom = liveSellIn > 0 ? liveSellIn : liveSellOut > 0 ? liveSellOut : 0;
                const liveGapPct = liveDenom > 0 ? Math.round((liveGap / liveDenom) * 1000) / 10 : 0;
                const liveStPct = liveSellIn > 0 ? Math.round((liveSellOut / liveSellIn) * 1000) / 10 : 0;
                const isOver20 = (liveSellIn > 0 || liveSellOut > 0) && Math.abs(liveGapPct) > 20;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isEditing
                        ? 'bg-indigo-50/50'
                        : isOver20
                        ? item.statusType === 'overstock'
                          ? 'bg-amber-50/35 hover:bg-amber-50/60'
                          : 'bg-rose-50/35 hover:bg-rose-50/60'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900 block">{item.name}</span>
                      {item.storeName && activeDimension !== 'store' && (
                        <span className="text-[11px] text-slate-500 block">
                          Outlet: {item.storeName}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-slate-600">{item.secondaryInfo || '-'}</td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={draftEntitySellIn}
                          onChange={(e) => setDraftEntitySellIn(e.target.value)}
                          className="w-32 px-2 py-1 text-right text-xs font-mono font-semibold border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">
                          {formatRupiah(item.sellInValue, false)}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={draftEntitySellOut}
                          onChange={(e) => setDraftEntitySellOut(e.target.value)}
                          className="w-32 px-2 py-1 text-right text-xs font-mono font-semibold border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="font-semibold text-indigo-950">
                          {formatRupiah(item.sellOutValue, false)}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      <span className={liveGap >= 0 ? 'text-indigo-700' : 'text-rose-600'}>
                        {liveGap >= 0 ? '+' : ''}
                        {formatRupiah(liveGap, false)}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                      <span
                        className={`font-semibold ${
                          isOver20
                            ? liveGapPct > 0
                              ? 'text-amber-700'
                              : 'text-rose-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {liveGapPct >= 0 ? '+' : ''}
                        {liveGapPct}%
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700">
                      {liveStPct}%
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-medium ${
                          item.sellInValue === 0 && item.sellOutValue === 0
                            ? 'text-slate-400'
                            : isOver20
                            ? item.statusType === 'overstock'
                              ? 'text-amber-700'
                              : 'text-rose-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => saveEditEntity(item.name)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            <span>Simpan</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditEntity}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditEntity(item)}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          {isManual && (
                            <button
                              type="button"
                              onClick={() => handleResetEntity(item.name)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Kembalikan ke angka Google Sheet"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedItemModal(item)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
                          >
                            Rincian
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Tidak ada data Google Sheet yang cocok dengan kriteria filter saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detail Rincian Modal */}
      {selectedItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-indigo-700">{currentMeta.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {selectedMonth === 'ALL' ? 'Semua Bulan' : selectedMonth} {selectedYear}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedItemModal.name}</h3>
                <p className="text-xs text-slate-500">{selectedItemModal.secondaryInfo}</p>
              </div>
              <button
                onClick={() => setSelectedItemModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Total Sell In:</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 block mt-0.5">
                  {formatRupiah(selectedItemModal.sellInValue, false)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Total Sell Out:</span>
                <span className="font-mono tabular-nums font-bold text-indigo-900 block mt-0.5">
                  {formatRupiah(selectedItemModal.sellOutValue, false)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Selisih Nilai (Gap):</span>
                <span
                  className={`font-mono tabular-nums font-bold block mt-0.5 ${
                    selectedItemModal.gapValue >= 0 ? 'text-indigo-700' : 'text-rose-600'
                  }`}
                >
                  {selectedItemModal.gapValue >= 0 ? '+' : ''}
                  {formatRupiah(selectedItemModal.gapValue, false)} ({selectedItemModal.gapPercent}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Sell-Through Rate:</span>
                <span className="font-mono tabular-nums font-bold text-slate-800 block mt-0.5">
                  {selectedItemModal.sellThroughPercent}%
                </span>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-600" />
                Diagnosa &amp; Analisis Aliran Barang
              </span>
              <p className="text-slate-600 leading-relaxed">
                {selectedItemModal.rootCauseAnalysis}
              </p>
            </div>

            <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Rekomendasi Tindak Lanjut
              </span>
              <p className="leading-relaxed whitespace-pre-line text-slate-600">
                {selectedItemModal.recommendedAction}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedItemModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
