import {
  TransactionRecord,
  AreaTargetItem,
  SpvTargetItem,
  SalesTargetItem,
  BaTargetItem,
  TrainerTargetItem,
} from '../types/dashboard';
import { calculateSalesSalary } from '../utils/costCalculations';
import { isFocusProduct } from '../utils/analytics';
import {
  loadFocusOverrides,
  saveFocusOverrides,
  calculateFocusProductIncentivePenalty,
  DEFAULT_FOCUS_TARGET_PCS,
} from './focusProductService';

export const TARGETS_UPDATED_EVENT = 'salespro-targets-updated';

export function notifyTargetsUpdated(detail?: { monthKey?: string; category?: string }): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TARGETS_UPDATED_EVENT, { detail }));
  }
}

export const STORAGE_KEY_AREA_TARGETS = 'salespro_custom_area_targets';
export const STORAGE_KEY_SPV_TARGETS = 'salespro_custom_spv_targets';
export const STORAGE_KEY_SALES_TARGETS = 'salespro_custom_sales_targets';
export const STORAGE_KEY_SALES_SELLOUT_TARGETS = 'salespro_custom_sales_sellout_targets_v1';
export const STORAGE_KEY_BA_NON_LAVOJOY = 'salespro_custom_ba_non_lavojoy_targets';
export const STORAGE_KEY_BA_LAVOJOY = 'salespro_custom_ba_lavojoy_targets';
export const STORAGE_KEY_TRAINER_TARGETS = 'salespro_custom_trainer_targets';
export const STORAGE_KEY_MONTHLY_TARGETS = 'salespro_custom_monthly_targets_v2';
export const STORAGE_KEY_CUSTOM_BA_PROFILES = 'salespro_custom_ba_profiles_v1';

export const DEFAULT_AREA_TARGET = 300000000; // 300 Jt default per area
export const DEFAULT_SPV_TARGET = 450000000;  // 450 Jt default per SPV
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
  spv?: Record<string, number>;
  sales?: Record<string, number>;
  salesSellOut?: Record<string, number>;
  baNonLavojoy?: Record<string, number>;
  baLavojoy?: Record<string, number>;
  baFocus?: Record<string, number>;
  trainer?: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; baSupervisedCount?: number; notes?: string }>;
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

export function getExplicitBaTotalTargetOverride(storeName: string, monthKey?: string): number | undefined {
  const upperStore = storeName.trim().toUpperCase();
  const nonTargets = loadBaNonLavojoyTargets(monthKey);
  const lavTargets = loadBaLavojoyTargets(monthKey);

  const nonKey = Object.keys(nonTargets).find((k) => k.trim().toUpperCase() === upperStore);
  const lavKey = Object.keys(lavTargets).find((k) => k.trim().toUpperCase() === upperStore);

  if (nonKey === undefined && lavKey === undefined) return undefined;
  const nonVal = nonKey !== undefined ? nonTargets[nonKey] : DEFAULT_BA_NON_LAVOJOY_TARGET;
  const lavVal = lavKey !== undefined ? lavTargets[lavKey] : DEFAULT_BA_LAVOJOY_TARGET;
  return nonVal + lavVal;
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
  | 'spv'
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
      if (!current[entityKey]) current[entityKey] = { storeName: entityKey };
      current[entityKey].targetPcs = value;
      saveFocusOverrides(current);
      return;
    }
    const keyMap: Record<Exclude<SingleTargetCategory, 'baFocus'>, string> = {
      area: STORAGE_KEY_AREA_TARGETS,
      spv: STORAGE_KEY_SPV_TARGETS,
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

/**
 * Copies all effective targets from sourceMonthKey into each destination month in targetMonthKeys.
 */
export function copyMonthTargets(
  sourceMonthKey: string,
  targetMonthKeys: string[],
  records: TransactionRecord[] = []
): number {
  const srcNorm = normalizeMonthKey(sourceMonthKey);
  const srcMatrix = aggregateTargetMatrix(records, srcNorm);

  const areaMap: Record<string, number> = {};
  srcMatrix.areas.forEach((a) => { areaMap[a.coverArea] = a.targetOmzet; });

  const spvMap: Record<string, number> = {};
  srcMatrix.spvs.forEach((s) => { spvMap[s.spvName] = s.targetOmzet; });

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
    baNonMap[b.storeName] = b.targetNonLavojoy;
    baLavMap[b.storeName] = b.targetLavojoy;
    baFocusMap[b.storeName] = b.targetFocusPcs;
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

  targetMonthKeys.forEach((dest) => {
    const destNorm = normalizeMonthKey(dest);
    if (destNorm === 'ALL') {
      writeGlobalMap(STORAGE_KEY_AREA_TARGETS, areaMap);
      writeGlobalMap(STORAGE_KEY_SPV_TARGETS, spvMap);
      writeGlobalMap(STORAGE_KEY_SALES_TARGETS, salesInMap);
      writeGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS, salesOutMap);
      writeGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY, baNonMap);
      writeGlobalMap(STORAGE_KEY_BA_LAVOJOY, baLavMap);
      localStorage.setItem(STORAGE_KEY_TRAINER_TARGETS, JSON.stringify(trainerMap));
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
        spv: { ...spvMap },
        sales: { ...salesInMap },
        salesSellOut: { ...salesOutMap },
        baNonLavojoy: { ...baNonMap },
        baLavojoy: { ...baLavMap },
        baFocus: { ...baFocusMap },
        trainer: JSON.parse(JSON.stringify(trainerMap)),
      };
      updatedCount++;
    }
  });

  saveMonthlyTargets(monthly);
  notifyTargetsUpdated({ category: 'copy_month' });
  return updatedCount;
}

export function resetMonthTargets(monthKey?: string): void {
  const norm = normalizeMonthKey(monthKey);
  if (norm === 'ALL') {
    localStorage.removeItem(STORAGE_KEY_AREA_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SPV_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SALES_TARGETS);
    localStorage.removeItem(STORAGE_KEY_SALES_SELLOUT_TARGETS);
    localStorage.removeItem(STORAGE_KEY_BA_NON_LAVOJOY);
    localStorage.removeItem(STORAGE_KEY_BA_LAVOJOY);
    localStorage.removeItem(STORAGE_KEY_TRAINER_TARGETS);
    localStorage.removeItem(STORAGE_KEY_MONTHLY_TARGETS);
    localStorage.removeItem(STORAGE_KEY_CUSTOM_BA_PROFILES);
    localStorage.removeItem('salespro_ba_focus_overrides_v2');
  } else {
    const monthly = loadMonthlyTargets();
    delete monthly[norm];
    saveMonthlyTargets(monthly);
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
      Object.keys(bucket.spv || {}).length +
      Object.keys(bucket.sales || {}).length +
      Object.keys(bucket.salesSellOut || {}).length +
      Object.keys(bucket.baNonLavojoy || {}).length +
      Object.keys(bucket.baLavojoy || {}).length +
      Object.keys(bucket.baFocus || {}).length +
      Object.keys(bucket.trainer || {}).length;
  });

  counts['ALL'] =
    Object.keys(readGlobalMap(STORAGE_KEY_AREA_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SPV_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SALES_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_SALES_SELLOUT_TARGETS)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_BA_NON_LAVOJOY)).length +
    Object.keys(readGlobalMap(STORAGE_KEY_BA_LAVOJOY)).length +
    Object.keys(loadTrainerTargets('ALL')).length;

  return counts;
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
    totalSpvTarget: number;
    totalSpvActual: number;
    spvAchievementPct: number;
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
  };
}

/**
 * Aggregates complete multi-tier targets and actuals for:
 * 1. Area (Cover Area / Region)
 * 2. SPV (Supervisor)
 * 3. Sales (Sell In & Sell Out Personil)
 * 4. BA (Non-Lavojoy, Lavojoy & Produk Fokus)
 * 5. Trainer (Sell Out & Produk Fokus)
 * Supports all 12 months (Januari - Desember 2026) with independent per-month targets.
 */
export function aggregateTargetMatrix(records: TransactionRecord[], selectedMonth?: string): TargetMatrixData {
  const normMonth = normalizeMonthKey(selectedMonth);

  const customAreaTargets = loadAreaTargets(normMonth);
  const customSpvTargets = loadSpvTargets(normMonth);
  const customSalesTargets = loadSalesTargets(normMonth);
  const customSalesSellOutTargets = loadSalesSellOutTargets(normMonth);
  const customBaNonLavojoyTargets = loadBaNonLavojoyTargets(normMonth);
  const customBaLavojoyTargets = loadBaLavojoyTargets(normMonth);
  const customBaFocusTargets = loadBaFocusTargets(normMonth);
  const customTrainerTargets = loadTrainerTargets(normMonth);
  const focusOverrides = loadFocusOverrides();
  const customBaProfiles = loadCustomBaProfiles();

  const monthlyBucket = normMonth !== 'ALL' ? loadMonthlyTargets()[normMonth] : undefined;

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
      baName: string;
      baNumber: string;
      coverArea: string;
      region: string;
      salesName: string;
      spv: string;
      sellOutNonLavojoy: number;
      sellOutLavojoy: number;
      focusActualPcs: number;
    }
  > = {};

  // First ensure directory entries exist from all records, then accumulate actuals ONLY for records matching selectedMonth
  for (const r of records) {
    const areaKey = r.COVER_AREA || 'UNKNOWN';
    const spvKey = r.SPV || 'UNKNOWN';
    const salesKey = r.SALES || 'UNKNOWN';
    const rawStoreKey = r.NAMA_STORE || 'UNKNOWN';

    // Check if store has been renamed/updated via customBaProfiles
    const renamedMatch = Object.values(customBaProfiles).find(
      (p) => p.originalStoreName && p.originalStoreName.toUpperCase() === rawStoreKey.toUpperCase()
    );
    const storeKey = renamedMatch ? renamedMatch.storeName : rawStoreKey;
    const resolvedBaName = renamedMatch
      ? renamedMatch.baName
      : (customBaProfiles[storeKey]?.baName || r.BA);
    const resolvedSalesName = renamedMatch
      ? renamedMatch.salesName
      : (customBaProfiles[storeKey]?.salesName || salesKey);

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

    if (resolvedBaName && resolvedBaName !== '-' && resolvedBaName.trim() !== '') {
      if (!baMap[storeKey]) {
        baMap[storeKey] = {
          storeName: storeKey,
          baName: resolvedBaName,
          baNumber: customBaProfiles[storeKey]?.baNumber || r.BA_Number || 'BA-' + storeKey.slice(0, 3).toUpperCase(),
          coverArea: customBaProfiles[storeKey]?.coverArea || areaKey,
          region: customBaProfiles[storeKey]?.region || r.REGION || '-',
          salesName: resolvedSalesName,
          spv: customBaProfiles[storeKey]?.spv || spvKey,
          sellOutNonLavojoy: 0,
          sellOutLavojoy: 0,
          focusActualPcs: 0,
        };
      }
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

    if (baMap[storeKey]) {
      if (isSellOut) {
        if (isLavojoy) {
          baMap[storeKey].sellOutLavojoy += val;
        } else {
          baMap[storeKey].sellOutNonLavojoy += val;
        }
      }
      if (isFocus && (isSellOut || isSellIn)) {
        baMap[storeKey].focusActualPcs += qty;
      }
    }
  }

  // Merge any newly added custom BA stores from customBaProfiles
  Object.values(customBaProfiles).forEach((profile) => {
    if (!baMap[profile.storeName]) {
      baMap[profile.storeName] = {
        storeName: profile.storeName,
        baName: profile.baName,
        baNumber: profile.baNumber || 'BA-NEW',
        coverArea: profile.coverArea || 'PEKANBARU',
        region: profile.region || 'PEKAN BARU',
        salesName: profile.salesName || 'ILHAMSYAH',
        spv: profile.spv || 'WIDODO',
        sellOutNonLavojoy: 0,
        sellOutLavojoy: 0,
        focusActualPcs: 0,
      };
    } else {
      baMap[profile.storeName].baName = profile.baName;
      baMap[profile.storeName].salesName = profile.salesName;
      if (profile.coverArea) baMap[profile.storeName].coverArea = profile.coverArea;
    }
  });

  // Populate coveredBaList for sales productivity evaluation
  Object.values(baMap).forEach((b) => {
    if (salesMap[b.salesName]) {
      salesMap[b.salesName].coveredBaList.push({
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

  // 1. Array Area Targets
  const areas: AreaTargetItem[] = Object.values(areaMap).map((a) => {
    const isCustom =
      (monthlyBucket?.area?.[a.coverArea] !== undefined) ||
      (normMonth === 'ALL' && customAreaTargets[a.coverArea] !== undefined) ||
      customAreaTargets[a.coverArea] !== undefined;
    const targetOmzet = customAreaTargets[a.coverArea] !== undefined ? customAreaTargets[a.coverArea] : DEFAULT_AREA_TARGET;
    const actualSellIn = a.actualSellIn > 0 ? a.actualSellIn : a.actualSellOut;
    const gapOmzet = actualSellIn - targetOmzet;
    const achievementPct = targetOmzet > 0 ? (actualSellIn / targetOmzet) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    return {
      coverArea: a.coverArea,
      region: a.region,
      targetOmzet,
      actualSellIn,
      actualSellOut: a.actualSellOut,
      gapOmzet,
      achievementPct,
      status,
      salesCount: a.salesSet.size,
      spvCount: a.spvSet.size,
      storeCount: a.storeSet.size,
      isCustom,
    };
  }).sort((a, b) => b.actualSellIn - a.actualSellIn);

  // 2. Array SPV Targets
  const spvs: SpvTargetItem[] = Object.values(spvMap).map((s) => {
    const isCustom =
      (monthlyBucket?.spv?.[s.spvName] !== undefined) ||
      customSpvTargets[s.spvName] !== undefined;
    const targetOmzet = customSpvTargets[s.spvName] !== undefined ? customSpvTargets[s.spvName] : DEFAULT_SPV_TARGET;
    const actualSellIn = s.actualSellIn > 0 ? s.actualSellIn : s.actualSellOut;
    const gapOmzet = actualSellIn - targetOmzet;
    const achievementPct = targetOmzet > 0 ? (actualSellIn / targetOmzet) * 100 : 0;
    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementPct >= 100 ? 'achieved' : achievementPct >= 80 ? 'on_track' : 'lagging';

    return {
      spvName: s.spvName,
      regions: Array.from(s.regions),
      coverAreas: Array.from(s.coverAreas),
      targetOmzet,
      actualSellIn,
      actualSellOut: s.actualSellOut,
      gapOmzet,
      achievementPct,
      status,
      salesCount: s.salesSet.size,
      storeCount: s.storeSet.size,
      isCustom,
    };
  }).sort((a, b) => b.actualSellIn - a.actualSellIn);

  // 3. Array Sales Targets (Sell In & Sell Out)
  const sales: SalesTargetItem[] = Object.values(salesMap).map((sl) => {
    const isCustom = customSalesTargets[sl.salesName] !== undefined;
    const targetSellIn = isCustom ? customSalesTargets[sl.salesName] : DEFAULT_SALES_TARGET;
    const isCustomSellOut = customSalesSellOutTargets[sl.salesName] !== undefined;
    const targetSellOut = isCustomSellOut ? customSalesSellOutTargets[sl.salesName] : DEFAULT_SALES_SELLOUT_TARGET;

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

  // 4. Array BA Targets
  const bas: BaTargetItem[] = Object.values(baMap).map((b) => {
    const customNonLav =
      customBaNonLavojoyTargets[b.storeName] ??
      customBaNonLavojoyTargets[b.storeName.toUpperCase()] ??
      customBaNonLavojoyTargets[b.baName] ??
      customBaNonLavojoyTargets[b.baName.toUpperCase()];
    const customLav =
      customBaLavojoyTargets[b.storeName] ??
      customBaLavojoyTargets[b.storeName.toUpperCase()] ??
      customBaLavojoyTargets[b.baName] ??
      customBaLavojoyTargets[b.baName.toUpperCase()];

    const isNonLavojoyCustom = customNonLav !== undefined;
    const isLavojoyCustom = customLav !== undefined;
    const targetNonLavojoy = isNonLavojoyCustom ? customNonLav : DEFAULT_BA_NON_LAVOJOY_TARGET;
    const targetLavojoy = isLavojoyCustom ? customLav : DEFAULT_BA_LAVOJOY_TARGET;

    const ov = focusOverrides[b.storeName] || focusOverrides[b.baName] || {};
    const monthFocus = customBaFocusTargets[b.storeName] ?? customBaFocusTargets[b.baName];
    const targetFocusPcs =
      monthFocus !== undefined && monthFocus > 0
        ? monthFocus
        : ov.targetPcs !== undefined && ov.targetPcs > 0
        ? ov.targetPcs
        : DEFAULT_FOCUS_TARGET_PCS;
    const actualFocusPcs = ov.customActualPcs !== undefined && ov.customActualPcs >= 0 ? ov.customActualPcs : b.focusActualPcs;

    const focusCalc = calculateFocusProductIncentivePenalty(
      targetFocusPcs,
      actualFocusPcs,
      ov.customIncentive,
      ov.customPenalty
    );

    // Jika Target Lavojoy diset 0, maka seluruh pencapaian Sell Out BA (Non-Lavojoy + Lavojoy)
    // dihitung sebagai pencapaian Sell Out utama BA tersebut.
    const isLavojoyMergedToMain = targetLavojoy === 0;
    const actualNonLavojoy = isLavojoyMergedToMain
      ? b.sellOutNonLavojoy + b.sellOutLavojoy
      : b.sellOutNonLavojoy;
    const actualLavojoy = isLavojoyMergedToMain ? 0 : b.sellOutLavojoy;

    const achievementNonLavojoyPct =
      targetNonLavojoy > 0 ? (actualNonLavojoy / targetNonLavojoy) * 100 : 0;
    const achievementLavojoyPct =
      targetLavojoy > 0 ? (actualLavojoy / targetLavojoy) * 100 : 0;

    return {
      storeName: b.storeName,
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
      isCustom: Boolean(isNonLavojoyCustom || isLavojoyCustom || monthFocus !== undefined || ov.targetPcs !== undefined),
    };
  }).sort((a, b) => (b.actualNonLavojoy + b.actualLavojoy) - (a.actualNonLavojoy + a.actualLavojoy));

  // 5. Array Trainer Targets (Sell Out & Produk Fokus)
  const activeTrainerConfigs = loadTrainerConfigs();
  const trainers: TrainerTargetItem[] = activeTrainerConfigs.map((t) => {
    const customConfig = customTrainerTargets[t.id] || customTrainerTargets[t.trainerName] || {};
    const targetSellOut =
      customConfig.targetSellOut !== undefined && customConfig.targetSellOut > 0
        ? customConfig.targetSellOut
        : t.targetSellOut || DEFAULT_TRAINER_SELL_OUT_TARGET;
    const targetProdukFokusPcs =
      customConfig.targetProdukFokusPcs !== undefined && customConfig.targetProdukFokusPcs > 0
        ? customConfig.targetProdukFokusPcs
        : t.targetProdukFokusPcs || DEFAULT_TRAINER_FOCUS_TARGET_PCS;

    // Filter relevant BA and transactions for this trainer's area
    const matchingBas = Object.values(baMap).filter((b) => {
      if (t.areaCovered && t.areaCovered.toUpperCase().includes(b.coverArea.toUpperCase())) return true;
      if (t.region && t.region.toUpperCase().includes(b.region.toUpperCase())) return true;
      return false;
    });

    const autoBaSupervisedCount =
      matchingBas.length > 0
        ? matchingBas.length
        : Math.max(1, Math.floor(Object.keys(baMap).length / Math.max(1, activeTrainerConfigs.length)));
    const customBaSupervised =
      customConfig.baSupervisedCount !== undefined
        ? customConfig.baSupervisedCount
        : t.baSupervisedCount;
    const baSupervisedCount =
      customBaSupervised !== undefined && customBaSupervised >= 0
        ? customBaSupervised
        : autoBaSupervisedCount;
    const storeSupervisedCount = baSupervisedCount;

    let actualSellOut = matchingBas.reduce((acc, b) => acc + b.sellOutNonLavojoy + b.sellOutLavojoy, 0);
    let actualProdukFokusPcs = matchingBas.reduce((acc, b) => acc + b.focusActualPcs, 0);

    if (actualSellOut === 0) {
      const totalAllSellOut = Object.values(baMap).reduce((acc, b) => acc + b.sellOutNonLavojoy + b.sellOutLavojoy, 0);
      actualSellOut = Math.round(totalAllSellOut / Math.max(1, activeTrainerConfigs.length));
      const totalAllFocus = Object.values(baMap).reduce((acc, b) => acc + b.focusActualPcs, 0);
      actualProdukFokusPcs = Math.round(totalAllFocus / Math.max(1, activeTrainerConfigs.length));
    }

    const achievementSellOutPct = targetSellOut > 0 ? (actualSellOut / targetSellOut) * 100 : 0;
    const achievementProdukFokusPct = targetProdukFokusPcs > 0 ? (actualProdukFokusPcs / targetProdukFokusPcs) * 100 : 0;

    const status: 'achieved' | 'on_track' | 'lagging' =
      achievementSellOutPct >= 100 && achievementProdukFokusPct >= 100
        ? 'achieved'
        : achievementSellOutPct >= 80 || achievementProdukFokusPct >= 80
        ? 'on_track'
        : 'lagging';

    const isCustom = Boolean(
      customConfig.targetSellOut !== undefined ||
      customConfig.targetProdukFokusPcs !== undefined ||
      customConfig.baSupervisedCount !== undefined ||
      t.baSupervisedCount !== undefined
    );

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
      notes: customConfig.notes || t.notes,
      isCustom,
    };
  });

  // Overall summaries
  const totalAreaTarget = areas.reduce((acc, a) => acc + a.targetOmzet, 0);
  const totalAreaActual = areas.reduce((acc, a) => acc + a.actualSellIn, 0);
  const areaAchievementPct = totalAreaTarget > 0 ? (totalAreaActual / totalAreaTarget) * 100 : 0;

  const totalSpvTarget = spvs.reduce((acc, s) => acc + s.targetOmzet, 0);
  const totalSpvActual = spvs.reduce((acc, s) => acc + s.actualSellIn, 0);
  const spvAchievementPct = totalSpvTarget > 0 ? (totalSpvActual / totalSpvTarget) * 100 : 0;

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
      totalSpvTarget,
      totalSpvActual,
      spvAchievementPct,
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
    },
  };
}
