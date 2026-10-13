import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import {
  StudentSubmission,
  EXAM_INFO,
  getCleanKelas,
  ResetSubmissionsFilter,
  resetStudentTokenQuotaByStudent,
  clearUsedExamTokens,
  clearAllStudentSeenQuestionsHistory,
  isSubmissionMatchingResetFilter,
  deleteSingleSubmissionPermanently,
  deleteMultipleSubmissionsPermanently,
  getInitialCloudConfig,
  sanitizeRekapSheetUrl,
} from '../data/examData';
import {
  getPhotoForStudentIdentity,
  savePhotoForStudentIdentity,
  compressImageToDataUrl,
  generateFormalStudentAvatarDataUrl,
  STUDENT_PHOTOS_MAP_STORAGE_KEY,
  StudentAvatarPresetStyle,
  StudentPhotoBgColor,
} from './StudentCameraProfileModal';
import {
  ClassroomSeatStudent,
  STORAGE_KEY_STUDENTS,
  STORAGE_KEY_ACTIVE_SYNC,
} from '../utils/classroomSync';
import { TutWuriLogo } from './TutWuriLogo';
import { ResetSubmissionsModal } from './ResetSubmissionsModal';
import {
  MonitorCheck,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Smartphone,
  Laptop,
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  FileSpreadsheet,
  Download,
  Send,
  UserX,
  RotateCcw,
  Users,
  Check,
  X,
  ExternalLink,
  BookOpen,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  Radio,
  Sparkles,
  Award,
  GraduationCap,
  Trash2,
  Edit3,
  Camera,
  Upload,
  Plus,
  Image as ImageIcon,
  UserCheck,
  Printer,
} from 'lucide-react';

export interface MonitoredStudentItem {
  id: string;
  namaSiswa: string;
  nisNisn: string;
  kelas: string;
  semester: 'Ganjil' | 'Genap';
  examType: 'PILIHAN_BERGANDA' | 'ESAY_TEST';
  status: 'SEDANG_MENGERJAKAN' | 'SELESAI' | 'DISKUALIFIKASI';
  progresSoal: {
    terjawab: number;
    total: number;
    persentase: number;
    nomorAktif?: number;
  };
  nilaiAkhir?: number;
  skorBenar?: number;
  durasiDetik: number;
  violationCount: number;
  violationLogs: string[];
  deviceCategory: string;
  deviceBrand: string;
  deviceModel: string;
  deviceOsBrowser: string;
  clientIp: string;
  batteryLevel?: number;
  isBatteryCharging?: boolean;
  photoUrl?: string;
  lastActiveTimestamp: string;
  seatNumber?: number;
  rawSubmission?: StudentSubmission;
}

interface ExamMonitoringViewProps {
  submissions: StudentSubmission[];
  classroomStudents?: ClassroomSeatStudent[];
  activeExamDraft?: StudentSubmission | null;
  onlineToken?: string;
  headerJenjangFilter?: 'ALL' | 'VII' | 'VIII';
  onJenjangFilterChange?: (next: 'ALL' | 'VII' | 'VIII') => void;
  isTeacherAuthenticated?: boolean;
  onUnlockTeacherAuth?: () => void;
  onClearClassroomStudents?: () => void;
  onUpdateClassroomStudents?: (next: ClassroomSeatStudent[]) => void;
  onSyncRefresh?: () => void;
  onOpenClassroomDesign?: () => void;
  onResetAllSubmissions?: (
    filter?: ResetSubmissionsFilter,
    explicitToken?: string
  ) => Promise<any> | void;
  onUpdateSubmissions?: (s: StudentSubmission[]) => void;
}

export const ExamMonitoringView: React.FC<ExamMonitoringViewProps> = ({
  submissions,
  classroomStudents = [],
  activeExamDraft,
  onlineToken,
  headerJenjangFilter = 'ALL',
  onJenjangFilterChange,
  isTeacherAuthenticated = false,
  onUnlockTeacherAuth,
  onClearClassroomStudents,
  onUpdateClassroomStudents,
  onSyncRefresh,
  onOpenClassroomDesign,
  onResetAllSubmissions,
  onUpdateSubmissions,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJenjangFilter, setSelectedJenjangFilter] = useState<'ALL' | 'VII' | 'VIII'>(
    headerJenjangFilter || 'ALL'
  );
  const [selectedKelasFilter, setSelectedKelasFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    'ALL' | 'SEDANG_MENGERJAKAN' | 'SELESAI' | 'PELANGGARAN' | 'DISKUALIFIKASI'
  >('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    'ALL' | 'PILIHAN_BERGANDA' | 'ESAY_TEST'
  >('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  useEffect(() => {
    if (headerJenjangFilter) {
      setSelectedJenjangFilter(headerJenjangFilter);
    }
  }, [headerJenjangFilter]);

  const handleJenjangFilterChange = useCallback(
    (nextJenjang: 'ALL' | 'VII' | 'VIII') => {
      setSelectedJenjangFilter(nextJenjang);
      if (nextJenjang === 'VII') {
        setSelectedKelasFilter((prev) => {
          if (prev === 'ALL') return prev;
          const k = prev.toUpperCase();
          return k.includes('VII') && !k.includes('VIII') ? prev : 'ALL';
        });
      } else if (nextJenjang === 'VIII') {
        setSelectedKelasFilter((prev) => {
          if (prev === 'ALL') return prev;
          const k = prev.toUpperCase();
          return k.includes('VIII') ? prev : 'ALL';
        });
      }
      if (onJenjangFilterChange) {
        onJenjangFilterChange(nextJenjang);
      }
    },
    [onJenjangFilterChange]
  );

  // Live Auto-Refresh State
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(4); // seconds
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID')
  );

  // Audio Alerts
  const [isSoundAlertEnabled, setIsSoundAlertEnabled] = useState<boolean>(true);

  // Modal Detail Siswa
  const [selectedStudentDetail, setSelectedStudentDetail] =
    useState<MonitoredStudentItem | null>(null);

  // Modal Kirim Peringatan Pengawas
  const [warningModalStudent, setWarningModalStudent] =
    useState<MonitoredStudentItem | null>(null);
  const [customWarningMessage, setCustomWarningMessage] = useState<string>('');
  const [warningSuccessToast, setWarningSuccessToast] = useState<string | null>(null);

  // Otentikasi Khusus Guru untuk Akses Fitur Tombol Reset
  const [isLocalTeacherVerified, setIsLocalTeacherVerified] = useState<boolean>(
    () => Boolean(isTeacherAuthenticated)
  );
  const [showTeacherAuthGateModal, setShowTeacherAuthGateModal] = useState<boolean>(false);
  const [pendingTeacherAction, setPendingTeacherAction] = useState<
    | { type: 'RESET_ALL' }
    | { type: 'DELETE_FILTERED' }
    | {
        type: 'RESET_SINGLE';
        student: MonitoredStudentItem;
        mode: 'CLEAR_VIOLATIONS' | 'RESET_SESSION' | 'DELETE_SUBMISSION';
      }
    | null
  >(null);
  const [teacherAuthPasswordInput, setTeacherAuthPasswordInput] = useState<string>('');
  const [showTeacherAuthPass, setShowTeacherAuthPass] = useState<boolean>(false);
  const [teacherAuthError, setTeacherAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isTeacherAuthenticated) {
      setIsLocalTeacherVerified(true);
    }
  }, [isTeacherAuthenticated]);

  const isTeacherAccessUnlocked = Boolean(isTeacherAuthenticated || isLocalTeacherVerified);

  // Fitur Reset Data Rekap Monitoring Ujian
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isResettingSubmissions, setIsResettingSubmissions] = useState<boolean>(false);
  const [isResetSuccessActive, setIsResetSuccessActive] = useState<boolean>(false);
  const [resetCompletedTime, setResetCompletedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('anbk_reset_completed_time_v1') || null;
    } catch {
      return null;
    }
  });
  const [monitoringToast, setMonitoringToast] = useState<string | null>(null);
  const [localDraftClearedAt, setLocalDraftClearedAt] = useState<number>(0);

  // Fitur Hapus Permanen Siswa Terpilih (Filter Jenjang Siswa - Semua / VII / VIII)
  const [showDeleteFilteredModal, setShowDeleteFilteredModal] = useState<boolean>(false);
  const [isDeletingFiltered, setIsDeletingFiltered] = useState<boolean>(false);
  const [deleteFilteredConfirmed, setDeleteFilteredConfirmed] = useState<boolean>(false);
  const [deleteFilteredPasswordInput, setDeleteFilteredPasswordInput] = useState<string>('');
  const [showDeleteFilteredPass, setShowDeleteFilteredPass] = useState<boolean>(false);
  const [deleteFilteredAuthError, setDeleteFilteredAuthError] = useState<string | null>(null);

  // Fitur Pratinjau & Cetak Lembar Pengawasan Siswa Resmi
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState<boolean>(false);
  const [isPrintingDocument, setIsPrintingDocument] = useState<boolean>(false);

  // Data Tanda Tangan Resmi Dokumen Monitoring (Dapat Diedit Bebas oleh Guru Pengawas)
  const [kepalaSekolahName, setKepalaSekolahName] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('anbk_monitoring_kepala_sekolah_name') ||
        'Drs. H. SYAHRUDDIN, M.Pd.'
      );
    } catch {
      return 'Drs. H. SYAHRUDDIN, M.Pd.';
    }
  });

  const [kepalaSekolahNip, setKepalaSekolahNip] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('anbk_monitoring_kepala_sekolah_nip') ||
        '19680512 199412 1 002'
      );
    } catch {
      return '19680512 199412 1 002';
    }
  });

  const [kepalaSekolahJabatan, setKepalaSekolahJabatan] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('anbk_monitoring_kepala_sekolah_jabatan') ||
        'Kepala Sekolah UPTD SMP Negeri 7 Kisaran'
      );
    } catch {
      return 'Kepala Sekolah UPTD SMP Negeri 7 Kisaran';
    }
  });

  const [guruPengawasName, setGuruPengawasName] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('anbk_monitoring_guru_pengawas_name') ||
        EXAM_INFO.guruMapelUpper
      );
    } catch {
      return EXAM_INFO.guruMapelUpper;
    }
  });

  const [guruPengawasNip, setGuruPengawasNip] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('anbk_monitoring_guru_pengawas_nip') ||
        '19900531 202221 1 004'
      );
    } catch {
      return '19900531 202221 1 004';
    }
  });

  const [tanggalDokumenCetak, setTanggalDokumenCetak] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('anbk_monitoring_tanggal_cetak') ||
        `Kisaran, ${new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`
      );
    } catch {
      return `Kisaran, ${new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;
    }
  });

  const [showEditSignaturesPanel, setShowEditSignaturesPanel] = useState<boolean>(false);

  const handleUpdateKepalaSekolahName = (val: string) => {
    setKepalaSekolahName(val);
    try {
      localStorage.setItem('anbk_monitoring_kepala_sekolah_name', val);
    } catch {}
  };

  const handleUpdateKepalaSekolahNip = (val: string) => {
    setKepalaSekolahNip(val);
    try {
      localStorage.setItem('anbk_monitoring_kepala_sekolah_nip', val);
    } catch {}
  };

  const handleUpdateKepalaSekolahJabatan = (val: string) => {
    setKepalaSekolahJabatan(val);
    try {
      localStorage.setItem('anbk_monitoring_kepala_sekolah_jabatan', val);
    } catch {}
  };

  const handleResetSignaturesDefault = () => {
    handleUpdateKepalaSekolahName('Drs. H. SYAHRUDDIN, M.Pd.');
    handleUpdateKepalaSekolahNip('19680512 199412 1 002');
    handleUpdateKepalaSekolahJabatan('Kepala Sekolah UPTD SMP Negeri 7 Kisaran');
    setGuruPengawasName(EXAM_INFO.guruMapelUpper);
    setGuruPengawasNip('19900531 202221 1 004');
    try {
      localStorage.setItem('anbk_monitoring_guru_pengawas_name', EXAM_INFO.guruMapelUpper);
      localStorage.setItem('anbk_monitoring_guru_pengawas_nip', '19900531 202221 1 004');
    } catch {}
    setMonitoringToast('✓ Identitas tanda tangan kepala sekolah dikembalikan ke default!');
    setTimeout(() => setMonitoringToast(null), 4000);
  };

  // Fitur Reset Siswa Tunggal (Reset Pelanggaran / Reset Sesi Pengerjaan / Hapus Nilai)
  const [resetSingleStudentTarget, setResetSingleStudentTarget] =
    useState<MonitoredStudentItem | null>(null);
  const [singleResetMode, setSingleResetMode] = useState<
    'CLEAR_VIOLATIONS' | 'RESET_SESSION' | 'DELETE_SUBMISSION'
  >('CLEAR_VIOLATIONS');
  const [isResettingSingle, setIsResettingSingle] = useState<boolean>(false);
  const [singleResetPasswordInput, setSingleResetPasswordInput] = useState<string>('');
  const [showSingleResetPass, setShowSingleResetPass] = useState<boolean>(false);
  const [singleResetAuthError, setSingleResetAuthError] = useState<string | null>(null);
  const [singleDeleteConfirmed, setSingleDeleteConfirmed] = useState<boolean>(false);

  const handleOpenResetAllButton = () => {
    setTeacherAuthPasswordInput('');
    setTeacherAuthError(null);
    if (!isTeacherAccessUnlocked) {
      setPendingTeacherAction({ type: 'RESET_ALL' });
      setShowTeacherAuthGateModal(true);
      return;
    }
    setShowResetConfirmModal(true);
  };

  const handleOpenDeleteFilteredButton = () => {
    setDeleteFilteredPasswordInput('');
    setDeleteFilteredAuthError(null);
    setDeleteFilteredConfirmed(false);
    if (!isTeacherAccessUnlocked) {
      setTeacherAuthPasswordInput('');
      setTeacherAuthError(null);
      setPendingTeacherAction({ type: 'DELETE_FILTERED' });
      setShowTeacherAuthGateModal(true);
      return;
    }
    setShowDeleteFilteredModal(true);
  };

  const handleOpenResetSingleStudentButton = (
    student: MonitoredStudentItem,
    defaultMode: 'CLEAR_VIOLATIONS' | 'RESET_SESSION' | 'DELETE_SUBMISSION'
  ) => {
    setSingleResetPasswordInput('');
    setSingleResetAuthError(null);
    setSingleDeleteConfirmed(false);
    if (!isTeacherAccessUnlocked) {
      setTeacherAuthPasswordInput('');
      setTeacherAuthError(null);
      setPendingTeacherAction({
        type: 'RESET_SINGLE',
        student,
        mode: defaultMode,
      });
      setShowTeacherAuthGateModal(true);
      return;
    }
    setResetSingleStudentTarget(student);
    setSingleResetMode(defaultMode);
  };

  const handleVerifyTeacherGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherAuthPasswordInput.trim() !== EXAM_INFO.teacherPassword) {
      setTeacherAuthError(
        'Akses Ditolak! Hanya Guru Pengawas / Guru Mapel yang dapat mengakses tombol Hapus ini. Password salah.'
      );
      return;
    }
    setIsLocalTeacherVerified(true);
    if (onUnlockTeacherAuth) {
      onUnlockTeacherAuth();
    }
    setShowTeacherAuthGateModal(false);
    setTeacherAuthPasswordInput('');
    setTeacherAuthError(null);

    if (pendingTeacherAction?.type === 'RESET_ALL') {
      setShowResetConfirmModal(true);
    } else if (pendingTeacherAction?.type === 'DELETE_FILTERED') {
      setShowDeleteFilteredModal(true);
    } else if (pendingTeacherAction?.type === 'RESET_SINGLE') {
      setResetSingleStudentTarget(pendingTeacherAction.student);
      setSingleResetMode(pendingTeacherAction.mode);
    }
    setPendingTeacherAction(null);
  };

  // Fitur Edit Data, Profil & Foto Siswa
  const [editStudentTarget, setEditStudentTarget] = useState<MonitoredStudentItem | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editNisNisn, setEditNisNisn] = useState<string>('');
  const [editKelas, setEditKelas] = useState<string>('VIII-1');
  const [editSemester, setEditSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>('');
  const [editNilaiAkhir, setEditNilaiAkhir] = useState<number | string>('');
  const [editSkorBenar, setEditSkorBenar] = useState<number | string>('');
  const [editStatus, setEditStatus] = useState<
    'SEDANG_MENGERJAKAN' | 'SELESAI' | 'DISKUALIFIKASI'
  >('SELESAI');
  const [editViolationCount, setEditViolationCount] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Kamera WebCam di dalam Modal Edit
  const [isCameraActiveInModal, setIsCameraActiveInModal] = useState<boolean>(false);
  const [cameraErrorInModal, setCameraErrorInModal] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const videoModalRef = useRef<HTMLVideoElement | null>(null);
  const streamModalRef = useRef<MediaStream | null>(null);
  const fileInputModalRef = useRef<HTMLInputElement | null>(null);

  const stopCameraInModal = useCallback(() => {
    if (streamModalRef.current) {
      streamModalRef.current.getTracks().forEach((track) => track.stop());
      streamModalRef.current = null;
    }
    setIsCameraActiveInModal(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamModalRef.current) {
        streamModalRef.current.getTracks().forEach((track) => track.stop());
        streamModalRef.current = null;
      }
    };
  }, []);

  const startCameraInModal = async (facing: 'user' | 'environment' = 'user') => {
    stopCameraInModal();
    setCameraErrorInModal(null);
    setIsCameraActiveInModal(true);
    setCameraFacing(facing);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      streamModalRef.current = stream;
      if (videoModalRef.current) {
        videoModalRef.current.srcObject = stream;
        videoModalRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCameraErrorInModal(
        err?.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Silakan gunakan tombol Unggah File Foto dari galeri/folder.'
          : 'Perangkat kamera tidak dapat diaktifkan di browser ini.'
      );
      setIsCameraActiveInModal(false);
    }
  };

  const captureCameraPhotoInModal = () => {
    if (!videoModalRef.current) return;
    const video = videoModalRef.current;
    const captured = compressImageToDataUrl(
      video,
      video.videoWidth || 320,
      video.videoHeight || 320,
      cameraFacing === 'user',
      320
    );
    if (captured) {
      setEditPhotoUrl(captured);
      stopCameraInModal();
    }
  };

  const handleFileUploadInModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageToDataUrl(
          img,
          img.naturalWidth || 320,
          img.naturalHeight || 320,
          false,
          320
        );
        if (compressed) {
          setEditPhotoUrl(compressed);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenEditStudentModal = (student: MonitoredStudentItem) => {
    stopCameraInModal();
    setEditStudentTarget(student);
    setEditNama(student.namaSiswa || '');
    setEditNisNisn(student.nisNisn === '-' ? '' : student.nisNisn || '');
    setEditKelas(getCleanKelas(student.kelas) || 'VIII-1');
    setEditSemester(student.semester || 'Ganjil');
    setEditPhotoUrl(
      student.photoUrl ||
        getPhotoForStudentIdentity(student.namaSiswa, student.nisNisn) ||
        ''
    );
    setEditNilaiAkhir(student.nilaiAkhir !== undefined ? student.nilaiAkhir : '');
    setEditSkorBenar(student.skorBenar !== undefined ? student.skorBenar : '');
    setEditStatus(student.status);
    setEditViolationCount(student.violationCount || 0);
    setCameraErrorInModal(null);
  };

  const handleSaveEditStudent = () => {
    if (!editStudentTarget) return;
    const target = editStudentTarget;
    const newName = (editNama || target.namaSiswa).trim();
    const newNis = (editNisNisn || target.nisNisn || '-').trim();
    const newKelas = (editKelas || target.kelas).trim();
    const newSemester = editSemester;
    const newPhoto = editPhotoUrl;
    const parsedNilai = editNilaiAkhir === '' ? undefined : Number(editNilaiAkhir);
    const parsedSkor = editSkorBenar === '' ? undefined : Number(editSkorBenar);
    const newStatus = editStatus;
    const newViolationCount = Number(editViolationCount) || 0;

    setIsSavingEdit(true);
    try {
      // 1. Simpan foto ke photo map
      savePhotoForStudentIdentity(newName, newNis, newPhoto);
      if (target.namaSiswa !== newName || target.nisNisn !== newNis) {
        savePhotoForStudentIdentity(target.namaSiswa, target.nisNisn, newPhoto);
      }

      // 2. Perbarui Submissions jika ada
      if (onUpdateSubmissions) {
        const targetOldName = target.namaSiswa.trim().toLowerCase();
        const targetOldNis = (target.nisNisn || '').trim().toLowerCase();

        const updatedSubmissions = submissions.map((sub) => {
          const subName = (sub.namaSiswa || '').trim().toLowerCase();
          const subNis = (sub.nisNisn || '').trim().toLowerCase();
          const isMatch =
            (sub.id && sub.id === target.id) ||
            (subName === targetOldName &&
              (!targetOldNis || targetOldNis === '-' || subNis === targetOldNis));

          if (isMatch) {
            const nextSub: StudentSubmission = {
              ...sub,
              namaSiswa: newName,
              nisNisn: newNis,
              kelas: newKelas,
              semester: newSemester,
              photoUrl: newPhoto || undefined,
              nilaiAkhir: parsedNilai !== undefined ? parsedNilai : sub.nilaiAkhir,
              skorBenar: parsedSkor !== undefined ? parsedSkor : sub.skorBenar,
              violationCount: newViolationCount,
              statusKecurangan:
                newStatus === 'DISKUALIFIKASI'
                  ? 'Terdeteksi 3x Pelanggaran - Diskualifikasi'
                  : newViolationCount > 0
                  ? `${newViolationCount}x Pelanggaran Terdeteksi`
                  : 'Bebas Pelanggaran / Integritas Baik',
            };
            return nextSub;
          }
          return sub;
        });

        onUpdateSubmissions(updatedSubmissions);
        try {
          localStorage.setItem('anbk_submissions_v1', JSON.stringify(updatedSubmissions));
        } catch {}
      }

      // 3. Perbarui Daftar Siswa Ruang Kelas (Denah Kursi Lab)
      if (onUpdateClassroomStudents && classroomStudents.length > 0) {
        const targetOldName = target.namaSiswa.trim().toLowerCase();
        const targetOldNis = (target.nisNisn || '').trim().toLowerCase();

        const updatedClassroom = classroomStudents.map((cs) => {
          const csName = (cs.namaSiswa || '').trim().toLowerCase();
          const csNis = (cs.nisNisn || '').trim().toLowerCase();
          const isMatch =
            cs.id === target.id ||
            (csName === targetOldName &&
              (!targetOldNis || targetOldNis === '-' || csNis === targetOldNis));

          if (isMatch) {
            return {
              ...cs,
              namaSiswa: newName,
              nisNisn: newNis,
              kelas: newKelas,
              semester: newSemester,
              photoUrl: newPhoto || undefined,
              nilaiAkhir: parsedNilai !== undefined ? parsedNilai : cs.nilaiAkhir,
              skorBenar: parsedSkor !== undefined ? parsedSkor : cs.skorBenar,
              attendanceStatus: (newStatus === 'SELESAI'
                ? 'Selesai Ujian'
                : newStatus === 'SEDANG_MENGERJAKAN'
                ? 'Sedang Ujian'
                : 'Hadir - Siap Ujian') as ClassroomSeatStudent['attendanceStatus'],
              statusKecurangan:
                newStatus === 'DISKUALIFIKASI'
                  ? 'Diskualifikasi 3x Pelanggaran'
                  : newViolationCount > 0
                  ? `${newViolationCount}x Pelanggaran`
                  : 'Tertib',
              updatedAt: new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            };
          }
          return cs;
        });

        onUpdateClassroomStudents(updatedClassroom);
        try {
          localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(updatedClassroom));
          localStorage.setItem(
            'anbk_classroom_manual_students_v1',
            JSON.stringify(updatedClassroom)
          );
        } catch {}
      }

      // 4. Perbarui draft lokal pengerjaan bila sama
      if (
        activeExamDraft &&
        (activeExamDraft.id === target.id ||
          (activeExamDraft.namaSiswa || '').trim().toLowerCase() ===
            target.namaSiswa.trim().toLowerCase())
      ) {
        try {
          activeExamDraft.namaSiswa = newName;
          activeExamDraft.nisNisn = newNis;
          activeExamDraft.kelas = newKelas;
          activeExamDraft.semester = newSemester;
          activeExamDraft.photoUrl = newPhoto || undefined;
        } catch {}
      }

      stopCameraInModal();
      setEditStudentTarget(null);
      setMonitoringToast(
        `✓ Data & foto profil siswa "${newName}" berhasil disimpan dan diperbarui!`
      );
      setTimeout(() => setMonitoringToast(null), 6000);

      if (onSyncRefresh) {
        onSyncRefresh();
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Siaran Pengawas (Proctor Announcement Broadcast)
  const [broadcastText, setBroadcastText] = useState<string>(() => {
    try {
      return localStorage.getItem('anbk_proctor_broadcast_announcement') || '';
    } catch {
      return '';
    }
  });
  const [showBroadcastInput, setShowBroadcastInput] = useState<boolean>(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  // Rekam jumlah pelanggaran sebelumnya untuk membunyikan alarm audio bila ada pelanggaran baru
  const prevViolationsSumRef = React.useRef<number>(0);

  // Fungsi audio alert sintetis
  const playMonitoringAlertSound = useCallback((type: 'warning' | 'disqualified') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'disqualified') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {}
  }, []);

  // Kompilasi data siswa terpantau dari berbagai sumber real-time
  const monitoredStudents = useMemo<MonitoredStudentItem[]>(() => {
    const list: MonitoredStudentItem[] = [];
    const seenMap = new Map<string, boolean>();

    // 1. Siswa yang sedang aktif di perangkat ini (Active Exam Draft)
    if (
      activeExamDraft &&
      (activeExamDraft.namaSiswa || activeExamDraft.id) &&
      localDraftClearedAt === 0
    ) {
      const draftTotal = activeExamDraft.totalSoal || 25;
      const draftAnsCount = activeExamDraft.answers
        ? Object.values(activeExamDraft.answers).filter(Boolean).length
        : 0;
      const isEssay = (activeExamDraft.statusKecurangan || '').toLowerCase().includes('esay');
      const vCount = activeExamDraft.violationCount || 0;
      const isDisq =
        vCount >= 3 ||
        (activeExamDraft.statusKecurangan || '').toLowerCase().includes('diskualifikasi');

      const item: MonitoredStudentItem = {
        id: activeExamDraft.id || 'ACTIVE-DRAFT',
        namaSiswa: activeExamDraft.namaSiswa || 'Peserta Ujian Aktif',
        nisNisn: activeExamDraft.nisNisn || '-',
        kelas: getCleanKelas(activeExamDraft.kelas) || 'VIII-1',
        semester: activeExamDraft.semester || 'Ganjil',
        examType: isEssay ? 'ESAY_TEST' : 'PILIHAN_BERGANDA',
        status: isDisq ? 'DISKUALIFIKASI' : 'SEDANG_MENGERJAKAN',
        progresSoal: {
          terjawab: draftAnsCount,
          total: draftTotal,
          persentase: Math.round((draftAnsCount / Math.max(1, draftTotal)) * 100),
          nomorAktif: Math.min(draftTotal, draftAnsCount + 1),
        },
        nilaiAkhir: activeExamDraft.nilaiAkhir,
        skorBenar: activeExamDraft.skorBenar,
        durasiDetik: 0,
        violationCount: vCount,
        violationLogs: activeExamDraft.violationLogs || [],
        deviceCategory: activeExamDraft.deviceCategory || 'HP Android',
        deviceBrand: activeExamDraft.deviceBrand || 'Samsung',
        deviceModel: activeExamDraft.deviceModel || 'HP Siswa (Aktif)',
        deviceOsBrowser: activeExamDraft.deviceOsBrowser || 'Android 14 · Google Chrome',
        clientIp: activeExamDraft.clientIp || '127.0.0.1',
        batteryLevel: activeExamDraft.batteryHistory?.length
          ? activeExamDraft.batteryHistory[activeExamDraft.batteryHistory.length - 1].level
          : 85,
        isBatteryCharging: activeExamDraft.batteryHistory?.length
          ? activeExamDraft.batteryHistory[activeExamDraft.batteryHistory.length - 1].charging
          : false,
        photoUrl:
          activeExamDraft.photoUrl ||
          getPhotoForStudentIdentity(activeExamDraft.namaSiswa, activeExamDraft.nisNisn),
        lastActiveTimestamp: activeExamDraft.timestamp || 'Baru Saja',
        rawSubmission: activeExamDraft,
      };

      const key = `${item.namaSiswa.trim().toLowerCase()}_${item.nisNisn}`;
      seenMap.set(key, true);
      list.push(item);
    }

    // 2. Siswa dari Daftar Submissions (Riwayat pengerjaan & pengumpulan ujian)
    submissions.forEach((sub) => {
      if (!sub || (!sub.namaSiswa && !sub.id)) return;
      const key = `${(sub.namaSiswa || '').trim().toLowerCase()}_${sub.nisNisn || ''}`;
      if (seenMap.has(key)) return;
      seenMap.set(key, true);

      const isEssay =
        (sub.statusKecurangan || '').toLowerCase().includes('esay') ||
        (sub.id || '').startsWith('ESAY');
      const vCount = sub.violationCount || 0;
      const isDisq =
        vCount >= 3 || (sub.statusKecurangan || '').toLowerCase().includes('diskualifikasi');
      const isStillWorking =
        sub.isCompleted === false ||
        (sub.statusKecurangan || '').toLowerCase().startsWith('sedang mengerjakan') ||
        (sub.statusKecurangan || '').toLowerCase().includes('sudah login') ||
        (sub.statusKecurangan || '').toLowerCase().includes('masuk ruang') ||
        (sub.lulusTidakLulus || '').toLowerCase().includes('berlangsung');

      const ansCount = sub.answers ? Object.values(sub.answers).filter(Boolean).length : sub.skorBenar ?? 0;
      const totalSoal = sub.totalSoal || (isEssay ? 15 : 25);

      let batLevel: number | undefined = undefined;
      let batCharging: boolean | undefined = undefined;
      if (sub.batteryHistory && sub.batteryHistory.length > 0) {
        const lastBat = sub.batteryHistory[sub.batteryHistory.length - 1];
        batLevel = lastBat.level;
        batCharging = lastBat.charging;
      }

      const item: MonitoredStudentItem = {
        id: sub.id || `SUB-${Date.now()}`,
        namaSiswa: sub.namaSiswa,
        nisNisn: sub.nisNisn || '-',
        kelas: getCleanKelas(sub.kelas) || 'VIII-1',
        semester: sub.semester || 'Ganjil',
        examType: isEssay ? 'ESAY_TEST' : 'PILIHAN_BERGANDA',
        status: isDisq
          ? 'DISKUALIFIKASI'
          : isStillWorking
          ? 'SEDANG_MENGERJAKAN'
          : 'SELESAI',
        progresSoal: {
          terjawab: ansCount,
          total: totalSoal,
          persentase: Math.round((ansCount / Math.max(1, totalSoal)) * 100),
          nomorAktif: isStillWorking ? Math.min(totalSoal, ansCount + 1) : totalSoal,
        },
        nilaiAkhir: sub.nilaiAkhir,
        skorBenar: sub.skorBenar,
        durasiDetik: 0,
        violationCount: vCount,
        violationLogs: sub.violationLogs || [],
        deviceCategory: sub.deviceCategory || 'HP Android',
        deviceBrand: sub.deviceBrand || 'Samsung',
        deviceModel: sub.deviceModel || sub.deviceInfo || 'Smartphone',
        deviceOsBrowser: sub.deviceOsBrowser || 'Chrome Mobile',
        clientIp: sub.clientIp || '192.168.1.10',
        batteryLevel: batLevel,
        isBatteryCharging: batCharging,
        photoUrl: sub.photoUrl || getPhotoForStudentIdentity(sub.namaSiswa, sub.nisNisn),
        lastActiveTimestamp: sub.timestamp || 'Aktif',
        rawSubmission: sub,
      };

      list.push(item);
    });

    // 3. Gabungkan siswa dari Classroom Design yang terdaftar tetapi belum memiliki submission
    classroomStudents.forEach((cs) => {
      const key = `${(cs.namaSiswa || '').trim().toLowerCase()}_${cs.nisNisn || ''}`;
      if (seenMap.has(key)) {
        // Tambahkan nomor kursi ke item yang sudah ada
        const found = list.find(
          (l) => `${l.namaSiswa.trim().toLowerCase()}_${l.nisNisn}` === key
        );
        if (found && !found.seatNumber) {
          found.seatNumber = cs.seatNumber;
        }
        return;
      }
      seenMap.set(key, true);

      const isFinished = cs.attendanceStatus === 'Selesai Ujian';
      const isExamining = cs.attendanceStatus === 'Sedang Ujian';
      const vCount = cs.statusKecurangan.includes('Pelanggaran') ? 1 : 0;
      const isDisq = cs.statusKecurangan.toLowerCase().includes('diskualifikasi');

      list.push({
        id: cs.id,
        namaSiswa: cs.namaSiswa,
        nisNisn: cs.nisNisn || '-',
        kelas: getCleanKelas(cs.kelas) || 'VIII-1',
        semester: cs.semester || 'Ganjil',
        examType: 'PILIHAN_BERGANDA',
        status: isDisq
          ? 'DISKUALIFIKASI'
          : isExamining
          ? 'SEDANG_MENGERJAKAN'
          : isFinished
          ? 'SELESAI'
          : 'SEDANG_MENGERJAKAN',
        progresSoal: {
          terjawab: cs.skorBenar || 20,
          total: cs.totalSoal || 25,
          persentase: Math.round(((cs.skorBenar || 20) / Math.max(1, cs.totalSoal || 25)) * 100),
          nomorAktif: isFinished ? 25 : 18,
        },
        nilaiAkhir: cs.nilaiAkhir,
        skorBenar: cs.skorBenar,
        durasiDetik: 0,
        violationCount: vCount,
        violationLogs: vCount > 0 ? [cs.statusKecurangan] : [],
        deviceCategory: cs.deviceCategory || 'HP Android',
        deviceBrand: cs.deviceBrand || 'Samsung',
        deviceModel: cs.deviceModel || 'HP Siswa',
        deviceOsBrowser: 'Android 14 · Google Chrome',
        clientIp: '192.168.1.15',
        photoUrl: cs.photoUrl || getPhotoForStudentIdentity(cs.namaSiswa, cs.nisNisn),
        lastActiveTimestamp: cs.updatedAt || 'Terkoneksi',
        seatNumber: cs.seatNumber,
      });
    });

    return list;
  }, [activeExamDraft, classroomStudents, submissions, localDraftClearedAt]);

  // Bunyikan alarm suara jika ada pelanggaran baru terdeteksi pada mode pengawasan
  useEffect(() => {
    const totalViolations = monitoredStudents.reduce((acc, s) => acc + s.violationCount, 0);
    if (
      isSoundAlertEnabled &&
      prevViolationsSumRef.current > 0 &&
      totalViolations > prevViolationsSumRef.current
    ) {
      playMonitoringAlertSound('warning');
    }
    prevViolationsSumRef.current = totalViolations;
  }, [isSoundAlertEnabled, monitoredStudents, playMonitoringAlertSound]);

  // Auto-Refresh polling
  const handleTriggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (onSyncRefresh) onSyncRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshedAt(new Date().toLocaleTimeString('id-ID'));
    }, 600);
  }, [onSyncRefresh]);

  useEffect(() => {
    if (!isAutoRefreshActive) return;
    const intervalMs = Math.max(2, autoRefreshInterval) * 1000;
    const timer = setInterval(() => {
      handleTriggerRefresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, handleTriggerRefresh, isAutoRefreshActive]);

  // Helper deteksi jenjang siswa (VII atau VIII) secara spesifik dan akurat
  const getStudentJenjang = useCallback((kelas: string): 'VII' | 'VIII' => {
    const k = (kelas || '').trim().toUpperCase();
    if (
      k.startsWith('VII-') ||
      k.startsWith('VII ') ||
      k.startsWith('VII.') ||
      k.startsWith('7-') ||
      k.startsWith('7 ') ||
      (k.includes('VII') && !k.includes('VIII'))
    ) {
      return 'VII';
    }
    return 'VIII';
  }, []);

  // Hitung jumlah siswa per jenjang untuk badge counter real-time
  const countJenjangVII = useMemo(() => {
    return monitoredStudents.filter((s) => getStudentJenjang(s.kelas) === 'VII').length;
  }, [monitoredStudents, getStudentJenjang]);

  const countJenjangVIII = useMemo(() => {
    return monitoredStudents.filter((s) => getStudentJenjang(s.kelas) === 'VIII').length;
  }, [monitoredStudents, getStudentJenjang]);

  const countJenjangAll = monitoredStudents.length;

  // Siswa dalam jenjang yang dipilih untuk statistik KPI
  const studentsInSelectedJenjang = useMemo(() => {
    if (selectedJenjangFilter === 'ALL') return monitoredStudents;
    return monitoredStudents.filter((s) => getStudentJenjang(s.kelas) === selectedJenjangFilter);
  }, [monitoredStudents, selectedJenjangFilter, getStudentJenjang]);

  // Statistik Real-Time Pengawasan (Menyesuaikan jenjang yang sedang dipantau)
  const stats = useMemo(() => {
    const total = studentsInSelectedJenjang.length;
    const active = studentsInSelectedJenjang.filter((s) => s.status === 'SEDANG_MENGERJAKAN').length;
    const finished = studentsInSelectedJenjang.filter((s) => s.status === 'SELESAI').length;
    const violations = studentsInSelectedJenjang.filter(
      (s) => s.violationCount > 0 && s.status !== 'DISKUALIFIKASI'
    ).length;
    const disqualified = studentsInSelectedJenjang.filter((s) => s.status === 'DISKUALIFIKASI').length;
    const avgScore =
      finished > 0
        ? Math.round(
            studentsInSelectedJenjang
              .filter((s) => s.status === 'SELESAI' && typeof s.nilaiAkhir === 'number')
              .reduce((acc, s) => acc + (s.nilaiAkhir || 0), 0) / Math.max(1, finished)
          )
        : 0;

    return { total, active, finished, violations, disqualified, avgScore };
  }, [studentsInSelectedJenjang]);

  // Filtered List Siswa Real-Time
  const filteredStudents = useMemo(() => {
    return monitoredStudents.filter((student) => {
      // 1. Jenjang Filter (ALL / VII / VIII)
      if (selectedJenjangFilter !== 'ALL') {
        const sj = getStudentJenjang(student.kelas);
        if (sj !== selectedJenjangFilter) return false;
      }

      // 2. Selected Rombel Kelas Filter
      if (selectedKelasFilter !== 'ALL') {
        if (getCleanKelas(student.kelas) !== selectedKelasFilter) return false;
      }

      // 3. Status Filter
      if (selectedStatusFilter === 'SEDANG_MENGERJAKAN' && student.status !== 'SEDANG_MENGERJAKAN')
        return false;
      if (selectedStatusFilter === 'SELESAI' && student.status !== 'SELESAI') return false;
      if (
        selectedStatusFilter === 'PELANGGARAN' &&
        !(student.violationCount > 0 && student.status !== 'DISKUALIFIKASI')
      )
        return false;
      if (selectedStatusFilter === 'DISKUALIFIKASI' && student.status !== 'DISKUALIFIKASI')
        return false;

      // 4. Type Filter
      if (selectedTypeFilter !== 'ALL' && student.examType !== selectedTypeFilter) return false;

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mNama = student.namaSiswa.toLowerCase().includes(q);
        const mNis = student.nisNisn.toLowerCase().includes(q);
        const mKelas = student.kelas.toLowerCase().includes(q);
        const mDevice = student.deviceModel.toLowerCase().includes(q);
        if (!mNama && !mNis && !mKelas && !mDevice) return false;
      }

      return true;
    });
  }, [
    monitoredStudents,
    searchQuery,
    selectedJenjangFilter,
    selectedKelasFilter,
    selectedStatusFilter,
    selectedTypeFilter,
    getStudentJenjang,
  ]);

  // Daftar opsi kelas unik yang disesuaikan dengan jenjang terpilih
  const availableKelasOptions = useMemo(() => {
    const setK = new Set<string>();
    if (selectedJenjangFilter === 'VII') {
      ['VII-1', 'VII-2', 'VII-3', 'VII-4', 'VII-5'].forEach((k) => setK.add(k));
    } else if (selectedJenjangFilter === 'VIII') {
      [
        'VIII-1',
        'VIII-2',
        'VIII-3',
        'VIII-4',
        'VIII-5',
        'VIII-6',
        'VIII-7',
        'VIII-8',
        'VIII-9',
      ].forEach((k) => setK.add(k));
    }

    monitoredStudents.forEach((s) => {
      const studentJenjang = getStudentJenjang(s.kelas);
      if (selectedJenjangFilter === 'ALL' || studentJenjang === selectedJenjangFilter) {
        const c = getCleanKelas(s.kelas);
        if (c) setK.add(c);
      }
    });

    return Array.from(setK).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [monitoredStudents, selectedJenjangFilter, getStudentJenjang]);

  // Kirim Peringatan Pengawas ke Siswa
  const handleSendWarning = (student: MonitoredStudentItem) => {
    setWarningModalStudent(student);
    setCustomWarningMessage(
      `Peringatan Pengawas Ruang: Sdr/i ${student.namaSiswa}, mohon tetap fokus pada lembar soal ujian dan dilarang menyentuh panel screenshot/pindah aplikasi.`
    );
  };

  const handleExecuteSendWarning = () => {
    if (!warningModalStudent) return;
    try {
      const key = `anbk_warning_for_${warningModalStudent.nisNisn || warningModalStudent.id}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          message: customWarningMessage,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          sender: EXAM_INFO.guruMapel,
        })
      );
    } catch {}

    setWarningSuccessToast(
      `✓ Peringatan berhasil dikirimkan ke perangkat ${warningModalStudent.namaSiswa}!`
    );
    setTimeout(() => setWarningSuccessToast(null), 4000);
    setWarningModalStudent(null);
  };

  // Simpan / Broadcast Pengumuman Pengawas Ruang
  const handleSaveBroadcast = () => {
    try {
      localStorage.setItem('anbk_proctor_broadcast_announcement', broadcastText.trim());
      setBroadcastFeedback('✓ Pengumuman pengawas berhasil disiarkan ke seluruh siswa!');
      setTimeout(() => setBroadcastFeedback(null), 3500);
    } catch {}
  };

  // Unduh Berita Acara Monitoring Resmi (PDF)
  const handleDownloadMonitoringReportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 14;

      const drawTableHeader = (posY: number) => {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(margin, posY, contentWidth, 7, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('NO', margin + 3, posY + 5);
        doc.text('NAMA SISWA', margin + 12, posY + 5);
        doc.text('NIS/NISN', margin + 68, posY + 5);
        doc.text('KELAS', margin + 98, posY + 5);
        doc.text('TIPE SOAL', margin + 118, posY + 5);
        doc.text('STATUS', margin + 148, posY + 5);
        doc.text('PROGRES', margin + 182, posY + 5);
        doc.text('PELANGGARAN', margin + 208, posY + 5);
        doc.text('PERANGKAT & IP', margin + 236, posY + 5);
      };

      // Header Navy
      doc.setFillColor(12, 74, 110);
      doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

      doc.setTextColor(252, 211, 77);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(
        `BERITA ACARA RESMI PENGAWASAN MONITORING RUANG UJIAN ANBK / ASESMEN ONLINE`,
        margin + 6,
        y + 7
      );

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(EXAM_INFO.namaSekolah, margin + 6, y + 14);

      doc.setTextColor(186, 230, 253);
      doc.setFontSize(7.5);
      doc.text(
        `Guru Mata Pelajaran: ${guruPengawasName} | Waktu Pantau: ${new Date().toLocaleString('id-ID')} | Token: ${onlineToken || 'AKTIF'} | Filter: ${selectedJenjangFilter === 'ALL' ? 'Semua Jenjang' : `Kelas ${selectedJenjangFilter}`}`,
        margin + 6,
        y + 20
      );

      y += 28;

      // Kotak Ringkasan Statistik
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(
        `TOTAL TERPANTAU: ${stats.total} SISWA (${selectedJenjangFilter === 'ALL' ? 'SEMUA JENJANG' : `JENJANG ${selectedJenjangFilter}`})  |  SEDANG MENGERJAKAN: ${stats.active}  |  SELESAI: ${stats.finished}  |  PERINGATAN: ${stats.violations}  |  DISKUALIFIKASI: ${stats.disqualified}`,
        margin + 5,
        y + 9
      );

      y += 18;

      // Header Tabel Halaman Pertama
      drawTableHeader(y);
      y += 9;

      // Baris Data Seluruh Siswa
      filteredStudents.forEach((stu, idx) => {
        if (y > 175) {
          doc.addPage();
          y = 15;
          drawTableHeader(y);
          y += 9;
        }

        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
        doc.rect(margin, y - 2, contentWidth, 6, 'F');

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.text(String(idx + 1), margin + 3, y + 2);
        doc.text((stu.namaSiswa || '').slice(0, 32), margin + 12, y + 2);
        doc.text(stu.nisNisn || '-', margin + 68, y + 2);
        doc.text(stu.kelas || '-', margin + 98, y + 2);
        doc.text(stu.examType === 'PILIHAN_BERGANDA' ? 'PG 25 Soal' : 'Esay 15 Soal', margin + 118, y + 2);

        // Status
        if (stu.status === 'DISKUALIFIKASI') {
          doc.setTextColor(225, 29, 72);
          doc.text('DISKUALIFIKASI', margin + 148, y + 2);
        } else if (stu.status === 'SEDANG_MENGERJAKAN') {
          doc.setTextColor(16, 185, 129);
          doc.text('Sedang Mengerjakan', margin + 148, y + 2);
        } else {
          doc.setTextColor(14, 165, 233);
          doc.text('Selesai Ujian', margin + 148, y + 2);
        }

        doc.setTextColor(15, 23, 42);
        doc.text(`${stu.progresSoal.terjawab}/${stu.progresSoal.total} (${stu.progresSoal.persentase}%)`, margin + 182, y + 2);
        doc.text(stu.violationCount > 0 ? `${stu.violationCount}x Peringatan` : 'Bersih', margin + 208, y + 2);
        doc.text(`${stu.deviceCategory}: ${(stu.deviceModel || '').slice(0, 22)}`, margin + 236, y + 2);

        y += 6.5;
      });

      // Tanda Tangan Resmi Kepala Sekolah & Guru Pengawas di Akhir Halaman
      if (y > 155) {
        doc.addPage();
        y = 20;
      } else {
        y += 10;
      }

      const colLeftX = margin + 35;
      const colRightX = margin + contentWidth - 45;

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Mengetahui,', colLeftX, y, { align: 'center' });
      doc.text(tanggalDokumenCetak, colRightX, y, { align: 'center' });

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(kepalaSekolahJabatan, colLeftX, y + 4.5, { align: 'center' });
      doc.text('Guru Mata Pelajaran / Pengawas Ruang', colRightX, y + 4.5, { align: 'center' });

      // Ruang Tanda Tangan
      y += 22;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(kepalaSekolahName, colLeftX, y, { align: 'center' });
      doc.text(guruPengawasName, colRightX, y, { align: 'center' });

      // Garis Bawah Nama
      const nameWidthLeft = doc.getTextWidth(kepalaSekolahName);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(colLeftX - nameWidthLeft / 2, y + 0.8, colLeftX + nameWidthLeft / 2, y + 0.8);

      const nameWidthRight = doc.getTextWidth(guruPengawasName);
      doc.line(colRightX - nameWidthRight / 2, y + 0.8, colRightX + nameWidthRight / 2, y + 0.8);

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`NIP. ${kepalaSekolahNip}`, colLeftX, y + 5, { align: 'center' });
      doc.text(`NIP. ${guruPengawasNip}`, colRightX, y + 5, { align: 'center' });

      doc.save(`Berita_Acara_Monitoring_Ujian_Kelas_${selectedJenjangFilter}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setMonitoringToast('✓ Berita Acara PDF Resmi berhasil diunduh lengkap dengan tanda tangan!');
      setTimeout(() => setMonitoringToast(null), 5000);
    } catch (err) {
      console.error('Gagal membuat PDF berita acara monitoring:', err);
    }
  };

  // Unduh Berkas CSV Rekap Pantauan
  const handleDownloadMonitoringCsv = () => {
    try {
      const headers = [
        'Nama Siswa',
        'NIS/NISN',
        'Kelas',
        'Semester',
        'Tipe Ujian',
        'Status Ujian',
        'Soal Terjawab',
        'Total Soal',
        'Progres %',
        'Nilai Akhir',
        'Jumlah Pelanggaran',
        'Log Pelanggaran',
        'Perangkat Siswa',
        'Alamat IP',
        'Waktu Terakhir Aktif',
      ];

      const rows = filteredStudents.map((s) => [
        `"${s.namaSiswa.replace(/"/g, '""')}"`,
        `"${s.nisNisn}"`,
        `"${s.kelas}"`,
        `"${s.semester}"`,
        `"${s.examType}"`,
        `"${s.status}"`,
        s.progresSoal.terjawab,
        s.progresSoal.total,
        `${s.progresSoal.persentase}%`,
        s.nilaiAkhir ?? '-',
        s.violationCount,
        `"${s.violationLogs.join('; ').replace(/"/g, '""')}"`,
        `"${s.deviceCategory}: ${s.deviceModel}"`,
        `"${s.clientIp}"`,
        `"${s.lastActiveTimestamp}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap_Monitoring_Ujian_Kelas_${selectedJenjangFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  // Generator Konten HTML Standar Cetak Resmi Mandiri (Full Inline Styling A4 Landscape)
  const generatePrintableHtmlDocument = () => {
    const studentRowsHtml = filteredStudents
      .map(
        (st, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 9px; page-break-inside: avoid; background-color: ${
          idx % 2 === 0 ? '#ffffff' : '#f8fafc'
        };">
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; font-family: monospace;">${idx + 1}</td>
          <td style="padding: 4px 6px; font-weight: bold; border-right: 1px solid #cbd5e1;">${st.namaSiswa}</td>
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; font-family: monospace;">${st.nisNisn || '-'}</td>
          <td style="padding: 4px 6px; text-align: center; font-weight: bold; border-right: 1px solid #cbd5e1;">${st.kelas}</td>
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; font-family: monospace;">${st.examType === 'PILIHAN_BERGANDA' ? 'PG 25' : 'Esay 15'}</td>
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; font-weight: 600; color: ${
            st.status === 'SELESAI' ? '#047857' : st.status === 'SEDANG_MENGERJAKAN' ? '#0284c7' : '#e11d48'
          };">${st.status === 'SELESAI' ? 'Selesai' : st.status === 'SEDANG_MENGERJAKAN' ? 'Mengerjakan' : 'Diskualifikasi'}</td>
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; font-family: monospace;">${st.progresSoal.terjawab}/${st.progresSoal.total} (${st.progresSoal.persentase}%)</td>
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${st.nilaiAkhir !== undefined ? st.nilaiAkhir : '-'}</td>
          <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #cbd5e1;">${st.violationCount > 0 ? `${st.violationCount}x Peringatan` : 'Tertib'}</td>
          <td style="padding: 4px 6px; font-size: 8.5px; color: #334155;">${st.deviceModel || st.deviceCategory}</td>
        </tr>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Monitoring Siswa - ${EXAM_INFO.namaSekolah}</title>
  <style>
    @page {
      size: landscape A4;
      margin: 8mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kop {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      text-align: center;
    }
    .kop h2 { margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #475569; }
    .kop h1 { margin: 2px 0; font-size: 16px; font-weight: 900; text-transform: uppercase; color: #020617; }
    .kop p { margin: 1px 0; font-size: 9.5px; color: #475569; }
    .kop h3 { margin: 6px 0 2px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-family: monospace;
      color: #475569;
      border-top: 1px solid #cbd5e1;
      padding-top: 5px;
      margin-top: 5px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
      font-size: 10px;
    }
    .kpi-grid strong { display: block; font-size: 13px; font-family: monospace; margin-top: 2px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 9.5px;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 4px 6px;
    }
    th {
      background-color: #e2e8f0;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 8.5px;
    }
    .grid-ttd {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 20px;
      text-align: center;
      font-size: 10.5px;
      page-break-inside: avoid;
    }
    .ttd-space { height: 48px; }
    .ttd-name { font-weight: bold; text-decoration: underline; font-size: 11.5px; margin: 0; }
    .ttd-nip { font-family: monospace; font-size: 9.5px; color: #334155; margin: 2px 0 0 0; }
  </style>
</head>
<body>
  <div class="kop">
    <h2>PEMERINTAH KABUPATEN ASAHAN • DINAS PENDIDIKAN</h2>
    <h1>${EXAM_INFO.namaSekolah}</h1>
    <p>Alamat: ${EXAM_INFO.alamatSekolah} • Website: www.smpn7kisaran.sch.id</p>
    <div style="height: 1px; background: #0f172a; margin: 4px 0;"></div>
    <h3>LAPORAN RESMI MONITORING PENGAWASAN &amp; HASIL EVALUASI UJIAN SISWA</h3>
    <p style="font-weight: bold; color: #1e293b;">Mata Pelajaran: ${EXAM_INFO.mataPelajaran} (Fase D SMP) • Guru Pengawas: ${guruPengawasName}</p>
    <div class="meta-bar">
      <span>Waktu Cetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${new Date().toLocaleTimeString('id-ID')} WIB</span>
      <span>Filter: ${selectedJenjangFilter === 'ALL' ? 'Semua Jenjang (VII & VIII)' : `Khusus Jenjang ${selectedJenjangFilter}`} | Token: ${onlineToken || 'AKTIF'}</span>
      <span>Total Siswa: ${filteredStudents.length} Peserta</span>
    </div>
  </div>

  <div class="kpi-grid">
    <div>
      <span style="color: #64748b;">Total Siswa Terdata</span>
      <strong style="color: #0f172a;">${stats.total} Siswa</strong>
    </div>
    <div>
      <span style="color: #047857;">Selesai Ujian</span>
      <strong style="color: #047857;">${stats.finished} Siswa</strong>
    </div>
    <div>
      <span style="color: #0284c7;">Sedang Mengerjakan</span>
      <strong style="color: #0284c7;">${stats.active} Siswa</strong>
    </div>
    <div>
      <span style="color: #e11d48;">Pelanggaran / Diskualifikasi</span>
      <strong style="color: #e11d48;">${stats.violations + stats.disqualified} Siswa</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 28px; text-align: center;">No</th>
        <th>Nama Siswa</th>
        <th style="width: 90px; text-align: center;">NIS / NISN</th>
        <th style="width: 50px; text-align: center;">Kelas</th>
        <th style="width: 50px; text-align: center;">Tipe</th>
        <th style="width: 80px; text-align: center;">Status</th>
        <th style="width: 80px; text-align: center;">Progres</th>
        <th style="width: 45px; text-align: center;">Nilai</th>
        <th style="width: 80px; text-align: center;">Pelanggaran</th>
        <th>Perangkat</th>
      </tr>
    </thead>
    <tbody>
      ${studentRowsHtml || '<tr><td colspan="10" style="text-align: center; padding: 12px; font-style: italic;">Tidak ada data siswa terpantau.</td></tr>'}
    </tbody>
  </table>

  <div class="grid-ttd">
    <div>
      <p style="margin: 0; color: #475569;">Mengetahui,</p>
      <p style="margin: 2px 0 0 0; font-weight: bold; color: #0f172a;">${kepalaSekolahJabatan}</p>
      <div class="ttd-space"></div>
      <p class="ttd-name">${kepalaSekolahName}</p>
      <p class="ttd-nip">NIP. ${kepalaSekolahNip}</p>
    </div>
    <div>
      <p style="margin: 0; color: #475569;">${tanggalDokumenCetak}</p>
      <p style="margin: 2px 0 0 0; font-weight: bold; color: #0f172a;">Guru Mata Pelajaran / Pengawas Ruang</p>
      <div class="ttd-space"></div>
      <p class="ttd-name">${guruPengawasName}</p>
      <p class="ttd-nip">NIP. ${guruPengawasNip}</p>
    </div>
  </div>
</body>
</html>`;
  };

  // Handler Buka Dokumen Cetak di Tab Baru (Untuk Cetak Langsung Tanpa Batasan Iframe)
  const handleOpenPrintInNewTab = () => {
    try {
      const html = generatePrintableHtmlDocument();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank');
      if (newWin) {
        newWin.focus();
        setMonitoringToast('✓ Dokumen Cetak berhasil dibuka di Tab Baru!');
      } else {
        // Fallback jika popup diblokir
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Monitoring_${selectedJenjangFilter}_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setMonitoringToast('✓ Berkas HTML Cetak Mandiri berhasil diunduh!');
      }
      setTimeout(() => setMonitoringToast(null), 5000);
    } catch {
      handleDownloadMonitoringReportPdf();
    }
  };

  // Handler Buka Modal Pratinjau & Cetak Dokumen Pengawasan Siswa Resmi
  const handleOpenPrintPreview = (customJenjang?: string | React.MouseEvent) => {
    setShowPrintPreviewModal(true);
    const jenjangLabel =
      typeof customJenjang === 'string'
        ? customJenjang
        : selectedJenjangFilter === 'ALL'
        ? 'Semua Jenjang'
        : `Jenjang Kelas ${selectedJenjangFilter}`;
    setMonitoringToast(
      `✓ Pratinjau & Cetak Laporan (${jenjangLabel}) Berhasil Dibuka! Anda dapat mengedit nama Kepala Sekolah & NIP sebelum mencetak.`
    );
    setTimeout(() => setMonitoringToast(null), 5000);
  };

  // Handler Eksekusi Cetak Sekarang (Multi-Layer Engine: Iframe Standalone, Window Print, & Auto PDF Fallback)
  const handleExecuteDirectPrint = () => {
    setIsPrintingDocument(true);
    const printHtml = generatePrintableHtmlDocument();

    try {
      let printFrame = document.getElementById('anbk-hidden-print-frame') as HTMLIFrameElement | null;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'anbk-hidden-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
      }

      if (printFrame && printFrame.contentWindow) {
        const doc = printFrame.contentWindow.document;
        doc.open();
        doc.write(printHtml);
        doc.close();

        setTimeout(() => {
          try {
            printFrame?.contentWindow?.focus();
            printFrame?.contentWindow?.print();
            setMonitoringToast('✓ Dialog Cetak Muncul! Silakan pilih printer atau Simpan sebagai PDF.');
          } catch (iframeErr) {
            console.warn('Iframe print error:', iframeErr);
            try {
              window.print();
            } catch (winErr) {
              console.warn('window.print error:', winErr);
              handleDownloadMonitoringReportPdf();
            }
          }
          setIsPrintingDocument(false);
          setTimeout(() => setMonitoringToast(null), 5000);
        }, 300);
      } else {
        window.print();
        setIsPrintingDocument(false);
      }
    } catch (err) {
      console.warn('Print general error, fallback to PDF:', err);
      handleDownloadMonitoringReportPdf();
      setIsPrintingDocument(false);
    }
  };

  // Handler Konfirmasi Reset Rekap Ujian (Semua / Filter Tanggal) dari Modal
  const handleConfirmResetWithFilter = async (
    filter: ResetSubmissionsFilter,
    explicitToken?: string
  ) => {
    setIsResettingSubmissions(true);
    try {
      const prevMonitoredCount = monitoredStudents.length;
      const isTotal = !filter || filter.mode === 'ALL';

      if (isTotal) {
        setLocalDraftClearedAt(Date.now());
        if (onClearClassroomStudents) {
          onClearClassroomStudents();
        }
        try {
          localStorage.removeItem(STORAGE_KEY_STUDENTS);
          localStorage.removeItem(STORAGE_KEY_ACTIVE_SYNC);
          localStorage.removeItem('anbk_active_exam_draft_v1');
          localStorage.removeItem('anbk_exam_in_progress');
          localStorage.removeItem('anbk_exam_has_started');
          localStorage.removeItem('anbk_exam_has_completed');
          localStorage.removeItem('anbk_is_disqualified_v1');
          localStorage.setItem('anbk_violations_count', '0');
          clearUsedExamTokens();
          clearAllStudentSeenQuestionsHistory();
        } catch {}
      } else {
        // Filter parsial: hapus juga siswa dari classroomStudents yang cocok dengan filter
        if (onUpdateClassroomStudents && classroomStudents.length > 0) {
          const matchedSubKeys = new Set(
            submissions
              .filter((s) => isSubmissionMatchingResetFilter(s, filter))
              .map(
                (s) => `${(s.namaSiswa || '').trim().toLowerCase()}_${(s.nisNisn || '').trim()}`
              )
          );
          const remainingCls = classroomStudents.filter((cs) => {
            const k = `${(cs.namaSiswa || '').trim().toLowerCase()}_${(cs.nisNisn || '').trim()}`;
            return !matchedSubKeys.has(k);
          });
          onUpdateClassroomStudents(remainingCls);
        }
      }

      let res: any = null;
      if (onResetAllSubmissions) {
        res = await onResetAllSubmissions(filter, explicitToken);
      }

      if (isTotal && onUpdateSubmissions) {
        onUpdateSubmissions([]);
      }

      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setResetCompletedTime(nowStr);
      try {
        localStorage.setItem('anbk_reset_completed_time_v1', nowStr);
      } catch {}
      setIsResetSuccessActive(true);
      setTimeout(() => {
        setIsResetSuccessActive(false);
      }, 7000);
      setShowResetConfirmModal(false);

      const toDeleteCount = isTotal
        ? Math.max(prevMonitoredCount, res?.deletedCount ?? submissions.length)
        : res?.deletedCount ?? submissions.length;
      const remainingCount = isTotal ? 0 : res?.remainingCount ?? 0;
      const msg = isTotal
        ? `✓ RESET SEMUA SISWA MONITORING BERHASIL (Pukul ${nowStr}): Seluruh ${toDeleteCount} data siswa pada Panel Monitoring Ujian, Riwayat, Denah Kelas & Google Sheets telah direset bersih (0 siswa)!`
        : `✓ RESET BERHASIL (Pukul ${nowStr}): Berhasil mereset & menghapus ${toDeleteCount} data siswa sesuai filter! ${remainingCount} data tersisa.`;
      setMonitoringToast(msg);
      setTimeout(() => setMonitoringToast(null), 8000);

      if (onSyncRefresh) {
        onSyncRefresh();
      }
    } finally {
      setIsResettingSubmissions(false);
    }
  };

  // Handler Konfirmasi Hapus Siswa Tunggal Satu Persatu (Permanen dari Seluruh Sistem)
  const handleConfirmSingleStudentReset = async () => {
    if (!resetSingleStudentTarget) return;
    if (
      !isTeacherAccessUnlocked &&
      !isLocalTeacherVerified &&
      singleResetPasswordInput.trim() !== EXAM_INFO.teacherPassword
    ) {
      setSingleResetAuthError(
        'Akses Ditolak! Hanya Guru Mapel / Pengawas yang dapat menghapus data siswa. Masukkan Password Mode Guru yang benar.'
      );
      return;
    }
    setIsLocalTeacherVerified(true);
    if (onUnlockTeacherAuth) {
      onUnlockTeacherAuth();
    }
    setSingleResetAuthError(null);
    setIsResettingSingle(true);
    const target = resetSingleStudentTarget;
    try {
      const targetName = target.namaSiswa.trim().toLowerCase();
      const targetNis = (target.nisNisn || '').trim();

      // Eksekusi penghapusan permanen dari Cloud Firestore, Server Backend, Google Sheets, dan LocalStorage
      const cfg = getInitialCloudConfig();
      const res = await deleteSingleSubmissionPermanently(
        {
          id: target.id,
          namaSiswa: target.namaSiswa,
          nisNisn: target.nisNisn,
          kelas: target.kelas,
        },
        submissions,
        sanitizeRekapSheetUrl(cfg.googleSheetUrl),
        cfg.appsScriptWebAppUrl
      );

      if (onUpdateSubmissions) {
        onUpdateSubmissions(res.remainingSubmissions);
      }
      try {
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(res.remainingSubmissions));
      } catch {}

      if (onUpdateClassroomStudents && classroomStudents.length > 0) {
        const nextCls = classroomStudents.filter((cs) => {
          const match =
            cs.id === target.id ||
            (cs.namaSiswa.trim().toLowerCase() === targetName &&
              (!targetNis || targetNis === '-' || (cs.nisNisn || '').trim() === targetNis));
          return !match;
        });
        onUpdateClassroomStudents(nextCls);
        try {
          localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextCls));
          localStorage.setItem('anbk_classroom_manual_students_v1', JSON.stringify(nextCls));
        } catch {}
      }

      // Hapus mapping foto lokal jika ada
      try {
        const mapRaw = localStorage.getItem('anbk_student_photos_by_user_v1');
        if (mapRaw) {
          const map = JSON.parse(mapRaw);
          delete map[`${targetName}_${targetNis}`];
          delete map[`nis_${targetNis}`];
          delete map[`name_${targetName}`];
          localStorage.setItem('anbk_student_photos_by_user_v1', JSON.stringify(map));
        }
      } catch {}

      if (
        activeExamDraft &&
        (activeExamDraft.id === target.id ||
          (activeExamDraft.namaSiswa || '').trim().toLowerCase() === targetName)
      ) {
        setLocalDraftClearedAt(Date.now());
      }

      resetStudentTokenQuotaByStudent({
        namaSiswa: target.namaSiswa,
        nisNisn: target.nisNisn,
      });

      setMonitoringToast(
        `✓ Data siswa "${target.namaSiswa}" (Kelas ${target.kelas}) BERHASIL DIHAPUS PERMANEN dari Cloud Database Firestore, Server, Google Sheets & Panel Monitoring!`
      );

      setResetSingleStudentTarget(null);
      setSingleDeleteConfirmed(false);
      setTimeout(() => setMonitoringToast(null), 8000);
      if (onSyncRefresh) {
        onSyncRefresh();
      }
    } finally {
      setIsResettingSingle(false);
    }
  };

  // Handler Konfirmasi Hapus Permanen Seluruh Siswa yang Dipilih pada Filter Jenjang
  const handleConfirmDeleteFiltered = async () => {
    if (filteredStudents.length === 0) return;
    if (
      !isTeacherAccessUnlocked &&
      !isLocalTeacherVerified &&
      deleteFilteredPasswordInput.trim() !== EXAM_INFO.teacherPassword
    ) {
      setDeleteFilteredAuthError(
        'Akses Ditolak! Hanya Guru Mapel / Pengawas yang dapat menghapus data siswa. Masukkan Password Mode Guru yang benar.'
      );
      return;
    }
    setIsLocalTeacherVerified(true);
    if (onUnlockTeacherAuth) {
      onUnlockTeacherAuth();
    }
    setDeleteFilteredAuthError(null);
    setIsDeletingFiltered(true);

    const targetsToDelete = [...filteredStudents];
    const count = targetsToDelete.length;

    try {
      const cfg = getInitialCloudConfig();
      const res = await deleteMultipleSubmissionsPermanently(
        targetsToDelete.map((s) => ({
          id: s.id,
          namaSiswa: s.namaSiswa,
          nisNisn: s.nisNisn,
          kelas: s.kelas,
        })),
        submissions,
        sanitizeRekapSheetUrl(cfg.googleSheetUrl),
        cfg.appsScriptWebAppUrl
      );

      if (onUpdateSubmissions) {
        onUpdateSubmissions(res.remainingSubmissions);
      }
      try {
        localStorage.setItem('anbk_submissions_v1', JSON.stringify(res.remainingSubmissions));
      } catch {}

      // Bersihkan juga dari classroomStudents jika ada siswa yang terhapus
      if (onUpdateClassroomStudents && classroomStudents.length > 0) {
        const targetMap = new Map<string, boolean>();
        targetsToDelete.forEach((t) => {
          if (t.id) targetMap.set(t.id, true);
          const tn = (t.namaSiswa || '').trim().toLowerCase();
          const tnis = (t.nisNisn || '').trim();
          if (tn) {
            targetMap.set(tn, true);
            targetMap.set(`name_${tn}`, true);
          }
          if (tnis && tnis !== '-') {
            targetMap.set(tnis, true);
            targetMap.set(`nis_${tnis}`, true);
          }
          if (tn && tnis) {
            targetMap.set(`${tn}_${tnis}`, true);
          }
        });

        const nextCls = classroomStudents.filter((cs) => {
          const csName = (cs.namaSiswa || '').trim().toLowerCase();
          const csNis = (cs.nisNisn || '').trim();
          const csId = cs.id || '';
          return !(
            (csId && targetMap.has(csId)) ||
            targetMap.has(csName) ||
            targetMap.has(`name_${csName}`) ||
            (csNis && csNis !== '-' && targetMap.has(csNis)) ||
            (csName && csNis && targetMap.has(`${csName}_${csNis}`))
          );
        });
        onUpdateClassroomStudents(nextCls);
        try {
          localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(nextCls));
          localStorage.setItem('anbk_classroom_manual_students_v1', JSON.stringify(nextCls));
        } catch {}
      }

      // Hapus foto profil lokal jika ada
      try {
        const mapRaw = localStorage.getItem('anbk_student_photos_by_user_v1');
        if (mapRaw) {
          const map = JSON.parse(mapRaw);
          targetsToDelete.forEach((t) => {
            const tn = (t.namaSiswa || '').trim().toLowerCase();
            const tnis = (t.nisNisn || '').trim();
            delete map[`${tn}_${tnis}`];
            delete map[`nis_${tnis}`];
            delete map[`name_${tn}`];
          });
          localStorage.setItem('anbk_student_photos_by_user_v1', JSON.stringify(map));
        }
      } catch {}

      // Reset kuota token siswa yang dihapus
      targetsToDelete.forEach((t) => {
        resetStudentTokenQuotaByStudent({
          namaSiswa: t.namaSiswa,
          nisNisn: t.nisNisn,
        });
      });

      // Cek apakah draft aktif siswa di perangkat ini ikut terhapus
      if (activeExamDraft) {
        const activeName = (activeExamDraft.namaSiswa || '').trim().toLowerCase();
        const activeId = activeExamDraft.id || '';
        const isCurrentActiveDeleted = targetsToDelete.some(
          (t) =>
            (activeId && t.id === activeId) ||
            (t.namaSiswa || '').trim().toLowerCase() === activeName
        );
        if (isCurrentActiveDeleted) {
          setLocalDraftClearedAt(Date.now());
        }
      }

      const jenjangLabel =
        selectedJenjangFilter === 'ALL'
          ? 'Semua Jenjang'
          : `Jenjang Kelas ${selectedJenjangFilter}`;

      setMonitoringToast(
        `✓ Berhasil Menghapus Permanen ${count} Data Siswa (${jenjangLabel}) dari Cloud Firebase Firestore, Server, Google Sheets & Seluruh Perangkat Siswa!`
      );

      setShowDeleteFilteredModal(false);
      setDeleteFilteredConfirmed(false);
      setTimeout(() => setMonitoringToast(null), 8000);
      if (onSyncRefresh) {
        onSyncRefresh();
      }
    } finally {
      setIsDeletingFiltered(false);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3 font-sans">
      {/* Toast Sukses Kirim Peringatan */}
      {warningSuccessToast && (
        <div className="p-2.5 rounded-xl bg-emerald-950/95 border border-emerald-400 text-emerald-200 text-xs font-bold shadow-xl flex items-center justify-between gap-2 animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{warningSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setWarningSuccessToast(null)}
            className="text-emerald-300 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toast Notifikasi Sukses Reset Monitoring Ujian */}
      {monitoringToast && (
        <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/95 via-teal-950/90 to-slate-950 border border-emerald-400 text-emerald-200 text-xs font-bold shadow-xl flex items-center justify-between gap-2 animate-pulse">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 animate-bounce" />
            <span>{monitoringToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setMonitoringToast(null)}
            className="text-emerald-300 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER & TABEL KHUSUS CETAK RESMI (Hanya Muncul Saat window.print()) */}
      <div id="anbk-printable-monitoring-report" className="hidden print:block mb-6 p-6 border-2 border-slate-900 text-slate-900 bg-white font-sans">
        {/* KOP RESMI LEMBAGA SEKOLAH */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center space-y-0.5">
          <h2 className="text-xs font-bold tracking-widest uppercase text-slate-700">
            PEMERINTAH KABUPATEN ASAHAN • DINAS PENDIDIKAN
          </h2>
          <h1 className="text-lg font-black uppercase tracking-tight text-slate-950">
            {EXAM_INFO.namaSekolah}
          </h1>
          <p className="text-[10px] font-semibold text-slate-600">
            Alamat: Kisaran, Kab. Asahan, Sumatera Utara • Website: www.smpn7kisaran.sch.id
          </p>
          <div className="h-0.5 bg-slate-900 my-2" />
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 pt-1">
            LAPORAN RESMI MONITORING PENGAWASAN & HASIL EVALUASI UJIAN SISWA
          </h3>
          <p className="text-[11px] font-bold text-slate-800">
            Mata Pelajaran: {EXAM_INFO.mataPelajaran} (Fase D SMP) • Guru Pengawas: {EXAM_INFO.guruMapelUpper}
          </p>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 pt-2 border-t border-slate-300">
            <span>Waktu Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {new Date().toLocaleTimeString('id-ID')} WIB</span>
            <span>Filter: {selectedJenjangFilter === 'ALL' ? 'Semua Jenjang (VII & VIII)' : `Khusus Jenjang ${selectedJenjangFilter}`} | Token: {onlineToken || 'AKTIF'}</span>
            <span>Total Siswa: {filteredStudents.length} Peserta</span>
          </div>
        </div>

        {/* REKAP STATISTIK KELAS */}
        <div className="grid grid-cols-4 gap-2 mb-4 p-2 bg-slate-100 border border-slate-300 rounded text-center text-xs">
          <div>
            <span className="text-[9.5px] text-slate-600 block">Total Siswa Terpantau</span>
            <strong className="text-sm text-slate-900 font-mono">{stats.total} Siswa</strong>
          </div>
          <div>
            <span className="text-[9.5px] text-emerald-800 block">Sudah Selesai Ujian</span>
            <strong className="text-sm text-emerald-700 font-mono">{stats.finished} Siswa</strong>
          </div>
          <div>
            <span className="text-[9.5px] text-sky-800 block">Sedang Mengerjakan</span>
            <strong className="text-sm text-sky-700 font-mono">{stats.active} Siswa</strong>
          </div>
          <div>
            <span className="text-[9.5px] text-rose-800 block">Pelanggaran / Diskualifikasi</span>
            <strong className="text-sm text-rose-700 font-mono">{stats.violations + stats.disqualified} Siswa</strong>
          </div>
        </div>

        {/* TABEL DATA LENGKAP SISWA */}
        <table className="w-full text-left text-xs border border-slate-800 border-collapse mb-6">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-extrabold border-b border-slate-800 text-[9.5px] uppercase">
              <th className="py-2 px-2 border-r border-slate-400 text-center w-8">No</th>
              <th className="py-2 px-2 border-r border-slate-400">Nama Siswa</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-24">NIS / NISN</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-14">Kelas</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-14">Tipe</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-24">Status</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-20">Progres</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-12">Nilai</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center w-20">Pelanggaran</th>
              <th className="py-2 px-2 text-left">Perangkat</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-4 text-center text-slate-500 italic">
                  Tidak ada data siswa terpantau pada filter saat ini.
                </td>
              </tr>
            ) : (
              filteredStudents.map((st, idx) => (
                <tr key={st.id || idx} className="border-b border-slate-300 text-[9.5px]">
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 font-bold">{st.namaSiswa}</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono">{st.nisNisn || '-'}</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold">{st.kelas}</td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono">
                    {st.examType === 'PILIHAN_BERGANDA' ? 'PG 25' : 'Esay 15'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-semibold">
                    {st.status === 'SELESAI'
                      ? 'Selesai'
                      : st.status === 'SEDANG_MENGERJAKAN'
                      ? 'Mengerjakan'
                      : 'Diskualifikasi'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono">
                    {st.progresSoal.terjawab}/{st.progresSoal.total} ({st.progresSoal.persentase}%)
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold">
                    {st.nilaiAkhir !== undefined ? st.nilaiAkhir : '-'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center">
                    {st.violationCount > 0 ? `${st.violationCount}x Terdeteksi` : 'Tertib'}
                  </td>
                  <td className="py-1.5 px-2 truncate max-w-[120px] text-[8.5px] text-slate-700">
                    {st.deviceModel || st.deviceCategory}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* KOLOM TANDA TANGAN RESMI PENGAWAS & KEPALA SEKOLAH */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-400 text-xs text-center">
          <div>
            <p className="text-slate-600">Mengetahui,</p>
            <p className="font-bold text-slate-900 mt-0.5">{kepalaSekolahJabatan}</p>
            <div className="h-14" />
            <p className="font-bold text-slate-900 underline">{kepalaSekolahName}</p>
            <p className="text-[10px] text-slate-600 font-mono">NIP. {kepalaSekolahNip}</p>
          </div>
          <div>
            <p className="text-slate-600">{tanggalDokumenCetak}</p>
            <p className="font-bold text-slate-900 mt-0.5">Guru Mata Pelajaran / Pengawas Ruang</p>
            <div className="h-14" />
            <p className="font-bold text-slate-900 underline">{guruPengawasName}</p>
            <p className="text-[10px] text-slate-600 font-mono">NIP. {guruPengawasNip}</p>
          </div>
        </div>
      </div>

      {/* 1. HEADER MONITORING & TELEMETRI PENGAWAS (ROYAL NAVY THEME) */}
      <div className="rounded-xl border border-sky-500/35 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/90 p-2.5 sm:p-3.5 shadow-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
              <MonitorCheck className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate">
                  Panel Monitoring Ujian Siswa (Live Real-Time)
                </h2>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[7.5px] sm:text-[8px] font-mono font-extrabold text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE AKTIF
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-sky-300 truncate">
                {EXAM_INFO.namaSekolah} · Guru Pengawas: <strong className="text-white">{EXAM_INFO.guruMapel}</strong>
              </p>
            </div>
          </div>

          {/* Kontrol Refresh, Suara & Aksi Berita Acara */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {/* Toggle Suara Alarm */}
            <button
              type="button"
              onClick={() => setIsSoundAlertEnabled(!isSoundAlertEnabled)}
              className={`h-6 px-1.5 rounded border text-[8px] sm:text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                isSoundAlertEnabled
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}
              title="Aktifkan atau Matikan Suara Peringatan Bila Ada Siswa yang Melakukan Pelanggaran"
            >
              {isSoundAlertEnabled ? (
                <Volume2 className="w-3 h-3 text-emerald-300" />
              ) : (
                <VolumeX className="w-3 h-3 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {isSoundAlertEnabled ? 'Alarm On' : 'Alarm Off'}
              </span>
            </button>

            {/* Toggle Auto-Refresh */}
            <button
              type="button"
              onClick={() => setIsAutoRefreshActive(!isAutoRefreshActive)}
              className={`h-6 px-1.5 rounded border text-[8px] sm:text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                isAutoRefreshActive
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}
              title="Pembaruan Otomatis Setiap 4 Detik"
            >
              <RefreshCw
                className={`w-3 h-3 ${isAutoRefreshActive ? 'text-emerald-300' : 'text-slate-400'} ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden md:inline">
                {isAutoRefreshActive ? 'Auto-Sync: On' : 'Auto-Sync: Off'}
              </span>
            </button>

            {/* Tombol Segarkan Sekarang */}
            <button
              type="button"
              onClick={handleTriggerRefresh}
              disabled={isRefreshing}
              className="h-6 px-1.5 sm:px-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[8px] sm:text-[9px] flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
              title="Segarkan data pengawasan siswa sekarang"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Tombol Reset Semua Siswa pada Panel Monitoring Ujian (Hanya Guru Pengawas yang Bisa Akses - Dilindungi Password Guru) */}
            <button
              type="button"
              onClick={handleOpenResetAllButton}
              disabled={isResettingSubmissions}
              className={`h-6 px-2 sm:px-2.5 rounded font-black text-[8px] sm:text-[9px] flex items-center gap-1 transition-all cursor-pointer shadow-sm shrink-0 active:scale-95 touch-manipulation select-none ${
                isResetSuccessActive
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-200 ring-2 ring-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                  : isTeacherAccessUnlocked
                  ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white border border-rose-300/80 shadow-rose-950/40 hover:shadow-rose-600/30 ring-1 ring-amber-400/50'
                  : 'bg-gradient-to-r from-rose-700 via-red-700 to-slate-900 hover:from-rose-600 hover:to-red-600 text-white border border-amber-400/80 shadow-rose-950/50'
              }`}
              title="Khusus Guru Pengawas: Reset semua siswa pada Panel Monitoring Ujian Siswa (Wajib Verifikasi Password Guru)"
            >
              {isResetSuccessActive ? (
                <>
                  <CheckCircle2 className="w-2.5 h-2.5 text-slate-950 animate-bounce shrink-0" />
                  <span className="whitespace-nowrap">
                    ✓ Reset Semua Siswa Sukses{resetCompletedTime ? ` (${resetCompletedTime})` : ''}
                  </span>
                </>
              ) : (
                <>
                  {isTeacherAccessUnlocked ? (
                    <RotateCcw className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  ) : (
                    <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  )}
                  <Trash2 className="w-2.5 h-2.5 text-white shrink-0" />
                  <span className="whitespace-nowrap">
                    Reset Semua Siswa ({monitoredStudents.length})
                  </span>
                  <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-mono font-extrabold text-[7px] uppercase leading-none">
                    {isTeacherAccessUnlocked ? 'GURU ✓' : 'KHUSUS GURU'}
                  </span>
                </>
              )}
            </button>

            {/* Ekspor Berita Acara PDF & CSV */}
            <button
              type="button"
              onClick={handleDownloadMonitoringReportPdf}
              className="h-6 px-1.5 sm:px-2 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 border border-sky-400/30 text-[8px] sm:text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Unduh Berita Acara Monitoring Pengawas Ruang (PDF)"
            >
              <Download className="w-2.5 h-2.5 text-amber-300" />
              <span className="hidden sm:inline">Berita Acara (PDF)</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMonitoringCsv}
              className="h-6 px-1.5 sm:px-2 rounded bg-slate-800 hover:bg-slate-700 text-emerald-200 border border-emerald-400/30 text-[8px] sm:text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Unduh Lembar Pantauan Siswa (.CSV / Excel)"
            >
              <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-400" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            {/* Tombol Cetak Data Resmi (Dialog Pratinjau, Print & Unduh PDF) */}
            <button
              type="button"
              onClick={() => handleOpenPrintPreview()}
              className="h-6 px-2.5 rounded bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white border border-purple-300/70 ring-1 ring-purple-400/50 text-[8.5px] sm:text-[9.5px] font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md hover:shadow-purple-500/40 active:ring-2 active:ring-purple-300 touch-manipulation select-none"
              title="Cetak Data / Lembar Pengawasan Siswa Resmi (Pratinjau Cetak, Print Langsung & Unduh PDF)"
            >
              <Printer className="w-3 h-3 text-amber-300 shrink-0" />
              <span>Cetak Data</span>
            </button>
          </div>
        </div>

        {/* 2. STATISTIK KPI PENGAWASAN REAL-TIME */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 text-center">
          {/* Total Siswa Terpantau */}
          <div className="p-2 rounded-lg bg-slate-950/70 border border-white/10">
            <div className="text-[8px] sm:text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">
              Total Siswa Terdata
            </div>
            <div className="text-base sm:text-xl font-black text-white font-mono mt-0.5">
              {stats.total}
            </div>
            <div className="text-[7px] sm:text-[7.5px] text-sky-300 font-semibold truncate">
              {selectedJenjangFilter === 'ALL'
                ? 'Semua (VII & VIII)'
                : `Khusus Jenjang ${selectedJenjangFilter}`}
            </div>
          </div>

          {/* Sedang Mengerjakan (Active In-Progress) */}
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40">
            <div className="text-[8px] sm:text-[8.5px] font-bold text-emerald-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sedang Mengerjakan
            </div>
            <div className="text-base sm:text-xl font-black text-emerald-400 font-mono mt-0.5">
              {stats.active}
            </div>
            <div className="text-[7px] sm:text-[7.5px] text-emerald-300/80">Siswa Aktif di Ruang</div>
          </div>

          {/* Selesai Mengumpulkan */}
          <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-500/40">
            <div className="text-[8px] sm:text-[8.5px] font-bold text-sky-300 uppercase tracking-wider">
              Sudah Selesai
            </div>
            <div className="text-base sm:text-xl font-black text-sky-400 font-mono mt-0.5">
              {stats.finished}
            </div>
            <div className="text-[7px] sm:text-[7.5px] text-sky-300/80">Lembar Terkumpul</div>
          </div>

          {/* Terdeteksi Pelanggaran (Peringatan 1-2x) */}
          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40">
            <div className="text-[8px] sm:text-[8.5px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
              Ada Pelanggaran
            </div>
            <div className="text-base sm:text-xl font-black text-amber-300 font-mono mt-0.5">
              {stats.violations}
            </div>
            <div className="text-[7px] sm:text-[7.5px] text-amber-300/80">Peringatan 1x-2x</div>
          </div>

          {/* Diskualifikasi Otomatis (3x Pelanggaran) */}
          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 col-span-2 sm:col-span-1">
            <div className="text-[8px] sm:text-[8.5px] font-bold text-rose-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
              Diskualifikasi (3x)
            </div>
            <div className="text-base sm:text-xl font-black text-rose-400 font-mono mt-0.5">
              {stats.disqualified}
            </div>
            <div className="text-[7px] sm:text-[7.5px] text-rose-300/80">Wajib Ujian Susulan</div>
          </div>
        </div>

        {/* 3. BAR SIARAN PENGUMUMAN PENGAWAS RUANG KE SELURUH SISWA */}
        <div className="p-2 rounded-lg bg-slate-950/80 border border-sky-400/30 text-[9px] sm:text-[10px] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>Siaran Pengumuman Pengawas Ruang (Pesan Instan untuk Seluruh Siswa):</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBroadcastInput(!showBroadcastInput)}
              className="text-[8px] sm:text-[9px] font-bold text-sky-300 hover:text-white underline cursor-pointer"
            >
              {showBroadcastInput ? 'Tutup Input' : 'Tulis / Ubah Pesan Siaran'}
            </button>
          </div>

          {showBroadcastInput ? (
            <div className="flex gap-1.5 pt-0.5">
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Contoh: Perhatian seluruh siswa, sisa waktu pengerjaan tinggal 10 menit lagi. Harap periksa kembali nomor yang ragu-ragu!"
                className="flex-1 px-2.5 py-1 rounded border border-white/20 bg-slate-900 text-white text-[9.5px] focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={handleSaveBroadcast}
                className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[9px] cursor-pointer shrink-0"
              >
                Siarkan
              </button>
            </div>
          ) : broadcastText ? (
            <div className="p-1.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-200 text-[9px] flex items-center justify-between gap-2">
              <span className="truncate">
                📢 <strong className="text-white">Pesan Aktif:</strong> &quot;{broadcastText}&quot;
              </span>
              <span className="text-[7.5px] text-amber-300 font-mono shrink-0">Tersiar di layar siswa</span>
            </div>
          ) : (
            <div className="text-slate-400 text-[8.5px] italic">
              Belum ada siaran pengawas aktif. Klik &quot;Tulis / Ubah Pesan Siaran&quot; untuk mengirimkan instruksi ke seluruh perangkat siswa.
            </div>
          )}

          {broadcastFeedback && (
            <div className="text-[8.5px] text-emerald-300 font-bold">{broadcastFeedback}</div>
          )}
        </div>
      </div>

      {/* 4. FILTER UTAMA DAN KONTROL TAMPILAN MONITORING SISWA */}
      <div className="p-2 sm:p-2.5 rounded-xl border border-sky-500/25 bg-slate-900/95 space-y-2 text-[8px] sm:text-[9.5px] shadow-lg">
        {/* Baris Atas Filter: Segmented Button Jenjang Kelas (VII atau VIII) secara spesifik */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-black text-sky-300 uppercase tracking-wider mr-1">
              <Filter className="w-3.5 h-3.5 text-sky-400" />
              <span>Filter Jenjang Siswa:</span>
            </div>

            {/* Segmented Button: Semua Jenjang / Jenjang Kelas VII / Jenjang Kelas VIII */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-sky-500/30 shadow-inner">
              <button
                type="button"
                onClick={() => handleJenjangFilterChange('ALL')}
                className={`px-2.5 py-1 rounded-md text-[8.5px] sm:text-[9.5px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedJenjangFilter === 'ALL'
                    ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-sm ring-1 ring-sky-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Layers className="w-3 h-3 text-sky-300" />
                <span>Semua Jenjang</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[7.5px] font-mono leading-none">
                  {countJenjangAll}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleJenjangFilterChange('VII')}
                className={`px-2.5 py-1 rounded-md text-[8.5px] sm:text-[9.5px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedJenjangFilter === 'VII'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm ring-1 ring-emerald-300'
                    : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-slate-800/80'
                }`}
              >
                <GraduationCap className="w-3 h-3 text-emerald-300" />
                <span>Jenjang Kelas VII</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[7.5px] font-mono leading-none">
                  {countJenjangVII}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleJenjangFilterChange('VIII')}
                className={`px-2.5 py-1 rounded-md text-[8.5px] sm:text-[9.5px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedJenjangFilter === 'VIII'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm ring-1 ring-amber-300'
                    : 'text-amber-300/80 hover:text-amber-200 hover:bg-slate-800/80'
                }`}
              >
                <Award className="w-3 h-3 text-amber-300" />
                <span>Jenjang Kelas VIII</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[7.5px] font-mono leading-none">
                  {countJenjangVIII}
                </span>
              </button>
            </div>

            {/* Tombol Hapus Data Terpilih (Filter Jenjang Siswa - Berlaku di Semua Perangkat Siswa) */}
            <button
              type="button"
              onClick={handleOpenDeleteFilteredButton}
              disabled={filteredStudents.length === 0}
              className={`px-2.5 py-1 rounded-md text-[8.5px] sm:text-[9.5px] font-black flex items-center gap-1.5 transition-all shadow-sm border ${
                filteredStudents.length > 0
                  ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white border-rose-300/60 shadow-xs shadow-rose-950/60 hover:shadow-md hover:ring-2 hover:ring-rose-400/50 cursor-pointer'
                  : 'bg-slate-900 text-slate-500 border-white/10 cursor-not-allowed opacity-60'
              }`}
              title={`Hapus permanen seluruh data siswa yang sedang dipilih pada Filter Jenjang (${selectedJenjangFilter === 'ALL' ? 'Semua Jenjang' : `Jenjang Kelas ${selectedJenjangFilter}`} - ${filteredStudents.length} Siswa) berlaku di semua perangkat device siswa`}
            >
              <Trash2 className="w-3 h-3 text-rose-200 shrink-0" />
              <span>
                Hapus Data {selectedJenjangFilter === 'ALL' ? 'Semua Jenjang' : `Jenjang ${selectedJenjangFilter}`}
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[7.5px] font-mono leading-none border border-white/20">
                {filteredStudents.length}
              </span>
            </button>
          </div>

          {/* Indikator Status Jenjang Aktif & Reset */}
          <div className="flex items-center gap-2">
            <span className="text-[8px] sm:text-[8.5px] text-slate-400">
              Sedang Memantau:{' '}
              <strong className="text-white">
                {selectedJenjangFilter === 'ALL'
                  ? 'Semua Jenjang (Kelas VII & VIII)'
                  : `Khusus Jenjang Kelas ${selectedJenjangFilter}`}
              </strong>
            </span>
            {(selectedJenjangFilter !== 'ALL' ||
              selectedKelasFilter !== 'ALL' ||
              selectedStatusFilter !== 'ALL' ||
              selectedTypeFilter !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  handleJenjangFilterChange('ALL');
                  setSelectedKelasFilter('ALL');
                  setSelectedStatusFilter('ALL');
                  setSelectedTypeFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-amber-400/30 text-[7.5px] sm:text-[8px] font-bold cursor-pointer transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Baris Bawah: Input Cari, Rombel Spesifik, Status, Format Soal & Mode Kartu */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[280px]">
            {/* Input Cari */}
            <div className="relative min-w-[130px] sm:min-w-[180px] flex-1 sm:flex-initial">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa / NISN..."
                className="w-full h-6 pl-7 pr-2 rounded border border-white/15 bg-slate-950 text-white placeholder:text-slate-500 text-[8.5px] sm:text-[9px] focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {/* Filter Rombel Kelas Spesifik */}
            <select
              value={selectedKelasFilter}
              onChange={(e) => setSelectedKelasFilter(e.target.value)}
              className="h-6 px-1.5 rounded border border-sky-400/40 bg-slate-950 text-sky-200 text-[8px] sm:text-[9px] font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">
                {selectedJenjangFilter === 'ALL'
                  ? 'Semua Rombel (VII & VIII)'
                  : `Semua Rombel Kelas ${selectedJenjangFilter}`}
              </option>
              {availableKelasOptions.map((k) => (
                <option key={k} value={k}>
                  Rombel {k}
                </option>
              ))}
            </select>

            {/* Filter Status Siswa */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="h-6 px-1.5 rounded border border-white/15 bg-slate-950 text-emerald-300 text-[8px] sm:text-[9px] font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status Siswa</option>
              <option value="SEDANG_MENGERJAKAN">Sedang Mengerjakan ({stats.active})</option>
              <option value="SELESAI">Sudah Selesai ({stats.finished})</option>
              <option value="PELANGGARAN">Ada Pelanggaran ({stats.violations})</option>
              <option value="DISKUALIFIKASI">Diskualifikasi ({stats.disqualified})</option>
            </select>

            {/* Filter Format Soal */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
              className="h-6 px-1.5 rounded border border-white/15 bg-slate-950 text-amber-300 text-[8px] sm:text-[9px] font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Format Soal</option>
              <option value="PILIHAN_BERGANDA">Pilihan Berganda (25 Soal)</option>
              <option value="ESAY_TEST">Esay Test (15 Soal)</option>
            </select>
          </div>

          {/* Sisi Kanan: Status Jumlah & Toggle Tampilan Grid/Tabel */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[8px] text-slate-300 font-mono hidden sm:inline">
              Menampilkan:{' '}
              <strong className="text-white px-1.5 py-0.2 rounded bg-sky-500/20 border border-sky-400/30">
                {filteredStudents.length}
              </strong>{' '}
              siswa {selectedJenjangFilter !== 'ALL' ? `(Kelas ${selectedJenjangFilter})` : ''}
            </span>

            <div className="flex items-center border border-white/15 rounded bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[8.5px] font-bold transition-colors cursor-pointer ${
                viewMode === 'CARDS'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode Kartu
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[8.5px] font-bold transition-colors cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mode Tabel
            </button>
          </div>

            {onOpenClassroomDesign && (
              <button
                type="button"
                onClick={onOpenClassroomDesign}
                className="h-6 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[8px] sm:text-[8.5px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                title="Buka Denah Posisi Kursi Kelas (Design Classroom)"
              >
                <Layers className="w-2.5 h-2.5 text-white" />
                <span>Denah Kelas</span>
              </button>
            )}

            {/* Tombol Cetak Data Laporan Siswa (Filter Jenjang) */}
            <button
              type="button"
              onClick={() => handleOpenPrintPreview()}
              className="h-6 px-2.5 rounded bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-black text-[8px] sm:text-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-md hover:shadow-purple-500/30 border border-purple-300/60 ring-1 ring-purple-400/40 select-none touch-manipulation"
              title={`Cetak Data Laporan Monitoring Siswa (${selectedJenjangFilter === 'ALL' ? 'Semua Jenjang' : `Jenjang Kelas ${selectedJenjangFilter}`}) - Buka Pratinjau, Edit Tanda Tangan, Print & PDF`}
            >
              <Printer className="w-3 h-3 text-amber-300 shrink-0" />
              <span>Cetak Data Laporan</span>
              {selectedJenjangFilter !== 'ALL' && (
                <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[7px] font-black uppercase tracking-wider">
                  {selectedJenjangFilter}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 5. TAMPILAN DAFTAR SISWA TERPANTAU (MODE KARTU ATAU TABEL) */}
      {filteredStudents.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-white/15 bg-slate-900/50 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-500 mx-auto" />
          <h4 className="text-xs sm:text-sm font-bold text-white">
            Tidak Ada Siswa yang Sesuai dengan Filter
          </h4>
          <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
            Coba ubah kriteria pencarian nama atau reset filter status pengerjaan untuk melihat seluruh data peserta ujian.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedStatusFilter('ALL');
              setSelectedTypeFilter('ALL');
              setSelectedKelasFilter('ALL');
            }}
            className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold transition-colors cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : viewMode === 'CARDS' ? (
        /* =================================================================== */
        /* MODE KARTU VISUAL SISWA REAL-TIME (GRID)                           */
        /* =================================================================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredStudents.map((student) => {
            const isWorking = student.status === 'SEDANG_MENGERJAKAN';
            const isFinished = student.status === 'SELESAI';
            const isDisq = student.status === 'DISKUALIFIKASI';
            const hasViolations = student.violationCount > 0;

            let cardBorder = 'border-white/15 hover:border-sky-400/40 shadow-md shadow-slate-950/50 hover:shadow-lg hover:shadow-sky-950/40';
            let cardBg = 'bg-slate-900/90';
            if (isDisq) {
              cardBorder = 'border-rose-500/70 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/30';
              cardBg = 'bg-gradient-to-br from-rose-950/50 via-slate-900 to-slate-950';
            } else if (hasViolations) {
              cardBorder = 'border-amber-400/70 shadow-md shadow-amber-950/40 ring-1 ring-amber-400/30';
              cardBg = 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950';
            } else if (isWorking) {
              cardBorder = 'border-emerald-500/60 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30';
              cardBg = 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950';
            }

            return (
              <div
                key={student.id}
                className={`rounded-2xl border p-3 sm:p-3.5 space-y-2.5 transition-all duration-200 shadow-md shadow-slate-950/40 hover:shadow-lg hover:shadow-sky-950/30 backdrop-blur-xs ${cardBorder} ${cardBg}`}
              >
                {/* Header Kartu: Foto, Identitas & Badge Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar Siswa dengan Status Ring & Kemudahan Tambah/Ganti Foto Profil */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditStudentModal(student)}
                        className="group relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-white/20 bg-slate-950 flex items-center justify-center cursor-pointer hover:border-amber-400 hover:ring-2 hover:ring-amber-400/50 hover:scale-105 active:scale-95 transition-all shadow-md focus:outline-hidden"
                        title={
                          student.photoUrl
                            ? `Klik untuk ganti / perbarui foto profil siswa ${student.namaSiswa}`
                            : `Klik kotak inisial "${student.namaSiswa.slice(0, 2).toUpperCase()}" untuk menambahkan foto profil siswa ${student.namaSiswa}`
                        }
                      >
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.namaSiswa}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
                            <span className="font-mono text-xs sm:text-[13px] font-black text-amber-300 tracking-tight leading-none drop-shadow-xs">
                              {student.namaSiswa.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[6.5px] text-sky-400 font-extrabold tracking-tight mt-0.5 leading-none flex items-center gap-0.5">
                              <Camera className="w-2 h-2 text-amber-400 shrink-0" />
                              <span>+Foto</span>
                            </span>
                          </div>
                        )}

                        {/* Hover Overlay: Ganti / Tambah Foto */}
                        <div className="absolute inset-0 bg-slate-950/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-amber-300 backdrop-blur-[1px]">
                          <Camera className="w-3.5 h-3.5 text-amber-300 drop-shadow-xs" />
                          <span className="text-[6.5px] font-black text-white text-center leading-tight">
                            {student.photoUrl ? 'Ubah Foto' : '+Foto'}
                          </span>
                        </div>
                      </button>

                      {/* Indikator tambah foto di sudut bila belum ada foto */}
                      {!student.photoUrl && (
                        <span
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border border-slate-950 text-slate-950 flex items-center justify-center text-[8.5px] font-black shadow-xs pointer-events-none animate-pulse"
                          title="Klik kotak untuk menambahkan gambar foto profil siswa"
                        >
                          +
                        </span>
                      )}

                      {/* Pulse Ring Status */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          isDisq
                            ? 'bg-rose-500 animate-bounce'
                            : hasViolations
                            ? 'bg-amber-400 animate-pulse'
                            : isWorking
                            ? 'bg-emerald-400 animate-ping'
                            : 'bg-sky-400'
                        }`}
                        title={student.status}
                      />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-[13px] font-extrabold text-white truncate leading-tight">
                        {student.namaSiswa}
                      </h4>
                      <div className="text-[9px] text-slate-300 flex items-center gap-1 truncate mt-0.5">
                        <span className="text-sky-300 font-mono">NISN: {student.nisNisn}</span>
                        <span>·</span>
                        <span className="text-amber-300 font-bold">Kelas {student.kelas}</span>
                        {student.seatNumber && (
                          <span className="px-1 py-0.2 rounded bg-white/10 text-[8px] font-mono text-slate-300">
                            Kursi #{student.seatNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badge Format Soal */}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[7.5px] sm:text-[8px] font-mono font-extrabold shrink-0 border ${
                      student.examType === 'PILIHAN_BERGANDA'
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400/30'
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                    }`}
                  >
                    {student.examType === 'PILIHAN_BERGANDA' ? 'PG 25' : 'Esay 15'}
                  </span>
                </div>

                {/* Progress Bar & Status Pengerjaan */}
                <div className="p-2 rounded-lg bg-slate-950/70 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[8.5px] sm:text-[9px]">
                    <span className="font-bold text-slate-300 flex items-center gap-1">
                      {isWorking && <Clock className="w-2.5 h-2.5 text-emerald-400 animate-spin" />}
                      {isFinished && <CheckCircle2 className="w-2.5 h-2.5 text-sky-400" />}
                      {isDisq && <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />}
                      <span
                        className={
                          isDisq
                            ? 'text-rose-400 font-bold'
                            : isWorking
                            ? 'text-emerald-300 font-bold'
                            : 'text-sky-300 font-bold'
                        }
                      >
                        {isDisq
                          ? 'Diskualifikasi (3x Pelanggaran)'
                          : isWorking
                          ? `Sedang di Soal #${student.progresSoal.nomorAktif}`
                          : `Selesai (${student.nilaiAkhir ?? '-'}%)`}
                      </span>
                    </span>

                    <span className="font-mono text-white font-extrabold">
                      {student.progresSoal.terjawab} / {student.progresSoal.total} Soal (
                      {student.progresSoal.persentase}%)
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isDisq
                          ? 'bg-rose-500'
                          : hasViolations
                          ? 'bg-amber-400'
                          : isWorking
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                          : 'bg-gradient-to-r from-sky-400 to-indigo-400'
                      }`}
                      style={{ width: `${student.progresSoal.persentase}%` }}
                    />
                  </div>
                </div>

                {/* Telemetri Perangkat Siswa (Brand, Model, Baterai, IP) */}
                <div className="grid grid-cols-2 gap-1.5 text-[8px] sm:text-[8.5px]">
                  {/* Info Device */}
                  <div className="p-1.5 rounded bg-slate-950/50 border border-white/10 flex items-center gap-1 min-w-0">
                    {student.deviceCategory.toLowerCase().includes('laptop') ||
                    student.deviceCategory.toLowerCase().includes('komputer') ? (
                      <Laptop className="w-3 h-3 text-sky-400 shrink-0" />
                    ) : (
                      <Smartphone className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate text-slate-200" title={student.deviceModel}>
                      {student.deviceModel || student.deviceCategory}
                    </span>
                  </div>

                  {/* Info Baterai */}
                  <div className="p-1.5 rounded bg-slate-950/50 border border-white/10 flex items-center justify-between gap-1 text-slate-300">
                    <span className="text-[7.5px] text-slate-400">Baterai:</span>
                    <span className="font-mono font-bold text-white flex items-center gap-0.5">
                      {student.isBatteryCharging ? (
                        <BatteryCharging className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (student.batteryLevel ?? 100) < 20 ? (
                        <BatteryLow className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                      ) : (
                        <BatteryMedium className="w-2.5 h-2.5 text-amber-300" />
                      )}
                      <span>{student.batteryLevel ?? 85}%</span>
                    </span>
                  </div>
                </div>

                {/* Indikator Status Pelanggaran & Sensor Anti-Curang */}
                <div
                  className={`p-1.5 rounded-lg border text-[8px] sm:text-[8.5px] flex items-center justify-between gap-1 ${
                    isDisq
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                      : hasViolations
                      ? 'bg-amber-950/70 border-amber-400/50 text-amber-200'
                      : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0 truncate">
                    {isDisq ? (
                      <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                    ) : hasViolations ? (
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {isDisq
                        ? '3x Pelanggaran (Otomatis Dihentikan)'
                        : hasViolations
                        ? `${student.violationCount}/3x Pelanggaran: ${student.violationLogs[student.violationLogs.length - 1] || 'Terdeteksi'}`
                        : 'Integritas: Bersih / Tanpa Pelanggaran (0/3)'}
                    </span>
                  </div>

                  <span className="font-mono font-extrabold shrink-0">
                    {student.violationCount}/3
                  </span>
                </div>

                {/* Tombol Aksi Pengawas Ruang: Rincian, Tegur, Edit, Hapus */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentDetail(student)}
                    className="py-1 px-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[8px] sm:text-[8.5px] flex items-center justify-center gap-1 transition-colors cursor-pointer truncate shadow-xs"
                    title="Lihat rincian lengkap pengerjaan siswa"
                  >
                    <Eye className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">Rincian</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendWarning(student)}
                    className="py-1 px-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[8px] sm:text-[8.5px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs truncate"
                    title="Kirim teguran pengawas ke layar siswa"
                  >
                    <Send className="w-2.5 h-2.5 text-slate-950 shrink-0" />
                    <span className="truncate">Tegur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditStudentModal(student)}
                    className="py-1 px-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[8px] sm:text-[8.5px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs border border-emerald-400/40 truncate"
                    title="Edit nama, NISN, kelas, dan foto profil siswa"
                  >
                    <Edit3 className="w-2.5 h-2.5 text-white shrink-0" />
                    <span className="truncate">Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenResetSingleStudentButton(student, 'DELETE_SUBMISSION')
                    }
                    className="py-1 px-1.5 rounded-lg bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black text-[8px] sm:text-[8.5px] flex items-center justify-center gap-1 transition-all cursor-pointer border border-rose-300/50 shadow-xs shadow-rose-950/40 hover:shadow-md hover:ring-1 hover:ring-rose-400 truncate"
                    title="Hapus permanen data siswa ini berlaku di semua perangkat device siswa (Firebase, Server, Sheets & Monitoring)"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-white shrink-0" />
                    <span className="truncate">Hapus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =================================================================== */
        /* MODE TABEL TERPERINCI PENGAWAS RUANG UJIAN (TABLE)                 */
        /* =================================================================== */
        <div className="rounded-xl border border-white/10 bg-slate-900/90 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[9px] sm:text-[10px] border-collapse">
              <thead className="bg-slate-950 border-b border-white/10 text-slate-300 font-extrabold uppercase tracking-wider text-[8px] sm:text-[8.5px]">
                <tr>
                  <th className="py-2.5 px-3">Siswa</th>
                  <th className="py-2.5 px-2">Kelas</th>
                  <th className="py-2.5 px-2">Tipe Soal</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Progres</th>
                  <th className="py-2.5 px-2">Nilai</th>
                  <th className="py-2.5 px-2">Pelanggaran</th>
                  <th className="py-2.5 px-2">Perangkat / IP</th>
                  <th className="py-2.5 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.map((stu) => {
                  const isWorking = stu.status === 'SEDANG_MENGERJAKAN';
                  const isDisq = stu.status === 'DISKUALIFIKASI';
                  const hasV = stu.violationCount > 0;

                  return (
                    <tr
                      key={stu.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {/* Siswa */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStudentModal(stu)}
                            className="group relative w-7 h-7 rounded-lg overflow-hidden border border-white/20 bg-slate-950 shrink-0 flex items-center justify-center cursor-pointer hover:border-amber-400 hover:ring-1 hover:ring-amber-400 transition-all focus:outline-hidden"
                            title={
                              stu.photoUrl
                                ? `Klik untuk ganti / perbarui foto profil siswa ${stu.namaSiswa}`
                                : `Klik untuk tambahkan foto profil siswa ${stu.namaSiswa}`
                            }
                          >
                            {stu.photoUrl ? (
                              <img
                                src={stu.photoUrl}
                                alt={stu.namaSiswa}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="font-mono text-[9px] font-bold text-amber-300">
                                {stu.namaSiswa.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-amber-300">
                              <Camera className="w-3 h-3 text-amber-300" />
                            </div>
                          </button>
                          <div className="min-w-0">
                            <div className="font-extrabold text-white truncate max-w-[150px]">
                              {stu.namaSiswa}
                            </div>
                            <div className="text-[8px] text-slate-400 font-mono">
                              NISN: {stu.nisNisn}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kelas */}
                      <td className="py-2 px-2 text-amber-300 font-bold whitespace-nowrap">
                        Kelas {stu.kelas}
                        {stu.seatNumber && (
                          <span className="block text-[7.5px] text-slate-400">
                            Kursi #{stu.seatNumber}
                          </span>
                        )}
                      </td>

                      {/* Tipe Soal */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold ${
                            stu.examType === 'PILIHAN_BERGANDA'
                              ? 'bg-sky-500/20 text-sky-200'
                              : 'bg-emerald-500/20 text-emerald-200'
                          }`}
                        >
                          {stu.examType === 'PILIHAN_BERGANDA' ? 'PG 25' : 'Esay 15'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                            isDisq
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isWorking
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {isWorking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                          {isDisq ? 'Diskualifikasi' : isWorking ? 'Mengerjakan' : 'Selesai'}
                        </span>
                      </td>

                      {/* Progres */}
                      <td className="py-2 px-2 whitespace-nowrap font-mono">
                        <div className="text-white font-bold">
                          {stu.progresSoal.terjawab}/{stu.progresSoal.total} ({stu.progresSoal.persentase}%)
                        </div>
                        <div className="w-14 h-1 rounded-full bg-slate-800 overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${stu.progresSoal.persentase}%` }}
                          />
                        </div>
                      </td>

                      {/* Nilai */}
                      <td className="py-2 px-2 whitespace-nowrap font-mono font-black text-amber-300">
                        {stu.nilaiAkhir !== undefined ? `${stu.nilaiAkhir}%` : '-'}
                      </td>

                      {/* Pelanggaran */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                            isDisq
                              ? 'bg-rose-950 text-rose-300 border border-rose-500'
                              : hasV
                              ? 'bg-amber-950 text-amber-300 border border-amber-400'
                              : 'bg-emerald-950/60 text-emerald-300'
                          }`}
                        >
                          {stu.violationCount}/3
                        </span>
                      </td>

                      {/* Perangkat & IP */}
                      <td className="py-2 px-2 text-slate-300 text-[8px] max-w-[130px] truncate">
                        <div className="truncate font-medium">{stu.deviceModel}</div>
                        <div className="text-slate-500 font-mono text-[7.5px]">{stu.clientIp}</div>
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentDetail(stu)}
                            className="p-1 rounded bg-sky-600/80 hover:bg-sky-500 text-white cursor-pointer"
                            title="Rincian"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendWarning(stu)}
                            className="p-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
                            title="Tegur Siswa"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditStudentModal(stu)}
                            className="px-1.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer border border-emerald-400/40 flex items-center gap-1 text-[8px] font-black"
                            title="Edit Data & Foto Profil Siswa"
                          >
                            <Edit3 className="w-3 h-3 text-white" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenResetSingleStudentButton(stu, 'DELETE_SUBMISSION')
                            }
                            className="px-2 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white cursor-pointer border border-rose-300/50 flex items-center gap-1 text-[8px] font-black transition-all shadow-xs hover:shadow-md hover:ring-1 hover:ring-rose-400"
                            title="Hapus data siswa ini secara permanen dari seluruh sistem (dilengkapi dialog konfirmasi keamanan)"
                          >
                            <Trash2 className="w-3 h-3 text-white" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. MODAL DETAIL SISWA TERPANTAU (TELEMETRI LENGKAP & JAWABAN)       */}
      {/* =================================================================== */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-start justify-center pt-2 sm:pt-4 px-3 pb-4 overflow-y-auto">
          <div className="max-w-xl w-full self-start mt-0 sm:mt-1 rounded-2xl border border-sky-400/40 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-amber-400 bg-slate-950 shrink-0">
                  {selectedStudentDetail.photoUrl ? (
                    <img
                      src={selectedStudentDetail.photoUrl}
                      alt={selectedStudentDetail.namaSiswa}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-mono font-black text-amber-300 text-xs">
                      {selectedStudentDetail.namaSiswa.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                    {selectedStudentDetail.namaSiswa}
                  </h3>
                  <p className="text-[10px] text-sky-300">
                    NISN: {selectedStudentDetail.nisNisn} · Kelas {selectedStudentDetail.kelas} · Sem {selectedStudentDetail.semester}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Statistik Ringkas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
              <div className="p-2 rounded-lg bg-slate-950 border border-white/10">
                <div className="text-slate-400 text-[8.5px] uppercase">Status Ujian</div>
                <div
                  className={`font-black text-xs mt-0.5 ${
                    selectedStudentDetail.status === 'DISKUALIFIKASI'
                      ? 'text-rose-400'
                      : selectedStudentDetail.status === 'SEDANG_MENGERJAKAN'
                      ? 'text-emerald-400'
                      : 'text-sky-400'
                  }`}
                >
                  {selectedStudentDetail.status === 'DISKUALIFIKASI'
                    ? 'Diskualifikasi'
                    : selectedStudentDetail.status === 'SEDANG_MENGERJAKAN'
                    ? 'Sedang Ujian'
                    : 'Selesai'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-white/10">
                <div className="text-slate-400 text-[8.5px] uppercase">Soal Terjawab</div>
                <div className="font-mono font-black text-xs text-white mt-0.5">
                  {selectedStudentDetail.progresSoal.terjawab} / {selectedStudentDetail.progresSoal.total} ({selectedStudentDetail.progresSoal.persentase}%)
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-white/10">
                <div className="text-slate-400 text-[8.5px] uppercase">Nilai Akhir</div>
                <div className="font-mono font-black text-xs text-amber-300 mt-0.5">
                  {selectedStudentDetail.nilaiAkhir !== undefined ? `${selectedStudentDetail.nilaiAkhir}%` : '-'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-white/10">
                <div className="text-slate-400 text-[8.5px] uppercase">Pelanggaran</div>
                <div
                  className={`font-mono font-black text-xs mt-0.5 ${
                    selectedStudentDetail.violationCount === 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {selectedStudentDetail.violationCount}/3
                </div>
              </div>
            </div>

            {/* Rincian Perangkat & Keamanan */}
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5 text-[10px] sm:text-[11px]">
              <div className="font-bold text-sky-300 flex items-center gap-1.5 border-b border-white/10 pb-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
                <span>Telemetri Perangkat &amp; Koneksi Siswa:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-300">
                <div>
                  Kategori Perangkat:{' '}
                  <strong className="text-white">{selectedStudentDetail.deviceCategory}</strong>
                </div>
                <div>
                  Model Perangkat:{' '}
                  <strong className="text-white">{selectedStudentDetail.deviceModel}</strong>
                </div>
                <div>
                  OS &amp; Browser:{' '}
                  <strong className="text-white">{selectedStudentDetail.deviceOsBrowser}</strong>
                </div>
                <div>
                  Alamat IP:{' '}
                  <span className="font-mono text-emerald-300">{selectedStudentDetail.clientIp}</span>
                </div>
                <div>
                  Status Baterai:{' '}
                  <strong className="text-amber-300">
                    {selectedStudentDetail.batteryLevel ?? 85}% (
                    {selectedStudentDetail.isBatteryCharging ? 'Charging' : 'Discharging'})
                  </strong>
                </div>
                <div>
                  Waktu Terakhir Aktif:{' '}
                  <span className="font-mono text-slate-400">{selectedStudentDetail.lastActiveTimestamp}</span>
                </div>
              </div>
            </div>

            {/* Catatan Pelanggaran Siswa */}
            {selectedStudentDetail.violationLogs.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-1.5 text-[10px] sm:text-[11px]">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Catatan Pelanggaran Keamanan Siswa:</span>
                </div>
                <div className="space-y-1">
                  {selectedStudentDetail.violationLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-slate-950 border border-rose-500/20 text-rose-200"
                    >
                      #{idx + 1}. {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tombol Footer Modal */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExecuteDirectPrint}
                  className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1 border border-purple-400/40"
                  title="Cetak Laporan Rinci Siswa Ini (Multi-layer Print & PDF)"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>Cetak Laporan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = selectedStudentDetail;
                    setSelectedStudentDetail(null);
                    handleSendWarning(s);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer shadow-md flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-slate-950" />
                  <span>Tegur</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const s = selectedStudentDetail;
                    setSelectedStudentDetail(null);
                    handleOpenResetSingleStudentButton(s, 'DELETE_SUBMISSION');
                  }}
                  className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-extrabold transition-colors cursor-pointer shadow-md flex items-center gap-1 border border-rose-300/40"
                  title="Hapus siswa ini satu persatu"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                  <span>Hapus Siswa Ini</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. MODAL KIRIM TEGURAN PENGAWAS KE SISWA                            */}
      {/* =================================================================== */}
      {warningModalStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-start justify-center pt-2 sm:pt-4 px-3 pb-4 overflow-y-auto">
          <div className="max-w-md w-full self-start mt-0 sm:mt-1 rounded-2xl border-2 border-amber-400/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-300">
                  Kirim Pesan Teguran Pengawas Ruang
                </h3>
                <p className="text-[10px] text-slate-300">
                  Kepada: <strong className="text-white">{warningModalStudent.namaSiswa}</strong> (Kelas {warningModalStudent.kelas})
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-sky-200">
                Isi Pesan Peringatan / Instruksi Pengawas:
              </label>
              <textarea
                rows={3}
                value={customWarningMessage}
                onChange={(e) => setCustomWarningMessage(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-white/20 bg-slate-950 text-white text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="Tuliskan pesan instruksi langsung..."
              />
            </div>

            {/* Template Pesan Cepat */}
            <div className="space-y-1 text-[8.5px] sm:text-[9px]">
              <span className="text-slate-400">Pilih Template Cepat:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCustomWarningMessage(
                      'Peringatan Pengawas: Dilarang menyentuh tombol volume atau panel screenshot HP!'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 border border-white/10 cursor-pointer"
                >
                  Anti-Screenshot
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomWarningMessage(
                      'Peringatan Pengawas: Dilarang meminimalkan browser atau membuka tab aplikasi lain!'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 border border-white/10 cursor-pointer"
                >
                  Dilarang Pindah Tab
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomWarningMessage(
                      'Peringatan Pengawas: Dilarang memblok teks soal ujian untuk copy-paste!'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 border border-white/10 cursor-pointer"
                >
                  Dilarang Blok Soal
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setWarningModalStudent(null)}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteSendWarning}
                className="py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Send className="w-3 h-3 text-slate-950" />
                <span>Kirim Peringatan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7B. MODAL OTORISASI KHUSUS GURU PENGAWAS UNTUK TOMBOL RESET / HAPUS */}
      {/* =================================================================== */}
      {showTeacherAuthGateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-slate-950 via-slate-900 to-rose-950/90 p-4 sm:p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/30 border border-rose-400/50 text-[9px] font-mono font-extrabold text-rose-200 uppercase">
                    AKSES TERBATAS · HANYA GURU PENGAWAS
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
                    Verifikasi Akses Guru Mapel
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTeacherAuthGateModal(false);
                  setPendingTeacherAction(null);
                  setTeacherAuthError(null);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-400/40 text-[11px] text-slate-200 space-y-1 leading-relaxed">
              <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>PROTEKSI KEAMANAN PANEL MONITORING UJIAN</span>
              </div>
              <p className="text-slate-300">
                Fitur penghapusan/reset data pada Panel Monitoring Ujian Siswa dikunci secara eksklusif dan{' '}
                <strong className="text-amber-300">HANYA GURU MAPEL ({EXAM_INFO.guruMapelUpper})</strong> yang dapat mengaksesnya.
              </p>
            </div>

            <form onSubmit={handleVerifyTeacherGateSubmit} className="space-y-3" autoComplete="off">
              <div>
                <label className="block text-xs font-bold text-sky-200 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                  <span>Masukkan Password Mode Guru untuk Lanjut:</span>
                </label>
                <div className="relative">
                  <input
                    type={showTeacherAuthPass ? 'text' : 'password'}
                    autoFocus
                    autoComplete="off"
                    value={teacherAuthPasswordInput}
                    onChange={(e) => {
                      setTeacherAuthPasswordInput(e.target.value);
                      if (teacherAuthError) setTeacherAuthError(null);
                    }}
                    placeholder="Ketik Kode Password Guru..."
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-amber-400/50 bg-slate-950 text-amber-300 placeholder:text-slate-500 text-xs font-mono font-extrabold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherAuthPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 cursor-pointer"
                  >
                    {showTeacherAuthPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {teacherAuthError && (
                <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-500 text-rose-200 text-[11px] font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{teacherAuthError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherAuthGateModal(false);
                    setPendingTeacherAction(null);
                    setTeacherAuthError(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verifikasi Guru &amp; Lanjutkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. MODAL KONFIRMASI RESET SEMUA / FILTER DATA MONITORING UJIAN      */}
      {/* =================================================================== */}
      <ResetSubmissionsModal
        key={`monitoring-reset-modal-${showResetConfirmModal}`}
        isOpen={showResetConfirmModal}
        onClose={() => setShowResetConfirmModal(false)}
        submissions={
          submissions.length > 0
            ? submissions
            : monitoredStudents.map((m) => ({
                id: m.id,
                timestamp: m.lastActiveTimestamp,
                namaSiswa: m.namaSiswa,
                nisNisn: m.nisNisn,
                kelas: m.kelas,
                semester: m.semester,
                skorBenar: m.skorBenar ?? m.progresSoal.terjawab,
                totalSoal: m.progresSoal.total,
                nilaiAkhir: m.nilaiAkhir ?? 0,
                statusKecurangan: m.violationCount > 0 ? `${m.violationCount}x Pelanggaran` : 'Bersih',
                lulusTidakLulus:
                  (m.nilaiAkhir ?? 0) >= EXAM_INFO.kkm ? 'Lulus Ujian' : 'Belum Selesai',
                answers: {},
                doubtful: {},
                violationCount: m.violationCount || 0,
                violationLogs: m.violationLogs || [],
                questionOrder: [],
                isCompleted: true,
              }))
        }
        requirePassword={!isTeacherAccessUnlocked}
        isTeacherMode={isTeacherAccessUnlocked}
        onConfirmReset={handleConfirmResetWithFilter}
      />

      {/* =================================================================== */}
      {/* 8B. MODAL KONFIRMASI HAPUS PERMANEN SISWA TERPILIH (FILTER JENJANG) */}
      {/* =================================================================== */}
      {showDeleteFilteredModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-lg w-full rounded-2xl border-2 border-rose-500/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0 shadow-inner">
                  <Trash2 className="w-5 h-5 text-rose-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                    <span>Hapus Permanen Data Siswa Terpilih</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[8px] border border-rose-500/40 font-mono">
                      LINTAS SEMUA PERANGKAT
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    Filter Jenjang: <strong className="text-amber-300">{selectedJenjangFilter === 'ALL' ? 'Semua Jenjang (VII & VIII)' : `Jenjang Kelas ${selectedJenjangFilter}`}</strong> · {filteredStudents.length} Siswa Terpilih
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteFilteredModal(false);
                  setDeleteFilteredConfirmed(false);
                }}
                disabled={isDeletingFiltered}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ringkasan Filter & Siswa yang akan dihapus */}
            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/35 space-y-2 text-[10px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-slate-300">
                <span className="font-bold flex items-center gap-1 text-sky-300">
                  <Layers className="w-3.5 h-3.5" />
                  Kategori Filter Aktif:
                </span>
                <span className="font-extrabold text-white">
                  {selectedJenjangFilter === 'ALL' ? 'Semua Jenjang (Kelas VII & Kelas VIII)' : `Khusus Jenjang Kelas ${selectedJenjangFilter}`}
                  {selectedKelasFilter !== 'ALL' && ` · Rombel ${selectedKelasFilter}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300 pt-0.5">
                <span>Jumlah Siswa Terpilih:</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-black text-[11px] border border-rose-500/30">
                  {filteredStudents.length} Data Siswa
                </span>
              </div>

              {/* Preview chip nama-nama siswa terpilih */}
              <div className="pt-1.5">
                <span className="text-[9px] text-slate-400 block mb-1 font-semibold">
                  Daftar nama siswa terpilih ({Math.min(10, filteredStudents.length)} dari {filteredStudents.length}):
                </span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-slate-900 border border-white/5">
                  {filteredStudents.slice(0, 12).map((st) => (
                    <span
                      key={st.id}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[8.5px] font-medium border border-white/10 truncate max-w-[170px]"
                    >
                      {st.namaSiswa} ({st.kelas})
                    </span>
                  ))}
                  {filteredStudents.length > 12 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 text-[8.5px] font-bold border border-rose-500/30">
                      +{filteredStudents.length - 12} siswa lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Peringatan Keras Penghapusan Permanen Lintas Semua Perangkat Siswa */}
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-[9.5px] sm:text-[10px] text-rose-200 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
                <span>Peringatan Permanen Lintas Semua Perangkat Device Siswa:</span>
              </div>
              <p className="text-slate-200">
                Jika Anda menekan tombol hapus ini, maka <strong>SEMUA DATA SISWA YANG DIPILIH ({filteredStudents.length} SISWA) AKAN TERHAPUS PERMANEN</strong> dan berlaku seketika di:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-200 text-[9px] sm:text-[9.5px] pl-1 font-medium">
                <li><strong>Seluruh perangkat device siswa lain</strong> (Data akan seketika terhapus dari tampilan siswa dan hasil pengerjaan)</li>
                <li><strong>Layar aktif siswa bersangkutan</strong> (Jika siswa sedang mengerjakan/membuka ujian, layarnya akan otomatis keluar ke halaman beranda)</li>
                <li><strong>Database Cloud Firebase Firestore & Server Backend</strong></li>
                <li><strong>Rekap Nilai Google Spreadsheet Resmi</strong> (Baris data siswa terpilih akan dibersihkan)</li>
                <li><strong>Panel Monitoring, Denah Kursi Lab Komputer & Kuota Token Ujian</strong></li>
              </ul>
              <p className="text-[9px] text-rose-300 font-bold italic pt-0.5">
                * Data siswa di luar filter yang dipilih akan tetap aman dan tidak ikut terhapus. Tindakan ini TIDAK DAPAT DIBATALKAN.
              </p>
            </div>

            {/* Verifikasi Keamanan Guru Mapel / Pengawas jika belum terbuka */}
            {!isTeacherAccessUnlocked && !isLocalTeacherVerified && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Password Mode Guru Mapel / Pengawas:</span>
                  </span>
                  <span className="text-[8.5px] text-slate-400 font-mono">Keamanan Guru</span>
                </div>
                <div className="relative">
                  <input
                    type={showDeleteFilteredPass ? 'text' : 'password'}
                    value={deleteFilteredPasswordInput}
                    onChange={(e) => {
                      setDeleteFilteredPasswordInput(e.target.value);
                      setDeleteFilteredAuthError(null);
                    }}
                    placeholder="Ketik password guru (guru123)..."
                    className="w-full py-1.5 px-3 pr-8 rounded-lg bg-slate-900 border border-white/20 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeleteFilteredPass(!showDeleteFilteredPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showDeleteFilteredPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {deleteFilteredAuthError && (
                  <p className="text-[9px] text-rose-400 font-bold">{deleteFilteredAuthError}</p>
                )}
              </div>
            )}

            {/* Checkbox Konfirmasi Pencegah Salah Hapus */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-rose-500/40 hover:border-rose-400/70 transition-colors cursor-pointer shadow-inner">
              <input
                type="checkbox"
                checked={deleteFilteredConfirmed}
                onChange={(e) => setDeleteFilteredConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-400 bg-slate-900 cursor-pointer accent-rose-600"
              />
              <span className="text-[9.5px] sm:text-[10px] text-rose-200 leading-snug select-none">
                Saya memahami dan <strong>setuju menghapus permanen</strong> {filteredStudents.length} data siswa terpilih dari seluruh sistem dan <strong>BERLAKU DI SELURUH PERANGKAT SISWA LAIN</strong>.
              </span>
            </label>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteFilteredModal(false);
                  setDeleteFilteredConfirmed(false);
                }}
                disabled={isDeletingFiltered}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFiltered}
                disabled={
                  !deleteFilteredConfirmed ||
                  isDeletingFiltered ||
                  filteredStudents.length === 0 ||
                  (!isTeacherAccessUnlocked &&
                    !isLocalTeacherVerified &&
                    deleteFilteredPasswordInput.trim() !== EXAM_INFO.teacherPassword)
                }
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  deleteFilteredConfirmed &&
                  !isDeletingFiltered &&
                  filteredStudents.length > 0 &&
                  (isTeacherAccessUnlocked ||
                    isLocalTeacherVerified ||
                    deleteFilteredPasswordInput.trim() === EXAM_INFO.teacherPassword)
                    ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white cursor-pointer shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40 active:scale-98'
                    : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed opacity-60'
                }`}
                title={
                  !deleteFilteredConfirmed
                    ? 'Centang kotak konfirmasi terlebih dahulu untuk mengaktifkan tombol'
                    : !isTeacherAccessUnlocked &&
                      !isLocalTeacherVerified &&
                      deleteFilteredPasswordInput.trim() !== EXAM_INFO.teacherPassword
                    ? 'Masukkan password mode guru yang benar'
                    : 'Klik untuk menghapus permanen seluruh data siswa terpilih lintas semua perangkat'
                }
              >
                {isDeletingFiltered ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus Permanen {filteredStudents.length} Siswa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Permanen {filteredStudents.length} Siswa Lintas Perangkat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 9. MODAL KONFIRMASI HAPUS SISWA TUNGGAL (SATU PERSATU)             */}
      {/* =================================================================== */}
      {resetSingleStudentTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full rounded-2xl border-2 border-rose-500/80 bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 shrink-0 shadow-inner">
                  <Trash2 className="w-5 h-5 text-rose-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span>Konfirmasi Hapus Permanen Siswa</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[8px] border border-rose-500/40 font-mono">
                      PERMANEN
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    Pencegahan penghapusan tidak disengaja · Data dihapus tuntas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetSingleStudentTarget(null);
                  setSingleDeleteConfirmed(false);
                }}
                disabled={isResettingSingle}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profil Siswa yang Akan Dihapus */}
            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/35 space-y-2 text-[10.5px]">
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-rose-400/60 bg-slate-900 shrink-0 flex items-center justify-center">
                  {resetSingleStudentTarget.photoUrl ? (
                    <img
                      src={resetSingleStudentTarget.photoUrl}
                      alt={resetSingleStudentTarget.namaSiswa}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-mono text-xs font-bold text-amber-300">
                      {resetSingleStudentTarget.namaSiswa.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-white text-xs truncate">
                    {resetSingleStudentTarget.namaSiswa}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    NISN: {resetSingleStudentTarget.nisNisn} · Kelas {resetSingleStudentTarget.kelas} · {resetSingleStudentTarget.semester}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[9.5px]">
                <div className="p-1.5 rounded bg-slate-900/80 border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Tipe Ujian:</span>
                  <span className="font-bold text-sky-300">
                    {resetSingleStudentTarget.examType === 'PILIHAN_BERGANDA' ? 'PG 25 Soal' : 'Esay 15 Soal'}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-900/80 border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Progres / Nilai:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {resetSingleStudentTarget.progresSoal.terjawab}/{resetSingleStudentTarget.progresSoal.total} ({resetSingleStudentTarget.nilaiAkhir ?? '-'}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Peringatan Penghapusan Permanen dari Seluruh Sistem */}
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[9.5px] sm:text-[10px] text-rose-200 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-rose-300 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Peringatan Penghapusan Permanen:</span>
              </div>
              <p className="text-slate-200">
                Data siswa <strong className="text-amber-300 font-bold">{resetSingleStudentTarget.namaSiswa}</strong> akan dihapus secara <strong>PERMANEN</strong> dari:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-200 text-[9px] sm:text-[9.5px] pl-1 font-medium">
                <li>Panel Live Monitoring Ujian Pengawas</li>
                <li>Layar Ujian &amp; Seluruh Perangkat Device Siswa Lain (Seketika terhapus sinkron di seluruh perangkat device yang digunakan siswa)</li>
                <li>Database Cloud Firebase Firestore (Lintas Semua Perangkat)</li>
                <li>Server Backend &amp; Berkas CSV Rekap Hasil Ujian</li>
                <li>Lembar Rekap Nilai Google Spreadsheet Resmi</li>
                <li>Denah Kursi Lab Komputer &amp; Kuota Penggunaan Kode Token</li>
              </ul>
              <p className="text-[9px] text-rose-300 font-semibold italic pt-0.5">
                * Data siswa peserta lainnya tetap aman dan tidak ikut terhapus. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            {/* Verifikasi Keamanan Guru Mapel / Pengawas jika belum terbuka */}
            {!isTeacherAccessUnlocked && !isLocalTeacherVerified && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Password Mode Guru Mapel / Pengawas:</span>
                  </span>
                  <span className="text-[8.5px] text-slate-400 font-mono">Keamanan Guru</span>
                </div>
                <div className="relative">
                  <input
                    type={showSingleResetPass ? 'text' : 'password'}
                    value={singleResetPasswordInput}
                    onChange={(e) => {
                      setSingleResetPasswordInput(e.target.value);
                      setSingleResetAuthError(null);
                    }}
                    placeholder="Ketik password guru (guru123)..."
                    className="w-full py-1.5 px-3 pr-8 rounded-lg bg-slate-900 border border-white/20 text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSingleResetPass(!showSingleResetPass)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showSingleResetPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {singleResetAuthError && (
                  <p className="text-[9px] text-rose-400 font-bold">{singleResetAuthError}</p>
                )}
              </div>
            )}

            {/* Checkbox Konfirmasi Pencegah Salah Hapus */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-rose-500/40 hover:border-rose-400/70 transition-colors cursor-pointer shadow-inner">
              <input
                type="checkbox"
                checked={singleDeleteConfirmed}
                onChange={(e) => setSingleDeleteConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-400 bg-slate-900 cursor-pointer accent-rose-600"
              />
              <span className="text-[9.5px] sm:text-[10px] text-rose-200 leading-snug select-none">
                Saya memahami dan <strong>setuju menghapus permanen</strong> data siswa <strong className="text-white underline">{resetSingleStudentTarget.namaSiswa}</strong> dari seluruh sistem dan <strong>BERLAKU DI SELURUH PERANGKAT DEVICE SISWA LAIN</strong>.
              </span>
            </label>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setResetSingleStudentTarget(null);
                  setSingleDeleteConfirmed(false);
                }}
                disabled={isResettingSingle}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleStudentReset}
                disabled={
                  !singleDeleteConfirmed ||
                  isResettingSingle ||
                  (!isTeacherAccessUnlocked &&
                    !isLocalTeacherVerified &&
                    singleResetPasswordInput.trim() !== EXAM_INFO.teacherPassword)
                }
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  singleDeleteConfirmed &&
                  !isResettingSingle &&
                  (isTeacherAccessUnlocked ||
                    isLocalTeacherVerified ||
                    singleResetPasswordInput.trim() === EXAM_INFO.teacherPassword)
                    ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white cursor-pointer shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40 active:scale-98'
                    : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed opacity-60'
                }`}
                title={
                  !singleDeleteConfirmed
                    ? 'Centang kotak konfirmasi di atas terlebih dahulu untuk mengaktifkan tombol hapus permanen'
                    : !isTeacherAccessUnlocked &&
                      !isLocalTeacherVerified &&
                      singleResetPasswordInput.trim() !== EXAM_INFO.teacherPassword
                    ? 'Masukkan password mode guru yang benar terlebih dahulu'
                    : 'Klik untuk menghapus permanen data siswa ini'
                }
              >
                {isResettingSingle ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus Permanen...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Permanen Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 10. MODAL EDIT PROFIL, DATA & FOTO SISWA                           */}
      {/* =================================================================== */}
      {editStudentTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-lg w-full rounded-2xl border border-emerald-400/50 bg-slate-900 p-4 sm:p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight">
                    Edit Data & Foto Profil Siswa
                  </h3>
                  <p className="text-[9.5px] text-slate-300">
                    {editStudentTarget.namaSiswa} · Kelas {editStudentTarget.kelas} (NISN: {editStudentTarget.nisNisn})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraInModal();
                  setEditStudentTarget(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bagian Foto Profil Siswa (Bisa Ditambahkan / Diganti) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Foto Profil Siswa
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {editPhotoUrl ? '✓ Foto Tersedia' : 'Belum Ada Foto (Kotak Nama Singkat)'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                {/* Avatar Preview Box */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-emerald-400/60 bg-slate-900 shadow-lg flex items-center justify-center ring-2 ring-emerald-500/20">
                    {editPhotoUrl ? (
                      <img
                        src={editPhotoUrl}
                        alt={editNama || 'Preview Foto'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
                        <span className="font-mono text-2xl font-black text-amber-300 drop-shadow-md">
                          {(editNama || 'NA').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold mt-0.5">Nama Singkat</span>
                      </div>
                    )}
                  </div>

                  {editPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditPhotoUrl('')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md cursor-pointer border border-white/40"
                      title="Hapus foto dan kembali ke inisial kotak kecil"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Tombol Opsi Tambah / Ubah Foto */}
                <div className="flex-1 w-full space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Tombol Unggah File */}
                    <input
                      ref={fileInputModalRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUploadInModal}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputModalRef.current?.click()}
                      className="py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[9.5px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Unggah File Foto</span>
                    </button>

                    {/* Tombol Kamera Langsung */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isCameraActiveInModal) {
                          stopCameraInModal();
                        } else {
                          startCameraInModal('user');
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold text-[9.5px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                        isCameraActiveInModal
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      <span>{isCameraActiveInModal ? 'Tutup Kamera' : 'Buka Kamera Web'}</span>
                    </button>
                  </div>

                  {/* Pilihan Avatar Formal Siswa Otomatis */}
                  <div className="pt-1 border-t border-white/10">
                    <span className="text-[8.5px] text-slate-300 block mb-1 font-semibold">
                      Atau pilih Avatar Pas Foto Siswa Formal instan:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditPhotoUrl(
                            generateFormalStudentAvatarDataUrl(
                              editNama || 'SISWA',
                              editKelas || 'VIII-1',
                              'putra',
                              'merah'
                            )
                          )
                        }
                        className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[8px] font-bold truncate cursor-pointer border border-white/10"
                        title="Avatar Siswa Putra Berdasi Merah"
                      >
                        👔 Putra Merah
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditPhotoUrl(
                            generateFormalStudentAvatarDataUrl(
                              editNama || 'SISWA',
                              editKelas || 'VIII-1',
                              'putri',
                              'merah'
                            )
                          )
                        }
                        className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[8px] font-bold truncate cursor-pointer border border-white/10"
                        title="Avatar Siswa Putri Berdasi Merah"
                      >
                        🎀 Putri Merah
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditPhotoUrl(
                            generateFormalStudentAvatarDataUrl(
                              editNama || 'SISWA',
                              editKelas || 'VIII-1',
                              'hijab',
                              'biru'
                            )
                          )
                        }
                        className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[8px] font-bold truncate cursor-pointer border border-white/10"
                        title="Avatar Siswa Putri Hijab Biru"
                      >
                        🧕 Hijab Biru
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditPhotoUrl(
                            generateFormalStudentAvatarDataUrl(
                              editNama || 'SISWA',
                              editKelas || 'VIII-1',
                              'putra',
                              'biru'
                            )
                          )
                        }
                        className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[8px] font-bold truncate cursor-pointer border border-white/10"
                        title="Avatar Siswa Putra Jas Biru"
                      >
                        🎓 Putra Biru
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Viewfinder Kamera Langsung jika aktif */}
              {isCameraActiveInModal && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-400/50 space-y-2 mt-2">
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-48 flex items-center justify-center">
                    <video
                      ref={videoModalRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
                    />
                    <div className="absolute inset-0 border-2 border-emerald-400/40 rounded-lg pointer-events-none flex items-center justify-center">
                      <div className="w-24 h-32 rounded-full border-2 border-dashed border-emerald-300/60" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        startCameraInModal(cameraFacing === 'user' ? 'environment' : 'user')
                      }
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold cursor-pointer"
                    >
                      Balik Kamera
                    </button>
                    <button
                      type="button"
                      onClick={captureCameraPhotoInModal}
                      className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] cursor-pointer shadow-md flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Jepret Foto Sekarang</span>
                    </button>
                  </div>
                </div>
              )}

              {cameraErrorInModal && (
                <div className="text-[9px] text-rose-300 bg-rose-950/60 border border-rose-500/40 p-2 rounded-lg">
                  {cameraErrorInModal}
                </div>
              )}
            </div>

            {/* Form Identitas & Akademik Siswa */}
            <div className="space-y-2.5 text-[10.5px]">
              {/* Nama Lengkap Siswa */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nama Lengkap Siswa:
                </label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  placeholder="Masukkan Nama Lengkap Siswa"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/20 text-white font-medium focus:border-emerald-400 focus:outline-hidden"
                />
              </div>

              {/* NIS / NISN */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  NIS / NISN:
                </label>
                <input
                  type="text"
                  value={editNisNisn}
                  onChange={(e) => setEditNisNisn(e.target.value)}
                  placeholder="Nomor Induk Siswa Nasional"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/20 text-white font-mono focus:border-emerald-400 focus:outline-hidden"
                />
              </div>

              {/* Kelas & Semester */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Kelas:
                  </label>
                  <select
                    value={editKelas}
                    onChange={(e) => setEditKelas(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/20 text-white focus:border-emerald-400 focus:outline-hidden"
                  >
                    <option value="VII-1">VII-1</option>
                    <option value="VII-2">VII-2</option>
                    <option value="VII-3">VII-3</option>
                    <option value="VII-4">VII-4</option>
                    <option value="VIII-1">VIII-1</option>
                    <option value="VIII-2">VIII-2</option>
                    <option value="VIII-3">VIII-3</option>
                    <option value="VIII-4">VIII-4</option>
                    <option value="IX-1">IX-1</option>
                    <option value="IX-2">IX-2</option>
                    <option value="IX-3">IX-3</option>
                    <option value="IX-4">IX-4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Semester:
                  </label>
                  <select
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value as 'Ganjil' | 'Genap')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/20 text-white focus:border-emerald-400 focus:outline-hidden"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              {/* Nilai Akhir & Pelanggaran */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Nilai Akhir (0 - 100):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editNilaiAkhir}
                    onChange={(e) => setEditNilaiAkhir(e.target.value)}
                    placeholder="Contoh: 85"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/20 text-amber-300 font-mono font-bold focus:border-emerald-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Pelanggaran:
                  </label>
                  <select
                    value={editViolationCount}
                    onChange={(e) => setEditViolationCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/20 text-white font-mono focus:border-emerald-400 focus:outline-hidden"
                  >
                    <option value={0}>0 - Bersih / Tanpa Pelanggaran</option>
                    <option value={1}>1x Pelanggaran</option>
                    <option value={2}>2x Pelanggaran</option>
                    <option value={3}>3x Pelanggaran (Diskualifikasi)</option>
                  </select>
                </div>
              </div>

              {/* Status Pengerjaan Ujian */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Status Pengerjaan Ujian:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditStatus('SEDANG_MENGERJAKAN')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[9.5px] border cursor-pointer transition-all ${
                      editStatus === 'SEDANG_MENGERJAKAN'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Sedang Ujian
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('SELESAI')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[9.5px] border cursor-pointer transition-all ${
                      editStatus === 'SELESAI'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Selesai Ujian
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('DISKUALIFIKASI')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-[9.5px] border cursor-pointer transition-all ${
                      editStatus === 'DISKUALIFIKASI'
                        ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Diskualifikasi
                  </button>
                </div>
              </div>
            </div>

            {/* Tombol Footer Aksi */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  const target = editStudentTarget;
                  stopCameraInModal();
                  setEditStudentTarget(null);
                  handleOpenResetSingleStudentButton(target, 'DELETE_SUBMISSION');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-extrabold text-[9.5px] flex items-center gap-1 cursor-pointer transition-colors"
                title="Hapus data siswa ini satu persatu"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Siswa</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraInModal();
                    setEditStudentTarget(null);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditStudent}
                  disabled={isSavingEdit}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10.5px] font-black cursor-pointer transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 11. MODAL PRATINJAU & PUSAT CETAK DATA RESMI MONITORING PENGAWAS   */}
      {/* =================================================================== */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="max-w-4xl w-full rounded-2xl border-2 border-purple-400/70 bg-slate-900 p-3.5 sm:p-5 shadow-2xl flex flex-col max-h-[94vh] space-y-3">
            {/* Header Toolbar Modal Cetak */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
                  <Printer className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                    <span>Pratinjau &amp; Cetak Lembar Monitoring Ujian</span>
                    <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[8px] border border-purple-500/40 font-mono">
                      SIAP CETAK
                    </span>
                  </h3>
                  <p className="text-[9px] sm:text-[9.5px] text-slate-300 truncate">
                    {EXAM_INFO.namaSekolah} · {filteredStudents.length} Data Siswa Terpilih ({selectedJenjangFilter === 'ALL' ? 'Semua Jenjang' : `Jenjang Kelas ${selectedJenjangFilter}`})
                  </p>
                </div>
              </div>

              {/* Tombol Aksi Cetak Cepat di Header Modal */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExecuteDirectPrint}
                  disabled={isPrintingDocument}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-[9px] sm:text-[10px] flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer border border-purple-300/50"
                  title="Cetak Dokumen Sekarang (Dialog Print Browser)"
                >
                  <Printer className={`w-3.5 h-3.5 text-amber-300 shrink-0 ${isPrintingDocument ? 'animate-bounce' : ''}`} />
                  <span>{isPrintingDocument ? 'Mempersiapkan Cetak...' : 'Cetak Sekarang (Print)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPrintInNewTab}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-400/40 text-[9px] sm:text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Buka Dokumen Cetak Mandiri di Tab Baru (Untuk cetak tanpa batasan iframe sandbox)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                  <span className="hidden sm:inline">Tab Baru</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMonitoringReportPdf}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-200 border border-sky-400/40 text-[9px] sm:text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Unduh Berita Acara Monitoring Resmi (PDF Siap Cetak A4)"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>Unduh PDF Resmi</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMonitoringCsv}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-400/40 text-[9px] sm:text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Unduh Lembar Pantauan Siswa (.CSV)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Banner Informasi & Toolbar Edit Data Tanda Tangan (Kepala Sekolah & NIP) */}
            <div className="rounded-xl bg-purple-950/60 border border-purple-400/40 p-2.5 sm:p-3 text-xs space-y-2 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-400/20 pb-2">
                <div className="flex items-center gap-1.5 text-purple-200 text-[10px] sm:text-[11px] font-bold">
                  <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>
                    Format Dokumen Cetak Resmi Dinas Pendidikan. Anda dapat mengedit Nama Kepala Sekolah &amp; NIP di bawah ini:
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={handleResetSignaturesDefault}
                    className="px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 text-[9px] font-extrabold cursor-pointer transition-colors"
                    title="Kembalikan nama kepala sekolah dan NIP ke data default UPTD SMPN 7 Kisaran"
                  >
                    Reset ke Default
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditSignaturesPanel(!showEditSignaturesPanel)}
                    className="px-2 py-0.5 rounded bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 border border-purple-300/40 text-[9px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    <span>{showEditSignaturesPanel ? 'Sembunyikan Pengaturan' : 'Ubah Pengawas & Tanggal'}</span>
                  </button>
                </div>
              </div>

              {/* Input Langsung Nama Kepala Sekolah & NIP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-black text-amber-300 flex items-center gap-1">
                      <Edit3 className="w-2.5 h-2.5 text-amber-300" />
                      <span>Nama Kepala Sekolah:</span>
                    </label>
                    <span className="text-[8px] text-purple-300 font-mono">Bisa Diedit</span>
                  </div>
                  <input
                    type="text"
                    value={kepalaSekolahName}
                    onChange={(e) => handleUpdateKepalaSekolahName(e.target.value)}
                    placeholder="Contoh: Drs. H. SYAHRUDDIN, M.Pd."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-purple-400/60 text-white font-black text-[11px] sm:text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-black text-amber-300 flex items-center gap-1">
                      <Edit3 className="w-2.5 h-2.5 text-amber-300" />
                      <span>NIP Kepala Sekolah:</span>
                    </label>
                    <span className="text-[8px] text-purple-300 font-mono">Bisa Diedit</span>
                  </div>
                  <input
                    type="text"
                    value={kepalaSekolahNip}
                    onChange={(e) => handleUpdateKepalaSekolahNip(e.target.value)}
                    placeholder="Contoh: 19680512 199412 1 002"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-purple-400/60 text-amber-300 font-mono font-bold text-[11px] sm:text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-0.5 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9.5px] font-black text-purple-200">
                      Jabatan / Satuan Pendidikan:
                    </label>
                  </div>
                  <input
                    type="text"
                    value={kepalaSekolahJabatan}
                    onChange={(e) => handleUpdateKepalaSekolahJabatan(e.target.value)}
                    placeholder="Kepala Sekolah UPTD SMP Negeri 7 Kisaran"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-purple-400/40 text-slate-200 text-[10.5px] sm:text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Lanjutan (Guru Pengawas & Tempat/Tanggal) */}
              {showEditSignaturesPanel && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-purple-400/20">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-300">
                      Nama Guru Pengawas:
                    </label>
                    <input
                      type="text"
                      value={guruPengawasName}
                      onChange={(e) => {
                        setGuruPengawasName(e.target.value);
                        try {
                          localStorage.setItem('anbk_monitoring_guru_pengawas_name', e.target.value);
                        } catch {}
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-white/20 text-white text-[10.5px]"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-300">
                      NIP Guru Pengawas:
                    </label>
                    <input
                      type="text"
                      value={guruPengawasNip}
                      onChange={(e) => {
                        setGuruPengawasNip(e.target.value);
                        try {
                          localStorage.setItem('anbk_monitoring_guru_pengawas_nip', e.target.value);
                        } catch {}
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-white/20 text-white font-mono text-[10.5px]"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-300">
                      Tempat &amp; Tanggal Surat:
                    </label>
                    <input
                      type="text"
                      value={tanggalDokumenCetak}
                      onChange={(e) => {
                        setTanggalDokumenCetak(e.target.value);
                        try {
                          localStorage.setItem('anbk_monitoring_tanggal_cetak', e.target.value);
                        } catch {}
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-white/20 text-white text-[10.5px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Kertas Pratinjau Dokumen Cetak (Paper View) */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] rounded-xl border border-slate-300 bg-white text-slate-900 p-4 sm:p-6 shadow-inner font-sans space-y-4">
              {/* KOP RESMI LEMBAGA SEKOLAH */}
              <div className="border-b-2 border-slate-900 pb-3 text-center space-y-0.5">
                <h2 className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-slate-700">
                  PEMERINTAH KABUPATEN ASAHAN • DINAS PENDIDIKAN
                </h2>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-950">
                  {EXAM_INFO.namaSekolah}
                </h1>
                <p className="text-[9px] sm:text-[10px] font-semibold text-slate-600">
                  Alamat: Kisaran, Kab. Asahan, Sumatera Utara • Website: www.smpn7kisaran.sch.id
                </p>
                <div className="h-0.5 bg-slate-900 my-2" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 pt-1">
                  LAPORAN RESMI MONITORING PENGAWASAN &amp; HASIL EVALUASI UJIAN SISWA
                </h3>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-800">
                  Mata Pelajaran: {EXAM_INFO.mataPelajaran} (Fase D SMP) • Guru Pengawas: {EXAM_INFO.guruMapelUpper}
                </p>
                <div className="flex flex-wrap items-center justify-between text-[9px] font-mono text-slate-600 pt-2 border-t border-slate-300 gap-1">
                  <span>Waktu Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {new Date().toLocaleTimeString('id-ID')} WIB</span>
                  <span>Filter: {selectedJenjangFilter === 'ALL' ? 'Semua Jenjang (VII & VIII)' : `Khusus Jenjang ${selectedJenjangFilter}`} | Token: {onlineToken || 'AKTIF'}</span>
                  <span>Total Siswa: {filteredStudents.length} Peserta</span>
                </div>
              </div>

              {/* REKAP STATISTIK KELAS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-center text-xs">
                <div>
                  <span className="text-[9px] text-slate-600 block">Total Siswa Terdata</span>
                  <strong className="text-xs sm:text-sm text-slate-900 font-mono font-bold">{stats.total} Siswa</strong>
                </div>
                <div>
                  <span className="text-[9px] text-emerald-800 block">Selesai Ujian</span>
                  <strong className="text-xs sm:text-sm text-emerald-700 font-mono font-bold">{stats.finished} Siswa</strong>
                </div>
                <div>
                  <span className="text-[9px] text-sky-800 block">Sedang Mengerjakan</span>
                  <strong className="text-xs sm:text-sm text-sky-700 font-mono font-bold">{stats.active} Siswa</strong>
                </div>
                <div>
                  <span className="text-[9px] text-rose-800 block">Pelanggaran / Diskualifikasi</span>
                  <strong className="text-xs sm:text-sm text-rose-700 font-mono font-bold">{stats.violations + stats.disqualified} Siswa</strong>
                </div>
              </div>

              {/* TABEL DATA LENGKAP SISWA */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-extrabold border-b border-slate-800 text-[9px] sm:text-[9.5px] uppercase">
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-8">No</th>
                      <th className="py-1.5 px-2 border-r border-slate-400">Nama Siswa</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-24">NIS / NISN</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-14">Kelas</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-14">Tipe</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-24">Status</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-20">Progres</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-12">Nilai</th>
                      <th className="py-1.5 px-2 border-r border-slate-400 text-center w-20">Pelanggaran</th>
                      <th className="py-1.5 px-2 text-left">Perangkat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-4 text-center text-slate-500 italic">
                          Tidak ada data siswa terpantau pada filter saat ini.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st, idx) => (
                        <tr key={st.id || idx} className="border-b border-slate-300 text-[9px] sm:text-[9.5px] hover:bg-slate-50">
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                          <td className="py-1 px-2 border-r border-slate-300 font-bold">{st.namaSiswa}</td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">{st.nisNisn || '-'}</td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-bold">{st.kelas}</td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">
                            {st.examType === 'PILIHAN_BERGANDA' ? 'PG 25' : 'Esay 15'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-semibold">
                            {st.status === 'SELESAI'
                              ? 'Selesai'
                              : st.status === 'SEDANG_MENGERJAKAN'
                              ? 'Mengerjakan'
                              : 'Diskualifikasi'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-mono">
                            {st.progresSoal.terjawab}/{st.progresSoal.total} ({st.progresSoal.persentase}%)
                          </td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center font-mono font-bold">
                            {st.nilaiAkhir !== undefined ? st.nilaiAkhir : '-'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-300 text-center">
                            {st.violationCount > 0 ? `${st.violationCount}x Terdeteksi` : 'Tertib'}
                          </td>
                          <td className="py-1 px-2 truncate max-w-[120px] text-[8.5px] text-slate-700">
                            {st.deviceModel || st.deviceCategory}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* KOLOM TANDA TANGAN RESMI PENGAWAS & KEPALA SEKOLAH */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-400 text-xs text-center">
                <div className="relative group p-2 rounded-lg bg-slate-50/90 border border-slate-200">
                  <div className="flex items-center justify-between text-[8.5px] text-slate-500 mb-0.5">
                    <span>Mengetahui,</span>
                    <button
                      type="button"
                      onClick={() => setShowEditSignaturesPanel(true)}
                      className="text-purple-600 hover:text-purple-800 font-bold flex items-center gap-0.5 print:hidden cursor-pointer"
                      title="Klik untuk mengubah Nama & NIP Kepala Sekolah"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Edit TTD</span>
                    </button>
                  </div>
                  <p className="font-bold text-slate-900 mt-0.5">{kepalaSekolahJabatan}</p>
                  <div className="h-10" />
                  <p className="font-bold text-slate-900 underline text-xs sm:text-sm">{kepalaSekolahName}</p>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5">NIP. {kepalaSekolahNip}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50/90 border border-slate-200">
                  <p className="text-slate-600 text-[9px]">{tanggalDokumenCetak}</p>
                  <p className="font-bold text-slate-900 mt-0.5">Guru Mata Pelajaran / Pengawas Ruang</p>
                  <div className="h-10" />
                  <p className="font-bold text-slate-900 underline text-xs sm:text-sm">{guruPengawasName}</p>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5">NIP. {guruPengawasNip}</p>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <span className="text-[9px] text-slate-400 hidden sm:inline">
                Format Lembar Standar Cetak Landscape A4
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMonitoringReportPdf}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>Unduh PDF A4</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDirectPrint}
                  disabled={isPrintingDocument}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 border border-purple-300/40"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isPrintingDocument ? 'Mempersiapkan Cetak...' : 'Cetak Sekarang'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
