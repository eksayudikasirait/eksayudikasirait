import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Question,
  StudentSubmission,
  EXAM_INFO,
  resolveStudentPhotoForSheet,
  getCleanKelas,
  getSemesterFromSub,
} from '../data/examData';
import { TutWuriLogo } from './TutWuriLogo';
import { getStudentInitials } from './StudentCameraProfileModal';
import {
  Printer,
  ArrowLeft,
  Award,
  CheckCircle2,
  XCircle,
  UserCheck,
  FileText,
  Search,
  Filter,
  BarChart3,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Laptop,
  GraduationCap,
  Sparkles,
  TrendingUp,
  ChevronRight,
  BookOpen,
  Info,
} from 'lucide-react';

export interface RaporSiswaProps {
  submissions: StudentSubmission[];
  questions?: Question[];
  initialSelectedId?: string;
  onBack?: () => void;
  onViewDetail?: (sub: StudentSubmission) => void;
  onStartExamForStudent?: (sub?: StudentSubmission) => void;
}

export const RaporSiswa: React.FC<RaporSiswaProps> = ({
  submissions,
  questions = [],
  initialSelectedId,
  onBack,
  onViewDetail,
  onStartExamForStudent,
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialSelectedId && submissions.some((s) => s.id === initialSelectedId)) {
      return initialSelectedId;
    }
    return submissions[0]?.id || '';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [kelasFilter, setKelasFilter] = useState<string>('ALL');
  const [semesterFilter, setSemesterFilter] = useState<'ALL' | 'Ganjil' | 'Genap'>('ALL');
  const [activeChartTab, setActiveChartTab] = useState<
    'KOMPETENSI' | 'PERBANDINGAN' | 'HOTS_REGULER' | 'DISTRIBUSI_KELAS'
  >('KOMPETENSI');
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Animasi Transisi Masuk Fade-In
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isChartVisible, setIsChartVisible] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsChartVisible(false);
    const timer = setTimeout(() => {
      setIsChartVisible(true);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeChartTab, selectedId, kelasFilter, semesterFilter]);

  // Filter submissions berdasarkan Kelas, Semester, dan Pencarian
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // 1. Filter Kelas
      if (kelasFilter !== 'ALL') {
        const cleanSubKelas = getCleanKelas(sub.kelas);
        if (kelasFilter === 'VII' && !cleanSubKelas.startsWith('VII-')) return false;
        if (kelasFilter === 'VIII' && !cleanSubKelas.startsWith('VIII-')) return false;
        if (kelasFilter.includes('-') && cleanSubKelas !== kelasFilter) return false;
      }
      // 2. Filter Semester
      if (semesterFilter !== 'ALL') {
        const subSemester = getSemesterFromSub(sub);
        if (subSemester !== semesterFilter) return false;
      }
      // 3. Filter Pencarian Nama / NISN
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = sub.namaSiswa.toLowerCase().includes(q);
        const matchNis = (sub.nisNisn || '').toLowerCase().includes(q);
        const matchKelas = (sub.kelas || '').toLowerCase().includes(q);
        if (!matchName && !matchNis && !matchKelas) return false;
      }
      return true;
    });
  }, [submissions, kelasFilter, semesterFilter, searchQuery]);

  // Sinkronkan selectedId saat filter kelas atau semester berubah
  useEffect(() => {
    if (filteredSubmissions.length > 0) {
      const stillInList = filteredSubmissions.some((s) => s.id === selectedId);
      if (!stillInList) {
        setSelectedId(filteredSubmissions[0].id);
      }
    }
  }, [filteredSubmissions, selectedId]);

  // Currently selected submission
  const currentSub = useMemo(() => {
    if (selectedId) {
      const found = submissions.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return filteredSubmissions[0] || submissions[0] || null;
  }, [selectedId, submissions, filteredSubmissions]);

  // Available unique classes
  const availableKelasList = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      const k = getCleanKelas(s.kelas);
      if (k) set.add(k);
    });
    return Array.from(set).sort();
  }, [submissions]);

  // Hitung statistik untuk kelompok kelas & semester terfilter
  const classStats = useMemo(() => {
    const target = filteredSubmissions.length > 0 ? filteredSubmissions : submissions;
    if (target.length === 0) return { avg: 0, highest: 0, lowest: 0, total: 0, passed: 0 };

    const scores = target.map((s) => Number(s.nilaiAkhir || 0));
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / target.length);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passed = target.filter((s) => Number(s.nilaiAkhir || 0) >= EXAM_INFO.kkm).length;

    return { avg, highest, lowest, total: target.length, passed };
  }, [filteredSubmissions, submissions]);

  // Chart 1: Kompetensi per Elemen Materi Informatika (Fase D)
  const elemenChartData = useMemo(() => {
    if (!currentSub) return [];

    // Map default elements if question data has elemen
    const defaultElements = [
      'Sistem Komputer (SK)',
      'Jaringan Komputer & Internet (JKI)',
      'Analisis Data (AD)',
      'Algoritma & Pemrograman (AP)',
      'Dampak Sosial Informatika (DSI)',
      'Praktik Lintas Bidang (PLB)',
    ];

    const elementMap: Record<string, { total: number; correct: number }> = {};
    defaultElements.forEach((el) => {
      elementMap[el] = { total: 0, correct: 0 };
    });

    if (questions.length > 0) {
      questions.forEach((q, idx) => {
        const qId = q.id ?? idx + 1;
        const qElemen = q.elemen || defaultElements[idx % defaultElements.length];
        if (!elementMap[qElemen]) {
          elementMap[qElemen] = { total: 0, correct: 0 };
        }
        elementMap[qElemen].total += 1;

        const answersMap = currentSub.answers as Record<string | number, string> | undefined;
        const studentAns = answersMap?.[qId] ?? answersMap?.[String(qId)];
        if (studentAns && studentAns.toUpperCase() === q.answer.toUpperCase()) {
          elementMap[qElemen].correct += 1;
        }
      });
    } else {
      // Fallback distribution based on student score
      const totalSoal = currentSub.totalSoal || 10;
      const skorBenar = currentSub.skorBenar || Math.round((currentSub.nilaiAkhir / 100) * totalSoal);
      const ratio = totalSoal > 0 ? skorBenar / totalSoal : 0.75;

      defaultElements.forEach((el, i) => {
        const weight = 2;
        const simulatedScore = Math.min(
          100,
          Math.max(20, Math.round(ratio * 100 + ((i % 3) - 1) * 10))
        );
        elementMap[el] = {
          total: weight,
          correct: Math.round((simulatedScore / 100) * weight),
        };
      });
    }

    return Object.entries(elementMap)
      .filter(([, val]) => val.total > 0)
      .map(([elemen, val]) => {
        const persentase = val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0;
        return {
          elemen: elemen.replace(/\s*\([^)]*\)/, ''), // shortened label
          elemenFull: elemen,
          skor: persentase,
          benar: val.correct,
          total: val.total,
          isPassed: persentase >= EXAM_INFO.kkm,
        };
      });
  }, [currentSub, questions]);

  // Chart 2: Perbandingan Nilai Siswa vs KKM vs Rata-Rata Kelas & Semester Terfilter
  const perbandinganChartData = useMemo(() => {
    if (!currentSub) return [];
    const allScores = submissions.map((s) => Number(s.nilaiAkhir || 0));
    const allAvg =
      allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 75;

    const kelasLabel = kelasFilter === 'ALL' ? `Kelas ${currentSub.kelas}` : `Kelas ${kelasFilter}`;
    const semLabel = semesterFilter === 'ALL' ? '' : ` (${semesterFilter})`;

    return [
      {
        kategori: 'Nilai Siswa',
        nilai: Number(currentSub.nilaiAkhir || 0),
        keterangan: `${currentSub.namaSiswa} (${currentSub.nilaiAkhir}%)`,
        fill: Number(currentSub.nilaiAkhir || 0) >= EXAM_INFO.kkm ? '#10b981' : '#f43f5e',
      },
      {
        kategori: 'Standar KKM',
        nilai: EXAM_INFO.kkm,
        keterangan: `Target Kelulusan (${EXAM_INFO.kkm}%)`,
        fill: '#f59e0b',
      },
      {
        kategori: 'Rata-Rata Terfilter',
        nilai: classStats.avg,
        keterangan: `${kelasLabel}${semLabel} (${classStats.avg}%)`,
        fill: '#38bdf8',
      },
      {
        kategori: 'Rata-Rata Sekolah',
        nilai: allAvg,
        keterangan: `Seluruh Peserta (${allAvg}%)`,
        fill: '#818cf8',
      },
    ];
  }, [currentSub, classStats, submissions, kelasFilter, semesterFilter]);

  // Chart 3: Capaian Soal HOTS vs Soal Reguler
  const hotsRegulerChartData = useMemo(() => {
    if (!currentSub) return [];

    let hotsTotal = 0;
    let hotsCorrect = 0;
    let regTotal = 0;
    let regCorrect = 0;

    if (questions.length > 0) {
      questions.forEach((q, idx) => {
        const qId = q.id ?? idx + 1;
        const answersMap = currentSub.answers as Record<string | number, string> | undefined;
        const studentAns = answersMap?.[qId] ?? answersMap?.[String(qId)];
        const isCorrect = studentAns && studentAns.toUpperCase() === q.answer.toUpperCase();

        if (q.difficulty === 'HOTS') {
          hotsTotal += 1;
          if (isCorrect) hotsCorrect += 1;
        } else {
          regTotal += 1;
          if (isCorrect) regCorrect += 1;
        }
      });
    }

    if (hotsTotal === 0 && regTotal === 0) {
      const total = currentSub.totalSoal || 10;
      const benar = currentSub.skorBenar || 7;
      hotsTotal = Math.round(total * 0.4);
      regTotal = total - hotsTotal;
      hotsCorrect = Math.min(hotsTotal, Math.round(benar * 0.4));
      regCorrect = Math.max(0, benar - hotsCorrect);
    }

    const hotsPct = hotsTotal > 0 ? Math.round((hotsCorrect / hotsTotal) * 100) : 0;
    const regPct = regTotal > 0 ? Math.round((regCorrect / regTotal) * 100) : 0;

    return [
      {
        kategori: 'Soal Penalaran (HOTS)',
        persentase: hotsPct,
        benar: hotsCorrect,
        total: hotsTotal,
        fill: hotsPct >= EXAM_INFO.kkm ? '#10b981' : '#f59e0b',
      },
      {
        kategori: 'Soal Konseptual (Reguler)',
        persentase: regPct,
        benar: regCorrect,
        total: regTotal,
        fill: regPct >= EXAM_INFO.kkm ? '#10b981' : '#38bdf8',
      },
    ];
  }, [currentSub, questions]);

  // Chart 4: Grafik Batang Distribusi / Peringkat Siswa Berdasarkan Filter Kelas & Semester
  const classDistributionBarData = useMemo(() => {
    const target = filteredSubmissions.length > 0 ? filteredSubmissions : submissions;

    return target
      .slice(0, 20)
      .map((s, idx) => ({
        nama: s.namaSiswa.length > 12 ? `${s.namaSiswa.slice(0, 10)}...` : s.namaSiswa,
        namaLengkap: s.namaSiswa,
        nilai: Number(s.nilaiAkhir || 0),
        kelas: s.kelas,
        semester: getSemesterFromSub(s),
        isCurrentStudent: currentSub ? s.id === currentSub.id : false,
        isPassed: Number(s.nilaiAkhir || 0) >= EXAM_INFO.kkm,
        ranking: idx + 1,
      }))
      .sort((a, b) => b.nilai - a.nilai);
  }, [filteredSubmissions, submissions, currentSub]);

  // Predikat & Grade Calculation
  const predikatInfo = useMemo(() => {
    if (!currentSub) return { grade: '-', label: '-', color: 'text-slate-300' };
    const score = Number(currentSub.nilaiAkhir || 0);
    if (score >= 90) return { grade: 'A', label: 'Sangat Baik (Istimewa)', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-400' };
    if (score >= 75) return { grade: 'B', label: 'Baik (Tuntas KKM)', color: 'text-sky-300', bg: 'bg-sky-500/20 border-sky-400' };
    if (score >= 60) return { grade: 'C', label: 'Cukup (Perlu Bimbingan)', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-400' };
    return { grade: 'D', label: 'Kurang (Perlu Remedial Intensif)', color: 'text-rose-300', bg: 'bg-rose-500/20 border-rose-400' };
  }, [currentSub]);

  // Automatic Teacher Narrative (Catatan Capaian Pembelajaran Kurikulum Merdeka Fase D)
  const teacherNarrative = useMemo(() => {
    if (!currentSub) return '';
    const score = Number(currentSub.nilaiAkhir || 0);
    const name = currentSub.namaSiswa;
    const isPassed = score >= EXAM_INFO.kkm;

    const highestElem = elemenChartData.reduce(
      (max, cur) => (cur.skor > max.skor ? cur : max),
      elemenChartData[0] || { elemenFull: 'Informatika', skor: 0 }
    );
    const lowestElem = elemenChartData.reduce(
      (min, cur) => (cur.skor < min.skor ? cur : min),
      elemenChartData[0] || { elemenFull: 'Informatika', skor: 0 }
    );

    if (isPassed) {
      return `Ananda ${name} telah menunjukkan capaian pembelajaran yang SANGAT MEMUASKAN pada asesmen Informatika Fase D tingkat SMP Tahun Ajaran 2026/2027. Menguasai materi dengan predikat ${predikatInfo.grade} (${predikatInfo.label}) dan menuntaskan standar KKM (${score}% / KKM ${EXAM_INFO.kkm}%). Menunjukkan keunggulan penalaran komputasional terutama pada domain ${highestElem?.elemenFull || 'Informatika'}. Terus pertahankan prestasi dan kembangkan potensi literasi digital serta problem solving ke tingkat yang lebih mahir.`;
    }
    return `Ananda ${name} telah menyelesaikan asesmen sumatif Informatika Fase D dengan nilai akhir ${score}%. Mengingat capaian masih berada di bawah standar kriteria ketuntasan minimal (KKM ${EXAM_INFO.kkm}%), ananda disarankan mengikuti program remedial terstruktur dan pendalaman materi, khususnya pada domain ${lowestElem?.elemenFull || 'Informatika'}. Tetap semangat belajar dan konsultasikan materi yang belum dipahami kepada Guru Mata Pelajaran.`;
  }, [currentSub, predikatInfo, elemenChartData]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 py-2.5 sm:py-3 px-2 sm:px-4 lg:px-5 space-y-2.5 sm:space-y-3 transition-all duration-700 ease-out ${
        isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } animate-rapor-fade-in`}
    >
      {/* =================================================================== */}
      {/* 1. TOP BAR NAVIGASI & KONTROL (TIDAK TERCETAK SAAT PRINT) */}
      {/* =================================================================== */}
      <div className="print:hidden max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-900/90 border border-sky-500/30 rounded-xl p-2.5 sm:p-3 shadow-md">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-amber-300">
              <span>KURIKULUM MERDEKA · FASE D</span>
              <span className="text-white/40">/</span>
              <span className="text-sky-300">RAPOR HASIL UJIAN SISWA</span>
            </div>
            <h1 className="text-xs sm:text-sm font-extrabold text-white leading-tight">
              Rapor Asesmen Sumatif &amp; Grafik Batang Capaian Siswa
            </h1>
          </div>
        </div>

        {/* Tombol Cetak & Aksi */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrint}
            className="h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-3 h-3" />
            <span>Cetak / Simpan PDF Rapor</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-7 px-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Kembali</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. FILTER KELAS, SEMESTER & PEMILIH SISWA (TIDAK TERCETAK SAAT PRINT) */}
      {/* =================================================================== */}
      <div className="print:hidden max-w-6xl mx-auto bg-slate-900/80 border border-white/10 rounded-xl p-2.5 sm:p-3 shadow-md space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-center">
          {/* 1. Filter Kelas */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-sky-300 flex items-center gap-1">
              <Filter className="w-3 h-3 text-sky-400" />
              <span>Filter Kelas:</span>
            </label>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="w-full h-7.5 px-2.5 rounded-lg bg-slate-950 border border-white/20 text-white text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              <option value="ALL">Semua Kelas (VII &amp; VIII)</option>
              <option value="VII">Jenjang Kelas VII (Semua)</option>
              <option value="VIII">Jenjang Kelas VIII (Semua)</option>
              {availableKelasList.map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filter Semester */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-400" />
              <span>Filter Semester:</span>
            </label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value as 'ALL' | 'Ganjil' | 'Genap')}
              className="w-full h-7.5 px-2.5 rounded-lg bg-slate-950 border border-white/20 text-white text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              <option value="ALL">Semua Semester (Ganjil &amp; Genap)</option>
              <option value="Ganjil">Semester Ganjil (Smt 1)</option>
              <option value="Genap">Semester Genap (Smt 2)</option>
            </select>
          </div>

          {/* 3. Pencarian Siswa */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Cari Nama / NISN:</span>
            </label>
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama atau NISN..."
                className="w-full h-7.5 pl-7.5 pr-2.5 rounded-lg bg-slate-950 border border-white/20 text-white placeholder:text-slate-400 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* 4. Pilihan Siswa Spesifik */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-emerald-300 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span>Pilih Siswa ({filteredSubmissions.length}):</span>
              </span>
              {(kelasFilter !== 'ALL' || semesterFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setKelasFilter('ALL');
                    setSemesterFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-[9.5px] text-amber-300 hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-7.5 px-2.5 rounded-lg bg-slate-950 border border-amber-400/50 text-amber-300 text-[11px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer truncate"
            >
              {filteredSubmissions.length === 0 ? (
                <option value="">Tidak ada siswa cocok</option>
              ) : (
                filteredSubmissions.map((s, idx) => (
                  <option key={`rapor-opt-${s.id || 'sub'}-${idx}`} value={s.id} className="bg-slate-900 text-white">
                    {idx + 1}. {s.namaSiswa} — {s.kelas} ({getSemesterFromSub(s)}) — {s.nilaiAkhir}%
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Bilah Pintas Cepat Filter Kelas & Semester */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-sky-400" />
              Pintas Kelas:
            </span>
            <button
              type="button"
              onClick={() => setKelasFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                kelasFilter === 'ALL'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setKelasFilter('VII')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                kelasFilter === 'VII'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Jenjang VII
            </button>
            <button
              type="button"
              onClick={() => setKelasFilter('VIII')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                kelasFilter === 'VIII'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Jenjang VIII
            </button>
            {availableKelasList.slice(0, 5).map((kls) => (
              <button
                key={kls}
                type="button"
                onClick={() => setKelasFilter(kls)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  kelasFilter === kls
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                {kls}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-400" />
              Pintas Semester:
            </span>
            <button
              type="button"
              onClick={() => setSemesterFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                semesterFilter === 'ALL'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setSemesterFilter('Ganjil')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                semesterFilter === 'Ganjil'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Ganjil (Smt 1)
            </button>
            <button
              type="button"
              onClick={() => setSemesterFilter('Genap')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                semesterFilter === 'Genap'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              Genap (Smt 2)
            </button>
          </div>
        </div>

        {/* Tab Pilihan Grafik Batang */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-amber-300" />
            <span>Pilih Model Visualisasi Grafik Batang:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/15">
            <button
              type="button"
              onClick={() => setActiveChartTab('KOMPETENSI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'KOMPETENSI'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              1. Elemen Kompetensi Informatika
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('PERBANDINGAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'PERBANDINGAN'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              2. Siswa vs KKM vs Kelas
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('HOTS_REGULER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'HOTS_REGULER'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              3. HOTS vs Reguler
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('DISTRIBUSI_KELAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'DISTRIBUSI_KELAS'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              4. Peringkat Nilai Kelas
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. LEMBAR UTAMA RAPOR SISWA (FORMAT RESMI DAPAT DICETAK LANGSUNG) */}
      {/* =================================================================== */}
      {!currentSub ? (
        <div className="max-w-4xl mx-auto bg-slate-900/60 border border-white/10 rounded-3xl p-12 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Belum Ada Data Riwayat Ujian Siswa</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Rapor Siswa akan otomatis menyajikan visualisasi grafik batang dan rekap capaian setelah peserta menyelesaikan sesi ujian ANBK.
          </p>
        </div>
      ) : (
        <div
          ref={printAreaRef}
          id="rapor-siswa-printable-sheet"
          className="max-w-5xl mx-auto bg-slate-900 border border-sky-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-7 print:bg-white print:text-black print:p-0 print:border-none print:shadow-none print:max-w-full"
        >
          {/* KOP RESMI LAPORAN HASIL ASESMEN SUMATIF */}
          <div className="border-b-2 border-amber-400/60 pb-5 print:border-black flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-4">
              <TutWuriLogo size="md" className="shrink-0" />
              <div>
                <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-amber-300 print:text-black block">
                  KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI
                </span>
                <h2 className="text-base sm:text-xl font-extrabold text-white print:text-black tracking-tight">
                  RAPOR ASESMEN SUMATIF HASIL UJIAN SISWA
                </h2>
                <p className="text-xs font-bold text-sky-200 print:text-black mt-0.5">
                  {EXAM_INFO.namaSekolah} · TAHUN AJARAN 2026/2027
                </p>
                <p className="text-[11px] text-slate-300 print:text-gray-700">
                  Mata Pelajaran: <strong>{EXAM_INFO.mataPelajaran}</strong> · Guru Pengampu: <strong>{EXAM_INFO.guruMapel}</strong>
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right shrink-0 bg-slate-950/80 print:bg-gray-100 border border-white/10 print:border-gray-300 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 print:text-gray-600 block">
                STANDAR KELULUSAN
              </span>
              <div className="text-2xl font-mono font-extrabold text-amber-300 print:text-black">
                KKM: {EXAM_INFO.kkm}%
              </div>
              <span className="text-[10px] text-emerald-300 print:text-emerald-700 font-bold block">
                Fase D (Tingkat SMP)
              </span>
            </div>
          </div>

          {/* BIODATA SISWA & HASIL AKHIR */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Kartu Profil & Identitas Siswa */}
            <div className="md:col-span-8 bg-slate-950/90 print:bg-gray-50 border border-white/15 print:border-gray-300 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-4">
                {/* Foto Siswa */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400 bg-gradient-to-br from-sky-600 to-indigo-800 shrink-0 flex items-center justify-center shadow-md">
                  {currentSub.photoUrl ? (
                    <img
                      src={currentSub.photoUrl}
                      alt={currentSub.namaSiswa}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-mono text-xl font-extrabold text-white">
                      {getStudentInitials(currentSub.namaSiswa)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-300 print:text-gray-600 block">
                    NAMA LENGKAP PESERTA ASESMEN
                  </span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white print:text-black truncate">
                    {currentSub.namaSiswa}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-300 print:text-gray-700 font-medium">
                    <span className="font-mono text-amber-300 print:text-black font-bold">
                      NIS/NISN: {currentSub.nisNisn || '-'}
                    </span>
                    <span>·</span>
                    <span>Kelas {currentSub.kelas}</span>
                    <span>·</span>
                    <span>Semester {getSemesterFromSub(currentSub)}</span>
                  </div>
                </div>
              </div>

              {/* Rincian Parameter Ujian */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 print:border-gray-300 text-xs">
                <div className="p-2.5 rounded-xl bg-white/5 print:bg-white border border-white/10 print:border-gray-200">
                  <span className="text-[10px] text-slate-400 print:text-gray-500 block">Skor Benar</span>
                  <span className="text-sm font-mono font-bold text-white print:text-black">
                    {currentSub.skorBenar} / {currentSub.totalSoal} Soal
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 print:bg-white border border-white/10 print:border-gray-200">
                  <span className="text-[10px] text-slate-400 print:text-gray-500 block">Waktu Sesi</span>
                  <span className="text-xs font-mono font-bold text-amber-300 print:text-black truncate block">
                    {currentSub.timestamp}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 print:bg-white border border-white/10 print:border-gray-200">
                  <span className="text-[10px] text-slate-400 print:text-gray-500 block">Perangkat</span>
                  <span className="text-xs font-bold text-sky-300 print:text-black truncate block">
                    {currentSub.deviceCategory || 'Komputer'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 print:bg-white border border-white/10 print:border-gray-200">
                  <span className="text-[10px] text-slate-400 print:text-gray-500 block">Integritas</span>
                  <span
                    className={`text-xs font-bold truncate block ${
                      currentSub.violationCount && currentSub.violationCount > 0
                        ? 'text-rose-400 print:text-rose-700'
                        : 'text-emerald-400 print:text-emerald-700'
                    }`}
                  >
                    {currentSub.violationCount && currentSub.violationCount > 0
                      ? `${currentSub.violationCount}x Peringatan`
                      : 'Jujur (0 Pelanggaran)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Kartu Nilai Akhir & Predikat Kelulusan */}
            <div
              className={`md:col-span-4 rounded-2xl p-5 border text-center flex flex-col justify-between shadow-lg ${
                Number(currentSub.nilaiAkhir || 0) >= EXAM_INFO.kkm
                  ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-emerald-900/60 border-emerald-400/50 print:bg-white print:border-emerald-600'
                  : 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-rose-900/60 border-rose-400/50 print:bg-white print:border-rose-600'
              }`}
            >
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 print:text-gray-600 block">
                  NILAI AKHIR ASESMEN
                </span>
                <div className="text-4xl sm:text-5xl font-mono font-extrabold text-white print:text-black my-2 tracking-tight">
                  {currentSub.nilaiAkhir}
                  <span className="text-xl text-amber-300 print:text-gray-600 font-normal">%</span>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold border ${predikatInfo.bg} ${predikatInfo.color} print:bg-gray-100 print:text-black`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    Predikat {predikatInfo.grade} — {predikatInfo.label}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 print:border-gray-300">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-600 block">
                  STATUS KELULUSAN
                </span>
                <span
                  className={`text-sm font-extrabold mt-0.5 flex items-center justify-center gap-1.5 ${
                    Number(currentSub.nilaiAkhir || 0) >= EXAM_INFO.kkm
                      ? 'text-emerald-300 print:text-emerald-700'
                      : 'text-rose-300 print:text-rose-700'
                  }`}
                >
                  {Number(currentSub.nilaiAkhir || 0) >= EXAM_INFO.kkm ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>LULUS UJIAN (MEMENUHI KKM)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>BELUM LULUS (UJIAN SUSULAN)</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 4. VISUALISASI GRAFIK BATANG (BAR CHART) HASIL UJIAN */}
          {/* =============================================================== */}
          <div
            key={`rapor-chart-${activeChartTab}-${currentSub?.id}`}
            className="relative bg-slate-950/85 print:bg-white border border-sky-500/35 print:border-gray-300 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl transition-all duration-700 ease-out overflow-hidden animate-rapor-chart"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 print:border-gray-200 pb-3">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-amber-300 print:text-black shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-white print:text-black">
                    {activeChartTab === 'KOMPETENSI' && 'Grafik Batang: Capaian per Elemen Materi Informatika (Fase D)'}
                    {activeChartTab === 'PERBANDINGAN' && 'Grafik Batang: Perbandingan Nilai Siswa vs Standar KKM vs Kelas'}
                    {activeChartTab === 'HOTS_REGULER' && 'Grafik Batang: Ketuntasan Soal Penalaran HOTS vs Soal Reguler'}
                    {activeChartTab === 'DISTRIBUSI_KELAS' && `Grafik Batang: Peringkat Nilai ${kelasFilter === 'ALL' ? 'Semua Kelas' : `Kelas ${kelasFilter}`}`}
                  </h4>
                  <div className="text-[11px] text-sky-300 print:text-gray-600 font-mono mt-0.5">
                    Filter Grafik Aktif: <strong>{kelasFilter === 'ALL' ? 'Semua Kelas' : `Kelas ${kelasFilter}`}</strong> · Semester <strong>{semesterFilter === 'ALL' ? 'Semua (Ganjil & Genap)' : semesterFilter}</strong> · ({filteredSubmissions.length} Data Siswa)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/35">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Animasi Fade-In Aktif
                </span>
                <span className="text-[11px] font-mono text-amber-300 print:text-gray-700 font-bold">
                  Garis Referensi KKM: {EXAM_INFO.kkm}%
                </span>
              </div>
            </div>

            {/* AREA RENDERING GRAFIK BATANG RECHARTS DENGAN FADE-IN DINAMIS */}
            <div className="relative h-72 w-full pt-2">
              {/* Overlay Indikator Shimmer Halus saat Grafik Dimuat / Berganti */}
              <div
                className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300 pointer-events-none ${
                  isChartVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-sky-500/30 text-xs font-mono font-bold text-sky-300 shadow-md">
                  <BarChart3 className="w-4 h-4 text-amber-300 animate-bounce" />
                  <span>Memuat Visualisasi Grafik Batang...</span>
                </div>
                <div className="flex items-end gap-2.5 h-12">
                  <span className="w-5 h-6 rounded-t bg-sky-500/30 animate-pulse" />
                  <span className="w-5 h-11 rounded-t bg-amber-400/30 animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-5 h-8 rounded-t bg-emerald-500/30 animate-pulse" style={{ animationDelay: '300ms' }} />
                  <span className="w-5 h-12 rounded-t bg-sky-400/30 animate-pulse" style={{ animationDelay: '450ms' }} />
                </div>
              </div>

              {/* Area Grafik Batang dengan Animasi Transisi Masuk Fade-In */}
              <div
                className={`h-full w-full transition-all duration-700 ease-out ${
                  isChartVisible
                    ? 'opacity-100 translate-y-0 scale-100 filter-none'
                    : 'opacity-0 translate-y-3 scale-[0.985] blur-[2px]'
                }`}
              >
                <ResponsiveContainer width="100%" height="100%">
                {activeChartTab === 'KOMPETENSI' ? (
                  <BarChart
                    key={`chart-kompetensi-${currentSub?.id}`}
                    data={elemenChartData}
                    margin={{ top: 15, right: 20, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis
                      dataKey="elemen"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      angle={-15}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-sky-400 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <span className="font-bold text-amber-300 block">{data.elemenFull}</span>
                              <div className="text-white font-mono">
                                Skor Capaian: <strong>{data.skor}%</strong> ({data.benar} dari {data.total} Soal)
                              </div>
                              <div
                                className={`text-[10px] font-bold ${
                                  data.isPassed ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {data.isPassed ? '✓ Tuntas KKM' : '✗ Perlu Remedial'}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        fill: '#f59e0b',
                        fontSize: 11,
                        position: 'top',
                      }}
                    />
                    <Bar
                      dataKey="skor"
                      radius={[6, 6, 0, 0]}
                      name="Capaian Nilai (%)"
                      isAnimationActive={true}
                      animationDuration={900}
                      animationEasing="ease-out"
                      animationBegin={150}
                    >
                      {elemenChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.skor >= EXAM_INFO.kkm ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                ) : activeChartTab === 'PERBANDINGAN' ? (
                  <BarChart
                    key={`chart-perbandingan-${currentSub?.id}`}
                    data={perbandinganChartData}
                    margin={{ top: 15, right: 20, left: -10, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="kategori" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-sky-400 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <span className="font-bold text-white block">{data.keterangan}</span>
                              <div className="text-amber-300 font-mono text-sm font-extrabold">
                                Nilai: {data.nilai}%
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        fill: '#f59e0b',
                        fontSize: 11,
                        position: 'top',
                      }}
                    />
                    <Bar
                      dataKey="nilai"
                      radius={[8, 8, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={900}
                      animationEasing="ease-out"
                      animationBegin={100}
                    >
                      {perbandinganChartData.map((entry, index) => (
                        <Cell key={`cell-comp-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : activeChartTab === 'HOTS_REGULER' ? (
                  <BarChart
                    key={`chart-hots-${currentSub?.id}`}
                    data={hotsRegulerChartData}
                    margin={{ top: 15, right: 20, left: -10, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="kategori" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-sky-400 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <span className="font-bold text-amber-300 block">{data.kategori}</span>
                              <div className="text-white font-mono">
                                Persentase: <strong>{data.persentase}%</strong> ({data.benar} dari {data.total} Soal)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        fill: '#f59e0b',
                        fontSize: 11,
                        position: 'top',
                      }}
                    />
                    <Bar
                      dataKey="persentase"
                      radius={[8, 8, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={900}
                      animationEasing="ease-out"
                      animationBegin={100}
                    >
                      {hotsRegulerChartData.map((entry, index) => (
                        <Cell key={`cell-hots-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart
                    key={`chart-distribusi-${currentSub?.id}-${kelasFilter}-${semesterFilter}`}
                    data={classDistributionBarData}
                    margin={{ top: 15, right: 20, left: -10, bottom: 35 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis
                      dataKey="nama"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-sky-400 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                              <span className="font-bold text-amber-300 block">
                                #{data.ranking} {data.namaLengkap} ({data.kelas})
                              </span>
                              <div className="text-white font-mono">
                                Nilai Akhir: <strong>{data.nilai}%</strong>
                              </div>
                              {data.isCurrentStudent && (
                                <span className="text-[10px] font-bold text-sky-300 block">
                                  ★ Siswa yang Sedang Dilihat
                                </span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        fill: '#f59e0b',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />
                    <Bar
                      dataKey="nilai"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={900}
                      animationEasing="ease-out"
                      animationBegin={100}
                    >
                      {classDistributionBarData.map((entry, index) => (
                        <Cell
                          key={`cell-dist-${index}`}
                          fill={
                            entry.isCurrentStudent
                              ? '#f59e0b'
                              : entry.isPassed
                              ? '#10b981'
                              : '#f43f5e'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Legenda Warna & Keterangan Grafik */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 print:border-gray-200 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-300 print:text-gray-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                  <span>Tuntas (≥ KKM 75%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 shrink-0" />
                  <span>Belum Tuntas (&lt; KKM 75%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
                  <span>Garis Standar KKM (75%)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400 print:text-gray-500 italic">
                Sumber Data: Submissions Rekap Ujian ANBK
              </span>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 5. TABEL ANALISIS DETAIL CAPAIAN ELEMEN MATERI */}
          {/* =============================================================== */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-300 print:text-black flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-amber-300 print:text-black" />
              <span>Rincian Ketuntasan Elemen Capaian Pembelajaran Informatika (Fase D)</span>
            </h4>

            <div className="overflow-x-auto rounded-xl border border-white/15 print:border-gray-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/90 print:bg-gray-100 text-slate-300 print:text-black border-b border-white/10 print:border-gray-300">
                    <th className="py-2.5 px-3 font-bold">No</th>
                    <th className="py-2.5 px-3 font-bold">Elemen / Ranah Materi</th>
                    <th className="py-2.5 px-3 font-bold text-center">Soal Terjawab Benar</th>
                    <th className="py-2.5 px-3 font-bold text-center">Persentase</th>
                    <th className="py-2.5 px-3 font-bold text-center">Status Ketuntasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-gray-200">
                  {elemenChartData.map((item, idx) => (
                    <tr
                      key={item.elemenFull}
                      className={
                        idx % 2 === 0
                          ? 'bg-slate-900/40 print:bg-white'
                          : 'bg-slate-900/80 print:bg-gray-50'
                      }
                    >
                      <td className="py-2 px-3 font-mono text-slate-400 print:text-gray-600">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-medium text-white print:text-black">
                        {item.elemenFull}
                      </td>
                      <td className="py-2 px-3 font-mono text-center text-slate-200 print:text-black">
                        {item.benar} dari {item.total} Soal
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-center text-amber-300 print:text-black">
                        {item.skor}%
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                            item.isPassed
                              ? 'text-emerald-400 print:text-emerald-700'
                              : 'text-rose-400 print:text-rose-700'
                          }`}
                        >
                          {item.isPassed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Tuntas</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Perlu Remedial</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 6. CATATAN & DESKRIPSI CAPAIAN GURU (NARASI KURIKULUM MERDEKA) */}
          {/* =============================================================== */}
          <div className="bg-slate-950/90 print:bg-gray-50 border border-white/15 print:border-gray-300 rounded-2xl p-5 space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 print:text-black flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 print:text-black" />
              <span>DESKRIPSI CAPAIAN PEMBELAJARAN (CATATAN GURU MATA PELAJARAN)</span>
            </span>
            <p className="text-xs sm:text-sm text-slate-200 print:text-black leading-relaxed italic">
              "{teacherNarrative}"
            </p>
          </div>

          {/* =============================================================== */}
          {/* 7. KOP TANDA TANGAN RESMI (GURU MAPEL & ORANG TUA / WALI) */}
          {/* =============================================================== */}
          <div className="pt-6 border-t border-white/10 print:border-gray-300 grid grid-cols-2 gap-8 text-xs text-center print:text-black">
            <div className="space-y-16">
              <div>
                <span className="text-slate-400 print:text-gray-600 block">Mengetahui,</span>
                <span className="font-bold text-white print:text-black block">
                  Orang Tua / Wali Siswa
                </span>
              </div>
              <div className="pt-2 border-b border-dashed border-white/30 print:border-black max-w-[200px] mx-auto">
                <span className="text-slate-400 print:text-gray-600 block text-[11px]">
                  (.......................................................)
                </span>
              </div>
            </div>

            <div className="space-y-16">
              <div>
                <span className="text-slate-400 print:text-gray-600 block">
                  Kisaran, {currentSub.timestamp ? currentSub.timestamp.split(',')[0] : '2026'}
                </span>
                <span className="font-bold text-white print:text-black block">
                  Guru Mata Pelajaran Informatika
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="font-extrabold text-amber-300 print:text-black text-sm block">
                  {EXAM_INFO.guruMapel}
                </span>
                <span className="font-mono text-[11px] text-slate-300 print:text-gray-700 block">
                  NIP. 19900531 202421 1 015
                </span>
                <span className="text-[10px] text-slate-400 print:text-gray-600 block">
                  {EXAM_INFO.namaSekolah}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaporSiswa;
