import * as XLSX from 'xlsx';
import { DashboardFilters, TimeframeMode } from '../types/dashboard';

export const TIMEFRAME_EDITS_STORAGE_KEY = 'salespro_timeframe_breakdown_edits_v1';

export interface TimeframeRowEdit {
  periodKey: string;
  label?: string;
  subLabel?: string;
  value: number;
  qty: number;
  txCount: number;
  notes?: string;
  isAddedManual?: boolean;
  updatedAt: string;
}

type StoredTimeframeEditsMap = Record<string, Record<string, TimeframeRowEdit>>;

export function buildTimeframeFilterScopeKey(mode: TimeframeMode, filters?: DashboardFilters): string {
  if (!filters) return `${mode}::ALL`;
  const parts = [
    mode,
    filters.TAHUN || 'ALL',
    filters.BULAN || 'ALL',
    filters.SPV || 'ALL',
    filters.SALES || 'ALL',
    filters.TRAINER || 'ALL',
    filters.BRAND || 'ALL',
    filters.KATEGORI || 'ALL',
    filters.STATUS_PRODUK || 'ALL',
    filters.NAMA_STORE || 'ALL',
    filters.REGION || 'ALL',
    filters.KET || 'ALL',
    filters.SKU || 'ALL',
    (filters.searchQuery || '').trim().toLowerCase(),
  ];
  return parts.join('|');
}

function loadAllStoredEdits(): StoredTimeframeEditsMap {
  try {
    const raw = localStorage.getItem(TIMEFRAME_EDITS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllStoredEdits(map: StoredTimeframeEditsMap): void {
  try {
    localStorage.setItem(TIMEFRAME_EDITS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Gagal menyimpan editan rincian periode ke localStorage', e);
  }
}

export function loadTimeframeScopeEdits(
  mode: TimeframeMode,
  filters?: DashboardFilters
): Record<string, TimeframeRowEdit> {
  const scopeKey = buildTimeframeFilterScopeKey(mode, filters);
  const all = loadAllStoredEdits();
  return all[scopeKey] || {};
}

export function saveTimeframeRowEdit(
  mode: TimeframeMode,
  filters: DashboardFilters | undefined,
  edit: Omit<TimeframeRowEdit, 'updatedAt'>
): void {
  const scopeKey = buildTimeframeFilterScopeKey(mode, filters);
  const all = loadAllStoredEdits();
  if (!all[scopeKey]) all[scopeKey] = {};
  all[scopeKey][edit.periodKey] = {
    ...edit,
    value: Number(edit.value) || 0,
    qty: Number(edit.qty) || 0,
    txCount: Math.max(0, Math.round(Number(edit.txCount) || 0)),
    notes: (edit.notes || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  saveAllStoredEdits(all);
}

export function removeTimeframeRowEdit(
  mode: TimeframeMode,
  filters: DashboardFilters | undefined,
  periodKey: string
): void {
  const scopeKey = buildTimeframeFilterScopeKey(mode, filters);
  const all = loadAllStoredEdits();
  if (all[scopeKey]) {
    delete all[scopeKey][periodKey];
    if (Object.keys(all[scopeKey]).length === 0) {
      delete all[scopeKey];
    }
    saveAllStoredEdits(all);
  }
}

export function clearTimeframeScopeEdits(
  mode: TimeframeMode,
  filters?: DashboardFilters
): void {
  const scopeKey = buildTimeframeFilterScopeKey(mode, filters);
  const all = loadAllStoredEdits();
  delete all[scopeKey];
  saveAllStoredEdits(all);
}

export interface ExportTimeframeRow {
  label: string;
  subLabel: string;
  dateRef?: string;
  value: number;
  spvTarget?: number;
  spvAchvPct?: number | null;
  qty: number;
  txCount: number;
  sharePercent: number;
  growthPct: number | null;
  isEdited: boolean;
  notes?: string;
}

export function exportTimeframeBreakdownToExcel(
  rows: ExportTimeframeRow[],
  mode: TimeframeMode,
  scopeLabel: string
): void {
  const modeLabel =
    mode === 'harian'
      ? 'Harian'
      : mode === 'mingguan'
      ? 'Mingguan'
      : mode === 'bulanan'
      ? 'Bulanan'
      : 'Tahunan';

  const hasSpvTarget = rows.some((r) => typeof r.spvTarget === 'number');
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalSpvTarget = rows.reduce((s, r) => s + (r.spvTarget || 0), 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalTx = rows.reduce((s, r) => s + r.txCount, 0);

  const sheetData = rows.map((r, idx) => {
    const baseRow: Record<string, string | number> = {
      No: idx + 1,
      Periode: r.label,
      Keterangan: r.subLabel || r.dateRef || '-',
      'Nilai Penjualan (IDR)': r.value,
    };
    if (hasSpvTarget) {
      const targetVal = r.spvTarget || 0;
      const achv =
        typeof r.spvAchvPct === 'number'
          ? `${r.spvAchvPct.toFixed(1)}%`
          : targetVal > 0
          ? `${((r.value / targetVal) * 100).toFixed(1)}%`
          : '-';
      baseRow['Target SPV (IDR)'] = targetVal;
      baseRow['Achv Target SPV (%)'] = achv;
      baseRow['Gap Target SPV (IDR)'] = r.value - targetVal;
    }
    baseRow['Unit (QTY)'] = r.qty;
    baseRow['Jumlah Transaksi'] = r.txCount;
    baseRow['Kontribusi (%)'] = `${r.sharePercent.toFixed(1)}%`;
    baseRow['Growth vs Sebelumnya (%)'] =
      r.growthPct === null ? '-' : `${r.growthPct >= 0 ? '+' : ''}${r.growthPct.toFixed(1)}%`;
    baseRow.Sumber = r.isEdited ? 'Edit Manual' : 'Google Sheet';
    baseRow.Catatan = r.notes || '';
    return baseRow;
  });

  const totalRow: Record<string, string | number> = {
    No: rows.length + 1,
    Periode: 'TOTAL',
    Keterangan: scopeLabel || 'Filter Aktif',
    'Nilai Penjualan (IDR)': totalValue,
  };
  if (hasSpvTarget) {
    totalRow['Target SPV (IDR)'] = totalSpvTarget;
    totalRow['Achv Target SPV (%)'] =
      totalSpvTarget > 0 ? `${((totalValue / totalSpvTarget) * 100).toFixed(1)}%` : '-';
    totalRow['Gap Target SPV (IDR)'] = totalValue - totalSpvTarget;
  }
  totalRow['Unit (QTY)'] = totalQty;
  totalRow['Jumlah Transaksi'] = totalTx;
  totalRow['Kontribusi (%)'] = '100.0%';
  totalRow['Growth vs Sebelumnya (%)'] = '-';
  totalRow.Sumber = 'Akumulasi';
  totalRow.Catatan = `${rows.length} periode`;
  sheetData.push(totalRow);

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Rincian ${modeLabel}`);
  XLSX.writeFile(
    wb,
    `Rincian_${modeLabel}_SalesPro_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
