import React, { useMemo, useState } from 'react';
import {
  X,
  Users,
  Wallet,
  Search,
  FileSpreadsheet,
  Store,
  Award,
  AlertTriangle,
  Edit3,
  Briefcase,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AreaCostSummary } from '../types/dashboard';
import { formatRupiah } from '../utils/analytics';

interface SalaryBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  titlePeriodLabel: string;
  activeSalaryCost: number;
  systemSalaryCost: number;
  isManualSalaryOverride: boolean;
  spvCount?: number;
  costBreakdown?: AreaCostSummary;
  onOpenEditModal?: () => void;
}

export const SalaryBreakdownModal: React.FC<SalaryBreakdownModalProps> = ({
  isOpen,
  onClose,
  titlePeriodLabel,
  activeSalaryCost,
  systemSalaryCost,
  isManualSalaryOverride,
  spvCount = 0,
  costBreakdown,
  onOpenEditModal,
}) => {
  const [categoryTab, setCategoryTab] = useState<'all' | 'sales' | 'ba' | 'trainer'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const salesList = costBreakdown?.salesList || [];
  const baList = costBreakdown?.baList || [];
  const trainerList = costBreakdown?.trainerList || [];

  const q = searchQuery.trim().toLowerCase();

  const filteredSales = useMemo(() => {
    if (!q) return salesList;
    return salesList.filter(
      (s) =>
        s.salesName.toLowerCase().includes(q) ||
        s.coverArea.toLowerCase().includes(q) ||
        s.spv.toLowerCase().includes(q)
    );
  }, [salesList, q]);

  const filteredBa = useMemo(() => {
    if (!q) return baList;
    return baList.filter(
      (b) =>
        b.baName.toLowerCase().includes(q) ||
        b.storeName.toLowerCase().includes(q) ||
        b.coverArea.toLowerCase().includes(q) ||
        b.region.toLowerCase().includes(q) ||
        b.salesName.toLowerCase().includes(q)
    );
  }, [baList, q]);

  const filteredTrainer = useMemo(() => {
    if (!q) return trainerList;
    return trainerList.filter(
      (t) =>
        t.trainerName.toLowerCase().includes(q) ||
        t.areaCovered.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q)
    );
  }, [trainerList, q]);

  if (!isOpen) return null;

  const totalSalesCost = costBreakdown?.totalSalesCost || 0;
  const totalSalesBase = costBreakdown?.totalSalesBase || 0;
  const totalSalesSellInInc = salesList.reduce((acc, s) => acc + s.incentiveNominal, 0);
  const totalSalesBaBonus = salesList.reduce((acc, s) => acc + s.baProductivityBonus, 0);
  const totalSalesBaPenalty = salesList.reduce((acc, s) => acc + s.baProductivityPenalty, 0);

  const totalBaCost = costBreakdown?.totalBaCost || 0;
  const totalBaBase = costBreakdown?.totalBaBase || 0;
  const totalBaNonLavojoyInc = baList.reduce((acc, b) => acc + b.incentiveNonLavojoyNominal, 0);
  const totalBaLavojoyInc = baList.reduce((acc, b) => acc + b.incentiveLavojoyNominal, 0);
  const totalBaFocusInc = costBreakdown?.totalBaFocusIncentive || 0;
  const totalBaFocusPen = costBreakdown?.totalBaFocusPenalty || 0;
  const totalBaFocusNet = totalBaFocusInc - totalBaFocusPen;

  const totalTrainerCost = costBreakdown?.totalTrainerCost || 0;
  const totalTrainerBase = costBreakdown?.totalTrainerBase || 0;
  const totalTrainerTransport = costBreakdown?.totalTrainerTransport || 0;
  const totalTrainerFocusNet =
    (costBreakdown?.totalTrainerFocusIncentive || 0) - (costBreakdown?.totalTrainerFocusPenalty || 0);
  const totalTrainerKpiNet =
    (costBreakdown?.totalTrainerKpiIncentive || 0) - (costBreakdown?.totalTrainerKpiPenalty || 0);

  const totalPersonilCount = salesList.length + baList.length + trainerList.length;

  const handleExportBreakdown = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows: (string | number)[][] = [
      [`RINCIAN SUMBER BEBAN GAJI SDM - ${titlePeriodLabel.toUpperCase()}`],
      ['Waktu Cetak:', new Date().toLocaleString('id-ID')],
      ['Beban Gaji SDM Aktif (P&L):', activeSalaryCost],
      ['Total Hitungan Sistem (Sales + BA + Trainer):', systemSalaryCost],
      ['Status Override Manual:', isManualSalaryOverride ? 'Ya (Diedit Manual)' : 'Tidak (Otomatis Sistem)'],
      [''],
      ['KATEGORI SDM', 'JUMLAH PERSONIL', 'GAJI POKOK / TRANSPORT', 'INSENTIF / BONUS', 'DENDA / PENALTI', 'TOTAL BEBAN GAJI (IDR)'],
      [
        '1. Tim Sales',
        salesList.length,
        totalSalesBase,
        totalSalesSellInInc + totalSalesBaBonus,
        -totalSalesBaPenalty,
        totalSalesCost,
      ],
      [
        '2. Beauty Advisor (BA)',
        baList.length,
        totalBaBase,
        totalBaNonLavojoyInc + totalBaLavojoyInc + totalBaFocusInc,
        -totalBaFocusPen,
        totalBaCost,
      ],
      [
        '3. Tim Trainer',
        trainerList.length,
        totalTrainerBase + totalTrainerTransport,
        (costBreakdown?.totalTrainerFocusIncentive || 0) + (costBreakdown?.totalTrainerKpiIncentive || 0),
        -((costBreakdown?.totalTrainerFocusPenalty || 0) + (costBreakdown?.totalTrainerKpiPenalty || 0)),
        totalTrainerCost,
      ],
      ['TOTAL SISTEM', totalPersonilCount, totalSalesBase + totalBaBase + totalTrainerBase + totalTrainerTransport, '', '', systemSalaryCost],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Ringkasan Gaji SDM');

    const salesHeader = [
      'No',
      'Nama Sales',
      'Cover Area',
      'SPV',
      'Realisasi Sell In',
      'Target Sell In',
      '% Capaian',
      'Gaji Pokok',
      'Insentif Sell In (%)',
      'Insentif Sell In (IDR)',
      'Bonus Prod. BA',
      'Denda SP1 Prod. BA',
      'Total Gaji Sales (IDR)',
    ];
    const salesRows = salesList.map((s, idx) => [
      idx + 1,
      s.salesName,
      s.coverArea,
      s.spv,
      s.sellInActual,
      s.sellInTarget,
      `${s.achievementPercent.toFixed(1)}%`,
      s.baseSalary,
      `${s.incentivePercent}%`,
      s.incentiveNominal,
      s.baProductivityBonus,
      -s.baProductivityPenalty,
      s.totalSalary,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]), 'Rincian Sales');

    const baHeader = [
      'No',
      'Nama BA',
      'Nama Toko',
      'Area',
      'Region',
      'Sales',
      'Sell Out Total',
      'Gaji Pokok',
      'Insentif Non-Lavojoy',
      'Insentif Lavojoy (4%)',
      'Insentif Produk Fokus',
      'Denda Produk Fokus',
      'Total Gaji BA (IDR)',
    ];
    const baRows = baList.map((b, idx) => [
      idx + 1,
      b.baName,
      b.storeName,
      b.coverArea,
      b.region,
      b.salesName,
      b.sellOutActual,
      b.baseSalary,
      b.incentiveNonLavojoyNominal,
      b.incentiveLavojoyNominal,
      b.focusIncentive || 0,
      -(b.focusPenalty || 0),
      b.totalSalary,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([baHeader, ...baRows]), 'Rincian BA');

    const trainerHeader = [
      'No',
      'Nama Trainer',
      'Area Coverage',
      'Gaji Pokok',
      'Tunj. Transport',
      'Insentif Produk Fokus',
      'Denda Produk Fokus',
      'Skor KPI',
      'Insentif KPI',
      'Denda KPI',
      'Total Gaji Trainer (IDR)',
    ];
    const trainerRows = trainerList.map((t, idx) => [
      idx + 1,
      t.trainerName,
      t.areaCovered,
      t.baseSalary,
      t.transportAllowance,
      t.focusIncentive,
      -t.focusPenalty,
      t.kpiScore,
      t.kpiIncentive,
      -t.kpiPenalty,
      t.totalSalary,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([trainerHeader, ...trainerRows]), 'Rincian Trainer');

    const safeLabel = titlePeriodLabel.replace(/[^a-zA-Z0-9_-]+/g, '_');
    XLSX.writeFile(wb, `SalesPro_Rincian_Beban_Gaji_SDM_${safeLabel}.xlsx`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-600 via-purple-700 to-indigo-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-xs">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                Rincian Asal Nominal Beban Gaji SDM — {titlePeriodLabel}
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                Menampilkan sumber detail setiap Rupiah Beban Gaji SDM dari komponen Gaji Pokok, Insentif, Tunjangan &amp; Penalti (Sales + BA + Trainer)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleExportBreakdown}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 border border-white/25 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Tutup Rincian"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          {/* Manual Override Banner */}
          {isManualSalaryOverride && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Beban Gaji SDM Bulan Ini Sedang Menggunakan Edit Manual:</strong>{' '}
                  <span className="font-mono font-black text-rose-700">{formatRupiah(activeSalaryCost)}</span>
                  <span className="text-amber-800 ml-1">
                    (Hitungan otomatis sistem dari data transaksi: <strong className="font-mono">{formatRupiah(systemSalaryCost)}</strong>, selisih{' '}
                    <strong className="font-mono">{formatRupiah(activeSalaryCost - systemSalaryCost)}</strong>). Rincian per personil di bawah menunjukkan hitungan otomatis sistem.
                  </span>
                </div>
              </div>
              {onOpenEditModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditModal();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Ubah / Reset Override
                </button>
              )}
            </div>
          )}

          {/* 4 Summary Cards showing exact mathematical sum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Sales */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-800 uppercase flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  1. Tim Sales ({salesList.length} Org)
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {systemSalaryCost > 0 ? `${((totalSalesCost / systemSalaryCost) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
              <div className="text-lg font-black font-mono text-indigo-950 mt-1">
                {formatRupiah(totalSalesCost)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-[11px] font-mono text-slate-600">
                <div className="flex justify-between">
                  <span>Gaji Pokok:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(totalSalesBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insentif Sell In:</span>
                  <span className="font-bold text-emerald-700">+{formatRupiah(totalSalesSellInInc)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Prod. BA:</span>
                  <span className={`font-bold ${totalSalesBaBonus - totalSalesBaPenalty >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {totalSalesBaBonus - totalSalesBaPenalty >= 0 ? '+' : ''}
                    {formatRupiah(totalSalesBaBonus - totalSalesBaPenalty)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. BA */}
            <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-800 uppercase flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-purple-600" />
                  2. Tim BA Toko ({baList.length} Org)
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                  {systemSalaryCost > 0 ? `${((totalBaCost / systemSalaryCost) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
              <div className="text-lg font-black font-mono text-purple-950 mt-1">
                {formatRupiah(totalBaCost)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-[11px] font-mono text-slate-600">
                <div className="flex justify-between">
                  <span>Gaji Pokok BA:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(totalBaBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insentif Non-Lav &amp; Lav:</span>
                  <span className="font-bold text-emerald-700">+{formatRupiah(totalBaNonLavojoyInc + totalBaLavojoyInc)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Produk Fokus:</span>
                  <span className={`font-bold ${totalBaFocusNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {totalBaFocusNet >= 0 ? '+' : ''}
                    {formatRupiah(totalBaFocusNet)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Trainer */}
            <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-800 uppercase flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-teal-600" />
                  3. Tim Trainer ({trainerList.length} Org)
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
                  {systemSalaryCost > 0 ? `${((totalTrainerCost / systemSalaryCost) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
              <div className="text-lg font-black font-mono text-teal-950 mt-1">
                {formatRupiah(totalTrainerCost)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-[11px] font-mono text-slate-600">
                <div className="flex justify-between">
                  <span>Pokok + Transport:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(totalTrainerBase + totalTrainerTransport)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Produk Fokus:</span>
                  <span className={`font-bold ${totalTrainerFocusNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {totalTrainerFocusNet >= 0 ? '+' : ''}
                    {formatRupiah(totalTrainerFocusNet)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Net KPI Trainer:</span>
                  <span className={`font-bold ${totalTrainerKpiNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {totalTrainerKpiNet >= 0 ? '+' : ''}
                    {formatRupiah(totalTrainerKpiNet)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Total Rekonsiliasi */}
            <div className="bg-gradient-to-br from-rose-50 via-white to-purple-50 p-3.5 rounded-xl border border-rose-300 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                    Total Beban Gaji SDM
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                    {totalPersonilCount} Org Dibayar
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-rose-900 mt-1">
                  {formatRupiah(activeSalaryCost)}
                </div>
                <div className="text-[10px] font-mono text-slate-600 mt-1">
                  Rumus: Sales + BA + Trainer ={' '}
                  <strong className="text-slate-900">{formatRupiah(systemSalaryCost)}</strong>
                </div>
              </div>
              {spvCount > 0 && (
                <div className="mt-2 pt-2 border-t border-rose-200/70 text-[10px] text-slate-500 leading-snug">
                  Info: <strong>{spvCount} SPV</strong> tercatat di jumlah SDM coverage area (tidak dibebankan ke pos gaji ini).
                </div>
              )}
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setCategoryTab('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  categoryTab === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({totalPersonilCount})
              </button>
              <button
                type="button"
                onClick={() => setCategoryTab('sales')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  categoryTab === 'sales' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Sales ({salesList.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryTab('ba')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  categoryTab === 'ba' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. BA Toko ({baList.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryTab('trainer')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  categoryTab === 'trainer' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Trainer ({trainerList.length})
              </button>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama personil, toko, area..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {totalPersonilCount === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              Belum ada data transaksi Sales, BA, maupun Trainer aktif pada periode <strong>{titlePeriodLabel}</strong>.
            </div>
          ) : (
            <div className="space-y-4">
              {/* SECTION 1: RINCIAN GAJI SALES */}
              {(categoryTab === 'all' || categoryTab === 'sales') && (
                <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs sm:text-sm font-extrabold text-indigo-950">
                        1. Rincian Beban Gaji Sales ({filteredSales.length} Personil)
                      </h4>
                    </div>
                    <div className="text-xs font-mono font-black text-indigo-900">
                      Subtotal Sales: {formatRupiah(filteredSales.reduce((acc, s) => acc + s.totalSalary, 0))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Nama Sales &amp; Area</th>
                          <th className="py-2 px-3 text-right">Sell In / Target</th>
                          <th className="py-2 px-3 text-right">Gaji Pokok</th>
                          <th className="py-2 px-3 text-right">Insentif Sell In</th>
                          <th className="py-2 px-3 text-right">Bonus/Denda Prod. BA</th>
                          <th className="py-2 px-3 text-right bg-indigo-50/70 text-indigo-950">Total Gaji (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSales.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-4 text-center text-slate-400">
                              Tidak ada data Sales yang sesuai.
                            </td>
                          </tr>
                        ) : (
                          filteredSales.map((s, idx) => {
                            const netBaProd = s.baProductivityBonus - s.baProductivityPenalty;
                            return (
                              <tr key={s.salesName} className="hover:bg-indigo-50/20">
                                <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <div className="font-extrabold text-slate-900">{s.salesName}</div>
                                  <div className="text-[10px] text-slate-500">
                                    Area: {s.coverArea} • {s.coveredBaCount} BA dicover
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className="font-bold text-slate-800">{formatRupiah(s.sellInActual, true)}</div>
                                  <div className="text-[10px] text-slate-500">
                                    Tgt: {formatRupiah(s.sellInTarget, true)} ({s.achievementPercent.toFixed(1)}%)
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-800">
                                  {formatRupiah(s.baseSalary)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className="font-bold text-emerald-700">+{formatRupiah(s.incentiveNominal)}</div>
                                  <div className="text-[10px] text-slate-500">{s.incentivePercent}% Sell In</div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className={`font-bold ${netBaProd >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {netBaProd >= 0 ? '+' : ''}
                                    {formatRupiah(netBaProd)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    +{formatRupiah(s.baProductivityBonus, true)} / -{formatRupiah(s.baProductivityPenalty, true)}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-black text-indigo-950 bg-indigo-50/40">
                                  {formatRupiah(s.totalSalary)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredSales.length > 0 && (
                        <tfoot>
                          <tr className="bg-indigo-50/70 border-t border-indigo-200 font-black text-xs text-indigo-950">
                            <td colSpan={3} className="py-2 px-3">
                              Subtotal Gaji Sales ({filteredSales.length} Personil)
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredSales.reduce((a, b) => a + b.baseSalary, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">
                              +{formatRupiah(filteredSales.reduce((a, b) => a + b.incentiveNominal, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {(() => {
                                const sumNet = filteredSales.reduce(
                                  (a, b) => a + (b.baProductivityBonus - b.baProductivityPenalty),
                                  0
                                );
                                return (
                                  <span className={sumNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {sumNet >= 0 ? '+' : ''}
                                    {formatRupiah(sumNet)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredSales.reduce((a, b) => a + b.totalSalary, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 2: RINCIAN GAJI BA */}
              {(categoryTab === 'all' || categoryTab === 'ba') && (
                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-purple-50/80 border-b border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-purple-600" />
                      <h4 className="text-xs sm:text-sm font-extrabold text-purple-950">
                        2. Rincian Beban Gaji Beauty Advisor / BA ({filteredBa.length} Personil)
                      </h4>
                    </div>
                    <div className="text-xs font-mono font-black text-purple-900">
                      Subtotal BA: {formatRupiah(filteredBa.reduce((acc, b) => acc + b.totalSalary, 0))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Nama BA &amp; Toko</th>
                          <th className="py-2 px-3">Area / Sales</th>
                          <th className="py-2 px-3 text-right">Sell Out Aktual</th>
                          <th className="py-2 px-3 text-right">Gaji Pokok</th>
                          <th className="py-2 px-3 text-right">Insentif Non-Lav</th>
                          <th className="py-2 px-3 text-right">Insentif Lavojoy 4%</th>
                          <th className="py-2 px-3 text-right">Fokus Produk (Net)</th>
                          <th className="py-2 px-3 text-right bg-purple-50/70 text-purple-950">Total Gaji (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBa.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-4 text-center text-slate-400">
                              Tidak ada data BA yang sesuai.
                            </td>
                          </tr>
                        ) : (
                          filteredBa.map((b, idx) => {
                            const netFocus = (b.focusIncentive || 0) - (b.focusPenalty || 0);
                            return (
                              <tr key={`${b.storeName}-${b.baName}-${idx}`} className="hover:bg-purple-50/20">
                                <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <div className="font-extrabold text-slate-900">{b.baName}</div>
                                  <div className="text-[10px] text-slate-500">{b.storeName}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-700">{b.coverArea}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {b.region} • Sales: {b.salesName}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className="font-bold text-slate-800">{formatRupiah(b.sellOutActual, true)}</div>
                                  <div className="text-[10px] text-slate-500">
                                    Non-Lav {formatRupiah(b.sellOutNonLavojoy, true)} • Lav {formatRupiah(b.sellOutLavojoy, true)}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-800">
                                  {formatRupiah(b.baseSalary)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                                  +{formatRupiah(b.incentiveNonLavojoyNominal)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                                  +{formatRupiah(b.incentiveLavojoyNominal)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className={`font-bold ${netFocus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {netFocus >= 0 ? '+' : ''}
                                    {formatRupiah(netFocus)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {b.focusActualPcs || 0}/{b.focusTargetPcs || 0} Pcs
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-black text-purple-950 bg-purple-50/40">
                                  {formatRupiah(b.totalSalary)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredBa.length > 0 && (
                        <tfoot>
                          <tr className="bg-purple-50/70 border-t border-purple-200 font-black text-xs text-purple-950">
                            <td colSpan={4} className="py-2 px-3">
                              Subtotal Gaji BA ({filteredBa.length} Personil)
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredBa.reduce((a, b) => a + b.baseSalary, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">
                              +{formatRupiah(filteredBa.reduce((a, b) => a + b.incentiveNonLavojoyNominal, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">
                              +{formatRupiah(filteredBa.reduce((a, b) => a + b.incentiveLavojoyNominal, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {(() => {
                                const sumFocus = filteredBa.reduce(
                                  (a, b) => a + ((b.focusIncentive || 0) - (b.focusPenalty || 0)),
                                  0
                                );
                                return (
                                  <span className={sumFocus >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {sumFocus >= 0 ? '+' : ''}
                                    {formatRupiah(sumFocus)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredBa.reduce((a, b) => a + b.totalSalary, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 3: RINCIAN GAJI TRAINER */}
              {(categoryTab === 'all' || categoryTab === 'trainer') && (
                <div className="bg-white rounded-xl border border-teal-200 overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-teal-50/80 border-b border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-teal-600" />
                      <h4 className="text-xs sm:text-sm font-extrabold text-teal-950">
                        3. Rincian Beban Gaji Trainer ({filteredTrainer.length} Personil)
                      </h4>
                    </div>
                    <div className="text-xs font-mono font-black text-teal-900">
                      Subtotal Trainer: {formatRupiah(filteredTrainer.reduce((acc, t) => acc + t.totalSalary, 0))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Nama Trainer &amp; Area Coverage</th>
                          <th className="py-2 px-3 text-right">Gaji Pokok</th>
                          <th className="py-2 px-3 text-right">Tunj. Transport</th>
                          <th className="py-2 px-3 text-right">Fokus Produk (Net)</th>
                          <th className="py-2 px-3 text-right">KPI Trainer (Skor &amp; Net)</th>
                          <th className="py-2 px-3 text-right bg-teal-50/70 text-teal-950">Total Gaji (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTrainer.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-4 text-center text-slate-400">
                              Tidak ada data Trainer aktif pada periode ini.
                            </td>
                          </tr>
                        ) : (
                          filteredTrainer.map((t, idx) => {
                            const netFocus = t.focusIncentive - t.focusPenalty;
                            const netKpi = t.kpiIncentive - t.kpiPenalty;
                            return (
                              <tr key={t.id || t.trainerName} className="hover:bg-teal-50/20">
                                <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <div className="font-extrabold text-slate-900">{t.trainerName}</div>
                                  <div className="text-[10px] text-slate-500 max-w-xs truncate" title={t.areaCovered}>
                                    {t.areaCovered}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-800">
                                  {formatRupiah(t.baseSalary)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-800">
                                  {formatRupiah(t.transportAllowance)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className={`font-bold ${netFocus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {netFocus >= 0 ? '+' : ''}
                                    {formatRupiah(netFocus)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {t.focusActualPcs}/{t.focusTargetPcs} Pcs ({t.focusAchievementPct.toFixed(1)}%)
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  <div className={`font-bold ${netKpi >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {netKpi >= 0 ? '+' : ''}
                                    {formatRupiah(netKpi)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">Skor KPI: {t.kpiScore} pt</div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-black text-teal-950 bg-teal-50/40">
                                  {formatRupiah(t.totalSalary)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {filteredTrainer.length > 0 && (
                        <tfoot>
                          <tr className="bg-teal-50/70 border-t border-teal-200 font-black text-xs text-teal-950">
                            <td colSpan={2} className="py-2 px-3">
                              Subtotal Gaji Trainer ({filteredTrainer.length} Personil)
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredTrainer.reduce((a, b) => a + b.baseSalary, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredTrainer.reduce((a, b) => a + b.transportAllowance, 0))}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {(() => {
                                const sumFocus = filteredTrainer.reduce(
                                  (a, b) => a + (b.focusIncentive - b.focusPenalty),
                                  0
                                );
                                return (
                                  <span className={sumFocus >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {sumFocus >= 0 ? '+' : ''}
                                    {formatRupiah(sumFocus)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {(() => {
                                const sumKpi = filteredTrainer.reduce(
                                  (a, b) => a + (b.kpiIncentive - b.kpiPenalty),
                                  0
                                );
                                return (
                                  <span className={sumKpi >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {sumKpi >= 0 ? '+' : ''}
                                    {formatRupiah(sumKpi)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatRupiah(filteredTrainer.reduce((a, b) => a + b.totalSalary, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-600 font-mono flex items-center gap-1.5 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>
              Total Sistem: <strong className="text-slate-900">{formatRupiah(systemSalaryCost)}</strong> = Sales ({formatRupiah(totalSalesCost)}) + BA ({formatRupiah(totalBaCost)}) + Trainer ({formatRupiah(totalTrainerCost)})
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            {onOpenEditModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditModal();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Manual Gaji P&amp;L</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
