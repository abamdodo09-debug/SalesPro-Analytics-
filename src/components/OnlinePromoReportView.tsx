import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Percent,
  PlusCircle,
  Search,
  Store,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  DashboardFilters,
  OnlinePromoReportComputedItem,
  OnlinePromoReportItem,
  TransactionRecord,
} from '../types/dashboard';
import { formatRupiah } from '../utils/analytics';
import {
  aggregateDailyOnlinePromoRecap,
  aggregateMonthlyOnlinePromoRecap,
  analyzeMonthlyPromoPotential,
  clearAllOnlinePromoReports,
  computeOnlinePromoGrowth,
  deleteOnlinePromoReport,
  deriveMonthPeriodFromIsoDate,
  formatDisplayDateId,
  loadOnlinePromoReports,
  upsertOnlinePromoReport,
} from '../services/onlinePromoService';
import { getDefaultRunningMonth, MONTH_OPTIONS_2026 } from '../services/salesVisitService';

interface OnlinePromoReportViewProps {
  records?: TransactionRecord[];
  filters: DashboardFilters;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

function parseFreeActualInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/^rp\s*/i, '').replace(/\s+/g, '');
  if (!cleaned) return null;

  const signMatch = cleaned.match(/^([+-])?(.*)$/);
  const sign = signMatch?.[1] === '-' ? -1 : 1;
  const body = signMatch?.[2] ?? '';
  if (!body) return null;

  if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
    const val = Number(body.replace(/\./g, ''));
    return Number.isFinite(val) ? sign * val : null;
  }

  if (/^\d{1,3}(,\d{3})+$/.test(body)) {
    const val = Number(body.replace(/,/g, ''));
    return Number.isFinite(val) ? sign * val : null;
  }

  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(body)) {
    const val = Number(body.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(val) ? sign * val : null;
  }

  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(body)) {
    const val = Number(body.replace(/,/g, ''));
    return Number.isFinite(val) ? sign * val : null;
  }

  const normalized = body.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const val = Number(normalized);
  return Number.isFinite(val) ? sign * val : null;
}

export const OnlinePromoReportView: React.FC<OnlinePromoReportViewProps> = ({
  filters,
  onNotify,
}) => {
  // 100% Manual dataset (starts completely empty as requested)
  const [items, setItems] = useState<OnlinePromoReportItem[]>(() =>
    loadOnlinePromoReports()
  );

  const monthOptions = useMemo(() => {
    const base = [...MONTH_OPTIONS_2026];
    items.forEach((i) => {
      const m = (i.monthPeriod || '').trim().toUpperCase();
      if (m && !base.includes(m)) base.push(m);
    });
    return base;
  }, [items]);

  const defaultMonth = useMemo(
    () => getDefaultRunningMonth(filters.BULAN, filters.TAHUN),
    [filters.BULAN, filters.TAHUN]
  );

  // Add Form state (all manual)
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newMonthPeriod, setNewMonthPeriod] = useState<string>(() =>
    deriveMonthPeriodFromIsoDate(new Date().toISOString().slice(0, 10))
  );
  const [newActualStr, setNewActualStr] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Inline table edit state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState<string>('');
  const [editMonthPeriod, setEditMonthPeriod] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editActualStr, setEditActualStr] = useState<string>('');

  // Filters, View Toggles & Confirmations
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [filterStore, setFilterStore] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMainTableExpanded, setIsMainTableExpanded] = useState<boolean>(true);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [analysisMonthFilter, setAnalysisMonthFilter] = useState<string>('ALL');
  const [hoveredDayDetailKey, setHoveredDayDetailKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      setNewMonthPeriod(defaultMonth);
    }
  }, [defaultMonth, filters.BULAN]);

  // Compute Daily & Monthly Growth automatically across all manual entries
  const computedItems = useMemo(() => computeOnlinePromoGrowth(items), [items]);

  // Autocomplete list strictly from stores already manually entered by user
  const manualStoreOptions = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((i) => {
      const clean = i.storeName.trim();
      if (clean) map[clean.toUpperCase()] = clean;
    });
    return Object.values(map).sort((a, b) => a.localeCompare(b, 'id-ID'));
  }, [items]);

  // Preview Growth (Per Hari & Bulanan) for the Add Form
  const addPreview = useMemo(() => {
    const parsedActual = parseFreeActualInput(newActualStr);
    if (!newStoreName.trim() || parsedActual === null) {
      return null;
    }
    const tempId = '__add_preview__';
    const tempItem: OnlinePromoReportItem = {
      id: tempId,
      storeName: newStoreName.trim(),
      monthPeriod: newMonthPeriod,
      date: newDate,
      actual: parsedActual,
      createdAt: new Date().toISOString(),
    };
    const simulated = computeOnlinePromoGrowth([...items, tempItem]);
    return simulated.find((x) => x.id === tempId) || null;
  }, [newStoreName, newMonthPeriod, newDate, newActualStr, items]);

  // Live preview during inline row editing
  const editPreview = useMemo(() => {
    if (!editingRowId) return null;
    const parsedActual = parseFreeActualInput(editActualStr);
    const simulated = items.map((x) =>
      x.id === editingRowId
        ? {
            ...x,
            storeName: editStoreName.trim() || x.storeName,
            monthPeriod: editMonthPeriod || x.monthPeriod,
            date: editDate || x.date,
            actual: parsedActual !== null ? parsedActual : x.actual,
          }
        : x
    );
    return computeOnlinePromoGrowth(simulated).find((x) => x.id === editingRowId) || null;
  }, [editingRowId, editStoreName, editMonthPeriod, editDate, editActualStr, items]);

  // Recaps: Per Hari, Bulanan, & Analisa Durasi + Tanggal Potensi
  const dailyRecap = useMemo(() => aggregateDailyOnlinePromoRecap(items), [items]);
  const monthlyRecap = useMemo(() => aggregateMonthlyOnlinePromoRecap(items), [items]);
  const monthlyPotentialAnalysis = useMemo(
    () => analyzeMonthlyPromoPotential(items),
    [items]
  );

  const filteredPotentialAnalysis = useMemo(() => {
    if (analysisMonthFilter === 'ALL') return monthlyPotentialAnalysis;
    return monthlyPotentialAnalysis.filter(
      (m) => m.monthPeriod.toUpperCase() === analysisMonthFilter.toUpperCase()
    );
  }, [monthlyPotentialAnalysis, analysisMonthFilter]);

  const maxMonthlyActual = useMemo(
    () => Math.max(...monthlyRecap.map((m) => m.totalActual), 1),
    [monthlyRecap]
  );

  const peakMonthlyIndex = useMemo(() => {
    let bestIdx = -1;
    let bestVal = -Infinity;
    monthlyRecap.forEach((m, idx) => {
      if (m.totalActual > bestVal) {
        bestVal = m.totalActual;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [monthlyRecap]);

  // Filtered table items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return computedItems.filter((item) => {
      if (filterMonth !== 'ALL' && item.monthPeriod.toUpperCase() !== filterMonth.toUpperCase()) {
        return false;
      }
      if (filterDate !== 'ALL' && item.date !== filterDate) {
        return false;
      }
      if (filterStore !== 'ALL' && item.storeName.trim().toUpperCase() !== filterStore.toUpperCase()) {
        return false;
      }
      if (q) {
        const hay = `${item.storeName} ${item.monthPeriod} ${item.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [computedItems, filterMonth, filterDate, filterStore, searchQuery]);

  // Summary KPIs
  const kpiSummary = useMemo(() => {
    const totalActual = filteredItems.reduce((acc, cur) => acc + cur.actual, 0);
    const latestDay = dailyRecap[0] || null;
    const latestMonth = monthlyRecap[monthlyRecap.length - 1] || null;
    return {
      totalActual,
      latestDayGrowth: latestDay?.growthPercent ?? null,
      latestDayLabel: latestDay ? formatDisplayDateId(latestDay.date) : null,
      latestMonthGrowth: latestMonth?.growthPercent ?? null,
      latestMonthLabel: latestMonth?.monthPeriod ?? null,
      storeCount: manualStoreOptions.length,
      rowCount: filteredItems.length,
    };
  }, [filteredItems, dailyRecap, monthlyRecap, manualStoreOptions.length]);

  // Handlers
  const handleAddManualRow = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedStore = newStoreName.trim();
    const parsedActual = parseFreeActualInput(newActualStr);

    if (!trimmedStore) {
      setFormError('Nama Toko wajib diisi.');
      return;
    }
    if (!newMonthPeriod.trim()) {
      setFormError('Bulan wajib dipilih.');
      return;
    }
    if (!newDate.trim()) {
      setFormError('Tanggal wajib diisi.');
      return;
    }
    if (parsedActual === null) {
      setFormError('Nominal Actual wajib diisi dengan angka yang valid.');
      return;
    }

    const newItem: OnlinePromoReportItem = {
      id: `promo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      storeName: trimmedStore,
      monthPeriod: newMonthPeriod.trim().toUpperCase(),
      date: newDate,
      actual: parsedActual,
      createdAt: new Date().toISOString(),
    };

    const nextList = upsertOnlinePromoReport(items, newItem);
    setItems(nextList);
    setNewStoreName('');
    setNewActualStr('');
    onNotify?.(
      `Data promo "${newItem.storeName}" (${formatDisplayDateId(newItem.date)}) berhasil disimpan.`,
      'success'
    );
  };

  const handleStartEdit = (row: OnlinePromoReportComputedItem) => {
    setConfirmDeleteId(null);
    setEditingRowId(row.id);
    setEditStoreName(row.storeName);
    setEditMonthPeriod(row.monthPeriod);
    setEditDate(row.date);
    setEditActualStr(String(row.actual));
  };

  const handleSaveEdit = (id: string) => {
    const existing = items.find((i) => i.id === id);
    if (!existing) return;

    const trimmedStore = editStoreName.trim();
    const parsedActual = parseFreeActualInput(editActualStr);

    if (!trimmedStore || !editMonthPeriod.trim() || !editDate.trim() || parsedActual === null) {
      onNotify?.('Nama Toko, Bulan, Tanggal, dan Actual wajib diisi dengan angka yang valid.', 'error');
      return;
    }

    const updated: OnlinePromoReportItem = {
      ...existing,
      storeName: trimmedStore,
      monthPeriod: editMonthPeriod.trim().toUpperCase(),
      date: editDate,
      actual: parsedActual,
      updatedAt: new Date().toISOString(),
    };

    const nextList = upsertOnlinePromoReport(items, updated);
    setItems(nextList);
    setEditingRowId(null);
    onNotify?.(`Baris "${updated.storeName}" (${formatDisplayDateId(updated.date)}) berhasil diperbarui.`, 'success');
  };

  const handleDeleteRow = (id: string) => {
    const target = items.find((i) => i.id === id);
    const nextList = deleteOnlinePromoReport(items, id);
    setItems(nextList);
    setConfirmDeleteId(null);
    if (editingRowId === id) setEditingRowId(null);
    onNotify?.(`Baris "${target?.storeName || ''}" berhasil dihapus.`, 'success');
  };

  const handleClearAllData = () => {
    const empty = clearAllOnlinePromoReports();
    setItems(empty);
    setEditingRowId(null);
    setConfirmDeleteId(null);
    setConfirmClearAll(false);
    setFilterMonth('ALL');
    setFilterDate('ALL');
    setFilterStore('ALL');
    setSearchQuery('');
    onNotify?.('Semua data Report Promo Toko Online telah dikosongkan.', 'success');
  };

  const renderGrowthPill = (
    pct: number | null,
    delta: number | null,
    compareLabel: string | null,
    prevVal: number | null,
    emptyText: string
  ) => {
    if (pct === null || prevVal === null) {
      return (
        <div className="inline-flex flex-col items-end">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold">
            {emptyText}
          </span>
        </div>
      );
    }

    const isPositive = pct >= 0;
    const pctText = `${isPositive ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`;
    const deltaText =
      delta !== null
        ? `${delta >= 0 ? '+' : '-'}${formatRupiah(Math.abs(delta), true)}`
        : '';

    return (
      <div className="inline-flex flex-col items-end">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-extrabold tabular-nums ${
            isPositive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-emerald-600" />
          ) : (
            <TrendingDown className="w-3 h-3 text-rose-600" />
          )}
          <span>{pctText}</span>
        </span>
        <span className="text-[10px] text-slate-500 font-mono tabular-nums mt-0.5">
          {deltaText} vs {compareLabel}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-sm shrink-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Report Promo Toko Online (100% Input Manual)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Input manual <span className="font-bold text-slate-800">Nama Toko, Bulan, Tanggal, dan Actual</span>. Sistem menghitung otomatis <span className="font-bold text-emerald-700">Growth Pencapaian Per Hari</span> &amp; <span className="font-bold text-blue-700">Growth Pencapaian Bulanan</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {items.length > 0 && (
            confirmClearAll ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                <span className="text-xs font-bold text-rose-800">
                  Kosongkan semua ({items.length} baris)?
                </span>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Ya, Kosongkan
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Kosongkan Semua Data</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Actual (Manual)
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {formatRupiah(kpiSummary.totalActual, true)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            {formatRupiah(kpiSummary.totalActual)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Growth Per Hari Terbaru
          </div>
          <div
            className={`mt-1.5 text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${
              kpiSummary.latestDayGrowth === null
                ? 'text-slate-400'
                : kpiSummary.latestDayGrowth >= 0
                ? 'text-emerald-700'
                : 'text-rose-700'
            }`}
          >
            {kpiSummary.latestDayGrowth === null
              ? '-'
              : `${kpiSummary.latestDayGrowth >= 0 ? '+' : ''}${kpiSummary.latestDayGrowth
                  .toFixed(1)
                  .replace('.', ',')}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpiSummary.latestDayLabel ? `Tanggal ${kpiSummary.latestDayLabel}` : 'Belum ada data harian'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
            Growth Bulanan Terbaru
          </div>
          <div
            className={`mt-1.5 text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${
              kpiSummary.latestMonthGrowth === null
                ? 'text-slate-400'
                : kpiSummary.latestMonthGrowth >= 0
                ? 'text-emerald-700'
                : 'text-rose-700'
            }`}
          >
            {kpiSummary.latestMonthGrowth === null
              ? '-'
              : `${kpiSummary.latestMonthGrowth >= 0 ? '+' : ''}${kpiSummary.latestMonthGrowth
                  .toFixed(1)
                  .replace('.', ',')}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpiSummary.latestMonthLabel || 'Belum ada data bulanan'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Baris / Toko
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {kpiSummary.rowCount} <span className="text-sm font-bold text-slate-400">/ {kpiSummary.storeCount} toko</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">100% data manual</div>
        </div>
      </div>

      {/* Add Manual Row Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Input Manual Report Promo Toko Online
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Growth Per Hari &amp; Bulanan terhitung otomatis saat disimpan
          </span>
        </div>

        <form onSubmit={handleAddManualRow} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Nama Toko */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Toko <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  list="manual-promo-stores"
                  value={newStoreName}
                  onChange={(e) => {
                    setNewStoreName(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Ketik nama toko online (misal: SHOPEE, TIKTOK SHOP, BLUMEE)..."
                  className="w-full pl-8 pr-7 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newStoreName && (
                  <button
                    type="button"
                    onClick={() => setNewStoreName('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <datalist id="manual-promo-stores">
                {manualStoreOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Tanggal */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewDate(val);
                  if (val) setNewMonthPeriod(deriveMonthPeriodFromIsoDate(val));
                  setFormError(null);
                }}
                className="w-full px-2.5 py-2 text-xs font-mono font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Bulan */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bulan <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={newMonthPeriod}
                  onChange={(e) => setNewMonthPeriod(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actual */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Actual (Rp) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={newActualStr}
                onChange={(e) => {
                  setNewActualStr(e.target.value);
                  setFormError(null);
                }}
                placeholder="Angka bebas, misal: 15250500"
                className="w-full px-3 py-2 text-xs font-mono font-bold tabular-nums rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Simpan */}
            <div className="lg:col-span-1">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>

          {addPreview && (
            <div className="px-4 py-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold text-blue-950">
                  Pratinjau Growth Otomatis ({addPreview.storeName}):
                </span>
                <span className="font-mono font-extrabold text-slate-900 tabular-nums">
                  {formatRupiah(addPreview.actual)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Per Hari:</span>
                  {renderGrowthPill(
                    addPreview.dailyGrowthPercent,
                    addPreview.dailyGrowthDelta,
                    addPreview.dailyPreviousDate
                      ? formatDisplayDateId(addPreview.dailyPreviousDate)
                      : null,
                    addPreview.dailyPreviousActual,
                    'Hari Awal (-)'
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Bulanan:</span>
                  {renderGrowthPill(
                    addPreview.monthlyGrowthPercent,
                    addPreview.monthlyGrowthDelta,
                    addPreview.monthlyPreviousLabel,
                    addPreview.monthlyPreviousActual,
                    'Bulan Awal (-)'
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Main Editable Table (Collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className={`px-5 py-4 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
            isMainTableExpanded ? 'border-b border-slate-200' : ''
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">
                Tabel Report Promo Toko Online ({filteredItems.length} Baris)
              </h3>
              {!isMainTableExpanded && (
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  · Total Actual {formatRupiah(kpiSummary.totalActual)} (Tabel disembunyikan)
                </span>
              )}
            </div>
            {isMainTableExpanded && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Klik <span className="font-bold text-amber-700">Edit</span> untuk mengubah Nama Toko, Bulan, Tanggal, atau Actual langsung di tabel.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isMainTableExpanded && (
              <>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari toko / tanggal..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="ALL">Semua Bulan</option>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white max-w-[190px]"
                >
                  <option value="ALL">Semua Toko</option>
                  {manualStoreOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {(filterMonth !== 'ALL' || filterDate !== 'ALL' || filterStore !== 'ALL' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMonth('ALL');
                      setFilterDate('ALL');
                      setFilterStore('ALL');
                      setSearchQuery('');
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setIsMainTableExpanded((prev) => !prev)}
              aria-expanded={isMainTableExpanded}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              {isMainTableExpanded ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sembunyikan Tabel</span>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tampilkan Tabel</span>
                  <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                </>
              )}
            </button>
          </div>
        </div>

        {isMainTableExpanded && (filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Tag className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {items.length === 0
                ? 'Data Report Promo Toko Online masih kosong'
                : 'Tidak ada data yang cocok dengan filter ini'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {items.length === 0
                ? 'Silakan input data promo toko online secara manual melalui form di atas. Growth Per Hari dan Growth Bulanan akan dihitung otomatis.'
                : 'Ubah atau reset filter di atas untuk melihat baris data lain.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700">
                  <th className="text-center font-extrabold px-3 py-3 w-12">No</th>
                  <th className="text-left font-extrabold px-3 py-3">Nama Toko</th>
                  <th className="text-left font-extrabold px-3 py-3">Bulan</th>
                  <th className="text-left font-extrabold px-3 py-3">Tanggal</th>
                  <th className="text-right font-extrabold px-3 py-3">Actual</th>
                  <th className="text-right font-extrabold px-3 py-3 text-emerald-800">
                    Growth Per Hari (Otomatis)
                  </th>
                  <th className="text-right font-extrabold px-3 py-3 text-blue-800">
                    Growth Bulanan (Otomatis)
                  </th>
                  <th className="text-center font-extrabold px-3 py-3 w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((row, idx) => {
                  const isEditing = editingRowId === row.id;
                  const isDeleting = confirmDeleteId === row.id;

                  if (isEditing) {
                    const live = editPreview || row;
                    return (
                      <tr key={row.id} className="bg-amber-50/70 align-top">
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]">
                          <input
                            type="text"
                            list="manual-promo-stores"
                            value={editStoreName}
                            onChange={(e) => setEditStoreName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-2.5 min-w-[140px]">
                          <select
                            value={editMonthPeriod}
                            onChange={(e) => setEditMonthPeriod(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                          >
                            {monthOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 min-w-[135px]">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditDate(val);
                              if (val) setEditMonthPeriod(deriveMonthPeriodFromIsoDate(val));
                            }}
                            className="w-full px-2 py-1.5 text-xs font-mono font-semibold rounded-lg border border-amber-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-2.5 min-w-[150px]">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editActualStr}
                            onChange={(e) => setEditActualStr(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-extrabold text-right tabular-nums rounded-lg border border-amber-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right min-w-[160px]">
                          {renderGrowthPill(
                            live.dailyGrowthPercent,
                            live.dailyGrowthDelta,
                            live.dailyPreviousDate
                              ? formatDisplayDateId(live.dailyPreviousDate)
                              : null,
                            live.dailyPreviousActual,
                            'Hari Awal (-)'
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right min-w-[160px]">
                          {renderGrowthPill(
                            live.monthlyGrowthPercent,
                            live.monthlyGrowthDelta,
                            live.monthlyPreviousLabel,
                            live.monthlyPreviousActual,
                            'Bulan Awal (-)'
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(row.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRowId(null)}
                              className="px-2 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 font-extrabold text-slate-900">
                        <div>{row.storeName}</div>
                        {row.updatedAt && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 mt-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Diedit manual</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700 whitespace-nowrap">
                        {row.monthPeriod}
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                        {formatDisplayDateId(row.date)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(row.actual)}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {renderGrowthPill(
                          row.dailyGrowthPercent,
                          row.dailyGrowthDelta,
                          row.dailyPreviousDate
                            ? formatDisplayDateId(row.dailyPreviousDate)
                            : null,
                          row.dailyPreviousActual,
                          'Hari Awal (-)'
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {renderGrowthPill(
                          row.monthlyGrowthPercent,
                          row.monthlyGrowthDelta,
                          row.monthlyPreviousLabel,
                          row.monthlyPreviousActual,
                          'Bulan Awal (-)'
                        )}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {isDeleting ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Ya
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(row)}
                              className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(row.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold">
                  <td colSpan={4} className="px-4 py-3 text-left">
                    TOTAL ACTUAL ({filteredItems.length} Baris)
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {formatRupiah(kpiSummary.totalActual)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>

      {/* Rekapan Pencapaian Bulanan (Growth MoM) + Grafik */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-blue-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Rekapan Pencapaian Bulanan (Growth MoM) &amp; Grafik
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Grafik perbandingan Actual &amp; laju Growth MoM per bulan. Klik batang grafik atau baris tabel untuk memfilter tabel utama.
                </p>
              </div>
            </div>
            {filterMonth !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterMonth('ALL')}
                className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Semua Bulan
              </button>
            )}
          </div>

          {/* Monthly Bar & Growth MoM Chart */}
          <div className="p-5 border-b border-slate-200">
            <div className="relative pt-6">
              {hoveredMonthIndex !== null && monthlyRecap[hoveredMonthIndex] && (() => {
                const hm = monthlyRecap[hoveredMonthIndex];
                return (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs z-20 pointer-events-none border border-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{hm.monthPeriod}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono text-slate-300">
                        {hm.promoDaysCount} hari promo ({hm.storeCount} toko)
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-emerald-400 font-extrabold text-sm">
                        {formatRupiah(hm.totalActual)}
                      </span>
                      {hm.growthPercent !== null && (
                        <span
                          className={`font-bold text-[11px] ${
                            hm.growthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          MoM {hm.growthPercent >= 0 ? '+' : ''}
                          {hm.growthPercent.toFixed(1).replace('.', ',')}% (
                          {hm.growthDelta !== null
                            ? `${hm.growthDelta >= 0 ? '+' : '-'}${formatRupiah(Math.abs(hm.growthDelta), true)}`
                            : ''}
                          )
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-stretch gap-3">
                {/* Left Y-axis */}
                <div className="hidden sm:flex flex-col justify-between text-right font-mono text-[10px] text-slate-400 tabular-nums py-7 pr-2 border-r border-slate-100 shrink-0 w-20">
                  <span>{formatRupiah(maxMonthlyActual, true)}</span>
                  <span>{formatRupiah(maxMonthlyActual * 0.5, true)}</span>
                  <span>Rp 0</span>
                </div>

                {/* Bars area */}
                <div className="flex-1 flex items-end gap-3 sm:gap-5 h-64 pt-10 pb-2 overflow-x-auto">
                  {monthlyRecap.map((row, idx) => {
                    const heightPct =
                      maxMonthlyActual > 0
                        ? Math.max(6, (Math.max(0, row.totalActual) / maxMonthlyActual) * 100)
                        : 6;
                    const isPeak = idx === peakMonthlyIndex && row.totalActual > 0;
                    const isSelected = filterMonth.toUpperCase() === row.monthPeriod.toUpperCase();
                    const isPositive = row.growthPercent !== null && row.growthPercent >= 0;

                    return (
                      <button
                        key={row.monthPeriod}
                        type="button"
                        onClick={() =>
                          setFilterMonth(
                            filterMonth === row.monthPeriod ? 'ALL' : row.monthPeriod
                          )
                        }
                        onMouseEnter={() => setHoveredMonthIndex(idx)}
                        onMouseLeave={() => setHoveredMonthIndex(null)}
                        className="flex-1 min-w-[74px] max-w-[130px] flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none"
                      >
                        <div className="mb-1.5 flex flex-col items-center">
                          {row.growthPercent !== null ? (
                            <span
                              className={`text-[10px] font-mono font-extrabold tabular-nums leading-none ${
                                isPositive ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {row.growthPercent.toFixed(1).replace('.', ',')}%
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400 leading-none">
                              Awal
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-mono font-extrabold tabular-nums mt-1 ${
                              isSelected
                                ? 'text-blue-700'
                                : isPeak
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {formatRupiah(row.totalActual, true)}
                          </span>
                        </div>

                        <div className="w-full relative flex items-end justify-center h-full px-2">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full max-w-[56px] rounded-t-md transition-all duration-200 ${
                              isSelected
                                ? 'bg-blue-700 ring-2 ring-blue-300'
                                : isPeak
                                ? 'bg-emerald-600 group-hover:bg-emerald-700'
                                : 'bg-sky-600 group-hover:bg-sky-700'
                            }`}
                          />
                        </div>

                        <div className="mt-2 text-center w-full">
                          <span
                            className={`block text-[11px] font-bold truncate ${
                              isSelected
                                ? 'text-blue-800'
                                : isPeak
                                ? 'text-emerald-800'
                                : 'text-slate-800'
                            }`}
                          >
                            {row.monthPeriod}
                          </span>
                          <span className="block text-[10px] font-mono text-slate-500 tabular-nums">
                            {row.promoDaysCount} hr promo
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-4 font-medium">
                  <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                    Puncak Bulanan ({peakMonthlyIndex >= 0 ? monthlyRecap[peakMonthlyIndex]?.monthPeriod : '-'})
                  </span>
                  <span className="flex items-center gap-1.5 text-sky-800">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
                    Bulan Lainnya
                  </span>
                  {filterMonth !== 'ALL' && (
                    <span className="flex items-center gap-1.5 text-blue-800 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" />
                      Filter Aktif ({filterMonth})
                    </span>
                  )}
                </div>
                <span className="font-mono text-slate-600 font-semibold tabular-nums">
                  {monthlyRecap.length} Bulan Tercatat
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                  <th className="text-left font-extrabold px-5 py-3">Bulan</th>
                  <th className="text-center font-extrabold px-3 py-3">Hari Promo</th>
                  <th className="text-center font-extrabold px-3 py-3">Toko</th>
                  <th className="text-right font-extrabold px-3 py-3">Rata-rata / Hari</th>
                  <th className="text-right font-extrabold px-3 py-3">Actual Bulanan</th>
                  <th className="text-right font-extrabold px-5 py-3">Growth Bulanan (MoM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyRecap.map((row) => (
                  <tr
                    key={row.monthPeriod}
                    onClick={() =>
                      setFilterMonth(
                        filterMonth === row.monthPeriod ? 'ALL' : row.monthPeriod
                      )
                    }
                    className={`cursor-pointer transition-colors ${
                      filterMonth === row.monthPeriod
                        ? 'bg-blue-50/80 font-bold'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-5 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {row.monthPeriod}
                    </td>
                    <td className="px-3 py-3 text-center font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.promoDaysCount} hr{' '}
                      <span className="text-slate-400">/ {row.calendarDaysInMonth} hr</span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono tabular-nums text-slate-600">
                      {row.storeCount}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {formatRupiah(row.avgPerPromoDay)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(row.totalActual)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {renderGrowthPill(
                        row.growthPercent,
                        row.growthDelta,
                        row.previousMonthPeriod,
                        row.previousTotalActual,
                        'Bulan Awal (-)'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analisa Durasi Promo & Tanggal Potensi per Bulan */}
      {items.length > 0 && monthlyPotentialAnalysis.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Analisa Durasi Promo &amp; Tanggal Potensi per Bulan
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ringkasan berapa hari promo dijalankan serta tanggal-tanggal dengan potensi terbaik (di atas rata-rata harian bulan tersebut).
                </p>
              </div>
            </div>

            {monthlyPotentialAnalysis.length > 1 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-600">Lihat Bulan:</span>
                <select
                  value={analysisMonthFilter}
                  onChange={(e) => setAnalysisMonthFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                >
                  <option value="ALL">Semua Bulan ({monthlyPotentialAnalysis.length})</option>
                  {monthlyPotentialAnalysis.map((m) => (
                    <option key={m.monthPeriod} value={m.monthPeriod}>
                      {m.monthPeriod}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Ringkasan Tabel Cepat per Bulan */}
          <div className="overflow-x-auto border-b border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                  <th className="text-left font-extrabold px-5 py-3">Bulan</th>
                  <th className="text-left font-extrabold px-3 py-3">Durasi Promo Dijalankan</th>
                  <th className="text-left font-extrabold px-3 py-3">Tanggal Potensi Tinggi (&ge; Rata-rata)</th>
                  <th className="text-left font-extrabold px-3 py-3">Tanggal Puncak</th>
                  <th className="text-right font-extrabold px-3 py-3">Rata-rata / Hari</th>
                  <th className="text-right font-extrabold px-5 py-3">Total Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPotentialAnalysis.map((m) => (
                  <tr
                    key={m.monthPeriod}
                    onClick={() =>
                      setFilterMonth(
                        filterMonth === m.monthPeriod ? 'ALL' : m.monthPeriod
                      )
                    }
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 font-extrabold text-slate-900 whitespace-nowrap">
                      {m.monthPeriod}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {m.promoDaysCount} Hari Promo
                        <span className="text-slate-400 font-normal">
                          {' '}
                          / {m.calendarDaysInMonth} hr ({m.coveragePercent.toFixed(1).replace('.', ',')}%)
                        </span>
                      </div>
                      {m.firstPromoDate && m.lastPromoDate && (
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                          {formatDisplayDateId(m.firstPromoDate)} s/d {formatDisplayDateId(m.lastPromoDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {m.potentialDates.length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div>
                          <div className="font-mono font-bold text-emerald-800 tabular-nums">
                            Tgl {m.potentialDates.map((d) => d.dayOfMonth).join(', ')}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {m.potentialDates.length} hari di atas rata-rata harian
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {m.peakDate ? (
                        <div>
                          <div className="font-mono font-bold text-slate-900 tabular-nums flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{formatDisplayDateId(m.peakDate.date)}</span>
                          </div>
                          <div className="text-[11px] font-mono text-emerald-700 tabular-nums mt-0.5">
                            {formatRupiah(m.peakDate.totalActual, true)} ({m.peakDate.sharePercent.toFixed(1).replace('.', ',')}% bulan)
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {formatRupiah(m.avgDailyActual)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(m.totalActual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail Peta Tanggal Kalender & Tanggal Potensi per Bulan */}
          <div className="divide-y divide-slate-200">
            {filteredPotentialAnalysis.map((m) => {
              const daysArray = Array.from({ length: m.calendarDaysInMonth }, (_, i) => i + 1);
              const hoveredDay = hoveredDayDetailKey
                ? m.allActiveDates.find((d) => `${m.monthPeriod}-${d.date}` === hoveredDayDetailKey) || null
                : null;
              const selectedDayInMonth =
                filterDate !== 'ALL'
                  ? m.allActiveDates.find((d) => d.date === filterDate) || null
                  : null;
              const inspectedDay = hoveredDay || selectedDayInMonth || m.peakDate;

              return (
                <div key={m.monthPeriod} className="p-5 space-y-4">
                  {/* Month Subheader with clean unboxed metadata */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <h4 className="text-sm font-extrabold text-slate-900">{m.monthPeriod}</h4>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {m.promoDaysCount} dari {m.calendarDaysInMonth} hari promo ({m.coveragePercent.toFixed(1).replace('.', ',')}%)
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="text-xs text-slate-600 font-mono tabular-nums">
                        Rata-rata {formatRupiah(m.avgDailyActual)}/hari
                      </span>
                      {m.peakDate && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-xs font-bold text-emerald-700 font-mono tabular-nums">
                            Puncak Tgl {m.peakDate.dayOfMonth} ({formatRupiah(m.peakDate.totalActual, true)})
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                      Total {formatRupiah(m.totalActual)} · {m.storeCount} toko · {m.entryCount} entri
                    </div>
                  </div>

                  {/* Two-column layout: Calendar Day Map + Potential Dates Ranking */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    {/* Left: Interactive 1..30/31 Day Map */}
                    <div className="xl:col-span-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          Peta Kalender Tanggal Promo (Tgl 1–{m.calendarDaysInMonth})
                        </span>
                        {filterDate !== 'ALL' && selectedDayInMonth && (
                          <button
                            type="button"
                            onClick={() => setFilterDate('ALL')}
                            className="text-[11px] font-bold text-blue-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Reset Tanggal
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {daysArray.map((dayNum) => {
                          const detail = m.activeDayMap[dayNum];
                          if (!detail) {
                            return (
                              <div
                                key={dayNum}
                                title={`Tgl ${dayNum} — Tidak ada promo`}
                                className="h-8 rounded-lg border border-slate-100 bg-slate-50 text-slate-300 font-mono text-[11px] tabular-nums flex items-center justify-center select-none"
                              >
                                {dayNum}
                              </div>
                            );
                          }

                          const isSelectedDate = filterDate === detail.date;
                          const hoverKey = `${m.monthPeriod}-${detail.date}`;
                          const cellClass = detail.isPeakDay
                            ? 'bg-emerald-600 text-white border-emerald-700 font-extrabold hover:bg-emerald-700'
                            : detail.isAboveAverage
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold hover:bg-emerald-200'
                            : 'bg-sky-50 text-sky-900 border-sky-200 font-semibold hover:bg-sky-100';

                          return (
                            <button
                              key={dayNum}
                              type="button"
                              onClick={() =>
                                setFilterDate(isSelectedDate ? 'ALL' : detail.date)
                              }
                              onMouseEnter={() => setHoveredDayDetailKey(hoverKey)}
                              onMouseLeave={() => setHoveredDayDetailKey(null)}
                              title={`${formatDisplayDateId(detail.date)}: ${formatRupiah(detail.totalActual)} (${detail.storeNames.join(', ')})`}
                              className={`h-8 rounded-lg border font-mono text-[11px] tabular-nums flex items-center justify-center transition-colors cursor-pointer ${cellClass} ${
                                isSelectedDate ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                              }`}
                            >
                              {dayNum}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600 pt-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                          Puncak
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 border border-emerald-400 inline-block" />
                          Potensi Tinggi (&ge; Rata-rata)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-sky-100 border border-sky-300 inline-block" />
                          Hari Promo Lain
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-slate-100 border border-slate-200 inline-block" />
                          Kosong
                        </span>
                      </div>

                      {/* Inspected day readout */}
                      {inspectedDay && (
                        <div className="pt-2 border-t border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 font-mono tabular-nums">
                              {formatDisplayDateId(inspectedDay.date)}
                            </span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-600">
                              {inspectedDay.storeNames.join(', ') || '-'}
                            </span>
                          </div>
                          <div className="font-mono font-extrabold text-emerald-700 tabular-nums">
                            {formatRupiah(inspectedDay.totalActual)} ({inspectedDay.sharePercent.toFixed(1).replace('.', ',')}%)
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Ranked Potential Dates Table */}
                    <div className="xl:col-span-7 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-800">
                          Daftar Tanggal Potensi di {m.monthPeriod} ({m.potentialDates.length} Tanggal Terbaik)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Klik tanggal untuk memfilter tabel utama
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                              <th className="text-center font-extrabold px-2.5 py-2 w-10">#</th>
                              <th className="text-left font-extrabold px-3 py-2">Tanggal Potensi</th>
                              <th className="text-left font-extrabold px-3 py-2">Toko Aktif</th>
                              <th className="text-right font-extrabold px-3 py-2">Actual</th>
                              <th className="text-right font-extrabold px-3 py-2">Kontribusi</th>
                              <th className="text-right font-extrabold px-3 py-2">vs Rata-rata</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {m.potentialDates.map((d, rankIdx) => {
                              const isSelectedDate = filterDate === d.date;
                              return (
                                <tr
                                  key={d.date}
                                  onClick={() =>
                                    setFilterDate(isSelectedDate ? 'ALL' : d.date)
                                  }
                                  className={`cursor-pointer transition-colors ${
                                    isSelectedDate ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-500 tabular-nums">
                                    {rankIdx + 1}
                                  </td>
                                  <td className="px-3 py-2 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                    {formatDisplayDateId(d.date)}
                                    {d.isPeakDay && (
                                      <span className="ml-1.5 text-[10px] font-sans font-extrabold text-emerald-700">
                                        (Puncak)
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 font-medium">
                                    {d.storeNames.join(', ')}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                                    {formatRupiah(d.totalActual)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                                    {d.sharePercent.toFixed(1).replace('.', ',')}%
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                                    +{d.vsAvgPercent.toFixed(1).replace('.', ',')}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                        <span className="font-sans font-semibold text-slate-700">
                          Semua tanggal promo aktif ({m.promoDaysCount} hari):{' '}
                        </span>
                        {m.allActiveDates.map((d) => `Tgl ${d.dayOfMonth}`).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rekapan Pencapaian Per Hari (Growth Harian) */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-emerald-50/60 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Rekapan Pencapaian Per Hari (Growth Harian)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Total Actual seluruh toko per tanggal &amp; pertumbuhan dibanding hari sebelumnya. Klik tanggal untuk filter tabel.
              </p>
            </div>
            {filterDate !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterDate('ALL')}
                className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Semua Tanggal
              </button>
            )}
          </div>
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  <th className="text-left font-extrabold px-5 py-2.5">Tanggal</th>
                  <th className="text-center font-extrabold px-3 py-2.5">Toko</th>
                  <th className="text-right font-extrabold px-3 py-2.5">Actual Harian</th>
                  <th className="text-right font-extrabold px-5 py-2.5">Growth Per Hari</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyRecap.map((row) => (
                  <tr
                    key={row.date}
                    onClick={() => setFilterDate(filterDate === row.date ? 'ALL' : row.date)}
                    className={`cursor-pointer transition-colors ${
                      filterDate === row.date ? 'bg-emerald-50/80 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-5 py-2.5 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatDisplayDateId(row.date)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600">
                      {row.storeCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(row.totalActual)}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      {renderGrowthPill(
                        row.growthPercent,
                        row.growthDelta,
                        row.previousDate ? formatDisplayDateId(row.previousDate) : null,
                        row.previousTotalActual,
                        'Hari Awal (-)'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
