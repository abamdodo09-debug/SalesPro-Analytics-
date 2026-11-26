import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Store,
  Package,
  Layers,
  Users,
  ShieldAlert,
  Compass,
  Filter,
  Edit3,
  Save,
  RotateCcw,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import {
  SalesGapDiagnosis,
  DashboardFilters,
  TransactionRecord,
  DropEntityItem,
} from '../types/dashboard';
import {
  formatRupiah,
  formatPercent,
  diagnoseSalesGap,
} from '../utils/analytics';
import {
  MONTH_OPTIONS_2026,
  GAP_SALES_LIST,
  GAP_TRAINER_LIST,
  GapMonthlyQuotaConfig,
  getGapQuotaMonthKey,
  getGapQuotaMonthLabel,
  getGapEntityQuotaKey,
  loadAllGapMonthlyQuotaDetails,
  loadAllGapEntityQuotaDetails,
  setGapMonthlyQuotaDetail,
  resetGapMonthlyQuotaDetail,
  setGapEntityQuotaDetail,
  resetGapEntityQuotaDetail,
  resolveActiveGapQuotaDetail,
} from '../services/gapTargetService';

interface GapAnalysisViewProps {
  diagnosis: SalesGapDiagnosis;
  filters: DashboardFilters;
  records?: TransactionRecord[];
  onFilterChange?: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K]
  ) => void;
}

type KetFilterMode = 'ALL' | 'SELL IN' | 'SELL OUT';
type StoreGapCategoryFilter = 'ALL' | 'lost_outlet' | 'volume_drop' | 'return_impact';
type QuotaModalTab = 'general' | 'sales' | 'trainer';

export const GapAnalysisView: React.FC<GapAnalysisViewProps> = ({
  diagnosis,
  filters,
  records,
  onFilterChange,
}) => {
  const [subTab, setSubTab] = useState<'stores' | 'skus' | 'brands' | 'sales'>('stores');
  const [ketFilter, setKetFilter] = useState<KetFilterMode>(() => {
    const k = (filters.KET || 'ALL').trim().toUpperCase();
    return k === 'SELL IN' || k === 'SELL OUT' ? k : 'ALL';
  });

  // 100% Manual Monthly Target Kuota Penjualan state (General, per-Sales, per-Trainer)
  const [monthlyQuotaDetails, setMonthlyQuotaDetails] = useState<
    Record<string, GapMonthlyQuotaConfig>
  >(() => loadAllGapMonthlyQuotaDetails());
  const [entityQuotaDetails, setEntityQuotaDetails] = useState<
    Record<string, GapMonthlyQuotaConfig>
  >(() => loadAllGapEntityQuotaDetails());

  const [isEditingQuota, setIsEditingQuota] = useState(false);
  const [quotaTotalInput, setQuotaTotalInput] = useState<string>('');
  const [quotaSellInInput, setQuotaSellInInput] = useState<string>('');
  const [quotaSellOutInput, setQuotaSellOutInput] = useState<string>('');

  // Modal state for Atur Kuota per Bulan (Umum / Sales / Trainer)
  const [isAllMonthsModalOpen, setIsAllMonthsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<QuotaModalTab>('general');
  const [selectedModalSales, setSelectedModalSales] = useState<string>(GAP_SALES_LIST[0]);
  const [selectedModalTrainer, setSelectedModalTrainer] = useState<string>(GAP_TRAINER_LIST[0]);
  const [allMonthsDraft, setAllMonthsDraft] = useState<
    Record<string, { total: string; sellIn: string; sellOut: string }>
  >({});
  const [entityDraft, setEntityDraft] = useState<
    Record<string, { total: string; sellIn: string; sellOut: string }>
  >({});

  const [quotaFeedback, setQuotaFeedback] = useState<string | null>(null);

  // Expanded driver store list state (by factor index)
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});

  // Store gap breakdown filters
  const [storeGapFilter, setStoreGapFilter] = useState<StoreGapCategoryFilter>('ALL');
  const [storeGapSearch, setStoreGapSearch] = useState('');

  // Shared Filter Periode Tanggal (Rentang tanggal dalam bulan, mis. Tgl 1-15 atau 1-30 September vs Oktober)
  const [dateStartDay, setDateStartDay] = useState<number>(1);
  const [dateEndDay, setDateEndDay] = useState<number>(31);

  const isDateRangeActive = dateStartDay > 1 || dateEndDay < 31;
  const dateRange = useMemo(
    () => ({ startDay: dateStartDay, endDay: dateEndDay }),
    [dateStartDay, dateEndDay]
  );

  const handleStartDayChange = (day: number) => {
    const clamped = Math.max(1, Math.min(31, day));
    setDateStartDay(clamped);
    if (clamped > dateEndDay) {
      setDateEndDay(clamped);
    }
  };

  const handleEndDayChange = (day: number) => {
    const clamped = Math.max(1, Math.min(31, day));
    setDateEndDay(clamped);
    if (clamped < dateStartDay) {
      setDateStartDay(clamped);
    }
  };

  const applyDatePreset = (start: number, end: number) => {
    setDateStartDay(start);
    setDateEndDay(end);
  };

  // Complete list of Sales options (6 requested sales first + any others in records)
  const salesOptions = useMemo(() => {
    const base = new Set<string>(GAP_SALES_LIST);
    if (records) {
      records.forEach((r) => {
        if (r.SALES && r.SALES.trim()) base.add(r.SALES.trim().toUpperCase());
      });
    }
    return Array.from(base);
  }, [records]);

  // Sync local KET filter whenever global FilterBar KET changes
  useEffect(() => {
    const k = (filters.KET || 'ALL').trim().toUpperCase();
    if (k === 'SELL IN' || k === 'SELL OUT') {
      setKetFilter(k);
    } else {
      setKetFilter('ALL');
    }
  }, [filters.KET]);

  // Keep inline quota edit box closed when changing integrated filters
  useEffect(() => {
    setIsEditingQuota(false);
  }, [filters.BULAN, filters.TAHUN, filters.SALES, filters.TRAINER]);

  const activeMonthKey = useMemo(
    () => getGapQuotaMonthKey(filters.BULAN, filters.TAHUN),
    [filters.BULAN, filters.TAHUN]
  );
  const activeMonthLabel = useMemo(
    () => getGapQuotaMonthLabel(filters.BULAN, filters.TAHUN),
    [filters.BULAN, filters.TAHUN]
  );
  const activeYearStr =
    filters.TAHUN && filters.TAHUN !== 'ALL' ? String(filters.TAHUN) : '2026';

  const resolvedActiveScope = useMemo(
    () => resolveActiveGapQuotaDetail(filters),
    [filters, monthlyQuotaDetails, entityQuotaDetails]
  );

  // Live synced diagnosis using active integrated filters + resolved Sales/Trainer/General manual quota + Filter Periode Tanggal
  const syncedDiagnosis = useMemo(() => {
    if (!records || records.length === 0) return diagnosis;
    return diagnoseSalesGap(records, [], filters, resolvedActiveScope.config, dateRange);
  }, [records, filters, resolvedActiveScope.config, diagnosis, dateRange]);

  const {
    totalTarget,
    isCustomTarget,
    activeQuotaScopeLabel = resolvedActiveScope.scopeLabel,
    activeQuotaScopeType = resolvedActiveScope.scopeType,
    sellInTarget = 0,
    isCustomSellInTarget = false,
    sellInActual = 0,
    sellInGapDeficit = 0,
    sellOutTarget = 0,
    isCustomSellOutTarget = false,
    sellOutActual = 0,
    sellOutGapDeficit = 0,
    actualRevenue,
    gapDeficit,
    gapPercentage,
    previousRevenue,
    deltaVsPrevious,
    primaryDrivers,
    currentPeriodName,
    previousPeriodName,
  } = syncedDiagnosis;

  // Section 3 (Rincian Sumber Data Gap Penjualan per Toko): TERINTEGRASI penuh dengan Filter KET (SELL OUT / SELL IN / ALL)
  // dan seluruh filter terintegrasi + Google Sheet yang terhubung
  const storeGapDiagnosis = syncedDiagnosis;
  const activeStoreKet = (filters.KET || 'ALL').trim().toUpperCase();
  const isSellOutSection3 = activeStoreKet === 'SELL OUT';
  const isSellInSection3 = activeStoreKet === 'SELL IN';
  const effectiveStoreGapFilter: StoreGapCategoryFilter =
    (isSellOutSection3 || isSellInSection3) && storeGapFilter === 'return_impact'
      ? 'ALL'
      : storeGapFilter;

  const {
    storeGapDetails = [],
    totalStoreGapDeficit = 0,
    currentPeriodName: storeGapCurrentPeriodName,
    previousPeriodName: storeGapPreviousPeriodName,
  } = storeGapDiagnosis;

  // Entity deep-dive diagnosis respecting section KET filter (Semua / SELL IN / SELL OUT) + Filter Periode Tanggal
  const entityDiagnosis = useMemo(() => {
    if (!records || records.length === 0) return syncedDiagnosis;
    return diagnoseSalesGap(
      records,
      [],
      {
        ...filters,
        KET: ketFilter,
      },
      resolvedActiveScope.config,
      dateRange
    );
  }, [records, filters, ketFilter, resolvedActiveScope.config, syncedDiagnosis, dateRange]);

  const {
    topDroppingStores,
    topDroppingSkus,
    topDroppingBrands,
    topDroppingSales,
  } = entityDiagnosis;

  // Active integrated filter chips for clarity
  const activeFilterBadges = useMemo(() => {
    const chips: string[] = [`Bulan: ${activeMonthLabel}`];
    if (isDateRangeActive) {
      chips.push(
        dateStartDay === dateEndDay
          ? `Tanggal: ${dateStartDay}`
          : `Tanggal: ${dateStartDay}–${dateEndDay}`
      );
    }
    if (filters.SPV !== 'ALL') chips.push(`SPV: ${filters.SPV}`);
    if (filters.SALES !== 'ALL') chips.push(`Sales: ${filters.SALES}`);
    if (filters.TRAINER && filters.TRAINER !== 'ALL') chips.push(`Trainer: ${filters.TRAINER}`);
    if (filters.REGION !== 'ALL') chips.push(`Region: ${filters.REGION}`);
    if (filters.BRAND !== 'ALL') chips.push(`Brand: ${filters.BRAND}`);
    if (filters.KATEGORI && filters.KATEGORI !== 'ALL') chips.push(`Kategori: ${filters.KATEGORI}`);
    if (filters.NAMA_STORE !== 'ALL') chips.push(`Toko: ${filters.NAMA_STORE}`);
    if (filters.KET !== 'ALL') chips.push(`KET: ${filters.KET}`);
    if (filters.SKU !== 'ALL') chips.push(`SKU: ${filters.SKU}`);
    if (filters.searchQuery.trim()) chips.push(`Cari: "${filters.searchQuery.trim()}"`);
    return chips;
  }, [filters, activeMonthLabel]);

  // Handlers for Monthly Target Kuota Penjualan (100% Manual — Sales, Trainer, atau Umum)
  const showQuotaToast = (msg: string) => {
    setQuotaFeedback(msg);
    setTimeout(() => {
      setQuotaFeedback((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleStartEditQuota = () => {
    const existing = resolvedActiveScope.config || {};
    setQuotaSellInInput(existing.sellIn ? String(existing.sellIn) : '');
    setQuotaSellOutInput(existing.sellOut ? String(existing.sellOut) : '');
    setQuotaTotalInput(existing.total ? String(existing.total) : '');
    setIsEditingQuota(true);
  };

  const handleSaveQuota = () => {
    const parsedSellIn = Math.round(Number(quotaSellInInput) || 0);
    const parsedSellOut = Math.round(Number(quotaSellOutInput) || 0);
    const parsedTotal = Math.round(Number(quotaTotalInput) || 0);
    const cfg: GapMonthlyQuotaConfig = {
      sellIn: parsedSellIn > 0 ? parsedSellIn : undefined,
      sellOut: parsedSellOut > 0 ? parsedSellOut : undefined,
      total: parsedTotal > 0 ? parsedTotal : undefined,
    };

    if (resolvedActiveScope.scopeType === 'sales' && resolvedActiveScope.entityName) {
      if (!cfg.sellIn && !cfg.sellOut && !cfg.total) {
        const updated = resetGapEntityQuotaDetail(
          'sales',
          resolvedActiveScope.entityName,
          filters.BULAN,
          filters.TAHUN
        );
        setEntityQuotaDetails({ ...updated });
        setIsEditingQuota(false);
        showQuotaToast(
          `Target Kuota Sales ${resolvedActiveScope.entityName} (${activeMonthLabel}) dikosongkan ke Rp 0.`
        );
        return;
      }
      const updated = setGapEntityQuotaDetail(
        'sales',
        resolvedActiveScope.entityName,
        cfg,
        filters.BULAN,
        filters.TAHUN
      );
      setEntityQuotaDetails({ ...updated });
      setIsEditingQuota(false);
      showQuotaToast(
        `Target Kuota manual Sales ${resolvedActiveScope.entityName} (${activeMonthLabel}) tersimpan.`
      );
      return;
    }

    if (resolvedActiveScope.scopeType === 'trainer' && resolvedActiveScope.entityName) {
      if (!cfg.sellIn && !cfg.sellOut && !cfg.total) {
        const updated = resetGapEntityQuotaDetail(
          'trainer',
          resolvedActiveScope.entityName,
          filters.BULAN,
          filters.TAHUN
        );
        setEntityQuotaDetails({ ...updated });
        setIsEditingQuota(false);
        showQuotaToast(
          `Target Kuota Trainer ${resolvedActiveScope.entityName} (${activeMonthLabel}) dikosongkan ke Rp 0.`
        );
        return;
      }
      const updated = setGapEntityQuotaDetail(
        'trainer',
        resolvedActiveScope.entityName,
        cfg,
        filters.BULAN,
        filters.TAHUN
      );
      setEntityQuotaDetails({ ...updated });
      setIsEditingQuota(false);
      showQuotaToast(
        `Target Kuota manual Trainer ${resolvedActiveScope.entityName} (${activeMonthLabel}) tersimpan.`
      );
      return;
    }

    // General scope
    if (!cfg.sellIn && !cfg.sellOut && !cfg.total) {
      const updated = resetGapMonthlyQuotaDetail(filters.BULAN, filters.TAHUN);
      setMonthlyQuotaDetails({ ...updated });
      setIsEditingQuota(false);
      showQuotaToast(`Target Kuota ${activeMonthLabel} dikosongkan ke Rp 0.`);
      return;
    }

    const updated = setGapMonthlyQuotaDetail(cfg, filters.BULAN, filters.TAHUN);
    setMonthlyQuotaDetails({ ...updated });
    setIsEditingQuota(false);
    showQuotaToast(`Target Kuota manual ${activeMonthLabel} berhasil disimpan.`);
  };

  const handleResetQuota = () => {
    if (resolvedActiveScope.scopeType === 'sales' && resolvedActiveScope.entityName) {
      const updated = resetGapEntityQuotaDetail(
        'sales',
        resolvedActiveScope.entityName,
        filters.BULAN,
        filters.TAHUN
      );
      setEntityQuotaDetails({ ...updated });
      setIsEditingQuota(false);
      showQuotaToast(
        `Target Kuota Sales ${resolvedActiveScope.entityName} (${activeMonthLabel}) direset ke Rp 0.`
      );
      return;
    }

    if (resolvedActiveScope.scopeType === 'trainer' && resolvedActiveScope.entityName) {
      const updated = resetGapEntityQuotaDetail(
        'trainer',
        resolvedActiveScope.entityName,
        filters.BULAN,
        filters.TAHUN
      );
      setEntityQuotaDetails({ ...updated });
      setIsEditingQuota(false);
      showQuotaToast(
        `Target Kuota Trainer ${resolvedActiveScope.entityName} (${activeMonthLabel}) direset ke Rp 0.`
      );
      return;
    }

    const updated = resetGapMonthlyQuotaDetail(filters.BULAN, filters.TAHUN);
    setMonthlyQuotaDetails({ ...updated });
    setIsEditingQuota(false);
    showQuotaToast(`Target Kuota ${activeMonthLabel} direset ke Rp 0.`);
  };

  const handleOpenAllMonthsModal = (initialTab?: QuotaModalTab) => {
    // Load General Draft
    const genDraft: Record<string, { total: string; sellIn: string; sellOut: string }> = {};
    const allKey = getGapQuotaMonthKey('ALL', activeYearStr);
    const allCfg = monthlyQuotaDetails[allKey];
    genDraft[allKey] = {
      total: allCfg?.total ? String(allCfg.total) : '',
      sellIn: allCfg?.sellIn ? String(allCfg.sellIn) : '',
      sellOut: allCfg?.sellOut ? String(allCfg.sellOut) : '',
    };
    MONTH_OPTIONS_2026.forEach((m) => {
      const k = getGapQuotaMonthKey(m.bulanName, activeYearStr);
      const cfg = monthlyQuotaDetails[k];
      genDraft[k] = {
        total: cfg?.total ? String(cfg.total) : '',
        sellIn: cfg?.sellIn ? String(cfg.sellIn) : '',
        sellOut: cfg?.sellOut ? String(cfg.sellOut) : '',
      };
    });
    setAllMonthsDraft(genDraft);

    // Load Sales + Trainer Entity Draft
    const entDraft: Record<string, { total: string; sellIn: string; sellOut: string }> = {};
    const seedEntityList = (scopeType: 'sales' | 'trainer', names: string[]) => {
      names.forEach((name) => {
        const allEntKey = getGapEntityQuotaKey(scopeType, name, 'ALL', activeYearStr);
        const allEntCfg = entityQuotaDetails[allEntKey];
        entDraft[allEntKey] = {
          total: allEntCfg?.total ? String(allEntCfg.total) : '',
          sellIn: allEntCfg?.sellIn ? String(allEntCfg.sellIn) : '',
          sellOut: allEntCfg?.sellOut ? String(allEntCfg.sellOut) : '',
        };
        MONTH_OPTIONS_2026.forEach((m) => {
          const mk = getGapEntityQuotaKey(scopeType, name, m.bulanName, activeYearStr);
          const cfg = entityQuotaDetails[mk];
          entDraft[mk] = {
            total: cfg?.total ? String(cfg.total) : '',
            sellIn: cfg?.sellIn ? String(cfg.sellIn) : '',
            sellOut: cfg?.sellOut ? String(cfg.sellOut) : '',
          };
        });
      });
    };

    seedEntityList('sales', salesOptions);
    seedEntityList('trainer', [...GAP_TRAINER_LIST]);
    setEntityDraft(entDraft);

    // Smart initial tab & selection based on current active filters
    if (initialTab) {
      setModalTab(initialTab);
    } else if (filters.SALES && filters.SALES !== 'ALL') {
      setModalTab('sales');
      setSelectedModalSales(filters.SALES.trim().toUpperCase());
    } else if (filters.TRAINER && filters.TRAINER !== 'ALL') {
      setModalTab('trainer');
      setSelectedModalTrainer(filters.TRAINER.trim().toUpperCase());
    } else {
      setModalTab('general');
    }

    if (filters.SALES && filters.SALES !== 'ALL') {
      setSelectedModalSales(filters.SALES.trim().toUpperCase());
    }
    if (filters.TRAINER && filters.TRAINER !== 'ALL') {
      setSelectedModalTrainer(filters.TRAINER.trim().toUpperCase());
    }

    setIsAllMonthsModalOpen(true);
  };

  const handleSaveAllMonthsQuota = () => {
    let latestGeneralMap = { ...monthlyQuotaDetails };
    const applyGeneralEntry = (bulanVal: string, key: string) => {
      const entry = allMonthsDraft[key] || { total: '', sellIn: '', sellOut: '' };
      const sellInNum = Math.round(Number(entry.sellIn) || 0);
      const sellOutNum = Math.round(Number(entry.sellOut) || 0);
      const totalNum = Math.round(Number(entry.total) || 0);
      if (sellInNum > 0 || sellOutNum > 0 || totalNum > 0) {
        latestGeneralMap = setGapMonthlyQuotaDetail(
          {
            sellIn: sellInNum > 0 ? sellInNum : undefined,
            sellOut: sellOutNum > 0 ? sellOutNum : undefined,
            total: totalNum > 0 ? totalNum : undefined,
          },
          bulanVal,
          activeYearStr
        );
      } else if (monthlyQuotaDetails[key]) {
        latestGeneralMap = resetGapMonthlyQuotaDetail(bulanVal, activeYearStr);
      }
    };

    const allKey = getGapQuotaMonthKey('ALL', activeYearStr);
    applyGeneralEntry('ALL', allKey);
    MONTH_OPTIONS_2026.forEach((m) => {
      const k = getGapQuotaMonthKey(m.bulanName, activeYearStr);
      applyGeneralEntry(m.bulanName, k);
    });

    // Save all per-Sales and per-Trainer entries
    let latestEntityMap = { ...entityQuotaDetails };
    const saveEntityScope = (scopeType: 'sales' | 'trainer', names: string[]) => {
      names.forEach((name) => {
        const applyEntMonth = (bulanVal: string) => {
          const entKey = getGapEntityQuotaKey(scopeType, name, bulanVal, activeYearStr);
          const entry = entityDraft[entKey] || { total: '', sellIn: '', sellOut: '' };
          const sellInNum = Math.round(Number(entry.sellIn) || 0);
          const sellOutNum = Math.round(Number(entry.sellOut) || 0);
          const totalNum = Math.round(Number(entry.total) || 0);
          if (sellInNum > 0 || sellOutNum > 0 || totalNum > 0) {
            latestEntityMap = setGapEntityQuotaDetail(
              scopeType,
              name,
              {
                sellIn: sellInNum > 0 ? sellInNum : undefined,
                sellOut: sellOutNum > 0 ? sellOutNum : undefined,
                total: totalNum > 0 ? totalNum : undefined,
              },
              bulanVal,
              activeYearStr
            );
          } else if (entityQuotaDetails[entKey]) {
            latestEntityMap = resetGapEntityQuotaDetail(
              scopeType,
              name,
              bulanVal,
              activeYearStr
            );
          }
        };

        applyEntMonth('ALL');
        MONTH_OPTIONS_2026.forEach((m) => applyEntMonth(m.bulanName));
      });
    };

    saveEntityScope('sales', salesOptions);
    saveEntityScope('trainer', [...GAP_TRAINER_LIST]);

    setMonthlyQuotaDetails({ ...latestGeneralMap });
    setEntityQuotaDetails({ ...latestEntityMap });
    setIsAllMonthsModalOpen(false);
    showQuotaToast(
      `Semua Target Kuota Manual (Umum, Sales & Trainer Tahun ${activeYearStr}) berhasil disimpan.`
    );
  };

  // Filtered Store Gap Breakdown rows (fokus & diurutkan dari minus terbesar saat filter SELL OUT / SELL IN)
  const scopedStoreGapDetails = useMemo(() => {
    const base = isSellOutSection3
      ? storeGapDetails.filter((item) => item.sellOutCurrent - item.sellOutPrevious < 0)
      : isSellInSection3
      ? storeGapDetails.filter((item) => item.sellInCurrent - item.sellInPrevious < 0)
      : storeGapDetails;

    return [...base].sort((a, b) => {
      if (isSellOutSection3) {
        return (
          a.sellOutCurrent -
          a.sellOutPrevious -
          (b.sellOutCurrent - b.sellOutPrevious)
        );
      }
      if (isSellInSection3) {
        return (
          a.sellInCurrent -
          a.sellInPrevious -
          (b.sellInCurrent - b.sellInPrevious)
        );
      }
      return b.deficitValue - a.deficitValue;
    });
  }, [storeGapDetails, isSellOutSection3, isSellInSection3]);

  const filteredStoreGapDetails = useMemo(() => {
    const q = storeGapSearch.trim().toLowerCase();
    return scopedStoreGapDetails.filter((item) => {
      if (effectiveStoreGapFilter !== 'ALL' && item.gapCategory !== effectiveStoreGapFilter) {
        return false;
      }
      if (q) {
        const match =
          item.storeName.toLowerCase().includes(q) ||
          item.salesName.toLowerCase().includes(q) ||
          item.spvName.toLowerCase().includes(q) ||
          item.region.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [scopedStoreGapDetails, effectiveStoreGapFilter, storeGapSearch]);

  const storeGapSummary = useMemo(() => {
    const getFocusedDeficit = (s: (typeof scopedStoreGapDetails)[number]) =>
      isSellOutSection3
        ? Math.max(0, s.sellOutPrevious - s.sellOutCurrent)
        : isSellInSection3
        ? Math.max(0, s.sellInPrevious - s.sellInCurrent)
        : s.deficitValue;

    const lost = scopedStoreGapDetails.filter((s) => s.gapCategory === 'lost_outlet');
    const vol = scopedStoreGapDetails.filter((s) => s.gapCategory === 'volume_drop');
    const ret = scopedStoreGapDetails.filter((s) => s.returnValue > 0);
    return {
      allCount: scopedStoreGapDetails.length,
      lostCount: lost.length,
      lostSum: lost.reduce((acc, s) => acc + getFocusedDeficit(s), 0),
      volCount: vol.length,
      volSum: vol.reduce((acc, s) => acc + getFocusedDeficit(s), 0),
      retCount: ret.length,
      retSum: ret.reduce((acc, s) => acc + s.returnValue, 0),
    };
  }, [scopedStoreGapDetails, isSellOutSection3, isSellInSection3]);

  const { totalSellInDeficitAll, totalSellOutDeficitAll } = useMemo(() => {
    return storeGapDetails.reduce(
      (acc, item) => ({
        totalSellInDeficitAll:
          acc.totalSellInDeficitAll + Math.max(0, item.sellInPrevious - item.sellInCurrent),
        totalSellOutDeficitAll:
          acc.totalSellOutDeficitAll + Math.max(0, item.sellOutPrevious - item.sellOutCurrent),
      }),
      { totalSellInDeficitAll: 0, totalSellOutDeficitAll: 0 }
    );
  }, [storeGapDetails]);

  const filteredGapSums = useMemo(() => {
    return filteredStoreGapDetails.reduce(
      (acc, item) => {
        const sellInDef = Math.max(0, item.sellInPrevious - item.sellInCurrent);
        const sellOutDef = Math.max(0, item.sellOutPrevious - item.sellOutCurrent);
        const sellInShare =
          totalSellInDeficitAll > 0 ? (sellInDef / totalSellInDeficitAll) * 100 : 0;
        const sellOutShare =
          totalSellOutDeficitAll > 0 ? (sellOutDef / totalSellOutDeficitAll) * 100 : 0;
        return {
          sellInPrev: acc.sellInPrev + item.sellInPrevious,
          sellInCur: acc.sellInCur + item.sellInCurrent,
          sellOutPrev: acc.sellOutPrev + item.sellOutPrevious,
          sellOutCur: acc.sellOutCur + item.sellOutCurrent,
          deficit: acc.deficit + item.deficitValue,
          sellInShare: acc.sellInShare + sellInShare,
          sellOutShare: acc.sellOutShare + sellOutShare,
        };
      },
      {
        sellInPrev: 0,
        sellInCur: 0,
        sellOutPrev: 0,
        sellOutCur: 0,
        deficit: 0,
        sellInShare: 0,
        sellOutShare: 0,
      }
    );
  }, [filteredStoreGapDetails, totalSellInDeficitAll, totalSellOutDeficitAll]);

  // Helper to render period value cells depending on KET filter
  const renderValueHeaders = () => {
    if (ketFilter === 'SELL IN') {
      return (
        <>
          <th className="py-2.5 px-3 text-right bg-indigo-50/60 text-indigo-900">
            Omset Sell In Periode Lalu
          </th>
          <th className="py-2.5 px-3 text-right bg-indigo-50/60 text-indigo-900">
            Omset Sell In Sekarang
          </th>
        </>
      );
    }
    if (ketFilter === 'SELL OUT') {
      return (
        <>
          <th className="py-2.5 px-3 text-right bg-teal-50/60 text-teal-900">
            Omset Sell Out Periode Lalu
          </th>
          <th className="py-2.5 px-3 text-right bg-teal-50/60 text-teal-900">
            Omset Sell Out Sekarang
          </th>
        </>
      );
    }
    return (
      <>
        <th className="py-2.5 px-3 text-right bg-indigo-50/60 text-indigo-900">
          Omset Sell In Periode Lalu
        </th>
        <th className="py-2.5 px-3 text-right bg-indigo-50/60 text-indigo-900">
          Omset Sell In Sekarang
        </th>
        <th className="py-2.5 px-3 text-right bg-teal-50/60 text-teal-900">
          Omset Sell Out Periode Lalu
        </th>
        <th className="py-2.5 px-3 text-right bg-teal-50/60 text-teal-900">
          Omset Sell Out Sekarang
        </th>
      </>
    );
  };

  const renderValueCells = (item: DropEntityItem) => {
    const sellInPrev = item.sellInPrevious ?? 0;
    const sellInCur = item.sellInCurrent ?? 0;
    const sellOutPrev = item.sellOutPrevious ?? 0;
    const sellOutCur = item.sellOutCurrent ?? 0;

    if (ketFilter === 'SELL IN') {
      return (
        <>
          <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums bg-indigo-50/20">
            {formatRupiah(item.sellInPrevious ?? item.previousValue)}
          </td>
          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums bg-indigo-50/20">
            {formatRupiah(item.sellInCurrent ?? item.currentValue)}
          </td>
        </>
      );
    }
    if (ketFilter === 'SELL OUT') {
      return (
        <>
          <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums bg-teal-50/20">
            {formatRupiah(item.sellOutPrevious ?? item.previousValue)}
          </td>
          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums bg-teal-50/20">
            {formatRupiah(item.sellOutCurrent ?? item.currentValue)}
          </td>
        </>
      );
    }
    return (
      <>
        <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums bg-indigo-50/20">
          {formatRupiah(sellInPrev)}
        </td>
        <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-950 tabular-nums bg-indigo-50/20">
          {formatRupiah(sellInCur)}
        </td>
        <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums bg-teal-50/20">
          {formatRupiah(sellOutPrev)}
        </td>
        <td className="py-3 px-3 text-right font-mono font-semibold text-teal-950 tabular-nums bg-teal-50/20">
          {formatRupiah(sellOutCur)}
        </td>
      </>
    );
  };

  return (
    <div className="space-y-6 mb-8">
      {/* 1. Header Banner & Gap Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Analisa Gap &amp; Diagnosa Penyebab Penjualan Turun
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis komparatif {currentPeriodName} vs {previousPeriodName} (sinkron otomatis dengan Filter Terintegrasi)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAllMonthsModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Atur Kuota Manual (Umum, Sales &amp; Trainer)</span>
            </button>
            <span className="text-xs font-mono px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-bold tabular-nums">
              Defisit Gap: {totalTarget > 0 ? formatRupiah(gapDeficit) : 'Rp 0'} (
              {formatPercent(gapPercentage, false)})
            </span>
          </div>
        </div>

        {/* Inline feedback toast */}
        {quotaFeedback && (
          <div className="mt-3 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{quotaFeedback}</span>
          </div>
        )}

        {/* Active Integrated Filter Pills + Quick Sales & Trainer Filter Selector */}
        <div className="mt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" />
              Filter Terintegrasi:
            </span>
            {activeFilterBadges.map((chip) => (
              <span
                key={chip}
                className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200"
              >
                {chip}
              </span>
            ))}
          </div>

          {onFilterChange && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Sales Cepat */}
              <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200 rounded-lg px-2 py-1">
                <span className="text-[10px] font-extrabold text-indigo-900 uppercase">
                  Sales:
                </span>
                <select
                  value={filters.SALES}
                  onChange={(e) => onFilterChange('SALES', e.target.value)}
                  className="text-xs font-bold text-indigo-950 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Sales</option>
                  {salesOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Trainer Cepat */}
              <div className="flex items-center gap-1 bg-cyan-50/70 border border-cyan-200 rounded-lg p-1">
                <span className="text-[10px] font-extrabold text-cyan-900 uppercase px-1.5">
                  Trainer:
                </span>
                <button
                  type="button"
                  onClick={() => onFilterChange('TRAINER', 'ALL')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                    !filters.TRAINER || filters.TRAINER === 'ALL'
                      ? 'bg-cyan-700 text-white shadow-2xs'
                      : 'text-cyan-900 hover:bg-cyan-100'
                  }`}
                >
                  Semua
                </button>
                {GAP_TRAINER_LIST.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onFilterChange('TRAINER', t)}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                      (filters.TRAINER || '').toUpperCase() === t
                        ? 'bg-cyan-700 text-white shadow-2xs'
                        : 'text-cyan-900 hover:bg-cyan-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter Periode Tanggal (Rentang Tgl per Bulan Pembanding) */}
        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-800">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Filter Periode Tanggal:
            </span>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-500">Dari Tgl</span>
              <select
                value={dateStartDay}
                onChange={(e) => handleStartDayChange(Number(e.target.value))}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-bold text-slate-400">s/d</span>
              <select
                value={dateEndDay}
                onChange={(e) => handleEndDayChange(Number(e.target.value))}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: 'Semua (1–31)', start: 1, end: 31 },
                { label: 'Tgl 1–15', start: 1, end: 15 },
                { label: 'Tgl 1–30', start: 1, end: 30 },
                { label: 'Tgl 16–31', start: 16, end: 31 },
              ].map((preset) => {
                const isActive =
                  dateStartDay === preset.start && dateEndDay === preset.end;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyDatePreset(preset.start, preset.end)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">
              Komparasi: <strong className="text-slate-900">{previousPeriodName}</strong> →{' '}
              <strong className="text-indigo-700">{currentPeriodName}</strong>
            </span>
            {isDateRangeActive && (
              <button
                type="button"
                onClick={() => applyDatePreset(1, 31)}
                className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 cursor-pointer"
              >
                Reset Tgl
              </button>
            )}
          </div>
        </div>

        {/* 4 Key Gap Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Card 1: 100% EDIT MANUAL TARGET KUOTA PENJUALAN (UMUM / SALES / TRAINER) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-white via-indigo-50/70 to-blue-50/40 border border-indigo-200 border-t-4 border-t-indigo-600 shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                Target Kuota Penjualan
              </span>
              {!isEditingQuota && (
                <button
                  type="button"
                  onClick={handleStartEditQuota}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xs cursor-pointer"
                  title={`Edit Manual Target (${activeQuotaScopeLabel}) untuk ${activeMonthLabel}`}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Manual</span>
                </button>
              )}
            </div>

            <div className="mt-1">
              <span
                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                  activeQuotaScopeType === 'sales'
                    ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                    : activeQuotaScopeType === 'trainer'
                    ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Aktif: {activeQuotaScopeLabel}
              </span>
            </div>

            {isEditingQuota ? (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">
                    Target Sell In (Rp)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0 (Manual)"
                    value={quotaSellInInput}
                    onChange={(e) => setQuotaSellInInput(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold text-indigo-950 rounded-lg border border-indigo-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-teal-900 mb-0.5">
                    Target Sell Out (Rp)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0 (Manual)"
                    value={quotaSellOutInput}
                    onChange={(e) => setQuotaSellOutInput(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold text-teal-950 rounded-lg border border-teal-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Target Total / Gabungan (Opsional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    placeholder={
                      (Number(quotaSellInInput) || 0) + (Number(quotaSellOutInput) || 0) > 0
                        ? `Sum: ${formatRupiah(
                            (Number(quotaSellInInput) || 0) + (Number(quotaSellOutInput) || 0),
                            true
                          )}`
                        : '0 (Manual)'
                    }
                    value={quotaTotalInput}
                    onChange={(e) => setQuotaTotalInput(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={handleSaveQuota}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Simpan</span>
                  </button>
                  {(isCustomTarget || isCustomSellInTarget || isCustomSellOutTarget) && (
                    <button
                      type="button"
                      onClick={handleResetQuota}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                      title="Kosongkan kembali ke Rp 0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rp 0</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingQuota(false)}
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-black text-indigo-950 font-mono tabular-nums mt-1">
                  {formatRupiah(totalTarget)}
                </div>
                <div className="flex items-center justify-between gap-1 mt-1.5">
                  <span className="text-[11px] text-indigo-800 font-semibold truncate">
                    {activeMonthLabel}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      isCustomTarget
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {isCustomTarget ? 'Manual Terisi' : 'Belum Diatur'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-white via-teal-50/70 to-emerald-50/40 border border-teal-200 border-t-4 border-t-teal-600 shadow-sm hover:-translate-y-0.5 transition-all">
            <span className="text-[11px] font-bold text-teal-900 block uppercase tracking-wider">
              Realisasi Penjualan Aktual
            </span>
            <div className="text-2xl font-black text-teal-950 font-mono tabular-nums mt-0.5">
              {formatRupiah(actualRevenue)}
            </div>
            <span className="text-xs text-teal-800 font-semibold mt-1 block">
              {totalTarget > 0
                ? `Pencapaian: ${formatPercent((actualRevenue / totalTarget) * 100, false)}`
                : 'Target manual belum diisi'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-white via-rose-50 to-red-100/60 border border-rose-300 border-t-4 border-t-rose-600 shadow-sm hover:-translate-y-0.5 transition-all">
            <span className="text-[11px] font-bold text-rose-900 block uppercase tracking-wider">
              Total Gap / Defisit Target
            </span>
            <div className="text-2xl font-black text-rose-700 font-mono tabular-nums mt-0.5">
              {totalTarget <= 0
                ? 'Rp 0 (Manual)'
                : gapDeficit > 0
                ? `- ${formatRupiah(gapDeficit)}`
                : 'Rp 0 (Tercapai)'}
            </div>
            <span className="text-xs text-rose-800 font-bold mt-1 block">
              {totalTarget <= 0
                ? 'Klik Edit Manual untuk isi target kuota'
                : gapDeficit > 0
                ? 'Kekurangan omzet terhadap target manual'
                : 'Target kuota manual telah terpenuhi'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-white via-amber-50 to-orange-100/50 border border-amber-300 border-t-4 border-t-amber-500 shadow-sm hover:-translate-y-0.5 transition-all">
            <span className="text-[11px] font-bold text-amber-900 block uppercase tracking-wider">
              Perubahan vs Periode Lalu
            </span>
            <div
              className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
                deltaVsPrevious >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {deltaVsPrevious >= 0 ? '+ ' : ''}
              {formatRupiah(deltaVsPrevious)}
            </div>
            <span className="text-xs text-amber-900 font-medium mt-1 block">
              Baseline ({previousPeriodName}): {formatRupiah(previousRevenue)}
            </span>
          </div>
        </div>

        {/* Breakdown Kuota & Realisasi Sell In vs Sell Out Bulan Aktif */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">
                  Target Kuota SELL IN ({activeQuotaScopeLabel})
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isCustomSellInTarget
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isCustomSellInTarget ? 'Manual Terisi' : 'Belum Diatur'}
                </span>
              </div>
              <div className="text-base font-black font-mono text-indigo-950 mt-0.5 tabular-nums">
                {formatRupiah(sellInTarget)}
              </div>
              <div className="text-[11px] text-indigo-800 font-medium">
                Realisasi: <strong className="font-mono">{formatRupiah(sellInActual)}</strong>{' '}
                {sellInTarget > 0
                  ? `(${((sellInActual / sellInTarget) * 100).toFixed(1)}%)`
                  : '(Target Sell In masih Rp 0)'}
              </div>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Gap Sell In
              </span>
              <span
                className={`text-sm font-black font-mono tabular-nums ${
                  sellInTarget <= 0
                    ? 'text-slate-400'
                    : sellInGapDeficit > 0
                    ? 'text-rose-600'
                    : 'text-emerald-700'
                }`}
              >
                {sellInTarget <= 0
                  ? 'Rp 0'
                  : sellInGapDeficit > 0
                  ? `- ${formatRupiah(sellInGapDeficit)}`
                  : 'Tercapai'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-900">
                  Target Kuota SELL OUT ({activeQuotaScopeLabel})
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isCustomSellOutTarget
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isCustomSellOutTarget ? 'Manual Terisi' : 'Belum Diatur'}
                </span>
              </div>
              <div className="text-base font-black font-mono text-teal-950 mt-0.5 tabular-nums">
                {formatRupiah(sellOutTarget)}
              </div>
              <div className="text-[11px] text-teal-800 font-medium">
                Realisasi: <strong className="font-mono">{formatRupiah(sellOutActual)}</strong>{' '}
                {sellOutTarget > 0
                  ? `(${((sellOutActual / sellOutTarget) * 100).toFixed(1)}%)`
                  : '(Target Sell Out masih Rp 0)'}
              </div>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Gap Sell Out
              </span>
              <span
                className={`text-sm font-black font-mono tabular-nums ${
                  sellOutTarget <= 0
                    ? 'text-slate-400'
                    : sellOutGapDeficit > 0
                    ? 'text-rose-600'
                    : 'text-emerald-700'
                }`}
              >
                {sellOutTarget <= 0
                  ? 'Rp 0'
                  : sellOutGapDeficit > 0
                  ? `- ${formatRupiah(sellOutGapDeficit)}`
                  : 'Tercapai'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Root Cause Attribution (5 Faktor Utama + Rincian Toko per Faktor) */}
      {(() => {
        const activeKetMode = (filters.KET || 'ALL').trim().toUpperCase();
        const isSellInMode = activeKetMode === 'SELL IN';
        const isSellOutMode = activeKetMode === 'SELL OUT';
        return (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6">
            <div className="pb-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    5 Faktor Utama Penyebab Penurunan Penjualan &amp; Rekomendasi Solusi
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                      isSellInMode
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : isSellOutMode
                        ? 'bg-teal-50 text-teal-800 border-teal-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isSellInMode
                      ? 'SELL IN · Barang Masuk / Orderan Masuk'
                      : isSellOutMode
                      ? 'SELL OUT · Penjualan / Barang Keluar'
                      : 'SEMUA · Gabungan Sell In & Sell Out'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {isSellInMode
                    ? 'Analisa difokuskan pada Barang Masuk / Orderan Masuk (PO toko, nota masuk, Hero SKU orderan masuk, dan retur pengiriman) bagi SPV & Sales.'
                    : isSellOutMode
                    ? 'Analisa difokuskan pada Penjualan / Barang Keluar ke konsumen (serapan gerai, aktivitas BA, display Hero SKU, dan retur konsumen) bagi Trainer, SPV & Sales.'
                    : 'Rincian bobot dampak penurunan beserta tindakan perbaikan taktis bagi SPV, Sales & Trainer (tersinkron ke Filter Terintegrasi).'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onFilterChange && (
                  <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    {(
                      [
                        { value: 'ALL', label: 'Semua' },
                        { value: 'SELL IN', label: 'SELL IN (Barang Masuk)' },
                        { value: 'SELL OUT', label: 'SELL OUT (Barang Keluar)' },
                      ] as const
                    ).map((opt) => {
                      const active = activeKetMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onFilterChange('KET', opt.value)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            active
                              ? opt.value === 'SELL IN'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : opt.value === 'SELL OUT'
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'bg-slate-800 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <select
                    value={dateStartDay}
                    onChange={(e) => handleStartDayChange(Number(e.target.value))}
                    aria-label="Dari Tanggal"
                    className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Tgl {d}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400">–</span>
                  <select
                    value={dateEndDay}
                    onChange={(e) => handleEndDayChange(Number(e.target.value))}
                    aria-label="Sampai Tanggal"
                    className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Tgl {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                  Periode: <strong>{previousPeriodName}</strong> → <strong>{currentPeriodName}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {primaryDrivers.map((driver, idx) => {
                const storesList = driver.affectedStores || [];
                const isExpanded = Boolean(expandedDrivers[idx]);
                return (
                  <div
                    key={driver.factor}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-800 leading-snug">
                          {idx + 1}. {driver.factor}
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 shrink-0 tabular-nums">
                          {driver.percentageOfGap}% Gap
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 my-1.5">
                        <span className="text-sm font-mono font-extrabold text-rose-700 tabular-nums">
                          {driver.impactValue > 0 ? `- ${formatRupiah(driver.impactValue)}` : 'Rp 0'}
                        </span>
                        {(isSellInMode || isSellOutMode) && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              isSellInMode
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-teal-50 text-teal-700'
                            }`}
                          >
                            {isSellInMode ? 'Orderan Masuk' : 'Barang Keluar'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mt-1">
                        {driver.description}
                      </p>

                  {/* Toko Penyumbang Ringkas & Expandable */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Store className="w-3 h-3 text-indigo-600" />
                        <span>Asal Toko ({storesList.length} Toko)</span>
                      </span>
                      {storesList.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDrivers((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Tutup' : 'Lihat Semua'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {storesList.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic block">
                        Tidak ada toko penyumbang pada filter ini.
                      </span>
                    ) : !isExpanded ? (
                      <div className="flex flex-wrap gap-1">
                        {storesList.slice(0, 3).map((st) => (
                          <span
                            key={st.storeName}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-700 max-w-full"
                            title={`${st.storeName} (${st.salesName})`}
                          >
                            <span className="font-bold truncate max-w-[125px]">{st.storeName}</span>
                            <span className="font-mono text-rose-600 font-semibold shrink-0">
                              -{formatRupiah(st.impactValue, true)}
                            </span>
                          </span>
                        ))}
                        {storesList.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50 rounded-md border border-indigo-200">
                            +{storesList.length - 3} toko lainnya
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                        {storesList.map((st) => (
                          <div
                            key={st.storeName}
                            className="px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate">{st.storeName}</div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {st.region} · Sales: {st.salesName} (SPV: {st.spv})
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <div className="font-bold text-rose-600">
                                -{formatRupiah(st.impactValue, true)}
                              </div>
                              <div className="text-[9px] text-slate-400">
                                {st.sharePercent.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action plan box */}
                <div className="mt-4 pt-3 border-t border-slate-200/70 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1 mb-1">
                    <Compass className="w-3.5 h-3.5 text-emerald-700" />
                    Rencana Tindakan (Action Plan):
                  </span>
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                    {driver.actionPlan}
                  </p>
                </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 3. RINCIAN DATA GAP DARI TOKO MANA SAJA (TERINTEGRASI FILTER TIPE SELL OUT / SELL IN) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Rincian Sumber Data Gap Penjualan per Toko
              </h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                  isSellOutSection3
                    ? 'bg-teal-50 text-teal-800 border-teal-300'
                    : isSellInSection3
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isSellOutSection3
                  ? 'Fokus: SELL OUT · Gap Out Minus Terbesar (Google Sheet)'
                  : isSellInSection3
                  ? 'Fokus: SELL IN · Gap In Minus Terbesar (Google Sheet)'
                  : 'Semua Tipe: Sell In & Sell Out (Google Sheet)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {isSellOutSection3
                ? `Menampilkan toko dengan Gap Out minus mulai dari paling tinggi minusnya sesuai Google Sheet terhubung (${storeGapPreviousPeriodName} vs ${storeGapCurrentPeriodName})`
                : isSellInSection3
                ? `Menampilkan toko dengan Gap In minus mulai dari paling tinggi minusnya sesuai Google Sheet terhubung (${storeGapPreviousPeriodName} vs ${storeGapCurrentPeriodName})`
                : `Daftar asal toko penyumbang defisit omzet sesuai Filter Terintegrasi & Google Sheet terhubung (${storeGapPreviousPeriodName} vs ${storeGapCurrentPeriodName})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Synced Tipe Toggle (Terhubung dengan Filter Terintegrasi) */}
            {onFilterChange && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {(
                  [
                    { value: 'ALL', label: 'Semua' },
                    { value: 'SELL IN', label: 'Sell In' },
                    { value: 'SELL OUT', label: 'Sell Out' },
                  ] as const
                ).map((opt) => {
                  const isActive = activeStoreKet === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onFilterChange('KET', opt.value)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                        isActive
                          ? opt.value === 'SELL OUT'
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : opt.value === 'SELL IN'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Compact Periode Tanggal Filter */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={dateStartDay}
                onChange={(e) => handleStartDayChange(Number(e.target.value))}
                aria-label="Dari Tanggal Toko"
                className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tgl {d}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400">–</span>
              <select
                value={dateEndDay}
                onChange={(e) => handleEndDayChange(Number(e.target.value))}
                aria-label="Sampai Tanggal Toko"
                className="text-[11px] font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tgl {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama toko, sales, SPV..."
                value={storeGapSearch}
                onChange={(e) => setStoreGapSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setStoreGapFilter('ALL')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                  effectiveStoreGapFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({storeGapSummary.allCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreGapFilter('lost_outlet')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                  effectiveStoreGapFilter === 'lost_outlet'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                Toko Pasif ({storeGapSummary.lostCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreGapFilter('volume_drop')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                  effectiveStoreGapFilter === 'volume_drop'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                Turun Order ({storeGapSummary.volCount})
              </button>
              {!isSellOutSection3 && !isSellInSection3 && (
                <button
                  type="button"
                  onClick={() => setStoreGapFilter('return_impact')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                    effectiveStoreGapFilter === 'return_impact'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-purple-700'
                  }`}
                >
                  Retur ({storeGapSummary.retCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mini KPI Strip for Store Gap Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-900 block">
                {isSellOutSection3
                  ? 'Toko Nihil Sell Out (0)'
                  : isSellInSection3
                  ? 'Toko Nihil Sell In (0 PO)'
                  : 'Toko Pasif (0 Order)'}
              </span>
              <span className="text-xs text-rose-700 font-semibold">
                {storeGapSummary.lostCount} Toko terdampak
              </span>
            </div>
            <span className="text-sm font-black font-mono text-rose-700 tabular-nums">
              -{formatRupiah(storeGapSummary.lostSum)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-900 block">
                {isSellOutSection3
                  ? 'Penurunan Sell Out Eksisting'
                  : isSellInSection3
                  ? 'Penurunan Sell In Eksisting'
                  : 'Penurunan Order Eksisting'}
              </span>
              <span className="text-xs text-amber-700 font-semibold">
                {storeGapSummary.volCount} Toko menyusut
              </span>
            </div>
            <span className="text-sm font-black font-mono text-amber-800 tabular-nums">
              -{formatRupiah(storeGapSummary.volSum)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-300 block">
                {isSellOutSection3
                  ? 'Total Defisit Gap Out Toko'
                  : isSellInSection3
                  ? 'Total Defisit Gap In Toko'
                  : 'Total Defisit Gabungan Toko'}
              </span>
              <span className="text-xs text-slate-400">
                Dari {storeGapSummary.allCount} toko penyumbang gap
              </span>
            </div>
            <span
              className={`text-sm font-black font-mono tabular-nums ${
                isSellOutSection3
                  ? 'text-teal-300'
                  : isSellInSection3
                  ? 'text-indigo-300'
                  : 'text-rose-300'
              }`}
            >
              -
              {formatRupiah(
                isSellOutSection3
                  ? totalSellOutDeficitAll
                  : isSellInSection3
                  ? totalSellInDeficitAll
                  : totalStoreGapDeficit
              )}
            </span>
          </div>
        </div>

        {/* Store Gap Table */}
        <div className="overflow-x-auto mt-4 border border-slate-200 rounded-xl max-h-[460px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 w-10">No</th>
                <th className="py-2.5 px-3 min-w-[160px]">Nama Toko</th>
                <th className="py-2.5 px-3 min-w-[140px]">Sales &amp; SPV</th>
                <th className="py-2.5 px-3 min-w-[240px]">
                  {isSellOutSection3
                    ? 'Kategori Penyebab Gap Out'
                    : isSellInSection3
                    ? 'Kategori Penyebab Gap In'
                    : 'Kategori Penyebab'}
                </th>
                {isSellOutSection3 ? (
                  <>
                    <th className="py-2.5 px-3 text-right bg-teal-50/50 text-teal-900 whitespace-nowrap">
                      Sell Out (Lalu → Skg)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-rose-50/60 text-rose-900 whitespace-nowrap">
                      Gap Out (Minus ↓)
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Growth (%)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-teal-50/40 text-teal-900 whitespace-nowrap">
                      Porsi Gap Out
                    </th>
                  </>
                ) : isSellInSection3 ? (
                  <>
                    <th className="py-2.5 px-3 text-right bg-indigo-50/50 text-indigo-900 whitespace-nowrap">
                      Sell In (Lalu → Skg)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-rose-50/60 text-rose-900 whitespace-nowrap">
                      Gap In (Minus ↓)
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Growth (%)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-indigo-900 whitespace-nowrap">
                      Porsi Gap In
                    </th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-right bg-indigo-50/50 text-indigo-900 whitespace-nowrap">
                      Sell In (Lalu → Skg)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-teal-50/50 text-teal-900 whitespace-nowrap">
                      Sell Out (Lalu → Skg)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-indigo-50/60 text-indigo-900 whitespace-nowrap">
                      Nominal Gap Sell In (Rp)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-teal-50/60 text-teal-900 whitespace-nowrap">
                      Nominal Gap Sell Out (Rp)
                    </th>
                    <th className="py-2.5 px-3 text-right bg-indigo-50/40 text-indigo-900 whitespace-nowrap">
                      Porsi Gap Sell In
                    </th>
                    <th className="py-2.5 px-3 text-right bg-teal-50/40 text-teal-900 whitespace-nowrap">
                      Porsi Gap Sell Out
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStoreGapDetails.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSellOutSection3 || isSellInSection3 ? 8 : 10}
                    className="py-8 text-center text-slate-400"
                  >
                    {isSellOutSection3
                      ? 'Tidak ada toko dengan Gap Out minus pada filter saat ini.'
                      : isSellInSection3
                      ? 'Tidak ada toko dengan Gap In minus pada filter saat ini.'
                      : 'Tidak ada toko penyumbang gap yang cocok dengan filter saat ini.'}
                  </td>
                </tr>
              ) : (
                filteredStoreGapDetails.map((st, idx) => {
                  const sellInGap = st.sellInCurrent - st.sellInPrevious;
                  const sellOutGap = st.sellOutCurrent - st.sellOutPrevious;
                  const sellInDeficit = Math.max(0, st.sellInPrevious - st.sellInCurrent);
                  const sellOutDeficit = Math.max(0, st.sellOutPrevious - st.sellOutCurrent);
                  const porsiGapSellIn =
                    totalSellInDeficitAll > 0 ? (sellInDeficit / totalSellInDeficitAll) * 100 : 0;
                  const porsiGapSellOut =
                    totalSellOutDeficitAll > 0 ? (sellOutDeficit / totalSellOutDeficitAll) * 100 : 0;
                  const sellInGrowth =
                    st.sellInPrevious > 0
                      ? (sellInGap / st.sellInPrevious) * 100
                      : st.sellInCurrent > 0
                      ? 100
                      : 0;
                  const sellOutGrowth =
                    st.sellOutPrevious > 0
                      ? (sellOutGap / st.sellOutPrevious) * 100
                      : st.sellOutCurrent > 0
                      ? 100
                      : 0;
                  return (
                    <tr key={st.storeName} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900">{st.storeName}</div>
                        <div className="text-[10px] text-slate-500">{st.region}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{st.salesName}</div>
                        <div className="text-[10px] text-slate-500">SPV: {st.spvName}</div>
                      </td>
                      <td className="py-2.5 px-3 min-w-[240px]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            st.gapCategory === 'lost_outlet'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : st.gapCategory === 'return_impact'
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {st.gapCategory === 'lost_outlet'
                            ? isSellOutSection3
                              ? 'Nihil Sell Out (0)'
                              : isSellInSection3
                              ? 'Nihil Sell In (0 PO)'
                              : 'Toko Pasif (0 Order)'
                            : st.gapCategory === 'return_impact'
                            ? 'Dampak Retur'
                            : isSellOutSection3
                            ? 'Turun Sell Out'
                            : isSellInSection3
                            ? 'Turun Sell In'
                            : 'Turun Order'}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-1 whitespace-normal break-words leading-snug">
                          {st.primaryReason}
                        </div>
                      </td>
                      {isSellOutSection3 ? (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-teal-50/20 whitespace-nowrap">
                            <div className="text-[10px] text-slate-500">
                              {formatRupiah(st.sellOutPrevious, true)}
                            </div>
                            <div className="font-bold text-teal-950">
                              → {formatRupiah(st.sellOutCurrent, true)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-rose-50/25 text-rose-600 whitespace-nowrap">
                            -{formatRupiah(Math.abs(sellOutGap))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {formatPercent(sellOutGrowth)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-teal-50/15 whitespace-nowrap">
                            <div
                              className={`font-bold ${
                                porsiGapSellOut > 0 ? 'text-teal-900' : 'text-slate-400'
                              }`}
                            >
                              {porsiGapSellOut.toFixed(1)}%
                            </div>
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full ml-auto mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500"
                                style={{ width: `${Math.min(100, porsiGapSellOut)}%` }}
                              />
                            </div>
                          </td>
                        </>
                      ) : isSellInSection3 ? (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-indigo-50/20 whitespace-nowrap">
                            <div className="text-[10px] text-slate-500">
                              {formatRupiah(st.sellInPrevious, true)}
                            </div>
                            <div className="font-bold text-indigo-950">
                              → {formatRupiah(st.sellInCurrent, true)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-rose-50/25 text-rose-600 whitespace-nowrap">
                            -{formatRupiah(Math.abs(sellInGap))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {formatPercent(sellInGrowth)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-indigo-50/15 whitespace-nowrap">
                            <div
                              className={`font-bold ${
                                porsiGapSellIn > 0 ? 'text-indigo-900' : 'text-slate-400'
                              }`}
                            >
                              {porsiGapSellIn.toFixed(1)}%
                            </div>
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full ml-auto mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${Math.min(100, porsiGapSellIn)}%` }}
                              />
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-indigo-50/20 whitespace-nowrap">
                            <div className="text-[10px] text-slate-500">
                              {formatRupiah(st.sellInPrevious, true)}
                            </div>
                            <div className="font-bold text-indigo-950">
                              → {formatRupiah(st.sellInCurrent, true)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-teal-50/20 whitespace-nowrap">
                            <div className="text-[10px] text-slate-500">
                              {formatRupiah(st.sellOutPrevious, true)}
                            </div>
                            <div className="font-bold text-teal-950">
                              → {formatRupiah(st.sellOutCurrent, true)}
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-indigo-50/25 whitespace-nowrap ${
                              sellInGap < 0
                                ? 'text-rose-600'
                                : sellInGap > 0
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {sellInGap < 0
                              ? `-${formatRupiah(Math.abs(sellInGap))}`
                              : sellInGap > 0
                              ? `+${formatRupiah(sellInGap)}`
                              : 'Rp 0'}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-teal-50/25 whitespace-nowrap ${
                              sellOutGap < 0
                                ? 'text-rose-600'
                                : sellOutGap > 0
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {sellOutGap < 0
                              ? `-${formatRupiah(Math.abs(sellOutGap))}`
                              : sellOutGap > 0
                              ? `+${formatRupiah(sellOutGap)}`
                              : 'Rp 0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-indigo-50/15 whitespace-nowrap">
                            <div
                              className={`font-bold ${
                                porsiGapSellIn > 0 ? 'text-indigo-900' : 'text-slate-400'
                              }`}
                            >
                              {porsiGapSellIn.toFixed(1)}%
                            </div>
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full ml-auto mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${Math.min(100, porsiGapSellIn)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-teal-50/15 whitespace-nowrap">
                            <div
                              className={`font-bold ${
                                porsiGapSellOut > 0 ? 'text-teal-900' : 'text-slate-400'
                              }`}
                            >
                              {porsiGapSellOut.toFixed(1)}%
                            </div>
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full ml-auto mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500"
                                style={{ width: `${Math.min(100, porsiGapSellOut)}%` }}
                              />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredStoreGapDetails.length > 0 && (() => {
              const totalSellInGap = filteredGapSums.sellInCur - filteredGapSums.sellInPrev;
              const totalSellOutGap = filteredGapSums.sellOutCur - filteredGapSums.sellOutPrev;
              const totalSellInGrowth =
                filteredGapSums.sellInPrev > 0
                  ? (totalSellInGap / filteredGapSums.sellInPrev) * 100
                  : 0;
              const totalSellOutGrowth =
                filteredGapSums.sellOutPrev > 0
                  ? (totalSellOutGap / filteredGapSums.sellOutPrev) * 100
                  : 0;
              return (
                <tfoot className="sticky bottom-0 bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[11px]">
                      Total ({filteredStoreGapDetails.length} Toko Ditampilkan)
                    </td>
                    {isSellOutSection3 ? (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[11px] whitespace-nowrap">
                          {formatRupiah(filteredGapSums.sellOutPrev, true)} →{' '}
                          {formatRupiah(filteredGapSums.sellOutCur, true)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                          {totalSellOutGap < 0
                            ? `-${formatRupiah(Math.abs(totalSellOutGap))}`
                            : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                          {formatPercent(totalSellOutGrowth)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-teal-900 tabular-nums whitespace-nowrap">
                          {filteredGapSums.sellOutShare.toFixed(1)}%
                        </td>
                      </>
                    ) : isSellInSection3 ? (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[11px] whitespace-nowrap">
                          {formatRupiah(filteredGapSums.sellInPrev, true)} →{' '}
                          {formatRupiah(filteredGapSums.sellInCur, true)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                          {totalSellInGap < 0
                            ? `-${formatRupiah(Math.abs(totalSellInGap))}`
                            : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                          {formatPercent(totalSellInGrowth)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-900 tabular-nums whitespace-nowrap">
                          {filteredGapSums.sellInShare.toFixed(1)}%
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[11px] whitespace-nowrap">
                          {formatRupiah(filteredGapSums.sellInPrev, true)} →{' '}
                          {formatRupiah(filteredGapSums.sellInCur, true)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[11px] whitespace-nowrap">
                          {formatRupiah(filteredGapSums.sellOutPrev, true)} →{' '}
                          {formatRupiah(filteredGapSums.sellOutCur, true)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                            totalSellInGap < 0
                              ? 'text-rose-700'
                              : totalSellInGap > 0
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {totalSellInGap < 0
                            ? `-${formatRupiah(Math.abs(totalSellInGap))}`
                            : totalSellInGap > 0
                            ? `+${formatRupiah(totalSellInGap)}`
                            : 'Rp 0'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                            totalSellOutGap < 0
                              ? 'text-rose-700'
                              : totalSellOutGap > 0
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {totalSellOutGap < 0
                            ? `-${formatRupiah(Math.abs(totalSellOutGap))}`
                            : totalSellOutGap > 0
                            ? `+${formatRupiah(totalSellOutGap)}`
                            : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-900 tabular-nums whitespace-nowrap">
                          {filteredGapSums.sellInShare.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-teal-900 tabular-nums whitespace-nowrap">
                          {filteredGapSums.sellOutShare.toFixed(1)}%
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      </div>

      {/* 4. Deep-Dive Tables: Stores, SKUs, Brands & Sales yang Drop */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pemeriksaan Detail Entitas yang Mengalami Penurunan
            </h3>
            <p className="text-xs text-slate-500">
              Fokuskan penanganan pada entitas dengan defisit nominal terbesar ({entityDiagnosis.previousPeriodName} vs {entityDiagnosis.currentPeriodName})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Compact Periode Tanggal Filter */}
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold text-slate-500">Periode:</span>
              <select
                value={dateStartDay}
                onChange={(e) => handleStartDayChange(Number(e.target.value))}
                aria-label="Dari Tanggal Entitas"
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tgl {d}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">s/d</span>
              <select
                value={dateEndDay}
                onChange={(e) => handleEndDayChange(Number(e.target.value))}
                aria-label="Sampai Tanggal Entitas"
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Tgl {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter KET: Semua / SELL IN / SELL OUT */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <span className="flex items-center gap-1 px-2 text-[11px] font-bold text-slate-500">
                <Filter className="w-3 h-3" />
                <span>KET:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setKetFilter('ALL');
                  onFilterChange?.('KET', 'ALL');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  ketFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua (Sell In &amp; Out)
              </button>
              <button
                type="button"
                onClick={() => {
                  setKetFilter('SELL IN');
                  onFilterChange?.('KET', 'SELL IN');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  ketFilter === 'SELL IN'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                Sell In
              </button>
              <button
                type="button"
                onClick={() => {
                  setKetFilter('SELL OUT');
                  onFilterChange?.('KET', 'SELL OUT');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  ketFilter === 'SELL OUT'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
              >
                Sell Out
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSubTab('stores')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  subTab === 'stores'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                Toko Drop ({topDroppingStores.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('skus')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  subTab === 'skus'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                SKU Drop ({topDroppingSkus.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('brands')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  subTab === 'brands'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Brand Drop ({topDroppingBrands.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('sales')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  subTab === 'sales'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Sales Drop ({topDroppingSales.length})
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Status Info */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
          <span>
            Mode Data Aktif:{' '}
            <strong
              className={
                ketFilter === 'SELL IN'
                  ? 'text-indigo-700'
                  : ketFilter === 'SELL OUT'
                  ? 'text-teal-700'
                  : 'text-slate-900'
              }
            >
              {ketFilter === 'ALL'
                ? 'Semua Transaksi (Omset Sell In & Omset Sell Out)'
                : ketFilter === 'SELL IN'
                ? 'Khusus Transaksi SELL IN'
                : 'Khusus Transaksi SELL OUT'}
            </strong>
          </span>
          <span className="font-mono">
            Periode Lalu: <strong>{entityDiagnosis.previousPeriodName}</strong> vs Periode Sekarang:{' '}
            <strong>{entityDiagnosis.currentPeriodName}</strong>
          </span>
        </div>

        {/* SUBTAB 1: STORES */}
        {subTab === 'stores' && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-2.5 px-3">Nama Store</th>
                  <th className="py-2.5 px-3">Wilayah &amp; PIC Sales</th>
                  {renderValueHeaders()}
                  <th className="py-2.5 px-3 text-right">
                    {ketFilter === 'SELL OUT'
                      ? 'Gap Out (Rp)'
                      : ketFilter === 'SELL IN'
                      ? 'Gap In (Rp)'
                      : 'Penurunan (Rp)'}
                  </th>
                  <th className="py-2.5 px-3 text-right">Growth (%)</th>
                  <th className="py-2.5 px-3">Diagnosa Utama Penyebab Turun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDroppingStores.length === 0 ? (
                  <tr>
                    <td
                      colSpan={ketFilter === 'ALL' ? 9 : 7}
                      className="py-8 text-center text-slate-400"
                    >
                      Tidak ada toko yang mengalami penurunan pada filter KET ({ketFilter}) saat ini.
                    </td>
                  </tr>
                ) : (
                  topDroppingStores.map((st) => (
                    <tr key={st.name} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {st.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {st.regionOrSales}
                      </td>
                      {renderValueCells(st)}
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 tabular-nums">
                        - {formatRupiah(st.deficitValue)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                          {formatPercent(st.growthPercent)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            st.currentValue === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {st.primaryReason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 2: SKUS */}
        {subTab === 'skus' && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-2.5 px-3">Nama SKU / Produk</th>
                  <th className="py-2.5 px-3">Brand</th>
                  {renderValueHeaders()}
                  <th className="py-2.5 px-3 text-right">
                    {ketFilter === 'SELL OUT'
                      ? 'Gap Out (Rp)'
                      : ketFilter === 'SELL IN'
                      ? 'Gap In (Rp)'
                      : 'Penurunan (Rp)'}
                  </th>
                  <th className="py-2.5 px-3 text-right">Growth (%)</th>
                  <th className="py-2.5 px-3">Diagnosa Masalah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDroppingSkus.length === 0 ? (
                  <tr>
                    <td
                      colSpan={ketFilter === 'ALL' ? 9 : 7}
                      className="py-8 text-center text-slate-400"
                    >
                      Tidak ada SKU yang mengalami penurunan pada filter KET ({ketFilter}) saat ini.
                    </td>
                  </tr>
                ) : (
                  topDroppingSkus.map((sku) => (
                    <tr key={sku.name} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800 max-w-sm truncate" title={sku.name}>
                        {sku.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {sku.categoryOrBrand}
                        </span>
                      </td>
                      {renderValueCells(sku)}
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 tabular-nums">
                        - {formatRupiah(sku.deficitValue)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                          {formatPercent(sku.growthPercent)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-medium text-slate-700">
                          {sku.primaryReason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 3: BRANDS */}
        {subTab === 'brands' && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-2.5 px-3">Nama Brand</th>
                  {renderValueHeaders()}
                  <th className="py-2.5 px-3 text-right">
                    {ketFilter === 'SELL OUT'
                      ? 'Gap Out (Rp)'
                      : ketFilter === 'SELL IN'
                      ? 'Gap In (Rp)'
                      : 'Defisit Penurunan (Rp)'}
                  </th>
                  <th className="py-2.5 px-3 text-right">Growth (%)</th>
                  <th className="py-2.5 px-3">Rekomendasi Manajerial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDroppingBrands.length === 0 ? (
                  <tr>
                    <td
                      colSpan={ketFilter === 'ALL' ? 8 : 6}
                      className="py-8 text-center text-slate-400"
                    >
                      Seluruh brand membukukan pertumbuhan positif pada filter KET ({ketFilter}).
                    </td>
                  </tr>
                ) : (
                  topDroppingBrands.map((b) => (
                    <tr key={b.name} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                        {b.name}
                      </td>
                      {renderValueCells(b)}
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 tabular-nums">
                        - {formatRupiah(b.deficitValue)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                          {formatPercent(b.growthPercent)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        Buat promo bundling brand {b.name} dengan SKU fast moving untuk menstimulasi pengambilan stok oleh toko.
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 4: SALES */}
        {subTab === 'sales' && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-2.5 px-3">Nama Sales Person</th>
                  {renderValueHeaders()}
                  <th className="py-2.5 px-3 text-right">
                    {ketFilter === 'SELL OUT'
                      ? 'Gap Out (Rp)'
                      : ketFilter === 'SELL IN'
                      ? 'Gap In (Rp)'
                      : 'Gap Penurunan (Rp)'}
                  </th>
                  <th className="py-2.5 px-3 text-right">Growth (%)</th>
                  <th className="py-2.5 px-3">Tindakan Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDroppingSales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={ketFilter === 'ALL' ? 8 : 6}
                      className="py-8 text-center text-slate-400"
                    >
                      Seluruh sales person mencapai atau melampaui omzet periode lalu pada filter KET ({ketFilter}).
                    </td>
                  </tr>
                ) : (
                  topDroppingSales.map((s) => (
                    <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {s.name}
                      </td>
                      {renderValueCells(s)}
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 tabular-nums">
                        - {formatRupiah(s.deficitValue)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tabular-nums">
                          {formatPercent(s.growthPercent)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        SPV perlu mendampingi rute joint-visit untuk membedah toko yang belum order dan memeriksa kendala penagihan / stok.
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ATUR TARGET KUOTA PENJUALAN MANUAL (UMUM, PER SALES, PER TRAINER) */}
      {isAllMonthsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>
                    Pengaturan Manual Target Kuota Penjualan ({activeYearStr})
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Semua target bersifat 100% Edit Manual per bulan. Saat Filter Sales atau Trainer aktif, sistem otomatis memakai settingan target atas nama Sales / Trainer tersebut.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAllMonthsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Tabs: Kuota Umum | Kuota per Sales | Kuota per Trainer */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModalTab('general')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  modalTab === 'general'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                1. Kuota Umum (Semua)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('sales')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'sales'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>2. Kuota per Sales ({salesOptions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('trainer')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'trainer'
                    ? 'bg-cyan-700 text-white shadow-xs'
                    : 'bg-white text-cyan-900 border border-cyan-200 hover:bg-cyan-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>3. Kuota per Trainer ({GAP_TRAINER_LIST.length})</span>
              </button>
            </div>

            {/* Selector Bar for Tab Sales / Tab Trainer */}
            {modalTab === 'sales' && (
              <div className="px-5 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-indigo-900 mr-1">
                  Pilih Sales:
                </span>
                {salesOptions.map((salesName) => {
                  const isSel = selectedModalSales === salesName;
                  const hasAnyFilled =
                    Boolean(
                      entityDraft[getGapEntityQuotaKey('sales', salesName, 'ALL', activeYearStr)]
                        ?.sellIn ||
                        entityDraft[getGapEntityQuotaKey('sales', salesName, 'ALL', activeYearStr)]
                          ?.sellOut ||
                        entityDraft[getGapEntityQuotaKey('sales', salesName, 'ALL', activeYearStr)]
                          ?.total
                    ) ||
                    MONTH_OPTIONS_2026.some((m) => {
                      const d =
                        entityDraft[
                          getGapEntityQuotaKey('sales', salesName, m.bulanName, activeYearStr)
                        ];
                      return Boolean(d?.sellIn || d?.sellOut || d?.total);
                    });

                  return (
                    <button
                      key={salesName}
                      type="button"
                      onClick={() => setSelectedModalSales(salesName)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-indigo-950 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      <span>{salesName}</span>
                      {hasAnyFilled && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSel ? 'bg-emerald-300' : 'bg-emerald-500'
                          }`}
                          title="Sudah ada target terisi"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {modalTab === 'trainer' && (
              <div className="px-5 py-2.5 bg-cyan-50/50 border-b border-cyan-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-cyan-900 mr-1">
                  Pilih Trainer:
                </span>
                {GAP_TRAINER_LIST.map((trainerName) => {
                  const isSel = selectedModalTrainer === trainerName;
                  const hasAnyFilled =
                    Boolean(
                      entityDraft[
                        getGapEntityQuotaKey('trainer', trainerName, 'ALL', activeYearStr)
                      ]?.sellIn ||
                        entityDraft[
                          getGapEntityQuotaKey('trainer', trainerName, 'ALL', activeYearStr)
                        ]?.sellOut ||
                        entityDraft[
                          getGapEntityQuotaKey('trainer', trainerName, 'ALL', activeYearStr)
                        ]?.total
                    ) ||
                    MONTH_OPTIONS_2026.some((m) => {
                      const d =
                        entityDraft[
                          getGapEntityQuotaKey('trainer', trainerName, m.bulanName, activeYearStr)
                        ];
                      return Boolean(d?.sellIn || d?.sellOut || d?.total);
                    });

                  return (
                    <button
                      key={trainerName}
                      type="button"
                      onClick={() => setSelectedModalTrainer(trainerName)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? 'bg-cyan-700 text-white border-cyan-700 shadow-2xs'
                          : 'bg-white text-cyan-950 border-cyan-200 hover:bg-cyan-100'
                      }`}
                    >
                      <span>Trainer {trainerName}</span>
                      {hasAnyFilled && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSel ? 'bg-emerald-300' : 'bg-emerald-500'
                          }`}
                          title="Sudah ada target terisi"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Modal Content Grid (Shared 12 Months + Semua Bulan Editor) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(() => {
                const getKeyForBulan = (bulanVal: string) =>
                  modalTab === 'general'
                    ? getGapQuotaMonthKey(bulanVal, activeYearStr)
                    : modalTab === 'sales'
                    ? getGapEntityQuotaKey('sales', selectedModalSales, bulanVal, activeYearStr)
                    : getGapEntityQuotaKey(
                        'trainer',
                        selectedModalTrainer,
                        bulanVal,
                        activeYearStr
                      );

                const readDraft = (k: string) =>
                  (modalTab === 'general' ? allMonthsDraft[k] : entityDraft[k]) || {
                    total: '',
                    sellIn: '',
                    sellOut: '',
                  };

                const updateDraft = (
                  k: string,
                  nextVal: { total: string; sellIn: string; sellOut: string }
                ) => {
                  if (modalTab === 'general') {
                    setAllMonthsDraft((prev) => ({ ...prev, [k]: nextVal }));
                  } else {
                    setEntityDraft((prev) => ({ ...prev, [k]: nextVal }));
                  }
                };

                const scopeHeading =
                  modalTab === 'general'
                    ? 'Kuota Umum (Keseluruhan)'
                    : modalTab === 'sales'
                    ? `Sales: ${selectedModalSales}`
                    : `Trainer: ${selectedModalTrainer}`;

                const allKey = getKeyForBulan('ALL');
                const allEntry = readDraft(allKey);
                const allAutoSum =
                  (Number(allEntry.sellIn) || 0) + (Number(allEntry.sellOut) || 0);
                const isAllActive =
                  getGapQuotaMonthKey(filters.BULAN, filters.TAHUN) ===
                  getGapQuotaMonthKey('ALL', activeYearStr);

                return (
                  <>
                    <div className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg flex items-center justify-between">
                      <span>Sedang Mengatur: {scopeHeading}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        Kosong = Rp 0 (Manual)
                      </span>
                    </div>

                    {/* Semua Bulan Card */}
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isAllActive
                          ? 'border-indigo-400 bg-indigo-50/70'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>Semua Bulan ({activeYearStr})</span>
                            {isAllActive && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-600 text-white">
                                Bulan Aktif di Filter
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Dipakai saat Filter Terintegrasi memilih &quot;Semua Bulan&quot;
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(allKey, { total: '', sellIn: '', sellOut: '' })
                          }
                          className="text-[10px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
                        >
                          Reset Rp 0
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 mb-1">
                            Target Sell In (Rp)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="0 (Manual)"
                            value={allEntry.sellIn}
                            onChange={(e) =>
                              updateDraft(allKey, { ...allEntry, sellIn: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-indigo-700 font-mono block text-right mt-0.5">
                            {Number(allEntry.sellIn) > 0
                              ? formatRupiah(Number(allEntry.sellIn))
                              : 'Rp 0'}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-teal-800 mb-1">
                            Target Sell Out (Rp)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="0 (Manual)"
                            value={allEntry.sellOut}
                            onChange={(e) =>
                              updateDraft(allKey, { ...allEntry, sellOut: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-teal-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                          />
                          <span className="text-[10px] text-teal-700 font-mono block text-right mt-0.5">
                            {Number(allEntry.sellOut) > 0
                              ? formatRupiah(Number(allEntry.sellOut))
                              : 'Rp 0'}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">
                            Target Total / Gabungan (Opsional)
                          </label>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            placeholder={
                              allAutoSum > 0
                                ? `Sum: ${formatRupiah(allAutoSum, true)}`
                                : '0 (Manual)'
                            }
                            value={allEntry.total}
                            onChange={(e) =>
                              updateDraft(allKey, { ...allEntry, total: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-slate-500 font-mono block text-right mt-0.5">
                            {Number(allEntry.total) > 0
                              ? formatRupiah(Number(allEntry.total))
                              : allAutoSum > 0
                              ? `Gabungan: ${formatRupiah(allAutoSum)}`
                              : 'Rp 0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 12 Months Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {MONTH_OPTIONS_2026.map((m) => {
                        const k = getKeyForBulan(m.bulanName);
                        const isActiveMonth =
                          getGapQuotaMonthKey(filters.BULAN, filters.TAHUN) ===
                          getGapQuotaMonthKey(m.bulanName, activeYearStr);
                        const entry = readDraft(k);
                        const autoSum =
                          (Number(entry.sellIn) || 0) + (Number(entry.sellOut) || 0);
                        return (
                          <div
                            key={m.key}
                            className={`p-3 rounded-xl border ${
                              isActiveMonth
                                ? 'border-indigo-400 bg-indigo-50/70'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span>{m.bulanName}</span>
                                {isActiveMonth && (
                                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-indigo-600 text-white">
                                    Bulan Aktif
                                  </span>
                                )}
                              </div>
                              {(entry.sellIn || entry.sellOut || entry.total) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraft(k, { total: '', sellIn: '', sellOut: '' })
                                  }
                                  className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  Reset
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">
                                  Sell In (Rp)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  placeholder="0"
                                  value={entry.sellIn}
                                  onChange={(e) =>
                                    updateDraft(k, { ...entry, sellIn: e.target.value })
                                  }
                                  className="w-full px-2 py-1 text-[11px] font-mono font-bold text-right rounded-lg border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-[9px] text-indigo-700 font-mono block text-right mt-0.5 truncate">
                                  {Number(entry.sellIn) > 0
                                    ? formatRupiah(Number(entry.sellIn), true)
                                    : 'Rp 0'}
                                </span>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-teal-800 mb-0.5">
                                  Sell Out (Rp)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  placeholder="0"
                                  value={entry.sellOut}
                                  onChange={(e) =>
                                    updateDraft(k, { ...entry, sellOut: e.target.value })
                                  }
                                  className="w-full px-2 py-1 text-[11px] font-mono font-bold text-right rounded-lg border border-teal-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                                />
                                <span className="text-[9px] text-teal-700 font-mono block text-right mt-0.5 truncate">
                                  {Number(entry.sellOut) > 0
                                    ? formatRupiah(Number(entry.sellOut), true)
                                    : 'Rp 0'}
                                </span>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                  Total (Opsional)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  placeholder={autoSum > 0 ? 'Sum' : '0'}
                                  value={entry.total}
                                  onChange={(e) =>
                                    updateDraft(k, { ...entry, total: e.target.value })
                                  }
                                  className="w-full px-2 py-1 text-[11px] font-mono font-bold text-right rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-[9px] text-slate-500 font-mono block text-right mt-0.5 truncate">
                                  {Number(entry.total) > 0
                                    ? formatRupiah(Number(entry.total), true)
                                    : autoSum > 0
                                    ? `Sum: ${formatRupiah(autoSum, true)}`
                                    : 'Rp 0'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAllMonthsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAllMonthsQuota}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Semua Pengaturan Kuota</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
