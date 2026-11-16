import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Sliders,
  Edit3,
  X,
  Save,
  Filter,
  Trophy,
  Medal,
  RotateCcw,
  Check,
} from 'lucide-react';
import { TransactionRecord, DashboardFilters } from '../types/dashboard';
import { aggregateByDimension, formatRupiah, formatNumber, formatPercent } from '../utils/analytics';
import {
  loadSalesTargets,
  loadSalesSellOutTargets,
  setSingleTargetOverride,
  DEFAULT_SALES_TARGET,
  DEFAULT_SALES_SELLOUT_TARGET,
  TARGETS_UPDATED_EVENT,
  getMonthDisplayLabel,
  normalizeMonthKey,
} from '../services/targetManagementService';

const STORAGE_KEY_MANUAL_SALES_SELLIN_ACTUALS = 'salespro_manual_sales_sellin_actuals_v1';

type MonthlyManualSellInMap = Record<string, Record<string, number>>;

function loadManualSellInMap(): MonthlyManualSellInMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MANUAL_SALES_SELLIN_ACTUALS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveManualSellInMap(map: MonthlyManualSellInMap): void {
  try {
    localStorage.setItem(STORAGE_KEY_MANUAL_SALES_SELLIN_ACTUALS, JSON.stringify(map));
  } catch (e) {
    console.warn('Gagal menyimpan edit manual pencapaian Sell In:', e);
  }
}

interface SalesAnalysisProps {
  records: TransactionRecord[];
  filters?: DashboardFilters;
}

export const SalesAnalysis: React.FC<SalesAnalysisProps> = ({ records, filters }) => {
  const activeMonth = filters?.BULAN;
  const monthKey = normalizeMonthKey(activeMonth);

  // Filter KET: 'ALL' | 'SELL IN' | 'SELL OUT'
  const [ketFilter, setKetFilter] = useState<'ALL' | 'SELL IN' | 'SELL OUT'>('SELL IN');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Manual Sell In Actual Overrides per month
  const [manualSellInMap, setManualSellInMap] = useState<MonthlyManualSellInMap>(() => loadManualSellInMap());

  // Inline table cell edit state for Pencapaian Sell In
  const [inlineEditSales, setInlineEditSales] = useState<string | null>(null);
  const [inlineSellInValue, setInlineSellInValue] = useState<number>(0);

  // Sync automatically whenever targets change anywhere in the app
  useEffect(() => {
    const onTargetsUpdated = () => setRefreshKey((k) => k + 1);
    const onStorageUpdated = () => {
      setRefreshKey((k) => k + 1);
      setManualSellInMap(loadManualSellInMap());
    };
    window.addEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
    window.addEventListener('storage', onStorageUpdated);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
      window.removeEventListener('storage', onStorageUpdated);
    };
  }, []);

  // Edit Target & Pencapaian Modal
  const [editingSalesName, setEditingSalesName] = useState<string | null>(null);
  const [editSellInActualInput, setEditSellInActualInput] = useState<number>(0);
  const [editSellInSheetBaseline, setEditSellInSheetBaseline] = useState<number>(0);
  const [clearManualSellInOnSave, setClearManualSellInOnSave] = useState<boolean>(false);
  const [targetSellInInput, setTargetSellInInput] = useState<number>(DEFAULT_SALES_TARGET);
  const [targetSellOutInput, setTargetSellOutInput] = useState<number>(DEFAULT_SALES_SELLOUT_TARGET);

  // Custom targets for active month
  const customSellInTargets = useMemo(() => loadSalesTargets(activeMonth), [activeMonth, refreshKey]);
  const customSellOutTargets = useMemo(() => loadSalesSellOutTargets(activeMonth), [activeMonth, refreshKey]);

  const activeMonthManualSellIn = useMemo(() => {
    return manualSellInMap[monthKey] || {};
  }, [manualSellInMap, monthKey]);

  const manualOverrideCount = Object.keys(activeMonthManualSellIn).length;

  // Sheet Sell In & Sell Out lookup per sales (used for ALL mode & modal baseline display)
  const { sheetSellInBySales, sheetSellOutBySales } = useMemo(() => {
    const sellInMap: Record<string, number> = {};
    const sellOutMap: Record<string, number> = {};
    records.forEach((r) => {
      const sName = (r.SALES || 'UNKNOWN').trim().toUpperCase();
      const k = (r.KET || '').toUpperCase();
      const val = r.VALUE || 0;
      if (k === 'SELL OUT') {
        sellOutMap[sName] = (sellOutMap[sName] || 0) + val;
      } else {
        sellInMap[sName] = (sellInMap[sName] || 0) + val;
      }
    });
    return { sheetSellInBySales: sellInMap, sheetSellOutBySales: sellOutMap };
  }, [records]);

  // Filter records based on KET
  const effectiveRecords = useMemo(() => {
    if (ketFilter === 'ALL') return records;
    return records.filter((r) => {
      const k = (r.KET || '').toUpperCase();
      if (ketFilter === 'SELL IN') return k === 'SELL IN' || !r.KET;
      if (ketFilter === 'SELL OUT') return k === 'SELL OUT';
      return true;
    });
  }, [records, ketFilter]);

  const rawSalesData = useMemo(() => {
    return aggregateByDimension(effectiveRecords, 'SALES');
  }, [effectiveRecords]);

  // Combine with manual Sell In overrides and dynamic Target Sell In / Sell Out
  const salesData = useMemo(() => {
    const withOverrides = rawSalesData.map((s) => {
      const upperKey = s.name.trim().toUpperCase();
      const manualSellIn = activeMonthManualSellIn[upperKey];
      const hasManualSellIn = manualSellIn !== undefined;
      const sheetSellIn = sheetSellInBySales[upperKey] || 0;
      const sheetSellOut = sheetSellOutBySales[upperKey] || 0;

      let effectiveTotalValue = s.totalValue;
      if (hasManualSellIn) {
        if (ketFilter === 'SELL IN') {
          effectiveTotalValue = manualSellIn;
        } else if (ketFilter === 'ALL') {
          effectiveTotalValue = manualSellIn + sheetSellOut;
        }
      }

      let targetVal: number;
      if (ketFilter === 'SELL OUT') {
        targetVal = customSellOutTargets[s.name] !== undefined ? customSellOutTargets[s.name] : DEFAULT_SALES_SELLOUT_TARGET;
      } else {
        targetVal = customSellInTargets[s.name] !== undefined ? customSellInTargets[s.name] : DEFAULT_SALES_TARGET;
      }

      const achievementPct = targetVal > 0 ? (effectiveTotalValue / targetVal) * 100 : 0;
      return {
        ...s,
        totalValue: effectiveTotalValue,
        sheetSellInValue: sheetSellIn,
        hasManualSellIn: hasManualSellIn && ketFilter !== 'SELL OUT',
        target: targetVal,
        achievementPercent: achievementPct,
      };
    });

    const grandTotal = withOverrides.reduce((acc, cur) => acc + cur.totalValue, 0);

    return withOverrides
      .map((item) => ({
        ...item,
        contributionPercent: grandTotal > 0 ? (item.totalValue / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [
    rawSalesData,
    ketFilter,
    customSellInTargets,
    customSellOutTargets,
    activeMonthManualSellIn,
    sheetSellInBySales,
    sheetSellOutBySales,
  ]);

  const setManualSellInOverride = (salesName: string, value: number | null) => {
    const upperKey = salesName.trim().toUpperCase();
    setManualSellInMap((prev) => {
      const next: MonthlyManualSellInMap = { ...prev };
      const monthEntries = { ...(next[monthKey] || {}) };
      if (value === null || Number.isNaN(value)) {
        delete monthEntries[upperKey];
      } else {
        monthEntries[upperKey] = Math.max(0, value);
      }
      if (Object.keys(monthEntries).length === 0) {
        delete next[monthKey];
      } else {
        next[monthKey] = monthEntries;
      }
      saveManualSellInMap(next);
      return next;
    });
  };

  const handleResetAllManualSellInMonth = () => {
    setManualSellInMap((prev) => {
      const next = { ...prev };
      delete next[monthKey];
      saveManualSellInMap(next);
      return next;
    });
    setInlineEditSales(null);
  };

  const handleStartInlineEdit = (salesName: string, currentSellInValue: number) => {
    setInlineEditSales(salesName);
    setInlineSellInValue(currentSellInValue);
  };

  const handleSaveInlineEdit = (salesName: string) => {
    setManualSellInOverride(salesName, inlineSellInValue);
    setInlineEditSales(null);
  };

  const handleOpenEdit = (salesName: string) => {
    const upperKey = salesName.trim().toUpperCase();
    const sheetVal = sheetSellInBySales[upperKey] || 0;
    const manualVal = activeMonthManualSellIn[upperKey];

    setEditingSalesName(salesName);
    setEditSellInSheetBaseline(sheetVal);
    setEditSellInActualInput(manualVal !== undefined ? manualVal : sheetVal);
    setClearManualSellInOnSave(false);

    const curIn = customSellInTargets[salesName] !== undefined ? customSellInTargets[salesName] : DEFAULT_SALES_TARGET;
    const curOut = customSellOutTargets[salesName] !== undefined ? customSellOutTargets[salesName] : DEFAULT_SALES_SELLOUT_TARGET;
    setTargetSellInInput(curIn);
    setTargetSellOutInput(curOut);
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalesName) return;

    const upperKey = editingSalesName.trim().toUpperCase();
    const currentlyOverridden = activeMonthManualSellIn[upperKey] !== undefined;

    if (clearManualSellInOnSave) {
      setManualSellInOverride(editingSalesName, null);
    } else if (currentlyOverridden || editSellInActualInput !== editSellInSheetBaseline) {
      setManualSellInOverride(editingSalesName, editSellInActualInput);
    }

    setSingleTargetOverride('sales', editingSalesName, targetSellInInput, activeMonth);
    setSingleTargetOverride('salesSellOut', editingSalesName, targetSellOutInput, activeMonth);

    setEditingSalesName(null);
    setRefreshKey((k) => k + 1);
  };

  const modalPreviewPct = targetSellInInput > 0 ? (editSellInActualInput / targetSellInInput) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-6 mb-8 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Analisa Pencapaian &amp; Peringkat Sales
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Evaluasi target &amp; pencapaian ({getMonthDisplayLabel(activeMonth)}), kuantitas, kontribusi, dan bauran produk ({ketFilter === 'ALL' ? 'Konsolidasi' : ketFilter})
          </p>
        </div>

        {/* Filter KET Pills & Total */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Filter:
            </span>
            {[
              { id: 'SELL IN' as const, label: 'SELL IN' },
              { id: 'SELL OUT' as const, label: 'SELL OUT' },
              { id: 'ALL' as const, label: 'Semua / Gabungan' },
            ].map((tab) => {
              const isActive = ketFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setKetFilter(tab.id);
                    setInlineEditSales(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {manualOverrideCount > 0 && (
            <button
              onClick={handleResetAllManualSellInMonth}
              className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Kembalikan semua angka pencapaian Sell In bulan ini ke data Google Sheet"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset {manualOverrideCount} Edit Manual</span>
            </button>
          )}

          <div className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 shadow-2xs">
            Total: {salesData.length} Sales Person
          </div>
        </div>
      </div>

      {/* Dynamic Notification Ribbon for Filter Mode */}
      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80 flex flex-wrap items-center justify-between text-xs text-indigo-950 gap-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <span className="font-bold">
            Mode Tampilan: {ketFilter === 'SELL IN' ? 'Pencapaian & Target SELL IN (Distributor)' : ketFilter === 'SELL OUT' ? 'Pencapaian & Target SELL OUT (Kasir Gerai)' : 'Konsolidasi Total'}
          </span>
        </div>
        <span className="text-[11px] text-indigo-800">
          Klik ikon pensil pada kolom <strong>Realisasi Sell In (Rp)</strong> atau tombol <strong>Ubah</strong> untuk edit manual pencapaian Sell In &amp; target per sales.
        </span>
      </div>

      {/* Leaderboard Cards Grid with Gold, Silver, Bronze */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {salesData.slice(0, 3).map((sales, index) => {
          const podiumStyles = [
            {
              card: 'border-amber-300 bg-gradient-to-br from-white via-amber-50/50 to-yellow-50/40 border-t-4 border-t-amber-500 shadow-md',
              badge: 'bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-300 text-amber-950 shadow-xs border border-amber-300',
              label: 'JUARA 1',
              icon: <Trophy className="w-4 h-4 text-amber-600" />,
            },
            {
              card: 'border-slate-300 bg-gradient-to-br from-white via-slate-50/70 to-blue-50/30 border-t-4 border-t-slate-400 shadow-sm',
              badge: 'bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-900 shadow-xs border border-slate-300',
              label: 'JUARA 2',
              icon: <Medal className="w-4 h-4 text-slate-500" />,
            },
            {
              card: 'border-amber-400/80 bg-gradient-to-br from-white via-orange-50/50 to-amber-50/30 border-t-4 border-t-amber-700 shadow-sm',
              badge: 'bg-gradient-to-tr from-amber-700 to-orange-500 text-white shadow-xs border border-amber-600',
              label: 'JUARA 3',
              icon: <Medal className="w-4 h-4 text-amber-700" />,
            },
          ];

          const p = podiumStyles[index] || podiumStyles[1];

          return (
            <div
              key={sales.name}
              className={`p-5 rounded-2xl border ${p.card} flex flex-col justify-between transition-all hover:shadow-lg hover:-translate-y-0.5`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                      {p.icon}
                      {p.label} SALES
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                      {sales.name}
                    </h3>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${p.badge}`}>
                    #{index + 1}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white/95 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {ketFilter === 'SELL IN' ? 'Realisasi Sell In:' : ketFilter === 'SELL OUT' ? 'Realisasi Sell Out:' : 'Total Penjualan:'}
                    </span>
                    {sales.hasManualSellIn && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Manual
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-extrabold font-mono text-slate-950 tabular-nums mt-0.5">
                    {formatRupiah(sales.totalValue)}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">
                      Target {ketFilter === 'SELL OUT' ? 'Sell Out' : 'Sell In'}:{' '}
                      <strong className="tabular-nums">{formatRupiah(sales.target || 0, true)}</strong>
                    </span>
                    <span className="font-mono font-extrabold text-emerald-700 tabular-nums">
                      {formatPercent(sales.achievementPercent || 0, false)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-teal-500 via-emerald-500 to-green-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, sales.achievementPercent || 0)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Kuantitas:</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">{formatNumber(sales.totalQty)} pcs</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Kontribusi:</span>
                      <span className="font-mono font-bold text-indigo-700 tabular-nums">{formatPercent(sales.contributionPercent, false)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex justify-end">
                <button
                  onClick={() => handleOpenEdit(sales.name)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3 h-3 text-indigo-600" />
                  <span>Ubah Target &amp; Sell In</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comprehensive Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600 font-bold bg-gradient-to-r from-slate-50 to-indigo-50/30">
              <th className="py-3 px-3">No</th>
              <th className="py-3 px-3">Nama Sales</th>
              <th className="py-3 px-3 text-right">
                {ketFilter === 'SELL IN' ? 'Realisasi Sell In (Rp)' : ketFilter === 'SELL OUT' ? 'Realisasi Sell Out (Rp)' : 'Total Penjualan (Rp)'}
              </th>
              <th className="py-3 px-3 text-right bg-indigo-50/50 text-indigo-950 font-black">
                {ketFilter === 'SELL IN' ? 'Target Sell In (Rp)' : ketFilter === 'SELL OUT' ? 'Target Sell Out (Rp)' : 'Target (Rp)'}
              </th>
              <th className="py-3 px-3 w-40 text-center">Pencapaian (%)</th>
              <th className="py-3 px-3 text-right">Kuantitas (QTY)</th>
              <th className="py-3 px-3 text-right">Transaksi</th>
              <th className="py-3 px-3 text-right">Kontribusi</th>
              <th className="py-3 px-3">Bauran Brand Terbesar</th>
              <th className="py-3 px-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {salesData.map((item, idx) => {
              const topBrand = item.brandBreakdown
                ? Object.entries(item.brandBreakdown).sort((a, b) => b[1] - a[1])[0]
                : null;
              const isInlineEditing = inlineEditSales === item.name && ketFilter === 'SELL IN';

              return (
                <tr key={item.name} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {item.name}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-950 tabular-nums">
                    {isInlineEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="any"
                          autoFocus
                          value={inlineSellInValue}
                          onChange={(e) => setInlineSellInValue(Math.max(0, Number(e.target.value)))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveInlineEdit(item.name);
                            } else if (e.key === 'Escape') {
                              setInlineEditSales(null);
                            }
                          }}
                          className="w-36 px-2 py-1 text-right text-xs font-mono font-bold rounded-lg border border-indigo-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineEdit(item.name)}
                          className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                          title="Simpan Pencapaian Sell In"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInlineEditSales(null)}
                          className="p-1 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                          title="Batal"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {item.hasManualSellIn && (
                          <span
                            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"
                            title={`Diedit manual (Data Sheet: ${formatRupiah(item.sheetSellInValue)})`}
                          >
                            Manual
                          </span>
                        )}
                        <span>{formatRupiah(item.totalValue)}</span>
                        {ketFilter === 'SELL IN' && (
                          <button
                            type="button"
                            onClick={() => handleStartInlineEdit(item.name, item.totalValue)}
                            className="p-1 rounded-md text-indigo-600 hover:bg-indigo-100 cursor-pointer transition-colors"
                            title="Edit manual Pencapaian Sell In"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                        {item.hasManualSellIn && ketFilter === 'SELL IN' && (
                          <button
                            type="button"
                            onClick={() => setManualSellInOverride(item.name, null)}
                            className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer transition-colors"
                            title="Kembalikan ke data Google Sheet"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-indigo-900 bg-indigo-50/30 tabular-nums">
                    {formatRupiah(item.target || 0)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="grow bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, item.achievementPercent || 0)}%` }}
                        />
                      </div>
                      <span className="font-mono font-extrabold text-xs text-emerald-800 w-12 text-right tabular-nums">
                        {formatPercent(item.achievementPercent || 0, false)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums font-bold">
                    {formatNumber(item.totalQty)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums">
                    {item.transactionCount}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-indigo-700 tabular-nums font-bold">
                    {formatPercent(item.contributionPercent, false)}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {topBrand ? (
                      <span className="font-bold text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300 text-[11px] shadow-2xs">
                        {topBrand[0]} ({formatRupiah(topBrand[1], true)})
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleOpenEdit(item.name)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1 mx-auto cursor-pointer transition-colors"
                      title="Edit Manual Pencapaian Sell In, Target Sell In & Target Sell Out"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Ubah</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Pencapaian & Target Sales Modal */}
      {editingSalesName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Edit Pencapaian &amp; Target: {editingSalesName}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Periode: {getMonthDisplayLabel(activeMonth)}
                </p>
              </div>
              <button
                onClick={() => setEditingSalesName(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-slate-800 font-extrabold">
                    Pencapaian / Realisasi SELL IN (Rp)
                  </label>
                  {(activeMonthManualSellIn[editingSalesName.trim().toUpperCase()] !== undefined ||
                    editSellInActualInput !== editSellInSheetBaseline) &&
                    !clearManualSellInOnSave && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditSellInActualInput(editSellInSheetBaseline);
                          setClearManualSellInOnSave(true);
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Data Sheet</span>
                      </button>
                    )}
                </div>
                <input
                  type="number"
                  step="any"
                  value={editSellInActualInput}
                  onChange={(e) => {
                    setEditSellInActualInput(Math.max(0, Number(e.target.value)));
                    setClearManualSellInOnSave(false);
                  }}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-indigo-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Sheet: {formatRupiah(editSellInSheetBaseline)}</span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    Capaian: {formatPercent(modalPreviewPct, false)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Target SELL IN (Distributor / Taking Order)
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetSellInInput}
                  onChange={(e) => setTargetSellInInput(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block tabular-nums">
                  Terbilang: {formatRupiah(targetSellInInput)}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Target SELL OUT (Realisasi Kasir Gerai Binaan)
                </label>
                <input
                  type="number"
                  step="any"
                  value={targetSellOutInput}
                  onChange={(e) => setTargetSellOutInput(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block tabular-nums">
                  Terbilang: {formatRupiah(targetSellOutInput)}
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                Pencapaian Sell In manual tersimpan khusus untuk periode{' '}
                <strong>{getMonthDisplayLabel(activeMonth)}</strong>, sedangkan target otomatis disinkronkan ke seluruh menu.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSalesName(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

