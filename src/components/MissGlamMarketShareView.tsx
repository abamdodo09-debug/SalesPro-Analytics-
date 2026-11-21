import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Edit3,
  Filter,
  Percent,
  PieChart,
  Plus,
  PlusCircle,
  Search,
  Store,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  DashboardFilters,
  MissGlamMarketShareItem,
} from '../types/dashboard';
import { formatRupiah } from '../utils/analytics';
import { getDefaultRunningMonth, MONTH_OPTIONS_2026 } from '../services/salesVisitService';
import { parseMonthPeriodOrder } from '../services/onlinePromoService';
import {
  addMgStoreOption,
  aggregateMonthlyMgRecap,
  aggregatePerStoreMgRecap,
  analyzeMgStoreMarketShare,
  clearAllMgMarketShareItems,
  computeMarketSharePct,
  DEFAULT_MG_STORES,
  deleteMgMarketShareItem,
  loadMgMarketShareItems,
  loadMgStoreOptions,
  removeMgStoreOption,
  upsertMgMarketShareItem,
} from '../services/missGlamMarketShareService';

interface MissGlamMarketShareViewProps {
  filters: DashboardFilters;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

function parseFreeNumericInput(
  raw: string,
  allowThousandDotGrouping: boolean = true
): number | null {
  const cleaned = raw
    .trim()
    .replace(/^rp\s*/i, '')
    .replace(/%$/g, '')
    .replace(/\s+/g, '');
  if (!cleaned) return null;

  const signMatch = cleaned.match(/^([+-])?(.*)$/);
  const sign = signMatch?.[1] === '-' ? -1 : 1;
  const body = signMatch?.[2] ?? '';
  if (!body) return null;

  if (allowThousandDotGrouping) {
    if (/^\d{1,3}(\.\d{3})+$/.test(body)) {
      const val = Number(body.replace(/\./g, ''));
      return Number.isFinite(val) ? sign * val : null;
    }
    if (/^\d{1,3}(,\d{3})+$/.test(body)) {
      const val = Number(body.replace(/,/g, ''));
      return Number.isFinite(val) ? sign * val : null;
    }
  } else {
    if (/^\d{1,3}(\.\d{3}){2,}$/.test(body)) {
      const val = Number(body.replace(/\./g, ''));
      return Number.isFinite(val) ? sign * val : null;
    }
    if (/^\d{1,3}(,\d{3}){2,}$/.test(body)) {
      const val = Number(body.replace(/,/g, ''));
      return Number.isFinite(val) ? sign * val : null;
    }
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

export const MissGlamMarketShareView: React.FC<MissGlamMarketShareViewProps> = ({
  filters,
  onNotify,
}) => {
  const [storeOptions, setStoreOptions] = useState<string[]>(() => loadMgStoreOptions());
  const [items, setItems] = useState<MissGlamMarketShareItem[]>(() =>
    loadMgMarketShareItems()
  );

  // Store management panel
  const [isStorePanelOpen, setIsStorePanelOpen] = useState<boolean>(false);
  const [newStoreInput, setNewStoreInput] = useState<string>('');
  const [storeError, setStoreError] = useState<string | null>(null);

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

  // Add Form state (100% manual)
  const [formStoreName, setFormStoreName] = useState<string>(
    () => storeOptions[0] || 'MG PANAM'
  );
  const [formMonthPeriod, setFormMonthPeriod] = useState<string>(defaultMonth);
  const [formActualStr, setFormActualStr] = useState<string>('');
  const [formOmsetStr, setFormOmsetStr] = useState<string>('');
  const [formShareStr, setFormShareStr] = useState<string>('');
  const [isFormManualShare, setIsFormManualShare] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline Edit Row state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState<string>('');
  const [editMonthPeriod, setEditMonthPeriod] = useState<string>('');
  const [editActualStr, setEditActualStr] = useState<string>('');
  const [editOmsetStr, setEditOmsetStr] = useState<string>('');
  const [editShareStr, setEditShareStr] = useState<string>('');
  const [isEditManualShare, setIsEditManualShare] = useState<boolean>(false);

  // Filters & Confirmations
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterStore, setFilterStore] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredChartMonthIdx, setHoveredChartMonthIdx] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      setFormMonthPeriod(defaultMonth);
    }
  }, [defaultMonth, filters.BULAN]);

  // Auto-calculate Market Share % when Actual or Omset Toko changes (unless user manually overrode Market Share)
  const handleActualOrOmsetChange = (nextActual: string, nextOmset: string) => {
    setFormActualStr(nextActual);
    setFormOmsetStr(nextOmset);
    setFormError(null);
    if (!isFormManualShare) {
      const a = parseFreeNumericInput(nextActual, true);
      const o = parseFreeNumericInput(nextOmset, true);
      if (a !== null && o !== null && o > 0) {
        setFormShareStr(String(computeMarketSharePct(a, o)));
      } else {
        setFormShareStr('');
      }
    }
  };

  const handleEditActualOrOmsetChange = (nextActual: string, nextOmset: string) => {
    setEditActualStr(nextActual);
    setEditOmsetStr(nextOmset);
    if (!isEditManualShare) {
      const a = parseFreeNumericInput(nextActual, true);
      const o = parseFreeNumericInput(nextOmset, true);
      if (a !== null && o !== null && o > 0) {
        setEditShareStr(String(computeMarketSharePct(a, o)));
      } else {
        setEditShareStr('');
      }
    }
  };

  // Add Store option handler
  const handleAddStoreOption = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError(null);
    const trimmed = newStoreInput.trim();
    if (!trimmed) {
      setStoreError('Nama toko MissGlam baru tidak boleh kosong.');
      return;
    }
    const { nextStores, addedName, alreadyExists } = addMgStoreOption(
      storeOptions,
      trimmed
    );
    if (alreadyExists) {
      setStoreError(`Toko "${addedName}" sudah ada di daftar pilihan.`);
      return;
    }
    setStoreOptions(nextStores);
    setFormStoreName(addedName);
    setNewStoreInput('');
    onNotify?.(`Toko "${addedName}" berhasil ditambahkan ke daftar pilihan MissGlam!`, 'success');
  };

  const handleRemoveCustomStore = (storeName: string) => {
    const next = removeMgStoreOption(storeOptions, storeName);
    setStoreOptions(next);
    if (formStoreName.toUpperCase() === storeName.toUpperCase()) {
      setFormStoreName(next[0] || 'MG PANAM');
    }
    onNotify?.(`Toko "${storeName}" dihapus dari daftar pilihan.`, 'success');
  };

  // Add Manual Entry handler
  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedActual = parseFreeNumericInput(formActualStr, true);
    const parsedOmset = parseFreeNumericInput(formOmsetStr, true);
    const parsedShare = parseFreeNumericInput(formShareStr, false);

    if (!formStoreName.trim()) {
      setFormError('Nama Toko MissGlam wajib dipilih.');
      return;
    }
    if (!formMonthPeriod.trim()) {
      setFormError('Bulan wajib dipilih.');
      return;
    }
    if (parsedActual === null) {
      setFormError('Actual (Rp) wajib diisi dengan angka yang valid.');
      return;
    }
    if (parsedOmset === null) {
      setFormError('Omset Toko (Rp) wajib diisi dengan angka yang valid.');
      return;
    }
    if (isFormManualShare && formShareStr.trim() !== '' && parsedShare === null) {
      setFormError('Market Share (%) harus berupa angka yang valid.');
      return;
    }

    const finalShare =
      isFormManualShare && parsedShare !== null
        ? parsedShare
        : computeMarketSharePct(parsedActual, parsedOmset);

    const newItem: MissGlamMarketShareItem = {
      id: `mg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      storeName: formStoreName.trim().toUpperCase(),
      monthPeriod: formMonthPeriod.trim().toUpperCase(),
      actual: parsedActual,
      storeOmset: parsedOmset,
      marketSharePercent: finalShare,
      isManualShareOverride: isFormManualShare,
      createdAt: new Date().toISOString(),
    };

    const next = upsertMgMarketShareItem(items, newItem);
    setItems(next);
    setFormActualStr('');
    setFormOmsetStr('');
    setFormShareStr('');
    setIsFormManualShare(false);
    onNotify?.(
      `Market Share ${newItem.storeName} (${newItem.monthPeriod}) sebesar ${formatSharePct(newItem.marketSharePercent)} berhasil disimpan.`,
      'success'
    );
  };

  // Inline Edit handlers
  const handleStartEdit = (row: MissGlamMarketShareItem) => {
    setConfirmDeleteId(null);
    setEditingRowId(row.id);
    setEditStoreName(row.storeName);
    setEditMonthPeriod(row.monthPeriod);
    setEditActualStr(String(row.actual));
    setEditOmsetStr(String(row.storeOmset));
    setEditShareStr(String(row.marketSharePercent));
    setIsEditManualShare(Boolean(row.isManualShareOverride));
  };

  const handleSaveEdit = (id: string) => {
    const existing = items.find((i) => i.id === id);
    if (!existing) return;

    const parsedActual = parseFreeNumericInput(editActualStr, true);
    const parsedOmset = parseFreeNumericInput(editOmsetStr, true);
    const parsedShare = parseFreeNumericInput(editShareStr, false);

    if (
      !editStoreName.trim() ||
      !editMonthPeriod.trim() ||
      parsedActual === null ||
      parsedOmset === null
    ) {
      onNotify?.('Nama Toko, Bulan, Actual, dan Omset Toko wajib diisi dengan angka yang valid.', 'error');
      return;
    }

    if (isEditManualShare && editShareStr.trim() !== '' && parsedShare === null) {
      onNotify?.('Market Share (%) harus berupa angka yang valid.', 'error');
      return;
    }

    const finalShare =
      isEditManualShare && parsedShare !== null
        ? parsedShare
        : computeMarketSharePct(parsedActual, parsedOmset);

    const updated: MissGlamMarketShareItem = {
      ...existing,
      storeName: editStoreName.trim().toUpperCase(),
      monthPeriod: editMonthPeriod.trim().toUpperCase(),
      actual: parsedActual,
      storeOmset: parsedOmset,
      marketSharePercent: finalShare,
      isManualShareOverride: isEditManualShare,
      updatedAt: new Date().toISOString(),
    };

    const next = upsertMgMarketShareItem(items, updated);
    setItems(next);
    setEditingRowId(null);
    onNotify?.(`Data ${updated.storeName} (${updated.monthPeriod}) berhasil diperbarui.`, 'success');
  };

  const handleDeleteRow = (id: string) => {
    const target = items.find((i) => i.id === id);
    const next = deleteMgMarketShareItem(items, id);
    setItems(next);
    setConfirmDeleteId(null);
    if (editingRowId === id) setEditingRowId(null);
    onNotify?.(`Data ${target?.storeName || ''} berhasil dihapus.`, 'success');
  };

  const handleClearAll = () => {
    const empty = clearAllMgMarketShareItems();
    setItems(empty);
    setEditingRowId(null);
    setConfirmDeleteId(null);
    setConfirmClearAll(false);
    setFilterMonth('ALL');
    setFilterStore('ALL');
    setSearchQuery('');
    onNotify?.('Seluruh data Market Share MissGlam berhasil dikosongkan.', 'success');
  };

  // Filtered table items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...items]
      .filter((item) => {
        if (filterMonth !== 'ALL' && item.monthPeriod.toUpperCase() !== filterMonth.toUpperCase()) {
          return false;
        }
        if (filterStore !== 'ALL' && item.storeName.toUpperCase() !== filterStore.toUpperCase()) {
          return false;
        }
        if (q) {
          const hay = `${item.storeName} ${item.monthPeriod}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const mDiff = parseMonthPeriodOrder(b.monthPeriod) - parseMonthPeriodOrder(a.monthPeriod);
        if (mDiff !== 0) return mDiff;
        return b.marketSharePercent - a.marketSharePercent;
      });
  }, [items, filterMonth, filterStore, searchQuery]);

  // Recap Per Bulan (Semua Toko), Per Toko, & Analisa Naik/Turun/Potensi
  const monthlyRecapAllStores = useMemo(
    () => aggregateMonthlyMgRecap(items),
    [items]
  );

  const perStoreRecap = useMemo(
    () => aggregatePerStoreMgRecap(items, storeOptions, filterMonth),
    [items, storeOptions, filterMonth]
  );

  const storeAnalytics = useMemo(
    () => analyzeMgStoreMarketShare(items, storeOptions),
    [items, storeOptions]
  );

  const maxChartSharePct = useMemo(() => {
    const vals = [
      ...storeAnalytics.monthlyTrendChartData.map((m) => Math.max(0, m.marketSharePercent)),
      ...storeAnalytics.allActiveStores.map((s) => Math.max(0, s.latestShare)),
      storeAnalytics.networkAvgShare,
    ];
    return Math.max(...vals, 10);
  }, [storeAnalytics]);

  // Grand Totals for KPI Strip & Recap Footers
  const grandTotals = useMemo(() => {
    const scopeItems = filteredItems;
    const totalActual = scopeItems.reduce((acc, c) => acc + c.actual, 0);
    const totalOmset = scopeItems.reduce((acc, c) => acc + c.storeOmset, 0);
    const totalSharePct =
      totalOmset > 0
        ? computeMarketSharePct(totalActual, totalOmset)
        : scopeItems.length > 0
        ? scopeItems.reduce((acc, c) => acc + c.marketSharePercent, 0) / scopeItems.length
        : 0;
    const activeStoresSet: Record<string, boolean> = {};
    scopeItems.forEach((i) => {
      activeStoresSet[i.storeName.toUpperCase()] = true;
    });
    return {
      totalActual,
      totalOmset,
      totalSharePct,
      activeStoresCount: Object.keys(activeStoresSet).length,
      rowCount: scopeItems.length,
    };
  }, [filteredItems]);

  const allMonthsTotalActual = useMemo(
    () => items.reduce((acc, c) => acc + c.actual, 0),
    [items]
  );
  const allMonthsTotalOmset = useMemo(
    () => items.reduce((acc, c) => acc + c.storeOmset, 0),
    [items]
  );
  const allMonthsSharePct = useMemo(
    () => computeMarketSharePct(allMonthsTotalActual, allMonthsTotalOmset),
    [allMonthsTotalActual, allMonthsTotalOmset]
  );

  const formatSharePct = (pct: number) => {
    if (!Number.isFinite(pct)) return '0,0%';
    const hasSecondDecimal = Math.abs(pct * 10 - Math.round(pct * 10)) > 1e-4;
    return `${(hasSecondDecimal ? pct.toFixed(2) : pct.toFixed(1)).replace('.', ',')}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white shadow-sm shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Market Share MissGlam (100% Input Manual)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Input &amp; kelola <span className="font-bold text-slate-800">Nama Toko MissGlam, Bulan, Actual, Omset Toko, dan Market Share (%)</span> beserta rekapan total semua toko per bulan &amp; per toko.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsStorePanelOpen((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-pink-700" />
            <span>Tambah Nama Toko MG ({storeOptions.length})</span>
          </button>

          {items.length > 0 && (
            confirmClearAll ? (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                <span className="text-xs font-bold text-rose-800">
                  Kosongkan ({items.length})?
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Ya
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
                <span>Kosongkan Semua</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Store Option Manager Panel (Bikin Nama Toko Bisa Ditambah) */}
      {isStorePanelOpen && (
        <div className="bg-white rounded-2xl border border-pink-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Kelola Daftar Nama Toko MissGlam
              </h3>
              <p className="text-[11px] text-slate-500">
                8 cabang utama sudah tersedia. Tambahkan cabang/nama toko MissGlam baru jika diperlukan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsStorePanelOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddStoreOption} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newStoreInput}
              onChange={(e) => {
                setNewStoreInput(e.target.value);
                setStoreError(null);
              }}
              placeholder="Contoh: MG ARIFIN AHMAD / MG BANGKINANG..."
              className="grow px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Nama Toko</span>
            </button>
          </form>

          {storeError && (
            <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {storeError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {storeOptions.map((st) => {
              const isDefault = DEFAULT_MG_STORES.includes(st.toUpperCase());
              return (
                <div
                  key={st}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                    isDefault
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-pink-50 border-pink-200 text-pink-900'
                  }`}
                >
                  <Store className="w-3.5 h-3.5 text-pink-600" />
                  <span>{st}</span>
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomStore(st)}
                      className="ml-1 text-pink-500 hover:text-rose-700 cursor-pointer"
                      title="Hapus toko tambahan ini"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Actual MissGlam
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {formatRupiah(grandTotals.totalActual, true)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            {formatRupiah(grandTotals.totalActual)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Omset Toko MissGlam
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {formatRupiah(grandTotals.totalOmset, true)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            {formatRupiah(grandTotals.totalOmset)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-pink-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-pink-700 uppercase tracking-wider">
            Total Market Share (Semua Toko)
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-pink-900 font-mono tabular-nums">
            {formatSharePct(grandTotals.totalSharePct)}
          </div>
          <div className="text-[11px] text-pink-700 mt-0.5">
            Total Actual ÷ Total Omset Toko
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Toko Terisi / Baris Data
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
            {grandTotals.activeStoresCount}{' '}
            <span className="text-sm font-bold text-slate-400">
              toko / {grandTotals.rowCount} baris
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">100% input manual</div>
        </div>
      </div>

      {/* Add Manual Entry Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-pink-600" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Input Data Market Share MissGlam
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Market Share (%) otomatis terhitung dari (Actual ÷ Omset Toko × 100%) dan bisa diedit manual
          </span>
        </div>

        <form onSubmit={handleAddEntry} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Nama Toko */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Nama Toko <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsStorePanelOpen(true)}
                  className="text-[11px] font-bold text-pink-700 hover:text-pink-900 cursor-pointer"
                >
                  + Tambah Toko
                </button>
              </div>
              <div className="relative">
                <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={formStoreName}
                  onChange={(e) => {
                    setFormStoreName(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full pl-8 pr-2.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {storeOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulan */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bulan <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={formMonthPeriod}
                  onChange={(e) => {
                    setFormMonthPeriod(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full pl-8 pr-2 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
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
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Actual (Rp) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formActualStr}
                onChange={(e) => handleActualOrOmsetChange(e.target.value, formOmsetStr)}
                placeholder="Angka bebas: 45250500"
                className="w-full px-3 py-2 text-xs font-mono font-bold tabular-nums rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Omset Toko */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Omset Toko (Rp) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formOmsetStr}
                onChange={(e) => handleActualOrOmsetChange(formActualStr, e.target.value)}
                placeholder="Angka bebas: 200150000"
                className="w-full px-3 py-2 text-xs font-mono font-bold tabular-nums rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Market Share (%) */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Market Share (%)
                </label>
                {isFormManualShare && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormManualShare(false);
                      const a = parseFreeNumericInput(formActualStr, true);
                      const o = parseFreeNumericInput(formOmsetStr, true);
                      if (a !== null && o !== null && o > 0) {
                        setFormShareStr(String(computeMarketSharePct(a, o)));
                      } else {
                        setFormShareStr('');
                      }
                    }}
                    className="text-[10px] font-bold text-pink-700 hover:underline cursor-pointer"
                  >
                    Auto
                  </button>
                )}
              </div>
              <div className="relative">
                <Percent className="w-3.5 h-3.5 text-pink-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={formShareStr}
                  onChange={(e) => {
                    setIsFormManualShare(true);
                    setFormShareStr(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Bebas / otomatis"
                  className="w-full pl-3 pr-7 py-2 text-xs font-mono font-extrabold text-pink-900 tabular-nums rounded-xl border border-pink-300 bg-pink-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* Simpan */}
            <div className="lg:col-span-1">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ======================================================= */}
      {/* GRAFIK & ANALISA PENINGKATAN / PENURUNAN / POTENSI TOKO */}
      {/* ======================================================= */}
      {items.length > 0 && (
        <>
          {/* Grafik Market Share (Tren Bulanan & Perbandingan Per Toko) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-pink-600 text-white shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Grafik Pergerakan &amp; Perbandingan Market Share MissGlam
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tren Market Share (%) antar bulan serta posisi &amp; perubahan setiap cabang terhadap rata-rata toko ({formatSharePct(storeAnalytics.networkAvgShare)}).
                  </p>
                </div>
              </div>
              {(filterMonth !== 'ALL' || filterStore !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterMonth('ALL');
                    setFilterStore('ALL');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Reset Filter Grafik
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
              {/* Left Chart: Monthly Market Share (%) Trend */}
              <div className="xl:col-span-5 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    Tren Market Share Bulanan (%)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Klik batang bulan untuk memfilter tabel. Angka di atas batang menunjukkan selisih poin % MoM.
                  </p>
                </div>

                <div className="relative pt-7">
                  {hoveredChartMonthIdx !== null &&
                    storeAnalytics.monthlyTrendChartData[hoveredChartMonthIdx] &&
                    (() => {
                      const hm = storeAnalytics.monthlyTrendChartData[hoveredChartMonthIdx];
                      return (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3.5 py-2 rounded-lg shadow-lg text-xs z-20 pointer-events-none border border-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{hm.monthPeriod}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-pink-300 font-mono font-extrabold">
                              {formatSharePct(hm.marketSharePercent)}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-300 tabular-nums mt-0.5">
                            Actual {formatRupiah(hm.totalActual, true)} / Omset{' '}
                            {formatRupiah(hm.totalStoreOmset, true)} ({hm.storeCount} toko)
                          </div>
                        </div>
                      );
                    })()}

                  <div className="flex items-stretch gap-2.5">
                    <div className="flex flex-col justify-between text-right font-mono text-[10px] text-slate-400 tabular-nums py-7 pr-2 border-r border-slate-100 shrink-0 w-12">
                      <span>{formatSharePct(maxChartSharePct)}</span>
                      <span>{formatSharePct(maxChartSharePct * 0.5)}</span>
                      <span>0%</span>
                    </div>

                    <div className="flex-1 flex items-end gap-2.5 h-56 pt-8 pb-2 overflow-x-auto">
                      {storeAnalytics.monthlyTrendChartData.map((pt, idx) => {
                        const heightPct =
                          maxChartSharePct > 0
                            ? Math.max(6, (Math.max(0, pt.marketSharePercent) / maxChartSharePct) * 100)
                            : 6;
                        const isSelected = filterMonth.toUpperCase() === pt.monthPeriod.toUpperCase();
                        const isUp = pt.deltaSharePercent !== null && pt.deltaSharePercent > 0;
                        const isDown = pt.deltaSharePercent !== null && pt.deltaSharePercent < 0;

                        return (
                          <button
                            key={pt.monthPeriod}
                            type="button"
                            onClick={() =>
                              setFilterMonth(isSelected ? 'ALL' : pt.monthPeriod)
                            }
                            onMouseEnter={() => setHoveredChartMonthIdx(idx)}
                            onMouseLeave={() => setHoveredChartMonthIdx(null)}
                            className="flex-1 min-w-[58px] max-w-[96px] flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none"
                          >
                            <div className="mb-1 flex flex-col items-center">
                              {pt.deltaSharePercent !== null ? (
                                <span
                                  className={`text-[10px] font-mono font-bold tabular-nums leading-none ${
                                    isUp
                                      ? 'text-emerald-700'
                                      : isDown
                                      ? 'text-rose-700'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {pt.deltaSharePercent > 0 ? '+' : ''}
                                  {pt.deltaSharePercent.toFixed(1).replace('.', ',')}%
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400 leading-none">
                                  Awal
                                </span>
                              )}
                              <span className="text-[11px] font-mono font-extrabold text-pink-900 tabular-nums mt-0.5">
                                {formatSharePct(pt.marketSharePercent)}
                              </span>
                            </div>

                            <div className="w-full relative flex items-end justify-center h-full px-1.5">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-full max-w-[44px] rounded-t-md transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-pink-700 ring-2 ring-pink-300'
                                    : isUp
                                    ? 'bg-emerald-600 group-hover:bg-emerald-700'
                                    : isDown
                                    ? 'bg-rose-500 group-hover:bg-rose-600'
                                    : 'bg-pink-500 group-hover:bg-pink-600'
                                }`}
                              />
                            </div>

                            <div className="mt-2 text-center w-full">
                              <span className="block text-[10px] font-bold text-slate-800 truncate">
                                {pt.monthPeriod}
                              </span>
                              <span className="block text-[10px] font-mono text-slate-500 tabular-nums">
                                {formatRupiah(pt.totalActual, true)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Chart: Per-Store Market Share (%) & Movement Comparison */}
              <div className="xl:col-span-7 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Perbandingan &amp; Perubahan Market Share per Toko
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Garis putus-putus menandai rata-rata jaringan ({formatSharePct(storeAnalytics.networkAvgShare)}). Klik baris toko untuk filter tabel.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
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

                <div className="space-y-2.5">
                  {storeAnalytics.allActiveStores.map((st) => {
                    const barPct =
                      maxChartSharePct > 0
                        ? Math.min(100, Math.max(2, (Math.max(0, st.latestShare) / maxChartSharePct) * 100))
                        : 0;
                    const avgLinePct =
                      maxChartSharePct > 0
                        ? Math.min(100, Math.max(0, (storeAnalytics.networkAvgShare / maxChartSharePct) * 100))
                        : 0;
                    const isSelected = filterStore.toUpperCase() === st.storeName.toUpperCase();
                    const barColor =
                      st.trend === 'up'
                        ? 'bg-emerald-600'
                        : st.trend === 'down'
                        ? 'bg-rose-500'
                        : 'bg-pink-500';

                    return (
                      <button
                        key={st.storeName}
                        type="button"
                        onClick={() =>
                          setFilterStore(isSelected ? 'ALL' : st.storeName)
                        }
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                          isSelected ? 'bg-pink-50/80' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-slate-900 truncate">
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
                                    ? 'text-emerald-700'
                                    : st.trend === 'down'
                                    ? 'text-rose-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {st.trend === 'up'
                                  ? `▲ +${st.deltaShare.toFixed(1).replace('.', ',')}%`
                                  : st.trend === 'down'
                                  ? `▼ ${st.deltaShare.toFixed(1).replace('.', ',')}%`
                                  : 'Stabil (0,0%)'}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">1 Bulan</span>
                            )}
                            <span className="font-extrabold text-slate-900 min-w-[52px] text-right">
                              {formatSharePct(st.latestShare)}
                            </span>
                          </div>
                        </div>

                        <div className="relative h-2.5 w-full rounded-full bg-slate-100 overflow-visible">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${barPct}%` }}
                          />
                          {storeAnalytics.networkAvgShare > 0 && (
                            <div
                              title={`Rata-rata: ${formatSharePct(storeAnalytics.networkAvgShare)}`}
                              className="absolute top-[-3px] bottom-[-3px] w-0.5 border-l-2 border-dashed border-slate-700/70 pointer-events-none"
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

          {/* Analisa Toko Peningkatan, Penurunan, & Potensi Market Share */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Analisa Perubahan &amp; Potensi Market Share Toko MissGlam
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pemetaan otomatis cabang yang mengalami peningkatan, penurunan antar bulan, serta peluang terbesar untuk ditingkatkan.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-600 tabular-nums">
                Rata-rata jaringan:{' '}
                <strong className="text-pink-900">
                  {formatSharePct(storeAnalytics.networkAvgShare)}
                </strong>
                {storeAnalytics.topStoreName && (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    Tertinggi:{' '}
                    <strong className="text-emerald-800">
                      {storeAnalytics.topStoreName} ({formatSharePct(storeAnalytics.topShare)})
                    </strong>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Column 1: Increasing Market Share */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Toko Mengalami Peningkatan
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                    {storeAnalytics.increasingStores.length} Toko
                  </span>
                </div>

                {storeAnalytics.increasingStores.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    {storeAnalytics.allActiveStores.some((s) => s.monthsCount >= 2)
                      ? 'Belum ada toko yang mencatat kenaikan market share dibanding bulan sebelumnya.'
                      : 'Perbandingan kenaikan akan otomatis tampil setelah minimal 2 bulan data diinput untuk toko yang sama.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {storeAnalytics.increasingStores.map((st) => (
                      <button
                        key={st.storeName}
                        type="button"
                        onClick={() =>
                          setFilterStore(
                            filterStore === st.storeName ? 'ALL' : st.storeName
                          )
                        }
                        className="w-full text-left py-2.5 first:pt-1 last:pb-0 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-extrabold text-slate-900">
                            {st.storeName}
                          </span>
                          <span className="font-mono font-extrabold text-emerald-700 tabular-nums">
                            ▲ +{st.deltaShare?.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 tabular-nums mt-0.5">
                          {st.prevMonth}: {formatSharePct(st.prevShare ?? 0)} → {st.latestMonth}:{' '}
                          <strong className="text-slate-900">
                            {formatSharePct(st.latestShare)}
                          </strong>
                        </div>
                        {st.deltaActual !== null && (
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                            Actual {st.deltaActual >= 0 ? '+' : ''}
                            {formatRupiah(st.deltaActual, true)} vs bulan lalu
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 2: Decreasing Market Share */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Toko Mengalami Penurunan
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-700 tabular-nums">
                    {storeAnalytics.decreasingStores.length} Toko
                  </span>
                </div>

                {storeAnalytics.decreasingStores.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    {storeAnalytics.allActiveStores.some((s) => s.monthsCount >= 2)
                      ? 'Tidak ada toko yang mengalami penurunan market share pada periode terbaru.'
                      : 'Perbandingan penurunan akan otomatis tampil setelah minimal 2 bulan data diinput untuk toko yang sama.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {storeAnalytics.decreasingStores.map((st) => (
                      <button
                        key={st.storeName}
                        type="button"
                        onClick={() =>
                          setFilterStore(
                            filterStore === st.storeName ? 'ALL' : st.storeName
                          )
                        }
                        className="w-full text-left py-2.5 first:pt-1 last:pb-0 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-extrabold text-slate-900">
                            {st.storeName}
                          </span>
                          <span className="font-mono font-extrabold text-rose-700 tabular-nums">
                            ▼ {st.deltaShare?.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 tabular-nums mt-0.5">
                          {st.prevMonth}: {formatSharePct(st.prevShare ?? 0)} → {st.latestMonth}:{' '}
                          <strong className="text-slate-900">
                            {formatSharePct(st.latestShare)}
                          </strong>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          Puncak: {formatSharePct(st.peakShare)} ({st.peakMonth})
                          {st.deltaActual !== null
                            ? ` · Actual ${st.deltaActual >= 0 ? '+' : ''}${formatRupiah(st.deltaActual, true)}`
                            : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 3: High Potential Stores */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-pink-600 shrink-0" />
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Toko Berpotensi Ditingkatkan
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-pink-700 tabular-nums">
                    {storeAnalytics.potentialStores.length} Toko
                  </span>
                </div>

                {storeAnalytics.potentialStores.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    Semua toko aktif telah mencapai performa optimal terhadap tolok ukur saat ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {storeAnalytics.potentialStores.map((st) => (
                      <button
                        key={st.storeName}
                        type="button"
                        onClick={() =>
                          setFilterStore(
                            filterStore === st.storeName ? 'ALL' : st.storeName
                          )
                        }
                        className="w-full text-left py-2.5 first:pt-1 last:pb-0 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-extrabold text-slate-900">
                            {st.storeName}
                          </span>
                          <span className="font-mono font-extrabold text-pink-700 tabular-nums">
                            {st.upsideActualRp > 0
                              ? `+${formatRupiah(st.upsideActualRp, true)}`
                              : `Target ${formatSharePct(st.targetBenchmarkShare)}`}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 tabular-nums mt-0.5">
                          Share {formatSharePct(st.latestShare)} → Target{' '}
                          {formatSharePct(st.targetBenchmarkShare)} · Omset{' '}
                          {formatRupiah(st.latestOmset, true)}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {st.potentialReason}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======================================================= */}
      {/* REKAPAN TOTAL MARKET SHARE PER BULAN & PER TOKO         */}
      {/* ======================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Rekapan Per Bulan (Semua Toko) */}
        <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-pink-50/60 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Rekapan Total Market Share Per Bulan (Semua Toko)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Gabungan seluruh toko MissGlam per bulan. Klik baris bulan untuk memfilter.
              </p>
            </div>
            {filterMonth !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterMonth('ALL')}
                className="px-2.5 py-1 rounded-lg bg-white border border-pink-200 text-pink-800 text-[11px] font-bold cursor-pointer"
              >
                Semua Bulan
              </button>
            )}
          </div>

          {monthlyRecapAllStores.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium grow flex items-center justify-center">
              Belum ada data bulanan yang diinput.
            </div>
          ) : (
            <div className="overflow-x-auto grow">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                    <th className="text-left font-extrabold px-4 py-2.5">Bulan</th>
                    <th className="text-center font-extrabold px-2 py-2.5">Toko</th>
                    <th className="text-right font-extrabold px-3 py-2.5">Total Actual</th>
                    <th className="text-right font-extrabold px-3 py-2.5">Total Omset Toko</th>
                    <th className="text-right font-extrabold px-4 py-2.5 text-pink-800">
                      Market Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyRecapAllStores.map((row) => {
                    const isSelected = filterMonth.toUpperCase() === row.monthPeriod.toUpperCase();
                    return (
                      <tr
                        key={row.monthPeriod}
                        onClick={() =>
                          setFilterMonth(isSelected ? 'ALL' : row.monthPeriod)
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-pink-50/80 font-bold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {row.monthPeriod}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono tabular-nums text-slate-600">
                          {row.storeCount}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatRupiah(row.totalActual, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                          {formatRupiah(row.totalStoreOmset, true)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-pink-100 border border-pink-200 text-pink-900 font-mono font-extrabold tabular-nums">
                            {formatSharePct(row.marketSharePercent)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-extrabold">
                    <td className="px-4 py-3">TOTAL SEMUA BULAN</td>
                    <td className="px-2 py-3 text-center font-mono tabular-nums">-</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatRupiah(allMonthsTotalActual, true)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatRupiah(allMonthsTotalOmset, true)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-pink-300">
                      {formatSharePct(allMonthsSharePct)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Rekapan Per Toko */}
        <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Rekapan Market Share Per Toko{' '}
                {filterMonth !== 'ALL' ? `(${filterMonth})` : '(Semua Bulan)'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Perbandingan Actual, Omset Toko, dan Market Share tiap cabang MissGlam. Klik toko untuk filter.
              </p>
            </div>
            {filterStore !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterStore('ALL')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
              >
                Semua Toko
              </button>
            )}
          </div>

          <div className="overflow-x-auto grow">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                  <th className="text-left font-extrabold px-4 py-2.5">Nama Toko</th>
                  <th className="text-right font-extrabold px-3 py-2.5">Actual</th>
                  <th className="text-right font-extrabold px-3 py-2.5">Omset Toko</th>
                  <th className="text-right font-extrabold px-4 py-2.5 text-pink-800">
                    Market Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {perStoreRecap.map((row) => {
                  const isSelected = filterStore.toUpperCase() === row.storeName.toUpperCase();
                  return (
                    <tr
                      key={row.storeName}
                      onClick={() =>
                        setFilterStore(isSelected ? 'ALL' : row.storeName)
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-pink-50/80 font-bold'
                          : row.entryCount > 0
                          ? 'hover:bg-slate-50'
                          : 'text-slate-400 hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {row.storeName}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {row.totalActual > 0 ? formatRupiah(row.totalActual, true) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                        {row.totalStoreOmset > 0 ? formatRupiah(row.totalStoreOmset, true) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {row.entryCount > 0 ? (
                          <div className="inline-flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-pink-600 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(2, row.marketSharePercent))}%`,
                                }}
                              />
                            </div>
                            <span className="inline-block min-w-[52px] text-center px-2 py-0.5 rounded-md bg-pink-100 border border-pink-200 text-pink-900 font-mono font-extrabold tabular-nums">
                              {formatSharePct(row.marketSharePercent)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">0,0%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* TABEL DATA DETAIL (100% MANUAL, EDITABLE & DELETABLE)   */}
      {/* ======================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Tabel Detail Market Share MissGlam ({filteredItems.length} Baris)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik <span className="font-bold text-amber-700">Edit</span> untuk mengubah Nama Toko, Bulan, Actual, Omset Toko, maupun Market Share (%) secara langsung.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari toko / bulan..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
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
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
            >
              <option value="ALL">Semua Toko MG</option>
              {storeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {(filterMonth !== 'ALL' || filterStore !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterMonth('ALL');
                  setFilterStore('ALL');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center mx-auto">
              <PieChart className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {items.length === 0
                ? 'Data Market Share MissGlam masih kosong'
                : 'Tidak ada data yang cocok dengan filter ini'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {items.length === 0
                ? 'Silakan pilih Nama Toko MissGlam, Bulan, lalu isi Actual & Omset Toko melalui form di atas.'
                : 'Reset filter untuk melihat data lainnya.'}
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
                  <th className="text-right font-extrabold px-3 py-3">Actual</th>
                  <th className="text-right font-extrabold px-3 py-3">Omset Toko</th>
                  <th className="text-right font-extrabold px-3 py-3 text-pink-800">
                    Market Share (%)
                  </th>
                  <th className="text-center font-extrabold px-3 py-3 w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((row, idx) => {
                  const isEditing = editingRowId === row.id;
                  const isDeleting = confirmDeleteId === row.id;

                  if (isEditing) {
                    return (
                      <tr key={row.id} className="bg-amber-50/70 align-top">
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 min-w-[170px]">
                          <select
                            value={editStoreName}
                            onChange={(e) => setEditStoreName(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                          >
                            {storeOptions.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
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
                        <td className="px-3 py-2.5 min-w-[140px]">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editActualStr}
                            onChange={(e) =>
                              handleEditActualOrOmsetChange(e.target.value, editOmsetStr)
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-extrabold text-right tabular-nums rounded-lg border border-amber-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-2.5 min-w-[140px]">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editOmsetStr}
                            onChange={(e) =>
                              handleEditActualOrOmsetChange(editActualStr, e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right tabular-nums rounded-lg border border-amber-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-2.5 min-w-[120px]">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editShareStr}
                            onChange={(e) => {
                              setIsEditManualShare(true);
                              setEditShareStr(e.target.value);
                            }}
                            className="w-full px-2 py-1.5 text-xs font-mono font-extrabold text-right tabular-nums rounded-lg border border-pink-300 bg-white"
                          />
                          {isEditManualShare && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditManualShare(false);
                                const a = parseFreeNumericInput(editActualStr, true);
                                const o = parseFreeNumericInput(editOmsetStr, true);
                                if (a !== null && o !== null && o > 0) {
                                  setEditShareStr(String(computeMarketSharePct(a, o)));
                                } else {
                                  setEditShareStr('');
                                }
                              }}
                              className="text-[10px] font-bold text-pink-700 hover:underline mt-0.5 block ml-auto cursor-pointer"
                            >
                              Hitung Otomatis
                            </button>
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
                            <span>Diedit</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700 whitespace-nowrap">
                        {row.monthPeriod}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(row.actual)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                        {formatRupiah(row.storeOmset)}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-pink-50 border border-pink-200 text-pink-900 font-mono font-extrabold tabular-nums">
                          {formatSharePct(row.marketSharePercent)}
                        </span>
                        {row.isManualShareOverride && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Manual %
                          </span>
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
                  <td colSpan={3} className="px-4 py-3 text-left">
                    TOTAL ({filteredItems.length} Baris)
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {formatRupiah(grandTotals.totalActual)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {formatRupiah(grandTotals.totalOmset)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-pink-300">
                    {formatSharePct(grandTotals.totalSharePct)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
