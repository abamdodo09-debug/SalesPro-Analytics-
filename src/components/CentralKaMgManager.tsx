import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Edit2,
  Save,
  RotateCcw,
  Calendar,
  Building2,
  Layers,
  CheckCircle2,
  Sparkles,
  FileSpreadsheet,
  ShieldCheck,
  X,
  Check,
  Trash2,
} from 'lucide-react';
import { TransactionRecord, DashboardFilters } from '../types/dashboard';
import {
  loadManualKaMgMonthData,
  saveManualKaMgMonthData,
  resetManualKaMgMonthData,
  resetAllManualKaMgYearData,
} from '../services/spvSellInSellOutService';
import { saveKaMgSalesOverride } from '../services/masterStoreService';
import { formatRupiah } from '../utils/analytics';
import * as XLSX from 'xlsx';

interface CentralKaMgManagerProps {
  records: TransactionRecord[];
  filters: DashboardFilters;
  onDataUpdated?: () => void;
}

const MONTHS_LIST = [
  { key: 'JANUARI', label: 'Januari', short: 'Jan' },
  { key: 'FEBRUARI', label: 'Februari', short: 'Feb' },
  { key: 'MARET', label: 'Maret', short: 'Mar' },
  { key: 'APRIL', label: 'April', short: 'Apr' },
  { key: 'MEI', label: 'Mei', short: 'Mei' },
  { key: 'JUNI', label: 'Juni', short: 'Jun' },
  { key: 'JULI', label: 'Juli', short: 'Jul' },
  { key: 'AGUSTUS', label: 'Agustus', short: 'Agu' },
  { key: 'SEPTEMBER', label: 'September', short: 'Sep' },
  { key: 'OKTOBER', label: 'Oktober', short: 'Okt' },
  { key: 'NOVEMBER', label: 'November', short: 'Nov' },
  { key: 'DESEMBER', label: 'Desember', short: 'Des' },
];

function formatGrowthDisplay(val: number): string {
  const num = Number(val) || 0;
  const fixed = num.toFixed(1);
  return num > 0 ? `+${fixed}%` : `${fixed}%`;
}

export const CentralKaMgManager: React.FC<CentralKaMgManagerProps> = ({
  filters,
  onDataUpdated,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return filters.BULAN && filters.BULAN !== 'ALL' ? filters.BULAN.toUpperCase() : 'ALL';
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const parsed = Number(filters.TAHUN);
    return !isNaN(parsed) && parsed > 2000 ? parsed : 2026;
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      setSelectedMonth(filters.BULAN.toUpperCase());
    }
  }, [filters.BULAN]);

  useEffect(() => {
    const parsed = Number(filters.TAHUN);
    if (filters.TAHUN !== 'ALL' && !isNaN(parsed) && parsed > 2000) {
      setSelectedYear(parsed);
    }
  }, [filters.TAHUN]);

  // Modal Edit Single Month (hanya KA, DAZZLE ME MG, Total, Growth)
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [inputKaSellIn, setInputKaSellIn] = useState<number>(0);
  const [inputDazzleMeMgSellIn, setInputDazzleMeMgSellIn] = useState<number>(0);
  const [inputTotalSellIn, setInputTotalSellIn] = useState<number>(0);
  const [isModalTotalCustom, setIsModalTotalCustom] = useState<boolean>(false);
  const [inputGrowthPercent, setInputGrowthPercent] = useState<string>('0');
  const [isModalGrowthCustom, setIsModalGrowthCustom] = useState<boolean>(false);

  // Inline Table Row Edit State
  const [inlineEditMonth, setInlineEditMonth] = useState<string | null>(null);
  const [inlineKa, setInlineKa] = useState<number>(0);
  const [inlineMg, setInlineMg] = useState<number>(0);
  const [inlineTotal, setInlineTotal] = useState<number>(0);
  const [isInlineTotalCustom, setIsInlineTotalCustom] = useState<boolean>(false);
  const [inlineGrowth, setInlineGrowth] = useState<string>('0');
  const [isInlineGrowthCustom, setIsInlineGrowthCustom] = useState<boolean>(false);

  // Inline Reset All Confirmation State (avoids window.confirm inside iframe)
  const [confirmResetAll, setConfirmResetAll] = useState<boolean>(false);

  // Notification Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 12-Month 100% Manual History Data (zero hardcoded defaults, zero automatic Google Sheet values)
  const historyData = useMemo(() => {
    const rawRows = MONTHS_LIST.map((m) => {
      const manualData = loadManualKaMgMonthData(m.key, selectedYear);
      return {
        key: m.key,
        label: m.label,
        short: m.short,
        ...manualData,
      };
    });

    return rawRows.map((row, idx) => {
      const prevRow = idx > 0 ? rawRows[idx - 1] : null;
      const autoGrowth =
        prevRow && prevRow.totalSellIn > 0
          ? Math.round(((row.totalSellIn - prevRow.totalSellIn) / prevRow.totalSellIn) * 1000) / 10
          : 0;
      const effectiveGrowth = row.isCustomGrowth ? row.growthPercent : autoGrowth;

      return {
        ...row,
        autoGrowthPercent: autoGrowth,
        effectiveGrowthPercent: effectiveGrowth,
      };
    });
  }, [selectedYear, refreshKey]);

  // Totals for all 12 months
  const yearlyTotals = useMemo(() => {
    const totalKa = historyData.reduce((acc, h) => acc + h.kaSellInValue, 0);
    const totalMg = historyData.reduce((acc, h) => acc + h.dazzleMeMgSellInValue, 0);
    const totalSellIn = historyData.reduce((acc, h) => acc + h.totalSellIn, 0);
    const filledRows = historyData.filter((h) => h.isFilled);
    const filledMonthsCount = filledRows.length;

    const avgGrowth =
      filledRows.length > 0
        ? Math.round(
            (filledRows.reduce((acc, h) => acc + h.effectiveGrowthPercent, 0) / filledRows.length) * 10
          ) / 10
        : 0;

    return {
      totalKa,
      totalMg,
      totalSellIn,
      avgGrowth,
      filledMonthsCount,
    };
  }, [historyData]);

  // Selected Month's active manual record
  const currentMonthData = useMemo(() => {
    if (selectedMonth === 'ALL') {
      return {
        key: 'ALL',
        label: `Semua Bulan (YTD ${selectedYear})`,
        short: 'YTD',
        kaSellInValue: yearlyTotals.totalKa,
        dazzleMeMgSellInValue: yearlyTotals.totalMg,
        totalSellIn: yearlyTotals.totalSellIn,
        effectiveGrowthPercent: yearlyTotals.avgGrowth,
        isCustomGrowth: false,
        isFilled: yearlyTotals.filledMonthsCount > 0,
      };
    }
    const found = historyData.find((h) => h.key === selectedMonth);
    return found || historyData[0];
  }, [historyData, selectedMonth, yearlyTotals, selectedYear]);

  // Helper to persist manual data
  const persistMonthManualData = (
    monthKey: string,
    payload: {
      ka: number;
      mg: number;
      total: number;
      isCustomTotal: boolean;
      growth: number;
      isCustomGrowth: boolean;
    }
  ) => {
    saveManualKaMgMonthData({
      periodMonth: monthKey,
      periodYear: selectedYear,
      spvRegularSellIn: 0,
      kaSellInValue: payload.ka,
      dazzleMeMgSellInValue: payload.mg,
      totalSellIn: payload.total,
      isCustomTotal: payload.isCustomTotal,
      growthPercent: payload.growth,
      isCustomGrowth: payload.isCustomGrowth,
      totalSellOut: 0,
      target: 0,
      notes: `Input manual KA & DAZZLE ME MG ${monthKey} ${selectedYear}`,
    });

    saveKaMgSalesOverride({
      isManual: true,
      spvSalesValue: 0,
      kaSalesValue: payload.ka,
      mgSalesValue: payload.mg,
      dazzleMeMgSalesValue: payload.mg,
      notes: `Input manual bulan ${monthKey} ${selectedYear}`,
    });

    setRefreshKey((k) => k + 1);
    if (onDataUpdated) onDataUpdated();
  };

  // Open Edit Modal for a specific month
  const handleOpenEdit = (monthKey: string) => {
    const m = monthKey === 'ALL' ? 'JANUARI' : monthKey;
    const row = historyData.find((h) => h.key === m) || historyData[0];
    setEditingMonth(m);
    setInputKaSellIn(row.kaSellInValue);
    setInputDazzleMeMgSellIn(row.dazzleMeMgSellInValue);
    setInputTotalSellIn(row.totalSellIn);
    setIsModalTotalCustom(Boolean(row.isCustomTotal));
    setInputGrowthPercent(String(row.effectiveGrowthPercent));
    setIsModalGrowthCustom(Boolean(row.isCustomGrowth));
  };

  const handleModalKaChange = (val: number) => {
    const clean = Math.max(0, val);
    setInputKaSellIn(clean);
    if (!isModalTotalCustom) {
      setInputTotalSellIn(clean + inputDazzleMeMgSellIn);
    }
  };

  const handleModalMgChange = (val: number) => {
    const clean = Math.max(0, val);
    setInputDazzleMeMgSellIn(clean);
    if (!isModalTotalCustom) {
      setInputTotalSellIn(inputKaSellIn + clean);
    }
  };

  // Save Single Month Modal Edits
  const handleSaveMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonth) return;

    const finalTotal = isModalTotalCustom
      ? Math.max(0, inputTotalSellIn)
      : inputKaSellIn + inputDazzleMeMgSellIn;
    const parsedGrowth = parseFloat(inputGrowthPercent);
    const finalGrowth = !isNaN(parsedGrowth) ? parsedGrowth : 0;

    persistMonthManualData(editingMonth, {
      ka: inputKaSellIn,
      mg: inputDazzleMeMgSellIn,
      total: finalTotal,
      isCustomTotal: isModalTotalCustom && Math.round(finalTotal) !== Math.round(inputKaSellIn + inputDazzleMeMgSellIn),
      growth: finalGrowth,
      isCustomGrowth: isModalGrowthCustom,
    });

    setEditingMonth(null);
    showNotification(
      `Data manual ${editingMonth} ${selectedYear} disimpan: KA ${formatRupiah(inputKaSellIn, true)} • DAZZLE ME MG ${formatRupiah(inputDazzleMeMgSellIn, true)} • Total ${formatRupiah(finalTotal, true)}`
    );
  };

  // Start inline row edit
  const startInlineEdit = (row: (typeof historyData)[number]) => {
    setInlineEditMonth(row.key);
    setInlineKa(row.kaSellInValue);
    setInlineMg(row.dazzleMeMgSellInValue);
    setInlineTotal(row.totalSellIn);
    setIsInlineTotalCustom(Boolean(row.isCustomTotal));
    setInlineGrowth(String(row.effectiveGrowthPercent));
    setIsInlineGrowthCustom(Boolean(row.isCustomGrowth));
  };

  const handleInlineKaChange = (val: number) => {
    const clean = Math.max(0, val);
    setInlineKa(clean);
    if (!isInlineTotalCustom) {
      setInlineTotal(clean + inlineMg);
    }
  };

  const handleInlineMgChange = (val: number) => {
    const clean = Math.max(0, val);
    setInlineMg(clean);
    if (!isInlineTotalCustom) {
      setInlineTotal(inlineKa + clean);
    }
  };

  const saveInlineEdit = (monthKey: string) => {
    const finalTotal = isInlineTotalCustom ? Math.max(0, inlineTotal) : inlineKa + inlineMg;
    const parsedGrowth = parseFloat(inlineGrowth);
    const finalGrowth = !isNaN(parsedGrowth) ? parsedGrowth : 0;

    persistMonthManualData(monthKey, {
      ka: inlineKa,
      mg: inlineMg,
      total: finalTotal,
      isCustomTotal: isInlineTotalCustom && Math.round(finalTotal) !== Math.round(inlineKa + inlineMg),
      growth: finalGrowth,
      isCustomGrowth: isInlineGrowthCustom,
    });
    setInlineEditMonth(null);
    showNotification(`Baris ${monthKey} ${selectedYear} berhasil disimpan manual.`);
  };

  // Reset single month back to 0 (empty manual)
  const handleResetMonth = (monthKey: string) => {
    resetManualKaMgMonthData(monthKey, selectedYear);
    if (inlineEditMonth === monthKey) setInlineEditMonth(null);
    setRefreshKey((k) => k + 1);
    if (onDataUpdated) onDataUpdated();
    showNotification(`Data manual ${monthKey} ${selectedYear} direset ke Rp 0.`);
  };

  // Reset all 12 months of selectedYear to 0
  const handleResetAllYear = () => {
    resetAllManualKaMgYearData(selectedYear);
    setInlineEditMonth(null);
    setConfirmResetAll(false);
    setRefreshKey((k) => k + 1);
    if (onDataUpdated) onDataUpdated();
    showNotification(`Seluruh data manual Januari–Desember ${selectedYear} berhasil direset ke Rp 0.`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = historyData.map((h, idx) => ({
      No: idx + 1,
      Tahun: selectedYear,
      Bulan: h.label,
      'Sell In KA (Modern Trade)': h.kaSellInValue,
      'Sell In DAZZLE ME MG': h.dazzleMeMgSellInValue,
      Total: h.totalSellIn,
      'Growth (%)': formatGrowthDisplay(h.effectiveGrowthPercent),
    }));

    rows.push({
      No: 13,
      Tahun: selectedYear,
      Bulan: `TOTAL AKUMULASI (${selectedYear})`,
      'Sell In KA (Modern Trade)': yearlyTotals.totalKa,
      'Sell In DAZZLE ME MG': yearlyTotals.totalMg,
      Total: yearlyTotals.totalSellIn,
      'Growth (%)': formatGrowthDisplay(yearlyTotals.avgGrowth),
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `KA & MG ${selectedYear}`);
    XLSX.writeFile(
      wb,
      `Riwayat_SellIn_KA_DAZZLE_ME_MG_${selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showNotification('File Excel riwayat Sell In KA & DAZZLE ME MG berhasil diunduh!');
  };

  const maxChartTotal = Math.max(...historyData.map((h) => h.totalSellIn), 1);

  return (
    <div className="space-y-6 mb-8">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  Mode Input 100% Manual · Tahun {selectedYear}
                </p>
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                  Kelola &amp; Riwayat Sell In KA &amp; DAZZLE ME MG (Januari – Desember)
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Seluruh data Sell In KA (Modern Trade), Sell In DAZZLE ME MG, Total, dan Growth bersifat{' '}
              <strong>100% input manual</strong> (dimulai dari Rp 0). Klik Edit pada baris bulan mana pun untuk mengisi atau mengubah angka langsung di tabel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setInlineEditMonth(null);
              }}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer tabular-nums"
              title="Pilih tahun riwayat manual"
            >
              <option value={2025}>Tahun 2025</option>
              <option value={2026}>Tahun 2026</option>
              <option value={2027}>Tahun 2027</option>
            </select>

            <button
              onClick={() => handleOpenEdit(selectedMonth === 'ALL' ? 'JANUARI' : selectedMonth)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Input / Edit ({selectedMonth === 'ALL' ? 'JANUARI' : selectedMonth})</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            {yearlyTotals.filledMonthsCount > 0 && !confirmResetAll && (
              <button
                onClick={() => setConfirmResetAll(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Semua ke 0</span>
              </button>
            )}

            {confirmResetAll && (
              <div className="flex items-center gap-1.5 bg-rose-950 border border-rose-700 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-rose-200 font-semibold">Reset {selectedYear} ke 0?</span>
                <button
                  onClick={handleResetAllYear}
                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  Ya
                </button>
                <button
                  onClick={() => setConfirmResetAll(false)}
                  className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4 KPI Summary Cards (Tanpa Sell In Reguler) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700">
            <div className="flex items-center justify-between text-[11px] font-bold text-purple-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Sell In KA (Modern Trade)
              </span>
              <span className="text-[10px] font-mono text-slate-400">MANUAL</span>
            </div>
            <div className="text-lg font-extrabold font-mono text-white tabular-nums">
              {formatRupiah(currentMonthData.kaSellInValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
              Porsi:{' '}
              {currentMonthData.totalSellIn > 0
                ? ((currentMonthData.kaSellInValue / currentMonthData.totalSellIn) * 100).toFixed(1)
                : '0.0'}
              %
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Sell In DAZZLE ME MG
              </span>
              <span className="text-[10px] font-mono text-slate-400">MANUAL</span>
            </div>
            <div className="text-lg font-extrabold font-mono text-white tabular-nums">
              {formatRupiah(currentMonthData.dazzleMeMgSellInValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
              Porsi:{' '}
              {currentMonthData.totalSellIn > 0
                ? ((currentMonthData.dazzleMeMgSellInValue / currentMonthData.totalSellIn) * 100).toFixed(1)
                : '0.0'}
              %
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-700">
            <div className="flex items-center justify-between text-[11px] font-bold text-cyan-200 mb-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Total Sell In KA &amp; MG
              </span>
              <span className="text-[10px] font-mono text-cyan-300">{selectedMonth}</span>
            </div>
            <div className="text-lg font-extrabold font-mono text-cyan-300 tabular-nums">
              {formatRupiah(currentMonthData.totalSellIn)}
            </div>
            <div className="text-[11px] text-slate-300 mt-1 font-mono tabular-nums">
              {yearlyTotals.filledMonthsCount}/12 Bulan Terisi ({selectedYear})
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 mb-1">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Growth ({selectedMonth === 'ALL' ? 'Rata-rata' : selectedMonth})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {currentMonthData.isCustomGrowth ? 'MANUAL' : 'MoM'}
              </span>
            </div>
            <div
              className={`text-lg font-extrabold font-mono tabular-nums ${
                currentMonthData.effectiveGrowthPercent > 0
                  ? 'text-emerald-400'
                  : currentMonthData.effectiveGrowthPercent < 0
                  ? 'text-rose-400'
                  : 'text-slate-200'
              }`}
            >
              {formatGrowthDisplay(currentMonthData.effectiveGrowthPercent)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Dapat diedit langsung pada tabel
            </div>
          </div>
        </div>
      </div>

      {/* Month Filter Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Pilih Bulan Ringkasan (Input Manual {selectedYear})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {yearlyTotals.filledMonthsCount} / 12 Bulan Terisi Manual
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-13 gap-1.5 mt-3">
          <button
            onClick={() => setSelectedMonth('ALL')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedMonth === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Semua (YTD)
          </button>
          {MONTHS_LIST.map((m) => {
            const isSelected = selectedMonth === m.key;
            const data = historyData.find((h) => h.key === m.key);
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMonth(m.key)}
                className={`px-2 py-2 rounded-lg text-xs font-bold transition-colors text-center cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="truncate">{m.short}</div>
                <div
                  className={`text-[10px] font-mono mt-0.5 truncate tabular-nums ${
                    isSelected ? 'text-indigo-100' : data?.isFilled ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {formatRupiah(data?.totalSellIn || 0, true)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 12-Month Historical Bar Graph (Hanya KA & DAZZLE ME MG) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Grafik Komparasi Sell In KA &amp; DAZZLE ME MG (Januari – Desember {selectedYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Skala grafik dihitung 100% dari nilai manual Sell In KA dan DAZZLE ME MG
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-purple-500" /> KA (Modern Trade)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> DAZZLE ME MG
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-1">
          {historyData.map((h) => {
            const isSelected = selectedMonth === h.key;
            const kaHeight = h.kaSellInValue > 0 ? Math.max(4, Math.round((h.kaSellInValue / maxChartTotal) * 96)) : 0;
            const mgHeight = h.dazzleMeMgSellInValue > 0 ? Math.max(4, Math.round((h.dazzleMeMgSellInValue / maxChartTotal) * 96)) : 0;

            return (
              <div
                key={h.key}
                onClick={() => setSelectedMonth(h.key)}
                className={`flex flex-col items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-400'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-slate-700 truncate w-full text-center tabular-nums">
                  {formatRupiah(h.totalSellIn, true)}
                </span>

                <div className="h-28 w-full flex items-end justify-center gap-1.5 px-1 py-1 bg-slate-100/80 rounded my-2">
                  {h.kaSellInValue === 0 && h.dazzleMeMgSellInValue === 0 ? (
                    <span className="text-[10px] font-mono text-slate-400 self-center">0</span>
                  ) : (
                    <>
                      <div
                        title={`KA: ${formatRupiah(h.kaSellInValue)}`}
                        style={{ height: `${kaHeight}px` }}
                        className="w-3 bg-purple-500 rounded-t-xs"
                      />
                      <div
                        title={`DAZZLE ME MG: ${formatRupiah(h.dazzleMeMgSellInValue)}`}
                        style={{ height: `${mgHeight}px` }}
                        className="w-3 bg-emerald-500 rounded-t-xs"
                      />
                    </>
                  )}
                </div>

                <span
                  className={`text-[10px] font-mono font-semibold tabular-nums ${
                    h.effectiveGrowthPercent > 0
                      ? 'text-emerald-700'
                      : h.effectiveGrowthPercent < 0
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                >
                  {formatGrowthDisplay(h.effectiveGrowthPercent)}
                </span>

                <span
                  className={`text-xs font-bold uppercase mt-0.5 ${
                    isSelected ? 'text-indigo-700' : 'text-slate-800'
                  }`}
                >
                  {h.short}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabel Riwayat Pencapaian Sell In KA & DAZZLE ME MG (Januari s/d Desember {selectedYear}) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Tabel Riwayat Pencapaian Sell In KA &amp; DAZZLE ME MG (Januari s/d Desember {selectedYear})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              100% Data Manual — klik <strong>Edit</strong> untuk mengubah Sell In KA, Sell In DAZZLE ME MG, Total, dan Growth secara langsung
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
            {yearlyTotals.filledMonthsCount} dari 12 bulan terisi · Tahun {selectedYear}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-700 font-bold bg-slate-50">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Bulan</th>
                <th className="py-2.5 px-3 text-right">Sell In KA (Modern Trade)</th>
                <th className="py-2.5 px-3 text-right">Sell In DAZZLE ME MG</th>
                <th className="py-2.5 px-3 text-right bg-indigo-50/50 text-indigo-950">Total</th>
                <th className="py-2.5 px-3 text-center">Growth</th>
                <th className="py-2.5 px-3 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyData.map((row, idx) => {
                const isSelected = selectedMonth === row.key;
                const isInlineEditing = inlineEditMonth === row.key;
                const liveTotal = isInlineEditing
                  ? isInlineTotalCustom
                    ? inlineTotal
                    : inlineKa + inlineMg
                  : row.totalSellIn;
                const liveGrowth = isInlineEditing
                  ? parseFloat(inlineGrowth) || 0
                  : row.effectiveGrowthPercent;

                return (
                  <tr
                    key={row.key}
                    className={`transition-colors ${
                      isInlineEditing
                        ? 'bg-indigo-50/40'
                        : isSelected
                        ? 'bg-slate-50 font-semibold'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {row.label}
                    </td>

                    {/* Sell In KA (Modern Trade) */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={inlineKa}
                          onChange={(e) => handleInlineKaChange(Number(e.target.value) || 0)}
                          className="w-36 px-2.5 py-1 text-right text-xs font-mono font-bold border border-purple-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      ) : (
                        <span className="font-semibold text-purple-900">
                          {formatRupiah(row.kaSellInValue)}
                        </span>
                      )}
                    </td>

                    {/* Sell In DAZZLE ME MG */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={inlineMg}
                          onChange={(e) => handleInlineMgChange(Number(e.target.value) || 0)}
                          className="w-36 px-2.5 py-1 text-right text-xs font-mono font-bold border border-emerald-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      ) : (
                        <span className="font-semibold text-emerald-900">
                          {formatRupiah(row.dazzleMeMgSellInValue)}
                        </span>
                      )}
                    </td>

                    {/* Total (Editable) */}
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-indigo-950 bg-indigo-50/30 tabular-nums whitespace-nowrap">
                      {isInlineEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={liveTotal}
                          onChange={(e) => {
                            setIsInlineTotalCustom(true);
                            setInlineTotal(Math.max(0, Number(e.target.value) || 0));
                          }}
                          className="w-36 px-2.5 py-1 text-right text-xs font-mono font-bold border border-indigo-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <span>{formatRupiah(row.totalSellIn)}</span>
                      )}
                    </td>

                    {/* Growth (Editable %) */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold tabular-nums whitespace-nowrap">
                      {isInlineEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={inlineGrowth}
                            onChange={(e) => {
                              setIsInlineGrowthCustom(true);
                              setInlineGrowth(e.target.value);
                            }}
                            className="w-20 px-2 py-1 text-right text-xs font-mono font-bold border border-amber-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      ) : (
                        <span
                          className={
                            liveGrowth > 0
                              ? 'text-emerald-700'
                              : liveGrowth < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }
                        >
                          {formatGrowthDisplay(liveGrowth)}
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {isInlineEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => saveInlineEdit(row.key)}
                            className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            title="Simpan baris ini"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setInlineEditMonth(null)}
                            className="p-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                            title="Batal edit"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startInlineEdit(row)}
                            className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition-colors cursor-pointer"
                            title={`Edit langsung baris ${row.label}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleOpenEdit(row.key)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer"
                            title={`Buka form edit ${row.label}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {row.isFilled && (
                            <button
                              onClick={() => handleResetMonth(row.key)}
                              className="p-1.5 rounded hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer"
                              title={`Reset ${row.label} ke Rp 0`}
                            >
                              <RotateCcw className="w-3 h-3" />
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
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                <td colSpan={2} className="py-3 px-3 uppercase tracking-wider">
                  Total Akumulasi ({selectedYear})
                </td>
                <td className="py-3 px-3 text-right font-mono text-purple-950 tabular-nums">
                  {formatRupiah(yearlyTotals.totalKa)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-950 tabular-nums">
                  {formatRupiah(yearlyTotals.totalMg)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-indigo-950 font-extrabold tabular-nums">
                  {formatRupiah(yearlyTotals.totalSellIn)}
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums">
                  <span
                    className={
                      yearlyTotals.avgGrowth > 0
                        ? 'text-emerald-700'
                        : yearlyTotals.avgGrowth < 0
                        ? 'text-rose-600'
                        : 'text-slate-600'
                    }
                  >
                    {formatGrowthDisplay(yearlyTotals.avgGrowth)}
                  </span>
                </td>
                <td className="py-3 px-3 text-center font-mono text-slate-600 tabular-nums">
                  {yearlyTotals.filledMonthsCount}/12 Terisi
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MODAL EDIT SINGLE MONTH (Hanya KA, DAZZLE ME MG, Total, Growth) */}
      {editingMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  Input Manual · {selectedYear}
                </span>
                <h3 className="text-base font-extrabold flex items-center gap-2 mt-0.5">
                  <Edit2 className="w-4 h-4 text-cyan-300" />
                  Edit Sell In KA &amp; DAZZLE ME MG ({editingMonth} {selectedYear})
                </h3>
              </div>
              <button
                onClick={() => setEditingMonth(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMonth} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/40">
                <label className="block text-purple-950 font-bold mb-1">
                  1. Sell In KA (Modern Trade) - IDR
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={inputKaSellIn}
                  onChange={(e) => handleModalKaChange(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-purple-300 bg-white focus:ring-2 focus:ring-purple-500 tabular-nums"
                  required
                />
                <span className="text-[11px] text-purple-800 font-mono mt-1 block tabular-nums">
                  {formatRupiah(inputKaSellIn)}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <label className="block text-emerald-950 font-bold mb-1">
                  2. Sell In DAZZLE ME MG - IDR
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={inputDazzleMeMgSellIn}
                  onChange={(e) => handleModalMgChange(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500 tabular-nums"
                  required
                />
                <span className="text-[11px] text-emerald-800 font-mono mt-1 block tabular-nums">
                  {formatRupiah(inputDazzleMeMgSellIn)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/40">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-indigo-950 font-bold">3. Total - IDR</label>
                    {isModalTotalCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalTotalCustom(false);
                          setInputTotalSellIn(inputKaSellIn + inputDazzleMeMgSellIn);
                        }}
                        className="text-[10px] font-semibold text-indigo-700 hover:underline cursor-pointer"
                      >
                        Hitung Otomatis
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={inputTotalSellIn}
                    onChange={(e) => {
                      setIsModalTotalCustom(true);
                      setInputTotalSellIn(Math.max(0, Number(e.target.value) || 0));
                    }}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 tabular-nums"
                    required
                  />
                  <span className="text-[11px] text-indigo-800 font-mono mt-1 block tabular-nums">
                    {formatRupiah(inputTotalSellIn)}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-amber-950 font-bold">4. Growth (%)</label>
                    {isModalGrowthCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          const row = historyData.find((h) => h.key === editingMonth);
                          setIsModalGrowthCustom(false);
                          setInputGrowthPercent(String(row?.autoGrowthPercent ?? 0));
                        }}
                        className="text-[10px] font-semibold text-amber-800 hover:underline cursor-pointer"
                      >
                        Auto MoM
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={inputGrowthPercent}
                      onChange={(e) => {
                        setIsModalGrowthCustom(true);
                        setInputGrowthPercent(e.target.value);
                      }}
                      className="w-full px-3 py-2 pr-8 text-sm font-mono font-bold rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 tabular-nums"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-slate-500 font-bold">%</span>
                  </div>
                  <span className="text-[11px] text-amber-900 font-mono mt-1 block tabular-nums">
                    Preview: {formatGrowthDisplay(parseFloat(inputGrowthPercent) || 0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMonth(null)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Manual ({editingMonth})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
