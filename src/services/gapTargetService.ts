import { DashboardFilters } from '../types/dashboard';
import {
  MONTH_OPTIONS_2026,
  normalizeMonthKey,
  notifyTargetsUpdated,
} from './targetManagementService';

export const STORAGE_KEY_GAP_MONTHLY_QUOTA = 'salespro_gap_monthly_quota_v1';
export const STORAGE_KEY_GAP_MONTHLY_QUOTA_DETAIL = 'salespro_gap_monthly_quota_detail_v1';
export const STORAGE_KEY_GAP_ENTITY_QUOTA_DETAIL = 'salespro_gap_entity_quota_detail_v1';

export const GAP_SALES_LIST = [
  'ABDUL RAHIM',
  'ALBERT FERNANDO',
  'ILHAMSYAH',
  'LUAR KOTA',
  'PARETO',
  'TIWI',
] as const;

export const GAP_TRAINER_LIST = ['ARA', 'RATIH'] as const;

export type GapQuotaScopeType = 'general' | 'sales' | 'trainer';

export interface GapMonthlyQuotaConfig {
  total?: number;
  sellIn?: number;
  sellOut?: number;
}

export interface ResolvedGapQuota {
  scopeType: GapQuotaScopeType;
  entityName?: string;
  scopeLabel: string;
  monthKey: string;
  config: GapMonthlyQuotaConfig;
}

export function getGapQuotaMonthKey(
  bulan?: string,
  tahun?: string | number
): string {
  const yearStr =
    tahun && String(tahun).trim() !== '' && String(tahun).toUpperCase() !== 'ALL'
      ? String(tahun).trim()
      : '2026';
  const normMonth = normalizeMonthKey(bulan);
  if (normMonth === 'ALL') {
    return `${yearStr}__ALL`;
  }
  const monthSuffix = normMonth.includes('-') ? normMonth.split('-')[1] : normMonth;
  return `${yearStr}__${monthSuffix}`;
}

export function getGapQuotaMonthLabel(
  bulan?: string,
  tahun?: string | number
): string {
  const yearStr =
    tahun && String(tahun).trim() !== '' && String(tahun).toUpperCase() !== 'ALL'
      ? String(tahun).trim()
      : '2026';
  const normMonth = normalizeMonthKey(bulan);
  if (normMonth === 'ALL') {
    return `Semua Bulan (${yearStr})`;
  }
  const found = MONTH_OPTIONS_2026.find((m) => m.key === normMonth);
  return found ? `${found.bulanName} ${yearStr}` : `${bulan || 'BULAN'} ${yearStr}`;
}

export function normalizeEntityName(name: string): string {
  return (name || '').trim().toUpperCase();
}

export function getGapEntityQuotaKey(
  scopeType: 'sales' | 'trainer',
  entityName: string,
  bulan?: string,
  tahun?: string | number
): string {
  const prefix = scopeType === 'sales' ? 'SALES' : 'TRAINER';
  const normEntity = normalizeEntityName(entityName);
  const monthKey = getGapQuotaMonthKey(bulan, tahun);
  return `${prefix}::${normEntity}::${monthKey}`;
}

function sanitizePositiveNumber(val: unknown): number | undefined {
  const n = Math.round(Number(val) || 0);
  return !isNaN(n) && n > 0 ? n : undefined;
}

function sanitizeConfig(cfg: GapMonthlyQuotaConfig | undefined): GapMonthlyQuotaConfig | null {
  if (!cfg || typeof cfg !== 'object') return null;
  const total = sanitizePositiveNumber(cfg.total);
  const sellIn = sanitizePositiveNumber(cfg.sellIn);
  const sellOut = sanitizePositiveNumber(cfg.sellOut);
  if (!total && !sellIn && !sellOut) return null;
  const clean: GapMonthlyQuotaConfig = {};
  if (total) clean.total = total;
  if (sellIn) clean.sellIn = sellIn;
  if (sellOut) clean.sellOut = sellOut;
  return clean;
}

export function loadAllGapMonthlyQuotas(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAP_MONTHLY_QUOTA);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAllGapMonthlyQuotaDetails(): Record<string, GapMonthlyQuotaConfig> {
  const legacyTotals = loadAllGapMonthlyQuotas();
  let details: Record<string, GapMonthlyQuotaConfig> = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAP_MONTHLY_QUOTA_DETAIL);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        details = parsed;
      }
    }
  } catch {
    details = {};
  }

  const merged: Record<string, GapMonthlyQuotaConfig> = {};
  const allKeys = new Set([...Object.keys(legacyTotals), ...Object.keys(details)]);
  allKeys.forEach((key) => {
    const existing = details[key] || {};
    const mergedCfg = sanitizeConfig({
      total: existing.total ?? legacyTotals[key],
      sellIn: existing.sellIn,
      sellOut: existing.sellOut,
    });
    if (mergedCfg) {
      merged[key] = mergedCfg;
    }
  });

  return merged;
}

function persistGapQuotaDetails(details: Record<string, GapMonthlyQuotaConfig>) {
  const legacyTotals: Record<string, number> = {};
  Object.entries(details).forEach(([key, cfg]) => {
    if (cfg.total && cfg.total > 0) {
      legacyTotals[key] = cfg.total;
    }
  });

  try {
    localStorage.setItem(STORAGE_KEY_GAP_MONTHLY_QUOTA_DETAIL, JSON.stringify(details));
    localStorage.setItem(STORAGE_KEY_GAP_MONTHLY_QUOTA, JSON.stringify(legacyTotals));
  } catch {
    // ignore storage quota errors
  }
}

export function getGapMonthlyQuota(
  bulan?: string,
  tahun?: string | number
): number | undefined {
  const all = loadAllGapMonthlyQuotaDetails();
  const key = getGapQuotaMonthKey(bulan, tahun);
  const cfg = all[key];
  if (!cfg) return undefined;
  return cfg.total;
}

export function getGapMonthlyQuotaDetail(
  bulan?: string,
  tahun?: string | number
): GapMonthlyQuotaConfig {
  const all = loadAllGapMonthlyQuotaDetails();
  const key = getGapQuotaMonthKey(bulan, tahun);
  return all[key] || {};
}

export function setGapMonthlyQuotaDetail(
  config: GapMonthlyQuotaConfig,
  bulan?: string,
  tahun?: string | number
): Record<string, GapMonthlyQuotaConfig> {
  const all = loadAllGapMonthlyQuotaDetails();
  const key = getGapQuotaMonthKey(bulan, tahun);
  const clean = sanitizeConfig(config);
  if (clean) {
    all[key] = clean;
  } else {
    delete all[key];
  }
  persistGapQuotaDetails(all);
  notifyTargetsUpdated({ monthKey: key, category: 'gap_quota' });
  return all;
}

export function setGapMonthlyQuota(
  value: number,
  bulan?: string,
  tahun?: string | number
): Record<string, number> {
  const existing = getGapMonthlyQuotaDetail(bulan, tahun);
  setGapMonthlyQuotaDetail(
    {
      ...existing,
      total: sanitizePositiveNumber(value),
    },
    bulan,
    tahun
  );
  return loadAllGapMonthlyQuotas();
}

export function resetGapMonthlyQuota(
  bulan?: string,
  tahun?: string | number
): Record<string, number> {
  const all = loadAllGapMonthlyQuotaDetails();
  const key = getGapQuotaMonthKey(bulan, tahun);
  delete all[key];
  persistGapQuotaDetails(all);
  notifyTargetsUpdated({ monthKey: key, category: 'gap_quota' });
  return loadAllGapMonthlyQuotas();
}

export function resetGapMonthlyQuotaDetail(
  bulan?: string,
  tahun?: string | number
): Record<string, GapMonthlyQuotaConfig> {
  const all = loadAllGapMonthlyQuotaDetails();
  const key = getGapQuotaMonthKey(bulan, tahun);
  delete all[key];
  persistGapQuotaDetails(all);
  notifyTargetsUpdated({ monthKey: key, category: 'gap_quota' });
  return all;
}

// =========================================================================
// PER-SALES & PER-TRAINER MANUAL MONTHLY QUOTA SETTINGS
// =========================================================================

export function loadAllGapEntityQuotaDetails(): Record<string, GapMonthlyQuotaConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAP_ENTITY_QUOTA_DETAIL);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const cleanMap: Record<string, GapMonthlyQuotaConfig> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      const sanitized = sanitizeConfig(v as GapMonthlyQuotaConfig);
      if (sanitized) cleanMap[k] = sanitized;
    });
    return cleanMap;
  } catch {
    return {};
  }
}

function persistGapEntityQuotaDetails(details: Record<string, GapMonthlyQuotaConfig>) {
  try {
    localStorage.setItem(STORAGE_KEY_GAP_ENTITY_QUOTA_DETAIL, JSON.stringify(details));
  } catch {
    // ignore storage errors
  }
}

export function getGapEntityQuotaDetail(
  scopeType: 'sales' | 'trainer',
  entityName: string,
  bulan?: string,
  tahun?: string | number
): GapMonthlyQuotaConfig {
  const all = loadAllGapEntityQuotaDetails();
  const key = getGapEntityQuotaKey(scopeType, entityName, bulan, tahun);
  return all[key] || {};
}

export function setGapEntityQuotaDetail(
  scopeType: 'sales' | 'trainer',
  entityName: string,
  config: GapMonthlyQuotaConfig,
  bulan?: string,
  tahun?: string | number
): Record<string, GapMonthlyQuotaConfig> {
  const all = loadAllGapEntityQuotaDetails();
  const key = getGapEntityQuotaKey(scopeType, entityName, bulan, tahun);
  const clean = sanitizeConfig(config);
  if (clean) {
    all[key] = clean;
  } else {
    delete all[key];
  }
  persistGapEntityQuotaDetails(all);
  notifyTargetsUpdated({ monthKey: key, category: 'gap_quota' });
  return all;
}

export function resetGapEntityQuotaDetail(
  scopeType: 'sales' | 'trainer',
  entityName: string,
  bulan?: string,
  tahun?: string | number
): Record<string, GapMonthlyQuotaConfig> {
  const all = loadAllGapEntityQuotaDetails();
  const key = getGapEntityQuotaKey(scopeType, entityName, bulan, tahun);
  delete all[key];
  persistGapEntityQuotaDetails(all);
  notifyTargetsUpdated({ monthKey: key, category: 'gap_quota' });
  return all;
}

export function resolveActiveGapQuotaDetail(
  filters: DashboardFilters
): ResolvedGapQuota {
  const monthKey = getGapQuotaMonthKey(filters.BULAN, filters.TAHUN);
  const salesVal = (filters.SALES || 'ALL').trim().toUpperCase();
  const trainerVal = (filters.TRAINER || 'ALL').trim().toUpperCase();

  if (salesVal && salesVal !== 'ALL') {
    return {
      scopeType: 'sales',
      entityName: salesVal,
      scopeLabel: `Sales: ${salesVal}`,
      monthKey,
      config: getGapEntityQuotaDetail('sales', salesVal, filters.BULAN, filters.TAHUN),
    };
  }

  if (trainerVal && trainerVal !== 'ALL') {
    return {
      scopeType: 'trainer',
      entityName: trainerVal,
      scopeLabel: `Trainer: ${trainerVal}`,
      monthKey,
      config: getGapEntityQuotaDetail('trainer', trainerVal, filters.BULAN, filters.TAHUN),
    };
  }

  return {
    scopeType: 'general',
    scopeLabel: 'Kuota Umum (Semua)',
    monthKey,
    config: getGapMonthlyQuotaDetail(filters.BULAN, filters.TAHUN),
  };
}

export { MONTH_OPTIONS_2026 };
