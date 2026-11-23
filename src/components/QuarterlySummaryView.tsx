import React, { useState, useMemo, useEffect } from 'react';
import {
  TransactionRecord,
  FilterState,
  QuarterPeriodKey,
  SalesQuarterlySummaryItem,
  BaQuarterlySummaryItem,
  TrainerQuarterlySummaryItem,
} from '../types/dashboard';
import {
  calculateQuarterlySummary,
  QUARTER_MONTHS,
  exportQuarterlyToExcel,
  saveQuarterlyTargetOverride,
  saveBulkQuarterlyTargetOverrides,
  clearQuarterlyTargetOverride,
  saveQuarterlyActualSellInOverride,
  saveBulkQuarterlyActualSellInOverrides,
  clearQuarterlyActualSellInOverride,
  QuarterlyTargetRole,
} from '../services/quarterlySummaryService';
import { TARGETS_UPDATED_EVENT, syncQuarterBaSellInToStores } from '../services/targetManagementService';
import { SALES_MASTER_6_CONFIG } from '../services/kpiSalesData';
import { formatRupiah, formatPercent } from '../utils/analytics';
import {
  Award,
  TrendingUp,
  Users,
  Sparkles,
  Search,
  Printer,
  ChevronRight,
  GraduationCap,
  Calendar,
  X,
  FileSpreadsheet,
  Medal,
  Crown,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  RotateCcw,
  Sliders,
  Check,
  Filter,
} from 'lucide-react';

interface QuarterlySummaryViewProps {
  records: TransactionRecord[];
  allRecords?: TransactionRecord[];
  filters: FilterState;
}

type SubTabKey = 'all' | 'sales' | 'ba' | 'trainer';

export const QuarterlySummaryView: React.FC<QuarterlySummaryViewProps> = ({
  records,
  allRecords,
  filters,
}) => {
  // Use full records if available to ensure historical quarter months (e.g. Q3: Jul-Sep) are present
  const sourceRecords = allRecords && allRecords.length > 0 ? allRecords : records;

  // State for Quarter, Year, Sub-tab, Search, and Modals
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterPeriodKey>('Q4');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedSpv, setSelectedSpv] = useState<string>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hallOfFameTab, setHallOfFameTab] = useState<'sales' | 'ba' | 'trainer'>('sales');
  const [modalPerson, setModalPerson] = useState<{
    type: 'sales' | 'ba' | 'trainer';
    data: SalesQuarterlySummaryItem | BaQuarterlySummaryItem | TrainerQuarterlySummaryItem;
  } | null>(null);

  // Quick single-row edit target modal state
  const [editTargetItem, setEditTargetItem] = useState<{
    role: QuarterlyTargetRole;
    entityName: string;
    subtitle: string;
    targetSellIn: string;
    targetSellOut: string;
    isCustom: boolean;
  } | null>(null);

  // Quick single-row edit Realisasi Sell In modal state
  const [editActualSellInItem, setEditActualSellInItem] = useState<{
    role: QuarterlyTargetRole;
    entityName: string;
    subtitle: string;
    targetSellIn: number;
    totalSellIn: string;
    monthNames: [string, string, string];
    monthlySellIn: [string, string, string];
    editMode: 'total' | 'monthly';
    isCustom: boolean;
  } | null>(null);

  // Bulk Target & Realisasi Sell In Kuartal settings modal state
  const [isTargetModalOpen, setIsTargetModalOpen] = useState<boolean>(false);
  const [bulkModalMode, setBulkModalMode] = useState<'targets' | 'actualSellIn'>('targets');
  const [targetModalRole, setTargetModalRole] = useState<QuarterlyTargetRole>('sales');
  const [targetModalQuarter, setTargetModalQuarter] = useState<QuarterPeriodKey>('Q4');
  const [targetModalYear, setTargetModalYear] = useState<number>(2026);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, { sellIn: string; sellOut: string }>>({});
  const [actualSellInDrafts, setActualSellInDrafts] = useState<Record<string, string>>({});
  const [initialActualSellInDrafts, setInitialActualSellInDrafts] = useState<Record<string, string>>({});

  // Sync automatically with global Filter Terintegrasi
  useEffect(() => {
    if (filters.BULAN && filters.BULAN !== 'ALL') {
      const b = filters.BULAN.toUpperCase();
      if (['JANUARI', 'FEBRUARI', 'MARET'].includes(b)) setSelectedQuarter('Q1');
      else if (['APRIL', 'MEI', 'JUNI'].includes(b)) setSelectedQuarter('Q2');
      else if (['JULI', 'AGUSTUS', 'SEPTEMBER'].includes(b)) setSelectedQuarter('Q3');
      else if (['OKTOBER', 'NOVEMBER', 'DESEMBER'].includes(b)) setSelectedQuarter('Q4');
    }
  }, [filters.BULAN]);

  useEffect(() => {
    if (filters.TAHUN && filters.TAHUN !== 'ALL') {
      const y = parseInt(filters.TAHUN, 10);
      if (!isNaN(y)) setSelectedYear(y);
    }
  }, [filters.TAHUN]);

  useEffect(() => {
    if (filters.SPV && filters.SPV !== 'ALL') {
      setSelectedSpv(filters.SPV);
    } else if (filters.SPV === 'ALL') {
      setSelectedSpv('ALL');
    }
  }, [filters.SPV]);

  useEffect(() => {
    if (filters.REGION && filters.REGION !== 'ALL') {
      setSelectedArea(filters.REGION);
    }
  }, [filters.REGION]);

  // Extract distinct areas & SPVs for dropdowns
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    sourceRecords.forEach((r) => {
      if (r.COVER_AREA) set.add(r.COVER_AREA);
      if (r.REGION) set.add(r.REGION);
    });
    return Array.from(set).sort();
  }, [sourceRecords]);

  const availableSpvs = useMemo(() => {
    const set = new Set<string>();
    sourceRecords.forEach((r) => {
      if (r.SPV) set.add(r.SPV);
    });
    return Array.from(set).sort();
  }, [sourceRecords]);

  const [targetSyncVersion, setTargetSyncVersion] = useState<number>(0);

  useEffect(() => {
    const onTargetsUpdated = () => setTargetSyncVersion((v) => v + 1);
    window.addEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
    window.addEventListener('storage', onTargetsUpdated);
    return () => {
      window.removeEventListener(TARGETS_UPDATED_EVENT, onTargetsUpdated);
      window.removeEventListener('storage', onTargetsUpdated);
    };
  }, []);

  const activeKet = (filters.KET || 'ALL').toUpperCase().trim();
  const isKetSellIn = activeKet === 'SELL IN';
  const isKetSellOut = activeKet === 'SELL OUT';
  const activeKetDisplayLabel = isKetSellIn
    ? 'SELL IN (Pencapaian Sell In)'
    : isKetSellOut
    ? 'SELL OUT (Pencapaian Sell Out)'
    : activeKet === 'ALL'
    ? 'SEMUA KET (Sell In & Sell Out)'
    : activeKet;

  // Compute quarterly calculations reactive to integrated KET filter
  const rawSummaryData = useMemo(() => {
    return calculateQuarterlySummary(
      sourceRecords,
      selectedQuarter,
      selectedYear,
      selectedArea,
      selectedSpv,
      activeKet
    );
  }, [sourceRecords, selectedQuarter, selectedYear, selectedArea, selectedSpv, activeKet, targetSyncVersion]);

  const { overall: baseOverall, salesList, baList, trainerList } = rawSummaryData;

  // Filtered lists based on global filters and search queries
  const effectiveSearch = (searchQuery || filters.searchQuery || '').trim().toLowerCase();

  const filteredSales = useMemo(() => {
    return salesList.filter((s) => {
      if (filters.SALES && filters.SALES !== 'ALL') {
        const fSales = filters.SALES.trim().toUpperCase();
        const canonicalFilter = fSales === 'ALBERT' ? 'ALBERT FERNANDO' : fSales;
        if (s.salesName.toUpperCase() !== canonicalFilter) return false;
      }
      if (filters.TRAINER && filters.TRAINER !== 'ALL') {
        const cfg = SALES_MASTER_6_CONFIG[s.salesName];
        if (cfg && !cfg.trainerCovered.toUpperCase().includes(filters.TRAINER.toUpperCase())) return false;
      }
      if (filters.SPV && filters.SPV !== 'ALL' && s.spvName.toUpperCase() !== filters.SPV.toUpperCase()) return false;
      if (filters.REGION && filters.REGION !== 'ALL' && (s.region || '').toUpperCase() !== filters.REGION.toUpperCase() && (s.coverArea || '').toUpperCase() !== filters.REGION.toUpperCase()) return false;
      if (!effectiveSearch) return true;
      return (
        s.salesName.toLowerCase().includes(effectiveSearch) ||
        s.coverArea.toLowerCase().includes(effectiveSearch) ||
        s.spvName.toLowerCase().includes(effectiveSearch) ||
        (s.region && s.region.toLowerCase().includes(effectiveSearch))
      );
    });
  }, [salesList, effectiveSearch, filters.SALES, filters.TRAINER, filters.SPV, filters.REGION]);

  const filteredBa = useMemo(() => {
    return baList.filter((b) => {
      if (filters.SPV && filters.SPV !== 'ALL' && b.spvName && b.spvName.toUpperCase() !== filters.SPV.toUpperCase()) return false;
      if (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL') {
        const targetStore = filters.NAMA_STORE.toUpperCase().trim();
        const storeTokens = (b.storeName || '')
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean);
        if ((b.storeName || '').toUpperCase().trim() !== targetStore && !storeTokens.includes(targetStore)) {
          return false;
        }
      }
      if (filters.REGION && filters.REGION !== 'ALL') {
        const targetReg = filters.REGION.toUpperCase().trim();
        const regionMatch = (b.region || '').toUpperCase().trim() === targetReg;
        const areaTokens = (b.coverArea || '')
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean);
        if (!regionMatch && (b.coverArea || '').toUpperCase().trim() !== targetReg && !areaTokens.includes(targetReg)) {
          return false;
        }
      }
      if (!effectiveSearch) return true;
      return (
        b.baName.toLowerCase().includes(effectiveSearch) ||
        b.storeName.toLowerCase().includes(effectiveSearch) ||
        b.coverArea.toLowerCase().includes(effectiveSearch) ||
        b.baNumber.toLowerCase().includes(effectiveSearch) ||
        (b.spvName && b.spvName.toLowerCase().includes(effectiveSearch))
      );
    });
  }, [baList, effectiveSearch, filters.SPV, filters.NAMA_STORE, filters.REGION]);

  const filteredTrainer = useMemo(() => {
    return trainerList.filter((t) => {
      if (filters.TRAINER && filters.TRAINER !== 'ALL' && t.trainerName.toUpperCase() !== filters.TRAINER.toUpperCase()) return false;
      if (filters.REGION && filters.REGION !== 'ALL' && (t.areaCovered || '').toUpperCase() !== filters.REGION.toUpperCase() && (t.region || '').toUpperCase() !== filters.REGION.toUpperCase()) return false;
      if (!effectiveSearch) return true;
      return (
        t.trainerName.toLowerCase().includes(effectiveSearch) ||
        t.areaCovered.toLowerCase().includes(effectiveSearch)
      );
    });
  }, [trainerList, effectiveSearch, filters.TRAINER, filters.REGION]);

  // Dynamically recalculated overall KPI summary cards for the filtered subset
  const overall = useMemo(() => {
    const hasActivePersonnelFilter =
      (filters.SALES && filters.SALES !== 'ALL') ||
      (filters.TRAINER && filters.TRAINER !== 'ALL') ||
      (filters.SPV && filters.SPV !== 'ALL') ||
      (filters.REGION && filters.REGION !== 'ALL') ||
      (filters.NAMA_STORE && filters.NAMA_STORE !== 'ALL') ||
      Boolean(effectiveSearch);

    if (!hasActivePersonnelFilter) return baseOverall;

    const totalTargetArea = filteredSales.reduce((acc, s) => acc + s.quarterTarget, 0);
    const totalTargetSellIn = filteredSales.reduce((acc, s) => acc + s.quarterTargetSellIn, 0);
    const totalTargetSellOut = filteredSales.reduce((acc, s) => acc + s.quarterTargetSellOut, 0);
    const totalActualArea = filteredSales.reduce((acc, s) => acc + s.quarterActual, 0);
    const totalActualSellIn = filteredSales.reduce((acc, s) => acc + s.quarterActualSellIn, 0);
    const totalActualSellOut = filteredSales.reduce((acc, s) => acc + s.quarterActualSellOut, 0);
    const areaAchievementPercent = totalTargetArea > 0 ? (totalActualArea / totalTargetArea) * 100 : 0;

    const avgSalesScore =
      filteredSales.length > 0
        ? Math.round(filteredSales.reduce((acc, s) => acc + s.avgKpiScore, 0) / filteredSales.length)
        : 0;
    const avgTrainerScore =
      filteredTrainer.length > 0
        ? Math.round(filteredTrainer.reduce((acc, t) => acc + t.avgKpiScore, 0) / filteredTrainer.length)
        : 0;

    return {
      ...baseOverall,
      totalTargetArea,
      totalTargetSellIn,
      totalTargetSellOut,
      totalActualArea,
      totalActualSellIn,
      totalActualSellOut,
      areaAchievementPercent,
      totalSalesCount: filteredSales.length,
      totalBaCount: filteredBa.length,
      totalTrainerCount: filteredTrainer.length,
      avgSalesKpiScore: avgSalesScore,
      avgTrainerKpiScore: avgTrainerScore,
      topSales: filteredSales[0]
        ? {
            name: filteredSales[0].salesName,
            actual: filteredSales[0].quarterActual,
            target: filteredSales[0].quarterTarget,
            percent: filteredSales[0].quarterAchievementPercent,
          }
        : null,
      topBa: filteredBa[0]
        ? {
            name: filteredBa[0].baName,
            store: filteredBa[0].storeName,
            actual: filteredBa[0].quarterActual,
            target: filteredBa[0].quarterTarget,
            percent: filteredBa[0].quarterAchievementPercent,
          }
        : null,
      topTrainer: filteredTrainer[0]
        ? {
            name: filteredTrainer[0].trainerName,
            actual: filteredTrainer[0].quarterActual,
            target: filteredTrainer[0].quarterTarget,
            percent: filteredTrainer[0].quarterAchievementPercent,
            score: filteredTrainer[0].avgKpiScore,
          }
        : null,
    };
  }, [baseOverall, filteredSales, filteredBa, filteredTrainer, filters, effectiveSearch]);

  // Modal computation for bulk quarter target settings (independent quarter/year switcher inside modal)
  const modalSummaryData = useMemo(() => {
    if (!isTargetModalOpen) return null;
    return calculateQuarterlySummary(
      sourceRecords,
      targetModalQuarter,
      targetModalYear,
      selectedArea,
      selectedSpv,
      activeKet
    );
  }, [isTargetModalOpen, sourceRecords, targetModalQuarter, targetModalYear, selectedArea, selectedSpv, activeKet, targetSyncVersion]);

  const populateModalDrafts = (role: QuarterlyTargetRole, q: QuarterPeriodKey, yr: number) => {
    const calc = calculateQuarterlySummary(sourceRecords, q, yr, selectedArea, selectedSpv, activeKet);
    const nextTargetDrafts: Record<string, { sellIn: string; sellOut: string }> = {};
    const nextActualDrafts: Record<string, string> = {};

    if (role === 'sales') {
      calc.salesList.forEach((s) => {
        nextTargetDrafts[s.salesName] = {
          sellIn: String(Math.round(s.quarterTargetSellIn)),
          sellOut: String(Math.round(s.quarterTargetSellOut)),
        };
        nextActualDrafts[s.salesName] = String(Math.round(s.quarterActualSellIn));
      });
    } else if (role === 'ba') {
      calc.baList.forEach((b) => {
        nextTargetDrafts[b.baName] = {
          sellIn: String(Math.round(b.quarterTargetSellIn)),
          sellOut: String(Math.round(b.quarterTargetSellOut)),
        };
        nextActualDrafts[b.baName] = String(Math.round(b.quarterActualSellIn));
      });
    } else {
      calc.trainerList.forEach((t) => {
        nextTargetDrafts[t.trainerName] = {
          sellIn: String(Math.round(t.quarterTargetSellIn)),
          sellOut: String(Math.round(t.quarterTargetSellOut)),
        };
        nextActualDrafts[t.trainerName] = String(Math.round(t.quarterActualSellIn));
      });
    }
    setTargetDrafts(nextTargetDrafts);
    setActualSellInDrafts(nextActualDrafts);
    setInitialActualSellInDrafts({ ...nextActualDrafts });
  };

  const openBulkTargetModal = (
    role: QuarterlyTargetRole,
    mode: 'targets' | 'actualSellIn' = 'targets'
  ) => {
    setBulkModalMode(mode);
    setTargetModalRole(role);
    setTargetModalQuarter(selectedQuarter);
    setTargetModalYear(selectedYear);
    populateModalDrafts(role, selectedQuarter, selectedYear);
    setIsTargetModalOpen(true);
  };

  const openEditActualSellIn = (
    role: QuarterlyTargetRole,
    item: SalesQuarterlySummaryItem | BaQuarterlySummaryItem | TrainerQuarterlySummaryItem,
    initialMode: 'total' | 'monthly' = 'total'
  ) => {
    const entityName =
      role === 'sales'
        ? (item as SalesQuarterlySummaryItem).salesName
        : role === 'ba'
        ? (item as BaQuarterlySummaryItem).baName
        : (item as TrainerQuarterlySummaryItem).trainerName;
    const subtitleArea =
      role === 'sales'
        ? (item as SalesQuarterlySummaryItem).coverArea
        : role === 'ba'
        ? (item as BaQuarterlySummaryItem).storeName
        : (item as TrainerQuarterlySummaryItem).areaCovered;

    const qMonths = QUARTER_MONTHS[selectedQuarter].monthNames;
    const mb = item.monthlyBreakdown || [];
    const mNames: [string, string, string] = [
      mb[0]?.monthName || qMonths[0] || 'Bulan 1',
      mb[1]?.monthName || qMonths[1] || 'Bulan 2',
      mb[2]?.monthName || qMonths[2] || 'Bulan 3',
    ];
    const mVals: [string, string, string] = [
      String(Math.round(mb[0]?.actualSellIn ?? 0)),
      String(Math.round(mb[1]?.actualSellIn ?? 0)),
      String(Math.round(mb[2]?.actualSellIn ?? 0)),
    ];

    setEditActualSellInItem({
      role,
      entityName,
      subtitle: `${subtitleArea} • ${overall.quarterLabel}`,
      targetSellIn: item.quarterTargetSellIn,
      totalSellIn: String(Math.round(item.quarterActualSellIn)),
      monthNames: mNames,
      monthlySellIn: mVals,
      editMode: initialMode,
      isCustom: Boolean(item.isCustomActualSellIn),
    });
  };

  const handleSaveBulkTargets = () => {
    if (targetModalRole === 'ba') {
      const baListMap = new Map<string, BaQuarterlySummaryItem>(
        (modalSummaryData?.baList || []).map((b) => [b.baName.toLowerCase(), b])
      );
      const fallbackEntries: Array<{ entityName: string; targetSellIn?: number; targetSellOut?: number }> = [];

      Object.entries(targetDrafts).forEach(([entityName, vals]) => {
        const sellInVal = Math.max(0, Math.round(Number(vals.sellIn) || 0));
        const sellOutVal = Math.max(0, Math.round(Number(vals.sellOut) || 0));
        const baItem = baListMap.get(entityName.toLowerCase());
        const synced = syncQuarterBaSellInToStores({
          year: targetModalYear,
          quarter: targetModalQuarter,
          baName: entityName,
          storeName: baItem?.storeName || '',
          quarterTargetSellIn: sellInVal,
          monthlyBreakdown: baItem?.monthlyBreakdown,
        });
        fallbackEntries.push({
          entityName,
          ...(synced ? {} : { targetSellIn: sellInVal }),
          targetSellOut: sellOutVal,
        });
      });

      if (fallbackEntries.length > 0) {
        saveBulkQuarterlyTargetOverrides(targetModalYear, targetModalQuarter, 'ba', fallbackEntries);
      }
      setIsTargetModalOpen(false);
      return;
    }

    const entries = Object.entries(targetDrafts).map(([entityName, vals]) => ({
      entityName,
      targetSellIn: Number(vals.sellIn) || 0,
      targetSellOut: Number(vals.sellOut) || 0,
    }));
    saveBulkQuarterlyTargetOverrides(targetModalYear, targetModalQuarter, targetModalRole, entries);
    setIsTargetModalOpen(false);
  };

  const handleSaveBulkActualSellIn = () => {
    if (!modalSummaryData) return;
    const list =
      targetModalRole === 'sales'
        ? modalSummaryData.salesList.map((s) => ({
            name: s.salesName,
            isCustom: Boolean(s.isCustomActualSellIn),
          }))
        : targetModalRole === 'ba'
        ? modalSummaryData.baList.map((b) => ({
            name: b.baName,
            isCustom: Boolean(b.isCustomActualSellIn),
          }))
        : modalSummaryData.trainerList.map((t) => ({
            name: t.trainerName,
            isCustom: Boolean(t.isCustomActualSellIn),
          }));

    const entriesToSave = list
      .filter((row) => {
        const currentVal = String(Math.max(0, Math.round(Number(actualSellInDrafts[row.name]) || 0)));
        const initialVal = String(Math.max(0, Math.round(Number(initialActualSellInDrafts[row.name]) || 0)));
        return row.isCustom || currentVal !== initialVal;
      })
      .map((row) => ({
        entityName: row.name,
        actualSellIn: Math.max(0, Math.round(Number(actualSellInDrafts[row.name]) || 0)),
      }));

    if (entriesToSave.length > 0) {
      saveBulkQuarterlyActualSellInOverrides(
        targetModalYear,
        targetModalQuarter,
        targetModalRole,
        entriesToSave
      );
    }
    setIsTargetModalOpen(false);
  };

  const handleSaveSingleTarget = () => {
    if (!editTargetItem) return;
    const sellInVal = Math.max(0, Math.round(Number(editTargetItem.targetSellIn) || 0));
    const sellOutVal = Math.max(0, Math.round(Number(editTargetItem.targetSellOut) || 0));

    if (editTargetItem.role === 'ba') {
      const baItem = baList.find(
        (b) => b.baName.toLowerCase() === editTargetItem.entityName.toLowerCase()
      );
      const synced = syncQuarterBaSellInToStores({
        year: selectedYear,
        quarter: selectedQuarter,
        baName: editTargetItem.entityName,
        storeName: baItem?.storeName || '',
        quarterTargetSellIn: sellInVal,
        monthlyBreakdown: baItem?.monthlyBreakdown,
      });
      saveQuarterlyTargetOverride(
        selectedYear,
        selectedQuarter,
        'ba',
        editTargetItem.entityName,
        {
          ...(synced ? {} : { targetSellIn: sellInVal }),
          targetSellOut: sellOutVal,
        }
      );
      setEditTargetItem(null);
      return;
    }

    saveQuarterlyTargetOverride(
      selectedYear,
      selectedQuarter,
      editTargetItem.role,
      editTargetItem.entityName,
      {
        targetSellIn: sellInVal,
        targetSellOut: sellOutVal,
      }
    );
    setEditTargetItem(null);
  };

  const handleSaveSingleActualSellIn = () => {
    if (!editActualSellInItem) return;
    if (editActualSellInItem.editMode === 'monthly') {
      const m0 = Math.max(0, Math.round(Number(editActualSellInItem.monthlySellIn[0]) || 0));
      const m1 = Math.max(0, Math.round(Number(editActualSellInItem.monthlySellIn[1]) || 0));
      const m2 = Math.max(0, Math.round(Number(editActualSellInItem.monthlySellIn[2]) || 0));
      saveQuarterlyActualSellInOverride(
        selectedYear,
        selectedQuarter,
        editActualSellInItem.role,
        editActualSellInItem.entityName,
        { monthlySellIn: [m0, m1, m2] }
      );
    } else {
      saveQuarterlyActualSellInOverride(
        selectedYear,
        selectedQuarter,
        editActualSellInItem.role,
        editActualSellInItem.entityName,
        { actualSellIn: Math.max(0, Math.round(Number(editActualSellInItem.totalSellIn) || 0)) }
      );
    }
    setEditActualSellInItem(null);
  };

  const summaryData = useMemo(() => {
    return {
      overall,
      salesList: filteredSales,
      baList: filteredBa,
      trainerList: filteredTrainer,
    };
  }, [overall, filteredSales, filteredBa, filteredTrainer]);

  const activeModalPersonData = useMemo(() => {
    if (!modalPerson) return null;
    if (modalPerson.type === 'sales') {
      const targetName = (modalPerson.data as SalesQuarterlySummaryItem).salesName;
      return summaryData.salesList.find((s) => s.salesName === targetName) || modalPerson.data;
    }
    if (modalPerson.type === 'ba') {
      const targetName = (modalPerson.data as BaQuarterlySummaryItem).baName;
      return summaryData.baList.find((b) => b.baName === targetName) || modalPerson.data;
    }
    const targetName = (modalPerson.data as TrainerQuarterlySummaryItem).trainerName;
    return summaryData.trainerList.find((t) => t.trainerName === targetName) || modalPerson.data;
  }, [modalPerson, summaryData]);

  // Handle Excel export
  const handleExport = () => {
    exportQuarterlyToExcel(summaryData, selectedQuarter, selectedYear);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-0">
      {/* 1. Header Toolbar: Quarter Selector, Filters, and Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Achieve Quartal (Executive Summary)
                  </h1>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    Sales • BA • Trainer
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Konsolidasi performa pencapaian omset, produk fokus, dan skor KPI Scorecard selama 3 bulan
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons: Edit Target Kuartal, Edit Realisasi Sell In, Excel & Print */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openBulkTargetModal(activeSubTab === 'ba' ? 'ba' : activeSubTab === 'trainer' ? 'trainer' : 'sales', 'targets')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
              title="Edit Target Kuartal Sell In & Sell Out per Kuartal (Q1-Q4)"
            >
              <Sliders className="w-4 h-4" />
              <span>Edit Target Kuartal</span>
            </button>
            {(isKetSellIn || !isKetSellOut) && (
              <button
                onClick={() => openBulkTargetModal(activeSubTab === 'ba' ? 'ba' : activeSubTab === 'trainer' ? 'trainer' : 'sales', 'actualSellIn')}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all cursor-pointer"
                title="Edit Realisasi Sell In per Kuartal (Q1-Q4)"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit Realisasi Sell In</span>
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
              title="Download File Excel Lengkap (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
              title="Cetak atau Simpan PDF Laporan"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Quarter & Filter Pill Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Quarter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 overflow-x-auto">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as QuarterPeriodKey[]).map((qKey) => {
              const info = QUARTER_MONTHS[qKey];
              const isSelected = selectedQuarter === qKey;
              return (
                <button
                  key={qKey}
                  onClick={() => setSelectedQuarter(qKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span className="mr-1.5">{info.label}</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    ({info.monthNames.map((m) => m.slice(0, 3)).join('-')})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary Dropdown Filters */}
          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-600">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </div>

            {/* Area Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-600">Area:</span>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer max-w-[120px] truncate"
              >
                <option value="ALL">Semua Area</option>
                {availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            {/* SPV Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-600">SPV:</span>
              <select
                value={selectedSpv}
                onChange={(e) => setSelectedSpv(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer max-w-[120px] truncate"
              >
                <option value="ALL">Semua SPV</option>
                {availableSpvs.map((spv) => (
                  <option key={spv} value={spv}>
                    {spv}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Integrated KET Mode Indicator */}
            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border font-bold ${
                isKetSellIn
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : isKetSellOut
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800'
              }`}
              title="Mengikuti Filter Terintegrasi (KET: Sell In / Sell Out)"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Mode KET: {activeKetDisplayLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Executive KPI Cards (4 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Omset Area Kuartal */}
        <div className="bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/20 rounded-2xl border border-indigo-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
            <div>
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                {isKetSellIn
                  ? 'Realisasi Kuartal (Sell In)'
                  : isKetSellOut
                  ? 'Realisasi Kuartal (Sell Out)'
                  : 'Total Omset Kuartal'}
              </span>
              <span className="text-[10px] font-semibold text-indigo-600">
                {isKetSellIn ? 'Pencapaian Sell In' : isKetSellOut ? 'Pencapaian Sell Out' : 'Gabungan Sell In & Sell Out'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {formatRupiah(overall.totalActualArea, true)}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  overall.areaAchievementPercent >= 100
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {overall.areaAchievementPercent >= 100 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formatPercent(overall.areaAchievementPercent)}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex justify-between">
              <span>Target: {formatRupiah(overall.totalTargetArea, true)}</span>
              <span className="font-semibold text-slate-700">
                Gap: {formatRupiah(overall.totalActualArea - overall.totalTargetArea, true)}
              </span>
            </div>
            {!isKetSellIn && !isKetSellOut && (
              <div className="mt-1 text-[10px] text-slate-500 flex justify-between">
                <span>Sell In: {formatRupiah(overall.totalActualSellIn, true)}</span>
                <span>Sell Out: {formatRupiah(overall.totalActualSellOut, true)}</span>
              </div>
            )}
            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3 border border-slate-200/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overall.areaAchievementPercent >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, overall.areaAchievementPercent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Kinerja Tim Sales */}
        <div className="bg-gradient-to-br from-white via-blue-50/20 to-sky-50/20 rounded-2xl border border-blue-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-blue-100">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Kinerja Tim Sales
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-white shadow-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {overall.totalSalesCount} <span className="text-sm font-semibold text-slate-500">Sales</span>
              </span>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                Avg KPI: {overall.avgSalesKpiScore} Poin
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Total Komisi Kuartal:</span>
                <span className="font-bold font-mono text-emerald-700">
                  {formatRupiah(overall.totalSalesCommission, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Top Performer:</span>
                <span className="font-bold text-slate-900 truncate max-w-[140px]">
                  {overall.topSales?.name || '-'} ({formatPercent(overall.topSales?.percent || 0)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Kinerja Tim Beauty Advisor (BA) */}
        <div className="bg-gradient-to-br from-white via-pink-50/20 to-rose-50/20 rounded-2xl border border-pink-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-pink-100">
            <span className="text-xs font-bold text-pink-900 uppercase tracking-wider">
              Kinerja Tim BA
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {overall.totalBaCount} <span className="text-sm font-semibold text-slate-500">BA</span>
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Off: Bebas Denda
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Est. Total THP Kuartal:</span>
                <span className="font-bold font-mono text-slate-900">
                  {formatRupiah(overall.totalBaTakeHomePay, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Top BA Star:</span>
                <span className="font-bold text-pink-700 truncate max-w-[150px]">
                  {overall.topBa?.name || '-'} ({formatPercent(overall.topBa?.percent || 0)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Kinerja Tim Trainer */}
        <div className="bg-gradient-to-br from-white via-purple-50/20 to-indigo-50/20 rounded-2xl border border-purple-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-purple-100">
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
              Kinerja Tim Trainer
            </span>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {overall.totalTrainerCount} <span className="text-sm font-semibold text-slate-500">Trainer</span>
              </span>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
                Avg KPI: {overall.avgTrainerKpiScore} Poin
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Insentif Netto Kuartal:</span>
                <span className="font-bold font-mono text-purple-700">
                  {formatRupiah(overall.totalTrainerIncentive, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Aturan Insentif:</span>
                <span className="font-semibold text-slate-700">
                  Tier 80-100% / SP1 &lt;70%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Hall of Fame / Podium Top Performer Kuartal & Rincian KET Filter */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                Hall of Fame • Juara Terhebat {overall.quarterLabel}
              </h3>
              <p className="text-[11px] text-slate-400">
                Peringkat diurutkan dari pencapaian persentase (%) tertinggi • Mengikuti Filter Terintegrasi ({activeKetDisplayLabel})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                isKetSellIn
                  ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                  : isKetSellOut
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                  : 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
              }`}
            >
              Filter KET: {activeKetDisplayLabel}
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
              {overall.dateRangeLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Top Sales */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-blue-400" />
                Top Sales Champion
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Peringkat 1
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-base font-extrabold text-white">
                {overall.topSales?.name || 'Tidak ada data'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {isKetSellIn ? 'Realisasi Sell In:' : isKetSellOut ? 'Realisasi Sell Out:' : 'Omset Kuartal:'}{' '}
                <span className="font-bold text-amber-300 font-mono">{formatRupiah(overall.topSales?.actual || 0, true)}</span>
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Target: {formatRupiah(overall.topSales?.target || 0, true)}
                </span>
                <span className="font-black text-emerald-400">
                  {formatPercent(overall.topSales?.percent || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Top BA */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-pink-400" />
                Top Beauty Advisor Star
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/30">
                Peringkat 1
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-base font-extrabold text-white truncate">
                {overall.topBa?.name || 'Tidak ada data'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                Outlet: <span className="font-bold text-pink-300">{overall.topBa?.store || '-'}</span>
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {isKetSellIn ? 'Realisasi Sell In:' : isKetSellOut ? 'Realisasi Sell Out:' : 'Omset Kuartal:'}{' '}
                <span className="font-bold text-amber-300 font-mono">{formatRupiah(overall.topBa?.actual || 0, true)}</span>
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Target: {formatRupiah(overall.topBa?.target || 0, true)}
                </span>
                <span className="font-black text-emerald-400">
                  {formatPercent(overall.topBa?.percent || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Top Trainer */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-purple-400" />
                Top Trainer of The Quarter
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                Peringkat 1
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-base font-extrabold text-white">
                {overall.topTrainer?.name || 'Tidak ada data'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {isKetSellIn ? 'Realisasi Sell In:' : isKetSellOut ? 'Realisasi Sell Out:' : 'Realisasi Area:'}{' '}
                <span className="font-bold text-purple-300 font-mono">
                  {formatRupiah(overall.topTrainer?.actual || 0, true)}
                </span>
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">KPI: {overall.topTrainer?.score || 0} Poin</span>
                <span className="font-black text-emerald-400">
                  {formatPercent(overall.topTrainer?.percent || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rincian Pencapaian Hall of Fame Mengikuti Filter Terintegrasi (Sell In / Sell Out) */}
        <div className="mt-5 pt-4 border-t border-slate-800/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                Rincian Pencapaian {overall.quarterLabel} —{' '}
                {isKetSellIn
                  ? 'Semua Pencapaian SELL IN'
                  : isKetSellOut
                  ? 'Semua Pencapaian SELL OUT'
                  : 'Semua Pencapaian SELL IN & SELL OUT'}
              </h4>
              <p className="text-[11px] text-slate-400">
                Urutan peringkat berdasarkan persentase pencapaian (%) tertinggi • Filter KET ({activeKetDisplayLabel})
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(isKetSellIn || !isKetSellOut) && (
                <button
                  type="button"
                  onClick={() => openBulkTargetModal(hallOfFameTab, 'actualSellIn')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 transition-colors cursor-pointer"
                  title="Edit massal Realisasi Sell In pada Rincian Pencapaian Kuartal"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Realisasi Sell In</span>
                </button>
              )}
              <div className="flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/10">
                {([
                  { id: 'sales', label: `Sales (${filteredSales.length})` },
                  { id: 'ba', label: `BA (${filteredBa.length})` },
                  { id: 'trainer', label: `Trainer (${filteredTrainer.length})` },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setHallOfFameTab(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      hallOfFameTab === tab.id
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-white/10 rounded-xl overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900">
                <tr className="border-b border-white/10 text-slate-300 font-bold">
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-3">
                    {hallOfFameTab === 'sales'
                      ? 'Personil Sales'
                      : hallOfFameTab === 'ba'
                      ? 'Nama BA & Toko'
                      : 'Nama Trainer'}
                  </th>
                  <th className="py-2.5 px-3">Area</th>
                  {(isKetSellIn || !isKetSellOut) && (
                    <>
                      <th className="py-2.5 px-3 text-right">Target Sell In</th>
                      <th className="py-2.5 px-3 text-right">Realisasi Sell In (Edit)</th>
                      <th className="py-2.5 px-3 text-center">% Sell In</th>
                    </>
                  )}
                  {(isKetSellOut || !isKetSellIn) && (
                    <>
                      <th className="py-2.5 px-3 text-right">Target Sell Out</th>
                      <th className="py-2.5 px-3 text-right">Realisasi Sell Out</th>
                      <th className="py-2.5 px-3 text-center">% Sell Out</th>
                    </>
                  )}
                  {!isKetSellIn && !isKetSellOut && (
                    <th className="py-2.5 px-3 text-center">% Peringkat</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {hallOfFameTab === 'sales' &&
                  filteredSales.map((s, idx) => (
                    <tr key={s.salesName} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-white">{s.salesName}</td>
                      <td className="py-2 px-3 text-slate-400">{s.coverArea}</td>
                      {(isKetSellIn || !isKetSellOut) && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatRupiah(s.quarterTargetSellIn, true)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-sky-300">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {s.isCustomActualSellIn && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/25 text-sky-200 border border-sky-400/40 font-sans font-bold">
                                  Manual
                                </span>
                              )}
                              <span>{formatRupiah(s.quarterActualSellIn, true)}</span>
                              <button
                                type="button"
                                onClick={() => openEditActualSellIn('sales', s)}
                                title="Edit Realisasi Sell In"
                                className="p-1 rounded-md text-sky-300/80 hover:text-white hover:bg-sky-500/30 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-300">
                            {formatPercent(s.quarterAchievementSellInPercent, false)}
                          </td>
                        </>
                      )}
                      {(isKetSellOut || !isKetSellIn) && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatRupiah(s.quarterTargetSellOut, true)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-300">
                            {formatRupiah(s.quarterActualSellOut, true)}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-300">
                            {formatPercent(s.quarterAchievementSellOutPercent, false)}
                          </td>
                        </>
                      )}
                      {!isKetSellIn && !isKetSellOut && (
                        <td className="py-2 px-3 text-center font-extrabold text-amber-300">
                          {formatPercent(s.quarterAchievementPercent, false)}
                        </td>
                      )}
                    </tr>
                  ))}
                {hallOfFameTab === 'ba' &&
                  filteredBa.map((b, idx) => (
                    <tr key={b.baName} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-white block">{b.baName}</span>
                        <span className="text-[10px] text-slate-400">{b.storeName}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{b.coverArea}</td>
                      {(isKetSellIn || !isKetSellOut) && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatRupiah(b.quarterTargetSellIn, true)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-sky-300">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {b.isCustomActualSellIn && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/25 text-sky-200 border border-sky-400/40 font-sans font-bold">
                                  Manual
                                </span>
                              )}
                              <span>{formatRupiah(b.quarterActualSellIn, true)}</span>
                              <button
                                type="button"
                                onClick={() => openEditActualSellIn('ba', b)}
                                title="Edit Realisasi Sell In"
                                className="p-1 rounded-md text-sky-300/80 hover:text-white hover:bg-sky-500/30 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-300">
                            {formatPercent(b.quarterAchievementSellInPercent, false)}
                          </td>
                        </>
                      )}
                      {(isKetSellOut || !isKetSellIn) && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            <span className="block">{formatRupiah(b.quarterTargetSellOut, true)}</span>
                            <span className="text-[9.5px] text-slate-400 font-sans block">
                              NL: {formatRupiah(b.quarterTargetNonLavojoy ?? 0, true)} • Lav: {formatRupiah(b.quarterTargetLavojoy ?? 0, true)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-300">
                            <span className="block">{formatRupiah(b.quarterActualSellOut, true)}</span>
                            <span className="text-[9.5px] text-slate-400 font-sans font-normal block">
                              NL: {formatRupiah(b.quarterActualNonLavojoy ?? 0, true)} • Lav: {formatRupiah(b.quarterActualLavojoy ?? 0, true)} • Fokus: {b.focusActualPcs}/{b.focusTargetPcs} pcs
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-300">
                            {formatPercent(b.quarterAchievementSellOutPercent, false)}
                          </td>
                        </>
                      )}
                      {!isKetSellIn && !isKetSellOut && (
                        <td className="py-2 px-3 text-center font-extrabold text-amber-300">
                          {formatPercent(b.quarterAchievementPercent, false)}
                        </td>
                      )}
                    </tr>
                  ))}
                {hallOfFameTab === 'trainer' &&
                  filteredTrainer.map((t, idx) => (
                    <tr key={t.trainerName} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 px-3 text-center font-extrabold text-amber-300">#{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-white">{t.trainerName}</td>
                      <td className="py-2 px-3 text-slate-400">{t.areaCovered}</td>
                      {(isKetSellIn || !isKetSellOut) && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatRupiah(t.quarterTargetSellIn, true)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-sky-300">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {t.isCustomActualSellIn && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/25 text-sky-200 border border-sky-400/40 font-sans font-bold">
                                  Manual
                                </span>
                              )}
                              <span>{formatRupiah(t.quarterActualSellIn, true)}</span>
                              <button
                                type="button"
                                onClick={() => openEditActualSellIn('trainer', t)}
                                title="Edit Realisasi Sell In"
                                className="p-1 rounded-md text-sky-300/80 hover:text-white hover:bg-sky-500/30 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-300">
                            {formatPercent(t.quarterAchievementSellInPercent, false)}
                          </td>
                        </>
                      )}
                      {(isKetSellOut || !isKetSellIn) && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatRupiah(t.quarterTargetSellOut, true)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-300">
                            {formatRupiah(t.quarterActualSellOut, true)}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-emerald-300">
                            {formatPercent(t.quarterAchievementSellOutPercent, false)}
                          </td>
                        </>
                      )}
                      {!isKetSellIn && !isKetSellOut && (
                        <td className="py-2 px-3 text-center font-extrabold text-amber-300">
                          {formatPercent(t.quarterAchievementPercent, false)}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Sub-Tab Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto">
          {[
            { id: 'all' as SubTabKey, label: 'Ringkasan Eksekutif (Semua)', count: null },
            { id: 'sales' as SubTabKey, label: 'Rangkuman Sales', count: salesList.length },
            { id: 'ba' as SubTabKey, label: 'Rangkuman BA', count: baList.length },
            { id: 'trainer' as SubTabKey, label: 'Rangkuman Trainer', count: trainerList.length },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, toko, atau area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 5. Sub-Tab Content */}

      {/* === SUB-TAB 1: ALL (RINGKASAN EKSEKUTIF SEMUA) === */}
      {activeSubTab === 'all' && (
        <div className="space-y-6">
          {/* Quick Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Sales Pillar Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Pilar Kinerja Sales</h4>
                      <p className="text-[11px] text-slate-500">Omset &amp; KPI Scorecard</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('sales')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    Detail <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Personil Sales:</span>
                    <span className="font-bold text-slate-900">{salesList.length} Orang</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Rata-rata Skor KPI:</span>
                    <span className="font-bold text-indigo-700">{overall.avgSalesKpiScore} / 100 Poin</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Komisi Kuartal:</span>
                    <span className="font-bold font-mono text-emerald-700">
                      {formatRupiah(overall.totalSalesCommission, true)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Mencapai Target (≥100%):</span>
                    <span className="font-bold text-emerald-700">
                      {salesList.filter((s) => s.quarterAchievementPercent >= 100).length} Sales
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  * Evaluasi mencakup target kuartalan dan 4 pilar KPI Scorecard.
                </span>
              </div>
            </div>

            {/* BA Pillar Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-pink-100 text-pink-800">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Pilar Kinerja BA</h4>
                      <p className="text-[11px] text-slate-500">Sell Out, Fokus &amp; Disiplin</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('ba')}
                    className="text-xs font-bold text-pink-600 hover:text-pink-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    Detail <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Beauty Advisor:</span>
                    <span className="font-bold text-slate-900">{baList.length} Personil</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total THP Kuartal:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {formatRupiah(overall.totalBaTakeHomePay, true)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Rata-rata Disiplin:</span>
                    <span className="font-bold text-emerald-700">
                      {Math.round(
                        baList.reduce((acc, b) => acc + b.disciplineRatePercent, 0) / (baList.length || 1)
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Hari Off Bebas Denda:</span>
                    <span className="font-bold text-slate-700">
                      {baList.reduce((acc, b) => acc + b.totalOffDays, 0)} Hari (Rp 0 Denda)
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  * Hari off resmi tidak dikenakan denda nihil Rp 25.000.
                </span>
              </div>
            </div>

            {/* Trainer Pillar Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Pilar Kinerja Trainer</h4>
                      <p className="text-[11px] text-slate-500">KPI 100 Poin &amp; Insentif</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('trainer')}
                    className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    Detail <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Personil Trainer:</span>
                    <span className="font-bold text-slate-900">{trainerList.length} Orang</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Rata-rata Skor KPI:</span>
                    <span className="font-bold text-purple-700">{overall.avgTrainerKpiScore} / 100 Poin</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Insentif Netto:</span>
                    <span className="font-bold font-mono text-purple-700">
                      {formatRupiah(overall.totalTrainerIncentive, true)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Status Evaluasi:</span>
                    <span className="font-bold text-emerald-700">
                      {trainerList.filter((t) => t.spStatus === 'Aman').length} Aman •{' '}
                      {trainerList.filter((t) => t.spStatus !== 'Aman').length} SP1
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  * 100%: Rp 2jt, 90-99%: Rp 1jt, 80-89%: Rp 500rb, &lt;70%: SP1 &amp; denda Rp 300rb.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preview Table: Top 5 Sales & Top 5 BA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Sales Preview */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Top Pencapaian Sales Kuartal
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Peringkat berdasarkan % pencapaian tertinggi
                  </span>
                </div>
                <button
                  onClick={() => setActiveSubTab('sales')}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Lihat Semua ({filteredSales.length})
                </button>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {filteredSales.slice(0, 5).map((s, idx) => (
                  <div key={s.salesName} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900">{s.salesName}</span>
                        <span className="text-[10px] text-slate-400 block">{s.coverArea}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(s.quarterActual, true)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${
                          s.quarterAchievementPercent >= 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatPercent(s.quarterAchievementPercent)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top BA Preview */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-pink-600" />
                    Top Pencapaian BA Kuartal
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Peringkat berdasarkan % pencapaian tertinggi
                  </span>
                </div>
                <button
                  onClick={() => setActiveSubTab('ba')}
                  className="text-xs font-bold text-pink-600 hover:underline cursor-pointer"
                >
                  Lihat Semua ({filteredBa.length})
                </button>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {filteredBa.slice(0, 5).map((b, idx) => (
                  <div key={b.baName} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900">{b.baName}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                          {b.storeName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(b.quarterActual, true)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${
                          b.quarterAchievementPercent >= 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatPercent(b.quarterAchievementPercent)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SUB-TAB 2: SALES (RANGKUMAN SALES) === */}
      {activeSubTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Daftar Rangkuman Kuartal Personil Sales ({overall.quarterLabel})
              </h3>
              <p className="text-xs text-slate-500">
                Hanya menampilkan 6 Sales terdaftar • Target Kuartal (Sell In &amp; Sell Out) dapat diedit per kuartal • Realisasi mengikuti filter {activeKetDisplayLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openBulkTargetModal('sales', 'targets')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Setting Target Kuartal Sales</span>
              </button>
              {(isKetSellIn || !isKetSellOut) && (
                <button
                  onClick={() => openBulkTargetModal('sales', 'actualSellIn')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Realisasi Sell In</span>
                </button>
              )}
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                {filteredSales.length} Personil
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3">Nama Sales</th>
                  <th className="py-3 px-3">Area</th>
                  <th className="py-3 px-3 text-right">
                    {isKetSellIn ? 'Target Sell In (Q)' : isKetSellOut ? 'Target Sell Out (Q)' : 'Target Kuartal (In / Out)'}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {isKetSellIn ? 'Realisasi Sell In (Q)' : isKetSellOut ? 'Realisasi Sell Out (Q)' : 'Realisasi Kuartal'}
                  </th>
                  <th className="py-3 px-3 text-center">% Ach</th>
                  <th className="py-3 px-3 text-center">Avg KPI</th>
                  <th className="py-3 px-3 text-center">Grade KPI</th>
                  <th className="py-3 px-3 text-right">Total Komisi</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((s) => (
                  <tr key={s.salesName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{s.salesName}</span>
                        {s.isCustomQuarterTarget && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                            Custom Q
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{s.coverArea}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {formatRupiah(s.quarterTarget, true)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            In: {formatRupiah(s.quarterTargetSellIn, true)} • Out: {formatRupiah(s.quarterTargetSellOut, true)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditTargetItem({
                              role: 'sales',
                              entityName: s.salesName,
                              subtitle: `${s.coverArea} • ${overall.quarterLabel}`,
                              targetSellIn: String(Math.round(s.quarterTargetSellIn)),
                              targetSellOut: String(Math.round(s.quarterTargetSellOut)),
                              isCustom: Boolean(s.isCustomQuarterTarget),
                            })
                          }
                          title="Edit Target Kuartal Sell In & Sell Out"
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      <div className="flex items-center justify-end gap-1.5">
                        <div>
                          <span className="block">{formatRupiah(s.quarterActual, true)}</span>
                          <span className="text-[10px] font-normal text-slate-500 block">
                            In: {formatRupiah(s.quarterActualSellIn, true)} • Out: {formatRupiah(s.quarterActualSellOut, true)}
                          </span>
                          {s.isCustomActualSellIn && (
                            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-sans font-bold">
                              Sell In Manual
                            </span>
                          )}
                        </div>
                        {(isKetSellIn || !isKetSellOut) && (
                          <button
                            type="button"
                            onClick={() => openEditActualSellIn('sales', s)}
                            title="Edit Realisasi Sell In"
                            className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          s.quarterAchievementPercent >= 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.quarterAchievementPercent >= 80
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {formatPercent(s.quarterAchievementPercent)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-indigo-700">
                      {s.avgKpiScore} Poin
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                          s.kpiGrade === 'Grade A'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : s.kpiGrade === 'Grade B'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {s.kpiGrade}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatRupiah(s.totalCommission, true)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.statusBadge === 'Melampaui Target'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.statusBadge === 'Mencapai Target'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {s.statusBadge}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setModalPerson({ type: 'sales', data: s })}
                        className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200/80 transition-colors cursor-pointer"
                      >
                        Rincian 3 Bulan
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Tidak ada data sales yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === SUB-TAB 3: BEAUTY ADVISOR (RANGKUMAN BA) === */}
      {activeSubTab === 'ba' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Daftar Rangkuman Kuartal Beauty Advisor (BA) — {overall.quarterLabel}
              </h3>
              <p className="text-xs text-slate-500">
                Target &amp; Pencapaian Sell Out BA mengikuti Daftar Target BA (Non-Lavojoy, Lavojoy &amp; Produk Fokus Pcs) • Realisasi Sell In berdasarkan Nama Toko
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openBulkTargetModal('ba', 'targets')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-pink-600 hover:bg-pink-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Setting Target Kuartal BA</span>
              </button>
              {(isKetSellIn || !isKetSellOut) && (
                <button
                  onClick={() => openBulkTargetModal('ba', 'actualSellIn')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Realisasi Sell In</span>
                </button>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Hari Off = Bebas Denda
              </span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-pink-100 text-pink-800">
                {filteredBa.length} BA
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3 text-center">Rank</th>
                  <th className="py-3 px-3">Nama BA &amp; Toko</th>
                  <th className="py-3 px-3">Area / SPV</th>
                  <th className="py-3 px-3 text-right">
                    {isKetSellIn ? 'Target Sell In (Q)' : isKetSellOut ? 'Target Sell Out (Q)' : 'Target Kuartal'}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {isKetSellIn ? 'Realisasi Sell In (Q)' : isKetSellOut ? 'Realisasi Sell Out (Q)' : 'Realisasi Kuartal'}
                  </th>
                  <th className="py-3 px-3 text-center">% Ach</th>
                  <th className="py-3 px-3 text-center">Fokus (Target/Real)</th>
                  <th className="py-3 px-3 text-center">% Fokus</th>
                  <th className="py-3 px-3 text-center">Nihil / Off</th>
                  <th className="py-3 px-3 text-right">Denda Nihil</th>
                  <th className="py-3 px-3 text-right">Est. THP Kuartal</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBa.map((b) => (
                  <tr key={b.baName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-center font-extrabold text-slate-700">
                      <span className="w-6 h-6 rounded-full bg-slate-100 inline-flex items-center justify-center text-[11px]">
                        {b.rank}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{b.baName}</span>
                        {b.isCustomQuarterTarget && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 font-bold">
                            Custom Q
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 max-w-[240px] leading-snug block">
                        {b.storeName}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">{b.coverArea}</span>
                      <span className="text-[10px] text-slate-400 block">SPV: {b.spvName}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {formatRupiah(b.quarterTarget, true)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            NL: {formatRupiah(b.quarterTargetNonLavojoy ?? 0, true)} • Lav: {formatRupiah(b.quarterTargetLavojoy ?? 0, true)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            In: {formatRupiah(b.quarterTargetSellIn, true)} • Out: {formatRupiah(b.quarterTargetSellOut, true)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditTargetItem({
                              role: 'ba',
                              entityName: b.baName,
                              subtitle: `${b.storeName} • ${overall.quarterLabel}`,
                              targetSellIn: String(Math.round(b.quarterTargetSellIn)),
                              targetSellOut: String(Math.round(b.quarterTargetSellOut)),
                              isCustom: Boolean(b.isCustomQuarterTarget),
                            })
                          }
                          title="Edit Target Kuartal Sell In & Sell Out"
                          className="p-1 rounded-md text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      <div className="flex items-center justify-end gap-1.5">
                        <div>
                          <span className="block">{formatRupiah(b.quarterActual, true)}</span>
                          <span className="text-[10px] font-normal text-slate-500 block">
                            NL: {formatRupiah(b.quarterActualNonLavojoy ?? 0, true)} • Lav: {formatRupiah(b.quarterActualLavojoy ?? 0, true)}
                          </span>
                          <span className="text-[10px] font-normal text-slate-400 block">
                            In: {formatRupiah(b.quarterActualSellIn, true)} • Out: {formatRupiah(b.quarterActualSellOut, true)}
                          </span>
                          {b.isCustomActualSellIn && (
                            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-sans font-bold">
                              Sell In Manual
                            </span>
                          )}
                        </div>
                        {(isKetSellIn || !isKetSellOut) && (
                          <button
                            type="button"
                            onClick={() => openEditActualSellIn('ba', b)}
                            title="Edit Realisasi Sell In"
                            className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          b.quarterAchievementPercent >= 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.quarterAchievementPercent >= 80
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {formatPercent(b.quarterAchievementPercent)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px]">
                      <span className="text-slate-500">{b.focusTargetPcs}</span> /{' '}
                      <span className="font-bold text-slate-900">{b.focusActualPcs} pcs</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          b.focusAchievementPercent >= 100
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatPercent(b.focusAchievementPercent)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-[11px]">
                      <span className="text-rose-600 font-bold" title="Hari Nihil dikenai denda">
                        {b.totalNihilDays} Nihil
                      </span>{' '}
                      /{' '}
                      <span className="text-emerald-700 font-semibold" title="Hari Off Resmi BEBAS denda">
                        {b.totalOffDays} Off
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600">
                      {b.totalDendaNominal > 0 ? `-${formatRupiah(b.totalDendaNominal, true)}` : 'Rp 0'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(b.totalTakeHomePay, true)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setModalPerson({ type: 'ba', data: b })}
                        className="px-2.5 py-1 text-[11px] font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg border border-pink-200/80 transition-colors cursor-pointer"
                      >
                        Rincian 3 Bulan
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBa.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      Tidak ada data BA yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === SUB-TAB 4: TRAINER (RANGKUMAN TRAINER) === */}
      {activeSubTab === 'trainer' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50/60">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Daftar Rangkuman Kuartal Trainer — {overall.quarterLabel}
              </h3>
              <p className="text-xs text-slate-500">
                Target Kuartal Sell In &amp; Sell Out bisa diedit per kuartal • Realisasi mengikuti {activeKetDisplayLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => openBulkTargetModal('trainer', 'targets')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Setting Target Kuartal Trainer</span>
              </button>
              {(isKetSellIn || !isKetSellOut) && (
                <button
                  onClick={() => openBulkTargetModal('trainer', 'actualSellIn')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Realisasi Sell In</span>
                </button>
              )}
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                {filteredTrainer.length} Trainer
              </span>
            </div>
          </div>

          {/* Rule banner reminder */}
          <div className="p-3 bg-purple-50/60 border-b border-purple-100 text-xs text-purple-900 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              📋 Skema Insentif Kuartalan Trainer:
            </span>
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200 font-bold text-emerald-800">
                100%: +Rp 2.000.000 / bln (+Rp 6.000.000 / Q)
              </span>
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200 font-bold text-blue-800">
                90-99%: +Rp 1.000.000 / bln (+Rp 3.000.000 / Q)
              </span>
              <span className="bg-white px-2 py-0.5 rounded border border-purple-200 font-bold text-indigo-800">
                80-89%: +Rp 500.000 / bln (+Rp 1.500.000 / Q)
              </span>
              <span className="bg-white px-2 py-0.5 rounded border border-rose-200 font-bold text-rose-800">
                &lt;70%: SP1 &amp; Denda Rp 300.000 / bln
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-3">Nama Trainer</th>
                  <th className="py-3 px-3">Area Covered</th>
                  <th className="py-3 px-3 text-right">
                    {isKetSellIn ? 'Target Sell In (Q)' : isKetSellOut ? 'Target Sell Out (Q)' : 'Target Area (Q)'}
                  </th>
                  <th className="py-3 px-3 text-right">
                    {isKetSellIn ? 'Realisasi Sell In (Q)' : isKetSellOut ? 'Realisasi Sell Out (Q)' : 'Realisasi Area (Q)'}
                  </th>
                  <th className="py-3 px-3 text-center">% Ach Area</th>
                  <th className="py-3 px-3 text-center">Fokus Area (Pcs)</th>
                  <th className="py-3 px-3 text-center">Avg Skor KPI</th>
                  <th className="py-3 px-3 text-right">Insentif Tier</th>
                  <th className="py-3 px-3 text-right">Denda SP1</th>
                  <th className="py-3 px-3 text-right">Insentif Netto</th>
                  <th className="py-3 px-3 text-center">Status SP1</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrainer.map((t) => (
                  <tr key={t.trainerName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{t.trainerName}</span>
                        {t.isCustomQuarterTarget && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">
                            Custom Q
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{t.areaCovered}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {formatRupiah(t.quarterTarget, true)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            In: {formatRupiah(t.quarterTargetSellIn, true)} • Out: {formatRupiah(t.quarterTargetSellOut, true)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditTargetItem({
                              role: 'trainer',
                              entityName: t.trainerName,
                              subtitle: `${t.areaCovered} • ${overall.quarterLabel}`,
                              targetSellIn: String(Math.round(t.quarterTargetSellIn)),
                              targetSellOut: String(Math.round(t.quarterTargetSellOut)),
                              isCustom: Boolean(t.isCustomQuarterTarget),
                            })
                          }
                          title="Edit Target Kuartal Sell In & Sell Out"
                          className="p-1 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      <div className="flex items-center justify-end gap-1.5">
                        <div>
                          <span className="block">{formatRupiah(t.quarterActual, true)}</span>
                          <span className="text-[10px] font-normal text-slate-500 block">
                            In: {formatRupiah(t.quarterActualSellIn, true)} • Out: {formatRupiah(t.quarterActualSellOut, true)}
                          </span>
                          {t.isCustomActualSellIn && (
                            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-sans font-bold">
                              Sell In Manual
                            </span>
                          )}
                        </div>
                        {(isKetSellIn || !isKetSellOut) && (
                          <button
                            type="button"
                            onClick={() => openEditActualSellIn('trainer', t)}
                            title="Edit Realisasi Sell In"
                            className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          t.quarterAchievementPercent >= 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {formatPercent(t.quarterAchievementPercent)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="font-bold text-slate-900">{t.focusActualPcs}</span> /{' '}
                      <span className="text-slate-500">{t.focusTargetPcs} pcs</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-extrabold text-purple-700 text-sm">
                        {t.avgKpiScore}
                      </span>
                      <span className="text-[10px] text-slate-400 block">/ 100 Poin</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatRupiah(t.totalIncentive, true)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600">
                      {t.totalDendaSP1 > 0 ? `-${formatRupiah(t.totalDendaSP1, true)}` : 'Rp 0'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-purple-900">
                      {formatRupiah(t.netIncentive, true)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.spStatus === 'Aman'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {t.spStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setModalPerson({ type: 'trainer', data: t })}
                        className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200/80 transition-colors cursor-pointer"
                      >
                        Rincian 3 Bulan
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTrainer.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      Tidak ada data trainer yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Modal Detail 3 Bulan (Bulan 1, 2, 3 Breakdown) */}
      {modalPerson && activeModalPersonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {modalPerson.type === 'sales'
                      ? 'Sales Scorecard'
                      : modalPerson.type === 'ba'
                      ? 'Beauty Advisor Performance'
                      : 'Trainer Evaluation'}
                  </span>
                  <span className="text-xs text-slate-400">• {overall.quarterLabel}</span>
                  {activeModalPersonData.isCustomActualSellIn && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-700">
                      Sell In Manual
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {modalPerson.type === 'sales'
                    ? (activeModalPersonData as SalesQuarterlySummaryItem).salesName
                    : modalPerson.type === 'ba'
                    ? (activeModalPersonData as BaQuarterlySummaryItem).baName
                    : (activeModalPersonData as TrainerQuarterlySummaryItem).trainerName}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalPerson.type === 'sales'
                    ? `Area: ${(activeModalPersonData as SalesQuarterlySummaryItem).coverArea}`
                    : modalPerson.type === 'ba'
                    ? `Toko: ${(activeModalPersonData as BaQuarterlySummaryItem).storeName} • Area: ${(activeModalPersonData as BaQuarterlySummaryItem).coverArea}`
                    : `Area: ${(activeModalPersonData as TrainerQuarterlySummaryItem).areaCovered}`}
                </p>
              </div>
              <button
                onClick={() => setModalPerson(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="mt-5">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Rincian Performa Tiap Bulan ({overall.quarterLabel}) • {activeKetDisplayLabel}
                </h4>
                {(isKetSellIn || !isKetSellOut) && (
                  <button
                    type="button"
                    onClick={() => openEditActualSellIn(modalPerson.type, activeModalPersonData, 'monthly')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Realisasi Sell In (3 Bulan)</span>
                  </button>
                )}
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Bulan</th>
                      {(isKetSellIn || !isKetSellOut) && (
                        <>
                          <th className="py-2.5 px-3 text-right">Target Sell In</th>
                          <th className="py-2.5 px-3 text-right">Realisasi Sell In</th>
                        </>
                      )}
                      {(isKetSellOut || !isKetSellIn) && (
                        <>
                          <th className="py-2.5 px-3 text-right">Target Sell Out</th>
                          <th className="py-2.5 px-3 text-right">Realisasi Sell Out</th>
                        </>
                      )}
                      <th className="py-2.5 px-3 text-center">% Pencapaian</th>
                      {modalPerson.type === 'ba' && (
                        <>
                          <th className="py-2.5 px-3 text-center">Fokus (Pcs)</th>
                          <th className="py-2.5 px-3 text-center">Nihil / Off</th>
                        </>
                      )}
                      {modalPerson.type === 'trainer' && (
                        <>
                          <th className="py-2.5 px-3 text-center">Fokus (Pcs)</th>
                          <th className="py-2.5 px-3 text-center">Skor KPI</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeModalPersonData.monthlyBreakdown.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{m.monthName}</td>
                        {(isKetSellIn || !isKetSellOut) && (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {formatRupiah(m.targetSellIn ?? 0, true)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800">
                              {formatRupiah(m.actualSellIn ?? 0, true)}
                            </td>
                          </>
                        )}
                        {(isKetSellOut || !isKetSellIn) && (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              <span className="block">{formatRupiah(m.targetSellOut ?? 0, true)}</span>
                              {modalPerson.type === 'ba' && m.targetNonLavojoy !== undefined && (
                                <span className="text-[9.5px] text-slate-400 font-sans block">
                                  NL: {formatRupiah(m.targetNonLavojoy, true)} • Lav: {formatRupiah(m.targetLavojoy ?? 0, true)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                              <span className="block">{formatRupiah(m.actualSellOut ?? 0, true)}</span>
                              {modalPerson.type === 'ba' && m.actualNonLavojoy !== undefined && (
                                <span className="text-[9.5px] text-slate-500 font-sans font-normal block">
                                  NL: {formatRupiah(m.actualNonLavojoy, true)} • Lav: {formatRupiah(m.actualLavojoy ?? 0, true)}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              m.achievementPercent >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {formatPercent(m.achievementPercent)}
                          </span>
                        </td>
                        {modalPerson.type === 'ba' && (
                          <>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {m.focusActualPcs} / {m.focusTargetPcs}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[10px]">
                              <span className="text-rose-600 font-bold">{m.nihilDays || 0} Nihil</span> •{' '}
                              <span className="text-emerald-700 font-semibold">{m.offDays || 0} Off</span>
                            </td>
                          </>
                        )}
                        {modalPerson.type === 'trainer' && (
                          <>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {m.focusActualPcs} pcs
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                              {m.kpiScore || 0} Poin
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Consolidation Footer */}
            <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-slate-600 block">
                  Total Pencapaian Kuartal ({activeKetDisplayLabel}):
                </span>
                {!isKetSellIn && !isKetSellOut && (
                  <span className="text-[11px] text-slate-500">
                    Sell In: {formatRupiah(activeModalPersonData.quarterActualSellIn, true)} • Sell Out:{' '}
                    {formatRupiah(activeModalPersonData.quarterActualSellOut, true)}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-sm text-slate-900">
                  {formatRupiah(activeModalPersonData.quarterActual, true)}
                </span>
                <span className="text-slate-500 ml-2 font-bold">
                  ({formatPercent(activeModalPersonData.quarterAchievementPercent)})
                </span>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setModalPerson(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick Single-Entity Target Kuartal Edit Modal */}
      {editTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  Edit Target Kuartal ({selectedQuarter} {selectedYear})
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {editTargetItem.entityName}
                </h3>
                <p className="text-xs text-slate-500">{editTargetItem.subtitle}</p>
              </div>
              <button
                onClick={() => setEditTargetItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target Kuartal SELL IN (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={editTargetItem.targetSellIn}
                  onChange={(e) =>
                    setEditTargetItem({ ...editTargetItem, targetSellIn: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Preview: {formatRupiah(Number(editTargetItem.targetSellIn) || 0)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target Kuartal SELL OUT (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={editTargetItem.targetSellOut}
                  onChange={(e) =>
                    setEditTargetItem({ ...editTargetItem, targetSellOut: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Preview: {formatRupiah(Number(editTargetItem.targetSellOut) || 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {editTargetItem.isCustom ? (
                <button
                  type="button"
                  onClick={() => {
                    clearQuarterlyTargetOverride(
                      selectedYear,
                      selectedQuarter,
                      editTargetItem.role,
                      editTargetItem.entityName
                    );
                    setEditTargetItem(null);
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditTargetItem(null)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSingleTarget}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Target</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7b. Quick Single-Entity Realisasi Sell In Edit Modal */}
      {editActualSellInItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-50 text-sky-700">
                  Edit Realisasi Sell In ({selectedQuarter} {selectedYear})
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {editActualSellInItem.entityName}
                </h3>
                <p className="text-xs text-slate-500">{editActualSellInItem.subtitle}</p>
              </div>
              <button
                onClick={() => setEditActualSellInItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle: Total Kuartal vs Per Bulan */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setEditActualSellInItem({ ...editActualSellInItem, editMode: 'total' })}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  editActualSellInItem.editMode === 'total'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Total Kuartal
              </button>
              <button
                type="button"
                onClick={() => setEditActualSellInItem({ ...editActualSellInItem, editMode: 'monthly' })}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  editActualSellInItem.editMode === 'monthly'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rincian 3 Bulan
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {editActualSellInItem.editMode === 'total' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Total Realisasi SELL IN {selectedQuarter} (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={editActualSellInItem.totalSellIn}
                    onChange={(e) =>
                      setEditActualSellInItem({ ...editActualSellInItem, totalSellIn: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Preview: {formatRupiah(Number(editActualSellInItem.totalSellIn) || 0)}</span>
                    <span className="font-bold text-emerald-700">
                      % Sell In:{' '}
                      {formatPercent(
                        editActualSellInItem.targetSellIn > 0
                          ? ((Number(editActualSellInItem.totalSellIn) || 0) /
                              editActualSellInItem.targetSellIn) *
                              100
                          : 0,
                        false
                      )}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Target Sell In: {formatRupiah(editActualSellInItem.targetSellIn, true)}. Nilai kuartal dibagi proporsional ke 3 bulan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx}>
                      <label className="block font-bold text-slate-700 mb-1">
                        Realisasi Sell In — {editActualSellInItem.monthNames[idx]} (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100000}
                        value={editActualSellInItem.monthlySellIn[idx]}
                        onChange={(e) => {
                          const nextMonthly: [string, string, string] = [
                            ...editActualSellInItem.monthlySellIn,
                          ] as [string, string, string];
                          nextMonthly[idx] = e.target.value;
                          const sum =
                            (Number(nextMonthly[0]) || 0) +
                            (Number(nextMonthly[1]) || 0) +
                            (Number(nextMonthly[2]) || 0);
                          setEditActualSellInItem({
                            ...editActualSellInItem,
                            monthlySellIn: nextMonthly,
                            totalSellIn: String(Math.round(sum)),
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  ))}
                  {(() => {
                    const monthlyTotal =
                      (Number(editActualSellInItem.monthlySellIn[0]) || 0) +
                      (Number(editActualSellInItem.monthlySellIn[1]) || 0) +
                      (Number(editActualSellInItem.monthlySellIn[2]) || 0);
                    const pct =
                      editActualSellInItem.targetSellIn > 0
                        ? (monthlyTotal / editActualSellInItem.targetSellIn) * 100
                        : 0;
                    return (
                      <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-sky-900">
                          Total 3 Bulan: {formatRupiah(monthlyTotal, true)}
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          % Sell In: {formatPercent(pct, false)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {editActualSellInItem.isCustom ? (
                <button
                  type="button"
                  onClick={() => {
                    clearQuarterlyActualSellInOverride(
                      selectedYear,
                      selectedQuarter,
                      editActualSellInItem.role,
                      editActualSellInItem.entityName
                    );
                    setEditActualSellInItem(null);
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Data Transaksi</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditActualSellInItem(null)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSingleActualSellIn}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Realisasi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Bulk Target & Realisasi Sell In Kuartal (Q1-Q4) Modal */}
      {isTargetModalOpen && modalSummaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  {bulkModalMode === 'targets' ? (
                    <Sliders className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Pencil className="w-4 h-4 text-sky-600" />
                  )}
                  <span>
                    {bulkModalMode === 'targets'
                      ? 'Pengaturan Target Kuartal (Sell In & Sell Out)'
                      : 'Edit Realisasi Sell In Kuartal'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bulkModalMode === 'targets'
                    ? 'Atur target berbeda untuk setiap Kuartal (Q1, Q2, Q3, Q4) pada Sales, BA, dan Trainer.'
                    : 'Sesuaikan nilai Realisasi Sell In per Kuartal (Q1-Q4); peringkat & % pencapaian otomatis terhitung ulang.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setBulkModalMode('targets')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                      bulkModalMode === 'targets'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Target Kuartal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkModalMode('actualSellIn')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                      bulkModalMode === 'actualSellIn'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Realisasi Sell In
                  </button>
                </div>
                <button
                  onClick={() => setIsTargetModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quarter, Year & Role Selectors */}
            <div className="py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['Q1', 'Q2', 'Q3', 'Q4'] as QuarterPeriodKey[]).map((qKey) => (
                  <button
                    key={qKey}
                    onClick={() => {
                      setTargetModalQuarter(qKey);
                      populateModalDrafts(targetModalRole, qKey, targetModalYear);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      targetModalQuarter === qKey
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {qKey}
                  </button>
                ))}
                <select
                  value={targetModalYear}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setTargetModalYear(yr);
                    populateModalDrafts(targetModalRole, targetModalQuarter, yr);
                  }}
                  className="ml-1 px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-800 outline-none"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {([
                  { id: 'sales' as QuarterlyTargetRole, label: 'Sales (6 Personil)' },
                  { id: 'ba' as QuarterlyTargetRole, label: 'Beauty Advisor (BA)' },
                  { id: 'trainer' as QuarterlyTargetRole, label: 'Trainer (ARA & RATIH)' },
                ]).map((rTab) => (
                  <button
                    key={rTab.id}
                    onClick={() => {
                      setTargetModalRole(rTab.id);
                      populateModalDrafts(rTab.id, targetModalQuarter, targetModalYear);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      targetModalRole === rTab.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {rTab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Table */}
            <div className="overflow-y-auto grow my-3 border border-slate-200 rounded-xl">
              {bulkModalMode === 'targets' ? (
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Nama Personil</th>
                      <th className="py-2.5 px-3">Area / Toko</th>
                      <th className="py-2.5 px-3">Target Kuartal Sell In (Rp)</th>
                      <th className="py-2.5 px-3">Target Kuartal Sell Out (Rp)</th>
                      <th className="py-2.5 px-3 text-center">Reset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(targetModalRole === 'sales'
                      ? modalSummaryData.salesList.map((s) => ({
                          name: s.salesName,
                          sub: s.coverArea,
                          isCustom: Boolean(s.isCustomQuarterTarget),
                        }))
                      : targetModalRole === 'ba'
                      ? modalSummaryData.baList.map((b) => ({
                          name: b.baName,
                          sub: b.storeName,
                          isCustom: Boolean(b.isCustomQuarterTarget),
                        }))
                      : modalSummaryData.trainerList.map((t) => ({
                          name: t.trainerName,
                          sub: t.areaCovered,
                          isCustom: Boolean(t.isCustomQuarterTarget),
                        }))
                    ).map((row) => {
                      const draft = targetDrafts[row.name] || { sellIn: '0', sellOut: '0' };
                      return (
                        <tr key={row.name} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <span>{row.name}</span>
                            {row.isCustom && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold">
                                Custom
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate">
                            {row.sub}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              step={500000}
                              value={draft.sellIn}
                              onChange={(e) =>
                                setTargetDrafts((prev) => ({
                                  ...prev,
                                  [row.name]: { ...draft, sellIn: e.target.value },
                                }))
                              }
                              className="w-40 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              step={500000}
                              value={draft.sellOut}
                              onChange={(e) =>
                                setTargetDrafts((prev) => ({
                                  ...prev,
                                  [row.name]: { ...draft, sellOut: e.target.value },
                                }))
                              }
                              className="w-40 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isCustom && (
                              <button
                                type="button"
                                onClick={() => {
                                  clearQuarterlyTargetOverride(
                                    targetModalYear,
                                    targetModalQuarter,
                                    targetModalRole,
                                    row.name
                                  );
                                  populateModalDrafts(targetModalRole, targetModalQuarter, targetModalYear);
                                }}
                                title="Kembalikan ke target default"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Nama Personil</th>
                      <th className="py-2.5 px-3">Area / Toko</th>
                      <th className="py-2.5 px-3 text-right">Target Sell In</th>
                      <th className="py-2.5 px-3">Realisasi Sell In (Rp)</th>
                      <th className="py-2.5 px-3 text-center">% Sell In</th>
                      <th className="py-2.5 px-3 text-center">Reset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(targetModalRole === 'sales'
                      ? modalSummaryData.salesList.map((s) => ({
                          name: s.salesName,
                          sub: s.coverArea,
                          targetSellIn: s.quarterTargetSellIn,
                          isCustom: Boolean(s.isCustomActualSellIn),
                        }))
                      : targetModalRole === 'ba'
                      ? modalSummaryData.baList.map((b) => ({
                          name: b.baName,
                          sub: b.storeName,
                          targetSellIn: b.quarterTargetSellIn,
                          isCustom: Boolean(b.isCustomActualSellIn),
                        }))
                      : modalSummaryData.trainerList.map((t) => ({
                          name: t.trainerName,
                          sub: t.areaCovered,
                          targetSellIn: t.quarterTargetSellIn,
                          isCustom: Boolean(t.isCustomActualSellIn),
                        }))
                    ).map((row) => {
                      const valStr = actualSellInDrafts[row.name] ?? '0';
                      const numVal = Math.max(0, Number(valStr) || 0);
                      const pct = row.targetSellIn > 0 ? (numVal / row.targetSellIn) * 100 : 0;
                      return (
                        <tr key={row.name} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <span>{row.name}</span>
                            {row.isCustom && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-bold">
                                Manual
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[160px] truncate">
                            {row.sub}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatRupiah(row.targetSellIn, true)}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={0}
                              step={100000}
                              value={valStr}
                              onChange={(e) =>
                                setActualSellInDrafts((prev) => ({
                                  ...prev,
                                  [row.name]: e.target.value,
                                }))
                              }
                              className="w-44 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                pct >= 100
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pct >= 80
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {formatPercent(pct, false)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isCustom && (
                              <button
                                type="button"
                                onClick={() => {
                                  clearQuarterlyActualSellInOverride(
                                    targetModalYear,
                                    targetModalQuarter,
                                    targetModalRole,
                                    row.name
                                  );
                                  populateModalDrafts(targetModalRole, targetModalQuarter, targetModalYear);
                                }}
                                title="Kembalikan ke data transaksi"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsTargetModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              {bulkModalMode === 'targets' ? (
                <button
                  type="button"
                  onClick={handleSaveBulkTargets}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Target {targetModalQuarter} {targetModalYear}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveBulkActualSellIn}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Realisasi Sell In {targetModalQuarter} {targetModalYear}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
