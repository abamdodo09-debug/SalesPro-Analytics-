import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Sparkles,
  Camera,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit2,
  X,
  Save,
  RotateCcw,
  BarChart3,
  Check,
  Users,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  Store,
  Copy,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { TransactionRecord, DashboardFilters } from '../types/dashboard';
import {
  TARGETS_UPDATED_EVENT,
  MONTH_OPTIONS_2026,
  normalizeMonthKey,
  loadMonthlyTargets,
  getExplicitBaTotalTargetOverride,
  loadBaNonLavojoyTargets,
  loadBaLavojoyTargets,
  saveBaNonLavojoyTargets,
  saveBaLavojoyTargets,
  setSingleTargetOverride,
  DEFAULT_BA_LAVOJOY_TARGET,
} from '../services/targetManagementService';

import {
  WeeklyStoreConfig,
  EXCLUDED_ILHAMSYAH_STORES,
  isStoreExcludedFromIlhamsyah,
  DEFAULT_WEEKLY_STORES,
  STORAGE_KEY_WEEKLY_STORES,
  STORAGE_KEY_WEEKLY_DELETED_STORES,
  STORAGE_KEY_WEEKLY_ACTUALS,
  STORAGE_KEY_WEEKLY_PERFORMA,
  STORAGE_KEY_WEEKLY_CUMULATIVE,
} from '../utils/weeklyBaRegistry';

export type { WeeklyStoreConfig };
export {
  EXCLUDED_ILHAMSYAH_STORES,
  isStoreExcludedFromIlhamsyah,
  DEFAULT_WEEKLY_STORES,
};

const INDO_DAY_NAMES = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const MONTH_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

interface ReviewWeeklySellOutBaProps {
  records: TransactionRecord[];
  allRecords?: TransactionRecord[];
  filters: DashboardFilters;
}

export const ReviewWeeklySellOutBa: React.FC<ReviewWeeklySellOutBaProps> = ({
  records,
  allRecords,
  filters,
}) => {
  const sourceRecords = useMemo(() => {
    return allRecords && allRecords.length > 0 ? allRecords : records;
  }, [allRecords, records]);

  const reportRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      const b = filters.BULAN.toUpperCase();
      return b.includes('2026') ? b : `${b} 2026`;
    }
    return 'SEPTEMBER 2026';
  });

  // Week selection: Week 1, Week 2, Week 3, Week 4 (Week 4 & 5 digabung per instruksi user)
  const [selectedWeek, setSelectedWeek] = useState<'WEEK 1' | 'WEEK 2' | 'WEEK 3' | 'WEEK 4' | 'CUSTOM'>('WEEK 2');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Zoom / Scale View (agar muat pas di 1 layar monitor)
  const [viewScale, setViewScale] = useState<number>(1);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Daftar Toko yang Pernah Dihapus / Dikurangi oleh Pengguna
  const [deletedStoreNames, setDeletedStoreNames] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_DELETED_STORES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load deletedStoreNames', e);
    }
    return [];
  });

  // Modal Kelola & Kurangi Toko
  const [isManageStoresModalOpen, setIsManageStoresModalOpen] = useState<boolean>(false);
  const [manageStoresSearch, setManageStoresSearch] = useState<string>('');
  const [manageStoresTab, setManageStoresTab] = useState<'all' | 'active' | 'deleted'>('all');
  const [manageStoresSalesFilter, setManageStoresSalesFilter] = useState<string>('ALL');
  const [workingDeletedStores, setWorkingDeletedStores] = useState<string[]>([]);

  // Store Configuration (Toko Master yang bisa ditambah dan dikurangi)
  const [storesList, setStoresList] = useState<WeeklyStoreConfig[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_STORES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Bersihkan toko ILHAMSYAH yang direvisi untuk dihapus
          return parsed.filter((s: WeeklyStoreConfig) => !isStoreExcludedFromIlhamsyah(s.salesName, s.storeName));
        }
      }
    } catch (e) {
      console.warn('Failed to load storesList from localStorage', e);
    }
    return DEFAULT_WEEKLY_STORES;
  });

  // Filter Coveran Sales (Semua Sales, ALBERT FERNANDO, ILHAMSYAH, TIWI, ABDUL RAHIM, PARETO, LUAR KOTA)
  const [selectedSales, setSelectedSales] = useState<string>(() => {
    return filters.SALES && filters.SALES !== 'ALL' ? filters.SALES : 'ALL';
  });

  // Filter Trainer (ALL, ARA, RATIH, ONLINE)
  const [selectedTrainer, setSelectedTrainer] = useState<string>('ALL');

  // Otomatis sinkron dengan Filter Terintegrasi (Global Filters)
  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      const b = filters.BULAN.toUpperCase();
      setSelectedMonth(b.includes('2026') ? b : `${b} 2026`);
    }
  }, [filters.BULAN]);

  useEffect(() => {
    if (filters.SALES && filters.SALES !== 'ALL') {
      setSelectedSales(filters.SALES);
    } else if (filters.SALES === 'ALL') {
      setSelectedSales('ALL');
    }
  }, [filters.SALES]);

  // Sinkronisasi real-time jika target diubah di Pusat Kelola Target atau menu lain
  const [targetSyncVersion, setTargetSyncVersion] = useState(0);
  useEffect(() => {
    const handleSync = () => setTargetSyncVersion((v) => v + 1);
    window.addEventListener(TARGETS_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Strictly filter Google Sheet records to ONLY SELL OUT transactions (never SELL IN or RETURN)
  const sellOutSourceRecords = useMemo(() => {
    return sourceRecords.filter((r) => {
      const ketUpper = (r.KET || '').trim().toUpperCase();
      if (ketUpper !== 'SELL OUT' && !ketUpper.includes('SELL OUT')) return false;
      if (filters.BRAND && filters.BRAND !== 'ALL' && (r.BRAND || '').trim().toUpperCase() !== filters.BRAND.trim().toUpperCase()) return false;
      if (filters.KATEGORI && filters.KATEGORI !== 'ALL' && (r.KATEGORI || '').trim().toUpperCase() !== filters.KATEGORI.trim().toUpperCase()) return false;
      if (filters.SPV && filters.SPV !== 'ALL' && (r.SPV || '').trim().toUpperCase() !== filters.SPV.trim().toUpperCase()) return false;
      if (filters.SKU && filters.SKU !== 'ALL') {
        const matchSku =
          (r.SKU || '').toLowerCase().includes(filters.SKU.toLowerCase()) ||
          (r.NO_SKU || '').includes(filters.SKU) ||
          (r.SPU || '').toLowerCase().includes(filters.SKU.toLowerCase());
        if (!matchSku) return false;
      }
      return true;
    });
  }, [sourceRecords, filters.BRAND, filters.KATEGORI, filters.SPV, filters.SKU]);

  // Extract distinct sales reps from configured stores and connected Google Sheets Sell Out records
  const availableSales = useMemo(() => {
    const set = new Set<string>();
    storesList.forEach((s) => {
      if (s.salesName && s.salesName !== 'OPERASIONAL') set.add(s.salesName.trim());
    });
    sellOutSourceRecords.forEach((r) => {
      if (r.SALES && r.SALES !== '-' && r.SALES !== 'ALL') set.add(r.SALES.trim());
    });
    return Array.from(set).sort();
  }, [storesList, sellOutSourceRecords]);

  // Master Store List (gabungan default stores, custom added stores, dan stores dari sheets Sell Out)
  const allMasterStores = useMemo(() => {
    const map = new Map<string, WeeklyStoreConfig>();
    const renamedSourceNames = new Set<string>();
    storesList.forEach((s) => {
      if (s.sourceStoreName) {
        renamedSourceNames.add(s.sourceStoreName.trim().toLowerCase());
      }
    });
    DEFAULT_WEEKLY_STORES.forEach((s) => {
      const sLower = s.storeName.trim().toLowerCase();
      if (!renamedSourceNames.has(sLower) && !isStoreExcludedFromIlhamsyah(s.salesName, s.storeName)) {
        map.set(sLower, s);
      }
    });
    storesList.forEach((s) => {
      if (!isStoreExcludedFromIlhamsyah(s.salesName, s.storeName)) {
        map.set(s.storeName.trim().toLowerCase(), s);
      }
    });
    sellOutSourceRecords.forEach((r) => {
      if (!r.NAMA_STORE) return;
      if (isStoreExcludedFromIlhamsyah(r.SALES, r.NAMA_STORE)) return;
      const key = r.NAMA_STORE.trim().toLowerCase();
      if (!map.has(key) && !renamedSourceNames.has(key)) {
        map.set(key, {
          id: `gs-store-${key.replace(/\s+/g, '-')}`,
          storeName: r.NAMA_STORE.trim(),
          baName: r.BA && r.BA !== '-' ? r.BA.trim() : 'BA COUNTER',
          salesName: r.SALES || 'SALES UMUM',
          trainerName: 'ARA',
          coverArea: r.COVER_AREA || 'AREA BARU',
          region: r.REGION || 'PEKAN BARU',
          targetMonthly: 45000000,
        });
      }
    });
    return Array.from(map.values());
  }, [storesList, sellOutSourceRecords]);

  // Active stores filtered by Sales Coveran and Trainer, synchronized with Google Sheets Sell Out data
  const activeStoresList = useMemo(() => {
    const deletedSet = new Set(deletedStoreNames.map((n) => n.trim().toLowerCase()));

    // Exclude any deleted stores and excluded ilhamsyah stores from active list
    let list = storesList.filter(
      (s) => !deletedSet.has(s.storeName.trim().toLowerCase()) && !isStoreExcludedFromIlhamsyah(s.salesName, s.storeName)
    );

    // Priority sync: if Sell Out records from Google Sheet have a matching store with a live BA name, apply it ONLY if user hasn't customized BA
    const sheetBaByStore: Record<string, string> = {};
    sellOutSourceRecords.forEach((r) => {
      if (r.NAMA_STORE && r.BA && r.BA !== '-' && r.BA.toUpperCase() !== 'NON BA' && r.BA.toUpperCase() !== 'STANDBY') {
        sheetBaByStore[r.NAMA_STORE.trim().toLowerCase()] = r.BA.trim();
      }
    });

    list = list.map((s) => {
      if (s.isBaCustom) return s;
      const liveBa = sheetBaByStore[s.storeName.trim().toLowerCase()];
      if (liveBa) {
        return { ...s, baName: liveBa };
      }
      return s;
    });

    // Auto-sync additional stores from connected Google Sheet (Sell Out records only) if present and NOT deleted or renamed
    const existingNames = new Set<string>();
    list.forEach((s) => {
      existingNames.add(s.storeName.trim().toLowerCase());
      if (s.sourceStoreName) {
        existingNames.add(s.sourceStoreName.trim().toLowerCase());
      }
    });
    const extraStores: WeeklyStoreConfig[] = [];

    sellOutSourceRecords.forEach((r) => {
      if (!r.NAMA_STORE) return;
      // Jangan masukkan toko yang dikecualikan dari ILHAMSYAH
      if (isStoreExcludedFromIlhamsyah(r.SALES, r.NAMA_STORE)) return;

      const sLower = r.NAMA_STORE.trim().toLowerCase();
      // JIKA TOKO DIHAPUS/DIKURANGI OLEH PENGGUNA, JANGAN DITAMBAHKAN LAGI!
      if (deletedSet.has(sLower)) return;

      if (!existingNames.has(sLower)) {
        existingNames.add(sLower);
        extraStores.push({
          id: `gs-store-${sLower.replace(/\s+/g, '-')}`,
          storeName: r.NAMA_STORE.trim(),
          baName: r.BA && r.BA !== '-' ? r.BA.trim() : 'BA COUNTER',
          salesName: r.SALES || 'SALES UMUM',
          trainerName: 'ARA',
          coverArea: r.COVER_AREA || 'AREA BARU',
          region: r.REGION || 'PEKAN BARU',
          targetMonthly: 45000000,
        });
      }
    });

    if (extraStores.length > 0) {
      list = [...list, ...extraStores];
    }

    // Apply per-month BA target overrides from Pusat Kelola Target
    list = list.map((s) => {
      let syncedTarget = getExplicitBaTotalTargetOverride(s.storeName, selectedMonth);
      if (syncedTarget === undefined && s.sourceStoreName) {
        syncedTarget = getExplicitBaTotalTargetOverride(s.sourceStoreName, selectedMonth);
      }
      if (syncedTarget !== undefined && syncedTarget >= 0) {
        return { ...s, targetMonthly: syncedTarget };
      }
      return s;
    });

    // Filter by Trainer if selected
    if (selectedTrainer !== 'ALL') {
      list = list.filter(
        (s) => (s.trainerName || '').toUpperCase() === selectedTrainer.toUpperCase()
      );
    }

    // Filter strictly by Sales Coveran if a specific Sales is chosen
    if (selectedSales !== 'ALL') {
      list = list.filter(
        (s) => (s.salesName || '').toLowerCase() === selectedSales.toLowerCase()
      );
    }

    // Filter by Global Region if selected
    if (filters.REGION && filters.REGION !== 'ALL') {
      const reg = filters.REGION.toUpperCase();
      list = list.filter(
        (s) => (s.region || '').toUpperCase() === reg || (s.coverArea || '').toUpperCase() === reg
      );
    }

    // Filter by Global Store Name if selected
    if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL') {
      const st = filters.NAMA_STORE.toUpperCase();
      list = list.filter((s) => (s.storeName || '').toUpperCase() === st);
    }

    // Filter by Global Search Query if present
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.storeName.toLowerCase().includes(q) ||
          s.baName.toLowerCase().includes(q) ||
          s.salesName.toLowerCase().includes(q) ||
          (s.trainerName && s.trainerName.toLowerCase().includes(q)) ||
          (s.coverArea && s.coverArea.toLowerCase().includes(q)) ||
          (s.region && s.region.toLowerCase().includes(q))
      );
    }

    return list;
  }, [storesList, deletedStoreNames, sellOutSourceRecords, selectedSales, selectedTrainer, filters.REGION, filters.NAMA_STORE, filters.searchQuery, selectedMonth, targetSyncVersion]);

  // Custom Daily Sell Out Overrides (Key: `${storeName}_${dateKey}`)
  const [customDailyActuals, setCustomDailyActuals] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_ACTUALS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load customDailyActuals', e);
    }
    return {};
  });

  // Custom Performa BA Overrides (Key: storeName -> % kontribusi)
  const [customPerformaBa, setCustomPerformaBa] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_PERFORMA);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load customPerformaBa', e);
    }
    return {};
  });

  // Custom Cumulative Overrides (Key: storeName -> nominal)
  const [customCumulative, setCustomCumulative] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WEEKLY_CUMULATIVE);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load customCumulative', e);
    }
    return {};
  });

  // Persen Target State (Default 100% per user request: di Week 2 dirubah dari 48% jadi 100%)
  const [customPersenTarget, setCustomPersenTarget] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('salespro_weekly_persen_target');
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load customPersenTarget', e);
    }
    return 100; // Default 100%
  });
  const [isEditingPersenTarget, setIsEditingPersenTarget] = useState(false);
  const [inputPersenTarget, setInputPersenTarget] = useState(100);

  // Screenshot Preview State
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);

  // Modal Editing Store Target / Values
  const [editingStore, setEditingStore] = useState<WeeklyStoreConfig | null>(null);
  const [editTargetMonth, setEditTargetMonth] = useState<string>('SEPTEMBER 2026');
  const [editTargetNonLavojoy, setEditTargetNonLavojoy] = useState<number>(40000000);
  const [editTargetLavojoy, setEditTargetLavojoy] = useState<number>(DEFAULT_BA_LAVOJOY_TARGET);
  const [editTargetMonthly, setEditTargetMonthly] = useState<number>(45000000);
  const [editStoreName, setEditStoreName] = useState<string>('');
  const [editBaName, setEditBaName] = useState<string>('');
  const [editSalesName, setEditSalesName] = useState<string>('');
  const [editTrainerName, setEditTrainerName] = useState<string>('');
  const [editCoverArea, setEditCoverArea] = useState<string>('');
  const [editRegion, setEditRegion] = useState<string>('');
  const [editPerformaVal, setEditPerformaVal] = useState<number>(0);
  const [editCumulativeVal, setEditCumulativeVal] = useState<number>(0);

  // Modal Pengaturan Target BA + Lavojoy per Bulan
  const [isMonthlyTargetModalOpen, setIsMonthlyTargetModalOpen] = useState<boolean>(false);
  const [monthlyTargetEditMonth, setMonthlyTargetEditMonth] = useState<string>('SEPTEMBER 2026');
  const [monthlyTargetCopyFrom, setMonthlyTargetCopyFrom] = useState<string>('SEPTEMBER 2026');
  const [monthlyTargetSearch, setMonthlyTargetSearch] = useState<string>('');
  const [monthlyTargetSalesFilter, setMonthlyTargetSalesFilter] = useState<string>('ALL');
  const [monthlyTargetDrafts, setMonthlyTargetDrafts] = useState<
    Record<string, { nonLavojoy: number; lavojoy: number }>
  >({});

  // Modal Tambah Kolom Toko Baru
  const [isAddingStore, setIsAddingStore] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newBaName, setNewBaName] = useState<string>('');
  const [newSalesName, setNewSalesName] = useState<string>('ALBERT FERNANDO');
  const [newTrainerName, setNewTrainerName] = useState<string>('ARA');
  const [newCoverArea, setNewCoverArea] = useState<string>('PEKANBARU');
  const [newRegion, setNewRegion] = useState<string>('PEKAN BARU');
  const [newTargetMonthly, setNewTargetMonthly] = useState<number>(45000000);
  const [newCumulativeVal, setNewCumulativeVal] = useState<number>(0);
  const [newPerformaVal, setNewPerformaVal] = useState<number>(0);

  // Quick Inline Edit Cell
  const [inlineEditCell, setInlineEditCell] = useState<{ storeName: string; dateKey: string; currentVal: number } | null>(null);
  const [inlineInputVal, setInlineInputVal] = useState<string>('');

  // Modal Edit Pencapaian Kumulatif Progresif (Week 1, Week 2, Week 3, Week 4)
  const [editingCumulativeModal, setEditingCumulativeModal] = useState<{
    store: WeeklyStoreConfig;
    selectedWeekTab: 'WEEK 1' | 'WEEK 2' | 'WEEK 3' | 'WEEK 4';
  } | null>(null);
  const [cumulativeInputVal, setCumulativeInputVal] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Month parse: year and month index
  const { year, monthIdx } = useMemo(() => {
    const parts = selectedMonth.trim().split(' ');
    const mName = parts[0].toUpperCase();
    const yr = parts[1] ? parseInt(parts[1], 10) : 2026;
    const mIdx = MONTH_NAMES.indexOf(mName) !== -1 ? MONTH_NAMES.indexOf(mName) : 8; // Default September = 8
    return { year: isNaN(yr) ? 2026 : yr, monthIdx: mIdx };
  }, [selectedMonth]);

  // Total days in active month
  const totalDaysInMonth = useMemo(() => {
    return new Date(year, monthIdx + 1, 0).getDate();
  }, [year, monthIdx]);

  // Active days list based on selected week
  const activeDaysList = useMemo(() => {
    let startDay = 1;
    let endDay = 7;

    if (selectedWeek === 'WEEK 1') {
      startDay = 1;
      endDay = 7;
    } else if (selectedWeek === 'WEEK 2') {
      startDay = 8;
      endDay = 14;
    } else if (selectedWeek === 'WEEK 3') {
      startDay = 15;
      endDay = 21;
    } else if (selectedWeek === 'WEEK 4') {
      // Week 4 & Week 5 digabung: 22 s/d akhir bulan (30 atau 31)
      startDay = 22;
      endDay = totalDaysInMonth;
    } else if (selectedWeek === 'CUSTOM' && dateFrom && dateTo) {
      const fParts = dateFrom.split('-').map((n) => parseInt(n, 10));
      const tParts = dateTo.split('-').map((n) => parseInt(n, 10));
      if (fParts.length === 3 && tParts.length === 3 && !isNaN(fParts[2]) && !isNaN(tParts[2])) {
        startDay = Math.max(1, Math.min(31, fParts[2]));
        endDay = Math.max(startDay, Math.min(31, tParts[2]));
      }
    }

    const list: { dayNum: number; dayLabel: string; dateStr: string; dateKey: string }[] = [];
    for (let d = startDay; d <= Math.min(endDay, totalDaysInMonth); d++) {
      const dt = new Date(year, monthIdx, d);
      const dayName = INDO_DAY_NAMES[dt.getDay()];
      const dayNumStr = d.toString().padStart(2, '0');
      // Format (DD) HARI, e.g. (08) SELASA, (09) RABU
      const dayLabel = `(${dayNumStr}) ${dayName}`;
      const monthNumStr = (monthIdx + 1).toString().padStart(2, '0');
      const dateKey = `${year}-${monthNumStr}-${dayNumStr}`;
      const dateStr = `${d} ${MONTH_NAMES[monthIdx]}`;
      list.push({ dayNum: d, dayLabel, dateStr, dateKey });
    }
    return list;
  }, [selectedWeek, year, monthIdx, totalDaysInMonth, dateFrom, dateTo]);

  // Label for current week range, e.g. "WEEK 2 (08-14)"
  const weekRangeLabel = useMemo(() => {
    if (activeDaysList.length === 0) return 'WEEK';
    const first = activeDaysList[0].dayNum.toString().padStart(2, '0');
    const last = activeDaysList[activeDaysList.length - 1].dayNum.toString().padStart(2, '0');
    return `${selectedWeek} (${first}-${last})`;
  }, [activeDaysList, selectedWeek]);

  // Helper to normalize store names for flexible matching against Google Sheet data
  const normalizeStore = (name: string): string => {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const parseRecordDateParts = (r: TransactionRecord): { rYear: number; rMonth: number; rDay: number } | null => {
    if (!r.TANGGAL) return null;
    let rYear = r.TAHUN || 2026;
    const expectedMonth = MONTH_NAMES.indexOf((r.BULAN || '').trim().toUpperCase()) + 1;
    let rMonth = expectedMonth > 0 ? expectedMonth : monthIdx + 1;
    let rDay = 1;

    const trimmedDate = r.TANGGAL.trim();
    const parts = trimmedDate.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        rYear = parseInt(parts[0], 10);
        rMonth = parseInt(parts[1], 10);
        rDay = parseInt(parts[2], 10);
      } else {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (p2 > 1000) {
          rYear = p2;
          if (expectedMonth > 0) {
            if (p0 === expectedMonth && p1 >= 1 && p1 <= 31) {
              rMonth = p0;
              rDay = p1;
            } else if (p1 === expectedMonth && p0 >= 1 && p0 <= 31) {
              rDay = p0;
              rMonth = p1;
            } else if (p0 <= 12 && p1 <= 31) {
              rMonth = p0;
              rDay = p1;
            } else {
              rDay = p0;
              rMonth = p1;
            }
          } else if (p0 <= 12 && p1 <= 31) {
            rMonth = p0;
            rDay = p1;
          } else {
            rDay = p0;
            rMonth = p1;
          }
        }
      }
      return { rYear, rMonth, rDay };
    }
    return null;
  };

  // Transaction Map for fast lookup by store & date (STRICTLY SELL OUT ONLY from connected Google Sheet)
  const transactionsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of sellOutSourceRecords) {
      if (!r.TANGGAL || !r.NAMA_STORE) continue;
      const parsed = parseRecordDateParts(r);
      if (!parsed) continue;
      const { rYear, rMonth, rDay } = parsed;

      if (rYear === year && rMonth === monthIdx + 1) {
        const val = r.VALUE || 0;
        const sLower = r.NAMA_STORE.trim().toLowerCase();
        const sNorm = normalizeStore(r.NAMA_STORE);

        // Store by exact lowercase name + day
        const keyExact = `${sLower}_${rDay}`;
        map[keyExact] = (map[keyExact] || 0) + val;

        // Store by normalized alphanumeric name + day
        const keyNorm = `${sNorm}_${rDay}`;
        map[keyNorm] = (map[keyNorm] || 0) + val;

        // Store by formatted dateKey (YYYY-MM-DD)
        const dateKey = `${rYear}-${String(rMonth).padStart(2, '0')}-${String(rDay).padStart(2, '0')}`;
        map[`date_${sLower}_${dateKey}`] = (map[`date_${sLower}_${dateKey}`] || 0) + val;
        map[`date_${sNorm}_${dateKey}`] = (map[`date_${sNorm}_${dateKey}`] || 0) + val;
      }
    }
    return map;
  }, [sellOutSourceRecords, year, monthIdx]);

  // Helper to get Sell Out on a specific day for a store (ONLY Google Sheet SELL OUT or manual edit; empty/0 if no data)
  const getDailySellOut = (store: WeeklyStoreConfig, dayNum: number, dateKey: string): number => {
    // 1. Check custom user edit override
    const overrideKey = `${store.storeName}_${dateKey}`;
    if (customDailyActuals[overrideKey] !== undefined) {
      return customDailyActuals[overrideKey];
    }

    // 2. Direct lookup in synced Google Sheet SELL OUT transaction records (by dateKey and by day)
    const lookupStoreNames = [store.storeName];
    if (store.sourceStoreName && store.sourceStoreName.trim().toUpperCase() !== store.storeName.trim().toUpperCase()) {
      lookupStoreNames.push(store.sourceStoreName);
    }

    for (const sName of lookupStoreNames) {
      const txKeyExact = `${sName.trim().toLowerCase()}_${dayNum}`;
      const txKeyNorm = `${normalizeStore(sName)}_${dayNum}`;
      const txDateExact = `date_${sName.trim().toLowerCase()}_${dateKey}`;
      const txDateNorm = `date_${normalizeStore(sName)}_${dateKey}`;

      const sheetVal =
        transactionsMap[txDateExact] ??
        transactionsMap[txDateNorm] ??
        transactionsMap[txKeyExact] ??
        transactionsMap[txKeyNorm];

      if (sheetVal !== undefined && sheetVal > 0) {
        return sheetVal;
      }
    }

    // 3. Jika di tanggal tersebut tidak ada pencapaian Sell Out di Google Sheet, kosongkan (0)
    return 0;
  };

  // Grand totals & matrix calculations (scoped to activeStoresList according to Sales Coveran)
  const calculationData = useMemo(() => {
    // 1. Total Target Monthly for covered stores
    const totalTargetMonthly = activeStoresList.reduce((acc, s) => acc + s.targetMonthly, 0);

    // 2. Total Target Harian (Target / 30)
    const storeDailyTargets: Record<string, number> = {};
    activeStoresList.forEach((s) => {
      storeDailyTargets[s.storeName] = Math.round(s.targetMonthly / 30);
    });
    const totalTargetHarian = Object.values(storeDailyTargets).reduce((acc, val) => acc + val, 0);

    // 3. Target Penjualan 1 Minggu = Total Target Harian * jumlah hari di minggu ini
    const daysCount = activeDaysList.length || 7;
    const targetPenjualanMingguan = totalTargetHarian * daysCount;

    // 4. Matrix of Daily Actuals
    const matrix: Record<string, Record<number, number>> = {};
    const storeWeeklyTotals: Record<string, number> = {};
    const dailyTotals: Record<number, number> = {};

    activeDaysList.forEach((d) => {
      dailyTotals[d.dayNum] = 0;
    });

    activeStoresList.forEach((s) => {
      matrix[s.storeName] = {};
      let sTotal = 0;
      activeDaysList.forEach((d) => {
        const val = getDailySellOut(s, d.dayNum, d.dateKey);
        matrix[s.storeName][d.dayNum] = val;
        sTotal += val;
        dailyTotals[d.dayNum] = (dailyTotals[d.dayNum] || 0) + val;
      });
      storeWeeklyTotals[s.storeName] = sTotal;
    });

    // 5. Grand Total Actual Sell Out this week for active coveran
    const grandTotalActual = Object.values(storeWeeklyTotals).reduce((acc, v) => acc + v, 0);

    // 6. Presentase Capaian per Store vs Target Minggu
    const storePercentages: Record<string, number> = {};
    activeStoresList.forEach((s) => {
      const storeTargetMingguan = (storeDailyTargets[s.storeName] || 1) * daysCount;
      const act = storeWeeklyTotals[s.storeName] || 0;
      storePercentages[s.storeName] = storeTargetMingguan > 0 ? (act / storeTargetMingguan) * 100 : 0;
    });

    // 7. Peforma BA = Persentase Kontribusi Toko terhadap Total Penjualan Coveran Minggu Ini
    const storePerforma: Record<string, number> = {};
    activeStoresList.forEach((s) => {
      if (customPerformaBa[s.storeName] !== undefined) {
        storePerforma[s.storeName] = customPerformaBa[s.storeName];
      } else {
        const act = storeWeeklyTotals[s.storeName] || 0;
        storePerforma[s.storeName] = grandTotalActual > 0 ? Math.round((act / grandTotalActual) * 100) : 0;
      }
    });

    // Helper untuk menghitung total sell out toko pada rentang hari tertentu
    const getWeekRangeSum = (store: WeeklyStoreConfig, startDay: number, endDay: number) => {
      let sum = 0;
      const maxDay = Math.min(endDay, totalDaysInMonth);
      for (let d = startDay; d <= maxDay; d++) {
        const dayNumStr = d.toString().padStart(2, '0');
        const monthNumStr = (monthIdx + 1).toString().padStart(2, '0');
        const dateKey = `${year}-${monthNumStr}-${dayNumStr}`;
        sum += getDailySellOut(store, d, dateKey);
      }
      return sum;
    };

    // Helper untuk mengecek nilai override kumulatif yang diedit pengguna
    const getCumulativeOverride = (storeName: string, week: string): number | undefined => {
      const mPrefix = selectedMonth.trim().toUpperCase();
      const k1 = `${mPrefix}_${week}_${storeName}`;
      const k2 = `${week}_${storeName}`;
      if (customCumulative[k1] !== undefined) return customCumulative[k1];
      if (customCumulative[k2] !== undefined) return customCumulative[k2];
      // Fallback untuk backward-compatibility jika week aktif sama dengan selectedWeek
      if (week === selectedWeek && customCumulative[storeName] !== undefined) {
        return customCumulative[storeName];
      }
      return undefined;
    };

    // 8. Pencapaian Week Kumulatif dengan Formula Progresif per Toko:
    // Week 1 (01-07): Total pencapaian toko dari tgl 01 sampai 07
    // Week 2 (08-14): Total Week 1 + Total Week 2 toko
    // Week 3 (15-21): Pencapaian Week 2 + Total Week 3 toko
    // Week 4 (22-30/31): Pencapaian Week 3 + Total Week 4 toko
    // Semua tahapan bisa diedit manual dan disimpan di localStorage
    const storeCumulativeToDate: Record<string, number> = {};
    const isStoreCustomCumulative: Record<string, boolean> = {};
    const storeWeeklyBreakdowns: Record<
      string,
      {
        w1Actual: number;
        w1Pencapaian: number;
        isW1Custom: boolean;
        w2Actual: number;
        w2Formula: number;
        w2Pencapaian: number;
        isW2Custom: boolean;
        w3Actual: number;
        w3Formula: number;
        w3Pencapaian: number;
        isW3Custom: boolean;
        w4Actual: number;
        w4Formula: number;
        w4Pencapaian: number;
        isW4Custom: boolean;
      }
    > = {};

    activeStoresList.forEach((s) => {
      // 1. Total actual per week range
      const w1Actual = getWeekRangeSum(s, 1, 7);
      const w2Actual = getWeekRangeSum(s, 8, 14);
      const w3Actual = getWeekRangeSum(s, 15, 21);
      const w4Actual = getWeekRangeSum(s, 22, totalDaysInMonth);

      // Check overrides per week
      const overrideW1 = getCumulativeOverride(s.storeName, 'WEEK 1');
      const isW1Custom = overrideW1 !== undefined;
      const w1Pencapaian = overrideW1 !== undefined ? overrideW1 : w1Actual;

      const overrideW2 = getCumulativeOverride(s.storeName, 'WEEK 2');
      const isW2Custom = overrideW2 !== undefined;
      const w2Formula = w1Pencapaian + w2Actual;
      const w2Pencapaian = overrideW2 !== undefined ? overrideW2 : w2Formula;

      const overrideW3 = getCumulativeOverride(s.storeName, 'WEEK 3');
      const isW3Custom = overrideW3 !== undefined;
      const w3Formula = w2Pencapaian + w3Actual;
      const w3Pencapaian = overrideW3 !== undefined ? overrideW3 : w3Formula;

      const overrideW4 = getCumulativeOverride(s.storeName, 'WEEK 4');
      const isW4Custom = overrideW4 !== undefined;
      const w4Formula = w3Pencapaian + w4Actual;
      const w4Pencapaian = overrideW4 !== undefined ? overrideW4 : w4Formula;

      storeWeeklyBreakdowns[s.storeName] = {
        w1Actual,
        w1Pencapaian,
        isW1Custom,
        w2Actual,
        w2Formula,
        w2Pencapaian,
        isW2Custom,
        w3Actual,
        w3Formula,
        w3Pencapaian,
        isW3Custom,
        w4Actual,
        w4Formula,
        w4Pencapaian,
        isW4Custom,
      };

      // Tentukan nilai kumulatif untuk periode week yang sedang aktif
      if (selectedWeek === 'WEEK 1') {
        storeCumulativeToDate[s.storeName] = w1Pencapaian;
        isStoreCustomCumulative[s.storeName] = isW1Custom;
      } else if (selectedWeek === 'WEEK 2') {
        storeCumulativeToDate[s.storeName] = w2Pencapaian;
        isStoreCustomCumulative[s.storeName] = isW2Custom;
      } else if (selectedWeek === 'WEEK 3') {
        storeCumulativeToDate[s.storeName] = w3Pencapaian;
        isStoreCustomCumulative[s.storeName] = isW3Custom;
      } else if (selectedWeek === 'WEEK 4') {
        storeCumulativeToDate[s.storeName] = w4Pencapaian;
        isStoreCustomCumulative[s.storeName] = isW4Custom;
      } else {
        // CUSTOM range: kumulatif dari hari 1 s/d hari terakhir di filter
        const lastDay = activeDaysList.length > 0 ? activeDaysList[activeDaysList.length - 1].dayNum : totalDaysInMonth;
        const customSum = getWeekRangeSum(s, 1, lastDay);
        const overrideCustom = getCumulativeOverride(s.storeName, 'CUSTOM');
        storeCumulativeToDate[s.storeName] = overrideCustom !== undefined ? overrideCustom : customSum;
        isStoreCustomCumulative[s.storeName] = overrideCustom !== undefined;
      }
    });

    const totalCumulativeToDate = Object.values(storeCumulativeToDate).reduce((acc, v) => acc + v, 0);

    // 9. Persen Target & Persentase Pencapaian
    const persentasePencapaianMingguan =
      targetPenjualanMingguan > 0 ? Math.round((grandTotalActual / targetPenjualanMingguan) * 100) : 0;
    const persenTarget = customPersenTarget !== null ? customPersenTarget : 100;

    return {
      totalTargetMonthly,
      storeDailyTargets,
      totalTargetHarian,
      targetPenjualanMingguan,
      matrix,
      storeWeeklyTotals,
      dailyTotals,
      grandTotalActual,
      storePercentages,
      storePerforma,
      storeCumulativeToDate,
      totalCumulativeToDate,
      isStoreCustomCumulative,
      storeWeeklyBreakdowns,
      persenTarget,
      persentasePencapaianMingguan,
    };
  }, [
    activeStoresList,
    activeDaysList,
    customDailyActuals,
    customPerformaBa,
    customCumulative,
    customPersenTarget,
    selectedWeek,
    selectedMonth,
    transactionsMap,
    totalDaysInMonth,
    year,
    monthIdx,
  ]);

  // Resolve baseline/monthly Target BA Non-Lavojoy & Lavojoy for a given store and month
  const getStoreMonthlyTargetBreakdown = (
    store: WeeklyStoreConfig,
    monthLabel: string
  ): { nonLavojoy: number; lavojoy: number; total: number } => {
    const upperStore = store.storeName.trim().toUpperCase();
    const defaultStore = DEFAULT_WEEKLY_STORES.find(
      (d) => d.storeName.trim().toUpperCase() === upperStore
    );
    const baseTotal = defaultStore ? defaultStore.targetMonthly : store.targetMonthly;

    const nonTargets = loadBaNonLavojoyTargets(monthLabel);
    const lavTargets = loadBaLavojoyTargets(monthLabel);
    const nonKey = Object.keys(nonTargets).find((k) => k.trim().toUpperCase() === upperStore);
    const lavKey = Object.keys(lavTargets).find((k) => k.trim().toUpperCase() === upperStore);

    if (nonKey !== undefined || lavKey !== undefined) {
      const lavojoy = lavKey !== undefined ? lavTargets[lavKey] : DEFAULT_BA_LAVOJOY_TARGET;
      const nonLavojoy =
        nonKey !== undefined
          ? nonTargets[nonKey]
          : Math.max(0, baseTotal - lavojoy);
      return { nonLavojoy, lavojoy, total: nonLavojoy + lavojoy };
    }

    const lavojoy = Math.min(DEFAULT_BA_LAVOJOY_TARGET, baseTotal);
    const nonLavojoy = Math.max(0, baseTotal - lavojoy);
    return { nonLavojoy, lavojoy, total: baseTotal };
  };

  // All non-deleted stores for per-month Target BA + Lavojoy configuration
  const allConfigurableStores = useMemo(() => {
    const deletedSet = new Set(deletedStoreNames.map((n) => n.trim().toLowerCase()));
    return allMasterStores.filter(
      (s) => !deletedSet.has(s.storeName.trim().toLowerCase()) && !isStoreExcludedFromIlhamsyah(s.salesName, s.storeName)
    );
  }, [allMasterStores, deletedStoreNames]);

  const buildMonthlyTargetDrafts = (monthLabel: string): Record<string, { nonLavojoy: number; lavojoy: number }> => {
    const drafts: Record<string, { nonLavojoy: number; lavojoy: number }> = {};
    allConfigurableStores.forEach((s) => {
      const bd = getStoreMonthlyTargetBreakdown(s, monthLabel);
      drafts[s.storeName] = { nonLavojoy: bd.nonLavojoy, lavojoy: bd.lavojoy };
    });
    return drafts;
  };

  const handleOpenMonthlyTargetModal = (targetMonth?: string) => {
    const m = targetMonth || selectedMonth;
    setMonthlyTargetEditMonth(m);
    setMonthlyTargetCopyFrom(m === 'SEPTEMBER 2026' ? 'OKTOBER 2026' : 'SEPTEMBER 2026');
    setMonthlyTargetSearch('');
    setMonthlyTargetSalesFilter('ALL');
    setMonthlyTargetDrafts(buildMonthlyTargetDrafts(m));
    setIsMonthlyTargetModalOpen(true);
  };

  const handleSwitchMonthlyTargetModalMonth = (nextMonth: string) => {
    setMonthlyTargetEditMonth(nextMonth);
    setMonthlyTargetDrafts(buildMonthlyTargetDrafts(nextMonth));
  };

  const handleCopyMonthlyTargetsFrom = (sourceMonth: string) => {
    if (!sourceMonth) return;
    setMonthlyTargetDrafts(buildMonthlyTargetDrafts(sourceMonth));
    showToast(`Draft target disalin dari bulan ${sourceMonth}. Klik Simpan untuk menerapkan ke ${monthlyTargetEditMonth}!`);
  };

  const handleResetMonthlyTargetDrafts = () => {
    const resetDrafts: Record<string, { nonLavojoy: number; lavojoy: number }> = {};
    allConfigurableStores.forEach((s) => {
      const defaultStore = DEFAULT_WEEKLY_STORES.find(
        (d) => d.storeName.trim().toUpperCase() === s.storeName.trim().toUpperCase()
      );
      const baseTotal = defaultStore ? defaultStore.targetMonthly : s.targetMonthly;
      const lav = Math.min(DEFAULT_BA_LAVOJOY_TARGET, baseTotal);
      const non = Math.max(0, baseTotal - lav);
      resetDrafts[s.storeName] = { nonLavojoy: non, lavojoy: lav };
    });
    setMonthlyTargetDrafts(resetDrafts);
    showToast(`Draft bulan ${monthlyTargetEditMonth} dikembalikan ke target baseline default!`);
  };

  const handleSaveMonthlyTargets = () => {
    const nonMap: Record<string, number> = {};
    const lavMap: Record<string, number> = {};
    Object.entries(monthlyTargetDrafts).forEach(([storeName, vals]) => {
      nonMap[storeName] = Math.max(0, Number(vals.nonLavojoy) || 0);
      lavMap[storeName] = Math.max(0, Number(vals.lavojoy) || 0);
    });
    saveBaNonLavojoyTargets(nonMap, monthlyTargetEditMonth);
    saveBaLavojoyTargets(lavMap, monthlyTargetEditMonth);
    setSelectedMonth(monthlyTargetEditMonth);
    setIsMonthlyTargetModalOpen(false);
    showToast(`Target BA + Lavojoy bulan ${monthlyTargetEditMonth} berhasil disimpan (${Object.keys(nonMap).length} toko)!`);
  };

  // Open Edit Store Modal
  const handleOpenEditStore = (store: WeeklyStoreConfig) => {
    setEditingStore(store);
    setEditTargetMonth(selectedMonth);
    const bd = getStoreMonthlyTargetBreakdown(store, selectedMonth);
    setEditTargetNonLavojoy(bd.nonLavojoy);
    setEditTargetLavojoy(bd.lavojoy);
    setEditTargetMonthly(bd.total);
    setEditStoreName(store.storeName);
    setEditBaName(store.baName);
    setEditSalesName(store.salesName || 'ALBERT FERNANDO');
    setEditTrainerName(store.trainerName || 'ARA');
    setEditCoverArea(store.coverArea || 'PEKANBARU');
    setEditRegion(store.region || 'PEKAN BARU');
    setEditPerformaVal(calculationData.storePerforma[store.storeName] || 0);
    setEditCumulativeVal(calculationData.storeCumulativeToDate[store.storeName] || 0);
  };

  // Save Store Edit (metadata saved to store list; target saved strictly per chosen month!)
  const handleSaveEditStore = () => {
    if (!editingStore) return;
    const oldStoreName = editingStore.storeName;
    const targetStoreName = editStoreName.trim().toUpperCase() || oldStoreName;
    const targetBaName = editBaName.trim().toUpperCase() || editingStore.baName;
    const targetSalesName = editSalesName.trim().toUpperCase() || editingStore.salesName;
    const targetTrainerName = editTrainerName.trim().toUpperCase() || editingStore.trainerName;
    const targetCoverArea = editCoverArea.trim().toUpperCase() || editingStore.coverArea;
    const targetRegion = editRegion.trim().toUpperCase() || editingStore.region;

    const cleanNon = Math.max(0, Number(editTargetNonLavojoy) || 0);
    const cleanLav = Math.max(0, Number(editTargetLavojoy) || 0);
    const newTargetMonthly = cleanNon + cleanLav;

    const isStoreRenamed = targetStoreName.trim().toUpperCase() !== oldStoreName.trim().toUpperCase();
    const resolvedSourceStoreName =
      editingStore.sourceStoreName || (isStoreRenamed ? oldStoreName : undefined);

    let foundInList = false;
    const updated = storesList.map((s) => {
      if (s.id === editingStore.id || s.storeName.trim().toUpperCase() === oldStoreName.trim().toUpperCase()) {
        foundInList = true;
        return {
          ...s,
          storeName: targetStoreName,
          sourceStoreName: resolvedSourceStoreName || s.sourceStoreName,
          baName: targetBaName,
          isBaCustom: true,
          salesName: targetSalesName,
          trainerName: targetTrainerName,
          coverArea: targetCoverArea,
          region: targetRegion,
          targetMonthly: newTargetMonthly,
        };
      }
      return s;
    });

    if (!foundInList) {
      updated.push({
        ...editingStore,
        storeName: targetStoreName,
        sourceStoreName: resolvedSourceStoreName,
        baName: targetBaName,
        isBaCustom: true,
        salesName: targetSalesName,
        trainerName: targetTrainerName,
        coverArea: targetCoverArea,
        region: targetRegion,
        targetMonthly: newTargetMonthly,
      });
    }

    setStoresList(updated);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_STORES, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

    // Ensure target store name is not blocked in deletedStoreNames
    const targetLower = targetStoreName.trim().toLowerCase();
    if (deletedStoreNames.some((n) => n.trim().toLowerCase() === targetLower)) {
      const cleanedDeleted = deletedStoreNames.filter((n) => n.trim().toLowerCase() !== targetLower);
      setDeletedStoreNames(cleanedDeleted);
      try {
        localStorage.setItem(STORAGE_KEY_WEEKLY_DELETED_STORES, JSON.stringify(cleanedDeleted));
      } catch (e) {
        console.warn(e);
      }
    }

    // Migrate custom daily actuals if store was renamed
    if (isStoreRenamed) {
      const oldPrefix = `${oldStoreName}_`;
      const newPrefix = `${targetStoreName}_`;
      let actualsChanged = false;
      const migratedActuals: Record<string, number> = { ...customDailyActuals };
      Object.keys(migratedActuals).forEach((k) => {
        if (k.startsWith(oldPrefix)) {
          const suffix = k.slice(oldPrefix.length);
          migratedActuals[`${newPrefix}${suffix}`] = migratedActuals[k];
          delete migratedActuals[k];
          actualsChanged = true;
        }
      });
      if (actualsChanged) {
        setCustomDailyActuals(migratedActuals);
        try {
          localStorage.setItem(STORAGE_KEY_WEEKLY_ACTUALS, JSON.stringify(migratedActuals));
        } catch (e) {
          console.warn(e);
        }
      }
    }

    if (editPerformaVal >= 0) {
      const newPerforma = { ...customPerformaBa, [targetStoreName]: editPerformaVal };
      if (isStoreRenamed) {
        delete newPerforma[oldStoreName];
      }
      setCustomPerformaBa(newPerforma);
      try {
        localStorage.setItem(STORAGE_KEY_WEEKLY_PERFORMA, JSON.stringify(newPerforma));
      } catch (e) {
        console.warn(e);
      }
    }

    if (editCumulativeVal >= 0) {
      const newCum = { ...customCumulative };
      if (isStoreRenamed) {
        // Migrate any existing cumulative overrides from old store name
        const oldSuffix = `_${oldStoreName}`;
        Object.keys(newCum).forEach((k) => {
          if (k.endsWith(oldSuffix)) {
            const prefix = k.slice(0, k.length - oldSuffix.length);
            newCum[`${prefix}_${targetStoreName}`] = newCum[k];
            delete newCum[k];
          }
        });
        delete newCum[oldStoreName];
      }
      const activeWeekKey = `${selectedWeek}_${targetStoreName}`;
      const monthWeekKey = `${editTargetMonth.trim().toUpperCase()}_${selectedWeek}_${targetStoreName}`;
      newCum[targetStoreName] = editCumulativeVal;
      newCum[activeWeekKey] = editCumulativeVal;
      newCum[monthWeekKey] = editCumulativeVal;
      setCustomCumulative(newCum);
      try {
        localStorage.setItem(STORAGE_KEY_WEEKLY_CUMULATIVE, JSON.stringify(newCum));
      } catch (e) {
        console.warn(e);
      }
    }

    // Always save BA target breakdown for the chosen month under targetStoreName
    setSingleTargetOverride('baNonLavojoy', targetStoreName, cleanNon, editTargetMonth);
    setSingleTargetOverride('baLavojoy', targetStoreName, cleanLav, editTargetMonth);

    if (editTargetMonth !== selectedMonth) {
      setSelectedMonth(editTargetMonth);
    }

    setTargetSyncVersion((v) => v + 1);
    window.dispatchEvent(new Event('weekly_ba_stores_updated'));

    setEditingStore(null);
    showToast(`Perubahan ${targetStoreName} (BA: ${targetBaName}, Target ${editTargetMonth}) berhasil disimpan!`);
  };

  // Buka Modal Edit Pencapaian Kumulatif Progresif
  const handleOpenCumulativeModal = (store: WeeklyStoreConfig, targetWeek?: 'WEEK 1' | 'WEEK 2' | 'WEEK 3' | 'WEEK 4') => {
    const weekTab = targetWeek || ((selectedWeek === 'CUSTOM' ? 'WEEK 2' : selectedWeek) as 'WEEK 1' | 'WEEK 2' | 'WEEK 3' | 'WEEK 4');
    setEditingCumulativeModal({
      store,
      selectedWeekTab: weekTab,
    });
    const breakdown = calculationData.storeWeeklyBreakdowns?.[store.storeName];
    let valForTab = calculationData.storeCumulativeToDate[store.storeName] || 0;
    if (breakdown) {
      if (weekTab === 'WEEK 1') valForTab = breakdown.w1Pencapaian;
      else if (weekTab === 'WEEK 2') valForTab = breakdown.w2Pencapaian;
      else if (weekTab === 'WEEK 3') valForTab = breakdown.w3Pencapaian;
      else if (weekTab === 'WEEK 4') valForTab = breakdown.w4Pencapaian;
    }
    setCumulativeInputVal(valForTab);
  };

  // Ganti Tab Week di dalam Modal Pencapaian Kumulatif
  const handleSwitchCumulativeTab = (tab: 'WEEK 1' | 'WEEK 2' | 'WEEK 3' | 'WEEK 4') => {
    if (!editingCumulativeModal) return;
    const store = editingCumulativeModal.store;
    const breakdown = calculationData.storeWeeklyBreakdowns?.[store.storeName];
    let valForTab = 0;
    if (breakdown) {
      if (tab === 'WEEK 1') valForTab = breakdown.w1Pencapaian;
      else if (tab === 'WEEK 2') valForTab = breakdown.w2Pencapaian;
      else if (tab === 'WEEK 3') valForTab = breakdown.w3Pencapaian;
      else if (tab === 'WEEK 4') valForTab = breakdown.w4Pencapaian;
    }
    setEditingCumulativeModal({ ...editingCumulativeModal, selectedWeekTab: tab });
    setCumulativeInputVal(valForTab);
  };

  // Simpan Edit Pencapaian Kumulatif
  const handleSaveCumulativeModal = () => {
    if (!editingCumulativeModal) return;
    const { store, selectedWeekTab } = editingCumulativeModal;
    const val = Number(cumulativeInputVal);
    if (isNaN(val) || val < 0) {
      showToast('Nominal harus berupa angka valid non-negatif!');
      return;
    }
    const mPrefix = selectedMonth.trim().toUpperCase();
    const weekKey = `${selectedWeekTab}_${store.storeName}`;
    const monthWeekKey = `${mPrefix}_${selectedWeekTab}_${store.storeName}`;

    const newCum = {
      ...customCumulative,
      [weekKey]: val,
      [monthWeekKey]: val,
    };
    if (selectedWeekTab === selectedWeek) {
      newCum[store.storeName] = val;
    }

    setCustomCumulative(newCum);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_CUMULATIVE, JSON.stringify(newCum));
    } catch (e) {
      console.warn(e);
    }

    showToast(`Pencapaian ${selectedWeekTab} toko ${store.storeName} berhasil disimpan: ${formatNumber(val)}!`);
    setEditingCumulativeModal(null);
  };

  // Reset Pencapaian Kumulatif ke Formula Otomatis
  const handleResetCumulativeModal = () => {
    if (!editingCumulativeModal) return;
    const { store, selectedWeekTab } = editingCumulativeModal;
    const mPrefix = selectedMonth.trim().toUpperCase();
    const weekKey = `${selectedWeekTab}_${store.storeName}`;
    const monthWeekKey = `${mPrefix}_${selectedWeekTab}_${store.storeName}`;

    const newCum = { ...customCumulative };
    delete newCum[weekKey];
    delete newCum[monthWeekKey];
    if (selectedWeekTab === selectedWeek) {
      delete newCum[store.storeName];
    }

    setCustomCumulative(newCum);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_CUMULATIVE, JSON.stringify(newCum));
    } catch (e) {
      console.warn(e);
    }

    showToast(`Pencapaian ${selectedWeekTab} toko ${store.storeName} dikembalikan ke formula otomatis!`);
    setEditingCumulativeModal(null);
  };

  // Tambah Kolom Toko Baru
  const handleAddStoreColumn = () => {
    if (!newStoreName.trim()) {
      showToast('Mohon masukkan nama toko!');
      return;
    }
    const sName = newStoreName.trim().toUpperCase();
    const sLower = sName.toLowerCase();

    // Hapus dari daftar toko yang pernah dihapus jika ada
    const updatedDeleted = deletedStoreNames.filter((n) => n.trim().toLowerCase() !== sLower);
    setDeletedStoreNames(updatedDeleted);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_DELETED_STORES, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn(e);
    }

    const newStore: WeeklyStoreConfig = {
      id: `ws-custom-${Date.now()}`,
      storeName: sName,
      baName: newBaName.trim().toUpperCase() || 'BA STANDBY',
      isBaCustom: Boolean(newBaName.trim()),
      salesName: newSalesName.trim().toUpperCase() || 'ALBERT FERNANDO',
      trainerName: newTrainerName.trim().toUpperCase() || 'ARA',
      coverArea: newCoverArea.trim().toUpperCase() || 'PEKANBARU',
      region: newRegion.trim().toUpperCase() || 'PEKAN BARU',
      targetMonthly: Number(newTargetMonthly) || 45000000,
    };

    // Bersihkan duplikat nama jika ada, lalu tambahkan toko baru
    const updated = [...storesList.filter((s) => s.storeName.trim().toLowerCase() !== sLower), newStore];
    setStoresList(updated);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_STORES, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }

    if (newPerformaVal > 0) {
      const newPerforma = { ...customPerformaBa, [newStore.storeName]: newPerformaVal };
      setCustomPerformaBa(newPerforma);
      try {
        localStorage.setItem(STORAGE_KEY_WEEKLY_PERFORMA, JSON.stringify(newPerforma));
      } catch (e) {
        console.warn(e);
      }
    }

    if (newCumulativeVal > 0) {
      const newCum = { ...customCumulative, [newStore.storeName]: newCumulativeVal };
      setCustomCumulative(newCum);
      try {
        localStorage.setItem(STORAGE_KEY_WEEKLY_CUMULATIVE, JSON.stringify(newCum));
      } catch (e) {
        console.warn(e);
      }
    }

    setIsAddingStore(false);
    showToast(`Kolom toko "${newStore.storeName}" berhasil ditambahkan ke tabel!`);
  };

  // Buka Modal Kelola & Kurangi Toko
  const handleOpenManageStoresModal = () => {
    setWorkingDeletedStores([...deletedStoreNames]);
    setManageStoresSearch('');
    setManageStoresSalesFilter('ALL');
    setManageStoresTab('all');
    setIsManageStoresModalOpen(true);
  };

  // Toggle toko dalam modal draft (Centang = Aktif, Uncheck = Dikurangi)
  const handleToggleStoreInDraft = (storeName: string) => {
    const sLower = storeName.trim().toLowerCase();
    const isCurrentlyDeleted = workingDeletedStores.some((n) => n.trim().toLowerCase() === sLower);
    if (isCurrentlyDeleted) {
      setWorkingDeletedStores(workingDeletedStores.filter((n) => n.trim().toLowerCase() !== sLower));
    } else {
      setWorkingDeletedStores([...workingDeletedStores, sLower]);
    }
  };

  // Set status spesifik untuk toko dalam modal draft
  const handleSetStoreExcludedInDraft = (storeName: string, exclude: boolean) => {
    const sLower = storeName.trim().toLowerCase();
    if (exclude) {
      if (!workingDeletedStores.some((n) => n.trim().toLowerCase() === sLower)) {
        setWorkingDeletedStores([...workingDeletedStores, sLower]);
      }
    } else {
      setWorkingDeletedStores(workingDeletedStores.filter((n) => n.trim().toLowerCase() !== sLower));
    }
  };

  // Bulk: Aktifkan semua toko yang sedang terlihat di modal
  const handleActivateAllVisible = (storeNames: string[]) => {
    const visibleSet = new Set(storeNames.map((n) => n.trim().toLowerCase()));
    setWorkingDeletedStores((prev) => prev.filter((n) => !visibleSet.has(n.trim().toLowerCase())));
    showToast(`${storeNames.length} toko diset Aktif (Draft). Klik Simpan untuk menerapkan.`);
  };

  // Bulk: Kurangi semua toko yang sedang terlihat di modal
  const handleExcludeAllVisible = (storeNames: string[]) => {
    const toAdd = storeNames.map((n) => n.trim().toLowerCase());
    setWorkingDeletedStores((prev) => Array.from(new Set([...prev, ...toAdd])));
    showToast(`${storeNames.length} toko diset Dikurangi (Draft). Klik Simpan untuk menerapkan.`);
  };

  // SIMPAN & TERAPKAN PERUBAHAN TOKO KE TABEL WEEKLY
  const handleSaveManageStores = () => {
    const cleanedDeleted = Array.from(new Set(workingDeletedStores.map((n) => n.trim().toLowerCase())));
    setDeletedStoreNames(cleanedDeleted);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_DELETED_STORES, JSON.stringify(cleanedDeleted));
    } catch (e) {
      console.warn('Failed to save STORAGE_KEY_WEEKLY_DELETED_STORES', e);
    }

    // Hitung berapa toko yang aktif setelah perubahan
    const activeCount = allMasterStores.filter(
      (s) => !cleanedDeleted.includes(s.storeName.trim().toLowerCase())
    ).length;

    setIsManageStoresModalOpen(false);
    showToast(`Perubahan berhasil disimpan! Tabel kini menampilkan ${activeCount} kolom toko aktif.`);
  };

  // Hapus / Kurangi Kolom Toko Langsung (Bisa dipanggil langsung dari header tabel tanpa dialog confirm)
  const handleDeleteStoreColumn = (storeId: string, storeName: string) => {
    const sLower = storeName.trim().toLowerCase();

    // 1. Hapus dari storesList
    const updatedStores = storesList.filter(
      (s) => s.id !== storeId && s.storeName.trim().toLowerCase() !== sLower
    );
    setStoresList(updatedStores);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_STORES, JSON.stringify(updatedStores));
    } catch (e) {
      console.warn(e);
    }

    // 2. Tambahkan ke deletedStoreNames agar tidak dihidupkan kembali secara otomatis oleh rekaman Google Sheets
    const updatedDeleted = Array.from(new Set([...deletedStoreNames, sLower]));
    setDeletedStoreNames(updatedDeleted);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_DELETED_STORES, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn(e);
    }

    // Sync juga draft working state jika modal sedang terbuka
    setWorkingDeletedStores((prev) => Array.from(new Set([...prev, sLower])));

    if (editingStore && (editingStore.id === storeId || editingStore.storeName.trim().toLowerCase() === sLower)) {
      setEditingStore(null);
    }
    showToast(`Kolom toko "${storeName}" berhasil dikurangi dari tabel.`);
  };

  // Pulihkan Toko yang Pernah Dihapus
  const handleRestoreStore = (storeName: string) => {
    const sLower = storeName.trim().toLowerCase();
    const updatedDeleted = deletedStoreNames.filter((n) => n.trim().toLowerCase() !== sLower);
    setDeletedStoreNames(updatedDeleted);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_DELETED_STORES, JSON.stringify(updatedDeleted));
    } catch (e) {
      console.warn(e);
    }

    setWorkingDeletedStores((prev) => prev.filter((n) => n.trim().toLowerCase() !== sLower));

    // Ambil dari DEFAULT_WEEKLY_STORES jika belum ada di storesList
    const def = DEFAULT_WEEKLY_STORES.find((s) => s.storeName.trim().toLowerCase() === sLower);
    if (def && !storesList.some((s) => s.storeName.trim().toLowerCase() === sLower)) {
      const updated = [...storesList, def];
      setStoresList(updated);
      try {
        localStorage.setItem(STORAGE_KEY_WEEKLY_STORES, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
    showToast(`Kolom toko "${storeName}" berhasil dipulihkan kembali ke tabel!`);
  };

  // Pulihkan Semua Toko
  const handleRestoreAllStores = () => {
    setDeletedStoreNames([]);
    setWorkingDeletedStores([]);
    try {
      localStorage.removeItem(STORAGE_KEY_WEEKLY_DELETED_STORES);
    } catch (e) {}
    setStoresList(DEFAULT_WEEKLY_STORES);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_STORES, JSON.stringify(DEFAULT_WEEKLY_STORES));
    } catch (e) {}
    showToast('Seluruh kolom toko berhasil dipulihkan!');
  };

  // Save Inline Edit Cell
  const handleSaveInlineCell = () => {
    if (!inlineEditCell) return;
    const key = `${inlineEditCell.storeName}_${inlineEditCell.dateKey}`;
    const trimmed = inlineInputVal.trim();
    const updated = { ...customDailyActuals };
    if (trimmed === '') {
      delete updated[key];
    } else {
      updated[key] = parseInt(trimmed.replace(/\D/g, ''), 10) || 0;
    }
    setCustomDailyActuals(updated);
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY_ACTUALS, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    setInlineEditCell(null);
    showToast(`Nilai transaksi ${inlineEditCell.storeName} berhasil disimpan!`);
  };

  // Reset to default template snapshot
  const handleResetToDefault = () => {
    setStoresList(DEFAULT_WEEKLY_STORES);
    setDeletedStoreNames([]);
    setCustomDailyActuals({});
    setCustomPerformaBa({});
    setCustomCumulative({});
    try {
      localStorage.removeItem(STORAGE_KEY_WEEKLY_STORES);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_DELETED_STORES);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_ACTUALS);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_PERFORMA);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_CUMULATIVE);
    } catch (e) {
      console.warn(e);
    }
    showToast('Tabel berhasil direset sesuai format gambar template default!');
  };

  // Reset custom overrides to re-sync cleanly with Google Sheets
  const handleResetToGoogleSheet = () => {
    setCustomDailyActuals({});
    setCustomPerformaBa({});
    setCustomCumulative({});
    try {
      localStorage.removeItem(STORAGE_KEY_WEEKLY_ACTUALS);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_PERFORMA);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_CUMULATIVE);
    } catch (e) {
      console.warn(e);
    }
    showToast('Data berhasil disinkronkan kembali dengan data Google Sheet!');
  };

  // Screenshot Feature using html2canvas with transform-reset and download safety
  const handleCaptureScreenshot = async () => {
    if (!reportRef.current) return;
    try {
      setIsCapturing(true);
      showToast('Sedang membuat screenshot berkualitas tinggi...');

      // html2canvas bermasalah jika element memiliki CSS transform: scale(...)!
      // Kita normalisasi viewScale sementara menjadi 1 selama proses capture, lalu kembalikan.
      const originalScale = viewScale;
      if (originalScale !== 1) {
        setViewScale(1);
        await new Promise((resolve) => setTimeout(resolve, 180));
      }

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('[data-report-capture]') as HTMLElement;
          if (el) {
            el.style.transform = 'none';
          }
        },
      });

      // Restore view scale jika diubah
      if (originalScale !== 1) {
        setViewScale(originalScale);
      }

      const filename = `Laporan_Weekly_SellOut_BA_${selectedWeek.replace(/\s+/g, '_')}_${selectedMonth.replace(/\s+/g, '_')}.png`;

      // 1. Convert to Blob & trigger safe download
      canvas.toBlob((blob) => {
        if (!blob) {
          const dataUrl = canvas.toDataURL('image/png');
          setScreenshotPreviewUrl(dataUrl);
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 500);
          showToast('Screenshot laporan berhasil dibuat!');
          return;
        }

        const url = URL.createObjectURL(blob);
        setScreenshotPreviewUrl(url);

        try {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
          }, 1500);
          showToast('Screenshot laporan berhasil diunduh (PNG)!');
        } catch (e) {
          console.warn('Auto download blocked by browser, showing preview modal', e);
          showToast('Screenshot siap! Klik Simpan pada preview.');
        }
      }, 'image/png', 1.0);
    } catch (err) {
      console.warn('Screenshot error:', err);
      showToast('Gagal membuat screenshot. Silakan coba lagi.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'HARI',
      ...activeStoresList.map((s) => `${s.storeName} (${s.baName})`),
      'TARGET HARIAN',
      'PENCAPAIAN',
      'TARGET PENJUALAN',
    ];

    const targetRow = [
      'TARGET BA + LAVOJOY',
      ...activeStoresList.map((s) => s.targetMonthly),
      calculationData.totalTargetMonthly,
      '-',
      '-',
    ];

    const targetDailyRow = [
      'TARGET HARIAN BA',
      ...activeStoresList.map((s) => calculationData.storeDailyTargets[s.storeName]),
      calculationData.totalTargetHarian,
      '-',
      '-',
    ];

    const pencapaianKumulatifRow = [
      `PENCAPAIAN ${weekRangeLabel}`,
      ...activeStoresList.map((s) => calculationData.storeCumulativeToDate[s.storeName]),
      calculationData.totalCumulativeToDate,
      '-',
      '-',
    ];

    const dailyRows: any[] = [];
    activeDaysList.forEach((d) => {
      const daySum = calculationData.dailyTotals[d.dayNum] || 0;
      const row = [
        d.dayLabel,
        ...activeStoresList.map((s) => {
          const val = calculationData.matrix[s.storeName]?.[d.dayNum] || 0;
          return val;
        }),
        calculationData.totalTargetHarian,
        daySum,
        calculationData.targetPenjualanMingguan,
      ];
      dailyRows.push(row);
    });

    const totalRow = [
      'TOTAL SELL OUT',
      ...activeStoresList.map((s) => calculationData.storeWeeklyTotals[s.storeName] || 0),
      calculationData.targetPenjualanMingguan,
      calculationData.grandTotalActual,
      calculationData.grandTotalActual,
    ];

    const presentaseRow = [
      'PRESENTASE (%)',
      ...activeStoresList.map((s) => `${calculationData.storePercentages[s.storeName]?.toFixed(1)}%`),
      '100%',
      `${calculationData.persentasePencapaianMingguan}%`,
      `TARGET: ${calculationData.persenTarget}%`,
    ];

    const performaRow = [
      'PEFORMA BA (KONTRIBUSI %)',
      ...activeStoresList.map((s) => `${calculationData.storePerforma[s.storeName]}%`),
      '100%',
      `${calculationData.persentasePencapaianMingguan}%`,
      `ACH: ${calculationData.persentasePencapaianMingguan}%`,
    ];

    const wsData = [
      ['LAPORAN PENJUALAN AREA - REVIEW WEEKLY SELL OUT BA'],
      [`Periode: ${selectedMonth} | ${weekRangeLabel}`],
      [],
      targetRow,
      targetDailyRow,
      pencapaianKumulatifRow,
      [],
      headers,
      ...dailyRows,
      [],
      totalRow,
      presentaseRow,
      performaRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Sell Out BA');
    XLSX.writeFile(wb, `Laporan_Weekly_SellOut_BA_${selectedWeek}_${selectedMonth}.xlsx`);
    showToast('Laporan berhasil diekspor ke Excel!');
  };

  // Helper formatting numbers with dot thousand separator (16.795.300)
  const formatNumber = (num: number): string => {
    if (!num || num === 0) return '-';
    return num.toLocaleString('id-ID');
  };

  const formatRupiah = (num: number): string => {
    if (!num || num === 0) return 'Rp 0';
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FILTER & ACTION TOOLBAR */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Sinkron Filter Terintegrasi */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-blue-900 tracking-wider">
                Filter Terintegrasi:
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="font-extrabold text-blue-950 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200 text-[11px] outline-none cursor-pointer"
                title="Pilih Bulan Laporan & Target BA + Lavojoy"
              >
                {MONTH_OPTIONS_2026.map((m) => {
                  const val = `${m.bulanName} 2026`;
                  return (
                    <option key={m.key} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
              <span className="text-slate-400">·</span>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-700" />
                <select
                  value={selectedSales}
                  onChange={(e) => setSelectedSales(e.target.value)}
                  className="font-black text-blue-950 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200 text-[11px] outline-none cursor-pointer"
                  title="Filter Coveran Sales"
                >
                  <option value="ALL">SEMUA SALES ({storesList.length} Toko)</option>
                  {availableSales.map((sales) => (
                    <option key={sales} value={sales}>
                      SALES: {sales}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-slate-400">·</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-blue-800">TRAINER:</span>
                <select
                  value={selectedTrainer}
                  onChange={(e) => setSelectedTrainer(e.target.value)}
                  className="font-black text-blue-950 bg-white/80 px-1.5 py-0.5 rounded-md border border-blue-200 text-[11px] outline-none cursor-pointer"
                  title="Filter Trainer"
                >
                  <option value="ALL">SEMUA</option>
                  <option value="ARA">ARA</option>
                  <option value="RATIH">RATIH</option>
                  <option value="ONLINE">ONLINE</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Minggu (Week 1, Week 2, Week 3, Week 4 [Week 4 & 5 gabung]) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            {(['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4'] as const).map((w) => {
              const label =
                w === 'WEEK 1'
                  ? 'WEEK 1 (01-07)'
                  : w === 'WEEK 2'
                  ? 'WEEK 2 (08-14)'
                  : w === 'WEEK 3'
                  ? 'WEEK 3 (15-21)'
                  : 'WEEK 4 (22-31)'; // Week 4 & Week 5 digabung!
              const isActive = selectedWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setSelectedWeek(w);
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-bold ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Filter Rentang Tanggal Manual */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1 rounded-xl text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Dari:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setSelectedWeek('CUSTOM');
              }}
              className="text-xs bg-transparent border-0 outline-none font-mono text-slate-800"
            />
            <span className="text-[10px] font-bold text-slate-500 uppercase">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setSelectedWeek('CUSTOM');
              }}
              className="text-xs bg-transparent border-0 outline-none font-mono text-slate-800"
            />
          </div>

          {/* Google Sheets Sync Indicator */}
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-2.5 py-1.5 rounded-xl text-emerald-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold">
              Google Sheet Terhubung ({sellOutSourceRecords.length > 0 ? `${sellOutSourceRecords.length} data Sell Out` : 'Tidak ada data Sell Out'})
            </span>
            <button
              onClick={handleResetToGoogleSheet}
              className="p-1 hover:bg-emerald-100 rounded-md transition-colors text-emerald-700 ml-0.5 cursor-pointer"
              title="Sinkronkan ulang ke data Google Sheet (reset override lokal)"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right Action Controls: Zoom, Reset, Screenshot, Excel */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewScale((s) => Math.max(0.65, Number((s - 0.05).toFixed(2))))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white"
              title="Perkecil Tampilan (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1.5 text-slate-700 min-w-[42px] text-center">
              {Math.round(viewScale * 100)}%
            </span>
            <button
              onClick={() => setViewScale((s) => Math.min(1.2, Number((s + 0.05).toFixed(2))))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white"
              title="Perbesar Tampilan (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewScale(viewScale === 0.85 ? 1 : 0.85)}
              className="px-2 py-0.5 text-[10px] font-bold bg-white text-indigo-700 rounded-md border border-slate-200 flex items-center gap-1"
              title="Fit Satu Layar"
            >
              <Maximize2 className="w-3 h-3" />
              Fit
            </button>
          </div>

          {/* Pengaturan Target BA + Lavojoy per Bulan */}
          <button
            onClick={() => handleOpenMonthlyTargetModal(selectedMonth)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl shadow-xs transition-all cursor-pointer"
            title="Atur Target BA + Lavojoy berbeda untuk setiap bulan"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Target BA+Lavojoy / Bulan</span>
          </button>

          {/* Tambah Kolom Toko Button */}
          <button
            onClick={() => {
              setNewStoreName('');
              setNewBaName('');
              setNewSalesName(selectedSales !== 'ALL' ? selectedSales : 'ALBERT FERNANDO');
              setNewTrainerName(selectedTrainer !== 'ALL' ? selectedTrainer : 'ARA');
              setNewCoverArea('PEKANBARU');
              setNewRegion('PEKAN BARU');
              setNewTargetMonthly(45000000);
              setNewCumulativeVal(0);
              setNewPerformaVal(0);
              setIsAddingStore(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-all cursor-pointer"
            title="Tambah Kolom Toko Baru ke Tabel Weekly Sell Out"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tambah Toko</span>
          </button>

          {/* Kurangi / Kelola Kolom Toko Button */}
          <button
            onClick={handleOpenManageStoresModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-xs transition-all cursor-pointer"
            title="Kurangi atau Kelola Kolom Toko (Hapus / Pulihkan Toko)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>− Kurangi / Kelola Toko</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-900 font-mono font-bold">
              {activeStoresList.length}
            </span>
            {deletedStoreNames.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-bold" title={`${deletedStoreNames.length} toko telah dihapus`}>
                -{deletedStoreNames.length}
              </span>
            )}
          </button>

          {/* Reset Template Default Button */}
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            title="Reset ke format data template default 80 toko"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Template</span>
          </button>

          {/* Screenshot PNG Button */}
          <button
            onClick={handleCaptureScreenshot}
            disabled={isCapturing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Download tangkapan layar PNG dari laporan ini"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isCapturing ? 'Memproses Screenshot...' : 'Screenshot PNG'}</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Quick Sales Coveran & Trainer Selector Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10px] font-black uppercase text-slate-500 mr-1 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Coveran Sales:
          </span>
          <button
            onClick={() => setSelectedSales('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              selectedSales === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Sales ({storesList.length})
          </button>
          {[
            { name: 'ALBERT FERNANDO', count: 13 },
            { name: 'ILHAMSYAH', count: 20 },
            { name: 'TIWI', count: 19 },
            { name: 'ABDUL RAHIM', count: 8 },
            { name: 'PARETO', count: 9 },
            { name: 'LUAR KOTA', count: 11 },
          ].map((s) => (
            <button
              key={s.name}
              onClick={() => setSelectedSales(s.name)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedSales === s.name
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{s.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedSales === s.name ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700 font-bold'
                }`}
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {/* Trainer Selector Pills */}
        <div className="flex items-center gap-1.5 text-xs bg-purple-50/60 border border-purple-200 px-2.5 py-1 rounded-xl">
          <span className="text-[10px] font-black uppercase text-purple-900">Trainer:</span>
          {(['ALL', 'ARA', 'RATIH', 'ONLINE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTrainer(t)}
              className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                selectedTrainer === t
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-800 hover:bg-purple-100'
              }`}
            >
              {t === 'ALL' ? 'Semua' : t}
            </button>
          ))}
        </div>
      </div>

      {/* REPORT CANVAS (Container that can be zoomed and screenshotted) */}
      <div className="overflow-x-auto bg-slate-200/70 p-2 sm:p-4 rounded-2xl border border-slate-300">
        <div
          ref={reportRef}
          data-report-capture="true"
          style={{
            transform: `scale(${viewScale})`,
            transformOrigin: 'top left',
            width: viewScale < 1 ? `${(1 / viewScale) * 100}%` : '100%',
          }}
          className="bg-white rounded-xl shadow-sm border border-slate-400 p-2 sm:p-4 transition-transform duration-150 font-sans"
        >
          {/* MAIN SPREADSHEET TABLE - EXACT STRUCTURE MATCHING IMAGE */}
          <div className="overflow-x-auto border border-slate-700">
            <table className="w-full text-left border-collapse text-[9.5px] leading-tight select-none border border-slate-600">
              <tbody>
                {/* 1. TOP HEADER BANNER: "LAPORAN PENJUALAN AREA ✎" | "TARGET PENJUALAN 1 MINGGU" | "Rp" | "135.566.669" */}
                <tr className="border-b border-slate-700">
                  <th
                    colSpan={activeStoresList.length + 1}
                    className="bg-[#9bc2e6] text-slate-950 font-black text-center py-2 px-4 text-xs sm:text-sm uppercase tracking-wide border-r border-slate-700"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>LAPORAN PENJUALAN AREA {selectedSales !== 'ALL' ? `• COVERAN SALES: ${selectedSales}` : ''}</span>
                      <Edit2 className="w-3.5 h-3.5 text-blue-800" />
                    </div>
                  </th>
                  <th className="bg-[#9bc2e6] text-slate-950 font-bold text-[9px] py-2 px-2 text-center uppercase whitespace-nowrap border-r border-slate-700 w-28">
                    TARGET PENJUALAN 1 MINGGU
                  </th>
                  <th className="bg-[#a9d08e] text-slate-950 font-extrabold text-[10px] py-2 px-1 text-center border-r border-slate-700 w-7">
                    Rp
                  </th>
                  <th className="bg-[#c6e0b4] text-slate-950 font-black text-[11px] py-2 px-2 text-right border-slate-700 font-mono w-28">
                    {formatNumber(calculationData.targetPenjualanMingguan)}
                  </th>
                </tr>

                {/* 2. ROW: TARGET BA + LAVOJOY */}
                <tr className="border-b border-slate-400 font-mono text-[9px]">
                  <td
                    onClick={() => handleOpenMonthlyTargetModal(selectedMonth)}
                    className="bg-white hover:bg-amber-50 font-black text-slate-900 p-1 border-r border-slate-400 whitespace-nowrap w-28 cursor-pointer transition-colors"
                    title="Klik untuk mengatur Target BA + Lavojoy per bulan"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>TARGET BA + LAVOJOY</span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[7.5px] font-bold">
                        <Calendar className="w-2.5 h-2.5 text-amber-700" />
                        <span>{selectedMonth.split(' ')[0].slice(0, 3)}</span>
                      </span>
                    </div>
                  </td>
                  {activeStoresList.map((s) => (
                    <td
                      key={s.id}
                      onClick={() => handleOpenEditStore(s)}
                      className="text-right p-1 border-r border-slate-300 font-bold hover:bg-yellow-50 cursor-pointer transition-colors"
                      title={`Klik untuk mengedit Target BA + Lavojoy toko ${s.storeName} (${selectedMonth})`}
                    >
                      {formatNumber(s.targetMonthly)}
                    </td>
                  ))}
                  <td className="bg-[#ff0000] text-white font-black text-center p-1 border-r border-slate-700 uppercase text-[8.5px]">
                    TOTAL TARGET
                  </td>
                  <td
                    colSpan={2}
                    className="text-right p-1 font-black text-red-600 border-slate-700 bg-white font-mono text-[9.5px]"
                  >
                    {formatNumber(calculationData.totalTargetMonthly)}
                  </td>
                </tr>

                {/* 3. ROW: TARGET HARIAN BA */}
                <tr className="border-b border-slate-400 font-mono text-[9px]">
                  <td className="bg-white font-black text-slate-900 p-1 border-r border-slate-400 whitespace-nowrap">
                    TARGET HARIAN BA
                  </td>
                  {activeStoresList.map((s) => (
                    <td
                      key={s.id}
                      onClick={() => handleOpenEditStore(s)}
                      className="text-right p-1 border-r border-slate-300 font-medium hover:bg-yellow-50 cursor-pointer transition-colors text-slate-700"
                      title="Klik untuk mengedit target toko"
                    >
                      {formatNumber(calculationData.storeDailyTargets[s.storeName] || 0)}
                    </td>
                  ))}
                  <td className="bg-[#000000] text-white font-black text-center p-1 border-r border-slate-700 uppercase text-[8.5px]">
                    TOTAL TARGET HARIAN
                  </td>
                  <td
                    colSpan={2}
                    className="text-right p-1 font-black text-red-600 border-slate-700 bg-white font-mono text-[9.5px]"
                  >
                    {formatNumber(calculationData.totalTargetHarian)}
                  </td>
                </tr>

                {/* 4. ROW: PENCAPAIAN WEEK BERAPA (CONTOH WEEK 2 [08-14]) */}
                <tr className="border-b-2 border-slate-700 font-mono text-[9px]">
                  <td className="bg-white font-black text-slate-900 p-1 border-r border-slate-400 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <span>PENCAPAIAN {weekRangeLabel}</span>
                        <span className="text-[7.5px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                          Rumus Progresif
                        </span>
                      </div>
                      <span title="Klik cell toko untuk edit">
                        <Edit2 className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                      </span>
                    </div>
                  </td>
                  {activeStoresList.map((s) => {
                    const val = calculationData.storeCumulativeToDate[s.storeName] || 0;
                    const isCustom = calculationData.isStoreCustomCumulative?.[s.storeName];
                    return (
                      <td
                        key={s.id}
                        onClick={() => handleOpenCumulativeModal(s)}
                        className={`text-right p-1 border-r border-slate-300 font-bold cursor-pointer hover:bg-amber-100 hover:text-amber-950 transition-colors ${
                          isCustom ? 'bg-amber-50 text-amber-900 font-black' : 'bg-white text-slate-900'
                        }`}
                        title={`Klik untuk edit Pencapaian Kumulatif ${weekRangeLabel} toko ${s.storeName}${isCustom ? ' (Manual Edit)' : ' (Otomatis Rumus Kumulatif)'}`}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          {isCustom && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Manual Edit Override" />}
                          <span>{val > 0 ? formatNumber(val) : '0'}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="bg-[#000000] text-white font-black text-center p-1 border-r border-slate-700 uppercase text-[8.5px]">
                    PENCAPAIAN {weekRangeLabel}
                  </td>
                  <td
                    colSpan={2}
                    className="text-right p-1 font-black text-slate-950 border-slate-700 bg-white font-mono text-[9.5px]"
                  >
                    {calculationData.totalCumulativeToDate > 0 ? formatNumber(calculationData.totalCumulativeToDate) : '0'}
                  </td>
                </tr>

                {/* 5. TABLE HEADER: STORE NAMES & BA NAMES (Light blue #8ea9db) */}
                <tr className="bg-[#8ea9db] text-slate-950 font-black border-b border-slate-700 text-[9px]">
                  <th className="p-1 border-r border-slate-700 text-center w-28 uppercase">HARI</th>
                  {activeStoresList.map((s) => (
                    <th
                      key={s.id}
                      onClick={() => handleOpenEditStore(s)}
                      className="p-1 border-r border-slate-700 text-center uppercase cursor-pointer hover:bg-[#7a99cf] transition-colors min-w-[75px] group relative"
                      title={`${s.storeName} • BA: ${s.baName} • Sales: ${s.salesName} • Trainer: ${s.trainerName} (Klik untuk edit)`}
                    >
                      <div className="flex items-start justify-between gap-0.5">
                        <div className="font-black text-slate-950 leading-tight text-[8.5px] max-w-[105px] line-clamp-2 text-left" title={s.storeName}>
                          {s.storeName}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStoreColumn(s.id, s.storeName);
                          }}
                          className="opacity-40 group-hover:opacity-100 hover:text-red-700 hover:bg-red-100/80 p-0.5 rounded cursor-pointer transition-all shrink-0"
                          title={`Hapus kolom toko ${s.storeName}`}
                        >
                          <Trash2 className="w-2.5 h-2.5 text-red-700" />
                        </button>
                      </div>
                      <div className="text-[7.5px] font-bold text-slate-900 leading-tight opacity-95 mt-0.5 truncate max-w-[110px]">
                        BA: {s.baName}
                      </div>
                      <div className="text-[6.5px] font-semibold text-slate-700 leading-tight opacity-80 mt-0.5 truncate max-w-[110px]">
                        {s.salesName} ({s.trainerName})
                      </div>
                    </th>
                  ))}
                  <th className="p-1 border-r border-slate-700 text-center uppercase text-[8.5px] w-28">
                    TARGET HARIAN
                  </th>
                  <th className="p-1 border-r border-slate-700 text-center uppercase text-[8.5px] w-20 bg-[#bdd7ee]">
                    PENCAPAIAN
                  </th>
                  <th className="p-1 border-slate-700 text-center uppercase text-[9px] w-32 bg-[#9bc2e6]">
                    TARGET PENJUALAN
                  </th>
                </tr>

                {/* 6. DAILY ROWS: Row 1 (Value) & Row 2 (Keterangan with Pills) */}
                {activeDaysList.map((d, rowIdx) => {
                  const dailyTotal = calculationData.dailyTotals[d.dayNum] || 0;
                  const isDayMetTarget = dailyTotal >= calculationData.totalTargetHarian;
                  const dayAchievementPct =
                    calculationData.totalTargetHarian > 0
                      ? Math.round((dailyTotal / calculationData.totalTargetHarian) * 100)
                      : 0;

                  return (
                    <React.Fragment key={d.dayNum}>
                      {/* Main Day Value Row */}
                      <tr className="border-b border-slate-200 font-mono text-[9px] bg-white">
                        {/* Day Name and Date, e.g. (08) SELASA */}
                        <td className="p-1 border-r border-slate-400 font-bold text-slate-900 whitespace-nowrap text-center">
                          {d.dayLabel}
                        </td>

                        {/* Each Store Cell for this Day */}
                        {activeStoresList.map((s) => {
                          const val = calculationData.matrix[s.storeName]?.[d.dayNum] || 0;
                          return (
                            <td
                              key={s.id}
                              onDoubleClick={() => {
                                setInlineEditCell({ storeName: s.storeName, dateKey: d.dateKey, currentVal: val });
                                setInlineInputVal(val > 0 ? val.toString() : '');
                              }}
                              className="p-1 border-r border-slate-300 text-right hover:bg-indigo-50/60 cursor-pointer transition-colors"
                              title={val > 0 ? 'Klik ganda untuk edit nilai' : 'Belum ada pencapaian Sell Out di Google Sheet (0) • Klik ganda untuk isi manual'}
                            >
                              <span className={val > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-400'}>
                                {val > 0 ? formatNumber(val) : '0'}
                              </span>
                            </td>
                          );
                        })}

                        {/* Total Target Harian for that day */}
                        <td className="p-1 border-r border-slate-700 text-right font-medium text-slate-700 bg-white">
                          {formatNumber(calculationData.totalTargetHarian)}
                        </td>

                        {/* Total Actual Pencapaian for that day */}
                        <td className="p-1 border-r border-slate-700 text-right font-black text-slate-950 bg-white">
                          {dailyTotal > 0 ? formatNumber(dailyTotal) : '0'}
                        </td>

                        {/* Rightmost Unified Block: TARGET PENJUALAN Cards (Rowspan across all daily rows) */}
                        {rowIdx === 0 && (
                          <td
                            rowSpan={activeDaysList.length * 2}
                            className="p-2 border-slate-700 bg-[#bdd7ee] align-middle text-center"
                          >
                            <div className="flex flex-col gap-2 max-w-[130px] mx-auto">
                              {/* 1. White Box: TARGET PENJUALAN */}
                              <div className="bg-white border border-slate-300 rounded p-1.5 shadow-2xs text-center">
                                <div className="text-[7.5px] font-bold text-slate-600 uppercase">
                                  TARGET PENJUALAN
                                </div>
                                <div className="text-[10px] font-black text-slate-950 font-mono mt-0.5">
                                  Rp {formatNumber(calculationData.targetPenjualanMingguan)}
                                </div>
                              </div>

                              {/* 2. White Box: PENCAPAIAN */}
                              <div className="bg-white border border-slate-300 rounded p-1.5 shadow-2xs text-center">
                                <div className="text-[7.5px] font-bold text-slate-600 uppercase">
                                  PENCAPAIAN
                                </div>
                                <div className="text-[10px] font-black text-slate-950 font-mono mt-0.5">
                                  {calculationData.grandTotalActual > 0 ? formatNumber(calculationData.grandTotalActual) : '0'}
                                </div>
                              </div>

                              {/* 3. Black Box: PERSEN TARGET (100%) */}
                              <div
                                onClick={() => {
                                  setInputPersenTarget(calculationData.persenTarget);
                                  setIsEditingPersenTarget(true);
                                }}
                                className="bg-[#000000] text-white rounded p-2 shadow-xs text-center cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all"
                                title="Klik untuk ubah Persen Target"
                              >
                                <div className="text-[7.5px] font-bold tracking-wider text-slate-300 uppercase flex items-center justify-center gap-1">
                                  <span>PERSEN TARGET</span>
                                  <Edit2 className="w-2 h-2 text-amber-400" />
                                </div>
                                <div className="text-xl font-black text-white font-mono mt-0.5">
                                  {calculationData.persenTarget}%
                                </div>
                              </div>

                              {/* 4. Peach/Orange Box: PERSENTASE PENCAPAIAN */}
                              <div className="bg-[#f8cbad] text-slate-950 rounded p-2 shadow-xs text-center border border-orange-300/60">
                                <div className="text-[7.5px] font-black tracking-wider text-slate-900 uppercase">
                                  PERSENTASE PENCAPAIAN
                                </div>
                                <div className="text-xl font-black text-slate-950 font-mono mt-0.5">
                                  {calculationData.persentasePencapaianMingguan}%
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Sub-row: KETERANGAN with pill badges (↑ green / ↓ red) */}
                      <tr className="border-b border-slate-400 text-[8px] bg-white">
                        <td className="p-0.5 border-r border-slate-400 font-bold text-slate-600 text-center uppercase">
                          KETERANGAN
                        </td>
                        {activeStoresList.map((s) => {
                          const val = calculationData.matrix[s.storeName]?.[d.dayNum] || 0;
                          const dailyTarget = calculationData.storeDailyTargets[s.storeName] || 1;
                          const isMet = val >= dailyTarget;
                          const pct = dailyTarget > 0 ? Math.round((val / dailyTarget) * 100) : 0;

                          return (
                            <td key={s.id} className="p-0.5 text-center border-r border-slate-300">
                              <span
                                className={`inline-block px-1 py-0.2 rounded text-[7.5px] font-bold border ${
                                  isMet
                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                    : 'border-rose-300 bg-rose-50 text-rose-600'
                                }`}
                              >
                                {isMet ? '↑' : '↓'} {pct}%
                              </span>
                            </td>
                          );
                        })}

                        {/* Target Harian cell in Keterangan row */}
                        <td className="p-0.5 border-r border-slate-700 bg-white"></td>

                        {/* Pencapaian cell in Keterangan row */}
                        <td className="p-0.5 text-center border-r border-slate-700">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[7.5px] font-bold border ${
                              isDayMetTarget
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : 'border-rose-300 bg-rose-50 text-rose-600'
                            }`}
                          >
                            {isDayMetTarget ? '↑' : '↓'} {dayAchievementPct}%
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* 7. BOTTOM ROW: TOTAL */}
                <tr className="border-t-2 border-b border-slate-700 font-mono bg-white font-black text-[9px]">
                  <td className="p-1 border-r border-slate-700 uppercase text-slate-900 bg-white">
                    TOTAL
                  </td>
                  {activeStoresList.map((s) => {
                    const sTotal = calculationData.storeWeeklyTotals[s.storeName] || 0;
                    return (
                      <td key={s.id} className="p-1 border-r border-slate-300 text-right text-slate-950 font-black">
                        {sTotal > 0 ? formatNumber(sTotal) : '0'}
                      </td>
                    );
                  })}
                  <td className="p-1 border-r border-slate-700 text-right text-slate-900 font-bold bg-white">
                    {formatNumber(calculationData.targetPenjualanMingguan)}
                  </td>
                  <td className="p-1 border-r border-slate-700 text-right text-slate-950 font-black bg-[#f8cbad]">
                    {calculationData.grandTotalActual > 0 ? formatNumber(calculationData.grandTotalActual) : '0'}
                  </td>
                  <td className="p-1 border-slate-700 text-center font-black bg-[#f8cbad] text-slate-950">
                    {calculationData.grandTotalActual > 0 ? formatNumber(calculationData.grandTotalActual) : '0'}
                  </td>
                </tr>

                {/* 8. BOTTOM ROW: PRESENTASE */}
                <tr className="border-b border-slate-700 font-mono bg-white font-black text-[9px]">
                  <td className="p-1 border-r border-slate-700 uppercase text-slate-900 bg-white">
                    PRESENTASE
                  </td>
                  {activeStoresList.map((s) => {
                    const pct = calculationData.storePercentages[s.storeName] || 0;
                    return (
                      <td key={s.id} className="p-1 border-r border-slate-300 text-center font-black text-slate-900">
                        {Math.round(pct)}%
                      </td>
                    );
                  })}
                  <td className="p-1 border-r border-slate-700 text-center bg-white font-bold text-slate-900">
                    100%
                  </td>
                  <td className="p-1 border-r border-slate-700 text-center font-black text-slate-950 bg-[#f8cbad]">
                    {calculationData.persentasePencapaianMingguan}%
                  </td>
                  <td
                    onClick={() => {
                      setInputPersenTarget(calculationData.persenTarget);
                      setIsEditingPersenTarget(true);
                    }}
                    className="p-1 border-slate-700 text-center font-bold bg-[#000000] text-white text-[8.5px] cursor-pointer hover:ring-1 hover:ring-amber-400"
                    title="Klik untuk ubah Persen Target"
                  >
                    TARGET: {calculationData.persenTarget}%
                  </td>
                </tr>

                {/* 9. BOTTOM ROW: PEFORMA BA (RED BORDER ALL AROUND!) */}
                <tr className="border-2 border-red-600 font-mono bg-white font-black text-[9px]">
                  <td className="p-1 border-r border-red-500 uppercase text-red-600 bg-white border-l-2 border-red-600">
                    <div className="flex items-center justify-between">
                      <span>PEFORMA BA</span>
                      <Edit2 className="w-2.5 h-2.5 text-amber-600" />
                    </div>
                  </td>
                  {activeStoresList.map((s) => {
                    const performa = calculationData.storePerforma[s.storeName] || 0;
                    const avg = 100 / Math.max(1, activeStoresList.length);
                    const isAboveAvg = performa >= avg;

                    return (
                      <td
                        key={s.id}
                        onClick={() => handleOpenEditStore(s)}
                        className="p-1 border-r border-red-300 text-center font-black cursor-pointer hover:bg-red-50 transition-colors"
                        title={`Performa Kontribusi BA: ${performa}% • Klik untuk ubah`}
                      >
                        <div className="flex items-center justify-center gap-0.5 text-[8.5px]">
                          <span className={isAboveAvg ? 'text-emerald-700' : 'text-red-600'}>
                            {isAboveAvg ? '↑' : '↓'}
                          </span>
                          <span>{performa}%</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-1 border-r border-red-500 text-center font-black bg-white text-slate-900">
                    100%
                  </td>
                  <td className="p-1 border-r border-red-500 text-center font-black bg-[#f8cbad] text-slate-950">
                    {calculationData.persentasePencapaianMingguan}%
                  </td>
                  <td className="p-1 border-r-2 border-red-600 text-center font-black bg-[#f8cbad] text-slate-950 text-[8.5px]">
                    ACH: {calculationData.persentasePencapaianMingguan}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BOTTOM SECTION: GRAFIK PEFORMA BA IN DARK NAVY CONTAINER (EXACT MATCH WITH IMAGE) */}
          <div className="bg-[#070e1b] rounded-2xl p-3 sm:p-4 mt-4 shadow-md border border-slate-900">
            <div className="bg-white rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200">
              {/* Header inside Chart Card */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                      GRAFIK PEFORMA BA (KONTRIBUSI SELL OUT) • LAPORAN PENJUALAN AREA {selectedSales !== 'ALL' ? `(${selectedSales})` : ''} ({selectedWeek})
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Persentase kontribusi sell out tiap BA terhadap total omset mingguan coveran Sales {selectedSales === 'ALL' ? 'Area' : selectedSales}
                    </p>
                  </div>
                </div>

                {/* Right Badge: Total Performa Area */}
                <div className="px-3.5 py-1 rounded-full bg-[#e1f0fe] border border-blue-300 text-blue-700 text-xs font-bold shrink-0">
                  Total Performa Area: {calculationData.persentasePencapaianMingguan}%
                </div>
              </div>

              {/* Vertical Bars */}
              <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 pt-6 px-1 overflow-x-auto">
                {activeStoresList.map((s) => {
                  const performaVal = calculationData.storePerforma[s.storeName] || 0;
                  const maxVal = Math.max(...Object.values(calculationData.storePerforma), 30);
                  const barHeightPct = Math.max(5, Math.min(100, Math.round((performaVal / maxVal) * 100)));

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleOpenEditStore(s)}
                      className="flex-1 min-w-[55px] max-w-[85px] flex flex-col items-center justify-end h-full group cursor-pointer"
                    >
                      {/* Percentage Label on Top of Bar */}
                      <span className="text-[11px] font-mono font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                        {performaVal}%
                      </span>

                      {/* Bar Graphic */}
                      <div className="w-full max-w-[42px] bg-slate-100 rounded-t-md h-full flex items-end">
                        <div
                          style={{ height: `${barHeightPct}%` }}
                          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] rounded-t-md transition-all duration-300 shadow-2xs"
                        />
                      </div>

                      {/* Store Name Below Bar */}
                      <span
                        className="text-[9px] font-bold text-slate-700 text-center leading-tight mt-2 line-clamp-2 uppercase group-hover:text-blue-700"
                        title={s.storeName}
                      >
                        {s.storeName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: EDIT PENCAPAIAN KUMULATIF PROGRESIF (WEEK 1, 2, 3, 4) */}
      {editingCumulativeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Edit Pencapaian Kumulatif Sell Out
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Formula progresif otomatis per week &amp; override manual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCumulativeModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Store Information Badge */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Toko</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  Sales: {editingCumulativeModal.store.salesName}
                </span>
              </div>
              <div className="text-sm font-black text-slate-900">
                {editingCumulativeModal.store.storeName}
              </div>
              <div className="text-[11px] text-slate-600 flex flex-wrap gap-2 pt-1 border-t border-slate-200 mt-1">
                <span>BA: <strong>{editingCumulativeModal.store.baName}</strong></span>
                <span>•</span>
                <span>Trainer: <strong>{editingCumulativeModal.store.trainerName}</strong></span>
                <span>•</span>
                <span>Area: <strong>{editingCumulativeModal.store.coverArea}</strong></span>
              </div>
            </div>

            {/* Week Selector Tabs */}
            <div className="mt-4">
              <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                Pilih Periode Week yang Ingin Diedit / Dilihat:
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4'] as const).map((wTab) => {
                  const bDown = calculationData.storeWeeklyBreakdowns?.[editingCumulativeModal.store.storeName];
                  const isTabCustom =
                    wTab === 'WEEK 1'
                      ? bDown?.isW1Custom
                      : wTab === 'WEEK 2'
                      ? bDown?.isW2Custom
                      : wTab === 'WEEK 3'
                      ? bDown?.isW3Custom
                      : bDown?.isW4Custom;

                  const rangeLabel =
                    wTab === 'WEEK 1'
                      ? '01-07'
                      : wTab === 'WEEK 2'
                      ? '08-14'
                      : wTab === 'WEEK 3'
                      ? '15-21'
                      : `22-${totalDaysInMonth}`;

                  const isSelected = editingCumulativeModal.selectedWeekTab === wTab;
                  return (
                    <button
                      key={wTab}
                      type="button"
                      onClick={() => handleSwitchCumulativeTab(wTab)}
                      className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 font-bold'
                      }`}
                    >
                      <div className="text-[10px] leading-tight">{wTab}</div>
                      <div className={`text-[8.5px] font-mono ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        ({rangeLabel})
                      </div>
                      {isTabCustom && (
                        <span className={`inline-block mt-0.5 text-[7px] px-1 rounded font-bold ${
                          isSelected ? 'bg-amber-300 text-amber-950' : 'bg-amber-100 text-amber-800'
                        }`}>
                          Manual
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Breakdown Formula Card */}
            {(() => {
              const bDown = calculationData.storeWeeklyBreakdowns?.[editingCumulativeModal.store.storeName];
              if (!bDown) return null;
              const wTab = editingCumulativeModal.selectedWeekTab;
              const isTabCustom =
                wTab === 'WEEK 1'
                  ? bDown.isW1Custom
                  : wTab === 'WEEK 2'
                  ? bDown.isW2Custom
                  : wTab === 'WEEK 3'
                  ? bDown.isW3Custom
                  : bDown.isW4Custom;

              return (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 mt-3 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-200">
                    <span className="font-extrabold text-amber-950 text-[11px] flex items-center gap-1.5">
                      <span>Rincian Formula {wTab}:</span>
                    </span>
                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold ${
                        isTabCustom
                          ? 'bg-amber-200 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {isTabCustom ? '• Nilai Manual (Override)' : '✓ Otomatis Sesuai Rumus'}
                    </span>
                  </div>

                  {wTab === 'WEEK 1' && (
                    <div className="space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span>Total Penjualan Tgl 01 s/d 07:</span>
                        <strong className="font-mono text-slate-900">{formatRupiah(bDown.w1Actual)}</strong>
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/60 flex justify-between font-bold text-slate-900">
                        <span>Pencapaian Week 1 (01-07):</span>
                        <span className="font-mono text-blue-700 font-extrabold">{formatRupiah(bDown.w1Pencapaian)}</span>
                      </div>
                    </div>
                  )}

                  {wTab === 'WEEK 2' && (
                    <div className="space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span>Pencapaian Week 1 (01-07):</span>
                        <strong className="font-mono text-slate-900">{formatRupiah(bDown.w1Pencapaian)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Sell Out Week 2 (08-14):</span>
                        <strong className="font-mono text-slate-900">+ {formatRupiah(bDown.w2Actual)}</strong>
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/60 flex justify-between font-bold text-slate-900">
                        <span>Hasil Rumus Otomatis (W1 + W2):</span>
                        <span className="font-mono text-blue-700 font-extrabold">{formatRupiah(bDown.w2Formula)}</span>
                      </div>
                      {bDown.isW2Custom && (
                        <div className="flex justify-between font-bold text-amber-900 pt-1">
                          <span>Nilai Manual Aktif di Tabel:</span>
                          <span className="font-mono">{formatRupiah(bDown.w2Pencapaian)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {wTab === 'WEEK 3' && (
                    <div className="space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span>Pencapaian Kumulatif Week 2:</span>
                        <strong className="font-mono text-slate-900">{formatRupiah(bDown.w2Pencapaian)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Sell Out Week 3 (15-21):</span>
                        <strong className="font-mono text-slate-900">+ {formatRupiah(bDown.w3Actual)}</strong>
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/60 flex justify-between font-bold text-slate-900">
                        <span>Hasil Rumus Otomatis (Pencapaian W2 + W3):</span>
                        <span className="font-mono text-blue-700 font-extrabold">{formatRupiah(bDown.w3Formula)}</span>
                      </div>
                      {bDown.isW3Custom && (
                        <div className="flex justify-between font-bold text-amber-900 pt-1">
                          <span>Nilai Manual Aktif di Tabel:</span>
                          <span className="font-mono">{formatRupiah(bDown.w3Pencapaian)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {wTab === 'WEEK 4' && (
                    <div className="space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span>Pencapaian Kumulatif Week 3:</span>
                        <strong className="font-mono text-slate-900">{formatRupiah(bDown.w3Pencapaian)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Sell Out Week 4 (22-{totalDaysInMonth}):</span>
                        <strong className="font-mono text-slate-900">+ {formatRupiah(bDown.w4Actual)}</strong>
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/60 flex justify-between font-bold text-slate-900">
                        <span>Hasil Rumus Otomatis (Pencapaian W3 + W4):</span>
                        <span className="font-mono text-blue-700 font-extrabold">{formatRupiah(bDown.w4Formula)}</span>
                      </div>
                      {bDown.isW4Custom && (
                        <div className="flex justify-between font-bold text-amber-900 pt-1">
                          <span>Nilai Manual Aktif di Tabel:</span>
                          <span className="font-mono">{formatRupiah(bDown.w4Pencapaian)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Input Manual Override */}
            <div className="mt-4 space-y-1.5">
              <label className="font-bold text-slate-800 block text-xs">
                Nominal Pencapaian ({editingCumulativeModal.selectedWeekTab}) (Rp):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={cumulativeInputVal}
                  onChange={(e) => setCumulativeInputVal(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Preview Format Rupiah:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatRupiah(Number(cumulativeInputVal) || 0)}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetCumulativeModal}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer flex items-center gap-1.5 transition-colors"
                title="Hapus nilai manual dan kembali gunakan rumus otomatis"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Gunakan Rumus Otomatis</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCumulativeModal(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCumulativeModal}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STORE TARGET & PERFORMA (COMPACT) */}
      {editingStore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[86vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-[11px]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                Edit Toko &amp; Target BA
              </h3>
              <button
                type="button"
                onClick={() => setEditingStore(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2.5 space-y-2 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">Nama Toko</label>
                  <input
                    type="text"
                    value={editStoreName}
                    onChange={(e) => setEditStoreName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:bg-white focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">Nama Beauty Advisor (BA)</label>
                  <input
                    type="text"
                    value={editBaName}
                    onChange={(e) => setEditBaName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-900 focus:bg-white focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">Coveran Sales</label>
                  <input
                    type="text"
                    value={editSalesName}
                    onChange={(e) => setEditSalesName(e.target.value)}
                    placeholder="ALBERT FERNANDO"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-bold text-[11px] focus:bg-white focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">Trainer</label>
                  <input
                    type="text"
                    value={editTrainerName}
                    onChange={(e) => setEditTrainerName(e.target.value)}
                    placeholder="ARA / RATIH / ONLINE"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-bold text-[11px] focus:bg-white focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">Area</label>
                  <input
                    type="text"
                    value={editCoverArea}
                    onChange={(e) => setEditCoverArea(e.target.value)}
                    placeholder="PEKANBARU"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-bold text-[11px] focus:bg-white focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">Region</label>
                  <input
                    type="text"
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    placeholder="PEKAN BARU"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-bold text-[11px] focus:bg-white focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-extrabold text-amber-950 text-[11px]">
                    Target BA + Lavojoy
                  </label>
                  <select
                    value={editTargetMonth}
                    onChange={(e) => {
                      const nextMonth = e.target.value;
                      setEditTargetMonth(nextMonth);
                      if (editingStore) {
                        const bd = getStoreMonthlyTargetBreakdown(editingStore, nextMonth);
                        setEditTargetNonLavojoy(bd.nonLavojoy);
                        setEditTargetLavojoy(bd.lavojoy);
                        setEditTargetMonthly(bd.total);
                      }
                    }}
                    className="px-2 py-0.5 rounded-md border border-amber-300 bg-white font-bold text-amber-950 text-[10px] outline-none cursor-pointer"
                  >
                    {MONTH_OPTIONS_2026.map((m) => {
                      const val = `${m.bulanName} 2026`;
                      return (
                        <option key={m.key} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                      Non-Lavojoy (Rp)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editTargetNonLavojoy}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setEditTargetNonLavojoy(val);
                        setEditTargetMonthly(val + editTargetLavojoy);
                      }}
                      className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                      Lavojoy (Rp)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editTargetLavojoy}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setEditTargetLavojoy(val);
                        setEditTargetMonthly(editTargetNonLavojoy + val);
                      }}
                      className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-800 tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <label className="font-bold text-slate-700 text-[10px]">
                      Total Target ({editTargetMonth})
                    </label>
                    <span className="text-[9.5px] text-slate-600 font-mono tabular-nums">
                      Harian: Rp {Math.round(editTargetMonthly / 30).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={editTargetMonthly}
                    onChange={(e) => {
                      const total = Math.max(0, Number(e.target.value) || 0);
                      setEditTargetMonthly(total);
                      if (total >= editTargetLavojoy) {
                        setEditTargetNonLavojoy(total - editTargetLavojoy);
                      } else {
                        setEditTargetLavojoy(total);
                        setEditTargetNonLavojoy(0);
                      }
                    }}
                    className="w-full px-2.5 py-1 rounded-lg border border-amber-300 bg-white font-mono font-black text-blue-900 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                    Kumulatif ({weekRangeLabel}) (Rp)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editCumulativeVal}
                    onChange={(e) => setEditCumulativeVal(Number(e.target.value))}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900 tabular-nums focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                    Performa BA (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editPerformaVal}
                    onChange={(e) => setEditPerformaVal(Number(e.target.value))}
                    className="w-full px-2.5 py-1 rounded-lg border border-red-200 bg-red-50/50 font-mono font-black text-red-700 tabular-nums focus:bg-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/90 shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteStoreColumn(editingStore.id, editingStore.storeName)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg font-bold transition-all cursor-pointer text-[11px]"
                title="Hapus kolom toko ini dari laporan weekly sell out"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer text-[11px]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditStore}
                  className="px-3.5 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer text-[11px]"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PENGATURAN TARGET BA + LAVOJOY PER BULAN */}
      {isMonthlyTargetModalOpen && (() => {
        const monthlyStoreData = loadMonthlyTargets();
        const filteredConfigStores = allConfigurableStores.filter((s) => {
          if (
            monthlyTargetSalesFilter !== 'ALL' &&
            s.salesName.toUpperCase() !== monthlyTargetSalesFilter.toUpperCase()
          ) {
            return false;
          }
          if (monthlyTargetSearch.trim()) {
            const q = monthlyTargetSearch.trim().toLowerCase();
            return (
              s.storeName.toLowerCase().includes(q) ||
              s.baName.toLowerCase().includes(q) ||
              s.salesName.toLowerCase().includes(q)
            );
          }
          return true;
        });

        const totalFilteredMonthlyTarget = filteredConfigStores.reduce((sum, s) => {
          const d = monthlyTargetDrafts[s.storeName];
          return sum + (d ? d.nonLavojoy + d.lavojoy : s.targetMonthly);
        }, 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-xs flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      Setting Target BA + Lavojoy per Bulan
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Atur target bulanan yang berbeda untuk setiap bulan (Januari – Desember 2026). Perubahan per bulan tersimpan terpisah dan sinkron dengan Pusat Kelola Target.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMonthlyTargetModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Month Tabs */}
              <div className="mt-3 shrink-0">
                <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5">
                  Pilih Bulan Target:
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                  {MONTH_OPTIONS_2026.map((m) => {
                    const monthLabel = `${m.bulanName} 2026`;
                    const isSelected = monthlyTargetEditMonth === monthLabel;
                    const norm = normalizeMonthKey(monthLabel);
                    const bucket = monthlyStoreData[norm];
                    const hasCustom =
                      (bucket?.baNonLavojoy && Object.keys(bucket.baNonLavojoy).length > 0) ||
                      (bucket?.baLavojoy && Object.keys(bucket.baLavojoy).length > 0);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleSwitchMonthlyTargetModalMonth(monthLabel)}
                        className={`px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : hasCustom
                            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{m.shortLabel}</span>
                        {hasCustom && (
                          <span
                            className={`text-[8px] font-extrabold ${
                              isSelected ? 'text-amber-200' : 'text-amber-700'
                            }`}
                          >
                            Custom
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter & Copy Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 mb-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari toko / BA / sales..."
                      value={monthlyTargetSearch}
                      onChange={(e) => setMonthlyTargetSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                    />
                  </div>
                  <select
                    value={monthlyTargetSalesFilter}
                    onChange={(e) => setMonthlyTargetSalesFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Sales ({allConfigurableStores.length})</option>
                    {availableSales.map((sales) => (
                      <option key={sales} value={sales}>
                        {sales}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Copy from other month & reset */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Salin dari:</span>
                  <select
                    value={monthlyTargetCopyFrom}
                    onChange={(e) => setMonthlyTargetCopyFrom(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-[11px] outline-none cursor-pointer"
                  >
                    {MONTH_OPTIONS_2026.map((m) => {
                      const val = `${m.bulanName} 2026`;
                      return (
                        <option key={m.key} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleCopyMonthlyTargetsFrom(monthlyTargetCopyFrom)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetMonthlyTargetDrafts}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Reset draft bulan ini ke nilai default"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Default</span>
                  </button>
                </div>
              </div>

              {/* Editable Table */}
              <div className="overflow-auto flex-1 border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-[10px] uppercase text-slate-600 font-black">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5">Toko &amp; BA / Sales</th>
                      <th className="p-2.5 text-right w-40">Target BA Non-Lavojoy (Rp)</th>
                      <th className="p-2.5 text-right w-36">Target Lavojoy (Rp)</th>
                      <th className="p-2.5 text-right w-44 bg-amber-50 text-amber-950">
                        Total Target BA + Lavojoy (Rp)
                      </th>
                      <th className="p-2.5 text-right w-32">Target Harian (/30)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredConfigStores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          Tidak ada toko yang cocok dengan filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredConfigStores.map((s, idx) => {
                        const draft = monthlyTargetDrafts[s.storeName] || {
                          nonLavojoy: Math.max(0, s.targetMonthly - DEFAULT_BA_LAVOJOY_TARGET),
                          lavojoy: DEFAULT_BA_LAVOJOY_TARGET,
                        };
                        const totalVal = draft.nonLavojoy + draft.lavojoy;
                        const dailyVal = Math.round(totalVal / 30);

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80">
                            <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-2">
                              <div className="font-black text-slate-900">{s.storeName}</div>
                              <div className="text-[10px] text-slate-500">
                                BA: <span className="font-semibold text-pink-700">{s.baName}</span> • Sales:{' '}
                                <span className="font-semibold text-blue-700">{s.salesName}</span>
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                value={draft.nonLavojoy}
                                onChange={(e) => {
                                  const nextNon = Math.max(0, Number(e.target.value) || 0);
                                  setMonthlyTargetDrafts((prev) => ({
                                    ...prev,
                                    [s.storeName]: { ...draft, nonLavojoy: nextNon },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                value={draft.lavojoy}
                                onChange={(e) => {
                                  const nextLav = Math.max(0, Number(e.target.value) || 0);
                                  setMonthlyTargetDrafts((prev) => ({
                                    ...prev,
                                    [s.storeName]: { ...draft, lavojoy: nextLav },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2 bg-amber-50/40">
                              <input
                                type="number"
                                step="any"
                                value={totalVal}
                                onChange={(e) => {
                                  const nextTotal = Math.max(0, Number(e.target.value) || 0);
                                  const nextLav = nextTotal >= draft.lavojoy ? draft.lavojoy : nextTotal;
                                  const nextNon = Math.max(0, nextTotal - nextLav);
                                  setMonthlyTargetDrafts((prev) => ({
                                    ...prev,
                                    [s.storeName]: { nonLavojoy: nextNon, lavojoy: nextLav },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-right font-mono font-black text-blue-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-600">
                              Rp {dailyVal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-200 mt-3 shrink-0">
                <div className="text-xs text-slate-600">
                  Total Target ({filteredConfigStores.length} toko) di{' '}
                  <strong className="text-slate-900">{monthlyTargetEditMonth}</strong>:{' '}
                  <span className="font-mono font-black text-blue-700 text-sm">
                    Rp {totalFilteredMonthlyTarget.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMonthlyTargetModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMonthlyTargets}
                    className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Target {monthlyTargetEditMonth}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: TAMBAH KOLOM TOKO BARU */}
      {isAddingStore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Tambah Kolom Toko Baru
              </h3>
              <button onClick={() => setIsAddingStore(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Kolom toko yang ditambahkan akan otomatis muncul di tabel Weekly Sell Out BA dan dapat diedit setiap saat.
            </p>

            <div className="space-y-3 mt-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Toko *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TOKO CANTIK RIAU"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Beauty Advisor (BA)</label>
                <input
                  type="text"
                  placeholder="Contoh: SITI NURHALIZA"
                  value={newBaName}
                  onChange={(e) => setNewBaName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Coveran Sales</label>
                  <input
                    type="text"
                    value={newSalesName}
                    onChange={(e) => setNewSalesName(e.target.value)}
                    placeholder="Contoh: ALBERT FERNANDO"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Trainer</label>
                  <input
                    type="text"
                    value={newTrainerName}
                    onChange={(e) => setNewTrainerName(e.target.value)}
                    placeholder="Contoh: ARA / RATIH"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Area</label>
                  <input
                    type="text"
                    value={newCoverArea}
                    onChange={(e) => setNewCoverArea(e.target.value)}
                    placeholder="PEKANBARU"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Region</label>
                  <input
                    type="text"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    placeholder="PEKAN BARU"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Bulanan (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={newTargetMonthly}
                  onChange={(e) => setNewTargetMonthly(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-blue-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kumulatif Awal (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    value={newCumulativeVal}
                    onChange={(e) => setNewCumulativeVal(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Performa Awal (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={newPerformaVal}
                    onChange={(e) => setNewPerformaVal(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-red-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={() => setIsAddingStore(false)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddStoreColumn}
                className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Kolom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KELOLA & KURANGI KOLOM TOKO */}
      {isManageStoresModalOpen && (() => {
        const deletedDraftSet = new Set(workingDeletedStores.map((n) => n.trim().toLowerCase()));

        // Filter master stores based on search, tab, and sales coveran
        const filteredStores = allMasterStores.filter((s) => {
          const sLower = s.storeName.trim().toLowerCase();
          const isDeleted = deletedDraftSet.has(sLower);

          // Tab filter
          if (manageStoresTab === 'active' && isDeleted) return false;
          if (manageStoresTab === 'deleted' && !isDeleted) return false;

          // Sales filter
          if (manageStoresSalesFilter !== 'ALL' && s.salesName.toLowerCase() !== manageStoresSalesFilter.toLowerCase()) {
            return false;
          }

          // Search query filter
          if (manageStoresSearch.trim()) {
            const q = manageStoresSearch.trim().toLowerCase();
            const matchName = s.storeName.toLowerCase().includes(q);
            const matchBa = s.baName.toLowerCase().includes(q);
            const matchSales = s.salesName.toLowerCase().includes(q);
            const matchTrainer = s.trainerName.toLowerCase().includes(q);
            if (!matchName && !matchBa && !matchSales && !matchTrainer) return false;
          }

          return true;
        });

        const activeDraftCount = allMasterStores.filter(
          (s) => !deletedDraftSet.has(s.storeName.trim().toLowerCase())
        ).length;
        const deletedDraftCount = allMasterStores.length - activeDraftCount;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-xs flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      Kelola &amp; Kurangi Kolom Toko Weekly Sell Out
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {activeDraftCount} Aktif
                      </span>
                      {deletedDraftCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          {deletedDraftCount} Dikurangi
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Centang (✓) untuk menampilkan kolom toko di tabel, atau uncheck / klik <strong>"Kurangi"</strong> untuk menghapus kolom. Klik tombol <strong className="text-emerald-700">"💾 SIMPAN &amp; TERAPKAN"</strong> untuk menyimpan perubahan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManageStoresModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-Filters and Quick Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 mb-2.5 shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                {/* Tabs */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setManageStoresTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      manageStoresTab === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Semua Toko</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
                      {allMasterStores.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManageStoresTab('active')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      manageStoresTab === 'active'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✓ Kolom Aktif</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      manageStoresTab === 'active' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {activeDraftCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManageStoresTab('deleted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      manageStoresTab === 'deleted'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✗ Toko Dikurangi</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      manageStoresTab === 'deleted' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {deletedDraftCount}
                    </span>
                  </button>
                </div>

                {/* Filter Sales Coveran */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600">Coveran:</span>
                  <select
                    value={manageStoresSalesFilter}
                    onChange={(e) => setManageStoresSalesFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">Semua Sales</option>
                    {availableSales.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari toko / BA / sales..."
                    value={manageStoresSearch}
                    onChange={(e) => setManageStoresSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                  />
                  {manageStoresSearch && (
                    <button
                      onClick={() => setManageStoresSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Action Bulk Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 mb-2 shrink-0">
                <span className="text-[11px] text-slate-500">
                  Menampilkan <strong>{filteredStores.length}</strong> dari total {allMasterStores.length} toko
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleActivateAllVisible(filteredStores.map((s) => s.storeName))}
                    className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                    title="Aktifkan semua toko yang sedang tampil"
                  >
                    ✓ Tampilkan Semua ({filteredStores.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcludeAllVisible(filteredStores.map((s) => s.storeName))}
                    className="px-2.5 py-1 text-[11px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                    title="Kurangi / sembunyikan semua toko yang sedang tampil"
                  >
                    − Kurangi Semua ({filteredStores.length})
                  </button>
                </div>
              </div>

              {/* Store List Body */}
              <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {filteredStores.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Tidak ada toko yang cocok dengan pencarian / filter ini.
                  </div>
                ) : (
                  filteredStores.map((s, idx) => {
                    const sLower = s.storeName.trim().toLowerCase();
                    const isExcluded = deletedDraftSet.has(sLower);

                    return (
                      <div
                        key={s.id || sLower}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          isExcluded ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox and info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => handleToggleStoreInDraft(s.storeName)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            title={isExcluded ? 'Klik untuk mengaktifkan kembali' : 'Klik untuk mengurangi/menyembunyikan'}
                          />
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-extrabold text-xs uppercase ${isExcluded ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {s.storeName}
                              </span>
                              {isExcluded ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                  ✗ Dikurangi (Sembunyi)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Aktif di Weekly
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-pink-700 font-bold bg-pink-50 px-1.5 py-0.2 rounded border border-pink-100">
                                BA: {s.baName}
                              </span>
                              <span>•</span>
                              <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                {s.salesName} ({s.trainerName})
                              </span>
                              <span>•</span>
                              <span className="font-mono text-slate-700 font-bold">
                                Target: Rp {formatNumber(s.targetMonthly)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions for this specific store */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isExcluded ? (
                            <button
                              type="button"
                              onClick={() => handleSetStoreExcludedInDraft(s.storeName, false)}
                              className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Tampilkan kembali toko ini di tabel weekly"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>+ Aktifkan Kolom</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetStoreExcludedInDraft(s.storeName, true)}
                              className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Hapus / kurangi toko ini dari tabel weekly"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>− Kurangi Kolom</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setIsManageStoresModalOpen(false);
                              handleOpenEditStore(s);
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Edit data BA & target toko"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer with Clear SAVE Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-200 mt-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreAllStores}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    title="Pulihkan semua kolom toko ke kondisi bawaan default (80 toko)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Pulihkan Semua Default (80 Toko)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManageStoresModalOpen(false);
                      setNewStoreName('');
                      setNewBaName('');
                      setIsAddingStore(true);
                    }}
                    className="px-3 py-2 text-xs font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Toko Baru</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsManageStoresModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManageStores}
                    className="px-5 py-2.5 text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Simpan perubahan toko dan segera terapkan ke tabel Weekly Sell Out"
                  >
                    <Save className="w-4 h-4" />
                    <span>💾 SIMPAN &amp; TERAPKAN PERUBAHAN ({activeDraftCount} TOKO AKTIF)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUICK INLINE EDIT MODAL */}
      {inlineEditCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-slate-900">Edit Nilai Sell Out</h4>
              <button onClick={() => setInlineEditCell(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-bold text-slate-700">{inlineEditCell.storeName}</div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{inlineEditCell.dateKey}</div>

              <div className="mt-3">
                <label className="font-bold text-slate-700 block mb-1">Nominal Rupiah (Rp)</label>
                <input
                  type="text"
                  autoFocus
                  value={inlineInputVal}
                  onChange={(e) => setInlineInputVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-blue-400 bg-blue-50/50 font-mono font-black text-slate-900 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
              <button
                onClick={() => setInlineEditCell(null)}
                className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleSaveInlineCell}
                className="px-3 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PERSEN TARGET */}
      {isEditingPersenTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-slate-900">Edit Persen Target</h4>
              <button onClick={() => setIsEditingPersenTarget(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <label className="font-bold text-slate-700 block mb-1">Nilai Persen Target (%)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={inputPersenTarget}
                onChange={(e) => setInputPersenTarget(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-blue-400 bg-blue-50/50 font-mono font-black text-slate-900 text-sm focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 100% (sesuai instruksi revisi)
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => {
                  setCustomPersenTarget(100);
                  try {
                    localStorage.setItem('salespro_weekly_persen_target', '100');
                  } catch (e) {
                    console.warn(e);
                  }
                  setIsEditingPersenTarget(false);
                  showToast('Persen target direset ke 100%!');
                }}
                className="px-2.5 py-1.5 font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Reset 100%
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingPersenTarget(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomPersenTarget(inputPersenTarget);
                    try {
                      localStorage.setItem('salespro_weekly_persen_target', JSON.stringify(inputPersenTarget));
                    } catch (e) {
                      console.warn(e);
                    }
                    setIsEditingPersenTarget(false);
                    showToast(`Persen target diubah menjadi ${inputPersenTarget}%!`);
                  }}
                  className="px-3.5 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW SCREENSHOT & UNDUH PNG */}
      {screenshotPreviewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Preview Screenshot Laporan Weekly Sell Out BA
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {selectedWeek} • {selectedMonth}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setScreenshotPreviewUrl(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 overflow-auto flex-1 border border-slate-200 rounded-xl bg-slate-100 p-2 text-center">
              <img
                src={screenshotPreviewUrl}
                alt="Screenshot Review Weekly Sell Out BA"
                className="mx-auto rounded-lg shadow-xs max-w-full h-auto object-contain"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500 text-[11px]">
                *File screenshot sudah dibuat. Jika otomatis tidak terunduh, klik tombol <strong>"Unduh File PNG"</strong> atau klik kanan pada gambar &gt; <em>Simpan gambar sebagai...</em>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreenshotPreviewUrl(null)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                <a
                  href={screenshotPreviewUrl}
                  download={`Laporan_Weekly_SellOut_BA_${selectedWeek.replace(/\s+/g, '_')}_${selectedMonth.replace(/\s+/g, '_')}.png`}
                  className="px-4 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh File PNG
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
