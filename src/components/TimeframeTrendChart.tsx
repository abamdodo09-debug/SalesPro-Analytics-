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
  Target,
  ExternalLink,
} from 'lucide-react';
import { DashboardFilters, TimeframeMode } from '../types/dashboard';
import { formatRupiah, formatNumber } from '../utils/analytics';
import { generateForecast, ForecastTrendItem } from '../utils/forecasting';
import {
  SpvMonthTargetEntry,
  normalizeMonthKey,
} from '../services/targetManagementService';
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
  theme?: 'light' | 'dark';
  spvTargetByMonth?: Record<string, SpvMonthTargetEntry>;
  spvScopeLabel?: string;
  targetMode?: 'spv' | 'sales' | 'store';
  targetEntityLabel?: string;
  onOpenTargetMgmt?: () => void;
}

export const TimeframeTrendChart: React.FC<TimeframeTrendChartProps> = React.memo(({
  data,
  mode,
  onModeChange,
  selectedMonth,
  filters,
  totalFilteredRecords,
  theme = 'light',
  spvTargetByMonth,
  spvScopeLabel,
  targetMode = 'spv',
  targetEntityLabel,
  onOpenTargetMgmt,
}) => {
  const isDark = theme === 'dark';
  const showSpvTargetColumns =
    Boolean(spvTargetByMonth) && (mode === 'bulanan' || mode === 'tahunan');
  const isKetSellOutOnly = (filters?.KET || '').trim().toUpperCase() === 'SELL OUT';
  const spvMetricModeLabel = isKetSellOutOnly ? 'Sell Out' : 'Sell In';
  const resolvedTargetEntity = useMemo(() => {
    if (targetEntityLabel) return targetEntityLabel;
    if (filters?.NAMA_STORE && filters.NAMA_STORE !== 'ALL') return filters.NAMA_STORE;
    if (filters?.SALES && filters.SALES !== 'ALL') return filters.SALES;
    return 'ALL';
  }, [targetEntityLabel, filters?.NAMA_STORE, filters?.SALES]);
  const fullTargetColumnLabel = `Target ${resolvedTargetEntity} (${spvMetricModeLabel})`;
  const shortEntityDisplay =
    resolvedTargetEntity.length > 16
      ? `${resolvedTargetEntity.slice(0, 15)}…`
      : resolvedTargetEntity;
  const compactTargetHeaderLabel = `Target ${shortEntityDisplay} (${spvMetricModeLabel})`;
  const targetModeBadgeSuffix =
    targetMode === 'store'
      ? 'Target Toko'
      : targetMode === 'sales'
      ? 'Target Sales'
      : 'Target SPV';
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

  const resolveRowSpvTarget = useMemo(() => {
    return (item: Pick<TrendItem, 'label' | 'subLabel' | 'dateRef'>): number | undefined => {
      if (!spvTargetByMonth || (mode !== 'bulanan' && mode !== 'tahunan')) return undefined;
      let entry: SpvMonthTargetEntry | undefined;
      if (mode === 'tahunan') {
        entry = spvTargetByMonth['YEARLY_TOTAL'];
      } else {
        const candidates = [item.dateRef, item.subLabel, item.label];
        for (const c of candidates) {
          if (!c) continue;
          const up = c.trim().toUpperCase();
          if (spvTargetByMonth[up]) {
            entry = spvTargetByMonth[up];
            break;
          }
          const normKey = normalizeMonthKey(c);
          if (normKey !== 'ALL' && spvTargetByMonth[normKey]) {
            entry = spvTargetByMonth[normKey];
            break;
          }
        }
      }
      if (!entry) return undefined;
      return isKetSellOutOnly ? entry.targetSellOut : entry.targetSellIn;
    };
  }, [spvTargetByMonth, mode, isKetSellOutOnly]);

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

      const spvTarget = !item.isForecast ? resolveRowSpvTarget(item) : undefined;
      const spvAchvPct =
        spvTarget !== undefined && spvTarget > 0 ? (item.value / spvTarget) * 100 : null;

      return {
        ...item,
        currentMetricVal: val,
        prevMetricVal: prevVal,
        delta,
        growthPct,
        hasGrowth,
        spvTarget,
        spvAchvPct,
      };
    });
  }, [displayItems, metricType, resolveRowSpvTarget]);

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

  // Rincian Table Rows with growth, share % & Target SPV
  const tableRows = useMemo(() => {
    const base = effectiveData.map((row, idx) => {
      const prev = idx > 0 ? effectiveData[idx - 1] : null;
      const growthDelta = prev ? row.value - prev.value : null;
      const growthPct = prev && prev.value !== 0 ? ((row.value - prev.value) / Math.abs(prev.value)) * 100 : null;
      const sharePercent = totalIdrAll !== 0 ? (row.value / totalIdrAll) * 100 : 0;
      const spvTarget = resolveRowSpvTarget(row);
      const spvAchvPct =
        spvTarget !== undefined && spvTarget > 0 ? (row.value / spvTarget) * 100 : null;
      const spvGap = spvTarget !== undefined ? row.value - spvTarget : null;
      return {
        ...row,
        index: idx + 1,
        growthDelta,
        growthPct,
        sharePercent,
        spvTarget,
        spvAchvPct,
        spvGap,
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
  }, [effectiveData, totalIdrAll, tableSearch, resolveRowSpvTarget]);

  const tableTotals = useMemo(() => {
    const sumVal = tableRows.reduce((s, r) => s + r.value, 0);
    const sumQty = tableRows.reduce((s, r) => s + r.qty, 0);
    const sumTx = tableRows.reduce((s, r) => s + r.txCount, 0);
    const sumSpvTarget = tableRows.reduce((s, r) => s + (r.spvTarget || 0), 0);
    const achvSpvPct = sumSpvTarget > 0 ? (sumVal / sumSpvTarget) * 100 : null;
    const spvGap = sumSpvTarget > 0 ? sumVal - sumSpvTarget : null;
    return {
      sumVal,
      sumQty,
      sumTx,
      sumSpvTarget,
      achvSpvPct,
      spvGap,
    };
  }, [tableRows]);

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
        spvTarget: showSpvTargetColumns ? r.spvTarget : undefined,
        spvAchvPct: showSpvTargetColumns ? r.spvAchvPct : undefined,
        qty: r.qty,
        txCount: r.txCount,
        sharePercent: r.sharePercent,
        growthPct: r.growthPct,
        isEdited: r.isEdited,
        notes: r.notes,
      })),
      mode,
      activeFilterSummary,
      fullTargetColumnLabel
    );
  };

  return (
    <div
      className={
        isDark
          ? 'bg-[#121926] rounded-xl border border-[#1F293B] shadow-lg p-4 sm:p-5 space-y-5 text-slate-100'
          : 'bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 mb-6 space-y-5'
      }
    >
      {/* Chart Header & Controls */}
      <div
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b ${
          isDark ? 'border-[#1E293B]' : 'border-slate-100'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                isDark
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </div>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Tren Pencapaian {activeTimeframeLabel} &amp; Rincian Data
            </h2>
          </div>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sumber: Google Sheet Terhubung
            {typeof totalFilteredRecords === 'number' ? ` (${formatNumber(totalFilteredRecords)} baris)` : ''} •{' '}
            <span className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-slate-700'}`}>
              {activeFilterSummary}
            </span>
          </p>
        </div>

        {/* Timeframe, Metric, and Forecast Switchers */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div
            className={`flex items-center gap-1 p-1 rounded-lg grow sm:grow-0 ${
              isDark ? 'bg-[#0B101A] border border-[#243147]' : 'bg-slate-100'
            }`}
          >
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => onModeChange(tf.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 grow sm:grow-0 cursor-pointer ${
                  mode === tf.id
                    ? isDark
                      ? 'bg-[#FF6B00] text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div
            className={`flex items-center gap-1 p-1 rounded-lg ${
              isDark ? 'bg-[#0B101A] border border-[#243147]' : 'bg-slate-100'
            }`}
          >
            <button
              onClick={() => setMetricType('value')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                metricType === 'value'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
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
                  : isDark
                  ? 'text-slate-400 hover:text-white'
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
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                : isDark
                ? 'bg-[#0B101A] text-slate-200 border-[#2A3952] hover:bg-[#172135]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Prediksi tren penjualan masa depan menggunakan algoritma Regresi Linear"
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isForecastEnabled ? 'text-amber-300' : isDark ? 'text-indigo-400' : 'text-indigo-600'
              }`}
            />
            <span>Forecast</span>
            <span className="text-[10px] font-mono opacity-80">
              {isForecastEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Summary Micro-Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div
          className={`p-3.5 rounded-lg border ${
            isDark
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-emerald-50/50 border-emerald-200'
          }`}
        >
          <span
            className={`font-semibold block text-[11px] uppercase tracking-wide ${
              isDark ? 'text-emerald-300' : 'text-emerald-800'
            }`}
          >
            Total Realisasi ({activeTimeframeLabel}):
          </span>
          <span
            className={`font-extrabold font-mono text-base tabular-nums block mt-0.5 ${
              isDark ? 'text-white' : 'text-emerald-950'
            }`}
          >
            {metricType === 'value' ? formatRupiah(totalValue) : `${formatNumber(totalValue)} pcs`}
          </span>
          {showSpvTargetColumns && tableTotals.sumSpvTarget > 0 && metricType === 'value' && (
            <span
              className={`block mt-1 text-[11px] font-mono tabular-nums ${
                isDark ? 'text-amber-300' : 'text-emerald-800'
              }`}
              title={fullTargetColumnLabel}
            >
              {fullTargetColumnLabel}: <strong>{formatRupiah(tableTotals.sumSpvTarget)}</strong>{' '}
              ({tableTotals.achvSpvPct !== null ? `${tableTotals.achvSpvPct.toFixed(1)}%` : '-'})
            </span>
          )}
        </div>
        <div
          className={`p-3.5 rounded-lg border ${
            isDark
              ? 'bg-cyan-500/10 border-cyan-500/30'
              : 'bg-blue-50/50 border-blue-200'
          }`}
        >
          <span
            className={`font-semibold block text-[11px] uppercase tracking-wide ${
              isDark ? 'text-cyan-300' : 'text-blue-800'
            }`}
          >
            Rata-rata per {mode === 'harian' ? 'Hari' : mode === 'mingguan' ? 'Minggu' : mode === 'bulanan' ? 'Bulan' : 'Tahun'}:
          </span>
          <span
            className={`font-extrabold font-mono text-base tabular-nums block mt-0.5 ${
              isDark ? 'text-white' : 'text-blue-950'
            }`}
          >
            {metricType === 'value' ? formatRupiah(avgValue) : `${formatNumber(avgValue)} pcs`}
          </span>
        </div>
        <div
          className={`p-3.5 rounded-lg border ${
            isDark
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-50/50 border-amber-200'
          }`}
        >
          <span
            className={`font-semibold text-[11px] uppercase tracking-wide flex items-center gap-1 ${
              isDark ? 'text-amber-300' : 'text-amber-800'
            }`}
          >
            <Award className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            Puncak Tertinggi:
          </span>
          <span
            className={`font-extrabold font-mono text-base tabular-nums block mt-0.5 ${
              isDark ? 'text-white' : 'text-amber-950'
            }`}
          >
            {effectiveData[peakIndex]?.label
              ? `${effectiveData[peakIndex].label}: ${
                  metricType === 'value' ? formatRupiah(peakVal) : `${formatNumber(peakVal)} pcs`
                }`
              : '-'}
          </span>
        </div>
      </div>

      {/* Growth Momentum Strip */}
      <div
        className={`p-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-[#0B101A] border-[#1F293B]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Indikator Growth ({activeTimeframeLabel}
              {timeframeGrowthSummary.isSpecificMonth ? ` - ${timeframeGrowthSummary.targetMonthLabel}` : ''})
            </span>
            <span className={`text-[11px] block mt-0.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {effectiveData.length < 2 ? (
                'Menampilkan 1 periode sesuai filter terintegrasi'
              ) : (
                <>
                  {timeframeGrowthSummary.isSpecificMonth
                    ? `Pertumbuhan MoM (${timeframeGrowthSummary.targetMonthLabel} vs ${timeframeGrowthSummary.prevMonthLabel}): `
                    : 'Pertumbuhan periode awal ke akhir: '}
                  <strong
                    className={
                      timeframeGrowthSummary.totalDelta >= 0
                        ? isDark
                          ? 'text-emerald-400'
                          : 'text-emerald-700'
                        : isDark
                        ? 'text-rose-400'
                        : 'text-rose-700'
                    }
                  >
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

        <div
          className={`flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          <span>
            Laju Rata-rata:{' '}
            <strong className={isDark ? 'text-white' : ''}>
              {timeframeGrowthSummary.avgGrowthPct >= 0 ? '+' : ''}
              {timeframeGrowthSummary.avgGrowthPct.toFixed(1)}%
            </strong>
          </span>
          {timeframeGrowthSummary.bestPeriod && !timeframeGrowthSummary.isSpecificMonth && (
            <span>
              Lompatan Tertinggi:{' '}
              <strong className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
                {timeframeGrowthSummary.bestPeriod.label} (+{timeframeGrowthSummary.bestPeriod.pct.toFixed(1)}%)
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Special Forecast Intelligence Panel */}
      {isForecastEnabled && (
        <div
          className={`p-4 rounded-lg border text-xs ${
            isDark
              ? 'bg-indigo-500/10 border-indigo-500/30'
              : 'bg-indigo-50/60 border-indigo-200'
          }`}
        >
          <div
            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2.5 border-b ${
              isDark ? 'border-indigo-500/30' : 'border-indigo-200/70'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <LineChart className="w-4 h-4" />
              </div>
              <div>
                <span className={`font-bold text-xs block ${isDark ? 'text-indigo-200' : 'text-indigo-950'}`}>
                  Proyeksi Tren Regresi Linear (Linear Regression OLS)
                </span>
                <p className={`text-[11px] ${isDark ? 'text-indigo-300/80' : 'text-indigo-800'}`}>
                  Memproyeksikan {forecastAnalysis.projectedPeriodsCount} periode ke depan dari data filter aktif
                </p>
              </div>
            </div>
            <span className={`font-mono text-xs font-bold tabular-nums ${isDark ? 'text-indigo-200' : 'text-indigo-900'}`}>
              R²: {forecastAnalysis.confidenceScorePercent}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div
              className={`p-2.5 rounded-lg border ${
                isDark ? 'bg-[#0B101A] border-[#243147]' : 'bg-white border-indigo-100'
              }`}
            >
              <span className={`block text-[11px] ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Slope Tren:</span>
              <span
                className={`font-mono font-bold text-xs flex items-center gap-1 tabular-nums mt-0.5 ${
                  isPacePositive
                    ? isDark
                      ? 'text-emerald-400'
                      : 'text-emerald-700'
                    : isDark
                    ? 'text-rose-400'
                    : 'text-rose-700'
                }`}
              >
                {isPacePositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {metricType === 'value'
                  ? `${isPacePositive ? '+' : ''}${formatRupiah(activeRegression.slope)}`
                  : `${isPacePositive ? '+' : ''}${formatNumber(activeRegression.slope)} pcs`}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-lg border ${
                isDark ? 'bg-[#0B101A] border-[#243147]' : 'bg-white border-indigo-100'
              }`}
            >
              <span className={`block text-[11px] ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                Estimasi Periode Berikutnya:
              </span>
              <span className={`font-mono font-bold text-xs tabular-nums mt-0.5 block ${isDark ? 'text-white' : 'text-indigo-950'}`}>
                {metricType === 'value'
                  ? formatRupiah(forecastAnalysis.nextPeriodValue)
                  : `${formatNumber(forecastAnalysis.nextPeriodQty)} pcs`}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-lg border ${
                isDark ? 'bg-[#0B101A] border-[#243147]' : 'bg-white border-indigo-100'
              }`}
            >
              <span className={`block text-[11px] ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                Total {forecastAnalysis.projectedPeriodsCount} Periode Depan:
              </span>
              <span className={`font-mono font-bold text-xs tabular-nums mt-0.5 block ${isDark ? 'text-white' : 'text-indigo-950'}`}>
                {metricType === 'value'
                  ? formatRupiah(forecastAnalysis.totalProjectedValue)
                  : `${formatNumber(forecastAnalysis.totalProjectedQty)} pcs`}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-lg border ${
                isDark ? 'bg-[#0B101A] border-[#243147]' : 'bg-white border-indigo-100'
              }`}
            >
              <span className={`block text-[11px] ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Arah Proyeksi:</span>
              <span className={`font-bold text-xs mt-0.5 block ${isDark ? 'text-white' : 'text-indigo-950'}`}>
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
        <div
          className={`py-12 text-center text-xs border border-dashed rounded-lg ${
            isDark
              ? 'text-slate-400 border-[#243147] bg-[#0B101A]/60'
              : 'text-slate-500 border-slate-200 bg-slate-50/50'
          }`}
        >
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
              {itemsWithGrowth[hoveredIndex].spvTarget !== undefined && (
                <div className="mt-1 pt-1 border-t border-slate-700 flex items-center gap-2 text-[11px] font-mono tabular-nums">
                  <span className="text-amber-300">
                    {fullTargetColumnLabel}: {formatRupiah(itemsWithGrowth[hoveredIndex].spvTarget || 0)}
                  </span>
                  {itemsWithGrowth[hoveredIndex].spvAchvPct !== null && (
                    <span
                      className={`font-bold ${
                        (itemsWithGrowth[hoveredIndex].spvAchvPct || 0) >= 100
                          ? 'text-emerald-400'
                          : (itemsWithGrowth[hoveredIndex].spvAchvPct || 0) >= 80
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      · Achv {(itemsWithGrowth[hoveredIndex].spvAchvPct || 0).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
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
                            ? isDark
                              ? 'text-indigo-400'
                              : 'text-indigo-700'
                            : item.delta >= 0
                            ? isDark
                              ? 'text-emerald-400'
                              : 'text-emerald-700'
                            : isDark
                            ? 'text-rose-400'
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
                          isForecastBar
                            ? isDark
                              ? 'text-indigo-300'
                              : 'text-indigo-700'
                            : isPeak
                            ? isDark
                              ? 'text-emerald-400'
                              : 'text-emerald-700'
                            : isDark
                            ? 'text-slate-300'
                            : 'text-slate-700'
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
                          ? 'bg-emerald-500'
                          : isAboveAvg
                          ? 'bg-sky-500'
                          : isDark
                          ? 'bg-[#2A3952] group-hover:bg-[#3A4F70]'
                          : 'bg-slate-300 group-hover:bg-slate-400'
                      }`}
                    />
                  </div>

                  <div className="mt-2 text-center w-full">
                    <span
                      className={`block text-[11px] truncate font-bold ${
                        isForecastBar
                          ? isDark
                            ? 'text-indigo-300'
                            : 'text-indigo-700'
                          : isPeak
                          ? isDark
                            ? 'text-emerald-400'
                            : 'text-emerald-800'
                          : isAboveAvg
                          ? isDark
                            ? 'text-cyan-300'
                            : 'text-sky-900'
                          : isDark
                          ? 'text-slate-400'
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

          <div
            className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
              isDark ? 'border-[#1E293B] text-slate-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <div className="flex flex-wrap items-center gap-4 font-medium">
              <span
                className={`flex items-center gap-1.5 font-semibold ${
                  isDark ? 'text-emerald-400' : 'text-emerald-800'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                Puncak Tertinggi ({effectiveData[peakIndex]?.label || '-'})
              </span>
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-cyan-300' : 'text-sky-800'}`}>
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                Di Atas Rata-rata
              </span>
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <span
                  className={`w-2.5 h-2.5 rounded-xs inline-block ${
                    isDark ? 'bg-[#2A3952]' : 'bg-slate-300'
                  }`}
                />
                Periode Lainnya
              </span>
            </div>
            <span
              className={`font-mono font-semibold text-xs tabular-nums ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {effectiveData.length} Periode {editedCount > 0 ? `(${editedCount} diedit manual)` : ''}
            </span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TABEL RINCIAN HARIAN / MINGGUAN / BULANAN / TAHUNAN (BISA DIEDIT)     */}
      {/* ==================================================================== */}
      <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-[#1E293B]' : 'border-slate-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-sm font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                <TableIcon className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span>Rincian Data {activeTimeframeLabel} (Sesuai Filter Terintegrasi)</span>
              </h3>
              {showSpvTargetColumns && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                    isDark
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  <span>
                    {spvScopeLabel || fullTargetColumnLabel} · {spvMetricModeLabel} — Kelola Target
                  </span>
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Klik tombol <strong>Edit</strong> pada baris mana pun untuk mengubah Nilai (Rp), QTY, Transaksi, atau Catatan.
              {showSpvTargetColumns
                ? ` Kolom ${fullTargetColumnLabel} otomatis tersinkron dengan pengaturan Kelola Target.`
                : ' Perubahan langsung memperbarui grafik & ringkasan di atas.'}
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
                className={`pl-8 pr-7 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 ${
                  isDark
                    ? 'border-[#243147] bg-[#0B101A] text-white placeholder-slate-500'
                    : 'border-slate-200 bg-slate-50 focus:bg-white text-slate-900'
                }`}
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsAddingPeriod((v) => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                isDark
                  ? 'border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300'
                  : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Periode</span>
            </button>

            <button
              onClick={handleExportRincian}
              disabled={tableRows.length === 0}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border disabled:opacity-50 cursor-pointer ${
                isDark
                  ? 'border-[#2A3952] bg-[#192234] hover:bg-[#233049] text-slate-200'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span>Export Excel</span>
            </button>

            {showSpvTargetColumns && onOpenTargetMgmt && (
              <button
                type="button"
                onClick={onOpenTargetMgmt}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                  isDark
                    ? 'border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300'
                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Atur {targetModeBadgeSuffix}</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </button>
            )}

            {editedCount > 0 && !confirmClearAll && (
              <button
                onClick={() => setConfirmClearAll(true)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                  isDark
                    ? 'border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300'
                    : 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Editan ({editedCount})</span>
              </button>
            )}

            {confirmClearAll && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                  isDark ? 'bg-rose-500/15 border-rose-500/40' : 'bg-rose-50 border-rose-200'
                }`}
              >
                <span className={`font-semibold ${isDark ? 'text-rose-300' : 'text-rose-800'}`}>
                  Kembalikan ke Sheet?
                </span>
                <button
                  onClick={handleClearScopeEdits}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Ya
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer ${
                    isDark
                      ? 'bg-[#0B101A] border-[#243147] text-slate-200'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
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
            className={`p-3.5 rounded-lg border grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs items-end ${
              isDark
                ? 'border-indigo-500/35 bg-indigo-500/10'
                : 'border-indigo-200 bg-indigo-50/40'
            }`}
          >
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Periode ({activeTimeframeLabel}) *
              </label>
              <input
                type="text"
                required
                placeholder={mode === 'harian' ? 'e.g. 26 Okt' : mode === 'mingguan' ? 'e.g. Mgg 44' : mode === 'bulanan' ? 'e.g. NOV' : 'e.g. 2027'}
                value={newPeriodLabel}
                onChange={(e) => setNewPeriodLabel(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'border-[#2A3952] bg-[#0B101A] text-white' : 'border-slate-300 bg-white'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Keterangan
              </label>
              <input
                type="text"
                placeholder="Detail tanggal / bulan"
                value={newPeriodSubLabel}
                onChange={(e) => setNewPeriodSubLabel(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'border-[#2A3952] bg-[#0B101A] text-white' : 'border-slate-300 bg-white'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Nilai (Rp)
              </label>
              <input
                type="number"
                value={newPeriodValue}
                onChange={(e) => setNewPeriodValue(Number(e.target.value) || 0)}
                className={`w-full px-2.5 py-1.5 rounded border font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'border-[#2A3952] bg-[#0B101A] text-white' : 'border-slate-300 bg-white'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Unit (QTY)
              </label>
              <input
                type="number"
                value={newPeriodQty}
                onChange={(e) => setNewPeriodQty(Number(e.target.value) || 0)}
                className={`w-full px-2.5 py-1.5 rounded border font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'border-[#2A3952] bg-[#0B101A] text-white' : 'border-slate-300 bg-white'
                }`}
              />
            </div>
            <div>
              <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Transaksi &amp; Catatan
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={newPeriodTx}
                  onChange={(e) => setNewPeriodTx(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-16 px-2 py-1.5 rounded border font-mono tabular-nums ${
                    isDark ? 'border-[#2A3952] bg-[#0B101A] text-white' : 'border-slate-300 bg-white'
                  }`}
                  title="Jumlah transaksi"
                />
                <input
                  type="text"
                  placeholder="Catatan"
                  value={newPeriodNotes}
                  onChange={(e) => setNewPeriodNotes(e.target.value)}
                  className={`w-full px-2 py-1.5 rounded border ${
                    isDark ? 'border-[#2A3952] bg-[#0B101A] text-white' : 'border-slate-300 bg-white'
                  }`}
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
                className={`px-2.5 py-1.5 rounded border font-semibold cursor-pointer ${
                  isDark
                    ? 'bg-[#0B101A] border-[#243147] text-slate-300'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {/* Data Table — Streamlined One-Screen Width Layout */}
        <div
          className={`overflow-x-auto border rounded-lg ${
            isDark ? 'border-[#1F293B]' : 'border-slate-200'
          }`}
        >
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr
                className={`border-b font-bold ${
                  isDark
                    ? 'bg-[#0B101A] border-[#1E293B] text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <th className="py-2 px-1.5 w-7 text-center">No</th>
                <th className="py-2 px-2">Periode</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">Realisasi (Rp)</th>
                {showSpvTargetColumns && (
                  <>
                    <th
                      className={`py-2 px-2 text-right leading-tight ${
                        isDark ? 'text-amber-300' : 'text-amber-800'
                      }`}
                      title={fullTargetColumnLabel}
                    >
                      <span className="block whitespace-nowrap">{compactTargetHeaderLabel}</span>
                    </th>
                    <th
                      className={`py-2 px-2 text-right leading-tight whitespace-nowrap ${
                        isDark ? 'text-cyan-300' : 'text-cyan-800'
                      }`}
                    >
                      Achv
                    </th>
                  </>
                )}
                <th className="py-2 px-2 text-right whitespace-nowrap">QTY / Trx</th>
                <th className="py-2 px-1.5 text-right whitespace-nowrap">Share</th>
                <th className="py-2 px-1.5 text-right whitespace-nowrap">Growth</th>
                <th className="py-2 px-2">Catatan</th>
                <th className="py-2 px-1.5 text-center whitespace-nowrap">Sumber &amp; Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1A2334]' : 'divide-slate-100'}`}>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={showSpvTargetColumns ? 10 : 8} className="py-8 text-center text-slate-400">
                    Tidak ada rincian periode untuk filter atau pencarian ini.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const isEditing = editingKey === row.periodKey;
                  const hasDistinctSubLabel =
                    Boolean(row.subLabel) &&
                    row.subLabel.trim().toUpperCase() !== row.label.trim().toUpperCase();
                  return (
                    <tr
                      key={row.periodKey}
                      className={
                        isEditing
                          ? isDark
                            ? 'bg-indigo-500/15'
                            : 'bg-indigo-50/40'
                          : isDark
                          ? 'hover:bg-[#172033] transition-colors'
                          : 'hover:bg-slate-50/70 transition-colors'
                      }
                    >
                      <td className="py-2 px-1.5 text-center font-mono text-slate-400 tabular-nums">
                        {row.index}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {row.label}
                          </span>
                          {hasDistinctSubLabel && (
                            <span
                              className={`text-[10px] ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              {row.subLabel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Realisasi Nilai */}
                      <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(Number(e.target.value) || 0)}
                            className={`w-28 px-1.5 py-1 text-right text-[11px] font-mono font-bold border border-indigo-400 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              isDark ? 'bg-[#0B101A] text-white' : 'bg-white'
                            }`}
                          />
                        ) : (
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {formatRupiah(row.value)}
                          </span>
                        )}
                      </td>

                      {/* Target & Achv % (dari Kelola Target) */}
                      {showSpvTargetColumns && (
                        <>
                          <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                            {row.spvTarget !== undefined ? (
                              <span className={`font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                                {formatRupiah(row.spvTarget)}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                            {row.spvAchvPct !== null && row.spvAchvPct !== undefined ? (
                              <div className="flex flex-col items-end leading-tight">
                                <span
                                  className={`font-extrabold ${
                                    row.spvAchvPct >= 100
                                      ? isDark
                                        ? 'text-emerald-400'
                                        : 'text-emerald-700'
                                      : row.spvAchvPct >= 80
                                      ? isDark
                                        ? 'text-amber-400'
                                        : 'text-amber-700'
                                      : isDark
                                      ? 'text-rose-400'
                                      : 'text-rose-700'
                                  }`}
                                >
                                  {row.spvAchvPct.toFixed(1)}%
                                </span>
                                {row.spvGap !== null && (
                                  <span
                                    className={`text-[9.5px] ${
                                      row.spvGap >= 0
                                        ? isDark
                                          ? 'text-emerald-400/80'
                                          : 'text-emerald-600'
                                        : isDark
                                        ? 'text-rose-400/80'
                                        : 'text-rose-600'
                                    }`}
                                  >
                                    {row.spvGap >= 0 ? '+' : ''}
                                    {formatRupiah(row.spvGap, true)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* QTY / Trx combined compactly */}
                      <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                              title="Unit (QTY)"
                              className={`w-16 px-1.5 py-1 text-right text-[11px] font-mono font-bold border border-indigo-400 rounded focus:outline-none ${
                                isDark ? 'bg-[#0B101A] text-white' : 'bg-white'
                              }`}
                            />
                            <input
                              type="number"
                              min={0}
                              value={editTxCount}
                              onChange={(e) => setEditTxCount(Math.max(0, Number(e.target.value) || 0))}
                              title="Jumlah Transaksi"
                              className={`w-12 px-1.5 py-1 text-right text-[11px] font-mono font-bold border border-indigo-400 rounded focus:outline-none ${
                                isDark ? 'bg-[#0B101A] text-white' : 'bg-white'
                              }`}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-end leading-tight">
                            <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                              {formatNumber(row.qty)} pcs
                            </span>
                            <span className="text-[9.5px] text-slate-400">
                              {formatNumber(row.txCount)} trx
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Share % */}
                      <td
                        className={`py-2 px-1.5 text-right font-mono tabular-nums whitespace-nowrap ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        {row.sharePercent.toFixed(1)}%
                      </td>

                      {/* Growth */}
                      <td className="py-2 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {row.growthPct === null ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              row.growthPct >= 0
                                ? isDark
                                  ? 'text-emerald-400'
                                  : 'text-emerald-700'
                                : isDark
                                ? 'text-rose-400'
                                : 'text-rose-700'
                            }`}
                          >
                            {row.growthPct >= 0 ? '+' : ''}
                            {row.growthPct.toFixed(1)}%
                          </span>
                        )}
                      </td>

                      {/* Catatan */}
                      <td className={`py-2 px-2 max-w-[95px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Catatan..."
                            className={`w-full px-1.5 py-1 text-[11px] border border-indigo-400 rounded focus:outline-none ${
                              isDark ? 'bg-[#0B101A] text-white' : 'bg-white'
                            }`}
                          />
                        ) : (
                          <span className="block truncate" title={row.notes || '-'}>
                            {row.notes || '-'}
                          </span>
                        )}
                      </td>

                      {/* Sumber & Aksi compact */}
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
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
                              className={`p-1 rounded cursor-pointer ${
                                isDark
                                  ? 'bg-[#243147] hover:bg-[#31415E] text-slate-200'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`text-[9.5px] font-semibold px-1 py-0.5 rounded ${
                                row.isEdited
                                  ? isDark
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'bg-indigo-50 text-indigo-700'
                                  : isDark
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                              title={row.isEdited ? 'Edit Manual' : 'Google Sheet'}
                            >
                              {row.isEdited ? 'Edit' : 'Sheet'}
                            </span>
                            <button
                              onClick={() => startRowEdit(row)}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                isDark
                                  ? 'bg-[#192234] hover:bg-[#233049] text-slate-200 border-[#2A3952]'
                                  : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200'
                              }`}
                              title={`Edit rincian ${row.label}`}
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                            {row.isEdited && (
                              <button
                                onClick={() => handleResetSingleRow(row.periodKey)}
                                className={`p-0.5 rounded border cursor-pointer ${
                                  isDark
                                    ? 'hover:bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : 'hover:bg-rose-50 text-rose-600 border-rose-200'
                                }`}
                                title={row.isAddedManual ? 'Hapus baris manual' : 'Kembalikan ke data Google Sheet'}
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
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
                <tr
                  className={`border-t-2 font-bold text-[11px] ${
                    isDark
                      ? 'bg-[#0E1523] border-[#243147] text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-900'
                  }`}
                >
                  <td colSpan={2} className="py-2.5 px-2 uppercase tracking-wider whitespace-nowrap">
                    Total ({tableRows.length} Periode)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                    {formatRupiah(tableTotals.sumVal)}
                  </td>
                  {showSpvTargetColumns && (
                    <>
                      <td
                        className={`py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap ${
                          isDark ? 'text-amber-300' : 'text-amber-800'
                        }`}
                      >
                        {tableTotals.sumSpvTarget > 0 ? formatRupiah(tableTotals.sumSpvTarget) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        {tableTotals.achvSpvPct !== null ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span
                              className={
                                tableTotals.achvSpvPct >= 100
                                  ? isDark
                                    ? 'text-emerald-400'
                                    : 'text-emerald-700'
                                  : tableTotals.achvSpvPct >= 80
                                  ? isDark
                                    ? 'text-amber-400'
                                    : 'text-amber-700'
                                  : isDark
                                  ? 'text-rose-400'
                                  : 'text-rose-700'
                              }
                            >
                              {tableTotals.achvSpvPct.toFixed(1)}%
                            </span>
                            {tableTotals.spvGap !== null && (
                              <span
                                className={`text-[9.5px] ${
                                  tableTotals.spvGap >= 0
                                    ? isDark
                                      ? 'text-emerald-400/80'
                                      : 'text-emerald-600'
                                    : isDark
                                    ? 'text-rose-400/80'
                                    : 'text-rose-600'
                                }`}
                              >
                                {tableTotals.spvGap >= 0 ? '+' : ''}
                                {formatRupiah(tableTotals.spvGap, true)}
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                    <div className="flex flex-col items-end leading-tight">
                      <span>{formatNumber(tableTotals.sumQty)} pcs</span>
                      <span className="text-[9.5px] text-slate-400">
                        {formatNumber(tableTotals.sumTx)} trx
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                    100.0%
                  </td>
                  <td
                    colSpan={3}
                    className={`py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap ${
                      isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    Avg: {formatRupiah(tableRows.length > 0 ? tableTotals.sumVal / tableRows.length : 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
});
