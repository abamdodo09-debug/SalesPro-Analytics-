export const MANUAL_KA_MG_STORAGE_KEY = 'salespro_manual_ka_mg_monthly_v1';

export interface ManualKaMgMonthData {
  periodMonth: string;
  periodYear: number;
  spvRegularSellIn: number;
  kaSellInValue: number;
  dazzleMeMgSellInValue: number;
  totalSellIn: number;
  isCustomTotal?: boolean;
  growthPercent: number;
  isCustomGrowth?: boolean;
  totalSellOut: number;
  target: number;
  achievementPercent: number;
  notes: string;
  isFilled: boolean;
  updatedAt?: string;
}

const MONTHS_12_KEYS = [
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

export function getKaMgMonthStorageKey(month: string, year: number): string {
  return `${(month || 'OKTOBER').toUpperCase()}_${year || 2026}`;
}

export function loadAllManualKaMgRecords(): Record<string, ManualKaMgMonthData> {
  try {
    const raw = localStorage.getItem(MANUAL_KA_MG_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Gagal membaca data manual KA & MG dari localStorage', e);
  }
  return {};
}

export function saveAllManualKaMgRecords(map: Record<string, ManualKaMgMonthData>): void {
  try {
    localStorage.setItem(MANUAL_KA_MG_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Gagal menyimpan data manual KA & MG ke localStorage', e);
  }
}

export function loadManualKaMgMonthData(month: string, year: number): ManualKaMgMonthData {
  const normMonth = (month || 'JANUARI').toUpperCase().trim();
  const normYear = year || 2026;
  const key = getKaMgMonthStorageKey(normMonth, normYear);
  const all = loadAllManualKaMgRecords();
  const saved = all[key];

  if (!saved) {
    return {
      periodMonth: normMonth,
      periodYear: normYear,
      spvRegularSellIn: 0,
      kaSellInValue: 0,
      dazzleMeMgSellInValue: 0,
      totalSellIn: 0,
      isCustomTotal: false,
      growthPercent: 0,
      isCustomGrowth: false,
      totalSellOut: 0,
      target: 0,
      achievementPercent: 0,
      notes: '',
      isFilled: false,
    };
  }

  const ka = Number(saved.kaSellInValue) || 0;
  const mg = Number(saved.dazzleMeMgSellInValue) || 0;
  const hasCustomTotal = Boolean(saved.isCustomTotal);
  const totalSellIn = hasCustomTotal
    ? Math.max(0, Number(saved.totalSellIn) || 0)
    : saved.totalSellIn !== undefined && saved.totalSellIn !== ka + mg && saved.isCustomTotal !== false
    ? Math.max(0, Number(saved.totalSellIn) || 0)
    : ka + mg;
  const growthPercent = Number(saved.growthPercent) || 0;

  return {
    periodMonth: normMonth,
    periodYear: normYear,
    spvRegularSellIn: 0,
    kaSellInValue: ka,
    dazzleMeMgSellInValue: mg,
    totalSellIn,
    isCustomTotal: hasCustomTotal || totalSellIn !== ka + mg,
    growthPercent,
    isCustomGrowth: Boolean(saved.isCustomGrowth),
    totalSellOut: Number(saved.totalSellOut) || 0,
    target: Number(saved.target) || 0,
    achievementPercent: 0,
    notes: saved.notes || '',
    isFilled: true,
    updatedAt: saved.updatedAt,
  };
}

/**
 * Resolves a month filter ('ALL', '2026-10', 'OKTOBER', etc.) into normalized month key + year,
 * and returns combined Sell In KA & DAZZLE ME MG from Tabel Riwayat Pencapaian Sell In KA & DAZZLE ME MG.
 */
export function getManualKaMgSellInBreakdown(
  selectedMonth?: string,
  selectedYear: number = 2026
): { totalSellIn: number; kaSellIn: number; mgSellIn: number; filledMonthsCount: number } {
  const raw = (selectedMonth || 'ALL').trim().toUpperCase();
  const baseYear = selectedYear > 2000 ? selectedYear : 2026;

  if (!raw || raw === 'ALL') {
    let totalSellIn = 0;
    let kaSellIn = 0;
    let mgSellIn = 0;
    let filledMonthsCount = 0;

    for (let i = 0; i < MONTHS_12_KEYS.length; i++) {
      const mData = loadManualKaMgMonthData(MONTHS_12_KEYS[i], baseYear);
      totalSellIn += mData.totalSellIn;
      kaSellIn += mData.kaSellInValue;
      mgSellIn += mData.dazzleMeMgSellInValue;
      if (mData.isFilled) filledMonthsCount += 1;
    }

    return { totalSellIn, kaSellIn, mgSellIn, filledMonthsCount };
  }

  let targetMonthName = raw;
  let targetYear = baseYear;

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    targetYear = Number(isoMatch[1]) || baseYear;
    const mIdx = Number(isoMatch[2]) - 1;
    if (mIdx >= 0 && mIdx < MONTHS_12_KEYS.length) {
      targetMonthName = MONTHS_12_KEYS[mIdx];
    }
  } else {
    for (let i = 0; i < MONTHS_12_KEYS.length; i++) {
      if (raw === MONTHS_12_KEYS[i] || raw.includes(MONTHS_12_KEYS[i])) {
        targetMonthName = MONTHS_12_KEYS[i];
        break;
      }
    }
  }

  const single = loadManualKaMgMonthData(targetMonthName, targetYear);
  return {
    totalSellIn: single.totalSellIn,
    kaSellIn: single.kaSellInValue,
    mgSellIn: single.dazzleMeMgSellInValue,
    filledMonthsCount: single.isFilled ? 1 : 0,
  };
}
