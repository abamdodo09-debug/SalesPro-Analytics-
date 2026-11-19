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

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalTx = rows.reduce((s, r) => s + r.txCount, 0);

  const sheetData = rows.map((r, idx) => ({
    No: idx + 1,
    Periode: r.label,
    Keterangan: r.subLabel || r.dateRef || '-',
    'Nilai Penjualan (IDR)': r.value,
    'Unit (QTY)': r.qty,
    'Jumlah Transaksi': r.txCount,
    'Kontribusi (%)': `${r.sharePercent.toFixed(1)}%`,
    'Growth vs Sebelumnya (%)': r.growthPct === null ? '-' : `${r.growthPct >= 0 ? '+' : ''}${r.growthPct.toFixed(1)}%`,
    Sumber: r.isEdited ? 'Edit Manual' : 'Google Sheet',
    Catatan: r.notes || '',
  }));

  sheetData.push({
    No: rows.length + 1,
    Periode: 'TOTAL',
    Keterangan: scopeLabel || 'Filter Aktif',
    'Nilai Penjualan (IDR)': totalValue,
    'Unit (QTY)': totalQty,
    'Jumlah Transaksi': totalTx,
    'Kontribusi (%)': '100.0%',
    'Growth vs Sebelumnya (%)': '-',
    Sumber: 'Akumulasi',
    Catatan: `${rows.length} periode`,
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Rincian ${modeLabel}`);
  XLSX.writeFile(
    wb,
    `Rincian_${modeLabel}_SalesPro_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
