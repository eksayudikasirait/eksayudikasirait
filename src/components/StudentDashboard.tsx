import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  LineChart,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Question,
  StudentSubmission,
  BatteryHistoryPoint,
  CloudIntegrationConfig,
  EXAM_INFO,
  REKAP_SHEET_HEADERS,
  ExamPackageKey,
  getPackageKey,
  getJenjangFromKelas,
  getCleanKelas,
  getSemesterFromSub,
  formatSubmissionToRekap10Columns,
  computeSubmissionRankingMap,
  formatSubmissionToRekap13ColumnsWithRank,
  getSubmissionUniqueKey,
  deduplicateSubmissions,
  syncSubmissionsToGoogleSheetsAuto,
  fetchSubmissionsFromGoogleSheetDirect,
  saveAllSubmissionsToServer,
  writeFirestoreCloudConfig,
  DEFAULT_REKAP_SHEET_URL,
  sanitizeRekapSheetUrl,
  autoRecoverAndSyncAllUnsavedSubmissions,
  UNSAVED_SUBMISSIONS_SYNC_EVENT,
  ExamSessionInfo,
  getCurrentExamSession,
  createNewExamSession,
  generateRandomExamToken,
  ResetSubmissionsFilter,
  isSubmissionMatchingResetFilter,
  parseSubmissionDate,
  RestoreSubmissionsFilter,
  getHistoricalSubmissionsPool,
} from '../data/examData';
import { ResetSubmissionsModal } from './ResetSubmissionsModal';
import { RestoreSubmissionsModal } from './RestoreSubmissionsModal';
import {
  SyncDataDateModal,
  SyncDateFilter,
  isSubmissionMatchingSyncFilter,
} from './SyncDataDateModal';
import { useSubmissionSyncQueue } from '../utils/submissionSyncQueue';
import {
  googleSignIn,
  getAccessTokenSync,
  invalidateAccessToken,
  getDiscoveredRekapSheetUrl,
} from '../services/gmailAuthService';
import { TutWuriLogo } from './TutWuriLogo';
import { RankingSiswa } from './RankingSiswa';
import {
  StudentCameraProfileModal,
  loadStoredStudentProfile,
  saveStoredStudentProfile,
  getPhotoForStudentIdentity,
  getStudentInitials,
  compressImageToDataUrl,
} from './StudentCameraProfileModal';
import {
  generateCertificatePdfBlob,
  generateStudentHistoryPortfolioPdfBlob,
  triggerFileDownload,
} from '../utils/resultMediaGenerator';
import {
  History,
  Award,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  CalendarRange,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Eye,
  RotateCcw,
  ArrowLeft,
  TrendingUp,
  Filter,
  Play,
  Download,
  Trophy,
  EyeOff,
  Users,
  Medal,
  Sparkles,
  Trash2,
  AlertTriangle,
  Lock,
  Unlock,
  X,
  RefreshCw,
  Globe,
  FileSpreadsheet,
  ChevronRight,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  Camera,
  Upload,
  ExternalLink,
  Smartphone,
  Laptop,
  BarChart3,
  Crown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileJson,
  Database,
  Braces,
  FileCode,
  Wifi,
  WifiOff,
  Check,
  Copy,
  Layers,
} from 'lucide-react';
import {
  detectStudentDeviceSync,
  detectStudentDeviceAsync,
  StudentDeviceInfo,
} from '../utils/deviceDetector';

interface StudentDashboardProps {
  submissions: StudentSubmission[];
  onUpdateSubmissions?: (submissions: StudentSubmission[]) => void;
  questionBanks: Record<ExamPackageKey, Question[]>;
  defaultQuestions: Question[];
  initialStudentName?: string;
  initialNisNisn?: string;
  studentPhotoUrl?: string;
  onUpdateStudentProfile?: (profile: {
    namaSiswa: string;
    nisNisn: string;
    photoDataUrl: string;
  }) => void;
  batteryState?: {
    level: number;
    charging: boolean;
    supported: boolean;
  };
  batteryHistory?: BatteryHistoryPoint[];
  onRecordBatterySample?: () => void;
  isSynced?: boolean;
  syncSource?: string;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
  googleSheetUrl?: string;
  cloudConfig?: CloudIntegrationConfig;
  onUpdateCloudConfig?: (cfg: CloudIntegrationConfig) => void;
  onManualSync?: () => void;
  onResetAllSubmissions?: (
    filter?: ResetSubmissionsFilter,
    explicitToken?: string
  ) => Promise<any> | void;
  onRestoreDefaultSubmissions?: (
    filter?: RestoreSubmissionsFilter,
    explicitToken?: string
  ) => Promise<any> | void;
  onBackToHome: () => void;
  onOpenTeacherLogin?: () => void;
  onViewSubmissionResult: (submission: StudentSubmission) => void;
  onStartExamForStudent: (submission?: StudentSubmission) => void;
  onOpenRaporSiswa?: (submission?: StudentSubmission) => void;
  activeExamSession?: ExamSessionInfo;
  onCreateNewExamSession?: (params: {
    sessionName: string;
    newToken?: string;
    targetKelas?: string;
    notes?: string;
  }) => Promise<{ session: ExamSessionInfo; newToken?: string }>;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  submissions,
  onUpdateSubmissions,
  questionBanks,
  defaultQuestions,
  initialStudentName = '',
  initialNisNisn = '',
  studentPhotoUrl = '',
  onUpdateStudentProfile,
  batteryState = { level: 100, charging: false, supported: false },
  batteryHistory = [],
  onRecordBatterySample,
  isSynced = true,
  syncSource = 'Tersinkron Otomatis Lintas Perangkat (Cloud & Google Sheets)',
  lastSyncTime = null,
  isSyncing = false,
  googleSheetUrl = '',
  cloudConfig,
  onUpdateCloudConfig,
  onManualSync,
  onResetAllSubmissions,
  onRestoreDefaultSubmissions,
  onBackToHome,
  onOpenTeacherLogin,
  onViewSubmissionResult,
  onStartExamForStudent,
  onOpenRaporSiswa,
  activeExamSession: propsActiveExamSession,
  onCreateNewExamSession,
}) => {
  const [storedProfile, setStoredProfile] = useState(() => loadStoredStudentProfile());
  const [showStudentCameraModal, setShowStudentCameraModal] = useState<boolean>(false);
  const quickHeaderFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [activeDeviceInfo, setActiveDeviceInfo] = useState<StudentDeviceInfo>(() =>
    detectStudentDeviceSync()
  );
  const [isRedetectingDevice, setIsRedetectingDevice] = useState<boolean>(false);
  const [isDeviceRedetectAnimated, setIsDeviceRedetectAnimated] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    detectStudentDeviceAsync(false)
      .then((info) => {
        if (mounted) setActiveDeviceInfo(info);
      })
      .catch(() => {});

    const handleDeviceUpdated = (e: Event) => {
      const customEv = e as CustomEvent<StudentDeviceInfo>;
      if (mounted && customEv.detail) {
        setActiveDeviceInfo(customEv.detail);
      }
    };
    window.addEventListener('anbk-device-updated', handleDeviceUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('anbk-device-updated', handleDeviceUpdated);
    };
  }, []);

  const handleRedetectDeviceDashboard = async () => {
    if (isRedetectingDevice) return;
    setIsRedetectingDevice(true);
    try {
      const [info] = await Promise.all([
        detectStudentDeviceAsync(true),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
      setActiveDeviceInfo(info);
      setIsDeviceRedetectAnimated(true);
      setTimeout(() => setIsDeviceRedetectAnimated(false), 6500);
      setPortfolioToast(
        `✓ Deteksi Ulang Akurat (${info.detectedAt}): ${info.deviceCategory} — ${info.modelType} · ${info.osNameVersion} · ${info.gpuRenderer}`
      );
      setTimeout(() => setPortfolioToast(null), 5000);
    } catch {
      setActiveDeviceInfo(detectStudentDeviceSync(true));
    } finally {
      setIsRedetectingDevice(false);
    }
  };

  useEffect(() => {
    let unmounted = false;
    const runAutoRecovery = async () => {
      const isCleared = typeof window !== 'undefined' && localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
      if (isCleared) return;
      const activeSheet = sanitizeRekapSheetUrl(
        cloudConfig?.googleSheetUrl || googleSheetUrl || DEFAULT_REKAP_SHEET_URL
      );
      const activeScript = cloudConfig?.appsScriptWebAppUrl || '';
      try {
        const recovered = await autoRecoverAndSyncAllUnsavedSubmissions({
          sheetUrl: activeSheet,
          appsScriptUrl: activeScript,
        });
        if (!unmounted && recovered && recovered.length > 0 && onUpdateSubmissions) {
          onUpdateSubmissions(recovered);
        }
      } catch {
        // ignore
      }
    };
    runAutoRecovery();
    const handleUnsavedEvent = (e: Event) => {
      const customEv = e as CustomEvent<{ submissions: StudentSubmission[] }>;
      if (!unmounted && customEv?.detail?.submissions && onUpdateSubmissions) {
        onUpdateSubmissions(customEv.detail.submissions);
      }
    };
    window.addEventListener(UNSAVED_SUBMISSIONS_SYNC_EVENT, handleUnsavedEvent);
    return () => {
      unmounted = true;
      window.removeEventListener(UNSAVED_SUBMISSIONS_SYNC_EVENT, handleUnsavedEvent);
    };
  }, [cloudConfig?.googleSheetUrl, cloudConfig?.appsScriptWebAppUrl, googleSheetUrl, onUpdateSubmissions]);

  useEffect(() => {
    const syncLocalProfile = () => {
      setStoredProfile(loadStoredStudentProfile());
    };
    window.addEventListener('anbk-student-profile-updated', syncLocalProfile);
    window.addEventListener('storage', syncLocalProfile);
    return () => {
      window.removeEventListener('anbk-student-profile-updated', syncLocalProfile);
      window.removeEventListener('storage', syncLocalProfile);
    };
  }, []);

  const activeHeaderStudentName =
    initialStudentName.trim() ||
    storedProfile.namaSiswa.trim() ||
    submissions[0]?.namaSiswa ||
    'Peserta Ujian ANBK';
  const activeHeaderNisNisn =
    initialNisNisn.trim() ||
    storedProfile.nisNisn.trim() ||
    submissions[0]?.nisNisn ||
    '';
  const activeHeaderKelas =
    (submissions[0]?.kelas ? getCleanKelas(submissions[0].kelas) : '') ||
    storedProfile.kelasSiswa ||
    'VIII-1';
  const activeHeaderPhotoUrl =
    studentPhotoUrl ||
    storedProfile.photoDataUrl ||
    getPhotoForStudentIdentity(activeHeaderStudentName, activeHeaderNisNisn);

  const activeHeaderSemester =
    submissions[0]?.semester ||
    storedProfile.semesterSiswa ||
    'Ganjil';

  // Status penguncian identitas siswa (Nama Lengkap, NIS/NISN, Kelas, Semester): TIDAK BISA DI EDIT setelah memulai ujian, selesai ujian, maupun masuk Classroom
  const isStudentIdentityLocked = Boolean(
    submissions.length > 0 ||
      (typeof window !== 'undefined' &&
        (localStorage.getItem('anbk_exam_has_started') === 'true' ||
          localStorage.getItem('anbk_exam_has_completed') === 'true' ||
          localStorage.getItem('anbk_classroom_has_entered') === 'true'))
  );

  const studentIdentityLockReason =
    typeof window !== 'undefined' && localStorage.getItem('anbk_exam_has_completed') === 'true'
      ? 'Ujian Telah Selesai Dikerjakan'
      : typeof window !== 'undefined' && localStorage.getItem('anbk_classroom_has_entered') === 'true'
      ? 'Telah Masuk ke Menu Classroom'
      : typeof window !== 'undefined' && localStorage.getItem('anbk_exam_has_started') === 'true'
      ? 'Sesi Ujian Telah Dimulai'
      : submissions.length > 0
      ? 'Telah Mengikuti / Selesai Ujian'
      : 'Ujian Telah Dimulai / Selesai / Masuk Classroom';

  // Fitur foto & kamera tetap bebas digunakan kapan saja
  const isStudentProfileLocked = false;

  const handleQuickHeaderPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isStudentProfileLocked) return;
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
          const next = saveStoredStudentProfile({
            namaSiswa: activeHeaderStudentName,
            nisNisn: activeHeaderNisNisn,
            kelasSiswa: activeHeaderKelas,
            semesterSiswa: activeHeaderSemester,
            photoDataUrl: compressed,
          });
          setStoredProfile(next);
          if (onUpdateStudentProfile) {
            onUpdateStudentProfile({
              namaSiswa: next.namaSiswa,
              nisNisn: next.nisNisn,
              photoDataUrl: next.photoDataUrl,
            });
          }
          setPortfolioToast(
            `Foto profil siswa (${next.namaSiswa}) berhasil disimpan di localStorage dan ditampilkan di Header Dashboard Ujian!`
          );
          setTimeout(() => setPortfolioToast(null), 4000);
        }
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qSiswa = params.get('siswa') || params.get('nis') || '';
      if (qSiswa.trim()) return qSiswa.trim();
      const hash = window.location.hash || '';
      if (hash.includes('?')) {
        const hashParams = new URLSearchParams(hash.slice(hash.indexOf('?')));
        const hSiswa = hashParams.get('siswa') || hashParams.get('nis') || '';
        if (hSiswa.trim()) return hSiswa.trim();
      }
    } catch {
      // ignore URL parse errors
    }
    return '';
  });

  // Sinkronisasi awal sudah dikelola oleh App.tsx secara terpusat agar pembukaan tab Siswa Dashboard terasa instan dan tidak lag
  // Filter Rentang Tanggal Riwayat Ujian (Mulai Tanggal s/d Sampai Tanggal)
  const [historyDateStart, setHistoryDateStart] = useState<string>('');
  const [historyDateEnd, setHistoryDateEnd] = useState<string>('');
  const [resetModalConfig, setResetModalConfig] = useState<{
    initialMode?: 'ALL' | 'DATE_RANGE' | 'DATE_FILTER';
    initialStartDate?: string;
    initialEndDate?: string;
  }>({});

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>(
    'ALL'
  );
  const [portfolioToast, setPortfolioToast] = useState<string | null>(null);
  const [showSyncDateModal, setShowSyncDateModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetPasswordInput, setResetPasswordInput] = useState<string>('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState<boolean>(false);
  const candidatePool = useMemo(() => {
    return getHistoricalSubmissionsPool();
  }, [submissions]);
  const [pendingTeacherExportAction, setPendingTeacherExportAction] = useState<
    'copy_tsv' | 'download_csv' | 'export_json' | null
  >(null);
  const [teacherExportPasswordInput, setTeacherExportPasswordInput] = useState<string>('');
  const [teacherExportPasswordError, setTeacherExportPasswordError] = useState<string | null>(null);
  const [showJsonReportModal, setShowJsonReportModal] = useState<boolean>(false);
  const [jsonModalActiveTab, setJsonModalActiveTab] = useState<'preview' | 'summary'>('preview');
  const [copiedLocalJson, setCopiedLocalJson] = useState<boolean>(false);

  const [isResetCompletedAnimated, setIsResetCompletedAnimated] = useState<boolean>(false);
  const [resetCompletedTime, setResetCompletedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('anbk_reset_completed_time_v1');
    } catch {
      return null;
    }
  });
  const [isRestoreCompletedAnimated, setIsRestoreCompletedAnimated] = useState<boolean>(false);
  const [restoreCompletedTime, setRestoreCompletedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('anbk_restore_completed_time_v1');
    } catch {
      return null;
    }
  });

  // State Sesi Ujian Baru
  const [activeSession, setActiveSession] = useState<ExamSessionInfo>(() => propsActiveExamSession || getCurrentExamSession());

  // State & Handler Ripple Effect Interaktif untuk Tombol Reset Data Rekap
  const [resetButtonRipples, setResetButtonRipples] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);

  const handleResetButtonClickWithRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rippleId = Date.now() + Math.random();
    setResetButtonRipples((prev) => [...prev.slice(-3), { id: rippleId, x, y }]);
    setTimeout(() => {
      setResetButtonRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 700);
    handleOpenResetModal(e);
  };
  const [showCreateSessionModal, setShowCreateSessionModal] = useState<boolean>(false);
  const [showCreateSessionAuthModal, setShowCreateSessionAuthModal] = useState<boolean>(false);
  const [createSessionPasswordInput, setCreateSessionPasswordInput] = useState<string>('');
  const [createSessionPasswordError, setCreateSessionPasswordError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [sessionNameInput, setSessionNameInput] = useState<string>('');
  const [targetKelasInput, setTargetKelasInput] = useState<string>('ALL');
  const [autoGenerateNewToken, setAutoGenerateNewToken] = useState<boolean>(true);
  const [customNewTokenInput, setCustomNewTokenInput] = useState<string>(() => generateRandomExamToken(5));
  const [sessionNotesInput, setSessionNotesInput] = useState<string>('');

  useEffect(() => {
    if (propsActiveExamSession) {
      setActiveSession(propsActiveExamSession);
    }
  }, [propsActiveExamSession]);

  useEffect(() => {
    const handleSessionCreated = (e: Event) => {
      const detail = (e as CustomEvent<{ session?: ExamSessionInfo }>)?.detail;
      if (detail?.session) {
        setActiveSession(detail.session);
        setPortfolioToast(
          `✓ Sesi Ujian Baru Dimulai: "${detail.session.sessionName}". Riwayat nilai siswa otomatis dikosongkan.`
        );
        setTimeout(() => setPortfolioToast(null), 6000);
      }
    };
    window.addEventListener('anbk-new-exam-session-created', handleSessionCreated);
    return () => {
      window.removeEventListener('anbk-new-exam-session-created', handleSessionCreated);
    };
  }, []);

  const handleOpenCreateSessionModal = () => {
    if (isSheetModalUnlocked) {
      setSessionNameInput('');
      setCustomNewTokenInput(generateRandomExamToken(5));
      setShowCreateSessionModal(true);
    } else {
      setCreateSessionPasswordInput('');
      setCreateSessionPasswordError(null);
      setShowCreateSessionAuthModal(true);
    }
  };

  const handleVerifyCreateSessionPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (createSessionPasswordInput.trim() === EXAM_INFO.teacherPassword) {
      setIsSheetModalUnlocked(true);
      setShowCreateSessionAuthModal(false);
      setSessionNameInput('');
      setCustomNewTokenInput(generateRandomExamToken(5));
      setShowCreateSessionModal(true);
    } else {
      setCreateSessionPasswordError('Password guru salah! Silakan masukkan password yang valid.');
    }
  };

  const handleExecuteCreateNewSession = async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      const trimmedName =
        sessionNameInput.trim() ||
        `Sesi Ujian Baru · ${new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}`;
      const tokenToUse = autoGenerateNewToken
        ? customNewTokenInput.trim().toUpperCase() || generateRandomExamToken(5)
        : undefined;

      let result: { session: ExamSessionInfo; newToken?: string };
      if (onCreateNewExamSession) {
        result = await onCreateNewExamSession({
          sessionName: trimmedName,
          newToken: tokenToUse,
          targetKelas: targetKelasInput,
          notes: sessionNotesInput,
        });
      } else {
        result = await createNewExamSession({
          sessionName: trimmedName,
          newToken: tokenToUse,
          targetKelas: targetKelasInput,
          notes: sessionNotesInput,
          currentSubmissions: submissions,
        });
        if (onResetAllSubmissions) {
          onResetAllSubmissions();
        }
        if (onUpdateSubmissions) {
          onUpdateSubmissions([]);
        }
      }

      setActiveSession(result.session);
      setShowCreateSessionModal(false);
      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setPortfolioToast(
        `✓ Sesi Ujian Baru Berhasil Dibuat (Pukul ${timeStr}): "${result.session.sessionName}". Riwayat nilai siswa otomatis dikosongkan dan data submission sistem berhasil direset bersih!`
      );
      setTimeout(() => setPortfolioToast(null), 7000);
    } catch (err) {
      console.error('Gagal membuat sesi ujian baru:', err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  useEffect(() => {
    if (submissions.length > 0 && !isResetCompletedAnimated) {
      setResetCompletedTime(null);
      try {
        localStorage.removeItem('anbk_reset_completed_time_v1');
      } catch {
        // ignore
      }
    }
  }, [submissions.length, isResetCompletedAnimated]);

  const isResetSuccessActive =
    isResetCompletedAnimated || (submissions.length === 0 && Boolean(resetCompletedTime));
  const [isPushingToSheet, setIsPushingToSheet] = useState<boolean>(false);
  const [isSyncCompletedAnimated, setIsSyncCompletedAnimated] = useState<boolean>(false);
  const [rekapSyncBannerMsg, setRekapSyncBannerMsg] = useState<string | null>(null);
  const [lastRekapSyncTime, setLastRekapSyncTime] = useState<string | null>(null);
  const [isSheetAutoSynced, setIsSheetAutoSynced] = useState<boolean>(true);
  const syncQueue = useSubmissionSyncQueue();
  const [sheetSyncStatusText, setSheetSyncStatusText] = useState<string>(
    () =>
      `✓ Tersinkron Otomatis ke Server Rekapitulasi + Kolom Ranking, Device & Foto (${submissions.length} Baris · 13 Kolom)`
  );
  const [showSheetConfigModal, setShowSheetConfigModal] = useState<boolean>(false);
  const [sheetModalPass, setSheetModalPass] = useState<string>('');
  const [isSheetModalUnlocked, setIsSheetModalUnlocked] = useState<boolean>(false);
  const [sheetModalError, setSheetModalError] = useState<string | null>(null);
  const [copiedRekapTsv, setCopiedRekapTsv] = useState<boolean>(false);
  const [rekapSheetUrlDraft, setRekapSheetUrlDraft] = useState<string>(() =>
    sanitizeRekapSheetUrl(
      cloudConfig?.googleSheetUrl || googleSheetUrl || getDiscoveredRekapSheetUrl() || DEFAULT_REKAP_SHEET_URL
    )
  );
  const [appsScriptUrlDraft, setAppsScriptUrlDraft] = useState<string>(
    cloudConfig?.appsScriptWebAppUrl || ''
  );

  useEffect(() => {
    const validSheet = sanitizeRekapSheetUrl(
      cloudConfig?.googleSheetUrl || googleSheetUrl || getDiscoveredRekapSheetUrl() || DEFAULT_REKAP_SHEET_URL
    );
    if (validSheet && validSheet !== rekapSheetUrlDraft) {
      setRekapSheetUrlDraft(validSheet);
    }
    if (cloudConfig?.appsScriptWebAppUrl) {
      setAppsScriptUrlDraft(cloudConfig.appsScriptWebAppUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudConfig?.googleSheetUrl, cloudConfig?.appsScriptWebAppUrl, googleSheetUrl]);

  // Enrich submissions with active student's real-time detected device if matching active student
  const submissionsWithSyncedDevice = useMemo(() => {
    const activeNameLower = (activeHeaderStudentName || '').trim().toLowerCase();
    const activeNisLower = (activeHeaderNisNisn || '').trim().toLowerCase();
    const liveCategory = activeDeviceInfo.deviceCategory;
    const liveBrand = activeDeviceInfo.brand;
    const liveModel = activeDeviceInfo.modelType;
    const liveOsBrowser = `${activeDeviceInfo.osName}${
      activeDeviceInfo.osVersion ? ` ${activeDeviceInfo.osVersion}` : ''
    } · ${activeDeviceInfo.browserName}`;
    const liveFp = activeDeviceInfo.deviceFingerprint || 'DEV-A83F';
    const liveIp = activeDeviceInfo.clientIp || '103.148.201.77';
    const liveDeviceInfo = `${liveCategory} — ${liveModel} (${liveOsBrowser} · ${liveFp} · IP: ${liveIp})`;

    const mapped = submissions.map((s) => {
      const isCurrentActiveStudent =
        (activeNameLower &&
          activeNameLower.length >= 3 &&
          activeNameLower !== 'peserta ujian anbk' &&
          s.namaSiswa.trim().toLowerCase() === activeNameLower) ||
        (activeNisLower &&
          activeNisLower.length >= 3 &&
          activeNisLower !== '0' &&
          activeNisLower !== '-' &&
          s.nisNisn.trim().toLowerCase() === activeNisLower);
      
      const itemFp = s.deviceFingerprint || (isCurrentActiveStudent ? liveFp : undefined);
      const itemIp = s.clientIp || (isCurrentActiveStudent ? liveIp : undefined);
      let sDeviceInfo = s.deviceInfo || '';
      if (!sDeviceInfo) {
        sDeviceInfo = isCurrentActiveStudent
          ? liveDeviceInfo
          : `${s.deviceCategory || 'HP Android'} — ${s.deviceModel || 'Perangkat Siswa'}${
              s.deviceOsBrowser ? ` (${s.deviceOsBrowser})` : ''
            }`;
      }
      if (itemFp && !sDeviceInfo.includes(itemFp)) {
        sDeviceInfo += ` · ${itemFp}`;
      }
      if (itemIp && !sDeviceInfo.includes(itemIp)) {
        sDeviceInfo += ` · IP: ${itemIp}`;
      }

      if (isCurrentActiveStudent && !s.id.startsWith('HIST-')) {
        return {
          ...s,
          deviceCategory: s.deviceCategory || liveCategory,
          deviceBrand: s.deviceBrand || liveBrand,
          deviceModel: s.deviceModel || liveModel,
          deviceOsBrowser: s.deviceOsBrowser || liveOsBrowser,
          deviceInfo: sDeviceInfo,
          clientIp: itemIp,
          deviceFingerprint: itemFp,
          photoUrl:
            s.photoUrl ||
            activeHeaderPhotoUrl ||
            getPhotoForStudentIdentity(s.namaSiswa, s.nisNisn) ||
            undefined,
        };
      }
      const storedPhoto = getPhotoForStudentIdentity(s.namaSiswa, s.nisNisn);
      return {
        ...s,
        clientIp: itemIp,
        deviceFingerprint: itemFp,
        deviceInfo: sDeviceInfo,
        ...(storedPhoto && !s.photoUrl ? { photoUrl: storedPhoto } : {}),
      };
    });
    return deduplicateSubmissions(mapped);
  }, [
    submissions,
    activeHeaderStudentName,
    activeHeaderNisNisn,
    activeDeviceInfo,
    activeHeaderPhotoUrl,
  ]);

  // Sinkronisasi otomatis seluruh laporan hasil ujian + kolom Device dari Siswa Dashboard ke Link Google Sheets Rekap Hasil Ujian
  useEffect(() => {
    const activeSheet = sanitizeRekapSheetUrl(
      rekapSheetUrlDraft.trim() ||
        cloudConfig?.googleSheetUrl ||
        googleSheetUrl ||
        getDiscoveredRekapSheetUrl() ||
        DEFAULT_REKAP_SHEET_URL
    );
    const activeScript = appsScriptUrlDraft.trim() || cloudConfig?.appsScriptWebAppUrl || '';

    const runAutoPush = (forcePush: boolean = false) => {
      syncSubmissionsToGoogleSheetsAuto(
        submissionsWithSyncedDevice,
        activeSheet,
        activeScript,
        forcePush
      )
        .then((ok) => {
          if (ok) {
            setIsSheetAutoSynced(true);
            setSheetSyncStatusText(
              `✓ Tersinkron Otomatis ke Server Rekapitulasi + Ranking, Device & Foto (${submissionsWithSyncedDevice.length} Baris · 13 Kolom)`
            );
          } else if (!getAccessTokenSync() && !activeScript) {
            setIsSheetAutoSynced(false);
            setSheetSyncStatusText(
              `Siap Sinkron Otomatis ke Server Rekapitulasi + Ranking, Device & Foto (${submissionsWithSyncedDevice.length} Baris · 13 Kolom)`
            );
          }
        })
        .catch(() => {});
    };

    const timerId = window.setTimeout(() => {
      runAutoPush(false);
    }, 600);

    const onOauthReady = () => {
      setIsSheetAutoSynced(true);
      runAutoPush(true);
    };
    const onSheetSyncSuccess = () => {
      setIsSheetAutoSynced(true);
      setSheetSyncStatusText(
        `✓ Tersinkron Otomatis ke Server Rekapitulasi + Ranking, Device & Foto (${submissionsWithSyncedDevice.length} Baris · 13 Kolom)`
      );
    };
    window.addEventListener('anbk-sheets-oauth-ready', onOauthReady);
    window.addEventListener('anbk-sheets-sync-success', onSheetSyncSuccess);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('anbk-sheets-oauth-ready', onOauthReady);
      window.removeEventListener('anbk-sheets-sync-success', onSheetSyncSuccess);
    };
  }, [
    submissionsWithSyncedDevice,
    cloudConfig?.googleSheetUrl,
    cloudConfig?.appsScriptWebAppUrl,
    googleSheetUrl,
    rekapSheetUrlDraft,
    appsScriptUrlDraft,
  ]);

  const submissionRankMap = useMemo(
    () => computeSubmissionRankingMap(submissionsWithSyncedDevice),
    [submissionsWithSyncedDevice]
  );

  const executeCopyRekap10ColTsv = () => {
    const headerLine = REKAP_SHEET_HEADERS.join('\t');
    const rowLines = submissionsWithSyncedDevice.map((s, idx) => {
      const rankNum =
        submissionRankMap[s.id] ||
        submissionRankMap[getSubmissionUniqueKey(s)] ||
        idx + 1;
      return formatSubmissionToRekap13ColumnsWithRank(s, rankNum).join('\t');
    });
    const tsv = [headerLine, ...rowLines].join('\n');
    navigator.clipboard?.writeText(tsv).catch(() => {});
    setCopiedRekapTsv(true);
    setTimeout(() => setCopiedRekapTsv(false), 3000);
    setPortfolioToast(
      `✓ Akses Guru Terverifikasi: Berhasil menyalin ${submissionsWithSyncedDevice.length} baris Rekap Hasil Ujian + Ranking, Device & FOTO (Header 13 Kolom Persis: ${REKAP_SHEET_HEADERS.join(', ')})!`
    );
    setTimeout(() => setPortfolioToast(null), 4500);
  };

  const executeDownloadRekap10ColCsv = () => {
    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headerLine = REKAP_SHEET_HEADERS.map(escapeCsv).join(',');
    const rowLines = submissionsWithSyncedDevice.map((s, idx) => {
      const rankNum =
        submissionRankMap[s.id] ||
        submissionRankMap[getSubmissionUniqueKey(s)] ||
        idx + 1;
      return formatSubmissionToRekap13ColumnsWithRank(s, rankNum).map(escapeCsv).join(',');
    });
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerFileDownload(blob, 'Rekap_Hasil_Ujian_Ranking_Device_Foto.csv');
    setPortfolioToast(
      `✓ Akses Guru Terverifikasi: File CSV "Rekap_Hasil_Ujian_Ranking_Device_Foto.csv" (${submissionsWithSyncedDevice.length} laporan lengkap dengan kolom Ranking, Device & FOTO) berhasil diunduh!`
    );
    setTimeout(() => setPortfolioToast(null), 4500);
  };

  /**
   * Mengumpulkan seluruh rekaman data ujian siswa yang tersimpan di perangkat lokal
   * (state aktif, localStorage, cache draft terselesaikan, antrean sinkronisasi offline, & backup arsip)
   */
  const getAllLocalSubmissionsMerged = useCallback((): StudentSubmission[] => {
    const map = new Map<string, StudentSubmission>();

    // 1. Ambil dari submissions aktif (dengan deteksi perangkat termutakhir)
    submissionsWithSyncedDevice.forEach((s) => {
      const key = s.id || getSubmissionUniqueKey(s);
      map.set(key, s);
      if (s.id) map.set(s.id, s);
    });

    // 2. Ambil dari localStorage utama (anbk_submissions_v1)
    if (typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('anbk_submissions_v1');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: StudentSubmission) => {
              if (s && s.namaSiswa) {
                const key = s.id || getSubmissionUniqueKey(s);
                if (!map.has(key)) map.set(key, s);
              }
            });
          }
        }
      } catch {}

      // 3. Ambil dari rekaman submission terakhir yang tersimpan di browser
      try {
        const rawLast = localStorage.getItem('anbk_last_completed_submission_v1');
        if (rawLast) {
          const s = JSON.parse(rawLast);
          if (s && s.namaSiswa) {
            const key = s.id || getSubmissionUniqueKey(s);
            if (!map.has(key)) map.set(key, s);
          }
        }
      } catch {}

      // 4. Ambil dari antrean sinkronisasi offline (anbk_submission_sync_queue_v2) jika jaringan terputus
      try {
        const rawQueue = localStorage.getItem('anbk_submission_sync_queue_v2');
        if (rawQueue) {
          const parsedQ = JSON.parse(rawQueue);
          if (Array.isArray(parsedQ)) {
            parsedQ.forEach((qItem: any) => {
              if (qItem && qItem.payload) {
                const items = Array.isArray(qItem.payload) ? qItem.payload : [qItem.payload];
                items.forEach((s: any) => {
                  if (s && s.namaSiswa) {
                    const key = s.id || getSubmissionUniqueKey(s);
                    if (!map.has(key)) map.set(key, s);
                  }
                });
              }
            });
          }
        }
      } catch {}
    }

    // 5. Gabungkan dengan data candidatePool/arsip
    candidatePool.forEach((s) => {
      const key = s.id || getSubmissionUniqueKey(s);
      if (!map.has(key)) map.set(key, s);
    });

    // Deduplikasi ketat
    const result: StudentSubmission[] = [];
    const seenKeys = new Set<string>();
    for (const s of map.values()) {
      const uniqueKey = getSubmissionUniqueKey(s);
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        result.push(s);
      }
    }

    // Urutkan nilai tertinggi lalu waktu terbaru
    return result.sort((a, b) => {
      if ((b.nilaiAkhir ?? 0) !== (a.nilaiAkhir ?? 0)) {
        return (b.nilaiAkhir ?? 0) - (a.nilaiAkhir ?? 0);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [submissionsWithSyncedDevice, candidatePool]);

  /**
   * Menghasilkan struktur laporan lengkap JSON seluruh submission ujian lokal
   * Dilengkapi metadata sekolah, diagnostik jaringan/sinkronisasi, ringkasan statistik, dan rincian lengkap tiap siswa
   */
  const buildAllLocalSubmissionsJsonReport = useCallback(() => {
    const allSubs: StudentSubmission[] = getAllLocalSubmissionsMerged();
    const rankMap = computeSubmissionRankingMap(allSubs);

    const totalSubs = allSubs.length;
    const passedSubs = allSubs.filter((s: StudentSubmission) => (s.nilaiAkhir ?? 0) >= 75);
    const failedSubs = allSubs.filter((s: StudentSubmission) => (s.nilaiAkhir ?? 0) < 75);
    const totalScore = allSubs.reduce((acc: number, curr: StudentSubmission) => acc + (curr.nilaiAkhir ?? 0), 0);
    const averageScore = totalSubs > 0 ? Number((totalScore / totalSubs).toFixed(2)) : 0;
    const highestScore = totalSubs > 0 ? Math.max(...allSubs.map((s: StudentSubmission) => s.nilaiAkhir ?? 0)) : 0;
    const lowestScore = totalSubs > 0 ? Math.min(...allSubs.map((s: StudentSubmission) => s.nilaiAkhir ?? 0)) : 0;

    const classBreakdown: Record<string, number> = {};
    const packageBreakdown: Record<string, number> = {};

    allSubs.forEach((s: StudentSubmission) => {
      const c = getCleanKelas(s.kelas) || 'Kelas Tidak Diketahui';
      classBreakdown[c] = (classBreakdown[c] || 0) + 1;
      const pkg = (s as any).packageKey || getPackageKey(s.kelas, getSemesterFromSub(s)) || 'FASE_D_PAKET_1';
      packageBreakdown[pkg] = (packageBreakdown[pkg] || 0) + 1;
    });

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const activeSheetUrl = sanitizeRekapSheetUrl(
      rekapSheetUrlDraft.trim() ||
        cloudConfig?.googleSheetUrl ||
        googleSheetUrl ||
        DEFAULT_REKAP_SHEET_URL
    );

    const formattedSubmissions = allSubs.map((s: StudentSubmission, idx: number) => {
      const rankNum = rankMap[s.id] || rankMap[getSubmissionUniqueKey(s)] || idx + 1;
      const isPassed = (s.nilaiAkhir ?? 0) >= 75;
      const totalDuration =
        (s as any).timeSpentSeconds ||
        Object.values(s.questionDurations || {}).reduce((acc: number, val: number) => acc + val, 0);

      return {
        ranking: rankNum,
        id: s.id || `SUB-${idx + 1}`,
        namaSiswa: s.namaSiswa,
        nisNisn: s.nisNisn || '',
        kelas: getCleanKelas(s.kelas),
        semester: getSemesterFromSub(s),
        packageKey: (s as any).packageKey || getPackageKey(s.kelas, getSemesterFromSub(s)) || 'FASE_D_PAKET_1',
        skorBenar: s.skorBenar ?? 0,
        totalSoal: s.totalSoal ?? 40,
        nilaiAkhir: s.nilaiAkhir ?? 0,
        persentase: Math.round(((s.skorBenar ?? 0) / (s.totalSoal || 40)) * 100),
        statusKelulusan: isPassed ? 'LULUS' : 'REMEDIAL',
        statusKecurangan: s.statusKecurangan || 'NORMAL (Tertib)',
        jumlahPelanggaran: s.violationCount || 0,
        catatanPelanggaran: s.violationLogs || [],
        timestamp: s.timestamp,
        durasiPengerjaanDetik: totalDuration,
        tokenUjian: s.usedToken || '',
        kategoriPerangkat: s.deviceCategory || 'Tidak Diketahui',
        merekPerangkat: s.deviceBrand || '',
        modelPerangkat: s.deviceModel || '',
        sistemOperasiBrowser: s.deviceOsBrowser || '',
        informasiPerangkatLengkap: s.deviceInfo || '',
        sidikJariPerangkat: s.deviceFingerprint || '',
        ipKlien: s.clientIp || '',
        jumlahJawabanTersimpan: Object.keys(s.answers || {}).length,
        jawabanSiswa: s.answers || {},
        adaFotoSiswa: Boolean(s.photoUrl),
      };
    });

    return {
      judulLaporan: 'LAPORAN REKAPITULASI CADANGAN HASIL UJIAN SISWA (OFFLINE / EKSPOR LOKAL)',
      tujuanEkspor:
        'Ekspor data mandiri guru untuk penanganan kendala jaringan internet berkepanjangan atau masalah sinkronisasi Google Sheets / Cloud Firestore.',
      versiAplikasi: 'V.8.4 Aplikasi Soal Ujian UPTD SMP Negeri 7 Kisaran',
      waktuEkspor: {
        iso: now.toISOString(),
        lokal: `${dateFormatted}, Pukul ${timeFormatted} WIB`,
        timestampMs: now.getTime(),
      },
      informasiSekolah: {
        namaSekolah: 'UPTD SMP Negeri 7 Kisaran',
        kurikulum: 'Kurikulum Merdeka (Deep Learning) Fase D Tingkat SMP',
        mataPelajaran: 'Informatika',
        tahunAjaran: '2026/2027',
        guruMataPelajaran: EXAM_INFO.guruMapel,
        standarKkm: 75,
      },
      informasiSesiUjian: {
        idSesi: activeSession.sessionId,
        namaSesi: activeSession.sessionName,
        tokenAktif: activeSession.token || activeSession.sessionId || '-',
        targetKelas: activeSession.targetKelas,
        waktuMulai: activeSession.createdAt,
        catatanSesi: activeSession.notes || '-',
      },
      diagnostikSinkronisasiDanJaringan: {
        statusKoneksiInternet: typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE',
        jumlahAntreanTertunda: syncQueue.stats.pendingCount,
        antreanSedangDiproses: syncQueue.stats.isProcessing,
        tautanGoogleSheetTerkonfigurasi: activeSheetUrl,
        tautanAppsScriptTerkonfigurasi: appsScriptUrlDraft || cloudConfig?.appsScriptWebAppUrl || '-',
        sinkronisasiTerakhir: lastSyncTime || syncQueue.stats.lastSyncSuccessTime || 'Belum Tercatat',
        kesalahanSinkronisasiTerakhir: syncQueue.stats.lastError || null,
        sumberPenyimpananData: 'Penyimpanan Lokal Browser (LocalStorage & Sync Queue Cache)',
      },
      ringkasanStatistik: {
        totalPesertaUjian: totalSubs,
        jumlahLulus: passedSubs.length,
        jumlahRemedial: failedSubs.length,
        persentaseKelulusan: totalSubs > 0 ? Number(((passedSubs.length / totalSubs) * 100).toFixed(1)) : 0,
        nilaiTertinggi: highestScore,
        nilaiTerendah: lowestScore,
        rataRataNilai: averageScore,
        sebaranKelas: classBreakdown,
        sebaranPaketSoal: packageBreakdown,
      },
      daftarHasilUjianSiswa: formattedSubmissions,
    };
  }, [
    getAllLocalSubmissionsMerged,
    activeSession,
    rekapSheetUrlDraft,
    cloudConfig,
    googleSheetUrl,
    appsScriptUrlDraft,
    syncQueue.stats,
    lastSyncTime,
  ]);

  /**
   * Mengunduh berkas laporan JSON hasil ujian seluruh siswa lokal
   */
  const executeDownloadLocalSubmissionsJson = useCallback(() => {
    const report = buildAllLocalSubmissionsJsonReport();
    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const filename = `Laporan_Hasil_Ujian_Lokal_SMPN7_Kisaran_${yyyy}${mm}${dd}_${hh}${min}.json`;

    triggerFileDownload(blob, filename);
    setPortfolioToast(
      `✓ Akses Guru: Berhasil mengunduh "${filename}" (${report.ringkasanStatistik.totalPesertaUjian} data ujian siswa lokal berhasil diekspor)!`
    );
    setTimeout(() => setPortfolioToast(null), 5000);
  }, [buildAllLocalSubmissionsJsonReport]);

  /**
   * Menyalin teks JSON laporan hasil ujian seluruh siswa lokal ke clipboard
   */
  const executeCopyLocalSubmissionsJson = useCallback(() => {
    const report = buildAllLocalSubmissionsJsonReport();
    const jsonString = JSON.stringify(report, null, 2);
    navigator.clipboard?.writeText(jsonString).catch(() => {});
    setCopiedLocalJson(true);
    setTimeout(() => setCopiedLocalJson(false), 3000);
    setPortfolioToast(
      `✓ Berhasil menyalin Laporan JSON (${report.ringkasanStatistik.totalPesertaUjian} data ujian siswa lokal) ke clipboard!`
    );
    setTimeout(() => setPortfolioToast(null), 4500);
  }, [buildAllLocalSubmissionsJsonReport]);

  const handleExportLocalSubmissionsJson = () => {
    if (isSheetModalUnlocked) {
      setShowJsonReportModal(true);
      return;
    }
    setTeacherExportPasswordInput('');
    setTeacherExportPasswordError(null);
    setPendingTeacherExportAction('export_json');
  };

  const handleCopyRekap10ColTsv = () => {
    if (isSheetModalUnlocked) {
      executeCopyRekap10ColTsv();
      return;
    }
    setTeacherExportPasswordInput('');
    setTeacherExportPasswordError(null);
    setPendingTeacherExportAction('copy_tsv');
  };

  const handleDownloadRekap10ColCsv = () => {
    if (isSheetModalUnlocked) {
      executeDownloadRekap10ColCsv();
      return;
    }
    setTeacherExportPasswordInput('');
    setTeacherExportPasswordError(null);
    setPendingTeacherExportAction('download_csv');
  };

  const handleConfirmTeacherExportAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherExportPasswordInput.trim() !== EXAM_INFO.teacherPassword) {
      setTeacherExportPasswordError(
        'Akses Ditolak! Fitur Ekspor Data (TSV, CSV, & Laporan JSON) HANYA dapat diakses oleh Guru Mapel. Siswa/Murid tidak diizinkan mengakses fitur ini.'
      );
      return;
    }
    setIsSheetModalUnlocked(true);
    const actionToRun = pendingTeacherExportAction;
    setTeacherExportPasswordInput('');
    setTeacherExportPasswordError(null);
    setPendingTeacherExportAction(null);
    if (actionToRun === 'copy_tsv') {
      executeCopyRekap10ColTsv();
    } else if (actionToRun === 'download_csv') {
      executeDownloadRekap10ColCsv();
    } else if (actionToRun === 'export_json') {
      setShowJsonReportModal(true);
    }
  };

  const handleSyncAllAndPushToGoogleSheets = async (
    allowInteractiveAuth: boolean = false,
    filter?: SyncDateFilter,
    explicitFilteredSubs?: StudentSubmission[]
  ) => {
    const activeSheet = sanitizeRekapSheetUrl(
      rekapSheetUrlDraft.trim() ||
        cloudConfig?.googleSheetUrl ||
        googleSheetUrl ||
        getDiscoveredRekapSheetUrl() ||
        DEFAULT_REKAP_SHEET_URL
    );
    const activeScript = appsScriptUrlDraft.trim() || cloudConfig?.appsScriptWebAppUrl || '';

    // Hanya panggil googleSignIn interaktif jika diminta dari Panel Pengaturan Guru yang sudah dibuka kuncinya
    let interactiveToken = getAccessTokenSync();
    if (allowInteractiveAuth && isSheetModalUnlocked && !interactiveToken) {
      const authRes = await googleSignIn();
      if (authRes?.accessToken) {
        interactiveToken = authRes.accessToken;
      }
    }

    setIsPushingToSheet(true);
    try {
      // 1. Deteksi ulang perangkat siswa secara akurat agar kolom Device selalu mutakhir
      const latestDevice = await detectStudentDeviceAsync(false).catch(() => activeDeviceInfo);
      if (latestDevice) {
        setActiveDeviceInfo(latestDevice);
      }

      const liveCat = latestDevice?.deviceCategory || activeDeviceInfo.deviceCategory;
      const liveBrand = latestDevice?.brand || activeDeviceInfo.brand;
      const liveModel = latestDevice?.modelType || activeDeviceInfo.modelType;
      const liveOsBrowser = `${latestDevice?.osName || activeDeviceInfo.osName}${
        (latestDevice?.osVersion || activeDeviceInfo.osVersion)
          ? ` ${latestDevice?.osVersion || activeDeviceInfo.osVersion}`
          : ''
      } · ${latestDevice?.browserName || activeDeviceInfo.browserName}`;
      const liveFp = latestDevice?.deviceFingerprint || activeDeviceInfo.deviceFingerprint || 'DEV-A83F';
      const liveIp = latestDevice?.clientIp || activeDeviceInfo.clientIp || '103.148.201.77';
      const liveDeviceInfo = `${liveCat} — ${liveModel} (${liveOsBrowser} · ${liveFp} · IP: ${liveIp})`;

      const activeNameLower = (activeHeaderStudentName || '').trim().toLowerCase();
      const activeNisLower = (activeHeaderNisNisn || '').trim().toLowerCase();
      const syncedDeviceSubId =
        typeof window !== 'undefined'
          ? localStorage.getItem('anbk_device_synced_sub_id_v1') || ''
          : '';

      const enrichedToSync: StudentSubmission[] = submissionsWithSyncedDevice.map((s, idx) => {
        const isMatched =
          (syncedDeviceSubId && s.id === syncedDeviceSubId) ||
          (activeNameLower &&
            activeNameLower !== 'peserta ujian anbk' &&
            s.namaSiswa.trim().toLowerCase() === activeNameLower) ||
          (activeNisLower &&
            activeNisLower !== '0' &&
            activeNisLower !== '-' &&
            s.nisNisn.trim().toLowerCase() === activeNisLower) ||
          (!syncedDeviceSubId && idx === 0 && !s.id.startsWith('HIST-'));

        if (isMatched) {
          return {
            ...s,
            deviceCategory: liveCat || s.deviceCategory,
            deviceBrand: liveBrand || s.deviceBrand,
            deviceModel: liveModel || s.deviceModel,
            deviceOsBrowser: liveOsBrowser || s.deviceOsBrowser,
            deviceInfo: liveDeviceInfo || s.deviceInfo,
            clientIp: liveIp || s.clientIp,
            deviceFingerprint: liveFp || s.deviceFingerprint,
            photoUrl:
              activeHeaderPhotoUrl ||
              s.photoUrl ||
              getPhotoForStudentIdentity(s.namaSiswa, s.nisNisn) ||
              undefined,
          };
        }
        return s;
      });

      if (rekapSheetUrlDraft !== activeSheet) {
        setRekapSheetUrlDraft(activeSheet);
      }

      if (onUpdateCloudConfig && cloudConfig) {
        onUpdateCloudConfig({
          ...cloudConfig,
          googleSheetUrl: activeSheet,
          appsScriptWebAppUrl: activeScript,
        });
      } else {
        await writeFirestoreCloudConfig({
          googleSheetUrl: activeSheet,
          appsScriptWebAppUrl: activeScript,
          ...(interactiveToken
            ? {
                oauthAccessToken: interactiveToken,
                oauthExpiresAt: Date.now() + 50 * 60 * 1000,
              }
            : {}),
        });
      }

      if (interactiveToken) {
        await writeFirestoreCloudConfig({
          googleSheetUrl: activeSheet,
          appsScriptWebAppUrl: activeScript,
          oauthAccessToken: interactiveToken,
          oauthExpiresAt: Date.now() + 50 * 60 * 1000,
        });
      }

      // 2. HANYA sinkronkan data yang ada pada sistem saat ini saja!
      // DILARANG menarik atau memulihkan data lama dari Google Sheets atau cache yang sudah dihapus atau direset sistem!
      const isLocallyCleared =
        typeof window !== 'undefined' &&
        localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
      const localClearedAt =
        typeof window !== 'undefined'
          ? Number(localStorage.getItem('anbk_submissions_cleared_at_v1') || 0)
          : 0;
      const localDelSet = new Set<string>();
      try {
        const rawDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
        if (rawDel) {
          JSON.parse(rawDel).forEach((k: string) => {
            if (k) localDelSet.add(k);
          });
        }
      } catch {}

      const validSystemSubs = (isLocallyCleared && enrichedToSync.length === 0)
        ? []
        : enrichedToSync.filter((s) => {
            if (!s || !s.namaSiswa) return false;
            const k = s.id || getSubmissionUniqueKey(s);
            const uKey = getSubmissionUniqueKey(s);
            if (localDelSet.has(s.id) || localDelSet.has(k) || localDelSet.has(uKey)) return false;
            if (localClearedAt > 0) {
              const matchTs = (s.id || '').match(/^(?:SUB|ESAY)-(\d+)/);
              const createdTs = matchTs ? Number(matchTs[1]) : 0;
              if (createdTs > 0 && createdTs <= localClearedAt) return false;
            }
            return true;
          });

      const finalToSync: StudentSubmission[] =
        filter && filter.mode !== 'ALL'
          ? explicitFilteredSubs && explicitFilteredSubs.length > 0
            ? explicitFilteredSubs
            : validSystemSubs.filter((s) => isSubmissionMatchingSyncFilter(s, filter))
          : validSystemSubs;

      // 3. Simpan perubahan ke state utama, localStorage, Firestore Cloud & Server Rekapitulasi
      if (onUpdateSubmissions) {
        onUpdateSubmissions(finalToSync);
      }
      await saveAllSubmissionsToServer(finalToSync, activeSheet, activeScript);

      // 4. Salin juga TSV 13 kolom (termasuk Ranking, Device & FOTO) ke clipboard sebagai cadangan instan
      const rankMapForSync = computeSubmissionRankingMap(finalToSync);
      const headerLine = REKAP_SHEET_HEADERS.join('\t');
      const rowLines = finalToSync.map((s, idx) => {
        const rnk = rankMapForSync[s.id] || rankMapForSync[getSubmissionUniqueKey(s)] || idx + 1;
        return formatSubmissionToRekap13ColumnsWithRank(s, rnk).join('\t');
      });
      navigator.clipboard?.writeText([headerLine, ...rowLines].join('\n')).catch(() => {});

      // 5. Dorong otomatis ke Google Sheets / Apps Script / Cloud Server Rekapitulasi
      let pushedOk = await syncSubmissionsToGoogleSheetsAuto(
        finalToSync,
        activeSheet,
        activeScript,
        true
      );

      // Jika token lama kedaluwarsa pada mode guru interaktif, minta otorisasi ulang sekali
      if (!pushedOk && allowInteractiveAuth && isSheetModalUnlocked && interactiveToken) {
        invalidateAccessToken(interactiveToken);
        const retryAuth = await googleSignIn();
        if (retryAuth?.accessToken) {
          interactiveToken = retryAuth.accessToken;
          await writeFirestoreCloudConfig({
            googleSheetUrl: activeSheet,
            appsScriptWebAppUrl: activeScript,
            oauthAccessToken: interactiveToken,
            oauthExpiresAt: Date.now() + 50 * 60 * 1000,
          });
          pushedOk = await syncSubmissionsToGoogleSheetsAuto(
            finalToSync,
            activeSheet,
            activeScript,
            true
          );
        }
      }

      // 6. Tarik & selaraskan ulang dengan Server Cloud tanpa menimpa data lokal
      if (onManualSync) {
        await Promise.resolve(onManualSync());
      }

      const nowSyncTime = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastRekapSyncTime(nowSyncTime);
      setIsSheetAutoSynced(true);
      setIsSyncCompletedAnimated(true);
      setTimeout(() => {
        setIsSyncCompletedAnimated(false);
      }, 8000);
      const statusSummary = `✓ Tersinkron Otomatis ke Server Rekapitulasi + Ranking, Device & Foto (${finalToSync.length} Baris · 13 Kolom · Pukul ${nowSyncTime})`;
      setSheetSyncStatusText(statusSummary);

      let filterSummaryText = '';
      if (filter && filter.mode !== 'ALL') {
        if (filter.mode === 'TODAY') filterSummaryText = 'Hari Ini';
        else if (filter.mode === 'DATE_RANGE')
          filterSummaryText = `${filter.startDateIso} s/d ${filter.endDateIso}`;
        else if (filter.specificDateIso) filterSummaryText = filter.specificDateIso;
        else if (
          filter.selectedDate !== 'ALL' ||
          filter.selectedMonth !== 'ALL' ||
          filter.selectedYear !== 'ALL'
        ) {
          filterSummaryText = `Tgl ${filter.selectedDate ?? 'Semua'}/${filter.selectedMonth ?? 'Semua'}/${filter.selectedYear ?? 'Semua'}`;
        }
      }

      const bannerMsg = pushedOk
        ? `✓ Sinkronisasi Berhasil! Sebanyak ${finalToSync.length} data siswa (${filterSummaryText ? `Periode: ${filterSummaryText}` : 'Semua Data'}) telah tersinkron ke Link Google Sheets (Pukul ${nowSyncTime}).`
        : `✓ Data Rekap (${finalToSync.length} data · ${filterSummaryText ? `Periode: ${filterSummaryText}` : 'Semua Data'}) berhasil disinkronkan ke Server Cloud & disalin ke Clipboard (Pukul ${nowSyncTime}).`;

      setRekapSyncBannerMsg(bannerMsg);
      setPortfolioToast(bannerMsg);
      setTimeout(() => {
        setPortfolioToast(null);
        setRekapSyncBannerMsg(null);
      }, 8000);
    } finally {
      setIsPushingToSheet(false);
    }
  };

  const handleConfirmSyncFromModal = async (
    filter: SyncDateFilter,
    filteredSubs: StudentSubmission[]
  ) => {
    setShowSyncDateModal(false);
    await handleSyncAllAndPushToGoogleSheets(false, filter, filteredSubs);
  };

  const handleManualCloudSyncClick = async () => {
    if (onManualSync) {
      await Promise.resolve(onManualSync());
    }
    const nowSyncTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastRekapSyncTime(nowSyncTime);
    setIsSheetAutoSynced(true);
    setIsSyncCompletedAnimated(true);
    setTimeout(() => {
      setIsSyncCompletedAnimated(false);
    }, 8000);
    setPortfolioToast(
      `✓ Selesai Sinkron dari Server Cloud Lintas Perangkat (Pukul ${nowSyncTime})!`
    );
    setTimeout(() => setPortfolioToast(null), 6000);
  };

  const handleOpenResetModal = (
    opts?:
      | {
          mode?: 'ALL' | 'DATE_RANGE' | 'DATE_FILTER';
          startDate?: string;
          endDate?: string;
        }
      | React.MouseEvent
  ) => {
    setResetPasswordInput('');
    setResetPasswordError(null);
    if (opts && typeof opts === 'object' && 'mode' in opts) {
      setResetModalConfig({
        initialMode: opts.mode,
        initialStartDate: opts.startDate,
        initialEndDate: opts.endDate,
      });
    } else if (historyDateStart || historyDateEnd) {
      setResetModalConfig({
        initialMode: 'DATE_RANGE',
        initialStartDate: historyDateStart,
        initialEndDate: historyDateEnd,
      });
    } else {
      setResetModalConfig({
        initialMode: 'ALL',
        initialStartDate: '',
        initialEndDate: '',
      });
    }
    setShowResetConfirmModal(true);
  };

  const handleOpenRestoreModal = () => {
    setShowRestoreConfirmModal(true);
  };

  const handleConfirmRestoreWithFilter = async (
    filter: RestoreSubmissionsFilter,
    explicitToken?: string
  ) => {
    setIsSheetModalUnlocked(true);
    let res: any = null;
    if (onRestoreDefaultSubmissions) {
      res = await onRestoreDefaultSubmissions(filter, explicitToken);
    }
    setShowRestoreConfirmModal(false);
    const nowRestoreTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    try {
      localStorage.removeItem('anbk_reset_completed_time_v1');
      localStorage.setItem('anbk_restore_completed_time_v1', nowRestoreTime);
    } catch {
      // ignore
    }
    setIsResetCompletedAnimated(false);
    setResetCompletedTime(null);
    setRestoreCompletedTime(nowRestoreTime);
    setIsRestoreCompletedAnimated(true);

    const restoredCount =
      res?.restoredCount ??
      (filter.mode === 'ALL' ? candidatePool.length : 'Terpilih');
    const targetDesc =
      filter.restoreTarget.appMenus && filter.restoreTarget.googleSheet
        ? 'Menu Aplikasi & Google Sheet'
        : filter.restoreTarget.appMenus
        ? 'Menu Aplikasi'
        : 'Google Sheet';

    setSheetSyncStatusText(
      `✓ Pulihkan Data Riwayat Sukses (${restoredCount} Siswa) · ${targetDesc} (Pukul ${nowRestoreTime})`
    );
    setPortfolioToast(
      `✓ PULIHKAN DATA RIWAYAT SUKSES (Pukul ${nowRestoreTime}): ${restoredCount} data riwayat siswa berhasil dipulihkan ke ${targetDesc} dan tersinkronisasi lintas perangkat!`
    );
    setTimeout(() => {
      setIsRestoreCompletedAnimated(false);
    }, 9000);
    setTimeout(() => setPortfolioToast(null), 8000);
  };

  const handleConfirmResetWithFilter = async (
    filter: ResetSubmissionsFilter,
    explicitToken?: string
  ) => {
    setIsSheetModalUnlocked(false);
    setSheetModalPass('');

    let res: any = null;
    if (onResetAllSubmissions) {
      try {
        res = await onResetAllSubmissions(filter, explicitToken);
      } catch (e) {
        console.warn('Peringatan reset sinkronisasi:', e);
      }
    }

    const toDeleteCount =
      res?.deletedCount ??
      submissions.filter((s) => isSubmissionMatchingResetFilter(s, filter)).length;
    const remainingCount = res?.remainingCount ?? Math.max(0, submissions.length - toDeleteCount);
    const isTotal = !filter || filter.mode === 'ALL' || remainingCount === 0;

    if (isTotal) {
      if (onUpdateSubmissions) {
        onUpdateSubmissions([]);
      }
    } else {
      const remaining = submissions.filter((s) => !isSubmissionMatchingResetFilter(s, filter));
      if (onUpdateSubmissions) {
        onUpdateSubmissions(remaining);
      }
    }

    setSearchQuery('');
    setSelectedClassFilter('ALL');
    setSelectedStatusFilter('ALL');
    setRankingClassScope('AUTO');
    setChartSelectedStudent('ALL');
    setIsAnonymousRanking(false);
    setShowResetConfirmModal(false);

    try {
      const cleanUrl = `${window.location.pathname}${
        window.location.hash.startsWith('#siswa-dashboard') ? '#siswa-dashboard' : ''
      }`;
      window.history.replaceState(null, '', cleanUrl);
    } catch {
      // ignore
    }

    const nowResetStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (isTotal) {
      try {
        localStorage.setItem('anbk_reset_completed_time_v1', nowResetStr);
        localStorage.removeItem('anbk_restore_completed_time_v1');
        localStorage.removeItem('anbk_exam_has_started');
        localStorage.removeItem('anbk_exam_in_progress');
        localStorage.removeItem('anbk_exam_has_completed');
        localStorage.removeItem('anbk_classroom_has_entered');
        localStorage.removeItem('anbk_active_exam_draft_v1');
        localStorage.removeItem('anbk_device_synced_sub_id_v1');
      } catch {
        // ignore
      }
      setIsRestoreCompletedAnimated(false);
      setRestoreCompletedTime(null);
      setResetCompletedTime(nowResetStr);
      setIsResetCompletedAnimated(true);
      setTimeout(() => {
        setIsResetCompletedAnimated(false);
      }, 9000);
    }

    setLastRekapSyncTime(nowResetStr);
    setIsSheetAutoSynced(true);

    const resetMsg = isTotal
      ? `✓ RESET DATA SUCCSES (Pukul ${nowResetStr}): Seluruh baris data siswa di Dashboard, Riwayat Siswa & Link Google Sheets telah direset bersih (0 data), dengan Judul Nama & Warna 13 Kolom Baris Pertama pada Google Sheets tetap terjaga utuh!`
      : `✓ RESET BERHASIL (Pukul ${nowResetStr}): Berhasil mereset & menghapus ${toDeleteCount} laporan nilai pada tanggal terpilih! ${remainingCount} data tersisa & Judul Nama beserta Warna 13 Kolom di Google Sheets tetap utuh.`;

    setSheetSyncStatusText(resetMsg);
    setRekapSyncBannerMsg(resetMsg);
    setPortfolioToast(resetMsg);
    setTimeout(() => {
      setPortfolioToast(null);
      setRekapSyncBannerMsg(null);
    }, 7500);
  };

  // State Fitur Ranking Kelas & Opsi Tampilan Nama (Anonim vs Nama Lengkap)
  const [isAnonymousRanking, setIsAnonymousRanking] = useState<boolean>(false);
  const [rankingClassScope, setRankingClassScope] = useState<string>('AUTO');

  // State Sortir & Efek Transisi Animasi Tabel Rekap Siswa (Terutama Kolom Ranking)
  const [rekapSortField, setRekapSortField] = useState<
    | 'DEFAULT'
    | 'RANKING'
    | 'NILAI_AKHIR'
    | 'SKOR_BENAR'
    | 'NAMA_SISWA'
    | 'KELAS'
    | 'TIMESTAMP'
    | 'LULUS'
  >('DEFAULT');
  const [rekapSortDir, setRekapSortDir] = useState<'asc' | 'desc'>('asc');
  const [classRankSortField, setClassRankSortField] = useState<
    'RANK' | 'NAMA' | 'ATTEMPTS' | 'BEST_SCORE' | 'AVG_SCORE'
  >('RANK');
  const [classRankSortDir, setClassRankSortDir] = useState<'asc' | 'desc'>('asc');
  const [rekapSortTransitionVersion, setRekapSortTransitionVersion] = useState<number>(0);
  const [isRankingColumnAnimating, setIsRankingColumnAnimating] = useState<boolean>(false);
  const prevRowOrderRef = useRef<Record<string, number>>({});
  const prevRankNumRef = useRef<Record<string, number>>({});
  const [rankMovementMap, setRankMovementMap] = useState<
    Record<string, 'UP' | 'DOWN' | 'NEW' | 'SAME'>
  >({});

  const handleToggleRekapSort = (
    field:
      | 'DEFAULT'
      | 'RANKING'
      | 'NILAI_AKHIR'
      | 'SKOR_BENAR'
      | 'NAMA_SISWA'
      | 'KELAS'
      | 'TIMESTAMP'
      | 'LULUS',
    explicitDir?: 'asc' | 'desc'
  ) => {
    if (explicitDir) {
      setRekapSortField(field);
      setRekapSortDir(explicitDir);
    } else if (rekapSortField === field) {
      if (field === 'DEFAULT') {
        setRekapSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else if (rekapSortDir === 'asc') {
        setRekapSortDir('desc');
      } else {
        setRekapSortField('DEFAULT');
        setRekapSortDir('asc');
      }
    } else {
      setRekapSortField(field);
      // Untuk Nilai Akhir & Skor Benar default desc (tertinggi dulu), untuk Ranking default asc (#1 dulu)
      setRekapSortDir(
        field === 'NILAI_AKHIR' || field === 'SKOR_BENAR' || field === 'LULUS' ? 'desc' : 'asc'
      );
    }
    setRekapSortTransitionVersion((v) => v + 1);
    setIsRankingColumnAnimating(true);
  };

  const handleToggleClassRankSort = (
    field: 'RANK' | 'NAMA' | 'ATTEMPTS' | 'BEST_SCORE' | 'AVG_SCORE'
  ) => {
    if (classRankSortField === field) {
      setClassRankSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setClassRankSortField(field);
      setClassRankSortDir(
        field === 'BEST_SCORE' || field === 'AVG_SCORE' || field === 'ATTEMPTS' ? 'desc' : 'asc'
      );
    }
    setRekapSortTransitionVersion((v) => v + 1);
    setIsRankingColumnAnimating(true);
  };

  // State Visualisasi Grafik Perkembangan Nilai dari Waktu ke Waktu (Recharts)
  const [chartViewMode, setChartViewMode] = useState<
    'AREA_TREND' | 'LINE_COMPARISON' | 'BAR_TIMELINE'
  >('AREA_TREND');
  const [chartTimeLimit, setChartTimeLimit] = useState<number>(12);
  const [chartSelectedStudent, setChartSelectedStudent] = useState<string>('ALL');

  // Optimasi Kecepatan Buka Halaman Siswa Dashboard (Progressive Rendering & Pagination)
  const [rekapVisibleLimit, setRekapVisibleLimit] = useState<number>(25);
  const [rankingVisibleLimit, setRankingVisibleLimit] = useState<number>(5);
  const [historyVisibleLimit, setHistoryVisibleLimit] = useState<number>(12);
  const [isChartsMounted, setIsChartsMounted] = useState<boolean>(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setIsChartsMounted(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (submissions.length === 0) {
      setChartSelectedStudent('ALL');
      setRankingClassScope('AUTO');
    }
  }, [submissions.length]);

  // Daftar nama siswa unik untuk tombol pintas filter cepat
  const uniqueStudents = useMemo(() => {
    const map = new Map<string, { namaSiswa: string; nisNisn: string; kelas: string; count: number }>();
    submissions.forEach((sub) => {
      const key = `${sub.namaSiswa.trim().toLowerCase()}_${sub.nisNisn.trim().toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          namaSiswa: sub.namaSiswa,
          nisNisn: sub.nisNisn,
          kelas: sub.kelas,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [submissions]);

  // Hitung nomor urut percobaan (Attempt #) per siswa secara kronologis
  const attemptNumberMap = useMemo(() => {
    const chronological = [...submissions].reverse();
    const studentCounter: Record<string, number> = {};
    const result: Record<string, number> = {};

    chronological.forEach((sub) => {
      const studentKey = `${sub.namaSiswa.trim().toLowerCase()}_${sub.nisNisn.trim().toLowerCase()}`;
      studentCounter[studentKey] = (studentCounter[studentKey] || 0) + 1;
      result[sub.id] = studentCounter[studentKey];
    });

    return result;
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const filtered = submissionsWithSyncedDevice.filter((sub) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        sub.namaSiswa.toLowerCase().includes(q) ||
        sub.nisNisn.toLowerCase().includes(q) ||
        sub.kelas.toLowerCase().includes(q) ||
        (sub.deviceInfo || '').toLowerCase().includes(q) ||
        (sub.deviceModel || '').toLowerCase().includes(q) ||
        (sub.deviceCategory || '').toLowerCase().includes(q) ||
        (sub.deviceFingerprint || '').toLowerCase().includes(q) ||
        (sub.clientIp || '').toLowerCase().includes(q);

      const matchesClass =
        selectedClassFilter === 'ALL' ||
        sub.kelas.toLowerCase().includes(selectedClassFilter.toLowerCase());

      const isPassed =
        sub.nilaiAkhir >= EXAM_INFO.kkm &&
        !sub.lulusTidakLulus.toLowerCase().includes('tidak') &&
        !sub.statusKecurangan.toLowerCase().includes('diskualifikasi');

      const matchesStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'PASSED' && isPassed) ||
        (selectedStatusFilter === 'FAILED' && !isPassed);

      // Filter Rentang Tanggal Riwayat Siswa (Mulai Tanggal s/d Sampai Tanggal)
      if (historyDateStart || historyDateEnd) {
        const parsed = parseSubmissionDate(sub);
        if (parsed.dateKey) {
          if (historyDateStart && parsed.dateKey < historyDateStart) return false;
          if (historyDateEnd && parsed.dateKey > historyDateEnd) return false;
        } else {
          return false;
        }
      }

      return matchesQuery && matchesClass && matchesStatus;
    });

    if (rekapSortField === 'DEFAULT') {
      return rekapSortDir === 'asc' ? filtered : [...filtered].reverse();
    }

    const dirMultiplier = rekapSortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const rankA =
        submissionRankMap[a.id] || submissionRankMap[getSubmissionUniqueKey(a)] || 9999;
      const rankB =
        submissionRankMap[b.id] || submissionRankMap[getSubmissionUniqueKey(b)] || 9999;

      if (rekapSortField === 'RANKING') {
        if (rankA !== rankB) return (rankA - rankB) * dirMultiplier;
        return (b.nilaiAkhir - a.nilaiAkhir) * dirMultiplier;
      }
      if (rekapSortField === 'NILAI_AKHIR') {
        if (a.nilaiAkhir !== b.nilaiAkhir) return (a.nilaiAkhir - b.nilaiAkhir) * dirMultiplier;
        return (rankA - rankB) * (rekapSortDir === 'desc' ? 1 : -1);
      }
      if (rekapSortField === 'SKOR_BENAR') {
        if (a.skorBenar !== b.skorBenar) return (a.skorBenar - b.skorBenar) * dirMultiplier;
        return (a.nilaiAkhir - b.nilaiAkhir) * dirMultiplier;
      }
      if (rekapSortField === 'NAMA_SISWA') {
        const cmp = a.namaSiswa.localeCompare(b.namaSiswa, 'id-ID', { sensitivity: 'base' });
        if (cmp !== 0) return cmp * dirMultiplier;
        return rankA - rankB;
      }
      if (rekapSortField === 'KELAS') {
        const cmp = getCleanKelas(a.kelas).localeCompare(getCleanKelas(b.kelas), 'id-ID', {
          numeric: true,
        });
        if (cmp !== 0) return cmp * dirMultiplier;
        return rankA - rankB;
      }
      if (rekapSortField === 'LULUS') {
        const passA =
          a.nilaiAkhir >= EXAM_INFO.kkm &&
          !a.lulusTidakLulus.toLowerCase().includes('tidak') &&
          !a.statusKecurangan.toLowerCase().includes('diskualifikasi')
            ? 1
            : 0;
        const passB =
          b.nilaiAkhir >= EXAM_INFO.kkm &&
          !b.lulusTidakLulus.toLowerCase().includes('tidak') &&
          !b.statusKecurangan.toLowerCase().includes('diskualifikasi')
            ? 1
            : 0;
        if (passA !== passB) return (passA - passB) * dirMultiplier;
        return (a.nilaiAkhir - b.nilaiAkhir) * dirMultiplier;
      }
      if (rekapSortField === 'TIMESTAMP') {
        const cmp = a.timestamp.localeCompare(b.timestamp, 'id-ID', { numeric: true });
        if (cmp !== 0) return cmp * dirMultiplier;
        return rankA - rankB;
      }
      return 0;
    });
  }, [
    submissionsWithSyncedDevice,
    searchQuery,
    selectedClassFilter,
    selectedStatusFilter,
    rekapSortField,
    rekapSortDir,
    submissionRankMap,
  ]);

  // Deteksi perubahan urutan baris & perubahan nomor Ranking untuk memicu efek transisi animasi kolom Ranking
  useEffect(() => {
    const nextRowOrder: Record<string, number> = {};
    const nextRankNum: Record<string, number> = {};
    const movements: Record<string, 'UP' | 'DOWN' | 'NEW' | 'SAME'> = {};
    let hasAnyChange = false;

    filteredSubmissions.forEach((sub, idx) => {
      const rankNum =
        submissionRankMap[sub.id] ||
        submissionRankMap[getSubmissionUniqueKey(sub)] ||
        idx + 1;
      nextRowOrder[sub.id] = idx;
      nextRankNum[sub.id] = rankNum;

      const prevRank = prevRankNumRef.current[sub.id];
      const prevIdx = prevRowOrderRef.current[sub.id];

      if (prevRank === undefined && Object.keys(prevRankNumRef.current).length > 0) {
        movements[sub.id] = 'NEW';
        hasAnyChange = true;
      } else if (prevRank !== undefined && prevRank !== rankNum) {
        movements[sub.id] = rankNum < prevRank ? 'UP' : 'DOWN';
        hasAnyChange = true;
      } else if (prevIdx !== undefined && prevIdx !== idx) {
        movements[sub.id] = idx < prevIdx ? 'UP' : 'DOWN';
        hasAnyChange = true;
      } else {
        movements[sub.id] = 'SAME';
      }
    });

    prevRowOrderRef.current = nextRowOrder;
    prevRankNumRef.current = nextRankNum;
    setRankMovementMap(movements);

    if (hasAnyChange) {
      setRekapSortTransitionVersion((v) => v + 1);
    }
    setIsRankingColumnAnimating(true);
    const timer = window.setTimeout(() => {
      setIsRankingColumnAnimating(false);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [
    filteredSubmissions,
    submissionRankMap,
    rekapSortField,
    rekapSortDir,
    searchQuery,
    selectedClassFilter,
    selectedStatusFilter,
  ]);

  const stats = useMemo(() => {
    const totalAttempts = filteredSubmissions.length;
    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        highestScore: 0,
        averageScore: 0,
        passedCount: 0,
        cleanIntegrityCount: 0,
        latestAttemptDate: '-',
      };
    }

    const scores = filteredSubmissions.map((s) => s.nilaiAkhir);
    const highestScore = Math.max(...scores);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalAttempts);
    const passedCount = filteredSubmissions.filter(
      (s) =>
        s.nilaiAkhir >= EXAM_INFO.kkm &&
        !s.lulusTidakLulus.toLowerCase().includes('tidak') &&
        !s.statusKecurangan.toLowerCase().includes('diskualifikasi')
    ).length;
    const cleanIntegrityCount = filteredSubmissions.filter(
      (s) => (s.violationCount || 0) === 0
    ).length;

    return {
      totalAttempts,
      highestScore,
      averageScore,
      passedCount,
      cleanIntegrityCount,
      latestAttemptDate: filteredSubmissions[0]?.timestamp || '-',
    };
  }, [filteredSubmissions]);

  // Data Grafik Recharts Urutan Kronologis dari Waktu ke Waktu untuk Visualisasi Perkembangan Nilai
  const lineChartData = useMemo(() => {
    const baseList =
      chartSelectedStudent === 'ALL'
        ? filteredSubmissions
        : filteredSubmissions.filter(
            (s) => s.namaSiswa.trim().toLowerCase() === chartSelectedStudent.trim().toLowerCase()
          );

    const limited =
      chartTimeLimit > 0 ? [...baseList].slice(0, chartTimeLimit) : [...baseList];
    const chronological = limited.reverse();

    let runningSum = 0;
    return chronological.map((sub, idx) => {
      const attemptNo = attemptNumberMap[sub.id] || idx + 1;
      const prevScore = idx > 0 ? chronological[idx - 1].nilaiAkhir : null;
      const scoreDelta = prevScore !== null ? sub.nilaiAkhir - prevScore : 0;
      runningSum += sub.nilaiAkhir;
      const rataRataKumulatif = Math.round(runningSum / (idx + 1));

      const shortName =
        sub.namaSiswa.length > 10 ? `${sub.namaSiswa.slice(0, 10)}…` : sub.namaSiswa;
      const rawParts = sub.timestamp.replace(',', '').trim().split(/\s+/);
      const datePart = rawParts[0] ? rawParts[0].slice(0, 5) : sub.timestamp.slice(0, 5);
      const timePart = rawParts[1] ? rawParts[1].slice(0, 5) : '';
      const shortDate = rawParts[0] || sub.timestamp;

      const isDisqualified =
        sub.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
        sub.statusKecurangan.toLowerCase().includes('gagal');
      const isPassed =
        !isDisqualified &&
        sub.nilaiAkhir >= EXAM_INFO.kkm &&
        !sub.lulusTidakLulus.toLowerCase().includes('tidak');

      const isSingleStudentFiltered =
        chartSelectedStudent !== 'ALL' || searchQuery.trim() !== '';

      return {
        id: sub.id,
        index: idx + 1,
        attemptNo,
        attemptLabel: isSingleStudentFiltered
          ? `#${attemptNo} (${datePart}${timePart ? ` ${timePart}` : ''})`
          : `${datePart} · ${shortName}`,
        fullTitle: `Percobaan #${attemptNo} — ${sub.namaSiswa}`,
        namaSiswa: sub.namaSiswa,
        kelas: `${getCleanKelas(sub.kelas)} (${getSemesterFromSub(sub)})`,
        timestamp: sub.timestamp,
        shortDate,
        nilaiAkhir: sub.nilaiAkhir,
        rataRataKumulatif,
        kkm: EXAM_INFO.kkm,
        skorBenarText: `${sub.skorBenar} / ${sub.totalSoal}`,
        scoreDelta,
        isPassed,
        lulusTidakLulus: sub.lulusTidakLulus,
        submissionRef: sub,
      };
    });
  }, [
    filteredSubmissions,
    attemptNumberMap,
    searchQuery,
    chartSelectedStudent,
    chartTimeLimit,
  ]);

  // Hitung metrik peningkatan skor dari percobaan pertama ke percobaan terakhir
  const improvementSummary = useMemo(() => {
    if (lineChartData.length === 0) return null;
    const scores = lineChartData.map((d) => d.nilaiAkhir);
    const firstScore = lineChartData[0].nilaiAkhir;
    const latestScore = lineChartData[lineChartData.length - 1].nilaiAkhir;
    const firstDate = lineChartData[0].shortDate;
    const latestDate = lineChartData[lineChartData.length - 1].shortDate;
    const diff = latestScore - firstScore;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const cumulativeAvg =
      lineChartData[lineChartData.length - 1]?.rataRataKumulatif || latestScore;
    const passedInTimeline = lineChartData.filter((d) => d.isPassed).length;

    return {
      firstScore,
      latestScore,
      firstDate,
      latestDate,
      diff,
      maxScore,
      minScore,
      cumulativeAvg,
      passedInTimeline,
      totalPoints: lineChartData.length,
    };
  }, [lineChartData]);

  // Helper menyamarkan nama siswa saat Mode Anonim diaktifkan
  const maskStudentName = (fullName: string, rankIndex: number, isHighlightedUser: boolean) => {
    if (!isAnonymousRanking) return fullName;
    const words = fullName.trim().split(/\s+/);
    const maskedWords = words
      .map((w) => {
        if (w.length <= 2) return `${w[0] || '*'}*`;
        return `${w[0]}${'*'.repeat(Math.min(4, w.length - 2))}${w[w.length - 1]}`;
      })
      .join(' ');
    const code = String(rankIndex + 1).padStart(2, '0');
    return isHighlightedUser
      ? `${fullName} (Anda · Peserta #${code})`
      : `Peserta Anonim #${code} (${maskedWords})`;
  };

  const maskNisNisn = (nis: string, isHighlightedUser: boolean) => {
    if (!isAnonymousRanking || isHighlightedUser) return nis;
    const clean = nis.trim();
    if (clean.length <= 3) return '***';
    return `***${clean.slice(-3)}`;
  };

  // Tentukan kelas aktif untuk Ranking Kelas (mengikuti kelas siswa yang dicari atau filter kelas)
  const effectiveRankingClass = useMemo(() => {
    if (rankingClassScope !== 'AUTO') return rankingClassScope;
    if (selectedClassFilter !== 'ALL') return selectedClassFilter;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchedSub = submissions.find(
        (s) =>
          s.namaSiswa.toLowerCase().includes(q) || s.nisNisn.toLowerCase().includes(q)
      );
      if (matchedSub) {
        return getCleanKelas(matchedSub.kelas);
      }
    }
    if (initialStudentName.trim() || initialNisNisn.trim()) {
      const matchedInitial = submissions.find(
        (s) =>
          (initialStudentName.trim() &&
            s.namaSiswa.toLowerCase() === initialStudentName.trim().toLowerCase()) ||
          (initialNisNisn.trim() &&
            s.nisNisn.toLowerCase() === initialNisNisn.trim().toLowerCase())
      );
      if (matchedInitial) {
        return getCleanKelas(matchedInitial.kelas);
      }
    }
    return 'ALL';
  }, [rankingClassScope, selectedClassFilter, searchQuery, submissions, initialStudentName, initialNisNisn]);

  // Daftar kelas unik yang memiliki data submissions untuk dropdown Ranking Kelas
  const availableRankingClasses = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => {
      const clean = getCleanKelas(s.kelas);
      if (clean) set.add(clean);
    });
    return Array.from(set).sort();
  }, [submissions]);

  // Perhitungan Ranking Kelas (Mengambil skor terbaik per siswa di kelas terkait)
  const classRankingData = useMemo(() => {
    const targetSubs = submissions.filter((s) => {
      if (effectiveRankingClass === 'ALL') return true;
      return getCleanKelas(s.kelas).toLowerCase() === effectiveRankingClass.toLowerCase();
    });

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
        bestSubmission: StudentSubmission;
      }
    >();

    targetSubs.forEach((sub) => {
      const cleanKls = getCleanKelas(sub.kelas);
      const sem = getSemesterFromSub(sub);
      const key = `${sub.namaSiswa.trim().toLowerCase()}_${sub.nisNisn.trim().toLowerCase()}_${cleanKls.toLowerCase()}`;
      const isDisqualified =
        sub.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
        sub.statusKecurangan.toLowerCase().includes('gagal');
      const subPassed =
        !isDisqualified &&
        sub.nilaiAkhir >= EXAM_INFO.kkm &&
        !sub.lulusTidakLulus.toLowerCase().includes('tidak');
      const vCount = sub.violationCount || 0;

      const existing = studentMap.get(key);
      if (!existing) {
        studentMap.set(key, {
          key,
          namaSiswa: sub.namaSiswa,
          nisNisn: sub.nisNisn,
          kelas: cleanKls,
          semester: sem,
          bestScore: sub.nilaiAkhir,
          bestSkorBenar: sub.skorBenar,
          totalSoal: sub.totalSoal,
          attemptsCount: 1,
          totalScoreSum: sub.nilaiAkhir,
          minViolationsOnBest: vCount,
          latestTimestamp: sub.timestamp,
          isPassed: subPassed,
          bestSubmission: sub,
        });
      } else {
        existing.attemptsCount += 1;
        existing.totalScoreSum += sub.nilaiAkhir;
        if (
          sub.nilaiAkhir > existing.bestScore ||
          (sub.nilaiAkhir === existing.bestScore && vCount < existing.minViolationsOnBest)
        ) {
          existing.bestScore = sub.nilaiAkhir;
          existing.bestSkorBenar = sub.skorBenar;
          existing.totalSoal = sub.totalSoal;
          existing.minViolationsOnBest = vCount;
          existing.latestTimestamp = sub.timestamp;
          existing.isPassed = existing.isPassed || subPassed;
          existing.bestSubmission = sub;
        }
      }
    });

    const sorted = Array.from(studentMap.values()).sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      if (a.minViolationsOnBest !== b.minViolationsOnBest) {
        return a.minViolationsOnBest - b.minViolationsOnBest;
      }
      const avgA = a.totalScoreSum / a.attemptsCount;
      const avgB = b.totalScoreSum / b.attemptsCount;
      return avgB - avgA;
    });

    const q = searchQuery.trim().toLowerCase();
    const initName = initialStudentName.trim().toLowerCase();
    const initNis = initialNisNisn.trim().toLowerCase();

    return sorted.map((item, idx) => {
      const avgScore = Math.round(item.totalScoreSum / item.attemptsCount);
      const isHighlightedUser = Boolean(
        (q &&
          (item.namaSiswa.toLowerCase().includes(q) ||
            item.nisNisn.toLowerCase().includes(q))) ||
          (!q &&
            ((initName && item.namaSiswa.toLowerCase() === initName) ||
              (initNis && item.nisNisn.toLowerCase() === initNis)))
      );

      return {
        ...item,
        rank: idx + 1,
        avgScore,
        isHighlightedUser,
      };
    });
  }, [submissions, effectiveRankingClass, searchQuery, initialStudentName, initialNisNisn]);

  const highlightedStudentRank = useMemo(() => {
    return classRankingData.find((r) => r.isHighlightedUser) || null;
  }, [classRankingData]);

  const sortedClassRankingData = useMemo(() => {
    const mult = classRankSortDir === 'asc' ? 1 : -1;
    return [...classRankingData].sort((a, b) => {
      if (classRankSortField === 'RANK') {
        return (a.rank - b.rank) * mult;
      }
      if (classRankSortField === 'BEST_SCORE') {
        if (a.bestScore !== b.bestScore) return (a.bestScore - b.bestScore) * mult;
        return a.rank - b.rank;
      }
      if (classRankSortField === 'AVG_SCORE') {
        if (a.avgScore !== b.avgScore) return (a.avgScore - b.avgScore) * mult;
        return a.rank - b.rank;
      }
      if (classRankSortField === 'ATTEMPTS') {
        if (a.attemptsCount !== b.attemptsCount) {
          return (a.attemptsCount - b.attemptsCount) * mult;
        }
        return a.rank - b.rank;
      }
      if (classRankSortField === 'NAMA') {
        return (
          a.namaSiswa.localeCompare(b.namaSiswa, 'id-ID', { sensitivity: 'base' }) * mult
        );
      }
      return 0;
    });
  }, [classRankingData, classRankSortField, classRankSortDir]);

  const handleDownloadCertificatePdf = (sub: StudentSubmission) => {
    const jenjang = getJenjangFromKelas(sub.kelas);
    const sem: 'Ganjil' | 'Genap' = sub.kelas.toLowerCase().includes('genap')
      ? 'Genap'
      : 'Ganjil';
    const pkgKey: ExamPackageKey = `${jenjang}_${sem}`;
    const examQs = questionBanks[pkgKey] || defaultQuestions;
    const isDisqualified =
      sub.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
      sub.statusKecurangan.toLowerCase().includes('gagal');

    const enrichedSub: StudentSubmission = {
      ...sub,
      photoUrl:
        sub.photoUrl ||
        getPhotoForStudentIdentity(sub.namaSiswa, sub.nisNisn) ||
        (!sub.id.startsWith('HIST-') ? activeHeaderPhotoUrl : '') ||
        undefined,
    };
    const pdfBlob = generateCertificatePdfBlob(enrichedSub, examQs, isDisqualified);
    const safeName = sub.namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
    triggerFileDownload(pdfBlob, `Sertifikat_ANBK_${safeName}_${sub.nilaiAkhir}.pdf`);
  };

  const handleDownloadPortfolioTablePdf = (exportAll: boolean = false) => {
    const targetList = exportAll ? submissions : filteredSubmissions;
    const pdfBlob = generateStudentHistoryPortfolioPdfBlob(
      targetList,
      attemptNumberMap,
      exportAll
        ? { searchQuery: '', selectedClass: 'ALL', selectedStatus: 'ALL' }
        : {
            searchQuery,
            selectedClass: selectedClassFilter,
            selectedStatus: selectedStatusFilter,
          }
    );
    const dateStamp = new Date().toISOString().slice(0, 10);
    const studentTag =
      !exportAll && searchQuery.trim()
        ? `_${searchQuery.trim().replace(/[^a-zA-Z0-9]/g, '_')}`
        : '';
    const filename = `Portofolio_Riwayat_Ujian_ANBK${studentTag}_${dateStamp}.pdf`;
    triggerFileDownload(pdfBlob, filename);

    setPortfolioToast(
      `Arsip Portofolio Tabel PDF (${targetList.length} riwayat ujian) berhasil diunduh sebagai "${filename}"!`
    );
    setTimeout(() => setPortfolioToast(null), 4500);
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-1.5 sm:px-3 lg:px-4 py-1 sm:py-2 space-y-1.5 sm:space-y-2">
      {/* Header Banner Siswa Dashboard — Tata Letak Profesional & Terstruktur */}
      <section className="rounded-xl border border-sky-500/40 bg-gradient-to-br from-slate-950 via-slate-900/95 to-sky-950/90 text-white p-2 sm:p-3 shadow-lg shadow-sky-950/40 space-y-2 sm:space-y-2.5 backdrop-blur-sm">
        {/* Baris 1: Judul Utama Portal & Tombol Navigasi Utama */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-1.5 sm:gap-2 pb-1.5 sm:pb-2 border-b border-white/10">
          <div className="flex items-start sm:items-center gap-1.5 sm:gap-2.5 min-w-0">
            <div className="p-0.5 sm:p-1 rounded-md bg-white/95 shadow-xs shrink-0">
              <TutWuriLogo size="sm" className="border-0 shadow-none !w-5 !h-5 sm:!w-7 sm:!h-7" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1 text-[7.5px] sm:text-[9px] font-bold uppercase tracking-widest text-amber-300">
                <History className="w-2.5 h-2.5 shrink-0" />
                <span>SISWA DASHBOARD · PORTAL RIWAYAT &amp; CAPAIAN UJIAN ANBK</span>
              </div>
              <h1 className="font-display text-[11px] sm:text-sm lg:text-base font-extrabold text-white tracking-tight leading-tight">
                Riwayat Percobaan, Nilai &amp; Sertifikat Ujian Siswa
              </h1>
              <p className="text-[8.5px] sm:text-[10px] text-slate-300 max-w-2xl leading-snug">
                Pantau seluruh riwayat pengerjaan ujian ANBK Informatika, status kelulusan KKM ({EXAM_INFO.kkm}), deteksi perangkat (Device), serta sinkronisasi otomatis 12 kolom rekapitulasi.
              </p>
            </div>
          </div>

          {/* Grid Tombol Aksi Utama yang Rapi & Sejajar */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-2 ${
              onResetAllSubmissions ? ' lg:grid-cols-4 xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-3'
            } gap-1 sm:gap-1.5 xl:w-[390px] shrink-0`}
          >
            <div className="col-span-2 sm:col-span-2 xl:col-span-2 flex items-center gap-1 w-full">
              <button
                type="button"
                onClick={() => setShowSyncDateModal(true)}
                disabled={isSyncing || isPushingToSheet}
                className={`flex-1 relative h-6 sm:h-7 px-1.5 sm:px-2 rounded-md text-[8.5px] sm:text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all duration-300 cursor-pointer whitespace-nowrap border shadow-xs hover:scale-[1.01] active:scale-[0.99] disabled:opacity-65 ${
                  isSyncing || isPushingToSheet
                    ? 'bg-amber-400 text-slate-950 border-amber-200 ring-1 ring-amber-300/60'
                    : isSyncCompletedAnimated
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-1 ring-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.65)]'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 border-emerald-300/60'
                }`}
                title="Klik untuk menyinkronkan seluruh riwayat ujian ke Link Google Sheets (Judul Nama & Warna 13 Kolom pada baris pertama Google Sheets tetap dipertahankan utuh)"
              >
                <RefreshCw
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${
                    isSyncing || isPushingToSheet ? 'animate-spin' : ''
                  }`}
                />
                <span className="truncate">
                  {isSyncing || isPushingToSheet
                    ? 'Menyinkronkan...'
                    : isSyncCompletedAnimated
                    ? '✓ Tersinkron!'
                    : 'Sinkronkan Sekarang'}
                </span>
              </button>

              {/* Indikator Visual (Ikon Status) Pengiriman ke Google Sheets */}
              <div
                className={`h-6 sm:h-7 px-1.5 sm:px-2 rounded-md text-[8px] sm:text-[9.5px] font-bold flex items-center justify-center gap-1 border transition-all whitespace-nowrap shadow-xs cursor-default shrink-0 ${
                  isSyncing || isPushingToSheet
                    ? 'bg-amber-950/80 border-amber-400/60 text-amber-200'
                    : isSyncCompletedAnimated || isSheetAutoSynced
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
                title={
                  isSyncing || isPushingToSheet
                    ? 'Status: Sedang memproses pengiriman data hasil ujian ke Link Google Sheets...'
                    : isSyncCompletedAnimated || isSheetAutoSynced
                    ? 'Status: Berhasil terkirim ke Rekap Hasil Ujian pada Google Sheets ✓'
                    : 'Status: Siap kirim otomatis ke Rekap Hasil Ujian pada Google Sheets'
                }
              >
                {isSyncing || isPushingToSheet ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 text-amber-300 animate-spin shrink-0" />
                    <span className="hidden xs:inline">Mengirim...</span>
                  </>
                ) : isSyncCompletedAnimated || isSheetAutoSynced ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-extrabold truncate">Terkirim ke Sheets ✓</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400/80 shrink-0" />
                    <span className="text-slate-300 truncate">Sheets Siap</span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStartExamForStudent()}
              className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current shrink-0" />
              <span>Mulai Ujian Baru</span>
            </button>

            {onOpenRaporSiswa && (
              <button
                type="button"
                onClick={() => onOpenRaporSiswa()}
                className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-extrabold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer whitespace-nowrap ring-1 ring-indigo-400/40"
              >
                <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-amber-300" />
                <span>Rapor Siswa (Grafik)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDownloadPortfolioTablePdf(false)}
              disabled={filteredSubmissions.length === 0}
              className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-extrabold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span>Portofolio PDF ({filteredSubmissions.length})</span>
            </button>

            <button
              type="button"
              onClick={onBackToHome}
              className="h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-bold border border-white/20 bg-white/10 hover:bg-white/15 text-white flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span>Menu Utama</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateSessionModal}
              className="relative h-6 sm:h-7 px-2 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-extrabold flex items-center justify-center gap-1 transition-all duration-300 cursor-pointer whitespace-nowrap border shadow-xs hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white border-emerald-300/50"
              title="Buat sesi ujian baru yang secara otomatis mengosongkan riwayat nilai siswa dan mereset submission sistem"
            >
              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-200 animate-pulse shrink-0" />
              <span>Buat Sesi Baru (Reset Data)</span>
            </button>

            {onResetAllSubmissions && (
              <button
                type="button"
                onClick={handleResetButtonClickWithRipple}
                className={`group relative overflow-hidden h-7 sm:h-8 px-2 sm:px-3 rounded-lg text-[9px] sm:text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all duration-200 ease-out cursor-pointer whitespace-nowrap border col-span-2 sm:col-span-2 xl:col-span-2 shadow-md hover:scale-[1.035] active:scale-[0.965] hover:shadow-[0_0_28px_rgba(244,63,94,0.75)] hover:ring-2 hover:ring-rose-400/90 ${
                  isResetSuccessActive
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                    : isSheetModalUnlocked
                    ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:via-red-500 hover:to-rose-600 text-white border-rose-300/80 shadow-[0_0_14px_rgba(244,63,94,0.4)]'
                    : 'bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 hover:from-rose-600 hover:via-rose-500 hover:to-red-600 text-white border-rose-400/70 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                }`}
                title="Reset dan hapus seluruh baris data nilai ujian siswa secara otomatis (Judul Nama & Warna 13 Kolom pada baris pertama Google Sheets tetap utuh dan tidak ikut terhapus)"
              >
                {/* Efek Hover Refleksi Shimmer Kaca Modern */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />

                {/* Gelombang Animasi Ripple Interaktif saat Diklik */}
                {resetButtonRipples.map((ripple) => (
                  <span
                    key={ripple.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 animate-ripple-spread z-0"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                      width: '120px',
                      height: '120px',
                    }}
                  />
                ))}

                {isResetSuccessActive ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0 z-10">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                    </span>
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-950 shrink-0 animate-bounce z-10" />
                    <span className="truncate z-10">
                      ✓ RESET DATA SUCCSES{resetCompletedTime ? ` (${resetCompletedTime})` : ''}
                    </span>
                    <span className="absolute -top-2 -right-1 px-1 py-0.2 rounded-full text-[7px] font-mono font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 border border-slate-950 shadow-md animate-bounce z-20">
                      RESET DATA SUCCSES ✓
                    </span>
                  </>
                ) : (
                  <>
                    {isSheetModalUnlocked ? (
                      <Unlock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-300 shrink-0 z-10 transition-transform duration-200 group-hover:scale-110" />
                    ) : (
                      <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0 z-10 transition-transform duration-200 group-hover:scale-110" />
                    )}
                    <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 z-10 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-12 text-rose-200 group-hover:text-white" />
                    <span className="truncate z-10 tracking-tight transition-colors duration-200 group-hover:text-amber-100">
                      {isSheetModalUnlocked
                        ? 'Reset Data Rekap (Judul & Warna 13 Kolom Utuh)'
                        : 'Reset Data Rekap (Judul & Warna 13 Kolom Utuh)'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>


        {/* Notifikasi Animasi Penanda Pulihkan Data Riwayat Sukses */}
        {(isRestoreCompletedAnimated || (submissions.length > 0 && restoreCompletedTime)) && (
          <div
            className={`rounded-2xl border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-500 ${
              isRestoreCompletedAnimated
                ? 'border-emerald-300 bg-gradient-to-r from-emerald-950/95 via-emerald-900/90 to-teal-950/95 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/50'
                : 'border-emerald-500/40 bg-emerald-950/70 text-emerald-200'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-emerald-500/25 border border-emerald-400/60 flex items-center justify-center shrink-0">
                {isRestoreCompletedAnimated && (
                  <span className="absolute inset-0 rounded-xl bg-emerald-400/35 animate-ping" />
                )}
                <CheckCircle2
                  className={`w-5 h-5 text-emerald-300 relative z-10 ${
                    isRestoreCompletedAnimated ? 'animate-bounce' : ''
                  }`}
                />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    ✓ PULIHKAN DATA RIWAYAT SUKSES
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-400 text-slate-950">
                    {submissions.length} DATA RIWAYAT DIPULIHKAN · PUKUL {restoreCompletedTime}
                  </span>
                </div>
                <p className="text-xs text-slate-200">
                  Seluruh data riwayat hasil ujian siswa (<strong>{submissions.length} laporan</strong>) berhasil dipulihkan oleh Guru dan tersinkronisasi kembali ke semua perangkat.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRestoreCompletedAnimated(false);
                setRestoreCompletedTime(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-emerald-200 hover:text-white shrink-0 self-end sm:self-center cursor-pointer transition-colors"
            >
              Tutup Penanda
            </button>
          </div>
        )}

        {/* Baris 2: Deteksi Otomatis Perangkat (Device) & Sinkronisasi Rekap 12 Kolom */}
        <div className="w-full">
          <div className="w-full rounded-md sm:rounded-lg border border-emerald-400/30 bg-slate-950/85 p-1.5 sm:p-2 flex flex-col justify-between gap-1 sm:gap-1.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  {activeDeviceInfo.isMobileOrTablet ? (
                    <Smartphone className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-300" />
                  ) : (
                    <Laptop className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[7px] sm:text-[8.5px] font-mono font-extrabold uppercase tracking-wider text-emerald-300">
                      AUTO-SYNC SISTEM REKAPITULASI (13 KOLOM · RANKING, DEVICE &amp; FOTO)
                    </span>
                  </div>
                  <div className="text-[9.5px] sm:text-[11.5px] font-extrabold text-white truncate">
                    {activeDeviceInfo.deviceCategory} —{' '}
                    <span className="text-amber-300">
                      {activeDeviceInfo.modelType
                        .toLowerCase()
                        .startsWith(activeDeviceInfo.brand.toLowerCase())
                        ? activeDeviceInfo.modelType
                        : `${activeDeviceInfo.brand} ${activeDeviceInfo.modelType}`}
                    </span>
                  </div>
                  <div className="text-[7.5px] sm:text-[9px] font-mono text-slate-300 truncate">
                    {isSyncing || isPushingToSheet
                      ? 'Menyinkronkan otomatis data ke Server Rekapitulasi...'
                      : sheetSyncStatusText}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleRedetectDeviceDashboard}
                  disabled={isRedetectingDevice}
                  className={`relative h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[9.5px] font-bold disabled:opacity-60 border flex items-center justify-center gap-1 shadow-xs transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isDeviceRedetectAnimated
                      ? 'bg-emerald-500 text-slate-950 border-emerald-200 ring-1 ring-emerald-400/50 scale-[1.01]'
                      : 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/50 text-sky-200'
                  }`}
                >
                  {isDeviceRedetectAnimated && !isRedetectingDevice ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                      </span>
                      <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0 animate-bounce" />
                      <span>Selesai Deteksi!</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw
                        className={`w-2.5 h-2.5 text-emerald-300 shrink-0 ${
                          isRedetectingDevice ? 'animate-spin' : ''
                        }`}
                      />
                      <span>{isRedetectingDevice ? 'Mendeteksi...' : 'Deteksi Ulang'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSyncDateModal(true)}
                  disabled={isSyncing || isPushingToSheet}
                  className={`relative h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[9.5px] font-extrabold disabled:opacity-60 flex items-center justify-center gap-1 transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap border ${
                    isSyncing || isPushingToSheet
                      ? 'bg-amber-400 text-slate-950 border-amber-200 ring-1 ring-amber-300/60'
                      : isSyncCompletedAnimated
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-1 ring-emerald-400/60 scale-[1.01]'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/50 shadow-xs'
                  }`}
                >
                  {isSyncCompletedAnimated && !(isSyncing || isPushingToSheet) ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                      </span>
                      <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0 animate-bounce" />
                      <span>
                        Selesai Sinkron! ({submissionsWithSyncedDevice.length})
                      </span>
                    </>
                  ) : (
                    <>
                      <RefreshCw
                        className={`w-2.5 h-2.5 shrink-0 ${
                          isSyncing || isPushingToSheet ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {isSyncing || isPushingToSheet
                          ? 'Menyinkronkan...'
                          : lastRekapSyncTime
                          ? `✓ Tersinkron (${submissionsWithSyncedDevice.length} · ${lastRekapSyncTime})`
                          : `Sinkronkan Data (${submissionsWithSyncedDevice.length})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Ringkasan Spesifikasi Perangkat (3 Kolom Rapi) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-1.5 text-[8.5px] sm:text-[10px]">
              <div className="rounded bg-slate-900/90 border border-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1">
                <span className="text-[7px] sm:text-[8.5px] font-mono uppercase tracking-wider text-slate-400 block">
                  Kategori &amp; Merek
                </span>
                <span className="font-mono font-bold text-emerald-300 truncate block">
                  {activeDeviceInfo.deviceCategory} · {activeDeviceInfo.brand}
                  {activeDeviceInfo.rawModelCode ? ` (${activeDeviceInfo.rawModelCode})` : ''}
                </span>
              </div>
              <div className="rounded bg-slate-900/90 border border-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1">
                <span className="text-[7px] sm:text-[8.5px] font-mono uppercase tracking-wider text-slate-400 block">
                  Sistem Operasi &amp; Browser
                </span>
                <span className="font-mono font-semibold text-sky-200 truncate block">
                  {activeDeviceInfo.osNameVersion} · {activeDeviceInfo.browserName}
                </span>
              </div>
              <div className="rounded bg-slate-900/90 border border-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1">
                <span className="text-[7px] sm:text-[8.5px] font-mono uppercase tracking-wider text-slate-400 block">
                  Layar &amp; GPU
                </span>
                <span className="font-mono font-bold text-amber-300 truncate block">
                  {activeDeviceInfo.screenResolution} · {activeDeviceInfo.gpuRenderer}
                </span>
              </div>
            </div>

            {/* Bar Pintasan Aksi Tabel Rekap */}
            <div className="pt-1 sm:pt-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-1 sm:gap-1.5">
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('ranking-siswa-top5-section');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-extrabold bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
                  <span>Ranking 5 Besar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('rekap-hasil-ujian-siswa-section');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold bg-white/10 hover:bg-white/15 border border-white/15 text-amber-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Lihat Tabel Rekap</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadRekap10ColCsv}
                  className="h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isSheetModalUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-300 shrink-0" />
                  <span>{isSheetModalUnlocked ? 'Unduh CSV (Guru Aktif)' : 'Unduh CSV (Khusus Guru)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportLocalSubmissionsJson}
                  className="h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Ekspor Laporan JSON Cadangan Data Ujian Seluruh Siswa (Mode Darurat Offline)"
                >
                  {isSheetModalUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <FileJson className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-300 shrink-0" />
                  <span>{isSheetModalUnlocked ? 'Ekspor JSON (Guru Aktif)' : 'Ekspor JSON (Darurat Guru)'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSheetModalPass('');
                  setSheetModalError(null);
                  setShowSheetConfigModal(true);
                }}
                className="h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                <span>Pengaturan Sinkronisasi (Guru)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenTeacherLogin) {
                    onOpenTeacherLogin();
                  } else {
                    setSheetModalPass('');
                    setSheetModalError(null);
                    setShowSheetConfigModal(true);
                  }
                }}
                className="h-5.5 sm:h-6.5 px-2 rounded text-[8.5px] sm:text-[10px] font-extrabold bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-800/90 hover:bg-purple-800 border border-purple-400/60 text-purple-200 inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                title="Admin / Operator Sekolah: Khusus Guru Mapel. Dilindungi Password Mode Guru agar murid tidak bisa mengakses."
              >
                <ShieldCheck className="w-2.5 h-2.5 text-purple-300 shrink-0" />
                <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                <span>Admin/Operator Sekolah</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Akses Siswa Dashboard (Nilai & Sertifikat) & Masuk Mode Guru (Dipindahkan dari Kartu Login Portal Ujian) */}
        <div className="mt-2 pt-1.5 border-t border-white/15 flex flex-nowrap items-center justify-between gap-2 text-[9px] sm:text-[10px]">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('rekap-hasil-ujian-siswa-section');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 hover:underline cursor-pointer truncate"
          >
            <History className="w-3 h-3 text-amber-300 shrink-0" />
            <span className="truncate text-amber-300">Lihat Siswa Dashboard (Nilai &amp; Sertifikat)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenTeacherLogin) {
                onOpenTeacherLogin();
              } else {
                setSheetModalPass('');
                setSheetModalError(null);
                setShowSheetConfigModal(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-950 via-slate-900 to-purple-900 border border-purple-400/60 text-[9px] sm:text-[10px] font-bold text-amber-300 hover:text-white hover:border-purple-300 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
            title="Akses Terbatas: Khusus Guru & Operator Sekolah. Wajib memasukkan Password Mode Guru agar murid tidak bisa mengakses."
          >
            <ShieldCheck className="w-3 h-3 text-purple-300 shrink-0" />
            <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            <span>Admin/Operator Sekolah (Mode Guru)</span>
          </button>
        </div>
      </section>

      {portfolioToast && (
        <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/90 text-emerald-100 px-5 py-3.5 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{portfolioToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setPortfolioToast(null)}
            className="text-emerald-300 hover:text-white text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* FITUR RAPOR SISWA & VISUALISASI GRAFIK BATANG HASIL UJIAN */}
      {/* =================================================================== */}
      {onOpenRaporSiswa && (
        <section className="rounded-lg border border-indigo-400/35 bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-900 p-1.5 sm:p-2 text-white shadow-xs relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 sm:gap-1.5 relative z-10">
            <div className="flex items-start sm:items-center gap-1.5 sm:gap-2">
              <div className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 p-0.5 shadow-xs shrink-0">
                <div className="w-full h-full rounded-[3px] bg-slate-950 flex items-center justify-center">
                  <BarChart3 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="px-1 sm:px-1.5 py-0.2 rounded-full text-[7px] sm:text-[8.5px] font-extrabold uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/50 text-indigo-300">
                    Menu Fitur Rapor Siswa
                  </span>
                  <span className="px-1 sm:px-1.5 py-0.2 rounded-full text-[7px] sm:text-[8.5px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    Visualisasi Grafik Batang
                  </span>
                  <span className="px-1 sm:px-1.5 py-0.2 rounded-full text-[7px] sm:text-[8.5px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    KKM: {EXAM_INFO.kkm}
                  </span>
                </div>
                <h3 className="text-[9.5px] sm:text-xs font-extrabold text-white tracking-wide leading-tight">
                  Rapor Siswa — Grafik Batang Hasil Ujian & Capaian Belajar Fase D
                </h3>
                <p className="text-[8px] sm:text-[10px] text-slate-300 max-w-2xl leading-snug">
                  Akses visualisasi grafik batang interaktif (fade-in), komparasi nilai terhadap standar KKM ({EXAM_INFO.kkm}), analisis penguasaan materi, dan pencetakan dokumen rapor resmi.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 shrink-0 self-start lg:self-center">
              <button
                type="button"
                onClick={() => onOpenRaporSiswa()}
                className="h-5.5 sm:h-6.5 px-2 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-extrabold bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-500 hover:from-indigo-500 hover:to-sky-400 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-amber-300" />
                <span>Buka Rapor Siswa ({filteredSubmissions.length})</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Filter & Pencarian Riwayat Siswa */}
      <section className="rounded-lg border border-sky-500/30 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 p-1.5 sm:p-2 text-white shadow-xs space-y-1 sm:space-y-1.5">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-1 sm:gap-1.5 items-end">
          <div className="col-span-2 md:col-span-6">
            <label className="block text-[7.5px] sm:text-[9.5px] font-bold text-sky-200 mb-0.5">
              Cari Nama Siswa atau Nomor Induk (NIS / NISN)
            </label>
            <div className="relative">
              <Search className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama siswa atau NIS/NISN..."
                className="w-full h-6 sm:h-7 pl-6 sm:pl-6.5 pr-2 rounded border border-white/20 bg-slate-950/80 text-white placeholder:text-slate-400 text-[9px] sm:text-[10.5px] focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>

          <div className="col-span-1 md:col-span-3">
            <label className="block text-[7.5px] sm:text-[9.5px] font-bold text-sky-200 mb-0.5">
              Filter Kelas
            </label>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="w-full h-6 sm:h-7 px-1.5 sm:px-2 rounded border border-white/20 bg-slate-950/80 text-white text-[9px] sm:text-[10.5px] font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              <option value="ALL">Semua Kelas (VII & VIII)</option>
              {['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5', ...EXAM_INFO.kelasList].map(
                (kls) => (
                  <option key={kls} value={kls}>
                    Kelas {kls}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="col-span-1 md:col-span-3">
            <label className="block text-[7.5px] sm:text-[9.5px] font-bold text-sky-200 mb-0.5">
              Status Kelulusan
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) =>
                setSelectedStatusFilter(e.target.value as 'ALL' | 'PASSED' | 'FAILED')
              }
              className="w-full h-6 sm:h-7 px-1.5 sm:px-2 rounded border border-white/20 bg-slate-950/80 text-white text-[9px] sm:text-[10.5px] font-semibold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="PASSED">Lulus Ujian (≥ {EXAM_INFO.kkm})</option>
              <option value="FAILED">Ujian Susulan (&lt; {EXAM_INFO.kkm})</option>
            </select>
          </div>
        </div>

        {/* Pintasan Filter Cepat per Siswa jika ada riwayat */}
        {uniqueStudents.length > 0 && (
          <div className="pt-1 border-t border-white/10 flex flex-wrap items-center gap-1">
            <span className="text-[7.5px] sm:text-[9px] font-bold text-sky-300 flex items-center gap-0.5 mr-0.5">
              <Filter className="w-2 h-2" />
              Pilih Cepat:
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[9.5px] font-bold transition-colors cursor-pointer ${
                searchQuery === ''
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              Semua ({submissions.length})
            </button>
            {uniqueStudents.slice(0, 8).map((st) => {
              const isSelected =
                searchQuery.toLowerCase() === st.namaSiswa.toLowerCase() ||
                (st.nisNisn && searchQuery.toLowerCase() === st.nisNisn.toLowerCase());
              return (
                <button
                  key={`${st.namaSiswa}_${st.nisNisn}`}
                  type="button"
                  onClick={() => setSearchQuery(st.namaSiswa)}
                  className={`px-1.5 py-0.2 rounded text-[8px] sm:text-[9.5px] font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500 text-white font-bold'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {st.namaSiswa} ({st.count}x)
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Banner Sesi Ujian Aktif di Siswa Dashboard */}
      <div className="rounded-lg sm:rounded-xl border border-emerald-500/40 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/80 p-2 sm:p-2.5 text-white shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[9px] sm:text-[10px]">
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-400/30">
                SESI AKTIF
              </span>
              <span className="font-extrabold text-white truncate text-[11px] sm:text-xs">
                {activeSession.sessionName}
              </span>
              <span className="text-slate-400 font-mono text-[9.5px]">
                (ID: {activeSession.sessionId.slice(0, 15)})
              </span>
              {activeSession.token && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono font-extrabold border border-amber-400/30 text-[9.5px]">
                  Token: {activeSession.token}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateSessionModal}
          className="h-6 sm:h-6.5 px-2 rounded text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border shadow-xs bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white border-emerald-300/40 shrink-0"
        >
          <Sparkles className="w-2.5 h-2.5 text-amber-200 animate-pulse shrink-0" />
          <span>Buat Sesi Baru (Guru)</span>
        </button>
      </div>

      {/* Kartu Ringkasan Statistik Riwayat Ujian Siswa (Tersinkron Rekap Hasil Ujian 10 Kolom) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2">
        <div className="rounded-lg border border-sky-500/40 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 p-1.5 sm:p-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[7px] sm:text-[9.5px] font-bold uppercase tracking-wider text-sky-300">
              Total Laporan Rekap
            </span>
            <History className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-sky-400 shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-mono font-extrabold text-white mt-0.5 tabular-nums leading-tight">
            {stats.totalAttempts} <span className="text-[8.5px] sm:text-[10.5px] font-semibold text-slate-300">Laporan</span>
          </div>
          <div className="text-[7px] sm:text-[9px] text-slate-400 mt-0.5 truncate">
            Terakhir: {stats.latestAttemptDate}
          </div>
        </div>

        <div className="rounded-lg border border-amber-400/40 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-amber-950/40 p-1.5 sm:p-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[7px] sm:text-[9.5px] font-bold uppercase tracking-wider text-amber-300">
              Nilai Akhir Tertinggi
            </span>
            <Award className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-mono font-extrabold text-amber-300 mt-0.5 tabular-nums leading-tight">
            {stats.highestScore}%
          </div>
          <div className="text-[7px] sm:text-[9px] text-slate-300 mt-0.5 truncate">
            Rata-Rata: <strong className="text-white">{stats.averageScore}%</strong> (KKM: {EXAM_INFO.kkm}%)
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/40 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-emerald-950/50 p-1.5 sm:p-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[7px] sm:text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
              Lulus / Tidak Lulus
            </span>
            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-mono font-extrabold text-emerald-300 mt-0.5 tabular-nums leading-tight">
            {stats.passedCount} / {stats.totalAttempts}
          </div>
          <div className="text-[7px] sm:text-[9px] text-slate-300 mt-0.5 truncate">
            Status:{' '}
            <strong className={stats.passedCount > 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {stats.totalAttempts === 0
                ? 'Belum Ada Data'
                : stats.passedCount > 0
                ? 'Lulus Ujian'
                : 'Tidak Lulus'}
            </strong>
          </div>
        </div>

        <div className="rounded-lg border border-sky-500/40 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-indigo-950/60 p-1.5 sm:p-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[7px] sm:text-[9.5px] font-bold uppercase tracking-wider text-sky-300">
              Status Integritas (Jujur)
            </span>
            <ShieldCheck className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-sky-400 shrink-0" />
          </div>
          <div className="text-xs sm:text-lg font-mono font-extrabold text-white mt-0.5 tabular-nums leading-tight">
            {stats.cleanIntegrityCount} <span className="text-[8.5px] sm:text-[10.5px] font-semibold text-slate-300">Sesi Jujur</span>
          </div>
          <div className="text-[7px] sm:text-[9px] text-slate-300 mt-0.5 truncate">
            Tersinkron ke Status Kecurangan
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* PANEL PERINGKAT 5 BESAR (TOP 5 SISWA NILAI TERTINGGI DARI GOOGLE SHEETS) */}
      {/* =================================================================== */}
      <motion.section
        id="peringkat-5-besar-google-sheets-panel"
        initial={{ opacity: 0, y: 20, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="animate-top5-panel-pop rounded-lg sm:rounded-xl border border-amber-400/40 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/35 p-1.5 sm:p-2.5 text-white shadow-sm space-y-1.5 sm:space-y-2"
      >
        {/* Header Panel Peringkat 5 Besar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 sm:gap-1.5 border-b border-white/10 pb-1 sm:pb-2">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[10px] text-amber-300 font-semibold">
              <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
              <span>Peringkat 5 Besar · Data Tersinkron Google Sheets</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono text-emerald-300">
                {lastRekapSyncTime
                  ? `Sinkron Pukul ${lastRekapSyncTime}`
                  : 'Real-Time Sync Aktif'}
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono text-sky-300">
                {effectiveRankingClass === 'ALL'
                  ? 'Semua Kelas (VII & VIII)'
                  : `Kelas ${effectiveRankingClass}`}
              </span>
            </div>
            <h2 className="text-[10.5px] sm:text-xs lg:text-sm font-extrabold text-white tracking-tight leading-tight">
              Peringkat 5 Besar — Siswa dengan Nilai Tertinggi
            </h2>
            <p className="text-[8px] sm:text-[10px] text-slate-300 leading-snug max-w-3xl">
              Menampilkan 5 siswa terbaik dengan perolehan nilai akhir tertinggi berdasarkan data yang disinkronkan secara otomatis dari Google Sheets Rekap Hasil Ujian. Klik kartu siswa untuk melihat rincian hasil ujian atau rapor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
            <select
              value={rankingClassScope}
              onChange={(e) => setRankingClassScope(e.target.value)}
              aria-label="Filter Kelas Peringkat 5 Besar"
              className="h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded border border-amber-400/40 bg-slate-900 text-amber-300 text-[8.5px] sm:text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              <option value="AUTO" className="bg-slate-950 text-white">
                Otomatis ({effectiveRankingClass === 'ALL' ? 'Semua Kelas' : `Kelas ${effectiveRankingClass}`})
              </option>
              <option value="ALL" className="bg-slate-950 text-white">
                Semua Kelas (VII &amp; VIII)
              </option>
              {availableRankingClasses.map((kls) => (
                <option key={kls} value={kls} className="bg-slate-950 text-white">
                  Kelas {kls}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowSyncDateModal(true)}
                disabled={isSyncing || isPushingToSheet}
                className="h-5.5 sm:h-6.5 px-2 sm:px-2.5 rounded text-[8.5px] sm:text-[10px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                title="Klik untuk menyinkronkan seluruh riwayat ujian ke Link Google Sheets"
              >
                <RefreshCw
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${
                    isSyncing || isPushingToSheet ? 'animate-spin' : ''
                  }`}
                />
                <span>{isSyncing || isPushingToSheet ? 'Menyinkronkan...' : 'Sinkron Google Sheets'}</span>
              </button>

              {/* Indikator Visual (Ikon Status) Pengiriman ke Google Sheets */}
              <div
                className={`h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[9.5px] font-bold flex items-center gap-1 border transition-all whitespace-nowrap shadow-xs cursor-default ${
                  isSyncing || isPushingToSheet
                    ? 'bg-amber-950/80 border-amber-400/60 text-amber-200'
                    : isSyncCompletedAnimated || isSheetAutoSynced
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
                title={
                  isSyncing || isPushingToSheet
                    ? 'Status: Sedang memproses pengiriman data hasil ujian ke Link Google Sheets...'
                    : isSyncCompletedAnimated || isSheetAutoSynced
                    ? 'Status: Berhasil terkirim ke Rekap Hasil Ujian pada Google Sheets ✓'
                    : 'Status: Siap kirim otomatis ke Rekap Hasil Ujian pada Google Sheets'
                }
              >
                {isSyncing || isPushingToSheet ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 animate-spin shrink-0" />
                    <span className="hidden sm:inline">Mengirim...</span>
                  </>
                ) : isSyncCompletedAnimated || isSheetAutoSynced ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 font-extrabold">Terkirim ke Sheets ✓</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400/80 shrink-0" />
                    <span className="text-slate-300">Sheets Siap</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Konten Kartu Peringkat 5 Besar dengan Animasi Pop-In */}
        {classRankingData.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5 sm:p-4 text-center space-y-1">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400/70 mx-auto" />
            <div className="text-[10px] sm:text-xs font-bold text-white">
              Belum Ada Data Peringkat 5 Besar
            </div>
            <p className="text-[8.5px] sm:text-[10px] text-slate-400 max-w-md mx-auto leading-snug">
              Daftar 5 siswa dengan nilai tertinggi akan otomatis muncul dengan animasi pop-in segera setelah data hasil ujian tersinkronisasi dari Google Sheets.
            </p>
          </div>
        ) : (
          <div
            key={`top5-pop-${effectiveRankingClass}-${classRankingData.length}-${
              classRankingData[0]?.bestScore ?? 0
            }`}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2"
          >
            {classRankingData.slice(0, 5).map((item, idx) => {
              const rank = item.rank;
              const dispName = maskStudentName(
                item.namaSiswa,
                idx,
                item.isHighlightedUser
              );
              const dispNis = maskNisNisn(item.nisNisn, item.isHighlightedUser);
              const resolvedPhoto =
                item.bestSubmission.photoUrl ||
                getPhotoForStudentIdentity(item.namaSiswa, item.nisNisn);
              const staggerClass = `ranking-stagger-${(idx % 5) + 1}`;

              const rankAccent =
                rank === 1
                  ? {
                      border: 'border-amber-400/75 bg-gradient-to-b from-amber-500/20 via-slate-900/95 to-slate-950',
                      badge: 'bg-amber-400 text-slate-950',
                      title: 'PERINGKAT #1',
                      scoreColor: 'text-amber-300',
                    }
                  : rank === 2
                  ? {
                      border: 'border-slate-300/60 bg-gradient-to-b from-slate-400/15 via-slate-900/95 to-slate-950',
                      badge: 'bg-slate-200 text-slate-950',
                      title: 'PERINGKAT #2',
                      scoreColor: 'text-slate-100',
                    }
                  : rank === 3
                  ? {
                      border: 'border-amber-600/65 bg-gradient-to-b from-amber-700/20 via-slate-900/95 to-slate-950',
                      badge: 'bg-amber-600 text-white',
                      title: 'PERINGKAT #3',
                      scoreColor: 'text-amber-400',
                    }
                  : {
                      border: 'border-sky-500/40 bg-gradient-to-b from-sky-950/45 via-slate-900/95 to-slate-950',
                      badge: 'bg-sky-500/25 text-sky-200 border border-sky-400/40',
                      title: `PERINGKAT #${rank}`,
                      scoreColor: 'text-sky-300',
                    };

              return (
                <motion.div
                  key={`top5-card-${item.key}`}
                  initial={{ opacity: 0, scale: 0.86, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 340,
                    damping: 22,
                    delay: idx * 0.065,
                  }}
                  whileHover={{ scale: 1.015, y: -2 }}
                  onClick={() => onViewSubmissionResult(item.bestSubmission)}
                  className={`animate-top5-card-pop ${staggerClass} rounded-lg border p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition-shadow hover:shadow-md ${rankAccent.border} ${
                    item.isHighlightedUser ? 'ring-1.5 ring-amber-400' : ''
                  }`}
                >
                  <div>
                    {/* Baris Atas: Nomor Peringkat & Kelas */}
                    <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 rounded font-mono text-[7px] sm:text-[8.5px] font-extrabold ${rankAccent.badge}`}
                      >
                        {rank === 1 ? (
                          <Crown className="w-2.5 h-2.5 shrink-0" />
                        ) : (
                          <Medal className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span>{rankAccent.title}</span>
                      </span>
                      <span className="text-[7px] sm:text-[9px] font-mono font-bold text-amber-300 truncate">
                        {item.kelas} · {item.semester}
                      </span>
                    </div>

                    {/* Identitas & Foto Siswa */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-6 h-6 sm:w-7.5 sm:h-7.5 rounded overflow-hidden border border-amber-400/60 bg-gradient-to-br from-sky-600 to-indigo-800 flex items-center justify-center shrink-0">
                        {resolvedPhoto ? (
                          <img
                            src={resolvedPhoto}
                            alt={dispName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-mono text-[8.5px] sm:text-[10px] font-extrabold text-white">
                            {getStudentInitials(dispName)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] sm:text-[11px] font-extrabold text-white truncate">
                          {dispName}
                        </div>
                        <div className="text-[7.5px] sm:text-[9px] font-mono text-slate-300 truncate">
                          NIS: {dispNis}
                        </div>
                        <div className="text-[7.5px] sm:text-[9px] font-mono text-emerald-300 truncate">
                          Benar: {item.bestSkorBenar}/{item.totalSoal} Soal
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bagian Bawah: Nilai Akhir & Status Lulus */}
                  <div className="mt-1 sm:mt-1.5 pt-1 sm:pt-1.5 border-t border-white/10 space-y-1">
                    <div className="flex items-end justify-between gap-1">
                      <div>
                        <span className="text-[7px] sm:text-[8px] font-mono uppercase text-slate-400 block">
                          Nilai Tertinggi
                        </span>
                        <span
                          className={`text-xs sm:text-base font-mono font-extrabold tabular-nums leading-none ${rankAccent.scoreColor}`}
                        >
                          {item.bestScore}%
                        </span>
                      </div>
                      <span
                        className={`text-[7.5px] sm:text-[9px] font-mono font-extrabold ${
                          item.isPassed ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {item.isPassed ? '✓ LULUS' : 'SUSULAN'}
                      </span>
                    </div>

                    {/* Progress Bar Visual */}
                    <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.bestScore >= 100
                            ? 'w-full'
                            : item.bestScore >= 90
                            ? 'w-11/12'
                            : item.bestScore >= 80
                            ? 'w-4/5'
                            : item.bestScore >= 75
                            ? 'w-3/4'
                            : item.bestScore >= 60
                            ? 'w-3/5'
                            : 'w-2/5'
                        } ${
                          item.isPassed
                            ? 'bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300'
                            : 'bg-gradient-to-r from-rose-500 to-amber-400'
                        }`}
                      />
                    </div>

                    <div
                      className="flex items-center justify-between gap-1 pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onViewSubmissionResult(item.bestSubmission)}
                        className="flex-1 h-5 sm:h-5.5 px-1 sm:px-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[8px] sm:text-[9px] font-bold flex items-center justify-center gap-0.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-2.5 h-2.5 text-sky-300 shrink-0" />
                        <span>Rincian</span>
                      </button>
                      {onOpenRaporSiswa && (
                        <button
                          type="button"
                          onClick={() => onOpenRaporSiswa(item.bestSubmission)}
                          className="flex-1 h-5 sm:h-5.5 px-1 sm:px-1.5 rounded bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-[8px] sm:text-[9px] font-bold flex items-center justify-center gap-0.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <BarChart3 className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                          <span>Rapor</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* =================================================================== */}
      {/* KOMPONEN RANKING SISWA — PERINGKAT 5 BESAR NILAI TERTINGGI PER KELAS */}
      {/* =================================================================== */}
      <RankingSiswa
        submissions={submissionsWithSyncedDevice}
        selectedGlobalClassFilter={selectedClassFilter}
        searchQuery={searchQuery}
        activeStudentName={activeHeaderStudentName}
        activeNisNisn={activeHeaderNisNisn}
        isAnonymous={isAnonymousRanking}
        onToggleAnonymous={() => setIsAnonymousRanking((prev) => !prev)}
        onViewSubmissionResult={onViewSubmissionResult}
        onOpenRaporSiswa={onOpenRaporSiswa}
      />

      {/* =================================================================== */}
      {/* TABEL REKAP HASIL UJIAN (SINKRON OTOMATIS 12 KOLOM + DEVICE) & RANKING KELAS */}
      {/* =================================================================== */}
      <section
        id="rekap-hasil-ujian-siswa-section"
        className="rounded-lg sm:rounded-xl border border-amber-400/35 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/90 p-1.5 sm:p-2.5 text-white shadow-sm space-y-1.5 sm:space-y-2.5"
      >
        {/* Header Rekap Hasil Ujian 12 Kolom Persis (Termasuk Kolom Device & FOTO) */}
        <div className="flex flex-col gap-1 sm:gap-1.5 border-b border-white/10 pb-1.5 sm:pb-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                <FileSpreadsheet className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                <span>SINKRONISASI OTOMATIS · REKAP HASIL UJIAN, RANKING, DEVICE &amp; FOTO (13 KOLOM PERSIS)</span>
              </div>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[7.5px] sm:text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/35">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSyncing || isPushingToSheet
                      ? 'bg-amber-300 animate-ping'
                      : isSheetAutoSynced
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-sky-400'
                  }`}
                />
                <span>
                  {isSyncing || isPushingToSheet
                    ? 'Sedang Menyinkronkan...'
                    : lastRekapSyncTime
                    ? `Tersinkron Pukul ${lastRekapSyncTime}`
                    : 'Auto-Sync Cloud & Server Aktif'}
                </span>
              </div>
            </div>

            <h2 className="text-[10.5px] sm:text-sm font-extrabold text-white flex flex-wrap items-center gap-1 sm:gap-1.5 leading-tight">
              <span>Rekap Hasil Ujian Siswa, Perangkat (Device) &amp; Foto</span>
              <span className="px-1.5 py-0.2 rounded-full text-[8px] sm:text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {filteredSubmissions.length} Laporan Tersinkron
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[8px] sm:text-[10px] font-mono font-semibold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                Perangkat Aktif: {activeDeviceInfo.deviceCategory} ({activeDeviceInfo.modelType})
              </span>
            </h2>

            <p className="text-[8px] sm:text-[9.5px] font-mono text-sky-300 leading-snug">
              Header 13 Kolom Persis: {REKAP_SHEET_HEADERS.join(', ')}
            </p>

            {/* Bar Status Sinkronisasi Real-Time & Pintasan Ekspor 13 Kolom */}
            <div className="rounded-md sm:rounded-lg border border-emerald-500/25 bg-slate-900/80 px-2 sm:px-2.5 py-1 sm:py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-1.5 text-[8.5px] sm:text-[10.5px]">
              <div className="flex items-center gap-1.5 text-emerald-300 font-mono min-w-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {isSyncing || isPushingToSheet
                    ? 'Menyinkronkan otomatis 13 kolom data rekap, ranking, perangkat & foto ke Server Rekapitulasi...'
                    : sheetSyncStatusText}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {syncQueue.stats.pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => syncQueue.forceProcessNow()}
                    disabled={syncQueue.stats.isProcessing}
                    className="h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 inline-flex items-center gap-1 transition-colors cursor-pointer animate-pulse shadow-xs disabled:opacity-60"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${syncQueue.stats.isProcessing ? 'animate-spin' : ''}`} />
                    <span>Kirim Antrean ({syncQueue.stats.pendingCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyRekap10ColTsv}
                  className={`h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold border inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    isSheetModalUnlocked
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                      : 'bg-white/10 hover:bg-white/20 border-amber-400/40 text-amber-300'
                  }`}
                >
                  {isSheetModalUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <FileText className="w-2.5 h-2.5 shrink-0" />
                  <span>
                    {copiedRekapTsv
                      ? '✓ Tersalin (13 Kolom)'
                      : isSheetModalUnlocked
                      ? 'Salin TSV 13 Kolom (Guru Aktif)'
                      : 'Salin TSV 13 Kolom (Khusus Guru)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRekap10ColCsv}
                  className={`h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold border inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    isSheetModalUnlocked
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                      : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/40 text-sky-200'
                  }`}
                >
                  {isSheetModalUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <Download className="w-2.5 h-2.5 shrink-0" />
                  <span>
                    {isSheetModalUnlocked ? 'Unduh CSV (Guru Aktif)' : 'Unduh CSV (Khusus Guru)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleExportLocalSubmissionsJson}
                  className={`h-5 sm:h-6 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold border inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    isSheetModalUnlocked
                      ? 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/50 text-purple-200'
                      : 'bg-violet-950/40 hover:bg-violet-900/50 border-violet-400/40 text-violet-300'
                  }`}
                  title="Ekspor Laporan JSON Cadangan Data Ujian Siswa (Penanganan Masalah Jaringan / Cloud)"
                >
                  {isSheetModalUnlocked ? (
                    <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <FileJson className="w-2.5 h-2.5 shrink-0" />
                  <span>
                    {isSheetModalUnlocked
                      ? 'Laporan JSON (Guru Aktif)'
                      : 'Laporan JSON (Darurat Offline)'}
                  </span>
                </button>
              </div>
            </div>

            {rekapSyncBannerMsg && (
              <div className="rounded-lg border border-emerald-400/60 bg-emerald-950/90 text-emerald-100 px-2.5 py-1.5 text-[10px] sm:text-[11px] font-bold flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{rekapSyncBannerMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRekapSyncBannerMsg(null)}
                  className="text-emerald-300 hover:text-white text-[9.5px] font-semibold shrink-0 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>

          <div
            className={`grid grid-cols-1 ${
              onResetAllSubmissions ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            } gap-1 sm:gap-1.5 w-full items-stretch`}
          >
            <button
              type="button"
              onClick={() => setShowSyncDateModal(true)}
              disabled={isSyncing || isPushingToSheet}
              className={`relative h-6.5 sm:h-7 w-full justify-center px-2 sm:px-2.5 rounded-md text-[9.5px] sm:text-[11px] font-extrabold flex items-center gap-1 transition-all duration-300 cursor-pointer whitespace-nowrap border ${
                isSyncing || isPushingToSheet
                  ? 'bg-amber-400 text-slate-950 border-amber-200 ring-1 ring-amber-300/60 shadow-xs'
                  : isSyncCompletedAnimated
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-1 ring-emerald-400/60 shadow-sm scale-[1.01]'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/50 shadow-xs'
              } disabled:opacity-75`}
            >
              {isSyncCompletedAnimated && !(isSyncing || isPushingToSheet) ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                  </span>
                  <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0 animate-bounce" />
                  <span className="truncate">
                    Selesai Sinkron! ({filteredSubmissions.length} Data · {lastRekapSyncTime})
                  </span>
                  <span className="absolute -top-2 -right-1 px-1 py-0.2 rounded-full text-[7.5px] font-mono font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 border border-slate-950 shadow-md animate-bounce">
                    SINKRON SELESAI ✓
                  </span>
                </>
              ) : (
                <>
                  <RefreshCw className={`w-3 h-3 shrink-0 ${isSyncing || isPushingToSheet ? 'animate-spin' : ''}`} />
                  <span className="truncate">
                    {isSyncing || isPushingToSheet
                      ? 'Menyinkronkan Data Rekap...'
                      : lastRekapSyncTime
                      ? `✓ Sudah Sinkron (${filteredSubmissions.length} Data · ${lastRekapSyncTime})`
                      : `Sinkron Otomatis Data Rekap (${filteredSubmissions.length})`}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSheetModalPass('');
                setSheetModalError(null);
                setShowSheetConfigModal(true);
              }}
              className="h-6.5 sm:h-7 w-full justify-center px-2 sm:px-2.5 rounded-md text-[9.5px] sm:text-[11px] font-extrabold bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-400/40 flex items-center gap-1 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              <FileSpreadsheet className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="truncate">
                {isSheetModalUnlocked ? 'Pengaturan Rekap (Guru Aktif)' : 'Pengaturan Rekap (Khusus Guru)'}
              </span>
            </button>

            {onResetAllSubmissions && (
              <button
                type="button"
                onClick={handleOpenResetModal}
                className={`relative h-7 sm:h-8 w-full justify-center px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-[11.5px] font-extrabold flex items-center gap-1.5 transition-all duration-300 cursor-pointer whitespace-nowrap border shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                  isResetSuccessActive
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.7)]'
                    : isSheetModalUnlocked
                    ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white border-rose-300/80 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                    : 'bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 hover:from-rose-600 hover:to-red-600 text-white border-rose-400/60 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                }`}
                title="Reset dan hapus seluruh baris data rekap ujian pada Google Sheets (Judul Nama & Warna 13 Kolom pada baris pertama tetap utuh dan tidak ikut terhapus)"
              >
                {isResetSuccessActive ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                    </span>
                    <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0 animate-bounce" />
                    <span className="truncate">
                      ✓ RESET DATA SUCCSES{resetCompletedTime ? ` (${resetCompletedTime})` : ''}
                    </span>
                    <span className="absolute -top-2 -right-1 px-1 py-0.2 rounded-full text-[7px] font-mono font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 border border-slate-950 shadow-md animate-bounce">
                      RESET DATA SUCCSES ✓
                    </span>
                  </>
                ) : (
                  <>
                    {isSheetModalUnlocked ? (
                      <Unlock className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                    ) : (
                      <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                    )}
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {isSheetModalUnlocked
                        ? 'Reset Data Rekap (Judul & Warna 13 Kolom Utuh)'
                        : 'Reset Data Rekap (Judul & Warna 13 Kolom Utuh)'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bar Tautan Langsung Rekap Hasil Ujian (Hanya Guru yang Bisa Akses) */}
        {isSheetModalUnlocked ? (
          <div className="rounded-lg border border-emerald-500/30 bg-slate-950/90 p-1.5 sm:p-2.5 flex flex-col md:flex-row items-stretch md:items-center gap-1.5">
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[11px] font-bold text-emerald-300 shrink-0">
              <FileSpreadsheet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
              <span>Tautan Sinkronisasi &quot;Rekap Hasil Ujian&quot; (Akses Guru):</span>
            </div>
            <input
              type="url"
              value={rekapSheetUrlDraft}
              onChange={(e) => setRekapSheetUrlDraft(e.target.value)}
              placeholder="Tempel tautan sinkronisasi Rekap Hasil Ujian..."
              className="flex-1 px-2 py-1 rounded border border-white/15 bg-slate-900/90 text-white text-[9.5px] sm:text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowSyncDateModal(true)}
                disabled={isSyncing || isPushingToSheet}
                className={`relative px-2.5 py-1 rounded text-[9.5px] sm:text-[11px] font-extrabold disabled:opacity-60 flex items-center gap-1 transition-all duration-300 cursor-pointer border ${
                  isSyncCompletedAnimated && !(isSyncing || isPushingToSheet)
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-2 ring-emerald-400/60 shadow-sm scale-[1.01]'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/50'
                }`}
              >
                {isSyncCompletedAnimated && !(isSyncing || isPushingToSheet) ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                    </span>
                    <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0 animate-bounce" />
                    <span>Selesai Sinkron! ({submissions.length} Data)</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`w-2.5 h-2.5 ${isSyncing || isPushingToSheet ? 'animate-spin' : ''}`} />
                    <span>
                      {lastRekapSyncTime
                        ? `✓ Tersinkron (${submissions.length} Data · ${lastRekapSyncTime})`
                        : `Tautkan & Sinkronkan (${submissions.length} Data)`}
                    </span>
                  </>
                )}
              </button>
              {rekapSheetUrlDraft && rekapSheetUrlDraft.startsWith('http') && (
                <a
                  href={rekapSheetUrlDraft}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded text-[9.5px] sm:text-[11px] font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-sky-300 flex items-center gap-1"
                >
                  <span>Buka Tautan</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsSheetModalUnlocked(false);
                  setSheetModalPass('');
                }}
                className="px-2 py-1 rounded text-[9.5px] sm:text-[11px] font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-2.5 h-2.5" />
                <span>Kunci</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-400/30 bg-slate-950/90 p-1.5 sm:p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-semibold text-slate-300">
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
              <span>
                Pengaturan &amp; Tautan Sinkronisasi <strong className="text-amber-300">Rekap Hasil Ujian</strong> dikunci khusus untuk Guru Mapel ({EXAM_INFO.guruMapelUpper}).
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSheetModalPass('');
                setSheetModalError(null);
                setShowSheetConfigModal(true);
              }}
              className="px-2 sm:px-2.5 py-1 rounded text-[9px] sm:text-[10.5px] font-extrabold bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 flex items-center justify-center gap-1 shrink-0 cursor-pointer"
            >
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>Buka dengan Password Guru</span>
            </button>
          </div>
        )}

        {/* Bar Kontrol Sortir & Efek Transisi Animasi Kolom Ranking */}
        <div className="rounded-lg border border-amber-400/35 bg-slate-900/90 px-2 sm:px-2.5 py-1.5 flex flex-col lg:flex-row lg:items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1 text-[9px] sm:text-[11px]">
            <span className="inline-flex items-center gap-1 font-extrabold text-amber-300 uppercase tracking-wider">
              <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Urutkan Rekap &amp; Animasi Kolom Ranking:</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full font-mono text-[8.5px] sm:text-[9.5px] font-bold border transition-all duration-300 ${
                isRankingColumnAnimating
                  ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs scale-[1.01]'
                  : 'bg-sky-500/15 text-sky-200 border-sky-400/35'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
              <span>
                {isRankingColumnAnimating
                  ? 'Transisi Ranking Aktif...'
                  : rekapSortField === 'RANKING'
                  ? `Urut Ranking (${rekapSortDir === 'asc' ? '#1 → Terbawah' : 'Terbawah → #1'})`
                  : rekapSortField === 'NILAI_AKHIR'
                  ? `Urut Nilai Akhir (${rekapSortDir === 'desc' ? 'Tertinggi' : 'Terendah'})`
                  : rekapSortField === 'SKOR_BENAR'
                  ? `Urut Skor Benar (${rekapSortDir === 'desc' ? 'Terbanyak' : 'Tersedikit'})`
                  : rekapSortField === 'NAMA_SISWA'
                  ? `Urut Nama (${rekapSortDir === 'asc' ? 'A–Z' : 'Z–A'})`
                  : rekapSortField === 'KELAS'
                  ? `Urut Kelas (${rekapSortDir === 'asc' ? 'VII → VIII' : 'VIII → VII'})`
                  : rekapSortField === 'LULUS'
                  ? `Urut Status (${rekapSortDir === 'desc' ? 'Lulus Dulu' : 'Susulan Dulu'})`
                  : 'Urutan Kronologis (Default)'}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() =>
                handleToggleRekapSort(
                  'RANKING',
                  rekapSortField === 'RANKING' && rekapSortDir === 'asc' ? 'desc' : 'asc'
                )
              }
              className={`h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-extrabold inline-flex items-center gap-1 border transition-all cursor-pointer ${
                rekapSortField === 'RANKING'
                  ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-xs scale-[1.01]'
                  : 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border-amber-400/40'
              }`}
            >
              <Trophy className="w-2.5 h-2.5 shrink-0" />
              <span>
                Sortir Ranking{' '}
                {rekapSortField === 'RANKING'
                  ? rekapSortDir === 'asc'
                    ? '(#1 ↑)'
                    : '(↓ #1)'
                  : '(#1 ↑↓)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleRekapSort('NILAI_AKHIR')}
              className={`h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold inline-flex items-center gap-1 border transition-all cursor-pointer ${
                rekapSortField === 'NILAI_AKHIR'
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200 shadow-xs'
                  : 'bg-white/10 hover:bg-white/15 text-emerald-200 border-white/15'
              }`}
            >
              <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
              <span>Nilai Akhir</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleRekapSort('NAMA_SISWA')}
              className={`h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold inline-flex items-center gap-1 border transition-all cursor-pointer ${
                rekapSortField === 'NAMA_SISWA'
                  ? 'bg-sky-400 text-slate-950 border-sky-200 shadow-xs'
                  : 'bg-white/10 hover:bg-white/15 text-sky-200 border-white/15'
              }`}
            >
              <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
              <span>Nama (A–Z)</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleRekapSort('KELAS')}
              className={`h-5.5 sm:h-6 px-1.5 sm:px-2 rounded text-[8.5px] sm:text-[10px] font-bold inline-flex items-center gap-1 border transition-all cursor-pointer ${
                rekapSortField === 'KELAS'
                  ? 'bg-indigo-400 text-slate-950 border-indigo-200 shadow-xs'
                  : 'bg-white/10 hover:bg-white/15 text-indigo-200 border-white/15'
              }`}
            >
              <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
              <span>Kelas</span>
            </button>

            {rekapSortField !== 'DEFAULT' && (
              <button
                type="button"
                onClick={() => handleToggleRekapSort('DEFAULT', 'asc')}
                className="h-5.5 sm:h-6 px-1.5 rounded text-[8.5px] sm:text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 inline-flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                <span>Reset Urutan</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Rekap Hasil Ujian 13 Kolom Persis (Termasuk Kolom Ranking di samping Lulus/Tidak Lulus, Device & FOTO) */}
        <div className="overflow-x-auto rounded-lg border border-sky-500/30 bg-slate-950/85 shadow-inner">
          <table className="w-full text-left border-collapse text-[10.5px] sm:text-[11px]">
            <thead>
              <tr className="border-b border-sky-500/30 bg-sky-950/90 text-amber-300 font-mono text-[9.5px]">
                {REKAP_SHEET_HEADERS.map((colHeader, idx) => {
                  const headerSortFieldMap: Record<
                    number,
                    | 'TIMESTAMP'
                    | 'NAMA_SISWA'
                    | 'KELAS'
                    | 'SKOR_BENAR'
                    | 'NILAI_AKHIR'
                    | 'LULUS'
                    | 'RANKING'
                    | undefined
                  > = {
                    0: 'TIMESTAMP',
                    1: 'NAMA_SISWA',
                    3: 'KELAS',
                    5: 'SKOR_BENAR',
                    7: 'NILAI_AKHIR',
                    9: 'LULUS',
                    10: 'RANKING',
                  };
                  const mappedField = headerSortFieldMap[idx];
                  const isSortedHere = mappedField && rekapSortField === mappedField;
                  const isRankingHeader = idx === 10;

                  return (
                    <th
                      key={colHeader}
                      onClick={
                        mappedField ? () => handleToggleRekapSort(mappedField) : undefined
                      }
                      title={
                        mappedField
                          ? `Klik untuk mengurutkan berdasarkan ${colHeader}`
                          : colHeader
                      }
                      className={`py-2 px-2.5 border-r border-white/10 last:border-r-0 whitespace-nowrap font-extrabold transition-colors duration-300 ${
                        (idx >= 5 && idx <= 7) || idx === 10 ? 'text-center' : ''
                      } ${
                        mappedField
                          ? 'cursor-pointer select-none hover:bg-sky-900/90'
                          : ''
                      } ${
                        isRankingHeader
                          ? isSortedHere || isRankingColumnAnimating
                            ? 'bg-amber-400/25 text-amber-200 shadow-[inset_0_0_12px_rgba(251,191,36,0.3)]'
                            : 'bg-amber-500/10 text-amber-300'
                          : isSortedHere
                          ? 'bg-sky-800/80 text-white'
                          : ''
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1 ${
                          (idx >= 5 && idx <= 7) || idx === 10 ? 'justify-center w-full' : ''
                        }`}
                      >
                        {isRankingHeader && (
                          <Trophy
                            className={`w-3 h-3 shrink-0 transition-transform duration-300 ${
                              isRankingColumnAnimating
                                ? 'text-amber-300 scale-125 animate-bounce'
                                : 'text-amber-400'
                            }`}
                          />
                        )}
                        <span>{colHeader}</span>
                        {mappedField && (
                          <span className="inline-flex items-center shrink-0">
                            {isSortedHere ? (
                              rekapSortDir === 'asc' ? (
                                <ArrowUp className="w-2.5 h-2.5 text-amber-300 animate-bounce" />
                              ) : (
                                <ArrowDown className="w-2.5 h-2.5 text-amber-300 animate-bounce" />
                              )
                            ) : (
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-mono">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-6 px-3 text-center text-slate-400 font-sans text-xs">
                    Belum ada laporan hasil ujian siswa. Setiap hasil ujian siswa beserta <strong>Ranking</strong>, <strong>Device (Jenis, Merek &amp; Tipe Perangkat)</strong>, dan <strong>FOTO</strong> akan otomatis tampil dan tersinkron ke <strong>Link Google Sheets Rekap Hasil Ujian</strong> dengan 13 kolom di atas.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredSubmissions.slice(0, rekapVisibleLimit).map((sub, subIdx) => {
                    const rankNum =
                      submissionRankMap[sub.id] ||
                      submissionRankMap[getSubmissionUniqueKey(sub)] ||
                      subIdx + 1;
                    const [
                      colTimestamp,
                      colNamaSiswa,
                      colNisNisn,
                      colKelas,
                      colSemester,
                      colSkorBenar,
                      colTotalSoal,
                      colNilaiAkhir,
                      colStatusKecurangan,
                      colLulusTidakLulus,
                      colRanking,
                      colDevice,
                      colFoto,
                    ] = formatSubmissionToRekap13ColumnsWithRank(sub, rankNum);

                    const isDisq = colStatusKecurangan.toLowerCase().includes('diskualifikasi');
                    const isPassed =
                      !isDisq &&
                      colNilaiAkhir >= EXAM_INFO.kkm &&
                      !colLulusTidakLulus.toLowerCase().includes('tidak');

                    const displayName = isAnonymousRanking
                      ? maskStudentName(colNamaSiswa, rankNum - 1, false)
                      : colNamaSiswa;
                    const displayNis = isAnonymousRanking
                      ? maskNisNisn(colNisNisn, false)
                      : colNisNisn;

                    const isMobileDev = /android|iphone|ipad|tablet|ios/i.test(
                      sub.deviceCategory || colDevice
                    );

                    const movement = rankMovementMap[sub.id] || 'SAME';

                    return (
                      <motion.tr
                        key={sub.id ? `${sub.id}-${subIdx}` : `rekap-row-${subIdx}`}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{
                          layout: {
                            type: 'spring',
                            stiffness: 380,
                            damping: 30,
                          },
                          opacity: { duration: 0.25 },
                          y: {
                            type: 'spring',
                            stiffness: 360,
                            damping: 26,
                            delay: Math.min(subIdx * 0.025, 0.25),
                          },
                          scale: { duration: 0.25 },
                        }}
                        onClick={() => onViewSubmissionResult(sub)}
                        className="animate-rekap-row-sort hover:bg-white/5 transition-colors cursor-pointer text-xs"
                      >
                        <td className="py-1.5 px-2.5 border-r border-white/5 whitespace-nowrap text-slate-300">
                          {colTimestamp}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 font-sans font-bold text-white whitespace-nowrap">
                          {displayName}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 whitespace-nowrap text-sky-300">
                          {displayNis}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 whitespace-nowrap font-bold text-amber-300">
                          {colKelas}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 whitespace-nowrap text-slate-200">
                          {colSemester}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 text-center font-bold text-emerald-300">
                          {colSkorBenar}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 text-center text-slate-300">
                          {colTotalSoal}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 border-r border-white/5 text-center font-extrabold ${
                            isPassed ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          <motion.span
                            key={`score-${sub.id || 'sub'}-${subIdx}-${colNilaiAkhir}-${rekapSortTransitionVersion}`}
                            initial={{ scale: 0.85, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                            className="inline-block"
                          >
                            {colNilaiAkhir}
                          </motion.span>
                        </td>
                        <td
                          className={`py-1.5 px-2.5 border-r border-white/5 font-sans text-[10px] ${
                            (sub.violationCount || 0) === 0 && !isDisq
                              ? 'text-emerald-300'
                              : 'text-rose-300 font-semibold'
                          }`}
                        >
                          {colStatusKecurangan}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-white/5 whitespace-nowrap font-sans">
                          <div className="flex items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                isPassed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                              }`}
                            >
                              {colLulusTidakLulus}
                            </span>
                            {!isPassed && sub.nilaiAkhir < EXAM_INFO.kkm && (
                              <span
                                title="Opsi Remedial Otomatis Tersedia (Klik untuk Membuka Hasil & Remedial)"
                                className="px-1.5 py-0.2 rounded bg-amber-400/25 border border-amber-400/50 text-[9px] font-bold text-amber-300"
                              >
                                Remedial
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`py-1.5 px-2.5 border-r border-white/5 text-center whitespace-nowrap transition-colors duration-500 ${
                            isRankingColumnAnimating ? 'animate-ranking-cell-flash' : ''
                          } ${rekapSortField === 'RANKING' ? 'bg-amber-400/10' : ''}`}
                        >
                          <motion.div
                            key={`rank-badge-${sub.id || 'sub'}-${subIdx}-${rankNum}-${rekapSortTransitionVersion}`}
                            layout
                            initial={{ scale: 0.68, y: 6, opacity: 0.25, rotate: -5 }}
                            animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 430,
                              damping: 20,
                              delay: Math.min(subIdx * 0.03, 0.28),
                            }}
                            className="inline-flex items-center justify-center gap-1"
                          >
                            <span
                              className={`animate-ranking-badge-pop inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md font-mono font-extrabold text-[11px] transition-shadow duration-300 ${
                                rankNum === 1
                                  ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.55)] ring-1 ring-amber-200'
                                  : rankNum === 2
                                  ? 'bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 text-slate-950 shadow-xs ring-1 ring-white/60'
                                  : rankNum === 3
                                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-xs ring-1 ring-amber-400/50'
                                  : 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                              }`}
                            >
                              {rankNum === 1 ? (
                                <Crown className="w-3 h-3 text-slate-950 shrink-0" />
                              ) : rankNum === 2 || rankNum === 3 ? (
                                <Medal className="w-2.5 h-2.5 shrink-0" />
                              ) : null}
                              <span>{colRanking}</span>
                              {movement === 'UP' && (
                                <span
                                  title="Posisi / Ranking Naik"
                                  className={`text-[9px] font-extrabold leading-none ${
                                    rankNum <= 3 ? 'text-emerald-950' : 'text-emerald-300'
                                  }`}
                                >
                                  ↑
                                </span>
                              )}
                              {movement === 'DOWN' && (
                                <span
                                  title="Posisi / Ranking Turun"
                                  className={`text-[9px] font-extrabold leading-none ${
                                    rankNum <= 2 ? 'text-rose-900' : 'text-rose-300'
                                  }`}
                                >
                                  ↓
                                </span>
                              )}
                              {movement === 'NEW' && (
                                <span
                                  title="Data Baru Masuk"
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"
                                />
                              )}
                            </span>
                          </motion.div>
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap font-sans">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-extrabold border ${
                                isMobileDev
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                                  : 'bg-sky-500/15 text-sky-300 border-sky-400/40'
                              }`}
                            >
                              {isMobileDev ? (
                                <Smartphone className="w-2.5 h-2.5 shrink-0" />
                              ) : (
                                <Laptop className="w-2.5 h-2.5 shrink-0" />
                              )}
                              <span>{sub.deviceCategory || 'HP Android'}</span>
                            </span>
                            <span className="font-mono font-bold text-amber-300 text-[10px]">
                              {sub.deviceModel || colDevice}
                            </span>
                            {sub.deviceOsBrowser && (
                              <span className="text-[9.5px] font-mono text-slate-400">
                                ({sub.deviceOsBrowser})
                              </span>
                            )}
                            {(sub.deviceFingerprint || sub.clientIp) && (
                              <div className="flex items-center gap-1 text-[9px] font-mono mt-0.5">
                                {sub.deviceFingerprint && (
                                  <span className="text-cyan-300 font-bold bg-cyan-950/70 border border-cyan-500/30 px-1 py-0.2 rounded">
                                    {sub.deviceFingerprint}
                                  </span>
                                )}
                                {sub.clientIp && (
                                  <span className="text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-1 py-0.2 rounded">
                                    IP: {sub.clientIp}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap font-sans border-l border-white/5">
                          {(() => {
                            const resolvedImg =
                              sub.photoUrl ||
                              getPhotoForStudentIdentity(sub.namaSiswa, sub.nisNisn) ||
                              (colFoto.startsWith('data:image/') || colFoto.startsWith('http')
                                ? colFoto
                                : '');
                            return (
                              <div className="flex items-center gap-1.5">
                                <div className="w-7 h-7 rounded-md overflow-hidden border border-amber-400/60 bg-gradient-to-br from-sky-600 to-indigo-800 flex items-center justify-center shrink-0">
                                  {resolvedImg ? (
                                    <img
                                      src={resolvedImg}
                                      alt={displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="font-mono text-[9px] font-extrabold text-white">
                                      {getStudentInitials(displayName)}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9.5px] font-mono text-emerald-300 font-bold">
                                  {resolvedImg ? '✓ Foto Tersinkron' : 'Pas Foto ANBK'}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        {filteredSubmissions.length > rekapVisibleLimit && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-300">
            <span>
              Menampilkan <strong>{rekapVisibleLimit}</strong> dari{' '}
              <strong>{filteredSubmissions.length}</strong> baris laporan rekap
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRekapVisibleLimit((prev) => prev + 50)}
                className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold cursor-pointer transition-colors"
              >
                +50 Baris Lagi
              </button>
              <button
                type="button"
                onClick={() => setRekapVisibleLimit(filteredSubmissions.length)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 font-bold cursor-pointer transition-colors"
              >
                Tampilkan Semua ({filteredSubmissions.length})
              </button>
            </div>
          </div>
        )}

        {(classRankingData.length > 0 || isResetSuccessActive) && (
          <div className="pt-1.5 sm:pt-2 border-t border-white/10 space-y-1.5 sm:space-y-2">
            {/* Header Ranking Kelas + Kontrol Filter Kelas & Toggle Mode Anonim (Ditata Sejajar Ke Bawah) */}
            <div className="flex flex-col items-stretch gap-1.5 border-b border-white/10 pb-1.5 sm:pb-2">
              <div className="flex flex-col items-start gap-0.5">
                <div className="inline-flex items-center gap-1 text-[8.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                  <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                  <span>PAPAN PERINGKAT &amp; MOTIVASI CAPAIAN SISWA</span>
                </div>
                <h2 className="text-[11px] sm:text-sm font-extrabold text-white flex flex-wrap items-center gap-1 sm:gap-1.5">
                  <span>
                    Ranking Kelas{' '}
                    {effectiveRankingClass === 'ALL'
                      ? '(Seluruh Kelas Fase D)'
                      : `Kelas ${effectiveRankingClass}`}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[8.5px] sm:text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    {classRankingData.length} Siswa Terdaftar
                  </span>
                </h2>
                <p className="text-[9px] sm:text-[10.5px] text-slate-300 leading-snug">
                  Membandingkan perolehan nilai tertinggi siswa dengan teman sekelas untuk memotivasi peningkatan belajar. Gunakan tombol <strong>Mode Anonim</strong> untuk menyamarkan nama teman sekelas.
                </p>
              </div>

              {/* Kontrol Lingkup Kelas & Tombol Toggle Tampilan Nama / Anonim (Sejajar Ke Bawah & Rapi) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-1.5 w-full">
                <div className="h-6.5 sm:h-7 flex-1 flex items-center justify-between gap-1.5 bg-slate-950/90 border border-white/15 rounded-md px-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-300 shrink-0" />
                    <span className="text-[9px] sm:text-[10.5px] font-semibold text-slate-300">Filter Kelas:</span>
                  </div>
                  <select
                    value={rankingClassScope}
                    onChange={(e) => setRankingClassScope(e.target.value)}
                    className="flex-1 text-right bg-transparent text-[9px] sm:text-[10.5px] font-extrabold text-amber-300 focus:outline-none cursor-pointer truncate"
                  >
                    <option value="AUTO" className="bg-slate-950 text-white">
                      Otomatis ({effectiveRankingClass === 'ALL' ? 'Semua Kelas' : `Kelas ${effectiveRankingClass}`})
                    </option>
                    <option value="ALL" className="bg-slate-950 text-white">
                      Semua Kelas ({submissions.length} Sesi)
                    </option>
                    {availableRankingClasses.map((kls) => (
                      <option key={kls} value={kls} className="bg-slate-950 text-white">
                        Kelas {kls}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAnonymousRanking((prev) => !prev)}
                  className={`h-6.5 sm:h-7 px-2.5 rounded-md text-[9.5px] sm:text-[10.5px] font-extrabold flex items-center justify-center gap-1 border transition-all cursor-pointer shadow-xs whitespace-nowrap ${
                    isAnonymousRanking
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900/90 text-sky-200 border-sky-400/40 hover:bg-slate-800'
                  }`}
                >
                  {isAnonymousRanking ? (
                    <>
                      <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span>Mode Anonim: AKTIF</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
                      <span>Nama Ditampilkan (Aktifkan Anonim)</span>
                    </>
                  )}
                </button>

                {onResetAllSubmissions && (
                  <button
                    type="button"
                    onClick={handleOpenResetModal}
                    className={`relative h-7 sm:h-7.5 px-3 rounded-lg text-[10px] sm:text-[11px] font-extrabold border flex items-center justify-center gap-1.5 shadow-md transition-all duration-300 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] ${
                      isResetSuccessActive
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_14px_rgba(16,185,129,0.7)]'
                        : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white border-rose-400/60 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                    }`}
                    title="Reset dan hapus seluruh laporan nilai ujian serta kosongkan link Google Sheets 13 kolom secara otomatis"
                  >
                    {isResetSuccessActive ? (
                      <>
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                        </span>
                        <CheckCircle2 className="w-3 h-3 text-slate-950 shrink-0 animate-bounce" />
                        <span>
                          ✓ RESET DATA SUCCSES{resetCompletedTime ? ` (${resetCompletedTime})` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span>Reset Semua Rapor Siswa (Google Sheets 13 Kolom Terhapus)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          {/* Kartu Sorotan Posisi Siswa yang Sedang Dicari / Login */}
          {highlightedStudentRank ? (
            <div className="rounded-lg sm:rounded-xl border border-amber-400/70 bg-gradient-to-r from-amber-500/15 via-sky-950/80 to-slate-950 p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-400 text-slate-950 font-mono font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center shrink-0 shadow-xs">
                  <span className="text-[7px] sm:text-[8px] uppercase leading-none font-bold">RANK</span>
                  <span>#{highlightedStudentRank.rank}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      POSISI PERINGKAT ANDA DI {effectiveRankingClass === 'ALL' ? 'SELURUH KELAS' : `KELAS ${effectiveRankingClass}`}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[8.5px] sm:text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      Peringkat #{highlightedStudentRank.rank} dari {classRankingData.length} Siswa
                    </span>
                  </div>
                  <h3 className="text-[11px] sm:text-sm font-extrabold text-white mt-0.5">
                    {highlightedStudentRank.namaSiswa}{' '}
                    <span className="text-[9px] sm:text-[10.5px] font-mono font-semibold text-sky-300">
                      (Kelas {highlightedStudentRank.kelas} · Skor Terbaik: {highlightedStudentRank.bestScore}%)
                    </span>
                  </h3>
                  <p className="text-[9px] sm:text-[10.5px] text-slate-200 mt-0.5">
                    {highlightedStudentRank.rank === 1
                      ? 'Luar biasa! Anda menempati Peringkat #1 Tertinggi di kelas ini. Pertahankan prestasi dan kejujuran ujian Anda!'
                      : `Terus semangat! Anda hanya terpaut ${Math.max(
                          0,
                          classRankingData[0].bestScore - highlightedStudentRank.bestScore
                        )}% dari Peringkat #1 di kelas ini.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right px-2 sm:px-2.5 py-1 rounded-lg bg-slate-950/90 border border-amber-400/40">
                  <span className="text-[7.5px] sm:text-[8.5px] uppercase tracking-wider text-slate-400 block">
                    Skor Terbaik Anda
                  </span>
                  <span className="text-sm sm:text-base font-mono font-extrabold text-amber-300">
                    {highlightedStudentRank.bestScore}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-sky-500/30 bg-sky-950/40 px-2 sm:px-3 py-1.5 text-[9px] sm:text-[10.5px] text-sky-200 flex flex-wrap items-center justify-between gap-1">
              <span>
                💡 <strong>Tips:</strong> Klik salah satu nama peserta pada tombol pintas di atas atau ketik nama/NISN Anda pada kolom pencarian untuk menyorot posisi peringkat Anda di kelas!
              </span>
              <span className="font-mono text-amber-300 font-bold">
                Mode Privasi: {isAnonymousRanking ? 'Nama Disamarkan (Anonim)' : 'Nama Lengkap Terbuka'}
              </span>
            </div>
          )}

          {/* Podium Top 3 Siswa Terbaik di Kelas */}
          {classRankingData.length >= 1 && (
            <div
              key={`podium-group-${effectiveRankingClass}-${classRankingData.length}-${isAnonymousRanking}`}
              className="grid grid-cols-1 md:grid-cols-3 gap-1.5 sm:gap-2"
            >
              {classRankingData.slice(0, 3).map((topItem, idx) => {
                const medalColors = [
                  'border-amber-400/70 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 text-amber-300',
                  'border-slate-300/60 bg-gradient-to-br from-slate-400/20 via-slate-900 to-slate-950 text-slate-200',
                  'border-amber-600/60 bg-gradient-to-br from-amber-700/20 via-slate-900 to-slate-950 text-amber-400',
                ];
                const rankLabels = ['TERBAIK #1 (EMAS)', 'TERBAIK #2 (PERAK)', 'TERBAIK #3 (PERUNGGU)'];
                const displayName = maskStudentName(
                  topItem.namaSiswa,
                  idx,
                  topItem.isHighlightedUser
                );

                return (
                  <div
                    key={topItem.key}
                    onClick={() => onViewSubmissionResult(topItem.bestSubmission)}
                    className={`animate-ranking-card-in ranking-stagger-${
                      idx + 1
                    } rounded-lg border p-2 sm:p-2.5 transition-all cursor-pointer hover:scale-[1.01] ${
                      medalColors[idx] || medalColors[2]
                    } ${topItem.isHighlightedUser ? 'ring-1.5 ring-amber-400' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[10px] font-mono font-extrabold uppercase tracking-wider">
                        <Medal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {rankLabels[idx]}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-white font-mono text-[8.5px] sm:text-[10px] font-bold">
                        Kelas {topItem.kelas}
                      </span>
                    </div>

                    <div className="text-[11px] sm:text-xs font-extrabold text-white truncate">
                      {displayName}
                    </div>
                    <div className="text-[8.5px] sm:text-[10px] font-mono text-slate-300 mt-0.5">
                      NIS/NISN: {maskNisNisn(topItem.nisNisn, topItem.isHighlightedUser)} ·{' '}
                      {topItem.attemptsCount}x Percobaan
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[7.5px] sm:text-[8.5px] uppercase text-slate-400 block">
                          Nilai Tertinggi
                        </span>
                        <span className="text-sm sm:text-base font-mono font-extrabold text-amber-300">
                          {topItem.bestScore}%
                        </span>
                        <span className="text-[8.5px] sm:text-[10px] font-mono text-slate-300 ml-1">
                          ({topItem.bestSkorBenar}/{topItem.totalSoal} Benar)
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-extrabold ${
                          topItem.isPassed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        }`}
                      >
                        {topItem.isPassed ? 'LULUS KKM' : 'BELUM LULUS'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tabel Daftar Peringkat Kelas Lengkap */}
          <div className="overflow-x-auto rounded-lg sm:rounded-xl border border-white/15 bg-slate-950/75">
            <table className="w-full text-left border-collapse text-[10px] sm:text-xs">
              <thead>
                <tr className="border-b border-white/15 bg-slate-900/95 text-sky-200 uppercase font-mono text-[9px] sm:text-[11px]">
                  <th
                    onClick={() => handleToggleClassRankSort('RANK')}
                    title="Klik untuk mengurutkan berdasarkan Peringkat"
                    className={`py-1.5 sm:py-3 px-2 sm:px-3.5 text-center w-14 sm:w-24 cursor-pointer select-none transition-colors hover:bg-slate-800 ${
                      classRankSortField === 'RANK' || isRankingColumnAnimating
                        ? 'bg-amber-400/20 text-amber-300'
                        : ''
                    }`}
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Peringkat</span>
                      {classRankSortField === 'RANK' ? (
                        classRankSortDir === 'asc' ? (
                          <ArrowUp className="w-2.5 h-2.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleClassRankSort('NAMA')}
                    title="Klik untuk mengurutkan berdasarkan Nama Siswa"
                    className="py-1.5 sm:py-3 px-2 sm:px-3.5 cursor-pointer select-none hover:bg-slate-800 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Nama Siswa {isAnonymousRanking ? '(Mode Anonim Aktif)' : ''}</span>
                      {classRankSortField === 'NAMA' ? (
                        classRankSortDir === 'asc' ? (
                          <ArrowUp className="w-2.5 h-2.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                      )}
                    </div>
                  </th>
                  <th className="py-1.5 sm:py-3 px-2 sm:px-3.5">Kelas &amp; Sem</th>
                  <th
                    onClick={() => handleToggleClassRankSort('ATTEMPTS')}
                    title="Klik untuk mengurutkan berdasarkan Jumlah Percobaan"
                    className="py-1.5 sm:py-3 px-2 sm:px-3.5 text-center cursor-pointer select-none hover:bg-slate-800 transition-colors"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span>Percobaan</span>
                      {classRankSortField === 'ATTEMPTS' ? (
                        classRankSortDir === 'asc' ? (
                          <ArrowUp className="w-2.5 h-2.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                      )}
                    </div>
                  </th>
                  <th className="py-1.5 sm:py-3 px-2 sm:px-3.5 w-36 sm:w-52">Perbandingan Skor (%)</th>
                  <th
                    onClick={() => handleToggleClassRankSort('BEST_SCORE')}
                    title="Klik untuk mengurutkan berdasarkan Nilai Terbaik"
                    className="py-1.5 sm:py-3 px-2 sm:px-3.5 text-center cursor-pointer select-none hover:bg-slate-800 transition-colors"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <span>Nilai Terbaik</span>
                      {classRankSortField === 'BEST_SCORE' ? (
                        classRankSortDir === 'asc' ? (
                          <ArrowUp className="w-2.5 h-2.5 text-amber-300" />
                        ) : (
                          <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                      )}
                    </div>
                  </th>
                  <th className="py-1.5 sm:py-3 px-2 sm:px-3.5 text-center">Status KKM</th>
                </tr>
              </thead>
              <tbody
                key={`ranking-tbody-${effectiveRankingClass}-${rankingVisibleLimit}-${isAnonymousRanking}-${classRankSortField}-${classRankSortDir}`}
                className="divide-y divide-white/10"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {sortedClassRankingData.slice(0, rankingVisibleLimit).map((item, idx) => {
                    const displayName = maskStudentName(
                      item.namaSiswa,
                      item.rank - 1,
                      item.isHighlightedUser
                    );
                    const displayNis = maskNisNisn(item.nisNisn, item.isHighlightedUser);
                    const barWidthClass =
                      item.bestScore >= 100
                        ? 'w-full'
                        : item.bestScore >= 90
                        ? 'w-11/12'
                        : item.bestScore >= 80
                        ? 'w-4/5'
                        : item.bestScore >= 75
                        ? 'w-2/3'
                        : item.bestScore >= 60
                        ? 'w-3/5'
                        : item.bestScore >= 50
                        ? 'w-1/2'
                        : item.bestScore >= 40
                        ? 'w-2/5'
                        : item.bestScore >= 30
                        ? 'w-1/3'
                        : item.bestScore >= 20
                        ? 'w-1/5'
                        : 'w-1/12';

                    return (
                      <motion.tr
                        key={item.key}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{
                          layout: { type: 'spring', stiffness: 360, damping: 28 },
                          opacity: { duration: 0.25 },
                          y: {
                            type: 'spring',
                            stiffness: 340,
                            damping: 24,
                            delay: Math.min(idx * 0.035, 0.25),
                          },
                        }}
                        onClick={() => onViewSubmissionResult(item.bestSubmission)}
                        className={`animate-ranking-row-in ranking-stagger-${
                          (idx % 5) + 1
                        } transition-colors cursor-pointer ${
                          item.isHighlightedUser
                            ? 'bg-amber-400/15 hover:bg-amber-400/25 font-semibold'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <td
                          className={`py-1.5 sm:py-3 px-2 sm:px-3.5 text-center font-mono ${
                            isRankingColumnAnimating ? 'animate-ranking-cell-flash' : ''
                          }`}
                        >
                          <motion.span
                            key={`class-rank-badge-${item.key}-${item.rank}-${rekapSortTransitionVersion}`}
                            layout
                            initial={{ scale: 0.68, rotate: -6, opacity: 0.3 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 420,
                              damping: 20,
                              delay: Math.min(idx * 0.035, 0.25),
                            }}
                            className={`animate-ranking-badge-pop inline-flex items-center justify-center gap-0.5 px-1.5 sm:px-2 h-5.5 sm:h-7 rounded-md sm:rounded-lg font-extrabold text-[10px] sm:text-xs ${
                              item.rank === 1
                                ? 'bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                                : item.rank === 2
                                ? 'bg-slate-300 text-slate-950'
                                : item.rank === 3
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 text-slate-300 border border-white/10'
                            }`}
                          >
                            {item.rank === 1 && <Crown className="w-3 h-3 shrink-0" />}
                            <span>#{item.rank}</span>
                          </motion.span>
                        </td>

                        <td className="py-1.5 sm:py-3 px-2 sm:px-3.5">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="font-bold text-white whitespace-nowrap">{displayName}</span>
                            {item.isHighlightedUser && (
                              <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[8.5px] sm:text-[10px] font-mono font-extrabold bg-amber-400 text-slate-950 whitespace-nowrap">
                                POSISI ANDA
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] sm:text-[11px] font-mono text-slate-400 whitespace-nowrap">
                            NIS/NISN: {displayNis} · Rata-rata: {item.avgScore}%
                          </div>
                        </td>

                        <td className="py-1.5 sm:py-3 px-2 sm:px-3.5 font-mono whitespace-nowrap">
                          <span className="text-amber-300 font-bold">{item.kelas}</span>
                          <span className="text-slate-400 ml-1">({item.semester})</span>
                        </td>

                        <td className="py-1.5 sm:py-3 px-2 sm:px-3.5 text-center font-mono text-slate-300">
                          {item.attemptsCount}x
                        </td>

                        <td className="py-1.5 sm:py-3 px-2 sm:px-3.5">
                          <div className="w-full h-2 sm:h-2.5 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-white/10">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barWidthClass} ${
                                item.isPassed
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-300'
                                  : 'bg-gradient-to-r from-rose-500 to-amber-400'
                              }`}
                            />
                          </div>
                        </td>

                        <td className="py-1.5 sm:py-3 px-2 sm:px-3.5 text-center font-mono whitespace-nowrap">
                          <span
                            className={`text-xs sm:text-sm font-extrabold ${
                              item.isPassed ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {item.bestScore}%
                          </span>
                          <span className="block text-[8.5px] sm:text-[10px] text-slate-400">
                            {item.bestSkorBenar}/{item.totalSoal} Soal
                          </span>
                        </td>

                        <td className="py-1.5 sm:py-3 px-2 sm:px-3.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9.5px] sm:text-[11px] font-extrabold ${
                              item.isPassed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            }`}
                          >
                            {item.isPassed ? (
                              <>
                                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                Lulus
                              </>
                            ) : (
                              <>
                                <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                Susulan
                              </>
                            )}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          {classRankingData.length > rankingVisibleLimit && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-300">
              <span>
                Menampilkan peringkat <strong>1–{rankingVisibleLimit}</strong> dari{' '}
                <strong>{classRankingData.length}</strong> siswa
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRankingVisibleLimit((prev) => prev + 50)}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold cursor-pointer transition-colors"
                >
                  +50 Peringkat Lagi
                </button>
                <button
                  type="button"
                  onClick={() => setRankingVisibleLimit(classRankingData.length)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 font-bold cursor-pointer transition-colors"
                >
                  Tampilkan Semua ({classRankingData.length} Siswa)
                </button>
              </div>
            </div>
          )}
          </div>
        )}
      </section>

      {/* Visualisasi Data Perkembangan Nilai Ujian dari Waktu ke Waktu (Recharts) */}
      <section className="rounded-lg sm:rounded-xl border border-sky-500/30 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 p-1.5 sm:p-2.5 text-white shadow-sm space-y-1.5 sm:space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1 sm:gap-1.5 border-b border-white/10 pb-1 sm:pb-1.5">
          <div className="space-y-0.5 min-w-0">
            <div className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-amber-300">
              <TrendingUp className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span>ANALITIK TIME-SERIES · VISUALISASI DATA RECHARTS</span>
            </div>
            <h2 className="text-[10.5px] sm:text-xs font-extrabold text-white leading-tight">
              Grafik Perkembangan Nilai Ujian Siswa dari Waktu ke Waktu (KKM = {EXAM_INFO.kkm}%)
            </h2>
            <p className="text-[8.5px] sm:text-[10px] text-slate-300 leading-snug max-w-2xl">
              Pantau kurva progres nilai akhir, tren rata-rata kumulatif, dan pencapaian KKM ({EXAM_INFO.kkm}%) secara kronologis dari sesi pertama hingga terbaru.
            </p>
          </div>

          {/* Kontrol Interaktif Visualisasi Recharts (Kompak & Rapi) */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
            {/* 1. Filter Fokus Siswa pada Grafik */}
            <div className="h-6 sm:h-7 flex items-center justify-between gap-1 bg-slate-950/90 border border-white/15 rounded-md px-1.5 sm:px-2">
              <UserCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-300 shrink-0" />
              <span className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-300">Peserta:</span>
              <select
                value={chartSelectedStudent}
                onChange={(e) => setChartSelectedStudent(e.target.value)}
                className="bg-transparent text-[9.5px] sm:text-[10.5px] font-extrabold text-amber-300 focus:outline-none cursor-pointer max-w-[115px] sm:max-w-[140px] truncate"
              >
                <option value="ALL" className="bg-slate-950 text-white">
                  Semua ({filteredSubmissions.length})
                </option>
                {uniqueStudents.map((st) => (
                  <option
                    key={`${st.namaSiswa}_${st.nisNisn}`}
                    value={st.namaSiswa}
                    className="bg-slate-950 text-white"
                  >
                    {st.namaSiswa} ({st.count}x)
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Pilihan Rentang Sesi Waktu */}
            <div className="inline-flex items-center gap-0.5 bg-slate-950/90 border border-white/15 rounded-md p-0.5">
              {[
                { label: '12 Sesi', value: 12 },
                { label: '25 Sesi', value: 25 },
                { label: 'Semua', value: 0 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChartTimeLimit(opt.value)}
                  className={`py-0.5 px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${
                    chartTimeLimit === opt.value
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 3. Pilihan Mode Visualisasi Recharts */}
            <div className="inline-flex items-center gap-0.5 bg-slate-950/90 border border-white/15 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setChartViewMode('AREA_TREND')}
                className={`py-0.5 px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${
                  chartViewMode === 'AREA_TREND'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Area &amp; Tren
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('LINE_COMPARISON')}
                className={`py-0.5 px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${
                  chartViewMode === 'LINE_COMPARISON'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Garis Waktu
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('BAR_TIMELINE')}
                className={`py-0.5 px-1.5 sm:px-2 rounded text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer ${
                  chartViewMode === 'BAR_TIMELINE'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Batang
              </button>
            </div>
          </div>
        </div>

        {lineChartData.length === 0 ? (
          <div className="p-3 sm:p-4 rounded-lg border border-white/10 bg-slate-950/70 text-center space-y-1">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 mx-auto opacity-80" />
            <div className="text-[11px] sm:text-xs font-bold text-white">
              Belum Ada Data Grafik Perkembangan Nilai
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 max-w-md mx-auto">
              Grafik Recharts akan otomatis menampilkan kurva perkembangan nilai ujian dari waktu ke waktu setelah siswa menyelesaikan sesi ujian.
            </p>
          </div>
        ) : (
          <>
            {/* Ringkasan Metrik Perkembangan Waktu ke Waktu */}
            {improvementSummary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                  <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                    Perubahan Nilai (Awal → Terbaru)
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xs sm:text-sm font-mono font-extrabold text-white tabular-nums">
                      {improvementSummary.firstScore}% → {improvementSummary.latestScore}%
                    </span>
                    <span
                      className={`text-[9.5px] sm:text-[10.5px] font-mono font-bold ${
                        improvementSummary.diff > 0
                          ? 'text-emerald-400'
                          : improvementSummary.diff < 0
                          ? 'text-rose-400'
                          : 'text-sky-300'
                      }`}
                    >
                      ({improvementSummary.diff >= 0 ? `+${improvementSummary.diff}%` : `${improvementSummary.diff}%`})
                    </span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono block truncate">
                    {improvementSummary.firstDate} s/d {improvementSummary.latestDate}
                  </span>
                </div>

                <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                  <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                    Rata-Rata Kumulatif
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xs sm:text-sm font-mono font-extrabold text-sky-300 tabular-nums">
                      {improvementSummary.cumulativeAvg}%
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                      (KKM: {EXAM_INFO.kkm}%)
                    </span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 block">
                    Dari {improvementSummary.totalPoints} titik waktu
                  </span>
                </div>

                <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                  <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                    Rentang Capaian Skor
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-300 tabular-nums">
                      Maks: {improvementSummary.maxScore}%
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400">·</span>
                    <span className="text-[9.5px] sm:text-[10.5px] font-bold text-rose-300 tabular-nums">
                      Min: {improvementSummary.minScore}%
                    </span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 block">
                    Rentang: {improvementSummary.maxScore - improvementSummary.minScore}%
                  </span>
                </div>

                <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                  <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                    Status Tren &amp; Kelulusan KKM
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span
                      className={`text-[10px] sm:text-[11px] font-extrabold ${
                        improvementSummary.diff > 0
                          ? 'text-emerald-300'
                          : improvementSummary.diff < 0
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {improvementSummary.totalPoints < 2
                        ? 'Data Awal (1 Sesi)'
                        : improvementSummary.diff > 0
                        ? 'Tren Meningkat Positif'
                        : improvementSummary.diff < 0
                        ? 'Tren Menurun (Evaluasi)'
                        : 'Tren Stabil Konsisten'}
                    </span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono block">
                    Lulus: {improvementSummary.passedInTimeline}/{improvementSummary.totalPoints} sesi
                  </span>
                </div>
              </div>
            )}

            {/* Kanvas Utama Recharts Perkembangan Nilai dari Waktu ke Waktu */}
            <div className="w-full h-32 sm:h-40 rounded-lg border border-white/10 bg-slate-950/85 p-1 sm:p-1.5">
              {isChartsMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartViewMode === 'LINE_COMPARISON' ? (
                  <LineChart
                    data={lineChartData}
                    margin={{ top: 14, right: 24, left: -10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
                    <XAxis
                      dataKey="attemptLabel"
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                      tickLine={{ stroke: '#475569' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-sky-400/40 bg-slate-950/95 p-3.5 shadow-xl text-xs space-y-1.5 text-white">
                            <div className="font-extrabold text-amber-300">{data.fullTitle}</div>
                            <div className="text-[11px] text-slate-300">
                              Waktu: <strong className="text-white font-mono">{data.timestamp}</strong>
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Kelas: <strong className="text-white">{data.kelas}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-white/10">
                              <span className="text-slate-300">Nilai Akhir Ujian:</span>
                              <span
                                className={`font-mono font-extrabold text-sm ${
                                  data.isPassed ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {data.nilaiAkhir}% ({data.skorBenarText} Soal)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Rata-Rata Kumulatif:</span>
                              <span className="font-mono font-bold text-amber-300">
                                {data.rataRataKumulatif}%
                              </span>
                            </div>
                            {data.index > 1 && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-300">Perubahan dari Sesi Sebelumnya:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    data.scoreDelta > 0
                                      ? 'text-emerald-300'
                                      : data.scoreDelta < 0
                                      ? 'text-rose-300'
                                      : 'text-sky-300'
                                  }`}
                                >
                                  {data.scoreDelta >= 0 ? `+${data.scoreDelta}%` : `${data.scoreDelta}%`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      wrapperStyle={{ fontSize: '11px', color: '#e2e8f0' }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#fbbf24"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        position: 'insideTopRight',
                        fill: '#fde047',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="nilaiAkhir"
                      name="Nilai Ujian (%)"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      activeDot={{
                        r: 7,
                        fill: '#fbbf24',
                        stroke: '#0f172a',
                        strokeWidth: 2,
                        onClick: (_: any, eventData: any) => {
                          if (eventData?.payload?.submissionRef) {
                            onViewSubmissionResult(eventData.payload.submissionRef);
                          }
                        },
                      }}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (cx === undefined || cy === undefined) return <g key="empty" />;
                        return (
                          <circle
                            key={`dot-${payload.id}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={payload.isPassed ? '#10b981' : '#f43f5e'}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rataRataKumulatif"
                      name="Rata-Rata Kumulatif (%)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#f59e0b' }}
                    />
                  </LineChart>
                ) : chartViewMode === 'BAR_TIMELINE' ? (
                  <ComposedChart
                    data={lineChartData}
                    margin={{ top: 14, right: 24, left: -10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
                    <XAxis
                      dataKey="attemptLabel"
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                      tickLine={{ stroke: '#475569' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-sky-400/40 bg-slate-950/95 p-3.5 shadow-xl text-xs space-y-1.5 text-white">
                            <div className="font-extrabold text-amber-300">{data.fullTitle}</div>
                            <div className="text-[11px] text-slate-300">
                              Waktu: <strong className="text-white font-mono">{data.timestamp}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-white/10">
                              <span className="text-slate-300">Nilai Akhir:</span>
                              <span
                                className={`font-mono font-extrabold text-sm ${
                                  data.isPassed ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {data.nilaiAkhir}% ({data.skorBenarText} Soal)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Rata-Rata Kumulatif:</span>
                              <span className="font-mono font-bold text-amber-300">
                                {data.rataRataKumulatif}%
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      wrapperStyle={{ fontSize: '11px', color: '#e2e8f0' }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#fbbf24"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        position: 'insideTopRight',
                        fill: '#fde047',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                    <Bar
                      dataKey="nilaiAkhir"
                      name="Nilai Ujian (%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={38}
                    >
                      {lineChartData.map((entry) => (
                        <Cell
                          key={`cell-${entry.id}`}
                          fill={entry.isPassed ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="rataRataKumulatif"
                      name="Tren Rata-Rata Kumulatif (%)"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1.5 }}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={lineChartData}
                    margin={{ top: 14, right: 24, left: -10, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="scoreTimeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.42} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
                    <XAxis
                      dataKey="attemptLabel"
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                      tickLine={{ stroke: '#475569' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      stroke="#94a3b8"
                      tick={{ fill: '#cbd5e1', fontSize: 11 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-sky-400/40 bg-slate-950/95 p-3.5 shadow-xl text-xs space-y-1.5 text-white">
                            <div className="font-extrabold text-amber-300">{data.fullTitle}</div>
                            <div className="text-[11px] text-slate-300">
                              Waktu: <strong className="text-white font-mono">{data.timestamp}</strong>
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Kelas: <strong className="text-white">{data.kelas}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-white/10">
                              <span className="text-slate-300">Nilai Akhir:</span>
                              <span
                                className={`font-mono font-extrabold text-sm ${
                                  data.isPassed ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {data.nilaiAkhir}% ({data.skorBenarText} Soal)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Rata-Rata Kumulatif:</span>
                              <span className="font-mono font-bold text-amber-300">
                                {data.rataRataKumulatif}%
                              </span>
                            </div>
                            {data.index > 1 && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-300">Selisih dari Sesi Sebelumnya:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    data.scoreDelta > 0
                                      ? 'text-emerald-300'
                                      : data.scoreDelta < 0
                                      ? 'text-rose-300'
                                      : 'text-sky-300'
                                  }`}
                                >
                                  {data.scoreDelta >= 0 ? `+${data.scoreDelta}%` : `${data.scoreDelta}%`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      wrapperStyle={{ fontSize: '11px', color: '#e2e8f0' }}
                    />
                    <ReferenceLine
                      y={EXAM_INFO.kkm}
                      stroke="#fbbf24"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      label={{
                        value: `KKM ${EXAM_INFO.kkm}%`,
                        position: 'insideTopRight',
                        fill: '#fde047',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="nilaiAkhir"
                      name="Kurva Nilai Akhir (%)"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#scoreTimeAreaGrad)"
                      activeDot={{
                        r: 7,
                        fill: '#fbbf24',
                        stroke: '#0f172a',
                        strokeWidth: 2,
                      }}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (cx === undefined || cy === undefined) return <g key="empty" />;
                        return (
                          <circle
                            key={`dot-${payload.id}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={payload.isPassed ? '#10b981' : '#f43f5e'}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rataRataKumulatif"
                      name="Rata-Rata Kumulatif (%)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#f59e0b' }}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                  Memuat visualisasi grafik...
                </div>
              )}
            </div>

            {/* Kartu Kronologis Sesi dari Waktu ke Waktu */}
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 sm:gap-2 pt-0.5 items-end">
              {lineChartData.slice(-10).map((item, itemIdx) => {
                const sub = item.submissionRef;
                return (
                  <div
                    key={sub.id ? `${sub.id}-${item.attemptNo || itemIdx}` : `chart-sub-${item.attemptNo || itemIdx}`}
                    onClick={() => onViewSubmissionResult(sub)}
                    className="p-1.5 sm:p-2 rounded-lg border border-white/10 bg-slate-900/80 hover:border-sky-400/60 transition-all cursor-pointer flex flex-col items-center text-center space-y-0.5 sm:space-y-1"
                  >
                    <span className="text-[8.5px] sm:text-[9px] font-mono font-bold text-amber-300">
                      #{item.attemptNo}
                    </span>
                    <div className="w-full h-9 sm:h-12 rounded-md bg-slate-950 border border-white/10 flex flex-col justify-end p-0.5 overflow-hidden">
                      <div
                        className={`w-full rounded-xs transition-all ${
                          item.isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ height: `${Math.max(12, sub.nilaiAkhir)}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10.5px] sm:text-xs font-mono font-extrabold tabular-nums leading-none ${
                        item.isPassed ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {sub.nilaiAkhir}%
                    </span>
                    <span className="text-[8.5px] sm:text-[9.5px] text-slate-300 truncate w-full">
                      {sub.namaSiswa}
                    </span>
                    <span className="text-[8px] sm:text-[8.5px] text-slate-400 font-mono truncate w-full">
                      {item.shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* =================================================================== */}
      {/* GRAFIK RIWAYAT PENGGUNAAN BATERAI SESI UJIAN (RECHARTS) */}
      {/* =================================================================== */}
      {(() => {
        const activeBatteryPoints: BatteryHistoryPoint[] =
          batteryHistory && batteryHistory.length > 0
            ? batteryHistory
            : [
                {
                  timestamp: new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  elapsedLabel: '00:00 (Awal Sesi)',
                  elapsedSeconds: 0,
                  level: batteryState.level,
                  charging: batteryState.charging,
                  questionNumber: 1,
                  eventNote: 'Inisialisasi Sesi Ujian',
                },
              ];

        const firstPt = activeBatteryPoints[0];
        const lastPt = activeBatteryPoints[activeBatteryPoints.length - 1];
        const currentLvl = batteryState.supported ? batteryState.level : lastPt.level;
        const isChargingNow = batteryState.supported ? batteryState.charging : lastPt.charging;
        const deltaLevel = currentLvl - firstPt.level;
        const levels = activeBatteryPoints.map((p) => p.level);
        const maxBattery = Math.max(...levels, currentLvl);
        const minBattery = Math.min(...levels, currentLvl);
        const isLowPower = !isChargingNow && currentLvl <= 20;
        const isCriticalPower = !isChargingNow && currentLvl < 15;

        const chartBatteryData = activeBatteryPoints.map((pt, idx) => {
          const prevLvl = idx > 0 ? activeBatteryPoints[idx - 1].level : pt.level;
          return {
            ...pt,
            stepIndex: idx + 1,
            deltaFromPrev: pt.level - prevLvl,
            safeThreshold: 20,
          };
        });

        return (
          <section className="rounded-lg sm:rounded-xl border border-emerald-500/30 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-emerald-950/75 p-1.5 sm:p-2.5 text-white shadow-sm space-y-1.5 sm:space-y-2">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1 sm:gap-1.5 border-b border-white/10 pb-1 sm:pb-1.5">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                  {isChargingNow ? (
                    <BatteryCharging className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  ) : isCriticalPower ? (
                    <BatteryWarning className="w-2.5 h-2.5 text-rose-400 animate-bounce" />
                  ) : isLowPower ? (
                    <BatteryWarning className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                  ) : (
                    <Battery className="w-2.5 h-2.5 text-emerald-400" />
                  )}
                  <span>TELEMETRI DAYA PERANGKAT · VISUALISASI RECHARTS SESI UJIAN</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <h2 className="text-[10.5px] sm:text-xs font-extrabold text-white">
                    Grafik Riwayat Penggunaan Baterai Sesi Ujian Saat Ini
                  </h2>
                  <span
                    role="status"
                    aria-live={isCriticalPower ? 'assertive' : 'polite'}
                    className={`px-1.5 py-0.2 rounded-full text-[8.5px] sm:text-[9.5px] font-mono font-bold border inline-flex items-center gap-1 transition-all ${
                      isChargingNow
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : isCriticalPower
                        ? 'bg-rose-600 text-white border-rose-200 ring-1 ring-rose-400 animate-pulse animate-battery-indicator-critical-pulse'
                        : isLowPower
                        ? 'bg-amber-500/25 text-amber-200 border-amber-300 animate-pulse'
                        : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                    }`}
                  >
                    {isCriticalPower && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-200" />
                      </span>
                    )}
                    <span>
                      {currentLvl}% ·{' '}
                      {isChargingNow
                        ? 'Mengisi Daya (Charger)'
                        : isCriticalPower
                        ? 'BATERAI KRITIS (< 15%)'
                        : 'Mode Baterai'}
                    </span>
                  </span>
                </div>
                <p className="text-[8.5px] sm:text-[10px] text-slate-300 leading-snug">
                  Memantau tren persentase baterai perangkat selama sesi ujian berlangsung untuk memastikan perangkat tetap stabil hingga pengumpulan jawaban selesai.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {onRecordBatterySample && (
                  <button
                    type="button"
                    onClick={onRecordBatterySample}
                    className="h-6 sm:h-6.5 px-2 rounded text-[9px] sm:text-[10px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Zap className="w-2.5 h-2.5 shrink-0" />
                    <span>Catat Sampel Daya ({currentLvl}%)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Banner Peringatan Baterai Lemah / Kritis Berdenyut (Pulse) */}
            {isLowPower && (
              <div
                role="alert"
                aria-live="assertive"
                className={`rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 border flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold animate-pulse ${
                  isCriticalPower
                    ? 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 border-rose-300 text-white ring-2 ring-rose-400/80 animate-battery-critical-pulse'
                    : 'bg-gradient-to-r from-amber-600/35 via-amber-500/25 to-rose-600/30 border-amber-400 text-amber-100 ring-1 ring-amber-400/70 animate-battery-low-pulse'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-90 ${
                        isCriticalPower ? 'bg-white' : 'bg-amber-300'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isCriticalPower ? 'bg-rose-200' : 'bg-amber-400'
                      }`}
                    />
                  </span>
                  <BatteryWarning
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 animate-bounce ${
                      isCriticalPower ? 'text-white' : 'text-amber-300'
                    }`}
                  />
                  <span>
                    <strong className="uppercase tracking-wide">
                      {isCriticalPower
                        ? `⚡ BATERAI KRITIS (${currentLvl}%):`
                        : `⚠️ Peringatan Baterai Lemah (${currentLvl}%):`}
                    </strong>{' '}
                    Daya baterai perangkat mencapai tingkat kritis. Segera hubungkan pengisi daya (charger) sebelum melanjutkan ujian.
                  </span>
                </div>
                <span className="px-1.5 sm:px-2 py-0.5 rounded bg-black/30 border border-white/20 font-mono text-[9px] sm:text-[10px] font-extrabold text-white shrink-0">
                  PASANG CHARGER SEKARANG
                </span>
              </div>
            )}

            {/* Ringkasan KPI Penggunaan Baterai Sesi Ujian */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
              <div
                className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                  isCriticalPower
                    ? 'bg-rose-950/90 border-rose-400 ring-2 ring-rose-500/70 animate-pulse animate-battery-indicator-critical-pulse'
                    : 'bg-slate-950/80 border-white/10'
                }`}
              >
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                  Level Baterai Saat Ini
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span
                    className={`text-xs sm:text-sm font-mono font-extrabold tabular-nums ${
                      isCriticalPower
                        ? 'text-white'
                        : isLowPower
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentLvl}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-300">
                    ({isChargingNow ? 'Charger' : isCriticalPower ? 'KRITIS!' : 'Baterai'})
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono block">
                  Pembaruan: {lastPt.timestamp}
                </span>
              </div>

              <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                  Perubahan Daya Sesi (Awal → Saat Ini)
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xs sm:text-sm font-mono font-extrabold text-white tabular-nums">
                    {firstPt.level}% → {currentLvl}%
                  </span>
                  <span
                    className={`text-[9.5px] sm:text-[10.5px] font-mono font-bold ${
                      deltaLevel >= 0 ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    ({deltaLevel >= 0 ? `+${deltaLevel}%` : `${deltaLevel}%`})
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono block">
                  Dari {chartBatteryData.length} titik sampel sesi
                </span>
              </div>

              <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                  Rentang Level Baterai Sesi
                </span>
                <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-300 tabular-nums">
                    Maks: {maxBattery}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400">·</span>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold text-amber-300 tabular-nums">
                    Min: {minBattery}%
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] text-slate-400 block">
                  Batas aman baterai: 20%
                </span>
              </div>

              <div className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-white/10">
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block">
                  Status Ketahanan Daya
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span
                    className={`text-[10px] sm:text-[11px] font-extrabold ${
                      isLowPower ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {isLowPower
                      ? 'Daya Rendah — Pasang Charger'
                      : isChargingNow
                      ? 'Optimal — Charger Aktif'
                      : 'Stabil & Aman'}
                  </span>
                </div>
                <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono block">
                  {batteryState.supported
                    ? 'Sensor Web Battery API Aktif'
                    : 'Pemantauan Sesi Aktif'}
                </span>
              </div>
            </div>

            {/* Kanvas Recharts Tren Riwayat Penggunaan Baterai Sesi Ujian */}
            <div className="w-full h-32 sm:h-40 rounded-lg border border-white/10 bg-slate-950/85 p-1 sm:p-1.5">
              {isChartsMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartBatteryData}
                  margin={{ top: 14, right: 24, left: -10, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="batteryLevelAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
                  <XAxis
                    dataKey="elapsedLabel"
                    stroke="#94a3b8"
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                    tickLine={{ stroke: '#475569' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    stroke="#94a3b8"
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0].payload as BatteryHistoryPoint & {
                        stepIndex: number;
                        deltaFromPrev: number;
                      };
                      return (
                        <div className="rounded-xl border border-emerald-400/40 bg-slate-950/95 p-3.5 shadow-xl text-xs space-y-1.5 text-white">
                          <div className="font-extrabold text-emerald-300">
                            Titik Sesi #{pt.stepIndex} · {pt.elapsedLabel}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Waktu Tercatat: <strong className="text-white font-mono">{pt.timestamp}</strong>
                          </div>
                          {pt.eventNote && (
                            <div className="text-[11px] text-slate-300">
                              Aktivitas: <strong className="text-amber-300">{pt.eventNote}</strong>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-white/10">
                            <span className="text-slate-300">Level Baterai:</span>
                            <span
                              className={`font-mono font-extrabold text-sm ${
                                pt.level <= 20 && !pt.charging
                                  ? 'text-rose-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {pt.level}% ({pt.charging ? 'Mengisi Daya' : 'Baterai'})
                            </span>
                          </div>
                          {pt.stepIndex > 1 && (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Perubahan Titik:</span>
                              <span
                                className={`font-mono font-bold ${
                                  pt.deltaFromPrev >= 0 ? 'text-emerald-300' : 'text-amber-300'
                                }`}
                              >
                                {pt.deltaFromPrev >= 0
                                  ? `+${pt.deltaFromPrev}%`
                                  : `${pt.deltaFromPrev}%`}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    wrapperStyle={{ fontSize: '11px', color: '#e2e8f0' }}
                  />
                  <ReferenceLine
                    y={20}
                    stroke="#f43f5e"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{
                      value: 'Batas Aman Baterai 20%',
                      position: 'insideTopRight',
                      fill: '#fda4af',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="level"
                    name="Tren Level Baterai Sesi Ujian (%)"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#batteryLevelAreaGrad)"
                    activeDot={{
                      r: 7,
                      fill: '#fbbf24',
                      stroke: '#0f172a',
                      strokeWidth: 2,
                    }}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (cx === undefined || cy === undefined) return <g key="empty-bat" />;
                      const dotColor = payload.charging
                        ? '#38bdf8'
                        : payload.level <= 20
                        ? '#f43f5e'
                        : '#10b981';
                      return (
                        <circle
                          key={`bat-dot-${payload.stepIndex}-${payload.timestamp}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={dotColor}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                  Memuat grafik telemetri daya...
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* Daftar Riwayat Percobaan Ujian Siswa (History Cards & Tabel Lengkap) */}
      <section className="rounded-lg sm:rounded-xl border border-sky-500/30 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-sky-950/85 p-1.5 sm:p-2.5 text-white shadow-sm space-y-1.5 sm:space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-1.5 border-b border-white/10 pb-1 sm:pb-1.5">
          <div className="space-y-0.5">
            <h2 className="text-[10.5px] sm:text-xs font-extrabold text-white flex flex-wrap items-center gap-1">
              <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              <span>Daftar Riwayat Percobaan Ujian Siswa ({filteredSubmissions.length} Data)</span>
              {(isRestoreCompletedAnimated || (submissions.length > 0 && restoreCompletedTime)) && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8px] sm:text-[9px] font-mono font-extrabold border transition-all ${
                    isRestoreCompletedAnimated
                      ? 'bg-emerald-500 text-slate-950 border-emerald-200 ring-1 ring-emerald-400/50 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}
                >
                  <CheckCircle2
                    className={`w-2.5 h-2.5 shrink-0 ${
                      isRestoreCompletedAnimated ? 'animate-bounce' : ''
                    }`}
                  />
                  <span>
                    ✓ Pulihkan Data Riwayat Sukses ({submissions.length} Data · {restoreCompletedTime})
                  </span>
                </span>
              )}
            </h2>
            <p className="text-[8.5px] sm:text-[10px] text-slate-300 leading-snug">
              Klik <strong>Portofolio (Tabel PDF)</strong> untuk mencetak rekap seluruh nilai &amp; status kelulusan, atau <strong>PDF</strong> pada masing-masing baris.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleDownloadPortfolioTablePdf(false)}
              disabled={filteredSubmissions.length === 0}
              className="h-6 sm:h-6.5 px-2 rounded text-[9px] sm:text-[10px] font-extrabold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-2.5 h-2.5" />
              <span>Portofolio (Tabel PDF)</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateSessionModal}
              className="h-6 sm:h-6.5 px-2 rounded text-[9px] sm:text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border shadow-xs bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white border-emerald-300/40"
              title="Buat sesi ujian baru yang secara otomatis mengosongkan riwayat nilai siswa dan mereset submission sistem"
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-200 animate-pulse shrink-0" />
              <span>Buat Sesi Ujian Baru</span>
            </button>
            {onResetAllSubmissions && (
              <button
                type="button"
                onClick={handleOpenResetModal}
                className={`relative h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-lg text-[9.5px] sm:text-[11px] font-extrabold flex items-center gap-1.5 transition-all duration-300 cursor-pointer border shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                  isResetSuccessActive
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_14px_rgba(16,185,129,0.7)]'
                    : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white border-rose-400/60 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                }`}
                title="Reset dan hapus seluruh daftar riwayat nilai siswa (Judul Nama 13 Kolom pada baris pertama Google Sheets tetap utuh)"
              >
                {isResetSuccessActive ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950" />
                    </span>
                    <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 shrink-0 animate-bounce" />
                    <span>
                      ✓ RESET DATA SUCCSES{resetCompletedTime ? ` (${resetCompletedTime})` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                    <Trash2 className="w-2.5 h-2.5 shrink-0" />
                    <span>Reset Semua Riwayat Nilai (Judul 13 Kolom Tetap Utuh)</span>
                  </>
                )}
              </button>
            )}
            {filteredSubmissions.length !== submissions.length && submissions.length > 0 && (
              <button
                type="button"
                onClick={() => handleDownloadPortfolioTablePdf(true)}
                className="h-6 sm:h-6.5 px-2 rounded text-[9px] sm:text-[10px] font-bold border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Download className="w-2.5 h-2.5" />
                <span>Semua Siswa ({submissions.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Fitur Filter Rentang Tanggal Riwayat Percobaan Ujian Siswa (Mulai & Sampai) Sebelum Reset/Hapus Laporan Nilai */}
        <div className="p-2 sm:p-2.5 rounded-lg border border-sky-500/25 bg-slate-950/70 space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-sky-300 flex items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Filter Rentang Tanggal Riwayat:</span>
              </span>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <input
                    type="date"
                    value={historyDateStart}
                    onChange={(e) => setHistoryDateStart(e.target.value)}
                    className="h-6 sm:h-7 px-2 rounded border border-white/20 bg-slate-900 text-white text-[9px] sm:text-[10.5px] focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                    title="Mulai Tanggal"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-bold">s/d</span>
                <div className="relative">
                  <input
                    type="date"
                    value={historyDateEnd}
                    onChange={(e) => setHistoryDateEnd(e.target.value)}
                    className="h-6 sm:h-7 px-2 rounded border border-white/20 bg-slate-900 text-white text-[9px] sm:text-[10.5px] focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                    title="Sampai Tanggal"
                  />
                </div>
              </div>

              {/* Tombol Pintasan Cepat Rentang Tanggal */}
              <div className="flex flex-wrap items-center gap-1 ml-0 md:ml-1">
                {/* 1. Tombol Hari Ini */}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const todayStr = `${year}-${month}-${day}`;
                    setHistoryDateStart(todayStr);
                    setHistoryDateEnd(todayStr);
                  }}
                  title="Filter riwayat ujian khusus hari ini saja"
                  className={`h-5.5 px-2 rounded text-[8.5px] sm:text-[9.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                    (() => {
                      const now = new Date();
                      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                      return historyDateStart === todayStr && historyDateEnd === todayStr;
                    })()
                      ? 'bg-amber-400 text-slate-950 border-amber-300 ring-1 ring-amber-300/60 font-extrabold shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'bg-white/10 hover:bg-amber-400/20 text-slate-200 hover:text-amber-200 border-white/15'
                  }`}
                >
                  <Calendar className="w-2.5 h-2.5 shrink-0 opacity-80" />
                  <span>Hari Ini</span>
                </button>

                {/* 2. Tombol 7 Hari Terakhir */}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const past7 = new Date();
                    past7.setDate(past7.getDate() - 6);
                    const fmt = (d: Date) =>
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    setHistoryDateStart(fmt(past7));
                    setHistoryDateEnd(fmt(now));
                  }}
                  title="Filter riwayat ujian 7 hari terakhir (mulai 6 hari lalu sampai hari ini)"
                  className={`h-5.5 px-2 rounded text-[8.5px] sm:text-[9.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                    (() => {
                      const now = new Date();
                      const past7 = new Date();
                      past7.setDate(past7.getDate() - 6);
                      const fmt = (d: Date) =>
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      return historyDateStart === fmt(past7) && historyDateEnd === fmt(now);
                    })()
                      ? 'bg-sky-500 text-white border-sky-300 ring-1 ring-sky-300/60 font-extrabold shadow-[0_0_8px_rgba(14,165,233,0.5)]'
                      : 'bg-white/10 hover:bg-sky-500/20 text-slate-200 hover:text-sky-200 border-white/15'
                  }`}
                >
                  <span>7 Hari</span>
                </button>

                {/* 3. Tombol Bulan Ini */}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    const fmt = (d: Date) =>
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    setHistoryDateStart(fmt(firstDay));
                    setHistoryDateEnd(fmt(lastDay));
                  }}
                  title="Filter riwayat ujian bulan ini (tanggal 1 sampai akhir bulan)"
                  className={`h-5.5 px-2 rounded text-[8.5px] sm:text-[9.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                    (() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      const fmt = (d: Date) =>
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      return historyDateStart === fmt(firstDay) && historyDateEnd === fmt(lastDay);
                    })()
                      ? 'bg-indigo-500 text-white border-indigo-300 ring-1 ring-indigo-300/60 font-extrabold shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                      : 'bg-white/10 hover:bg-indigo-500/20 text-slate-200 hover:text-indigo-200 border-white/15'
                  }`}
                >
                  <span>Bulan Ini</span>
                </button>

                {/* 4. Tombol Reset Filter Tanggal (Tampil jika filter aktif atau bisa selalu siap pakai) */}
                <button
                  type="button"
                  onClick={() => {
                    setHistoryDateStart('');
                    setHistoryDateEnd('');
                  }}
                  title="Reset dan bersihkan filter rentang tanggal (tampilkan seluruh data riwayat ujian)"
                  disabled={!historyDateStart && !historyDateEnd}
                  className={`h-5.5 px-2 rounded text-[8.5px] sm:text-[9.5px] font-bold border flex items-center gap-1 transition-all shadow-xs ${
                    historyDateStart || historyDateEnd
                      ? 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 border-rose-400/50 cursor-pointer shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                      : 'bg-white/5 text-slate-400 border-white/10 cursor-not-allowed opacity-60'
                  }`}
                >
                  <RotateCcw className={`w-2.5 h-2.5 shrink-0 ${historyDateStart || historyDateEnd ? 'text-rose-300' : 'text-slate-400'}`} />
                  <span>Reset Filter</span>
                </button>
              </div>
            </div>

            {/* Aksi Reset / Hapus Berdasarkan Rentang Terpilih */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(historyDateStart || historyDateEnd) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] sm:text-[10px] text-amber-300 font-mono font-semibold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                    {filteredSubmissions.length} Data Terpilih
                  </span>
                  {onResetAllSubmissions && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenResetModal({
                          mode: 'DATE_RANGE',
                          startDate: historyDateStart,
                          endDate: historyDateEnd,
                        })
                      }
                      className="h-6 sm:h-6.5 px-2 rounded text-[9px] sm:text-[10px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50 flex items-center gap-1 shadow-xs cursor-pointer"
                      title="Hapus atau reset laporan nilai yang berada di dalam rentang tanggal ini saja"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Hapus/Reset Rentang Ini ({filteredSubmissions.length})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="p-5 rounded-xl border border-white/10 bg-slate-900/60 text-center space-y-2 transition-all duration-500">
            <History className="w-7 h-7 text-sky-400 mx-auto opacity-80" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Belum Ada Riwayat Percobaan Ujian yang Ditemukan
            </h3>
            <p className="text-[11px] text-slate-300 max-w-md mx-auto leading-relaxed">
              {submissions.length === 0
                ? 'Belum ada data laporan hasil ujian yang tersimpan di server sinkronisasi lintas perangkat (atau laporan telah direset oleh Guru). Silakan mulai ujian baru atau klik Sinkronkan Sekarang.'
                : 'Tidak ada riwayat ujian yang cocok dengan kata kunci pencarian atau filter yang dipilih.'}
            </p>
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedClassFilter('ALL');
                    setSelectedStatusFilter('ALL');
                  }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/20 bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  Reset Filter Pencarian
                </button>
              )}
              {(historyDateStart || historyDateEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryDateStart('');
                    setHistoryDateEnd('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-rose-400/40 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filter Rentang Tanggal</span>
                </button>
              )}
              {onManualSync && (
                <button
                  type="button"
                  onClick={() => setShowSyncDateModal(true)}
                  disabled={isSyncing}
                  className={`relative px-3 py-1.5 rounded-lg text-[11px] font-extrabold border flex items-center gap-1.5 transition-all duration-300 cursor-pointer ${
                    isSyncCompletedAnimated && !isSyncing
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/50 shadow-sm'
                      : 'border-sky-400/40 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {lastRekapSyncTime
                      ? `✓ Tersinkron Cloud (${lastRekapSyncTime})`
                      : 'Sinkronkan dari Server Cloud'}
                  </span>
                </button>
              )}
              {submissions.length === 0 && onRestoreDefaultSubmissions && (
                <button
                  type="button"
                  onClick={handleOpenRestoreModal}
                  className={`relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-extrabold border flex items-center gap-1.5 transition-all duration-300 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                    isRestoreCompletedAnimated
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.7)] animate-pulse'
                      : isSheetModalUnlocked
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-300/80 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : 'bg-gradient-to-r from-slate-900 via-emerald-950/70 to-slate-900 hover:from-slate-800 hover:to-emerald-900 text-emerald-300 border-emerald-500/50 hover:border-emerald-400 shadow-sm'
                  }`}
                  title="Pulihkan Data Riwayat Tersinkronisasi (Pilihan Tanggal, Bulan, Tahun untuk Menu Aplikasi & Google Sheet)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <RotateCcw className={`w-3.5 h-3.5 text-emerald-300 shrink-0 ${isRestoreCompletedAnimated ? 'animate-spin' : ''}`} />
                  <span>
                    {isSheetModalUnlocked
                      ? 'Pulihkan Data Riwayat Tersinkronisasi (Guru Aktif)'
                      : 'Pulihkan Data Riwayat Tersinkronisasi (Khusus Guru)'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                    Menu &amp; Sheet
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onStartExamForStudent()}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
              >
                Mulai Ujian Sekarang
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Bar Status & Tombol Sinkronisasi / Penanda Pulihkan Data Riwayat Sukses */}
            <div
              className={`px-2.5 py-2 rounded-lg border flex flex-wrap items-center justify-between gap-2 transition-all duration-500 ${
                isRestoreCompletedAnimated
                  ? 'border-emerald-300 bg-gradient-to-r from-emerald-950/95 via-emerald-900/90 to-teal-950/95 text-emerald-100 ring-1 ring-emerald-400/50'
                  : restoreCompletedTime
                  ? 'border-emerald-500/45 bg-emerald-950/75 text-emerald-200'
                  : 'border-white/10 bg-slate-900/60 text-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {onManualSync && (
                  <button
                    type="button"
                    onClick={() => setShowSyncDateModal(true)}
                    disabled={isSyncing}
                    className={`relative h-7 px-2.5 rounded-md text-[11px] font-extrabold border flex items-center gap-1 transition-all duration-300 cursor-pointer ${
                      isSyncCompletedAnimated && !isSyncing
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/50'
                        : 'border-sky-400/40 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>
                      {lastRekapSyncTime
                        ? `✓ Tersinkron Cloud (${lastRekapSyncTime})`
                        : 'Sinkronkan dari Server Cloud'}
                    </span>
                  </button>
                )}
                {onRestoreDefaultSubmissions && (
                  <button
                    type="button"
                    onClick={handleOpenRestoreModal}
                    className={`relative h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-[11px] font-extrabold border flex items-center gap-1.5 transition-all duration-300 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                      isRestoreCompletedAnimated
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.7)] animate-pulse'
                        : restoreCompletedTime
                        ? 'bg-gradient-to-r from-emerald-900/90 via-teal-900/80 to-slate-900 text-emerald-200 border-emerald-400/70 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                        : isSheetModalUnlocked
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-300/80 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                        : 'bg-gradient-to-r from-slate-900 via-emerald-950/70 to-slate-900 hover:from-slate-800 hover:to-emerald-900 text-emerald-300 border-emerald-500/50 hover:border-emerald-400 shadow-sm'
                    }`}
                    title="Pulihkan Data Riwayat Tersinkronisasi (Pilihan Tanggal, Bulan, Tahun untuk Menu Aplikasi & Google Sheet)"
                  >
                    <span className="flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3 text-amber-300 shrink-0" />
                      <RotateCcw className={`w-3.5 h-3.5 text-emerald-300 shrink-0 ${isRestoreCompletedAnimated ? 'animate-spin' : ''}`} />
                    </span>
                    <span className="tracking-tight">
                      {isSheetModalUnlocked
                        ? 'Pulihkan Data Riwayat (Guru Aktif)'
                        : 'Pulihkan Data Riwayat (Khusus Guru)'}
                    </span>
                    <span className="hidden lg:inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                      Menu &amp; Sheet
                    </span>
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-300 flex items-center gap-1.5 ml-auto">
                {(isRestoreCompletedAnimated || restoreCompletedTime) ? (
                  <span className="font-bold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      ✓ Data Riwayat Dipulihkan ({submissions.length} Data · {restoreCompletedTime})
                    </span>
                  </span>
                ) : (
                  <span className="font-mono text-[10.5px] text-sky-300">
                    Total Riwayat Tersinkron: <strong>{submissions.length} Data</strong>
                  </span>
                )}
              </span>
            </div>
            {filteredSubmissions.slice(0, historyVisibleLimit).map((sub, subIdx) => {
              const attemptNo = attemptNumberMap[sub.id] || 1;
              const rankNo =
                submissionRankMap[sub.id] ||
                submissionRankMap[getSubmissionUniqueKey(sub)] ||
                subIdx + 1;
              const isDisqualified =
                sub.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
                sub.statusKecurangan.toLowerCase().includes('gagal');
              const isPassed =
                !isDisqualified &&
                sub.nilaiAkhir >= EXAM_INFO.kkm &&
                !sub.lulusTidakLulus.toLowerCase().includes('tidak');

              return (
                <div
                  key={sub.id ? `${sub.id}-${subIdx}` : `history-sub-${subIdx}`}
                  className={`p-1.5 sm:p-2 rounded-lg border transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 ${
                    isPassed
                      ? 'bg-slate-900/90 border-emerald-500/40 hover:border-emerald-400/70'
                      : 'bg-slate-900/90 border-rose-500/40 hover:border-rose-400/70'
                  }`}
                >
                  {/* Info Siswa, Tanggal & Status */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono font-extrabold text-[10px] flex items-center gap-1 ${
                          rankNo === 1
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : rankNo === 2
                            ? 'bg-slate-200 text-slate-950'
                            : rankNo === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-indigo-500/25 border border-indigo-400/45 text-indigo-200'
                        }`}
                      >
                        <Trophy className="w-2.5 h-2.5 shrink-0" />
                        Ranking #{rankNo}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono font-extrabold text-[10px]">
                        Percobaan #{attemptNo}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 font-mono text-[10px] font-bold flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-sky-300" />
                        {sub.timestamp}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                          isPassed
                            ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                            : 'bg-rose-500/20 border border-rose-400/50 text-rose-300'
                        }`}
                      >
                        {isPassed ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <XCircle className="w-2.5 h-2.5" />
                        )}
                        {sub.lulusTidakLulus}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
                      <span className="font-extrabold text-white flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-amber-300" />
                        {sub.namaSiswa}
                      </span>
                      <span className="text-[10.5px] font-mono text-sky-300">
                        NIS: <strong className="text-white">{sub.nisNisn}</strong>
                      </span>
                      <span className="text-[10.5px] font-semibold text-slate-300">
                        Kelas: <strong className="text-amber-300">{getCleanKelas(sub.kelas)}</strong>
                      </span>
                      <span className="text-[10.5px] font-semibold text-slate-300">
                        Sem: <strong className="text-sky-300">{getSemesterFromSub(sub)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-400/40 text-[10px] font-mono text-emerald-200">
                        {/android|iphone|ipad|tablet/i.test(sub.deviceCategory || '') ? (
                          <Smartphone className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Laptop className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                        )}
                        <span>
                          <strong className="text-emerald-300">{sub.deviceCategory || 'HP Android'}</strong> ·{' '}
                          <strong className="text-amber-300">
                            {sub.deviceModel || sub.deviceBrand || 'Terdeteksi'}
                          </strong>
                        </span>
                      </span>

                      {(sub.deviceFingerprint || sub.clientIp) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/90 border border-cyan-400/50 text-[10px] font-mono text-cyan-200 shadow-2xs">
                          {sub.deviceFingerprint && (
                            <span className="font-extrabold text-cyan-300 tracking-wide">
                              {sub.deviceFingerprint}
                            </span>
                          )}
                          {sub.deviceFingerprint && sub.clientIp && (
                            <span className="text-slate-500">·</span>
                          )}
                          {sub.clientIp && (
                            <span className="font-semibold text-emerald-300">
                              IP: {sub.clientIp}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-300">
                      <span className="flex items-center gap-1">
                        {(sub.violationCount || 0) === 0 ? (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                        )}
                        Integritas:{' '}
                        <strong
                          className={
                            (sub.violationCount || 0) === 0
                              ? 'text-emerald-300'
                              : 'text-rose-300'
                          }
                        >
                          {sub.statusKecurangan}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Skor & Tombol Aksi */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-2 pt-1.5 lg:pt-0 border-t lg:border-t-0 border-white/10">
                    <div className="text-left sm:text-right px-2 py-0.5 rounded-md bg-slate-950/90 border border-white/15">
                      <span className="text-[8.5px] uppercase tracking-wider text-slate-400 block">
                        Skor Akhir
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-base font-mono font-extrabold tabular-nums ${
                            isPassed ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {sub.nilaiAkhir}%
                        </span>
                        <span className="text-[10px] font-mono text-slate-300">
                          ({sub.skorBenar}/{sub.totalSoal})
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onViewSubmissionResult(sub)}
                        className="h-6.5 px-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Hasil</span>
                      </button>

                      {onOpenRaporSiswa && (
                        <button
                          type="button"
                          onClick={() => onOpenRaporSiswa(sub)}
                          className="h-6.5 px-2 rounded-md bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <BarChart3 className="w-3 h-3" />
                          <span>Rapor</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadCertificatePdf(sub)}
                        className="h-6.5 px-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10.5px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        title="Unduh Sertifikat Resmi Ujian ANBK Siswa (PDF)"
                      >
                        <Award className="w-3 h-3 text-slate-950" />
                        <span>Sertifikat PDF</span>
                      </button>

                      {!isPassed && (
                        <button
                          type="button"
                          onClick={() => onStartExamForStudent(sub)}
                          className="h-6.5 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Ulangan</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredSubmissions.length > historyVisibleLimit && (
              <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 text-[11px] text-slate-300">
                <span>
                  Menampilkan <strong>{historyVisibleLimit}</strong> dari{' '}
                  <strong>{filteredSubmissions.length}</strong> riwayat percobaan ujian
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryVisibleLimit((prev) => prev + 25)}
                    className="px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold cursor-pointer transition-colors"
                  >
                    +25 Riwayat Lagi
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryVisibleLimit(filteredSubmissions.length)}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold cursor-pointer transition-colors"
                  >
                    Tampilkan Semua ({filteredSubmissions.length} Riwayat)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal Pilihan Data Sinkronisasi (Tanggal, Bulan, Tahun) */}
      <SyncDataDateModal
        isOpen={showSyncDateModal}
        onClose={() => setShowSyncDateModal(false)}
        submissions={submissions}
        title="PILIHAN DATA SINKRONISASI REKAPITULASI"
        description="Pilih data hasil ujian siswa berdasarkan tanggal, bulan, atau tahun yang ingin disinkronkan ke Link Google Sheets (13 Kolom) dan Server Cloud."
        isSyncing={isPushingToSheet || isSyncing}
        onConfirmSync={handleConfirmSyncFromModal}
      />

      {/* Modal Otentikasi Guru untuk Reset Semua Laporan Hasil Nilai Ujian dengan Pilihan Tanggal, Bulan & Tahun */}
      <ResetSubmissionsModal
        key={`reset-modal-${resetModalConfig.initialMode || 'ALL'}-${resetModalConfig.initialStartDate || ''}-${resetModalConfig.initialEndDate || ''}-${showResetConfirmModal}`}
        isOpen={showResetConfirmModal}
        onClose={() => setShowResetConfirmModal(false)}
        submissions={submissions}
        requirePassword={!isSheetModalUnlocked}
        isTeacherMode={isSheetModalUnlocked}
        onConfirmReset={handleConfirmResetWithFilter}
        initialMode={resetModalConfig.initialMode}
        initialStartDate={resetModalConfig.initialStartDate}
        initialEndDate={resetModalConfig.initialEndDate}
      />

      {/* Modal Pulihkan Data Riwayat Tersinkronisasi (Pilihan Tanggal, Bulan, Tahun & Target Data Menu & Google Sheet) */}
      <RestoreSubmissionsModal
        isOpen={showRestoreConfirmModal}
        onClose={() => setShowRestoreConfirmModal(false)}
        candidatePool={candidatePool}
        currentSubmissions={submissions}
        onConfirmRestore={handleConfirmRestoreWithFilter}
        googleSheetUrl={sanitizeRekapSheetUrl(googleSheetUrl || cloudConfig?.googleSheetUrl)}
        isTeacherMode={isSheetModalUnlocked}
      />

      {/* Modal Otentikasi Khusus Guru untuk Salin TSV 13 Kolom, Unduh CSV & Ekspor JSON */}
      {pendingTeacherExportAction && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-amber-400/50 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/95 p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {pendingTeacherExportAction === 'copy_tsv'
                      ? 'Khusus Guru · Salin TSV 13 Kolom'
                      : pendingTeacherExportAction === 'download_csv'
                      ? 'Khusus Guru · Unduh File CSV Rekap'
                      : 'Khusus Guru · Ekspor Laporan JSON Cadangan'}
                  </h3>
                  <p className="text-[11px] text-amber-300 font-semibold">
                    Fitur ini HANYA dapat diakses oleh Guru Mapel (Siswa tidak dapat mengakses)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingTeacherExportAction(null);
                  setTeacherExportPasswordInput('');
                  setTeacherExportPasswordError(null);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4" role="group">
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-400/35 text-xs text-slate-200 leading-relaxed space-y-1">
                <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>PROTEKSI AKSES KHUSUS GURU MAPEL</span>
                </div>
                <p>
                  Fitur{' '}
                  <strong className="text-amber-300">
                    {pendingTeacherExportAction === 'copy_tsv'
                      ? 'Salin TSV 13 Kolom'
                      : pendingTeacherExportAction === 'download_csv'
                      ? 'Unduh CSV Rekap Hasil Ujian'
                      : 'Ekspor Laporan JSON Cadangan Ujian Siswa (Offline)'}
                  </strong>{' '}
                  dikunci secara permanen bagi Siswa/Murid dan{' '}
                  <strong>
                    hanya dapat diakses oleh Guru Mapel ({EXAM_INFO.guruMapelUpper})
                  </strong>{' '}
                  menggunakan Kode Mode Guru.
                </p>
              </div>

              {teacherExportPasswordError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{teacherExportPasswordError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-sky-200 mb-1.5">
                  Kode Mode Guru
                </label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="q_filter_export_guru_anbk"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmTeacherExportAction(e as unknown as React.FormEvent);
                    }
                  }}
                  value={teacherExportPasswordInput}
                  onChange={(e) => {
                    setTeacherExportPasswordInput(e.target.value);
                    if (teacherExportPasswordError) setTeacherExportPasswordError(null);
                  }}
                  placeholder="Ketik password Mode Guru..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-slate-950/80 text-white placeholder:text-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingTeacherExportAction(null);
                    setTeacherExportPasswordInput('');
                    setTeacherExportPasswordError(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={(e) => handleConfirmTeacherExportAction(e as unknown as React.FormEvent)}
                  className="px-5 py-2 rounded-lg text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  {pendingTeacherExportAction === 'copy_tsv' ? (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Verifikasi &amp; Salin TSV</span>
                    </>
                  ) : pendingTeacherExportAction === 'download_csv' ? (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Verifikasi &amp; Unduh CSV</span>
                    </>
                  ) : (
                    <>
                      <FileJson className="w-4 h-4" />
                      <span>Verifikasi &amp; Buka Laporan JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Tautan Sinkronisasi Rekap Hasil Ujian (12 Kolom Persis) */}
      {showSheetConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl border border-emerald-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Sinkronisasi Otomatis · Rekap Hasil Ujian &amp; Device
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    12 Kolom Persis: {REKAP_SHEET_HEADERS.join(', ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSheetConfigModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isSheetModalUnlocked ? (
              <div className="space-y-4" role="group">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Masukkan Kode Mode Guru (<strong className="text-amber-300">{EXAM_INFO.guruMapelUpper}</strong>) untuk mengubah tautan sinkronisasi <strong>Rekap Hasil Ujian</strong> atau menghubungkan otorisasi sinkronisasi otomatis.
                </p>
                {sheetModalError && (
                  <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold">
                    {sheetModalError}
                  </div>
                )}
                <input
                  type="password"
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="q_filter_sheet_guru_anbk"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (sheetModalPass.trim() === EXAM_INFO.teacherPassword) {
                        setIsSheetModalUnlocked(true);
                        setSheetModalError(null);
                      } else {
                        setSheetModalError('Kode Mode Guru tidak sesuai!');
                      }
                    }
                  }}
                  value={sheetModalPass}
                  onChange={(e) => {
                    setSheetModalPass(e.target.value);
                    if (sheetModalError) setSheetModalError(null);
                  }}
                  placeholder="Ketik password Mode Guru..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-slate-950/80 text-white text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSheetConfigModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/20 bg-white/10 text-white cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (sheetModalPass.trim() === EXAM_INFO.teacherPassword) {
                        setIsSheetModalUnlocked(true);
                        setSheetModalError(null);
                      } else {
                        setSheetModalError('Kode Mode Guru tidak sesuai!');
                      }
                    }}
                    className="px-5 py-2 rounded-lg text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                  >
                    Buka Pengaturan
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">
                    Tautan Sinkronisasi &quot;Rekap Hasil Ujian&quot;
                  </label>
                  <input
                    type="url"
                    value={rekapSheetUrlDraft}
                    onChange={(e) => setRekapSheetUrlDraft(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-slate-950/80 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sky-300 mb-1">
                    URL Web App Script (Opsional untuk Sinkron Tanpa Login)
                  </label>
                  <input
                    type="url"
                    value={appsScriptUrlDraft}
                    onChange={(e) => setAppsScriptUrlDraft(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-slate-950/80 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 text-[11px] text-slate-300 space-y-1">
                  <div className="font-bold text-amber-300">
                    Rumus Live Auto-Sync Rekapitulasi (Alternatif Cepat):
                  </div>
                  <p>
                    Anda juga dapat menempelkan rumus berikut pada sel <strong>A1</strong> di tabel <strong>Rekap Hasil Ujian</strong> agar menarik data otomatis:
                  </p>
                  <code className="block p-2 rounded bg-slate-900 text-emerald-300 font-mono text-[10px] break-all select-all">
                    {`=IMPORTDATA("${typeof window !== 'undefined' ? window.location.origin : ''}/__api/rekap-hasil-ujian.csv")`}
                  </code>
                </div>

                {/* Bagian Khusus Ekspor Cadangan Mandiri JSON saat Terkendala Jaringan */}
                <div className="p-3.5 rounded-xl bg-violet-950/50 border border-violet-400/40 text-xs text-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-violet-300 flex items-center gap-1.5">
                      <FileJson className="w-4 h-4 text-violet-300 shrink-0" />
                      <span>Ekspor Cadangan Mandiri Guru (Format JSON)</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-400/30">
                      Darurat / Kendala Jaringan
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Jika integrasi Google Sheet atau sinkronisasi cloud mengalami kendala jaringan berkepanjangan, Anda dapat mengunduh seluruh data ujian siswa yang tersimpan di perangkat lokal ini dalam format <strong>Laporan JSON Lengkap</strong> untuk cadangan mandiri guru.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        executeDownloadLocalSubmissionsJson();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-500 hover:bg-violet-400 text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Berkas JSON ({submissionsWithSyncedDevice.length} Data)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowJsonReportModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Pratinjau &amp; Salin JSON</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetModalUnlocked(false);
                      setSheetModalPass('');
                      setShowSheetConfigModal(false);
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold border border-rose-400/40 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Kunci Kembali Akses Guru
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSheetConfigModal(false)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/20 bg-white/10 text-white cursor-pointer"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (onUpdateCloudConfig && cloudConfig) {
                          onUpdateCloudConfig({
                            ...cloudConfig,
                            googleSheetUrl: rekapSheetUrlDraft.trim(),
                            appsScriptWebAppUrl: appsScriptUrlDraft.trim(),
                          });
                        } else {
                          await writeFirestoreCloudConfig({
                            googleSheetUrl: rekapSheetUrlDraft.trim(),
                            appsScriptWebAppUrl: appsScriptUrlDraft.trim(),
                          });
                        }
                        await handleSyncAllAndPushToGoogleSheets(true);
                        setShowSheetConfigModal(false);
                      }}
                      className={`relative px-5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all duration-300 cursor-pointer border ${
                        isSyncCompletedAnimated
                          ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 border-emerald-100 ring-4 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300/40'
                      }`}
                    >
                      {isSyncCompletedAnimated && !(isSyncing || isPushingToSheet) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 animate-bounce" />
                          <span>Selesai Sinkron Otomatis!</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isPushingToSheet ? 'animate-spin' : ''}`} />
                          <span>Simpan &amp; Sinkronkan Otomatis</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Kamera Perangkat & Penyimpanan Foto Profil Siswa di localStorage */}
      <StudentCameraProfileModal
        isOpen={showStudentCameraModal}
        onClose={() => setShowStudentCameraModal(false)}
        namaSiswa={activeHeaderStudentName === 'Peserta Ujian ANBK' ? '' : activeHeaderStudentName}
        nisNisn={activeHeaderNisNisn}
        kelasSiswa={activeHeaderKelas}
        semesterSiswa={activeHeaderSemester}
        currentPhotoUrl={activeHeaderPhotoUrl}
        isLocked={isStudentIdentityLocked}
        lockReason={studentIdentityLockReason}
        onSaveProfile={(updated) => {
          setStoredProfile(loadStoredStudentProfile());
          if (onUpdateStudentProfile) {
            onUpdateStudentProfile(updated);
          }
          setPortfolioToast(
            `Foto Kamera Siswa (${updated.namaSiswa}) berhasil disimpan dan diperbarui!`
          );
          setTimeout(() => setPortfolioToast(null), 4500);
        }}
      />

      {/* Modal Otentikasi Password Guru untuk Buat Sesi Ujian Baru */}
      {showCreateSessionAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-emerald-500/50 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/90 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Verifikasi Kode Mode Guru
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Otorisasi Guru Mapel ({EXAM_INFO.guruMapelUpper})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSessionAuthModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              Fitur <strong className="text-emerald-300">Buat Sesi Ujian Baru</strong> dilindungi otentikasi ketat bagi Siswa/Murid dan hanya dapat diakses oleh Guru Mapel Informatika.
            </p>

            <div className="space-y-3.5" role="group">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Kode Mode Guru
                </label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="q_filter_session_guru_anbk"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerifyCreateSessionPassword(e as unknown as React.FormEvent);
                    }
                  }}
                  value={createSessionPasswordInput}
                  onChange={(e) => {
                    setCreateSessionPasswordInput(e.target.value);
                    if (createSessionPasswordError) setCreateSessionPasswordError(null);
                  }}
                  placeholder="Ketik password Mode Guru..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/20 bg-slate-950/80 text-white placeholder:text-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                {createSessionPasswordError && (
                  <p className="text-xs text-rose-400 font-bold mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{createSessionPasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSessionAuthModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={(e) => handleVerifyCreateSessionPassword(e as unknown as React.FormEvent)}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer"
                >
                  Buka Menu Sesi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Laporan JSON Cadangan Data Ujian Siswa (Offline / Ekspor Mandiri Guru) */}
      {showJsonReportModal && (() => {
        const report = buildAllLocalSubmissionsJsonReport();
        const jsonFormattedString = JSON.stringify(report, null, 2);
        const reportSizeKb = (new Blob([jsonFormattedString]).size / 1024).toFixed(1);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative w-full max-w-4xl rounded-2xl border border-violet-500/50 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] flex flex-col overflow-hidden">
              {/* Header Modal */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
                    <FileJson className="w-5 h-5 text-amber-200 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-extrabold text-white">
                        Laporan Cadangan Data Ujian Siswa (Format JSON)
                      </h2>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-400/40">
                        Ekspor Mandiri Guru
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                      Cadangan data ujian lengkap dari penyimpanan lokal untuk penanganan kendala jaringan atau kegagalan sinkronisasi Google Sheets / Cloud.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJsonReportModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner Diagnostik Jaringan & Antrean */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-white/10 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                        typeof navigator !== 'undefined' && navigator.onLine
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                      }`}
                    >
                      {typeof navigator !== 'undefined' && navigator.onLine ? (
                        <>
                          <Wifi className="w-3 h-3 text-emerald-400" />
                          <span>Status: Online</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3 text-rose-400" />
                          <span>Status: Terputus (Offline)</span>
                        </>
                      )}
                    </span>

                    <span className="text-slate-300">
                      Terkumpul:{' '}
                      <strong className="text-amber-300 font-bold">
                        {report.ringkasanStatistik.totalPesertaUjian} Siswa
                      </strong>
                    </span>

                    {syncQueue.stats.pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>{syncQueue.stats.pendingCount} data antrean tertunda</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-violet-400" />
                    <span>Ukuran Berkas: ~{reportSizeKb} KB</span>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setJsonModalActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    jsonModalActiveTab === 'preview'
                      ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Pratinjau Kode JSON ({report.ringkasanStatistik.totalPesertaUjian} Siswa)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJsonModalActiveTab('summary')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    jsonModalActiveTab === 'summary'
                      ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-400/50'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Ringkasan Statistik &amp; Diagnostik</span>
                </button>
              </div>

              {/* Tab Content Container */}
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
                {jsonModalActiveTab === 'preview' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Braces className="w-3.5 h-3.5 text-violet-400" />
                        <span>Struktur JSON Terformat (Format Standar UTF-8):</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={executeCopyLocalSubmissionsJson}
                          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedLocalJson ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300">Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin Teks</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <pre className="w-full max-h-[50vh] overflow-y-auto overflow-x-auto rounded-xl bg-slate-950 p-4 border border-violet-500/30 text-emerald-300 font-mono text-[11px] leading-relaxed select-all shadow-inner">
                      <code>{jsonFormattedString}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 4 Kartu KPI Statistik */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-violet-500/30">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Total Peserta
                        </div>
                        <div className="text-xl font-extrabold text-white mt-1">
                          {report.ringkasanStatistik.totalPesertaUjian} Siswa
                        </div>
                        <div className="text-[10px] text-violet-300 mt-0.5">
                          Tersimpan di Browser Lokal
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Tingkat Kelulusan
                        </div>
                        <div className="text-xl font-extrabold text-emerald-400 mt-1">
                          {report.ringkasanStatistik.persentaseKelulusan}%
                        </div>
                        <div className="text-[10px] text-emerald-300/80 mt-0.5">
                          {report.ringkasanStatistik.jumlahLulus} Lulus · {report.ringkasanStatistik.jumlahRemedial} Remedial
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Rata-Rata Nilai
                        </div>
                        <div className="text-xl font-extrabold text-amber-300 mt-1">
                          {report.ringkasanStatistik.rataRataNilai}
                        </div>
                        <div className="text-[10px] text-amber-200/80 mt-0.5">
                          Tertinggi {report.ringkasanStatistik.nilaiTertinggi} · Terendah {report.ringkasanStatistik.nilaiTerendah}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-sky-500/30">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Antrean Offline
                        </div>
                        <div className="text-xl font-extrabold text-sky-400 mt-1">
                          {syncQueue.stats.pendingCount} Tertunda
                        </div>
                        <div className="text-[10px] text-sky-300/80 mt-0.5">
                          {syncQueue.stats.isOnline ? 'Jaringan Siap Kirim' : 'Menunggu Koneksi'}
                        </div>
                      </div>
                    </div>

                    {/* Rincian Sebaran Kelas & Paket */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-violet-400" />
                          <span>Sebaran Berdasarkan Kelas</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {Object.entries(report.ringkasanStatistik.sebaranKelas).map(([cls, count]) => (
                            <div
                              key={cls}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/5"
                            >
                              <span className="text-slate-300 font-semibold">{cls}</span>
                              <span className="text-amber-300 font-bold">{String(count)} Siswa</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-sky-400" />
                          <span>Sebaran Paket Soal Ujian</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {Object.entries(report.ringkasanStatistik.sebaranPaketSoal).map(([pkg, count]) => (
                            <div
                              key={pkg}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/5"
                            >
                              <span className="text-slate-300 font-semibold">{pkg}</span>
                              <span className="text-sky-300 font-bold">{String(count)} Siswa</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Panduan Pemulihan Mandiri bagi Guru */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs text-amber-100 space-y-1.5">
                      <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>PANDUAN CADANGAN GURU KETIKA JARINGAN TERKENDALA:</span>
                      </div>
                      <p className="text-[11.5px] text-slate-200 leading-relaxed">
                        Jika WiFi atau koneksi internet sekolah terputus, guru dapat mengunduh berkas{' '}
                        <strong className="text-amber-300">.json</strong> ini ke flashdisk atau penyimpanan laptop guru. Berkas ini menyimpan identitas lengkap siswa, seluruh butir jawaban pilihan ganda, durasi pengerjaan, skor, status pelanggaran, dan metadata perangkat siswa tanpa ada data yang hilang.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modal dengan Tombol Unduh & Salin */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={executeCopyLocalSubmissionsJson}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
                  >
                    {copiedLocalJson ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300 font-bold">✓ Tersalin ke Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Semua JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJsonReportModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={executeDownloadLocalSubmissionsJson}
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center gap-2 shadow-lg transition-all cursor-pointer font-bold border border-violet-400/40"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Berkas JSON (.json)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Buat Sesi Ujian Baru di Siswa Dashboard */}
      {showCreateSessionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-emerald-400/50 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Buat Sesi Ujian Baru
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                    Otomatis mengosongkan riwayat nilai siswa dan melakukan reset data submission pada seluruh sistem.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSessionModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs text-amber-100 space-y-1.5">
              <div className="font-extrabold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>PENGOSONGAN RIWAYAT NILAI & RESET OTOMATIS:</span>
              </div>
              <p className="text-slate-200 text-[11.5px] leading-relaxed">
                Tindakan ini akan mengosongkan <strong className="text-amber-300">{submissions.length} riwayat nilai</strong> yang ada di sistem, mereset database Cloud &amp; Google Sheets, serta mengembalikan kuota 3x token seluruh murid agar fresh untuk sesi baru.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Nama / Judul Sesi Ujian Baru <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={sessionNameInput}
                  onChange={(e) => setSessionNameInput(e.target.value)}
                  placeholder="Contoh: Sesi 1 - Gladi Bersih ANBK Informatika"
                  className="w-full px-3 py-2 rounded-xl border border-sky-500/40 bg-slate-950/80 text-white text-xs font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Pilih Cepat:</span>
                  {[
                    'Sesi 1 - Gladi Bersih ANBK',
                    'Sesi 2 - Ujian Informatika',
                    'Sesi PTS Ganjil',
                    'Sesi PAS Ganjil',
                    'Sesi Semester Genap',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSessionNameInput(preset)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border transition-all cursor-pointer ${
                        sessionNameInput === preset
                          ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400'
                          : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Target Peserta Ujian / Jenjang Kelas
                </label>
                <select
                  value={targetKelasInput}
                  onChange={(e) => setTargetKelasInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-500/40 bg-slate-950/80 text-amber-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                >
                  <option value="ALL">Semua Kelas (Fase D: Jenjang VII-1 s/d VIII-6)</option>
                  <optgroup label="Khusus Jenjang">
                    <option value="VII">Khusus Seluruh Siswa Kelas VII</option>
                    <option value="VIII">Khusus Seluruh Siswa Kelas VIII</option>
                  </optgroup>
                </select>
              </div>

              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoGenerateNewToken}
                    onChange={(e) => setAutoGenerateNewToken(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    Terbitkan Kode Token Ujian Baru untuk Sesi Ini
                  </span>
                </label>

                {autoGenerateNewToken && (
                  <div className="flex items-center gap-2 pt-1 pl-6">
                    <input
                      type="text"
                      maxLength={6}
                      value={customNewTokenInput}
                      onChange={(e) => setCustomNewTokenInput(e.target.value.toUpperCase())}
                      placeholder="TOKEN"
                      className="w-36 px-3 py-1.5 rounded-lg border border-amber-400/60 bg-slate-900 text-amber-300 font-mono font-extrabold text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomNewTokenInput(generateRandomExamToken(5))}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Acak
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Catatan Sesi Ujian (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={sessionNotesInput}
                  onChange={(e) => setSessionNotesInput(e.target.value)}
                  placeholder="Catatan sesi ujian..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={isCreatingSession}
                onClick={() => setShowCreateSessionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCreatingSession}
                onClick={handleExecuteCreateNewSession}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 disabled:opacity-60 text-slate-950 flex items-center gap-2 shadow-lg transition-all cursor-pointer font-bold"
              >
                {isCreatingSession ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Membuat Sesi &amp; Mereset Data...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>Buat Sesi Ujian Baru &amp; Kosongkan Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
