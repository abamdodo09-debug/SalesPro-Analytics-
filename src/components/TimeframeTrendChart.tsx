import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Award,
  Sparkles,
  LineChart,
  Edit2,
  Check,
  X,
  RotateCcw,
  FileSpreadsheet,
  Search,
  Plus,
  Table as TableIcon,
} from 'lucide-react';
import { DashboardFilters, TimeframeMode } from '../types/dashboard';
import { formatRupiah, formatNumber } from '../utils/analytics';
import { generateForecast, ForecastTrendItem } from '../utils/forecasting';
import {
  loadTimeframeScopeEdits,
  saveTimeframeRowEdit,
  removeTimeframeRowEdit,
  clearTimeframeScopeEdits,
  exportTimeframeBreakdownToExcel,
  TimeframeRowEdit,
} from '../services/timeframeEditService';

export interface TrendItem {
  label: string;
  subLabel: string;
  value: number;
  qty: number;
  txCount: number;
  dateRef?: string;
}

interface TimeframeTrendChartProps {
  data: TrendItem[];
  mode: TimeframeMode;
  onModeChange: (mode: TimeframeMode) => void;
  selectedMonth?: string;
  filters?: DashboardFilters;
  totalFilteredRecords?: number;
}

export const TimeframeTrendChart: React.FC<TimeframeTrendChartProps> = ({
  data,
  mode,
  onModeChange,
  selectedMonth,
  filters,
  totalFilteredRecords,
}) => {
  const [metricType, setMetricType] = useState<'value' | 'qty'>('value');
  const [isForecastEnabled, setIsForecastEnabled] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [editVersion, setEditVersion] = useState<number>(0);

  // Rincian table controls
  const [tableSearch, setTableSearch] = useState<string>('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editQty, setEditQty] = useState<number>(0);
  const [editTxCount, setEditTxCount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');

  // Add custom period row inline form
  const [isAddingPeriod, setIsAddingPeriod] = useState<boolean>(false);
  const [newPeriodLabel, setNewPeriodLabel] = useState<string>('');
  const [newPeriodSubLabel, setNewPeriodSubLabel] = useState<string>('');
  const [newPeriodValue, setNewPeriodValue] = useState<number>(0);
  const [newPeriodQty, setNewPeriodQty] = useState<number>(0);
  const [newPeriodTx, setNewPeriodTx] = useState<number>(1);
  const [newPeriodNotes, setNewPeriodNotes] = useState<string>('');
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  // Reset inline UI states whenever mode or filters change
  useEffect(() => {
    setEditingKey(null);
    setIsAddingPeriod(false);
    setConfirmClearAll(false);
  }, [mode, filters]);

  // Active integrated filter label for clear context
  const activeFilterSummary = useMemo(() => {
    if (!filters) return 'Semua Data Google Sheet';
    const tags: string[] = [];
    if (filters.TAHUN !== 'ALL') tags.push(`Tahun: ${filters.TAHUN}`);
    if (filters.BULAN !== 'ALL') tags.push(`Bulan: ${filters.BULAN}`);
    if (filters.SPV !== 'ALL') tags.push(`SPV: ${filters.SPV}`);
    if (filters.SALES !== 'ALL') tags.push(`Sales: ${filters.SALES}`);
    if (filters.TRAINER && filters.TRAINER !== 'ALL') tags.push(`Trainer: ${filters.TRAINER}`);
    if (filters.BRAND !== 'ALL') tags.push(`Brand: ${filters.BRAND}`);
    if (filters.KATEGORI && filters.KATEGORI !== 'ALL') tags.push(`Kategori: ${filters.KATEGORI}`);
    if (filters.NAMA_STORE !== 'ALL') tags.push(`Toko: ${filters.NAMA_STORE}`);
    if (filters.REGION !== 'ALL') tags.push(`Region: ${filters.REGION}`);
    if (filters.KET !== 'ALL') tags.push(`Ket: ${filters.KET}`);
    if (filters.SKU !== 'ALL') tags.push(`SKU: ${filters.SKU}`);
    if (filters.searchQuery.trim()) tags.push(`Cari: "${filters.searchQuery.trim()}"`);
    return tags.length > 0 ? tags.join(' • ') : 'Semua Data Google Sheet';
  }, [filters]);

  // Load scoped manual edits from localStorage
  const scopedEdits = useMemo<Record<string, TimeframeRowEdit>>(() => {
    return loadTimeframeScopeEdits(mode, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filters, editVersion]);

  const getPeriodKey = (item: TrendItem, idx: number) =>
    item.dateRef || item.subLabel || item.label || `row-${idx}`;

  // Merge Google Sheet aggregated items + scoped manual overrides / added rows
  const effectiveData = useMemo(() => {
    const usedKeys = new Set<string>();
    const merged = data.map((item, idx) => {
      const pKey = getPeriodKey(item, idx);
      usedKeys.add(pKey);
      const override = scopedEdits[pKey];
      if (override) {
        return {
          ...item,
          periodKey: pKey,
          value: override.value,
          qty: override.qty,
          txCount: override.txCount,
          notes: override.notes || '',
          isEdited: true,
          isAddedManual: false,
          origValue: item.value,
          origQty: item.qty,
          origTxCount: item.txCount,
        };
      }
      return {
        ...item,
        periodKey: pKey,
        notes: '',
        isEdited: false,
        isAddedManual: false,
        origValue: item.value,
        origQty: item.qty,
        origTxCount: item.txCount,
      };
    });

    // Include manually added periods for this scope
    Object.values(scopedEdits).forEach((ed) => {
      if (ed.isAddedManual && !usedKeys.has(ed.periodKey)) {
        merged.push({
          label: ed.label || ed.periodKey,
          subLabel: ed.subLabel || 'Input Manual',
          dateRef: ed.periodKey,
          periodKey: ed.periodKey,
          value: ed.value,
          qty: ed.qty,
          txCount: ed.txCount,
          notes: ed.notes || '',
          isEdited: true,
          isAddedManual: true,
          origValue: 0,
          origQty: 0,
          origTxCount: 0,
        });
      }
    });

    return merged;
  }, [data, scopedEdits]);

  const editedCount = useMemo(
    () => effectiveData.filter((d) => d.isEdited).length,
    [effectiveData]
  );

  // Compute linear regression forecasting when enabled
  const forecastAnalysis = useMemo(() => {
    return generateForecast(effectiveData, mode, 3);
  }, [effectiveData, mode]);

  // Choose between pure historical/effective or combined forecast points
  const displayItems = useMemo<ForecastTrendItem[]>(() => {
    if (isForecastEnabled && forecastAnalysis.combinedItems.length > 0) {
      return forecastAnalysis.combinedItems;
    }
    return effectiveData.map((d) => ({ ...d, isForecast: false }));
  }, [isForecastEnabled, forecastAnalysis, effectiveData]);

  // Compute period-over-period growth for every display bar
  const itemsWithGrowth = useMemo(() => {
    return displayItems.map((item, idx) => {
      const val = metricType === 'value' ? item.value : item.qty;
      let prevVal = 0;
      let delta = 0;
      let growthPct = 0;
      let hasGrowth = false;

      if (idx > 0) {
        const prevItem = displayItems[idx - 1];
        prevVal = metricType === 'value' ? prevItem.value : prevItem.qty;
        delta = val - prevVal;
        growthPct = prevVal !== 0 ? (delta / Math.abs(prevVal)) * 100 : 0;
        hasGrowth = true;
      }

      return {
        ...item,
        currentMetricVal: val,
        prevMetricVal: prevVal,
        delta,
        growthPct,
        hasGrowth,
      };
    });
  }, [displayItems, metricType]);

  // Overall timeframe growth momentum summary
  const timeframeGrowthSummary = useMemo(() => {
    if (mode === 'bulanan' && selectedMonth && selectedMonth !== 'ALL' && effectiveData.length > 1) {
      const normMonth = selectedMonth.toUpperCase().trim();
      const targetIdx = effectiveData.findIndex(
        (d) =>
          d.subLabel.toUpperCase() === normMonth ||
          d.label.toUpperCase() === normMonth.slice(0, 3) ||
          d.subLabel.toUpperCase().includes(normMonth)
      );

      if (targetIdx !== -1) {
        const currentItem = effectiveData[targetIdx];
        const prevItem = targetIdx > 0 ? effectiveData[targetIdx - 1] : null;
        const curVal = metricType === 'value' ? currentItem.value : currentItem.qty;
        const prevVal = prevItem ? (metricType === 'value' ? prevItem.value : prevItem.qty) : 0;
        const totalDelta = curVal - prevVal;
        const totalGrowthPct = prevVal !== 0 ? (totalDelta / Math.abs(prevVal)) * 100 : curVal > 0 ? 100 : 0;

        return {
          totalGrowthPct,
          totalDelta,
          avgGrowthPct: totalGrowthPct,
          bestPeriod: {
            label: currentItem.label,
            pct: totalGrowthPct,
          },
          targetMonthLabel: currentItem.subLabel,
          prevMonthLabel: prevItem ? prevItem.subLabel : 'Bulan Sebelumnya',
          curVal,
          prevVal,
          isSpecificMonth: true,
        };
      }
    }

    if (effectiveData.length < 2) {
      return {
        totalGrowthPct: 0,
        totalDelta: 0,
        avgGrowthPct: 0,
        bestPeriod: null,
        isSpecificMonth: false,
      };
    }
    const firstVal = metricType === 'value' ? effectiveData[0].value : effectiveData[0].qty;
    const lastVal =
      metricType === 'value'
        ? effectiveData[effectiveData.length - 1].value
        : effectiveData[effectiveData.length - 1].qty;
    const totalDelta = lastVal - firstVal;
    const totalGrowthPct = firstVal !== 0 ? (totalDelta / Math.abs(firstVal)) * 100 : 0;

    let highestGrowth = -Infinity;
    let bestPeriodLabel = '';
    let sumGrowthPct = 0;
    let countGrowth = 0;

    for (let i = 1; i < effectiveData.length; i++) {
      const v = metricType === 'value' ? effectiveData[i].value : effectiveData[i].qty;
      const prevV = metricType === 'value' ? effectiveData[i - 1].value : effectiveData[i - 1].qty;
      if (prevV > 0) {
        const pct = ((v - prevV) / prevV) * 100;
        sumGrowthPct += pct;
        countGrowth++;
        if (pct > highestGrowth) {
          highestGrowth = pct;
          bestPeriodLabel = effectiveData[i].label;
        }
      }
    }

    return {
      totalGrowthPct,
      totalDelta,
      avgGrowthPct: countGrowth > 0 ? sumGrowthPct / countGrowth : 0,
      bestPeriod: bestPeriodLabel ? { label: bestPeriodLabel, pct: highestGrowth } : null,
      isSpecificMonth: false,
    };
  }, [effectiveData, metricType, mode, selectedMonth]);

  const values = displayItems.map((d) => (metricType === 'value' ? d.value : d.qty));
  const maxValue = Math.max(...values, 1);
  const totalValue = effectiveData.reduce((acc, d) => acc + (metricType === 'value' ? d.value : d.qty), 0);
  const avgValue = effectiveData.length > 0 ? totalValue / effectiveData.length : 0;

  const totalIdrAll = effectiveData.reduce((acc, d) => acc + d.value, 0);
  const totalQtyAll = effectiveData.reduce((acc, d) => acc + d.qty, 0);
  const totalTxAll = effectiveData.reduce((acc, d) => acc + d.txCount, 0);

  // Peak index strictly among effectiveData
  let peakIndex = 0;
  let peakVal = -Infinity;
  effectiveData.forEach((d, idx) => {
    const val = metricType === 'value' ? d.value : d.qty;
    if (val > peakVal) {
      peakVal = val;
      peakIndex = idx;
    }
  });
  if (peakVal === -Infinity) peakVal = 0;

  const timeframes: { id: TimeframeMode; label: string; desc: string }[] = [
    { id: 'harian', label: 'Harian', desc: 'Per Hari' },
    { id: 'mingguan', label: 'Mingguan', desc: 'Per Minggu' },
    { id: 'bulanan', label: 'Bulanan', desc: 'Per Bulan' },
    { id: 'tahunan', label: 'Tahunan', desc: 'Per Tahun' },
  ];

  const activeTimeframeLabel = timeframes.find((t) => t.id === mode)?.label || 'Bulanan';
  const activeRegression =
    metricType === 'value' ? forecastAnalysis.regressionValue : forecastAnalysis.regressionQty;
  const isPacePositive = activeRegression.slope >= 0;

  // Rincian Table Rows with growth & share %
  const tableRows = useMemo(() => {
    const base = effectiveData.map((row, idx) => {
      const prev = idx > 0 ? effectiveData[idx - 1] : null;
      const growthDelta = prev ? row.value - prev.value : null;
      const growthPct = prev && prev.value !== 0 ? ((row.value - prev.value) / Math.abs(prev.value)) * 100 : null;
      const sharePercent = totalIdrAll !== 0 ? (row.value / totalIdrAll) * 100 : 0;
      return {
        ...row,
        index: idx + 1,
        growthDelta,
        growthPct,
        sharePercent,
      };
    });

    if (!tableSearch.trim()) return base;
    const q = tableSearch.trim().toLowerCase();
    return base.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.subLabel.toLowerCase().includes(q) ||
        (r.dateRef && r.dateRef.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    );
  }, [effectiveData, totalIdrAll, tableSearch]);

  // Handlers for inline row edit
  const startRowEdit = (row: (typeof tableRows)[number]) => {
    setEditingKey(row.periodKey);
    setEditValue(row.value);
    setEditQty(row.qty);
    setEditTxCount(row.txCount);
    setEditNotes(row.notes || '');
  };

  const handleSaveRowEdit = (row: (typeof tableRows)[number]) => {
    saveTimeframeRowEdit(mode, filters, {
      periodKey: row.periodKey,
      label: row.label,
      subLabel: row.subLabel,
      value: editValue,
      qty: editQty,
      txCount: editTxCount,
      notes: editNotes,
      isAddedManual: row.isAddedManual,
    });
    setEditingKey(null);
    setEditVersion((v) => v + 1);
  };

  const handleResetSingleRow = (periodKey: string) => {
    removeTimeframeRowEdit(mode, filters, periodKey);
    if (editingKey === periodKey) setEditingKey(null);
    setEditVersion((v) => v + 1);
  };

  const handleClearScopeEdits = () => {
    clearTimeframeScopeEdits(mode, filters);
    setEditingKey(null);
    setConfirmClearAll(false);
    setEditVersion((v) => v + 1);
  };

  const handleAddManualPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newPeriodLabel.trim();
    if (!label) return;
    const key = `manual-${Date.now()}-${label.toLowerCase().replace(/\s+/g, '_')}`;
    saveTimeframeRowEdit(mode, filters, {
      periodKey: key,
      label,
      subLabel: newPeriodSubLabel.trim() || `${activeTimeframeLabel} Manual`,
      value: newPeriodValue,
      qty: newPeriodQty,
      txCount: newPeriodTx,
      notes: newPeriodNotes,
      isAddedManual: true,
    });
    setNewPeriodLabel('');
    setNewPeriodSubLabel('');
    setNewPeriodValue(0);
    setNewPeriodQty(0);
    setNewPeriodTx(1);
    setNewPeriodNotes('');
    setIsAddingPeriod(false);
    setEditVersion((v) => v + 1);
  };

  const handleExportRincian = () => {
    exportTimeframeBreakdownToExcel(
      tableRows.map((r) => ({
        label: r.label,
        subLabel: r.subLabel,
        dateRef: r.dateRef,
        value: r.value,
        qty: r.qty,
        txCount: r.txCount,
        sharePercent: r.sharePercent,
        growthPct: r.growthPct,
        isEdited: r.isEdited,
        notes: r.notes,
      })),
      mode,
      activeFilterSummary
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 mb-6 space-y-5">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Calendar className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Tren Pencapaian {activeTimeframeLabel} &amp; Rincian Data
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sumber: Google Sheet Terhubung
            {typeof totalFilteredRecords === 'number' ? ` (${formatNumber(totalFilteredRecords)} baris)` : ''} •{' '}
            <span className="font-semibold text-slate-700">{activeFilterSummary}</span>
          </p>
        </div>

        {/* Timeframe, Metric, and Forecast Switchers */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg grow sm:grow-0">
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => onModeChange(tf.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 grow sm:grow-0 cursor-pointer ${
                  mode === tf.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setMetricType('value')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                metricType === 'value'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nilai (Rp)
            </button>
            <button
              onClick={() => setMetricType('qty')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                metricType === 'qty'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unit (QTY)
            </button>
          </div>

          <button
            onClick={() => setIsForecastEnabled(!isForecastEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
              isForecastEnabled
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Prediksi tren penjualan masa depan menggunakan algoritma Regresi Linear"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isForecastEnabled ? 'text-amber-300' : 'text-indigo-600'}`} />
            <span>Forecast</span>
            <span className="text-[10px] font-mono opacity-80">
              {isForecastEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Summary Micro-Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200">
          <span className="text-emerald-800 font-semibold block text-[11px] uppercase tracking-wide">
            Total Realisasi ({activeTimeframeLabel}):
          </span>
          <span className="font-extrabold text-emerald-950 font-mono text-base tabular-nums block mt-0.5">
            {metricType === 'value' ? formatRupiah(totalValue) : `${formatNumber(totalValue)} pcs`}
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200">
          <span className="text-blue-800 font-semibold block text-[11px] uppercase tracking-wide">
            Rata-rata per {mode === 'harian' ? 'Hari' : mode === 'mingguan' ? 'Minggu' : mode === 'bulanan' ? 'Bulan' : 'Tahun'}:
          </span>
          <span className="font-extrabold text-blue-950 font-mono text-base tabular-nums block mt-0.5">
            {metricType === 'value' ? formatRupiah(avgValue) : `${formatNumber(avgValue)} pcs`}
          </span>
        </div>
        <div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200">
          <span className="text-amber-800 font-semibold text-[11px] uppercase tracking-wide flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            Puncak Tertinggi:
          </span>
          <span className="font-extrabold text-amber-950 font-mono text-base tabular-nums block mt-0.5">
            {effectiveData[peakIndex]?.label
              ? `${effectiveData[peakIndex].label}: ${
                  metricType === 'value' ? formatRupiah(peakVal) : `${formatNumber(peakVal)} pcs`
                }`
              : '-'}
          </span>
        </div>
      </div>

      {/* Growth Momentum Strip */}
      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-xs block">
              Indikator Growth ({activeTimeframeLabel}
              {timeframeGrowthSummary.isSpecificMonth ? ` - ${timeframeGrowthSummary.targetMonthLabel}` : ''})
            </span>
            <span className="text-slate-600 text-[11px] block mt-0.5 tabular-nums">
              {effectiveData.length < 2 ? (
                'Menampilkan 1 periode sesuai filter terintegrasi'
              ) : (
                <>
                  {timeframeGrowthSummary.isSpecificMonth
                    ? `Pertumbuhan MoM (${timeframeGrowthSummary.targetMonthLabel} vs ${timeframeGrowthSummary.prevMonthLabel}): `
                    : 'Pertumbuhan periode awal ke akhir: '}
                  <strong className={timeframeGrowthSummary.totalDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {timeframeGrowthSummary.totalDelta >= 0 ? '▲ +' : '▼ '}
                    {timeframeGrowthSummary.totalGrowthPct.toFixed(1)}% (
                    {metricType === 'value'
                      ? formatRupiah(timeframeGrowthSummary.totalDelta)
                      : `${formatNumber(timeframeGrowthSummary.totalDelta)} pcs`}
                    )
                  </strong>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-700 tabular-nums">
          <span>
            Laju Rata-rata:{' '}
            <strong>
              {timeframeGrowthSummary.avgGrowthPct >= 0 ? '+' : ''}
              {timeframeGrowthSummary.avgGrowthPct.toFixed(1)}%
            </strong>
          </span>
          {timeframeGrowthSummary.bestPeriod && !timeframeGrowthSummary.isSpecificMonth && (
            <span>
              Lompatan Tertinggi:{' '}
              <strong className="text-emerald-700">
                {timeframeGrowthSummary.bestPeriod.label} (+{timeframeGrowthSummary.bestPeriod.pct.toFixed(1)}%)
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Special Forecast Intelligence Panel */}
      {isForecastEnabled && (
        <div className="p-4 rounded-lg bg-indigo-50/60 border border-indigo-200 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2.5 border-b border-indigo-200/70">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <LineChart className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-indigo-950 text-xs block">
                  Proyeksi Tren Regresi Linear (Linear Regression OLS)
                </span>
                <p className="text-[11px] text-indigo-800">
                  Memproyeksikan {forecastAnalysis.projectedPeriodsCount} periode ke depan dari data filter aktif
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-900 tabular-nums">
              R²: {forecastAnalysis.confidenceScorePercent}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div className="p-2.5 rounded-lg bg-white border border-indigo-100">
              <span className="text-indigo-800 block text-[11px]">Slope Tren:</span>
              <span
                className={`font-mono font-bold text-xs flex items-center gap-1 tabular-nums mt-0.5 ${
                  isPacePositive ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isPacePositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {metricType === 'value'
                  ? `${isPacePositive ? '+' : ''}${formatRupiah(activeRegression.slope)}`
                  : `${isPacePositive ? '+' : ''}${formatNumber(activeRegression.slope)} pcs`}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-indigo-100">
              <span className="text-indigo-800 block text-[11px]">Estimasi Periode Berikutnya:</span>
              <span className="font-mono font-bold text-indigo-950 text-xs tabular-nums mt-0.5 block">
                {metricType === 'value'
                  ? formatRupiah(forecastAnalysis.nextPeriodValue)
                  : `${formatNumber(forecastAnalysis.nextPeriodQty)} pcs`}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-indigo-100">
              <span className="text-indigo-800 block text-[11px]">
                Total {forecastAnalysis.projectedPeriodsCount} Periode Depan:
              </span>
              <span className="font-mono font-bold text-indigo-950 text-xs tabular-nums mt-0.5 block">
                {metricType === 'value'
                  ? formatRupiah(forecastAnalysis.totalProjectedValue)
                  : `${formatNumber(forecastAnalysis.totalProjectedQty)} pcs`}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-indigo-100">
              <span className="text-indigo-800 block text-[11px]">Arah Proyeksi:</span>
              <span className="font-bold text-indigo-950 text-xs mt-0.5 block">
                {activeRegression.trendDirection === 'up'
                  ? 'Tren Meningkat'
                  : activeRegression.trendDirection === 'down'
                  ? 'Tren Menurun'
                  : 'Tren Stabil'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Bar Visualizer */}
      {displayItems.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          Tidak ada data transaksi Google Sheet untuk kombinasi filter saat ini. Anda dapat mengubah filter di atas atau menambah baris manual di tabel rincian di bawah.
        </div>
      ) : (
        <div className="relative pt-6">
          {hoveredIndex !== null && itemsWithGrowth[hoveredIndex] && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs z-20 pointer-events-none border border-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100">
                  {itemsWithGrowth[hoveredIndex].subLabel || itemsWithGrowth[hoveredIndex].label}
                </span>
                {itemsWithGrowth[hoveredIndex].isForecast && (
                  <span className="text-[10px] font-bold text-indigo-300">FORECAST</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 tabular-nums">
                <span className="text-emerald-400 font-mono font-extrabold text-sm">
                  {formatRupiah(itemsWithGrowth[hoveredIndex].value)}
                </span>
                <span className="text-slate-300 font-mono text-[11px]">
                  · {formatNumber(itemsWithGrowth[hoveredIndex].qty)} pcs ({itemsWithGrowth[hoveredIndex].txCount} transaksi)
                </span>
              </div>
              {itemsWithGrowth[hoveredIndex].hasGrowth && (
                <div className="mt-1 pt-1 border-t border-slate-700 flex items-center gap-1.5 text-[11px] font-mono tabular-nums">
                  <span className="text-slate-400">Growth vs Sebelumnya:</span>
                  <span
                    className={`font-bold ${
                      itemsWithGrowth[hoveredIndex].delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {itemsWithGrowth[hoveredIndex].delta >= 0 ? '+' : ''}
                    {itemsWithGrowth[hoveredIndex].growthPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-1.5 sm:gap-2 h-64 w-full pt-10 pb-2 overflow-x-auto">
            {itemsWithGrowth.map((item, idx) => {
              const val = item.currentMetricVal;
              const heightPercent = maxValue > 0 ? Math.max(4, (Math.max(0, val) / maxValue) * 100) : 4;
              const isPeak = !item.isForecast && idx === peakIndex;
              const isAboveAvg = !item.isForecast && val >= avgValue;
              const isHovered = idx === hoveredIndex;
              const isForecastBar = Boolean(item.isForecast);

              return (
                <div
                  key={`${item.label}-${idx}`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="flex-1 min-w-[38px] max-w-[68px] flex flex-col items-center h-full justify-end group cursor-pointer"
                >
                  <div className="mb-1 flex flex-col items-center">
                    {item.hasGrowth ? (
                      <span
                        className={`text-[9px] font-mono font-bold tabular-nums leading-none ${
                          item.isForecast
                            ? 'text-indigo-700'
                            : item.delta >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {item.delta >= 0 ? '+' : ''}
                        {item.growthPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-400 leading-none">Base</span>
                    )}

                    {(isPeak || isHovered || isForecastBar || itemsWithGrowth.length <= 12) && (
                      <span
                        className={`text-[10px] font-mono font-bold tabular-nums mt-0.5 truncate max-w-full ${
                          isForecastBar ? 'text-indigo-700' : isPeak ? 'text-emerald-700' : 'text-slate-700'
                        }`}
                      >
                        {metricType === 'value' ? formatRupiah(val, true) : formatNumber(val)}
                      </span>
                    )}
                  </div>

                  <div className="w-full relative flex items-end justify-center h-full">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-200 ${
                        isForecastBar
                          ? 'bg-indigo-500 border border-dashed border-indigo-300'
                          : isPeak
                          ? 'bg-emerald-600'
                          : isAboveAvg
                          ? 'bg-sky-600'
                          : 'bg-slate-300 group-hover:bg-slate-400'
                      }`}
                    />
                  </div>

                  <div className="mt-2 text-center w-full">
                    <span
                      className={`block text-[11px] truncate font-bold ${
                        isForecastBar
                          ? 'text-indigo-700'
                          : isPeak
                          ? 'text-emerald-800'
                          : isAboveAvg
                          ? 'text-sky-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-4 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                Puncak Tertinggi ({effectiveData[peakIndex]?.label || '-'})
              </span>
              <span className="flex items-center gap-1.5 text-sky-800">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
                Di Atas Rata-rata
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
                Periode Lainnya
              </span>
            </div>
            <span className="font-mono text-slate-600 font-semibold text-xs tabular-nums">
              {effectiveData.length} Periode {editedCount > 0 ? `(${editedCount} diedit manual)` : ''}
            </span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TABEL RINCIAN HARIAN / MINGGUAN / BULANAN / TAHUNAN (BISA DIEDIT)     */}
      {/* ==================================================================== */}
      <div className="pt-4 border-t border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <span>Rincian Data {activeTimeframeLabel} (Sesuai Filter Terintegrasi)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik tombol <strong>Edit</strong> pada baris mana pun untuk mengubah Nilai (Rp), QTY, Transaksi, atau Catatan. Perubahan langsung memperbarui grafik &amp; ringkasan di atas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={`Cari periode ${activeTimeframeLabel.toLowerCase()}...`}
                className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsAddingPeriod((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Periode</span>
            </button>

            <button
              onClick={handleExportRincian}
              disabled={tableRows.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {editedCount > 0 && !confirmClearAll && (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Editan ({editedCount})</span>
              </button>
            )}

            {confirmClearAll && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs">
                <span className="font-semibold text-rose-800">Kembalikan ke Sheet?</span>
                <button
                  onClick={handleClearScopeEdits}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Ya
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Add Period Form */}
        {isAddingPeriod && (
          <form
            onSubmit={handleAddManualPeriod}
            className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/40 grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs items-end"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Periode ({activeTimeframeLabel}) *</label>
              <input
                type="text"
                required
                placeholder={mode === 'harian' ? 'e.g. 26 Okt' : mode === 'mingguan' ? 'e.g. Mgg 44' : mode === 'bulanan' ? 'e.g. NOV' : 'e.g. 2027'}
                value={newPeriodLabel}
                onChange={(e) => setNewPeriodLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Keterangan</label>
              <input
                type="text"
                placeholder="Detail tanggal / bulan"
                value={newPeriodSubLabel}
                onChange={(e) => setNewPeriodSubLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nilai (Rp)</label>
              <input
                type="number"
                value={newPeriodValue}
                onChange={(e) => setNewPeriodValue(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit (QTY)</label>
              <input
                type="number"
                value={newPeriodQty}
                onChange={(e) => setNewPeriodQty(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transaksi &amp; Catatan</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={newPeriodTx}
                  onChange={(e) => setNewPeriodTx(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 px-2 py-1.5 rounded border border-slate-300 bg-white font-mono tabular-nums"
                  title="Jumlah transaksi"
                />
                <input
                  type="text"
                  placeholder="Catatan"
                  value={newPeriodNotes}
                  onChange={(e) => setNewPeriodNotes(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setIsAddingPeriod(false)}
                className="px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-2.5 px-3 w-10">No</th>
                <th className="py-2.5 px-3">Periode ({activeTimeframeLabel})</th>
                <th className="py-2.5 px-3">Detail</th>
                <th className="py-2.5 px-3 text-right">Nilai Penjualan (Rp)</th>
                <th className="py-2.5 px-3 text-right">Unit (QTY)</th>
                <th className="py-2.5 px-3 text-right">Transaksi</th>
                <th className="py-2.5 px-3 text-right">Share (%)</th>
                <th className="py-2.5 px-3 text-right">Growth</th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-center">Sumber</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Tidak ada rincian periode untuk filter atau pencarian ini.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const isEditing = editingKey === row.periodKey;
                  return (
                    <tr
                      key={row.periodKey}
                      className={isEditing ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70 transition-colors'}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums">{row.index}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{row.label}</td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{row.subLabel || '-'}</td>

                      {/* Nilai */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(Number(e.target.value) || 0)}
                            className="w-32 px-2 py-1 text-right text-xs font-mono font-bold border border-indigo-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="font-bold text-slate-900">{formatRupiah(row.value)}</span>
                        )}
                      </td>

                      {/* QTY */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-right text-xs font-mono font-bold border border-indigo-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-slate-700">{formatNumber(row.qty)} pcs</span>
                        )}
                      </td>

                      {/* Transaksi */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editTxCount}
                            onChange={(e) => setEditTxCount(Math.max(0, Number(e.target.value) || 0))}
                            className="w-16 px-2 py-1 text-right text-xs font-mono font-bold border border-indigo-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-slate-600">{formatNumber(row.txCount)}</span>
                        )}
                      </td>

                      {/* Share % */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {row.sharePercent.toFixed(1)}%
                      </td>

                      {/* Growth */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {row.growthPct === null ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              row.growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {row.growthPct >= 0 ? '+' : ''}
                            {row.growthPct.toFixed(1)}%
                          </span>
                        )}
                      </td>

                      {/* Catatan */}
                      <td className="py-2.5 px-3 text-slate-600 max-w-[160px]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Catatan..."
                            className="w-full px-2 py-1 text-xs border border-indigo-400 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="block truncate" title={row.notes || '-'}>
                            {row.notes || '-'}
                          </span>
                        )}
                      </td>

                      {/* Sumber */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            row.isEdited ? 'text-indigo-700' : 'text-emerald-700'
                          }`}
                        >
                          {row.isEdited ? 'Edit Manual' : 'Google Sheet'}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveRowEdit(row)}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              title="Simpan perubahan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startRowEdit(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-semibold cursor-pointer"
                              title={`Edit rincian ${row.label}`}
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            {row.isEdited && (
                              <button
                                onClick={() => handleResetSingleRow(row.periodKey)}
                                className="p-1 rounded hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer"
                                title={row.isAddedManual ? 'Hapus baris manual' : 'Kembalikan ke data Google Sheet'}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <td colSpan={3} className="py-3 px-3 uppercase tracking-wider">
                    Total Akumulasi ({tableRows.length} Periode)
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {formatRupiah(totalIdrAll)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {formatNumber(totalQtyAll)} pcs
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {formatNumber(totalTxAll)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">100.0%</td>
                  <td colSpan={4} className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums">
                    Rata-rata: {formatRupiah(effectiveData.length > 0 ? totalIdrAll / effectiveData.length : 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
