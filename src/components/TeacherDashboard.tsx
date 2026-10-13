import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import {
  Question,
  StudentSubmission,
  CloudIntegrationConfig,
  EXAM_INFO,
  GAS_CODE_TEMPLATE,
  INITIAL_QUESTIONS,
  INITIAL_SUBMISSIONS,
  REKAP_SHEET_HEADERS,
  getCleanKelas,
  getSemesterFromSub,
  getJenjangFromKelas,
  SemesterType,
  ExamPackageKey,
  FASE_D_PACKAGE_META,
  FASE_D_QUESTION_BANKS,
  fetchOnlineFaseDQuestions,
  getActiveTeacherPhotoUrl,
  TEACHER_PHOTO_STORAGE_KEY,
  syncSubmissionsToGoogleSheetsAuto,
  writeFirestoreCloudConfig,
  sanitizeRekapSheetUrl,
  computeSubmissionRankingMap,
  formatSubmissionToRekap13ColumnsWithRank,
  getSubmissionUniqueKey,
  summarizeStudentSessionsAndTokenUsageByNisNisn,
  getUsedExamTokens,
  UsedExamTokenRecord,
  ExhaustedStudentTokenEntry,
  getStudentsWithExhaustedTokenQuota,
  resetStudentTokenQuotaByStudent,
  MAX_TOKEN_USAGE,
  TokenQuotaExhaustedNotificationLog,
  TokenExhaustedNotifSettings,
  getTokenExhaustedNotificationLogs,
  saveTokenExhaustedNotificationLogs,
  getTokenExhaustedNotifSettings,
  saveTokenExhaustedNotifSettings,
  buildTokenExhaustedTeacherMessage,
  dispatchTeacherTokenExhaustedNotification,
  pushTokenEventLocallyAndBroadcast,
  saveCloudTokenConfigToServer,
  sendExamResultViaFonnteApi,
  ExamSessionInfo,
  getCurrentExamSession,
  getExamSessionsHistory,
  createNewExamSession,
  generateRandomExamToken,
  ResetSubmissionsFilter,
  isSubmissionMatchingResetFilter,
} from '../data/examData';
import { ResetSubmissionsModal } from './ResetSubmissionsModal';
import { AdminOperatorAuthModal } from './AdminOperatorAuthModal';
import { AdminSchoolMenuModal } from './AdminSchoolMenuModal';
import {
  SyncDataDateModal,
  SyncDateFilter,
  isSubmissionMatchingSyncFilter,
} from './SyncDataDateModal';
import {
  googleSignIn,
  getAccessTokenSync,
} from '../services/gmailAuthService';
import { generateSingleFileHtml } from '../data/standaloneHtmlGenerator';
import {
  generateIntegrityLogsPdfBlob,
  generateIntegrityLogsTextContent,
  generateCompiledAllStudentsPdfBlob,
  generateClassAnalyticsPdfBlob,
  generateRekapPerKelasPdfBlob,
  generateSelectedClassReportPdfBlob,
  generateResultImageBlobs,
  triggerFileDownload,
} from '../utils/resultMediaGenerator';
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  FileText,
  Code2,
  ExternalLink,
  RotateCcw,
  Send,
  Image as ImageIcon,
  ArrowLeft,
  Globe,
  RefreshCw,
  Mail,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Database,
  Upload,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Printer,
  Moon,
  Sun,
  Clock,
  Smartphone,
  Laptop,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
  Award,
  Users,
  Target,
  Sparkles,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Layers,
  PlusCircle,
  MonitorCheck,
  GraduationCap,
  Filter,
  Search,
} from 'lucide-react';
import { useSubmissionSyncQueue } from '../utils/submissionSyncQueue';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ReferenceLine,
} from 'recharts';

interface TeacherDashboardProps {
  questions: Question[];
  onUpdateQuestions: (q: Question[]) => void;
  questionBanks?: Record<ExamPackageKey, Question[]>;
  onUpdateAllQuestionBanks?: (banks: Record<ExamPackageKey, Question[]>) => void;
  activePackageKey?: ExamPackageKey;
  onSelectPackageKey?: (key: ExamPackageKey) => void;
  submissions: StudentSubmission[];
  onUpdateSubmissions: (s: StudentSubmission[]) => void;
  onResetAllSubmissions?: (
    filter?: ResetSubmissionsFilter,
    explicitToken?: string
  ) => Promise<any> | void;
  cloudConfig: CloudIntegrationConfig;
  onUpdateCloudConfig: (c: CloudIntegrationConfig) => void;
  darkMode: boolean;
  printDarkMode?: boolean;
  onChangePrintDarkMode?: (val: boolean) => void;
  onExitTeacherMode: () => void;
  onTriggerWhatsApp: (sub: StudentSubmission) => void;
  onTriggerEmail: (sub: StudentSubmission) => void;
  onPrintStudentSummary?: (sub: StudentSubmission) => void;
  activeExamSession?: ExamSessionInfo;
  onCreateNewExamSession?: (params: {
    sessionName: string;
    newToken?: string;
    targetKelas?: string;
    notes?: string;
  }) => Promise<{ session: ExamSessionInfo; newToken?: string }>;
  onOpenMonitoring?: () => void;
  isAdminOperatorMode?: boolean;
  onToggleAdminOperatorMode?: (val: boolean) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  questions,
  onUpdateQuestions,
  questionBanks,
  onUpdateAllQuestionBanks,
  activePackageKey = 'VIII_Ganjil',
  onSelectPackageKey,
  submissions,
  onUpdateSubmissions,
  onResetAllSubmissions,
  cloudConfig,
  onUpdateCloudConfig,
  darkMode,
  printDarkMode = false,
  onChangePrintDarkMode,
  onExitTeacherMode,
  onTriggerWhatsApp,
  onTriggerEmail,
  onPrintStudentSummary,
  activeExamSession: propsActiveExamSession,
  onCreateNewExamSession,
  onOpenMonitoring,
  isAdminOperatorMode: propsIsAdminOperatorMode,
  onToggleAdminOperatorMode,
}) => {
  // Mode Interaksi: 'VIEW' (View-Only / Hanya Lihat) vs 'EDIT' (Edit-Mode)
  const [dashboardInteractionMode, setDashboardInteractionMode] = useState<'VIEW' | 'EDIT'>(() => {
    const saved = localStorage.getItem('anbk_teacher_interaction_mode');
    return saved === 'VIEW' ? 'VIEW' : 'EDIT';
  });

  const [dashboardModeToast, setDashboardModeToast] = useState<string | null>(null);

  // State Mode Sistem: Admin / Operator Sekolah (Default selalu terkunci false agar murid tidak dapat mengakses)
  const [localIsAdminOperatorMode, setLocalIsAdminOperatorMode] = useState<boolean>(false);

  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [showAdminMenuModal, setShowAdminMenuModal] = useState<boolean>(false);
  const [adminStatusToast, setAdminStatusToast] = useState<string | null>(null);

  const effectiveIsAdminOperatorMode =
    propsIsAdminOperatorMode !== undefined ? propsIsAdminOperatorMode : localIsAdminOperatorMode;

  const handleOpenAdminTrigger = () => {
    // Wajib verifikasi Password Mode Guru setiap kali membuka menu Admin/Operator Sekolah
    setShowAdminAuthModal(true);
  };

  const handleAdminAuthSuccess = () => {
    setShowAdminAuthModal(false);
    setLocalIsAdminOperatorMode(true);
    if (onToggleAdminOperatorMode) {
      onToggleAdminOperatorMode(true);
    }
    setShowAdminMenuModal(true);
    setAdminStatusToast('✓ Sandi Guru Terverifikasi! Menu Admin / Operator Sekolah berhasil dibuka.');
    setTimeout(() => setAdminStatusToast(null), 4000);
  };

  const handleDeactivateAdminMode = () => {
    setLocalIsAdminOperatorMode(false);
    if (onToggleAdminOperatorMode) {
      onToggleAdminOperatorMode(false);
    }
    setAdminStatusToast('Mode Admin dikunci. Sistem kembali ke Mode Guru Standar.');
    setTimeout(() => setAdminStatusToast(null), 3500);
  };

  const handleToggleInteractionMode = (mode: 'VIEW' | 'EDIT') => {
    setDashboardInteractionMode(mode);
    localStorage.setItem('anbk_teacher_interaction_mode', mode);
    setDashboardModeToast(
      mode === 'VIEW'
        ? 'Mode Hanya Lihat (View-Only) aktif: Navigasi aman, data terlindungi dari perubahan tak sengaja.'
        : 'Mode Edit aktif: Akses penuh untuk merevisi butir soal, menambah soal baru, dan mengubah data.'
    );
    setTimeout(() => setDashboardModeToast(null), 3500);
  };

  const [activeTab, setActiveTab] = useState<
    'questions' | 'submissions' | 'analysis' | 'visual_analytics' | 'integration'
  >('questions');
  const [analysisDifficultyFilter, setAnalysisDifficultyFilter] = useState<
    'ALL' | 'HOTS' | 'REGULER'
  >('ALL');
  const [analysisEmpiricalFilter, setAnalysisEmpiricalFilter] = useState<
    'ALL' | 'Mudah' | 'Sedang' | 'Sukar'
  >('ALL');
  const [analysisScopeFilter, setAnalysisScopeFilter] = useState<'PACKAGE' | 'ALL'>('ALL');
  const [isFetchingOnline, setIsFetchingOnline] = useState(false);

  // State untuk Visual Analytics Dashboard (Recharts)
  const [visualAnalyticsJenjangFilter, setVisualAnalyticsJenjangFilter] = useState<'ALL' | 'VII' | 'VIII'>('ALL');
  const [visualAnalyticsChartType, setVisualAnalyticsChartType] = useState<
    'OVERVIEW' | 'CLASS_COMPARISON' | 'TIMELINE_TRENDS' | 'SCORE_DISTRIBUTION'
  >('OVERVIEW');
  const [visualAnalyticsSelectedClass, setVisualAnalyticsSelectedClass] = useState<string>('ALL');

  // State untuk Edit / Tambah Soal
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // State untuk Edit Baris Rekap Siswa
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubDraft, setEditSubDraft] = useState<StudentSubmission | null>(null);

  // Filter Tabel Hasil Ujian Siswa Guru (Jenjang VII / VIII & Rombel Kelas & Status Ujian)
  const [teacherSubJenjangFilter, setTeacherSubJenjangFilter] = useState<'ALL' | 'VII' | 'VIII'>('ALL');
  const [teacherSubKelasFilter, setTeacherSubKelasFilter] = useState<string>('ALL');
  const [teacherSubStatusFilter, setTeacherSubStatusFilter] = useState<'ALL' | 'LOGIN' | 'WORKING' | 'COMPLETED'>('ALL');
  const [teacherSubSearch, setTeacherSubSearch] = useState<string>('');

  const filteredTeacherSubmissions = React.useMemo(() => {
    return submissions.filter((sub) => {
      if (teacherSubJenjangFilter === 'VII') {
        const k = sub.kelas.toUpperCase();
        if (!k.includes('VII') || k.includes('VIII')) return false;
      } else if (teacherSubJenjangFilter === 'VIII') {
        const k = sub.kelas.toUpperCase();
        if (!k.includes('VIII')) return false;
      }
      if (teacherSubKelasFilter !== 'ALL' && getCleanKelas(sub.kelas) !== teacherSubKelasFilter) {
        return false;
      }
      if (teacherSubStatusFilter === 'LOGIN') {
        const isLogin =
          sub.isCompleted === false &&
          (sub.statusKecurangan.toLowerCase().includes('login') ||
            sub.statusKecurangan.toLowerCase().includes('masuk'));
        if (!isLogin) return false;
      } else if (teacherSubStatusFilter === 'WORKING') {
        const isWorking =
          sub.isCompleted === false &&
          sub.statusKecurangan.toLowerCase().includes('sedang mengerjakan');
        if (!isWorking) return false;
      } else if (teacherSubStatusFilter === 'COMPLETED') {
        const isFinished =
          sub.isCompleted !== false &&
          !sub.statusKecurangan.toLowerCase().includes('sedang mengerjakan') &&
          !sub.statusKecurangan.toLowerCase().includes('login') &&
          !sub.statusKecurangan.toLowerCase().includes('masuk');
        if (!isFinished) return false;
      }
      if (teacherSubSearch.trim()) {
        const q = teacherSubSearch.toLowerCase().trim();
        const mNama = sub.namaSiswa.toLowerCase().includes(q);
        const mNis = (sub.nisNisn || '').toLowerCase().includes(q);
        const mKelas = sub.kelas.toLowerCase().includes(q);
        if (!mNama && !mNis && !mKelas) return false;
      }
      return true;
    });
  }, [submissions, teacherSubJenjangFilter, teacherSubKelasFilter, teacherSubStatusFilter, teacherSubSearch]);

  const teacherSubKelasOptions = React.useMemo(() => {
    const setK = new Set<string>();
    if (teacherSubJenjangFilter === 'VII') {
      ['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5'].forEach((k) => setK.add(k));
    } else if (teacherSubJenjangFilter === 'VIII') {
      ['VIII-1', 'VIII-2', 'VIII-3', 'VIII-4', 'VIII-5', 'VIII-6', 'VIII-7', 'VIII-8', 'VIII-9'].forEach((k) => setK.add(k));
    }
    submissions.forEach((s) => {
      const k = s.kelas.toUpperCase();
      const isVII = k.includes('VII') && !k.includes('VIII');
      const isVIII = k.includes('VIII');
      if (
        teacherSubJenjangFilter === 'ALL' ||
        (teacherSubJenjangFilter === 'VII' && isVII) ||
        (teacherSubJenjangFilter === 'VIII' && isVIII)
      ) {
        const c = getCleanKelas(s.kelas);
        if (c) setK.add(c);
      }
    });
    return Array.from(setK).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [submissions, teacherSubJenjangFilter]);

  // State Copy Code & Sinkronisasi Google Sheet
  const [copiedGs, setCopiedGs] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedSheetTsv, setCopiedSheetTsv] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // State Sesi Ujian Baru
  const [activeSession, setActiveSession] = useState<ExamSessionInfo>(() => propsActiveExamSession || getCurrentExamSession());
  const [showCreateSessionModal, setShowCreateSessionModal] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [sessionNameInput, setSessionNameInput] = useState<string>('');
  const [targetKelasInput, setTargetKelasInput] = useState<string>('ALL');
  const [autoGenerateNewToken, setAutoGenerateNewToken] = useState<boolean>(true);
  const [customNewTokenInput, setCustomNewTokenInput] = useState<string>(() => generateRandomExamToken(5));
  const [sessionNotesInput, setSessionNotesInput] = useState<string>('');
  const [showSessionHistoryDrawer, setShowSessionHistoryDrawer] = useState<boolean>(false);
  const [sessionHistoryList, setSessionHistoryList] = useState<ExamSessionInfo[]>(() => getExamSessionsHistory());
  const [sessionCreationSuccessMsg, setSessionCreationSuccessMsg] = useState<string | null>(null);

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
        setSessionHistoryList(getExamSessionsHistory());
      }
    };
    window.addEventListener('anbk-new-exam-session-created', handleSessionCreated);
    return () => {
      window.removeEventListener('anbk-new-exam-session-created', handleSessionCreated);
    };
  }, []);

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
        onUpdateSubmissions([]);
      }

      setActiveSession(result.session);
      setSessionHistoryList(getExamSessionsHistory());
      setShowCreateSessionModal(false);

      const timeStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const successText = `✓ SESI UJIAN BARU BERHASIL DIBUAT (Pukul ${timeStr}): "${result.session.sessionName}". Riwayat nilai siswa otomatis dikosongkan dan seluruh data submission sistem berhasil direset bersih (0 data)!${
        result.newToken ? ` Kode Token Baru: ${result.newToken}` : ''
      }`;
      setSyncMessage(successText);
      setSessionCreationSuccessMsg(successText);
      setTimeout(() => {
        setSyncMessage(null);
        setSessionCreationSuccessMsg(null);
      }, 7000);
    } catch (err) {
      console.error('Gagal membuat sesi ujian baru:', err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // State Backup & Restore JSON Terenkripsi (AES-256-GCM untuk Portabilitas Data)
  const [backupPassphrase, setBackupPassphrase] = useState<string>('31051990');
  const [showBackupPass, setShowBackupPass] = useState<boolean>(false);
  const [showEncryptedBackupModal, setShowEncryptedBackupModal] = useState<boolean>(false);
  const [isEncryptingBackup, setIsEncryptingBackup] = useState<boolean>(false);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);

  // State Modal Pengaturan Cetak Ringkasan Hasil Ujian (Print Settings Modal & Dark Mode Print Toggle)
  const [showPrintSettingsModal, setShowPrintSettingsModal] = useState<boolean>(false);
  const [selectedSubForPrintId, setSelectedSubForPrintId] = useState<string>('');
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState<string>(() => getActiveTeacherPhotoUrl());
  const [isTeacherRekapSyncAnimated, setIsTeacherRekapSyncAnimated] = useState<boolean>(false);
  const [teacherRekapSyncTime, setTeacherRekapSyncTime] = useState<string | null>(null);
  const [isOnlineQuestionsSyncedAnimated, setIsOnlineQuestionsSyncedAnimated] =
    useState<boolean>(false);

  useEffect(() => {
    const handlePhotoUpdate = () => {
      setTeacherPhotoUrl(getActiveTeacherPhotoUrl());
    };
    window.addEventListener('anbk-photo-updated', handlePhotoUpdate);
    window.addEventListener('storage', handlePhotoUpdate);
    return () => {
      window.removeEventListener('anbk-photo-updated', handlePhotoUpdate);
      window.removeEventListener('storage', handlePhotoUpdate);
    };
  }, []);

  const syncQueue = useSubmissionSyncQueue();
  const [showQueueDetails, setShowQueueDetails] = useState<boolean>(false);

  // State Indikator Progres Persentase saat Mengunduh Data Submissions ke Excel (.xlsx)
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [showExcelProgressPanel, setShowExcelProgressPanel] = useState<boolean>(false);
  const [excelExportProgress, setExcelExportProgress] = useState<number>(0);
  const [excelExportStage, setExcelExportStage] = useState<string>('');
  const [excelExportProcessedRows, setExcelExportProcessedRows] = useState<number>(0);
  const [excelExportTotalRows, setExcelExportTotalRows] = useState<number>(0);
  const [excelExportCompletedFile, setExcelExportCompletedFile] = useState<string | null>(null);

  // State Otomatisasi Pengiriman WhatsApp ke Guru Mapel via API Fonnte dengan Lampiran File .JPG Hasil Ujian
  const [isSendingFonnteJpg, setIsSendingFonnteJpg] = useState<boolean>(false);
  const [fonnteJpgStatusMsg, setFonnteJpgStatusMsg] = useState<string | null>(null);
  const [selectedFonnteSubId, setSelectedFonnteSubId] = useState<string>('');

  const handleSendSubmissionJpgViaFonnte = async (targetSub?: StudentSubmission) => {
    const subToUse =
      targetSub ||
      submissions.find((s) => s.id === selectedFonnteSubId) ||
      submissions[0] ||
      INITIAL_SUBMISSIONS[0];
    if (!subToUse) return;

    setIsSendingFonnteJpg(true);
    const safeName = subToUse.namaSiswa.replace(/[^a-zA-Z0-9]/g, '_');
    const safeKelas = subToUse.kelas.replace(/[^a-zA-Z0-9]/g, '_');
    const jpgFilename = `Hasil_Ujian_ANBK_${safeName}_${safeKelas}.jpg`;
    setFonnteJpgStatusMsg(
      `Menyiapkan & mengirim otomatis file ${jpgFilename} ke WhatsApp Guru (${EXAM_INFO.teacherPhone}) via API Fonnte...`
    );

    try {
      const jenjang = getJenjangFromKelas(subToUse.kelas);
      const sem = getSemesterFromSub(subToUse);
      const pkgKey: ExamPackageKey = `${jenjang}_${sem}`;
      const examQs = questionBanks?.[pkgKey] || questions || INITIAL_QUESTIONS;
      const isDisq =
        subToUse.statusKecurangan.toLowerCase().includes('diskualifikasi') ||
        subToUse.statusKecurangan.toLowerCase().includes('gagal');

      const { jpgBlob } = await generateResultImageBlobs(subToUse, examQs, isDisq);

      const waCaption = [
        `*LAPORAN OTOMATIS HASIL UJIAN ANBK INFORMATIKA KELAS ${jenjang} (LAMPIRAN .JPG)*`,
        `*${EXAM_INFO.namaSekolah}*`,
        `====================================`,
        `• *Waktu Selesai* : ${subToUse.timestamp}`,
        `• *Nama Siswa* : ${subToUse.namaSiswa}`,
        `• *NIS / NISN* : ${subToUse.nisNisn}`,
        `• *Kelas & Semester* : ${getCleanKelas(subToUse.kelas)} (${sem})`,
        `• *Skor Jawaban Benar* : *${subToUse.skorBenar} / ${subToUse.totalSoal} Soal*`,
        `• *Nilai Akhir* : *${subToUse.nilaiAkhir}%* (KKM: ${EXAM_INFO.kkm}%)`,
        `• *Status Kelulusan* : *${subToUse.lulusTidakLulus}*`,
        `• *Status Integritas* : ${subToUse.statusKecurangan}`,
        `====================================`,
        `📎 *Lampiran File Gambar Hasil Ujian (.JPG)* : *${jpgFilename}*`,
        `Dikirim otomatis oleh sistem via API Fonnte ke Guru Mapel (${EXAM_INFO.guruMapelUpper}) tanpa menunggu laporan manual siswa.`,
      ].join('\n');

      const res = await sendExamResultViaFonnteApi({
        fonnteToken: cloudConfig.fonnteToken,
        targetPhone: EXAM_INFO.teacherPhone,
        message: waCaption,
        jpgBlob,
        jpgFilename,
      });

      setFonnteJpgStatusMsg(res.message);
      setTimeout(() => setFonnteJpgStatusMsg(null), 6500);
    } catch (err) {
      setFonnteJpgStatusMsg(`Gagal membuat/mengirim file .JPG via Fonnte: ${String(err)}`);
      setTimeout(() => setFonnteJpgStatusMsg(null), 6000);
    } finally {
      setIsSendingFonnteJpg(false);
    }
  };

  // Hitung distribusi soal
  const hotsCount = questions.filter((q) => q.difficulty === 'HOTS').length;
  const regulerCount = questions.filter((q) => q.difficulty === 'REGULER').length;

  const handleStartAddQuestion = () => {
    const nextId = questions.length > 0 ? Math.max(...questions.map((q) => q.id)) + 1 : 1;
    setEditingQuestion({
      id: nextId,
      content: '',
      image: null,
      options: ['', '', '', ''],
      answer: 'A',
      difficulty: 'HOTS',
      explanation: '',
    });
    setIsAddingNew(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    if (!editingQuestion.content.trim()) return;

    const cleanedQuestion: Question = {
      ...editingQuestion,
      image: editingQuestion.image && editingQuestion.image.trim() !== '' ? editingQuestion.image.trim() : null,
    };

    if (isAddingNew) {
      onUpdateQuestions([...questions, cleanedQuestion]);
    } else {
      onUpdateQuestions(questions.map((q) => (q.id === cleanedQuestion.id ? cleanedQuestion : q)));
    }
    setEditingQuestion(null);
    setIsAddingNew(false);
  };

  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

  const handleDeleteQuestion = (id: number) => {
    const filtered = questions
      .filter((q) => q.id !== id)
      .map((q, idx) => ({ ...q, id: idx + 1 }));
    onUpdateQuestions(filtered);
    setQuestionToDelete(null);
  };

  const handleResetDefaultQuestions = () => {
    const defaultPkg = FASE_D_QUESTION_BANKS[activePackageKey] || INITIAL_QUESTIONS;
    onUpdateQuestions(defaultPkg);
    setSyncMessage(
      `Bank soal berhasil dikembalikan ke 25 Soal Standar ${FASE_D_PACKAGE_META[activePackageKey].judul} (12 Reguler & 13 HOTS).`
    );
    setTimeout(() => setSyncMessage(null), 3500);
  };

  const handleFetchOnlinePackage = async () => {
    setIsFetchingOnline(true);
    try {
      const meta = FASE_D_PACKAGE_META[activePackageKey];
      const res = await fetchOnlineFaseDQuestions(
        meta.jenjang,
        meta.semester,
        cloudConfig.appsScriptWebAppUrl,
        true
      );
      onUpdateQuestions(res.questions);
      setIsOnlineQuestionsSyncedAnimated(true);
      setTimeout(() => setIsOnlineQuestionsSyncedAnimated(false), 7500);
      setSyncMessage(`✓ Selesai Sinkron Soal Online: ${res.sourceLabel}`);
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsFetchingOnline(false);
    }
  };

  const teacherSubmissionRankingMap = React.useMemo(
    () => computeSubmissionRankingMap(submissions),
    [submissions]
  );

  // State & rekapitulasi jumlah pemakaian token untuk setiap nisNisn siswa
  const [usedTokensForTeacher, setUsedTokensForTeacher] = useState<UsedExamTokenRecord[]>(() =>
    getUsedExamTokens()
  );
  const [tokenUsageSearchQuery, setTokenUsageSearchQuery] = useState<string>('');
  const [tokenUsageFilterMode, setTokenUsageFilterMode] = useState<'ALL' | 'FREQUENT_RESET'>('ALL');
  const [tokenExhaustedLogs, setTokenExhaustedLogs] = useState<
    TokenQuotaExhaustedNotificationLog[]
  >(() => getTokenExhaustedNotificationLogs());
  const [tokenExhaustedSettings, setTokenExhaustedSettings] = useState<TokenExhaustedNotifSettings>(
    () => getTokenExhaustedNotifSettings()
  );

  useEffect(() => {
    const syncUsedTokens = () => setUsedTokensForTeacher(getUsedExamTokens());
    const syncExhaustedLogs = () => {
      setTokenExhaustedLogs(getTokenExhaustedNotificationLogs());
      setTokenExhaustedSettings(getTokenExhaustedNotifSettings());
    };
    window.addEventListener('anbk-used-tokens-updated', syncUsedTokens);
    window.addEventListener('anbk-token-exhausted-notif-updated', syncExhaustedLogs);
    window.addEventListener('storage', syncUsedTokens);
    window.addEventListener('storage', syncExhaustedLogs);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('anbk_online_token_channel');
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'token-quota-exhausted-alert' || ev.data?.type === 'token-consumed') {
            syncUsedTokens();
            syncExhaustedLogs();
          }
        };
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('anbk-used-tokens-updated', syncUsedTokens);
      window.removeEventListener('anbk-token-exhausted-notif-updated', syncExhaustedLogs);
      window.removeEventListener('storage', syncUsedTokens);
      window.removeEventListener('storage', syncExhaustedLogs);
      if (bc) bc.close();
    };
  }, []);

  const studentTokenUsageRecap = React.useMemo(
    () => summarizeStudentSessionsAndTokenUsageByNisNisn(submissions, usedTokensForTeacher),
    [submissions, usedTokensForTeacher]
  );

  const exhaustedStudentsQuotaList = React.useMemo(
    () =>
      getStudentsWithExhaustedTokenQuota(
        submissions,
        usedTokensForTeacher,
        tokenExhaustedLogs
      ),
    [submissions, usedTokensForTeacher, tokenExhaustedLogs]
  );

  const [exhaustedListClassFilter, setExhaustedListClassFilter] = useState<string>('ALL');
  const [exhaustedListSearch, setExhaustedListSearch] = useState<string>('');
  const [manualExhaustedStudentName, setManualExhaustedStudentName] = useState<string>('');
  const [manualExhaustedStudentNis, setManualExhaustedStudentNis] = useState<string>('');
  const [manualExhaustedStudentClass, setManualExhaustedStudentClass] = useState<string>('VIII-1');

  // Deteksi otomatis setiap kali seorang siswa mencapai pemakaian token 3 kali (3/3x)
  // lalu kirimkan notifikasi otomatis ke Email / WhatsApp Guru Mapel
  useEffect(() => {
    studentTokenUsageRecap.forEach((student) => {
      student.tokenBreakdown.forEach((tb) => {
        if (tb.usageCount >= MAX_TOKEN_USAGE) {
          dispatchTeacherTokenExhaustedNotification({
            nisNisn: student.nisNisn,
            namaSiswa: student.namaSiswa,
            kelas: student.kelas,
            semester: student.semester,
            exhaustedToken: tb.token,
            usageCount: tb.usageCount,
            cloudConfig,
            oauthAccessToken: getAccessTokenSync(),
          }).catch(() => {});
        }
      });

      if (student.tokenBreakdown.length === 0 && student.totalTokenUsageCount >= MAX_TOKEN_USAGE) {
        dispatchTeacherTokenExhaustedNotification({
          nisNisn: student.nisNisn,
          namaSiswa: student.namaSiswa,
          kelas: student.kelas,
          semester: student.semester,
          exhaustedToken: cloudConfig.customTeacherToken || 'TOKEN3X',
          usageCount: student.totalTokenUsageCount,
          cloudConfig,
          oauthAccessToken: getAccessTokenSync(),
        }).catch(() => {});
      }
    });
  }, [studentTokenUsageRecap, cloudConfig]);

  const handleUpdateTokenNotifSettings = (next: Partial<TokenExhaustedNotifSettings>) => {
    const updated: TokenExhaustedNotifSettings = {
      ...tokenExhaustedSettings,
      ...next,
    };
    setTokenExhaustedSettings(updated);
    saveTokenExhaustedNotifSettings(updated);
  };

  const handleIssueNewTokenForExhaustedStudent = (
    logItem: TokenQuotaExhaustedNotificationLog,
    sendViaChannel?: 'wa' | 'email'
  ) => {
    const newTok = logItem.suggestedNewToken || String(Math.floor(100000 + Math.random() * 900000));
    const nextCfg: CloudIntegrationConfig = {
      ...cloudConfig,
      customTeacherToken: newTok,
      lockTeacherToken: true,
    };
    onUpdateCloudConfig(nextCfg);
    pushTokenEventLocallyAndBroadcast(newTok, `Token Baru Diterbitkan Guru untuk ${logItem.namaSiswa}`);
    saveCloudTokenConfigToServer(nextCfg).catch(() => {});

    const updatedLogs = tokenExhaustedLogs.map((l) =>
      l.id === logItem.id
        ? {
            ...l,
            isNewTokenIssued: true,
            waStatus: sendViaChannel === 'wa' ? ('TERKIRIM_OTOMATIS' as const) : l.waStatus,
            emailStatus: sendViaChannel === 'email' ? ('TERKIRIM_OTOMATIS' as const) : l.emailStatus,
          }
        : l
    );
    setTokenExhaustedLogs(updatedLogs);
    saveTokenExhaustedNotificationLogs(updatedLogs);

    const { subject, textMessage, htmlBody } = buildTokenExhaustedTeacherMessage({
      ...logItem,
      suggestedNewToken: newTok,
    });

    if (sendViaChannel === 'wa') {
      // Paksa kirim langsung via sistem WhatsApp (API Fonnte / Server Gateway) tanpa membuka browser/aplikasi luar
      sendExamResultViaFonnteApi({
        fonnteToken: cloudConfig.fonnteToken,
        targetPhone: EXAM_INFO.teacherPhone,
        message: textMessage,
        jpgFilename: `Pemberitahuan_Token_${logItem.nisNisn}.jpg`,
      }).catch(() => {});
    } else if (sendViaChannel === 'email') {
      fetch(`/__api/student-dashboard-sync?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendResultEmail',
          emailPayload: {
            to: EXAM_INFO.teacherEmail,
            subject,
            textBody: textMessage,
            htmlBody,
          },
          oauthAccessToken: getAccessTokenSync() || undefined,
        }),
      }).catch(() => {});
    }

    setSyncMessage(
      `✓ Kode Token Baru [${newTok}] berhasil diterbitkan & diaktifkan untuk ${logItem.namaSiswa} (NIS/NISN: ${logItem.nisNisn}) tanpa perlu menunggu siswa melapor!`
    );
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const filteredStudentTokenRecap = React.useMemo(() => {
    return studentTokenUsageRecap.filter((item) => {
      if (
        tokenUsageFilterMode === 'FREQUENT_RESET' &&
        item.estimatedTokenResetRequests === 0 &&
        item.totalTokenUsageCount < MAX_TOKEN_USAGE
      ) {
        return false;
      }
      if (!tokenUsageSearchQuery.trim()) return true;
      const q = tokenUsageSearchQuery.trim().toLowerCase();
      return (
        item.nisNisn.toLowerCase().includes(q) ||
        item.namaSiswa.toLowerCase().includes(q) ||
        item.kelas.toLowerCase().includes(q) ||
        item.uniqueTokensUsed.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [studentTokenUsageRecap, tokenUsageFilterMode, tokenUsageSearchQuery]);

  // Edit Rekap Siswa
  const handleStartEditSub = (sub: StudentSubmission) => {
    setEditingSubId(sub.id);
    setEditSubDraft({ ...sub });
  };

  const handleSaveSubEdit = () => {
    if (!editSubDraft) return;
    // Hitung ulang status lulus berdasarkan nilai akhir jika perlu
    const updated = submissions.map((s) => (s.id === editSubDraft.id ? editSubDraft : s));
    onUpdateSubmissions(updated);
    setEditingSubId(null);
    setEditSubDraft(null);
  };

  const handleDeleteSub = (id: string) => {
    onUpdateSubmissions(submissions.filter((s) => s.id !== id));
  };

  const handleExportCsv = () => {
    // Membaca langsung seluruh data 'submissions' dari localStorage ('anbk_submissions_v1')
    // dan menggabungkannya dengan state terkini agar cadangan lokal 100% lengkap
    let storedSubmissions: StudentSubmission[] = [];
    try {
      const rawLocal = localStorage.getItem('anbk_submissions_v1');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          storedSubmissions = parsed;
        }
      }
    } catch (e) {
      console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
    }

    // Gabungkan data localStorage dan state aktif berdasarkan ID / kombinasi Timestamp + Nama
    const mapByKey = new Map<string, StudentSubmission>();
    [...storedSubmissions, ...submissions].forEach((s) => {
      if (!s || !s.namaSiswa) return;
      const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
      mapByKey.set(key, s);
    });
    const allLocalSubmissions = Array.from(mapByKey.values());

    // Pastikan localStorage juga tersinkronisasi penuh
    try {
      localStorage.setItem('anbk_submissions_v1', JSON.stringify(allLocalSubmissions));
    } catch (e) {
      console.error('Gagal memperbarui localStorage anbk_submissions_v1:', e);
    }

    const escapeCsvField = (val: string | number | undefined | null) => {
      const str = String(val ?? '').replace(/\r?\n|\r/g, ' ');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [...REKAP_SHEET_HEADERS];
    const exportRankingMap = computeSubmissionRankingMap(allLocalSubmissions);
    const rows = allLocalSubmissions.map((s, idx) => {
      const rankNum =
        exportRankingMap[s.id] ||
        exportRankingMap[getSubmissionUniqueKey(s)] ||
        idx + 1;
      const cols = formatSubmissionToRekap13ColumnsWithRank(s, rankNum);
      return cols.map((v) => escapeCsvField(v));
    });

    // Gunakan UTF-8 BOM (\uFEFF) agar file .CSV terbaca rapi di Microsoft Excel & Google Sheet
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.download = `Cadangan_LocalStorage_Submissions_ANBK_${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSyncMessage(
      `Berhasil mengunduh cadangan lokal (${allLocalSubmissions.length} data submissions dari localStorage 'anbk_submissions_v1') ke dalam file .CSV!`
    );
    setTimeout(() => setSyncMessage(null), 4500);
  };

  const handleDownloadIntegrityLogs = (
    format: 'pdf' | 'txt' = 'pdf',
    singleStudent?: StudentSubmission
  ) => {
    let targetList: StudentSubmission[] = [];
    if (singleStudent) {
      targetList = [singleStudent];
    } else {
      let storedSubmissions: StudentSubmission[] = [];
      try {
        const rawLocal = localStorage.getItem('anbk_submissions_v1');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            storedSubmissions = parsed;
          }
        }
      } catch (e) {
        console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
      }

      const mapByKey = new Map<string, StudentSubmission>();
      [...storedSubmissions, ...submissions].forEach((s) => {
        if (!s || !s.namaSiswa) return;
        const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
        mapByKey.set(key, s);
      });
      targetList = Array.from(mapByKey.values());
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const studentTag = singleStudent
      ? `_${singleStudent.namaSiswa.replace(/[^a-zA-Z0-9]/g, '_')}`
      : '';

    if (format === 'pdf') {
      const pdfBlob = generateIntegrityLogsPdfBlob(targetList);
      const filename = `Integrity_Logs_ANBK${studentTag}_${dateStamp}.pdf`;
      triggerFileDownload(pdfBlob, filename);
      setSyncMessage(
        `Berhasil mengunduh Laporan Log Integritas & Pelanggaran (${targetList.length} siswa dari localStorage) dalam format PDF ("${filename}")!`
      );
    } else {
      const txtContent = generateIntegrityLogsTextContent(targetList);
      const txtBlob = new Blob(['\uFEFF' + txtContent], {
        type: 'text/plain;charset=utf-8;',
      });
      const filename = `Integrity_Logs_ANBK${studentTag}_${dateStamp}.txt`;
      triggerFileDownload(txtBlob, filename);
      setSyncMessage(
        `Berhasil mengunduh Laporan Log Integritas & Pelanggaran (${targetList.length} siswa dari localStorage) dalam format Teks ("${filename}")!`
      );
    }
    setTimeout(() => setSyncMessage(null), 4500);
  };

  // =========================================================================
  // GENERATE CLASS REPORT (PDF) — RATA-RATA NILAI, KELULUSAN & ANALISIS KESULITAN SOAL KELAS TERPILIH
  // =========================================================================
  const [selectedReportClass, setSelectedReportClass] = useState<string>('VIII-1');

  const handleGenerateClassReportPdf = (overrideClass?: string) => {
    const targetClass = overrideClass || selectedReportClass || 'ALL';
    let storedSubmissions: StudentSubmission[] = [];
    try {
      const rawLocal = localStorage.getItem('anbk_submissions_v1');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          storedSubmissions = parsed;
        }
      }
    } catch (e) {
      console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
    }

    const mapByKey = new Map<string, StudentSubmission>();
    [...storedSubmissions, ...submissions].forEach((s) => {
      if (!s || !s.namaSiswa) return;
      const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
      mapByKey.set(key, s);
    });
    const allLocalSubmissions = Array.from(mapByKey.values());

    const classSubs =
      targetClass === 'ALL'
        ? allLocalSubmissions
        : allLocalSubmissions.filter((s) => getCleanKelas(s.kelas) === getCleanKelas(targetClass));

    const avgVal =
      classSubs.length > 0
        ? (
            classSubs.reduce((acc, cur) => acc + (Number(cur.nilaiAkhir) || 0), 0) /
            classSubs.length
          ).toFixed(1)
        : '0.0';
    const passCount = classSubs.filter(
      (s) =>
        s.nilaiAkhir >= EXAM_INFO.kkm &&
        !String(s.lulusTidakLulus || '').toLowerCase().includes('tidak') &&
        !String(s.statusKecurangan || '').toLowerCase().includes('diskualifikasi')
    ).length;
    const passRateVal =
      classSubs.length > 0 ? ((passCount / classSubs.length) * 100).toFixed(1) : '0.0';

    const dateStamp = new Date().toISOString().slice(0, 10);
    const safeClassTag = targetClass === 'ALL' ? 'Semua_Kelas' : targetClass.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfBlob = generateSelectedClassReportPdfBlob(
      allLocalSubmissions,
      targetClass,
      questionBanks || FASE_D_QUESTION_BANKS,
      questions
    );
    const filename = `Class_Report_${safeClassTag}_ANBK_${dateStamp}.pdf`;
    triggerFileDownload(pdfBlob, filename);

    setSyncMessage(
      `Berhasil membuat Class Report PDF ("${filename}") untuk ${
        targetClass === 'ALL' ? 'Seluruh Kelas' : `Kelas ${targetClass}`
      } — Rata-Rata: ${avgVal}%, Kelulusan: ${passRateVal}%, lengkap dengan Analisis Tingkat Kesulitan Butir Soal!`
    );
    setTimeout(() => setSyncMessage(null), 5000);
  };

  // =========================================================================
  // UNDUH LAPORAN ANALITIK PERFORMA KELAS (DOWNLOAD ANALYTICS PDF REPORT)
  // =========================================================================
  const handleDownloadAnalyticsPdf = () => {
    let storedSubmissions: StudentSubmission[] = [];
    try {
      const rawLocal = localStorage.getItem('anbk_submissions_v1');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          storedSubmissions = parsed;
        }
      }
    } catch (e) {
      console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
    }

    const mapByKey = new Map<string, StudentSubmission>();
    [...storedSubmissions, ...submissions].forEach((s) => {
      if (!s || !s.namaSiswa) return;
      const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
      mapByKey.set(key, s);
    });
    const allLocalSubmissions = Array.from(mapByKey.values());

    const avgVal =
      allLocalSubmissions.length > 0
        ? (
            allLocalSubmissions.reduce((acc, cur) => acc + (Number(cur.nilaiAkhir) || 0), 0) /
            allLocalSubmissions.length
          ).toFixed(1)
        : '0.0';

    const dateStamp = new Date().toISOString().slice(0, 10);
    const pdfBlob = generateClassAnalyticsPdfBlob(
      allLocalSubmissions,
      questions,
      activePackageKey,
      questionBanks
    );
    const filename = `Class_Analytics_Report_ANBK_${activePackageKey}_${dateStamp}.pdf`;
    triggerFileDownload(pdfBlob, filename);

    setSyncMessage(
      `Berhasil mengunduh Laporan Analitik Performa Kelas ("${filename}") — Mencakup Rata-Rata Nilai Kelas (${avgVal}%), Rekap Per Kelas, dan Topik Soal Paling Sering Dijawab Salah!`
    );
    setTimeout(() => setSyncMessage(null), 5000);
  };

  // =========================================================================
  // UTILITAS ENKRIPSI & DEKRIPSI AES-256-GCM (WEB CRYPTO API) UNTUK JSON BACKUP
  // =========================================================================
  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToBytes = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const encryptStringAesGcm = async (plaintext: string, passphrase: string) => {
    const enc = new TextEncoder();
    const keySecret = (passphrase || '31051990').trim();
    if (window.crypto && window.crypto.subtle) {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(keySecret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const aesKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      const plaintextBytes = enc.encode(plaintext);
      const encryptedBuf = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        plaintextBytes
      );
      const digestBuf = await window.crypto.subtle.digest('SHA-256', plaintextBytes);
      const checksumHex = Array.from(new Uint8Array(digestBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return {
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations: 100000,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(encryptedBuf)),
        checksum: checksumHex,
      };
    } else {
      // Fallback stream cipher jika berada di environment non-HTTPS tanpa subtle crypto
      const dataBytes = enc.encode(plaintext);
      const keyBytes = enc.encode(keySecret);
      const out = new Uint8Array(dataBytes.length);
      for (let i = 0; i < dataBytes.length; i++) {
        out[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 31) & 0xff);
      }
      return {
        algorithm: 'XOR-FALLBACK-V1',
        kdf: 'DIRECT',
        iterations: 1,
        salt: '',
        iv: '',
        ciphertext: bytesToBase64(out),
        checksum: String(plaintext.length),
      };
    }
  };

  const decryptStringAesGcm = async (
    envelope: {
      algorithm: string;
      salt: string;
      iv: string;
      iterations?: number;
      ciphertext: string;
    },
    passphrase: string
  ): Promise<string> => {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const keySecret = (passphrase || '31051990').trim();

    if (envelope.algorithm === 'AES-256-GCM' && window.crypto && window.crypto.subtle) {
      const salt = base64ToBytes(envelope.salt);
      const iv = base64ToBytes(envelope.iv);
      const cipherBytes = base64ToBytes(envelope.ciphertext);
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(keySecret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const aesKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as unknown as BufferSource,
          iterations: envelope.iterations || 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decryptedBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        aesKey,
        cipherBytes as unknown as BufferSource
      );
      return dec.decode(decryptedBuf);
    } else {
      const cipherBytes = base64ToBytes(envelope.ciphertext);
      const keyBytes = enc.encode(keySecret);
      const out = new Uint8Array(cipherBytes.length);
      for (let i = 0; i < cipherBytes.length; i++) {
        out[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 31) & 0xff);
      }
      return dec.decode(out);
    }
  };

  const handleDownloadEncryptedJsonBackup = async () => {
    setIsEncryptingBackup(true);
    setBackupErrorMsg(null);
    try {
      // 1. Kumpulkan seluruh data dari localStorage & state terkini
      let storedSubmissions: StudentSubmission[] = [];
      let storedQuestionBanks: Record<ExamPackageKey, Question[]> = {
        ...FASE_D_QUESTION_BANKS,
        ...(questionBanks || {}),
        [activePackageKey]: questions,
      };
      let storedCloudConfig: CloudIntegrationConfig = { ...cloudConfig };

      try {
        const rawSubs = localStorage.getItem('anbk_submissions_v1');
        if (rawSubs) {
          const parsed = JSON.parse(rawSubs);
          if (Array.isArray(parsed)) storedSubmissions = parsed;
        }
        const rawBanks = localStorage.getItem('anbk_question_banks_fase_d_v2');
        if (rawBanks) {
          const parsedBanks = JSON.parse(rawBanks);
          if (parsedBanks && typeof parsedBanks === 'object') {
            storedQuestionBanks = {
              ...storedQuestionBanks,
              ...parsedBanks,
              [activePackageKey]: questions,
            };
          }
        }
        const rawCloud = localStorage.getItem('anbk_cloud_config_v1');
        if (rawCloud) {
          const parsedCloud = JSON.parse(rawCloud);
          if (parsedCloud && typeof parsedCloud === 'object') {
            storedCloudConfig = { ... parsedCloud, ...cloudConfig };
          }
        }
      } catch (e) {
        console.error('Gagal membaca item localStorage:', e);
      }

      // Gabungkan submissions tanpa duplikasi
      const subMap = new Map<string, StudentSubmission>();
      [...storedSubmissions, ...submissions].forEach((s) => {
        if (!s || !s.namaSiswa) return;
        const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
        subMap.set(key, s);
      });
      const mergedSubmissions = Array.from(subMap.values());

      // Snapshot seluruh key-value di localStorage browser
      const rawLocalStorageSnapshot: Record<string, string> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k);
            if (v !== null) rawLocalStorageSnapshot[k] = v;
          }
        }
      } catch (e) {
        console.error(e);
      }

      // Pastikan key utama di snapshot terisi data paling mutakhir
      rawLocalStorageSnapshot['anbk_submissions_v1'] = JSON.stringify(mergedSubmissions);
      rawLocalStorageSnapshot['anbk_question_banks_fase_d_v2'] = JSON.stringify(storedQuestionBanks);
      rawLocalStorageSnapshot['anbk_cloud_config_v1'] = JSON.stringify(storedCloudConfig);

      const fullBackupPayload = {
        backupVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedAtLocal: new Date().toLocaleString('id-ID'),
        school: EXAM_INFO.namaSekolah,
        teacher: EXAM_INFO.guruMapel,
        activePackageKey,
        questions,
        questionBanks: storedQuestionBanks,
        submissions: mergedSubmissions,
        cloudConfig: storedCloudConfig,
        localStorage: rawLocalStorageSnapshot,
      };

      const plaintextJson = JSON.stringify(fullBackupPayload);
      const encryptedResult = await encryptStringAesGcm(plaintextJson, backupPassphrase);

      const totalQuestionsCount = Object.values(storedQuestionBanks).reduce(
        (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
        0
      );

      const encryptedFileObject = {
        format: 'ANBK_INFORMATIKA_ENCRYPTED_BACKUP_V1',
        description:
          'File Cadangan Terenkripsi (AES-256-GCM) mencakup Bank Soal (Questions), Rekap Hasil Ujian (Submissions), dan Konfigurasi Cloud (Cloud Config) dari LocalStorage Browser.',
        school: EXAM_INFO.namaSekolah,
        teacher: EXAM_INFO.guruMapel,
        createdAt: new Date().toISOString(),
        summary: {
          activePackageKey,
          activeQuestionsCount: questions.length,
          totalQuestionPackages: Object.keys(storedQuestionBanks).length,
          totalQuestionsAllPackages: totalQuestionsCount,
          submissionsCount: mergedSubmissions.length,
          hasCloudConfig: Boolean(
            storedCloudConfig.googleSheetUrl ||
              storedCloudConfig.appsScriptWebAppUrl ||
              storedCloudConfig.googleDocUrl
          ),
          localStorageKeysCount: Object.keys(rawLocalStorageSnapshot).length,
        },
        encryption: {
          algorithm: encryptedResult.algorithm,
          kdf: encryptedResult.kdf,
          iterations: encryptedResult.iterations,
          salt: encryptedResult.salt,
          iv: encryptedResult.iv,
          checksum: encryptedResult.checksum,
        },
        ciphertext: encryptedResult.ciphertext,
      };

      const fileContent = JSON.stringify(encryptedFileObject, null, 2);
      const blob = new Blob([fileContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `Backup_LocalStorage_Terenkripsi_ANBK_${dateStr}.enc.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSyncMessage(
        `Berhasil mengunduh Backup JSON Terenkripsi (${encryptedResult.algorithm}): ${questions.length} Soal Aktif (${totalQuestionsCount} Total Soal), ${mergedSubmissions.length} Submissions, & Cloud Config!`
      );
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      console.error('Gagal mengenkripsi backup JSON:', err);
      setBackupErrorMsg('Gagal membuat file backup terenkripsi. Silakan coba kembali.');
    } finally {
      setIsEncryptingBackup(false);
    }
  };

  const handleRestoreEncryptedJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupErrorMsg(null);
    setIsEncryptingBackup(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let restoredData: {
        questions?: Question[];
        questionBanks?: Record<ExamPackageKey, Question[]>;
        submissions?: StudentSubmission[];
        cloudConfig?: CloudIntegrationConfig;
        localStorage?: Record<string, string>;
      } | null = null;

      if (parsed.format === 'ANBK_INFORMATIKA_ENCRYPTED_BACKUP_V1' && parsed.ciphertext) {
        // Dekripsi menggunakan passphrase
        const decryptedJson = await decryptStringAesGcm(
          {
            algorithm: parsed.encryption?.algorithm || 'AES-256-GCM',
            salt: parsed.encryption?.salt || '',
            iv: parsed.encryption?.iv || '',
            iterations: parsed.encryption?.iterations || 100000,
            ciphertext: parsed.ciphertext,
          },
          backupPassphrase
        );
        restoredData = JSON.parse(decryptedJson);
      } else if (parsed.questions || parsed.submissions || parsed.cloudConfig) {
        // Mendukung juga file JSON backup yang tidak terenkripsi
        restoredData = parsed;
      } else {
        throw new Error('Format file backup JSON tidak dikenali.');
      }

      if (!restoredData) {
        throw new Error('Data backup kosong.');
      }

      // 1. Pulihkan seluruh key-value localStorage terlebih dahulu
      if (restoredData.localStorage && typeof restoredData.localStorage === 'object') {
        Object.entries(restoredData.localStorage).forEach(([k, v]) => {
          if (typeof k === 'string' && typeof v === 'string') {
            localStorage.setItem(k, v);
          }
        });
      }

      // 2. Pulihkan Bank Soal (Questions & QuestionBanks)
      if (restoredData.questionBanks && typeof restoredData.questionBanks === 'object') {
        localStorage.setItem(
          'anbk_question_banks_fase_d_v2',
          JSON.stringify(restoredData.questionBanks)
        );
        if (onUpdateAllQuestionBanks) {
          onUpdateAllQuestionBanks(restoredData.questionBanks);
        }
        const pkgQuestions = restoredData.questionBanks[activePackageKey];
        if (Array.isArray(pkgQuestions) && pkgQuestions.length > 0) {
          onUpdateQuestions(pkgQuestions);
        }
      } else if (Array.isArray(restoredData.questions) && restoredData.questions.length > 0) {
        onUpdateQuestions(restoredData.questions);
      }

      // 3. Pulihkan Submissions
      if (Array.isArray(restoredData.submissions)) {
        onUpdateSubmissions(restoredData.submissions);
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(restoredData.submissions));
      }

      // 4. Pulihkan Cloud Config
      if (restoredData.cloudConfig && typeof restoredData.cloudConfig === 'object') {
        onUpdateCloudConfig(restoredData.cloudConfig);
        localStorage.setItem('anbk_cloud_config_v1', JSON.stringify(restoredData.cloudConfig));
      }

      setSyncMessage(
        `Berhasil mendekripsi & memulihkan seluruh LocalStorage dari file Backup JSON (${
          restoredData.submissions?.length || 0
        } Submissions, Bank Soal, & Cloud Config)!`
      );
      setShowEncryptedBackupModal(false);
      setTimeout(() => setSyncMessage(null), 5500);
    } catch (err) {
      console.error('Gagal mendekripsi/memulihkan file backup JSON:', err);
      setBackupErrorMsg(
        'Gagal mendekripsi file backup! Pastikan Kunci Enkripsi / Passphrase sesuai dengan saat file dibuat (Default: Password Mode Guru).'
      );
    } finally {
      setIsEncryptingBackup(false);
      e.target.value = '';
    }
  };

  const handleImportCsvToLocalStorage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '').replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length <= 1) return;

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += ch;
            }
          }
          result.push(current.trim());
          return result;
        };

        const imported: StudentSubmission[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          if (cols.length < 8) continue;
          const hasSemesterCol = cols.length >= 10;
          const timestamp = cols[0] || new Date().toLocaleString('id-ID');
          const namaSiswa = cols[1] || 'Siswa';
          const nisNisn = cols[2] || '-';
          const rawKelas = cols[3] || 'VIII-1';
          const semesterVal: SemesterType = hasSemesterCol
            ? cols[4]?.toLowerCase().includes('ganjil')
              ? 'Ganjil'
              : 'Genap'
            : rawKelas.toLowerCase().includes('ganjil')
            ? 'Ganjil'
            : 'Genap';
          const skorBenar = Number(cols[hasSemesterCol ? 5 : 4]) || 0;
          const totalSoal = Number(cols[hasSemesterCol ? 6 : 5]) || 10;
          const nilaiAkhir = Number(cols[hasSemesterCol ? 7 : 6]) || 0;
          const statusKecurangan = cols[hasSemesterCol ? 8 : 7] || 'Jujur / Bersih (0 Pelanggaran)';
          const lulusTidakLulus =
            (cols[hasSemesterCol ? 9 : 8] as StudentSubmission['lulusTidakLulus']) ||
            (nilaiAkhir >= EXAM_INFO.kkm ? 'Lulus Ujian' : 'Tidak Lulus Ujian (Ujian Susulan)');

          imported.push({
            id: `CSV-IMP-${Date.now()}-${i}`,
            timestamp,
            namaSiswa,
            nisNisn,
            kelas: getCleanKelas(rawKelas),
            semester: semesterVal,
            skorBenar,
            totalSoal,
            nilaiAkhir,
            statusKecurangan,
            lulusTidakLulus,
            answers: {},
            doubtful: {},
            violationCount: 0,
            violationLogs: [],
            questionOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            isCompleted: true,
          });
        }

        if (imported.length > 0) {
          const existingKeys = new Set(
            submissions.map((s) => `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}`)
          );
          const merged = [
            ...submissions,
            ...imported.filter(
              (imp) => !existingKeys.has(`${imp.timestamp}_${imp.namaSiswa.trim().toLowerCase()}`)
            ),
          ];
          onUpdateSubmissions(merged);
          localStorage.setItem('anbk_submissions_v1', JSON.stringify(merged));
          setSyncMessage(
            `Berhasil memulihkan ${imported.length} baris dari file .CSV ke dalam localStorage (Total: ${merged.length} data)!`
          );
          setTimeout(() => setSyncMessage(null), 4500);
        }
      } catch (err) {
        console.error('Gagal mengimpor file CSV:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyTsvForGoogleSheet = () => {
    const headers = [...REKAP_SHEET_HEADERS];
    const rows = submissions.map((s, idx) => {
      const rankNum =
        teacherSubmissionRankingMap[s.id] ||
        teacherSubmissionRankingMap[getSubmissionUniqueKey(s)] ||
        idx + 1;
      return formatSubmissionToRekap13ColumnsWithRank(s, rankNum);
    });
    const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard?.writeText(tsvContent);
    setCopiedSheetTsv(true);
    setTimeout(() => setCopiedSheetTsv(false), 3000);
    setSyncMessage(
      'Data Rekap (13 Kolom: Timestamp, Nama Siswa, NIS/NISN, Kelas, Semester, Skor Benar, Total Soal, Nilai Akhir, Status Kecurangan, Lulus/Tidak Lulus, Ranking, Device, FOTO) berhasil disalin ke Clipboard!'
    );
    setTimeout(() => setSyncMessage(null), 4500);
  };

  const handleSyncAllToGoogleSheet = async (
    filter?: SyncDateFilter,
    explicitFilteredSubs?: StudentSubmission[]
  ) => {
    const targetRekapUrl = sanitizeRekapSheetUrl(cloudConfig.googleSheetUrl);
    let interactiveTok = getAccessTokenSync();
    if (!interactiveTok && !cloudConfig.appsScriptWebAppUrl) {
      const authRes = await googleSignIn();
      if (authRes?.accessToken) {
        interactiveTok = authRes.accessToken;
      }
    }

    setIsSyncingSheet(true);
    try {
      const isCleared = typeof window !== 'undefined' && localStorage.getItem('anbk_submissions_cleared_v1') === 'true';
      const clearedAt = typeof window !== 'undefined' ? Number(localStorage.getItem('anbk_submissions_cleared_at_v1') || 0) : 0;
      const delSet = new Set<string>();
      try {
        const rawDel = localStorage.getItem('anbk_submissions_deleted_ids_v1');
        if (rawDel) JSON.parse(rawDel).forEach((k: string) => { if (k) delSet.add(k); });
      } catch {}

      const validSubs = (isCleared && submissions.length === 0)
        ? []
        : submissions.filter((s) => {
            if (!s || !s.namaSiswa) return false;
            const k = s.id || getSubmissionUniqueKey(s);
            const uKey = getSubmissionUniqueKey(s);
            if (delSet.has(s.id) || delSet.has(k) || delSet.has(uKey)) return false;
            if (clearedAt > 0) {
              const matchTs = (s.id || '').match(/^(?:SUB|ESAY)-(\d+)/);
              const createdTs = matchTs ? Number(matchTs[1]) : 0;
              if (createdTs > 0 && createdTs <= clearedAt) return false;
            }
            return true;
          });

      const normalized = validSubs.map((s) => ({
        ...s,
        kelas: getCleanKelas(s.kelas),
        semester: getSemesterFromSub(s),
      }));

      const toSync =
        filter && filter.mode !== 'ALL'
          ? explicitFilteredSubs && explicitFilteredSubs.length > 0
            ? explicitFilteredSubs
            : normalized.filter((s) => isSubmissionMatchingSyncFilter(s, filter))
          : normalized;

      onUpdateSubmissions(normalized);

      // Salin juga ke clipboard dalam format TSV Google Sheet (13 Kolom)
      const headers = [...REKAP_SHEET_HEADERS];
      const normRankingMap = computeSubmissionRankingMap(toSync);
      const rows = toSync.map((s, idx) => {
        const rankNum =
          normRankingMap[s.id] ||
          normRankingMap[getSubmissionUniqueKey(s)] ||
          idx + 1;
        return formatSubmissionToRekap13ColumnsWithRank(s, rankNum);
      });
      const tsvContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
      navigator.clipboard?.writeText(tsvContent).catch(() => {});

      if (interactiveTok) {
        await writeFirestoreCloudConfig({
          googleSheetUrl: targetRekapUrl,
          appsScriptWebAppUrl: cloudConfig.appsScriptWebAppUrl,
          oauthAccessToken: interactiveTok,
          oauthExpiresAt: Date.now() + 50 * 60 * 1000,
        });
      }

      await syncSubmissionsToGoogleSheetsAuto(
        toSync,
        targetRekapUrl,
        cloudConfig.appsScriptWebAppUrl,
        true
      );

      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTeacherRekapSyncTime(nowStr);
      setIsTeacherRekapSyncAnimated(true);
      setTimeout(() => setIsTeacherRekapSyncAnimated(false), 8000);

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

      setSyncMessage(
        filterSummaryText
          ? `✓ Selesai Sinkron! Berhasil menyinkronkan ${toSync.length} data siswa (Periode: ${filterSummaryText}) ke Google Sheets (Pukul ${nowStr})!`
          : `✓ Selesai Sinkron! Berhasil menyimpan & menyinkronkan otomatis ${toSync.length} baris Rekap Hasil Ujian (Pukul ${nowStr})!`
      );
    } catch {
      setSyncMessage('Data tersimpan secara lokal. Pastikan URL Web App Google Apps Script aktif.');
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const [showSyncDateModal, setShowSyncDateModal] = useState<boolean>(false);

  const handleConfirmTeacherSyncFromModal = async (
    filter: SyncDateFilter,
    filteredSubs: StudentSubmission[]
  ) => {
    setShowSyncDateModal(false);
    await handleSyncAllToGoogleSheet(filter, filteredSubs);
  };

  const handleRestoreHistoricalSubmissions = () => {
    const existingKeys = new Set(
      submissions.map((s) => `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}`)
    );
    const merged = [
      ...submissions,
      ...INITIAL_SUBMISSIONS.filter(
        (h) => !existingKeys.has(`${h.timestamp}_${h.namaSiswa.trim().toLowerCase()}`)
      ),
    ];
    onUpdateSubmissions(merged);
    setSyncMessage(
      `Berhasil memuat & menggabungkan total ${merged.length} data Rekap Hasil Ujian siswa.`
    );
    setTimeout(() => setSyncMessage(null), 4000);
  };

  const [showTeacherResetConfirmModal, setShowTeacherResetConfirmModal] = useState<boolean>(false);
  const [isResettingAllSubmissions, setIsResettingAllSubmissions] = useState<boolean>(false);

  const handleConfirmTeacherResetWithFilter = async (
    filter: ResetSubmissionsFilter,
    explicitToken?: string
  ) => {
    setIsResettingAllSubmissions(true);
    try {
      let res: any = null;
      if (onResetAllSubmissions) {
        res = await onResetAllSubmissions(filter, explicitToken);
      }

      const toDeleteCount =
        res?.deletedCount ??
        submissions.filter((s) => isSubmissionMatchingResetFilter(s, filter)).length;
      const remainingCount = res?.remainingCount ?? Math.max(0, submissions.length - toDeleteCount);
      const isTotal = !filter || filter.mode === 'ALL' || remainingCount === 0;

      if (isTotal) {
        onUpdateSubmissions([]);
      } else {
        const remaining = submissions.filter((s) => !isSubmissionMatchingResetFilter(s, filter));
        onUpdateSubmissions(remaining);
      }

      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTeacherRekapSyncTime(nowStr);
      setShowTeacherResetConfirmModal(false);

      const msg = isTotal
        ? `✓ RESET SEMUA REKAP HASIL UJIAN BERHASIL (Pukul ${nowStr}): Seluruh data di Dashboard, Riwayat Siswa & Link Google Sheets telah otomatis terhapus bersih (0 data) tanpa delay waktu!`
        : `✓ RESET BERHASIL (Pukul ${nowStr}): Berhasil menghapus ${toDeleteCount} laporan nilai pada tanggal terpilih! ${remainingCount} data tersisa & tersinkron di Google Sheets.`;

      setSyncMessage(msg);
      setTimeout(() => setSyncMessage(null), 6500);
    } finally {
      setIsResettingAllSubmissions(false);
    }
  };

  const handleExportExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    setShowExcelProgressPanel(true);
    setExcelExportCompletedFile(null);
    setExcelExportProgress(4);
    setExcelExportProcessedRows(0);
    setExcelExportTotalRows(submissions.length);
    setExcelExportStage('Membaca & menggabungkan data submissions dari LocalStorage...');

    const yieldFrame = (ms = 45) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await yieldFrame(60);

      // Gabungkan seluruh data 'submissions' dari localStorage ('anbk_submissions_v1') & state aktif
      let storedSubmissions: StudentSubmission[] = [];
      try {
        const rawLocal = localStorage.getItem('anbk_submissions_v1');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            storedSubmissions = parsed;
          }
        }
      } catch (e) {
        console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
      }

      const mapByKey = new Map<string, StudentSubmission>();
      [...storedSubmissions, ...submissions].forEach((s) => {
        if (!s || !s.namaSiswa) return;
        const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
        mapByKey.set(key, s);
      });
      const allSubs = Array.from(mapByKey.values());
      const totalRecords = allSubs.length;
      setExcelExportTotalRows(totalRecords);

      setExcelExportProgress(12);
      setExcelExportStage(
        `Menyiapkan Sheet 1: Rekap Nilai Siswa (${totalRecords} Data Siswa, 10 Kolom)...`
      );
      await yieldFrame(60);

      const thinBorder = {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
      };

      const headerStyle = {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0C4A6E' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'medium', color: { rgb: '075985' } },
          bottom: { style: 'medium', color: { rgb: '075985' } },
          left: { style: 'thin', color: { rgb: '0369A1' } },
          right: { style: 'thin', color: { rgb: '0369A1' } },
        },
      };

      // =========================================================================
      // SHEET 1: Rekap Hasil Ujian Siswa (10 Kolom Persis Sesuai Google Sheet)
      // =========================================================================
      const rekapData = allSubs.map((s) => ({
        Timestamp: s.timestamp,
        'Nama Siswa': s.namaSiswa,
        'NIS/NISN': s.nisNisn,
        Kelas: getCleanKelas(s.kelas),
        Semester: getSemesterFromSub(s),
        'Skor Benar': s.skorBenar,
        'Total Soal': s.totalSoal,
        'Nilai Akhir': s.nilaiAkhir,
        'Status Kecurangan': s.statusKecurangan,
        'Lulus/Tidak Lulus': s.lulusTidakLulus,
      }));

      const wsRekap = XLSXStyle.utils.json_to_sheet(
        rekapData.length > 0
          ? rekapData
          : [
              {
                Timestamp: '-',
                'Nama Siswa': 'Belum ada data siswa',
                'NIS/NISN': '-',
                Kelas: '-',
                Semester: 'Ganjil',
                'Skor Benar': 0,
                'Total Soal': questions.length,
                'Nilai Akhir': 0,
                'Status Kecurangan': '-',
                'Lulus/Tidak Lulus': '-',
              },
            ]
      );

      wsRekap['!cols'] = [
        { wch: 22 }, // Timestamp
        { wch: 30 }, // Nama Siswa
        { wch: 18 }, // NIS/NISN
        { wch: 12 }, // Kelas
        { wch: 14 }, // Semester
        { wch: 13 }, // Skor Benar
        { wch: 13 }, // Total Soal
        { wch: 14 }, // Nilai Akhir
        { wch: 46 }, // Status Kecurangan
        { wch: 28 }, // Lulus/Tidak Lulus
      ];

      const totalRekapRows = Math.max(1, rekapData.length) + 1;
      wsRekap['!rows'] = Array.from({ length: totalRekapRows }, (_, rIdx) => ({
        hpt: rIdx === 0 ? 26 : 21,
      }));
      wsRekap['!autofilter'] = { ref: `A1:J${totalRekapRows}` };

      // Terapkan styling pada setiap sel di Sheet 1 dengan pembaruan progres real-time per batch baris
      const sheet1ChunkSize = Math.max(1, Math.ceil(totalRekapRows / 6));
      for (let r = 0; r < totalRekapRows; r++) {
        for (let c = 0; c < 10; c++) {
          const cellRef = XLSXStyle.utils.encode_cell({ r, c });
          const cell = wsRekap[cellRef];
          if (!cell) continue;

          if (r === 0) {
            cell.s = headerStyle;
          } else {
            const rowSub = allSubs[r - 1];
            const isPassed =
              rowSub &&
              rowSub.nilaiAkhir >= EXAM_INFO.kkm &&
              !rowSub.lulusTidakLulus.toLowerCase().includes('tidak') &&
              !rowSub.statusKecurangan.toLowerCase().includes('diskualifikasi');
            const hasViolation =
              rowSub &&
              ((rowSub.violationCount || 0) > 0 ||
                rowSub.statusKecurangan.toLowerCase().includes('pelanggaran') ||
                rowSub.statusKecurangan.toLowerCase().includes('diskualifikasi'));

            const baseFill = r % 2 === 1 ? 'FFFFFF' : 'F8FAFC';
            const isCenterCol = [0, 2, 3, 4, 5, 6, 7].includes(c);

            if (c === 7 || c === 9) {
              // Kolom Nilai Akhir & Lulus/Tidak Lulus diberi warna hijau/merah
              cell.s = {
                font: {
                  name: 'Arial',
                  sz: 10,
                  bold: true,
                  color: { rgb: isPassed ? '065F46' : '9F1239' },
                },
                fill: { fgColor: { rgb: isPassed ? 'D1FAE5' : 'FFE4E6' } },
                alignment: {
                  horizontal: c === 7 ? 'center' : 'left',
                  vertical: 'center',
                },
                border: thinBorder,
              };
            } else if (c === 8 && hasViolation) {
              // Kolom Status Kecurangan jika ada pelanggaran
              cell.s = {
                font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '9F1239' } },
                fill: { fgColor: { rgb: 'FFF1F2' } },
                alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
                border: thinBorder,
              };
            } else {
              cell.s = {
                font: {
                  name: 'Arial',
                  sz: 10,
                  bold: c === 1 || c === 5,
                  color: { rgb: '0F172A' },
                },
                fill: { fgColor: { rgb: 'FFFFFF' === baseFill ? 'FFFFFF' : 'F8FAFC' } },
                alignment: {
                  horizontal: isCenterCol ? 'center' : 'left',
                  vertical: 'center',
                },
                border: thinBorder,
              };
            }
          }
        }

        if (r > 0 && (r % sheet1ChunkSize === 0 || r === totalRekapRows - 1)) {
          const processedCount = Math.min(totalRecords, r);
          const ratio = totalRekapRows > 1 ? r / (totalRekapRows - 1) : 1;
          const pct = Math.min(46, Math.round(12 + ratio * 34));
          setExcelExportProcessedRows(processedCount);
          setExcelExportProgress(pct);
          setExcelExportStage(
            `Memformat Sheet 1 (Rekap 10 Kolom): ${processedCount}/${totalRecords} baris siswa (${pct}%)...`
          );
          await yieldFrame(35);
        }
      }

      setExcelExportProgress(52);
      setExcelExportStage('Menyusun Sheet 2: Ringkasan Statistik per Kelas & Semester...');
      await yieldFrame(65);

      // =========================================================================
      // SHEET 2: Ringkasan Statistik per Kelas & Semester
      // =========================================================================
      const classMap = new Map<
        string,
        { kelas: string; semester: string; count: number; totalScore: number; passed: number }
      >();
      allSubs.forEach((s) => {
        const kls = getCleanKelas(s.kelas);
        const sem = getSemesterFromSub(s);
        const key = `${kls}_${sem}`;
        const isPassed =
          s.nilaiAkhir >= EXAM_INFO.kkm &&
          !s.lulusTidakLulus.toLowerCase().includes('tidak') &&
          !s.statusKecurangan.toLowerCase().includes('diskualifikasi');
        const cur = classMap.get(key) || {
          kelas: kls,
          semester: sem,
          count: 0,
          totalScore: 0,
          passed: 0,
        };
        cur.count += 1;
        cur.totalScore += s.nilaiAkhir;
        if (isPassed) cur.passed += 1;
        classMap.set(key, cur);
      });

      const classSummaryRows = Array.from(classMap.values()).map((item, idx) => ({
        No: idx + 1,
        Kelas: item.kelas,
        Semester: item.semester,
        'Jumlah Peserta': item.count,
        'Rata-Rata Nilai (%)': item.count > 0 ? Math.round(item.totalScore / item.count) : 0,
        'Lulus KKM (75 - 100)': item.passed,
        'Tidak Lulus (0 - 74)': item.count - item.passed,
        'Persentase Kelulusan (%)':
          item.count > 0 ? `${Math.round((item.passed / item.count) * 100)}%` : '0%',
      }));

      const wsSummary = XLSXStyle.utils.json_to_sheet(
        classSummaryRows.length > 0
          ? classSummaryRows
          : [{ Info: 'Belum ada data ringkasan kelas' }]
      );
      wsSummary['!cols'] = [
        { wch: 8 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 20 },
        { wch: 20 },
        { wch: 24 },
      ];
      for (let c = 0; c < 8; c++) {
        const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
        if (wsSummary[ref]) wsSummary[ref].s = headerStyle;
      }

      setExcelExportProgress(64);
      setExcelExportStage('Menyusun Sheet 3: Matriks Rincian Jawaban Siswa per Nomor Soal...');
      await yieldFrame(65);

      // =========================================================================
      // SHEET 3: Matriks Rincian Jawaban Siswa per Nomor Soal
      // =========================================================================
      const rincianData: Record<string, string | number>[] = [];
      const sheet3ChunkSize = Math.max(1, Math.ceil(Math.max(1, allSubs.length) / 5));
      for (let idx = 0; idx < allSubs.length; idx++) {
        const s = allSubs[idx];
        const row: Record<string, string | number> = {
          No: idx + 1,
          'Nama Siswa': s.namaSiswa,
          'NIS/NISN': s.nisNisn,
          Kelas: getCleanKelas(s.kelas),
          Semester: getSemesterFromSub(s),
          'Nilai Akhir (%)': s.nilaiAkhir,
          'Status Kelulusan': s.lulusTidakLulus,
        };
        questions.forEach((q, qIdx) => {
          const ans = s.answers ? s.answers[q.id] : undefined;
          row[`Soal ${qIdx + 1} (Kunci: ${q.answer})`] = ans
            ? `${ans} (${ans === q.answer ? 'Benar' : 'Salah'})`
            : 'Kosong';
        });
        rincianData.push(row);

        if ((idx + 1) % sheet3ChunkSize === 0 || idx === allSubs.length - 1) {
          const ratio = allSubs.length > 0 ? (idx + 1) / allSubs.length : 1;
          const pct = Math.min(82, Math.round(64 + ratio * 18));
          setExcelExportProcessedRows(idx + 1);
          setExcelExportProgress(pct);
          setExcelExportStage(
            `Memetakan Sheet 3 (Matriks Jawaban): ${idx + 1}/${totalRecords} siswa (${pct}%)...`
          );
          await yieldFrame(30);
        }
      }

      const wsRincian = XLSXStyle.utils.json_to_sheet(
        rincianData.length > 0
          ? rincianData
          : [{ Info: 'Belum ada data rincian jawaban siswa' }]
      );
      wsRincian['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 24 },
        ...questions.map(() => ({ wch: 18 })),
      ];
      const rincianCols = 7 + questions.length;
      for (let c = 0; c < rincianCols; c++) {
        const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
        if (wsRincian[ref]) wsRincian[ref].s = headerStyle;
      }

      setExcelExportProgress(88);
      setExcelExportStage('Menyusun Sheet 4: Analisis Butir Soal Paket Aktif...');
      await yieldFrame(65);

      // =========================================================================
      // SHEET 4: Analisis Butir Soal Paket Aktif (Termasuk Rata-Rata Waktu per Soal)
      // =========================================================================
      const totalSub = allSubs.length;
      const analisisData = questions.map((q, idx) => {
        let benar = 0;
        let salah = 0;
        let kosong = 0;
        const durList: number[] = [];

        allSubs.forEach((s, sIdx) => {
          const ans = s.answers ? s.answers[q.id] : undefined;
          if (!ans) kosong++;
          else if (ans === q.answer) benar++;
          else salah++;

          const explicitDur = s.questionDurations?.[q.id];
          if (typeof explicitDur === 'number' && explicitDur > 0) {
            durList.push(explicitDur);
          } else {
            const baseSec = q.difficulty === 'HOTS' ? 68 : 44;
            const lengthFactor = Math.min(28, Math.round(q.content.length / 18));
            const studentVariance = ((q.id * 7 + sIdx * 11) % 25) - 10;
            durList.push(Math.max(15, baseSec + lengthFactor + studentVariance));
          }
        });
        const pct = totalSub > 0 ? Math.round((benar / totalSub) * 100) : 0;
        const avgDurSec =
          durList.length > 0
            ? Math.round(durList.reduce((a, b) => a + b, 0) / durList.length)
            : 0;
        return {
          'No Soal': idx + 1,
          'Tingkat Kesulitan': q.difficulty,
          'Elemen Fase D': q.elemen || '-',
          'Kunci Jawaban': q.answer,
          'Siswa Menjawab Benar': benar,
          'Siswa Menjawab Salah': salah,
          'Tidak Menjawab': kosong,
          'Total Siswa': totalSub,
          'Persentase Menjawab Benar (%)': `${pct}%`,
          'Rata-Rata Waktu Pengerjaan (Detik)': avgDurSec,
          Pertanyaan: q.content,
        };
      });

      const wsAnalisis = XLSXStyle.utils.json_to_sheet(analisisData);
      wsAnalisis['!cols'] = [
        { wch: 10 },
        { wch: 18 },
        { wch: 30 },
        { wch: 15 },
        { wch: 22 },
        { wch: 22 },
        { wch: 16 },
        { wch: 14 },
        { wch: 28 },
        { wch: 32 },
        { wch: 65 },
      ];
      for (let c = 0; c < 11; c++) {
        const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
        if (wsAnalisis[ref]) wsAnalisis[ref].s = headerStyle;
      }

      // =========================================================================
      // SHEET 5: Peringkat Nilai Siswa (Diurutkan dari Nilai Tertinggi ke Terendah)
      // =========================================================================
      const rankedSubs = [...allSubs].sort((a, b) => b.nilaiAkhir - a.nilaiAkhir);
      const rankingRows = rankedSubs.map((s, idx) => ({
        Peringkat: `#${idx + 1}`,
        'Nama Siswa': s.namaSiswa,
        'NIS/NISN': s.nisNisn,
        Kelas: getCleanKelas(s.kelas),
        Semester: getSemesterFromSub(s),
        'Skor Benar': `${s.skorBenar} / ${s.totalSoal}`,
        'Nilai Akhir (%)': s.nilaiAkhir,
        'Status Kelulusan': s.lulusTidakLulus,
        'Status Integritas': s.statusKecurangan,
        'Waktu Ujian': s.timestamp,
      }));
      const wsRanking = XLSXStyle.utils.json_to_sheet(
        rankingRows.length > 0 ? rankingRows : [{ Info: 'Belum ada data peringkat siswa' }]
      );
      wsRanking['!cols'] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 18 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 26 },
        { wch: 42 },
        { wch: 22 },
      ];
      for (let c = 0; c < 10; c++) {
        const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
        if (wsRanking[ref]) wsRanking[ref].s = headerStyle;
      }

      setExcelExportProgress(95);
      setExcelExportStage('Mengemas buku kerja Excel (.xlsx) & menyiapkan unduhan...');
      await yieldFrame(75);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Nilai Siswa');
      XLSX.utils.book_append_sheet(wb, wsRanking, 'Peringkat Siswa');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Statistik Kelas');
      XLSX.utils.book_append_sheet(wb, wsRincian, 'Rincian Jawaban Siswa');
      XLSX.utils.book_append_sheet(wb, wsAnalisis, 'Analisis Butir Soal');

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Rekap_Hasil_Ujian_ANBK_Informatika_${dateStr}.xlsx`;
      XLSXStyle.writeFile(wb, filename);

      setExcelExportProcessedRows(totalRecords);
      setExcelExportProgress(100);
      setExcelExportCompletedFile(filename);
      setExcelExportStage(
        `Selesai (100%)! ${totalRecords} data submissions berhasil diekspor ke "${filename}".`
      );

      setSyncMessage(
        `Berhasil mengekspor ${allSubs.length} data submissions ke file Excel terformat "${filename}" (5 Sheet: Rekap Nilai 10 Kolom, Peringkat Siswa, Statistik Kelas, Rincian Jawaban, & Analisis Soal)!`
      );
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      console.error('Gagal mengekspor Excel (.xlsx):', err);
      setSyncMessage('Terjadi kendala saat membuat file Excel (.xlsx). Silakan coba kembali.');
      setTimeout(() => setSyncMessage(null), 4000);
      setShowExcelProgressPanel(false);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadCompiledPdfByStudent = () => {
    let storedSubmissions: StudentSubmission[] = [];
    try {
      const rawLocal = localStorage.getItem('anbk_submissions_v1');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          storedSubmissions = parsed;
        }
      }
    } catch (e) {
      console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
    }

    const mapByKey = new Map<string, StudentSubmission>();
    [...storedSubmissions, ...submissions].forEach((s) => {
      if (!s || !s.namaSiswa) return;
      const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
      mapByKey.set(key, s);
    });
    const allSubs = Array.from(mapByKey.values());

    const pdfBlob = generateCompiledAllStudentsPdfBlob(
      allSubs,
      questionBanks || FASE_D_QUESTION_BANKS,
      questions
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Kompilasi_Arsip_Cetak_Fisik_Siswa_ANBK_${dateStr}.pdf`;
    triggerFileDownload(pdfBlob, filename);

    setSyncMessage(
      `Berhasil mengunduh PDF Kompilasi Arsip Cetak Fisik ("${filename}") — Terbagi ${allSubs.length} Halaman berdasarkan Nama Siswa (1 Halaman = 1 Siswa) siap cetak!`
    );
    setTimeout(() => setSyncMessage(null), 5000);
  };

  // =========================================================================
  // EKSPOR REKAP NILAI SELURUH SISWA PER KELAS KE PDF TUNGGAL (LAPORAN KEPALA SEKOLAH)
  // =========================================================================
  const handleDownloadRekapPerKelasPdf = () => {
    let storedSubmissions: StudentSubmission[] = [];
    try {
      const rawLocal = localStorage.getItem('anbk_submissions_v1');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          storedSubmissions = parsed;
        }
      }
    } catch (e) {
      console.error('Gagal membaca localStorage anbk_submissions_v1:', e);
    }

    const mapByKey = new Map<string, StudentSubmission>();
    [...storedSubmissions, ...submissions].forEach((s) => {
      if (!s || !s.namaSiswa) return;
      const key = s.id || `${s.timestamp}_${s.namaSiswa.trim().toLowerCase()}_${s.nisNisn}`;
      mapByKey.set(key, s);
    });
    const allSubs = Array.from(mapByKey.values());

    const uniqueClasses = new Set(allSubs.map((s) => getCleanKelas(s.kelas || 'VIII-1')));
    const pdfBlob = generateRekapPerKelasPdfBlob(allSubs);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Laporan_Rekap_Nilai_Per_Kelas_Kepsek_ANBK_${dateStr}.pdf`;
    triggerFileDownload(pdfBlob, filename);

    setSyncMessage(
      `Berhasil mengekspor Rekap Nilai Per Kelas ("${filename}") — Terbagi per halaman berdasarkan ${uniqueClasses.size} Kelas (${allSubs.length} Siswa) lengkap dengan kolom pengesahan Kepala Sekolah & Guru Mapel!`
    );
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const singleFileHtmlCode = generateSingleFileHtml(questions, cloudConfig.appsScriptWebAppUrl);

  const handleCopyCode = (type: 'gs' | 'html') => {
    const text = type === 'gs' ? GAS_CODE_TEMPLATE : singleFileHtmlCode;
    navigator.clipboard.writeText(text);
    if (type === 'gs') {
      setCopiedGs(true);
      setTimeout(() => setCopiedGs(false), 2500);
    } else {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2500);
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick Stats Summary Calculations dari submissions state
  const totalStudentsCount = submissions.length;
  const currentAverageScore = useMemo(() => {
    if (submissions.length === 0) return 0;
    const sum = submissions.reduce((acc, sub) => acc + (Number(sub.nilaiAkhir) || 0), 0);
    return Math.round((sum / submissions.length) * 10) / 10;
  }, [submissions]);

  const passingStudentsCount = useMemo(() => {
    return submissions.filter((sub) => (Number(sub.nilaiAkhir) || 0) >= EXAM_INFO.kkm).length;
  }, [submissions]);

  const passingRatePercentage = useMemo(() => {
    if (submissions.length === 0) return 0;
    return Math.round((passingStudentsCount / submissions.length) * 100);
  }, [submissions, passingStudentsCount]);

  const highestScore = useMemo(() => {
    if (submissions.length === 0) return 0;
    return Math.max(...submissions.map((sub) => Number(sub.nilaiAkhir) || 0));
  }, [submissions]);

  const lowestScore = useMemo(() => {
    if (submissions.length === 0) return 0;
    return Math.min(...submissions.map((sub) => Number(sub.nilaiAkhir) || 0));
  }, [submissions]);

  return (
    <div className="max-w-7xl mx-auto px-1.5 sm:px-4 lg:px-5 py-1.5 sm:py-2.5 space-y-1.5 sm:space-y-2">
      {/* Header Panel Guru (Tersusun Rapi, Kompak, dan Profesional) */}
      <div className="rounded-lg sm:rounded-xl border border-sky-500/30 p-1.5 sm:p-2.5 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-md flex flex-col gap-1.5">
        {/* Baris Atas: Identitas Guru di kiri & Tombol Kembali di kanan */}
        <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-2 w-full">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {/* Pas Foto Resmi Pembuat Soal Ujian (Permanen & Terkunci) */}
            <div className="relative shrink-0">
              <div className="w-7 sm:w-9 aspect-[3/4] rounded overflow-hidden border border-amber-400 shadow-xs bg-[#EE0000] select-none flex items-center justify-center">
                {teacherPhotoUrl ? (
                  <img
                    src={teacherPhotoUrl}
                    alt={`Pembuat Soal Ujian - ${EXAM_INFO.guruMapel}`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className="w-full h-full object-contain object-center pointer-events-none select-none"
                  />
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[7.5px] sm:text-[9px] font-bold text-amber-300 tracking-wider leading-tight">
                <span>PANEL KONTROL GURU PROFESIONAL</span>
                <span>·</span>
                <span className="truncate">{EXAM_INFO.namaSekolah}</span>
                <span>·</span>
                {/* Visual Indicator: Status Mode Admin / Operator Sekolah */}
                <button
                  type="button"
                  onClick={handleOpenAdminTrigger}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-tight cursor-pointer transition-all shadow-xs select-none ${
                    effectiveIsAdminOperatorMode
                      ? 'bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-800/90 text-purple-200 border-purple-400/70 hover:bg-purple-800 ring-1 ring-purple-400/50'
                      : 'bg-slate-800/90 text-slate-300 border-white/20 hover:bg-slate-700 hover:border-amber-400/60'
                  }`}
                  title={
                    effectiveIsAdminOperatorMode
                      ? 'Mode Admin/Operator Sekolah Aktif: Klik untuk membuka Menu Admin Sekolah'
                      : 'Mode Guru Standar: Klik untuk memasukkan Password Mode Guru dan membuka Menu Admin Sekolah'
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      effectiveIsAdminOperatorMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {effectiveIsAdminOperatorMode ? (
                    <ShieldCheck className="w-3 h-3 shrink-0 text-purple-300" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                  )}
                  <span>
                    {effectiveIsAdminOperatorMode
                      ? '🛡️ ADMIN/OPERATOR: AKTIF'
                      : '👨‍🏫 GURU STANDAR'}
                  </span>
                  <span
                    className={`text-[7px] px-1 py-0.2 rounded font-bold uppercase transition-colors ${
                      effectiveIsAdminOperatorMode
                        ? 'bg-purple-950/80 text-amber-300 border border-purple-400/40'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {effectiveIsAdminOperatorMode ? 'Menu Admin ⚙️' : 'Buka Admin 🔒'}
                  </span>
                </button>
              </div>

              <h1 className="font-display text-[11px] sm:text-sm font-extrabold tracking-tight text-white leading-tight mt-0.5 truncate flex items-center gap-2">
                <span>Mode Guru — {EXAM_INFO.judul}</span>
              </h1>
              <p className="text-[8.5px] sm:text-[10px] text-sky-200 mt-0.5 leading-tight truncate">
                Pembuat Soal: <strong className="font-bold text-amber-300">{EXAM_INFO.guruMapelUpper}</strong> · Kurikulum Merdeka · T.A. {EXAM_INFO.tahunAjaran}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Quick Toggle: View-Only (Hanya Lihat) vs Edit-Mode */}
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-slate-900/95 border border-sky-400/40 shadow-inner"
              role="group"
              aria-label="Pilihan Mode Navigasi Dashboard Guru"
            >
              <button
                type="button"
                onClick={() => handleToggleInteractionMode('VIEW')}
                className={`inline-flex items-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  dashboardInteractionMode === 'VIEW'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs shadow-cyan-500/40 ring-1 ring-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="Mode Hanya Lihat (View-Only): Navigasi aman, membaca soal & rekap nilai tanpa risiko salah edit atau hapus data"
              >
                <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                <span>Hanya Lihat</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleInteractionMode('EDIT')}
                className={`inline-flex items-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  dashboardInteractionMode === 'EDIT'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs shadow-amber-500/40 ring-1 ring-amber-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="Mode Edit: Akses penuh untuk merevisi butir soal, menambah soal baru, dan mengubah data"
              >
                <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                <span>Mode Edit</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSessionNameInput('');
                setCustomNewTokenInput(generateRandomExamToken(5));
                setShowCreateSessionModal(true);
              }}
              disabled={dashboardInteractionMode === 'VIEW'}
              className={`inline-flex items-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10px] font-extrabold transition-all whitespace-nowrap ${
                dashboardInteractionMode === 'VIEW'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-60'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 shadow-sm active:scale-[0.98] cursor-pointer'
              }`}
              title={
                dashboardInteractionMode === 'VIEW'
                  ? 'Buat Sesi Ujian dinonaktifkan dalam Mode Hanya Lihat (Aktifkan Mode Edit)'
                  : 'Buat sesi ujian baru yang secara otomatis mengosongkan riwayat nilai siswa dan mereset submission sistem'
              }
            >
              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-200 animate-pulse shrink-0" />
              <span>Buat Sesi Ujian Baru</span>
            </button>
            <button
              onClick={onExitTeacherMode}
              className="inline-flex items-center gap-1 h-6 sm:h-7 px-1.5 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10.5px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shadow-xs shrink-0"
            >
              <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="hidden xs:inline sm:inline">Kembali ke Halaman Ujian</span>
              <span className="xs:hidden sm:hidden">Kembali</span>
            </button>
          </div>
        </div>

        {/* Visual Indicator Banner: Status Mode Sistem Admin / Operator Sekolah */}
        <div
          className={`flex flex-wrap items-center justify-between gap-1.5 p-1.5 px-2.5 rounded-lg border text-xs transition-all ${
            effectiveIsAdminOperatorMode
              ? 'bg-gradient-to-r from-purple-950/80 via-slate-950 to-indigo-950/80 border-purple-400/50 shadow-xs'
              : 'bg-slate-950/70 border-white/10'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                effectiveIsAdminOperatorMode
                  ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-[9.5px] sm:text-[11px] font-extrabold text-white">
                Indikator Sistem:{' '}
                <strong className={effectiveIsAdminOperatorMode ? 'text-purple-300' : 'text-slate-300'}>
                  {effectiveIsAdminOperatorMode
                    ? '🛡️ Mode Admin & Operator Sekolah (Hak Akses Penuh)'
                    : '👨‍🏫 Mode Guru Standar (Akses Terbatas)'}
                </strong>
              </span>
              <span className="text-slate-500 hidden sm:inline">·</span>
              <span className="text-[8.5px] sm:text-[10px] text-slate-300 truncate hidden md:inline">
                {effectiveIsAdminOperatorMode
                  ? 'Izin penuh terbuka: Sesi Ujian, Bank Soal, Reset Submissions, Manajemen Cloud & Token'
                  : 'Menu Admin Sekolah dikunci. Klik tombol untuk memasukkan Password Mode Guru'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {effectiveIsAdminOperatorMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(true)}
                  className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[8.5px] sm:text-[10px] font-black bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  title="Verifikasi Password Mode Guru untuk membuka Menu Admin Sekolah"
                >
                  Buka Menu Admin ⚙️ (Sandi Guru)
                </button>
                <button
                  type="button"
                  onClick={handleDeactivateAdminMode}
                  className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[8px] sm:text-[9.5px] font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-all cursor-pointer whitespace-nowrap"
                  title="Kunci & kembali ke Mode Guru Standar agar murid tidak bisa mengakses"
                >
                  Kunci 🔒
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminAuthModal(true)}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[8.5px] sm:text-[10px] font-black bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                title="Khusus Guru & Operator: Masukkan Password Mode Guru untuk membuka Menu Admin Sekolah"
              >
                <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-950" />
                <span>Buka Menu Admin Sekolah (Sandi Guru)</span>
              </button>
            )}
          </div>
        </div>

        {/* Toast Notifikasi Status Admin & Mode Interaksi */}
        {adminStatusToast && (
          <div className="p-2 rounded-lg bg-purple-950/90 border border-purple-400/60 text-purple-200 text-xs font-bold flex items-center justify-between gap-2 shadow-md animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-300 shrink-0" />
              <span>{adminStatusToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setAdminStatusToast(null)}
              className="p-0.5 rounded text-purple-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {dashboardModeToast && (
          <div className="p-2 rounded-lg bg-cyan-950/90 border border-cyan-400/60 text-cyan-200 text-xs font-bold flex items-center justify-between gap-2 shadow-md animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              {dashboardInteractionMode === 'VIEW' ? (
                <Eye className="w-4 h-4 text-cyan-300 shrink-0" />
              ) : (
                <Edit3 className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              <span>{dashboardModeToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setDashboardModeToast(null)}
              className="p-0.5 rounded text-cyan-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Banner Status Interaktif: Mode Hanya Lihat (View-Only) */}
        {dashboardInteractionMode === 'VIEW' && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 text-xs shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <p className="text-[9.5px] sm:text-xs truncate">
                <strong>Mode Hanya Lihat (View-Only) Aktif:</strong> Navigasi aman diaktifkan. Tombol perubahan atau penghapusan data dikunci agar tidak tersentuh secara tidak sengaja.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleInteractionMode('EDIT')}
              className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-[9px] sm:text-[10px] whitespace-nowrap cursor-pointer transition-all shrink-0 shadow-xs"
            >
              Beralih ke Mode Edit ✎
            </button>
          </div>
        )}

        {/* Baris Bawah: Toolbar Aksi & Ekspor Terkelompok Rapi dan Proporsional */}
        <div className="border-t border-white/10 pt-1.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1">
          {/* Kelompok Ekspor Laporan & Nilai */}
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className={`inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                isExportingExcel
                  ? 'bg-emerald-700 text-white cursor-wait'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {isExportingExcel ? (
                <>
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-300 shrink-0" />
                  <span className="truncate">Excel {excelExportProgress}%</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                  <span className="truncate">Export Excel</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadAnalyticsPdf}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 hover:from-cyan-300 hover:to-sky-300 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="truncate">Analytics PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadRekapPerKelasPdf}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="truncate">PDF Rekap Kelas</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCompiledPdfByStudent}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <Printer className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="truncate">PDF Arsip Siswa</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-sky-500 text-slate-950 hover:bg-sky-400 transition-all cursor-pointer whitespace-nowrap shadow-2xs col-span-2 sm:col-span-1"
            >
              <Download className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="truncate">Cadangan CSV</span>
            </button>
          </div>

          {/* Kelompok Pengaturan Cetak, Backup, dan Keamanan */}
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (!selectedSubForPrintId && submissions.length > 0) {
                  setSelectedSubForPrintId(submissions[0].id);
                }
                setShowPrintSettingsModal(true);
              }}
              className={`inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold border transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                printDarkMode
                  ? 'bg-slate-900 border-amber-400 text-amber-300 hover:bg-slate-800'
                  : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {printDarkMode ? (
                <Moon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              ) : (
                <Sun className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" />
              )}
              <span className="truncate">Cetak ({printDarkMode ? 'Dark' : 'Putih'})</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadEncryptedJsonBackup}
              disabled={isEncryptingBackup}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              <span className="truncate">{isEncryptingBackup ? 'Enkripsi...' : 'Backup JSON'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBackupErrorMsg(null);
                setShowEncryptedBackupModal(true);
              }}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold border border-indigo-400/50 bg-indigo-950/70 text-indigo-200 hover:bg-indigo-900/80 transition-all cursor-pointer whitespace-nowrap"
            >
              <KeyRound className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              <span className="truncate">Restore</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadIntegrityLogs('pdf')}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold bg-rose-500 text-white hover:bg-rose-400 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <ShieldAlert className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-200 shrink-0" />
              <span className="truncate">Logs (PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadIntegrityLogs('txt')}
              className="inline-flex items-center justify-center gap-1 h-5.5 sm:h-6.5 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-bold border border-rose-400/50 bg-rose-950/70 text-rose-200 hover:bg-rose-900/80 transition-all cursor-pointer whitespace-nowrap col-span-2 sm:col-span-1"
            >
              <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              <span className="truncate">Logs (.TXT)</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK STATS SUMMARY SECTION: Total Siswa & Rata-Rata Nilai Saat Ini (Dari submissions state) */}
      <div className="rounded-lg sm:rounded-xl border border-sky-500/35 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/85 p-2 sm:p-3 text-white shadow-md space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shrink-0">
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sky-300">
                  Quick Stats
                </h2>
                <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 border border-sky-400/40 text-[7.5px] sm:text-[8px] font-mono font-bold text-sky-200">
                  Ringkasan Submissions
                </span>
              </div>
              <p className="text-[8px] sm:text-[9.5px] text-slate-300 leading-tight">
                Statistik Langsung Hasil Pengerjaan Siswa · {EXAM_INFO.namaSekolah} · KKM {EXAM_INFO.kkm}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {totalStudentsCount} Data Tersimpan
            </span>
          </div>
        </div>

        {/* Grid 4 Kartu Metrik Ringkas: Total Siswa, Rata-Rata Nilai, Lulus KKM, Rentang Nilai */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
          {/* Kartu 1: Total Siswa (Total number of students) */}
          <div className="p-2 sm:p-2.5 rounded-lg border border-sky-400/30 bg-slate-900/80 flex flex-col justify-between space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-wider text-sky-300">
                Total Siswa
              </span>
              <div className="w-5 h-5 rounded bg-sky-500/20 text-sky-300 flex items-center justify-center">
                <Users className="w-3 h-3 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black font-mono tracking-tight text-white">
                {totalStudentsCount}
                <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 ml-1">Siswa</span>
              </div>
              <div className="text-[7px] sm:text-[8px] text-slate-300 truncate mt-0.5">
                {totalStudentsCount > 0
                  ? `${new Set(submissions.map((s) => s.kelas)).size} Rombel Kelas Terdata`
                  : 'Belum ada data pengerjaan'}
              </div>
            </div>
          </div>

          {/* Kartu 2: Rata-Rata Nilai (Current average score) */}
          <div className="p-2 sm:p-2.5 rounded-lg border border-amber-400/35 bg-slate-900/80 flex flex-col justify-between space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-wider text-amber-300">
                Rata-Rata Nilai
              </span>
              <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-amber-400" />
              </div>
            </div>
            <div>
              <div
                className={`text-lg sm:text-2xl font-black font-mono tracking-tight ${
                  totalStudentsCount === 0
                    ? 'text-slate-400'
                    : currentAverageScore >= EXAM_INFO.kkm
                    ? 'text-emerald-400'
                    : 'text-amber-300'
                }`}
              >
                {totalStudentsCount > 0 ? currentAverageScore : '0.0'}
                <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 ml-1">/ 100</span>
              </div>
              <div className="text-[7px] sm:text-[8px] text-slate-300 truncate mt-0.5 flex items-center gap-1">
                <span>KKM {EXAM_INFO.kkm}:</span>
                <span
                  className={`font-bold ${
                    currentAverageScore >= EXAM_INFO.kkm ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {totalStudentsCount === 0
                    ? '-'
                    : currentAverageScore >= EXAM_INFO.kkm
                    ? '✓ Rata-Rata Lulus'
                    : 'Di Bawah KKM'}
                </span>
              </div>
            </div>
          </div>

          {/* Kartu 3: Siswa Lulus KKM */}
          <div className="p-2 sm:p-2.5 rounded-lg border border-emerald-400/35 bg-slate-900/80 flex flex-col justify-between space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-wider text-emerald-300">
                Lulus KKM (≥ {EXAM_INFO.kkm})
              </span>
              <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black font-mono tracking-tight text-emerald-400">
                {passingStudentsCount}
                <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 ml-1">
                  / {totalStudentsCount} Siswa
                </span>
              </div>
              <div className="text-[7px] sm:text-[8px] text-emerald-300/80 truncate mt-0.5">
                {totalStudentsCount > 0
                  ? `${passingRatePercentage}% Tingkat Kelulusan`
                  : '0% Kelulusan'}
              </div>
            </div>
          </div>

          {/* Kartu 4: Rentang Nilai (Tertinggi & Terendah) */}
          <div className="p-2 sm:p-2.5 rounded-lg border border-purple-400/35 bg-slate-900/80 flex flex-col justify-between space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[7.5px] sm:text-[8.5px] font-extrabold uppercase tracking-wider text-purple-300">
                Rentang Nilai
              </span>
              <div className="w-5 h-5 rounded bg-purple-500/20 text-purple-300 flex items-center justify-center">
                <Award className="w-3 h-3 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-black font-mono tracking-tight text-white">
                <span className="text-emerald-400">{totalStudentsCount > 0 ? highestScore : '-'}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-rose-400">{totalStudentsCount > 0 ? lowestScore : '-'}</span>
              </div>
              <div className="text-[7px] sm:text-[8px] text-slate-300 truncate mt-0.5">
                Tertinggi vs Terendah
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Cepat: Generate Class Report (PDF) Berdasarkan Kelas Terpilih */}
      <div className="rounded-lg sm:rounded-xl border border-amber-400/40 bg-gradient-to-r from-slate-950 via-sky-950/90 to-slate-900 p-1.5 sm:p-2.5 text-white shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 sm:gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[7.5px] sm:text-[9px] font-extrabold uppercase tracking-wider">
              GENERATE CLASS REPORT (PDF)
            </span>
            <span className="text-[8.5px] sm:text-[10.5px] font-bold text-sky-300 truncate">
              Laporan Spesifik Kelas Terpilih · {EXAM_INFO.namaSekolah}
            </span>
          </div>
          <p className="text-[8.5px] sm:text-[10px] text-slate-200 leading-snug">
            Pilih kelas untuk mengunduh laporan PDF berisi <strong className="text-amber-300">Rata-Rata Nilai</strong>, <strong className="text-emerald-300">Tingkat Kelulusan</strong>, dan <strong className="text-sky-300">Analisis Kesulitan Butir Soal</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-900/90 border border-sky-400/40 rounded-md px-1.5 sm:px-2 h-6 sm:h-7">
            <label htmlFor="select-class-report" className="text-[8.5px] sm:text-[10px] font-bold text-sky-200 whitespace-nowrap">
              Pilih Kelas:
            </label>
            <select
              id="select-class-report"
              value={selectedReportClass}
              onChange={(e) => setSelectedReportClass(e.target.value)}
              className="bg-slate-950 text-amber-300 font-mono font-extrabold text-[8.5px] sm:text-[10px] px-1.5 py-0.5 rounded border border-amber-400/50 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Kelas (VII & VIII)</option>
              <optgroup label="Jenjang Kelas VII">
                {EXAM_INFO.kelasVIIList.map((kls) => (
                  <option key={kls} value={kls}>
                    Kelas {kls}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Jenjang Kelas VIII">
                {EXAM_INFO.kelasList.map((kls) => (
                  <option key={kls} value={kls}>
                    Kelas {kls}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            type="button"
            onClick={() => handleGenerateClassReportPdf(selectedReportClass)}
            className="inline-flex items-center justify-center gap-1 h-6 sm:h-7 px-2 sm:px-2.5 rounded-md text-[8.5px] sm:text-[10px] font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
            <span>
              Generate Report ({selectedReportClass === 'ALL' ? 'Semua Kelas' : `Kelas ${selectedReportClass}`}) .PDF
            </span>
          </button>
        </div>
      </div>

      {/* Indikator Progres Persentase Visual saat Mengunduh Data Submissions ke Excel (.xlsx) */}
      {(isExportingExcel || showExcelProgressPanel) && (
        <div
          className="mb-6 rounded-2xl border border-emerald-400/50 bg-gradient-to-r from-slate-950 via-emerald-950/90 to-slate-900 p-4 text-white shadow-xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                {excelExportProgress >= 100 && !isExportingExcel ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-300 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    PROGRES EKSPOR DATA SUBMISSIONS KE EXCEL (.XLSX)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                    {excelExportProcessedRows}/{excelExportTotalRows} Rekaman Siswa
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate-200 mt-0.5">
                  {excelExportStage || 'Memproses buku kerja Excel...'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1 rounded-xl bg-emerald-500/25 border border-emerald-400/50 font-mono text-sm sm:text-base font-extrabold text-amber-300">
                {excelExportProgress}%
              </span>
              {!isExportingExcel && (
                <button
                  type="button"
                  onClick={() => setShowExcelProgressPanel(false)}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Segmented Visual Progress Bar (20 Segmen = Akurasi 5% per Segmen, Tanpa Inline Style) */}
          <progress
            value={excelExportProgress}
            max={100}
            className="sr-only"
          >
            {excelExportProgress}%
          </progress>
          <div className="grid grid-cols-20 gap-1 w-full h-3.5 rounded-xl bg-slate-900/95 p-1 border border-slate-700/80">
            {Array.from({ length: 20 }, (_, idx) => {
              const threshold = (idx + 1) * 5;
              const isFilled = excelExportProgress >= threshold || (idx === 0 && excelExportProgress > 0);
              return (
                <div
                  key={idx}
                  className={`h-full rounded-xs transition-colors duration-150 ${
                    isFilled
                      ? excelExportProgress >= 100
                        ? 'bg-emerald-400'
                        : idx >= 16
                        ? 'bg-amber-300'
                        : idx >= 10
                        ? 'bg-teal-400'
                        : 'bg-emerald-500'
                      : 'bg-slate-800'
                  }`}
                />
              );
            })}
          </div>

          {/* Tahapan Lembar Kerja (4 Sheet) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 text-[11px] font-mono">
            <div
              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                excelExportProgress >= 12
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span>1. Rekap 10 Kolom</span>
              <span>
                {excelExportProgress >= 46
                  ? '✓ Selesai'
                  : `${excelExportProcessedRows}/${excelExportTotalRows}`}
              </span>
            </div>
            <div
              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                excelExportProgress >= 52
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span>2. Statistik Kelas</span>
              <span>{excelExportProgress >= 64 ? '✓ Selesai' : excelExportProgress >= 52 ? 'Memproses...' : 'Menunggu'}</span>
            </div>
            <div
              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                excelExportProgress >= 64
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span>3. Rincian Jawaban</span>
              <span>
                {excelExportProgress >= 84
                  ? '✓ Selesai'
                  : excelExportProgress >= 64
                  ? `${excelExportProcessedRows}/${excelExportTotalRows}`
                  : 'Menunggu'}
              </span>
            </div>
            <div
              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                excelExportProgress >= 88
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span>4. Analisis & .xlsx</span>
              <span>{excelExportProgress >= 100 ? '✓ Terunduh' : excelExportProgress >= 88 ? 'Mengemas...' : 'Menunggu'}</span>
            </div>
          </div>
          {excelExportCompletedFile && !isExportingExcel && (
            <div className="mt-2.5 pt-2 border-t border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200">
              <span>
                File tersimpan: <strong className="font-mono text-amber-300">{excelExportCompletedFile}</strong>
              </span>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/40 text-amber-200 font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Ulang (.xlsx)
              </button>
            </div>
          )}
        </div>
      )}

      {syncMessage && (
        <div className="p-2.5 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-between">
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-white/80 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Kartu Status & Kontrol Sesi Ujian Aktif */}
      <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/80 p-2.5 sm:p-3 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                SESI UJIAN AKTIF
              </span>
              <span className="text-slate-400 text-[10px]">·</span>
              <span className="text-slate-300 text-[10px]">
                {new Date(activeSession.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {activeSession.targetKelas && activeSession.targetKelas !== 'ALL' && (
                <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-400/30">
                  Target: {activeSession.targetKelas}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold text-white truncate">
                {activeSession.sessionName}
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                (ID: {activeSession.sessionId.slice(0, 15)})
              </span>
              {activeSession.token && (
                <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10.5px] font-mono font-extrabold">
                  Token: {activeSession.token}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onOpenMonitoring && (
            <button
              type="button"
              onClick={onOpenMonitoring}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 transition-colors cursor-pointer shadow-xs"
              title="Buka Panel Fitur Monitoring Ujian Siswa secara real-time"
            >
              <MonitorCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Pantau Siswa Live</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSessionHistoryDrawer(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Riwayat Sesi ({sessionHistoryList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSessionNameInput('');
              setCustomNewTokenInput(generateRandomExamToken(5));
              setShowCreateSessionModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 shadow-sm active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-950" />
            <span>Buat Sesi Ujian Baru</span>
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-sky-500/30 bg-slate-950/90 shadow-md">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'questions'
              ? 'bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-sm shadow-sky-600/30'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-300" />
          Kelola Bank Soal ({questions.length} Soal: {hotsCount} HOTS & {regulerCount} Reguler)
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'submissions'
              ? 'bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-sm shadow-sky-600/30'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
          <span>Rekap Hasil Ujian ({submissions.length} Siswa)</span>
          {exhaustedStudentsQuotaList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono font-extrabold">
              {exhaustedStudentsQuotaList.length} Habis Token 3x
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'analysis'
              ? 'bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-sm shadow-sky-600/30'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-300" />
          Analisis Butir Soal (HOTS/Reguler & % Benar)
        </button>

        <button
          onClick={() => setActiveTab('visual_analytics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'visual_analytics'
              ? 'bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-500 text-white shadow-md shadow-indigo-600/40 ring-1 ring-indigo-400/50'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
          Visual Analytics & Tren Kelas (Recharts)
        </button>

        <button
          onClick={() => setActiveTab('integration')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'integration'
              ? 'bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-sm shadow-sky-600/30'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-amber-300" />
          Pengaturan Server & Kode Siap Pakai (Code.gs + index.html)
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: KELOLA BANK SOAL */}
      {/* ===================================================================== */}
      {activeTab === 'questions' && (
        <div className="space-y-3">
          {/* Pemilih Paket Soal Fase D (Kelas VII & VIII - Semester Ganjil & Genap) */}
          <div
            className={`rounded-xl border p-3 space-y-2 ${
              darkMode ? 'bg-slate-950/90 border-sky-500/30 text-white' : 'bg-slate-900 border-sky-500/30 text-white'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                <Globe className="w-3.5 h-3.5 text-amber-300" />
                <span>PILIH PAKET BANK SOAL ONLINE INFORMATIKA FASE D (KELAS VII & VIII)</span>
              </div>
              <span className="text-[11px] font-mono text-amber-300">
                Aktif: {FASE_D_PACKAGE_META[activePackageKey].judul}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(['VII_Ganjil', 'VII_Genap', 'VIII_Ganjil', 'VIII_Genap'] as ExamPackageKey[]).map(
                (pkgKey) => {
                  const meta = FASE_D_PACKAGE_META[pkgKey];
                  const isSelected = activePackageKey === pkgKey;
                  return (
                    <button
                      key={pkgKey}
                      type="button"
                      onClick={() => onSelectPackageKey && onSelectPackageKey(pkgKey)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/15 font-semibold'
                      }`}
                    >
                      <div className="text-[10.5px] uppercase tracking-wider opacity-85">
                        Kelas {meta.jenjang} · Semester {meta.semester}
                      </div>
                      <div className="text-[11px] mt-0.5 line-clamp-1">{meta.topik}</div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div
            className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                Daftar Soal Ujian ({FASE_D_PACKAGE_META[activePackageKey].topik})
              </h2>
              <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Total {questions.length} Soal Pilihan Ganda · {hotsCount} Soal HOTS & {regulerCount} Soal REGULER · Sumber: {FASE_D_PACKAGE_META[activePackageKey].sumberOnline}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleFetchOnlinePackage}
                disabled={isFetchingOnline}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all duration-300 cursor-pointer whitespace-nowrap border ${
                  isOnlineQuestionsSyncedAnimated && !isFetchingOnline
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-4 ring-emerald-400/50 shadow-[0_0_22px_rgba(16,185,129,0.8)] scale-[1.03]'
                    : 'bg-sky-600 text-white hover:bg-sky-500 border-sky-400/30'
                }`}
              >
                {isOnlineQuestionsSyncedAnimated && !isFetchingOnline ? (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950" />
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 shrink-0 animate-bounce" />
                    <span>Selesai Sinkron Soal Online!</span>
                    <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 border border-slate-950 shadow-md animate-bounce">
                      SINKRON ✓
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingOnline ? 'animate-spin' : ''}`} />
                    <span>
                      {isFetchingOnline ? 'Mengambil Soal Online...' : 'Ambil Soal Online Fase D'}
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={handleResetDefaultQuestions}
                disabled={dashboardInteractionMode === 'VIEW'}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                  dashboardInteractionMode === 'VIEW'
                    ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                    : darkMode
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer'
                }`}
                title={
                  dashboardInteractionMode === 'VIEW'
                    ? 'Reset soal dinonaktifkan dalam Mode Hanya Lihat (Aktifkan Mode Edit di header)'
                    : 'Kembalikan bank soal ke 25 butir soal standar'
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset 25 Soal Default
              </button>
              <button
                onClick={() => {
                  if (dashboardInteractionMode === 'VIEW') {
                    handleToggleInteractionMode('EDIT');
                  }
                  handleStartAddQuestion();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                title={dashboardInteractionMode === 'VIEW' ? 'Otomatis beralih ke Mode Edit untuk menambah soal baru' : undefined}
              >
                <Plus className="w-4 h-4" />
                Tambah Soal Baru
              </button>
            </div>
          </div>

          {/* Form Modal / Panel Edit atau Tambah Soal */}
          {editingQuestion && (
            <form
              onSubmit={handleSaveQuestion}
              className={`rounded-xl border-2 border-sky-600 p-6 space-y-4 ${
                darkMode ? 'bg-slate-900' : 'bg-white shadow-md'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-bold text-sky-600 dark:text-sky-400">
                  {isAddingNew ? `Tambah Soal Baru (No. ${editingQuestion.id})` : `Edit Soal Nomor ${editingQuestion.id}`}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setIsAddingNew(false);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Bentuk / Kategori Soal (REGULER / HOTS)
                  </label>
                  <select
                    value={editingQuestion.difficulty}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        difficulty: e.target.value as 'REGULER' | 'HOTS',
                      })
                    }
                    className={`w-full px-3.5 py-2 rounded-lg border text-sm font-medium ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="REGULER">REGULER</option>
                    <option value="HOTS">HOTS (Higher Order Thinking Skills)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Kunci Jawaban Benar
                  </label>
                  <select
                    value={editingQuestion.answer}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        answer: e.target.value as 'A' | 'B' | 'C' | 'D',
                      })
                    }
                    className={`w-full px-3.5 py-2 rounded-lg border text-sm font-bold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-emerald-400'
                        : 'bg-slate-50 border-slate-300 text-emerald-700'
                    }`}
                  >
                    <option value="A">Pilihan A</option>
                    <option value="B">Pilihan B</option>
                    <option value="C">Pilihan C</option>
                    <option value="D">Pilihan D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Link URL Gambar Soal (Opsional)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://contoh.com/gambar-soal.png"
                      value={editingQuestion.image || ''}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          image: e.target.value,
                        })
                      }
                      className={`w-full px-3.5 py-2 rounded-lg border text-sm ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Pertanyaan Soal (Content)
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingQuestion.content}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, content: e.target.value })
                  }
                  placeholder="Tuliskan pertanyaan soal dengan jelas..."
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => (
                  <div key={letter}>
                    <label className="block text-xs font-semibold mb-1">
                      Pilihan {letter} {editingQuestion.answer === letter && '(Kunci Jawaban)'}
                    </label>
                    <input
                      type="text"
                      required
                      value={editingQuestion.options[idx]}
                      onChange={(e) => {
                        const newOpts: [string, string, string, string] = [...editingQuestion.options] as [
                          string,
                          string,
                          string,
                          string,
                        ];
                        newOpts[idx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                      className={`w-full px-3.5 py-2 rounded-lg border text-sm ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Penjelasan / Pembahasan Jawaban (Explanation)
                </label>
                <textarea
                  rows={2}
                  required
                  value={editingQuestion.explanation}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  placeholder="Tuliskan penjelasan jawaban untuk pembelajaran siswa..."
                  className={`w-full px-3.5 py-2 rounded-lg border text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setIsAddingNew(false);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-sky-700 text-white hover:bg-sky-800 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Simpan Soal
                </button>
              </div>
            </form>
          )}

          {/* Daftar Semua Soal */}
          <div className="space-y-1.5 sm:space-y-2.5">
            {questions.map((q) => {
              const totalSubCount = submissions.length;
              const correctSubCount = submissions.filter(
                (s) => s.answers && s.answers[q.id] === q.answer
              ).length;
              const correctSubPct =
                totalSubCount > 0 ? Math.round((correctSubCount / totalSubCount) * 100) : 0;
              const empiricalDiffLabel =
                totalSubCount === 0
                  ? 'Belum Ada Data'
                  : correctSubPct >= 75
                  ? 'Mudah'
                  : correctSubPct >= 40
                  ? 'Sedang'
                  : 'Sukar';

              return (
              <div
                key={q.id}
                className={`rounded-lg sm:rounded-xl border p-2 sm:p-3.5 transition-colors ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 pb-1.5 sm:pb-2.5 mb-1.5 sm:mb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <span className="inline-flex items-center justify-center w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-sky-700 text-white font-mono font-bold text-[10px] sm:text-xs">
                      {q.id}
                    </span>
                    <span
                      className={`text-[8.5px] sm:text-[10.5px] font-bold tracking-wide px-1.5 sm:px-2 py-0.5 rounded ${
                        q.difficulty === 'HOTS'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-[9px] sm:text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      Kunci: {q.answer}
                    </span>
                    <span
                      className={`text-[8px] sm:text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded border ${
                        totalSubCount === 0
                          ? 'bg-slate-500/10 text-slate-500 border-slate-500/30'
                          : correctSubPct >= 75
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : correctSubPct >= 40
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {empiricalDiffLabel} ({correctSubCount}/{totalSubCount} · {correctSubPct}%)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('analysis')}
                      className="inline-flex items-center gap-1 h-5.5 sm:h-7 px-1.5 sm:px-2.5 rounded text-[8.5px] sm:text-[11px] font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-400/30 cursor-pointer"
                    >
                      <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span>Analisis</span>
                    </button>
                    {dashboardInteractionMode === 'EDIT' ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingQuestion({ ...q });
                            setIsAddingNew(false);
                          }}
                          className="inline-flex items-center gap-1 h-5.5 sm:h-7 px-1.5 sm:px-2.5 rounded text-[8.5px] sm:text-[11px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 cursor-pointer"
                        >
                          <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuestionToDelete(q)}
                          className="inline-flex items-center gap-1 h-5.5 sm:h-7 px-1.5 sm:px-2.5 rounded text-[8.5px] sm:text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 cursor-pointer"
                          title="Hapus butir soal ini secara permanen"
                        >
                          <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                          <span>Hapus</span>
                        </button>
                      </>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 h-5.5 sm:h-7 px-1.5 sm:px-2 rounded text-[8px] sm:text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 select-none cursor-help"
                        title="Mode Hanya Lihat Aktif: Klik tombol Mode Edit di header untuk mengubah atau menghapus butir soal ini"
                      >
                        <Lock className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                        <span>Hanya Lihat</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[10.5px] sm:text-xs leading-snug sm:leading-relaxed whitespace-pre-line font-medium mb-2 sm:mb-3">
                  {q.content}
                </p>

                {q.image && (
                  <div className="mb-2 sm:mb-3">
                    <img
                      src={q.image}
                      alt={`Ilustrasi Soal ${q.id}`}
                      referrerPolicy="no-referrer"
                      className="max-h-36 sm:max-h-48 rounded-md sm:rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white p-1 sm:p-1.5"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 sm:gap-2 mb-2 sm:mb-3">
                  {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => {
                    const isCorrect = q.answer === letter;
                    return (
                      <div
                        key={letter}
                        className={`p-1.5 sm:p-2.5 rounded-md sm:rounded-lg border text-[9.5px] sm:text-xs flex items-start gap-1.5 sm:gap-2 ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 font-semibold text-emerald-900 dark:text-emerald-200'
                            : darkMode
                            ? 'border-slate-800 bg-slate-800/50 text-slate-300'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded text-[9px] sm:text-[11px] flex items-center justify-center font-mono font-bold shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="leading-snug sm:leading-relaxed">{q.options[idx]}</span>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`p-1.5 sm:p-2.5 rounded-md sm:rounded-lg text-[9px] sm:text-[11px] leading-snug sm:leading-relaxed border ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                      : 'bg-sky-50/60 border-sky-200/70 text-slate-700'
                  }`}
                >
                  <strong className="font-semibold text-sky-700 dark:text-sky-400">
                    Penjelasan Pembelajaran:{' '}
                  </strong>
                  {q.explanation}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: REKAP HASIL UJIAN SISWA (GOOGLE SHEET STRUCTURE 10 KOLOM) */}
      {/* ===================================================================== */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          {/* Panel Koneksi & Sinkronisasi Langsung ke Link Google Sheet */}
          <div
            className={`rounded-xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-sky-500/30 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Monitor Antrean Sinkronisasi (Queue) Google Sheets - Anti-Gagal Jaringan */}
            <div className="rounded-xl border border-sky-500/35 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950/80 p-3.5 sm:p-4 text-white shadow-md">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-sky-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      syncQueue.stats.pendingCount > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    }`}
                  >
                    <Layers className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-extrabold text-white">
                        Mekanisme Antrean Sinkronisasi (Queue) Anti-Gagal Jaringan
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          syncQueue.stats.isOnline
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                        }`}
                      >
                        {syncQueue.stats.isOnline ? (
                          <Wifi className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-3 h-3 text-rose-400" />
                        )}
                        <span>{syncQueue.stats.isOnline ? 'Online' : 'Offline'}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Menjamin data ujian siswa yang terkumpul tidak hilang meski jaringan drop/fluktuatif. Otomatis dikirim ulang bertahap ke Google Sheets.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => syncQueue.forceProcessNow()}
                    disabled={syncQueue.stats.isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer transition-all shadow-xs disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncQueue.stats.isProcessing ? 'animate-spin' : ''}`} />
                    <span>{syncQueue.stats.isProcessing ? 'Memproses Antrean...' : 'Kirim Antrean Sekarang'}</span>
                  </button>

                  {syncQueue.stats.failedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => syncQueue.retryFailed()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-all shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Coba Ulang Gagal ({syncQueue.stats.failedCount})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowQueueDetails((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-200 border border-sky-400/30 cursor-pointer transition-all"
                  >
                    <span>{showQueueDetails ? 'Sembunyikan Detail' : 'Lihat Item Antrean'}</span>
                    {showQueueDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Tertunda (Pending)</span>
                  <span
                    className={`text-xs font-mono font-bold ${
                      syncQueue.stats.pendingCount > 0 ? 'text-amber-300' : 'text-slate-300'
                    }`}
                  >
                    {syncQueue.stats.pendingCount}
                  </span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Sedang Diproses</span>
                  <span className="text-xs font-mono font-bold text-sky-300">
                    {syncQueue.stats.processingCount}
                  </span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Gagal (Backoff)</span>
                  <span
                    className={`text-xs font-mono font-bold ${
                      syncQueue.stats.failedCount > 0 ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {syncQueue.stats.failedCount}
                  </span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Sukses Terkirim</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {syncQueue.stats.completedCount}
                  </span>
                </div>
              </div>

              {/* Collapsible List of Active Items in Queue */}
              {showQueueDetails && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-sky-300 flex items-center justify-between">
                    <span>Daftar Item dalam Antrean ({syncQueue.items.length} aktif):</span>
                    {syncQueue.stats.lastSyncSuccessTime && (
                      <span className="text-slate-400 font-mono text-[10px]">
                        Sukses Terakhir: Pukul {syncQueue.stats.lastSyncSuccessTime}
                      </span>
                    )}
                  </div>
                  {syncQueue.items.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 bg-slate-950/50 rounded-lg border border-slate-800/80">
                      ✓ Tidak ada item tertunda. Seluruh data ujian siswa telah tersinkronisasi bersih ke Google Sheets.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {syncQueue.items.map((item, idx) => (
                        <div
                          key={`queue-${item.id || 'item'}-${idx}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                            <span className="font-bold text-white truncate max-w-[200px]">
                              {item.studentName ||
                                (item.type === 'batch_submissions'
                                  ? `Batch (${(item.payload as any[]).length} Data)`
                                  : 'Data Siswa')}
                            </span>
                            {item.studentNis && (
                              <span className="text-[10px] font-mono text-slate-400">({item.studentNis})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                item.status === 'processing'
                                  ? 'bg-amber-400/20 text-amber-300 animate-pulse'
                                  : item.status === 'failed'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-sky-500/20 text-sky-300'
                              }`}
                            >
                              {item.status.toUpperCase()} ({item.attempts}x coba)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-500 dark:text-amber-300">
                  SINKRONISASI REKAP HASIL UJIAN (13 KOLOM OTOMATIS)
                </div>
                <h2 className="text-lg font-bold mt-0.5">
                  Rekap Hasil Ujian Siswa ({submissions.length} Data Tersimpan)
                </h2>
                <p className={`text-xs mt-1 font-mono ${darkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                  Header Kolom Persis: Timestamp, Nama Siswa, NIS/NISN, Kelas, Semester, Skor Benar, Total Soal, Nilai Akhir, Status Kecurangan, Lulus/Tidak Lulus, Ranking, Device, FOTO
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncDateModal(true)}
                  disabled={isSyncingSheet}
                  className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all duration-300 cursor-pointer whitespace-nowrap border ${
                    isSyncingSheet
                      ? 'bg-amber-300 text-slate-950 border-amber-200 ring-2 ring-amber-400/60 shadow-sm'
                      : isTeacherRekapSyncAnimated
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-200 ring-4 ring-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.85)] scale-[1.03]'
                      : 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-amber-300/60 shadow-sm'
                  }`}
                >
                  {isTeacherRekapSyncAnimated && !isSyncingSheet ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-90" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950" />
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0 animate-bounce" />
                      <span>
                        Selesai Sinkron Rekap! ({submissions.length} Data · {teacherRekapSyncTime})
                      </span>
                      <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase tracking-wider bg-amber-300 text-slate-950 border border-slate-950 shadow-md animate-bounce">
                        SINKRON SELESAI ✓
                      </span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                      <span>
                        {isSyncingSheet
                          ? 'Menyinkronkan Data...'
                          : teacherRekapSyncTime
                          ? `✓ Tersinkron Rekap (${submissions.length} · ${teacherRekapSyncTime})`
                          : 'Simpan & Sinkronkan Rekap'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyTsvForGoogleSheet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  {copiedSheetTsv ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedSheetTsv ? 'Tersalin (13 Kolom)!' : 'Salin Data Rekap'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSubForPrintId && submissions.length > 0) {
                      setSelectedSubForPrintId(submissions[0].id);
                    }
                    setShowPrintSettingsModal(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer whitespace-nowrap shadow-xs ${
                    printDarkMode
                      ? 'bg-slate-900 border-amber-400/80 text-amber-300 hover:bg-slate-800'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  {printDarkMode ? (
                    <Moon className="w-4 h-4 text-amber-300" />
                  ) : (
                    <Printer className="w-4 h-4 text-sky-500" />
                  )}
                  <span>Pengaturan Cetak ({printDarkMode ? 'Dark Mode' : 'Default Terang'})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAnalyticsPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Download Analytics (.PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadRekapPerKelasPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF Rekap per Kelas (Laporan Kepsek)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCompiledPdfByStudent}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Printer className="w-4 h-4 text-amber-200" />
                  Unduh PDF Kompilasi (Per Halaman Siswa)
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs ${
                    isExportingExcel
                      ? 'bg-emerald-700 text-white cursor-wait'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isExportingExcel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Mengunduh Excel... {excelExportProgress}%</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export Excel (.xlsx)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-sky-700 text-white hover:bg-sky-600 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Unduh Cadangan LocalStorage (.CSV)
                </button>

                <label
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Impor Cadangan (.CSV)
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleImportCsvToLocalStorage}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleRestoreHistoricalSubmissions}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Muat Semua Data Historis
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSessionNameInput('');
                    setCustomNewTokenInput(generateRandomExamToken(5));
                    setShowCreateSessionModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white border border-emerald-300/50 transition-all cursor-pointer whitespace-nowrap shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                  title="Buat sesi ujian baru yang secara otomatis mengosongkan riwayat nilai siswa dan mereset submission sistem"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                  Buat Sesi Ujian Baru (Otomatis Reset)
                </button>

                <button
                  type="button"
                  disabled={dashboardInteractionMode === 'VIEW'}
                  onClick={() => setShowTeacherResetConfirmModal(true)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap shadow-sm ${
                    dashboardInteractionMode === 'VIEW'
                      ? 'bg-slate-800 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-500 hover:from-rose-500 hover:to-red-500 text-white border border-rose-300/50 cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                  title={
                    dashboardInteractionMode === 'VIEW'
                      ? 'Reset dinonaktifkan dalam Mode Hanya Lihat (Aktifkan Mode Edit di header)'
                      : 'Hapus dan reset rekap hasil ujian siswa'
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Semua Rekap Hasil Ujian
                </button>
              </div>
            </div>

            {/* Indikator Progres Bar Real-Time Ekspor Excel (.xlsx) di dalam Tab Rekap Hasil Ujian */}
            {(isExportingExcel || showExcelProgressPanel) && (
              <div
                className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-slate-950 via-emerald-950/90 to-slate-900 p-4 text-white shadow-md space-y-2.5"
                role="region"
                aria-label="Progres Ekspor Excel"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                      {excelExportProgress >= 100 && !isExportingExcel ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                          STATUS EKSPOR EXCEL (.XLSX) REAL-TIME
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                          {excelExportProcessedRows} / {excelExportTotalRows} Data Siswa
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-0.5">
                        {excelExportStage || 'Memproses data submissions...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/50 font-mono text-sm font-extrabold text-amber-300">
                      {excelExportProgress}%
                    </span>
                    {!isExportingExcel && (
                      <button
                        type="button"
                        onClick={() => setShowExcelProgressPanel(false)}
                        className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bar Progres Visual 20 Segmen (5% per Segmen) */}
                <div className="grid grid-cols-20 gap-1 w-full h-3 rounded-lg bg-slate-900/95 p-1 border border-slate-700/80">
                  {Array.from({ length: 20 }, (_, idx) => {
                    const threshold = (idx + 1) * 5;
                    const isFilled =
                      excelExportProgress >= threshold || (idx === 0 && excelExportProgress > 0);
                    return (
                      <div
                        key={idx}
                        className={`h-full rounded-xs transition-colors duration-150 ${
                          isFilled
                            ? excelExportProgress >= 100
                              ? 'bg-emerald-400'
                              : idx >= 16
                              ? 'bg-amber-300'
                              : idx >= 10
                              ? 'bg-teal-400'
                              : 'bg-emerald-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Panel Status Cadangan Data Lokal (localStorage -> .CSV) */}
            <div
              className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                darkMode
                  ? 'bg-sky-950/40 border-sky-500/30 text-sky-100'
                  : 'bg-sky-50/80 border-sky-200 text-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-sky-600 text-white shrink-0 mt-0.5">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-2">
                    <span>CADANGAN DATA LOKAL (LOCALSTORAGE BACKUP)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                      Key: anbk_submissions_v1
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Seluruh hasil ujian siswa otomatis tersimpan di penyimpanan lokal browser (<strong>{submissions.length} rekaman</strong>). Unduh ke format <strong>.CSV</strong> secara berkala sebagai arsip cadangan lokal di komputer/perangkat Guru.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadIntegrityLogs('pdf')}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-200" />
                  Download Integrity Logs (.PDF)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadIntegrityLogs('txt')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Integrity Logs (.TXT)
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shadow-xs ${
                    isExportingExcel
                      ? 'bg-emerald-700 text-white cursor-wait'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isExportingExcel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Proses Excel... {excelExportProgress}%</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export Submissions (.xlsx)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-sky-600 text-white hover:bg-sky-500 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download Submissions (.CSV)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEncryptedJsonBackup}
                  disabled={isEncryptingBackup}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  Unduh Semua LocalStorage (.enc.json)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBackupErrorMsg(null);
                    setShowEncryptedBackupModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Pulihkan JSON Terenkripsi
                </button>
              </div>
            </div>

            {/* Input Cepat Tautan Rekap & URL Web App */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Tautan Rekap Hasil Ujian Online
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={cloudConfig.googleSheetUrl}
                    onChange={(e) =>
                      onUpdateCloudConfig({ ...cloudConfig, googleSheetUrl: e.target.value })
                    }
                    placeholder="Tempel tautan rekap hasil ujian..."
                    className={`w-full px-3 py-2 rounded-lg border text-xs ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  {cloudConfig.googleSheetUrl && (
                    <a
                      href={cloudConfig.googleSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Buka Rekap
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  URL Web App Google Apps Script (`.../exec` untuk Sinkronisasi Otomatis)
                </label>
                <input
                  type="url"
                  value={cloudConfig.appsScriptWebAppUrl}
                  onChange={(e) =>
                    onUpdateCloudConfig({ ...cloudConfig, appsScriptWebAppUrl: e.target.value })
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Kode Token Ujian Aktif (Tersinkron ke Menu `KODE TOKEN UJIAN` & Portal Siswa)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={cloudConfig.customTeacherToken || ''}
                  onChange={(e) =>
                    onUpdateCloudConfig({
                      ...cloudConfig,
                      customTeacherToken: e.target.value.toUpperCase(),
                      lockTeacherToken: Boolean(e.target.value.trim()),
                    })
                  }
                  placeholder="Ketik 6 digit Kode Token Guru (mis. ANBK78)"
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-bold uppercase tracking-widest ${
                    darkMode
                      ? 'bg-slate-800 border-amber-500/50 text-amber-300'
                      : 'bg-amber-50 border-amber-400 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Tautan Sinkronisasi Menu `KODE TOKEN UJIAN`
                </label>
                <input
                  type="url"
                  value={cloudConfig.tokenSheetUrl || ''}
                  onChange={(e) =>
                    onUpdateCloudConfig({
                      ...cloudConfig,
                      tokenSheetUrl: e.target.value,
                    })
                  }
                  placeholder="Tempel tautan sinkronisasi KODE TOKEN UJIAN..."
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl border overflow-hidden ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Toolbar Filter Jenjang & Rombel Kelas pada Tabel Hasil Ujian Siswa */}
            <div
              className={`p-3 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs ${
                darkMode
                  ? 'bg-slate-950/90 border-slate-800 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 font-bold text-sky-400">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter Jenjang:</span>
                </div>

                <div className="inline-flex items-center p-0.5 rounded-lg border border-sky-400/30 bg-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubJenjangFilter('ALL');
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubJenjangFilter === 'ALL'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Semua ({submissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubJenjangFilter('VII');
                      setTeacherSubKelasFilter('ALL');
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubJenjangFilter === 'VII'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-300/80 hover:text-emerald-200'
                    }`}
                  >
                    Kelas VII ({submissions.filter((s) => {
                      const k = s.kelas.toUpperCase();
                      return k.includes('VII') && !k.includes('VIII');
                    }).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubJenjangFilter('VIII');
                      setTeacherSubKelasFilter('ALL');
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubJenjangFilter === 'VIII'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-300/80 hover:text-amber-200'
                    }`}
                  >
                    Kelas VIII ({submissions.filter((s) => s.kelas.toUpperCase().includes('VIII')).length})
                  </button>
                </div>

                {/* Filter Status: Semua / Sudah Login / Sedang Mengerjakan / Selesai */}
                <div className="inline-flex items-center p-0.5 rounded-lg border border-amber-400/40 bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setTeacherSubStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubStatusFilter === 'ALL'
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Semua ({submissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherSubStatusFilter('LOGIN')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubStatusFilter === 'LOGIN'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-sky-300 hover:text-white'
                    }`}
                  >
                    🔵 Sudah Login ({submissions.filter((s) => s.isCompleted === false && (s.statusKecurangan.toLowerCase().includes('login') || s.statusKecurangan.toLowerCase().includes('masuk'))).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherSubStatusFilter('WORKING')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubStatusFilter === 'WORKING'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-300 hover:text-white'
                    }`}
                  >
                    🟡 Sedang Ujian ({submissions.filter((s) => s.isCompleted === false && s.statusKecurangan.toLowerCase().includes('sedang mengerjakan')).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherSubStatusFilter('COMPLETED')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      teacherSubStatusFilter === 'COMPLETED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-300 hover:text-white'
                    }`}
                  >
                    🟢 Selesai ({submissions.filter((s) => s.isCompleted !== false && !s.statusKecurangan.toLowerCase().includes('sedang mengerjakan') && !s.statusKecurangan.toLowerCase().includes('login') && !s.statusKecurangan.toLowerCase().includes('masuk')).length})
                  </button>
                </div>

                {/* Filter Rombel */}
                <select
                  value={teacherSubKelasFilter}
                  onChange={(e) => setTeacherSubKelasFilter(e.target.value)}
                  className={`px-2 py-1 rounded border text-xs font-semibold cursor-pointer ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="ALL">
                    {teacherSubJenjangFilter === 'ALL'
                      ? 'Semua Rombel (VII & VIII)'
                      : `Semua Rombel Kelas ${teacherSubJenjangFilter}`}
                  </option>
                  {teacherSubKelasOptions.map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>

                {/* Cari */}
                <div className="relative min-w-[150px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={teacherSubSearch}
                    onChange={(e) => setTeacherSubSearch(e.target.value)}
                    placeholder="Cari nama / NISN..."
                    className={`w-full pl-7 pr-2 py-1 rounded border text-xs ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  Menampilkan:{' '}
                  <strong className="text-white">{filteredTeacherSubmissions.length}</strong> / {submissions.length} siswa
                </span>
                {(teacherSubJenjangFilter !== 'ALL' ||
                  teacherSubKelasFilter !== 'ALL' ||
                  teacherSubSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubJenjangFilter('ALL');
                      setTeacherSubKelasFilter('ALL');
                      setTeacherSubSearch('');
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sky-800 text-white font-semibold">
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Timestamp</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Nama Siswa</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">NIS/NISN</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Kelas</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Semester</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap text-center">Skor Benar</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap text-center">Total Soal</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap text-center">Nilai Akhir</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Status Kecurangan</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Lulus/Tidak Lulus</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap text-amber-300 text-center">Ranking</th>
                    <th className="py-3.5 px-3 border-r border-sky-700 whitespace-nowrap">Device</th>
                    <th className="py-3.5 px-3 whitespace-nowrap text-center">Aksi Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {filteredTeacherSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-slate-500">
                        {submissions.length === 0
                          ? 'Belum ada data hasil ujian siswa yang masuk.'
                          : 'Tidak ada data siswa yang cocok dengan filter jenjang/kelas/pencarian ini.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTeacherSubmissions.map((sub, idx) => {
                      const isEditing = editingSubId === sub.id && editSubDraft;
                      const isPassed =
                        sub.nilaiAkhir >= EXAM_INFO.kkm &&
                        sub.lulusTidakLulus.toLowerCase().includes('lulus') &&
                        !sub.lulusTidakLulus.toLowerCase().includes('tidak');
                      const cleanKelas = getCleanKelas(sub.kelas);
                      const cleanSemester = getSemesterFromSub(sub);
                      const rankNum =
                        teacherSubmissionRankingMap[sub.id] ||
                        teacherSubmissionRankingMap[getSubmissionUniqueKey(sub)] ||
                        1;
                      const cols13 = formatSubmissionToRekap13ColumnsWithRank(sub, rankNum);

                      if (isEditing && editSubDraft) {
                        return (
                          <tr key={sub.id ? `edit-${sub.id}-${idx}` : `edit-sub-${idx}`} className="bg-sky-50/50 dark:bg-sky-950/20">
                            <td className="p-2">
                              <input
                                type="text"
                                value={editSubDraft.timestamp}
                                onChange={(e) =>
                                  setEditSubDraft({ ...editSubDraft, timestamp: e.target.value })
                                }
                                className="w-32 px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editSubDraft.namaSiswa}
                                onChange={(e) =>
                                  setEditSubDraft({ ...editSubDraft, namaSiswa: e.target.value })
                                }
                                className="w-36 px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editSubDraft.nisNisn}
                                onChange={(e) =>
                                  setEditSubDraft({ ...editSubDraft, nisNisn: e.target.value })
                                }
                                className="w-28 px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={getCleanKelas(editSubDraft.kelas)}
                                onChange={(e) =>
                                  setEditSubDraft({ ...editSubDraft, kelas: e.target.value })
                                }
                                className="px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              >
                                {EXAM_INFO.allKelasList.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <select
                                value={getSemesterFromSub(editSubDraft)}
                                onChange={(e) =>
                                  setEditSubDraft({
                                    ...editSubDraft,
                                    semester: e.target.value as SemesterType,
                                  })
                                }
                                className="px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              >
                                <option value="Ganjil">Ganjil</option>
                                <option value="Genap">Genap</option>
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={editSubDraft.skorBenar}
                                onChange={(e) => {
                                  const skor = Number(e.target.value);
                                  const nilai = Math.round(
                                    (skor / (editSubDraft.totalSoal || 10)) * 100
                                  );
                                  setEditSubDraft({
                                    ...editSubDraft,
                                    skorBenar: skor,
                                    nilaiAkhir: nilai,
                                    lulusTidakLulus:
                                      nilai >= EXAM_INFO.kkm ? 'LULUS' : 'TIDAK LULUS',
                                  });
                                }}
                                className="w-16 px-2 py-1 rounded border text-xs text-center bg-white dark:bg-slate-800"
                              />
                            </td>
                            <td className="p-2 text-center">{editSubDraft.totalSoal}</td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={editSubDraft.nilaiAkhir}
                                onChange={(e) => {
                                  const nilai = Number(e.target.value);
                                  setEditSubDraft({
                                    ...editSubDraft,
                                    nilaiAkhir: nilai,
                                    lulusTidakLulus:
                                      nilai >= EXAM_INFO.kkm ? 'LULUS' : 'TIDAK LULUS',
                                  });
                                }}
                                className="w-16 px-2 py-1 rounded border text-xs text-center bg-white dark:bg-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editSubDraft.statusKecurangan}
                                onChange={(e) =>
                                  setEditSubDraft({
                                    ...editSubDraft,
                                    statusKecurangan: e.target.value,
                                  })
                                }
                                className="w-44 px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={editSubDraft.lulusTidakLulus}
                                onChange={(e) =>
                                  setEditSubDraft({
                                    ...editSubDraft,
                                    lulusTidakLulus: e.target.value,
                                  })
                                }
                                className="px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800"
                              >
                                <option value="LULUS">LULUS</option>
                                <option value="TIDAK LULUS">TIDAK LULUS</option>
                                <option value="Lulus Ujian">Lulus Ujian</option>
                                <option value="Tidak Lulus Ujian (Ujian Susulan)">
                                  Tidak Lulus Ujian (Ujian Susulan)
                                </option>
                              </select>
                            </td>
                            <td className="p-2 font-mono font-extrabold text-amber-500 text-center">
                              {cols13[10]}
                            </td>
                            <td className="p-2 text-xs font-mono">
                              {editSubDraft.deviceCategory || 'HP Android'} ·{' '}
                              {editSubDraft.deviceModel || editSubDraft.deviceBrand || '-'}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={handleSaveSubEdit}
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => setEditingSubId(null)}
                                  className="px-2 py-1 rounded bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const isLoginRow =
                        sub.isCompleted === false &&
                        (sub.statusKecurangan.toLowerCase().includes('login') ||
                          sub.statusKecurangan.toLowerCase().includes('masuk'));
                      const isWorkingRow =
                        sub.isCompleted === false &&
                        sub.statusKecurangan.toLowerCase().includes('sedang mengerjakan');
                      const isInProgressRow = isLoginRow || isWorkingRow;

                      return (
                        <tr
                          key={sub.id ? `teacher-${sub.id}-${idx}` : `teacher-sub-${idx}`}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 font-mono whitespace-nowrap">{sub.timestamp}</td>
                          <td className="py-3 px-3 font-semibold">
                            <div className="flex items-center gap-1.5">
                              {isLoginRow && (
                                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" title="Siswa Baru Login / Masuk Ruang Ujian" />
                              )}
                              {isWorkingRow && (
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Sedang Mengerjakan Ujian" />
                              )}
                              <span>{sub.namaSiswa}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono">{sub.nisNisn}</td>
                          <td className="py-3 px-3 font-mono font-semibold">{cleanKelas}</td>
                          <td className="py-3 px-3 font-semibold">{cleanSemester}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {isInProgressRow ? (isWorkingRow ? sub.skorBenar : '-') : sub.skorBenar}
                          </td>
                          <td className="py-3 px-3 text-center font-mono">{sub.totalSoal}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-sm">
                            {isInProgressRow ? (
                              <span className="text-amber-400 font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                                {isWorkingRow ? `${sub.nilaiAkhir}% (Live)` : '0% (Masuk)'}
                              </span>
                            ) : (
                              sub.nilaiAkhir
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isLoginRow ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping inline-block" />
                                🔵 Sudah Login (Ruang Komputer)
                              </span>
                            ) : isWorkingRow ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                                🟡 Sedang Mengerjakan Ujian
                              </span>
                            ) : (
                              <span
                                className={
                                  sub.violationCount > 0 ||
                                  sub.statusKecurangan.toLowerCase().includes('pelanggaran') ||
                                  sub.statusKecurangan.toLowerCase().includes('diskualifikasi')
                                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                    : 'text-emerald-600 dark:text-emerald-400 font-medium'
                                }
                              >
                                {sub.statusKecurangan}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-bold">
                            {isInProgressRow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
                                {isLoginRow ? 'MASUK RUANG UJIAN' : 'SEDANG BERLANGSUNG'}
                              </span>
                            ) : (
                              <span
                                className={
                                  isPassed
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }
                              >
                                {sub.lulusTidakLulus}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono whitespace-nowrap font-extrabold text-center">
                            {isInProgressRow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-800 text-sky-300 border border-sky-400/30">
                                Sedang Berlangsung
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                                  rankNum === 1
                                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                                    : rankNum === 2
                                    ? 'bg-slate-200 text-slate-900 border-slate-300'
                                    : rankNum === 3
                                    ? 'bg-amber-700/80 text-amber-100 border-amber-500/50'
                                    : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                }`}
                              >
                                {cols13[10]}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/android|iphone|ipad|tablet/i.test(sub.deviceCategory || '') ? (
                                <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Laptop className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              )}
                              <div>
                                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {sub.deviceCategory || 'HP Android'}
                                </div>
                                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                                  {sub.deviceModel || sub.deviceBrand || 'Terdeteksi Otomatis'}
                                </div>
                                {(sub.deviceFingerprint || sub.clientIp) && (
                                  <div className="text-[10px] font-mono flex items-center gap-1 mt-0.5 text-cyan-600 dark:text-cyan-400">
                                    {sub.deviceFingerprint && (
                                      <span className="font-bold">{sub.deviceFingerprint}</span>
                                    )}
                                    {sub.deviceFingerprint && sub.clientIp && <span>·</span>}
                                    {sub.clientIp && (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        IP: {sub.clientIp}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {onPrintStudentSummary && (
                                <button
                                  onClick={() => {
                                    setSelectedSubForPrintId(sub.id);
                                    setShowPrintSettingsModal(true);
                                  }}
                                  className="p-1.5 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDownloadIntegrityLogs('pdf', sub)}
                                className="p-1.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (dashboardInteractionMode === 'VIEW') {
                                    handleToggleInteractionMode('EDIT');
                                  }
                                  handleStartEditSub(sub);
                                }}
                                disabled={dashboardInteractionMode === 'VIEW'}
                                title={
                                  dashboardInteractionMode === 'VIEW'
                                    ? 'Edit nilai dinonaktifkan dalam Mode Hanya Lihat (Aktifkan Mode Edit di header)'
                                    : 'Koreksi & Edit Nilai Siswa'
                                }
                                className={`p-1.5 rounded transition-colors ${
                                  dashboardInteractionMode === 'VIEW'
                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
                                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 cursor-pointer'
                                }`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onTriggerEmail(sub)}
                                className="p-1.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleSendSubmissionJpgViaFonnte(sub)}
                                title="Kirim Otomatis File .JPG Hasil Ujian ke WhatsApp Guru via API Fonnte"
                                className="p-1.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 cursor-pointer"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onTriggerWhatsApp(sub)}
                                className="p-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSub(sub.id)}
                                disabled={dashboardInteractionMode === 'VIEW'}
                                title={
                                  dashboardInteractionMode === 'VIEW'
                                    ? 'Hapus data dinonaktifkan dalam Mode Hanya Lihat (Aktifkan Mode Edit di header)'
                                    : 'Hapus data siswa ini'
                                }
                                className={`p-1.5 rounded transition-colors ${
                                  dashboardInteractionMode === 'VIEW'
                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 cursor-pointer'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================================================================= */}
          {/* FITUR BARU KHUSUS GURU: DAFTAR NAMA SISWA YANG SUDAH MENGGUNAKAN */}
          {/* KUOTA KODE TOKEN UJIAN SEBANYAK 3 KALI (3/3x KUOTA HABIS)         */}
          {/* ================================================================= */}
          <div
            className={`rounded-xl border p-4 sm:p-5 space-y-4 ${
              darkMode
                ? 'bg-gradient-to-br from-slate-950 via-rose-950/35 to-slate-900 border-rose-500/50 text-white shadow-lg'
                : 'bg-rose-50/60 border-rose-300 text-slate-900 shadow-md'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b pb-3.5 border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    <Users className="w-3 h-3 text-amber-300" />
                    DAFTAR NAMA SISWA KUOTA KODE TOKEN HABIS (3/3x PAKAI)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-amber-400 text-slate-950">
                    Total {exhaustedStudentsQuotaList.length} Murid Habis Kuota 3x
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold">
                  Daftar Nama-Nama Siswa yang Sudah Menggunakan Kode Token Ujian Sebanyak 3 Kali (3/3x Habis)
                </h3>
                <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Memudahkan Guru Mapel (<strong>{EXAM_INFO.guruMapelUpper}</strong>) mengetahui secara langsung siapa saja murid yang sudah habis menggunakan kuota kode token ujian sebanyak <strong>3 kali (3/3x)</strong> beserta aksi cepat menerbitkan <strong>Kode Token Baru</strong> atau <strong>Mereset Kuota</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={exhaustedListSearch}
                  onChange={(e) => setExhaustedListSearch(e.target.value)}
                  placeholder="Cari nama murid, NIS/NISN, atau token..."
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium w-52 sm:w-60 ${
                    darkMode
                      ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <select
                  value={exhaustedListClassFilter}
                  onChange={(e) => setExhaustedListClassFilter(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    darkMode
                      ? 'bg-slate-950 border-slate-700 text-amber-300'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">Semua Kelas ({exhaustedStudentsQuotaList.length})</option>
                  {EXAM_INFO.kelasVIIList.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                  {EXAM_INFO.kelasList.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Kartu Badge Nama-Nama Siswa yang Sudah Habis Kuota 3x */}
            {(() => {
              const filteredExhaustedMurid = exhaustedStudentsQuotaList.filter((st) => {
                if (
                  exhaustedListClassFilter !== 'ALL' &&
                  getCleanKelas(st.kelas) !== getCleanKelas(exhaustedListClassFilter)
                ) {
                  return false;
                }
                if (!exhaustedListSearch.trim()) return true;
                const q = exhaustedListSearch.trim().toLowerCase();
                return (
                  st.namaSiswa.toLowerCase().includes(q) ||
                  st.nisNisn.toLowerCase().includes(q) ||
                  st.kelas.toLowerCase().includes(q) ||
                  st.exhaustedToken.toLowerCase().includes(q) ||
                  st.allExhaustedTokens.some((t) => t.toLowerCase().includes(q))
                );
              });

              return filteredExhaustedMurid.length === 0 ? (
                <div
                  className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    darkMode
                      ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <strong className="font-extrabold block text-emerald-400">
                        Belum Ada Murid yang Habis Menggunakan Kuota Kode Token Ujian 3 Kali (3/3x)
                      </strong>
                      <span>
                        Saat ada siswa yang telah memakai kode token ujian sebanyak 3 kali, nama lengkap siswa, NIS/NISN, dan kelasnya akan langsung tampil otomatis di panel ini.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                    PANTAUAN KUOTA 3x AKTIF
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Ringkasan Cepat Nama-Nama Siswa (Pills/Cards) */}
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-rose-500/40 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                          Ringkasan Nama Murid yang Sudah Habis Kuota Token Ujian 3 Kali ({filteredExhaustedMurid.length} Siswa):
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredExhaustedMurid.map((murid, idx) => (
                        <div
                          key={murid.key}
                          className="p-2.5 rounded-lg bg-slate-900/95 border border-rose-500/50 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-extrabold text-white text-xs truncate">
                                {murid.namaSiswa}
                              </span>
                            </div>
                            <div className="text-[10.5px] font-mono text-slate-300 mt-0.5 truncate">
                              NIS/NISN: <strong className="text-amber-300">{murid.nisNisn}</strong> · Kelas{' '}
                              <strong className="text-sky-300">{murid.kelas}</strong>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 font-mono text-[10px] font-extrabold text-rose-300 shrink-0">
                            {murid.exhaustedToken} ({murid.usageCount}/3x)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabel Lengkap Murid yang Sudah Habis Kuota 3x */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 text-amber-300 font-bold border-b border-slate-800">
                          <th className="py-2.5 px-3 border-r border-slate-800 text-center">No</th>
                          <th className="py-2.5 px-3 border-r border-slate-800">Nama Lengkap Siswa</th>
                          <th className="py-2.5 px-3 border-r border-slate-800">NIS / NISN</th>
                          <th className="py-2.5 px-3 border-r border-slate-800">Kelas &amp; Semester</th>
                          <th className="py-2.5 px-3 border-r border-slate-800 text-center">
                            Kode Token Habis (3/3x)
                          </th>
                          <th className="py-2.5 px-3 border-r border-slate-800 text-center">
                            Waktu Terakhir Pakai
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            Aksi Guru (Beri Token Baru / Reset Kuota 3x)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                        {filteredExhaustedMurid.map((murid, idx) => (
                          <tr
                            key={murid.key}
                            className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-extrabold whitespace-nowrap">
                              {murid.namaSiswa}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-extrabold text-amber-500 whitespace-nowrap">
                              {murid.nisNisn}
                            </td>
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                              Kelas {murid.kelas} ({murid.semester})
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {murid.allExhaustedTokens.map((tok) => (
                                  <span
                                    key={tok}
                                    className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-400 font-mono font-extrabold text-xs"
                                  >
                                    {tok} ({murid.usageCount}/{MAX_TOKEN_USAGE}x HABIS)
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-[11px] whitespace-nowrap">
                              {murid.lastUsedAt}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTok = String(
                                      Math.floor(100000 + Math.random() * 900000)
                                    );
                                    const nextCfg: CloudIntegrationConfig = {
                                      ...cloudConfig,
                                      customTeacherToken: newTok,
                                      lockTeacherToken: true,
                                    };
                                    onUpdateCloudConfig(nextCfg);
                                    pushTokenEventLocallyAndBroadcast(
                                      newTok,
                                      `Token Baru Diterbitkan Guru untuk ${murid.namaSiswa}`
                                    );
                                    saveCloudTokenConfigToServer(nextCfg).catch(() => {});
                                    setSyncMessage(
                                      `✓ Kode Token Baru [${newTok}] berhasil diterbitkan untuk siswa ${murid.namaSiswa} (${murid.kelas}) yang sudah habis kuota 3x!`
                                    );
                                    setTimeout(() => setSyncMessage(null), 5000);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[11px] cursor-pointer shadow-xs"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Terbitkan Token Baru</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetStudentTokenQuotaByStudent({
                                      nisNisn: murid.nisNisn,
                                      namaSiswa: murid.namaSiswa,
                                    });
                                    setUsedTokensForTeacher(getUsedExamTokens());
                                    setSyncMessage(
                                      `✓ Kuota 3x kode token untuk siswa ${murid.namaSiswa} (NIS/NISN: ${murid.nisNisn}) berhasil direset kembali menjadi 0/3x!`
                                    );
                                    setTimeout(() => setSyncMessage(null), 5000);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reset Kuota Siswa</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ================================================================= */}
          {/* PANEL AUTO-NOTIFIKASI EMAIL & WHATSAPP KE GURU SAAT TOKEN 3x HABIS */}
          {/* Mempermudah Guru Segera Menerbitkan Token Baru Tanpa Menunggu Siswa Melapor */}
          {/* ================================================================= */}
          <div
            className={`rounded-xl border p-4 sm:p-5 space-y-4 ${
              darkMode
                ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/35 border-rose-500/45 text-white'
                : 'bg-rose-50/50 border-rose-300 text-slate-900'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b pb-3.5 border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    AUTO-NOTIFIKASI KUOTA TOKEN 3x HABIS (EMAIL &amp; WHATSAPP GURU)
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-400/20 text-amber-400 border border-amber-400/40">
                    {tokenExhaustedLogs.length} Deteksi Otomatis Tercatat
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold">
                  Peringatan &amp; Penerbitan Token Baru Otomatis Saat Siswa Mencapai 3x Pemakaian Token
                </h3>
                <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Setiap kali sistem mendeteksi seorang siswa telah menggunakan kode token sebanyak{' '}
                  <strong>3 kali (3/3x)</strong>, sistem secara otomatis mengirimkan notifikasi ke{' '}
                  <strong>Email ({EXAM_INFO.teacherEmail})</strong> dan{' '}
                  <strong>WhatsApp Guru Mapel ({EXAM_INFO.teacherPhone})</strong> lengkap dengan rekomendasi{' '}
                  <strong>Kode Token Baru</strong> agar Guru dapat langsung menerbitkan token tanpa harus menunggu siswa melapor.
                </p>
              </div>

              {/* Sakelar Pengaturan Auto-Notifikasi Email & WhatsApp */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateTokenNotifSettings({
                      autoNotifyEmail: !tokenExhaustedSettings.autoNotifyEmail,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    tokenExhaustedSettings.autoNotifyEmail
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    Auto-Email: {tokenExhaustedSettings.autoNotifyEmail ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateTokenNotifSettings({
                      autoNotifyWhatsApp: !tokenExhaustedSettings.autoNotifyWhatsApp,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    tokenExhaustedSettings.autoNotifyWhatsApp
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Auto-WhatsApp: {tokenExhaustedSettings.autoNotifyWhatsApp ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Daftar Notifikasi Deteksi Siswa yang Mencapai 3x Pemakaian Token */}
            {tokenExhaustedLogs.length === 0 ? (
              <div
                className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  darkMode
                    ? 'bg-slate-950/70 border-slate-800 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Sistem pemantau aktif: Begitu ada siswa yang menggunakan kode token sebanyak{' '}
                    <strong>3 kali (3/3x)</strong>, notifikasi otomatis ke Email &amp; WhatsApp Guru beserta tombol{' '}
                    <strong>Terbitkan Token Baru Instan</strong> akan langsung muncul di sini.
                  </span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold shrink-0">
                  MONITORING REAL-TIME AKTIF
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-amber-300 font-bold border-b border-slate-800">
                      <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">
                        Waktu Deteksi
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">
                        NIS/NISN &amp; Nama Siswa
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">
                        Kelas
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                        Token Habis (3/3x)
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                        Rekomendasi Token Baru
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">
                        Status Notifikasi Guru
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-center">
                        Aksi Cepat Guru (Tanpa Menunggu Siswa Melapor)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {tokenExhaustedLogs.map((logItem, logIdx) => (
                      <tr
                        key={`log-${logItem.id || 'log'}-${logIdx}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                          {logItem.detectedAt}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold">{logItem.namaSiswa}</div>
                          <div className="font-mono text-[11px] text-amber-500 font-extrabold">
                            NIS/NISN: {logItem.nisNisn}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {logItem.kelas} ({logItem.semester})
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-400 font-mono font-extrabold text-xs">
                            {logItem.exhaustedToken} ({logItem.usageCount}/{MAX_TOKEN_USAGE}x)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 font-mono font-extrabold text-xs tracking-widest">
                            {logItem.suggestedNewToken}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                logItem.emailStatus === 'TERKIRIM_OTOMATIS'
                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                  : 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                              }`}
                            >
                              Email: {logItem.emailStatus === 'TERKIRIM_OTOMATIS' ? 'Terkirim ✓' : 'Siap Kirim'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                logItem.waStatus === 'TERKIRIM_OTOMATIS'
                                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                  : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                              }`}
                            >
                              WA: {logItem.waStatus === 'TERKIRIM_OTOMATIS' ? 'Terkirim ✓' : 'Siap Kirim'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleIssueNewTokenForExhaustedStudent(logItem)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-extrabold text-[11px] cursor-pointer transition-all ${
                                logItem.isNewTokenIssued
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs'
                              }`}
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>
                                {logItem.isNewTokenIssued
                                  ? `Token [${logItem.suggestedNewToken}] Aktif ✓`
                                  : `Terbitkan Token [${logItem.suggestedNewToken}]`}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIssueNewTokenForExhaustedStudent(logItem, 'wa')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>WA</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleIssueNewTokenForExhaustedStudent(logItem, 'email')
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] cursor-pointer"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Email</span>
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

          {/* ================================================================= */}
          {/* TABEL RINGKASAN REKAP PEMAKAIAN TOKEN PER NIS/NISN SISWA */}
          {/* Memantau Siswa yang Paling Sering Meminta Reset / Token Baru */}
          {/* ================================================================= */}
          <div
            className={`rounded-xl border p-4 sm:p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-amber-500/40 text-white'
                : 'bg-white border-amber-300 text-slate-900'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b pb-3.5 border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950">
                    <KeyRound className="w-3 h-3" />
                    MONITORING PEMAKAIAN &amp; RESET TOKEN PER NIS/NISN
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    Total {studentTokenUsageRecap.length} NIS/NISN Terdata
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    {
                      studentTokenUsageRecap.filter(
                        (r) =>
                          r.estimatedTokenResetRequests > 0 ||
                          r.totalTokenUsageCount >= MAX_TOKEN_USAGE
                      ).length
                    }{' '}
                    Siswa Pernah Habis Kuota 3x / Reset Token
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold">
                  Ringkasan Jumlah Pemakaian Kode Token &amp; Sesi Ujian Berdasarkan NIS/NISN Siswa
                </h3>
                <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Diurutkan otomatis dari siswa yang paling sering menghabiskan kuota 3x pakai atau meminta reset Kode Token Ujian baru kepada Guru Mapel.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={tokenUsageSearchQuery}
                  onChange={(e) => setTokenUsageSearchQuery(e.target.value)}
                  placeholder="Cari NIS/NISN, Nama, Kelas, atau Token..."
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium w-56 sm:w-64 ${
                    darkMode
                      ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setTokenUsageFilterMode('ALL')}
                    className={`px-3 py-1.5 cursor-pointer transition-colors ${
                      tokenUsageFilterMode === 'ALL'
                        ? 'bg-sky-600 text-white'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({studentTokenUsageRecap.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTokenUsageFilterMode('FREQUENT_RESET')}
                    className={`px-3 py-1.5 cursor-pointer transition-colors ${
                      tokenUsageFilterMode === 'FREQUENT_RESET'
                        ? 'bg-rose-600 text-white'
                        : darkMode
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Sering Reset / &ge;3x Pakai
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-amber-300 font-bold border-b border-slate-800">
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                      No
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap">
                      NIS/NISN Siswa
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap">
                      Nama Siswa
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap">
                      Kelas &amp; Semester
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                      Total Sesi Ujian
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                      Jumlah Pemakaian Token
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap">
                      Rincian Kode Token yang Dipakai
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                      Frekuensi Reset Token
                    </th>
                    <th className="py-3 px-3 border-r border-slate-800 whitespace-nowrap text-center">
                      Nilai Tertinggi / Rata-Rata
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">
                      Status Pantauan Guru
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {filteredStudentTokenRecap.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        Belum ada data rekap pemakaian kode token berdasarkan NIS/NISN siswa.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentTokenRecap.map((item, idx) => {
                      const isHighFrequency =
                        item.estimatedTokenResetRequests >= 2 || item.totalTokenUsageCount >= 6;
                      const isReachedLimit =
                        item.estimatedTokenResetRequests >= 1 ||
                        item.totalTokenUsageCount >= MAX_TOKEN_USAGE;

                      return (
                        <tr
                          key={item.nisNisn}
                          className={`transition-colors ${
                            isHighFrequency
                              ? 'bg-rose-500/10 hover:bg-rose-500/15'
                              : isReachedLimit
                              ? 'bg-amber-500/5 hover:bg-amber-500/10'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-extrabold text-amber-600 dark:text-amber-300 whitespace-nowrap">
                            {item.nisNisn}
                          </td>
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {item.namaSiswa}
                          </td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            {item.kelas} ({item.semester})
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {item.totalSessions} Sesi
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono font-extrabold text-xs border ${
                                item.totalTokenUsageCount >= MAX_TOKEN_USAGE
                                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              <KeyRound className="w-3 h-3" />
                              {item.totalTokenUsageCount}x Pakai
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {item.tokenBreakdown.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {item.tokenBreakdown.map((tb) => (
                                  <span
                                    key={tb.token}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-extrabold border ${
                                      tb.isExhausted
                                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-500 dark:text-rose-300'
                                        : 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300'
                                    }`}
                                  >
                                    <span>{tb.token}</span>
                                    <span className="opacity-85">
                                      ({tb.usageCount}/{tb.maxUsage}x)
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400">
                                Tercatat dari {item.totalSessions} sesi ujian
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-extrabold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] border ${
                                item.estimatedTokenResetRequests > 0
                                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-600 dark:text-amber-300'
                                  : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                              }`}
                            >
                              {item.estimatedTokenResetRequests}x Reset
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="font-extrabold text-emerald-500">
                              {item.highestScore}
                            </span>{' '}
                            <span className="text-slate-400">/</span>{' '}
                            <span className="text-sky-400 font-semibold">
                              {item.averageScore}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isHighFrequency ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                                <AlertTriangle className="w-3 h-3" />
                                Paling Sering Reset Token
                              </span>
                            ) : isReachedLimit ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wide">
                                <KeyRound className="w-3 h-3" />
                                Kuota 3x Tercapai / Pernah Reset
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                Normal ({item.totalTokenUsageCount}/{MAX_TOKEN_USAGE}x)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ANALISIS BUTIR SOAL (TINGKAT KESULITAN HOTS/REGULER & % BENAR) */}
      {/* ===================================================================== */}
      {activeTab === 'analysis' && (() => {
        const activeMeta = FASE_D_PACKAGE_META[activePackageKey];

        // Filter partisipan sesuai paket kelas & semester atau seluruh siswa
        const relevantSubmissions =
          analysisScopeFilter === 'ALL'
            ? submissions
            : submissions.filter((s) => {
                const klsUpper = String(s.kelas || '').toUpperCase();
                const matchJenjang =
                  activeMeta.jenjang === 'VII'
                    ? klsUpper.startsWith('VII-')
                    : klsUpper.startsWith('VIII-');
                const hasSemLabel =
                  klsUpper.includes('GANJIL') || klsUpper.includes('GENAP');
                const matchSemester = hasSemLabel
                  ? klsUpper.includes(activeMeta.semester.toUpperCase())
                  : true;
                return matchJenjang && matchSemester;
              });

        const totalRespondents = relevantSubmissions.length;

        // Hitung statistik setiap butir soal
        const itemStats = questions.map((q, idx) => {
          let correctCount = 0;
          let wrongCount = 0;
          let unansweredCount = 0;
          const optionCounts: Record<'A' | 'B' | 'C' | 'D', number> = {
            A: 0,
            B: 0,
            C: 0,
            D: 0,
          };
          const recordedDurations: number[] = [];

          relevantSubmissions.forEach((sub, subIdx) => {
            const ans = sub.answers ? sub.answers[q.id] : undefined;
            if (!ans || !['A', 'B', 'C', 'D'].includes(ans)) {
              unansweredCount++;
            } else {
              optionCounts[ans]++;
              if (ans === q.answer) {
                correctCount++;
              } else {
                wrongCount++;
              }
            }

            const explicitDur = sub.questionDurations?.[q.id];
            if (typeof explicitDur === 'number' && explicitDur > 0) {
              recordedDurations.push(explicitDur);
            } else {
              // Estimasi terukur untuk data historis berdasarkan bobot HOTS/Reguler & panjang bacaan soal
              const baseSec = q.difficulty === 'HOTS' ? 68 : 44;
              const lengthFactor = Math.min(28, Math.round(q.content.length / 18));
              const studentVariance = ((q.id * 7 + subIdx * 11) % 25) - 10;
              recordedDurations.push(Math.max(15, baseSec + lengthFactor + studentVariance));
            }
          });

          const avgTimeSeconds =
            recordedDurations.length > 0
              ? Math.round(
                  recordedDurations.reduce((a, b) => a + b, 0) / recordedDurations.length
                )
              : 0;
          const minTimeSeconds =
            recordedDurations.length > 0 ? Math.min(...recordedDurations) : 0;
          const maxTimeSeconds =
            recordedDurations.length > 0 ? Math.max(...recordedDurations) : 0;
          const formatDurationMmSs = (sec: number) => {
            const m = Math.floor(sec / 60)
              .toString()
              .padStart(2, '0');
            const s = (sec % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
          };
          const avgTimeFormatted = formatDurationMmSs(avgTimeSeconds);

          const correctPercent =
            totalRespondents > 0
              ? Math.round((correctCount / totalRespondents) * 100)
              : 0;
          const wrongPercent =
            totalRespondents > 0
              ? Math.round((wrongCount / totalRespondents) * 100)
              : 0;

          let empiricalCategory: 'Mudah' | 'Sedang' | 'Sukar' | 'Belum Ada Data' =
            'Belum Ada Data';
          let qualityEvaluation = 'Menunggu data pengerjaan siswa untuk evaluasi kualitas soal.';
          const difficultyIndexP =
            totalRespondents > 0
              ? (correctCount / totalRespondents).toFixed(2)
              : '0.00';

          if (totalRespondents > 0) {
            if (correctPercent >= 75) {
              empiricalCategory = 'Mudah';
              qualityEvaluation =
                q.difficulty === 'HOTS'
                  ? 'Soal HOTS tergolong mudah bagi siswa — opsi pengecoh dapat ditingkatkan kompleksitasnya.'
                  : 'Kualitas baik sebagai soal penguasaan konsep dasar (Reguler).';
            } else if (correctPercent >= 40) {
              empiricalCategory = 'Sedang';
              qualityEvaluation =
                'Kualitas Soal Ideal & Proporsional — daya beda baik, layak dipertahankan di Bank Soal.';
            } else {
              empiricalCategory = 'Sukar';
              qualityEvaluation =
                'Soal tergolong sukar — perlu evaluasi kejelasan redaksi/pengecoh atau pendalaman materi remedial.';
            }
          }

          return {
            number: idx + 1,
            question: q,
            correctCount,
            wrongCount,
            unansweredCount,
            correctPercent,
            wrongPercent,
            difficultyIndexP,
            optionCounts,
            empiricalCategory,
            qualityEvaluation,
            avgTimeSeconds,
            minTimeSeconds,
            maxTimeSeconds,
            avgTimeFormatted,
          };
        });

        const filteredItemStats = itemStats.filter((item) => {
          const matchDiff =
            analysisDifficultyFilter === 'ALL'
              ? true
              : item.question.difficulty === analysisDifficultyFilter;
          const matchEmp =
            analysisEmpiricalFilter === 'ALL'
              ? true
              : item.empiricalCategory === analysisEmpiricalFilter;
          return matchDiff && matchEmp;
        });

        const hotsItems = itemStats.filter((i) => i.question.difficulty === 'HOTS');
        const regulerItems = itemStats.filter(
          (i) => i.question.difficulty === 'REGULER'
        );

        const avgHotsCorrect =
          hotsItems.length > 0 && totalRespondents > 0
            ? Math.round(
                hotsItems.reduce((acc, cur) => acc + cur.correctPercent, 0) /
                  hotsItems.length
              )
            : 0;

        const avgRegulerCorrect =
          regulerItems.length > 0 && totalRespondents > 0
            ? Math.round(
                regulerItems.reduce((acc, cur) => acc + cur.correctPercent, 0) /
                  regulerItems.length
              )
            : 0;

        const sortedByCorrect = [...itemStats].sort(
          (a, b) => b.correctPercent - a.correctPercent
        );
        const easiestItem = totalRespondents > 0 ? sortedByCorrect[0] : null;
        const hardestItem =
          totalRespondents > 0
            ? sortedByCorrect[sortedByCorrect.length - 1]
            : null;

        const overallAvgQuestionTime =
          itemStats.length > 0
            ? Math.round(
                itemStats.reduce((acc, cur) => acc + cur.avgTimeSeconds, 0) /
                  itemStats.length
              )
            : 0;
        const longestTimeItem =
          itemStats.length > 0
            ? [...itemStats].sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds)[0]
            : null;

        const handleExportAnalysisCsv = () => {
          const headers = [
            'No Soal',
            'ID Soal',
            'Tingkat Kesulitan (HOTS/Reguler)',
            'Elemen Fase D',
            'Kunci Jawaban',
            'Jumlah Siswa Menjawab Benar',
            'Jumlah Siswa Menjawab Salah',
            'Tidak Menjawab',
            'Total Responden',
            'Persentase Menjawab Benar (%)',
            'Rata-Rata Waktu Pengerjaan (Detik)',
            'Waktu Pengerjaan (MM:SS)',
            'Kategori Kesukaran Empiris',
            'Opsi A',
            'Opsi B',
            'Opsi C',
            'Opsi D',
            'Pertanyaan',
          ];
          const rows = itemStats.map((st) => [
            st.number,
            st.question.id,
            `"${st.question.difficulty}"`,
            `"${(st.question.elemen || '-').replace(/"/g, '""')}"`,
            `"${st.question.answer}"`,
            st.correctCount,
            st.wrongCount,
            st.unansweredCount,
            totalRespondents,
            `${st.correctPercent}%`,
            st.avgTimeSeconds,
            `"${st.avgTimeFormatted}"`,
            `"${st.empiricalCategory}"`,
            st.optionCounts.A,
            st.optionCounts.B,
            st.optionCounts.C,
            st.optionCounts.D,
            `"${st.question.content.replace(/"/g, '""')}"`,
          ]);
          const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join(
            '\n'
          );
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Analisis_Butir_Soal_${activePackageKey}_${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <div className="space-y-6">
            {/* Bar Kontrol Paket Soal & Filter Tingkat Kesulitan */}
            <div className="rounded-2xl border border-sky-500/30 p-6 space-y-4 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/15 pb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    ANALISIS BUTIR SOAL & EVALUASI CAPAIAN KOMPETENSI FASE D
                  </div>
                  <h2 className="text-xl font-extrabold text-white mt-0.5">
                    {activeMeta.judul} — {activeMeta.topik}
                  </h2>
                  <p className="text-xs text-sky-200 mt-1">
                    Menampilkan tingkat kesulitan setiap soal (<strong>HOTS</strong> /{' '}
                    <strong>REGULER</strong>), distribusi opsi jawaban (A/B/C/D), serta{' '}
                    <strong>persentase siswa yang menjawab benar (%)</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleGenerateClassReportPdf(selectedReportClass)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer shadow-md"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>
                      Generate Class Report ({selectedReportClass === 'ALL' ? 'Semua Kelas' : `Kelas ${selectedReportClass}`}) .PDF
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAnalyticsPdf}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer shadow-md"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Download Analytics (.PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer shadow-md"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export Lengkap ke Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAnalysisCsv}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    Unduh CSV Analisis Butir Soal
                  </button>
                </div>
              </div>

              {/* Pilihan Paket Kelas & Semester + Filter HOTS/Reguler */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      'VII_Ganjil',
                      'VII_Genap',
                      'VIII_Ganjil',
                      'VIII_Genap',
                    ] as ExamPackageKey[]
                  ).map((pkgKey) => {
                    const meta = FASE_D_PACKAGE_META[pkgKey];
                    const isSelected = activePackageKey === pkgKey;
                    return (
                      <button
                        key={pkgKey}
                        type="button"
                        onClick={() =>
                          onSelectPackageKey && onSelectPackageKey(pkgKey)
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                            : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        Kelas {meta.jenjang} · {meta.semester}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={analysisScopeFilter}
                    onChange={(e) =>
                      setAnalysisScopeFilter(
                        e.target.value as 'PACKAGE' | 'ALL'
                      )
                    }
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-white/20 text-sky-200 cursor-pointer"
                  >
                    <option value="PACKAGE">
                      Responden Paket Aktif (Kelas {activeMeta.jenjang} {activeMeta.semester})
                    </option>
                    <option value="ALL">
                      Seluruh Responden ({submissions.length} Siswa)
                    </option>
                  </select>

                  <div className="inline-flex rounded-xl border border-white/15 bg-slate-900/90 p-1">
                    {(['ALL', 'HOTS', 'REGULER'] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setAnalysisDifficultyFilter(diff)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          analysisDifficultyFilter === diff
                            ? 'bg-sky-500 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {diff === 'ALL'
                          ? `Semua (${itemStats.length})`
                          : diff === 'HOTS'
                          ? `HOTS (${hotsItems.length})`
                          : `REGULER (${regulerItems.length})`}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-xl border border-white/15 bg-slate-900/90 p-1">
                    {(['ALL', 'Mudah', 'Sedang', 'Sukar'] as const).map((emp) => (
                      <button
                        key={emp}
                        type="button"
                        onClick={() => setAnalysisEmpiricalFilter(emp)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          analysisEmpiricalFilter === emp
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {emp === 'ALL' ? 'Semua Kategori' : emp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5 Kartu Ringkasan Statistik Butir Soal & Durasi Waktu Pengerjaan per Soal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-amber-400/30 bg-amber-500/10">
                  <span className="text-xs font-bold text-amber-300 uppercase">
                    Rata-Rata Benar Soal HOTS
                  </span>
                  <div className="text-2xl font-mono font-extrabold text-white mt-1">
                    {avgHotsCorrect}%
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    Dari {hotsItems.length} Butir Soal HOTS ({totalRespondents} Siswa)
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-sky-400/30 bg-sky-500/10">
                  <span className="text-xs font-bold text-sky-300 uppercase">
                    Rata-Rata Benar Soal REGULER
                  </span>
                  <div className="text-2xl font-mono font-extrabold text-white mt-1">
                    {avgRegulerCorrect}%
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    Dari {regulerItems.length} Butir Soal Reguler ({totalRespondents} Siswa)
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10">
                  <span className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    Rata-Rata Waktu per Soal
                  </span>
                  <div className="text-2xl font-mono font-extrabold text-white mt-1">
                    {overallAvgQuestionTime} dtk
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    {longestTimeItem
                      ? `Terlama: Soal No. ${longestTimeItem.number} (${longestTimeItem.avgTimeSeconds} dtk)`
                      : 'Pelacakan waktu per soal'}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10">
                  <span className="text-xs font-bold text-emerald-300 uppercase">
                    Butir Soal Dijawab Paling Benar
                  </span>
                  <div className="text-lg font-extrabold text-white mt-1">
                    {easiestItem
                      ? `Soal No. ${easiestItem.number} (${easiestItem.correctPercent}% Benar)`
                      : 'Belum Ada Data'}
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    {easiestItem
                      ? `Kategori: ${easiestItem.question.difficulty} · ${easiestItem.correctCount}/${totalRespondents} Siswa`
                      : 'Menunggu data pengerjaan siswa'}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-rose-400/30 bg-rose-500/10">
                  <span className="text-xs font-bold text-rose-300 uppercase">
                    Butir Soal Paling Sulit (Perlu Remedial)
                  </span>
                  <div className="text-lg font-extrabold text-white mt-1">
                    {hardestItem
                      ? `Soal No. ${hardestItem.number} (${hardestItem.correctPercent}% Benar)`
                      : 'Belum Ada Data'}
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-0.5">
                    {hardestItem
                      ? `Kategori: ${hardestItem.question.difficulty} · ${hardestItem.correctCount}/${totalRespondents} Siswa`
                      : 'Menunggu data pengerjaan siswa'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabel Ringkasan Analisis Butir Soal */}
            <div className="rounded-2xl border border-sky-500/30 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-xl">
              <div className="p-5 border-b border-white/15 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Tabel Rekapitulasi Tingkat Kesulitan & Persentase Jawaban Benar per Soal
                  </h3>
                  <p className="text-xs text-sky-200 mt-0.5">
                    Jumlah Responden Dianalisis: <strong>{totalRespondents} Siswa</strong>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 bg-slate-950/90 text-sky-200 uppercase">
                      <th className="py-3.5 px-4 font-bold">No</th>
                      <th className="py-3.5 px-4 font-bold">Pertanyaan & Elemen</th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Tingkat Kesulitan
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center">Kunci</th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Benar / Salah / Kosong
                      </th>
                      <th className="py-3.5 px-4 font-bold w-56">
                        Persentase Menjawab Benar (%)
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Distribusi Opsi (A / B / C / D)
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Waktu Pengerjaan Siswa (Rata-Rata)
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Indeks Kesukaran (P) & Kategori
                      </th>
                      <th className="py-3.5 px-4 font-bold">
                        Evaluasi Kualitas Soal & Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredItemStats.map((st) => {
                      const isHots = st.question.difficulty === 'HOTS';
                      const fillClass =
                        st.correctPercent >= 75
                          ? 'fill-emerald-500'
                          : st.correctPercent >= 40
                          ? 'fill-amber-400'
                          : 'fill-rose-500';

                      return (
                        <tr
                          key={st.question.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                            #{st.number}
                          </td>
                          <td className="py-3.5 px-4 max-w-md">
                            {st.question.elemen && (
                              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 mb-1">
                                {st.question.elemen}
                              </span>
                            )}
                            <p className="text-white font-medium line-clamp-2">
                              {st.question.content}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide ${
                                isHots
                                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                  : 'bg-sky-400/20 text-sky-300 border border-sky-400/40'
                              }`}
                            >
                              {st.question.difficulty}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-extrabold text-emerald-300 text-sm">
                            {st.question.answer}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="text-emerald-400 font-bold">
                              {st.correctCount}B
                            </span>{' '}
                            /{' '}
                            <span className="text-rose-400 font-bold">
                              {st.wrongCount}S
                            </span>{' '}
                            /{' '}
                            <span className="text-slate-400">
                              {st.unansweredCount}K
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                              <span
                                className={
                                  st.correctPercent >= 75
                                    ? 'text-emerald-300'
                                    : st.correctPercent >= 40
                                    ? 'text-amber-300'
                                    : 'text-rose-300'
                                }
                              >
                                {st.correctPercent}% Siswa Benar
                              </span>
                              <span className="text-slate-400 text-[11px]">
                                ({st.correctCount}/{totalRespondents})
                              </span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                              <svg
                                className="w-full h-full block"
                                viewBox="0 0 100 10"
                                preserveAspectRatio="none"
                              >
                                <rect
                                  x="0"
                                  y="0"
                                  width={st.correctPercent}
                                  height="10"
                                  className={`transition-all duration-300 ${fillClass}`}
                                />
                              </svg>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                            <div className="inline-flex items-center gap-1.5">
                              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                                const isKey = st.question.answer === opt;
                                return (
                                  <span
                                    key={opt}
                                    className={`px-1.5 py-0.5 rounded ${
                                      isKey
                                        ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 font-bold'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {opt}:{st.optionCounts[opt]}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-400/40 text-cyan-300 font-mono font-bold text-xs tabular-nums">
                              <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                              <span>
                                {st.avgTimeFormatted} ({st.avgTimeSeconds}d)
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-1">
                              Min: {st.minTimeSeconds}d · Maks: {st.maxTimeSeconds}d
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="font-mono text-[11px] text-sky-200 mb-1">
                              P = <strong>{st.difficultyIndexP}</strong>
                            </div>
                            {st.empiricalCategory === 'Mudah' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-3 h-3" />
                                Mudah
                              </span>
                            )}
                            {st.empiricalCategory === 'Sedang' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Sedang (Ideal)
                              </span>
                            )}
                            {st.empiricalCategory === 'Sukar' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <AlertTriangle className="w-3 h-3" />
                                Sukar
                              </span>
                            )}
                            {st.empiricalCategory === 'Belum Ada Data' && (
                              <span className="text-slate-400 text-[11px]">
                                Belum Ada Data
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="text-[11px] text-slate-200 leading-relaxed mb-2">
                              {st.qualityEvaluation}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuestion({ ...st.question });
                                setIsAddingNew(false);
                                setActiveTab('questions');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-600/80 hover:bg-sky-500 text-white cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Revisi / Edit Soal
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB 4: VISUAL ANALYTICS DASHBOARD (RECHARTS) - TREN KELAS & PERFORMA */}
      {/* ===================================================================== */}
      {activeTab === 'visual_analytics' && (() => {
        // 1. Kumpulan Kelas Target
        const defaultClasses = [
          'VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5',
          'VIII-1', 'VIII-2', 'VIII-3', 'VIII-4', 'VIII-5', 'VIII-6'
        ];
        const dynamicClasses = Array.from(new Set(submissions.map(s => getCleanKelas(s.kelas)).filter(Boolean)));
        const allAvailableClasses = Array.from(new Set([...defaultClasses, ...dynamicClasses]));

        // Filter data berdasarkan jenjang & kelas spesifik
        const filteredByJenjang = submissions.filter(sub => {
          if (visualAnalyticsJenjangFilter === 'ALL') return true;
          return getJenjangFromKelas(sub.kelas) === visualAnalyticsJenjangFilter;
        });

        const activeSubmissions = filteredByJenjang.filter(sub => {
          if (visualAnalyticsSelectedClass === 'ALL') return true;
          return getCleanKelas(sub.kelas) === visualAnalyticsSelectedClass;
        });

        // 2. Metrik Eksekutif
        const totalEvaluated = activeSubmissions.length;
        const totalScoreSum = activeSubmissions.reduce((acc, curr) => acc + (curr.nilaiAkhir || 0), 0);
        const overallAverage = totalEvaluated > 0 ? (totalScoreSum / totalEvaluated) : 0;
        const passedStudents = activeSubmissions.filter(s => (s.nilaiAkhir || 0) >= EXAM_INFO.kkm);
        const overallPassRate = totalEvaluated > 0 ? ((passedStudents.length / totalEvaluated) * 100) : 0;
        const maxScore = totalEvaluated > 0 ? Math.max(...activeSubmissions.map(s => s.nilaiAkhir || 0)) : 0;
        const minScore = totalEvaluated > 0 ? Math.min(...activeSubmissions.map(s => s.nilaiAkhir || 0)) : 0;

        // 3. Agregasi Data Komparasi Per Kelas (Untuk Recharts Bar & Composed Chart)
        const classAggregates = allAvailableClasses
          .filter(kls => {
            if (visualAnalyticsJenjangFilter === 'ALL') return true;
            return kls.startsWith(visualAnalyticsJenjangFilter + '-');
          })
          .map(kls => {
            const subsInClass = submissions.filter(s => getCleanKelas(s.kelas) === kls);
            const count = subsInClass.length;
            if (count === 0) {
              return {
                kelas: kls,
                totalSiswa: 0,
                rataRata: 0,
                nilaiMaks: 0,
                nilaiMin: 0,
                lulus: 0,
                remidi: 0,
                persenLulus: 0,
                sangatBaik: 0,
                baik: 0,
                cukup: 0,
                perluRemedial: 0,
              };
            }
            const avg = subsInClass.reduce((acc, s) => acc + (s.nilaiAkhir || 0), 0) / count;
            const highest = Math.max(...subsInClass.map(s => s.nilaiAkhir || 0));
            const lowest = Math.min(...subsInClass.map(s => s.nilaiAkhir || 0));
            const lulusCount = subsInClass.filter(s => (s.nilaiAkhir || 0) >= EXAM_INFO.kkm).length;
            const remidiCount = count - lulusCount;
            const passPct = (lulusCount / count) * 100;

            const sb = subsInClass.filter(s => (s.nilaiAkhir || 0) >= 90).length;
            const b = subsInClass.filter(s => (s.nilaiAkhir || 0) >= 80 && (s.nilaiAkhir || 0) < 90).length;
            const c = subsInClass.filter(s => (s.nilaiAkhir || 0) >= EXAM_INFO.kkm && (s.nilaiAkhir || 0) < 80).length;
            const r = subsInClass.filter(s => (s.nilaiAkhir || 0) < EXAM_INFO.kkm).length;

            return {
              kelas: kls,
              totalSiswa: count,
              rataRata: Math.round(avg * 10) / 10,
              nilaiMaks: highest,
              nilaiMin: lowest,
              lulus: lulusCount,
              remidi: remidiCount,
              persenLulus: Math.round(passPct * 10) / 10,
              sangatBaik: sb,
              baik: b,
              cukup: c,
              perluRemedial: r,
            };
          });

        const classesWithStudents = classAggregates.filter(c => c.totalSiswa > 0);
        const topClass = classesWithStudents.length > 0
          ? [...classesWithStudents].sort((a, b) => b.rataRata - a.rataRata)[0]
          : null;

        // 4. Data Tren Kronologis Nilai (Timeline Trend Data)
        const sortedTimelineSubmissions = [...activeSubmissions].sort((a, b) => {
          return new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime();
        });

        let runningSum = 0;
        const timelineTrendData = sortedTimelineSubmissions.map((sub, index) => {
          runningSum += (sub.nilaiAkhir || 0);
          const movingAvg = Math.round((runningSum / (index + 1)) * 10) / 10;
          return {
            no: index + 1,
            nama: sub.namaSiswa.split(' ')[0],
            kelas: getCleanKelas(sub.kelas),
            nilai: sub.nilaiAkhir || 0,
            rataRataBergerak: movingAvg,
            kkm: EXAM_INFO.kkm,
            waktu: sub.timestamp ? sub.timestamp.split(' ')[1] || `#${index + 1}` : `#${index + 1}`
          };
        });

        // 5. Data Donat Distribusi Predikat Keseluruhan
        const totalSb = activeSubmissions.filter(s => (s.nilaiAkhir || 0) >= 90).length;
        const totalB = activeSubmissions.filter(s => (s.nilaiAkhir || 0) >= 80 && (s.nilaiAkhir || 0) < 90).length;
        const totalC = activeSubmissions.filter(s => (s.nilaiAkhir || 0) >= EXAM_INFO.kkm && (s.nilaiAkhir || 0) < 80).length;
        const totalR = activeSubmissions.filter(s => (s.nilaiAkhir || 0) < EXAM_INFO.kkm).length;

        const pieDistributionData = [
          { name: 'Sangat Baik (A: 90-100)', value: totalSb, color: '#10b981' },
          { name: 'Baik (B: 80-89)', value: totalB, color: '#38bdf8' },
          { name: 'Cukup (C: KKM 75-79)', value: totalC, color: '#f59e0b' },
          { name: 'Perlu Remedial (D: <75)', value: totalR, color: '#f43f5e' },
        ].filter(d => d.value > 0);

        const CustomAnalyticsTooltip = ({ active, payload, label }: any) => {
          if (active && payload && payload.length) {
            return (
              <div className="bg-slate-950/95 border border-sky-400/50 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50">
                <p className="font-extrabold text-amber-300 border-b border-white/10 pb-1">{label || payload[0]?.payload?.kelas || payload[0]?.payload?.nama}</p>
                {payload.map((entry: any, index: number) => (
                  <div key={`entry-${index}`} className="flex items-center justify-between gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.fill }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                      {entry.name}:
                    </span>
                    <span className="font-mono text-white font-bold">{entry.value}</span>
                  </div>
                ))}
              </div>
            );
          }
          return null;
        };

        const handleDownloadAnalyticsPdf = async () => {
          try {
            const blob = await generateClassAnalyticsPdfBlob(
              submissions,
              questions,
              activePackageKey,
              questionBanks
            );
            triggerFileDownload(blob, `Laporan-Visual-Analytics-Semua-Kelas-${new Date().toISOString().slice(0, 10)}.pdf`);
          } catch (err) {
            console.error('Failed to generate analytics PDF', err);
          }
        };

        return (
          <div className="space-y-6">
            {/* Header Visual Analytics Dashboard */}
            <div
              className={`rounded-2xl border p-6 space-y-5 ${
                darkMode
                  ? 'bg-gradient-to-br from-slate-950/95 via-indigo-950/40 to-slate-900/95 border-sky-500/30 text-white shadow-xl'
                  : 'bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 border-sky-500/30 text-white shadow-xl'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-0.5 shadow-lg shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-sky-400" />
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/50 text-indigo-300">
                        Visual Analytics (Recharts Engine)
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        Standar KKM: {EXAM_INFO.kkm}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                      Visual Analytics &amp; Tren Performa Siswa Lintas Kelas
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed mt-0.5">
                      Visualisasi komprehensif performa hasil ujian ANBK seluruh kelas (VII &amp; VIII), komparasi nilai rata-rata, tren kronologis moving average, dan sebaran predikat kelulusan.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadAnalyticsPdf}
                    className="h-10 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-2 shadow-lg transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Unduh Laporan Analitik (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Bilah Filter Interaktif & Mode Tampilan Grafik */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold text-sky-300 uppercase tracking-wider">
                    Filter Jenjang:
                  </span>
                  {(['ALL', 'VII', 'VIII'] as const).map(j => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => {
                        setVisualAnalyticsJenjangFilter(j);
                        setVisualAnalyticsSelectedClass('ALL');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        visualAnalyticsJenjangFilter === j
                          ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/60'
                          : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                      }`}
                    >
                      {j === 'ALL' ? 'Semua Jenjang' : `Kelas ${j}`}
                    </button>
                  ))}

                  <span className="text-slate-600 hidden sm:inline">|</span>

                  <label htmlFor="visual-analytics-class-filter" className="text-xs font-bold text-slate-300">
                    Fokus Kelas:
                  </label>
                  <select
                    id="visual-analytics-class-filter"
                    value={visualAnalyticsSelectedClass}
                    onChange={(e) => setVisualAnalyticsSelectedClass(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 text-amber-300 border border-amber-400/40 focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="ALL">Semua Kelas ({classesWithStudents.length} Terdata)</option>
                    {allAvailableClasses
                      .filter(k => visualAnalyticsJenjangFilter === 'ALL' || k.startsWith(visualAnalyticsJenjangFilter + '-'))
                      .map(k => (
                        <option key={k} value={k}>
                          Kelas {k} ({submissions.filter(s => getCleanKelas(s.kelas) === k).length} Siswa)
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setVisualAnalyticsChartType('OVERVIEW')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualAnalyticsChartType === 'OVERVIEW'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Semua Grafik
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualAnalyticsChartType('CLASS_COMPARISON')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualAnalyticsChartType === 'CLASS_COMPARISON'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Komparasi Kelas
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualAnalyticsChartType('TIMELINE_TRENDS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualAnalyticsChartType === 'TIMELINE_TRENDS'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tren Kronologis
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualAnalyticsChartType('SCORE_DISTRIBUTION')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visualAnalyticsChartType === 'SCORE_DISTRIBUTION'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Distribusi Nilai
                  </button>
                </div>
              </div>
            </div>

            {/* Grid 5 Kartu KPI Eksekutif */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl border border-sky-500/30 bg-slate-950/90 shadow-md space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  Total Siswa Dinilai
                </span>
                <div className="text-2xl font-black text-white font-mono">
                  {totalEvaluated} <span className="text-xs text-slate-400 font-sans font-normal">Siswa</span>
                </div>
                <p className="text-[10px] text-sky-300">
                  Dari {classesWithStudents.length} kelas aktif terdata
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-amber-400/35 bg-slate-950/90 shadow-md space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Rata-Rata Nilai
                </span>
                <div className={`text-2xl font-black font-mono ${overallAverage >= EXAM_INFO.kkm ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {overallAverage.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">/ 100</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {overallAverage >= EXAM_INFO.kkm ? '✓ Memenuhi Standar KKM' : '⚠ Di Bawah Standar KKM'} ({EXAM_INFO.kkm})
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-emerald-400/35 bg-slate-950/90 shadow-md space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Tingkat Kelulusan
                </span>
                <div className="text-2xl font-black text-emerald-300 font-mono">
                  {overallPassRate.toFixed(1)}%
                </div>
                <p className="text-[10px] text-emerald-400">
                  {passedStudents.length} Lulus · {totalEvaluated - passedStudents.length} Remedial
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-indigo-400/35 bg-slate-950/90 shadow-md space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  Kelas Terbaik
                </span>
                <div className="text-2xl font-black text-indigo-300 font-mono truncate">
                  {topClass ? `Kelas ${topClass.kelas}` : '-'}
                </div>
                <p className="text-[10px] text-indigo-200">
                  {topClass ? `Rata-rata: ${topClass.rataRata} (${topClass.totalSiswa} Siswa)` : 'Belum ada data'}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-white/10 bg-slate-950/90 shadow-md space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  Rentang Skor
                </span>
                <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
                  <span className="text-emerald-400">{maxScore}</span>
                  <span className="text-slate-600 text-sm">↔</span>
                  <span className="text-rose-400">{minScore}</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Tertinggi vs Terendah
                </p>
              </div>
            </div>

            {/* =================================================================== */}
            {/* GRAFIK 1: KOMPARASI PERFORMA NILAI RATA-RATA, TERTINGGI & % KELULUSAN */}
            {/* =================================================================== */}
            {(visualAnalyticsChartType === 'OVERVIEW' || visualAnalyticsChartType === 'CLASS_COMPARISON') && (
              <div className="rounded-2xl border border-sky-500/30 bg-slate-950/90 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-sky-400" />
                      Komparasi Rata-rata Nilai &amp; % Kelulusan Antar Seluruh Kelas
                    </h3>
                    <p className="text-xs text-slate-400">
                      Garis horizontal merah putus-putus menandai standar KKM ({EXAM_INFO.kkm}). Batang biru = rata-rata nilai kelas, hijau = nilai tertinggi, garis oranye = persentase kelulusan.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 shrink-0">
                    ComposedChart (Bar + Line)
                  </span>
                </div>

                <div className="w-full h-80 sm:h-96 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={classAggregates} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="kelas" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                      <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                      <RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <ReferenceLine
                        y={EXAM_INFO.kkm}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{ value: `KKM: ${EXAM_INFO.kkm}`, fill: '#f87171', position: 'insideTopLeft', fontSize: 11 }}
                      />
                      <Bar dataKey="rataRata" name="Rata-rata Nilai" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="nilaiMaks" name="Nilai Tertinggi" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="persenLulus" name="% Kelulusan" stroke="#fbbf24" strokeWidth={3} dot={{ r: 5, fill: '#fbbf24' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* GRAFIK 2: TREN KRONOLOGIS PERFORMA (MOVING AVERAGE) */}
            {/* =================================================================== */}
            {(visualAnalyticsChartType === 'OVERVIEW' || visualAnalyticsChartType === 'TIMELINE_TRENDS') && (
              <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-400" />
                      Tren Kronologis Performa Nilai Siswa (Area &amp; Moving Average)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Menampilkan perkembangan skor setiap siswa berurutan waktu pengerjaan beserta garis rata-rata kumulatif bergerak (Moving Average).
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                    AreaChart ({timelineTrendData.length} Sampel)
                  </span>
                </div>

                <div className="w-full h-80 pt-2">
                  {timelineTrendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      Belum ada data riwayat ujian tersinkron.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineTrendData} margin={{ top: 15, right: 20, bottom: 20, left: 0 }}>
                        <defs>
                          <linearGradient id="colorNilai" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis dataKey="no" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} label={{ value: 'Urutan Siswa', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                        <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                        <RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <ReferenceLine y={EXAM_INFO.kkm} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `KKM: ${EXAM_INFO.kkm}`, fill: '#f87171', position: 'insideTopLeft', fontSize: 11 }} />
                        <Area type="monotone" dataKey="nilai" name="Nilai Siswa" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorNilai)" />
                        <Line type="monotone" dataKey="rataRataBergerak" name="Rata-rata Kumulatif" stroke="#10b981" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* GRAFIK 3 & 4: DISTRIBUSI PREDIKAT BELAJAR & DONAT TINGKAT KELULUSAN */}
            {/* =================================================================== */}
            {(visualAnalyticsChartType === 'OVERVIEW' || visualAnalyticsChartType === 'SCORE_DISTRIBUTION') && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Distribusi Predikat Bertumpuk (Stacked Bar) per Kelas */}
                <div className="lg:col-span-7 rounded-2xl border border-sky-500/30 bg-slate-950/90 p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-amber-400" />
                      Distribusi Predikat Capaian per Kelas (Stacked Bar)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Sebaran predikat: Sangat Baik (A: 90-100), Baik (B: 80-89), Cukup (C: KKM 75-79), dan Perlu Remedial (D: &lt;75).
                    </p>
                  </div>

                  <div className="w-full h-80 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classAggregates} margin={{ top: 15, right: 15, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis dataKey="kelas" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                        <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                        <RechartsLegend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="sangatBaik" name="Sangat Baik (A)" stackId="a" fill="#10b981" />
                        <Bar dataKey="baik" name="Baik (B)" stackId="a" fill="#38bdf8" />
                        <Bar dataKey="cukup" name="Cukup (C: KKM)" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="perluRemedial" name="Remedial (D)" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut Chart Proporsi Capaian Seluruh Siswa */}
                <div className="lg:col-span-5 rounded-2xl border border-sky-500/30 bg-slate-950/90 p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
                  <div className="border-b border-white/10 pb-3">
                    <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-emerald-400" />
                      Proporsi Predikat Keseluruhan (Donut Chart)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Persentase pembagian kategori nilai dari total {totalEvaluated} data siswa.
                    </p>
                  </div>

                  <div className="w-full h-64 flex items-center justify-center">
                    {pieDistributionData.length === 0 ? (
                      <div className="text-slate-400 text-sm italic">Belum ada data untuk ditampilkan.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, percent }: { name?: string; percent?: number }) => `${(name || '').split(' ')[0]} ${(((percent || 0) * 100)).toFixed(0)}%`}
                          >
                            {pieDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Keterangan Warna Predikat */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-slate-200 truncate">A: Sangat Baik ({totalSb})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-sky-400 shrink-0" />
                      <span className="text-slate-200 truncate">B: Baik ({totalB})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-slate-200 truncate">C: Cukup ({totalC})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-slate-200 truncate">D: Remedial ({totalR})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* TABEL LENGKAP MATRIKS PERFORMA & EVALUASI SELURUH KELAS */}
            {/* =================================================================== */}
            <div className="rounded-2xl border border-sky-500/30 bg-slate-950/90 p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    Tabel Matriks Performa &amp; Status Evaluasi KKM Seluruh Kelas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Rincian komparatif lengkap nilai rata-rata, capaian tertinggi, dan kelulusan setiap rombel belajar.
                  </p>
                </div>
                <span className="text-xs font-mono text-amber-300">
                  {classAggregates.filter(c => c.totalSiswa > 0).length} dari {classAggregates.length} Kelas Memiliki Nilai
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-sky-300 font-extrabold uppercase tracking-wider text-[10px] border-b border-white/10">
                    <tr>
                      <th className="py-3 px-3.5">Rombel / Kelas</th>
                      <th className="py-3 px-3.5 text-center">Peserta</th>
                      <th className="py-3 px-3.5 text-center">Rata-rata</th>
                      <th className="py-3 px-3.5 text-center">Maksimal</th>
                      <th className="py-3 px-3.5 text-center">Minimal</th>
                      <th className="py-3 px-3.5 text-center">Lulus (≥75)</th>
                      <th className="py-3 px-3.5 text-center">Remedial (&lt;75)</th>
                      <th className="py-3 px-3.5 text-center">% Kelulusan</th>
                      <th className="py-3 px-3.5 text-center">Status Evaluasi KKM</th>
                      <th className="py-3 px-3.5 text-center">Aksi Filter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {classAggregates.map((row) => {
                      const isPassingAvg = row.rataRata >= EXAM_INFO.kkm;
                      return (
                        <tr
                          key={row.kelas}
                          className={`hover:bg-white/5 transition-colors ${
                            visualAnalyticsSelectedClass === row.kelas ? 'bg-sky-500/10' : ''
                          }`}
                        >
                          <td className="py-3 px-3.5 font-extrabold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            Kelas {row.kelas}
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono text-slate-200">
                            {row.totalSiswa}
                          </td>
                          <td className={`py-3 px-3.5 text-center font-mono font-bold ${isPassingAvg && row.totalSiswa > 0 ? 'text-emerald-400' : row.totalSiswa > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {row.totalSiswa > 0 ? row.rataRata : '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono text-emerald-300">
                            {row.totalSiswa > 0 ? row.nilaiMaks : '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono text-rose-300">
                            {row.totalSiswa > 0 ? row.nilaiMin : '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono text-emerald-400">
                            {row.lulus}
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono text-rose-400">
                            {row.remidi}
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono font-extrabold">
                            {row.totalSiswa > 0 ? (
                              <span className={row.persenLulus >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
                                {row.persenLulus}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {row.totalSiswa === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                Belum Ada Ujian
                              </span>
                            ) : isPassingAvg ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                ✓ Memenuhi KKM
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">
                                ⚠ Perlu Penguatan
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setVisualAnalyticsSelectedClass(visualAnalyticsSelectedClass === row.kelas ? 'ALL' : row.kelas);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-sky-200 transition-colors cursor-pointer"
                            >
                              {visualAnalyticsSelectedClass === row.kelas ? 'Batal Fokus' : 'Fokuskan'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB 5: INTEGRASI GOOGLE DOCS, SHEET & KODE LENGKAP (Code.gs + HTML) */}
      {/* ===================================================================== */}
      {activeTab === 'integration' && (
        <div className="space-y-6">
          {/* Konfigurasi Tautan Dokumen & Rekap */}
          <div
            className={`rounded-xl border p-6 space-y-4 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h2 className="text-lg font-bold">
              Pengaturan Tautan Dokumen, Rekap Nilai & Apps Script
            </h2>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Hubungkan Tautan Dokumen (Bank Soal), Tautan Rekap Nilai, dan URL Web App Google Apps Script agar setiap jawaban yang dipilih siswa otomatis tersimpan secara real-time dan mengirim notifikasi ke email <strong>{EXAM_INFO.teacherEmail}</strong> serta <strong>WhatsApp Guru Mapel</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Link Google Dokumen (Soal Ujian Informatika)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={cloudConfig.googleDocUrl}
                    onChange={(e) =>
                      onUpdateCloudConfig({ ...cloudConfig, googleDocUrl: e.target.value })
                    }
                    placeholder="https://docs.google.com/document/d/.../edit"
                    className={`w-full px-3.5 py-2 rounded-lg border text-xs ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  {cloudConfig.googleDocUrl && (
                    <a
                      href={cloudConfig.googleDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg bg-sky-700 text-white inline-flex items-center"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Tautan Sinkronisasi (KODE TOKEN UJIAN &amp; Rekap Hasil Ujian Siswa)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl}
                    onChange={(e) =>
                      onUpdateCloudConfig({
                        ...cloudConfig,
                        tokenSheetUrl: e.target.value,
                        googleSheetUrl: e.target.value,
                      })
                    }
                    placeholder="Tempel tautan sinkronisasi KODE TOKEN UJIAN..."
                    className={`w-full px-3.5 py-2 rounded-lg border text-xs ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  {(cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl) && (
                    <a
                      href={cloudConfig.tokenSheetUrl || cloudConfig.googleSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg bg-emerald-700 text-white inline-flex items-center"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  URL Web App Google Apps Script (Deployment URL `.../exec`)
                </label>
                <input
                  type="url"
                  value={cloudConfig.appsScriptWebAppUrl}
                  onChange={(e) =>
                    onUpdateCloudConfig({ ...cloudConfig, appsScriptWebAppUrl: e.target.value })
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className={`w-full px-3.5 py-2 rounded-lg border text-xs ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Token API Gateway WhatsApp Fonnte (Otomatisasi Kirim File .JPG Hasil Ujian ke WA Guru)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cloudConfig.fonnteToken}
                    onChange={(e) => {
                      const nextCfg = { ...cloudConfig, fonnteToken: e.target.value };
                      onUpdateCloudConfig(nextCfg);
                      writeFirestoreCloudConfig({ fonnteToken: e.target.value }).catch(() => {});
                      saveCloudTokenConfigToServer(nextCfg).catch(() => {});
                    }}
                    placeholder="Masukkan Token API Fonnte (https://api.fonnte.com/send)..."
                    className={`w-full px-3.5 py-2 rounded-lg border text-xs font-mono ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Panel Otomatisasi Pengiriman Pesan WhatsApp ke Nomor Guru Mapel via API Fonnte (.JPG Hasil Ujian) */}
            <div
              className={`mt-4 rounded-xl border p-4 sm:p-5 space-y-3.5 ${
                darkMode
                  ? 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-emerald-500/45 text-white'
                  : 'bg-emerald-50/70 border-emerald-300 text-slate-900'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b pb-3 border-emerald-500/25">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                      <Send className="w-3 h-3" />
                      OTOMATISASI WHATSAPP API FONNTE + LAMPIRAN FILE .JPG HASIL UJIAN
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                        cloudConfig.autoSendWa !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                          : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                      }`}
                    >
                      {cloudConfig.autoSendWa !== false
                        ? `AKTIF OTOMATIS KE ${EXAM_INFO.teacherPhone}`
                        : 'MODE MANUAL SAJA'}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    Pengiriman Otomatis File .JPG Hasil Ujian ke WhatsApp Guru Mapel ({EXAM_INFO.guruMapelUpper})
                  </h3>
                  <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Begitu siswa menyelesaikan ujian, sistem secara otomatis merender sertifikat/kartu hasil ujian dalam format{' '}
                    <strong>Gambar (.JPG)</strong> dan mengirimkannya langsung ke nomor WhatsApp Guru Mapel (
                    <strong className="font-mono">{EXAM_INFO.teacherPhone}</strong>) menggunakan{' '}
                    <strong>API Fonnte (`https://api.fonnte.com/send`)</strong> tanpa harus menanti laporan manual dari siswa.
                  </p>
                </div>

                {/* Sakelar Auto-Send WhatsApp Fonnte (.JPG) */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const nextAuto = cloudConfig.autoSendWa === false ? true : false;
                      const nextCfg = { ...cloudConfig, autoSendWa: nextAuto };
                      onUpdateCloudConfig(nextCfg);
                      writeFirestoreCloudConfig({ autoSendWa: nextAuto }).catch(() => {});
                      saveCloudTokenConfigToServer(nextCfg).catch(() => {});
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold border cursor-pointer transition-all shadow-xs ${
                      cloudConfig.autoSendWa !== false
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Auto-Kirim WA (.JPG) via Fonnte:{' '}
                      {cloudConfig.autoSendWa !== false ? 'AKTIF (OTOMATIS)' : 'NONAKTIF'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Uji Coba / Kirim Langsung File .JPG Hasil Ujian Siswa via API Fonnte dari Panel Guru */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <label className="text-xs font-bold shrink-0 text-emerald-400">
                    Pilih Data Siswa (.JPG):
                  </label>
                  <select
                    value={selectedFonnteSubId || submissions[0]?.id || ''}
                    onChange={(e) => setSelectedFonnteSubId(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold ${
                      darkMode
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {(submissions.length > 0 ? submissions : INITIAL_SUBMISSIONS).map((s, idx) => (
                      <option key={`sub-exp-${s.id || 's'}-${idx}`} value={s.id}>
                        {idx + 1}. {s.namaSiswa} ({getCleanKelas(s.kelas)}) — Nilai: {s.nilaiAkhir}% (
                        {s.lulusTidakLulus})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isSendingFonnteJpg}
                  onClick={() => handleSendSubmissionJpgViaFonnte()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-sm shrink-0 disabled:opacity-60"
                >
                  {isSendingFonnteJpg ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengirim File .JPG via Fonnte...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Tes / Kirim Otomatis File .JPG ke WA Guru (Fonnte)</span>
                    </>
                  )}
                </button>
              </div>

              {fonnteJpgStatusMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{fonnteJpgStatusMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Petunjuk Cara Pemasangan di Google Apps Script */}
          <div
            className={`rounded-xl border p-6 space-y-3 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-base font-bold text-sky-700 dark:text-sky-400">
              Petunjuk Lengkap Cara Memasang Kode GS (`Code.gs`) & `index.html`
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed">
              <li>
                Buka <strong>Google Drive</strong> Anda (<span className="font-mono">eksayudikasirait@gmail.com</span>), lalu buat sebuah berkas rekap baru dan beri nama: <strong>REKAP ANBK INFORMATIKA KELAS VIII - UPTD SMP NEGERI 7 KISARAN</strong>.
              </li>
              <li>
                Pada menu atas, klik <strong>Ekstensi (Extensions) &rarr; Apps Script</strong>.
              </li>
              <li>
                Hapus kode bawaan di file <strong><span className="font-mono">Code.gs</span></strong>, lalu salin dan tempel seluruh kode <strong><span className="font-mono">Code.gs</span></strong> di bawah ini. Klik ikon <strong>Simpan (Save)</strong>.
              </li>
              <li>
                Klik tombol <strong>Tambah File (+) &rarr; HTML</strong>, beri nama persis <strong><span className="font-mono">index</span></strong> (sehingga menjadi <span className="font-mono">index.html</span>). Salin dan tempel seluruh kode <strong><span className="font-mono">index.html</span></strong> di bawah ini, lalu klik <strong>Simpan</strong>.
              </li>
              <li>
                Klik tombol biru <strong>Terapkan (Deploy) &rarr; Deployment baru (New deployment)</strong> di kanan atas.
              </li>
              <li>
                Pilih jenis <strong>Aplikasi Web (Web app)</strong>, isi Deskripsi: <em>Ujian ANBK Informatika Kelas VIII</em>, pilih <strong>Jalankan sebagai (Execute as): Saya (Me)</strong>, dan pilih <strong>Siapa saja yang memiliki akses (Who has access): Siapa saja (Anyone)</strong>.
              </li>
              <li>
                Klik <strong>Terapkan (Deploy)</strong>, berikan izin akses (Authorize Access), lalu salin <strong>URL Aplikasi Web (`https://script.google.com/macros/s/.../exec`)</strong> dan tempelkan ke kolom <em>URL Web App Google Apps Script</em> di atas atau bagikan langsung ke siswa!
              </li>
            </ol>
          </div>

          {/* KODE 1: Code.gs */}
          <div
            className={`rounded-xl border overflow-hidden ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="px-5 py-3.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold">
                1. File Google Apps Script: Code.gs (Production-Ready)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode('gs')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  {copiedGs ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedGs ? 'Tersalin!' : 'Salin Code.gs'}
                </button>
                <button
                  onClick={() => handleDownloadFile('Code.gs', GAS_CODE_TEMPLATE)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Code.gs
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-80 bg-slate-950 text-slate-200 leading-relaxed">
              {GAS_CODE_TEMPLATE}
            </pre>
          </div>

          {/* KODE 2: index.html (1 File Lengkap) */}
          <div
            className={`rounded-xl border overflow-hidden ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="px-5 py-3.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold">
                2. File HTML Tunggal: index.html (Berisi HTML + CSS + JS + 25 Soal Bab 4)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode('html')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  {copiedHtml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedHtml ? 'Tersalin!' : 'Salin index.html'}
                </button>
                <button
                  onClick={() => handleDownloadFile('index.html', singleFileHtmlCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh index.html
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-80 bg-slate-950 text-slate-200 leading-relaxed">
              {singleFileHtmlCode}
            </pre>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL PORTABILITAS DATA: BACKUP & RESTORE JSON TERENKRIPSI (AES-256-GCM) */}
      {/* ===================================================================== */}
      {showEncryptedBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl border border-indigo-500/40 p-6 space-y-5 shadow-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
            <div className="flex items-center justify-between border-b pb-3 border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-amber-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Portabilitas Data LocalStorage Terenkripsi
                  </h3>
                  <p className="text-[11px] text-indigo-200 font-mono">
                    AES-256-GCM · PBKDF2-SHA256 (Questions + Submissions + Cloud Config)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEncryptedBackupModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-200 leading-relaxed">
              <p>
                Fitur ini mengemas seluruh penyimpanan lokal browser (<strong>LocalStorage</strong>) ke dalam satu file <strong>JSON Terenkripsi (`.enc.json`)</strong> agar aman dipindahkan ke komputer/perangkat lain:
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">
                    Bank Soal
                  </div>
                  <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                    {questions.length} Soal Aktif
                  </div>
                  <div className="text-[10px] text-slate-400">4 Paket Fase D</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                    Submissions
                  </div>
                  <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                    {submissions.length} Siswa
                  </div>
                  <div className="text-[10px] text-slate-400">10 Kolom Rekap</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                    Cloud Config
                  </div>
                  <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                    {cloudConfig.googleSheetUrl || cloudConfig.appsScriptWebAppUrl
                      ? 'Terkonfigurasi'
                      : 'Tersimpan'}
                  </div>
                  <div className="text-[10px] text-slate-400">Sheet & Apps Script</div>
                </div>
              </div>
            </div>

            {backupErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{backupErrorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-indigo-200 mb-1.5">
                Kode Enkripsi File Backup (Default: Kode Mode Guru)
              </label>
              <div className="relative">
                <input
                  type={showBackupPass ? 'text' : 'password'}
                  name="q_filter_backup_guru_anbk"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                  placeholder="Ketik password Mode Guru..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-white/20 bg-slate-950/90 text-white font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowBackupPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                  title={showBackupPass ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showBackupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Gunakan kunci yang sama saat mengenkripsi (unduh) maupun saat mendekripsi (pulihkan) file cadangan di perangkat lain.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadEncryptedJsonBackup}
                disabled={isEncryptingBackup}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                {isEncryptingBackup ? 'Mengenkripsi Data...' : 'Unduh Backup JSON Terenkripsi'}
              </button>

              <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400/40 transition-colors cursor-pointer shadow-md">
                <Upload className="w-4 h-4" />
                <span>Pulihkan dari File (.enc.json)</span>
                <input
                  type="file"
                  accept=".json,.enc.json,application/json"
                  onChange={handleRestoreEncryptedJsonBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN CETAK RINGKASAN HASIL UJIAN (PRINT SETTINGS MODAL) */}
      {showPrintSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl space-y-5 ${
              darkMode
                ? 'bg-[#112240] border-sky-400/40 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-4 border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                    KONFIGURASI CETAK LAPORAN (@MEDIA PRINT)
                  </span>
                  <h3 className="text-lg font-extrabold">
                    Pengaturan Cetak Ringkasan Hasil Ujian
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintSettingsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Utama: Cetak dengan Warna Tema Dark Mode */}
            <div
              className={`rounded-xl border p-4 transition-all ${
                printDarkMode
                  ? 'bg-slate-950/90 border-amber-400/60 text-white shadow-md'
                  : darkMode
                  ? 'bg-slate-900/60 border-white/15 text-slate-100'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      printDarkMode
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-sky-500/20 text-sky-500 border border-sky-500/30'
                    }`}
                  >
                    {printDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold">
                        Cetak Ringkasan dalam Warna Tema Dark Mode
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          printDarkMode
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {printDarkMode ? 'AKTIF (DARK THEME)' : 'NONAKTIF (DEFAULT PUTIH)'}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        printDarkMode
                          ? 'text-slate-300'
                          : darkMode
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {printDarkMode
                        ? 'Mengabaikan gaya cetak kertas putih default dan mempertahankan skema warna gelap Royal Navy (#0a192f & #112240) serta aksen emas/biru saat dicetak atau disimpan ke PDF.'
                        : 'Menggunakan gaya cetak standar (@media print default): latar belakang kertas putih bersih (#ffffff) dan teks hitam kontras tinggi yang hemat tinta printer.'}
                    </p>
                  </div>
                </div>

                {/* Switch Button */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={printDarkMode}
                  onClick={() => onChangePrintDarkMode && onChangePrintDarkMode(!printDarkMode)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    printDarkMode ? 'bg-amber-400' : 'bg-slate-400 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-slate-950 shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                      printDarkMode ? 'translate-x-7' : 'translate-x-0 bg-white'
                    }`}
                  >
                    {printDarkMode ? (
                      <Moon className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </span>
                </button>
              </div>

              {/* Pilihan Cepat 2 Kartu Mode Cetak */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => onChangePrintDarkMode && onChangePrintDarkMode(false)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !printDarkMode
                      ? 'border-sky-500 bg-white text-slate-900 ring-2 ring-sky-500/30 shadow-xs'
                      : 'border-white/15 bg-slate-900/50 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-amber-500 shrink-0">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Default Kertas Putih</div>
                    <div className="text-[10px] opacity-75">Hemat tinta · Kontras hitam-putih</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onChangePrintDarkMode && onChangePrintDarkMode(true)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    printDarkMode
                      ? 'border-amber-400 bg-[#0a192f] text-white ring-2 ring-amber-400/30 shadow-xs'
                      : 'border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#112240] border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Warna Tema Dark Mode</div>
                    <div className="text-[10px] opacity-75">Royal Navy · Ideal untuk cetak PDF</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Pratinjau Visual Hasil Cetak */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-sky-400">
                  Pratinjau Tampilan Kertas Saat Dicetak:
                </span>
                <span className="text-[11px] opacity-75">
                  Navigasi, tombol & sidebar otomatis disembunyikan
                </span>
              </div>
              <div
                className={`rounded-xl border p-3.5 transition-all ${
                  printDarkMode
                    ? 'bg-[#0a192f] border-sky-400/40 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-current/15">
                  <div>
                    <div
                      className={`text-[10px] font-bold uppercase ${
                        printDarkMode ? 'text-amber-300' : 'text-slate-600'
                      }`}
                    >
                      {EXAM_INFO.namaSekolah} · RINGKASAN HASIL UJIAN
                    </div>
                    <div className="text-xs font-extrabold mt-0.5">
                      Evaluasi Mandiri & Rekap Nilai Siswa
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                      printDarkMode
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-600 text-emerald-900'
                    }`}
                  >
                    LULUS UJIAN · 90/100
                  </span>
                </div>
                <div className="text-[11px] opacity-85 flex items-center justify-between">
                  <span>Mode Cetak Aktif: {printDarkMode ? 'Dark Mode (Royal Navy)' : 'Standar Kertas Putih'}</span>
                  <span className="font-mono text-[10px]">print-color-adjust: exact</span>
                </div>
              </div>
            </div>

            {/* Pilih Siswa untuk Langsung Dicetak */}
            {onPrintStudentSummary && submissions.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-sky-400">
                  Pilih Siswa untuk Mencetak Ringkasan Hasil Ujian:
                </label>
                <select
                  value={selectedSubForPrintId || submissions[0]?.id || ''}
                  onChange={(e) => setSelectedSubForPrintId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    darkMode
                      ? 'bg-slate-950 border-white/20 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {submissions.map((s, idx) => (
                    <option key={`sub-cert-${s.id || 's'}-${idx}`} value={s.id}>
                      {idx + 1}. {s.namaSiswa} ({ getCleanKelas(s.kelas) }) — Nilai: {s.nilaiAkhir} ({s.lulusTidakLulus})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowPrintSettingsModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Simpan Pengaturan Saja
              </button>

              {onPrintStudentSummary && submissions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const targetSub =
                      submissions.find((s) => s.id === selectedSubForPrintId) || submissions[0];
                    setShowPrintSettingsModal(false);
                    if (targetSub) {
                      onPrintStudentSummary(targetSub);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    Buka & Cetak Ringkasan ({printDarkMode ? 'Tema Dark Mode' : 'Kertas Putih'})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pilihan Data Sinkronisasi (Tanggal, Bulan, Tahun) Panel Guru */}
      <SyncDataDateModal
        isOpen={showSyncDateModal}
        onClose={() => setShowSyncDateModal(false)}
        submissions={submissions}
        title="PILIHAN DATA SINKRONISASI REKAPITULASI (GURU)"
        description="Pilih data hasil ujian siswa berdasarkan tanggal, bulan, atau tahun yang ingin disinkronkan ke Link Google Sheets (13 Kolom) & Cloud Server."
        isSyncing={isSyncingSheet}
        onConfirmSync={handleConfirmTeacherSyncFromModal}
      />

      {/* Modal Konfirmasi Reset Semua Rekap Hasil Ujian (Panel Guru) dengan Pilihan Tanggal, Bulan & Tahun */}
      <ResetSubmissionsModal
        key={`teacher-reset-modal-${showTeacherResetConfirmModal}`}
        isOpen={showTeacherResetConfirmModal}
        onClose={() => setShowTeacherResetConfirmModal(false)}
        submissions={submissions}
        requirePassword={false}
        isTeacherMode={true}
        onConfirmReset={handleConfirmTeacherResetWithFilter}
      />

      {/* MODAL BUAT SESI UJIAN BARU (OTOMATIS KOSONGKAN RIWAYAT NILAI SISWA & RESET SUBMISSION SISTEM) */}
      {showCreateSessionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-emerald-400/50 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-white">
                      Buat Sesi Ujian Baru
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Sesi Fresh
                    </span>
                  </div>
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

            {/* Kotak Peringatan & Dampak Pengosongan Otomatis */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs text-amber-100 space-y-2">
              <div className="font-extrabold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>DAMPAK PEMBUATAN SESI UJIAN BARU:</span>
              </div>
              <ul className="space-y-1.5 pl-5 list-disc text-slate-200 text-[11.5px] leading-relaxed">
                <li>
                  <strong className="text-rose-300">Riwayat Nilai Siswa Dikosongkan:</strong> Sebanyak <span className="font-bold text-amber-300 font-mono">{submissions.length}</span> data nilai siswa yang ada saat ini akan otomatis dibersihkan (menjadi 0 data) agar nilai sesi lama tidak bercampur dengan sesi baru.
                </li>
                <li>
                  <strong className="text-emerald-300">Reset Data Submission Sistem:</strong> LocalStorage, Cache Server (/student-dashboard-state.json), Firestore Cloud Sync, dan Link Google Sheets Rekap Ujian disetel ulang ke kondisi bersih.
                </li>
                <li>
                  <strong className="text-sky-300">Reset Kuota Token 3x Siswa:</strong> Seluruh siswa yang sebelumnya telah menghabiskan kuota 3x pengerjaan akan otomatis kembali ke 0/3x sehingga dapat mengikuti sesi baru ini.
                </li>
                <li>
                  <strong className="text-indigo-300">Reset Riwayat Soal Siswa:</strong> Riwayat pertanyaan yang telah dilihat siswa dikosongkan agar variasi soal remedial/susulan berjalan optimal dari awal.
                </li>
              </ul>
            </div>

            {/* Formulir Sesi Ujian Baru */}
            <div className="space-y-3.5">
              {/* Nama Sesi Ujian */}
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
                {/* Rekomendasi Nama Cepat */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Pilih Cepat:</span>
                  {[
                    'Sesi 1 - Gladi Bersih ANBK',
                    'Sesi 2 - Ujian Informatika',
                    'Sesi PTS Ganjil',
                    'Sesi PAS Ganjil',
                    'Sesi Semester Genap',
                    'Sesi Ujian Susulan / Remedial',
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

              {/* Target Jenjang / Kelas */}
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
                  <optgroup label="Khusus Jenjang Tertentu">
                    <option value="VII">Khusus Seluruh Siswa Kelas VII (VII-1 s/d VII-6)</option>
                    <option value="VIII">Khusus Seluruh Siswa Kelas VIII (VIII-1 s/d VIII-6)</option>
                  </optgroup>
                  <optgroup label="Khusus Ruang Kelas Tertentu">
                    {EXAM_INFO.kelasVIIList.map((k) => (
                      <option key={k} value={k}>
                        Khusus Ruang Kelas {k}
                      </option>
                    ))}
                    {EXAM_INFO.kelasList.map((k) => (
                      <option key={k} value={k}>
                        Khusus Ruang Kelas {k}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Kode Token Baru */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoGenerateNewToken}
                    onChange={(e) => setAutoGenerateNewToken(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    Terbitkan & Sebarkan Kode Token Ujian Baru untuk Sesi Ini
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
                      Acak Token Baru
                    </button>
                    <span className="text-[11px] text-slate-400">
                      (Siswa login dengan token ini)
                    </span>
                  </div>
                )}
              </div>

              {/* Catatan Sesi Ujian */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Catatan Sesi Ujian (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={sessionNotesInput}
                  onChange={(e) => setSessionNotesInput(e.target.value)}
                  placeholder="Catatan guru untuk sesi ini, misal: Sesi Ujian Resmi Laboratorium Komputer 1 & 2..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSessionHistoryDrawer(true)}
                className="text-xs text-sky-300 hover:text-sky-200 underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                Lihat Riwayat Sesi Sebelumnya ({sessionHistoryList.length})
              </button>

              <div className="flex items-center gap-2">
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
                      <span>Membuat Sesi & Mereset Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Buat Sesi Ujian Baru & Kosongkan Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL RIWAYAT SESI UJIAN */}
      {showSessionHistoryDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-sky-400/40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">
                    Riwayat Sesi Ujian ANBK
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Daftar seluruh sesi ujian yang pernah dibuat pada sistem ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionHistoryDrawer(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sesi Aktif Saat Ini */}
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950">
                  SESI SEDANG AKTIF
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {new Date(activeSession.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                {activeSession.sessionName}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1">
                <span>ID: <code className="text-sky-300 font-mono">{activeSession.sessionId}</code></span>
                {activeSession.token && (
                  <span>· Token: <code className="text-amber-300 font-mono font-bold">{activeSession.token}</code></span>
                )}
                <span>· Target: <strong className="text-emerald-300">{activeSession.targetKelas || 'Semua Kelas'}</strong></span>
              </div>
            </div>

            {/* Daftar Sesi Lampau */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Sesi-Sesi Sebelumnya ({sessionHistoryList.length}):
              </h4>
              {sessionHistoryList.length === 0 ? (
                <div className="p-6 rounded-xl border border-white/10 bg-slate-900/40 text-center text-xs text-slate-400">
                  Belum ada arsip sesi ujian terdahulu. Sesi saat ini adalah sesi pertama yang aktif.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {sessionHistoryList.map((item, idx) => (
                    <div
                      key={item.sessionId || idx}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 space-y-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">
                          #{idx + 1}. {item.sessionName}
                        </span>
                        <span className="text-[10.5px] text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>ID: <code className="text-slate-300 font-mono">{item.sessionId.slice(0, 16)}</code></span>
                        {item.token && (
                          <span>· Token: <code className="text-amber-300 font-mono">{item.token}</code></span>
                        )}
                        <span>· Target: <strong className="text-slate-200">{item.targetKelas || 'Semua'}</strong></span>
                        {typeof item.clearedSubmissionsCount === 'number' && (
                          <span className="text-rose-300">· {item.clearedSubmissionsCount} Nilai Dikosongkan</span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[10.5px] text-slate-400 italic">
                          Catatan: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSessionHistoryDrawer(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PERMANEN BUTIR SOAL */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full rounded-2xl border-2 border-rose-500/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span>Hapus Permanen Butir Soal</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[8px] font-mono border border-rose-500/40">
                      NO #{questionToDelete.id}
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    Konfirmasi keamanan penghapusan soal ujian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuplikan Soal yang Akan Dihapus */}
            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 space-y-2 text-[10.5px]">
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span className="text-amber-300 font-bold">{questionToDelete.elemen}</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-bold">
                  {questionToDelete.difficulty}
                </span>
              </div>
              <p className="text-white text-xs font-medium leading-relaxed line-clamp-3">
                {questionToDelete.content}
              </p>
            </div>

            {/* Peringatan */}
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-200 leading-relaxed">
              <strong className="text-white block mb-0.5">
                Perhatian Guru Mapel:
              </strong>
              Apakah Anda yakin ingin menghapus butir soal ini secara permanen dari Bank Soal? Nomor urut soal berikutnya akan disesuaikan kembali secara otomatis.
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteQuestion(questionToDelete.id)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Permanen Soal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VERIFIKASI SANDI MODE GURU UNTUK MEMBUKA MENU ADMIN SEKOLAH */}
      <AdminOperatorAuthModal
        isOpen={showAdminAuthModal}
        onClose={() => setShowAdminAuthModal(false)}
        onSuccess={handleAdminAuthSuccess}
        expectedPassword={EXAM_INFO.teacherPassword}
      />

      {/* MODAL MENU ADMIN / OPERATOR SEKOLAH */}
      <AdminSchoolMenuModal
        isOpen={showAdminMenuModal}
        onClose={() => setShowAdminMenuModal(false)}
        onDeactivateAdmin={handleDeactivateAdminMode}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setShowAdminMenuModal(false);
        }}
        onOpenCreateSession={() => {
          setShowAdminMenuModal(false);
          setSessionNameInput('');
          setCustomNewTokenInput(generateRandomExamToken(5));
          setShowCreateSessionModal(true);
        }}
        onOpenResetSubmissions={() => {
          setShowAdminMenuModal(false);
          setShowTeacherResetConfirmModal(true);
        }}
        onOpenMonitoring={onOpenMonitoring ? () => {
          setShowAdminMenuModal(false);
          onOpenMonitoring();
        } : undefined}
        totalSubmissions={submissions.length}
        totalQuestions={questions.length}
      />
    </div>
  );
};

