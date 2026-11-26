import {
  TransactionRecord,
  DashboardFilters,
  MetricSummary,
  GrowthMetric,
  DimensionPerformance,
  TimeframeMode,
  SalesGapDiagnosis,
  DropEntityItem,
  GapDriverFactor,
  FactorStoreContribution,
  StoreGapDetailItem,
  EntityProductAnalysisItem,
  FocusNewOverallSummary,
  ComparisonGrowthResult,
  ProductStatusSummary,
  ProductStatusMetricItem,
  ProductLifecycleStatus,
} from '../types/dashboard';
import {
  resolveActiveGapQuotaDetail,
  GAP_TRAINER_LIST,
  GapMonthlyQuotaConfig,
} from '../services/gapTargetService';

// Product Lifecycle Statuses (Bilingual Chinese - English)
export const ALL_PRODUCT_STATUSES: ProductLifecycleStatus[] = [
  '核心品 - Core Products',
  '新品 - New Products',
  '常规品 - Regular Products',
  '清库品 - Clearance',
  '淘汰品 - Discontinue Products',
  '退市品 - Delisted Product',
  '淘汰品 - Obsolete',
];

export const PRODUCT_STATUS_CONFIG: Record<
  string,
  {
    labelCn: string;
    labelEn: string;
    labelId: string;
    color: string;
    badgeClass: string;
    borderClass: string;
    bgClass: string;
    actionStrategy: string;
    priority: number;
  }
> = {
  '核心品 - Core Products': {
    labelCn: '核心品',
    labelEn: 'Core Products',
    labelId: 'Produk Inti / Hero',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    borderClass: 'border-emerald-300',
    bgClass: 'from-emerald-500/10 to-teal-500/5',
    actionStrategy: 'Pertahankan ketersediaan stok 98%+, tempatkan di display utama gerai, hindari OOS.',
    priority: 1,
  },
  '新品 - New Products': {
    labelCn: '新品',
    labelEn: 'New Products',
    labelId: 'Produk Baru / Launching',
    color: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    borderClass: 'border-blue-300',
    bgClass: 'from-blue-500/10 to-indigo-500/5',
    actionStrategy: 'Genjot penetrasi toko (NOO), program tester BA aktif, sampling konsumen, display eye-level.',
    priority: 2,
  },
  '常规品 - Regular Products': {
    labelCn: '常规品',
    labelEn: 'Regular Products',
    labelId: 'Produk Reguler / Stabil',
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    borderClass: 'border-slate-300',
    bgClass: 'from-slate-500/10 to-slate-400/5',
    actionStrategy: 'Jaga perputaran stok normal (run-rate), reorder terjadwal, dan pertahankan space shelf.',
    priority: 3,
  },
  '清库品 - Clearance': {
    labelCn: '清库品',
    labelEn: 'Clearance',
    labelId: 'Cuci Gudang / Clearance',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    borderClass: 'border-amber-300',
    bgClass: 'from-amber-500/10 to-yellow-500/5',
    actionStrategy: 'Program bundling diskon agresif, bonus beli 2 gratis 1, pindahkan ke toko bervolume tinggi.',
    priority: 4,
  },
  '淘汰品 - Discontinue Products': {
    labelCn: '淘汰品',
    labelEn: 'Discontinue Products',
    labelId: 'Produk Diskontinu',
    color: 'orange',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    borderClass: 'border-orange-300',
    bgClass: 'from-orange-500/10 to-amber-500/5',
    actionStrategy: 'Hentikan pengadaan baru, percepat sell-down sisa stok ke toko tier-2/3, alihkan ke SKU pengganti.',
    priority: 5,
  },
  '退市品 - Delisted Product': {
    labelCn: '退市品',
    labelEn: 'Delisted Product',
    labelId: 'Produk Ditarik / Delisted',
    color: 'purple',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    borderClass: 'border-purple-300',
    bgClass: 'from-purple-500/10 to-pink-500/5',
    actionStrategy: 'Koordinasi penarikan dari rak display toko modern/DC, tutup PO aktif, proses retur distributor.',
    priority: 6,
  },
  '淘汰品 - Obsolete': {
    labelCn: '淘汰品',
    labelEn: 'Obsolete',
    labelId: 'Produk Usang / Obsolete',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    borderClass: 'border-rose-300',
    bgClass: 'from-rose-500/10 to-red-500/5',
    actionStrategy: 'Lakukan evaluasi write-off / pemusnahan barang rusak-kadaluarsa, atau lelang aset batch akhir.',
    priority: 7,
  },
};

export const SKU_STATUS_MAP: Record<string, string> = {
  '18186': '核心品 - Core Products',
  '18629': '核心品 - Core Products',
  '115888': '淘汰品 - Obsolete',
  '672495': '新品 - New Products',
  '115017': '核心品 - Core Products',
  '117509': '清库品 - Clearance',
  '123685': '新品 - New Products',
  '21018': '核心品 - Core Products',
  '15604': '常规品 - Regular Products',
  '671528': '淘汰品 - Discontinue Products',
  '673546': '新品 - New Products',
  '898478': '常规品 - Regular Products',
  '118803': '新品 - New Products',
  '673829': '新品 - New Products',
  '1836': '核心品 - Core Products',
  '672464': '新品 - New Products',
  '117479': '常规品 - Regular Products',
  '676769': '核心品 - Core Products',
  '107432': '淘汰品 - Discontinue Products',
  '121421': '新品 - New Products',
  '115697': '常规品 - Regular Products',
  '671573': '核心品 - Core Products',
  '672747': '核心品 - Core Products',
  '109634': '常规品 - Regular Products',
  '673584': '新品 - New Products',
  '19183': '核心品 - Core Products',
  '117516': '清库品 - Clearance',
  '19176': '常规品 - Regular Products',
  '3205': '清库品 - Clearance',
  '671054': '核心品 - Core Products',
  '670316': '退市品 - Delisted Product',
  '672907': '新品 - New Products',
  '674208': '新品 - New Products',
  '18315': '退市品 - Delisted Product',
  '115482': '淘汰品 - Obsolete',
  '5360': '清库品 - Clearance',
  '672471': '新品 - New Products',
};

// Robust resolver for product lifecycle status
export function resolveProductStatus(record: TransactionRecord): string {
  if (record.STATUS_PRODUK && record.STATUS_PRODUK.trim()) {
    const raw = record.STATUS_PRODUK.trim();
    // Check if matches known statuses directly
    const matched = ALL_PRODUCT_STATUSES.find(
      (s) => s.toLowerCase() === raw.toLowerCase() || s.includes(raw) || raw.includes(s.split(' - ')[0])
    );
    if (matched) return matched;
    return raw;
  }
  if (record.NO_SKU && SKU_STATUS_MAP[record.NO_SKU]) {
    return SKU_STATUS_MAP[record.NO_SKU];
  }
  for (const [noSku, status] of Object.entries(SKU_STATUS_MAP)) {
    if (record.SKU && record.SKU.includes(noSku)) return status;
  }
  if (isNewProduct(record.PRODUK_NEW)) {
    return '新品 - New Products';
  }
  if (isFocusProduct(record.PRODUK_FOCUS)) {
    return '核心品 - Core Products';
  }
  return '常规品 - Regular Products';
}

// Category Classifier from SKU & Brand Name (Intelligent Fallback)
export function detectCategoryFromSku(sku?: string, brand?: string): string {
  const text = `${sku || ''} ${brand || ''}`.toUpperCase();
  if (!text.trim()) return 'Lip Makeup';

  // 1. Lip Makeup
  if (
    text.includes('LIP') ||
    text.includes('TINT') ||
    text.includes('LIPSTICK') ||
    text.includes('LIP CREAM') ||
    text.includes('LIP BALM') ||
    text.includes('VINYL') ||
    text.includes('MOUSSE TINT') ||
    text.includes('GLOSS') ||
    text.includes('CLOUD PAINT') ||
    text.includes('INK-GLOSS') ||
    text.includes('INK-MATTE') ||
    text.includes('CHERRY MAKES') ||
    text.includes('PEACH MAKES') ||
    text.includes('SILVER MAKES')
  ) {
    return 'Lip Makeup';
  }

  // 2. Sunscreen / UV Protection
  if (
    text.includes('SUN') ||
    text.includes('SUNSCREEN') ||
    text.includes('SUNBRELLA') ||
    text.includes('UV') ||
    text.includes('SPF')
  ) {
    return 'Sunscreen';
  }

  // 3. Body Care
  if (
    text.includes('BODY') ||
    text.includes('BODY SERUM') ||
    text.includes('BODY SCRUB') ||
    text.includes('LOTION') ||
    text.includes('SHOWER') ||
    text.includes('BATH') ||
    text.includes('SOAP') ||
    text.includes('SCRUB')
  ) {
    return 'Body Care';
  }

  // 4. Hair Care
  if (
    text.includes('HAIR') ||
    text.includes('SHAMPOO') ||
    text.includes('CONDITIONER') ||
    text.includes('SCALP') ||
    text.includes('HAIR OIL') ||
    text.includes('HAIR MASK')
  ) {
    return 'Hair Care';
  }

  // 5. Complexion & Powder
  if (
    text.includes('POWDER') ||
    text.includes('FOUNDATION') ||
    text.includes('CUSHION') ||
    text.includes('BLUSH') ||
    text.includes('SETTING SPRAY') ||
    text.includes('CONCEALER') ||
    text.includes('COMPACT') ||
    text.includes('LOOSE POWDER') ||
    text.includes('GET A GRIP') ||
    text.includes('BETTER THAN FILTER') ||
    text.includes('COVER ME')
  ) {
    return 'Complexion & Powder';
  }

  // 6. Eye & Lash Tools
  if (
    text.includes('EYE') ||
    text.includes('LASH') ||
    text.includes('MASCARA') ||
    text.includes('BROW') ||
    text.includes('EYELINER') ||
    text.includes('EYEBROW') ||
    text.includes('CURLER') ||
    text.includes('PUFF') ||
    text.includes('SPONGE') ||
    text.includes('BRUSH') ||
    text.includes('GLAMFIX')
  ) {
    return 'Eye & Lash Tools';
  }

  // 7. Skincare
  if (
    text.includes('SERUM') ||
    text.includes('MICELLAR') ||
    text.includes('CLEANSER') ||
    text.includes('TONER') ||
    text.includes('MOISTURIZER') ||
    text.includes('ACNE') ||
    text.includes('RADIANCE') ||
    text.includes('ESSENCE') ||
    text.includes('CREAM') ||
    text.includes('GEL') ||
    text.includes('FACIAL') ||
    text.includes('AMINO') ||
    text.includes('CENTELLA') ||
    text.includes('BARRIER')
  ) {
    return 'Skincare';
  }

  return 'Lip Makeup';
}

// Resolver for record category with automatic fallback
export function resolveCategory(record: Partial<TransactionRecord>): string {
  if (record.KATEGORI && record.KATEGORI.trim() && record.KATEGORI.trim().toUpperCase() !== 'LAINNYA' && record.KATEGORI.trim().toUpperCase() !== 'UNKNOWN') {
    return record.KATEGORI.trim();
  }
  return detectCategoryFromSku(record.SKU, record.BRAND);
}

// Product type detection helpers
export function isFocusProduct(val?: any): boolean {
  if (!val) return false;
  if (typeof val === 'object') {
    const r = val as any;
    return (
      isFocusProduct(r.PRODUK_FOCUS) ||
      isFocusProduct(r['PRODUK FOKUS']) ||
      isFocusProduct(r.PRODUK_FOKUS) ||
      isFocusProduct(r['PRODUK FOCUS']) ||
      isFocusProduct(r.FOCUS) ||
      isFocusProduct(r.FOKUS) ||
      isFocusProduct(r.focus)
    );
  }
  const upper = String(val).trim().toUpperCase();
  if (
    !upper ||
    upper === 'REGULAR' ||
    upper === 'EXISTING' ||
    upper === 'NO' ||
    upper === 'FALSE' ||
    upper === '-' ||
    upper === 'BUKAN' ||
    upper === 'NON' ||
    upper === '0'
  ) {
    return false;
  }
  return (
    upper.includes('FOKUS') ||
    upper.includes('FOCUS') ||
    upper === 'YES' ||
    upper === 'YA' ||
    upper === 'TRUE' ||
    upper === 'Y' ||
    upper === '1'
  );
}

export function isNewProduct(val?: any): boolean {
  if (!val) return false;
  if (typeof val === 'object') {
    const r = val as any;
    return (
      isNewProduct(r.PRODUK_NEW) ||
      isNewProduct(r['PRODUK NEW']) ||
      isNewProduct(r.PRODUK_BARU) ||
      isNewProduct(r['PRODUK BARU']) ||
      isNewProduct(r.NEW) ||
      isNewProduct(r.BARU) ||
      isNewProduct(r.new)
    );
  }
  const upper = String(val).trim().toUpperCase();
  if (
    !upper ||
    upper === 'EXISTING' ||
    upper === 'REGULAR' ||
    upper === 'NO' ||
    upper === 'FALSE' ||
    upper === '-' ||
    upper === 'LAMA' ||
    upper === 'OLD' ||
    upper === '0'
  ) {
    return false;
  }
  return (
    upper.includes('NEW') ||
    upper.includes('BARU') ||
    upper === 'YES' ||
    upper === 'YA' ||
    upper === 'TRUE' ||
    upper === 'Y' ||
    upper === '1'
  );
}

export const MONTH_ORDER: Record<string, number> = {
  JANUARI: 1,
  FEBRUARI: 2,
  MARET: 3,
  APRIL: 4,
  MEI: 5,
  JUNI: 6,
  JULI: 7,
  AGUSTUS: 8,
  SEPTEMBER: 9,
  OKTOBER: 10,
  NOVEMBER: 11,
  DESEMBER: 12,
};

export const MONTH_NAMES_ID = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

const MONTH_ALIASES_MAP: Record<string, string> = {
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
  DESEMBER: 'DESEMBER',
  DECEMBER: 'DESEMBER',
  DES: 'DESEMBER',
  DEC: 'DESEMBER',
};

function normalizeKetType(ket?: string): 'SELL IN' | 'SELL OUT' | 'RETURN' | string {
  const upper = (ket || '').trim().toUpperCase();
  if (!upper) return '';
  if (upper.includes('RETURN') || upper.includes('RETUR')) return 'RETURN';
  if (
    upper === 'SELL IN' ||
    upper.includes('SELL IN') ||
    upper.includes('SELL-IN') ||
    upper === 'SELLIN' ||
    upper.includes('TAKING ORDER')
  ) {
    return 'SELL IN';
  }
  if (
    upper === 'SELL OUT' ||
    upper.includes('SELL OUT') ||
    upper.includes('SELL-OUT') ||
    upper === 'SELLOUT'
  ) {
    return 'SELL OUT';
  }
  return upper;
}

// Indonesian Rupiah formatter
export function formatRupiah(amount: number, compact: boolean = false): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rp 0';

  if (compact) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
      return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
    }
    if (abs >= 1_000_000) {
      return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
    }
    if (abs >= 1_000) {
      return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
    }
  }

  const isNeg = amount < 0;
  const absInt = Math.abs(Math.round(amount));
  const formatted = absInt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '- ' : ''}Rp ${formatted}`;
}

// Number formatter with dots
export function formatNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Percent formatter with +/- sign
export function formatPercent(percent: number, showSign: boolean = true): string {
  if (percent === undefined || percent === null || isNaN(percent) || !isFinite(percent)) return '0%';
  const sign = percent > 0 && showSign ? '+' : '';
  return `${sign}${percent.toFixed(1).replace('.', ',')}%`;
}

// Filter engine: cascades cross-filters (pre-normalized & O(1) fast-path when unfiltered)
export function filterRecords(
  records: TransactionRecord[],
  filters: DashboardFilters
): TransactionRecord[] {
  const fBulan = filters.BULAN !== 'ALL' ? filters.BULAN.trim().toUpperCase() : '';
  const fTahun = filters.TAHUN !== 'ALL' ? String(filters.TAHUN).trim() : '';
  const fSales = filters.SALES !== 'ALL' ? filters.SALES.trim().toUpperCase() : '';
  const fTrainer =
    filters.TRAINER && filters.TRAINER !== 'ALL' ? filters.TRAINER.trim().toUpperCase() : '';
  const fSpv = filters.SPV !== 'ALL' ? filters.SPV.trim().toUpperCase() : '';
  const fBrand = filters.BRAND !== 'ALL' ? filters.BRAND.trim().toUpperCase() : '';
  const fKategori =
    filters.KATEGORI && filters.KATEGORI !== 'ALL' ? filters.KATEGORI.trim().toUpperCase() : '';
  const fStatus =
    filters.STATUS_PRODUK && filters.STATUS_PRODUK !== 'ALL' ? filters.STATUS_PRODUK : '';
  const fStore = filters.NAMA_STORE !== 'ALL' ? filters.NAMA_STORE.trim().toUpperCase() : '';
  const fRegion = filters.REGION !== 'ALL' ? filters.REGION.trim().toUpperCase() : '';
  const fKet = filters.KET && filters.KET !== 'ALL' ? filters.KET.trim().toUpperCase() : '';
  const fSku = filters.SKU !== 'ALL' ? filters.SKU.toLowerCase() : '';
  const fSkuRaw = filters.SKU !== 'ALL' ? filters.SKU : '';
  const q = filters.searchQuery ? filters.searchQuery.trim().toLowerCase() : '';

  if (
    !fBulan &&
    !fTahun &&
    !fSales &&
    !fTrainer &&
    !fSpv &&
    !fBrand &&
    !fKategori &&
    !fStatus &&
    !fStore &&
    !fRegion &&
    !fKet &&
    !fSku &&
    !q
  ) {
    return records;
  }

  const out: TransactionRecord[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (fBulan && (r.BULAN || '').trim().toUpperCase() !== fBulan) continue;
    if (fTahun && String(r.TAHUN || '').trim() !== fTahun) continue;
    if (fSales && (r.SALES || '').trim().toUpperCase() !== fSales) continue;
    if (fTrainer && getTrainerForRecord(r).trim().toUpperCase() !== fTrainer) continue;
    if (fSpv && (r.SPV || '').trim().toUpperCase() !== fSpv) continue;
    if (fBrand && (r.BRAND || '').trim().toUpperCase() !== fBrand) continue;
    if (fKategori && resolveCategory(r).trim().toUpperCase() !== fKategori) continue;
    if (fStatus && resolveProductStatus(r) !== fStatus) continue;
    if (fStore && (r.NAMA_STORE || '').trim().toUpperCase() !== fStore) continue;
    if (fRegion && (r.REGION || '').trim().toUpperCase() !== fRegion) continue;
    if (fKet) {
      const recKet = (r.KET || '').trim().toUpperCase();
      const normFilterKet = normalizeKetType(fKet);
      if (normFilterKet === 'SELL IN' || normFilterKet === 'SELL OUT') {
        if (normalizeKetType(recKet) !== normFilterKet) continue;
      } else if (recKet !== fKet) {
        continue;
      }
    }

    if (fSku) {
      const matchSku =
        (r.SKU || '').toLowerCase().includes(fSku) ||
        (r.NO_SKU || '').includes(fSkuRaw) ||
        (r.SPU || '').toLowerCase().includes(fSku);
      if (!matchSku) continue;
    }

    if (q) {
      const trainerName = getTrainerForRecord(r).toLowerCase();
      const resolvedCat = resolveCategory(r).toLowerCase();
      const match =
        (r.TANGGAL && r.TANGGAL.toLowerCase().includes(q)) ||
        (r.BULAN && r.BULAN.toLowerCase().includes(q)) ||
        (r.SKU && r.SKU.toLowerCase().includes(q)) ||
        resolvedCat.includes(q) ||
        (r.STATUS_PRODUK && r.STATUS_PRODUK.toLowerCase().includes(q)) ||
        (r.NAMA_STORE && r.NAMA_STORE.toLowerCase().includes(q)) ||
        (r.SALES && r.SALES.toLowerCase().includes(q)) ||
        trainerName.includes(q) ||
        (r.SPV && r.SPV.toLowerCase().includes(q)) ||
        (r.BRAND && r.BRAND.toLowerCase().includes(q)) ||
        (r.REGION && r.REGION.toLowerCase().includes(q)) ||
        (r.NO_SKU && r.NO_SKU.toLowerCase().includes(q)) ||
        (r.SPU && r.SPU.toLowerCase().includes(q)) ||
        (r.BA && r.BA.toLowerCase().includes(q)) ||
        (r.COVER_AREA && r.COVER_AREA.toLowerCase().includes(q)) ||
        (r.KET && r.KET.toLowerCase().includes(q));
      if (!match) continue;
    }

    out.push(r);
  }
  return out;
}

// Get dynamic available filter options based on other active selections (cascading)
export function getCascadingOptions(
  allRecords: TransactionRecord[],
  currentFilters: DashboardFilters
) {
  const fBulan = currentFilters.BULAN !== 'ALL' ? currentFilters.BULAN.trim().toUpperCase() : '';
  const fTahun = currentFilters.TAHUN !== 'ALL' ? String(currentFilters.TAHUN).trim() : '';
  const fSales = currentFilters.SALES !== 'ALL' ? currentFilters.SALES.trim().toUpperCase() : '';
  const fTrainer =
    currentFilters.TRAINER && currentFilters.TRAINER !== 'ALL'
      ? currentFilters.TRAINER.trim().toUpperCase()
      : '';
  const fSpv = currentFilters.SPV !== 'ALL' ? currentFilters.SPV.trim().toUpperCase() : '';
  const fBrand = currentFilters.BRAND !== 'ALL' ? currentFilters.BRAND.trim().toUpperCase() : '';
  const fKategori =
    currentFilters.KATEGORI && currentFilters.KATEGORI !== 'ALL'
      ? currentFilters.KATEGORI.trim().toUpperCase()
      : '';
  const fStatus =
    currentFilters.STATUS_PRODUK && currentFilters.STATUS_PRODUK !== 'ALL'
      ? currentFilters.STATUS_PRODUK
      : '';
  const fStore =
    currentFilters.NAMA_STORE !== 'ALL' ? currentFilters.NAMA_STORE.trim().toUpperCase() : '';
  const fRegion = currentFilters.REGION !== 'ALL' ? currentFilters.REGION.trim().toUpperCase() : '';
  const fKet = currentFilters.KET !== 'ALL' ? currentFilters.KET.trim().toUpperCase() : '';

  const monthsSet = new Set<string>();
  const yearsSet = new Set<string>();
  const salesSet = new Set<string>();
  const trainersSet = new Set<string>(GAP_TRAINER_LIST);
  const spvSet = new Set<string>();
  const brandsSet = new Set<string>();
  const categoriesSet = new Set<string>();
  const statusSet = new Set<string>();
  const storesSet = new Set<string>();
  const regionsSet = new Set<string>();
  const ketSet = new Set<string>();

  for (let i = 0; i < allRecords.length; i++) {
    const r = allRecords[i];

    const rawBulan = String(r.BULAN || '').trim();
    const rawTahun = String(r.TAHUN || '').trim();
    const rawSales = String(r.SALES || '').trim();
    const rawSpv = String(r.SPV || '').trim();
    const rawBrand = String(r.BRAND || '').trim();
    const rawStore = String(r.NAMA_STORE || '').trim();
    const rawRegion = String(r.REGION || '').trim();
    const rawKet = String(r.KET || '').trim();

    let failCount = 0;
    let failedSlot = -1;

    if (fBulan && rawBulan.toUpperCase() !== fBulan) {
      failCount++;
      failedSlot = 0;
    }
    if (fTahun && rawTahun !== fTahun) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 1;
    }
    if (fSales && rawSales.toUpperCase() !== fSales) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 2;
    }
    if (fSpv && rawSpv.toUpperCase() !== fSpv) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 4;
    }
    if (fBrand && rawBrand.toUpperCase() !== fBrand) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 5;
    }
    if (fStore && rawStore.toUpperCase() !== fStore) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 8;
    }
    if (fRegion && rawRegion.toUpperCase() !== fRegion) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 9;
    }
    if (fKet && rawKet.toUpperCase() !== fKet) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 10;
    }

    const trainerVal = getTrainerForRecord(r);
    if (fTrainer && trainerVal.trim().toUpperCase() !== fTrainer) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 3;
    }

    const catVal = resolveCategory(r);
    if (fKategori && catVal.trim().toUpperCase() !== fKategori) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 6;
    }

    const statusVal = resolveProductStatus(r);
    if (fStatus && statusVal !== fStatus) {
      failCount++;
      if (failCount > 1) continue;
      failedSlot = 7;
    }

    if (failCount === 0) {
      if (rawBulan) monthsSet.add(rawBulan);
      if (rawTahun) yearsSet.add(rawTahun);
      if (rawSales) salesSet.add(rawSales);
      if (trainerVal) trainersSet.add(trainerVal);
      if (rawSpv) spvSet.add(rawSpv);
      if (rawBrand) brandsSet.add(rawBrand);
      if (catVal) categoriesSet.add(catVal);
      if (statusVal) statusSet.add(statusVal);
      if (rawStore) storesSet.add(rawStore);
      if (rawRegion) regionsSet.add(rawRegion);
      if (rawKet) ketSet.add(rawKet);
    } else if (failCount === 1) {
      if (failedSlot === 0 && rawBulan) monthsSet.add(rawBulan);
      else if (failedSlot === 1 && rawTahun) yearsSet.add(rawTahun);
      else if (failedSlot === 2 && rawSales) salesSet.add(rawSales);
      else if (failedSlot === 3 && trainerVal) trainersSet.add(trainerVal);
      else if (failedSlot === 4 && rawSpv) spvSet.add(rawSpv);
      else if (failedSlot === 5 && rawBrand) brandsSet.add(rawBrand);
      else if (failedSlot === 6 && catVal) categoriesSet.add(catVal);
      else if (failedSlot === 7 && statusVal) statusSet.add(statusVal);
      else if (failedSlot === 8 && rawStore) storesSet.add(rawStore);
      else if (failedSlot === 9 && rawRegion) regionsSet.add(rawRegion);
      else if (failedSlot === 10 && rawKet) ketSet.add(rawKet);
    }
  }

  const availableMonths = Array.from(monthsSet).sort(
    (a, b) => (MONTH_ORDER[a.toUpperCase()] || 99) - (MONTH_ORDER[b.toUpperCase()] || 99)
  );
  const availableYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  const availableSales = Array.from(salesSet).sort();
  const availableTrainers = Array.from(trainersSet).sort();
  const availableSpv = Array.from(spvSet).sort();
  const availableBrands = Array.from(brandsSet).sort();
  const availableCategories = Array.from(categoriesSet).sort();
  const availableStores = Array.from(storesSet).sort();
  const availableRegions = Array.from(regionsSet).sort();
  const availableKet = Array.from(ketSet).sort();
  const availableStatusProduk = Array.from(statusSet).sort((a, b) => {
    const priorityA = PRODUCT_STATUS_CONFIG[a]?.priority || 99;
    const priorityB = PRODUCT_STATUS_CONFIG[b]?.priority || 99;
    return priorityA - priorityB;
  });

  return {
    months: availableMonths,
    years: availableYears,
    sales: availableSales,
    trainers: availableTrainers,
    spv: availableSpv,
    brands: availableBrands,
    categories: availableCategories,
    statusProduk: availableStatusProduk,
    stores: availableStores,
    regions: availableRegions,
    ket: availableKet,
  };
}

// Analisa Status Produk (Product Lifecycle & Merchandising Performance)
export function calculateProductStatusAnalysis(records: TransactionRecord[]): ProductStatusSummary {
  let totalValue = 0;
  let totalQty = 0;

  const statusSkus: Record<string, Set<string>> = {};
  const statusValues: Record<string, number> = {};
  const statusQtys: Record<string, number> = {};
  const statusTxCounts: Record<string, number> = {};
  const skuAggregation: Record<
    string,
    { sku: string; brand: string; noSku: string; kategori: string; status: string; value: number; qty: number }
  > = {};

  // Inisialisasi 7 status standar agar selalu terurut dan konsisten
  ALL_PRODUCT_STATUSES.forEach((st) => {
    statusSkus[st] = new Set<string>();
    statusValues[st] = 0;
    statusQtys[st] = 0;
    statusTxCounts[st] = 0;
  });

  const allDistinctSkus = new Set<string>();

  for (const r of records) {
    const val = r.VALUE || 0;
    const qty = r.QTY || 0;
    const status = resolveProductStatus(r);

    totalValue += val;
    totalQty += qty;

    const skuKey = r.NO_SKU || r.SKU;
    allDistinctSkus.add(skuKey);

    if (!statusSkus[status]) {
      statusSkus[status] = new Set<string>();
      statusValues[status] = 0;
      statusQtys[status] = 0;
      statusTxCounts[status] = 0;
    }

    statusSkus[status].add(skuKey);
    statusValues[status] += val;
    statusQtys[status] += qty;
    statusTxCounts[status] += 1;

    // Track per-SKU
    if (!skuAggregation[skuKey]) {
      skuAggregation[skuKey] = {
        sku: r.SKU,
        brand: r.BRAND,
        noSku: r.NO_SKU,
        kategori: r.KATEGORI || 'Lainnya',
        status,
        value: 0,
        qty: 0,
      };
    }
    skuAggregation[skuKey].value += val;
    skuAggregation[skuKey].qty += qty;
  }

  // Bangun daftar metrik status produk
  const statuses: ProductStatusMetricItem[] = Object.keys(statusValues).map((st) => {
    const cfg = PRODUCT_STATUS_CONFIG[st] || {
      labelCn: st.split(' - ')[0] || st,
      labelEn: st.split(' - ')[1] || st,
      labelId: 'Status Produk',
      color: 'slate',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      borderClass: 'border-slate-300',
      bgClass: 'from-slate-500/10 to-slate-400/5',
      actionStrategy: 'Monitor perputaran stok.',
      priority: 99,
    };

    const sVal = statusValues[st] || 0;
    const sQty = statusQtys[st] || 0;
    const valShare = totalValue > 0 ? (sVal / totalValue) * 100 : 0;
    const qtyShare = totalQty > 0 ? (sQty / totalQty) * 100 : 0;
    const avgPrice = sQty > 0 ? Math.round(sVal / sQty) : 0;

    const topSkus = Object.values(skuAggregation)
      .filter((s) => s.status === st)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((s) => ({
        sku: s.sku,
        brand: s.brand,
        value: s.value,
        qty: s.qty,
      }));

    return {
      status: st,
      labelCn: cfg.labelCn,
      labelEn: cfg.labelEn,
      color: cfg.color,
      badgeClass: cfg.badgeClass,
      borderClass: cfg.borderClass,
      bgClass: cfg.bgClass,
      totalValue: sVal,
      totalQty: sQty,
      skuCount: statusSkus[st]?.size || 0,
      transactionCount: statusTxCounts[st] || 0,
      valueSharePercent: valShare,
      qtySharePercent: qtyShare,
      averagePrice: avgPrice,
      actionStrategy: cfg.actionStrategy,
      topSkus,
    };
  }).sort((a, b) => {
    const pA = PRODUCT_STATUS_CONFIG[a.status]?.priority || 99;
    const pB = PRODUCT_STATUS_CONFIG[b.status]?.priority || 99;
    return pA - pB;
  });

  const topCoreSkus = Object.values(skuAggregation)
    .filter((s) => s.status === '核心品 - Core Products')
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((s) => ({ sku: s.sku, brand: s.brand, value: s.value, qty: s.qty }));

  const topNewSkus = Object.values(skuAggregation)
    .filter((s) => s.status === '新品 - New Products')
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((s) => ({ sku: s.sku, brand: s.brand, value: s.value, qty: s.qty }));

  // Nilai inventori berisiko (Clearance + Discontinue + Delisted + Obsolete)
  const clearanceObsoleteValue =
    (statusValues['清库品 - Clearance'] || 0) +
    (statusValues['淘汰品 - Discontinue Products'] || 0) +
    (statusValues['退市品 - Delisted Product'] || 0) +
    (statusValues['淘汰品 - Obsolete'] || 0);

  const clearanceObsoleteShare = totalValue > 0 ? (clearanceObsoleteValue / totalValue) * 100 : 0;

  return {
    totalValue,
    totalQty,
    totalSkuCount: allDistinctSkus.size,
    statuses,
    topCoreSkus,
    topNewSkus,
    clearanceObsoleteValue,
    clearanceObsoleteShare,
  };
}

// Compute executive KPI summary
export function calculateSummary(records: TransactionRecord[]): MetricSummary {
  let totalRevenue = 0;
  let grossRevenue = 0;
  let totalReturnRevenue = 0;
  let totalQty = 0;

  for (const r of records) {
    const val = r.VALUE || 0;
    const qty = r.QTY || 0;

    totalRevenue += val;
    totalQty += qty;

    if (val < 0 || r.KET === 'RETURN') {
      totalReturnRevenue += Math.abs(val);
    } else {
      grossRevenue += val;
    }
  }

  const totalTransactions = records.length;
  const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const returnRatePercent = grossRevenue > 0 ? (totalReturnRevenue / grossRevenue) * 100 : 0;

  return {
    totalRevenue,
    grossRevenue,
    totalReturnRevenue,
    totalQty,
    totalTransactions,
    averageOrderValue,
    returnRatePercent,
  };
}

// Dimension aggregator (Sales, SPV, Brand, Store, SKU, Region, Kategori)
export function aggregateByDimension(
  records: TransactionRecord[],
  dimensionKey: 'SALES' | 'SPV' | 'BRAND' | 'NAMA_STORE' | 'SKU' | 'REGION' | 'KATEGORI'
): DimensionPerformance[] {
  const map: Record<string, {
    totalValue: number;
    totalQty: number;
    txCount: number;
    brands: Record<string, number>;
  }> = {};

  let grandTotalValue = 0;

  for (const r of records) {
    const name = String(r[dimensionKey] || 'N/A');
    if (!map[name]) {
      map[name] = { totalValue: 0, totalQty: 0, txCount: 0, brands: {} };
    }
    const val = r.VALUE || 0;
    map[name].totalValue += val;
    map[name].totalQty += (r.QTY || 0);
    map[name].txCount += 1;
    map[name].brands[r.BRAND] = (map[name].brands[r.BRAND] || 0) + val;
    grandTotalValue += val;
  }

  const results: DimensionPerformance[] = Object.keys(map).map((name) => {
    const item = map[name];
    const contributionPercent = grandTotalValue > 0 ? (item.totalValue / grandTotalValue) * 100 : 0;

    // Realistic targets:
    let target = Math.round(item.totalValue * 1.12);
    if (item.totalValue > 50_000_000) target = 60_000_000;
    else if (item.totalValue > 20_000_000) target = 30_000_000;
    else if (item.totalValue > 10_000_000) target = 15_000_000;
    else target = Math.max(5_000_000, Math.round(item.totalValue * 1.15));

    const achievementPercent = target > 0 ? (item.totalValue / target) * 100 : 0;

    return {
      name,
      totalValue: item.totalValue,
      totalQty: item.totalQty,
      transactionCount: item.txCount,
      contributionPercent,
      target,
      achievementPercent,
      brandBreakdown: item.brands,
    };
  });

  return results.sort((a, b) => b.totalValue - a.totalValue);
}

export interface CategoryDetailData {
  category: string;
  totalValue: number;
  totalQty: number;
  txCount: number;
  contributionPercent: number;
  avgPrice: number;
  brandBreakdown: { brand: string; value: number; qty: number; percent: number }[];
  focusValue: number;
  focusPercent: number;
  regularValue: number;
  topSkus: { sku: string; brand: string; value: number; qty: number }[];
  storeCount: number;
  returnValue: number;
  returnRate: number;
}

// Deep category analytics
export function aggregateCategoryDetails(records: TransactionRecord[]): CategoryDetailData[] {
  const map: Record<string, {
    totalValue: number;
    totalQty: number;
    txCount: number;
    returnValue: number;
    focusValue: number;
    regularValue: number;
    brands: Record<string, { value: number; qty: number }>;
    skus: Record<string, { sku: string; brand: string; value: number; qty: number }>;
    stores: Set<string>;
  }> = {};

  let grandTotalValue = 0;

  for (const r of records) {
    const cat = resolveCategory(r);
    if (!map[cat]) {
      map[cat] = {
        totalValue: 0,
        totalQty: 0,
        txCount: 0,
        returnValue: 0,
        focusValue: 0,
        regularValue: 0,
        brands: {},
        skus: {},
        stores: new Set(),
      };
    }

    const val = r.VALUE || 0;
    const qty = r.QTY || 0;
    grandTotalValue += val;

    map[cat].totalValue += val;
    map[cat].totalQty += qty;
    map[cat].txCount += 1;
    if (r.NAMA_STORE) map[cat].stores.add(r.NAMA_STORE);

    if (val < 0 || r.KET === 'RETURN') {
      map[cat].returnValue += Math.abs(val);
    }

    if (isFocusProduct(r.PRODUK_FOCUS || r)) {
      map[cat].focusValue += val;
    } else {
      map[cat].regularValue += val;
    }

    // Brands
    if (!map[cat].brands[r.BRAND]) {
      map[cat].brands[r.BRAND] = { value: 0, qty: 0 };
    }
    map[cat].brands[r.BRAND].value += val;
    map[cat].brands[r.BRAND].qty += qty;

    // SKUs
    const skuKey = r.SKU || r.SPU || r.NO_SKU;
    if (!map[cat].skus[skuKey]) {
      map[cat].skus[skuKey] = { sku: skuKey, brand: r.BRAND, value: 0, qty: 0 };
    }
    map[cat].skus[skuKey].value += val;
    map[cat].skus[skuKey].qty += qty;
  }

  const results: CategoryDetailData[] = Object.keys(map).map((cat) => {
    const item = map[cat];
    const contributionPercent = grandTotalValue > 0 ? (item.totalValue / grandTotalValue) * 100 : 0;
    const avgPrice = item.totalQty > 0 ? item.totalValue / item.totalQty : 0;
    const grossVal = item.totalValue + item.returnValue;
    const returnRate = grossVal > 0 ? (item.returnValue / grossVal) * 100 : 0;
    const focusPercent = item.totalValue > 0 ? (item.focusValue / item.totalValue) * 100 : 0;

    const brandBreakdown = Object.entries(item.brands)
      .map(([brand, bData]) => ({
        brand,
        value: bData.value,
        qty: bData.qty,
        percent: item.totalValue > 0 ? (bData.value / item.totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const topSkus = Object.values(item.skus)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      category: cat,
      totalValue: item.totalValue,
      totalQty: item.totalQty,
      txCount: item.txCount,
      contributionPercent,
      avgPrice,
      brandBreakdown,
      focusValue: item.focusValue,
      focusPercent,
      regularValue: item.regularValue,
      topSkus,
      storeCount: item.stores.size,
      returnValue: item.returnValue,
      returnRate,
    };
  });

  return results.sort((a, b) => b.totalValue - a.totalValue);
}

// Robust date parser for Google Sheet records (handles YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, ISO)
export function parseTransactionDate(r: Partial<TransactionRecord>): Date | null {
  const raw = String(r.TANGGAL || '').trim();
  if (!raw) return null;

  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }

  // Slash or dash D/M/Y or M/D/Y
  const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const partA = Number(slashMatch[1]);
    const partB = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;

    let day = partA;
    let month = partB;

    if (partA > 12) {
      day = partA;
      month = partB;
    } else if (partB > 12) {
      month = partA;
      day = partB;
    } else {
      // Ambiguous (both <= 12): disambiguate using BULAN column if available
      const expectedMonth = r.BULAN ? MONTH_ORDER[String(r.BULAN).trim().toUpperCase()] : undefined;
      if (expectedMonth === partB) {
        day = partA;
        month = partB;
      } else if (expectedMonth === partA) {
        month = partA;
        day = partB;
      } else {
        // Default Indonesian DD/MM/YYYY
        day = partA;
        month = partB;
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getRecordDayOfMonth(r: Partial<TransactionRecord>): number | null {
  const parsed = parseTransactionDate(r);
  if (parsed) return parsed.getDate();
  const dayOnlyMatch = String(r.TANGGAL || '').trim().match(/^(\d{1,2})$/);
  if (dayOnlyMatch) {
    const d = Number(dayOnlyMatch[1]);
    if (d >= 1 && d <= 31) return d;
  }
  return null;
}

function getWeekNumberFromDate(d: Date): number {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diffDays = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(53, Math.ceil((diffDays + startOfYear.getDay() + 1) / 7)));
}

// Timeframe aggregator (Harian, Mingguan, Bulanan, Tahunan)
export function aggregateTimeframe(
  records: TransactionRecord[],
  mode: TimeframeMode
): { label: string; subLabel: string; value: number; qty: number; txCount: number; dateRef?: string }[] {
  if (records.length === 0) return [];

  if (mode === 'harian') {
    const map: Record<string, { value: number; qty: number; txCount: number; dateObj: Date | null; rawKey: string }> = {};

    for (const r of records) {
      const d = parseTransactionDate(r);
      const normalizedKey = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : String(r.TANGGAL || 'Tanpa Tanggal').trim();

      if (!map[normalizedKey]) {
        map[normalizedKey] = { value: 0, qty: 0, txCount: 0, dateObj: d, rawKey: String(r.TANGGAL || normalizedKey) };
      }
      map[normalizedKey].value += r.VALUE || 0;
      map[normalizedKey].qty += r.QTY || 0;
      map[normalizedKey].txCount += 1;
    }

    return Object.entries(map)
      .sort((a, b) => {
        const ta = a[1].dateObj ? a[1].dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b[1].dateObj ? b[1].dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        return a[0].localeCompare(b[0]);
      })
      .map(([key, data]) => {
        const d = data.dateObj;
        const dayStr = d && !isNaN(d.getTime())
          ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          : data.rawKey;
        const fullStr = d && !isNaN(d.getTime())
          ? d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
          : data.rawKey;

        return {
          label: dayStr,
          subLabel: fullStr,
          value: data.value,
          qty: data.qty,
          txCount: data.txCount,
          dateRef: key,
        };
      });
  }

  if (mode === 'mingguan') {
    const yearsSet = new Set<number>();
    const parsedRows = records.map((r) => {
      const d = parseTransactionDate(r);
      const year = (d ? d.getFullYear() : Number(r.TAHUN)) || 2026;
      const week = r.weekNumber && r.weekNumber > 0 ? r.weekNumber : d ? getWeekNumberFromDate(d) : 1;
      yearsSet.add(year);
      return { r, year, week };
    });

    const isMultiYear = yearsSet.size > 1;
    const map: Record<string, { year: number; week: number; value: number; qty: number; txCount: number }> = {};

    for (const { r, year, week } of parsedRows) {
      const key = isMultiYear ? `${year}-W${String(week).padStart(2, '0')}` : `W${String(week).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = { year, week, value: 0, qty: 0, txCount: 0 };
      }
      map[key].value += r.VALUE || 0;
      map[key].qty += r.QTY || 0;
      map[key].txCount += 1;
    }

    return Object.entries(map)
      .sort((a, b) => (a[1].year !== b[1].year ? a[1].year - b[1].year : a[1].week - b[1].week))
      .map(([key, item]) => ({
        label: isMultiYear ? `Mgg ${item.week} '${String(item.year).slice(-2)}` : `Mgg ${item.week}`,
        subLabel: isMultiYear ? `Week ${item.week} (${item.year})` : `Week ${item.week}`,
        value: item.value,
        qty: item.qty,
        txCount: item.txCount,
        dateRef: key,
      }));
  }

  if (mode === 'bulanan') {
    const yearsSet = new Set<number>();
    const normalizedRows = records.map((r) => {
      const d = parseTransactionDate(r);
      const year = (d ? d.getFullYear() : Number(r.TAHUN)) || 2026;
      let month = (r.BULAN || '').trim().toUpperCase();
      if (!month && d) {
        month = MONTH_NAMES_ID[d.getMonth()] || 'UNKNOWN';
      }
      if (!month) month = 'UNKNOWN';
      yearsSet.add(year);
      return { r, year, month, order: MONTH_ORDER[month] || 99 };
    });

    const isMultiYear = yearsSet.size > 1;
    const map: Record<string, { year: number; month: string; order: number; value: number; qty: number; txCount: number }> = {};

    for (const { r, year, month, order } of normalizedRows) {
      const key = isMultiYear ? `${year}-${month}` : month;
      if (!map[key]) {
        map[key] = { year, month, order, value: 0, qty: 0, txCount: 0 };
      }
      map[key].value += r.VALUE || 0;
      map[key].qty += r.QTY || 0;
      map[key].txCount += 1;
    }

    return Object.entries(map)
      .sort((a, b) => (a[1].year !== b[1].year ? a[1].year - b[1].year : a[1].order - b[1].order))
      .map(([key, data]) => ({
        label: isMultiYear
          ? `${data.month.length > 3 ? data.month.slice(0, 3) : data.month} '${String(data.year).slice(-2)}`
          : data.month.length > 3
          ? data.month.slice(0, 3)
          : data.month,
        subLabel: isMultiYear ? `${data.month} ${data.year}` : data.month,
        value: data.value,
        qty: data.qty,
        txCount: data.txCount,
        dateRef: key,
      }));
  }

  // Tahunan
  const map: Record<number, { value: number; qty: number; txCount: number }> = {};

  for (const r of records) {
    const d = parseTransactionDate(r);
    const y = (d ? d.getFullYear() : Number(r.TAHUN)) || 2026;
    if (!map[y]) {
      map[y] = { value: 0, qty: 0, txCount: 0 };
    }
    map[y].value += r.VALUE || 0;
    map[y].qty += r.QTY || 0;
    map[y].txCount += 1;
  }

  return Object.entries(map)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([year, data]) => ({
      label: String(year),
      subLabel: `Tahun ${year}`,
      value: data.value,
      qty: data.qty,
      txCount: data.txCount,
      dateRef: String(year),
    }));
}

// Growth & Comparison engine: Week vs Week, Month vs Month, Year vs Year with Focus & New Product Analysis
export function calculateComparisonGrowth(
  allRecords: TransactionRecord[],
  mode: 'wow' | 'mom' | 'yoy',
  selectedFilters: DashboardFilters,
  dayRange?: { startDay?: number; endDay?: number }
): ComparisonGrowthResult {
  // Determine target years and subsets
  let currentRecords: TransactionRecord[] = [];
  let previousRecords: TransactionRecord[] = [];
  let currentPeriodLabel = '';
  let previousPeriodLabel = '';

  // Filter helper for non-temporal dimensions (preserves sales, brand, store, etc. across compared periods)
  const matchOtherFilters = (r: TransactionRecord) => {
    if (selectedFilters.BRAND && selectedFilters.BRAND !== 'ALL') {
      if ((r.BRAND || '').trim().toUpperCase() !== selectedFilters.BRAND.trim().toUpperCase()) return false;
    }
    if (selectedFilters.SALES && selectedFilters.SALES !== 'ALL') {
      if ((r.SALES || '').trim().toUpperCase() !== selectedFilters.SALES.trim().toUpperCase()) return false;
    }
    if (selectedFilters.TRAINER && selectedFilters.TRAINER !== 'ALL') {
      if (getTrainerForRecord(r).trim().toUpperCase() !== selectedFilters.TRAINER.trim().toUpperCase()) return false;
    }
    if (selectedFilters.SPV && selectedFilters.SPV !== 'ALL') {
      if ((r.SPV || '').trim().toUpperCase() !== selectedFilters.SPV.trim().toUpperCase()) return false;
    }
    if (selectedFilters.REGION && selectedFilters.REGION !== 'ALL') {
      if ((r.REGION || '').trim().toUpperCase() !== selectedFilters.REGION.trim().toUpperCase()) return false;
    }
    if (selectedFilters.NAMA_STORE && selectedFilters.NAMA_STORE !== 'ALL') {
      if ((r.NAMA_STORE || '').trim().toUpperCase() !== selectedFilters.NAMA_STORE.trim().toUpperCase()) return false;
    }
    if (selectedFilters.KATEGORI && selectedFilters.KATEGORI !== 'ALL') {
      if (resolveCategory(r).trim().toUpperCase() !== selectedFilters.KATEGORI.trim().toUpperCase()) return false;
    }
    if (selectedFilters.STATUS_PRODUK && selectedFilters.STATUS_PRODUK !== 'ALL') {
      if (resolveProductStatus(r) !== selectedFilters.STATUS_PRODUK) return false;
    }
    if (selectedFilters.KET && selectedFilters.KET !== 'ALL') {
      if ((r.KET || '').trim().toUpperCase() !== selectedFilters.KET.trim().toUpperCase()) return false;
    }
    if (selectedFilters.SKU && selectedFilters.SKU !== 'ALL') {
      const qSku = selectedFilters.SKU.toLowerCase();
      const matchSku =
        (r.SKU || '').toLowerCase().includes(qSku) ||
        (r.NO_SKU || '').toLowerCase().includes(qSku) ||
        (r.SPU || '').toLowerCase().includes(qSku);
      if (!matchSku) return false;
    }
    if (selectedFilters.searchQuery && selectedFilters.searchQuery.trim()) {
      const q = selectedFilters.searchQuery.trim().toLowerCase();
      const trainerName = getTrainerForRecord(r).toLowerCase();
      const resolvedCat = resolveCategory(r).toLowerCase();
      const match =
        (r.TANGGAL && r.TANGGAL.toLowerCase().includes(q)) ||
        (r.BULAN && r.BULAN.toLowerCase().includes(q)) ||
        (r.SKU && r.SKU.toLowerCase().includes(q)) ||
        resolvedCat.includes(q) ||
        (r.STATUS_PRODUK && r.STATUS_PRODUK.toLowerCase().includes(q)) ||
        (r.NAMA_STORE && r.NAMA_STORE.toLowerCase().includes(q)) ||
        (r.SALES && r.SALES.toLowerCase().includes(q)) ||
        trainerName.includes(q) ||
        (r.SPV && r.SPV.toLowerCase().includes(q)) ||
        (r.BRAND && r.BRAND.toLowerCase().includes(q)) ||
        (r.REGION && r.REGION.toLowerCase().includes(q)) ||
        (r.NO_SKU && r.NO_SKU.toLowerCase().includes(q)) ||
        (r.SPU && r.SPU.toLowerCase().includes(q)) ||
        (r.BA && r.BA.toLowerCase().includes(q)) ||
        (r.COVER_AREA && r.COVER_AREA.toLowerCase().includes(q)) ||
        (r.KET && r.KET.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  };

  const activeYear = (() => {
    if (selectedFilters.TAHUN && selectedFilters.TAHUN !== 'ALL') {
      return Number(selectedFilters.TAHUN) || 2026;
    }
    const matchingYears = Array.from(
      new Set(
        allRecords
          .filter((r) => matchOtherFilters(r))
          .map((r) => Number(r.TAHUN))
          .filter((y) => !isNaN(y) && y > 2000)
      )
    ).sort((a, b) => b - a);
    if (matchingYears.length > 0) return matchingYears[0];
    const allYears = Array.from(
      new Set(allRecords.map((r) => Number(r.TAHUN)).filter((y) => !isNaN(y) && y > 2000))
    ).sort((a, b) => b - a);
    return allYears[0] || 2026;
  })();

  if (mode === 'wow') {
    // Week vs Week
    const activeWeeks = Array.from(new Set(
      allRecords
        .filter(
          (r) =>
            Number(r.TAHUN) === activeYear &&
            (selectedFilters.BULAN === 'ALL' || (r.BULAN || '').trim().toUpperCase() === selectedFilters.BULAN.trim().toUpperCase()) &&
            matchOtherFilters(r)
        )
        .map((r) => r.weekNumber || 39)
    )).sort((a, b) => b - a);

    const currentWeek = activeWeeks[0] || 39;
    const previousWeek = activeWeeks[1] || (currentWeek > 1 ? currentWeek - 1 : 1);

    currentPeriodLabel = `Minggu ${currentWeek}`;
    previousPeriodLabel = `Minggu ${previousWeek}`;

    currentRecords = allRecords.filter((r) => Number(r.TAHUN) === activeYear && r.weekNumber === currentWeek && matchOtherFilters(r));
    previousRecords = allRecords.filter((r) => Number(r.TAHUN) === activeYear && r.weekNumber === previousWeek && matchOtherFilters(r));
  } else if (mode === 'mom') {
    // Month vs Month (MoM)
    let targetMonth = selectedFilters.BULAN && selectedFilters.BULAN !== 'ALL'
      ? selectedFilters.BULAN.toUpperCase().trim()
      : '';
    const targetYear = activeYear;

    if (!targetMonth || targetMonth === 'ALL') {
      // Find latest month available in dataset for activeYear that has matching filtered data
      const matchingMonths = allRecords.filter(
        (r) => Number(r.TAHUN) === activeYear && r.BULAN && r.BULAN !== 'ALL' && matchOtherFilters(r)
      );
      const sourceForMonths =
        matchingMonths.length > 0
          ? matchingMonths
          : allRecords.filter((r) => Number(r.TAHUN) === activeYear && r.BULAN && r.BULAN !== 'ALL');

      const availableMonths = Array.from(new Set(
        sourceForMonths.map((r) => r.BULAN.toUpperCase().trim())
      )).sort((a, b) => (MONTH_ORDER[b] || 0) - (MONTH_ORDER[a] || 0));

      targetMonth = availableMonths[0] || 'OKTOBER';
    }

    const currentMonthIdx = MONTH_ORDER[targetMonth] || 10;
    const prevMonthIdx = currentMonthIdx > 1 ? currentMonthIdx - 1 : 12;
    const prevMonthName = MONTH_NAMES_ID[prevMonthIdx - 1];
    const prevYear = currentMonthIdx > 1 ? targetYear : targetYear - 1;

    currentPeriodLabel = `${targetMonth} ${targetYear}`;
    previousPeriodLabel = `${prevMonthName} ${prevYear}`;

    currentRecords = allRecords.filter(
      (r) => Number(r.TAHUN) === targetYear && (r.BULAN || '').toUpperCase().trim() === targetMonth && matchOtherFilters(r)
    );
    previousRecords = allRecords.filter(
      (r) => Number(r.TAHUN) === prevYear && (r.BULAN || '').toUpperCase().trim() === prevMonthName && matchOtherFilters(r)
    );
  } else {
    // Year vs Year (YoY)
    const currentYear = activeYear;
    const previousYear = currentYear - 1;

    currentPeriodLabel = `Tahun ${currentYear}`;
    previousPeriodLabel = `Tahun ${previousYear}`;

    if (selectedFilters.BULAN && selectedFilters.BULAN !== 'ALL') {
      const bNorm = selectedFilters.BULAN.toUpperCase().trim();
      currentPeriodLabel += ` (${bNorm})`;
      previousPeriodLabel += ` (${bNorm})`;
      currentRecords = allRecords.filter((r) => Number(r.TAHUN) === currentYear && (r.BULAN || '').toUpperCase().trim() === bNorm && matchOtherFilters(r));
      previousRecords = allRecords.filter((r) => Number(r.TAHUN) === previousYear && (r.BULAN || '').toUpperCase().trim() === bNorm && matchOtherFilters(r));
    } else {
      currentRecords = allRecords.filter((r) => Number(r.TAHUN) === currentYear && matchOtherFilters(r));
      previousRecords = allRecords.filter((r) => Number(r.TAHUN) === previousYear && matchOtherFilters(r));
    }
  }

  // Filter day-of-month range (e.g., Tanggal 1 s/d 10 across both compared periods)
  const hasDayFilter =
    (dayRange?.startDay !== undefined && dayRange.startDay >= 1) ||
    (dayRange?.endDay !== undefined && dayRange.endDay >= 1);

  if (hasDayFilter) {
    let dStart = Math.max(1, Math.min(31, dayRange?.startDay ?? 1));
    let dEnd = Math.max(1, Math.min(31, dayRange?.endDay ?? 31));
    if (dStart > dEnd) {
      [dStart, dEnd] = [dEnd, dStart];
    }

    const getRecordDay = (r: TransactionRecord): number | null => {
      const parsed = parseTransactionDate(r);
      if (parsed) return parsed.getDate();
      const dayOnlyMatch = String(r.TANGGAL || '').trim().match(/^(\d{1,2})$/);
      if (dayOnlyMatch) {
        const d = Number(dayOnlyMatch[1]);
        if (d >= 1 && d <= 31) return d;
      }
      return null;
    };

    const matchDayOfMonth = (r: TransactionRecord) => {
      const d = getRecordDay(r);
      return d !== null && d >= dStart && d <= dEnd;
    };

    currentRecords = currentRecords.filter(matchDayOfMonth);
    previousRecords = previousRecords.filter(matchDayOfMonth);

    const dayLabel = dStart === dEnd ? `Tgl ${dStart}` : `Tgl ${dStart}–${dEnd}`;
    if (mode === 'mom') {
      currentPeriodLabel = `${dayLabel} ${currentPeriodLabel}`;
      previousPeriodLabel = `${dayLabel} ${previousPeriodLabel}`;
    } else {
      currentPeriodLabel = `${currentPeriodLabel} (${dayLabel})`;
      previousPeriodLabel = `${previousPeriodLabel} (${dayLabel})`;
    }
  }

  // Calculate totals
  const sumVal = (arr: TransactionRecord[]) => arr.reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const sumQty = (arr: TransactionRecord[]) => arr.reduce((acc, r) => acc + (r.QTY || 0), 0);

  const curVal = sumVal(currentRecords);
  const prevVal = sumVal(previousRecords);
  const deltaVal = curVal - prevVal;
  const growthValPercent = prevVal !== 0 ? (deltaVal / Math.abs(prevVal)) * 100 : (curVal > 0 ? 100 : 0);

  const curQty = sumQty(currentRecords);
  const prevQty = sumQty(previousRecords);
  const growthQtyPercent = prevQty !== 0 ? ((curQty - prevQty) / Math.abs(prevQty)) * 100 : 0;

  const overall: GrowthMetric = {
    currentValue: curVal,
    previousValue: prevVal,
    deltaValue: deltaVal,
    growthPercent: growthValPercent,
    currentQty: curQty,
    previousQty: prevQty,
    growthQtyPercent,
  };

  // Overall Focus Product Summary
  const curFocusVal = currentRecords.filter((r) => isFocusProduct(r.PRODUK_FOCUS)).reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const prevFocusVal = previousRecords.filter((r) => isFocusProduct(r.PRODUK_FOCUS)).reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const focusDelta = curFocusVal - prevFocusVal;
  const focusGrowth = prevFocusVal !== 0 ? (focusDelta / Math.abs(prevFocusVal)) * 100 : (curFocusVal > 0 ? 100 : 0);
  const curFocusQty = currentRecords.filter((r) => isFocusProduct(r.PRODUK_FOCUS)).reduce((acc, r) => acc + (r.QTY || 0), 0);
  const prevFocusQty = previousRecords.filter((r) => isFocusProduct(r.PRODUK_FOCUS)).reduce((acc, r) => acc + (r.QTY || 0), 0);

  const focusSummary: FocusNewOverallSummary = {
    current: curFocusVal,
    previous: prevFocusVal,
    delta: focusDelta,
    growth: focusGrowth,
    shareCurrent: curVal > 0 ? (curFocusVal / curVal) * 100 : 0,
    sharePrevious: prevVal > 0 ? (prevFocusVal / prevVal) * 100 : 0,
    currentQty: curFocusQty,
    previousQty: prevFocusQty,
  };

  // Overall New Product Summary
  const curNewVal = currentRecords.filter((r) => isNewProduct(r.PRODUK_NEW)).reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const prevNewVal = previousRecords.filter((r) => isNewProduct(r.PRODUK_NEW)).reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const newDelta = curNewVal - prevNewVal;
  const newGrowth = prevNewVal !== 0 ? (newDelta / Math.abs(prevNewVal)) * 100 : (curNewVal > 0 ? 100 : 0);
  const curNewQty = currentRecords.filter((r) => isNewProduct(r.PRODUK_NEW)).reduce((acc, r) => acc + (r.QTY || 0), 0);
  const prevNewQty = previousRecords.filter((r) => isNewProduct(r.PRODUK_NEW)).reduce((acc, r) => acc + (r.QTY || 0), 0);

  const newSummary: FocusNewOverallSummary = {
    current: curNewVal,
    previous: prevNewVal,
    delta: newDelta,
    growth: newGrowth,
    shareCurrent: curVal > 0 ? (curNewVal / curVal) * 100 : 0,
    sharePrevious: prevVal > 0 ? (prevNewVal / prevVal) * 100 : 0,
    currentQty: curNewQty,
    previousQty: prevNewQty,
  };

  const resolveKetLabel = (
    curSellInCount: number,
    prevSellInCount: number,
    curSellOutCount: number,
    prevSellOutCount: number
  ): 'SELL IN' | 'SELL OUT' | 'SELL IN & OUT' => {
    const filterKet = (selectedFilters.KET || 'ALL').trim().toUpperCase();
    if (filterKet.includes('SELL IN')) return 'SELL IN';
    if (filterKet.includes('SELL OUT')) return 'SELL OUT';
    const hasSellIn = curSellInCount > 0 || prevSellInCount > 0;
    const hasSellOut = curSellOutCount > 0 || prevSellOutCount > 0;
    if (hasSellIn && hasSellOut) return 'SELL IN & OUT';
    if (hasSellIn) return 'SELL IN';
    return 'SELL OUT';
  };

  // Helper for dimension breakdown with detailed Produk Fokus & Produk New metrics
  const buildDimensionComparison = (
    dimension: 'SALES' | 'SPV' | 'BRAND' | 'NAMA_STORE' | 'KATEGORI'
  ): EntityProductAnalysisItem[] => {
    interface EntityAgg {
      total: number;
      qty: number;
      focus: number;
      focusQty: number;
      newVal: number;
      newQty: number;
      regular: number;
      sellIn: number;
      sellOut: number;
      sellInCount: number;
      sellOutCount: number;
      focusSkus: Record<string, { sku: string; brand: string; value: number; qty: number }>;
      newSkus: Record<string, { sku: string; brand: string; value: number; qty: number }>;
    }

    const initAgg = (): EntityAgg => ({
      total: 0,
      qty: 0,
      focus: 0,
      focusQty: 0,
      newVal: 0,
      newQty: 0,
      regular: 0,
      sellIn: 0,
      sellOut: 0,
      sellInCount: 0,
      sellOutCount: 0,
      focusSkus: {},
      newSkus: {},
    });

    const curMap: Record<string, EntityAgg> = {};
    const prevMap: Record<string, EntityAgg> = {};

    currentRecords.forEach((r) => {
      const k = String(r[dimension] || 'N/A');
      if (!curMap[k]) curMap[k] = initAgg();
      const val = r.VALUE || 0;
      const qty = r.QTY || 0;
      const skuKey = r.SKU || r.SPU || r.NO_SKU || 'SKU';
      const isFocus = isFocusProduct(r.PRODUK_FOCUS);
      const isNew = isNewProduct(r.PRODUK_NEW);
      const rawKet = (r.KET || '').toUpperCase().trim();
      const isSellInRow = rawKet === 'SELL IN' || rawKet.includes('SELL IN');
      const isSellOutRow = rawKet === 'SELL OUT' || rawKet.includes('SELL OUT');

      curMap[k].total += val;
      curMap[k].qty += qty;
      if (isSellInRow) {
        curMap[k].sellIn += val;
        curMap[k].sellInCount += 1;
      } else if (isSellOutRow) {
        curMap[k].sellOut += val;
        curMap[k].sellOutCount += 1;
      }

      if (isFocus) {
        curMap[k].focus += val;
        curMap[k].focusQty += qty;
        if (!curMap[k].focusSkus[skuKey]) {
          curMap[k].focusSkus[skuKey] = { sku: skuKey, brand: r.BRAND, value: 0, qty: 0 };
        }
        curMap[k].focusSkus[skuKey].value += val;
        curMap[k].focusSkus[skuKey].qty += qty;
      }

      if (isNew) {
        curMap[k].newVal += val;
        curMap[k].newQty += qty;
        if (!curMap[k].newSkus[skuKey]) {
          curMap[k].newSkus[skuKey] = { sku: skuKey, brand: r.BRAND, value: 0, qty: 0 };
        }
        curMap[k].newSkus[skuKey].value += val;
        curMap[k].newSkus[skuKey].qty += qty;
      }

      if (!isFocus && !isNew) {
        curMap[k].regular += val;
      }
    });

    previousRecords.forEach((r) => {
      const k = String(r[dimension] || 'N/A');
      if (!prevMap[k]) prevMap[k] = initAgg();
      const val = r.VALUE || 0;
      const qty = r.QTY || 0;
      const isFocus = isFocusProduct(r.PRODUK_FOCUS);
      const isNew = isNewProduct(r.PRODUK_NEW);
      const rawKet = (r.KET || '').toUpperCase().trim();
      const isSellInRow = rawKet === 'SELL IN' || rawKet.includes('SELL IN');
      const isSellOutRow = rawKet === 'SELL OUT' || rawKet.includes('SELL OUT');

      prevMap[k].total += val;
      prevMap[k].qty += qty;
      if (isSellInRow) {
        prevMap[k].sellIn += val;
        prevMap[k].sellInCount += 1;
      } else if (isSellOutRow) {
        prevMap[k].sellOut += val;
        prevMap[k].sellOutCount += 1;
      }

      if (isFocus) {
        prevMap[k].focus += val;
        prevMap[k].focusQty += qty;
      }

      if (isNew) {
        prevMap[k].newVal += val;
        prevMap[k].newQty += qty;
      }

      if (!isFocus && !isNew) {
        prevMap[k].regular += val;
      }
    });

    const allKeys = Array.from(new Set([...Object.keys(curMap), ...Object.keys(prevMap)]));

    return allKeys.map((name) => {
      const cur = curMap[name] || initAgg();
      const prev = prevMap[name] || initAgg();

      const current = cur.total;
      const previous = prev.total;
      const delta = current - previous;
      const growth = previous !== 0 ? (delta / Math.abs(previous)) * 100 : (current > 0 ? 100 : 0);

      // Focus metrics
      const currentFocus = cur.focus;
      const previousFocus = prev.focus;
      const focusDelta = currentFocus - previousFocus;
      const focusGrowth = previousFocus !== 0
        ? (focusDelta / Math.abs(previousFocus)) * 100
        : (currentFocus > 0 ? 100 : 0);
      const focusShareCurrent = current > 0 ? (currentFocus / current) * 100 : 0;
      const focusSharePrevious = previous > 0 ? (previousFocus / previous) * 100 : 0;

      // New product metrics
      const currentNew = cur.newVal;
      const previousNew = prev.newVal;
      const newDelta = currentNew - previousNew;
      const newGrowth = previousNew !== 0
        ? (newDelta / Math.abs(previousNew)) * 100
        : (currentNew > 0 ? 100 : 0);
      const newShareCurrent = current > 0 ? (currentNew / current) * 100 : 0;
      const newSharePrevious = previous > 0 ? (previousNew / previous) * 100 : 0;

      // Top SKUs
      const topFocusSkus = Object.values(cur.focusSkus)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
      const topNewSkus = Object.values(cur.newSkus)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      return {
        name,
        current,
        previous,
        delta,
        growth,
        currentQty: cur.qty,
        previousQty: prev.qty,

        currentFocus,
        previousFocus,
        focusDelta,
        focusGrowth,
        focusShareCurrent,
        focusSharePrevious,
        focusQtyCurrent: cur.focusQty,
        focusQtyPrevious: prev.focusQty,

        currentNew,
        previousNew,
        newDelta,
        newGrowth,
        newShareCurrent,
        newSharePrevious,
        newQtyCurrent: cur.newQty,
        newQtyPrevious: prev.newQty,

        currentRegular: cur.regular,
        previousRegular: prev.regular,

        currentSellIn: cur.sellIn,
        currentSellOut: cur.sellOut,
        previousSellIn: prev.sellIn,
        previousSellOut: prev.sellOut,
        ket: resolveKetLabel(cur.sellInCount, prev.sellInCount, cur.sellOutCount, prev.sellOutCount),

        topFocusSkus,
        topNewSkus,
      };
    }).sort((a, b) => b.current - a.current);
  };

  // Helper for Trainer comparison
  const buildTrainerComparison = (): EntityProductAnalysisItem[] => {
    interface EntityAgg {
      total: number;
      qty: number;
      focus: number;
      focusQty: number;
      newVal: number;
      newQty: number;
      regular: number;
      sellIn: number;
      sellOut: number;
      sellInCount: number;
      sellOutCount: number;
      focusSkus: Record<string, { sku: string; brand: string; value: number; qty: number }>;
      newSkus: Record<string, { sku: string; brand: string; value: number; qty: number }>;
    }

    const initAgg = (): EntityAgg => ({
      total: 0,
      qty: 0,
      focus: 0,
      focusQty: 0,
      newVal: 0,
      newQty: 0,
      regular: 0,
      sellIn: 0,
      sellOut: 0,
      sellInCount: 0,
      sellOutCount: 0,
      focusSkus: {},
      newSkus: {},
    });

    const curMap: Record<string, EntityAgg> = {};
    const prevMap: Record<string, EntityAgg> = {};

    const allTrainers = ['ARA', 'RATIH'];
    allTrainers.forEach((t) => {
      curMap[t] = initAgg();
      prevMap[t] = initAgg();
    });

    currentRecords.forEach((r) => {
      const k = getTrainerForRecord(r);
      if (!curMap[k]) curMap[k] = initAgg();
      const val = r.VALUE || 0;
      const qty = r.QTY || 0;
      const skuKey = r.SKU || r.SPU || r.NO_SKU || 'SKU';
      const isFocus = isFocusProduct(r.PRODUK_FOCUS);
      const isNew = isNewProduct(r.PRODUK_NEW);
      const rawKet = (r.KET || '').toUpperCase().trim();
      const isSellInRow = rawKet === 'SELL IN' || rawKet.includes('SELL IN');
      const isSellOutRow = rawKet === 'SELL OUT' || rawKet.includes('SELL OUT');

      curMap[k].total += val;
      curMap[k].qty += qty;
      if (isSellInRow) {
        curMap[k].sellIn += val;
        curMap[k].sellInCount += 1;
      } else if (isSellOutRow) {
        curMap[k].sellOut += val;
        curMap[k].sellOutCount += 1;
      }

      if (isFocus) {
        curMap[k].focus += val;
        curMap[k].focusQty += qty;
        if (!curMap[k].focusSkus[skuKey]) {
          curMap[k].focusSkus[skuKey] = { sku: skuKey, brand: r.BRAND, value: 0, qty: 0 };
        }
        curMap[k].focusSkus[skuKey].value += val;
        curMap[k].focusSkus[skuKey].qty += qty;
      }

      if (isNew) {
        curMap[k].newVal += val;
        curMap[k].newQty += qty;
        if (!curMap[k].newSkus[skuKey]) {
          curMap[k].newSkus[skuKey] = { sku: skuKey, brand: r.BRAND, value: 0, qty: 0 };
        }
        curMap[k].newSkus[skuKey].value += val;
        curMap[k].newSkus[skuKey].qty += qty;
      }

      if (!isFocus && !isNew) {
        curMap[k].regular += val;
      }
    });

    previousRecords.forEach((r) => {
      const k = getTrainerForRecord(r);
      if (!prevMap[k]) prevMap[k] = initAgg();
      const val = r.VALUE || 0;
      const qty = r.QTY || 0;
      const isFocus = isFocusProduct(r.PRODUK_FOCUS);
      const isNew = isNewProduct(r.PRODUK_NEW);
      const rawKet = (r.KET || '').toUpperCase().trim();
      const isSellInRow = rawKet === 'SELL IN' || rawKet.includes('SELL IN');
      const isSellOutRow = rawKet === 'SELL OUT' || rawKet.includes('SELL OUT');

      prevMap[k].total += val;
      prevMap[k].qty += qty;
      if (isSellInRow) {
        prevMap[k].sellIn += val;
        prevMap[k].sellInCount += 1;
      } else if (isSellOutRow) {
        prevMap[k].sellOut += val;
        prevMap[k].sellOutCount += 1;
      }

      if (isFocus) {
        prevMap[k].focus += val;
        prevMap[k].focusQty += qty;
      }

      if (isNew) {
        prevMap[k].newVal += val;
        prevMap[k].newQty += qty;
      }

      if (!isFocus && !isNew) {
        prevMap[k].regular += val;
      }
    });

    const allKeys = Array.from(new Set([...Object.keys(curMap), ...Object.keys(prevMap)]));

    return allKeys.map((name) => {
      const cur = curMap[name] || initAgg();
      const prev = prevMap[name] || initAgg();

      const current = cur.total;
      const previous = prev.total;
      const delta = current - previous;
      const growth = previous !== 0 ? (delta / Math.abs(previous)) * 100 : (current > 0 ? 100 : 0);

      const currentFocus = cur.focus;
      const previousFocus = prev.focus;
      const focusDelta = currentFocus - previousFocus;
      const focusGrowth = previousFocus !== 0
        ? (focusDelta / Math.abs(previousFocus)) * 100
        : (currentFocus > 0 ? 100 : 0);
      const focusShareCurrent = current > 0 ? (currentFocus / current) * 100 : 0;
      const focusSharePrevious = previous > 0 ? (previousFocus / previous) * 100 : 0;

      const currentNew = cur.newVal;
      const previousNew = prev.newVal;
      const newDelta = currentNew - previousNew;
      const newGrowth = previousNew !== 0
        ? (newDelta / Math.abs(previousNew)) * 100
        : (currentNew > 0 ? 100 : 0);
      const newShareCurrent = current > 0 ? (currentNew / current) * 100 : 0;
      const newSharePrevious = previous > 0 ? (previousNew / previous) * 100 : 0;

      const topFocusSkus = Object.values(cur.focusSkus)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
      const topNewSkus = Object.values(cur.newSkus)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      return {
        name,
        current,
        previous,
        delta,
        growth,
        currentQty: cur.qty,
        previousQty: prev.qty,
        currentFocus,
        previousFocus,
        focusDelta,
        focusGrowth,
        focusShareCurrent,
        focusSharePrevious,
        focusQtyCurrent: cur.focusQty,
        focusQtyPrevious: prev.focusQty,
        currentNew,
        previousNew,
        newDelta,
        newGrowth,
        newShareCurrent,
        newSharePrevious,
        newQtyCurrent: cur.newQty,
        newQtyPrevious: prev.newQty,
        currentRegular: cur.regular,
        previousRegular: prev.regular,
        currentSellIn: cur.sellIn,
        currentSellOut: cur.sellOut,
        previousSellIn: prev.sellIn,
        previousSellOut: prev.sellOut,
        ket: resolveKetLabel(cur.sellInCount, prev.sellInCount, cur.sellOutCount, prev.sellOutCount),
        topFocusSkus,
        topNewSkus,
      };
    }).sort((a, b) => b.current - a.current);
  };

  return {
    overall,
    currentPeriodLabel,
    previousPeriodLabel,
    focusSummary,
    newSummary,
    bySales: buildDimensionComparison('SALES'),
    bySpv: buildDimensionComparison('SPV'),
    byBrand: buildDimensionComparison('BRAND'),
    byStore: buildDimensionComparison('NAMA_STORE'),
    byCategory: buildDimensionComparison('KATEGORI'),
    byTrainer: buildTrainerComparison(),
  };
}

export function getTrainerForRecord(r: TransactionRecord): string {
  const sales = (r.SALES || '').toUpperCase();
  const store = (r.NAMA_STORE || '').toUpperCase();
  const area = (r.COVER_AREA || '').toUpperCase();
  const reg = (r.REGION || '').toUpperCase();

  // 1. Sales-based coveran
  if (sales.includes('ALBERT FERNANDO')) return 'ARA';
  if (sales.includes('ABDUL RAHIM')) return 'RATIH';

  // 2. Specific store matching from master image table
  // Stores strictly assigned to ARA
  if (
    store.includes('CITRA SWALAYAN') ||
    store.includes('HIDAYAH') ||
    store.includes('IDOLA KOSMETIK') ||
    store.includes('JINAAN') ||
    store.includes('KARTINSHOP') ||
    store.includes('MY KOSMETIK') ||
    store.includes('BEAUTY STORE (BANGKINANG)') ||
    store.includes('CERIA KOSMETIK') ||
    store.includes('KHARISMA') ||
    store.includes('MALAYA MART') ||
    store.includes('BENING') ||
    store.includes('PEKANBARU_ORIGINAL') ||
    store.includes('GUARDIAN') ||
    store.includes('WATSON') ||
    store.includes('PANAM') ||
    store.includes('TEMBILAHAN')
  ) {
    return 'ARA';
  }

  // Stores strictly assigned to RATIH
  if (
    store.includes('ANNISA') ||
    store.includes('GHANAYA') ||
    store.includes('GLOBAL KOSMETIK') ||
    store.includes('MM SANIA') ||
    store.includes('SABRINA') ||
    store.includes('BLINK') ||
    store.includes('DUMAI BARU') ||
    store.includes('AKAR SARI') ||
    store.includes('AL KAUTSAR') ||
    store.includes('CS BEAUTEE') ||
    store.includes('RATU PALUGADA') ||
    store.includes('RINI JOFA') ||
    store.includes('SARASA') ||
    store.includes('ALANA') ||
    store.includes('UNIGLOW') ||
    store.includes('CAN BEAUTY') ||
    store.includes('FOR SKIN') ||
    store.includes('I.C.A') ||
    store.includes('LUCY') ||
    store.includes('RAMBE') ||
    store.includes('RAYA KOSMETIK') ||
    store.includes('WARKOS') ||
    store.includes('DELIMA') ||
    store.includes('MARPOYAN')
  ) {
    return 'RATIH';
  }

  // 3. Fallback based on region / area
  if (reg.includes('DURI') || reg.includes('BAGAN') || area.includes('DURI') || area.includes('BAGAN')) {
    return 'RATIH';
  }

  return 'ARA';
}

export function extractDayOfMonth(record: TransactionRecord): number | null {
  const raw = (record.TANGGAL || '').trim();
  if (!raw) return null;

  // ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const day = parseInt(isoMatch[3], 10);
    return day >= 1 && day <= 31 ? day : null;
  }

  // Slash or dash format: A/B/C or A-B-C
  const slashMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10);
    const b = parseInt(slashMatch[2], 10);
    const expectedMonth = MONTH_ORDER[(record.BULAN || '').trim().toUpperCase()];

    if (expectedMonth) {
      if (a === expectedMonth && b >= 1 && b <= 31) return b;
      if (b === expectedMonth && a >= 1 && a <= 31) return a;
    }

    if (b > 12 && b <= 31) return b;
    if (a > 12 && a <= 31) return a;
    if (b >= 1 && b <= 31) return b;
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    return day >= 1 && day <= 31 ? day : null;
  }
  return null;
}

// Gap & Root Cause Diagnosis: Why did sales drop?
export function diagnoseSalesGap(
  allRecords: TransactionRecord[],
  filteredRecords: TransactionRecord[],
  filters: DashboardFilters,
  customTargetQuotaOverride?: number | GapMonthlyQuotaConfig,
  dateRange?: { startDay?: number; endDay?: number }
): SalesGapDiagnosis {
  const isSellInRecord = (r: TransactionRecord) => normalizeKetType(r.KET) === 'SELL IN';
  const isSellOutRecord = (r: TransactionRecord) => normalizeKetType(r.KET) === 'SELL OUT';

  const resolveRecordPeriod = (r: TransactionRecord): { month: string; year: number } => {
    const dt = parseTransactionDate(r);
    const rawBulan = (r.BULAN || '').trim().toUpperCase();
    let month = '';
    if (rawBulan) {
      if (MONTH_ALIASES_MAP[rawBulan]) {
        month = MONTH_ALIASES_MAP[rawBulan];
      } else {
        const matched = MONTH_NAMES_ID.find((m) => rawBulan.includes(m));
        if (matched) month = matched;
      }
    }
    if (!month && dt) {
      month = MONTH_NAMES_ID[dt.getMonth()] || '';
    }
    const parsedYear = Number(r.TAHUN);
    const year =
      !isNaN(parsedYear) && parsedYear > 1900
        ? parsedYear
        : dt
        ? dt.getFullYear()
        : 0;
    return { month, year };
  };

  // Apply all non-period filters (including KET, SALES, SPV, BRAND, REGION, etc.) to allRecords
  const scopedRecords = filterRecords(allRecords, {
    ...filters,
    BULAN: 'ALL',
    TAHUN: 'ALL',
  });
  const basePool = scopedRecords;
  const dataset = filteredRecords.length > 0 ? filteredRecords : scopedRecords;

  let activeYear = 2026;
  if (filters.TAHUN !== 'ALL' && Number(filters.TAHUN) > 1900) {
    activeYear = Number(filters.TAHUN);
  } else {
    const yearSource = basePool.length > 0 ? basePool : allRecords;
    let maxYear = 0;
    for (let i = 0; i < yearSource.length; i++) {
      const y = resolveRecordPeriod(yearSource[i]).year;
      if (y > 1900 && y > maxYear) maxYear = y;
    }
    if (maxYear > 0) activeYear = maxYear;
  }

  // Determine current period vs comparison period
  let currentPeriodName = '';
  let previousPeriodName = '';
  let currentSubset: TransactionRecord[] = [];
  let previousSubset: TransactionRecord[] = [];

  if (filters.BULAN && filters.BULAN !== 'ALL') {
    const rawMonthFilter = filters.BULAN.toUpperCase().trim();
    currentPeriodName = MONTH_ALIASES_MAP[rawMonthFilter] || rawMonthFilter;
    const currentIdx = MONTH_ORDER[currentPeriodName] || 10;
    const prevIdx = currentIdx > 1 ? currentIdx - 1 : 12;
    const prevYear = currentIdx === 1 ? activeYear - 1 : activeYear;
    previousPeriodName = MONTH_NAMES_ID[prevIdx - 1];

    currentSubset = basePool.filter((r) => {
      const p = resolveRecordPeriod(r);
      return (p.year === activeYear || p.year === 0) && p.month === currentPeriodName;
    });
    previousSubset = basePool.filter((r) => {
      const p = resolveRecordPeriod(r);
      return (p.year === prevYear || p.year === 0) && p.month === previousPeriodName;
    });
  } else {
    // Dynamic resolution: pick the latest month in dataset (e.g. OKTOBER) and its predecessor (SEPTEMBER)
    const monthPool = basePool.length > 0 ? basePool : allRecords;
    const availableMonthsSet = new Set<string>();
    for (let i = 0; i < monthPool.length; i++) {
      const p = resolveRecordPeriod(monthPool[i]);
      if ((p.year === activeYear || p.year === 0) && p.month && p.month !== 'ALL') {
        availableMonthsSet.add(p.month);
      }
    }
    const availableMonths = Array.from(availableMonthsSet).sort(
      (a, b) => (MONTH_ORDER[b] || 0) - (MONTH_ORDER[a] || 0)
    );

    const latestMonth = availableMonths[0] || 'OKTOBER';
    const latestMonthIdx = MONTH_ORDER[latestMonth] || 10;
    const prevIdx = latestMonthIdx > 1 ? latestMonthIdx - 1 : 12;
    const prevYear = latestMonthIdx === 1 ? activeYear - 1 : activeYear;
    const prevMonth = MONTH_NAMES_ID[prevIdx - 1];

    currentPeriodName = `${latestMonth} ${activeYear}`;
    previousPeriodName = `${prevMonth} ${prevYear}`;
    currentSubset = basePool.filter((r) => {
      const p = resolveRecordPeriod(r);
      return (p.year === activeYear || p.year === 0) && p.month === latestMonth;
    });
    previousSubset = basePool.filter((r) => {
      const p = resolveRecordPeriod(r);
      return (p.year === prevYear || p.year === 0) && p.month === prevMonth;
    });

    if (currentSubset.length === 0 && basePool.length > 0) {
      currentSubset = dataset;
      previousSubset = basePool.filter((r) => resolveRecordPeriod(r).year === activeYear - 1);
      currentPeriodName = 'Periode Aktif';
      previousPeriodName = 'Baseline Tahun Lalu';
    }
  }

  // Apply optional Date-of-Month Range filter (e.g., Tgl 1-15 or Tgl 1-30 across both compared months)
  const rawStart = dateRange?.startDay ?? 1;
  const rawEnd = dateRange?.endDay ?? 31;
  const startDay = Math.max(1, Math.min(31, Math.min(rawStart, rawEnd)));
  const endDay = Math.max(1, Math.min(31, Math.max(rawStart, rawEnd)));
  const hasDateDayFilter = startDay > 1 || endDay < 31;

  if (hasDateDayFilter) {
    const matchesDayRange = (r: TransactionRecord) => {
      const day = getRecordDayOfMonth(r) ?? extractDayOfMonth(r);
      return day !== null && day >= startDay && day <= endDay;
    };
    currentSubset = currentSubset.filter(matchesDayRange);
    previousSubset = previousSubset.filter(matchesDayRange);

    const dateTag = startDay === endDay ? `Tgl ${startDay}` : `Tgl ${startDay}–${endDay}`;
    currentPeriodName = `${currentPeriodName} (${dateTag})`;
    previousPeriodName = `${previousPeriodName} (${dateTag})`;
  }

  // Calculate Actuals (Total, Sell In, Sell Out)
  const actualRevenue = currentSubset.reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const previousRevenue = previousSubset.reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const deltaVsPrevious = actualRevenue - previousRevenue;

  const sellInActual = currentSubset
    .filter(isSellInRecord)
    .reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const sellInPrevious = previousSubset
    .filter(isSellInRecord)
    .reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const sellOutActual = currentSubset
    .filter(isSellOutRecord)
    .reduce((acc, r) => acc + (r.VALUE || 0), 0);
  const sellOutPrevious = previousSubset
    .filter(isSellOutRecord)
    .reduce((acc, r) => acc + (r.VALUE || 0), 0);

  const resolvedScope = resolveActiveGapQuotaDetail(filters);
  const autoDefaultTarget = 0;
  const autoSellInTarget = 0;
  const autoSellOutTarget = 0;

  const quotaDetail: GapMonthlyQuotaConfig =
    typeof customTargetQuotaOverride === 'number'
      ? {
          ...resolvedScope.config,
          total: customTargetQuotaOverride > 0 ? customTargetQuotaOverride : undefined,
        }
      : customTargetQuotaOverride && typeof customTargetQuotaOverride === 'object'
      ? customTargetQuotaOverride
      : resolvedScope.config;

  const isCustomSellInTarget =
    typeof quotaDetail.sellIn === 'number' && quotaDetail.sellIn > 0;
  const sellInTarget = isCustomSellInTarget ? quotaDetail.sellIn! : 0;

  const isCustomSellOutTarget =
    typeof quotaDetail.sellOut === 'number' && quotaDetail.sellOut > 0;
  const sellOutTarget = isCustomSellOutTarget ? quotaDetail.sellOut! : 0;

  const ketMode = (filters.KET || 'ALL').trim().toUpperCase();
  let totalTarget = 0;
  let isCustomTarget = false;

  if (ketMode === 'SELL IN') {
    isCustomTarget = isCustomSellInTarget;
    totalTarget = sellInTarget;
  } else if (ketMode === 'SELL OUT') {
    isCustomTarget = isCustomSellOutTarget;
    totalTarget = sellOutTarget;
  } else if (typeof quotaDetail.total === 'number' && quotaDetail.total > 0) {
    isCustomTarget = true;
    totalTarget = quotaDetail.total;
  } else if (isCustomSellInTarget || isCustomSellOutTarget) {
    isCustomTarget = true;
    totalTarget = sellInTarget + sellOutTarget;
  }

  const sellInGapDeficit = sellInTarget > 0 ? Math.max(0, sellInTarget - sellInActual) : 0;
  const sellOutGapDeficit = sellOutTarget > 0 ? Math.max(0, sellOutTarget - sellOutActual) : 0;

  const gapDeficit = totalTarget > 0 ? Math.max(0, totalTarget - actualRevenue) : 0;
  const gapPercentage = totalTarget > 0 ? (gapDeficit / totalTarget) * 100 : 0;

  // 1. Group by Store: Identify Stores with drop, zero order, focus drop, or returns
  interface StoreAgg {
    displayName: string;
    val: number;
    sellIn: number;
    sellOut: number;
    focusVal: number;
    returnVal: number;
    region: string;
    sales: string;
    spv: string;
  }
  const storePrevMap: Record<string, StoreAgg> = {};
  const storeCurMap: Record<string, StoreAgg> = {};

  previousSubset.forEach((r) => {
    const rawName = (r.NAMA_STORE || '').trim() || 'N/A';
    const storeKey = rawName.toUpperCase();
    const prevEntry = storePrevMap[storeKey];
    const v = r.VALUE || 0;
    const isFocus = isFocusProduct(r);
    const isRet = v < 0 || (r.KET || '').toUpperCase().includes('RETURN');
    storePrevMap[storeKey] = {
      displayName: prevEntry?.displayName || rawName,
      val: (prevEntry?.val || 0) + v,
      sellIn: (prevEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (prevEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
      focusVal: (prevEntry?.focusVal || 0) + (isFocus ? v : 0),
      returnVal: (prevEntry?.returnVal || 0) + (isRet ? Math.abs(v) : 0),
      region: r.REGION || prevEntry?.region || 'PEKAN BARU',
      sales: r.SALES || prevEntry?.sales || '-',
      spv: r.SPV || prevEntry?.spv || '-',
    };
  });

  currentSubset.forEach((r) => {
    const rawName = (r.NAMA_STORE || '').trim() || 'N/A';
    const storeKey = rawName.toUpperCase();
    const curEntry = storeCurMap[storeKey];
    const v = r.VALUE || 0;
    const isFocus = isFocusProduct(r);
    const isRet = v < 0 || (r.KET || '').toUpperCase().includes('RETURN');
    storeCurMap[storeKey] = {
      displayName: curEntry?.displayName || rawName,
      val: (curEntry?.val || 0) + v,
      sellIn: (curEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (curEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
      focusVal: (curEntry?.focusVal || 0) + (isFocus ? v : 0),
      returnVal: (curEntry?.returnVal || 0) + (isRet ? Math.abs(v) : 0),
      region: r.REGION || curEntry?.region || 'PEKAN BARU',
      sales: r.SALES || curEntry?.sales || '-',
      spv: r.SPV || curEntry?.spv || '-',
    };
  });

  const allStores = Array.from(new Set([...Object.keys(storePrevMap), ...Object.keys(storeCurMap)]));
  const droppingStores: DropEntityItem[] = [];
  const rawStoreGapItems: Omit<StoreGapDetailItem, 'contributionPercent'>[] = [];
  const lostStoreContribs: Omit<FactorStoreContribution, 'sharePercent'>[] = [];
  const volumeDropStoreContribs: Omit<FactorStoreContribution, 'sharePercent'>[] = [];
  const focusDropStoreContribs: Omit<FactorStoreContribution, 'sharePercent'>[] = [];
  const returnStoreContribs: Omit<FactorStoreContribution, 'sharePercent'>[] = [];
  const routeWeakStoreContribs: Omit<FactorStoreContribution, 'sharePercent'>[] = [];

  let lostStoresCount = 0;
  let lowOrderStoresCount = 0;
  let totalStoreDeficit = 0;
  const isFocusedKetMode = ketMode === 'SELL IN' || ketMode === 'SELL OUT';

  allStores.forEach((storeKey) => {
    const prevObj = storePrevMap[storeKey];
    const curObj = storeCurMap[storeKey];
    const st = curObj?.displayName || prevObj?.displayName || storeKey;
    const prev = prevObj?.val || 0;
    const cur = curObj?.val || 0;
    const sellInPrev = prevObj?.sellIn || 0;
    const sellInCur = curObj?.sellIn || 0;
    const sellOutPrev = prevObj?.sellOut || 0;
    const sellOutCur = curObj?.sellOut || 0;
    const returnVal = curObj?.returnVal || 0;
    const focusDropVal = Math.max(0, (prevObj?.focusVal || 0) - (curObj?.focusVal || 0));
    const region = curObj?.region || prevObj?.region || 'PEKAN BARU';
    const salesName = curObj?.sales || prevObj?.sales || '-';
    const spvName = curObj?.spv || prevObj?.spv || '-';

    const delta = cur - prev;
    if (delta < 0) {
      const deficit = Math.abs(delta);
      totalStoreDeficit += deficit;
      const pct = prev > 0 ? (delta / prev) * 100 : -100;

      let reason =
        ketMode === 'SELL OUT'
          ? 'Volume Penjualan (Sell Out) Berkurang'
          : ketMode === 'SELL IN'
          ? 'Volume Orderan Masuk (Sell In) Berkurang'
          : 'Volume Pembelian Berkurang';
      let gapCategory: 'lost_outlet' | 'volume_drop' | 'return_impact' = 'volume_drop';

      if (cur <= 0 && prev > 0) {
        lostStoresCount++;
        gapCategory = 'lost_outlet';
        reason =
          ketMode === 'SELL OUT'
            ? 'Gerai Nihil Penjualan (0 Sell Out) di Periode Ini'
            : ketMode === 'SELL IN'
            ? 'Toko Pasif / 0 PO Orderan Masuk (Sell In) di Periode Ini'
            : 'Toko Pasif / Tidak Ada Repeat Order di Periode Ini';
        lostStoreContribs.push({
          storeName: st,
          salesName,
          region,
          spv: spvName,
          previousValue: prev,
          currentValue: cur,
          impactValue: deficit,
          note:
            ketMode === 'SELL OUT'
              ? '0 Sell Out di periode berjalan'
              : '0 order di periode berjalan',
        });
      } else {
        if (pct < -45) {
          lowOrderStoresCount++;
          reason =
            ketMode === 'SELL OUT'
              ? 'Penurunan Signifikan Sell Out (>45%) vs Periode Lalu'
              : 'Penurunan Signifikan (>45%) / Overstock dari Order Sebelumnya';
        } else if (prev > 5_000_000) {
          reason =
            ketMode === 'SELL OUT'
              ? 'Perlambatan Serapan Konsumen di Gerai Utama'
              : 'Penyusutan Order Akun Besar (Key Account De-stocking)';
        }
        volumeDropStoreContribs.push({
          storeName: st,
          salesName,
          region,
          spv: spvName,
          previousValue: prev,
          currentValue: cur,
          impactValue: deficit,
          note: `Turun ${Math.abs(pct).toFixed(1)}% vs periode lalu`,
        });
      }

      if (pct <= -25) {
        routeWeakStoreContribs.push({
          storeName: st,
          salesName,
          region,
          spv: spvName,
          previousValue: prev,
          currentValue: cur,
          impactValue: deficit,
          note: `Area ${region} · Growth ${pct.toFixed(1)}%`,
        });
      }

      droppingStores.push({
        name: st,
        previousValue: prev,
        currentValue: cur,
        sellInPrevious: sellInPrev,
        sellInCurrent: sellInCur,
        sellOutPrevious: sellOutPrev,
        sellOutCurrent: sellOutCur,
        deficitValue: deficit,
        growthPercent: pct,
        primaryReason: reason,
        regionOrSales: `${region} · ${salesName}`,
      });

      rawStoreGapItems.push({
        storeName: st,
        region,
        salesName,
        spvName,
        previousValue: prev,
        currentValue: cur,
        sellInPrevious: sellInPrev,
        sellInCurrent: sellInCur,
        sellOutPrevious: sellOutPrev,
        sellOutCurrent: sellOutCur,
        deficitValue: deficit,
        returnValue: returnVal,
        focusDropValue: focusDropVal,
        growthPercent: pct,
        gapCategory,
        primaryReason: reason,
      });
    } else if (!isFocusedKetMode && returnVal > 0) {
      rawStoreGapItems.push({
        storeName: st,
        region,
        salesName,
        spvName,
        previousValue: prev,
        currentValue: cur,
        sellInPrevious: sellInPrev,
        sellInCurrent: sellInCur,
        sellOutPrevious: sellOutPrev,
        sellOutCurrent: sellOutCur,
        deficitValue: returnVal,
        returnValue: returnVal,
        focusDropValue: focusDropVal,
        growthPercent: prev > 0 ? (delta / prev) * 100 : 0,
        gapCategory: 'return_impact',
        primaryReason: 'Pemotongan Omset karena Retur / Klaim Produk',
      });
    }

    if (focusDropVal > 0) {
      focusDropStoreContribs.push({
        storeName: st,
        salesName,
        region,
        spv: spvName,
        previousValue: prevObj?.focusVal || 0,
        currentValue: curObj?.focusVal || 0,
        impactValue: focusDropVal,
        note: 'Penurunan Produk Fokus',
      });
    }

    if (returnVal > 0) {
      returnStoreContribs.push({
        storeName: st,
        salesName,
        region,
        spv: spvName,
        previousValue: prevObj?.returnVal || 0,
        currentValue: returnVal,
        impactValue: returnVal,
        note: 'Nilai retur tercatat',
      });
    }
  });

  const compareByActiveGap = (
    a: { deficitValue: number; sellInPrevious?: number; sellInCurrent?: number; sellOutPrevious?: number; sellOutCurrent?: number },
    b: { deficitValue: number; sellInPrevious?: number; sellInCurrent?: number; sellOutPrevious?: number; sellOutCurrent?: number }
  ) => {
    if (ketMode === 'SELL OUT') {
      const gapA = (a.sellOutCurrent ?? 0) - (a.sellOutPrevious ?? 0);
      const gapB = (b.sellOutCurrent ?? 0) - (b.sellOutPrevious ?? 0);
      return gapA - gapB; // Most negative Gap Out first
    }
    if (ketMode === 'SELL IN') {
      const gapA = (a.sellInCurrent ?? 0) - (a.sellInPrevious ?? 0);
      const gapB = (b.sellInCurrent ?? 0) - (b.sellInPrevious ?? 0);
      return gapA - gapB; // Most negative Gap In first
    }
    return b.deficitValue - a.deficitValue;
  };

  droppingStores.sort(compareByActiveGap);

  const totalGapForShare = rawStoreGapItems.reduce((s, item) => s + item.deficitValue, 0);
  const storeGapDetails: StoreGapDetailItem[] = rawStoreGapItems
    .map((item) => ({
      ...item,
      contributionPercent:
        totalGapForShare > 0 ? (item.deficitValue / totalGapForShare) * 100 : 0,
    }))
    .sort(compareByActiveGap);

  // 2. Group by SKU: Identify SKUs with drop
  const skuPrevMap: Record<
    string,
    { val: number; sellIn: number; sellOut: number; brand: string; focus: string }
  > = {};
  const skuCurMap: Record<
    string,
    { val: number; sellIn: number; sellOut: number; brand: string; focus: string }
  > = {};

  previousSubset.forEach((r) => {
    const prevEntry = skuPrevMap[r.SKU];
    const v = r.VALUE || 0;
    skuPrevMap[r.SKU] = {
      val: (prevEntry?.val || 0) + v,
      sellIn: (prevEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (prevEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
      brand: r.BRAND,
      focus: r.PRODUK_FOCUS,
    };
  });

  currentSubset.forEach((r) => {
    const curEntry = skuCurMap[r.SKU];
    const v = r.VALUE || 0;
    skuCurMap[r.SKU] = {
      val: (curEntry?.val || 0) + v,
      sellIn: (curEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (curEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
      brand: r.BRAND,
      focus: r.PRODUK_FOCUS,
    };
  });

  const allSkus = Array.from(new Set([...Object.keys(skuPrevMap), ...Object.keys(skuCurMap)]));
  const droppingSkus: DropEntityItem[] = [];

  allSkus.forEach((skuName) => {
    const prev = skuPrevMap[skuName]?.val || 0;
    const cur = skuCurMap[skuName]?.val || 0;
    const delta = cur - prev;
    if (delta < 0) {
      const deficit = Math.abs(delta);
      const pct = prev > 0 ? (delta / prev) * 100 : -100;
      const isFocus = skuPrevMap[skuName]?.focus === 'FOCUS' || skuCurMap[skuName]?.focus === 'FOCUS';
      const brand = skuCurMap[skuName]?.brand || skuPrevMap[skuName]?.brand || 'Kosmetik';

      let reason = 'Rotasi Pembelian SKU Bergeser';
      if (cur === 0 && prev > 0) {
        reason = 'Stockout di Distributor / Toko Menghentikan Pemesanan';
      } else if (isFocus) {
        reason = 'Hero SKU Focus Mengalami Perlambatan Gerak (Slow Moving)';
      } else if (pct < -40) {
        reason = 'Penyusutan Kuantitas Pembelian / Minat Konsumen Turun';
      }

      droppingSkus.push({
        name: skuName,
        previousValue: prev,
        currentValue: cur,
        sellInPrevious: skuPrevMap[skuName]?.sellIn || 0,
        sellInCurrent: skuCurMap[skuName]?.sellIn || 0,
        sellOutPrevious: skuPrevMap[skuName]?.sellOut || 0,
        sellOutCurrent: skuCurMap[skuName]?.sellOut || 0,
        deficitValue: deficit,
        growthPercent: pct,
        primaryReason: reason,
        categoryOrBrand: brand,
      });
    }
  });

  droppingSkus.sort((a, b) => b.deficitValue - a.deficitValue);

  // 3. Group by Brand
  const brandPrevMap: Record<string, { val: number; sellIn: number; sellOut: number }> = {};
  const brandCurMap: Record<string, { val: number; sellIn: number; sellOut: number }> = {};
  previousSubset.forEach((r) => {
    const prevEntry = brandPrevMap[r.BRAND];
    const v = r.VALUE || 0;
    brandPrevMap[r.BRAND] = {
      val: (prevEntry?.val || 0) + v,
      sellIn: (prevEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (prevEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
    };
  });
  currentSubset.forEach((r) => {
    const curEntry = brandCurMap[r.BRAND];
    const v = r.VALUE || 0;
    brandCurMap[r.BRAND] = {
      val: (curEntry?.val || 0) + v,
      sellIn: (curEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (curEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
    };
  });

  const droppingBrands: DropEntityItem[] = [];
  Array.from(new Set([...Object.keys(brandPrevMap), ...Object.keys(brandCurMap)])).forEach((b) => {
    const prev = brandPrevMap[b]?.val || 0;
    const cur = brandCurMap[b]?.val || 0;
    const delta = cur - prev;
    if (delta < 0) {
      const deficit = Math.abs(delta);
      droppingBrands.push({
        name: b,
        previousValue: prev,
        currentValue: cur,
        sellInPrevious: brandPrevMap[b]?.sellIn || 0,
        sellInCurrent: brandCurMap[b]?.sellIn || 0,
        sellOutPrevious: brandPrevMap[b]?.sellOut || 0,
        sellOutCurrent: brandCurMap[b]?.sellOut || 0,
        deficitValue: deficit,
        growthPercent: prev > 0 ? (delta / prev) * 100 : -100,
        primaryReason: 'Penurunan Pesanan Toko untuk Portofolio Brand',
      });
    }
  });
  droppingBrands.sort((a, b) => b.deficitValue - a.deficitValue);

  // 4. Group by Sales
  const salesPrevMap: Record<string, { val: number; sellIn: number; sellOut: number }> = {};
  const salesCurMap: Record<string, { val: number; sellIn: number; sellOut: number }> = {};
  previousSubset.forEach((r) => {
    const prevEntry = salesPrevMap[r.SALES];
    const v = r.VALUE || 0;
    salesPrevMap[r.SALES] = {
      val: (prevEntry?.val || 0) + v,
      sellIn: (prevEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (prevEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
    };
  });
  currentSubset.forEach((r) => {
    const curEntry = salesCurMap[r.SALES];
    const v = r.VALUE || 0;
    salesCurMap[r.SALES] = {
      val: (curEntry?.val || 0) + v,
      sellIn: (curEntry?.sellIn || 0) + (isSellInRecord(r) ? v : 0),
      sellOut: (curEntry?.sellOut || 0) + (isSellOutRecord(r) ? v : 0),
    };
  });

  const droppingSales: DropEntityItem[] = [];
  Array.from(new Set([...Object.keys(salesPrevMap), ...Object.keys(salesCurMap)])).forEach((s) => {
    const prev = salesPrevMap[s]?.val || 0;
    const cur = salesCurMap[s]?.val || 0;
    const delta = cur - prev;
    if (delta < 0) {
      const deficit = Math.abs(delta);
      droppingSales.push({
        name: s,
        previousValue: prev,
        currentValue: cur,
        sellInPrevious: salesPrevMap[s]?.sellIn || 0,
        sellInCurrent: salesCurMap[s]?.sellIn || 0,
        sellOutPrevious: salesPrevMap[s]?.sellOut || 0,
        sellOutCurrent: salesCurMap[s]?.sellOut || 0,
        deficitValue: deficit,
        growthPercent: prev > 0 ? (delta / prev) * 100 : -100,
        primaryReason: 'Penurunan Target Realisasi Kunjungan & Repeat Order Toko',
      });
    }
  });
  droppingSales.sort((a, b) => b.deficitValue - a.deficitValue);

  // 5. Return Spike
  const prevReturns = previousSubset
    .filter((r) => r.VALUE < 0 || (r.KET || '').toUpperCase() === 'RETURN')
    .reduce((acc, r) => acc + Math.abs(r.VALUE), 0);
  const curReturns = currentSubset
    .filter((r) => r.VALUE < 0 || (r.KET || '').toUpperCase() === 'RETURN')
    .reduce((acc, r) => acc + Math.abs(r.VALUE), 0);
  const returnSpikeImpact = Math.max(0, curReturns - prevReturns);

  // 6. Build the 5 Primary Gap Drivers (100% synced with active filters + target quota + store details)
  const attachShareAndSort = (
    list: Omit<FactorStoreContribution, 'sharePercent'>[]
  ): FactorStoreContribution[] => {
    const sorted = [...list].sort((a, b) => b.impactValue - a.impactValue);
    const total = sorted.reduce((sum, item) => sum + item.impactValue, 0);
    return sorted.map((item) => ({
      ...item,
      sharePercent: total > 0 ? (item.impactValue / total) * 100 : 0,
    }));
  };

  const lostStoresList = attachShareAndSort(lostStoreContribs);
  const volumeDropList = attachShareAndSort(volumeDropStoreContribs);
  const focusDropList = attachShareAndSort(focusDropStoreContribs);
  const returnStoreList = attachShareAndSort(returnStoreContribs);
  const routeWeakList = attachShareAndSort(
    routeWeakStoreContribs.length > 0 ? routeWeakStoreContribs : volumeDropStoreContribs
  );

  const lostStoresValue = lostStoresList.reduce((acc, s) => acc + s.impactValue, 0);
  const volumeDeclineValue = volumeDropList.reduce((acc, s) => acc + s.impactValue, 0);
  const focusSkuDeficitFromStores = focusDropList.reduce((acc, s) => acc + s.impactValue, 0);
  const focusSkuDeficit =
    focusSkuDeficitFromStores > 0
      ? focusSkuDeficitFromStores
      : droppingSkus
          .filter((s) => s.primaryReason.includes('Hero SKU'))
          .reduce((acc, s) => acc + s.deficitValue, 0);

  const remainingQuotaGap = Math.max(0, gapDeficit - (lostStoresValue + volumeDeclineValue));
  const routeImpactValue =
    remainingQuotaGap > 0
      ? remainingQuotaGap
      : routeWeakList.reduce((acc, s) => acc + s.impactValue, 0) > 0
      ? Math.round(totalStoreDeficit * 0.1)
      : 0;

  const rawImpacts = [
    lostStoresValue,
    volumeDeclineValue,
    focusSkuDeficit,
    curReturns,
    routeImpactValue,
  ];
  const totalFactorImpactSum = rawImpacts.reduce((s, v) => s + v, 0);

  // Compute clean integer weights summing to 100% when impact > 0
  let factorPercents = [0, 0, 0, 0, 0];
  if (totalFactorImpactSum > 0) {
    const exact = rawImpacts.map((v) => (v / totalFactorImpactSum) * 100);
    const floored = exact.map((v) => Math.floor(v));
    let remainder = 100 - floored.reduce((s, v) => s + v, 0);
    const order = exact
      .map((v, i) => ({ i, frac: v - floored[i] }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) {
      floored[order[k % order.length].i] += 1;
    }
    factorPercents = floored;
  }

  // Active Filter Context Label for Action Plans
  const activeScopeParts: string[] = [];
  if (filters.SPV !== 'ALL') activeScopeParts.push(`SPV ${filters.SPV}`);
  if (filters.SALES !== 'ALL') activeScopeParts.push(`Sales ${filters.SALES}`);
  if (filters.TRAINER && filters.TRAINER !== 'ALL') activeScopeParts.push(`Trainer ${filters.TRAINER}`);
  if (filters.REGION !== 'ALL') activeScopeParts.push(`Region ${filters.REGION}`);
  if (filters.BRAND !== 'ALL') activeScopeParts.push(`Brand ${filters.BRAND}`);
  if (filters.NAMA_STORE !== 'ALL') activeScopeParts.push(`Toko ${filters.NAMA_STORE}`);
  if (filters.KET !== 'ALL') activeScopeParts.push(`KET ${filters.KET}`);
  const scopeLabel =
    activeScopeParts.length > 0 ? activeScopeParts.join(' · ') : 'Seluruh Area & Tim';

  const topLostStoreNames = lostStoresList
    .slice(0, 3)
    .map((s) => s.storeName)
    .join(', ');
  const topVolStoreNames = volumeDropList
    .slice(0, 3)
    .map((s) => s.storeName)
    .join(', ');
  const topFocusStoreNames = focusDropList
    .slice(0, 3)
    .map((s) => s.storeName)
    .join(', ');
  const topReturnStoreNames = returnStoreList
    .slice(0, 3)
    .map((s) => s.storeName)
    .join(', ');
  const topRouteSales = Array.from(
    new Set(routeWeakList.slice(0, 4).map((s) => s.salesName).filter((n) => n && n !== '-'))
  ).join(', ');

  const totalTargetText =
    totalTarget > 0 ? formatRupiah(totalTarget) : 'Belum Diatur (Rp 0 Manual)';

  const primaryDrivers: GapDriverFactor[] =
    ketMode === 'SELL IN'
      ? [
          {
            factor: 'Toko Putus Order / Belum Ada Orderan Masuk (0 PO Sell In)',
            impactValue: lostStoresValue,
            percentageOfGap: factorPercents[0],
            affectedStoreCount: lostStoresList.length,
            affectedStores: lostStoresList,
            description:
              lostStoresList.length > 0
                ? `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Sebanyak ${lostStoresList.length} toko yang memasukkan order di ${previousPeriodName} belum melakukan orderan masuk (0 PO Sell In) di ${currentPeriodName}${topLostStoreNames ? ` (antara lain: ${topLostStoreNames})` : ''}.`
                : `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Seluruh toko eksisting tetap mencatat orderan barang masuk (PO) pada periode ini.`,
            actionPlan:
              lostStoresList.length > 0
                ? `SPV (${filters.SPV !== 'ALL' ? filters.SPV : 'Area'}) & Sales segera lakukan re-call dan kunjungan jemput PO dalam 3x24 jam ke ${lostStoresList.length} toko tersebut (${topLostStoreNames || 'daftar toko terlampir'}). Cek hambatan tagihan/limit kredit dan tawarkan paket re-aktivasi orderan masuk.`
                : 'Pertahankan frekuensi kunjungan Sales (PJP) untuk menjaga konsistensi orderan masuk dari seluruh outlet aktif.',
          },
          {
            factor: 'Penyusutan Nilai Orderan Barang Masuk dari Toko Eksisting',
            impactValue: volumeDeclineValue,
            percentageOfGap: factorPercents[1],
            affectedStoreCount: volumeDropList.length,
            affectedStores: volumeDropList,
            description:
              volumeDropList.length > 0
                ? `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Sebanyak ${volumeDropList.length} toko tetap order, tetapi memangkas kuantitas/nilai orderan barang masuk dibanding ${previousPeriodName}${topVolStoreNames ? ` (penurunan terbesar: ${topVolStoreNames})` : ''}. Indikasi toko menahan stok masuk atau belanja lebih selektif.`
                : `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Tidak ada penyusutan nilai PO barang masuk pada gerai eksisting di filter aktif.`,
            actionPlan:
              volumeDropList.length > 0
                ? `Sales (${filters.SALES !== 'ALL' ? filters.SALES : 'PIC Toko'}) tawarkan program insentif pengambilan stok masuk (tiering diskon kuantitas / Buy 12 Free 1) dan audit sisa stok gudang di ${topVolStoreNames || 'toko terkait'} untuk mendorong penambahan nilai PO.`
                : 'Maksimalkan upselling SKU baru dan produk reguler saat Sales melakukan pengambilan orderan masuk.',
          },
          {
            factor: 'Penurunan Orderan Masuk Hero SKU / Produk Fokus (FOCUS)',
            impactValue: focusSkuDeficit,
            percentageOfGap: factorPercents[2],
            affectedStoreCount: focusDropList.length,
            affectedStores: focusDropList,
            description:
              focusSkuDeficit > 0
                ? `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Nilai barang masuk khusus SKU kategori FOCUS turun ${formatRupiah(focusSkuDeficit)} di ${focusDropList.length} toko${topFocusStoreNames ? ` (terutama ${topFocusStoreNames})` : ''}, berisiko membuat stok produk fokus di etalase toko menipis.`
                : `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Orderan barang masuk untuk SKU Produk Fokus terjaga stabil dibanding periode lalu.`,
            actionPlan:
              focusDropList.length > 0
                ? `Sales wajib menyertakan paket SKU FOCUS di setiap PO barang masuk ke ${topFocusStoreNames || 'gerai fokus'} dan pastikan ketersediaan stok distributor 100% aman agar tidak terjadi failed-order.`
                : 'Pertahankan alokasi kuota stok barang masuk SKU FOCUS pada setiap faktur distribusi.',
          },
          {
            factor: 'Koreksi / Pembatalan Nota & Retur Barang Masuk',
            impactValue: curReturns,
            percentageOfGap: factorPercents[3],
            affectedStoreCount: returnStoreList.length,
            affectedStores: returnStoreList,
            description:
              curReturns > 0
                ? `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Tercatat potongan retur/koreksi barang masuk sebesar ${formatRupiah(curReturns)} dari ${returnStoreList.length} toko${topReturnStoreNames ? ` (${topReturnStoreNames})` : ''} yang mengurangi omzet Sell In bersih.`
                : `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Tidak terdapat pemotongan retur atau pembatalan nota pada transaksi barang masuk periode ini.`,
            actionPlan:
              curReturns > 0
                ? `SPV & Logistik audit penyebab retur pengiriman di ${topReturnStoreNames || 'toko terkait'}, cek kualitas packing ekspedisi, dan ketatkan kontrol expired date (FEFO) sebelum barang masuk dikirim ke toko.`
                : 'Pertahankan ketepatan pengiriman, kelengkapan surat jalan, dan kontrol mutu sebelum barang masuk ke gerai.',
          },
          {
            factor: 'Gap Target Kuota Orderan Masuk (Sell In) & Rute Pengambilan PO',
            impactValue: routeImpactValue,
            percentageOfGap: factorPercents[4],
            affectedStoreCount: routeWeakList.length,
            affectedStores: routeWeakList,
            description:
              totalTarget <= 0
                ? `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Realisasi barang masuk tercatat ${formatRupiah(actualRevenue)} (target kuota manual Sell In belum diisi). Terdapat ${routeWeakList.length} toko dengan penurunan orderan masuk >25%.`
                : gapDeficit > 0
                ? `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Target kuota barang masuk (${totalTargetText}) vs realisasi (${formatRupiah(actualRevenue)}) menyisakan defisit orderan masuk ${formatRupiah(gapDeficit)} (${gapPercentage.toFixed(1)}%). ${routeWeakList.length} toko turun >25%.`
                : `[Analisa SELL IN · Barang Masuk | ${scopeLabel}] Realisasi orderan barang masuk (${formatRupiah(actualRevenue)}) telah melampaui target kuota Sell In (${totalTargetText}).`,
            actionPlan:
              gapDeficit > 0
                ? `SPV jadwalkan joint-visit rute PJP bersama ${topRouteSales || 'tim Sales area'} untuk mengejar kekurangan orderan masuk ${formatRupiah(gapDeficit)} lewat penetrasi New Open Outlet (NOO) dan dorong repeat PO akhir bulan.`
                : 'Pertahankan ritme pengambilan PO rutin dan fokuskan pembukaan outlet baru (NOO) untuk memperbesar basis barang masuk bulan depan.',
          },
        ]
      : ketMode === 'SELL OUT'
      ? [
          {
            factor: 'Gerai Nihil Penjualan / Barang Keluar Terhenti (0 Sell Out)',
            impactValue: lostStoresValue,
            percentageOfGap: factorPercents[0],
            affectedStoreCount: lostStoresList.length,
            affectedStores: lostStoresList,
            description:
              lostStoresList.length > 0
                ? `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Sebanyak ${lostStoresList.length} toko yang mencatat penjualan di ${previousPeriodName} belum membukukan barang keluar (0 Sell Out) di ${currentPeriodName}${topLostStoreNames ? ` (antara lain: ${topLostStoreNames})` : ''}.`
                : `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Seluruh gerai aktif tetap menghasilkan penjualan barang keluar ke konsumen pada periode ini.`,
            actionPlan:
              lostStoresList.length > 0
                ? `Trainer (${filters.TRAINER && filters.TRAINER !== 'ALL' ? filters.TRAINER : 'ARA/RATIH'}) & SPV segera cek keaktifan BA, kondisi stok pajangan rak, serta kedisiplinan input laporan harian di ${lostStoresList.length} gerai tersebut (${topLostStoreNames || 'daftar toko terlampir'}).`
                : 'Pertahankan monitoring laporan Sell Out harian BA agar tidak ada gerai yang kosong penjualan.',
          },
          {
            factor: 'Perlambatan Serapan Konsumen / Penurunan Barang Keluar Gerai Eksisting',
            impactValue: volumeDeclineValue,
            percentageOfGap: factorPercents[1],
            affectedStoreCount: volumeDropList.length,
            affectedStores: volumeDropList,
            description:
              volumeDropList.length > 0
                ? `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Sebanyak ${volumeDropList.length} gerai mengalami penurunan omzet penjualan ke konsumen akhir dibanding ${previousPeriodName}${topVolStoreNames ? ` (penurunan terbesar: ${topVolStoreNames})` : ''}, menandakan serapan barang keluar melambat.`
                : `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Kecepatan penjualan barang keluar pada gerai eksisting stabil atau meningkat dibanding periode lalu.`,
            actionPlan:
              volumeDropList.length > 0
                ? `Trainer lakukan coaching teknik selling & product pitching kepada BA di ${topVolStoreNames || 'toko yang melambat'}, optimalkan promo konsumen (tester, bundling kasir, weekend push) untuk mempercepat perputaran barang keluar.`
                : 'Teruskan program cross-selling BA agar rata-rata nilai belanja (basket size) konsumen meningkat.',
          },
          {
            factor: 'Pelemahan Penjualan Barang Keluar Hero SKU / Produk Fokus (FOCUS)',
            impactValue: focusSkuDeficit,
            percentageOfGap: factorPercents[2],
            affectedStoreCount: focusDropList.length,
            affectedStores: focusDropList,
            description:
              focusSkuDeficit > 0
                ? `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Penjualan barang keluar untuk produk kategori FOCUS turun ${formatRupiah(focusSkuDeficit)} di ${focusDropList.length} gerai${topFocusStoreNames ? ` (terutama ${topFocusStoreNames})` : ''}.`
                : `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Penjualan barang keluar SKU Produk Fokus terjaga positif pada periode dan filter ini.`,
            actionPlan:
              focusDropList.length > 0
                ? `Trainer & BA wajib menjadikan SKU FOCUS sebagai prioritas penawaran utama ke pengunjung di ${topFocusStoreNames || 'gerai fokus'}, pastikan display berada di posisi eye-level dan tester tersedia lengkap.`
                : 'Pertahankan posisi display utama dan insentif target Pcs Produk Fokus bagi BA di seluruh gerai.',
          },
          {
            factor: 'Retur Konsumen / Koreksi Penjualan Barang Keluar & Kualitas Display',
            impactValue: curReturns,
            percentageOfGap: factorPercents[3],
            affectedStoreCount: returnStoreList.length,
            affectedStores: returnStoreList,
            description:
              curReturns > 0
                ? `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Terdapat pengurang omzet penjualan barang keluar (retur/koreksi) sebesar ${formatRupiah(curReturns)} di ${returnStoreList.length} gerai${topReturnStoreNames ? ` (${topReturnStoreNames})` : ''}.`
                : `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Tidak terdapat beban retur yang memotong penjualan barang keluar pada filter ini.`,
            actionPlan:
              curReturns > 0
                ? `Trainer & BA audit keluhan produk maupun kondisi kemasan di rak ${topReturnStoreNames || 'toko terkait'} serta perketat pengecekan tanggal kedaluwarsa (FEFO) sebelum diserahkan ke konsumen.`
                : 'Jaga kebersihan etalase, kualitas tester, dan edukasi pemakaian produk oleh BA agar kepuasan konsumen terjaga.',
          },
          {
            factor: 'Gap Target Kuota Penjualan (Sell Out) & Produktivitas BA / Gerai',
            impactValue: routeImpactValue,
            percentageOfGap: factorPercents[4],
            affectedStoreCount: routeWeakList.length,
            affectedStores: routeWeakList,
            description:
              totalTarget <= 0
                ? `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Realisasi barang keluar tercatat ${formatRupiah(actualRevenue)} (target kuota manual Sell Out belum diisi). Terdapat ${routeWeakList.length} gerai mengalami penurunan Sell Out >25%.`
                : gapDeficit > 0
                ? `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Target penjualan barang keluar (${totalTargetText}) vs realisasi (${formatRupiah(actualRevenue)}) menyisakan defisit Sell Out ${formatRupiah(gapDeficit)} (${gapPercentage.toFixed(1)}%). ${routeWeakList.length} gerai turun >25%.`
                : `[Analisa SELL OUT · Penjualan / Barang Keluar | ${scopeLabel}] Realisasi penjualan barang keluar (${formatRupiah(actualRevenue)}) telah melampaui target kuota Sell Out (${totalTargetText}).`,
            actionPlan:
              gapDeficit > 0
                ? `Trainer & SPV jadwalkan pendampingan intensif / event store di gerai kontributor drop terbesar (${topVolStoreNames || 'daftar gerai terlampir'}) untuk menutup kekurangan kuota barang keluar ${formatRupiah(gapDeficit)}.`
                : 'Pertahankan produktivitas BA di gerai utama dan kembangkan aktivasi event di gerai potensial.',
          },
        ]
      : [
          {
            factor: 'Toko Pasif / Kehilangan Repeat Order & Penjualan (Lost Outlets)',
            impactValue: lostStoresValue,
            percentageOfGap: factorPercents[0],
            affectedStoreCount: lostStoresList.length,
            affectedStores: lostStoresList,
            description:
              lostStoresList.length > 0
                ? `[Gabungan Sell In & Sell Out | ${scopeLabel}] Tercatat ${lostStoresList.length} toko yang aktif di ${previousPeriodName} belum mencatat transaksi di ${currentPeriodName}${topLostStoreNames ? ` (antara lain: ${topLostStoreNames})` : ''}.`
                : `[Gabungan Sell In & Sell Out | ${scopeLabel}] Tidak ada toko yang benar-benar berhenti transaksi (0 aktivitas) pada filter aktif saat ini.`,
            actionPlan:
              lostStoresList.length > 0
                ? `SPV (${filters.SPV !== 'ALL' ? filters.SPV : 'Area'}), Sales & Trainer segera cek dalam 3x24 jam ke ${lostStoresList.length} toko pasif (${topLostStoreNames || 'daftar toko terlampir'}) untuk mengaktifkan kembali orderan masuk (Sell In) dan laporan penjualan (Sell Out).`
                : 'Pertahankan jadwal kunjungan rutin Sales dan monitoring harian BA agar seluruh outlet tetap aktif.',
          },
          {
            factor: 'Penurunan Ukuran Orderan Masuk & Serapan Gerai Eksisting',
            impactValue: volumeDeclineValue,
            percentageOfGap: factorPercents[1],
            affectedStoreCount: volumeDropList.length,
            affectedStores: volumeDropList,
            description:
              volumeDropList.length > 0
                ? `[Gabungan Sell In & Sell Out | ${scopeLabel}] Sebanyak ${volumeDropList.length} toko masih aktif tetapi nilai omzet menyusut dibanding ${previousPeriodName}${topVolStoreNames ? ` (terbesar: ${topVolStoreNames})` : ''}.`
                : `[Gabungan Sell In & Sell Out | ${scopeLabel}] Tidak terdapat penurunan volume transaksi pada gerai eksisting pada filter aktif saat ini.`,
            actionPlan:
              volumeDropList.length > 0
                ? `Sales (${filters.SALES !== 'ALL' ? filters.SALES : 'PIC Toko'}) tawarkan skema bundling diskon kuantitas untuk dongkrak PO masuk (Sell In), sementara Trainer dorong promo konsumen di ${topVolStoreNames || 'toko yang turun'} untuk mempercepat barang keluar (Sell Out).`
                : 'Lanjutkan upselling SKU margin tinggi di outlet aktif untuk memperbesar nilai nota masuk & keluar.',
          },
          {
            factor: 'Perlambatan Hero SKU / Produk Fokus (FOCUS)',
            impactValue: focusSkuDeficit,
            percentageOfGap: factorPercents[2],
            affectedStoreCount: focusDropList.length,
            affectedStores: focusDropList,
            description:
              focusSkuDeficit > 0
                ? `[Gabungan Sell In & Sell Out | ${scopeLabel}] Perputaran produk kategori FOCUS turun ${formatRupiah(focusSkuDeficit)} di ${focusDropList.length} toko${topFocusStoreNames ? ` (terutama ${topFocusStoreNames})` : ''}.`
                : `[Gabungan Sell In & Sell Out | ${scopeLabel}] Performa SKU Produk Fokus terjaga stabil pada periode dan filter ini.`,
            actionPlan:
              focusDropList.length > 0
                ? `SPV, Sales & Trainer pastikan stok SKU FOCUS tersedia 100% di orderan masuk dan kerahkan BA aktif untuk demo produk fokus di etalase utama ${topFocusStoreNames || 'gerai fokus'}.`
                : 'Pertahankan ketersediaan stok masuk dan visibilitas display Hero SKU FOCUS di seluruh gerai.',
          },
          {
            factor: 'Beban Retur & Klaim Produk Rusak / Tarikan Stok',
            impactValue: curReturns,
            percentageOfGap: factorPercents[3],
            affectedStoreCount: returnStoreList.length,
            affectedStores: returnStoreList,
            description:
              curReturns > 0
                ? `[Gabungan Sell In & Sell Out | ${scopeLabel}] Tercatat nilai retur sebesar ${formatRupiah(curReturns)} dari ${returnStoreList.length} toko${topReturnStoreNames ? ` (${topReturnStoreNames})` : ''} yang memotong omzet bersih.`
                : `[Gabungan Sell In & Sell Out | ${scopeLabel}] Tidak ada beban retur produk pada filter dan periode aktif.`,
            actionPlan:
              curReturns > 0
                ? `SPV & Gudang audit penyebab retur di ${topReturnStoreNames || 'toko terkait'}, perketat rotasi FEFO sebelum pengiriman barang masuk, dan cek SOP pengemasan ekspedisi.`
                : 'Pertahankan standar quality control pengiriman dan kontrol masa kedaluwarsa (FEFO) di toko.',
          },
          {
            factor: 'Kesenjangan Kuota Target & Produktivitas Rute Area / Tim',
            impactValue: routeImpactValue,
            percentageOfGap: factorPercents[4],
            affectedStoreCount: routeWeakList.length,
            affectedStores: routeWeakList,
            description:
              totalTarget <= 0
                ? `[Gabungan Sell In & Sell Out | ${scopeLabel}] Realisasi tercatat ${formatRupiah(actualRevenue)} (target kuota manual belum diisi). Terdapat ${routeWeakList.length} toko dengan penurunan >25%.`
                : gapDeficit > 0
                ? `[Gabungan Sell In & Sell Out | ${scopeLabel}] Selisih target kuota (${totalTargetText}) vs realisasi (${formatRupiah(actualRevenue)}) menyisakan gap ${formatRupiah(gapDeficit)} (${gapPercentage.toFixed(1)}%). ${routeWeakList.length} toko mengalami penurunan >25%.`
                : `[Gabungan Sell In & Sell Out | ${scopeLabel}] Realisasi saat ini telah melampaui target kuota ${totalTargetText}.`,
            actionPlan:
              gapDeficit > 0
                ? `SPV jadwalkan joint-visit pendampingan rute PJP bersama ${topRouteSales || 'tim sales area'} serta koordinasi Trainer untuk menutup sisa gap kuota ${formatRupiah(gapDeficit)}.`
                : 'Pertahankan ritme kunjungan PJP dan alokasikan kelebihan kapasitas untuk ekspansi New Open Outlet (NOO).',
          },
        ];

  return {
    totalTarget,
    autoDefaultTarget,
    isCustomTarget,
    activeQuotaScopeLabel: resolvedScope.scopeLabel,
    activeQuotaScopeType: resolvedScope.scopeType,
    activeQuotaEntityName: resolvedScope.entityName,
    sellInTarget,
    autoSellInTarget,
    isCustomSellInTarget,
    sellInActual,
    sellInPrevious,
    sellInGapDeficit,
    sellOutTarget,
    autoSellOutTarget,
    isCustomSellOutTarget,
    sellOutActual,
    sellOutPrevious,
    sellOutGapDeficit,
    actualRevenue,
    gapDeficit,
    gapPercentage,
    previousRevenue,
    deltaVsPrevious,
    primaryDrivers,
    topDroppingStores: droppingStores,
    topDroppingSkus: droppingSkus.slice(0, 30),
    topDroppingBrands: droppingBrands,
    topDroppingSales: droppingSales,
    storeGapDetails,
    totalStoreGapDeficit: totalGapForShare,
    returnSpikeImpact,
    lostStoresCount,
    lowOrderStoresCount,
    currentPeriodName,
    previousPeriodName,
  };
}
