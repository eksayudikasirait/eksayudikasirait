import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import {
  Question,
  StudentSubmission,
  BatteryHistoryPoint,
  CloudIntegrationConfig,
  EXAM_INFO,
  INITIAL_QUESTIONS,
  INITIAL_SUBMISSIONS,
  REKAP_SHEET_HEADERS,
  getCleanKelas,
  getSemesterFromSub,
  ExamPackageKey,
  FASE_D_PACKAGE_META,
  FASE_D_QUESTION_BANKS,
  getPackageKey,
  getJenjangFromKelas,
  fetchOnlineFaseDQuestions,
  getActiveTeacherPhotoUrl,
  getActiveHeroBannerUrl,
  getActiveHeroBannerOpacity,
  setActiveHeroBannerOpacity,
  syncPermanentPhotosWithServer,
  fetchTokenFromGoogleSheet,
  pushTokenToGoogleSheet,
  isValidGoogleSheetOrScriptUrl,
  getInitialCloudConfig,
  getInitialSyncedTokenState,
  saveCloudTokenConfigToServer,
  getInitialSyncedSubmissionsState,
  fetchStudentDashboardSyncState,
  pushSubmissionToServer,
  saveAllSubmissionsToServer,
  resetAllSubmissionsOnServer,
  deleteSubmissionsByFilterOnServer,
  restoreDefaultSubmissionsOnServer,
  restoreSubmissionsWithFilterOnServer,
  ResetSubmissionsFilter,
  RestoreSubmissionsFilter,
  isSubmissionMatchingResetFilter,
  updateQuestionBanksOnServer,
  subscribeToFirestoreDashboardState,
  subscribeToFirestoreCloudConfig,
  subscribeToOnlineTokenEvents,
  pushTokenEventLocallyAndBroadcast,
  syncSubmissionsToGoogleSheetsAuto,
  getSubmissionUniqueKey,
  deduplicateSubmissions,
  sanitizeRekapSheetUrl,
  sanitizeTokenValue,
  UsedExamTokenRecord,
  ExhaustedStudentTokenEntry,
  getUsedExamTokens,
  recordUsedExamToken,
  clearUsedExamTokens,
  resetStudentTokenQuotaByStudent,
  checkStudentTokenUsage,
  getStudentsWithExhaustedTokenQuota,
  readFirestoreCloudConfig,
  writeFirestoreCloudConfig,
  readFirestoreDashboardState,
  writeFirestoreDashboardState,
  computeSubmissionRankingMap,
  formatSubmissionToRekap13ColumnsWithRank,
  firestoreRestWriteDoc,
  generateNonRepeatingRetakeQuestionsForStudent,
  getStudentSeenQuestionsHistory,
  clearAllStudentSeenQuestionsHistory,
  dispatchTeacherTokenExhaustedNotification,
  sendExamResultViaFonnteApi,
  autoRecoverAndSyncAllUnsavedSubmissions,
  UNSAVED_SUBMISSIONS_SYNC_EVENT,
  ExamSessionInfo,
  getCurrentExamSession,
  createNewExamSession,
  generateFocusedRemedialPackageForStudent,
} from './data/examData';
import { TutWuriLogo } from './components/TutWuriLogo';
import { TeacherDashboard } from './components/TeacherDashboard';
import { ExamResultView } from './components/ExamResultView';
import { RemedialStartPayload } from './components/RemedialOptionSection';
import { StudentDashboard } from './components/StudentDashboard';
import { ClassroomDesignView } from './components/ClassroomDesignView';
import { RaporSiswa } from './components/RaporSiswa';
import { ExamMonitoringView } from './components/ExamMonitoringView';
import {
  syncStudentToClassroomSeat,
  findFirstEmptySeatForClass,
  loadStoredClassroomStudents,
  getStoredActiveSync,
  STORAGE_KEY_STUDENTS,
  CLASSROOM_SYNC_EVENT,
  ClassroomSeatStudent,
} from './utils/classroomSync';
import {
  QrCodeScannerModal,
  ScannedExamQrResult,
} from './components/QrCodeScannerModal';
import { HeroBannerModal } from './components/HeroBannerModal';
import { FullscreenAntiSplitScreenCard } from './components/FullscreenAntiSplitScreenCard';
import {
  evaluatePrecisionSplitScreen,
  getPreciseScreenOrientation,
  isMobileOrTabletDevice,
} from './utils/antiSplitScreenDetector';
import { EssayExamView } from './components/EssayExamView';
import { TeacherLoginModal } from './components/TeacherLoginModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { StudentBiometricAttendanceView } from './components/StudentBiometricAttendanceView';
import {
  EssayQuestion,
  fetchOnlineFaseDEssayQuestions,
  getEssayQuestionsForStudent,
  generateNonRepeatingEssayQuestionsForStudent,
} from './data/essayQuestionsData';
import {
  StudentCameraProfileModal,
  loadStoredStudentProfile,
  saveStoredStudentProfile,
  getPhotoForStudentIdentity,
  getStudentInitials,
  compressImageToDataUrl,
} from './components/StudentCameraProfileModal';
import {
  generateResultImageBlobs,
  generateResultPdfBlob,
  blobToBase64,
  buildHtmlEmailBody,
  triggerFileDownload,
} from './utils/resultMediaGenerator';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  getAccessTokenSync,
  saveStoredAccessToken,
  ensureSpreadsheetOAuthToken,
  invalidateAccessToken,
  logoutGoogle,
  sendEmailWithJpgAndPdfViaGmailApi,
  GmailSendAttachmentsPayload,
} from './services/gmailAuthService';
import {
  SyncDataDateModal,
  SyncDateFilter,
  isSubmissionMatchingSyncFilter,
} from './components/SyncDataDateModal';
import {
  buildOfficialWhatsAppReport,
  getTeacherWhatsAppUrl,
  openWhatsAppSafely,
  copyToClipboardSafely,
  shareResultFilesOrOpenWhatsApp,
} from './utils/whatsappHelper';
import {
  Sun,
  Moon,
  Lock,
  Play,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertOctagon,
  Clock,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  UserCheck,
  Maximize2,
  X,
  Eye,
  EyeOff,
  BookOpen,
  Award,
  FileText,
  MonitorCheck,
  FileSpreadsheet,
  KeyRound,
  GraduationCap,
  Layers,
  CheckCircle2,
  Globe,
  AlertTriangle,
  Volume2,
  VolumeX,
  History,
  ExternalLink,
  Calendar,
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryWarning,
  BatteryFull,
  BatteryMedium,
  Zap,
  Camera,
  CameraOff,
  Upload,
  Smartphone,
  Laptop,
  Cpu,
  Send,
  QrCode,
  Wifi,
  WifiOff,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Users,
  Fingerprint,
} from 'lucide-react';
import {
  useSubmissionSyncQueue,
  enqueueSubmissionSync,
  forceProcessQueueNow,
} from './utils/submissionSyncQueue';
import {
  detectStudentDeviceSync,
  detectStudentDeviceAsync,
  StudentDeviceInfo,
} from './utils/deviceDetector';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(
    type: 'chargingchange' | 'levelchange' | 'chargingtimechange' | 'dischargingtimechange',
    listener: () => void
  ): void;
  removeEventListener(
    type: 'chargingchange' | 'levelchange' | 'chargingtimechange' | 'dischargingtimechange',
    listener: () => void
  ): void;
}

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};

type AppView =
  | 'HOME'
  | 'INSTRUCTIONS'
  | 'EXAM'
  | 'RESULT'
  | 'TEACHER'
  | 'STUDENT_DASHBOARD'
  | 'DESIGN_CLASSROOM'
  | 'RAPOR_SISWA'
  | 'EXAM_MONITORING'
  | 'ABSENSI_SISWA';
type HomeMenuSection =
  | 'PORTAL_UJIAN'
  | 'MONITORING_UJIAN'
  | 'KISI_MATERI'
  | 'ATURAN_ANTI_CURANG'
  | 'ABSENSI_SISWA';

const ProfessionalHeroClock: React.FC = React.memo(() => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const formattedDateMobile = new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return (
    <div className="w-full px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md bg-slate-950/80 border border-sky-400/40 shadow-sm flex items-center justify-between gap-1 text-[8.5px] sm:text-[10px] transform-gpu">
      {/* Kiri: Jam Digital Real-Time */}
      <div className="flex items-center gap-1 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] shrink-0" />
        <Clock className="w-2.5 h-2.5 text-sky-300 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
        <div className="flex items-center gap-0.5 font-mono text-[8.5px] sm:text-[10px] font-extrabold tracking-wider tabular-nums leading-none">
          <span className="px-1 py-0.2 rounded bg-white/10 border border-white/25 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {hours}
          </span>
          <span className="text-sky-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">:</span>
          <span className="px-1 py-0.2 rounded bg-white/10 border border-white/25 text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {minutes}
          </span>
          <span className="text-sky-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">:</span>
          <span className="px-1 py-0.2 rounded bg-white/10 border border-sky-400/40 text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {seconds}
          </span>
          <span className="ml-0.5 px-1 py-0.2 rounded bg-sky-500/20 border border-sky-400/40 text-[7px] sm:text-[7.5px] font-mono font-extrabold text-sky-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            WIB
          </span>
        </div>
      </div>

      {/* Kanan: Hari & Tanggal */}
      <div className="flex items-center gap-1 text-[7.5px] sm:text-[9px] font-bold text-white shrink-0 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
        <Calendar className="w-2.5 h-2.5 text-amber-300 shrink-0" />
        <span className="tracking-wide whitespace-nowrap sm:hidden">{formattedDateMobile}</span>
        <span className="tracking-wide whitespace-nowrap hidden sm:inline">{formattedDate}</span>
      </div>
    </div>
  );
});

// Komponen Terisolasi untuk Indikator Status & Countdown Token: Mencegah Root App & Main Berkedip/Re-render Setiap Detik
const TokenStatusCountdownBar: React.FC<{
  isSheetTokenSynced: boolean;
  onTimeoutSync: () => void;
  resetKey?: number;
}> = React.memo(({ isSheetTokenSynced, onTimeoutSync, resetKey }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(EXAM_INFO.durasiDetik);

  useEffect(() => {
    setSecondsLeft(EXAM_INFO.durasiDetik);
  }, [resetKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTimeoutSync();
          return EXAM_INFO.durasiDetik;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onTimeoutSync]);

  const progressPercent = Math.max(
    0,
    Math.min(100, (secondsLeft / EXAM_INFO.durasiDetik) * 100)
  );

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-0.5 transform-gpu">
      <div className="flex items-center justify-between text-[6.5px] sm:text-[7px] font-mono">
        <span className="text-slate-300 truncate">
          {isSheetTokenSynced
            ? 'Status Token (Tersinkron Aktif):'
            : 'Menunggu Server Token:'}
        </span>
        <span className="font-bold text-amber-300 whitespace-nowrap shrink-0">
          {isSheetTokenSynced ? formatTimer(secondsLeft) : '--:--'}
        </span>
      </div>
      <div className="w-full h-0.5 sm:h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 transition-all duration-300 transform-gpu"
          style={{ width: `${isSheetTokenSynced ? progressPercent : 0}%` }}
        />
      </div>
    </div>
  );
});

function generateRandomToken(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  let result = '';
  result += letters.charAt(Math.floor(Math.random() * letters.length));
  result += digits.charAt(Math.floor(Math.random() * digits.length));
  for (let i = 0; i < 4; i++) {
    result += all.charAt(Math.floor(Math.random() * all.length));
  }
  return result
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

function shuffleArray<T>(arr: T[], customPrng?: () => number): T[] {
  const copy = [...arr];
  const randFn = customPrng || Math.random;
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randFn() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomizeQuestionsAndOptions(
  sourceQuestions: Question[],
  previousQuestions?: Question[],
  previousOrderIds?: number[],
  customSeedString?: string
): Question[] {
  const letters: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  let seedState = 2166136261 >>> 0;
  const effectiveSeed = `${customSeedString || ''}|${Date.now()}|${Math.random()}`;
  for (let i = 0; i < effectiveSeed.length; i++) {
    seedState ^= effectiveSeed.charCodeAt(i);
    seedState = Math.imul(seedState, 16777619);
  }
  const seededRand = () => {
    seedState = (seedState + 0x6d2b79f5) >>> 0;
    let t = seedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const prevOrderKey =
    previousOrderIds && previousOrderIds.length > 0
      ? previousOrderIds.join(',')
      : previousQuestions && previousQuestions.length > 0
      ? previousQuestions.map((q) => q.id).join(',')
      : '';

  let shuffledList = shuffleArray(sourceQuestions, seededRand);
  if (sourceQuestions.length > 1 && prevOrderKey) {
    for (let attempt = 0; attempt < 12; attempt++) {
      if (shuffledList.map((q) => q.id).join(',') !== prevOrderKey) {
        break;
      }
      shuffledList = shuffleArray(sourceQuestions, seededRand);
    }
  }

  return shuffledList.map((q, newIdx) => {
    const origCorrectIdx = letters.indexOf(q.answer);
    const optionPairs = q.options.map((optText, idx) => ({
      text: optText,
      isCorrect: idx === (origCorrectIdx >= 0 ? origCorrectIdx : 0),
    }));

    const prevQuestion = previousQuestions?.find(
      (pq) => pq.id === q.id || pq.content === q.content
    );
    const prevOptionsKey = prevQuestion ? prevQuestion.options.join('||') : q.options.join('||');
    const prevAnswerLetter = prevQuestion ? prevQuestion.answer : q.answer;

    let shuffledPairs = shuffleArray(optionPairs, seededRand);
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidateOptionsKey = shuffledPairs.map((p) => p.text).join('||');
      const candidateCorrectIdx = shuffledPairs.findIndex((p) => p.isCorrect);
      const candidateAnswer = letters[candidateCorrectIdx >= 0 ? candidateCorrectIdx : 0];
      if (candidateOptionsKey !== prevOptionsKey && candidateAnswer !== prevAnswerLetter) {
        break;
      }
      shuffledPairs = shuffleArray(optionPairs, seededRand);
    }

    const newCorrectIdx = shuffledPairs.findIndex((p) => p.isCorrect);
    const newOptions: [string, string, string, string] = [
      shuffledPairs[0].text,
      shuffledPairs[1].text,
      shuffledPairs[2].text,
      shuffledPairs[3].text,
    ];

    return {
      ...q,
      id: newIdx + 1,
      options: newOptions,
      answer: letters[newCorrectIdx >= 0 ? newCorrectIdx : 0],
    };
  });
}

export default function App() {
  // Tema Dark / Light Mode (Default: Royal Navy-Blue seperti Hero Home)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('anbk_theme_dark');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('anbk_theme_dark', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Pengaturan Cetak Ringkasan Ujian: Izinkan Cetak dengan Warna Tema Dark Mode (Default: false = Kertas Putih)
  const [printDarkMode, setPrintDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('anbk_print_dark_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('anbk_print_dark_mode', String(printDarkMode));
    if (printDarkMode) {
      document.documentElement.classList.add('print-dark-theme');
    } else {
      document.documentElement.classList.remove('print-dark-theme');
    }
  }, [printDarkMode]);

  // Status Baterai Perangkat Siswa Real-Time (Web Battery Status API) & Riwayat Penggunaan Baterai Sesi Ujian
  const [batteryState, setBatteryState] = useState<{
    level: number;
    charging: boolean;
    supported: boolean;
  }>({
    level: 100,
    charging: false,
    supported: false,
  });
  const batteryStateRef = useRef(batteryState);
  batteryStateRef.current = batteryState;
  const [lowBatteryBannerDismissed, setLowBatteryBannerDismissed] = useState<boolean>(false);

  const [batteryHistory, setBatteryHistory] = useState<BatteryHistoryPoint[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('anbk_battery_session_history_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    const nowTs = Date.now();
    const fmt = (ms: number) =>
      new Date(ms).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    return [
      {
        timestamp: fmt(nowTs - 180000),
        elapsedLabel: '00:00 (Awal Sesi)',
        elapsedSeconds: 0,
        level: 100,
        charging: false,
        questionNumber: 1,
        eventNote: 'Inisialisasi Portal Ujian ANBK',
      },
      {
        timestamp: fmt(nowTs - 120000),
        elapsedLabel: '01:00 (Soal #2)',
        elapsedSeconds: 60,
        level: 99,
        charging: false,
        questionNumber: 2,
        eventNote: 'Pengerjaan Soal Aktif',
      },
      {
        timestamp: fmt(nowTs - 60000),
        elapsedLabel: '02:00 (Soal #4)',
        elapsedSeconds: 120,
        level: 98,
        charging: false,
        questionNumber: 4,
        eventNote: 'Auto-Save Jawaban Real-Time',
      },
      {
        timestamp: fmt(nowTs),
        elapsedLabel: 'Live Saat Ini',
        elapsedSeconds: 180,
        level: 97,
        charging: false,
        questionNumber: 5,
        eventNote: 'Pemantauan Daya Perangkat Aktif',
      },
    ];
  });
  const batteryHistoryRef = useRef<BatteryHistoryPoint[]>(batteryHistory);
  batteryHistoryRef.current = batteryHistory;

  const appendBatteryHistoryPoint = useCallback(
    (
      levelVal: number,
      chargingVal: boolean,
      customLabel?: string,
      customElapsedSec?: number,
      questionNum?: number,
      note?: string
    ) => {
      const nowTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setBatteryHistory((prev) => {
        const last = prev[prev.length - 1];
        const nextElapsed =
          customElapsedSec !== undefined
            ? customElapsedSec
            : last
            ? last.elapsedSeconds + 30
            : 0;
        const mins = Math.floor(nextElapsed / 60)
          .toString()
          .padStart(2, '0');
        const secs = Math.floor(nextElapsed % 60)
          .toString()
          .padStart(2, '0');
        const point: BatteryHistoryPoint = {
          timestamp: nowTime,
          elapsedLabel:
            customLabel ||
            (questionNum ? `${mins}:${secs} (Soal #${questionNum})` : `${mins}:${secs}`),
          elapsedSeconds: nextElapsed,
          level: Math.max(0, Math.min(100, Math.round(levelVal))),
          charging: Boolean(chargingVal),
          questionNumber: questionNum,
          eventNote:
            note ||
            (chargingVal
              ? 'Perangkat Sedang Mengisi Daya (Charger Aktif)'
              : 'Pemantauan Daya Sesi Ujian'),
        };
        const updated = [...prev.slice(-29), point];
        batteryHistoryRef.current = updated;
        try {
          localStorage.setItem('anbk_battery_session_history_v1', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    []
  );

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') return;

    let batteryObj: BatteryManager | null = null;
    let isMounted = true;

    const updateBatteryInfo = () => {
      if (!batteryObj || !isMounted) return;
      const pct = Math.max(0, Math.min(100, Math.round(batteryObj.level * 100)));
      const isChg = Boolean(batteryObj.charging);
      setBatteryState({
        level: pct,
        charging: isChg,
        supported: true,
      });
      if (isChg || pct > 20) {
        setLowBatteryBannerDismissed(false);
      }
      setBatteryHistory((prev) => {
        const nowStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        if (prev.length === 0) {
          const initialPt: BatteryHistoryPoint = {
            timestamp: nowStr,
            elapsedLabel: '00:00 (Awal Sesi)',
            elapsedSeconds: 0,
            level: pct,
            charging: isChg,
            questionNumber: 1,
            eventNote: 'Pembacaan Sensor Baterai Perangkat',
          };
          batteryHistoryRef.current = [initialPt];
          return [initialPt];
        }
        const last = prev[prev.length - 1];
        if (last.level !== pct || last.charging !== isChg) {
          const nextElapsed = last.elapsedSeconds + 15;
          const mins = Math.floor(nextElapsed / 60)
            .toString()
            .padStart(2, '0');
          const secs = Math.floor(nextElapsed % 60)
            .toString()
            .padStart(2, '0');
          const nextPt: BatteryHistoryPoint = {
            timestamp: nowStr,
            elapsedLabel: `${mins}:${secs}`,
            elapsedSeconds: nextElapsed,
            level: pct,
            charging: isChg,
            eventNote: isChg
              ? 'Pengisian Daya (Charger Terhubung)'
              : pct <= 20
              ? 'Peringatan Baterai Lemah (≤ 20%)'
              : 'Perubahan Level Baterai Live',
          };
          const updated = [...prev.slice(-29), nextPt];
          batteryHistoryRef.current = updated;
          try {
            localStorage.setItem('anbk_battery_session_history_v1', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        }
        return prev;
      });
    };

    nav
      .getBattery()
      .then((bat) => {
        if (!isMounted) return;
        batteryObj = bat;
        updateBatteryInfo();
        bat.addEventListener('levelchange', updateBatteryInfo);
        bat.addEventListener('chargingchange', updateBatteryInfo);
      })
      .catch(() => {
        // Fallback jika akses informasi baterai dibatasi browser
      });

    return () => {
      isMounted = false;
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', updateBatteryInfo);
        batteryObj.removeEventListener('chargingchange', updateBatteryInfo);
      }
    };
  }, []);

  // View State & Sub-Menu Home (Mendukung Direct Link #siswa-dashboard di HP/Tablet/Komputer)
  const [view, setView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (
        hash.includes('siswa-dashboard') ||
        hash.includes('student-dashboard') ||
        params.get('view') === 'siswa-dashboard'
      ) {
        return 'STUDENT_DASHBOARD';
      }
    }
    return 'HOME';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (view === 'STUDENT_DASHBOARD') {
      if (window.location.hash !== '#siswa-dashboard') {
        window.history.replaceState(null, '', '#siswa-dashboard');
      }
    } else if (view === 'HOME' && window.location.hash === '#siswa-dashboard') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [view]);

  useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash.toLowerCase();
      if (h.includes('siswa-dashboard') || h.includes('student-dashboard')) {
        setView((prev) => (prev === 'EXAM' ? prev : 'STUDENT_DASHBOARD'));
      } else if (h === '#beranda') {
        setView((prev) => (prev === 'EXAM' ? prev : 'HOME'));
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [homeSection, setHomeSection] = useState<HomeMenuSection>('PORTAL_UJIAN');
  const [raporSelectedSubId, setRaporSelectedSubId] = useState<string | undefined>(undefined);
  const [heroBannerUrl, setHeroBannerUrl] = useState<string>(() => getActiveHeroBannerUrl());
  const [heroBannerOpacity, setHeroBannerOpacity] = useState<number>(() => getActiveHeroBannerOpacity());
  const [showHeroBannerModal, setShowHeroBannerModal] = useState<boolean>(false);
  const [heroImgError, setHeroImgError] = useState<boolean>(false);
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState<string>(() => getActiveTeacherPhotoUrl());
  const [teacherPhotoError, setTeacherPhotoError] = useState<boolean>(false);

  useEffect(() => {
    const handlePhotoSyncUpdate = () => {
      const nextTeacherPhoto = getActiveTeacherPhotoUrl();
      if (nextTeacherPhoto) {
        setTeacherPhotoUrl(nextTeacherPhoto);
        setTeacherPhotoError(false);
      }
      setHeroBannerUrl(getActiveHeroBannerUrl());
      setHeroBannerOpacity(getActiveHeroBannerOpacity());
      setHeroImgError(false);
    };

    syncPermanentPhotosWithServer();
    const intervalId = window.setInterval(() => {
      syncPermanentPhotosWithServer();
    }, 5000);

    window.addEventListener('anbk-photo-updated', handlePhotoSyncUpdate);
    window.addEventListener('storage', handlePhotoSyncUpdate);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('anbk-photo-updated', handlePhotoSyncUpdate);
      window.removeEventListener('storage', handlePhotoSyncUpdate);
    };
  }, []);

  // Form Login & Profil Siswa (Kolom Nama Lengkap Siswa, NIS/NISN, Kelas & Semester selalu dikosongkan sebelum diketik/dipilih siswa)
  const [namaSiswa, setNamaSiswa] = useState<string>('');
  const [hasStudentTypedName, setHasStudentTypedName] = useState<boolean>(false);
  const [namaSiswaError, setNamaSiswaError] = useState<string | null>(null);
  const namaSiswaErrorTimerRef = useRef<number | null>(null);
  const triggerNamaSiswaError = useCallback((msg: string) => {
    setNamaSiswaError(msg);
    if (namaSiswaErrorTimerRef.current) {
      window.clearTimeout(namaSiswaErrorTimerRef.current);
    }
    namaSiswaErrorTimerRef.current = window.setTimeout(() => {
      setNamaSiswaError(null);
    }, 4500);
  }, []);
  const [kelasSiswa, setKelasSiswa] = useState<string>('');
  const [semesterSiswa, setSemesterSiswa] = useState<'Ganjil' | 'Genap' | ''>('');
  const [headerJenjangFilter, setHeaderJenjangFilter] = useState<'ALL' | 'VII' | 'VIII'>('ALL');
  // Kolom NIS/NISN selalu dikosongkan sebelum diketik atau diinput siswa (hanya placeholder contoh yang nampak)
  const [nisNisn, setNisNisn] = useState<string>('');

  // Fitur Baru: Pilihan Format Soal Dropdown (Pilihan Berganda 25 Soal vs Esay Test 15 Soal)
  // 1. SOAL PILIHAN BERGANDA 25 SOAL (SOAL UJIAN ) : SUDAH OTOMATIS DARI SISTEM PERTAMA APLIKASI INI DIBUAT ATAU DIRANCANG
  // 2. SOAL ESAY TEST 15 SOAL ( LATIHAN DIKELAS/ TUGAS DIRUMAH) : SOAL DIAMBIL DARI ONLINE DENGAN JENJANG KELAS & SEMESTER
  const [jenisSoalUjian, setJenisSoalUjian] = useState<'PILIHAN_BERGANDA' | 'ESAY_TEST'>('PILIHAN_BERGANDA');
  const [essayQuestions, setEssayQuestions] = useState<EssayQuestion[]>([]);
  const [isSyncingEssayQuestions, setIsSyncingEssayQuestions] = useState<boolean>(false);
  const [essayQuestionSourceText, setEssayQuestionSourceText] = useState<string>('');

  useEffect(() => {
    setNamaSiswa('');
    setHasStudentTypedName(false);
    setNisNisn('');
    setKelasSiswa('');
    setSemesterSiswa('');
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('anbk_student_name_v1');
        const raw = localStorage.getItem('anbk_student_profile_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            parsed.namaSiswa = '';
            parsed.nisNisn = '';
            parsed.kelasSiswa = '';
            parsed.semesterSiswa = '';
            localStorage.setItem('anbk_student_profile_v1', JSON.stringify(parsed));
          }
        }
      } catch {}
    }
  }, []);
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string>(
    () => loadStoredStudentProfile().photoDataUrl
  );
  const [showStudentCameraModal, setShowStudentCameraModal] = useState<boolean>(false);
  const showStudentCameraModalRef = useRef<boolean>(false);
  showStudentCameraModalRef.current = showStudentCameraModal;
  const studentQuickFileInputRef = useRef<HTMLInputElement | null>(null);
  const [usedTokensList, setUsedTokensList] = useState<UsedExamTokenRecord[]>(() =>
    getUsedExamTokens()
  );
  const [activeExamToken, setActiveExamToken] = useState<string>('');
  const activeExamTokenRef = useRef<string>('');
  const activeSessionToken = activeExamToken;
  const [showRetakeTokenModal, setShowRetakeTokenModal] = useState<boolean>(false);
  const [retakeNewTokenInput, setRetakeNewTokenInput] = useState<string>('');
  const [retakeTokenError, setRetakeTokenError] = useState<string | null>(null);
  const [showQrScannerModal, setShowQrScannerModal] = useState<boolean>(false);
  const [isQrCameraActive, setIsQrCameraActive] = useState<boolean>(false);
  const [qrScanSuccessBanner, setQrScanSuccessBanner] = useState<string | null>(null);
  const [showRequestNewTokenModal, setShowRequestNewTokenModal] = useState<boolean>(false);
  const [showExhaustedStudentsModal, setShowExhaustedStudentsModal] = useState<boolean>(false);
  const [exhaustedStudentSearchQuery, setExhaustedStudentSearchQuery] = useState<string>('');
  const [exhaustedStudentClassFilter, setExhaustedStudentClassFilter] = useState<string>('ALL');
  const [issuedTeacherNewToken, setIssuedTeacherNewToken] = useState<string>('');
  const [customTeacherIssuedInput, setCustomTeacherIssuedInput] = useState<string>('');
  const [showQuickTeacherInRetakeModal, setShowQuickTeacherInRetakeModal] =
    useState<boolean>(false);
  const [quickTeacherRetakePass, setQuickTeacherRetakePass] = useState<string>('');
  const [quickTeacherRetakeUnlocked, setQuickTeacherRetakeUnlocked] = useState<boolean>(false);
  const [quickTeacherRetakeNewTok, setQuickTeacherRetakeNewTok] = useState<string>('');
  const [quickTeacherRetakePassErr, setQuickTeacherRetakePassErr] = useState<string | null>(null);

  // Kolom Kode Token Ujian diisi secara MANUAL oleh siswa (tidak terisi otomatis)
  const [inputToken, setInputToken] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [exhaustedTokenToast, setExhaustedTokenToast] = useState<{
    token: string;
    usageCount: number;
    lastUsedAt?: string;
  } | null>(null);
  const exhaustedToastTimerRef = useRef<number | null>(null);

  const triggerExhaustedTokenToast = useCallback(
    (tokenStr: string, usageCount: number = 3, lastUsedAt?: string) => {
      if (exhaustedToastTimerRef.current) {
        window.clearTimeout(exhaustedToastTimerRef.current);
      }
      setExhaustedTokenToast({
        token: tokenStr,
        usageCount,
        lastUsedAt,
      });
      exhaustedToastTimerRef.current = window.setTimeout(() => {
        setExhaustedTokenToast(null);
      }, 10000);
    },
    []
  );

  useEffect(() => {
    const syncUsedTokens = () => {
      setUsedTokensList(getUsedExamTokens());
    };
    window.addEventListener('anbk-used-tokens-updated', syncUsedTokens);
    window.addEventListener('storage', syncUsedTokens);
    return () => {
      window.removeEventListener('anbk-used-tokens-updated', syncUsedTokens);
      window.removeEventListener('storage', syncUsedTokens);
    };
  }, []);

  // Sistem Pengenalan Perangkat (Device, Merek & Tipe) Otomatis saat Siswa Membuka & Login
  const [detectedDevice, setDetectedDevice] = useState<StudentDeviceInfo>(() =>
    detectStudentDeviceSync()
  );
  const [customDeviceModel, setCustomDeviceModel] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const savedCustom = localStorage.getItem('anbk_custom_device_model_v1') || '';
    if (/OPPO\s+A60\s*\(CPH2637\)/i.test(savedCustom)) {
      localStorage.removeItem('anbk_custom_device_model_v1');
      return '';
    }
    return savedCustom;
  });
  const [isDetectingDevice, setIsDetectingDevice] = useState<boolean>(false);
  const [isDeviceRedetectAnimated, setIsDeviceRedetectAnimated] = useState<boolean>(false);
  const [deviceRedetectToast, setDeviceRedetectToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    detectStudentDeviceAsync(false)
      .then((info) => {
        if (active) {
          setDetectedDevice(info);
        }
      })
      .catch(() => {});

    const handleDeviceEvent = (e: Event) => {
      const customEv = e as CustomEvent<StudentDeviceInfo>;
      if (active && customEv.detail) {
        setDetectedDevice(customEv.detail);
      }
    };
    window.addEventListener('anbk-device-updated', handleDeviceEvent);
    return () => {
      active = false;
      window.removeEventListener('anbk-device-updated', handleDeviceEvent);
    };
  }, []);

  const handleRefreshDeviceDetection = async () => {
    if (isDetectingDevice) return;
    setIsDetectingDevice(true);
    setDeviceRedetectToast(null);
    setCustomDeviceModel('');
    try {
      localStorage.removeItem('anbk_custom_device_model_v1');
    } catch {
      // ignore
    }
    try {
      const [info] = await Promise.all([
        detectStudentDeviceAsync(true),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
      setDetectedDevice(info);
      setIsDeviceRedetectAnimated(true);
      setTimeout(() => setIsDeviceRedetectAnimated(false), 6500);
      setDeviceRedetectToast(
        `✓ Deteksi Ulang Akurat (${info.detectedAt}): ${info.deviceCategory} — ${info.modelType} · ${info.osNameVersion} · ${info.gpuRenderer}`
      );
      setTimeout(() => setDeviceRedetectToast(null), 6000);
      setTimeout(() => {
        handleSyncLoginFeaturesToGoogleSheets(false);
      }, 150);
    } catch {
      const fallback = detectStudentDeviceSync(true);
      setDetectedDevice(fallback);
    } finally {
      setIsDetectingDevice(false);
    }
  };

  const effectiveDeviceModel = customDeviceModel.trim() || detectedDevice.modelType;
  const effectiveClientIp = detectedDevice.clientIp || '103.148.201.77';
  const effectiveDeviceFingerprint = detectedDevice.deviceFingerprint || 'DEV-A83F';
  const effectiveDeviceSummary = `${detectedDevice.deviceCategory} — ${effectiveDeviceModel} (${detectedDevice.osNameVersion} · ${detectedDevice.browserName} · ${effectiveDeviceFingerprint} · IP: ${effectiveClientIp})`;

  // Sinkronkan perubahan nama, NIS/NISN, kelas, semester & foto siswa ke localStorage
  useEffect(() => {
    if (namaSiswa.trim() || nisNisn.trim() || studentPhotoUrl) {
      saveStoredStudentProfile({
        namaSiswa,
        nisNisn,
        kelasSiswa,
        semesterSiswa,
        photoDataUrl: studentPhotoUrl,
      });
    }
  }, [namaSiswa, nisNisn, kelasSiswa, semesterSiswa, studentPhotoUrl]);

  // Dengarkan pembaruan foto kamera siswa dari komponen lain (mis. StudentDashboard)
  useEffect(() => {
    const handleProfileUpdated = () => {
      const latest = loadStoredStudentProfile();
      if (latest.photoDataUrl !== studentPhotoUrl) {
        setStudentPhotoUrl(latest.photoDataUrl);
      }
      // Kolom Nama Lengkap Siswa dan NIS/NISN tidak ditimpa otomatis agar selalu kosong bagi siswa sebelum diketik
    };
    window.addEventListener('anbk-student-profile-updated', handleProfileUpdated);
    window.addEventListener('storage', handleProfileUpdated);
    return () => {
      window.removeEventListener('anbk-student-profile-updated', handleProfileUpdated);
      window.removeEventListener('storage', handleProfileUpdated);
    };
  }, [namaSiswa, nisNisn, studentPhotoUrl]);

  // ============================================================================
  // SINKRONISASI OTOMATIS DATA SISWA KE MENU DESIGN CLASSROOM (BANGKU KOSONG TANPA TERTINDIH)
  // ============================================================================
  const [classroomSyncStatus, setClassroomSyncStatus] = useState<{
    seatNumber: number;
    kelas: string;
    semester: 'Ganjil' | 'Genap';
    namaSiswa: string;
    isNew: boolean;
    syncedAt: string;
  } | null>(() => {
    const stored = getStoredActiveSync();
    if (stored && stored.namaSiswa) {
      return {
        seatNumber: stored.seatNumber,
        kelas: stored.kelas,
        semester: stored.semester,
        namaSiswa: stored.namaSiswa,
        isNew: stored.isNew,
        syncedAt: stored.syncedAt,
      };
    }
    return null;
  });
  const [isClassroomSyncing, setIsClassroomSyncing] = useState<boolean>(false);
  const [classroomSyncToast, setClassroomSyncToast] = useState<string | null>(null);

  const handleQuickStudentPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      if (!resultStr) return;
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageToDataUrl(
          img,
          img.naturalWidth || img.width || 320,
          img.naturalHeight || img.height || 320,
          false,
          320
        );
        if (compressed) {
          setStudentPhotoUrl(compressed);
          saveStoredStudentProfile({
            namaSiswa: namaSiswa.trim(),
            nisNisn,
            kelasSiswa,
            semesterSiswa,
            photoDataUrl: compressed,
          });
          setTimeout(() => {
            handleSyncToClassroomDesign(false);
            handleSyncLoginFeaturesToGoogleSheets(
              true,
              {
                namaSiswa: namaSiswa.trim() || undefined,
                nisNisn: nisNisn.trim() || undefined,
                kelasSiswa,
                semesterSiswa: semesterSiswa || undefined,
                photoUrl: compressed,
              },
              'photo'
            );
          }, 100);
        }
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // State Sinkronisasi Otomatis Fitur Login (Identitas, Device & FOTO) ke Link Google Sheets (12 Kolom)
  const [isSyncingLoginSheet, setIsSyncingLoginSheet] = useState<boolean>(false);
  const [syncTriggerSource, setSyncTriggerSource] = useState<
    'rekap' | 'device' | 'photo' | 'routine_5min' | 'login_masuk' | null
  >(null);
  const [isLoginRekapSyncAnimated, setIsLoginRekapSyncAnimated] = useState<boolean>(false);
  const [isLoginDeviceSyncAnimated, setIsLoginDeviceSyncAnimated] = useState<boolean>(false);
  const [isLoginPhotoSyncAnimated, setIsLoginPhotoSyncAnimated] = useState<boolean>(false);
  const [isTokenSyncCompletedAnimated, setIsTokenSyncCompletedAnimated] = useState<boolean>(false);
  const [isSyncingTokenManual, setIsSyncingTokenManual] = useState<boolean>(false);
  const [isOnlineQuestionsSyncAnimated, setIsOnlineQuestionsSyncAnimated] =
    useState<boolean>(false);
  const [loginSheetSyncTime, setLoginSheetSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );
  const [loginSheetSyncToast, setLoginSheetSyncToast] = useState<string | null>(null);
  const [photoSyncToast, setPhotoSyncToast] = useState<string | null>(null);

  // Bank Soal Multi-Paket Fase D (Kelas VII & VIII - Semester Ganjil & Genap) — 25 Soal (13 HOTS & 12 Reguler)
  const [questionBanks, setQuestionBanks] = useState<Record<ExamPackageKey, Question[]>>(() => {
    try {
      const saved = localStorage.getItem('anbk_question_banks_fase_d_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.VII_Ganjil?.length === 25 &&
          parsed.VII_Genap?.length === 25 &&
          parsed.VIII_Ganjil?.length === 25 &&
          parsed.VIII_Genap?.length === 25
        ) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return FASE_D_QUESTION_BANKS;
  });

  const activePackageKey: ExamPackageKey = getPackageKey(
    kelasSiswa || 'VIII-1',
    (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap'
  );
  const activePackageMeta = FASE_D_PACKAGE_META[activePackageKey];
  const questions: Question[] =
    questionBanks[activePackageKey] || FASE_D_QUESTION_BANKS[activePackageKey] || INITIAL_QUESTIONS;

  const [isSyncingOnlineQuestions, setIsSyncingOnlineQuestions] = useState<boolean>(false);
  const [onlineQuestionSourceText, setOnlineQuestionSourceText] = useState<string>(
    FASE_D_PACKAGE_META[getPackageKey('VIII-1', 'Ganjil')].sumberOnline
  );
  const [useOnlineVariationToggle, setUseOnlineVariationToggle] = useState<boolean>(false);

  const handleUpdateQuestions = (newQuestions: Question[]) => {
    setQuestionBanks((prev) => {
      const updated = {
        ...prev,
        [activePackageKey]: newQuestions,
      };
      try {
        localStorage.setItem('anbk_question_banks_fase_d_v3', JSON.stringify(updated));
      } catch {}
      updateQuestionBanksOnServer(updated);
      return updated;
    });
  };

  const handleUpdateAllQuestionBanks = (newBanks: Record<ExamPackageKey, Question[]>) => {
    setQuestionBanks(newBanks);
    localStorage.setItem('anbk_question_banks_fase_d_v2', JSON.stringify(newBanks));
    updateQuestionBanksOnServer(newBanks);
  };

  const handleSelectPackageFromTeacher = (pkgKey: ExamPackageKey) => {
    const meta = FASE_D_PACKAGE_META[pkgKey];
    setKelasSiswa(meta.jenjang === 'VII' ? 'VII-1' : 'VIII-1');
    setSemesterSiswa(meta.semester);
    if (headerJenjangFilter !== 'ALL') {
      setHeaderJenjangFilter(meta.jenjang);
    }
  };

  const handleHeaderJenjangChange = (nextJenjang: 'ALL' | 'VII' | 'VIII') => {
    setHeaderJenjangFilter(nextJenjang);
    if (nextJenjang === 'VII' && !kelasSiswa.toUpperCase().startsWith('VII-')) {
      setKelasSiswa('VII-1');
    } else if (nextJenjang === 'VIII' && !kelasSiswa.toUpperCase().startsWith('VIII-')) {
      setKelasSiswa('VIII-1');
    }
  };

  // Data Rekap Hasil Ujian Siswa (Tersinkron Otomatis Lintas Perangkat: HP, Tablet, Komputer Siswa & Google Sheets)
  const [submissions, setSubmissions] = useState<StudentSubmission[]>(
    () => deduplicateSubmissions(getInitialSyncedSubmissionsState().submissions)
  );
  const [isDashboardSynced, setIsDashboardSynced] = useState<boolean>(true);
  const [dashboardSyncSource, setDashboardSyncSource] = useState<string>(
    () => getInitialSyncedSubmissionsState().source
  );
  const [lastDashboardSyncTime, setLastDashboardSyncTime] = useState<string | null>(() =>
    new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );
  const [isSyncingDashboard, setIsSyncingDashboard] = useState<boolean>(false);
  const submissionsRef = useRef<StudentSubmission[]>(submissions);
  submissionsRef.current = submissions;
  const isSyncingDashboardRef = useRef<boolean>(false);
  const dashboardResetNonceRef = useRef<number>(0);

  // Pelacakan interaksi pengguna, debounce & throttle sinkronisasi login & rekap
  const [hasUserInteractedSync, setHasUserInteractedSync] = useState<boolean>(false);
  const userInteractedSyncRef = useRef<boolean>(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const isSyncInProgressRef = useRef<boolean>(false);
  const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Status Inisialisasi & Pengambilan Data Aplikasi pada Awal Muat Halaman (Page Load Feedback)
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      setIsAppInitializing(false);
    }, 1500);
    return () => window.clearTimeout(initTimer);
  }, []);

  // State Sesi Ujian Aktif (Tersinkron Lintas Guru & Siswa)
  const [activeExamSession, setActiveExamSession] = useState<ExamSessionInfo>(() =>
    getCurrentExamSession()
  );
  const activeExamSessionRef = useRef<ExamSessionInfo>(activeExamSession);
  activeExamSessionRef.current = activeExamSession;

  // State Daftar Siswa Denah & Ruang Kelas (Classroom Design)
  const [classroomStudents, setClassroomStudents] = useState<ClassroomSeatStudent[]>(() =>
    loadStoredClassroomStudents(submissions)
  );

  useEffect(() => {
    const handleClassroomUpdate = () => {
      setClassroomStudents(loadStoredClassroomStudents(submissions));
    };
    window.addEventListener(CLASSROOM_SYNC_EVENT, handleClassroomUpdate);
    return () => window.removeEventListener(CLASSROOM_SYNC_EVENT, handleClassroomUpdate);
  }, [submissions]);

  const handleUpdateSubmissions = useCallback((newSubs: StudentSubmission[]) => {
    dashboardResetNonceRef.current += 1;
    const cleanSubs = deduplicateSubmissions(newSubs);
    setSubmissions(cleanSubs);
    submissionsRef.current = cleanSubs;
    localStorage.setItem('anbk_submissions_v1', JSON.stringify(cleanSubs));
    if (cleanSubs.length === 0) {
      const nowTs = Date.now();
      localStorage.setItem('anbk_submissions_cleared_v1', 'true');
      localStorage.setItem('anbk_submissions_cleared_at_v1', String(nowTs));
    } else {
      localStorage.removeItem('anbk_submissions_cleared_v1');
    }
    const cfg = cloudConfigRef.current;
    saveAllSubmissionsToServer(
      cleanSubs,
      sanitizeRekapSheetUrl(cfg.googleSheetUrl),
      cfg.appsScriptWebAppUrl
    );
  }, []);

  const handleResetAllSubmissions = useCallback(
    async (filter?: ResetSubmissionsFilter, explicitToken?: string) => {
      dashboardResetNonceRef.current += 1;
      const nowTs = Date.now();
      const currentSubs = [...submissionsRef.current];

      const toDelete = currentSubs.filter((s) => isSubmissionMatchingResetFilter(s, filter));
      const toKeep = currentSubs.filter((s) => !isSubmissionMatchingResetFilter(s, filter));
      const isTotalReset = !filter || filter.mode === 'ALL' || toKeep.length === 0;

      const delSet = new Set<string>();
      try {
        const existingDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
        if (existingDel) {
          JSON.parse(existingDel).forEach((k: string) => delSet.add(k));
        }
      } catch {}

      toDelete.forEach((s) => {
        if (s.id) delSet.add(s.id);
        delSet.add(getSubmissionUniqueKey(s));
        const n = (s.namaSiswa || '').trim().toLowerCase();
        const nis = (s.nisNisn || '').trim();
        if (n) {
          delSet.add(n);
          delSet.add(`name_${n}`);
        }
        if (nis && nis !== '-') {
          delSet.add(nis);
          delSet.add(`nis_${nis}`);
        }
        if (n && nis) {
          delSet.add(`${n}_${nis}`);
        }
        const tsClean = (s.timestamp || '').replace(/[^0-9]/g, '');
        const nClean = n.replace(/[^a-z0-9]/g, '');
        if (tsClean && nClean) {
          delSet.add(`SHEET-${tsClean}-${nClean}`);
        }
      });

      INITIAL_SUBMISSIONS.forEach((s) => {
        if (isTotalReset || isSubmissionMatchingResetFilter(s, filter)) {
          if (s.id) delSet.add(s.id);
          delSet.add(getSubmissionUniqueKey(s));
          const n = (s.namaSiswa || '').trim().toLowerCase();
          if (n) {
            delSet.add(n);
            delSet.add(`name_${n}`);
          }
        }
      });

      const deletedIdsArray = Array.from(delSet);
      localStorage.setItem(
        'anbk_submissions_deleted_ids_v1',
        JSON.stringify(deletedIdsArray)
      );

      const cfg = cloudConfigRef.current;
      const effectiveSheetUrl = sanitizeRekapSheetUrl(cfg.googleSheetUrl);
      let effectiveScriptUrl = (cfg.appsScriptWebAppUrl || '').trim();

      // Cek penyimpanan lokal dan konfigurasi jika appsScriptWebAppUrl belum diisi di memori
      if (!effectiveScriptUrl) {
        try {
          const storedScript = localStorage.getItem('anbk_apps_script_url');
          if (storedScript && storedScript.trim().startsWith('http')) {
            effectiveScriptUrl = storedScript.trim();
          }
        } catch {}
      }
      if (!effectiveScriptUrl) {
        try {
          const storedCfg = localStorage.getItem('anbk_cloud_config');
          if (storedCfg) {
            const parsed = JSON.parse(storedCfg);
            if (parsed?.appsScriptWebAppUrl && String(parsed.appsScriptWebAppUrl).trim().startsWith('http')) {
              effectiveScriptUrl = String(parsed.appsScriptWebAppUrl).trim();
            }
          }
        } catch {}
      }
      if (!effectiveScriptUrl && effectiveSheetUrl.includes('script.google.com')) {
        effectiveScriptUrl = effectiveSheetUrl.trim();
      }

      // Kumpulkan seluruh URL Google Apps Script yang terhubung
      const rawTargetScriptUrls = [
        effectiveScriptUrl,
        cfg.appsScriptWebAppUrl,
        effectiveSheetUrl && effectiveSheetUrl.includes('script.google.com') ? effectiveSheetUrl : '',
        cfg.tokenSheetUrl && cfg.tokenSheetUrl.includes('script.google.com') ? cfg.tokenSheetUrl : '',
      ];

      try {
        const localScript2 = localStorage.getItem('anbk_apps_script_url');
        if (localScript2 && localScript2.trim()) rawTargetScriptUrls.push(localScript2.trim());
      } catch {}

      const targetScriptUrls = Array.from(
        new Set(
          rawTargetScriptUrls
            .map((u) => (u || '').trim())
            .filter((u): u is string => Boolean(u && u.startsWith('http')))
        )
      );

      let activeTok: string | null | undefined = explicitToken || getAccessTokenSync();
      if (explicitToken && explicitToken.trim().length > 10) {
        saveStoredAccessToken(explicitToken.trim(), 3300);
      }
      if (!activeTok) {
        try {
          const fsCfg = await readFirestoreCloudConfig().catch(() => null);
          const fsCfgAny = (fsCfg || {}) as Record<string, any>;
          if (fsCfgAny.oauthAccessToken && (!fsCfgAny.oauthExpiresAt || fsCfgAny.oauthExpiresAt > Date.now())) {
            activeTok = fsCfgAny.oauthAccessToken;
          }
          if (!effectiveScriptUrl && fsCfgAny.appsScriptWebAppUrl && String(fsCfgAny.appsScriptWebAppUrl).startsWith('http')) {
            effectiveScriptUrl = String(fsCfgAny.appsScriptWebAppUrl).trim();
            if (!targetScriptUrls.includes(effectiveScriptUrl)) {
              targetScriptUrls.push(effectiveScriptUrl);
            }
          }
        } catch {}
      }
      if (!activeTok) {
        activeTok = (await ensureSpreadsheetOAuthToken(false)) || undefined;
      }

      // Panggilan langsung ke Web App Google Apps Script untuk menghapus baris data di Google Sheet terkait (13 Kolom)
      const callAppsScriptSheetReset = async () => {
        if (targetScriptUrls.length === 0) return;

        if (isTotalReset) {
          // Total Reset: Mengosongkan HANYA baris isi data (baris ke-2 ke bawah) di bawah 13 judul kolom header pada lembar Google Sheet agar judul kolom baris 1 TIDAK terhapus
          const clearPromises = targetScriptUrls.flatMap((scriptUrl) => {
            const trimmed = scriptUrl.trim();

            return [
              fetch(trimmed, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  action: 'syncAllSubmissions',
                  sheetName: 'Rekap Hasil Ujian',
                  preserveHeaders: true,
                  headers: [...REKAP_SHEET_HEADERS],
                  columnsCount: 13,
                  submissions: [],
                  rows: [],
                  isTotalReset: true,
                  clearedAt: nowTs,
                  filter: filter || { mode: 'ALL' },
                  deletedIds: deletedIdsArray,
                }),
              }).catch(() => {}),
            ];
          });
          await Promise.allSettled(clearPromises);
        } else {
          // Partial Reset: Format sisa submission ke 13 kolom spesifikasi rekap nilai ujian
          const normalizedToKeep = toKeep.map((s) => ({
            ...s,
            kelas: getCleanKelas(s.kelas),
            semester: getSemesterFromSub(s),
          }));
          const rankMap = computeSubmissionRankingMap(normalizedToKeep);
          const rows13Cols = normalizedToKeep.map((s, idx) => {
            const rnk =
              rankMap[s.id] ||
              rankMap[getSubmissionUniqueKey(s)] ||
              idx + 1;
            return formatSubmissionToRekap13ColumnsWithRank(s, rnk);
          });

          const partialPromises = targetScriptUrls.flatMap((scriptUrl) => {
            const trimmed = scriptUrl.trim();
            return [
              fetch(trimmed, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  action: 'syncAllSubmissions',
                  sheetName: 'Rekap Hasil Ujian',
                  headers: [...REKAP_SHEET_HEADERS],
                  columnsCount: 13,
                  submissions: normalizedToKeep,
                  rows: rows13Cols,
                  filter,
                  deletedIds: deletedIdsArray,
                }),
              }).catch(() => {}),

              fetch(trimmed, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  action: 'deleteSubmissionsByFilter',
                  sheetName: 'Rekap Hasil Ujian',
                  headers: [...REKAP_SHEET_HEADERS],
                  columnsCount: 13,
                  remainingSubmissions: normalizedToKeep,
                  remainingRows: rows13Cols,
                  filter,
                  deletedIds: deletedIdsArray,
                }),
              }).catch(() => {}),
            ];
          });
          await Promise.allSettled(partialPromises);
        }
      };

      if (isTotalReset) {
        localStorage.setItem('anbk_submissions_cleared_v1', 'true');
        localStorage.setItem('anbk_submissions_cleared_at_v1', String(nowTs));
        localStorage.setItem('anbk_submissions_v1', JSON.stringify([]));

        try {
          localStorage.removeItem('anbk_exam_has_started');
          localStorage.removeItem('anbk_exam_in_progress');
          localStorage.removeItem('anbk_exam_has_completed');
          localStorage.removeItem('anbk_classroom_has_entered');
          localStorage.removeItem('anbk_active_exam_draft_v1');
          localStorage.removeItem('anbk_device_synced_sub_id_v1');
          localStorage.removeItem('anbk_battery_session_history_v1');
          localStorage.removeItem('anbk_reset_completed_time_v1');
          localStorage.removeItem('anbk_restore_completed_time_v1');
          localStorage.removeItem(STORAGE_KEY_STUDENTS);
          localStorage.removeItem('anbk_classroom_active_student_sync_v1');
        } catch {}
        setHasStartedExam(false);
        setHasCompletedExam(false);
        setHasEnteredClassroom(false);

        // Reset seluruh laporan nilai, riwayat hasil, serta data identitas & progres sesi siswa (nilai, NIS/NISN, nama, kelas, semester, jawaban, timer, dll.)
        setSubmissions([]);
        submissionsRef.current = [];
        setClassroomStudents([]);
        setClassroomSyncStatus(null);
        setNamaSiswa('');
        setNisNisn('');
        setKelasSiswa('VIII-1');
        setSemesterSiswa('Ganjil');
        setHeaderJenjangFilter('ALL');
        setCompletedSubmission(null);
        setIsDisqualifiedResult(false);
        setAutoReturnHomeSeconds(null);
        setActiveSessionId('');
        activeSessionIdRef.current = '';
        setCurrentQuestionIndex(0);
        currentQuestionIndexRef.current = 0;
        setAnswers({});
        answersRef.current = {};
        setDoubtful({});
        doubtfulRef.current = {};
        setQuestionDurations({});
        questionDurationsRef.current = {};
        setExamSecondsLeft(EXAM_INFO.durasiDetik);
        setViolationCount(0);
        violationCountRef.current = 0;
        setViolationLogs([]);
        violationLogsRef.current = [];
        setRedWarningOverlay(false);
        setShowSubmitConfirmModal(false);
        setIsSelfEvalLocked(false);
        setLastAutoSaveTime(null);
        setIsRetakeSession(false);
        setRetakeAttemptCount(0);
        setActiveRetakePreviouslySeenCount(0);
        clearAllStudentSeenQuestionsHistory();
        clearUsedExamTokens();
        setUsedTokensList([]);
        hasWarned5MinRef.current = false;
        hasWarned1MinRef.current = false;
        setTimerWarningAlert(null);
        setDashboardSyncSource('Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)');
        setLastDashboardSyncTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );

        // Panggil Google Apps Script dan sinkronisasi server/cloud secara paralel untuk mereset 13 kolom
        const appsScriptPromise = callAppsScriptSheetReset();
        const serverResetPromise = resetAllSubmissionsOnServer(
          effectiveSheetUrl,
          effectiveScriptUrl,
          currentSubs,
          activeTok || undefined
        );

        await Promise.allSettled([appsScriptPromise, serverResetPromise]);
      } else {
        // Reset parsial sesuai filter tanggal/bulan/tahun:
        localStorage.removeItem('anbk_submissions_cleared_v1');
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(toKeep));

        setSubmissions(toKeep);
        submissionsRef.current = toKeep;

        setClassroomStudents((prevCls) => {
          const toDeleteKeys = new Set(
            toDelete.map(
              (s) => `${(s.namaSiswa || '').trim().toLowerCase()}_${(s.nisNisn || '').trim()}`
            )
          );
          const filteredCls = prevCls.filter((cs) => {
            const k = `${(cs.namaSiswa || '').trim().toLowerCase()}_${(cs.nisNisn || '').trim()}`;
            return !toDeleteKeys.has(k) && !delSet.has(cs.id);
          });
          try {
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(filteredCls));
          } catch {}
          return filteredCls;
        });

        setCompletedSubmission((prev) => {
          if (prev && isSubmissionMatchingResetFilter(prev, filter)) {
            setIsDisqualifiedResult(false);
            return null;
          }
          return prev;
        });

        setDashboardSyncSource(
          `Tersinkron Otomatis (Filter Tanggal: ${toKeep.length} Data Tersisa)`
        );
        setLastDashboardSyncTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );

        // Panggil Google Apps Script dan sinkronisasi server/cloud secara paralel untuk menghapus baris sesuai filter
        const appsScriptPromise = callAppsScriptSheetReset();
        const serverResetPromise = deleteSubmissionsByFilterOnServer(
          filter || { mode: 'ALL' },
          toKeep,
          toDelete,
          effectiveSheetUrl,
          effectiveScriptUrl,
          activeTok || undefined
        );

        await Promise.allSettled([appsScriptPromise, serverResetPromise]);
      }

      window.dispatchEvent(
        new CustomEvent('anbk-submissions-reset-event', {
          detail: {
            filter,
            deletedCount: toDelete.length,
            remainingCount: toKeep.length,
            isTotalReset,
          },
        })
      );

      return {
        deletedCount: toDelete.length,
        remainingCount: toKeep.length,
        isTotalReset,
      };
    },
    []
  );

  const handleRestoreDefaultSubmissions = useCallback(
    async (options?: RestoreSubmissionsFilter, explicitToken?: string) => {
      dashboardResetNonceRef.current += 1;
      const effectiveFilter: RestoreSubmissionsFilter = options || {
        mode: 'ALL',
        restoreTarget: {
          appMenus: true,
          googleSheet: true,
        },
      };

      const currentCfg = getInitialCloudConfig();
      const result = await restoreSubmissionsWithFilterOnServer(
        effectiveFilter,
        submissionsRef.current,
        undefined,
        currentCfg.googleSheetUrl,
        currentCfg.appsScriptWebAppUrl,
        explicitToken
      );

      if (effectiveFilter.restoreTarget.appMenus) {
        setSubmissions(result.allActiveSubmissions);
        submissionsRef.current = result.allActiveSubmissions;
      }
      return result;
    },
    []
  );

  const handleCreateNewExamSession = useCallback(
    async (params: {
      sessionName: string;
      newToken?: string;
      targetKelas?: string;
      notes?: string;
      explicitToken?: string;
    }) => {
      dashboardResetNonceRef.current += 1;
      let activeTok = params.explicitToken || getAccessTokenSync();
      if (!activeTok) {
        try {
          const authRes = await googleSignIn();
          if (authRes?.accessToken) activeTok = authRes.accessToken;
        } catch {}
      }
      const currentSubs = submissionsRef.current;
      const result = await createNewExamSession({
        ...params,
        currentSubmissions: currentSubs,
        explicitToken: activeTok || undefined,
      });

      setActiveExamSession(result.session);
      setActiveSessionId(result.session.sessionId);
      activeSessionIdRef.current = result.session.sessionId;

      // Otomatis mengosongkan riwayat nilai siswa dan melakukan reset data submission pada sistem
      setSubmissions([]);
      submissionsRef.current = [];
      setCompletedSubmission(null);
      setIsDisqualifiedResult(false);
      setAutoReturnHomeSeconds(null);
      setHasStartedExam(false);
      setHasCompletedExam(false);
      setHasEnteredClassroom(false);
      setNamaSiswa('');
      setNisNisn('');
      setCurrentQuestionIndex(0);
      currentQuestionIndexRef.current = 0;
      setAnswers({});
      answersRef.current = {};
      setDoubtful({});
      doubtfulRef.current = {};
      setQuestionDurations({});
      questionDurationsRef.current = {};
      setExamSecondsLeft(EXAM_INFO.durasiDetik);
      setViolationCount(0);
      violationCountRef.current = 0;
      setViolationLogs([]);
      violationLogsRef.current = [];
      setRedWarningOverlay(false);
      setShowSubmitConfirmModal(false);
      setIsSelfEvalLocked(false);
      setLastAutoSaveTime(null);
      setIsRetakeSession(false);
      setRetakeAttemptCount(0);
      setActiveRetakePreviouslySeenCount(0);
      clearAllStudentSeenQuestionsHistory();
      clearUsedExamTokens();
      setUsedTokensList([]);
      hasWarned5MinRef.current = false;
      hasWarned1MinRef.current = false;
      setTimerWarningAlert(null);

      if (result.newToken) {
        setCloudConfig((prev) => ({
          ...prev,
          customTeacherToken: result.newToken,
        }));
      }

      setDashboardSyncSource(`Tersinkron Otomatis (Sesi Baru: ${result.session.sessionName})`);
      setLastDashboardSyncTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      return result;
    },
    []
  );

  // Filter data submissions secara dinamis berdasarkan dropdown filter jenjang kelas di Header
  const filteredSubmissionsByHeader =
    headerJenjangFilter === 'ALL'
      ? submissions
      : submissions.filter((s) => getJenjangFromKelas(s.kelas) === headerJenjangFilter);

  const handleUpdateFilteredSubmissions = useCallback(
    (updatedSubset: StudentSubmission[]) => {
      if (headerJenjangFilter === 'ALL') {
        handleUpdateSubmissions(updatedSubset);
        return;
      }
      // Pertahankan data jenjang lain yang tidak sedang ditampilkan di filter aktif
      const otherJenjangSubs = submissions.filter(
        (s) => getJenjangFromKelas(s.kelas) !== headerJenjangFilter
      );
      const merged = [...updatedSubset, ...otherJenjangSubs];
      handleUpdateSubmissions(merged);
    },
    [headerJenjangFilter, submissions, handleUpdateSubmissions]
  );

  const availableKelasOptions =
    headerJenjangFilter === 'VII'
      ? ['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5']
      : headerJenjangFilter === 'VIII'
      ? [...EXAM_INFO.kelasList]
      : ['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5', ...EXAM_INFO.kelasList];

  // State Hasil Ujian (Dideklarasikan lebih awal agar aman digunakan di handleSyncToClassroomDesign)
  const [completedSubmission, setCompletedSubmission] = useState<StudentSubmission | null>(null);
  const [isDisqualifiedResult, setIsDisqualifiedResult] = useState<boolean>(false);
  const [autoReturnHomeSeconds, setAutoReturnHomeSeconds] = useState<number | null>(null);

  // Handler sinkronisasi data Siswa ke menu Design Classroom
  // SYARAT WAJIB: Siswa HANYA dapat masuk ke denah kelas di Classroom dan otomatis mengisi bangku yang kosong
  // saat siswa SUDAH MENYELESAIKAN SEMUA SOAL UJIAN dan DINYATAKAN LULUS UJIAN (Minimal Standar KKM 75). Selain itu TIDAK BISA!
  const handleSyncToClassroomDesign = useCallback(
    (showToast: boolean = true, explicitPassedSubmission?: StudentSubmission | null) => {
      const cleanName = (explicitPassedSubmission?.namaSiswa ?? namaSiswa).trim();
      const cleanNis = (explicitPassedSubmission?.nisNisn ?? nisNisn).trim();
      const targetKls = getCleanKelas(explicitPassedSubmission?.kelas ?? kelasSiswa) || 'VIII-1';
      const targetSem = (explicitPassedSubmission?.semester ?? semesterSiswa ?? 'Ganjil') as 'Ganjil' | 'Genap';

      if (!cleanName && !cleanNis) {
        if (showToast) {
          setClassroomSyncToast('Ketik Nama Lengkap Siswa atau NIS/NISN terlebih dahulu.');
          setTimeout(() => setClassroomSyncToast(null), 3500);
        }
        return null;
      }

      // Cari data kelulusan ujian siswa dari explicitPassedSubmission, completedSubmission, atau riwayat submissions
      const candidateSub =
        explicitPassedSubmission ||
        (completedSubmission &&
        (completedSubmission.nisNisn.trim().toLowerCase() === cleanNis.toLowerCase() ||
          completedSubmission.namaSiswa.trim().toLowerCase() === cleanName.toLowerCase())
          ? completedSubmission
          : submissions.find(
              (s) =>
                s.isCompleted !== false &&
                ((cleanNis &&
                  cleanNis !== '-' &&
                  s.nisNisn.trim().toLowerCase() === cleanNis.toLowerCase()) ||
                  (cleanName &&
                    s.namaSiswa.trim().toLowerCase() === cleanName.toLowerCase())) &&
                s.nilaiAkhir >= EXAM_INFO.kkm &&
                !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
                !String(s.statusKecurangan || '').toLowerCase().includes('diskualifikasi')
            ));

      const isEligiblePassed =
        Boolean(candidateSub) &&
        candidateSub!.isCompleted !== false &&
        Number(candidateSub!.nilaiAkhir ?? 0) >= EXAM_INFO.kkm &&
        !String(candidateSub!.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(candidateSub!.statusKecurangan || '').toLowerCase().includes('diskualifikasi');

      if (!isEligiblePassed || !candidateSub) {
        if (showToast) {
          setClassroomSyncToast(
            `🔒 Akses Denah Bangku Ditolak: Siswa HANYA dapat masuk ke Denah Kelas di Classroom & mengisi bangku kosong setelah menyelesaikan semua soal ujian dan dinyatakan LULUS UJIAN (Minimal Standar KKM ${EXAM_INFO.kkm}). Selain itu tidak bisa!`
          );
          setTimeout(() => setClassroomSyncToast(null), 5000);
        }
        return null;
      }

      setIsClassroomSyncing(true);
      try {
        const res = syncStudentToClassroomSeat({
          namaSiswa: cleanName || 'Peserta Ujian',
          nisNisn: cleanNis || `00${Math.floor(10000000 + Math.random() * 89999999)}`,
          kelas: targetKls,
          semester: targetSem,
          deviceCategory: candidateSub.deviceCategory || detectedDevice.deviceCategory,
          deviceBrand: candidateSub.deviceBrand || detectedDevice.brand,
          deviceModel: candidateSub.deviceModel || effectiveDeviceModel,
          deviceInfo:
            candidateSub.deviceInfo ||
            effectiveDeviceSummary ||
            detectedDevice.fullSummaryLabel ||
            'HP Android Siswa',
          photoUrl: candidateSub.photoUrl || studentPhotoUrl || undefined,
          attendanceStatus: 'Selesai Ujian',
          skorBenar: candidateSub.skorBenar,
          totalSoal: candidateSub.totalSoal,
          nilaiAkhir: candidateSub.nilaiAkhir,
          statusKecurangan: candidateSub.statusKecurangan,
          lulusTidakLulus: 'Lulus Ujian',
          isExamCompletedAndPassed: true,
          submissionsFallback: submissions,
        });

        if (res) {
          setClassroomSyncStatus({
            seatNumber: res.assignedSeat,
            kelas: res.student.kelas,
            semester: res.student.semester,
            namaSiswa: res.student.namaSiswa,
            isNew: res.isNew,
            syncedAt: res.student.updatedAt,
          });

          if (showToast) {
            const msg = res.isNew
              ? `✓ LULUS UJIAN (Nilai ${candidateSub.nilaiAkhir}% ≥ KKM ${EXAM_INFO.kkm}): "${res.student.namaSiswa}" otomatis masuk ke Denah Kelas Classroom & mengisi Bangku Kosong #${res.assignedSeat} (Kelas ${res.student.kelas})!`
              : `✓ Data Kelulusan "${res.student.namaSiswa}" (Nilai ${candidateSub.nilaiAkhir}%) berhasil diperbarui di Bangku #${res.assignedSeat} (Kelas ${res.student.kelas})!`;
            setClassroomSyncToast(msg);
            setTimeout(() => setClassroomSyncToast(null), 5500);
          }
          return res;
        }
      } finally {
        setTimeout(() => setIsClassroomSyncing(false), 250);
      }
      return null;
    },
    [
      namaSiswa,
      nisNisn,
      kelasSiswa,
      semesterSiswa,
      completedSubmission,
      detectedDevice,
      effectiveDeviceModel,
      effectiveDeviceSummary,
      studentPhotoUrl,
      submissions,
    ]
  );

  // Perbarui foto profil di bangku Classroom HANYA JIKA siswa sudah lulus ujian (Nilai >= KKM 75)
  useEffect(() => {
    if (!namaSiswa.trim() && !nisNisn.trim() && !studentPhotoUrl) return;
    const timer = setTimeout(() => {
      handleSyncToClassroomDesign(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [namaSiswa, nisNisn, kelasSiswa, semesterSiswa, studentPhotoUrl, handleSyncToClassroomDesign]);

  // Dengarkan event sinkronisasi bangku antar komponen / window
  useEffect(() => {
    const handleSyncEvent = () => {
      const stored = getStoredActiveSync();
      if (stored && stored.namaSiswa) {
        setClassroomSyncStatus({
          seatNumber: stored.seatNumber,
          kelas: stored.kelas,
          semester: stored.semester,
          namaSiswa: stored.namaSiswa,
          isNew: stored.isNew,
          syncedAt: stored.syncedAt,
        });
      }
    };
    window.addEventListener(CLASSROOM_SYNC_EVENT, handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);
    return () => {
      window.removeEventListener(CLASSROOM_SYNC_EVENT, handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, []);

  // Mekanisme Antrean Sinkronisasi (Queue) Anti-Gagal Jaringan
  const syncQueue = useSubmissionSyncQueue();
  const [showQueueModal, setShowQueueModal] = useState<boolean>(false);

  // Konfigurasi Cloud Google Docs, Sheet & Apps Script
  const [cloudConfig, setCloudConfig] = useState<CloudIntegrationConfig>(() =>
    getInitialCloudConfig()
  );

  const handleUpdateCloudConfig = (newCfg: CloudIntegrationConfig) => {
    const normalizedCfg: CloudIntegrationConfig = {
      ...newCfg,
      tokenSheetUrl: newCfg.tokenSheetUrl ?? cloudConfig.tokenSheetUrl ?? newCfg.googleSheetUrl,
      googleSheetUrl: sanitizeRekapSheetUrl(newCfg.googleSheetUrl ?? cloudConfig.googleSheetUrl),
    };
    setCloudConfig(normalizedCfg);
    localStorage.setItem('anbk_cloud_config_v1', JSON.stringify(normalizedCfg));
    if (normalizedCfg.tokenSheetUrl) {
      setTokenSheetUrlInput(normalizedCfg.tokenSheetUrl);
    }
    saveCloudTokenConfigToServer(normalizedCfg);
    syncSubmissionsToGoogleSheetsAuto(
      submissionsRef.current,
      normalizedCfg.googleSheetUrl,
      normalizedCfg.appsScriptWebAppUrl,
      true
    ).catch(() => {});
    if (
      normalizedCfg.customTeacherToken &&
      normalizedCfg.customTeacherToken.trim().length >= 3
    ) {
      const cleanTok = normalizedCfg.customTeacherToken
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6);
      if (cleanTok && cleanTok.length >= 3) {
        setIsSheetTokenSynced(true);
        setOnlineToken(cleanTok);
        setTeacherCustomTokenInput(cleanTok);
        setLastTokenSyncTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        pushTokenEventLocallyAndBroadcast(cleanTok, 'Panel Guru Cloud Config');
        pushTokenToGoogleSheet(
          cleanTok,
          normalizedCfg.appsScriptWebAppUrl,
          normalizedCfg.tokenSheetUrl || normalizedCfg.googleSheetUrl
        );
      }
    }
  };

  // Sinkronisasi Bank Soal Esay 15 Nomor dari Server Online sesuai Kelas (VII / VIII) & Semester (Ganjil / Genap)
  // Menjamin soal unik berbeda untuk tiap tipe perangkat (Android/iPhone/Chromebook/PC) & IP, serta selalu berganti saat mengulang/susulan
  useEffect(() => {
    const targetJenjang = getJenjangFromKelas(kelasSiswa || 'VIII-1');
    const targetSemester = (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
    const essayCtx = {
      kelas: kelasSiswa || 'VIII-1',
      semester: targetSemester,
      namaSiswa,
      nisNisn,
      clientIp: effectiveClientIp,
      deviceFingerprint: effectiveDeviceFingerprint,
      deviceModel: effectiveDeviceModel,
      deviceCategory: detectedDevice.deviceCategory,
    };
    setIsSyncingEssayQuestions(true);
    fetchOnlineFaseDEssayQuestions(
      targetJenjang,
      targetSemester,
      cloudConfig?.appsScriptWebAppUrl,
      essayCtx
    )
      .then((res) => {
        setEssayQuestions(res.questions);
        setEssayQuestionSourceText(res.sourceLabel);
      })
      .catch(() => {
        const local = generateNonRepeatingEssayQuestionsForStudent(essayCtx);
        setEssayQuestions(local.questions);
        setEssayQuestionSourceText(local.sourceLabel);
      })
      .finally(() => {
        setIsSyncingEssayQuestions(false);
      });
  }, [
    kelasSiswa,
    semesterSiswa,
    namaSiswa,
    nisNisn,
    effectiveClientIp,
    effectiveDeviceFingerprint,
    effectiveDeviceModel,
    detectedDevice.deviceCategory,
    cloudConfig?.appsScriptWebAppUrl,
  ]);

  // Token Ujian Online 6 Digit (WAJIB berasal dari Link Google Sheets "KODE TOKEN UJIAN" yang tersinkron)
  const [onlineToken, setOnlineToken] = useState<string>(() => getInitialSyncedTokenState().token);
  const [isSheetTokenSynced, setIsSheetTokenSynced] = useState<boolean>(
    () => getInitialSyncedTokenState().isSynced
  );
  const [tokenSyncResetKey, setTokenSyncResetKey] = useState<number>(0);
  const [tokenCopied, setTokenCopied] = useState<boolean>(false);
  const [tokenSourceLabel, setTokenSourceLabel] = useState<string>(
    () => getInitialSyncedTokenState().source
  );
  const [lastTokenSyncTime, setLastTokenSyncTime] = useState<string | null>(() =>
    new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );
  const [tokenSyncToast, setTokenSyncToast] = useState<string | null>(null);

  // Kolom Kode Token Ujian diisi secara MANUAL oleh siswa: hanya kosongkan jika token yang diketik sudah pernah dipakai
  useEffect(() => {
    setInputToken((prev) => {
      const cleanPrev = sanitizeTokenValue(prev);
      if (!cleanPrev) return prev;
      const usage = checkStudentTokenUsage(
        cleanPrev,
        namaSiswa,
        nisNisn,
        submissionsRef.current
      );
      return usage.isAlreadyUsed ? '' : prev;
    });
  }, [usedTokensList.length, namaSiswa, nisNisn]);

  // State Panel Guru Pengaturan Kode Token & Link Google Sheets "KODE TOKEN UJIAN"
  const [showTeacherTokenPanel, setShowTeacherTokenPanel] = useState<boolean>(false);
  const [isTeacherTokenUnlocked, setIsTeacherTokenUnlocked] = useState<boolean>(false);
  const [teacherTokenPassInput, setTeacherTokenPassInput] = useState<string>('');
  const [showTeacherTokenPass, setShowTeacherTokenPass] = useState<boolean>(false);
  const [teacherTokenPassError, setTeacherTokenPassError] = useState<string | null>(null);
  const [teacherCustomTokenInput, setTeacherCustomTokenInput] = useState<string>(
    () => getInitialSyncedTokenState().token
  );
  const [tokenSheetUrlInput, setTokenSheetUrlInput] = useState<string>(
    cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl || ''
  );

  const cloudConfigRef = useRef<CloudIntegrationConfig>(cloudConfig);
  cloudConfigRef.current = cloudConfig;
  const onlineTokenRef = useRef<string>(onlineToken);
  onlineTokenRef.current = onlineToken;
  const tokenSheetUrlInputRef = useRef<string>(tokenSheetUrlInput);
  tokenSheetUrlInputRef.current = tokenSheetUrlInput;
  const isSyncingTokenRef = useRef<boolean>(false);

  const handleSyncTokenFromSheet = useCallback(
    async (_autoFillLoginInput: boolean = true, silent: boolean = true) => {
      if (isSyncingTokenRef.current && silent) return;
      isSyncingTokenRef.current = true;
      if (!silent) {
        setIsSyncingTokenManual(true);
      }

      const cfg = cloudConfigRef.current;
      const targetSheetUrl =
        cfg.tokenSheetUrl || cfg.googleSheetUrl || tokenSheetUrlInputRef.current;
      const targetAppsScript = cfg.appsScriptWebAppUrl;

      try {
        const res = await fetchTokenFromGoogleSheet(targetSheetUrl, targetAppsScript);
        const effectiveSheet = res.syncedSheetUrl || targetSheetUrl;
        const nowStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        if (res.isSyncedFromSheet && res.token) {
          setIsSheetTokenSynced(true);
          const isResTokenUsed = checkStudentTokenUsage(
            res.token,
            namaSiswa,
            nisNisn,
            submissionsRef.current
          ).isAlreadyUsed;
          if (_autoFillLoginInput && !silent && !isResTokenUsed) {
            setInputToken(res.token);
            setLoginError(null);
          }
          if (res.token !== onlineTokenRef.current || !silent) {
            setOnlineToken(res.token);
            setTeacherCustomTokenInput(res.token);
            setTokenSyncResetKey((k) => k + 1);
            setLastTokenSyncTime(nowStr);
          } else {
            setLastTokenSyncTime((prev) => prev || nowStr);
          }
          setTokenSourceLabel(res.source);

          if (effectiveSheet && !tokenSheetUrlInputRef.current) {
            setTokenSheetUrlInput(effectiveSheet);
          }

          if (
            res.token !== cfg.customTeacherToken ||
            (effectiveSheet && effectiveSheet !== cfg.tokenSheetUrl)
          ) {
            const nextCfg: CloudIntegrationConfig = {
              ...cfg,
              customTeacherToken: res.token,
              tokenSheetUrl: effectiveSheet || cfg.tokenSheetUrl,
              googleSheetUrl: sanitizeRekapSheetUrl(cfg.googleSheetUrl),
              appsScriptWebAppUrl: res.syncedAppsScriptUrl || cfg.appsScriptWebAppUrl,
            };
            setCloudConfig(nextCfg);
            localStorage.setItem('anbk_cloud_config_v1', JSON.stringify(nextCfg));
          }

          if (!silent) {
            setLastTokenSyncTime(nowStr);
            setIsTokenSyncCompletedAnimated(true);
            setTimeout(() => setIsTokenSyncCompletedAnimated(false), 7500);
            setTokenSyncToast(
              `✓ Selesai Sinkron Otomatis [KODE TOKEN UJIAN]: ${res.token} (Pukul ${nowStr})`
            );
            setTimeout(() => setTokenSyncToast(null), 5000);
          }
        } else if (!isValidGoogleSheetOrScriptUrl(effectiveSheet, targetAppsScript)) {
          setIsSheetTokenSynced(false);
          setOnlineToken('');
          setInputToken('');
          setTokenSourceLabel(res.source);
          setLastTokenSyncTime(null);
          if (!silent) {
            setTokenSyncToast(
              'Kode Token belum ditemukan pada menu KODE TOKEN UJIAN. Pastikan tautan aktif & berisi Kode Token!'
            );
            setTimeout(() => setTokenSyncToast(null), 4500);
          }
        }
      } catch {
        // Pertahankan token aktif saat terjadi gangguan jaringan sesaat pada polling latar belakang
      } finally {
        isSyncingTokenRef.current = false;
        if (!silent) {
          setIsSyncingTokenManual(false);
        }
      }
    },
    []
  );

  // Sistem Pembaruan State Berbasis Event untuk onlineToken:
  // Menggunakan EventSource (SSE), Firestore onSnapshot Real-Time, BroadcastChannel, dan DOM Events
  // Memastikan setiap perubahan token di Google Sheets langsung ter-push ke localStorage semua perangkat TANPA menunggu polling interval!
  useEffect(() => {
    const unsubscribeTokenEvents = subscribeToOnlineTokenEvents((data) => {
      const clean = data.token.toUpperCase().slice(0, 6);
      if (clean && clean.length >= 3) {
        setIsSheetTokenSynced(true);
        setOnlineToken(clean);
        setTeacherCustomTokenInput(clean);
        setTokenSyncResetKey((k) => k + 1);
        setTokenSourceLabel(data.source);
        const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastTokenSyncTime(timeStr);
      }
    });

    // Jalankan sinkronisasi awal sekali saat halaman dibuka
    handleSyncTokenFromSheet(true, true);

    const handleFocusOrVisible = () => {
      if (!document.hidden) {
        handleSyncTokenFromSheet(true, true);
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'anbk_cloud_config_v1' && e.newValue) {
        try {
          const parsed: CloudIntegrationConfig = JSON.parse(e.newValue);
          setCloudConfig(parsed);
          if (parsed.tokenSheetUrl || parsed.googleSheetUrl) {
            setTokenSheetUrlInput(parsed.tokenSheetUrl || parsed.googleSheetUrl || '');
          }
          setTimeout(() => {
            handleSyncTokenFromSheet(true, true);
          }, 50);
        } catch {
          // Abaikan
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('online', handleFocusOrVisible);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      unsubscribeTokenEvents();
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('online', handleFocusOrVisible);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [
    cloudConfig.tokenSheetUrl,
    cloudConfig.googleSheetUrl,
    cloudConfig.appsScriptWebAppUrl,
    handleSyncTokenFromSheet,
  ]);

  // Sinkronisasi Real-Time Otomatis untuk Fitur Siswa Dashboard Lintas Perangkat (HP, Tablet & Komputer Siswa)
  const handleSyncStudentDashboard = useCallback(async (silent: boolean = true) => {
    if (isSyncingDashboardRef.current && silent) return;
    isSyncingDashboardRef.current = true;
    const startNonce = dashboardResetNonceRef.current;
    if (!silent) {
      setIsSyncingDashboard(true);
    }

    try {
      const cfg = cloudConfigRef.current;
      const res = await fetchStudentDashboardSyncState(
        sanitizeRekapSheetUrl(cfg.googleSheetUrl),
        cfg.appsScriptWebAppUrl,
        submissionsRef.current
      );
      if (startNonce !== dashboardResetNonceRef.current) {
        return;
      }

      if (res) {
        const nowStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setIsDashboardSynced(true);
        setDashboardSyncSource(res.source);
        setLastDashboardSyncTime(nowStr);

        let activeDelSet = new Set<string>();
        try {
          const rawDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
          if (rawDel) {
            JSON.parse(rawDel).forEach((k: string) => {
              if (k) activeDelSet.add(k);
            });
          }
        } catch {}
        const effectiveClearedAt = Number(res.clearedAt || localStorage.getItem('anbk_submissions_cleared_at_v1') || 0);

        if (res.isCleared) {
          localStorage.setItem('anbk_submissions_cleared_v1', 'true');
          localStorage.setItem('anbk_submissions_cleared_at_v1', String(effectiveClearedAt));
        } else {
          localStorage.removeItem('anbk_submissions_cleared_v1');
        }

        if (res.activeSessionId) {
          setActiveExamSession((prev) => {
            if (prev.sessionId !== res.activeSessionId) {
              return {
                sessionId: res.activeSessionId!,
                sessionName: res.activeSessionName || prev.sessionName,
                createdAt: res.clearedAt || Date.now(),
                createdBy: EXAM_INFO.guruMapel,
                status: 'ACTIVE',
              };
            }
            return prev;
          });
        }

        const validIncomingSubs = (res.isCleared && res.submissions.length === 0)
          ? []
          : res.submissions.filter((s) => {
              if (!s || !s.namaSiswa) return false;
              const k = s.id || getSubmissionUniqueKey(s);
              const uKey = getSubmissionUniqueKey(s);
              if (activeDelSet.has(s.id) || activeDelSet.has(k) || activeDelSet.has(uKey)) return false;
              if (effectiveClearedAt > 0) {
                const matchTs = (s.id || '').match(/^(?:SUB|ESAY)-(\d+)/);
                const createdTs = matchTs ? Number(matchTs[1]) : 0;
                if (createdTs > 0 && createdTs <= effectiveClearedAt) return false;
              }
              return true;
            });

        const buildSubSig = (list: StudentSubmission[]) =>
          JSON.stringify(
            list.map(
              (s) =>
                `${s.id}_${s.namaSiswa}_${s.nisNisn}_${s.kelas}_${s.semester}_${s.nilaiAkhir}_${s.lulusTidakLulus}_${s.deviceModel || ''}_${s.deviceInfo || ''}_${(s.photoUrl || '').length}`
            )
          );
        const currentJson = buildSubSig(submissionsRef.current);
        const nextJson = buildSubSig(validIncomingSubs);
        if (currentJson !== nextJson) {
          if (res.isCleared && validIncomingSubs.length === 0) {
            setSubmissions([]);
            submissionsRef.current = [];
            localStorage.setItem('anbk_submissions_v1', JSON.stringify([]));
          } else {
            const localMap = new Map<string, StudentSubmission>();
            submissionsRef.current.forEach((s) => {
              if (s.id) localMap.set(s.id, s);
              localMap.set(getSubmissionUniqueKey(s), s);
            });
            const mergedSubs = deduplicateSubmissions(validIncomingSubs).map((s) => {
              const loc = localMap.get(s.id) || localMap.get(getSubmissionUniqueKey(s));
              return {
                ...s,
                photoUrl:
                  s.photoUrl ||
                  loc?.photoUrl ||
                  getPhotoForStudentIdentity(s.namaSiswa, s.nisNisn) ||
                  undefined,
              };
            });
            const cleanMerged = deduplicateSubmissions(mergedSubs);
            setSubmissions(cleanMerged);
            submissionsRef.current = cleanMerged;
            localStorage.setItem('anbk_submissions_v1', JSON.stringify(cleanMerged));
          }
        }

        if (
          res.questionBanks &&
          typeof res.questionBanks === 'object' &&
          res.questionBanks.VII_Ganjil &&
          res.questionBanks.VIII_Ganjil
        ) {
          setQuestionBanks((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(res.questionBanks)) {
              localStorage.setItem(
                'anbk_question_banks_fase_d_v2',
                JSON.stringify(res.questionBanks)
              );
              return res.questionBanks!;
            }
            return prev;
          });
        }
      }
    } catch {
      // Pertahankan state lokal jika jaringan sedang lambat
    } finally {
      isSyncingDashboardRef.current = false;
      if (!silent) {
        setIsSyncingDashboard(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      handleSyncStudentDashboard(true);
      const isCleared = typeof window !== 'undefined' && localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
      if (!isCleared) {
        autoRecoverAndSyncAllUnsavedSubmissions({
          sheetUrl: cloudConfigRef.current.googleSheetUrl,
          appsScriptUrl: cloudConfigRef.current.appsScriptWebAppUrl,
        }).then((recovered) => {
          if (recovered && recovered.length > 0) {
            setSubmissions((prev) => {
              const merged = deduplicateSubmissions([...recovered, ...prev]);
              submissionsRef.current = merged;
              return merged;
            });
          }
        }).catch(() => {});
      }
    }, 300);

    const handleUnsavedSynced = (e: Event) => {
      const customEv = e as CustomEvent<{ submissions: StudentSubmission[] }>;
      if (customEv?.detail?.submissions && customEv.detail.submissions.length > 0) {
        setSubmissions((prev) => {
          const merged = deduplicateSubmissions([...customEv.detail.submissions, ...prev]);
          submissionsRef.current = merged;
          return merged;
        });
      }
    };
    window.addEventListener(UNSAVED_SUBMISSIONS_SYNC_EVENT, handleUnsavedSynced);

    const unsubscribeFirestore = subscribeToFirestoreDashboardState((liveState) => {
      const localClearedAt = Number(localStorage.getItem('anbk_submissions_cleared_at_v1') || 0);
      const localIsCleared = localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
      if (
        localIsCleared &&
        localClearedAt > Math.max(liveState.clearedAt, liveState.updatedAt) &&
        liveState.submissions.length > 0
      ) {
        return;
      }
      if (liveState.isCleared) {
        localStorage.setItem('anbk_submissions_cleared_v1', 'true');
        localStorage.setItem('anbk_submissions_cleared_at_v1', String(liveState.clearedAt));
        if (liveState.deletedIds && liveState.deletedIds.length > 0) {
          localStorage.setItem(
            'anbk_submissions_deleted_ids_v1',
            JSON.stringify(liveState.deletedIds)
          );
        }
      } else {
        localStorage.removeItem('anbk_submissions_cleared_v1');
        localStorage.setItem('anbk_submissions_cleared_at_v1', '0');
        if (liveState.deletedIds && liveState.deletedIds.length > 0) {
          try {
            const storedDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
            const existingDelList: string[] = storedDel ? JSON.parse(storedDel) : [];
            const mergedDel = Array.from(new Set([...existingDelList, ...liveState.deletedIds]));
            localStorage.setItem('anbk_submissions_deleted_ids_v1', JSON.stringify(mergedDel));
          } catch {}
        }
      }

      // Pastikan delSet mencakup seluruh riwayat deletedIds
      const delSet = new Set<string>();
      if (Array.isArray(liveState.deletedIds)) {
        liveState.deletedIds.forEach((id) => { if (id) delSet.add(id); });
      }
      try {
        const storedDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
        if (storedDel) {
          JSON.parse(storedDel).forEach((id: string) => { if (id) delSet.add(id); });
        }
      } catch {}

      // CEK APAKAH PERANGKAT SISWA SAAT INI ADALAH SISWA YANG DIHAPUS OLEH GURU PENGAWAS
      const curStudentName = (namaSiswa || '').trim().toLowerCase();
      const curStudentNis = (nisNisn || '').trim();
      const activeDraft = (() => {
        try {
          const d = localStorage.getItem('anbk_active_exam_draft_v1');
          return d ? JSON.parse(d) : null;
        } catch {
          return null;
        }
      })();
      const draftName = (activeDraft?.namaSiswa || '').trim().toLowerCase();
      const draftNis = (activeDraft?.nisNisn || '').trim();
      const draftId = activeDraft?.id || '';

      const isCurrentDeviceStudentDeleted =
        (curStudentName && (delSet.has(curStudentName) || delSet.has(`${curStudentName}_${curStudentNis}`) || delSet.has(curStudentNis) || delSet.has(`name_${curStudentName}`))) ||
        (draftId && delSet.has(draftId)) ||
        (draftName && (delSet.has(draftName) || delSet.has(`${draftName}_${draftNis}`) || delSet.has(draftNis) || delSet.has(`name_${draftName}`)));

      if (isCurrentDeviceStudentDeleted) {
        // Hapus permanen seluruh data ujian lokal di perangkat siswa ini seketika
        try {
          localStorage.removeItem('anbk_active_exam_draft_v1');
          localStorage.removeItem('anbk_exam_has_started');
          localStorage.removeItem('anbk_exam_in_progress');
          localStorage.removeItem('anbk_exam_has_completed');
          localStorage.removeItem('anbk_is_disqualified_v1');
          localStorage.removeItem('anbk_violations_count');
          localStorage.removeItem('anbk_violation_logs_v1');
          localStorage.removeItem('anbk_classroom_active_student_sync_v1');
          localStorage.removeItem('anbk_classroom_has_entered');
          localStorage.removeItem('anbk_device_synced_sub_id_v1');
          localStorage.removeItem('anbk_last_completed_submission_v1');
          localStorage.removeItem('anbk_student_profile_v1');
          localStorage.removeItem('anbk_submission_sync_queue_v2');
          localStorage.removeItem('anbk_unsaved_submissions_v1');
        } catch {}
        setHasStartedExam(false);
        setHasCompletedExam(false);
        setHasEnteredClassroom(false);
        setCompletedSubmission(null);
        setIsDisqualifiedResult(false);
        setNamaSiswa('');
        setNisNisn('');
        setAnswers({});
        setViolationCount(0);
        setViolationLogs([]);
        setView('HOME');
      }

      setIsDashboardSynced(true);
      setDashboardSyncSource(liveState.source);
      setLastDashboardSyncTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      const localMap = new Map<string, StudentSubmission>();
      submissionsRef.current.forEach((s) => {
        if (s.id) localMap.set(s.id, s);
        localMap.set(getSubmissionUniqueKey(s), s);
      });
      const mergedLiveSubs = deduplicateSubmissions(liveState.submissions).map((s) => {
        const loc = localMap.get(s.id) || localMap.get(getSubmissionUniqueKey(s));
        return {
          ...s,
          photoUrl:
            s.photoUrl ||
            loc?.photoUrl ||
            getPhotoForStudentIdentity(s.namaSiswa, s.nisNisn) ||
            undefined,
        };
      });
      const cleanLiveSubs = deduplicateSubmissions(mergedLiveSubs).filter((s) => {
        const sId = s.id || '';
        const sName = (s.namaSiswa || '').trim().toLowerCase();
        const sNis = (s.nisNisn || '').trim();
        const sKey = getSubmissionUniqueKey(s);
        if (
          delSet.has(sId) ||
          delSet.has(sKey) ||
          delSet.has(sName) ||
          delSet.has(`name_${sName}`) ||
          (sNis && sNis !== '-' && (delSet.has(sNis) || delSet.has(`nis_${sNis}`))) ||
          (sName && sNis && delSet.has(`${sName}_${sNis}`))
        ) {
          return false;
        }
        return true;
      });

      setSubmissions((prev) => {
        if (
          prev.length === cleanLiveSubs.length &&
          prev.every(
            (p, idx) =>
              p.id === cleanLiveSubs[idx]?.id &&
              p.nilaiAkhir === cleanLiveSubs[idx]?.nilaiAkhir &&
              p.photoUrl === cleanLiveSubs[idx]?.photoUrl &&
              p.statusKecurangan === cleanLiveSubs[idx]?.statusKecurangan
          )
        ) {
          return prev;
        }
        return cleanLiveSubs;
      });
      submissionsRef.current = cleanLiveSubs;

      // Bersihkan juga dari classroomStudents jika ada siswa yang terhapus
      setClassroomStudents((prevCls) => {
        const filteredCls = prevCls.filter((cs) => {
          const csName = (cs.namaSiswa || '').trim().toLowerCase();
          const csNis = (cs.nisNisn || '').trim();
          if (
            delSet.has(cs.id) ||
            delSet.has(csName) ||
            delSet.has(`name_${csName}`) ||
            (csNis && csNis !== '-' && (delSet.has(csNis) || delSet.has(`nis_${csNis}`))) ||
            (csName && csNis && delSet.has(`${csName}_${csNis}`))
          ) {
            return false;
          }
          return true;
        });
        if (filteredCls.length !== prevCls.length) {
          try {
            localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(filteredCls));
          } catch {}
        }
        return filteredCls;
      });

      window.setTimeout(() => {
        try {
          localStorage.setItem('anbk_submissions_v1', JSON.stringify(cleanLiveSubs));
        } catch {}
      }, 100);

      // Otomatis sinkronkan pembaruan laporan nilai ke Link Google Sheets Rekap Hasil Ujian (10 Kolom)
      syncSubmissionsToGoogleSheetsAuto(
        cleanLiveSubs,
        sanitizeRekapSheetUrl(cloudConfigRef.current.googleSheetUrl),
        cloudConfigRef.current.appsScriptWebAppUrl
      ).catch(() => {});
    });

    const unsubscribeCloudCfg = subscribeToFirestoreCloudConfig((remoteCfg) => {
      const remoteTok = (remoteCfg.customTeacherToken || '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6);
      const remoteSheet = (remoteCfg.tokenSheetUrl || '').trim();

      if (remoteTok.length >= 3) {
        setIsSheetTokenSynced(true);
        setOnlineToken(remoteTok);
        setTeacherCustomTokenInput(remoteTok);
        setTokenSourceLabel('Tersinkron Otomatis Live (KODE TOKEN UJIAN)');
        setLastTokenSyncTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
      if (remoteSheet) {
        setTokenSheetUrlInput(remoteSheet);
      }

      setCloudConfig((prev) => {
        const next: CloudIntegrationConfig = {
          ...prev,
          googleSheetUrl: sanitizeRekapSheetUrl(remoteCfg.googleSheetUrl || prev.googleSheetUrl),
          tokenSheetUrl: remoteCfg.tokenSheetUrl || prev.tokenSheetUrl,
          appsScriptWebAppUrl:
            remoteCfg.appsScriptWebAppUrl !== undefined
              ? remoteCfg.appsScriptWebAppUrl
              : prev.appsScriptWebAppUrl,
          googleDocUrl:
            remoteCfg.googleDocUrl !== undefined ? remoteCfg.googleDocUrl : prev.googleDocUrl,
          customTeacherToken: remoteTok.length >= 3 ? remoteTok : prev.customTeacherToken,
        };
        localStorage.setItem('anbk_cloud_config_v1', JSON.stringify(next));
        return next;
      });
    });

    const pollDashboard = setInterval(() => {
      handleSyncStudentDashboard(true);
    }, 8000);

    const handleFocusDashboard = () => {
      if (!document.hidden) {
        handleSyncStudentDashboard(true);
      }
    };

    const handleStorageDashboard = (e: StorageEvent) => {
      if (e.key === 'anbk_submissions_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setSubmissions(parsed);
            submissionsRef.current = parsed;
          }
        } catch {
          // ignore
        }
      } else if (e.key === 'anbk_active_exam_session_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object' && parsed.sessionId) {
            setActiveExamSession(parsed);
          }
        } catch {
          // ignore
        }
      }
    };

    const handleNewSessionEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ session?: ExamSessionInfo }>).detail;
      if (detail?.session) {
        setActiveExamSession(detail.session);
        setActiveSessionId(detail.session.sessionId);
        activeSessionIdRef.current = detail.session.sessionId;
        setSubmissions([]);
        submissionsRef.current = [];
        setCompletedSubmission(null);
        setHasStartedExam(false);
        setHasCompletedExam(false);
      }
    };

    const handleResetEvent = () => {
      setSubmissions([]);
      submissionsRef.current = [];
      setCompletedSubmission(null);
      setHasStartedExam(false);
      setHasCompletedExam(false);
    };

    let deletionBc: BroadcastChannel | null = null;
    const processDeletionPayload = (deletedIds: string[]) => {
      if (!Array.isArray(deletedIds) || deletedIds.length === 0) return;
      const dSet = new Set(deletedIds);

      try {
        const stored = localStorage.getItem('anbk_submissions_deleted_ids_v1');
        const list: string[] = stored ? JSON.parse(stored) : [];
        const merged = Array.from(new Set([...list, ...deletedIds]));
        localStorage.setItem('anbk_submissions_deleted_ids_v1', JSON.stringify(merged));
      } catch {}

      const myName = (namaSiswa || '').trim().toLowerCase();
      const myNis = (nisNisn || '').trim();
      const activeDraft = (() => {
        try {
          const d = localStorage.getItem('anbk_active_exam_draft_v1');
          return d ? JSON.parse(d) : null;
        } catch {
          return null;
        }
      })();
      const draftName = (activeDraft?.namaSiswa || '').trim().toLowerCase();
      const draftNis = (activeDraft?.nisNisn || '').trim();
      const draftId = activeDraft?.id || '';

      const isCurrentDeviceDeleted =
        (myName && (dSet.has(myName) || dSet.has(`${myName}_${myNis}`) || dSet.has(myNis) || dSet.has(`name_${myName}`))) ||
        (draftId && dSet.has(draftId)) ||
        (draftName && (dSet.has(draftName) || dSet.has(`${draftName}_${draftNis}`) || dSet.has(draftNis) || dSet.has(`name_${draftName}`)));

      if (isCurrentDeviceDeleted) {
        try {
          localStorage.removeItem('anbk_active_exam_draft_v1');
          localStorage.removeItem('anbk_exam_has_started');
          localStorage.removeItem('anbk_exam_in_progress');
          localStorage.removeItem('anbk_exam_has_completed');
          localStorage.removeItem('anbk_is_disqualified_v1');
          localStorage.removeItem('anbk_violations_count');
          localStorage.removeItem('anbk_violation_logs_v1');
          localStorage.removeItem('anbk_classroom_active_student_sync_v1');
          localStorage.removeItem('anbk_classroom_has_entered');
          localStorage.removeItem('anbk_device_synced_sub_id_v1');
          localStorage.removeItem('anbk_last_completed_submission_v1');
          localStorage.removeItem('anbk_student_profile_v1');
          localStorage.removeItem('anbk_submission_sync_queue_v2');
          localStorage.removeItem('anbk_unsaved_submissions_v1');
        } catch {}
        setHasStartedExam(false);
        setHasCompletedExam(false);
        setHasEnteredClassroom(false);
        setCompletedSubmission(null);
        setIsDisqualifiedResult(false);
        setNamaSiswa('');
        setNisNisn('');
        setAnswers({});
        setViolationCount(0);
        setViolationLogs([]);
        setView('HOME');
      }

      setSubmissions((prev) => {
        const next = prev.filter((s) => {
          const sId = s.id || '';
          const sName = (s.namaSiswa || '').trim().toLowerCase();
          const sNis = (s.nisNisn || '').trim();
          const sKey = getSubmissionUniqueKey(s);
          return (
            !dSet.has(sId) &&
            !dSet.has(sKey) &&
            !dSet.has(sName) &&
            !dSet.has(`${sName}_${sNis}`) &&
            !(sNis && sNis !== '-' && dSet.has(sNis))
          );
        });
        submissionsRef.current = next;
        try {
          localStorage.setItem('anbk_submissions_v1', JSON.stringify(next));
        } catch {}
        return next;
      });

      setClassroomStudents((prevCls) => {
        const nextCls = prevCls.filter((cs) => {
          const csName = (cs.namaSiswa || '').trim().toLowerCase();
          const csNis = (cs.nisNisn || '').trim();
          return (
            !dSet.has(cs.id) &&
            !dSet.has(csName) &&
            !dSet.has(`name_${csName}`) &&
            !(csNis && csNis !== '-' && (dSet.has(csNis) || dSet.has(`nis_${csNis}`))) &&
            !(csName && csNis && dSet.has(`${csName}_${csNis}`))
          );
        });
        try {
          localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextCls));
        } catch {}
        return nextCls;
      });
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        deletionBc = new BroadcastChannel('anbk_student_deletion_channel');
        deletionBc.onmessage = (ev) => {
          if (ev.data && Array.isArray(ev.data.deletedIds)) {
            processDeletionPayload(ev.data.deletedIds);
          }
        };
      }
    } catch {}

    const handleCustomDeletedBroadcast = (ev: Event) => {
      const detail = (ev as CustomEvent<{ deletedIds?: string[] }>).detail;
      if (detail && Array.isArray(detail.deletedIds)) {
        processDeletionPayload(detail.deletedIds);
      }
    };
    window.addEventListener('anbk-student-deleted-broadcast', handleCustomDeletedBroadcast);

    window.addEventListener('focus', handleFocusDashboard);
    document.addEventListener('visibilitychange', handleFocusDashboard);
    window.addEventListener('online', handleFocusDashboard);
    window.addEventListener('storage', handleStorageDashboard);
    window.addEventListener('anbk-new-exam-session-created', handleNewSessionEvent);
    window.addEventListener('anbk-submissions-reset-event', handleResetEvent);

    return () => {
      window.clearTimeout(initialTimer);
      unsubscribeFirestore();
      unsubscribeCloudCfg();
      clearInterval(pollDashboard);
      if (deletionBc) {
        deletionBc.close();
      }
      window.removeEventListener('anbk-student-deleted-broadcast', handleCustomDeletedBroadcast);
      window.removeEventListener('focus', handleFocusDashboard);
      document.removeEventListener('visibilitychange', handleFocusDashboard);
      window.removeEventListener('online', handleFocusDashboard);
      window.removeEventListener('storage', handleStorageDashboard);
      window.removeEventListener('anbk-new-exam-session-created', handleNewSessionEvent);
      window.removeEventListener('anbk-submissions-reset-event', handleResetEvent);
      window.removeEventListener(UNSAVED_SUBMISSIONS_SYNC_EVENT, handleUnsavedSynced);
    };
  }, [
    cloudConfig.googleSheetUrl,
    cloudConfig.tokenSheetUrl,
    cloudConfig.appsScriptWebAppUrl,
    handleSyncStudentDashboard,
  ]);

  // Auto-Connect & Auto-Sync saat Guru menempelkan / mengubah Link Google Sheets pada Panel Token Guru
  useEffect(() => {
    if (!isTeacherTokenUnlocked) return;
    const trimmed = tokenSheetUrlInput.trim();
    if (trimmed && isValidGoogleSheetOrScriptUrl(trimmed)) {
      if (trimmed === (cloudConfigRef.current.tokenSheetUrl || '').trim()) {
        return;
      }
      const timer = setTimeout(async () => {
        const res = await fetchTokenFromGoogleSheet(
          trimmed,
          cloudConfigRef.current.appsScriptWebAppUrl
        );
        const syncedTok =
          res.isSyncedFromSheet && res.token
            ? res.token
            : cloudConfigRef.current.customTeacherToken;
        const nextCfg: CloudIntegrationConfig = {
          ...cloudConfigRef.current,
          tokenSheetUrl: trimmed,
          googleSheetUrl: cloudConfigRef.current.googleSheetUrl || trimmed,
          customTeacherToken: syncedTok,
        };
        setCloudConfig(nextCfg);
        localStorage.setItem(
          'anbk_cloud_config_v1',
          JSON.stringify({ ...nextCfg, updatedAt: Date.now() })
        );
        if (syncedTok && syncedTok.length >= 3) {
          setIsSheetTokenSynced(true);
          setOnlineToken(syncedTok);
          setTeacherCustomTokenInput(syncedTok);
        }
        await saveCloudTokenConfigToServer(nextCfg);
      }, 350);
      return () => clearTimeout(timer);
    } else if (!trimmed && !cloudConfigRef.current.appsScriptWebAppUrl) {
      setIsSheetTokenSynced(false);
      setOnlineToken('');
      setInputToken('');
    }
  }, [tokenSheetUrlInput, isTeacherTokenUnlocked, handleSyncTokenFromSheet]);

  const handleUnlockTeacherToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherTokenPassInput === EXAM_INFO.teacherPassword) {
      setIsTeacherTokenUnlocked(true);
      setTeacherTokenPassInput('');
      setTeacherTokenPassError(null);
      setTeacherCustomTokenInput(onlineToken);
      setTokenSheetUrlInput(cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl || '');
    } else {
      setTeacherTokenPassError('Kode Akses / Password Guru tidak sesuai!');
    }
  };

  const handleSaveTeacherTokenAndSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSheetUrl = tokenSheetUrlInput.trim();
    const hasValidLink = isValidGoogleSheetOrScriptUrl(
      trimmedSheetUrl || cloudConfig.googleSheetUrl,
      cloudConfig.appsScriptWebAppUrl
    );

    if (!hasValidLink) {
      setIsSheetTokenSynced(false);
      setOnlineToken('');
      setInputToken('');
      setTokenSyncToast(
        'WAJIB mengisi Tautan Sinkronisasi (KODE TOKEN UJIAN) yang valid! Kode Token tidak akan ditampilkan jika belum tersinkron.'
      );
      setTimeout(() => setTokenSyncToast(null), 4500);
      return;
    }

    const cleanedToken = teacherCustomTokenInput
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);
    const didChangeCustomToken = cleanedToken.length >= 3 && cleanedToken !== onlineToken;

    let activeTok = cleanedToken.length >= 3 ? cleanedToken : onlineToken;

    if (!didChangeCustomToken) {
      const sheetRes = await fetchTokenFromGoogleSheet(
        trimmedSheetUrl,
        cloudConfig.appsScriptWebAppUrl
      );
      if (sheetRes.isSyncedFromSheet && sheetRes.token) {
        activeTok = sheetRes.token;
      }
    }

    const updatedCfg: CloudIntegrationConfig = {
      ...cloudConfig,
      customTeacherToken: activeTok || cloudConfig.customTeacherToken,
      lockTeacherToken: true,
      tokenSheetUrl: trimmedSheetUrl,
      googleSheetUrl: cloudConfig.googleSheetUrl || trimmedSheetUrl,
    };
    setCloudConfig(updatedCfg);
    localStorage.setItem(
      'anbk_cloud_config_v1',
      JSON.stringify({ ...updatedCfg, updatedAt: Date.now() })
    );

    if (activeTok && activeTok.length >= 3) {
      setIsSheetTokenSynced(true);
      setOnlineToken(activeTok);
      setTeacherCustomTokenInput(activeTok);
      setLastTokenSyncTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      pushTokenEventLocallyAndBroadcast(activeTok, 'Input Guru Aktif');
    }

    await saveCloudTokenConfigToServer(updatedCfg);

    if (activeTok && activeTok.length >= 3) {
      await pushTokenToGoogleSheet(
        activeTok,
        cloudConfig.appsScriptWebAppUrl,
        trimmedSheetUrl || cloudConfig.googleSheetUrl
      );
    }

    setIsTokenSyncCompletedAnimated(true);
    setTimeout(() => setIsTokenSyncCompletedAnimated(false), 7500);
    setTokenSyncToast(
      `✓ Selesai Sinkron Otomatis ke Semua Perangkat [KODE TOKEN UJIAN]: ${activeTok}`
    );
    setTimeout(() => setTokenSyncToast(null), 5000);
  };

  // Sinkronisasi Otomatis Soal Online Fase D saat Pilihan Kelas, Semester, Device, atau IP Siswa Berubah
  useEffect(() => {
    let cancelled = false;
    const effectiveKls = kelasSiswa || 'VIII-1';
    const jenjang = getJenjangFromKelas(effectiveKls);
    const safeSem = (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
    const pkgKey = getPackageKey(effectiveKls, safeSem);
    const meta = FASE_D_PACKAGE_META[pkgKey];

    setIsSyncingOnlineQuestions(true);
    fetchOnlineFaseDQuestions(
      jenjang,
      safeSem,
      cloudConfig.appsScriptWebAppUrl,
      true,
      {
        namaSiswa,
        nisNisn,
        kelas: effectiveKls,
        clientIp: effectiveClientIp,
        deviceFingerprint: effectiveDeviceFingerprint,
        deviceModel: effectiveDeviceModel,
      }
    ).then((res) => {
      if (cancelled) return;
      setOnlineQuestionSourceText(res.sourceLabel || meta.sumberOnline);
      if (res.questions && res.questions.length >= 15) {
        setQuestionBanks((prev) => {
          const next = { ...prev, [pkgKey]: res.questions };
          try {
            localStorage.setItem('anbk_question_banks_fase_d_v3', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      setIsSyncingOnlineQuestions(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    kelasSiswa,
    semesterSiswa,
    namaSiswa,
    nisNisn,
    effectiveClientIp,
    effectiveDeviceFingerprint,
    effectiveDeviceModel,
    cloudConfig.appsScriptWebAppUrl,
  ]);

  const handleManualFetchOnlineQuestions = async () => {
    const effectiveKls = kelasSiswa || 'VIII-1';
    const jenjang = getJenjangFromKelas(effectiveKls);
    const safeSem = (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
    const pkgKey = getPackageKey(effectiveKls, safeSem);
    const nextVar = !useOnlineVariationToggle;
    setUseOnlineVariationToggle(nextVar);
    setIsSyncingOnlineQuestions(true);
    try {
      const res = await fetchOnlineFaseDQuestions(
        jenjang,
        safeSem,
        cloudConfig.appsScriptWebAppUrl,
        true,
        {
          namaSiswa,
          nisNisn,
          kelas: effectiveKls,
          clientIp: effectiveClientIp,
          deviceFingerprint: `${effectiveDeviceFingerprint}-${Date.now()}`,
          deviceModel: effectiveDeviceModel,
        }
      );
      setOnlineQuestionSourceText(res.sourceLabel);
      setQuestionBanks((prev) => {
        const updated = { ...prev, [pkgKey]: res.questions };
        try {
          localStorage.setItem('anbk_question_banks_fase_d_v3', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setIsOnlineQuestionsSyncAnimated(true);
      setTimeout(() => setIsOnlineQuestionsSyncAnimated(false), 7000);
    } finally {
      setIsSyncingOnlineQuestions(false);
    }
  };

  // Modal Login Mode Guru (Password 31051990 tidak ditampilkan)
  const [showTeacherModal, setShowTeacherModal] = useState<boolean>(false);
  const [teacherPasswordInput, setTeacherPasswordInput] = useState<string>('');
  const [teacherPasswordError, setTeacherPasswordError] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Modal Pilihan Data Sinkronisasi (Tanggal, Bulan, Tahun)
  const [showSyncDateModal, setShowSyncDateModal] = useState<boolean>(false);

  // State Saat Ujian Berlangsung
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [isRetakeSession, setIsRetakeSession] = useState<boolean>(false);
  const [isRemedialSession, setIsRemedialSession] = useState<boolean>(false);
  const [remedialActiveMeta, setRemedialActiveMeta] = useState<{
    packageTitle: string;
    difficultyMode: 'REGULER' | 'BALANCED' | 'HOTS';
    targetElements: string[];
    originalScore: number;
    questionCount: number;
  } | null>(null);
  const [retakeAttemptCount, setRetakeAttemptCount] = useState<number>(0);
  const [activeRetakePreviouslySeenCount, setActiveRetakePreviouslySeenCount] = useState<number>(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [questionSlideDirection, setQuestionSlideDirection] = useState<'next' | 'prev'>('next');
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [doubtful, setDoubtful] = useState<Record<number, boolean>>({});
  const [questionDurations, setQuestionDurations] = useState<Record<number, number>>({});
  const [examSecondsLeft, setExamSecondsLeft] = useState<number>(EXAM_INFO.durasiDetik);
  const [fontSizeScale, setFontSizeScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);
  const [isSelfEvalLocked, setIsSelfEvalLocked] = useState<boolean>(false);
  const [examSidebarTab, setExamSidebarTab] = useState<'ALL' | 'DOUBTFUL'>('ALL');

  // State Anti-Cheating
  const [violationCount, setViolationCount] = useState<number>(0);
  const [violationLogs, setViolationLogs] = useState<string[]>([]);
  const [redWarningOverlay, setRedWarningOverlay] = useState<boolean>(false);
  const [warningCountdown, setWarningCountdown] = useState<number>(15);
  const [warningReasonText, setWarningReasonText] = useState<string>('');
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [isSplitScreenDetected, setIsSplitScreenDetected] = useState<boolean>(false);
  const [showScreenshotShield, setShowScreenshotShield] = useState<boolean>(false);
  const [screenshotShieldReason, setScreenshotShieldReason] = useState<string>('');
  const [isCurrentlyFullscreen, setIsCurrentlyFullscreen] = useState<boolean>(false);
  const [liveForensicClock, setLiveForensicClock] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Data Draft Ujian Siswa Aktif yang sedang berjalan (untuk Live Monitoring Pengawas/Guru)
  const activeExamDraft = useMemo<StudentSubmission | null>(() => {
    if (view !== 'EXAM' && !namaSiswa) return null;
    const isEssay = jenisSoalUjian === 'ESAY_TEST';
    const totalQ = isEssay ? 15 : (questions.length || 25);
    const durasi = Math.max(0, EXAM_INFO.durasiDetik - (examSecondsLeft || 0));

    return {
      id: 'DRAFT-' + (nisNisn || 'ACTIVE'),
      timestamp: new Date().toISOString(),
      namaSiswa: namaSiswa || 'Peserta Ujian Aktif',
      nisNisn: nisNisn || '-',
      kelas: kelasSiswa || 'VIII-1',
      semester: (semesterSiswa as any) || 'Ganjil',
      skorBenar: 0,
      totalSoal: totalQ,
      nilaiAkhir: 0,
      statusKecurangan:
        violationCount > 0
          ? `Terdeteksi ${violationCount} Pelanggaran`
          : 'Mengerjakan Tertib (Aman)',
      lulusTidakLulus: 'Sedang Berlangsung',
      answers: answers as any,
      doubtful: doubtful || {},
      questionOrder: questions.map((q) => q.id),
      isCompleted: false,
      violationCount,
      violationLogs,
      deviceCategory: detectedDevice.deviceCategory,
      deviceBrand: detectedDevice.brand,
      deviceModel: effectiveDeviceModel,
      clientIp: effectiveClientIp,
      batteryHistory: batteryHistory,
    };
  }, [
    view,
    namaSiswa,
    nisNisn,
    kelasSiswa,
    semesterSiswa,
    jenisSoalUjian,
    questions.length,
    examSecondsLeft,
    answers,
    violationCount,
    violationLogs,
    detectedDevice,
    effectiveDeviceModel,
    effectiveClientIp,
    batteryState,
  ]);

  useEffect(() => {
    const handleTestEvent = (e: any) => {
      const label = e?.detail?.label || 'Uji Coba Sensor Anti-Screenshot Lintas Perangkat';
      document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      setScreenshotShieldReason(label);
      setShowScreenshotShield(true);
      try {
        navigator.clipboard?.writeText?.('');
      } catch {}
      setTimeout(() => {
        setShowScreenshotShield(false);
        document.documentElement.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
        document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
      }, 2500);
    };
    window.addEventListener('anbk-test-screenshot-shield', handleTestEvent);
    return () => window.removeEventListener('anbk-test-screenshot-shield', handleTestEvent);
  }, []);

  useEffect(() => {
    if (view !== 'EXAM') return;
    const ticker = setInterval(() => {
      setLiveForensicClock(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(ticker);
  }, [view]);

  // State Efek Suara Notifikasi (Audio Cue) & Kontrol Mute
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => {
    return localStorage.getItem('anbk_audio_muted') === 'true';
  });
  const isAudioMutedRef = useRef<boolean>(isAudioMuted);
  isAudioMutedRef.current = isAudioMuted;
  const audioCtxRef = useRef<AudioContext | null>(null);

  const toggleAudioMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      isAudioMutedRef.current = next;
      localStorage.setItem('anbk_audio_muted', String(next));
      return next;
    });
  }, []);

  const playAudioCue = useCallback(
    (type: 'answer' | 'violation' | 'timer-warning-5min' | 'timer-warning-1min' | 'exam-complete') => {
      if (isAudioMutedRef.current) return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        if (type === 'answer') {
          // Nada konfirmasi unik & informatif dua tingkat harmonis (D5 -> A5 + overtone D6 lembut) saat siswa menjawab soal
          const tones = [
            { freq: 587.33, offset: 0, duration: 0.08, type: 'sine' as OscillatorType, peak: 0.16 }, // D5
            { freq: 880.0, offset: 0.065, duration: 0.14, type: 'triangle' as OscillatorType, peak: 0.18 }, // A5
            { freq: 1174.66, offset: 0.075, duration: 0.12, type: 'sine' as OscillatorType, peak: 0.08 }, // D6 harmonic
          ];
          tones.forEach(({ freq, offset, duration, type: oscType, peak }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = oscType;
            osc.frequency.setValueAtTime(freq, now + offset);

            gain.gain.setValueAtTime(0.001, now + offset);
            gain.gain.exponentialRampToValueAtTime(peak, now + offset + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + duration + 0.01);
          });
        } else if (type === 'violation') {
          // Nada alarm peringatan tegas & informatif (tritone sirene 3 ketukan cepat + modulasi frekuensi) saat terdeteksi pelanggaran
          const alarmSteps = [
            { startFreq: 932.33, endFreq: 880.0, offset: 0, duration: 0.14 }, // A#5 -> A5
            { startFreq: 622.25, endFreq: 587.33, offset: 0.15, duration: 0.14 }, // D#5 -> D5
            { startFreq: 932.33, endFreq: 622.25, offset: 0.30, duration: 0.22 }, // A#5 -> D#5 sweep
          ];
          alarmSteps.forEach(({ startFreq, endFreq, offset, duration }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(startFreq, now + offset);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + offset + duration);

            gain.gain.setValueAtTime(0.001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + duration + 0.01);
          });
        } else if (type === 'timer-warning-5min') {
          // Nada Peringatan Suara Timer 5 Menit: Tiga nada berjenjang harmonis (F5 -> A5 -> C6) ramah & informatif
          const notes = [698.46, 880.0, 1046.5]; // F5, A5, C6
          notes.forEach((freq, idx) => {
            const offset = idx * 0.16;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + offset);

            gain.gain.setValueAtTime(0.001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.24, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.24);
          });
        } else if (type === 'timer-warning-1min') {
          // Nada Peringatan Suara Kritis Timer 1 Menit: Pola alarm pulsa ganda tajam (880Hz / 1174Hz) 4 ketukan cepat
          const pulses = [
            { freq: 880, offset: 0 },
            { freq: 1174.66, offset: 0.13 },
            { freq: 880, offset: 0.30 },
            { freq: 1174.66, offset: 0.43 },
          ];
          pulses.forEach(({ freq, offset }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + offset);

            gain.gain.setValueAtTime(0.001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.28, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.12);
          });
        } else if (type === 'exam-complete') {
          // Nada selebrasi kemenangan harmonis 4 nada naik (C5 -> E5 -> G5 -> C6) saat siswa berhasil menyelesaikan & mengumpulkan ujian
          const fanfare = [
            { freq: 523.25, offset: 0, duration: 0.14 }, // C5
            { freq: 659.25, offset: 0.11, duration: 0.14 }, // E5
            { freq: 783.99, offset: 0.22, duration: 0.16 }, // G5
            { freq: 1046.5, offset: 0.35, duration: 0.38 }, // C6
          ];
          fanfare.forEach(({ freq, offset, duration }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + offset);

            gain.gain.setValueAtTime(0.001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + duration + 0.01);
          });
        }
      } catch (e) {
        // Abaikan jika browser memblokir autoplay audio sebelum interaksi
      }
    },
    []
  );

  // Flag & State Peringatan Audio Timer Ujian (5 Menit & 1 Menit Tersisa)
  const hasWarned5MinRef = useRef<boolean>(false);
  const hasWarned1MinRef = useRef<boolean>(false);
  const [timerWarningAlert, setTimerWarningAlert] = useState<{
    type: '5min' | '1min';
    message: string;
    secondsRemaining: number;
  } | null>(null);

  useEffect(() => {
    if (!timerWarningAlert) return;
    const t = setTimeout(() => {
      setTimerWarningAlert(null);
    }, 9000);
    return () => clearTimeout(t);
  }, [timerWarningAlert]);

  // Status Penguncian Khusus Identitas Siswa (Nama Lengkap, NIS/NISN, Kelas, Semester): TIDAK BISA DI EDIT setelah memulai ujian, selesai ujian, maupun masuk ke menu Classroom
  const [hasStartedExam, setHasStartedExam] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('anbk_exam_has_started') === 'true' ||
      localStorage.getItem('anbk_exam_in_progress') === 'true'
    );
  });
  const [hasCompletedExam, setHasCompletedExam] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('anbk_exam_has_completed') === 'true';
  });
  const [hasEnteredClassroom, setHasEnteredClassroom] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('anbk_classroom_has_entered') === 'true';
  });

  useEffect(() => {
    if (view === 'DESIGN_CLASSROOM') {
      try {
        localStorage.setItem('anbk_classroom_has_entered', 'true');
      } catch {}
      setHasEnteredClassroom(true);
    }
  }, [view]);

  // Fitur penguncian identitas dinonaktifkan sesuai permintaan pengguna (bebas diedit tanpa terkunci)
  const isIdentityLocked = false;
  const identityLockReason = '';
  const [notificationStatus, setNotificationStatus] = useState<{
    emailStatus: string;
    waStatus: string;
  }>({
    emailStatus: 'Siap Dikirim ke eksayudikasirait@gmail.com',
    waStatus: 'Siap Dikirim (Klik Tombol Kirim Hasil ke WhatsApp)',
  });

  // State Otentikasi Google (Gmail API Resmi) & Modal Konfirmasi Pengiriman Email
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [hasGmailToken, setHasGmailToken] = useState<boolean>(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [gmailConfirmPayload, setGmailConfirmPayload] =
    useState<GmailSendAttachmentsPayload | null>(null);
  const [isSendingGmailApi, setIsSendingGmailApi] = useState<boolean>(false);
  const [gmailSendError, setGmailSendError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUserEmail(user.email || 'Terhubung');
        setHasGmailToken(true);
      },
      () => {
        setGoogleUserEmail(null);
        setHasGmailToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLoginClick = async () => {
    setIsSigningInGoogle(true);
    setGmailSendError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUserEmail(res.user?.email || 'Terhubung');
        setHasGmailToken(true);
        if (gmailConfirmPayload) {
          await sendEmailWithJpgAndPdfViaGmailApi(res.accessToken, gmailConfirmPayload);
          setNotificationStatus((prev) => ({
            ...prev,
            emailStatus: `SUKSES TERKIRIM OTOMATIS via Gmail API ke ${EXAM_INFO.teacherEmail} (JPG & PDF Terlampir)`,
          }));
          setGmailConfirmPayload(null);
        }
      }
    } catch (err) {
      console.error('Google Sign-In gagal:', err);
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleConfirmSendGmailApi = async () => {
    if (!gmailConfirmPayload) return;
    setIsSendingGmailApi(true);
    setGmailSendError(null);
    try {
      let token = getAccessTokenSync();
      if (!token) {
        const loginRes = await googleSignIn();
        if (!loginRes?.accessToken) {
          throw new Error('Izin akses Gmail diperlukan untuk mengirim email.');
        }
        token = loginRes.accessToken;
        setGoogleUserEmail(loginRes.user?.email || 'Terhubung');
        setHasGmailToken(true);
      }

      await sendEmailWithJpgAndPdfViaGmailApi(token, gmailConfirmPayload);
      setNotificationStatus((prev) => ({
        ...prev,
        emailStatus: `SUKSES TERKIRIM OTOMATIS via Gmail API ke ${EXAM_INFO.teacherEmail} (JPG & PDF Terlampir)`,
      }));
      setGmailConfirmPayload(null);
    } catch (err: any) {
      console.error('Gmail API send error:', err);
      setGmailSendError(
        err?.message || 'Gagal mengirim via Gmail API. Silakan coba lagi.'
      );
    } finally {
      setIsSendingGmailApi(false);
    }
  };

  // Refs untuk akses terbaru di dalam event listener
  const viewRef = useRef<AppView>(view);
  viewRef.current = view;
  const violationCountRef = useRef<number>(violationCount);
  violationCountRef.current = violationCount;
  const violationLogsRef = useRef<string[]>(violationLogs);
  violationLogsRef.current = violationLogs;
  const lastViolationTimeRef = useRef<number>(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const doubtfulRef = useRef(doubtful);
  doubtfulRef.current = doubtful;
  const questionDurationsRef = useRef<Record<number, number>>(questionDurations);
  questionDurationsRef.current = questionDurations;
  const currentQuestionIndexRef = useRef<number>(currentQuestionIndex);
  currentQuestionIndexRef.current = currentQuestionIndex;
  const shuffledQuestionsRef = useRef(shuffledQuestions);
  shuffledQuestionsRef.current = shuffledQuestions;
  const activeSessionIdRef = useRef<string>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  // Baseline dimensi layar untuk deteksi belah layar (Split Screen)
  const initialViewportRef = useRef<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Fungsi Cek Apakah Layar Terbelah (Split-Screen pada Android/iPhone/Laptop/Chromebook)
  // Menggunakan modul presisi dengan pemantauan orientasi layar (Portrait vs Landscape) real-time
  const detectSplitScreenMode = useCallback((): boolean => {
    return evaluatePrecisionSplitScreen().isSplitScreen;
  }, []);

  // Fungsi Mengunci Layar Penuh Otomatis pada Semua Platform (Laptop/PC, Chromebook, Android, iPhone)
  const requestAllPlatformFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as any;
      const isIOSDevice =
        /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (el) {
        document.documentElement.classList.add('ios-fullscreen-immersive');
      }

      if (isIOSDevice && window.scrollY === 0) {
        window.scrollTo(0, 1);
      }

      const alreadyFs = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement ||
          (window.navigator as any)?.standalone ||
          window.matchMedia?.('(display-mode: fullscreen)')?.matches
      );

      if (!alreadyFs && el) {
        if (el.requestFullscreen) {
          try {
            await el.requestFullscreen({ navigationUI: 'hide' });
          } catch {
            await el.requestFullscreen();
          }
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.webkitEnterFullscreen) {
          await el.webkitEnterFullscreen();
        } else if (el.mozRequestFullScreen) {
          await el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
      }

      if ((navigator as any).keyboard?.lock) {
        (navigator as any).keyboard.lock(['Escape']).catch(() => {});
      }
      if ((navigator as any).wakeLock?.request) {
        (navigator as any).wakeLock.request('screen').catch(() => {});
      }

      setIsCurrentlyFullscreen(true);
    } catch {
      // Fallback mode imersif penuh untuk iPhone / iOS Safari, Android WebView, atau lingkungan tersemat
      document.documentElement.classList.add('ios-fullscreen-immersive');
      setIsCurrentlyFullscreen(true);
    }
  }, []);

  // Otomatis Lock Full Screen & Penguncian Otomatis Berkelanjutan (Auto Re-Lock) Lintas Platform (Laptop/PC, Chromebook, Android, iPhone) Tanpa Tombol Klik
  useEffect(() => {
    const checkIsFullscreenActive = (): boolean => {
      return Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement ||
          (window.navigator as any)?.standalone ||
          window.matchMedia?.('(display-mode: fullscreen)')?.matches
      );
    };

    let lastFsAttemptTime = 0;
    const handleAutoLockFullscreen = () => {
      document.documentElement.classList.add('ios-fullscreen-immersive');
      if (checkIsFullscreenActive()) {
        setIsCurrentlyFullscreen((prev) => (prev ? prev : true));
        return;
      }
      // Hanya paksa requestFullscreen berulang saat sedang ujian (EXAM) atau dengan jeda minimal 2.5 detik agar klik tombol menu terasa sangat ringan & tidak lag
      const now = Date.now();
      if (now - lastFsAttemptTime < 2500) return;
      lastFsAttemptTime = now;
      requestAllPlatformFullscreen();
    };

    const handleFullscreenStateChange = () => {
      if (!checkIsFullscreenActive()) {
        window.setTimeout(() => {
          requestAllPlatformFullscreen();
        }, 50);
      } else {
        setIsCurrentlyFullscreen((prev) => (prev ? prev : true));
      }
    };

    // 1. Aktifkan Full Screen langsung saat halaman/link dibuka di browser
    handleAutoLockFullscreen();
    const initialTimer1 = window.setTimeout(() => handleAutoLockFullscreen(), 100);
    const initialTimer2 = window.setTimeout(() => handleAutoLockFullscreen(), 400);
    const initialTimer3 = window.setTimeout(() => handleAutoLockFullscreen(), 1000);

    // 2. Penguncian Otomatis Berkelanjutan pada event klik/sentuh utama (tanpa mousemove/scroll terus-menerus agar tidak membebani CPU)
    const activityEvents = [
      'pointerdown',
      'touchstart',
      'click',
      'keydown',
    ];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleAutoLockFullscreen, { capture: true, passive: true });
    });

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        handleAutoLockFullscreen();
      }
    };

    document.addEventListener('DOMContentLoaded', handleAutoLockFullscreen);
    window.addEventListener('load', handleAutoLockFullscreen);
    window.addEventListener('pageshow', handleAutoLockFullscreen);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    document.addEventListener('fullscreenchange', handleFullscreenStateChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenStateChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenStateChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenStateChange);

    return () => {
      window.clearTimeout(initialTimer1);
      window.clearTimeout(initialTimer2);
      window.clearTimeout(initialTimer3);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleAutoLockFullscreen, { capture: true });
      });
      document.removeEventListener('DOMContentLoaded', handleAutoLockFullscreen);
      window.removeEventListener('load', handleAutoLockFullscreen);
      window.removeEventListener('pageshow', handleAutoLockFullscreen);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenStateChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenStateChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenStateChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenStateChange);
    };
  }, [requestAllPlatformFullscreen]);

  // Fungsi membuat objek StudentSubmission sesuai struktur kolom Google Sheet
  const buildSubmissionRecord = useCallback(
    (
      overrideStatusCurang?: string,
      forceDisqualify?: boolean,
      customViolationCount?: number,
      customViolationLogs?: string[]
    ): StudentSubmission => {
      const activeQs =
        shuffledQuestionsRef.current.length > 0 ? shuffledQuestionsRef.current : questions;
      const currentAns = answersRef.current;

      let benar = 0;
      activeQs.forEach((q) => {
        if (currentAns[q.id] === q.answer) {
          benar++;
        }
      });

      const total = activeQs.length;
      const rawScore = total > 0 ? Math.round((benar / total) * 100) : 0;
      const finalScore = forceDisqualify ? rawScore : rawScore;
      const vCount = customViolationCount ?? violationCountRef.current;
      const vLogs = customViolationLogs ?? violationLogsRef.current;

      const statusKecurangan =
        overrideStatusCurang ||
        (vCount > 0
          ? `Terdeteksi ${vCount}x Pelanggaran (${vLogs.join(' | ')})`
          : 'Tidak Ada Kecurangan (Jujur / Bersih)');

      const isProgress = !overrideStatusCurang ? false : (
        overrideStatusCurang.toLowerCase().includes('sedang mengerjakan') ||
        overrideStatusCurang.toLowerCase().includes('sudah login') ||
        overrideStatusCurang.toLowerCase().includes('masuk ruang')
      );
      const isPassed = !forceDisqualify && finalScore >= EXAM_INFO.kkm;
      const lulusTidakLulus = isProgress
        ? 'SEDANG BERLANGSUNG'
        : isPassed
        ? (isRemedialSession ? 'Lulus Ujian (Tuntas Remedial)' : 'Lulus Ujian')
        : (isRemedialSession ? 'Tidak Lulus Ujian (Remedial Belum Tuntas)' : 'Tidak Lulus Ujian (Ujian Susulan)');

      const nowStr = new Date().toLocaleString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      return {
        id: activeSessionIdRef.current || activeSessionId || `SUB-${Date.now()}`,
        timestamp: nowStr,
        namaSiswa: namaSiswa.trim(),
        nisNisn: nisNisn.trim(),
        kelas: getCleanKelas(kelasSiswa),
        semester: semesterSiswa || 'Ganjil',
        skorBenar: benar,
        totalSoal: total,
        nilaiAkhir: finalScore,
        statusKecurangan,
        lulusTidakLulus,
        answers: { ...currentAns },
        doubtful: { ...doubtfulRef.current },
        questionDurations: { ...questionDurationsRef.current },
        batteryHistory: [...batteryHistoryRef.current],
        violationCount: vCount,
        violationLogs: [...vLogs],
        questionOrder: activeQs.map((q) => q.id),
        isCompleted: false,
        deviceCategory: detectedDevice.deviceCategory,
        deviceBrand: detectedDevice.brand,
        deviceModel: effectiveDeviceModel,
        deviceOsBrowser: `${detectedDevice.osNameVersion} · ${detectedDevice.browserName}`,
        deviceInfo: effectiveDeviceSummary,
        clientIp: effectiveClientIp,
        deviceFingerprint: effectiveDeviceFingerprint,
        photoUrl:
          studentPhotoUrl ||
          getPhotoForStudentIdentity(namaSiswa, nisNisn) ||
          loadStoredStudentProfile().photoDataUrl ||
          undefined,
        usedToken:
          activeExamTokenRef.current || sanitizeTokenValue(inputToken) || undefined,
      };
    },
    [
      activeSessionId,
      kelasSiswa,
      semesterSiswa,
      namaSiswa,
      nisNisn,
      questions,
      detectedDevice,
      effectiveDeviceModel,
      effectiveDeviceSummary,
      studentPhotoUrl,
    ]
  );

  // Fungsi Sinkronisasi Otomatis Fitur Login (Deteksi Perangkat / Device, Foto Kamera / FOTO & Identitas Siswa) ke Link Google Sheets (13 Kolom)
  const handleSyncLoginFeaturesToGoogleSheets = useCallback(
    async (
      isManualTrigger: boolean = false,
      overrideProfile?: {
        namaSiswa?: string;
        nisNisn?: string;
        kelasSiswa?: string;
        semesterSiswa?: 'Ganjil' | 'Genap';
        photoUrl?: string;
      },
      triggerSource: 'rekap' | 'device' | 'photo' | 'routine_5min' | 'login_masuk' = 'rekap',
      dateFilter?: SyncDateFilter,
      explicitFilteredSubs?: StudentSubmission[]
    ) => {
      const now = Date.now();

      // 1. Mekanisme Anti-Concurrency: cegah proses yang tumpang tindih
      if (isSyncInProgressRef.current) {
        return;
      }

      // 2. Mekanisme Throttle: minimal 2.5 detik jeda waktu antar eksekusi manual untuk mencegah klik impulsif berulang
      if (isManualTrigger && now - lastSyncTimestampRef.current < 2500) {
        return;
      }

      // 3. Batasi sinkronisasi ke Google Sheets & Cloud:
      // HANYA sinkronkan jika:
      // a) Pengguna sengaja menekan tombol sinkron (isManualTrigger === true), ATAU
      // b) Interval timer rutin 5 menit tercapai (triggerSource === 'routine_5min'), ATAU
      // c) Siswa baru login & masuk ke ruang ujian komputer (triggerSource === 'login_masuk' atau 'rekap')
      if (!isManualTrigger && triggerSource !== 'routine_5min' && triggerSource !== 'login_masuk' && triggerSource !== 'rekap') {
        const targetNama = (overrideProfile?.namaSiswa ?? namaSiswa).trim();
        const targetNis = (overrideProfile?.nisNisn ?? nisNisn).trim();
        const targetKelas = getCleanKelas(overrideProfile?.kelasSiswa ?? kelasSiswa);
        const targetSemester = overrideProfile?.semesterSiswa ?? semesterSiswa;
        const targetPhoto =
          overrideProfile?.photoUrl ??
          studentPhotoUrl ??
          getPhotoForStudentIdentity(targetNama, targetNis) ??
          '';

        saveStoredStudentProfile({
          namaSiswa: targetNama,
          nisNisn: targetNis,
          kelasSiswa: targetKelas,
          semesterSiswa: targetSemester,
          photoDataUrl: targetPhoto,
        });
        return;
      }

      isSyncInProgressRef.current = true;
      lastSyncTimestampRef.current = now;

      if (isManualTrigger) {
        userInteractedSyncRef.current = true;
        setHasUserInteractedSync(true);
        setIsSyncingLoginSheet(true);
        setSyncTriggerSource(triggerSource);
      }
      try {
        const targetNama = (overrideProfile?.namaSiswa ?? namaSiswa).trim();
        const targetNis = (overrideProfile?.nisNisn ?? nisNisn).trim();
        const targetKelas = getCleanKelas(overrideProfile?.kelasSiswa ?? kelasSiswa);
        const targetSemester = overrideProfile?.semesterSiswa ?? semesterSiswa;
        const targetPhoto =
          overrideProfile?.photoUrl ??
          studentPhotoUrl ??
          getPhotoForStudentIdentity(targetNama, targetNis) ??
          '';

        const liveCat = detectedDevice.deviceCategory;
        const liveBrand = detectedDevice.brand;
        const liveModel = effectiveDeviceModel;
        const liveOsBrowser = `${detectedDevice.osNameVersion} · ${detectedDevice.browserName}`;
        const liveSummary = effectiveDeviceSummary;

        // Simpan profil lokal & dorong ke server (/student-dashboard-sync action: syncStudentProfile)
        saveStoredStudentProfile({
          namaSiswa: targetNama,
          nisNisn: targetNis,
          kelasSiswa: targetKelas,
          semesterSiswa: targetSemester,
          photoDataUrl: targetPhoto,
        });

        const studentProfilePayload = {
          namaSiswa: targetNama || 'Peserta Ujian ANBK',
          nisNisn: targetNis || '-',
          kelas: targetKelas || 'VIII-1',
          kelasSiswa: targetKelas || 'VIII-1',
          semester: targetSemester || 'Ganjil',
          semesterSiswa: targetSemester || 'Ganjil',
          deviceCategory: liveCat,
          deviceBrand: liveBrand,
          deviceModel: liveModel,
          deviceOsBrowser: liveOsBrowser,
          deviceInfo: liveSummary,
          photoUrl: targetPhoto || undefined,
          updatedAt: Date.now(),
        };

        fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'syncStudentProfile',
            profile: studentProfilePayload,
            studentProfile: studentProfilePayload,
          }),
        }).catch(() => {});

        // 2. HANYA kumpulkan data riwayat ujian AKTIF yang memang ada pada sistem saat ini (submissionsRef.current)
        // DILARANG memulihkan atau menyinkronkan data lama yang sudah dihapus atau lama direset sistem!
        const isCurrentCleared =
          typeof window !== 'undefined' &&
          localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
        const currentClearedAt =
          typeof window !== 'undefined'
            ? Number(localStorage.getItem('anbk_submissions_cleared_at_v1') || 0)
            : 0;
        const currentDelSet = new Set<string>();
        try {
          const rawDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
          if (rawDel) {
            JSON.parse(rawDel).forEach((k: string) => {
              if (k) currentDelSet.add(k);
            });
          }
        } catch {}

        const isSubActiveAndValid = (s: StudentSubmission) => {
          if (!s || !s.namaSiswa) return false;
          const k = s.id || getSubmissionUniqueKey(s);
          const uKey = getSubmissionUniqueKey(s);
          if (currentDelSet.has(s.id) || currentDelSet.has(k) || currentDelSet.has(uKey)) return false;
          if (currentClearedAt > 0) {
            const matchTs = (s.id || '').match(/^(?:SUB|ESAY)-(\d+)/);
            const createdTs = matchTs ? Number(matchTs[1]) : 0;
            if (createdTs > 0 && createdTs <= currentClearedAt) return false;
          }
          return true;
        };

        const unifiedMap = new Map<string, StudentSubmission>();

        // a. Hanya ambil dari state aktif sistem saat ini jika tidak sedang direset
        if (!isCurrentCleared || submissionsRef.current.length > 0) {
          submissionsRef.current.forEach((s) => {
            if (isSubActiveAndValid(s)) {
              const k = s.id || getSubmissionUniqueKey(s);
              unifiedMap.set(k, s);
            }
          });
        }

        // b. Hasil ujian yang baru saja diselesaikan di perangkat ini (hanya jika valid & dibuat setelah reset)
        if (completedSubmission && isSubActiveAndValid(completedSubmission)) {
          const k = completedSubmission.id || getSubmissionUniqueKey(completedSubmission);
          unifiedMap.set(k, completedSubmission);
        }

        const currentList = deduplicateSubmissions(Array.from(unifiedMap.values()));
        let matchedAny = false;

        const updatedList = currentList.map((s) => {
          const sameName =
            targetNama &&
            targetNama.length >= 3 &&
            targetNama.toLowerCase() !== 'peserta ujian anbk' &&
            s.namaSiswa.trim().toLowerCase() === targetNama.toLowerCase();
          const sameNis =
            targetNis &&
            targetNis.length >= 3 &&
            targetNis !== '0' &&
            targetNis !== '-' &&
            s.nisNisn.trim().toLowerCase() === targetNis.toLowerCase();
          const storedPhotoForSub = getPhotoForStudentIdentity(s.namaSiswa, s.nisNisn);

          if (sameName || sameNis) {
            matchedAny = true;
            return {
              ...s,
              namaSiswa:
                targetNama && targetNama.toLowerCase() !== 'peserta ujian anbk'
                  ? targetNama
                  : s.namaSiswa,
              nisNisn: targetNis && targetNis !== '0' && targetNis !== '-' ? targetNis : s.nisNisn,
              kelas: targetKelas || s.kelas,
              semester: targetSemester || s.semester,
              deviceCategory: liveCat,
              deviceBrand: liveBrand,
              deviceModel: liveModel,
              deviceOsBrowser: liveOsBrowser,
              deviceInfo: liveSummary,
              photoUrl: targetPhoto || storedPhotoForSub || s.photoUrl || undefined,
            };
          }
          if (storedPhotoForSub && !s.photoUrl) {
            return {
              ...s,
              photoUrl: storedPhotoForSub,
            };
          }
          return s;
        });

        // JIKA SISWA BARU LOGIN & BELUM ADA RECORD-NYA, OTOMATIS TAMBAHKAN RECORD LOGIN KE DAFTAR SISTEM!
        if (
          !matchedAny &&
          targetNama &&
          targetNama.length >= 3 &&
          targetNama.toLowerCase() !== 'peserta ujian anbk'
        ) {
          const loginNowStr = new Date().toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const newStudentLoginSub: StudentSubmission = {
            id: `SUB-LOGIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: loginNowStr,
            namaSiswa: targetNama,
            nisNisn: targetNis || '0',
            kelas: getCleanKelas(targetKelas || 'VIII-1'),
            semester: (targetSemester || 'Ganjil') as 'Ganjil' | 'Genap',
            skorBenar: 0,
            totalSoal: 25,
            nilaiAkhir: 0,
            statusKecurangan: 'SUDAH LOGIN / MASUK RUANG UJIAN',
            lulusTidakLulus: 'SEDANG BERLANGSUNG',
            answers: {},
            doubtful: {},
            questionDurations: {},
            violationCount: 0,
            violationLogs: [],
            questionOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            isCompleted: false,
            deviceCategory: liveCat,
            deviceBrand: liveBrand,
            deviceModel: liveModel,
            deviceOsBrowser: liveOsBrowser,
            deviceInfo: liveSummary,
            photoUrl: targetPhoto || getPhotoForStudentIdentity(targetNama, targetNis) || undefined,
            usedToken: activeExamTokenRef.current || inputToken || undefined,
            clientIp: effectiveClientIp,
            deviceFingerprint: effectiveDeviceFingerprint,
          };
          updatedList.unshift(newStudentLoginSub);
          pushSubmissionToServer(newStudentLoginSub);
        }

        // Simpan selalu ke state utama & localStorage
        const cleanUpdatedList = deduplicateSubmissions(updatedList);
        setSubmissions(cleanUpdatedList);
        submissionsRef.current = cleanUpdatedList;
        try {
          localStorage.setItem('anbk_submissions_v1', JSON.stringify(cleanUpdatedList));
          if (cleanUpdatedList.length === 0 && isCurrentCleared) {
            localStorage.setItem('anbk_submissions_cleared_v1', 'true');
          }
        } catch {
          // ignore
        }

        const fsCfg = await readFirestoreCloudConfig(true).catch(() => null);
        const cfg = cloudConfigRef.current;
        const targetSheet = sanitizeRekapSheetUrl(fsCfg?.googleSheetUrl || cfg.googleSheetUrl);
        const targetScript = fsCfg?.appsScriptWebAppUrl || cfg.appsScriptWebAppUrl || '';
        const activeTok =
          getAccessTokenSync() ||
          (fsCfg?.oauthAccessToken && (!fsCfg.oauthExpiresAt || fsCfg.oauthExpiresAt > Date.now())
            ? fsCfg.oauthAccessToken
            : '') ||
          '';

        // Jika ada filter tanggal/bulan/tahun tertentu, saring list data yang disinkronkan ke Google Sheets
        const listToSync =
          dateFilter && dateFilter.mode !== 'ALL'
            ? explicitFilteredSubs && explicitFilteredSubs.length > 0
              ? explicitFilteredSubs
              : cleanUpdatedList.filter((s) => isSubmissionMatchingSyncFilter(s, dateFilter))
            : cleanUpdatedList;

        const rankMapForSync = computeSubmissionRankingMap(listToSync);
        const rows13Cols = listToSync.map((s, idx) => {
          const rnk = rankMapForSync[s.id] || rankMapForSync[getSubmissionUniqueKey(s)] || idx + 1;
          return formatSubmissionToRekap13ColumnsWithRank(s, rnk);
        });

        // Sinkronkan otomatis ke Server Lintas Perangkat, Cloud Firestore, Antrean, dan Link Google Sheets Rekap Hasil Ujian secara simultan
        await Promise.allSettled([
          saveAllSubmissionsToServer(listToSync, targetSheet, targetScript),
          syncSubmissionsToGoogleSheetsAuto(
            listToSync,
            targetSheet,
            targetScript,
            true
          ),
          fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'pushToGoogleSheet',
              submissions: listToSync,
              rows: rows13Cols,
              sheetUrl: targetSheet,
              appsScriptUrl: targetScript,
              oauthAccessToken: activeTok || undefined,
            }),
          }),
          writeFirestoreDashboardState({
            useInitialSubmissions: false,
            isCleared: isCurrentCleared && cleanUpdatedList.length === 0,
            clearedAt: isCurrentCleared && cleanUpdatedList.length === 0 ? currentClearedAt : 0,
            deletedIds: Array.from(currentDelSet),
            submissions: cleanUpdatedList,
            updatedAt: Date.now(),
            source:
              dateFilter && dateFilter.mode !== 'ALL'
                ? `Tersinkron Otomatis (Filter Tanggal: ${listToSync.length} Data)`
                : 'Tersinkron Otomatis (Tombol Sinkron Sistem)',
          }),
        ]);

        // Proses juga antrean offline
        syncQueue.forceProcessNow();

        const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLoginSheetSyncTime(nowTimeStr);

        if (isManualTrigger) {
          if (triggerSource === 'rekap') {
            setIsLoginRekapSyncAnimated(true);
          } else if (triggerSource === 'device') {
            setIsLoginDeviceSyncAnimated(true);
          } else if (triggerSource === 'photo') {
            setIsLoginPhotoSyncAnimated(true);
          }

          setTimeout(() => {
            setIsLoginRekapSyncAnimated(false);
            setIsLoginDeviceSyncAnimated(false);
            setIsLoginPhotoSyncAnimated(false);
          }, 4500);

          let filterSummaryText = '';
          if (dateFilter && dateFilter.mode !== 'ALL') {
            if (dateFilter.mode === 'TODAY') filterSummaryText = 'Hari Ini';
            else if (dateFilter.mode === 'DATE_RANGE')
              filterSummaryText = `${dateFilter.startDateIso} s/d ${dateFilter.endDateIso}`;
            else if (dateFilter.specificDateIso) filterSummaryText = dateFilter.specificDateIso;
            else if (
              dateFilter.selectedDate !== 'ALL' ||
              dateFilter.selectedMonth !== 'ALL' ||
              dateFilter.selectedYear !== 'ALL'
            ) {
              filterSummaryText = `Tgl ${dateFilter.selectedDate ?? 'Semua'}/${dateFilter.selectedMonth ?? 'Semua'}/${dateFilter.selectedYear ?? 'Semua'}`;
            }
          }

          if (triggerSource === 'photo') {
            setPhotoSyncToast(
              `✓ Foto Profil (${targetNama || 'Siswa'}) berhasil disinkronkan ke Link Google Sheets (${nowTimeStr})`
            );
            setTimeout(() => setPhotoSyncToast(null), 4000);
          } else if (triggerSource === 'device') {
            setDeviceRedetectToast(
              `✓ Data Perangkat (${liveCat} — ${liveModel}) berhasil disinkronkan ke Link Google Sheets (${nowTimeStr})`
            );
            setTimeout(() => setDeviceRedetectToast(null), 4000);
          } else if (triggerSource === 'rekap') {
            const msg = filterSummaryText
              ? `✓ Sinkronisasi Berhasil (${listToSync.length} Data Siswa · Periode: ${filterSummaryText} · Google Sheets & Cloud · Pukul ${nowTimeStr})!`
              : `✓ Sinkron Berhasil (${updatedList.length} Data Siswa · Google Sheets & Cloud · Pukul ${nowTimeStr})!`;

            setLoginSheetSyncToast(msg);
            setTimeout(() => setLoginSheetSyncToast(null), 4500);
          }
        }
      } catch {
        // ignore
      } finally {
        isSyncInProgressRef.current = false;
        if (isManualTrigger) {
          setIsSyncingLoginSheet(false);
          setSyncTriggerSource(null);
        }
      }
    },
    [
      namaSiswa,
      nisNisn,
      kelasSiswa,
      semesterSiswa,
      studentPhotoUrl,
      detectedDevice,
      effectiveDeviceModel,
      effectiveDeviceSummary,
    ]
  );

  const handleConfirmSyncWithDateChoice = useCallback(
    async (filter: SyncDateFilter, filteredSubs: StudentSubmission[]) => {
      setShowSyncDateModal(false);
      await handleSyncLoginFeaturesToGoogleSheets(
        true,
        undefined,
        'rekap',
        filter,
        filteredSubs
      );
      await handleSyncStudentDashboard(false);
    },
    [handleSyncLoginFeaturesToGoogleSheets, handleSyncStudentDashboard]
  );

  // Mekanisme Debounce Penyimpanan Profil Lokal: Hanya simpan ke localStorage secara efisien saat siswa mengetik/berubah foto tanpa memicu sinkronisasi jaringan yang berlebihan
  useEffect(() => {
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
    }
    syncDebounceTimerRef.current = setTimeout(() => {
      const cleanNama = namaSiswa.trim();
      const cleanNis = nisNisn.trim();
      if (cleanNama || cleanNis) {
        saveStoredStudentProfile({
          namaSiswa: cleanNama,
          nisNisn: cleanNis,
          kelasSiswa: getCleanKelas(kelasSiswa),
          semesterSiswa,
          photoDataUrl: studentPhotoUrl || '',
        });
      }
    }, 450);

    return () => {
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
    };
  }, [namaSiswa, nisNisn, kelasSiswa, semesterSiswa, studentPhotoUrl]);

  // Interval Timer Rutin (Setiap 5 Menit / 300.000 ms) untuk Menjalankan Sinkronisasi Terjadwal Otomatis ke Google Sheets & Cloud
  useEffect(() => {
    const routine5MinInterval = setInterval(() => {
      if (!isSyncInProgressRef.current && (submissionsRef.current.length > 0 || namaSiswa.trim())) {
        handleSyncLoginFeaturesToGoogleSheets(false, undefined, 'routine_5min');
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(routine5MinInterval);
  }, [handleSyncLoginFeaturesToGoogleSheets, namaSiswa]);

  // Sinkronisasi ke Server Lintas Perangkat, Google Sheet Web App & Penyimpanan Lokal
  const syncSubmissionToCloud = useCallback(
    async (record: StudentSubmission, isFinalSubmit: boolean) => {
      const completedRecord: StudentSubmission = { ...record, isCompleted: isFinalSubmit };

      setLastAutoSaveTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      // Jika masih dalam proses pengerjaan ujian (belum dikumpulkan / belum selesai),
      // simpan sebagai draft sesi aktif dan dorong status pengerjaan siswa ke server lintas perangkat, Firestore, dan Google Sheets!
      if (!isFinalSubmit) {
        try {
          localStorage.setItem('anbk_active_exam_draft_v1', JSON.stringify(completedRecord));
        } catch {
          // ignore
        }
        setSubmissions((prev) => {
          const idx = prev.findIndex(
            (item) =>
              item.id === completedRecord.id ||
              (item.nisNisn && completedRecord.nisNisn && item.nisNisn !== '0' && item.nisNisn !== '-' &&
               item.nisNisn.trim().toLowerCase() === completedRecord.nisNisn.trim().toLowerCase() &&
               item.namaSiswa.trim().toLowerCase() === completedRecord.namaSiswa.trim().toLowerCase()) ||
              (item.namaSiswa.trim().toLowerCase() === completedRecord.namaSiswa.trim().toLowerCase() &&
               item.namaSiswa.trim().toLowerCase() !== 'peserta ujian anbk')
          );
          let updated: StudentSubmission[];
          if (idx >= 0) {
            updated = [...prev];
            updated[idx] = completedRecord;
          } else {
            updated = [completedRecord, ...prev];
          }
          submissionsRef.current = updated;
          try {
            localStorage.setItem('anbk_submissions_v1', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        // Push real-time status masuk ruang ujian / sedang ujian ke Server Lintas Perangkat, Cloud Firestore & Google Sheets
        pushSubmissionToServer(completedRecord);
        enqueueSubmissionSync(completedRecord, {
          sheetUrl: cloudConfig.googleSheetUrl,
          appsScriptUrl: cloudConfig.appsScriptWebAppUrl,
          immediate: true,
          source: 'Siswa Masuk Ruang Ujian (Active)',
        });
        forceProcessQueueNow();
        syncSubmissionsToGoogleSheetsAuto(
          submissionsRef.current,
          sanitizeRekapSheetUrl(cloudConfig.googleSheetUrl),
          cloudConfig.appsScriptWebAppUrl,
          true
        ).catch(() => {});
        return;
      }

      try {
        localStorage.removeItem('anbk_active_exam_draft_v1');
        localStorage.setItem('anbk_last_completed_submission_v1', JSON.stringify(completedRecord));
      } catch {
        // ignore
      }

      setSubmissions((prev) => {
        const idx = prev.findIndex(
          (item) =>
            item.id === completedRecord.id ||
            (item.nisNisn && completedRecord.nisNisn && item.nisNisn !== '0' && item.nisNisn !== '-' &&
             item.nisNisn.trim().toLowerCase() === completedRecord.nisNisn.trim().toLowerCase() &&
             item.namaSiswa.trim().toLowerCase() === completedRecord.namaSiswa.trim().toLowerCase()) ||
            (item.namaSiswa.trim().toLowerCase() === completedRecord.namaSiswa.trim().toLowerCase() &&
             item.namaSiswa.trim().toLowerCase() !== 'peserta ujian anbk')
        );
        let updated: StudentSubmission[];
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = completedRecord;
        } else {
          updated = [completedRecord, ...prev];
        }
        submissionsRef.current = updated;
        localStorage.removeItem('anbk_submissions_cleared_v1');
        localStorage.setItem('anbk_submissions_cleared_at_v1', '0');
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(updated));
        return updated;
      });

      // Push real-time ke Server Lintas Perangkat, Cloud Firestore & Link Google Sheets Rekap Hasil Ujian
      pushSubmissionToServer(completedRecord);
      enqueueSubmissionSync(completedRecord, {
        sheetUrl: cloudConfig.googleSheetUrl,
        appsScriptUrl: cloudConfig.appsScriptWebAppUrl,
        immediate: true,
        source: 'Selesai Ujian Siswa (Queue)',
      });
      forceProcessQueueNow();
      autoRecoverAndSyncAllUnsavedSubmissions({
        sheetUrl: cloudConfig.googleSheetUrl,
        appsScriptUrl: cloudConfig.appsScriptWebAppUrl,
      }).catch(() => {});
      syncSubmissionsToGoogleSheetsAuto(
        submissionsRef.current,
        sanitizeRekapSheetUrl(cloudConfig.googleSheetUrl),
        cloudConfig.appsScriptWebAppUrl,
        true
      ).catch(() => {});

      if (cloudConfig.appsScriptWebAppUrl && cloudConfig.appsScriptWebAppUrl.startsWith('http')) {
        try {
          await fetch(cloudConfig.appsScriptWebAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'submitExam',
              skipEmailNotification: true,
              headers: [...REKAP_SHEET_HEADERS],
              data: {
                ...completedRecord,
                kelas: getCleanKelas(completedRecord.kelas),
                semester: getSemesterFromSub(completedRecord),
              },
            }),
          });
        } catch (err) {
          console.error('Gagal sinkronisasi ke Google Apps Script:', err);
        }
      }
    },
    [cloudConfig.appsScriptWebAppUrl]
  );

  // Fungsi Kirim Pesan Hasil, Nilai Lengkap & Detail Kecurangan ke WhatsApp & Email
  const buildWhatsAppMessage = (sub: StudentSubmission) => {
    const jenjang = getJenjangFromKelas(sub.kelas);
    const sem: 'Ganjil' | 'Genap' = sub.kelas.toLowerCase().includes('genap')
      ? 'Genap'
      : 'Ganjil';
    const pkgKey: ExamPackageKey = `${jenjang}_${sem}`;
    const examQs =
      shuffledQuestionsRef.current && shuffledQuestionsRef.current.length > 0
        ? shuffledQuestionsRef.current
        : questionBanks[pkgKey] || questions;

    const answeredCount = Object.keys(sub.answers || {}).length;
    const unansweredCount = Math.max(0, sub.totalSoal - answeredCount);
    const wrongCount = Math.max(0, sub.totalSoal - sub.skorBenar);
    const hotsQs = examQs.filter((q) => q.difficulty === 'HOTS');
    const regQs = examQs.filter((q) => q.difficulty === 'REGULER');
    const hotsCorrect = hotsQs.filter((q) => sub.answers?.[q.id] === q.answer).length;
    const regCorrect = regQs.filter((q) => sub.answers?.[q.id] === q.answer).length;

    const vCount = sub.violationCount || 0;
    const detailPelanggaran =
      sub.violationLogs && sub.violationLogs.length > 0
        ? sub.violationLogs.map((l, i) => `  ${i + 1}. ${l}`).join('\n')
        : '  ✓ 0 Pelanggaran — Siswa mengerjakan ujian dengan jujur & tertib (Tidak ada pindah tab / keluar fullscreen / split-screen).';

    const rincianPerSoal = examQs
      .map((q, idx) => {
        const ans = sub.answers?.[q.id];
        const choiceIdx = ans ? ['A', 'B', 'C', 'D'].indexOf(ans) : -1;
        const studentChoiceLabel =
          choiceIdx >= 0 && q.options[choiceIdx]
            ? `${ans}. ${q.options[choiceIdx]}`
            : ans || '-';
        const correctChoiceIdx = ['A', 'B', 'C', 'D'].indexOf(q.answer);
        const correctChoiceLabel =
          correctChoiceIdx >= 0 && q.options[correctChoiceIdx]
            ? `${q.answer}. ${q.options[correctChoiceIdx]}`
            : q.answer;
        const status = ans
          ? ans === q.answer
            ? '✓ BENAR'
            : `✗ SALAH (Kunci: ${correctChoiceLabel})`
          : `KOSONG (Kunci: ${correctChoiceLabel})`;

        const cleanContent = q.content.replace(/\s+/g, ' ').trim();
        const shortContent =
          cleanContent.length > 80 ? cleanContent.slice(0, 77) + '...' : cleanContent;

        return `• *No.${idx + 1} [${q.difficulty}]* : ${shortContent}\n  👉 Jawaban Siswa : *${studentChoiceLabel}* → *${status}*`;
      })
      .join('\n\n');

    return [
      `*LAPORAN RESMI SOAL & HASIL UJIAN ANBK INFORMATIKA KELAS ${jenjang}*`,
      `*${EXAM_INFO.namaSekolah}*`,
      `====================================`,
      `📌 *1. IDENTITAS PESERTA UJIAN*`,
      `• *Waktu Selesai* : ${sub.timestamp}`,
      `• *Nama Siswa* : ${sub.namaSiswa}`,
      `• *NIS / NISN* : ${sub.nisNisn}`,
      `• *Kelas & Semester* : ${sub.kelas}`,
      `====================================`,
      `📊 *2. RINCIAN NILAI & CAPAIAN KOMPETENSI*`,
      `• *Skor Jawaban Benar* : *${sub.skorBenar} Benar* / ${wrongCount} Salah (${unansweredCount} Kosong) dari ${sub.totalSoal} Soal`,
      `• *Capaian Soal HOTS* : ${hotsCorrect} dari ${hotsQs.length} Soal Benar`,
      `• *Capaian Soal Reguler* : ${regCorrect} dari ${regQs.length} Soal Benar`,
      `• *Nilai Akhir Ujian* : *${sub.nilaiAkhir}%* (Standar KKM: ${EXAM_INFO.kkm}%)`,
      `• *Status Kelulusan* : *${sub.lulusTidakLulus}*`,
      `====================================`,
      `🛡️ *3. DATA KECURANGAN & LOG INTEGRITAS UJIAN*`,
      `• *Status Integritas* : *${sub.statusKecurangan}*`,
      `• *Total Pelanggaran* : *${vCount}x dari Maksimal 3x Pelanggaran*`,
      `• *Kronologi Detail Pelanggaran* :\n${detailPelanggaran}`,
      `====================================`,
      `📝 *4. RINCIAN LENGKAP SOAL DAN JAWABAN SISWA (1 - ${examQs.length})* :\n\n${rincianPerSoal}`,
      `====================================`,
      `Identitas Guru Mapel: *${EXAM_INFO.guruMapelUpper}*`,
      `Nomor WA Resmi: *${EXAM_INFO.teacherPhone}*`,
      `Email Resmi: ${EXAM_INFO.teacherEmail}`,
    ].join('\n');
  };

  const handleSendWhatsAppToTeacher = useCallback(
    async (
      sub?: StudentSubmission | null,
      isAutoTrigger: boolean = false,
      mediaFormat: 'jpg_pdf' | 'jpg' | 'pdf' = 'jpg_pdf',
      skipOpenWindow: boolean = false
    ) => {
      // 1. Ambil data submission yang valid & paling mutakhir dari state terbaru
      const candidateId = sub?.id || completedSubmission?.id;
      const latestFromRef = candidateId
        ? submissionsRef.current.find((s) => s.id === candidateId)
        : submissionsRef.current[0] || null;

      const fallbackFresh = buildSubmissionRecord(undefined, isDisqualifiedResult);

      const validSub: StudentSubmission = {
        ...fallbackFresh,
        ...(latestFromRef || {}),
        ...(completedSubmission || {}),
        ...(sub || {}),
      };

      // Pastikan atribut identitas siswa terisi valid dan tidak kosong
      if (!validSub.namaSiswa || validSub.namaSiswa.trim() === '') {
        validSub.namaSiswa = completedSubmission?.namaSiswa || namaSiswa || 'Peserta Ujian';
      }
      if (!validSub.kelas || validSub.kelas.trim() === '') {
        validSub.kelas = completedSubmission?.kelas || kelasSiswa || 'VII-1';
      }
      if (!validSub.semester) {
        validSub.semester = completedSubmission?.semester || semesterSiswa || 'Ganjil';
      }
      if (!validSub.nisNisn || validSub.nisNisn === '-') {
        validSub.nisNisn = completedSubmission?.nisNisn || nisNisn || '-';
      }

      // Sinkronkan foto profil peserta ujian jika ada di memori
      if (!validSub.photoUrl && studentPhotoUrl) {
        validSub.photoUrl = studentPhotoUrl;
      }
      if (!validSub.photoUrl && validSub.namaSiswa) {
        const storedPhoto = getPhotoForStudentIdentity(validSub.namaSiswa, validSub.nisNisn);
        if (storedPhoto) validSub.photoUrl = storedPhoto;
      }

      // Pastikan bank soal terkait valid
      const jenjang = getJenjangFromKelas(validSub.kelas) || 'VII';
      const sem: 'Ganjil' | 'Genap' = String(validSub.kelas || '').toLowerCase().includes('genap')
        ? 'Genap'
        : 'Ganjil';
      const pkgKey: ExamPackageKey = `${jenjang}_${sem}`;
      const examQs =
        shuffledQuestionsRef.current && shuffledQuestionsRef.current.length > 0
          ? shuffledQuestionsRef.current
          : questionBanks[pkgKey] || questions;

      // Validasi kalkulasi skor dan data integritas
      if (!validSub.totalSoal || validSub.totalSoal <= 0) {
        validSub.totalSoal = examQs.length > 0 ? examQs.length : 25;
      }
      if (typeof validSub.skorBenar !== 'number' || isNaN(validSub.skorBenar)) {
        validSub.skorBenar = examQs.filter((q) => validSub.answers?.[q.id] === q.answer).length;
      }
      if (typeof validSub.nilaiAkhir !== 'number' || isNaN(validSub.nilaiAkhir)) {
        validSub.nilaiAkhir = Math.round(
          (validSub.skorBenar / Math.max(1, validSub.totalSoal)) * 100
        );
      }
      if (!validSub.lulusTidakLulus) {
        validSub.lulusTidakLulus =
          validSub.nilaiAkhir >= EXAM_INFO.kkm ? 'Lulus Ujian' : 'Tidak Lulus Ujian (Ujian Susulan)';
      }
      if (!validSub.statusKecurangan) {
        validSub.statusKecurangan =
          (validSub.violationCount || 0) > 0
            ? `${validSub.violationCount}x Pelanggaran`
            : '0 Pelanggaran (Tertib & Jujur)';
      }
      if (!validSub.timestamp) {
        validSub.timestamp = new Date().toLocaleString('id-ID');
      }

      const safeName = String(validSub.namaSiswa || 'Siswa').replace(/[^a-zA-Z0-9]/g, '_');
      const safeKelas = String(validSub.kelas || 'VII').replace(/[^a-zA-Z0-9]/g, '_');
      const jpgFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.jpg`;
      const pdfFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.pdf`;

      const formatLabel =
        mediaFormat === 'jpg_pdf'
          ? 'Gambar (.JPG) & Dokumen (.PDF)'
          : mediaFormat === 'jpg'
          ? 'Gambar (.JPG)'
          : 'Dokumen (.PDF)';

      // Bangun format pesan laporan resmi yang valid sesuai struktur standar
      const message = buildOfficialWhatsAppReport(validSub, examQs, {
        mediaFormat,
        jpgFilename,
        pdfFilename,
      });

      // Pastikan URL Fonnte dan tautan WhatsApp yang dibentuk TIDAK KOSONG
      const rawFonnteUrl = (cloudConfig.appsScriptWebAppUrl || '').trim();
      const fonnteApiUrl = rawFonnteUrl.includes('fonnte')
        ? rawFonnteUrl
        : 'https://api.fonnte.com/send';
      const teacherWaUrl = getTeacherWhatsAppUrl(message, EXAM_INFO.teacherPhone);

      // Jika dipicu secara otomatis setelah ujian selesai / diskualifikasi (isAutoTrigger === true):
      if (isAutoTrigger) {
        const isDisqualified = isDisqualifiedByCheatOrSub(validSub);
        if (cloudConfig.autoSendWa === false && !isDisqualified) {
          setNotificationStatus((prev) => ({
            ...prev,
            waStatus: `Siap Dikirim ke WhatsApp Guru (${EXAM_INFO.teacherPhone})`,
          }));
          return;
        }

        // Siapkan lampiran fisik file .JPG dan .PDF hasil ujian untuk gateway Fonnte API
        let autoJpgBlob: Blob | null = null;
        let autoPdfBlob: Blob | null = null;
        try {
          const imgRes = await generateResultImageBlobs(
            validSub,
            examQs,
            isDisqualified
          );
          autoJpgBlob = imgRes.jpgBlob;
          if (mediaFormat === 'jpg_pdf' || mediaFormat === 'pdf') {
            autoPdfBlob = generateResultPdfBlob(
              validSub,
              examQs,
              isDisqualified
            );
          }
        } catch (err) {
          console.warn('Gagal render berkas .JPG otomatis untuk Fonnte:', err);
        }

        // Lakukan pengiriman otomatis via gateway Fonnte API dengan berkas .JPG & nomor internasional resmi
        sendExamResultViaFonnteApi({
          fonnteToken: cloudConfig.fonnteToken,
          targetPhone: EXAM_INFO.teacherPhone,
          message,
          jpgBlob: autoJpgBlob,
          jpgFilename,
          pdfBlob: autoPdfBlob,
          pdfFilename,
          fonnteApiUrl,
        })
          .then((res) => {
            if (res?.message) {
              setNotificationStatus((prev) => ({
                ...prev,
                waStatus: res.message,
              }));
            }
          })
          .catch(() => {});

        // Jalankan pengiriman cadangan langsung ke backend server gateway
        fetch('/__api/student-dashboard-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sendFonnteWhatsAppJpg',
            targetPhone: EXAM_INFO.teacherPhone,
            message,
          }),
        }).catch(() => {});

        // Jika didiskualifikasi (pelanggaran ke-3 atau waktu habis), luncurkan dan buka WhatsApp pada perangkat siswa!
        if (isDisqualified) {
          try {
            copyToClipboardSafely(message).catch(() => {});
            openWhatsAppSafely(teacherWaUrl, true);
          } catch {}
        }

        setNotificationStatus((prev) => ({
          ...prev,
          waStatus: `✓ Laporan Berhasil Dikirimkan ke WhatsApp Guru (${EXAM_INFO.teacherPhone}) via Fonnte & Aplikasi WhatsApp`,
        }));
        return;
      }

      // === MODE KLIK MANUAL SISWA / GURU (isAutoTrigger === false) ===
      setNotificationStatus((prev) => ({
        ...prev,
        waStatus: `Menghubungkan ke WhatsApp Guru (${EXAM_INFO.teacherPhone})...`,
      }));

      let jpgBlob: Blob | null = null;
      let pdfBlob: Blob | null = null;

      try {
        if (mediaFormat === 'jpg_pdf' || mediaFormat === 'jpg') {
          const imgRes = await generateResultImageBlobs(
            validSub,
            examQs,
            isDisqualifiedByCheatOrSub(validSub)
          );
          jpgBlob = imgRes.jpgBlob;
        }

        if (mediaFormat === 'jpg_pdf' || mediaFormat === 'pdf') {
          pdfBlob = generateResultPdfBlob(
            validSub,
            examQs,
            isDisqualifiedByCheatOrSub(validSub)
          );
        }
      } catch (err) {
        console.error('Gagal membuat file JPG/PDF hasil ujian:', err);
      }

      // 1. Salin teks laporan ke clipboard sebagai cadangan kemudahan siswa
      copyToClipboardSafely(message).catch(() => {});

      // 2. Jalankan pengiriman Fonnte di latar belakang juga jika token terkonfigurasi
      sendExamResultViaFonnteApi({
        fonnteToken: cloudConfig.fonnteToken,
        targetPhone: EXAM_INFO.teacherPhone,
        message,
        jpgBlob: mediaFormat !== 'pdf' ? jpgBlob : null,
        jpgFilename,
        pdfBlob: mediaFormat !== 'jpg' ? pdfBlob : null,
        pdfFilename,
        pdfMessage: `Dokumen PDF Hasil Ujian ANBK Informatika Kelas ${jenjang} - ${validSub.namaSiswa} (${validSub.kelas}) - Nilai: ${validSub.nilaiAkhir}% (${validSub.lulusTidakLulus}) - Integritas: ${validSub.statusKecurangan}`,
        fonnteApiUrl,
      }).catch(() => {});

      // 3. Jika bukan dari tautan langsung yang sudah memiliki href teacherWaUrl, buka WhatsApp secara aman
      if (!skipOpenWindow) {
        shareResultFilesOrOpenWhatsApp({
          message,
          jpgBlob: mediaFormat !== 'pdf' ? jpgBlob : null,
          jpgFilename,
          pdfBlob: mediaFormat !== 'jpg' ? pdfBlob : null,
          pdfFilename,
          targetPhone: EXAM_INFO.teacherPhone,
        }).catch(() => {
          openWhatsAppSafely(teacherWaUrl);
        });
      }

      setNotificationStatus((prev) => ({
        ...prev,
        waStatus: `✓ Terhubung ke WhatsApp Guru Mapel (${EXAM_INFO.guruMapelUpper} - ${EXAM_INFO.teacherPhone})`,
      }));
    },
    [
      completedSubmission,
      cloudConfig.autoSendWa,
      cloudConfig.fonnteToken,
      cloudConfig.appsScriptWebAppUrl,
      isDisqualifiedResult,
      questionBanks,
      questions,
      studentPhotoUrl,
      namaSiswa,
      kelasSiswa,
      semesterSiswa,
      nisNisn,
      buildSubmissionRecord,
    ]
  );

  const handleSendEmailToTeacher = useCallback(
    async (
      sub: StudentSubmission,
      isAutoTrigger: boolean = false,
      mode: 'auto_gmail' | 'mailto' = 'auto_gmail',
      mediaFormat: 'jpg_pdf' | 'jpg' | 'pdf' = 'jpg_pdf'
    ) => {
      // Jika diklik manual dan belum ada token OAuth aktif, panggil googleSignIn langsung di awal klik (sebelum await lain) agar popup tidak diblokir browser
      let activeToken = getAccessTokenSync();
      if (!isAutoTrigger && mode === 'auto_gmail' && !activeToken) {
        const authRes = await googleSignIn();
        if (authRes?.accessToken) {
          activeToken = authRes.accessToken;
          writeFirestoreCloudConfig({
            oauthAccessToken: activeToken,
            oauthExpiresAt: Date.now() + 50 * 60 * 1000,
          }).catch(() => {});
        }
      }

      const jenjang = getJenjangFromKelas(sub.kelas);
      const sem: 'Ganjil' | 'Genap' = sub.kelas.toLowerCase().includes('genap')
        ? 'Genap'
        : 'Ganjil';
      const pkgKey: ExamPackageKey = `${jenjang}_${sem}`;
      const examQs =
        shuffledQuestionsRef.current && shuffledQuestionsRef.current.length > 0
          ? shuffledQuestionsRef.current
          : questionBanks[pkgKey] || questions;

      const safeName = sub.namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
      const safeKelas = sub.kelas.replace(/[^a-zA-Z0-9]/g, '_');
      const jpgFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.jpg`;
      const pdfFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.pdf`;

      const formatLabel =
        mediaFormat === 'jpg_pdf'
          ? 'Format Gambar (.JPG) & Format PDF (.PDF)'
          : mediaFormat === 'jpg'
          ? 'Format Gambar (.JPG)'
          : 'Format PDF (.PDF)';

      const vCount = sub.violationCount || 0;
      const subject = `[ANBK INFORMATIKA KELAS ${jenjang}] Hasil Ujian (${formatLabel}): ${sub.namaSiswa} (${sub.kelas}) - Nilai ${sub.nilaiAkhir}% (${sub.lulusTidakLulus}) - Pelanggaran: ${vCount}x`;

      const shortAttachmentSummary = [
        `Hasil Ujian ANBK Informatika Kelas ${jenjang} — ${EXAM_INFO.namaSekolah}`,
        `Peserta: ${sub.namaSiswa} (NIS/NISN: ${sub.nisNisn} · Kelas ${sub.kelas})`,
        `Nilai Akhir: ${sub.nilaiAkhir}% (${sub.lulusTidakLulus}) · Integritas: ${sub.statusKecurangan}`,
        `Terlampir dalam bentuk file ${formatLabel}:`,
        mediaFormat !== 'pdf' ? `• Format Gambar (.JPG): ${jpgFilename}` : null,
        mediaFormat !== 'jpg' ? `• Format PDF (.PDF): ${pdfFilename}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      setNotificationStatus((prev) => ({
        ...prev,
        emailStatus: `Mengirim File ${formatLabel} ke ${EXAM_INFO.teacherEmail}...`,
      }));

      let jpgBlob: Blob | null = null;
      let pdfBlob: Blob | null = null;
      let jpgBase64 = '';
      let pdfBase64 = '';

      try {
        if (mediaFormat === 'jpg_pdf' || mediaFormat === 'jpg') {
          const imgRes = await generateResultImageBlobs(
            sub,
            examQs,
            isDisqualifiedByCheatOrSub(sub)
          );
          jpgBlob = imgRes.jpgBlob;
          jpgBase64 = await blobToBase64(jpgBlob);
        }

        if (mediaFormat === 'jpg_pdf' || mediaFormat === 'pdf') {
          pdfBlob = generateResultPdfBlob(sub, examQs, isDisqualifiedByCheatOrSub(sub));
          pdfBase64 = await blobToBase64(pdfBlob);
        }
      } catch (err) {
        console.error('Gagal membuat lampiran JPG/PDF untuk email:', err);
      }

      const htmlBody = buildHtmlEmailBody(
        sub,
        examQs,
        formatLabel,
        jpgFilename,
        pdfFilename,
        isDisqualifiedByCheatOrSub(sub)
      );

      const emailPayload: GmailSendAttachmentsPayload = {
        to: EXAM_INFO.teacherEmail,
        subject,
        textBody: shortAttachmentSummary,
        htmlBody,
        jpgFilename: mediaFormat !== 'pdf' ? jpgFilename : undefined,
        jpgBase64: mediaFormat !== 'pdf' ? jpgBase64 : undefined,
        pdfFilename: mediaFormat !== 'jpg' ? pdfFilename : undefined,
        pdfBase64: mediaFormat !== 'jpg' ? pdfBase64 : undefined,
      };

      let sentWithBinaryAttachments = false;

      // Layer 1: Kirim langsung file .JPG (image/jpeg) & .PDF (application/pdf) melalui Gmail REST API
      try {
        let tokenToUse = activeToken || getAccessTokenSync() || (await getAccessToken());
        if (!tokenToUse) {
          const fsCfg = await readFirestoreCloudConfig().catch(() => null);
          if (fsCfg?.oauthAccessToken) {
            tokenToUse = fsCfg.oauthAccessToken;
          }
        }
        if (tokenToUse) {
          await sendEmailWithJpgAndPdfViaGmailApi(tokenToUse, emailPayload);
          sentWithBinaryAttachments = true;
        }
      } catch {
        // Jika diklik manual dan token lama belum memiliki scope gmail.send / kedaluwarsa, minta otorisasi ulang sekali
        if (!isAutoTrigger && mode === 'auto_gmail') {
          try {
            invalidateAccessToken(activeToken);
            const retryAuth = await googleSignIn();
            if (retryAuth?.accessToken) {
              activeToken = retryAuth.accessToken;
              writeFirestoreCloudConfig({
                oauthAccessToken: activeToken,
                oauthExpiresAt: Date.now() + 50 * 60 * 1000,
              }).catch(() => {});
              await sendEmailWithJpgAndPdfViaGmailApi(activeToken, emailPayload);
              sentWithBinaryAttachments = true;
            }
          } catch {
            // lanjut ke layer server / Apps Script
          }
        }
      }

      // Layer 2: Jika belum terkirim di sisi klien, kirim melalui Server Proxy menggunakan token OAuth Guru yang tersimpan
      if (!sentWithBinaryAttachments) {
        try {
          const srvRes = await fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sendResultEmail',
              emailPayload,
              oauthAccessToken: activeToken || undefined,
            }),
          });
          if (srvRes.ok) {
            const srvJson = (await srvRes.json().catch(() => null)) as {
              emailSent?: boolean;
            } | null;
            if (srvJson?.emailSent) {
              sentWithBinaryAttachments = true;
            }
          }
        } catch {
          // ignore
        }
      }

      // Layer 3: Kirim otomatis via Google Apps Script Web App beserta lampiran file .JPG & .PDF Base64
      if (cloudConfig.appsScriptWebAppUrl && cloudConfig.appsScriptWebAppUrl.startsWith('http')) {
        try {
          await fetch(cloudConfig.appsScriptWebAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'submitExam',
              sendEmailOnly: true,
              targetEmail: EXAM_INFO.teacherEmail,
              data: sub,
              jpgFilename: jpgBlob && mediaFormat !== 'pdf' ? jpgFilename : undefined,
              jpgBase64: mediaFormat !== 'pdf' ? jpgBase64 || undefined : undefined,
              pdfFilename: pdfBlob && mediaFormat !== 'jpg' ? pdfFilename : undefined,
              pdfBase64: mediaFormat !== 'jpg' ? pdfBase64 || undefined : undefined,
            }),
          });
          sentWithBinaryAttachments = true;
        } catch (e) {
          console.error('Gagal kirim email JPG/PDF via Apps Script:', e);
        }
      }

      if (!sentWithBinaryAttachments && !isAutoTrigger) {
        setGmailConfirmPayload(emailPayload);
      } else {
        setGmailConfirmPayload(null);
      }
      setNotificationStatus((prev) => ({
        ...prev,
        emailStatus: sentWithBinaryAttachments
          ? `SUKSES TERKIRIM ke ${EXAM_INFO.teacherEmail} (${formatLabel})`
          : `Siap Mengirim ${formatLabel} ke ${EXAM_INFO.teacherEmail}`,
      }));
    },
    [cloudConfig.appsScriptWebAppUrl, isDisqualifiedResult, questionBanks, questions]
  );

  function isDisqualifiedByCheatOrSub(sub: StudentSubmission): boolean {
    const statusLower = String(sub?.statusKecurangan || '').toLowerCase();
    const lulusLower = String(sub?.lulusTidakLulus || '').toLowerCase();
    return (
      isDisqualifiedResult ||
      (sub?.violationCount !== undefined && sub.violationCount >= 3) ||
      statusLower.includes('diskualifikasi') ||
      statusLower.includes('gagal') ||
      statusLower.includes('pelanggaran 3') ||
      statusLower.includes('3x') ||
      statusLower.includes('ditendang') ||
      lulusLower.includes('tidak lulus')
    );
  }

  // Fungsi Menyelesaikan Ujian (Otomatis Kirim Laporan .JPG & .PDF beserta Nilai & Data Kecurangan ke Email & WhatsApp)
  const finalizeExam = useCallback(
    (
      cheatReason?: string,
      isCheatingDisqualification: boolean = false,
      overrideViolationCount?: number,
      overrideViolationLogs?: string[]
    ) => {
      setRedWarningOverlay(false);
      setShowSubmitConfirmModal(false);

      // Pertahankan mode Full Screen otomatis meskipun ujian telah selesai
      requestAllPlatformFullscreen().catch(() => {});

      const finalRecord = buildSubmissionRecord(
        cheatReason,
        isCheatingDisqualification,
        overrideViolationCount,
        overrideViolationLogs
      );
      finalRecord.isCompleted = true;
      const elapsedExamSec = Math.max(0, EXAM_INFO.durasiDetik - examSecondsLeft);
      appendBatteryHistoryPoint(
        batteryStateRef.current.level,
        batteryStateRef.current.charging,
        'Selesai Ujian',
        elapsedExamSec,
        shuffledQuestionsRef.current.length || 25,
        isCheatingDisqualification
          ? 'Ujian Dihentikan (Diskualifikasi)'
          : 'Ujian Selesai & Dikumpulkan'
      );
      finalRecord.batteryHistory = [...batteryHistoryRef.current];

      setCompletedSubmission(finalRecord);
      setIsDisqualifiedResult(isCheatingDisqualification);
      if (!isCheatingDisqualification) {
        playAudioCue('exam-complete');
      }
      syncSubmissionToCloud(finalRecord, true);
      if (finalRecord.usedToken) {
        recordUsedExamToken({
          token: finalRecord.usedToken,
          namaSiswa: finalRecord.namaSiswa,
          nisNisn: finalRecord.nisNisn,
          kelas: finalRecord.kelas,
          semester: finalRecord.semester,
          sessionId: finalRecord.id,
        });
        setUsedTokensList(getUsedExamTokens());
      }
      setInputToken('');
      try {
        localStorage.setItem('anbk_exam_has_completed', 'true');
      } catch {}
      setHasCompletedExam(true);

      // ATURAN OTOMATIS MASUK KE DENAH KELAS DI CLASSROOM & MENGISI BANGKU KOSONG:
      // Siswa akan secara otomatis masuk ke Denah Kelas di Classroom dan otomatis mengisi bangku yang kosong
      // HANYA SAAT siswa sudah menyelesaikan semua soal ujian dan dinyatakan LULUS UJIAN (Minimal Standar KKM 75).
      // Selain itu (Nilai < 75 atau Diskualifikasi / Tidak Lulus) TIDAK BISA masuk atau mengisi bangku!
      const isPassedKkm75 =
        !isCheatingDisqualification &&
        finalRecord.nilaiAkhir >= EXAM_INFO.kkm &&
        !String(finalRecord.lulusTidakLulus || '').toLowerCase().includes('tidak');

      if (isPassedKkm75) {
        const seatSyncRes = syncStudentToClassroomSeat({
          namaSiswa: finalRecord.namaSiswa || 'Peserta Ujian',
          nisNisn: finalRecord.nisNisn,
          kelas: finalRecord.kelas,
          semester: finalRecord.semester || 'Ganjil',
          deviceCategory: finalRecord.deviceCategory || detectedDevice.deviceCategory,
          deviceBrand: finalRecord.deviceBrand || detectedDevice.brand,
          deviceModel: finalRecord.deviceModel || effectiveDeviceModel,
          deviceInfo: finalRecord.deviceInfo || effectiveDeviceSummary || 'HP Android Siswa',
          photoUrl: finalRecord.photoUrl || studentPhotoUrl || undefined,
          attendanceStatus: 'Selesai Ujian',
          skorBenar: finalRecord.skorBenar,
          totalSoal: finalRecord.totalSoal,
          nilaiAkhir: finalRecord.nilaiAkhir,
          statusKecurangan: finalRecord.statusKecurangan,
          lulusTidakLulus: 'Lulus Ujian',
          isExamCompletedAndPassed: true,
          submissionsFallback: [finalRecord, ...submissionsRef.current],
        });

        if (seatSyncRes) {
          setClassroomSyncStatus({
            seatNumber: seatSyncRes.assignedSeat,
            kelas: seatSyncRes.student.kelas,
            semester: seatSyncRes.student.semester,
            namaSiswa: seatSyncRes.student.namaSiswa,
            isNew: seatSyncRes.isNew,
            syncedAt: seatSyncRes.student.updatedAt,
          });
          const seatDocId = `seats_${getCleanKelas(finalRecord.kelas).replace(/[^A-Za-z0-9_-]/g, '_')}`;
          const roomSeats = seatSyncRes.list
            .filter((s) => getCleanKelas(s.kelas) === getCleanKelas(finalRecord.kelas))
            .slice(0, 60);
          firestoreRestWriteDoc(
            'classroomSeats',
            seatDocId,
            {
              kelas: getCleanKelas(finalRecord.kelas),
              seats: roomSeats,
              updatedAt: Date.now(),
            },
            3500
          ).catch(() => {});
        }

        try {
          localStorage.setItem('anbk_classroom_has_entered', 'true');
        } catch {}
        setHasEnteredClassroom(true);
        setTokenSyncToast(
          `🎉 SELAMAT LULUS UJIAN (Nilai ${finalRecord.nilaiAkhir}% ≥ KKM ${EXAM_INFO.kkm})! Anda otomatis masuk ke Denah Kelas ${getCleanKelas(finalRecord.kelas)} di Classroom dan mengisi Bangku Kosong #${seatSyncRes?.assignedSeat || 1}!`
        );
        setTimeout(() => setTokenSyncToast(null), 7000);
        setView('RESULT');
        window.scrollTo(0, 0);
      } else {
        setTokenSyncToast(
          `⚠️ Nilai Ujian Anda ${finalRecord.nilaiAkhir}% (Di Bawah Standar KKM ${EXAM_INFO.kkm} — Tidak Lulus Ujian). Siswa hanya dapat masuk ke Denah Kelas Classroom & mengisi bangku kosong apabila dinyatakan LULUS UJIAN (Minimal KKM ${EXAM_INFO.kkm}).`
        );
        setTimeout(() => setTokenSyncToast(null), 7000);
        setView('RESULT');
      }

      // 1. Otomatisasi Pengiriman Pesan WhatsApp ke Nomor Guru Mapel menggunakan API Fonnte dengan mengirimkan file .JPG hasil ujian (agar Guru tidak perlu menanti laporan manual dari siswa)
      handleSendWhatsAppToTeacher(finalRecord, true, 'jpg');

      // 2. Kirim Otomatis Laporan Hasil Ujian (.JPG & .PDF + Nilai & Detail Kecurangan) ke Email eksayudikasirait@gmail.com
      handleSendEmailToTeacher(finalRecord, true, 'auto_gmail', 'jpg_pdf');

      if (isCheatingDisqualification) {
        setAutoReturnHomeSeconds(10);
      } else {
        setAutoReturnHomeSeconds(null);
      }
    },
    [
      buildSubmissionRecord,
      handleSendEmailToTeacher,
      handleSendWhatsAppToTeacher,
      playAudioCue,
      syncSubmissionToCloud,
    ]
  );

  // Timer Auto-Restart ke HOME jika Diskualifikasi Kecurangan
  useEffect(() => {
    if (view !== 'RESULT' || autoReturnHomeSeconds === null) return;
    if (autoReturnHomeSeconds <= 0) {
      handleReturnToHome();
      return;
    }
    const t = setTimeout(() => {
      setAutoReturnHomeSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [view, autoReturnHomeSeconds]);

  const handleReturnToHome = () => {
    setRedWarningOverlay(false);
    setAutoReturnHomeSeconds(null);
    setIsDisqualifiedResult(false);
    setTokenSyncResetKey((k) => k + 1);
    const currentOnlineCheck = checkStudentTokenUsage(
      onlineToken,
      namaSiswa,
      nisNisn,
      submissionsRef.current
    );
    if (currentOnlineCheck.isAlreadyUsed) {
      setInputToken('');
    }
    handleSyncTokenFromSheet(false, true);
    setIsRemedialSession(false);
    setRemedialActiveMeta(null);
    setView('HOME');
  };

  // Fungsi Mencatat Pelanggaran Anti-Cheating
  const recordCheatViolation = useCallback(
    (reason: string, _showRedOverlay: boolean = true) => {
      if (viewRef.current !== 'EXAM') return;

      const now = Date.now();
      // Debounce anti-duplikasi: hindari pemanggilan ganda dalam kurun 1.8 detik akibat event serentak (blur + resize + touch)
      if (now - lastViolationTimeRef.current < 1800) {
        return;
      }
      lastViolationTimeRef.current = now;

      playAudioCue('violation');

      const currentCount = violationCountRef.current;
      const nextCount = Math.min(3, currentCount + 1);
      const timeLabel = new Date().toLocaleTimeString('id-ID');
      const nextLogs = [...violationLogsRef.current, `${timeLabel}: ${reason}`];

      setViolationCount(nextCount);
      setViolationLogs(nextLogs);
      violationCountRef.current = nextCount;
      violationLogsRef.current = nextLogs;

      const isFinalDisqualification = nextCount >= 3;
      const snap = buildSubmissionRecord(
        `Pelanggaran ${nextCount}/3 (${reason})`,
        isFinalDisqualification,
        nextCount,
        nextLogs
      );
      syncSubmissionToCloud(snap, false);

      // Selalu tampilkan modal notifikasi peringatan pada layar di setiap perangkat siswa (HP/Laptop)
      setWarningReasonText(reason);
      setWarningCountdown(15);
      setRedWarningOverlay(true);
    },
    [buildSubmissionRecord, playAudioCue, syncSubmissionToCloud]
  );

  // Countdown 15 Detik pada Setiap Pelanggaran (Pelanggaran 1, 2, dan 3)
  // Durasi 15 Detik untuk Masuk Kembali ke Ujian via Tombol Hijau (Pelanggaran 1 & 2)
  // Atau Ditendang Keluar dan Ujian Dihentikan Otomatis (Pelanggaran 3 atau Jika Waktu 15 Detik Habis)
  useEffect(() => {
    if (!redWarningOverlay || view !== 'EXAM') return;

    if (warningCountdown <= 0) {
      if (violationCount >= 3) {
        finalizeExam(
          `Diskualifikasi Otomatis: Batas 3 Kali Pelanggaran Tercapai (${violationLogs.join('; ')}) — Ditendang Keluar Dari Ujian Dalam 15 Detik`,
          true,
          3,
          violationLogs
        );
      } else {
        finalizeExam(
          `Diskualifikasi Otomatis: Batas Waktu 15 Detik Habis pada Pelanggaran #${violationCount} Tanpa Masuk Kembali ke Ujian (${violationLogs.join('; ')}) — Ditendang Keluar Dari Ujian`,
          true,
          violationCount,
          violationLogs
        );
      }
      return;
    }

    const timer = setTimeout(() => {
      setWarningCountdown((prev) => prev - 1);
      playAudioCue('violation');
    }, 1000);
    return () => clearTimeout(timer);
  }, [redWarningOverlay, warningCountdown, view, finalizeExam, violationCount, violationLogs, playAudioCue]);

  // Countdown Timer Ujian 30 Menit Real-Time + Per-Question Timer (Detik per Soal)
  // Dilengkapi Peringatan Audio & Visual Otomatis saat Sisa Waktu 5 Menit dan 1 Menit
  useEffect(() => {
    if (view !== 'EXAM') return;
    if (examSecondsLeft <= 0) {
      finalizeExam(undefined, false);
      return;
    }
    const timer = setInterval(() => {
      setExamSecondsLeft((prev) => {
        const next = prev - 1;

        // Peringatan Suara Notifikasi saat Sisa 5 Menit (300 Detik)
        if (next <= 300 && prev > 300 && !hasWarned5MinRef.current) {
          hasWarned5MinRef.current = true;
          playAudioCue('timer-warning-5min');
          setTimerWarningAlert({
            type: '5min',
            message: 'Peringatan Waktu: Sisa Waktu Ujian Anda Tinggal 5 Menit Lagi! Silakan periksa kembali seluruh lembar jawaban Anda.',
            secondsRemaining: next,
          });
        }

        // Peringatan Suara Notifikasi Kritis saat Sisa 1 Menit (60 Detik)
        if (next <= 60 && prev > 60 && !hasWarned1MinRef.current) {
          hasWarned1MinRef.current = true;
          playAudioCue('timer-warning-1min');
          setTimerWarningAlert({
            type: '1min',
            message: 'Peringatan Kritis: Sisa Waktu Ujian Tinggal 1 Menit! Segera pastikan semua jawaban telah tersimpan sebelum waktu habis.',
            secondsRemaining: next,
          });
        }

        return next;
      });

      if (!redWarningOverlay && !showSubmitConfirmModal) {
        const activeQ = shuffledQuestionsRef.current[currentQuestionIndexRef.current];
        if (activeQ) {
          setQuestionDurations((prev) => {
            const nextVal = (prev[activeQ.id] || 0) + 1;
            const updated = { ...prev, [activeQ.id]: nextVal };
            questionDurationsRef.current = updated;
            return updated;
          });
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [view, examSecondsLeft, finalizeExam, redWarningOverlay, showSubmitConfirmModal, playAudioCue]);

  // Event Listeners Sistem Anti-Cheating selama Mode Ujian (EXAM)
  useEffect(() => {
    if (view !== 'EXAM') return;

    const handleVisibilityChange = () => {
      if (showStudentCameraModalRef.current) return;
      if (document.hidden && viewRef.current === 'EXAM') {
        document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
        document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
        setScreenshotShieldReason('Layar Diminimalkan / Pindah Aplikasi / Tangkapan Layar');
        setShowScreenshotShield(true);
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        recordCheatViolation('Terdeteksi Pindah Tab / Layar Di-Minimize / Screenshot', true);
      } else if (!document.hidden && viewRef.current === 'EXAM') {
        setTimeout(() => {
          document.documentElement.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
          document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
          setShowScreenshotShield(false);
          try {
            navigator.clipboard?.writeText?.('');
          } catch {}
        }, 400);
      }
    };

    const handleWindowBlur = () => {
      if (showStudentCameraModalRef.current) return;
      if (viewRef.current === 'EXAM') {
        document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
        document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
        setScreenshotShieldReason('Fokus Jendela Hilang / Status Bar / Panel Screenshot Terbuka');
        setShowScreenshotShield(true);
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        if (!redWarningOverlay) {
          recordCheatViolation('Terdeteksi Keluar Fokus / Tangkapan Layar (Blackout Buffer Aktif)', true);
        }
      }
    };

    const handleWindowFocus = () => {
      if (viewRef.current === 'EXAM') {
        setTimeout(() => {
          document.documentElement.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
          document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
          setShowScreenshotShield(false);
          try {
            navigator.clipboard?.writeText?.('');
          } catch {}
        }, 300);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (viewRef.current !== 'EXAM') return;
      if ((e.touches && e.touches.length >= 2) || (e.targetTouches && e.targetTouches.length >= 2)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(`Gesture Multi-Touch Layar Sentuh (${e.touches.length} Jari - Dilarang)`);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (viewRef.current !== 'EXAM') return;
      if ((e.touches && e.touches.length >= 2) || (e.targetTouches && e.targetTouches.length >= 2)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(`Gesture Gerakan Multi-Touch (${e.touches.length} Jari - Dilarang)`);
      }
    };

    let orientationSettleTimeout: any = null;

    // Pemantauan Presisi Perubahan Orientasi Layar (Portrait <-> Landscape)
    const handleOrientationChange = () => {
      if (viewRef.current !== 'EXAM') return;
      if (orientationSettleTimeout) {
        clearTimeout(orientationSettleTimeout);
      }
      // Berikan jeda settling 250ms saat HP diputar agar dimensi reflow browser stabil
      orientationSettleTimeout = setTimeout(() => {
        if (viewRef.current !== 'EXAM') return;
        const precisionRes = evaluatePrecisionSplitScreen();
        if (precisionRes.isSplitScreen) {
          setIsSplitScreenDetected(true);
          recordCheatViolation(
            precisionRes.reason || `Terdeteksi Layar Terbelah (Split-Screen / Multi-Window) [Orientasi: ${precisionRes.orientation.toUpperCase()}]`,
            true
          );
        } else {
          setIsSplitScreenDetected(false);
        }
      }, 250);
    };

    const handleWindowResize = () => {
      if (viewRef.current !== 'EXAM') return;
      const precisionRes = evaluatePrecisionSplitScreen();
      if (precisionRes.isSplitScreen) {
        setIsSplitScreenDetected(true);
        recordCheatViolation(
          precisionRes.reason || 'Terdeteksi Membelah Layar (Split-Screen / Multi-Window)',
          true
        );
      } else {
        setIsSplitScreenDetected(false);
      }
    };

    // Deteksi Keluar dari Mode Fullscreen (Laptop, Chromebook, Android, iPhone)
    const handleFullscreenChange = () => {
      if (viewRef.current !== 'EXAM') return;
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsCurrentlyFullscreen(isFs);
      if (!isFs && !showStudentCameraModalRef.current && !redWarningOverlay) {
        recordCheatViolation('Keluar dari Mode Layar Penuh (Fullscreen Lock)', true);
      }
    };

    // Proteksi Anti-Copy: Blokir Klik Kanan
    const handleContextMenu = (e: MouseEvent) => {
      if (viewRef.current !== 'EXAM') return;
      e.preventDefault();
      recordCheatViolation('Mencoba Klik Kanan (Right-Click Disabled)', false);
      setSecurityToast('⚠️ DILARANG KLIK KANAN! Soal Ujian Terkunci.');
      setTimeout(() => setSecurityToast(null), 3500);
    };

    // Proteksi Anti-Copy: Blokir Copy Teks
    const handleCopy = (e: ClipboardEvent) => {
      if (viewRef.current !== 'EXAM') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
      }
      recordCheatViolation('Mencoba Menyalin (Copy) Teks Soal Ujian', false);
      setSecurityToast('⚠️ DILARANG MENYALIN (COPY) SOAL UJIAN! Teks soal dan opsi dilindungi.');
      setTimeout(() => setSecurityToast(null), 3500);
    };

    // Proteksi Anti-Copy: Blokir Cut Teks
    const handleCut = (e: ClipboardEvent) => {
      if (viewRef.current !== 'EXAM') return;
      e.preventDefault();
      e.stopPropagation();
      recordCheatViolation('Mencoba Memotong (Cut) Teks Soal Ujian', false);
      setSecurityToast('⚠️ DILARANG MEMOTONG (CUT) TEKS SOAL!');
      setTimeout(() => setSecurityToast(null), 3500);
    };

    // Proteksi Anti-Copy: Blokir Seleksi Teks
    const handleSelectStart = (e: Event) => {
      if (viewRef.current !== 'EXAM') return;
      e.preventDefault();
    };

    // Proteksi Anti-Copy: Blokir Drag Teks
    const handleDragStart = (e: DragEvent) => {
      if (viewRef.current !== 'EXAM') return;
      e.preventDefault();
    };

    // Proteksi Anti-Screenshot & Pintasan Terlarang Lintas Perangkat
    const triggerScreenshotBlock = (shortcutLabel: string) => {
      document.documentElement.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      document.body.classList.add('window-blur-active', 'exam-blackout-buffer-active');
      setScreenshotShieldReason(shortcutLabel);
      setShowScreenshotShield(true);
      try {
        navigator.clipboard?.writeText?.('');
      } catch {}
      setTimeout(() => {
        if (!document.hidden && document.hasFocus()) {
          setShowScreenshotShield(false);
          document.documentElement.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
          document.body.classList.remove('window-blur-active', 'exam-blackout-buffer-active');
        }
      }, 3000);
      recordCheatViolation(`Mencoba Tangkapan Layar (${shortcutLabel} dilarang)`, false);
      setSecurityToast(`📸 DILARANG SCREENSHOT! Sensor anti-tangkapan layar aktif (${shortcutLabel}).`);
      setTimeout(() => setSecurityToast(null), 4000);
    };

    const handleBeforePrint = (e: Event) => {
      if (viewRef.current !== 'EXAM') return;
      e.preventDefault();
      triggerScreenshotBlock('Mencetak / Print Halaman Ujian');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewRef.current !== 'EXAM') return;
      const key = e.key ? e.key.toUpperCase() : '';
      const code = e.code || '';
      const keyCode = e.keyCode;
      const isF12 = e.key === 'F12';
      const isPrintScreen =
        e.key === 'PrintScreen' ||
        code === 'PrintScreen' ||
        keyCode === 44;
      const isMacScreenshot =
        (e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', '6', '$', '%', '^', '&'].includes(e.key);
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
      const isCopyCut =
        (e.ctrlKey || e.metaKey) && ['C', 'c', 'X', 'x', 'A', 'a'].includes(e.key);
      const isPrintOrSave =
        (e.ctrlKey || e.metaKey) && ['P', 'p', 'S', 's', 'U', 'u'].includes(e.key);
      const isDevTools =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(key);

      if (
        isPrintScreen ||
        isMacScreenshot ||
        isWinSnipping ||
        isChromebookScreenshot ||
        isPhysicalVolumeScreenshot
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotBlock(
          isPrintScreen
            ? 'Tombol PrintScreen'
            : isPhysicalVolumeScreenshot
            ? 'Kombinasi Tombol Fisik Volume / Power'
            : isMacScreenshot
            ? 'Mac Screenshot (Cmd+Shift+3/4/5)'
            : isChromebookScreenshot
            ? 'Chromebook Capture (Ctrl+F5)'
            : 'Windows Snipping / Game Bar'
        );
        return;
      }

      if (isCopyCut) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(`Menekan Pintasan Salin (${e.ctrlKey ? 'Ctrl+' : 'Cmd+'}${e.key})`, false);
        setSecurityToast('⚠️ DILARANG MENYALIN (COPY) SOAL UJIAN! Teks soal dan opsi dilindungi.');
        setTimeout(() => setSecurityToast(null), 3500);
        return;
      }

      if (isPrintOrSave) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(`Mencoba Cetak/Simpan Halaman (${e.ctrlKey ? 'Ctrl+' : 'Cmd+'}${e.key})`, false);
        setSecurityToast('⚠️ DILARANG MENCETAK (PRINT) HALAMAN UJIAN!');
        setTimeout(() => setSecurityToast(null), 3500);
        return;
      }

      if (isF12 || isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        recordCheatViolation(`Membuka Developer Tools (${e.key})`, false);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (viewRef.current !== 'EXAM') return;
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.code === 'KeyS' ||
        e.key === 'F5' ||
        e.keyCode === 116
      ) {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('');
        } catch {}
        triggerScreenshotBlock('Pelepasan Tombol Tangkapan Layar');
      }
    };

    const handlePageHide = () => {
      if (viewRef.current === 'EXAM') {
        const disqualifiedRecord = buildSubmissionRecord(
          'Meninggalkan / Menutup Halaman Ujian — Tidak Lulus Ujian (Ujian Susulan)',
          true,
          violationCountRef.current + 1,
          [...violationLogsRef.current, 'Meninggalkan Halaman Ujian']
        );
        disqualifiedRecord.isCompleted = true;
        const nextList = [disqualifiedRecord, ...submissions];
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(nextList));
        pushSubmissionToServer(disqualifiedRecord);
        enqueueSubmissionSync(disqualifiedRecord, {
          sheetUrl: cloudConfigRef.current?.googleSheetUrl,
          appsScriptUrl: cloudConfigRef.current?.appsScriptWebAppUrl,
          immediate: true,
          source: 'Diskualifikasi Kecurangan (Page Hide)',
        });
      }
    };

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
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('dragstart', handleDragStart, true);
    window.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('pagehide', handlePageHide);

    // Blokir Screen Capture API jika ada ekstensi yang mencoba merekam layar
    let origGetDisplayMedia: any = null;
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      (navigator.mediaDevices as any).getDisplayMedia
    ) {
      origGetDisplayMedia = (navigator.mediaDevices as any).getDisplayMedia;
      (navigator.mediaDevices as any).getDisplayMedia = function () {
        triggerScreenshotBlock('Perekaman Layar (Screen Capture API)');
        return Promise.reject(new Error('Perekaman layar diblokir oleh sistem ujian UPTD SMPN 7 Kisaran.'));
      };
    }

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
      if (orientationSettleTimeout) {
        clearTimeout(orientationSettleTimeout);
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      window.removeEventListener('touchstart', handleTouchStart, true);
      window.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('pagehide', handlePageHide);
      document.documentElement.classList.remove('window-blur-active');
      document.body.classList.remove('window-blur-active');

      if (
        origGetDisplayMedia &&
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices
      ) {
        (navigator.mediaDevices as any).getDisplayMedia = origGetDisplayMedia;
      }
    };
  }, [
    view,
    redWarningOverlay,
    detectSplitScreenMode,
    finalizeExam,
    recordCheatViolation,
    buildSubmissionRecord,
    submissions,
  ]);

  // Fungsi menghasilkan 6 digit Kode Token Baru dari Guru Mapel yang belum pernah dipakai
  const generateFreshTeacherToken = useCallback((): string => {
    const usedSet = new Set<string>(
      getUsedExamTokens().map((u) => sanitizeTokenValue(u.token))
    );
    submissions.forEach((s) => {
      if (s.usedToken) usedSet.add(sanitizeTokenValue(s.usedToken));
    });
    if (onlineToken) usedSet.add(sanitizeTokenValue(onlineToken));
    if (inputToken) usedSet.add(sanitizeTokenValue(inputToken));

    for (let i = 0; i < 50; i++) {
      const candidate = String(Math.floor(100000 + Math.random() * 900000));
      if (!usedSet.has(candidate)) {
        return candidate;
      }
    }
    return String(Math.floor(100000 + Math.random() * 900000));
  }, [submissions, onlineToken, inputToken]);

  // Fungsi menerapkan Kode Token Baru dari Guru Mapel ke sistem & form siswa
  const applyNewTokenFromTeacher = useCallback(
    (rawNewToken: string, closeRequestModal: boolean = false) => {
      const cleanNew = sanitizeTokenValue(rawNewToken);
      if (!cleanNew || cleanNew.length < 3) return;

      setIssuedTeacherNewToken(cleanNew);
      setCustomTeacherIssuedInput(cleanNew);
      setIsSheetTokenSynced(true);
      setOnlineToken(cleanNew);
      setTeacherCustomTokenInput(cleanNew);
      setLoginError(null);
      setRetakeTokenError(null);
      setTokenSyncResetKey((k) => k + 1);

      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastTokenSyncTime(nowStr);
      setTokenSourceLabel(`Token Baru dari Guru Mapel (${EXAM_INFO.guruMapel})`);

      const nextCfg: CloudIntegrationConfig = {
        ...cloudConfigRef.current,
        customTeacherToken: cleanNew,
        lockTeacherToken: true,
      };
      setCloudConfig(nextCfg);
      try {
        localStorage.setItem(
          'anbk_cloud_config_v1',
          JSON.stringify({ ...nextCfg, updatedAt: Date.now() })
        );
      } catch {
        // ignore
      }

      pushTokenEventLocallyAndBroadcast(cleanNew, 'Token Baru dari Guru Mapel');
      saveCloudTokenConfigToServer(nextCfg).catch(() => {});

      setTokenSyncToast(
        `✓ Kode Token Baru [${cleanNew}] telah diberikan oleh Guru Mapel (${EXAM_INFO.guruMapel}) dan siap digunakan (kuota 3x pakai)!`
      );
      setTimeout(() => setTokenSyncToast(null), 5000);

      if (closeRequestModal) {
        setShowRequestNewTokenModal(false);
      }
    },
    []
  );

  // Fungsi Meminta Kode Token Baru kepada Guru Mapel (Langsung di Aplikasi, BUKAN kirim WA)
  // KODE TOKEN UJIAN BARU HANYA AKAN MUNCUL ATAU TAMPIL SETELAH SISWA SUDAH 3 KALI MENGGUNAKAN KODE TOKEN UJIAN!
  const handleAskTeacherForNewTokenViaWa = () => {
    const targetTokenToCheck = sanitizeTokenValue(inputToken || onlineToken);
    const usageCheck = checkStudentTokenUsage(
      targetTokenToCheck,
      namaSiswa,
      nisNisn,
      submissions
    );

    if (usageCheck.isAlreadyUsed && usageCheck.usageCount >= 3) {
      const newToken = generateFreshTeacherToken();
      applyNewTokenFromTeacher(newToken, false);
    } else {
      // Jika kode token ujian belum digunakan 3 kali, kode token baru TIDAK muncul / TIDAK diterbitkan
      setIssuedTeacherNewToken('');
      setCustomTeacherIssuedInput('');
    }
    setShowRequestNewTokenModal(true);
  };
  const handleRequestNewTokenFromTeacher = handleAskTeacherForNewTokenViaWa;

  // Handler Form Login Siswa di Halaman HOME -> Masuk ke Petunjuk Ujian
  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!studentPhotoUrl) {
      setLoginError(
        'Siswa WAJIB mengambil atau mengunggah Foto Profil Peserta Ujian terlebih dahulu! Sebelum mengisi identitas dan memulai ujian, silakan ambil foto profil.'
      );
      setShowStudentCameraModal(true);
      return;
    }

    if (!namaSiswa.trim()) {
      setLoginError('Nama Lengkap Siswa wajib diisi.');
      return;
    }
    if (!/^[a-zA-Z\s]+$/.test(namaSiswa.trim())) {
      const errMsg =
        'Nama Lengkap Siswa hanya boleh berisi huruf dan spasi (tidak boleh menggunakan angka atau karakter khusus).';
      triggerNamaSiswaError(errMsg);
      setLoginError(errMsg);
      return;
    }
    if (!nisNisn.trim()) {
      setLoginError('Nomor Induk Siswa (NIS / NISN) wajib diisi.');
      return;
    }

    if (!kelasSiswa) {
      setLoginError('Silakan pilih Kelas Siswa terlebih dahulu.');
      return;
    }
    if (!semesterSiswa) {
      setLoginError('Silakan pilih Semester Ujian terlebih dahulu.');
      return;
    }

    let cleanEnteredToken = sanitizeTokenValue(inputToken);
    if (!cleanEnteredToken && jenisSoalUjian === 'ESAY_TEST') {
      cleanEnteredToken = sanitizeTokenValue(onlineToken) || 'LATIHAN';
      setInputToken(cleanEnteredToken);
    } else if (!cleanEnteredToken) {
      setLoginError(
        `Akses Ujian Ditolak: Kode Token Ujian wajib diisi (3-6 karakter alfanumerik)! Jika Anda ingin mengulangi ujian dan kode token sebelumnya sudah terpakai, silakan masukkan KODE TOKEN BARU — Minta Kode Token Baru kepada Guru Mapelnya (${EXAM_INFO.guruMapelUpper}).`
      );
      return;
    }

    if (jenisSoalUjian === 'PILIHAN_BERGANDA') {
      // KENALI KODE TOKEN YANG DIMASUKAN SISWA & CEK APAKAH SUDAH TERPAKAI 3 KALI (KUOTA 3 KALI PAKAI)
      const tokenUsage = checkStudentTokenUsage(
        cleanEnteredToken,
        namaSiswa,
        nisNisn,
        submissions
      );
      if (tokenUsage.isAlreadyUsed) {
        triggerExhaustedTokenToast(
          cleanEnteredToken,
          tokenUsage.usageCount,
          tokenUsage.usedRecord?.usedAt
        );
        dispatchTeacherTokenExhaustedNotification({
          nisNisn: nisNisn.trim() || tokenUsage.usedRecord?.nisNisn || '-',
          namaSiswa: namaSiswa.trim() || tokenUsage.usedRecord?.namaSiswa || 'Siswa Peserta',
          kelas: kelasSiswa || tokenUsage.usedRecord?.kelas || 'VIII-1',
          semester: semesterSiswa,
          exhaustedToken: cleanEnteredToken,
          usageCount: tokenUsage.usageCount,
          cloudConfig,
          oauthAccessToken: getAccessTokenSync(),
        }).catch(() => {});
        setLoginError(
          `Akses Ujian Ditolak: Kode Token [${cleanEnteredToken}] SUDAH TERPAKAI 3 KALI (3x)${
            tokenUsage.usedRecord?.usedAt ? ` (terakhir pada ${tokenUsage.usedRecord.usedAt})` : ''
          }! Kuota batas penggunaan 3x telah habis. Siswa tidak bisa mengulangi ujian dengan kode token ini lagi. Jika siswa mau mengulangi ujian, siswa harus memasukkan KODE TOKEN YANG BARU — Silakan MINTA KODE TOKEN BARU kepada Guru Mapelnya (${EXAM_INFO.guruMapelUpper})!`
        );
        return;
      }
    }

    // Jika belum pernah ada token yang dipakai sama sekali dan onlineToken aktif belum dipakai, pastikan sesuai atau kenali token baru dari Guru Mapel
    const isOnlineTokenAlreadyUsed = checkStudentTokenUsage(
      onlineToken,
      namaSiswa,
      nisNisn,
      submissions
    ).isAlreadyUsed;
    const hasPreviousUsedTokens = usedTokensList.length > 0 || isOnlineTokenAlreadyUsed;

    if (
      !hasPreviousUsedTokens &&
      isSheetTokenSynced &&
      onlineToken &&
      cleanEnteredToken !== onlineToken.trim().toUpperCase()
    ) {
      // Tetap kenali jika siswa memasukkan kode token baru 6 karakter yang diberikan langsung oleh Guru Mapel
      if (cleanEnteredToken.length < 4) {
        setLoginError(
          `Akses Ujian Ditolak: Kode Token Ujian [${cleanEnteredToken}] tidak sesuai! Masukkan Kode Token Ujian yang valid dari Guru Mapel (${EXAM_INFO.guruMapelUpper}).`
        );
        return;
      }
    }

    // Kenali & simpan kode token yang dimasukkan siswa untuk sesi ujian ini
    setActiveExamToken(cleanEnteredToken);
    activeExamTokenRef.current = cleanEnteredToken;
    setInputToken(cleanEnteredToken);

    const prevAllForStudent = submissions.filter(
      (s) =>
        s.nisNisn.trim().toLowerCase() === nisNisn.trim().toLowerCase() ||
        s.namaSiswa.trim().toLowerCase() === namaSiswa.trim().toLowerCase()
    );
    const seenHistoryForStudent = getStudentSeenQuestionsHistory(
      namaSiswa,
      nisNisn,
      activePackageKey
    );
    if (
      prevAllForStudent.length > 0 ||
      seenHistoryForStudent.attemptCount > 0 ||
      hasPreviousUsedTokens
    ) {
      setIsRetakeSession(
        prevAllForStudent.length > 0 ||
          seenHistoryForStudent.attemptCount > 0 ||
          usedTokensList.length > 0
      );
      setRetakeAttemptCount(
        Math.max(
          prevAllForStudent.length,
          seenHistoryForStudent.attemptCount,
          usedTokensList.length,
          1
        )
      );
      setActiveRetakePreviouslySeenCount(
        Math.max(seenHistoryForStudent.seenFingerprints.length, prevAllForStudent.length * 25)
      );
    } else {
      setIsRetakeSession(false);
      setRetakeAttemptCount(0);
      setActiveRetakePreviouslySeenCount(0);
    }

    try {
      localStorage.setItem('anbk_exam_has_started', 'true');
    } catch {}
    setHasStartedExam(true);
    // Catatan Penting: Siswa TIDAK dimasukkan ke bangku Classroom saat baru login.
    // Siswa HANYA akan otomatis masuk ke Denah Kelas di Classroom & mengisi bangku kosong setelah menyelesaikan semua soal ujian dan LULUS UJIAN (Minimal KKM 75).
    setView('INSTRUCTIONS');
    handleSyncLoginFeaturesToGoogleSheets(true, undefined, 'login_masuk');
  };

  // Handler Klik Tombol Hijau "Mulai Ujian" pada Halaman Petunjuk Ujian atau Tombol "Ujian Ulangan"
  const handleStartFullscreenExam = async (
    forceRetake: boolean = false,
    explicitNewToken?: string
  ) => {
    if (!studentPhotoUrl) {
      setLoginError(
        'Siswa WAJIB mengambil atau mengunggah Foto Profil Peserta Ujian terlebih dahulu sebelum memulai ujian!'
      );
      setView('HOME');
      setHomeSection('PORTAL_UJIAN');
      setShowStudentCameraModal(true);
      return;
    }

    if (jenisSoalUjian === 'ESAY_TEST') {
      try {
        await requestAllPlatformFullscreen();
      } catch (err) {}

      // Muat 15 Soal Esay Online Unik Lintas Perangkat (Android/iPhone/Chromebook/PC) & IP,
      // serta berganti soal baru secara otomatis jika siswa mengulang atau mengikuti ujian susulan
      const targetJenjang = getJenjangFromKelas(kelasSiswa || 'VIII-1');
      const targetSemester = (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
      const freshEssayResult = generateNonRepeatingEssayQuestionsForStudent({
        kelas: kelasSiswa || 'VIII-1',
        semester: targetSemester,
        namaSiswa,
        nisNisn,
        clientIp: effectiveClientIp,
        deviceFingerprint: effectiveDeviceFingerprint,
        deviceModel: effectiveDeviceModel,
        deviceCategory: detectedDevice.deviceCategory,
      });
      setEssayQuestions(freshEssayResult.questions);
      setEssayQuestionSourceText(freshEssayResult.sourceLabel);

      setView('EXAM');
      return;
    }

    const candidateToken = sanitizeTokenValue(
      explicitNewToken || inputToken || activeExamTokenRef.current
    );
    if (!candidateToken) {
      setLoginError(
        `Akses Ujian Ditolak: Kode Token Ujian wajib diisi! Jika ingin mengulangi ujian, siswa harus memasukan KODE TOKEN YANG BARU — Minta Kode Token Baru kepada Guru Mapelnya (${EXAM_INFO.guruMapelUpper}).`
      );
      setView('HOME');
      setHomeSection('PORTAL_UJIAN');
      return;
    }

    // CEK KETAT KUOTA 3 KALI PAKAI: Pastikan kode token belum terpakai 3 kali
    const tokenUsage = checkStudentTokenUsage(
      candidateToken,
      namaSiswa,
      nisNisn,
      submissions
    );
    if (tokenUsage.isAlreadyUsed) {
      setLoginError(
        `Akses Ujian Ditolak: Kode Token [${candidateToken}] SUDAH TERPAKAI 3 KALI (3x)${
          tokenUsage.usedRecord?.usedAt ? ` (terakhir pada ${tokenUsage.usedRecord.usedAt})` : ''
        }! Kuota batas penggunaan 3x telah habis. Siswa tidak bisa mengulangi ujian dengan kode token ini lagi. Jika siswa mau mengulangi ujian, siswa harus memasukkan KODE TOKEN YANG BARU — Minta Kode Token Baru kepada Guru Mapelnya (${EXAM_INFO.guruMapelUpper})!`
      );
      setInputToken('');
      setView('HOME');
      setHomeSection('PORTAL_UJIAN');
      return;
    }

    const prevFailedForStudent = submissions.filter(
      (s) =>
        (s.nisNisn.trim().toLowerCase() === nisNisn.trim().toLowerCase() ||
          s.namaSiswa.trim().toLowerCase() === namaSiswa.trim().toLowerCase()) &&
        (s.nilaiAkhir < EXAM_INFO.kkm || s.lulusTidakLulus.toLowerCase().includes('tidak'))
    );
    const prevAllForStudent = submissions.filter(
      (s) =>
        s.nisNisn.trim().toLowerCase() === nisNisn.trim().toLowerCase() ||
        s.namaSiswa.trim().toLowerCase() === namaSiswa.trim().toLowerCase()
    );
    const seenHistory = getStudentSeenQuestionsHistory(namaSiswa, nisNisn, activePackageKey);
    const isRetake =
      forceRetake ||
      isRetakeSession ||
      prevAllForStudent.length > 0 ||
      seenHistory.attemptCount > 0 ||
      usedTokensList.length > 0;

    // Pastikan jenjang & semester soal benar-benar sesuai dengan Kelas (VII / VIII) dan Semester (Ganjil / Genap) yang dipilih siswa,
    // serta tarik paket soal secara online berdasarkan Device + IP siswa sebelum ujian dimulai!
    const targetJenjang = getJenjangFromKelas(kelasSiswa || 'VIII-1');
    const targetSemester = (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
    const targetPackageKey = getPackageKey(kelasSiswa || 'VIII-1', targetSemester);

    let onlineFetchedQuestions =
      questionBanks[targetPackageKey] ||
      FASE_D_QUESTION_BANKS[targetPackageKey] ||
      questions;

    try {
      const onlinePkg = await fetchOnlineFaseDQuestions(
        targetJenjang,
        targetSemester,
        cloudConfig.appsScriptWebAppUrl,
        true,
        {
          namaSiswa,
          nisNisn,
          kelas: kelasSiswa || 'VIII-1',
          clientIp: effectiveClientIp,
          deviceFingerprint: effectiveDeviceFingerprint,
          deviceModel: effectiveDeviceModel,
        }
      );
      if (onlinePkg.questions && onlinePkg.questions.length >= 20) {
        onlineFetchedQuestions = onlinePkg.questions;
        setOnlineQuestionSourceText(onlinePkg.sourceLabel);
      }
    } catch {
      // Gunakan bank soal paket sesuai jenjang & semester jika sedang offline sesaat
    }

    // Hasilkan 25 Soal Unik Berbeda untuk setiap Siswa, Perangkat Device, dan IP sesuai Kelas (VII/VIII) & Semester (Ganjil/Genap)
    const nonRepeatingResult = generateNonRepeatingRetakeQuestionsForStudent({
      namaSiswa,
      nisNisn,
      packageKey: targetPackageKey,
      baseQuestions: onlineFetchedQuestions,
      isRetake,
      previousSubmissions: submissions,
      deviceIpContext: {
        namaSiswa,
        nisNisn,
        kelas: kelasSiswa || 'VIII-1',
        clientIp: effectiveClientIp,
        deviceFingerprint: effectiveDeviceFingerprint,
        deviceModel: effectiveDeviceModel,
      },
    });

    if (isRetake || nonRepeatingResult.attemptNumber > 1) {
      setIsRetakeSession(true);
      setRetakeAttemptCount(Math.max(1, nonRepeatingResult.attemptNumber - 1));
      setActiveRetakePreviouslySeenCount(nonRepeatingResult.totalPreviouslySeen);
    } else {
      setIsRetakeSession(false);
      setRetakeAttemptCount(0);
      setActiveRetakePreviouslySeenCount(0);
    }

    const lastOrderIds =
      completedSubmission?.questionOrder ||
      prevFailedForStudent[0]?.questionOrder ||
      shuffledQuestionsRef.current.map((q) => q.id);

    const sessionId = `SUB-${Date.now()}`;
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);

    // LANGSUNG CATAT KODE TOKEN SEBAGAI DIGUNAKAN (BERLAKU MAKSIMAL 3 KALI SETIAP MEMULAI UJIAN)
    activeExamTokenRef.current = candidateToken;
    setActiveExamToken(candidateToken);
    recordUsedExamToken({
      token: candidateToken,
      namaSiswa: namaSiswa.trim(),
      nisNisn: nisNisn.trim(),
      kelas: getCleanKelas(kelasSiswa),
      semester: semesterSiswa,
      sessionId,
    });
    setUsedTokensList(getUsedExamTokens());

    const isSplitOnStart = detectSplitScreenMode();
    if (isSplitOnStart) {
      setIsSplitScreenDetected(true);
    } else {
      setIsSplitScreenDetected(false);
    }

    try {
      await requestAllPlatformFullscreen();
    } catch (err) {
      // Lanjut jika browser membatasi fullscreen di dalam iframe
    }

    setTimeout(() => {
      initialViewportRef.current = {
        w: window.innerWidth,
        h: window.innerHeight,
      };
    }, 300);

    const randomized = randomizeQuestionsAndOptions(
      nonRepeatingResult.questions,
      shuffledQuestionsRef.current,
      lastOrderIds,
      `${namaSiswa}|${nisNisn}|${kelasSiswa}|${semesterSiswa}|${effectiveClientIp}|${effectiveDeviceFingerprint}|${effectiveDeviceModel}|${sessionId}`
    );
    setShuffledQuestions(randomized);
    shuffledQuestionsRef.current = randomized;
    setCurrentQuestionIndex(0);
    setAnswers({});
    answersRef.current = {};
    setDoubtful({});
    doubtfulRef.current = {};
    setQuestionDurations({});
    questionDurationsRef.current = {};
    setExamSecondsLeft(EXAM_INFO.durasiDetik);
    hasWarned5MinRef.current = false;
    hasWarned1MinRef.current = false;
    setTimerWarningAlert(null);
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      }
    } catch {
      // ignore
    }
    setViolationCount(0);
    violationCountRef.current = 0;
    setViolationLogs([]);
    violationLogsRef.current = [];
    setRedWarningOverlay(false);
    setAutoReturnHomeSeconds(null);
    setIsDisqualifiedResult(false);
    setShowSubmitConfirmModal(false);
    setIsSelfEvalLocked(false);
    setExamSidebarTab('ALL');

    const startTimeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const initialSessionBattery: BatteryHistoryPoint[] = [
      {
        timestamp: startTimeStr,
        elapsedLabel: '00:00 (Mulai)',
        elapsedSeconds: 0,
        level: batteryStateRef.current.level,
        charging: batteryStateRef.current.charging,
        questionNumber: 1,
        eventNote: isRetake ? 'Mulai Sesi Ujian Ulangan' : 'Mulai Sesi Ujian Layar Penuh',
      },
    ];
    setBatteryHistory(initialSessionBattery);
    batteryHistoryRef.current = initialSessionBattery;
    try {
      localStorage.setItem(
        'anbk_battery_session_history_v1',
        JSON.stringify(initialSessionBattery)
      );
    } catch {
      // ignore
    }

    try {
      localStorage.setItem('anbk_exam_has_started', 'true');
    } catch {}
    setHasStartedExam(true);
    setView('EXAM');

    if (isSplitOnStart) {
      setViolationCount(1);
      violationCountRef.current = 1;
      setViolationLogs([
        `${new Date().toLocaleTimeString('id-ID')}: Terdeteksi Layar Terbelah (Split-Screen) saat Mulai Ujian`,
      ]);
      violationLogsRef.current = [
        `${new Date().toLocaleTimeString('id-ID')}: Terdeteksi Layar Terbelah (Split-Screen) saat Mulai Ujian`,
      ];
      setWarningReasonText('Terdeteksi Membelah Layar (Split-Screen / Multi-Window)');
      setWarningCountdown(15);
      setRedWarningOverlay(true);
      playAudioCue('violation');
    }

    setTimeout(() => {
      const initialRecord = buildSubmissionRecord(
        isRetake
          ? 'Sedang Mengerjakan Ujian Ulangan (Soal & Jawaban Diacak - 0 Pelanggaran)'
          : 'Sedang Mengerjakan Ujian (0 Pelanggaran)',
        false,
        0,
        []
      );
      syncSubmissionToCloud(initialRecord, false);
    }, 200);
  };

  // Handler Mulai Ujian Ulangan: WAJIB memasukkan Kode Token Baru (Tidak bisa memakai kode token yang sudah dipakai sewaktu memulai ujian)
  const handleRetakeExam = () => {
    setRedWarningOverlay(false);
    setAutoReturnHomeSeconds(null);
    setIsDisqualifiedResult(false);
    setIsRetakeSession(true);
    setInputToken('');
    setRetakeNewTokenInput('');
    setRetakeTokenError(null);
    setShowQuickTeacherInRetakeModal(false);
    setShowRetakeTokenModal(true);
  };

  const handleConfirmRetakeWithNewToken = (e: React.FormEvent) => {
    e.preventDefault();
    setRetakeTokenError(null);
    const cleanNewTok = sanitizeTokenValue(retakeNewTokenInput);
    if (!cleanNewTok) {
      setRetakeTokenError(
        `Kode Token Baru wajib diisi (3-6 karakter alfanumerik)! Silakan minta Kode Token Baru kepada Guru Mapelnya (${EXAM_INFO.guruMapelUpper}).`
      );
      return;
    }

    const usageCheck = checkStudentTokenUsage(
      cleanNewTok,
      namaSiswa,
      nisNisn,
      submissions
    );
    if (usageCheck.isAlreadyUsed) {
      setRetakeTokenError(
        `DITOLAK! Kode Token [${cleanNewTok}] SUDAH TERPAKAI 3 KALI (3x)${
          usageCheck.usedRecord?.usedAt ? ` (terakhir pada ${usageCheck.usedRecord.usedAt})` : ''
        }. Kuota batas penggunaan 3x telah habis. Siswa tidak bisa mengulangi ujian dengan kode token yang sudah terpakai 3 kali! Jika siswa mau mengulangi ujian, siswa harus memasukkan KODE TOKEN YANG BARU — Minta Kode Token Baru kepada Guru Mapelnya (${EXAM_INFO.guruMapelUpper})!`
      );
      return;
    }

    // Kode Token Baru dikenali dan belum pernah dipakai -> mulai ujian ulangan!
    setInputToken(cleanNewTok);
    setActiveExamToken(cleanNewTok);
    activeExamTokenRef.current = cleanNewTok;
    setShowRetakeTokenModal(false);
    setRetakeAttemptCount((prev) => prev + 1);
    handleStartFullscreenExam(true, cleanNewTok);
  };

  // Handler Opsi Remedial Otomatis untuk siswa di bawah KKM 75
  const handleStartRemedialExam = useCallback(
    async (payload: RemedialStartPayload) => {
      const targetSub = payload.sourceSubmission || completedSubmission;
      const effectiveNama = (targetSub?.namaSiswa || namaSiswa || 'Peserta Ujian').trim();
      const effectiveNis = (targetSub?.nisNisn || nisNisn || '-').trim();
      const effectiveKls = targetSub?.kelas || kelasSiswa || 'VIII-1';
      const effectiveSem = (targetSub?.semester || semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
      const pkgKey = getPackageKey(effectiveKls, effectiveSem);

      const baseQs =
        questionBanks[pkgKey] ||
        FASE_D_QUESTION_BANKS[pkgKey] ||
        (shuffledQuestions.length > 0 ? shuffledQuestions : questions);

      // Hasilkan paket soal remedial terfokus pada materi yang belum dikuasai
      const remedialPackage = generateFocusedRemedialPackageForStudent({
        namaSiswa: effectiveNama,
        nisNisn: effectiveNis,
        packageKey: pkgKey,
        unmasteredElements: payload.targetElements,
        difficultyMode: payload.difficultyMode,
        questionCount: payload.questionCount,
        baseQuestions: baseQs,
        previousSubmission: targetSub || undefined,
      });

      const seed = `${effectiveNama}|${effectiveNis}|${effectiveKls}|${effectiveSem}|REMEDIAL|${payload.difficultyMode}|${remedialPackage.remedialToken}`;
      const randomizedRemedial = randomizeQuestionsAndOptions(
        remedialPackage.questions,
        [],
        remedialPackage.questions.map((q) => q.id),
        seed
      );

      setShuffledQuestions(randomizedRemedial);
      shuffledQuestionsRef.current = randomizedRemedial;
      setCurrentQuestionIndex(0);
      setAnswers({});
      answersRef.current = {};
      setDoubtful({});
      doubtfulRef.current = {};
      setQuestionDurations({});
      questionDurationsRef.current = {};

      const remedialDuration = Math.min(
        EXAM_INFO.durasiDetik,
        Math.max(15 * 60, payload.questionCount * 120)
      );
      setExamSecondsLeft(remedialDuration);
      hasWarned5MinRef.current = false;
      hasWarned1MinRef.current = false;
      setTimerWarningAlert(null);

      setIsRetakeSession(true);
      setIsRemedialSession(true);
      setRemedialActiveMeta({
        packageTitle: remedialPackage.packageTitle,
        difficultyMode: payload.difficultyMode,
        targetElements: payload.targetElements,
        originalScore: targetSub?.nilaiAkhir || 0,
        questionCount: payload.questionCount,
      });

      const sessionId = `REM-${Date.now()}`;
      activeSessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);

      activeExamTokenRef.current = remedialPackage.remedialToken;
      setActiveExamToken(remedialPackage.remedialToken);
      recordUsedExamToken({
        token: remedialPackage.remedialToken,
        namaSiswa: effectiveNama,
        nisNisn: effectiveNis,
        kelas: getCleanKelas(effectiveKls),
        semester: effectiveSem,
        sessionId,
      });
      setUsedTokensList(getUsedExamTokens());

      setViolationCount(0);
      violationCountRef.current = 0;
      setViolationLogs([]);
      violationLogsRef.current = [];
      setRedWarningOverlay(false);
      setAutoReturnHomeSeconds(null);
      setIsDisqualifiedResult(false);
      setShowSubmitConfirmModal(false);
      setIsSelfEvalLocked(false);
      setExamSidebarTab('ALL');

      const startTimeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const initialBattery: BatteryHistoryPoint[] = [
        {
          timestamp: startTimeStr,
          elapsedLabel: '00:00 (Mulai)',
          elapsedSeconds: 0,
          level: batteryStateRef.current.level,
          charging: batteryStateRef.current.charging,
          questionNumber: 1,
          eventNote: `Mulai Paket Remedial (${payload.difficultyMode})`,
        },
      ];
      setBatteryHistory(initialBattery);
      batteryHistoryRef.current = initialBattery;

      try {
        localStorage.setItem('anbk_exam_has_started', 'true');
      } catch {}

      try {
        await requestAllPlatformFullscreen();
      } catch (err) {}

      setView('EXAM');
      window.scrollTo(0, 0);

      const modeTitle =
        payload.difficultyMode === 'REGULER'
          ? 'Fokus Konsep Dasar (Reguler)'
          : payload.difficultyMode === 'HOTS'
          ? 'Penguatan Analisis Tinggi (HOTS)'
          : 'Adaptif Berimbang (Reguler & HOTS)';

      setTokenSyncToast(
        `🎯 Paket Soal Remedial Dimulai (${randomizedRemedial.length} Soal · ${modeTitle}) · Target KKM 75!`
      );
      setTimeout(() => setTokenSyncToast(null), 6500);
    },
    [
      completedSubmission,
      namaSiswa,
      nisNisn,
      kelasSiswa,
      semesterSiswa,
      questionBanks,
      shuffledQuestions,
      questions,
      requestAllPlatformFullscreen,
    ]
  );

  // Handler Navigasi Antar Soal dengan Animasi Slide Horizontal Halus
  const handleNavigateToQuestion = (targetIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(shuffledQuestions.length - 1, targetIndex));
    if (clampedIndex === currentQuestionIndex) return;
    setQuestionSlideDirection(clampedIndex > currentQuestionIndex ? 'next' : 'prev');
    setCurrentQuestionIndex(clampedIndex);
  };

  // Handler Pilih Jawaban Siswa (Langsung Auto-Save ke Google Sheet / Storage)
  const handleSelectOption = (questionId: number, optionLetter: 'A' | 'B' | 'C' | 'D') => {
    if (showSubmitConfirmModal || isSelfEvalLocked) return;
    playAudioCue('answer');
    const updatedAnswers = { ...answers, [questionId]: optionLetter };
    setAnswers(updatedAnswers);
    answersRef.current = updatedAnswers;

    const elapsedSec = Math.max(0, EXAM_INFO.durasiDetik - examSecondsLeft);
    const qNumber = currentQuestionIndex + 1;
    appendBatteryHistoryPoint(
      batteryStateRef.current.level,
      batteryStateRef.current.charging,
      undefined,
      elapsedSec,
      qNumber,
      `Menjawab Soal #${qNumber} (Opsi ${optionLetter})`
    );

    const record = buildSubmissionRecord(undefined, false);
    record.answers = updatedAnswers;
    syncSubmissionToCloud(record, false);
  };

  // Handler Tandai Ragu-Ragu
  const handleToggleDoubtful = (questionId: number) => {
    if (showSubmitConfirmModal || isSelfEvalLocked) return;
    const updatedDoubtful = { ...doubtful, [questionId]: !doubtful[questionId] };
    setDoubtful(updatedDoubtful);
    doubtfulRef.current = updatedDoubtful;
  };

  // Handler Tombol Hijau "Kembali ke Ujian" pada Overlay Merah Pindah Tab / Split-Screen
  const handleResumeFromRedOverlay = async () => {
    if (violationCount >= 3) {
      // Tidak dapat kembali jika sudah mencapai 3 kali pelanggaran (diskualifikasi mutlak)
      return;
    }
    if (detectSplitScreenMode()) {
      setIsSplitScreenDetected(true);
      setSecurityToast(
        '⚠️ Layar masih dalam kondisi terbelah (Split-Screen)! Harap tutup aplikasi lain dan kembalikan ke layar penuh terlebih dahulu.'
      );
      setTimeout(() => setSecurityToast(null), 4500);
      return;
    }
    setIsSplitScreenDetected(false);
    setRedWarningOverlay(false);
    try {
      await requestAllPlatformFullscreen();
    } catch (e) {
      // Ignore
    }
  };

  // Handler Login Mode Guru (Password 31051990)
  const handleTeacherLoginSubmit = (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    try {
      sessionStorage.setItem('anbk_teacher_verified_session_v1', 'true');
    } catch {
      // ignore
    }
    setShowTeacherModal(false);
    setTeacherPasswordInput('');
    setTeacherPasswordError(null);
    setView('TEACHER');
  };

  const currentQuestion = shuffledQuestions[currentQuestionIndex] || questions[0];
  const hotsCount = questions.filter((q) => q.difficulty === 'HOTS').length;
  const regulerCount = questions.filter((q) => q.difficulty === 'REGULER').length;

  const isAnyFetchingActive = isAppInitializing;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        darkMode
          ? 'bg-gradient-to-br from-slate-950 via-sky-950/80 to-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-sky-100/80 via-slate-50 to-sky-50 text-slate-900'
      } ${view === 'EXAM' ? 'exam-lock-select' : ''}`}
    >
      {/* =================================================================== */}
      {/* TOP BAR CONTRACT (3 ZONES: Brand Title — Nav Links — Primary Actions) */}
      {/* =================================================================== */}
      {view !== 'EXAM' && (
        <header
          className={`sticky top-0 z-30 border-b transition-colors no-print backdrop-blur-md ${
            darkMode
              ? 'bg-slate-950/90 border-sky-500/25 text-white shadow-md'
              : 'bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border-sky-500/30 text-white shadow-md'
          }`}
        >
          {/* Container kompak, rapi, dan profesional digeser ke sebelah kiri */}
          <div className="max-w-6xl w-full mx-auto px-1.5 sm:px-3 lg:px-4 py-1 sm:py-1.5 flex flex-col gap-1 items-start">
            {/* Baris Atas: Brand Title & Status Indikator rata kiri, satu baris sejajar */}
            <div className="flex flex-nowrap items-center justify-start gap-1 sm:gap-1.5 w-full overflow-x-auto no-scrollbar py-0.5">
              {/* Zone 1: Brand Title */}
              <a
                href="#beranda"
                onClick={(e) => {
                  e.preventDefault();
                  setView('HOME');
                  setHomeSection('PORTAL_UJIAN');
                }}
                className="font-display text-xs sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-sky-300 transition-colors flex flex-nowrap items-center gap-1.5 sm:gap-2 mr-1"
              >
                <span>GRUP INFORMATIKA</span>
                <span className="inline-flex items-center h-6 sm:h-7 text-[8.5px] sm:text-[10px] font-sans font-semibold px-2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 leading-none">
                  UPTD SMPN 7 Kisaran
                </span>
              </a>

              {/* Zone 3: Profil Siswa + Indikator Baterai Otomatis + Lock Full Screen di Samping Kiri */}
              <div className="flex flex-nowrap items-center justify-start gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowStudentCameraModal(true)}
                  className="inline-flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 pl-1 sm:pl-1.5 pr-2.5 sm:pr-3 rounded-lg border border-amber-400/70 bg-slate-900/95 hover:bg-slate-800 hover:border-amber-300 active:scale-[0.99] transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
                  title="Klik untuk membuka Kamera & Profil Siswa"
                >
                  <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-md overflow-hidden border border-amber-400 bg-gradient-to-br from-sky-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
                    {studentPhotoUrl ? (
                      <img
                        src={studentPhotoUrl}
                        alt={namaSiswa || 'Foto Siswa'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-mono text-[10px] sm:text-[11px] font-extrabold text-white">
                        {getStudentInitials(namaSiswa || 'SW')}
                      </span>
                    )}
                  </div>
                  <div className="text-left leading-tight flex items-center gap-1.5 max-w-[160px] sm:max-w-[220px]">
                    <span className="text-[11px] sm:text-xs font-extrabold text-white truncate">
                      {namaSiswa.trim() ? `${namaSiswa.trim()} (${kelasSiswa})` : 'Profil & Kamera'}
                    </span>
                    <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
                  </div>
                </button>

                {(() => {
                  const isCriticalBat = !batteryState.charging && batteryState.level < 15;
                  const isLowBat = !batteryState.charging && batteryState.level <= 20;
                  return (
                    <div
                      role="status"
                      aria-live={isCriticalBat ? 'assertive' : 'polite'}
                      className={`inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border text-xs sm:text-sm font-mono font-black tabular-nums leading-none shrink-0 transition-all shadow-sm ${
                        isCriticalBat
                          ? 'bg-rose-600 border-rose-200 text-white ring-2 ring-rose-400 animate-pulse animate-battery-indicator-critical-pulse'
                          : isLowBat
                          ? 'bg-amber-500/30 border-amber-300/80 text-amber-200 animate-pulse'
                          : batteryState.charging
                          ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-300'
                          : 'bg-slate-900/95 border-sky-400/40 text-sky-200'
                      }`}
                    >
                      {batteryState.charging ? (
                        <BatteryCharging className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400 shrink-0 animate-pulse" />
                      ) : isCriticalBat ? (
                        <BatteryWarning className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white shrink-0 animate-bounce" />
                      ) : isLowBat ? (
                        <BatteryLow className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-300 shrink-0" />
                      ) : (
                        <Battery className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="tracking-wide">{batteryState.level}%</span>
                      {isCriticalBat && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-rose-700 text-[8px] sm:text-[9px] font-black uppercase leading-none shadow-xs">
                          KRITIS
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div
                  role="status"
                  aria-label="Lock Full Screen Otomatis Aktif"
                  title="Lock Full Screen Otomatis Aktif"
                  className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg border bg-emerald-950/90 border-emerald-400/60 text-emerald-200 text-xs sm:text-sm font-mono font-bold tracking-tight shadow-sm whitespace-nowrap select-none leading-none shrink-0"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)] animate-pulse shrink-0" />
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300 shrink-0" />
                  <span className="font-extrabold tracking-wide">LOCK</span>
                </div>
              </div>
            </div>

            {/* Baris Bawah: Navigasi Menu ditata ke bawah dan sejajar agar tidak memanjang kesamping */}
            <nav className="flex items-center gap-0.5 sm:gap-1 text-[7.5px] sm:text-[8.5px] font-semibold text-slate-300 overflow-x-auto pb-0.5 border-t border-white/10 pt-0.5 sm:pt-1 w-full no-scrollbar">
              <button
                onClick={() => {
                  setView('HOME');
                  setHomeSection('PORTAL_UJIAN');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded text-[7.5px] sm:text-[8.5px] transition-colors cursor-pointer whitespace-nowrap ${
                  view === 'HOME' && homeSection === 'PORTAL_UJIAN'
                    ? 'bg-sky-500 text-white font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Portal Ujian
              </button>
              <button
                onClick={() => {
                  setView('HOME');
                  setHomeSection('MONITORING_UJIAN');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  view === 'HOME' && homeSection === 'MONITORING_UJIAN'
                    ? 'bg-emerald-500 text-white border-emerald-400 font-bold shadow-xs'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30 hover:text-white'
                }`}
                title="Panel Fitur Monitoring Ujian Siswa Real-Time (Pantau Siswa Sedang Mengerjakan, Nilai, Durasi, dan Sensor Anti-Curang)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
                <MonitorCheck className="w-2.5 h-2.5 text-emerald-300" />
                <span>Monitoring Ujian (Live)</span>
              </button>
              <button
                onClick={() => {
                  setView('HOME');
                  setHomeSection('ABSENSI_SISWA');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  view === 'HOME' && homeSection === 'ABSENSI_SISWA'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                    : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/30 hover:text-white'
                }`}
                title="Menu Baru Disamping Monitoring: Presensi & Kehadiran Siswa (Sidik Jari Biometrik, QR Code, RFID, Swafoto GPS & Multi-Role)"
              >
                <Fingerprint className="w-2.5 h-2.5 text-emerald-300" />
                <span>Presensi &amp; Kehadiran Siswa</span>
              </button>
              <button
                onClick={() => {
                  setView('HOME');
                  setHomeSection('KISI_MATERI');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap ${
                  view === 'HOME' && homeSection === 'KISI_MATERI'
                    ? 'bg-sky-500 text-white border-sky-400 font-bold shadow-xs'
                    : 'bg-sky-500/20 text-white border-sky-400/30 hover:bg-sky-500/30 hover:text-white'
                }`}
              >
                Kisi-Kisi & KKM
              </button>
              <button
                onClick={() => {
                  setView('HOME');
                  setHomeSection('ATURAN_ANTI_CURANG');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap ${
                  view === 'HOME' && homeSection === 'ATURAN_ANTI_CURANG'
                    ? 'bg-sky-500 text-white border-sky-400 font-bold shadow-xs'
                    : 'bg-sky-500/20 text-white border-sky-400/30 hover:bg-sky-500/30 hover:text-white'
                }`}
              >
                Sistem Anti-Curang
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoReturnHomeSeconds(null);
                  setRedWarningOverlay(false);
                  setHeaderJenjangFilter('ALL');
                  startTransition(() => {
                    setView('STUDENT_DASHBOARD');
                  });
                  window.scrollTo(0, 0);
                  window.setTimeout(() => {
                    handleSyncStudentDashboard(true);
                  }, 500);
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap active:scale-95 ${
                  view === 'STUDENT_DASHBOARD'
                    ? 'bg-amber-500 text-white border-amber-400 font-bold shadow-xs'
                    : 'bg-sky-500/20 text-white border-sky-400/30 hover:bg-sky-500/30 hover:text-white'
                }`}
              >
                Siswa Dashboard ({filteredSubmissionsByHeader.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoReturnHomeSeconds(null);
                  setRedWarningOverlay(false);
                  setHasEnteredClassroom(true);
                  startTransition(() => {
                    setView('DESIGN_CLASSROOM');
                  });
                  window.scrollTo(0, 0);
                  window.setTimeout(() => {
                    try {
                      localStorage.setItem('anbk_classroom_has_entered', 'true');
                    } catch {}
                  }, 150);
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap active:scale-95 ${
                  view === 'DESIGN_CLASSROOM'
                    ? 'bg-emerald-500 text-white border-emerald-400 font-bold shadow-xs'
                    : 'bg-sky-500/20 text-white border-sky-400/30 hover:bg-sky-500/30 hover:text-white'
                }`}
              >
                Design Classroom
              </button>
              <button
                onClick={() => {
                  setShowTeacherModal(true);
                  setTeacherPasswordError(null);
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[7.5px] sm:text-[8.5px] border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  view === 'TEACHER'
                    ? 'bg-amber-500 text-white border-amber-400 font-bold shadow-xs'
                    : 'bg-purple-950/60 text-amber-300 border-purple-400/50 hover:bg-purple-900/80 hover:text-white'
                }`}
                title="Khusus Guru & Operator Sekolah: Wajib Password Mode Guru agar murid tidak bisa mengakses"
              >
                <Lock className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                <span>Panel Guru / Admin Sekolah</span>
              </button>
            </nav>
          </div>
        </header>
      )}

      {/* =================================================================== */}
      {/* VIEW 1: HALAMAN MENU UTAMA / HOME (DESAIN BARU LEBIH MENARIK & ELEGAN) */}
      {/* =================================================================== */}
      {view === 'HOME' && (
        <main className="relative flex-1 max-w-6xl w-full mx-auto px-1.5 sm:px-3 lg:px-4 py-1.5 sm:py-2.5 space-y-1.5 sm:space-y-2.5">
          {/* VISUAL LOADING INDICATOR: Menampilkan Feedback Status saat Aplikasi Sedang Inisialisasi atau Mengambil Data */}
          {isAnyFetchingActive && (
            <div
              role="status"
              aria-live="polite"
              className="relative overflow-hidden rounded-lg sm:rounded-xl border border-sky-400/40 bg-gradient-to-r from-slate-950 via-sky-950/95 to-slate-950 px-2.5 py-1.5 sm:px-3 sm:py-2 text-white shadow-md shadow-sky-950/60 transition-all duration-300 animate-in fade-in slide-in-from-top-1 transform-gpu"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shrink-0 shadow-inner">
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-amber-300" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono text-[7px] sm:text-[8px] font-black uppercase tracking-wider">
                        {isAppInitializing ? 'INISIALISASI SISTEM' : 'SINKRONISASI DATA'}
                      </span>
                      <strong className="text-[9px] sm:text-[10.5px] font-extrabold text-white truncate tracking-wide">
                        {isAppInitializing
                          ? 'Memuat & Menyiapkan Portal Ujian ANBK...'
                          : isSyncingOnlineQuestions
                          ? 'Mengambil Bank Soal Online Fase D...'
                          : isSyncingEssayQuestions
                          ? 'Memuat Soal Esay Test dari Server...'
                          : isSyncingDashboard
                          ? 'Menyinkronkan Rekap Nilai & Google Sheets...'
                          : isSyncingTokenManual
                          ? 'Memverifikasi Kode Token Ujian...'
                          : isSyncingLoginSheet
                          ? 'Memvalidasi Data Siswa ke Google Sheets...'
                          : 'Sedang Mengambil & Memperbarui Data...'}
                      </strong>
                    </div>
                    <p className="text-[7.5px] sm:text-[9px] text-sky-200/80 truncate">
                      {isAppInitializing
                        ? 'Menghubungkan ke Cloud Firestore, Bank Soal Kurikulum Merdeka & Mode Anti-Curang'
                        : 'Memproses pembaruan data secara real-time lintas server dan perangkat'}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-[8px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                  <span>KONEKSI AKTIF</span>
                </div>
              </div>

              {/* Progress Bar Animasi Halus di Bagian Bawah */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-950 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400 animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* NOTIFIKASI TOAST MENONJOL SAAT SISWA MEMASUKKAN KODE TOKEN YANG SUDAH MENCAPAI BATAS 3 KALI PAKAI */}
          {exhaustedTokenToast && (
            <div
              role="alert"
              aria-live="assertive"
              className="fixed top-12 sm:top-14 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-lg rounded-xl border-2 border-rose-400 bg-gradient-to-r from-rose-950 via-red-950 to-slate-950 p-2.5 sm:p-3.5 text-white shadow-[0_12px_35px_rgba(225,29,72,0.55)] ring-2 ring-amber-400/60 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/30 border border-rose-400 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 animate-pulse">
                    <AlertOctagon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-mono text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider">
                        KUOTA 3x HABIS ({exhaustedTokenToast.usageCount}/3)
                      </span>
                      <strong className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wide text-amber-300">
                        Kode Token [{exhaustedTokenToast.token}] Tidak Dapat Digunakan Lagi!
                      </strong>
                    </div>
                    <p className="text-[9.5px] sm:text-[11px] text-rose-100 leading-snug">
                      Kode token <strong className="font-mono text-white">[{exhaustedTokenToast.token}]</strong> sudah mencapai batas maksimal <strong className="text-white">3 kali pemakaian (3x)</strong>
                      {exhaustedTokenToast.lastUsedAt ? ` (terakhir dipakai: ${exhaustedTokenToast.lastUsedAt})` : ''}.
                    </p>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/90 border border-amber-400/50 text-[9px] sm:text-[10.5px] text-amber-200 leading-snug">
                      <strong className="text-emerald-300 block">
                        📢 Instruksi Penting untuk Peserta Ujian:
                      </strong>
                      Segera <strong className="text-white underline">hubungi Guru Mapel Informatika ({EXAM_INFO.guruMapel})</strong> atau tekan tombol <strong className="text-emerald-300">&quot;Minta Kode Token Baru ke Guru&quot;</strong> di bawah ini untuk mendapatkan Kode Token Ujian yang baru.
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setExhaustedTokenToast(null);
                          handleRequestNewTokenFromTeacher();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[9.5px] sm:text-[10.5px] shadow-sm cursor-pointer transition-transform active:scale-95"
                      >
                        <KeyRound className="w-3 h-3 shrink-0" />
                        <span>Hubungi / Minta Token Baru ke Guru Mapel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInputToken('');
                          setLoginError(null);
                          setExhaustedTokenToast(null);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-[9px] sm:text-[10px] cursor-pointer"
                      >
                        <span>Kosongkan Kolom Token</span>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExhaustedTokenToast(null)}
                  aria-label="Tutup Peringatan Token"
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {/* 1. HERO BANNER INSTITUSIONAL ANBK & LOGO TUT WURI HANDAYANI */}
          <section className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-sky-400/35 shadow-lg bg-slate-950 text-white transform-gpu will-change-transform backface-hidden">
            {/* Tombol Kamera di Sudut Sebelah Kiri Atas */}
            <button
              type="button"
              onClick={() => setShowHeroBannerModal(true)}
              title="Ganti Gambar Lab Komputer"
              aria-label="Ganti Gambar Lab Komputer"
              className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-30 inline-flex items-center justify-center p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-slate-950/50 hover:bg-slate-900/80 text-white border border-white/25 shadow-none transition-transform cursor-pointer active:scale-95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            >
              <Camera className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-white/90 shrink-0" />
            </button>

            {/* Background Image Laboratorium Komputer Tanpa Warna Hitam */}
            {!heroImgError ? (
              <img
                src={heroBannerUrl}
                alt="Laboratorium Komputer ANBK UPTD SMP Negeri 7 Kisaran"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none transform-gpu"
                loading="eager"
                decoding="async"
                style={{ opacity: 1 }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-sky-900 via-sky-800 to-indigo-900 opacity-90" />
            )}
            {/* Lapisan Transparan Murni Tanpa Warna Hitam */}
            <div className="absolute inset-0 bg-transparent pointer-events-none" />

            {/* Konten Hero (Kompak, Proporsional, Rapi, dan Profesional untuk Android, iPhone, & Desktop) */}
            <div className="relative z-10 px-2 pt-2.5 pb-1.5 sm:px-3 sm:pt-3 sm:pb-2 flex flex-col gap-1.5 bg-transparent">
              {/* Jam Digital & Tanggal Dipindahkan ke Atas & Diposisikan di Tengah-Tengah */}
              <div className="w-full flex justify-center items-center">
                <div className="w-full max-w-xs sm:max-w-sm">
                  <ProfessionalHeroClock />
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5">
                {/* Kiri: Logo Resmi Tut Wuri Handayani & Identitas Sekolah dengan Latar Transparan Murni */}
                <div className="relative flex flex-row items-center gap-1.5 sm:gap-2 text-left flex-1 min-w-0 lg:pr-2 bg-transparent p-1.5 rounded-lg border border-white/25 shadow-none">
                  <div className="p-0.5 sm:p-1 rounded-md bg-white/95 shadow-sm ring-1 ring-sky-400/40 shrink-0 select-none pointer-events-none transform transition-transform hover:scale-105">
                    <TutWuriLogo size="md" className="!w-10 !h-10 sm:!w-12 sm:!h-12 border-0 shadow-none drop-shadow-sm" />
                  </div>

                  <div className="space-y-0.5 min-w-0 flex-1 bg-transparent">
                    <h1 className="font-display text-[10px] sm:text-xs lg:text-sm font-extrabold tracking-wide uppercase text-amber-400 leading-tight truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                      {EXAM_INFO.namaSekolah}
                    </h1>
                    <div className="flex flex-nowrap items-center justify-start gap-1 overflow-x-auto no-scrollbar">
                      <p className="text-[7.5px] sm:text-[9px] font-extrabold tracking-wider uppercase text-amber-300 whitespace-nowrap shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        SOAL INFORMATIKA
                      </p>
                      <span className="text-sky-300 text-[7.5px] sm:text-[9px] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">•</span>
                      <span className="inline-block text-[7px] sm:text-[8.5px] font-semibold px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 whitespace-nowrap shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        Kurikulum Merdeka Fase D
                      </span>
                    </div>
                    <p className="text-[7.5px] sm:text-[9px] text-white leading-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      Mapel: <strong className="text-white">{EXAM_INFO.mataPelajaran}</strong> · T.A.: <strong className="text-white">{EXAM_INFO.tahunAjaran}</strong>
                    </p>
                  </div>
                </div>

                {/* Kanan: Kartu Foto Pembuat Soal Ujian + Portal Resmi ANBK di Bawah */}
                <div className="shrink-0 lg:w-60 space-y-1 bg-transparent">
                  <div className="bg-transparent border border-amber-400/50 rounded-lg p-1.5 space-y-1 shadow-none">
                    <div className="flex items-center gap-2">
                      {/* Bingkai Pas Foto 3:4 Pembuat Soal Ujian (Default Permanen) */}
                      <div className="relative shrink-0">
                        <div className="w-10 sm:w-12 aspect-[3/4] rounded-md overflow-hidden border border-amber-400 shadow-xs bg-[#EE0000] flex items-center justify-center select-none pointer-events-none">
                          {teacherPhotoUrl && !teacherPhotoError ? (
                            <img
                              src={teacherPhotoUrl}
                              alt={`Foto Pembuat Soal Ujian - ${EXAM_INFO.guruMapel}`}
                              onError={() => setTeacherPhotoError(true)}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-400/25 border border-amber-400/50 text-[6.5px] sm:text-[7px] uppercase tracking-wider text-amber-300 font-extrabold leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                          <GraduationCap className="w-2 h-2 shrink-0" />
                          PEMBUAT SOAL UJIAN
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-extrabold text-white tracking-wide block leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate">
                          {EXAM_INFO.guruMapelUpper}
                        </span>
                        <span className="text-[7.5px] sm:text-[8px] text-sky-300 font-semibold block leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                          Guru Mata Pelajaran Informatika · {EXAM_INFO.namaSekolah}
                        </span>
                      </div>
                    </div>
                    <div className="pt-0.5 border-t border-white/25 text-[7.5px] sm:text-[8px] text-white flex items-center justify-between tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      <span>Durasi: <strong className="text-amber-300">30 Menit</strong></span>
                      <span>·</span>
                      <span>Total: <strong className="text-white">{questions.length} Soal</strong></span>
                      <span>·</span>
                      <span>KKM: <strong className="text-emerald-300">{EXAM_INFO.kkm}</strong></span>
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between gap-1 px-1.5 py-0.5 rounded bg-slate-950/70 border border-sky-400/45 text-[7px] sm:text-[8px] font-extrabold tracking-wider uppercase text-sky-200 shadow-none text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    <span className="truncate">PORTAL RESMI ANBK · T.A. {EXAM_INFO.tahunAjaran}</span>
                    <span className="shrink-0 text-emerald-300 font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">{activeExamSession.sessionName}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. MENU NAVIGASI INTERAKTIF BERANDA (SEGMENTED MENU BAR - SATU BARIS SEJAJAR, UKURAN SERAGAM & RAPI) */}
          <div
            className={`px-1.5 py-1 rounded-lg border flex flex-nowrap items-center justify-between gap-1 shadow-sm backdrop-blur-md overflow-x-auto no-scrollbar ${
              darkMode
                ? 'bg-slate-950/90 border-sky-500/30 shadow-md'
                : 'bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border-sky-500/30 text-white'
            }`}
          >
            <div className="flex flex-nowrap items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setHomeSection('PORTAL_UJIAN')}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[7.5px] sm:text-[8px] font-bold leading-none transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  homeSection === 'PORTAL_UJIAN'
                    ? 'bg-amber-400 text-slate-950 shadow-2xs ring-1 ring-amber-300'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <UserCheck className="w-2.5 h-2.5 shrink-0" />
                <span>1. Portal Login &amp; Token</span>
              </button>

              <button
                type="button"
                onClick={() => setHomeSection('MONITORING_UJIAN')}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[7.5px] sm:text-[8px] font-bold leading-none transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  homeSection === 'MONITORING_UJIAN'
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-2xs ring-1 ring-emerald-300 font-extrabold'
                    : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40 hover:bg-emerald-500/30 hover:text-white'
                }`}
                title="Panel Fitur Monitoring Ujian: Pantau langsung seluruh peserta yang sedang mengerjakan soal ujian secara real-time"
              >
                <MonitorCheck className="w-2.5 h-2.5 shrink-0 text-emerald-300" />
                <span>2. Monitoring Ujian (Live)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              </button>

              <button
                type="button"
                onClick={() => setHomeSection('ABSENSI_SISWA')}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[7.5px] sm:text-[8px] font-bold leading-none transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  homeSection === 'ABSENSI_SISWA'
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-2xs ring-1 ring-emerald-300 font-extrabold'
                    : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/30 hover:text-white'
                }`}
                title="Menu Baru Disamping Monitoring: Presensi & Kehadiran Siswa (Sidik Jari Biometrik, QR Code, RFID, Swafoto GPS & Multi-Role)"
              >
                <Fingerprint className="w-2.5 h-2.5 shrink-0 text-emerald-300" />
                <span>3. Presensi &amp; Kehadiran (Biometrik &amp; Multi-Role)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              </button>

              <button
                type="button"
                onClick={() => setHomeSection('KISI_MATERI')}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[7.5px] sm:text-[8px] font-bold leading-none transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  homeSection === 'KISI_MATERI'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-2xs ring-1 ring-amber-300'
                    : 'bg-sky-500/20 text-white border-sky-400/30 hover:bg-sky-500/30 hover:text-white'
                }`}
              >
                <BookOpen className="w-2.5 h-2.5 shrink-0" />
                <span>4. Kisi-Kisi &amp; KKM</span>
              </button>

              <button
                type="button"
                onClick={() => setHomeSection('ATURAN_ANTI_CURANG')}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[7.5px] sm:text-[8px] font-bold leading-none transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  homeSection === 'ATURAN_ANTI_CURANG'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-2xs ring-1 ring-amber-300'
                    : 'bg-sky-500/20 text-white border-sky-400/30 hover:bg-sky-500/30 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                <span>5. Tata Tertib Ujian</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setView('STUDENT_DASHBOARD');
                  window.scrollTo(0, 0);
                  window.setTimeout(() => {
                    handleSyncStudentDashboard(true);
                  }, 250);
                }}
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[7.5px] sm:text-[8px] font-bold leading-none border border-sky-400/40 bg-sky-500/15 text-white hover:bg-sky-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
              >
                <History className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                <span className="text-white">6. Siswa Dashboard ({filteredSubmissionsByHeader.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutoReturnHomeSeconds(null);
                  setRedWarningOverlay(false);
                  try {
                    localStorage.setItem('anbk_classroom_has_entered', 'true');
                  } catch {}
                  setHasEnteredClassroom(true);
                  setView('DESIGN_CLASSROOM');
                  window.scrollTo(0, 0);
                }}
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[7.5px] sm:text-[8px] font-bold leading-none border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
              >
                <Layers className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                <span>7. Design Classroom</span>
              </button>

              {/* Indikator Antrean Sinkronisasi Google Sheets (Di samping 5. Design Classroom) */}
              <button
                type="button"
                onClick={() => setShowQueueModal(true)}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[7.5px] sm:text-[8px] font-mono font-bold tracking-tight leading-none transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
                  syncQueue.stats.pendingCount > 0
                    ? 'bg-amber-500/25 border-amber-300 text-amber-200 animate-pulse'
                    : syncQueue.stats.failedCount > 0
                    ? 'bg-rose-500/25 border-rose-300 text-rose-200'
                    : 'bg-emerald-950/85 border-emerald-400/50 text-emerald-300 hover:bg-emerald-900/80'
                }`}
              >
                {syncQueue.stats.isProcessing ? (
                  <RefreshCw className="w-2.5 h-2.5 text-amber-300 animate-spin shrink-0" />
                ) : syncQueue.stats.pendingCount > 0 ? (
                  <Clock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                )}
                <span>
                  {syncQueue.stats.pendingCount > 0
                    ? `Antrean: ${syncQueue.stats.pendingCount}`
                    : 'Antrean: 0 (Sheets ✓)'}
                </span>
              </button>

              {/* Info Perangkat Siswa (Di samping 5. Design Classroom, ukuran disamakan) */}
              <div className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-emerald-400/40 bg-slate-900/90 text-[7.5px] sm:text-[8px] leading-none shadow-2xs whitespace-nowrap shrink-0">
                {detectedDevice.isMobileOrTablet ? (
                  <Smartphone className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                ) : (
                  <Laptop className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                )}
                <span className="font-mono font-bold uppercase tracking-tight text-emerald-300">
                  {detectedDevice.brand}
                </span>
                <span className="text-slate-500">·</span>
                <span className="font-bold text-sky-300 max-w-[115px] truncate">
                  {effectiveDeviceModel}
                </span>
              </div>
            </div>

            <div className="flex flex-nowrap items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={isSyncingLoginSheet && syncTriggerSource === 'rekap'}
                onClick={() => {
                  setShowSyncDateModal(true);
                }}
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[7.5px] sm:text-[8px] font-extrabold leading-none border transition-all duration-300 ease-in-out cursor-pointer whitespace-nowrap shrink-0 shadow-2xs disabled:opacity-75 ${
                  isSyncingLoginSheet && syncTriggerSource === 'rekap'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 ring-1 ring-amber-300/60 shadow-sm animate-pulse'
                    : isLoginRekapSyncAnimated
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-200 ring-1 ring-emerald-300 shadow-sm'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/60 active:scale-95'
                }`}
                title="Klik untuk memilih tanggal, bulan, tahun dan menyinkronkan data riwayat ujian ke Link Google Sheets Rekap Hasil Ujian"
              >
                <RefreshCw
                  className={`w-2.5 h-2.5 shrink-0 transition-transform duration-300 ${
                    isSyncingLoginSheet && syncTriggerSource === 'rekap' ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {isSyncingLoginSheet && syncTriggerSource === 'rekap'
                    ? 'Menyinkronkan...'
                    : isLoginRekapSyncAnimated
                    ? '✓ Tersinkron!'
                    : 'Sinkronkan Sekarang'}
                </span>
              </button>

              {/* Indikator Visual (Ikon Status) Pengiriman ke Google Sheets */}
              <div
                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[7.5px] sm:text-[8px] font-bold border transition-all duration-300 ease-in-out shrink-0 cursor-default shadow-2xs ${
                  isSyncingLoginSheet && syncTriggerSource === 'rekap'
                    ? 'bg-amber-950/80 border-amber-400/60 text-amber-200 ring-1 ring-amber-400/30'
                    : isLoginRekapSyncAnimated
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-slate-900/90 border-slate-700/60 text-slate-300'
                }`}
                title={
                  isSyncingLoginSheet && syncTriggerSource === 'rekap'
                    ? 'Status: Sedang mengirim data hasil ujian ke Link Google Sheets...'
                    : isLoginRekapSyncAnimated
                    ? 'Status: Berhasil terkirim ke Rekap Hasil Ujian pada Google Sheets ✓'
                    : 'Status: Siap kirim ke Rekap Hasil Ujian pada Google Sheets'
                }
              >
                {isSyncingLoginSheet && syncTriggerSource === 'rekap' ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 text-amber-300 animate-spin shrink-0" />
                    <span className="hidden sm:inline">Mengirim ke Sheets...</span>
                  </>
                ) : isLoginRekapSyncAnimated ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span className="truncate text-emerald-300 font-extrabold">Terkirim ke Sheets ✓</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400/80 shrink-0" />
                    <span className="hidden sm:inline text-slate-300">Sheets Siap</span>
                  </>
                )}
              </div>

              <div className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-slate-900/90 border border-sky-500/30 shadow-2xs shrink-0">
                <label
                  htmlFor="header-jenjang-filter"
                  className="text-[7.5px] sm:text-[8px] font-extrabold uppercase tracking-tight text-white whitespace-nowrap leading-none"
                >
                  Jenjang:
                </label>
                <select
                  id="header-jenjang-filter"
                  value={headerJenjangFilter}
                  onChange={(e) =>
                    handleHeaderJenjangChange(e.target.value as 'ALL' | 'VII' | 'VIII')
                  }
                  className="px-1 py-0 rounded border border-amber-400/50 bg-slate-950 text-amber-300 hover:border-amber-300 text-[7.5px] sm:text-[8px] font-bold leading-none focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900 text-white">
                    Semua
                  </option>
                  <option value="VII" className="bg-slate-900 text-white">
                    Kelas VII
                  </option>
                  <option value="VIII" className="bg-slate-900 text-white">
                    Kelas VIII
                  </option>
                </select>
              </div>

              <PWAInstallButton compact={true} />

              <button
                type="button"
                onClick={() => {
                  setShowTeacherModal(true);
                  setTeacherPasswordError(null);
                }}
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[7.5px] sm:text-[8px] font-extrabold leading-none border border-amber-400/60 bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
                title="Akses Mode Guru & Admin/Operator Sekolah: Wajib Password Mode Guru agar murid tidak bisa mengakses"
              >
                <Lock className="w-2.5 h-2.5 shrink-0 text-amber-300" />
                <span>Mode Guru / Admin Sekolah</span>
              </button>
            </div>
          </div>

          {/* =============================================================== */}
          {/* SUB-MENU 1: PORTAL LOGIN PESERTA & TOKEN UJIAN ONLINE LIVE */}
          {/* =============================================================== */}
          {homeSection === 'PORTAL_UJIAN' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 sm:gap-2 items-start">
              {/* KIRI (5 Kolom): Kartu Token Ujian Online 6 Digit + Ringkasan Spesifikasi (Kompak, Rapi & Profesional) */}
              <div className="lg:col-span-5 space-y-1.5">
                {/* Panel Token Ujian Online Live */}
                <div
                  className={`rounded-lg sm:rounded-xl border p-1 sm:p-1.5 space-y-0.5 sm:space-y-1 ${
                    darkMode
                      ? 'bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white'
                      : 'bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 border-sky-500/40 shadow-md text-white'
                  }`}
                >
                  <div className="flex flex-nowrap items-center justify-between gap-1 border-b pb-0.5 border-white/15">
                    <div className="flex items-center gap-1 min-w-0">
                      <KeyRound className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                      <div className="min-w-0">
                        <h2 className="text-[7.5px] sm:text-[8.5px] font-bold uppercase tracking-wider text-white truncate">
                          TOKEN UJIAN ONLINE AKTIF
                        </h2>
                        <span className="text-[6px] sm:text-[7px] font-mono text-amber-300 block truncate">
                          Tersinkron Menu: KODE TOKEN UJIAN
                        </span>
                      </div>
                    </div>
                    {isSheetTokenSynced && onlineToken ? (
                      <span className="text-[6px] sm:text-[7px] font-mono font-bold text-emerald-400 flex items-center gap-0.5 whitespace-nowrap shrink-0">
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400" />
                        AUTO-SYNC AKTIF
                      </span>
                    ) : (
                      <span className="text-[6px] sm:text-[7px] font-mono font-bold text-rose-400 flex items-center gap-0.5 whitespace-nowrap shrink-0">
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-rose-400" />
                        BELUM TERSINKRON
                      </span>
                    )}
                  </div>

                  <p className="text-[7px] sm:text-[8px] text-slate-300 leading-tight">
                    Kode Token Ujian <strong className="text-amber-300">wajib berasal dari menu KODE TOKEN UJIAN</strong> yang tersinkron otomatis. Jika belum tersinkron, ujian tidak dapat diakses.
                  </p>

                  {/* 6 Kotak Karakter Token */}
                  <div className="grid grid-cols-6 gap-1 py-0.5">
                    {(isSheetTokenSynced && onlineToken
                      ? onlineToken.padEnd(6, ' ').slice(0, 6).split('')
                      : ['—', '—', '—', '—', '—', '—']
                    ).map((char, idx) => (
                      <div
                        key={idx}
                        className={`h-4.5 sm:h-5.5 rounded border font-mono text-[10px] sm:text-xs font-black flex items-center justify-center shadow-inner tracking-wider ${
                          isSheetTokenSynced && onlineToken
                            ? 'bg-slate-950/90 border-sky-400/60 text-amber-300'
                            : 'bg-slate-950/60 border-rose-500/40 text-slate-600'
                        }`}
                      >
                        {char}
                      </div>
                    ))}
                  </div>

                  {!isSheetTokenSynced && (
                    <div className="p-1 rounded bg-rose-950/80 border border-rose-500/50 text-rose-200 text-[7px] sm:text-[7.5px] font-semibold flex items-start gap-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        Kode Token Ujian tidak ditampilkan karena belum tersinkron dengan menu <strong>KODE TOKEN UJIAN</strong>. Hubungkan tautan pada Panel Guru agar kode token tampil otomatis.
                      </span>
                    </div>
                  )}

                  {/* Info Sumber Sinkronisasi & Countdown */}
                  <div className="p-0.5 sm:p-1 rounded bg-slate-950/75 border border-sky-500/25 space-y-0.5">
                    <div className="flex flex-nowrap items-center justify-between gap-1 text-[6.5px] sm:text-[7px] font-mono">
                      <span className="text-sky-300 flex items-center gap-0.5 truncate">
                        <FileSpreadsheet className="w-2 h-2 text-emerald-400 shrink-0" />
                        <span className="truncate">Status: {tokenSourceLabel}</span>
                      </span>
                      {isSheetTokenSynced && lastTokenSyncTime && (
                        <span className="text-emerald-300 font-bold whitespace-nowrap shrink-0">
                          Auto-Sync: {lastTokenSyncTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[6.5px] sm:text-[7px] font-mono text-emerald-300/95 border-t border-white/10 pt-0.5">
                      <span className="truncate">Lintas Perangkat: HP, Tablet &amp; PC</span>
                      <span className="font-bold text-amber-300 whitespace-nowrap shrink-0">REAL-TIME AKTIF</span>
                    </div>

                    <TokenStatusCountdownBar
                      isSheetTokenSynced={isSheetTokenSynced}
                      onTimeoutSync={() => handleSyncTokenFromSheet(true, true)}
                      resetKey={tokenSyncResetKey}
                    />
                  </div>

                  {tokenSyncToast && (
                    <div className="p-1 rounded bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 text-[7px] sm:text-[7.5px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span>{tokenSyncToast}</span>
                    </div>
                  )}

                  {/* Tombol Aksi Siswa & Status Koneksi Otomatis (Ukuran Seragam & Satu Baris) */}
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <button
                      type="button"
                      disabled={!isSheetTokenSynced || !onlineToken}
                      onClick={async () => {
                        if (!isSheetTokenSynced || !onlineToken) return;
                        const cleanTok = sanitizeTokenValue(onlineToken) || onlineToken.trim();
                        let copiedSuccess = false;
                        try {
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(cleanTok);
                            copiedSuccess = true;
                          }
                        } catch {
                          copiedSuccess = false;
                        }
                        if (!copiedSuccess) {
                          try {
                            const tempTa = document.createElement('textarea');
                            tempTa.value = cleanTok;
                            tempTa.setAttribute('readonly', '');
                            tempTa.style.position = 'fixed';
                            tempTa.style.top = '-9999px';
                            tempTa.style.left = '-9999px';
                            document.body.appendChild(tempTa);
                            tempTa.focus();
                            tempTa.select();
                            document.execCommand('copy');
                            document.body.removeChild(tempTa);
                          } catch {
                            // ignore
                          }
                        }
                        const usage = checkStudentTokenUsage(
                          cleanTok,
                          namaSiswa,
                          nisNisn,
                          submissions
                        );
                        if (!usage.isAlreadyUsed) {
                          setInputToken(cleanTok);
                          setLoginError(null);
                        }
                        setTokenCopied(true);
                        setTokenSyncToast(
                          `✓ Kode Token [${cleanTok}] berhasil disalin & dimasukkan ke kolom Kode Token Ujian!`
                        );
                        setTimeout(() => setTokenCopied(false), 2500);
                        setTimeout(() => setTokenSyncToast(null), 4000);
                      }}
                      className={`h-4.5 sm:h-5 px-1 rounded text-[7px] sm:text-[8px] font-bold flex items-center justify-center gap-0.5 whitespace-nowrap transition-all shadow-2xs ${
                        isSheetTokenSynced && onlineToken
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      {tokenCopied ? <Check className="w-2 h-2 shrink-0" /> : <Copy className="w-2 h-2 shrink-0" />}
                      <span className="truncate">
                        {tokenCopied
                          ? `Disalin! (${onlineToken})`
                          : isSheetTokenSynced && onlineToken
                          ? 'Salin Kode Token'
                          : 'Token Belum Aktif'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSyncingTokenManual}
                      onClick={() => {
                        setTokenSyncResetKey((k) => k + 1);
                        handleSyncTokenFromSheet(true, false);
                      }}
                      className={`relative h-4.5 sm:h-5 px-1 rounded text-[7px] sm:text-[8px] font-bold border flex items-center justify-center gap-0.5 whitespace-nowrap cursor-pointer transition-all duration-300 shadow-2xs active:scale-95 ${
                        isSyncingTokenManual
                          ? 'border-amber-300 bg-amber-400 text-slate-950 ring-1 ring-amber-300/60'
                          : isTokenSyncCompletedAnimated
                          ? 'border-emerald-200 bg-emerald-400 hover:bg-emerald-300 text-slate-950 ring-1 ring-emerald-400/50 shadow-sm'
                          : isSheetTokenSynced && onlineToken
                          ? 'border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200'
                          : 'border-rose-500/40 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300'
                      }`}
                    >
                      {isSyncingTokenManual ? (
                        <>
                          <RefreshCw className="w-2 h-2 animate-spin shrink-0" />
                          <span className="truncate">Menyinkronkan...</span>
                        </>
                      ) : isTokenSyncCompletedAnimated && isSheetTokenSynced && onlineToken ? (
                        <>
                          <CheckCircle2 className="w-2 h-2 text-slate-950 shrink-0" />
                          <span className="truncate">Tersinkron! ({onlineToken})</span>
                        </>
                      ) : isSheetTokenSynced && onlineToken ? (
                        <>
                          <RefreshCw className="w-2 h-2 text-emerald-400 shrink-0" />
                          <span className="truncate">Sinkron Otomatis</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-2 h-2 text-rose-400 shrink-0" />
                          <span className="truncate">Wajib Sinkron</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status Pemakaian Kode Token (Berlaku Hingga 3 Kali Pakai Setiap Memulai Ujian) + Daftar Nama Siswa Kuota Habis (3/3x) */}
                  {isSheetTokenSynced && onlineToken && (() => {
                    const currentOnlineClean = sanitizeTokenValue(onlineToken);
                    const onlineUsageCheck = checkStudentTokenUsage(
                      currentOnlineClean,
                      namaSiswa,
                      nisNisn,
                      submissions
                    );
                    const exhaustedStudentsList = getStudentsWithExhaustedTokenQuota(
                      submissions,
                      usedTokensList
                    );
                    return (
                      <div
                        className={`p-1 rounded border text-[7px] sm:text-[7.5px] leading-tight space-y-0.5 ${
                          onlineUsageCheck.isAlreadyUsed
                            ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                            : onlineUsageCheck.usageCount > 0
                            ? 'bg-amber-950/70 border-amber-400/50 text-amber-200'
                            : 'bg-emerald-950/60 border-emerald-400/40 text-emerald-200'
                        }`}
                      >
                        <div className="flex items-start gap-1">
                          <KeyRound
                            className={`w-2 h-2 shrink-0 mt-0.5 ${
                              onlineUsageCheck.isAlreadyUsed
                                ? 'text-rose-400'
                                : onlineUsageCheck.usageCount > 0
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            {onlineUsageCheck.isAlreadyUsed ? (
                              <>
                                <strong className="text-rose-300 block uppercase font-bold">
                                  Status Token [{currentOnlineClean}]: KUOTA 3x PAKAI HABIS (3/3x)
                                </strong>
                                Siswa <strong className="text-white">{namaSiswa.trim() || 'Ini'}</strong> telah memakai kode token sebanyak <strong className="text-white">{onlineUsageCheck.usageCount}/3x</strong>. Silakan{' '}
                                <strong className="text-amber-300">minta Kode Token Baru kepada Guru</strong>.
                              </>
                            ) : onlineUsageCheck.usageCount > 0 ? (
                              <>
                                <strong className="text-amber-300 block uppercase font-bold">
                                  Status Token [{currentOnlineClean}]: TERPAKAI {onlineUsageCheck.usageCount}/3x (SISA {onlineUsageCheck.remainingUsage}x)
                                </strong>
                                Token aktif dan dapat digunakan <strong className="text-white">{onlineUsageCheck.remainingUsage} kali lagi</strong> dari kuota 3 kali pakai.
                              </>
                            ) : (
                              <>
                                <strong className="text-emerald-300 block uppercase font-bold">
                                  Status Token [{currentOnlineClean}]: BELUM DIPAKAI (KUOTA 3x)
                                </strong>
                                Kode token berlaku hingga <strong className="text-white">3 kali (3x)</strong> setiap memulai ujian per siswa.
                              </>
                            )}
                          </div>
                        </div>

                        {/* Daftar Ringkas & Tombol Lihat Nama-Nama Siswa yang Sudah Habis Menggunakan Kode Token Ujian 3 Kali (3/3x) */}
                        <div className="p-1 rounded bg-slate-950/90 border border-rose-500/40 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-amber-300 flex items-center gap-0.5 truncate">
                              <Users className="w-2 h-2 text-rose-400 shrink-0" />
                              <span className="truncate">
                                Siswa Habis Kuota Token 3x ({exhaustedStudentsList.length} Murid):
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowExhaustedStudentsModal(true)}
                              className="px-1.5 py-0.2 rounded bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/50 text-rose-200 font-extrabold text-[6.5px] sm:text-[7px] shrink-0 cursor-pointer transition-colors"
                            >
                              Lihat Daftar ({exhaustedStudentsList.length})
                            </button>
                          </div>
                          {exhaustedStudentsList.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-0.5 pt-0.5 max-h-9 overflow-y-auto">
                              {exhaustedStudentsList.slice(0, 4).map((st) => (
                                <span
                                  key={st.key}
                                  onClick={() => setShowExhaustedStudentsModal(true)}
                                  className="inline-flex items-center gap-0.5 px-1 py-0.1 rounded bg-rose-950/90 border border-rose-500/50 text-[6.5px] font-bold text-rose-200 cursor-pointer hover:border-amber-400"
                                  title={`${st.namaSiswa} (${st.kelas}) — Token [${st.exhaustedToken}] (${st.usageCount}/3x Habis)`}
                                >
                                  <span className="truncate max-w-[90px] text-white">{st.namaSiswa}</span>
                                  <span className="text-amber-300 font-mono">({st.kelas} · 3/3x)</span>
                                </span>
                              ))}
                              {exhaustedStudentsList.length > 4 && (
                                <button
                                  type="button"
                                  onClick={() => setShowExhaustedStudentsModal(true)}
                                  className="px-1 py-0.1 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 font-bold text-[6.5px] cursor-pointer"
                                >
                                  +{exhaustedStudentsList.length - 4} lainnya
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-[6.5px] text-slate-400">
                              ✓ Belum ada murid yang habis kuota 3x kode token ujian.
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setShowQrScannerModal(true)}
                            className={`w-full h-4.5 sm:h-5 px-1 rounded font-bold text-[6.5px] sm:text-[7.5px] flex items-center justify-center gap-0.5 whitespace-nowrap shadow-2xs transition-all cursor-pointer ${
                              isQrCameraActive || showQrScannerModal
                                ? 'bg-emerald-400 text-slate-950 ring-1 ring-emerald-300 animate-pulse'
                                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            }`}
                          >
                            <QrCode className="w-2 h-2 shrink-0" />
                            <span className="truncate">
                              {isQrCameraActive
                                ? 'Kamera...'
                                : 'Kartu QR'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRequestNewTokenFromTeacher}
                            className="w-full h-4.5 sm:h-5 px-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[6.5px] sm:text-[7.5px] flex items-center justify-center gap-0.5 whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-2 h-2 shrink-0" />
                            <span className="truncate">Minta Token Baru</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowExhaustedStudentsModal(true)}
                            className="w-full h-4.5 sm:h-5 px-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[6.5px] sm:text-[7.5px] flex items-center justify-center gap-0.5 whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
                          >
                            <Users className="w-2 h-2 shrink-0" />
                            <span className="truncate">Siswa Habis 3x ({exhaustedStudentsList.length})</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Baris Pintasan & Tombol Kelola Kode Token Oleh Guru (Satu Baris Sejajar) */}
                  <div className="pt-0.5 border-t border-white/10 flex flex-nowrap items-center justify-between gap-1 text-[7px] sm:text-[7.5px]">
                    {(cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl) ? (
                      <a
                        href={
                          isTeacherTokenUnlocked
                            ? cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl
                            : '#khusus-guru'
                        }
                        target={isTeacherTokenUnlocked ? '_blank' : undefined}
                        rel={isTeacherTokenUnlocked ? 'noreferrer' : undefined}
                        onClick={(e) => {
                          if (!isTeacherTokenUnlocked) {
                            e.preventDefault();
                            setShowTeacherTokenPanel(true);
                            setTeacherTokenPassError(
                              'Akses Khusus Guru: Masukkan Password Mode Guru untuk membuka Menu KODE TOKEN UJIAN.'
                            );
                          }
                        }}
                        className={`inline-flex items-center gap-0.5 text-[7px] sm:text-[7.5px] font-bold transition-colors cursor-pointer truncate ${
                          isTeacherTokenUnlocked
                            ? 'text-emerald-300 hover:text-emerald-200 hover:underline'
                            : 'text-amber-300/90 hover:text-amber-200'
                        }`}
                      >
                        {isTeacherTokenUnlocked ? (
                          <ExternalLink className="w-2 h-2 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-2 h-2 text-amber-300 shrink-0" />
                        )}
                        <span className="truncate">
                          {isTeacherTokenUnlocked
                            ? 'Buka Menu KODE TOKEN UJIAN'
                            : 'Buka Menu TOKEN (Khusus Guru)'}
                        </span>
                      </a>
                    ) : (
                      <span className="text-[7px] sm:text-[7.5px] text-slate-400 flex items-center gap-0.5 truncate">
                        <Lock className="w-2 h-2 text-amber-300 shrink-0" />
                        <span className="truncate">
                          Menu: <strong className="text-sky-300">KODE TOKEN UJIAN</strong>
                        </span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowTeacherTokenPanel((prev) => !prev);
                        setTeacherTokenPassError(null);
                      }}
                      className="inline-flex items-center gap-0.5 h-4 px-1 rounded text-[6.5px] sm:text-[7px] font-bold border border-amber-400/40 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <Lock className="w-2 h-2 shrink-0" />
                      <span>
                        {showTeacherTokenPanel
                          ? 'Tutup Pengaturan'
                          : 'Ganti Token (Guru)'}
                      </span>
                    </button>
                  </div>

                  {/* Panel Khusus Guru: Ganti Kode Token Ujian & Koneksi Tautan */}
                  {showTeacherTokenPanel && (
                    <div className="p-2 rounded-md bg-slate-950/95 border border-amber-400/40 space-y-1.5 text-[10px]">
                      {!isTeacherTokenUnlocked ? (
                        <div className="space-y-1.5" role="group">
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] font-bold text-amber-300 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Otentikasi Guru: Ubah KODE TOKEN UJIAN
                            </span>
                          </div>
                          <p className="text-[8.5px] text-slate-300 leading-snug">
                            Masukkan Kode Akses Guru untuk mengganti Kode Token Ujian atau menghubungkan tautan (<strong className="text-white">KODE TOKEN UJIAN</strong>).
                          </p>
                          {teacherTokenPassError && (
                            <div className="p-1.5 rounded bg-rose-950/90 border border-rose-500/50 text-rose-200 text-[8.5px] font-bold">
                              {teacherTokenPassError}
                            </div>
                          )}
                          <form onSubmit={handleUnlockTeacherToken} className="flex gap-1 items-center">
                            <div className="relative flex-1">
                              <input
                                type={showTeacherTokenPass ? 'text' : 'password'}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                value={teacherTokenPassInput}
                                onChange={(e) => {
                                  setTeacherTokenPassInput(e.target.value);
                                  if (teacherTokenPassError) setTeacherTokenPassError(null);
                                }}
                                placeholder="Ketik Kode Akses Guru..."
                                className="w-full pl-2 pr-7 py-1 rounded border border-white/20 bg-slate-900 text-white text-[10px] font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-slate-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowTeacherTokenPass((prev) => !prev)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                                title={showTeacherTokenPass ? 'Sembunyikan password' : 'Tampilkan password'}
                              >
                                {showTeacherTokenPass ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-bold cursor-pointer shrink-0"
                            >
                              Buka Akses
                            </button>
                          </form>
                        </div>
                      ) : (
                        <form onSubmit={handleSaveTeacherTokenAndSheet} className="space-y-1.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-1">
                            <span className="text-[9.5px] font-bold text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Panel Guru: Pengaturan KODE TOKEN UJIAN
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsTeacherTokenUnlocked(false)}
                              className="text-[8.5px] font-bold text-slate-400 hover:text-white cursor-pointer"
                            >
                              Kunci Kembali
                            </button>
                          </div>

                          <div>
                            <label className="block text-[9px] font-bold text-sky-200 mb-0.5">
                              Tautan Sinkronisasi Wajib (Menu / Tab: KODE TOKEN UJIAN)
                            </label>
                            <input
                              type="url"
                              required
                              value={tokenSheetUrlInput}
                              onChange={(e) => setTokenSheetUrlInput(e.target.value)}
                              placeholder="Tempel tautan sinkronisasi KODE TOKEN UJIAN..."
                              className="w-full px-2 py-1 rounded border border-white/20 bg-slate-900 text-white text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-sky-400"
                            />
                            <span className="text-[8px] text-emerald-300/90 block mt-0.5">
                              ● Wajib terhubung ke tautan dengan kolom/tab <strong>KODE TOKEN UJIAN</strong>.
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[9px] font-bold text-sky-200">
                                Kode Token Ujian Aktif (Sinkron Otomatis)
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                                  let generated = '';
                                  for (let i = 0; i < 6; i++) {
                                    generated += chars.charAt(
                                      Math.floor(Math.random() * chars.length)
                                    );
                                  }
                                  setTeacherCustomTokenInput(generated);
                                }}
                                className="text-[8.5px] font-extrabold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                              >
                                Acak Token
                              </button>
                            </div>
                            <input
                              type="text"
                              maxLength={6}
                              value={teacherCustomTokenInput}
                              onChange={(e) =>
                                setTeacherCustomTokenInput(e.target.value.toUpperCase())
                              }
                              placeholder="Contoh: 310590"
                              className="w-full px-2 py-1 rounded border border-amber-400/50 bg-slate-900 text-amber-300 font-mono text-xs font-extrabold tracking-widest uppercase text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1.5 pt-0.5">
                            <span className="text-[8.5px] font-bold text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              {isSheetTokenSynced && onlineToken
                                ? `Aktif: ${onlineToken}`
                                : 'Menunggu Validasi'}
                            </span>
                            <button
                              type="submit"
                              className={`relative px-2.5 py-1 rounded text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs border ${
                                isTokenSyncCompletedAnimated
                                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-2 ring-emerald-400/50 scale-[1.01]'
                                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/40'
                              }`}
                            >
                              {isTokenSyncCompletedAnimated ? (
                                <>
                                  <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                                  <span>Tersinkron! ({onlineToken})</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                                  <span>Hubungkan &amp; Simpan</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* KANAN (7 Kolom): Form Login Peserta Ujian dengan Pemilih Kelas Interaktif (Kompak, Rapi, & Profesional) */}
              <div
                className={`lg:col-span-7 rounded-lg sm:rounded-xl border p-1.5 sm:p-2 ${
                  darkMode
                    ? 'bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-xl text-white'
                    : 'bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 border-sky-500/40 shadow-xl text-white'
                }`}
              >
                <div className="flex flex-nowrap items-center justify-between gap-1 border-b pb-0.5 mb-1 border-white/15">
                  <div>
                    <h2 className="inline-block font-display text-[9px] sm:text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-sky-500/20 text-white border border-sky-400/30 leading-tight">
                      Masuk ke Ruang Ujian Komputer
                    </h2>
                  </div>
                </div>

                {loginSheetSyncToast && (
                  <div className="mb-1 p-1 rounded bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-[8.5px] font-bold flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span>{loginSheetSyncToast}</span>
                  </div>
                )}

                {loginError && (
                  <div className="mb-1 p-1.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-200 text-[9px] font-semibold flex items-start gap-1">
                    <AlertOctagon className="w-3 h-3 shrink-0 mt-0.5 text-rose-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleStudentLogin} className="space-y-1 sm:space-y-1.5">
                  {/* Panel Unggah Foto Profil Siswa via Akses Kamera Perangkat (Tersimpan di localStorage, Kompak & Sejajar) */}
                  <div className="p-1 sm:p-1.5 rounded-md border border-amber-400/35 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 space-y-0.5 shadow-xs">
                    {/* Baris Atas: Judul Panel & Status Sinkronisasi Kolom FOTO (Satu Baris Sejajar) */}
                    <div className="flex flex-nowrap items-center justify-between gap-1 border-b border-white/10 pb-0.5">
                      <div className="flex flex-nowrap items-center gap-1 min-w-0">
                        <Camera className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-300 shrink-0" />
                        <span className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wider text-amber-300 truncate">
                          FOTO PROFIL PESERTA UJIAN
                        </span>
                        <span className="px-1 py-0.1 rounded-full bg-amber-400/15 border border-amber-400/40 text-[6px] sm:text-[6.5px] font-mono font-extrabold text-amber-300 whitespace-nowrap shrink-0">
                          AUTO-SYNC FOTO
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.1 rounded-full text-[6.5px] sm:text-[7px] font-mono font-bold border whitespace-nowrap shrink-0 ${
                          studentPhotoUrl
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                            : 'bg-slate-800/90 border-white/15 text-slate-300'
                        }`}
                      >
                        {studentPhotoUrl ? (
                          <>
                            <CheckCircle2 className="w-2 h-2 text-emerald-400 shrink-0" />
                            <span>Foto Tersimpan</span>
                          </>
                        ) : (
                          <span>Belum Ada Foto</span>
                        )}
                      </span>
                    </div>

                    {/* Baris Tengah: Preview Avatar Siswa & Informasi Singkat yang Rapi */}
                    <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setShowStudentCameraModal(true)}
                        className="relative w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded overflow-hidden border border-amber-400 bg-gradient-to-br from-sky-600 to-indigo-800 shrink-0 flex items-center justify-center shadow-2xs group cursor-pointer"
                      >
                        {studentPhotoUrl ? (
                          <img
                            src={studentPhotoUrl}
                            alt={namaSiswa || 'Foto Profil Siswa'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-mono text-[7.5px] sm:text-[8.5px] font-extrabold text-white">
                            {getStudentInitials(namaSiswa)}
                          </span>
                        )}
                        <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-amber-300">
                          <Camera className="w-2 h-2" />
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-nowrap items-center gap-1">
                          <span className="text-[8px] sm:text-[9px] font-extrabold text-white truncate">
                            {namaSiswa.trim() ? namaSiswa : 'Belum Mengisi Nama Siswa'}
                          </span>
                          <span className="px-1 py-0.1 rounded bg-amber-400/20 border border-amber-400/40 text-[6px] sm:text-[6.5px] font-mono font-bold text-amber-300 whitespace-nowrap shrink-0">
                            Kelas {kelasSiswa} · {semesterSiswa}
                          </span>
                        </div>
                        <p className="text-[7px] sm:text-[7.5px] text-amber-300 leading-tight truncate">
                          {studentPhotoUrl
                            ? 'Foto profil aktif & tersinkron ke Kolom FOTO Rekap Hasil Ujian.'
                            : 'Ambil foto kamera untuk disinkronkan ke Kolom FOTO Rekap Hasil Ujian.'}
                        </p>
                      </div>
                    </div>

                    {/* Baris Bawah: 3 Tombol Aksi Sejajar & Ukuran Seragam */}
                    <div className="grid grid-cols-3 gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setShowStudentCameraModal(true)}
                        className="h-4.5 sm:h-5 px-1 rounded font-bold text-[7px] sm:text-[8px] flex items-center justify-center gap-0.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap bg-amber-400 hover:bg-amber-300 text-slate-950"
                      >
                        <Camera className="w-2 h-2 shrink-0" />
                        <span className="truncate">
                          {studentPhotoUrl ? 'Ubah Kamera' : 'Ambil Foto'}
                        </span>
                      </button>

                      <label
                        htmlFor="home-quick-student-photo-file"
                        className="h-4.5 sm:h-5 px-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[7px] sm:text-[8px] flex items-center justify-center gap-0.5 transition-colors cursor-pointer select-none whitespace-nowrap"
                      >
                        <Upload className="w-2 h-2 text-sky-300 shrink-0" />
                        <span className="truncate">Unggah Galeri</span>
                        <input
                          id="home-quick-student-photo-file"
                          ref={studentQuickFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleQuickStudentPhotoFile}
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={isSyncingLoginSheet}
                        onClick={() =>
                          handleSyncLoginFeaturesToGoogleSheets(true, undefined, 'photo')
                        }
                        className={`relative h-4.5 sm:h-5 px-1 rounded disabled:opacity-60 border font-bold text-[7px] sm:text-[8px] flex items-center justify-center gap-0.5 transition-all duration-300 cursor-pointer whitespace-nowrap ${
                          isSyncingLoginSheet && syncTriggerSource === 'photo'
                            ? 'bg-amber-400 text-slate-950 border-amber-200 ring-1 ring-amber-300/60'
                            : isLoginPhotoSyncAnimated
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-1 ring-emerald-400/50 shadow-2xs'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/50 text-emerald-200'
                        }`}
                      >
                        {isLoginPhotoSyncAnimated && !(isSyncingLoginSheet && syncTriggerSource === 'photo') ? (
                          <>
                            <CheckCircle2 className="w-2 h-2 text-slate-950 shrink-0" />
                            <span className="truncate">Tersinkron!</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw
                              className={`w-2 h-2 shrink-0 ${
                                isSyncingLoginSheet && syncTriggerSource === 'photo'
                                  ? 'animate-spin text-slate-950'
                                  : 'text-emerald-300'
                              }`}
                            />
                            <span className="truncate">
                              {isSyncingLoginSheet && syncTriggerSource === 'photo'
                                ? 'Sinkron...'
                                : 'Sinkron Foto'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {photoSyncToast && (
                      <div className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 text-[7.5px] font-bold flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 className="w-2 h-2 text-emerald-400 shrink-0" />
                        <span>{photoSyncToast}</span>
                      </div>
                    )}
                  </div>

                  {/* Peringatan Wajib Mengisi Foto Profil Sebelum Mengisi Identitas & Memulai Ujian */}
                  {!studentPhotoUrl && (
                    <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-rose-950/95 via-red-950/90 to-slate-950 border border-rose-500/70 text-rose-200 text-[8px] sm:text-[9px] font-bold flex items-center justify-between gap-1 shadow-sm">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                        <span className="leading-tight">
                          <strong className="text-amber-300 uppercase">WAJIB FOTO PROFIL:</strong> Ambil foto kamera atau unggah foto peserta ujian terlebih dahulu untuk membuka kolom Nama, NIS/NISN, Kelas, Semester, dan Tombol Mulai Ujian.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStudentCameraModal(true)}
                        className="px-2 py-0.5 sm:py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[7.5px] sm:text-[8px] shrink-0 cursor-pointer shadow-xs whitespace-nowrap active:scale-95 transition-transform"
                      >
                        Ambil Foto
                      </button>
                    </div>
                  )}

                  {/* Baris Input Nama & NIS/NISN (2 Kolom Sejajar, Ukuran Seragam h-6 sm:h-6.5) */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                    <div>
                      <label className="block text-[8px] sm:text-[9.5px] font-bold text-sky-200 mb-0.5 truncate">
                        Nama Lengkap Siswa
                      </label>
                      <input
                        type="search"
                        id="anbk_input_nama_lengkap_siswa_clean"
                        name="anbk_input_nama_lengkap_siswa_clean"
                        autoComplete="off"
                        aria-autocomplete="none"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-form-type="other"
                        required
                        disabled={!studentPhotoUrl}
                        readOnly={!studentPhotoUrl || !hasStudentTypedName}
                        value={
                          hasStudentTypedName &&
                          namaSiswa.trim().toLowerCase() !== 'peserta ujian' &&
                          namaSiswa.trim().toLowerCase() !== 'peserta ujian anbk'
                            ? namaSiswa
                            : ''
                        }
                        onFocus={(e) => {
                          if (!studentPhotoUrl) {
                            e.target.blur();
                            return;
                          }
                          if (!hasStudentTypedName) {
                            setHasStudentTypedName(true);
                            setNamaSiswa('');
                          }
                        }}
                        onClick={() => {
                          if (!studentPhotoUrl) return;
                          if (!hasStudentTypedName) {
                            setHasStudentTypedName(true);
                            setNamaSiswa('');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (!studentPhotoUrl) return;
                          if (
                            e.ctrlKey ||
                            e.metaKey ||
                            e.altKey ||
                            [
                              'Backspace',
                              'Delete',
                              'ArrowLeft',
                              'ArrowRight',
                              'Tab',
                              'Enter',
                              'Home',
                              'End',
                              'Shift',
                              'CapsLock',
                            ].includes(e.key)
                          ) {
                            return;
                          }
                          if (e.key.length === 1 && !/^[a-zA-Z\s]$/.test(e.key)) {
                            e.preventDefault();
                            triggerNamaSiswaError(
                              'Nama Lengkap Siswa hanya menerima huruf dan spasi (angka atau karakter khusus tidak diizinkan).'
                            );
                          }
                        }}
                        onPaste={(e) => {
                          if (!studentPhotoUrl) return;
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text');
                          const lettersAndSpaces = pasted.replace(/[^a-zA-Z\s]/g, '');
                          if (pasted !== lettersAndSpaces) {
                            triggerNamaSiswaError(
                              'Nama Lengkap Siswa hanya menerima huruf dan spasi (angka atau karakter khusus tidak diizinkan).'
                            );
                          } else {
                            setNamaSiswaError(null);
                          }
                          if (!hasStudentTypedName) {
                            setHasStudentTypedName(true);
                          }
                          setNamaSiswa(lettersAndSpaces);
                        }}
                        onChange={(e) => {
                          if (!studentPhotoUrl) return;
                          const val = e.target.value;
                          const lower = val.trim().toLowerCase();
                          if (lower === 'peserta ujian' || lower === 'peserta ujian anbk') {
                            setNamaSiswa('');
                            return;
                          }
                          const lettersAndSpaces = val.replace(/[^a-zA-Z\s]/g, '');
                          if (val !== lettersAndSpaces) {
                            triggerNamaSiswaError(
                              'Nama Lengkap Siswa hanya menerima huruf dan spasi (angka atau karakter khusus tidak diizinkan).'
                            );
                          } else if (namaSiswaError) {
                            setNamaSiswaError(null);
                          }
                          if (!hasStudentTypedName) {
                            setHasStudentTypedName(true);
                          }
                          setNamaSiswa(lettersAndSpaces);
                        }}
                        placeholder={
                          !studentPhotoUrl
                            ? '🔒 Wajib ambil Foto Profil terlebih dahulu...'
                            : 'Ketik nama lengkap siswa...'
                        }
                        className={`w-full h-6 sm:h-6.5 px-2 rounded-md border text-[9.5px] sm:text-[11px] font-medium transition-all [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${
                          !studentPhotoUrl
                            ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed select-none placeholder:text-slate-600'
                            : namaSiswaError
                            ? 'border-rose-500 bg-slate-950/80 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500'
                            : 'border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400'
                        }`}
                      />
                      {namaSiswaError && (
                        <p
                          role="alert"
                          className="mt-0.5 text-[7.5px] sm:text-[8.5px] font-semibold text-rose-400 flex items-center gap-1 leading-tight"
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                          <span>{namaSiswaError}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[8px] sm:text-[9.5px] font-bold text-sky-200 mb-0.5 truncate">
                        Nomor Induk (NIS / NISN)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        disabled={!studentPhotoUrl}
                        readOnly={!studentPhotoUrl}
                        value={nisNisn}
                        onChange={(e) => {
                          if (!studentPhotoUrl) return;
                          const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                          setNisNisn(digitsOnly);
                        }}
                        onKeyDown={(e) => {
                          if (!studentPhotoUrl) return;
                          if (
                            e.ctrlKey ||
                            e.metaKey ||
                            e.altKey ||
                            ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(
                              e.key
                            )
                          ) {
                            return;
                          }
                          if (!/^[0-9]$/.test(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onPaste={(e) => {
                          if (!studentPhotoUrl) return;
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text');
                          const digitsOnly = pasted.replace(/[^0-9]/g, '');
                          setNisNisn(digitsOnly);
                        }}
                        placeholder={
                          !studentPhotoUrl
                            ? '🔒 Wajib ambil Foto Profil terlebih dahulu...'
                            : 'Contoh: 0098123456'
                        }
                        className={`w-full h-6 sm:h-6.5 px-2 rounded-md border text-[9.5px] sm:text-[11px] font-mono font-medium transition-all ${
                          !studentPhotoUrl
                            ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed select-none placeholder:text-slate-600'
                            : 'border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400 placeholder:italic focus:outline-none focus:ring-1 focus:ring-amber-400'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Baris Pilih Kelas & Semester (2 Kolom Sejajar, Ukuran Seragam h-6 sm:h-6.5) */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                    {/* Pemilih Kelas Interaktif */}
                    <div>
                      <div className="flex flex-nowrap items-center justify-between gap-1 mb-0.5">
                        <label className="text-[8px] sm:text-[9.5px] font-bold text-sky-200 truncate">
                          Pilih Kelas Siswa
                        </label>
                        <span className="text-[7.5px] sm:text-[8px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                          {kelasSiswa ? `Kelas ${kelasSiswa}` : 'Belum Dipilih'}
                        </span>
                      </div>
                      <select
                        required
                        disabled={!studentPhotoUrl}
                        value={kelasSiswa}
                        onChange={(e) => {
                          if (!studentPhotoUrl) return;
                          const nextKls = e.target.value;
                          setKelasSiswa(nextKls);
                          if (headerJenjangFilter !== 'ALL' && nextKls) {
                            setHeaderJenjangFilter(getJenjangFromKelas(nextKls));
                          }
                        }}
                        className={`w-full h-6 sm:h-6.5 px-1.5 rounded-md border text-[9.5px] sm:text-[11px] font-bold transition-all ${
                          !studentPhotoUrl
                            ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                            : !kelasSiswa
                            ? 'border-amber-400/60 bg-slate-950/70 text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                            : 'border-white/20 bg-slate-950/70 text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                        }`}
                      >
                        <option value="" disabled className="bg-slate-900 text-slate-400">
                          -- Pilih Kelas Siswa --
                        </option>
                        {availableKelasOptions.map((kls) => (
                          <option key={kls} value={kls} className="bg-slate-900 text-white">
                            Kelas {kls}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pemilih Semester */}
                    <div>
                      <div className="flex flex-nowrap items-center justify-between gap-1 mb-0.5">
                        <label className="text-[8px] sm:text-[9.5px] font-bold text-sky-200 truncate">
                          Pilih Semester
                        </label>
                        <span className="text-[7.5px] sm:text-[8px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                          {semesterSiswa ? `Semester ${semesterSiswa}` : 'Belum Dipilih'}
                        </span>
                      </div>
                      <select
                        required
                        disabled={!studentPhotoUrl}
                        value={semesterSiswa}
                        onChange={(e) => {
                          if (!studentPhotoUrl) return;
                          setSemesterSiswa(e.target.value as 'Ganjil' | 'Genap' | '');
                        }}
                        className={`w-full h-6 sm:h-6.5 px-1.5 rounded-md border text-[9.5px] sm:text-[11px] font-bold transition-all ${
                          !studentPhotoUrl
                            ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                            : !semesterSiswa
                            ? 'border-amber-400/60 bg-slate-950/70 text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                            : 'border-white/20 bg-slate-950/70 text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                        }`}
                      >
                        <option value="" disabled className="bg-slate-900 text-slate-400">
                          -- Pilih Semester Ujian --
                        </option>
                        <option value="Ganjil" className="bg-slate-900 text-white">
                          Semester Ganjil
                        </option>
                        <option value="Genap" className="bg-slate-900 text-white">
                          Semester Genap
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* MENU FITUR BARU: PILIHAN TIPE SOAL (DROPDOWN DIBAWAH FITUR PILIH KELAS) */}
                  {/* 1. SOAL PILIHAN BERGANDA 25 SOAL (SOAL UJIAN ) */}
                  {/* 2. SOAL ESAY TEST 15 SOAL ( LATIHAN DIKELAS/ TUGAS DIRUMAH) */}
                  {/* ========================================================================= */}
                  <div>
                    <div className="flex flex-nowrap items-center justify-between gap-1 mb-0.5">
                      <label className="text-[8px] sm:text-[9.5px] font-bold text-sky-200 flex items-center gap-1 min-w-0">
                        <BookOpen className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        <span className="truncate">Menu Format Soal (Ujian / Latihan)</span>
                      </label>
                      <span
                        className={`text-[7.5px] sm:text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded-full border whitespace-nowrap shrink-0 ${
                          jenisSoalUjian === 'PILIHAN_BERGANDA'
                            ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                            : 'bg-emerald-400/20 border-emerald-400/40 text-emerald-300'
                        }`}
                      >
                        {jenisSoalUjian === 'PILIHAN_BERGANDA'
                          ? '25 Soal (Ujian Resmi)'
                          : '15 Soal (Latihan / Tugas)'}
                      </span>
                    </div>
                    <select
                      value={jenisSoalUjian}
                      disabled={!studentPhotoUrl}
                      onChange={(e) =>
                        setJenisSoalUjian(e.target.value as 'PILIHAN_BERGANDA' | 'ESAY_TEST')
                      }
                      className={`w-full h-6 sm:h-6.5 px-2 rounded-md border text-[9.5px] sm:text-[11px] font-bold transition-all ${
                        !studentPhotoUrl
                          ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                          : jenisSoalUjian === 'PILIHAN_BERGANDA'
                          ? 'border-amber-400/70 bg-slate-950/90 text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer'
                          : 'border-emerald-400/70 bg-slate-950/90 text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer'
                      }`}
                    >
                      <option value="PILIHAN_BERGANDA" className="bg-slate-900 text-white">
                        1. SOAL PILIHAN BERGANDA 25 SOAL (SOAL UJIAN )
                      </option>
                      <option value="ESAY_TEST" className="bg-slate-900 text-emerald-300">
                        2. SOAL ESAY TEST 15 SOAL ( LATIHAN DIKELAS/ TUGAS DIRUMAH)
                      </option>
                    </select>

                    {/* Deskripsi Info Format Soal Terpilih (Selector 1: form > div:nth-of-type(4) > div:nth-of-type(2)) */}
                    <div
                      className={`mt-0.5 px-2 py-1 rounded-md border text-[7.5px] sm:text-[8px] flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 leading-tight transition-all ${
                        jenisSoalUjian === 'PILIHAN_BERGANDA'
                          ? 'bg-sky-950/40 border-sky-400/30 text-sky-200'
                          : 'bg-emerald-950/50 border-emerald-400/40 text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {jenisSoalUjian === 'PILIHAN_BERGANDA' ? (
                          <CheckCircle2 className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        ) : (
                          <Globe className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                        )}
                        <span className="truncate">
                          {jenisSoalUjian === 'PILIHAN_BERGANDA' ? (
                            <>
                              <strong className="text-amber-300">25 Soal Pilihan Berganda (Ujian Resmi):</strong> Sistem bawaan ujian resmi ANBK, standar kelulusan KKM 75.
                            </>
                          ) : (
                            <>
                              <strong className="text-emerald-300">15 Soal Esay Online (Latihan/Tugas):</strong> Dilengkapi sensor anti-curang (blokir screenshot tombol HP/gesture, dilarang blok/copy soal, otomatis diskualifikasi jika 3x pelanggaran).
                            </>
                          )}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[6.5px] sm:text-[7px] font-extrabold px-1.5 py-0.2 rounded-full border whitespace-nowrap shrink-0 ${
                          jenisSoalUjian === 'PILIHAN_BERGANDA'
                            ? 'bg-amber-400/15 border-amber-400/35 text-amber-300'
                            : 'bg-emerald-400/20 border-emerald-400/40 text-emerald-300'
                        }`}
                      >
                        {jenisSoalUjian === 'PILIHAN_BERGANDA' ? '25 Soal · KKM 75' : '15 Soal · Soal Baru Tiap Susulan'}
                      </span>
                    </div>
                  </div>

                  {/* Indikator Deteksi Perangkat, IP & Pengacakan Soal Online Otomatis Sesuai Jenjang Kelas (VII / VIII) & Semester (Selector 2: form > div:nth-of-type(5)) */}
                  <div
                    className={`p-1.5 rounded-md border text-[7.5px] sm:text-[8px] flex flex-wrap items-center justify-between gap-1 leading-tight transition-all shadow-2xs ${
                      jenisSoalUjian === 'ESAY_TEST'
                        ? 'bg-gradient-to-r from-emerald-950/70 via-slate-900/80 to-teal-950/70 border-emerald-400/40 text-emerald-100'
                        : 'bg-gradient-to-r from-sky-950/70 via-slate-900/80 to-indigo-950/70 border-sky-400/35 text-sky-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Globe
                        className={`w-2.5 h-2.5 shrink-0 ${
                          isSyncingEssayQuestions || isSyncingOnlineQuestions
                            ? 'animate-spin text-emerald-300'
                            : 'text-emerald-300'
                        }`}
                      />
                      <span className="truncate">
                        <strong className="text-amber-300">
                          {jenisSoalUjian === 'ESAY_TEST'
                            ? 'Anti-Contek Lintas Device & IP:'
                            : 'Deteksi Perangkat & IP:'}
                        </strong>{' '}
                        {detectedDevice.deviceCategory} ({effectiveDeviceModel}) · IP:{' '}
                        <span className="font-mono text-emerald-300 font-bold">{effectiveClientIp}</span>{' '}
                        {jenisSoalUjian === 'ESAY_TEST'
                          ? '· Soal berbeda per siswa (Android/iPhone/Chromebook/PC)'
                          : '· Kunci Layar Penuh'}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-400/40 font-mono text-[6.5px] sm:text-[7px] font-extrabold text-emerald-300 shrink-0">
                      ✓ Unik ({effectiveDeviceFingerprint})
                    </span>
                  </div>

                  {/* Input Kode Token 6 Digit (Input Manual) */}
                  <div>
                    <div className="flex flex-nowrap items-center justify-between gap-1 mb-0.5">
                      <label className="text-[8px] sm:text-[9.5px] font-bold text-sky-300 flex items-center gap-1 min-w-0">
                        <KeyRound className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        <span className="inline-block px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 truncate">
                          Kode Token Ujian (Input Manual)
                        </span>
                      </label>
                      <div className="flex flex-nowrap items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={!studentPhotoUrl}
                          onClick={() => {
                            if (!studentPhotoUrl) return;
                            setShowQrScannerModal(true);
                          }}
                          className={`relative overflow-hidden inline-flex items-center gap-0.5 h-4.5 px-1.5 rounded-full text-[7.5px] sm:text-[8px] font-extrabold shadow-2xs whitespace-nowrap transition-all ${
                            !studentPhotoUrl
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : isQrCameraActive || showQrScannerModal
                              ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 ring-1 ring-emerald-300 qr-camera-active-glow cursor-pointer'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                          }`}
                        >
                          <QrCode className="w-2 h-2 shrink-0" />
                          <span>
                            {isQrCameraActive || showQrScannerModal
                              ? 'Pindai QR'
                              : 'Scan QR'}
                          </span>
                        </button>
                        {sanitizeTokenValue(inputToken).length > 0 ? (
                          <span className="inline-flex items-center gap-0.5 h-4.5 px-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[7.5px] sm:text-[8px] font-extrabold text-emerald-300 whitespace-nowrap">
                            <CheckCircle2 className="w-2 h-2 text-emerald-400 shrink-0" />
                            Input ({sanitizeTokenValue(inputToken)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 h-4.5 px-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[7.5px] sm:text-[8px] font-extrabold text-amber-300 whitespace-nowrap">
                            <KeyRound className="w-2 h-2 text-amber-300 shrink-0" />
                            Ketik 6 Digit
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      required
                      disabled={!studentPhotoUrl}
                      readOnly={!studentPhotoUrl}
                      autoComplete="off"
                      maxLength={6}
                      value={inputToken}
                      onChange={(e) => {
                        if (!studentPhotoUrl) return;
                        const nextVal = e.target.value.toUpperCase();
                        setInputToken(nextVal);
                        if (loginError) setLoginError('');
                        const cleanedNext = sanitizeTokenValue(nextVal);
                        if (cleanedNext.length >= 3) {
                          const check = checkStudentTokenUsage(
                            cleanedNext,
                            namaSiswa,
                            nisNisn,
                            submissions
                          );
                          if (check.isAlreadyUsed && check.usageCount >= 3) {
                            triggerExhaustedTokenToast(
                              cleanedNext,
                              check.usageCount,
                              check.usedRecord?.usedAt
                            );
                          } else if (exhaustedTokenToast) {
                            setExhaustedTokenToast(null);
                          }
                        } else if (exhaustedTokenToast) {
                          setExhaustedTokenToast(null);
                        }
                      }}
                      placeholder={
                        !studentPhotoUrl
                          ? '🔒 WAJIB AMBIL FOTO PROFIL PESERTA TERLEBIH DAHULU...'
                          : 'KETIK 6 DIGIT KODE TOKEN UJIAN...'
                      }
                      className={`w-full h-6.5 sm:h-7 px-2.5 rounded-md border text-[10.5px] sm:text-xs font-mono font-extrabold tracking-widest uppercase text-center transition-all ${
                        !studentPhotoUrl
                          ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed placeholder:text-slate-600'
                          : 'border-sky-400/50 bg-slate-950/80 text-amber-300 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400'
                      }`}
                    />

                    {/* Panel Pengenalan Kode Token yang Dimasukkan Siswa Secara Manual (Real-Time Recognition & Aturan 3 Kali Pakai) */}
                    {(() => {
                      const typedClean = sanitizeTokenValue(inputToken);
                      const activeClean = sanitizeTokenValue(onlineToken);
                      const usageStatus = checkStudentTokenUsage(
                        typedClean,
                        namaSiswa,
                        nisNisn,
                        submissions
                      );
                      const matchesActiveOrValidNew =
                        !usageStatus.isAlreadyUsed &&
                        (typedClean === activeClean || typedClean.length === 6);

                      const cleanStudentNis = (nisNisn || '').trim().toLowerCase();
                      const cleanStudentName = (namaSiswa || '').trim().toLowerCase();
                      const studentUsedHistory = (usedTokensList || []).filter((u: UsedExamTokenRecord) => {
                        if (cleanStudentNis && u.nisNisn && u.nisNisn.trim().toLowerCase() === cleanStudentNis) return true;
                        if (cleanStudentName && u.namaSiswa && u.namaSiswa.trim().toLowerCase() === cleanStudentName) return true;
                        return false;
                      });

                      const activeTokenUsage = checkStudentTokenUsage(
                        activeClean || typedClean,
                        namaSiswa,
                        nisNisn,
                        submissions
                      );
                      const hasReached3xQuota =
                        (usageStatus.isAlreadyUsed && usageStatus.usageCount >= 3) ||
                        (activeTokenUsage.isAlreadyUsed && activeTokenUsage.usageCount >= 3);

                      return (
                        <div className="mt-0.5 space-y-0.5">
                          {typedClean.length > 0 ? (
                            usageStatus.isAlreadyUsed ? (
                              <div className="p-1 sm:p-1.5 rounded bg-rose-950/95 border border-rose-500/80 text-rose-200 text-[8px] sm:text-[9px] space-y-0.5 shadow-sm">
                                <div className="flex items-start gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="text-rose-300 block uppercase tracking-wide text-[7.5px] sm:text-[8.5px]">
                                      KODE TOKEN [{typedClean}] DIKENALI: SUDAH TERPAKAI 3 KALI (KUOTA HABIS)!
                                    </strong>
                                    <p className="mt-0.5 leading-tight text-[7.5px] sm:text-[8.5px] text-rose-100">
                                      Kode token <strong className="text-white">[{typedClean}]</strong> telah mencapai batas kuota pemakaian{' '}
                                      <strong className="text-white">TIGA KALI (3x)</strong> ({usageStatus.usageCount}/3 pemakaian). Siswa{' '}
                                      <strong className="text-amber-300">TIDAK BISA memulai ujian lagi</strong> dengan kode token yang kuotanya sudah habis
                                      {usageStatus.usedRecord?.usedAt
                                        ? ` (terakhir pada ${usageStatus.usedRecord.usedAt})`
                                        : ''}
                                      .
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={handleRequestNewTokenFromTeacher}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[7.5px] sm:text-[8.5px] shadow-2xs cursor-pointer"
                                  >
                                    <KeyRound className="w-2 h-2" />
                                    Minta Kode Token Baru pada Guru Mapel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowExhaustedStudentsModal(true)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[7.5px] sm:text-[8.5px] shadow-2xs cursor-pointer"
                                  >
                                    <Users className="w-2 h-2" />
                                    Lihat Siswa Habis Token 3x
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInputToken('');
                                      setLoginError('');
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-[7.5px] sm:text-[8.5px] cursor-pointer"
                                  >
                                    Kosongkan &amp; Ketik Token Baru
                                  </button>
                                </div>
                              </div>
                            ) : usageStatus.usageCount > 0 ? (
                              <div className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400/50 text-amber-200 text-[7.5px] sm:text-[8.5px] leading-tight flex flex-wrap items-center justify-between gap-1">
                                <div className="flex items-start gap-1">
                                  <KeyRound className="w-2 h-2 text-amber-300 shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="text-amber-300 block uppercase">
                                      ✓ KODE TOKEN [{typedClean}] VALID (TERPAKAI {usageStatus.usageCount}/3x · SISA {usageStatus.remainingUsage}x)
                                    </strong>
                                    Token valid (sisa <strong className="text-white">{usageStatus.remainingUsage}x pakai</strong>).
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleRequestNewTokenFromTeacher}
                                  className="text-amber-300 hover:text-amber-200 font-bold underline shrink-0 cursor-pointer text-[7px] sm:text-[8px]"
                                >
                                  Minta Token Baru ({usageStatus.usageCount}/3x)
                                </button>
                              </div>
                            ) : matchesActiveOrValidNew ? (
                              <div className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/50 text-emerald-200 text-[7.5px] sm:text-[8.5px] leading-tight flex flex-wrap items-center justify-between gap-1">
                                <div className="flex items-start gap-1">
                                  <CheckCircle2 className="w-2 h-2 text-emerald-400 shrink-0 mt-0.5" />
                                  <div>
                                    <strong className="text-emerald-300 block uppercase">
                                      ✓ KODE TOKEN [{typedClean}] VALID (BELUM DIPAKAI · KUOTA 3x)
                                    </strong>
                                    Siap digunakan hingga <strong className="text-white">3x memulai ujian</strong>.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleRequestNewTokenFromTeacher}
                                  className="text-amber-300 hover:text-amber-200 font-bold underline shrink-0 cursor-pointer text-[7px] sm:text-[8px]"
                                >
                                  Minta Token Baru (0/3x)
                                </button>
                              </div>
                            ) : (
                              <div className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400/50 text-amber-200 text-[7.5px] sm:text-[8.5px] leading-tight flex items-start gap-1">
                                <KeyRound className="w-2 h-2 text-amber-300 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-amber-300 block uppercase">
                                    KODE TOKEN DIKENALI: [{typedClean}] ({typedClean.length}/6 KARAKTER)
                                  </strong>
                                  {typedClean.length < 6
                                    ? 'Lengkapi 6 karakter Kode Token Baru dari Guru Mapel.'
                                    : `Kode token [${typedClean}] siap diverifikasi.`}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/30 text-white text-[7px] sm:text-[8.5px] leading-tight flex flex-wrap items-center justify-between gap-1">
                              <span className="text-white">
                                Ketik <strong>manual</strong> 6 digit <strong>Kode Token</strong> (kuota 3x · dipakai {activeTokenUsage.usageCount}/3x).
                              </span>
                              <button
                                type="button"
                                onClick={handleRequestNewTokenFromTeacher}
                                className={`font-bold underline shrink-0 cursor-pointer text-[7px] sm:text-[8px] ${
                                  hasReached3xQuota
                                    ? 'text-emerald-300 hover:text-emerald-200'
                                    : 'text-amber-300 hover:text-amber-200'
                                }`}
                              >
                                {hasReached3xQuota
                                  ? 'Minta Token Baru (Kuota 3x Habis ✓)'
                                  : `Minta Token Baru (${activeTokenUsage.usageCount}/3x)`}
                              </button>
                            </div>
                          )}

                          {studentUsedHistory.length > 0 && (
                            <div className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-rose-500/40 text-[7px] sm:text-[8px] text-slate-300">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="font-bold text-rose-300">
                                  🔒 Riwayat Kode Token Sudah Dipakai:
                                </span>
                                <div className="flex flex-wrap items-center gap-1">
                                  {Array.from(new Set(studentUsedHistory.map((u: UsedExamTokenRecord) => u.token))).map(
                                    (tok: string) => (
                                      <span
                                        key={tok}
                                        className="px-1 py-0.1 rounded bg-rose-500/20 border border-rose-500/40 font-mono font-bold text-rose-300 line-through text-[7px] sm:text-[8px]"
                                      >
                                        {tok}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Tombol Utama Mulai Ujian (Selector 3: form > div:nth-of-type(7) > button:nth-of-type(1)) */}
                  <div className="pt-0.5">
                    <button
                      type="submit"
                      disabled={!studentPhotoUrl || (jenisSoalUjian === 'PILIHAN_BERGANDA' && (!isSheetTokenSynced || !onlineToken))}
                      className={`w-full h-6 sm:h-6.5 px-2 rounded-md font-extrabold text-[8.5px] sm:text-[9.5px] tracking-wide flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer active:scale-[0.99] ${
                        !studentPhotoUrl
                          ? 'bg-rose-950/85 border border-rose-500/60 text-rose-300 cursor-not-allowed shadow-inner'
                          : jenisSoalUjian === 'ESAY_TEST'
                          ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white'
                          : isSheetTokenSynced && onlineToken
                          ? 'bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700 hover:from-sky-500 hover:to-indigo-500 text-white'
                          : 'bg-slate-800/90 border border-rose-500/40 text-rose-300 cursor-not-allowed'
                      }`}
                    >
                      {!studentPhotoUrl ? (
                        <>
                          <Lock className="w-2.5 h-2.5 text-rose-400 shrink-0 animate-pulse" />
                          <span className="truncate">Wajib Ambil Foto Profil Terlebih Dahulu</span>
                        </>
                      ) : jenisSoalUjian === 'ESAY_TEST' ? (
                        <>
                          <Play className="w-2.5 h-2.5 fill-current text-emerald-200 shrink-0" />
                          <span className="truncate">MULAI 15 SOAL ESAY ONLINE SEKARANG</span>
                        </>
                      ) : isSheetTokenSynced && onlineToken ? (
                        <>
                          <Play className="w-2.5 h-2.5 fill-current text-sky-200 shrink-0" />
                          <span className="truncate">MULAI UJIAN PILIHAN BERGANDA (25 SOAL)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                          <span className="truncate">Ujian Terkunci (Menunggu Sinkron Token)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SUB-MENU: PANEL FITUR MENU MONITORING UJIAN SISWA (REAL-TIME) */}
          {/* =============================================================== */}
          {homeSection === 'MONITORING_UJIAN' && (
            <div className="space-y-3">
              <ExamMonitoringView
                submissions={submissions}
                classroomStudents={classroomStudents}
                activeExamDraft={activeExamDraft}
                onlineToken={onlineToken}
                headerJenjangFilter={headerJenjangFilter}
                onJenjangFilterChange={(j) => setHeaderJenjangFilter(j)}
                isTeacherAuthenticated={isTeacherTokenUnlocked}
                onUnlockTeacherAuth={() => setIsTeacherTokenUnlocked(true)}
                onClearClassroomStudents={() => {
                  setClassroomStudents([]);
                  setClassroomSyncStatus(null);
                  try {
                    localStorage.removeItem(STORAGE_KEY_STUDENTS);
                    localStorage.removeItem('anbk_classroom_active_student_sync_v1');
                  } catch {}
                }}
                onUpdateClassroomStudents={(nextCls) => {
                  setClassroomStudents(nextCls);
                  try {
                    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextCls));
                  } catch {}
                }}
                onSyncRefresh={() => {
                  handleSyncLoginFeaturesToGoogleSheets(false, undefined, 'rekap');
                  handleSyncStudentDashboard(false);
                }}
                onOpenClassroomDesign={() => {
                  setAutoReturnHomeSeconds(null);
                  setRedWarningOverlay(false);
                  try {
                    localStorage.setItem('anbk_classroom_has_entered', 'true');
                  } catch {}
                  setHasEnteredClassroom(true);
                  setView('DESIGN_CLASSROOM');
                  window.scrollTo(0, 0);
                }}
                onResetAllSubmissions={handleResetAllSubmissions}
                onUpdateSubmissions={handleUpdateSubmissions}
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* SUB-MENU 3: PRESENSI & KEHADIRAN SISWA (BIOMETRIK & MULTI-ROLE) */}
          {/* =============================================================== */}
          {homeSection === 'ABSENSI_SISWA' && (
            <div className="space-y-3">
              <StudentBiometricAttendanceView
                onBackToHome={() => {
                  setHomeSection('PORTAL_UJIAN');
                  window.scrollTo(0, 0);
                }}
                onProceedToExam={(studentInfo) => {
                  setNamaSiswa(studentInfo.nama);
                  setNisNisn(studentInfo.nisn);
                  setKelasSiswa(studentInfo.kelas);
                  setHomeSection('PORTAL_UJIAN');
                  window.scrollTo({ top: 500, behavior: 'smooth' });
                }}
                detectedDevice={detectedDevice}
                effectiveDeviceModel={effectiveDeviceModel}
                darkMode={darkMode}
              />
            </div>
          )}

          {/* =============================================================== */}
          {/* SUB-MENU 4: KISI-KISI MATERI BAB 4 & STANDAR KELULUSAN KKM */}
          {/* =============================================================== */}
          {homeSection === 'KISI_MATERI' && (
            <div className="space-y-3.5">
              {/* 3 Kartu Ringkasan Materi & KKM */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Materi Fase D: Kelas {activePackageMeta.jenjang} Semester {activePackageMeta.semester}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activePackageMeta.deskripsiMateri}
                  </p>
                </div>

                <div className="rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Komposisi {hotsCount} HOTS &amp; {regulerCount} Reguler
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Terdiri atas <strong className="text-amber-300">{regulerCount} Soal REGULER</strong> (arsitektur komputer &amp; sistem bilangan) dan <strong className="text-amber-300">{hotsCount} Soal HOTS</strong> (analisis performa memori, device driver, heksadesimal, &amp; gerbang logika).
                  </p>
                </div>

                <div className="rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Standar Kelulusan KKM = {EXAM_INFO.kkm}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    • KKM <strong className="text-emerald-300">{EXAM_INFO.kkm}–100</strong>: <strong className="text-emerald-300">Anda Lulus Ujian</strong>.<br />
                    • KKM <strong className="text-rose-300">0–{EXAM_INFO.kkm - 1}</strong>: <strong className="text-rose-300">Ujian Susulan</strong>.<br />
                    • Data otomatis tersimpan ke Server Rekap dan tersedia opsi kirim WhatsApp ke Guru di lembar hasil.
                  </p>
                </div>
              </div>

              {/* Grid 2 Kolom: Fitur Paket Soal Online Fase D & Parameter Ujian ANBK Lengkap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                {/* Panel Paket Soal Online Fase D */}
                <div
                  className={`rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-3 shadow-md text-white flex flex-col justify-between ${
                    darkMode
                      ? 'bg-gradient-to-br from-slate-950 via-slate-900/95 to-sky-950/60 border-sky-400/40'
                      : 'bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/60 border-sky-400/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shrink-0">
                          <Globe className={`w-3.5 h-3.5 ${isSyncingOnlineQuestions ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-amber-300">
                            PAKET SOAL ONLINE FASE D
                          </h3>
                          <span className="text-[11px] text-sky-200 font-medium block">
                            Kelas {activePackageMeta.jenjang} · Sem {activePackageMeta.semester} (Kurikulum Merdeka)
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleManualFetchOnlineQuestions}
                        disabled={isSyncingOnlineQuestions}
                        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all duration-300 cursor-pointer shadow-xs ${
                          isOnlineQuestionsSyncAnimated && !isSyncingOnlineQuestions
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-2 ring-emerald-400/50 scale-[1.02]'
                            : 'bg-sky-500/25 hover:bg-sky-500/40 border-sky-400/40 text-sky-200'
                        }`}
                      >
                        {isOnlineQuestionsSyncAnimated && !isSyncingOnlineQuestions ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0 animate-bounce" />
                            <span>Selesai Sinkron!</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className={`w-3 h-3 ${isSyncingOnlineQuestions ? 'animate-spin' : ''}`} />
                            <span>Perbarui Soal</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Topik Materi Utama */}
                    <div className="p-2.5 rounded-lg bg-slate-950/75 border border-white/10 space-y-0.5">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider text-sky-300 block">
                        Topik Cakupan Ujian:
                      </span>
                      <p className="text-xs sm:text-sm text-white font-bold leading-snug">
                        {activePackageMeta.topik}
                      </p>
                    </div>

                    {/* Elemen & Komposisi Soal */}
                    <div className="space-y-1">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider text-slate-300 block">
                        Elemen Capaian Pembelajaran:
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {activePackageMeta.elemenCakupan.map((el) => (
                          <span
                            key={el}
                            className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-white/15 text-[11px] text-sky-200 font-medium"
                          >
                            {el}
                          </span>
                        ))}
                        <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-[11px] text-amber-300 font-bold">
                          {questions.length} Soal ({hotsCount} HOTS &amp; {regulerCount} Reguler)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sumber Bank Soal Online */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-300 mt-1">
                    <span className="truncate">Sumber: {onlineQuestionSourceText}</span>
                    <span className="text-emerald-300 font-bold shrink-0 ml-2">● Online Aktif</span>
                  </div>
                </div>

                {/* Kartu Informasi Ringkas Struktur Ujian & Parameter Standar KKM */}
                <div
                  className={`rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-3 shadow-md text-white flex flex-col justify-between ${
                    darkMode
                      ? 'bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30'
                      : 'bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 border-sky-500/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-300" />
                        <span>RINGKASAN PARAMETER UJIAN ANBK</span>
                      </h3>
                      <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9.5px] font-mono font-bold text-emerald-300">
                        STANDAR RESMI
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                      <div className="p-2.5 rounded-lg border bg-white/5 border-white/10 space-y-0.5">
                        <span className="text-slate-300 block text-[10px]">Komposisi Soal</span>
                        <span className="font-bold text-xs sm:text-sm text-white block">
                          {hotsCount} HOTS &amp; {regulerCount} Reguler
                        </span>
                        <span className="text-[9.5px] text-slate-400 block">Total {questions.length} Butir</span>
                      </div>

                      <div className="p-2.5 rounded-lg border bg-white/5 border-white/10 space-y-0.5">
                        <span className="text-slate-300 block text-[10px]">Durasi Waktu</span>
                        <span className="font-bold text-xs sm:text-sm text-amber-300 block">30 Menit Real-Time</span>
                        <span className="text-[9.5px] text-slate-400 block">Timer Mundur Otomatis</span>
                      </div>

                      <div className="p-2.5 rounded-lg border bg-emerald-950/30 border-emerald-500/30 space-y-0.5">
                        <span className="text-emerald-300 block text-[10px]">Nilai Lulus (KKM)</span>
                        <span className="font-bold text-xs sm:text-sm text-emerald-400 block">
                          {EXAM_INFO.kkm} – 100 (Anda Lulus)
                        </span>
                        <span className="text-[9.5px] text-emerald-300/80 block">Kategori Kompeten</span>
                      </div>

                      <div className="p-2.5 rounded-lg border bg-rose-950/30 border-rose-500/30 space-y-0.5">
                        <span className="text-rose-300 block text-[10px]">Di Bawah KKM</span>
                        <span className="font-bold text-xs sm:text-sm text-rose-400 block">
                          0 – {EXAM_INFO.kkm - 1} (Susulan)
                        </span>
                        <span className="text-[9.5px] text-rose-300/80 block">Perlu Remedial / Ulang</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[10.5px] text-slate-300 font-mono">
                      KKM SMPN 7 Kisaran: <strong className="text-amber-300">{EXAM_INFO.kkm}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setHomeSection('PORTAL_UJIAN')}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Ke Portal Login</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SUB-MENU 3: TATA TERTIB & SISTEM PROTEKSI ANTI-KECURANGAN */}
          {/* =============================================================== */}
          {homeSection === 'ATURAN_ANTI_CURANG' && (
            <div className="space-y-3 sm:space-y-4">
              {/* Komponen Fitur Penguncian Fullscreen & Anti Split-Screen (Lintas Platform: Laptop, Chromebook, Android, iPhone) */}
              <FullscreenAntiSplitScreenCard
                detectedDevice={detectedDevice}
                effectiveDeviceModel={effectiveDeviceModel}
                darkMode={darkMode}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center">
                  <MonitorCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Penguncian Fullscreen &amp; Anti Split-Screen
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Saat menekan tombol <strong className="text-emerald-300">Mulai Ujian</strong>, Soal Ujian tidak bisa di-copy, layar tidak bisa di-Screenshot, dan sistem mengunci layar penuh pada Laptop, Chromebook, Android, dan iPhone. Jika layar dibelah (Split-Screen) akan ada peringatan pelanggaran, jika dalam waktu <strong className="text-amber-300">15 detik</strong> tidak kembali ke soal Ujian maka Ujian langsung dihentikan Otomatis dan dinyatakan <strong className="text-rose-300">Tidak Lulus Ujian dan Wajib Ujian Susulan</strong>.
                </p>
              </div>

              <div className="rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Deteksi Pindah Tab (Countdown 15s &amp; Maks 3x)
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Meninggalkan tab ujian memunculkan <strong className="text-amber-300">Layar Merah Peringatan 15 Detik</strong>. Jika tidak kembali dalam 15 detik atau mencapai <strong className="text-amber-300">3 kali pelanggaran</strong>, siswa otomatis dinyatakan <strong className="text-rose-300">Tidak Lulus Ujian (Siswa Wajib Ujian Susulan)</strong>.
                </p>
              </div>

              <div className="rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 space-y-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 border-sky-500/30 shadow-md text-white">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Auto-Save Real-Time &amp; Opsi Kirim WhatsApp
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Setiap jawaban langsung tersimpan otomatis ke Server Rekap beserta status kecurangan. Saat ujian selesai, laporan dikirim ke email <strong className="text-amber-300">{EXAM_INFO.teacherEmail}</strong> dan siswa dapat mengirim laporan ke WA Guru secara manual.
                </p>
              </div>
            </div>
          </div>
        )}
        </main>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: HALAMAN PETUNJUK UJIAN (KONFIRMASI SEBELUM FULLSCREEN) */}
      {/* =================================================================== */}
      {view === 'INSTRUCTIONS' && (
        <main className="flex-1 max-w-2xl w-full mx-auto px-2 sm:px-3 py-1.5 sm:py-2.5">
          <div className="rounded-lg sm:rounded-xl border border-sky-500/35 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-lg">
            {/* Selector 1: Header Konfirmasi & Petunjuk */}
            <div className="bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border-b border-sky-500/30 text-white px-2.5 py-2 sm:px-3.5 sm:py-2.5 flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TutWuriLogo size="sm" className="!w-7 !h-7 sm:!w-8 sm:!h-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[7.5px] sm:text-[9px] font-extrabold tracking-wider uppercase text-sky-300 leading-tight truncate">
                    {jenisSoalUjian === 'ESAY_TEST'
                      ? 'KONFIRMASI & PETUNJUK: SOAL ESAY TEST 15 SOAL (LATIHAN / TUGAS)'
                      : 'KONFIRMASI & PETUNJUK PELAKSANAAN UJIAN ANBK'}
                  </div>
                  <h1 className="font-display text-[10px] sm:text-xs font-extrabold mt-0.5 text-white leading-tight truncate">
                    {jenisSoalUjian === 'ESAY_TEST'
                      ? `SOAL ESAY INFORMATIKA KELAS ${kelasSiswa || 'FASE D'} — SEMESTER ${semesterSiswa || 'GANJIL'} (15 SOAL)`
                      : `${activePackageMeta.judul} — ${EXAM_INFO.namaSekolah}`}
                  </h1>
                  <p className="text-[8px] sm:text-[9.5px] text-amber-300 font-semibold mt-0.5 leading-tight truncate">
                    {jenisSoalUjian === 'ESAY_TEST'
                      ? 'Format: 15 Soal Esay Online · Latihan Dikelas & Tugas Dirumah Kurikulum Merdeka Fase D'
                      : <>Topik Fase D: <strong>{activePackageMeta.topik}</strong></>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-amber-400/40 rounded-md px-1.5 py-1 sm:px-2 sm:py-1 shrink-0">
                <div className="w-5 h-6.5 sm:w-6 sm:h-7.5 rounded overflow-hidden border border-amber-400 bg-red-600 shrink-0 flex items-center justify-center">
                  {teacherPhotoUrl ? (
                    <img
                      src={teacherPhotoUrl}
                      alt={`Pembuat Soal - ${EXAM_INFO.guruMapel}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <GraduationCap className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="text-left leading-tight">
                  <span className="text-[6.5px] sm:text-[7.5px] font-bold uppercase tracking-wider text-amber-300 block">
                    Pembuat Soal
                  </span>
                  <span className="text-[8px] sm:text-[9.5px] font-extrabold text-white block mt-0.2">
                    {EXAM_INFO.guruMapelUpper}
                  </span>
                </div>
              </div>
            </div>

            {/* Selector 9: Body Container */}
            <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
              {/* Data Peserta yang Login beserta Foto Profil dari localStorage */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {/* Selector 2: Nama & Foto Peserta */}
                <div className="p-1.5 sm:p-2 rounded-md border bg-white/5 border-white/15 flex items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setShowStudentCameraModal(true)}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded overflow-hidden border border-amber-400 bg-gradient-to-br from-sky-600 to-indigo-800 shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      {studentPhotoUrl ? (
                        <img
                          src={studentPhotoUrl}
                          alt={namaSiswa}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-[8px] sm:text-[9px] font-extrabold text-white">
                          {getStudentInitials(namaSiswa)}
                        </span>
                      )}
                    </button>
                    <div className="min-w-0">
                      <span className="text-[7px] sm:text-[8.5px] text-sky-200 block leading-tight truncate">
                        Nama Peserta
                      </span>
                      <span className="text-[8.5px] sm:text-[10.5px] font-bold text-white mt-0.2 block truncate leading-tight">
                        {namaSiswa}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStudentCameraModal(true)}
                    className="p-1 rounded bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 shrink-0 cursor-pointer hidden sm:inline-flex"
                  >
                    <Camera className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Selector 3: Kelas, Semester & NIS/NISN */}
                <div className="p-1.5 sm:p-2 rounded-md border bg-white/5 border-white/15 flex flex-col justify-center min-w-0">
                  <span className="text-[7px] sm:text-[8.5px] text-sky-200 block leading-tight truncate">
                    Kelas, Sem &amp; NISN
                  </span>
                  <span className="text-[8.5px] sm:text-[10.5px] font-bold text-amber-300 mt-0.2 block font-mono leading-tight truncate">
                    {kelasSiswa} ({semesterSiswa}) · {nisNisn}
                  </span>
                </div>

                {/* Selector 4: Durasi & Jumlah Soal */}
                <div
                  className={`p-1.5 sm:p-2 rounded-md border flex flex-col justify-center min-w-0 transition-all ${
                    jenisSoalUjian === 'ESAY_TEST'
                      ? 'bg-emerald-950/40 border-emerald-400/50 shadow-xs'
                      : 'bg-white/5 border-white/15'
                  }`}
                >
                  <span className="text-[7px] sm:text-[8.5px] text-sky-200 block leading-tight truncate">
                    {jenisSoalUjian === 'ESAY_TEST' ? 'Format & Jumlah Soal' : 'Durasi & Jumlah Soal'}
                  </span>
                  <span
                    className={`text-[8.5px] sm:text-[10.5px] font-bold mt-0.2 block leading-tight truncate ${
                      jenisSoalUjian === 'ESAY_TEST' ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {jenisSoalUjian === 'ESAY_TEST'
                      ? '15 Soal Esay Online (45m)'
                      : `30m · 25 Soal Pilihan Berganda`}
                  </span>
                </div>

                {/* Selector 5: Deteksi Perangkat, IP & Pengacakan Soal Online Otomatis */}
                <div className="px-2 py-1.5 rounded-md border bg-emerald-950/40 border-emerald-400/35 col-span-3 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {detectedDevice.isMobileOrTablet ? (
                      <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Laptop className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[7px] sm:text-[8.5px] font-mono uppercase tracking-wider text-emerald-300 block leading-tight truncate">
                        {jenisSoalUjian === 'ESAY_TEST'
                          ? `Deteksi Perangkat, IP & Bank Soal Esay Online (Kelas ${kelasSiswa || 'VII'} · ${semesterSiswa || 'Ganjil'})`
                          : `Deteksi Perangkat, IP & Soal Online Acak (Kelas ${kelasSiswa || 'VII'} · ${semesterSiswa || 'Ganjil'})`}
                      </span>
                      <span className="text-[8.5px] sm:text-[10px] font-extrabold text-white block leading-tight truncate">
                        {detectedDevice.deviceCategory} —{' '}
                        <span className="text-amber-300">{effectiveDeviceModel}</span> (
                        {detectedDevice.osNameVersion}) · IP:{' '}
                        <span className="font-mono text-emerald-300">{effectiveClientIp}</span>
                      </span>
                      <span className="text-[7.5px] sm:text-[9px] text-sky-200 block leading-tight truncate">
                        {jenisSoalUjian === 'ESAY_TEST' ? (
                          <>
                            ✓ 15 Soal Esay Online Kelas <strong className="text-amber-300">{getJenjangFromKelas(kelasSiswa) || 'VII'}</strong> Sem <strong className="text-amber-300">{semesterSiswa || 'Ganjil'}</strong> dimuat langsung dari Bank Soal Daring Kurikulum Merdeka (Deep Learning).
                          </>
                        ) : (
                          <>
                            ✓ Paket 25 Soal Ujian Kelas <strong className="text-amber-300">{getJenjangFromKelas(kelasSiswa) || 'VII'}</strong> Sem <strong className="text-amber-300">{semesterSiswa || 'Ganjil'}</strong> diacak otomatis per perangkat ({effectiveDeviceFingerprint}).
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.2 rounded bg-sky-500/20 border border-sky-400/40 text-[7px] sm:text-[8.5px] font-mono font-bold text-sky-200">
                      IP: {effectiveClientIp}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-[7px] sm:text-[8.5px] font-mono font-bold text-emerald-300">
                      {detectedDevice.screenResolution}
                    </span>
                  </div>
                </div>
              </div>

              {isRetakeSession && (
                <div className="p-1.5 sm:p-2 rounded-md border border-amber-400/60 bg-amber-500/15 text-amber-200 text-[8.5px] sm:text-[10px] flex items-start gap-1.5">
                  <RefreshCw className="w-3 h-3 text-amber-300 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <strong className="text-amber-300 block uppercase tracking-wide text-[8px] sm:text-[9.5px]">
                      MODE UJIAN SUSULAN KE-{Math.max(1, retakeAttemptCount)} AKTIF (25 SOAL BARU)
                    </strong>
                    Token (<strong className="text-white font-mono">{sanitizeTokenValue(inputToken || activeSessionToken || onlineToken)}</strong>) menyajikan{' '}
                    <strong className="text-emerald-300">25 Soal Ujian 100% BARU</strong> yang berbeda dari percobaan sebelumnya.
                  </div>
                </div>
              )}

              {/* Selector 6: Informasi Format Soal & Menu Pilihan Dropdown (PG 25 Soal / Esay Test 15 Soal) */}
              <div
                className={`p-2 sm:p-2.5 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm transition-all ${
                  jenisSoalUjian === 'ESAY_TEST'
                    ? 'border-emerald-400/60 bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-sky-950/70 text-emerald-100 ring-1 ring-emerald-400/30'
                    : 'border-sky-400/50 bg-gradient-to-r from-sky-950/70 via-slate-900/90 to-slate-950/80 text-sky-100 ring-1 ring-amber-400/20'
                }`}
              >
                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                      jenisSoalUjian === 'ESAY_TEST'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {jenisSoalUjian === 'ESAY_TEST' ? (
                      <BookOpen className="w-4 h-4" />
                    ) : (
                      <KeyRound className="w-4 h-4" />
                    )}
                  </div>
                  <div className="leading-tight min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="text-[7.5px] sm:text-[8.5px] font-mono font-extrabold uppercase tracking-wider text-amber-300">
                        {jenisSoalUjian === 'ESAY_TEST'
                          ? 'FORMAT SOAL: 2. SOAL ESAY TEST 15 SOAL (LATIHAN DIKELAS / TUGAS DIRUMAH)'
                          : 'FORMAT SOAL: 1. SOAL PILIHAN BERGANDA 25 SOAL (SOAL UJIAN RESMI)'}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full font-mono text-[7px] sm:text-[8px] font-extrabold ${
                          jenisSoalUjian === 'ESAY_TEST'
                            ? 'bg-emerald-400/25 border border-emerald-400/50 text-emerald-300'
                            : 'bg-amber-400/25 border border-amber-400/50 text-amber-300'
                        }`}
                      >
                        {jenisSoalUjian === 'ESAY_TEST' ? 'ONLINE DARING' : 'SISTEM OTOMATIS'}
                      </span>
                    </div>
                    <div className="text-[8.5px] sm:text-[10px] text-white">
                      {jenisSoalUjian === 'ESAY_TEST' ? (
                        <span>
                          <strong className="text-emerald-300">15 Butir Soal Esay Daring:</strong> Disesuaikan untuk <strong className="text-white">Kelas {getJenjangFromKelas(kelasSiswa) || 'VII'}</strong> dan <strong className="text-white">Semester {semesterSiswa || 'Ganjil'}</strong>. Bebas token ujian, auto-save aktif, dan kirim ke WhatsApp Guru ({EXAM_INFO.guruMapelUpper}).
                        </span>
                      ) : (
                        <span>
                          Token Sesi Ujian:{' '}
                          <span className="font-mono text-amber-300 px-1 py-0.2 rounded bg-slate-900 border border-amber-400/40 text-[8.5px] sm:text-[9.5px]">
                            {sanitizeTokenValue(inputToken || activeSessionToken || onlineToken)}
                          </span>{' '}
                          — Berlaku maks. <strong>3x memulai ujian</strong> (25 Soal Pilihan Berganda, KKM 75).
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dropdown Ganti Format Soal Langsung di Menu Ini */}
                <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-white/10 sm:border-l sm:pl-2.5">
                  <label className="text-[7.5px] sm:text-[8.5px] font-bold text-sky-200 whitespace-nowrap">
                    Pilihan Format:
                  </label>
                  <select
                    value={jenisSoalUjian}
                    onChange={(e) =>
                      setJenisSoalUjian(e.target.value as 'PILIHAN_BERGANDA' | 'ESAY_TEST')
                    }
                    className={`h-6 sm:h-6.5 px-2 rounded-md border text-[8.5px] sm:text-[10px] font-extrabold transition-all cursor-pointer ${
                      jenisSoalUjian === 'ESAY_TEST'
                        ? 'border-emerald-400 bg-slate-950 text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400'
                        : 'border-amber-400 bg-slate-950 text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400'
                    }`}
                  >
                    <option value="PILIHAN_BERGANDA" className="bg-slate-900 text-white">
                      1. SOAL PILIHAN BERGANDA 25 SOAL (SOAL UJIAN )
                    </option>
                    <option value="ESAY_TEST" className="bg-slate-900 text-emerald-300">
                      2. SOAL ESAY TEST 15 SOAL ( LATIHAN DIKELAS/ TUGAS DIRUMAH)
                    </option>
                  </select>
                </div>
              </div>

              {loginError && (
                <div className="p-2 rounded-md bg-rose-950/95 border border-rose-500 text-rose-200 text-[9px] sm:text-[10.5px] space-y-1.5 shadow-md">
                  <div className="flex items-start gap-1.5 font-semibold leading-tight">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={handleRequestNewTokenFromTeacher}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[8.5px] sm:text-[9.5px] shadow-2xs cursor-pointer"
                    >
                      <KeyRound className="w-2.5 h-2.5" />
                      Minta Token Baru ke Guru
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInputToken('');
                        setView('HOME');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[8.5px] sm:text-[9.5px] shadow-2xs cursor-pointer"
                    >
                      <KeyRound className="w-2.5 h-2.5" />
                      Ketik Token Baru
                    </button>
                  </div>
                </div>
              )}

              {/* Selector 8: Tombol Warna Hijau "Mulai Ujian" & Kembali */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row items-center justify-between gap-1.5 sm:gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setView('HOME')}
                  className="w-full sm:w-auto h-7 sm:h-8 px-2.5 sm:px-3.5 rounded-md text-[8.5px] sm:text-[10.5px] font-bold border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap"
                >
                  Kembali ke Menu Awal
                </button>

                <button
                  type="button"
                  onClick={() => handleStartFullscreenExam(isRetakeSession)}
                  className="w-full sm:w-auto h-7 sm:h-8 px-2.5 sm:px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[8.5px] sm:text-[10.5px] flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                  <span className="truncate">
                    {jenisSoalUjian === 'ESAY_TEST'
                      ? 'MULAI KERJAKAN 15 SOAL ESAY'
                      : isRetakeSession
                      ? 'MULAI UJIAN ULANGAN (ACAK)'
                      : 'MULAI UJIAN (LAYAR PENUH)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* =================================================================== */}
      {/* VIEW 3A: HALAMAN PENGERJAAN 15 SOAL ESAY (LATIHAN DIKELAS/TUGAS DIRUMAH) */}
      {/* =================================================================== */}
      {view === 'EXAM' && jenisSoalUjian === 'ESAY_TEST' && (
        <EssayExamView
          questions={
            essayQuestions.length >= 15
              ? essayQuestions
              : generateNonRepeatingEssayQuestionsForStudent({
                  kelas: kelasSiswa || 'VIII-1',
                  semester: (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap',
                  namaSiswa,
                  nisNisn,
                  clientIp: effectiveClientIp,
                  deviceFingerprint: effectiveDeviceFingerprint,
                  deviceModel: effectiveDeviceModel,
                  deviceCategory: detectedDevice.deviceCategory,
                }).questions
          }
          namaSiswa={namaSiswa}
          nisNisn={nisNisn}
          kelas={kelasSiswa}
          semester={(semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap'}
          studentPhotoUrl={studentPhotoUrl}
          sourceText={essayQuestionSourceText}
          deviceModel={effectiveDeviceModel}
          deviceCategory={detectedDevice.deviceCategory}
          clientIp={effectiveClientIp}
          deviceFingerprint={effectiveDeviceFingerprint}
          onExitHome={() => {
            setView('HOME');
            setHomeSection('PORTAL_UJIAN');
          }}
          onRetakeEssay={() => {
            const targetJenjang = getJenjangFromKelas(kelasSiswa || 'VIII-1');
            const targetSemester = (semesterSiswa || 'Ganjil') as 'Ganjil' | 'Genap';
            const fresh = generateNonRepeatingEssayQuestionsForStudent({
              kelas: kelasSiswa || 'VIII-1',
              semester: targetSemester,
              namaSiswa,
              nisNisn,
              clientIp: effectiveClientIp,
              deviceFingerprint: effectiveDeviceFingerprint,
              deviceModel: effectiveDeviceModel,
              deviceCategory: detectedDevice.deviceCategory,
            });
            setEssayQuestions(fresh.questions);
            setEssayQuestionSourceText(fresh.sourceLabel);
          }}
          onSubmitEssay={(res) => {
            const isDisq = Boolean(res.isDisqualified || (res.violationCount && res.violationCount >= 3));
            const newEssaySub: StudentSubmission = {
              id: res.submissionId,
              timestamp: res.timestamp,
              namaSiswa: res.namaSiswa,
              nisNisn: res.nisNisn,
              kelas: res.kelas,
              semester: res.semester,
              skorBenar: isDisq ? 0 : res.totalDijawab,
              totalSoal: res.totalSoal,
              nilaiAkhir: isDisq ? 0 : Math.round((res.totalDijawab / res.totalSoal) * 100),
              statusKecurangan:
                res.statusKecurangan ||
                (isDisq
                  ? `Diskualifikasi Otomatis: 3x Pelanggaran (${(res.violationLogs || []).join('; ')})`
                  : res.violationCount && res.violationCount > 0
                  ? `Terdeteksi ${res.violationCount}x Pelanggaran (${(res.violationLogs || []).join('; ')})`
                  : `Tidak Ada Kecurangan (Jujur / Bersih) - Selesai 15 Soal Esay (${res.totalKata} kata)`),
              lulusTidakLulus:
                res.lulusTidakLulus ||
                (isDisq
                  ? 'Tidak Lulus Ujian (Ujian Susulan)'
                  : res.totalDijawab >= 12
                  ? 'LULUS UJIAN'
                  : 'LULUS BERSYARAT'),
              answers: {},
              doubtful: res.raguRagu,
              violationCount: res.violationCount || 0,
              violationLogs: res.violationLogs || [],
              questionOrder: Array.from({ length: 15 }, (_, i) => i + 1),
              isCompleted: true,
              photoUrl: studentPhotoUrl,
              usedToken: activeExamTokenRef.current || 'ESAY',
              deviceModel: effectiveDeviceModel,
              clientIp: effectiveClientIp,
              deviceFingerprint: effectiveDeviceFingerprint,
            };
            setSubmissions((prev) => deduplicateSubmissions([newEssaySub, ...prev]));
            saveAllSubmissionsToServer(deduplicateSubmissions([newEssaySub, ...submissions])).catch(() => {});
            enqueueSubmissionSync(newEssaySub, {
              sheetUrl: cloudConfig.googleSheetUrl,
              appsScriptUrl: cloudConfig.appsScriptWebAppUrl,
              immediate: isDisq,
              source: isDisq ? 'Diskualifikasi 3x Pelanggaran Esay' : 'Selesai 15 Soal Esay',
            });
          }}
        />
      )}

      {/* =================================================================== */}
      {/* VIEW 3B: HALAMAN UJIAN ANBK PILIHAN BERGANDA 25 SOAL */}
      {/* =================================================================== */}
      {view === 'EXAM' && jenisSoalUjian === 'PILIHAN_BERGANDA' && currentQuestion && (
        <div className="min-h-screen flex flex-col exam-main-content exam-lock-select">
          {/* Header Royal Navy Khas Home ANBK (Menampilkan Foto Profil & Nama Siswa dari localStorage) */}
          <header className="bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 text-white px-3 sm:px-5 py-2 sm:py-2.5 border-b border-sky-500/30 flex flex-wrap items-center justify-between gap-2.5 shadow-md">
            <div className="flex items-center gap-2.5">
              <TutWuriLogo size="sm" />

              {/* Bingkai Foto Profil Siswa di Header Dashboard Ruang Ujian (Klik untuk Kamera) */}
              <button
                type="button"
                onClick={() => setShowStudentCameraModal(true)}
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden border border-amber-400 bg-gradient-to-br from-sky-600 to-indigo-800 shrink-0 flex items-center justify-center shadow-sm group cursor-pointer"
              >
                {studentPhotoUrl || getPhotoForStudentIdentity(namaSiswa, nisNisn) ? (
                  <img
                    src={studentPhotoUrl || getPhotoForStudentIdentity(namaSiswa, nisNisn)}
                    alt={`Foto ${namaSiswa}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-[10px] font-extrabold text-white">
                    {getStudentInitials(namaSiswa)}
                  </span>
                )}
                <span className="absolute bottom-0 right-0 p-0.5 rounded-tl bg-amber-400 text-slate-950">
                  <Camera className="w-2 h-2" />
                </span>
              </button>

              <div>
                <div className="text-[11px] font-bold tracking-wider text-sky-300">
                  {EXAM_INFO.namaSekolah} · {activePackageMeta.judul}
                </div>
                <div className="text-xs sm:text-sm font-bold flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-white font-extrabold">
                    {namaSiswa.trim() || loadStoredStudentProfile().namaSiswa || 'Peserta Ujian'}
                  </span>
                  <span className="text-sky-300">·</span>
                  <span className="font-mono text-[11px] bg-amber-400 text-slate-950 font-extrabold px-1.5 py-0.5 rounded">
                    Kelas {kelasSiswa} · Semester {semesterSiswa} ({nisNisn})
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 font-bold px-1.5 py-0.5 rounded">
                    {detectedDevice.isMobileOrTablet ? (
                      <Smartphone className="w-3 h-3 text-emerald-300 shrink-0" />
                    ) : (
                      <Laptop className="w-3 h-3 text-sky-300 shrink-0" />
                    )}
                    <span>
                      {detectedDevice.deviceCategory}: {effectiveDeviceModel} · IP: {effectiveClientIp}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-sky-500/20 border border-sky-400/45 text-sky-200 font-bold px-1.5 py-0.5 rounded">
                    <Globe className="w-2.5 h-2.5 text-sky-300 shrink-0" />
                    <span>
                      Soal Online Acak ({getJenjangFromKelas(kelasSiswa)} {semesterSiswa})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStudentCameraModal(true)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-amber-300 cursor-pointer"
                  >
                    <Camera className="w-2.5 h-2.5" />
                    <span>{studentPhotoUrl ? 'Ubah Foto' : 'Foto Kamera'}</span>
                  </button>
                  {isRemedialSession ? (
                    <span className="font-mono text-[10px] bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 text-slate-950 font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 ring-1 ring-amber-300">
                      <Zap className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                      <span>REMEDIAL TERFOKUS · TARGET KKM 75</span>
                    </span>
                  ) : isRetakeSession ? (
                    <span className="font-mono text-[10px] bg-emerald-500 text-slate-950 font-extrabold px-1.5 py-0.5 rounded">
                      UJIAN SUSULAN KE-{Math.max(1, retakeAttemptCount)} (25 SOAL BARU)
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Area Atas: Indikator Baterai Perangkat, Pelanggaran, Auto-Save & Countdown Timer 30 Menit */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Indikator Antrean Sinkronisasi Real-Time saat Ujian Berlangsung */}
              <button
                type="button"
                onClick={() => setShowQueueModal(true)}
                className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-1 rounded border transition-all cursor-pointer shadow-xs ${
                  syncQueue.stats.pendingCount > 0
                    ? 'bg-amber-500/25 border-amber-300 text-amber-200 animate-pulse'
                    : 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200 hover:bg-emerald-500/30'
                }`}
              >
                {syncQueue.stats.isProcessing ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-300 shrink-0" />
                ) : syncQueue.stats.pendingCount > 0 ? (
                  <Clock className="w-3 h-3 text-amber-300 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
                <span>
                  {syncQueue.stats.pendingCount > 0
                    ? `Antrean: ${syncQueue.stats.pendingCount}`
                    : 'Antrean: 0 (Sheets ✓)'}
                </span>
              </button>

              {lastAutoSaveTime && (
                <span className="hidden lg:inline-block text-[11px] text-emerald-300 font-mono">
                  Auto-Save: {lastAutoSaveTime}
                </span>
              )}

              {/* Indikator Baterai Perangkat Siswa Real-Time (Berdenyut / Pulse Saat Level Kritis < 15%) */}
              {(() => {
                const isLowBattery = !batteryState.charging && batteryState.level <= 20;
                const isCriticalBattery = !batteryState.charging && batteryState.level < 15;

                return (
                  <div
                    role="status"
                    aria-live={isCriticalBattery || isLowBattery ? 'assertive' : 'polite'}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border flex items-center gap-1.5 tabular-nums transition-all ${
                      isCriticalBattery
                        ? 'bg-rose-600 border-rose-200 text-white ring-2 ring-rose-400 animate-pulse animate-battery-indicator-critical-pulse shadow-md shadow-rose-900/60'
                        : isLowBattery
                        ? 'bg-amber-500/25 border-amber-300 text-amber-200 ring-1 ring-amber-400/60 animate-pulse'
                        : batteryState.charging
                        ? 'bg-emerald-950/85 border-emerald-400/50 text-emerald-200'
                        : 'bg-white/10 border-white/20 text-sky-200'
                    }`}
                  >
                    {isCriticalBattery && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-200" />
                      </span>
                    )}
                    {batteryState.charging ? (
                      <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
                    ) : isCriticalBattery ? (
                      <BatteryWarning className="w-3.5 h-3.5 text-white shrink-0 animate-bounce" />
                    ) : isLowBattery ? (
                      <BatteryLow className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    ) : batteryState.level >= 75 ? (
                      <BatteryFull className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : batteryState.level >= 35 ? (
                      <BatteryMedium className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    ) : (
                      <Battery className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    )}
                    <span>Baterai: {batteryState.level}%</span>
                    {batteryState.charging && (
                      <span className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-[9px] font-extrabold text-emerald-300 leading-none">
                        <Zap className="w-2 h-2 fill-current" />
                        Mengisi
                      </span>
                    )}
                    {isLowBattery && (
                      <span
                        className={`px-1 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wider leading-none ${
                          isCriticalBattery
                            ? 'bg-white text-rose-700 animate-pulse'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {isCriticalBattery ? 'KRITIS!' : 'LEMAH!'}
                      </span>
                    )}
                  </div>
                );
              })()}

              <div
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${
                  violationCount > 0
                    ? 'bg-rose-700/90 border-rose-400 text-white'
                    : 'bg-white/10 border-white/20 text-sky-200'
                }`}
              >
                Pelanggaran: {violationCount} / 3
              </div>

              {/* Tombol Kontrol Mute Audio Cue di Sudut Kanan Atas Header Ujian */}
              <button
                type="button"
                onClick={toggleAudioMute}
                aria-label={isAudioMuted ? 'Aktifkan Efek Suara Notifikasi' : 'Bisukan Efek Suara Notifikasi'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isAudioMuted
                    ? 'bg-rose-950/80 border-rose-400/50 text-rose-200 hover:bg-rose-900/80'
                    : 'bg-emerald-950/80 border-emerald-400/50 text-emerald-200 hover:bg-emerald-900/80'
                }`}
              >
                {isAudioMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    <span className="hidden sm:inline">Suara: Mute</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span className="hidden sm:inline">Suara: Aktif</span>
                  </>
                )}
              </button>

              {/* Real-time Countdown Timer 30 Menit dengan Indikator Audio & Visual saat 5 Menit & 1 Menit */}
              <div className="relative inline-flex items-center">
                {examSecondsLeft <= 60 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute -inset-1 rounded-xl bg-rose-500/35 ring-4 ring-rose-500/80 animate-ping pointer-events-none"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute -inset-1 rounded-xl ring-4 ring-rose-500 border-2 border-rose-300 animate-pulse pointer-events-none"
                    />
                  </>
                )}
                {examSecondsLeft > 60 && examSecondsLeft <= 300 && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-1 rounded-xl bg-amber-500/20 ring-2 ring-amber-400/60 animate-pulse pointer-events-none"
                  />
                )}
                <div
                  role="timer"
                  aria-live="assertive"
                  className={`relative z-10 px-4 py-1.5 rounded-lg font-mono text-base font-bold flex items-center gap-2 border tabular-nums transition-all ${
                    examSecondsLeft <= 60
                      ? 'bg-rose-600 border-rose-200 text-white ring-4 ring-rose-500/90 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-rose-600/60 animate-pulse'
                      : examSecondsLeft <= 300
                      ? 'bg-amber-500/25 border-amber-300 text-amber-200 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/25'
                      : 'bg-slate-950/90 border-amber-400/50 text-amber-300'
                  }`}
                >
                  {examSecondsLeft <= 60 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-200 animate-bounce shrink-0" />
                  ) : examSecondsLeft <= 300 ? (
                    <Clock className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 shrink-0" />
                  )}
                  <span>Sisa Waktu: {formatTimer(examSecondsLeft)}</span>
                  {examSecondsLeft <= 60 ? (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-white text-rose-700 font-extrabold text-[10px] uppercase tracking-wider leading-none">
                      &lt; 1 Menit!
                    </span>
                  ) : examSecondsLeft <= 300 ? (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider leading-none">
                      5 Menit!
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          {/* Banner Informasi Sesi Remedial Terfokus */}
          {isRemedialSession && remedialActiveMeta && (
            <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/80 border-b border-amber-400/50 px-3 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black font-mono text-[9.5px] uppercase flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-slate-950" />
                  Paket Remedial Terfokus
                </span>
                <span className="text-[11.5px] font-bold text-white">
                  Materi Fokus:{' '}
                  <strong className="text-amber-300">
                    {remedialActiveMeta.targetElements.slice(0, 3).join(', ')}
                    {remedialActiveMeta.targetElements.length > 3 ? ` (+${remedialActiveMeta.targetElements.length - 3} lainnya)` : ''}
                  </strong>
                </span>
                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[9.5px] font-mono font-bold">
                  {remedialActiveMeta.difficultyMode === 'REGULER'
                    ? 'Fokus Reguler'
                    : remedialActiveMeta.difficultyMode === 'HOTS'
                    ? 'Fokus HOTS'
                    : 'Adaptif Berimbang'}
                </span>
              </div>
              <div className="text-[10.5px] font-mono text-emerald-300 flex items-center gap-1.5">
                <span className="text-slate-300">Skor Awal: <strong className="text-rose-300">{remedialActiveMeta.originalScore}%</strong></span>
                <span>➔</span>
                <span className="font-extrabold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/40">
                  Target Kelulusan: ≥ {EXAM_INFO.kkm}% (KKM)
                </span>
              </div>
            </div>
          )}

          {/* Progress Bar Horizontal Persentase Soal Terjawab di Bagian Atas Halaman Ujian */}
          <div className="bg-slate-950/95 border-b border-sky-500/30 px-4 sm:px-6 py-2.5 shadow-sm">
            <div className="max-w-7xl mx-auto space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-sky-200 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Progres Pengerjaan Soal:{' '}
                    <strong className="text-white font-mono">
                      {Object.keys(answers).length}
                    </strong>{' '}
                    dari{' '}
                    <strong className="text-white font-mono">
                      {shuffledQuestions.length}
                    </strong>{' '}
                    Soal Dijawab
                  </span>
                </span>
                <span className="font-mono font-extrabold text-amber-300 tabular-nums">
                  {shuffledQuestions.length > 0
                    ? Math.round((Object.keys(answers).length / shuffledQuestions.length) * 100)
                    : 0}
                  % Terjawab
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={
                  shuffledQuestions.length > 0
                    ? Math.round((Object.keys(answers).length / shuffledQuestions.length) * 100)
                    : 0
                }
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full h-2.5 rounded-full bg-slate-800/90 border border-white/15 overflow-hidden"
              >
                <svg
                  className="w-full h-full block"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <rect
                    x="0"
                    y="0"
                    width={
                      shuffledQuestions.length > 0
                        ? Math.round(
                            (Object.keys(answers).length / shuffledQuestions.length) * 100
                          )
                        : 0
                    }
                    height="10"
                    className={`transition-all duration-300 ${
                      Object.keys(answers).length === shuffledQuestions.length &&
                      shuffledQuestions.length > 0
                        ? 'fill-emerald-400'
                        : 'fill-sky-400'
                    }`}
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Peringatan Audio & Visual Otomatis saat Sisa Waktu Ujian 5 Menit & 1 Menit */}
          {timerWarningAlert && (
            <div
              role="alert"
              className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-bold shadow-lg animate-rapor-fade-in ${
                timerWarningAlert.type === '1min'
                  ? 'bg-rose-950/95 border-rose-400 text-white ring-2 ring-rose-500/80 animate-pulse'
                  : 'bg-amber-950/95 border-amber-400 text-amber-100 ring-2 ring-amber-500/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    timerWarningAlert.type === '1min'
                      ? 'bg-rose-600 border-rose-300 text-white'
                      : 'bg-amber-500 border-amber-200 text-slate-950'
                  }`}
                >
                  {timerWarningAlert.type === '1min' ? (
                    <AlertTriangle className="w-5 h-5 animate-bounce" />
                  ) : (
                    <Clock className="w-5 h-5 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase tracking-wide border ${
                        timerWarningAlert.type === '1min'
                          ? 'bg-rose-500/40 border-rose-300 text-rose-100'
                          : 'bg-amber-500/30 border-amber-300 text-amber-200'
                      }`}
                    >
                      {timerWarningAlert.type === '1min' ? '⏱️ Sisa 1 Menit' : '⏱️ Sisa 5 Menit'}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5" />
                      Peringatan Suara Diputar
                    </span>
                  </div>
                  <p className="mt-0.5 text-white font-semibold">
                    {timerWarningAlert.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTimerWarningAlert(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 ml-auto"
                aria-label="Tutup Peringatan Waktu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Peringatan Otomatis jika Baterai Perangkat Siswa Lemah (<= 20%) atau Kritis (< 15%) saat Ujian Berlangsung */}
          {!batteryState.charging && batteryState.level <= 20 && !lowBatteryBannerDismissed && (
            <div
              role="alert"
              aria-live="assertive"
              className={`relative overflow-hidden px-4 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs font-bold transition-all animate-pulse ${
                batteryState.level < 15
                  ? 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 border-rose-300 text-white ring-2 ring-rose-400/80 animate-battery-critical-pulse'
                  : 'bg-gradient-to-r from-amber-600/35 via-amber-500/25 to-rose-600/30 border-amber-400 text-amber-100 ring-1 ring-amber-400/70 animate-battery-low-pulse'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-90 ${
                      batteryState.level < 15 ? 'bg-white' : 'bg-amber-300'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      batteryState.level < 15 ? 'bg-rose-200' : 'bg-amber-400'
                    }`}
                  />
                </span>
                <BatteryWarning
                  className={`w-4 h-4 shrink-0 animate-bounce ${
                    batteryState.level < 15 ? 'text-white' : 'text-amber-300'
                  }`}
                />
                <span>
                  <strong className="uppercase tracking-wide">
                    {batteryState.level < 15
                      ? `⚡ BATERAI KRITIS (${batteryState.level}%):`
                      : `⚠️ Peringatan Baterai Lemah (${batteryState.level}%):`}
                  </strong>{' '}
                  Baterai perangkat Anda hampir habis! Segera hubungkan pengisi daya (charger) agar perangkat tidak mati mendadak saat ujian berlangsung.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLowBatteryBannerDismissed(true)}
                className="px-2.5 py-1 rounded bg-black/35 hover:bg-black/55 border border-white/20 text-[11px] font-extrabold text-white cursor-pointer shrink-0"
              >
                Mengerti
              </button>
            </div>
          )}

          {/* Toast Peringatan Blokir Shortcut / Klik Kanan */}
          {securityToast && (
            <div className="bg-rose-600 text-white text-xs font-bold px-4 py-2 text-center">
              {securityToast}
            </div>
          )}

          {/* Main Workspace Ujian: Sidebar di Kiri (Nomor 1-10) & Area Soal di Tengah */}
          <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* SIDEBAR KIRI: Navigasi Nomor Soal & Tab Soal Ragu-Ragu (Flagged) */}
            <aside className="lg:col-span-3 rounded-2xl border border-sky-500/30 p-4 order-2 lg:order-1 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 text-white shadow-xl">
              <div className="border-b pb-3 mb-3 border-white/15 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-sky-200">
                  NAVIGASI SOAL (1–{shuffledQuestions.length})
                </h2>
                <span className="text-xs font-mono font-bold text-amber-300">
                  {Object.keys(answers).length}/{shuffledQuestions.length} Dijawab
                </span>
              </div>

              {/* Indikator Kesiapan Siswa & Peringatan Manajemen Waktu (< 5 Menit / 300 Detik) */}
              {(() => {
                const totalQs = shuffledQuestions.length;
                const answeredCount = Object.keys(answers).length;
                const unansweredCount = Math.max(0, totalQs - answeredCount);
                const doubtfulCount = shuffledQuestions.filter((q) => doubtful[q.id]).length;
                const isUnderFiveMins = examSecondsLeft < 300;
                const isCriticalOneMin = examSecondsLeft < 60;
                const isFullyReady = unansweredCount === 0 && doubtfulCount === 0 && totalQs > 0;
                const firstUnansweredIndex = shuffledQuestions.findIndex((q) => !answers[q.id]);
                const secsPerRemainingQ =
                  unansweredCount > 0
                    ? Math.max(1, Math.floor(examSecondsLeft / unansweredCount))
                    : examSecondsLeft;

                return (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`mb-3.5 p-3 rounded-xl border transition-all space-y-2 ${
                      isCriticalOneMin
                        ? 'bg-rose-950/90 border-rose-400 ring-2 ring-rose-500/70 text-white animate-pulse shadow-lg shadow-rose-950/50'
                        : isUnderFiveMins
                        ? 'bg-amber-500/15 border-amber-400/80 ring-2 ring-amber-400/40 text-amber-100 shadow-md'
                        : isFullyReady
                        ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-100'
                        : 'bg-slate-900/90 border-sky-500/30 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isUnderFiveMins ? (
                          <AlertTriangle
                            className={`w-4 h-4 shrink-0 ${
                              isCriticalOneMin
                                ? 'text-rose-300 animate-bounce'
                                : 'text-amber-300 animate-bounce'
                            }`}
                          />
                        ) : isFullyReady ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                        )}
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white">
                          Kesiapan Siswa
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase tracking-wide ${
                          isCriticalOneMin
                            ? 'bg-rose-500 text-white'
                            : isUnderFiveMins
                            ? 'bg-amber-400 text-slate-950'
                            : isFullyReady
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-sky-500/25 text-sky-200 border border-sky-400/30'
                        }`}
                      >
                        {isCriticalOneMin
                          ? 'KRITIS < 1 MENIT!'
                          : isUnderFiveMins
                          ? 'WAKTU < 5 MENIT!'
                          : isFullyReady
                          ? '100% SIAP KIRIM'
                          : 'TERKENDALI'}
                      </span>
                    </div>

                    {/* Pesan Peringatan Visual & Manajemen Waktu */}
                    <p className="text-[11px] leading-relaxed">
                      {isUnderFiveMins ? (
                        <>
                          <strong className="text-amber-300">Peringatan Manajemen Waktu:</strong>{' '}
                          Sisa waktu tinggal{' '}
                          <strong className="font-mono text-white underline">
                            {formatTimer(examSecondsLeft)}
                          </strong>{' '}
                          (&lt; 5 menit).{' '}
                          {unansweredCount > 0 ? (
                            <>
                              Segera jawab{' '}
                              <strong className="text-amber-300">{unansweredCount} soal kosong</strong>{' '}
                              (±{secsPerRemainingQ} dtk/soal).
                            </>
                          ) : doubtfulCount > 0 ? (
                            <>
                              Tinjau cepat{' '}
                              <strong className="text-amber-300">{doubtfulCount} soal ragu-ragu</strong>{' '}
                              sebelum waktu habis.
                            </>
                          ) : (
                            <>Semua soal telah terjawab. Anda siap mengumpulkan ujian.</>
                          )}
                        </>
                      ) : isFullyReady ? (
                        <>
                          Seluruh <strong className="text-emerald-300">{totalQs} soal</strong> telah
                          dijawab tanpa ragu-ragu. Sisa waktu{' '}
                          <strong className="font-mono text-white">{formatTimer(examSecondsLeft)}</strong>.
                        </>
                      ) : (
                        <>
                          Sisa waktu{' '}
                          <strong className="font-mono text-amber-300">
                            {formatTimer(examSecondsLeft)}
                          </strong>
                          . Tersisa <strong className="text-white">{unansweredCount} soal</strong>{' '}
                          belum dijawab (±{secsPerRemainingQ} dtk/soal).
                        </>
                      )}
                    </p>

                    {/* Bar Indikator Kesiapan & Tombol Lompat ke Soal Kosong */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full h-1.5 rounded-full bg-slate-950/80 overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-300"
                          style={{
                            width: `${
                              totalQs > 0
                                ? Math.round(
                                    (Math.max(0, answeredCount - doubtfulCount) / totalQs) * 100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                        <div
                          className="h-full bg-amber-400 transition-all duration-300"
                          style={{
                            width: `${
                              totalQs > 0 ? Math.round((doubtfulCount / totalQs) * 100) : 0
                            }%`,
                          }}
                        />
                      </div>

                      {firstUnansweredIndex >= 0 && (
                        <button
                          type="button"
                          onClick={() => setCurrentQuestionIndex(firstUnansweredIndex)}
                          className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                            isUnderFiveMins
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs'
                              : 'bg-white/10 hover:bg-white/20 text-sky-200'
                          }`}
                        >
                          <span>
                            Lompat ke Soal Belum Dijawab (No. {firstUnansweredIndex + 1})
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Statistik Real-Time: Soal HOTS Terjawab vs Soal Reguler Terjawab */}
              {(() => {
                const hotsIndexed = shuffledQuestions
                  .map((q, idx) => ({ q, idx }))
                  .filter((item) => item.q.difficulty === 'HOTS');
                const regulerIndexed = shuffledQuestions
                  .map((q, idx) => ({ q, idx }))
                  .filter((item) => item.q.difficulty === 'REGULER');

                const hotsTotal = hotsIndexed.length;
                const hotsAnswered = hotsIndexed.filter((item) => Boolean(answers[item.q.id])).length;
                const hotsDoubtful = hotsIndexed.filter((item) => Boolean(doubtful[item.q.id])).length;
                const hotsPct = hotsTotal > 0 ? Math.round((hotsAnswered / hotsTotal) * 100) : 0;

                const regTotal = regulerIndexed.length;
                const regAnswered = regulerIndexed.filter((item) => Boolean(answers[item.q.id])).length;
                const regDoubtful = regulerIndexed.filter((item) => Boolean(doubtful[item.q.id])).length;
                const regPct = regTotal > 0 ? Math.round((regAnswered / regTotal) * 100) : 0;

                const totalPct =
                  shuffledQuestions.length > 0
                    ? Math.round((Object.keys(answers).length / shuffledQuestions.length) * 100)
                    : 0;

                return (
                  <div className="mb-3.5 rounded-xl border border-sky-500/30 bg-slate-900/90 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white">
                          Statistik Real-Time Soal
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-[10px] font-mono font-bold text-sky-300">
                        Total {totalPct}% Terjawab
                      </span>
                    </div>

                    {/* Kartu Statistik Soal HOTS */}
                    <div className="p-2.5 rounded-lg border border-amber-400/30 bg-amber-950/25 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-amber-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                          Soal HOTS
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          {hotsDoubtful > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 font-bold">
                              {hotsDoubtful} Ragu
                            </span>
                          )}
                          <span className="font-extrabold text-white">
                            {hotsAnswered}/{hotsTotal}
                          </span>
                          <span className="text-[10px] text-amber-300">({hotsPct}%)</span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                          style={{ width: `${hotsPct}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {hotsIndexed.map(({ q, idx }) => {
                          const isAns = Boolean(answers[q.id]);
                          const isDbt = Boolean(doubtful[q.id]);
                          const isCur = currentQuestionIndex === idx;
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => setCurrentQuestionIndex(idx)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                                isDbt
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : isAns
                                  ? 'bg-emerald-600 text-white border-emerald-400'
                                  : 'bg-slate-800 text-slate-300 border-white/15 hover:bg-slate-700'
                              } ${isCur ? 'ring-1 ring-white' : ''}`}
                            >
                              #{idx + 1}
                              {isAns ? `:${answers[q.id]}` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Kartu Statistik Soal REGULER */}
                    <div className="p-2.5 rounded-lg border border-sky-400/30 bg-sky-950/30 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-sky-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                          Soal Reguler
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          {regDoubtful > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 font-bold">
                              {regDoubtful} Ragu
                            </span>
                          )}
                          <span className="font-extrabold text-white">
                            {regAnswered}/{regTotal}
                          </span>
                          <span className="text-[10px] text-sky-300">({regPct}%)</span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                          style={{ width: `${regPct}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {regulerIndexed.map(({ q, idx }) => {
                          const isAns = Boolean(answers[q.id]);
                          const isDbt = Boolean(doubtful[q.id]);
                          const isCur = currentQuestionIndex === idx;
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => setCurrentQuestionIndex(idx)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                                isDbt
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : isAns
                                  ? 'bg-emerald-600 text-white border-emerald-400'
                                  : 'bg-slate-800 text-slate-300 border-white/15 hover:bg-slate-700'
                              } ${isCur ? 'ring-1 ring-white' : ''}`}
                            >
                              #{idx + 1}
                              {isAns ? `:${answers[q.id]}` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tab Switcher Sidebar: Semua Soal vs Soal Ragu-Ragu (Flagged) */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10 mb-3.5">
                <button
                  type="button"
                  onClick={() => setExamSidebarTab('ALL')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    examSidebarTab === 'ALL'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Semua ({shuffledQuestions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExamSidebarTab('DOUBTFUL')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    examSidebarTab === 'DOUBTFUL'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-amber-300 hover:bg-amber-400/15'
                  }`}
                >
                  <Flag className="w-3 h-3" />
                  <span>
                    Ragu ({shuffledQuestions.filter((q) => doubtful[q.id]).length})
                  </span>
                </button>
              </div>

              {examSidebarTab === 'ALL' ? (
                <>
                  <div className="grid grid-cols-5 gap-2.5 mb-4">
                    {shuffledQuestions.map((q, idx) => {
                      const ans = answers[q.id];
                      const isDoubt = doubtful[q.id];
                      const isCurrent = currentQuestionIndex === idx;

                      let btnClass =
                        'bg-slate-800/90 border-white/20 text-slate-200 hover:bg-slate-700';

                      if (isDoubt) {
                        btnClass = 'bg-amber-400 border-amber-500 text-slate-950 font-bold';
                      } else if (ans) {
                        btnClass = 'bg-emerald-600 border-emerald-500 text-white font-bold';
                      }

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleNavigateToQuestion(idx)}
                          className={`relative h-11 rounded-lg border font-mono text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${btnClass} ${
                            isCurrent
                              ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950'
                              : ''
                          }`}
                        >
                          <span>{idx + 1}</span>
                          {ans && (
                            <span className="text-[10px] leading-none opacity-95">{ans}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Keterangan Status Nomor Soal */}
                  <div className="space-y-1.5 pt-3 border-t border-white/15 text-xs text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block" />
                      <span>Sudah Dijawab ({Object.keys(answers).length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block" />
                      <span>
                        Ragu-ragu ({shuffledQuestions.filter((q) => doubtful[q.id]).length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded border border-white/30 bg-slate-800 inline-block" />
                      <span>
                        Belum Dijawab ({shuffledQuestions.length - Object.keys(answers).length})
                      </span>
                    </div>
                  </div>

                  {/* Bagian Khusus Daftar Soal Ragu-Ragu (Scrollable) untuk Tinjauan Cepat */}
                  <div className="mt-4 pt-3 border-t border-white/15">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5" />
                        Daftar Soal Ragu-Ragu ({shuffledQuestions.filter((q) => doubtful[q.id]).length})
                      </span>
                      {shuffledQuestions.some((q) => doubtful[q.id]) && (
                        <button
                          type="button"
                          onClick={() => setExamSidebarTab('DOUBTFUL')}
                          className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline cursor-pointer"
                        >
                          Fokus Tinjau
                        </button>
                      )}
                    </div>

                    {shuffledQuestions.some((q) => doubtful[q.id]) ? (
                      <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                        {shuffledQuestions.map((q, idx) => {
                          if (!doubtful[q.id]) return null;
                          const ans = answers[q.id];
                          const isCurrent = currentQuestionIndex === idx;
                          return (
                            <div
                              key={q.id}
                              className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                                isCurrent
                                  ? 'bg-amber-400/20 border-amber-400 text-white'
                                  : 'bg-slate-900/90 border-amber-500/40 text-slate-200 hover:bg-slate-800/90'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleNavigateToQuestion(idx)}
                                className="text-left flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-extrabold text-[10px]">
                                    No. {idx + 1}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-amber-300">
                                    {ans ? `Jawab: ${ans}` : 'Belum Dijawab'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 truncate mt-1">
                                  {q.content}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleDoubtful(q.id)}
                                className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-amber-200 shrink-0 cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-white/10 bg-slate-900/50 text-[11px] text-slate-400 text-center">
                        Tidak ada soal yang ditandai ragu-ragu.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* TAB KHUSUS SOAL RAGU-RAGU (SCROLLABLE LIST) */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-amber-300" />
                      Soal Ditandai Ragu-Ragu
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {shuffledQuestions.filter((q) => doubtful[q.id]).length} Soal
                    </span>
                  </div>

                  {shuffledQuestions.some((q) => doubtful[q.id]) ? (
                    <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                      {shuffledQuestions.map((q, idx) => {
                        if (!doubtful[q.id]) return null;
                        const ans = answers[q.id];
                        const isCurrent = currentQuestionIndex === idx;
                        return (
                          <div
                            key={q.id}
                            className={`p-3 rounded-xl border transition-all space-y-2 ${
                              isCurrent
                                ? 'bg-amber-400/20 border-amber-400 text-white shadow-sm'
                                : 'bg-slate-900/95 border-amber-500/40 text-slate-100 hover:border-amber-400/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-extrabold text-xs">
                                  Soal No. {idx + 1}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-sky-300">
                                  {q.difficulty}
                                </span>
                              </div>
                              <span
                                className={`text-[11px] font-mono font-bold ${
                                  ans ? 'text-emerald-300' : 'text-rose-300'
                                }`}
                              >
                                {ans ? `Pilihan: ${ans}` : 'Belum Dijawab'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                              {q.content}
                            </p>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleNavigateToQuestion(idx)}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] cursor-pointer text-center"
                              >
                                Buka Soal No. {idx + 1}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleDoubtful(q.id)}
                                className="py-1.5 px-2.5 rounded-lg border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 font-semibold text-[11px] cursor-pointer"
                              >
                                Hapus Ragu
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl border border-white/10 bg-slate-900/60 text-center space-y-2">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-200">
                        Belum Ada Soal Ragu-Ragu
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Tekan tombol <strong className="text-amber-300">Tandai Ragu-Ragu</strong> pada soal jika Anda ingin meninjaunya kembali sebelum mengumpulkan ujian.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tombol Selesai Ujian di Sidebar */}
              <div className="mt-5 pt-4 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    setIsSelfEvalLocked(true);
                    setShowSubmitConfirmModal(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  <CheckCircle className="w-4 h-4" />
                  Selesai & Kirim Ujian
                </button>
              </div>
            </aside>

            {/* AREA TENGAH: Soal, Indikator REGULER/HOTS, Pilihan Jawaban & Navigasi */}
            <section className="lg:col-span-9 rounded-2xl border border-sky-500/30 flex flex-col justify-between order-1 lg:order-2 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 text-white shadow-xl overflow-hidden">
              <div>
              {/* Sub-Header Area Atas Soal: Nomor Soal + Bentuk Soal REGULER / HOTS + Ukuran Font */}
              <div className="px-6 py-4 border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-mono font-extrabold text-sm">
                    SOAL NO. {currentQuestionIndex + 1} / {shuffledQuestions.length}
                  </span>

                  {/* Area Atas Menampilkan Bentuk Soal REGULER atau HOTS */}
                  <span
                    className={`px-3.5 py-1.5 rounded-lg font-bold text-xs tracking-wide border ${
                      currentQuestion.difficulty === 'HOTS'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                        : 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                    }`}
                  >
                    BENTUK SOAL: {currentQuestion.difficulty}
                  </span>

                  {currentQuestion.elemen && (
                    <span className="hidden sm:inline-block px-3 py-1.5 rounded-lg font-semibold text-xs bg-white/10 border border-white/15 text-slate-200">
                      {currentQuestion.elemen}
                    </span>
                  )}

                  {/* Indikator Timer Per-Soal (Per-Question Timer) */}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-xs bg-slate-900/90 border border-cyan-400/50 text-cyan-300 tabular-nums shadow-xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>Waktu Soal: {formatTimer(questionDurations[currentQuestion.id] || 0)}</span>
                  </span>
                </div>

                {/* Ukuran Font khas ANBK */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-300 mr-1">Ukuran Teks:</span>
                  {(['sm', 'md', 'lg'] as const).map((sz, i) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setFontSizeScale(sz)}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        fontSizeScale === sz
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/10 text-slate-200 hover:bg-white/20'
                      }`}
                    >
                      {i === 0 ? 'A-' : i === 1 ? 'A' : 'A+'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Isi Pertanyaan & Pilihan Jawaban */}
              <div className="p-6 sm:p-8 space-y-6">
                <div
                  className={`leading-relaxed whitespace-pre-line font-medium text-white ${
                    fontSizeScale === 'sm'
                      ? 'text-sm'
                      : fontSizeScale === 'lg'
                      ? 'text-lg'
                      : 'text-base'
                  }`}
                >
                  {currentQuestion.content}
                </div>

                {currentQuestion.image && (
                  <div className="my-4">
                    <img
                      src={currentQuestion.image}
                      alt={`Gambar Soal Nomor ${currentQuestionIndex + 1}`}
                      referrerPolicy="no-referrer"
                      className="max-h-72 rounded-xl border border-white/20 object-contain bg-white p-2"
                    />
                  </div>
                )}

                {/* Pilihan Jawaban A, B, C, D (Tanpa Animasi) */}
                <div className="space-y-3 pt-2">
                  {(['A', 'B', 'C', 'D'] as const).map((optionLetter, optIdx) => {
                    const isSelected = answers[currentQuestion.id] === optionLetter;
                    return (
                      <button
                        key={optionLetter}
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion.id, optionLetter)}
                        className={`w-full text-left p-4 rounded-xl border-2 flex items-start gap-3.5 cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-sky-900/60 text-white shadow-md'
                            : 'border-white/15 bg-white/5 hover:border-sky-400/50 hover:bg-white/10 text-slate-100'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg font-mono font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 border border-white/20 text-sky-200'
                          }`}
                        >
                          {optionLetter}
                        </span>
                        <span
                          className={`leading-relaxed flex-1 ${
                            fontSizeScale === 'sm'
                              ? 'text-xs sm:text-sm'
                              : fontSizeScale === 'lg'
                              ? 'text-base sm:text-lg'
                              : 'text-sm sm:text-base'
                          } ${isSelected ? 'font-bold text-amber-200' : 'font-normal'}`}
                        >
                          {currentQuestion.options[optIdx]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              </div>

              {/* Footer Navigasi Bawah: Previous, Tandai Ragu-Ragu, Next / Selesai Ujian */}
              <div className="px-6 py-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 rounded-b-2xl">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => handleNavigateToQuestion(currentQuestionIndex - 1)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    currentQuestionIndex === 0
                      ? 'opacity-40 cursor-not-allowed border-white/10 text-slate-500'
                      : 'border-white/20 bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Soal Sebelumnya
                </button>

                {/* Tombol Tandai Ragu-Ragu */}
                <button
                  type="button"
                  onClick={() => handleToggleDoubtful(currentQuestion.id)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    doubtful[currentQuestion.id]
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-amber-400/85 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  {doubtful[currentQuestion.id] ? 'Hilangkan Ragu-Ragu' : 'Tandai Ragu-Ragu'}
                </button>

                {currentQuestionIndex < shuffledQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => handleNavigateToQuestion(currentQuestionIndex + 1)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                  >
                    Soal Selanjutnya
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSelfEvalLocked(true);
                      setShowSubmitConfirmModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Selesai Ujian
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* =============================================================== */}
          {/* OVERLAY NOTIFIKASI ANTI-CURANG SISTEM (PELANGGARAN 1, 2, & 3) */}
          {/* =============================================================== */}
          {redWarningOverlay && (
            <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-3.5 sm:p-6 text-center select-none overflow-y-auto">
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
                    {detectedDevice.deviceCategory.toLowerCase().includes('laptop') ||
                    detectedDevice.deviceCategory.toLowerCase().includes('pc') ? (
                      <Laptop className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>
                      Perangkat: <strong className="text-white">{detectedDevice.deviceCategory} — {effectiveDeviceModel}</strong>
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px] sm:text-[11px]">
                    OS: {detectedDevice.osNameVersion} · IP: {effectiveClientIp}
                  </div>
                </div>

                {/* 2. Ikon & Judul Peringatan Berdasarkan Level Pelanggaran (1, 2, atau 3) */}
                <div className="space-y-2">
                  {violationCount >= 3 ? (
                    <>
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-600/30 border-2 border-rose-400 flex items-center justify-center mx-auto shadow-lg animate-bounce">
                        <AlertOctagon className="w-10 h-10 sm:w-12 sm:h-12 text-rose-300" />
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-md">
                        <AlertOctagon className="w-3.5 h-3.5" />
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

                {/* 3. Detail Pelanggaran & Riwayat Log */}
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
                          <div
                            key={idx}
                            className="text-[10px] font-mono text-rose-300 truncate"
                          >
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
                    onClick={handleResumeFromRedOverlay}
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

          {/* Modal Ringkasan Jawaban & Evaluasi Mandiri Akhir Ujian Sebelum Mengumpulkan Hasil */}
          {showSubmitConfirmModal && (
            <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="max-w-4xl w-full max-h-[90vh] flex flex-col rounded-2xl border border-sky-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-2xl overflow-hidden">
                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-white/15 flex items-center justify-between bg-slate-950/80">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      EVALUASI MANDIRI HASIL JAWABAN (JAWABAN TERKUNCI / TIDAK DAPAT DIUBAH)
                    </div>
                    <h3 className="text-lg font-extrabold text-white mt-0.5">
                      Ringkasan Jawaban, Soal & Kunci Jawaban (SOAL INFORMATIKA FASE D TINGKAT SMP)
                    </h3>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-extrabold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Jawaban Terkunci
                  </span>
                </div>

                {/* Body Modal (Scrollable) */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  {/* Statistik Ringkas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-white/15 bg-white/5">
                      <span className="text-[11px] text-sky-300 block">Sudah Dijawab</span>
                      <span className="text-base font-mono font-extrabold text-white mt-0.5 block">
                        {Object.keys(answers).length} / {shuffledQuestions.length} Soal
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-white/15 bg-white/5">
                      <span className="text-[11px] text-rose-300 block">Belum Dijawab</span>
                      <span className="text-base font-mono font-extrabold text-rose-300 mt-0.5 block">
                        {shuffledQuestions.length - Object.keys(answers).length} Soal
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-white/15 bg-white/5">
                      <span className="text-[11px] text-amber-300 block">Ditandai Ragu-Ragu</span>
                      <span className="text-base font-mono font-extrabold text-amber-300 mt-0.5 block">
                        {shuffledQuestions.filter((q) => doubtful[q.id]).length} Soal
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40">
                      <span className="text-[11px] text-emerald-300 block">
                        Capaian Evaluasi Mandiri
                      </span>
                      <span className="text-base font-mono font-extrabold text-emerald-300 mt-0.5 block">
                        {shuffledQuestions.filter((q) => answers[q.id] === q.answer).length} Benar (
                        {shuffledQuestions.length > 0
                          ? Math.round(
                              (shuffledQuestions.filter((q) => answers[q.id] === q.answer).length /
                                shuffledQuestions.length) *
                                100
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-amber-400/40 bg-amber-950/30 text-xs text-amber-100 flex items-start gap-2.5 leading-relaxed">
                    <Lock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <span>
                      <strong>Jawaban Telah Dikunci Permanen:</strong> Pada tahap Evaluasi Mandiri ini, soal tidak dapat dibuka kembali untuk mengganti atau mengubah pilihan jawaban Anda. Silakan tinjau hasil evaluasi mandiri di bawah ini lalu klik tombol <strong className="text-emerald-300">Selesai & Kumpulkan Jawaban</strong>.
                    </span>
                  </div>

                  {/* Daftar Semua Soal (1 - N) beserta Jawaban Siswa & Kunci Jawaban */}
                  <div className="space-y-3">
                    {shuffledQuestions.map((q, idx) => {
                      const studentAns = answers[q.id];
                      const isCorrect = studentAns === q.answer;
                      const isDoubt = doubtful[q.id];
                      const letters = ['A', 'B', 'C', 'D'];
                      const studentOptIdx = studentAns ? letters.indexOf(studentAns) : -1;
                      const studentOptText =
                        studentOptIdx >= 0 ? q.options[studentOptIdx] : 'Belum Dijawab';
                      const correctOptIdx = letters.indexOf(q.answer);
                      const correctOptText =
                        correctOptIdx >= 0 ? q.options[correctOptIdx] : '';

                      return (
                        <div
                          key={q.id}
                          className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                            !studentAns
                              ? 'border-amber-400/50 bg-amber-950/25'
                              : isCorrect
                              ? 'border-emerald-500/40 bg-emerald-950/25'
                              : 'border-rose-500/40 bg-rose-950/25'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 font-mono font-extrabold text-xs">
                                Soal No. {idx + 1}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                  q.difficulty === 'HOTS'
                                    ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                                    : 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                                }`}
                              >
                                {q.difficulty}
                              </span>
                              {isDoubt && (
                                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                                  <Flag className="w-3 h-3" />
                                  Ragu-Ragu
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-mono font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimer(questionDurations[q.id] || 0)}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                                  !studentAns
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : isCorrect
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {!studentAns
                                  ? 'BELUM DIJAWAB'
                                  : isCorrect
                                  ? '✓ SESUAI KUNCI (BENAR)'
                                  : '✗ BELUM TEPAT'}
                              </span>
                            </div>

                            <span className="px-3 py-1 rounded-lg bg-slate-800/90 border border-white/15 text-slate-300 text-[11px] font-mono font-bold flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-amber-300" />
                              Jawaban Terkunci (Tidak Dapat Diubah)
                            </span>
                          </div>

                          {/* Teks Pertanyaan */}
                          <p className="text-xs sm:text-sm font-medium text-white leading-relaxed">
                            {q.content}
                          </p>

                          {/* Perbandingan Pilihan Jawaban Siswa vs Kunci Jawaban Benar */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                            <div
                              className={`p-2.5 rounded-lg border ${
                                !studentAns
                                  ? 'border-amber-500/40 bg-slate-900/80 text-amber-200'
                                  : isCorrect
                                  ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
                                  : 'border-rose-500/40 bg-rose-950/60 text-rose-200'
                              }`}
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">
                                Pilihan Jawaban Anda:
                              </div>
                              <div className="font-bold">
                                {studentAns
                                  ? `${studentAns}. ${studentOptText}`
                                  : 'Belum memilih jawaban'}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/50 text-emerald-200">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-0.5">
                                Kunci Jawaban yang Benar:
                              </div>
                              <div className="font-bold text-white">
                                {q.answer}. {correctOptText}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-4 border-t border-white/15 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                    <Lock className="w-3.5 h-3.5 text-amber-300" />
                    Mode Evaluasi Mandiri (Jawaban tidak dapat diubah kembali)
                  </span>
                  <button
                    type="button"
                    onClick={() => finalizeExam(undefined, false)}
                    className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Ya, Selesai & Kumpulkan Jawaban
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 4: HALAMAN HASIL UJIAN */}
      {/* =================================================================== */}
      {view === 'RESULT' && completedSubmission && (
        <ExamResultView
          submission={completedSubmission}
          examQuestions={shuffledQuestions.length > 0 ? shuffledQuestions : questions}
          darkMode={darkMode}
          printDarkMode={printDarkMode}
          onChangePrintDarkMode={setPrintDarkMode}
          isDisqualifiedByCheat={isDisqualifiedResult}
          autoReturnCountdown={autoReturnHomeSeconds}
          onReturnHome={handleReturnToHome}
          onRetakeExam={handleRetakeExam}
          onStartRemedialExam={handleStartRemedialExam}
          onSendWhatsApp={(sub, format, skip) => handleSendWhatsAppToTeacher(sub, false, format, skip)}
          onSendEmail={(sub, mode, format) => handleSendEmailToTeacher(sub, false, mode, format)}
          onOpenRaporSiswa={(sub) => {
            setRaporSelectedSubId(sub.id);
            setView('RAPOR_SISWA');
            window.scrollTo(0, 0);
          }}
          onOpenClassroomDesign={
            !isDisqualifiedResult && completedSubmission.nilaiAkhir >= EXAM_INFO.kkm
              ? () => {
                  setView('DESIGN_CLASSROOM');
                  window.scrollTo(0, 0);
                }
              : undefined
          }
          notificationStatus={notificationStatus}
        />
      )}

      {/* =================================================================== */}
      {/* VIEW 5: HALAMAN MODE GURU (PASSWORD 31051990) */}
      {/* =================================================================== */}
      {view === 'TEACHER' && (
        <TeacherDashboard
          questions={questions}
          onUpdateQuestions={handleUpdateQuestions}
          questionBanks={questionBanks}
          onUpdateAllQuestionBanks={handleUpdateAllQuestionBanks}
          activePackageKey={activePackageKey}
          onSelectPackageKey={handleSelectPackageFromTeacher}
          submissions={filteredSubmissionsByHeader}
          onUpdateSubmissions={handleUpdateFilteredSubmissions}
          onResetAllSubmissions={handleResetAllSubmissions}
          activeExamSession={activeExamSession}
          onCreateNewExamSession={handleCreateNewExamSession}
          cloudConfig={cloudConfig}
          onUpdateCloudConfig={handleUpdateCloudConfig}
          darkMode={darkMode}
          printDarkMode={printDarkMode}
          onChangePrintDarkMode={setPrintDarkMode}
          onExitTeacherMode={() => setView('HOME')}
          onOpenMonitoring={() => {
            setView('HOME');
            setHomeSection('MONITORING_UJIAN');
            window.scrollTo(0, 0);
          }}
          onTriggerWhatsApp={(sub) => handleSendWhatsAppToTeacher(sub, false)}
          onTriggerEmail={handleSendEmailToTeacher}
          onPrintStudentSummary={(sub) => {
            setCompletedSubmission(sub);
            setIsDisqualifiedResult(isDisqualifiedByCheatOrSub(sub));
            setAutoReturnHomeSeconds(null);
            setView('RESULT');
            setTimeout(() => {
              window.print();
            }, 350);
          }}
        />
      )}

      {/* =================================================================== */}
      {/* VIEW 6: HALAMAN SISWA DASHBOARD (RIWAYAT PERCOBAAN, NILAI & TANGGAL) */}
      {/* =================================================================== */}
      {view === 'STUDENT_DASHBOARD' && (
        <StudentDashboard
          submissions={submissions}
          onUpdateSubmissions={handleUpdateSubmissions}
          questionBanks={questionBanks}
          defaultQuestions={questions}
          initialStudentName={namaSiswa}
          initialNisNisn={nisNisn}
          studentPhotoUrl={studentPhotoUrl}
          onUpdateStudentProfile={(updated) => {
            if (updated.namaSiswa) setNamaSiswa(updated.namaSiswa);
            if (updated.nisNisn) setNisNisn(updated.nisNisn);
            setStudentPhotoUrl(updated.photoDataUrl);
          }}
          batteryState={batteryState}
          batteryHistory={batteryHistory}
          onRecordBatterySample={() =>
            appendBatteryHistoryPoint(
              batteryStateRef.current.level,
              batteryStateRef.current.charging,
              'Sampel Live',
              undefined,
              currentQuestionIndex + 1,
              'Sampel Manual Status Daya Perangkat'
            )
          }
          isSynced={isDashboardSynced}
          syncSource={dashboardSyncSource}
          lastSyncTime={lastDashboardSyncTime}
          isSyncing={isSyncingDashboard}
          googleSheetUrl={sanitizeRekapSheetUrl(cloudConfig.googleSheetUrl)}
          cloudConfig={cloudConfig}
          onUpdateCloudConfig={handleUpdateCloudConfig}
          onManualSync={() => handleSyncStudentDashboard(false)}
          onResetAllSubmissions={handleResetAllSubmissions}
          onRestoreDefaultSubmissions={handleRestoreDefaultSubmissions}
          activeExamSession={activeExamSession}
          onCreateNewExamSession={handleCreateNewExamSession}
          onBackToHome={() => {
            setView('HOME');
            setHomeSection('PORTAL_UJIAN');
          }}
          onOpenTeacherLogin={() => {
            setShowTeacherModal(true);
            setTeacherPasswordError(null);
          }}
          onOpenRaporSiswa={(sub) => {
            if (sub) setRaporSelectedSubId(sub.id);
            else setRaporSelectedSubId(undefined);
            setView('RAPOR_SISWA');
            window.scrollTo(0, 0);
          }}
          onViewSubmissionResult={(sub) => {
            setCompletedSubmission(sub);
            setIsDisqualifiedResult(isDisqualifiedByCheatOrSub(sub));
            setAutoReturnHomeSeconds(null);
            setView('RESULT');
            window.scrollTo(0, 0);
          }}
          onStartExamForStudent={(sub) => {
            if (sub) {
              setNamaSiswa(sub.namaSiswa);
              setNisNisn(sub.nisNisn);
              const matchedKelas = [
                'VII-1',
                'VII-2',
                'VII-3',
                'VII-4',
                'VII-5',
                ...EXAM_INFO.kelasList,
              ].find((k) => sub.kelas.includes(k));
              if (matchedKelas) {
                setKelasSiswa(matchedKelas);
              }
              setSemesterSiswa(getSemesterFromSub(sub));
              setInputToken('');
              setRetakeNewTokenInput('');
              setRetakeTokenError('');
              setIsRetakeSession(true);
              setShowRetakeTokenModal(true);
            } else {
              setInputToken('');
              setView('HOME');
              setHomeSection('PORTAL_UJIAN');
            }
          }}
        />
      )}

      {/* =================================================================== */}
      {/* VIEW 7: HALAMAN DESIGN CLASSROOM & INPUT DATA SISWA MANUAL */}
      {/* =================================================================== */}
      {view === 'DESIGN_CLASSROOM' && (
        <ClassroomDesignView
          submissions={submissions}
          onUpdateSubmissions={handleUpdateSubmissions}
          onSelectStudentForExam={(student) => {
            setNamaSiswa(student.namaSiswa);
            setNisNisn(student.nisNisn);
            setKelasSiswa(student.kelas);
            setSemesterSiswa(student.semester);
            setInputToken('');
            try {
              localStorage.setItem('anbk_classroom_has_entered', 'true');
            } catch {}
            setHasEnteredClassroom(true);
            setView('HOME');
            setHomeSection('PORTAL_UJIAN');
            window.scrollTo(0, 0);
          }}
          onBackToHome={() => {
            setView('HOME');
            setHomeSection('PORTAL_UJIAN');
            window.scrollTo(0, 0);
          }}
          onOpenStudentDashboard={() => {
            setHeaderJenjangFilter('ALL');
            setView('STUDENT_DASHBOARD');
            window.scrollTo(0, 0);
          }}
          darkMode={darkMode}
          googleUserEmail={googleUserEmail}
          isSyncingLoginSheet={isSyncingLoginSheet}
          isLoginRekapSyncAnimated={isLoginRekapSyncAnimated}
          loginSheetSyncTime={loginSheetSyncTime}
          loginSheetSyncToast={loginSheetSyncToast}
          onSyncAllToGoogleSheets={() =>
            handleSyncLoginFeaturesToGoogleSheets(true, undefined, 'rekap')
          }
          onSyncDeviceToGoogleSheets={() =>
            handleSyncLoginFeaturesToGoogleSheets(true, undefined, 'device')
          }
          isDetectingDevice={isDetectingDevice}
          isDeviceRedetectAnimated={isDeviceRedetectAnimated}
          deviceRedetectToast={deviceRedetectToast}
          onRefreshDeviceDetection={handleRefreshDeviceDetection}
          isLoginDeviceSyncAnimated={isLoginDeviceSyncAnimated}
          syncTriggerSource={syncTriggerSource}
          effectiveDeviceModel={effectiveDeviceModel}
          customDeviceModelOverride={customDeviceModel}
          onChangeCustomDeviceModelOverride={(val) => {
            setCustomDeviceModel(val);
            try {
              localStorage.setItem('anbk_custom_device_model_v1', val);
            } catch {
              // ignore
            }
          }}
          onOpenQrScanner={() => setShowQrScannerModal(true)}
          isQrCameraActive={isQrCameraActive || showQrScannerModal}
        />
      )}

      {/* =================================================================== */}
      {/* VIEW 8: HALAMAN RAPOR SISWA DENGAN GRAFIK BATANG REKAP HASIL UJIAN */}
      {/* =================================================================== */}
      {view === 'RAPOR_SISWA' && (
        <RaporSiswa
          submissions={submissions}
          questions={questions}
          initialSelectedId={raporSelectedSubId}
          onBack={() => {
            setView('STUDENT_DASHBOARD');
            window.scrollTo(0, 0);
          }}
          onViewDetail={(sub) => {
            setCompletedSubmission(sub);
            setIsDisqualifiedResult(isDisqualifiedByCheatOrSub(sub));
            setAutoReturnHomeSeconds(null);
            setView('RESULT');
            window.scrollTo(0, 0);
          }}
          onStartExamForStudent={(sub) => {
            if (sub) {
              setNamaSiswa(sub.namaSiswa);
              setNisNisn(sub.nisNisn);
              const matchedKelas = [
                'VII-1',
                'VII-2',
                'VII-3',
                'VII-4',
                'VII-5',
                ...EXAM_INFO.kelasList,
              ].find((k) => sub.kelas.includes(k));
              if (matchedKelas) {
                setKelasSiswa(matchedKelas);
              }
              setSemesterSiswa(getSemesterFromSub(sub));
              setInputToken('');
              setRetakeNewTokenInput('');
              setRetakeTokenError('');
              setIsRetakeSession(true);
              setShowRetakeTokenModal(true);
            } else {
              setInputToken('');
              setView('HOME');
              setHomeSection('PORTAL_UJIAN');
            }
          }}
        />
      )}

      {/* =================================================================== */}
      {/* VIEW 9: HALAMAN PENUH LIVE MONITORING UJIAN SISWA OLEH GURU */}
      {/* =================================================================== */}
      {view === 'EXAM_MONITORING' && (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-sky-500/20">
              <button
                type="button"
                onClick={() => {
                  setView('HOME');
                  setHomeSection('PORTAL_UJIAN');
                  window.scrollTo(0, 0);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-400/40 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 font-bold text-xs cursor-pointer transition-colors shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Kembali ke Portal Ujian</span>
              </button>
            </div>
            <ExamMonitoringView
              submissions={submissions}
              classroomStudents={classroomStudents}
              activeExamDraft={activeExamDraft}
              onlineToken={onlineToken}
              headerJenjangFilter={headerJenjangFilter}
              onJenjangFilterChange={(j) => setHeaderJenjangFilter(j)}
              isTeacherAuthenticated={true}
              onUnlockTeacherAuth={() => setIsTeacherTokenUnlocked(true)}
              onClearClassroomStudents={() => {
                setClassroomStudents([]);
                setClassroomSyncStatus(null);
                try {
                  localStorage.removeItem(STORAGE_KEY_STUDENTS);
                  localStorage.removeItem('anbk_classroom_active_student_sync_v1');
                } catch {}
              }}
              onUpdateClassroomStudents={(nextCls) => {
                setClassroomStudents(nextCls);
                try {
                  localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextCls));
                } catch {}
              }}
              onSyncRefresh={() => {
                handleSyncLoginFeaturesToGoogleSheets(false, undefined, 'rekap');
                handleSyncStudentDashboard(false);
              }}
              onOpenClassroomDesign={() => {
                setAutoReturnHomeSeconds(null);
                setRedWarningOverlay(false);
                try {
                  localStorage.setItem('anbk_classroom_has_entered', 'true');
                } catch {}
                setHasEnteredClassroom(true);
                setView('DESIGN_CLASSROOM');
                window.scrollTo(0, 0);
              }}
              onResetAllSubmissions={handleResetAllSubmissions}
              onUpdateSubmissions={handleUpdateSubmissions}
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 10: HALAMAN ABSENSI SISWA & REGISTRASI SIDIK JARI BIOMETRIK   */}
      {/* =================================================================== */}
      {view === 'ABSENSI_SISWA' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 py-3 sm:py-6">
          <StudentBiometricAttendanceView
            onBackToHome={() => {
              setView('HOME');
              setHomeSection('PORTAL_UJIAN');
              window.scrollTo(0, 0);
            }}
            onProceedToExam={(studentInfo) => {
              setNamaSiswa(studentInfo.nama);
              setNisNisn(studentInfo.nisn);
              setKelasSiswa(studentInfo.kelas);
              setView('HOME');
              setHomeSection('PORTAL_UJIAN');
              window.scrollTo({ top: 500, behavior: 'smooth' });
            }}
            detectedDevice={detectedDevice}
            effectiveDeviceModel={effectiveDeviceModel}
            darkMode={darkMode}
          />
        </main>
      )}

      {/* =================================================================== */}
      {/* MODAL PILIHAN DATA SINKRONISASI (TANGGAL, BULAN, TAHUN)             */}
      {/* =================================================================== */}
      <SyncDataDateModal
        isOpen={showSyncDateModal}
        onClose={() => setShowSyncDateModal(false)}
        submissions={submissions}
        title="PILIHAN DATA SINKRONISASI HASIL UJIAN"
        description="Pilih tanggal, bulan, atau tahun hasil ujian siswa yang akan disinkronkan ke Google Sheets (13 Kolom) & Cloud Server."
        isSyncing={isSyncingLoginSheet || isSyncingDashboard}
        onConfirmSync={handleConfirmSyncWithDateChoice}
      />

      {/* =================================================================== */}
      {/* MODAL LOGIN MODE GURU (SUPER CEPAT, RINGAN, RESPONSIVE & ANTI-LAG) */}
      {/* =================================================================== */}
      <TeacherLoginModal
        isOpen={showTeacherModal}
        onClose={() => {
          setShowTeacherModal(false);
          setTeacherPasswordError(null);
        }}
        onSuccess={() => {
          setShowTeacherModal(false);
          setTeacherPasswordError(null);
          setIsTeacherTokenUnlocked(true);
          setView('TEACHER');
        }}
        expectedPassword={EXAM_INFO.teacherPassword}
        guruMapelUpper={EXAM_INFO.guruMapelUpper}
      />

      {/* Modal Informasi Standar KKM & Aturan ANBK */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl border border-sky-500/30 p-6 space-y-4 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
            <div className="flex items-center justify-between border-b pb-3 border-white/15">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold text-white">Informasi Ujian & Standar KKM</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-200">
              <p>
                <strong className="text-sky-300">Satuan Pendidikan:</strong> {EXAM_INFO.namaSekolah}
              </p>
              <p>
                <strong className="text-sky-300">Mata Pelajaran & Materi:</strong> {EXAM_INFO.mataPelajaran} — {EXAM_INFO.topik} ({EXAM_INFO.kurikulum})
              </p>
              <p>
                <strong className="text-sky-300">Guru Mapel / Pembuat Soal:</strong> <span className="text-amber-300 font-bold">{EXAM_INFO.guruMapelUpper}</span>
              </p>
              <p>
                <strong className="text-sky-300">Komposisi Soal:</strong> 25 Soal Pilihan Ganda (12 Soal REGULER & 13 Soal HOTS) yang disajikan secara acak untuk setiap peserta dalam waktu 30 menit.
              </p>
              <p>
                <strong className="text-sky-300">Ketentuan Kelulusan (KKM = 75):</strong>
                <br />• Nilai KKM <strong className="text-emerald-300">75 sampai 100</strong>: Dianggap <strong className="text-emerald-300">Anda Lulus Ujian</strong>.
                <br />• Nilai KKM <strong className="text-rose-300">0 sampai 74</strong> (atau terdeteksi kecurangan 3x / layar terbelah / waktu peringatan habis): Dianggap <strong className="text-rose-300">Anda Tidak Lulus Ujian ("Ujian Susulan")</strong>.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Verifikasi Kode Token Baru untuk Mengulangi Ujian (Wajib Token Baru dari Guru Mapel) */}
      {showRetakeTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-3">
          <div className="max-w-sm w-full rounded-xl border border-amber-400/60 p-3 space-y-2.5 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
            <div className="flex items-center justify-between border-b pb-2 border-white/15">
              <div className="flex items-center gap-2">
                <div className="w-6.5 h-6.5 rounded-lg bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                    Wajib Kode Token Baru — Ulangi Ujian
                  </h3>
                  <span className="text-[9.5px] text-amber-300 font-semibold block leading-tight">
                    Kode Token Berlaku Maksimal 3 Kali Setiap Memulai Ujian
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRetakeTokenModal(false);
                  setRetakeTokenError('');
                }}
                className="p-1 rounded-md hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRetakeWithNewToken} className="space-y-2.5">
              <div className="p-2 rounded-lg bg-rose-950/70 border border-rose-500/50 text-[10px] text-rose-100 space-y-0.5 leading-snug">
                <div className="font-extrabold text-rose-300 uppercase flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                  Aturan Penggunaan Kode Token (Kuota 3x Pakai):
                </div>
                <p>
                  1. Kode token dapat dipakai hingga <strong className="text-white">TIGA KALI (3x)</strong> setiap memulai ujian.
                </p>
                <p>
                  2. Jika kuota 3x telah habis, siswa <strong className="text-amber-300">TIDAK BISA mengulangi ujian</strong> dengan token tersebut.
                </p>
                <p>
                  3. Jika ingin mengulang setelah kuota habis, <strong className="text-emerald-300">minta KODE TOKEN BARU</strong> kepada Guru Mapel (<strong className="text-white">{EXAM_INFO.guruMapel}</strong>).
                </p>
                <p>
                  4. <strong className="text-emerald-300">Jaminan Soal Baru Tanpa Pengulangan:</strong> Setiap kali siswa mengikuti Ujian Susulan berulang kali, sistem otomatis membangkitkan <strong className="text-white">25 soal ujian baru</strong> yang tidak pernah sama dengan soal yang sudah pernah dikerjakan sebelumnya.
                </p>
              </div>

              {/* Daftar Token yang Sudah Pernah Dipakai Siswa */}
              {(() => {
                const studentUsed = usedTokensList.filter((item) => {
                  const cleanNis = (nisNisn || '').trim().toLowerCase();
                  const cleanName = (namaSiswa || '').trim().toLowerCase();
                  if (!cleanNis && !cleanName) return true;
                  return (
                    (cleanNis && item.nisNisn.trim().toLowerCase() === cleanNis) ||
                    (cleanName && item.namaSiswa.trim().toLowerCase() === cleanName)
                  );
                });
                const uniqueUsedTokens = Array.from(
                  new Set([
                    ...studentUsed.map((u) => u.token),
                    ...(completedSubmission?.usedToken ? [completedSubmission.usedToken] : []),
                    ...(activeSessionToken ? [activeSessionToken] : []),
                  ].filter(Boolean))
                );

                return uniqueUsedTokens.length > 0 ? (
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-white/15 text-[10px] space-y-1">
                    <span className="text-[10px] font-bold text-slate-300 block">
                      Kode Token yang Sudah Dipakai (Ditolak Otomatis):
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {uniqueUsedTokens.map((tok) => (
                        <span
                          key={tok}
                          className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 font-mono text-[10px] font-extrabold text-rose-300 line-through"
                        >
                          {tok} (TERPAKAI)
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Tombol Minta Kode Token Baru kepada Guru Mapel */}
              <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-[10.5px] leading-tight">
                  <strong className="text-emerald-300 block">
                    Belum Punya Kode Token Baru?
                  </strong>
                  <span className="text-slate-300 text-[10px]">
                    Hubungi Guru Mapel ({EXAM_INFO.guruMapel}) untuk meminta Token Baru.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRequestNewTokenFromTeacher}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10.5px] shadow-sm shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  Minta Token Baru
                </button>
              </div>

              {/* Input Kode Token Baru */}
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <label className="block text-[10.5px] font-bold text-amber-300">
                    Masukkan Kode Token Baru dari Guru:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQrScannerModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 text-[10px] font-bold cursor-pointer"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>Scan QR</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-amber-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    value={retakeNewTokenInput}
                    onChange={(e) => {
                      setRetakeNewTokenInput(e.target.value.toUpperCase());
                      if (retakeTokenError) setRetakeTokenError('');
                    }}
                    placeholder="Ketik 6 karakter Token Baru..."
                    className="w-full pl-8.5 pr-3 py-1.5 rounded-lg border border-amber-400/60 bg-slate-950 text-amber-300 placeholder:text-slate-500 text-xs sm:text-sm font-mono font-extrabold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                {/* Status Pengenalan Token Baru secara Langsung */}
                {(() => {
                  const candidate = sanitizeTokenValue(retakeNewTokenInput);
                  if (!candidate) return null;
                  const activeClean = sanitizeTokenValue(onlineToken);
                  const check = checkStudentTokenUsage(
                    candidate,
                    namaSiswa,
                    nisNisn,
                    submissions
                  );
                  if (check.isAlreadyUsed) {
                    return (
                      <div className="mt-1.5 p-2 rounded-lg bg-rose-950/90 border border-rose-500/60 text-rose-200 text-[10px] font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                          Token <strong className="font-mono text-white">[{candidate}]</strong> sudah terpakai! Masukkan token baru.
                        </span>
                      </div>
                    );
                  }
                  if (candidate === activeClean || candidate.length >= 4) {
                    return (
                      <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 text-[10px] font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          ✓ Token Baru <strong className="font-mono text-white">[{candidate}]</strong> valid &amp; siap digunakan!
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-1.5 p-2 rounded-lg bg-amber-950/80 border border-amber-400/50 text-amber-200 text-[10px] flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>
                        Lengkapi Kode Token Baru minimal 4-6 karakter.
                      </span>
                    </div>
                  );
                })()}
              </div>

              {retakeTokenError && (
                <div className="p-2 rounded-lg bg-rose-950 border border-rose-500 text-rose-200 text-[10.5px] font-semibold flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{retakeTokenError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowRetakeTokenModal(false);
                    setRetakeTokenError('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Verifikasi &amp; Mulai Ulang Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pengiriman Email Gmail API Resmi (beserta Lampiran .JPG & .PDF) */}
      {gmailConfirmPayload && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-3">
          <div className="max-w-md w-full rounded-xl border border-sky-500/40 p-3.5 sm:p-4 space-y-3 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
            <div className="flex items-center justify-between border-b pb-2 border-white/15">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">
                  Konfirmasi Kirim Email Hasil Ujian (JPG &amp; PDF)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGmailConfirmPayload(null)}
                className="p-1 rounded-md hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-[11px] leading-snug text-slate-200">
              <p>
                Sistem telah membuat berkas Hasil Ujian dalam bentuk{' '}
                <strong className="text-amber-300">Format Gambar (.JPG)</strong> dan{' '}
                <strong className="text-amber-300">Format PDF (.PDF)</strong>. Konfirmasi pengiriman ke:
              </p>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-sky-500/30 space-y-1 font-mono text-[10.5px]">
                <div>
                  • <span className="text-sky-300">Email Tujuan:</span>{' '}
                  <strong className="text-amber-300">{gmailConfirmPayload.to}</strong>
                </div>
                <div>
                  • <span className="text-sky-300">Subjek:</span>{' '}
                  <span className="text-white">{gmailConfirmPayload.subject}</span>
                </div>
                {gmailConfirmPayload.jpgFilename && (
                  <div>
                    • <span className="text-emerald-300">Lampiran 1 (.JPG):</span>{' '}
                    <span className="text-white">{gmailConfirmPayload.jpgFilename}</span>
                  </div>
                )}
                {gmailConfirmPayload.pdfFilename && (
                  <div>
                    • <span className="text-emerald-300">Lampiran 2 (.PDF):</span>{' '}
                    <span className="text-white">{gmailConfirmPayload.pdfFilename}</span>
                  </div>
                )}
              </div>

              {!hasGmailToken && (
                <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10.5px]">
                  Saat menekan <strong>Konfirmasi &amp; Kirim Email</strong>, jendela resmi Google akan terbuka untuk mengizinkan pengiriman.
                </div>
              )}

              {gmailSendError && (
                <div className="p-2 rounded-lg bg-rose-950/90 border border-rose-500/60 text-rose-200 text-[10.5px] font-semibold">
                  {gmailSendError}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                disabled={isSendingGmailApi}
                onClick={() => setGmailConfirmPayload(null)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                Tutup
              </button>
              {completedSubmission && (
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppToTeacher(completedSubmission, false, 'jpg_pdf')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer"
                >
                  Kirim ke WA Guru
                </button>
              )}
              <button
                type="button"
                disabled={isSendingGmailApi}
                onClick={handleConfirmSendGmailApi}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm cursor-pointer"
              >
                {isSendingGmailApi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Mengirim Email...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Konfirmasi &amp; Kirim Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Daftar Nama Siswa yang Sudah Menggunakan Kode Token Ujian 3 Kali (Kuota 3/3x Habis) */}
      {showExhaustedStudentsModal && (() => {
        const allExhaustedStudents = getStudentsWithExhaustedTokenQuota(
          submissions,
          usedTokensList
        );
        const filteredExhausted = allExhaustedStudents.filter((item) => {
          if (
            exhaustedStudentClassFilter !== 'ALL' &&
            getCleanKelas(item.kelas) !== getCleanKelas(exhaustedStudentClassFilter)
          ) {
            return false;
          }
          if (!exhaustedStudentSearchQuery.trim()) return true;
          const q = exhaustedStudentSearchQuery.trim().toLowerCase();
          return (
            item.namaSiswa.toLowerCase().includes(q) ||
            item.nisNisn.toLowerCase().includes(q) ||
            item.kelas.toLowerCase().includes(q) ||
            item.exhaustedToken.toLowerCase().includes(q) ||
            item.allExhaustedTokens.some((t) => t.toLowerCase().includes(q))
          );
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 no-print">
            <div className="max-w-3xl w-full rounded-2xl border border-rose-500/60 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/80 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header Modal */}
              <div className="p-3.5 sm:p-4 border-b border-white/15 flex items-center justify-between gap-2 bg-slate-950/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-mono font-extrabold uppercase tracking-wider">
                        MONITORING GURU · KUOTA TOKEN 3x HABIS
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[9px] font-mono font-extrabold">
                        Total {allExhaustedStudents.length} Murid Habis Kuota (3/3x)
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-base font-extrabold text-white mt-0.5 truncate">
                      Daftar Nama Siswa yang Sudah Menggunakan Kode Token Ujian 3 Kali (3/3x Habis)
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExhaustedStudentsModal(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto flex-1">
                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/90 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Informasi Pantauan Guru Mapel ({EXAM_INFO.guruMapelUpper})</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Daftar di bawah ini menampilkan <strong className="text-white">nama-nama murid yang sudah habis menggunakan kuota kode token ujian sebanyak 3 kali (3/3x)</strong>. Guru dapat langsung menerbitkan <strong className="text-emerald-300">Kode Token Baru</strong> atau mereset kuota token murid.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const freshTok = generateFreshTeacherToken();
                      applyNewTokenFromTeacher(freshTok, false);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] shadow-md shrink-0 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Terbitkan Token Baru Global</span>
                  </button>
                </div>

                {/* Filter & Pencarian Nama Siswa */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <input
                    type="text"
                    value={exhaustedStudentSearchQuery}
                    onChange={(e) => setExhaustedStudentSearchQuery(e.target.value)}
                    placeholder="Cari nama siswa, NIS/NISN, kelas, atau kode token..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-white/20 bg-slate-950 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <div className="flex items-center gap-1.5">
                    <select
                      value={exhaustedStudentClassFilter}
                      onChange={(e) => setExhaustedStudentClassFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-white/20 bg-slate-950 text-amber-300 text-xs font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">Semua Kelas ({allExhaustedStudents.length})</option>
                      {EXAM_INFO.kelasVIIList.map((k) => (
                        <option key={k} value={k}>
                          Kelas {k}
                        </option>
                      ))}
                      {EXAM_INFO.kelasList.map((k) => (
                        <option key={k} value={k}>
                          Kelas {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tabel Daftar Siswa yang Habis Kuota 3x */}
                {filteredExhausted.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/70 border border-white/10 text-center space-y-1.5">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                    <div className="text-xs sm:text-sm font-extrabold text-white">
                      Belum Ada Siswa yang Habis Kuota Kode Token Ujian (3/3x)
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Begitu ada siswa yang telah menggunakan kode token ujian sebanyak 3 kali (3/3x), nama siswa beserta kelas, NIS/NISN, dan kode tokennya akan langsung tampil secara otomatis di daftar ini.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/15 bg-slate-950/90">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-amber-300 font-bold border-b border-white/15 text-[11px]">
                          <th className="py-2.5 px-3 border-r border-white/10 text-center">No</th>
                          <th className="py-2.5 px-3 border-r border-white/10">Nama Lengkap Siswa</th>
                          <th className="py-2.5 px-3 border-r border-white/10">NIS / NISN</th>
                          <th className="py-2.5 px-3 border-r border-white/10">Kelas &amp; Sem</th>
                          <th className="py-2.5 px-3 border-r border-white/10 text-center">Kode Token Habis</th>
                          <th className="py-2.5 px-3 border-r border-white/10 text-center">Status Kuota</th>
                          <th className="py-2.5 px-3 text-center">Aksi Cepat Guru</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredExhausted.map((st, idx) => (
                          <tr key={st.key} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-300">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-extrabold text-white">
                              <div>{st.namaSiswa}</div>
                              <div className="text-[10px] font-normal text-slate-400">
                                Terakhir pakai: {st.lastUsedAt}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-amber-300">
                              {st.nisNisn}
                            </td>
                            <td className="py-2 px-3 font-mono text-sky-200">
                              Kelas {st.kelas} ({st.semester})
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {st.allExhaustedTokens.map((tok) => (
                                  <span
                                    key={tok}
                                    className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 font-mono font-extrabold text-rose-300 text-[11px]"
                                  >
                                    {tok}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-extrabold text-[10px] uppercase">
                                <AlertTriangle className="w-3 h-3 text-amber-300" />
                                HABIS ({st.usageCount}/3x)
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const freshTok = generateFreshTeacherToken();
                                    applyNewTokenFromTeacher(freshTok, false);
                                    setInputToken(freshTok);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10.5px] cursor-pointer shadow-xs"
                                  title={`Beri Kode Token Baru untuk ${st.namaSiswa}`}
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Beri Token Baru</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetStudentTokenQuotaByStudent({
                                      nisNisn: st.nisNisn,
                                      namaSiswa: st.namaSiswa,
                                    });
                                    setUsedTokensList(getUsedExamTokens());
                                    setTokenSyncToast(
                                      `✓ Kuota pemakaian token untuk siswa ${st.namaSiswa} (${st.kelas}) berhasil direset kembali menjadi 0/3x!`
                                    );
                                    setTimeout(() => setTokenSyncToast(null), 4500);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] cursor-pointer"
                                  title={`Reset ulang kuota 3x untuk ${st.namaSiswa}`}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reset Kuota</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="p-3 sm:p-4 border-t border-white/15 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Total Siswa Habis Kuota 3x: <strong className="text-amber-300">{allExhaustedStudents.length} Siswa</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExhaustedStudentsModal(false)}
                    className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer shadow-sm"
                  >
                    Tutup Daftar Siswa
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Meminta & Menerima Kode Token Baru dari Guru Mapel (In-App, Tanpa Kirim WA) */}
      {/* KODE TOKEN BARU HANYA AKAN MUNCUL SETELAH SISWA SUDAH 3 KALI MENGGUNAKAN KODE TOKEN UJIAN */}
      {showRequestNewTokenModal && (() => {
        const currentCheckTok = sanitizeTokenValue(inputToken || onlineToken);
        const currentModalUsage = checkStudentTokenUsage(
          currentCheckTok,
          namaSiswa,
          nisNisn,
          submissions
        );
        const isEligibleForNewToken =
          Boolean(issuedTeacherNewToken) ||
          (currentModalUsage.isAlreadyUsed && currentModalUsage.usageCount >= 3);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-3">
            <div
              className={`max-w-md w-full rounded-xl border p-3 sm:p-3.5 space-y-2.5 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white ${
                isEligibleForNewToken ? 'border-emerald-400/60' : 'border-amber-400/60'
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/15 pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                      isEligibleForNewToken
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                        : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    }`}
                  >
                    {isEligibleForNewToken ? (
                      <KeyRound className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <span
                      className={`text-[8.5px] sm:text-[9px] font-mono font-bold uppercase tracking-widest block leading-tight ${
                        isEligibleForNewToken ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      LAYANAN GURU MAPEL · ATURAN KUOTA 3 KALI PAKAI
                    </span>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                      Fitur Minta Kode Token Baru ke Guru
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestNewTokenModal(false)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Identitas Guru Mapel Pemberi Token Baru */}
              <div className="p-2 rounded-xl bg-slate-900/90 border border-amber-400/40 flex items-center gap-2.5">
                <div className="w-9 h-11 rounded-lg overflow-hidden border border-amber-400 bg-red-600 shrink-0 flex items-center justify-center">
                  {teacherPhotoUrl ? (
                    <img
                      src={teacherPhotoUrl}
                      alt={EXAM_INFO.guruMapel}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <GraduationCap className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[8.5px] sm:text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300 block leading-tight">
                    Pemberi Kode Token Baru (Guru Mapel Informatika)
                  </span>
                  <strong className="text-xs font-extrabold text-white block truncate leading-tight">
                    {EXAM_INFO.guruMapelUpper}
                  </strong>
                  <span
                    className={`text-[9.5px] font-semibold block mt-0.5 leading-tight ${
                      isEligibleForNewToken ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {isEligibleForNewToken
                      ? `✓ Kuota 3x Terpenuhi — Token Baru Tersedia untuk ${namaSiswa.trim() || 'Peserta Ujian'}`
                      : `⏳ Pemakaian Token Saat Ini: ${currentModalUsage.usageCount}/3 Kali (Sisa ${currentModalUsage.remainingUsage}x)`}
                  </span>
                </div>
              </div>

              {isEligibleForNewToken ? (
                <>
                  {/* Kotak Utama Kode Token Baru yang Diberikan Guru (HANYA MUNCUL JIKA SUDAH 3 KALI PAKAI) */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-950/80 via-slate-950 to-sky-950/80 border border-emerald-400/60 text-center space-y-1.5 shadow-inner">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[8.5px] sm:text-[9px] font-mono font-extrabold text-emerald-300 uppercase">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      KODE TOKEN BARU AKTIF · SETELAH 3x PEMAKAIAN
                    </span>

                    <div className="text-2xl sm:text-3xl font-mono font-extrabold tracking-[0.25em] text-amber-300 py-0.5 select-all">
                      {issuedTeacherNewToken}
                    </div>

                    <p className="text-[9.5px] sm:text-[10px] text-slate-300 leading-snug max-w-md mx-auto">
                      Siswa telah menggunakan kode token ujian sebelumnya sebanyak <strong className="text-white">3 kali (3/3x)</strong>. Kode Token Ujian Baru di atas kini telah muncul dan siap digunakan untuk <strong className="text-amber-300">3x memulai ujian berikutnya</strong>.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextTok = generateFreshTeacherToken();
                          applyNewTokenFromTeacher(nextTok, false);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-sky-200 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-300" />
                        Ganti Kode Token Baru Lainnya
                      </button>
                    </div>
                  </div>

                  {/* Opsi Input Kode Token Tertentu jika Guru Mapel Menyebutkan Kode Secara Lisan */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/15 space-y-1.5">
                    <label className="block text-[9.5px] sm:text-[10px] font-bold text-sky-200">
                      Atau ketik Kode Token Baru yang disebutkan langsung oleh Guru Mapel:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        maxLength={6}
                        value={customTeacherIssuedInput}
                        onChange={(e) => setCustomTeacherIssuedInput(e.target.value.toUpperCase())}
                        placeholder="Ketik 6 karakter token..."
                        className="flex-1 px-2.5 py-1 rounded-lg border border-amber-400/50 bg-slate-900 text-amber-300 font-mono text-xs font-extrabold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cleanCustom = sanitizeTokenValue(customTeacherIssuedInput);
                          if (cleanCustom.length >= 3) {
                            applyNewTokenFromTeacher(cleanCustom, true);
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10px] cursor-pointer shrink-0"
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowRequestNewTokenModal(false)}
                      className="px-3 py-1.5 rounded-lg text-[10.5px] font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (issuedTeacherNewToken) {
                          applyNewTokenFromTeacher(issuedTeacherNewToken, true);
                          setInputToken(issuedTeacherNewToken);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10.5px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Gunakan Token Baru ({issuedTeacherNewToken})
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* JIKA KODE TOKEN UJIAN BELUM DIGUNAKAN 3 KALI: KODE TOKEN BARU TIDAK MUNCUL / TIDAK TAMPIL */}
                  <div className="p-3 rounded-xl bg-rose-950/85 border border-rose-500/60 text-center space-y-2 shadow-inner">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-[8.5px] sm:text-[9px] font-mono font-extrabold text-rose-300 uppercase">
                      <Lock className="w-3 h-3 text-rose-400" />
                      KODE TOKEN BARU BELUM MUNCUL ({currentModalUsage.usageCount}/3 KALI PAKAI)
                    </span>

                    <div className="py-1.5 px-3 rounded-lg bg-slate-950/90 border border-rose-500/40 font-mono text-sm sm:text-base font-extrabold tracking-widest text-rose-300">
                      — — — — — — (TERKUNCI)
                    </div>

                    <p className="text-[10px] sm:text-[10.5px] text-rose-100 leading-relaxed text-left">
                      <strong className="text-amber-300 block mb-0.5">
                        Aturan Fitur Minta Token Baru ke Guru:
                      </strong>
                      Kode Token Ujian Baru <strong className="text-white">HANYA akan muncul atau tampil</strong> di fitur ini <strong className="text-emerald-300">setelah siswa sudah 3 kali (3x) menggunakan Kode Token Ujian</strong>.
                    </p>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-amber-400/40 text-left text-[9.5px] sm:text-[10px] text-amber-200 space-y-0.5">
                      <div>
                        • Status Pemakaian Saat Ini:{' '}
                        <strong className="text-white">
                          {currentModalUsage.usageCount} dari 3 kali pakai
                        </strong>{' '}
                        (Masih tersisa <strong className="text-emerald-300">{currentModalUsage.remainingUsage} kali pakai</strong>).
                      </div>
                      <div>
                        • Karena Kode Token Ujian belum digunakan 3 kali, maka Kode Token Ujian Baru <strong className="text-rose-300">tidak dimunculkan</strong>. Silakan gunakan kode token yang sedang aktif terlebih dahulu hingga kuota 3 kali pakai terpenuhi.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowRequestNewTokenModal(false)}
                      className="px-3.5 py-1.5 rounded-lg text-[10.5px] font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer"
                    >
                      Mengerti &amp; Kembali ke Login
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal Pemindai QR Code (ID Ruang Kelas & Kode Token Ujian) */}
      <QrCodeScannerModal
        isOpen={showQrScannerModal}
        onClose={() => {
          setShowQrScannerModal(false);
          setIsQrCameraActive(false);
        }}
        onCameraActiveChange={setIsQrCameraActive}
        activeOnlineToken={onlineToken}
        currentKelas={kelasSiswa}
        currentSemester={semesterSiswa || 'Ganjil'}
        currentNamaSiswa={namaSiswa}
        currentNisNisn={nisNisn}
        availableKelasList={availableKelasOptions}
        submissions={submissions}
        onRequestNewTokenFromTeacher={handleRequestNewTokenFromTeacher}
        onApplyScannedData={(scanned: ScannedExamQrResult, autoProceed?: boolean) => {
          const appliedItems: string[] = [];
          if (scanned.kelas) {
            setKelasSiswa(scanned.kelas);
            if (headerJenjangFilter !== 'ALL') {
              setHeaderJenjangFilter(getJenjangFromKelas(scanned.kelas));
            }
            appliedItems.push(`Kelas ${scanned.kelas}`);
          }
          if (scanned.semester) {
            setSemesterSiswa(scanned.semester);
            appliedItems.push(`Semester ${scanned.semester}`);
          }
          if (scanned.namaSiswa) {
            setHasStudentTypedName(true);
            setNamaSiswa(scanned.namaSiswa);
            appliedItems.push(`Nama: ${scanned.namaSiswa}`);
          }
          if (scanned.nisNisn) {
            setNisNisn(scanned.nisNisn);
            appliedItems.push(`NIS/NISN: ${scanned.nisNisn}`);
          }
          if (scanned.examToken) {
            const cleanTok = sanitizeTokenValue(scanned.examToken);
            if (cleanTok) {
              setIsSheetTokenSynced(true);
              if (!onlineToken) {
                setOnlineToken(cleanTok);
              }
              setInputToken(cleanTok);
              if (showRetakeTokenModal) {
                setRetakeNewTokenInput(cleanTok);
                setRetakeTokenError(null);
              }
              setLoginError(null);
              appliedItems.push(`Kode Token [${cleanTok}]`);
            }
          }

          const summaryMsg =
            appliedItems.length > 0
              ? `✓ QR Code Berhasil Diterapkan: ${appliedItems.join(' · ')}`
              : '✓ QR Code Berhasil Dipindai.';
          setQrScanSuccessBanner(summaryMsg);
          setTimeout(() => setQrScanSuccessBanner(null), 7000);

          if (autoProceed) {
            const targetName = (scanned.namaSiswa || namaSiswa).trim();
            const targetNis = (scanned.nisNisn || nisNisn).trim();
            const targetToken = sanitizeTokenValue(
              scanned.examToken || inputToken || onlineToken
            );
            if (targetName && targetNis && targetToken) {
              const usage = checkStudentTokenUsage(
                targetToken,
                targetName,
                targetNis,
                submissions
              );
              if (!usage.isAlreadyUsed) {
                setActiveExamToken(targetToken);
                activeExamTokenRef.current = targetToken;
                setInputToken(targetToken);
                setShowRetakeTokenModal(false);
                setView('INSTRUCTIONS');
              }
            }
          }
        }}
      />

      {/* Modal Akses Kamera Perangkat & Penyimpanan Foto Profil Siswa di localStorage */}
      <StudentCameraProfileModal
        isOpen={showStudentCameraModal}
        onClose={() => setShowStudentCameraModal(false)}
        namaSiswa={namaSiswa}
        nisNisn={nisNisn}
        kelasSiswa={kelasSiswa}
        semesterSiswa={semesterSiswa || 'Ganjil'}
        currentPhotoUrl={studentPhotoUrl}
        isLocked={isIdentityLocked}
        lockReason={identityLockReason}
        onSaveProfile={(updated) => {
          if (!isIdentityLocked) {
            const incomingCleanName = (updated.namaSiswa || '').trim();
            const isPlaceholderName =
              !incomingCleanName ||
              incomingCleanName.toLowerCase() === 'peserta ujian' ||
              incomingCleanName.toLowerCase() === 'peserta ujian anbk' ||
              incomingCleanName.toLowerCase() === 'belum mengisi nama siswa';
            if (!isPlaceholderName) {
              setHasStudentTypedName(true);
              setNamaSiswa(incomingCleanName);
            } else if (!hasStudentTypedName) {
              setNamaSiswa('');
            }
            if (updated.nisNisn && updated.nisNisn.trim()) {
              setNisNisn(updated.nisNisn.trim());
            }
            if (updated.kelasSiswa && kelasSiswa) {
              setKelasSiswa(updated.kelasSiswa);
            }
            if (updated.semesterSiswa && semesterSiswa) {
              setSemesterSiswa(updated.semesterSiswa);
            }
          }
          if (updated.photoDataUrl !== undefined) {
            setStudentPhotoUrl(updated.photoDataUrl);
          }
          const savedName = (isIdentityLocked ? namaSiswa : updated.namaSiswa || namaSiswa).trim();
          const savedNis = (isIdentityLocked ? nisNisn : updated.nisNisn || nisNisn).trim();
          const savedKelas = isIdentityLocked ? kelasSiswa : (updated.kelasSiswa || kelasSiswa);
          const savedSem = isIdentityLocked ? semesterSiswa : (updated.semesterSiswa || semesterSiswa);
          const savedPhoto =
            updated.photoDataUrl !== undefined ? updated.photoDataUrl : studentPhotoUrl;

          // Hanya sinkronkan ke bangku kelas jika siswa ini sudah menyelesaikan ujian dan LULUS UJIAN (Minimal KKM 75)
          const existingPassedSub = submissions.find(
            (s) =>
              s.isCompleted !== false &&
              ((savedNis && s.nisNisn.trim().toLowerCase() === savedNis.toLowerCase()) ||
                (savedName && s.namaSiswa.trim().toLowerCase() === savedName.toLowerCase())) &&
              s.nilaiAkhir >= EXAM_INFO.kkm &&
              !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak')
          );
          if (existingPassedSub) {
            syncStudentToClassroomSeat({
              namaSiswa: savedName || 'Peserta Ujian',
              nisNisn: savedNis,
              kelas: savedKelas,
              semester: savedSem || 'Ganjil',
              deviceCategory: detectedDevice.deviceCategory,
              deviceBrand: detectedDevice.brand,
              deviceModel: effectiveDeviceModel,
              deviceInfo: effectiveDeviceSummary || detectedDevice.fullSummaryLabel || 'HP Android Siswa',
              photoUrl: savedPhoto || undefined,
              attendanceStatus: 'Selesai Ujian',
              skorBenar: existingPassedSub.skorBenar,
              totalSoal: existingPassedSub.totalSoal,
              nilaiAkhir: existingPassedSub.nilaiAkhir,
              statusKecurangan: existingPassedSub.statusKecurangan,
              lulusTidakLulus: 'Lulus Ujian',
              isExamCompletedAndPassed: true,
              submissionsFallback: submissions,
            });
          }

          handleSyncLoginFeaturesToGoogleSheets(
            true,
            {
              namaSiswa: savedName,
              nisNisn: savedNis,
              kelasSiswa: savedKelas,
              semesterSiswa: savedSem || undefined,
              photoUrl: savedPhoto,
            },
            'photo'
          );
          setTokenSyncToast(
            `✓ Foto Siswa (${savedName || 'Peserta Ujian'}) berhasil diperbarui & otomatis tersinkron ke bangku kelas!`
          );
          setTimeout(() => setTokenSyncToast(null), 4000);
        }}
      />

      {/* Modal Pengaturan & Penggantian Gambar Latar Laboratorium Komputer */}
      <HeroBannerModal
        isOpen={showHeroBannerModal}
        onClose={() => setShowHeroBannerModal(false)}
        currentBannerUrl={heroBannerUrl}
        onSelectBanner={(url) => {
          setHeroBannerUrl(url);
          setHeroImgError(false);
        }}
        currentOpacity={heroBannerOpacity}
        onChangeOpacity={(op) => setHeroBannerOpacity(op)}
      />

      {/* Modal Detail Antrean Sinkronisasi Google Sheets (Anti-Gagal Jaringan) */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in no-print">
          <div className="w-full max-w-xl rounded-2xl border border-sky-500/40 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-sky-500/30 flex items-center justify-between bg-sky-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300">
                  <Layers className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Antrean Sinkronisasi Google Sheets
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-sky-300 font-mono">
                      Mekanisme Redundan Anti-Gagal Jaringan
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${
                        syncQueue.stats.isOnline
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                      }`}
                    >
                      {syncQueue.stats.isOnline ? (
                        <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-2.5 h-2.5 text-rose-400" />
                      )}
                      <span>{syncQueue.stats.isOnline ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQueueModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                Fitur ini memastikan <strong>seluruh data hasil ujian siswa tetap aman</strong> dan
                tidak pernah hilang meskipun jaringan internet sekolah lambat, terputus, atau mengalami
                timeout saat ujian berlangsung. Data otomatis disimpan di memori perangkat dan dikirim
                ulang bertahap hingga sukses diterima oleh Google Sheets.
              </div>

              {/* Status Ringkas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Tertunda</span>
                  <span
                    className={`text-lg font-mono font-extrabold ${
                      syncQueue.stats.pendingCount > 0 ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {syncQueue.stats.pendingCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Diproses</span>
                  <span className="text-lg font-mono font-extrabold text-sky-300">
                    {syncQueue.stats.processingCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Gagal (Retry)</span>
                  <span
                    className={`text-lg font-mono font-extrabold ${
                      syncQueue.stats.failedCount > 0 ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {syncQueue.stats.failedCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Terkirim</span>
                  <span className="text-lg font-mono font-extrabold text-emerald-400">
                    {syncQueue.stats.completedCount}
                  </span>
                </div>
              </div>

              {/* Daftar Item Antrean */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-sky-300 mb-2">
                  <span>Item Antrean Aktif ({syncQueue.items.length}):</span>
                  {syncQueue.stats.lastSyncSuccessTime && (
                    <span className="text-slate-400 font-mono text-[10px]">
                      Terkirim: {syncQueue.stats.lastSyncSuccessTime}
                    </span>
                  )}
                </div>

                {syncQueue.items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800/80">
                    ✓ Tidak ada antrean tertunda. Seluruh data ujian siswa telah tersinkronisasi rapi ke Google Sheets.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {syncQueue.items.map((item, idx) => (
                      <div
                        key={`sync-item-${item.id || 'item'}-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">
                            #{idx + 1} {item.studentName || (item.type === 'batch_submissions' ? 'Batch Seluruh Rekapitulasi' : 'Data Siswa')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                            Sumber: {item.source || 'Ujian Siswa'} · {item.studentNis ? `NISN: ${item.studentNis}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              item.status === 'processing'
                                ? 'bg-amber-400/20 text-amber-300 animate-pulse'
                                : item.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {item.status.toUpperCase()} ({item.attempts}x)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Riwayat Pengiriman Terakhir */}
              {syncQueue.history.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-emerald-300 mb-2">
                    Riwayat Pengiriman Sukses Terakhir ({syncQueue.history.length}):
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {syncQueue.history.slice(0, 5).map((h, i) => (
                      <div
                        key={`sync-hist-${h.id || 'hist'}-${i}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-200 truncate">
                            {h.studentName || 'Batch Rekap Siswa'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                          Terkonfirmasi ✓
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-sky-500/30 flex flex-wrap items-center justify-between gap-2 bg-slate-950">
              <div className="flex items-center gap-2">
                {syncQueue.stats.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => syncQueue.retryFailed()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Ulang Gagal</span>
                  </button>
                )}
                {syncQueue.history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => syncQueue.clearHistory()}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Bersihkan Riwayat
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncQueue.forceProcessNow()}
                  disabled={syncQueue.stats.isProcessing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-md disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncQueue.stats.isProcessing ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {syncQueue.stats.isProcessing
                      ? 'Sedang Memproses...'
                      : 'Kirim Semua Antrean Sekarang'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowQueueModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Resmi (Tampil di luar layar ujian) */}
      {view !== 'EXAM' && (
        <footer className="border-t border-sky-500/25 py-0.5 sm:py-1 px-1.5 sm:px-4 text-center text-[6.5px] sm:text-[8px] no-print bg-slate-950/90 text-slate-300">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-0.5 sm:gap-1.5">
            <span className="text-amber-400 font-semibold leading-tight text-[6.5px] sm:text-[8px]">
              © {EXAM_INFO.tahunAjaran} <strong className="text-amber-300 font-extrabold">{EXAM_INFO.namaSekolah}</strong> · Aplikasi Ujian ANBK Informatika
            </span>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 leading-tight text-[6.5px] sm:text-[8px]">
              {teacherPhotoUrl && (
                <img
                  src={teacherPhotoUrl}
                  alt={`Pembuat Soal ${EXAM_INFO.guruMapel}`}
                  referrerPolicy="no-referrer"
                  className="w-3 h-4 sm:w-4 sm:h-5.5 rounded-xs object-cover object-top border border-amber-400 bg-red-600 shrink-0"
                />
              )}
              <span>
                Pembuat Soal Ujian: <strong className="text-amber-300">{EXAM_INFO.guruMapelUpper}</strong> · Kurikulum Merdeka (Deep Learning)
              </span>
            </span>
          </div>
        </footer>
      )}

      {/* TANDA AIR FORENSIK DIGITAL DINAMIS (BERGERAK LINTAS LAYAR SELAMA UJIAN) */}
      {view === 'EXAM' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none select-none overflow-hidden z-25 flex flex-col justify-around opacity-15 rotate-[-12deg] scale-125"
        >
          {Array.from({ length: 14 }).map((_, rIdx) => (
            <div
              key={rIdx}
              className="flex justify-around gap-6 text-[10.5px] font-mono font-extrabold uppercase text-slate-400 whitespace-nowrap tracking-wider"
            >
              {Array.from({ length: 6 }).map((_, cIdx) => (
                <span key={cIdx} className="drop-shadow-xs">
                  {EXAM_INFO.namaSekolah} • {namaSiswa || 'PESERTA ANBK'} • {nisNisn || 'NISN'} • {effectiveDeviceModel} • {liveForensicClock}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* SHIELD HITAM FLASH SENSOR ANTI-SCREENSHOT LINTAS PERANGKAT (ROOT LEVEL) */}
      {showScreenshotShield && (
        <div className="exam-anti-screenshot-shield select-none">
          <div className="p-6 rounded-2xl bg-black/98 border-2 border-rose-500 text-rose-300 max-w-md space-y-3 shadow-2xl mx-4 text-center ring-4 ring-rose-950/80">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center mx-auto text-rose-400 animate-pulse">
              <CameraOff className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold uppercase text-white tracking-wide">
              DILARANG SCREENSHOT!
            </h3>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-900/60 border border-rose-500/50 text-rose-200 text-xs font-mono font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>{screenshotShieldReason || 'Sensor Anti-Tangkapan Layar Aktif'}</span>
            </div>
            <p className="text-xs font-semibold text-rose-200 leading-relaxed">
              Layar ujian dilindungi sistem sensor anti-screenshot lintas perangkat. Tangkapan layar otomatis diblokir, disensor hitam (Blackout Buffer 100%), papan klip dibersihkan, dan dicatat sebagai pelanggaran integritas ujian.
            </p>
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-white/10 text-[10.5px] text-slate-300 font-mono space-y-0.5 text-left">
              <div>Perangkat: <span className="text-white font-bold">{detectedDevice.deviceCategory} ({effectiveDeviceModel})</span></div>
              <div>Peserta: <span className="text-amber-300 font-bold">{namaSiswa || 'Siswa'} ({nisNisn || '-'})</span></div>
              <div>Waktu: <span className="text-emerald-300">{new Date().toLocaleTimeString('id-ID')} WIB</span></div>
            </div>
            <div className="px-3 py-1 rounded bg-rose-500/20 text-rose-300 font-mono text-[9.5px] font-bold">
              SISTEM ANTI-SCREENSHOT UPTD SMPN 7 KISARAN
            </div>
          </div>
        </div>
      )}

      {/* INDIKATOR STATUS KONEKSI OFFLINE PWA */}
      <OfflineIndicator />
    </div>
  );
}
