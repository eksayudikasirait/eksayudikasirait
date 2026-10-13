import React, { useState, useMemo } from 'react';
import {
  StudentSubmission,
  Question,
  EXAM_INFO,
  diagnoseStudentUnmasteredTopics,
  RemedialTopicInfo,
  UnmasteredTopicDiagnosis,
} from '../data/examData';
import {
  Sparkles,
  BookOpen,
  Target,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Award,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';

export interface RemedialStartPayload {
  difficultyMode: 'REGULER' | 'BALANCED' | 'HOTS';
  targetElements: string[];
  questionCount: number;
  sourceSubmission: StudentSubmission;
}

interface RemedialOptionSectionProps {
  submission: StudentSubmission;
  examQuestions: Question[];
  onStartRemedial?: (payload: RemedialStartPayload) => void;
  darkMode?: boolean;
}

export const RemedialOptionSection: React.FC<RemedialOptionSectionProps> = ({
  submission,
  examQuestions,
  onStartRemedial,
  darkMode = true,
}) => {
  const diagnosis: UnmasteredTopicDiagnosis = useMemo(() => {
    return diagnoseStudentUnmasteredTopics(submission, examQuestions);
  }, [submission, examQuestions]);

  const [selectedDifficulty, setSelectedDifficulty] = useState<'REGULER' | 'BALANCED' | 'HOTS'>(
    diagnosis.recommendedDifficultyMode || 'BALANCED'
  );

  const [selectedElements, setSelectedElements] = useState<string[]>(() => {
    if (diagnosis.unmasteredTopics.length > 0) {
      return diagnosis.unmasteredTopics.map((t) => t.elemen);
    }
    return diagnosis.topics.map((t) => t.elemen);
  });

  const [questionCount, setQuestionCount] = useState<number>(15);
  const [showQuestionReview, setShowQuestionReview] = useState<boolean>(false);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(
    diagnosis.unmasteredTopics[0]?.elemen || null
  );
  const [isLaunchingRemedial, setIsLaunchingRemedial] = useState<boolean>(false);

  // Jika nilai siswa >= KKM (75), sistem remedial tidak diperlukan
  if (!diagnosis.needsRemedial) {
    return null;
  }

  const handleToggleElement = (elemen: string) => {
    setSelectedElements((prev) => {
      if (prev.includes(elemen)) {
        if (prev.length === 1) return prev; // minimal 1 materi dipilih
        return prev.filter((e) => e !== elemen);
      } else {
        return [...prev, elemen];
      }
    });
  };

  const handleSelectAllUnmastered = () => {
    if (diagnosis.unmasteredTopics.length > 0) {
      setSelectedElements(diagnosis.unmasteredTopics.map((t) => t.elemen));
    } else {
      setSelectedElements(diagnosis.topics.map((t) => t.elemen));
    }
  };

  const handleLaunch = () => {
    if (!onStartRemedial) return;
    setIsLaunchingRemedial(true);
    setTimeout(() => {
      onStartRemedial({
        difficultyMode: selectedDifficulty,
        targetElements: selectedElements.length > 0 ? selectedElements : diagnosis.recommendedTopicElements,
        questionCount,
        sourceSubmission: submission,
      });
    }, 350);
  };

  return (
    <section
      id="opsi-remedial-otomatis"
      className="p-3.5 sm:p-5 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 text-white shadow-xl space-y-4 no-print relative overflow-hidden ring-1 ring-amber-400/40"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header Banner Opsi Remedial Otomatis */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-400/30 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg ring-2 ring-amber-300">
            <Zap className="w-6 h-6 fill-slate-950 text-slate-950 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 font-mono text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                SISTEM EVALUASI ADAPTIF FASE D
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 font-mono text-[9px] font-bold">
                Nilai {submission.nilaiAkhir}% &lt; KKM {EXAM_INFO.kkm}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white leading-tight">
              Opsi Remedial Otomatis (Perbaikan Nilai KKM 75)
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-200 leading-snug">
              Sistem telah mendiagnosis <strong className="text-amber-300">{diagnosis.totalWrong} butir soal salah</strong> dan memetakan materi yang belum Anda kuasai. Anda dapat langsung mengerjakan paket remedial terarah dengan tingkat kesulitan yang dipilih di bawah ini.
            </p>
          </div>
        </div>

        {/* Badge Capaian & Rekomendasi Mode */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 bg-slate-950/80 px-3 py-2 rounded-xl border border-white/15">
          <span className="text-[9.5px] font-mono text-slate-400">Rekomendasi Kesulitan:</span>
          <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
            {diagnosis.recommendedDifficultyMode === 'REGULER'
              ? 'Level Dasar (Reguler)'
              : diagnosis.recommendedDifficultyMode === 'HOTS'
              ? 'Level Analisis (HOTS)'
              : 'Adaptif Berimbang'}
          </span>
        </div>
      </div>

      {/* Grid Utama: 1. Diagnosis Materi & 2. Konfigurasi Remedial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 relative">
        {/* Kolom Kiri (5 Kolom): Diagnosis Materi Yang Belum Dikuasai */}
        <div className="lg:col-span-5 space-y-2.5 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-white/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Diagnosis Kelemahan Materi</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {diagnosis.unmasteredTopics.length} Materi Perlu Dikuatkan
            </span>
          </div>

          <div className="space-y-2">
            {diagnosis.topics.map((t) => {
              const isUnmastered = !t.isMastered || t.wrongCount > 0;
              const isSelected = selectedElements.includes(t.elemen);
              const isExpanded = expandedTopic === t.elemen;

              return (
                <div
                  key={t.elemen}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isUnmastered
                      ? isSelected
                        ? 'bg-rose-950/40 border-rose-400/60 ring-1 ring-rose-400/30'
                        : 'bg-rose-950/20 border-rose-500/30 opacity-75'
                      : 'bg-emerald-950/30 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[11.5px] text-white truncate">
                          {t.elemen}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold ${
                            isUnmastered
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40'
                              : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                          }`}
                        >
                          {isUnmastered ? `${t.wrongCount} Salah` : 'Tuntas ✓'}
                        </span>
                      </div>

                      {/* Progress Bar Penguasaan */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              t.masteryPercentage >= EXAM_INFO.kkm
                                ? 'bg-emerald-400'
                                : t.masteryPercentage >= 40
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${t.masteryPercentage}%` }}
                          />
                        </div>
                        <span className="font-mono text-[9.5px] text-slate-300 shrink-0 font-bold">
                          {t.masteryPercentage}%
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-300 mt-1 leading-tight">
                        {t.suggestedFocusNote}
                      </p>
                    </div>

                    {isUnmastered && (
                      <button
                        type="button"
                        onClick={() => handleToggleElement(t.elemen)}
                        title={isSelected ? 'Hapus dari paket remedial' : 'Tambahkan ke paket remedial'}
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 border-amber-300 text-slate-950'
                            : 'bg-white/10 border-white/20 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '+'}
                      </button>
                    )}
                  </div>

                  {/* Toggle Rincian Butir Soal yang Salah */}
                  {t.wrongQuestions.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setExpandedTopic(isExpanded ? null : t.elemen)}
                        className="text-[9.5px] font-bold text-sky-300 hover:text-sky-200 flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {isExpanded ? 'Tutup Rincian' : `Lihat ${t.wrongQuestions.length} Soal Belum Tepat`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 text-[10px] pl-1 border-l-2 border-amber-400/40">
                          {t.wrongQuestions.map((wq) => (
                            <div key={wq.id} className="p-2 rounded bg-slate-900/90 border border-white/10 space-y-1">
                              <div className="flex items-center justify-between text-amber-300 font-bold">
                                <span>Soal No. {wq.questionNumber} [{wq.difficulty}]</span>
                                <span className="text-rose-300 font-mono">Salah</span>
                              </div>
                              <p className="text-slate-200 line-clamp-2">{wq.content}</p>
                              <div className="text-[9.5px] text-slate-400">
                                <div>Jawaban Anda: <strong className="text-rose-300">{wq.studentAnswer}</strong></div>
                                <div>Kunci Benar: <strong className="text-emerald-300">{wq.correctAnswer}</strong></div>
                              </div>
                              <div className="text-[9px] text-amber-200/90 bg-amber-500/10 p-1 rounded border border-amber-500/20">
                                💡 <strong>Fokus Konsep:</strong> {wq.explanation}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-1 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Materi terpilih: <strong>{selectedElements.length}</strong></span>
            <button
              type="button"
              onClick={handleSelectAllUnmastered}
              className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer"
            >
              Pilih Semua Materi Belum Dikuasai
            </button>
          </div>
        </div>

        {/* Kolom Kanan (7 Kolom): Konfigurasi Tingkat Kesulitan & Mulai Remedial */}
        <div className="lg:col-span-7 space-y-3.5 bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-white/15 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Pilih Tingkat Kesulitan Soal Remedial</span>
            </div>

            {/* 3 Kartu Pilihan Mode Kesulitan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Opsi 1: REGULER (Fokus Konsep Dasar) */}
              <button
                type="button"
                onClick={() => setSelectedDifficulty('REGULER')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-1.5 ${
                  selectedDifficulty === 'REGULER'
                    ? 'border-sky-400 bg-sky-950/60 ring-2 ring-sky-400/50 shadow-md'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 opacity-80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-extrabold uppercase bg-sky-400/20 text-sky-300 border border-sky-400/40">
                      Level Dasar
                    </span>
                    {selectedDifficulty === 'REGULER' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    )}
                  </div>
                  <div className="font-extrabold text-xs text-white">
                    Fokus Konsep Dasar
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Memprioritaskan <strong>75% Soal Reguler</strong> untuk memantapkan definisi dan pemahaman inti materi yang belum dikuasai.
                  </p>
                </div>
                <div className="text-[9px] font-mono text-sky-300 pt-1 border-t border-white/10">
                  Cocok: Penguatan Pondasi
                </div>
              </button>

              {/* Opsi 2: BALANCED (Adaptif Berimbang - Rekomendasi) */}
              <button
                type="button"
                onClick={() => setSelectedDifficulty('BALANCED')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-1.5 ${
                  selectedDifficulty === 'BALANCED'
                    ? 'border-amber-400 bg-gradient-to-br from-amber-950/60 to-slate-900 ring-2 ring-amber-400/60 shadow-lg'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 opacity-80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-extrabold uppercase bg-amber-400/25 text-amber-300 border border-amber-400/50">
                      Rekomendasi
                    </span>
                    {selectedDifficulty === 'BALANCED' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="font-extrabold text-xs text-amber-200">
                    Adaptif Berimbang
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Kombinasi seimbang <strong>50% Reguler &amp; 50% HOTS</strong> yang terarah menargetkan materi-materi lemah siswa menembus KKM 75.
                  </p>
                </div>
                <div className="text-[9px] font-mono text-amber-300 pt-1 border-t border-white/10">
                  Standar Kelulusan KKM
                </div>
              </button>

              {/* Opsi 3: HOTS (Penguatan Analisis Tinggi) */}
              <button
                type="button"
                onClick={() => setSelectedDifficulty('HOTS')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-1.5 ${
                  selectedDifficulty === 'HOTS'
                    ? 'border-rose-400 bg-rose-950/60 ring-2 ring-rose-400/50 shadow-md'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 opacity-80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-extrabold uppercase bg-rose-400/20 text-rose-300 border border-rose-400/40">
                      Level Analisis
                    </span>
                    {selectedDifficulty === 'HOTS' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="font-extrabold text-xs text-white">
                    Penguatan Analisis HOTS
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Memprioritaskan <strong>75% Soal Penalaran HOTS</strong> untuk menguji daya analisis kritis dan studi kasus pada materi terkait.
                  </p>
                </div>
                <div className="text-[9px] font-mono text-rose-300 pt-1 border-t border-white/10">
                  Tantangan Berpikir Kritis
                </div>
              </button>
            </div>

            {/* Pilihan Jumlah Butir Soal Remedial */}
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Jumlah Soal Paket Remedial:</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  {questionCount} Soal (Est. {questionCount * 2} Menit)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { count: 10, label: '10 Soal (Cepat / Kilat)' },
                  { count: 15, label: '15 Soal (Rekomendasi)' },
                  { count: 25, label: '25 Soal (Penuh)' },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setQuestionCount(opt.count)}
                    className={`h-8 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                      questionCount === opt.count
                        ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-sm font-extrabold'
                        : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box Otorisasi Otomatis Guru */}
            <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-100 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <strong className="text-emerald-300 block font-bold">
                  Otorisasi Otomatis Guru Mapel ({EXAM_INFO.guruMapelUpper})
                </strong>
                <span>
                  Siswa tidak perlu repot meminta token baru. Sistem secara otomatis menyematkan token remedial resmi dan langsung membuka ruang ujian untuk perbaikan nilai.
                </span>
              </div>
            </div>
          </div>

          {/* Tombol Aksi Utama: Mulai Paket Soal Remedial Sekarang */}
          <div className="pt-3 border-t border-white/15">
            <button
              type="button"
              disabled={isLaunchingRemedial || selectedElements.length === 0}
              onClick={handleLaunch}
              className={`w-full group relative overflow-hidden h-12 rounded-xl text-sm font-extrabold transition-all duration-300 flex items-center justify-center gap-2.5 shadow-xl cursor-pointer ${
                isLaunchingRemedial
                  ? 'bg-amber-500 text-slate-950 opacity-90'
                  : 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 hover:scale-[1.015] active:scale-[0.985] shadow-[0_0_25px_rgba(251,191,36,0.45)] ring-2 ring-amber-300'
              }`}
            >
              {/* Shimmer sweep effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

              <Zap className="w-5 h-5 fill-slate-950 text-slate-950 group-hover:scale-110 transition-transform" />
              <span className="tracking-wide">
                {isLaunchingRemedial
                  ? 'Menyiapkan Paket Soal Remedial...'
                  : `Mulai Kerjakan Paket Remedial (${questionCount} Soal) Sekarang`}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="mt-1.5 text-center text-[10px] text-slate-400 font-mono">
              Target Nilai: ≥ {EXAM_INFO.kkm}% (KKM) · Otomatis masuk Denah Kelas Classroom setelah lulus
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
