import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  CheckCircle2,
  Filter,
  RefreshCw,
  X,
  Users,
  FileSpreadsheet,
  Layers,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  StudentSubmission,
  parseSubmissionDate,
} from '../data/examData';

export interface SyncDateFilter {
  mode: 'ALL' | 'TODAY' | 'DATE_FILTER' | 'DATE_RANGE';
  selectedDate?: number | 'ALL'; // 1-31 or 'ALL'
  selectedMonth?: number | 'ALL'; // 1-12 or 'ALL'
  selectedYear?: number | 'ALL'; // e.g. 2026 or 'ALL'
  specificDateIso?: string; // 'YYYY-MM-DD'
  startDateIso?: string; // 'YYYY-MM-DD'
  endDateIso?: string; // 'YYYY-MM-DD'
}

export function isSubmissionMatchingSyncFilter(
  sub: StudentSubmission,
  filter?: SyncDateFilter
): boolean {
  if (!filter || filter.mode === 'ALL') return true;

  const parsed = parseSubmissionDate(sub);
  if (!parsed.day || !parsed.month || !parsed.year || !parsed.dateKey) {
    return false;
  }

  if (filter.mode === 'TODAY') {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    return parsed.dateKey === todayKey;
  }

  if (filter.mode === 'DATE_RANGE') {
    if (filter.startDateIso && filter.startDateIso.trim()) {
      if (parsed.dateKey < filter.startDateIso.trim()) return false;
    }
    if (filter.endDateIso && filter.endDateIso.trim()) {
      if (parsed.dateKey > filter.endDateIso.trim()) return false;
    }
    return true;
  }

  if (filter.specificDateIso && filter.specificDateIso.trim()) {
    return parsed.dateKey === filter.specificDateIso.trim();
  }

  let match = true;
  if (filter.selectedDate !== undefined && filter.selectedDate !== 'ALL') {
    match = match && parsed.day === Number(filter.selectedDate);
  }
  if (filter.selectedMonth !== undefined && filter.selectedMonth !== 'ALL') {
    match = match && parsed.month === Number(filter.selectedMonth);
  }
  if (filter.selectedYear !== undefined && filter.selectedYear !== 'ALL') {
    match = match && parsed.year === Number(filter.selectedYear);
  }
  return match;
}

export interface SyncDataDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: StudentSubmission[];
  title?: string;
  description?: string;
  onConfirmSync: (
    filter: SyncDateFilter,
    filteredSubmissions: StudentSubmission[]
  ) => Promise<void> | void;
  isSyncing?: boolean;
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

export const SyncDataDateModal: React.FC<SyncDataDateModalProps> = ({
  isOpen,
  onClose,
  submissions,
  title = 'PILIHAN DATA SINKRONISASI',
  description = 'Tentukan data riwayat ujian berdasarkan tanggal, bulan, atau tahun yang ingin disinkronkan ke Google Sheets & Cloud Server.',
  onConfirmSync,
  isSyncing = false,
}) => {
  const currentDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(
      currentDate.getDate()
    ).padStart(2, '0')}`;
  }, [currentDate]);

  // Default mode: ALL agar fleksibel, tapi langsung siap difilter sesuai kemauan pengguna
  const [filterMode, setFilterMode] = useState<'ALL' | 'TODAY' | 'DATE_FILTER' | 'DATE_RANGE'>('ALL');
  const [selectedDate, setSelectedDate] = useState<number | 'ALL'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>('ALL');
  const [specificDateIso, setSpecificDateIso] = useState<string>('');
  const [startDateIso, setStartDateIso] = useState<string>(todayIso);
  const [endDateIso, setEndDateIso] = useState<string>(todayIso);

  // Kumpulkan tahun-tahun yang terdapat pada data siswa untuk pilihan dropdown dinamis
  const availableYears = useMemo(() => {
    const setYears = new Set<number>();
    setYears.add(currentDate.getFullYear());
    setYears.add(2026);
    setYears.add(2025);
    setYears.add(2024);
    submissions.forEach((s) => {
      const p = parseSubmissionDate(s);
      if (p.year) setYears.add(p.year);
    });
    return Array.from(setYears).sort((a, b) => b - a);
  }, [submissions, currentDate]);

  // Current active filter object
  const currentFilter = useMemo<SyncDateFilter>(() => {
    return {
      mode: filterMode,
      selectedDate: filterMode === 'DATE_FILTER' ? selectedDate : 'ALL',
      selectedMonth: filterMode === 'DATE_FILTER' ? selectedMonth : 'ALL',
      selectedYear: filterMode === 'DATE_FILTER' ? selectedYear : 'ALL',
      specificDateIso: filterMode === 'DATE_FILTER' ? specificDateIso : '',
      startDateIso: filterMode === 'DATE_RANGE' ? startDateIso : '',
      endDateIso: filterMode === 'DATE_RANGE' ? endDateIso : '',
    };
  }, [filterMode, selectedDate, selectedMonth, selectedYear, specificDateIso, startDateIso, endDateIso]);

  // Filtered submissions based on selected filter
  const matchedSubmissions = useMemo(() => {
    return submissions.filter((s) => isSubmissionMatchingSyncFilter(s, currentFilter));
  }, [submissions, currentFilter]);

  // Sinkronkan kalender picker bila dropdown diubah
  const handleCalendarInputChange = (val: string) => {
    setSpecificDateIso(val);
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      if (y && m && d) {
        setSelectedYear(y);
        setSelectedMonth(m);
        setSelectedDate(d);
      }
    }
  };

  const handleDropdownDateChange = (d: number | 'ALL') => {
    setSelectedDate(d);
    setSpecificDateIso('');
  };

  const handleDropdownMonthChange = (m: number | 'ALL') => {
    setSelectedMonth(m);
    setSpecificDateIso('');
  };

  const handleDropdownYearChange = (y: number | 'ALL') => {
    setSelectedYear(y);
    setSpecificDateIso('');
  };

  const handleQuickSetToday = () => {
    setFilterMode('TODAY');
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth() + 1);
    setSelectedDate(currentDate.getDate());
    setSpecificDateIso(todayIso);
  };

  const handleQuickSetThisMonth = () => {
    setFilterMode('DATE_FILTER');
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonth(currentDate.getMonth() + 1);
    setSelectedDate('ALL');
    setSpecificDateIso('');
  };

  const handleConfirm = () => {
    onConfirmSync(currentFilter, matchedSubmissions);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSyncing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSyncing, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSyncing) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Glow Header Accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />

        {/* Header Modal */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white uppercase">
                  {title}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Tanggal · Bulan · Tahun
                </span>
              </div>
              <p className="text-[10px] sm:text-[11.5px] text-slate-300 mt-0.5 leading-snug">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 text-xs">
          {/* Pilihan 4 Mode Sinkronisasi */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wide mb-1.5">
              1. Pilih Rentang / Opsi Sinkronisasi:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  filterMode === 'ALL'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-850 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10.5px] sm:text-[11px]">Semua Data</span>
                  {filterMode === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-slate-400">Seluruh Waktu ({submissions.length} Siswa)</span>
              </button>

              <button
                type="button"
                onClick={handleQuickSetToday}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  filterMode === 'TODAY'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-850 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10.5px] sm:text-[11px]">Hari Ini</span>
                  {filterMode === 'TODAY' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-slate-400">{currentDate.getDate()} {INDO_MONTHS[currentDate.getMonth()]?.label.split('- ')[1]} {currentDate.getFullYear()}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('DATE_FILTER')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  filterMode === 'DATE_FILTER'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-850 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10.5px] sm:text-[11px]">Pilih Spesifik</span>
                  {filterMode === 'DATE_FILTER' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-slate-400">Tanggal / Bulan / Tahun</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('DATE_RANGE')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  filterMode === 'DATE_RANGE'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-850 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10.5px] sm:text-[11px]">Rentang Tanggal</span>
                  {filterMode === 'DATE_RANGE' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[9px] sm:text-[9.5px] text-slate-400">Dari s/d Sampai</span>
              </button>
            </div>
          </div>

          {/* Kontrol Spesifik Tanggal / Bulan / Tahun */}
          {filterMode === 'DATE_FILTER' && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-sky-400" />
                  Pilih Spesifikasi Tanggal, Bulan, & Tahun:
                </span>
                <button
                  type="button"
                  onClick={handleQuickSetThisMonth}
                  className="text-[9.5px] text-emerald-400 hover:underline font-bold"
                >
                  Shortcut: Bulan Ini
                </button>
              </div>

              {/* Grid 3 Dropdown: Tanggal, Bulan, Tahun */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Dropdown Tanggal (1-31) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                    Tanggal (Hari):
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) =>
                      handleDropdownDateChange(
                        e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                      )
                    }
                    className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="ALL">Semua Tanggal (1 - 31)</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Tanggal {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Dropdown Bulan (Januari-Desember) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                    Bulan:
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) =>
                      handleDropdownMonthChange(
                        e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                      )
                    }
                    className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="ALL">Semua Bulan (1 - 12)</option>
                    {INDO_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Dropdown Tahun */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                    Tahun:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) =>
                      handleDropdownYearChange(
                        e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                      )
                    }
                    className="w-full h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="ALL">Semua Tahun</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Tahun {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pemilih Tanggal Kalender Cepat */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">
                  Atau pilih 1 tanggal pasti melalui kalender:
                </span>
                <input
                  type="date"
                  value={specificDateIso}
                  onChange={(e) => handleCalendarInputChange(e.target.value)}
                  className="h-7 px-2 rounded-md bg-slate-900 border border-slate-700 text-white font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
            </div>
          )}

          {/* Kontrol Rentang Tanggal (Mulai Tanggal s/d Sampai Tanggal) */}
          {filterMode === 'DATE_RANGE' && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-teal-400" />
                Rentang Tanggal Sinkronisasi:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                    Dari Tanggal (Mulai):
                  </label>
                  <input
                    type="date"
                    value={startDateIso}
                    onChange={(e) => setStartDateIso(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                    Sampai Tanggal (Selesai):
                  </label>
                  <input
                    type="date"
                    value={endDateIso}
                    onChange={(e) => setEndDateIso(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Banner Status Kecocokan Data Real-Time */}
          <div
            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
              matchedSubmissions.length > 0
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {matchedSubmissions.length > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span className="font-extrabold text-[11px] sm:text-xs">
                  {matchedSubmissions.length > 0
                    ? `Ditemukan ${matchedSubmissions.length} Data Siswa yang Akan Disinkronkan`
                    : 'Tidak Ada Data Siswa pada Filter Ini'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10">
                Total Sistem: {submissions.length}
              </span>
            </div>

            <p className="text-[10.5px] leading-relaxed text-slate-300">
              {matchedSubmissions.length > 0
                ? filterMode === 'ALL'
                  ? `Seluruh riwayat ujian (${matchedSubmissions.length} siswa) akan dikirim dan disinkronkan ke Google Sheets Rekap Hasil Ujian (13 Kolom) & Cloud Server.`
                  : `Hanya ${matchedSubmissions.length} data siswa pada filter ini yang akan disinkronkan ke Google Sheets & Cloud Server.`
                : 'Data ujian pada tanggal/bulan/tahun tersebut belum tercatat. Anda tetap dapat memilih "Semua Data" jika ingin menyinkronkan seluruh riwayat ujian.'}
            </p>
          </div>

          {/* Preview Ringkasan Daftar Siswa Terpilih (Maksimal 6 preview) */}
          {matchedSubmissions.length > 0 && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
              <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1 text-slate-300">
                  <Users className="w-3 h-3 text-sky-400" />
                  Pratinjau Siswa Terpilih ({matchedSubmissions.length} Siswa):
                </span>
                <span className="font-mono text-emerald-400 font-bold">13 Kolom Rekap</span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/60 text-[10px]">
                {matchedSubmissions.slice(0, 10).map((sub, idx) => {
                  const p = parseSubmissionDate(sub);
                  return (
                    <div
                      key={sub.id || idx}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-900/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-500 font-mono w-4 shrink-0 text-right">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                            {sub.namaSiswa}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">
                            Kelas {sub.kelas} · {p.formattedIndo || sub.timestamp || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-emerald-400">
                          Nilai: {sub.nilaiAkhir ?? '-'}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold ${
                            sub.lulusTidakLulus === 'Lulus'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {sub.lulusTidakLulus || 'Selesai'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {matchedSubmissions.length > 10 && (
                  <div className="px-3 py-1 text-center text-slate-500 text-[9px] italic bg-slate-900/30">
                    ... dan {matchedSubmissions.length - 10} data siswa lainnya siap disinkronkan
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Format 13 Kolom Google Sheets terlindungi utuh</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSyncing || (matchedSubmissions.length === 0 && filterMode !== 'ALL')}
              className={`px-4 py-1.5 rounded-lg font-extrabold text-xs transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${
                isSyncing
                  ? 'bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 hover:shadow-emerald-500/25 active:scale-[0.98]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Sedang Menyinkronkan...'
                  : filterMode === 'ALL'
                  ? `Mulai Sinkronkan Semua (${submissions.length} Data)`
                  : `Mulai Sinkronkan (${matchedSubmissions.length} Data)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
