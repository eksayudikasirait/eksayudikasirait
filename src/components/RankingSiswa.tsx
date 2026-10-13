import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  StudentSubmission,
  EXAM_INFO,
  getCleanKelas,
  getSemesterFromSub,
} from '../data/examData';
import {
  getPhotoForStudentIdentity,
  getStudentInitials,
} from './StudentCameraProfileModal';
import {
  Trophy,
  Medal,
  Award,
  Users,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  BarChart3,
  Crown,
  Layers,
  Search,
} from 'lucide-react';

export interface RankedStudentEntry {
  key: string;
  rank: number;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: string;
  bestScore: number;
  bestSkorBenar: number;
  totalSoal: number;
  attemptsCount: number;
  avgScore: number;
  minViolationsOnBest: number;
  latestTimestamp: string;
  isPassed: boolean;
  photoUrl?: string;
  bestSubmission: StudentSubmission;
  isHighlightedUser: boolean;
}

export interface ClassTop5Group {
  kelas: string;
  jenjang: 'VII' | 'VIII' | string;
  top5: RankedStudentEntry[];
  allRanked: RankedStudentEntry[];
  totalStudents: number;
  totalSubmissions: number;
  highestScore: number;
  averageBestScore: number;
  passedCount: number;
}

interface RankingSiswaProps {
  submissions: StudentSubmission[];
  selectedGlobalClassFilter?: string;
  searchQuery?: string;
  activeStudentName?: string;
  activeNisNisn?: string;
  isAnonymous?: boolean;
  onToggleAnonymous?: () => void;
  onViewSubmissionResult: (submission: StudentSubmission) => void;
  onOpenRaporSiswa?: (submission: StudentSubmission) => void;
}

const STANDARD_CLASSES = [
  'VII-1',
  'VII-2',
  'VII-3',
  'VII-4',
  'VII-5',
  ...EXAM_INFO.kelasList,
];

export const RankingSiswa: React.FC<RankingSiswaProps> = ({
  submissions,
  selectedGlobalClassFilter = 'ALL',
  searchQuery = '',
  activeStudentName = '',
  activeNisNisn = '',
  isAnonymous = false,
  onToggleAnonymous,
  onViewSubmissionResult,
  onOpenRaporSiswa,
}) => {
  const [selectedRankingClass, setSelectedRankingClass] = useState<string>('ALL_CLASSES');
  const [showEmptyClasses, setShowEmptyClasses] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>('');

  // Sinkronkan filter kelas lokal apabila filter kelas utama di StudentDashboard diubah
  useEffect(() => {
    if (selectedGlobalClassFilter && selectedGlobalClassFilter !== 'ALL') {
      setSelectedRankingClass(selectedGlobalClassFilter);
    } else {
      setSelectedRankingClass('ALL_CLASSES');
    }
  }, [selectedGlobalClassFilter]);

  const effectiveQuery = (localSearch.trim() || searchQuery.trim()).toLowerCase();
  const activeNameLower = activeStudentName.trim().toLowerCase();
  const activeNisLower = activeNisNisn.trim().toLowerCase();

  const maskName = (fullName: string, rankIdx: number, isHighlighted: boolean): string => {
    if (!isAnonymous) return fullName;
    const words = fullName.trim().split(/\s+/);
    const maskedWords = words
      .map((w) => {
        if (w.length <= 2) return `${w[0] || '*'}*`;
        return `${w[0]}${'*'.repeat(Math.min(4, w.length - 2))}${w[w.length - 1]}`;
      })
      .join(' ');
    const code = String(rankIdx + 1).padStart(2, '0');
    return isHighlighted
      ? `${fullName} (Anda · #${code})`
      : `Peserta Anonim #${code} (${maskedWords})`;
  };

  const maskNis = (nis: string, isHighlighted: boolean): string => {
    if (!isAnonymous || isHighlighted) return nis;
    const clean = nis.trim();
    if (clean.length <= 3) return '***';
    return `***${clean.slice(-3)}`;
  };

  // Hitung Peringkat 5 Besar berdasarkan Nilai Tertinggi untuk masing-masing kelas
  const classGroups = useMemo<ClassTop5Group[]>(() => {
    const discoveredClasses = new Set<string>(STANDARD_CLASSES);
    submissions.forEach((sub) => {
      const clean = getCleanKelas(sub.kelas);
      if (clean) discoveredClasses.add(clean);
    });

    const orderedClasses = Array.from(discoveredClasses).sort((a, b) =>
      a.localeCompare(b, 'id-ID', { numeric: true })
    );

    return orderedClasses.map((kelasName) => {
      const classSubs = submissions.filter(
        (s) => getCleanKelas(s.kelas).toLowerCase() === kelasName.toLowerCase()
      );

      const studentMap = new Map<
        string,
        {
          key: string;
          namaSiswa: string;
          nisNisn: string;
          kelas: string;
          semester: string;
          bestScore: number;
          bestSkorBenar: number;
          totalSoal: number;
          attemptsCount: number;
          totalScoreSum: number;
          minViolationsOnBest: number;
          latestTimestamp: string;
          isPassed: boolean;
          photoUrl?: string;
          bestSubmission: StudentSubmission;
        }
      >();

      classSubs.forEach((sub) => {
        const cleanKls = getCleanKelas(sub.kelas);
        const sem = getSemesterFromSub(sub);
        const studentKey = `${sub.namaSiswa.trim().toLowerCase()}_${sub.nisNisn
          .trim()
          .toLowerCase()}_${cleanKls.toLowerCase()}`;

        const isDisqualified =
          sub.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
          sub.statusKecurangan.toLowerCase().includes('gagal');
        const subPassed =
          !isDisqualified &&
          sub.nilaiAkhir >= EXAM_INFO.kkm &&
          !sub.lulusTidakLulus.toLowerCase().includes('tidak');
        const vCount = sub.violationCount || 0;
        const resolvedPhoto =
          sub.photoUrl || getPhotoForStudentIdentity(sub.namaSiswa, sub.nisNisn) || undefined;

        const existing = studentMap.get(studentKey);
        if (!existing) {
          studentMap.set(studentKey, {
            key: studentKey,
            namaSiswa: sub.namaSiswa,
            nisNisn: sub.nisNisn,
            kelas: cleanKls,
            semester: sem,
            bestScore: sub.nilaiAkhir,
            bestSkorBenar: sub.skorBenar,
            totalSoal: sub.totalSoal || 25,
            attemptsCount: 1,
            totalScoreSum: sub.nilaiAkhir,
            minViolationsOnBest: vCount,
            latestTimestamp: sub.timestamp,
            isPassed: subPassed,
            photoUrl: resolvedPhoto,
            bestSubmission: sub,
          });
        } else {
          existing.attemptsCount += 1;
          existing.totalScoreSum += sub.nilaiAkhir;
          if (!existing.photoUrl && resolvedPhoto) {
            existing.photoUrl = resolvedPhoto;
          }
          // Ambil nilai tertinggi dari data submission yang ada (tie-breaker: skor benar lebih tinggi, pelanggaran lebih sedikit)
          if (
            sub.nilaiAkhir > existing.bestScore ||
            (sub.nilaiAkhir === existing.bestScore && sub.skorBenar > existing.bestSkorBenar) ||
            (sub.nilaiAkhir === existing.bestScore &&
              sub.skorBenar === existing.bestSkorBenar &&
              vCount < existing.minViolationsOnBest)
          ) {
            existing.bestScore = sub.nilaiAkhir;
            existing.bestSkorBenar = sub.skorBenar;
            existing.totalSoal = sub.totalSoal || 25;
            existing.minViolationsOnBest = vCount;
            existing.latestTimestamp = sub.timestamp;
            existing.isPassed = existing.isPassed || subPassed;
            existing.bestSubmission = sub;
            if (resolvedPhoto) {
              existing.photoUrl = resolvedPhoto;
            }
          }
        }
      });

      const sortedStudents = Array.from(studentMap.values()).sort((a, b) => {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (b.bestSkorBenar !== a.bestSkorBenar) return b.bestSkorBenar - a.bestSkorBenar;
        if (a.minViolationsOnBest !== b.minViolationsOnBest) {
          return a.minViolationsOnBest - b.minViolationsOnBest;
        }
        const avgA = a.totalScoreSum / a.attemptsCount;
        const avgB = b.totalScoreSum / b.attemptsCount;
        return avgB - avgA;
      });

      const allRanked: RankedStudentEntry[] = sortedStudents.map((item, idx) => {
        const avgScore = Math.round(item.totalScoreSum / item.attemptsCount);
        const isHighlightedUser = Boolean(
          (effectiveQuery &&
            (item.namaSiswa.toLowerCase().includes(effectiveQuery) ||
              item.nisNisn.toLowerCase().includes(effectiveQuery))) ||
            (!effectiveQuery &&
              ((activeNameLower &&
                activeNameLower !== 'peserta ujian anbk' &&
                item.namaSiswa.toLowerCase() === activeNameLower) ||
                (activeNisLower && item.nisNisn.toLowerCase() === activeNisLower)))
        );

        return {
          key: item.key,
          rank: idx + 1,
          namaSiswa: item.namaSiswa,
          nisNisn: item.nisNisn,
          kelas: item.kelas,
          semester: item.semester,
          bestScore: item.bestScore,
          bestSkorBenar: item.bestSkorBenar,
          totalSoal: item.totalSoal,
          attemptsCount: item.attemptsCount,
          avgScore,
          minViolationsOnBest: item.minViolationsOnBest,
          latestTimestamp: item.latestTimestamp,
          isPassed: item.isPassed,
          photoUrl: item.photoUrl,
          bestSubmission: item.bestSubmission,
          isHighlightedUser,
        };
      });

      // Filter pencarian lokal jika pengguna mengetik nama/NIS di kotak filter Ranking Siswa
      const filteredRanked = effectiveQuery
        ? allRanked.filter(
            (r) =>
              r.namaSiswa.toLowerCase().includes(effectiveQuery) ||
              r.nisNisn.toLowerCase().includes(effectiveQuery) ||
              r.kelas.toLowerCase().includes(effectiveQuery)
          )
        : allRanked;

      const top5 = filteredRanked.slice(0, 5);
      const highestScore = allRanked.length > 0 ? allRanked[0].bestScore : 0;
      const averageBestScore =
        allRanked.length > 0
          ? Math.round(allRanked.reduce((acc, r) => acc + r.bestScore, 0) / allRanked.length)
          : 0;
      const passedCount = allRanked.filter((r) => r.isPassed).length;
      const jenjang = kelasName.toUpperCase().startsWith('VII-') ? 'VII' : 'VIII';

      return {
        kelas: kelasName,
        jenjang,
        top5,
        allRanked,
        totalStudents: allRanked.length,
        totalSubmissions: classSubs.length,
        highestScore,
        averageBestScore,
        passedCount,
      };
    });
  }, [submissions, effectiveQuery, activeNameLower, activeNisLower]);

  const classesWithData = useMemo(
    () => classGroups.filter((g) => g.totalStudents > 0),
    [classGroups]
  );

  const displayedClassGroups = useMemo(() => {
    if (selectedRankingClass !== 'ALL_CLASSES') {
      return classGroups.filter(
        (g) => g.kelas.toLowerCase() === selectedRankingClass.toLowerCase()
      );
    }
    if (showEmptyClasses) {
      return classGroups;
    }
    return classesWithData.length > 0 ? classesWithData : classGroups.slice(0, 5);
  }, [classGroups, classesWithData, selectedRankingClass, showEmptyClasses]);

  const totalTop5Count = useMemo(
    () => classesWithData.reduce((acc, g) => acc + Math.min(5, g.totalStudents), 0),
    [classesWithData]
  );

  // Kunci animasi reaktif agar daftar Top 5 melakukan transisi fade-in & scale-up halus saat mount maupun saat data/filter diperbarui
  const rankingUpdateSignature = useMemo(() => {
    const topSummary = displayedClassGroups
      .map((g) => `${g.kelas}:${g.top5.map((s) => `${s.key}-${s.bestScore}`).join(',')}`)
      .join('|');
    return `${selectedRankingClass}_${showEmptyClasses ? 'all' : 'active'}_${effectiveQuery}_${
      isAnonymous ? 'anon' : 'named'
    }_${submissions.length}_${topSummary}`;
  }, [
    displayedClassGroups,
    selectedRankingClass,
    showEmptyClasses,
    effectiveQuery,
    isAnonymous,
    submissions.length,
  ]);

  const getRankBadgeStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          badge:
            'bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 text-slate-950 border border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.45)]',
          rowBorder: 'border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-slate-900/95 to-slate-950',
          label: 'TERBAIK #1',
          iconColor: 'text-amber-300',
        };
      case 2:
        return {
          badge:
            'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950 border border-slate-100',
          rowBorder: 'border-slate-300/40 bg-gradient-to-r from-slate-400/15 via-slate-900/95 to-slate-950',
          label: 'TERBAIK #2',
          iconColor: 'text-slate-200',
        };
      case 3:
        return {
          badge:
            'bg-gradient-to-br from-amber-600 via-amber-700 to-orange-700 text-white border border-amber-400/50',
          rowBorder: 'border-amber-600/45 bg-gradient-to-r from-amber-700/15 via-slate-900/95 to-slate-950',
          label: 'TERBAIK #3',
          iconColor: 'text-amber-400',
        };
      case 4:
        return {
          badge: 'bg-sky-500/25 text-sky-200 border border-sky-400/50',
          rowBorder: 'border-sky-500/30 bg-slate-900/90',
          label: 'PERINGKAT #4',
          iconColor: 'text-sky-300',
        };
      default:
        return {
          badge: 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50',
          rowBorder: 'border-indigo-500/30 bg-slate-900/90',
          label: `PERINGKAT #${rank}`,
          iconColor: 'text-indigo-300',
        };
    }
  };

  return (
    <motion.section
      id="ranking-siswa-top5-section"
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="animate-ranking-section-in rounded-lg sm:rounded-xl border border-amber-400/35 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 p-1.5 sm:p-2.5 text-white shadow-sm space-y-1.5 sm:space-y-2"
    >
      {/* Header Utama Komponen Ranking Siswa (Peringkat 5 Besar Per Kelas) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 sm:gap-2 border-b border-white/10 pb-1 sm:pb-2">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[9px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
              <Trophy className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              RANKING SISWA · TOP 5 BESAR PER KELAS
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[9px] font-mono font-bold bg-sky-500/20 text-sky-200 border border-sky-400/35">
              <Layers className="w-2.5 h-2.5 text-sky-300 shrink-0" />
              {classesWithData.length} Kelas Aktif · {totalTop5Count} Siswa Top 5
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
              Standar KKM: {EXAM_INFO.kkm}%
            </span>
          </div>

          <h2 className="text-[10.5px] sm:text-xs lg:text-sm font-extrabold text-white flex flex-wrap items-center gap-1 leading-tight">
            <span>
              Ranking Siswa — Peringkat 5 Besar Berdasarkan Nilai Tertinggi{' '}
              {selectedRankingClass === 'ALL_CLASSES'
                ? '(Sesuai Kelas Masing-Masing)'
                : `(Kelas ${selectedRankingClass})`}
            </span>
          </h2>

          <p className="text-[8.5px] sm:text-[10px] text-slate-300 leading-snug max-w-3xl">
            Menampilkan <strong>5 siswa dengan nilai tertinggi (Top 5 Besar)</strong> dari data submission ujian yang ada, dikelompokkan dan diatur secara otomatis sesuai kelasnya masing-masing. Klik baris siswa untuk melihat rincian hasil ujian atau rapor.
          </p>
        </div>

        {/* Kontrol Pencarian Cepat & Mode Anonim */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="relative flex-1 sm:flex-initial sm:w-40">
            <Search className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari siswa di Top 5..."
              className="w-full h-6 sm:h-6.5 pl-6 sm:pl-6.5 pr-2 rounded-md border border-white/15 bg-slate-950/85 text-white placeholder:text-slate-400 text-[9px] sm:text-[10.5px] focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {onToggleAnonymous && (
            <button
              type="button"
              onClick={onToggleAnonymous}
              className={`h-6 sm:h-6.5 px-2 sm:px-2.5 rounded-md text-[9px] sm:text-[10.5px] font-extrabold flex items-center gap-1 border transition-colors cursor-pointer whitespace-nowrap ${
                isAnonymous
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-sky-200 border-sky-400/40'
              }`}
            >
              {isAnonymous ? (
                <>
                  <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                  <span>Anonim Aktif</span>
                </>
              ) : (
                <>
                  <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
                  <span>Mode Anonim</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bar Filter Kelas: Pilih Semua Kelas (Dikelompokkan Per Kelas) atau Fokus Kelas Tertentu */}
      <div className="rounded-md sm:rounded-lg border border-white/10 bg-slate-950/80 p-1.5 sm:p-2 space-y-1 sm:space-y-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-1.5">
          <div className="flex items-center gap-1 text-[9px] sm:text-[10.5px] font-bold text-amber-300">
            <Filter className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            <span>Filter Ranking Sesuai Kelas Masing-Masing:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {selectedRankingClass === 'ALL_CLASSES' && (
              <button
                type="button"
                onClick={() => setShowEmptyClasses((prev) => !prev)}
                className="h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[9.5px] font-bold bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 cursor-pointer transition-colors"
              >
                {showEmptyClasses
                  ? `Sembunyikan Kelas Kosong (${classesWithData.length} Aktif)`
                  : `Tampilkan Semua Kelas VII & VIII (${classGroups.length} Kelas)`}
              </button>
            )}

            <select
              value={selectedRankingClass}
              onChange={(e) => setSelectedRankingClass(e.target.value)}
              aria-label="Filter Kelas Ranking Siswa"
              className="h-5.5 sm:h-6 px-1.5 sm:px-2 rounded border border-amber-400/40 bg-slate-900 text-amber-300 text-[8.5px] sm:text-[10px] font-extrabold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer max-w-full"
            >
              <option value="ALL_CLASSES" className="bg-slate-950 text-white">
                Semua Kelas — Tampilkan Per Kelas ({classesWithData.length} Kelas Aktif)
              </option>
              {classGroups.map((grp) => (
                <option key={grp.kelas} value={grp.kelas} className="bg-slate-950 text-white">
                  Kelas {grp.kelas} (Top {Math.min(5, grp.totalStudents)} dari {grp.totalStudents} Siswa)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tombol Tab Cepat Masing-Masing Kelas */}
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => setSelectedRankingClass('ALL_CLASSES')}
            className={`h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 border ${
              selectedRankingClass === 'ALL_CLASSES'
                ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
          >
            <Users className="w-2.5 h-2.5 shrink-0" />
            <span>Semua Kelas ({classesWithData.length})</span>
          </button>

          {classGroups
            .filter((g) => showEmptyClasses || g.totalStudents > 0 || g.kelas === selectedRankingClass)
            .map((grp) => {
              const isSelected =
                selectedRankingClass.toLowerCase() === grp.kelas.toLowerCase();
              return (
                <button
                  key={grp.kelas}
                  type="button"
                  onClick={() => setSelectedRankingClass(grp.kelas)}
                  className={`h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                    isSelected
                      ? 'bg-sky-500 text-white border-sky-300 shadow-xs font-extrabold'
                      : grp.totalStudents > 0
                      ? 'bg-slate-900/90 text-sky-200 border-sky-500/30 hover:bg-sky-500/20'
                      : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <span>Kelas {grp.kelas}</span>
                  <span
                    className={`px-1 py-0.2 rounded text-[7.5px] sm:text-[8.5px] font-mono font-extrabold ${
                      isSelected
                        ? 'bg-slate-950/40 text-amber-300'
                        : grp.totalStudents > 0
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {grp.totalStudents > 0 ? `Top ${Math.min(5, grp.totalStudents)}` : '0'}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Konten Utama Peringkat 5 Besar Sesuai Kelasnya Masing-Masing */}
      {submissions.length === 0 ? (
        <div className="rounded-lg sm:rounded-xl border border-white/10 bg-slate-950/60 p-3 sm:p-6 text-center space-y-1 sm:space-y-2">
          <Trophy className="w-5 h-5 sm:w-8 sm:h-8 text-amber-400/70 mx-auto" />
          <div className="text-[11px] sm:text-sm font-bold text-white">
            Belum Ada Data Submission untuk Ditampilkan pada Ranking 5 Besar
          </div>
          <p className="text-[9.5px] sm:text-xs text-slate-400 max-w-md mx-auto leading-snug">
            Peringkat 5 besar siswa berdasarkan nilai tertinggi akan otomatis disusun sesuai kelasnya masing-masing segera setelah siswa menyelesaikan ujian.
          </p>
        </div>
      ) : (
        <motion.div
          key={rankingUpdateSignature}
          initial={{ opacity: 0, scale: 0.985, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className={
            selectedRankingClass === 'ALL_CLASSES' && displayedClassGroups.length > 1
              ? 'grid grid-cols-1 xl:grid-cols-2 gap-1.5 sm:gap-2.5'
              : 'space-y-1.5 sm:space-y-2.5'
          }
        >
          {displayedClassGroups.map((classGrp, classIdx) => {
            const isSingleClassView =
              selectedRankingClass !== 'ALL_CLASSES' || displayedClassGroups.length === 1;
            const staggerClass = `ranking-stagger-${(classIdx % 5) + 1}`;

            return (
              <motion.div
                key={classGrp.kelas}
                initial={{ opacity: 0, y: 14, scale: 0.965 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.42,
                  delay: Math.min(classIdx * 0.055, 0.28),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`animate-ranking-card-in ${staggerClass} rounded-lg border border-sky-500/30 bg-slate-950/90 overflow-hidden shadow-sm flex flex-col justify-between transition-transform duration-300 hover:border-amber-400/45`}
              >
                {/* Header Kartu Kelas */}
                <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-gradient-to-r from-sky-950/95 via-slate-900 to-indigo-950/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-1 sm:gap-1.5">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className="w-5 h-5 sm:w-6.5 sm:h-6.5 rounded bg-amber-400/20 border border-amber-400/50 flex items-center justify-center shrink-0">
                      <Crown className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <h3 className="text-[9.5px] sm:text-xs font-extrabold text-white tracking-wide">
                          PERINGKAT 5 BESAR — KELAS {classGrp.kelas}
                        </h3>
                        <span className="px-1 sm:px-1.5 py-0.2 rounded text-[7.5px] sm:text-[9px] font-mono font-extrabold bg-amber-400 text-slate-950">
                          TOP {Math.min(5, classGrp.top5.length)} NILAI TERTINGGI
                        </span>
                      </div>
                      <div className="text-[8px] sm:text-[9.5px] font-mono text-slate-300 flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 mt-0.5">
                        <span>
                          Peserta: <strong className="text-sky-300">{classGrp.totalStudents} Siswa</strong> ({classGrp.totalSubmissions} Sesi)
                        </span>
                        <span>·</span>
                        <span>
                          Tertinggi: <strong className="text-amber-300">{classGrp.highestScore}%</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Rata-Rata: <strong className="text-emerald-300">{classGrp.averageBestScore}%</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Lulus KKM: <strong className="text-white">{classGrp.passedCount}/{classGrp.totalStudents}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedRankingClass === 'ALL_CLASSES' ? (
                    <button
                      type="button"
                      onClick={() => setSelectedRankingClass(classGrp.kelas)}
                      className="h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[9.5px] font-extrabold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 cursor-pointer transition-colors"
                    >
                      Fokus Kelas {classGrp.kelas}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedRankingClass('ALL_CLASSES')}
                      className="h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[9.5px] font-bold bg-white/10 hover:bg-white/15 border border-white/15 text-amber-300 cursor-pointer transition-colors"
                    >
                      Lihat Semua Kelas
                    </button>
                  )}
                </div>

                {/* Daftar 5 Besar Siswa di Kelas Ini */}
                {classGrp.top5.length === 0 ? (
                  <div className="p-2.5 sm:p-4 text-center text-[9.5px] sm:text-[11px] text-slate-400">
                    Belum ada data submission siswa untuk <strong>Kelas {classGrp.kelas}</strong>.
                  </div>
                ) : (
                  <div className="p-1.5 sm:p-2 space-y-1 sm:space-y-1.5">
                    {/* Jika mode Fokus 1 Kelas, tampilkan juga Podium Top 3 di atas daftar 5 besar */}
                    {isSingleClassView && classGrp.top5.length >= 1 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 sm:gap-2.5 pb-1 sm:pb-2">
                        {classGrp.top5.slice(0, 3).map((topStudent, idx) => {
                          const style = getRankBadgeStyle(topStudent.rank);
                          const dispName = maskName(
                            topStudent.namaSiswa,
                            idx,
                            topStudent.isHighlightedUser
                          );
                          const dispNis = maskNis(
                            topStudent.nisNisn,
                            topStudent.isHighlightedUser
                          );

                          return (
                            <motion.div
                              key={`podium-${topStudent.key}-${idx}`}
                              initial={{ opacity: 0, y: 12, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                duration: 0.38,
                                delay: idx * 0.06,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              whileHover={{ scale: 1.018, y: -2 }}
                              onClick={() => onViewSubmissionResult(topStudent.bestSubmission)}
                              className={`animate-ranking-card-in ranking-stagger-${
                                idx + 1
                              } rounded-lg sm:rounded-xl border p-2 sm:p-3 transition-all cursor-pointer ${style.rowBorder} ${
                                topStudent.isHighlightedUser ? 'ring-2 ring-amber-400' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5 mb-1.5 sm:mb-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[10px] font-mono font-extrabold uppercase ${style.badge}`}
                                >
                                  <Medal className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                                  {style.label}
                                </span>
                                <span className="text-[8.5px] sm:text-[10px] font-mono font-bold text-sky-300">
                                  Kelas {topStudent.kelas} ({topStudent.semester})
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2.5">
                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-md sm:rounded-lg overflow-hidden border border-amber-400/60 bg-gradient-to-br from-sky-600 to-indigo-800 flex items-center justify-center shrink-0">
                                  {topStudent.photoUrl ? (
                                    <img
                                      src={topStudent.photoUrl}
                                      alt={dispName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="font-mono text-[10px] sm:text-xs font-extrabold text-white">
                                      {getStudentInitials(dispName)}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10.5px] sm:text-sm font-extrabold text-white truncate">
                                    {dispName}
                                  </div>
                                  <div className="text-[8.5px] sm:text-[10.5px] font-mono text-slate-300 truncate">
                                    NIS/NISN: {dispNis} · {topStudent.attemptsCount}x Ujian
                                  </div>
                                </div>
                              </div>

                              <div className="mt-1.5 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between">
                                <div>
                                  <span className="text-[8px] sm:text-[9.5px] uppercase text-slate-400 block">
                                    Nilai Tertinggi
                                  </span>
                                  <span className="text-sm sm:text-lg font-mono font-extrabold text-amber-300">
                                    {topStudent.bestScore}%
                                  </span>
                                  <span className="text-[8.5px] sm:text-[10px] font-mono text-slate-300 ml-1">
                                    ({topStudent.bestSkorBenar}/{topStudent.totalSoal} Benar)
                                  </span>
                                </div>
                                <span
                                  className={`px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[10px] font-extrabold ${
                                    topStudent.isPassed
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                                  }`}
                                >
                                  {topStudent.isPassed ? 'LULUS KKM' : 'BELUM LULUS'}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Baris Peringkat #1 sampai #5 */}
                    <div className="space-y-1">
                      {classGrp.top5.map((student, idx) => {
                        const style = getRankBadgeStyle(student.rank);
                        const dispName = maskName(
                          student.namaSiswa,
                          idx,
                          student.isHighlightedUser
                        );
                        const dispNis = maskNis(
                          student.nisNisn,
                          student.isHighlightedUser
                        );

                        return (
                          <motion.div
                            key={`top5-${student.key}-${idx}`}
                            initial={{ opacity: 0, x: -8, y: 8, scale: 0.975 }}
                            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                            transition={{
                              duration: 0.36,
                              delay: Math.min(classIdx * 0.04 + idx * 0.055, 0.35),
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            whileHover={{ scale: 1.008, x: 1 }}
                            onClick={() => onViewSubmissionResult(student.bestSubmission)}
                            className={`animate-ranking-row-in ranking-stagger-${
                              (idx % 5) + 1
                            } rounded-md sm:rounded-lg border px-1.5 sm:px-2.5 py-1 sm:py-1.5 transition-colors cursor-pointer hover:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 ${style.rowBorder} ${
                              student.isHighlightedUser ? 'ring-1.5 ring-amber-400' : ''
                            }`}
                          >
                            {/* Kiri: Badge Peringkat, Foto & Identitas Siswa */}
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <div
                                className={`w-5 h-5 sm:w-6 sm:h-6 rounded font-mono font-extrabold text-[9px] sm:text-[10.5px] flex items-center justify-center shrink-0 ${style.badge}`}
                              >
                                #{student.rank}
                              </div>

                              <div className="w-5.5 h-5.5 sm:w-7 sm:h-7 rounded overflow-hidden border border-white/20 bg-gradient-to-br from-sky-600 to-indigo-800 flex items-center justify-center shrink-0">
                                {student.photoUrl ? (
                                  <img
                                    src={student.photoUrl}
                                    alt={dispName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="font-mono text-[8.5px] sm:text-[9.5px] font-extrabold text-white">
                                    {getStudentInitials(dispName)}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[9.5px] sm:text-[11.5px] font-extrabold text-white truncate">
                                    {dispName}
                                  </span>
                                  {student.rank <= 3 && (
                                    <Medal className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${style.iconColor}`} />
                                  )}
                                  {student.isHighlightedUser && (
                                    <span className="px-1 py-0.2 rounded text-[7.5px] sm:text-[8.5px] font-mono font-extrabold bg-amber-400 text-slate-950 flex items-center gap-0.5">
                                      <Sparkles className="w-2 h-2" />
                                      ANDA
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-1 sm:gap-x-1.5 gap-y-0.5 text-[8px] sm:text-[9.5px] font-mono text-slate-300">
                                  <span>NIS/NISN: {dispNis}</span>
                                  <span>·</span>
                                  <span className="text-amber-300 font-bold">
                                    Kelas {student.kelas} ({student.semester})
                                  </span>
                                  <span>·</span>
                                  <span>
                                    Benar: <strong className="text-emerald-300">{student.bestSkorBenar}/{student.totalSoal}</strong>
                                  </span>
                                  {student.attemptsCount > 1 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-sky-300">
                                        {student.attemptsCount}x Sesi (Rata-rata {student.avgScore}%)
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Kanan: Progress Bar, Nilai Tertinggi & Tombol Aksi */}
                            <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-2 shrink-0 pt-0.5 sm:pt-0 border-t sm:border-t-0 border-white/10">
                              <div className="hidden md:block w-16">
                                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden p-0.2 border border-white/10">
                                  <div
                                    className={`h-full rounded-full ${
                                      student.bestScore >= 100
                                        ? 'w-full'
                                        : student.bestScore >= 90
                                        ? 'w-11/12'
                                        : student.bestScore >= 80
                                        ? 'w-4/5'
                                        : student.bestScore >= 75
                                        ? 'w-3/4'
                                        : student.bestScore >= 60
                                        ? 'w-3/5'
                                        : student.bestScore >= 50
                                        ? 'w-1/2'
                                        : student.bestScore >= 40
                                        ? 'w-2/5'
                                        : student.bestScore >= 30
                                        ? 'w-1/3'
                                        : student.bestScore >= 20
                                        ? 'w-1/5'
                                        : 'w-1/12'
                                    } ${
                                      student.isPassed
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-300'
                                        : 'bg-gradient-to-r from-rose-500 to-amber-400'
                                    }`}
                                  />
                                </div>
                              </div>

                              <div className="text-left sm:text-right min-w-[46px] sm:min-w-[54px]">
                                <div
                                  className={`text-[11px] sm:text-sm font-mono font-extrabold tabular-nums leading-none ${
                                    student.isPassed ? 'text-amber-300' : 'text-rose-300'
                                  }`}
                                >
                                  {student.bestScore}%
                                </div>
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[7.5px] sm:text-[8.5px] font-extrabold mt-0.5 ${
                                    student.isPassed ? 'text-emerald-300' : 'text-rose-300'
                                  }`}
                                >
                                  {student.isPassed ? (
                                    <>
                                      <CheckCircle2 className="w-2 h-2" />
                                      LULUS
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-2 h-2" />
                                      SUSULAN
                                    </>
                                  )}
                                </span>
                              </div>

                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => onViewSubmissionResult(student.bestSubmission)}
                                  className="h-5 sm:h-6 px-1.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-[8.5px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  <span>Hasil</span>
                                </button>
                                {onOpenRaporSiswa && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenRaporSiswa(student.bestSubmission)}
                                    className="h-5 sm:h-6 px-1.5 rounded bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-[8.5px] sm:text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                                  >
                                    <BarChart3 className="w-2.5 h-2.5 text-amber-300" />
                                    <span>Rapor</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Info footer kartu kelas jika siswa di kelas > 5 */}
                    {classGrp.totalStudents > 5 && (
                      <div className="pt-1 sm:pt-1.5 flex items-center justify-between text-[8.5px] sm:text-[10.5px] text-slate-400 font-mono border-t border-white/10">
                        <span>
                          Menampilkan <strong>Peringkat 1–5 Besar</strong> dari total{' '}
                          <strong className="text-white">{classGrp.totalStudents} siswa</strong> di Kelas {classGrp.kelas}
                        </span>
                        <span className="text-amber-300/90 font-semibold">
                          Diurutkan berdasarkan Nilai Tertinggi
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
};
