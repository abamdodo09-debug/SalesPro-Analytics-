import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PackageCheck,
  Receipt,
  ShoppingCart,
  RotateCcw,
  Target,
  Edit3,
  X,
  Save,
} from 'lucide-react';
import { MetricSummary, GrowthMetric } from '../types/dashboard';
import { formatRupiah, formatNumber, formatPercent } from '../utils/analytics';

const STORAGE_KEY_EXECUTIVE_KPI_OVERRIDES = 'salespro_executive_kpi_overrides_v1';

export type KpiCardKey =
  | 'revenue'
  | 'qty'
  | 'transactions'
  | 'aov'
  | 'return'
  | 'target';

export interface KpiCardOverride {
  totalRevenue?: number;
  growthPercent?: number;
  comparisonLabel?: string;
  totalQty?: number;
  growthQtyPercent?: number;
  totalTransactions?: number;
  activityBadge?: string;
  averageOrderValue?: number;
  totalReturnRevenue?: number;
  returnRatePercent?: number;
  targetTotal?: number;
  achievementPercent?: number;
}

type ScopedKpiOverridesMap = Record<string, KpiCardOverride>;

function loadScopedKpiOverrides(): ScopedKpiOverridesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXECUTIVE_KPI_OVERRIDES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveScopedKpiOverrides(map: ScopedKpiOverridesMap): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXECUTIVE_KPI_OVERRIDES, JSON.stringify(map));
  } catch (e) {
    console.warn('Gagal menyimpan edit KPI cards:', e);
  }
}

interface KpiCardsProps {
  summary: MetricSummary;
  growth: GrowthMetric;
  comparisonLabel: string;
  targetTotal?: number;
  achievementPercent?: number;
  scopeKey?: string;
  scopeLabel?: string;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  summary,
  growth,
  comparisonLabel,
  targetTotal,
  achievementPercent,
  scopeKey = 'DEFAULT',
  scopeLabel = 'Filter Aktif',
}) => {
  const [overridesMap, setOverridesMap] = useState<ScopedKpiOverridesMap>(() => loadScopedKpiOverrides());
  const [editingCard, setEditingCard] = useState<KpiCardKey | null>(null);

  useEffect(() => {
    const onStorage = () => setOverridesMap(loadScopedKpiOverrides());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const baseTarget = targetTotal !== undefined && targetTotal > 0 ? targetTotal : summary.totalRevenue * 1.08;
  const baseAchievement =
    achievementPercent !== undefined
      ? achievementPercent
      : baseTarget > 0
      ? (summary.totalRevenue / baseTarget) * 100
      : 92.4;

  const activeOverride = overridesMap[scopeKey] || {};

  // Effective values combining base sheet metrics with manual overrides & smart derived calculations
  const effective = useMemo(() => {
    const ov = activeOverride;
    const totalRevenue = ov.totalRevenue !== undefined ? ov.totalRevenue : summary.totalRevenue;
    const growthPercent = ov.growthPercent !== undefined ? ov.growthPercent : growth.growthPercent;
    const compLabel = ov.comparisonLabel !== undefined ? ov.comparisonLabel : comparisonLabel;
    const totalQty = ov.totalQty !== undefined ? ov.totalQty : summary.totalQty;
    const growthQtyPercent = ov.growthQtyPercent !== undefined ? ov.growthQtyPercent : growth.growthQtyPercent;
    const totalTransactions = ov.totalTransactions !== undefined ? ov.totalTransactions : summary.totalTransactions;
    const activityBadge = ov.activityBadge !== undefined ? ov.activityBadge : '100% Aktif';

    const autoAov = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const averageOrderValue =
      ov.averageOrderValue !== undefined
        ? ov.averageOrderValue
        : ov.totalRevenue !== undefined || ov.totalTransactions !== undefined
        ? autoAov
        : summary.averageOrderValue;

    const totalReturnRevenue =
      ov.totalReturnRevenue !== undefined ? ov.totalReturnRevenue : summary.totalReturnRevenue;
    const grossEst = totalRevenue + totalReturnRevenue;
    const autoReturnRate = grossEst > 0 ? (totalReturnRevenue / grossEst) * 100 : 0;
    const returnRatePercent =
      ov.returnRatePercent !== undefined
        ? ov.returnRatePercent
        : ov.totalReturnRevenue !== undefined || ov.totalRevenue !== undefined
        ? autoReturnRate
        : summary.returnRatePercent;

    const resolvedTarget = ov.targetTotal !== undefined ? ov.targetTotal : baseTarget;
    const autoAchievement = resolvedTarget > 0 ? (totalRevenue / resolvedTarget) * 100 : 0;
    const resolvedAchievement =
      ov.achievementPercent !== undefined
        ? ov.achievementPercent
        : ov.targetTotal !== undefined || ov.totalRevenue !== undefined
        ? autoAchievement
        : baseAchievement;

    return {
      totalRevenue,
      growthPercent,
      comparisonLabel: compLabel,
      totalQty,
      growthQtyPercent,
      totalTransactions,
      activityBadge,
      averageOrderValue,
      totalReturnRevenue,
      returnRatePercent,
      resolvedTarget,
      resolvedAchievement,
    };
  }, [activeOverride, summary, growth, comparisonLabel, baseTarget, baseAchievement]);

  const hasAnyOverride = Object.keys(activeOverride).length > 0;
  const isCardEdited = {
    revenue:
      activeOverride.totalRevenue !== undefined ||
      activeOverride.growthPercent !== undefined ||
      activeOverride.comparisonLabel !== undefined,
    qty: activeOverride.totalQty !== undefined || activeOverride.growthQtyPercent !== undefined,
    transactions: activeOverride.totalTransactions !== undefined || activeOverride.activityBadge !== undefined,
    aov: activeOverride.averageOrderValue !== undefined,
    return: activeOverride.totalReturnRevenue !== undefined || activeOverride.returnRatePercent !== undefined,
    target: activeOverride.targetTotal !== undefined || activeOverride.achievementPercent !== undefined,
  };

  // Modal Form States
  const [formRevenue, setFormRevenue] = useState<number>(0);
  const [formGrowthPct, setFormGrowthPct] = useState<number>(0);
  const [formCompLabel, setFormCompLabel] = useState<string>('');
  const [formQty, setFormQty] = useState<number>(0);
  const [formGrowthQtyPct, setFormGrowthQtyPct] = useState<number>(0);
  const [formTransactions, setFormTransactions] = useState<number>(0);
  const [formActivityBadge, setFormActivityBadge] = useState<string>('100% Aktif');
  const [formAov, setFormAov] = useState<number>(0);
  const [formAovManual, setFormAovManual] = useState<boolean>(false);
  const [formReturnRevenue, setFormReturnRevenue] = useState<number>(0);
  const [formReturnRatePct, setFormReturnRatePct] = useState<number>(0);
  const [formReturnRateManual, setFormReturnRateManual] = useState<boolean>(false);
  const [formTargetTotal, setFormTargetTotal] = useState<number>(0);
  const [formAchievementPct, setFormAchievementPct] = useState<number>(0);
  const [formAchievementManual, setFormAchievementManual] = useState<boolean>(false);

  const openEditModal = (focusCard: KpiCardKey) => {
    setFormRevenue(effective.totalRevenue);
    setFormGrowthPct(Number(effective.growthPercent.toFixed(2)));
    setFormCompLabel(effective.comparisonLabel);
    setFormQty(effective.totalQty);
    setFormGrowthQtyPct(Number(effective.growthQtyPercent.toFixed(2)));
    setFormTransactions(effective.totalTransactions);
    setFormActivityBadge(effective.activityBadge);
    setFormAov(Math.round(effective.averageOrderValue));
    setFormAovManual(activeOverride.averageOrderValue !== undefined);
    setFormReturnRevenue(effective.totalReturnRevenue);
    setFormReturnRatePct(Number(effective.returnRatePercent.toFixed(2)));
    setFormReturnRateManual(activeOverride.returnRatePercent !== undefined);
    setFormTargetTotal(effective.resolvedTarget);
    setFormAchievementPct(Number(effective.resolvedAchievement.toFixed(2)));
    setFormAchievementManual(activeOverride.achievementPercent !== undefined);
    setEditingCard(focusCard);
  };

  // Live auto-recalculation in modal when auto mode is active
  const liveAov = useMemo(() => {
    if (formAovManual) return formAov;
    return formTransactions > 0 ? formRevenue / formTransactions : 0;
  }, [formAovManual, formAov, formRevenue, formTransactions]);

  const liveReturnRatePct = useMemo(() => {
    if (formReturnRateManual) return formReturnRatePct;
    const gross = formRevenue + formReturnRevenue;
    return gross > 0 ? (formReturnRevenue / gross) * 100 : 0;
  }, [formReturnRateManual, formReturnRatePct, formRevenue, formReturnRevenue]);

  const liveAchievementPct = useMemo(() => {
    if (formAchievementManual) return formAchievementPct;
    return formTargetTotal > 0 ? (formRevenue / formTargetTotal) * 100 : 0;
  }, [formAchievementManual, formAchievementPct, formRevenue, formTargetTotal]);

  const updateScopeOverride = (nextOv: KpiCardOverride) => {
    setOverridesMap((prev) => {
      const next = { ...prev };
      // Strip undefined keys
      const cleaned: KpiCardOverride = {};
      (Object.keys(nextOv) as (keyof KpiCardOverride)[]).forEach((k) => {
        if (nextOv[k] !== undefined) {
          (cleaned as Record<string, unknown>)[k] = nextOv[k];
        }
      });
      if (Object.keys(cleaned).length === 0) {
        delete next[scopeKey];
      } else {
        next[scopeKey] = cleaned;
      }
      saveScopedKpiOverrides(next);
      return next;
    });
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const nextOv: KpiCardOverride = { ...activeOverride };

    if (formRevenue !== summary.totalRevenue) nextOv.totalRevenue = formRevenue;
    else delete nextOv.totalRevenue;

    if (Math.abs(formGrowthPct - Number(growth.growthPercent.toFixed(2))) > 0.001) nextOv.growthPercent = formGrowthPct;
    else delete nextOv.growthPercent;

    if (formCompLabel.trim() !== comparisonLabel) nextOv.comparisonLabel = formCompLabel.trim() || comparisonLabel;
    else delete nextOv.comparisonLabel;

    if (formQty !== summary.totalQty) nextOv.totalQty = formQty;
    else delete nextOv.totalQty;

    if (Math.abs(formGrowthQtyPct - Number(growth.growthQtyPercent.toFixed(2))) > 0.001) nextOv.growthQtyPercent = formGrowthQtyPct;
    else delete nextOv.growthQtyPercent;

    if (formTransactions !== summary.totalTransactions) nextOv.totalTransactions = formTransactions;
    else delete nextOv.totalTransactions;

    if (formActivityBadge.trim() !== '100% Aktif') nextOv.activityBadge = formActivityBadge.trim() || '100% Aktif';
    else delete nextOv.activityBadge;

    if (formAovManual) nextOv.averageOrderValue = formAov;
    else delete nextOv.averageOrderValue;

    if (formReturnRevenue !== summary.totalReturnRevenue) nextOv.totalReturnRevenue = formReturnRevenue;
    else delete nextOv.totalReturnRevenue;

    if (formReturnRateManual) nextOv.returnRatePercent = formReturnRatePct;
    else delete nextOv.returnRatePercent;

    if (Math.abs(formTargetTotal - baseTarget) > 0.5) nextOv.targetTotal = formTargetTotal;
    else delete nextOv.targetTotal;

    if (formAchievementManual) nextOv.achievementPercent = formAchievementPct;
    else delete nextOv.achievementPercent;

    updateScopeOverride(nextOv);
    setEditingCard(null);
  };

  const handleResetAllCards = () => {
    updateScopeOverride({});
    setEditingCard(null);
  };

  const handleResetSingleCard = (card: KpiCardKey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextOv: KpiCardOverride = { ...activeOverride };
    if (card === 'revenue') {
      delete nextOv.totalRevenue;
      delete nextOv.growthPercent;
      delete nextOv.comparisonLabel;
    } else if (card === 'qty') {
      delete nextOv.totalQty;
      delete nextOv.growthQtyPercent;
    } else if (card === 'transactions') {
      delete nextOv.totalTransactions;
      delete nextOv.activityBadge;
    } else if (card === 'aov') {
      delete nextOv.averageOrderValue;
    } else if (card === 'return') {
      delete nextOv.totalReturnRevenue;
      delete nextOv.returnRatePercent;
    } else if (card === 'target') {
      delete nextOv.targetTotal;
      delete nextOv.achievementPercent;
    }
    updateScopeOverride(nextOv);
  };

  const isPositiveGrowth = effective.growthPercent >= 0;

  return (
    <div className="mb-6 space-y-2">
      {/* Subtle Edit/Status Toolbar when edits exist or quick edit action */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          {hasAnyOverride && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
              Edit Manual Aktif ({scopeLabel})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasAnyOverride && (
            <button
              type="button"
              onClick={handleResetAllCards}
              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              title="Kembalikan seluruh 6 kartu ringkasan ke data asli Google Sheet"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Kartu ke Data Asli</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openEditModal('revenue')}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            title="Edit manual seluruh kartu ringkasan KPI"
          >
            <Edit3 className="w-3 h-3 text-indigo-600" />
            <span>Edit Ringkasan KPI</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Net Sales Value */}
        <div
          onClick={() => openEditModal('revenue')}
          className="group cursor-pointer bg-gradient-to-b from-white to-emerald-50/60 p-4 rounded-xl border border-emerald-200/90 shadow-sm border-t-4 border-t-emerald-600 flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          title="Klik untuk edit manual Total Penjualan"
        >
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">
                  Total Penjualan
                </span>
                {isCardEdited.revenue && (
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCardEdited.revenue && (
                  <button
                    type="button"
                    onClick={(e) => handleResetSingleCard('revenue', e)}
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="Reset Total Penjualan ke data asli"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal('revenue');
                  }}
                  className="p-1 rounded-md text-emerald-700/70 group-hover:text-emerald-800 hover:bg-emerald-100 cursor-pointer transition-colors"
                  title="Edit Total Penjualan"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 font-mono tabular-nums leading-tight">
              {formatRupiah(effective.totalRevenue, true)}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5 truncate font-medium tabular-nums" title={formatRupiah(effective.totalRevenue)}>
              {formatRupiah(effective.totalRevenue)}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-xs gap-1">
            <span className="text-slate-500 truncate" title={effective.comparisonLabel}>
              vs {effective.comparisonLabel}
            </span>
            <span
              className={`font-mono font-bold flex items-center gap-0.5 px-1.5 py-0.2 rounded tabular-nums shrink-0 ${
                isPositiveGrowth
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isPositiveGrowth ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {formatPercent(effective.growthPercent)}
            </span>
          </div>
        </div>

        {/* 2. Total Kuantitas (QTY) */}
        <div
          onClick={() => openEditModal('qty')}
          className="group cursor-pointer bg-gradient-to-b from-white to-blue-50/60 p-4 rounded-xl border border-blue-200/90 shadow-sm border-t-4 border-t-blue-600 flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          title="Klik untuk edit manual Total Unit (QTY)"
        >
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">
                  Total Unit (QTY)
                </span>
                {isCardEdited.qty && (
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCardEdited.qty && (
                  <button
                    type="button"
                    onClick={(e) => handleResetSingleCard('qty', e)}
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="Reset Total Unit ke data asli"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal('qty');
                  }}
                  className="p-1 rounded-md text-blue-700/70 group-hover:text-blue-800 hover:bg-blue-100 cursor-pointer transition-colors"
                  title="Edit Total Unit (QTY)"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                  <PackageCheck className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-950 font-mono tabular-nums leading-tight">
              {formatNumber(effective.totalQty)}
            </div>
            <div className="text-xs text-blue-700 font-medium mt-0.5">
              Pcs terjual
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Volume</span>
            <span
              className={`font-mono font-bold px-1.5 py-0.2 rounded tabular-nums ${
                effective.growthQtyPercent >= 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {formatPercent(effective.growthQtyPercent)}
            </span>
          </div>
        </div>

        {/* 3. Total Transaksi */}
        <div
          onClick={() => openEditModal('transactions')}
          className="group cursor-pointer bg-gradient-to-b from-white to-purple-50/60 p-4 rounded-xl border border-purple-200/90 shadow-sm border-t-4 border-t-purple-600 flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          title="Klik untuk edit manual Total Transaksi"
        >
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">
                  Total Transaksi
                </span>
                {isCardEdited.transactions && (
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCardEdited.transactions && (
                  <button
                    type="button"
                    onClick={(e) => handleResetSingleCard('transactions', e)}
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="Reset Total Transaksi ke data asli"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal('transactions');
                  }}
                  className="p-1 rounded-md text-purple-700/70 group-hover:text-purple-800 hover:bg-purple-100 cursor-pointer transition-colors"
                  title="Edit Total Transaksi"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <div className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-purple-950 font-mono tabular-nums leading-tight">
              {formatNumber(effective.totalTransactions)}
            </div>
            <div className="text-xs text-purple-700 font-medium mt-0.5">
              Nota order tercatat
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-100 flex items-center justify-between text-xs text-slate-500">
            <span>Keaktifan</span>
            <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
              {effective.activityBadge}
            </span>
          </div>
        </div>

        {/* 4. Rata-rata Nilai Order (AOV) */}
        <div
          onClick={() => openEditModal('aov')}
          className="group cursor-pointer bg-gradient-to-b from-white to-amber-50/60 p-4 rounded-xl border border-amber-200/90 shadow-sm border-t-4 border-t-amber-500 flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          title="Klik untuk edit manual AOV (Rata-rata)"
        >
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">
                  AOV (Rata-rata)
                </span>
                {isCardEdited.aov && (
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCardEdited.aov && (
                  <button
                    type="button"
                    onClick={(e) => handleResetSingleCard('aov', e)}
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="Reset AOV ke hitung otomatis"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal('aov');
                  }}
                  className="p-1 rounded-md text-amber-700/70 group-hover:text-amber-800 hover:bg-amber-100 cursor-pointer transition-colors"
                  title="Edit AOV (Rata-rata)"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-950 font-mono tabular-nums leading-tight">
              {formatRupiah(effective.averageOrderValue, true)}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5 truncate font-medium tabular-nums" title={formatRupiah(effective.averageOrderValue)}>
              {formatRupiah(effective.averageOrderValue)}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-amber-100 flex items-center justify-between text-xs text-slate-500">
            <span>Per transaksi</span>
            <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">Net Nilai</span>
          </div>
        </div>

        {/* 5. Nilai & Rasio Retur */}
        <div
          onClick={() => openEditModal('return')}
          className="group cursor-pointer bg-gradient-to-b from-white to-rose-50/60 p-4 rounded-xl border border-rose-200/90 shadow-sm border-t-4 border-t-rose-600 flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          title="Klik untuk edit manual Nilai Retur"
        >
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 truncate">
                  Nilai Retur
                </span>
                {isCardEdited.return && (
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCardEdited.return && (
                  <button
                    type="button"
                    onClick={(e) => handleResetSingleCard('return', e)}
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="Reset Nilai Retur ke data asli"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal('return');
                  }}
                  className="p-1 rounded-md text-rose-700/70 group-hover:text-rose-800 hover:bg-rose-100 cursor-pointer transition-colors"
                  title="Edit Nilai Retur"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <div className="p-1.5 rounded-lg bg-rose-600 text-white shadow-xs">
                  <RotateCcw className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-600 font-mono tabular-nums leading-tight">
              {formatRupiah(effective.totalReturnRevenue, true)}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5 truncate font-medium tabular-nums" title={formatRupiah(effective.totalReturnRevenue)}>
              {formatRupiah(effective.totalReturnRevenue)}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-rose-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Rasio Retur</span>
            <span
              className={`font-mono font-bold px-1.5 py-0.2 rounded tabular-nums ${
                effective.returnRatePercent > 3 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {formatPercent(effective.returnRatePercent, false)}
            </span>
          </div>
        </div>

        {/* 6. Pencapaian Target */}
        <div
          onClick={() => openEditModal('target')}
          className="group cursor-pointer bg-gradient-to-b from-white to-teal-50/60 p-4 rounded-xl border border-teal-200/90 shadow-sm border-t-4 border-t-teal-600 flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          title="Klik untuk edit manual Target & Pencapaian"
        >
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 truncate">
                  Pencapaian Target
                </span>
                {isCardEdited.target && (
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                    Manual
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCardEdited.target && (
                  <button
                    type="button"
                    onClick={(e) => handleResetSingleCard('target', e)}
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100 cursor-pointer"
                    title="Reset Target & Pencapaian ke data asli"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal('target');
                  }}
                  className="p-1 rounded-md text-teal-700/70 group-hover:text-teal-800 hover:bg-teal-100 cursor-pointer transition-colors"
                  title="Edit Pencapaian Target"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <div className="p-1.5 rounded-lg bg-teal-600 text-white shadow-xs">
                  <Target className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-teal-950 font-mono tabular-nums leading-tight">
              {formatPercent(effective.resolvedAchievement, false)}
            </div>
            <div className="text-xs text-teal-700 font-medium mt-0.5 font-mono tabular-nums" title={formatRupiah(effective.resolvedTarget)}>
              Target: {formatRupiah(effective.resolvedTarget, true)}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-teal-100">
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, effective.resolvedAchievement))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Executive KPI Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  Edit Ringkasan KPI Eksekutif
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Scope Filter: <strong className="text-white">{scopeLabel}</strong> • AOV, Rasio Retur &amp; Pencapaian otomatis terhitung ulang kecuali mode manual diaktifkan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Total Penjualan */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    editingCard === 'revenue'
                      ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-900 uppercase tracking-wide text-[11px]">
                      1. Total Penjualan (Rp)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Asli: {formatRupiah(summary.totalRevenue, true)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nominal Penjualan (Rp)</label>
                    <input
                      type="number"
                      step="any"
                      value={formRevenue}
                      onChange={(e) => setFormRevenue(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block tabular-nums">
                      {formatRupiah(formRevenue)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Pembanding</label>
                      <input
                        type="text"
                        value={formCompLabel}
                        onChange={(e) => setFormCompLabel(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Growth (%)</label>
                      <input
                        type="number"
                        step="any"
                        value={formGrowthPct}
                        onChange={(e) => setFormGrowthPct(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Total Unit (QTY) */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    editingCard === 'qty'
                      ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-blue-900 uppercase tracking-wide text-[11px]">
                      2. Total Unit (QTY)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Asli: {formatNumber(summary.totalQty)} pcs
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Jumlah Unit (Pcs)</label>
                    <input
                      type="number"
                      step="any"
                      value={formQty}
                      onChange={(e) => setFormQty(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Volume Growth (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={formGrowthQtyPct}
                      onChange={(e) => setFormGrowthQtyPct(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 3. Total Transaksi */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    editingCard === 'transactions'
                      ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-purple-900 uppercase tracking-wide text-[11px]">
                      3. Total Transaksi
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Asli: {formatNumber(summary.totalTransactions)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nota Order Tercatat</label>
                    <input
                      type="number"
                      step="any"
                      value={formTransactions}
                      onChange={(e) => setFormTransactions(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Status Keaktifan</label>
                    <input
                      type="text"
                      value={formActivityBadge}
                      onChange={(e) => setFormActivityBadge(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* 4. AOV (Rata-rata) */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    editingCard === 'aov'
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-900 uppercase tracking-wide text-[11px]">
                      4. AOV (Rata-rata)
                    </span>
                    <label className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAovManual}
                        onChange={(e) => {
                          setFormAovManual(e.target.checked);
                          if (e.target.checked) setFormAov(Math.round(liveAov));
                        }}
                        className="rounded border-slate-300 text-amber-600"
                      />
                      <span>Manual</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Nilai Rata-rata Per Transaksi (Rp)
                    </label>
                    <input
                      type="number"
                      step="any"
                      disabled={!formAovManual}
                      value={formAovManual ? formAov : Math.round(liveAov)}
                      onChange={(e) => setFormAov(Number(e.target.value))}
                      className={`w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                        formAovManual
                          ? 'border-amber-400 bg-white text-slate-900'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block tabular-nums">
                      {formAovManual ? 'Mode Manual: ' : 'Otomatis (Penjualan ÷ Transaksi): '}
                      {formatRupiah(liveAov)}
                    </span>
                  </div>
                </div>

                {/* 5. Nilai Retur */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    editingCard === 'return'
                      ? 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-900 uppercase tracking-wide text-[11px]">
                      5. Nilai Retur
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Asli: {formatRupiah(summary.totalReturnRevenue, true)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nominal Retur (Rp)</label>
                    <input
                      type="number"
                      step="any"
                      value={formReturnRevenue}
                      onChange={(e) => setFormReturnRevenue(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block tabular-nums">
                      {formatRupiah(formReturnRevenue)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold">Rasio Retur (%)</label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formReturnRateManual}
                          onChange={(e) => {
                            setFormReturnRateManual(e.target.checked);
                            if (e.target.checked) setFormReturnRatePct(Number(liveReturnRatePct.toFixed(2)));
                          }}
                          className="rounded border-slate-300 text-rose-600"
                        />
                        <span>Manual</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      step="any"
                      disabled={!formReturnRateManual}
                      value={formReturnRateManual ? formReturnRatePct : Number(liveReturnRatePct.toFixed(2))}
                      onChange={(e) => setFormReturnRatePct(Number(e.target.value))}
                      className={`w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-rose-500 ${
                        formReturnRateManual
                          ? 'border-rose-400 bg-white text-slate-900'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    />
                  </div>
                </div>

                {/* 6. Pencapaian Target */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2.5 ${
                    editingCard === 'target'
                      ? 'bg-teal-50/70 border-teal-400 ring-2 ring-teal-200'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-teal-900 uppercase tracking-wide text-[11px]">
                      6. Pencapaian Target
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Target Asli: {formatRupiah(baseTarget, true)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nominal Target (Rp)</label>
                    <input
                      type="number"
                      step="any"
                      value={formTargetTotal}
                      onChange={(e) => setFormTargetTotal(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block tabular-nums">
                      {formatRupiah(formTargetTotal)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold">Persentase Pencapaian (%)</label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAchievementManual}
                          onChange={(e) => {
                            setFormAchievementManual(e.target.checked);
                            if (e.target.checked) setFormAchievementPct(Number(liveAchievementPct.toFixed(2)));
                          }}
                          className="rounded border-slate-300 text-teal-600"
                        />
                        <span>Manual</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      step="any"
                      disabled={!formAchievementManual}
                      value={formAchievementManual ? formAchievementPct : Number(liveAchievementPct.toFixed(2))}
                      onChange={(e) => setFormAchievementPct(Number(e.target.value))}
                      className={`w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-teal-500 ${
                        formAchievementManual
                          ? 'border-teal-400 bg-white text-slate-900'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleResetAllCards}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Semua ke Data Asli</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCard(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

