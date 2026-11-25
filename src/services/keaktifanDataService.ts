import { TransactionRecord } from '../types/dashboard';
import { getTrainerForRecord, isFocusProduct, parseTransactionDate } from '../utils/analytics';

export interface MonthKeaktifanOverride {
  tokoCount?: number;
  baCount?: number;
  salesCount?: number;
  trainerCount?: number;
  txCount?: number;
  totalValue?: number;
  isManual?: boolean;
}

export interface CustomKeaktifanEntity {
  id: string;
  monthKey: string;
  type: 'toko' | 'ba' | 'sales' | 'trainer';
  name: string;
  area: string;
  region: string;
  salesName?: string;
  baName?: string;
  hasBa?: boolean;
  stores?: string[];
  bas?: string[];
  totalValue: number;
  totalQty: number;
  txCount: number;
}

export const STORAGE_KEY_KEAKTIFAN_MONTH_OVERRIDES = 'salespro_keaktifan_monthly_overrides_v2';
export const STORAGE_KEY_KEAKTIFAN_CUSTOM_ENTITIES = 'salespro_keaktifan_entities_v2';
export const KEAKTIFAN_UPDATED_EVENT = 'salespro-keaktifan-updated';

const MONTHS_12 = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

const MONTH_ALIASES: Record<string, string> = {
  JANUARI: 'JANUARI',
  JANUARY: 'JANUARI',
  JAN: 'JANUARI',
  FEBRUARI: 'FEBRUARI',
  FEBRUARY: 'FEBRUARI',
  FEB: 'FEBRUARI',
  MARET: 'MARET',
  MARCH: 'MARET',
  MAR: 'MARET',
  APRIL: 'APRIL',
  APR: 'APRIL',
  MEI: 'MEI',
  MAY: 'MEI',
  JUNI: 'JUNI',
  JUNE: 'JUNI',
  JUN: 'JUNI',
  JULI: 'JULI',
  JULY: 'JULI',
  JUL: 'JULI',
  AGUSTUS: 'AGUSTUS',
  AUGUST: 'AGUSTUS',
  AGU: 'AGUSTUS',
  AGS: 'AGUSTUS',
  AUG: 'AGUSTUS',
  SEPTEMBER: 'SEPTEMBER',
  SEP: 'SEPTEMBER',
  SEPT: 'SEPTEMBER',
  OKTOBER: 'OKTOBER',
  OCTOBER: 'OKTOBER',
  OKT: 'OKTOBER',
  OCT: 'OKTOBER',
  NOVEMBER: 'NOVEMBER',
  NOV: 'NOVEMBER',
  NOP: 'NOVEMBER',
  DESEMBER: 'DESEMBER',
  DECEMBER: 'DESEMBER',
  DES: 'DESEMBER',
  DEC: 'DESEMBER',
};

const GENERIC_BA_PREFIXES = new Set([
  'BA TOKO',
  'BA GUARDIAN',
  'BA MISS',
  'BA WATSON',
  'BA SWALAYAN',
  'BA APOTEK',
  'BA WARUNG',
  'BA KIOS',
  'BA MART',
  'BA GROSIR',
  'BA KOSMETIK',
  'BA COSMETIC',
  'BA COUNTER',
  'BA STANDBY',
]);

export function loadKeaktifanCustomEntities(): CustomKeaktifanEntity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KEAKTIFAN_CUSTOM_ENTITIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('Failed to load keaktifan customEntities', e);
  }
  return [];
}

export function saveKeaktifanCustomEntities(entities: CustomKeaktifanEntity[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_KEAKTIFAN_CUSTOM_ENTITIES, JSON.stringify(entities));
    notifyKeaktifanUpdated();
  } catch (e) {
    console.warn('Failed to save keaktifan customEntities', e);
  }
}

export function notifyKeaktifanUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(KEAKTIFAN_UPDATED_EVENT));
    window.dispatchEvent(new CustomEvent('salespro-targets-updated', { detail: { category: 'keaktifan' } }));
  }
}

export function normalizeEntityKey(raw?: string): string {
  return (raw || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function isInvalidGenericEntity(normKey: string): boolean {
  return (
    !normKey ||
    normKey === '-' ||
    normKey === 'UNKNOWN' ||
    normKey === 'N/A' ||
    normKey === 'NULL' ||
    normKey === 'UNDEFINED' ||
    normKey === 'NONE' ||
    normKey === 'TIDAK DIKETAHUI' ||
    normKey === 'TIDAK ADA'
  );
}

export function isPlaceholderBaNameKeaktifan(baName?: string, storeName?: string): boolean {
  const clean = (baName || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (
    !clean ||
    clean === '-' ||
    clean === '- (NON-BA)' ||
    clean === 'NON BA' ||
    clean === 'NON-BA' ||
    clean === 'STANDBY' ||
    clean === 'BA STANDBY' ||
    clean === 'ALL' ||
    clean === 'EMPTY' ||
    clean === 'KOSONG' ||
    clean === 'VACANT' ||
    clean === 'NO BA' ||
    clean === 'TANPA BA' ||
    GENERIC_BA_PREFIXES.has(clean)
  ) {
    return true;
  }

  if (clean.startsWith('BA ') && storeName) {
    const firstStoreToken = storeName.split(',')[0]?.trim() || storeName;
    const firstWord = firstStoreToken.trim().split(/\s+/)[0]?.toUpperCase();
    if (firstWord && clean === `BA ${firstWord}`) {
      return true;
    }
  }

  return false;
}

export function isValidBaTransactionName(rawBa?: string, rawStore?: string): boolean {
  const norm = normalizeEntityKey(rawBa);
  if (isInvalidGenericEntity(norm)) return false;
  if (norm === 'TIDAK ADA BA' || norm === 'NO BA') return false;
  return !isPlaceholderBaNameKeaktifan(rawBa, rawStore);
}

export function resolveKeaktifanMonthAndYear(r: TransactionRecord): { month: string; year: number } {
  const dt = parseTransactionDate(r);
  const rawBulan = (r.BULAN || '').trim().toUpperCase();

  let resolvedMonth = '';
  if (rawBulan) {
    if (MONTH_ALIASES[rawBulan]) {
      resolvedMonth = MONTH_ALIASES[rawBulan];
    } else {
      const matched = MONTHS_12.find((m) => rawBulan.includes(m));
      if (matched) resolvedMonth = matched;
    }
  }
  if (!resolvedMonth && dt) {
    resolvedMonth = MONTHS_12[dt.getMonth()] || '';
  }

  const parsedYear = Number(r.TAHUN);
  const resolvedYear =
    !isNaN(parsedYear) && parsedYear > 1900 ? parsedYear : dt ? dt.getFullYear() : 0;

  return { month: resolvedMonth, year: resolvedYear };
}

/**
 * Normalizes '2026-10', 'OKTOBER 2026', 'OKT', or 'ALL' to 'ALL' | 'JANUARI'..'DESEMBER'
 */
export function normalizeKeaktifanMonthUpper(monthInput?: string): string {
  const raw = (monthInput || '').trim().toUpperCase();
  if (!raw || raw === 'ALL' || raw === 'SEMUA') return 'ALL';

  const isoMatch = raw.match(/^(20\d{2})[-/](\d{1,2})/);
  if (isoMatch) {
    const idx = parseInt(isoMatch[2], 10) - 1;
    if (idx >= 0 && idx < 12) return MONTHS_12[idx];
  }

  if (MONTH_ALIASES[raw]) return MONTH_ALIASES[raw];
  const matched = MONTHS_12.find((m) => raw.includes(m));
  if (matched) return matched;

  for (const [alias, canonical] of Object.entries(MONTH_ALIASES)) {
    if (raw.includes(alias)) return canonical;
  }

  return 'ALL';
}

export function filterRecordsForKeaktifan(
  records: TransactionRecord[],
  options?: {
    monthKey?: string;
    year?: number | string;
    ket?: 'ALL' | 'SELL IN' | 'SELL OUT';
  }
): TransactionRecord[] {
  const fYear =
    options?.year && options.year !== 'ALL' ? Number(options.year) || 0 : 0;
  const targetKet = options?.ket || 'ALL';
  const targetMonth = normalizeKeaktifanMonthUpper(options?.monthKey);

  return records.filter((r) => {
    const { month: recMonth, year: recYear } = resolveKeaktifanMonthAndYear(r);
    if (fYear > 0 && recYear > 0 && recYear !== fYear) return false;

    if (targetKet !== 'ALL') {
      const k = (r.KET || '').toUpperCase().trim();
      if (targetKet === 'SELL IN') {
        if (!(k.includes('SELL IN') || k.includes('SELL-IN') || k === 'SI' || k.includes('TAKING ORDER'))) {
          return false;
        }
      } else if (targetKet === 'SELL OUT') {
        if (k.includes('RETURN') || k.includes('RETUR')) return false;
        if (!(!k || k.includes('SELL OUT') || k.includes('SELL-OUT') || k === 'SO')) {
          return false;
        }
      }
    }

    if (targetMonth !== 'ALL') {
      const effectiveMonth = recMonth || (r.BULAN || '').toUpperCase().trim();
      if (effectiveMonth !== targetMonth) return false;
    }

    return true;
  });
}

export interface ActiveKeaktifanStoreEntry {
  id: string;
  storeName: string;
  coverArea: string;
  region: string;
  salesName: string;
  baName: string;
  baSet: Set<string>;
  hasBa: boolean;
  totalValue: number;
  totalQty: number;
  txCount: number;
}

export interface ActiveKeaktifanBaEntry {
  id: string;
  baName: string;
  baNumber: string;
  stores: Set<string>;
  sales: Set<string>;
  areas: Set<string>;
  regions: Set<string>;
  spvs: Set<string>;
  totalValue: number;
  totalQty: number;
  txCount: number;
  sellOutNonLavojoy: number;
  sellOutLavojoy: number;
  focusActualPcs: number;
}

export interface ActiveKeaktifanSalesEntry {
  id: string;
  salesName: string;
  coverArea: string;
  region: string;
  stores: Set<string>;
  bas: Set<string>;
  totalValue: number;
  totalQty: number;
  txCount: number;
}

export interface ActiveKeaktifanTrainerEntry {
  id: string;
  trainerName: string;
  areas: Set<string>;
  stores: Set<string>;
  bas: Set<string>;
  totalValue: number;
  totalQty: number;
  txCount: number;
}

export interface ActiveKeaktifanSnapshot {
  storeList: ActiveKeaktifanStoreEntry[];
  baList: ActiveKeaktifanBaEntry[];
  salesList: ActiveKeaktifanSalesEntry[];
  trainerList: ActiveKeaktifanTrainerEntry[];
  totalValue: number;
  totalQty: number;
  txCount: number;
}

function addCommaTokensToSet(target: Set<string>, raw?: string): void {
  if (!raw) return;
  raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && p !== '-' && p.toUpperCase() !== 'UNKNOWN')
    .forEach((p) => {
      const up = p.toUpperCase();
      if (!Array.from(target).some((x) => x.trim().toUpperCase() === up)) {
        target.add(p);
      }
    });
}

/**
 * Single Source of Truth untuk Info Keaktifan (Real Team) — Rincian Detail Keaktifan Periode.
 * Digunakan baik oleh Menu Info Keaktifan maupun Kelola Target (Nama BA & Gabungan Toko).
 */
export function extractActiveKeaktifanData(
  recList: TransactionRecord[],
  monthKey: string,
  customEntities?: CustomKeaktifanEntity[],
  baScopeFilters?: { sales?: string; store?: string; region?: string }
): ActiveKeaktifanSnapshot {
  const storeMap = new Map<string, ActiveKeaktifanStoreEntry>();
  const baMap = new Map<string, ActiveKeaktifanBaEntry>();
  const salesMap = new Map<string, ActiveKeaktifanSalesEntry>();
  const trainerMap = new Map<string, ActiveKeaktifanTrainerEntry>();

  let validTxCount = 0;
  let totalValueSum = 0;
  let totalQtySum = 0;

  recList.forEach((r) => {
    const val = Number(r.VALUE) || 0;
    const qty = Number(r.QTY) || 0;
    // Hanya hitung baris Google Sheet yang benar-benar memiliki transaksi (qty atau value != 0)
    if (val === 0 && qty === 0) return;

    validTxCount += 1;
    totalValueSum += val;
    totalQtySum += qty;

    const sName = (r.NAMA_STORE || '').trim().replace(/\s+/g, ' ');
    const sKey = normalizeEntityKey(sName);
    const bName = (r.BA || '').trim().replace(/\s+/g, ' ');
    const bKey = normalizeEntityKey(bName);
    const slName = (r.SALES || '').trim().replace(/\s+/g, ' ');
    const slKey = normalizeEntityKey(slName);
    const trName = getTrainerForRecord(r).trim().replace(/\s+/g, ' ');
    const trKey = normalizeEntityKey(trName);
    const area = (r.COVER_AREA || '-').trim();
    const region = (r.REGION || 'PEKAN BARU').trim();
    const spv = (r.SPV || '-').trim();

    const validStore = !isInvalidGenericEntity(sKey);
    const validBa = isValidBaTransactionName(bName, sName);
    const validSales = !isInvalidGenericEntity(slKey);
    const validTrainer = !isInvalidGenericEntity(trKey);

    // Toko Aktif
    if (validStore) {
      if (!storeMap.has(sKey)) {
        storeMap.set(sKey, {
          id: `store-${sKey}`,
          storeName: sName,
          coverArea: area,
          region,
          salesName: validSales ? slName : '-',
          baName: validBa ? bName : '-',
          baSet: new Set(validBa ? [bName] : []),
          hasBa: validBa,
          totalValue: 0,
          totalQty: 0,
          txCount: 0,
        });
      }
      const st = storeMap.get(sKey)!;
      if (validBa) {
        st.hasBa = true;
        const alreadyHasBa = Array.from(st.baSet).some((x) => normalizeEntityKey(x) === bKey);
        if (!alreadyHasBa) st.baSet.add(bName);
        st.baName = Array.from(st.baSet).join(', ');
      }
      if (validSales && (st.salesName === '-' || !st.salesName)) {
        st.salesName = slName;
      }
      if ((st.coverArea === '-' || !st.coverArea) && area && area !== '-') {
        st.coverArea = area;
      }
      st.totalValue += val;
      st.totalQty += qty;
      st.txCount += 1;
    }

    // BA Aktif
    if (validBa) {
      if (!baMap.has(bKey)) {
        baMap.set(bKey, {
          id: `ba-${bKey}`,
          baName: bName,
          baNumber: (r.BA_Number || '').trim(),
          stores: new Set(),
          sales: new Set(),
          areas: new Set(),
          regions: new Set(),
          spvs: new Set(),
          totalValue: 0,
          totalQty: 0,
          txCount: 0,
          sellOutNonLavojoy: 0,
          sellOutLavojoy: 0,
          focusActualPcs: 0,
        });
      }
      const b = baMap.get(bKey)!;
      if (validStore) b.stores.add(sName);
      if (validSales) b.sales.add(slName);
      if (area && area !== '-') b.areas.add(area);
      if (region && region !== '-') b.regions.add(region);
      if (spv && spv !== '-') b.spvs.add(spv);
      if (!b.baNumber && r.BA_Number) b.baNumber = r.BA_Number.trim();
      b.totalValue += val;
      b.totalQty += qty;
      b.txCount += 1;

      const ketUpper = (r.KET || '').toUpperCase().trim();
      const isSellIn = ketUpper === 'SELL IN' || ketUpper.includes('SELL IN') || ketUpper.includes('SELL-IN');
      const isSellOut = !isSellIn && !ketUpper.includes('RETURN') && !ketUpper.includes('RETUR');
      const isLavojoy = (r.BRAND || '').toLowerCase().includes('lavojoy');
      const isFocus = isFocusProduct(r.PRODUK_FOCUS || r);

      if (isSellOut) {
        if (isLavojoy) b.sellOutLavojoy += val;
        else b.sellOutNonLavojoy += val;
      }
      if (isFocus && (isSellOut || isSellIn)) {
        b.focusActualPcs += Math.max(0, qty);
      }
    }

    // Sales Aktif
    if (validSales) {
      if (!salesMap.has(slKey)) {
        salesMap.set(slKey, {
          id: `sales-${slKey}`,
          salesName: slName,
          coverArea: area,
          region,
          stores: new Set(),
          bas: new Set(),
          totalValue: 0,
          totalQty: 0,
          txCount: 0,
        });
      }
      const sl = salesMap.get(slKey)!;
      if (validStore) sl.stores.add(sName);
      if (validBa) sl.bas.add(bKey);
      sl.totalValue += val;
      sl.totalQty += qty;
      sl.txCount += 1;
    }

    // Trainer Aktif
    if (validTrainer) {
      if (!trainerMap.has(trKey)) {
        trainerMap.set(trKey, {
          id: `trainer-${trKey}`,
          trainerName: trName,
          areas: new Set(),
          stores: new Set(),
          bas: new Set(),
          totalValue: 0,
          totalQty: 0,
          txCount: 0,
        });
      }
      const tr = trainerMap.get(trKey)!;
      if (area && area !== '-') tr.areas.add(area);
      if (validStore) tr.stores.add(sKey);
      if (validBa) tr.bas.add(bKey);
      tr.totalValue += val;
      tr.totalQty += qty;
      tr.txCount += 1;
    }
  });

  // Merge custom entities for this month (sinkron manual dari Info Keaktifan / Kelola Target)
  const effectiveCustomList = customEntities ?? loadKeaktifanCustomEntities();
  const targetMonthUpper = normalizeKeaktifanMonthUpper(monthKey);
  const monthCustom = effectiveCustomList.filter((c) => {
    const cMonthUpper = normalizeKeaktifanMonthUpper(c.monthKey);
    return cMonthUpper === targetMonthUpper || targetMonthUpper === 'ALL';
  });

  const filterSalesUpper = baScopeFilters?.sales && baScopeFilters.sales !== 'ALL' ? baScopeFilters.sales.trim().toUpperCase() : '';
  const filterStoreUpper = baScopeFilters?.store && baScopeFilters.store !== 'ALL' ? baScopeFilters.store.trim().toUpperCase() : '';
  const filterRegionUpper = baScopeFilters?.region && baScopeFilters.region !== 'ALL' ? baScopeFilters.region.trim().toUpperCase() : '';

  monthCustom.forEach((c) => {
    const cKey = normalizeEntityKey(c.name);
    if (!cKey) return;
    if (c.type === 'toko') {
      storeMap.set(cKey, {
        id: c.id,
        storeName: c.name,
        coverArea: c.area || '-',
        region: c.region || 'PEKAN BARU',
        salesName: c.salesName || '-',
        baName: c.baName || '-',
        baSet: new Set(c.baName && c.baName !== '-' ? [c.baName] : []),
        hasBa: Boolean(c.hasBa),
        totalValue: c.totalValue || 0,
        totalQty: c.totalQty || 0,
        txCount: c.txCount || 1,
      });
    } else if (c.type === 'ba') {
      // Hormati baScopeFilters jika pemanggil berasal dari dashboard terfilter spesifik
      if (filterSalesUpper) {
        const salesTokens = (c.salesName || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (!salesTokens.includes(filterSalesUpper)) return;
      }
      if (filterStoreUpper) {
        const storeTokens = (c.stores || []).map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (!storeTokens.includes(filterStoreUpper)) return;
      }
      if (filterRegionUpper) {
        const areaTokens = (c.area || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        const regUpper = (c.region || '').trim().toUpperCase();
        if (!areaTokens.includes(filterRegionUpper) && regUpper !== filterRegionUpper) return;
      }

      const prev = baMap.get(cKey);
      const salesSet = new Set<string>();
      addCommaTokensToSet(salesSet, c.salesName);
      const areasSet = new Set<string>();
      addCommaTokensToSet(areasSet, c.area);
      const regionsSet = new Set<string>(prev?.regions ? Array.from(prev.regions) : []);
      if (c.region && c.region !== '-') addCommaTokensToSet(regionsSet, c.region);
      const spvsSet = new Set<string>(prev?.spvs ? Array.from(prev.spvs) : []);

      baMap.set(cKey, {
        id: c.id,
        baName: c.name,
        baNumber: prev?.baNumber || '',
        stores: new Set((c.stores || []).map((s) => s.trim()).filter(Boolean)),
        sales: salesSet,
        areas: areasSet,
        regions: regionsSet,
        spvs: spvsSet,
        totalValue: c.totalValue || 0,
        totalQty: c.totalQty || 0,
        txCount: c.txCount || 1,
        sellOutNonLavojoy: prev ? prev.sellOutNonLavojoy : 0,
        sellOutLavojoy: prev ? prev.sellOutLavojoy : 0,
        focusActualPcs: prev ? prev.focusActualPcs : 0,
      });
    } else if (c.type === 'sales') {
      salesMap.set(cKey, {
        id: c.id,
        salesName: c.name,
        coverArea: c.area || '-',
        region: c.region || 'PEKAN BARU',
        stores: new Set(c.stores || []),
        bas: new Set(c.bas || []),
        totalValue: c.totalValue || 0,
        totalQty: c.totalQty || 0,
        txCount: c.txCount || 1,
      });
    } else if (c.type === 'trainer') {
      trainerMap.set(cKey, {
        id: c.id,
        trainerName: c.name,
        areas: new Set(c.area ? [c.area] : []),
        stores: new Set(c.stores || []),
        bas: new Set(c.bas || []),
        totalValue: c.totalValue || 0,
        totalQty: c.totalQty || 0,
        txCount: c.txCount || 1,
      });
    }
  });

  return {
    storeList: Array.from(storeMap.values()).sort((a, b) => b.totalValue - a.totalValue),
    baList: Array.from(baMap.values()).sort((a, b) => b.totalValue - a.totalValue),
    salesList: Array.from(salesMap.values()).sort((a, b) => b.totalValue - a.totalValue),
    trainerList: Array.from(trainerMap.values()).sort((a, b) => b.totalValue - a.totalValue),
    totalValue: totalValueSum,
    totalQty: totalQtySum,
    txCount: validTxCount,
  };
}
