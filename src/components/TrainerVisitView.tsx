import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Crosshair,
  Edit3,
  Eye,
  Filter,
  GraduationCap,
  Image as ImageIcon,
  MapPin,
  Navigation,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Store,
  Trash2,
  Upload,
  X,
  AlertCircle,
  Calendar,
  FileText,
} from 'lucide-react';
import {
  DashboardFilters,
  TrainerVisitName,
  TrainerVisitRecord,
  TransactionRecord,
} from '../types/dashboard';
import {
  captureVideoFrameToDataUrl,
  compressImageFileToDataUrl,
  extractStoreOptions,
  getCurrentFormattedTimestamp,
  getDefaultRunningMonth,
  RIAU_PRESET_LOCATIONS,
} from '../services/salesVisitService';
import {
  aggregateTrainerVisitsRecap,
  deleteTrainerVisit,
  getTrainerMonthOptions,
  loadTrainerVisits,
  saveTrainerVisits,
  TRAINER_VISIT_OPTIONS,
  upsertTrainerVisit,
} from '../services/trainerVisitService';
import {
  SalesVisitLocationPickerMap,
  SalesVisitMapProvider,
  TrainerVisitOverviewMap,
} from './SalesVisitMap';

interface TrainerVisitViewProps {
  records: TransactionRecord[];
  filters: DashboardFilters;
  onNotify?: (message: string, type?: 'success' | 'error') => void;
}

const TRAINER_BADGE_STYLES: Record<TrainerVisitName, string> = {
  ARA: 'bg-purple-50 text-purple-800 border-purple-200',
  RATIH: 'bg-sky-50 text-sky-800 border-sky-200',
};

const TRAINER_ACTIVE_BTN_STYLES: Record<TrainerVisitName, string> = {
  ARA: 'bg-purple-600 text-white border-purple-700 shadow-sm',
  RATIH: 'bg-sky-600 text-white border-sky-700 shadow-sm',
};

export const TrainerVisitView: React.FC<TrainerVisitViewProps> = ({
  records,
  filters,
  onNotify,
}) => {
  const [visits, setVisits] = useState<TrainerVisitRecord[]>(() => loadTrainerVisits());

  const storeOptions = useMemo(() => extractStoreOptions(records), [records]);
  const monthOptions = useMemo(() => getTrainerMonthOptions(visits), [visits]);
  const defaultRunningMonth = useMemo(
    () => getDefaultRunningMonth(filters.BULAN, filters.TAHUN),
    [filters.BULAN, filters.TAHUN]
  );

  // Form states (all mandatory)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState<boolean>(false);
  const [trainerName, setTrainerName] = useState<TrainerVisitName | ''>('');
  const [selfieDataUrl, setSelfieDataUrl] = useState<string>('');
  const [visitTime, setVisitTime] = useState<string>(
    () => getCurrentFormattedTimestamp().display
  );
  const [visitIso, setVisitIso] = useState<string>(
    () => getCurrentFormattedTimestamp().iso
  );
  const [isLiveClock, setIsLiveClock] = useState<boolean>(true);
  const [monthPeriod, setMonthPeriod] = useState<string>(defaultRunningMonth);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | undefined>(
    undefined
  );
  const [notes, setNotes] = useState<string>('');

  // Form helpers
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [showManualCoords, setShowManualCoords] = useState<boolean>(false);
  const [manualLatInput, setManualLatInput] = useState<string>('');
  const [manualLngInput, setManualLngInput] = useState<string>('');

  // Live Camera state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storePickerRef = useRef<HTMLDivElement | null>(null);
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const overviewMapCardRef = useRef<HTMLDivElement | null>(null);

  // Recap & History filters
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterTrainer, setFilterTrainer] = useState<TrainerVisitName | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);
  const [focusedMapVisit, setFocusedMapVisit] = useState<TrainerVisitRecord | null>(
    null
  );
  const [lightboxVisit, setLightboxVisit] = useState<TrainerVisitRecord | null>(null);

  useEffect(() => {
    if (!editingId) {
      setMonthPeriod(defaultRunningMonth);
    }
  }, [defaultRunningMonth, editingId]);

  useEffect(() => {
    if (!isLiveClock || editingId) return;
    const interval = setInterval(() => {
      const now = getCurrentFormattedTimestamp();
      setVisitTime(now.display);
      setVisitIso(now.iso);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLiveClock, editingId]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        storePickerRef.current &&
        !storePickerRef.current.contains(e.target as Node)
      ) {
        setIsStoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Browser tidak mendukung kamera langsung. Silakan gunakan tombol Upload / Kamera HP.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCameraError(
        'Akses kamera ditolak atau tidak tersedia di browser ini. Gunakan tombol Upload / Kamera HP sebagai gantinya.'
      );
    }
  };

  const handleCapturePhotoFromVideo = () => {
    if (!videoRef.current) return;
    try {
      const dataUrl = captureVideoFrameToDataUrl(videoRef.current, 640, 0.75);
      setSelfieDataUrl(dataUrl);
      setFormError(null);
      stopCameraStream();
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error ? err.message : 'Gagal mengambil foto dari kamera.'
      );
    }
  };

  const handleFileUploadSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    try {
      const compressed = await compressImageFileToDataUrl(file, 640, 0.74);
      setSelfieDataUrl(compressed);
      setFormError(null);
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error ? err.message : 'Gagal memproses file foto selfie.'
      );
    }
    e.target.value = '';
  };

  const applyCoordinates = (
    nextLat: number,
    nextLng: number,
    customLabel?: string,
    accuracy?: number
  ) => {
    const fixedLat = Number(nextLat.toFixed(6));
    const fixedLng = Number(nextLng.toFixed(6));
    setLatitude(fixedLat);
    setLongitude(fixedLng);
    setManualLatInput(String(fixedLat));
    setManualLngInput(String(fixedLng));
    setGpsAccuracyMeters(accuracy);
    if (customLabel) {
      setLocationLabel(customLabel);
    } else if (!locationLabel.trim() || locationLabel.startsWith('Titik Lokasi Map')) {
      setLocationLabel(
        `Titik Lokasi Map (${fixedLat.toFixed(5)}, ${fixedLng.toFixed(5)})`
      );
    }
    setFormError(null);
  };

  const handleDetectGps = () => {
    setGpsStatusMsg(null);
    if (!navigator.geolocation) {
      setGpsStatusMsg(
        'Geolocation GPS tidak tersedia di browser ini. Klik langsung pada peta atau pilih area di bawah.'
      );
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const accRound = Math.round(accuracy);
        applyCoordinates(
          lat,
          lng,
          `Lokasi GPS Terkini (${lat.toFixed(5)}, ${lng.toFixed(5)} • Akurasi ±${accRound}m)`,
          accRound
        );
        setGpsLoading(false);
        setGpsStatusMsg(`Lokasi GPS berhasil dikunci (akurasi ±${accRound} meter).`);
      },
      (err) => {
        setGpsLoading(false);
        setGpsStatusMsg(
          err.code === 1
            ? 'Izin lokasi GPS diblokir browser. Anda dapat klik langsung titik toko pada Peta Google Maps atau pilih area Riau.'
            : 'Sinyal GPS gagal didapat. Silakan klik titik toko langsung pada Peta Google Maps.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleApplyManualCoords = () => {
    const parsedLat = Number(manualLatInput.replace(',', '.').trim());
    const parsedLng = Number(manualLngInput.replace(',', '.').trim());
    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng) ||
      parsedLat < -90 ||
      parsedLat > 90 ||
      parsedLng < -180 ||
      parsedLng > 180
    ) {
      setGpsStatusMsg(
        'Koordinat tidak valid. Latitude (-90..90) dan Longitude (-180..180).'
      );
      return;
    }
    applyCoordinates(parsedLat, parsedLng);
    setGpsStatusMsg('Koordinat manual berhasil diterapkan ke peta.');
  };

  const filteredStoreSuggestions = useMemo(() => {
    const q = storeName.trim().toUpperCase();
    if (!q) return storeOptions.slice(0, 60);
    return storeOptions
      .filter((s) => s.toUpperCase().includes(q))
      .slice(0, 60);
  }, [storeOptions, storeName]);

  const validationChecks = useMemo(() => {
    const checks = [
      { key: 'storeName', label: 'Nama Toko', ok: storeName.trim().length > 0 },
      {
        key: 'trainerName',
        label: 'Nama Trainer',
        ok: trainerName === 'ARA' || trainerName === 'RATIH',
      },
      { key: 'selfieDataUrl', label: 'Foto Selfie', ok: selfieDataUrl.length > 0 },
      { key: 'visitTime', label: 'Time Now', ok: visitTime.trim().length > 0 },
      { key: 'monthPeriod', label: 'Bulan Berjalan', ok: monthPeriod.trim().length > 0 },
      {
        key: 'locationMap',
        label: 'Lokasi Terkini (Map)',
        ok:
          latitude !== null &&
          longitude !== null &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          locationLabel.trim().length > 0,
      },
      { key: 'notes', label: 'Keterangan', ok: notes.trim().length > 0 },
    ];
    const missing = checks.filter((c) => !c.ok).map((c) => c.label);
    return {
      checks,
      missing,
      isComplete: missing.length === 0,
    };
  }, [
    storeName,
    trainerName,
    selfieDataUrl,
    visitTime,
    monthPeriod,
    latitude,
    longitude,
    locationLabel,
    notes,
  ]);

  const resetFormToNew = () => {
    const now = getCurrentFormattedTimestamp();
    setEditingId(null);
    setStoreName('');
    setTrainerName('');
    setSelfieDataUrl('');
    setVisitTime(now.display);
    setVisitIso(now.iso);
    setIsLiveClock(true);
    setMonthPeriod(defaultRunningMonth);
    setLatitude(null);
    setLongitude(null);
    setLocationLabel('');
    setGpsAccuracyMeters(undefined);
    setManualLatInput('');
    setManualLngInput('');
    setNotes('');
    setFormError(null);
    setGpsStatusMsg(null);
    setCameraError(null);
    stopCameraStream();
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);

    if (!validationChecks.isComplete) {
      setFormError(
        `Semua kolom wajib diisi sebelum simpan! Masih kurang: ${validationChecks.missing.join(', ')}.`
      );
      return;
    }

    const nowTs = getCurrentFormattedTimestamp();
    const finalVisitTime =
      !editingId && isLiveClock ? nowTs.display : visitTime.trim();
    const finalVisitIso =
      !editingId && isLiveClock ? nowTs.iso : visitIso || nowTs.iso;

    const existing = editingId
      ? visits.find((v) => v.id === editingId)
      : undefined;

    const record: TrainerVisitRecord = {
      id:
        editingId ||
        `tvisit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      storeName: storeName.trim(),
      trainerName: trainerName as TrainerVisitName,
      selfieDataUrl,
      visitTime: finalVisitTime,
      visitIso: finalVisitIso,
      monthPeriod: monthPeriod.trim().toUpperCase(),
      latitude: latitude as number,
      longitude: longitude as number,
      locationLabel: locationLabel.trim(),
      gpsAccuracyMeters,
      notes: notes.trim(),
      createdAt: existing?.createdAt || nowTs.iso,
      updatedAt: editingId ? nowTs.iso : undefined,
    };

    const result = upsertTrainerVisit(visits, record);
    if (!result.ok) {
      setFormError(result.error || 'Gagal menyimpan kunjungan trainer.');
      return;
    }

    setVisits(result.nextList);
    setFocusedMapVisit(record);
    const actionLabel = editingId ? 'diperbarui' : 'disimpan';
    resetFormToNew();
    const msg = `Kunjungan Trainer ${record.trainerName} ke "${record.storeName}" berhasil ${actionLabel}!`;
    setFormSuccess(msg);
    onNotify?.(msg, 'success');
  };

  const handleStartEdit = (visit: TrainerVisitRecord) => {
    stopCameraStream();
    setEditingId(visit.id);
    setStoreName(visit.storeName);
    setTrainerName(visit.trainerName);
    setSelfieDataUrl(visit.selfieDataUrl);
    setVisitTime(visit.visitTime);
    setVisitIso(visit.visitIso);
    setIsLiveClock(false);
    setMonthPeriod(visit.monthPeriod);
    setLatitude(visit.latitude);
    setLongitude(visit.longitude);
    setManualLatInput(String(visit.latitude));
    setManualLngInput(String(visit.longitude));
    setLocationLabel(visit.locationLabel);
    setGpsAccuracyMeters(visit.gpsAccuracyMeters);
    setNotes(visit.notes);
    setFormError(null);
    setFormSuccess(null);
    setGpsStatusMsg(null);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleConfirmDeleteRow = (id: string) => {
    const target = visits.find((v) => v.id === id);
    const result = deleteTrainerVisit(visits, id);
    if (!result.ok) {
      onNotify?.(result.error || 'Gagal menghapus data kunjungan.', 'error');
      return;
    }
    setVisits(result.nextList);
    setConfirmDeleteId(null);
    if (editingId === id) {
      resetFormToNew();
    }
    if (focusedMapVisit?.id === id) {
      setFocusedMapVisit(null);
    }
    onNotify?.(
      `Data kunjungan "${target?.storeName || ''}" berhasil dihapus.`,
      'success'
    );
  };

  const filteredVisits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return visits.filter((v) => {
      if (filterMonth !== 'ALL' && v.monthPeriod.toUpperCase() !== filterMonth.toUpperCase()) {
        return false;
      }
      if (filterTrainer !== 'ALL' && v.trainerName !== filterTrainer) {
        return false;
      }
      if (q) {
        const hay = `${v.storeName} ${v.trainerName} ${v.locationLabel} ${v.notes} ${v.monthPeriod}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visits, filterMonth, filterTrainer, searchTerm]);

  const handleBulkDeleteFiltered = () => {
    const deleteIds = new Set(filteredVisits.map((v) => v.id));
    const remaining = visits.filter((v) => !deleteIds.has(v.id));
    const saved = saveTrainerVisits(remaining);
    if (!saved.ok) {
      onNotify?.(saved.error || 'Gagal menghapus data terpilih.', 'error');
      return;
    }
    setVisits(remaining);
    setConfirmBulkDelete(false);
    if (editingId && deleteIds.has(editingId)) {
      resetFormToNew();
    }
    setFocusedMapVisit(null);
    onNotify?.(
      `${deleteIds.size} data kunjungan trainer pada filter aktif berhasil dihapus.`,
      'success'
    );
  };

  const recap = useMemo(
    () => aggregateTrainerVisitsRecap(visits, monthOptions),
    [visits, monthOptions]
  );

  const displayedRecapRows = useMemo(() => {
    return recap.monthlyRows.filter((row) => row.monthPeriod.endsWith('2026') || row.total > 0);
  }, [recap.monthlyRows]);

  return (
    <SalesVisitMapProvider>
      <div className="space-y-6">
        {/* Top Section Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-sky-500 text-white shadow-sm shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Form Kunjungan Trainer &amp; Rekap Check-In Toko
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Catat kunjungan toko Trainer (<span className="font-bold text-slate-800">ARA &amp; RATIH</span>) wajib lengkap dengan Foto Selfie, Time Now, Bulan Berjalan, Lokasi Terkini (Google Maps), dan Keterangan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              Total Tersimpan:{' '}
              <span className="font-mono font-extrabold text-purple-700 tabular-nums">
                {visits.length} kunjungan
              </span>
            </div>
          </div>
        </div>

        {/* Summary KPI Strip: Total & Per Trainer Count */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Kunjungan Trainer
            </div>
            <div className="mt-1.5 text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
              {recap.totalVisits}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Semua trainer &amp; bulan</div>
          </div>

          <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                ARA
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
            </div>
            <div className="mt-1.5 text-2xl font-extrabold text-purple-900 font-mono tabular-nums">
              {recap.totalsByTrainer.ARA}
            </div>
            <div className="text-[11px] text-purple-700 mt-0.5">Kali kunjungan</div>
          </div>

          <div className="bg-white rounded-xl border border-sky-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">
                RATIH
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
            </div>
            <div className="mt-1.5 text-2xl font-extrabold text-sky-900 font-mono tabular-nums">
              {recap.totalsByTrainer.RATIH}
            </div>
            <div className="text-[11px] text-sky-700 mt-0.5">Kali kunjungan</div>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Toko Dikunjungi
            </div>
            <div className="mt-1.5 text-2xl font-extrabold text-amber-950 font-mono tabular-nums">
              {recap.uniqueStoresCount}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">Gerai unik tercatat</div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* FORM KUNJUNGAN TRAINER (CREATE & EDIT MODE)             */}
        {/* ======================================================= */}
        <div
          ref={formCardRef}
          className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
            editingId ? 'border-amber-300 ring-2 ring-amber-200/70' : 'border-slate-200'
          }`}
        >
          <div
            className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              editingId
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50/80 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {editingId ? (
                <Edit3 className="w-5 h-5 text-amber-600 shrink-0" />
              ) : (
                <GraduationCap className="w-5 h-5 text-purple-600 shrink-0" />
              )}
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingId
                    ? 'Edit Data Kunjungan Trainer'
                    : 'Input Form Kunjungan Trainer Baru'}
                </h3>
                <p className="text-[11px] text-slate-600">
                  Semua kolom bertanda <span className="font-bold text-rose-600">*</span> wajib terisi penuh baru tombol Simpan aktif.
                </p>
              </div>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetFormToNew}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal Edit</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitForm} className="p-5 space-y-6">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN */}
              <div className="lg:col-span-5 space-y-4">
                {/* 1. Nama Toko */}
                <div ref={storePickerRef} className="relative">
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    1. Nama Toko <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={storeName}
                      onFocus={() => setIsStoreDropdownOpen(true)}
                      onChange={(e) => {
                        setStoreName(e.target.value);
                        setIsStoreDropdownOpen(true);
                        setFormError(null);
                      }}
                      placeholder="Pilih dari daftar toko atau ketik nama toko..."
                      className="w-full pl-9 pr-9 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    {storeName && (
                      <button
                        type="button"
                        onClick={() => {
                          setStoreName('');
                          setIsStoreDropdownOpen(true);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        title="Hapus nama toko"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isStoreDropdownOpen && filteredStoreSuggestions.length > 0 && (
                    <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl py-1">
                      {filteredStoreSuggestions.map((store) => (
                        <button
                          key={store}
                          type="button"
                          onClick={() => {
                            setStoreName(store);
                            setIsStoreDropdownOpen(false);
                            setFormError(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold hover:bg-purple-50 hover:text-purple-900 flex items-center justify-between cursor-pointer ${
                            storeName.toUpperCase() === store.toUpperCase()
                              ? 'bg-purple-50 text-purple-800'
                              : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate">{store}</span>
                          {storeName.toUpperCase() === store.toUpperCase() && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Nama Trainer (ARA, RATIH) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    2. Nama Trainer <span className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TRAINER_VISIT_OPTIONS.map((opt) => {
                      const isSelected = trainerName === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setTrainerName(opt);
                            setFormError(null);
                          }}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? TRAINER_ACTIVE_BTN_STYLES[opt]
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Time Now & 4. Bulan Berjalan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        3. Time Now <span className="text-rose-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const now = getCurrentFormattedTimestamp();
                          setVisitTime(now.display);
                          setVisitIso(now.iso);
                          if (!editingId) setIsLiveClock(true);
                        }}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Waktu Kini</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={visitTime}
                        onChange={(e) => {
                          setIsLiveClock(false);
                          setVisitTime(e.target.value);
                          setFormError(null);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold tabular-nums rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {!editingId && isLiveClock
                        ? 'Otomatis berjalan real-time'
                        : 'Mode waktu manual / tersimpan'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      4. Bulan Berjalan <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={monthPeriod}
                        onChange={(e) => {
                          setMonthPeriod(e.target.value);
                          setFormError(null);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {monthOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Foto Selfie */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800">
                      5. Foto Selfie di Toko <span className="text-rose-600">*</span>
                    </label>
                    {selfieDataUrl && (
                      <button
                        type="button"
                        onClick={() => setSelfieDataUrl('')}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={isCameraOpen ? stopCameraStream : handleStartCamera}
                      className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isCameraOpen ? 'Tutup Kamera' : 'Buka Kamera Selfie'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-purple-600" />
                      <span>Upload / Kamera HP</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleFileUploadSelfie}
                      className="hidden"
                    />
                  </div>

                  {cameraError && (
                    <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      {cameraError}
                    </p>
                  )}

                  {isCameraOpen && (
                    <div className="space-y-2">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full max-h-52 rounded-xl bg-black object-cover -scale-x-100 border border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={handleCapturePhotoFromVideo}
                        className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Ambil Foto Selfie Sekarang</span>
                      </button>
                    </div>
                  )}

                  {selfieDataUrl ? (
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-emerald-200">
                      <img
                        src={selfieDataUrl}
                        alt="Preview Foto Selfie Trainer"
                        className="w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Foto Selfie Tersimpan</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Siap dilampirkan ke laporan kunjungan trainer.
                        </p>
                      </div>
                    </div>
                  ) : (
                    !isCameraOpen && (
                      <div className="h-24 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                        <ImageIcon className="w-5 h-5" />
                        <span>Belum ada foto selfie</span>
                      </div>
                    )
                  )}
                </div>

                {/* 6. Keterangan */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    6. Keterangan Kunjungan &amp; Coaching <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="Tuliskan hasil kunjungan trainer: coaching BA, training produk fokus/new, evaluasi grooming, cek tester..."
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Lokasi Terkini (Google Maps) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    7. Lokasi Terkini (Google Maps) <span className="text-rose-600">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDetectGps}
                      disabled={gpsLoading}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                      <span>{gpsLoading ? 'Mendeteksi GPS...' : 'Ambil Lokasi Terkini (GPS)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowManualCoords((prev) => !prev)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      {showManualCoords ? 'Tutup Input Manual' : 'Input Koordinat / Area'}
                    </button>
                  </div>
                </div>

                {gpsStatusMsg && (
                  <div className="px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-[11px] font-semibold">
                    {gpsStatusMsg}
                  </div>
                )}

                {showManualCoords && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600 mr-1">
                        Area Cepat:
                      </span>
                      {RIAU_PRESET_LOCATIONS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyCoordinates(preset.lat, preset.lng, preset.label)}
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={manualLatInput}
                        onChange={(e) => setManualLatInput(e.target.value)}
                        placeholder="Latitude (contoh: 0.5071)"
                        className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        value={manualLngInput}
                        onChange={(e) => setManualLngInput(e.target.value)}
                        placeholder="Longitude (contoh: 101.4478)"
                        className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleApplyManualCoords}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                      >
                        Terapkan Koordinat
                      </button>
                    </div>
                  </div>
                )}

                <SalesVisitLocationPickerMap
                  lat={latitude}
                  lng={longitude}
                  locationLabel={locationLabel}
                  storeName={storeName}
                  salesName={trainerName}
                  roleLabel="Trainer"
                  onSelectCoordinates={(nextLat, nextLng) =>
                    applyCoordinates(nextLat, nextLng)
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Koordinat Terkunci (Lat, Lng)
                    </label>
                    <div
                      className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold tabular-nums ${
                        latitude !== null && longitude !== null
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {latitude !== null && longitude !== null
                        ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                        : 'Belum ada koordinat'}
                    </div>
                  </div>

                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nama Jalan / Patokan Lokasi Toko <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={locationLabel}
                      onChange={(e) => {
                        setLocationLabel(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="Contoh: Jl. Jend. Sudirman Pekanbaru (Area Counter)"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mandatory Validation Checklist Bar + Submit Button */}
            <div className="pt-4 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {validationChecks.checks.map((chk) => (
                  <span
                    key={chk.key}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${
                      chk.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {chk.ok ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                    )}
                    <span>{chk.label}</span>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={resetFormToNew}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Form</span>
                </button>

                <button
                  type="submit"
                  disabled={!validationChecks.isComplete}
                  title={
                    validationChecks.isComplete
                      ? 'Klik untuk menyimpan kunjungan trainer'
                      : `Lengkapi: ${validationChecks.missing.join(', ')}`
                  }
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                    validationChecks.isComplete
                      ? 'bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-700 hover:to-sky-700 text-white shadow-sm cursor-pointer'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {editingId
                      ? 'Simpan Perubahan Kunjungan'
                      : 'Simpan Kunjungan Trainer'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ======================================================= */}
        {/* REKAPAN PER BULAN & PER TRAINER + PETA SEBARAN          */}
        {/* ======================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Rekapan Jumlah Kunjungan Per Bulan &amp; Per Trainer
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Menghitung otomatis berapa kali ARA dan RATIH melakukan kunjungan setiap bulan. Klik baris bulan untuk memfilter riwayat.
                </p>
              </div>
              {filterMonth !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setFilterMonth('ALL')}
                  className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold self-start sm:self-auto cursor-pointer"
                >
                  Tampilkan Semua Bulan
                </button>
              )}
            </div>

            <div className="overflow-x-auto grow">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                    <th className="text-left font-extrabold px-4 py-2.5">Bulan Berjalan</th>
                    <th className="text-center font-extrabold px-3 py-2.5 text-purple-800">
                      ARA
                    </th>
                    <th className="text-center font-extrabold px-3 py-2.5 text-sky-800">
                      RATIH
                    </th>
                    <th className="text-center font-extrabold px-3 py-2.5">Total Kunjungan</th>
                    <th className="text-center font-extrabold px-3 py-2.5">Toko Unik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRecapRows.map((row) => {
                    const isRowSelected =
                      filterMonth.toUpperCase() === row.monthPeriod.toUpperCase();
                    return (
                      <tr
                        key={row.monthPeriod}
                        onClick={() =>
                          setFilterMonth(isRowSelected ? 'ALL' : row.monthPeriod)
                        }
                        className={`cursor-pointer transition-colors ${
                          isRowSelected
                            ? 'bg-purple-50/80 font-bold'
                            : row.total > 0
                            ? 'hover:bg-slate-50'
                            : 'text-slate-400 hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {row.monthPeriod}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums">
                          {row.counts.ARA > 0 ? (
                            <span className="inline-block min-w-[26px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-900">
                              {row.counts.ARA}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums">
                          {row.counts.RATIH > 0 ? (
                            <span className="inline-block min-w-[26px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-900">
                              {row.counts.RATIH}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-extrabold text-slate-900 tabular-nums">
                          {row.total}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-600 tabular-nums">
                          {row.uniqueStores}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-extrabold">
                    <td className="px-4 py-3">TOTAL KESELURUHAN</td>
                    <td className="px-3 py-3 text-center font-mono tabular-nums text-purple-300">
                      {recap.totalsByTrainer.ARA}x
                    </td>
                    <td className="px-3 py-3 text-center font-mono tabular-nums text-sky-300">
                      {recap.totalsByTrainer.RATIH}x
                    </td>
                    <td className="px-3 py-3 text-center font-mono tabular-nums">
                      {recap.totalVisits}x
                    </td>
                    <td className="px-3 py-3 text-center font-mono tabular-nums">
                      {recap.uniqueStoresCount}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div
            ref={overviewMapCardRef}
            className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Peta Sebaran Kunjungan Trainer ({filteredVisits.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pin Ungu: ARA • Pin Biru Sky: RATIH
                </p>
              </div>
              {focusedMapVisit && (
                <button
                  type="button"
                  onClick={() => setFocusedMapVisit(null)}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Tutup Pin
                </button>
              )}
            </div>
            <div className="p-4 grow flex flex-col justify-between gap-3">
              <TrainerVisitOverviewMap
                visits={filteredVisits}
                focusedVisit={focusedMapVisit}
                onFocusVisit={setFocusedMapVisit}
                heightClass="h-[340px] lg:h-[390px]"
              />
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Klik pin di peta untuk melihat selfie &amp; catatan trainer.</span>
                <span className="font-mono font-bold text-slate-700 tabular-nums">
                  {filteredVisits.length} titik aktif
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* DAFTAR RIWAYAT KUNJUNGAN TRAINER (EDITABLE & DELETABLE) */}
        {/* ======================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Riwayat Kunjungan Trainer ({filteredVisits.length} dari {visits.length} data)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Setiap entri kunjungan trainer tersimpan rapi dan dapat diedit maupun dihapus kapan saja.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari toko / lokasi / catatan..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
                >
                  <option value="ALL">Semua Bulan</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={filterTrainer}
                onChange={(e) =>
                  setFilterTrainer(e.target.value as TrainerVisitName | 'ALL')
                }
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">Semua Trainer</option>
                {TRAINER_VISIT_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {(filterMonth !== 'ALL' || filterTrainer !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterMonth('ALL');
                    setFilterTrainer('ALL');
                    setSearchTerm('');
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Reset
                </button>
              )}

              {filteredVisits.length > 0 && (
                confirmBulkDelete ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    <span className="text-[11px] font-bold text-rose-800">
                      Hapus {filteredVisits.length} data?
                    </span>
                    <button
                      type="button"
                      onClick={handleBulkDeleteFiltered}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Ya
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBulkDelete(false)}
                      className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(true)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Terfilter</span>
                  </button>
                )
              )}
            </div>
          </div>

          {filteredVisits.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Belum ada data kunjungan trainer pada filter ini
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Lengkapi seluruh kolom pada Form Kunjungan Trainer di atas (Nama Toko, Trainer ARA/RATIH, Foto Selfie, Time Now, Bulan Berjalan, Lokasi Map, dan Keterangan) lalu klik Simpan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                    <th className="text-center font-extrabold px-3 py-3 w-12">No</th>
                    <th className="text-left font-extrabold px-3 py-3">Foto Selfie</th>
                    <th className="text-left font-extrabold px-3 py-3">Nama Toko &amp; Bulan</th>
                    <th className="text-left font-extrabold px-3 py-3">Nama Trainer</th>
                    <th className="text-left font-extrabold px-3 py-3">Time Now</th>
                    <th className="text-left font-extrabold px-3 py-3">Lokasi Terkini (Map)</th>
                    <th className="text-left font-extrabold px-3 py-3">Keterangan</th>
                    <th className="text-center font-extrabold px-3 py-3 w-40">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisits.map((visit, idx) => {
                    const isDeleting = confirmDeleteId === visit.id;
                    const isEditingRow = editingId === visit.id;
                    return (
                      <tr
                        key={visit.id}
                        className={`align-top transition-colors ${
                          isEditingRow ? 'bg-amber-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>

                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setLightboxVisit(visit)}
                            className="group relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-2xs block cursor-pointer"
                            title="Klik untuk memperbesar foto selfie"
                          >
                            <img
                              src={visit.selfieDataUrl}
                              alt={`Selfie ${visit.trainerName}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </button>
                        </td>

                        <td className="px-3 py-3 min-w-[180px]">
                          <div className="font-extrabold text-slate-900">{visit.storeName}</div>
                          <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                            {visit.monthPeriod}
                          </div>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-extrabold ${
                              TRAINER_BADGE_STYLES[visit.trainerName]
                            }`}
                          >
                            {visit.trainerName}
                          </span>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-800 tabular-nums">
                            {visit.visitTime}
                          </div>
                          {visit.updatedAt && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              Diedit
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3 min-w-[200px]">
                          <div className="font-semibold text-slate-800">{visit.locationLabel}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                              {visit.latitude.toFixed(5)}, {visit.longitude.toFixed(5)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedMapVisit(visit);
                                overviewMapCardRef.current?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                });
                              }}
                              className="text-[10px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-0.5 cursor-pointer"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Lihat Map</span>
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-3 min-w-[200px] max-w-[280px]">
                          <p className="text-slate-700 whitespace-pre-line break-words">
                            {visit.notes}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {isDeleting ? (
                            <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteRow(visit.id)}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(visit)}
                                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                title="Edit data kunjungan ini"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(visit.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                title="Hapus data kunjungan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lightbox Modal for Selfie Inspection */}
        {lightboxVisit && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setLightboxVisit(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {lightboxVisit.storeName}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Trainer {lightboxVisit.trainerName} • {lightboxVisit.visitTime} •{' '}
                    {lightboxVisit.monthPeriod}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxVisit(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <img
                  src={lightboxVisit.selfieDataUrl}
                  alt={`Foto Selfie Trainer ${lightboxVisit.trainerName}`}
                  className="w-full max-h-[60vh] object-contain rounded-xl bg-slate-100 border border-slate-200"
                />
                <div className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900">
                    Lokasi: {lightboxVisit.locationLabel}{' '}
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      ({lightboxVisit.latitude.toFixed(6)}, {lightboxVisit.longitude.toFixed(6)})
                    </span>
                  </div>
                  <div>Keterangan: {lightboxVisit.notes}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SalesVisitMapProvider>
  );
};
