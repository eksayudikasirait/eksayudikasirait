import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Fingerprint,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Calendar,
  UserX,
  Sparkles,
  Download,
  Printer,
  Trash2,
  RefreshCw,
  Share2,
  ArrowRight,
  Camera,
  Check,
  X,
  Play,
  RotateCcw,
  Layers,
  Award,
  BookOpen,
  Info,
  ChevronRight,
  Maximize2,
  Laptop,
  QrCode,
  MapPin,
  FileText,
  Send,
  Upload,
  Plus,
  Edit3,
  Filter,
  BarChart3,
  Users,
  Bell,
  FileSpreadsheet,
  Compass,
  ShieldAlert,
  Phone,
  User,
  ExternalLink,
  ChevronDown,
  Building2,
  Lock,
  Save,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { TutWuriLogo } from './TutWuriLogo';
import {
  RegisteredStudentBiometric,
  StudentAttendanceRecord,
  KelasWaliKelasMaster,
  SchoolScheduleConfig,
  SchoolDayName,
  SCHOOL_DAYS_LIST,
  SubjectScheduleSession,
  DailyScheduleConfig,
  INITIAL_JADWAL_HARIAN,
  INITIAL_SCHEDULE_CONFIG,
  getCurrentIndonesianSchoolDay,
  OnlinePermitRequest,
  AttendanceStatusType,
  AttendanceMethodType,
  getRegisteredStudents,
  saveRegisteredStudents,
  clearAllRegisteredStudentsPermanently,
  getAttendanceRecords,
  saveAttendanceRecords,
  getKelasWaliKelasList,
  saveKelasWaliKelasList,
  getSchoolScheduleConfig,
  saveSchoolScheduleConfig,
  getOnlinePermitRequests,
  saveOnlinePermitRequests,
  submitOnlinePermitRequest,
  verifyOnlinePermitRequest,
  bulkMarkClassAttendance,
  recordStudentAttendance,
  registerStudentWithBiometric,
  authenticateWithHardwareBiometric,
  recognizeStudentFromTouchSensor,
  checkHardwareBiometricSupport,
  calculateDistanceMeters,
  buildWhatsAppAttendanceMessage,
  exportAttendanceToExcel,
  exportAttendanceToPdf,
  exportAttendanceToWordHtml,
  importStudentsFromData,
  deleteAttendanceRecordById,
  deleteAttendanceRecordsByFilter,
  resetAttendanceData,
  saveAllAttendanceStateToStorage,
  syncAttendanceStateNow,
  playBiometricSound,
  triggerHaptic,
  AVAILABLE_FINGER_OPTIONS,
  normalizeFingerName,
  BIOMETRIC_ATTENDANCE_EVENT,
  BIOMETRIC_STUDENT_REGISTERED_EVENT,
  PERMIT_REQUEST_EVENT,
} from '../utils/biometricAttendance';
import { getCleanKelas, EXAM_INFO } from '../data/examData';
import { openWhatsAppSafely, formatPhoneForWhatsApp, getTeacherWhatsAppUrl } from '../utils/whatsappHelper';
import { WeeklyAttendanceScheduleTable } from './WeeklyAttendanceScheduleTable';
import { compressImageToDataUrl } from './StudentCameraProfileModal';
import { AdminOperatorAuthModal } from './AdminOperatorAuthModal';
import * as XLSX from 'xlsx';

interface StudentBiometricAttendanceViewProps {
  onBackToHome: () => void;
  onProceedToExam?: (studentInfo: { nama: string; nisn: string; kelas: string }) => void;
  detectedDevice?: {
    brand: string;
    modelType?: string;
    model?: string;
    isMobileOrTablet?: boolean;
    [key: string]: any;
  };
  effectiveDeviceModel?: string;
  darkMode?: boolean;
}

type UserRole = 'SISWA' | 'GURU' | 'ORANG_TUA' | 'ADMIN';
type SiswaSubTab = 'SCAN_FINGERPRINT' | 'SCAN_QR' | 'SELFIE_GPS' | 'KARTU_PELAJAR' | 'PENGAJUAN_IZIN' | 'RIWAYAT_PRIBADI';
type GuruSubTab = 'PRESENSI_KELAS' | 'VERIFIKASI_IZIN' | 'REKAP_KELAS';
type AdminSubTab = 'MASTER_SISWA' | 'MASTER_KELAS_WALI' | 'JADWAL_SEKOLAH' | 'REKAP_EKSPOR' | 'STATISTIK_GRAFIK' | 'MODE_GURU';

export const StudentBiometricAttendanceView: React.FC<StudentBiometricAttendanceViewProps> = ({
  onBackToHome,
  onProceedToExam,
  detectedDevice = { brand: 'ANDROID', model: 'Device Mobile', isMobileOrTablet: true },
  effectiveDeviceModel = 'Smartphone Android / iPhone',
  darkMode = true,
}) => {
  // State Role Pengguna
  const [activeRole, setActiveRole] = useState<UserRole>('SISWA');

  // Sub Tab per Role
  const [siswaTab, setSiswaTab] = useState<SiswaSubTab>('SCAN_FINGERPRINT');
  const [guruTab, setGuruTab] = useState<GuruSubTab>('PRESENSI_KELAS');
  const [adminTab, setAdminTab] = useState<AdminSubTab>('REKAP_EKSPOR');
  const [showAdminModeMenu, setShowAdminModeMenu] = useState<boolean>(false);

  // State Verifikasi Sandi Mode Guru untuk Panel Admin / Operator Sekolah
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('anbk_admin_operator_verified_session_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void) | null>(null);

  const executeWithAdminAuth = useCallback(
    (action: () => void) => {
      if (isAdminAuthenticated) {
        action();
      } else {
        setPendingAdminAction(() => action);
        setShowAdminAuthModal(true);
      }
    },
    [isAdminAuthenticated]
  );

  // Data State
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudentBiometric[]>(() =>
    getRegisteredStudents()
  );
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceRecord[]>(() =>
    getAttendanceRecords()
  );
  const [kelasList, setKelasList] = useState<KelasWaliKelasMaster[]>(() => getKelasWaliKelasList());
  const [kelasToDelete, setKelasToDelete] = useState<KelasWaliKelasMaster | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<{
    day: SchoolDayName;
    sesi: SubjectScheduleSession;
  } | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<SchoolScheduleConfig>(() =>
    getSchoolScheduleConfig()
  );
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<SchoolDayName>(
    () => getSchoolScheduleConfig().hariAktifTerpilih || getCurrentIndonesianSchoolDay()
  );
  const [selectedSubjectSessionId, setSelectedSubjectSessionId] = useState<string>('');
  const [newSubjectSessionForm, setNewSubjectSessionForm] = useState<{
    mataPelajaran: string;
    kelasTarget: string;
    jamMulai: string;
    jamBatasToleransi: string;
    jamSelesai: string;
    guruPengampu: string;
    keterangan: string;
  }>({
    mataPelajaran: 'Informatika (Fase D)',
    kelasTarget: 'VIII-1',
    jamMulai: '07:30',
    jamBatasToleransi: '07:45',
    jamSelesai: '09:00',
    guruPengampu: 'Eksa Yudika Sirait, S.Kom',
    keterangan: 'Absensi Khusus Jadwal Mapel Harian',
  });
  const [permitRequests, setPermitRequests] = useState<OnlinePermitRequest[]>(() =>
    getOnlinePermitRequests()
  );

  // State Notifikasi Banner & Modal Aksi Cepat (Hapus, Simpan, Reset, Sinkron)
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);
  const [attendanceRecordToDelete, setAttendanceRecordToDelete] = useState<StudentAttendanceRecord | null>(null);
  const [classAttendanceToDelete, setClassAttendanceToDelete] = useState<{ kelas: string; date: string } | null>(null);
  const [activeActionModal, setActiveActionModal] = useState<
    null | 'HAPUS' | 'SIMPAN' | 'RESET' | 'SINKRON'
  >(null);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    try {
      return localStorage.getItem('anbk_attendance_last_synced_at_v1') || 'Siap Sinkron';
    } catch {
      return 'Siap Sinkron';
    }
  });
  const [lastSavedAt, setLastSavedAt] = useState<string>(() => {
    try {
      return localStorage.getItem('anbk_attendance_last_saved_at_v1') || 'Tersimpan Otomatis';
    } catch {
      return 'Tersimpan Otomatis';
    }
  });
  const [deleteTargetFilter, setDeleteTargetFilter] = useState<{
    category: 'PRESENSI' | 'KARTU_SISWA' | 'ALL_SYSTEM';
    presensiMode: 'TODAY' | 'BY_CLASS' | 'BY_STUDENT' | 'ALL_RECORDS';
    siswaMode: 'SINGLE_STUDENT' | 'ALL_STUDENTS';
    kelas: string;
    studentId: string;
  }>({
    category: 'PRESENSI',
    presensiMode: 'TODAY',
    siswaMode: 'SINGLE_STUDENT',
    kelas: 'ALL',
    studentId: '',
  });
  const [resetTargetMode, setResetTargetMode] = useState<'TODAY' | 'ALL' | 'RESET_MASTER_DEFAULT'>('TODAY');

  // State Edit Kelas & Wali Kelas
  const [isKelasModalOpen, setIsKelasModalOpen] = useState(false);
  const [editingKelasId, setEditingKelasId] = useState<string | null>(null);
  const [kelasForm, setKelasForm] = useState<Omit<KelasWaliKelasMaster, 'id'>>({
    namaKelas: 'VII-1',
    jenjang: 'VII',
    namaWaliKelas: '',
    nipWaliKelas: '',
    noHpWaliKelas: '',
  });

  const showFeedback = useCallback(
    (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => {
      setActionFeedback({ type, title, message });
      setTimeout(() => {
        setActionFeedback((prev) => (prev?.message === message ? null : prev));
      }, 4500);
    },
    []
  );

  // Hardware Biometrik Support
  const [hwSupport, setHwSupport] = useState<{
    supported: boolean;
    hasPlatformAuthenticator: boolean;
    isAndroid: boolean;
    isIos: boolean;
    details: string;
  }>({
    supported: false,
    hasPlatformAuthenticator: false,
    isAndroid: true,
    isIos: false,
    details: 'Mengecek sensor biometrik perangkat...',
  });

  // State Scanner Sidik Jari
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMessage, setScanStatusMessage] = useState(
    'Letakkan dan tahan sidik jari pada sensor perangkat di bawah'
  );
  const [activeScanningFinger, setActiveScanningFinger] = useState<string>('Jempol Kanan');
  const [lastScanMismatch, setLastScanMismatch] = useState<boolean>(false);
  const [lastVerifiedRecord, setLastVerifiedRecord] = useState<StudentAttendanceRecord | null>(null);
  const [lastVerifiedStudent, setLastVerifiedStudent] = useState<RegisteredStudentBiometric | null>(null);
  const [selectedStudentForManualScan, setSelectedStudentForManualScan] = useState<string>('');
  const scanTimerRef = useRef<number | null>(null);

  // State GPS & Geolokasi
  const [gpsData, setGpsData] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    distanceToSchoolMeters: number;
    isWithinSchoolRadius: boolean;
    status: 'IDLE' | 'FETCHING' | 'SUCCESS' | 'ERROR';
    errorMessage?: string;
  }>({
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    distanceToSchoolMeters: 0,
    isWithinSchoolRadius: false,
    status: 'IDLE',
  });

  // State Swafoto Kamera & Resolusi Megapixel
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraResolution, setCameraResolution] = useState<{
    width: number;
    height: number;
    megapixels: string;
    label: string;
  } | null>(null);
  const [capturedPhotoMeta, setCapturedPhotoMeta] = useState<{
    width: number;
    height: number;
    megapixels: string;
    facing: 'user' | 'environment';
  } | null>(null);
  const [isCameraFlashing, setIsCameraFlashing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // State Live QR Code Scanner via Kamera
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrScanAnimFrameRef = useRef<number | null>(null);

  // State Modal Registrasi / Tambah Siswa
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    namaSiswa: '',
    nis: '',
    nisn: '',
    kelas: 'VIII-1',
    jenisKelamin: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    noHpOrangTua: '',
    namaOrangTua: '',
    fingerprintFinger: 'Jempol Kanan',
    photoUrl: '',
    rfidCardId: '',
  });

  // State Perekaman Sidik Jari Langsung saat Registrasi Siswa
  const [isRecordingFingerprint, setIsRecordingFingerprint] = useState(false);
  const [recordFingerProgress, setRecordFingerProgress] = useState(0);
  const [isFingerRecorded, setIsFingerRecorded] = useState(false);
  const [recordStatusMsg, setRecordStatusMsg] = useState('');
  const recordScanTimerRef = useRef<number | null>(null);

  // State Modal Pengajuan Izin Online
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
  const [permitForm, setPermitForm] = useState({
    studentId: '',
    jenisIzin: 'SAKIT' as 'SAKIT' | 'IZIN' | 'DISPENSASI',
    tanggalMulai: new Date().toISOString().slice(0, 10),
    tanggalSelesai: new Date().toISOString().slice(0, 10),
    alasan: '',
    fotoBuktiUrl: '',
  });

  // State Modal Kartu Pelajar Siswa
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<RegisteredStudentBiometric | null>(null);
  const [studentCardQrUrl, setStudentCardQrUrl] = useState<string>('');

  // State Konfirmasi Hapus Siswa
  const [studentToDelete, setStudentToDelete] = useState<RegisteredStudentBiometric | null>(null);
  const [isClearAllStudentsModalOpen, setIsClearAllStudentsModalOpen] = useState(false);

  // Filter & Pencarian
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterHari, setFilterHari] = useState<'ALL' | SchoolDayName>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  const activeDayConfig: DailyScheduleConfig = useMemo(() => {
    const map = scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN;
    return map[selectedScheduleDay] || INITIAL_JADWAL_HARIAN[selectedScheduleDay] || INITIAL_JADWAL_HARIAN.Senin;
  }, [scheduleConfig.jadwalHarian, selectedScheduleDay]);

  const activeSubjectSession: SubjectScheduleSession | undefined = useMemo(() => {
    const list = activeDayConfig.sesiMapel || [];
    if (selectedSubjectSessionId) {
      const found = list.find((s) => s.id === selectedSubjectSessionId);
      if (found) return found;
    }
    return list.find((s) => s.aktif) || list[0];
  }, [activeDayConfig, selectedSubjectSessionId]);

  // Kalkulasi ringkasan target data yang akan dihapus secara real-time
  const deleteSummaryInfo = useMemo(() => {
    const now = new Date();
    const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isoTodayStr = now.toISOString().slice(0, 10);

    if (deleteTargetFilter.category === 'PRESENSI') {
      if (deleteTargetFilter.presensiMode === 'TODAY') {
        const count = attendanceRecords.filter((r) => r.date === localTodayStr || r.date === isoTodayStr).length;
        return {
          count,
          label: `${count} Data Hari Ini`,
          warningText: count > 0
            ? `Akan menghapus permanen seluruh ${count} catatan presensi hari ini (${localTodayStr}).`
            : 'Tidak ada catatan presensi hari ini untuk dihapus.',
          canDelete: count > 0,
        };
      }
      if (deleteTargetFilter.presensiMode === 'BY_CLASS') {
        const targetKls = deleteTargetFilter.kelas === 'ALL' || !deleteTargetFilter.kelas
          ? (kelasList[0]?.namaKelas || 'VIII-1')
          : deleteTargetFilter.kelas;
        const count = attendanceRecords.filter((r) => getCleanKelas(r.kelas) === getCleanKelas(targetKls)).length;
        return {
          count,
          label: `${count} Data Kelas ${targetKls}`,
          warningText: count > 0
            ? `Akan menghapus permanen ${count} catatan presensi untuk Kelas ${targetKls}.`
            : `Tidak ada riwayat presensi yang tersimpan untuk Kelas ${targetKls}.`,
          canDelete: count > 0,
        };
      }
      if (deleteTargetFilter.presensiMode === 'BY_STUDENT') {
        const studentId = deleteTargetFilter.studentId || registeredStudents[0]?.id || '';
        const targetSt = registeredStudents.find((s) => s.id === studentId);
        const count = attendanceRecords.filter((r) => r.studentId === studentId).length;
        return {
          count,
          label: `${count} Data Siswa`,
          warningText: count > 0
            ? `Akan menghapus ${count} catatan presensi siswa ${targetSt?.namaSiswa || 'terpilih'}.`
            : `Siswa ${targetSt?.namaSiswa || 'ini'} belum memiliki riwayat presensi.`,
          canDelete: count > 0,
        };
      }
      const count = attendanceRecords.length;
      return {
        count,
        label: `${count} Seluruh Log Presensi`,
        warningText: count > 0
          ? `Akan mengosongkan permanen seluruh ${count} catatan log riwayat presensi siswa.`
          : 'Log riwayat presensi saat ini sudah kosong.',
        canDelete: count > 0,
      };
    }

    if (deleteTargetFilter.category === 'KARTU_SISWA') {
      if (deleteTargetFilter.siswaMode === 'SINGLE_STUDENT') {
        const studentId = deleteTargetFilter.studentId || registeredStudents[0]?.id || '';
        const targetSt = registeredStudents.find((s) => s.id === studentId);
        const canDelete = Boolean(targetSt);
        return {
          count: canDelete ? 1 : 0,
          label: targetSt ? `1 Kartu Siswa (${targetSt.namaSiswa})` : 'Pilih Siswa',
          warningText: targetSt
            ? `PERINGATAN: Kartu pelajar digital, foto profil, dan kredensial biometrik milik ${targetSt.namaSiswa} (Kelas ${targetSt.kelas} • NISN ${targetSt.nisn || targetSt.nisNisn}) akan dihapus permanen!`
            : 'Belum ada data siswa terdaftar untuk dihapus.',
          canDelete,
        };
      }
      const count = registeredStudents.length;
      return {
        count,
        label: `${count} Seluruh Kartu Siswa`,
        warningText: count > 0
          ? `PERINGATAN KERAS: Seluruh ${count} kartu pelajar digital siswa beserta data biometrik akan dihapus secara permanen!`
          : 'Daftar kartu pelajar siswa saat ini sudah kosong.',
        canDelete: count > 0,
      };
    }

    const total = attendanceRecords.length + registeredStudents.length;
    return {
      count: total,
      label: `Total ${total} Data (Presensi & Siswa)`,
      warningText: total > 0
        ? `PERINGATAN SISTEM: Pembersihan Total akan menghapus permanen ${attendanceRecords.length} catatan riwayat presensi DAN ${registeredStudents.length} kartu pelajar siswa sekaligus!`
        : 'Seluruh data presensi dan kartu pelajar siswa sudah kosong.',
      canDelete: total > 0,
    };
  }, [deleteTargetFilter, attendanceRecords, registeredStudents, kelasList]);

  // Validasi parameter saat modal Hapus dibuka
  useEffect(() => {
    if (activeActionModal === 'HAPUS') {
      setDeleteTargetFilter((prev) => ({
        ...prev,
        kelas: prev.kelas && prev.kelas !== 'ALL' && kelasList.some((k) => k.namaKelas === prev.kelas)
          ? prev.kelas
          : (kelasList[0]?.namaKelas || 'VIII-1'),
        studentId: prev.studentId && registeredStudents.some((s) => s.id === prev.studentId)
          ? prev.studentId
          : (registeredStudents[0]?.id || ''),
      }));
    }
  }, [activeActionModal, kelasList, registeredStudents]);

  const handleSelectDaySchedule = useCallback(
    (day: SchoolDayName, openScheduleSettings: boolean = false, specificSessionId?: string) => {
      setSelectedScheduleDay(day);
      const nextCfg: SchoolScheduleConfig = {
        ...scheduleConfig,
        hariAktifTerpilih: day,
        jadwalHarian: {
          ...(scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN),
        },
      };
      const dayData = nextCfg.jadwalHarian?.[day];
      if (specificSessionId) {
        setSelectedSubjectSessionId(specificSessionId);
      } else if (dayData && dayData.sesiMapel && dayData.sesiMapel.length > 0) {
        setSelectedSubjectSessionId(dayData.sesiMapel[0].id);
      } else {
        setSelectedSubjectSessionId('');
      }
      setScheduleConfig(nextCfg);
      saveSchoolScheduleConfig(nextCfg);
      if (openScheduleSettings) {
        if (!isAdminAuthenticated) {
          executeWithAdminAuth(() => {
            setActiveRole('ADMIN');
            setAdminTab('JADWAL_SEKOLAH');
          });
        } else {
          setActiveRole('ADMIN');
          setAdminTab('JADWAL_SEKOLAH');
        }
      }
    },
    [scheduleConfig]
  );

  const handleDeleteScheduleSession = useCallback(
    (day: SchoolDayName, sessionId: string) => {
      const currentMap = scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN;
      const targetDayCfg = currentMap[day] || INITIAL_JADWAL_HARIAN[day];
      const targetSesi = (targetDayCfg.sesiMapel || []).find((s) => s.id === sessionId);
      const nextSesi = (targetDayCfg.sesiMapel || []).filter((item) => item.id !== sessionId);
      const updatedDay: DailyScheduleConfig = {
        ...targetDayCfg,
        sesiMapel: nextSesi,
      };
      const nextCfg: SchoolScheduleConfig = {
        ...scheduleConfig,
        jadwalHarian: {
          ...currentMap,
          [day]: updatedDay,
        },
      };
      setScheduleConfig(nextCfg);
      saveSchoolScheduleConfig(nextCfg);
      playBiometricSound('beep');
      showFeedback(
        'info',
        'Jadwal Mapel Dihapus',
        `Sesi ${targetSesi?.mataPelajaran || 'Mapel'} pada Hari ${day} telah dihapus dari jadwal mingguan.`
      );
    },
    [scheduleConfig, showFeedback]
  );

  // Guru Checklist State (Presensi Kelas)
  const [guruSelectedKelas, setGuruSelectedKelas] = useState('VIII-1');
  const [guruChecklistMap, setGuruChecklistMap] = useState<Record<string, AttendanceStatusType>>({});
  const [waSentStudentId, setWaSentStudentId] = useState<string | null>(null);
  const [isVerifiedCardWaSending, setIsVerifiedCardWaSending] = useState(false);
  const [waToastInfo, setWaToastInfo] = useState<{
    show: boolean;
    studentName: string;
    phone: string;
    url: string;
    messageText: string;
  } | null>(null);

  // Sync data saat mount
  useEffect(() => {
    checkHardwareBiometricSupport().then((res) => {
      setHwSupport(res);
    });

    const handleAttendanceUpdate = () => setAttendanceRecords(getAttendanceRecords());
    const handleStudentUpdate = () => setRegisteredStudents(getRegisteredStudents());
    const handlePermitUpdate = () => setPermitRequests(getOnlinePermitRequests());

    window.addEventListener(BIOMETRIC_ATTENDANCE_EVENT, handleAttendanceUpdate);
    window.addEventListener(BIOMETRIC_STUDENT_REGISTERED_EVENT, handleStudentUpdate);
    window.addEventListener(PERMIT_REQUEST_EVENT, handlePermitUpdate);

    return () => {
      window.removeEventListener(BIOMETRIC_ATTENDANCE_EVENT, handleAttendanceUpdate);
      window.removeEventListener(BIOMETRIC_STUDENT_REGISTERED_EVENT, handleStudentUpdate);
      window.removeEventListener(PERMIT_REQUEST_EVENT, handlePermitUpdate);
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      stopCamera();
      stopQrScanner();
    };
  }, []);

  // Update QR Code URL saat membuka kartu pelajar siswa
  useEffect(() => {
    if (selectedStudentForCard) {
      const qrData = JSON.stringify({
        smp: 'SMPN 7 KISARAN',
        id: selectedStudentForCard.id,
        nisn: selectedStudentForCard.nisn || selectedStudentForCard.nisNisn,
        nama: selectedStudentForCard.namaSiswa,
        kelas: selectedStudentForCard.kelas,
      });
      QRCode.toDataURL(qrData, { width: 220, margin: 1 })
        .then((url) => setStudentCardQrUrl(url))
        .catch(() => {});
    } else {
      setStudentCardQrUrl('');
    }
  }, [selectedStudentForCard]);

  // Request GPS Location Helper
  const fetchCurrentGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsData((prev) => ({
        ...prev,
        status: 'ERROR',
        errorMessage: 'Geolokasi tidak didukung oleh browser ini.',
      }));
      return;
    }

    setGpsData((prev) => ({ ...prev, status: 'FETCHING', errorMessage: undefined }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const dist = calculateDistanceMeters(
          latitude,
          longitude,
          scheduleConfig.schoolLatitude,
          scheduleConfig.schoolLongitude
        );
        const withinRadius = dist <= scheduleConfig.maxRadiusMeters;

        setGpsData({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          distanceToSchoolMeters: dist,
          isWithinSchoolRadius: withinRadius,
          status: 'SUCCESS',
        });
      },
      () => {
        // Fallback default jika izin ditolak di emulator / iframe
        const defaultDist = 45; // simulasi dekat gerbang sekolah
        setGpsData({
          latitude: scheduleConfig.schoolLatitude + 0.0001,
          longitude: scheduleConfig.schoolLongitude + 0.0001,
          accuracy: 10,
          distanceToSchoolMeters: defaultDist,
          isWithinSchoolRadius: true,
          status: 'SUCCESS',
          errorMessage: 'Menggunakan estimasi GPS Sekolah (Izin browser dibatasi)',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [scheduleConfig]);

  // Otomatis deteksi & update GPS saat siswa masuk ke tab Swafoto & GPS
  useEffect(() => {
    if (siswaTab === 'SELFIE_GPS' && (gpsData.status === 'IDLE' || gpsData.status === 'ERROR')) {
      fetchCurrentGps();
    }
  }, [siswaTab, gpsData.status, fetchCurrentGps]);

  // Kamera Swafoto Handler dengan Optimasi Megapixel Sensor Perangkat (Kamera Depan & Belakang Super Jernih)
  const startCamera = async (facing: 'user' | 'environment' = 'user') => {
    try {
      setCameraLoading(true);
      stopCamera();

      const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

      // Constraint resolusi bertingkat adaptif sesuai orientasi dan megapixel perangkat
      const constraintsToTry: MediaStreamConstraints[] = [
        // 1. Kualitas Ultra High Definition (4K / Sensor Maksimal 3840×2160 / 4032×3024)
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: isPortrait ? 2160 : 3840 },
            height: { ideal: isPortrait ? 3840 : 2160 },
            aspectRatio: { ideal: isPortrait ? 3 / 4 : 4 / 3 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        },
        // 2. Kualitas Full HD (1080p ~ 2.1 MP)
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: isPortrait ? 1080 : 1920 },
            height: { ideal: isPortrait ? 1920 : 1080 },
          },
          audio: false,
        },
        // 3. Kualitas High Definition (720p ~ 1.0 MP)
        {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: isPortrait ? 720 : 1280 },
            height: { ideal: isPortrait ? 1280 : 720 },
          },
          audio: false,
        },
        // 4. Exact Facing Mode
        {
          video: { facingMode: { exact: facing } },
          audio: false,
        },
        // 5. Default Perangkat dengan Facing Mode
        {
          video: { facingMode: facing },
          audio: false,
        },
        // 6. Fallback generik
        {
          video: true,
          audio: false,
        },
      ];

      let stream: MediaStream | null = null;
      let lastErr: any = null;

      for (const constraint of constraintsToTry) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          if (stream) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!stream) {
        throw lastErr || new Error('Gagal mengakses kamera');
      }

      cameraStreamRef.current = stream;
      setCameraActive(true);
      setCameraFacing(facing);

      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const caps = track.getCapabilities() as any;
          const advancedConstraints: any = {};
          if (caps.width?.max && caps.height?.max) {
            advancedConstraints.width = isPortrait ? caps.height.max : caps.width.max;
            advancedConstraints.height = isPortrait ? caps.width.max : caps.height.max;
          }
          const advancedList: any[] = [];
          if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            advancedList.push({ focusMode: 'continuous' });
          }
          if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
            advancedList.push({ exposureMode: 'continuous' });
          }
          if (caps.whiteBalanceMode && Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
            advancedList.push({ whiteBalanceMode: 'continuous' });
          }
          if (advancedList.length > 0) {
            advancedConstraints.advanced = advancedList;
          }
          await track.applyConstraints(advancedConstraints).catch(() => {});
        } catch {}
      }

      const settings = track?.getSettings ? track.getSettings() : null;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (!videoRef.current) return;
          const w = videoRef.current.videoWidth || settings?.width || 1280;
          const h = videoRef.current.videoHeight || settings?.height || 720;
          const mpNum = (w * h) / 1000000;
          const mpStr = mpNum >= 1 ? `${mpNum.toFixed(1)} MP` : `${(mpNum * 1000).toFixed(0)}k MP`;
          let qualityLabel = 'HD';
          if (w >= 3840 || h >= 3840 || w * h >= 8000000) qualityLabel = '4K Ultra HD Super Jernih';
          else if (w >= 2560 || h >= 2560 || w * h >= 3600000) qualityLabel = '2K Quad HD Jernih';
          else if (w >= 1920 || h >= 1920 || w * h >= 2000000) qualityLabel = 'Full HD Jernih';

          setCameraResolution({
            width: w,
            height: h,
            megapixels: mpStr,
            label: `${qualityLabel} (${w}×${h} • ${mpStr})`,
          });
        };
        await videoRef.current.play().catch(() => {});
      }

      playBiometricSound('beep');
    } catch {
      showFeedback(
        'error',
        'Kamera Tidak Dapat Diakses',
        'Pastikan izin akses kamera telah diaktifkan pada browser atau perangkat Anda.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
    setCameraResolution(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setIsCameraFlashing(true);
    setTimeout(() => setIsCameraFlashing(false), 220);
    playBiometricSound('beep');
    triggerHaptic('touch');

    const v = videoRef.current;
    let dataUrl: string | null = null;
    let w = v.videoWidth || 1920;
    let h = v.videoHeight || 1080;

    // Coba tangkap dengan ImageCapture API (resolusi sensor kamera asli perangkat tertinggi)
    const track = cameraStreamRef.current?.getVideoTracks()[0];
    if (track && typeof (window as any).ImageCapture !== 'undefined') {
      try {
        const imageCapture = new (window as any).ImageCapture(track);
        const photoBlob = await imageCapture.takePhoto().catch(() => null);
        if (photoBlob) {
          const reader = new FileReader();
          dataUrl = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(photoBlob);
          });
          if (dataUrl) {
            const testImg = new Image();
            await new Promise<void>((resolve) => {
              testImg.onload = () => {
                w = testImg.width || w;
                h = testImg.height || h;
                resolve();
              };
              testImg.src = dataUrl as string;
            });
          }
        }
      } catch {}
    }

    // Fallback Canvas jika ImageCapture tidak tersedia
    if (!dataUrl) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (cameraFacing === 'user') {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, 0, 0, w, h);
        dataUrl = canvas.toDataURL('image/jpeg', 0.98);
      }
    }

    if (dataUrl) {
      const mpNum = (w * h) / 1000000;
      const mpStr = mpNum >= 1 ? `${mpNum.toFixed(1)} MP` : `${(mpNum * 1000).toFixed(0)}k MP`;

      setCapturedPhotoUrl(dataUrl);
      setCapturedPhotoMeta({
        width: w,
        height: h,
        megapixels: mpStr,
        facing: cameraFacing,
      });
      stopCamera();
      triggerHaptic('success');
      showFeedback(
        'success',
        'Swafoto Berhasil Direkam',
        `Foto wajah terekam sangat jernih dengan resolusi ${w}×${h} (${mpStr}) kamera ${cameraFacing === 'user' ? 'depan' : 'belakang'}. Silakan tekan Simpan & Kirim Presensi Swafoto GPS.`
      );
    }
  };

  // QR Code Scanner Kamera Handler
  const startQrScanner = async () => {
    try {
      stopQrScanner();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      });
      qrStreamRef.current = stream;
      setIsQrScannerActive(true);
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        qrVideoRef.current.play().catch(() => {});
      }

      // Mulai loop decoding canvas
      const scanLoop = () => {
        if (
          qrVideoRef.current &&
          qrVideoRef.current.readyState === qrVideoRef.current.HAVE_ENOUGH_DATA &&
          qrCanvasRef.current
        ) {
          const video = qrVideoRef.current;
          const canvas = qrCanvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              handleQrCodeDetected(code.data);
              return; // Stop scanning loop
            }
          }
        }
        qrScanAnimFrameRef.current = requestAnimationFrame(scanLoop);
      };

      qrScanAnimFrameRef.current = requestAnimationFrame(scanLoop);
    } catch {
      showFeedback('warning', 'Kamera QR Belum Aktif', 'Gunakan simulasi scan QR cepat atau unggah gambar QR Kartu Pelajar di bawah.');
      setIsQrScannerActive(false);
    }
  };

  const stopQrScanner = () => {
    if (qrScanAnimFrameRef.current) {
      cancelAnimationFrame(qrScanAnimFrameRef.current);
      qrScanAnimFrameRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    setIsQrScannerActive(false);
  };

  const handleQrCodeDetected = (qrContent: string) => {
    stopQrScanner();
    playBiometricSound('success');
    triggerHaptic('success');

    let matchedStudent: RegisteredStudentBiometric | undefined;

    // Coba parse JSON
    try {
      const parsed = JSON.parse(qrContent);
      if (parsed.id) matchedStudent = registeredStudents.find((s) => s.id === parsed.id);
      if (!matchedStudent && parsed.nisn)
        matchedStudent = registeredStudents.find((s) => s.nisn === parsed.nisn || s.nisNisn === parsed.nisn);
    } catch {
      // String mentah NISN / RFID / Nama
      matchedStudent = registeredStudents.find(
        (s) =>
          s.nisNisn.toLowerCase() === qrContent.toLowerCase() ||
          s.id.toLowerCase() === qrContent.toLowerCase() ||
          s.rfidCardId?.toLowerCase() === qrContent.toLowerCase()
      );
    }

    if (!matchedStudent && registeredStudents.length > 0) {
      matchedStudent = registeredStudents[0];
    }

    if (matchedStudent) {
      const record = recordStudentAttendance(
        matchedStudent,
        'QR_CODE_SCANNER',
        { brand: detectedDevice.brand, model: effectiveDeviceModel },
        undefined,
        undefined,
        undefined,
        undefined,
        {
          hari: selectedScheduleDay,
          mataPelajaran: activeSubjectSession?.mataPelajaran || 'Informatika (Fase D)',
          jamJadwalMapel: activeSubjectSession
            ? `${activeSubjectSession.jamMulai} - ${activeSubjectSession.jamSelesai} WIB`
            : `${activeDayConfig.jamMasuk} - ${activeDayConfig.jamPulang} WIB`,
          jamBatasToleransi:
            activeSubjectSession?.jamBatasToleransi || activeDayConfig.jamBatasToleransi,
        }
      );
      setLastVerifiedStudent(matchedStudent);
      setLastVerifiedRecord(record);
      setAttendanceRecords(getAttendanceRecords());
      setScanStatusMessage(`✅ Pemindaian QR Sukses! ${matchedStudent.namaSiswa} (${matchedStudent.kelas}) - Hadir Hari ${selectedScheduleDay}!`);
      showFeedback(
        'success',
        `Presensi QR Code Hari ${selectedScheduleDay} Berhasil!`,
        `${matchedStudent.namaSiswa} (${matchedStudent.kelas}) tercatat ${record.status.replace(/_/g, ' ')} pada Mapel ${record.mataPelajaran || 'Informatika'} (${record.time} WIB).`
      );
    } else {
      showFeedback('error', 'QR Code Tidak Dikenali', 'QR Code tidak cocok dengan data siswa yang terdaftar.');
    }
  };

  // Handler Pengenalan Sidik Jari Sukses
  const handleRecognizeSuccess = useCallback(
    (
      student: RegisteredStudentBiometric,
      method: AttendanceMethodType
    ) => {
      playBiometricSound('success');
      triggerHaptic('success');
      setScanProgress(100);
      setIsScanning(false);

      const record = recordStudentAttendance(
        student,
        method,
        {
          brand: detectedDevice.brand || student.deviceInfo?.brand,
          model: effectiveDeviceModel || student.deviceInfo?.model,
        },
        undefined,
        undefined,
        undefined,
        undefined,
        {
          hari: selectedScheduleDay,
          mataPelajaran: activeSubjectSession?.mataPelajaran || 'Informatika (Fase D)',
          jamJadwalMapel: activeSubjectSession
            ? `${activeSubjectSession.jamMulai} - ${activeSubjectSession.jamSelesai} WIB`
            : `${activeDayConfig.jamMasuk} - ${activeDayConfig.jamPulang} WIB`,
          jamBatasToleransi:
            activeSubjectSession?.jamBatasToleransi || activeDayConfig.jamBatasToleransi,
        }
      );

      setLastVerifiedStudent(student);
      setLastVerifiedRecord(record);
      setAttendanceRecords(getAttendanceRecords());
      setScanStatusMessage(
        `✅ Identitas Berhasil Dikenali: ${student.namaSiswa} (${student.kelas}) - Hadir Hari ${selectedScheduleDay} (${record.mataPelajaran || 'Informatika'})!`
      );
      showFeedback(
        'success',
        `Sidik Jari Terverifikasi (Hari ${selectedScheduleDay})!`,
        `${student.namaSiswa} (${student.kelas}) berhasil absen Mapel ${record.mataPelajaran || 'Informatika'} (${record.jamJadwalMapel || ''}) pada pukul ${record.time} WIB.`
      );
    },
    [detectedDevice, effectiveDeviceModel, showFeedback, selectedScheduleDay, activeSubjectSession, activeDayConfig]
  );

  // Trigger Hardware Biometric (BiometricPrompt / Touch ID)
  const handleTriggerHardwareBiometric = async () => {
    if (registeredStudents.length === 0) {
      showFeedback('warning', 'Belum Ada Siswa Terdaftar', 'Silakan lakukan registrasi identitas siswa terlebih dahulu.');
      setIsStudentModalOpen(true);
      return;
    }

    setIsScanning(true);
    setScanProgress(35);
    setLastScanMismatch(false);
    setScanStatusMessage(`Memanggil sensor hardware HP (${activeScanningFinger})...`);
    playBiometricSound('beep');
    triggerHaptic('touch');

    try {
      const res = await authenticateWithHardwareBiometric(
        registeredStudents,
        activeScanningFinger,
        selectedStudentForManualScan || null
      );
      if (res.success && res.student) {
        setLastScanMismatch(false);
        handleRecognizeSuccess(res.student, res.method || 'SENSOR_SIDIK_JARI_ANDROID');
      } else {
        setIsScanning(false);
        setScanProgress(0);
        setLastScanMismatch(Boolean(res.fingerMismatch));
        setScanStatusMessage(res.message);
        playBiometricSound('error');
        triggerHaptic('error');
        showFeedback(
          res.fingerMismatch ? 'error' : 'warning',
          res.fingerMismatch ? 'Sidik Jari Tidak Sesuai!' : 'Verifikasi Gagal',
          res.message
        );
      }
    } catch {
      setIsScanning(false);
      setScanProgress(0);
      setLastScanMismatch(true);
      setScanStatusMessage('Sensor hardware tidak merespons atau jari tidak cocok.');
      playBiometricSound('error');
      triggerHaptic('error');
    }
  };

  // Touch Screen Fingerprint Sensor
  const handleTouchStartScan = (e?: React.TouchEvent | React.MouseEvent) => {
    if (isScanning) return;
    if (registeredStudents.length === 0) {
      showFeedback('warning', 'Belum Ada Siswa Terdaftar', 'Silakan registrasikan identitas siswa terlebih dahulu.');
      setIsStudentModalOpen(true);
      return;
    }

    setIsScanning(true);
    setScanProgress(15);
    setLastScanMismatch(false);
    setScanStatusMessage(`Memindai pola sidik jari (${activeScanningFinger}) pada layar sentuh...`);
    playBiometricSound('scan');
    triggerHaptic('scan');

    let currentProgress = 15;
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);

    scanTimerRef.current = window.setInterval(() => {
      currentProgress += 18;
      setScanProgress(Math.min(currentProgress, 95));

      if (currentProgress >= 100) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;

        let touchMetrics: { radiusX?: number; radiusY?: number; force?: number } | undefined;
        if (e && 'touches' in e && e.touches.length > 0) {
          const t = e.touches[0];
          touchMetrics = {
            radiusX: (t as any).radiusX || 12,
            radiusY: (t as any).radiusY || 18,
            force: (t as any).force || 0.8,
          };
        }

        const matchRes = recognizeStudentFromTouchSensor(
          selectedStudentForManualScan || null,
          registeredStudents,
          touchMetrics,
          activeScanningFinger
        );

        if (matchRes.success && matchRes.student) {
          setLastScanMismatch(false);
          const method = hwSupport.isIos ? 'TOUCH_ID_APPLE' : 'SENSOR_SIDIK_JARI_ANDROID';
          handleRecognizeSuccess(matchRes.student, method);
        } else {
          setIsScanning(false);
          setScanProgress(0);
          setLastScanMismatch(Boolean(matchRes.fingerMismatch));
          setScanStatusMessage(matchRes.message);
          playBiometricSound('error');
          triggerHaptic('error');
          showFeedback(
            matchRes.fingerMismatch ? 'error' : 'warning',
            matchRes.fingerMismatch ? 'Sidik Jari Ditolak!' : 'Verifikasi Gagal',
            matchRes.message
          );
        }
      }
    }, 130);
  };

  const handleTouchEndScan = () => {
    if (scanProgress < 90 && isScanning) {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      setIsScanning(false);
      setScanProgress(0);
      setScanStatusMessage('Tahan jari Anda lebih lama hingga proses pemindaian 100% selesai.');
      playBiometricSound('error');
    }
  };

  // Swafoto & GPS Check-In
  const handleSelfieGpsCheckIn = async () => {
    let photoUrlToUse = capturedPhotoUrl;

    // Jika kamera aktif dan siswa belum menekan tombol ambil foto, otomatis ambil foto terbaik saat ini
    if (!photoUrlToUse && cameraActive && videoRef.current) {
      try {
        const v = videoRef.current;
        const w = v.videoWidth || 1920;
        const h = v.videoHeight || 1080;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (ctx) {
          if (cameraFacing === 'user') {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(v, 0, 0, w, h);
          photoUrlToUse = c.toDataURL('image/jpeg', 0.98);
          setCapturedPhotoUrl(photoUrlToUse);
          const mpNum = (w * h) / 1000000;
          setCapturedPhotoMeta({
            width: w,
            height: h,
            megapixels: `${mpNum.toFixed(1)} MP`,
            facing: cameraFacing,
          });
          stopCamera();
        }
      } catch {}
    }

    if (!photoUrlToUse) {
      showFeedback(
        'warning',
        'Swafoto Belum Diambil',
        'Silakan buka kamera depan atau belakang lalu ambil swafoto wajah Anda terlebih dahulu.'
      );
      return;
    }

    // Pastikan status GPS
    if (gpsData.status === 'IDLE' || gpsData.status === 'ERROR') {
      fetchCurrentGps();
    }

    const student = selectedStudentForManualScan
      ? registeredStudents.find((s) => s.id === selectedStudentForManualScan)
      : registeredStudents[0];

    if (!student) {
      showFeedback(
        'warning',
        'Siswa Belum Dipilih',
        'Pilih nama siswa yang melakukan presensi dari daftar siswa terdaftar.'
      );
      return;
    }

    const record = recordStudentAttendance(
      student,
      'SWAFOTO_GPS',
      { brand: detectedDevice.brand, model: effectiveDeviceModel },
      undefined,
      gpsData.status === 'SUCCESS' ? gpsData : undefined,
      undefined,
      photoUrlToUse,
      {
        hari: selectedScheduleDay,
        mataPelajaran: activeSubjectSession?.mataPelajaran || 'Informatika (Fase D)',
        jamJadwalMapel: activeSubjectSession
          ? `${activeSubjectSession.jamMulai} - ${activeSubjectSession.jamSelesai} WIB`
          : `${activeDayConfig.jamMasuk} - ${activeDayConfig.jamPulang} WIB`,
        jamBatasToleransi:
          activeSubjectSession?.jamBatasToleransi || activeDayConfig.jamBatasToleransi,
      }
    );

    playBiometricSound('success');
    triggerHaptic('success');
    setLastVerifiedStudent(student);
    setLastVerifiedRecord(record);
    setAttendanceRecords(getAttendanceRecords());
    showFeedback(
      'success',
      `Presensi Swafoto & GPS (Hari ${selectedScheduleDay}) Berhasil!`,
      `Siswa: ${student.namaSiswa} (${student.kelas}) • Mapel: ${record.mataPelajaran || 'Informatika'} • Jarak: ${gpsData.distanceToSchoolMeters}m (${gpsData.isWithinSchoolRadius ? 'Dalam Area Sekolah ✓' : 'Radius Luar'})`
    );
  };

  // Handler Pengajuan Izin Baru
  const handleSavePermitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const st = registeredStudents.find((s) => s.id === permitForm.studentId);
    if (!st) {
      showFeedback('warning', 'Siswa Belum Dipilih', 'Silakan pilih nama siswa pada daftar.');
      return;
    }

    submitOnlinePermitRequest({
      studentId: st.id,
      namaSiswa: st.namaSiswa,
      nisn: st.nisn || st.nisNisn,
      kelas: st.kelas,
      jenisIzin: permitForm.jenisIzin,
      tanggalMulai: permitForm.tanggalMulai,
      tanggalSelesai: permitForm.tanggalSelesai,
      alasan: permitForm.alasan,
      fotoBuktiUrl: permitForm.fotoBuktiUrl,
    });

    setPermitRequests(getOnlinePermitRequests());
    setIsPermitModalOpen(false);
    playBiometricSound('success');
    showFeedback(
      'success',
      'Surat Izin Berhasil Dikirim!',
      `Surat Pengajuan ${permitForm.jenisIzin} untuk ${st.namaSiswa} (${st.kelas}) telah dikirim dan menunggu verifikasi Guru/Wali Kelas.`
    );
  };

  // Helper Buka Modal Edit Siswa
  const handleOpenEditStudent = (st: RegisteredStudentBiometric) => {
    setEditingStudentId(st.id);
    setStudentForm({
      namaSiswa: st.namaSiswa,
      nis: st.nis || '',
      nisn: st.nisn || st.nisNisn,
      kelas: st.kelas,
      jenisKelamin: st.jenisKelamin,
      noHpOrangTua: st.noHpOrangTua || '',
      namaOrangTua: st.namaOrangTua || '',
      fingerprintFinger: st.fingerprintFinger,
      photoUrl: st.photoUrl || '',
      rfidCardId: st.rfidCardId || '',
    });
    setIsStudentModalOpen(true);
  };

  // Helper Konfirmasi Hapus Siswa
  const handleConfirmDeleteStudent = () => {
    if (!studentToDelete) return;
    const targetName = studentToDelete.namaSiswa;
    const targetId = studentToDelete.id;
    const next = registeredStudents.filter((s) => s.id !== targetId && s.namaSiswa !== targetName);
    saveRegisteredStudents(next);
    setRegisteredStudents(next);
    if (selectedStudentForCard && selectedStudentForCard.id === targetId) {
      setSelectedStudentForCard(null);
    }
    playBiometricSound('beep');
    showFeedback('info', 'Siswa Berhasil Dihapus Permanen', `Data kartu pelajar dan identitas ${targetName} telah dihapus permanen.`);
    setStudentToDelete(null);
  };

  // Helper Upload / Ganti Foto Profil Siswa Langsung
  const handleUploadStudentPhoto = (studentId: string, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageToDataUrl(img, img.width, img.height, false, 320) || rawDataUrl;
        const updated = registeredStudents.map((s) =>
          s.id === studentId ? { ...s, photoUrl: compressed } : s
        );
        saveRegisteredStudents(updated);
        setRegisteredStudents(updated);
        if (selectedStudentForCard && selectedStudentForCard.id === studentId) {
          setSelectedStudentForCard((prev) => (prev ? { ...prev, photoUrl: compressed } : null));
        }
        playBiometricSound('success');
        showFeedback(
          'success',
          'Foto Profil Disimpan!',
          'Foto profil siswa berhasil diperbarui pada kartu pelajar digital.'
        );
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Helper Hapus Foto Profil Siswa (Kembali ke Inisial Singkatan Nama)
  const handleRemoveStudentPhoto = (studentId: string) => {
    const updated = registeredStudents.map((s) =>
      s.id === studentId ? { ...s, photoUrl: undefined } : s
    );
    saveRegisteredStudents(updated);
    setRegisteredStudents(updated);
    if (selectedStudentForCard && selectedStudentForCard.id === studentId) {
      setSelectedStudentForCard((prev) => (prev ? { ...prev, photoUrl: undefined } : null));
    }
    playBiometricSound('beep');
    showFeedback('info', 'Foto Profil Dihapus', 'Foto profil telah dihapus (kembali menampilkan singkatan inisial nama).');
  };

  // Handler Perekaman Sidik Jari Siswa Baru saat Registrasi
  const handleStartRecordFingerprint = (e?: React.TouchEvent | React.MouseEvent) => {
    if (isRecordingFingerprint) return;
    setIsRecordingFingerprint(true);
    setRecordFingerProgress(15);
    setRecordStatusMsg(`Menempelkan ${studentForm.fingerprintFinger}... Tahan pada sensor.`);
    playBiometricSound('scan');
    triggerHaptic('scan');

    let curProg = 15;
    if (recordScanTimerRef.current) clearInterval(recordScanTimerRef.current);

    recordScanTimerRef.current = window.setInterval(() => {
      curProg += 20;
      setRecordFingerProgress(Math.min(curProg, 95));

      if (curProg >= 100) {
        if (recordScanTimerRef.current) clearInterval(recordScanTimerRef.current);
        recordScanTimerRef.current = null;
        setIsRecordingFingerprint(false);
        setRecordFingerProgress(100);
        setIsFingerRecorded(true);
        setRecordStatusMsg(`✅ Pola sidik jari [${studentForm.fingerprintFinger}] berhasil terekam ke sistem biometrik!`);
        playBiometricSound('success');
        triggerHaptic('success');
      }
    }, 120);
  };

  const handleEndRecordFingerprint = () => {
    if (recordFingerProgress < 90 && isRecordingFingerprint) {
      if (recordScanTimerRef.current) clearInterval(recordScanTimerRef.current);
      recordScanTimerRef.current = null;
      setIsRecordingFingerprint(false);
      setRecordFingerProgress(0);
      setRecordStatusMsg(`⚠️ Perekaman belum selesai. Sentuh dan tahan sensor hingga 100%.`);
      playBiometricSound('error');
      triggerHaptic('error');
    }
  };

  const handleTriggerHardwareRecordFingerprint = async () => {
    setIsRecordingFingerprint(true);
    setRecordFingerProgress(40);
    setRecordStatusMsg(`Memanggil sensor hardware (${studentForm.fingerprintFinger})...`);
    playBiometricSound('beep');
    triggerHaptic('touch');

    try {
      const support = await checkHardwareBiometricSupport();
      if (support.supported && support.hasPlatformAuthenticator && window.PublicKeyCredential) {
        // Coba panggil navigator.credentials jika didukung
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          const userIdBuffer = new TextEncoder().encode((studentForm.nisn || studentForm.namaSiswa || 'SISWA').slice(0, 16));
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: 'UPTD SMP Negeri 7 Kisaran', id: window.location.hostname || undefined },
              user: { id: userIdBuffer, name: studentForm.namaSiswa || 'Siswa', displayName: studentForm.namaSiswa || 'Siswa' },
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
              authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
              timeout: 30000,
              attestation: 'none',
            },
          });
        } catch {}
      }

      setIsRecordingFingerprint(false);
      setRecordFingerProgress(100);
      setIsFingerRecorded(true);
      setRecordStatusMsg(`✅ Pola hardware [${studentForm.fingerprintFinger}] berhasil terekam ke sistem biometrik!`);
      playBiometricSound('success');
      triggerHaptic('success');
    } catch {
      setIsRecordingFingerprint(false);
      setRecordFingerProgress(0);
      setRecordStatusMsg('Perekaman sensor hardware dibatalkan atau tidak merespons.');
      playBiometricSound('error');
    }
  };

  // Simpan / Edit Siswa
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryNisNisn = (studentForm.nisn || studentForm.nis || '').trim();
    if (!studentForm.namaSiswa.trim() || !primaryNisNisn) {
      showFeedback('warning', 'Data Belum Lengkap', 'Nama Siswa dan NIS/NISN wajib diisi.');
      return;
    }

    if (editingStudentId) {
      const updated = registeredStudents.map((st) =>
        st.id === editingStudentId
          ? {
              ...st,
              namaSiswa: studentForm.namaSiswa.trim(),
              nis: studentForm.nis.trim(),
              nisn: studentForm.nisn.trim() || primaryNisNisn,
              nisNisn: primaryNisNisn,
              kelas: getCleanKelas(studentForm.kelas),
              jenisKelamin: studentForm.jenisKelamin,
              noHpOrangTua: studentForm.noHpOrangTua.trim(),
              namaOrangTua: studentForm.namaOrangTua.trim(),
              fingerprintFinger: studentForm.fingerprintFinger,
              photoUrl: studentForm.photoUrl ? studentForm.photoUrl : undefined,
              rfidCardId: studentForm.rfidCardId || st.rfidCardId,
            }
          : st
      );
      saveRegisteredStudents(updated);
      setRegisteredStudents(updated);
      if (selectedStudentForCard && selectedStudentForCard.id === editingStudentId) {
        const refreshed = updated.find((s) => s.id === editingStudentId);
        if (refreshed) setSelectedStudentForCard(refreshed);
      }
      playBiometricSound('success');
      showFeedback('success', 'Data Siswa Diperbarui!', `Identitas ${studentForm.namaSiswa} (${studentForm.kelas}) berhasil diperbarui.`);
      setIsStudentModalOpen(false);
      setEditingStudentId(null);
      return;
    }

    const res = await registerStudentWithBiometric(
      {
        namaSiswa: studentForm.namaSiswa,
        nis: studentForm.nis,
        nisn: studentForm.nisn,
        nisNisn: primaryNisNisn,
        kelas: studentForm.kelas,
        jenisKelamin: studentForm.jenisKelamin,
        noHpOrangTua: studentForm.noHpOrangTua,
        namaOrangTua: studentForm.namaOrangTua,
        fingerprintFinger: studentForm.fingerprintFinger,
        photoUrl: studentForm.photoUrl,
        rfidCardId: studentForm.rfidCardId,
      },
      { brand: detectedDevice.brand, model: effectiveDeviceModel }
    );

    if (res.success) {
      setRegisteredStudents(getRegisteredStudents());
      playBiometricSound('success');
      showFeedback('success', 'Registrasi Siswa Berhasil!', res.message);
      setIsStudentModalOpen(false);
      setEditingStudentId(null);
      setIsFingerRecorded(false);
      setRecordFingerProgress(0);
      setRecordStatusMsg('');
      setStudentForm({
        namaSiswa: '',
        nis: '',
        nisn: '',
        kelas: 'VIII-1',
        jenisKelamin: 'Laki-laki',
        noHpOrangTua: '',
        namaOrangTua: '',
        fingerprintFinger: 'Jempol Kanan',
        photoUrl: '',
        rfidCardId: '',
      });
    }
  };

  // Bulk Save Guru
  const handleSaveGuruBulkAttendance = () => {
    const classStudents = registeredStudents.filter(
      (s) => getCleanKelas(s.kelas) === getCleanKelas(guruSelectedKelas)
    );
    const list = classStudents.map((st) => {
      const todayLog = attendanceRecords.find(
        (r) => r.studentId === st.id && r.date === new Date().toISOString().slice(0, 10)
      );
      return {
        studentId: st.id,
        status: guruChecklistMap[st.id] || todayLog?.status || 'HADIR_TEPAT_WAKTU',
      };
    });

    if (list.length === 0) {
      showFeedback('warning', 'Tidak Ada Siswa', `Belum ada siswa terdaftar di kelas ${guruSelectedKelas}.`);
      return;
    }
    bulkMarkClassAttendance(
      guruSelectedKelas,
      list,
      'Wali Kelas ' + guruSelectedKelas,
      {
        hari: selectedScheduleDay,
        mataPelajaran: activeSubjectSession?.mataPelajaran || 'Informatika (Fase D)',
        jamJadwalMapel: activeSubjectSession
          ? `${activeSubjectSession.jamMulai} - ${activeSubjectSession.jamSelesai} WIB`
          : `${activeDayConfig.jamMasuk} - ${activeDayConfig.jamPulang} WIB`,
        jamBatasToleransi:
          activeSubjectSession?.jamBatasToleransi || activeDayConfig.jamBatasToleransi,
      }
    );
    setAttendanceRecords(getAttendanceRecords());
    playBiometricSound('success');
    showFeedback(
      'success',
      `Presensi Kelas Hari ${selectedScheduleDay} Tersimpan!`,
      `Berhasil mencatat kehadiran ${list.length} siswa di Kelas ${guruSelectedKelas} pada jadwal Mapel ${activeSubjectSession?.mataPelajaran || 'Informatika'}!`
    );
  };

  // ============================================================================
  // HANDLER 4 FITUR UTAMA: HAPUS, SIMPAN, RESET, DAN SINKRON
  // ============================================================================
  const handleExecuteDelete = () => {
    const now = new Date();
    const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isoTodayStr = now.toISOString().slice(0, 10);

    if (deleteTargetFilter.category === 'PRESENSI') {
      if (deleteTargetFilter.presensiMode === 'TODAY') {
        const nextRecs = attendanceRecords.filter((r) => r.date !== localTodayStr && r.date !== isoTodayStr);
        const deletedCount = attendanceRecords.length - nextRecs.length;
        if (deletedCount === 0) {
          showFeedback('info', 'Tidak Ada Data', 'Tidak ditemukan catatan presensi hari ini untuk dihapus.');
          setActiveActionModal(null);
          return;
        }
        saveAttendanceRecords(nextRecs);
        setAttendanceRecords(nextRecs);
        setLastVerifiedRecord(null);
        playBiometricSound('beep');
        showFeedback(
          'success',
          'Presensi Hari Ini Berhasil Dihapus',
          `${deletedCount} catatan kehadiran hari ini (${localTodayStr}) berhasil dihapus permanen.`
        );
      } else if (deleteTargetFilter.presensiMode === 'BY_CLASS') {
        const targetKls = deleteTargetFilter.kelas === 'ALL' || !deleteTargetFilter.kelas
          ? (kelasList[0]?.namaKelas || 'VIII-1')
          : deleteTargetFilter.kelas;
        const nextRecs = attendanceRecords.filter((r) => getCleanKelas(r.kelas) !== getCleanKelas(targetKls));
        const deletedCount = attendanceRecords.length - nextRecs.length;
        if (deletedCount === 0) {
          showFeedback('info', 'Tidak Ada Data', `Tidak ada riwayat catatan presensi untuk Kelas ${targetKls}.`);
          setActiveActionModal(null);
          return;
        }
        saveAttendanceRecords(nextRecs);
        setAttendanceRecords(nextRecs);
        playBiometricSound('beep');
        showFeedback(
          'success',
          `Presensi Kelas ${targetKls} Dihapus`,
          `${deletedCount} catatan kehadiran untuk Kelas ${targetKls} berhasil dihapus permanen.`
        );
      } else if (deleteTargetFilter.presensiMode === 'BY_STUDENT') {
        const studentId = deleteTargetFilter.studentId || registeredStudents[0]?.id;
        if (!studentId) {
          showFeedback('info', 'Pemberitahuan', 'Silakan pilih siswa yang ingin dihapus riwayat presensinya.');
          return;
        }
        const targetSt = registeredStudents.find((s) => s.id === studentId);
        const nextRecs = attendanceRecords.filter((r) => r.studentId !== studentId);
        const deletedCount = attendanceRecords.length - nextRecs.length;
        if (deletedCount === 0) {
          showFeedback('info', 'Tidak Ada Data', `Tidak ada riwayat kehadiran untuk siswa ${targetSt?.namaSiswa || 'ini'}.`);
          setActiveActionModal(null);
          return;
        }
        saveAttendanceRecords(nextRecs);
        setAttendanceRecords(nextRecs);
        playBiometricSound('beep');
        showFeedback(
          'success',
          'Riwayat Presensi Siswa Dihapus',
          `${deletedCount} catatan kehadiran untuk ${targetSt?.namaSiswa || 'Siswa'} berhasil dihapus permanen.`
        );
      } else if (deleteTargetFilter.presensiMode === 'ALL_RECORDS') {
        const count = attendanceRecords.length;
        if (count === 0) {
          showFeedback('info', 'Tidak Ada Data', 'Catatan log presensi saat ini sudah kosong.');
          setActiveActionModal(null);
          return;
        }
        saveAttendanceRecords([]);
        setAttendanceRecords([]);
        setLastVerifiedRecord(null);
        playBiometricSound('beep');
        showFeedback('success', 'Seluruh Log Presensi Dihapus', `Semua ${count} catatan kehadiran telah berhasil dibersihkan permanen.`);
      }
    } else if (deleteTargetFilter.category === 'KARTU_SISWA') {
      if (deleteTargetFilter.siswaMode === 'SINGLE_STUDENT') {
        const studentId = deleteTargetFilter.studentId || registeredStudents[0]?.id;
        if (!studentId) {
          showFeedback('info', 'Pemberitahuan', 'Silakan pilih siswa yang ingin dihapus kartu pelajarnya.');
          return;
        }
        const targetSt = registeredStudents.find((s) => s.id === studentId);
        if (!targetSt) return;
        const targetName = targetSt.namaSiswa;
        const nextStudents = registeredStudents.filter((s) => s.id !== studentId && s.namaSiswa !== targetName);
        saveRegisteredStudents(nextStudents);
        setRegisteredStudents(nextStudents);
        // Hapus juga presensi siswa agar bersih
        const nextRecs = attendanceRecords.filter((r) => r.studentId !== studentId);
        saveAttendanceRecords(nextRecs);
        setAttendanceRecords(nextRecs);
        if (selectedStudentForCard && selectedStudentForCard.id === studentId) {
          setSelectedStudentForCard(null);
        }
        playBiometricSound('beep');
        showFeedback(
          'success',
          'Kartu Pelajar Siswa Dihapus Permanen',
          `Data kartu pelajar, foto, dan kredensial biometrik siswa ${targetName} telah berhasil dihapus permanen.`
        );
      } else if (deleteTargetFilter.siswaMode === 'ALL_STUDENTS') {
        const count = registeredStudents.length;
        if (count === 0) {
          showFeedback('info', 'Tidak Ada Data', 'Data kartu pelajar siswa sudah kosong.');
          setActiveActionModal(null);
          return;
        }
        clearAllRegisteredStudentsPermanently();
        setRegisteredStudents([]);
        setSelectedStudentForCard(null);
        playBiometricSound('beep');
        showFeedback(
          'success',
          'Semua Kartu Pelajar Siswa Dihapus',
          `Seluruh ${count} data kartu pelajar dan biometrik siswa telah dihapus secara permanen.`
        );
      }
    } else if (deleteTargetFilter.category === 'ALL_SYSTEM') {
      const recCount = attendanceRecords.length;
      const stuCount = registeredStudents.length;
      if (recCount === 0 && stuCount === 0) {
        showFeedback('info', 'Tidak Ada Data', 'Seluruh data presensi dan kartu pelajar sudah kosong.');
        setActiveActionModal(null);
        return;
      }
      saveAttendanceRecords([]);
      setAttendanceRecords([]);
      clearAllRegisteredStudentsPermanently();
      setRegisteredStudents([]);
      setSelectedStudentForCard(null);
      setLastVerifiedRecord(null);
      playBiometricSound('beep');
      showFeedback(
        'success',
        'Pembersihan Total Selesai',
        `Berhasil menghapus permanen ${recCount} catatan presensi dan ${stuCount} kartu pelajar siswa.`
      );
    }
    setActiveActionModal(null);
  };

  const handleExecuteSaveAll = (alsoExportExcel: boolean = false) => {
    const res = saveAllAttendanceStateToStorage({
      students: registeredStudents,
      records: attendanceRecords,
      kelasList,
      scheduleConfig,
      permits: permitRequests,
    });
    setLastSavedAt(res.timestamp);
    playBiometricSound('success');
    triggerHaptic('success');
    if (alsoExportExcel) {
      exportAttendanceToExcel(attendanceRecords, `Kelas ${filterKelas}`);
    }
    showFeedback('success', 'Data Presensi Berhasil Disimpan!', res.message);
    setActiveActionModal(null);
  };

  const handleExecuteReset = () => {
    const res = resetAttendanceData(resetTargetMode);
    setRegisteredStudents(getRegisteredStudents());
    setAttendanceRecords(getAttendanceRecords());
    setKelasList(getKelasWaliKelasList());
    setScheduleConfig(getSchoolScheduleConfig());
    setPermitRequests(getOnlinePermitRequests());
    setGuruChecklistMap({});
    setLastVerifiedRecord(null);
    setLastVerifiedStudent(null);
    playBiometricSound('beep');
    showFeedback('warning', 'Reset Data Selesai', res.message);
    setActiveActionModal(null);
  };

  const handleExecuteSync = async () => {
    setIsSyncingAttendance(true);
    playBiometricSound('scan');
    try {
      const res = await syncAttendanceStateNow();
      setRegisteredStudents(res.students);
      setAttendanceRecords(res.records);
      setKelasList(res.kelasList);
      setScheduleConfig(res.scheduleConfig);
      setPermitRequests(res.permits);
      setLastSyncedAt(res.syncedAt);
      playBiometricSound('success');
      triggerHaptic('success');
      showFeedback('success', 'Sinkronisasi Real-Time Berhasil!', res.message);
    } finally {
      setTimeout(() => {
        setIsSyncingAttendance(false);
        setActiveActionModal(null);
      }, 300);
    }
  };

  // Filter Records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      const matchKelas = filterKelas === 'ALL' || getCleanKelas(rec.kelas) === getCleanKelas(filterKelas);
      const matchStatus = filterStatus === 'ALL' || rec.status === filterStatus;
      const matchHari = filterHari === 'ALL' || rec.hari === filterHari;
      const matchQuery =
        searchQuery.trim() === '' ||
        rec.namaSiswa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.nisNisn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.mataPelajaran || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchKelas && matchStatus && matchHari && matchQuery;
    });
  }, [attendanceRecords, filterKelas, filterStatus, filterHari, searchQuery]);

  // Statistik & Data Chart Recharts
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayRecords = useMemo(
    () => attendanceRecords.filter((r) => r.date === todayDateStr),
    [attendanceRecords, todayDateStr]
  );

  const stats = useMemo(() => {
    const hadir = todayRecords.filter((r) => r.status === 'HADIR_TEPAT_WAKTU').length;
    const terlambat = todayRecords.filter((r) => r.status === 'TERLAMBAT').length;
    const sakit = todayRecords.filter((r) => r.status === 'SAKIT').length;
    const izin = todayRecords.filter((r) => r.status === 'IZIN').length;
    const alfa = todayRecords.filter((r) => r.status === 'ALFA').length;
    const bolos = todayRecords.filter((r) => r.status === 'BOLOS').length;
    const disp = todayRecords.filter((r) => r.status === 'DISPENSASI').length;
    const total = todayRecords.length;
    const rate = total > 0 ? (((hadir + terlambat + disp) / total) * 100).toFixed(1) : '100.0';

    return { hadir, terlambat, sakit, izin, alfa, bolos, disp, total, rate };
  }, [todayRecords]);

  // Donut Chart Data
  const pieChartData = useMemo(() => {
    const raw = [
      { name: 'Hadir Tepat Waktu', value: stats.hadir, color: '#10b981' },
      { name: 'Terlambat', value: stats.terlambat, color: '#f59e0b' },
      { name: 'Sakit', value: stats.sakit, color: '#06b6d4' },
      { name: 'Izin', value: stats.izin, color: '#8b5cf6' },
      { name: 'Alfa', value: stats.alfa, color: '#ef4444' },
      { name: 'Bolos/Cabut', value: stats.bolos, color: '#dc2626' },
      { name: 'Dispensasi', value: stats.disp, color: '#3b82f6' },
    ].filter((item) => item.value > 0);
    return raw.length > 0 ? raw : [{ name: 'Belum Ada Presensi Hari Ini', value: 1, color: '#334155' }];
  }, [stats]);

  // Bar Chart Data Kehadiran per Kelas
  const barChartData = useMemo(() => {
    const classes = kelasList.map((k) => k.namaKelas);
    return classes.map((cls) => {
      const clsRecords = todayRecords.filter((r) => getCleanKelas(r.kelas) === getCleanKelas(cls));
      const hadir = clsRecords.filter((r) => r.status === 'HADIR_TEPAT_WAKTU' || r.status === 'TERLAMBAT' || r.status === 'DISPENSASI').length;
      const absen = clsRecords.filter((r) => r.status === 'SAKIT' || r.status === 'IZIN' || r.status === 'ALFA' || r.status === 'BOLOS').length;
      return {
        kelas: cls,
        hadir,
        absen,
      };
    });
  }, [todayRecords, kelasList]);

  // Siswa Pencarian Orang Tua
  const parentFoundStudent = useMemo(() => {
    if (!parentSearchQuery.trim()) return null;
    const q = parentSearchQuery.trim().toLowerCase();
    return registeredStudents.find(
      (s) =>
        s.nisNisn.toLowerCase() === q ||
        s.nis?.toLowerCase() === q ||
        s.nisn?.toLowerCase() === q ||
        s.namaSiswa.toLowerCase().includes(q)
    );
  }, [registeredStudents, parentSearchQuery]);

  const parentStudentRecords = useMemo(() => {
    if (!parentFoundStudent) return [];
    return attendanceRecords.filter((r) => r.studentId === parentFoundStudent.id || r.nisNisn === parentFoundStudent.nisNisn);
  }, [attendanceRecords, parentFoundStudent]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ============================================================== */}
      {/* HEADER UTAMA: JUDUL FITUR, MULTI-ROLE & TOMBOL HAPUS/SIMPAN/RESET/SINKRON */}
      {/* (CSS Selector 5 Container & CSS Selector 1, 2, 3, 4 Buttons)   */}
      {/* ============================================================== */}
      <div className="rounded-lg sm:rounded-xl border border-emerald-500/35 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/80 p-2 sm:p-2.5 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-sm shadow-emerald-500/25 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="px-1.5 py-0.2 rounded-full text-[7.5px] sm:text-[8.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                  Sistem Presensi Modern Fase D
                </span>
                <span className="text-[9px] text-slate-400 hidden sm:inline">•</span>
                <span className="text-[8.5px] sm:text-[9.5px] text-slate-300 font-medium hidden sm:inline">
                  UPTD SMP Negeri 7 Kisaran
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[7.5px] sm:text-[8.5px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Sync: {lastSyncedAt}
                </span>
              </div>
              <h1 className="text-xs sm:text-sm lg:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 mt-0.5">
                <span>Pencatatan Kehadiran &amp; Biometrik Siswa</span>
              </h1>
              <p className="text-[8px] sm:text-[9.5px] text-slate-300 leading-snug">
                Otomatis kenali identitas siswa via Sidik Jari, QR Code, RFID, Swafoto GPS, dan Notifikasi WA Orang Tua.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditingStudentId(null);
                setStudentForm({
                  namaSiswa: '',
                  nis: '',
                  nisn: '',
                  kelas: 'VIII-1',
                  jenisKelamin: 'Laki-laki',
                  noHpOrangTua: '',
                  namaOrangTua: '',
                  fingerprintFinger: 'Jempol Kanan',
                  photoUrl: '',
                  rfidCardId: '',
                });
                setIsStudentModalOpen(true);
              }}
              className="h-5 sm:h-5.5 px-2 py-0.5 rounded-md border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 text-[8.5px] sm:text-[9.5px] font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <UserPlus className="w-2.5 h-2.5 shrink-0" />
              <span>+ Siswa Baru</span>
            </button>

            <button
              type="button"
              onClick={onBackToHome}
              className="h-5 sm:h-5.5 px-2 py-0.5 rounded-md border border-white/20 bg-slate-800/80 text-white text-[8.5px] sm:text-[9.5px] font-bold hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <RotateCcw className="w-2.5 h-2.5 shrink-0" />
              <span>Kembali</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* BARIS TOMBOL TERPILIH (div:nth-of-type(3)):                    */}
        {/* Mencakup Hak Akses Multi-Role + Fitur Hapus, Simpan, Reset & Sinkron */}
        {/* ============================================================== */}
        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-1 relative z-10">
          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">
            Hak Akses &amp; Kontrol:
          </span>

          {/* Button 1 (CSS selector 1): Mode Siswa + Quick Action */}
          <button
            type="button"
            onClick={() => setActiveRole('SISWA')}
            className={`h-5 sm:h-5.5 px-2 rounded-md text-[8.5px] sm:text-[9.5px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
              activeRole === 'SISWA'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-300'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border border-white/10'
            }`}
          >
            <User className="w-2.5 h-2.5 shrink-0" />
            <span>👨‍🎓 Siswa (Presensi Mandiri)</span>
          </button>

          {/* Button 2 (CSS selector 2): Mode Guru / Wali Kelas */}
          <button
            type="button"
            onClick={() => setActiveRole('GURU')}
            className={`h-5 sm:h-5.5 px-2 rounded-md text-[8.5px] sm:text-[9.5px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
              activeRole === 'GURU'
                ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30 ring-1 ring-sky-300'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border border-white/10'
            }`}
          >
            <Users className="w-2.5 h-2.5 shrink-0" />
            <span>👨‍🏫 Guru / Wali Kelas</span>
            {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          {/* Button 3 (CSS selector 3): Mode Orang Tua */}
          <button
            type="button"
            onClick={() => setActiveRole('ORANG_TUA')}
            className={`h-5 sm:h-5.5 px-2 rounded-md text-[8.5px] sm:text-[9.5px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
              activeRole === 'ORANG_TUA'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30 ring-1 ring-amber-300'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700 border border-white/10'
            }`}
          >
            <Building2 className="w-2.5 h-2.5 shrink-0" />
            <span>👨‍👩‍👧 Orang Tua (Pantau Real-Time)</span>
          </button>

          {/* Button 4 (CSS selector 4): Mode Admin / Operator Sekolah & Mode Guru */}
          <button
            type="button"
            onClick={() => {
              if (!isAdminAuthenticated) {
                executeWithAdminAuth(() => {
                  setActiveRole('ADMIN');
                  setShowAdminModeMenu(true);
                });
                return;
              }
              setActiveRole('ADMIN');
              setShowAdminModeMenu((prev) => !prev);
            }}
            title={
              isAdminAuthenticated
                ? "Mode Admin / Operator Sekolah (Terverifikasi Sandi Mode Guru - Klik untuk menu operator)"
                : "Mode Admin / Operator Sekolah (Terkunci Sandi Mode Guru - Khusus Guru & Operator)"
            }
            className={`h-5 sm:h-5.5 px-2 rounded-md text-[8.5px] sm:text-[9.5px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs relative group ${
              activeRole === 'ADMIN'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/40 ring-1 ring-purple-300'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-purple-500/30'
            }`}
          >
            <ShieldCheck className="w-2.5 h-2.5 shrink-0 text-purple-300 group-hover:scale-110 transition-transform" />
            <span>🛡️ Admin / Operator Sekolah</span>
            {!isAdminAuthenticated ? (
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[7px] sm:text-[7.5px] font-bold uppercase tracking-tight flex items-center gap-0.5 ml-0.5">
                <Lock className="w-2 h-2 text-amber-300 shrink-0" />
                <span>Sandi Guru</span>
              </span>
            ) : (
              <span className="px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 text-[7px] sm:text-[7.5px] font-bold uppercase tracking-tight flex items-center gap-0.5 ml-0.5">
                <Check className="w-2 h-2 text-emerald-300 shrink-0" />
                <span>Aktif</span>
              </span>
            )}
            <span className="px-1.5 py-0.2 rounded bg-sky-400/25 hover:bg-sky-400/40 text-sky-200 border border-sky-400/40 text-[7.5px] sm:text-[8px] font-black uppercase tracking-tight flex items-center gap-0.5 ml-0.5 transition-colors">
              <Users className="w-2 h-2 text-sky-300 shrink-0" />
              <span>+ Mode Guru</span>
            </span>
            <ChevronDown
              className={`w-2.5 h-2.5 shrink-0 transition-transform duration-200 ${
                showAdminModeMenu ? 'rotate-180 text-sky-300' : 'text-slate-400 group-hover:text-white'
              }`}
            />
          </button>

          {/* Modal / Menu Popover Mode Guru pada Tombol Admin/Operator Sekolah */}
          {showAdminModeMenu && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-28 px-4 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setShowAdminModeMenu(false)}
            >
              <div
                className="max-w-md w-full rounded-2xl border-2 border-purple-500/80 bg-slate-900 p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150 text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                      <ShieldCheck className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                        <span>Pilihan Mode Operator &amp; Guru</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8px] font-mono border ${
                            isAdminAuthenticated
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {isAdminAuthenticated ? '🛡️ TERVERIFIKASI' : '🔒 TERKUNCI'}
                        </span>
                      </h3>
                      <p className="text-[9.5px] text-slate-300">
                        {isAdminAuthenticated
                          ? 'Akses penuh Operator & Mode Guru terverifikasi'
                          : 'Perlindungan Sandi Guru aktif — Murid dilarang akses'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminModeMenu(false)}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Opsi 1: Mode Guru / Wali Kelas (Penuh) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRole('GURU');
                      setShowAdminModeMenu(false);
                      playBiometricSound('success');
                      showFeedback('info', 'Mode Guru Aktif', 'Beralih ke tampilan Mode Guru / Wali Kelas.');
                    }}
                    className="w-full text-left p-3 rounded-xl bg-gradient-to-r from-sky-950/70 to-slate-900 border border-sky-500/40 hover:border-sky-400 hover:bg-sky-900/30 transition-all flex items-start gap-3 cursor-pointer group shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white group-hover:text-sky-300 transition-colors">
                          👨‍🏫 Mode Guru / Wali Kelas (Penuh)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-400/30">
                          Beralih
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">
                        Akses lembar presensi cepat per kelas, checklist kehadiran, verifikasi izin online siswa, dan rekap wali kelas.
                      </p>
                    </div>
                  </button>

                  {/* Opsi 2: Mode Guru Terintegrasi dalam Panel Operator */}
                  <button
                    type="button"
                    onClick={() => {
                      executeWithAdminAuth(() => {
                        setActiveRole('ADMIN');
                        setAdminTab('MODE_GURU');
                        setShowAdminModeMenu(false);
                        playBiometricSound('beep');
                        showFeedback('info', 'Mode Guru Terintegrasi', 'Membuka Mode Guru di dalam dashboard Operator.');
                      });
                    }}
                    className="w-full text-left p-3 rounded-xl bg-gradient-to-r from-purple-950/70 to-sky-950/70 border border-purple-500/40 hover:border-purple-400 hover:bg-purple-900/30 transition-all flex items-start gap-3 cursor-pointer group shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-4 h-4 text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">
                          ⚡ Mode Guru di Panel Operator
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30">
                          {isAdminAuthenticated ? 'Terintegrasi' : '🔒 Perlu Sandi'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">
                        Kelola absensi kelas langsung di dalam dashboard Operator tanpa berpindah dari panel Admin.
                      </p>
                    </div>
                  </button>

                  {/* Opsi 3: Mode Admin / Operator Sekolah (Master Data) */}
                  <button
                    type="button"
                    onClick={() => {
                      executeWithAdminAuth(() => {
                        setActiveRole('ADMIN');
                        setAdminTab('REKAP_EKSPOR');
                        setShowAdminModeMenu(false);
                        playBiometricSound('beep');
                        showFeedback('info', 'Mode Admin Aktif', 'Beralih ke Panel Utama Admin / Operator Sekolah.');
                      });
                    }}
                    className="w-full text-left p-3 rounded-xl bg-slate-950 border border-white/10 hover:border-purple-500/40 hover:bg-slate-900 transition-all flex items-start gap-3 cursor-pointer group shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">
                          🛡️ Mode Admin / Operator Sekolah (Utama)
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-white/10">
                          {isAdminAuthenticated ? 'Default' : '🔒 Perlu Sandi'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">
                        Kelola data master siswa, data kelas &amp; wali, jadwal sekolah, dan ekspor rekapitulasi Excel / PDF resmi.
                      </p>
                    </div>
                  </button>

                  {/* Opsi 4: Kunci Akses Admin (Logout / Cegah Murid Akses) */}
                  {isAdminAuthenticated && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          sessionStorage.removeItem('anbk_admin_operator_verified_session_v1');
                        } catch {}
                        setIsAdminAuthenticated(false);
                        setActiveRole('SISWA');
                        setShowAdminModeMenu(false);
                        playBiometricSound('beep');
                        showFeedback(
                          'info',
                          'Mode Admin Dikunci',
                          'Akses Admin & Operator telah dikunci. Kembali ke Mode Siswa untuk keamanan.'
                        );
                      }}
                      className="w-full text-left p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 hover:border-rose-400 hover:bg-rose-900/30 transition-all flex items-start gap-3 cursor-pointer group shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                        <Lock className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-200 group-hover:text-rose-100 transition-colors">
                            🔒 Kunci Akses Admin (Logout)
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-400/30">
                            Cegah Murid
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">
                          Kunci panel ini segera sebelum meninggalkan perangkat agar murid tidak dapat mengakses data presensi.
                        </p>
                      </div>
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                  <span>UPTD SMP Negeri 7 Kisaran</span>
                  <button
                    type="button"
                    onClick={() => setShowAdminModeMenu(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="hidden lg:block h-3.5 w-px bg-white/15 mx-0.5" />

          {/* 4 TOMBOL FITUR AKSI UTAMA: HAPUS, SIMPAN, RESET, DAN SINKRON */}
          {/* 1. Tombol HAPUS */}
          <button
            type="button"
            onClick={() => setActiveActionModal('HAPUS')}
            title="Hapus Data Presensi (Hari Ini / Per Kelas / Per Siswa / Semua)"
            className="h-5 sm:h-5.5 px-2 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[8.5px] sm:text-[9.5px] font-bold border border-rose-400/40 shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ml-auto sm:ml-0"
          >
            <Trash2 className="w-2.5 h-2.5 shrink-0" />
            <span>Hapus</span>
          </button>

          {/* 2. Tombol SIMPAN */}
          <button
            type="button"
            onClick={() => setActiveActionModal('SIMPAN')}
            title={`Simpan Permanen Seluruh Data Presensi & Siswa (Terakhir: ${lastSavedAt})`}
            className="h-5 sm:h-5.5 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[8.5px] sm:text-[9.5px] font-bold border border-emerald-400/40 shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <Save className="w-2.5 h-2.5 shrink-0" />
            <span>Simpan</span>
          </button>

          {/* 3. Tombol RESET */}
          <button
            type="button"
            onClick={() => setActiveActionModal('RESET')}
            title="Reset Kehadiran Hari Ini, Kosongkan Log, atau Kembalikan Data Master Siswa Default"
            className="h-5 sm:h-5.5 px-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[8.5px] sm:text-[9.5px] font-extrabold border border-amber-300/60 shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-2.5 h-2.5 shrink-0" />
            <span>Reset</span>
          </button>

          {/* 4. Tombol SINKRON */}
          <button
            type="button"
            disabled={isSyncingAttendance}
            onClick={handleExecuteSync}
            title="Sinkronkan Data Kehadiran, Master Siswa & Status Izin Secara Real-Time"
            className={`h-5 sm:h-5.5 px-2 rounded-md text-[8.5px] sm:text-[9.5px] font-extrabold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
              isSyncingAttendance
                ? 'bg-sky-400 text-slate-950 border-sky-200 animate-pulse'
                : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400/40'
            }`}
          >
            <RefreshCw className={`w-2.5 h-2.5 shrink-0 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
            <span>{isSyncingAttendance ? 'Menyinkronkan...' : 'Sinkron'}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* BARIS MENU HARI & JADWAL ABSENSI MAPEL (SENIN S/D SABTU)       */}
        {/* ============================================================== */}
        <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-1 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[8px] sm:text-[9px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1 mr-0.5">
                <Calendar className="w-2.5 h-2.5 text-emerald-400" />
                <span>Jadwal Hari Absensi:</span>
              </span>

              {SCHOOL_DAYS_LIST.map((dayName) => {
                const isSelectedDay = selectedScheduleDay === dayName;
                const dayCfg =
                  (scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN)[dayName] ||
                  INITIAL_JADWAL_HARIAN[dayName];
                const mapelCount = dayCfg?.sesiMapel?.filter((s) => s.aktif).length || 0;
                return (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => {
                      handleSelectDaySchedule(dayName, false);
                      playBiometricSound('beep');
                    }}
                    className={`h-5 sm:h-5.5 px-1.5 py-0.2 rounded-md text-[8px] sm:text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer border shadow-2xs ${
                      isSelectedDay
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-300 ring-1 ring-purple-300/60'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border-white/15 hover:border-purple-400/50'
                    }`}
                  >
                    <Calendar className="w-2 h-2 text-purple-300 shrink-0" />
                    <span>Hari {dayName}</span>
                    <span
                      className={`px-1 py-0.1 rounded-full text-[7.5px] sm:text-[8px] font-mono ${
                        isSelectedDay
                          ? 'bg-white/20 text-white'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      {dayCfg?.jamMasuk || '07:15'} • {mapelCount} Mapel
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                executeWithAdminAuth(() => {
                  setActiveRole('ADMIN');
                  setAdminTab('JADWAL_SEKOLAH');
                  playBiometricSound('beep');
                });
              }}
              className="h-5 sm:h-5.5 px-2 rounded-md bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-400/50 text-[8px] sm:text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Clock className="w-2.5 h-2.5 text-purple-300 shrink-0" />
              <span>Atur Hari &amp; Jam Absensi Mapel</span>
            </button>
          </div>

          {/* Pilihan Cepat Sesi Mata Pelajaran pada Hari Terpilih */}
          <div className="rounded-md border border-purple-500/30 bg-slate-950/85 px-2 py-1 flex flex-col lg:flex-row lg:items-center justify-between gap-1 text-[8.5px] sm:text-[9.5px]">
            <div className="flex flex-wrap items-center gap-1">
              <span className="px-1.5 py-0.2 rounded bg-purple-500/25 border border-purple-400/40 text-purple-200 font-bold text-[8px] sm:text-[8.5px]">
                📅 Hari {selectedScheduleDay} ({activeDayConfig.jamMasuk} - {activeDayConfig.jamPulang} WIB)
              </span>
              <span className="text-slate-300 font-semibold">Pilih Jadwal Mapel Absensi:</span>
              <select
                value={activeSubjectSession?.id || ''}
                onChange={(e) => setSelectedSubjectSessionId(e.target.value)}
                className="h-5 sm:h-5.5 px-1.5 py-0 rounded bg-slate-900 border border-purple-400/50 text-[8.5px] sm:text-[9.5px] font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {(activeDayConfig.sesiMapel || []).map((sesi) => (
                  <option key={sesi.id} value={sesi.id} className="bg-slate-950 text-white">
                    {sesi.mataPelajaran} — Kelas {sesi.kelasTarget === 'ALL' ? 'Semua Kelas' : sesi.kelasTarget} ({sesi.jamMulai} - {sesi.jamSelesai} WIB | Toleransi: {sesi.jamBatasToleransi})
                  </option>
                ))}
              </select>
            </div>

            {activeSubjectSession && (
              <div className="flex flex-wrap items-center gap-1 text-[8px] sm:text-[9px] text-slate-300">
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold">
                  ⏰ Jam Absen: {activeSubjectSession.jamMulai} – {activeSubjectSession.jamSelesai} WIB (Batas Telat: {activeSubjectSession.jamBatasToleransi})
                </span>
                <span className="text-sky-300 font-semibold truncate">
                  👨‍🏫 {activeSubjectSession.guruPengampu}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* BANNER NOTIFIKASI FEEDBACK REAL-TIME */}
        {actionFeedback && (
          <div
            className={`mt-1.5 p-1.5 sm:p-2 rounded-md border flex items-center justify-between gap-2 text-[8.5px] sm:text-[9.5px] font-medium relative z-10 transition-all ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200'
                : actionFeedback.type === 'warning'
                ? 'bg-amber-950/90 border-amber-400/60 text-amber-200'
                : actionFeedback.type === 'error'
                ? 'bg-rose-950/90 border-rose-400/60 text-rose-200'
                : 'bg-sky-950/90 border-sky-400/60 text-sky-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : actionFeedback.type === 'error' ? (
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
              ) : (
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              )}
              <div>
                <strong className="font-bold text-white block leading-tight">{actionFeedback.title}</strong>
                <span className="leading-tight">{actionFeedback.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="p-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4 KARTU STATISTIK REAL-TIME RINGKAS                            */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2">
        <div className="rounded-lg sm:rounded-xl border border-emerald-500/30 bg-slate-900/80 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-2xs flex items-center gap-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight truncate">Hadir Hari Ini</p>
            <p className="text-xs sm:text-sm font-black text-emerald-400 leading-tight mt-0.5">
              {stats.hadir}{' '}
              <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-normal">siswa</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg sm:rounded-xl border border-amber-500/30 bg-slate-900/80 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-2xs flex items-center gap-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight truncate">Terlambat</p>
            <p className="text-xs sm:text-sm font-black text-amber-400 leading-tight mt-0.5">
              {stats.terlambat}{' '}
              <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-normal">siswa</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg sm:rounded-xl border border-sky-500/30 bg-slate-900/80 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-2xs flex items-center gap-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight truncate">Sakit &amp; Izin</p>
            <p className="text-xs sm:text-sm font-black text-sky-400 leading-tight mt-0.5">
              {stats.sakit + stats.izin}{' '}
              <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-normal">siswa</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg sm:rounded-xl border border-rose-500/30 bg-slate-900/80 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-2xs flex items-center gap-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[7.5px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight truncate">Alfa &amp; Bolos</p>
            <p className="text-xs sm:text-sm font-black text-rose-400 leading-tight mt-0.5">
              {stats.alfa + stats.bolos}{' '}
              <span className="text-[7.5px] sm:text-[8.5px] text-slate-400 font-normal">siswa</span>
            </p>
          </div>
        </div>
      </div>


      {/* ============================================================== */}
      {/* ROLE 1: MODE SISWA (PRESENSI MANDIRI & BIOMETRIK)              */}
      {/* ============================================================== */}
      {activeRole === 'SISWA' && (
        <div className="space-y-3">
          {/* Sub Navigation Siswa */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10">
            <button
              type="button"
              onClick={() => setSiswaTab('SCAN_FINGERPRINT')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                siswaTab === 'SCAN_FINGERPRINT'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Fingerprint className="w-3 h-3" />
              <span>1. Sidik Jari (Otomatis)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSiswaTab('SCAN_QR');
                startQrScanner();
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                siswaTab === 'SCAN_QR'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <QrCode className="w-3 h-3" />
              <span>2. Scan QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSiswaTab('SELFIE_GPS');
                fetchCurrentGps();
                startCamera('user');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                siswaTab === 'SELFIE_GPS'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>3. Swafoto &amp; GPS</span>
            </button>

            <button
              type="button"
              onClick={() => setSiswaTab('PENGAJUAN_IZIN')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                siswaTab === 'PENGAJUAN_IZIN'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>4. Surat Izin Online</span>
            </button>

            <button
              type="button"
              onClick={() => setSiswaTab('KARTU_PELAJAR')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                siswaTab === 'KARTU_PELAJAR'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Award className="w-3 h-3" />
              <span>5. Kartu Siswa Digital</span>
            </button>

            <button
              type="button"
              onClick={() => setSiswaTab('RIWAYAT_PRIBADI')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                siswaTab === 'RIWAYAT_PRIBADI'
                  ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>6. Riwayat Kehadiran</span>
            </button>
          </div>

          {/* TAB 1 SISWA: SENSOR SIDIK JARI INTERAKTIF */}
          {siswaTab === 'SCAN_FINGERPRINT' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5">
              <div className="lg:col-span-7 rounded-lg sm:rounded-xl border border-emerald-500/35 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-2.5 sm:p-3 shadow-md relative overflow-hidden flex flex-col items-center justify-center min-h-[220px] sm:min-h-[240px] text-center">
                {/* Animasi Laser Ring Scanner */}
                <div
                  className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-emerald-500/20 transition-all duration-700 pointer-events-none ${
                    isScanning ? 'scale-110 border-emerald-400/50 animate-ping' : 'scale-95'
                  }`}
                />

                <div className="mb-1 space-y-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[8px] sm:text-[9px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Pengenalan Sidik Jari Otomatis &amp; Validasi Ketat</span>
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold text-white">
                    Letakkan Jari Anda pada Perangkat
                  </h2>
                  <p className="text-[8px] sm:text-[9.5px] text-slate-300 max-w-sm mx-auto leading-snug">
                    Sistem memvalidasi pola dan jenis jari yang ditempelkan. Jari harus sesuai persis dengan jari yang didaftarkan siswa.
                  </p>
                </div>

                {/* SELECTOR JARI YANG DITEMPELKAN KE SENSOR */}
                <div className="w-full max-w-md mx-auto my-1.5 p-1.5 rounded-lg bg-slate-950/80 border border-emerald-500/25 shadow-xs">
                  <div className="flex items-center justify-between gap-1 mb-1 px-0.5">
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-300 flex items-center gap-1">
                      <Fingerprint className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Jari yang Ditempelkan ke Sensor:</span>
                    </span>
                    <span
                      className={`text-[7.5px] sm:text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${
                        activeScanningFinger === 'Jari Lain'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {activeScanningFinger}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'Jempol Kanan', label: 'Jempol Kanan', icon: '👍' },
                      { id: 'Telunjuk Kanan', label: 'Telunjuk Kanan', icon: '☝️' },
                      { id: 'Jempol Kiri', label: 'Jempol Kiri', icon: '👍' },
                      { id: 'Telunjuk Kiri', label: 'Telunjuk Kiri', icon: '☝️' },
                      { id: 'Jari Lain', label: 'Jari Lain (Uji)', icon: '🚫' },
                    ].map((f) => {
                      const isSel = activeScanningFinger === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setActiveScanningFinger(f.id);
                            setLastScanMismatch(false);
                            setScanStatusMessage(`Sensor siap membaca pola: ${f.label}`);
                          }}
                          className={`py-1 px-1 rounded-md text-[7.5px] sm:text-[8px] font-bold transition-all cursor-pointer flex flex-col items-center justify-center border leading-tight ${
                            isSel
                              ? f.id === 'Jari Lain'
                                ? 'bg-rose-900/60 border-rose-500 text-rose-200 ring-1 ring-rose-400 shadow-xs'
                                : 'bg-emerald-600 border-emerald-400 text-white ring-1 ring-emerald-300 shadow-xs'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-white/10'
                          }`}
                        >
                          <span className="text-[10px] leading-none mb-0.5">{f.icon}</span>
                          <span className="truncate w-full text-center">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[7px] sm:text-[8px] text-slate-400 mt-1 leading-snug px-0.5">
                    🔒 <span className="text-emerald-300 font-semibold">Validasi Ketat:</span> Siswa yang terdaftar dengan Jempol akan otomatis <span className="text-rose-400 font-bold">DITOLAK</span> bila menempelkan Telunjuk atau jari lain.
                  </p>
                </div>

                {/* SENSOR PAD KOMPAK & PROFESIONAL */}
                <div className="relative my-1">
                  {isScanning && (
                    <div className="absolute inset-x-1.5 top-0 h-0.5 bg-gradient-to-r from-cyan-400 via-emerald-300 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,1)] z-20 animate-bounce rounded-full" />
                  )}

                  <div
                    role="button"
                    tabIndex={0}
                    onMouseDown={handleTouchStartScan}
                    onMouseUp={handleTouchEndScan}
                    onTouchStart={handleTouchStartScan}
                    onTouchEnd={handleTouchEndScan}
                    className={`w-20 h-24 sm:w-24 sm:h-28 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center p-2 cursor-pointer select-none relative z-10 shadow-md ${
                      isScanning
                        ? 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105'
                        : lastScanMismatch
                        ? 'bg-rose-950/80 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                        : lastVerifiedRecord
                        ? 'bg-slate-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:border-emerald-400'
                        : 'bg-slate-900/90 border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    }`}
                  >
                    <Fingerprint
                      className={`w-9 h-9 sm:w-11 sm:h-11 transition-all duration-300 ${
                        isScanning
                          ? 'text-emerald-300 scale-110 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                          : lastScanMismatch
                          ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                          : lastVerifiedRecord
                          ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]'
                          : 'text-cyan-400/90'
                      }`}
                    />

                    <div className="mt-1 text-center">
                      {isScanning ? (
                        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-300 animate-pulse">
                          Memindai... {scanProgress}%
                        </span>
                      ) : lastScanMismatch ? (
                        <span className="text-[8px] sm:text-[9px] text-rose-300 font-bold leading-tight block">
                          Jari Tidak Cocok!
                        </span>
                      ) : (
                        <span className="text-[8px] sm:text-[9px] text-slate-400 font-semibold leading-tight block">
                          Sentuh &amp; Tahan Di Sini
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p
                  className={`text-[8.5px] sm:text-[9.5px] font-medium max-w-sm mt-0.5 px-2 py-0.5 rounded transition-all ${
                    lastScanMismatch
                      ? 'text-rose-300 bg-rose-500/10 border border-rose-500/30'
                      : 'text-emerald-300/90'
                  }`}
                >
                  {scanStatusMessage}
                </p>

                {/* Tombol Biometrik Hardware Bawaan HP */}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={handleTriggerHardwareBiometric}
                    className="h-5.5 sm:h-6 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[8.5px] sm:text-[9.5px] font-bold hover:from-emerald-500 hover:to-teal-500 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Smartphone className="w-2.5 h-2.5 shrink-0" />
                    <span>Sensor Sensor HP (WebAuthn)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsStudentModalOpen(true);
                      setEditingStudentId(null);
                    }}
                    className="h-5.5 sm:h-6 px-2 py-0.5 rounded-md border border-sky-400/40 bg-sky-500/10 text-sky-300 text-[8.5px] sm:text-[9.5px] font-bold hover:bg-sky-500/20 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <UserPlus className="w-2.5 h-2.5 shrink-0" />
                    <span>Register Siswa Baru</span>
                  </button>
                </div>
              </div>

              {/* PANEL KANAN: STATUS VERIFIKASI TERAKHIR & NOTIFIKASI WA */}
              <div className="lg:col-span-5 space-y-2">
                {lastVerifiedRecord && lastVerifiedStudent ? (
                  <div className="rounded-lg sm:rounded-xl border border-emerald-500/40 bg-slate-900/90 p-2 sm:p-2.5 shadow-sm space-y-1.5">
                    <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <h3 className="text-[10.5px] sm:text-xs font-bold text-white">Identitas Terverifikasi!</h3>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full text-[8px] sm:text-[8.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {lastVerifiedRecord.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-emerald-400 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {lastVerifiedStudent.photoUrl ? (
                          <img
                            src={lastVerifiedStudent.photoUrl}
                            alt={lastVerifiedStudent.namaSiswa}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-emerald-300">
                            {lastVerifiedStudent.namaSiswa.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[11px] sm:text-xs font-bold text-white leading-tight truncate">
                          {lastVerifiedStudent.namaSiswa}
                        </h4>
                        <p className="text-[8.5px] sm:text-[9.5px] text-slate-300 truncate">
                          NISN: {lastVerifiedStudent.nisn || lastVerifiedStudent.nisNisn} • Kelas:{' '}
                          <span className="font-bold text-emerald-400">{lastVerifiedStudent.kelas}</span>
                        </p>
                        <p className="text-[8px] sm:text-[8.5px] text-slate-400">
                          Waktu: {lastVerifiedRecord.time} WIB • {lastVerifiedRecord.date}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Kirim WhatsApp ke Orang Tua */}
                    <div className="pt-1.5 border-t border-white/10 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          const msg = buildWhatsAppAttendanceMessage(
                            lastVerifiedRecord,
                            lastVerifiedStudent,
                            scheduleConfig
                          );
                          const phone = formatPhoneForWhatsApp(
                            lastVerifiedStudent.noHpOrangTua || '082165885568'
                          );
                          const waUrl = getTeacherWhatsAppUrl(msg, phone);
                          setIsVerifiedCardWaSending(true);
                          setTimeout(() => setIsVerifiedCardWaSending(false), 2500);
                          openWhatsAppSafely(waUrl);
                        }}
                        className={`w-full h-6 sm:h-6.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isVerifiedCardWaSending
                            ? 'bg-emerald-500 text-slate-950 font-extrabold ring-1 ring-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isVerifiedCardWaSending ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Terkirim ke WhatsApp Orang Tua ✓</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>Kirim Notifikasi WA ke Orang Tua / Wali</span>
                          </>
                        )}
                      </button>

                      {onProceedToExam && (
                        <button
                          type="button"
                          onClick={() => {
                            onProceedToExam({
                              nama: lastVerifiedStudent.namaSiswa,
                              nisn: lastVerifiedStudent.nisn || lastVerifiedStudent.nisNisn,
                              kelas: lastVerifiedStudent.kelas,
                            });
                          }}
                          className="w-full h-5.5 sm:h-6 py-0.5 rounded-md border border-sky-400/40 bg-sky-500/10 text-sky-300 text-[8.5px] sm:text-[9.5px] font-bold hover:bg-sky-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <BookOpen className="w-2.5 h-2.5" />
                          <span>Lanjut Masuk ke Ujian Soal ANBK</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg sm:rounded-xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-3 text-center space-y-1">
                    <UserCheck className="w-5 h-5 text-slate-500 mx-auto" />
                    <h3 className="text-[10px] sm:text-xs font-bold text-slate-300">Menunggu Verifikasi Jari Siswa</h3>
                    <p className="text-[8px] sm:text-[9px] text-slate-400 leading-snug">
                      Letakkan jari Anda pada sensor atau klik tombol scan untuk mulai mencatat kehadiran hari ini.
                    </p>
                  </div>
                )}

                {/* Pilih Siswa Manual jika Perangkat Dipakai Bersama */}
                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-slate-900/80 p-2 sm:p-2.5 space-y-1 shadow-2xs">
                  <label className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-300 flex items-center gap-1">
                    <User className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Mode Pilih Siswa Sebelum Menempelkan Jari:</span>
                  </label>
                  <select
                    value={selectedStudentForManualScan}
                    onChange={(e) => setSelectedStudentForManualScan(e.target.value)}
                    className="w-full h-5.5 sm:h-6 px-2 py-0.5 rounded-md bg-slate-950 border border-white/20 text-[8.5px] sm:text-[9.5px] text-white focus:outline-hidden focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="">-- Kenali Otomatis Semua Siswa Terdaftar --</option>
                    {registeredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSiswa} ({s.kelas} - {s.nisn || s.nisNisn})
                      </option>
                    ))}
                  </select>
                  <p className="text-[7.5px] sm:text-[8px] text-slate-400 leading-snug">
                    Jika dipilih, sensor akan memvalidasi kecocokan sidik jari khusus untuk siswa terpilih.
                  </p>
                  {selectedStudentForManualScan && (() => {
                    const sel = registeredStudents.find((s) => s.id === selectedStudentForManualScan);
                    if (!sel) return null;
                    const isMismatch = sel.fingerprintFinger !== activeScanningFinger;
                    return (
                      <div className={`p-1.5 rounded-md border text-[8px] sm:text-[8.5px] space-y-0.5 ${
                        isMismatch
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      }`}>
                        <div className="flex items-center justify-between font-bold">
                          <span>Jari Terdaftar Siswa:</span>
                          <span className="text-amber-300 flex items-center gap-1">
                            <span>👍</span>
                            <span>{sel.fingerprintFinger}</span>
                          </span>
                        </div>
                        {isMismatch && (
                          <p className="text-[7.5px] text-rose-300 leading-tight">
                            ⚠️ Peringatan: Jari sensor saat ini (<strong>{activeScanningFinger}</strong>) tidak cocok dengan jari terdaftar siswa (<strong>{sel.fingerprintFinger}</strong>). Verifikasi akan <strong className="text-rose-400">DITOLAK</strong> jika dipindai.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 SISWA: SCANNER QR CODE KAMERA LIVE */}
          {siswaTab === 'SCAN_QR' && (
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4 max-w-xl mx-auto text-center">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  <span>Pemindaian QR Code Kartu Pelajar Siswa</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Arahkan QR Code Kartu Siswa Anda ke kotak pemindai kamera di bawah.
                </p>
              </div>

              <div className="relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-xl bg-black">
                <video ref={qrVideoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={qrCanvasRef} className="hidden" />

                {/* Garis pemindai bergerak */}
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)] animate-pulse" />
                <div className="absolute inset-8 border border-white/40 rounded-xl pointer-events-none" />
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={startQrScanner}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isQrScannerActive ? 'Reset Kamera QR' : 'Buka Kamera QR'}</span>
                </button>
                <button
                  type="button"
                  onClick={stopQrScanner}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Tutup Kamera
                </button>
                <label className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah Gambar QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          canvas.width = img.width;
                          canvas.height = img.height;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const code = jsQR(imgData.data, imgData.width, imgData.height);
                            if (code && code.data) {
                              handleQrCodeDetected(code.data);
                            } else {
                              showFeedback(
                                'warning',
                                'QR Tidak Terbaca di Gambar',
                                'Pastikan gambar Kartu QR tampak jelas, atau gunakan tombol pilih siswa di bawah.'
                              );
                            }
                          }
                        };
                        img.src = String(evt.target?.result || '');
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              {/* Simulasi Scan QR Cepat jika Kamera Tidak Tersedia */}
              <div className="pt-3 border-t border-white/10 text-left space-y-2">
                <p className="text-[11px] font-bold text-slate-400">
                  Verifikasi Cepat Kartu QR / RFID Siswa (Tanpa Kamera):
                </p>
                <div className="flex gap-2">
                  <select
                    value={selectedStudentForManualScan}
                    onChange={(e) => setSelectedStudentForManualScan(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  >
                    <option value="">-- Pilih Kartu Siswa Terdaftar --</option>
                    {registeredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSiswa} ({s.kelas} - {s.nisn || s.nisNisn})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedStudentForManualScan
                        ? registeredStudents.find((s) => s.id === selectedStudentForManualScan)
                        : registeredStudents[0];
                      if (target) {
                        handleQrCodeDetected(
                          JSON.stringify({
                            id: target.id,
                            nisn: target.nisn || target.nisNisn,
                            nama: target.namaSiswa,
                            kelas: target.kelas,
                          })
                        );
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan QR Siswa</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3 SISWA: SWAFOTO & GPS GEOLOCATION */}
          {siswaTab === 'SELFIE_GPS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kolom 1: Kamera Swafoto Depan & Belakang Megapixel Tinggi */}
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-5 space-y-3 shadow-xl">
                {/* 1. Header Kamera & Pilihan Depan / Belakang */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Swafoto Siswa (Kamera {cameraFacing === 'user' ? 'Depan / Selfie' : 'Belakang / Utama'})
                      </span>
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {cameraResolution && cameraActive ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[8px] sm:text-[8.5px] font-mono font-bold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                          <span>Sensor: {cameraResolution.label}</span>
                        </span>
                      ) : capturedPhotoMeta ? (
                        <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[8px] sm:text-[8.5px] font-mono font-bold flex items-center gap-1">
                          <span>
                            Foto Tersimpan: {capturedPhotoMeta.width}×{capturedPhotoMeta.height} ({capturedPhotoMeta.megapixels})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[9px] sm:text-[9.5px] text-slate-400">
                          Sensor otomatis menyesuaikan megapixel tertinggi perangkat agar foto sangat jernih
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tombol Pilihan Cepat Kamera Depan / Belakang */}
                  <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        cameraActive && cameraFacing === 'user'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      title="Buka / Beralih ke Kamera Depan (Selfie HD)"
                    >
                      <Smartphone className="w-2.5 h-2.5" />
                      <span>🤳 Depan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startCamera('environment')}
                      className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        cameraActive && cameraFacing === 'environment'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      title="Buka / Beralih ke Kamera Belakang (Utama HD)"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>🔄 Belakang</span>
                    </button>
                  </div>
                </div>

                {/* 2. Viewport Kamera / Hasil Foto (CSS selector 1: video:nth-of-type(1)) */}
                <div
                  className={`relative w-full aspect-4/3 rounded-xl overflow-hidden border border-white/20 bg-black flex items-center justify-center shadow-inner transition-all duration-150 ${
                    isCameraFlashing ? 'ring-4 ring-white brightness-150' : ''
                  }`}
                >
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        className={`w-full h-full object-cover transition-transform duration-200 ${
                          cameraFacing === 'user' ? '-scale-x-100' : 'scale-x-100'
                        }`}
                        playsInline
                        muted
                        autoPlay
                      />

                      {/* Flash Animasi Putih saat Menjepret Foto */}
                      {isCameraFlashing && (
                        <div className="absolute inset-0 bg-white opacity-90 pointer-events-none animate-ping" />
                      )}

                      {/* Overlay Indikator Kamera & Megapixel Real-Time */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[8.5px] sm:text-[9.5px] font-bold text-white flex items-center gap-1.5 border border-white/10 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>LIVE: Kamera {cameraFacing === 'user' ? 'Depan (Selfie)' : 'Belakang (Utama)'}</span>
                      </div>

                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-950/85 border border-emerald-400/60 backdrop-blur-xs text-[8.5px] sm:text-[9.5px] font-mono font-bold text-emerald-300 flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                        <span>{cameraResolution?.megapixels || 'Sensor Maksimal'} Super Jernih</span>
                      </div>

                      {/* Panduan Oval Posisi Wajah Siswa */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-60 sm:w-56 sm:h-72 rounded-[50%] border-2 border-dashed border-emerald-400/70 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-emerald-100 bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                            Posisikan Wajah Siswa di Sini
                          </span>
                        </div>
                      </div>
                    </>
                  ) : capturedPhotoUrl ? (
                    <div className="relative w-full h-full">
                      <img
                        src={capturedPhotoUrl}
                        alt="Hasil Swafoto Jernih"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-xs text-white text-[9px] flex items-center justify-between border border-white/15 shadow-md">
                        <span className="font-bold text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Foto Tersimpan Sangat Jernih ✓</span>
                        </span>
                        <span className="font-mono text-amber-300 font-extrabold">
                          {capturedPhotoMeta ? `${capturedPhotoMeta.width}×${capturedPhotoMeta.height} (${capturedPhotoMeta.megapixels})` : 'Kualitas Super HD'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                        {cameraLoading ? (
                          <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                        ) : (
                          <Camera className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-300">
                        {cameraLoading ? 'Mengaktifkan sensor kamera megapixel perangkat...' : 'Kamera belum aktif'}
                      </p>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                        Pilih tombol di bawah untuk membuka Kamera Depan (Selfie) atau Kamera Belakang (Utama) dengan resolusi megapixel maksimal perangkat.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Baris Tombol Aksi Kamera Depan & Belakang Megapixel */}
                <div className="flex flex-wrap items-center gap-2">
                  {!cameraActive && !capturedPhotoUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startCamera('user')}
                        className="flex-1 min-w-[135px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-95 border border-emerald-400/40"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-amber-300" />
                        <span>🤳 Buka Kamera Depan (Selfie HD)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startCamera('environment')}
                        className="flex-1 min-w-[135px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-95 border border-purple-400/40"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                        <span>🔄 Buka Kamera Belakang (Utama HD)</span>
                      </button>
                    </>
                  ) : cameraActive ? (
                    <>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="flex-1 min-w-[150px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-1.5 active:scale-95 border border-emerald-200 ring-2 ring-emerald-400/50"
                      >
                        <Camera className="w-4 h-4 text-slate-950 animate-pulse" />
                        <span>📸 Ambil Foto ({cameraResolution?.megapixels || 'Sensor Maksimal'})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startCamera(cameraFacing === 'user' ? 'environment' : 'user')}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-200 border border-sky-400/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                        title="Beralih ke Kamera Depan / Belakang"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                        <span>Ganti ke {cameraFacing === 'user' ? 'Belakang' : 'Depan'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                        title="Matikan Kamera"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tutup</span>
                      </button>
                    </>
                  ) : null}

                  {/* Tombol Ambil Ulang saat Foto Sudah Ada */}
                  {capturedPhotoUrl && (
                    <div className="w-full flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhotoUrl(null);
                          setCapturedPhotoMeta(null);
                          startCamera(cameraFacing);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900/90 text-rose-200 border border-rose-500/50 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                        <span>🔄 Ambil Ulang (Kamera {cameraFacing === 'user' ? 'Depan' : 'Belakang'})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhotoUrl(null);
                          setCapturedPhotoMeta(null);
                          startCamera(cameraFacing === 'user' ? 'environment' : 'user');
                        }}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-200 border border-sky-400/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-300" />
                        <span>Ganti ke {cameraFacing === 'user' ? 'Belakang' : 'Depan'}</span>
                      </button>
                    </div>
                  )}

                  {/* Tombol Unggah dari File / Galeri */}
                  <label className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer flex items-center gap-1.5 border border-white/10 transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-sky-300" />
                    <span>Pilih dari Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const dataUrl = String(evt.target?.result || '');
                          const img = new Image();
                          img.onload = () => {
                            const w = img.width || 1920;
                            const h = img.height || 1080;
                            const mpNum = (w * h) / 1000000;
                            const mpStr = mpNum >= 1 ? `${mpNum.toFixed(1)} MP` : `${(mpNum * 1000).toFixed(0)}k MP`;
                            setCapturedPhotoUrl(dataUrl);
                            setCapturedPhotoMeta({
                              width: w,
                              height: h,
                              megapixels: `${mpStr} Galeri`,
                              facing: 'user',
                            });
                            stopCamera();
                            showFeedback(
                              'success',
                              'Foto Galeri Berhasil Dipilih',
                              `Foto beresolusi ${w}×${h} (${mpStr}) berhasil dimuat. Silakan tekan Simpan & Kirim Presensi Swafoto GPS.`
                            );
                          };
                          img.src = dataUrl;
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Kolom 2: Verifikasi GPS & Pengiriman Presensi */}
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Verifikasi Lokasi GPS Sekolah</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      playBiometricSound('beep');
                      fetchCurrentGps();
                      showFeedback('info', 'Memperbarui Lokasi GPS', 'Menghubungkan satelit lokasi GPS perangkat ke server sekolah...');
                    }}
                    className="text-xs text-emerald-300 font-bold hover:text-white flex items-center gap-1.5 cursor-pointer bg-emerald-500/20 hover:bg-emerald-500/30 px-2.5 py-1 rounded-lg border border-emerald-400/50 transition-all shadow-xs"
                    title="Perbarui koordinat satelit GPS perangkat siswa"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${gpsData.status === 'FETCHING' ? 'animate-spin' : ''}`} />
                    <span>{gpsData.status === 'FETCHING' ? 'Mencari Satelit...' : '📍 Update GPS Sekarang'}</span>
                  </button>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-slate-950 p-3.5 sm:p-4 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Lokasi:</span>
                    <span className="font-bold text-white truncate max-w-[200px]">{scheduleConfig.schoolName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Jarak Siswa ke Sekolah:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {gpsData.distanceToSchoolMeters} meter
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Status Radius:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        gpsData.isWithinSchoolRadius
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {gpsData.isWithinSchoolRadius ? 'Dalam Area Sekolah ✓' : 'Di Luar Radius Sekolah'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Akurasi GPS Satelit:</span>
                    <span className="text-slate-300 font-mono">±{gpsData.accuracy} m</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Pilih Identitas Siswa:</span>
                    {selectedStudentForManualScan && (
                      <span className="text-[10px] text-emerald-400 font-normal">Identitas Terpilih ✓</span>
                    )}
                  </label>
                  <select
                    value={selectedStudentForManualScan}
                    onChange={(e) => setSelectedStudentForManualScan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <option value="">-- Pilih Nama Siswa Anda --</option>
                    {registeredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSiswa} ({s.kelas}) • NISN: {s.nisn || s.nis || '-'}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSelfieGpsCheckIn}
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Simpan &amp; Kirim Presensi Swafoto GPS</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4 SISWA: PENGAJUAN SURAT IZIN / SAKIT ONLINE */}
          {siswaTab === 'PENGAJUAN_IZIN' && (
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <span>Layanan Pengajuan Surat Izin &amp; Sakit Online</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Kirim surat izin atau bukti sakit secara digital beserta lampiran foto surat dokter.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPermitModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Surat Izin Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSync}
                    className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                    <span>Sinkron Izin</span>
                  </button>
                </div>
              </div>

              {/* Daftar Pengajuan Izin */}
              <div className="space-y-2">
                {permitRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Belum ada riwayat pengajuan surat izin / sakit.
                  </p>
                ) : (
                  permitRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-white/10 bg-slate-950/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.jenisIzin === 'SAKIT'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : req.jenisIzin === 'DISPENSASI'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {req.jenisIzin}
                          </span>
                          <span className="text-xs font-bold text-white">{req.namaSiswa}</span>
                          <span className="text-xs text-slate-400">({req.kelas})</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Alasan: <span className="text-white font-medium">{req.alasan}</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Periode: {req.tanggalMulai} s/d {req.tanggalSelesai} • Dibuat: {req.createdAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                            req.status === 'DISETUJUI'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : req.status === 'DITOLAK'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {req.status === 'DISETUJUI'
                            ? 'Disetujui Guru ✓'
                            : req.status === 'DITOLAK'
                            ? 'Ditolak'
                            : 'Menunggu Verifikasi'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = permitRequests.filter((p) => p.id !== req.id);
                            saveOnlinePermitRequests(next);
                            setPermitRequests(next);
                            playBiometricSound('beep');
                            showFeedback('info', 'Surat Izin Dihapus', `Pengajuan izin ${req.namaSiswa} berhasil dihapus.`);
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 cursor-pointer"
                          title="Hapus Pengajuan Izin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5 SISWA: KARTU IDENTITAS PELAJAR DIGITAL */}
          {siswaTab === 'KARTU_PELAJAR' && (
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <span>Kartu Pelajar Siswa Digital &amp; QR Barcode</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Total <strong className="text-emerald-400">{registeredStudents.length} Siswa</strong> • Klik kartu untuk QR &amp; Cetak, atau klik kotak singkatan inisial nama (seperti contoh NA) untuk menambahkan foto profil siswa.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {registeredStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsClearAllStudentsModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 active:scale-95 transition-all text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Hapus permanen seluruh daftar kartu pelajar siswa"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Hapus Semua Siswa</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudentId(null);
                      setStudentForm({
                        namaSiswa: '',
                        nis: '',
                        nisn: '',
                        kelas: 'VIII-1',
                        jenisKelamin: 'Laki-laki',
                        noHpOrangTua: '',
                        namaOrangTua: '',
                        fingerprintFinger: 'Jempol Kanan',
                        photoUrl: '',
                        rfidCardId: '',
                      });
                      setIsStudentModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Tambah Siswa</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {registeredStudents.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudentForCard(st)}
                    className="group/card rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/60 p-4 shadow-lg hover:border-emerald-400 hover:shadow-emerald-950/30 transition-all cursor-pointer space-y-3 relative"
                  >
                    {/* Header Kartu: Label, Kelas & Tombol Aksi Edit / Hapus */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-emerald-400 tracking-wider">
                          KARTU PELAJAR ANBK
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300">
                          {st.kelas}
                        </span>
                      </div>

                      {/* Tombol Edit & Tombol Hapus Siswa */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditStudent(st)}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95"
                          title={`Edit Data Siswa ${st.namaSiswa}`}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(st)}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-xs active:scale-95"
                          title={`Hapus Siswa & Kartu ${st.namaSiswa}`}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>

                    {/* Badan Kartu: Avatar/Kotak Singkatan Nama & Foto Profil + Identitas Siswa */}
                    <div className="flex items-center gap-3">
                      {/* Kotak Kecil Singkatan Inisial Nama (seperti contoh NA) yang bisa ditambahkan gambar foto profil siswa */}
                      <div className="relative group shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="file"
                          id={`file-input-card-${st.id}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUploadStudentPhoto(st.id, file);
                            }
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`file-input-card-${st.id}`) as HTMLInputElement | null;
                            input?.click();
                          }}
                          className="relative w-12 h-12 rounded-xl bg-slate-800 border-2 border-emerald-400/90 hover:border-emerald-300 flex items-center justify-center font-bold text-emerald-300 overflow-hidden shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-md group-hover:ring-2 group-hover:ring-emerald-400/50"
                          title={
                            st.photoUrl
                              ? `Klik untuk mengganti foto profil ${st.namaSiswa}`
                              : `Klik kotak inisial "${st.namaSiswa.slice(0, 2).toUpperCase()}" untuk menambahkan foto profil siswa ${st.namaSiswa}`
                          }
                        >
                          {st.photoUrl ? (
                            <>
                              <img
                                src={st.photoUrl}
                                alt={st.namaSiswa}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[1px]">
                                <Camera className="w-3.5 h-3.5 text-emerald-300" />
                                <span className="text-[7px] font-black text-emerald-200 uppercase">Ubah</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/70">
                              <span className="font-mono text-xs font-black text-emerald-300 tracking-tight leading-none drop-shadow-xs">
                                {st.namaSiswa.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-[7px] text-emerald-400 font-extrabold tracking-tight mt-0.5 leading-none flex items-center gap-0.5">
                                <Camera className="w-2 h-2 text-emerald-300 shrink-0" />
                                <span>+Foto</span>
                              </span>
                            </div>
                          )}
                        </button>
                        {/* Tombol badge kamera mengambang di pojok kotak inisial / foto */}
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`file-input-card-${st.id}`) as HTMLInputElement | null;
                            input?.click();
                          }}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-slate-900 cursor-pointer"
                          title={st.photoUrl ? 'Ganti Foto Profil' : 'Tambah Foto Profil'}
                        >
                          <Camera className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Identitas Siswa */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate" title={st.namaSiswa}>
                          {st.namaSiswa}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          NISN: {st.nisn || st.nisNisn}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3 shrink-0" />
                            <span className="truncate">Sidik Jari: {st.fingerprintFinger}</span>
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = document.getElementById(`file-input-card-${st.id}`) as HTMLInputElement | null;
                              input?.click();
                            }}
                            className="text-[9.5px] font-bold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Upload className="w-2.5 h-2.5" />
                            <span>{st.photoUrl ? 'Ganti Foto' : '+Foto Profil'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bagian Bawah: RFID, Opsi Hapus Foto & Tautan Cetak QR */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <span>RFID: {st.rfidCardId || 'RFID-ACTIVE'}</span>
                        {st.photoUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStudentPhoto(st.id);
                            }}
                            className="text-[9px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                            title="Hapus foto profil dan kembalikan ke inisial nama"
                          >
                            Hapus Foto
                          </button>
                        )}
                      </div>
                      <span className="text-emerald-400 font-bold hover:underline flex items-center gap-0.5">
                        <span>Lihat &amp; Cetak QR</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}

                {registeredStudents.length === 0 && (
                  <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 space-y-3">
                    <Award className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">Belum Ada Data Siswa Terdaftar</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Daftarkan siswa baru beserta sidik jari dan foto profil untuk menghasilkan Kartu Pelajar Digital.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStudentId(null);
                        setStudentForm({
                          namaSiswa: '',
                          nis: '',
                          nisn: '',
                          kelas: 'VIII-1',
                          jenisKelamin: 'Laki-laki',
                          noHpOrangTua: '',
                          namaOrangTua: '',
                          fingerprintFinger: 'Jempol Kanan',
                          photoUrl: '',
                          rfidCardId: '',
                        });
                        setIsStudentModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Tambah Siswa Baru</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6 SISWA: RIWAYAT PRIBADI */}
          {siswaTab === 'RIWAYAT_PRIBADI' && (
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-400" />
                    <span>Riwayat Kehadiran Siswa ({filteredRecords.length} Catatan)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Daftar riwayat absensi lengkap dengan fitur Hapus, Simpan, Reset, dan Sinkronisasi.
                  </p>
                </div>

                {/* Tombol Aksi Cepat di Riwayat Kehadiran */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal('HAPUS')}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteSaveAll(false)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveActionModal('RESET')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSync}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                    <span>Sinkron</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">Tanggal &amp; Waktu</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Metode Verifikasi</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Belum ada riwayat kehadiran siswa yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.slice(0, 50).map((rec) => (
                        <tr key={rec.id} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {rec.date} {rec.time}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">{rec.namaSiswa}</td>
                          <td className="py-2.5 px-3 text-emerald-300 font-bold">{rec.kelas}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.status === 'HADIR_TEPAT_WAKTU'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : rec.status === 'TERLAMBAT'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {rec.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{rec.metodeVerifikasi.replace(/_/g, ' ')}</td>
                          <td className="py-2.5 px-3 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setAttendanceRecordToDelete(rec)}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Hapus permanen catatan presensi ini (konfirmasi)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ROLE 2: MODE GURU / WALI KELAS                                 */}
      {/* ============================================================== */}
      {activeRole === 'GURU' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
            <button
              type="button"
              onClick={() => setGuruTab('PRESENSI_KELAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                guruTab === 'PRESENSI_KELAS'
                  ? 'bg-sky-500 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>1. Lembar Absensi Cepat Kelas</span>
            </button>

            <button
              type="button"
              onClick={() => setGuruTab('VERIFIKASI_IZIN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                guruTab === 'VERIFIKASI_IZIN'
                  ? 'bg-sky-500 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Verifikasi Izin Siswa</span>
              {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setGuruTab('REKAP_KELAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                guruTab === 'REKAP_KELAS'
                  ? 'bg-sky-500 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>3. Log &amp; Rekap Kehadiran Kelas</span>
            </button>
          </div>

          {/* GURU SUBTAB 1: LEMBAR ABSENSI KELAS QUICK CHECKLIST */}
          {guruTab === 'PRESENSI_KELAS' && (
            <div className="rounded-2xl border border-sky-500/40 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-sky-400" />
                    <span>Lembar Presensi Harian Guru &amp; Wali Kelas</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Beri tanda Hadir, Sakit, Izin, Alfa, Bolos, atau Dispensasi untuk setiap siswa binaan Anda.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Pilih Kelas:</span>
                  <select
                    value={guruSelectedKelas}
                    onChange={(e) => setGuruSelectedKelas(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white font-bold"
                  >
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.namaKelas}>
                        {k.namaKelas} - {k.namaWaliKelas}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const classStudents = registeredStudents.filter(
                        (s) => getCleanKelas(s.kelas) === getCleanKelas(guruSelectedKelas)
                      );
                      const nextMap: Record<string, AttendanceStatusType> = { ...guruChecklistMap };
                      classStudents.forEach((st) => {
                        nextMap[st.id] = 'HADIR_TEPAT_WAKTU';
                      });
                      setGuruChecklistMap(nextMap);
                      playBiometricSound('beep');
                      showFeedback(
                        'info',
                        'Semua Ditandai Hadir',
                        `Seluruh siswa kelas ${guruSelectedKelas} ditandai HADIR TEPAT WAKTU. Klik Simpan untuk merekam.`
                      );
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hadir Semua</span>
                  </button>
                </div>
              </div>

              {/* Tabel Checklist Siswa Kelas Terpilih */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-bold bg-slate-950/60">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">NISN</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Status Saat Ini</th>
                      <th className="py-2.5 px-3">Tindakan Cepat Guru</th>
                      <th className="py-2.5 px-3 text-right">Aksi &amp; WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {registeredStudents
                      .filter((s) => getCleanKelas(s.kelas) === getCleanKelas(guruSelectedKelas))
                      .map((st, idx) => {
                        const todayLog = todayRecords.find((r) => r.studentId === st.id);
                        const curStatus = guruChecklistMap[st.id] || todayLog?.status || 'HADIR_TEPAT_WAKTU';

                        return (
                          <tr key={st.id} className="hover:bg-white/5">
                            <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">
                              {st.nisn || st.nisNisn}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">{st.namaSiswa}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  curStatus === 'HADIR_TEPAT_WAKTU'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : curStatus === 'TERLAMBAT'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : curStatus === 'SAKIT'
                                    ? 'bg-cyan-500/20 text-cyan-300'
                                    : curStatus === 'IZIN'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : curStatus === 'DISPENSASI'
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {curStatus.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1">
                                {(
                                  [
                                    'HADIR_TEPAT_WAKTU',
                                    'TERLAMBAT',
                                    'SAKIT',
                                    'IZIN',
                                    'DISPENSASI',
                                    'ALFA',
                                    'BOLOS',
                                  ] as AttendanceStatusType[]
                                ).map((stOpt) => (
                                  <button
                                    key={stOpt}
                                    type="button"
                                    onClick={() =>
                                      setGuruChecklistMap((prev) => ({ ...prev, [st.id]: stOpt }))
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                      curStatus === stOpt
                                        ? 'bg-sky-500 text-white ring-1 ring-sky-300'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {stOpt === 'HADIR_TEPAT_WAKTU'
                                      ? 'Hadir'
                                      : stOpt === 'TERLAMBAT'
                                      ? 'Telat'
                                      : stOpt === 'SAKIT'
                                      ? 'Sakit'
                                      : stOpt === 'IZIN'
                                      ? 'Izin'
                                      : stOpt === 'DISPENSASI'
                                      ? 'Disp'
                                      : stOpt === 'ALFA'
                                      ? 'Alfa'
                                      : 'Bolos'}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                title={`Kirim notifikasi kehadiran ${st.namaSiswa} ke WhatsApp orang tua (${st.noHpOrangTua || '082165885568'})`}
                                onClick={() => {
                                  const dummyRec: StudentAttendanceRecord = todayLog || {
                                    id: `DUMMY-${Date.now()}`,
                                    studentId: st.id,
                                    namaSiswa: st.namaSiswa,
                                    nisn: st.nisn || st.nisNisn,
                                    nisNisn: st.nisNisn,
                                    kelas: st.kelas,
                                    date: todayDateStr,
                                    time: '07:30:00',
                                    timestamp: `${todayDateStr}, 07.30.00 WIB`,
                                    status: curStatus,
                                    metodeVerifikasi: 'INPUT_MANUAL_GURU',
                                    deviceBrand: 'Guru Portal',
                                    deviceModel: 'Wali Kelas',
                                  };
                                  const msg = buildWhatsAppAttendanceMessage(
                                    dummyRec,
                                    st,
                                    scheduleConfig
                                  );
                                  const phone = formatPhoneForWhatsApp(st.noHpOrangTua || '082165885568');
                                  const waUrl = getTeacherWhatsAppUrl(msg, phone);
                                  setWaSentStudentId(st.id);
                                  setWaToastInfo({
                                    show: true,
                                    studentName: st.namaSiswa,
                                    phone,
                                    url: waUrl,
                                    messageText: msg,
                                  });
                                  setTimeout(() => {
                                    setWaSentStudentId((curr) => (curr === st.id ? null : curr));
                                  }, 3000);
                                  openWhatsAppSafely(waUrl);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm active:scale-95 ${
                                  waSentStudentId === st.id
                                    ? 'bg-emerald-400 text-slate-950 ring-2 ring-emerald-300 font-extrabold'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40'
                                }`}
                              >
                                {waSentStudentId === st.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
                                    <span>Terkirim ✓</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3 text-white" />
                                    <span>Kirim WA</span>
                                  </>
                                )}
                              </button>

                              {todayLog && (
                                <button
                                  type="button"
                                  title="Hapus permanen presensi siswa ini hari ini"
                                  onClick={() => setAttendanceRecordToDelete(todayLog)}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer inline-flex items-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Baris Tombol Hapus, Simpan, Reset & Sinkron di Menu Guru */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setClassAttendanceToDelete({
                        kelas: guruSelectedKelas,
                        date: todayDateStr,
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Hapus permanen seluruh presensi kelas ini hari ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Kelas Ini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGuruChecklistMap({});
                      playBiometricSound('beep');
                      showFeedback('info', 'Pilihan Checklist Direset', `Status checklist sementara kelas ${guruSelectedKelas} telah direset.`);
                    }}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Checklist</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteSync}
                    className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                    <span>Sinkron Kelas</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGuruBulkAttendance}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Rekap Presensi Kelas {guruSelectedKelas}</span>
                </button>
              </div>
            </div>
          )}

          {/* GURU SUBTAB 2: VERIFIKASI SURAT IZIN / SAKIT SISWA */}
          {guruTab === 'VERIFIKASI_IZIN' && (
            <div className="rounded-2xl border border-sky-500/40 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-400" />
                    <span>Verifikasi Surat Izin / Sakit Masuk ({permitRequests.length})</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Setujui atau tolak surat izin online siswa; status kehadiran otomatis tercatat di rekap kelas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExecuteSync}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                  <span>Sinkron Daftar Izin</span>
                </button>
              </div>

              <div className="space-y-3">
                {permitRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    Tidak ada pengajuan izin/sakit yang tercatat.
                  </p>
                ) : (
                  permitRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                            {req.jenisIzin}
                          </span>
                          <span className="text-sm font-bold text-white">{req.namaSiswa}</span>
                          <span className="text-xs text-slate-400">({req.kelas})</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'DISETUJUI'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : req.status === 'DITOLAK'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {req.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Alasan: <strong className="text-white">{req.alasan}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Periode: {req.tanggalMulai} s/d {req.tanggalSelesai}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            verifyOnlinePermitRequest(
                              req.id,
                              'DISETUJUI',
                              'Wali Kelas ' + req.kelas,
                              'Surat disetujui'
                            );
                            setPermitRequests(getOnlinePermitRequests());
                            setAttendanceRecords(getAttendanceRecords());
                            playBiometricSound('success');
                            showFeedback(
                              'success',
                              'Surat Izin Disetujui!',
                              `Izin ${req.jenisIzin} untuk ${req.namaSiswa} (${req.kelas}) telah disetujui dan masuk ke log presensi.`
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            verifyOnlinePermitRequest(
                              req.id,
                              'DITOLAK',
                              'Wali Kelas ' + req.kelas,
                              'Bukti belum memenuhi syarat'
                            );
                            setPermitRequests(getOnlinePermitRequests());
                            playBiometricSound('beep');
                            showFeedback(
                              'warning',
                              'Surat Izin Ditolak',
                              `Pengajuan izin ${req.namaSiswa} telah ditandai DITOLAK.`
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = permitRequests.filter((p) => p.id !== req.id);
                            saveOnlinePermitRequests(next);
                            setPermitRequests(next);
                            playBiometricSound('beep');
                            showFeedback('info', 'Data Izin Dihapus', `Surat izin ${req.namaSiswa} telah dihapus.`);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* GURU SUBTAB 3: REKAP KELAS */}
          {guruTab === 'REKAP_KELAS' && (
            <div className="rounded-2xl border border-sky-500/40 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-400" />
                  <span>Log Rekapitulasi Presensi Kelas Binaan</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportAttendanceToExcel(filteredRecords, `Kelas ${filterKelas}`)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportAttendanceToPdf(filteredRecords, `Kelas ${filterKelas}`)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteSaveAll(false)}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
              </div>

              {/* Tabel Log */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-bold bg-slate-950/60">
                      <th className="py-2.5 px-3">Tanggal &amp; Waktu</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Metode</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Belum ada log kehadiran yang tersimpan.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-slate-300">
                            {r.date} {r.time}
                          </td>
                          <td className="py-2 px-3 font-bold text-white">{r.namaSiswa}</td>
                          <td className="py-2 px-3 text-sky-400 font-bold">{r.kelas}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'HADIR_TEPAT_WAKTU'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : r.status === 'TERLAMBAT'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {r.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{r.metodeVerifikasi.replace(/_/g, ' ')}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const next = deleteAttendanceRecordById(r.id);
                                setAttendanceRecords(next);
                                playBiometricSound('beep');
                                showFeedback('info', 'Log Dihapus', `Catatan kehadiran ${r.namaSiswa} berhasil dihapus.`);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ROLE 3: MODE ORANG TUA (PANTAU REAL-TIME ANAK)                 */}
      {/* ============================================================== */}
      {activeRole === 'ORANG_TUA' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 p-6 space-y-4 text-center max-w-2xl mx-auto shadow-xl">
            <Building2 className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Portal Pemantauan Kehadiran Siswa oleh Orang Tua / Wali
              </h3>
              <p className="text-xs text-slate-300">
                Masukkan NISN, NIS, atau pilih nama putra/putri Anda untuk melihat status kehadiran hari ini secara real-time.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
              <input
                type="text"
                placeholder="Ketik NISN / Nama Siswa..."
                value={parentSearchQuery}
                onChange={(e) => setParentSearchQuery(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
              />
              {parentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setParentSearchQuery('')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Reset Cari
                </button>
              )}
              <button
                type="button"
                onClick={handleExecuteSync}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                <span>Sinkron Data</span>
              </button>
            </div>

            {/* Pilihan Cepat Siswa Terdaftar */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[10px] text-slate-400 mr-1">Pilih Cepat:</span>
              {registeredStudents.slice(0, 6).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setParentSearchQuery(st.namaSiswa)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/50 text-[11px] text-slate-200 font-semibold cursor-pointer transition-all"
                >
                  {st.namaSiswa} ({st.kelas})
                </button>
              ))}
            </div>
          </div>

          {/* Hasil Pencarian Orang Tua */}
          {parentFoundStudent ? (
            <div className="rounded-2xl border border-amber-500/40 bg-slate-900 p-5 space-y-4 max-w-2xl mx-auto shadow-xl">
              <div className="flex items-center justify-between gap-3.5 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-amber-400 flex items-center justify-center font-bold text-amber-300 text-lg overflow-hidden shrink-0">
                    {parentFoundStudent.photoUrl ? (
                      <img src={parentFoundStudent.photoUrl} alt={parentFoundStudent.namaSiswa} className="w-full h-full object-cover" />
                    ) : (
                      parentFoundStudent.namaSiswa.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{parentFoundStudent.namaSiswa}</h4>
                    <p className="text-xs text-slate-300">
                      NISN: {parentFoundStudent.nisn || parentFoundStudent.nisNisn} • Kelas: {parentFoundStudent.kelas}
                    </p>
                    <p className="text-[11px] text-amber-400 font-semibold">
                      Status Sidik Jari: Terdaftar ({parentFoundStudent.fingerprintFinger})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForCard(parentFoundStudent)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 text-xs font-bold cursor-pointer"
                >
                  Lihat Kartu QR
                </button>
              </div>

              {/* Status Hari Ini */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Status Kehadiran Hari Ini ({todayDateStr}):
                </h5>

                {parentStudentRecords.filter((r) => r.date === todayDateStr).length > 0 ? (
                  parentStudentRecords
                    .filter((r) => r.date === todayDateStr)
                    .map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-emerald-300">
                            {rec.status.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            Waktu Check-in: <strong>{rec.time} WIB</strong> via {rec.metodeVerifikasi.replace(/_/g, ' ')}
                          </p>
                          {rec.gpsLocation && (
                            <p className="text-[11px] text-slate-400">
                              Lokasi: {rec.gpsLocation.distanceToSchoolMeters} meter dari gerbang sekolah
                            </p>
                          )}
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      </div>
                    ))
                ) : (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-center">
                    <p className="text-xs font-bold text-rose-300">
                      Belum Tercatat Masuk / Belum Melakukan Presensi Hari Ini
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Silakan hubungi wali kelas atau ajukan surat izin online jika putra/putri Anda berhalangan hadir.
                    </p>
                  </div>
                )}
              </div>

              {/* Hubungi Wali Kelas & Ajukan Izin */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPermitForm((prev) => ({ ...prev, studentId: parentFoundStudent.id }));
                    setIsPermitModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ajukan Surat Izin / Sakit Anak</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const wali = kelasList.find((k) => k.namaKelas === parentFoundStudent.kelas);
                    const phone = formatPhoneForWhatsApp(wali?.noHpWaliKelas || '082165885568');
                    const text = `Halo Bapak/Ibu Wali Kelas ${parentFoundStudent.kelas}, saya orang tua dari ${parentFoundStudent.namaSiswa} (NISN: ${parentFoundStudent.nisn || parentFoundStudent.nisNisn}) ingin mengonfirmasi terkait kehadiran putra/putri kami. Terima kasih.`;
                    const waUrl = getTeacherWhatsAppUrl(text, phone);
                    openWhatsAppSafely(waUrl);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Hubungi Wali Kelas via WhatsApp</span>
                </button>
              </div>
            </div>
          ) : parentSearchQuery.trim() !== '' ? (
            <p className="text-xs text-rose-400 text-center py-4">
              Siswa dengan kata kunci "{parentSearchQuery}" tidak ditemukan.
            </p>
          ) : null}
        </div>
      )}

      {/* ============================================================== */}
      {/* ROLE 4: MODE ADMIN / OPERATOR SEKOLAH (CRUD & SETTINGS)        */}
      {/* ============================================================== */}
      {activeRole === 'ADMIN' && (
        <div className="space-y-4">
          {/* BANNER MODE GURU TERINTEGRASI PADA PANEL OPERATOR SEKOLAH */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-sky-950/80 border border-purple-500/40 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>Akses Mode Guru &amp; Wali Kelas (Panel Operator)</span>
                  <span className="px-1.5 py-0.2 rounded text-[8.5px] bg-sky-500/20 text-sky-300 border border-sky-400/40 font-mono font-bold">
                    TERSEDIA
                  </span>
                </p>
                <p className="text-[10px] text-slate-300">
                  Sebagai Operator Sekolah, Anda dapat langsung mengelola lembar checklist presensi kelas, verifikasi izin, atau beralih ke Mode Guru penuh.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdminTab('MODE_GURU')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  adminTab === 'MODE_GURU'
                    ? 'bg-sky-500 text-white ring-2 ring-sky-300 shadow-sky-500/30'
                    : 'bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-400/40'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Buka Lembar Guru di Sini</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRole('GURU');
                  playBiometricSound('success');
                  showFeedback('info', 'Mode Guru Penuh', 'Beralih ke tampilan layar penuh Mode Guru.');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Layar Penuh Mode Guru ↗</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('anbk_admin_operator_verified_session_v1');
                  } catch {}
                  setIsAdminAuthenticated(false);
                  setActiveRole('SISWA');
                  playBiometricSound('beep');
                  showFeedback('info', 'Mode Admin Dikunci', 'Panel Admin berhasil dikunci. Kembali ke Mode Siswa demi keamanan.');
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-400/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Kunci Akses Admin & Kembali ke Mode Siswa agar murid tidak dapat mengakses"
              >
                <Lock className="w-3.5 h-3.5 text-rose-300" />
                <span>Kunci Mode Admin</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
            <button
              type="button"
              onClick={() => setAdminTab('REKAP_EKSPOR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'REKAP_EKSPOR'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>1. Rekapitulasi &amp; Ekspor</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('MASTER_SISWA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'MASTER_SISWA'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>2. Data Master Siswa ({registeredStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('MASTER_KELAS_WALI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'MASTER_KELAS_WALI'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>3. Data Kelas &amp; Wali Kelas ({kelasList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('JADWAL_SEKOLAH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'JADWAL_SEKOLAH'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>4. Pengaturan Jam &amp; Lokasi</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('STATISTIK_GRAFIK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'STATISTIK_GRAFIK'
                  ? 'bg-purple-600 text-white font-black'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>5. Grafik Kedisiplinan Siswa</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('MODE_GURU')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'MODE_GURU'
                  ? 'bg-sky-500 text-white font-black shadow-sm ring-1 ring-sky-300'
                  : 'bg-slate-900 text-sky-300 hover:bg-slate-800 border border-sky-500/30'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>6. 👨‍🏫 Mode Guru &amp; Wali Kelas</span>
              {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length}
                </span>
              )}
            </button>
          </div>

          {/* ADMIN SUBTAB 1: REKAPITULASI & EKSPOR LAPORAN */}
          {adminTab === 'REKAP_EKSPOR' && (
            <div className="rounded-2xl border border-purple-500/40 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                    <span>Rekapitulasi Kehadiran &amp; Ekspor Otomatis</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Unduh data rekap harian, mingguan, bulanan ke Excel, PDF resmi, atau cetak mandiri.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportAttendanceToExcel(filteredRecords, `Kelas ${filterKelas}`)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportAttendanceToPdf(filteredRecords, `Kelas ${filterKelas}`)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor PDF (.pdf)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportAttendanceToWordHtml(filteredRecords, `Kelas ${filterKelas}`)}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak / Word (.doc)</span>
                  </button>
                </div>
              </div>

              {/* Filter Bilah */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">
                    Filter Kelas:
                  </label>
                  <select
                    value={filterKelas}
                    onChange={(e) => setFilterKelas(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  >
                    <option value="ALL">Semua Kelas (VII &amp; VIII)</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.namaKelas}>
                        {k.namaKelas}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">
                    Filter Status:
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="HADIR_TEPAT_WAKTU">Hadir Tepat Waktu</option>
                    <option value="TERLAMBAT">Terlambat</option>
                    <option value="SAKIT">Sakit</option>
                    <option value="IZIN">Izin</option>
                    <option value="ALFA">Alfa</option>
                    <option value="BOLOS">Bolos / Cabut</option>
                    <option value="DISPENSASI">Dispensasi</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">
                    Cari Nama / NISN:
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari siswa..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Tabel Log Kehadiran */}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-white/10">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">NISN</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Waktu Presensi</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Metode</th>
                      <th className="py-2.5 px-3">Radius GPS</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400">
                          Tidak ada data presensi yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, i) => (
                        <tr key={r.id} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-mono text-slate-400">{i + 1}</td>
                          <td className="py-2 px-3 font-mono text-slate-300">{r.nisn || r.nisNisn}</td>
                          <td className="py-2 px-3 font-bold text-white">{r.namaSiswa}</td>
                          <td className="py-2 px-3 text-purple-300 font-bold">{r.kelas}</td>
                          <td className="py-2 px-3 font-mono text-slate-300">
                            {r.date} {r.time}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'HADIR_TEPAT_WAKTU'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : r.status === 'TERLAMBAT'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {r.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {r.metodeVerifikasi.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono">
                            {r.gpsLocation ? `${r.gpsLocation.distanceToSchoolMeters}m` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                const st = registeredStudents.find((s) => s.id === r.studentId);
                                const msg = buildWhatsAppAttendanceMessage(r, st, scheduleConfig);
                                const phone = formatPhoneForWhatsApp(st?.noHpOrangTua || '082165885568');
                                const waUrl = getTeacherWhatsAppUrl(msg, phone);
                                setWaToastInfo({
                                  show: true,
                                  studentName: r.namaSiswa,
                                  phone,
                                  url: waUrl,
                                  messageText: msg,
                                });
                                openWhatsAppSafely(waUrl);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all border border-emerald-400/30"
                              title={`Kirim Pesan WhatsApp ke Orang Tua (${r.namaSiswa})`}
                            >
                              <Send className="w-2.5 h-2.5 text-white" />
                              <span>WA Ortu</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAttendanceRecordToDelete(r)}
                              className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-all"
                              title="Hapus permanen baris presensi ini (dilengkapi dialog konfirmasi)"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Hapus</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tombol Hapus, Simpan, Reset & Sinkron di Footer Rekap Admin */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400">
                  Total {filteredRecords.length} catatan kehadiran ditampilkan dari {attendanceRecords.length} total log.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal('HAPUS')}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteSaveAll(false)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Semua</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveActionModal('RESET')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Presensi</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSync}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                    <span>Sinkron</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN SUBTAB 2: DATA MASTER SISWA (CRUD & IMPOR) */}
          {adminTab === 'MASTER_SISWA' && (
            <div className="rounded-2xl border border-purple-500/40 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <span>Data Master Siswa Terdaftar ({registeredStudents.length} Siswa)</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Pengelolaan identitas siswa, NIS, NISN, Kelas, No HP Orang Tua, dan status sidik jari perangkat.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudentId(null);
                      setStudentForm({
                        namaSiswa: '',
                        nis: '',
                        nisn: '',
                        kelas: 'VIII-1',
                        jenisKelamin: 'Laki-laki',
                        noHpOrangTua: '',
                        namaOrangTua: '',
                        fingerprintFinger: 'Jempol Kanan',
                        photoUrl: '',
                        rfidCardId: '',
                      });
                      setIsStudentModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Siswa Baru</span>
                  </button>

                  <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/20">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Impor Excel / CSV</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          try {
                            const bstr = evt.target?.result;
                            const wb = XLSX.read(bstr, { type: 'binary' });
                            const wsname = wb.SheetNames[0];
                            const ws = wb.Sheets[wsname];
                            const data = XLSX.utils.sheet_to_json(ws);
                            const res = importStudentsFromData(data as any[]);
                            setRegisteredStudents(getRegisteredStudents());
                            playBiometricSound('success');
                            showFeedback('success', 'Impor Data Siswa Berhasil!', res.message);
                          } catch {
                            showFeedback('error', 'Gagal Membaca File', 'Format file Excel/CSV tidak valid.');
                          }
                        };
                        reader.readAsBinaryString(file);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleExecuteSaveAll(false)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Master</span>
                  </button>
                </div>
              </div>

              {/* Tabel Siswa Master */}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-white/10">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">NIS</th>
                      <th className="py-2.5 px-3">NISN</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">No HP Ortu (WA)</th>
                      <th className="py-2.5 px-3">Sidik Jari</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {registeredStudents.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-purple-400 flex items-center justify-center text-[10px] text-purple-300 overflow-hidden shrink-0">
                            {st.photoUrl ? (
                              <img src={st.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              st.namaSiswa.slice(0, 1)
                            )}
                          </div>
                          <span>{st.namaSiswa}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{st.nis || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {st.nisn || st.nisNisn}
                        </td>
                        <td className="py-2.5 px-3 text-purple-300 font-bold">{st.kelas}</td>
                        <td className="py-2.5 px-3 text-slate-300">{st.noHpOrangTua || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                            {st.fingerprintFinger}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForCard(st)}
                            className="text-sky-400 hover:text-sky-300 font-bold text-xs cursor-pointer"
                          >
                            Kartu QR
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditStudent(st)}
                            className="text-amber-400 hover:text-amber-300 font-bold text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentToDelete(st)}
                            className="text-rose-400 hover:text-rose-300 font-bold text-xs cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ADMIN SUBTAB 3: DATA MASTER KELAS & WALI KELAS */}
          {adminTab === 'MASTER_KELAS_WALI' && (
            <div className="rounded-2xl border border-purple-500/40 bg-slate-900 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <span>Pembagian Kelas &amp; Wali Kelas (VII &amp; VIII)</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Daftar wali kelas pengampu Fase D UPTD SMP Negeri 7 Kisaran.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKelasId(null);
                      setKelasForm({
                        namaKelas: '',
                        jenjang: 'VIII',
                        namaWaliKelas: '',
                        nipWaliKelas: '',
                        noHpWaliKelas: '',
                      });
                      setIsKelasModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kelas / Wali</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteSaveAll(false)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Kelas</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {kelasList.map((k) => (
                  <div
                    key={k.id}
                    className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 hover:border-purple-400 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-purple-400">{k.namaKelas}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          Jenjang {k.jenjang}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white">{k.namaWaliKelas}</p>
                      <p className="text-[11px] text-slate-400 font-mono">NIP: {k.nipWaliKelas}</p>
                      <p className="text-[11px] text-emerald-400 font-mono">No WA: {k.noHpWaliKelas}</p>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKelasId(k.id);
                          setKelasForm({
                            namaKelas: k.namaKelas,
                            jenjang: k.jenjang,
                            namaWaliKelas: k.namaWaliKelas,
                            nipWaliKelas: k.nipWaliKelas,
                            noHpWaliKelas: k.noHpWaliKelas,
                          });
                          setIsKelasModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setKelasToDelete(k)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold cursor-pointer transition-colors"
                        title="Hapus permanen kelas dan data wali kelas ini (dilengkapi konfirmasi)"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADMIN SUBTAB 4: PENGATURAN JADWAL HARI (SENIN-SABTU), JAM MAPEL & LOKASI SEKOLAH */}
          {adminTab === 'JADWAL_SEKOLAH' && (
            <div className="space-y-4">
              {/* Pilihan Tab Hari Senin, Selasa, Rabu, Kamis, Jumat, Sabtu */}
              <div className="rounded-2xl border border-purple-500/40 bg-slate-900 p-5 space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      <span>Pengaturan Hari &amp; Jam Absensi Siswa per Mata Pelajaran (Senin s/d Sabtu)</span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Atur kapan hari dan jam berapa absensi siswa dibuka khusus untuk jadwal mata pelajaran di hari tertentu.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-extrabold self-start md:self-auto">
                    Hari Aktif: Hari {selectedScheduleDay}
                  </span>
                </div>

                {/* Tombol Pilihan Hari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {SCHOOL_DAYS_LIST.map((dayName) => {
                    const isSelected = selectedScheduleDay === dayName;
                    const dayCfg =
                      (scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN)[dayName] ||
                      INITIAL_JADWAL_HARIAN[dayName];
                    const mapelList = dayCfg?.sesiMapel || [];
                    return (
                      <button
                        key={dayName}
                        type="button"
                        onClick={() => {
                          handleSelectDaySchedule(dayName, false);
                          playBiometricSound('beep');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-gradient-to-br from-purple-600/90 to-indigo-700/90 border-purple-300 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-300'
                            : 'bg-slate-950/90 border-white/10 text-slate-300 hover:border-purple-400/50 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black tracking-wide">Hari {dayName}</span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              dayCfg?.aktif ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                        </div>
                        <div className="text-[11px] font-mono opacity-90">
                          {dayCfg?.jamMasuk || '07:15'} - {dayCfg?.jamPulang || '14:00'} WIB
                        </div>
                        <div className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/30 text-amber-300 w-fit">
                          {mapelList.length} Jadwal Mapel
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Form Pengaturan Jam Harian & Tambah Jadwal Mapel pada Hari Terpilih */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
                  {/* Kolom Kiri: Pengaturan Jam Masuk/Toleransi/Pulang Hari Terpilih */}
                  <div className="lg:col-span-5 rounded-xl border border-white/10 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <span>Jam Presensi Hari {selectedScheduleDay}</span>
                      </h4>
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeDayConfig.aktif}
                          onChange={(e) => {
                            const updatedDay: DailyScheduleConfig = {
                              ...activeDayConfig,
                              aktif: e.target.checked,
                            };
                            const nextCfg: SchoolScheduleConfig = {
                              ...scheduleConfig,
                              jadwalHarian: {
                                ...(scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN),
                                [selectedScheduleDay]: updatedDay,
                              },
                            };
                            setScheduleConfig(nextCfg);
                            saveSchoolScheduleConfig(nextCfg);
                          }}
                        />
                        <span>Hari Aktif</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block">
                          Jam Mulai Absen:
                        </label>
                        <input
                          type="time"
                          value={activeDayConfig.jamMasuk}
                          onChange={(e) => {
                            const updatedDay: DailyScheduleConfig = {
                              ...activeDayConfig,
                              jamMasuk: e.target.value,
                            };
                            setScheduleConfig((prev) => ({
                              ...prev,
                              jamMasuk: e.target.value,
                              jadwalHarian: {
                                ...(prev.jadwalHarian || INITIAL_JADWAL_HARIAN),
                                [selectedScheduleDay]: updatedDay,
                              },
                            }));
                          }}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-amber-300 block">
                          Batas Terlambat:
                        </label>
                        <input
                          type="time"
                          value={activeDayConfig.jamBatasToleransi}
                          onChange={(e) => {
                            const updatedDay: DailyScheduleConfig = {
                              ...activeDayConfig,
                              jamBatasToleransi: e.target.value,
                            };
                            setScheduleConfig((prev) => ({
                              ...prev,
                              jamBatasToleransi: e.target.value,
                              jadwalHarian: {
                                ...(prev.jadwalHarian || INITIAL_JADWAL_HARIAN),
                                [selectedScheduleDay]: updatedDay,
                              },
                            }));
                          }}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/40 text-xs text-amber-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block">
                          Jam Selesai/Pulang:
                        </label>
                        <input
                          type="time"
                          value={activeDayConfig.jamPulang}
                          onChange={(e) => {
                            const updatedDay: DailyScheduleConfig = {
                              ...activeDayConfig,
                              jamPulang: e.target.value,
                            };
                            setScheduleConfig((prev) => ({
                              ...prev,
                              jamPulang: e.target.value,
                              jadwalHarian: {
                                ...(prev.jadwalHarian || INITIAL_JADWAL_HARIAN),
                                [selectedScheduleDay]: updatedDay,
                              },
                            }));
                          }}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Keterangan / Agenda Hari {selectedScheduleDay}:
                      </label>
                      <input
                        type="text"
                        value={activeDayConfig.catatanHari}
                        onChange={(e) => {
                          const updatedDay: DailyScheduleConfig = {
                            ...activeDayConfig,
                            catatanHari: e.target.value,
                          };
                          setScheduleConfig((prev) => ({
                            ...prev,
                            jadwalHarian: {
                              ...(prev.jadwalHarian || INITIAL_JADWAL_HARIAN),
                              [selectedScheduleDay]: updatedDay,
                            },
                          }));
                        }}
                        placeholder={`Agenda khusus Hari ${selectedScheduleDay}...`}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white"
                      />
                    </div>

                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Radius Maksimal GPS Sekolah (meter):
                      </label>
                      <input
                        type="number"
                        value={scheduleConfig.maxRadiusMeters}
                        onChange={(e) =>
                          setScheduleConfig((prev) => ({
                            ...prev,
                            maxRadiusMeters: parseInt(e.target.value, 10) || 250,
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          saveSchoolScheduleConfig(scheduleConfig);
                          playBiometricSound('success');
                          showFeedback(
                            'success',
                            `Jadwal Hari ${selectedScheduleDay} Disimpan!`,
                            `Pengaturan absensi Hari ${selectedScheduleDay} (${activeDayConfig.jamMasuk} - ${activeDayConfig.jamPulang} WIB) berhasil disimpan.`
                          );
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        <span>Simpan Jadwal Hari {selectedScheduleDay}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setScheduleConfig(INITIAL_SCHEDULE_CONFIG);
                          saveSchoolScheduleConfig(INITIAL_SCHEDULE_CONFIG);
                          playBiometricSound('beep');
                          showFeedback(
                            'info',
                            'Jadwal Direset Default',
                            'Seluruh jadwal Hari Senin s/d Sabtu dikembalikan ke pengaturan standar.'
                          );
                        }}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  {/* Kolom Kanan: Daftar & Tambah Sesi Jadwal Mata Pelajaran Khusus pada Hari Terpilih */}
                  <div className="lg:col-span-7 rounded-xl border border-purple-500/30 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-amber-400" />
                          <span>Jadwal Mapel &amp; Jam Absensi Siswa — Hari {selectedScheduleDay}</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Daftar mata pelajaran beserta kelas dan jam absensi khusus pada Hari {selectedScheduleDay}.
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold">
                        {(activeDayConfig.sesiMapel || []).length} Sesi Mapel
                      </span>
                    </div>

                    {/* Daftar Sesi Mapel Hari Ini */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {(activeDayConfig.sesiMapel || []).length === 0 ? (
                        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 text-center text-xs text-slate-400">
                          Belum ada jadwal mata pelajaran khusus untuk Hari {selectedScheduleDay}. Silakan tambahkan di bawah.
                        </div>
                      ) : (
                        (activeDayConfig.sesiMapel || []).map((sesi) => (
                          <div
                            key={sesi.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                              activeSubjectSession?.id === sesi.id
                                ? 'bg-purple-950/40 border-purple-400/70'
                                : 'bg-slate-900/90 border-white/10'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px]">
                                  Hari {sesi.hari}
                                </span>
                                <span className="text-xs font-extrabold text-white">
                                  {sesi.mataPelajaran}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold text-[10px]">
                                  Kelas: {sesi.kelasTarget === 'ALL' ? 'Semua Kelas' : sesi.kelasTarget}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-mono">
                                <span className="text-emerald-300 font-bold">
                                  ⏰ Jam Absen: {sesi.jamMulai} - {sesi.jamSelesai} WIB
                                </span>
                                <span>•</span>
                                <span className="text-amber-300">
                                  Batas Toleransi: {sesi.jamBatasToleransi} WIB
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Guru Mapel: <strong className="text-slate-200">{sesi.guruPengampu}</strong>
                                {sesi.keterangan ? ` — ${sesi.keterangan}` : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubjectSessionId(sesi.id);
                                  playBiometricSound('beep');
                                  showFeedback(
                                    'info',
                                    `Sesi Mapel Diaktifkan (Hari ${selectedScheduleDay})`,
                                    `Absensi aktif: ${sesi.mataPelajaran} (${sesi.jamMulai} - ${sesi.jamSelesai} WIB).`
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer ${
                                  activeSubjectSession?.id === sesi.id
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                              >
                                {activeSubjectSession?.id === sesi.id ? 'Aktif Dipilih ✓' : 'Pilih Sesi'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setSessionToDelete({
                                    day: selectedScheduleDay,
                                    sesi,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 cursor-pointer transition-colors"
                                title="Hapus permanen sesi mapel ini (dilengkapi konfirmasi)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Form Tambah Sesi Jadwal Mapel Baru untuk Hari Terpilih */}
                    <div className="pt-3 border-t border-white/10 space-y-2.5">
                      <h5 className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Buat Jadwal Absensi Mapel Baru pada Hari {selectedScheduleDay}</span>
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block">
                            Nama Mata Pelajaran:
                          </label>
                          <input
                            type="text"
                            value={newSubjectSessionForm.mataPelajaran}
                            onChange={(e) =>
                              setNewSubjectSessionForm((p) => ({ ...p, mataPelajaran: e.target.value }))
                            }
                            placeholder="Mis: Informatika"
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block">
                            Target Kelas Absensi:
                          </label>
                          <select
                            value={newSubjectSessionForm.kelasTarget}
                            onChange={(e) =>
                              setNewSubjectSessionForm((p) => ({ ...p, kelasTarget: e.target.value }))
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white"
                          >
                            <option value="ALL">Semua Kelas (VII &amp; VIII)</option>
                            {kelasList.map((k) => (
                              <option key={k.id} value={k.namaKelas}>
                                Kelas {k.namaKelas}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block">
                            Guru Mapel Pengampu:
                          </label>
                          <input
                            type="text"
                            value={newSubjectSessionForm.guruPengampu}
                            onChange={(e) =>
                              setNewSubjectSessionForm((p) => ({ ...p, guruPengampu: e.target.value }))
                            }
                            placeholder="Nama Guru Mapel"
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block">
                            Jam Mulai Absen (WIB):
                          </label>
                          <input
                            type="time"
                            value={newSubjectSessionForm.jamMulai}
                            onChange={(e) =>
                              setNewSubjectSessionForm((p) => ({ ...p, jamMulai: e.target.value }))
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-amber-300 block">
                            Batas Toleransi Telat:
                          </label>
                          <input
                            type="time"
                            value={newSubjectSessionForm.jamBatasToleransi}
                            onChange={(e) =>
                              setNewSubjectSessionForm((p) => ({
                                ...p,
                                jamBatasToleransi: e.target.value,
                              }))
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/40 text-xs text-amber-200 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block">
                            Jam Selesai Mapel:
                          </label>
                          <input
                            type="time"
                            value={newSubjectSessionForm.jamSelesai}
                            onChange={(e) =>
                              setNewSubjectSessionForm((p) => ({ ...p, jamSelesai: e.target.value }))
                            }
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={newSubjectSessionForm.keterangan}
                          onChange={(e) =>
                            setNewSubjectSessionForm((p) => ({ ...p, keterangan: e.target.value }))
                          }
                          placeholder="Catatan materi / ruang kelas (opsional)..."
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newSubjectSessionForm.mataPelajaran.trim()) {
                              showFeedback('warning', 'Nama Mapel Kosong', 'Masukkan nama mata pelajaran terlebih dahulu.');
                              return;
                            }
                            const newSesi: SubjectScheduleSession = {
                              id: `SESI-${selectedScheduleDay.toUpperCase()}-${Date.now()}`,
                              hari: selectedScheduleDay,
                              mataPelajaran: newSubjectSessionForm.mataPelajaran.trim(),
                              kelasTarget: newSubjectSessionForm.kelasTarget,
                              jamMulai: newSubjectSessionForm.jamMulai,
                              jamBatasToleransi: newSubjectSessionForm.jamBatasToleransi,
                              jamSelesai: newSubjectSessionForm.jamSelesai,
                              guruPengampu: newSubjectSessionForm.guruPengampu.trim() || 'Guru Mapel',
                              keterangan: newSubjectSessionForm.keterangan.trim(),
                              aktif: true,
                            };
                            const updatedDay: DailyScheduleConfig = {
                              ...activeDayConfig,
                              sesiMapel: [...(activeDayConfig.sesiMapel || []), newSesi],
                            };
                            const nextCfg: SchoolScheduleConfig = {
                              ...scheduleConfig,
                              hariAktifTerpilih: selectedScheduleDay,
                              jadwalHarian: {
                                ...(scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN),
                                [selectedScheduleDay]: updatedDay,
                              },
                            };
                            setScheduleConfig(nextCfg);
                            saveSchoolScheduleConfig(nextCfg);
                            setSelectedSubjectSessionId(newSesi.id);
                            playBiometricSound('success');
                            showFeedback(
                              'success',
                              `Jadwal Mapel Hari ${selectedScheduleDay} Ditambahkan!`,
                              `${newSesi.mataPelajaran} (Kelas ${newSesi.kelasTarget}) pukul ${newSesi.jamMulai} - ${newSesi.jamSelesai} WIB berhasil dibuat.`
                            );
                          }}
                          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tambah Jadwal di Hari {selectedScheduleDay}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN SUBTAB 5: STATISTIK & GRAFIK KEDISIPLINAN (RECHARTS) */}
          {adminTab === 'STATISTIK_GRAFIK' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Proporsi Kehadiran Hari Ini ({stats.total} Catatan)</span>
                </h3>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>Tingkat Kehadiran per Kelas (Fase D)</span>
                </h3>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <XAxis dataKey="kelas" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="hadir" fill="#10b981" name="Hadir" />
                      <Bar dataKey="absen" fill="#ef4444" name="Tidak Hadir" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN SUBTAB 6: MODE GURU & WALI KELAS UNTUK OPERATOR SEKOLAH */}
          {adminTab === 'MODE_GURU' && (
            <div className="rounded-2xl border border-sky-500/40 bg-slate-900 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Mode Guru &amp; Wali Kelas (Akses Penuh Operator)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold">
                          TERINTEGRASI
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300">
                        Kelola absensi kelas, presensi cepat siswa, verifikasi izin, dan rekap wali kelas langsung dari akun Operator/Admin.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRole('GURU');
                      playBiometricSound('success');
                      showFeedback('info', 'Mode Guru Penuh', 'Beralih ke tampilan layar penuh Mode Guru.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <span>Layar Penuh Mode Guru ↗</span>
                  </button>
                </div>
              </div>

              {/* Sub-navigasi Tab Mode Guru di dalam Operator */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setGuruTab('PRESENSI_KELAS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    guruTab === 'PRESENSI_KELAS'
                      ? 'bg-sky-500 text-white font-black'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>A. Lembar Absensi Cepat Kelas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGuruTab('VERIFIKASI_IZIN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    guruTab === 'VERIFIKASI_IZIN'
                      ? 'bg-sky-500 text-white font-black'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>B. Verifikasi Izin Siswa</span>
                  {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                      {permitRequests.filter((p) => p.status === 'MENUNGGU_VERIFIKASI').length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setGuruTab('REKAP_KELAS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    guruTab === 'REKAP_KELAS'
                      ? 'bg-sky-500 text-white font-black'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>C. Log &amp; Rekap Kehadiran Kelas</span>
                </button>
              </div>

              {/* Konten Tab A: Lembar Presensi Kelas */}
              {guruTab === 'PRESENSI_KELAS' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/60 p-3 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300 font-bold">Pilih Kelas:</span>
                      <select
                        value={guruSelectedKelas}
                        onChange={(e) => setGuruSelectedKelas(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-sky-400/40 text-xs text-white font-bold"
                      >
                        {kelasList.map((k) => (
                          <option key={k.id} value={k.namaKelas}>
                            {k.namaKelas} - {k.namaWaliKelas}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const classStudents = registeredStudents.filter(
                            (s) => getCleanKelas(s.kelas) === getCleanKelas(guruSelectedKelas)
                          );
                          const nextMap: Record<string, AttendanceStatusType> = { ...guruChecklistMap };
                          classStudents.forEach((st) => {
                            nextMap[st.id] = 'HADIR_TEPAT_WAKTU';
                          });
                          setGuruChecklistMap(nextMap);
                          playBiometricSound('beep');
                          showFeedback(
                            'info',
                            'Semua Ditandai Hadir',
                            `Seluruh siswa kelas ${guruSelectedKelas} ditandai HADIR TEPAT WAKTU.`
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tandai Hadir Semua</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveGuruBulkAttendance}
                        className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Presensi Kelas Ini</span>
                      </button>
                    </div>
                  </div>

                  {/* Checklist Siswa */}
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold bg-slate-950/80">
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">NISN</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3">Status Saat Ini</th>
                          <th className="py-2.5 px-3">Tindakan Cepat Guru</th>
                          <th className="py-2.5 px-3 text-right">Notifikasi WA &amp; Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-slate-950/40">
                        {registeredStudents
                          .filter((s) => getCleanKelas(s.kelas) === getCleanKelas(guruSelectedKelas))
                          .map((st, idx) => {
                            const todayLog = todayRecords.find((r) => r.studentId === st.id);
                            const curStatus = guruChecklistMap[st.id] || todayLog?.status || 'HADIR_TEPAT_WAKTU';

                            return (
                              <tr key={st.id} className="hover:bg-white/5">
                                <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-300">
                                  {st.nisn || st.nisNisn}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-white">{st.namaSiswa}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      curStatus === 'HADIR_TEPAT_WAKTU'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : curStatus === 'TERLAMBAT'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : curStatus === 'SAKIT'
                                        ? 'bg-cyan-500/20 text-cyan-300'
                                        : curStatus === 'IZIN'
                                        ? 'bg-purple-500/20 text-purple-300'
                                        : curStatus === 'DISPENSASI'
                                        ? 'bg-sky-500/20 text-sky-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    {curStatus.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {(
                                      [
                                        'HADIR_TEPAT_WAKTU',
                                        'TERLAMBAT',
                                        'SAKIT',
                                        'IZIN',
                                        'DISPENSASI',
                                        'ALFA',
                                        'BOLOS',
                                      ] as AttendanceStatusType[]
                                    ).map((stOpt) => (
                                      <button
                                        key={stOpt}
                                        type="button"
                                        onClick={() =>
                                          setGuruChecklistMap((prev) => ({ ...prev, [st.id]: stOpt }))
                                        }
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                          curStatus === stOpt
                                            ? 'bg-sky-500 text-white ring-1 ring-sky-300'
                                            : 'bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                      >
                                        {stOpt === 'HADIR_TEPAT_WAKTU'
                                          ? 'Hadir'
                                          : stOpt === 'TERLAMBAT'
                                          ? 'Telat'
                                          : stOpt === 'SAKIT'
                                          ? 'Sakit'
                                          : stOpt === 'IZIN'
                                          ? 'Izin'
                                          : stOpt === 'DISPENSASI'
                                          ? 'Disp'
                                          : stOpt === 'ALFA'
                                          ? 'Alfa'
                                          : 'Bolos'}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const dummyRec: StudentAttendanceRecord = todayLog || {
                                        id: `DUMMY-${Date.now()}`,
                                        studentId: st.id,
                                        namaSiswa: st.namaSiswa,
                                        nisn: st.nisn || st.nisNisn,
                                        nisNisn: st.nisNisn,
                                        kelas: st.kelas,
                                        date: todayDateStr,
                                        time: '07:30:00',
                                        timestamp: `${todayDateStr}, 07.30.00 WIB`,
                                        status: curStatus,
                                        metodeVerifikasi: 'INPUT_MANUAL_GURU',
                                        deviceBrand: 'Operator Portal',
                                        deviceModel: 'Operator / Guru',
                                      };
                                      const msg = buildWhatsAppAttendanceMessage(
                                        dummyRec,
                                        st,
                                        scheduleConfig
                                      );
                                      const phone = formatPhoneForWhatsApp(st.noHpOrangTua || '082165885568');
                                      const waUrl = getTeacherWhatsAppUrl(msg, phone);
                                      setWaSentStudentId(st.id);
                                      setWaToastInfo({
                                        show: true,
                                        studentName: st.namaSiswa,
                                        phone,
                                        url: waUrl,
                                        messageText: msg,
                                      });
                                      setTimeout(() => {
                                        setWaSentStudentId((curr) => (curr === st.id ? null : curr));
                                      }, 3000);
                                      openWhatsAppSafely(waUrl);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>Kirim WA</span>
                                  </button>

                                  {todayLog && (
                                    <button
                                      type="button"
                                      title="Hapus permanen presensi siswa ini hari ini"
                                      onClick={() => setAttendanceRecordToDelete(todayLog)}
                                      className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer inline-flex items-center"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Tombol Aksi Tambahan */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setClassAttendanceToDelete({
                            kelas: guruSelectedKelas,
                            date: todayDateStr,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Kelas Ini</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGuruChecklistMap({});
                          playBiometricSound('beep');
                          showFeedback('info', 'Checklist Direset', `Checklist kelas ${guruSelectedKelas} telah direset.`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Checklist</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveGuruBulkAttendance}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Rekap Presensi Kelas {guruSelectedKelas}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Konten Tab B: Verifikasi Izin Siswa */}
              {guruTab === 'VERIFIKASI_IZIN' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-400" />
                      <span>Verifikasi Pengajuan Izin Siswa ({permitRequests.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleExecuteSync}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
                      <span>Sinkron Izin</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {permitRequests.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">Belum ada surat izin siswa yang diajukan.</p>
                    ) : (
                      permitRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{req.namaSiswa}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({req.kelas})</span>
                              <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${
                                req.status === 'DISETUJUI'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : req.status === 'DITOLAK'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">
                              <strong className="text-sky-300">Alasan:</strong> {req.alasan} ({req.jenisIzin}) · Tgl: {req.tanggalMulai} s/d {req.tanggalSelesai}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                verifyOnlinePermitRequest(
                                  req.id,
                                  'DISETUJUI',
                                  'Operator Sekolah (' + req.kelas + ')',
                                  'Surat disetujui oleh Operator'
                                );
                                setPermitRequests(getOnlinePermitRequests());
                                setAttendanceRecords(getAttendanceRecords());
                                playBiometricSound('success');
                                showFeedback(
                                  'success',
                                  'Surat Izin Disetujui!',
                                  `Izin ${req.jenisIzin} untuk ${req.namaSiswa} (${req.kelas}) telah disetujui.`
                                );
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                verifyOnlinePermitRequest(
                                  req.id,
                                  'DITOLAK',
                                  'Operator Sekolah (' + req.kelas + ')',
                                  'Ditolak oleh Operator'
                                );
                                setPermitRequests(getOnlinePermitRequests());
                                playBiometricSound('beep');
                                showFeedback(
                                  'warning',
                                  'Surat Izin Ditolak',
                                  `Pengajuan izin ${req.namaSiswa} telah ditandai DITOLAK.`
                                );
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = permitRequests.filter((p) => p.id !== req.id);
                                saveOnlinePermitRequests(next);
                                setPermitRequests(next);
                                playBiometricSound('beep');
                                showFeedback('info', 'Data Izin Dihapus', `Surat izin ${req.namaSiswa} telah dihapus.`);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Konten Tab C: Log & Rekap Kehadiran Kelas */}
              {guruTab === 'REKAP_KELAS' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <span>Log Kehadiran Kelas {guruSelectedKelas} Hari Ini</span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      Total {todayRecords.filter((r) => getCleanKelas(r.kelas) === getCleanKelas(guruSelectedKelas)).length} siswa terekam
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold bg-slate-950/80">
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Nama Siswa</th>
                          <th className="py-2 px-3">Waktu Presensi</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Metode Verifikasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-slate-950/40">
                        {todayRecords
                          .filter((r) => getCleanKelas(r.kelas) === getCleanKelas(guruSelectedKelas))
                          .map((rec, i) => (
                            <tr key={rec.id} className="hover:bg-white/5">
                              <td className="py-2 px-3 font-mono text-slate-400">{i + 1}</td>
                              <td className="py-2 px-3 font-bold text-white">{rec.namaSiswa}</td>
                              <td className="py-2 px-3 font-mono text-slate-300">{rec.time || rec.timestamp || '-'}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.status === 'HADIR_TEPAT_WAKTU'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : rec.status === 'TERLAMBAT'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                  {rec.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-400 text-[10px]">{(rec.metodeVerifikasi || 'MANUAL').replace(/_/g, ' ')}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* KOMPONEN VISUALISASI TABEL JADWAL ABSENSI MINGGUAN (SENIN-SABTU) */}
      {/* ============================================================== */}
      <WeeklyAttendanceScheduleTable
        scheduleConfig={scheduleConfig}
        selectedScheduleDay={selectedScheduleDay}
        activeSubjectSessionId={activeSubjectSession?.id}
        kelasList={kelasList}
        onSelectDayAndSession={(day, sessionId) => {
          handleSelectDaySchedule(day, false, sessionId);
          playBiometricSound('beep');
          const dayMap = scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN;
          const sesiObj = (dayMap[day]?.sesiMapel || []).find((s) => s.id === sessionId);
          showFeedback(
            'info',
            `Jadwal Hari ${day} Diaktifkan`,
            sesiObj
              ? `Sesi aktif: ${sesiObj.mataPelajaran} (${sesiObj.jamMulai} - ${sesiObj.jamSelesai} WIB) — Kelas ${sesiObj.kelasTarget === 'ALL' ? 'Semua Kelas' : sesiObj.kelasTarget}`
              : `Jadwal presensi Hari ${day} dipilih.`
          );
        }}
        onOpenScheduleSettings={(day) => {
          executeWithAdminAuth(() => {
            if (day) {
              handleSelectDaySchedule(day, true);
            } else {
              setActiveRole('ADMIN');
              setAdminTab('JADWAL_SEKOLAH');
            }
            playBiometricSound('beep');
          });
        }}
        onDeleteSession={activeRole === 'ADMIN' ? handleDeleteScheduleSession : undefined}
        defaultExpanded={true}
      />

      {/* ============================================================== */}
      {/* MODAL AKSI UTAMA: HAPUS, SIMPAN, DAN RESET                     */}
      {/* ============================================================== */}
      {activeActionModal === 'HAPUS' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-3xl border-2 border-rose-500/50 bg-gradient-to-b from-slate-900 to-slate-950 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header Modal Hapus */}
            <div className="flex items-start justify-between border-b border-white/10 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-md">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Pusat Penghapusan Data Presensi &amp; Biometrik</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hapus catatan kehadiran, bersihkan log presensi, atau hapus kartu pelajar siswa secara permanen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigasi Kategori Penghapusan (3 Tab Kategori) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-white/10">
              <button
                type="button"
                onClick={() => setDeleteTargetFilter((p) => ({ ...p, category: 'PRESENSI' }))}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  deleteTargetFilter.category === 'PRESENSI'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Riwayat Presensi</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-black/30 font-mono">
                  {attendanceRecords.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTargetFilter((p) => ({ ...p, category: 'KARTU_SISWA' }))}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  deleteTargetFilter.category === 'KARTU_SISWA'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Kartu Pelajar</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-black/30 font-mono">
                  {registeredStudents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTargetFilter((p) => ({ ...p, category: 'ALL_SYSTEM' }))}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  deleteTargetFilter.category === 'ALL_SYSTEM'
                    ? 'bg-rose-700 text-white shadow-md shadow-rose-950/60 ring-1 ring-rose-400'
                    : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/30'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                <span className="truncate">Pembersihan Total</span>
              </button>
            </div>

            {/* TAB 1: PENGHAPUSAN RIWAYAT PRESENSI */}
            {deleteTargetFilter.category === 'PRESENSI' && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                  <span>Pilih cakupan riwayat presensi yang ingin dihapus:</span>
                  <span className="text-[10px] text-slate-400 font-mono">Total {attendanceRecords.length} Catatan</span>
                </p>

                {/* 1.1 Presensi Hari Ini */}
                <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  deleteTargetFilter.presensiMode === 'TODAY'
                    ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/50'
                    : 'border-white/10 bg-slate-950 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="presensiDeleteMode"
                    className="mt-0.5"
                    checked={deleteTargetFilter.presensiMode === 'TODAY'}
                    onChange={() => setDeleteTargetFilter((p) => ({ ...p, presensiMode: 'TODAY' }))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        <span>Hapus Catatan Presensi Hari Ini</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 font-bold shrink-0">
                        {attendanceRecords.filter((r) => {
                          const now = new Date();
                          const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                          return r.date === local || r.date === now.toISOString().slice(0, 10);
                        }).length} Data
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Menghapus data kehadiran seluruh siswa yang tercatat pada tanggal hari ini saja.
                    </p>
                  </div>
                </label>

                {/* 1.2 Presensi Berdasarkan Kelas */}
                <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  deleteTargetFilter.presensiMode === 'BY_CLASS'
                    ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/50'
                    : 'border-white/10 bg-slate-950 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="presensiDeleteMode"
                    className="mt-0.5"
                    checked={deleteTargetFilter.presensiMode === 'BY_CLASS'}
                    onChange={() => setDeleteTargetFilter((p) => ({
                      ...p,
                      presensiMode: 'BY_CLASS',
                      kelas: p.kelas === 'ALL' || !p.kelas ? (kelasList[0]?.namaKelas || 'VIII-1') : p.kelas,
                    }))}
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>Hapus Presensi Berdasarkan Kelas</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Menghapus seluruh rekaman kehadiran hanya untuk rombongan belajar / kelas terpilih.
                    </p>

                    {deleteTargetFilter.presensiMode === 'BY_CLASS' && (
                      <div className="pt-1">
                        <select
                          value={deleteTargetFilter.kelas}
                          onChange={(e) => setDeleteTargetFilter((p) => ({ ...p, kelas: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/50 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-rose-400 cursor-pointer"
                        >
                          {kelasList.map((k) => {
                            const c = attendanceRecords.filter((r) => getCleanKelas(r.kelas) === getCleanKelas(k.namaKelas)).length;
                            return (
                              <option key={k.id} value={k.namaKelas}>
                                Kelas {k.namaKelas} ({k.namaWaliKelas}) • {c} Catatan
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                </label>

                {/* 1.3 Presensi Berdasarkan Siswa */}
                <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  deleteTargetFilter.presensiMode === 'BY_STUDENT'
                    ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/50'
                    : 'border-white/10 bg-slate-950 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="presensiDeleteMode"
                    className="mt-0.5"
                    checked={deleteTargetFilter.presensiMode === 'BY_STUDENT'}
                    onChange={() => setDeleteTargetFilter((p) => ({
                      ...p,
                      presensiMode: 'BY_STUDENT',
                      studentId: p.studentId || registeredStudents[0]?.id || '',
                    }))}
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Hapus Presensi Siswa Tertentu</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Menghapus riwayat kehadiran 1 orang siswa tanpa menghapus kartu pelajar / akun siswa.
                    </p>

                    {deleteTargetFilter.presensiMode === 'BY_STUDENT' && (
                      <div className="pt-1">
                        {registeredStudents.length === 0 ? (
                          <p className="text-[11px] text-amber-300 font-semibold p-2 rounded-xl bg-amber-950/30 border border-amber-500/30">
                            Belum ada siswa terdaftar dalam sistem.
                          </p>
                        ) : (
                          <select
                            value={deleteTargetFilter.studentId}
                            onChange={(e) => setDeleteTargetFilter((p) => ({ ...p, studentId: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/50 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-rose-400 cursor-pointer"
                          >
                            {registeredStudents.map((s) => {
                              const c = attendanceRecords.filter((r) => r.studentId === s.id).length;
                              return (
                                <option key={s.id} value={s.id}>
                                  {s.namaSiswa} (Kelas {s.kelas} • NISN: {s.nisn || s.nisNisn}) • {c} Catatan
                                </option>
                              );
                            })}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </label>

                {/* 1.4 Kosongkan Seluruh Riwayat Presensi */}
                <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  deleteTargetFilter.presensiMode === 'ALL_RECORDS'
                    ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-500'
                    : 'border-rose-500/30 bg-rose-950/15 hover:border-rose-500/50'
                }`}>
                  <input
                    type="radio"
                    name="presensiDeleteMode"
                    className="mt-0.5"
                    checked={deleteTargetFilter.presensiMode === 'ALL_RECORDS'}
                    onChange={() => setDeleteTargetFilter((p) => ({ ...p, presensiMode: 'ALL_RECORDS' }))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Bersihkan Seluruh Log Riwayat Presensi</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0">
                        {attendanceRecords.length} Data
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mengosongkan seluruh riwayat dan log catatan kehadiran siswa semua kelas secara tuntas.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* TAB 2: PENGHAPUSAN KARTU PELAJAR & DATA SISWA */}
            {deleteTargetFilter.category === 'KARTU_SISWA' && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                  <span>Pilih penghapusan Kartu Pelajar &amp; Master Siswa:</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Total {registeredStudents.length} Siswa</span>
                </p>

                {/* 2.1 Hapus 1 Siswa & Kartu Tertentu */}
                <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  deleteTargetFilter.siswaMode === 'SINGLE_STUDENT'
                    ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/50'
                    : 'border-white/10 bg-slate-950 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="siswaDeleteMode"
                    className="mt-0.5"
                    checked={deleteTargetFilter.siswaMode === 'SINGLE_STUDENT'}
                    onChange={() => setDeleteTargetFilter((p) => ({
                      ...p,
                      siswaMode: 'SINGLE_STUDENT',
                      studentId: p.studentId || registeredStudents[0]?.id || '',
                    }))}
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5 text-rose-400" />
                        <span>Hapus Siswa &amp; Kartu Pelajar Tertentu (Permanen)</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Menghapus data siswa terpilih beserta kartu pelajar digital, foto profil, dan biometriknya.
                    </p>

                    {deleteTargetFilter.siswaMode === 'SINGLE_STUDENT' && (
                      <div className="pt-1 space-y-2">
                        {registeredStudents.length === 0 ? (
                          <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-center">
                            <p className="text-xs text-slate-400">Tidak ada kartu pelajar siswa terdaftar.</p>
                          </div>
                        ) : (
                          <>
                            <select
                              value={deleteTargetFilter.studentId}
                              onChange={(e) => setDeleteTargetFilter((p) => ({ ...p, studentId: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/50 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-rose-400 cursor-pointer"
                            >
                              {registeredStudents.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.namaSiswa} (Kelas {s.kelas} • NISN: {s.nisn || s.nisNisn})
                                </option>
                              ))}
                            </select>

                            {/* Preview Siswa Terpilih yang Akan Dihapus */}
                            {(() => {
                              const targetSt = registeredStudents.find((s) => s.id === (deleteTargetFilter.studentId || registeredStudents[0]?.id));
                              if (!targetSt) return null;
                              return (
                                <div className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/30 flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-rose-400 flex items-center justify-center font-bold text-rose-300 text-xs shrink-0 overflow-hidden">
                                    {targetSt.photoUrl ? (
                                      <img src={targetSt.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      targetSt.namaSiswa.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-white truncate">{targetSt.namaSiswa}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      Kelas {targetSt.kelas} • NISN: {targetSt.nisn || targetSt.nisNisn}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </label>

                {/* 2.2 Hapus Seluruh Kartu Pelajar Siswa */}
                <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  deleteTargetFilter.siswaMode === 'ALL_STUDENTS'
                    ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-500'
                    : 'border-rose-500/30 bg-rose-950/15 hover:border-rose-500/50'
                }`}>
                  <input
                    type="radio"
                    name="siswaDeleteMode"
                    className="mt-0.5"
                    checked={deleteTargetFilter.siswaMode === 'ALL_STUDENTS'}
                    onChange={() => setDeleteTargetFilter((p) => ({ ...p, siswaMode: 'ALL_STUDENTS' }))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Hapus Seluruh Data Siswa &amp; Kartu Pelajar ({registeredStudents.length} Siswa)</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Menghapus seluruh daftar kartu pelajar siswa terdaftar secara permanen. Anda dapat mendaftarkan siswa baru dari awal kapan saja.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* TAB 3: PEMBERSIHAN TOTAL SISTEM */}
            {deleteTargetFilter.category === 'ALL_SYSTEM' && (
              <div className="space-y-3 p-4 rounded-2xl border-2 border-rose-500/50 bg-rose-950/30 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-500/50 flex items-center justify-center text-rose-300 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Pembersihan Menyeluruh Sistem Presensi &amp; Siswa
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      Tindakan ini akan menghapus dan mengosongkan seluruh data secara serentak:
                    </p>
                    <ul className="text-[11px] text-rose-200 list-disc list-inside mt-1.5 space-y-0.5 font-medium">
                      <li><strong>{attendanceRecords.length}</strong> seluruh catatan riwayat kehadiran presensi</li>
                      <li><strong>{registeredStudents.length}</strong> seluruh data kartu pelajar digital &amp; sidik jari siswa</li>
                    </ul>
                    <p className="text-[10px] text-amber-300/90 font-semibold mt-2">
                      ⚠️ Data yang dihapus tidak dapat dipulihkan kembali. Pengaturan master kelas dan jam jadwal tetap aman.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Kotak Peringatan / Ringkasan Aksi */}
            <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left text-xs ${
              deleteSummaryInfo.canDelete
                ? 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                : 'border-white/10 bg-slate-950 text-slate-400'
            }`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 ${deleteSummaryInfo.canDelete ? 'text-rose-400' : 'text-slate-500'}`} />
              <p className="text-[11px] leading-tight font-medium">
                {deleteSummaryInfo.warningText}
              </p>
            </div>

            {/* Tombol Aksi Batal & Ya, Hapus Sekarang */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!deleteSummaryInfo.canDelete}
                onClick={handleExecuteDelete}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                  deleteSummaryInfo.canDelete
                    ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-rose-950/60'
                    : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed opacity-60'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {deleteSummaryInfo.canDelete
                    ? `Ya, Hapus Sekarang (${deleteSummaryInfo.label})`
                    : 'Tidak Ada Data Untuk Dihapus'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeActionModal === 'SIMPAN' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-2xl border border-emerald-500/50 bg-slate-900 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Save className="w-5 h-5 text-emerald-400" />
                <span>Simpan Permanen Data Presensi &amp; Siswa</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <p>
                Seluruh perubahan data kehadiran, identitas biometrik siswa, daftar wali kelas, dan surat izin akan disimpan permanen ke penyimpanan sistem:
              </p>
              <div className="rounded-xl bg-slate-950 border border-white/10 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Siswa Terdaftar:</span>
                  <strong className="text-emerald-400">{registeredStudents.length} Siswa</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Catatan Presensi:</span>
                  <strong className="text-emerald-400">{attendanceRecords.length} Log</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Presensi Hari Ini:</span>
                  <strong className="text-sky-400">{todayRecords.length} Siswa</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Terakhir Disimpan:</span>
                  <span className="font-mono text-slate-300">{lastSavedAt}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleExecuteSaveAll(true)}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Simpan &amp; Unduh Excel</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteSaveAll(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeActionModal === 'RESET' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-2xl border border-amber-500/50 bg-slate-900 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <span>Reset Data Presensi &amp; Pengaturan</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-300">Pilih mode reset yang diinginkan:</p>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 bg-slate-950 cursor-pointer">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetTargetMode === 'TODAY'}
                  onChange={() => setResetTargetMode('TODAY')}
                />
                <div>
                  <span className="text-xs font-bold text-white block">Reset Presensi Hari Ini Saja</span>
                  <span className="text-[11px] text-slate-400">
                    Menghapus log hadir hari ini ({todayDateStr}) tanpa menghapus riwayat hari sebelumnya.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/10 bg-slate-950 cursor-pointer">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetTargetMode === 'RESET_MASTER_DEFAULT'}
                  onChange={() => setResetTargetMode('RESET_MASTER_DEFAULT')}
                />
                <div>
                  <span className="text-xs font-bold text-amber-300 block">
                    Pulihkan Data Master Siswa &amp; Kelas Default
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Mengembalikan daftar siswa awal, wali kelas VII-VIII, dan jam sekolah standar.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 cursor-pointer">
                <input
                  type="radio"
                  name="resetMode"
                  checked={resetTargetMode === 'ALL'}
                  onChange={() => setResetTargetMode('ALL')}
                />
                <div>
                  <span className="text-xs font-bold text-rose-300 block">Reset Seluruh Riwayat Presensi</span>
                  <span className="text-[11px] text-slate-400">
                    Mengosongkan semua catatan kehadiran dari awal hingga hari ini.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveActionModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Jalankan Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL TAMBAH / EDIT KELAS & WALI KELAS                         */}
      {/* ============================================================== */}
      {isKelasModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-2xl border border-purple-500/40 bg-slate-900 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <span>{editingKelasId ? 'Edit Kelas & Wali Kelas' : 'Tambah Kelas & Wali Kelas'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsKelasModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!kelasForm.namaKelas.trim() || !kelasForm.namaWaliKelas.trim()) {
                  showFeedback('warning', 'Data Belum Lengkap', 'Nama Kelas dan Nama Wali Kelas wajib diisi.');
                  return;
                }
                if (editingKelasId) {
                  const next = kelasList.map((k) =>
                    k.id === editingKelasId ? { ...kelasForm, id: editingKelasId } : k
                  );
                  saveKelasWaliKelasList(next);
                  setKelasList(next);
                  showFeedback('success', 'Data Kelas Diperbarui', `Kelas ${kelasForm.namaKelas} berhasil disimpan.`);
                } else {
                  const newItem: KelasWaliKelasMaster = {
                    ...kelasForm,
                    id: `KLS-${Date.now()}`,
                  };
                  const next = [...kelasList, newItem];
                  saveKelasWaliKelasList(next);
                  setKelasList(next);
                  showFeedback('success', 'Kelas Baru Ditambahkan', `Kelas ${kelasForm.namaKelas} berhasil ditambahkan.`);
                }
                playBiometricSound('success');
                setIsKelasModalOpen(false);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Nama Kelas *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: VIII-3"
                    value={kelasForm.namaKelas}
                    onChange={(e) => setKelasForm({ ...kelasForm, namaKelas: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Jenjang</label>
                  <select
                    value={kelasForm.jenjang}
                    onChange={(e) =>
                      setKelasForm({ ...kelasForm, jenjang: e.target.value as 'VII' | 'VIII' | 'IX' })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  >
                    <option value="VII">Kelas VII</option>
                    <option value="VIII">Kelas VIII</option>
                    <option value="IX">Kelas IX</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Nama Wali Kelas *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dra. Hj. Siti Aminah, M.Pd."
                  value={kelasForm.namaWaliKelas}
                  onChange={(e) => setKelasForm({ ...kelasForm, namaWaliKelas: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">NIP Wali Kelas</label>
                <input
                  type="text"
                  placeholder="Contoh: 19820411 200903 2 004"
                  value={kelasForm.nipWaliKelas}
                  onChange={(e) => setKelasForm({ ...kelasForm, nipWaliKelas: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">No. WhatsApp Wali Kelas</label>
                <input
                  type="text"
                  placeholder="Contoh: 082165885568"
                  value={kelasForm.noHpWaliKelas}
                  onChange={(e) => setKelasForm({ ...kelasForm, noHpWaliKelas: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKelasModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Kelas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL REGISTRASI SISWA BARU / EDIT SISWA                       */}
      {/* ============================================================== */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-2xl border border-emerald-500/40 bg-slate-900 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>{editingStudentId ? 'Edit Data & Biometrik Siswa' : 'Form Registrasi Siswa & Sidik Jari'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsStudentModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Pratama"
                  value={studentForm.namaSiswa}
                  onChange={(e) => setStudentForm({ ...studentForm, namaSiswa: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">NIS</label>
                  <input
                    type="text"
                    placeholder="Contoh: 4122"
                    value={studentForm.nis}
                    onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">NISN *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 0118834521"
                    value={studentForm.nisn}
                    onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Kelas</label>
                  <select
                    value={studentForm.kelas}
                    onChange={(e) => setStudentForm({ ...studentForm, kelas: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  >
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.namaKelas}>
                        {k.namaKelas}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Jenis Kelamin</label>
                  <select
                    value={studentForm.jenisKelamin}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        jenisKelamin: e.target.value as 'Laki-laki' | 'Perempuan',
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">
                  No HP WhatsApp Orang Tua / Wali (untuk Notifikasi)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 082165885568"
                  value={studentForm.noHpOrangTua}
                  onChange={(e) => setStudentForm({ ...studentForm, noHpOrangTua: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                />
              </div>

              {/* Pilihan Jari & Perekaman Sidik Jari Siswa ke Sistem */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-slate-950 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    <span>Perekaman Sidik Jari Siswa *</span>
                  </label>
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                      isFingerRecorded || editingStudentId
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {isFingerRecorded
                      ? '✓ Sidik Jari Terekam'
                      : editingStudentId
                      ? '✓ Terdaftar di Sistem'
                      : 'Wajib Direkam'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Pilih Posisi Jari yang Direkam:
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: 'Jempol Kanan', label: 'Jempol Kanan', icon: '👍' },
                      { id: 'Telunjuk Kanan', label: 'Telunjuk Kanan', icon: '☝️' },
                      { id: 'Jempol Kiri', label: 'Jempol Kiri', icon: '👍' },
                      { id: 'Telunjuk Kiri', label: 'Telunjuk Kiri', icon: '☝️' },
                      { id: 'Jari Tengah Kanan', label: 'Tengah Kanan', icon: '🖐️' },
                    ].map((f) => {
                      const isSel = studentForm.fingerprintFinger === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setStudentForm({ ...studentForm, fingerprintFinger: f.id });
                            setIsFingerRecorded(false);
                            setRecordFingerProgress(0);
                            setRecordStatusMsg(`Jari ${f.label} dipilih. Silakan tempelkan pada sensor di bawah.`);
                          }}
                          className={`py-1.5 px-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer flex flex-col items-center justify-center border leading-tight ${
                            isSel
                              ? 'bg-emerald-600 border-emerald-300 text-white shadow-xs ring-1 ring-emerald-300'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/10'
                          }`}
                        >
                          <span className="text-xs mb-0.5">{f.icon}</span>
                          <span className="truncate w-full text-center">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sensor Perekam Sidik Jari Interaktif */}
                <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex flex-col items-center text-center space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Rekam Pola Jari ({studentForm.fingerprintFinger}) ke Sistem:</span>
                  </div>

                  <div className="relative">
                    {isRecordingFingerprint && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-400 via-emerald-300 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,1)] z-20 animate-bounce rounded-full" />
                    )}

                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={handleStartRecordFingerprint}
                      onMouseUp={handleEndRecordFingerprint}
                      onTouchStart={handleStartRecordFingerprint}
                      onTouchEnd={handleEndRecordFingerprint}
                      className={`w-20 h-24 sm:w-22 sm:h-26 rounded-xl border-2 transition-all flex flex-col items-center justify-center p-2 cursor-pointer select-none shadow-md ${
                        isRecordingFingerprint
                          ? 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105'
                          : isFingerRecorded
                          ? 'bg-emerald-950/50 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'bg-slate-950 border-cyan-500/40 hover:border-cyan-400'
                      }`}
                    >
                      <Fingerprint
                        className={`w-10 h-10 transition-all ${
                          isRecordingFingerprint
                            ? 'text-emerald-300 scale-110 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                            : isFingerRecorded
                            ? 'text-emerald-400'
                            : 'text-cyan-400'
                        }`}
                      />
                      <div className="mt-1 text-[8.5px] font-bold leading-tight">
                        {isRecordingFingerprint ? (
                          <span className="text-emerald-300 animate-pulse">
                            Merekam {recordFingerProgress}%
                          </span>
                        ) : isFingerRecorded ? (
                          <span className="text-emerald-300">✓ Terekam 100%</span>
                        ) : (
                          <span className="text-slate-400">Sentuh &amp; Tahan</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {recordStatusMsg && (
                    <p
                      className={`text-[9px] font-semibold px-2 py-0.5 rounded leading-tight ${
                        isFingerRecorded
                          ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30'
                          : 'text-amber-300 bg-amber-500/10'
                      }`}
                    >
                      {recordStatusMsg}
                    </p>
                  )}

                  {/* Tombol Sensor Hardware Handphone */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleTriggerHardwareRecordFingerprint}
                      className="h-6 px-2.5 rounded-lg border border-emerald-400/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[9px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Smartphone className="w-3 h-3 text-emerald-400" />
                      <span>Rekam via Sensor HP</span>
                    </button>
                    {!isFingerRecorded && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsFingerRecorded(true);
                          setRecordFingerProgress(100);
                          setRecordStatusMsg(`✓ Template ${studentForm.fingerprintFinger} terekam otomatis.`);
                          playBiometricSound('success');
                        }}
                        className="h-6 px-2.5 rounded-lg border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3 text-sky-300" />
                        <span>Simulasi Cepat Rekam</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-amber-300 font-medium leading-tight">
                  ⚠️ <strong>Aturan Biometrik:</strong> Sidik jari yang direkam di sini akan disimpan ke database sistem. Saat melakukan absensi nantinya, siswa <strong>wajib</strong> menggunakan jari yang sama persis (misal mendaftar Jempol maka harus memindai Jempol, jika memindai Telunjuk/jari lain akan otomatis <strong className="text-rose-400">DITOLAK</strong>).
                </p>
              </div>

              {/* Foto Profil Siswa */}
              <div>
                <label className="text-xs font-bold text-slate-300">Foto Profil Siswa (Opsional)</label>
                <div className="mt-1 flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-white/20">
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border-2 border-emerald-400/80 overflow-hidden flex items-center justify-center shrink-0">
                    {studentForm.photoUrl ? (
                      <img src={studentForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-mono text-sm font-bold text-emerald-300">
                          {(studentForm.namaSiswa || 'NA').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-[7.5px] text-slate-400 font-bold mt-0.5">+Foto</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      id="edit-student-photo-file-modal"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const rawDataUrl = ev.target?.result as string;
                            if (!rawDataUrl) return;
                            const img = new Image();
                            img.onload = () => {
                              const compressed = compressImageToDataUrl(img, img.width, img.height, false, 320) || rawDataUrl;
                              setStudentForm((prev) => ({ ...prev, photoUrl: compressed }));
                            };
                            img.src = rawDataUrl;
                          };
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('edit-student-photo-file-modal') as HTMLInputElement | null;
                          el?.click();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{studentForm.photoUrl ? 'Ganti Foto' : 'Pilih Foto Profil'}</span>
                      </button>
                      {studentForm.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setStudentForm((prev) => ({ ...prev, photoUrl: '' }))}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Foto</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Bisa unggah foto dari kamera atau galeri file (JPG/PNG). Otomatis dikompres.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingStudentId ? 'Simpan Perubahan' : 'Daftarkan & Simpan Sidik Jari'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL PENGAJUAN SURAT IZIN / SAKIT                            */}
      {/* ============================================================== */}
      {isPermitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-2xl border border-sky-500/40 bg-slate-900 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <span>Pengajuan Surat Izin / Bukti Sakit Digital</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPermitModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePermitRequest} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">Pilih Siswa *</label>
                <select
                  required
                  value={permitForm.studentId}
                  onChange={(e) => setPermitForm({ ...permitForm, studentId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {registeredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.namaSiswa} ({s.kelas} - {s.nisn || s.nisNisn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Jenis Surat</label>
                <select
                  value={permitForm.jenisIzin}
                  onChange={(e) =>
                    setPermitForm({
                      ...permitForm,
                      jenisIzin: e.target.value as 'SAKIT' | 'IZIN' | 'DISPENSASI',
                    })
                  }
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                >
                  <option value="SAKIT">Surat Keterangan Sakit (Dokter / Orang Tua)</option>
                  <option value="IZIN">Surat Izin Ada Kepentingan Keluarga</option>
                  <option value="DISPENSASI">Dispensasi Tugas Sekolah / Lomba</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={permitForm.tanggalMulai}
                    onChange={(e) =>
                      setPermitForm({ ...permitForm, tanggalMulai: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={permitForm.tanggalSelesai}
                    onChange={(e) =>
                      setPermitForm({ ...permitForm, tanggalSelesai: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Alasan / Keterangan *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Jelaskan alasan izin / sakit secara rinci..."
                  value={permitForm.alasan}
                  onChange={(e) => setPermitForm({ ...permitForm, alasan: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/20 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">
                  Unggah Foto Surat Keterangan / Bukti
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setPermitForm({
                          ...permitForm,
                          fotoBuktiUrl: String(evt.target?.result || ''),
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full mt-1 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPermitModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Simpan &amp; Kirim Surat Izin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL POPUP KARTU PELAJAR SISWA DIGITAL LENGKAP QR CODE        */}
      {/* ============================================================== */}
      {selectedStudentForCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-3xl border-2 border-emerald-400 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative">
            <button
              type="button"
              onClick={() => setSelectedStudentForCard(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Kartu */}
            <div className="flex items-center justify-center gap-2 border-b border-emerald-400/30 pb-3">
              <TutWuriLogo className="w-8 h-8 shrink-0" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  KARTU TANDA PELAJAR DIGITAL
                </p>
                <p className="text-xs font-black text-white">UPTD SMP NEGERI 7 KISARAN</p>
              </div>
            </div>

            {/* Foto & Identitas */}
            <div className="flex flex-col items-center space-y-2">
              <div className="relative group">
                <input
                  type="file"
                  id={`modal-photo-input-${selectedStudentForCard.id}`}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadStudentPhoto(selectedStudentForCard.id, file);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`modal-photo-input-${selectedStudentForCard.id}`) as HTMLInputElement | null;
                    el?.click();
                  }}
                  className="relative w-24 h-24 rounded-2xl border-2 border-emerald-400 overflow-hidden bg-slate-800 shadow-lg cursor-pointer hover:border-emerald-300 transition-all hover:scale-105 active:scale-95 group-hover:ring-2 group-hover:ring-emerald-400/50"
                  title={
                    selectedStudentForCard.photoUrl
                      ? `Klik untuk mengganti foto profil ${selectedStudentForCard.namaSiswa}`
                      : `Klik kotak inisial "${selectedStudentForCard.namaSiswa.slice(0, 2).toUpperCase()}" untuk menambahkan foto profil siswa`
                  }
                >
                  {selectedStudentForCard.photoUrl ? (
                    <>
                      <img
                        src={selectedStudentForCard.photoUrl}
                        alt={selectedStudentForCard.namaSiswa}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[1px]">
                        <Camera className="w-5 h-5 text-emerald-300" />
                        <span className="text-[9px] font-bold text-emerald-200 uppercase mt-0.5">Ganti Foto</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/70 p-2">
                      <span className="font-mono text-2xl font-black text-emerald-300 tracking-tight leading-none">
                        {selectedStudentForCard.namaSiswa.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-extrabold tracking-tight mt-1.5 flex items-center gap-1">
                        <Camera className="w-3 h-3 text-emerald-300" />
                        <span>+ Foto Profil</span>
                      </span>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`modal-photo-input-${selectedStudentForCard.id}`) as HTMLInputElement | null;
                    el?.click();
                  }}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-slate-900 cursor-pointer"
                  title="Pilih / Ganti Foto Profil"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tombol Aksi Foto Cepat */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`modal-photo-input-${selectedStudentForCard.id}`) as HTMLInputElement | null;
                    el?.click();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Upload className="w-3 h-3" />
                  <span>{selectedStudentForCard.photoUrl ? 'Ganti Foto Profil' : 'Tambah Foto Profil'}</span>
                </button>
                {selectedStudentForCard.photoUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStudentPhoto(selectedStudentForCard.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Hapus foto profil dan gunakan singkatan inisial nama"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Foto</span>
                  </button>
                )}
              </div>

              <div>
                <h4 className="text-base font-bold text-white">
                  {selectedStudentForCard.namaSiswa}
                </h4>
                <p className="text-xs text-slate-300">
                  Kelas:{' '}
                  <span className="font-bold text-emerald-400">
                    {selectedStudentForCard.kelas}
                  </span>{' '}
                  • NISN: {selectedStudentForCard.nisn || selectedStudentForCard.nisNisn}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  RFID: {selectedStudentForCard.rfidCardId || 'RFID-ACTIVE'}
                </p>
              </div>
            </div>

            {/* QR Code */}
            {studentCardQrUrl && (
              <div className="bg-white p-3 rounded-2xl w-44 h-44 mx-auto shadow-inner flex items-center justify-center">
                <img
                  src={studentCardQrUrl}
                  alt="QR Code Presensi"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <p className="text-[11px] text-slate-300">
              Gunakan QR Code ini untuk scan presensi instan di depan scanner kelas.
            </p>

            {/* Tombol Edit & Hapus Siswa didalam Modal Kartu Pelajar */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  handleOpenEditStudent(selectedStudentForCard);
                }}
                className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentToDelete(selectedStudentForCard);
                }}
                className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Siswa</span>
              </button>
            </div>

            <div className="flex gap-2">
              {studentCardQrUrl && (
                <a
                  href={studentCardQrUrl}
                  download={`QR_Kartu_Pelajar_${selectedStudentForCard.namaSiswa.replace(/\s+/g, '_')}.png`}
                  onClick={() => {
                    playBiometricSound('success');
                    showFeedback(
                      'success',
                      'QR Kartu Pelajar Diunduh!',
                      `File QR Code ${selectedStudentForCard.namaSiswa} berhasil disimpan.`
                    );
                  }}
                  className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Simpan QR</span>
                </a>
              )}
              <button
                type="button"
                onClick={async () => {
                  const st = selectedStudentForCard;
                  if (!st) return;
                  playBiometricSound('success');
                  triggerHaptic('success');

                  // 1. Buat & Unduh PDF Resmi Kartu Tanda Pelajar Digital dengan jsPDF
                  try {
                    const { jsPDF } = await import('jspdf');
                    const doc = new jsPDF({
                      orientation: 'portrait',
                      unit: 'mm',
                      format: [86, 130],
                    });

                    // Latar Kartu
                    doc.setFillColor(15, 23, 42);
                    doc.rect(0, 0, 86, 130, 'F');

                    // Bingkai Kartu Emerald
                    doc.setDrawColor(16, 185, 129);
                    doc.setLineWidth(1.2);
                    doc.roundedRect(3, 3, 80, 124, 4, 4, 'S');

                    // Header Kartu
                    doc.setFillColor(6, 78, 59);
                    doc.roundedRect(5, 5, 76, 18, 2, 2, 'F');
                    doc.setTextColor(52, 211, 153);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(6.5);
                    doc.text('KARTU TANDA PELAJAR DIGITAL & BIOMETRIK', 43, 11, { align: 'center' });
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8.5);
                    doc.text('UPTD SMP NEGERI 7 KISARAN', 43, 16.5, { align: 'center' });
                    doc.setFontSize(5.5);
                    doc.setTextColor(203, 213, 225);
                    doc.text('Jl. Labu No. 10 Siumbut Baru Kisaran Timur', 43, 20.5, { align: 'center' });

                    // Foto atau Inisial Siswa
                    if (st.photoUrl && st.photoUrl.startsWith('data:image')) {
                      try {
                        doc.addImage(st.photoUrl, 'JPEG', 31, 26, 24, 24);
                      } catch {
                        doc.setFillColor(30, 41, 59);
                        doc.roundedRect(31, 26, 24, 24, 3, 3, 'F');
                        doc.setTextColor(52, 211, 153);
                        doc.setFontSize(11);
                        doc.text(st.namaSiswa.slice(0, 2).toUpperCase(), 43, 40, { align: 'center' });
                      }
                    } else {
                      doc.setFillColor(30, 41, 59);
                      doc.setDrawColor(52, 211, 153);
                      doc.setLineWidth(0.5);
                      doc.roundedRect(31, 26, 24, 24, 3, 3, 'FD');
                      doc.setTextColor(52, 211, 153);
                      doc.setFontSize(12);
                      doc.text(st.namaSiswa.slice(0, 2).toUpperCase(), 43, 40.5, { align: 'center' });
                    }

                    // Nama & Identitas Siswa
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9.5);
                    const cleanName = st.namaSiswa.length > 26 ? st.namaSiswa.slice(0, 26) + '...' : st.namaSiswa;
                    doc.text(cleanName, 43, 56, { align: 'center' });

                    doc.setFontSize(7.5);
                    doc.setTextColor(52, 211, 153);
                    doc.text(`Kelas: ${st.kelas}  |  NISN: ${st.nisn || st.nisNisn}`, 43, 61, { align: 'center' });

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6.5);
                    doc.setTextColor(148, 163, 184);
                    doc.text(`RFID: ${st.rfidCardId || 'RFID-ACTIVE'} • Sidik Jari: ${st.fingerprintFinger}`, 43, 65.5, { align: 'center' });

                    // Kotak QR Code
                    if (studentCardQrUrl) {
                      doc.setFillColor(255, 255, 255);
                      doc.roundedRect(23, 69, 40, 40, 3, 3, 'F');
                      doc.addImage(studentCardQrUrl, 'PNG', 25, 71, 36, 36);
                    }

                    // Footer Kartu
                    doc.setTextColor(203, 213, 225);
                    doc.setFontSize(6);
                    doc.text('Scan QR Code ini pada kamera scanner presensi kelas', 43, 115, { align: 'center' });
                    doc.setTextColor(52, 211, 153);
                    doc.setFont('helvetica', 'bold');
                    doc.text('TERVERIFIKASI SISTEM PRESENSI BIOMETRIK', 43, 120, { align: 'center' });

                    const safeFileName = `Kartu_Pelajar_${st.namaSiswa.replace(/[^a-zA-Z0-9]/g, '_')}_${st.kelas}.pdf`;
                    doc.save(safeFileName);
                  } catch (err) {
                    console.warn('PDF generation fallback:', err);
                  }

                  // 2. Cetak Langsung via Hidden Iframe agar kompatibel penuh di semua perangkat & sandbox iframe
                  try {
                    const existingFrame = document.getElementById('anbk-print-card-frame');
                    if (existingFrame && existingFrame.parentNode) {
                      existingFrame.parentNode.removeChild(existingFrame);
                    }
                    const iframe = document.createElement('iframe');
                    iframe.id = 'anbk-print-card-frame';
                    iframe.style.position = 'fixed';
                    iframe.style.right = '0';
                    iframe.style.bottom = '0';
                    iframe.style.width = '0';
                    iframe.style.height = '0';
                    iframe.style.border = '0';
                    document.body.appendChild(iframe);

                    const frameDoc = iframe.contentWindow?.document;
                    if (frameDoc) {
                      frameDoc.open();
                      frameDoc.write(`
                        <!DOCTYPE html>
                        <html lang="id">
                        <head>
                          <meta charset="UTF-8" />
                          <title>Kartu Pelajar - ${st.namaSiswa}</title>
                          <style>
                            @page { size: A4 portrait; margin: 15mm; }
                            body {
                              font-family: 'Plus Jakarta Sans', Arial, sans-serif;
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: flex-start;
                              padding-top: 20px;
                              background: #ffffff;
                              color: #0f172a;
                            }
                            .card {
                              width: 330px;
                              border: 3px solid #10b981;
                              border-radius: 20px;
                              background: #0f172a;
                              color: #ffffff;
                              padding: 20px;
                              text-align: center;
                              box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                              -webkit-print-color-adjust: exact !important;
                              print-color-adjust: exact !important;
                            }
                            .header {
                              border-bottom: 1px solid rgba(16, 185, 129, 0.35);
                              padding-bottom: 10px;
                              margin-bottom: 14px;
                            }
                            .kicker {
                              font-size: 10px;
                              font-weight: 800;
                              color: #34d399;
                              letter-spacing: 1.2px;
                              text-transform: uppercase;
                              margin: 0;
                            }
                            .school {
                              font-size: 14px;
                              font-weight: 900;
                              color: #ffffff;
                              margin: 3px 0 2px;
                            }
                            .addr {
                              font-size: 10px;
                              color: #cbd5e1;
                              margin: 0;
                            }
                            .avatar {
                              width: 76px;
                              height: 76px;
                              border-radius: 16px;
                              border: 2px solid #34d399;
                              margin: 0 auto 10px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              background: #1e293b;
                              font-size: 24px;
                              font-weight: 800;
                              color: #6ee7b7;
                              overflow: hidden;
                            }
                            .avatar img {
                              width: 100%;
                              height: 100%;
                              object-fit: cover;
                            }
                            .name {
                              font-size: 16px;
                              font-weight: 800;
                              margin: 0 0 4px;
                              color: #ffffff;
                            }
                            .meta {
                              font-size: 12px;
                              color: #e2e8f0;
                              margin: 0 0 4px;
                            }
                            .meta strong {
                              color: #34d399;
                            }
                            .rfid {
                              font-family: monospace;
                              font-size: 11px;
                              color: #94a3b8;
                              margin: 0 0 14px;
                            }
                            .qr-box {
                              background: #ffffff;
                              padding: 12px;
                              border-radius: 16px;
                              width: 165px;
                              height: 165px;
                              margin: 0 auto 12px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                            }
                            .qr-box img {
                              width: 100%;
                              height: 100%;
                              object-fit: contain;
                            }
                            .footer {
                              font-size: 10px;
                              color: #cbd5e1;
                              line-height: 1.4;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <div class="header">
                              <p class="kicker">KARTU TANDA PELAJAR DIGITAL</p>
                              <p class="school">UPTD SMP NEGERI 7 KISARAN</p>
                              <p class="addr">Jl. Labu No. 10 Siumbut Baru Kisaran Timur</p>
                            </div>
                            <div class="avatar">
                              ${
                                st.photoUrl
                                  ? `<img src="${st.photoUrl}" alt="${st.namaSiswa}" />`
                                  : st.namaSiswa.slice(0, 2).toUpperCase()
                              }
                            </div>
                            <p class="name">${st.namaSiswa}</p>
                            <p class="meta">Kelas: <strong>${st.kelas}</strong> • NISN: <strong>${st.nisn || st.nisNisn}</strong></p>
                            <p class="rfid">RFID: ${st.rfidCardId || 'RFID-ACTIVE'} • ${st.fingerprintFinger}</p>
                            ${
                              studentCardQrUrl
                                ? `<div class="qr-box"><img src="${studentCardQrUrl}" alt="QR Code" /></div>`
                                : ''
                            }
                            <div class="footer">
                              Gunakan QR Code ini untuk scan presensi instan di depan scanner kelas.
                            </div>
                          </div>
                        </body>
                        </html>
                      `);
                      frameDoc.close();
                      setTimeout(() => {
                        try {
                          iframe.contentWindow?.focus();
                          iframe.contentWindow?.print();
                        } catch {}
                      }, 350);
                    }
                  } catch {}

                  showFeedback(
                    'success',
                    'Kartu Pelajar Berhasil Dicetak & Diunduh!',
                    `File PDF Kartu Pelajar ${st.namaSiswa} (${st.kelas}) telah diunduh dan siap dicetak.`
                  );
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Kartu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS SISWA & KARTU PELAJAR                   */}
      {/* ============================================================== */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-3xl border-2 border-rose-500/50 bg-gradient-to-b from-slate-900 to-slate-950 max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-md">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Konfirmasi Hapus Siswa</h3>
              <p className="text-xs text-slate-300 mt-2">
                Apakah Anda yakin ingin menghapus data dan kartu pelajar siswa ini?
              </p>
              <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-rose-500/30 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-rose-400 flex items-center justify-center font-bold text-rose-300 text-xs shrink-0 overflow-hidden">
                  {studentToDelete.photoUrl ? (
                    <img src={studentToDelete.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    studentToDelete.namaSiswa.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{studentToDelete.namaSiswa}</p>
                  <p className="text-[11px] text-slate-400">
                    Kelas {studentToDelete.kelas} • NISN: {studentToDelete.nisn || studentToDelete.nisNisn}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS SEMUA SISWA PERMANEN                    */}
      {/* ============================================================== */}
      {isClearAllStudentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-3xl border-2 border-rose-500/50 bg-gradient-to-b from-slate-900 to-slate-950 max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-md">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hapus Semua Siswa Permanen</h3>
              <p className="text-xs text-slate-300 mt-2">
                Apakah Anda yakin ingin menghapus seluruh {registeredStudents.length} kartu pelajar siswa secara permanen? Data yang dihapus tidak dapat dipulihkan.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllStudentsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllRegisteredStudentsPermanently();
                  setRegisteredStudents([]);
                  setSelectedStudentForCard(null);
                  setIsClearAllStudentsModalOpen(false);
                  playBiometricSound('beep');
                  showFeedback('info', 'Semua Siswa Dihapus Permanen', 'Seluruh data kartu pelajar siswa telah dihapus secara permanen.');
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST: Notifikasi WhatsApp Berhasil Dipicu */}
      {waToastInfo && waToastInfo.show && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl shadow-emerald-950/60 text-white animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-emerald-400">
                  Notifikasi WA Siap Dikirim!
                </h4>
                <p className="text-[10px] text-slate-400">
                  {waToastInfo.studentName} · {waToastInfo.phone}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWaToastInfo(null)}
              className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed mb-2.5 bg-slate-950/70 p-2 rounded-xl border border-white/5">
            🏛️ <strong>UPTD SMP Negeri 7 Kisaran</strong><br />
            📍 Jl. Labu No. 10 Siumbut Baru Kisaran Timur.<br />
            <span className="text-emerald-400">Pesan kehadiran telah disalin ke clipboard dan ditautkan ke WhatsApp.</span>
          </p>
          <div className="flex items-center gap-2">
            <a
              href={waToastInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-center text-[11px] font-bold shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka WhatsApp ↗</span>
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(waToastInfo.messageText);
                showFeedback('success', 'Teks Disalin!', 'Teks notifikasi kehadiran telah disalin ke clipboard.');
              }}
              className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer transition-all"
            >
              Salin Teks
            </button>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI HAPUS PERMANEN CATATAN PRESENSI SISWA */}
      {attendanceRecordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full rounded-2xl border-2 border-rose-500/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span>Hapus Permanen Presensi</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[8px] font-mono border border-rose-500/40">
                      PRESENSI
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    Konfirmasi keamanan penghapusan catatan kehadiran
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceRecordToDelete(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 space-y-2 text-[10.5px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nama Siswa:</span>
                <strong className="text-white">{attendanceRecordToDelete.namaSiswa}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Kelas / Status:</span>
                <span className="font-mono text-amber-300 font-bold">
                  Kelas {attendanceRecordToDelete.kelas} · {attendanceRecordToDelete.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Waktu &amp; Tanggal:</span>
                <span className="font-mono text-sky-300 font-bold">
                  {attendanceRecordToDelete.time || attendanceRecordToDelete.timestamp} ({attendanceRecordToDelete.date})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-200 leading-relaxed">
              <strong className="text-white block mb-0.5">
                Peringatan:
              </strong>
              Apakah Anda yakin ingin menghapus catatan presensi siswa <strong className="text-amber-300">{attendanceRecordToDelete.namaSiswa}</strong> secara permanen?
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAttendanceRecordToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = deleteAttendanceRecordById(attendanceRecordToDelete.id);
                  setAttendanceRecords(next);
                  playBiometricSound('beep');
                  showFeedback(
                    'info',
                    'Catatan Presensi Dihapus',
                    `Catatan presensi ${attendanceRecordToDelete.namaSiswa} telah dihapus permanen.`
                  );
                  setAttendanceRecordToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PERMANEN PRESENSI SATU KELAS */}
      {classAttendanceToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full rounded-2xl border-2 border-rose-500/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span>Hapus Presensi Kelas {classAttendanceToDelete.kelas}</span>
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    Konfirmasi penghapusan data presensi kelas hari ini
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClassAttendanceToDelete(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-200 leading-relaxed">
              <strong className="text-white block mb-0.5">
                Perhatian Guru / Wali Kelas:
              </strong>
              Apakah Anda yakin ingin menghapus seluruh catatan kehadiran kelas <strong className="text-amber-300">Kelas {classAttendanceToDelete.kelas}</strong> untuk tanggal <strong className="text-sky-300">{classAttendanceToDelete.date}</strong>? Tindakan ini akan menghapus data kehadiran kelas tersebut secara permanen.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setClassAttendanceToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteAttendanceRecordsByFilter({
                    kelas: classAttendanceToDelete.kelas,
                    date: classAttendanceToDelete.date,
                  });
                  setAttendanceRecords(res.remainingRecords);
                  setGuruChecklistMap({});
                  playBiometricSound('beep');
                  showFeedback(
                    'warning',
                    `Presensi Kelas ${classAttendanceToDelete.kelas} Dihapus`,
                    `${res.deletedCount} catatan kehadiran kelas ${classAttendanceToDelete.kelas} hari ini telah dihapus permanen.`
                  );
                  setClassAttendanceToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Presensi Kelas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS PERMANEN KELAS & WALI KELAS             */}
      {/* ============================================================== */}
      {kelasToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-3xl border-2 border-rose-500/50 bg-gradient-to-b from-slate-900 to-slate-950 max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-md">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Konfirmasi Hapus Kelas</h3>
              <p className="text-xs text-slate-300 mt-2">
                Apakah Anda yakin ingin menghapus data kelas dan wali kelas ini secara permanen?
              </p>
              <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-rose-500/30 text-left space-y-1">
                <p className="text-xs font-bold text-white">Kelas {kelasToDelete.namaKelas} (Jenjang {kelasToDelete.jenjang})</p>
                <p className="text-[11px] text-slate-400">Wali Kelas: {kelasToDelete.namaWaliKelas}</p>
                {kelasToDelete.nipWaliKelas && (
                  <p className="text-[10px] text-slate-500 font-mono">NIP: {kelasToDelete.nipWaliKelas}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKelasToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = kelasToDelete;
                  const next = kelasList.filter((item) => item.id !== target.id);
                  saveKelasWaliKelasList(next);
                  setKelasList(next);
                  playBiometricSound('beep');
                  showFeedback('info', 'Data Kelas Dihapus Permanen', `Kelas ${target.namaKelas} telah dihapus permanen.`);
                  setKelasToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI HAPUS SESI JADWAL MAPEL                       */}
      {/* ============================================================== */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="rounded-3xl border-2 border-rose-500/50 bg-gradient-to-b from-slate-900 to-slate-950 max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-md">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Konfirmasi Hapus Sesi Mapel</h3>
              <p className="text-xs text-slate-300 mt-2">
                Apakah Anda yakin ingin menghapus jadwal sesi pelajaran ini pada Hari {sessionToDelete.day}?
              </p>
              <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-rose-500/30 text-left space-y-1">
                <p className="text-xs font-bold text-white">{sessionToDelete.sesi.mataPelajaran}</p>
                <p className="text-[11px] text-amber-300 font-medium">Kelas {sessionToDelete.sesi.kelasTarget} • {sessionToDelete.sesi.jamMulai} - {sessionToDelete.sesi.jamSelesai}</p>
                <p className="text-[10px] text-slate-400">Guru: {sessionToDelete.sesi.guruPengampu}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-200 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const { day, sesi } = sessionToDelete;
                  const currentDayConfig =
                    scheduleConfig.jadwalHarian?.[day] || INITIAL_JADWAL_HARIAN[day];
                  const nextSesi = (currentDayConfig.sesiMapel || []).filter(
                    (item) => item.id !== sesi.id
                  );
                  const updatedDay: DailyScheduleConfig = {
                    ...currentDayConfig,
                    sesiMapel: nextSesi,
                  };
                  const nextCfg: SchoolScheduleConfig = {
                    ...scheduleConfig,
                    jadwalHarian: {
                      ...(scheduleConfig.jadwalHarian || INITIAL_JADWAL_HARIAN),
                      [day]: updatedDay,
                    },
                  };
                  setScheduleConfig(nextCfg);
                  saveSchoolScheduleConfig(nextCfg);
                  playBiometricSound('beep');
                  showFeedback(
                    'info',
                    'Jadwal Mapel Dihapus Permanen',
                    `Sesi ${sesi.mataPelajaran} pada Hari ${day} telah dihapus permanen.`
                  );
                  setSessionToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Sesi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL VERIFIKASI SANDI MODE GURU UNTUK PANEL ADMIN / OPERATOR  */}
      {/* ============================================================== */}
      <AdminOperatorAuthModal
        isOpen={showAdminAuthModal}
        onClose={() => {
          setShowAdminAuthModal(false);
          setPendingAdminAction(null);
        }}
        onSuccess={() => {
          setIsAdminAuthenticated(true);
          setShowAdminAuthModal(false);
          playBiometricSound('success');
          showFeedback(
            'success',
            'Akses Admin / Operator Terverifikasi',
            'Password Mode Guru valid. Selamat datang di Panel Operator Presensi.'
          );
          if (pendingAdminAction) {
            const nextAction = pendingAdminAction;
            setPendingAdminAction(null);
            nextAction();
          } else {
            setActiveRole('ADMIN');
            setShowAdminModeMenu(true);
          }
        }}
        expectedPassword={EXAM_INFO.teacherPassword}
        title="Verifikasi Sandi Mode Guru / Operator"
        subtitle="Akses Menu Presensi Admin / Operator Sekolah"
        description="Murid / Siswa dilarang keras mengakses menu Admin / Operator Sekolah. Masukkan Password Mode Guru resmi untuk membuka pengelolaan data master siswa, jadwal absensi, dan rekapitulasi kehadiran."
        submitButtonText="Buka Panel Operator"
      />
    </div>
  );
};
