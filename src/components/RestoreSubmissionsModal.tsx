import React, { useState, useMemo, useEffect } from 'react';
import {
  RotateCcw,
  Calendar,
  CalendarRange,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Award,
  TrendingUp,
  FileText,
  BarChart3,
  Layers,
  ArrowRight,
  ExternalLink,
  Filter,
} from 'lucide-react';
import {
  StudentSubmission,
  RestoreSubmissionsFilter,
  parseSubmissionDate,
  isSubmissionMatchingResetFilter,
  EXAM_INFO,
  getSubmissionUniqueKey,
} from '../data/examData';
import {
  googleSignIn,
  getAccessTokenSync,
  saveManualGoogleAccessToken,
  logoutGoogle,
} from '../services/gmailAuthService';

export interface RestoreSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidatePool: StudentSubmission[];
  currentSubmissions: StudentSubmission[];
  onConfirmRestore: (
    filter: RestoreSubmissionsFilter,
    explicitToken?: string
  ) => Promise<void> | void;
  googleSheetUrl?: string;
  isTeacherMode?: boolean;
}

const INDO_MONTHS = [
  { value: 1, label: '01 - Januari' },
  { value: 2, label: '02 - Februari' },
  { value: 3, label: '03 - Maret' },
  { value: 4, label: '04 - April' },
  { value: 5, label: '05 - Mei' },
  { value: 6, label: '06 - Juni' },
  { value: 7, label: '07 - Juli' },
  { value: 8, label: '08 - Agustus' },
  { value: 9, label: '09 - September' },
  { value: 10, label: '10 - Oktober' },
  { value: 11, label: '11 - November' },
  { value: 12, label: '12 - Desember' },
];

export const RestoreSubmissionsModal: React.FC<RestoreSubmissionsModalProps> = ({
  isOpen,
  onClose,
  candidatePool,
  currentSubmissions,
  onConfirmRestore,
  googleSheetUrl,
  isTeacherMode = false,
}) => {
  // Mode Waktu: ALL (Semua Tanggal), DATE_FILTER (Filter Tanggal, Bulan & Tahun), DATE_RANGE (Rentang Mulai & Sampai)
  const [restoreMode, setRestoreMode] = useState<'ALL' | 'DATE_FILTER' | 'DATE_RANGE'>('ALL');

  // Filter Dropdown Tanggal, Bulan, Tahun
  const [selectedDate, setSelectedDate] = useState<number | 'ALL'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>('ALL');
  const [specificDateIso, setSpecificDateIso] = useState<string>('');

  // Rentang Tanggal Mulai & Sampai
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');

  // Target Data yang Ingin Dipulihkan (2 Pilihan Utama)
  // 1. Semua Data Riwayat yang ada di menu
  const [restoreAppMenus, setRestoreAppMenus] = useState<boolean>(true);
  // 2. Data Rekap Hasil Nilai yang ada di Google Sheet
  const [restoreGoogleSheets, setRestoreGoogleSheets] = useState<boolean>(true);

  // Otentikasi Password Guru
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showRestorePass, setShowRestorePass] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() =>
    Boolean(getAccessTokenSync())
  );
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleAuthSuccess, setGoogleAuthSuccess] = useState<string | null>(null);
  const [showManualToken, setShowManualToken] = useState<boolean>(false);
  const [manualTokenInput, setManualTokenInput] = useState<string>('');

  useEffect(() => {
    const checkConn = () => {
      setIsGoogleConnected(Boolean(getAccessTokenSync()));
    };
    checkConn();
    window.addEventListener('anbk-sheets-oauth-ready', checkConn);
    return () => {
      window.removeEventListener('anbk-sheets-oauth-ready', checkConn);
    };
  }, []);

  // Analisis statistik tanggal & tahun yang tersedia pada candidatePool
  const availableStats = useMemo(() => {
    const dateMap: Record<
      string,
      {
        dateKey: string;
        day: number;
        month: number;
        year: number;
        formattedIndo: string;
        count: number;
      }
    > = {};

    const yearsSet = new Set<number>();
    const monthsSet = new Set<number>();
    yearsSet.add(2026);
    yearsSet.add(2025);

    candidatePool.forEach((s) => {
      const parsed = parseSubmissionDate(s);
      if (parsed.year) yearsSet.add(parsed.year);
      if (parsed.month) monthsSet.add(parsed.month);
      if (parsed.dateKey && parsed.day && parsed.month && parsed.year) {
        if (!dateMap[parsed.dateKey]) {
          dateMap[parsed.dateKey] = {
            dateKey: parsed.dateKey,
            day: parsed.day,
            month: parsed.month,
            year: parsed.year,
            formattedIndo: parsed.formattedIndo,
            count: 0,
          };
        }
        dateMap[parsed.dateKey].count += 1;
      }
    });

    const sortedDates = Object.values(dateMap).sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey)
    );
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    const sortedMonths = Array.from(monthsSet).sort((a, b) => a - b);

    return {
      dates: sortedDates,
      years: sortedYears,
      months: sortedMonths,
      minDate: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1].dateKey : '',
      maxDate: sortedDates.length > 0 ? sortedDates[0].dateKey : '',
    };
  }, [candidatePool]);

  // Bangun filter aktif
  const activeFilter: RestoreSubmissionsFilter = useMemo(() => {
    return {
      mode: restoreMode,
      selectedDate,
      selectedMonth,
      selectedYear,
      specificDateIso: specificDateIso || undefined,
      startDateIso: startDateIso.trim() || undefined,
      endDateIso: endDateIso.trim() || undefined,
      restoreTarget: {
        appMenus: restoreAppMenus,
        googleSheet: restoreGoogleSheets,
      },
    };
  }, [
    restoreMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    specificDateIso,
    startDateIso,
    endDateIso,
    restoreAppMenus,
    restoreGoogleSheets,
  ]);

  // Hitung siswa yang cocok untuk dipulihkan
  const matchedCandidates = useMemo(() => {
    if (restoreMode === 'ALL') {
      return candidatePool;
    }
    return candidatePool.filter((s) =>
      isSubmissionMatchingResetFilter(s, {
        mode: restoreMode,
        selectedDate,
        selectedMonth,
        selectedYear,
        specificDateIso,
        startDateIso,
        endDateIso,
      })
    );
  }, [
    candidatePool,
    restoreMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    specificDateIso,
    startDateIso,
    endDateIso,
  ]);

  // Cek berapa banyak siswa yang belum ada di daftar aktif saat ini
  const activeKeysSet = useMemo(() => {
    return new Set(currentSubmissions.map((s) => getSubmissionUniqueKey(s)));
  }, [currentSubmissions]);

  const newToActivateCount = useMemo(() => {
    return matchedCandidates.filter((s) => !activeKeysSet.has(getSubmissionUniqueKey(s)))
      .length;
  }, [matchedCandidates, activeKeysSet]);

  // Reset form ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setPasswordError(null);
      setIsSubmitting(false);
      setRestoreMode('ALL');
      setSelectedDate('ALL');
      setSelectedMonth('ALL');
      setSelectedYear('ALL');
      setSpecificDateIso('');
      setStartDateIso('');
      setEndDateIso('');
      setRestoreAppMenus(true);
      setRestoreGoogleSheets(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectGoogleSheets = async () => {
    setIsConnectingGoogle(true);
    setGoogleAuthError(null);
    setGoogleAuthSuccess(null);
    setPasswordError(null);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        setIsGoogleConnected(true);
        setGoogleAuthSuccess('✓ Akun Google berhasil terhubung!');
        setShowManualToken(false);
      }
    } catch (err: unknown) {
      setGoogleAuthError(
        'Gagal menghubungkan Akun Google: ' +
          (err instanceof Error ? err.message : 'Otorisasi ditutup atau dibatalkan.')
      );
      setShowManualToken(true);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleApplyManualToken = () => {
    if (!manualTokenInput.trim() || manualTokenInput.trim().length < 10) {
      setGoogleAuthError('Masukkan Token Akses Google OAuth yang valid.');
      return;
    }
    const ok = saveManualGoogleAccessToken(manualTokenInput.trim());
    if (ok) {
      setIsGoogleConnected(true);
      setGoogleAuthSuccess('✓ Token Akses Google manual berhasil diaktifkan!');
      setGoogleAuthError(null);
      setManualTokenInput('');
    } else {
      setGoogleAuthError('Token tidak valid atau terlalu pendek.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!restoreAppMenus && !restoreGoogleSheets) {
      setPasswordError(
        'Pilih minimal salah satu target data yang ingin dipulihkan (Menu Aplikasi atau Google Sheet).'
      );
      return;
    }

    if (matchedCandidates.length === 0) {
      setPasswordError(
        'Tidak ada data siswa yang cocok dengan pilihan tanggal, bulan, atau tahun yang dipilih.'
      );
      return;
    }

    // Verifikasi password jika belum teacherMode
    const effectivePass = passwordInput.trim();
    if (!isTeacherMode && effectivePass !== EXAM_INFO.teacherPassword) {
      setPasswordError(
        'Kode Mode Guru tidak valid! Fitur Pulihkan Data Riwayat Tersinkronisasi hanya dapat diakses oleh Guru Mapel Informatika.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const explicitToken = getAccessTokenSync() || undefined;
      await onConfirmRestore(activeFilter, explicitToken);
      onClose();
    } catch (err: unknown) {
      setPasswordError(
        'Terjadi kendala saat memulihkan data: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-emerald-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-white/15 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950/70 rounded-[10px] flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-emerald-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Pulihkan Data Riwayat Tersinkronisasi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Khusus Guru
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-200/80">
                Pilih rentang waktu (tanggal, bulan, tahun) &amp; target data yang ingin dipulihkan ke menu aplikasi dan Google Sheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Isi */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ======================================================== */}
          {/* BAGIAN 1: PILIHAN TANGGAL, BULAN, TAHUN YANG INGIN DIPULIHKAN */}
          {/* ======================================================== */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-slate-950/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  1. Pilihan Waktu Pemulihan (Tanggal, Bulan, Tahun)
                </span>
              </div>
              <span className="text-[10.5px] text-sky-300 font-mono">
                Tersedia: <strong>{candidatePool.length} Total Riwayat</strong>
              </span>
            </div>

            {/* Tab Pilihan Mode Waktu */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-900 border border-white/10">
              <button
                type="button"
                onClick={() => setRestoreMode('ALL')}
                className={`py-1.5 px-2 rounded-md text-[10.5px] sm:text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  restoreMode === 'ALL'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Semua Tanggal</span>
              </button>
              <button
                type="button"
                onClick={() => setRestoreMode('DATE_FILTER')}
                className={`py-1.5 px-2 rounded-md text-[10.5px] sm:text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  restoreMode === 'DATE_FILTER'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <CalendarDays className="w-3 h-3 shrink-0" />
                <span>Filter Tanggal/Bulan</span>
              </button>
              <button
                type="button"
                onClick={() => setRestoreMode('DATE_RANGE')}
                className={`py-1.5 px-2 rounded-md text-[10.5px] sm:text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  restoreMode === 'DATE_RANGE'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <CalendarRange className="w-3 h-3 shrink-0" />
                <span>Rentang Tanggal</span>
              </button>
            </div>

            {/* Konten Mode: ALL */}
            {restoreMode === 'ALL' && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-100 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Memulihkan <strong className="text-white">seluruh data riwayat ujian ({candidatePool.length} siswa)</strong> dari seluruh tanggal, bulan, dan tahun tanpa pengecualian.
                </div>
              </div>
            )}

            {/* Konten Mode: DATE_FILTER (Pilihan Tanggal, Bulan, Tahun) */}
            {restoreMode === 'DATE_FILTER' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Pilihan Tanggal/Hari */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-sky-200 mb-1">
                      Pilih Tanggal / Hari:
                    </label>
                    <select
                      value={selectedDate}
                      onChange={(e) => {
                        const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                        setSelectedDate(val);
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-white/20 bg-slate-900 text-white text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Semua Tanggal (01 - 31)</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Tanggal {String(d).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pilihan Bulan */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-sky-200 mb-1">
                      Pilih Bulan:
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => {
                        const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                        setSelectedMonth(val);
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-white/20 bg-slate-900 text-white text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Semua Bulan (01 - 12)</option>
                      {INDO_MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pilihan Tahun */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-sky-200 mb-1">
                      Pilih Tahun:
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                        setSelectedYear(val);
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-white/20 bg-slate-900 text-white text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Semua Tahun</option>
                      {availableStats.years.map((y) => (
                        <option key={y} value={y}>
                          Tahun {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pintasan Tanggal Spesifik yang Ditemukan di Database */}
                {availableStats.dates.length > 0 && (
                  <div className="pt-1">
                    <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                      Pintasan Tanggal Riwayat yang Tersedia di Bank Data:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto p-1 rounded bg-slate-900/60 border border-white/5">
                      {availableStats.dates.map((d) => {
                        const isMatch =
                          (selectedDate === 'ALL' || selectedDate === d.day) &&
                          (selectedMonth === 'ALL' || selectedMonth === d.month) &&
                          (selectedYear === 'ALL' || selectedYear === d.year);
                        return (
                          <button
                            key={d.dateKey}
                            type="button"
                            onClick={() => {
                              setSelectedDate(d.day);
                              setSelectedMonth(d.month);
                              setSelectedYear(d.year);
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                              isMatch && selectedDate !== 'ALL'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-extrabold shadow-xs'
                                : 'bg-slate-800/80 hover:bg-slate-700 text-emerald-200 border-emerald-500/30'
                            }`}
                          >
                            <span>{d.formattedIndo}</span>
                            <span className="px-1 py-0.2 rounded-full text-[9px] bg-black/40 text-emerald-300">
                              {d.count} siswa
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Konten Mode: DATE_RANGE (Rentang Tanggal) */}
            {restoreMode === 'DATE_RANGE' && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-sky-200 mb-1">
                      Mulai Tanggal:
                    </label>
                    <input
                      type="date"
                      value={startDateIso}
                      onChange={(e) => setStartDateIso(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-white/20 bg-slate-900 text-white text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-sky-200 mb-1">
                      Sampai Tanggal:
                    </label>
                    <input
                      type="date"
                      value={endDateIso}
                      onChange={(e) => setEndDateIso(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-white/20 bg-slate-900 text-white text-xs focus:ring-1 focus:ring-emerald-400 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">Pintasan Cepat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDateIso('2026-09-01');
                      setEndDateIso('2026-09-30');
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-200 cursor-pointer"
                  >
                    Bulan September 2026
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setStartDateIso(today);
                      setEndDateIso(today);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDateIso(availableStats.minDate || '2026-09-17');
                      setEndDateIso(availableStats.maxDate || '2026-09-24');
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 cursor-pointer"
                  >
                    Rentang Penuh Master (17-24 Sep 2026)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* BAGIAN 2: PILIHAN DATA YANG INGIN DIPULIHKAN (2 OPSI BESAR) */}
          {/* ======================================================== */}
          <div className="p-3.5 rounded-xl border border-teal-500/30 bg-slate-950/80 space-y-3">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Layers className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold text-white">
                2. Pilihan Data yang Ingin Dipulihkan
              </span>
            </div>

            <div className="space-y-2.5">
              {/* OPSI 1: Semua Data Riwayat yang ada di menu */}
              <label
                className={`relative block p-3 rounded-xl border transition-all cursor-pointer ${
                  restoreAppMenus
                    ? 'border-emerald-400/80 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 ring-1 ring-emerald-400/40'
                    : 'border-white/15 bg-slate-900/60 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={restoreAppMenus}
                    onChange={(e) => setRestoreAppMenus(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-emerald-500 rounded cursor-pointer shrink-0"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-extrabold text-white">
                        1. Semua Data Riwayat yang ada di menu aplikasi
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Rekomendasi
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Memulihkan data nilai &amp; sesi ujian secara lengkap ke seluruh menu aplikasi:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-emerald-200">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Sistem Riwayat Percobaan Siswa</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>Nilai &amp; Sertifikat Ujian Siswa</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                        <span>Menu Fitur Rapor Siswa</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Peringkat 5 Besar &amp; Pemeringkatan Siswa</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span>Urutan Rekap &amp; Animasi Kolom Pemeringkatan</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-yellow-300 shrink-0" />
                        <span>Papan Peringkat &amp; Motivasi Campuran</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-cyan-300 shrink-0" />
                        <span>Analitik Time-Series (Tren Harian)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-indigo-300 shrink-0" />
                        <span>Daftar Riwayat Percobaan Siswa</span>
                      </div>
                    </div>
                  </div>
                </div>
              </label>

              {/* OPSI 2: Data Rekap Hasil Nilai yang ada di Google Sheet */}
              <label
                className={`relative block p-3 rounded-xl border transition-all cursor-pointer ${
                  restoreGoogleSheets
                    ? 'border-sky-400/80 bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 ring-1 ring-sky-400/40'
                    : 'border-white/15 bg-slate-900/60 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={restoreGoogleSheets}
                    onChange={(e) => setRestoreGoogleSheets(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-sky-500 rounded cursor-pointer shrink-0"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-extrabold text-white">
                        2. Data Rekap Hasil Nilai yang ada di Google Sheet
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                        13 Kolom Rekap
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Menyinkronkan dan memulihkan baris nilai ujian peserta secara otomatis ke Google Sheets Spreadsheet sekolah.
                    </p>
                    {googleSheetUrl && (
                      <div className="flex items-center gap-1 text-[10px] text-sky-200/90 truncate font-mono">
                        <FileSpreadsheet className="w-3 h-3 text-sky-300 shrink-0" />
                        <span className="truncate">Target: {googleSheetUrl}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        {isGoogleConnected ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Akun Google Terhubung (OAuth Aktif)</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleConnectGoogleSheets();
                              }}
                              disabled={isConnectingGoogle}
                              className="h-6 px-2.5 rounded text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{isConnectingGoogle ? 'Menghubungkan...' : 'Hubungkan Akun Google'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowManualToken((p) => !p);
                              }}
                              className="text-[10px] text-sky-300 hover:text-sky-200 underline px-1 py-0.5 cursor-pointer"
                            >
                              {showManualToken ? 'Tutup Token' : 'Token Manual'}
                            </button>
                          </>
                        )}
                      </div>

                      {googleAuthSuccess && (
                        <div className="text-[10.5px] text-emerald-300 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{googleAuthSuccess}</span>
                        </div>
                      )}

                      {googleAuthError && (
                        <div className="p-2 rounded bg-amber-950/80 border border-amber-400/40 text-amber-200 text-[10.5px] space-y-0.5">
                          <div className="font-bold flex items-center gap-1 text-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Kendala Google:</span>
                          </div>
                          <p>{googleAuthError}</p>
                        </div>
                      )}

                      {showManualToken && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={manualTokenInput}
                            onChange={(e) => setManualTokenInput(e.target.value)}
                            placeholder="Tempel OAuth Access Token (ya29...)"
                            className="flex-1 px-2 py-1 text-[10.5px] rounded border border-white/20 bg-slate-950 text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleApplyManualToken();
                            }}
                            className="px-2.5 py-1 text-[10.5px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                          >
                            Terapkan
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* ======================================================== */}
          {/* PRATINJAU INTERAKTIF HASIL YANG AKAN DIPULIHKAN */}
          {/* ======================================================== */}
          <div className="p-3 rounded-xl border border-white/10 bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hasil Seleksi Pemulihan:</span>
              </span>
              <span className="font-mono text-emerald-300 font-extrabold text-xs">
                {matchedCandidates.length} Siswa Siap Dipulihkan
              </span>
            </div>

            {matchedCandidates.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="text-slate-400">Contoh data terpilih:</span>
                  {matchedCandidates.slice(0, 4).map((sub, idx) => (
                    <span
                      key={sub.id || idx}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-200 font-mono text-[9.5px]"
                    >
                      {sub.namaSiswa} ({sub.kelas} · {sub.nilaiAkhir})
                    </span>
                  ))}
                  {matchedCandidates.length > 4 && (
                    <span className="text-slate-400 text-[10px]">
                      + {matchedCandidates.length - 4} siswa lainnya
                    </span>
                  )}
                </div>
                {newToActivateCount > 0 && (
                  <p className="text-[10px] text-emerald-300">
                    Sebanyak <strong>{newToActivateCount} siswa</strong> baru akan diaktifkan kembali ke dashboard riwayat dan spreadsheet.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-amber-300">
                Peringatan: Tidak ditemukan data riwayat pada pilihan waktu ini. Silakan ubah filter tanggal/bulan/tahun di atas.
              </p>
            )}
          </div>

          {/* ======================================================== */}
          {/* BAGIAN 3: OTENTIKASI KHUSUS GURU (KODE MODE GURU) */}
          {/* ======================================================== */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Kode Mode Guru ({EXAM_INFO.guruMapelUpper})</span>
              </label>
              {isTeacherMode && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Mode Guru Terverifikasi
                </span>
              )}
            </div>

            {!isTeacherMode ? (
              <div className="relative">
                <input
                  type={showRestorePass ? 'text' : 'password'}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="q_filter_restore_guru_anbk"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Masukkan Kode Mode Guru untuk konfirmasi pemulihan..."
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-white/20 bg-slate-950 text-white placeholder:text-slate-500 text-xs font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowRestorePass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  title={showRestorePass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showRestorePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Akses Guru Aktif: Anda dapat langsung memulihkan data tanpa memasukkan password kembali.</span>
              </div>
            )}

            {passwordError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}
          </div>

          {/* Tombol Aksi Bawah */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || matchedCandidates.length === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>
                {isSubmitting
                  ? 'Memulihkan Data...'
                  : `Verifikasi & Pulihkan Data (${matchedCandidates.length} Siswa)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
