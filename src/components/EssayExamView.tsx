import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import {
  EssayQuestion,
  EssayPackageKey,
  EssaySubmissionResult,
} from '../data/essayQuestionsData';
import { TutWuriLogo } from './TutWuriLogo';
import { EXAM_INFO, sendExamResultViaFonnteApi } from '../data/examData';
import {
  getTeacherWhatsAppUrl,
  openWhatsAppSafely,
  copyToClipboardSafely,
} from '../utils/whatsappHelper';
import { evaluatePrecisionSplitScreen } from '../utils/antiSplitScreenDetector';
import {
  BookOpen,
  CheckCircle2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  Send,
  Printer,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  Award,
  Sparkles,
  Layers,
  GraduationCap,
  Download,
  Share2,
  Clock,
  Check,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  CameraOff,
  Lock,
  Play,
  Smartphone,
  Laptop,
  Globe,
  RefreshCw,
  X,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface EssayExamViewProps {
  questions: EssayQuestion[];
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: 'Ganjil' | 'Genap';
  studentPhotoUrl?: string;
  sourceText?: string;
  deviceModel?: string;
  deviceCategory?: string;
  clientIp?: string;
  deviceFingerprint?: string;
  onExitHome: () => void;
  onSubmitEssay: (result: EssaySubmissionResult) => void;
  onRetakeEssay?: () => void;
}

// Fungsi suara alarm & peringatan Web Audio synthesizer (tanpa file eksternal)
const playSecuritySound = (type: 'warning' | 'critical' | 'countdown') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'critical') {
      // Siren suara kritis tajam bergantian untuk pelanggaran batas atau diskualifikasi
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'countdown') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      // Beep peringatan normal
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // abaikan jika audio belum diizinkan oleh interaksi pengguna
  }
};

export const EssayExamView: React.FC<EssayExamViewProps> = ({
  questions,
  namaSiswa,
  nisNisn,
  kelas,
  semester,
  studentPhotoUrl,
  sourceText,
  deviceModel,
  deviceCategory,
  clientIp,
  deviceFingerprint,
  onExitHome,
  onSubmitEssay,
  onRetakeEssay,
}) => {
  const packageKey: EssayPackageKey = `${
    kelas.toUpperCase().includes('VII') && !kelas.toUpperCase().includes('VIII') ? 'VII' : 'VIII'
  }_${semester}`;
  const storageDraftKey = `anbk_essay_draft_${nisNisn || 'anon'}_${packageKey}`;
  const storageCompletedKey = `anbk_essay_completed_${nisNisn || 'anon'}_${packageKey}`;
  const storageViolationsKey = `anbk_essay_violations_${nisNisn || 'anon'}_${packageKey}`;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(storageDraftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.answers === 'object') return parsed.answers;
      }
    } catch {}
    return {};
  });
  const [doubtful, setDoubtful] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageDraftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.doubtful === 'object') return parsed.doubtful;
      }
    } catch {}
    return {};
  });

  const [showQuestionGrid, setShowQuestionGrid] = useState<boolean>(false);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState<boolean>(false);
  const [showRubrik, setShowRubrik] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedResult, setCompletedResult] = useState<EssaySubmissionResult | null>(null);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number>(0);
  const [showKeyReview, setShowKeyReview] = useState<boolean>(false);

  // Waktu pengerjaan
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [waFeedback, setWaFeedback] = useState<string | null>(null);
  const [disqualifyWaNotice, setDisqualifyWaNotice] = useState<string | null>(null);

  // =========================================================================
  // STATE SISTEM KEAMANAN ANTI CURANG & DETEKSI PELANGGARAN
  // =========================================================================
  const [violationCount, setViolationCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageViolationsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.count === 'number') return parsed.count;
      }
    } catch {}
    return 0;
  });

  const [violationLogs, setViolationLogs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageViolationsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.logs)) return parsed.logs;
      }
    } catch {}
    return [];
  });

  const [isDisqualified, setIsDisqualified] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageViolationsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Boolean(parsed?.isDisqualified)) return true;
      }
    } catch {}
    return false;
  });

  const [disqualificationReason, setDisqualificationReason] = useState<string>('');
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [securityToastType, setSecurityToastType] = useState<'warning' | 'critical'>('warning');

  // Modal Peringatan Pelanggaran yang Mengharuskan Siswa Mengonfirmasi
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);
  const [currentViolationDetail, setCurrentViolationDetail] = useState<{
    count: number;
    reason: string;
    description: string;
    timestamp: string;
  } | null>(null);

  // Blackout Buffer & Sensor Anti-Screenshot
  const [showScreenshotShield, setShowScreenshotShield] = useState<boolean>(false);
  const [screenshotShieldReason, setScreenshotShieldReason] = useState<string>('');

  // Overlay Peringatan Merah Pindah Tab / Layar Di-Minimize dengan Hitung Mundur 15 Detik
  const [redWarningOverlay, setRedWarningOverlay] = useState<boolean>(false);
  const [warningCountdown, setWarningCountdown] = useState<number>(15);
  const [warningReasonText, setWarningReasonText] = useState<string>('');
  const [isCurrentlyFullscreen, setIsCurrentlyFullscreen] = useState<boolean>(false);

  // Nilai Ref agar event listeners selalu membaca state terbaru tanpa race-condition
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const doubtfulRef = useRef(doubtful);
  doubtfulRef.current = doubtful;
  const elapsedSecondsRef = useRef(elapsedSeconds);
  elapsedSecondsRef.current = elapsedSeconds;
  const violationCountRef = useRef(violationCount);
  violationCountRef.current = violationCount;
  const violationLogsRef = useRef(violationLogs);
  violationLogsRef.current = violationLogs;
  const isDisqualifiedRef = useRef(isDisqualified);
  isDisqualifiedRef.current = isDisqualified;
  const isCompletedRef = useRef(isCompleted);
  isCompletedRef.current = isCompleted;

  // Dimensi awal layar untuk mendeteksi mode Layar Terbelah (Split Screen)
  const initialViewportRef = useRef<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initialViewportRef.current = {
        w: window.innerWidth,
        h: window.innerHeight,
      };
    }
  }, []);

  // Timer pengerjaan
  useEffect(() => {
    if (isCompleted || isDisqualified) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted, isDisqualified]);

  // Simpan draft jawaban ke localStorage secara otomatis
  useEffect(() => {
    if (isCompleted || isDisqualified) return;
    try {
      localStorage.setItem(
        storageDraftKey,
        JSON.stringify({
          answers,
          doubtful,
          updatedAt: Date.now(),
          elapsedSeconds,
        })
      );
    } catch {}
  }, [answers, doubtful, elapsedSeconds, isCompleted, isDisqualified, storageDraftKey]);

  const currentQ = questions[currentIndex] || questions[0];
  const currentAnswer = answers[currentQ?.noSoal] || '';

  // Hitung jumlah kata & karakter
  const countWords = (text: string): number => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const totalWords = useMemo(() => {
    return Object.values(answers).reduce((acc, val) => acc + countWords(val), 0);
  }, [answers]);

  const totalAnswered = useMemo(() => {
    return questions.filter((q) => (answers[q.noSoal] || '').trim().length > 0).length;
  }, [questions, answers]);

  const progressPercent = Math.round((totalAnswered / Math.max(questions.length, 1)) * 100);

  const handleAnswerChange = (val: string) => {
    if (!currentQ || isCompleted || isDisqualified) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.noSoal]: val,
    }));
  };

  const toggleDoubtful = () => {
    if (!currentQ || isCompleted || isDisqualified) return;
    setDoubtful((prev) => ({
      ...prev,
      [currentQ.noSoal]: !prev[currentQ.noSoal],
    }));
  };

  const formatDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // =========================================================================
  // FUNGSI DISKUALIFIKASI OTOMATIS: JIKA 3 KALI PELANGGARAN
  // =========================================================================
  const handleDisqualifyExam = useCallback(
    (finalLogs: string[], reasonTitle?: string) => {
      setIsDisqualified(true);
      isDisqualifiedRef.current = true;
      setIsCompleted(true);
      isCompletedRef.current = true;
      setRedWarningOverlay(false);
      setShowScreenshotShield(false);
      setShowViolationModal(false);

      const nowStr = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date());

      const fullReason =
        reasonTitle ||
        `Diskualifikasi Otomatis: 3 Kali Pelanggaran Keamanan (${finalLogs.join('; ')}) — Dinyatakan Tidak Lulus Ujian dan Wajib Ujian Susulan`;
      setDisqualificationReason(fullReason);

      const disqResult: EssaySubmissionResult = {
        submissionId: `ESAY-DISQ-${Date.now()}`,
        timestamp: nowStr,
        namaSiswa,
        nisNisn,
        kelas,
        semester,
        packageKey,
        totalSoal: questions.length,
        totalDijawab: Object.values(answersRef.current).filter((a) => (a || '').trim().length > 0).length,
        totalKata: Object.values(answersRef.current).reduce(
          (acc, val) => acc + (val ? val.trim().split(/\s+/).filter(Boolean).length : 0),
          0
        ),
        jawaban: { ...answersRef.current },
        raguRagu: { ...doubtfulRef.current },
        durasiDetik: elapsedSecondsRef.current,
        persentaseSelesai: 0,
        isDisqualified: true,
        statusKecurangan: fullReason,
        violationCount: 3,
        violationLogs: [...finalLogs],
        lulusTidakLulus: 'TIDAK LULUS UJIAN (WAJIB UJIAN SUSULAN)',
        catatanGuru: `DISKUALIFIKASI OTOMATIS: Siswa diberhentikan secara otomatis oleh sistem ujian karena melakukan 3 kali pelanggaran keamanan anti-curang selama mengerjakan Soal Esay. Siswa dinyatakan TIDAK LULUS UJIAN dan WAJIB mengikuti Ujian Susulan dengan 15 butir soal esay baru.`,
      };

      setCompletedResult(disqResult);

      try {
        localStorage.setItem(storageCompletedKey, JSON.stringify(disqResult));
        localStorage.setItem(
          storageViolationsKey,
          JSON.stringify({
            count: 3,
            logs: finalLogs,
            isDisqualified: true,
            disqualifiedAt: Date.now(),
          })
        );
      } catch {}

      // Bunyikan sirene kritis diskualifikasi
      playSecuritySound('critical');

      // 1. Laporkan ke server dan dashboard
      onSubmitEssay(disqResult);

      // 2. Otomatis kirim hasil ujian esay diskualifikasi ke WhatsApp Guru (+62 821-6588-5568)
      let waText = `*PEMBERITAHUAN DISKUALIFIKASI OTOMATIS UJIAN ESAY*\n`;
      waText += `*UPTD SMP NEGERI 7 KISARAN*\n`;
      waText += `Identitas Guru Mapel: *${EXAM_INFO.guruMapelUpper}*\n`;
      waText += `Nomor WA Resmi: *${EXAM_INFO.teacherPhone}*\n`;
      waText += `Email Resmi: ${EXAM_INFO.teacherEmail}\n`;
      waText += `----------------------------------------\n`;
      waText += `• Nama Siswa : *${namaSiswa}*\n`;
      waText += `• NIS / NISN : ${nisNisn}\n`;
      waText += `• Kelas : Kelas ${kelas} · Sem ${semester}\n`;
      waText += `• Perangkat : ${deviceCategory || 'HP Android'}: ${deviceModel || 'Smartphone'}\n`;
      waText += `• Waktu Kejadian : ${new Date().toLocaleString('id-ID')}\n`;
      waText += `• Status Kelulusan : *TIDAK LULUS UJIAN (DISKUALIFIKASI)*\n`;
      waText += `• Tindak Lanjut : *WAJIB MENGIKUTI UJIAN SUSULAN*\n`;
      waText += `----------------------------------------\n`;
      waText += `*RINCIAN 3 PELANGGARAN KEAMANAN TERDETEKSI:*\n`;
      finalLogs.slice(0, 3).forEach((log, idx) => {
        waText += `${idx + 1}. ${log}\n`;
      });
      waText += `\n_Laporan resmi otomatis dikirimkan ke WhatsApp Guru Mapel: ${EXAM_INFO.guruMapelUpper} (${EXAM_INFO.teacherPhone})_`;

      // Kirim via gateway Fonnte jika tersedia
      sendExamResultViaFonnteApi({
        targetPhone: EXAM_INFO.teacherPhone,
        message: waText,
        jpgFilename: `Diskualifikasi_${namaSiswa.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
      }).catch(() => {});

      // Kirim cadangan via server sync API
      fetch('/__api/student-dashboard-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendFonnteWhatsAppJpg',
          targetPhone: EXAM_INFO.teacherPhone,
          message: waText,
        }),
      }).catch(() => {});

      // Salin ke clipboard & luncurkan WhatsApp pada perangkat siswa
      try {
        copyToClipboardSafely(waText).catch(() => {});
        const waUrl = getTeacherWhatsAppUrl(waText, EXAM_INFO.teacherPhone);
        openWhatsAppSafely(waUrl, true);
      } catch {}
    },
    [
      kelas,
      namaSiswa,
      nisNisn,
      onSubmitEssay,
      packageKey,
      questions.length,
      semester,
      storageCompletedKey,
      storageViolationsKey,
      deviceCategory,
      deviceModel,
    ]
  );

  // =========================================================================
  // FUNGSI PENCATATAN PELANGGARAN (SETIAP DETEKSI KECURANGAN)
  // =========================================================================
  const recordCheatViolation = useCallback(
    (reason: string, description: string, _triggerRedOverlay: boolean = false) => {
      if (isCompletedRef.current || isDisqualifiedRef.current) return;

      const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const logItem = `${reason} (${nowTimeStr})`;

      const prevCount = violationCountRef.current;
      const nextCount = Math.min(3, prevCount + 1);
      const nextLogs = [...violationLogsRef.current, logItem];

      violationCountRef.current = nextCount;
      violationLogsRef.current = nextLogs;
      setViolationCount(nextCount);
      setViolationLogs(nextLogs);

      try {
        localStorage.setItem(
          storageViolationsKey,
          JSON.stringify({
            count: nextCount,
            logs: nextLogs,
            isDisqualified: nextCount >= 3,
            updatedAt: Date.now(),
          })
        );
      } catch {}

      playSecuritySound('warning');
      setWarningReasonText(reason);
      setWarningCountdown(15);
      setRedWarningOverlay(true);
      setShowViolationModal(false);

      // Tampilkan toast notifikasi pelanggaran
      setSecurityToast(
        nextCount >= 3
          ? `🚨 DALAM WAKTU 15 DETIK ANDA AKAN DITENDANG KELUAR DARI UJIAN! Batas 3x Pelanggaran Tercapai.`
          : `⚠️ NOTIFIKASI PELANGGARAN #${nextCount} DARI 3 KESEMPATAN: ${reason}!`
      );
      setSecurityToastType(nextCount >= 2 ? 'critical' : 'warning');
      setTimeout(() => setSecurityToast(null), 4500);

      setCurrentViolationDetail({
        count: nextCount,
        reason,
        description,
        timestamp: nowTimeStr,
      });
    },
    [storageViolationsKey]
  );

  // Countdown 15 Detik pada Setiap Pelanggaran (Pelanggaran 1, 2, dan 3)
  // Durasi 15 Detik untuk Masuk Kembali ke Ujian via Tombol Hijau (Pelanggaran 1 & 2)
  // Atau Ditendang Keluar dan Ujian Dihentikan Otomatis (Pelanggaran 3 atau Jika Waktu 15 Detik Habis)
  useEffect(() => {
    if (!redWarningOverlay || isCompleted || isDisqualified) return;

    if (warningCountdown <= 0) {
      if (violationCount >= 3) {
        handleDisqualifyExam(
          [...violationLogsRef.current, 'Waktu 15 Detik Habis — Ditendang Keluar Ujian Esay'],
          `Ujian Esay Dihentikan Otomatis: Batas 3 Kali Pelanggaran Tercapai (${warningReasonText}) — Ditendang Keluar Ujian Dalam 15 Detik dan Hasil Dikirim ke WhatsApp Guru`
        );
      } else {
        handleDisqualifyExam(
          [...violationLogsRef.current, `Waktu 15 Detik Habis pada Pelanggaran #${violationCount} Tanpa Masuk Kembali ke Ujian`],
          `Ujian Esay Dihentikan Otomatis: Batas Waktu 15 Detik Habis pada Pelanggaran #${violationCount} Tanpa Masuk Kembali ke Ujian — Ditendang Keluar Ujian dan Hasil Dikirim ke WhatsApp Guru`
        );
      }
      return;
    }

    const timer = setTimeout(() => {
      setWarningCountdown((prev) => {
        playSecuritySound('countdown');
        return prev - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    handleDisqualifyExam,
    isCompleted,
    isDisqualified,
    redWarningOverlay,
    warningCountdown,
    warningReasonText,
    violationCount,
  ]);

  // =========================================================================
  // SISTEM DETEKSI ANTI-SCREENSHOT, TOMBOL HP, MULTI-TOUCH, COPY-PASTE & BLOK
  // =========================================================================
  useEffect(() => {
    if (isCompleted || isDisqualified) return;

    // 1. Fungsi Aktivasi Sensor Blackout Anti-Screenshot
    const triggerScreenshotBlock = (shortcutLabel: string, detailMsg: string) => {
      document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      setScreenshotShieldReason(shortcutLabel);
      setShowScreenshotShield(true);

      // Kosongkan clipboard secara instan
      try {
        navigator.clipboard?.writeText?.('');
      } catch {}

      setTimeout(() => {
        if (!document.hidden && document.hasFocus()) {
          setShowScreenshotShield(false);
          document.documentElement.classList.remove(
            'window-blur-active',
            'exam-blackout-buffer-active'
          );
          document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
        }
      }, 2500);

      recordCheatViolation(
        `Mencoba Tangkapan Layar / Screenshot (${shortcutLabel})`,
        detailMsg,
        false
      );
    };

    // 2. Deteksi Perpindahan Tab / Layar Diminimalkan (visibilitychange)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
        document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
        setScreenshotShieldReason('Layar Diminimalkan / Pindah Aplikasi / Tab Lain Terbuka');
        setShowScreenshotShield(true);
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        recordCheatViolation(
          'Terdeteksi Pindah Tab / Layar Di-Minimize / Buka Aplikasi Lain',
          'Siswa meninggalkan halaman soal ujian esay. Sistem mendeteksi perpindahan aplikasi.',
          true
        );
      } else {
        setTimeout(() => {
          document.documentElement.classList.remove(
            'window-blur-active',
            'exam-blackout-buffer-active'
          );
          document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
          setShowScreenshotShield(false);
        }, 300);
      }
    };

    // 3. Deteksi Jendela Kehilangan Fokus (Window Blur - Status Bar HP Dibuka / Notifikasi / Panel Tangkapan Layar)
    const handleWindowBlur = () => {
      document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      setScreenshotShieldReason('Fokus Jendela Hilang / Status Bar / Panel Screenshot Terbuka');
      setShowScreenshotShield(true);
      try {
        navigator.clipboard?.writeText?.('');
      } catch {}
      recordCheatViolation(
        'Fokus Jendela Hilang / Status Bar HP Dibuka',
        'Fokus layar ujian esay hilang. Terindikasi membuka status bar notifikasi HP atau panel screenshot.',
        true
      );
    };

    const handleWindowFocus = () => {
      setTimeout(() => {
        document.documentElement.classList.remove(
          'window-blur-active',
          'exam-blackout-buffer-active'
        );
        document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
        setShowScreenshotShield(false);
      }, 200);
    };

    // 4. Deteksi Gesture Layar Sentuh Multi-Touch pada Semua HP Android (3 Jari Geser Kebawah untuk Screenshot)
    const handleTouchStart = (e: TouchEvent) => {
      if ((e.touches && e.touches.length >= 2) || (e.targetTouches && e.targetTouches.length >= 2)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(
          `Gesture Layar Sentuh (${e.touches.length} Jari - HP Android)`,
          `Terdeteksi sentuhan ${e.touches.length} jari sekaligus pada layar sentuh HP (gesture screenshot 3 jari pada Android Xiaomi, Oppo, Realme, Vivo, Samsung, dsb dilarang keras).`
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if ((e.touches && e.touches.length >= 2) || (e.targetTouches && e.targetTouches.length >= 2)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(
          `Gesture Sapuan Layar (${e.touches.length} Jari - HP Android)`,
          `Terdeteksi sapuan multi-touch ${e.touches.length} jari di layar sentuh HP yang identik dengan gesture tangkapan layar Android.`
        );
      }
    };

    // 5. Deteksi Layar Terbelah & Pemantauan Orientasi Presisi (Split-Screen / Multi-Window)
    let essayOrientationTimeout: any = null;

    const handleOrientationChange = () => {
      if (essayOrientationTimeout) {
        clearTimeout(essayOrientationTimeout);
      }
      essayOrientationTimeout = setTimeout(() => {
        const precisionRes = evaluatePrecisionSplitScreen();
        if (precisionRes.isSplitScreen) {
          recordCheatViolation(
            precisionRes.reason || `Terdeteksi Layar Terbelah (Split-Screen / Multi-Window) [Orientasi: ${precisionRes.orientation.toUpperCase()}]`,
            precisionRes.violationDetail || 'Siswa mencoba membelah layar (split-screen) untuk membuka aplikasi pencari jawaban.',
            true
          );
        }
      }, 250);
    };

    const handleWindowResize = () => {
      const precisionRes = evaluatePrecisionSplitScreen();
      if (precisionRes.isSplitScreen) {
        recordCheatViolation(
          precisionRes.reason || 'Terdeteksi Layar Terbelah (Split-Screen / Multi-Window)',
          precisionRes.violationDetail || 'Siswa mencoba membelah layar (split-screen) untuk membuka aplikasi pencari jawaban.',
          true
        );
      }
    };

    // 6. Proteksi Anti-Copy: Blokir Klik Kanan (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordCheatViolation(
        'Mencoba Klik Kanan (Right-Click Terkunci)',
        'Menu klik kanan dinonaktifkan pada seluruh area soal esay.',
        false
      );
      setSecurityToast('⚠️ DILARANG KLIK KANAN! Soal Ujian Esay Terkunci.');
    };

    // 7. Proteksi Anti-Copy: Blokir Copy Teks Soal
    const handleCopy = (e: ClipboardEvent) => {
      // Siswa tidak boleh menyalin (copy) dari soal
      e.preventDefault();
      e.stopPropagation();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
      }
      recordCheatViolation(
        'Mencoba Menyalin (Copy) Teks Soal Ujian Esay',
        'Teks butir soal esay dilindungi oleh sistem anti-curang.',
        false
      );
      setSecurityToast('⚠️ DILARANG MENYALIN (COPY) SOAL UJIAN! Teks soal esay dilindungi.');
    };

    // 8. Proteksi Anti-Copy: Blokir Cut Teks
    const handleCut = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (!activeEl || activeEl.tagName !== 'TEXTAREA') {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(
          'Mencoba Memotong (Cut) Teks Soal',
          'Dilarang memotong teks soal esay.',
          false
        );
      }
    };

    // 9. Proteksi Anti-Copy: Blokir Seleksi / Blok pada Teks Soal (selectstart)
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          Boolean(target.isContentEditable));
      if (!isInput) {
        e.preventDefault();
        recordCheatViolation(
          'Mencoba Memblok / Menandai Teks Soal Esay',
          'Siswa dilarang memblok teks soal ujian untuk mencegah tindakan copy-paste.',
          false
        );
        setSecurityToast('⚠️ DILARANG MEMBLOK TEKS SOAL! Teks soal esay dilindungi.');
      }
    };

    // 10. Proteksi Drag Teks
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      if (!isInput) {
        e.preventDefault();
      }
    };

    // 11. Deteksi Tombol Fisik HP Android & Pintasan Screenshot Keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toUpperCase() : '';
      const code = e.code || '';
      const keyCode = e.keyCode;

      // a. Tombol Fisik Volume HP Android (Kombinasi Volume Down + Power adalah standar screenshot semua HP)
      const isPhysicalVolumeScreenshot =
        e.key === 'AudioVolumeDown' ||
        e.key === 'VolumeDown' ||
        code === 'AudioVolumeDown' ||
        code === 'VolumeDown' ||
        keyCode === 174 ||
        keyCode === 25 || // Android KEYCODE_VOLUME_DOWN
        e.key === 'AudioVolumeUp' ||
        e.key === 'VolumeUp' ||
        code === 'AudioVolumeUp' ||
        keyCode === 175 ||
        keyCode === 24 || // Android KEYCODE_VOLUME_UP
        e.key === 'AudioVolumeMute' ||
        keyCode === 164;

      // b. Pintasan Screenshot Laptop / PC / Mac / Chromebook
      const isPrintScreen =
        e.key === 'PrintScreen' || code === 'PrintScreen' || keyCode === 44;
      const isMacScreenshot =
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        ['3', '4', '5', '6', '$', '%', '^', '&'].includes(e.key);
      const isWinSnipping =
        ((e.metaKey || e.ctrlKey) && e.shiftKey && ['S', 's'].includes(e.key)) ||
        ((e.metaKey || e.ctrlKey) && ['G', 'g', 'W', 'w'].includes(e.key)) ||
        (e.metaKey && e.altKey && isPrintScreen) ||
        (e.altKey && isPrintScreen) ||
        (e.ctrlKey && isPrintScreen);
      const isChromebookScreenshot =
        ((e.ctrlKey || e.metaKey) && (e.key === 'F5' || code === 'F5' || keyCode === 116)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F5' || code === 'F5')) ||
        (e.altKey && e.ctrlKey && ['s', 'S'].includes(e.key));

      // c. Pintasan Salin / Potong diluar Textarea Jawaban
      const isCopyCut =
        (e.ctrlKey || e.metaKey) && ['C', 'c', 'X', 'x'].includes(e.key);
      const isSelectAllOutside =
        (e.ctrlKey || e.metaKey) && ['A', 'a'].includes(e.key);
      const isPrintOrSave =
        (e.ctrlKey || e.metaKey) && ['P', 'p', 'S', 's', 'U', 'u'].includes(e.key);
      const isDevTools =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(key);
      const isF12 = e.key === 'F12';

      // Eksekusi Blokir Tombol Fisik Screenshot HP Android
      if (isPhysicalVolumeScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(
          'Tombol Fisik Volume / Power HP Android',
          'Sensor mendeteksi penekanan tombol fisik volume/power yang biasa digunakan untuk mengambil screenshot pada perangkat HP Android.'
        );
        return;
      }

      // Eksekusi Blokir Tombol Screenshot PC / Laptop
      if (isPrintScreen || isMacScreenshot || isWinSnipping || isChromebookScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(
          isPrintScreen
            ? 'Tombol PrintScreen'
            : isMacScreenshot
            ? 'Mac Screenshot (Cmd+Shift+3/4/5)'
            : isChromebookScreenshot
            ? 'Chromebook Capture (Ctrl+F5)'
            : 'Windows Snipping Tool (Win+Shift+S)',
          'Sensor mendeteksi pintasan tangkapan layar keyboard.'
        );
        return;
      }

      // Eksekusi Blokir Copy pada Soal
      const activeEl = document.activeElement;
      const isInsideTextarea = activeEl && activeEl.tagName === 'TEXTAREA';

      if (isCopyCut && !isInsideTextarea) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(
          `Menekan Pintasan Salin (${e.ctrlKey ? 'Ctrl+' : 'Cmd+'}${e.key})`,
          'Dilarang menekan tombol kombinasi copy pada teks soal ujian esay.',
          false
        );
        setSecurityToast('⚠️ DILARANG MENYALIN (COPY) TEKS SOAL UJIAN!');
        return;
      }

      if (isSelectAllOutside && !isInsideTextarea) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(
          'Menekan Pintasan Pilih Semua (Ctrl+A)',
          'Dilarang memblok seluruh isi layar soal ujian.',
          false
        );
        return;
      }

      if (isPrintOrSave) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(
          `Mencoba Mencetak / Simpan Halaman (${e.ctrlKey ? 'Ctrl+' : 'Cmd+'}${e.key})`,
          'Dilarang mencetak atau menyimpan dokumen soal ujian.',
          false
        );
        return;
      }

      if (isF12 || isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(
          `Membuka Developer Tools (${e.key})`,
          'Dilarang membuka inspect element atau konsol pengembang browser.',
          false
        );
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        keyCodeOrCode(e) === 44 ||
        e.code === 'KeyS' ||
        e.key === 'F5'
      ) {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
      }
    };

    function keyCodeOrCode(ev: KeyboardEvent) {
      return ev.keyCode || 0;
    }

    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      triggerScreenshotBlock(
        'Mencetak Halaman Ujian',
        'Mencetak halaman soal esay diblokir untuk menjaga kerahasiaan soal.'
      );
    };

    // Blokir Screen Capture API (perekam layar browser)
    let origGetDisplayMedia: any = null;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      (navigator.mediaDevices as any).getDisplayMedia
    ) {
      origGetDisplayMedia = (navigator.mediaDevices as any).getDisplayMedia;
      (navigator.mediaDevices as any).getDisplayMedia = function () {
        triggerScreenshotBlock('Perekaman Layar (Screen Capture API)', 'Perekaman layar diblokir.');
        return Promise.reject(new Error('Perekaman layar diblokir oleh sistem ujian.'));
      };
    }

    // Pasang Seluruh Event Listener Pengawasan
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleWindowResize);
    }
    window.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleWindowResize);
      }
      if (essayOrientationTimeout) {
        clearTimeout(essayOrientationTimeout);
      }
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('beforeprint', handleBeforePrint);

      if (origGetDisplayMedia && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        (navigator.mediaDevices as any).getDisplayMedia = origGetDisplayMedia;
      }
    };
  }, [isCompleted, isDisqualified, recordCheatViolation]);

  // Pengumpulan Ujian Normal (Jika Siswa Selesai Tanpa 3 Kali Pelanggaran)
  const handleFinalSubmit = () => {
    setShowConfirmSubmitModal(false);
    const nowStr = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    const isClean = violationCount === 0;
    const cheatStatus = isClean
      ? 'Tidak Ada Kecurangan (Jujur / Bersih)'
      : `Terdeteksi ${violationCount}x Peringatan Pelanggaran (${violationLogs.join(' | ')})`;

    const result: EssaySubmissionResult = {
      submissionId: `ESAY-${Date.now()}`,
      timestamp: nowStr,
      namaSiswa,
      nisNisn,
      kelas,
      semester,
      packageKey,
      totalSoal: questions.length,
      totalDijawab: totalAnswered,
      totalKata: totalWords,
      jawaban: answers,
      raguRagu: doubtful,
      durasiDetik: elapsedSeconds,
      persentaseSelesai: progressPercent,
      isDisqualified: false,
      statusKecurangan: cheatStatus,
      violationCount,
      violationLogs,
      lulusTidakLulus: totalAnswered >= 12 ? 'LULUS UJIAN' : 'LULUS BERSYARAT',
      catatanGuru:
        totalAnswered === questions.length
          ? `Lengkap: Siswa telah menyelesaikan seluruh 15 butir soal esay. (Integritas: ${cheatStatus})`
          : `Siswa menyelesaikan ${totalAnswered} dari ${questions.length} butir soal esay. (Integritas: ${cheatStatus})`,
    };

    setCompletedResult(result);
    setIsCompleted(true);
    try {
      localStorage.setItem(storageCompletedKey, JSON.stringify(result));
    } catch {}

    onSubmitEssay(result);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
  };

  // Unduh Berkas Lembar Soal & Jawaban Esay dalam Bentuk PDF Resmi
  const handleDownloadPdfWorksheet = () => {
    if (!completedResult) return;
    setIsGeneratingPdf(true);
    setPdfFeedback('Menyimpan Lembar Soal & Jawaban Esay ke PDF...');
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 14;

      // Header Resmi UPTD SMP Negeri 7 Kisaran
      doc.setFillColor(12, 74, 110);
      doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

      doc.setTextColor(252, 211, 77);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(
        `LEMBAR RESMI SOAL & JAWABAN UJIAN ESAY INFORMATIKA FASE D (15 SOAL)`,
        margin + 6,
        y + 7
      );

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text(EXAM_INFO.namaSekolah, margin + 6, y + 16);

      doc.setTextColor(186, 230, 253);
      doc.setFontSize(8.5);
      doc.text(
        `Kurikulum Merdeka | Guru Mapel: ${EXAM_INFO.guruMapelUpper} | TA ${EXAM_INFO.tahunAjaran}`,
        margin + 6,
        y + 23
      );

      // Kotak Ringkasan Nilai & Status di Kanan Atas
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(pageWidth - margin - 38, y + 4, 33, 20, 2, 2, 'F');
      doc.setTextColor(252, 211, 77);
      doc.setFontSize(7);
      doc.text('STATUS SELESAI', pageWidth - margin - 21.5, y + 9.5, { align: 'center' });
      doc.setTextColor(52, 211, 153);
      doc.setFontSize(12);
      doc.text(`${completedResult.persentaseSelesai}%`, pageWidth - margin - 21.5, y + 18, {
        align: 'center',
      });

      y += 33;

      // Kotak Identitas Siswa
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);

      const col1X = margin + 5;
      const col2X = margin + contentWidth / 2 + 2;

      doc.text(`Nama Siswa       : ${namaSiswa}`, col1X, y + 6);
      doc.text(`Kelas / Semester : Kelas ${kelas} / Semester ${semester}`, col1X, y + 12);
      doc.text(`NIS / NISN       : ${nisNisn || '-'}`, col1X, y + 18);

      doc.text(`Total Soal       : ${completedResult.totalSoal} Soal Esay`, col2X, y + 6);
      doc.text(
        `Soal Dijawab     : ${completedResult.totalDijawab} dari ${completedResult.totalSoal} Soal (${completedResult.totalKata} kata)`,
        col2X,
        y + 12
      );
      doc.text(`Waktu Selesai    : ${completedResult.timestamp}`, col2X, y + 18);

      y += 28;

      // Status Integritas & Pelanggaran
      doc.setFillColor(completedResult.violationCount ? 254 : 240, completedResult.violationCount ? 242 : 253, completedResult.violationCount ? 242 : 244);
      doc.setDrawColor(completedResult.violationCount ? 248 : 167, completedResult.violationCount ? 113 : 243, completedResult.violationCount ? 113 : 208);
      doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
      doc.setTextColor(completedResult.violationCount ? 185 : 6, completedResult.violationCount ? 28 : 95, completedResult.violationCount ? 28 : 70);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `STATUS INTEGRITAS UJIAN: ${
          completedResult.violationCount
            ? `Terdeteksi ${completedResult.violationCount}x Peringatan Pelanggaran (${completedResult.violationLogs?.join(', ') || '-'})`
            : 'BERSIH / TANPA PELANGGARAN KEAMANAN (JUJUR)'
        }`,
        margin + 4,
        y + 7.5
      );

      y += 16;

      // Loop 15 Butir Soal Esay
      questions.forEach((q) => {
        const studentAns = (completedResult.jawaban[q.noSoal] || '').trim();
        const isFilled = studentAns.length > 0;
        const wCount = studentAns ? studentAns.split(/\s+/).filter(Boolean).length : 0;

        const qHeaderLines = doc.splitTextToSize(
          `SOAL #${q.noSoal} [${q.elemen} - Bobot ${q.bobot}%]: ${q.content}`,
          contentWidth - 10
        );

        const stuAnsLines = doc.splitTextToSize(
          `Jawaban Siswa (${isFilled ? `${wCount} kata` : 'Belum Dijawab'}):\n${
            studentAns || '[Siswa belum mengisi jawaban untuk butir soal ini]'
          }`,
          contentWidth - 10
        );

        const rubrikLines = doc.splitTextToSize(
          `Rubrik Penilaian & Kunci Pembahasan Guru: ${q.kunciJawaban}\nKata Kunci: ${q.kataKunci.join(
            ', '
          )}`,
          contentWidth - 10
        );

        const boxHeight =
          10 +
          qHeaderLines.length * 4.2 +
          stuAnsLines.length * 4.2 +
          rubrikLines.length * 3.8 +
          6;

        if (y + boxHeight > pageHeight - 16) {
          doc.addPage();
          y = 15;
        }

        doc.setFillColor(isFilled ? 248 : 255, isFilled ? 250 : 241, isFilled ? 252 : 242);
        doc.setDrawColor(isFilled ? 186 : 244, isFilled ? 230 : 63, isFilled ? 253 : 94);
        doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

        let innerY = y + 6;
        doc.setTextColor(12, 74, 110);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.8);
        doc.text(qHeaderLines, margin + 5, innerY);
        innerY += qHeaderLines.length * 4.2 + 2;

        doc.setTextColor(isFilled ? 15 : 190, isFilled ? 23 : 18, isFilled ? 42 : 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.text(stuAnsLines, margin + 5, innerY);
        innerY += stuAnsLines.length * 4.2 + 2;

        doc.setTextColor(5, 150, 105);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.8);
        doc.text(rubrikLines, margin + 5, innerY);

        y += boxHeight + 4;
      });

      const safeName = namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
      const safeKelas = kelas.replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFilename = `Lembar_Ujian_Esay_${safeName}_Kelas_${safeKelas}.pdf`;
      doc.save(pdfFilename);

      setPdfFeedback('✓ Berhasil Simpan Soal & Jawaban dalam Bentuk PDF!');
      setTimeout(() => setPdfFeedback(null), 4000);
    } catch (err) {
      console.error('Gagal generate PDF esay:', err);
      setPdfFeedback('Gagal mengunduh file PDF');
      setTimeout(() => setPdfFeedback(null), 3000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Unduh Surat Bukti Diskualifikasi dalam Bentuk Dokumen PDF Resmi
  const handleDownloadDisqualificationPdf = () => {
    setIsGeneratingPdf(true);
    setPdfFeedback('Membuat Berita Acara Diskualifikasi...');
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let y = 16;

      // Header Merah Keras Surat Pelanggaran
      doc.setFillColor(159, 18, 57);
      doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');

      doc.setTextColor(254, 205, 211);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`BERITA ACARA RESMI PENGHENTIAN OTOMATIS & DISKUALIFIKASI UJIAN`, margin + 6, y + 8);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text(EXAM_INFO.namaSekolah, margin + 6, y + 17);

      doc.setTextColor(254, 226, 226);
      doc.setFontSize(8.5);
      doc.text(
        `Kurikulum Merdeka Informatika Fase D | Guru: ${EXAM_INFO.guruMapelUpper}`,
        margin + 6,
        y + 24
      );

      y += 36;

      // Status Tidak Lulus Kotak Merah
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(244, 63, 94);
      doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');
      doc.setTextColor(190, 18, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('STATUS KELULUSAN: TIDAK LULUS UJIAN (DISKUALIFIKASI KEAMANAN)', margin + 6, y + 8);
      doc.setFontSize(8.5);
      doc.text('Siswa WAJIB Mengikuti Ujian Susulan dengan 15 Butir Soal Esay Baru', margin + 6, y + 14);

      y += 24;

      // Identitas Siswa
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Nama Siswa       : ${namaSiswa}`, margin + 5, y + 6);
      doc.text(`NIS / NISN       : ${nisNisn || '-'}`, margin + 5, y + 12);
      doc.text(`Kelas / Semester : Kelas ${kelas} / Semester ${semester}`, margin + 5, y + 18);
      doc.text(
        `Perangkat / IP   : ${deviceCategory || 'HP Android'}: ${deviceModel || 'Smartphone'} · IP: ${clientIp || '127.0.0.1'}`,
        margin + 5,
        y + 24
      );

      y += 32;

      // Rincian 3 Pelanggaran
      doc.setTextColor(159, 18, 57);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('KRONOLOGI 3 KALI TINDAKAN PELANGGARAN KEAMANAN TERDETEKSI:', margin, y);
      y += 6;

      violationLogs.slice(0, 3).forEach((log, idx) => {
        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(254, 205, 211);
        doc.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD');
        doc.setTextColor(190, 18, 60);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`Pelanggaran #${idx + 1}: ${log}`, margin + 4, y + 6.5);
        y += 13;
      });

      y += 5;

      // Penjelasan Regulasi
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const ruleDesc = doc.splitTextToSize(
        `Catatan Resmi: Sistem keamanan ujian online UPTD SMP Negeri 7 Kisaran telah memprogram penghentian otomatis apabila seorang siswa melakukan 3 kali tindakan kecurangan (meliputi percobaan screenshot tombol fisik HP/gesture multi-touch, memblok/copy teks soal, meninggalkan halaman ujian, atau split-screen). Nilai pengerjaan dibatalkan, dan siswa wajib menghadap Guru Mata Pelajaran untuk mengikuti Ujian Susulan dengan paket soal baru.`,
        contentWidth
      );
      doc.text(ruleDesc, margin, y);

      const safeName = namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Surat_Diskualifikasi_Ujian_Esay_${safeName}.pdf`);
      setPdfFeedback('✓ Berhasil Menyimpan Berita Acara Diskualifikasi (PDF)!');
      setTimeout(() => setPdfFeedback(null), 3500);
    } catch {
      setPdfFeedback('Gagal membuat dokumen PDF');
      setTimeout(() => setPdfFeedback(null), 3000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Kirim Bukti Laporan Diskualifikasi ke WhatsApp Guru Mapel
  const handleShareDisqualificationToWhatsApp = async () => {
    let text = `*PEMBERITAHUAN DISKUALIFIKASI OTOMATIS UJIAN ESAY*\n`;
    text += `*UPTD SMP NEGERI 7 KISARAN*\n`;
    text += `Identitas Guru Mapel: *${EXAM_INFO.guruMapelUpper}*\n`;
    text += `Nomor WA Resmi: *${EXAM_INFO.teacherPhone}*\n`;
    text += `Email Resmi: ${EXAM_INFO.teacherEmail}\n`;
    text += `----------------------------------------\n`;
    text += `• Nama Siswa : *${namaSiswa}*\n`;
    text += `• NIS / NISN : ${nisNisn}\n`;
    text += `• Kelas : Kelas ${kelas} · Sem ${semester}\n`;
    text += `• Perangkat : ${deviceCategory || 'HP Android'}: ${deviceModel || 'Smartphone'}\n`;
    text += `• Waktu Kejadian : ${new Date().toLocaleString('id-ID')}\n`;
    text += `• Status Kelulusan : *TIDAK LULUS UJIAN (DISKUALIFIKASI)*\n`;
    text += `• Tindak Lanjut : *WAJIB MENGIKUTI UJIAN SUSULAN*\n`;
    text += `----------------------------------------\n`;
    text += `*RINCIAN 3 PELANGGARAN KEAMANAN TERDETEKSI:*\n`;
    violationLogs.slice(0, 3).forEach((log, idx) => {
      text += `${idx + 1}. ${log}\n`;
    });
    text += `\n_Laporan dikirim langsung ke WhatsApp Guru Mapel: ${EXAM_INFO.guruMapelUpper} (${EXAM_INFO.teacherPhone})_`;

    setDisqualifyWaNotice('Membuka WhatsApp Guru...');

    // Salin teks ke clipboard & buka WhatsApp
    copyToClipboardSafely(text).catch(() => {});
    const waUrl = getTeacherWhatsAppUrl(text);
    openWhatsAppSafely(waUrl);

    // Kirim juga via Fonnte di latar belakang jika tersedia
    sendExamResultViaFonnteApi({
      targetPhone: EXAM_INFO.teacherPhone,
      message: text,
      jpgFilename: `Diskualifikasi_${namaSiswa.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
    }).catch(() => {});

    setDisqualifyWaNotice(`✓ Terhubung ke WhatsApp Guru (${EXAM_INFO.teacherPhone})!`);
  };

  // Kirim Lembar Jawaban Normal ke WhatsApp Guru Mapel
  const handleShareToWhatsApp = async () => {
    if (!completedResult) return;
    setWaFeedback('Membuka WhatsApp Guru...');

    let text = `*LEMBAR JAWABAN TUGAS / LATIHAN SOAL ESAY INFORMATIKA*\n`;
    text += `*UPTD SMP NEGERI 7 KISARAN*\n`;
    text += `Identitas Guru Mapel: *${EXAM_INFO.guruMapelUpper}*\n`;
    text += `Nomor WA Resmi: *${EXAM_INFO.teacherPhone}*\n`;
    text += `Email Resmi: ${EXAM_INFO.teacherEmail}\n`;
    text += `----------------------------------------\n`;
    text += `• Nama Siswa : *${namaSiswa}*\n`;
    text += `• NIS / NISN : ${nisNisn}\n`;
    text += `• Kelas : Kelas ${kelas} · Semester ${semester}\n`;
    text += `• Total Soal : ${completedResult.totalSoal} Soal Esay\n`;
    text += `• Soal Dijawab : ${completedResult.totalDijawab} dari ${completedResult.totalSoal} Soal (${completedResult.persentaseSelesai}%)\n`;
    text += `• Total Kata : ${completedResult.totalKata} kata\n`;
    text += `• Integritas : ${completedResult.statusKecurangan}\n`;
    text += `• Durasi Pengerjaan : ${formatDuration(completedResult.durasiDetik)}\n`;
    text += `• Waktu Selesai : ${completedResult.timestamp}\n`;
    text += `----------------------------------------\n`;
    text += `*RINGKASAN 15 SOAL & JAWABAN SISWA:*\n\n`;

    questions.forEach((q) => {
      const jwb = (completedResult.jawaban[q.noSoal] || '').trim();
      const shortAns = jwb.length > 120 ? jwb.slice(0, 117) + '...' : jwb;
      text += `• *Soal #${q.noSoal} [${q.elemen} - Bobot ${q.bobot}%]:*\n`;
      text += `  Jawaban: ${shortAns ? shortAns : '[Belum dijawab]'}\n\n`;
    });

    text += `_Laporan lengkap lembar jawaban esay dikirim ke WhatsApp Guru Mapel: ${EXAM_INFO.guruMapelUpper} (${EXAM_INFO.teacherPhone})_`;

    // Salin teks ke clipboard & buka WhatsApp
    copyToClipboardSafely(text).catch(() => {});
    const waUrl = getTeacherWhatsAppUrl(text);
    openWhatsAppSafely(waUrl);

    // Jalankan juga Fonnte di latar belakang jika tersedia
    sendExamResultViaFonnteApi({
      targetPhone: EXAM_INFO.teacherPhone,
      message: text,
      jpgFilename: `Jawaban_Esay_${namaSiswa.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
    }).catch(() => {});

    setWaFeedback(`✓ Terhubung ke WhatsApp Guru (${EXAM_INFO.teacherPhone})!`);
    setTimeout(() => setWaFeedback(null), 5000);
  };

  // Cetak dokumen lembar jawaban
  const handlePrintWorksheet = () => {
    window.print();
  };

  // =========================================================================
  // TAMPILAN 1: LAYAR DISKUALIFIKASI KECURANGAN (JIKA 3 KALI PELANGGARAN)
  // =========================================================================
  if (isDisqualified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
        {/* Header Merah Status Gagal */}
        <header className="bg-gradient-to-r from-rose-950 via-slate-950 to-rose-950 border-b border-rose-500/50 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <TutWuriLogo size="sm" />
            <div>
              <div className="text-[10px] sm:text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                <span>{EXAM_INFO.namaSekolah} · SISTEM PENGAWASAN KEAMANAN UJIAN</span>
              </div>
              <h1 className="text-xs sm:text-base font-extrabold text-white truncate">
                Ujian Esay Diberhentikan Otomatis (3 Kali Pelanggaran)
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-md bg-rose-500/30 border border-rose-400 text-rose-200 text-[10px] sm:text-xs font-mono font-extrabold flex items-center gap-1 animate-pulse">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              <span>STATUS: DISKUALIFIKASI (3/3)</span>
            </span>
          </div>
        </header>

        {/* Konten Utama Layar Diskualifikasi */}
        <main className="flex-1 max-w-3xl w-full mx-auto p-3 sm:p-5 flex flex-col justify-center space-y-4">
          <div className="rounded-2xl border-2 border-rose-500/80 bg-gradient-to-br from-rose-950/80 via-slate-900/95 to-slate-950 p-4 sm:p-6 shadow-2xl space-y-4 text-center">
            {/* Ikon Gagal Besar */}
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-500/20 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50 animate-bounce">
              <AlertOctagon className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-rose-500/30 border border-rose-400 text-rose-200 text-[10px] sm:text-xs font-mono font-extrabold uppercase tracking-wider inline-block">
                KEPUTUSAN SISTEM KEAMANAN OTOMATIS
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                ANDA DINYATAKAN TIDAK LULUS UJIAN
              </h2>
              <p className="text-xs sm:text-sm text-rose-300 font-semibold max-w-xl mx-auto">
                Sistem secara otomatis menghentikan pengerjaan soal esay Anda karena terdeteksi melakukan{' '}
                <strong className="text-white underline">3 (tiga) kali pelanggaran keamanan</strong>.
              </p>
            </div>

            {/* Kotak Identitas Siswa */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 text-left grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] sm:text-xs">
              <div>
                <span className="text-slate-400">Nama Siswa:</span>{' '}
                <strong className="text-white">{namaSiswa}</strong>
              </div>
              <div>
                <span className="text-slate-400">NIS / NISN:</span>{' '}
                <strong className="text-sky-300">{nisNisn || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Kelas &amp; Semester:</span>{' '}
                <strong className="text-amber-300">Kelas {kelas} · Sem {semester}</strong>
              </div>
              <div>
                <span className="text-slate-400">Perangkat:</span>{' '}
                <strong className="text-slate-200">
                  {deviceCategory || 'HP Android'}: {deviceModel || 'Smartphone'}
                </strong>
              </div>
              <div className="sm:col-span-2 pt-1 border-t border-white/10 text-[10px] text-slate-400">
                Waktu Penghentian: <span className="text-rose-300 font-mono">{new Date().toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Rincian Kronologi 3 Pelanggaran Terdeteksi */}
            <div className="p-3 sm:p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-left space-y-2">
              <div className="text-[11px] sm:text-xs font-extrabold text-rose-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Rincian 3 Tindakan Pelanggaran Keamanan yang Terdeteksi Sistem:</span>
              </div>
              <div className="space-y-1.5">
                {violationLogs.slice(0, 3).map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-950/90 border border-rose-500/30 flex items-start gap-2 text-[10px] sm:text-[11px]"
                  >
                    <span className="w-5 h-5 rounded-full bg-rose-500/30 text-rose-200 font-mono font-black flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-slate-200 font-medium leading-snug">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Regulasi Sekolah & Kewajiban Ujian Susulan */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-400/40 text-[10.5px] sm:text-xs text-amber-200 text-left leading-relaxed space-y-1">
              <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>KEWAJIBAN PESERTA UJIAN:</span>
              </div>
              <p>
                Sesuai ketentuan tata tertib ujian Kurikulum Merdeka Fase D Informatika di UPTD SMP Negeri 7 Kisaran (Guru Mapel: <strong>{EXAM_INFO.guruMapel}</strong>), siswa yang terdiskualifikasi <strong>wajib mengikuti UJIAN SUSULAN</strong> dengan 15 butir soal esay baru yang berbeda secara acak.
              </p>
            </div>

            {/* Tombol Aksi Utama */}
            <div className="space-y-2 pt-2">
              {/* 1. Tombol Ujian Susulan Sekarang */}
              {onRetakeEssay && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(storageDraftKey);
                      localStorage.removeItem(storageCompletedKey);
                      localStorage.removeItem(storageViolationsKey);
                    } catch {}
                    setIsDisqualified(false);
                    setIsCompleted(false);
                    setViolationCount(0);
                    setViolationLogs([]);
                    setAnswers({});
                    setDoubtful({});
                    setCurrentIndex(0);
                    onRetakeEssay();
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-amber-400/20 active:scale-[0.99]"
                >
                  <RotateCcw className="w-4 h-4 text-slate-950" />
                  <span>IKUTI UJIAN SUSULAN SEKARANG (15 SOAL ESAY BARU)</span>
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 2. Tombol Kirim Bukti ke WhatsApp Guru Langsung Tanpa Buka Browser */}
                <button
                  type="button"
                  onClick={handleShareDisqualificationToWhatsApp}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                  <span>{disqualifyWaNotice || 'Lapor ke Guru via WhatsApp (Kirim Langsung)'}</span>
                </button>

                {/* 3. Tombol Simpan Dokumen PDF Diskualifikasi */}
                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadDisqualificationPdf}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-200 border border-sky-400/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5 text-sky-300" />
                  <span>{pdfFeedback || 'Simpan Berita Acara (PDF)'}</span>
                </button>
              </div>

              {disqualifyWaNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-400/40 text-emerald-200 text-xs font-medium text-center">
                  {disqualifyWaNotice}
                </div>
              )}

              {/* 4. Tombol Kembali ke Menu Utama */}
              <button
                type="button"
                onClick={onExitHome}
                className="py-2 px-3 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Kembali ke Menu Utama
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 2: HASIL PENGERJAAN NORMAL (SELESAI DENGAN INTEGRITAS BERSIH)
  // =========================================================================
  if (isCompleted && completedResult) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Header Hasil */}
        <header className="bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border-b border-sky-500/30 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <TutWuriLogo size="sm" />
            <div>
              <div className="text-[10px] sm:text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                {EXAM_INFO.namaSekolah} · Latihan Dikelas &amp; Tugas Dirumah
              </div>
              <h1 className="text-xs sm:text-base font-extrabold text-white truncate">
                Lembar Hasil Pengerjaan 15 Soal Esay Online
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdfWorksheet}
              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9px] sm:text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              title="Simpan Seluruh Soal dan Jawaban Esay dalam Bentuk File Dokumen PDF"
            >
              <Download className="w-3 h-3 text-slate-950" />
              <span className="hidden sm:inline">{pdfFeedback || 'SIMPAN SOAL DALAM BENTUK PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              type="button"
              onClick={handleShareToWhatsApp}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] sm:text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
              title="Kirim Seluruh Soal dan Jawaban Esay ke WhatsApp Guru Mapel"
            >
              <Send className="w-3 h-3 text-white" />
              <span className="hidden sm:inline">{waFeedback || 'KIRIM SOAL DAN JAWABAN KE WHATSAPP GURU'}</span>
              <span className="sm:hidden">WA GURU</span>
            </button>
            <button
              type="button"
              onClick={onExitHome}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Kembali</span>
            </button>
          </div>
        </header>

        {/* Konten Ringkasan */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-5 space-y-3 sm:space-y-4">
          {/* Banner Kartu Hasil */}
          <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/70 via-slate-900/90 to-sky-950/70 p-3 sm:p-5 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <Award className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-lg font-extrabold text-white">
                    Tugas 15 Soal Esay Berhasil Dikumpulkan!
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-emerald-300 font-medium">
                    Kurikulum Merdeka Informatika Fase D · Kelas {kelas} · Semester {semester}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[9px] sm:text-[10px] font-mono font-extrabold text-emerald-300">
                  ✓ Selesai ({completedResult.persentaseSelesai}%)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-extrabold border ${
                    completedResult.violationCount === 0
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  }`}
                >
                  {completedResult.violationCount === 0
                    ? '🛡️ Integritas: Bersih (0 Pelanggaran)'
                    : `⚠️ ${completedResult.violationCount}x Peringatan`}
                </span>
              </div>
            </div>

            {/* Statistik Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10">
                <div className="text-[9px] text-slate-400 font-semibold uppercase">Total Soal Dijawab</div>
                <div className="text-base sm:text-xl font-extrabold text-emerald-400 font-mono">
                  {completedResult.totalDijawab} / {completedResult.totalSoal}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10">
                <div className="text-[9px] text-slate-400 font-semibold uppercase">Total Kata Ditulis</div>
                <div className="text-base sm:text-xl font-extrabold text-sky-400 font-mono">
                  {completedResult.totalKata} Kata
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10">
                <div className="text-[9px] text-slate-400 font-semibold uppercase">Durasi Pengerjaan</div>
                <div className="text-base sm:text-xl font-extrabold text-amber-300 font-mono">
                  {formatDuration(completedResult.durasiDetik)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10">
                <div className="text-[9px] text-slate-400 font-semibold uppercase">Guru Pembimbing</div>
                <div className="text-[11px] sm:text-xs font-extrabold text-white mt-1 truncate">
                  {EXAM_INFO.guruMapel}
                </div>
              </div>
            </div>

            {/* Detail Identitas Siswa */}
            <div className="p-2.5 rounded-lg bg-slate-950/70 border border-white/10 text-[10px] sm:text-[11px] flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-white">{namaSiswa}</strong> ·{' '}
                <span className="text-slate-300">NISN: {nisNisn}</span> ·{' '}
                <span className="text-amber-300">Kelas {kelas}</span>
              </div>
              <div className="text-slate-400 text-[9.5px]">
                Diserahkan pada: <span className="text-sky-300 font-mono">{completedResult.timestamp}</span>
              </div>
            </div>
          </div>

          {/* Panel Aksi Utama */}
          <div className="p-3 sm:p-4 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-sky-950/80 shadow-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-300 shrink-0" />
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-white">
                    Aksi Utama Setelah Selesai Tugas / Latihan Esay Online
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-emerald-300 font-medium">
                    Simpan seluruh 15 butir soal &amp; jawaban dalam bentuk PDF serta kirimkan rincian soal &amp; jawaban ke WhatsApp Guru Mapel ({EXAM_INFO.guruMapelUpper})
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[9px] sm:text-[10px] font-mono font-extrabold text-emerald-300">
                DOKUMEN RESMI ESAY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadPdfWorksheet}
                className="py-2.5 px-3.5 rounded-xl text-xs sm:text-[13px] font-extrabold bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-amber-400/20 hover:scale-[1.01] active:scale-[0.99]"
              >
                <Download className="w-4 h-4 shrink-0 text-slate-950" />
                <span className="truncate">{pdfFeedback || 'SIMPAN SOAL DALAM BENTUK PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareToWhatsApp}
                className="py-2.5 px-3.5 rounded-xl text-xs sm:text-[13px] font-extrabold bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-400/20 hover:scale-[1.01] active:scale-[0.99]"
              >
                <Send className="w-4 h-4 shrink-0 text-slate-950" />
                <span className="truncate">{waFeedback || 'KIRIM SOAL DAN JAWABAN KE WHATSAPP GURU'}</span>
              </button>
            </div>

            {onRetakeEssay && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[9.5px] sm:text-[10.5px] text-slate-300">
                  Ingin mengulang latihan atau mengikuti ujian susulan? Sistem otomatis memuat 15 butir soal esay yang <strong className="text-emerald-300">baru &amp; berbeda</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(storageDraftKey);
                      localStorage.removeItem(storageCompletedKey);
                      localStorage.removeItem(storageViolationsKey);
                    } catch {}
                    setIsCompleted(false);
                    setCurrentIndex(0);
                    setAnswers({});
                    setDoubtful({});
                    setViolationCount(0);
                    setViolationLogs([]);
                    onRetakeEssay();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                  <span>Ujian Ulang / Susulan (Soal Baru)</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigasi Tinjauan Per Soal */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-sky-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-300" />
              <span>Tinjau Lembar Jawaban &amp; Kunci Pembahasan Guru</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowKeyReview(!showKeyReview)}
              className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-sky-400/40 bg-sky-950/80 hover:bg-sky-900/80 text-sky-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {showKeyReview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-amber-300" />}
              <span>{showKeyReview ? 'Sembunyikan Kunci Guru' : 'Tampilkan Kunci Pembahasan'}</span>
            </button>
          </div>

          {/* Daftar 15 Soal dengan Jawaban Siswa */}
          <div className="space-y-3">
            {questions.map((q) => {
              const studentAns = (completedResult.jawaban[q.noSoal] || '').trim();
              const isFilled = studentAns.length > 0;
              const wCount = countWords(studentAns);

              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-sky-500/25 bg-slate-900/80 p-3 sm:p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/40 text-[9px] sm:text-[10px] font-mono font-extrabold text-sky-300 flex items-center justify-center">
                        {q.noSoal}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[8px] sm:text-[9px] font-bold">
                        {q.elemen}
                      </span>
                      <span className="text-[8.5px] sm:text-[9.5px] text-amber-300 font-semibold">
                        Bobot: {q.bobot}%
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-mono font-bold ${
                        isFilled
                          ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                          : 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
                      }`}
                    >
                      {isFilled ? `✓ Terjawab (${wCount} kata)` : 'Belum Dijawab'}
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-white leading-relaxed font-medium">
                    {q.content}
                  </p>

                  <div className="p-2 sm:p-2.5 rounded bg-slate-950 border border-white/15 space-y-1">
                    <div className="text-[8.5px] sm:text-[9.5px] font-bold text-sky-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Jawaban Anda:</span>
                      <span className="font-mono text-slate-400 text-[8px]">{wCount} kata</span>
                    </div>
                    <div className="text-[10.5px] sm:text-[11.5px] text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {studentAns || <em className="text-slate-500">Tidak ada jawaban yang diisi.</em>}
                    </div>
                  </div>

                  {showKeyReview && (
                    <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/35 space-y-1.5 text-[10px] sm:text-[11px]">
                      <div className="font-extrabold text-emerald-300 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3 text-amber-300" />
                        <span>Kunci Jawaban &amp; Pembahasan Konseptual Guru (Bpk. Eksa Yudika Sirait S.T):</span>
                      </div>
                      <div className="text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                        {q.kunciJawaban}
                      </div>
                      <div className="pt-1 border-t border-emerald-500/20 flex flex-wrap items-center gap-1 text-[8.5px] sm:text-[9.5px] text-emerald-200">
                        <strong className="text-amber-300">Kata Kunci Utama:</strong>
                        {q.kataKunci.map((k, kIdx) => (
                          <span
                            key={kIdx}
                            className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/30 font-mono text-[8px]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onExitHome}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-[10px] sm:text-xs font-bold transition-colors cursor-pointer"
            >
              ← Kembali ke Menu Utama
            </button>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadPdfWorksheet}
                className="px-3 py-1.5 rounded-md bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-[10px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5 text-slate-950" />
                <span>{pdfFeedback || 'SIMPAN SOAL DALAM BENTUK PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handleShareToWhatsApp}
                className="px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-[10px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5 text-slate-950" />
                <span>{waFeedback || 'KIRIM SOAL DAN JAWABAN KE WHATSAPP GURU'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrintWorksheet}
                className="px-2.5 py-1.5 rounded-md bg-sky-800 hover:bg-sky-700 text-sky-200 border border-sky-400/30 text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Printer className="w-3 h-3" />
                <span>Cetak</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 3: ANTARMUKA PENGERJAAN 15 SOAL ESAY (ACTIVE EXAM VIEW)
  // Dilengkapi Watermark Forensik Digital, Shield Anti-Screenshot,
  // Sensor Blok & Tombol HP, Serta Indikator Pelanggaran Real-Time
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none exam-lock-select exam-main-content relative overflow-x-hidden">
      {/* 1. TANDA AIR FORENSIK DIGITAL SISWA (DYNAMIC DIGITAL FORENSIC WATERMARK) */}
      <div
        className="exam-forensic-watermark pointer-events-none select-none"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-[9px] sm:text-[11px] font-mono font-black text-sky-400/10 tracking-widest flex items-center justify-around gap-6"
          >
            <span>
              UPTD SMPN 7 KISARAN · {namaSiswa || 'SISWA'} · NISN: {nisNisn || '-'}
            </span>
            <span>
              KELAS {kelas} · {deviceCategory || 'HP ANDROID'}: {deviceModel || 'DEVICE'}
            </span>
            <span>IP: {clientIp || '127.0.0.1'} · ANTI-CURANG AKTIF</span>
          </div>
        ))}
      </div>

      {/* 2. SENSOR SHIELD HITAM ANTI-SCREENSHOT (TAMPIL KETIKA TOMBOL HP / GESTURE DITEKAN) */}
      {showScreenshotShield && (
        <div className="exam-anti-screenshot-shield p-6 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-4 animate-pulse">
            <CameraOff className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-rose-500 uppercase tracking-tight mb-2">
            📸 DILARANG MELAKUKAN SCREENSHOT!
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 font-semibold max-w-md mb-3 leading-relaxed">
            Sensor keamanan anti-tangkapan layar aktif mendeteksi upaya screenshot (
            <span className="text-rose-400 underline">{screenshotShieldReason}</span>). Seluruh layar ujian esay otomatis diburamkan dan clipboard dikosongkan.
          </p>
          <div className="px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500 text-[11px] font-mono text-rose-300 font-bold">
            ⚠️ Pelanggaran Anda: {violationCount}/3 (Maksimal 3 Kali = Diskualifikasi Otomatis)
          </div>
        </div>
      )}

      {/* 3. OVERLAY NOTIFIKASI ANTI-CURANG SISTEM (PELANGGARAN 1, 2, & 3) */}
      {redWarningOverlay && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-3.5 sm:p-6 text-center select-none overflow-y-auto">
          <div
            className={`max-w-xl w-full rounded-2xl p-5 sm:p-7 shadow-2xl space-y-4 my-auto border-4 transition-all ${
              violationCount >= 3
                ? 'bg-gradient-to-b from-rose-950 via-slate-950 to-rose-950 border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.5)] animate-pulse'
                : violationCount === 2
                ? 'bg-gradient-to-b from-amber-950/90 via-slate-950 to-rose-950/80 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.35)]'
                : 'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-amber-400 shadow-2xl'
            }`}
          >
            {/* 1. Badge Informasi Perangkat Siswa (Device Detector) */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-black/60 border border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs font-mono text-left">
              <div className="flex items-center gap-1.5 text-sky-300">
                <span>
                  Perangkat: <strong className="text-white">{deviceCategory || 'HP Siswa'} — {deviceModel || 'ANBK'}</strong>
                </span>
              </div>
              <div className="text-slate-400 text-[10px] sm:text-[11px]">
                IP: {clientIp || '127.0.0.1'} · UPTD SMPN 7 Kisaran
              </div>
            </div>

            {/* 2. Ikon & Judul Peringatan Berdasarkan Level Pelanggaran (1, 2, atau 3) */}
            <div className="space-y-2">
              {violationCount >= 3 ? (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-600/30 border-2 border-rose-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
                    <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-rose-300" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-md">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    PELANGGARAN KE-3 DARI 3 KALI KESEMPATAN (3 KALI KESEMPATAN TELAH HABIS)
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-rose-200 leading-tight drop-shadow-md">
                    DALAM WAKTU 15 DETIK ANDA AKAN DITENDANG KELUAR DARI UJIAN!
                  </h2>
                  <p className="text-xs sm:text-sm text-rose-100 font-semibold leading-relaxed">
                    Batas 3 kali kesempatan telah habis! Dalam waktu 15 detik sistem akan memberhentikan seluruh soal ujian secara otomatis dan mendiskualifikasi siswa (<strong className="text-amber-300 underline">TIDAK LULUS UJIAN &amp; WAJIB UJIAN SUSULAN</strong>) serta mengirim laporan hasil ujian &amp; bukti kecurangan ke WhatsApp Guru Mapel (<strong className="font-mono text-white underline">{EXAM_INFO.teacherPhone}</strong>, Bapak Eksa Yudika Sirait S.T) via gateway Fonnte API dan membuka WhatsApp pada perangkat siswa.
                  </p>
                </>
              ) : violationCount === 2 ? (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center mx-auto shadow-lg">
                    <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 text-amber-300 animate-pulse" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold uppercase tracking-wider bg-amber-600 text-white shadow-md">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Notifikasi Pelanggaran #2 dari 3 Kali Kesempatan (Peringatan Terakhir) (sisa 1 kesempatan)
                  </span>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-wide uppercase bg-amber-950/80 border border-amber-400/40 py-1 px-3 rounded-lg inline-block">
                    ⏱️ DENGAN DURASI 15 DETIK UNTUK MASUK KEMBALI KE UJIAN
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-amber-200 leading-tight">
                    PERINGATAN KERAS: PELANGGARAN KE-2 DARI 3 KALI KESEMPATAN!
                  </h2>
                  <p className="text-xs sm:text-sm text-amber-100 leading-relaxed">
                    Anda telah melakukan pelanggaran ke-2: <strong className="text-white underline">{warningReasonText}</strong>. Siswa dapat menekan tombol hijau untuk kembali melanjutkan ujian (<strong className="text-white underline font-bold">sisa 1 kesempatan</strong>). Segera tekan tombol hijau sebelum waktu 15 detik habis! Jika 15 detik terlewati atau Anda melakukan pelanggaran ke-3, sistem otomatis memberhentikan seluruh soal ujian, mendiskualifikasi siswa, dan mengirim hasil ke WhatsApp Guru!
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mx-auto shadow-md">
                    <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Notifikasi Pelanggaran #1 dari 3 Kali Kesempatan
                  </span>
                  <div className="text-xs sm:text-sm font-extrabold text-emerald-300 tracking-wide uppercase bg-emerald-950/80 border border-emerald-400/40 py-1 px-3 rounded-lg inline-block">
                    ⏱️ DENGAN DURASI 15 DETIK UNTUK MASUK KEMBALI KE UJIAN
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                    PERINGATAN PELANGGARAN KE-1: KESEMPATAN KE-1 DIBERIKAN
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    Sistem mendeteksi aktivitas pelanggaran: <strong className="text-white underline">{warningReasonText}</strong>. Siswa dapat menekan tombol hijau untuk kembali melanjutkan ujian (<strong className="text-emerald-300 font-bold">sisa 2 kesempatan</strong>). Anda memiliki durasi 15 detik untuk masuk kembali ke ujian. Segera tekan tombol hijau di bawah sebelum hitung mundur 15 detik berakhir!
                  </p>
                </>
              )}
            </div>

            {/* 3. Detail Pelanggaran Terakhir */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-left space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-slate-300">Aktivitas Terakhir Terdeteksi:</span>
                <span className="font-mono text-[11px] text-amber-300">
                  {new Date().toLocaleTimeString('id-ID')}
                </span>
              </div>
              <div className="font-mono text-white text-[11.5px] bg-white/5 p-2 rounded-lg border border-white/5">
                ⚠️ {warningReasonText || 'Aktivitas mencurigakan terdeteksi'}
              </div>
              {violationLogs.length > 1 && (
                <div className="pt-1 border-t border-white/10">
                  <div className="text-[10px] text-slate-400 mb-1 font-bold">
                    Riwayat Pelanggaran Sebelumnya ({violationLogs.length}x):
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {violationLogs.slice(-3).map((log, idx) => (
                      <div key={idx} className="text-[10px] font-mono text-rose-300 truncate">
                        • {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Timer Hitung Mundur Digital 15 Detik & Bilah Progres untuk Setiap Pelanggaran */}
            {violationCount >= 3 ? (
              <div className="py-3 px-5 rounded-xl bg-rose-950/80 border-2 border-rose-500 shadow-inner space-y-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-rose-200 block font-bold">
                  WAKTU TERSISA SEBELUM DITENDANG KELUAR DARI UJIAN &amp; HASIL DIKIRIM KE WHATSAPP GURU:
                </span>
                <div className="text-4xl sm:text-5xl font-mono font-black text-amber-300 tabular-nums drop-shadow-md">
                  {warningCountdown} Detik
                </div>
                <div className="w-full bg-rose-900/60 rounded-full h-3 overflow-hidden border border-rose-500/40">
                  <div
                    className="bg-gradient-to-r from-amber-400 via-rose-400 to-rose-600 h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(100, (warningCountdown / 15) * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] text-rose-200 block font-medium">
                  Setelah dalam 15 detik sistem akan memberhentikan seluruh soal ujian secara otomatis dan mendiskualifikasi siswa (TIDAK LULUS UJIAN &amp; WAJIB UJIAN SUSULAN) dan akan mengirim hasil ujiannya ke WhatsApp Guru (+62 821-6588-5568).
                </span>
              </div>
            ) : (
              <div
                className={`py-3 px-4 rounded-xl border text-left text-xs space-y-2 ${
                  violationCount === 2
                    ? 'bg-amber-950/70 border-amber-400/60 text-amber-200'
                    : 'bg-emerald-950/70 border-emerald-400/50 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs">
                  <div className="flex items-center gap-2">
                    {violationCount === 2 ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                        <span className="text-amber-300">
                          STATUS: PELANGGARAN #2 (SISA 1 KESEMPATAN — PERINGATAN TERAKHIR)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-emerald-300">
                          STATUS: PELANGGARAN #1 (SISA 2 KESEMPATAN)
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-mono text-amber-300 font-extrabold text-sm tabular-nums">
                    {warningCountdown}s
                  </span>
                </div>

                {/* Bilah Progres Hitung Mundur 15 Detik Masuk Kembali */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10.5px] font-mono">
                    <span className="text-slate-300 font-semibold">
                      ⏱️ Durasi 15 Detik Untuk Masuk Kembali ke Ujian:
                    </span>
                    <span className="font-extrabold text-amber-300">
                      {warningCountdown} Detik Tersisa
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/20">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear ${
                        violationCount === 2
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, (warningCountdown / 15) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-300 pt-0.5">
                  {violationCount === 2
                    ? 'Siswa dapat menekan tombol hijau di bawah untuk kembali melanjutkan ujian (sisa 1 kesempatan). Jika waktu 15 detik habis, sistem otomatis memberhentikan seluruh soal ujian dan mendiskualifikasi siswa!'
                    : 'Siswa dapat menekan tombol hijau di bawah untuk kembali melanjutkan ujian (sisa 2 kesempatan). Jika waktu 15 detik habis, sistem otomatis menghentikan ujian.'}
                </p>
              </div>
            )}

            {/* 5. Informasi Tujuan Pengiriman WhatsApp Guru (Hanya pada Pelanggaran 3) */}
            {violationCount >= 3 && (
              <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-left flex items-start gap-2.5 text-xs">
                <Send className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-300 text-[11px]">
                    Laporan Resmi Otomatis Dikirim ke WhatsApp Guru Mapel via Gateway Fonnte API:
                  </div>
                  <div className="text-[10.5px] text-emerald-100">
                    Nomor: <strong className="font-mono text-white">{EXAM_INFO.teacherPhone}</strong> ({EXAM_INFO.guruMapelUpper})
                  </div>
                </div>
              </div>
            )}

            {/* 6. Tombol Aksi */}
            {violationCount >= 3 ? (
              <div className="w-full py-3.5 px-5 rounded-xl bg-rose-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg border border-rose-400 cursor-not-allowed">
                <Lock className="w-4 h-4" />
                <span>
                  AKSES DITUTUP ({warningCountdown}s) · UJIAN BERHENTI OTOMATIS &amp; MENGIRIM WA GURU
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRedWarningOverlay(false);
                  setShowScreenshotShield(false);
                }}
                className="w-full py-3.5 sm:py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-2xl transition-all cursor-pointer ring-4 ring-emerald-400/40 animate-pulse"
              >
                <Play className="w-5 h-5 fill-current" />
                {violationCount === 2 ? (
                  <span>KEMBALI MELANJUTKAN UJIAN (Sisa 1 Kesempatan) [{warningCountdown}s]</span>
                ) : (
                  <span>KEMBALI MELANJUTKAN UJIAN (Sisa 2 Kesempatan) [{warningCountdown}s]</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. TOAST NOTIFIKASI PELANGGARAN REAL-TIME */}
      {securityToast && (
        <div
          role="alert"
          className={`fixed top-3 left-1/2 -translate-x-1/2 z-[99999] max-w-lg w-[92%] px-3.5 py-2.5 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-extrabold animate-bounce transition-all ${
            securityToastType === 'critical'
              ? 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-900/50'
              : 'bg-amber-950/95 border-amber-400 text-amber-100 shadow-amber-900/50'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300" />
          <span className="flex-1 leading-snug">{securityToast}</span>
          <button
            type="button"
            onClick={() => setSecurityToast(null)}
            className="text-white/70 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. MODAL POP-UP PERINGATAN PELANGGARAN SISWA */}
      {showViolationModal && currentViolationDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="max-w-md w-full rounded-2xl border-2 border-amber-400/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-300">
                  NOTIFIKASI PELANGGARAN KEAMANAN #{currentViolationDetail.count} / 3
                </h3>
                <p className="text-[10px] text-slate-300">
                  Waktu: {currentViolationDetail.timestamp} · UPTD SMP Negeri 7 Kisaran
                </p>
              </div>
            </div>

            {/* Badge Info Perangkat Siswa */}
            <div className="p-2 rounded-lg bg-black/40 border border-white/10 text-[10.5px] font-mono text-slate-300 flex items-center justify-between">
              <span>Perangkat: <strong className="text-white">{deviceCategory || 'HP Siswa'} — {deviceModel || 'ANBK'}</strong></span>
              <span className="text-slate-400">IP: {clientIp || '-'}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-400/30 space-y-1.5 text-[11px] sm:text-xs">
              <div className="text-amber-200 font-extrabold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Jenis Pelanggaran Terdeteksi:</span>
              </div>
              <p className="text-white font-medium pl-4">{currentViolationDetail.reason}</p>
              <p className="text-slate-400 text-[10px] pl-4">{currentViolationDetail.description}</p>
            </div>

            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[10px] text-rose-200 space-y-0.5">
              <strong className="text-rose-300">Peringatan Keras Sistem:</strong>
              <p>
                Sisa toleransi Anda tinggal <strong>{3 - currentViolationDetail.count} kali</strong> lagi. Jika melakukan pelanggaran sebanyak 3 kali, ujian akan <strong>otomatis dihentikan seketika</strong> dan Anda dinyatakan <strong>TIDAK LULUS</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowViolationModal(false)}
              className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer shadow-md"
            >
              Saya Mengerti &amp; Lanjutkan Mengerjakan Ujian
            </button>
          </div>
        </div>
      )}

      {/* Header Utama ANBK Esay dengan Indikator Pelanggaran */}
      <header className="bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border-b border-sky-500/30 px-2.5 sm:px-5 py-2 flex items-center justify-between gap-2 shadow-md relative z-20">
        <div className="flex items-center gap-2 min-w-0">
          <TutWuriLogo size="sm" />
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1 truncate">
              <span>{EXAM_INFO.namaSekolah}</span>
              <span>·</span>
              <span className="text-amber-300">Latihan Dikelas &amp; Tugas Dirumah</span>
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{namaSiswa}</span>
              <span className="text-sky-300">·</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-mono font-extrabold shrink-0">
                Kelas {kelas} · Sem {semester}
              </span>
            </div>
          </div>
        </div>

        {/* Indikator Waktu, Pelanggaran & Aksi Header */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* BADGE INDIKATOR PELANGGARAN ANTI-CURANG */}
          <div
            className={`px-2 py-0.5 rounded border font-mono text-[9px] sm:text-[10.5px] font-extrabold flex items-center gap-1 transition-all ${
              violationCount === 0
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : violationCount === 1
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-rose-500/30 border-rose-400 text-rose-200 animate-pulse'
            }`}
            title="Indikator Pelanggaran Keamanan: Maksimal 3 kali pelanggaran"
          >
            {violationCount === 0 ? (
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-3 h-3 text-amber-400 animate-bounce" />
            )}
            <span>Pelanggaran: {violationCount}/3</span>
          </div>

          <div className="px-2 py-0.5 rounded bg-slate-900/80 border border-sky-400/30 font-mono text-[9px] sm:text-[11px] font-extrabold text-emerald-300 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-amber-300 animate-pulse" />
            <span>{formatDuration(elapsedSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowQuestionGrid(!showQuestionGrid)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 border border-white/20 text-[9px] sm:text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Layers className="w-3 h-3 text-amber-300" />
            <span className="hidden sm:inline">Daftar Nomor</span>
            <span className="font-mono">({totalAnswered}/{questions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmSubmitModal(true)}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] sm:text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Kumpulkan Tugas</span>
          </button>
        </div>
      </header>

      {/* Bar Indikator Status & Banner Anti-Curang */}
      <div className="bg-slate-900/90 border-b border-white/10 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[8px] sm:text-[9.5px] relative z-10">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-400/40 font-mono font-extrabold text-emerald-300">
            SOAL ESAY #{currentQ?.noSoal} DARI {questions.length}
          </span>
          <span className="text-slate-300 hidden sm:inline">
            Elemen: <strong className="text-sky-300">{currentQ?.elemen}</strong>
          </span>
          <span className="text-amber-300 font-semibold">
            Bobot Soal: {currentQ?.bobot}%
          </span>
        </div>

        {/* Banner Keamanan Ringkas */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1 text-[8.5px] text-amber-300/90 font-mono">
            <Lock className="w-2.5 h-2.5 text-amber-400" />
            <span>Anti-Screenshot HP &amp; Blok Soal Aktif · Maksimal 3x Pelanggaran</span>
          </span>

          {/* Progress Bar Mini */}
          <div className="flex items-center gap-2 min-w-[120px] sm:min-w-[180px]">
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-emerald-300 font-extrabold text-[8px] sm:text-[9px]">
              {progressPercent}% Terisi
            </span>
          </div>
        </div>
      </div>

      {/* Konten Area Kerja Soal Esay */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-2.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 relative z-10">
        {/* Panel Modal Grid Nomor Soal (Jika Dibuka) */}
        {showQuestionGrid && (
          <div className="p-2.5 rounded-xl border border-sky-400/35 bg-slate-900/95 shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-sky-200 flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-300" />
                Navigasi 15 Soal Esay (Klik nomor untuk pindah soal):
              </span>
              <div className="flex items-center gap-2 text-[8px] sm:text-[9px]">
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Sudah Diisi
                </span>
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Ragu-Ragu
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-600" /> Kosong
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-15 gap-1.5">
              {questions.map((q, idx) => {
                const isAns = (answers[q.noSoal] || '').trim().length > 0;
                const isDoubt = Boolean(doubtful[q.noSoal]);
                const isCur = idx === currentIndex;

                let btnClass = 'bg-slate-800 text-slate-300 border-white/10';
                if (isCur) {
                  btnClass = 'bg-sky-500 text-slate-950 font-extrabold ring-2 ring-amber-300';
                } else if (isDoubt) {
                  btnClass = 'bg-amber-400 text-slate-950 font-bold border-amber-300';
                } else if (isAns) {
                  btnClass = 'bg-emerald-500 text-slate-950 font-bold border-emerald-400';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowQuestionGrid(false);
                    }}
                    className={`h-7 sm:h-8 rounded text-[10px] sm:text-[11px] font-mono border flex items-center justify-center transition-all cursor-pointer ${btnClass}`}
                  >
                    {q.noSoal}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Kartu Pertanyaan Esay (Dilindungi Anti-Copy & Anti-Select) */}
        <div className="rounded-xl border border-sky-500/35 bg-gradient-to-br from-slate-900/90 via-slate-950 to-sky-950/80 p-3 sm:p-4 shadow-lg space-y-2.5 select-none">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[9.5px] sm:text-[11px] font-mono font-extrabold text-sky-300">
                Nomor {currentQ?.noSoal}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-amber-300">
                {currentQ?.elemen}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleDoubtful}
                className={`px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  doubtful[currentQ?.noSoal]
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 text-slate-300 border-white/15 hover:bg-slate-700'
                }`}
              >
                <HelpCircle className="w-2.5 h-2.5" />
                <span>{doubtful[currentQ?.noSoal] ? 'Ditandai Ragu-Ragu' : 'Tandai Ragu-Ragu'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRubrik(!showRubrik)}
                className="px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold border border-sky-400/30 bg-sky-950/60 hover:bg-sky-900 text-sky-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Lightbulb className="w-2.5 h-2.5 text-amber-300" />
                <span>{showRubrik ? 'Tutup Rubrik' : 'Petunjuk & Rubrik Guru'}</span>
              </button>
            </div>
          </div>

          {/* Isi Pertanyaan (Proteksi Anti-Select) */}
          <div className="text-xs sm:text-sm text-white font-medium leading-relaxed select-none pointer-events-auto">
            {currentQ?.content}
          </div>

          {/* Kotak Rubrik & Panduan Guru (Jika Dibuka) */}
          {showRubrik && (
            <div className="p-2 sm:p-2.5 rounded-lg bg-amber-950/30 border border-amber-400/40 text-[9.5px] sm:text-[10.5px] text-amber-100 space-y-1 select-none">
              <div className="font-extrabold text-amber-300 flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-amber-300 shrink-0" />
                <span>Rubrik Penilaian &amp; Kata Kunci Jawaban (Guru Mapel: Eksa Yudika Sirait S.T):</span>
              </div>
              <p className="leading-snug text-slate-200">{currentQ?.rubrik}</p>
              <div className="pt-1 flex flex-wrap items-center gap-1 text-[8px] sm:text-[9px]">
                <strong className="text-amber-300">Poin Kunci:</strong>
                {currentQ?.kataKunci.map((k, idx) => (
                  <span
                    key={idx}
                    className="px-1 py-0.2 rounded bg-amber-400/20 border border-amber-400/30 text-amber-200 font-mono"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lembar Jawaban Siswa (Textarea Interaktif) */}
        <div className="flex-1 flex flex-col rounded-xl border border-sky-400/40 bg-slate-900/90 p-3 sm:p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <label className="text-[10px] sm:text-[11.5px] font-bold text-sky-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-300" />
              <span>Lembar Jawaban Esay Siswa (Ketik uraian jawaban Anda di bawah):</span>
            </label>
            <div className="flex items-center gap-2 text-[8.5px] sm:text-[9.5px] font-mono">
              <span className="text-emerald-300 font-extrabold">
                {countWords(currentAnswer)} Kata
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300">
                {currentAnswer.length} Karakter
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-emerald-400">✓ Auto-Save</span>
            </div>
          </div>

          <textarea
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder={`Tuliskan uraian jawaban Anda untuk Soal #${currentQ?.noSoal} secara lengkap, terstruktur, dan jelas...`}
            rows={8}
            className="w-full flex-1 min-h-[160px] sm:min-h-[220px] p-2.5 sm:p-3 rounded-lg border border-white/15 bg-slate-950/90 text-white placeholder:text-slate-500 placeholder:italic text-xs sm:text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-all font-sans resize-y"
          />

          <div className="flex flex-wrap items-center justify-between gap-1 text-[8px] sm:text-[9px] text-slate-400 pt-1">
            <span>
              💡 <strong className="text-slate-300">Tips Jawaban Baik:</strong> Berikan definisi, langkah-langkah, dan contoh nyata sesuai pertanyaan.
            </span>
            <span className="text-emerald-400 font-mono">
              Tersimpan aman di perangkat (Draft Offline &amp; Online)
            </span>
          </div>
        </div>

        {/* Footer Navigasi Bawah */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className={`px-3 py-1.5 rounded-lg text-[9.5px] sm:text-[11px] font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
              currentIndex === 0
                ? 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed'
                : 'border-white/20 bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            <ChevronLeft className="w-3 h-3" />
            <span>Soal Sebelumnya</span>
          </button>

          {/* Tombol Cepat Lompat Nomor / Kumpulkan */}
          <div className="flex items-center gap-1">
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[9.5px] sm:text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <span>Soal Selanjutnya</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmSubmitModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] sm:text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Selesai &amp; Kumpulkan Semua Jawaban</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Modal Konfirmasi Pengumpulan */}
      {showConfirmSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="max-w-md w-full rounded-xl border border-sky-400/40 bg-slate-900 p-4 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm sm:text-base border-b border-white/10 pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Konfirmasi Pengumpulan 15 Soal Esay</span>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-200 leading-relaxed">
              Apakah Anda yakin ingin mengumpulkan seluruh lembar jawaban latihan/tugas esay ini?
            </p>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-white/10 space-y-1 text-[10px] sm:text-[11px]">
              <div className="flex justify-between text-slate-300">
                <span>Nama Siswa:</span>
                <strong className="text-white">{namaSiswa}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Kelas &amp; Semester:</span>
                <span className="text-amber-300 font-mono">Kelas {kelas} · Sem {semester}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Soal Terisi:</span>
                <strong className="text-emerald-400 font-mono">
                  {totalAnswered} dari {questions.length} Soal
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Kata Ditulis:</span>
                <span className="text-sky-300 font-mono">{totalWords} kata</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Status Pelanggaran:</span>
                <span
                  className={`font-mono font-bold ${
                    violationCount === 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {violationCount === 0 ? 'Bersih (0x Pelanggaran)' : `${violationCount}/3 Pelanggaran`}
                </span>
              </div>
              {questions.length - totalAnswered > 0 && (
                <div className="text-rose-300 font-bold pt-1 border-t border-white/10 text-[9.5px]">
                  ⚠️ Masih ada {questions.length - totalAnswered} soal yang belum diisi.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmSubmitModal(false)}
                className="py-1.5 px-3 rounded-lg border border-white/20 bg-slate-800 hover:bg-slate-700 text-white text-[10px] sm:text-xs font-bold transition-colors cursor-pointer"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-extrabold transition-colors cursor-pointer shadow-sm"
              >
                Ya, Kumpulkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
