import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  UserCheck,
  CheckCircle2,
  Printer,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  SchoolScheduleConfig,
  SchoolDayName,
  SCHOOL_DAYS_LIST,
  SubjectScheduleSession,
  DailyScheduleConfig,
  INITIAL_JADWAL_HARIAN,
  KelasWaliKelasMaster,
  getCurrentIndonesianSchoolDay,
} from '../utils/biometricAttendance';

interface WeeklyAttendanceScheduleTableProps {
  scheduleConfig: SchoolScheduleConfig;
  selectedScheduleDay: SchoolDayName;
  activeSubjectSessionId?: string;
  kelasList: KelasWaliKelasMaster[];
  onSelectDayAndSession: (day: SchoolDayName, sessionId?: string) => void;
  onOpenScheduleSettings?: (day?: SchoolDayName) => void;
  onDeleteSession?: (day: SchoolDayName, sessionId: string) => void;
  defaultExpanded?: boolean;
}

export const WeeklyAttendanceScheduleTable: React.FC<WeeklyAttendanceScheduleTableProps> = ({
  scheduleConfig,
  selectedScheduleDay,
  activeSubjectSessionId,
  kelasList,
  onSelectDayAndSession,
  onOpenScheduleSettings,
  onDeleteSession,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [viewMode, setViewMode] = useState<'MATRIX_MINGGUAN' | 'TABEL_DAFTAR'>('MATRIX_MINGGUAN');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [filterHari, setFilterHari] = useState<'ALL' | SchoolDayName>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const todaySchoolDay = useMemo(() => getCurrentIndonesianSchoolDay(), []);

  const jadwalHarianMap: Record<SchoolDayName, DailyScheduleConfig> = useMemo(() => {
    return {
      ...INITIAL_JADWAL_HARIAN,
      ...(scheduleConfig.jadwalHarian || {}),
    };
  }, [scheduleConfig.jadwalHarian]);

  // Kumpulkan seluruh sesi jadwal dari Senin s/d Sabtu
  const allWeeklySessions = useMemo(() => {
    const list: Array<{
      day: SchoolDayName;
      dayConfig: DailyScheduleConfig;
      session: SubjectScheduleSession;
    }> = [];

    SCHOOL_DAYS_LIST.forEach((day) => {
      const dayCfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
      const sessions = [...(dayCfg.sesiMapel || [])].sort((a, b) =>
        a.jamMulai.localeCompare(b.jamMulai)
      );
      sessions.forEach((session) => {
        const matchKelas =
          filterKelas === 'ALL' ||
          session.kelasTarget === 'ALL' ||
          session.kelasTarget.toLowerCase() === filterKelas.toLowerCase();
        const matchHari = filterHari === 'ALL' || day === filterHari;
        const q = searchQuery.trim().toLowerCase();
        const matchSearch =
          !q ||
          session.mataPelajaran.toLowerCase().includes(q) ||
          session.guruPengampu.toLowerCase().includes(q) ||
          session.kelasTarget.toLowerCase().includes(q) ||
          (session.keterangan || '').toLowerCase().includes(q) ||
          day.toLowerCase().includes(q);

        if (matchKelas && matchHari && matchSearch) {
          list.push({ day, dayConfig: dayCfg, session });
        }
      });
    });

    return list;
  }, [jadwalHarianMap, filterKelas, filterHari, searchQuery]);

  // Maksimum jumlah sesi per hari untuk baris tabel matriks mingguan
  const maxSessionsPerDay = useMemo(() => {
    let max = 2;
    SCHOOL_DAYS_LIST.forEach((day) => {
      const dayCfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
      const filteredCount = (dayCfg.sesiMapel || []).filter((s) => {
        const matchKelas =
          filterKelas === 'ALL' ||
          s.kelasTarget === 'ALL' ||
          s.kelasTarget.toLowerCase() === filterKelas.toLowerCase();
        const q = searchQuery.trim().toLowerCase();
        const matchSearch =
          !q ||
          s.mataPelajaran.toLowerCase().includes(q) ||
          s.guruPengampu.toLowerCase().includes(q) ||
          s.kelasTarget.toLowerCase().includes(q) ||
          (s.keterangan || '').toLowerCase().includes(q);
        return matchKelas && matchSearch;
      }).length;
      if (filteredCount > max) max = filteredCount;
    });
    return max;
  }, [jadwalHarianMap, filterKelas, searchQuery]);

  const totalWeeklySessionsCount = useMemo(() => {
    return SCHOOL_DAYS_LIST.reduce((acc, day) => {
      const cfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
      return acc + (cfg.sesiMapel?.length || 0);
    }, 0);
  }, [jadwalHarianMap]);

  const activeDaysCount = useMemo(() => {
    return SCHOOL_DAYS_LIST.filter((day) => {
      const cfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
      return cfg.aktif;
    }).length;
  }, [jadwalHarianMap]);

  const handlePrintWeeklySchedule = () => {
    const existingFrame = document.getElementById('anbk-print-weekly-schedule-frame');
    if (existingFrame && existingFrame.parentNode) {
      existingFrame.parentNode.removeChild(existingFrame);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'anbk-print-weekly-schedule-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc) return;

    const rowsHtml = allWeeklySessions
      .map(
        (item, idx) => `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>Hari ${item.day}</strong><br/><span style="font-size:11px;color:#475569;">Masuk: ${item.dayConfig.jamMasuk} - Pulang: ${item.dayConfig.jamPulang} WIB</span></td>
          <td style="font-family:monospace;font-weight:bold;">${item.session.jamMulai} - ${item.session.jamSelesai} WIB</td>
          <td style="font-family:monospace;color:#b45309;font-weight:bold;">${item.session.jamBatasToleransi} WIB</td>
          <td><strong>${item.session.mataPelajaran}</strong>${item.session.keterangan ? `<br/><span style="font-size:11px;color:#475569;">${item.session.keterangan}</span>` : ''}</td>
          <td style="text-align:center;font-weight:bold;">${item.session.kelasTarget === 'ALL' ? 'Semua Kelas' : item.session.kelasTarget}</td>
          <td>${item.session.guruPengampu}</td>
          <td style="text-align:center;">${item.dayConfig.aktif && item.session.aktif ? 'AKTIF' : 'NONAKTIF'}</td>
        </tr>`
      )
      .join('');

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Tabel Jadwal Absensi Mingguan - ${scheduleConfig.schoolName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { font-size: 18px; margin: 0 0 4px 0; text-transform: uppercase; }
          p { font-size: 12px; margin: 0 0 16px 0; color: #334155; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; }
          th { background: #1e293b; color: #ffffff; text-align: left; }
          tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>TABEL JADWAL ABSENSI MINGGUAN SISWA (SENIN S/D SABTU)</h1>
        <p>${scheduleConfig.schoolName} • ${scheduleConfig.alamatSekolah}</p>
        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center;">No</th>
              <th>Hari & Jam Sekolah</th>
              <th>Jam Absensi Mapel</th>
              <th>Batas Toleransi</th>
              <th>Mata Pelajaran & Agenda</th>
              <th style="text-align:center;">Target Kelas</th>
              <th>Guru Pengampu</th>
              <th style="width:80px;text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align:center;">Tidak ada jadwal absensi.</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `);
    frameDoc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {}
    }, 300);
  };

  return (
    <div className="rounded-xl border border-indigo-500/35 bg-slate-900/95 shadow-lg overflow-hidden">
      {/* Header Visualisasi Tabel Mingguan */}
      <div className="p-2 sm:p-2.5 bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-950 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-1.5">
        <div className="flex items-start sm:items-center gap-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1">
              <h3 className="text-[11px] sm:text-xs lg:text-[13px] font-extrabold text-white tracking-tight">
                Tabel Visualisasi Jadwal Absensi Mingguan (Senin – Sabtu)
              </h3>
              <span className="text-[8px] sm:text-[9px] font-mono text-indigo-300 px-1 py-0.2 rounded bg-indigo-500/20 border border-indigo-400/30">
                {activeDaysCount} Hari Aktif · {totalWeeklySessionsCount} Sesi Terjadwal
              </span>
            </div>
            <p className="text-[8px] sm:text-[9.5px] text-slate-300 mt-0.5 leading-snug">
              Daftar lengkap jadwal absensi siswa berdasarkan hari, jam masuk/pulang, batas toleransi keterlambatan, dan sesi mata pelajaran. Klik pada kartu/baris jadwal untuk mengaktifkan sesi absensi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 shrink-0">
          {/* Segmented Switch Mode Tampilan */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-md border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('MATRIX_MINGGUAN')}
              className={`h-5 sm:h-5.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[9px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'MATRIX_MINGGUAN'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matriks Mingguan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABEL_DAFTAR')}
              className={`h-5 sm:h-5.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[9px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'TABEL_DAFTAR'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tabel Detail Hari &amp; Jam
            </button>
          </div>

          {onOpenScheduleSettings && (
            <button
              type="button"
              onClick={() => onOpenScheduleSettings(selectedScheduleDay)}
              className="h-5 sm:h-5.5 px-2 rounded-md bg-purple-600/90 hover:bg-purple-500 text-white text-[8px] sm:text-[9px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-2xs"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Kelola Jadwal</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintWeeklySchedule}
            className="h-5 sm:h-5.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[8px] sm:text-[9px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-2xs"
            title="Cetak Tabel Jadwal Absensi Mingguan"
          >
            <Printer className="w-2.5 h-2.5 text-indigo-300" />
            <span className="hidden sm:inline">Cetak Jadwal</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="h-5 sm:h-5.5 px-2 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 text-[8px] sm:text-[9px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shadow-2xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-2.5 h-2.5" />
                <span>Sembunyikan</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-2.5 h-2.5" />
                <span>Tampilkan Tabel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-2 sm:p-2.5 space-y-2">
          {/* Baris Filter Kelas, Filter Hari, dan Pencarian Cepat */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-slate-950/80 p-1.5 sm:p-2 rounded-lg border border-white/10">
            <div>
              <label className="text-[8px] sm:text-[9px] font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                <Filter className="w-2 h-2 text-indigo-400" />
                <span>Filter Kelas Target:</span>
              </label>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full h-5.5 sm:h-6 px-2 py-0.5 rounded-md bg-slate-900 border border-white/15 text-[8.5px] sm:text-[9.5px] text-white font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="ALL">Semua Kelas (VII &amp; VIII)</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.namaKelas}>
                    Kelas {k.namaKelas} — {k.namaWaliKelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[8px] sm:text-[9px] font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                <Calendar className="w-2 h-2 text-indigo-400" />
                <span>Filter Hari Sekolah:</span>
              </label>
              <select
                value={filterHari}
                onChange={(e) => setFilterHari(e.target.value as 'ALL' | SchoolDayName)}
                className="w-full h-5.5 sm:h-6 px-2 py-0.5 rounded-md bg-slate-900 border border-white/15 text-[8.5px] sm:text-[9.5px] text-white font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="ALL">Seluruh Hari (Senin s/d Sabtu)</option>
                {SCHOOL_DAYS_LIST.map((day) => (
                  <option key={day} value={day}>
                    Hari {day} {day === todaySchoolDay ? '(Hari Ini)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[8px] sm:text-[9px] font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                <Search className="w-2 h-2 text-indigo-400" />
                <span>Cari Mapel / Guru / Jam:</span>
              </label>
              <div className="relative">
                <Search className="w-2.5 h-2.5 text-slate-500 absolute left-2 top-1.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik mapel, kelas, atau nama guru..."
                  className="w-full h-5.5 sm:h-6 pl-6 pr-2 py-0.5 rounded-md bg-slate-900 border border-white/15 text-[8.5px] sm:text-[9.5px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* MODE 1: TABEL MATRIKS MINGGUAN (KOLOM SENIN S/D SABTU) */}
          {viewMode === 'MATRIX_MINGGUAN' && (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-[8.5px] sm:text-[9.5px] border-collapse min-w-[840px]">
                <thead>
                  <tr className="bg-slate-950 border-b border-white/10">
                    <th className="py-2 px-2.5 w-32 font-bold text-slate-300 border-r border-white/10 bg-slate-950/90">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>Parameter / Sesi</span>
                      </div>
                    </th>
                    {(filterHari === 'ALL' ? SCHOOL_DAYS_LIST : [filterHari]).map((day) => {
                      const dayCfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
                      const isSelected = selectedScheduleDay === day;
                      const isToday = todaySchoolDay === day;

                      return (
                        <th
                          key={day}
                          onClick={() => onSelectDayAndSession(day)}
                          className={`py-2 px-2.5 border-r border-white/10 last:border-r-0 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-950/80 text-white'
                              : 'bg-slate-950/70 text-slate-200 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-[11px] tracking-wide flex items-center gap-1">
                              <span>Hari {day}</span>
                              {isToday && (
                                <span className="text-[9.5px] font-bold text-emerald-400">
                                  · Hari Ini
                                </span>
                              )}
                            </span>
                            <span
                              className={`text-[9.5px] font-mono font-bold ${
                                dayCfg.aktif ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {dayCfg.aktif ? 'Aktif' : 'Libur'}
                            </span>
                          </div>
                          <div className="text-[10px] font-normal text-slate-400 mt-0.5 truncate max-w-[160px]">
                            {dayCfg.catatanHari || `Jadwal Hari ${day}`}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {/* Baris 1: Jam Operasional Presensi Harian (Masuk, Toleransi, Pulang) */}
                  <tr className="bg-slate-950/50">
                    <td className="py-1.5 px-2 font-bold text-slate-300 border-r border-white/10 align-top">
                      <span className="block text-[9.5px] sm:text-[10.5px] font-extrabold text-white">Jam Presensi Umum</span>
                      <span className="text-[8px] sm:text-[8.5px] text-slate-400 font-normal">
                        Masuk · Toleransi · Pulang
                      </span>
                    </td>
                    {(filterHari === 'ALL' ? SCHOOL_DAYS_LIST : [filterHari]).map((day) => {
                      const dayCfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
                      const isSelected = selectedScheduleDay === day;

                      return (
                        <td
                          key={`jam-${day}`}
                          onClick={() => onSelectDayAndSession(day)}
                          className={`py-1.5 px-2 border-r border-white/10 last:border-r-0 align-top cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-950/30' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className="space-y-0.5 font-mono text-[8.5px] sm:text-[9.5px] tabular-nums">
                            <div className="flex items-center justify-between text-emerald-300">
                              <span className="text-slate-400 font-sans">Masuk:</span>
                              <strong>{dayCfg.jamMasuk} WIB</strong>
                            </div>
                            <div className="flex items-center justify-between text-amber-300">
                              <span className="text-slate-400 font-sans">Telat:</span>
                              <strong>{dayCfg.jamBatasToleransi} WIB</strong>
                            </div>
                            <div className="flex items-center justify-between text-sky-300">
                              <span className="text-slate-400 font-sans">Pulang:</span>
                              <strong>{dayCfg.jamPulang} WIB</strong>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Baris Sesi Mata Pelajaran (Sesi Ke-1, Ke-2, dst.) */}
                  {Array.from({ length: maxSessionsPerDay }).map((_, sessionIdx) => (
                    <tr key={`sesi-row-${sessionIdx}`} className="hover:bg-white/[0.01]">
                      <td className="py-1.5 px-2 font-bold text-slate-300 border-r border-white/10 align-top bg-slate-950/40">
                        <div className="flex items-center gap-1 text-indigo-300">
                          <BookOpen className="w-2.5 h-2.5 shrink-0" />
                          <span className="text-[9px] sm:text-[10px]">Sesi Mapel #{sessionIdx + 1}</span>
                        </div>
                        <span className="text-[7.5px] sm:text-[8px] text-slate-400 font-normal block mt-0.5">
                          Klik sesi untuk mengaktifkan
                        </span>
                      </td>

                      {(filterHari === 'ALL' ? SCHOOL_DAYS_LIST : [filterHari]).map((day) => {
                        const dayCfg = jadwalHarianMap[day] || INITIAL_JADWAL_HARIAN[day];
                        const filteredDaySessions = [...(dayCfg.sesiMapel || [])]
                          .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
                          .filter((s) => {
                            const matchKelas =
                              filterKelas === 'ALL' ||
                              s.kelasTarget === 'ALL' ||
                              s.kelasTarget.toLowerCase() === filterKelas.toLowerCase();
                            const q = searchQuery.trim().toLowerCase();
                            const matchSearch =
                              !q ||
                              s.mataPelajaran.toLowerCase().includes(q) ||
                              s.guruPengampu.toLowerCase().includes(q) ||
                              s.kelasTarget.toLowerCase().includes(q) ||
                              (s.keterangan || '').toLowerCase().includes(q);
                            return matchKelas && matchSearch;
                          });

                        const sesi = filteredDaySessions[sessionIdx];
                        const isSessionSelected =
                          selectedScheduleDay === day &&
                          activeSubjectSessionId === sesi?.id;

                        return (
                          <td
                            key={`cell-${day}-${sessionIdx}`}
                            className={`p-1 sm:p-1.5 border-r border-white/10 last:border-r-0 align-top ${
                              selectedScheduleDay === day ? 'bg-indigo-950/20' : ''
                            }`}
                          >
                            {sesi ? (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelectDayAndSession(day, sesi.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    onSelectDayAndSession(day, sesi.id);
                                  }
                                }}
                                className={`p-1.5 rounded-md border transition-all cursor-pointer space-y-0.5 ${
                                  isSessionSelected
                                    ? 'bg-indigo-950/90 border-indigo-400 shadow-2xs ring-1 ring-indigo-300/60'
                                    : 'bg-slate-950/80 border-white/10 hover:border-indigo-400/50 hover:bg-slate-900'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono text-[8.5px] sm:text-[9.5px] font-extrabold text-emerald-300 tabular-nums">
                                    {sesi.jamMulai} – {sesi.jamSelesai}
                                  </span>
                                  <span className="text-[7.5px] sm:text-[8.5px] font-extrabold text-sky-300">
                                    {sesi.kelasTarget === 'ALL' ? 'Semua' : `Kls ${sesi.kelasTarget}`}
                                  </span>
                                </div>

                                <div className="font-bold text-white text-[9px] sm:text-[10px] leading-snug">
                                  {sesi.mataPelajaran}
                                </div>

                                <div className="text-[8px] sm:text-[8.5px] text-slate-300 truncate">
                                  {sesi.guruPengampu}
                                </div>

                                <div className="flex items-center justify-between pt-0.5 border-t border-white/10 text-[7.5px] sm:text-[8px] font-mono tabular-nums">
                                  <span className="text-amber-300">
                                    Telat: {sesi.jamBatasToleransi}
                                  </span>
                                  {isSessionSelected ? (
                                    <span className="text-emerald-300 font-sans font-extrabold flex items-center gap-0.5">
                                      <Check className="w-2 h-2" /> Aktif
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-sans hover:text-white">
                                      Pilih →
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="h-full min-h-[50px] rounded-md border border-dashed border-white/5 flex items-center justify-center text-[8px] text-slate-600">
                                — Kosong —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MODE 2: TABEL DAFTAR DETAIL HARI & JAM (URUT SENIN S/D SABTU) */}
          {viewMode === 'TABEL_DAFTAR' && (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 font-bold border-b border-white/10">
                    <th className="py-2 px-2.5 w-9 text-center">No</th>
                    <th className="py-2 px-2.5">Hari &amp; Jam Sekolah</th>
                    <th className="py-2 px-2.5">Jam Absensi Mapel</th>
                    <th className="py-2 px-2.5">Batas Toleransi</th>
                    <th className="py-2 px-2.5">Mata Pelajaran &amp; Materi</th>
                    <th className="py-2 px-2.5">Target Kelas</th>
                    <th className="py-2 px-2.5">Guru Pengampu</th>
                    <th className="py-2 px-2.5 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {allWeeklySessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        Tidak ada jadwal absensi mingguan yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    allWeeklySessions.map(({ day, dayConfig, session }, index) => {
                      const isSelected =
                        selectedScheduleDay === day && activeSubjectSessionId === session.id;
                      const isToday = todaySchoolDay === day;

                      return (
                        <tr
                          key={session.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-indigo-950/50'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <td className="py-2 px-2.5 font-mono text-center text-slate-400 tabular-nums">
                            {index + 1}
                          </td>
                          <td className="py-2 px-2.5">
                            <div className="flex items-center gap-1">
                              <span className="font-extrabold text-white">Hari {day}</span>
                              {isToday && (
                                <span className="text-[9.5px] font-bold text-emerald-400">
                                  · Hari Ini
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                              Sekolah: {dayConfig.jamMasuk} – {dayConfig.jamPulang} WIB
                            </div>
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                            {session.jamMulai} – {session.jamSelesai} WIB
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap">
                            {session.jamBatasToleransi} WIB
                          </td>
                          <td className="py-2 px-2.5">
                            <div className="font-bold text-white">{session.mataPelajaran}</div>
                            {session.keterangan && (
                              <div className="text-[10px] text-slate-400">{session.keterangan}</div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-sky-300 whitespace-nowrap">
                            {session.kelasTarget === 'ALL'
                              ? 'Semua Kelas'
                              : `Kelas ${session.kelasTarget}`}
                          </td>
                          <td className="py-2 px-2.5 text-slate-200">{session.guruPengampu}</td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              onClick={() => onSelectDayAndSession(day, session.id)}
                              className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                            >
                              {isSelected ? 'Sesi Aktif ✓' : 'Gunakan Jadwal'}
                            </button>
                            {onDeleteSession && (
                              <button
                                type="button"
                                onClick={() => onDeleteSession(day, session.id)}
                                className="p-1 rounded-md bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer inline-flex items-center"
                                title="Hapus Sesi Jadwal Ini"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Keterangan Status Jadwal Aktif */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5 text-[10.5px] text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Jadwal Terpilih Saat Ini:{' '}
                <strong className="text-white">Hari {selectedScheduleDay}</strong>
              </span>
              <span>·</span>
              <span>
                Total Sesi Ditampilkan:{' '}
                <strong className="text-indigo-300 font-mono tabular-nums">
                  {allWeeklySessions.length} Sesi
                </strong>
              </span>
            </div>
            <div className="text-slate-400">
              Ketuk salah satu jadwal di tabel untuk mengaktifkan presensi pada hari &amp; jam tersebut.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
