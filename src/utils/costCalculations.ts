import {
  TransactionRecord,
  SalesSalaryItem,
  BaSalaryItem,
  BaCoveredStoreDetail,
  TrainerSalaryItem,
  AreaCostSummary,
  SalesCoveredBaItem,
  BaFocusProductOverride,
} from '../types/dashboard';
import { loadFocusOverrides, DEFAULT_FOCUS_TARGET_PCS } from '../services/focusProductService';
import { loadKpiTrainerData } from '../services/kpiTrainerService';
import { getTrainerForRecord, isFocusProduct } from './analytics';
import {
  WeeklyStoreConfig,
  normalizeStoreAlnum,
  resolveWeeklyBaStores,
} from './weeklyBaRegistry';
import { isPlaceholderBaNameKeaktifan } from '../services/keaktifanDataService';

export const DEFAULT_TRAINER_BASE_SALARY = 3900000;
export const DEFAULT_TRAINER_TRANSPORT_ALLOWANCE = 500000;
export const STORAGE_KEY_SALES_BA_PRODUCTIVITY = 'salespro_sales_ba_productivity_v1';
export const STORAGE_KEY_SALES_BONUSES_V2 = 'salespro_custom_sales_bonuses_v2';
const LEGACY_STORAGE_KEY_SALES_BONUSES = 'salespro_custom_sales_bonuses';

const normalizeBaKey = (name: string): string =>
  (name || '').trim().toUpperCase().replace(/\s+/g, ' ');

const isGenericBaPlaceholder = (normalizedKey: string): boolean =>
  !normalizedKey ||
  normalizedKey === '-' ||
  normalizedKey === 'NON BA' ||
  normalizedKey === 'NON-BA' ||
  normalizedKey === '- (NON-BA)' ||
  normalizedKey === 'STANDBY' ||
  normalizedKey === 'BA STANDBY' ||
  normalizedKey === 'BA COUNTER' ||
  normalizedKey === 'NO BA' ||
  normalizedKey === 'TANPA BA' ||
  normalizedKey === 'TIDAK ADA BA' ||
  normalizedKey === 'KOSONG' ||
  normalizedKey === 'VACANT';

const isPlaceholderBaEntry = (rawBa?: string, storeName?: string): boolean => {
  const norm = normalizeBaKey(rawBa || '');
  return isGenericBaPlaceholder(norm) || isPlaceholderBaNameKeaktifan(rawBa, storeName);
};

const splitConfiguredBaNames = (rawBa?: string): string[] => {
  const raw = (rawBa || '').trim();
  if (!raw) return ['BA COUNTER'];
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [raw];
  const validParts = parts.filter((p) => !isGenericBaPlaceholder(normalizeBaKey(p)));
  return validParts.length > 0 ? validParts : [parts[0]];
};

export interface SalesBaProductivityOverride {
  customTotalSellOut?: number;
  customBaCount?: number;
}

export function loadSalesBaProductivityOverrides(): Record<string, SalesBaProductivityOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SALES_BA_PRODUCTIVITY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadSalesBonusOverrides(): Record<string, number> {
  try {
    // Hapus cache lama (skema lama per-BA) agar tidak menimpa perhitungan flat per-Sales (500rb / 1Jt)
    if (localStorage.getItem(LEGACY_STORAGE_KEY_SALES_BONUSES) !== null) {
      localStorage.removeItem(LEGACY_STORAGE_KEY_SALES_BONUSES);
    }
    const raw = localStorage.getItem(STORAGE_KEY_SALES_BONUSES_V2);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface TrainerCostConfigInput {
  id: string;
  trainerName: string;
  areaCovered: string;
  region: string;
  targetSellOut: number;
  targetProdukFokusPcs: number;
  notes?: string;
}

export const DEFAULT_TRAINERS_DATA: TrainerCostConfigInput[] = [
  {
    id: 'trn-1',
    trainerName: 'ARA',
    areaCovered: 'PEKANBARU, DUMAI, SIAK, INDRAGIRI (Sales Albert, Ilhamsyah, Pareto, Tiwi)',
    region: 'PEKAN BARU',
    targetSellOut: 450000000,
    targetProdukFokusPcs: 800,
    notes: 'Trainer Lead - Area Pekanbaru & Dumai, Focus Brand barenbliss, Dazzle Me, lavojoy',
  },
  {
    id: 'trn-2',
    trainerName: 'RATIH',
    areaCovered: 'DURI, DUMAI, BAGAN SIAPI API, LUAR KOTA (Sales Abdul Rahim, Ilhamsyah, Luar Kota, Pareto, Tiwi)',
    region: 'DURI',
    targetSellOut: 420000000,
    targetProdukFokusPcs: 750,
    notes: 'Trainer Area Duri, Bagan Siapi Api & Luar Kota - Modern Trade & General Trade',
  },
];

/**
 * ATURAN PERHITUNGAN GAJI & INSENTIF TRAINER:
 * - Gaji Pokok: Rp 3.900.000
 * - Tunjangan Transportasi Trainer Dalam Kota: Rp 500.000
 * - Pencapaian Produk Fokus Trainer:
 *   * Capai >= 100%: Insentif +Rp 500.000
 *   * Capai 80% - 99%: Insentif +Rp 300.000
 *   * Capai 70% - 79.9%: Aman / Netral (Rp 0)
 *   * Capai < 70%: Diberi SP1 dan Denda -Rp 300.000
 * - Pencapaian Poin KPI Trainer (100 Poin):
 *   * Poin 100% (>= 100 pt): Insentif Trainer +Rp 2.000.000
 *   * Poin 90% - 99% (90-99 pt): Insentif Trainer +Rp 1.000.000
 *   * Poin 80% - 89% (80-89 pt): Insentif Trainer +Rp 500.000
 *   * Poin 70% - 79% (70-79 pt): Aman / Netral (Rp 0)
 *   * Poin < 70% (< 70 pt): Trainer diberi SP1 dan Denda -Rp 300.000
 */
export function calculateTrainerSalary(
  trainerName: string,
  focusTargetPcs: number,
  focusActualPcs: number,
  areaCovered: string = '-',
  region: string = '-',
  sellOutActual: number = 0,
  sellOutTarget: number = 350000000,
  manualIncentiveOverride?: number,
  manualPenaltyOverride?: number,
  notes?: string,
  kpiScore?: number,
  manualKpiIncentiveOverride?: number,
  manualKpiPenaltyOverride?: number,
  monthPeriod: string = 'OKTOBER 2026'
): TrainerSalaryItem {
  const baseSalary = DEFAULT_TRAINER_BASE_SALARY;
  const transportAllowance = DEFAULT_TRAINER_TRANSPORT_ALLOWANCE;
  const target = focusTargetPcs > 0 ? focusTargetPcs : 500;
  const focusAchievementPct = target > 0 ? (focusActualPcs / target) * 100 : 0;

  // 1. Skema Produk Fokus Trainer
  let focusStatus: 'insentif_500k' | 'insentif_300k' | 'aman' | 'denda_sp1' = 'aman';
  let focusIncentive = 0;
  let focusPenalty = 0;
  let hasSp1 = false;

  if (focusAchievementPct >= 100) {
    focusStatus = 'insentif_500k';
    focusIncentive = 500000;
  } else if (focusAchievementPct >= 80) {
    focusStatus = 'insentif_300k';
    focusIncentive = 300000;
  } else if (focusAchievementPct >= 70) {
    focusStatus = 'aman';
    focusIncentive = 0;
    focusPenalty = 0;
  } else {
    focusStatus = 'denda_sp1';
    focusPenalty = 300000;
    hasSp1 = true;
  }

  if (manualIncentiveOverride !== undefined) {
    focusIncentive = manualIncentiveOverride;
  }
  if (manualPenaltyOverride !== undefined) {
    focusPenalty = manualPenaltyOverride;
    hasSp1 = manualPenaltyOverride > 0;
  }

  // 2. Skema Insentif & Denda Poin KPI Trainer (Total 100 Poin)
  const scoreKpi = kpiScore !== undefined ? kpiScore : 85;
  let kpiStatus: 'insentif_2jt' | 'insentif_1jt' | 'insentif_500k' | 'aman' | 'denda_sp1' = 'aman';
  let kpiIncentive = 0;
  let kpiPenalty = 0;
  let hasKpiSp1 = false;

  if (scoreKpi >= 100) {
    kpiStatus = 'insentif_2jt';
    kpiIncentive = 2000000;
  } else if (scoreKpi >= 90) {
    kpiStatus = 'insentif_1jt';
    kpiIncentive = 1000000;
  } else if (scoreKpi >= 80) {
    kpiStatus = 'insentif_500k';
    kpiIncentive = 500000;
  } else if (scoreKpi >= 70) {
    kpiStatus = 'aman';
    kpiIncentive = 0;
    kpiPenalty = 0;
  } else {
    kpiStatus = 'denda_sp1';
    kpiPenalty = 300000;
    hasKpiSp1 = true;
    hasSp1 = true;
  }

  if (manualKpiIncentiveOverride !== undefined) {
    kpiIncentive = manualKpiIncentiveOverride;
  }
  if (manualKpiPenaltyOverride !== undefined) {
    kpiPenalty = manualKpiPenaltyOverride;
    hasKpiSp1 = manualKpiPenaltyOverride > 0;
    if (hasKpiSp1) hasSp1 = true;
  }

  const totalSalary =
    baseSalary + transportAllowance + focusIncentive - focusPenalty + kpiIncentive - kpiPenalty;

  return {
    id: `trn-${trainerName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    trainerName,
    areaCovered,
    region,
    baseSalary,
    transportAllowance,
    focusTargetPcs: target,
    focusActualPcs,
    focusAchievementPct,
    focusStatus,
    focusIncentive,
    focusPenalty,
    hasSp1,
    kpiScore: scoreKpi,
    kpiStatus,
    kpiIncentive,
    kpiPenalty,
    hasKpiSp1,
    monthPeriod,
    totalSalary,
    sellOutActual,
    sellOutTarget,
    notes,
    isCustom:
      manualIncentiveOverride !== undefined ||
      manualPenaltyOverride !== undefined ||
      manualKpiIncentiveOverride !== undefined ||
      manualKpiPenaltyOverride !== undefined,
  };
}

/**
 * ATURAN PERHITUNGAN GAJI & INSENTIF SALES:
 * - Gaji Pokok: Rp 4.900.000
 * - Capai Sell In >= 100%: Insentif 0,4% x Pencapaian Sell In + Rp 4.900.000
 * - Capai Sell In 80% - 99%: Insentif 0,2% x Pencapaian Sell In + Rp 4.900.000
 * - Capai Sell In < 80%: Insentif 0% + Rp 4.900.000 (Belum mencapai batas minimal insentif 80%)
 *
 * INSENTIF & PENALTI TAMBAHAN PRODUKTIVITAS SELL OUT BA (YANG DICOVER SALES):
 * - Produktivitas BA per Sales = Total Semua Sell Out BA Dicover ÷ Jumlah BA yang Dicover Sales
 * - Jika Produktivitas BA Rp 45.000.000 - Rp 54.999.999: Bonus Produktivitas BA untuk Sales +Rp 500.000 per Sales
 * - Jika Produktivitas BA >= Rp 55.000.000: Bonus Produktivitas BA untuk Sales +Rp 1.000.000 per Sales
 * - Produktivitas BA < Rp 45.000.000: Bonus Rp 0
 * - Denda Produktivitas BA: Sell Out BA < Rp 35.000.000 dikenakan SP1 dan Denda -Rp 300.000 per BA
 */
export function calculateSalesSalary(
  salesName: string,
  sellInActual: number,
  sellInTarget: number,
  coverArea: string = '-',
  spv: string = '-',
  coveredBaList: { storeName: string; baName: string; sellOut: number }[] = [],
  manualBonusOverride?: number,
  manualPenaltyOverride?: number,
  manualTotalSellOutOverride?: number,
  manualBaCountOverride?: number
): SalesSalaryItem {
  const target = sellInTarget > 0 ? sellInTarget : 1;
  const achievementPercent = (sellInActual / target) * 100;
  const baseSalary = 4900000;

  let incentivePercent = 0;
  let tierLabel = '';
  let tierColor = '';

  if (achievementPercent >= 120) {
    incentivePercent = 0.4;
    tierLabel = 'Super Target (≥ 120%) - Insentif 0,4%';
    tierColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (achievementPercent >= 100) {
    incentivePercent = 0.4;
    tierLabel = 'Capai Target (≥ 100%) - Insentif 0,4%';
    tierColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (achievementPercent >= 80) {
    incentivePercent = 0.2;
    tierLabel = 'Minimal Capai (80% - 99%)';
    tierColor = 'bg-amber-100 text-amber-800 border-amber-300';
  } else {
    incentivePercent = 0;
    tierLabel = 'Di Bawah Minimal (< 80%)';
    tierColor = 'bg-slate-100 text-slate-700 border-slate-300';
  }

  const incentiveNominal = Math.round((incentivePercent / 100) * sellInActual);

  // Evaluasi Produktivitas BA yang dicover oleh Sales
  let calculatedPenalty = 0;
  let spCount = 0;

  const detailedBaList: SalesCoveredBaItem[] = coveredBaList.map((ba) => {
    let status: 'bonus_1m' | 'bonus_500k' | 'normal' | 'penalty_sp1' = 'normal';
    let amount = 0;
    let description = 'Sell Out Normal (Rp 35 - 44.9 Jt)';

    if (ba.sellOut < 35000000) {
      status = 'penalty_sp1';
      amount = -300000;
      calculatedPenalty += 300000;
      spCount += 1;
      description = 'BA < 35 Jt: Denda -Rp 300.000 (SP1)';
    } else if (ba.sellOut >= 55000000) {
      status = 'bonus_1m';
      amount = 0;
      description = 'BA ≥ 55 Jt';
    } else if (ba.sellOut >= 45000000) {
      status = 'bonus_500k';
      amount = 0;
      description = 'BA 45-54 Jt';
    }

    return {
      storeName: ba.storeName,
      baName: ba.baName,
      sellOut: ba.sellOut,
      status,
      amount,
      description,
    };
  });

  // Hitung Produktivitas Rata-Rata BA = Total Semua Sell Out BA Dicover / Jumlah BA Dicover
  const systemTotalSellOut = coveredBaList.reduce((acc, ba) => acc + (ba.sellOut || 0), 0);
  const systemBaCount = coveredBaList.length;

  const hasSellOutOverride = manualTotalSellOutOverride !== undefined && manualTotalSellOutOverride >= 0;
  const hasBaCountOverride = manualBaCountOverride !== undefined && manualBaCountOverride >= 0;

  const coveredBaTotalSellOut = hasSellOutOverride ? manualTotalSellOutOverride! : systemTotalSellOut;
  const effectiveCoveredBaCount = hasBaCountOverride ? manualBaCountOverride! : systemBaCount;
  const baProductivityAverage =
    effectiveCoveredBaCount > 0 ? Math.round(coveredBaTotalSellOut / effectiveCoveredBaCount) : 0;

  let calculatedBonus = 0;
  if (effectiveCoveredBaCount > 0) {
    if (baProductivityAverage >= 55000000) {
      calculatedBonus = 1000000;
    } else if (baProductivityAverage >= 45000000) {
      calculatedBonus = 500000;
    }
  }

  const baProductivityBonus = manualBonusOverride !== undefined ? manualBonusOverride : calculatedBonus;
  const baProductivityPenalty = manualPenaltyOverride !== undefined ? manualPenaltyOverride : calculatedPenalty;
  const isProductivityEdited = hasSellOutOverride || hasBaCountOverride || manualBonusOverride !== undefined;

  const totalSalary = baseSalary + incentiveNominal + baProductivityBonus - baProductivityPenalty;

  return {
    salesName,
    coverArea,
    spv,
    sellInActual,
    sellInTarget: target,
    achievementPercent,
    tierLabel,
    tierColor,
    baseSalary,
    incentivePercent,
    incentiveNominal,
    coveredStores: coveredBaList.map((b) => b.storeName),
    coveredBaCount: effectiveCoveredBaCount,
    coveredBaList: detailedBaList,
    coveredBaTotalSellOut,
    systemCoveredBaTotalSellOut: systemTotalSellOut,
    systemCoveredBaCount: systemBaCount,
    baProductivityAverage,
    isProductivityEdited,
    baProductivityBonus,
    baProductivityPenalty,
    baProductivitySpCount: spCount,
    totalSalary,
  };
}

/**
 * ATURAN PERHITUNGAN GAJI & INSENTIF BEAUTY ADVISOR TOKO (SELL OUT):
 * - Catatan: Tidak ada BA Lavojoy terpisah; 1 BA melayani semua brand di gerai tersebut.
 * - Skema Non-Lavojoy (Y.O.U, barenbliss, DAZZLE ME, GLAMFIX, HUED, FORMULOGIC):
 *   • Capai Sell Out >= 120%: Gaji Pokok Rp 3.900.000 + Insentif 2% x Sell Out Non-Lavojoy
 *   • Capai Sell Out 100% - 119%: Gaji Pokok Rp 3.900.000 + Insentif 2% x Sell Out Non-Lavojoy
 *   • Capai Sell Out 70% - 99%: Gaji flat yang diterima Rp 2.925.000 (Insentif 0%)
 *   • Capai Sell Out Rp 1.000.000 - Rp 25.000.000 (< 70%): Gaji flat diterima Rp 2.000.000
 *   • Capai Sell Out > Rp 25.000.000 (< 70%): Gaji flat diterima Rp 2.000.000
 *   • Sell Out < Rp 1.000.000: Belum memenuhi batas minimum omset Rp 1 Jt (Gaji Rp 0)
 * - Skema Khusus Brand Lavojoy:
 *   • Jika pencapaian Sell Out Lavojoy >= 100%: Insentif 4% x Sell Out Lavojoy ditambahkan ke total gaji BA
 *   • Jika pencapaian Sell Out Lavojoy < 100%: Tidak ada insentif Lavojoy (Rp 0)
 */
export function calculateBaSalary(
  baName: string,
  baNumber: string,
  storeName: string,
  sellOutNonLavojoy: number,
  sellOutLavojoy: number = 0,
  targetNonLavojoy: number = 30000000,
  targetLavojoy: number = 5000000,
  coverArea: string = '-',
  region: string = '-',
  salesName: string = '-',
  spv: string = '-',
  focusTargetPcs: number = 0,
  focusActualPcs: number = 0,
  focusIncentiveOverride?: number,
  focusPenaltyOverride?: number
): BaSalaryItem {
  const tNonLavojoy = targetNonLavojoy > 0 ? targetNonLavojoy : 30000000;
  const tLavojoy = targetLavojoy >= 0 ? targetLavojoy : 5000000;
  const isLavojoyMergedToMain = tLavojoy === 0;

  // Jika Target Lavojoy diset 0, maka seluruh pencapaian Sell Out BA (Non-Lavojoy + Lavojoy)
  // dihitung sebagai pencapaian Sell Out utama BA tersebut.
  const effectiveMainSellOut = isLavojoyMergedToMain
    ? sellOutNonLavojoy + sellOutLavojoy
    : sellOutNonLavojoy;

  const achievementNonLavojoyPercent = (effectiveMainSellOut / tNonLavojoy) * 100;
  const sellOutActual = sellOutNonLavojoy + sellOutLavojoy;
  const isMinSalesMet = sellOutActual >= 1000000;

  // 1. Gaji Pokok & Insentif Non-Lavojoy (atau Total Sell Out jika Target Lavojoy = 0)
  let baseSalary = 0;
  let incentiveNonLavojoyPercent = 0;
  let tierLabel = '';
  let tierColor = '';

  if (achievementNonLavojoyPercent >= 120) {
    baseSalary = 3900000;
    incentiveNonLavojoyPercent = 2.0;
    tierLabel = 'Tier Super (≥ 120%)';
    tierColor = 'bg-purple-100 text-purple-800 border-purple-300';
  } else if (achievementNonLavojoyPercent >= 100) {
    baseSalary = 3900000;
    incentiveNonLavojoyPercent = 2.0;
    tierLabel = 'Tier Target (100% - 119%)';
    tierColor = 'bg-teal-100 text-teal-800 border-teal-300';
  } else if (achievementNonLavojoyPercent >= 70) {
    baseSalary = 2925000;
    incentiveNonLavojoyPercent = 0;
    tierLabel = 'Tier Dasar (70% - 99%)';
    tierColor = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (effectiveMainSellOut >= 1000000 && effectiveMainSellOut <= 25000000) {
    baseSalary = 2000000;
    incentiveNonLavojoyPercent = 0;
    tierLabel = 'Omset Rp 1 Jt - 25 Jt';
    tierColor = 'bg-orange-100 text-orange-800 border-orange-300';
  } else if (effectiveMainSellOut > 25000000) {
    baseSalary = 2000000;
    incentiveNonLavojoyPercent = 0;
    tierLabel = 'Omset > 25 Jt (< 70%)';
    tierColor = 'bg-orange-100 text-orange-800 border-orange-300';
  } else {
    baseSalary = 0;
    incentiveNonLavojoyPercent = 0;
    tierLabel = 'Di Bawah Min. Rp 1 Jt';
    tierColor = 'bg-rose-100 text-rose-800 border-rose-300';
  }

  const incentiveNonLavojoyNominal = Math.round((incentiveNonLavojoyPercent / 100) * effectiveMainSellOut);

  // 2. Insentif Khusus Lavojoy (4% jika target > 0 & capai 100%; jika target = 0, sudah digabung ke pencapaian utama)
  const achievementLavojoyPercent = tLavojoy > 0 ? (sellOutLavojoy / tLavojoy) * 100 : 0;
  const isLavojoyTargetMet = tLavojoy > 0 && achievementLavojoyPercent >= 100;
  const incentiveLavojoyPercent = isLavojoyTargetMet ? 4.0 : 0;
  const incentiveLavojoyNominal = isLavojoyTargetMet ? Math.round((4.0 / 100) * sellOutLavojoy) : 0;

  // 3. Insentif & Denda Produk Fokus BA
  // Aturan: Capaian >= 80%: Insentif Rp 2.000 / pcs, 70-79%: AMAN (Rp 0), < 70%: Denda Rp 1.000 / pcs kekurangan
  let focusAchievementPct = 0;
  let focusStatus: 'insentif' | 'aman' | 'denda' = 'aman';
  let focusIncentive = 0;
  let focusPenalty = 0;

  if (focusTargetPcs > 0) {
    focusAchievementPct = (focusActualPcs / focusTargetPcs) * 100;
    if (focusAchievementPct >= 80) {
      focusStatus = 'insentif';
      focusIncentive = Math.round(focusActualPcs * 2000);
      focusPenalty = 0;
    } else if (focusAchievementPct >= 70) {
      focusStatus = 'aman';
      focusIncentive = 0;
      focusPenalty = 0;
    } else {
      focusStatus = 'denda';
      focusIncentive = 0;
      focusPenalty = Math.round(focusTargetPcs * 1000);
    }
  }

  if (focusIncentiveOverride !== undefined && focusIncentiveOverride >= 0) {
    focusIncentive = focusIncentiveOverride;
  }
  if (focusPenaltyOverride !== undefined && focusPenaltyOverride >= 0) {
    focusPenalty = focusPenaltyOverride;
  }

  const focusNetBonus = focusIncentive - focusPenalty;

  // 4. Gabungan Keseluruhan
  const sellOutTarget = tNonLavojoy + tLavojoy;
  const achievementPercent = sellOutTarget > 0 ? (sellOutActual / sellOutTarget) * 100 : 0;
  const totalIncentiveNominal = incentiveNonLavojoyNominal + incentiveLavojoyNominal;
  const incentivePercent = sellOutActual > 0 ? (totalIncentiveNominal / sellOutActual) * 100 : 0;
  
  // Total Salary: Gaji Pokok + Insentif Omset + Insentif Produk Fokus - Denda Produk Fokus
  const totalSalary = Math.max(0, baseSalary + totalIncentiveNominal + focusIncentive - focusPenalty);

  return {
    baName,
    baNumber,
    storeName,
    coverArea,
    region,
    salesName,
    spv,
    sellOutNonLavojoy: effectiveMainSellOut,
    targetNonLavojoy: tNonLavojoy,
    achievementNonLavojoyPercent,
    baseSalary,
    incentiveNonLavojoyPercent,
    incentiveNonLavojoyNominal,
    tierLabel,
    tierColor,
    sellOutLavojoy: isLavojoyMergedToMain ? 0 : sellOutLavojoy,
    targetLavojoy: tLavojoy,
    achievementLavojoyPercent,
    isLavojoyTargetMet,
    incentiveLavojoyPercent,
    incentiveLavojoyNominal,
    focusTargetPcs,
    focusActualPcs,
    focusAchievementPct: Number(focusAchievementPct.toFixed(1)),
    focusStatus,
    focusIncentive,
    focusPenalty,
    focusNetBonus,
    sellOutActual,
    sellOutTarget,
    achievementPercent,
    totalIncentiveNominal,
    incentiveNominal: totalIncentiveNominal,
    incentivePercent: Number(incentivePercent.toFixed(2)),
    totalSalary,
    isMinSalesMet,
  };
}

/**
 * Agregasi Keseluruhan Cost Area dari Transaksi yang Terfilter
 */
export interface AggregateCostOptions {
  strictSellInForSales?: boolean;
  strictSellOutForBa?: boolean;
  disableDummyBaFallback?: boolean;
  disableTrainerDummyActualFallback?: boolean;
  activeTrainersOnlyFromRecords?: boolean;
  zeroCostOnEmptyRecords?: boolean;
  sellOutRecordsOverride?: TransactionRecord[];
  trainerSellOutRecordsOverride?: TransactionRecord[];
  weeklyBaStoresOverride?: WeeklyStoreConfig[];
  syncBaFromWeeklyRegistry?: boolean;
  skipEmptyPeriodBaPenalty?: boolean;
  salesBaProductivityOverrides?: Record<string, SalesBaProductivityOverride>;
}

export function aggregateAreaCost(
  records: TransactionRecord[],
  customSalesTargets: Record<string, number> = {},
  customBaNonLavojoyTargets: Record<string, number> = {},
  customBaLavojoyTargets: Record<string, number> = {},
  customSalesBonuses: Record<string, number> = {},
  customSalesPenalties: Record<string, number> = {},
  defaultSalesTarget: number = 150000000,
  defaultBaNonLavojoyTarget: number = 30000000,
  defaultBaLavojoyTarget: number = 5000000,
  customBaFocusOverrides?: Record<string, BaFocusProductOverride>,
  defaultBaFocusTarget: number = DEFAULT_FOCUS_TARGET_PCS,
  customTrainerFocusTargets: Record<string, number> = {},
  customTrainerIncentives: Record<string, number> = {},
  customTrainerPenalties: Record<string, number> = {},
  customTrainerKpiScores: Record<string, number> = {},
  customTrainerKpiIncentives: Record<string, number> = {},
  customTrainerKpiPenalties: Record<string, number> = {},
  trainerMonthPeriod: string = 'OKTOBER 2026',
  trainerConfigsOverride?: TrainerCostConfigInput[],
  trainerMonthlyTargetsOverride?: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; notes?: string }>,
  baFocusTargetsOverride?: Record<string, number>,
  options?: AggregateCostOptions
): AreaCostSummary {
  const activeTrainerDefs =
    trainerConfigsOverride && trainerConfigsOverride.length > 0
      ? trainerConfigsOverride
      : DEFAULT_TRAINERS_DATA;

  const sellInSource = records;
  const baSellOutSource = options?.sellOutRecordsOverride ?? records;
  const trainerSellOutSource =
    options?.trainerSellOutRecordsOverride ?? options?.sellOutRecordsOverride ?? records;

  // Build case-insensitive lookup maps for targets & adjustments
  const toUpperLookup = <T,>(src?: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    if (!src) return out;
    for (const [k, v] of Object.entries(src)) {
      out[k] = v;
      out[k.trim().toUpperCase()] = v;
    }
    return out;
  };
  const salesTargetLookup = toUpperLookup(customSalesTargets);
  const baNonLavojoyLookup = toUpperLookup(customBaNonLavojoyTargets);
  const baLavojoyLookup = toUpperLookup(customBaLavojoyTargets);
  const baFocusTargetLookup = toUpperLookup(baFocusTargetsOverride);
  const salesBonusLookup = toUpperLookup(customSalesBonuses);
  const salesPenaltyLookup = toUpperLookup(customSalesPenalties);
  const salesProdLookup = toUpperLookup(
    options?.salesBaProductivityOverrides ?? loadSalesBaProductivityOverrides()
  );

  // Resolve Weekly BA Store registry if provided or requested (pertahankan multi-BA per toko)
  let weeklyBaList: WeeklyStoreConfig[] | undefined = undefined;
  if (options?.weeklyBaStoresOverride !== undefined) {
    const dedup = new Map<string, WeeklyStoreConfig>();
    for (const ws of options.weeklyBaStoresOverride) {
      const storeKey = (ws.storeName || '').trim().toLowerCase();
      if (!storeKey) continue;
      const baNorm = normalizeBaKey(ws.baName || '');
      const compositeKey = isGenericBaPlaceholder(baNorm)
        ? `${storeKey}::__NO_BA__`
        : `${storeKey}::${baNorm}`;
      if (!dedup.has(compositeKey)) dedup.set(compositeKey, ws);
    }
    weeklyBaList = Array.from(dedup.values());
  } else if (options?.syncBaFromWeeklyRegistry) {
    weeklyBaList = resolveWeeklyBaStores(baSellOutSource, { allowMultiBaPerStore: true });
  }

  // 1. Group by Sales Representative (SELL IN)
  const salesMap: Record<
    string,
    {
      sellInActual: number;
      coverArea: string;
      spv: string;
      coveredStores: Set<string>;
    }
  > = {};

  // 2. Group by (Nama BA, Store Name) agar 2+ BA dalam 1 toko tetap terpisah pencapaiannya
  const baStoreMap: Record<
    string,
    {
      baName: string;
      baNumber: string;
      storeName: string;
      coverArea: string;
      region: string;
      salesName: string;
      spv: string;
      sellOutNonLavojoy: number;
      sellOutLavojoy: number;
      sellOutActual: number;
      focusActualPcs: number;
    }
  > = {};

  const baLookupByLower = new Map<string, string>();
  const baLookupByAlnum = new Map<string, string>();
  const weeklyTemplatesByLower = new Map<string, WeeklyStoreConfig[]>();
  const weeklyTemplatesByAlnum = new Map<string, WeeklyStoreConfig[]>();
  const weeklyTrainerByStoreLower = new Map<string, string>();
  const fallbackBucketKeyByStoreUpper = new Map<string, string>();
  const autoSeededKeysByStoreUpper = new Map<string, Set<string>>();

  if (weeklyBaList) {
    weeklyBaList.forEach((ws, idx) => {
      const storeName = ws.storeName.trim();
      const storeLower = storeName.toLowerCase();
      const storeUpper = storeName.toUpperCase();
      const storeAlnum = normalizeStoreAlnum(storeName);
      const salesName = (ws.salesName || '-').trim().toUpperCase();

      if (!baLookupByLower.has(storeLower)) {
        baLookupByLower.set(storeLower, storeName);
      }
      if (storeAlnum && !baLookupByAlnum.has(storeAlnum)) {
        baLookupByAlnum.set(storeAlnum, storeName);
      }
      if (!weeklyTemplatesByLower.has(storeLower)) {
        weeklyTemplatesByLower.set(storeLower, []);
      }
      weeklyTemplatesByLower.get(storeLower)!.push(ws);
      if (storeAlnum) {
        if (!weeklyTemplatesByAlnum.has(storeAlnum)) {
          weeklyTemplatesByAlnum.set(storeAlnum, []);
        }
        weeklyTemplatesByAlnum.get(storeAlnum)!.push(ws);
      }
      if (ws.trainerName && !weeklyTrainerByStoreLower.has(storeLower)) {
        weeklyTrainerByStoreLower.set(storeLower, ws.trainerName.trim().toUpperCase());
      }

      const baCandidates = splitConfiguredBaNames(ws.baName);
      baCandidates.forEach((candidateBa, bIdx) => {
        const baNorm = normalizeBaKey(candidateBa);
        const bucketKey = isGenericBaPlaceholder(baNorm)
          ? `__NO_BA__::${storeUpper}`
          : `${baNorm}::${storeUpper}`;

        if (!baStoreMap[bucketKey]) {
          baStoreMap[bucketKey] = {
            baName: candidateBa || 'BA COUNTER',
            baNumber: ws.id
              ? baCandidates.length > 1
                ? `${ws.id.toUpperCase()}-${bIdx + 1}`
                : ws.id.toUpperCase()
              : `BA-${String(idx + 1).padStart(3, '0')}`,
            storeName,
            coverArea: ws.coverArea || '-',
            region: ws.region || '-',
            salesName,
            spv: 'WIDODO',
            sellOutNonLavojoy: 0,
            sellOutLavojoy: 0,
            sellOutActual: 0,
            focusActualPcs: 0,
          };
        }

        if (!fallbackBucketKeyByStoreUpper.has(storeUpper)) {
          fallbackBucketKeyByStoreUpper.set(storeUpper, bucketKey);
        }

        if (!ws.isBaCustom) {
          if (!autoSeededKeysByStoreUpper.has(storeUpper)) {
            autoSeededKeysByStoreUpper.set(storeUpper, new Set<string>());
          }
          autoSeededKeysByStoreUpper.get(storeUpper)!.add(bucketKey);
        }
      });

      if (salesName && salesName !== '-' && salesName !== 'ALL' && salesName !== 'OPERASIONAL' && salesName !== 'SALES UMUM') {
        if (!salesMap[salesName]) {
          salesMap[salesName] = {
            sellInActual: 0,
            coverArea: ws.coverArea || '-',
            spv: 'WIDODO',
            coveredStores: new Set<string>(),
          };
        }
        salesMap[salesName].coveredStores.add(storeName);
      }
    });
  }

  // 3. Group by Trainer (Produk Fokus & Sell Out)
  const trainerMap: Record<string, { focusQty: number; sellOut: number }> = {};
  for (const t of activeTrainerDefs) {
    trainerMap[t.trainerName] = { focusQty: 0, sellOut: 0 };
  }

  if (
    options?.zeroCostOnEmptyRecords &&
    sellInSource.length === 0 &&
    baSellOutSource.length === 0 &&
    trainerSellOutSource.length === 0 &&
    (!weeklyBaList || weeklyBaList.length === 0)
  ) {
    return {
      totalCost: 0,
      totalSalesCost: 0,
      totalSalesBase: 0,
      totalSalesIncentive: 0,
      totalBaCost: 0,
      totalBaBase: 0,
      totalBaIncentive: 0,
      totalBaFocusIncentive: 0,
      totalBaFocusPenalty: 0,
      totalBaFocusNetBonus: 0,
      totalTrainerCost: 0,
      totalTrainerBase: 0,
      totalTrainerTransport: 0,
      totalTrainerFocusIncentive: 0,
      totalTrainerFocusPenalty: 0,
      totalTrainerKpiIncentive: 0,
      totalTrainerKpiPenalty: 0,
      totalAreaRevenue: 0,
      costToRevenueRatio: 0,
      salesCount: 0,
      baCount: 0,
      trainerCount: 0,
      salesList: [],
      baList: [],
      trainerList: [],
    };
  }

  let totalAreaRevenue = 0;

  // PASS A: Sales SELL IN (1 - akhir bulan) & Total Omset Area
  for (const r of sellInSource) {
    const val = r.VALUE || 0;
    const ketUpper = (r.KET || '').trim().toUpperCase();
    const isSellInTx = ketUpper === 'SELL IN' || ketUpper.includes('SELL IN') || !ketUpper;

    if (!options?.strictSellInForSales || isSellInTx) {
      totalAreaRevenue += val;
    }

    if (r.SALES && r.SALES !== '-' && r.SALES !== 'ALL') {
      const salesKey = r.SALES.trim().toUpperCase();
      if (!salesMap[salesKey]) {
        salesMap[salesKey] = {
          sellInActual: 0,
          coverArea: r.COVER_AREA || '-',
          spv: r.SPV || '-',
          coveredStores: new Set<string>(),
        };
      } else {
        if (salesMap[salesKey].coverArea === '-' && r.COVER_AREA) {
          salesMap[salesKey].coverArea = r.COVER_AREA;
        }
        if (salesMap[salesKey].spv === '-' && r.SPV) {
          salesMap[salesKey].spv = r.SPV;
        }
      }
      if (r.NAMA_STORE && !weeklyBaList) {
        salesMap[salesKey].coveredStores.add(r.NAMA_STORE);
      }
      if (options?.strictSellInForSales) {
        if (isSellInTx) {
          salesMap[salesKey].sellInActual += val;
        }
      } else {
        salesMap[salesKey].sellInActual += val;
      }
    }
  }

  if (totalAreaRevenue === 0 && baSellOutSource.length > 0 && baSellOutSource !== sellInSource) {
    for (const r of baSellOutSource) {
      totalAreaRevenue += r.VALUE || 0;
    }
  }

  // PASS B: BA SELL OUT (Cut-off tgl 26 bulan lalu s/d 25 bulan berjalan)
  const storesWithRealTxBa = new Set<string>();
  const bucketsWithTx = new Set<string>();
  let dynamicBaSeq = 1;

  for (const r of baSellOutSource) {
    const val = r.VALUE || 0;
    const ketUpper = (r.KET || '').trim().toUpperCase();
    const isSellOutTx = ketUpper === 'SELL OUT' || ketUpper.includes('SELL OUT') || !ketUpper;
    if (options?.strictSellOutForBa && !isSellOutTx) continue;

    if (weeklyBaList) {
      const rawStore = (r.NAMA_STORE || '').trim();
      if (!rawStore) continue;
      const rawStoreLower = rawStore.toLowerCase();
      const rawStoreAlnum = normalizeStoreAlnum(rawStore);
      const matchedStoreName =
        baLookupByLower.get(rawStoreLower) ||
        baLookupByAlnum.get(rawStoreAlnum);
      if (!matchedStoreName) continue;

      const matchedStoreUpper = matchedStoreName.toUpperCase();
      const rawBaTrim = (r.BA || '').trim();
      const rawBaNorm = normalizeBaKey(rawBaTrim);
      const hasValidTxBa = !isPlaceholderBaEntry(rawBaTrim, matchedStoreName);

      let targetBucketKey: string | undefined;
      if (hasValidTxBa) {
        targetBucketKey = `${rawBaNorm}::${matchedStoreUpper}`;
        storesWithRealTxBa.add(matchedStoreUpper);

        if (!baStoreMap[targetBucketKey]) {
          const templates =
            weeklyTemplatesByLower.get(matchedStoreName.toLowerCase()) ||
            weeklyTemplatesByAlnum.get(normalizeStoreAlnum(matchedStoreName)) ||
            [];
          const matchingTpl =
            templates.find((t) => normalizeBaKey(t.baName) === rawBaNorm) || templates[0];
          const tplSales =
            matchingTpl?.salesName &&
            matchingTpl.salesName !== '-' &&
            matchingTpl.salesName.toUpperCase() !== 'SALES UMUM'
              ? matchingTpl.salesName.trim().toUpperCase()
              : undefined;
          const txSales =
            r.SALES && r.SALES !== '-' ? r.SALES.trim().toUpperCase() : undefined;

          baStoreMap[targetBucketKey] = {
            baName: rawBaTrim,
            baNumber:
              (r.BA_Number && r.BA_Number.trim() && r.BA_Number.trim() !== '-'
                ? r.BA_Number.trim()
                : undefined) ||
              `BA-${String(dynamicBaSeq++).padStart(3, '0')}`,
            storeName: matchedStoreName,
            coverArea:
              (matchingTpl?.coverArea && matchingTpl.coverArea !== '-'
                ? matchingTpl.coverArea
                : r.COVER_AREA) || '-',
            region:
              (matchingTpl?.region && matchingTpl.region !== '-'
                ? matchingTpl.region
                : r.REGION) || '-',
            salesName: tplSales || txSales || '-',
            spv: (r.SPV && r.SPV !== '-' ? r.SPV : 'WIDODO'),
            sellOutNonLavojoy: 0,
            sellOutLavojoy: 0,
            sellOutActual: 0,
            focusActualPcs: 0,
          };
        } else if (
          r.BA_Number &&
          r.BA_Number.trim() &&
          r.BA_Number.trim() !== '-' &&
          /^WS-|^GS-STORE-|^BA-\d+$/i.test(baStoreMap[targetBucketKey].baNumber)
        ) {
          baStoreMap[targetBucketKey].baNumber = r.BA_Number.trim();
        }
      } else {
        targetBucketKey = fallbackBucketKeyByStoreUpper.get(matchedStoreUpper);
      }

      if (!targetBucketKey || !baStoreMap[targetBucketKey]) continue;
      bucketsWithTx.add(targetBucketKey);

      const isLavojoy = (r.BRAND || '').trim().toLowerCase() === 'lavojoy';
      if (isLavojoy) {
        baStoreMap[targetBucketKey].sellOutLavojoy += val;
      } else {
        baStoreMap[targetBucketKey].sellOutNonLavojoy += val;
      }
      baStoreMap[targetBucketKey].sellOutActual += val;

      if (isFocusProduct(r.PRODUK_FOCUS || r)) {
        baStoreMap[targetBucketKey].focusActualPcs += (r.QTY || 0);
      }
    } else {
      const baTrim = (r.BA || '').trim();
      const baNorm = normalizeBaKey(baTrim);
      if (isGenericBaPlaceholder(baNorm)) continue;
      const storeName = (r.NAMA_STORE || '').trim();
      if (!storeName) continue;
      const bucketKey = `${baNorm}::${storeName.toUpperCase()}`;
      if (!baStoreMap[bucketKey]) {
        baStoreMap[bucketKey] = {
          baName: baTrim,
          baNumber: r.BA_Number || `BA-${String(dynamicBaSeq++).padStart(3, '0')}`,
          storeName,
          coverArea: r.COVER_AREA || '-',
          region: r.REGION || '-',
          salesName: r.SALES || '-',
          spv: r.SPV || '-',
          sellOutNonLavojoy: 0,
          sellOutLavojoy: 0,
          sellOutActual: 0,
          focusActualPcs: 0,
        };
      }
      if (r.SALES && r.SALES !== '-' && baStoreMap[bucketKey].salesName === '-') {
        baStoreMap[bucketKey].salesName = r.SALES;
      }
      if (r.SPV && r.SPV !== '-' && baStoreMap[bucketKey].spv === '-') {
        baStoreMap[bucketKey].spv = r.SPV;
      }

      const isLavojoy = (r.BRAND || '').trim().toLowerCase() === 'lavojoy';
      if (isLavojoy) {
        baStoreMap[bucketKey].sellOutLavojoy += val;
      } else {
        baStoreMap[bucketKey].sellOutNonLavojoy += val;
      }
      baStoreMap[bucketKey].sellOutActual += val;

      const isFocus = isFocusProduct(r.PRODUK_FOCUS || r);
      if (isFocus && (r.KET === 'SELL OUT' || !r.KET || r.KET === 'SELL IN')) {
        baStoreMap[bucketKey].focusActualPcs += (r.QTY || 0);
      }
    }
  }

  // Hapus template BA bawaan (!isBaCustom) yang 0 transaksi jika pada periode ini toko tsb sudah memiliki transaksi BA aktual dari sheet
  if (weeklyBaList && storesWithRealTxBa.size > 0) {
    storesWithRealTxBa.forEach((storeUpper) => {
      const seededSet = autoSeededKeysByStoreUpper.get(storeUpper);
      if (!seededSet) return;
      seededSet.forEach((seededKey) => {
        if (!bucketsWithTx.has(seededKey)) {
          delete baStoreMap[seededKey];
        }
      });
    });
  }

  // PASS C: Trainer SELL OUT & Produk Fokus (Cut-off tgl 26 bulan lalu s/d 25 bulan berjalan)
  for (const r of trainerSellOutSource) {
    const val = r.VALUE || 0;
    const ketUpper = (r.KET || '').trim().toUpperCase();
    const isSellOutTx = ketUpper === 'SELL OUT' || ketUpper.includes('SELL OUT') || !ketUpper;
    if (options?.strictSellOutForBa && !isSellOutTx) continue;

    let tName = getTrainerForRecord(r);
    if (weeklyBaList && r.NAMA_STORE) {
      const matchedStoreKey =
        baLookupByLower.get(r.NAMA_STORE.trim().toLowerCase()) ||
        baLookupByAlnum.get(normalizeStoreAlnum(r.NAMA_STORE));
      if (matchedStoreKey && weeklyTrainerByStoreLower.has(matchedStoreKey.toLowerCase())) {
        const wt = weeklyTrainerByStoreLower.get(matchedStoreKey.toLowerCase())!;
        if (wt && wt !== 'ONLINE') {
          tName = wt;
        }
      }
    }
    if (!trainerMap[tName]) {
      trainerMap[tName] = { focusQty: 0, sellOut: 0 };
    }
    trainerMap[tName].sellOut += val;
    if (isFocusProduct(r.PRODUK_FOCUS || r)) {
      trainerMap[tName].focusQty += (r.QTY || 0);
    }
  }

  // Fallback jika tidak ada data BA terfilter
  if (Object.keys(baStoreMap).length === 0 && !options?.disableDummyBaFallback) {
    const storeTotals: Record<string, { value: number; region: string; area: string; sales: string; spv: string; lavojoy: number; nonLavojoy: number; focusQty: number }> = {};
    for (const r of baSellOutSource) {
      if (r.NAMA_STORE) {
        if (!storeTotals[r.NAMA_STORE]) {
          storeTotals[r.NAMA_STORE] = { value: 0, region: r.REGION || '-', area: r.COVER_AREA || '-', sales: r.SALES || '-', spv: r.SPV || '-', lavojoy: 0, nonLavojoy: 0, focusQty: 0 };
        }
        const val = r.VALUE || 0;
        storeTotals[r.NAMA_STORE].value += val;
        if ((r.BRAND || '').trim().toLowerCase() === 'lavojoy') {
          storeTotals[r.NAMA_STORE].lavojoy += val;
        } else {
          storeTotals[r.NAMA_STORE].nonLavojoy += val;
        }
        if (isFocusProduct(r.PRODUK_FOCUS || r)) {
          storeTotals[r.NAMA_STORE].focusQty += (r.QTY || 0);
        }
      }
    }
    Object.entries(storeTotals)
      .slice(0, 3)
      .forEach(([sName, data], idx) => {
        const dummyBas = [
          { name: 'Siti Rahma', no: 'BA-012', qty: 115 },
          { name: 'Nur Aini', no: 'BA-045', qty: 95 },
          { name: 'Dewi Lestari', no: 'BA-088', qty: 65 },
        ];
        const baInfo = dummyBas[idx % dummyBas.length];
        baStoreMap[sName] = {
          baName: baInfo.name,
          baNumber: baInfo.no,
          storeName: sName,
          coverArea: data.area,
          region: data.region,
          salesName: data.sales,
          spv: data.spv || '-',
          sellOutNonLavojoy: data.nonLavojoy > 0 ? data.nonLavojoy : data.value * 0.85,
          sellOutLavojoy: data.lavojoy > 0 ? data.lavojoy : data.value * 0.15,
          sellOutActual: data.value,
          focusActualPcs: data.focusQty > 0 ? data.focusQty : baInfo.qty,
        };
      });
  }

  // Gabungkan entri BA jika memiliki Nama BA yang sama meskipun beda Nama Toko & Area
  interface MergedBaAccumulator {
    baName: string;
    baNumber: string;
    storeName: string;
    coverArea: string;
    region: string;
    salesName: string;
    spv: string;
    sellOutNonLavojoy: number;
    sellOutLavojoy: number;
    sellOutActual: number;
    focusActualPcs: number;
    storeDetails: BaCoveredStoreDetail[];
    storeNamesSet: Set<string>;
    coverAreasSet: Set<string>;
    regionsSet: Set<string>;
    salesNamesSet: Set<string>;
    spvsSet: Set<string>;
  }

  const mergedBaMap = new Map<string, MergedBaAccumulator>();
  const addUniqueToken = (set: Set<string>, rawValue: string) => {
    const clean = (rawValue || '').trim();
    if (!clean || clean === '-') return;
    for (const part of clean.split(',')) {
      const p = part.trim();
      if (!p || p === '-') continue;
      const upper = p.toUpperCase();
      const exists = Array.from(set).some((x) => x.toUpperCase() === upper);
      if (!exists) set.add(p);
    }
  };

  Object.entries(baStoreMap).forEach(([rawKey, entry]) => {
    const baNorm = normalizeBaKey(entry.baName);
    const groupKey = isGenericBaPlaceholder(baNorm) ? `__RAW__${rawKey}` : baNorm;

    const existing = mergedBaMap.get(groupKey);
    const detailItem: BaCoveredStoreDetail = {
      storeName: entry.storeName,
      coverArea: entry.coverArea || '-',
      region: entry.region || '-',
      salesName: entry.salesName || '-',
      sellOutNonLavojoy: entry.sellOutNonLavojoy,
      sellOutLavojoy: entry.sellOutLavojoy,
    };

    if (!existing) {
      const acc: MergedBaAccumulator = {
        baName: entry.baName.trim(),
        baNumber: entry.baNumber,
        storeName: entry.storeName,
        coverArea: entry.coverArea || '-',
        region: entry.region || '-',
        salesName: entry.salesName || '-',
        spv: entry.spv || '-',
        sellOutNonLavojoy: entry.sellOutNonLavojoy,
        sellOutLavojoy: entry.sellOutLavojoy,
        sellOutActual: entry.sellOutActual,
        focusActualPcs: entry.focusActualPcs,
        storeDetails: [detailItem],
        storeNamesSet: new Set<string>(),
        coverAreasSet: new Set<string>(),
        regionsSet: new Set<string>(),
        salesNamesSet: new Set<string>(),
        spvsSet: new Set<string>(),
      };
      addUniqueToken(acc.storeNamesSet, entry.storeName);
      addUniqueToken(acc.coverAreasSet, entry.coverArea);
      addUniqueToken(acc.regionsSet, entry.region);
      addUniqueToken(acc.salesNamesSet, entry.salesName);
      addUniqueToken(acc.spvsSet, entry.spv);
      mergedBaMap.set(groupKey, acc);
    } else {
      existing.sellOutNonLavojoy += entry.sellOutNonLavojoy;
      existing.sellOutLavojoy += entry.sellOutLavojoy;
      existing.sellOutActual += entry.sellOutActual;
      existing.focusActualPcs += entry.focusActualPcs;

      const storeUpper = entry.storeName.trim().toUpperCase();
      const existingDetail = existing.storeDetails.find(
        (d) => d.storeName.trim().toUpperCase() === storeUpper
      );
      if (existingDetail) {
        existingDetail.sellOutNonLavojoy += entry.sellOutNonLavojoy;
        existingDetail.sellOutLavojoy += entry.sellOutLavojoy;
      } else {
        existing.storeDetails.push(detailItem);
      }

      addUniqueToken(existing.storeNamesSet, entry.storeName);
      addUniqueToken(existing.coverAreasSet, entry.coverArea);
      addUniqueToken(existing.regionsSet, entry.region);
      addUniqueToken(existing.salesNamesSet, entry.salesName);
      addUniqueToken(existing.spvsSet, entry.spv);

      existing.storeName =
        existing.storeNamesSet.size > 0 ? Array.from(existing.storeNamesSet).join(', ') : existing.storeName;
      existing.coverArea =
        existing.coverAreasSet.size > 0 ? Array.from(existing.coverAreasSet).join(', ') : '-';
      existing.region =
        existing.regionsSet.size > 0 ? Array.from(existing.regionsSet).join(', ') : '-';
      existing.salesName =
        existing.salesNamesSet.size > 0 ? Array.from(existing.salesNamesSet).join(', ') : '-';
      existing.spv =
        existing.spvsSet.size > 0 ? Array.from(existing.spvsSet).join(', ') : '-';
    }
  });

  // Load Focus Product Overrides (LocalStorage)
  const focusOverrides = customBaFocusOverrides && Object.keys(customBaFocusOverrides).length > 0
    ? customBaFocusOverrides
    : loadFocusOverrides();
  const focusOverrideUpper = toUpperLookup(focusOverrides);

  const lookupByBaOrStore = <T,>(
    map: Record<string, T>,
    baName: string,
    mergedStoreName: string,
    storeDetails: BaCoveredStoreDetail[]
  ): T | undefined => {
    const baTrim = baName.trim();
    const baUpper = normalizeBaKey(baName);
    if (map[baTrim] !== undefined) return map[baTrim];
    if (map[baUpper] !== undefined) return map[baUpper];
    const storeUpper = mergedStoreName.trim().toUpperCase();
    if (map[mergedStoreName] !== undefined) return map[mergedStoreName];
    if (map[storeUpper] !== undefined) return map[storeUpper];
    for (const sd of storeDetails) {
      const sTrim = sd.storeName.trim();
      const sUp = sTrim.toUpperCase();
      if (map[sTrim] !== undefined) return map[sTrim];
      if (map[sUp] !== undefined) return map[sUp];
    }
    return undefined;
  };

  // Calculate BA Salaries with Focus Product Rules (sudah digabung per Nama BA)
  const baList: BaSalaryItem[] = Array.from(mergedBaMap.values())
    .map((ba) => {
      const targetNonLavojoy =
        lookupByBaOrStore(baNonLavojoyLookup, ba.baName, ba.storeName, ba.storeDetails) ??
        defaultBaNonLavojoyTarget;
      const targetLavojoy =
        lookupByBaOrStore(baLavojoyLookup, ba.baName, ba.storeName, ba.storeDetails) ??
        defaultBaLavojoyTarget;

      const ov =
        lookupByBaOrStore(focusOverrideUpper, ba.baName, ba.storeName, ba.storeDetails) || {};
      const monthFocusTarget = lookupByBaOrStore(
        baFocusTargetLookup,
        ba.baName,
        ba.storeName,
        ba.storeDetails
      );
      const fTarget =
        monthFocusTarget !== undefined && monthFocusTarget > 0
          ? monthFocusTarget
          : ov.targetPcs !== undefined && ov.targetPcs > 0
          ? ov.targetPcs
          : defaultBaFocusTarget;
      const fActual = ov.customActualPcs !== undefined && ov.customActualPcs >= 0 ? ov.customActualPcs : ba.focusActualPcs;

      const suppressFocusPenaltyOnEmpty =
        Boolean(options?.skipEmptyPeriodBaPenalty && baSellOutSource.length === 0 && fActual === 0);

      const salaryItem = calculateBaSalary(
        ba.baName,
        ba.baNumber,
        ba.storeName,
        ba.sellOutNonLavojoy,
        ba.sellOutLavojoy,
        targetNonLavojoy,
        targetLavojoy,
        ba.coverArea,
        ba.region,
        ba.salesName,
        ba.spv,
        fTarget,
        fActual,
        ov.customIncentive,
        suppressFocusPenaltyOnEmpty ? 0 : ov.customPenalty
      );
      salaryItem.storeDetails = ba.storeDetails;
      return salaryItem;
    })
    .sort((a, b) => b.sellOutActual - a.sellOutActual);

  // Map BA per store for sales lookup (mendukung 1 toko dengan 2+ BA)
  const baByStoreLookup: Record<string, BaSalaryItem[]> = {};
  const registerBaStoreLookup = (storeKeyRaw: string, ba: BaSalaryItem) => {
    if (!storeKeyRaw) return;
    const keys = [storeKeyRaw, storeKeyRaw.trim().toUpperCase()];
    for (const k of keys) {
      if (!baByStoreLookup[k]) baByStoreLookup[k] = [];
      if (!baByStoreLookup[k].includes(ba)) {
        baByStoreLookup[k].push(ba);
      }
    }
  };
  for (const ba of baList) {
    registerBaStoreLookup(ba.storeName, ba);
    if (ba.storeDetails) {
      for (const sd of ba.storeDetails) {
        registerBaStoreLookup(sd.storeName, ba);
      }
    }
  }

  const suppressSalesBaPenaltyOnEmpty =
    Boolean(options?.skipEmptyPeriodBaPenalty && baSellOutSource.length === 0);

  // Calculate Sales Salaries with BA Productivity connection
  const salesList: SalesSalaryItem[] = Object.entries(salesMap)
    .map(([sName, data]) => {
      const sUpper = sName.trim().toUpperCase();
      const target = salesTargetLookup[sName] || salesTargetLookup[sUpper] || defaultSalesTarget;

      // Ambil daftar BA yang berada di gerai yang dicover oleh sales ini (mengikuti Weekly Sell Out BA jika aktif)
      const coveredBaForSales: { storeName: string; baName: string; sellOut: number }[] = [];
      const seenBaKeys = new Set<string>();

      if (weeklyBaList) {
        for (const ba of baList) {
          const matchingStores = (ba.storeDetails || []).filter(
            (sd) => sd.salesName.trim().toUpperCase() === sUpper
          );
          const salesTokens = (ba.salesName || '')
            .split(',')
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean);

          if (matchingStores.length > 0 || salesTokens.includes(sUpper)) {
            const baKey = isGenericBaPlaceholder(normalizeBaKey(ba.baName))
              ? ba.storeName.trim().toLowerCase()
              : normalizeBaKey(ba.baName);
            if (!seenBaKeys.has(baKey)) {
              seenBaKeys.add(baKey);
              const useMatchedSubset =
                matchingStores.length > 0 &&
                ba.storeDetails &&
                matchingStores.length < ba.storeDetails.length;
              const storeLabel = useMatchedSubset
                ? matchingStores.map((sd) => sd.storeName).join(', ')
                : ba.storeName;
              const sellOutVal = useMatchedSubset
                ? matchingStores.reduce((acc, sd) => acc + sd.sellOutNonLavojoy + sd.sellOutLavojoy, 0)
                : ba.sellOutActual;
              coveredBaForSales.push({
                storeName: storeLabel,
                baName: ba.baName,
                sellOut: sellOutVal,
              });
            }
          }
        }
      } else {
        data.coveredStores.forEach((storeName) => {
          const basInStore =
            baByStoreLookup[storeName] || baByStoreLookup[storeName.trim().toUpperCase()] || [];
          for (const ba of basInStore) {
            const baKey = isGenericBaPlaceholder(normalizeBaKey(ba.baName))
              ? ba.storeName.trim().toLowerCase()
              : normalizeBaKey(ba.baName);
            if (!seenBaKeys.has(baKey)) {
              seenBaKeys.add(baKey);
              coveredBaForSales.push({
                storeName: ba.storeName,
                baName: ba.baName,
                sellOut: ba.sellOutActual,
              });
            }
          }
        });
      }

      const prodOv = salesProdLookup[sName] || salesProdLookup[sUpper];
      const hasProdOverride =
        prodOv !== undefined &&
        (prodOv.customTotalSellOut !== undefined || prodOv.customBaCount !== undefined);

      // Override jika diset manual (atau cegah denda SP1 semu jika bulan tsb benar-benar kosong data Sell Out)
      const manualBonus =
        salesBonusLookup[sName] !== undefined
          ? salesBonusLookup[sName]
          : salesBonusLookup[sUpper] !== undefined
          ? salesBonusLookup[sUpper]
          : suppressSalesBaPenaltyOnEmpty && !hasProdOverride
          ? 0
          : undefined;
      const manualPenalty =
        salesPenaltyLookup[sName] !== undefined
          ? salesPenaltyLookup[sName]
          : salesPenaltyLookup[sUpper] !== undefined
          ? salesPenaltyLookup[sUpper]
          : suppressSalesBaPenaltyOnEmpty
          ? 0
          : undefined;

      const salaryItem = calculateSalesSalary(
        sName,
        data.sellInActual,
        target,
        data.coverArea,
        data.spv,
        coveredBaForSales,
        manualBonus,
        manualPenalty,
        prodOv?.customTotalSellOut,
        prodOv?.customBaCount
      );

      if (suppressSalesBaPenaltyOnEmpty) {
        salaryItem.baProductivitySpCount = 0;
        salaryItem.coveredBaList = salaryItem.coveredBaList.map((b) => ({
          ...b,
          status: 'normal',
          amount: 0,
          description: 'Belum ada transaksi Sell Out di periode ini',
        }));
      }

      return salaryItem;
    })
    .sort((a, b) => b.sellInActual - a.sellInActual);

  // Load default KPI scores from KPI Trainer Data for the given monthPeriod
  const allKpiTrainerItems = loadKpiTrainerData();
  const kpiMapForPeriod: Record<string, number> = {};
  for (const k of allKpiTrainerItems) {
    if (k.monthPeriod.toUpperCase() === trainerMonthPeriod.toUpperCase()) {
      kpiMapForPeriod[k.trainerName.toLowerCase()] = k.totalScore;
    }
  }

  // Calculate Trainer Salaries (Gaji Pokok Rp 3.9M, Transport Rp 500k, Insentif/Denda Produk Fokus, Insentif/Denda KPI Trainer)
  const trainerDefsToProcess = options?.activeTrainersOnlyFromRecords
    ? activeTrainerDefs.filter((t) => {
        const d = trainerMap[t.trainerName];
        return d && (d.sellOut > 0 || d.focusQty > 0 || trainerSellOutSource.some((r) => getTrainerForRecord(r) === t.trainerName));
      })
    : activeTrainerDefs;

  const trainerList: TrainerSalaryItem[] = trainerDefsToProcess.map((t) => {
    const monthlyTr = trainerMonthlyTargetsOverride?.[t.id] || trainerMonthlyTargetsOverride?.[t.trainerName] || {};
    const resolvedFocusDefault =
      monthlyTr.targetProdukFokusPcs !== undefined && monthlyTr.targetProdukFokusPcs > 0
        ? monthlyTr.targetProdukFokusPcs
        : t.targetProdukFokusPcs;
    const targetFocus = customTrainerFocusTargets[t.trainerName] !== undefined
      ? customTrainerFocusTargets[t.trainerName]
      : resolvedFocusDefault;
    const resolvedSellOutTarget =
      monthlyTr.targetSellOut !== undefined && monthlyTr.targetSellOut > 0
        ? monthlyTr.targetSellOut
        : t.targetSellOut;

    const actualData = trainerMap[t.trainerName] || { focusQty: 0, sellOut: 0 };
    const actualFocus = options?.disableTrainerDummyActualFallback
      ? actualData.focusQty
      : actualData.focusQty > 0
      ? actualData.focusQty
      : Math.round(targetFocus * 0.92);
    const actualSellOut = options?.disableTrainerDummyActualFallback
      ? actualData.sellOut
      : actualData.sellOut > 0
      ? actualData.sellOut
      : Math.round(resolvedSellOutTarget * 0.95);

    // KPI Score lookup: from custom override, or from month's KPI dataset, or fallback
    const kpiScore = customTrainerKpiScores[t.trainerName] !== undefined
      ? customTrainerKpiScores[t.trainerName]
      : (kpiMapForPeriod[t.trainerName.toLowerCase()] ?? 85);

    return calculateTrainerSalary(
      t.trainerName,
      targetFocus,
      actualFocus,
      t.areaCovered,
      t.region,
      actualSellOut,
      resolvedSellOutTarget,
      customTrainerIncentives[t.trainerName],
      customTrainerPenalties[t.trainerName],
      monthlyTr.notes || t.notes,
      kpiScore,
      customTrainerKpiIncentives[t.trainerName],
      customTrainerKpiPenalties[t.trainerName],
      trainerMonthPeriod
    );
  }).sort((a, b) => b.totalSalary - a.totalSalary);

  // Totals
  const totalSalesBase = salesList.reduce((acc, s) => acc + s.baseSalary, 0);
  const totalSalesIncentive = salesList.reduce(
    (acc, s) => acc + s.incentiveNominal + s.baProductivityBonus - s.baProductivityPenalty,
    0
  );
  const totalSalesCost = salesList.reduce((acc, s) => acc + s.totalSalary, 0);

  const totalBaBase = baList.reduce((acc, b) => acc + b.baseSalary, 0);
  const totalBaIncentive = baList.reduce((acc, b) => acc + b.totalIncentiveNominal, 0);
  const totalBaFocusIncentive = baList.reduce((acc, b) => acc + (b.focusIncentive || 0), 0);
  const totalBaFocusPenalty = baList.reduce((acc, b) => acc + (b.focusPenalty || 0), 0);
  const totalBaFocusNetBonus = totalBaFocusIncentive - totalBaFocusPenalty;
  const totalBaCost = baList.reduce((acc, b) => acc + b.totalSalary, 0);

  const totalTrainerBase = trainerList.reduce((acc, t) => acc + t.baseSalary, 0);
  const totalTrainerTransport = trainerList.reduce((acc, t) => acc + t.transportAllowance, 0);
  const totalTrainerFocusIncentive = trainerList.reduce((acc, t) => acc + t.focusIncentive, 0);
  const totalTrainerFocusPenalty = trainerList.reduce((acc, t) => acc + t.focusPenalty, 0);
  const totalTrainerKpiIncentive = trainerList.reduce((acc, t) => acc + t.kpiIncentive, 0);
  const totalTrainerKpiPenalty = trainerList.reduce((acc, t) => acc + t.kpiPenalty, 0);
  const totalTrainerCost = trainerList.reduce((acc, t) => acc + t.totalSalary, 0);

  const totalCost = totalSalesCost + totalBaCost + totalTrainerCost;
  const costToRevenueRatio = totalAreaRevenue > 0 ? (totalCost / totalAreaRevenue) * 100 : 0;

  return {
    totalCost,
    totalSalesCost,
    totalSalesBase,
    totalSalesIncentive,
    totalBaCost,
    totalBaBase,
    totalBaIncentive,
    totalBaFocusIncentive,
    totalBaFocusPenalty,
    totalBaFocusNetBonus,
    totalTrainerCost,
    totalTrainerBase,
    totalTrainerTransport,
    totalTrainerFocusIncentive,
    totalTrainerFocusPenalty,
    totalTrainerKpiIncentive,
    totalTrainerKpiPenalty,
    totalAreaRevenue,
    costToRevenueRatio,
    salesCount: salesList.length,
    baCount: baList.length,
    trainerCount: trainerList.length,
    salesList,
    baList,
    trainerList,
  };
}
