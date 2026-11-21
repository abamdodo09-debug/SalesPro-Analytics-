import {
  TransactionRecord,
  ProfitAreaSummary,
  ProfitItemBreakdown,
  ProfitStoreItem,
  BaFocusProductOverride,
  AreaCostSummary,
  SalesSalaryItem,
  BaSalaryItem,
  TrainerSalaryItem,
} from '../types/dashboard';
import { aggregateAreaCost, TrainerCostConfigInput } from './costCalculations';
import { DEFAULT_FOCUS_TARGET_PCS } from '../services/focusProductService';

/**
 * KALKULASI PROFIT AREA (P&L PORTFOLIO):
 * - Realisasi Sell In: Total omset penjualan Sell In area
 * - Margin Kotor: Realisasi Sell In x 55%
 * - Biaya Operasional: Realisasi Sell In x 33%
 * - Biaya Gaji: Total Beban Gaji Karyawan (Gaji Pokok & Insentif Sales + BA)
 * - Total Biaya: Biaya Operasional (33%) + Biaya Gaji Karyawan
 * - Sisa Profit: Margin Kotor - Total Biaya
 * - % Sisa Profit vs Sell In: (Sisa Profit / Realisasi Sell In) x 100%
 * - % Sisa Profit vs Margin: (Sisa Profit / Margin) x 100%
 * - Break-Even Point (BEP) Sell In: Biaya Gaji / (55% - 33%) = Biaya Gaji / 22%
 *
 * PROFITABILITAS PER OUTLET / NAMA STORE:
 * - Memasukkan biaya gaji BA yang ada di toko tersebut (Pokok + Insentif Non-Lavojoy + Insentif Lavojoy 4%)
 * - Beban Toko = Biaya Operasional 33% + Biaya Gaji BA Toko
 * - Sisa Profit Toko = Margin 55% - Beban Toko
 */
export function calculateProfitArea(
  records: TransactionRecord[],
  marginRate: number = 0.55,
  operatingCostRate: number = 0.33,
  customSalesTargets: Record<string, number> = {},
  customBaNonLavojoyTargets: Record<string, number> = {},
  customBaLavojoyTargets: Record<string, number> = {},
  customSalesBonuses: Record<string, number> = {},
  customSalesPenalties: Record<string, number> = {},
  defaultSalesTarget: number = 150000000,
  defaultBaNonLavojoyTarget: number = 30000000,
  defaultBaLavojoyTarget: number = 5000000,
  customBaFocusOverrides?: Record<string, BaFocusProductOverride>,
  trainerConfigsOverride?: TrainerCostConfigInput[],
  trainerMonthlyTargetsOverride?: Record<string, { targetSellOut?: number; targetProdukFokusPcs?: number; notes?: string }>,
  trainerMonthPeriod: string = 'OKTOBER 2026',
  baFocusTargetsOverride?: Record<string, number>
): ProfitAreaSummary {
  // 1. Dapatkan agregasi beban gaji dari modul Cost Area
  const costData = aggregateAreaCost(
    records,
    customSalesTargets,
    customBaNonLavojoyTargets,
    customBaLavojoyTargets,
    customSalesBonuses,
    customSalesPenalties,
    defaultSalesTarget,
    defaultBaNonLavojoyTarget,
    defaultBaLavojoyTarget,
    customBaFocusOverrides,
    DEFAULT_FOCUS_TARGET_PCS,
    {},
    {},
    {},
    {},
    {},
    {},
    trainerMonthPeriod,
    trainerConfigsOverride,
    trainerMonthlyTargetsOverride,
    baFocusTargetsOverride,
    {
      strictSellInForSales: true,
      strictSellOutForBa: true,
      disableDummyBaFallback: true,
      disableTrainerDummyActualFallback: true,
      activeTrainersOnlyFromRecords: true,
      zeroCostOnEmptyRecords: true,
    }
  );

  // 2. Hitung Realisasi Sell In (Hanya transaksi SELL IN yang ada di data terfilter)
  const isSellInRecord = (r: TransactionRecord) => {
    const ket = (r.KET || '').trim().toUpperCase();
    return ket === 'SELL IN' || ket.includes('SELL IN');
  };

  const sellInRecords = records.filter(isSellInRecord);
  const sellInActual = sellInRecords.reduce((acc, r) => acc + (r.VALUE || 0), 0);

  // 3. Margin 55%
  const marginPercent = marginRate * 100;
  const marginValue = Math.round(sellInActual * marginRate);

  // 4. Biaya Operasional 33%
  const operatingCostPercent = operatingCostRate * 100;
  const operatingCostValue = Math.round(sellInActual * operatingCostRate);

  // 5. Beban Gaji Karyawan Area (Sales + BA + Trainer)
  const salaryCost = costData.totalCost;
  const totalSalesSalary = costData.totalSalesCost;
  const totalBaSalary = costData.totalBaCost;
  const totalTrainerSalary = costData.totalTrainerCost;

  // 6. Total Beban Pengurang = Biaya 33% + Biaya Gaji
  const totalExpense = operatingCostValue + salaryCost;

  // 7. Sisa Profit yang Tersedia
  const remainingProfitValue = marginValue - totalExpense;

  // 8. Persentase Sisa Profit
  const remainingProfitPercentSellIn = sellInActual > 0
    ? (remainingProfitValue / sellInActual) * 100
    : 0;

  const remainingProfitPercentMargin = marginValue > 0
    ? (remainingProfitValue / marginValue) * 100
    : 0;

  // 9. Titik Impas (Break-Even Point) Sell In
  const netMarginDiffPercent = (marginRate - operatingCostRate) * 100; // 22%
  const netSpreadRate = marginRate - operatingCostRate;
  const breakEvenPointSellIn = netSpreadRate > 0
    ? Math.round(salaryCost / netSpreadRate)
    : 0;

  // 10. Status Profitabilitas
  let profitStatus: 'excellent' | 'healthy' | 'warning' | 'deficit' = 'deficit';
  if (remainingProfitPercentSellIn >= 10) {
    profitStatus = 'excellent';
  } else if (remainingProfitPercentSellIn >= 5) {
    profitStatus = 'healthy';
  } else if (remainingProfitPercentSellIn >= 0) {
    profitStatus = 'warning';
  } else {
    profitStatus = 'deficit';
  }

  // 11. Breakdown Profit per Sales Representative
  const profitBySales: ProfitItemBreakdown[] = costData.salesList.map((sales) => {
    const sSellIn = sales.sellInActual;
    const sMargin = Math.round(sSellIn * marginRate);
    const sOpsCost = Math.round(sSellIn * operatingCostRate);
    const sSalary = sales.totalSalary;
    const sTotalExp = sOpsCost + sSalary;
    const sProfit = sMargin - sTotalExp;
    const sProfitPct = sSellIn > 0 ? (sProfit / sSellIn) * 100 : 0;
    const sMarginPct = sMargin > 0 ? (sProfit / sMargin) * 100 : 0;

    let sStatus: 'excellent' | 'healthy' | 'warning' | 'deficit' = 'deficit';
    if (sProfitPct >= 10) sStatus = 'excellent';
    else if (sProfitPct >= 5) sStatus = 'healthy';
    else if (sProfitPct >= 0) sStatus = 'warning';

    return {
      id: sales.salesName,
      name: sales.salesName,
      coverArea: sales.coverArea,
      spvOrRegion: sales.spv,
      sellInActual: sSellIn,
      marginPercent,
      marginValue: sMargin,
      operatingCostPercent,
      operatingCostValue: sOpsCost,
      salaryCost: sSalary,
      totalExpense: sTotalExp,
      remainingProfitValue: sProfit,
      remainingProfitPercentSellIn: sProfitPct,
      remainingProfitPercentMargin: sMarginPct,
      profitStatus: sStatus,
    };
  });

  // 12. Breakdown Profit per Cover Area (Real Sell In per Area + Real Region + Proporsional Gaji Sales & BA)
  const areaMap: Record<
    string,
    {
      sellIn: number;
      salesSalary: number;
      baSalary: number;
      region: string;
    }
  > = {};

  const salesAreaSellInMap: Record<string, Record<string, number>> = {};

  for (const r of records) {
    const area = (r.COVER_AREA || '').trim() || 'Area Lain';
    const reg = (r.REGION || '').trim();
    if (!areaMap[area]) {
      areaMap[area] = { sellIn: 0, salesSalary: 0, baSalary: 0, region: reg || '-' };
    } else if ((areaMap[area].region === '-' || !areaMap[area].region) && reg && reg !== '-') {
      areaMap[area].region = reg;
    }

    if (isSellInRecord(r)) {
      const val = r.VALUE || 0;
      areaMap[area].sellIn += val;
      if (r.SALES && r.SALES !== '-' && r.SALES !== 'ALL') {
        if (!salesAreaSellInMap[r.SALES]) {
          salesAreaSellInMap[r.SALES] = {};
        }
        salesAreaSellInMap[r.SALES][area] = (salesAreaSellInMap[r.SALES][area] || 0) + val;
      }
    }
  }

  for (const s of costData.salesList) {
    const areaBreakdown = salesAreaSellInMap[s.salesName];
    const totalSalesSellInByArea = areaBreakdown
      ? Object.values(areaBreakdown).reduce((acc, v) => acc + v, 0)
      : 0;

    if (areaBreakdown && totalSalesSellInByArea > 0) {
      let allocated = 0;
      const entries = Object.entries(areaBreakdown);
      entries.forEach(([area, areaVal], idx) => {
        if (!areaMap[area]) {
          areaMap[area] = { sellIn: 0, salesSalary: 0, baSalary: 0, region: '-' };
        }
        const portion =
          idx === entries.length - 1
            ? s.totalSalary - allocated
            : Math.round(s.totalSalary * (areaVal / totalSalesSellInByArea));
        allocated += portion;
        areaMap[area].salesSalary += portion;
      });
    } else {
      const area = s.coverArea && s.coverArea !== '-' ? s.coverArea : 'Area Lain';
      if (!areaMap[area]) {
        areaMap[area] = { sellIn: 0, salesSalary: 0, baSalary: 0, region: '-' };
      }
      areaMap[area].salesSalary += s.totalSalary;
    }
  }

  for (const b of costData.baList) {
    const area = b.coverArea && b.coverArea !== '-' ? b.coverArea : 'Area Lain';
    if (!areaMap[area]) {
      areaMap[area] = { sellIn: 0, salesSalary: 0, baSalary: 0, region: b.region || '-' };
    }
    areaMap[area].baSalary += b.totalSalary;
    if ((areaMap[area].region === '-' || !areaMap[area].region) && b.region && b.region !== '-') {
      areaMap[area].region = b.region;
    }
  }

  const profitByArea: ProfitItemBreakdown[] = Object.entries(areaMap)
    .map(([areaName, data]) => {
      const aSellIn = data.sellIn;
      const aMargin = Math.round(aSellIn * marginRate);
      const aOpsCost = Math.round(aSellIn * operatingCostRate);
      const aSalary = data.salesSalary + data.baSalary;
      const aTotalExp = aOpsCost + aSalary;
      const aProfit = aMargin - aTotalExp;
      const aProfitPct = aSellIn > 0 ? (aProfit / aSellIn) * 100 : 0;
      const aMarginPct = aMargin > 0 ? (aProfit / aMargin) * 100 : 0;

      let aStatus: 'excellent' | 'healthy' | 'warning' | 'deficit' = 'deficit';
      if (aProfitPct >= 10) aStatus = 'excellent';
      else if (aProfitPct >= 5) aStatus = 'healthy';
      else if (aProfitPct >= 0) aStatus = 'warning';

      return {
        id: areaName,
        name: areaName,
        coverArea: areaName,
        spvOrRegion: data.region,
        sellInActual: aSellIn,
        marginPercent,
        marginValue: aMargin,
        operatingCostPercent,
        operatingCostValue: aOpsCost,
        salaryCost: aSalary,
        totalExpense: aTotalExp,
        remainingProfitValue: aProfit,
        remainingProfitPercentSellIn: aProfitPct,
        remainingProfitPercentMargin: aMarginPct,
        profitStatus: aStatus,
      };
    })
    .sort((a, b) => b.sellInActual - a.sellInActual);

  // 13. Breakdown Profit per Region
  const regionMap: Record<
    string,
    {
      sellIn: number;
      salary: number;
    }
  > = {};

  for (const item of profitByArea) {
    const reg = item.spvOrRegion && item.spvOrRegion !== '-' ? item.spvOrRegion : 'Region Utama';
    if (!regionMap[reg]) {
      regionMap[reg] = { sellIn: 0, salary: 0 };
    }
    regionMap[reg].sellIn += item.sellInActual;
    regionMap[reg].salary += item.salaryCost;
  }

  const profitByRegion: ProfitItemBreakdown[] = Object.entries(regionMap)
    .map(([regName, data]) => {
      const rSellIn = data.sellIn;
      const rMargin = Math.round(rSellIn * marginRate);
      const rOpsCost = Math.round(rSellIn * operatingCostRate);
      const rSalary = data.salary;
      const rTotalExp = rOpsCost + rSalary;
      const rProfit = rMargin - rTotalExp;
      const rProfitPct = rSellIn > 0 ? (rProfit / rSellIn) * 100 : 0;
      const rMarginPct = rMargin > 0 ? (rProfit / rMargin) * 100 : 0;

      let rStatus: 'excellent' | 'healthy' | 'warning' | 'deficit' = 'deficit';
      if (rProfitPct >= 10) rStatus = 'excellent';
      else if (rProfitPct >= 5) rStatus = 'healthy';
      else if (rProfitPct >= 0) rStatus = 'warning';

      return {
        id: regName,
        name: regName,
        coverArea: '-',
        spvOrRegion: regName,
        sellInActual: rSellIn,
        marginPercent,
        marginValue: rMargin,
        operatingCostPercent,
        operatingCostValue: rOpsCost,
        salaryCost: rSalary,
        totalExpense: rTotalExp,
        remainingProfitValue: rProfit,
        remainingProfitPercentSellIn: rProfitPct,
        remainingProfitPercentMargin: rMarginPct,
        profitStatus: rStatus,
      };
    })
    .sort((a, b) => b.sellInActual - a.sellInActual);

  // 14. Breakdown Profit per Outlet / Nama Store (Hanya SELL IN Toko - [Biaya Ops 33% + Gaji BA Toko])
  const storeMap: Record<
    string,
    {
      sellIn: number;
      coverArea: string;
      region: string;
      salesName: string;
      hasBa: boolean;
      baName: string;
      baSalary: number;
    }
  > = {};

  for (const r of records) {
    const sName = r.NAMA_STORE;
    if (!sName) continue;
    if (!storeMap[sName]) {
      storeMap[sName] = {
        sellIn: 0,
        coverArea: r.COVER_AREA || '-',
        region: r.REGION || '-',
        salesName: r.SALES || '-',
        hasBa: false,
        baName: '-',
        baSalary: 0,
      };
    }
    if (isSellInRecord(r)) {
      storeMap[sName].sellIn += (r.VALUE || 0);
    }
  }

  // Masukkan data BA dan gaji BA ke toko
  for (const ba of costData.baList) {
    if (storeMap[ba.storeName]) {
      storeMap[ba.storeName].hasBa = true;
      storeMap[ba.storeName].baName = ba.baName;
      storeMap[ba.storeName].baSalary = ba.totalSalary;
      if (ba.coverArea !== '-') storeMap[ba.storeName].coverArea = ba.coverArea;
      if (ba.region !== '-') storeMap[ba.storeName].region = ba.region;
      if (ba.salesName !== '-') storeMap[ba.storeName].salesName = ba.salesName;
    } else {
      storeMap[ba.storeName] = {
        sellIn: 0,
        coverArea: ba.coverArea,
        region: ba.region,
        salesName: ba.salesName,
        hasBa: true,
        baName: ba.baName,
        baSalary: ba.totalSalary,
      };
    }
  }

  const profitByStore: ProfitStoreItem[] = Object.entries(storeMap)
    .map(([sName, data]) => {
      const sSellIn = data.sellIn;
      const sMargin = Math.round(sSellIn * marginRate);
      const sOpsCost = Math.round(sSellIn * operatingCostRate);
      const sBaSalary = data.baSalary;
      const sTotalExp = sOpsCost + sBaSalary;
      const sProfit = sMargin - sTotalExp;
      const sProfitPct = sSellIn > 0 ? (sProfit / sSellIn) * 100 : 0;
      const sMarginPct = sMargin > 0 ? (sProfit / sMargin) * 100 : 0;

      let sStatus: 'excellent' | 'healthy' | 'warning' | 'deficit' = 'deficit';
      if (sProfitPct >= 10) sStatus = 'excellent';
      else if (sProfitPct >= 5) sStatus = 'healthy';
      else if (sProfitPct >= 0) sStatus = 'warning';

      return {
        id: sName,
        storeName: sName,
        coverArea: data.coverArea,
        region: data.region,
        salesName: data.salesName,
        hasBa: data.hasBa,
        baName: data.baName,
        sellInActual: sSellIn,
        marginPercent,
        marginValue: sMargin,
        operatingCostPercent,
        operatingCostValue: sOpsCost,
        baSalaryCost: sBaSalary,
        totalExpense: sTotalExp,
        remainingProfitValue: sProfit,
        remainingProfitPercentSellIn: sProfitPct,
        remainingProfitPercentMargin: sMarginPct,
        profitStatus: sStatus,
      };
    })
    .sort((a, b) => b.sellInActual - a.sellInActual);

  return {
    sellInActual,
    marginPercent,
    marginValue,
    operatingCostPercent,
    operatingCostValue,
    salaryCost,
    totalSalesSalary,
    totalBaSalary,
    totalTrainerSalary,
    costBreakdown: costData,
    totalExpense,
    remainingProfitValue,
    remainingProfitPercentSellIn,
    remainingProfitPercentMargin,
    breakEvenPointSellIn,
    netMarginDiffPercent,
    profitStatus,
    profitBySales,
    profitByArea,
    profitByRegion,
    profitByStore,
  };
}

export interface MonthlyProfitOverrideInput {
  sellIn?: number;
  margin?: number;
  opsCost?: number;
  salaryCost?: number;
  netProfit?: number;
}

export interface MonthlyProfitSummaryEntry {
  monthKey: string;
  summary: ProfitAreaSummary | null;
  override?: MonthlyProfitOverrideInput;
}

const resolveProfitStatus = (pctVsSellIn: number): 'excellent' | 'healthy' | 'warning' | 'deficit' => {
  if (pctVsSellIn >= 10) return 'excellent';
  if (pctVsSellIn >= 5) return 'healthy';
  if (pctVsSellIn >= 0) return 'warning';
  return 'deficit';
};

export function combineMonthlyProfitAreaSummaries(
  entries: MonthlyProfitSummaryEntry[],
  marginRate: number = 0.55,
  operatingCostRate: number = 0.33
): ProfitAreaSummary {
  const marginPercent = marginRate * 100;
  const operatingCostPercent = operatingCostRate * 100;
  const netMarginDiffPercent = (marginRate - operatingCostRate) * 100;
  const netSpreadRate = marginRate - operatingCostRate;

  let sellInActual = 0;
  let marginValue = 0;
  let operatingCostValue = 0;
  let salaryCost = 0;
  let totalExpense = 0;
  let remainingProfitValue = 0;

  let totalSalesSalary = 0;
  let totalBaSalary = 0;
  let totalTrainerSalary = 0;

  let totalSalesBase = 0;
  let totalSalesIncentive = 0;
  let totalBaBase = 0;
  let totalBaIncentive = 0;
  let totalBaFocusIncentive = 0;
  let totalBaFocusPenalty = 0;
  let totalBaFocusNetBonus = 0;
  let totalTrainerBase = 0;
  let totalTrainerTransport = 0;
  let totalTrainerFocusIncentive = 0;
  let totalTrainerFocusPenalty = 0;
  let totalTrainerKpiIncentive = 0;
  let totalTrainerKpiPenalty = 0;

  const salesBreakdownMap = new Map<string, ProfitItemBreakdown>();
  const areaBreakdownMap = new Map<string, ProfitItemBreakdown>();
  const regionBreakdownMap = new Map<string, ProfitItemBreakdown>();
  const storeBreakdownMap = new Map<string, ProfitStoreItem>();

  const salesSalaryMap = new Map<string, SalesSalaryItem>();
  const baSalaryMap = new Map<string, BaSalaryItem>();
  const trainerSalaryMap = new Map<string, TrainerSalaryItem & { _months: number; _kpiSum: number }>();

  const mergeItemBreakdown = (
    map: Map<string, ProfitItemBreakdown>,
    item: ProfitItemBreakdown
  ) => {
    const key = (item.id || item.name || '').trim().toUpperCase();
    if (!key) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...item });
    } else {
      prev.sellInActual += item.sellInActual;
      prev.marginValue += item.marginValue;
      prev.operatingCostValue += item.operatingCostValue;
      prev.salaryCost += item.salaryCost;
      prev.totalExpense += item.totalExpense;
      prev.remainingProfitValue += item.remainingProfitValue;
      if ((prev.coverArea === '-' || !prev.coverArea) && item.coverArea && item.coverArea !== '-') {
        prev.coverArea = item.coverArea;
      }
      if ((prev.spvOrRegion === '-' || !prev.spvOrRegion) && item.spvOrRegion && item.spvOrRegion !== '-') {
        prev.spvOrRegion = item.spvOrRegion;
      }
    }
  };

  for (let i = 0; i < entries.length; i++) {
    const { summary: s, override: ovRaw } = entries[i];
    const ov = ovRaw || {};
    const hasOv =
      ov.sellIn !== undefined ||
      ov.margin !== undefined ||
      ov.opsCost !== undefined ||
      ov.salaryCost !== undefined ||
      ov.netProfit !== undefined;
    if (!s && !hasOv) continue;

    const mSellIn = ov.sellIn !== undefined ? ov.sellIn : s ? s.sellInActual : 0;
    const mMargin = ov.margin !== undefined ? ov.margin : Math.round(mSellIn * marginRate);
    const mOpsCost = ov.opsCost !== undefined ? ov.opsCost : Math.round(mSellIn * operatingCostRate);
    const mSalary = ov.salaryCost !== undefined ? ov.salaryCost : s ? s.salaryCost : 0;
    const mTotalExp = mOpsCost + mSalary;
    const mNetProfit = ov.netProfit !== undefined ? ov.netProfit : mMargin - mTotalExp;

    sellInActual += mSellIn;
    marginValue += mMargin;
    operatingCostValue += mOpsCost;
    salaryCost += mSalary;
    totalExpense += mTotalExp;
    remainingProfitValue += mNetProfit;

    if (!s) continue;

    totalSalesSalary += s.totalSalesSalary || 0;
    totalBaSalary += s.totalBaSalary || 0;
    totalTrainerSalary += s.totalTrainerSalary || 0;

    for (const item of s.profitBySales) mergeItemBreakdown(salesBreakdownMap, item);
    for (const item of s.profitByArea) mergeItemBreakdown(areaBreakdownMap, item);
    for (const item of s.profitByRegion) mergeItemBreakdown(regionBreakdownMap, item);

    for (const st of s.profitByStore) {
      const sKey = (st.storeName || st.id || '').trim().toUpperCase();
      if (!sKey) continue;
      const prev = storeBreakdownMap.get(sKey);
      if (!prev) {
        storeBreakdownMap.set(sKey, { ...st });
      } else {
        prev.sellInActual += st.sellInActual;
        prev.marginValue += st.marginValue;
        prev.operatingCostValue += st.operatingCostValue;
        prev.baSalaryCost += st.baSalaryCost;
        prev.totalExpense += st.totalExpense;
        prev.remainingProfitValue += st.remainingProfitValue;
        if (st.hasBa) prev.hasBa = true;
        if ((prev.baName === '-' || !prev.baName) && st.baName && st.baName !== '-') {
          prev.baName = st.baName;
        }
        if ((prev.coverArea === '-' || !prev.coverArea) && st.coverArea && st.coverArea !== '-') {
          prev.coverArea = st.coverArea;
        }
        if ((prev.region === '-' || !prev.region) && st.region && st.region !== '-') {
          prev.region = st.region;
        }
        if ((prev.salesName === '-' || !prev.salesName) && st.salesName && st.salesName !== '-') {
          prev.salesName = st.salesName;
        }
      }
    }

    const cb = s.costBreakdown;
    if (cb) {
      totalSalesBase += cb.totalSalesBase || 0;
      totalSalesIncentive += cb.totalSalesIncentive || 0;
      totalBaBase += cb.totalBaBase || 0;
      totalBaIncentive += cb.totalBaIncentive || 0;
      totalBaFocusIncentive += cb.totalBaFocusIncentive || 0;
      totalBaFocusPenalty += cb.totalBaFocusPenalty || 0;
      totalBaFocusNetBonus += cb.totalBaFocusNetBonus || 0;
      totalTrainerBase += cb.totalTrainerBase || 0;
      totalTrainerTransport += cb.totalTrainerTransport || 0;
      totalTrainerFocusIncentive += cb.totalTrainerFocusIncentive || 0;
      totalTrainerFocusPenalty += cb.totalTrainerFocusPenalty || 0;
      totalTrainerKpiIncentive += cb.totalTrainerKpiIncentive || 0;
      totalTrainerKpiPenalty += cb.totalTrainerKpiPenalty || 0;

      for (const sal of cb.salesList || []) {
        const key = (sal.salesName || '').trim().toUpperCase();
        if (!key) continue;
        const prev = salesSalaryMap.get(key);
        if (!prev) {
          salesSalaryMap.set(key, {
            ...sal,
            coveredStores: [...sal.coveredStores],
            coveredBaList: sal.coveredBaList.map((b) => ({ ...b })),
          });
        } else {
          prev.sellInActual += sal.sellInActual;
          prev.sellInTarget += sal.sellInTarget;
          prev.baseSalary += sal.baseSalary;
          prev.incentiveNominal += sal.incentiveNominal;
          prev.coveredBaTotalSellOut += sal.coveredBaTotalSellOut;
          prev.baProductivityBonus += sal.baProductivityBonus;
          prev.baProductivityPenalty += sal.baProductivityPenalty;
          prev.baProductivitySpCount += sal.baProductivitySpCount;
          prev.totalSalary += sal.totalSalary;
          prev.achievementPercent =
            prev.sellInTarget > 0 ? (prev.sellInActual / prev.sellInTarget) * 100 : 0;
        }
      }

      for (const ba of cb.baList || []) {
        const baUpper = (ba.baName || '').trim().toUpperCase();
        const isGeneric =
          !baUpper ||
          baUpper === '-' ||
          baUpper === 'BA COUNTER' ||
          baUpper === 'NON BA' ||
          baUpper === 'NON-BA';
        const key = isGeneric
          ? `__STORE__${(ba.storeName || '').trim().toUpperCase()}`
          : baUpper;
        const prev = baSalaryMap.get(key);
        if (!prev) {
          baSalaryMap.set(key, {
            ...ba,
            storeDetails: ba.storeDetails ? ba.storeDetails.map((d) => ({ ...d })) : undefined,
          });
        } else {
          prev.sellOutNonLavojoy += ba.sellOutNonLavojoy;
          prev.targetNonLavojoy += ba.targetNonLavojoy;
          prev.baseSalary += ba.baseSalary;
          prev.incentiveNonLavojoyNominal += ba.incentiveNonLavojoyNominal;
          prev.sellOutLavojoy += ba.sellOutLavojoy;
          prev.targetLavojoy += ba.targetLavojoy;
          prev.incentiveLavojoyNominal += ba.incentiveLavojoyNominal;
          prev.focusTargetPcs = (prev.focusTargetPcs || 0) + (ba.focusTargetPcs || 0);
          prev.focusActualPcs = (prev.focusActualPcs || 0) + (ba.focusActualPcs || 0);
          prev.focusIncentive = (prev.focusIncentive || 0) + (ba.focusIncentive || 0);
          prev.focusPenalty = (prev.focusPenalty || 0) + (ba.focusPenalty || 0);
          prev.focusNetBonus = (prev.focusNetBonus || 0) + (ba.focusNetBonus || 0);
          prev.sellOutActual += ba.sellOutActual;
          prev.sellOutTarget += ba.sellOutTarget;
          prev.totalIncentiveNominal += ba.totalIncentiveNominal;
          prev.incentiveNominal += ba.incentiveNominal;
          prev.totalSalary += ba.totalSalary;
          prev.achievementNonLavojoyPercent =
            prev.targetNonLavojoy > 0 ? (prev.sellOutNonLavojoy / prev.targetNonLavojoy) * 100 : 0;
          prev.achievementPercent =
            prev.sellOutTarget > 0 ? (prev.sellOutActual / prev.sellOutTarget) * 100 : 0;
        }
      }

      for (const tr of cb.trainerList || []) {
        const key = (tr.trainerName || '').trim().toUpperCase();
        if (!key) continue;
        const prev = trainerSalaryMap.get(key);
        if (!prev) {
          trainerSalaryMap.set(key, {
            ...tr,
            _months: 1,
            _kpiSum: tr.kpiScore || 0,
          });
        } else {
          prev.baseSalary += tr.baseSalary;
          prev.transportAllowance += tr.transportAllowance;
          prev.focusTargetPcs += tr.focusTargetPcs;
          prev.focusActualPcs += tr.focusActualPcs;
          prev.focusIncentive += tr.focusIncentive;
          prev.focusPenalty += tr.focusPenalty;
          prev.kpiIncentive += tr.kpiIncentive;
          prev.kpiPenalty += tr.kpiPenalty;
          prev.totalSalary += tr.totalSalary;
          prev.sellOutActual += tr.sellOutActual;
          prev.sellOutTarget += tr.sellOutTarget;
          prev._months += 1;
          prev._kpiSum += tr.kpiScore || 0;
          prev.kpiScore = Math.round(prev._kpiSum / prev._months);
          prev.focusAchievementPct =
            prev.focusTargetPcs > 0 ? (prev.focusActualPcs / prev.focusTargetPcs) * 100 : 0;
        }
      }
    }
  }

  const finalizeBreakdowns = (map: Map<string, ProfitItemBreakdown>): ProfitItemBreakdown[] =>
    Array.from(map.values())
      .map((item) => {
        const pctSellIn = item.sellInActual > 0 ? (item.remainingProfitValue / item.sellInActual) * 100 : 0;
        const pctMargin = item.marginValue > 0 ? (item.remainingProfitValue / item.marginValue) * 100 : 0;
        return {
          ...item,
          remainingProfitPercentSellIn: pctSellIn,
          remainingProfitPercentMargin: pctMargin,
          profitStatus: resolveProfitStatus(pctSellIn),
        };
      })
      .sort((a, b) => b.sellInActual - a.sellInActual);

  const profitByStore: ProfitStoreItem[] = Array.from(storeBreakdownMap.values())
    .map((st) => {
      const pctSellIn = st.sellInActual > 0 ? (st.remainingProfitValue / st.sellInActual) * 100 : 0;
      const pctMargin = st.marginValue > 0 ? (st.remainingProfitValue / st.marginValue) * 100 : 0;
      return {
        ...st,
        remainingProfitPercentSellIn: pctSellIn,
        remainingProfitPercentMargin: pctMargin,
        profitStatus: resolveProfitStatus(pctSellIn),
      };
    })
    .sort((a, b) => b.sellInActual - a.sellInActual);

  const salesList = Array.from(salesSalaryMap.values()).sort((a, b) => b.sellInActual - a.sellInActual);
  const baList = Array.from(baSalaryMap.values()).sort((a, b) => b.sellOutActual - a.sellOutActual);
  const trainerList: TrainerSalaryItem[] = Array.from(trainerSalaryMap.values())
    .map(({ _months: _m, _kpiSum: _ks, ...rest }) => rest)
    .sort((a, b) => b.totalSalary - a.totalSalary);

  const costBreakdown: AreaCostSummary = {
    totalCost: salaryCost,
    totalSalesCost: totalSalesSalary,
    totalSalesBase,
    totalSalesIncentive,
    totalBaCost: totalBaSalary,
    totalBaBase,
    totalBaIncentive,
    totalBaFocusIncentive,
    totalBaFocusPenalty,
    totalBaFocusNetBonus,
    totalTrainerCost: totalTrainerSalary,
    totalTrainerBase,
    totalTrainerTransport,
    totalTrainerFocusIncentive,
    totalTrainerFocusPenalty,
    totalTrainerKpiIncentive,
    totalTrainerKpiPenalty,
    totalAreaRevenue: sellInActual,
    costToRevenueRatio: sellInActual > 0 ? (salaryCost / sellInActual) * 100 : 0,
    salesCount: salesList.length,
    baCount: baList.length,
    trainerCount: trainerList.length,
    salesList,
    baList,
    trainerList,
  };

  const remainingProfitPercentSellIn = sellInActual > 0 ? (remainingProfitValue / sellInActual) * 100 : 0;
  const remainingProfitPercentMargin = marginValue > 0 ? (remainingProfitValue / marginValue) * 100 : 0;
  const breakEvenPointSellIn = netSpreadRate > 0 ? Math.round(salaryCost / netSpreadRate) : 0;

  return {
    sellInActual,
    marginPercent,
    marginValue,
    operatingCostPercent,
    operatingCostValue,
    salaryCost,
    totalSalesSalary,
    totalBaSalary,
    totalTrainerSalary,
    costBreakdown,
    totalExpense,
    remainingProfitValue,
    remainingProfitPercentSellIn,
    remainingProfitPercentMargin,
    breakEvenPointSellIn,
    netMarginDiffPercent,
    profitStatus: resolveProfitStatus(remainingProfitPercentSellIn),
    profitBySales: finalizeBreakdowns(salesBreakdownMap),
    profitByArea: finalizeBreakdowns(areaBreakdownMap),
    profitByRegion: finalizeBreakdowns(regionBreakdownMap),
    profitByStore,
  };
}

