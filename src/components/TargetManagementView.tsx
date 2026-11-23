import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  MapPin,
  Building2,
  Users,
  Store,
  GraduationCap,
  Calendar,
  Edit3,
  Sliders,
  Check,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Search,
  Calculator,
  Sparkles,
  TrendingUp,
  X,
  Plus,
  Save,
  Copy,
} from 'lucide-react';
import {
  TransactionRecord,
  DashboardFilters,
  AreaTargetItem,
  SpvTargetItem,
  SalesTargetItem,
  BaTargetItem,
  TrainerTargetItem,
} from '../types/dashboard';
import {
  aggregateTargetMatrix,
  saveAreaTargets,
  saveAreaSellOutTargets,
  saveSpvTargets,
  saveSpvSellOutTargets,
  saveSalesTargets,
  saveSalesSellOutTargets,
  saveBaNonLavojoyTargets,
  saveBaLavojoyTargets,
  saveBaFocusTargets,
  saveTrainerTargets,
  loadTrainerTargets,
  setSingleTargetOverride,
  setSingleTrainerTargetOverride,
  applySingleBaTargetToAllMonths,
  copyBaTargetsToAllMonths,
  applyUniformBaTargets,
  copyMonthTargets,
  resetMonthTargets,
  getMonthCustomizationSummary,
  getConfiguredMonthKeys,
  getMonthDisplayLabel,
  normalizeMonthKey,
  MONTH_OPTIONS_2026,
  TARGETS_UPDATED_EVENT,
  DEFAULT_AREA_TARGET,
  DEFAULT_AREA_SELLOUT_TARGET,
  DEFAULT_SPV_TARGET,
  DEFAULT_SPV_SELLOUT_TARGET,
  DEFAULT_SALES_TARGET,
  DEFAULT_SALES_SELLOUT_TARGET,
  DEFAULT_BA_NON_LAVOJOY_TARGET,
  DEFAULT_BA_LAVOJOY_TARGET,
  DEFAULT_TRAINER_SELL_OUT_TARGET,
  DEFAULT_TRAINER_FOCUS_TARGET_PCS,
  loadTrainerConfigs,
  saveTrainerConfigs,
  loadCustomBaProfiles,
  saveCustomBaProfiles,
  TrainerTargetConfig,
} from '../services/targetManagementService';
import {
  DEFAULT_FOCUS_TARGET_PCS,
} from '../services/focusProductService';
import { formatRupiah } from '../utils/analytics';
import * as XLSX from 'xlsx';

interface TargetManagementViewProps {
  records: TransactionRecord[];
  allRecords?: TransactionRecord[];
  filters: DashboardFilters;
  onTargetUpdated?: () => void;
}

export const TargetManagementView: React.FC<TargetManagementViewProps> = ({
  records,
  allRecords,
  filters,
  onTargetUpdated,
}) => {
  const sourceRecords = useMemo(() => {
    return allRecords && allRecords.length > 0 ? allRecords : records;
  }, [allRecords, records]);

  // Active sub-tab: area | spv | sales | ba | trainer
  const [subTab, setSubTab] = useState<'area' | 'spv' | 'sales' | 'ba' | 'trainer'>('sales');

  // Selected Target Month (Setiap bulan Januari-Desember memiliki target tersendiri untuk seluruh menu)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      const norm = normalizeMonthKey(filters.BULAN);
      if (norm !== 'ALL') return norm;
    }
    return filters.BULAN === 'ALL' ? 'ALL' : '2026-10';
  });

  // Sync if top FilterBar month changes explicitly (including 'ALL' -> Akumulasi Semua Bulan)
  useEffect(() => {
    if (!filters.BULAN) return;
    if (filters.BULAN === 'ALL') {
      setSelectedMonth('ALL');
    } else {
      const norm = normalizeMonthKey(filters.BULAN);
      if (norm !== 'ALL') setSelectedMonth(norm);
    }
  }, [filters.BULAN]);

  // Trigger re-render when local storage updates (from here or any other menu)
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener(TARGETS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(TARGETS_UPDATED_EVENT, handler);
  }, []);

  // Search & Status filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'achieved' | 'on_track' | 'lagging'>('all');

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Modals
  // 1. Edit Area Modal (Sell In & Sell Out)
  const [editingArea, setEditingArea] = useState<AreaTargetItem | null>(null);
  const [areaTargetInput, setAreaTargetInput] = useState<number>(DEFAULT_AREA_TARGET);
  const [areaSellOutInput, setAreaSellOutInput] = useState<number>(DEFAULT_AREA_SELLOUT_TARGET);

  // 2. Edit SPV Modal (Sell In & Sell Out)
  const [editingSpv, setEditingSpv] = useState<SpvTargetItem | null>(null);
  const [spvTargetInput, setSpvTargetInput] = useState<number>(DEFAULT_SPV_TARGET);
  const [spvSellOutInput, setSpvSellOutInput] = useState<number>(DEFAULT_SPV_SELLOUT_TARGET);

  // 3. Edit Sales Modal (Sell In & Sell Out per bulan)
  const [editingSales, setEditingSales] = useState<SalesTargetItem | null>(null);
  const [salesTargetInput, setSalesTargetInput] = useState<number>(DEFAULT_SALES_TARGET);
  const [salesSellOutInput, setSalesSellOutInput] = useState<number>(DEFAULT_SALES_SELLOUT_TARGET);

  // 4. Edit BA Modal
  const [editingBa, setEditingBa] = useState<BaTargetItem | null>(null);
  const [baNameInput, setBaNameInput] = useState<string>('');
  const [baStoreNameInput, setBaStoreNameInput] = useState<string>('');
  const [baSalesNameInput, setBaSalesNameInput] = useState<string>('');
  const [baNonLavojoyInput, setBaNonLavojoyInput] = useState<number>(DEFAULT_BA_NON_LAVOJOY_TARGET);
  const [baLavojoyInput, setBaLavojoyInput] = useState<number>(DEFAULT_BA_LAVOJOY_TARGET);
  const [baFocusInput, setBaFocusInput] = useState<number>(DEFAULT_FOCUS_TARGET_PCS);
  const [baApplyAllMonths, setBaApplyAllMonths] = useState<boolean>(false);

  // Add New Store & BA Modal
  const [isAddBaOpen, setIsAddBaOpen] = useState(false);
  const [newBaStoreName, setNewBaStoreName] = useState('');
  const [newBaName, setNewBaName] = useState('');
  const [newBaNumber, setNewBaNumber] = useState('');
  const [newBaArea, setNewBaArea] = useState('PEKANBARU');
  const [newBaSales, setNewBaSales] = useState('ILHAMSYAH');
  const [newBaNonLavojoyTarget, setNewBaNonLavojoyTarget] = useState<number>(DEFAULT_BA_NON_LAVOJOY_TARGET);
  const [newBaLavojoyTarget, setNewBaLavojoyTarget] = useState<number>(DEFAULT_BA_LAVOJOY_TARGET);
  const [newBaFocusTarget, setNewBaFocusTarget] = useState<number>(DEFAULT_FOCUS_TARGET_PCS);
  const [newBaApplyAllMonths, setNewBaApplyAllMonths] = useState<boolean>(true);

  // Dedicated Setting Target BA 1 Bulan -> Semua Bulan Sama Modal
  const [isBaAllMonthsOpen, setIsBaAllMonthsOpen] = useState(false);
  const [baAllMonthsMode, setBaAllMonthsMode] = useState<'copy_month' | 'uniform'>('copy_month');
  const [baAllMonthsSourceMonth, setBaAllMonthsSourceMonth] = useState<string>('2026-10');
  const [baAllMonthsNonLav, setBaAllMonthsNonLav] = useState<number>(DEFAULT_BA_NON_LAVOJOY_TARGET);
  const [baAllMonthsLav, setBaAllMonthsLav] = useState<number>(DEFAULT_BA_LAVOJOY_TARGET);
  const [baAllMonthsFocus, setBaAllMonthsFocus] = useState<number>(DEFAULT_FOCUS_TARGET_PCS);
  const [baAllMonthsScope, setBaAllMonthsScope] = useState<'ALL_MONTHS' | 'current'>('ALL_MONTHS');

  // 5. Edit Trainer Modal
  const [editingTrainer, setEditingTrainer] = useState<TrainerTargetItem | null>(null);
  const [trainerNameInput, setTrainerNameInput] = useState<string>('');
  const [trainerAreaInput, setTrainerAreaInput] = useState<string>('');
  const [trainerRegionInput, setTrainerRegionInput] = useState<string>('');
  const [trainerBaCountInput, setTrainerBaCountInput] = useState<number>(0);
  const [trainerSellOutInput, setTrainerSellOutInput] = useState<number>(DEFAULT_TRAINER_SELL_OUT_TARGET);
  const [trainerFocusInput, setTrainerFocusInput] = useState<number>(DEFAULT_TRAINER_FOCUS_TARGET_PCS);
  const [trainerNotesInput, setTrainerNotesInput] = useState<string>('');

  // Inline Edit Total BA Binaan di Tabel Target Trainer
  const [inlineEditingTrainerBaId, setInlineEditingTrainerBaId] = useState<string | null>(null);
  const [inlineTrainerBaValue, setInlineTrainerBaValue] = useState<string>('');

  // Add New Trainer Modal
  const [isAddTrainerOpen, setIsAddTrainerOpen] = useState(false);
  const [newTrainerName, setNewTrainerName] = useState('');
  const [newTrainerArea, setNewTrainerArea] = useState('');
  const [newTrainerRegion, setNewTrainerRegion] = useState('PEKAN BARU');
  const [newTrainerBaCount, setNewTrainerBaCount] = useState<number>(10);
  const [newTrainerSellOut, setNewTrainerSellOut] = useState<number>(DEFAULT_TRAINER_SELL_OUT_TARGET);
  const [newTrainerFocus, setNewTrainerFocus] = useState<number>(DEFAULT_TRAINER_FOCUS_TARGET_PCS);
  const [newTrainerNotes, setNewTrainerNotes] = useState('');

  // KET Filter (Semua, SELL IN, SELL OUT)
  const [ketFilter, setKetFilter] = useState<'ALL' | 'SELL IN' | 'SELL OUT'>(() => {
    if (filters.KET === 'SELL IN' || filters.KET === 'SELL OUT') return filters.KET;
    return 'ALL';
  });

  // 6. Batch Target Modal
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchTargetType, setBatchTargetType] = useState<
    'area' | 'area_out' | 'spv' | 'spv_out' | 'sales' | 'sales_out' | 'ba_non' | 'ba_lav' | 'ba_focus' | 'trainer_so' | 'trainer_focus'
  >('sales');
  const [batchTargetValue, setBatchTargetValue] = useState<number>(150000000);
  const [batchBaApplyAllMonths, setBatchBaApplyAllMonths] = useState<boolean>(false);

  // 7. Copy Month Targets Modal
  const [isCopyMonthOpen, setIsCopyMonthOpen] = useState(false);
  const [copySourceMonth, setCopySourceMonth] = useState<string>('2026-10');
  const [copyDestMonths, setCopyDestMonths] = useState<string[]>([]);

  // 8. Reset Confirm Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Aggregate target matrix data respecting selectedMonth (using full sourceRecords)
  const matrixData = useMemo(() => {
    return aggregateTargetMatrix(sourceRecords, selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRecords, selectedMonth, refreshKey]);

  // Automatic accumulation across ALL months that have configured targets
  const allConfiguredMatrix = useMemo(() => {
    return selectedMonth === 'ALL' ? matrixData : aggregateTargetMatrix(sourceRecords, 'ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRecords, selectedMonth, matrixData, refreshKey]);

  const monthCustomCounts = useMemo(() => {
    return getMonthCustomizationSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const configuredMonthKeys = useMemo(() => {
    return getConfiguredMonthKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const activeMonthLabel = useMemo(() => {
    if (selectedMonth === 'ALL' && configuredMonthKeys.length > 0) {
      return `Semua Bulan (${configuredMonthKeys.length} Bln Diset)`;
    }
    return getMonthDisplayLabel(selectedMonth);
  }, [selectedMonth, configuredMonthKeys.length]);

  const baSourceMonthPreview = useMemo(() => {
    if (!isBaAllMonthsOpen) return null;
    const srcMatrix = aggregateTargetMatrix(sourceRecords, baAllMonthsSourceMonth, { singleMonthBaselineOnly: true });
    return {
      baCount: srcMatrix.bas.length,
      totalNonLav: srcMatrix.bas.reduce((acc, b) => acc + b.targetNonLavojoy, 0),
      totalLav: srcMatrix.bas.reduce((acc, b) => acc + b.targetLavojoy, 0),
      totalFocusPcs: srcMatrix.bas.reduce((acc, b) => acc + b.targetFocusPcs, 0),
    };
  }, [isBaAllMonthsOpen, sourceRecords, baAllMonthsSourceMonth, refreshKey]);

  // Handlers for Saving Single Targets (All scoped per selectedMonth!)
  const handleSaveAreaTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    setSingleTargetOverride('area', editingArea.coverArea, areaTargetInput, selectedMonth);
    setSingleTargetOverride('areaSellOut', editingArea.coverArea, areaSellOutInput, selectedMonth);
    setEditingArea(null);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Target Area "${editingArea.coverArea}" (${activeMonthLabel}) disimpan — Sell In: ${formatRupiah(areaTargetInput)}, Sell Out: ${formatRupiah(areaSellOutInput)}`
    );
  };

  const handleSaveSpvTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpv) return;
    setSingleTargetOverride('spv', editingSpv.spvName, spvTargetInput, selectedMonth);
    setSingleTargetOverride('spvSellOut', editingSpv.spvName, spvSellOutInput, selectedMonth);
    setEditingSpv(null);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Target SPV "${editingSpv.spvName}" (${activeMonthLabel}) disimpan — Sell In: ${formatRupiah(spvTargetInput)}, Sell Out: ${formatRupiah(spvSellOutInput)}`
    );
  };

  const handleSaveSalesTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSales) return;
    setSingleTargetOverride('sales', editingSales.salesName, salesTargetInput, selectedMonth);
    setSingleTargetOverride('salesSellOut', editingSales.salesName, salesSellOutInput, selectedMonth);
    setEditingSales(null);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Target Sales "${editingSales.salesName}" (${activeMonthLabel}) disimpan — Sell In: ${formatRupiah(salesTargetInput)}, Sell Out: ${formatRupiah(salesSellOutInput)}`
    );
  };

  const handleSaveBaTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBa) return;

    const targetStoreKey = baStoreNameInput.trim().toUpperCase() || editingBa.storeName;
    const updatedBaName = baNameInput.trim().toUpperCase() || editingBa.baName;
    const updatedSalesName = baSalesNameInput.trim().toUpperCase() || editingBa.salesName;

    // Persist profile changes (BA Name, Store Name(s), Sales) without creating duplicate rows for merged stores
    const profiles = loadCustomBaProfiles();
    const storeParts = targetStoreKey.split(',').map((s) => s.trim()).filter(Boolean);
    const isSingleStoreEdit = storeParts.length <= 1 && (!editingBa.storeNames || editingBa.storeNames.length <= 1);
    const profileKey = isSingleStoreEdit ? targetStoreKey : updatedBaName;
    if (editingBa.baName && editingBa.baName.toUpperCase() !== updatedBaName && profiles[editingBa.baName]) {
      delete profiles[editingBa.baName];
    }
    profiles[profileKey] = {
      originalStoreName:
        isSingleStoreEdit && editingBa.storeName !== targetStoreKey
          ? editingBa.storeName
          : profiles[editingBa.storeName]?.originalStoreName,
      storeName: targetStoreKey,
      baName: updatedBaName,
      baNumber: editingBa.baNumber,
      coverArea: editingBa.coverArea,
      region: editingBa.region,
      salesName: updatedSalesName,
      spv: editingBa.spv,
    };
    saveCustomBaProfiles(profiles);

    // Save BA targets strictly by BA Name (1 BA = 1 target across all covered stores)
    if (baApplyAllMonths) {
      applySingleBaTargetToAllMonths(updatedBaName, {
        targetNonLavojoy: baNonLavojoyInput,
        targetLavojoy: baLavojoyInput,
        targetFocusPcs: baFocusInput,
      });
    } else {
      setSingleTargetOverride('baNonLavojoy', updatedBaName, baNonLavojoyInput, selectedMonth);
      setSingleTargetOverride('baLavojoy', updatedBaName, baLavojoyInput, selectedMonth);
      setSingleTargetOverride('baFocus', updatedBaName, baFocusInput, selectedMonth);
    }

    setEditingBa(null);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      baApplyAllMonths
        ? `Target BA "${updatedBaName}" (${targetStoreKey}) disamakan untuk SEMUA BULAN (Jan–Des 2026)!`
        : `Target & Data BA "${updatedBaName}" (${activeMonthLabel}) berhasil diperbarui!`
    );
  };

  const handleAddNewStoreBa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBaStoreName.trim()) return;
    const storeName = newBaStoreName.trim().toUpperCase();
    const baName = newBaName.trim().toUpperCase() || 'BA BARU';
    const areaName = newBaArea.trim().toUpperCase() || 'PEKANBARU';
    const salesName = newBaSales.trim().toUpperCase() || 'ILHAMSYAH';

    const profiles = loadCustomBaProfiles();
    profiles[storeName] = {
      storeName,
      baName,
      baNumber: newBaNumber.trim().toUpperCase() || 'BA-NEW',
      coverArea: areaName,
      region: areaName,
      salesName,
      spv: 'WIDODO',
    };
    saveCustomBaProfiles(profiles);

    const baTargetKey = baName || storeName;
    if (newBaApplyAllMonths) {
      applySingleBaTargetToAllMonths(baTargetKey, {
        targetNonLavojoy: newBaNonLavojoyTarget,
        targetLavojoy: newBaLavojoyTarget,
        targetFocusPcs: newBaFocusTarget,
      });
    } else {
      setSingleTargetOverride('baNonLavojoy', baTargetKey, newBaNonLavojoyTarget, selectedMonth);
      setSingleTargetOverride('baLavojoy', baTargetKey, newBaLavojoyTarget, selectedMonth);
      setSingleTargetOverride('baFocus', baTargetKey, newBaFocusTarget, selectedMonth);
    }

    setIsAddBaOpen(false);
    setNewBaStoreName('');
    setNewBaName('');
    setNewBaNumber('');
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      newBaApplyAllMonths
        ? `Toko & BA baru "${baName}" (${storeName}) ditambahkan dengan target sama untuk semua bulan (Jan–Des 2026)!`
        : `Toko & BA baru "${baName}" (${storeName}) ditambahkan ke periode ${activeMonthLabel}!`
    );
  };

  const handleApplyBaAllMonths = (e: React.FormEvent) => {
    e.preventDefault();
    if (baAllMonthsMode === 'copy_month') {
      const { baCount, monthCount } = copyBaTargetsToAllMonths(baAllMonthsSourceMonth, sourceRecords);
      setIsBaAllMonthsOpen(false);
      setRefreshKey((k) => k + 1);
      if (onTargetUpdated) onTargetUpdated();
      showNotification(
        `Target BA dari ${getMonthDisplayLabel(baAllMonthsSourceMonth)} (${baCount} BA) berhasil disamakan ke seluruh ${monthCount} bulan (Jan–Des 2026)!`
      );
      return;
    }

    const baKeys = matrixData.bas.map((b) => b.baName || b.storeName);
    applyUniformBaTargets(
      baKeys,
      {
        targetNonLavojoy: baAllMonthsNonLav,
        targetLavojoy: baAllMonthsLav,
        targetFocusPcs: baAllMonthsFocus,
      },
      baAllMonthsScope,
      selectedMonth
    );
    setIsBaAllMonthsOpen(false);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      baAllMonthsScope === 'ALL_MONTHS'
        ? `Target BA 1 bulan (Non-Lav ${formatRupiah(baAllMonthsNonLav)}, Lav ${formatRupiah(baAllMonthsLav)}, Fokus ${baAllMonthsFocus} pcs) diterapkan SAMA ke semua 12 bulan (Jan–Des 2026)!`
        : `Target BA seragam diterapkan ke ${baKeys.length} BA untuk periode ${activeMonthLabel}!`
    );
  };

  // 5. Handler for Saving Trainer Target & Profile
  const handleSaveTrainerTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrainer) return;

    const cleanBaCount = Math.max(0, Math.round(Number(trainerBaCountInput) || 0));
    const allTrainers = loadTrainerConfigs();
    const updatedTrainers = allTrainers.map((t) => {
      if (t.id === editingTrainer.id) {
        return {
          ...t,
          trainerName: trainerNameInput.trim().toUpperCase() || t.trainerName,
          areaCovered: trainerAreaInput.trim() || t.areaCovered,
          region: trainerRegionInput.trim() || t.region,
          baSupervisedCount: cleanBaCount,
          notes: trainerNotesInput.trim() || t.notes,
        };
      }
      return t;
    });
    saveTrainerConfigs(updatedTrainers);

    setSingleTrainerTargetOverride(
      editingTrainer.id,
      {
        targetSellOut: trainerSellOutInput,
        targetProdukFokusPcs: trainerFocusInput,
        baSupervisedCount: cleanBaCount,
        notes: trainerNotesInput,
      },
      selectedMonth
    );

    setEditingTrainer(null);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Target Trainer "${trainerNameInput || editingTrainer.trainerName}" (${activeMonthLabel}) disimpan: ${cleanBaCount} BA, SO ${formatRupiah(trainerSellOutInput)} & Fokus ${trainerFocusInput} pcs`
    );
  };

  // Inline Save Handler for Trainer Total BA Binaan
  const handleSaveInlineTrainerBaCount = (item: TrainerTargetItem) => {
    const cleanBaCount = Math.max(0, Math.round(Number(inlineTrainerBaValue) || 0));
    const allTrainers = loadTrainerConfigs();
    const updatedTrainers = allTrainers.map((t) =>
      t.id === item.id ? { ...t, baSupervisedCount: cleanBaCount } : t
    );
    saveTrainerConfigs(updatedTrainers);

    setSingleTrainerTargetOverride(
      item.id,
      { baSupervisedCount: cleanBaCount },
      selectedMonth
    );

    setInlineEditingTrainerBaId(null);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Total BA Binaan Trainer "${item.trainerName}" (${activeMonthLabel}) diubah menjadi ${cleanBaCount} BA.`
    );
  };

  // Handler for Adding New Trainer
  const handleAddNewTrainer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrainerName.trim()) return;
    const allTrainers = loadTrainerConfigs();
    const newId = `trn-${Date.now()}`;
    const cleanBaCount = Math.max(0, Math.round(Number(newTrainerBaCount) || 0));
    const newConfig: TrainerTargetConfig = {
      id: newId,
      trainerName: newTrainerName.trim().toUpperCase(),
      areaCovered: newTrainerArea.trim() || 'AREA OPERASIONAL RIAU',
      region: newTrainerRegion.trim() || 'PEKAN BARU',
      targetSellOut: newTrainerSellOut,
      targetProdukFokusPcs: newTrainerFocus,
      baSupervisedCount: cleanBaCount,
      notes: newTrainerNotes.trim(),
    };
    allTrainers.push(newConfig);
    saveTrainerConfigs(allTrainers);

    setSingleTrainerTargetOverride(
      newId,
      {
        targetSellOut: newTrainerSellOut,
        targetProdukFokusPcs: newTrainerFocus,
        baSupervisedCount: cleanBaCount,
        notes: newTrainerNotes.trim(),
      },
      selectedMonth
    );

    setIsAddTrainerOpen(false);
    setNewTrainerName('');
    setNewTrainerArea('');
    setNewTrainerNotes('');
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(`Trainer baru "${newConfig.trainerName}" berhasil ditambahkan untuk ${activeMonthLabel}!`);
  };

  // Handler for Batch Target Setting (per selectedMonth!)
  const handleApplyBatchTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchTargetType === 'area') {
      const current: Record<string, number> = {};
      matrixData.areas.forEach((a) => {
        current[a.coverArea] = batchTargetValue;
      });
      saveAreaTargets(current, selectedMonth);
      showNotification(`Target Sell In serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.areas.length} Area!`);
    } else if (batchTargetType === 'area_out') {
      const current: Record<string, number> = {};
      matrixData.areas.forEach((a) => {
        current[a.coverArea] = batchTargetValue;
      });
      saveAreaSellOutTargets(current, selectedMonth);
      showNotification(`Target Sell Out serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.areas.length} Area!`);
    } else if (batchTargetType === 'spv') {
      const current: Record<string, number> = {};
      matrixData.spvs.forEach((s) => {
        current[s.spvName] = batchTargetValue;
      });
      saveSpvTargets(current, selectedMonth);
      showNotification(`Target Sell In serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.spvs.length} SPV!`);
    } else if (batchTargetType === 'spv_out') {
      const current: Record<string, number> = {};
      matrixData.spvs.forEach((s) => {
        current[s.spvName] = batchTargetValue;
      });
      saveSpvSellOutTargets(current, selectedMonth);
      showNotification(`Target Sell Out serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.spvs.length} SPV!`);
    } else if (batchTargetType === 'sales') {
      const current: Record<string, number> = {};
      matrixData.sales.forEach((sl) => {
        current[sl.salesName] = batchTargetValue;
      });
      saveSalesTargets(current, selectedMonth);
      showNotification(`Target Sell In serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.sales.length} Sales!`);
    } else if (batchTargetType === 'sales_out') {
      const current: Record<string, number> = {};
      matrixData.sales.forEach((sl) => {
        current[sl.salesName] = batchTargetValue;
      });
      saveSalesSellOutTargets(current, selectedMonth);
      showNotification(`Target Sell Out serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.sales.length} Sales!`);
    } else if (batchTargetType === 'ba_non') {
      if (batchBaApplyAllMonths) {
        applyUniformBaTargets(
          matrixData.bas.map((b) => b.baName || b.storeName),
          { targetNonLavojoy: batchTargetValue },
          'ALL_MONTHS'
        );
        showNotification(`Target Non-Lavojoy ${formatRupiah(batchTargetValue)} diterapkan SAMA ke semua 12 bulan (Jan–Des 2026) untuk ${matrixData.bas.length} BA!`);
      } else {
        const current: Record<string, number> = {};
        matrixData.bas.forEach((b) => {
          current[b.baName || b.storeName] = batchTargetValue;
        });
        saveBaNonLavojoyTargets(current, selectedMonth);
        showNotification(`Target Non-Lavojoy serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.bas.length} BA!`);
      }
    } else if (batchTargetType === 'ba_lav') {
      if (batchBaApplyAllMonths) {
        applyUniformBaTargets(
          matrixData.bas.map((b) => b.baName || b.storeName),
          { targetLavojoy: batchTargetValue },
          'ALL_MONTHS'
        );
        showNotification(`Target Lavojoy ${formatRupiah(batchTargetValue)} diterapkan SAMA ke semua 12 bulan (Jan–Des 2026) untuk ${matrixData.bas.length} BA!`);
      } else {
        const current: Record<string, number> = {};
        matrixData.bas.forEach((b) => {
          current[b.baName || b.storeName] = batchTargetValue;
        });
        saveBaLavojoyTargets(current, selectedMonth);
        showNotification(`Target Lavojoy serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke ${matrixData.bas.length} BA!`);
      }
    } else if (batchTargetType === 'ba_focus') {
      if (batchBaApplyAllMonths) {
        applyUniformBaTargets(
          matrixData.bas.map((b) => b.baName || b.storeName),
          { targetFocusPcs: batchTargetValue },
          'ALL_MONTHS'
        );
        showNotification(`Target Produk Fokus ${batchTargetValue} pcs diterapkan SAMA ke semua 12 bulan (Jan–Des 2026) untuk ${matrixData.bas.length} BA!`);
      } else {
        const current: Record<string, number> = {};
        matrixData.bas.forEach((b) => {
          current[b.baName || b.storeName] = batchTargetValue;
        });
        saveBaFocusTargets(current, selectedMonth);
        showNotification(`Target Produk Fokus serentak ${batchTargetValue} pcs (${activeMonthLabel}) diterapkan ke ${matrixData.bas.length} BA!`);
      }
    } else if (batchTargetType === 'trainer_so') {
      const current = loadTrainerTargets(selectedMonth);
      matrixData.trainers.forEach((t) => {
        if (!current[t.id]) current[t.id] = {};
        current[t.id].targetSellOut = batchTargetValue;
      });
      saveTrainerTargets(current, selectedMonth);
      showNotification(`Target Trainer Sell Out serentak ${formatRupiah(batchTargetValue)} (${activeMonthLabel}) diterapkan ke seluruh Trainer!`);
    } else if (batchTargetType === 'trainer_focus') {
      const current = loadTrainerTargets(selectedMonth);
      matrixData.trainers.forEach((t) => {
        if (!current[t.id]) current[t.id] = {};
        current[t.id].targetProdukFokusPcs = batchTargetValue;
      });
      saveTrainerTargets(current, selectedMonth);
      showNotification(`Target Trainer Produk Fokus serentak ${batchTargetValue} pcs (${activeMonthLabel}) diterapkan ke seluruh Trainer!`);
    }

    setIsBatchOpen(false);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
  };

  // Auto-Sum from Team (per selectedMonth!)
  const handleAutoSumSpvFromSales = (spvItem: SpvTargetItem) => {
    const teamSales = matrixData.sales.filter((s) => s.spv.trim().toUpperCase() === spvItem.spvName.trim().toUpperCase());
    const sumTarget = teamSales.reduce((acc, s) => acc + s.targetSellIn, 0);
    const sumSellOutTarget = teamSales.reduce((acc, s) => acc + (s.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET), 0);
    const targetToSet = sumTarget > 0 ? sumTarget : DEFAULT_SPV_TARGET;
    const sellOutToSet = sumSellOutTarget > 0 ? sumSellOutTarget : DEFAULT_SPV_SELLOUT_TARGET;

    setSingleTargetOverride('spv', spvItem.spvName, targetToSet, selectedMonth);
    setSingleTargetOverride('spvSellOut', spvItem.spvName, sellOutToSet, selectedMonth);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Target SPV "${spvItem.spvName}" (${activeMonthLabel}) dihitung dari ${teamSales.length} sales — Sell In: ${formatRupiah(targetToSet)}, Sell Out: ${formatRupiah(sellOutToSet)}`
    );
  };

  const handleAutoSumAreaFromSales = (areaItem: AreaTargetItem) => {
    const areaSales = matrixData.sales.filter((s) => s.coverArea.trim().toUpperCase() === areaItem.coverArea.trim().toUpperCase());
    const sumTarget = areaSales.reduce((acc, s) => acc + s.targetSellIn, 0);
    const sumSellOutTarget = areaSales.reduce((acc, s) => acc + (s.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET), 0);
    const targetToSet = sumTarget > 0 ? sumTarget : DEFAULT_AREA_TARGET;
    const sellOutToSet = sumSellOutTarget > 0 ? sumSellOutTarget : DEFAULT_AREA_SELLOUT_TARGET;

    setSingleTargetOverride('area', areaItem.coverArea, targetToSet, selectedMonth);
    setSingleTargetOverride('areaSellOut', areaItem.coverArea, sellOutToSet, selectedMonth);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Target Area "${areaItem.coverArea}" (${activeMonthLabel}) dihitung dari ${areaSales.length} sales — Sell In: ${formatRupiah(targetToSet)}, Sell Out: ${formatRupiah(sellOutToSet)}`
    );
  };

  const handleBatchAutoSumAreasFromSales = () => {
    const nextMap: Record<string, number> = {};
    const nextOutMap: Record<string, number> = {};
    matrixData.areas.forEach((a) => {
      const areaSales = matrixData.sales.filter(
        (s) => s.coverArea.trim().toUpperCase() === a.coverArea.trim().toUpperCase()
      );
      const sumTarget = areaSales.reduce((acc, s) => acc + s.targetSellIn, 0);
      const sumOutTarget = areaSales.reduce((acc, s) => acc + (s.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET), 0);
      nextMap[a.coverArea] = sumTarget > 0 ? sumTarget : a.targetOmzet;
      nextOutMap[a.coverArea] = sumOutTarget > 0 ? sumOutTarget : (a.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET);
    });
    saveAreaTargets(nextMap, selectedMonth);
    saveAreaSellOutTargets(nextOutMap, selectedMonth);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(`Seluruh Target Sell In & Sell Out Area (${activeMonthLabel}) disinkronkan otomatis dari Total Target Sales!`);
  };

  const handleBatchAutoSumSpvsFromSales = () => {
    const nextMap: Record<string, number> = {};
    const nextOutMap: Record<string, number> = {};
    matrixData.spvs.forEach((spvItem) => {
      const teamSales = matrixData.sales.filter(
        (s) => s.spv.trim().toUpperCase() === spvItem.spvName.trim().toUpperCase()
      );
      const sumTarget = teamSales.reduce((acc, s) => acc + s.targetSellIn, 0);
      const sumOutTarget = teamSales.reduce((acc, s) => acc + (s.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET), 0);
      nextMap[spvItem.spvName] = sumTarget > 0 ? sumTarget : spvItem.targetOmzet;
      nextOutMap[spvItem.spvName] = sumOutTarget > 0 ? sumOutTarget : (spvItem.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET);
    });
    saveSpvTargets(nextMap, selectedMonth);
    saveSpvSellOutTargets(nextOutMap, selectedMonth);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(`Seluruh Target Sell In & Sell Out SPV (${activeMonthLabel}) disinkronkan otomatis dari Total Target Sales!`);
  };

  // Copy Targets Across Months
  const handleApplyCopyMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (copyDestMonths.length === 0) {
      showNotification('Pilih minimal 1 bulan tujuan salin target.', 'error');
      return;
    }
    const count = copyMonthTargets(copySourceMonth, copyDestMonths, sourceRecords);
    setIsCopyMonthOpen(false);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
    showNotification(
      `Seluruh target dari ${getMonthDisplayLabel(copySourceMonth)} berhasil disalin ke ${count} bulan tujuan!`
    );
  };

  // Execute Reset (Current Month vs All Months)
  const executeResetTargets = (scope: 'current' | 'all') => {
    if (scope === 'current') {
      resetMonthTargets(selectedMonth);
      showNotification(`Target khusus periode ${activeMonthLabel} dikembalikan ke baseline default.`, 'info');
    } else {
      resetMonthTargets('ALL');
      showNotification('Seluruh target (semua bulan & baseline) berhasil direset ke default sistem.', 'info');
    }
    setIsResetModalOpen(false);
    setRefreshKey((k) => k + 1);
    if (onTargetUpdated) onTargetUpdated();
  };

  // Export Target Matrix to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Target Area
      const areaRows = matrixData.areas.map((a, idx) => ({
        No: idx + 1,
        'Cover Area': a.coverArea,
        Region: a.region,
        'Target Sell In Area (IDR)': a.targetOmzet,
        'Realisasi Sell In (IDR)': a.actualSellIn,
        'Gap Sell In (IDR)': a.gapOmzet,
        '% Capai Sell In': `${a.achievementPct.toFixed(1)}%`,
        'Target Sell Out Area (IDR)': a.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET,
        'Realisasi Sell Out (IDR)': a.actualSellOut,
        'Gap Sell Out (IDR)': a.gapSellOut ?? (a.actualSellOut - (a.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET)),
        '% Capai Sell Out': `${(a.achievementSellOutPct ?? 0).toFixed(1)}%`,
        Status: a.status === 'achieved' ? 'Tercapai (≥100%)' : a.status === 'on_track' ? 'On Track (80-99%)' : 'Belum Capai (<80%)',
        'Jumlah Sales': a.salesCount,
        'Jumlah Toko': a.storeCount,
      }));
      const wsArea = XLSX.utils.json_to_sheet(areaRows);
      XLSX.utils.book_append_sheet(wb, wsArea, 'Target Area');

      // Sheet 2: Target SPV
      const spvRows = matrixData.spvs.map((s, idx) => ({
        No: idx + 1,
        'Nama SPV': s.spvName,
        'Wilayah Cover': s.coverAreas.join(', '),
        'Target Sell In SPV (IDR)': s.targetOmzet,
        'Realisasi Sell In (IDR)': s.actualSellIn,
        'Gap Sell In (IDR)': s.gapOmzet,
        '% Capai Sell In': `${s.achievementPct.toFixed(1)}%`,
        'Target Sell Out SPV (IDR)': s.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET,
        'Realisasi Sell Out (IDR)': s.actualSellOut,
        'Gap Sell Out (IDR)': s.gapSellOut ?? (s.actualSellOut - (s.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET)),
        '% Capai Sell Out': `${(s.achievementSellOutPct ?? 0).toFixed(1)}%`,
        Status: s.status === 'achieved' ? 'Tercapai (≥100%)' : s.status === 'on_track' ? 'On Track (80-99%)' : 'Belum Capai (<80%)',
        'Jumlah Sales': s.salesCount,
        'Jumlah Toko': s.storeCount,
      }));
      const wsSpv = XLSX.utils.json_to_sheet(spvRows);
      XLSX.utils.book_append_sheet(wb, wsSpv, 'Target SPV');

      // Sheet 3: Target Sales
      const salesRows = matrixData.sales.map((sl, idx) => ({
        No: idx + 1,
        'Nama Sales': sl.salesName,
        'Cover Area': sl.coverArea,
        Supervisor: sl.spv,
        'Target Sell In (IDR)': sl.targetSellIn,
        'Realisasi Sell In (IDR)': sl.actualSellIn,
        '% Pencapaian': `${sl.achievementPct.toFixed(1)}%`,
        'Skema Insentif': `${sl.incentivePercent}% (≥100%: 0.4% | 80-99%: 0.2%)`,
        'Estimasi Insentif (IDR)': sl.incentiveNominal,
        Status: sl.status === 'achieved' ? 'Tercapai (≥100%)' : sl.status === 'on_track' ? 'On Track (80-99%)' : 'Belum Capai (<80%)',
      }));
      const wsSales = XLSX.utils.json_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, 'Target Sales');

      // Sheet 4: Target BA
      const baRows = matrixData.bas.map((b, idx) => ({
        No: idx + 1,
        'Nama BA': b.baName,
        'Nama Toko': b.storeName,
        Area: b.coverArea,
        Sales: b.salesName,
        'Target Non-Lavojoy (IDR)': b.targetNonLavojoy,
        'Sell Out Non-Lavojoy (IDR)': b.actualNonLavojoy,
        '% Capai Non-Lavojoy': `${b.achievementNonLavojoyPct.toFixed(1)}%`,
        'Target Lavojoy (IDR)': b.targetLavojoy,
        'Sell Out Lavojoy (IDR)': b.actualLavojoy,
        '% Capai Lavojoy': `${b.achievementLavojoyPct.toFixed(1)}%`,
        'Target Produk Fokus (Pcs)': b.targetFocusPcs,
        'Realisasi Produk Fokus (Pcs)': b.actualFocusPcs,
        '% Capai Fokus': `${b.achievementFocusPct.toFixed(1)}%`,
        'Status Evaluasi Fokus': b.focusStatus.toUpperCase(),
        'Insentif Fokus (Rp 2rb)': b.focusIncentive,
        'Denda Fokus (Rp 1rb)': b.focusPenalty,
      }));
      const wsBa = XLSX.utils.json_to_sheet(baRows);
      XLSX.utils.book_append_sheet(wb, wsBa, 'Target BA & Gerai');

      XLSX.writeFile(wb, `Matrix_Kelola_Target_SalesPro_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showNotification('File Excel Rekap Matrix Target berhasil diunduh!');
    } catch (err: any) {
      showNotification('Gagal unduh Excel: ' + (err.message || 'Error'), 'error');
    }
  };

  // Filtered lists according to search, status, and global filters
  const effectiveSearch = (searchQuery || filters.searchQuery || '').trim().toLowerCase();

  const filteredAreas = useMemo(() => {
    return matrixData.areas.filter((a) => {
      if (filters.REGION && filters.REGION !== 'ALL') {
        const reg = filters.REGION.toUpperCase();
        if (a.coverArea.toUpperCase() !== reg && a.region.toUpperCase() !== reg) return false;
      }
      const matchQ = !effectiveSearch || a.coverArea.toLowerCase().includes(effectiveSearch) || a.region.toLowerCase().includes(effectiveSearch);
      const matchS = statusFilter === 'all' || a.status === statusFilter;
      return matchQ && matchS;
    });
  }, [matrixData.areas, effectiveSearch, statusFilter, filters.REGION]);

  const filteredSpvs = useMemo(() => {
    return matrixData.spvs.filter((s) => {
      if (filters.SPV && filters.SPV !== 'ALL' && s.spvName.toUpperCase() !== filters.SPV.toUpperCase()) return false;
      const matchQ =
        !effectiveSearch ||
        s.spvName.toLowerCase().includes(effectiveSearch) ||
        s.coverAreas.some((c) => c.toLowerCase().includes(effectiveSearch));
      const matchS = statusFilter === 'all' || s.status === statusFilter;
      return matchQ && matchS;
    });
  }, [matrixData.spvs, effectiveSearch, statusFilter, filters.SPV]);

  const filteredSales = useMemo(() => {
    return matrixData.sales.filter((sl) => {
      if (filters.SALES && filters.SALES !== 'ALL' && sl.salesName.toUpperCase() !== filters.SALES.toUpperCase()) return false;
      if (filters.SPV && filters.SPV !== 'ALL' && sl.spv.toUpperCase() !== filters.SPV.toUpperCase()) return false;
      if (filters.REGION && filters.REGION !== 'ALL' && sl.coverArea.toUpperCase() !== filters.REGION.toUpperCase()) return false;

      const matchQ =
        !effectiveSearch ||
        sl.salesName.toLowerCase().includes(effectiveSearch) ||
        sl.coverArea.toLowerCase().includes(effectiveSearch) ||
        sl.spv.toLowerCase().includes(effectiveSearch);
      const matchS = statusFilter === 'all' || sl.status === statusFilter;
      return matchQ && matchS;
    });
  }, [matrixData.sales, effectiveSearch, statusFilter, filters]);

  const filteredBas = useMemo(() => {
    const matchesJoinedToken = (joined: string, target: string, extra?: string[]): boolean => {
      const targetUpper = target.trim().toUpperCase();
      if (joined.trim().toUpperCase() === targetUpper) return true;
      if (extra && extra.some((item) => item.trim().toUpperCase() === targetUpper)) return true;
      return joined.split(',').some((part) => part.trim().toUpperCase() === targetUpper);
    };

    return matrixData.bas.filter((b) => {
      if (filters.SALES && filters.SALES !== 'ALL' && !matchesJoinedToken(b.salesName, filters.SALES)) return false;
      if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL' && !matchesJoinedToken(b.storeName, filters.NAMA_STORE, b.storeNames)) return false;
      if (filters.REGION && filters.REGION !== 'ALL' && !matchesJoinedToken(b.coverArea, filters.REGION) && !matchesJoinedToken(b.region, filters.REGION)) return false;

      const matchQ =
        !effectiveSearch ||
        b.baName.toLowerCase().includes(effectiveSearch) ||
        b.storeName.toLowerCase().includes(effectiveSearch) ||
        b.coverArea.toLowerCase().includes(effectiveSearch) ||
        b.salesName.toLowerCase().includes(effectiveSearch);
      const matchS =
        statusFilter === 'all' ||
        (statusFilter === 'achieved' && b.achievementNonLavojoyPct >= 100) ||
        (statusFilter === 'on_track' && b.achievementNonLavojoyPct >= 80 && b.achievementNonLavojoyPct < 100) ||
        (statusFilter === 'lagging' && b.achievementNonLavojoyPct < 80);
      return matchQ && matchS;
    });
  }, [matrixData.bas, effectiveSearch, statusFilter, filters]);

  const filteredTrainers = useMemo(() => {
    return (matrixData.trainers || []).filter((t) => {
      if (filters.REGION && filters.REGION !== 'ALL') {
        const reg = filters.REGION.toUpperCase();
        if (t.areaCovered.toUpperCase() !== reg && t.region.toUpperCase() !== reg) return false;
      }
      const matchQ =
        !effectiveSearch ||
        t.trainerName.toLowerCase().includes(effectiveSearch) ||
        t.areaCovered.toLowerCase().includes(effectiveSearch) ||
        t.region.toLowerCase().includes(effectiveSearch) ||
        (t.notes || '').toLowerCase().includes(effectiveSearch);
      const matchS = statusFilter === 'all' || t.status === statusFilter;
      return matchQ && matchS;
    });
  }, [matrixData.trainers, effectiveSearch, statusFilter, filters.REGION]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold transition-all animate-in slide-in-from-bottom-5 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/20'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700 shadow-rose-950/20'
              : 'bg-indigo-900 text-white border-indigo-700 shadow-indigo-950/20'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <Sliders className="w-4 h-4 text-cyan-300" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* HEADER SECTION: Top Banner & Primary Action Buttons */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                  Target &amp; Performance Control Center
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Pusat Kelola Target (Area, SPV, Sales &amp; BA)
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              Modul terintegrasi untuk menetapkan target omzet berjenjang, mengontrol pencapaian tim, dan menyinkronkan
              otomatis ke perhitungan <strong>Gaji Sales (Insentif 0,4% saat capai ≥100%)</strong>, <strong>Cost Area</strong>, serta <strong>Produk Fokus BA</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* FILTER BULAN TARGET PERIODE (12 BULAN LENGKAP) */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-xs backdrop-blur-xs transition-colors">
              <Calendar className="w-4 h-4 text-cyan-300" />
              <span className="text-[11px] text-indigo-200 font-bold">Target Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  showNotification(`Mengelola target periode ${getMonthDisplayLabel(e.target.value)}`);
                }}
                className="bg-transparent font-black text-white focus:outline-hidden cursor-pointer"
              >
                {MONTH_OPTIONS_2026.map((m) => (
                  <option key={m.key} value={m.key} className="text-slate-900">
                    {m.label}{monthCustomCounts[m.key] > 0 ? ` (${monthCustomCounts[m.key]} custom)` : ''}
                  </option>
                ))}
                <option value="ALL" className="text-slate-900">
                  {configuredMonthKeys.length > 0
                    ? `Semua Bulan (Total ${configuredMonthKeys.length} Bulan Diset)`
                    : 'Semua Bulan (Baseline Global)'}
                </option>
              </select>
            </div>

            {/* FILTER KET: SEMUA / SELL IN / SELL OUT */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs backdrop-blur-xs transition-colors">
              <span className="text-[11px] text-cyan-200 font-bold">Filter KET:</span>
              <select
                value={ketFilter}
                onChange={(e) => {
                  const val = e.target.value as 'ALL' | 'SELL IN' | 'SELL OUT';
                  setKetFilter(val);
                  showNotification(`Filter KET diatur ke: ${val}`);
                }}
                className="bg-transparent font-black text-white focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="text-slate-900">Semua (Sell In &amp; Sell Out)</option>
                <option value="SELL IN" className="text-slate-900">SELL IN (Target Distributor)</option>
                <option value="SELL OUT" className="text-slate-900">SELL OUT (Target Kasir / Tim)</option>
              </select>
            </div>

            <button
              onClick={() => {
                setCopySourceMonth(selectedMonth);
                setCopyDestMonths([]);
                setIsCopyMonthOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Salin seluruh target bulan ini ke bulan lainnya"
            >
              <Copy className="w-4 h-4" />
              <span>Salin Target Bulan</span>
            </button>

            <button
              onClick={() => {
                const defaultBatchType =
                  subTab === 'area'
                    ? ketFilter === 'SELL OUT'
                      ? 'area_out'
                      : 'area'
                    : subTab === 'spv'
                    ? ketFilter === 'SELL OUT'
                      ? 'spv_out'
                      : 'spv'
                    : subTab === 'sales'
                    ? ketFilter === 'SELL OUT'
                      ? 'sales_out'
                      : 'sales'
                    : subTab === 'trainer'
                    ? 'trainer_so'
                    : 'ba_non';
                setBatchTargetType(defaultBatchType);
                setBatchTargetValue(
                  subTab === 'area'
                    ? ketFilter === 'SELL OUT'
                      ? DEFAULT_AREA_SELLOUT_TARGET
                      : DEFAULT_AREA_TARGET
                    : subTab === 'spv'
                    ? ketFilter === 'SELL OUT'
                      ? DEFAULT_SPV_SELLOUT_TARGET
                      : DEFAULT_SPV_TARGET
                    : subTab === 'sales'
                    ? ketFilter === 'SELL OUT'
                      ? DEFAULT_SALES_SELLOUT_TARGET
                      : DEFAULT_SALES_TARGET
                    : subTab === 'trainer'
                    ? DEFAULT_TRAINER_SELL_OUT_TARGET
                    : DEFAULT_BA_NON_LAVOJOY_TARGET
                );
                setIsBatchOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-4 h-4 text-cyan-300" />
              <span>Atur Target Massal</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Unduh rekapitulasi seluruh target ke Excel"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export Matrix (.xlsx)</span>
            </button>

            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Kembalikan target ke nilai default sistem"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Default</span>
            </button>
          </div>
        </div>

        {/* 12-MONTH QUICK SELECTOR STRIP */}
        <div className="mt-5 pt-4 border-t border-indigo-900/60 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-bold text-cyan-300">
              Setting Target Independen per Bulan (Otomatis Sinkron ke Semua Menu)
            </span>
            <span className="text-[11px] text-slate-300 font-mono tabular-nums">
              Periode Aktif: <strong className="text-white">{activeMonthLabel}</strong>
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-13 gap-1.5">
            {MONTH_OPTIONS_2026.map((m) => {
              const count = monthCustomCounts[m.key] || 0;
              const active = selectedMonth === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(m.key);
                    showNotification(`Periode target beralih ke ${m.label}`);
                  }}
                  className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                    active
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-500/25'
                      : count > 0
                      ? 'bg-indigo-500/25 text-white border-indigo-400/50 hover:bg-indigo-500/40'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="whitespace-nowrap">{m.shortLabel}</span>
                  <span className={`text-[9px] font-mono tabular-nums mt-0.5 ${active ? 'text-slate-900' : count > 0 ? 'text-cyan-300' : 'text-slate-400'}`}>
                    {count > 0 ? `${count} edit` : 'Default'}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelectedMonth('ALL');
                showNotification(
                  configuredMonthKeys.length > 0
                    ? `Menampilkan akumulasi otomatis seluruh target dari ${configuredMonthKeys.length} bulan yang sudah diset`
                    : 'Periode target beralih ke Baseline Global (Semua Bulan)'
                );
              }}
              className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex flex-col items-center justify-center border ${
                selectedMonth === 'ALL'
                  ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-md'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="whitespace-nowrap">Semua Bln</span>
              <span className={`text-[9px] font-mono tabular-nums mt-0.5 ${selectedMonth === 'ALL' ? 'text-slate-900' : 'text-amber-300'}`}>
                {configuredMonthKeys.length > 0 ? `Total ${configuredMonthKeys.length} Bln` : 'Global'}
              </span>
            </button>
          </div>
        </div>

        {/* 5 SUMMARY STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-6 pt-5 border-t border-indigo-900/60">
          {/* Card 1: Target Area (Sell In & Sell Out) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1 text-cyan-300">
                <MapPin className="w-3.5 h-3.5" />
                {ketFilter === 'SELL OUT' ? 'Target Sell Out Area' : 'Target Seluruh Area'}
              </span>
              <span className={`px-2 py-0.2 rounded font-mono text-[10px] ${
                (ketFilter === 'SELL OUT'
                  ? matrixData.summary.areaSellOutAchievementPct
                  : matrixData.summary.areaAchievementPct) >= 100
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {(ketFilter === 'SELL OUT'
                  ? matrixData.summary.areaSellOutAchievementPct
                  : matrixData.summary.areaAchievementPct).toFixed(1)}% Capai
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white tabular-nums">
              {formatRupiah(
                ketFilter === 'SELL OUT'
                  ? matrixData.summary.totalAreaTargetSellOut
                  : matrixData.summary.totalAreaTarget,
                true
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
              <span>
                Realisasi:{' '}
                {formatRupiah(
                  ketFilter === 'SELL OUT'
                    ? matrixData.summary.totalAreaActualSellOut
                    : matrixData.summary.totalAreaActual,
                  true
                )}
              </span>
              <span>{matrixData.areas.length} Area</span>
            </div>
            {ketFilter === 'ALL' && (
              <div className="text-[10.5px] text-teal-300/95 font-mono tabular-nums mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between">
                <span>Target Sell Out: {formatRupiah(matrixData.summary.totalAreaTargetSellOut, true)}</span>
                <span className="font-bold">{matrixData.summary.areaSellOutAchievementPct.toFixed(1)}% SO</span>
              </div>
            )}
          </div>

          {/* Card 2: Target SPV (Sell In & Sell Out) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1 text-purple-300">
                <Building2 className="w-3.5 h-3.5" />
                {ketFilter === 'SELL OUT' ? 'Target Sell Out SPV' : 'Target Seluruh SPV'}
              </span>
              <span className={`px-2 py-0.2 rounded font-mono text-[10px] ${
                (ketFilter === 'SELL OUT'
                  ? matrixData.summary.spvSellOutAchievementPct
                  : matrixData.summary.spvAchievementPct) >= 100
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {(ketFilter === 'SELL OUT'
                  ? matrixData.summary.spvSellOutAchievementPct
                  : matrixData.summary.spvAchievementPct).toFixed(1)}% Capai
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white tabular-nums">
              {formatRupiah(
                ketFilter === 'SELL OUT'
                  ? matrixData.summary.totalSpvTargetSellOut
                  : matrixData.summary.totalSpvTarget,
                true
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
              <span>
                Realisasi:{' '}
                {formatRupiah(
                  ketFilter === 'SELL OUT'
                    ? matrixData.summary.totalSpvActualSellOut
                    : matrixData.summary.totalSpvActual,
                  true
                )}
              </span>
              <span>{matrixData.spvs.length} SPV</span>
            </div>
            {ketFilter === 'ALL' && (
              <div className="text-[10.5px] text-teal-300/95 font-mono tabular-nums mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between">
                <span>Target Sell Out: {formatRupiah(matrixData.summary.totalSpvTargetSellOut, true)}</span>
                <span className="font-bold">{matrixData.summary.spvSellOutAchievementPct.toFixed(1)}% SO</span>
              </div>
            )}
          </div>

          {/* Card 3: Target Sales (Sell In / Sell Out respecting KET) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1 text-indigo-300">
                <Users className="w-3.5 h-3.5" />
                {ketFilter === 'SELL OUT' ? 'Target Sell Out Sales' : 'Target Sell In Sales'}
              </span>
              <span className={`px-2 py-0.2 rounded font-mono text-[10px] ${
                (ketFilter === 'SELL OUT'
                  ? matrixData.summary.salesSellOutAchievementPct
                  : matrixData.summary.salesAchievementPct) >= 100
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {(ketFilter === 'SELL OUT'
                  ? matrixData.summary.salesSellOutAchievementPct
                  : matrixData.summary.salesAchievementPct).toFixed(1)}% Capai
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white tabular-nums">
              {formatRupiah(
                ketFilter === 'SELL OUT'
                  ? matrixData.summary.totalSalesTargetSellOut
                  : matrixData.summary.totalSalesTarget,
                true
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
              <span>
                Realisasi:{' '}
                {formatRupiah(
                  ketFilter === 'SELL OUT'
                    ? matrixData.summary.totalSalesActualSellOut
                    : matrixData.summary.totalSalesActual,
                  true
                )}
              </span>
              <span className="text-emerald-400 font-bold">
                Insentif: {formatRupiah(matrixData.summary.totalSalesIncentiveEst, true)}
              </span>
            </div>
          </div>

          {/* Card 4: Target BA Toko */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1 text-teal-300">
                <Store className="w-3.5 h-3.5" />
                Target BA Toko
              </span>
              <span className={`px-2 py-0.2 rounded font-mono text-[10px] ${
                matrixData.summary.baAchievementPct >= 100
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {matrixData.summary.baAchievementPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white tabular-nums">
              {formatRupiah(matrixData.summary.totalBaTarget, true)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
              <span>Fokus Target: {matrixData.summary.totalBaFocusTargetPcs.toLocaleString('id-ID')} pcs</span>
              <span className="text-teal-300 font-bold">
                Capai: {matrixData.summary.totalBaFocusActualPcs.toLocaleString('id-ID')} pcs
              </span>
            </div>
          </div>

          {/* Card 5: Target Trainer (Sell Out & Produk Fokus) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex items-center gap-1 text-amber-300">
                <GraduationCap className="w-3.5 h-3.5" />
                Target Trainer
              </span>
              <span className={`px-2 py-0.2 rounded font-mono text-[10px] ${
                matrixData.summary.trainerSellOutAchievementPct >= 100
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {matrixData.summary.trainerSellOutAchievementPct.toFixed(1)}% SO
              </span>
            </div>
            <div className="text-xl font-black font-mono text-white tabular-nums">
              {formatRupiah(matrixData.summary.totalTrainerTargetSellOut, true)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
              <span>Fokus Target: {matrixData.summary.totalTrainerTargetFocusPcs.toLocaleString('id-ID')} pcs</span>
              <span className="text-amber-300 font-bold">
                Capai: {matrixData.summary.totalTrainerActualFocusPcs.toLocaleString('id-ID')} pcs ({matrixData.summary.trainerFocusAchievementPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* REKAP AKUMULASI OTOMATIS SELURUH TARGET YANG SUDAH DISET */}
        <div className="mt-3.5 px-4 py-3 rounded-2xl bg-indigo-950/70 border border-cyan-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-black text-cyan-300 uppercase tracking-wide">
                {configuredMonthKeys.length > 0
                  ? `Akumulasi Otomatis Total Target Diset (${configuredMonthKeys.length} Bulan: ${configuredMonthKeys
                      .map((k) => MONTH_OPTIONS_2026.find((m) => m.key === k)?.shortLabel || k)
                      .join(', ')})`
                  : 'Total Target Aktif (Baseline Global — Belum Ada Override Per Bulan)'}
              </div>
              <div className="text-[11px] text-slate-300 font-mono tabular-nums mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>Area In: <strong className="text-white">{formatRupiah(allConfiguredMatrix.summary.totalAreaTarget, true)}</strong></span>
                <span>Area Out: <strong className="text-teal-200">{formatRupiah(allConfiguredMatrix.summary.totalAreaTargetSellOut, true)}</strong></span>
                <span>SPV In: <strong className="text-white">{formatRupiah(allConfiguredMatrix.summary.totalSpvTarget, true)}</strong></span>
                <span>SPV Out: <strong className="text-teal-200">{formatRupiah(allConfiguredMatrix.summary.totalSpvTargetSellOut, true)}</strong></span>
                <span>Sales In: <strong className="text-indigo-200">{formatRupiah(allConfiguredMatrix.summary.totalSalesTarget, true)}</strong></span>
                <span>Sales Out: <strong className="text-teal-200">{formatRupiah(allConfiguredMatrix.summary.totalSalesTargetSellOut, true)}</strong></span>
                <span>BA Toko: <strong className="text-emerald-200">{formatRupiah(allConfiguredMatrix.summary.totalBaTarget, true)}</strong> ({allConfiguredMatrix.summary.totalBaFocusTargetPcs.toLocaleString('id-ID')} pcs)</span>
                <span>Trainer: <strong className="text-amber-200">{formatRupiah(allConfiguredMatrix.summary.totalTrainerTargetSellOut, true)}</strong> ({allConfiguredMatrix.summary.totalTrainerTargetFocusPcs.toLocaleString('id-ID')} pcs)</span>
              </div>
            </div>
          </div>
          {selectedMonth !== 'ALL' && configuredMonthKeys.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth('ALL');
                showNotification(`Menampilkan total akumulasi ${configuredMonthKeys.length} bulan target yang sudah diset`);
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[11px] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              Tampilkan Total Semua Bulan Diset
            </button>
          )}
        </div>
      </div>

      {/* NAVIGATION SUB-TABS: Area | SPV | Sales | BA | Trainer */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('area')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'area'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>1. Target Area ({matrixData.areas.length})</span>
          </button>

          <button
            onClick={() => setSubTab('spv')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'spv'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>2. Target SPV ({matrixData.spvs.length})</span>
          </button>

          <button
            onClick={() => setSubTab('sales')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'sales'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Target Sales &amp; Insentif 0,4% ({matrixData.sales.length})</span>
          </button>

          <button
            onClick={() => setSubTab('ba')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'ba'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>4. Target BA Toko &amp; Produk Fokus ({matrixData.bas.length})</span>
          </button>

          <button
            onClick={() => setSubTab('trainer')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'trainer'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>5. Target Trainer ({matrixData.trainers?.length || 0})</span>
          </button>
        </div>

        {/* Search & Month Indicator */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Periode: <strong>{selectedMonth === 'ALL' ? 'Semua Bulan' : selectedMonth}</strong></span>
          </span>

          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, area, atau toko..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* SUBTAB 1: TARGET AREA (SELL IN & SELL OUT) */}
      {/* ========================================================================================= */}
      {subTab === 'area' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-600" />
                Daftar Target Sell In &amp; Sell Out per Cover Area
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Sell In dan Sell Out wilayah operasional penjualan. Ubah nominal manual atau klik Auto-Total dari Target Sales.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {!matrixData.summary.isMultiMonthAccumulated && (
                <button
                  type="button"
                  onClick={handleBatchAutoSumAreasFromSales}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold transition-colors cursor-pointer"
                  title="Samakan seluruh Target Sell In & Sell Out Area dengan total Target Sales di area masing-masing"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Auto-Total dari Target Sales</span>
                </button>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 tabular-nums">
                {ketFilter !== 'SELL OUT' && (
                  <span>
                    Target Sell In Area:{' '}
                    <strong className="text-cyan-700 font-bold">{formatRupiah(matrixData.summary.totalAreaTarget)}</strong>
                  </span>
                )}
                {ketFilter !== 'SELL IN' && (
                  <span>
                    Target Sell Out Area:{' '}
                    <strong className="text-teal-700 font-bold">{formatRupiah(matrixData.summary.totalAreaTargetSellOut)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50">
                  <th className="py-3 px-3.5">No</th>
                  <th className="py-3 px-3.5">Nama Cover Area</th>
                  <th className="py-3 px-3.5">Region</th>
                  {ketFilter !== 'SELL OUT' && (
                    <>
                      <th className="py-3 px-3.5 text-right font-black text-cyan-950 bg-cyan-50/50">Target Sell In Area (IDR)</th>
                      <th className="py-3 px-3.5 text-right">Realisasi Sell In</th>
                      <th className="py-3 px-3.5 text-right">Gap Sell In</th>
                      <th className="py-3 px-3.5 text-center">% Sell In</th>
                    </>
                  )}
                  {ketFilter !== 'SELL IN' && (
                    <>
                      <th className="py-3 px-3.5 text-right font-black text-teal-950 bg-teal-50/50">Target Sell Out Area (IDR)</th>
                      <th className="py-3 px-3.5 text-right">Realisasi Sell Out</th>
                      <th className="py-3 px-3.5 text-right">Gap Sell Out</th>
                      <th className="py-3 px-3.5 text-center">% Sell Out</th>
                    </>
                  )}
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-center">Personil Sales</th>
                  <th className="py-3 px-3.5 text-center">Aksi Pengaturan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAreas.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-center text-slate-400">
                      Tidak ada area yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredAreas.map((item, idx) => {
                    const areaTargetOut = item.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET;
                    const areaGapOut = item.gapSellOut ?? (item.actualSellOut - areaTargetOut);
                    const areaPctOut = item.achievementSellOutPct ?? (areaTargetOut > 0 ? (item.actualSellOut / areaTargetOut) * 100 : 0);
                    return (
                      <tr key={item.coverArea} className="hover:bg-cyan-50/20 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-black text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{item.coverArea}</span>
                            {(item.isCustom || item.isCustomSellOut) && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">{item.region}</td>
                        {ketFilter !== 'SELL OUT' && (
                          <>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-cyan-950 text-sm bg-cyan-50/30 whitespace-nowrap">
                              {formatRupiah(item.targetOmzet)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatRupiah(item.actualSellIn)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                              {item.gapOmzet >= 0 ? (
                                <span className="text-emerald-700">+{formatRupiah(item.gapOmzet, true)}</span>
                              ) : (
                                <span className="text-rose-700">{formatRupiah(item.gapOmzet, true)}</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                                  item.achievementPct >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.achievementPct >= 80
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.achievementPct.toFixed(1)}%
                              </span>
                            </td>
                          </>
                        )}
                        {ketFilter !== 'SELL IN' && (
                          <>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-teal-950 text-sm bg-teal-50/30 whitespace-nowrap">
                              {formatRupiah(areaTargetOut)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatRupiah(item.actualSellOut)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                              {areaGapOut >= 0 ? (
                                <span className="text-emerald-700">+{formatRupiah(areaGapOut, true)}</span>
                              ) : (
                                <span className="text-rose-700">{formatRupiah(areaGapOut, true)}</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                                  areaPctOut >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : areaPctOut >= 80
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {areaPctOut.toFixed(1)}%
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-3 px-3.5 text-center">
                          {item.status === 'achieved' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Tercapai
                            </span>
                          )}
                          {item.status === 'on_track' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              <TrendingUp className="w-3 h-3 text-blue-600" />
                              On Track
                            </span>
                          )}
                          {item.status === 'lagging' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Kurang
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono text-slate-700 whitespace-nowrap">
                          {item.salesCount} Sales ({item.storeCount} Toko)
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingArea(item);
                                setAreaTargetInput(item.targetOmzet);
                                setAreaSellOutInput(item.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET);
                              }}
                              className="p-1.5 rounded-lg border border-cyan-300 text-cyan-700 hover:bg-cyan-50 transition-colors shadow-2xs cursor-pointer font-bold flex items-center gap-1"
                              title="Edit Target Sell In & Sell Out Area Ini"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Ubah</span>
                            </button>
                            <button
                              onClick={() => handleAutoSumAreaFromSales(item)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                              title="Hitung Otomatis Sell In & Sell Out dari Total Target Tim Sales di Area Ini"
                            >
                              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* SUBTAB 2: TARGET SPV (SELL IN & SELL OUT) */}
      {/* ========================================================================================= */}
      {subTab === 'spv' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                Daftar Target Sell In &amp; Sell Out Tim Supervisor (SPV)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengaturan target Sell In dan Sell Out bulanan untuk seluruh tim di bawah naungan Supervisor.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {!matrixData.summary.isMultiMonthAccumulated && (
                <button
                  type="button"
                  onClick={handleBatchAutoSumSpvsFromSales}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors cursor-pointer"
                  title="Samakan seluruh Target Sell In & Sell Out SPV dengan total Target Sales yang dibawahi"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Auto-Total dari Target Sales</span>
                </button>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 tabular-nums">
                {ketFilter !== 'SELL OUT' && (
                  <span>
                    Target Sell In SPV:{' '}
                    <strong className="text-purple-700 font-bold">{formatRupiah(matrixData.summary.totalSpvTarget)}</strong>
                  </span>
                )}
                {ketFilter !== 'SELL IN' && (
                  <span>
                    Target Sell Out SPV:{' '}
                    <strong className="text-teal-700 font-bold">{formatRupiah(matrixData.summary.totalSpvTargetSellOut)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50">
                  <th className="py-3 px-3.5">No</th>
                  <th className="py-3 px-3.5">Nama Supervisor (SPV)</th>
                  <th className="py-3 px-3.5">Cakupan Wilayah / Area</th>
                  {ketFilter !== 'SELL OUT' && (
                    <>
                      <th className="py-3 px-3.5 text-right font-black text-purple-950 bg-purple-50/50">Target Sell In SPV (IDR)</th>
                      <th className="py-3 px-3.5 text-right">Realisasi Sell In</th>
                      <th className="py-3 px-3.5 text-right">Gap Sell In</th>
                      <th className="py-3 px-3.5 text-center">% Sell In</th>
                    </>
                  )}
                  {ketFilter !== 'SELL IN' && (
                    <>
                      <th className="py-3 px-3.5 text-right font-black text-teal-950 bg-teal-50/50">Target Sell Out SPV (IDR)</th>
                      <th className="py-3 px-3.5 text-right">Realisasi Sell Out</th>
                      <th className="py-3 px-3.5 text-right">Gap Sell Out</th>
                      <th className="py-3 px-3.5 text-center">% Sell Out</th>
                    </>
                  )}
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-center">Jumlah Tim</th>
                  <th className="py-3 px-3.5 text-center">Aksi Pengaturan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSpvs.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-center text-slate-400">
                      Tidak ada data SPV yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredSpvs.map((item, idx) => {
                    const spvTargetOut = item.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET;
                    const spvGapOut = item.gapSellOut ?? (item.actualSellOut - spvTargetOut);
                    const spvPctOut = item.achievementSellOutPct ?? (spvTargetOut > 0 ? (item.actualSellOut / spvTargetOut) * 100 : 0);
                    return (
                      <tr key={item.spvName} className="hover:bg-purple-50/20 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-black text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{item.spvName}</span>
                            {(item.isCustom || item.isCustomSellOut) && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600">{item.coverAreas.join(', ')}</td>
                        {ketFilter !== 'SELL OUT' && (
                          <>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-purple-950 text-sm bg-purple-50/30 whitespace-nowrap">
                              {formatRupiah(item.targetOmzet)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatRupiah(item.actualSellIn)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                              {item.gapOmzet >= 0 ? (
                                <span className="text-emerald-700">+{formatRupiah(item.gapOmzet, true)}</span>
                              ) : (
                                <span className="text-rose-700">{formatRupiah(item.gapOmzet, true)}</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                                  item.achievementPct >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.achievementPct >= 80
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.achievementPct.toFixed(1)}%
                              </span>
                            </td>
                          </>
                        )}
                        {ketFilter !== 'SELL IN' && (
                          <>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-teal-950 text-sm bg-teal-50/30 whitespace-nowrap">
                              {formatRupiah(spvTargetOut)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {formatRupiah(item.actualSellOut)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                              {spvGapOut >= 0 ? (
                                <span className="text-emerald-700">+{formatRupiah(spvGapOut, true)}</span>
                              ) : (
                                <span className="text-rose-700">{formatRupiah(spvGapOut, true)}</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                                  spvPctOut >= 100
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : spvPctOut >= 80
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {spvPctOut.toFixed(1)}%
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-3 px-3.5 text-center">
                          {item.status === 'achieved' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Tercapai
                            </span>
                          )}
                          {item.status === 'on_track' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              <TrendingUp className="w-3 h-3 text-purple-600" />
                              On Track
                            </span>
                          )}
                          {item.status === 'lagging' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Kurang
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono text-slate-700 whitespace-nowrap">
                          {item.salesCount} Sales ({item.storeCount} Toko)
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingSpv(item);
                                setSpvTargetInput(item.targetOmzet);
                                setSpvSellOutInput(item.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET);
                              }}
                              className="p-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors shadow-2xs cursor-pointer font-bold flex items-center gap-1"
                              title="Edit Target Sell In & Sell Out SPV Ini"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Ubah</span>
                            </button>
                            <button
                              onClick={() => handleAutoSumSpvFromSales(item)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                              title="Hitung Otomatis Sell In & Sell Out dari Total Target Seluruh Sales yang Dibawahi"
                            >
                              <Calculator className="w-3.5 h-3.5 text-purple-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* SUBTAB 3: TARGET SALES (SELL IN & SELL OUT + INSENTIF 0,4%) */}
      {/* ========================================================================================= */}
      {subTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Daftar Target Sell In &amp; Sell Out Sales ({activeMonthLabel})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Sell In dan Sell Out per bulan otomatis sinkron ke menu <strong>Analisa Sales</strong>, <strong>Cost Area</strong>, <strong>KPI Sales</strong> &amp; <strong>Profit Area</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 tabular-nums">
              {ketFilter !== 'SELL OUT' && (
                <span>
                  Total Target Sell In:{' '}
                  <strong className="text-indigo-700 font-bold">{formatRupiah(matrixData.summary.totalSalesTarget)}</strong>
                </span>
              )}
              {ketFilter !== 'SELL IN' && (
                <span>
                  Total Target Sell Out:{' '}
                  <strong className="text-teal-700 font-bold">{formatRupiah(matrixData.summary.totalSalesTargetSellOut)}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50">
                  <th className="py-3 px-3.5">No</th>
                  <th className="py-3 px-3.5">Nama Sales</th>
                  <th className="py-3 px-3.5">Area &amp; SPV</th>
                  {ketFilter !== 'SELL OUT' && (
                    <>
                      <th className="py-3 px-3.5 text-right font-black text-indigo-950 bg-indigo-50/50">Target Sell In (IDR)</th>
                      <th className="py-3 px-3.5 text-right">Realisasi Sell In</th>
                      <th className="py-3 px-3.5 text-center">% Sell In</th>
                    </>
                  )}
                  {ketFilter !== 'SELL IN' && (
                    <>
                      <th className="py-3 px-3.5 text-right font-black text-teal-950 bg-teal-50/50">Target Sell Out (IDR)</th>
                      <th className="py-3 px-3.5 text-right">Realisasi Sell Out</th>
                      <th className="py-3 px-3.5 text-center">% Sell Out</th>
                    </>
                  )}
                  <th className="py-3 px-3.5 text-center">Status Insentif</th>
                  <th className="py-3 px-3.5 text-right text-emerald-800 font-black">Estimasi Insentif</th>
                  <th className="py-3 px-3.5 text-center">Toko Ber-BA</th>
                  <th className="py-3 px-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400">
                      Tidak ada data sales yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((item, idx) => (
                    <tr key={item.salesName} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="py-3 px-3.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-black text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{item.salesName}</span>
                          {(item.isCustom || item.isCustomSellOut) && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                              Custom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        {item.coverArea} ({item.spv})
                      </td>
                      {ketFilter !== 'SELL OUT' && (
                        <>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-indigo-950 text-sm bg-indigo-50/30">
                            {formatRupiah(item.targetSellIn)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatRupiah(item.actualSellIn)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                                item.achievementPct >= 100
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                  : item.achievementPct >= 80
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.achievementPct.toFixed(1)}%
                            </span>
                          </td>
                        </>
                      )}
                      {ketFilter !== 'SELL IN' && (
                        <>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-teal-950 text-sm bg-teal-50/30">
                            {formatRupiah(item.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatRupiah(item.actualSellOut ?? 0)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                                (item.achievementSellOutPct ?? 0) >= 100
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                  : (item.achievementSellOutPct ?? 0) >= 80
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {(item.achievementSellOutPct ?? 0).toFixed(1)}%
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-3 px-3.5 text-center">
                        {item.achievementPct >= 100 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            Dapat 0,4%
                          </span>
                        ) : item.achievementPct >= 80 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Dapat 0,2%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Rp 0 (&lt;80%)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums font-black text-emerald-700 text-sm">
                        {item.incentiveNominal > 0 ? (
                          <span>+{formatRupiah(item.incentiveNominal)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono tabular-nums text-slate-600">
                        {item.coveredBaCount} Gerai
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => {
                            setEditingSales(item);
                            setSalesTargetInput(item.targetSellIn);
                            setSalesSellOutInput(item.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors shadow-2xs cursor-pointer font-bold flex items-center gap-1 mx-auto whitespace-nowrap"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Ubah Target</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* SUBTAB 4: TARGET BA & GERAI */}
      {/* ========================================================================================= */}
      {subTab === 'ba' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-teal-600" />
                Daftar Target Beauty Advisor (Non-Lavojoy, Lavojoy &amp; Produk Fokus Pcs)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target berbasis <strong>Nama BA</strong> (toko berbeda dengan Nama BA sama digabung otomatis agar target BA hanya 1): Non-Lavojoy (30 Jt), Lavojoy 4% (5 Jt), &amp; Produk Fokus (120 pcs).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-xs font-mono text-slate-600">
                Total BA: <strong className="text-teal-700 font-bold">{matrixData.bas.length}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaultSource =
                    selectedMonth !== 'ALL'
                      ? selectedMonth
                      : configuredMonthKeys[0] || '2026-10';
                  setBaAllMonthsSourceMonth(defaultSource);
                  setBaAllMonthsMode('copy_month');
                  setBaAllMonthsNonLav(DEFAULT_BA_NON_LAVOJOY_TARGET);
                  setBaAllMonthsLav(DEFAULT_BA_LAVOJOY_TARGET);
                  setBaAllMonthsFocus(DEFAULT_FOCUS_TARGET_PCS);
                  setBaAllMonthsScope('ALL_MONTHS');
                  setIsBaAllMonthsOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                title="Atur target BA 1 bulan agar berlaku sama untuk seluruh 12 bulan (Jan–Des 2026)"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Setting Target BA 1 Bln = Semua Bulan</span>
              </button>
              <button
                onClick={() => {
                  setNewBaStoreName('');
                  setNewBaName('');
                  setNewBaNumber('');
                  setNewBaArea('PEKANBARU');
                  setNewBaSales('ILHAMSYAH');
                  setNewBaNonLavojoyTarget(DEFAULT_BA_NON_LAVOJOY_TARGET);
                  setNewBaLavojoyTarget(DEFAULT_BA_LAVOJOY_TARGET);
                  setNewBaFocusTarget(DEFAULT_FOCUS_TARGET_PCS);
                  setNewBaApplyAllMonths(false);
                  setIsAddBaOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Toko &amp; BA Baru</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50">
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Nama BA &amp; Gabungan Toko</th>
                  <th className="py-3 px-3">Area / Sales</th>
                  {/* Non-Lavojoy */}
                  <th className="py-3 px-3 text-right bg-teal-50/60 font-bold">Target Non-Lavojoy</th>
                  <th className="py-3 px-3 text-right bg-teal-50/60">Sell Out Non-Lav</th>
                  <th className="py-3 px-3 text-center bg-teal-50/60">% Capai</th>
                  {/* Lavojoy */}
                  <th className="py-3 px-3 text-right bg-purple-50/60 font-bold">Target Lavojoy (4%)</th>
                  <th className="py-3 px-3 text-right bg-purple-50/60">Sell Out Lavojoy</th>
                  <th className="py-3 px-3 text-center bg-purple-50/60">% Capai</th>
                  {/* Produk Fokus Pcs */}
                  <th className="py-3 px-3 text-center bg-amber-50/60 font-bold">Target Fokus (Pcs)</th>
                  <th className="py-3 px-3 text-center bg-amber-50/60">Realisasi (Pcs)</th>
                  <th className="py-3 px-3 text-center bg-amber-50/60">% Capai</th>
                  <th className="py-3 px-3 text-right bg-amber-50/60">Kompensasi Fokus</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBas.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-center text-slate-400">
                      Tidak ada data BA yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredBas.map((item, idx) => (
                    <tr key={`${item.baName}__${item.storeName}`} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 max-w-[260px]">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{item.baName}</span>
                          {item.storeNames && item.storeNames.length > 1 && (
                            <span className="text-[9.5px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded">
                              {item.storeNames.length} Toko
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium leading-snug">{item.storeName}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div>{item.coverArea}</div>
                        <div className="text-[10px] text-slate-400">{item.salesName}</div>
                      </td>

                      {/* Non-Lavojoy / Sell Out Utama */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-teal-900 bg-teal-50/20">
                        {formatRupiah(item.targetNonLavojoy)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 bg-teal-50/20">
                        <div>{formatRupiah(item.actualNonLavojoy)}</div>
                        {item.targetLavojoy === 0 && (
                          <div className="text-[10px] text-teal-700 font-sans font-semibold">
                            Total Sell Out (All Brand)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center bg-teal-50/20">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded font-mono tabular-nums font-bold text-[10px] ${
                            item.achievementNonLavojoyPct >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.achievementNonLavojoyPct >= 70
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.achievementNonLavojoyPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Lavojoy */}
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-purple-900 bg-purple-50/20">
                        <div>{formatRupiah(item.targetLavojoy)}</div>
                        {item.targetLavojoy === 0 && (
                          <div className="text-[10px] text-purple-600 font-sans font-medium">
                            Digabung ke Utama
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 bg-purple-50/20">
                        {item.targetLavojoy === 0 ? (
                          <span className="text-[10px] text-slate-400 font-sans">Masuk Utama</span>
                        ) : (
                          formatRupiah(item.actualLavojoy)
                        )}
                      </td>
                      <td className="py-3 px-3 text-center bg-purple-50/20">
                        {item.targetLavojoy === 0 ? (
                          <span className="text-[10px] text-slate-400 font-mono">-</span>
                        ) : (
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded font-mono tabular-nums font-bold text-[10px] ${
                              item.achievementLavojoyPct >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.achievementLavojoyPct.toFixed(1)}%
                          </span>
                        )}
                      </td>

                      {/* Produk Fokus */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-900 bg-amber-50/20">
                        {item.targetFocusPcs} pcs
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-900 bg-amber-50/20">
                        {item.actualFocusPcs} pcs
                      </td>
                      <td className="py-3 px-3 text-center bg-amber-50/20">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                            item.focusStatus === 'insentif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.focusStatus === 'aman'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.achievementFocusPct.toFixed(1)}% ({item.focusStatus === 'insentif' ? '≥80%' : item.focusStatus === 'aman' ? 'AMAN' : '<70%'})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold bg-amber-50/20">
                        {item.focusStatus === 'insentif' && (
                          <span className="text-emerald-700">+{formatRupiah(item.focusIncentive)}</span>
                        )}
                        {item.focusStatus === 'aman' && (
                          <span className="text-slate-400 font-normal">Rp 0 (Aman)</span>
                        )}
                        {item.focusStatus === 'denda' && (
                          <span className="text-rose-700">-{formatRupiah(item.focusPenalty)}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setEditingBa(item);
                            setBaNameInput(item.baName);
                            setBaStoreNameInput(item.storeName);
                            setBaSalesNameInput(item.salesName);
                            setBaNonLavojoyInput(item.targetNonLavojoy);
                            setBaLavojoyInput(item.targetLavojoy);
                            setBaFocusInput(item.targetFocusPcs);
                            setBaApplyAllMonths(false);
                          }}
                          className="px-2 py-1 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors shadow-2xs cursor-pointer font-bold flex items-center gap-1 mx-auto"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Ubah Target &amp; Nama</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* SUBTAB 5: TARGET TRAINER (SELL OUT & PRODUK FOKUS)                                        */}
      {/* ========================================================================================= */}
      {subTab === 'trainer' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-600" />
                Daftar Target Trainer: Sell Out &amp; Produk Fokus ({selectedMonth === 'ALL' ? 'Semua Bulan' : selectedMonth})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target bulanan yang dapat diedit untuk Trainer mencakup <strong>Target Sell Out (Rp)</strong> dan <strong>Target Produk Fokus (Pcs)</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="text-xs font-mono text-slate-600">
                Menampilkan: <strong className="text-slate-900">{filteredTrainers.length}</strong> Trainer | Target Periode:{' '}
                <strong className="text-amber-700 font-bold">{selectedMonth}</strong>
              </div>
              <button
                onClick={() => {
                  setNewTrainerName('');
                  setNewTrainerArea('');
                  setNewTrainerRegion('PEKAN BARU');
                  setNewTrainerBaCount(10);
                  setNewTrainerSellOut(DEFAULT_TRAINER_SELL_OUT_TARGET);
                  setNewTrainerFocus(DEFAULT_TRAINER_FOCUS_TARGET_PCS);
                  setNewTrainerNotes('');
                  setIsAddTrainerOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Trainer Baru</span>
              </button>
            </div>
          </div>

          {/* Quick Guide Card for Trainer Targets */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-yellow-50/60 rounded-xl border border-amber-200 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-amber-950">Skema &amp; Evaluasi Produktivitas Trainer:</span>
              </div>
              <span className="text-[11px] text-amber-800 font-medium">
                Pencapaian dihitung otomatis dari gerai dan BA binaan di area masing-masing
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-amber-200/60 text-[11px] text-amber-900">
              <div>
                • <strong>Pilar 1: Target Sell Out (Rp):</strong> Pembinaan penjualan gerai &amp; omzet tim BA multi-brand.
              </div>
              <div>
                • <strong>Pilar 2: Target Produk Fokus (Pcs):</strong> Penetrasi SKU hero/fokus (barenbliss, lavojoy, Y.O.U, DAZZLE ME).
              </div>
            </div>
          </div>

          {/* Trainer Target Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50">
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Nama Trainer</th>
                  <th className="py-3 px-3">Wilayah Binaan &amp; Region</th>
                  <th className="py-3 px-2 text-center">BA Binaan</th>
                  {/* Sell Out Group */}
                  <th className="py-3 px-3 text-right bg-amber-50/50 text-amber-950">Target Sell Out (Rp)</th>
                  <th className="py-3 px-3 text-right bg-amber-50/50 text-amber-950">Realisasi Sell Out (Rp)</th>
                  <th className="py-3 px-2 text-center bg-amber-50/50 text-amber-950">% Capai SO</th>
                  {/* Focus Group */}
                  <th className="py-3 px-3 text-center bg-yellow-50/50 text-yellow-950">Target Fokus (Pcs)</th>
                  <th className="py-3 px-3 text-center bg-yellow-50/50 text-yellow-950">Realisasi Fokus (Pcs)</th>
                  <th className="py-3 px-2 text-center bg-yellow-50/50 text-yellow-950">% Capai Fokus</th>
                  <th className="py-3 px-3 text-center">Status Capai</th>
                  <th className="py-3 px-3">Catatan / Spesialisasi</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrainers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                      Tidak ada data trainer yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredTrainers.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                          <span>{item.trainerName}</span>
                          {item.isCustom && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Custom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium">{item.areaCovered}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Region: {item.region}</div>
                      </td>
                      <td className="py-3 px-2 text-center font-mono tabular-nums font-bold text-slate-700">
                        {inlineEditingTrainerBaId === item.id ? (
                          <div className="inline-flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={inlineTrainerBaValue}
                              onChange={(e) => setInlineTrainerBaValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveInlineTrainerBaCount(item);
                                } else if (e.key === 'Escape') {
                                  setInlineEditingTrainerBaId(null);
                                }
                              }}
                              autoFocus
                              className="w-16 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg border border-amber-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineTrainerBaCount(item)}
                              title="Simpan Total BA"
                              className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineEditingTrainerBaId(null)}
                              title="Batal"
                              className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setInlineEditingTrainerBaId(item.id);
                              setInlineTrainerBaValue(String(item.baSupervisedCount));
                            }}
                            title="Klik untuk edit Total BA Binaan"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-800 transition-colors cursor-pointer"
                          >
                            <span>{item.baSupervisedCount} BA</span>
                            <Edit3 className="w-3 h-3 text-amber-600" />
                          </button>
                        )}
                      </td>

                      {/* Sell Out */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-950 bg-amber-50/20">
                        {formatRupiah(item.targetSellOut)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 bg-amber-50/20">
                        {formatRupiah(item.actualSellOut)}
                      </td>
                      <td className="py-3 px-2 text-center bg-amber-50/20">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                            item.achievementSellOutPct >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.achievementSellOutPct >= 80
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.achievementSellOutPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Fokus */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-yellow-950 bg-yellow-50/20">
                        {item.targetProdukFokusPcs} pcs
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-900 bg-yellow-50/20">
                        {item.actualProdukFokusPcs} pcs
                      </td>
                      <td className="py-3 px-2 text-center bg-yellow-50/20">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                            item.achievementProdukFokusPct >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.achievementProdukFokusPct >= 80
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.achievementProdukFokusPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.status === 'achieved'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : item.status === 'on_track'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {item.status === 'achieved'
                            ? 'Target Capai'
                            : item.status === 'on_track'
                            ? 'On Track'
                            : 'Lagging'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 text-[11px] max-w-[150px] truncate" title={item.notes}>
                        {item.notes || '-'}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setEditingTrainer(item);
                            setTrainerNameInput(item.trainerName);
                            setTrainerAreaInput(item.areaCovered);
                            setTrainerRegionInput(item.region);
                            setTrainerBaCountInput(item.baSupervisedCount);
                            setTrainerSellOutInput(item.targetSellOut);
                            setTrainerFocusInput(item.targetProdukFokusPcs);
                            setTrainerNotesInput(item.notes || '');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer font-bold flex items-center gap-1 mx-auto"
                        >
                          <Edit3 className="w-3 h-3 text-amber-700" />
                          <span>Ubah Target &amp; Profil</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 5: EDIT TARGET TRAINER (SELL OUT & PRODUK FOKUS)                                    */}
      {/* ========================================================================================= */}
      {editingTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-700 via-orange-800 to-amber-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-amber-300" />
                  Edit Target Trainer ({selectedMonth === 'ALL' ? 'Semua Periode' : selectedMonth})
                </h3>
                <p className="text-xs text-amber-200 mt-0.5">
                  Trainer: <strong>{editingTrainer.trainerName}</strong> ({editingTrainer.areaCovered})
                </p>
              </div>
              <button
                onClick={() => setEditingTrainer(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrainerTarget} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nama Trainer */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Trainer</label>
                  <input
                    type="text"
                    value={trainerNameInput}
                    onChange={(e) => setTrainerNameInput(e.target.value)}
                    placeholder="e.g. ARA / RATIH"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Region</label>
                  <input
                    type="text"
                    value={trainerRegionInput}
                    onChange={(e) => setTrainerRegionInput(e.target.value)}
                    placeholder="e.g. PEKAN BARU / DURI"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Wilayah Binaan & Total BA Binaan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Wilayah Cover / Sales Binaan</label>
                  <input
                    type="text"
                    value={trainerAreaInput}
                    onChange={(e) => setTrainerAreaInput(e.target.value)}
                    placeholder="e.g. PEKANBARU, DUMAI, SIAK (Sales Albert, Ilhamsyah, Tiwi)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Total BA Binaan</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={trainerBaCountInput}
                    onChange={(e) => setTrainerBaCountInput(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Target Sell Out */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Sell Out Trainer (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={trainerSellOutInput}
                  onChange={(e) => setTrainerSellOutInput(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(trainerSellOutInput)}
                </span>
              </div>

              {/* Target Produk Fokus */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Produk Fokus Trainer (Pcs)</label>
                <input
                  type="number"
                  step="any"
                  value={trainerFocusInput}
                  onChange={(e) => setTrainerFocusInput(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Target produk hero/fokus yang harus dicapai tim binaan
                </span>
              </div>

              {/* Catatan / Spesialisasi */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Catatan / Spesialisasi</label>
                <input
                  type="text"
                  value={trainerNotesInput}
                  onChange={(e) => setTrainerNotesInput(e.target.value)}
                  placeholder="e.g. Trainer Area Pekanbaru & Dumai - Fokus barenbliss"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-1 text-slate-700">
                <div className="flex justify-between font-mono">
                  <span>Realisasi Sell Out Terkini:</span>
                  <span className="font-bold text-slate-900">{formatRupiah(editingTrainer.actualSellOut)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Proyeksi % Capai Sell Out:</span>
                  <span className="font-bold text-amber-800">
                    {((editingTrainer.actualSellOut / (trainerSellOutInput || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between font-mono pt-1 border-t border-amber-200/50">
                  <span>Realisasi Fokus Pcs Terkini:</span>
                  <span className="font-bold text-slate-900">{editingTrainer.actualProdukFokusPcs} pcs</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Proyeksi % Capai Fokus:</span>
                  <span className="font-bold text-amber-800">
                    {((editingTrainer.actualProdukFokusPcs / (trainerFocusInput || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrainer(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Target &amp; Profil Trainer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL: TAMBAH TRAINER BARU                                                                */}
      {/* ========================================================================================= */}
      {isAddTrainerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-700 via-orange-800 to-amber-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-amber-300" />
                  Tambah Trainer Baru ({selectedMonth})
                </h3>
                <p className="text-xs text-amber-200 mt-0.5">
                  Tambahkan personil Trainer baru ke dalam daftar binaan area
                </p>
              </div>
              <button
                onClick={() => setIsAddTrainerOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewTrainer} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Trainer</label>
                  <input
                    type="text"
                    value={newTrainerName}
                    onChange={(e) => setNewTrainerName(e.target.value)}
                    placeholder="e.g. RATIH / ARA / NAMA BARU"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Region</label>
                  <input
                    type="text"
                    value={newTrainerRegion}
                    onChange={(e) => setNewTrainerRegion(e.target.value)}
                    placeholder="e.g. PEKAN BARU / DURI"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Wilayah Cover / Sales Binaan</label>
                  <input
                    type="text"
                    value={newTrainerArea}
                    onChange={(e) => setNewTrainerArea(e.target.value)}
                    placeholder="e.g. PEKANBARU, DUMAI, SIAK (Sales Albert, Ilhamsyah)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Total BA Binaan</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={newTrainerBaCount}
                    onChange={(e) => setNewTrainerBaCount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target Sell Out (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    value={newTrainerSellOut}
                    onChange={(e) => setNewTrainerSellOut(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target Produk Fokus (Pcs)</label>
                  <input
                    type="number"
                    step="any"
                    value={newTrainerFocus}
                    onChange={(e) => setNewTrainerFocus(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Catatan / Spesialisasi</label>
                <input
                  type="text"
                  value={newTrainerNotes}
                  onChange={(e) => setNewTrainerNotes(e.target.value)}
                  placeholder="e.g. Trainer Area Pekanbaru - Fokus barenbliss & Dazzle Me"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTrainerOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Trainer Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 1: EDIT TARGET AREA (SELL IN & SELL OUT) */}
      {/* ========================================================================================= */}
      {editingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-cyan-800 to-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-300" />
                  Edit Target Area ({activeMonthLabel})
                </h3>
                <p className="text-xs text-cyan-200 mt-0.5">Area: {editingArea.coverArea} ({editingArea.region})</p>
              </div>
              <button
                onClick={() => setEditingArea(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAreaTarget} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Sell In Area (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={areaTargetInput}
                  onChange={(e) => setAreaTargetInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(areaTargetInput)}
                </span>
              </div>

              <div>
                <label className="block text-teal-900 font-bold mb-1">Target Sell Out Area (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={areaSellOutInput}
                  onChange={(e) => setAreaSellOutInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-teal-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(areaSellOutInput)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Realisasi Sell In:</span>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(editingArea.actualSellIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Proyeksi Capai Sell In:</span>
                  <span className="font-mono font-bold text-cyan-700">
                    {((editingArea.actualSellIn / (areaTargetInput || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200">
                  <span>Realisasi Sell Out:</span>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(editingArea.actualSellOut)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Proyeksi Capai Sell Out:</span>
                  <span className="font-mono font-bold text-teal-700">
                    {((editingArea.actualSellOut / (areaSellOutInput || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingArea(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-md shadow-cyan-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Target Area</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 2: EDIT TARGET SPV (SELL IN & SELL OUT) */}
      {/* ========================================================================================= */}
      {editingSpv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-800 to-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-300" />
                  Edit Target Tim Supervisor ({activeMonthLabel})
                </h3>
                <p className="text-xs text-purple-200 mt-0.5">Supervisor: {editingSpv.spvName}</p>
              </div>
              <button
                onClick={() => setEditingSpv(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpvTarget} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Sell In Tim SPV (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={spvTargetInput}
                  onChange={(e) => setSpvTargetInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(spvTargetInput)}
                </span>
              </div>

              <div>
                <label className="block text-teal-900 font-bold mb-1">Target Sell Out Tim SPV (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={spvSellOutInput}
                  onChange={(e) => setSpvSellOutInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-teal-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(spvSellOutInput)}
                </span>
              </div>

              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Realisasi Sell In Tim SPV:</span>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(editingSpv.actualSellIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Proyeksi Capai Sell In:</span>
                  <span className="font-mono font-bold text-purple-700">
                    {((editingSpv.actualSellIn / (spvTargetInput || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-purple-100">
                  <span>Realisasi Sell Out Tim SPV:</span>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(editingSpv.actualSellOut)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Proyeksi Capai Sell Out:</span>
                  <span className="font-mono font-bold text-teal-700">
                    {((editingSpv.actualSellOut / (spvSellOutInput || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSpv(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Target SPV</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 3: EDIT TARGET SALES (SELL IN & SELL OUT PER BULAN) */}
      {/* ========================================================================================= */}
      {editingSales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-indigo-800 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-300" />
                  Edit Target Sales ({activeMonthLabel})
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">{editingSales.salesName} • {editingSales.coverArea}</p>
              </div>
              <button
                onClick={() => setEditingSales(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSalesTarget} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Sell In Sales (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={salesTargetInput}
                  onChange={(e) => setSalesTargetInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(salesTargetInput)}
                </span>
              </div>

              <div>
                <label className="block text-teal-900 font-bold mb-1">Target Sell Out Sales (Rp)</label>
                <input
                  type="number"
                  step="any"
                  value={salesSellOutInput}
                  onChange={(e) => setSalesSellOutInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-teal-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  Terbilang: {formatRupiah(salesSellOutInput)} (Sinkron ke Analisa Sales &amp; KPI)
                </span>
              </div>

              {/* Simulation card of 0.4% incentive */}
              {(() => {
                const projPct = (editingSales.actualSellIn / (salesTargetInput || 1)) * 100;
                const incPct = projPct >= 100 ? 0.4 : projPct >= 80 ? 0.2 : 0;
                const estInc = Math.round((incPct / 100) * editingSales.actualSellIn);

                return (
                  <div className="p-3.5 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-200 space-y-2 text-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-900">Proyeksi Capai Sell In:</span>
                      <span className="font-mono font-black text-sm text-indigo-950">
                        {projPct.toFixed(1)}% ({projPct >= 100 ? 'Memenuhi 0,4%' : projPct >= 80 ? '0,2%' : '0%'})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>Skema Insentif:</span>
                      <span className="font-mono font-bold text-slate-900">{incPct}%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-indigo-100">
                      <span className="font-bold text-emerald-800">Estimasi Insentif Diterima:</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        +{formatRupiah(estInc)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSales(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Target Sales</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 4: EDIT TARGET BA TOKO & NAMA BA/TOKO                                               */}
      {/* ========================================================================================= */}
      {editingBa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-teal-800 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Store className="w-4 h-4 text-teal-300" />
                  Edit Target &amp; Profil Toko BA
                </h3>
                <p className="text-xs text-teal-200 mt-0.5">
                  {editingBa.baName} • {editingBa.storeName}
                </p>
              </div>
              <button
                onClick={() => setEditingBa(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBaTarget} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nama Toko */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Toko / Outlet</label>
                  <input
                    type="text"
                    value={baStoreNameInput}
                    onChange={(e) => setBaStoreNameInput(e.target.value)}
                    placeholder="Nama Toko"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 uppercase"
                    required
                  />
                </div>

                {/* Nama BA */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Beauty Advisor (BA)</label>
                  <input
                    type="text"
                    value={baNameInput}
                    onChange={(e) => setBaNameInput(e.target.value)}
                    placeholder="Nama BA"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Non-Lavojoy */}
                <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/30">
                  <label className="block text-teal-950 font-bold mb-1">Target Non-Lavojoy (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    value={baNonLavojoyInput}
                    onChange={(e) => setBaNonLavojoyInput(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    {formatRupiah(baNonLavojoyInput)}
                  </span>
                </div>

                {/* Lavojoy */}
                <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/30">
                  <label className="block text-purple-950 font-bold mb-1">Target Lavojoy 4% (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={baLavojoyInput}
                    onChange={(e) => setBaLavojoyInput(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    {formatRupiah(baLavojoyInput)}
                    {baLavojoyInput === 0 ? ' — Semua Sell Out masuk ke pencapaian utama' : ''}
                  </span>
                </div>
              </div>

              {/* Produk Fokus Pcs */}
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-amber-950 font-black flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-600" />
                    Target Produk Fokus (Pcs)
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Insentif Rp 2rb / Denda Rp 1rb
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={baFocusInput}
                  onChange={(e) => setBaFocusInput(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-black rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500"
                  required
                />
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  • Capai ≥ 80%: Insentif <strong>+Rp 2.000 / pcs</strong>
                  <br />• Capai 70-79%: <strong>AMAN (Rp 0)</strong>
                  <br />• Capai &lt; 70%: Denda <strong>-Rp 1.000 × Target ({baFocusInput} pcs) = -{formatRupiah(baFocusInput * 1000)}</strong>
                </p>
              </div>

              {/* Opsi Terapkan Target 1 Bulan Sama Ke Semua Bulan */}
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={baApplyAllMonths}
                    onChange={(e) => setBaApplyAllMonths(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="leading-snug">
                    <span className="font-extrabold text-indigo-950 block">
                      Terapkan target BA ini sama untuk SEMUA bulan (Januari – Desember 2026)
                    </span>
                    <span className="text-[11px] text-indigo-800">
                      {baApplyAllMonths
                        ? 'Nominal di atas akan dijadikan target per 1 bulan yang sama di seluruh 12 bulan (Jan–Des 2026).'
                        : `Saat ini hanya disimpan untuk periode: ${activeMonthLabel}. Centang jika ingin semua bulan sama.`}
                    </span>
                  </div>
                </label>

                {baApplyAllMonths && selectedMonth === 'ALL' && matrixData.summary.accumulatedMonthCount > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-indigo-200/70 text-[11px] text-indigo-900">
                    <span>
                      Angka awal sedang menampilkan akumulasi {matrixData.summary.accumulatedMonthCount} bulan.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cnt = matrixData.summary.accumulatedMonthCount || 1;
                        setBaNonLavojoyInput(Math.max(1, Math.round(editingBa.targetNonLavojoy / cnt)));
                        setBaLavojoyInput(Math.max(0, Math.round(editingBa.targetLavojoy / cnt)));
                        setBaFocusInput(Math.max(1, Math.round(editingBa.targetFocusPcs / cnt)));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                    >
                      Bagi {matrixData.summary.accumulatedMonthCount} jadi target 1 bulan
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBa(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md shadow-teal-600/30 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{baApplyAllMonths ? 'Simpan Sama ke Semua Bulan' : 'Simpan Target & Profil Toko'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL: TAMBAH TOKO & BA BARU                                                              */}
      {/* ========================================================================================= */}
      {isAddBaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-teal-800 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Store className="w-5 h-5 text-teal-300" />
                  Tambah Toko &amp; BA Baru ({selectedMonth})
                </h3>
                <p className="text-xs text-teal-200 mt-0.5">
                  Tambahkan penugasan Toko dan Beauty Advisor baru ke sistem
                </p>
              </div>
              <button
                onClick={() => setIsAddBaOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewStoreBa} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Toko / Outlet</label>
                  <input
                    type="text"
                    value={newBaStoreName}
                    onChange={(e) => setNewBaStoreName(e.target.value)}
                    placeholder="e.g. TOKO MAKMUR BEAUTY"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nama Beauty Advisor (BA)</label>
                  <input
                    type="text"
                    value={newBaName}
                    onChange={(e) => setNewBaName(e.target.value)}
                    placeholder="e.g. SITI NURHALIZA"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Area Operasional</label>
                  <input
                    type="text"
                    value={newBaArea}
                    onChange={(e) => setNewBaArea(e.target.value)}
                    placeholder="e.g. PEKANBARU / DUMAI"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Sales In-Charge</label>
                  <input
                    type="text"
                    value={newBaSales}
                    onChange={(e) => setNewBaSales(e.target.value)}
                    placeholder="e.g. ILHAMSYAH / ALBERT"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500 uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target Non-Lavojoy (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    value={newBaNonLavojoyTarget}
                    onChange={(e) => setNewBaNonLavojoyTarget(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target Lavojoy (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    value={newBaLavojoyTarget}
                    onChange={(e) => setNewBaLavojoyTarget(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Target Produk Fokus (Pcs)</label>
                <input
                  type="number"
                  step="any"
                  value={newBaFocusTarget}
                  onChange={(e) => setNewBaFocusTarget(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newBaApplyAllMonths}
                  onChange={(e) => setNewBaApplyAllMonths(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="leading-snug">
                  <span className="font-extrabold text-indigo-950 block">
                    Terapkan target BA ini sama untuk SEMUA bulan (Jan–Des 2026)
                  </span>
                  <span className="text-[11px] text-indigo-800">
                    Jika dicentang, target BA baru otomatis sama untuk seluruh 12 bulan.
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBaOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md shadow-teal-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Toko &amp; BA Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL: SETTING TARGET BA 1 BULAN -> SEMUA BULAN SAMA (NON-LAVOJOY, LAVOJOY, FOKUS PCS)    */}
      {/* ========================================================================================= */}
      {isBaAllMonthsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-indigo-900 via-teal-800 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Copy className="w-4 h-4 text-cyan-300" />
                  Setting Target BA 1 Bulan → Semua Bulan Sama
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Samakan target BA (Non-Lavojoy, Lavojoy &amp; Produk Fokus Pcs) ke seluruh 12 bulan (Jan–Des 2026)
                </p>
              </div>
              <button
                onClick={() => setIsBaAllMonthsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyBaAllMonths} className="p-5 space-y-4 text-xs">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBaAllMonthsMode('copy_month')}
                  className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                    baAllMonthsMode === 'copy_month'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Samakan dari 1 Bulan
                </button>
                <button
                  type="button"
                  onClick={() => setBaAllMonthsMode('uniform')}
                  className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                    baAllMonthsMode === 'uniform'
                      ? 'bg-white text-teal-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Set Seragam Semua BA
                </button>
              </div>

              {baAllMonthsMode === 'copy_month' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Pilih Pengaturan Target BA Bulan Sumber (1 Bulan)
                    </label>
                    <select
                      value={baAllMonthsSourceMonth}
                      onChange={(e) => setBaAllMonthsSourceMonth(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      {MONTH_OPTIONS_2026.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}{monthCustomCounts[m.key] > 0 ? ` (${monthCustomCounts[m.key]} custom)` : ''}
                        </option>
                      ))}
                      <option value="ALL">Baseline Global (Default 1 Bulan)</option>
                    </select>
                  </div>

                  {baSourceMonthPreview && (
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5 text-slate-700">
                      <div className="font-extrabold text-indigo-950">
                        Pratinjau Target BA 1 Bulan ({getMonthDisplayLabel(baAllMonthsSourceMonth)}):
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Jumlah Gerai BA:</span>
                        <span className="font-bold text-slate-900">{baSourceMonthPreview.baCount} Gerai</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Total Target Non-Lavojoy / Bln:</span>
                        <span className="font-bold text-teal-800">{formatRupiah(baSourceMonthPreview.totalNonLav)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Total Target Lavojoy / Bln:</span>
                        <span className="font-bold text-purple-800">{formatRupiah(baSourceMonthPreview.totalLav)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Total Target Produk Fokus / Bln:</span>
                        <span className="font-bold text-amber-800">{baSourceMonthPreview.totalFocusPcs.toLocaleString('id-ID')} pcs</span>
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                    Seluruh daftar target per-BA dari bulan sumber di atas (<strong>Non-Lavojoy, Lavojoy &amp; Produk Fokus Pcs</strong>) akan diterapkan sama ke semua 12 bulan (<strong>Januari – Desember 2026</strong>) tanpa mengubah target Area, SPV, Sales, maupun Trainer.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/30">
                      <label className="block text-teal-950 font-bold mb-1">Target Non-Lavojoy / Bulan (Rp)</label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        value={baAllMonthsNonLav}
                        onChange={(e) => setBaAllMonthsNonLav(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500"
                        required
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                        {formatRupiah(baAllMonthsNonLav)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/30">
                      <label className="block text-purple-950 font-bold mb-1">Target Lavojoy 4% / Bulan (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={baAllMonthsLav}
                        onChange={(e) => setBaAllMonthsLav(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500"
                        required
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                        {formatRupiah(baAllMonthsLav)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                    <label className="block text-amber-950 font-bold mb-1">Target Produk Fokus / Bulan (Pcs)</label>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={baAllMonthsFocus}
                      onChange={(e) => setBaAllMonthsFocus(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <span className="text-[10px] text-amber-800 font-mono mt-1 block">
                      {baAllMonthsFocus} pcs per BA per bulan
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-bold">Cakupan Penerapan Bulan</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBaAllMonthsScope('ALL_MONTHS')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          baAllMonthsScope === 'ALL_MONTHS'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-extrabold ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold'
                        }`}
                      >
                        <div>Semua Bulan Sama</div>
                        <div className="text-[10px] font-normal opacity-80">Januari – Desember 2026 (12 Bln)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBaAllMonthsScope('current')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          baAllMonthsScope === 'current'
                            ? 'border-teal-600 bg-teal-50 text-teal-950 font-extrabold ring-1 ring-teal-600'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold'
                        }`}
                      >
                        <div>Hanya Bulan Ini</div>
                        <div className="text-[10px] font-normal opacity-80">{activeMonthLabel}</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBaAllMonthsOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {baAllMonthsMode === 'copy_month' || baAllMonthsScope === 'ALL_MONTHS'
                      ? 'Terapkan Sama ke Semua Bulan'
                      : 'Terapkan ke Bulan Ini'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 5: BATCH TARGET SETTING (ATUR MASSAL) */}
      {/* ========================================================================================= */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Atur Target Serentak ({activeMonthLabel})
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">Terapkan nominal target seragam ke seluruh personil/wilayah di periode ini</p>
              </div>
              <button
                onClick={() => setIsBatchOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyBatchTarget} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Pilih Kategori Target</label>
                <select
                  value={batchTargetType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setBatchTargetType(val);
                    if (val === 'area') setBatchTargetValue(DEFAULT_AREA_TARGET);
                    if (val === 'area_out') setBatchTargetValue(DEFAULT_AREA_SELLOUT_TARGET);
                    if (val === 'spv') setBatchTargetValue(DEFAULT_SPV_TARGET);
                    if (val === 'spv_out') setBatchTargetValue(DEFAULT_SPV_SELLOUT_TARGET);
                    if (val === 'sales') setBatchTargetValue(DEFAULT_SALES_TARGET);
                    if (val === 'sales_out') setBatchTargetValue(DEFAULT_SALES_SELLOUT_TARGET);
                    if (val === 'ba_non') setBatchTargetValue(DEFAULT_BA_NON_LAVOJOY_TARGET);
                    if (val === 'ba_lav') setBatchTargetValue(DEFAULT_BA_LAVOJOY_TARGET);
                    if (val === 'ba_focus') setBatchTargetValue(DEFAULT_FOCUS_TARGET_PCS);
                    if (val === 'trainer_so') setBatchTargetValue(DEFAULT_TRAINER_SELL_OUT_TARGET);
                    if (val === 'trainer_focus') setBatchTargetValue(DEFAULT_TRAINER_FOCUS_TARGET_PCS);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white"
                >
                  <option value="sales">Target Sell In Sales (Rp)</option>
                  <option value="sales_out">Target Sell Out Sales (Rp)</option>
                  <option value="area">Target Sell In Area (Rp)</option>
                  <option value="area_out">Target Sell Out Area (Rp)</option>
                  <option value="spv">Target Sell In SPV (Rp)</option>
                  <option value="spv_out">Target Sell Out SPV (Rp)</option>
                  <option value="ba_non">Target BA Non-Lavojoy (Rp)</option>
                  <option value="ba_lav">Target BA Lavojoy (Rp)</option>
                  <option value="ba_focus">Target Produk Fokus BA (Pcs)</option>
                  <option value="trainer_so">Target Trainer Sell Out (Rp)</option>
                  <option value="trainer_focus">Target Trainer Produk Fokus (Pcs)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nominal / Kuantitas Target Baru {(batchTargetType === 'ba_focus' || batchTargetType === 'trainer_focus') ? '(Pcs)' : '(Rp)'}
                </label>
                <input
                  type="number"
                  min={batchTargetType === 'ba_lav' ? 0 : 1}
                  step="any"
                  value={batchTargetValue}
                  onChange={(e) =>
                    setBatchTargetValue(Math.max(batchTargetType === 'ba_lav' ? 0 : 1, Number(e.target.value)))
                  }
                  className="w-full px-3 py-2 text-sm font-mono font-black rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                  {(batchTargetType === 'ba_focus' || batchTargetType === 'trainer_focus')
                    ? `${batchTargetValue} unit pcs`
                    : formatRupiah(batchTargetValue)}
                </span>
              </div>

              {(batchTargetType === 'ba_non' || batchTargetType === 'ba_lav' || batchTargetType === 'ba_focus') && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={batchBaApplyAllMonths}
                    onChange={(e) => setBatchBaApplyAllMonths(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="leading-snug">
                    <span className="font-extrabold text-indigo-950 block">
                      Terapkan serentak sama untuk SEMUA bulan (Januari – Desember 2026)
                    </span>
                    <span className="text-[11px] text-indigo-800">
                      Jika dicentang, seluruh 12 bulan otomatis memakai target BA yang sama ini.
                    </span>
                  </div>
                </label>
              )}

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Perhatian:</strong> Target serentak ini diterapkan khusus untuk periode{' '}
                <strong>
                  {batchBaApplyAllMonths && (batchTargetType === 'ba_non' || batchTargetType === 'ba_lav' || batchTargetType === 'ba_focus')
                    ? 'Semua Bulan (Jan–Des 2026)'
                    : activeMonthLabel}
                </strong>{' '}
                dan otomatis memperbarui modul Analisa Sales, SPV, Cost Area, Profit P&amp;L, Produk Fokus, Kuartal &amp; KPI.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Terapkan ke Semua</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 6: SALIN TARGET ANTAR BULAN */}
      {/* ========================================================================================= */}
      {isCopyMonthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Copy className="w-4 h-4 text-emerald-300" />
                  Salin Pengaturan Target ke Bulan Lain
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Duplikasi seluruh target (Area, SPV, Sales, BA &amp; Trainer) antar periode bulan
                </p>
              </div>
              <button
                onClick={() => setIsCopyMonthOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyCopyMonth} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Salin Dari Bulan Sumber</label>
                <select
                  value={copySourceMonth}
                  onChange={(e) => {
                    const nextSrc = e.target.value;
                    setCopySourceMonth(nextSrc);
                    setCopyDestMonths((prev) => prev.filter((d) => d !== nextSrc));
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white"
                >
                  {MONTH_OPTIONS_2026.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                  <option value="ALL">Baseline Global (Semua Bulan)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 font-bold">Pilih Bulan Tujuan ({copyDestMonths.length} dipilih)</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allOthers = MONTH_OPTIONS_2026.map((m) => m.key).filter((k) => k !== copySourceMonth);
                      setCopyDestMonths(copyDestMonths.length === allOthers.length ? [] : allOthers);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    {copyDestMonths.length === MONTH_OPTIONS_2026.filter((m) => m.key !== copySourceMonth).length
                      ? 'Batal Pilih Semua'
                      : 'Pilih Semua Bulan Lain'}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTH_OPTIONS_2026.map((m) => {
                    const disabled = m.key === copySourceMonth;
                    const checked = copyDestMonths.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setCopyDestMonths((prev) =>
                            prev.includes(m.key) ? prev.filter((x) => x !== m.key) : [...prev, m.key]
                          );
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                          disabled
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : checked
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                        }`}
                      >
                        {m.shortLabel} 2026
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCopyMonthOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin Target Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* MODAL 7: KONFIRMASI RESET TARGET (TANPA window.confirm) */}
      {/* ========================================================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-rose-700 to-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="text-base font-extrabold">Reset Pengaturan Target</h3>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                Pilih cakupan reset target ke nilai default bawaan sistem. Semua menu terkait akan otomatis mengikuti hasil reset.
              </p>
              <div className="space-y-2">
                {selectedMonth !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => executeResetTargets('current')}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>Reset Target Bulan {activeMonthLabel} Saja</span>
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => executeResetTargets('all')}
                  className="w-full px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-950 font-bold text-left flex items-center justify-between cursor-pointer"
                >
                  <span>Reset Seluruh Target (Semua Bulan &amp; Baseline)</span>
                  <RotateCcw className="w-4 h-4 text-rose-700" />
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
