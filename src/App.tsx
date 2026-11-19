import React, { useState, useEffect, useMemo } from 'react';
import {
  ActiveTab,
  DashboardFilters,
  TimeframeMode,
  TransactionRecord,
  GasConfig,
} from './types/dashboard';
import { INITIAL_DATA } from './data/initialData';
import {
  loadGasConfig,
  saveGasConfig,
  loadStoredTransactions,
  saveStoredTransactions,
  clearStoredTransactions,
  loadTransactionsFromDb,
  downloadCsv,
  fetchGoogleSheetData,
} from './services/gasService';
import {
  filterRecords,
  getCascadingOptions,
  calculateSummary,
  aggregateTimeframe,
  calculateComparisonGrowth,
  diagnoseSalesGap,
  aggregateCategoryDetails,
  aggregateByDimension,
  formatRupiah,
  formatNumber,
  formatPercent,
} from './utils/analytics';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { KpiCards } from './components/KpiCards';
import { TimeframeTrendChart } from './components/TimeframeTrendChart';
import { ComparisonView } from './components/ComparisonView';
import { GapAnalysisView } from './components/GapAnalysisView';
import { SalesAnalysis } from './components/SalesAnalysis';
import { SpvAnalysis } from './components/SpvAnalysis';
import { BrandAnalysis } from './components/BrandAnalysis';
import { StoreAnalysis } from './components/StoreAnalysis';
import { SkuAnalysis } from './components/SkuAnalysis';
import { RawDataTable } from './components/RawDataTable';
import { GasIntegrationModal } from './components/GasIntegrationModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { CategoryAnalysis } from './components/CategoryAnalysis';
import { CostAreaAnalysis } from './components/CostAreaAnalysis';
import { ProfitAreaAnalysis } from './components/ProfitAreaAnalysis';
import { StoreAgingBills } from './components/StoreAgingBills';
import { KpiSalesScorecard } from './components/KpiSalesScorecard';
import { KpiTrainerScorecard } from './components/KpiTrainerScorecard';
import { ReviewWeeklySellOutBa } from './components/ReviewWeeklySellOutBa';
import { BaPunishmentView } from './components/BaPunishmentView';
import { FocusProductBaManagement } from './components/FocusProductBaManagement';
import { TargetManagementView } from './components/TargetManagementView';
import { QuarterlySummaryView } from './components/QuarterlySummaryView';
import { SellInVsSellOutView } from './components/SellInVsSellOutView';
import { StoreBaContributionView } from './components/StoreBaContributionView';
import { MasterStoreBaSettings } from './components/MasterStoreBaSettings';
import { CentralKaMgManager } from './components/CentralKaMgManager';
import { ActivePersonnelStoreInfo } from './components/ActivePersonnelStoreInfo';
import { SalesVisitView } from './components/SalesVisitView';
import { TrainerVisitView } from './components/TrainerVisitView';
import { OnlinePromoReportView } from './components/OnlinePromoReportView';
import { MissGlamMarketShareView } from './components/MissGlamMarketShareView';
import { exportToExcel, exportToPdf } from './utils/exportUtils';
import { aggregateTargetMatrix, TARGETS_UPDATED_EVENT } from './services/targetManagementService';
import {
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Layers,
  Store,
  ChevronRight,
  Boxes,
  Wallet,
} from 'lucide-react';

const INITIAL_FILTERS: DashboardFilters = {
  BULAN: 'ALL',
  TAHUN: 'ALL',
  SALES: 'ALL',
  TRAINER: 'ALL',
  SPV: 'ALL',
  BRAND: 'ALL',
  KATEGORI: 'ALL',
  SKU: 'ALL',
  NAMA_STORE: 'ALL',
  REGION: 'ALL',
  KET: 'ALL',
  searchQuery: '',
};

export default function App() {
  // State for transaction dataset
  const [records, setRecords] = useState<TransactionRecord[]>(() => {
    const stored = loadStoredTransactions();
    return stored && stored.length > 0 ? stored : INITIAL_DATA;
  });

  // State for active filters
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);

  // Timeframe mode for charts (Harian, Mingguan, Bulanan, Tahunan)
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('bulanan');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Google Apps Script integration state
  const [gasConfig, setGasConfig] = useState<GasConfig>(() => loadGasConfig());
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [targetSyncVersion, setTargetSyncVersion] = useState<number>(0);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const onTargetsUpdated = () => setTargetSyncVersion((v) => v + 1);
    const onMapsQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
    window.addEventListener('storage', onTargetsUpdated);
    window.addEventListener('gmp-quota-exceeded', onMapsQuotaExceeded);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
      window.removeEventListener('storage', onTargetsUpdated);
      window.removeEventListener('gmp-quota-exceeded', onMapsQuotaExceeded);
    };
  }, []);

  // Load dataset from IndexedDB on initial mount (bypasses localStorage 5MB quota)
  useEffect(() => {
    loadTransactionsFromDb().then((dbRecords) => {
      if (dbRecords && dbRecords.length > 0) {
        setRecords(dbRecords);
      }
    }).catch(() => {});
  }, []);

  // Save transactions to persistent storage (IndexedDB + safe localStorage cache)
  useEffect(() => {
    saveStoredTransactions(records);
  }, [records]);

  // Save GAS config when it changes
  useEffect(() => {
    saveGasConfig(gasConfig);
  }, [gasConfig]);

  // Auto-toast dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
  };

  // Filter handlers
  const handleFilterChange = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    showToast('Filter telah direset ke default.');
  };

  // Derived filtered records & cascading options
  const filteredRecords = useMemo(() => {
    return filterRecords(records, filters);
  }, [records, filters]);

  const cascadingOptions = useMemo(() => {
    return getCascadingOptions(records, filters);
  }, [records, filters]);

  // Summary KPIs
  const summary = useMemo(() => {
    return calculateSummary(filteredRecords);
  }, [filteredRecords]);

  // Dynamic Target & Achievement calculation for executive KpiCards
  const kpiTargetMetrics = useMemo(() => {
    const matrix = aggregateTargetMatrix(filteredRecords, filters.BULAN);
    let targetTotal = 0;
    if (filters.KET === 'SELL OUT') {
      if (filters.NAMA_STORE !== 'ALL') {
        targetTotal = matrix.summary.totalBaTarget || matrix.summary.totalSalesTargetSellOut;
      } else {
        targetTotal = matrix.summary.totalSalesTargetSellOut || matrix.summary.totalBaTarget;
      }
    } else if (filters.SALES !== 'ALL') {
      targetTotal = matrix.summary.totalSalesTarget;
    } else if (filters.REGION !== 'ALL') {
      targetTotal = matrix.summary.totalAreaTarget;
    } else if (filters.SPV !== 'ALL') {
      targetTotal = matrix.summary.totalSpvTarget;
    } else {
      targetTotal = matrix.summary.totalSalesTarget > 0 ? matrix.summary.totalSalesTarget : matrix.summary.totalSpvTarget;
    }
    const achievementPercent = targetTotal > 0 ? (summary.totalRevenue / targetTotal) * 100 : 0;
    return { targetTotal, achievementPercent };
  }, [filteredRecords, filters.BULAN, filters.KET, filters.SALES, filters.REGION, filters.SPV, filters.NAMA_STORE, summary.totalRevenue, targetSyncVersion]);

  // Timeframe trend data (100% mengikuti Google Sheet & Filter Terintegrasi)
  const trendData = useMemo(() => {
    return aggregateTimeframe(filteredRecords, timeframeMode);
  }, [filteredRecords, timeframeMode]);

  // Overall growth comparison (uses full records so previous period data like September can be retrieved)
  const growthComparison = useMemo(() => {
    return calculateComparisonGrowth(records, 'mom', filters);
  }, [records, filters]);

  // Gap & Root-Cause Diagnosis: Why did sales drop?
  const gapDiagnosis = useMemo(() => {
    return diagnoseSalesGap(records, filteredRecords, filters);
  }, [records, filteredRecords, filters, targetSyncVersion]);

  // Top Category, Brand & Store details strictly from filteredRecords (Google Sheet + Filter Terintegrasi)
  const topCategories = useMemo(() => {
    return aggregateCategoryDetails(filteredRecords);
  }, [filteredRecords]);

  const topBrands = useMemo(() => {
    return aggregateByDimension(filteredRecords, 'BRAND');
  }, [filteredRecords]);

  const topStores = useMemo(() => {
    return aggregateByDimension(filteredRecords, 'NAMA_STORE');
  }, [filteredRecords]);

  // Live Sync with Google Apps Script
  const handleSyncGas = async () => {
    if (!gasConfig.webAppUrl) {
      setIsGasModalOpen(true);
      return;
    }

    setIsSyncing(true);
    const result = await fetchGoogleSheetData(gasConfig.webAppUrl);

    if (result.success && result.data) {
      setRecords(result.data);
      const updatedConfig: GasConfig = {
        ...gasConfig,
        lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
        status: 'connected',
        dataSourceType: 'google_sheet',
      };
      setGasConfig(updatedConfig);
      showToast(`Berhasil sinkronisasi! Memuat ${result.data.length} baris data dari Google Sheet.`);
    } else {
      showToast(result.message || 'Gagal sinkronisasi dari Google Apps Script', 'error');
    }

    setIsSyncing(false);
  };

  // Add new transaction record
  const handleAddRecord = (newRecord: TransactionRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
    showToast(`Transaksi baru untuk "${newRecord.NAMA_STORE}" berhasil ditambahkan!`);
  };

  // Reset to initial sample data
  const handleResetToSample = () => {
    clearStoredTransactions();
    setRecords(INITIAL_DATA);
    setGasConfig({
      ...gasConfig,
      dataSourceType: 'sample',
      status: 'idle',
      lastSyncedAt: null,
    });
    setFilters(INITIAL_FILTERS);
    showToast('Dataset telah dikembalikan ke data simulasi bawaan.');
  };

  // Export handlers for Excel (.xlsx) and PDF (.pdf)
  const handleExportExcel = () => {
    try {
      exportToExcel(
        filteredRecords,
        summary,
        filters,
        `SalesPro_Laporan_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      showToast('File Excel (.xlsx) berhasil diunduh!');
    } catch (err: any) {
      showToast('Gagal men-download file Excel: ' + (err.message || 'Error'), 'error');
    }
  };

  const handleExportPdf = () => {
    try {
      exportToPdf(
        filteredRecords,
        summary,
        filters,
        `SalesPro_Laporan_${new Date().toISOString().slice(0, 10)}.pdf`
      );
      showToast('File Laporan PDF (.pdf) berhasil diunduh!');
    } catch (err: any) {
      showToast('Gagal men-download file PDF: ' + (err.message || 'Error'), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100/90 via-sky-50/40 via-indigo-50/25 to-pink-50/20 text-slate-900 flex flex-col relative selection:bg-teal-500 selection:text-white">
      {/* Top Colorful Accent Ribbon */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 via-blue-500 via-indigo-500 via-purple-500 via-pink-500 to-amber-500 shrink-0 shadow-xs" />

      {/* Google Maps Platform Quota / Auth Banner */}
      {mapsQuotaExceeded && (
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-300 px-4 py-2.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Batas kuota atau otorisasi Google Maps API tercapai. Fitur peta mungkin terbatas sementara.{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-amber-900 hover:text-amber-700"
              >
                Pelajari selengkapnya &amp; info upgrade kuota
              </a>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 font-bold text-amber-900 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-200" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Top Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        gasConfig={gasConfig}
        totalRecordsCount={records.length}
        filteredCount={filteredRecords.length}
        onOpenGasModal={() => setIsGasModalOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onExportCsv={() => downloadCsv(filteredRecords, `salespro_export_${new Date().toISOString().slice(0, 10)}.csv`)}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onSyncGas={handleSyncGas}
        isSyncing={isSyncing}
        filters={filters}
      />

      {/* Main Workspace Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grow w-full">
        {/* Integrated Cascading Filter Bar */}
        <FilterBar
          filters={filters}
          onChangeFilter={handleFilterChange}
          onResetFilters={handleResetFilters}
          options={cascadingOptions}
        />

        {/* Executive Summary Cards (shown on primary overview or comparison) */}
        <KpiCards
          summary={summary}
          growth={growthComparison.overall}
          comparisonLabel={growthComparison.previousPeriodLabel}
          targetTotal={kpiTargetMetrics.targetTotal}
          achievementPercent={kpiTargetMetrics.achievementPercent}
          scopeKey={`${filters.BULAN}|${filters.TAHUN}|${filters.KET}|${filters.REGION}|${filters.SPV}|${filters.SALES}|${filters.TRAINER || 'ALL'}`}
          scopeLabel={`${filters.BULAN === 'ALL' ? 'Semua Bulan' : filters.BULAN}${filters.KET !== 'ALL' ? ` • ${filters.KET}` : ''}${filters.REGION !== 'ALL' ? ` • ${filters.REGION}` : ''}${filters.SALES !== 'ALL' ? ` • ${filters.SALES}` : ''}${filters.TRAINER && filters.TRAINER !== 'ALL' ? ` • Trainer ${filters.TRAINER}` : ''}`}
        />

        {/* View Routing */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Gap & Drop Alert Callout Banner */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-600 text-white shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-rose-950">
                      Diagnosa Gap Defisit: - {formatRupiah(gapDiagnosis.gapDeficit)} ({formatPercent(gapDiagnosis.gapPercentage, false)} vs Target)
                    </h4>
                  </div>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Faktor utama penurunan: {gapDiagnosis.lostStoresCount} toko pasif tidak order repeat &amp; de-stocking gerai eksisting.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('gap')}
                className="px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <span>Buka Analisa Gap &amp; Solusi</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Estimasi Cost Area Quick Banner */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-teal-50/60 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 shadow-xs">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-950">
                    Estimasi Cost Area (Gaji &amp; Insentif Karyawan)
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Perhitungan otomatis kompensasi Sales (Sell In 80%-99% insentif 0,2%, 100%-119% insentif 0,3% + Rp 4,9 Jt) dan BA Toko (Sell Out min 25 Jt, 70%-99%, 100%-119% 2%, ≥120% 2% + Rp 3,9 Jt).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('cost')}
                className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <span>Buka Estimasi Gaji Area</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Timeframe Analysis (Harian, Mingguan, Bulanan, Tahunan) */}
            <TimeframeTrendChart
              data={trendData}
              mode={timeframeMode}
              onModeChange={setTimeframeMode}
              selectedMonth={filters.BULAN}
              filters={filters}
              totalFilteredRecords={filteredRecords.length}
            />

            {/* Split Grid: Category Share, Brand Share & Top Stores Quick Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Category Snapshot */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-fuchsia-600 text-white">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Analisa Kategori
                        </h3>
                        <p className="text-[11px] text-slate-500">Pangsa omzet per kategori produk</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('category')}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 border border-fuchsia-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {topCategories.length > 0 ? (
                      topCategories.slice(0, 5).map((cat, idx) => {
                        const barColors = [
                          'bg-fuchsia-500',
                          'bg-indigo-500',
                          'bg-amber-500',
                          'bg-emerald-500',
                          'bg-cyan-500',
                        ];
                        const pct = Math.max(0, cat.contributionPercent);

                        return (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex justify-between items-center text-xs gap-2">
                              <span className="font-bold text-slate-800 truncate">
                                {cat.category}
                              </span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums text-[11px] shrink-0">
                                {formatRupiah(cat.totalValue, true)}{' '}
                                <span className="text-slate-500 font-medium">
                                  ({formatPercent(pct, false)})
                                </span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`${barColors[idx % barColors.length]} h-full rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">
                        Tidak ada transaksi kategori pada filter ini.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Kategori Teratas:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">
                    {topCategories.length > 0
                      ? topCategories.slice(0, 2).map((c) => c.category).join(' & ')
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Brand Snapshot (100% Google Sheet + Integrated Filters) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-pink-600 text-white">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Pangsa Brand Kosmetik
                        </h3>
                        <p className="text-[11px] text-slate-500">Kontribusi brand sesuai filter aktif</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('brand')}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {topBrands.length > 0 ? (
                      topBrands.slice(0, 6).map((b, idx) => {
                        const brandColorMap: Record<string, string> = {
                          BARENBLISS: 'bg-rose-500',
                          'Y.O.U': 'bg-indigo-600',
                          'DAZZLE ME': 'bg-amber-500',
                          GLAMFIX: 'bg-purple-600',
                          LAVOJOY: 'bg-emerald-600',
                        };
                        const fallbackColors = ['bg-sky-500', 'bg-teal-500', 'bg-orange-500', 'bg-slate-600'];
                        const barColor =
                          brandColorMap[b.name.trim().toUpperCase()] ||
                          fallbackColors[idx % fallbackColors.length];
                        const pct = Math.max(0, b.contributionPercent);

                        return (
                          <div key={b.name} className="space-y-1">
                            <div className="flex justify-between items-center text-xs gap-2">
                              <span className="font-bold text-slate-800 truncate">
                                {b.name}
                              </span>
                              <span className="font-mono font-bold text-slate-900 tabular-nums text-[11px] shrink-0">
                                {formatRupiah(b.totalValue, true)}{' '}
                                <span className="text-slate-500 font-medium">
                                  ({formatPercent(pct, false)})
                                </span>
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`${barColor} h-full rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">
                        Tidak ada transaksi brand pada filter ini.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Kontributor Utama:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[190px] tabular-nums">
                    {topBrands.length > 0
                      ? `${topBrands
                          .slice(0, 2)
                          .map((b) => b.name)
                          .join(' & ')} (${topBrands
                          .slice(0, 2)
                          .reduce((acc, b) => acc + Math.max(0, b.contributionPercent), 0)
                          .toFixed(1)}%)`
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Top Stores Snapshot (100% Google Sheet + Integrated Filters) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-500 text-white">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Top Gerai Ritel
                        </h3>
                        <p className="text-[11px] text-slate-500">Peringkat gerai teraktif sesuai filter</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('store')}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-slate-100 text-xs">
                    {topStores.length > 0 ? (
                      topStores.slice(0, 5).map((store, idx) => {
                        const rankColors = [
                          'bg-amber-100 text-amber-900 border border-amber-300',
                          'bg-slate-200 text-slate-900 border border-slate-300',
                          'bg-orange-100 text-orange-900 border border-orange-300',
                          'bg-blue-50 text-blue-900 border border-blue-200',
                          'bg-slate-100 text-slate-700 border border-slate-200',
                        ];

                        return (
                          <div key={store.name} className="py-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-5 h-5 rounded font-mono text-[10px] font-bold flex items-center justify-center shrink-0 ${rankColors[idx] || rankColors[4]}`}
                              >
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-900 truncate" title={store.name}>
                                {store.name}
                              </span>
                            </div>
                            <div className="text-right shrink-0 tabular-nums">
                              <span className="font-mono font-bold text-slate-900 block text-[11px]">
                                {formatRupiah(store.totalValue, true)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {formatNumber(store.totalQty)} pcs ({formatPercent(store.contributionPercent, false)})
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">
                        Tidak ada transaksi gerai pada filter ini.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">Total Gerai Aktif:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px] tabular-nums">
                    {topStores.length > 0 ? `${topStores.length} Gerai (${topStores[0].name})` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Link to Spreadsheet Raw Data */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Format Tabel Identik dengan Google Sheets
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Tabel data mentah lengkap dengan 20 kolom (TANGGAL, BULAN, TAHUN, BA, SALES, SPV, BRAND, SKU, NAMA STORE, REGION, QTY, VALUE, KET).
                </p>
              </div>
              <button
                onClick={() => setActiveTab('table')}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
              >
                Buka Data Spreadsheet ({filteredRecords.length} Baris)
              </button>
            </div>
          </div>
        )}

        {/* Tab: Rangkuman Kuartal (Executive Summary Sales, BA & Trainer) */}
        {activeTab === 'rangkuman_kuartal' && (
          <QuarterlySummaryView
            records={filteredRecords}
            allRecords={records}
            filters={filters}
          />
        )}

        {/* Tab: Perbandingan (WoW, MoM, YoY) */}
        {activeTab === 'comparison' && (
          <ComparisonView
            records={filteredRecords}
            allRecords={records}
            filters={filters}
          />
        )}

        {/* Tab: Perbandingan Sell In vs Sell Out (Selisih Nilai & Deteksi >20%) */}
        {activeTab === 'sell_in_vs_sell_out' && (
          <SellInVsSellOutView
            records={filteredRecords}
            allRecords={records}
            filters={filters}
            onFilterChange={handleFilterChange}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {/* Tab: Analisa Gap & Penyebab Penjualan Turun */}
        {activeTab === 'gap' && (
          <GapAnalysisView
            diagnosis={gapDiagnosis}
            filters={filters}
            records={records}
            onFilterChange={handleFilterChange}
          />
        )}

        {/* Tab: Estimasi Cost Area (Gaji & Insentif Karyawan) */}
        {activeTab === 'cost' && (
          <CostAreaAnalysis
            records={filteredRecords}
            allRecords={records}
            filters={filters}
          />
        )}

        {/* Tab: Profit Area (P&L, Margin 55%, Biaya 33% & Gaji) */}
        {activeTab === 'profit' && (
          <ProfitAreaAnalysis
            records={filteredRecords}
            allRecords={records}
            filters={filters}
          />
        )}

        {/* Tab: Daftar Tagihan Toko & Aging Piutang */}
        {activeTab === 'aging' && (
          <StoreAgingBills records={records} filters={filters} />
        )}

        {/* Tab: KPI Sales Scorecard (Balanced Scorecard 100 Poin) */}
        {activeTab === 'kpi' && (
          <KpiSalesScorecard filters={filters} />
        )}

        {/* Tab: KPI Trainer Scorecard (Balanced Scorecard 100 Poin) */}
        {activeTab === 'kpi_trainer' && (
          <KpiTrainerScorecard filters={filters} />
        )}

        {/* Tab: Review Weekly Sell Out BA (Cover Sales & Trainer) */}
        {activeTab === 'weekly_ba' && (
          <ReviewWeeklySellOutBa
            records={filteredRecords}
            allRecords={records}
            filters={filters}
          />
        )}

        {/* Tab: Kontribusi Toko BA vs Non-BA */}
        {activeTab === 'kontribusi_toko_ba' && (
          <StoreBaContributionView
            records={filteredRecords}
            allRecords={records}
            filters={filters}
            onNavigateToSettings={() => setActiveTab('pengaturan_master')}
          />
        )}

        {/* Tab: Kelola Sell In KA & DAZZLE ME MG (Central Edit & History) */}
        {activeTab === 'manage_ka_mg' && (
          <CentralKaMgManager
            records={records}
            filters={filters}
            onDataUpdated={() => {
              showToast('Pencapaian Sell In KA & DAZZLE ME MG berhasil diperbarui dan disinkronkan ke seluruh dashboard!');
            }}
          />
        )}

        {/* Tab: Info Keaktifan SDM & Toko (Realtime Google Sheet) */}
        {activeTab === 'info_keaktifan' && (
          <ActivePersonnelStoreInfo
            records={records}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}

        {/* Tab: Pengaturan Master Toko, BA & Sales */}
        {activeTab === 'pengaturan_master' && (
          <MasterStoreBaSettings
            records={records}
            onDataUpdated={() => {
              showToast('Data Master Toko, BA & Sales berhasil disimpan!');
            }}
          />
        )}

        {/* Tab: Punishment BA (Denda Nihil Sell Out Harian Rp 25.000) */}
        {activeTab === 'punishment' && (
          <BaPunishmentView records={filteredRecords} filters={filters} />
        )}

        {/* Tab: Target & Pencapaian Produk Fokus BA (Insentif Rp 2.000 / Denda Rp 1.000) */}
        {activeTab === 'produk_fokus' && (
          <FocusProductBaManagement records={filteredRecords} filters={filters} />
        )}

        {/* Tab: Form Kunjungan Sales (Check-In, Selfie, Maps & Rekap) */}
        {activeTab === 'kunjungan_sales' && (
          <SalesVisitView
            records={records}
            filters={filters}
            onNotify={showToast}
          />
        )}

        {/* Tab: Form Kunjungan Trainer (ARA & RATIH, Selfie, Maps & Rekap) */}
        {activeTab === 'kunjungan_trainer' && (
          <TrainerVisitView
            records={records}
            filters={filters}
            onNotify={showToast}
          />
        )}

        {/* Tab: Report Promo Toko Online */}
        {activeTab === 'promo_toko_online' && (
          <OnlinePromoReportView
            records={records}
            filters={filters}
            onNotify={showToast}
          />
        )}

        {/* Tab: Market Share MissGlam */}
        {activeTab === 'market_share_mg' && (
          <MissGlamMarketShareView
            filters={filters}
            onNotify={showToast}
          />
        )}

        {/* Tab: Kelola Target Terpadu (Area, SPV, Sales & BA) */}
        {activeTab === 'target_mgmt' && (
          <TargetManagementView
            records={filteredRecords}
            allRecords={records}
            filters={filters}
            onTargetUpdated={() => {
              showToast('Perubahan target berhasil disimpan dan disinkronkan ke seluruh menu!');
            }}
          />
        )}

        {/* Tab: Sales */}
        {activeTab === 'sales' && (
          <SalesAnalysis records={filteredRecords} filters={filters} />
        )}

        {/* Tab: SPV */}
        {activeTab === 'spv' && (
          <SpvAnalysis records={filteredRecords} filters={filters} />
        )}

        {/* Tab: Kategori */}
        {activeTab === 'category' && (
          <CategoryAnalysis
            records={filteredRecords}
            selectedCategory={filters.KATEGORI}
            onSelectCategory={(cat) => handleFilterChange('KATEGORI', cat)}
          />
        )}

        {/* Tab: Brand */}
        {activeTab === 'brand' && (
          <BrandAnalysis records={filteredRecords} />
        )}

        {/* Tab: Store */}
        {activeTab === 'store' && (
          <StoreAnalysis records={filteredRecords} />
        )}

        {/* Tab: SKU */}
        {activeTab === 'sku' && (
          <SkuAnalysis records={filteredRecords} />
        )}

        {/* Tab: Table */}
        {activeTab === 'table' && (
          <RawDataTable
            records={filteredRecords}
            filters={filters}
            summary={summary}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SalesPro Analytics</span>
            <span>·</span>
            <span>Platform Analisa Pencapaian Terintegrasi Google Sheets &amp; Apps Script</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsGasModalOpen(true)}
              className="hover:text-slate-800 font-medium transition-colors"
            >
              Pengaturan Google Apps Script
            </button>
            <span>·</span>
            <button
              onClick={handleResetToSample}
              className="hover:text-slate-800 font-medium transition-colors"
            >
              Reset Data Contoh
            </button>
          </div>
        </div>
      </footer>

      {/* Google Apps Script Integration Modal */}
      <GasIntegrationModal
        isOpen={isGasModalOpen}
        onClose={() => setIsGasModalOpen(false)}
        gasConfig={gasConfig}
        onUpdateGasConfig={setGasConfig}
        onDataLoaded={(data, source) => {
          setRecords(data);
          setGasConfig((prev) => ({
            ...prev,
            dataSourceType: source,
            status: source === 'google_sheet' ? 'connected' : 'idle',
            lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
          }));
          showToast(`Berhasil memuat ${data.length} baris data transaksi!`);
        }}
        onResetToSample={handleResetToSample}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddRecord={handleAddRecord}
      />
    </div>
  );
}
