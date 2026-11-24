import {
  TransactionRecord,
  AreaTargetItem,
  SpvTargetItem,
  SalesTargetItem,
  BaTargetItem,
  TrainerTargetItem,
  StoreSellInTargetItem,
  StoreSellInFormulaMode,
  StoreSellInMatrixResult,
  QuarterPeriodKey,
} from '../types/dashboard';
import { calculateSalesSalary } from '../utils/costCalculations';
import { isFocusProduct, getTrainerForRecord } from '../utils/analytics';
import { normalizeStoreAlnum, resolveWeeklyBaStores } from '../utils/weeklyBaRegistry';
import {
  loadFocusOverrides,
  saveFocusOverrides,
  calculateFocusProductIncentivePenalty,
  DEFAULT_FOCUS_TARGET_PCS,
} from './focusProductService';
import { getManualKaMgSellInBreakdown } from './manualKaMgStorage';

export const TARGETS_UPDATED_EVENT = 'salespro-targets-updated';

export function notifyTargetsUpdated(detail?: { monthKey?: string; category?: string }): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TARGETS_UPDATED_EVENT, { detail }));
  }
}

export const STORAGE_KEY_AREA_TARGETS = 'salespro_custom_area_targets';
export const STORAGE_KEY_AREA_SELLOUT_TARGETS = 'salespro_custom_area_sellout_targets_v1';
export const STORAGE_KEY_SPV_TARGETS = 'salespro_custom_spv_targets';
export const STORAGE_KEY_SPV_SELLOUT_TARGETS = 'salespro_custom_spv_sellout_targets_v1';
export const STORAGE_KEY_SALES_TARGETS = 'salespro_custom_sales_targets';
export const STORAGE_KEY_SALES_SELLOUT_TARGETS = 'salespro_custom_sales_sellout_targets_v1';
export const STORAGE_KEY_BA_NON_LAVOJOY = 'salespro_custom_ba_non_lavojoy_targets';
export const STORAGE_KEY_BA_LAVOJOY = 'salespro_custom_ba_lavojoy_targets';
export const STORAGE_KEY_TRAINER_TARGETS = 'salespro_custom_trainer_targets';
export const STORAGE_KEY_MONTHLY_TARGETS = 'salespro_custom_monthly_targets_v2';
export const STORAGE_KEY_CUSTOM_BA_PROFILES = 'salespro_custom_ba_profiles_v1';
export const STORAGE_KEY_STORE_SELLIN_TARGETS = 'salespro_custom_store_sellin_targets_v1';
export const STORAGE_KEY_STORE_SELLIN_POOL = 'salespro_custom_store_sellin_pool_v1';
export const STORAGE_KEY_STORE_SELLIN_MODE = 'salespro_store_sellin_formula_mode_v1';

export const DEFAULT_AREA_TARGET = 300000000; // 300 Jt default per area (Sell In)
export const DEFAULT_AREA_SELLOUT_TARGET = 280000000; // 280 Jt default per area (Sell Out)
export const DEFAULT_SPV_TARGET = 450000000;  // 450 Jt default per SPV (Sell In)
export const DEFAULT_SPV_SELLOUT_TARGET = 420000000;  // 420 Jt default per SPV (Sell Out)
export const DEFAULT_SALES_TARGET = 150000000; // 150 Jt default per sales (Sell In)
export const DEFAULT_SALES_SELLOUT_TARGET = 140000000; // 140 Jt default per sales (Sell Out)
export const DEFAULT_BA_NON_LAVOJOY_TARGET = 30000000; // 30 Jt default
export const DEFAULT_BA_LAVOJOY_TARGET = 5000000; // 5 Jt default
export const DEFAULT_TRAINER_SELL_OUT_TARGET = 350000000; // 350 Jt default sell out
export const DEFAULT_TRAINER_FOCUS_TARGET_PCS = 500; // 500 Pcs default focus

export interface MonthOptionMeta {
  key: string;       // e.g. '2026-01'
  monthIndex: number; // 0-11
  bulanName: string; // e.g. 'JANUARI'
  shortLabel: string; // e.g. 'Jan'
  label: string;     // e.g. 'Januari 2026'
  aliases: string[];
}

export const MONTH_OPTIONS_2026: MonthOptionMeta[] = [
  { key: '2026-01', monthIndex: 0, bulanName: 'JANUARI', shortLabel: 'Jan', label: 'Januari 2026', aliases: ['JANUARI', 'JAN', 'JANUARY', '2026-01'] },
  { key: '2026-02', monthIndex: 1, bulanName: 'FEBRUARI', shortLabel: 'Feb', label: 'Februari 2026', aliases: ['FEBRUARI', 'FEB', 'FEBRUARY', '2026-02'] },
  { key: '2026-03', monthIndex: 2, bulanName: 'MARET', shortLabel: 'Mar', label: 'Maret 2026', aliases: ['MARET', 'MAR', 'MARCH', '2026-03'] },
  { key: '2026-04', monthIndex: 3, bulanName: 'APRIL', shortLabel: 'Apr', label: 'April 2026', aliases: ['APRIL', 'APR', '2026-04'] },
  { key: '2026-05', monthIndex: 4, bulanName: 'MEI', shortLabel: 'Mei', label: 'Mei 2026', aliases: ['MEI', 'MAY', '2026-05'] },
  { key: '2026-06', monthIndex: 5, bulanName: 'JUNI', shortLabel: 'Jun', label: 'Juni 2026', aliases: ['JUNI', 'JUN', 'JUNE', '2026-06'] },
  { key: '2026-07', monthIndex: 6, bulanName: 'JULI', shortLabel: 'Jul', label: 'Juli 2026', aliases: ['JULI', 'JUL', 'JULY', '2026-07'] },
  { key: '2026-08', monthIndex: 7, bulanName: 'AGUSTUS', shortLabel: 'Agu', label: 'Agustus 2026', aliases: ['AGUSTUS', 'AGU', 'AGS', 'AUG', 'AUGUST', '2026-08'] },
  { key: '2026-09', monthIndex: 8, bulanName: 'SEPTEMBER', shortLabel: 'Sep', label: 'September 2026', aliases: ['SEPTEMBER', 'SEP', 'SEPT', '2026-09'] },
  { key: '2026-10', monthIndex: 9, bulanName: 'OKTOBER', shortLabel: 'Okt', label: 'Oktober 2026', aliases: ['OKTOBER', 'OKT', 'OCT', 'OCTOBER', '2026-10'] },
  { key: '2026-11', monthIndex: 10, bulanName: 'NOVEMBER', shortLabel: 'Nov', label: 'November 2026', aliases: ['NOVEMBER', 'NOV', 'NOP', '2026-11'] },
  { key: '2026-12', monthIndex: 11, bulanName: 'DESEMBER', shortLabel: 'Des', label: 'Desember 2026', aliases: ['DESEMBER', 'DES', 'DEC', 'DECEMBER', '2026-12'] },
];

/**
 * Normalizes any month string ('JANUARI', 'OKTOBER 2026', '2026-10', 'ALL')
 * into canonical key ('2026-01'..'2026-12' or 'ALL').
 */
export function normalizeMonthKey(input?: string): string {
  if (!input) return 'ALL';
  const raw = input.trim().toUpperCase();
  if (!raw || raw === 'ALL' || raw === 'SEMUA') return 'ALL';

  // Direct YYYY-MM match
  const isoMatch = raw.match(/^(20\d{2})[-/](\d{1,2})/);
  if (isoMatch) {
    const mNum = parseInt(isoMatch[2], 10);
    if (mNum >= 1 && mNum <= 12) {
      return `2026-${String(mNum).padStart(2, '0')}`;
    }
  }

  for (const m of MONTH_OPTIONS_2026) {
    if (m.aliases.some((alias) => raw === alias || raw.includes(alias))) {
      return m.key;
    }
  }

  return 'ALL';
}

export function getMonthUpperName(monthKey?: string): string {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') return 'ALL';
  const found = MONTH_OPTIONS_2026.find((m) => m.key === norm);
  return found ? found.bulanName : 'ALL';
}

export function getMonthDisplayLabel(monthKey?: string): string {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') return 'Semua Bulan (Baseline)';
  const found = MONTH_OPTIONS_2026.find((m) => m.key === norm);
  return found ? found.label : monthKey || 'Semua Bulan';
}

export function recordMatchesMonth(r: TransactionRecord, selectedMonth?: string): boolean {
  const norm = normalizeMonthKey(selectedMonth);
  if (norm === 'ALL') return true;
  const meta = MONTH_OPTIONS_2026.find((m) => m.key === norm);
  if (!meta) return true;

  const targetMonthNum = meta.monthIndex + 1;
  const paddedMonth = String(targetMonthNum).padStart(2, '0');

  if (r.BULAN) {
    const bUpper = r.BULAN.trim().toUpperCase();
    if (meta.aliases.some((a) => bUpper === a || bUpper.includes(a))) {
      return true;
    }
  }

  if (r.TANGGAL) {
    const t = r.TANGGAL.trim();
    // YYYY-MM-DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(t)) {
      const m = parseInt(t.split(/[-/]/)[1], 10);
      if (m === targetMonthNum) return true;
    } else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(t)) {
      // M/D/YYYY
      const parts = t.split(/[-/]/);
      const first = parseInt(parts[0], 10);
      if (first === targetMonthNum) return true;
    } else if (t.includes(`-${paddedMonth}-`)) {
      return true;
    }
  }

  return false;
}

export interface TrainerTargetConfig {
  id: string;
  trainerName: string;
  areaCovered: string;
  region: string;
  targetSellOut: number;
  targetProdukFokusPcs: number;
  baSupervisedCount?: number;
  notes?: string;
}

export interface CustomBaProfile {
  originalStoreName?: string;
  storeName: string;
  baName: string;
  baNumber?: string;
  coverArea: string;
  region?: string;
  salesName: string;
  spv?: string;
}

export const STORAGE_KEY_TRAINER_LIST = 'salespro_custom_trainer_configs_v3';

export const DEFAULT_TRAINERS: TrainerTargetConfig[] = [
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

export function loadTrainerConfigs(): TrainerTargetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRAINER_LIST);
    if (raw) {
      const parsed: TrainerTargetConfig[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca trainer list dari localStorage', e);
  }
  return DEFAULT_TRAINERS;
}

export function saveTrainerConfigs(trainers: TrainerTargetConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TRAINER_LIST, JSON.stringify(trainers));
    notifyTargetsUpdated({ category: 'trainer_config' });
  } catch (e) {
    console.warn('Gagal menyimpan trainer list ke localStorage', e);
  }
}

export function loadCustomBaProfiles(): Record<string, CustomBaProfile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_BA_PROFILES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomBaProfiles(profiles: Record<string, CustomBaProfile>): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_BA_PROFILES, JSON.stringify(profiles));
    notifyTargetsUpdated({ category: 'ba_profile' });
  } catch {
    // ignore
  }
}

export interface MonthlyTargetBucket {
  area?: Record<string, number>;
  areaSellOut?: Record<string, number>;
  spv?: Record<string, number>;
  spvSellOut?: Record<string, number>;
  sales?: Record<string, number>;
  salesSellOut?: Record<string, number>;
  baNonLavojoy?: Record<string, number>;
  baLavojoy?: Record<string, number>;
  baFocus?: Record<string, number>;
  trainer?: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string }>;
  storeSellIn?: Record<string, number>;
  storeSellInPool?: number;
}

// Structure of monthly targets
export interface MonthlyTargetStore {
  [monthKey: string]: MonthlyTargetBucket;
}

export function loadMonthlyTargets(): MonthlyTargetStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MONTHLY_TARGETS);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveMonthlyTargets(data: MonthlyTargetStore): void {
  try {
    localStorage.setItem(STORAGE_KEY_MONTHLY_TARGETS, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function readGlobalMap(storageKey: string): Record<string, number> {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function writeGlobalMap(storageKey: string, targets: Record<string, number>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(targets));
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------
// Loaders & Savers for Base + Per-Month Targets (Synced Across All Menus)
// -----------------------------------------------------------------------

export function loadAreaTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_AREA_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.area) {
      return { ...base, ...monthly[norm].area };
    }
  }
  return base;
}

export function saveAreaTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].area = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_AREA_TARGETS, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'area' });
}

export function loadAreaSellOutTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_AREA_SELLOUT_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.areaSellOut) {
      return { ...base, ...monthly[norm].areaSellOut };
    }
  }
  return base;
}

export function saveAreaSellOutTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].areaSellOut = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_AREA_SELLOUT_TARGETS, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'area_sellout' });
}

export function loadSpvTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_SPV_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.spv) {
      return { ...base, ...monthly[norm].spv };
    }
  }
  return base;
}

export function saveSpvTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].spv = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_SPV_TARGETS, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'spv' });
}

export function loadSpvSellOutTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_SPV_SELLOUT_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.spvSellOut) {
      return { ...base, ...monthly[norm].spvSellOut };
    }
  }
  return base;
}

export function saveSpvSellOutTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].spvSellOut = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_SPV_SELLOUT_TARGETS, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'spv_sellout' });
}

export function getExplicitSpvTargetOverride(spvName: string, monthKey?: string): number | undefined {
  const norm = normalizeMonthKey(monthKey);
  const upperSpv = spvName.toUpperCase().trim();
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    const bucket = monthly[norm]?.spv;
    if (bucket) {
      if (bucket[spvName] !== undefined) return bucket[spvName];
      const matchKey = Object.keys(bucket).find((k) => k.toUpperCase().trim() === upperSpv);
      if (matchKey !== undefined) return bucket[matchKey];
    }
  }
  const globalSpv = readGlobalMap(STORAGE_KEY_SPV_TARGETS);
  if (globalSpv[spvName] !== undefined) return globalSpv[spvName];
  const gMatch = Object.keys(globalSpv).find((k) => k.toUpperCase().trim() === upperSpv);
  return gMatch !== undefined ? globalSpv[gMatch] : undefined;
}

export function loadSalesTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_SALES_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.sales) {
      return { ...base, ...monthly[norm].sales };
    }
  }
  return base;
}

export function saveSalesTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].sales = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_SALES_TARGETS, targets);
  }
  clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  notifyTargetsUpdated({ monthKey: norm, category: 'sales' });
}

export function loadSalesSellOutTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.salesSellOut) {
      return { ...base, ...monthly[norm].salesSellOut };
    }
  }
  return base;
}

export function saveSalesSellOutTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].salesSellOut = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'sales_sellout' });
}

export function loadBaNonLavojoyTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.baNonLavojoy) {
      return { ...base, ...monthly[norm].baNonLavojoy };
    }
  }
  return base;
}

export function saveBaNonLavojoyTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].baNonLavojoy = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'ba_non' });
}

export function loadBaLavojoyTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_BA_LAVOJOY);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.baLavojoy) {
      return { ...base, ...monthly[norm].baLavojoy };
    }
  }
  return base;
}

export function saveBaLavojoyTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].baLavojoy = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_BA_LAVOJOY, targets);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'ba_lav' });
}

export function getExplicitBaTotalTargetOverride(storeName: string, monthKey?: string, baName?: string): number | undefined {
  const nonTargets = loadBaNonLavojoyTargets(monthKey);
  const lavTargets = loadBaLavojoyTargets(monthKey);

  const nonVal = lookupBaMapValue(nonTargets, baName || '', storeName, storeName ? storeName.split(',').map((s) => s.trim()).filter(Boolean) : []);
  const lavVal = lookupBaMapValue(lavTargets, baName || '', storeName, storeName ? storeName.split(',').map((s) => s.trim()).filter(Boolean) : []);

  if (nonVal === undefined && lavVal === undefined) return undefined;
  return (nonVal !== undefined ? nonVal : DEFAULT_BA_NON_LAVOJOY_TARGET) + (lavVal !== undefined ? lavVal : DEFAULT_BA_LAVOJOY_TARGET);
}

export function loadBaFocusTargets(monthKey?: string): Record<string, number> {
  const focusOverrides = loadFocusOverrides();
  const base: Record<string, number> = {};
  Object.entries(focusOverrides).forEach(([k, v]) => {
    if (v && v.targetPcs !== undefined && v.targetPcs > 0) {
      base[k] = v.targetPcs;
    }
  });
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.baFocus) {
      return { ...base, ...monthly[norm].baFocus };
    }
  }
  return base;
}

export function saveBaFocusTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].baFocus = targets;
    saveMonthlyTargets(monthly);
    notifyTargetsUpdated({ monthKey: norm, category: 'ba_focus' });
  } else {
    const current = loadFocusOverrides();
    Object.entries(targets).forEach(([storeKey, targetPcs]) => {
      if (!current[storeKey]) current[storeKey] = { storeName: storeKey };
      current[storeKey].targetPcs = targetPcs;
    });
    saveFocusOverrides(current);
  }
}

export function loadTrainerTargets(
  monthKey?: string
): Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string }> {
  let base: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string }> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TRAINER_TARGETS);
    base = saved ? JSON.parse(saved) : {};
  } catch {
    base = {};
  }
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.trainer) {
      const merged: typeof base = { ...base };
      Object.entries(monthly[norm].trainer!).forEach(([k, v]) => {
        merged[k] = { ...(merged[k] || {}), ...v };
      });
      return merged;
    }
  }
  return base;
}

export function saveTrainerTargets(
  targets: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string }>,
  monthKey?: string
): void {
  const norm = normalizeMonthKey(monthKey);
  try {
    if (norm !== 'ALL') {
      const monthly = loadMonthlyTargets();
      if (!monthly[norm]) monthly[norm] = {};
      monthly[norm].trainer = targets;
      saveMonthlyTargets(monthly);
    } else {
      localStorage.setItem(STORAGE_KEY_TRAINER_TARGETS, JSON.stringify(targets));
    }
    notifyTargetsUpdated({ monthKey: norm, category: 'trainer' });
  } catch {
    // ignore
  }
}

export type SingleTargetCategory =
  | 'area'
  | 'areaSellOut'
  | 'spv'
  | 'spvSellOut'
  | 'sales'
  | 'salesSellOut'
  | 'baNonLavojoy'
  | 'baLavojoy'
  | 'baFocus';

/**
 * Sets ONLY a single key in either the month's override bucket (preserving inheritance
 * for all untouched keys) or in the global baseline map when monthKey === 'ALL'.
 */
export function setSingleTargetOverride(
  category: SingleTargetCategory,
  entityKey: string,
  value: number,
  monthKey?: string
): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') {
    if (category === 'baFocus') {
      const current = loadFocusOverrides();
      const upperTarget = entityKey.trim().toUpperCase();
      const matchedKey = Object.keys(current).find((k) => k.trim().toUpperCase() === upperTarget);
      const targetKey = matchedKey || entityKey;
      if (!current[targetKey]) current[targetKey] = { storeName: targetKey };
      current[targetKey].targetPcs = value;
      saveFocusOverrides(current);
      return;
    }
    const keyMap: Record<Exclude<SingleTargetCategory, 'baFocus'>, string> = {
      area: STORAGE_KEY_AREA_TARGETS,
      areaSellOut: STORAGE_KEY_AREA_SELLOUT_TARGETS,
      spv: STORAGE_KEY_SPV_TARGETS,
      spvSellOut: STORAGE_KEY_SPV_SELLOUT_TARGETS,
      sales: STORAGE_KEY_SALES_TARGETS,
      salesSellOut: STORAGE_KEY_SALES_SELLOUT_TARGETS,
      baNonLavojoy: STORAGE_KEY_BA_NON_LAVOJOY,
      baLavojoy: STORAGE_KEY_BA_LAVOJOY,
    };
    const current = readGlobalMap(keyMap[category]);
    current[entityKey] = value;
    writeGlobalMap(keyMap[category], current);
    notifyTargetsUpdated({ monthKey: 'ALL', category });
    return;
  }

  const monthly = loadMonthlyTargets();
  if (!monthly[norm]) monthly[norm] = {};
  if (!monthly[norm][category]) monthly[norm][category] = {};
  monthly[norm][category]![entityKey] = value;
  if (category === 'sales') {
    clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  }
  saveMonthlyTargets(monthly);
  notifyTargetsUpdated({ monthKey: norm, category });
}

export function setSingleTrainerTargetOverride(
  trainerId: string,
  patch: { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string },
  monthKey?: string
): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') {
    const current = loadTrainerTargets('ALL');
    current[trainerId] = { ...(current[trainerId] || {}), ...patch };
    saveTrainerTargets(current, 'ALL');
    return;
  }
  const monthly = loadMonthlyTargets();
  if (!monthly[norm]) monthly[norm] = {};
  if (!monthly[norm].trainer) monthly[norm].trainer = {};
  monthly[norm].trainer![trainerId] = {
    ...(monthly[norm].trainer![trainerId] || {}),
    ...patch,
  };
  saveMonthlyTargets(monthly);
  notifyTargetsUpdated({ monthKey: norm, category: 'trainer' });
}

function upsertCaseInsensitiveKey(map: Record<string, number>, targetKey: string, value: number): void {
  const upperTarget = targetKey.trim().toUpperCase();
  Object.keys(map).forEach((k) => {
    if (k.trim().toUpperCase() === upperTarget && k !== targetKey) {
      delete map[k];
    }
  });
  map[targetKey] = value;
}

/**
 * Sets a single Sales person's 1-month targets (Sell In & Sell Out)
 * identically across the global baseline and all 12 months (Jan - Des 2026).
 */
export function applySingleSalesTargetToAllMonths(
  salesName: string,
  values: { targetSellIn?: number; targetSellOut?: number }
): void {
  const globalIn = readGlobalMap(STORAGE_KEY_SALES_TARGETS);
  const globalOut = readGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS);
  const monthly = loadMonthlyTargets();

  if (values.targetSellIn !== undefined) {
    upsertCaseInsensitiveKey(globalIn, salesName, values.targetSellIn);
  }
  if (values.targetSellOut !== undefined) {
    upsertCaseInsensitiveKey(globalOut, salesName, values.targetSellOut);
  }

  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    if (values.targetSellIn !== undefined) {
      if (!monthly[m.key].sales) monthly[m.key].sales = {};
      upsertCaseInsensitiveKey(monthly[m.key].sales!, salesName, values.targetSellIn);
    }
    if (values.targetSellOut !== undefined) {
      if (!monthly[m.key].salesSellOut) monthly[m.key].salesSellOut = {};
      upsertCaseInsensitiveKey(monthly[m.key].salesSellOut!, salesName, values.targetSellOut);
    }
  });

  writeGlobalMap(STORAGE_KEY_SALES_TARGETS, globalIn);
  writeGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS, globalOut);
  saveMonthlyTargets(monthly);
  if (values.targetSellIn !== undefined) {
    clearBaQuarterlySellInOverridesForMonths();
  }
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'sales_all_months' });
}

/**
 * Copies ONLY Sales targets (Sell In & Sell Out) from one source month
 * into all 12 months (Jan - Des 2026) and the global baseline.
 */
export function copySalesTargetsToAllMonths(
  sourceMonthKey: string,
  records: TransactionRecord[] = []
): { salesCount: number; monthCount: number } {
  const srcNorm = normalizeMonthKey(sourceMonthKey);
  const srcMatrix = aggregateTargetMatrix(records, srcNorm, { singleMonthBaselineOnly: true });

  const salesInMap: Record<string, number> = {};
  const salesOutMap: Record<string, number> = {};

  srcMatrix.sales.forEach((sl) => {
    salesInMap[sl.salesName] = sl.targetSellIn;
    salesOutMap[sl.salesName] = sl.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET;
  });

  const globalIn = readGlobalMap(STORAGE_KEY_SALES_TARGETS);
  const globalOut = readGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS);
  Object.entries(salesInMap).forEach(([k, v]) => upsertCaseInsensitiveKey(globalIn, k, v));
  Object.entries(salesOutMap).forEach(([k, v]) => upsertCaseInsensitiveKey(globalOut, k, v));
  writeGlobalMap(STORAGE_KEY_SALES_TARGETS, globalIn);
  writeGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS, globalOut);

  const monthly = loadMonthlyTargets();
  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    monthly[m.key].sales = { ...(monthly[m.key].sales || {}), ...salesInMap };
    monthly[m.key].salesSellOut = { ...(monthly[m.key].salesSellOut || {}), ...salesOutMap };
  });
  saveMonthlyTargets(monthly);
  clearBaQuarterlySellInOverridesForMonths();
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'sales_all_months' });

  return {
    salesCount: srcMatrix.sales.length,
    monthCount: MONTH_OPTIONS_2026.length,
  };
}

/**
 * Applies a list of per-Sales 1-month targets (Sell In &/or Sell Out) either to currentMonthKey
 * or identically across all 12 months (Jan - Des 2026) + global baseline.
 */
export function applyBulkSalesTargets(
  salesRows: Array<{ salesName: string; targetSellIn?: number; targetSellOut?: number }>,
  scope: 'current' | 'ALL_MONTHS',
  currentMonthKey?: string
): void {
  if (scope === 'current') {
    const norm = normalizeMonthKey(currentMonthKey);
    const inMap = loadSalesTargets(norm);
    const outMap = loadSalesSellOutTargets(norm);
    let hasIn = false;
    let hasOut = false;

    salesRows.forEach((row) => {
      if (row.targetSellIn !== undefined) {
        upsertCaseInsensitiveKey(inMap, row.salesName, row.targetSellIn);
        hasIn = true;
      }
      if (row.targetSellOut !== undefined) {
        upsertCaseInsensitiveKey(outMap, row.salesName, row.targetSellOut);
        hasOut = true;
      }
    });

    if (hasIn) saveSalesTargets(inMap, norm);
    if (hasOut) saveSalesSellOutTargets(outMap, norm);
    return;
  }

  const globalIn = readGlobalMap(STORAGE_KEY_SALES_TARGETS);
  const globalOut = readGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS);
  const monthly = loadMonthlyTargets();

  salesRows.forEach((row) => {
    if (row.targetSellIn !== undefined) {
      upsertCaseInsensitiveKey(globalIn, row.salesName, row.targetSellIn);
    }
    if (row.targetSellOut !== undefined) {
      upsertCaseInsensitiveKey(globalOut, row.salesName, row.targetSellOut);
    }
  });

  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    salesRows.forEach((row) => {
      if (row.targetSellIn !== undefined) {
        if (!monthly[m.key].sales) monthly[m.key].sales = {};
        upsertCaseInsensitiveKey(monthly[m.key].sales!, row.salesName, row.targetSellIn);
      }
      if (row.targetSellOut !== undefined) {
        if (!monthly[m.key].salesSellOut) monthly[m.key].salesSellOut = {};
        upsertCaseInsensitiveKey(monthly[m.key].salesSellOut!, row.salesName, row.targetSellOut);
      }
    });
  });

  writeGlobalMap(STORAGE_KEY_SALES_TARGETS, globalIn);
  writeGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS, globalOut);
  saveMonthlyTargets(monthly);
  if (salesRows.some((row) => row.targetSellIn !== undefined)) {
    clearBaQuarterlySellInOverridesForMonths();
  }
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'sales_all_months' });
}

/**
 * Sets a single BA's 1-month targets (Non-Lavojoy, Lavojoy, Produk Fokus Pcs)
 * identically across the global baseline and all 12 months (Jan - Des 2026).
 */
export function applySingleBaTargetToAllMonths(
  storeKey: string,
  values: { targetNonLavojoy?: number; targetLavojoy?: number; targetFocusPcs?: number }
): void {
  const globalNon = readGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY);
  const globalLav = readGlobalMap(STORAGE_KEY_BA_LAVOJOY);
  const ov = loadFocusOverrides();
  const monthly = loadMonthlyTargets();

  if (values.targetNonLavojoy !== undefined) {
    upsertCaseInsensitiveKey(globalNon, storeKey, values.targetNonLavojoy);
  }
  if (values.targetLavojoy !== undefined) {
    upsertCaseInsensitiveKey(globalLav, storeKey, values.targetLavojoy);
  }
  if (values.targetFocusPcs !== undefined) {
    if (!ov[storeKey]) ov[storeKey] = { storeName: storeKey };
    ov[storeKey].targetPcs = values.targetFocusPcs;
  }

  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    if (values.targetNonLavojoy !== undefined) {
      if (!monthly[m.key].baNonLavojoy) monthly[m.key].baNonLavojoy = {};
      upsertCaseInsensitiveKey(monthly[m.key].baNonLavojoy!, storeKey, values.targetNonLavojoy);
    }
    if (values.targetLavojoy !== undefined) {
      if (!monthly[m.key].baLavojoy) monthly[m.key].baLavojoy = {};
      upsertCaseInsensitiveKey(monthly[m.key].baLavojoy!, storeKey, values.targetLavojoy);
    }
    if (values.targetFocusPcs !== undefined) {
      if (!monthly[m.key].baFocus) monthly[m.key].baFocus = {};
      upsertCaseInsensitiveKey(monthly[m.key].baFocus!, storeKey, values.targetFocusPcs);
    }
  });

  writeGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY, globalNon);
  writeGlobalMap(STORAGE_KEY_BA_LAVOJOY, globalLav);
  if (values.targetFocusPcs !== undefined) {
    saveFocusOverrides(ov);
  }
  saveMonthlyTargets(monthly);
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'ba_all_months' });
}

/**
 * Copies ONLY BA targets (Non-Lavojoy, Lavojoy, Produk Fokus Pcs) from one source month
 * into all 12 months (Jan - Des 2026) and the global baseline so every month has the exact same BA targets.
 */
export function copyBaTargetsToAllMonths(
  sourceMonthKey: string,
  records: TransactionRecord[] = []
): { baCount: number; monthCount: number } {
  const srcNorm = normalizeMonthKey(sourceMonthKey);
  const srcMatrix = aggregateTargetMatrix(records, srcNorm, { singleMonthBaselineOnly: true });

  const baNonMap: Record<string, number> = {};
  const baLavMap: Record<string, number> = {};
  const baFocusMap: Record<string, number> = {};

  srcMatrix.bas.forEach((b) => {
    const baKey = b.baName || b.storeName;
    baNonMap[baKey] = b.targetNonLavojoy;
    baLavMap[baKey] = b.targetLavojoy;
    baFocusMap[baKey] = b.targetFocusPcs;
  });

  const globalNon = readGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY);
  const globalLav = readGlobalMap(STORAGE_KEY_BA_LAVOJOY);
  Object.entries(baNonMap).forEach(([k, v]) => upsertCaseInsensitiveKey(globalNon, k, v));
  Object.entries(baLavMap).forEach(([k, v]) => upsertCaseInsensitiveKey(globalLav, k, v));
  writeGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY, globalNon);
  writeGlobalMap(STORAGE_KEY_BA_LAVOJOY, globalLav);

  const ov = loadFocusOverrides();
  Object.entries(baFocusMap).forEach(([k, pcs]) => {
    if (!ov[k]) ov[k] = { storeName: k };
    ov[k].targetPcs = pcs;
  });
  saveFocusOverrides(ov);

  const monthly = loadMonthlyTargets();
  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    monthly[m.key].baNonLavojoy = { ...(monthly[m.key].baNonLavojoy || {}), ...baNonMap };
    monthly[m.key].baLavojoy = { ...(monthly[m.key].baLavojoy || {}), ...baLavMap };
    monthly[m.key].baFocus = { ...(monthly[m.key].baFocus || {}), ...baFocusMap };
  });
  saveMonthlyTargets(monthly);
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'ba_all_months' });

  return {
    baCount: srcMatrix.bas.length,
    monthCount: MONTH_OPTIONS_2026.length,
  };
}

/**
 * Applies uniform 1-month BA targets across all listed BA stores either to the current month
 * or identically to all 12 months (Jan - Des 2026) + global baseline.
 */
export function applyUniformBaTargets(
  storeKeys: string[],
  values: { targetNonLavojoy?: number; targetLavojoy?: number; targetFocusPcs?: number },
  scope: 'current' | 'ALL_MONTHS',
  currentMonthKey?: string
): void {
  if (scope === 'current') {
    const norm = normalizeMonthKey(currentMonthKey);
    if (values.targetNonLavojoy !== undefined) {
      const nextMap: Record<string, number> = {};
      storeKeys.forEach((k) => {
        nextMap[k] = values.targetNonLavojoy!;
      });
      saveBaNonLavojoyTargets(nextMap, norm);
    }
    if (values.targetLavojoy !== undefined) {
      const nextMap: Record<string, number> = {};
      storeKeys.forEach((k) => {
        nextMap[k] = values.targetLavojoy!;
      });
      saveBaLavojoyTargets(nextMap, norm);
    }
    if (values.targetFocusPcs !== undefined) {
      const nextMap: Record<string, number> = {};
      storeKeys.forEach((k) => {
        nextMap[k] = values.targetFocusPcs!;
      });
      saveBaFocusTargets(nextMap, norm);
    }
    return;
  }

  const globalNon = readGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY);
  const globalLav = readGlobalMap(STORAGE_KEY_BA_LAVOJOY);
  const ov = loadFocusOverrides();
  const monthly = loadMonthlyTargets();

  storeKeys.forEach((storeKey) => {
    if (values.targetNonLavojoy !== undefined) {
      upsertCaseInsensitiveKey(globalNon, storeKey, values.targetNonLavojoy);
    }
    if (values.targetLavojoy !== undefined) {
      upsertCaseInsensitiveKey(globalLav, storeKey, values.targetLavojoy);
    }
    if (values.targetFocusPcs !== undefined) {
      if (!ov[storeKey]) ov[storeKey] = { storeName: storeKey };
      ov[storeKey].targetPcs = values.targetFocusPcs;
    }
  });

  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    storeKeys.forEach((storeKey) => {
      if (values.targetNonLavojoy !== undefined) {
        if (!monthly[m.key].baNonLavojoy) monthly[m.key].baNonLavojoy = {};
        upsertCaseInsensitiveKey(monthly[m.key].baNonLavojoy!, storeKey, values.targetNonLavojoy);
      }
      if (values.targetLavojoy !== undefined) {
        if (!monthly[m.key].baLavojoy) monthly[m.key].baLavojoy = {};
        upsertCaseInsensitiveKey(monthly[m.key].baLavojoy!, storeKey, values.targetLavojoy);
      }
      if (values.targetFocusPcs !== undefined) {
        if (!monthly[m.key].baFocus) monthly[m.key].baFocus = {};
        upsertCaseInsensitiveKey(monthly[m.key].baFocus!, storeKey, values.targetFocusPcs);
      }
    });
  });

  writeGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY, globalNon);
  writeGlobalMap(STORAGE_KEY_BA_LAVOJOY, globalLav);
  if (values.targetFocusPcs !== undefined) {
    saveFocusOverrides(ov);
  }
  saveMonthlyTargets(monthly);
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'ba_all_months' });
}

/**
 * Copies all effective targets from sourceMonthKey into each destination month in targetMonthKeys.
 */
export function copyMonthTargets(
  sourceMonthKey: string,
  targetMonthKeys: string[],
  records: TransactionRecord[] = []
): number {
  const srcNorm = normalizeMonthKey(sourceMonthKey);
  const srcMatrix = aggregateTargetMatrix(records, srcNorm, { singleMonthBaselineOnly: true });

  const areaMap: Record<string, number> = {};
  const areaSellOutMap: Record<string, number> = {};
  srcMatrix.areas.forEach((a) => {
    areaMap[a.coverArea] = a.targetOmzet;
    areaSellOutMap[a.coverArea] = a.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET;
  });

  const spvMap: Record<string, number> = {};
  const spvSellOutMap: Record<string, number> = {};
  srcMatrix.spvs.forEach((s) => {
    spvMap[s.spvName] = s.targetOmzet;
    spvSellOutMap[s.spvName] = s.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET;
  });

  const salesInMap: Record<string, number> = {};
  const salesOutMap: Record<string, number> = {};
  srcMatrix.sales.forEach((sl) => {
    salesInMap[sl.salesName] = sl.targetSellIn;
    salesOutMap[sl.salesName] = sl.targetSellOut ?? DEFAULT_SALES_SELLOUT_TARGET;
  });

  const baNonMap: Record<string, number> = {};
  const baLavMap: Record<string, number> = {};
  const baFocusMap: Record<string, number> = {};
  srcMatrix.bas.forEach((b) => {
    const baKey = b.baName || b.storeName;
    baNonMap[baKey] = b.targetNonLavojoy;
    baLavMap[baKey] = b.targetLavojoy;
    baFocusMap[baKey] = b.targetFocusPcs;
  });

  const trainerMap: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string }> = {};
  srcMatrix.trainers.forEach((t) => {
    trainerMap[t.id] = {
      targetSellOut: t.targetSellOut,
      targetProdukFokusPcs: t.targetProdukFokusPcs,
      baSupervisedCount: t.baSupervisedCount,
      notes: t.notes,
    };
  });

  const monthly = loadMonthlyTargets();
  let updatedCount = 0;

  const existingStoreSellIn = monthly[srcNorm]?.storeSellIn
    ? { ...monthly[srcNorm].storeSellIn }
    : undefined;
  const existingStoreSellInPool = monthly[srcNorm]?.storeSellInPool;

  targetMonthKeys.forEach((dest) => {
    const destNorm = normalizeMonthKey(dest);
    if (destNorm === 'ALL') {
      writeGlobalMap(STORAGE_KEY_AREA_TARGETS, areaMap);
      writeGlobalMap(STORAGE_KEY_AREA_SELLOUT_TARGETS, areaSellOutMap);
      writeGlobalMap(STORAGE_KEY_SPV_TARGETS, spvMap);
      writeGlobalMap(STORAGE_KEY_SPV_SELLOUT_TARGETS, spvSellOutMap);
      writeGlobalMap(STORAGE_KEY_SALES_TARGETS, salesInMap);
      writeGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS, salesOutMap);
      writeGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY, baNonMap);
      writeGlobalMap(STORAGE_KEY_BA_LAVOJOY, baLavMap);
      localStorage.setItem(STORAGE_KEY_TRAINER_TARGETS, JSON.stringify(trainerMap));
      if (existingStoreSellIn) {
        writeGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS, existingStoreSellIn);
      }
      if (existingStoreSellInPool !== undefined) {
        localStorage.setItem(STORAGE_KEY_STORE_SELLIN_POOL, String(existingStoreSellInPool));
      }
      const ov = loadFocusOverrides();
      Object.entries(baFocusMap).forEach(([k, pcs]) => {
        if (!ov[k]) ov[k] = { storeName: k };
        ov[k].targetPcs = pcs;
      });
      saveFocusOverrides(ov);
      updatedCount++;
    } else if (destNorm !== srcNorm) {
      monthly[destNorm] = {
        area: { ...areaMap },
        areaSellOut: { ...areaSellOutMap },
        spv: { ...spvMap },
        spvSellOut: { ...spvSellOutMap },
        sales: { ...salesInMap },
        salesSellOut: { ...salesOutMap },
        baNonLavojoy: { ...baNonMap },
        baLavojoy: { ...baLavMap },
        baFocus: { ...baFocusMap },
        trainer: JSON.parse(JSON.stringify(trainerMap)),
        ...(existingStoreSellIn ? { storeSellIn: { ...existingStoreSellIn } } : {}),
        ...(existingStoreSellInPool !== undefined ? { storeSellInPool: existingStoreSellInPool } : {}),
      };
      updatedCount++;
    }
  });

  saveMonthlyTargets(monthly);
  clearBaQuarterlySellInOverridesForMonths(targetMonthKeys);
  notifyTargetsUpdated({ category: 'copy_month' });
  return updatedCount;
}

export function resetMonthTargets(monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') {
    localStorage.removeItem(STORAGE_KEY_AREA_TARGETS);
    localStorage.removeItem(STORAGE_KEY_AREA_SELLOUT_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SPV_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SPV_SELLOUT_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SALES_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SALES_SELLOUT_TARGETS);
    localStorage.removeItem(STORAGE_KEY_BA_NON_LAVOJOY);
    localStorage.removeItem(STORAGE_KEY_BA_LAVOJOY);
    localStorage.removeItem(STORAGE_KEY_TRAINER_TARGETS);
    localStorage.removeItem(STORAGE_KEY_MONTHLY_TARGETS);
    localStorage.removeItem(STORAGE_KEY_CUSTOM_BA_PROFILES);
    localStorage.removeItem(STORAGE_KEY_STORE_SELLIN_TARGETS);
    localStorage.removeItem(STORAGE_KEY_STORE_SELLIN_POOL);
    localStorage.removeItem(STORAGE_KEY_STORE_SELLIN_MODE);
    localStorage.removeItem('salespro_ba_focus_overrides_v2');
    clearBaQuarterlySellInOverridesForMonths();
  } else {
    const monthly = loadMonthlyTargets();
    delete monthly[norm];
    saveMonthlyTargets(monthly);
    clearBaQuarterlySellInOverridesForMonths([norm]);
  }
  notifyTargetsUpdated({ monthKey: norm, category: 'reset' });
}

export function getMonthCustomizationSummary(): Record<string, number> {
  const monthly = loadMonthlyTargets();
  const counts: Record<string, number> = {};

  MONTH_OPTIONS_2026.forEach((m) => {
    const bucket = monthly[m.key];
    if (!bucket) {
      counts[m.key] = 0;
      return;
    }
    counts[m.key] =
      Object.keys(bucket.area || {}).length +
      Object.keys(bucket.areaSellOut || {}).length +
      Object.keys(bucket.spv || {}).length +
      Object.keys(bucket.spvSellOut || {}).length +
      Object.keys(bucket.sales || {}).length +
      Object.keys(bucket.salesSellOut || {}).length +
      Object.keys(bucket.baNonLavojoy || {}).length +
      Object.keys(bucket.baLavojoy || {}).length +
      Object.keys(bucket.baFocus || {}).length +
      Object.keys(bucket.trainer || {}).length +
      Object.keys(bucket.storeSellIn || {}).length +
      (bucket.storeSellInPool !== undefined ? 1 : 0);
  });

  counts['ALL'] =
    Object.keys(readGlobalMap(STORAGE_KEY_AREA_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_AREA_SELLOUT_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SPV_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SPV_SELLOUT_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SALES_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_BA_LAVOJOY)).length +
    Object.keys(loadTrainerTargets('ALL')).length +
    Object.keys(readGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS)).length +
    (readGlobalStoreSellInPool() !== undefined ? 1 : 0);

  return counts;
}

export function getConfiguredMonthKeys(): string[] {
  const monthly = loadMonthlyTargets();
  return MONTH_OPTIONS_2026
    .map((m) => m.key)
    .filter((key) => {
      const bucket = monthly[key];
      if (!bucket) return false;
      return (
        Object.keys(bucket.area || {}).length > 0 ||
        Object.keys(bucket.areaSellOut || {}).length > 0 ||
        Object.keys(bucket.spv || {}).length > 0 ||
        Object.keys(bucket.spvSellOut || {}).length > 0 ||
        Object.keys(bucket.sales || {}).length > 0 ||
        Object.keys(bucket.salesSellOut || {}).length > 0 ||
        Object.keys(bucket.baNonLavojoy || {}).length > 0 ||
        Object.keys(bucket.baLavojoy || {}).length > 0 ||
        Object.keys(bucket.baFocus || {}).length > 0 ||
        Object.keys(bucket.trainer || {}).length > 0 ||
        Object.keys(bucket.storeSellIn || {}).length > 0 ||
        bucket.storeSellInPool !== undefined
      );
    });
}

function findMapValueCaseInsensitive<T>(map: Record<string, T> | undefined, key: string): T | undefined {
  if (!map || !key) return undefined;
  if (map[key] !== undefined) return map[key];
  const upperKey = key.trim().toUpperCase();
  if (map[upperKey] !== undefined) return map[upperKey];
  const matchedKey = Object.keys(map).find((k) => k.trim().toUpperCase() === upperKey);
  return matchedKey !== undefined ? map[matchedKey] : undefined;
}

function normalizeBaGroupKey(name?: string): string {
  return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function isGenericBaPlaceholder(normKey: string): boolean {
  return (
    !normKey ||
    normKey === '-' ||
    normKey === 'NON BA' ||
    normKey === 'NON-BA' ||
    normKey === 'NONBA' ||
    normKey === '- (NON-BA)' ||
    normKey === 'TANPA BA' ||
    normKey === '- (TANPA BA)' ||
    normKey === 'STANDBY' ||
    normKey === 'BA STANDBY' ||
    normKey === 'BA COUNTER' ||
    normKey === 'BA TOKO' ||
    normKey === 'BA GUARDIAN' ||
    normKey === 'BA MISS' ||
    normKey === 'BA WATSON' ||
    normKey === 'BA SWALAYAN' ||
    normKey === 'BA APOTEK' ||
    normKey === 'BA WARUNG' ||
    normKey === 'BA KIOS' ||
    normKey === 'BA MART' ||
    normKey === 'BA GROSIR' ||
    normKey === 'BA KOSMETIK' ||
    normKey === 'BA COSMETIC' ||
    normKey === 'KOSONG' ||
    normKey === 'VACANT' ||
    normKey === 'EMPTY' ||
    normKey === 'ALL' ||
    normKey === 'NONE' ||
    normKey === 'NO BA' ||
    normKey === 'TIDAK ADA' ||
    normKey === 'TIDAK ADA BA' ||
    normKey === 'TIDAK DIKETAHUI' ||
    normKey === 'UNKNOWN' ||
    normKey === 'N/A' ||
    normKey === 'NULL' ||
    normKey === 'UNDEFINED'
  );
}

function addUniqueTokenToSet(set: Set<string>, rawValue?: string): void {
  const clean = (rawValue || '').trim();
  if (!clean || clean === '-' || clean.toUpperCase() === 'UNKNOWN') return;
  for (const part of clean.split(',')) {
    const p = part.trim();
    if (!p || p === '-' || p.toUpperCase() === 'UNKNOWN') continue;
    const upper = p.toUpperCase();
    const exists = Array.from(set).some((x) => x.trim().toUpperCase() === upper);
    if (!exists) set.add(p);
  }
}

function lookupBaMapValue<T>(
  map: Record<string, T> | undefined,
  baName: string,
  mergedStoreName: string,
  storeNames: string[]
): T | undefined {
  if (!map) return undefined;
  const cleanBa = normalizeBaGroupKey(baName);
  if (cleanBa && !isGenericBaPlaceholder(cleanBa)) {
    const byBa = findMapValueCaseInsensitive(map, baName) ?? findMapValueCaseInsensitive(map, cleanBa);
    if (byBa !== undefined) return byBa;
  }
  if (mergedStoreName) {
    const byMerged = findMapValueCaseInsensitive(map, mergedStoreName);
    if (byMerged !== undefined) return byMerged;
  }
  for (const s of storeNames) {
    const byStore = findMapValueCaseInsensitive(map, s);
    if (byStore !== undefined) return byStore;
  }
  return undefined;
}

export interface TargetMatrixData {
  areas: AreaTargetItem[];
  spvs: SpvTargetItem[];
  sales: SalesTargetItem[];
  bas: BaTargetItem[];
  trainers: TrainerTargetItem[];
  summary: {
    totalAreaTarget: number;
    totalAreaActual: number;
    areaAchievementPct: number;
    totalAreaTargetSellOut: number;
    totalAreaActualSellOut: number;
    areaSellOutAchievementPct: number;
    totalSpvTarget: number;
    totalSpvActual: number;
    spvAchievementPct: number;
    totalSpvTargetSellOut: number;
    totalSpvActualSellOut: number;
    spvSellOutAchievementPct: number;
    totalSalesTarget: number;
    totalSalesActual: number;
    salesAchievementPct: number;
    totalSalesTargetSellOut: number;
    totalSalesActualSellOut: number;
    salesSellOutAchievementPct: number;
    totalSalesIncentiveEst: number;
    totalBaTarget: number;
    totalBaActual: number;
    baAchievementPct: number;
    totalBaFocusTargetPcs: number;
    totalBaFocusActualPcs: number;
    baFocusAchievementPct: number;
    totalTrainerTargetSellOut: number;
    totalTrainerActualSellOut: number;
    trainerSellOutAchievementPct: number;
    totalTrainerTargetFocusPcs: number;
    totalTrainerActualFocusPcs: number;
    trainerFocusAchievementPct: number;
    accumulatedMonthCount: number;
    accumulatedMonthKeys: string[];
    isMultiMonthAccumulated: boolean;
  };
}

export interface AggregateTargetMatrixOptions {
  singleMonthBaselineOnly?: boolean;
  selectedYear?: number;
  excludeKaMg?: boolean;
}

/**
 * Aggregates complete multi-tier targets and actuals for:
 * 1. Area (Cover Area / Region)
 * 2. SPV (Supervisor)
 * 3. Sales (Sell In & Sell Out Personil)
 * 4. BA (Non-Lavojoy, Lavojoy & Produk Fokus)
 * 5. Trainer (Sell Out & Produk Fokus)
 * Supports all 12 months (Januari - Desember 2026) with independent per-month targets,
 * and automatically totals all configured monthly targets when selectedMonth === 'ALL'.
 */
export function aggregateTargetMatrix(
  records: TransactionRecord[],
  selectedMonth?: string,
  options?: AggregateTargetMatrixOptions
): TargetMatrixData {
  const normMonth = normalizeMonthKey(selectedMonth);
  const configuredMonthKeys = getConfiguredMonthKeys();
  const isMultiMonthAccumulated =
    normMonth === 'ALL' && !options?.singleMonthBaselineOnly && configuredMonthKeys.length > 0;
  const targetMonthsToResolve = isMultiMonthAccumulated ? configuredMonthKeys : [normMonth];

  let effectiveYear =
    options?.selectedYear && options.selectedYear > 1900 ? options.selectedYear : 0;
  if (!effectiveYear && normMonth !== 'ALL') {
    const mYear = Number(normMonth.split('-')[0]);
    if (mYear > 1900) effectiveYear = mYear;
  }
  if (!effectiveYear && records.length > 0) {
    let maxY = 0;
    for (let i = 0; i < records.length; i++) {
      const ds = String(records[i].TANGGAL || records[i].BULAN || '');
      const yMatch = ds.match(/(20\d{2})/);
      if (yMatch) {
        const y = Number(yMatch[1]);
        if (y > maxY) maxY = y;
      }
    }
    if (maxY > 0) effectiveYear = maxY;
  }
  if (!effectiveYear) effectiveYear = 2026;

  const kaMgBreakdown = options?.excludeKaMg
    ? { totalSellIn: 0, kaSellIn: 0, mgSellIn: 0, filledMonthsCount: 0 }
    : getManualKaMgSellInBreakdown(normMonth, effectiveYear);
  const kaMgSellInTotal = kaMgBreakdown.totalSellIn;

  const focusOverrides = loadFocusOverrides();
  const customBaProfiles = loadCustomBaProfiles();
  const allMonthlyStore = loadMonthlyTargets();
  const monthlyBucket = normMonth !== 'ALL' ? allMonthlyStore[normMonth] : undefined;

  // Maps for aggregating known directory + month-filtered actuals
  const areaMap: Record<
    string,
    {
      coverArea: string;
      region: string;
      actualSellIn: number;
      actualSellOut: number;
      salesSet: Set<string>;
      spvSet: Set<string>;
      storeSet: Set<string>;
    }
  > = {};

  const spvMap: Record<
    string,
    {
      spvName: string;
      regions: Set<string>;
      coverAreas: Set<string>;
      actualSellIn: number;
      actualSellOut: number;
      salesSet: Set<string>;
      storeSet: Set<string>;
    }
  > = {};

  const salesMap: Record<
    string,
    {
      salesName: string;
      coverArea: string;
      spv: string;
      actualSellIn: number;
      actualSellOut: number;
      coveredStores: Set<string>;
      coveredBaList: { storeName: string; baName: string; sellOut: number }[];
    }
  > = {};

  const baMap: Record<
    string,
    {
      storeName: string;
      storesSet: Set<string>;
      baName: string;
      baNumber: string;
      coverArea: string;
      areasSet: Set<string>;
      region: string;
      regionsSet: Set<string>;
      salesName: string;
      salesSet: Set<string>;
      spv: string;
      spvsSet: Set<string>;
      sellOutNonLavojoy: number;
      sellOutLavojoy: number;
      focusActualPcs: number;
    }
  > = {};

  // Helper index for customBaProfiles by store name (including renamed stores) & BA name
  const customProfileByStoreUpper = new Map<string, CustomBaProfile>();
  const customProfileByBaUpper = new Map<string, CustomBaProfile>();
  Object.values(customBaProfiles).forEach((p) => {
    if (p.originalStoreName) {
      customProfileByStoreUpper.set(p.originalStoreName.trim().toUpperCase(), p);
    }
    if (p.storeName) {
      p.storeName.split(',').forEach((part) => {
        const s = part.trim().toUpperCase();
        if (s) customProfileByStoreUpper.set(s, p);
      });
    }
    const baUp = normalizeBaGroupKey(p.baName);
    if (!isGenericBaPlaceholder(baUp)) {
      customProfileByBaUpper.set(baUp, p);
    }
  });

  // First ensure directory entries exist from all records, then accumulate actuals ONLY for records matching selectedMonth
  for (const r of records) {
    const areaKey = r.COVER_AREA || 'UNKNOWN';
    const spvKey = r.SPV || 'UNKNOWN';
    const salesKey = r.SALES || 'UNKNOWN';
    const rawStoreKey = r.NAMA_STORE || 'UNKNOWN';

    // Check if store or BA has been renamed/updated via customBaProfiles
    const storeProfileMatch = customProfileByStoreUpper.get(rawStoreKey.trim().toUpperCase());
    const baProfileMatch = !storeProfileMatch
      ? customProfileByBaUpper.get(normalizeBaGroupKey(r.BA))
      : undefined;

    const storeKey =
      storeProfileMatch && storeProfileMatch.originalStoreName && storeProfileMatch.originalStoreName.toUpperCase() === rawStoreKey.toUpperCase()
        ? storeProfileMatch.storeName
        : rawStoreKey;
    const resolvedBaName = storeProfileMatch
      ? storeProfileMatch.baName
      : baProfileMatch
      ? baProfileMatch.baName
      : (customBaProfiles[storeKey]?.baName || r.BA || '');
    const resolvedSalesName = storeProfileMatch
      ? storeProfileMatch.salesName
      : (customBaProfiles[storeKey]?.salesName || salesKey);
    const resolvedArea = (storeProfileMatch?.coverArea && storeProfileMatch.coverArea !== '-' ? storeProfileMatch.coverArea : '') || areaKey;
    const resolvedRegion = (storeProfileMatch?.region && storeProfileMatch.region !== '-' ? storeProfileMatch.region : '') || r.REGION || '-';
    const resolvedSpv = (storeProfileMatch?.spv && storeProfileMatch.spv !== '-' ? storeProfileMatch.spv : '') || spvKey;

    if (!areaMap[areaKey]) {
      areaMap[areaKey] = {
        coverArea: areaKey,
        region: r.REGION || '-',
        actualSellIn: 0,
        actualSellOut: 0,
        salesSet: new Set(),
        spvSet: new Set(),
        storeSet: new Set(),
      };
    }
    if (r.SALES) areaMap[areaKey].salesSet.add(r.SALES);
    if (r.SPV) areaMap[areaKey].spvSet.add(r.SPV);
    if (storeKey) areaMap[areaKey].storeSet.add(storeKey);

    if (!spvMap[spvKey]) {
      spvMap[spvKey] = {
        spvName: spvKey,
        regions: new Set(),
        coverAreas: new Set(),
        actualSellIn: 0,
        actualSellOut: 0,
        salesSet: new Set(),
        storeSet: new Set(),
      };
    }
    if (r.REGION) spvMap[spvKey].regions.add(r.REGION);
    if (r.COVER_AREA) spvMap[spvKey].coverAreas.add(r.COVER_AREA);
    if (r.SALES) spvMap[spvKey].salesSet.add(r.SALES);
    if (storeKey) spvMap[spvKey].storeSet.add(storeKey);

    if (!salesMap[salesKey]) {
      salesMap[salesKey] = {
        salesName: salesKey,
        coverArea: areaKey,
        spv: spvKey,
        actualSellIn: 0,
        actualSellOut: 0,
        coveredStores: new Set(),
        coveredBaList: [],
      };
    }
    if (storeKey) salesMap[salesKey].coveredStores.add(storeKey);

    // Group BA entries strictly by normalized BA Name so the same BA across different stores gets 1 combined entry & 1 target
    const baGroupKey = normalizeBaGroupKey(resolvedBaName);
    const hasValidBa = !isGenericBaPlaceholder(baGroupKey);

    if (hasValidBa) {
      if (!baMap[baGroupKey]) {
        baMap[baGroupKey] = {
          storeName: storeKey,
          storesSet: new Set<string>(),
          baName: resolvedBaName.trim(),
          baNumber:
            storeProfileMatch?.baNumber ||
            baProfileMatch?.baNumber ||
            r.BA_Number ||
            'BA-' + storeKey.slice(0, 3).toUpperCase(),
          coverArea: resolvedArea,
          areasSet: new Set<string>(),
          region: resolvedRegion,
          regionsSet: new Set<string>(),
          salesName: resolvedSalesName,
          salesSet: new Set<string>(),
          spv: resolvedSpv,
          spvsSet: new Set<string>(),
          sellOutNonLavojoy: 0,
          sellOutLavojoy: 0,
          focusActualPcs: 0,
        };
      }
      const baAcc = baMap[baGroupKey];
      addUniqueTokenToSet(baAcc.storesSet, storeKey);
      addUniqueTokenToSet(baAcc.areasSet, resolvedArea);
      addUniqueTokenToSet(baAcc.regionsSet, resolvedRegion);
      addUniqueTokenToSet(baAcc.salesSet, resolvedSalesName);
      addUniqueTokenToSet(baAcc.spvsSet, resolvedSpv);
      if (baAcc.storesSet.size > 0) baAcc.storeName = Array.from(baAcc.storesSet).join(', ');
      if (baAcc.areasSet.size > 0) baAcc.coverArea = Array.from(baAcc.areasSet).join(', ');
      if (baAcc.regionsSet.size > 0) baAcc.region = Array.from(baAcc.regionsSet).join(', ');
      if (baAcc.salesSet.size > 0) baAcc.salesName = Array.from(baAcc.salesSet).join(', ');
      if (baAcc.spvsSet.size > 0) baAcc.spv = Array.from(baAcc.spvsSet).join(', ');
    }

    // Only accumulate financial/qty actuals when the record falls in the selected month
    if (!recordMatchesMonth(r, normMonth)) continue;

    const val = r.VALUE || 0;
    const qty = Math.max(0, r.QTY || 0);
    const ket = (r.KET || '').toUpperCase().trim();
    const isSellIn = ket === 'SELL IN';
    const isSellOut = ket === 'SELL OUT' || !ket || ket === '';
    const isFocus = isFocusProduct(r.PRODUK_FOCUS || r);
    const isLavojoy = (r.BRAND || '').toLowerCase().includes('lavojoy');

    if (isSellIn) areaMap[areaKey].actualSellIn += val;
    if (isSellOut) areaMap[areaKey].actualSellOut += val;

    if (isSellIn) spvMap[spvKey].actualSellIn += val;
    if (isSellOut) spvMap[spvKey].actualSellOut += val;

    if (isSellIn) salesMap[salesKey].actualSellIn += val;
    if (isSellOut) salesMap[salesKey].actualSellOut += val;

    if (hasValidBa && baMap[baGroupKey]) {
      if (isSellOut) {
        if (isLavojoy) {
          baMap[baGroupKey].sellOutLavojoy += val;
        } else {
          baMap[baGroupKey].sellOutNonLavojoy += val;
        }
      }
      if (isFocus && (isSellOut || isSellIn)) {
        baMap[baGroupKey].focusActualPcs += qty;
      }
    }
  }

  // Merge any newly added or edited custom BA profiles by BA Name (never duplicating existing BA)
  Object.values(customBaProfiles).forEach((profile) => {
    const pBaKey = normalizeBaGroupKey(profile.baName);
    if (isGenericBaPlaceholder(pBaKey)) return;

    if (!baMap[pBaKey]) {
      const storesSet = new Set<string>();
      const areasSet = new Set<string>();
      const regionsSet = new Set<string>();
      const salesSet = new Set<string>();
      const spvsSet = new Set<string>();
      addUniqueTokenToSet(storesSet, profile.storeName);
      addUniqueTokenToSet(areasSet, profile.coverArea || 'PEKANBARU');
      addUniqueTokenToSet(regionsSet, profile.region || 'PEKAN BARU');
      addUniqueTokenToSet(salesSet, profile.salesName || 'ILHAMSYAH');
      addUniqueTokenToSet(spvsSet, profile.spv || 'WIDODO');

      baMap[pBaKey] = {
        storeName: Array.from(storesSet).join(', ') || profile.storeName,
        storesSet,
        baName: profile.baName.trim(),
        baNumber: profile.baNumber || 'BA-NEW',
        coverArea: Array.from(areasSet).join(', ') || 'PEKANBARU',
        areasSet,
        region: Array.from(regionsSet).join(', ') || 'PEKAN BARU',
        regionsSet,
        salesName: Array.from(salesSet).join(', ') || 'ILHAMSYAH',
        salesSet,
        spv: Array.from(spvsSet).join(', ') || 'WIDODO',
        spvsSet,
        sellOutNonLavojoy: 0,
        sellOutLavojoy: 0,
        focusActualPcs: 0,
      };
    } else {
      const existing = baMap[pBaKey];
      existing.baName = profile.baName.trim() || existing.baName;
      addUniqueTokenToSet(existing.storesSet, profile.storeName);
      if (profile.coverArea) addUniqueTokenToSet(existing.areasSet, profile.coverArea);
      if (profile.salesName) addUniqueTokenToSet(existing.salesSet, profile.salesName);
      if (existing.storesSet.size > 0) existing.storeName = Array.from(existing.storesSet).join(', ');
      if (existing.areasSet.size > 0) existing.coverArea = Array.from(existing.areasSet).join(', ');
      if (existing.salesSet.size > 0) existing.salesName = Array.from(existing.salesSet).join(', ');
    }
  });

  // Populate coveredBaList for sales productivity evaluation (1 entry per BA)
  Object.values(baMap).forEach((b) => {
    const primarySales = Array.from(b.salesSet)[0] || b.salesName;
    if (salesMap[primarySales]) {
      salesMap[primarySales].coveredBaList.push({
        storeName: b.storeName,
        baName: b.baName,
        sellOut: b.sellOutNonLavojoy + b.sellOutLavojoy,
      });
    }
  });

  // Fallbacks if dataset is completely empty
  if (Object.keys(areaMap).length === 0) {
    areaMap['AREA BARU'] = {
      coverArea: 'AREA BARU',
      region: 'PEKAN BARU',
      actualSellIn: 0,
      actualSellOut: 0,
      salesSet: new Set(['ILHAMSYAH']),
      spvSet: new Set(['WIDODO']),
      storeSet: new Set(['TOKO ALANA BEAUTY', 'SYMPHONY KOSMETIK']),
    };
  }

  // Precompute summed target values across targetMonthsToResolve (1 month if specific month or baseline, N months if ALL with configured months)
  const monthCaches = targetMonthsToResolve.map((mKey) => ({
    mKey,
    bucket: mKey !== 'ALL' ? allMonthlyStore[mKey] : undefined,
    areaTargets: loadAreaTargets(mKey),
    areaSellOutTargets: loadAreaSellOutTargets(mKey),
    spvTargets: loadSpvTargets(mKey),
    spvSellOutTargets: loadSpvSellOutTargets(mKey),
    salesTargets: loadSalesTargets(mKey),
    salesSellOutTargets: loadSalesSellOutTargets(mKey),
    baNonTargets: loadBaNonLavojoyTargets(mKey),
    baLavTargets: loadBaLavojoyTargets(mKey),
    baFocusTargets: loadBaFocusTargets(mKey),
    trainerTargets: loadTrainerTargets(mKey),
  }));

  // Track sales targets per month so unedited Areas & SPVs auto-rollup from their Sales team accurately
  const monthlySalesInBySales: Record<string, number>[] = monthCaches.map((mc) => {
    const res: Record<string, number> = {};
    Object.values(salesMap).forEach((sl) => {
      const val = findMapValueCaseInsensitive(mc.salesTargets, sl.salesName);
      res[sl.salesName] = val !== undefined ? val : DEFAULT_SALES_TARGET;
    });
    return res;
  });

  const monthlySalesOutBySales: Record<string, number>[] = monthCaches.map((mc) => {
    const res: Record<string, number> = {};
    Object.values(salesMap).forEach((sl) => {
      const val = findMapValueCaseInsensitive(mc.salesSellOutTargets, sl.salesName);
      res[sl.salesName] = val !== undefined ? val : DEFAULT_SALES_SELLOUT_TARGET;
    });
    return res;
  });

  // 1. Array Sales Targets (Sell In & Sell Out)
  const sales: SalesTargetItem[] = Object.values(salesMap).map((sl) => {
    let targetSellIn = 0;
    let targetSellOut = 0;
    let isCustom = false;
    let isCustomSellOut = false;

    monthCaches.forEach((mc, idx) => {
      const mIn = findMapValueCaseInsensitive(mc.salesTargets, sl.salesName);
      if (mIn !== undefined) isCustom = true;
      targetSellIn += monthlySalesInBySales[idx][sl.salesName];

      const mOut = findMapValueCaseInsensitive(mc.salesSellOutTargets, sl.salesName);
      if (mOut !== undefined) isCustomSellOut = true;
      targetSellOut += monthlySalesOutBySales[idx][sl.salesName];
    });

    const salaryData = calculateSalesSalary(
      sl.salesName,
      sl.actualSellIn,
      targetSellIn,
      sl.coverArea,
      sl.spv,
      sl.coveredBaList
    );
    const achievementSellOutPct = targetSellOut > 0 ? (sl.actualSellOut / targetSellOut) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      salaryData.achievementPercent >= 100
        ? 'achieved'
        : salaryData.achievementPercent >= 80
        ? 'on_track'
        : 'lagging';

    return {
      salesName: sl.salesName,
      coverArea: sl.coverArea,
      spv: sl.spv,
      targetSellIn,
      actualSellIn: sl.actualSellIn,
      achievementPct: salaryData.achievementPercent,
      targetSellOut,
      actualSellOut: sl.actualSellOut,
      achievementSellOutPct,
      isCustomSellOut,
      incentivePercent: salaryData.incentivePercent,
      incentiveNominal: salaryData.incentiveNominal,
      status,
      coveredBaCount: sl.coveredBaList.length,
      isCustom,
    };
  }).sort((a, b) => b.actualSellIn - a.actualSellIn);

  // 2. Array Area Targets (respect explicit custom target if set, else auto-rollup from Area's Sales targets)
  const rawAreas: AreaTargetItem[] = Object.values(areaMap).map((a) => {
    let targetOmzet = 0;
    let targetSellOut = 0;
    let isCustom = false;
    let isCustomSellOut = false;
    const areaUpper = a.coverArea.trim().toUpperCase();

    monthCaches.forEach((mc, idx) => {
      const customVal = findMapValueCaseInsensitive(mc.areaTargets, a.coverArea);
      if (customVal !== undefined) {
        isCustom = true;
        targetOmzet += customVal;
      } else {
        const salesRollup = Object.values(salesMap)
          .filter((sl) => sl.coverArea.trim().toUpperCase() === areaUpper)
          .reduce((acc, sl) => acc + monthlySalesInBySales[idx][sl.salesName], 0);
        targetOmzet += salesRollup > 0 ? salesRollup : DEFAULT_AREA_TARGET;
      }
      if (findMapValueCaseInsensitive(mc.bucket?.area, a.coverArea) !== undefined) {
        isCustom = true;
      }

      const customOutVal = findMapValueCaseInsensitive(mc.areaSellOutTargets, a.coverArea);
      if (customOutVal !== undefined) {
        isCustomSellOut = true;
        targetSellOut += customOutVal;
      } else {
        const salesOutRollup = Object.values(salesMap)
          .filter((sl) => sl.coverArea.trim().toUpperCase() === areaUpper)
          .reduce((acc, sl) => acc + monthlySalesOutBySales[idx][sl.salesName], 0);
        targetSellOut += salesOutRollup > 0 ? salesOutRollup : DEFAULT_AREA_SELLOUT_TARGET;
      }
      if (findMapValueCaseInsensitive(mc.bucket?.areaSellOut, a.coverArea) !== undefined) {
        isCustomSellOut = true;
      }
    });

    if (monthlyBucket?.area && findMapValueCaseInsensitive(monthlyBucket.area, a.coverArea) !== undefined) {
      isCustom = true;
    }
    if (monthlyBucket?.areaSellOut && findMapValueCaseInsensitive(monthlyBucket.areaSellOut, a.coverArea) !== undefined) {
      isCustomSellOut = true;
    }

    const regularSellIn = a.actualSellIn > 0 ? a.actualSellIn : a.actualSellOut;
    const actualSellIn = regularSellIn;
    const gapOmzet = actualSellIn - targetOmzet;
    const achievementPct = targetOmzet > 0 ? (actualSellIn / targetOmzet) * 100 : 0;
    const gapSellOut = a.actualSellOut - targetSellOut;
    const achievementSellOutPct = targetSellOut > 0 ? (a.actualSellOut / targetSellOut) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    return {
      coverArea: a.coverArea,
      region: a.region,
      targetOmzet,
      actualSellIn,
      regularSellIn,
      kaMgSellIn: 0,
      actualSellOut: a.actualSellOut,
      gapOmzet,
      achievementPct,
      targetSellOut,
      gapSellOut,
      achievementSellOutPct,
      isCustomSellOut,
      status,
      salesCount: a.salesSet.size,
      spvCount: a.spvSet.size,
      storeCount: a.storeSet.size,
      isCustom,
    };
  });

  // Merge manual KA & DAZZLE ME MG Sell In into a single primary Cover Area (avoid double-counting in totalAreaActual)
  if (kaMgSellInTotal > 0 && rawAreas.length > 0) {
    const preferredAreaOrder = ['AREA BARU', 'RIAU', 'PEKANBARU', 'PEKAN BARU'];
    let primaryAreaIdx = -1;
    for (const token of preferredAreaOrder) {
      const idx = rawAreas.findIndex((ar) => {
        const up = ar.coverArea.trim().toUpperCase();
        return up === token || up.includes(token);
      });
      if (idx !== -1) {
        primaryAreaIdx = idx;
        break;
      }
    }
    if (primaryAreaIdx === -1) {
      let bestVal = -1;
      rawAreas.forEach((ar, idx) => {
        const isKnown = ar.coverArea.trim().toUpperCase() !== 'UNKNOWN';
        const score = (ar.regularSellIn || 0) + (isKnown ? 1 : 0);
        if (score > bestVal) {
          bestVal = score;
          primaryAreaIdx = idx;
        }
      });
      if (primaryAreaIdx === -1) primaryAreaIdx = 0;
    }

    const targetArea = rawAreas[primaryAreaIdx];
    const baseReg = targetArea.regularSellIn ?? targetArea.actualSellIn;
    const combinedSellIn = baseReg + kaMgSellInTotal;
    const gapOmzet = combinedSellIn - targetArea.targetOmzet;
    const achievementPct = targetArea.targetOmzet > 0 ? (combinedSellIn / targetArea.targetOmzet) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    rawAreas[primaryAreaIdx] = {
      ...targetArea,
      regularSellIn: baseReg,
      kaMgSellIn: kaMgSellInTotal,
      actualSellIn: combinedSellIn,
      gapOmzet,
      achievementPct,
      status,
    };
  }
  const areas: AreaTargetItem[] = rawAreas.sort((a, b) => b.actualSellIn - a.actualSellIn);

  // 3. Array SPV Targets (respect explicit custom target if set, else auto-rollup from SPV's Sales targets)
  const rawSpvs: SpvTargetItem[] = Object.values(spvMap).map((s) => {
    let targetOmzet = 0;
    let targetSellOut = 0;
    let isCustom = false;
    let isCustomSellOut = false;
    const spvUpper = s.spvName.trim().toUpperCase();

    monthCaches.forEach((mc, idx) => {
      const customVal = findMapValueCaseInsensitive(mc.spvTargets, s.spvName);
      if (customVal !== undefined) {
        isCustom = true;
        targetOmzet += customVal;
      } else {
        const salesRollup = Object.values(salesMap)
          .filter((sl) => sl.spv.trim().toUpperCase() === spvUpper)
          .reduce((acc, sl) => acc + monthlySalesInBySales[idx][sl.salesName], 0);
        targetOmzet += salesRollup > 0 ? salesRollup : DEFAULT_SPV_TARGET;
      }
      if (findMapValueCaseInsensitive(mc.bucket?.spv, s.spvName) !== undefined) {
        isCustom = true;
      }

      const customOutVal = findMapValueCaseInsensitive(mc.spvSellOutTargets, s.spvName);
      if (customOutVal !== undefined) {
        isCustomSellOut = true;
        targetSellOut += customOutVal;
      } else {
        const salesOutRollup = Object.values(salesMap)
          .filter((sl) => sl.spv.trim().toUpperCase() === spvUpper)
          .reduce((acc, sl) => acc + monthlySalesOutBySales[idx][sl.salesName], 0);
        targetSellOut += salesOutRollup > 0 ? salesOutRollup : DEFAULT_SPV_SELLOUT_TARGET;
      }
      if (findMapValueCaseInsensitive(mc.bucket?.spvSellOut, s.spvName) !== undefined) {
        isCustomSellOut = true;
      }
    });

    if (monthlyBucket?.spv && findMapValueCaseInsensitive(monthlyBucket.spv, s.spvName) !== undefined) {
      isCustom = true;
    }
    if (monthlyBucket?.spvSellOut && findMapValueCaseInsensitive(monthlyBucket.spvSellOut, s.spvName) !== undefined) {
      isCustomSellOut = true;
    }

    const regularSellIn = s.actualSellIn > 0 ? s.actualSellIn : s.actualSellOut;
    const actualSellIn = regularSellIn;
    const gapOmzet = actualSellIn - targetOmzet;
    const achievementPct = targetOmzet > 0 ? (actualSellIn / targetOmzet) * 100 : 0;
    const gapSellOut = s.actualSellOut - targetSellOut;
    const achievementSellOutPct = targetSellOut > 0 ? (s.actualSellOut / targetSellOut) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    return {
      spvName: s.spvName,
      regions: Array.from(s.regions),
      coverAreas: Array.from(s.coverAreas),
      targetOmzet,
      actualSellIn,
      regularSellIn,
      kaMgSellIn: 0,
      actualSellOut: s.actualSellOut,
      gapOmzet,
      achievementPct,
      targetSellOut,
      gapSellOut,
      achievementSellOutPct,
      isCustomSellOut,
      status,
      salesCount: s.salesSet.size,
      storeCount: s.storeSet.size,
      isCustom,
    };
  });

  // Merge manual KA & DAZZLE ME MG Sell In into SPV Sell In (prefer WIDODO) without double-counting
  if (kaMgSellInTotal > 0 && rawSpvs.length > 0) {
    let primarySpvIdx = rawSpvs.findIndex((sp) => sp.spvName.trim().toUpperCase() === 'WIDODO');
    if (primarySpvIdx === -1) {
      let bestVal = -1;
      rawSpvs.forEach((sp, idx) => {
        const isKnown = sp.spvName.trim().toUpperCase() !== 'UNKNOWN';
        const score = (sp.regularSellIn || 0) + (isKnown ? 1 : 0);
        if (score > bestVal) {
          bestVal = score;
          primarySpvIdx = idx;
        }
      });
      if (primarySpvIdx === -1) primarySpvIdx = 0;
    }

    const targetSpv = rawSpvs[primarySpvIdx];
    const baseReg = targetSpv.regularSellIn ?? targetSpv.actualSellIn;
    const combinedSellIn = baseReg + kaMgSellInTotal;
    const gapOmzet = combinedSellIn - targetSpv.targetOmzet;
    const achievementPct = targetSpv.targetOmzet > 0 ? (combinedSellIn / targetSpv.targetOmzet) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    rawSpvs[primarySpvIdx] = {
      ...targetSpv,
      regularSellIn: baseReg,
      kaMgSellIn: kaMgSellInTotal,
      actualSellIn: combinedSellIn,
      gapOmzet,
      achievementPct,
      status,
    };
  }
  const spvs: SpvTargetItem[] = rawSpvs.sort((a, b) => b.actualSellIn - a.actualSellIn);

  // 4. Array BA Targets (1 target per BA name; stores with the same BA are merged)
  const bas: BaTargetItem[] = Object.values(baMap).map((b) => {
    const storeNames = Array.from(b.storesSet);
    const mergedStoreName = storeNames.join(', ') || b.storeName;
    const ov = lookupBaMapValue(focusOverrides, b.baName, mergedStoreName, storeNames) || {};
    let targetNonLavojoy = 0;
    let targetLavojoy = 0;
    let targetFocusPcs = 0;
    let isNonLavojoyCustom = false;
    let isLavojoyCustom = false;
    let isFocusCustom = ov.targetPcs !== undefined;
    let lastMonthTargetLavojoy = DEFAULT_BA_LAVOJOY_TARGET;

    monthCaches.forEach((mc) => {
      const customNonLav = lookupBaMapValue(mc.baNonTargets, b.baName, mergedStoreName, storeNames);
      const customLav = lookupBaMapValue(mc.baLavTargets, b.baName, mergedStoreName, storeNames);

      if (customNonLav !== undefined) isNonLavojoyCustom = true;
      if (customLav !== undefined) isLavojoyCustom = true;

      const mNonLav = customNonLav !== undefined ? customNonLav : DEFAULT_BA_NON_LAVOJOY_TARGET;
      const mLav = customLav !== undefined ? customLav : DEFAULT_BA_LAVOJOY_TARGET;
      lastMonthTargetLavojoy = mLav;

      targetNonLavojoy += mNonLav;
      targetLavojoy += mLav;

      const monthFocus = lookupBaMapValue(mc.baFocusTargets, b.baName, mergedStoreName, storeNames);
      if (monthFocus !== undefined && monthFocus > 0) {
        isFocusCustom = true;
        targetFocusPcs += monthFocus;
      } else if (ov.targetPcs !== undefined && ov.targetPcs > 0) {
        targetFocusPcs += ov.targetPcs;
      } else {
        targetFocusPcs += DEFAULT_FOCUS_TARGET_PCS;
      }
    });

    const actualFocusPcs =
      ov.customActualPcs !== undefined && ov.customActualPcs >= 0 ? ov.customActualPcs : b.focusActualPcs;

    const focusCalc = calculateFocusProductIncentivePenalty(
      targetFocusPcs,
      actualFocusPcs,
      ov.customIncentive,
      ov.customPenalty
    );

    // Jika Target Lavojoy diset 0, maka seluruh pencapaian Sell Out BA (Non-Lavojoy + Lavojoy)
    // dihitung sebagai pencapaian Sell Out utama BA tersebut.
    const isLavojoyMergedToMain = targetLavojoy === 0 || (monthCaches.length === 1 && lastMonthTargetLavojoy === 0);
    const actualNonLavojoy = isLavojoyMergedToMain
      ? b.sellOutNonLavojoy + b.sellOutLavojoy
      : b.sellOutNonLavojoy;
    const actualLavojoy = isLavojoyMergedToMain ? 0 : b.sellOutLavojoy;

    const achievementNonLavojoyPct =
      targetNonLavojoy > 0 ? (actualNonLavojoy / targetNonLavojoy) * 100 : 0;
    const achievementLavojoyPct =
      targetLavojoy > 0 ? (actualLavojoy / targetLavojoy) * 100 : 0;

    return {
      storeName: mergedStoreName,
      storeNames,
      baName: b.baName,
      baNumber: b.baNumber,
      coverArea: b.coverArea,
      region: b.region,
      salesName: b.salesName,
      spv: b.spv,
      targetNonLavojoy,
      actualNonLavojoy,
      achievementNonLavojoyPct,
      targetLavojoy,
      actualLavojoy,
      achievementLavojoyPct,
      targetFocusPcs,
      actualFocusPcs,
      achievementFocusPct: focusCalc.achievementPct,
      focusStatus: focusCalc.status,
      focusIncentive: focusCalc.incentive,
      focusPenalty: focusCalc.penalty,
      isCustom: Boolean(isNonLavojoyCustom || isLavojoyCustom || isFocusCustom),
    };
  }).sort((a, b) => (b.actualNonLavojoy + b.actualLavojoy) - (a.actualNonLavojoy + a.actualLavojoy));

  // 5. Array Trainer Targets (Sell Out & Produk Fokus) — partitioned 1-to-1 per BA so actuals are never double-counted
  const activeTrainerConfigs = loadTrainerConfigs();
  const customExtraTrainers = activeTrainerConfigs.filter((t) => {
    const upper = t.trainerName.trim().toUpperCase();
    return upper !== 'ARA' && upper !== 'RATIH';
  });

  const baByTrainerName: Record<string, typeof baMap[string][]> = {};
  activeTrainerConfigs.forEach((t) => {
    baByTrainerName[t.trainerName.trim().toUpperCase()] = [];
  });

  Object.values(baMap).forEach((b) => {
    const areaUp = (b.coverArea || '').toUpperCase();
    const regUp = (b.region || '').toUpperCase();

    const matchedExtra = customExtraTrainers.find((ct) => {
      const coveredUp = (ct.areaCovered || '').toUpperCase();
      const ctRegUp = (ct.region || '').toUpperCase();
      return (areaUp && coveredUp.includes(areaUp)) || (regUp && ctRegUp && ctRegUp === regUp);
    });

    let assignedTrainer = matchedExtra
      ? matchedExtra.trainerName.trim().toUpperCase()
      : getTrainerForRecord({
          SALES: b.salesName,
          NAMA_STORE: b.storeName,
          COVER_AREA: b.coverArea,
          REGION: b.region,
        } as TransactionRecord).trim().toUpperCase();

    if (!baByTrainerName[assignedTrainer]) {
      assignedTrainer = activeTrainerConfigs[0]?.trainerName.trim().toUpperCase() || assignedTrainer;
    }
    if (!baByTrainerName[assignedTrainer]) baByTrainerName[assignedTrainer] = [];
    baByTrainerName[assignedTrainer].push(b);
  });

  const trainers: TrainerTargetItem[] = activeTrainerConfigs.map((t) => {
    const tNameUp = t.trainerName.trim().toUpperCase();
    const matchingBas = baByTrainerName[tNameUp] || [];

    let targetSellOut = 0;
    let targetProdukFokusPcs = 0;
    let isCustom = t.baSupervisedCount !== undefined;
    let latestBaSupervised: number | undefined = t.baSupervisedCount;
    let latestNotes = t.notes;

    monthCaches.forEach((mc) => {
      const customConfig = mc.trainerTargets[t.id] || findMapValueCaseInsensitive(mc.trainerTargets, t.trainerName) || {};
      const mSo =
        customConfig.targetSellOut !== undefined && customConfig.targetSellOut > 0
          ? customConfig.targetSellOut
          : t.targetSellOut || DEFAULT_TRAINER_SELL_OUT_TARGET;
      const mFocus =
        customConfig.targetProdukFokusPcs !== undefined && customConfig.targetProdukFokusPcs > 0
          ? customConfig.targetProdukFokusPcs
          : t.targetProdukFokusPcs || DEFAULT_TRAINER_FOCUS_TARGET_PCS;

      targetSellOut += mSo;
      targetProdukFokusPcs += mFocus;

      if (customConfig.baSupervisedCount !== undefined) {
        latestBaSupervised = customConfig.baSupervisedCount;
        isCustom = true;
      }
      if (customConfig.notes) {
        latestNotes = customConfig.notes;
      }
      if (customConfig.targetSellOut !== undefined || customConfig.targetProdukFokusPcs !== undefined) {
        isCustom = true;
      }
    });

    const autoBaSupervisedCount = matchingBas.length;
    const baSupervisedCount =
      latestBaSupervised !== undefined && latestBaSupervised >= 0
        ? latestBaSupervised
        : autoBaSupervisedCount;
    const storeSupervisedCount = baSupervisedCount;

    const actualSellOut = matchingBas.reduce((acc, b) => acc + b.sellOutNonLavojoy + b.sellOutLavojoy, 0);
    const actualProdukFokusPcs = matchingBas.reduce((acc, b) => acc + b.focusActualPcs, 0);

    const achievementSellOutPct = targetSellOut > 0 ? (actualSellOut / targetSellOut) * 100 : 0;
    const achievementProdukFokusPct = targetProdukFokusPcs > 0 ? (actualProdukFokusPcs / targetProdukFokusPcs) * 100 : 0;

    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementSellOutPct >= 100 && achievementProdukFokusPct >= 100
        ? 'achieved'
        : achievementSellOutPct >= 80 || achievementProdukFokusPct >= 80
        ? 'on_track'
        : 'lagging';

    return {
      id: t.id,
      trainerName: t.trainerName,
      areaCovered: t.areaCovered,
      region: t.region,
      targetSellOut,
      actualSellOut,
      achievementSellOutPct,
      targetProdukFokusPcs,
      actualProdukFokusPcs,
      achievementProdukFokusPct,
      status,
      baSupervisedCount,
      storeSupervisedCount,
      monthPeriod: normMonth,
      notes: latestNotes,
      isCustom,
    };
  });

  // Overall summaries
  const totalAreaTarget = areas.reduce((acc, a) => acc + a.targetOmzet, 0);
  const totalAreaActual = areas.reduce((acc, a) => acc + a.actualSellIn, 0);
  const areaAchievementPct = totalAreaTarget > 0 ? (totalAreaActual / totalAreaTarget) * 100 : 0;

  const totalAreaTargetSellOut = areas.reduce((acc, a) => acc + (a.targetSellOut ?? DEFAULT_AREA_SELLOUT_TARGET), 0);
  const totalAreaActualSellOut = areas.reduce((acc, a) => acc + a.actualSellOut, 0);
  const areaSellOutAchievementPct = totalAreaTargetSellOut > 0 ? (totalAreaActualSellOut / totalAreaTargetSellOut) * 100 : 0;

  const totalSpvTarget = spvs.reduce((acc, s) => acc + s.targetOmzet, 0);
  const totalSpvActual = spvs.reduce((acc, s) => acc + s.actualSellIn, 0);
  const spvAchievementPct = totalSpvTarget > 0 ? (totalSpvActual / totalSpvTarget) * 100 : 0;

  const totalSpvTargetSellOut = spvs.reduce((acc, s) => acc + (s.targetSellOut ?? DEFAULT_SPV_SELLOUT_TARGET), 0);
  const totalSpvActualSellOut = spvs.reduce((acc, s) => acc + s.actualSellOut, 0);
  const spvSellOutAchievementPct = totalSpvTargetSellOut > 0 ? (totalSpvActualSellOut / totalSpvTargetSellOut) * 100 : 0;

  const totalSalesTarget = sales.reduce((acc, s) => acc + s.targetSellIn, 0);
  const totalSalesActual = sales.reduce((acc, s) => acc + s.actualSellIn, 0);
  const salesAchievementPct = totalSalesTarget > 0 ? (totalSalesActual / totalSalesTarget) * 100 : 0;

  const totalSalesTargetSellOut = sales.reduce((acc, s) => acc + (s.targetSellOut || DEFAULT_SALES_SELLOUT_TARGET), 0);
  const totalSalesActualSellOut = sales.reduce((acc, s) => acc + (s.actualSellOut || 0), 0);
  const salesSellOutAchievementPct = totalSalesTargetSellOut > 0 ? (totalSalesActualSellOut / totalSalesTargetSellOut) * 100 : 0;
  const totalSalesIncentiveEst = sales.reduce((acc, s) => acc + s.incentiveNominal, 0);

  const totalBaTarget = bas.reduce((acc, b) => acc + b.targetNonLavojoy + b.targetLavojoy, 0);
  const totalBaActual = bas.reduce((acc, b) => acc + b.actualNonLavojoy + b.actualLavojoy, 0);
  const baAchievementPct = totalBaTarget > 0 ? (totalBaActual / totalBaTarget) * 100 : 0;

  const totalBaFocusTargetPcs = bas.reduce((acc, b) => acc + b.targetFocusPcs, 0);
  const totalBaFocusActualPcs = bas.reduce((acc, b) => acc + b.actualFocusPcs, 0);
  const baFocusAchievementPct = totalBaFocusTargetPcs > 0 ? (totalBaFocusActualPcs / totalBaFocusTargetPcs) * 100 : 0;

  const totalTrainerTargetSellOut = trainers.reduce((acc, t) => acc + t.targetSellOut, 0);
  const totalTrainerActualSellOut = trainers.reduce((acc, t) => acc + t.actualSellOut, 0);
  const trainerSellOutAchievementPct = totalTrainerTargetSellOut > 0 ? (totalTrainerActualSellOut / totalTrainerTargetSellOut) * 100 : 0;

  const totalTrainerTargetFocusPcs = trainers.reduce((acc, t) => acc + t.targetProdukFokusPcs, 0);
  const totalTrainerActualFocusPcs = trainers.reduce((acc, t) => acc + t.actualProdukFokusPcs, 0);
  const trainerFocusAchievementPct = totalTrainerTargetFocusPcs > 0 ? (totalTrainerActualFocusPcs / totalTrainerTargetFocusPcs) * 100 : 0;

  return {
    areas,
    spvs,
    sales,
    bas,
    trainers,
    summary: {
      totalAreaTarget,
      totalAreaActual,
      areaAchievementPct,
      totalAreaTargetSellOut,
      totalAreaActualSellOut,
      areaSellOutAchievementPct,
      totalSpvTarget,
      totalSpvActual,
      spvAchievementPct,
      totalSpvTargetSellOut,
      totalSpvActualSellOut,
      spvSellOutAchievementPct,
      totalSalesTarget,
      totalSalesActual,
      salesAchievementPct,
      totalSalesTargetSellOut,
      totalSalesActualSellOut,
      salesSellOutAchievementPct,
      totalSalesIncentiveEst,
      totalBaTarget,
      totalBaActual,
      baAchievementPct,
      totalBaFocusTargetPcs,
      totalBaFocusActualPcs,
      baFocusAchievementPct,
      totalTrainerTargetSellOut,
      totalTrainerActualSellOut,
      trainerSellOutAchievementPct,
      totalTrainerTargetFocusPcs,
      totalTrainerActualFocusPcs,
      trainerFocusAchievementPct,
      accumulatedMonthCount: targetMonthsToResolve.length,
      accumulatedMonthKeys: isMultiMonthAccumulated ? configuredMonthKeys : [],
      isMultiMonthAccumulated,
    },
  };
}

// =========================================================================
// STORE SELL IN TARGETS (AUTO KONTRIBUSI 3 BLN SEBELUMNYA x TARGET SALES + SYNC ACHIEVE QUARTAL)
// =========================================================================

const STORAGE_KEY_QUARTERLY_OVERRIDES_REF = 'salespro_quarterly_targets_v1';

const QUARTER_KEY_MONTHS: Record<QuarterPeriodKey, [string, string, string]> = {
  Q1: ['2026-01', '2026-02', '2026-03'],
  Q2: ['2026-04', '2026-05', '2026-06'],
  Q3: ['2026-07', '2026-08', '2026-09'],
  Q4: ['2026-10', '2026-11', '2026-12'],
};

function monthKeyToQuarter(monthKey: string): QuarterPeriodKey | null {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') return null;
  const meta = MONTH_OPTIONS_2026.find((m) => m.key === norm);
  if (!meta) return null;
  if (meta.monthIndex <= 2) return 'Q1';
  if (meta.monthIndex <= 5) return 'Q2';
  if (meta.monthIndex <= 8) return 'Q3';
  return 'Q4';
}

export function clearBaQuarterlySellInOverridesForMonths(
  monthKeys?: string[],
  targetBaName?: string
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUARTERLY_OVERRIDES_REF);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    const affectedQuarters = new Set<QuarterPeriodKey>();
    if (monthKeys && monthKeys.length > 0 && !monthKeys.some((k) => normalizeMonthKey(k) === 'ALL')) {
      monthKeys.forEach((mk) => {
        const q = monthKeyToQuarter(mk);
        if (q) affectedQuarters.add(q);
      });
    } else {
      (['Q1', 'Q2', 'Q3', 'Q4'] as QuarterPeriodKey[]).forEach((q) => affectedQuarters.add(q));
    }

    const targetBaUpper = targetBaName ? targetBaName.trim().toUpperCase() : null;
    let changed = false;

    Object.keys(parsed).forEach((key) => {
      const parts = key.split('|');
      if (parts.length < 4) return;
      const q = parts[1] as QuarterPeriodKey;
      const role = parts[2];
      const entity = parts.slice(3).join('|').trim().toUpperCase();
      if (role !== 'ba') return;
      if (!affectedQuarters.has(q)) return;
      if (targetBaUpper && entity !== targetBaUpper) return;
      if (parsed[key] && parsed[key].targetSellIn !== undefined) {
        delete parsed[key].targetSellIn;
        if (parsed[key].targetSellOut === undefined) {
          delete parsed[key];
        }
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY_QUARTERLY_OVERRIDES_REF, JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

function readGlobalStoreSellInPool(): number | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORE_SELLIN_POOL);
    if (raw === null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export function loadStoreSellInFormulaMode(): StoreSellInFormulaMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORE_SELLIN_MODE);
    return raw === 'per_sales' ? 'per_sales' : 'global';
  } catch {
    return 'global';
  }
}

export function saveStoreSellInFormulaMode(mode: StoreSellInFormulaMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_STORE_SELLIN_MODE, mode);
  } catch {
    // ignore
  }
  clearBaQuarterlySellInOverridesForMonths();
  notifyTargetsUpdated({ category: 'store_sellin_mode' });
}

export function loadStoreSellInTargets(monthKey?: string): Record<string, number> {
  const base = readGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS);
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.storeSellIn) {
      return { ...base, ...monthly[norm].storeSellIn };
    }
  }
  return base;
}

export function saveStoreSellInTargets(targets: Record<string, number>, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    monthly[norm].storeSellIn = targets;
    saveMonthlyTargets(monthly);
  } else {
    writeGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS, targets);
  }
  clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  notifyTargetsUpdated({ monthKey: norm, category: 'store_sellin' });
}

export function loadStoreSellInPool(monthKey?: string): number | undefined {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.storeSellInPool !== undefined) {
      return monthly[norm].storeSellInPool;
    }
  }
  return readGlobalStoreSellInPool();
}

export function saveStoreSellInPool(pool: number | undefined, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm !== 'ALL') {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    if (pool === undefined) {
      delete monthly[norm].storeSellInPool;
    } else {
      monthly[norm].storeSellInPool = Math.max(0, Math.round(pool));
    }
    saveMonthlyTargets(monthly);
  } else {
    if (pool === undefined) {
      localStorage.removeItem(STORAGE_KEY_STORE_SELLIN_POOL);
    } else {
      localStorage.setItem(STORAGE_KEY_STORE_SELLIN_POOL, String(Math.max(0, Math.round(pool))));
    }
  }
  clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  notifyTargetsUpdated({ monthKey: norm, category: 'store_sellin_pool' });
}

export function applyStoreSellInPoolToAllMonths(pool: number | undefined): void {
  if (pool === undefined) {
    localStorage.removeItem(STORAGE_KEY_STORE_SELLIN_POOL);
  } else {
    localStorage.setItem(STORAGE_KEY_STORE_SELLIN_POOL, String(Math.max(0, Math.round(pool))));
  }
  const monthly = loadMonthlyTargets();
  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    if (pool === undefined) {
      delete monthly[m.key].storeSellInPool;
    } else {
      monthly[m.key].storeSellInPool = Math.max(0, Math.round(pool));
    }
  });
  saveMonthlyTargets(monthly);
  clearBaQuarterlySellInOverridesForMonths();
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'store_sellin_pool_all' });
}

export function setSingleStoreSellInOverride(
  storeName: string,
  value: number,
  monthKey?: string
): void {
  const norm = normalizeMonthKey(monthKey);
  const cleanVal = Math.max(0, Math.round(value));
  if (norm === 'ALL') {
    const current = readGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS);
    upsertCaseInsensitiveKey(current, storeName, cleanVal);
    writeGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS, current);
  } else {
    const monthly = loadMonthlyTargets();
    if (!monthly[norm]) monthly[norm] = {};
    if (!monthly[norm].storeSellIn) monthly[norm].storeSellIn = {};
    upsertCaseInsensitiveKey(monthly[norm].storeSellIn!, storeName, cleanVal);
    saveMonthlyTargets(monthly);
  }
  clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  notifyTargetsUpdated({ monthKey: norm, category: 'store_sellin' });
}

export function applySingleStoreSellInToAllMonths(storeName: string, value: number): void {
  const cleanVal = Math.max(0, Math.round(value));
  const globalMap = readGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS);
  upsertCaseInsensitiveKey(globalMap, storeName, cleanVal);
  writeGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS, globalMap);

  const monthly = loadMonthlyTargets();
  MONTH_OPTIONS_2026.forEach((m) => {
    if (!monthly[m.key]) monthly[m.key] = {};
    if (!monthly[m.key].storeSellIn) monthly[m.key].storeSellIn = {};
    upsertCaseInsensitiveKey(monthly[m.key].storeSellIn!, storeName, cleanVal);
  });
  saveMonthlyTargets(monthly);
  clearBaQuarterlySellInOverridesForMonths();
  notifyTargetsUpdated({ monthKey: 'ALL', category: 'store_sellin_all' });
}

export function clearSingleStoreSellInOverride(storeName: string, monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  const upperTarget = storeName.trim().toUpperCase();
  const removeCI = (map: Record<string, number>) => {
    Object.keys(map).forEach((k) => {
      if (k.trim().toUpperCase() === upperTarget) {
        delete map[k];
      }
    });
  };

  if (norm === 'ALL') {
    const globalMap = readGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS);
    removeCI(globalMap);
    writeGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS, globalMap);
    const monthly = loadMonthlyTargets();
    MONTH_OPTIONS_2026.forEach((m) => {
      if (monthly[m.key]?.storeSellIn) {
        removeCI(monthly[m.key].storeSellIn!);
      }
    });
    saveMonthlyTargets(monthly);
  } else {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]?.storeSellIn) {
      removeCI(monthly[norm].storeSellIn!);
      saveMonthlyTargets(monthly);
    }
    // Also clean global fallback key if present so this month reverts cleanly to formula
    const globalMap = readGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS);
    if (Object.keys(globalMap).some((k) => k.trim().toUpperCase() === upperTarget)) {
      removeCI(globalMap);
      writeGlobalMap(STORAGE_KEY_STORE_SELLIN_TARGETS, globalMap);
    }
  }
  clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  notifyTargetsUpdated({ monthKey: norm, category: 'store_sellin_reset_one' });
}

export function clearAllStoreSellInOverrides(monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') {
    localStorage.removeItem(STORAGE_KEY_STORE_SELLIN_TARGETS);
    const monthly = loadMonthlyTargets();
    MONTH_OPTIONS_2026.forEach((m) => {
      if (monthly[m.key]) {
        delete monthly[m.key].storeSellIn;
      }
    });
    saveMonthlyTargets(monthly);
  } else {
    const monthly = loadMonthlyTargets();
    if (monthly[norm]) {
      delete monthly[norm].storeSellIn;
      saveMonthlyTargets(monthly);
    }
  }
  clearBaQuarterlySellInOverridesForMonths(norm !== 'ALL' ? [norm] : undefined);
  notifyTargetsUpdated({ monthKey: norm, category: 'store_sellin_reset_all' });
}

const normStoreExactKey = (s: string): string => s.trim().toUpperCase().replace(/\s+/g, ' ');
const normStoreNoPrefixKey = (s: string): string =>
  normalizeStoreAlnum(s.replace(/^\s*(TOKO|TK)\b\.?\s*/i, ''));
const normStoreKosmetikKey = (s: string): string =>
  normStoreNoPrefixKey(s).replace(/cosmetic/g, 'kosmetik').replace(/cosmetik/g, 'kosmetik');

function findStoreOverrideValue(
  map: Record<string, number>,
  storeName: string
): number | undefined {
  const direct = findMapValueCaseInsensitive(map, storeName);
  if (direct !== undefined) return direct;
  const exact = normStoreExactKey(storeName);
  const alnum = normalizeStoreAlnum(storeName);
  const noPrefix = normStoreNoPrefixKey(storeName);
  const kosmetik = normStoreKosmetikKey(storeName);

  for (const [k, v] of Object.entries(map)) {
    if (
      normStoreExactKey(k) === exact ||
      (alnum && normalizeStoreAlnum(k) === alnum) ||
      (noPrefix && normStoreNoPrefixKey(k) === noPrefix) ||
      (kosmetik && normStoreKosmetikKey(k) === kosmetik)
    ) {
      return v;
    }
  }
  return undefined;
}

/**
 * Syncs a BA/Store quarterly Target Sell In edit made inside Achieve Quartal
 * back into monthly Store Sell In overrides in Kelola Target so both menus remain synced.
 */
export function syncQuarterBaSellInToStores(params: {
  year: number;
  quarter: QuarterPeriodKey;
  baName: string;
  storeName: string;
  quarterTargetSellIn: number;
  monthlyBreakdown?: Array<{ monthIndex: number; targetSellIn?: number; assignedStores?: string[] }>;
}): boolean {
  const qMonthKeys = QUARTER_KEY_MONTHS[params.quarter];
  if (!qMonthKeys) return false;
  const totalQuarterTarget = Math.max(0, Math.round(params.quarterTargetSellIn));

  const fallbackStores = (params.storeName || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s.toUpperCase() !== 'COUNTER TOKO');

  const monthly = loadMonthlyTargets();
  const existingMonthWeights: [number, number, number] = [0, 0, 0];
  const monthStores: [string[], string[], string[]] = [[], [], []];

  qMonthKeys.forEach((mKey, idx) => {
    const mb = params.monthlyBreakdown?.[idx];
    const storesForMonth =
      mb?.assignedStores && mb.assignedStores.length > 0 ? mb.assignedStores : fallbackStores;
    monthStores[idx] = storesForMonth;
    existingMonthWeights[idx] = Math.max(0, mb?.targetSellIn || 0);
  });

  if (monthStores.every((arr) => arr.length === 0)) {
    return false;
  }

  // Distribute totalQuarterTarget across the 3 months preserving existing monthly ratios & exact integer sum
  const weightSum = existingMonthWeights[0] + existingMonthWeights[1] + existingMonthWeights[2];
  const monthlyTargets: [number, number, number] = [0, 0, 0];
  if (weightSum > 0) {
    monthlyTargets[0] = Math.round(totalQuarterTarget * (existingMonthWeights[0] / weightSum));
    monthlyTargets[1] = Math.round(totalQuarterTarget * (existingMonthWeights[1] / weightSum));
    monthlyTargets[2] = Math.max(0, totalQuarterTarget - monthlyTargets[0] - monthlyTargets[1]);
  } else {
    const part = Math.floor(totalQuarterTarget / 3);
    monthlyTargets[0] = part;
    monthlyTargets[1] = part;
    monthlyTargets[2] = Math.max(0, totalQuarterTarget - part * 2);
  }

  let updatedStores = 0;
  qMonthKeys.forEach((mKey, idx) => {
    const stores = monthStores[idx];
    if (stores.length === 0) return;
    if (!monthly[mKey]) monthly[mKey] = {};
    if (!monthly[mKey].storeSellIn) monthly[mKey].storeSellIn = {};

    const mTarget = monthlyTargets[idx];
    if (stores.length === 1) {
      upsertCaseInsensitiveKey(monthly[mKey].storeSellIn!, stores[0], mTarget);
      updatedStores++;
    } else {
      const storeWeights = stores.map((s) =>
        Math.max(1, findStoreOverrideValue(monthly[mKey].storeSellIn!, s) ?? 1)
      );
      const swSum = storeWeights.reduce((a, b) => a + b, 0);
      let running = 0;
      stores.forEach((s, sIdx) => {
        const val =
          sIdx === stores.length - 1
            ? Math.max(0, mTarget - running)
            : Math.round(mTarget * (storeWeights[sIdx] / (swSum || 1)));
        running += val;
        upsertCaseInsensitiveKey(monthly[mKey].storeSellIn!, s, val);
        updatedStores++;
      });
    }
  });

  if (updatedStores === 0) return false;

  saveMonthlyTargets(monthly);
  clearBaQuarterlySellInOverridesForMonths(qMonthKeys, params.baName);
  notifyTargetsUpdated({ category: 'store_sellin_sync_from_quartal' });
  return true;
}

const MONTH_UPPER_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

function extractRecordMonthYearStrict(r: TransactionRecord): { monthIndex: number; year: number } | null {
  let parsedTanggal: { monthIndex: number; year: number } | null = null;
  if (r.TANGGAL) {
    const trimmed = r.TANGGAL.trim();
    const parts = trimmed.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const yr = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(yr) && !isNaN(m) && m >= 0 && m <= 11) parsedTanggal = { monthIndex: m, year: yr };
      } else {
        const m = parseInt(parts[0], 10) - 1;
        const rawYr = parseInt(parts[2], 10);
        const yr = rawYr < 100 ? 2000 + rawYr : rawYr;
        if (!isNaN(yr) && !isNaN(m) && m >= 0 && m <= 11) parsedTanggal = { monthIndex: m, year: yr };
      }
    }
  }

  if (r.BULAN) {
    const bUpper = r.BULAN.trim().toUpperCase();
    const fullIdx = MONTH_UPPER_NAMES.findIndex((m) => bUpper.includes(m));
    if (fullIdx !== -1) {
      const yr = r.TAHUN || parsedTanggal?.year || 2026;
      return { monthIndex: fullIdx, year: yr };
    }
    const metaMatch = MONTH_OPTIONS_2026.find((meta) =>
      meta.aliases.some((alias) => bUpper === alias || bUpper.includes(alias))
    );
    if (metaMatch) {
      const yr = r.TAHUN || parsedTanggal?.year || 2026;
      return { monthIndex: metaMatch.monthIndex, year: yr };
    }
  }

  return parsedTanggal;
}

function classifySellKetForStore(ketRaw?: string): 'SELL IN' | 'SELL OUT' | 'OTHER' {
  const upper = (ketRaw || '').toUpperCase().trim();
  if (upper.includes('RETURN') || upper.includes('RETUR')) return 'OTHER';
  if (
    upper.includes('SELL IN') ||
    upper.includes('SELL-IN') ||
    upper === 'SELLIN' ||
    upper.includes('TAKING ORDER')
  ) {
    return 'SELL IN';
  }
  if (upper.includes('SELL OUT') || upper.includes('SELL-OUT') || upper === 'SELLOUT') {
    return 'SELL OUT';
  }
  return 'OTHER';
}

function getPrior3Months(targetYear: number, targetMonthIdx: number): Array<{ year: number; monthIndex: number; key: string; label: string }> {
  const list: Array<{ year: number; monthIndex: number; key: string; label: string }> = [];
  for (let offset = 3; offset >= 1; offset--) {
    const rawIdx = targetMonthIdx - offset;
    const pYear = rawIdx >= 0 ? targetYear : targetYear - 1;
    const pMonthIdx = rawIdx >= 0 ? rawIdx : 12 + rawIdx;
    const meta = MONTH_OPTIONS_2026[pMonthIdx];
    const yrSuffix = pYear !== targetYear ? ` '${String(pYear).slice(-2)}` : '';
    list.push({
      year: pYear,
      monthIndex: pMonthIdx,
      key: `${pYear}-${String(pMonthIdx + 1).padStart(2, '0')}`,
      label: `${meta ? meta.shortLabel : String(pMonthIdx + 1)}${yrSuffix}`,
    });
  }
  return list;
}

interface ParsedStoreUniverse {
  stores: Map<
    string,
    {
      displayName: string;
      baName: string;
      coverArea: string;
      region: string;
      spv: string;
      salesWeights: Map<string, number>;
      primarySalesName: string;
      sellInByYM: Map<string, number>;
      totalSellInAllMonths: number;
    }
  >;
  salesNames: Set<string>;
  activeSellInYMs: Set<string>;
}

function buildStoreSellInUniverse(records: TransactionRecord[]): ParsedStoreUniverse {
  const customBaProfiles = loadCustomBaProfiles();
  const customProfileByStoreUpper = new Map<string, CustomBaProfile>();
  const customProfileByBaUpper = new Map<string, CustomBaProfile>();

  Object.values(customBaProfiles).forEach((p) => {
    if (p.originalStoreName) {
      customProfileByStoreUpper.set(normStoreExactKey(p.originalStoreName), p);
    }
    if (p.storeName) {
      p.storeName.split(',').forEach((part) => {
        const s = normStoreExactKey(part);
        if (s) customProfileByStoreUpper.set(s, p);
      });
    }
    const baUp = normalizeBaGroupKey(p.baName);
    if (!isGenericBaPlaceholder(baUp)) {
      customProfileByBaUpper.set(baUp, p);
    }
  });

  const stores: ParsedStoreUniverse['stores'] = new Map();
  const salesNames = new Set<string>();
  const activeSellInYMs = new Set<string>();

  const ensureStore = (
    rawDisplay: string,
    area: string,
    region: string,
    spv: string,
    baName: string,
    salesName: string
  ) => {
    const cleanDisplay = rawDisplay.trim().replace(/\s+/g, ' ');
    const normKey = normStoreExactKey(cleanDisplay);
    if (!normKey || normKey === '-' || normKey === 'ALL' || normKey === 'UNKNOWN' || normKey === 'COUNTER TOKO') {
      return null;
    }
    if (!stores.has(normKey)) {
      stores.set(normKey, {
        displayName: cleanDisplay,
        baName: '-',
        coverArea: area && area !== '-' ? area : 'AREA BARU',
        region: region && region !== '-' ? region : 'PEKAN BARU',
        spv: spv && spv !== '-' ? spv : 'WIDODO',
        salesWeights: new Map(),
        primarySalesName: salesName && salesName !== '-' ? salesName.trim().toUpperCase() : 'UNKNOWN',
        sellInByYM: new Map(),
        totalSellInAllMonths: 0,
      });
    }
    const entry = stores.get(normKey)!;
    const cleanBaNorm = normalizeBaGroupKey(baName);
    if (!isGenericBaPlaceholder(cleanBaNorm)) {
      entry.baName = baName.trim().replace(/\s+/g, ' ');
    }
    if ((!entry.coverArea || entry.coverArea === 'AREA BARU') && area && area !== '-') {
      entry.coverArea = area;
    }
    if ((!entry.region || entry.region === 'PEKAN BARU') && region && region !== '-') {
      entry.region = region;
    }
    if ((!entry.spv || entry.spv === 'WIDODO') && spv && spv !== '-') {
      entry.spv = spv;
    }
    return entry;
  };

  records.forEach((r) => {
    const rawSales = (r.SALES || 'UNKNOWN').trim().toUpperCase();
    if (rawSales && rawSales !== 'UNKNOWN' && rawSales !== '-') {
      salesNames.add(rawSales);
    }

    const rawStore = (r.NAMA_STORE || '').trim();
    const storeProfileMatch = rawStore ? customProfileByStoreUpper.get(normStoreExactKey(rawStore)) : undefined;
    const resolvedStore =
      storeProfileMatch &&
      storeProfileMatch.originalStoreName &&
      normStoreExactKey(storeProfileMatch.originalStoreName) === normStoreExactKey(rawStore)
        ? storeProfileMatch.storeName
        : rawStore;

    const baProfileMatch = !storeProfileMatch ? customProfileByBaUpper.get(normalizeBaGroupKey(r.BA)) : undefined;
    const resolvedBa = storeProfileMatch
      ? storeProfileMatch.baName
      : baProfileMatch
      ? baProfileMatch.baName
      : (r.BA || '');
    const resolvedSales =
      (storeProfileMatch?.salesName && storeProfileMatch.salesName !== '-' ? storeProfileMatch.salesName : '') ||
      rawSales;
    const resolvedArea =
      (storeProfileMatch?.coverArea && storeProfileMatch.coverArea !== '-' ? storeProfileMatch.coverArea : '') ||
      r.COVER_AREA ||
      'AREA BARU';
    const resolvedRegion =
      (storeProfileMatch?.region && storeProfileMatch.region !== '-' ? storeProfileMatch.region : '') ||
      r.REGION ||
      'PEKAN BARU';
    const resolvedSpv =
      (storeProfileMatch?.spv && storeProfileMatch.spv !== '-' ? storeProfileMatch.spv : '') ||
      r.SPV ||
      'WIDODO';

    const entry = ensureStore(resolvedStore, resolvedArea, resolvedRegion, resolvedSpv, resolvedBa, resolvedSales);
    if (!entry) return;

    const ketType = classifySellKetForStore(r.KET);
    const val = Math.max(0, r.VALUE || 0);
    const salesUpper = resolvedSales.trim().toUpperCase();
    if (salesUpper && salesUpper !== 'UNKNOWN' && salesUpper !== '-') {
      const weightAdd = ketType === 'SELL IN' && val > 0 ? val : 1;
      entry.salesWeights.set(salesUpper, (entry.salesWeights.get(salesUpper) || 0) + weightAdd);
    }

    if (ketType === 'SELL IN') {
      const dt = extractRecordMonthYearStrict(r);
      if (dt) {
        const ymKey = `${dt.year}-${String(dt.monthIndex + 1).padStart(2, '0')}`;
        if (val > 0) activeSellInYMs.add(ymKey);
        entry.sellInByYM.set(ymKey, (entry.sellInByYM.get(ymKey) || 0) + val);
      }
      entry.totalSellInAllMonths += val;
    }
  });

  // Also include stores manually added via customBaProfiles
  Object.values(customBaProfiles).forEach((profile) => {
    const tokens = (profile.storeName || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    tokens.forEach((tok) => {
      ensureStore(
        tok,
        profile.coverArea || 'PEKANBARU',
        profile.region || 'PEKAN BARU',
        profile.spv || 'WIDODO',
        profile.baName || '',
        profile.salesName || 'ILHAMSYAH'
      );
    });
  });

  // Finalize primary Sales for every store
  stores.forEach((entry) => {
    if (entry.salesWeights.size > 0) {
      let bestSales = entry.primarySalesName;
      let bestWeight = -1;
      entry.salesWeights.forEach((w, sName) => {
        if (w > bestWeight) {
          bestWeight = w;
          bestSales = sName;
        }
      });
      entry.primarySalesName = bestSales;
    }
  });

  return { stores, salesNames, activeSellInYMs };
}

function getSalesTargetForMonthFromSalesMap(
  salesTargetsMap: Record<string, number>,
  salesName: string
): number {
  const upper = salesName.trim().toUpperCase();
  const direct = findMapValueCaseInsensitive(salesTargetsMap, upper);
  if (direct !== undefined) return direct;
  if (upper === 'ALBERT') {
    const alt = findMapValueCaseInsensitive(salesTargetsMap, 'ALBERT FERNANDO');
    if (alt !== undefined) return alt;
  } else if (upper === 'ALBERT FERNANDO') {
    const alt = findMapValueCaseInsensitive(salesTargetsMap, 'ALBERT');
    if (alt !== undefined) return alt;
  }
  return DEFAULT_SALES_TARGET;
}

function computeSingleMonthStoreSellInInternal(
  universe: ParsedStoreUniverse,
  monthKey: string,
  year: number,
  formulaMode: StoreSellInFormulaMode
): StoreSellInMatrixResult {
  const normMonth = normalizeMonthKey(monthKey);
  const meta = normMonth !== 'ALL' ? MONTH_OPTIONS_2026.find((m) => m.key === normMonth) : undefined;

  const salesTargetsMap = loadSalesTargets(normMonth);
  const salesNamesList =
    universe.salesNames.size > 0
      ? Array.from(universe.salesNames)
      : ['ILHAMSYAH', 'TIWI', 'ABDUL RAHIM', 'LUAR KOTA', 'PARETO', 'ALBERT FERNANDO'];

  let defaultSalesPoolTarget = 0;
  const salesTargetByName = new Map<string, number>();
  salesNamesList.forEach((sName) => {
    const val = getSalesTargetForMonthFromSalesMap(salesTargetsMap, sName);
    salesTargetByName.set(sName.trim().toUpperCase(), val);
    defaultSalesPoolTarget += val;
  });
  if (defaultSalesPoolTarget <= 0) {
    defaultSalesPoolTarget = DEFAULT_SALES_TARGET * 6;
  }

  const explicitPool = loadStoreSellInPool(normMonth);
  const isPoolCustom = explicitPool !== undefined;
  const poolTarget = explicitPool !== undefined ? explicitPool : defaultSalesPoolTarget;
  const customStoreTargets = loadStoreSellInTargets(normMonth);

  // Determine prior 3 months for Avg Sell In 3 Bulan Sebelumnya
  let priorWindow: Array<{ key: string; label: string }> = [];
  let activePriorYMs: Array<{ key: string; label: string }> = [];
  let priorPeriodDescription = '';

  if (meta) {
    const targetYM = `${year}-${String(meta.monthIndex + 1).padStart(2, '0')}`;
    const candidate3 = getPrior3Months(year, meta.monthIndex);
    priorWindow = candidate3.map((c) => ({ key: c.key, label: c.label }));
    activePriorYMs = priorWindow.filter((c) => universe.activeSellInYMs.has(c.key));
    if (activePriorYMs.length > 0) {
      priorPeriodDescription = `Rata-rata ${activePriorYMs.length} Bln Sebelumnya (${activePriorYMs.map((a) => a.label).join(', ')})`;
    } else {
      priorPeriodDescription = `Share Sell In Data Aktif (Belum ada data 3 bln sebelum ${meta.label})`;
    }
    void targetYM;
  } else {
    // Baseline 'ALL' fallback when no specific months configured
    const sortedYMs = Array.from(universe.activeSellInYMs).sort();
    const recent3 = sortedYMs.slice(-3);
    priorWindow = recent3.map((ym) => {
      const [yStr, mStr] = ym.split('-');
      const mMeta = MONTH_OPTIONS_2026[Math.max(0, (parseInt(mStr, 10) || 1) - 1)];
      return { key: ym, label: mMeta ? `${mMeta.shortLabel} '${yStr.slice(-2)}` : ym };
    });
    activePriorYMs = priorWindow;
    priorPeriodDescription =
      activePriorYMs.length > 0
        ? `Rata-rata ${activePriorYMs.length} Bln Terakhir (${activePriorYMs.map((a) => a.label).join(', ')})`
        : 'Distribusi Merata (Belum ada historis Sell In)';
  }

  const divisor = activePriorYMs.length > 0 ? activePriorYMs.length : Math.max(1, universe.activeSellInYMs.size);

  // Compute raw prior 3M totals & averages per store and per sales
  const rawStoreStats: Array<{
    displayName: string;
    baName: string;
    coverArea: string;
    region: string;
    salesName: string;
    spv: string;
    priorTotal: number;
    priorAvg: number;
    actualSellIn: number;
  }> = [];

  let totalPrior3MonthsAvg = 0;
  const salesAvgTotal = new Map<string, number>();
  const salesStoreCount = new Map<string, number>();

  const targetYMKey = meta ? `${year}-${String(meta.monthIndex + 1).padStart(2, '0')}` : null;

  universe.stores.forEach((st) => {
    let priorTotal = 0;
    if (activePriorYMs.length > 0) {
      activePriorYMs.forEach((p) => {
        priorTotal += st.sellInByYM.get(p.key) || 0;
      });
    } else {
      priorTotal = st.totalSellInAllMonths;
    }
    const priorAvg = priorTotal / divisor;
    totalPrior3MonthsAvg += priorAvg;

    const sUp = st.primarySalesName.trim().toUpperCase();
    salesAvgTotal.set(sUp, (salesAvgTotal.get(sUp) || 0) + priorAvg);
    salesStoreCount.set(sUp, (salesStoreCount.get(sUp) || 0) + 1);

    const actualSellIn = targetYMKey ? st.sellInByYM.get(targetYMKey) || 0 : st.totalSellInAllMonths;

    rawStoreStats.push({
      displayName: st.displayName,
      baName: st.baName,
      coverArea: st.coverArea,
      region: st.region,
      salesName: st.primarySalesName,
      spv: st.spv,
      priorTotal,
      priorAvg,
      actualSellIn,
    });
  });

  const storeCount = rawStoreStats.length;
  const poolScaleFactor =
    isPoolCustom && defaultSalesPoolTarget > 0 ? poolTarget / defaultSalesPoolTarget : 1;

  let totalAutoTargetSellIn = 0;
  let totalEffectiveTargetSellIn = 0;
  let totalActualSellIn = 0;
  let customOverrideCount = 0;

  const storeItems: StoreSellInTargetItem[] = rawStoreStats.map((st) => {
    const sUp = st.salesName.trim().toUpperCase();
    const sAvg = salesAvgTotal.get(sUp) || 0;
    const sCnt = salesStoreCount.get(sUp) || 1;
    const baseSalesTarget = salesTargetByName.get(sUp) ?? DEFAULT_SALES_TARGET;
    const scaledSalesTarget = isPoolCustom
      ? Math.round(baseSalesTarget * poolScaleFactor)
      : baseSalesTarget;

    const globalContributionPct =
      totalPrior3MonthsAvg > 0
        ? (st.priorAvg / totalPrior3MonthsAvg) * 100
        : storeCount > 0
        ? 100 / storeCount
        : 0;

    let contributionPct = globalContributionPct;
    let autoTargetSellIn = 0;
    let salesTargetSellInBasis = poolTarget;

    if (formulaMode === 'per_sales') {
      salesTargetSellInBasis = scaledSalesTarget;
      if (sAvg > 0) {
        contributionPct = (st.priorAvg / sAvg) * 100;
        autoTargetSellIn = Math.round((contributionPct / 100) * scaledSalesTarget);
      } else if (totalPrior3MonthsAvg === 0) {
        contributionPct = sCnt > 0 ? 100 / sCnt : 0;
        autoTargetSellIn = Math.round((contributionPct / 100) * scaledSalesTarget);
      } else {
        contributionPct = 0;
        autoTargetSellIn = 0;
      }
    } else {
      contributionPct = globalContributionPct;
      salesTargetSellInBasis = poolTarget;
      autoTargetSellIn = Math.round((contributionPct / 100) * poolTarget);
    }

    const customOverride = findStoreOverrideValue(customStoreTargets, st.displayName);
    const isCustom = customOverride !== undefined;
    if (isCustom) customOverrideCount++;

    const targetSellIn = isCustom ? customOverride! : autoTargetSellIn;
    const gapSellIn = st.actualSellIn - targetSellIn;
    const achievementPct = targetSellIn > 0 ? (st.actualSellIn / targetSellIn) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    totalAutoTargetSellIn += autoTargetSellIn;
    totalEffectiveTargetSellIn += targetSellIn;
    totalActualSellIn += st.actualSellIn;

    return {
      storeName: st.displayName,
      baName: st.baName,
      coverArea: st.coverArea,
      region: st.region,
      salesName: st.salesName,
      spv: st.spv,
      prior3MonthsTotalSellIn: st.priorTotal,
      prior3MonthsAvgSellIn: st.priorAvg,
      priorMonthLabels: priorWindow.map((p) => p.label),
      salesPrior3MonthsAvgSellIn: sAvg,
      salesTargetSellInBasis,
      contributionPct,
      globalContributionPct,
      autoTargetSellIn,
      targetSellIn,
      actualSellIn: st.actualSellIn,
      gapSellIn,
      achievementPct,
      status,
      isCustom,
    };
  });

  storeItems.sort((a, b) => b.targetSellIn - a.targetSellIn || b.prior3MonthsAvgSellIn - a.prior3MonthsAvgSellIn);

  const overallAch = totalEffectiveTargetSellIn > 0 ? (totalActualSellIn / totalEffectiveTargetSellIn) * 100 : 0;

  return {
    stores: storeItems,
    formulaMode,
    poolTarget,
    isPoolCustom,
    defaultSalesPoolTarget,
    priorPeriodDescription,
    priorMonthLabels: priorWindow.map((p) => p.label),
    totalPrior3MonthsAvg,
    totalAutoTargetSellIn,
    totalEffectiveTargetSellIn,
    totalActualSellIn,
    achievementPct: overallAch,
    customOverrideCount,
    accumulatedMonthCount: 1,
    isMultiMonthAccumulated: false,
  };
}

export interface MonthlyStoreSellInLookupBucket {
  poolTarget: number;
  byExact: Map<string, StoreSellInTargetItem>;
  byAlnum: Map<string, StoreSellInTargetItem>;
  byNoPrefix: Map<string, StoreSellInTargetItem>;
  byKosmetik: Map<string, StoreSellInTargetItem>;
}

export function findStoreSellInInLookup(
  bucket: MonthlyStoreSellInLookupBucket | undefined,
  rawStoreName?: string
): StoreSellInTargetItem | undefined {
  if (!bucket || !rawStoreName) return undefined;
  const clean = rawStoreName.trim();
  if (!clean || clean === '-' || clean.toUpperCase() === 'ALL') return undefined;
  const exactHit = bucket.byExact.get(normStoreExactKey(clean));
  if (exactHit) return exactHit;
  const alnumHit = bucket.byAlnum.get(normalizeStoreAlnum(clean));
  if (alnumHit) return alnumHit;
  const noPrefixHit = bucket.byNoPrefix.get(normStoreNoPrefixKey(clean));
  if (noPrefixHit) return noPrefixHit;
  const kosmetikHit = bucket.byKosmetik.get(normStoreKosmetikKey(clean));
  if (kosmetikHit) return kosmetikHit;
  return undefined;
}

/**
 * Fast batched computation of Store Sell In targets for multiple months in a single pass
 * over TransactionRecord[] (used by Achieve Quartal / quarterlySummaryService).
 */
export function computeMonthlyStoreSellInLookup(
  records: TransactionRecord[],
  monthNamesOrKeys: string[],
  year: number = 2026
): Record<string, MonthlyStoreSellInLookupBucket> {
  const universe = buildStoreSellInUniverse(records);
  const formulaMode = loadStoreSellInFormulaMode();
  const result: Record<string, MonthlyStoreSellInLookupBucket> = {};

  monthNamesOrKeys.forEach((mk) => {
    const norm = normalizeMonthKey(mk);
    const res = computeSingleMonthStoreSellInInternal(universe, norm, year, formulaMode);
    const byExact = new Map<string, StoreSellInTargetItem>();
    const byAlnum = new Map<string, StoreSellInTargetItem>();
    const byNoPrefix = new Map<string, StoreSellInTargetItem>();
    const byKosmetik = new Map<string, StoreSellInTargetItem>();

    res.stores.forEach((item) => {
      const k1 = normStoreExactKey(item.storeName);
      const k2 = normalizeStoreAlnum(item.storeName);
      const k3 = normStoreNoPrefixKey(item.storeName);
      const k4 = normStoreKosmetikKey(item.storeName);
      if (k1) byExact.set(k1, item);
      if (k2) byAlnum.set(k2, item);
      if (k3) byNoPrefix.set(k3, item);
      if (k4) byKosmetik.set(k4, item);
    });

    const bucket: MonthlyStoreSellInLookupBucket = {
      poolTarget: res.poolTarget,
      byExact,
      byAlnum,
      byNoPrefix,
      byKosmetik,
    };
    result[mk] = bucket;
    if (norm !== mk) result[norm] = bucket;
  });

  return result;
}

/**
 * Computes Store Sell In Target matrix for Kelola Target (single month or accumulated ALL configured months).
 */
export function computeStoreSellInMatrix(
  records: TransactionRecord[],
  selectedMonth?: string,
  year: number = 2026
): StoreSellInMatrixResult {
  const normMonth = normalizeMonthKey(selectedMonth);
  const formulaMode = loadStoreSellInFormulaMode();
  const universe = buildStoreSellInUniverse(records);

  if (normMonth !== 'ALL') {
    return computeSingleMonthStoreSellInInternal(universe, normMonth, year, formulaMode);
  }

  const configuredMonths = getConfiguredMonthKeys();
  if (configuredMonths.length === 0) {
    return computeSingleMonthStoreSellInInternal(universe, 'ALL', year, formulaMode);
  }

  // Accumulate across all configured months
  const monthlyResults = configuredMonths.map((mk) =>
    computeSingleMonthStoreSellInInternal(universe, mk, year, formulaMode)
  );

  const accMap = new Map<
    string,
    {
      base: StoreSellInTargetItem;
      sumPriorTotal: number;
      sumPriorAvg: number;
      sumContribution: number;
      sumGlobalContribution: number;
      sumSalesAvg: number;
      sumSalesBasis: number;
      sumAutoTarget: number;
      sumTarget: number;
      sumActual: number;
      anyCustom: boolean;
    }
  >();

  let totalPoolTarget = 0;
  let totalDefaultPoolTarget = 0;
  let anyPoolCustom = false;

  monthlyResults.forEach((mr) => {
    totalPoolTarget += mr.poolTarget;
    totalDefaultPoolTarget += mr.defaultSalesPoolTarget;
    if (mr.isPoolCustom) anyPoolCustom = true;

    mr.stores.forEach((st) => {
      const k = normStoreExactKey(st.storeName);
      if (!accMap.has(k)) {
        accMap.set(k, {
          base: st,
          sumPriorTotal: 0,
          sumPriorAvg: 0,
          sumContribution: 0,
          sumGlobalContribution: 0,
          sumSalesAvg: 0,
          sumSalesBasis: 0,
          sumAutoTarget: 0,
          sumTarget: 0,
          sumActual: 0,
          anyCustom: false,
        });
      }
      const acc = accMap.get(k)!;
      acc.sumPriorTotal += st.prior3MonthsTotalSellIn;
      acc.sumPriorAvg += st.prior3MonthsAvgSellIn;
      acc.sumContribution += st.contributionPct;
      acc.sumGlobalContribution += st.globalContributionPct;
      acc.sumSalesAvg += st.salesPrior3MonthsAvgSellIn;
      acc.sumSalesBasis += st.salesTargetSellInBasis;
      acc.sumAutoTarget += st.autoTargetSellIn;
      acc.sumTarget += st.targetSellIn;
      acc.sumActual += st.actualSellIn;
      if (st.isCustom) acc.anyCustom = true;
    });
  });

  const mCount = monthlyResults.length;
  let totalPriorAvg = 0;
  let totalAuto = 0;
  let totalEff = 0;
  let totalAct = 0;
  let customCount = 0;

  const stores: StoreSellInTargetItem[] = [];
  accMap.forEach((acc) => {
    const avgPriorAvg = acc.sumPriorAvg / mCount;
    const avgPriorTotal = acc.sumPriorTotal / mCount;
    const avgContribution = acc.sumContribution / mCount;
    const avgGlobalContribution = acc.sumGlobalContribution / mCount;
    const gapSellIn = acc.sumActual - acc.sumTarget;
    const achievementPct = acc.sumTarget > 0 ? (acc.sumActual / acc.sumTarget) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    if (acc.anyCustom) customCount++;
    totalPriorAvg += avgPriorAvg;
    totalAuto += acc.sumAutoTarget;
    totalEff += acc.sumTarget;
    totalAct += acc.sumActual;

    stores.push({
      ...acc.base,
      prior3MonthsTotalSellIn: avgPriorTotal,
      prior3MonthsAvgSellIn: avgPriorAvg,
      salesPrior3MonthsAvgSellIn: acc.sumSalesAvg / mCount,
      salesTargetSellInBasis: acc.sumSalesBasis,
      contributionPct: avgContribution,
      globalContributionPct: avgGlobalContribution,
      autoTargetSellIn: acc.sumAutoTarget,
      targetSellIn: acc.sumTarget,
      actualSellIn: acc.sumActual,
      gapSellIn,
      achievementPct,
      status,
      isCustom: acc.anyCustom,
    });
  });

  stores.sort((a, b) => b.targetSellIn - a.targetSellIn || b.prior3MonthsAvgSellIn - a.prior3MonthsAvgSellIn);

  return {
    stores,
    formulaMode,
    poolTarget: totalPoolTarget,
    isPoolCustom: anyPoolCustom,
    defaultSalesPoolTarget: totalDefaultPoolTarget,
    priorPeriodDescription: `Akumulasi ${mCount} Bulan (${configuredMonths
      .map((k) => MONTH_OPTIONS_2026.find((m) => m.key === k)?.shortLabel || k)
      .join(', ')}) — Rata-rata 3 Bln Sblm per bulan`,
    priorMonthLabels: configuredMonths.map(
      (k) => MONTH_OPTIONS_2026.find((m) => m.key === k)?.shortLabel || k
    ),
    totalPrior3MonthsAvg: totalPriorAvg,
    totalAutoTargetSellIn: totalAuto,
    totalEffectiveTargetSellIn: totalEff,
    totalActualSellIn: totalAct,
    achievementPct: totalEff > 0 ? (totalAct / totalEff) * 100 : 0,
    customOverrideCount: customCount,
    accumulatedMonthCount: mCount,
    isMultiMonthAccumulated: true,
  };
}

export interface SpvMonthTargetEntry {
  targetSellIn: number;
  targetSellOut: number;
  spvLabel: string;
}

export interface MonthlySpvTargetsResult {
  byKey: Record<string, SpvMonthTargetEntry>;
  spvScopeLabel: string;
  targetMode: 'spv' | 'sales' | 'store';
  targetEntityLabel: string;
}

function normalizeSpvDirectoryToken(val?: string): string {
  return (val || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function lookupSalesMapWithAliases(
  map: Record<string, number>,
  salesName: string
): number | undefined {
  const direct = findMapValueCaseInsensitive(map, salesName);
  if (direct !== undefined) return direct;
  const upper = normalizeSpvDirectoryToken(salesName);
  if (upper === 'ALBERT') {
    const alt = findMapValueCaseInsensitive(map, 'ALBERT FERNANDO');
    if (alt !== undefined) return alt;
  } else if (upper === 'ALBERT FERNANDO') {
    const alt = findMapValueCaseInsensitive(map, 'ALBERT');
    if (alt !== undefined) return alt;
  }
  const matchedKey = Object.keys(map).find((k) => {
    const kn = normalizeSpvDirectoryToken(k);
    return kn && (kn.startsWith(upper) || upper.startsWith(kn));
  });
  return matchedKey !== undefined ? map[matchedKey] : undefined;
}

/**
 * Resolves per-month Target (Sell In & Sell Out) configured in Kelola Target
 * following the integrated filters:
 * 1. Specific NAMA_STORE -> Store Sell In Target & Store/BA Sell Out Target
 * 2. Specific SALES -> Sales Sell In Target & Sales Sell Out Target
 * 3. Default / ALL Sales -> Target SPV (displayed as Target ALL)
 */
export function buildMonthlySpvTargetsMap(
  records: TransactionRecord[],
  filters?: {
    TAHUN?: string;
    SPV?: string;
    REGION?: string;
    SALES?: string;
    NAMA_STORE?: string;
  }
): MonthlySpvTargetsResult {
  const yearFilter = filters?.TAHUN && filters.TAHUN !== 'ALL' ? String(filters.TAHUN).trim() : '';
  let effectiveYear = yearFilter ? Number(yearFilter) : 0;
  if (!effectiveYear || effectiveYear < 1900) {
    effectiveYear = 2026;
    for (let i = 0; i < records.length; i++) {
      const ds = String(records[i].TANGGAL || records[i].BULAN || '');
      const yMatch = ds.match(/(20\d{2})/);
      if (yMatch) {
        const y = Number(yMatch[1]);
        if (y > effectiveYear) effectiveYear = y;
      }
    }
  }

  const configuredMonthKeys = new Set(getConfiguredMonthKeys());
  const storeFilterRaw = (filters?.NAMA_STORE || '').trim();
  const salesFilterRaw = (filters?.SALES || '').trim();
  const hasStoreFilter = Boolean(storeFilterRaw && normalizeSpvDirectoryToken(storeFilterRaw) !== 'ALL');
  const hasSalesFilter = Boolean(salesFilterRaw && normalizeSpvDirectoryToken(salesFilterRaw) !== 'ALL');

  // ---------------------------------------------------------------------------
  // PRIORITY 1: SPECIFIC TOKO / STORE FILTER
  // ---------------------------------------------------------------------------
  if (hasStoreFilter) {
    const targetStoreNorm = normalizeSpvDirectoryToken(storeFilterRaw);
    const targetStoreAlnum = normalizeStoreAlnum(storeFilterRaw);

    const storeSellInLookup = computeMonthlyStoreSellInLookup(
      records,
      MONTH_OPTIONS_2026.map((m) => m.key),
      effectiveYear
    );

    // Map store -> assigned BAs and BA -> count of stores so Sell Out splits cleanly
    const baStoresMap = new Map<string, Set<string>>();
    const storeBasMap = new Map<string, { baName: string; baKey: string }[]>();

    const registerBaStoreLink = (rawSt?: string, rawBa?: string) => {
      const stClean = (rawSt || '').trim();
      const baClean = (rawBa || '').trim();
      if (!stClean || !baClean) return;
      const baKey = normalizeBaGroupKey(baClean);
      if (isGenericBaPlaceholder(baKey)) return;
      const stAlnum = normalizeStoreAlnum(stClean) || normalizeSpvDirectoryToken(stClean);
      if (!stAlnum) return;

      if (!baStoresMap.has(baKey)) baStoresMap.set(baKey, new Set<string>());
      baStoresMap.get(baKey)!.add(stAlnum);

      if (!storeBasMap.has(stAlnum)) storeBasMap.set(stAlnum, []);
      const existing = storeBasMap.get(stAlnum)!;
      if (!existing.some((x) => x.baKey === baKey)) {
        existing.push({ baName: baClean, baKey });
      }
    };

    const weeklyStores = resolveWeeklyBaStores(records);
    weeklyStores.forEach((ws) => registerBaStoreLink(ws.storeName, ws.baName));

    const customProfiles = loadCustomBaProfiles();
    Object.values(customProfiles).forEach((p) => {
      if (p.storeName) {
        p.storeName.split(',').forEach((part) => registerBaStoreLink(part, p.baName));
      }
    });

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (r.NAMA_STORE && r.BA) {
        registerBaStoreLink(r.NAMA_STORE, r.BA);
      }
    }

    const matchedStoreBas =
      storeBasMap.get(targetStoreAlnum) ||
      storeBasMap.get(targetStoreNorm) ||
      [];

    const byKey: Record<string, SpvMonthTargetEntry> = {};
    let configuredSellInSum = 0;
    let configuredSellOutSum = 0;
    let allMonthsSellInSum = 0;
    let allMonthsSellOutSum = 0;

    for (const m of MONTH_OPTIONS_2026) {
      const monthSellInBucket = storeSellInLookup[m.key];
      const matchedSellInStore = findStoreSellInInLookup(monthSellInBucket, storeFilterRaw);
      const monthTargetSellIn = matchedSellInStore ? matchedSellInStore.targetSellIn : 0;

      const baNonMap = loadBaNonLavojoyTargets(m.key);
      const baLavMap = loadBaLavojoyTargets(m.key);

      const directStoreNon = findMapValueCaseInsensitive(baNonMap, storeFilterRaw);
      const directStoreLav = findMapValueCaseInsensitive(baLavMap, storeFilterRaw);

      let monthTargetSellOut = 0;
      if (directStoreNon !== undefined || directStoreLav !== undefined) {
        monthTargetSellOut =
          (directStoreNon !== undefined ? directStoreNon : DEFAULT_BA_NON_LAVOJOY_TARGET) +
          (directStoreLav !== undefined ? directStoreLav : DEFAULT_BA_LAVOJOY_TARGET);
      } else if (matchedStoreBas.length > 0) {
        let baSum = 0;
        for (const bInfo of matchedStoreBas) {
          const bNon = findMapValueCaseInsensitive(baNonMap, bInfo.baName);
          const bLav = findMapValueCaseInsensitive(baLavMap, bInfo.baName);
          const mNon = bNon !== undefined ? bNon : DEFAULT_BA_NON_LAVOJOY_TARGET;
          const mLav = bLav !== undefined ? bLav : DEFAULT_BA_LAVOJOY_TARGET;
          const shareCount = Math.max(1, baStoresMap.get(bInfo.baKey)?.size || 1);
          baSum += (mNon + mLav) / shareCount;
        }
        monthTargetSellOut = Math.round(baSum);
      } else {
        // Non-BA store: fallback ke target toko jika tersedia
        monthTargetSellOut = monthTargetSellIn;
      }

      const entry: SpvMonthTargetEntry = {
        targetSellIn: monthTargetSellIn,
        targetSellOut: monthTargetSellOut,
        spvLabel: storeFilterRaw,
      };

      byKey[m.key] = entry;
      byKey[m.bulanName] = entry;
      byKey[m.shortLabel.toUpperCase()] = entry;
      for (const alias of m.aliases) {
        byKey[alias.toUpperCase()] = entry;
      }

      allMonthsSellInSum += monthTargetSellIn;
      allMonthsSellOutSum += monthTargetSellOut;
      if (configuredMonthKeys.has(m.key)) {
        configuredSellInSum += monthTargetSellIn;
        configuredSellOutSum += monthTargetSellOut;
      }
    }

    byKey['YEARLY_TOTAL'] = {
      targetSellIn: configuredMonthKeys.size > 0 ? configuredSellInSum : allMonthsSellInSum,
      targetSellOut: configuredMonthKeys.size > 0 ? configuredSellOutSum : allMonthsSellOutSum,
      spvLabel: storeFilterRaw,
    };

    return {
      byKey,
      spvScopeLabel: `Target Toko: ${storeFilterRaw}`,
      targetMode: 'store',
      targetEntityLabel: storeFilterRaw,
    };
  }

  // ---------------------------------------------------------------------------
  // PRIORITY 2: SPECIFIC SALES FILTER (e.g., ILHAMSYAH)
  // ---------------------------------------------------------------------------
  if (hasSalesFilter) {
    const byKey: Record<string, SpvMonthTargetEntry> = {};
    let configuredSellInSum = 0;
    let configuredSellOutSum = 0;
    let allMonthsSellInSum = 0;
    let allMonthsSellOutSum = 0;

    for (const m of MONTH_OPTIONS_2026) {
      const salesInMap = loadSalesTargets(m.key);
      const salesOutMap = loadSalesSellOutTargets(m.key);
      const customIn = lookupSalesMapWithAliases(salesInMap, salesFilterRaw);
      const customOut = lookupSalesMapWithAliases(salesOutMap, salesFilterRaw);

      const monthTargetSellIn = customIn !== undefined ? customIn : DEFAULT_SALES_TARGET;
      const monthTargetSellOut = customOut !== undefined ? customOut : DEFAULT_SALES_SELLOUT_TARGET;

      const entry: SpvMonthTargetEntry = {
        targetSellIn: monthTargetSellIn,
        targetSellOut: monthTargetSellOut,
        spvLabel: salesFilterRaw,
      };

      byKey[m.key] = entry;
      byKey[m.bulanName] = entry;
      byKey[m.shortLabel.toUpperCase()] = entry;
      for (const alias of m.aliases) {
        byKey[alias.toUpperCase()] = entry;
      }

      allMonthsSellInSum += monthTargetSellIn;
      allMonthsSellOutSum += monthTargetSellOut;
      if (configuredMonthKeys.has(m.key)) {
        configuredSellInSum += monthTargetSellIn;
        configuredSellOutSum += monthTargetSellOut;
      }
    }

    byKey['YEARLY_TOTAL'] = {
      targetSellIn: configuredMonthKeys.size > 0 ? configuredSellInSum : allMonthsSellInSum,
      targetSellOut: configuredMonthKeys.size > 0 ? configuredSellOutSum : allMonthsSellOutSum,
      spvLabel: salesFilterRaw,
    };

    return {
      byKey,
      spvScopeLabel: `Target ${salesFilterRaw}`,
      targetMode: 'sales',
      targetEntityLabel: salesFilterRaw,
    };
  }

  // ---------------------------------------------------------------------------
  // PRIORITY 3: SEMUA SALES (TARGET ALL) -> AMBIL TARGET SPV DARI KELOLA TARGET
  // ---------------------------------------------------------------------------
  interface SpvDirEntry {
    spvName: string;
    regions: Set<string>;
    coverAreas: Set<string>;
    stores: Set<string>;
    salesNames: Set<string>;
  }

  const spvDirAll = new Map<string, SpvDirEntry>();
  const spvDirYear = new Map<string, SpvDirEntry>();

  const pushRecordToDir = (dir: Map<string, SpvDirEntry>, r: TransactionRecord) => {
    const spvRaw = (r.SPV || 'UNKNOWN').trim() || 'UNKNOWN';
    const spvNorm = normalizeSpvDirectoryToken(spvRaw);
    let entry = dir.get(spvNorm);
    if (!entry) {
      entry = {
        spvName: spvRaw,
        regions: new Set<string>(),
        coverAreas: new Set<string>(),
        stores: new Set<string>(),
        salesNames: new Set<string>(),
      };
      dir.set(spvNorm, entry);
    }
    if (r.REGION) entry.regions.add(normalizeSpvDirectoryToken(r.REGION));
    if (r.COVER_AREA) entry.coverAreas.add(normalizeSpvDirectoryToken(r.COVER_AREA));
    if (r.NAMA_STORE) entry.stores.add(normalizeSpvDirectoryToken(r.NAMA_STORE));
    if (r.SALES) {
      const sClean = r.SALES.trim();
      const sNorm = normalizeSpvDirectoryToken(sClean);
      if (sNorm && sNorm !== 'UNKNOWN' && sNorm !== '-') {
        entry.salesNames.add(sClean);
      }
    }
  };

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    pushRecordToDir(spvDirAll, r);
    if (yearFilter) {
      const ds = String(r.TANGGAL || r.BULAN || '');
      if (ds.includes(yearFilter)) {
        pushRecordToDir(spvDirYear, r);
      }
    }
  }

  const activeDir = yearFilter && spvDirYear.size > 0 ? spvDirYear : spvDirAll;
  let allSpvs = Array.from(activeDir.values());

  if (allSpvs.length === 0) {
    const baseSpvKeys = Object.keys(readGlobalMap(STORAGE_KEY_SPV_TARGETS));
    if (baseSpvKeys.length > 0) {
      allSpvs = baseSpvKeys.map((name) => ({
        spvName: name,
        regions: new Set<string>(),
        coverAreas: new Set<string>(),
        stores: new Set<string>(),
        salesNames: new Set<string>(),
      }));
    } else {
      allSpvs = [
        {
          spvName: 'WIDODO',
          regions: new Set<string>(),
          coverAreas: new Set<string>(),
          stores: new Set<string>(),
          salesNames: new Set<string>(),
        },
      ];
    }
  }

  const realSpvs = allSpvs.filter((s) => {
    const n = normalizeSpvDirectoryToken(s.spvName);
    return n && n !== 'UNKNOWN' && n !== '-' && n !== 'TIDAK DIKETAHUI';
  });
  let candidateSpvs = realSpvs.length > 0 ? realSpvs : allSpvs;

  const spvFilterNorm = normalizeSpvDirectoryToken(filters?.SPV);
  const regionFilterNorm = normalizeSpvDirectoryToken(filters?.REGION);

  if (spvFilterNorm && spvFilterNorm !== 'ALL') {
    const exact = candidateSpvs.filter((s) => normalizeSpvDirectoryToken(s.spvName) === spvFilterNorm);
    if (exact.length > 0) {
      candidateSpvs = exact;
    } else {
      const partial = candidateSpvs.filter((s) => {
        const sn = normalizeSpvDirectoryToken(s.spvName);
        return sn.includes(spvFilterNorm) || spvFilterNorm.includes(sn);
      });
      if (partial.length > 0) candidateSpvs = partial;
    }
  } else if (regionFilterNorm && regionFilterNorm !== 'ALL') {
    const byRegion = candidateSpvs.filter(
      (s) => s.regions.has(regionFilterNorm) || s.coverAreas.has(regionFilterNorm)
    );
    if (byRegion.length > 0) candidateSpvs = byRegion;
  }

  const spvNamesLabel = candidateSpvs.map((s) => s.spvName).join(', ') || 'WIDODO';
  const spvScopeLabel = `Target ALL (SPV: ${spvNamesLabel})`;

  const byKey: Record<string, SpvMonthTargetEntry> = {};
  let configuredSellInSum = 0;
  let configuredSellOutSum = 0;
  let allMonthsSellInSum = 0;
  let allMonthsSellOutSum = 0;

  for (const m of MONTH_OPTIONS_2026) {
    const spvInMap = loadSpvTargets(m.key);
    const spvOutMap = loadSpvSellOutTargets(m.key);
    const salesInMap = loadSalesTargets(m.key);
    const salesOutMap = loadSalesSellOutTargets(m.key);

    let monthTargetSellIn = 0;
    let monthTargetSellOut = 0;

    for (const spv of candidateSpvs) {
      const customIn = findMapValueCaseInsensitive(spvInMap, spv.spvName);
      if (customIn !== undefined) {
        monthTargetSellIn += customIn;
      } else if (spv.salesNames.size > 0) {
        let salesRollupIn = 0;
        spv.salesNames.forEach((sl) => {
          const sVal = findMapValueCaseInsensitive(salesInMap, sl);
          salesRollupIn += sVal !== undefined ? sVal : DEFAULT_SALES_TARGET;
        });
        monthTargetSellIn += salesRollupIn > 0 ? salesRollupIn : DEFAULT_SPV_TARGET;
      } else {
        monthTargetSellIn += DEFAULT_SPV_TARGET;
      }

      const customOut = findMapValueCaseInsensitive(spvOutMap, spv.spvName);
      if (customOut !== undefined) {
        monthTargetSellOut += customOut;
      } else if (spv.salesNames.size > 0) {
        let salesRollupOut = 0;
        spv.salesNames.forEach((sl) => {
          const sVal = findMapValueCaseInsensitive(salesOutMap, sl);
          salesRollupOut += sVal !== undefined ? sVal : DEFAULT_SALES_SELLOUT_TARGET;
        });
        monthTargetSellOut += salesRollupOut > 0 ? salesRollupOut : DEFAULT_SPV_SELLOUT_TARGET;
      } else {
        monthTargetSellOut += DEFAULT_SPV_SELLOUT_TARGET;
      }
    }

    const entry: SpvMonthTargetEntry = {
      targetSellIn: monthTargetSellIn,
      targetSellOut: monthTargetSellOut,
      spvLabel: 'ALL',
    };

    byKey[m.key] = entry;
    byKey[m.bulanName] = entry;
    byKey[m.shortLabel.toUpperCase()] = entry;
    for (const alias of m.aliases) {
      byKey[alias.toUpperCase()] = entry;
    }

    allMonthsSellInSum += monthTargetSellIn;
    allMonthsSellOutSum += monthTargetSellOut;
    if (configuredMonthKeys.has(m.key)) {
      configuredSellInSum += monthTargetSellIn;
      configuredSellOutSum += monthTargetSellOut;
    }
  }

  byKey['YEARLY_TOTAL'] = {
    targetSellIn: configuredMonthKeys.size > 0 ? configuredSellInSum : allMonthsSellInSum,
    targetSellOut: configuredMonthKeys.size > 0 ? configuredSellOutSum : allMonthsSellOutSum,
    spvLabel: 'ALL',
  };

  return {
    byKey,
    spvScopeLabel,
    targetMode: 'spv',
    targetEntityLabel: 'ALL',
  };
}


