import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalesSalaryItem, BaSalaryItem, TrainerSalaryItem } from '../types/dashboard';

export type SalarySlipRole = 'sales' | 'ba' | 'trainer';

export interface SalarySlipCompanyHeader {
  companyName: string;
  tagline: string;
  address: string;
  contactLine: string;
  divisionLine: string;
  city: string;
  signerName: string;
  signerTitle: string;
  logoMonogram: string;
  footerNote: string;
}

export interface SalarySlipLineItem {
  id: string;
  label: string;
  amount: number;
  note?: string;
}

export interface SalarySlipData {
  slipKey: string;
  employeeKey: string;
  role: SalarySlipRole;
  slipNumber: string;
  periodLabel: string;
  printDate: string; // YYYY-MM-DD
  employeeName: string;
  employeeCode: string;
  positionTitle: string;
  areaOrStore: string;
  spvOrRegion: string;
  paymentMethod: string;
  earnings: SalarySlipLineItem[];
  deductions: SalarySlipLineItem[];
  notes: string;
  isCustomEdited?: boolean;
  updatedAt?: string;
}

const STORAGE_KEY_KOP = 'salespro_slip_kop_jmu_v1';
const STORAGE_KEY_SLIP_OVERRIDES = 'salespro_slip_overrides_jmu_v1';

export const DEFAULT_COMPANY_HEADER: SalarySlipCompanyHeader = {
  companyName: 'PT JALUR MANDIRI UTAMA',
  tagline: 'DISTRIBUTOR RESMI PRODUK KOSMETIK & PERAWATAN TUBUH',
  address: 'Jl. Jend. Sudirman, Pekanbaru — Provinsi Riau',
  contactLine: 'Telp: (0761) 000-000 | Email: hr.finance@jalurmandiriutama.co.id',
  divisionLine: 'DIVISI HUMAN RESOURCES & FINANCE PAYROLL',
  city: 'Pekanbaru',
  signerName: 'WIDODO',
  signerTitle: 'HRD & Finance Manager',
  logoMonogram: 'JMU',
  footerNote:
    'Dokumen slip gaji ini diterbitkan secara resmi oleh PT JALUR MANDIRI UTAMA dan bersifat rahasia.',
};

export function loadCompanyHeader(): SalarySlipCompanyHeader {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KOP);
    if (!raw) return { ...DEFAULT_COMPANY_HEADER };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_COMPANY_HEADER,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_COMPANY_HEADER };
  }
}

export function saveCompanyHeader(header: SalarySlipCompanyHeader): SalarySlipCompanyHeader {
  const sanitized: SalarySlipCompanyHeader = {
    companyName: (header.companyName || DEFAULT_COMPANY_HEADER.companyName).trim(),
    tagline: (header.tagline ?? '').trim(),
    address: (header.address ?? '').trim(),
    contactLine: (header.contactLine ?? '').trim(),
    divisionLine: (header.divisionLine ?? '').trim(),
    city: (header.city || DEFAULT_COMPANY_HEADER.city).trim(),
    signerName: (header.signerName || DEFAULT_COMPANY_HEADER.signerName).trim(),
    signerTitle: (header.signerTitle || DEFAULT_COMPANY_HEADER.signerTitle).trim(),
    logoMonogram: (header.logoMonogram || 'JMU').trim().slice(0, 4).toUpperCase(),
    footerNote: (header.footerNote ?? '').trim(),
  };
  try {
    localStorage.setItem(STORAGE_KEY_KOP, JSON.stringify(sanitized));
  } catch {
    // ignore storage quota errors
  }
  return sanitized;
}

export function resetCompanyHeader(): SalarySlipCompanyHeader {
  try {
    localStorage.removeItem(STORAGE_KEY_KOP);
  } catch {
    // ignore
  }
  return { ...DEFAULT_COMPANY_HEADER };
}

export function makeSlipKey(role: SalarySlipRole, employeeKey: string, periodLabel: string): string {
  const normRole = role.toLowerCase();
  const normEmp = employeeKey.trim().toUpperCase().replace(/\s+/g, '_');
  const normPeriod = (periodLabel || 'ALL').trim().toUpperCase().replace(/\s+/g, '_');
  return `${normRole}__${normEmp}__${normPeriod}`;
}

export function loadSlipOverrides(): Record<string, SalarySlipData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SLIP_OVERRIDES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getSlipOverride(slipKey: string): SalarySlipData | null {
  const all = loadSlipOverrides();
  return all[slipKey] || null;
}

export function saveSlipOverride(slip: SalarySlipData): SalarySlipData {
  const all = loadSlipOverrides();
  const saved: SalarySlipData = {
    ...slip,
    isCustomEdited: true,
    updatedAt: new Date().toISOString(),
  };
  all[slip.slipKey] = saved;
  try {
    localStorage.setItem(STORAGE_KEY_SLIP_OVERRIDES, JSON.stringify(all));
  } catch {
    // ignore
  }
  return saved;
}

export function deleteSlipOverride(slipKey: string): void {
  const all = loadSlipOverrides();
  if (all[slipKey]) {
    delete all[slipKey];
    try {
      localStorage.setItem(STORAGE_KEY_SLIP_OVERRIDES, JSON.stringify(all));
    } catch {
      // ignore
    }
  }
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPeriodCode(periodLabel: string): string {
  const upper = (periodLabel || '').toUpperCase();
  const monthMap: Record<string, string> = {
    JANUARI: '01',
    FEBRUARI: '02',
    MARET: '03',
    APRIL: '04',
    MEI: '05',
    JUNI: '06',
    JULI: '07',
    AGUSTUS: '08',
    SEPTEMBER: '09',
    OKTOBER: '10',
    NOVEMBER: '11',
    DESEMBER: '12',
  };
  for (const [name, num] of Object.entries(monthMap)) {
    if (upper.includes(name)) return num;
  }
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

function getYearCode(periodLabel: string): string {
  const match = (periodLabel || '').match(/\b(20\d{2})\b/);
  return match ? match[1] : String(new Date().getFullYear());
}

export function formatSlipPeriodLabel(bulan: string, tahun: string | number): string {
  const b = (bulan || 'ALL').toUpperCase();
  const t = tahun && String(tahun) !== 'ALL' ? String(tahun) : '2026';
  if (b === 'ALL') return `SEMUA BULAN ${t}`;
  if (b.includes(t)) return b;
  return `${b} ${t}`;
}

export function buildDefaultSlipFromSales(
  item: SalesSalaryItem,
  periodLabel: string,
  index: number = 0
): SalarySlipData {
  const slipKey = makeSlipKey('sales', item.salesName, periodLabel);
  const year = getYearCode(periodLabel);
  const month = getPeriodCode(periodLabel);
  const seq = String(index + 1).padStart(3, '0');

  const earnings: SalarySlipLineItem[] = [
    {
      id: 'base-sales',
      label: 'Gaji Pokok Sales',
      amount: item.baseSalary,
      note: 'Gaji pokok standar bulanan',
    },
    {
      id: 'inc-sellin',
      label: `Insentif Sell In (${item.incentivePercent}%)`,
      amount: item.incentiveNominal,
      note: `Capaian Sell In ${item.achievementPercent.toFixed(1)}% (${item.tierLabel})`,
    },
  ];

  if (item.baProductivityBonus > 0) {
    const avgNote =
      item.coveredBaCount > 0
        ? ` (${formatRupiahPlain(item.coveredBaTotalSellOut || 0)} ÷ ${item.coveredBaCount} BA = ${formatRupiahPlain(item.baProductivityAverage || 0)}/BA)`
        : '';
    earnings.push({
      id: 'bonus-ba-prod',
      label: 'Bonus Produktivitas BA untuk Sales',
      amount: item.baProductivityBonus,
      note:
        item.baProductivityBonus >= 1000000
          ? `Produktivitas BA ≥ Rp 55 Jt${avgNote}`
          : `Produktivitas BA Rp 45–54 Jt${avgNote}`,
    });
  }

  const deductions: SalarySlipLineItem[] = [];
  if (item.baProductivityPenalty > 0) {
    deductions.push({
      id: 'penalty-ba-prod',
      label: `Denda Produktivitas BA (SP1 × ${item.baProductivitySpCount})`,
      amount: item.baProductivityPenalty,
      note: `${item.baProductivitySpCount} toko BA di bawah Rp 35.000.000`,
    });
  }

  return {
    slipKey,
    employeeKey: item.salesName,
    role: 'sales',
    slipNumber: `SLIP/JMU/SLS/${year}/${month}/${seq}`,
    periodLabel,
    printDate: getTodayIso(),
    employeeName: item.salesName,
    employeeCode: `SLS-${seq}`,
    positionTitle: 'Sales Representative',
    areaOrStore: item.coverArea || '-',
    spvOrRegion: `SPV: ${item.spv || '-'} | ${item.coveredBaCount} BA Dicover`,
    paymentMethod: 'Transfer Bank Payroll',
    earnings,
    deductions,
    notes:
      item.baProductivitySpCount > 0
        ? `Catatan: Terdapat ${item.baProductivitySpCount} BA binaan dengan sell out < Rp 35 Jt (SP1).`
        : 'Perhitungan gaji sesuai realisasi Sell In & produktivitas BA area.',
    isCustomEdited: false,
  };
}

export function buildSlipFromSales(
  item: SalesSalaryItem,
  periodLabel: string,
  index: number = 0
): SalarySlipData {
  const def = buildDefaultSlipFromSales(item, periodLabel, index);
  const override = getSlipOverride(def.slipKey);
  return override ? { ...override, isCustomEdited: true } : def;
}

export function buildDefaultSlipFromBa(
  item: BaSalaryItem,
  periodLabel: string,
  index: number = 0
): SalarySlipData {
  const empKey = `${item.baName}__${item.storeName}`;
  const slipKey = makeSlipKey('ba', empKey, periodLabel);
  const year = getYearCode(periodLabel);
  const month = getPeriodCode(periodLabel);
  const seq = String(index + 1).padStart(3, '0');

  const earnings: SalarySlipLineItem[] = [
    {
      id: 'base-ba',
      label: 'Gaji Pokok Beauty Advisor (Non-Lavojoy)',
      amount: item.baseSalary,
      note: `${item.tierLabel} (${item.achievementNonLavojoyPercent.toFixed(1)}%)`,
    },
    {
      id: 'inc-non-lavojoy',
      label: `Insentif Sell Out Non-Lavojoy (${item.incentiveNonLavojoyPercent}%)`,
      amount: item.incentiveNonLavojoyNominal,
      note: `Capaian Non-Lavojoy ${item.achievementNonLavojoyPercent.toFixed(1)}%`,
    },
    {
      id: 'inc-lavojoy',
      label: `Insentif Khusus Brand Lavojoy (${item.incentiveLavojoyPercent}%)`,
      amount: item.incentiveLavojoyNominal,
      note: item.isLavojoyTargetMet
        ? `Target Lavojoy tercapai (${item.achievementLavojoyPercent.toFixed(1)}%)`
        : `Belum mencapai 100% (${item.achievementLavojoyPercent.toFixed(1)}%)`,
    },
  ];

  if ((item.focusIncentive || 0) > 0) {
    earnings.push({
      id: 'inc-focus-ba',
      label: 'Insentif Produk Fokus BA',
      amount: item.focusIncentive || 0,
      note: `Realisasi ${item.focusActualPcs || 0} / ${item.focusTargetPcs || 0} pcs`,
    });
  }

  const deductions: SalarySlipLineItem[] = [];
  if ((item.focusPenalty || 0) > 0) {
    deductions.push({
      id: 'pen-focus-ba',
      label: 'Denda Kekurangan Produk Fokus BA',
      amount: item.focusPenalty || 0,
      note: `Realisasi ${item.focusActualPcs || 0} / ${item.focusTargetPcs || 0} pcs (< 70%)`,
    });
  }

  return {
    slipKey,
    employeeKey: empKey,
    role: 'ba',
    slipNumber: `SLIP/JMU/BA/${year}/${month}/${seq}`,
    periodLabel,
    printDate: getTodayIso(),
    employeeName: item.baName,
    employeeCode: item.baNumber && item.baNumber !== '-' ? item.baNumber : `BA-${seq}`,
    positionTitle: 'Beauty Advisor (BA Toko)',
    areaOrStore: `${item.storeName} (${item.coverArea})`,
    spvOrRegion: `Sales Cover: ${item.salesName || '-'} | Region: ${item.region || '-'}`,
    paymentMethod: 'Transfer Bank Payroll',
    earnings,
    deductions,
    notes: 'Perhitungan gaji 1 BA Multi-Brand (Non-Lavojoy, Lavojoy 4% & Produk Fokus).',
    isCustomEdited: false,
  };
}

export function buildSlipFromBa(
  item: BaSalaryItem,
  periodLabel: string,
  index: number = 0
): SalarySlipData {
  const def = buildDefaultSlipFromBa(item, periodLabel, index);
  const override = getSlipOverride(def.slipKey);
  return override ? { ...override, isCustomEdited: true } : def;
}

export function buildDefaultSlipFromTrainer(
  item: TrainerSalaryItem,
  periodLabel: string,
  index: number = 0
): SalarySlipData {
  const activePeriod = item.monthPeriod || periodLabel;
  const slipKey = makeSlipKey('trainer', item.trainerName, activePeriod);
  const year = getYearCode(activePeriod);
  const month = getPeriodCode(activePeriod);
  const seq = String(index + 1).padStart(3, '0');

  const earnings: SalarySlipLineItem[] = [
    {
      id: 'base-trn',
      label: 'Gaji Pokok Trainer',
      amount: item.baseSalary,
      note: 'Gaji pokok standar bulanan',
    },
    {
      id: 'trans-trn',
      label: 'Tunjangan Transportasi Trainer',
      amount: item.transportAllowance,
      note: 'Tunjangan operasional & kunjungan lapangan',
    },
    {
      id: 'kpi-trn',
      label: 'Insentif Pencapaian Poin KPI Trainer',
      amount: item.kpiIncentive,
      note: `Skor KPI: ${item.kpiScore ?? 85} Poin (${activePeriod})`,
    },
    {
      id: 'focus-trn',
      label: 'Insentif Pencapaian Produk Fokus',
      amount: item.focusIncentive,
      note: `Realisasi ${item.focusActualPcs} / ${item.focusTargetPcs} pcs (${item.focusAchievementPct.toFixed(1)}%)`,
    },
  ];

  const deductions: SalarySlipLineItem[] = [];
  if (item.kpiPenalty > 0) {
    deductions.push({
      id: 'pen-kpi-trn',
      label: 'Denda & Sanksi SP1 Poin KPI (< 70 Poin)',
      amount: item.kpiPenalty,
      note: `Skor KPI ${item.kpiScore ?? 0} Poin`,
    });
  }
  if (item.focusPenalty > 0) {
    deductions.push({
      id: 'pen-focus-trn',
      label: 'Denda & Sanksi SP1 Produk Fokus (< 70%)',
      amount: item.focusPenalty,
      note: `Capaian ${item.focusAchievementPct.toFixed(1)}%`,
    });
  }

  return {
    slipKey,
    employeeKey: item.trainerName,
    role: 'trainer',
    slipNumber: `SLIP/JMU/TRN/${year}/${month}/${seq}`,
    periodLabel: activePeriod,
    printDate: getTodayIso(),
    employeeName: item.trainerName,
    employeeCode: `TRN-${seq}`,
    positionTitle: 'Trainer Area',
    areaOrStore: item.areaCovered || '-',
    spvOrRegion: `Region: ${item.region || '-'}`,
    paymentMethod: 'Transfer Bank Payroll',
    earnings,
    deductions,
    notes: item.notes || 'Perhitungan gaji Trainer meliputi Pokok, Transport, Produk Fokus & Poin KPI.',
    isCustomEdited: false,
  };
}

export function buildSlipFromTrainer(
  item: TrainerSalaryItem,
  periodLabel: string,
  index: number = 0
): SalarySlipData {
  const def = buildDefaultSlipFromTrainer(item, periodLabel, index);
  const override = getSlipOverride(def.slipKey);
  return override ? { ...override, isCustomEdited: true } : def;
}

export function computeSlipTotals(slip: SalarySlipData) {
  const totalEarnings = slip.earnings.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalDeductions = slip.deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const netSalary = totalEarnings - totalDeductions;
  return {
    totalEarnings,
    totalDeductions,
    netSalary,
  };
}

export function formatRupiahPlain(val: number): string {
  const abs = Math.abs(Math.round(val || 0));
  const formatted = abs.toLocaleString('id-ID');
  return val < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatTanggalIndo(dateIso: string): string {
  if (!dateIso) return '-';
  const parts = dateIso.split('-');
  if (parts.length !== 3) return dateIso;
  const [y, m, d] = parts;
  const bulanIndo = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  const dayNum = parseInt(d, 10);
  if (monthIdx < 0 || monthIdx > 11 || isNaN(dayNum)) return dateIso;
  return `${dayNum} ${bulanIndo[monthIdx]} ${y}`;
}

function terbilangCore(n: number): string {
  const satuan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];
  const num = Math.floor(Math.abs(n));
  if (num < 12) return satuan[num];
  if (num < 20) return `${terbilangCore(num - 10)} Belas`;
  if (num < 100) {
    return `${terbilangCore(Math.floor(num / 10))} Puluh ${terbilangCore(num % 10)}`.trim();
  }
  if (num < 200) return `Seratus ${terbilangCore(num - 100)}`.trim();
  if (num < 1000) {
    return `${terbilangCore(Math.floor(num / 100))} Ratus ${terbilangCore(num % 100)}`.trim();
  }
  if (num < 2000) return `Seribu ${terbilangCore(num - 1000)}`.trim();
  if (num < 1000000) {
    return `${terbilangCore(Math.floor(num / 1000))} Ribu ${terbilangCore(num % 1000)}`.trim();
  }
  if (num < 1000000000) {
    return `${terbilangCore(Math.floor(num / 1000000))} Juta ${terbilangCore(num % 1000000)}`.trim();
  }
  if (num < 1000000000000) {
    return `${terbilangCore(Math.floor(num / 1000000000))} Milyar ${terbilangCore(num % 1000000000)}`.trim();
  }
  return `${terbilangCore(Math.floor(num / 1000000000000))} Triliun ${terbilangCore(
    num % 1000000000000
  )}`.trim();
}

export function terbilangRupiah(amount: number): string {
  const rounded = Math.round(amount || 0);
  if (rounded === 0) return 'Nol Rupiah';
  const prefix = rounded < 0 ? 'Minus ' : '';
  const words = terbilangCore(Math.abs(rounded)).replace(/\s+/g, ' ').trim();
  return `${prefix}${words} Rupiah`;
}

function renderSingleSlipPage(
  doc: jsPDF,
  slip: SalarySlipData,
  kop: SalarySlipCompanyHeader
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let y = 14;

  // ================================================================
  // 1. KOP SURAT RESMI PT JALUR MANDIRI UTAMA
  // ================================================================
  // Monogram Corporate Badge on Left
  const badgeSize = 18;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginX, y, badgeSize, badgeSize, 2.5, 2.5, 'F');
  doc.setDrawColor(99, 102, 241); // indigo-500 inner accent
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX + 1.2, y + 1.2, badgeSize - 2.4, badgeSize - 2.4, 1.8, 1.8, 'S');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(kop.logoMonogram || 'JMU', marginX + badgeSize / 2, y + 11.2, { align: 'center' });

  // Letterhead text centered slightly offset to respect badge, or full center
  const textCenterX = pageWidth / 2 + 6;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text((kop.companyName || 'PT JALUR MANDIRI UTAMA').toUpperCase(), textCenterX, y + 5.5, {
    align: 'center',
    maxWidth: contentWidth - badgeSize - 8,
  });

  if (kop.tagline) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(kop.tagline.toUpperCase(), textCenterX, y + 10.2, {
      align: 'center',
      maxWidth: contentWidth - badgeSize - 8,
    });
  }

  if (kop.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    doc.text(kop.address, textCenterX, y + 14.5, {
      align: 'center',
      maxWidth: contentWidth - badgeSize - 8,
    });
  }

  const contactParts = [kop.contactLine, kop.divisionLine].filter(Boolean).join('  ·  ');
  if (contactParts) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(100, 116, 139);
    doc.text(contactParts, textCenterX, y + 18.5, {
      align: 'center',
      maxWidth: contentWidth - badgeSize - 8,
    });
  }

  y += 22.5;
  // Double official Kop Surat line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.95);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 1.3, pageWidth - marginX, y + 1.3);

  y += 8;

  // ================================================================
  // 2. JUDUL SLIP GAJI & NOMOR REFERENSI
  // ================================================================
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('SLIP GAJI KARYAWAN', pageWidth / 2, y, { align: 'center' });

  // Subtle underline under title
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 26, y + 1.4, pageWidth / 2 + 26, y + 1.4);

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `No. Slip: ${slip.slipNumber}   |   Periode Gaji: ${slip.periodLabel}`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  y += 6;

  // ================================================================
  // 3. IDENTITAS KARYAWAN (2-KOLOM TERSTRUKTUR)
  // ================================================================
  const infoBoxHeight = 25;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentWidth, infoBoxHeight, 2, 2, 'FD');

  const leftLabelX = marginX + 4;
  const leftValX = marginX + 34;
  const rightLabelX = marginX + contentWidth / 2 + 4;
  const rightValX = marginX + contentWidth / 2 + 34;

  const drawInfoRow = (
    lx: number,
    vx: number,
    rowY: number,
    label: string,
    val: string,
    boldVal = false
  ) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, lx, rowY);
    doc.text(':', vx - 3, rowY);
    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val || '-', vx, rowY, { maxWidth: contentWidth / 2 - 38 });
  };

  drawInfoRow(leftLabelX, leftValX, y + 6.5, 'Nama Karyawan', slip.employeeName, true);
  drawInfoRow(leftLabelX, leftValX, y + 13, 'Jabatan / Posisi', slip.positionTitle, false);
  drawInfoRow(leftLabelX, leftValX, y + 19.5, 'ID / Kode', slip.employeeCode, false);

  drawInfoRow(rightLabelX, rightValX, y + 6.5, 'Area / Toko', slip.areaOrStore, true);
  drawInfoRow(rightLabelX, rightValX, y + 13, 'Keterangan', slip.spvOrRegion, false);
  drawInfoRow(
    rightLabelX,
    rightValX,
    y + 19.5,
    'Tgl Cetak / Metode',
    `${formatTanggalIndo(slip.printDate)} · ${slip.paymentMethod}`,
    false
  );

  y += infoBoxHeight + 7;

  const totals = computeSlipTotals(slip);

  // ================================================================
  // 4. TABEL A: PENERIMAAN (PENDAPATAN)
  // ================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('A. RINCIAN PENERIMAAN (PENDAPATAN)', marginX, y);
  y += 2.5;

  const earningRows =
    slip.earnings.length > 0
      ? slip.earnings.map((item, idx) => [
          String(idx + 1),
          item.label,
          item.note || '-',
          formatRupiahPlain(item.amount),
        ])
      : [['1', 'Tidak ada komponen penerimaan', '-', 'Rp 0']];

  autoTable(doc, {
    startY: y,
    head: [['No', 'Komponen Penerimaan', 'Keterangan', 'Nominal (IDR)']],
    body: earningRows,
    foot: [['', 'TOTAL PENERIMAAN (A)', '', formatRupiahPlain(totals.totalEarnings)]],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    footStyles: {
      fillColor: [236, 253, 245], // emerald-50
      textColor: [6, 95, 70], // emerald-800
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 64, fontStyle: 'bold' },
      2: { cellWidth: 'auto', textColor: [100, 116, 139] },
      3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 7;

  // ================================================================
  // 5. TABEL B: POTONGAN / DENDA
  // ================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('B. RINCIAN POTONGAN & DENDA', marginX, y);
  y += 2.5;

  const deductionRows =
    slip.deductions.length > 0
      ? slip.deductions.map((item, idx) => [
          String(idx + 1),
          item.label,
          item.note || '-',
          formatRupiahPlain(item.amount),
        ])
      : [['-', 'Tidak ada potongan / denda pada periode ini', 'Status Aman', 'Rp 0']];

  autoTable(doc, {
    startY: y,
    head: [['No', 'Komponen Potongan / Denda', 'Keterangan', 'Nominal (IDR)']],
    body: deductionRows,
    foot: [['', 'TOTAL POTONGAN (B)', '', formatRupiahPlain(totals.totalDeductions)]],
    theme: 'grid',
    headStyles: {
      fillColor: [100, 116, 139], // slate-500
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2.5,
    },
    footStyles: {
      fillColor: [255, 241, 242], // rose-50
      textColor: [159, 18, 57], // rose-800
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 64, fontStyle: 'bold' },
      2: { cellWidth: 'auto', textColor: [100, 116, 139] },
      3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y + 25) + 7;

  // ================================================================
  // 6. HIGHLIGHTED TAKE HOME PAY & TERBILANG
  // ================================================================
  const thpBoxHeight = 20;
  doc.setFillColor(15, 23, 42); // navy slate-900
  doc.roundedRect(marginX, y, contentWidth, thpBoxHeight, 2.2, 2.2, 'F');

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL GAJI BERSIH DITERIMA (TAKE HOME PAY = A - B)', marginX + 5, y + 6.8);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(formatRupiahPlain(totals.netSalary), pageWidth - marginX - 5, y + 8, {
    align: 'right',
  });

  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.25);
  doc.line(marginX + 5, y + 11.2, pageWidth - marginX - 5, y + 11.2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(165, 243, 252); // cyan-200
  doc.text(`Terbilang: # ${terbilangRupiah(totals.netSalary)} #`, marginX + 5, y + 16.5, {
    maxWidth: contentWidth - 10,
  });

  y += thpBoxHeight + 5;

  // Optional Notes
  if (slip.notes && slip.notes.trim()) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, 11, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Catatan:', marginX + 3.5, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(slip.notes.trim(), marginX + 18, y + 4.5, { maxWidth: contentWidth - 22 });
    y += 16;
  } else {
    y += 4;
  }

  // Ensure signature block stays well inside page
  if (y > pageHeight - 54) {
    doc.addPage();
    y = 24;
  }

  // ================================================================
  // 7. BLOK TANDA TANGAN
  // ================================================================
  const sigTopY = Math.max(y + 4, 215);
  const leftSigCenter = marginX + 38;
  const rightSigCenter = pageWidth - marginX - 42;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  // Left: Employee Receiver
  doc.text('Diterima Oleh,', leftSigCenter, sigTopY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Karyawan Bersangkutan', leftSigCenter, sigTopY + 9.5, { align: 'center' });

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(leftSigCenter - 26, sigTopY + 29, leftSigCenter + 26, sigTopY + 29);
  doc.setTextColor(15, 23, 42);
  doc.text(slip.employeeName.toUpperCase(), leftSigCenter, sigTopY + 33.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(slip.positionTitle, leftSigCenter, sigTopY + 37.5, { align: 'center' });

  // Right: PT JALUR MANDIRI UTAMA Finance/HRD
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `${kop.city || 'Pekanbaru'}, ${formatTanggalIndo(slip.printDate)}`,
    rightSigCenter,
    sigTopY,
    { align: 'center' }
  );
  doc.text('Disetujui Oleh,', rightSigCenter, sigTopY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text((kop.companyName || 'PT JALUR MANDIRI UTAMA').toUpperCase(), rightSigCenter, sigTopY + 9.5, {
    align: 'center',
  });

  doc.setDrawColor(148, 163, 184);
  doc.line(rightSigCenter - 28, sigTopY + 29, rightSigCenter + 28, sigTopY + 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text((kop.signerName || 'HRD & FINANCE').toUpperCase(), rightSigCenter, sigTopY + 33.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(kop.signerTitle || 'HRD & Finance Manager', rightSigCenter, sigTopY + 37.5, {
    align: 'center',
  });

  // ================================================================
  // 8. FOOTER RESMI
  // ================================================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    kop.footerNote ||
      'Dokumen slip gaji ini diterbitkan secara resmi oleh PT JALUR MANDIRI UTAMA.',
    pageWidth / 2,
    pageHeight - 9.5,
    { align: 'center', maxWidth: contentWidth }
  );
}

export function downloadSalarySlipPdf(
  slip: SalarySlipData,
  kop: SalarySlipCompanyHeader
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  renderSingleSlipPage(doc, slip, kop);

  const safeName = slip.employeeName
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safePeriod = slip.periodLabel
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  doc.save(`Slip_Gaji_${safeName}_${safePeriod}.pdf`);
}

export function downloadBatchSalarySlipsPdf(
  slips: SalarySlipData[],
  kop: SalarySlipCompanyHeader,
  filename: string
): void {
  if (!slips.length) return;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  slips.forEach((slip, idx) => {
    if (idx > 0) {
      doc.addPage();
    }
    renderSingleSlipPage(doc, slip, kop);
  });

  doc.save(filename);
}
