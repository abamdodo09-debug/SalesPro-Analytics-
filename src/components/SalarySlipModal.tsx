import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileDown,
  Save,
  RotateCcw,
  Building2,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import {
  SalarySlipCompanyHeader,
  SalarySlipData,
  SalarySlipLineItem,
  computeSlipTotals,
  formatRupiahPlain,
  formatTanggalIndo,
  terbilangRupiah,
  saveCompanyHeader,
  resetCompanyHeader,
  saveSlipOverride,
  deleteSlipOverride,
  downloadSalarySlipPdf,
} from '../services/salarySlipService';

interface SalarySlipModalProps {
  isOpen: boolean;
  initialTab?: 'slip' | 'kop';
  initialSlip: SalarySlipData | null;
  defaultSlip?: SalarySlipData | null;
  companyHeader: SalarySlipCompanyHeader;
  onCompanyHeaderSaved: (updated: SalarySlipCompanyHeader) => void;
  onSlipSaved?: () => void;
  onClose: () => void;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({
  isOpen,
  initialTab = 'slip',
  initialSlip,
  defaultSlip,
  companyHeader,
  onCompanyHeaderSaved,
  onSlipSaved,
  onClose,
}) => {
  const [activeMode, setActiveMode] = useState<'slip' | 'kop'>(
    initialSlip ? initialTab : 'kop'
  );
  const [kopForm, setKopForm] = useState<SalarySlipCompanyHeader>(companyHeader);
  const [slipForm, setSlipForm] = useState<SalarySlipData | null>(initialSlip);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setKopForm(companyHeader);
      setSlipForm(initialSlip ? JSON.parse(JSON.stringify(initialSlip)) : null);
      setActiveMode(initialSlip ? initialTab : 'kop');
      setFeedbackMsg(null);
    }
  }, [isOpen, initialTab, initialSlip, companyHeader]);

  const totals = useMemo(() => {
    if (!slipForm) return { totalEarnings: 0, totalDeductions: 0, netSalary: 0 };
    return computeSlipTotals(slipForm);
  }, [slipForm]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleSaveKop = () => {
    const saved = saveCompanyHeader(kopForm);
    setKopForm(saved);
    onCompanyHeaderSaved(saved);
    showToast('Kop Slip Gaji PT JALUR MANDIRI UTAMA berhasil disimpan.');
  };

  const handleResetKop = () => {
    const def = resetCompanyHeader();
    setKopForm(def);
    onCompanyHeaderSaved(def);
    showToast('Kop Slip Gaji dikembalikan ke setelan standar PT JALUR MANDIRI UTAMA.');
  };

  const handleSaveSlip = () => {
    if (!slipForm) return;
    const saved = saveSlipOverride(slipForm);
    setSlipForm(saved);
    // Also persist Kop if modified together
    const savedKop = saveCompanyHeader(kopForm);
    onCompanyHeaderSaved(savedKop);
    onSlipSaved?.();
    showToast(`Perubahan slip gaji ${slipForm.employeeName} berhasil disimpan.`);
  };

  const handleResetSlipToSystem = () => {
    if (!slipForm || !defaultSlip) return;
    deleteSlipOverride(slipForm.slipKey);
    const cloned: SalarySlipData = JSON.parse(JSON.stringify(defaultSlip));
    cloned.isCustomEdited = false;
    setSlipForm(cloned);
    onSlipSaved?.();
    showToast('Slip gaji dikembalikan ke perhitungan otomatis sistem.');
  };

  const handleDownloadPdf = () => {
    if (!slipForm) return;
    const savedKop = saveCompanyHeader(kopForm);
    onCompanyHeaderSaved(savedKop);
    downloadSalarySlipPdf(slipForm, savedKop);
    showToast(`Slip gaji PDF (${slipForm.employeeName}) berhasil diunduh.`);
  };

  const updateLineItem = (
    section: 'earnings' | 'deductions',
    id: string,
    patch: Partial<SalarySlipLineItem>
  ) => {
    if (!slipForm) return;
    setSlipForm({
      ...slipForm,
      [section]: slipForm[section].map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    });
  };

  const addLineItem = (section: 'earnings' | 'deductions') => {
    if (!slipForm) return;
    const newItem: SalarySlipLineItem = {
      id: `${section}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: section === 'earnings' ? 'Tambahan Tunjangan / Bonus' : 'Potongan Tambahan',
      amount: 0,
      note: '',
    };
    setSlipForm({
      ...slipForm,
      [section]: [...slipForm[section], newItem],
    });
  };

  const removeLineItem = (section: 'earnings' | 'deductions', id: string) => {
    if (!slipForm) return;
    setSlipForm({
      ...slipForm,
      [section]: slipForm[section].filter((row) => row.id !== id),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-50 rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Slip Gaji Karyawan — {kopForm.companyName || 'PT JALUR MANDIRI UTAMA'}</span>
                {slipForm?.isCustomEdited && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    Custom Edited
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeMode === 'kop'
                  ? 'Sesuaikan kop resmi perusahaan, alamat, dan penanda tangan slip gaji'
                  : 'Edit rincian penerimaan/potongan secara fleksibel lalu unduh PDF resmi'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch between Slip & Kop */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {slipForm && (
                <button
                  type="button"
                  onClick={() => setActiveMode('slip')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeMode === 'slip'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Edit &amp; Preview Slip</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveMode('kop')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeMode === 'kop'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-slate-700" />
                <span>Edit Kop PT JMU</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Toast Banner */}
        {feedbackMsg && (
          <div className="mx-4 sm:mx-6 mt-3 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeMode === 'kop' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Kop Form */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <span>Pengaturan Kop Surat Slip Gaji</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleResetKop}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Standar</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  <div className="col-span-3">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Nama Perusahaan (Kop Utama)
                    </label>
                    <input
                      type="text"
                      value={kopForm.companyName}
                      onChange={(e) => setKopForm({ ...kopForm, companyName: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      placeholder="PT JALUR MANDIRI UTAMA"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Monogram
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={kopForm.logoMonogram}
                      onChange={(e) =>
                        setKopForm({ ...kopForm, logoMonogram: e.target.value.toUpperCase() })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-black text-center rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      placeholder="JMU"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Sub-Judul / Bidang Usaha
                  </label>
                  <input
                    type="text"
                    value={kopForm.tagline}
                    onChange={(e) => setKopForm({ ...kopForm, tagline: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="DISTRIBUTOR RESMI PRODUK KOSMETIK & PERAWATAN TUBUH"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Alamat Kantor
                  </label>
                  <input
                    type="text"
                    value={kopForm.address}
                    onChange={(e) => setKopForm({ ...kopForm, address: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="Jl. Jend. Sudirman, Pekanbaru — Provinsi Riau"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Telepon &amp; Email Kantor
                  </label>
                  <input
                    type="text"
                    value={kopForm.contactLine}
                    onChange={(e) => setKopForm({ ...kopForm, contactLine: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Divisi / Keterangan Kop Tambahan
                  </label>
                  <input
                    type="text"
                    value={kopForm.divisionLine}
                    onChange={(e) => setKopForm({ ...kopForm, divisionLine: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Kota Cetak
                    </label>
                    <input
                      type="text"
                      value={kopForm.city}
                      onChange={(e) => setKopForm({ ...kopForm, city: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Penanda Tangan
                    </label>
                    <input
                      type="text"
                      value={kopForm.signerName}
                      onChange={(e) => setKopForm({ ...kopForm, signerName: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Jabatan TTD
                    </label>
                    <input
                      type="text"
                      value={kopForm.signerTitle}
                      onChange={(e) => setKopForm({ ...kopForm, signerTitle: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Catatan Kaki (Footer Resmi)
                  </label>
                  <input
                    type="text"
                    value={kopForm.footerNote}
                    onChange={(e) => setKopForm({ ...kopForm, footerNote: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveKop}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Kop Perusahaan</span>
                  </button>
                </div>
              </div>

              {/* Live Preview of Kop */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Pratinjau Kop Resmi Slip Gaji
                </div>

                {/* Kop Surat Visual */}
                <div className="border border-slate-200 rounded-xl p-5 sm:p-6 bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-900 border-2 border-indigo-400/70 text-white flex items-center justify-center font-black text-base tracking-wider shrink-0 shadow-xs">
                      {kopForm.logoMonogram || 'JMU'}
                    </div>
                    <div className="flex-1 text-center">
                      <h2 className="text-lg sm:text-xl font-black tracking-wide text-slate-900 uppercase">
                        {kopForm.companyName || 'PT JALUR MANDIRI UTAMA'}
                      </h2>
                      {kopForm.tagline && (
                        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                          {kopForm.tagline}
                        </p>
                      )}
                      {kopForm.address && (
                        <p className="text-[11px] text-slate-600 mt-0.5">{kopForm.address}</p>
                      )}
                      {(kopForm.contactLine || kopForm.divisionLine) && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {[kopForm.contactLine, kopForm.divisionLine]
                            .filter(Boolean)
                            .join('  ·  ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Official Double Rule */}
                  <div className="mt-4 space-y-0.5">
                    <div className="h-[3px] bg-slate-900 w-full" />
                    <div className="h-[1px] bg-slate-700 w-full" />
                  </div>

                  {/* Mock Signature Preview */}
                  <div className="mt-8 pt-6 border-t border-dashed border-slate-200 flex justify-between items-end text-xs text-slate-600">
                    <div className="text-center w-44">
                      <p>Diterima Oleh,</p>
                      <p className="font-bold text-slate-800">Karyawan Bersangkutan</p>
                      <div className="h-12" />
                      <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">
                        ( NAMA KARYAWAN )
                      </div>
                    </div>
                    <div className="text-center w-52">
                      <p>{kopForm.city || 'Pekanbaru'}, {formatTanggalIndo(new Date().toISOString().slice(0, 10))}</p>
                      <p>Disetujui Oleh,</p>
                      <p className="font-bold text-slate-900 uppercase">
                        {kopForm.companyName || 'PT JALUR MANDIRI UTAMA'}
                      </p>
                      <div className="h-10" />
                      <div className="border-t border-slate-400 pt-1">
                        <p className="font-extrabold text-slate-900 uppercase">
                          {kopForm.signerName || 'HRD & FINANCE'}
                        </p>
                        <p className="text-[10px] text-slate-500">{kopForm.signerTitle}</p>
                      </div>
                    </div>
                  </div>

                  {kopForm.footerNote && (
                    <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[10px] italic text-slate-400">
                      {kopForm.footerNote}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : slipForm ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT: SLIP EDITOR FORM */}
              <div className="lg:col-span-5 space-y-4">
                {/* Identity Editor Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                      1. Identitas &amp; Periode Slip Gaji
                    </h4>
                    {defaultSlip && (
                      <button
                        type="button"
                        onClick={handleResetSlipToSystem}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                        title="Kembalikan angka ke perhitungan sistem"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Sistem</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Nomor Slip
                      </label>
                      <input
                        type="text"
                        value={slipForm.slipNumber}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, slipNumber: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Periode Bulan
                      </label>
                      <input
                        type="text"
                        value={slipForm.periodLabel}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, periodLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Nama Karyawan
                      </label>
                      <input
                        type="text"
                        value={slipForm.employeeName}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, employeeName: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        ID / Kode Karyawan
                      </label>
                      <input
                        type="text"
                        value={slipForm.employeeCode}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, employeeCode: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Jabatan / Posisi
                      </label>
                      <input
                        type="text"
                        value={slipForm.positionTitle}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, positionTitle: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Tanggal Cetak
                      </label>
                      <input
                        type="date"
                        value={slipForm.printDate}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, printDate: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                      Area / Nama Toko
                    </label>
                    <input
                      type="text"
                      value={slipForm.areaOrStore}
                      onChange={(e) =>
                        setSlipForm({ ...slipForm, areaOrStore: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Keterangan / SPV / Region
                      </label>
                      <input
                        type="text"
                        value={slipForm.spvOrRegion}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, spvOrRegion: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                        Metode Pembayaran
                      </label>
                      <input
                        type="text"
                        value={slipForm.paymentMethod}
                        onChange={(e) =>
                          setSlipForm({ ...slipForm, paymentMethod: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Earnings Editor Card */}
                <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                    <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wide">
                      2. Komponen Penerimaan (A)
                    </h4>
                    <button
                      type="button"
                      onClick={() => addLineItem('earnings')}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Item</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {slipForm.earnings.map((row) => (
                      <div
                        key={row.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) =>
                              updateLineItem('earnings', row.id, { label: e.target.value })
                            }
                            placeholder="Nama komponen penerimaan"
                            className="flex-1 px-2 py-1 text-xs font-bold rounded-md border border-slate-300 bg-white"
                          />
                          <input
                            type="number"
                            step="any"
                            value={row.amount}
                            onChange={(e) =>
                              updateLineItem('earnings', row.id, {
                                amount: Number(e.target.value) || 0,
                              })
                            }
                            className="w-32 px-2 py-1 text-xs font-mono font-bold text-right rounded-md border border-slate-300 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => removeLineItem('earnings', row.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={row.note || ''}
                          onChange={(e) =>
                            updateLineItem('earnings', row.id, { note: e.target.value })
                          }
                          placeholder="Keterangan opsional..."
                          className="w-full px-2 py-1 text-[11px] rounded-md border border-slate-200 bg-white text-slate-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deductions Editor Card */}
                <div className="bg-white rounded-2xl border border-rose-200 p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                    <h4 className="text-xs font-extrabold text-rose-900 uppercase tracking-wide">
                      3. Komponen Potongan &amp; Denda (B)
                    </h4>
                    <button
                      type="button"
                      onClick={() => addLineItem('deductions')}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Potongan</span>
                    </button>
                  </div>

                  {slipForm.deductions.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic py-1">
                      Belum ada potongan. Klik &quot;Tambah Potongan&quot; jika ada denda/kasbon.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {slipForm.deductions.map((row) => (
                        <div
                          key={row.id}
                          className="p-2.5 rounded-xl bg-rose-50/40 border border-rose-200 space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={row.label}
                              onChange={(e) =>
                                updateLineItem('deductions', row.id, { label: e.target.value })
                              }
                              placeholder="Nama potongan / denda"
                              className="flex-1 px-2 py-1 text-xs font-bold rounded-md border border-slate-300 bg-white"
                            />
                            <input
                              type="number"
                              step="any"
                              value={row.amount}
                              onChange={(e) =>
                                updateLineItem('deductions', row.id, {
                                  amount: Number(e.target.value) || 0,
                                })
                              }
                              className="w-32 px-2 py-1 text-xs font-mono font-bold text-right rounded-md border border-slate-300 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => removeLineItem('deductions', row.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={row.note || ''}
                            onChange={(e) =>
                              updateLineItem('deductions', row.id, { note: e.target.value })
                            }
                            placeholder="Keterangan potongan..."
                            className="w-full px-2 py-1 text-[11px] rounded-md border border-slate-200 bg-white text-slate-600"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1">
                    <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                      Catatan Slip Gaji
                    </label>
                    <textarea
                      rows={2}
                      value={slipForm.notes}
                      onChange={(e) => setSlipForm({ ...slipForm, notes: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      placeholder="Catatan tambahan..."
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT: LIVE WYSIWYG PAPER PREVIEW */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-5 sm:p-7 space-y-5 text-slate-900">
                  {/* KOP SURAT PT JALUR MANDIRI UTAMA */}
                  <div>
                    <div className="flex items-center gap-4">
                      <div className="w-13 h-13 rounded-xl bg-slate-900 border-2 border-indigo-400/70 text-white flex items-center justify-center font-black text-sm tracking-wider shrink-0">
                        {kopForm.logoMonogram || 'JMU'}
                      </div>
                      <div className="flex-1 text-center">
                        <h2 className="text-base sm:text-lg font-black tracking-wide text-slate-900 uppercase">
                          {kopForm.companyName || 'PT JALUR MANDIRI UTAMA'}
                        </h2>
                        {kopForm.tagline && (
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                            {kopForm.tagline}
                          </p>
                        )}
                        {kopForm.address && (
                          <p className="text-[10px] text-slate-600 mt-0.5">{kopForm.address}</p>
                        )}
                        {(kopForm.contactLine || kopForm.divisionLine) && (
                          <p className="text-[9.5px] text-slate-500 mt-0.5">
                            {[kopForm.contactLine, kopForm.divisionLine]
                              .filter(Boolean)
                              .join('  ·  ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 space-y-0.5">
                      <div className="h-[3px] bg-slate-900 w-full" />
                      <div className="h-[1px] bg-slate-700 w-full" />
                    </div>
                  </div>

                  {/* JUDUL SLIP */}
                  <div className="text-center">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 inline-block border-b-2 border-indigo-600 pb-0.5">
                      SLIP GAJI KARYAWAN
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-1">
                      No: {slipForm.slipNumber} &nbsp;|&nbsp; Periode:{' '}
                      <strong className="text-slate-800">{slipForm.periodLabel}</strong>
                    </p>
                  </div>

                  {/* IDENTITAS KARYAWAN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">Nama</span>
                      <span className="font-extrabold text-slate-900">: {slipForm.employeeName}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">Area / Toko</span>
                      <span className="font-bold text-slate-800 truncate">: {slipForm.areaOrStore}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">Jabatan</span>
                      <span className="text-slate-800">: {slipForm.positionTitle}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">Keterangan</span>
                      <span className="text-slate-700 truncate">: {slipForm.spvOrRegion}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">ID / Kode</span>
                      <span className="font-mono text-slate-800">: {slipForm.employeeCode}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-24 shrink-0">Tgl / Metode</span>
                      <span className="text-slate-700">
                        : {formatTanggalIndo(slipForm.printDate)} ({slipForm.paymentMethod})
                      </span>
                    </div>
                  </div>

                  {/* TABEL PENERIMAAN */}
                  <div>
                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                      A. Rincian Penerimaan (Pendapatan)
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px]">
                            <th className="py-1.5 px-2.5 text-center w-9">No</th>
                            <th className="py-1.5 px-2.5 text-left">Komponen Penerimaan</th>
                            <th className="py-1.5 px-2.5 text-left">Keterangan</th>
                            <th className="py-1.5 px-2.5 text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {slipForm.earnings.map((row, idx) => (
                            <tr key={row.id}>
                              <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold text-slate-800">{row.label}</td>
                              <td className="py-1.5 px-2.5 text-slate-500 text-[11px]">
                                {row.note || '-'}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                                {formatRupiahPlain(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50 text-emerald-900 font-black border-t border-emerald-200">
                            <td colSpan={3} className="py-2 px-2.5 text-right">
                              TOTAL PENERIMAAN (A)
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                              {formatRupiahPlain(totals.totalEarnings)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* TABEL POTONGAN */}
                  <div>
                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-wide mb-1.5">
                      B. Rincian Potongan &amp; Denda
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-600 text-white text-[11px]">
                            <th className="py-1.5 px-2.5 text-center w-9">No</th>
                            <th className="py-1.5 px-2.5 text-left">Komponen Potongan</th>
                            <th className="py-1.5 px-2.5 text-left">Keterangan</th>
                            <th className="py-1.5 px-2.5 text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {slipForm.deductions.length === 0 ? (
                            <tr>
                              <td className="py-1.5 px-2.5 text-center text-slate-400">-</td>
                              <td className="py-1.5 px-2.5 text-slate-500">
                                Tidak ada potongan / denda
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-400 text-[11px]">Status Aman</td>
                              <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-slate-600">
                                Rp 0
                              </td>
                            </tr>
                          ) : (
                            slipForm.deductions.map((row, idx) => (
                              <tr key={row.id}>
                                <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-1.5 px-2.5 font-bold text-rose-800">
                                  {row.label}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-500 text-[11px]">
                                  {row.note || '-'}
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-rose-700">
                                  {formatRupiahPlain(row.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-rose-50 text-rose-900 font-black border-t border-rose-200">
                            <td colSpan={3} className="py-2 px-2.5 text-right">
                              TOTAL POTONGAN (B)
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                              {formatRupiahPlain(totals.totalDeductions)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* HIGHLIGHT TAKE HOME PAY */}
                  <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        Total Gaji Bersih Diterima (Take Home Pay = A - B)
                      </span>
                      <span className="text-xl font-black font-mono tabular-nums text-white">
                        {formatRupiahPlain(totals.netSalary)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-700 text-[11px] italic text-cyan-200">
                      Terbilang: # {terbilangRupiah(totals.netSalary)} #
                    </div>
                  </div>

                  {slipForm.notes && slipForm.notes.trim() && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                      <strong className="text-slate-800">Catatan:</strong> {slipForm.notes}
                    </div>
                  )}

                  {/* TANDA TANGAN */}
                  <div className="pt-4 flex justify-between items-end text-xs text-slate-600">
                    <div className="text-center w-40">
                      <p>Diterima Oleh,</p>
                      <p className="font-bold text-slate-800">Karyawan Bersangkutan</p>
                      <div className="h-10" />
                      <div className="border-t border-slate-400 pt-1">
                        <p className="font-bold text-slate-900 uppercase">
                          {slipForm.employeeName}
                        </p>
                        <p className="text-[10px] text-slate-500">{slipForm.positionTitle}</p>
                      </div>
                    </div>

                    <div className="text-center w-48">
                      <p>
                        {kopForm.city || 'Pekanbaru'}, {formatTanggalIndo(slipForm.printDate)}
                      </p>
                      <p>Disetujui Oleh,</p>
                      <p className="font-bold text-slate-900 uppercase">
                        {kopForm.companyName || 'PT JALUR MANDIRI UTAMA'}
                      </p>
                      <div className="h-8" />
                      <div className="border-t border-slate-400 pt-1">
                        <p className="font-extrabold text-slate-900 uppercase">
                          {kopForm.signerName || 'HRD & FINANCE'}
                        </p>
                        <p className="text-[10px] text-slate-500">{kopForm.signerTitle}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Sticky Bottom Footer Actions */}
        <div className="bg-white px-4 sm:px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {activeMode === 'slip' && slipForm ? (
              <span>
                Take Home Pay:{' '}
                <strong className="font-mono text-slate-900 font-black">
                  {formatRupiahPlain(totals.netSalary)}
                </strong>
              </span>
            ) : (
              <span>Kop resmi ini akan tampil pada semua slip gaji PDF yang diunduh.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Tutup
            </button>

            {activeMode === 'kop' ? (
              <button
                type="button"
                onClick={handleSaveKop}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Kop PT JMU</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveSlip}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Edit Slip</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download Slip Gaji (.PDF)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
