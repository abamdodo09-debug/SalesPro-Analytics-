import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Users2, MapPin, Edit3, X, Save } from 'lucide-react';
import { TransactionRecord, DashboardFilters } from '../types/dashboard';
import { aggregateByDimension, formatRupiah, formatNumber, formatPercent } from '../utils/analytics';
import {
  loadSpvTargets,
  setSingleTargetOverride,
  DEFAULT_SPV_TARGET,
  TARGETS_UPDATED_EVENT,
  getMonthDisplayLabel,
} from '../services/targetManagementService';
import { loadSpvConsolidatedConfig } from '../services/spvSellInSellOutService';

interface SpvAnalysisProps {
  records: TransactionRecord[];
  filters?: DashboardFilters;
}

export const SpvAnalysis: React.FC<SpvAnalysisProps> = ({ records, filters }) => {
  const activeMonth = filters?.BULAN;
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingSpv, setEditingSpv] = useState<{ name: string; target: number } | null>(null);
  const [editTargetInput, setEditTargetInput] = useState<number>(DEFAULT_SPV_TARGET);

  useEffect(() => {
    const onUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener(TARGETS_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  const spvTargetsMap = useMemo(() => loadSpvTargets(activeMonth), [activeMonth, refreshKey]);
  const spvConsolidated = useMemo(
    () => loadSpvConsolidatedConfig(records, activeMonth || 'OKTOBER', Number(filters?.TAHUN) || 2026),
    [records, activeMonth, filters?.TAHUN, refreshKey]
  );

  const spvData = useMemo(() => {
    const raw = aggregateByDimension(records, 'SPV');
    return raw.map((spv) => {
      const upperName = spv.name.toUpperCase().trim();
      const matchedKey = Object.keys(spvTargetsMap).find((k) => k.toUpperCase().trim() === upperName);
      const customTarget = matchedKey !== undefined ? spvTargetsMap[matchedKey] : undefined;
      const targetVal =
        customTarget !== undefined
          ? customTarget
          : upperName === 'WIDODO'
          ? spvConsolidated.target
          : DEFAULT_SPV_TARGET;
      const achievementPct = targetVal > 0 ? (spv.totalValue / targetVal) * 100 : 0;
      return {
        ...spv,
        target: targetVal,
        achievementPercent: achievementPct,
      };
    });
  }, [records, spvTargetsMap, spvConsolidated]);

  // Compute team members & regions per SPV
  const spvTeamMap: Record<string, { sales: Set<string>; regions: Set<string>; stores: Set<string> }> = {};
  records.forEach((r) => {
    if (!spvTeamMap[r.SPV]) {
      spvTeamMap[r.SPV] = { sales: new Set(), regions: new Set(), stores: new Set() };
    }
    if (r.SALES) spvTeamMap[r.SPV].sales.add(r.SALES);
    if (r.REGION) spvTeamMap[r.SPV].regions.add(r.REGION);
    if (r.NAMA_STORE) spvTeamMap[r.SPV].stores.add(r.NAMA_STORE);
  });

  const handleSaveEditSpv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpv) return;
    setSingleTargetOverride('spv', editingSpv.name, editTargetInput, activeMonth);
    setEditingSpv(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              Analisa Pencapaian SPV (Supervisor)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Konsolidasi performa tim penjualan &amp; target ({getMonthDisplayLabel(activeMonth)}) per Supervisor
          </p>
        </div>
        <div className="text-xs font-mono font-bold text-purple-900 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 shadow-2xs">
          {spvData.length} Supervisor Aktif
        </div>
      </div>

      {/* SPV Cards Grid with Rich Color Accents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 my-6">
        {spvData.map((spv) => {
          const teamInfo = spvTeamMap[spv.name] || { sales: new Set(), regions: new Set(), stores: new Set() };
          const salesCount = teamInfo.sales.size;
          const avgPerSales = salesCount > 0 ? spv.totalValue / salesCount : 0;
          const initials = spv.name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <div
              key={spv.name}
              className="p-5 rounded-2xl border border-purple-200/90 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/20 border-t-4 border-t-purple-600 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm shadow-purple-500/20">
                      {initials}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">
                        Supervisor Area
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                        {spv.name}
                      </h3>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                    {formatPercent(spv.contributionPercent, false)} Share
                  </span>
                </div>

                <div className="mt-4 p-3.5 bg-white/90 rounded-xl border border-purple-100 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Omzet Tim:</div>
                  <div className="text-2xl font-black font-mono text-purple-950 tabular-nums">
                    {formatRupiah(spv.totalValue)}
                  </div>
                  <div className="text-xs text-purple-800 font-mono font-medium mt-1">
                    {formatNumber(spv.totalQty)} pcs terjual ({spv.transactionCount} nota)
                  </div>
                </div>

                {/* Team meta */}
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                      <Users2 className="w-3.5 h-3.5 text-indigo-500" />
                      Anggota Tim Sales:
                    </span>
                    <span className="font-bold text-slate-800">
                      {salesCount} Sales ({Array.from(teamInfo.sales).slice(0, 2).join(', ')}{salesCount > 2 ? '...' : ''})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      Wilayah / Region:
                    </span>
                    <span className="font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px]">
                      {Array.from(teamInfo.regions).join(', ') || 'PEKAN BARU'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500 font-medium">Cakupan Gerai:</span>
                    <span className="font-bold text-slate-800">
                      {teamInfo.stores.size} Outlet Aktif
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-purple-100">
                    <span className="text-slate-500 font-medium">Produktivitas / Sales:</span>
                    <span className="font-mono font-extrabold text-indigo-950 tabular-nums">
                      {formatRupiah(avgPerSales, true)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-purple-100">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">
                    Target: <strong className="text-slate-800 font-mono tabular-nums">{formatRupiah(spv.target || 0, true)}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-purple-900 tabular-nums">
                      {formatPercent(spv.achievementPercent || 0, false)}
                    </span>
                    <button
                      onClick={() => {
                        setEditingSpv({ name: spv.name, target: spv.target || DEFAULT_SPV_TARGET });
                        setEditTargetInput(spv.target || DEFAULT_SPV_TARGET);
                      }}
                      className="p-1 rounded-md text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer"
                      title="Ubah Target SPV"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500 h-full rounded-full transition-all duration-500 shadow-2xs"
                    style={{ width: `${Math.min(100, spv.achievementPercent || 0)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Edit Target SPV */}
      {editingSpv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">Ubah Target SPV: {editingSpv.name}</h3>
                <p className="text-[11px] text-purple-200 mt-0.5">Periode: {getMonthDisplayLabel(activeMonth)}</p>
              </div>
              <button
                onClick={() => setEditingSpv(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditSpv} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Omzet SPV (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={editTargetInput}
                  onChange={(e) => setEditTargetInput(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(editTargetInput)}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSpv(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Sinkronkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
